const express = require("express");
const router = express.Router();
const {
  registerSchoolAdmin,
  loginSchoolAdmin,
  getAllSchoolAdmins,
  approveSchoolAdmin,
  rejectSchoolAdmin,
  getSchoolAdminProfile,
  updateSchoolAdminProfile,
  uploadStudentsFromCSV,
  activateFreeSubscription,
  getDashboardMetrics,
  getStudentsBySchoolAdmin,
  toggleStudentAccess,
  requestSchoolAdminPasswordReset,
  //verifySchoolAdminOTPAndResetPassword,
  sendSchoolAdminVerificationCode,
  verifySchoolAdminOTP,
  googleAuthSchoolAdmin,
  getSavedJobsBySchoolAdmin,
  verifySchoolAdminResetOTP,
  resetSchoolAdminPassword,
} = require("../../../controllers/schoolAdmin/schoolAdminController");

const {
  saveJobBySchoolAdmin,
  removeSavedJobBySchoolAdmin,
} = require("../../../controllers/schoolAdmin/schoolAdminSavedJobController");

const {
  getStudentProfileOverview,
  getStudentProfileDetail,
} = require("../../../controllers/schoolAdmin/profileCompletionController"); // ✅ fixed path

const { protectSchool } = require("../../../middlewares/protectSchool");
const { csvUpload, createUploader } = require("../../../utils/multer");
const {
  requirePlatformFeature,
} = require("../../../middlewares/platformSettingsMiddleware");
const schoolRegistrationEnabled = requirePlatformFeature(
  "schoolReg",
  "School registration",
);

const verificationDocUpload = createUploader(
  process.env.AWS_RESUME_BUCKET || "skillnaav-dev-bucket",
  "resumes",
  /pdf|jpe?g|png|docx?/,
  5 * 1024 * 1024,
);

router.post(
  "/register",
  schoolRegistrationEnabled,
  verificationDocUpload.single("verificationDoc"),
  registerSchoolAdmin,
);
router.post("/login", loginSchoolAdmin);
router.get("/schooladmins", getAllSchoolAdmins);
router.patch("/approve/:adminId", approveSchoolAdmin);
router.patch("/reject/:adminId", rejectSchoolAdmin);
router.get("/profile", protectSchool, getSchoolAdminProfile);
router.put(
  "/update-profile",
  protectSchool,
  verificationDocUpload.single("verificationDoc"),
  updateSchoolAdminProfile,
);
router.post(
  "/upload-students",
  protectSchool,
  csvUpload.single("csvFile"),
  uploadStudentsFromCSV,
);
router.post("/activate-free", protectSchool, activateFreeSubscription);
router.get("/dashboard-metrics", protectSchool, getDashboardMetrics);

// ✅ Profile completion routes — MUST be before /students/:id
router.get(
  "/students/profile-overview",
  protectSchool,
  getStudentProfileOverview,
); // ✅ fixed middleware
router.get(
  "/students/:id/profile-detail",
  protectSchool,
  getStudentProfileDetail,
); // ✅ fixed middleware

router.get("/students", protectSchool, getStudentsBySchoolAdmin);
router.patch("/students/:id/access", protectSchool, toggleStudentAccess);
router.post("/forgot-password", requestSchoolAdminPasswordReset);
//router.post("/reset-password", verifySchoolAdminOTPAndResetPassword); -- comment this route add the below two separate routes
//19-08-2026
router.post("/verify-reset-otp", verifySchoolAdminResetOTP);
router.post("/reset-password", resetSchoolAdminPassword);

router.post(
  "/send-verification-code",
  schoolRegistrationEnabled,
  sendSchoolAdminVerificationCode,
);
router.post("/verify-otp", schoolRegistrationEnabled, verifySchoolAdminOTP);
router.post("/google-auth", schoolRegistrationEnabled, googleAuthSchoolAdmin);

// Saved Jobs Dashboard
router.get("/saved-jobs", protectSchool, getSavedJobsBySchoolAdmin);
router.post("/saved-jobs/save", protectSchool, saveJobBySchoolAdmin);
router.delete(
  "/saved-jobs/remove/:schoolAdminId/:jobId",
  protectSchool,
  removeSavedJobBySchoolAdmin,
); // ✅ Saved jobs for school admin's students

module.exports = router;
