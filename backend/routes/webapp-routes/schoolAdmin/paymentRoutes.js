const express = require("express");
const router = express.Router();
const { protectSchool } = require("../../../middlewares/protectSchool");
const {
  createRazorpayOrder,
  verifyRazorpayPayment,
  getPaymentHistory,
} = require("../../../controllers/schoolAdmin/paymentController");

// ✅ Routes (These will be mounted at /api/school-admin/payments)
// So the full paths will be:
// POST /api/school-admin/payments/razorpay/order
// POST /api/school-admin/payments/razorpay/verify
// GET /api/school-admin/payments/history

router.post("/razorpay/order", protectSchool, createRazorpayOrder);
router.post("/razorpay/verify", protectSchool, verifyRazorpayPayment);
router.get("/history", protectSchool, getPaymentHistory);

module.exports = router;