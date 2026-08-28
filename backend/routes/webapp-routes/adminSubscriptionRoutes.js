// routes/webapp-routes/adminSubscriptionRoutes.js

const express = require("express");
const router = express.Router();

const {
  getStudentSubscriptions,
  getPartnerSubscriptions,
  getSubscriptionOverview,
} = require("../../controllers/adminSubscriptionController");

// TODO: Uncomment when admin auth middleware is ready
// const { adminProtect } = require("../../middlewares/authMiddleware");

// GET /api/admin/subscriptions/overview
router.get("/overview", getSubscriptionOverview);

// GET /api/admin/subscriptions/students
// Supports: ?status=Active|Expired|Expiring Soon|Free  &search=<text>
router.get("/students", getStudentSubscriptions);

// GET /api/admin/subscriptions/partners
// Supports: ?status=Active|Expired|Expiring Soon|Free  &search=<text>
router.get("/partners", getPartnerSubscriptions);

module.exports = router;