const mongoose = require("mongoose");

const answerSchema = new mongoose.Schema({
  questionText: { type: String, required: true },
  answerText: { type: String }, // optional, for text response
  audioUrl: { type: String }, // optional, for voice response
  aiScore: { type: Number, default: 0 },
  aiFeedback: { type: String }
}, { _id: false });

const mockInterviewSubmissionSchema = new mongoose.Schema({
  internshipId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "InternshipPosting",
    required: true
  },
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Userwebapp",
    required: true
  },
  partnerId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  scheduleDate: { 
    type: String, // "YYYY-MM-DD" reference to schedule day
    required: true
  },
  answers: [answerSchema],
  totalScore: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ["not_started", "in_progress", "completed"],
    default: "not_started"
  },
  submittedAt: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model("MockInterviewSubmission", mockInterviewSubmissionSchema);
