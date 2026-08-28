// routes/support/adminSupportRoutes.js
// Mounted at: /api/support/admin

const express = require("express");
const router  = express.Router();
const ctrl    = require("../../controllers/adminSupportController");
const { authenticate, authorizeAdmin } = require("../../middlewares/authMiddleware");

// ─────────────────────────────────────────────────────────────────────────────
// FILE ROUTES — authenticate only (no authorizeAdmin)
// Students also hit these routes to download files that admins sent them.
// :attachmentId is the _id of the attachment subdocument stored in MongoDB.
// ─────────────────────────────────────────────────────────────────────────────

// Download  → Content-Disposition: attachment  (Save-As dialog)
router.get("/file/:attachmentId",         authenticate, ctrl.downloadFile);

// Preview   → Content-Disposition: inline  (browser renders image/PDF in tab)
router.get("/file/:attachmentId/preview", authenticate, ctrl.previewFile);

// ─────────────────────────────────────────────────────────────────────────────
// ALL ROUTES BELOW REQUIRE ADMIN JWT
// ─────────────────────────────────────────────────────────────────────────────
router.use(authenticate);
router.use(authorizeAdmin);

// Stats
router.get("/stats", ctrl.getStats);

// Tickets
router.get   ("/tickets",                              ctrl.getAllTickets);
router.get   ("/ticket/:ticketId",                     ctrl.getTicketById);
router.put   ("/ticket/:ticketId/status",              ctrl.updateTicketStatus);
router.put   ("/ticket/:ticketId/assign",              ctrl.assignTicket);
router.post  ("/ticket/:ticketId/escalate-to-partner", ctrl.escalateToPartner);

// ✅ NEW: Admin hard-delete ticket for everyone (removes from DB + notifies all via socket)
router.delete("/ticket/:ticketId",                     ctrl.deleteTicket);

// Messages
router.get   ("/messages/:ticketId",  ctrl.getMessages);
router.post  ("/mark-read/:ticketId", ctrl.markMessagesAsRead);
router.delete("/message/:messageId",  ctrl.deleteMessage);

// ✅ ctrl.uploadMiddleware (memoryStorage) runs before sendAdminMessage
// so req.files[i].buffer is available when attachments are saved to MongoDB.
router.post("/message/:ticketId", ctrl.uploadMiddleware, ctrl.sendAdminMessage);

module.exports = router;