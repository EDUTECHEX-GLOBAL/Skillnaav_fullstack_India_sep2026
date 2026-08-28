const express = require("express");
const router = express.Router();
const mockInterviewController = require("../../controllers/mockInterviewController");
const { authenticate } = require("../../middlewares/authMiddleware");

// Partner Routes
router.post("/", authenticate, mockInterviewController.createMockInterviews);
router.get("/internship/:internshipId", authenticate, mockInterviewController.getMockInterviewsByInternship);
router.delete("/:id", authenticate, mockInterviewController.deleteMockInterview);

// Student Routes
router.get("/student", authenticate, mockInterviewController.getStudentMockInterviews);
router.post("/submit", authenticate, mockInterviewController.submitMockInterview);
router.post("/evaluate-answer", authenticate, mockInterviewController.evaluateAnswer);
router.put("/:id", authenticate, mockInterviewController.updateMockInterview);

module.exports = router;
