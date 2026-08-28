const express = require("express");
const router = express.Router();
const {
  createNotification,
  getNotificationsByStudent,
  markNotificationAsRead,
  markAllNotificationsRead,
  deleteNotification,
} = require("../../controllers/NotificationController");

// ── IMPORTANT: Express matches routes top-to-bottom.
//    Fixed paths (/read-all) MUST come before param paths (/:id) or they
//    will be swallowed by the param route as if "read-all" is an ID.

// Create / send a notification
router.post("/", createNotification);

// Mark ALL as read (body: { studentId })  ← must be before /:studentId
router.put("/read-all", markAllNotificationsRead);

// Mark ONE as read
router.put("/read/:notificationId", markNotificationAsRead);

// Get all notifications for a student
router.get("/:studentId", getNotificationsByStudent);

// Delete a notification
router.delete("/:notificationId", deleteNotification);

module.exports = router;