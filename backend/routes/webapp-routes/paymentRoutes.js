const express = require("express");
const router = express.Router();
const axios = require("axios");
const { getAccessToken } = require("../../utils/paypal");
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
  "Premium Basic": 2.99,
  "Premium Plus": 6.99,
};

const PLAN_DURATIONS = {
  "Free": 30,
  "Premium Basic": 2,
  "Premium Plus": 7,
};

// ─────────────────────────────────────────────
// POST /api/payments/paypal/order
// ─────────────────────────────────────────────
router.post("/paypal/order", authenticate, async (req, res) => {
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

  // FIX 3: Free plan — no PayPal order needed
  if (amount === 0) {
    return res.json({ success: true, free: true });
  }

  try {
    const accessToken = await getAccessToken();
    const value = amount.toFixed(2);

    const response = await axios.post(
      `${process.env.PAYPAL_API}/v2/checkout/orders`,
      {
        intent: "CAPTURE",
        purchase_units: [{ amount: { currency_code: "USD", value } }],
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    // FIX 4: Write a Pending payment record at order creation time
    // This ensures we have an audit trail even if the user closes the browser
    await Payment.create({
      userId,
      email: req.user.email,
      planType,
      amount,
      paymentId: "pending",
      orderId: response.data.id,
      status: "Pending",
    });

    res.json({ success: true, id: response.data.id });
  } catch (err) {
    if (err.response) {
      console.error("❌ Error creating PayPal order:", err.response.data);
      res.status(500).json({ success: false, message: "Error creating order", details: err.response.data });
    } else {
      console.error("❌ Error creating PayPal order:", err.message);
      res.status(500).json({ success: false, message: "Error creating order", details: err.message });
    }
  }
});

// ─────────────────────────────────────────────
// POST /api/payments/paypal/verify
// ─────────────────────────────────────────────
router.post("/paypal/verify", authenticate, async (req, res) => {
  // FIX 2: Always use req.user._id — never trust userId from body
  const userId = req.user._id;
  const { orderID, planType } = req.body;

  if (!orderID || !planType) {
    return res.status(400).json({ success: false, message: "Missing required fields" });
  }

  // FIX 1: Derive amount/duration from planType server-side
  const parsedAmount = PLAN_PRICES[planType];
  const days = PLAN_DURATIONS[planType];

  if (parsedAmount === undefined || days === undefined) {
    return res.status(400).json({ success: false, message: `Invalid planType: "${planType}"` });
  }

  // FIX 5: Acquire an atomic Processing lock to avoid race-capture
  let lockedPayment = null;
  try {
    lockedPayment = await Payment.findOneAndUpdate(
      { orderId: orderID, status: "Pending" },
      { $set: { status: "Processing", updatedAt: new Date() } },
      { new: true }
    );
  } catch (lockErr) {
    console.error("❌ Error acquiring payment lock:", lockErr);
    return res.status(500).json({ success: false, message: "Failed to acquire payment lock" });
  }

  // If we couldn't lock, the payment may already be Success/Processing or missing
  if (!lockedPayment) {
    const successPayment = await Payment.findOne({ orderId: orderID, status: "Success" });
    if (successPayment) {
      console.warn(`⚠️ Duplicate capture attempt for orderId ${orderID} — returning cached success`);
      const user = await User.findById(userId).select("-password");
      return res.json({ success: true, user, duplicate: true });
    }

    const processingPayment = await Payment.findOne({ orderId: orderID, status: "Processing" });
    if (processingPayment) {
      console.warn(`⚠️ Payment already processing for orderId ${orderID}`);
      return res.status(409).json({ success: false, message: "Payment is already being processed" });
    }

    const anyPayment = await Payment.findOne({ orderId: orderID });
    if (!anyPayment) {
      console.error(`❌ No payment record found for orderId ${orderID}`);
      return res.status(404).json({ success: false, message: "Payment record not found" });
    }

    // Last-resort: try to lock any matching record (should be rare)
    try {
      lockedPayment = await Payment.findOneAndUpdate(
        { orderId: orderID },
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
    const accessToken = await getAccessToken();

    const captureRes = await axios.post(
      `${process.env.PAYPAL_API}/v2/checkout/orders/${orderID}/capture`,
      {},
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    const captureStatus = captureRes.data?.status;
    if (captureStatus !== "COMPLETED") {
      // Mark the Processing record as Failed
      await Payment.findOneAndUpdate(
        { orderId: orderID, status: "Processing" },
        { $set: { status: "Failed", updatedAt: new Date() } }
      );
      return res.status(400).json({
        success: false,
        message: `Payment capture not completed. Status: ${captureStatus}`,
      });
    }

    console.log("✅ PayPal capture response:", JSON.stringify(captureRes.data, null, 2));

    const captureId = captureRes.data?.purchase_units?.[0]?.payments?.captures?.[0]?.id;
    if (!captureId) {
      console.error("❌ Could not extract captureId from PayPal response. Full data:", captureRes.data);
      await Payment.findOneAndUpdate(
        { orderId: orderID, status: "Processing" },
        { $set: { status: "Failed", updatedAt: new Date() } }
      );
      return res.status(500).json({
        success: false,
        message: "Could not extract capture transaction ID from PayPal response.",
      });
    }

    const now = Date.now();
    const MS_PER_DAY = 24 * 60 * 60 * 1000;

    const userDoc = await User.findById(userId);
    if (!userDoc) {
      // Revert lock to Failed so it doesn't stay Processing indefinitely
      await Payment.findOneAndUpdate(
        { orderId: orderID, status: "Processing" },
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
        orderId: orderID,
        date: new Date()
      });
      invoiceId = invoiceResult.invoiceId;
      invoiceUrl = invoiceResult.pdfUrl;
    } catch (invErr) {
      console.error("⚠️ Failed to generate invoice PDF:", invErr.message);
    }

    // Atomically mark the Processing record as Success
    await Payment.findOneAndUpdate(
      { orderId: orderID, status: "Processing" },
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
        orderId: orderID,
        premiumExpiration,
        invoiceUrl,
      });
    } catch (emailErr) {
      console.error("⚠️ Failed to send confirmation email:", emailErr.message);
    }

    return res.json({ success: true, user: updatedUser });
  } catch (err) {
    const issue = err.response?.data?.details?.[0]?.issue;

    if (issue === "INSTRUMENT_DECLINED") {
      // Mark Processing as Failed so a new attempt can be created by client
      try {
        await Payment.findOneAndUpdate(
          { orderId: orderID, status: "Processing" },
          { $set: { status: "Failed", updatedAt: new Date() } }
        );
      } catch (_) {}

      return res.status(400).json({
        success: false,
        retry: true,
        details: err.response.data,
      });
    }

    // Ensure we mark any Pending/Processing record as Failed on unexpected errors
    try {
      await Payment.findOneAndUpdate(
        { orderId: orderID, status: { $in: ["Pending", "Processing"] } },
        { $set: { status: "Failed", updatedAt: new Date() } }
      );
    } catch (_) {}

    console.error("❌ FULL ERROR in /paypal/verify:", err.response?.data || err);

    return res.status(500).json({
      success: false,
      message: "PayPal capture failed",
      details: err.response?.data || null,
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
// FIX 9: Refund endpoint via PayPal Refund API
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

    const accessToken = await getAccessToken();

    const refundRes = await axios.post(
      `${process.env.PAYPAL_API}/v2/payments/captures/${payment.paymentId}/refund`,
      {},
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (refundRes.data?.status === "COMPLETED") {
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
    }

    return res.status(400).json({ success: false, message: "Refund not completed", details: refundRes.data });
  } catch (err) {
    console.error("❌ Refund error:", err.response?.data || err.message);
    return res.status(500).json({ success: false, message: "Refund failed", details: err.response?.data || null });
  }
});

module.exports = router;