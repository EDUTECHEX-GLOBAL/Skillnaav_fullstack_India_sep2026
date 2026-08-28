// routes/webhookRoutes.js
// PayPal webhook receiver — handles payments that complete after the browser closes.
//
// SETUP STEPS:
//   1. Go to PayPal Developer Dashboard → My Apps → Your App → Webhooks
//   2. Add endpoint: https://yourdomain.com/api/webhooks/paypal
//   3. Subscribe to event: PAYMENT.CAPTURE.COMPLETED
//   4. Copy the Webhook ID into your .env as PAYPAL_WEBHOOK_ID
//   5. npm install @paypal/checkout-server-sdk   (already available via axios)
//
// NOTE: PayPal sends webhooks as raw JSON with verification headers.
//       This route must be mounted BEFORE express.json() or with express.raw().

const express = require("express");
const router = express.Router();
const axios = require("axios");
const { getAccessToken } = require("../../utils/paypal");
const Payment = require("../../models/webapp-models/PaymentModel");
const User = require("../../models/webapp-models/userModel");
const { sendPaymentConfirmationEmail } = require("../../utils/emailService");

const PLAN_DURATIONS = {
  "Free": 30,
  "Premium Basic": 2,
  "Premium Plus": 7,
};

// ─────────────────────────────────────────────
// Verify PayPal webhook signature
// ─────────────────────────────────────────────
async function verifyWebhookSignature(req) {
  const accessToken = await getAccessToken();
  const rawBody = req.body; // Buffer from express.raw()
  
  const body = {
    auth_algo:         req.headers["paypal-auth-algo"],
    cert_url:          req.headers["paypal-cert-url"],
    transmission_id:   req.headers["paypal-transmission-id"],
    transmission_sig:  req.headers["paypal-transmission-sig"],
    transmission_time: req.headers["paypal-transmission-time"],
    webhook_id:        process.env.PAYPAL_WEBHOOK_ID,
    webhook_event:     JSON.parse(rawBody.toString()), // parse from raw
  };

  const response = await axios.post(
    `${process.env.PAYPAL_API}/v1/notifications/verify-webhook-signature`,
    body,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    }
  );

  return response.data?.verification_status === "SUCCESS";
}

// ─────────────────────────────────────────────
// POST /api/webhooks/paypal
// ─────────────────────────────────────────────
router.post("/paypal", async (req, res) => {
  // Always return 200 quickly so PayPal doesn't retry endlessly
  res.sendStatus(200);

  try {
    const isValid = await verifyWebhookSignature(req);
    if (!isValid) {
      console.warn("⚠️ PayPal webhook signature verification failed — ignoring");
      return;
    }

     const event = JSON.parse(req.body.toString());

    if (event.event_type !== "PAYMENT.CAPTURE.COMPLETED") return;

    const capture = event.resource;
    const captureId = capture?.id;
    const orderId = capture?.supplementary_data?.related_ids?.order_id;
    const capturedAmount = parseFloat(capture?.amount?.value || "0");

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
