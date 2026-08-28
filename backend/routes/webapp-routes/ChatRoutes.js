// ─── ChatRoutes.js ────────────────────────────────────────────────────────────
const express = require("express");
const router  = express.Router();
const {
  getChatMessages,
  getMessages,
  sendMessage,
  uploadChatFile,
  chatUploadMiddleware,
  deleteMessage,
  getAdminUnreadMessages,
  getPartnerUnreadMessages,
  markConversationRead,
} = require("../../controllers/ChatController");

// ── Read ──────────────────────────────────────────────────────────────────────

// Partner view: paginated messages for a specific internship thread
// GET /api/chats/partner/:partnerId/internship/:internshipId?page=1&limit=20
router.get("/partner/:partnerId/internship/:internshipId", getChatMessages);

// Admin view: paginated messages for any internship
// GET /api/chats/internship/:internshipId?page=1&limit=20
router.get("/internship/:internshipId", getMessages);

// Unread notification summaries
// GET /api/chats/unread/admin
router.get("/unread/admin", getAdminUnreadMessages);

// GET /api/chats/unread/partner/:partnerId
router.get("/unread/partner/:partnerId", getPartnerUnreadMessages);

// ── Write ─────────────────────────────────────────────────────────────────────

// Send a text message (or message + already-uploaded file metadata)
// POST /api/chats/send
router.post("/send", sendMessage);

// Mark all unread messages in one internship thread as read for the current receiver
// PATCH /api/chats/read
router.patch("/read", markConversationRead);

// Upload a file to S3 → returns { fileUrl, fileName, fileType, fileSize }
// Frontend calls this FIRST, then calls /send with the returned values.
// POST /api/chats/upload  (multipart/form-data, field name = "file")
router.post("/upload", chatUploadMiddleware, uploadChatFile);

// ── Delete ────────────────────────────────────────────────────────────────────

// Soft-delete a message (isDeleted: true — never physically removed)
// DELETE /api/chats/:messageId
// Body: { requesterId }
router.delete("/:messageId", deleteMessage);

module.exports = router;
