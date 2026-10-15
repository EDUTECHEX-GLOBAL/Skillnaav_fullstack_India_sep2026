const Anthropic = require("@anthropic-ai/sdk");
const InternshipAssessment = require("../models/webapp-models/InternshipAssessmentModel");
const InternshipPosting = require("../models/webapp-models/internshipPostModel");
const AssessmentSubmission = require("../models/webapp-models/AssessmentSubmissionModel");
const mongoose = require('mongoose');
function toObjectId(id) {
  return new mongoose.Types.ObjectId(id);
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Helper to generate domain-appropriate fallback questions based on internship details
function generateFallbackQuestions(internship) {
  const title = internship.jobTitle || "Internship";
  const skills = Array.isArray(internship.qualifications) && internship.qualifications.length > 0
    ? internship.qualifications
    : ["General Professional Skills", "Problem Solving", "Communication", "Technical Fundamentals"];
  
  const skill1 = skills[0] || "Core Fundamentals";
  const skill2 = skills[1] || skills[0] || "Practical Application";
  const skill3 = skills[2] || skills[0] || "Quality and Standards";
  const skill4 = skills[3] || skills[1] || "Workflow and Tools";
  const skill5 = skills[4] || skills[2] || "Best Practices";

  return [
    {
      questionText: `Which of the following best describes the primary objective or principle of ${skill1} in the context of ${title}?`,
      options: [
        `Implementing systematic approaches to optimize design, efficiency, and reliability`,
        `Relying solely on arbitrary assumptions without documentation`,
        `Ignoring industry standards and established safety protocols`,
        `Minimizing testing and skipping validation procedures`
      ],
      correctAnswer: 0,
      marks: 1,
      type: "mcq",
      fromAI: true
    },
    {
      questionText: `When working with ${skill2}, what is considered an industry-standard best practice?`,
      options: [
        `Skipping version control and working directly on production files`,
        `Maintaining structured documentation, modular design, and regular reviews`,
        `Avoiding peer feedback and team collaboration`,
        `Using deprecated or incompatible legacy specifications without testing`
      ],
      correctAnswer: 1,
      marks: 1,
      type: "mcq",
      fromAI: true
    },
    {
      questionText: `In a real-world scenario involving ${skill3}, how should unexpected errors or discrepancies typically be addressed?`,
      options: [
        `Suppressing all error logs to prevent notifications`,
        `Ignoring the discrepancy until a system failure occurs`,
        `Isolating the root cause through systematic debugging and verification`,
        `Manually overriding results without identifying the source problem`
      ],
      correctAnswer: 2,
      marks: 1,
      type: "mcq",
      fromAI: true
    },
    {
      questionText: `Which key benefit is achieved by effectively applying ${skill4} within a collaborative team project?`,
      options: [
        `Decreased accountability and unorganized deliverables`,
        `Significant delay in execution timelines`,
        `Higher dependency on repetitive manual intervention`,
        `Streamlined workflows, consistent outputs, and enhanced productivity`
      ],
      correctAnswer: 3,
      marks: 1,
      type: "mcq",
      fromAI: true
    },
    {
      questionText: `Before finalizing deliverables relating to ${skill5} for ${internship.companyName || "the organization"}, which final step is crucial?`,
      options: [
        `Conducting thorough quality checks, compliance audits, and performance verification`,
        `Deleting reference data and historical revisions`,
        `Publishing unverified drafts directly to stakeholders`,
        `Circumventing testing to meet immediate deadlines`
      ],
      correctAnswer: 0,
      marks: 1,
      type: "mcq",
      fromAI: true
    }
  ];
}

function parseAndSanitizeQuestions(modelText, internship) {
  if (!modelText || typeof modelText !== "string") {
    return generateFallbackQuestions(internship);
  }

  // 1. Strip markdown fences if present
  let cleanText = modelText.trim();
  cleanText = cleanText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

  // 2. Find JSON array boundaries
  const startIdx = cleanText.indexOf('[');
  const endIdx = cleanText.lastIndexOf(']');
  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
    console.warn("⚠️ No JSON array brackets found in AI text, using fallback");
    return generateFallbackQuestions(internship);
  }

  let rawList = [];
  try {
    rawList = JSON.parse(cleanText.substring(startIdx, endIdx + 1));
  } catch (parseErr) {
    console.warn("⚠️ JSON.parse failed on AI output:", parseErr.message);
    return generateFallbackQuestions(internship);
  }

  if (!Array.isArray(rawList) || rawList.length === 0) {
    return generateFallbackQuestions(internship);
  }

  const validQuestions = [];
  for (let i = 0; i < rawList.length; i++) {
    const q = rawList[i];
    if (!q || typeof q !== "object") continue;

    const questionText = (q.questionText || q.question || "").trim();
    if (!questionText || questionText.length < 5) continue;

    let options = Array.isArray(q.options)
      ? q.options.map(o => String(o ?? "").trim()).filter(Boolean)
      : [];
    if (options.length < 2) continue;

    // Pad to 4 options if fewer
    while (options.length < 4) {
      options.push(`Option ${options.length + 1}`);
    }
    // If more than 4, take first 4
    if (options.length > 4) {
      options = options.slice(0, 4);
    }

    // Normalize correctAnswer
    let correctAnswer = q.correctAnswer;
    if (Array.isArray(correctAnswer)) correctAnswer = correctAnswer[0];

    if (typeof correctAnswer === "string") {
      const trimmed = correctAnswer.trim().toLowerCase();
      const letterMap = { a: 0, b: 1, c: 2, d: 3 };
      if (letterMap[trimmed] !== undefined) {
        correctAnswer = letterMap[trimmed];
      } else if (/^[0-4]$/.test(trimmed)) {
        correctAnswer = parseInt(trimmed, 10);
      } else {
        const optIdx = options.findIndex(opt => opt.toLowerCase() === trimmed);
        correctAnswer = optIdx !== -1 ? optIdx : 0;
      }
    }

    // Convert 1-based index (1..4) to 0-based if necessary
    if (correctAnswer === 4) {
      correctAnswer = 3;
    }

    if (typeof correctAnswer !== "number" || isNaN(correctAnswer) || correctAnswer < 0 || correctAnswer > 3) {
      correctAnswer = 0;
    }

    validQuestions.push({
      questionText,
      options,
      correctAnswer,
      marks: typeof q.marks === "number" && q.marks > 0 ? q.marks : 1,
      type: "mcq",
      fromAI: true
    });

    if (validQuestions.length === 5) break;
  }

  // If AI gave fewer than 5 valid questions, top up from fallback
  if (validQuestions.length < 5) {
    const fallback = generateFallbackQuestions(internship);
    for (let f of fallback) {
      if (validQuestions.length >= 5) break;
      validQuestions.push(f);
    }
  }

  return validQuestions.slice(0, 5);
}

// Generate AI Assessment
exports.generateAIInternshipAssessment = async (req, res) => {
  try {
    const { internshipId, studentId } = req.body;
    if (!internshipId || !studentId) {
      return res.status(400).json({ message: "internshipId and studentId are required" });
    }

    if (!mongoose.Types.ObjectId.isValid(internshipId) || !mongoose.Types.ObjectId.isValid(studentId)) {
      return res.status(400).json({ message: "Invalid internshipId or studentId format" });
    }

    const internship = await InternshipPosting.findById(internshipId);
    if (!internship) return res.status(404).json({ message: "Internship not found" });

    const existing = await InternshipAssessment.findOne({ internshipId, studentId });
    if (existing) {
      return res.status(200).json({ message: "Assessment already exists", assessment: existing });
    }

    const questionPromptText = `You are an intelligent assessment generator for internship applicants.

Create exactly 5 multiple-choice questions (MCQs) to test readiness for the internship below.

Internship Title: ${internship.jobTitle}
Company: ${internship.companyName}
Required Skills: ${internship.qualifications?.join(", ") || "N/A"}
Internship Description: ${internship.jobDescription || "N/A"}

Return ONLY a valid JSON array — no explanation, no markdown, no extra text. Use this exact format:
[
  {
    "questionText": "string",
    "options": ["option1", "option2", "option3", "option4"],
    "correctAnswer": 0,
    "marks": 1,
    "type": "mcq"
  }
]
IMPORTANT: "correctAnswer" MUST be a 0-based integer index (0, 1, 2, or 3) indicating the correct option in the options array.`;

    let questions = [];

    if (process.env.ANTHROPIC_API_KEY) {
      try {
        const message = await anthropic.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 2000,
          temperature: 0.6,
          system: "You are a strict JSON generator. Return ONLY a valid JSON array of 5 questions with options and 0-based integer correctAnswer (0, 1, 2, or 3). No markdown, no explanation.",
          messages: [{ role: "user", content: questionPromptText }],
        });

        const modelText = message.content[0]?.text || "";
        console.log("🤖 Raw model output length:", modelText.length);
        questions = parseAndSanitizeQuestions(modelText, internship);
      } catch (aiErr) {
        console.warn("⚠️ Anthropic API call failed, using intelligent domain fallback:", aiErr.message);
        questions = generateFallbackQuestions(internship);
      }
    } else {
      console.warn("⚠️ ANTHROPIC_API_KEY missing, using fallback questions");
      questions = generateFallbackQuestions(internship);
    }

    const totalMarks = questions.reduce((sum, q) => sum + (q.marks || 1), 0);

    const assessment = await InternshipAssessment.create({
      internshipId,
      studentId,
      questions,
      totalMarks,
      aiPromptUsed: questionPromptText,
    });

    res.status(201).json({ message: "AI Assessment generated successfully", assessment });

  } catch (error) {
    console.error("❌ Error generating AI assessment:", error);
    res.status(500).json({ message: "Failed to generate assessment", error: error.message });
  }
};

// Get Assessment for Student
exports.getStudentAssessment = async (req, res) => {
  try {
    const { studentId, internshipId } = req.params;
    if (!studentId || !internshipId) return res.status(400).json({ message: "studentId and internshipId are required" });

    const assessment = await InternshipAssessment.findOne({ studentId, internshipId });
    if (!assessment) return res.status(404).json({ message: "Assessment not found" });

    res.status(200).json({ assessment });
  } catch (error) {
    console.error("❌ Error fetching assessment:", error);
    res.status(500).json({ message: "Failed to fetch assessment", error: error.message });
  }
};

// Submit Assessment
exports.submitAssessment = async (req, res) => {
  try {
    const {
      studentId,
      assessmentId,
      responses,
      timeTaken,
      violations = [],
      violationCount = 0,
      proctoringData = {},
      isAutoSubmit = false
    } = req.body;

    if (!studentId || !assessmentId || !responses) {
      return res.status(400).json({
        message: "studentId, assessmentId, and responses are required"
      });
    }

    const existingSubmission = await AssessmentSubmission.findOne({ studentId, assessmentId });
    if (existingSubmission) {
      return res.status(400).json({
        message: "Assessment already submitted",
        submission: existingSubmission
      });
    }

    let score = 0;
    let totalMarks = 0;

    const processedResponses = responses.map(r => {
      const isCorrect = r.studentAnswer === r.correctAnswer;
      const marks = r.marks || 1;
      if (isCorrect) score += marks;
      totalMarks += marks;
      return { ...r, isCorrect, marks };
    });

    const percentage = totalMarks > 0 ? (score / totalMarks) * 100 : 0;

    let fitStatus = "not fit";
    if (percentage >= 60 && violationCount < 5) {
      fitStatus = "fit";
    }

    const processedViolations = violations.map(v => ({
      ...v,
      severity: v.type === 'TAB_SWITCH' || v.type === 'FULLSCREEN_EXIT'
        ? 'high'
        : v.type === 'KEYBOARD_ATTEMPT'
          ? 'medium'
          : 'low'
    }));

    const finalProctoringData = {
      mode: proctoringData.mode || 'real',
      cameraEnabled: proctoringData.cameraEnabled || false,
      microphoneEnabled: proctoringData.microphoneEnabled || false,
      fullscreenEnabled: proctoringData.fullscreenEnabled || false,
      sessionDuration: timeTaken,
      startedAt: proctoringData.startedAt || new Date(Date.now() - (timeTaken * 1000)),
      completedAt: new Date(),
      wasAutoSubmitted: isAutoSubmit,
      autoSubmitReason: isAutoSubmit
        ? `Exceeded violation limit (${violationCount} violations)`
        : null
    };

    const submission = await AssessmentSubmission.create({
      studentId,
      assessmentId,
      responses: processedResponses,
      score,
      totalMarks,
      percentage,
      timeTaken,
      fitStatus,
      violations: processedViolations,
      violationCount,
      proctoringData: finalProctoringData,
      submittedAt: new Date()
    });

    await submission.populate('studentId', 'name email');
    await submission.populate('assessmentId', 'internshipId');

    res.status(201).json({
      message: "Assessment submitted successfully",
      submission,
      warnings: violationCount > 0 ? {
        violationCount,
        message: violationCount >= 3
          ? "⚠️ High violation count detected. This may affect your assessment."
          : "Minor violations detected."
      } : null
    });

  } catch (error) {
    console.error("❌ Error submitting assessment:", error);
    res.status(500).json({ message: "Failed to submit assessment", error: error.message });
  }
};

// Get submission with violation details
exports.getSubmissionWithViolations = async (req, res) => {
  try {
    const { studentId, assessmentId } = req.params;

    const submission = await AssessmentSubmission.findOne({ studentId, assessmentId })
      .populate('studentId', 'name email')
      .populate('assessmentId', 'internshipId');

    if (!submission) {
      return res.status(404).json({ message: "No submission found", submission: null });
    }

    const violationSummary = {
      total: submission.violationCount,
      byType: submission.violations.reduce((acc, v) => {
        acc[v.type] = (acc[v.type] || 0) + 1;
        return acc;
      }, {}),
      highSeverity: submission.violations.filter(v => v.severity === 'high').length,
      mediumSeverity: submission.violations.filter(v => v.severity === 'medium').length,
      lowSeverity: submission.violations.filter(v => v.severity === 'low').length
    };

    res.status(200).json({ submission, violationSummary });

  } catch (error) {
    console.error("❌ Error fetching submission:", error);
    res.status(500).json({ message: "Failed to fetch submission", error: error.message });
  }
};

// Get assessment submission for a student
exports.getAssessmentSubmission = async (req, res) => {
  try {
    const { studentId, assessmentId } = req.params;
    if (!studentId || !assessmentId) {
      return res.status(400).json({ message: "studentId and assessmentId are required" });
    }

    const submission = await AssessmentSubmission.findOne({
      studentId: toObjectId(studentId),
      assessmentId: toObjectId(assessmentId),
    });

    if (!submission) return res.status(404).json({ message: "Submission not found" });

    res.status(200).json({ submission });
  } catch (error) {
    console.error("❌ Error fetching submission:", error);
    res.status(500).json({ message: "Failed to fetch submission", error: error.message });
  }
};