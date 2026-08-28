const express = require("express");
const router = express.Router();
const { resumeUpload } = require("../../utils/multer");
const {
  uploadResume,
  getUserResumes,
  deleteResume,
} = require("../../controllers/resumeController");

// Upload new resume
router.post("/upload", resumeUpload.single("resume"), uploadResume);

// ⭐ THIS IS THE DROPDOWN ENDPOINT
router.get("/user/:userId", getUserResumes);

router.delete("/:resumeId", deleteResume);

module.exports = router;