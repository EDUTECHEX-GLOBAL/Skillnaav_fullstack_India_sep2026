const mongoose = require("mongoose");

const mockInterviewSchema = new mongoose.Schema({
  internshipId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "InternshipPosting",
    required: true
  },
  scheduleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "InternshipSchedule"
  },
  partnerId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  weekNumber: { type: Number, required: true },
  title: { type: String, required: true },
  interviewType: { 
    type: String, 
    enum: ["Technical", "HR", "AI Voice", "Coding", "Other"],
    required: true 
  },
  date: { type: Date, required: true },
  startTime: { type: String, required: true }, // "HH:MM"
  endTime: { type: String, required: true }, // "HH:MM"
  duration: { type: Number }, // in minutes
  interviewer: { type: String },
  meetingLink: { type: String },
  instructions: { type: String },
  questions: [{ type: String }],
  status: {
    type: String,
    enum: ["Scheduled", "Completed", "Cancelled"],
    default: "Scheduled"
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Partner"
  }
}, { timestamps: true });

module.exports = mongoose.model("MockInterview", mockInterviewSchema);
