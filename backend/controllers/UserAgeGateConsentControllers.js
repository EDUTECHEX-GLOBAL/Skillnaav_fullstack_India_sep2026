// File: UserAgeGateConsentControllers.js

const UserAgeGateConsent = require("../models/webapp-models/UserAgeGateConsentModel");
const mongoose = require("mongoose");

// ✅ Update user approval when admin requests reverify
const Userwebapp = require("../models/webapp-models/userModel");

const sendGuardianConsentEmail = require("../utils/UserAgeGateConsentMail");

// ✅ IMPORTANT: If your project uses folders, update this path, e.g.
// const UserAgeGateConsent = require("../models/UserAgeGateConsentModel");

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || "");

const saveUserAgeGateConsent = async (req, res) => {
    try {
        const userId = req.user && (req.user._id || req.user.id);
        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized." });
        }

        // ✅ define ONCE before any usage
        const userObjectId =
            typeof userId === "string" ? new mongoose.Types.ObjectId(userId) : userId;

        const userEmail = (req.user?.email || "").trim().toLowerCase();
        if (!userEmail) {
            return res.status(400).json({
                success: false,
                message: "User email not found in auth context.",
            });
        }

        const {
            ageCategory,
            ageGateCompleted,
            guardianConsentAccepted,
            guardianConsentAcceptedAt,
            guardianName,
            guardianEmail,
            guardianRelationship,
        } = req.body || {};

        const toBool = (v) => v === true || v === "true";

        if (!ageCategory || !["UNDER_18", "OVER_18"].includes(ageCategory)) {
            return res.status(400).json({
                success: false,
                message: "Invalid or missing ageCategory (UNDER_18 / OVER_18).",
            });
        }

        // Validate UNDER_18 fields
        if (ageCategory === "UNDER_18") {
            if (!guardianName || !guardianName.trim()) {
                return res
                    .status(400)
                    .json({ success: false, message: "Guardian name is required." });
            }

            if (!guardianEmail || !isValidEmail(guardianEmail)) {
                return res
                    .status(400)
                    .json({ success: false, message: "Valid guardian email is required." });
            }

            if (
                !guardianRelationship ||
                !["Parent", "Guardian", "Other"].includes(guardianRelationship)
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Guardian relationship must be Parent / Guardian / Other.",
                });
            }

            // ✅ FIX: check the actual submitted value, not a hardcoded literal
            if (!toBool(guardianConsentAccepted)) {
                return res.status(400).json({
                    success: false,
                    message: "guardianConsentAccepted must be true for UNDER_18.",
                });
            }
        }

        // ✅ REPLACE WHOLE DOC with ONLY required fields (per your requirement)
        const existing = await UserAgeGateConsent.findOne({ user: userObjectId }).lean();

        const wasReverifyRequested = !!existing?.reverificationRequested;
        const prevReverifyRequestedAt = existing?.reverificationRequestedAt || null;
        const prevReverifyReason = existing?.reverificationReason || "";
        const prevReverifyResolvedAt = existing?.reverificationResolvedAt || null;

        // Base timestamps (preserve createdAt if record exists)
        const createdAt = existing?.createdAt || new Date();
        const updatedAt = new Date();

        let replacement;

        // ✅ OVER_18: store ONLY these fields (no guardian fields at all)
        if (ageCategory === "OVER_18") {
            // ✅ selfie must come from multer upload
            if (!req.file || !req.file.location) {
                return res.status(400).json({
                    success: false,
                    message: "Captured selfie is required for OVER_18.",
                });
            }

            replacement = {
                user: userObjectId,
                userEmail,
                ageCategory,
                ageGateCompleted: toBool(ageGateCompleted),

                // ✅ store S3 link in Mongo
                ageVerificationPhotoUrl: req.file.location,
                ageVerificationPhotoKey: req.file.key || "",

                // ✅ clear reverify after new selfie
                reverificationRequested: false,
                reverificationRequestedAt: prevReverifyRequestedAt,
                reverificationResolvedAt: wasReverifyRequested ? new Date() : prevReverifyResolvedAt,
                reverificationReason: prevReverifyReason,

                createdAt,
                updatedAt,
            };
        }

        else {
            // ✅ UNDER_18: store ONLY these fields
            replacement = {
                user: userObjectId,
                userEmail,
                ageCategory,
                ageGateCompleted: toBool(ageGateCompleted),

                // ✅ FIX: use the actual submitted value, not hardcoded true
                guardianConsentAccepted: toBool(guardianConsentAccepted),
                guardianConsentAcceptedAt: guardianConsentAcceptedAt
                    ? new Date(guardianConsentAcceptedAt)
                    : new Date(),

                guardianName: guardianName ? guardianName.trim() : "",
                guardianEmail: guardianEmail ? guardianEmail.trim().toLowerCase() : "",
                guardianRelationship: guardianRelationship || "",

                // ✅ UNDER_18 has no selfie
                ageVerificationPhotoUrl: "",
                ageVerificationPhotoKey: "",

                // ✅ keep reverify fields stable in document
                reverificationRequested: false,
                reverificationRequestedAt: prevReverifyRequestedAt,
                reverificationResolvedAt: prevReverifyResolvedAt,
                reverificationReason: prevReverifyReason,

                createdAt,
                updatedAt,
            };
        }

        // ✅ Put _id first (keeps document order stable in MongoDB viewer)
        const replacementDoc = existing?._id
            ? { _id: existing._id, ...replacement }
            : replacement;

        // ✅ Native replaceOne (upsert) — drops any old unwanted fields automatically
        await UserAgeGateConsent.collection.replaceOne(
            { user: userObjectId },
            replacementDoc,
            { upsert: true }
        );

        // ✅ Read back updated document
        const consent = await UserAgeGateConsent.findOne({ user: userObjectId });

        // ✅ Send guardian consent email immediately for UNDER_18 (non-blocking)
        if (ageCategory === "UNDER_18") {
            const gEmail = (guardianEmail || "").trim().toLowerCase();
            const gName = (guardianName || "").trim();
            const studentName =
                (req.user?.name || req.user?.fullName || req.user?.username || "").trim();

            setImmediate(() => {
                sendGuardianConsentEmail({
                    guardianEmail: gEmail,
                    guardianName: gName,
                    studentEmail: userEmail,
                    studentName: studentName || "your child",
                    consentAt: consent?.guardianConsentAcceptedAt || new Date(),
                }).catch((e) => console.error("Guardian consent email failed:", e));
            });
        }

        return res.status(200).json({ success: true, data: consent });

    } catch (err) {
        console.error("saveUserAgeGateConsent error:", err);
        return res
            .status(500)
            .json({ success: false, message: "Server error saving consent." });
    }
};

const getMyUserAgeGateConsent = async (req, res) => {
    try {
        const userId = req.user && (req.user._id || req.user.id);
        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized." });
        }

        const userObjectId =
            typeof userId === "string" ? new mongoose.Types.ObjectId(userId) : userId;

        const consent = await UserAgeGateConsent.findOne({ user: userObjectId });

        return res.status(200).json({
            success: true,
            data: consent || null,
        });
    } catch (err) {
        console.error("getMyUserAgeGateConsent error:", err);
        return res
            .status(500)
            .json({ success: false, message: "Server error fetching consent." });
    }
};

const requestAgeReverification = async (req, res) => {
    try {
        const { userId } = req.params;
        const { reason } = req.body || {};

        if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ success: false, message: "Invalid userId." });
        }

        const userObjectId = new mongoose.Types.ObjectId(userId);

        const existing = await UserAgeGateConsent.findOne({ user: userObjectId });
        if (!existing) {
            return res.status(404).json({ success: false, message: "Consent record not found." });
        }

        // ✅ Mark reverify required
        await UserAgeGateConsent.updateOne(
            { user: userObjectId },
            {
                $set: {
                    reverificationRequested: true,
                    reverificationRequestedAt: new Date(),
                    reverificationResolvedAt: null,
                    reverificationReason: (reason || "").trim(),
                },
            }
        );

        // ✅ Force user back into "wait admin approval"
        await Userwebapp.updateOne(
            { _id: userObjectId },
            { $set: { adminApproved: false, status: "Pending" } }
        );

        const updated = await UserAgeGateConsent.findOne({ user: userObjectId });
        return res.status(200).json({ success: true, data: updated });
    } catch (err) {
        console.error("requestAgeReverification error:", err);
        return res.status(500).json({ success: false, message: "Server error." });
    }
};

module.exports = {
    saveUserAgeGateConsent,
    getMyUserAgeGateConsent,
    requestAgeReverification,
};