const express = require("express");
const router = express.Router();
const axios = require("axios");
const crypto = require("crypto");
const Razorpay = require("razorpay");

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});
const Payment = require("../../models/webapp-models/PaymentModel");
const User = require("../../models/webapp-models/userModel");
const { authenticate } = require("../../middlewares/authMiddleware");
const { sendPaymentConfirmationEmail } = require("../../utils/emailService");
const { generateAndUploadInvoice } = require("../../services/invoiceGenerator");

// ─────────────────────────────────────────────
// FIX 1: Server-side price map — never trust amount from client
// ─────────────────────────────────────────────
const PLAN_PRICES = {
  "Free": 0,
  "Premium Basic": 249,
  "Premium Plus": 599,
};

const PLAN_DURATIONS = {
  "Free": 30,
  "Premium Basic": 2,
  "Premium Plus": 7,
};

// ─────────────────────────────────────────────
// POST /api/payments/razorpay/order
// ─────────────────────────────────────────────
router.post("/razorpay/order", authenticate, async (req, res) => {
  // FIX 2: userId comes from auth token, never from client body
  const userId = req.user._id;
  const { planType } = req.body;

  if (!planType) {
    return res.status(400).json({ success: false, message: "Missing required fields" });
  }

  // FIX 1: Derive price and duration from planType server-side
  const amount = PLAN_PRICES[planType];
  const duration = PLAN_DURATIONS[planType];

  if (amount === undefined || duration === undefined) {
    return res.status(400).json({ success: false, message: `Invalid planType: "${planType}"` });
  }

  // FIX 3: Free plan — no order needed
  if (amount === 0) {
    return res.json({ success: true, free: true });
  }

  try {
    const options = {
      amount: Math.round(amount * 100), // amount in paise
      currency: "INR", // Adjust if needed, but Razorpay usually expects INR
      receipt: `user_${userId}`,
    };

    const order = await razorpay.orders.create(options);

    // FIX 4: Write a Pending payment record at order creation time
    // This ensures we have an audit trail even if the user closes the browser
    await Payment.create({
      userId,
      email: req.user.email,
      planType,
      amount,
      paymentId: "pending",
      orderId: order.id,
      status: "Pending",
    });

    res.json({ success: true, id: order.id, amount: options.amount, currency: options.currency });
  } catch (err) {
    const rzpError = err?.error || err?.message || String(err);
    console.error("❌ Error creating Razorpay order:", rzpError);
    res.status(500).json({ success: false, message: rzpError });
  }
});

// ─────────────────────────────────────────────
// POST /api/payments/razorpay/verify
// ─────────────────────────────────────────────
router.post("/razorpay/verify", authenticate, async (req, res) => {
  // FIX 2: Always use req.user._id — never trust userId from body
  const userId = req.user._id;
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, planType } = req.body;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !planType) {
    return res.status(400).json({ success: false, message: "Missing required fields" });
  }

  // FIX 1: Derive amount/duration from planType server-side
  const parsedAmount = PLAN_PRICES[planType];
  const days = PLAN_DURATIONS[planType];

  if (parsedAmount === undefined || days === undefined) {
    return res.status(400).json({ success: false, message: `Invalid planType: "${planType}"` });
  }

  // ✅ Verify Signature
  const body = razorpay_order_id + "|" + razorpay_payment_id;
  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(body.toString())
    .digest("hex");

  if (expectedSignature !== razorpay_signature) {
    await Payment.findOneAndUpdate(
      { orderId: razorpay_order_id, status: { $in: ["Pending", "Processing"] } },
      { $set: { status: "Failed", updatedAt: new Date() } }
    );
    return res.status(400).json({ success: false, message: "Invalid signature" });
  }

  // FIX 5: Acquire an atomic Processing lock to avoid race-capture
  let lockedPayment = null;
  try {
    lockedPayment = await Payment.findOneAndUpdate(
      { orderId: razorpay_order_id, status: "Pending" },
      { $set: { status: "Processing", updatedAt: new Date() } },
      { new: true }
    );
  } catch (lockErr) {
    console.error("❌ Error acquiring payment lock:", lockErr);
    return res.status(500).json({ success: false, message: "Failed to acquire payment lock" });
  }

  // If we couldn't lock, the payment may already be Success/Processing or missing
  if (!lockedPayment) {
    const successPayment = await Payment.findOne({ orderId: razorpay_order_id, status: "Success" });
    if (successPayment) {
      console.warn(`⚠️ Duplicate capture attempt for orderId ${razorpay_order_id} — returning cached success`);
      const user = await User.findById(userId).select("-password");
      return res.json({ success: true, user, duplicate: true });
    }

    const processingPayment = await Payment.findOne({ orderId: razorpay_order_id, status: "Processing" });
    if (processingPayment) {
      console.warn(`⚠️ Payment already processing for orderId ${razorpay_order_id}`);
      return res.status(409).json({ success: false, message: "Payment is already being processed" });
    }

    const anyPayment = await Payment.findOne({ orderId: razorpay_order_id });
    if (!anyPayment) {
      console.error(`❌ No payment record found for orderId ${razorpay_order_id}`);
      return res.status(404).json({ success: false, message: "Payment record not found" });
    }

    // Last-resort: try to lock any matching record (should be rare)
    try {
      lockedPayment = await Payment.findOneAndUpdate(
        { orderId: razorpay_order_id },
        { $set: { status: "Processing", updatedAt: new Date() } },
        { new: true }
      );
    } catch (fallbackErr) {
      console.error("❌ Fallback lock error:", fallbackErr);
      return res.status(500).json({ success: false, message: "Failed to acquire payment lock (fallback)" });
    }
    if (!lockedPayment) {
      return res.status(500).json({ success: false, message: "Could not lock payment" });
    }
  }

  try {
    const captureId = razorpay_payment_id;

    const now = Date.now();
    const MS_PER_DAY = 24 * 60 * 60 * 1000;

    const userDoc = await User.findById(userId);
    if (!userDoc) {
      // Revert lock to Failed so it doesn't stay Processing indefinitely
      await Payment.findOneAndUpdate(
        { orderId: razorpay_order_id, status: "Processing" },
        { $set: { status: "Failed", updatedAt: new Date() } }
      );
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Stack expiry on top of existing active premium
    let baseTime = now;
    if (userDoc.premiumExpiration && new Date(userDoc.premiumExpiration).getTime() > now) {
      baseTime = new Date(userDoc.premiumExpiration).getTime();
    }
    const premiumExpiration = new Date(baseTime + days * MS_PER_DAY);

    // Generate PDF Invoice
    let invoiceId = null;
    let invoiceUrl = null;
    try {
      const invoiceResult = await generateAndUploadInvoice({
        userName: userDoc.name || "Student",
        userEmail: userDoc.email,
        planType,
        amount: parsedAmount,
        transactionId: captureId,
        orderId: razorpay_order_id,
        date: new Date()
      });
      invoiceId = invoiceResult.invoiceId;
      invoiceUrl = invoiceResult.pdfUrl;
    } catch (invErr) {
      console.error("⚠️ Failed to generate invoice PDF:", invErr.message);
    }

    // Atomically mark the Processing record as Success
    await Payment.findOneAndUpdate(
      { orderId: razorpay_order_id, status: "Processing" },
      {
        $set: {
          paymentId: captureId,
          status: "Success",
          premiumExpiration,
          invoiceId,
          invoiceUrl,
          updatedAt: new Date(),
        },
      }
    );

    // Update user premium fields + reset application period start
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        $set: {
          isPremium: true,
          planType,
          premiumExpiration,
          applicationPeriodStart: new Date(), // reset application count window on new subscription
        },
      },
      { new: true }
    ).select("-password");

    if (!updatedUser) {
      return res.status(404).json({ success: false, message: "User not found after update" });
    }

    console.log(`✅ Premium activated for user ${userId} until ${premiumExpiration.toISOString()}`);

    // Send confirmation email (non-fatal)
    try {
      await sendPaymentConfirmationEmail({
        email: userDoc.email,
        name: userDoc.name || "Student",
        planType,
        amount: parsedAmount,
        captureId,
        orderId: razorpay_order_id,
        premiumExpiration,
        invoiceUrl,
      });
    } catch (emailErr) {
      console.error("⚠️ Failed to send confirmation email:", emailErr.message);
    }

    return res.json({ success: true, user: updatedUser });
  } catch (err) {
    // Ensure we mark any Pending/Processing record as Failed on unexpected errors
    try {
      await Payment.findOneAndUpdate(
        { orderId: razorpay_order_id, status: { $in: ["Pending", "Processing"] } },
        { $set: { status: "Failed", updatedAt: new Date() } }
      );
    } catch (_) {}

    console.error("❌ FULL ERROR in /razorpay/verify:", err.message);

    return res.status(500).json({
      success: false,
      message: "Razorpay capture failed",
      details: err.message || null,
    });
  }
});

// ─────────────────────────────────────────────
// GET /api/payments/history
// Returns payment history. Auto-generates invoices for any
// successful payments that are missing one.
// ─────────────────────────────────────────────
router.get("/history", authenticate, async (req, res) => {
  try {
    const userDoc = await User.findById(req.user._id).select("name email");
    let payments = await Payment.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .select("-__v")
      .lean();

    // Auto-generate invoices for Success payments that don't have one yet
    // Process sequentially to prevent Puppeteer from launching too many concurrent Chrome instances
    const paymentsToGenerate = payments.filter((p) => p.status === "Success" && !p.invoiceUrl);
    
    for (const p of paymentsToGenerate) {
      try {
        const result = await generateAndUploadInvoice({
          userName:      userDoc?.name  || "Student",
          userEmail:     userDoc?.email || p.email,
          planType:      p.planType,
          amount:        p.amount,
          transactionId: p.paymentId || "",
          orderId:       p.orderId   || "",
          date:          p.createdAt || new Date(),
        });
        await Payment.findByIdAndUpdate(p._id, {
          $set: { invoiceId: result.invoiceId, invoiceUrl: result.pdfUrl },
        });
        p.invoiceUrl = result.pdfUrl;
      } catch (invErr) {
        console.warn(`⚠️ Could not auto-generate invoice for payment ${p._id}:`, invErr.message);
      }
    }

    return res.json({ success: true, payments });
  } catch (err) {
    console.error("❌ Error fetching payment history:", err.message);
    return res.status(500).json({ success: false, message: "Failed to fetch payment history" });
  }
});



// ─────────────────────────────────────────────
// POST /api/payments/invoice/:paymentId
// Generate (or re-generate) an invoice for a past successful payment
// ─────────────────────────────────────────────
router.post("/invoice/:paymentId", authenticate, async (req, res) => {
  try {
    const payment = await Payment.findOne({
      _id: req.params.paymentId,
      userId: req.user._id,
      status: "Success",
    });

    if (!payment) {
      return res.status(404).json({ success: false, message: "Payment not found" });
    }

    // If invoice already exists, return it immediately
    if (payment.invoiceUrl) {
      return res.json({ success: true, invoiceUrl: payment.invoiceUrl });
    }

    const userDoc = await User.findById(req.user._id).select("name email");
    if (!userDoc) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const invoiceResult = await generateAndUploadInvoice({
      userName: userDoc.name || "Student",
      userEmail: userDoc.email,
      planType: payment.planType,
      amount: payment.amount,
      transactionId: payment.paymentId || "",
      orderId: payment.orderId || "",
      date: payment.createdAt || new Date(),
    });

    // Save back to the payment record
    await Payment.findByIdAndUpdate(payment._id, {
      $set: { invoiceId: invoiceResult.invoiceId, invoiceUrl: invoiceResult.pdfUrl },
    });

    return res.json({ success: true, invoiceUrl: invoiceResult.pdfUrl });
  } catch (err) {
    console.error("❌ Error generating invoice:", err.message);
    return res.status(500).json({ success: false, message: "Failed to generate invoice" });
  }
});



// ─────────────────────────────────────────────
// POST /api/payments/refund/:paymentId
// FIX 9: Refund endpoint via Razorpay Refund API
// ─────────────────────────────────────────────
router.post("/refund/:paymentId", authenticate, async (req, res) => {
  try {
    const payment = await Payment.findOne({
      _id: req.params.paymentId,
      userId: req.user._id,
      status: "Success",
    });

    if (!payment) {
      return res.status(404).json({ success: false, message: "Payment not found or already refunded" });
    }

    await razorpay.payments.refund(payment.paymentId, {
      amount: Math.round(payment.amount * 100),
    });

    await Payment.findByIdAndUpdate(payment._id, { status: "Refunded" });

    // Revoke premium
    await User.findByIdAndUpdate(req.user._id, {
      $set: {
        isPremium: false,
        planType: "Free",
        premiumExpiration: null,
      },
    });

    return res.json({ success: true, message: "Refund issued successfully" });
  } catch (err) {
    console.error("❌ Refund error:", err.message);
    return res.status(500).json({ success: false, message: "Refund failed", details: err.message });
  }
});

module.exports = router;