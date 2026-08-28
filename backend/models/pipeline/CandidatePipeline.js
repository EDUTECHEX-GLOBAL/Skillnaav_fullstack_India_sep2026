const mongoose = require("mongoose");

const { Schema } = mongoose;

/**
 * CandidatePipeline
 * One document per (internshipId, studentId).
 * Tracks the candidate progress across L1/L2/L3 without affecting existing OfferLetter flow.
 */
const CandidatePipelineSchema = new Schema(
  {
    internshipId: { type: Schema.Types.ObjectId, ref: "InternshipPosting", required: true, index: true },
    studentId: { type: Schema.Types.ObjectId, ref: "Userwebapp", required: true, index: true },
    partnerId: { type: Schema.Types.ObjectId, ref: "Partnerwebapp", required: true, index: true },

    // Current stage
    stage: { type: String, enum: ["L1", "L2", "L3"], default: "L1", index: true },

    // Level 1: AI Shortlist metadata (your existing AI agent can populate this)
    l1: {
      status: { type: String, enum: ["shortlisted", "rejected"], default: "shortlisted" },
      score: { type: Number, default: null },
      modelVersion: { type: String, default: null },
      reasoningRef: { type: String, default: null }, // optional pointer to stored reasoning
      updatedAt: { type: Date, default: null },
    },

    // Level 2: Assessment (MCQ + optional text/files)
    l2: {
      enabled: { type: Boolean, default: false },
      status: {
        type: String,
        enum: ["not_used", "generated", "sent", "started", "submitted", "evaluated", "passed", "rejected", "expired"],
        default: "not_used",
        index: true,
      },
      assessmentId: { type: Schema.Types.ObjectId, ref: "Assessment", default: null },
      dueAt: { type: Date, default: null },
      score: { type: Number, default: null },
      updatedAt: { type: Date, default: null },
    },

    // Level 3: Interview
    l3: {
  enabled: { type: Boolean, default: false },

  status: {
    type: String,
    enum: [
      "not_used",    // candidate never reached L3
      "created",     // interview object created
      "scheduled",   // date/time fixed
      "sent",        // email/calendar invite sent
      "completed",   // interview finished
      "passed",      // selected
      "rejected"     // rejected after interview
    ],
    default: "not_used",
    index: true,
  },

  interviewId: {
    type: Schema.Types.ObjectId,
    ref: "Interview",
    default: null,
  },

  scheduledAt: { type: Date, default: null },

  updatedAt: { type: Date, default: null },
},


    // Optional denormalized flags (non-source-of-truth)
    flags: {
      offerSent: { type: Boolean, default: false }, // can be computed from OfferLetter; kept for quick UI if desired
    },
  },
  { timestamps: true }
);

// Ensure exactly one pipeline doc per internship + student
CandidatePipelineSchema.index({ internshipId: 1, studentId: 1 }, { unique: true });

// Fast query paths
CandidatePipelineSchema.index({ internshipId: 1, stage: 1, updatedAt: -1 });
CandidatePipelineSchema.index({ internshipId: 1, partnerId: 1, stage: 1, updatedAt: -1 });

module.exports = mongoose.model("CandidatePipeline", CandidatePipelineSchema);
