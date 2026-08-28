const mongoose = require("mongoose");
const CustomInternshipCertificate = require("../models/webapp-models/customInternshipCertificateModel");
const Notification = require("../models/webapp-models/NotificationModel");
const Partner = require("../models/webapp-models/partnerModel");
const { transporter } = require("../utils/mailer");

const getAllCertificates = async (req, res) => {
    try {
        const items = await CustomInternshipCertificate.find({})
            .populate({ path: "partnerId", model: "Partnerwebapp", select: "name email universityName logoUrl" })
            .sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            items,
        });
    } catch (error) {
        console.error("Error fetching all certificate templates:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch certificate templates.",
            error: error.message,
        });
    }
};

const updateCertificateStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, adminRemarks } = req.body;

        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: "Invalid certificate id." });
        }

        if (!['Approved', 'Rejected', 'Pending'].includes(status)) {
            return res.status(400).json({ success: false, message: "Invalid status." });
        }

        const certificate = await CustomInternshipCertificate.findById(id).populate({ path: "partnerId", model: "Partnerwebapp", select: "name email universityName logoUrl" });

        if (!certificate) {
            return res.status(404).json({ success: false, message: "Certificate not found." });
        }

        certificate.status = status;
        certificate.adminRemarks = adminRemarks || '';
        await certificate.save();

        const partner = certificate.partnerId;

        // In-app Notification
        if (partner) {
            await Notification.create({
                partnerId: partner._id,
                title: `Certificate Template ${status}`,
                message: `Your certificate template "${certificate.name}" has been ${status.toLowerCase()}.${adminRemarks ? ' Reason: ' + adminRemarks : ''}`,
                type: 'certificate'
            });

            // Email Notification
            if (partner.email) {
                const subject = `SkillNaav: Your Certificate Template has been ${status}`;
                const html = `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
                        <h2 style="color: #4f46e5;">Certificate Template ${status}</h2>
                        <p>Hi ${partner.name},</p>
                        <p>Your custom internship certificate template <strong>"${certificate.name}"</strong> has been reviewed by the admin.</p>
                        <p><strong>Status:</strong> <span style="color: ${status === 'Approved' ? 'green' : 'red'};">${status}</span></p>
                        ${adminRemarks ? `<p><strong>Admin Remarks:</strong> ${adminRemarks}</p>` : ''}
                        ${status === 'Rejected' ? `<p>Please update your template ensuring it complies with our guidelines (e.g., includes the SkillNaav logo) and upload a new one.</p>` : ''}
                        <br/>
                        <p>Best regards,</p>
                        <p>The SkillNaav Team</p>
                    </div>
                `;

                transporter.sendMail({
                    to: partner.email,
                    subject,
                    html
                }).catch(err => console.error("Error sending certificate approval email:", err));
            }
        }

        return res.status(200).json({
            success: true,
            message: `Certificate ${status.toLowerCase()} successfully.`,
            item: certificate
        });

    } catch (error) {
        console.error("Error updating certificate status:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to update certificate status.",
            error: error.message,
        });
    }
};

module.exports = {
    getAllCertificates,
    updateCertificateStatus
};
