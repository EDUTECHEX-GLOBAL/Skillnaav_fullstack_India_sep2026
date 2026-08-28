const express = require("express");
const router = express.Router();
const axios = require("axios");

const { getAccessToken } = require("../../utils/paypal");
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
  "Premium Basic": 9.99,
  "Premium Plus": 19.99,
};

const PLAN_DURATIONS = {
  "Freemium": 0,
  "Premium Basic": 2,
  "Premium Plus": 5,
};

// ─────────────────────────────────────────────
// CREATE ORDER
// ─────────────────────────────────────────────
router.post("/paypal/order", partnerProtect, async (req, res) => {
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
    const accessToken = await getAccessToken();

    const response = await axios.post(
      `${process.env.PAYPAL_API}/v2/checkout/orders`,
      {
        intent: "CAPTURE",
        purchase_units: [
          {
            amount: {
              currency_code: "USD",
              value: amount.toFixed(2),
            },
          },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    await PartnerPayment.create({
      partnerId,
      email: req.partner.email,
      planType,
      amount,
      paymentId: "pending",
      orderId: response.data.id,
      status: "Pending",
    });

    return res.json({ success: true, id: response.data.id });
  } catch (err) {
    console.error("❌ Order creation error:", err.message);
    return res.status(500).json({ success: false });
  }
});

// ─────────────────────────────────────────────
// VERIFY PAYMENT
// ─────────────────────────────────────────────
router.post("/paypal/verify", partnerProtect, async (req, res) => {
  const partnerId = req.partner._id;
  const { orderID, planType } = req.body;

  if (!orderID || !planType) {
    return res.status(400).json({ success: false });
  }

  const parsedAmount = PLAN_PRICES[planType];
  const days = PLAN_DURATIONS[planType];

  if (parsedAmount === undefined || days === undefined) {
    return res.status(400).json({ success: false, message: "Invalid planType" });
  }

  // ✅ ATOMIC LOCK
  let lockedPayment;
  try {
    lockedPayment = await PartnerPayment.findOneAndUpdate(
      { orderId: orderID, status: "Pending" },
      { status: "Processing" },
      { new: true }
    );
  } catch (err) {
    return res.status(500).json({ success: false, message: "Lock failed" });
  }

  if (!lockedPayment) {
    const successPayment = await PartnerPayment.findOne({
      orderId: orderID,
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
    const accessToken = await getAccessToken();

    const captureResp = await axios.post(
      `${process.env.PAYPAL_API}/v2/checkout/orders/${orderID}/capture`,
      {},
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    const capture =
      captureResp.data.purchase_units?.[0]?.payments?.captures?.[0];

    if (!capture || capture.status !== "COMPLETED") {
      await PartnerPayment.findOneAndUpdate(
        { orderId: orderID, status: { $in: ["Pending", "Processing"] } },
        { status: "Failed" }
      );
      return res.status(400).json({ success: false });
    }

    const captureId = capture.id;
    const capturedAmount = parseFloat(capture.amount.value);

    if (Math.abs(capturedAmount - parsedAmount) > 0.05) {
      await PartnerPayment.findOneAndUpdate(
        { orderId: orderID, status: { $in: ["Pending", "Processing"] } },
        { status: "Failed" }
      );
      return res.status(400).json({ success: false });
    }

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
        orderId:       orderID,
        date:          new Date()
      });
      invoiceId  = invoiceResult.invoiceId;
      invoiceUrl = invoiceResult.pdfUrl;
    } catch (invErr) {
      console.error("⚠️ Failed to generate partner invoice PDF:", invErr.message);
    }

    await PartnerPayment.findOneAndUpdate(
      { orderId: orderID },
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
        orderId:           orderID,
        premiumExpiration,
        invoiceUrl,
      });
    } catch (e) {
      console.warn("Email failed:", e.message);
    }

    return res.json({ success: true, partner: updatedPartner });
  } catch (err) {
    await PartnerPayment.findOneAndUpdate(
      { orderId: orderID, status: { $in: ["Pending", "Processing"] } },
      { status: "Failed" }
    );

    console.error("❌ Verify error:", err.response?.data || err.message);
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

    const accessToken = await getAccessToken();

    const refundRes = await axios.post(
      `${process.env.PAYPAL_API}/v2/payments/captures/${payment.paymentId}/refund`,
      {},
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (refundRes.data?.status === "COMPLETED") {
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
    }

    return res.status(400).json({ success: false });
  } catch (err) {
    console.error("❌ Refund error:", err.response?.data || err.message);
    return res.status(500).json({ success: false });
  }
});

module.exports = router;