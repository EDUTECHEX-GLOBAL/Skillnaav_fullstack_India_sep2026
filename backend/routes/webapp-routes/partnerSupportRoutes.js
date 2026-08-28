/**
 * partnerSupportRoutes.js
 * All partner-facing support routes: /api/support/partner/*
 *
 * MOUNT ORDER IN server.js:
 *   app.use('/api/support/partner/admin', adminPartnerSupportRoutes);  ← FIRST
 *   app.use('/api/support/partner',       partnerSupportRoutes);       ← SECOND
 */

const express = require("express");
const router  = express.Router();

const partnerCtrl = require("../../controllers/Partnersupportcontroller");
const { authenticate, authorizePartner } = require("../../middlewares/authMiddleware");
const { upload } = require("../../middlewares/uploadMiddleware");

router.use((req, _res, next) => {
  console.log(`🤝 Partner Support: ${req.method} ${req.url}`);
  next();
});

router.use(authenticate);
router.use(authorizePartner);

// Wraps multer — returns clean 400 JSON on upload error
const handleUpload = (req, res, next) => {
  upload.array("attachments", 5)(req, res, (err) => {
    if (err) {
      console.error("Multer upload error:", err.message);
      return res.status(400).json({ message: err.message || "File upload error" });
    }
    next();
  });
};

// Stats
router.get("/stats", partnerCtrl.getStats);

// Ticket routes — static BEFORE parameterised
;
router.get ("/tickets",         partnerCtrl.getMyTickets);
router.post("/tickets", handleUpload, partnerCtrl.createTicket);


router.patch("/tickets/:ticketId/status",   partnerCtrl.updateStatus);
router.get  ("/tickets/:ticketId/activity", partnerCtrl.getTicketActivity);

// Message routes — static (/read) BEFORE parameterised (/:messageId)
router.get   ("/tickets/:ticketId/messages",      partnerCtrl.getMessages);
router.post  ("/tickets/:ticketId/messages",      handleUpload, partnerCtrl.sendMessage);
router.patch ("/tickets/:ticketId/messages/read", partnerCtrl.markMessagesRead);
router.delete("/tickets/:ticketId/messages/:messageId", partnerCtrl.deleteMessage);
router.delete("/tickets/:ticketId",         partnerCtrl.deleteTicket); 

// Attachment download — FIXED: uses attachmentId (MongoDB _id), not fileId
// Preview route MUST come before download route (more specific path first)
router.get(
  "/tickets/:ticketId/messages/:messageId/attachments/:attachmentId/preview",
  partnerCtrl.previewAttachment
);
router.get(
  "/tickets/:ticketId/messages/:messageId/attachments/:attachmentId",
  partnerCtrl.downloadAttachment
);

module.exports = router;