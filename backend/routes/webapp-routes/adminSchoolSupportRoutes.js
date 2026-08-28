// routes/webapp-routes/adminSchoolSupportRoutes.js
// Mounted at: /api/support/admin/school-admin

const express = require("express");
const router  = express.Router();
const ctrl    = require("../../controllers/adminSchoolSupportController");
const { authenticate, authorizeAdmin } = require("../../middlewares/authMiddleware");

// ─────────────────────────────────────────────────────────────────────────────
// FILE ROUTES — only `authenticate` required (no authorizeAdmin)
// School admins need to download files that main admin sent them.
// :attachmentId = att._id (MongoDB subdocument ObjectId string)
// ─────────────────────────────────────────────────────────────────────────────
router.get("/file/:attachmentId",         authenticate, ctrl.downloadFile);
router.get("/file/:attachmentId/preview", authenticate, ctrl.previewFile);

// ─────────────────────────────────────────────────────────────────────────────
// ALL ROUTES BELOW REQUIRE ADMIN JWT
// ─────────────────────────────────────────────────────────────────────────────
router.use(authenticate);
router.use(authorizeAdmin);

// Stats
router.get("/stats",   ctrl.getStats);

// School list (filter dropdown)
router.get("/schools", ctrl.getSchoolList);

// Tickets
router.get("/tickets",                 ctrl.getTickets);
router.get("/ticket/:ticketId",        ctrl.getTicketById);
router.put("/ticket/:ticketId/status", ctrl.updateTicketStatus);
router.put("/ticket/:ticketId/assign", ctrl.assignTicket);

// Messages — ctrl.uploadMiddleware uses the same memoryStorage instance
// so req.files[i].buffer is available in sendMessage
router.get   ("/messages/:ticketId",  ctrl.getMessages);
router.post  ("/message/:ticketId",   ctrl.uploadMiddleware, ctrl.sendMessage);
router.post  ("/mark-read/:ticketId", ctrl.markMessagesAsRead);
router.delete("/message/:messageId",  ctrl.deleteMessage);

module.exports = router;
//changes the file name