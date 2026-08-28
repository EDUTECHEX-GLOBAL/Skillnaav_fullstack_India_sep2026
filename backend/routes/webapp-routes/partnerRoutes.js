const express = require("express");
const router = express.Router();
const {
  registerPartner,
  authPartner,
  updatePartnerProfile,
  getAllPartners,
  approvePartner,
  rejectPartner,
  checkEmailExists,
  requestPasswordReset,
  verifyOTPAndResetPassword,
  getPartnerProfile,
  sendPartnerVerificationCode,
  verifyPartnerOTP,
  updatePartnerPlan,
  googleAuthPartner, // 🔥 NEW
  completePartnerProfile, // 🔥 NEW
  verifyPartnerOTPOnly,
  removeLogo, // ✅ NEW
} = require("../../controllers/partnerController");
const Partnerwebapp = require("../../models/webapp-models/partnerModel");
const { authenticate } = require("../../middlewares/authMiddleware");
const { profilePicUpload } = require('../../utils/multer'); // Assuming this import is correct
const { imageUploader } = require("../../utils/multer");
const { requirePlatformFeature } = require("../../middlewares/platformSettingsMiddleware");
const partnerRegistrationEnabled = requirePlatformFeature("partnerReg", "Partner registration");

// Middleware to set req.isPartner for all partner routes
router.use((req, res, next) => {
  req.isPartner = true; // Mark as partner
  next();
});

router.post("/register", partnerRegistrationEnabled, profilePicUpload.single('profileImage'), registerPartner);
router.post("/login", authPartner);

// 🎯 CRITICAL FIX: The updatePartnerProfile controller function must be here.
router.put(
  "/profile",
  authenticate,
  profilePicUpload.single('profileImage'),
  updatePartnerProfile // <-- The missing function that saves the file path
);

router.get("/partners", getAllPartners);
router.patch("/approve/:partnerId", approvePartner);
router.patch("/reject/:partnerId", rejectPartner);
router.post("/check-email", checkEmailExists);

router.post('/request-password-reset', requestPasswordReset);         // Step 1
router.post('/verify-reset-otp', verifyPartnerOTPOnly);               // Step 2
router.post('/verify-otp-reset-password', verifyOTPAndResetPassword); // Step 3

router.get("/profile", authenticate, getPartnerProfile);

router.post("/send-verification-code", partnerRegistrationEnabled, sendPartnerVerificationCode);
router.post("/verify-otp", partnerRegistrationEnabled, verifyPartnerOTP);
router.put("/subscribe", updatePartnerPlan);

router.post(
  "/upload-logo",
  authenticate, // ✅ identify logged partner
  imageUploader("offer-templates").single("image"),
  async (req, res) => {
    try {
      if (!req.file || !req.file.location) {
        return res.status(400).json({
          success: false,
          message: "Upload failed",
        });
      }

      const logoUrl = req.file.location;

      // ✅ UPDATE PARTNER PROFILE
      const updatedPartner = await Partnerwebapp.findByIdAndUpdate(
        req.user._id, // comes from JWT
        { logoUrl },
        { new: true }
      );

      if (!updatedPartner) {
        return res.status(404).json({
          success: false,
          message: "Partner not found",
        });
      }

      return res.status(200).json({
        success: true,
        logoUrl: updatedPartner.logoUrl,
      });
    } catch (err) {
      console.error("Logo upload error:", err);
      res.status(500).json({
        success: false,
        message: "Server error",
      });
    }
  }
);

router.put("/remove-logo", authenticate, removeLogo); // ✅ NEW

router.post("/google-auth", partnerRegistrationEnabled, googleAuthPartner);                                                      // 🔥 ADD
router.post("/complete-profile", authenticate, profilePicUpload.single("profileImage"), completePartnerProfile); // 🔥 ADD


module.exports = router;
