// models/webapp-models/issuedCertificateModel.js
const mongoose = require("mongoose");

const issuedCertificateSchema = new mongoose.Schema({
    studentId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: "Userwebapp"
    },
    internshipId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: "Internship"
    },
    partnerId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: "Partner"
    },
    certificateId: {
        type: String,
        required: true,
        unique: true
    },
    pdfUrl: {
        type: String,
        required: true
    },
    s3Key: {
        type: String,
        required: true
    },
    certificateTemplateId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "CustomInternshipCertificate",
        default: null
    },
    // Denormalized fields for robust public verification
    studentName: {
        type: String,
        required: true
    },
    internshipTitle: {
        type: String,
        required: true
    },
    companyName: {
        type: String,
        required: true
    },
    startDate: {
        type: Date
    },
    endDate: {
        type: Date
    },
    issuedAt: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

// Ensure a student can only get one certificate per internship
issuedCertificateSchema.index({ studentId: 1, internshipId: 1 }, { unique: true });

module.exports = mongoose.model("IssuedCertificate", issuedCertificateSchema);
