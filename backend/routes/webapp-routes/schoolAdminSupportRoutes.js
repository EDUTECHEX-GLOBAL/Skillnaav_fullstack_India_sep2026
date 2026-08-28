// routes/webapp-routes/schoolAdminSupportRoutes.js
// Mounted at: /api/support/school-admin

const express = require("express");
const router  = express.Router();
const ctrl    = require("../../controllers/schoolAdmin/schoolAdminSupportController");
const { authenticate, authorizeSchoolAdmin } = require("../../middlewares/authMiddleware");
const { upload } = require("../../middlewares/uploadMiddleware");

router.use(authenticate);
router.use(authorizeSchoolAdmin);

// ══════════════════════════════════════════════════════════════════════════════
// OWN ISSUES — /my-tickets/... (MUST come before student ticket routes)
// ══════════════════════════════════════════════════════════════════════════════
router.get   ("/my-tickets/stats",                   ctrl.getOwnStats);
router.get   ("/my-tickets/file/:attachmentId",      ctrl.downloadOwnFile);
router.get   ("/my-tickets",                         ctrl.getOwnTickets);
router.get   ("/my-tickets/ticket/:ticketId",        ctrl.getOwnTicketById);
router.get   ("/my-tickets/messages/:ticketId",      ctrl.getOwnMessages);
router.post  ("/my-tickets/message/:ticketId",       upload.array("files", 10), ctrl.sendOwnMessage);
router.post  ("/my-tickets/mark-read/:ticketId",     ctrl.markOwnMessagesAsRead);
router.put   ("/my-tickets/ticket/:ticketId/status", ctrl.updateOwnTicketStatus);
router.delete("/my-tickets/message/:messageId",      ctrl.deleteOwnMessage);
router.delete("/my-tickets/ticket/:ticketId",        ctrl.deleteOwnTicket);

// ══════════════════════════════════════════════════════════════════════════════
// STUDENT TICKETS — static paths first, dynamic params last
// ══════════════════════════════════════════════════════════════════════════════
router.get ("/stats",         ctrl.getSchoolStats);
router.get ("/tickets",       ctrl.getSchoolTickets);
router.post("/create-ticket", ctrl.createTicket);

// ✅ KEY FIX: upload.array middleware added — without this, req.body is empty
//             when the frontend sends FormData, causing "Subject and message
//             are required" even though the user filled in the form.
router.post("/raise-issue",   upload.array("files", 10), ctrl.raiseIssue);

router.get   ("/file/:attachmentId",        ctrl.downloadFile);
router.get   ("/ticket/:ticketId",          ctrl.getTicketById);
router.put   ("/ticket/:ticketId/status",   ctrl.updateTicketStatus);
router.post  ("/ticket/:ticketId/escalate", ctrl.escalateToAdmin);
router.get   ("/messages/:ticketId",        ctrl.getMessages);
router.post  ("/message/:ticketId",         upload.array("files", 10), ctrl.sendSchoolAdminMessage);
router.post  ("/mark-read/:ticketId",       ctrl.markMessagesAsRead);
router.delete("/message/:messageId",        ctrl.deleteMessage);

module.exports = router;