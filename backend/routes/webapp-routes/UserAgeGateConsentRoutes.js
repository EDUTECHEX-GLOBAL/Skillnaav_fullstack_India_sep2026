const express = require("express");
const router = express.Router();

const {
    saveUserAgeGateConsent,
    getMyUserAgeGateConsent,
    requestAgeReverification,
} = require("../../controllers/UserAgeGateConsentControllers");

const { authenticate, authorizeAdmin } = require("../../middlewares/authMiddleware");
const { profilePicUpload } = require("../../utils/multer");

router.post(
    "/",
    authenticate,
    (req, res, next) => {
        profilePicUpload.single("ageVerificationPhoto")(req, res, (err) => {
            if (err) {
                console.error("Age verification photo upload error:", err);
                return res.status(400).json({
                    success: false,
                    message: err.message || "Failed to upload verification photo. Please try again.",
                });
            }
            next();
        });
    },
    saveUserAgeGateConsent
);

router.get("/", authenticate, getMyUserAgeGateConsent);

// ✅ FIX: protect reverify route — admins only
router.patch("/request-reverify/:userId", authenticate, authorizeAdmin, requestAgeReverification);

module.exports = router;