// routes/partnerWebhookRoutes.js
// Razorpay webhook receiver for partner payments.

const express  = require("express");
const router   = express.Router();
const crypto   = require("crypto");
const { getIO }                           = require("../../utils/socket");
const PartnerPayment                      = require("../../models/webapp-models/PartnerPaymentModel");
const Partner                             = require("../../models/webapp-models/partnerModel");
const { sendPaymentConfirmationEmail }    = require("../../utils/emailService");

const PLAN_DURATIONS = {
  "Freemium":      0,
  "Premium Basic": 2,
  "Premium Plus":  5,
};

// ─────────────────────────────────────────────
// Helper: safely parse req.body to an object
// ─────────────────────────────────────────────
// When mounted with express.raw(), req.body is a Buffer.
// When mounted after express.json() (misconfiguration), req.body is already an object.
// This helper handles both so the route never crashes on .toString() of an object.
function parseBody(req) {
  if (Buffer.isBuffer(req.body)) {
    return JSON.parse(req.body.toString("utf8"));
  }
  if (typeof req.body === "string") {
    return JSON.parse(req.body);
  }
  // Already parsed object (express.json() ran first — not ideal but survivable)
  return req.body;
}

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
// POST /api/webhooks/partner/razorpay
// ─────────────────────────────────────────────
router.post("/razorpay", async (req, res) => {
  // Respond 200 immediately so Razorpay does not retry
  res.sendStatus(200);

  try {
    const isValid = verifyWebhookSignature(req);
    if (!isValid) {
      console.warn("⚠️ Partner webhook: signature verification failed — ignoring");
      return;
    }

    const event = parseBody(req);

    if (event.event !== "order.paid") return;

    const paymentEntity = event.payload?.payment?.entity;
    const orderEntity = event.payload?.order?.entity;

    const captureId = paymentEntity?.id;
    const orderId = orderEntity?.id;
    const capturedAmount = (paymentEntity?.amount || 0) / 100;

    if (!captureId || !orderId) {
      console.error("❌ Partner webhook: missing captureId or orderId", event);
      return;
    }

    // Idempotency — skip if browser-side flow already completed this order
    const alreadyDone = await PartnerPayment.findOne({ orderId, status: "Success" });
    if (alreadyDone) {
      console.log(`ℹ️ Partner webhook: order ${orderId} already processed — skipping`);
      return;
    }

    // Find the Pending record created at /order time
    const pendingPayment = await PartnerPayment.findOne({ orderId, status: "Pending" });
    if (!pendingPayment) {
      console.error(`❌ Partner webhook: no Pending record for orderId ${orderId}`);
      return;
    }

    const days = PLAN_DURATIONS[pendingPayment.planType];
    if (days === undefined || days === null) {
      console.error(`❌ Partner webhook: unknown planType "${pendingPayment.planType}"`);
      return;
    }

    const partnerDoc = await Partner.findById(pendingPayment.partnerId);
    if (!partnerDoc) {
      console.error(`❌ Partner webhook: partner ${pendingPayment.partnerId} not found`);
      return;
    }

    // Stack expiry on top of existing premium time if still active
    const now        = Date.now();
    const MS_PER_DAY = 24 * 60 * 60 * 1000;
    const baseTime   =
      partnerDoc.premiumExpiration &&
      new Date(partnerDoc.premiumExpiration).getTime() > now
        ? new Date(partnerDoc.premiumExpiration).getTime()
        : now;
    const premiumExpiration = new Date(baseTime + days * MS_PER_DAY);

    // Persist payment record
    await PartnerPayment.findByIdAndUpdate(pendingPayment._id, {
      paymentId:         captureId,
      amount:            capturedAmount,
      status:            "Success",
      premiumExpiration,
    });

    // Activate premium on partner document
    await Partner.findByIdAndUpdate(
      pendingPayment.partnerId,
      {
        $set: {
          isPremium:         true,
          planType:          pendingPayment.planType,
          premiumExpiration,
        },
      },
      { new: true },
    );

    console.log(`✅ Partner webhook: premium activated for partner ${pendingPayment.partnerId}`);

    // ✅ FIX 3: Real-time socket emit — was a dead comment placeholder before
    try {
      const io = getIO();
      if (io) {
        io.to(`partner_${pendingPayment.partnerId}`).emit("partner:updated", {
          partnerId:         pendingPayment.partnerId.toString(),
          isPremium:         true,
          planType:          pendingPayment.planType,
          premiumExpiration,
        });
      }
    } catch (socketErr) {
      console.warn("⚠️ Partner webhook: socket emit failed:", socketErr.message);
    }

    // Send confirmation email
    try {
      await sendPaymentConfirmationEmail({
        email:             partnerDoc.email,
        name:              partnerDoc.name || "Partner",
        planType:          pendingPayment.planType,
        amount:            capturedAmount,
        captureId,
        orderId,
        premiumExpiration,
      });
    } catch (emailErr) {
      console.warn("⚠️ Partner webhook: confirmation email failed:", emailErr.message);
    }
  } catch (err) {
    console.error("❌ Partner webhook processing error:", err.message);
  }
});

module.exports = router;
