// routes/cv.js
const express = require("express");
const router = express.Router();
const axios = require("axios");
const StudentProfile = require("../../models/webapp-models/SudentProfileModel");
const Userwebapp = require("../../models/webapp-models/userModel");

router.post("/generate/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    // Fetch both user and profile
    const [user, profile] = await Promise.all([
      Userwebapp.findById(userId),
      StudentProfile.findOne({ userId }),
    ]);

    if (!user) {
      return res.status(404).json({ detail: "User not found." });
    }

    // Flatten into the shape FastAPI CVRequest expects
    const flatSkills = Array.isArray(user.skills)
      ? user.skills
      : [
          ...(user.skills?.technical || []),
          ...(user.skills?.soft || []),
        ];

    const payload = {
      // Flat personal fields from Userwebapp
      name:           user.name           || "",
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

    const fastapiRes = await axios.post(
      `${process.env.FASTAPI_BASE_URL}/cv/generate`,
      payload,
      { responseType: "arraybuffer", timeout: 30000 }
    );

    const safeName = (user.name || "Resume").replace(/\s+/g, "_");

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Skillnaav_CV_${safeName}.pdf"`,
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
      detail: err.message || "CV generation failed.",
    });
  }
});

module.exports = router;