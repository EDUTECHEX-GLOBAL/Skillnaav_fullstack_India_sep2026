// models/webapp-models/AttendanceModel.js

const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({

  internshipId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'InternshipPosting',
    required: true
  },
  scheduleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'InternshipSchedule',
    required: true
  },
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Userwebapp',
    required: true
  },
  partnerId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },

  // Which timetable slot this record belongs to
  timetableDate: { type: Date, required: true },
  sessionType: {
    type: String,
    enum: ['online', 'offline', 'hybrid'],
    required: true
  },

  // ─── ONLINE: auto-detected from Google Meet ───────────────────────────────
  onlineAttendance: {
    joined:          { type: Boolean, default: false },
    joinedAt:        { type: Date },
    leftAt:          { type: Date },
    durationMins:    { type: Number, default: 0 },   // actual minutes the student stayed
    meetsThreshold:  { type: Boolean, default: false } // durationMins >= partner's onlineMinDurationMins
  },

  // ─── OFFLINE: manually marked by partner / instructor ─────────────────────
  offlineAttendance: {
    markedPresent: { type: Boolean, default: false },
    markedBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'Partner' },
    markedAt:      { type: Date }
  },

  // ─── HYBRID: both portions tracked independently ─────────────────────────
  // onlineAttendance  → auto-detected Google Meet portion
  // offlineAttendance → manually marked offline portion
  // isPresent is true only when BOTH portions are satisfied

  // ─── OTP CHECK-IN: student enters code displayed by partner ──────────────
  otpCheckin: {
    enteredOtp:  { type: String },
    checkedInAt: { type: Date },
    ipAddress:   { type: String }
  },

  // ─── Final resolved status ────────────────────────────────────────────────
  isPresent:   { type: Boolean, default: false },
  resolvedBy:  {
    type: String,
    enum: ['auto', 'manual', 'override'],
    default: 'auto'
  },

  // ─── Partner override (partner can always correct any record) ─────────────
  overriddenBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'Partner' },
  overrideReason: { type: String, trim: true }

}, { timestamps: true });

// One attendance record per student per session date per internship
attendanceSchema.index(
  { internshipId: 1, studentId: 1, timetableDate: 1 },
  { unique: true }
);

module.exports = mongoose.model('Attendance', attendanceSchema);