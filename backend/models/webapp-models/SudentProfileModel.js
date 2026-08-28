const mongoose = require("mongoose");

/**
 * StudentProfile — EXTENSION of Userwebapp.
 *
 * ONLY stores fields that Userwebapp does NOT already have:
 *   - summary (professional bio)
 *   - experience (internships / jobs)
 *   - projects
 *   - certifications
 *   - languages
 *   - pendingDiffs (AI-suggested updates from resume parsing)
 *
 * Fields ALREADY in Userwebapp (do NOT duplicate here):
 *   name, email, phone, linkedin, portfolio, universityName,
 *   fieldOfStudy, educationLevel, skills, interests,
 *   preferredLocations, country, state, city, dob, profileImage
 *
 * At read time, the frontend merges both documents:
 *   { ...userwebapp, ...studentProfile }
 */
const studentProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Userwebapp",
      required: true,
      unique: true,
    },

    // ── Not in Userwebapp ─────────────────────────────────────────
    summary: { type: String, default: "" },

    experience: [
      {
        title: { type: String, default: "" },
        company: { type: String, default: "" },
        location: { type: String, default: "" },
        startDate: { type: String, default: "" },
        endDate: { type: String, default: "" },
        current: { type: Boolean, default: false },
        description: { type: String, default: "" },
      },
    ],

    projects: [
      {
        name: { type: String, default: "" },
        description: { type: String, default: "" },
        techStack: [{ type: String }],
        link: { type: String, default: "" },
        startDate: { type: String, default: "" },
        endDate: { type: String, default: "" },
      },
    ],

    certifications: [
      {
        name: { type: String, default: "" },
        issuer: { type: String, default: "" },
        issueDate: { type: String, default: "" },
        expiryDate: { type: String, default: "" },
        credentialUrl: { type: String, default: "" },
      },
    ],

    languages: [
      {
        language: { type: String, default: "" },
        proficiency: {
          type: String,
          enum: ["Beginner", "Intermediate", "Advanced", "Native"],
          default: "Intermediate",
        },
      },
    ],

    // ── AI Resume Diff suggestions (pending student approval) ─────
    pendingDiffs: [
      {
        field: { type: String },
        // Which collection/section this diff targets:
        // "userwebapp" → update Userwebapp via existing PUT /api/users/profile
        // "profile"    → update StudentProfile
        target: {
          type: String,
          enum: ["userwebapp", "profile"],
          default: "profile",
        },
        section: { type: String },
        label: { type: String },
        currentValue: { type: mongoose.Schema.Types.Mixed, default: null },
        suggestedValue: { type: mongoose.Schema.Types.Mixed },
        sourceResumeUrl: { type: String },
        createdAt: { type: Date, default: Date.now },
        status: {
          type: String,
          enum: ["pending", "approved", "rejected"],
          default: "pending",
        },
      },
    ],

    // ── Computed score (recalculated on save) ─────────────────────
    profileCompletionScore: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("StudentProfile", studentProfileSchema);