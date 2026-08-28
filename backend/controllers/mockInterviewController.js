const MockInterview = require("../models/webapp-models/MockInterviewModel");
const StudentMockInterview = require("../models/webapp-models/StudentMockInterviewModel");
const Internship = require("../models/webapp-models/internshipPostModel");
const InternshipSchedule = require("../models/webapp-models/InternshipScheduleModel");
const MockInterviewSubmission = require("../models/webapp-models/MockInterviewSubmissionModel");
const OfferLetter = require("../models/webapp-models/offerLetterModel");
const Partnerwebapp = require("../models/webapp-models/partnerModel");
const CandidatePipeline = require("../models/pipeline/CandidatePipeline");
const { transporter } = require("../utils/mailer");
const Anthropic = require("@anthropic-ai/sdk");

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

const sendMockInterviewEmail = async (mockInterview, internshipId, partnerId, isUpdate = false) => {
  try {
    const internship = await Internship.findById(internshipId);
    const partner = await Partnerwebapp.findById(partnerId);
    
    if (!internship || !partner) return;

    // Get all accepted students
    const offerLetters = await OfferLetter.find({ internshipId, status: "Accepted" });
    const acceptedEmails = offerLetters.map(offer => offer.email).filter(Boolean);

    // Get all shortlisted candidates
    const shortlisted = await CandidatePipeline.find({ internshipId, "l1.status": "shortlisted" }).populate("studentId");
    const shortlistedEmails = shortlisted.map(cand => cand.studentId?.email).filter(Boolean);

    const studentEmails = [...new Set([...acceptedEmails, ...shortlistedEmails])];

    // format date/time
    const dateStr = mockInterview.date ? new Date(mockInterview.date).toLocaleDateString() : 'N/A';
    const timeStr = `${mockInterview.startTime || 'N/A'} - ${mockInterview.endTime || 'N/A'}`;
    const meetingLink = mockInterview.meetingLink || "Please login to your SkillNaav portal to access the mock interview.";

    const subject = isUpdate 
      ? `Update: Mock Interview Rescheduled for ${internship.jobTitle}`
      : `New Mock Interview Scheduled for ${internship.jobTitle}`;

    const htmlContent = `
      <h3>Mock Interview Details</h3>
      <p><strong>Internship:</strong> ${internship.jobTitle}</p>
      <p><strong>Date:</strong> ${dateStr}</p>
      <p><strong>Time:</strong> ${timeStr}</p>
      <p><strong>Details/Link:</strong> ${meetingLink.startsWith('http') ? '<a href="' + meetingLink + '">' + meetingLink + '</a>' : meetingLink}</p>
      <p>Please make sure to attend on time.</p>
    `;

    // Email to Partner
    if (partner.email) {
      await transporter.sendMail({
        to: partner.email,
        subject: subject + " (Partner Copy)",
        html: htmlContent
      });
    }

    // Email to all students
    for (const email of studentEmails) {
      await transporter.sendMail({
        to: email,
        subject,
        html: htmlContent
      });
    }

  } catch (error) {
    console.error("Failed to send mock interview email:", error);
  }
};

// Partner APIs
exports.createMockInterviews = async (req, res) => {
  try {
    const { internshipId, scheduleId, partnerId, mockInterviews } = req.body;
    
    if (!internshipId || !partnerId || !mockInterviews || !Array.isArray(mockInterviews)) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Find existing mock interviews for this internship
    const existing = await MockInterview.find({ internshipId });
    const incomingIds = mockInterviews.filter(mi => mi._id).map(mi => String(mi._id));
    
    // Delete ones that were removed
    for (const ext of existing) {
      if (!incomingIds.includes(String(ext._id))) {
        await MockInterview.findByIdAndDelete(ext._id);
        await StudentMockInterview.deleteMany({ mockInterviewId: ext._id });
      }
    }

    const saved = [];
    for (const mi of mockInterviews) {
      if (mi._id) {
        const updated = await MockInterview.findByIdAndUpdate(mi._id, mi, { new: true });
        saved.push(updated);
      } else {
        const newMi = new MockInterview({
          ...mi,
          internshipId,
          scheduleId,
          partnerId,
          createdBy: partnerId
        });
        await newMi.save();
        saved.push(newMi);
        sendMockInterviewEmail(newMi, internshipId, partnerId, false);
      }
    }
    res.status(200).json(saved);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getMockInterviewsByInternship = async (req, res) => {
  try {
    const { internshipId } = req.params;
    const mockInterviews = await MockInterview.find({ internshipId }).sort({ weekNumber: 1 });
    
    for (const mi of mockInterviews) {
      if (!mi.questions || mi.questions.length === 0) {
        mi.questions = await generateMockQuestions(mi, mockInterviews);
        await mi.save();
      }
    }
    
    res.status(200).json(mockInterviews);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteMockInterview = async (req, res) => {
  try {
    const { id } = req.params;
    await MockInterview.findByIdAndDelete(id);
    await StudentMockInterview.deleteMany({ mockInterviewId: id });
    res.status(200).json({ message: "Deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getStudentMockInterviews = async (req, res) => {
  try {
    const { internshipId, studentId } = req.query;
    
    if (!internshipId || !studentId) {
      return res.status(400).json({ error: "Missing internshipId or studentId" });
    }

    // Get all mock interviews for this internship
    const mockInterviews = await MockInterview.find({ internshipId }).sort({ weekNumber: 1 });
    
    for (const mi of mockInterviews) {
      if (!mi.questions || mi.questions.length === 0) {
        mi.questions = await generateMockQuestions(mi, mockInterviews);
        await mi.save();
      }
    }
    
    // Get student progress
    const studentInterviews = await StudentMockInterview.find({ internshipId, studentId }).lean();
    
    // Merge
    const result = mockInterviews.map(mi => {
      const plainMi = mi.toObject();
      const studentData = studentInterviews.find(si => String(si.mockInterviewId) === String(mi._id));
      return {
        ...plainMi,
        studentStatus: studentData ? studentData.status : "Upcoming",
        studentData: studentData || null
      };
    });
    
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.submitMockInterview = async (req, res) => {
  try {
    const { studentId, mockInterviewId, internshipId, partnerId, answers } = req.body;
    
    if (!studentId || !mockInterviewId) {
       return res.status(400).json({ error: "Missing required fields" });
    }

    // Compute final score
    let score = 0;
    if (Array.isArray(answers)) {
      answers.forEach(ans => {
        if (ans.status === "Correct") score += 1;
        else if (ans.status === "Partially Correct") score += 0.5;
      });
    }

    // Generate Strengths, Areas to Improve, and Encouragement using Claude
    let strengths = ["Good effort on all questions.", "Clear voice or written explanations."];
    let areasToImprove = ["Try to provide more technical detail.", "Practice definition clarity."];
    let finalEncouragement = "Keep learning and practicing!";

    if (process.env.ANTHROPIC_API_KEY && Array.isArray(answers) && answers.length > 0) {
      try {
        const prompt = `
You are summarizing a student's performance in a 5-question mock interview.
Here is the transcript of the interview (questions, student's answers, and evaluation status):
${answers.map((ans, i) => `${i + 1}. Q: ${ans.questionText}\nA: ${ans.answerText}\nStatus: ${ans.status}`).join("\n\n")}

Provide:
1. Strengths: Exactly 2 or 3 bullet points of what they did well.
2. Areas to Improve: Exactly 2 or 3 bullet points of what they can improve.
3. Final Encouragement: One short, motivational, friendly sentence to encourage them.

Return ONLY a valid JSON object in this format:
{
  "strengths": ["bullet 1", "bullet 2"],
  "areasToImprove": ["bullet 1", "bullet 2"],
  "finalEncouragement": "string"
}
        `;

        const message = await anthropic.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 400,
          temperature: 0.3,
          messages: [{ role: "user", content: prompt }],
        });

        const raw = message.content?.[0]?.text || "";
        const parsed = JSON.parse(raw.trim().replace(/^```json/, "").replace(/```$/, ""));
        if (parsed.strengths) strengths = parsed.strengths;
        if (parsed.areasToImprove) areasToImprove = parsed.areasToImprove;
        if (parsed.finalEncouragement) finalEncouragement = parsed.finalEncouragement;
      } catch (err) {
        console.error("AI final assessment generation failed:", err);
      }
    }
    
    let studentMi = await StudentMockInterview.findOne({ studentId, mockInterviewId });
    if (studentMi) {
      studentMi.status = "Completed";
      studentMi.completedAt = new Date();
      studentMi.score = score;
      studentMi.strengths = strengths;
      studentMi.areasToImprove = areasToImprove;
      studentMi.finalEncouragement = finalEncouragement;
      studentMi.answers = answers || [];
      await studentMi.save();
    } else {
      studentMi = new StudentMockInterview({
        studentId,
        mockInterviewId,
        internshipId,
        partnerId,
        status: "Completed",
        completedAt: new Date(),
        score,
        strengths,
        areasToImprove,
        finalEncouragement,
        answers: answers || []
      });
      await studentMi.save();
    }

    // Duplicate submission in MockInterviewSubmission collection for Partner view dashboard
    try {
      const mockInterview = await MockInterview.findById(mockInterviewId);
      const scheduleDateStr = mockInterview && mockInterview.date 
        ? new Date(mockInterview.date).toISOString().split('T')[0] 
        : new Date().toISOString().split('T')[0];

      const formattedAnswers = answers.map(ans => ({
        questionText: ans.questionText,
        answerText: ans.answerText || "",
        aiScore: ans.status === "Correct" ? 1 : ans.status === "Partially Correct" ? 0.5 : 0,
        aiFeedback: ans.aiFeedback || ""
      }));

      const partnerSubmission = new MockInterviewSubmission({
        studentId,
        internshipId,
        partnerId,
        scheduleDate: scheduleDateStr,
        answers: formattedAnswers,
        totalScore: score,
        status: 'completed',
        submittedAt: new Date()
      });
      await partnerSubmission.save();
    } catch (subErr) {
      console.error("Failed to duplicate mock interview submission for partner view:", subErr);
    }
    
    res.status(200).json({ message: "Submitted successfully", data: studentMi });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.evaluateAnswer = async (req, res) => {
  try {
    const { questionText, answerText } = req.body;
    if (!questionText) {
      return res.status(400).json({ error: "Missing questionText" });
    }
    
    // If the answer is completely empty
    if (!answerText || !answerText.trim()) {
      return res.status(200).json({
        status: "Incorrect",
        feedback: "No answer was provided."
      });
    }

    const prompt = `
You are an expert interviewer evaluating a student's answer in a mock interview.
Question: ${questionText}
Student's Answer: ${answerText}

Evaluate the answer. It must be classified as one of:
- Correct
- Partially Correct
- Incorrect

Provide a short feedback of less than 20 words. Be encouraging but honest.
Return ONLY a valid JSON object in this format:
{
  "status": "Correct" | "Partially Correct" | "Incorrect",
  "feedback": "string (< 20 words)"
}
    `;

    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(200).json({
        status: "Correct",
        feedback: "Good attempt! Voice feedback will be available soon."
      });
    }

    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      temperature: 0.3,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = message.content?.[0]?.text || "";
    let parsed;
    try {
      parsed = JSON.parse(raw.trim().replace(/^```json/, "").replace(/```$/, ""));
    } catch (e) {
      const statusMatch = raw.match(/"status"\s*:\s*"([^"]+)"/);
      const feedbackMatch = raw.match(/"feedback"\s*:\s*"([^"]+)"/);
      if (statusMatch && feedbackMatch) {
        parsed = {
          status: statusMatch[1],
          feedback: feedbackMatch[1]
        };
      } else {
        throw new Error("Could not parse JSON from AI output.");
      }
    }

    res.status(200).json(parsed);
  } catch (error) {
    console.error("evaluateAnswer error:", error);
    res.status(500).json({ error: error.message });
  }
};

const generateMockQuestions = async (mockInterview, allMockInterviews) => {
  try {
    const internship = await Internship.findById(mockInterview.internshipId).lean();
    
    // Find the index of current mock interview in all mock interviews sorted by weekNumber
    const sorted = [...allMockInterviews].sort((a, b) => (a.weekNumber || 0) - (b.weekNumber || 0));
    const index = sorted.findIndex(mi => String(mi._id) === String(mockInterview._id));
    const mockInterviewNumber = index + 1;

    if (!internship) return getDefaultQuestions(mockInterview.interviewType, mockInterviewNumber);

    let prompt = "";
    if (mockInterviewNumber === 1) {
      // Mock Interview 1
      prompt = `
You generate exactly 5 mock interview questions for an internship.
Internship Title: ${internship.jobTitle || "Not provided"}
Sector: ${internship.sector || "Not provided"}

Purpose:
Collect internship feedback and ensure the student has started learning. Do NOT ask technical questions. Ask only simple feedback questions. Keep questions friendly, conversational, and beginner-friendly.

Rules:
1. You MUST generate exactly 5 questions.
2. The questions should be very similar to or adapt these template questions:
   - Can you briefly introduce yourself?
   - How has the internship been so far?
   - Are the classes easy to understand?
   - Are you able to complete the daily tasks?
   - Is there anything we can improve to help your learning?
3. Maximum 15 words per question.
4. One sentence only.
5. No explanations, no examples, no markdown.
6. Return ONLY a valid JSON array of strings.

Example Output:
[
  "Can you briefly introduce yourself?",
  "How has the internship been so far?",
  "Are the classes easy to understand?",
  "Are you able to complete the daily tasks?",
  "Is there anything we can improve to help your learning?"
]
      `;
    } else if (mockInterviewNumber === 2) {
      // Mock Interview 2
      const schedule = await InternshipSchedule.findOne({ internshipId: mockInterview.internshipId }).lean();
      let completedTopics = [];

      if (schedule) {
        let timetableEntries = [];
        if (schedule.timetable && Array.isArray(schedule.timetable)) {
          timetableEntries = timetableEntries.concat(schedule.timetable);
        }
        if (schedule.batches && Array.isArray(schedule.batches)) {
          schedule.batches.forEach(b => {
            if (b.timetable && Array.isArray(b.timetable)) {
              timetableEntries = timetableEntries.concat(b.timetable);
            }
          });
        }

        const targetDate = new Date(mockInterview.date);
        const completedSessions = timetableEntries.filter(session => {
          if (!session.date) return false;
          return new Date(session.date) <= targetDate;
        });

        completedTopics = completedSessions
          .map(s => s.sectionSummary)
          .filter(Boolean)
          .map(t => t.trim());
        
        completedTopics = [...new Set(completedTopics)];
      }

      prompt = `
You generate exactly 5 mock interview questions for an internship.
Internship Title: ${internship.jobTitle || "Not provided"}
Sector: ${internship.sector || "Not provided"}

Purpose:
Check understanding of completed classes.

Completed Topics List:
${completedTopics.length > 0 ? completedTopics.map((topic, idx) => `- ${topic}`).join("\n") : "- General beginner concepts in " + (internship.sector || "this field")}

Rules:
1. You MUST generate exactly 5 simple, basic questions.
2. Ask very basic questions. One question per completed topic. If completed topics list is short, fill the remaining with basic questions in ${internship.sector || "general sector skills"}.
3. No difficult questions, no coding challenges, no long explanations.
4. Maximum 15 words per question.
5. One sentence only.
6. No explanations, no examples, no markdown.
7. Return ONLY a valid JSON array of strings.

Example Output:
[
  "What is HTML used for?",
  "What is CSS?",
  "What is a variable in JavaScript?",
  "Which HTML tag creates a heading?",
  "Why do we use CSS?"
]
      `;
    } else if (mockInterviewNumber === 3) {
      // Mock Interview 3
      const schedule = await InternshipSchedule.findOne({ internshipId: mockInterview.internshipId }).lean();
      let completedTopics = [];

      if (schedule) {
        let timetableEntries = [];
        if (schedule.timetable && Array.isArray(schedule.timetable)) {
          timetableEntries = timetableEntries.concat(schedule.timetable);
        }
        if (schedule.batches && Array.isArray(schedule.batches)) {
          schedule.batches.forEach(b => {
            if (b.timetable && Array.isArray(b.timetable)) {
              timetableEntries = timetableEntries.concat(b.timetable);
            }
          });
        }

        const targetDate = new Date(mockInterview.date);
        const completedSessions = timetableEntries.filter(session => {
          if (!session.date) return false;
          return new Date(session.date) <= targetDate;
        });

        completedTopics = completedSessions
          .map(s => s.sectionSummary)
          .filter(Boolean)
          .map(t => t.trim());
        
        completedTopics = [...new Set(completedTopics)];
      }

      prompt = `
You generate exactly 5 mock interview questions for an internship.
Internship Title: ${internship.jobTitle || "Not provided"}
Sector: ${internship.sector || "Not provided"}

Purpose:
Test basic understanding of completed modules/topics.

Completed Topics List:
${completedTopics.length > 0 ? completedTopics.map((topic, idx) => `- ${topic}`).join("\n") : "- General beginner concepts in " + (internship.sector || "this field")}

Rules:
1. You MUST generate exactly 5 short questions testing basic definitions, purpose, or a simple scenario.
2. Difficulty must be EASY.
3. Maximum 15 words per question.
4. One sentence only.
5. No explanations, no examples, no markdown.
6. Return ONLY a valid JSON array of strings.

Example Output:
[
  "What is a function?",
  "Why do we use arrays?",
  "What is a database?",
  "What is React?",
  "What is an API?"
]
      `;
    } else {
      // Mock Interview 4 (and beyond)
      prompt = `
You generate exactly 5 mock interview questions for an internship.
Internship Title: ${internship.jobTitle || "Not provided"}
Sector: ${internship.sector || "Not provided"}

Purpose:
Prepare student for a real interview.

Rules:
1. You MUST generate exactly 5 interview-style questions.
2. The questions should focus on general interview preparation (tell me about yourself, explain your favorite project, what you learned, challenges faced, why hire you).
3. Maximum 15 words per question.
4. One sentence only.
5. No explanations, no examples, no markdown.
6. Return ONLY a valid JSON array of strings.

Example Output:
[
  "Tell me about yourself.",
  "Explain your favorite project.",
  "What did you learn during this internship?",
  "What challenges did you face?",
  "Why should we hire you?"
]
      `;
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      console.error("Missing ANTHROPIC_API_KEY in environment");
      return getDefaultQuestions(mockInterview.interviewType, mockInterviewNumber);
    }

    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 800,
      temperature: 0.3,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = message.content?.[0]?.text || "";
    let parsed;
    try {
      parsed = JSON.parse(raw.trim().replace(/^```json/, "").replace(/```$/, ""));
    } catch (e) {
      const match = raw.match(/\[([\s\S]*?)\]/);
      if (match) parsed = JSON.parse(match[0]);
      else throw new Error("Could not parse JSON array from AI output.");
    }

    if (Array.isArray(parsed) && parsed.length === 5) {
      return parsed;
    }
    return getDefaultQuestions(mockInterview.interviewType, mockInterviewNumber);

  } catch (err) {
    console.error("Failed to generate mock questions via AI:", err);
    return getDefaultQuestions(mockInterview.interviewType, index + 1);
  }
};

const getDefaultQuestions = (interviewType, number = 1) => {
  if (number === 1) {
    return [
      "Can you briefly introduce yourself?",
      "How has the internship been so far?",
      "Are the classes easy to understand?",
      "Are you able to complete the daily tasks?",
      "Is there anything we can improve to help your learning?"
    ];
  }
  if (number === 4) {
    return [
      "Tell me about yourself.",
      "Explain your favorite project.",
      "What did you learn during this internship?",
      "What challenges did you face?",
      "Why should we hire you?"
    ];
  }
  if (interviewType === "HR") {
    return [
      "Why do you want to work with us?",
      "What are your key strengths and weaknesses?",
      "Can you describe a situation where you had to work in a team?",
      "Where do you see yourself in the next three years?",
      "How do you handle deadline pressure?"
    ];
  }
  return [
    "What are the main responsibilities in this role?",
    "Which tools are you most comfortable with?",
    "Can you explain a recent project you worked on?",
    "How do you keep your skills up to date?",
    "What is your understanding of our sector?"
  ];
};

exports.updateMockInterview = async (req, res) => {
  try {
    const { id } = req.params;
    const { date, startTime, endTime } = req.body;
    if (!date) {
      return res.status(400).json({ error: "Date is required" });
    }
    const updated = await MockInterview.findByIdAndUpdate(
      id,
      { date, startTime, endTime },
      { new: true }
    );
    if (!updated) {
      return res.status(404).json({ error: "Mock interview not found" });
    }
    
    // Send email on reschedule
    sendMockInterviewEmail(updated, updated.internshipId, updated.partnerId, true);
    
    return res.status(200).json({ success: true, mockInterview: updated });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteMockInterview = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await MockInterview.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ error: "Mock interview not found" });
    }
    await StudentMockInterview.deleteMany({ mockInterviewId: id });
    return res.status(200).json({ success: true, message: "Mock interview deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

