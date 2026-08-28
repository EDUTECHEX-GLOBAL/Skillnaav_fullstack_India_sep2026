// routes/partnerWebhookRoutes.js
// PayPal webhook receiver for partner payments.
// Handles PAYMENT.CAPTURE.COMPLETED when the partner's browser closes before onApprove fires.
//
// SETUP:
//   1. PayPal Developer Dashboard → Your App → Webhooks
//   2. Add endpoint: https://yourdomain.com/api/webhooks/partner/paypal
//   3. Subscribe to: PAYMENT.CAPTURE.COMPLETED
//   4. Set PAYPAL_WEBHOOK_ID in .env (or PAYPAL_PARTNER_WEBHOOK_ID if you registered separately)
//
// In server.js, register BEFORE express.json() using express.raw():
//   const partnerWebhook = require("./routes/partnerWebhookRoutes");
//   app.use(
//     "/api/webhooks/partner",
//     express.raw({ type: "application/json" }),
//     partnerWebhook
//   );
//   app.use(express.json()); // for all other routes

const express  = require("express");
const router   = express.Router();
const axios    = require("axios");

const { getAccessToken }                  = require("../../utils/paypal");
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
// Verify PayPal webhook signature
// ─────────────────────────────────────────────
async function verifyWebhookSignature(req) {
  const accessToken = await getAccessToken();

  // ✅ FIX 1: Parse body once here and reuse the object — no double JSON.parse
  const event = parseBody(req);

  const body = {
    auth_algo:         req.headers["paypal-auth-algo"],
    cert_url:          req.headers["paypal-cert-url"],
    transmission_id:   req.headers["paypal-transmission-id"],
    transmission_sig:  req.headers["paypal-transmission-sig"],
    transmission_time: req.headers["paypal-transmission-time"],
    webhook_id:        process.env.PAYPAL_PARTNER_WEBHOOK_ID || process.env.PAYPAL_WEBHOOK_ID,
    webhook_event:     event, // ✅ pass the already-parsed object, not a re-stringified string
  };

  const response = await axios.post(
    `${process.env.PAYPAL_API}/v1/notifications/verify-webhook-signature`,
    body,
    {
      headers: {
        Authorization:  `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    },
  );

  return response.data?.verification_status === "SUCCESS";
}

// ─────────────────────────────────────────────
// POST /api/webhooks/partner/paypal
// ─────────────────────────────────────────────
router.post("/paypal", async (req, res) => {
  // Respond 200 immediately so PayPal does not retry
  res.sendStatus(200);

  try {
    const isValid = await verifyWebhookSignature(req);
    if (!isValid) {
      console.warn("⚠️ Partner webhook: signature verification failed — ignoring");
      return;
    }

    // ✅ FIX 2: Parse body once — verifyWebhookSignature already parsed it above,
    // but since that function is a separate scope we parse again here safely via helper.
    const event = parseBody(req);

    if (event.event_type !== "PAYMENT.CAPTURE.COMPLETED") return;

    const capture        = event.resource;
    const captureId      = capture?.id;
    const orderId        = capture?.supplementary_data?.related_ids?.order_id;
    const capturedAmount = parseFloat(capture?.amount?.value || "0");

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
