const express = require("express");
const router = express.Router();
const multer = require("multer");
const axios = require("axios");

const Userwebapp = require("../../models/webapp-models/userModel");
const Resume = require("../../models/webapp-models/resumeModel");
const StudentProfile = require("../../models/webapp-models/SudentProfileModel"); // keep your existing filename
const Notification = require("../../models/webapp-models/NotificationModel");

const upload = multer({ storage: multer.memoryStorage() });

// ─────────────────────────────────────────────────────────────────────────────
// 1️⃣ MANUAL FILE UPLOAD PARSER (unchanged)
// ─────────────────────────────────────────────────────────────────────────────
router.post("/parse", upload.single("resume"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No resume uploaded" });
    
    console.log("📥 Forwarding resume file to FastAPI parser...");
    
    const formData = new FormData();
    const blob = new Blob([req.file.buffer], { type: req.file.mimetype });
    formData.append("file", blob, req.file.originalname);
    
    const aiResponse = await axios.post(
      `${process.env.FASTAPI_BASE_URL}/extract-resume-file`,
      formData,
      {
        timeout: 30000,
      }
    );
    
    return res.json(aiResponse.data);
  } catch (err) {
    console.error("Resume parsing failed:", err.message);
    if (err.response) {
      console.error("AI Error:", err.response.data);
    }
    res.status(500).json({ message: "Resume parsing failed", error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 2️⃣ AUTO PARSE FROM URL — fires after application submit
// ─────────────────────────────────────────────────────────────────────────────
router.post("/parse-from-url", async (req, res) => {
  try {
    const { userId, resumeUrl } = req.body;
    if (!userId || !resumeUrl) {
      return res.status(400).json({ message: "Missing userId or resumeUrl" });
    }

    // Skip if already parsed
    const existingResume = await Resume.findOne({ fileUrl: resumeUrl });
    if (existingResume?.isParsed) {
      return res.json({ message: "Already parsed" });
    }

    console.log("📥 Sending resume to FastAPI parser...");

    // ── Call FastAPI ──────────────────────────────────────────────────────
    let parsed;
    try {
      const aiResponse = await axios.post(
        `${process.env.FASTAPI_BASE_URL}/extract-resume`,
        { resume_url: resumeUrl },
        { timeout: 30000 }
      );
      parsed = aiResponse.data;
    } catch (axiosErr) {
      console.error("FastAPI call failed:", axiosErr.message);
      return res.status(502).json({ message: "Resume parser unavailable", error: axiosErr.message });
    }

    console.log("✅ FastAPI returned:", {
      skills: parsed.skills?.length,
      experience: parsed.experience?.length,
      projects: parsed.projects?.length,
      education: parsed.education?.length,
      certifications: parsed.certifications?.length,
      languages: parsed.languages?.length,
      linkedin: !!parsed.linkedin,
      summary: !!parsed.summary,
    });

    // ── Fetch user (required) ─────────────────────────────────────────────
    const user = await Userwebapp.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    // ── Fetch or create StudentProfile — DO NOT use || inside Promise.all ─
    //    Promise.all resolves the Promise returned by findOne(), not the result.
    //    The || short-circuit runs BEFORE findOne() resolves, always hitting create().
    let profile = await StudentProfile.findOne({ userId });
    if (!profile) {
      profile = await StudentProfile.create({ userId });
    }

    // ── Build diffs ───────────────────────────────────────────────────────
    const diffs = [];

    // ── Userwebapp scalar fields ──────────────────────────────────────────
    const userScalars = [
      { key: "linkedin",  val: parsed.linkedin,  label: "LinkedIn URL" },
      { key: "portfolio", val: parsed.portfolio, label: "Portfolio URL" },
      { key: "phone",     val: parsed.phone,     label: "Phone Number" },
    ];
    for (const { key, val, label } of userScalars) {
      if (!val || !val.trim()) continue;
      const current = (user[key] || "").trim();
      if (val.trim() !== current) {
        diffs.push({
          field: key,
          target: "userwebapp",
          section: "personal",
          label: `Personal — ${label}`,
          currentValue: current || null,
          suggestedValue: val.trim(),
          sourceResumeUrl: resumeUrl,
        });
      }
    }

    // ── Skills (Userwebapp array) ─────────────────────────────────────────
    const rawSkills = parsed.skills;
    const parsedSkills = Array.isArray(rawSkills)
      ? rawSkills
      : [...(rawSkills?.technical || []), ...(rawSkills?.soft || [])];

    const existingSkills = (user.skills || []).map(s => s.toLowerCase());
    const newSkills = parsedSkills.filter(
      s => s && !existingSkills.includes(s.toLowerCase())
    );
    if (newSkills.length > 0) {
      diffs.push({
        field: "skills",
        target: "userwebapp",
        section: "skills",
        label: `Skills (${newSkills.length} new found)`,
        currentValue: user.skills || [],
        suggestedValue: newSkills,
        sourceResumeUrl: resumeUrl,
      });
    }

    // ── University (Userwebapp scalar) ────────────────────────────────────
    const edu = (parsed.education || [])[0];
    if (edu?.university && !user.universityName) {
      diffs.push({
        field: "universityName",
        target: "userwebapp",
        section: "personal",
        label: "University / Institution",
        currentValue: null,
        suggestedValue: edu.university,
        sourceResumeUrl: resumeUrl,
      });
    }

    // ── Summary (StudentProfile) ──────────────────────────────────────────
    if (parsed.summary && !profile.summary?.trim()) {
      diffs.push({
        field: "summary",
        target: "profile",
        section: "summary",
        label: "Professional Summary",
        currentValue: null,
        suggestedValue: parsed.summary,
        sourceResumeUrl: resumeUrl,
      });
    }

    // ── Experience (StudentProfile) ───────────────────────────────────────
    for (const exp of (parsed.experience || [])) {
      if (!exp.title && !exp.company) continue;
      const exists = (profile.experience || []).some(
        e =>
          e.company?.toLowerCase() === exp.company?.toLowerCase() &&
          e.title?.toLowerCase() === exp.title?.toLowerCase()
      );
      if (!exists) {
        diffs.push({
          field: "experience",
          target: "profile",
          section: "experience",
          label: `Experience — ${exp.title || "Role"}${exp.company ? " at " + exp.company : ""}`,
          currentValue: null,
          suggestedValue: exp,
          sourceResumeUrl: resumeUrl,
        });
      }
    }

    // ── Projects (StudentProfile) ─────────────────────────────────────────
    for (const proj of (parsed.projects || [])) {
      if (!proj.name) continue;
      const exists = (profile.projects || []).some(
        p => p.name?.toLowerCase() === proj.name?.toLowerCase()
      );
      if (!exists) {
        diffs.push({
          field: "projects",
          target: "profile",
          section: "projects",
          label: `Project — ${proj.name}`,
          currentValue: null,
          suggestedValue: proj,
          sourceResumeUrl: resumeUrl,
        });
      }
    }

    // ── Certifications (StudentProfile) ──────────────────────────────────
    for (const cert of (parsed.certifications || [])) {
      if (!cert.name) continue;
      const exists = (profile.certifications || []).some(
        c => c.name?.toLowerCase() === cert.name?.toLowerCase()
      );
      if (!exists) {
        diffs.push({
          field: "certifications",
          target: "profile",
          section: "certifications",
          label: `Certification — ${cert.name}`,
          currentValue: null,
          suggestedValue: cert,
          sourceResumeUrl: resumeUrl,
        });
      }
    }

    // ── Languages (StudentProfile) ────────────────────────────────────────
    for (const lang of (parsed.languages || [])) {
      if (!lang.language) continue;
      const exists = (profile.languages || []).some(
        l => l.language?.toLowerCase() === lang.language?.toLowerCase()
      );
      if (!exists) {
        diffs.push({
          field: "languages",
          target: "profile",
          section: "languages",
          label: `Language — ${lang.language}`,
          currentValue: null,
          suggestedValue: lang,
          sourceResumeUrl: resumeUrl,
        });
      }
    }

    // ── Dedup against already-pending diffs ───────────────────────────────
    const existingKeys = (profile.pendingDiffs || [])
      .filter(d => d.status === "pending")
      .map(d => `${d.field}::${JSON.stringify(d.suggestedValue)}`);

    const newDiffs = diffs.filter(d => {
      const key = `${d.field}::${JSON.stringify(d.suggestedValue)}`;
      return !existingKeys.includes(key);
    });

    // ── Save diffs + notification ─────────────────────────────────────────
    if (newDiffs.length > 0) {
      await StudentProfile.findOneAndUpdate(
        { userId },
        { $push: { pendingDiffs: { $each: newDiffs } } },
        { upsert: true }
      );

      // Create in-app notification
      try {
        await Notification.create({
          studentId: userId,
          title: "Profile Updates Found",
          message: `We found ${newDiffs.length} suggestion${newDiffs.length > 1 ? "s" : ""} from your resume. Review them in your Career Portfolio.`,
          type: "recommendation",
          link: "/user-main-page?openTab=profile",
        });
      } catch (notifErr) {
        // Don't fail the whole request if notification fails
        console.error("Notification create failed:", notifErr.message);
      }

      console.log(`✅ ${newDiffs.length} diffs saved for userId: ${userId}`);
    } else {
      console.log("ℹ️ No new diffs to add (all already pending or matched)");
    }

    // ── Mark resume as parsed ─────────────────────────────────────────────
    await Resume.findOneAndUpdate(
      { fileUrl: resumeUrl },
      { isParsed: true, parsedData: parsed },
      { upsert: false }
    );

    return res.json({
      message: "Resume parsed successfully",
      diffsGenerated: diffs.length,
      newDiffsAdded: newDiffs.length,
    });

  } catch (err) {
    console.error("parse-from-url error:", err);
    return res.status(500).json({ message: "Parse failed", error: err.message });
  }
});

module.exports = router;