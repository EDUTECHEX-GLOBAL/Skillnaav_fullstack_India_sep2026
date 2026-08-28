// routes/internshipPaymentRoutes.js
const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middlewares/authMiddleware');
const {
  createPayPalOrder,
  capturePayPalPayment,
  getPaymentStatus,
  getStudentPayments,
  getPaymentsForInternship,
  getPaymentsForPartner,
  getPaymentsListForInternship,
  getPaymentsForPartnerDetailed, // ✅ New
} = require('../../controllers/internshipPaymentController');

// ─── PayPal Payment Flow ───────────────────────────────────────────────────────
router.post('/create-paypal-order', authenticate, createPayPalOrder);
router.post('/capture-paypal-payment', authenticate, capturePayPalPayment);
router.get('/status/:offerId', authenticate, getPaymentStatus);

// ─── Student Payment History ───────────────────────────────────────────────────
router.get('/student/:studentId', getStudentPayments);

// ─── Admin / Analytics ────────────────────────────────────────────────────────
// Summary (totals only) for a specific internship
router.get('/admin/internship/:internshipId', getPaymentsForInternship);

// Summary (totals only) for all internships of a partner
router.get('/admin/partner/:partnerId', getPaymentsForPartner);

// Detailed list for a specific internship
router.get('/:internshipId/payments', getPaymentsListForInternship);

// ─── Partner Dashboard ─────────────────────────────────────────────────────────
// ✅ Detailed list of ALL payments for a partner (all statuses, all internships)
// Used by InternshipPayments.jsx tab in the partner flow.
// Optional query param: ?status=COMPLETED
router.get('/partner/:partnerId/detailed', getPaymentsForPartnerDetailed);

module.exports = router;
