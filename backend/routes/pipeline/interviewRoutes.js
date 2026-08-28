const express = require("express");
const router = express.Router();

const {
  createInterview,
  scheduleInterview,
  updateInterviewStatus,
  sendInterviewInvite,
  completeInterview,
  markInterviewCompleted,
} = require("../../controllers/pipeline/interviewController");

router.post("/create", createInterview);
router.post("/:id/schedule", scheduleInterview);
router.post("/:id/send", sendInterviewInvite);
router.patch("/:id/status", updateInterviewStatus);
router.post("/:id/complete", completeInterview);
router.post("/:id/mark-completed", markInterviewCompleted);




module.exports = router;
