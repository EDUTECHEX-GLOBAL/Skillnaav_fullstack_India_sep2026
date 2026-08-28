// backend/routes/webapp-routes/userRoutes.js
const express = require("express");
const router = express.Router();

const { profilePicUpload } = require('../../utils/multer');

const {
  registerUser,
  authUser,
  updateUserProfile,
  getAllUsers,
  approveUser,
  rejectUser,
  checkIfUserExists,
  requestPasswordReset,
  verifyOTPAndResetPassword,
  getUserProfile,
  getPremiumStatus,
  sendSignupVerificationCode,
  verifySignupOTP,
  googleAuthUser,
  getUserById,
  verifyOTPOnly,
  sendAgeGateVerificationCode, // ✅ ADDED
} = require("../../controllers/userController");

const { authenticate } = require("../../middlewares/authMiddleware");
const { requirePlatformFeature } = require("../../middlewares/platformSettingsMiddleware");
const studentRegistrationEnabled = requirePlatformFeature("studentReg", "Student registration");

// Public
router.post(
  "/register",
  studentRegistrationEnabled,
  profilePicUpload.single('profileImage'),
  registerUser
);

router.post("/login", authUser);

router.get("/check-email", checkIfUserExists);

router.post("/request-password-reset", requestPasswordReset);
router.post("/verify-otp-reset-password", verifyOTPAndResetPassword);

// Protected
router.get("/profile", authenticate, getUserProfile);
router.put(
  "/profile",
  authenticate,
  profilePicUpload.single("profileImage"),
  updateUserProfile
);

router.get("/premium-status", authenticate, getPremiumStatus);

// Admin
router.get("/users", getAllUsers);
router.patch("/approve/:userId", approveUser);
router.patch("/reject/:userId", rejectUser);

// OTP — Signup
router.post("/send-verification-code", studentRegistrationEnabled, sendSignupVerificationCode);
router.post("/verify-code", studentRegistrationEnabled, verifySignupOTP);

// OTP — Age Gate (user email + guardian email, no registered-user check)
router.post("/send-age-gate-otp", sendAgeGateVerificationCode); // ✅ ADDED
router.post("/verify-otp", verifyOTPOnly);                 // ✅ Reverted back to match frontend

router.post("/google-auth", studentRegistrationEnabled, googleAuthUser);

// ⚠️  Keep /:id LAST — it matches any single-segment path and would swallow
//     named routes above if placed earlier.
router.get("/:id", getUserById);

module.exports = router;
