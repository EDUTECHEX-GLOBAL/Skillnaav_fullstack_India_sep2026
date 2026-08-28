//File: customInternshipCertificateModel.js

const mongoose = require("mongoose");

const customInternshipCertificateSchema = new mongoose.Schema(
    {
        partnerId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            ref: "Partnerwebapp",
            index: true,
        },
        name: {
            type: String,
            required: true,
            trim: true,
        },
        fileName: {
            type: String,
            default: "",
            trim: true,
        },
        imageUrl: {
            type: String,
            required: true,
            trim: true,
        },
        textColor: {
            type: String,
            default: "#1f2937",
            trim: true,
        },
        s3Key: {
            type: String,
            required: true,
            trim: true,
        },
        status: {
            type: String,
            enum: ['Pending', 'Approved', 'Rejected'],
            default: 'Pending'
        },
        adminRemarks: {
            type: String,
            default: ''
        }
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model(
    "CustomInternshipCertificate",
    customInternshipCertificateSchema
);