/**
 * adminPartnerSupportRoutes.js
 * backend/routes/webapp-routes/adminPartnerSupportRoutes.js
 *
 * MOUNT ORDER IN server.js (critical):
 *   app.use('/api/support/partner/admin', adminPartnerSupportRoutes);  ← FIRST
 *   app.use('/api/support/partner',       partnerSupportRoutes);       ← SECOND
 */

const express = require('express');
const router  = express.Router();

const ctrl = require('../../controllers/AdminPartnerSupportController');
const { authenticate, authorizeAdmin } = require('../../middlewares/authMiddleware');
const multer = require('multer');

// Use memoryStorage so files land in req.files[i].buffer
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

// Flexible upload handler — accepts "files" OR "attachments" field name
const handleUpload = (req, res, next) => {
  upload.any()(req, res, (err) => {
    if (err) {
      console.error('Multer error:', err.message);
      return res.status(400).json({ message: err.message || 'File upload error' });
    }
    // Normalise req.files so controller always gets an array
    if (!req.files) req.files = [];
    next();
  });
};

router.use((req, _res, next) => {
  console.log(`🏢 Admin Partner Support: ${req.method} ${req.url}`);
  next();
});

// All routes require admin JWT
router.use(authenticate);
router.use(authorizeAdmin);

// ── Stats & Partners ──────────────────────────────────────────────────────────
router.get('/stats',    ctrl.getStats);
router.get('/partners', ctrl.getPartnersList);

// ── Tickets ───────────────────────────────────────────────────────────────────
router.get('/tickets',           ctrl.getAllTickets);
router.get('/tickets/:ticketId', ctrl.getTicketById);

// ── Messages ──────────────────────────────────────────────────────────────────
router.get   ('/tickets/:ticketId/messages',            ctrl.getMessages);
router.post  ('/tickets/:ticketId/messages',            handleUpload, ctrl.sendMessage);
router.patch ('/tickets/:ticketId/messages/read',       ctrl.markMessagesRead);
router.delete('/tickets/:ticketId/messages/:messageId', ctrl.deleteMessage);

// ── Ticket management ─────────────────────────────────────────────────────────
router.patch('/tickets/:ticketId/status', ctrl.updateStatus);
router.patch('/tickets/:ticketId/assign', ctrl.assignTicket);

// ── File download/preview (buffer-based — uses attachment _id) ────────────────
router.get('/file/:attachmentId/preview', ctrl.previewFile);
router.get('/file/:attachmentId',         ctrl.downloadFile);
module.exports = router;