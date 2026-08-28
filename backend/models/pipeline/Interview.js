const mongoose = require("mongoose");
const { Schema } = mongoose;

/**
 * Interview
 * Level 3: Interview scheduling + meeting info
 */
const InterviewSchema = new Schema(
  {
    internshipId: {
      type: Schema.Types.ObjectId,
      ref: "InternshipPosting",
      required: true,
      index: true,
    },

    studentId: {
      type: Schema.Types.ObjectId,
      ref: "Userwebapp",
      required: true,
      index: true,
    },

    partnerId: {
      type: Schema.Types.ObjectId,
      ref: "Partnerwebapp",
      required: true,
      index: true,
    },

    // ======================
    // Meeting Details
    // ======================
    link: {
      type: String,
      default: null, // Google Meet / Zoom link
    },

    provider: {
      type: String,
      enum: ["google_meet", "zoom", "teams", "custom"],
      default: "custom",
    },

    calendarEventId: {
      type: String,
      default: null, // Google Calendar event ID
    },

    createdBySystem: {
      type: Boolean,
      default: false, // true if auto-generated
    },

    // ======================
    // Interview Lifecycle
    // ======================
    status: {
      type: String,
      enum: [
        "created",     // interview object created
        "scheduled",   // date & time fixed
        "sent",        // email/calendar invite sent
        "completed",   // interview done
        "passed",
        "rejected",
      ],
       completedAt: Date,
      default: "created",
      index: true,
    },

    scheduledAt: { type: Date, default: null },

    durationMinutes: { type: Number, default: 30 },

    timezone: { type: String, default: "Asia/Kolkata" },

    completedAt: {
  type: Date,
  default: null,
},

    // ======================
    // Feedback
    // ======================
    notes: { type: String, default: null },

    rating: {
      type: Number,
      min: 1,
      max: 5,
      default: null,
    },
  },
  { timestamps: true }
);

// Indexes
InterviewSchema.index({ internshipId: 1, status: 1, updatedAt: -1 });
InterviewSchema.index({ studentId: 1, status: 1, updatedAt: -1 });
InterviewSchema.index({ partnerId: 1, status: 1, updatedAt: -1 });

module.exports = mongoose.model("Interview", InterviewSchema);
