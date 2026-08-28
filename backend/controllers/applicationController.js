//File: applicationController.js

const mongoose = require("mongoose");
const axios = require("axios");
const Application = require("../models/webapp-models/applicationModel"); // Import the Application model
const Userwebapp = require("../models/webapp-models/userModel");  // Ensure correct import path
const InternshipPosting = require("../models/webapp-models/internshipPostModel.js");
const sendNotification = require("../utils/Notification.js");
const { getPersonalizedRecommendations } = require("../services/AiServices.js");
const notifyUser = require("../utils/notifyUser.js");
const multer = require("multer"); // Multer for file uploads
const CandidatePipeline = require("../models/pipeline/CandidatePipeline");
const Resume = require("../models/webapp-models/resumeModel");
const path = require("path");
const fs = require("fs");
const Assessment = require("../models/pipeline/Assessment");

const upgradeToPremium = async (req, res) => {
  const { studentId } = req.body;

  try {
    const student = await Userwebapp.findByIdAndUpdate(studentId, { isPremium: true }, { new: true });

    if (!student) {
      return res.status(404).json({ message: "User not found." });
    }

    res.status(200).json({ message: "User upgraded to premium!", user: student });
  } catch (error) {
    console.error("Error upgrading user:", error.message);
    res.status(500).json({ message: "Error upgrading to premium.", error: error.message });
  }
};

// Controller to handle applying for an internship (using multer for file uploads)
const applyForInternship = async (req, res) => {
  const { studentId, internshipId } = req.body;
  const resumeFile = req.file;

  const resumeUrlFromBody = req.body.resumeUrl;
  const resumeUrl = resumeFile?.location || resumeUrlFromBody;

  if (!resumeUrl) {
    return res.status(400).json({ message: "Please provide a resume." });
  }

  try {
    const student = await Userwebapp.findById(studentId);
    const internship = await InternshipPosting.findById(internshipId);

    if (!student || !internship) {
      return res.status(404).json({ message: "Student or Internship not found." });
    }

    if (!internship.applicationOpen) {
      return res.status(403).json({
        message: "Applications are currently closed for this internship.",
      });
    }

    // Plan-aware application limit check
    const PLAN_APP_LIMITS = {
      "Free": 5,
      "Freemium": 5,
      "Premium Basic": 25,
      "Premium Plus": Infinity,
    };
    const studentPlanType = student.planType || "Free";
    const appLimit = PLAN_APP_LIMITS[studentPlanType] ?? 5;

    if (appLimit !== Infinity) {
      // Count only applications within the current subscription period
      const periodFilter = { studentId };
      if (student.applicationPeriodStart) {
        periodFilter.appliedDate = { $gte: student.applicationPeriodStart };
      }
      const applicationCount = await Application.countDocuments(periodFilter);
      if (applicationCount >= appLimit) {
        return res.status(403).json({
          message: `You have reached the limit of ${appLimit} applications under your ${studentPlanType} plan. Upgrade to apply for more.`,
          limitReached: true,
        });
      }
    }

    const existingApplication = await Application.findOne({
      studentId,
      internshipId,
    });

    if (existingApplication) {
      return res.status(400).json({
        message: "You have already applied for this internship.",
      });
    }

    const newApplication = new Application({
      studentId,
      internshipId,
      resumeUrl,
      status: "Applied",
      appliedDate: new Date(),
      userName: student.name,
      userEmail: student.email,
      jobTitle: internship.jobTitle,
      schoolAdmin: student.schoolAdmin || null,
    });

    await newApplication.save();

    // 🚀 1. AUTO SAVE RESUME FIRST (ONLY IF NEW FILE UPLOADED)
    if (resumeFile) {
      try {
        const resumeCount = await Resume.countDocuments({ userId: studentId });
        if (resumeCount < 5) {
          await Resume.create({
            userId: studentId,
            fileUrl: resumeFile.location,
            fileName: resumeFile.originalname || "Resume",
            isParsed: false,
          });
        } else {
          console.log(`User ${studentId} already has 5 resumes. Skipping auto-save.`);
        }
      } catch (err) {
        console.error("Resume auto-save failed:", err.message);
      }
    }

    // 🧠 2. TRIGGER AUTO PARSE IN BACKGROUND (FIRE-AND-FORGET)
    try {
      // Notice there is NO 'await' here. This lets the Node.js server immediately 
      // move on and send the success response to the user while parsing happens silently.
      axios.post(
        `${process.env.SERVER_BASE_URL}/api/resume/parse-from-url`,
        {
          userId: studentId,
          resumeUrl,
        }
      ).catch(err => console.log("⚠️ Background parsing error:", err.message));
      
      console.log("✅ Resume background parsing triggered");
    } catch (err) {
      console.log("⚠️ Failed to trigger parsing:", err.message);
    }

    // 3. IMMEDIATELY RESPOND TO USER
    res.status(201).json({
      message: "Application submitted successfully!",
      application: newApplication,
      limitReached: false,
    });
  } catch (error) {
    console.error("Error during application submission:", error.message);
    res.status(500).json({
      message: "Error applying for the internship.",
      error: error.message,
    });
  }
};

const getApplicationCount = async (req, res) => {
  const { studentId } = req.params;

  try {
    // Fetch the student to check their applicationPeriodStart
    const student = await Userwebapp.findById(studentId).select("applicationPeriodStart");
    const periodFilter = { studentId };
    if (student?.applicationPeriodStart) {
      periodFilter.appliedDate = { $gte: student.applicationPeriodStart };
    }
    const applicationCount = await Application.countDocuments(periodFilter);
    res.status(200).json({ count: applicationCount });
  } catch (error) {
    console.error("Error fetching application count:", error.message);
    res.status(500).json({ message: "Error fetching application count." });
  }
};

// Controller to get all students who applied for a specific internship
const getApplicationsForInternship = async (req, res) => {
  const { internshipId } = req.params;
  const { schoolAdmin } = req.query;

  try {
    // Validate internship ID
    if (!mongoose.Types.ObjectId.isValid(internshipId)) {
      return res.status(400).json({ message: "Invalid internship ID." });
    }

    // Validate schoolAdmin ID if provided
    if (schoolAdmin && !mongoose.Types.ObjectId.isValid(schoolAdmin)) {
      return res.status(400).json({ message: "Invalid schoolAdmin ID." });
    }

    // Build query filter
    const query = { internshipId };
    if (schoolAdmin) {
      query.schoolAdmin = schoolAdmin;
    }

    // Fetch applications
    const applications = await Application.find(query).populate('studentId', 'name email profileImage');

    if (!applications || applications.length === 0) {
      return res.status(404).json({ message: "No applications found for this internship." });
    }

    res.status(200).json({ applications });

  } catch (error) {
    console.error("Error fetching applications:", error.message);
    res.status(500).json({
      message: "Error fetching applications.",
      error: error.message,
    });
  }
};

// Controller to get application status for a student
const getApplicationStatus = async (req, res) => {
  const { studentId } = req.params;

  try {
    // Find all applications for the student
    const applications = await Application.find({ studentId });

    if (!applications || applications.length === 0) {
      return res.status(404).json({
        message: "No applications found for this student.",
      });
    }

    res.status(200).json({
      applications,
    });
  } catch (error) {
    console.error("Error fetching application status:", error.message);
    res.status(500).json({
      message: "Error fetching application status.",
      error: error.message,
    });
  }
};

const getApplicationsForStudent = async (req, res) => {
  try {
    const applications = await Application.find({ studentId: req.params.studentId })
      .populate('internshipId')
      .populate('studentId', 'userName userEmail');
    res.json({ applications });
  } catch (err) {
    console.error("Error fetching applications:", err);
    res.status(500).json({ message: "Error fetching applications" });
  }
};


// Controller to check if a specific job has been applied by the user
const checkIfApplied = async (req, res) => {
  const { studentId, internshipId } = req.params;

  try {
    // Check if the student has applied for this internship
    const existingApplication = await Application.findOne({
      studentId,
      internshipId,
    });

    if (existingApplication) {
      return res.status(200).json({ isApplied: true });
    } else {
      return res.status(200).json({ isApplied: false });
    }
  } catch (error) {
    console.error("Error checking application status:", error.message);
    res.status(500).json({
      message: "Error checking application status.",
      error: error.message,
    });
  }
};

const getApplicationsCountForInternships = async (req, res) => {
  try {
    const { internshipIds } = req.query;

    if (!internshipIds) {
      return res.status(400).json({ message: "Internship IDs are required" });
    }

    // Convert comma-separated string to array and validate IDs
    const idsArray = internshipIds.split(',')
      .map(id => id.trim())
      .filter(id => mongoose.Types.ObjectId.isValid(id));

    if (idsArray.length === 0) {
      return res.status(400).json({ message: "No valid internship IDs provided" });
    }

    const counts = await Application.aggregate([
      {
        $match: {
          internshipId: { $in: idsArray.map(id => new mongoose.Types.ObjectId(id)) }
        }
      },
      {
        $group: {
          _id: "$internshipId",
          count: { $sum: 1 }
        }
      }
    ]);

    // Convert array to object { internshipId: count }
    const countsMap = counts.reduce((acc, curr) => {
      acc[curr._id.toString()] = curr.count;
      return acc;
    }, {});

    res.status(200).json({ counts: countsMap });
  } catch (error) {
    console.error("Error fetching application counts:", error);
    res.status(500).json({
      message: "Error fetching application counts",
      error: error.message
    });
  }
};

const updateApplicationStatus = async (req, res) => {
  const { applicationId } = req.params;
  const { status } = req.body;

  if (!["Accepted", "Rejected"].includes(status)) {
    return res.status(400).json({ error: "Status must be 'Accepted' or 'Rejected'" });
  }

  try {
    // Update application status
    const application = await Application.findByIdAndUpdate(
      applicationId,
      { status },
      { new: true }
    );

    if (!application) {
      return res.status(404).json({ error: "Application not found" });
    }

    // Fetch student info
    let student = await Userwebapp.findById(application.studentId).lean();
    if (!student) {
      student = {
        name: application.userName || "Student",
        email: application.userEmail || null,
      };
    }

    if (!student.email) {
      console.warn(`No email found for studentId: ${application.studentId}`);
    }

    // Read client base URL from env (fall back to localhost)
    const FRONTEND_BASE_URL = process.env.FRONTEND_BASE_URL || "http://localhost:3000";

    // Handle rejection
    if (status === "Rejected") {
      let recommendations = [];
      try {
        recommendations = await getPersonalizedRecommendations(application.studentId, 5);
      } catch (e) {
        console.error("Failed to fetch personalized recommendations:", e?.message || e);
      }

      if (!recommendations.length) {
        recommendations = await InternshipPosting.find({ applicationOpen: true })
          .sort({ createdAt: -1 })
          .limit(5)
          .lean();
      }

      // Build HTML list of recommended internships (email: absolute links; in-app: relative)
      const items = (recommendations || []).map((job) => {
        const stipend = job?.compensationDetails?.amount
          ? ` – Stipend: ${job.compensationDetails.amount} ${job.compensationDetails.currency || ""}`.trim()
          : "";
        const deadline = job?.applicationDeadline
          ? ` – Apply by: ${new Date(job.applicationDeadline).toDateString()}`
          : "";
        const locOrMode = job?.location || job?.internshipMode || "—";

        // Absolute link for emails (so clicking from email navigates to frontend)
        const jobUrlForEmail = `${FRONTEND_BASE_URL}/user-main-page?openTab=recommendations&openRec=${job?._id}`;

        // Relative link for in-app notifications (so SPA handles navigation and preserves auth)
        const jobUrlRelative = `/user-main-page?openTab=recommendations&openRec=${job?._id}`;

        return `<li style="margin:6px 0;">
                  <strong>${job?.jobTitle || "Internship"}</strong>${job?.companyName ? ` at ${job.companyName}` : ""} — ${locOrMode}${stipend}${deadline}
                  — <a href="${jobUrlForEmail}" style="color:#2563eb; text-decoration:underline;">View & Apply</a>
                </li>`;
      }).join("");

      const listHtml = (recommendations && recommendations.length)
        ? `<p style="margin:12px 0;">Based on your profile, here are some internships:</p>
           <ul style="margin:0; margin-left:20px; padding:0; font-family:Arial,Helvetica,sans-serif; font-size:14px; line-height:20px;" type="disc">
             ${items}
           </ul>
           <p style="margin:12px 0;">
             <a href="${FRONTEND_BASE_URL}/user-main-page?openTab=recommendations" style="color:#2563eb; text-decoration:underline;">View all recommendations</a>
           </p>`
        : `<p style="margin:12px 0;">No strong matches right now. Check new roles here:
             <a href="${FRONTEND_BASE_URL}/user-main-page?openTab=recommendations" style="color:#2563eb; text-decoration:underline;">Recommendations</a>.
           </p>`;

      // Optional: Send in-app notification for rejection with recommendations
      // NOTE: use a relative link for in-app notifications to avoid opening a new tab and losing SPA auth
      try {
        const inAppLink = `/user-main-page?openTab=recommendations`; // relative

        await sendNotification({
          studentId: application.studentId,
          title: "Application Rejected",
          message: recommendations.length
            ? `We found ${recommendations.length} internships that may suit you. Check Recommendations.`
            : "We couldn’t find strong matches right now, but keep checking recommendations!",
          link: inAppLink,           // relative path so frontend navigates in-app
          type: "recommendation",
        });
        console.log(`✅ In-app rejection notification saved for studentId: ${application.studentId}`);
      } catch (err) {
        // Log but don't block the response — notifications are best-effort
        console.error("Failed to save in-app notification:", err?.message || err);
      }

      // Send rejection email with recommendations if email present (emails need absolute URLs)
      if (student.email) {
        try {
          const emailContent = `
            <p>Hi ${student.name || "there"},</p>
            <p>Unfortunately, the application for <strong>${application.jobTitle}</strong> was not shortlisted this time.</p>
            ${listHtml}
          `;

          await notifyUser(
            student.email,
            "Application Rejected – Explore new opportunities",
            emailContent
          );
          console.log(`✅ Rejection email sent to ${student.email}`);
        } catch (err) {
          console.error("Failed to send rejection email:", err?.message || err);
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: `Application status updated to ${status}`,
      application,
    });
  } catch (err) {
    console.error("❌ Error in updateApplicationStatus:", err);
    return res.status(500).json({ error: "Server error" });
  }
};

const getRecommendationsForStudent = async (req, res) => {
  try {
    const studentId = req.query.studentId || req.user._id;
    const limit = Number(req.query.limit) || 10;

    const recs = await getPersonalizedRecommendations(studentId, limit);
    res.status(200).json({ success: true, recommendations: recs });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: "Failed to fetch recommendations" });
  }
};

const getStudentDashboardApplications = async (req, res) => {
  const { studentId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(studentId)) {
    return res.status(400).json({ message: "Invalid studentId" });
  }

  try {
    // 1️⃣ Fetch applications
    const applications = await Application.find({ studentId })
      .populate("internshipId")
      .lean();

    if (!applications.length) {
      return res.json({ applications: [] });
    }

    // 2️⃣ Collect internshipIds
    const internshipIds = applications
      .map(app => app.internshipId?._id)
      .filter(Boolean);

    // 3️⃣ Fetch pipelines
  const pipelines = await CandidatePipeline.find({
  studentId,
  internshipId: { $in: internshipIds }
})
.populate({
  path: "l3.interviewId",
  select: "link scheduledAt status interviewId",
})
.lean();


    // 4️⃣ Map pipelines by internshipId
    const pipelineMap = {};
    pipelines.forEach(p => {
      pipelineMap[p.internshipId.toString()] = p;
    });

    // 5️⃣ Merge data
 const dashboardApplications = applications.map(app => {
  const internshipId = app.internshipId?._id?.toString();
  const pipeline = pipelineMap[internshipId] || null;

  return {
    _id: app._id,
    appliedDate: app.appliedDate,
    status: app.status,          // ✅ raw DB status — used as fallback when no pipeline
    internship: app.internshipId,

    pipeline: pipeline
  ? {
      stage: pipeline.stage,

      l1: pipeline.l1 || { status: "pending" },

      l2: pipeline.l2 || { status: "not_used" },

      l3: pipeline.l3
        ? {
            status: pipeline.l3.status,
            scheduledAt: pipeline.l3.scheduledAt,
            interviewId: pipeline.l3.interviewId, // ✅ now populated
          }
        : { status: "not_used" },
    }
  : {
      stage: "L1",
      l1: { status: "pending" },
      l2: { status: "not_used" },
      l3: { status: "not_used" },
    },
  };
});


    return res.json({ applications: dashboardApplications });

  } catch (err) {
    console.error("❌ Dashboard applications error:", err);
    return res.status(500).json({ message: "Failed to load dashboard applications" });
  }
};

const getAssessmentStatus = async (req, res) => {
  try {
    const { assessmentId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(assessmentId)) {
      return res.status(400).json({ message: "Invalid assessment ID" });
    }

    const assessment = await Assessment.findById(assessmentId).lean();

    if (!assessment) {
      return res.status(404).json({ message: "Assessment not found" });
    }

    // Return assessment status information
    const response = {
      assessmentId: assessment._id,
      status: assessment.status,
      timeLimitMinutes: assessment.timing?.timeLimitMinutes || assessment.configSnapshot?.timeLimitMinutes || 20,
    };

    // Add additional fields based on status
    if (assessment.status === "started") {
      response.startedAt = assessment.timing?.startedAt;
      response.questions = []; // Don't return questions here, frontend will fetch separately
    } else if (assessment.status === "submitted") {
      response.submittedAt = assessment.timing?.submittedAt;
    } else if (["evaluated", "passed", "rejected"].includes(assessment.status)) {
      response.evaluation = {
        mcqScore: assessment.evaluation?.mcqScore,
        pass: assessment.evaluation?.pass,
        feedback: assessment.evaluation?.feedback,
      };
    }

    return res.json(response);
  } catch (error) {
    console.error("Error fetching assessment status:", error);
    return res.status(500).json({ message: "Failed to fetch assessment status" });
  }
};

module.exports = {
  applyForInternship,
  getApplicationsForInternship,
  getApplicationStatus,
  getApplicationsForStudent,
  checkIfApplied, // Add the new function to exports
  upgradeToPremium,
  getApplicationCount,
  getApplicationsCountForInternships,
  updateApplicationStatus,
  getRecommendationsForStudent,
  getStudentDashboardApplications,
  getAssessmentStatus
};