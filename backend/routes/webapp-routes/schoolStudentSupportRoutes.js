const express = require("express");
const router  = express.Router();
const ctrl    = require("../../controllers/SchoolStudentSupportController");
const { authenticate, authorizeAdmin } = require("../../middlewares/authMiddleware");

router.use(authenticate);
router.use(authorizeAdmin);

router.get("/stats", ctrl.getStats);

router.get   ("/tickets",                                  ctrl.getAllTickets);
router.get   ("/ticket/:ticketId",                         ctrl.getTicketById);
router.put   ("/ticket/:ticketId/status",                  ctrl.updateTicketStatus);
router.put   ("/ticket/:ticketId/assign",                  ctrl.assignTicket);
router.post  ("/ticket/:ticketId/escalate-to-partner",     ctrl.escalateToPartner);  // ← ADD
router.delete("/ticket/:ticketId",                         ctrl.deleteTicket);        // ← ADD

router.get   ("/messages/:ticketId",  ctrl.getMessages);
router.post  ("/mark-read/:ticketId", ctrl.markMessagesAsRead);
router.delete("/message/:messageId",  ctrl.deleteMessage);
router.post  ("/message/:ticketId",   ctrl.uploadMiddleware, ctrl.sendAdminMessage);

router.get("/file/:attachmentId",         ctrl.downloadFile);
router.get("/file/:attachmentId/preview", ctrl.previewFile);

module.exports = router;