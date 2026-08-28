const mongoose = require("mongoose");
const CandidatePipeline = require("../../models/pipeline/CandidatePipeline");
const Assessment = require("../../models/pipeline/Assessment");
const { generateMcqSetAI } = require("../../services/assessmentGenerator");
const { gradeMcq, generateFeedback, sha256WithSalt } = require("../../services/assessmentEvaluator");
const { logEvent } = require("../../services/pipelineEvents");
const InternshipPost = require("../../models/webapp-models/internshipPostModel");
const sendNotification = require("../../utils/Notification");

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * POST /api/l2-assessments/generate
 * body: { internshipId, studentId, partnerId, config? }
 *
 * ✅ FIXED: Separates "already exists" from "create new" to avoid $setOnInsert
 *           silently skipping pipeline updates on duplicates.
 */
async function generateAssessment(req, res) {
  try {
    const { internshipId, studentId, partnerId, config } = req.body;

    if (
      !isValidObjectId(internshipId) ||
      !isValidObjectId(studentId) ||
      !isValidObjectId(partnerId)
    ) {
      return res.status(400).json({ message: "Invalid IDs" });
    }

    // ── Step 1: Check for existing assessment ──────────────────────────────
    const existingAssessment = await Assessment.findOne({
      internshipId,
      studentId,
      attempt: 1,
    });

    if (existingAssessment) {
      // ✅ ALSO update the pipeline in case it was missed on first generation
      await CandidatePipeline.findOneAndUpdate(
        { internshipId, studentId },
        {
          $set: {
            partnerId,
            stage: "L2",
            "l2.enabled": true,
            "l2.status": "generated",
            "l2.assessmentId": existingAssessment._id,
            "l2.updatedAt": new Date(),
          },
          $setOnInsert: { internshipId, studentId },
        },
        { upsert: true }
      );

      return res.status(200).json({
        assessmentId: existingAssessment._id,
        message: "Assessment already exists",
        existing: true,
      });
    }

    // ── Step 2: Load internship ────────────────────────────────────────────
    const internship = await InternshipPost.findById(internshipId).lean();
    if (!internship) {
      return res.status(404).json({ message: "Internship not found" });
    }

    const internshipTitle = internship.jobTitle || "Untitled Internship";
    const internshipDescription = internship.jobDescription || "No description provided.";
    const skills = Array.isArray(internship.skills)
      ? internship.skills
      : Array.isArray(internship.qualifications)
        ? internship.qualifications
        : [];

    // ── Step 3: Config snapshot ────────────────────────────────────────────
    const cfg = {
      assessmentType: config?.assessmentType || "mcqs",
      allowText: !!config?.allowText,
      allowFileUpload: !!config?.allowFileUpload,
      difficulty: Math.min(3, Math.max(1, Number(config?.difficulty || 2))),
      questionCount: Math.min(50, Math.max(5, Number(config?.questionCount || 10))),
      timeLimitMinutes: Math.min(180, Math.max(5, Number(config?.timeLimitMinutes || 20))),
      passScore: Math.min(100, Math.max(0, Number(config?.passScore || 70))),
    };

    if (!internshipTitle || !internshipDescription) {
      return res.status(400).json({
        message: "Internship title or description is missing.",
      });
    }

    // ── Step 4: Generate AI questions ──────────────────────────────────────
    const questions = await generateMcqSetAI({
      internshipTitle,
      internshipDescription,
      skills,
      questionCount: cfg.questionCount,
      difficulty: cfg.difficulty,
      assessmentType: cfg.assessmentType,
    });

    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(500).json({ message: "AI failed to generate questions" });
    }

    // Accept if we got at least 70% of requested count (matches generator threshold)
    const minAcceptable = Math.floor(cfg.questionCount * 0.7);
    if (questions.length < minAcceptable) {
      return res.status(500).json({
        message: `AI generated only ${questions.length}/${cfg.questionCount} questions`,
      });
    }

    // ── Step 5: Create assessment ──────────────────────────────────────────
    // ✅ Use create() instead of findOneAndUpdate+$setOnInsert to guarantee
    //    the document is fresh and the pipeline update always runs.
    let assessment;
    try {
      assessment = await Assessment.create({
        internshipId,
        studentId,
        partnerId,
        configSnapshot: cfg,
        timing: { timeLimitMinutes: cfg.timeLimitMinutes },
        questions,
        status: "generated",
        attempt: 1,
      });
    } catch (createErr) {
      // Handle race condition: another request created it first (duplicate key)
      if (createErr.code === 11000) {
        const existing = await Assessment.findOne({ internshipId, studentId, attempt: 1 });
        if (existing) {
          await CandidatePipeline.findOneAndUpdate(
            { internshipId, studentId },
            {
              $set: {
                partnerId,
                stage: "L2",
                "l2.enabled": true,
                "l2.status": "generated",
                "l2.assessmentId": existing._id,
                "l2.updatedAt": new Date(),
              },
              $setOnInsert: { internshipId, studentId },
            },
            { upsert: true }
          );
          return res.status(200).json({
            assessmentId: existing._id,
            message: "Assessment already exists",
            existing: true,
          });
        }
      }
      throw createErr;
    }

    // ── Step 6: Update pipeline ────────────────────────────────────────────
    await CandidatePipeline.findOneAndUpdate(
      { internshipId, studentId },
      {
        $set: {
          partnerId,
          stage: "L2",
          "l2.enabled": true,
          "l2.status": "generated",
          "l2.assessmentId": assessment._id,   // ✅ Always set after create()
          "l2.updatedAt": new Date(),
        },
        $setOnInsert: { internshipId, studentId },
      },
      { upsert: true }
    );

    // ── Step 7: Log event ──────────────────────────────────────────────────
    logEvent({
      internshipId,
      studentId,
      partnerId,
      type: "L2_GENERATED",
      actorKind: "partner",
      actorId: partnerId,
      payload: {
        assessmentId: String(assessment._id),
        source: "AI",
        internshipTitle,
        questionCount: questions.length,
        difficulty: cfg.difficulty,
      },
    });

    return res.status(201).json({ assessmentId: assessment._id });

  } catch (err) {
    console.error("❌ generateAssessment error:", err);
    return res.status(500).json({
      message: "Failed to generate assessment",
      error: process.env.NODE_ENV === "development" ? err.message : "Internal server error",
    });
  }
}

/**
 * POST /api/l2-assessments/:id/send
 */
async function sendAssessment(req, res) {
  try {
    const { id } = req.params;
    const { partnerId } = req.body;

    if (!isValidObjectId(id) || !isValidObjectId(partnerId)) {
      return res.status(400).json({ message: "Invalid ids" });
    }

    const assessment = await Assessment.findById(id);
    if (!assessment) {
      return res.status(404).json({ message: "Assessment not found" });
    }

    if (["sent", "started", "submitted", "evaluated", "passed", "rejected"].includes(assessment.status)) {
      return res.json({ ok: true, status: assessment.status });
    }

    assessment.status = "sent";
    await assessment.save();

    await CandidatePipeline.findOneAndUpdate(
      { internshipId: assessment.internshipId, studentId: assessment.studentId },
      {
        $set: {
          stage: "L2",
          "l2.status": "sent",
          "l2.updatedAt": new Date(),
        },
      },
      { upsert: true }
    );

    await sendNotification({
      studentId: assessment.studentId,
      title: "Level 2 Assessment Assigned",
      message: `Your Level 2 assessment has been assigned. Please complete it within ${assessment.timing.timeLimitMinutes} minutes.`,
      link: `/user-main-page?openTab=applications`,
      type: "general",
    });

    logEvent({
      internshipId: assessment.internshipId,
      studentId: assessment.studentId,
      partnerId,
      type: "L2_SENT",
      actorKind: "partner",
      actorId: partnerId,
      payload: { assessmentId: String(assessment._id) },
    });

    return res.json({ ok: true, status: "sent" });
  } catch (err) {
    console.error("❌ sendAssessment error:", err);
    return res.status(500).json({ message: "Failed to send assessment" });
  }
}

async function getAssessmentsByInternship(req, res) {
  try {
    const { internshipId } = req.params;
    if (!isValidObjectId(internshipId))
      return res.status(400).json({ message: "Invalid internshipId" });

    const items = await Assessment.find({ internshipId }).sort({ updatedAt: -1 }).lean();
    return res.json({ items });
  } catch (err) {
    console.error("❌ getAssessmentsByInternship error:", err);
    return res.status(500).json({ message: "Failed to fetch assessments" });
  }
}

async function getAssessmentsByStudent(req, res) {
  try {
    const { studentId } = req.params;
    if (!isValidObjectId(studentId))
      return res.status(400).json({ message: "Invalid studentId" });

    const items = await Assessment.find({ studentId }).sort({ updatedAt: -1 }).lean();
    return res.json({ items });
  } catch (err) {
    console.error("❌ getAssessmentsByStudent error:", err);
    return res.status(500).json({ message: "Failed to fetch assessments" });
  }
}

/**
 * POST /api/l2-assessments/:id/start
 */
async function startAssessment(req, res) {
  try {
    const { id } = req.params;
    const { ipAddress, userAgent, proctoringVerified } = req.body;

    if (!isValidObjectId(id))
      return res.status(400).json({ message: "Invalid assessment id" });

    const assessment = await Assessment.findById(id);
    if (!assessment) return res.status(404).json({ message: "Assessment not found" });

    // Check if assessment has questions before allowing it to be started
    if (!assessment.questions || assessment.questions.length === 0) {
      return res.status(400).json({ message: "Assessment has no questions. Please contact support." });
    }

    // If assessment was already started, allow the frontend to supply
    // `proctoringVerified` to update the anti-cheat record (useful on resume).

    if (["submitted", "evaluated", "passed", "rejected"].includes(assessment.status)) {
      return res.status(409).json({ message: "Assessment already completed" });
    }

    if (assessment.status === "started" && assessment.timing.startedAt) {
      // If the client proved media access on resume, persist it.
      if (proctoringVerified && !(assessment.antiCheat && assessment.antiCheat.proctoringVerified)) {
        assessment.antiCheat = Object.assign({}, assessment.antiCheat || {}, {
          proctoringVerified: true,
          proctoringVerifiedAt: new Date(),
        });
        await assessment.save();
      }

      const shuffledQuestions = shuffleArray(
        assessment.questions.map((q) => ({
          questionId: q.questionId,
          question: q.question,
          options: q.options,
        }))
      );

      return res.json({
        ok: true,
        startedAt: assessment.timing.startedAt,
        timeLimitMinutes: assessment.timing.timeLimitMinutes,
        proctoringVerified: assessment.antiCheat?.proctoringVerified || false,
        proctoringVerifiedAt: assessment.antiCheat?.proctoringVerifiedAt || null,
        questions: shuffledQuestions,
        message: "Assessment already started",
      });
    }

    const antiCheatData = {
      ipAddress: ipAddress || req.ip || req.headers["x-forwarded-for"] || "unknown",
      // proctoringVerified can be provided by the frontend after getUserMedia succeeded
      proctoringVerified: !!proctoringVerified,
      proctoringVerifiedAt: proctoringVerified ? new Date() : null,
      userAgent: userAgent || req.headers["user-agent"] || "unknown",
      tabSwitches: 0,
      suspiciousActivity: [],
    };

    assessment.timing.startedAt = new Date();
    assessment.status = "started";
    // merge with existing antiCheat if present (preserve any server-set fields)
    assessment.antiCheat = Object.assign({}, assessment.antiCheat || {}, antiCheatData);
    await assessment.save();

    await CandidatePipeline.findOneAndUpdate(
      { internshipId: assessment.internshipId, studentId: assessment.studentId },
      { $set: { stage: "L2", "l2.status": "started", "l2.updatedAt": new Date() } },
      { upsert: true }
    );

    logEvent({
      internshipId: assessment.internshipId,
      studentId: assessment.studentId,
      partnerId: assessment.partnerId,
      type: "L2_STARTED",
      actorKind: "student",
      actorId: assessment.studentId,
      payload: {
        assessmentId: String(assessment._id),
        ipAddress: antiCheatData.ipAddress,
      },
    });

    const shuffledQuestions = shuffleArray(
      assessment.questions.map((q) => ({
        questionId: q.questionId,
        question: q.question,
        options: q.options,
      }))
    );

    return res.json({
      ok: true,
      startedAt: assessment.timing.startedAt,
      timeLimitMinutes: assessment.timing.timeLimitMinutes,
      proctoringVerified: assessment.antiCheat.proctoringVerified || false,
      proctoringVerifiedAt: assessment.antiCheat.proctoringVerifiedAt || null,
      questions: shuffledQuestions,
    });
  } catch (err) {
    console.error("❌ startAssessment error:", err);
    return res.status(500).json({ message: "Failed to start assessment" });
  }
}

/**
 * POST /api/l2-assessments/:id/submit
 */
async function submitAssessment(req, res) {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id))
      return res.status(400).json({ message: "Invalid assessment id" });

    const { mcqAnswers, textAnswer, files, timingPattern } = req.body;

    const assessment = await Assessment.findById(id);
    if (!assessment) return res.status(404).json({ message: "Assessment not found" });

    if (["submitted", "evaluated", "passed", "rejected"].includes(assessment.status)) {
      return res.status(409).json({ message: "Assessment already submitted" });
    }

    // Enforce proctoring verification: reject submissions if frontend did not verify camera/mic
    // Skip this check if DISABLE_PROCTORING_CHECK is set to 'true' (for development/testing)
    if (process.env.DISABLE_PROCTORING_CHECK !== 'true' && (!assessment.antiCheat || !assessment.antiCheat.proctoringVerified)) {
      return res.status(403).json({ message: "Proctoring was not verified. Assessment cannot be submitted." });
    }

    if (assessment.timing.startedAt) {
      const elapsedMs = Date.now() - new Date(assessment.timing.startedAt).getTime();
      const limitMs = (assessment.timing.timeLimitMinutes || 20) * 60 * 1000;

      if (elapsedMs > limitMs) {
        const result = await Assessment.findOneAndUpdate(
          { _id: id, status: { $nin: ["submitted", "evaluated"] } },
          {
            $set: {
              "submission.mcqAnswers": Array.isArray(mcqAnswers) ? mcqAnswers : [],
              "timing.submittedAt": new Date(),
              status: "submitted",
            },
          },
          { new: true }
        );

        if (!result) {
          return res.status(409).json({ message: "Assessment already processed" });
        }

        const gradeResult = gradeMcq({
          questions: result.questions || [],
          answers: result.submission.mcqAnswers,
          passScore: result.configSnapshot.passScore || 70,
          timingPattern,
        });

        const feedback = generateFeedback({
          mcqScore: gradeResult.mcqScore,
          correctCount: gradeResult.correctCount,
          total: gradeResult.total,
          domainStats: gradeResult.domainStats,
          pass: gradeResult.pass,
          passScore: result.configSnapshot.passScore || 70,
        });

        result.evaluation = {
          mcqScore: gradeResult.mcqScore,
          finalScore: gradeResult.mcqScore,
          pass: gradeResult.pass,
          feedback: `Auto-submitted due to time expiry.\n\n${feedback}`,
          evaluatedAt: new Date(),
          detailed: gradeResult.detailed,
          timingAnalysis: gradeResult.timingAnalysis,
        };

        result.status = "evaluated";
        await result.save();

        await CandidatePipeline.findOneAndUpdate(
          { internshipId: result.internshipId, studentId: result.studentId },
          {
            $set: gradeResult.pass
              ? {
                  stage: "L3",
                  "l2.status": "passed",
                  "l2.score": gradeResult.mcqScore,
                  "l2.updatedAt": new Date(),
                  "l3.enabled": true,
                  "l3.status": "pending",
                  "l3.updatedAt": new Date(),
                }
              : {
                  stage: "L2",
                  "l2.status": "rejected",
                  "l2.score": gradeResult.mcqScore,
                  "l2.updatedAt": new Date(),
                },
          },
          { upsert: true }
        );

        logEvent({
          internshipId: result.internshipId,
          studentId: result.studentId,
          partnerId: result.partnerId,
          type: "L2_AUTO_SUBMITTED",
          actorKind: "system",
          actorId: null,
          payload: {
            assessmentId: String(result._id),
            reason: "time_expired",
            mcqScore: gradeResult.mcqScore,
            suspicious: gradeResult.timingAnalysis?.suspicious || false,
          },
        });

        return res.status(410).json({
          message: "Time limit exceeded. Assessment auto-submitted.",
          evaluation: result.evaluation,
        });
      }
    }

    assessment.submission = assessment.submission || {};
    assessment.submission.mcqAnswers = Array.isArray(mcqAnswers) ? mcqAnswers : [];

    if (assessment.configSnapshot.allowText)
      assessment.submission.textAnswer = textAnswer || null;

    if (assessment.configSnapshot.allowFileUpload && Array.isArray(files))
      assessment.submission.files = files;

    if (Array.isArray(timingPattern)) {
      assessment.submission.timingPattern = timingPattern;
    }

    assessment.timing.submittedAt = new Date();
    assessment.status = "submitted";
    assessment.markModified('submission'); // Ensure Mongoose tracks the update
    await assessment.save();

    await CandidatePipeline.findOneAndUpdate(
      { internshipId: assessment.internshipId, studentId: assessment.studentId },
      { $set: { stage: "L2", "l2.status": "submitted", "l2.updatedAt": new Date() } },
      { upsert: true }
    );

    logEvent({
      internshipId: assessment.internshipId,
      studentId: assessment.studentId,
      partnerId: assessment.partnerId,
      type: "L2_SUBMITTED",
      actorKind: "student",
      actorId: assessment.studentId,
      payload: {
        assessmentId: String(assessment._id),
        answerCount: mcqAnswers?.length || 0,
      },
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error("❌ submitAssessment error:", err);
    return res.status(500).json({ message: "Failed to submit assessment" });
  }
}

/**
 * POST /api/l2-assessments/:id/evaluate
 */
async function evaluateAssessment(req, res) {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id))
      return res.status(400).json({ message: "Invalid assessment id" });

    const assessment = await Assessment.findById(id);
    if (!assessment) return res.status(404).json({ message: "Assessment not found" });

    if (!["submitted", "evaluated", "passed", "rejected"].includes(assessment.status)) {
      return res.status(409).json({ message: "Assessment not submitted yet" });
    }

    if (["evaluated", "passed", "rejected"].includes(assessment.status)) {
      return res.json({ ok: true, evaluation: assessment.evaluation });
    }

    const gradeResult = gradeMcq({
      questions: assessment.questions || [],
      answers: assessment.submission?.mcqAnswers || [],
      passScore: assessment.configSnapshot.passScore || 70,
      timingPattern: assessment.submission?.timingPattern,
    });

    const feedback = generateFeedback({
      mcqScore: gradeResult.mcqScore,
      correctCount: gradeResult.correctCount,
      total: gradeResult.total,
      domainStats: gradeResult.domainStats,
      pass: gradeResult.pass,
      passScore: assessment.configSnapshot.passScore || 70,
    });

    assessment.evaluation = {
      mcqScore: gradeResult.mcqScore,
      finalScore: gradeResult.mcqScore,
      pass: gradeResult.pass,
      feedback,
      evaluatedAt: new Date(),
      detailed: gradeResult.detailed,
      domainStats: gradeResult.domainStats,
      timingAnalysis: gradeResult.timingAnalysis,
    };

    // Set assessment status to passed or rejected instead of just evaluated
    assessment.status = gradeResult.pass ? "passed" : "rejected";
    await assessment.save();

    await CandidatePipeline.findOneAndUpdate(
      { internshipId: assessment.internshipId, studentId: assessment.studentId },
      {
        $set: gradeResult.pass
          ? {
              stage: "L3",
              "l2.status": "passed",
              "l2.score": gradeResult.mcqScore,
              "l2.updatedAt": new Date(),
              "l3.enabled": true,
              "l3.status": "pending",
              "l3.updatedAt": new Date(),
            }
          : {
              stage: "L2",
              "l2.status": "rejected",
              "l2.score": gradeResult.mcqScore,
              "l2.updatedAt": new Date(),
            },
      },
      { upsert: true }
    );

    logEvent({
      internshipId: assessment.internshipId,
      studentId: assessment.studentId,
      partnerId: assessment.partnerId,
      type: "L2_EVALUATED",
      actorKind: "system",
      actorId: null,
      payload: {
        assessmentId: String(assessment._id),
        mcqScore: gradeResult.mcqScore,
        pass: gradeResult.pass,
        suspicious: gradeResult.timingAnalysis?.suspicious || false,
      },
    });

    return res.json({ ok: true, evaluation: assessment.evaluation });
  } catch (err) {
    console.error("❌ evaluateAssessment error:", err);
    return res.status(500).json({ message: "Failed to evaluate assessment" });
  }
}

/**
 * GET /api/l2-assessments/:id
 */
async function getAssessmentForStudent(req, res) {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid assessment id" });
    }

    const assessment = await Assessment.findById(id).lean();
    if (!assessment) {
      return res.status(404).json({ message: "Assessment not found" });
    }

    if (assessment.status === "generated" || assessment.status === "sent") {
      return res.json({
        assessmentId: assessment._id,
        internshipId: assessment.internshipId,
        timeLimitMinutes: assessment.timing.timeLimitMinutes,
        status: assessment.status,
        configSnapshot: assessment.configSnapshot,
        questions: [],
      });
    }

    if (assessment.status === "started") {
      const safeQuestions = assessment.questions.map((q) => ({
        questionId: q.questionId,
        question: q.question,
        options: q.options,
      }));

      console.log(`Assessment ${assessment._id} has ${assessment.questions.length} questions, returning ${safeQuestions.length} safe questions`);

      return res.json({
        assessmentId: assessment._id,
        internshipId: assessment.internshipId,
        timeLimitMinutes: assessment.timing.timeLimitMinutes,
        status: assessment.status,
        configSnapshot: assessment.configSnapshot,
        startedAt: assessment.timing.startedAt,
        questions: safeQuestions,
      });
    }

    if (assessment.status === "submitted") {
      return res.json({
        assessmentId: assessment._id,
        internshipId: assessment.internshipId,
        status: assessment.status,
        configSnapshot: assessment.configSnapshot,
        submittedAt: assessment.timing.submittedAt,
        questions: [],
      });
    }

    if (["evaluated", "passed", "rejected"].includes(assessment.status)) {
      return res.json({
        assessmentId: assessment._id,
        internshipId: assessment.internshipId,
        status: assessment.status,
        configSnapshot: assessment.configSnapshot,
        evaluation: {
          mcqScore: assessment.evaluation.mcqScore,
          pass: assessment.evaluation.pass,
          feedback: assessment.evaluation.feedback,
        },
        questions: [],
      });
    }

    return res.json({
      assessmentId: assessment._id,
      status: assessment.status,
      configSnapshot: assessment.configSnapshot,
      questions: [],
    });

  } catch (err) {
    console.error("❌ getAssessmentForStudent error:", err);
    return res.status(500).json({ message: "Failed to fetch assessment" });
  }
}

function buildAssessmentReviewPayload(assessment) {
  const answersByQuestion = new Map(
    (assessment.submission?.mcqAnswers || []).map((answer) => [answer.questionId, answer])
  );
  const detailsByQuestion = new Map(
    (assessment.evaluation?.detailed || []).map((detail) => [detail.questionId, detail])
  );
  const timingByQuestion = new Map(
    (assessment.submission?.timingPattern || []).map((timing) => [timing.questionId, timing])
  );

  const questions = (assessment.questions || []).map((question, index) => {
    const answer = answersByQuestion.get(question.questionId);
    const detail = detailsByQuestion.get(question.questionId);
    const timing = timingByQuestion.get(question.questionId);
    const correctIndex = (question.options || []).findIndex(
      (_, optionIndex) => sha256WithSalt(optionIndex) === question.correctIndexHash
    );
    const selectedIndex =
      typeof answer?.selectedIndex === "number"
        ? answer.selectedIndex
        : typeof detail?.selectedIndex === "number"
          ? detail.selectedIndex
          : null;

    return {
      number: index + 1,
      questionId: question.questionId,
      question: question.question,
      options: question.options || [],
      selectedIndex,
      selectedAnswer:
        answer?.voiceAnswer
          ? answer.voiceAnswer
          : (selectedIndex !== null && question.options?.[selectedIndex]
            ? question.options[selectedIndex]
            : null),
      correctIndex,
      correctAnswer:
        correctIndex >= 0 && question.options?.[correctIndex]
          ? question.options[correctIndex]
          : null,
      isCorrect:
        typeof detail?.isCorrect === "boolean"
          ? detail.isCorrect
          : selectedIndex !== null && correctIndex >= 0
            ? selectedIndex === correctIndex
            : false,
      explanation: question.explanation || null,
      domain: detail?.domain || question.metadata?.domain || "general",
      difficulty: detail?.difficulty || question.metadata?.difficulty || null,
      timeSpentSeconds: timing?.timeSpentSeconds || null,
    };
  });

  return {
    assessmentId: assessment._id,
    internshipId: assessment.internshipId,
    status: assessment.status,
    student: assessment.studentId || null,
    submittedAt: assessment.timing?.submittedAt || null,
    evaluatedAt: assessment.evaluation?.evaluatedAt || null,
    score: assessment.evaluation?.mcqScore ?? null,
    pass: assessment.evaluation?.pass ?? null,
    feedback: assessment.evaluation?.feedback || null,
    textAnswer: assessment.submission?.textAnswer || null,
    files: assessment.submission?.files || [],
    questions,
  };
}

/**
 * GET /api/l2-assessments/:id/review
 * Partner review payload for the evaluated answer paper.
 */
async function getAssessmentReview(req, res) {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid assessment id" });
    }

    const assessment = await Assessment.findById(id)
      .populate("studentId", "name email")
      .lean();

    if (!assessment) {
      return res.status(404).json({ message: "Assessment not found" });
    }

    if (!["submitted", "evaluated", "passed", "rejected"].includes(assessment.status)) {
      return res.status(409).json({ message: "Assessment is not submitted yet" });
    }

    return res.json(buildAssessmentReviewPayload(assessment));
  } catch (err) {
    console.error("getAssessmentReview error:", err);
    return res.status(500).json({ message: "Failed to fetch assessment review" });
  }
}

/**
 * GET /api/l2-assessments/review/by-candidate?internshipId=...&studentId=...
 */
async function getAssessmentReviewByCandidate(req, res) {
  try {
    const { internshipId, studentId } = req.query;

    if (!isValidObjectId(internshipId) || !isValidObjectId(studentId)) {
      return res.status(400).json({ message: "Invalid internship or student id" });
    }

    const assessment = await Assessment.findOne({ internshipId, studentId })
      .sort({ updatedAt: -1 })
      .populate("studentId", "name email")
      .lean();

    if (!assessment) {
      return res.status(404).json({ message: "Assessment not found" });
    }

    if (!["submitted", "evaluated", "passed", "rejected"].includes(assessment.status)) {
      return res.status(409).json({ message: "Assessment is not submitted yet" });
    }

    return res.json(buildAssessmentReviewPayload(assessment));
  } catch (err) {
    console.error("getAssessmentReviewByCandidate error:", err);
    return res.status(500).json({ message: "Failed to fetch assessment review" });
  }
}

/**
 * GET /api/l2-assessments/:id/proctoring-status
 */
async function getProctoringStatus(req, res) {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid assessment id" });
    }

    const assessment = await Assessment.findById(id).lean();
    if (!assessment) return res.status(404).json({ message: "Assessment not found" });

    const proctoringVerified = !!(assessment.antiCheat && assessment.antiCheat.proctoringVerified);
    const proctoringVerifiedAt = assessment.antiCheat ? assessment.antiCheat.proctoringVerifiedAt : null;

    return res.json({ proctoringVerified, proctoringVerifiedAt });
  } catch (err) {
    console.error("❌ getProctoringStatus error:", err);
    return res.status(500).json({ message: "Failed to fetch proctoring status" });
  }
}

/**
 * POST /api/l2-assessments/:id/track-activity
 */
async function trackSuspiciousActivity(req, res) {
  try {
    const { id } = req.params;
    const { activityType, details } = req.body;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid assessment id" });
    }

    const result = await Assessment.findOneAndUpdate(
      { _id: id, status: "started" },
      {
        $inc: activityType === "tab_switch" ? { "antiCheat.tabSwitches": 1 } : {},
        $push: {
          "antiCheat.suspiciousActivity": {
            type: activityType,
            timestamp: new Date(),
            details: details || null,
          },
        },
      },
      { new: true }
    );

    if (!result) {
      return res.status(404).json({ message: "Assessment not found or not started" });
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error("❌ trackSuspiciousActivity error:", err);
    return res.status(500).json({ message: "Failed to track activity" });
  }
}

module.exports = {
  generateAssessment,
  sendAssessment,
  getAssessmentsByInternship,
  getAssessmentsByStudent,
  startAssessment,
  submitAssessment,
  getAssessmentForStudent,
  getAssessmentReview,
  getAssessmentReviewByCandidate,
  getProctoringStatus,
  evaluateAssessment,
  trackSuspiciousActivity,
};
