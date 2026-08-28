const express = require("express");
const router = express.Router();
const { protectSchool } = require("../../../middlewares/protectSchool");
const {
  subscribeToPlan,
  getPaymentHistory,
} = require("../../../controllers/schoolAdmin/paymentController");

// ✅ Routes (These will be mounted at /api/school-admin/payments)
// So the full paths will be:
// POST /api/school-admin/payments/subscribe
// GET /api/school-admin/payments/history

router.post("/subscribe", protectSchool, subscribeToPlan);
router.get("/history", protectSchool, getPaymentHistory);

module.exports = router;