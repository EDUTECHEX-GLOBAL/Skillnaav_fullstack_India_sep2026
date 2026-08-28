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
    profilePicUpload.single("ageVerificationPhoto"),
    saveUserAgeGateConsent
);

router.get("/", authenticate, getMyUserAgeGateConsent);

// ✅ FIX: protect reverify route — admins only
router.patch("/request-reverify/:userId", authenticate, authorizeAdmin, requestAgeReverification);

module.exports = router;