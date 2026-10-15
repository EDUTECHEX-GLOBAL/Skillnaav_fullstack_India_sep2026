// routes/cv.js
const express = require("express");
const router = express.Router();
const axios = require("axios");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const StudentProfile = require("../../models/webapp-models/SudentProfileModel");
const Userwebapp = require("../../models/webapp-models/userModel");

router.post(["/generate/:userId", "/generate"], async (req, res) => {
  try {
    let { userId } = req.params;

    if (!userId || userId === "undefined" || userId === "null") {
      userId = req.body?.userId;
    }

    if ((!userId || userId === "undefined" || userId === "null") && req.headers.authorization) {
      try {
        const token = req.headers.authorization.replace(/^Bearer\s+/i, "");
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        userId = decoded.id || decoded._id || decoded.userId;
      } catch (authErr) {
        console.warn("Could not decode auth token in cv route:", authErr.message);
      }
    }

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ detail: "A valid User ID is required to generate a CV." });
    }

    // Fetch both user and profile
    const [user, profile] = await Promise.all([
      Userwebapp.findById(userId),
      StudentProfile.findOne({ userId }),
    ]);

    if (!user) {
      return res.status(404).json({ detail: "User not found." });
    }

    // Flatten into the shape FastAPI CVRequest expects
    let flatSkills = [];
    if (Array.isArray(user.skills)) {
      flatSkills = user.skills
        .map((s) => (typeof s === "object" ? s.name || s.skill || JSON.stringify(s) : String(s)))
        .filter(Boolean);
    } else if (user.skills && typeof user.skills === "object") {
      flatSkills = [
        ...(Array.isArray(user.skills.technical) ? user.skills.technical : []),
        ...(Array.isArray(user.skills.soft) ? user.skills.soft : []),
      ]
        .map((s) => (typeof s === "object" ? s.name || s.skill || JSON.stringify(s) : String(s)))
        .filter(Boolean);
    }

    const payload = {
      // Flat personal fields from Userwebapp
      name:           user.name || user.username || "",
      email:          user.email          || "",
      phone:          user.phone          || "",
      linkedin:       user.linkedin       || "",
      portfolio:      user.portfolio      || "",
      universityName: user.universityName || "",
      fieldOfStudy:   user.fieldOfStudy   || "",
      educationLevel: user.educationLevel || "",
      country:        user.country        || "",
      skills:         flatSkills,

      // Extension fields from StudentProfile
      summary:        profile?.summary        || "",
      experience:     profile?.experience     || [],
      projects:       profile?.projects       || [],
      certifications: profile?.certifications || [],
      languages:      profile?.languages      || [],
    };

    console.log("Sending to FastAPI:", JSON.stringify(payload, null, 2));

    const fastapiBase = process.env.FASTAPI_BASE_URL || "http://localhost:8000";
    const fastapiRes = await axios.post(
      `${fastapiBase}/cv/generate`,
      payload,
      { responseType: "arraybuffer", timeout: 30000 }
    );

    const safeName = (user.name || user.username || "Resume").replace(/\s+/g, "_");

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Edutechex_CV_${safeName}.pdf"`,
    });
    res.send(fastapiRes.data);

  } catch (err) {
    console.error("CV proxy error:", err?.response?.data || err.message);

    // Forward FastAPI's 422 detail if available
    if (err?.response?.status === 422) {
      const detail = Buffer.isBuffer(err.response.data)
        ? err.response.data.toString()
        : err.response.data;
      return res.status(422).json({ detail });
    }

    res.status(err?.response?.status || 500).json({
      detail: err?.response?.data?.detail || err.message || "CV generation failed.",
    });
  }
});

module.exports = router;