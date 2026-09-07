const express = require("express");
const router = express.Router();
const axios = require("axios");

const crypto = require("crypto");
const Razorpay = require("razorpay");

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});
const PartnerPayment = require("../../models/webapp-models/PartnerPaymentModel");
const Partner = require("../../models/webapp-models/partnerModel");
const { partnerProtect } = require("../../middlewares/authMiddleware");
const { sendPaymentConfirmationEmail } = require("../../utils/emailService");
const { generateAndUploadInvoice } = require("../../services/invoiceGenerator");
const { getIO } = require("../../utils/socket");

// ─────────────────────────────────────────────
// PLAN CONFIG (SERVER-SIDE ONLY)
// ─────────────────────────────────────────────
const PLAN_PRICES = {
  "Freemium": 0,
  "Premium Basic": 849,
  "Premium Plus": 1699,
};

const PLAN_DURATIONS = {
  "Freemium": 0,
  "Premium Basic": 2,
  "Premium Plus": 5,
};

// ─────────────────────────────────────────────
// TEST RAZORPAY CREDENTIALS (public, dev only)
// ─────────────────────────────────────────────
router.get("/razorpay/test-credentials", async (req, res) => {
  try {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) {
      return res.json({ success: false, message: "RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET not set in .env" });
    }
    // Try fetching orders - small call to validate credentials
    const testOrder = await razorpay.orders.create({ amount: 100, currency: "INR", receipt: "test_receipt" });
    return res.json({ success: true, message: "Razorpay credentials are valid ✅", orderId: testOrder.id, keyId });
  } catch (err) {
    const msg = err?.error?.description || err?.message || String(err);
    return res.json({ success: false, message: "Razorpay credentials INVALID ❌: " + msg, keyId: process.env.RAZORPAY_KEY_ID });
  }
});

// ─────────────────────────────────────────────
// CREATE RAZORPAY ORDER
// ─────────────────────────────────────────────
router.post("/razorpay/order", partnerProtect, async (req, res) => {
  const partnerId = req.partner._id;
  const { planType } = req.body;

  if (!planType) {
    return res.status(400).json({ success: false, message: "Missing planType" });
  }

  const amount = PLAN_PRICES[planType];
  const duration = PLAN_DURATIONS[planType];

  if (amount === undefined || duration === undefined) {
    return res.status(400).json({ success: false, message: "Invalid planType" });
  }

  if (amount === 0) {
    return res.json({ success: true, free: true });
  }

  try {
    const options = {
      amount: Math.round(amount * 100), // amount in paise
      currency: "INR", // Adjust if needed, but Razorpay is usually INR
      receipt: `partner_${partnerId}`,
    };

    const order = await razorpay.orders.create(options);

    await PartnerPayment.create({
      partnerId,
      email: req.partner.email,
      planType,
      amount,
      paymentId: "pending",
      orderId: order.id,
      status: "Pending",
    });

    return res.json({ success: true, id: order.id, amount: options.amount, currency: options.currency });
  } catch (err) {
    const rzpError = err?.error || err?.message || String(err);
    console.error("❌ Partner order creation error:", rzpError);
    return res.status(500).json({ success: false, message: rzpError });
  }
});

// ─────────────────────────────────────────────
// VERIFY RAZORPAY PAYMENT
// ─────────────────────────────────────────────
router.post("/razorpay/verify", partnerProtect, async (req, res) => {
  const partnerId = req.partner._id;
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, planType } = req.body;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !planType) {
    return res.status(400).json({ success: false, message: "Missing fields" });
  }

  const parsedAmount = PLAN_PRICES[planType];
  const days = PLAN_DURATIONS[planType];

  if (parsedAmount === undefined || days === undefined) {
    return res.status(400).json({ success: false, message: "Invalid planType" });
  }

  // ✅ Verify Signature
  const body = razorpay_order_id + "|" + razorpay_payment_id;
  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(body.toString())
    .digest("hex");

  if (expectedSignature !== razorpay_signature) {
    await PartnerPayment.findOneAndUpdate(
      { orderId: razorpay_order_id, status: { $in: ["Pending", "Processing"] } },
      { status: "Failed" }
    );
    return res.status(400).json({ success: false, message: "Invalid signature" });
  }

  // ✅ ATOMIC LOCK
  let lockedPayment;
  try {
    lockedPayment = await PartnerPayment.findOneAndUpdate(
      { orderId: razorpay_order_id, status: "Pending" },
      { status: "Processing" },
      { new: true }
    );
  } catch (err) {
    return res.status(500).json({ success: false, message: "Lock failed" });
  }

  if (!lockedPayment) {
    const successPayment = await PartnerPayment.findOne({
      orderId: razorpay_order_id,
      status: "Success",
    });

    if (successPayment) {
      const partner = await Partner.findById(partnerId).select("-password");
      return res.json({ success: true, partner, duplicate: true });
    }

    return res.status(409).json({
      success: false,
      message: "Already processing",
    });
  }

  try {
    const captureId = razorpay_payment_id;

    const partnerDoc = await Partner.findById(partnerId);

    if (!partnerDoc) {
      return res.status(404).json({ success: false });
    }

    const now = Date.now();
    const baseTime =
      partnerDoc.premiumExpiration &&
      new Date(partnerDoc.premiumExpiration).getTime() > now
        ? new Date(partnerDoc.premiumExpiration).getTime()
        : now;

    const premiumExpiration = new Date(
      baseTime + days * 24 * 60 * 60 * 1000
    );

    // Generate PDF Invoice (non-fatal)
    let invoiceId  = null;
    let invoiceUrl = null;
    try {
      const invoiceResult = await generateAndUploadInvoice({
        userName:      partnerDoc.name || "Partner",
        userEmail:     partnerDoc.email,
        planType,
        amount:        parsedAmount,
        transactionId: captureId,
        orderId:       razorpay_order_id,
        date:          new Date()
      });
      invoiceId  = invoiceResult.invoiceId;
      invoiceUrl = invoiceResult.pdfUrl;
    } catch (invErr) {
      console.error("⚠️ Failed to generate partner invoice PDF:", invErr.message);
    }

    await PartnerPayment.findOneAndUpdate(
      { orderId: razorpay_order_id },
      {
        paymentId: captureId,
        status: "Success",
        premiumExpiration,
        invoiceId,
        invoiceUrl,
      }
    );

    const updatedPartner = await Partner.findByIdAndUpdate(
      partnerId,
      {
        isPremium: true,
        planType,
        premiumExpiration,
      },
      { new: true }
    ).select("-password");

    // ✅ SOCKET EMIT
    const io = getIO();
    if (io) {
      io.to(`partner_${partnerId}`).emit("partner:updated", {
        partnerId: partnerId.toString(),
        isPremium: true,
        planType,
        premiumExpiration,
      });
    }

    // Optional email
    try {
      await sendPaymentConfirmationEmail({
        email:             partnerDoc.email,
        name:              partnerDoc.name || "Partner",
        planType,
        amount:            parsedAmount,
        captureId,
        orderId:           razorpay_order_id,
        premiumExpiration,
        invoiceUrl,
      });
    } catch (e) {
      console.warn("Email failed:", e.message);
    }

    return res.json({ success: true, partner: updatedPartner });
  } catch (err) {
    await PartnerPayment.findOneAndUpdate(
      { orderId: razorpay_order_id, status: { $in: ["Pending", "Processing"] } },
      { status: "Failed" }
    );

    console.error("❌ Verify error:", err.message);
    return res.status(500).json({ success: false });
  }
});

// ─────────────────────────────────────────────
// PAYMENT HISTORY
// ─────────────────────────────────────────────
router.get("/history", partnerProtect, async (req, res) => {
  try {
    const payments = await PartnerPayment.find({
      partnerId: req.partner._id,
    })
      .sort({ createdAt: -1 })
      .select("-__v");

    return res.json({ success: true, payments });
  } catch (err) {
    return res.status(500).json({ success: false });
  }
});

// ─────────────────────────────────────────────
// REFUND
// ─────────────────────────────────────────────
router.post("/refund/:paymentId", partnerProtect, async (req, res) => {
  try {
    const payment = await PartnerPayment.findOne({
      _id: req.params.paymentId,
      partnerId: req.partner._id,
      status: "Success",
    });

    if (!payment) {
      return res.status(404).json({ success: false });
    }

    await razorpay.payments.refund(payment.paymentId, {
      amount: Math.round(payment.amount * 100),
    });

    await PartnerPayment.findByIdAndUpdate(payment._id, {
      status: "Refunded",
    });

    await Partner.findByIdAndUpdate(req.partner._id, {
      isPremium: false,
      planType: "Freemium",
      premiumExpiration: null,
    });

    // ✅ SOCKET FIXED
    const io = getIO();
    if (io) {
      io.to(`partner_${req.partner._id}`).emit("partner:updated", {
        partnerId: req.partner._id.toString(),
        isPremium: false,
        planType: "Freemium",
        premiumExpiration: null,
      });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error("❌ Refund error:", err.message);
    return res.status(500).json({ success: false });
  }
});

module.exports = router;