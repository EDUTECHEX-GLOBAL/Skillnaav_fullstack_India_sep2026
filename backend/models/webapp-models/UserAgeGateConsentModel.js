const mongoose = require("mongoose");

const UserAgeGateConsentSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            unique: true,
            index: true,
        },

        userEmail: {
            type: String,
            trim: true,
            lowercase: true,
            required: true,
            index: true,
        },

        ageCategory: {
            type: String,
            enum: ["UNDER_18", "OVER_18"],
            required: true,
        },

        ageGateCompleted: {
            type: Boolean,
            default: false,
        },

        // Under-18 only fields
        guardianConsentAccepted: {
            type: Boolean,
            default: false,
        },

        guardianConsentAcceptedAt: {
            type: Date,
        },

        guardianName: {
            type: String,
            trim: true,
            default: "",
        },

        guardianEmail: {
            type: String,
            trim: true,
            lowercase: true,
            default: "",
        },

        guardianRelationship: {
            type: String,
            enum: ["Parent", "Guardian", "Other", ""],
            default: "",
        },

        // ✅ Over-18 selfie (S3)
        ageVerificationPhotoUrl: {
            type: String,
            trim: true,
            default: "",
        },

        ageVerificationPhotoKey: {
            type: String,
            trim: true,
            default: "",
        },

        // ✅ Admin re-verification flow
        reverificationRequested: { type: Boolean, default: false },
        reverificationRequestedAt: { type: Date, default: null },
        reverificationResolvedAt: { type: Date, default: null },
        reverificationReason: { type: String, trim: true, default: "" },

    },
    { timestamps: true }
);

module.exports = mongoose.model("UserAgeGateConsent", UserAgeGateConsentSchema);