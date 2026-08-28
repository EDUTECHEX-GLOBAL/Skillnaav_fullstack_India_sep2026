// routes/studentSupportRoutes.js
//
// FIX: Multer errors are thrown synchronously inside uploadMiddleware (before
//      the next handler runs), so Express's normal 4-arg error middleware
//      placed AFTER the route handler never fires.
//
//      Solution: wrap uploadMiddleware in a tiny bridge that calls next(err)
//      when Multer rejects, so Express's error pipeline catches it.
//      Then register handleMulterError as the LAST argument — this is now
//      reachable because next(err) was called correctly.

const express = require("express");
const router  = express.Router();
const ctrl    = require("../../controllers/studentSupportController");
const { authenticate } = require("../../middlewares/authMiddleware");

router.use(authenticate);

router.get("/my-stats",              ctrl.getMyStats);
router.get("/my-tickets",            ctrl.getMyTickets);
router.get("/messages/:ticketId",    ctrl.getMessages);
router.post("/mark-read/:ticketId",  ctrl.markMessagesAsRead);
router.delete("/message/:messageId", ctrl.deleteMessage);
router.get("/file/:fileId",          ctrl.getFile);

// "Delete for Me" — hides ticket from student, admin still sees it
router.patch("/ticket/:ticketId/hide", ctrl.hideTicketForStudent);

// "Delete for Everyone" — hard deletes ticket everywhere
router.delete("/ticket/:ticketId",   ctrl.deleteTicket);

// ─── Multer bridge ────────────────────────────────────────────────────────────
// Wraps uploadMiddleware so that Multer errors are forwarded via next(err)
// instead of being swallowed.  Without this, handleMulterError is unreachable.
// ─────────────────────────────────────────────────────────────────────────────
const multerBridge = (req, res, next) => {
  ctrl.uploadMiddleware(req, res, (err) => {
    if (err) return ctrl.handleMulterError(err, req, res, next);
    next();
  });
};

router.post(
  "/create",
  multerBridge,
  ctrl.createTicket
);

router.post(
  "/message/:ticketId",
  multerBridge,
  ctrl.sendMessage
);

module.exports = router;