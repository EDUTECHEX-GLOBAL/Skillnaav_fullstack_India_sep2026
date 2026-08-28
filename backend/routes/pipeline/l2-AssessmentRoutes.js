const express = require("express");
const router = express.Router();
const {
  generateAssessment,
  sendAssessment,
  getAssessmentsByInternship,
  getAssessmentsByStudent,
  startAssessment,
  submitAssessment,
  getAssessmentForStudent,
  getAssessmentReview,
  getAssessmentReviewByCandidate,
  getProctoringStatus,
  evaluateAssessment,
  trackSuspiciousActivity,
} = require("../../controllers/pipeline/assessmentController");

// ✅ RULE: All fixed-path and sub-path routes MUST be declared BEFORE /:id
// Express matches top-to-bottom. If GET /:id comes first, it will match
// POST /generate, GET /internship/*, POST /:id/send — causing silent 404s.

// ── Fixed paths ──────────────────────────────────────────────────────────────
router.post("/generate", generateAssessment);
router.get("/internship/:internshipId", getAssessmentsByInternship);
router.get("/student/:studentId", getAssessmentsByStudent);
router.get("/review/by-candidate", getAssessmentReviewByCandidate);

// ── Sub-paths on a specific ID (must come before bare /:id) ──────────────────
router.post("/:id/send", sendAssessment);
router.post("/:id/start", startAssessment);
router.post("/:id/submit", submitAssessment);
router.post("/:id/evaluate", evaluateAssessment);
router.post("/:id/track-activity", trackSuspiciousActivity);
router.get("/:id/review", getAssessmentReview);

// Proctoring status (frontend can poll this instead of relying on localStorage)
router.get('/:id/proctoring-status', getProctoringStatus);

// ── Bare /:id — MUST be last ──────────────────────────────────────────────────
router.get("/:id", getAssessmentForStudent);

module.exports = router;
