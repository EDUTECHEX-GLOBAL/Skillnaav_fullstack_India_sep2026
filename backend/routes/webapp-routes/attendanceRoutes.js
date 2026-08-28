// routes/attendanceRoutes.js

const express = require('express');
const router  = express.Router();const { authenticate } = require('../../middlewares/authMiddleware');

const {
  markOfflineAttendance,
  overrideAttendance,
  getAttendanceDashboard,
  getMyAttendance,
  updateAttendanceSettings,
  startSession,
  submitOtp,
  endSession,
  getSessionStatus
} = require('../../controllers/attendanceController');

// ── Partner routes ─────────────────────────────────────────────────────────

// Mark offline (or hybrid-offline) attendance for a session
// POST /api/attendance/mark-offline
// Body: { internshipId, partnerId, timetableDate, students: [{ studentId, isPresent }] }
router.post('/mark-offline', markOfflineAttendance);

// Override any attendance record (correction)
// PATCH /api/attendance/override
// Body: { internshipId, studentId, timetableDate, isPresent, reason }
router.patch('/override', overrideAttendance);

// Full dashboard — all students, all sessions, eligibility
// GET /api/attendance/dashboard/:internshipId?partnerId=xxx
router.get('/dashboard/:internshipId', getAttendanceDashboard);

// Update attendance settings (minPercent, onlineMinDuration, tracking on/off)
// PATCH /api/attendance/settings
// Body: { internshipId, partnerId, minAttendancePercent, onlineMinDurationMins, trackingEnabled }
router.patch('/settings', updateAttendanceSettings);

// Start an OTP attendance session
// POST /api/attendance/start-session
router.post('/start-session', startSession);

// End an OTP attendance session early
// POST /api/attendance/end-session
router.post('/end-session', endSession);

// ── Student routes ─────────────────────────────────────────────────────────

// Student views their own attendance summary
// GET /api/attendance/my/:internshipId
router.get('/my/:internshipId', authenticate, getMyAttendance);

// Student submits an OTP to mark attendance
// POST /api/attendance/submit-otp
router.post('/submit-otp', authenticate, submitOtp);

// Student checks if a session is currently active (OTP prompt should be shown)
// GET /api/attendance/session-status/:internshipId
router.get('/session-status/:internshipId', authenticate, getSessionStatus);

module.exports = router;