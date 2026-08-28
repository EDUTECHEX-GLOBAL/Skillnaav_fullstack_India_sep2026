//File: customInternshipCertificateController.js

const mongoose = require("mongoose");
const {
    S3Client,
    DeleteObjectCommand,
} = require("@aws-sdk/client-s3");

const CustomInternshipCertificate = require("../models/webapp-models/customInternshipCertificateModel");

const AWS_REGION = process.env.AWS_REGION;
const AWS_IMAGE_BUCKET = process.env.AWS_IMAGE_BUCKET;

const s3 = new S3Client({
    region: AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

const getCertificatesByPartner = async (req, res) => {
    try {
        const { partnerId } = req.params;

        if (!partnerId) {
            return res.status(400).json({
                success: false,
                message: "partnerId is required.",
            });
        }

        if (!mongoose.Types.ObjectId.isValid(partnerId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid partnerId.",
            });
        }

        const items = await CustomInternshipCertificate.find({ partnerId }).sort({
            createdAt: -1,
        });

        return res.status(200).json({
            success: true,
            items,
        });
    } catch (error) {
        console.error("Error fetching certificate templates:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch certificate templates.",
            error: error.message,
        });
    }
};

const createCertificate = async (req, res) => {
    try {
        const { partnerId, name, textColor } = req.body;
        const file = req.file;

        if (!AWS_REGION || !AWS_IMAGE_BUCKET) {
            return res.status(500).json({
                success: false,
                message: "AWS S3 environment variables are missing.",
            });
        }

        if (!partnerId) {
            return res.status(400).json({
                success: false,
                message: "partnerId is required.",
            });
        }

        if (!mongoose.Types.ObjectId.isValid(partnerId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid partnerId.",
            });
        }

        if (!name || !name.trim()) {
            return res.status(400).json({
                success: false,
                message: "Certificate name is required.",
            });
        }

        if (!file) {
            return res.status(400).json({
                success: false,
                message: "Certificate image is required.",
            });
        }

        if (!file.location || !file.key) {
            return res.status(500).json({
                success: false,
                message: "Certificate image upload failed.",
            });
        }

        const newCertificate = await CustomInternshipCertificate.create({
            partnerId,
            name: name.trim(),
            fileName: file.originalname || "",
            imageUrl: file.location,
            s3Key: file.key,
            textColor: textColor || "#1f2937",
        });

        return res.status(201).json({
            success: true,
            message: "Certificate template saved successfully.",
            item: newCertificate,
        });
    } catch (error) {
        console.error("Error creating certificate template:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to save certificate template.",
            error: error.message,
        });
    }
};

const deleteCertificate = async (req, res) => {
    try {
        const { id } = req.params;
        const partnerId = req.query.partnerId || req.body?.partnerId;

        if (!id) {
            return res.status(400).json({
                success: false,
                message: "Certificate id is required.",
            });
        }

        if (!partnerId) {
            return res.status(400).json({
                success: false,
                message: "partnerId is required.",
            });
        }

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid certificate id.",
            });
        }

        if (!mongoose.Types.ObjectId.isValid(partnerId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid partnerId.",
            });
        }

        const item = await CustomInternshipCertificate.findOne({
            _id: id,
            partnerId,
        });

        if (!item) {
            return res.status(404).json({
                success: false,
                message: "Certificate template not found.",
            });
        }

        // Fire S3 deletion in the background — don't await it
        if (item.s3Key) {
            s3.send(new DeleteObjectCommand({ Bucket: AWS_IMAGE_BUCKET, Key: item.s3Key }))
                .catch((s3Error) => console.error("Warning: S3 object deletion failed:", s3Error.message));
        }

        await item.deleteOne();

        return res.status(200).json({
            success: true,
            message: "Certificate template deleted successfully.",
        });
    } catch (error) {
        console.error("Error deleting certificate template:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to delete certificate template.",
            error: error.message,
        });
    }
};

module.exports = {
    getCertificatesByPartner,
    createCertificate,
    deleteCertificate,
};
