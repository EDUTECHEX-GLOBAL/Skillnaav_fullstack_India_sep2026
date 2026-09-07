// routes/webhookRoutes.js
// Razorpay webhook receiver — handles payments that complete after the browser closes.

const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const Payment = require("../../models/webapp-models/PaymentModel");
const User = require("../../models/webapp-models/userModel");
const { sendPaymentConfirmationEmail } = require("../../utils/emailService");

const PLAN_DURATIONS = {
  "Free": 30,
  "Premium Basic": 2,
  "Premium Plus": 7,
};

// ─────────────────────────────────────────────
// Verify Razorpay webhook signature
// ─────────────────────────────────────────────
function verifyWebhookSignature(req) {
  const signature = req.headers["x-razorpay-signature"];
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

  if (!signature || !secret) return false;

  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(req.body.toString())
    .digest("hex");

  return expectedSignature === signature;
}

// ─────────────────────────────────────────────
// POST /api/webhooks/razorpay
// ─────────────────────────────────────────────
router.post("/razorpay", async (req, res) => {
  // Always return 200 quickly so Razorpay doesn't retry endlessly
  res.sendStatus(200);

  try {
    const isValid = verifyWebhookSignature(req);
    if (!isValid) {
      console.warn("⚠️ Razorpay webhook signature verification failed — ignoring");
      return;
    }

    const event = JSON.parse(req.body.toString());

    if (event.event !== "order.paid") return;

    const paymentEntity = event.payload?.payment?.entity;
    const orderEntity = event.payload?.order?.entity;

    const captureId = paymentEntity?.id;
    const orderId = orderEntity?.id;
    const capturedAmount = (paymentEntity?.amount || 0) / 100; // Razorpay sends in paise

    if (!captureId || !orderId) {
      console.error("❌ Webhook missing captureId or orderId", event);
      return;
    }

    // Check if we already processed this order (browser flow completed normally)
    const existing = await Payment.findOne({ orderId, status: "Success" });
    if (existing) {
      console.log(`ℹ️ Webhook: order ${orderId} already processed — skipping`);
      return;
    }

    // Find the Pending record created at /order time
    const pendingPayment = await Payment.findOne({ orderId, status: "Pending" });
    if (!pendingPayment) {
      console.error(`❌ Webhook: no Pending payment found for orderId ${orderId}`);
      return;
    }

    const days = PLAN_DURATIONS[pendingPayment.planType];
    if (!days) {
      console.error(`❌ Webhook: unknown planType ${pendingPayment.planType}`);
      return;
    }

    const now = Date.now();
    const MS_PER_DAY = 24 * 60 * 60 * 1000;

    const userDoc = await User.findById(pendingPayment.userId);
    if (!userDoc) {
      console.error(`❌ Webhook: user ${pendingPayment.userId} not found`);
      return;
    }

    let baseTime = now;
    if (userDoc.premiumExpiration && new Date(userDoc.premiumExpiration).getTime() > now) {
      baseTime = new Date(userDoc.premiumExpiration).getTime();
    }
    const premiumExpiration = new Date(baseTime + days * MS_PER_DAY);

    // Update payment record
    await Payment.findByIdAndUpdate(pendingPayment._id, {
      paymentId: captureId,
      amount: capturedAmount,
      status: "Success",
      premiumExpiration,
    });

    // Activate premium
    await User.findByIdAndUpdate(pendingPayment.userId, {
      $set: {
        isPremium: true,
        planType: pendingPayment.planType,
        premiumExpiration,
      },
    });

    console.log(`✅ Webhook: Premium activated for user ${pendingPayment.userId} via webhook`);

    // Send confirmation email
    try {
      await sendPaymentConfirmationEmail({
        email: userDoc.email,
        name: userDoc.name || "Student",
        planType: pendingPayment.planType,
        amount: capturedAmount,
        captureId,
        orderId,
        premiumExpiration,
      });
    } catch (emailErr) {
      console.error("⚠️ Webhook: Failed to send confirmation email:", emailErr.message);
    }
  } catch (err) {
    console.error("❌ Webhook processing error:", err.message);
  }
});

module.exports = router;
