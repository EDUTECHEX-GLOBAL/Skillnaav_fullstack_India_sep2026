// controllers/issuedCertificateController.js
const IssuedCertificate = require("../models/webapp-models/issuedCertificateModel");

const getMyCertificates = async (req, res) => {
    try {
        const studentId = req.user?._id; // Assuming auth middleware attaches user
        if (!studentId) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        const certificates = await IssuedCertificate.find({ studentId }).sort({ issuedAt: -1 });

        return res.status(200).json({
            success: true,
            certificates
        });
    } catch (error) {
        console.error("Error fetching student certificates:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch certificates."
        });
    }
};

const verifyCertificate = async (req, res) => {
    try {
        const { certificateId } = req.params;

        if (!certificateId) {
            return res.status(400).json({ success: false, message: "Certificate ID is required." });
        }

        const certificate = await IssuedCertificate.findOne({ certificateId }).select('-__v');

        if (!certificate) {
            return res.status(404).json({ success: false, message: "Certificate not found or invalid." });
        }

        return res.status(200).json({
            success: true,
            certificate
        });
    } catch (error) {
        console.error("Error verifying certificate:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to verify certificate."
        });
    }
};

module.exports = {
    getMyCertificates,
    verifyCertificate
};
