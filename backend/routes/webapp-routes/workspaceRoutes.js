const express = require("express");
const multer = require("multer");
const { authenticate } = require("../../middlewares/authMiddleware");
const {
  getCadConfig,
  getPartnerInternships,
  getInternshipApplicants,
  listAssignments,
  getAssignmentById,
  createAssignment,
  updateAssignment,
  deleteAssignment,
  uploadStarterFile,
  recordActivity,
  saveProgress,
  submitAssignment,
  listSubmissionsForAssignment,
  gradeSubmission,
  runCode,
} = require("../../controllers/workspaceController");

const router = express.Router();

const cadMemoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB max per CAD upload
});

router.use(authenticate);

router.get("/config", getCadConfig);
router.post("/run-code", runCode);

router.get("/partner/internships", getPartnerInternships);
router.get("/partner/internships/:internshipId/applicants", getInternshipApplicants);

router.get("/assignments", listAssignments);
router.post("/assignments", createAssignment);
router.get("/assignments/:id", getAssignmentById);
router.put("/assignments/:id", updateAssignment);
router.delete("/assignments/:id", deleteAssignment);

router.post(
  "/assignments/:id/upload-starter",
  cadMemoryUpload.single("file"),
  uploadStarterFile
);

router.get("/assignments/:id/submissions", listSubmissionsForAssignment);

const submissionUploadFields = cadMemoryUpload.fields([
  { name: "stlFile", maxCount: 1 },
  { name: "stepFile", maxCount: 1 },
  { name: "nativeFile", maxCount: 1 },
]);

router.post("/submissions/:assignmentId/activity", recordActivity);
router.post("/submissions/:assignmentId/save", submissionUploadFields, saveProgress);
router.post("/submissions/:assignmentId/submit", submissionUploadFields, submitAssignment);
router.put("/submissions/:submissionId/grade", gradeSubmission);

module.exports = router;

