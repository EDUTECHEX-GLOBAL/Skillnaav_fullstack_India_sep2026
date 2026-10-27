const mongoose = require("mongoose");
const CustomInternshipCertificate = require("../models/webapp-models/customInternshipCertificateModel");
const Notification = require("../models/webapp-models/NotificationModel");
const Partner = require("../models/webapp-models/partnerModel");
const notifyUser = require("../utils/notifyUser");

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

            // Email Notification with Edutechex branded template & logo
            if (partner.email) {
                const subject = `Edutechex: Your Certificate Template has been ${status}`;
                const bodyHtml = `
                    <div style="text-align: left; line-height: 1.6;">
                        <h2 style="color: #4f46e5; margin-top: 0; font-size: 20px;">Certificate Template ${status}</h2>
                        <p style="margin: 12px 0; color: #374151; font-size: 15px;">Hi ${partner.name || 'Partner'},</p>
                        <p style="margin: 12px 0; color: #374151; font-size: 15px;">Your custom internship certificate template <strong>"${certificate.name}"</strong> has been reviewed by the admin.</p>
                        <p style="margin: 12px 0; font-size: 15px;"><strong>Status:</strong> <span style="color: ${status === 'Approved' ? '#16a34a' : '#dc2626'}; font-weight: 700;">${status}</span></p>
                        ${adminRemarks ? `<p style="margin: 12px 0; color: #374151; font-size: 15px;"><strong>Admin Remarks:</strong> ${adminRemarks}</p>` : ''}
                        ${status === 'Rejected' ? `<p style="margin: 12px 0; color: #dc2626; font-size: 14px;">Please update your template ensuring it complies with our guidelines (e.g., includes the Edutechex logo) and upload a new one.</p>` : ''}
                        <br/>
                        <p style="margin: 12px 0 0; color: #4b5563; font-size: 14px;">Best regards,<br/><strong>The Edutechex Team</strong></p>
                    </div>
                `;

                notifyUser(partner.email, subject, bodyHtml).catch(err => console.error("Error sending certificate approval email:", err));
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
