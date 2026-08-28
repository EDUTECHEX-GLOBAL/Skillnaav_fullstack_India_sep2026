const mongoose = require("mongoose");

const studentMockInterviewSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Userwebapp",
    required: true
  },
  mockInterviewId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "MockInterview",
    required: true
  },
  internshipId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "InternshipPosting",
    required: true
  },
  partnerId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  status: {
    type: String,
    enum: ["Upcoming", "Completed", "Missed"],
    default: "Upcoming"
  },
  completedAt: { type: Date },
  score: { type: Number },
  feedback: { type: String },
  remarks: { type: String },
  strengths: [{ type: String }],
  areasToImprove: [{ type: String }],
  finalEncouragement: { type: String },
  answers: [{
    questionText: String,
    answerText: String,
    audioUrl: String,
    status: { type: String, enum: ["Correct", "Partially Correct", "Incorrect"] },
    aiScore: Number,
    aiFeedback: String
  }]
}, { timestamps: true });

module.exports = mongoose.model("StudentMockInterview", studentMockInterviewSchema);
