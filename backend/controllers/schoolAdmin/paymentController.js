const asyncHandler = require("express-async-handler");
const Payment = require("../../models/webapp-models/schoolAdmin/SchoolAdminPayment");
const SchoolAdmin = require("../../models/webapp-models/schoolAdmin/SchoolAdminModel");
const axios = require("axios");
const { generateAndUploadInvoice } = require("../../services/invoiceGenerator");
const { sendSchoolAdminPaymentConfirmationEmail } = require("../../utils/emailService");

const normalizeSchoolAdminPlanForStorage = (plan) =>
  plan === "Premium Plus Plan" ? "Premium Plan" : plan;

const normalizeSchoolAdminPlanForClient = (plan) =>
  plan === "Premium Plan" ? "Premium Plus Plan" : plan || "Free Plan";

const getCreditsForPlan = (plan) => {
  const normalizedPlan = normalizeSchoolAdminPlanForStorage(plan);

  switch (normalizedPlan) {
    case "Standard Plan":
      return 500;
    case "Premium Plan":
      return 2000;
    default:
      return 0;
  }
};

// 📦 Verify PayPal Order
const verifyPayPalOrder = async (orderId) => {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const { data: authData } = await axios.post(
    "https://api-m.sandbox.paypal.com/v1/oauth2/token",
    new URLSearchParams({ grant_type: "client_credentials" }),
    {
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    }
  );

  const { data: orderDetails } = await axios.get(
    `https://api-m.sandbox.paypal.com/v2/checkout/orders/${orderId}`,
    {
      headers: {
        Authorization: `Bearer ${authData.access_token}`,
      },
    }
  );

  return orderDetails;
};

// 💳 Subscribe Handler
const subscribeToPlan = asyncHandler(async (req, res) => {
  const { plan, orderId } = req.body;
  const adminId = req.schoolAdmin?._id;
  const planForStorage = normalizeSchoolAdminPlanForStorage(plan);

  const admin = await SchoolAdmin.findById(adminId);
  if (!admin) return res.status(401).json({ message: "Unauthorized" });

  const order = await verifyPayPalOrder(orderId);
  if (order.status !== "COMPLETED") {
    return res.status(400).json({ message: "Payment not completed." });
  }

  const capture = order?.purchase_units?.[0]?.payments?.captures?.[0];
  if (!capture || capture.status !== "COMPLETED") {
    return res.status(400).json({ message: "Invalid or incomplete payment capture." });
  }

  const capturedAmount = parseFloat(capture.amount?.value || "0");
  const currency = capture.amount?.currency_code || "USD";

  // Normalize & set credits to add
  let planInternal;
  const creditsToAdd = getCreditsForPlan(planForStorage);

  switch (planForStorage) {
    case "Standard Plan":
      planInternal = "Standard Plan";
      break;
    case "Premium Plan":
      planInternal = "Premium Plan";
      break;
    default:
      return res.status(400).json({ message: "Invalid plan selected" });
  }

  // ✅ Add credits, don't overwrite
  admin.creditsAvailable += creditsToAdd;
  // ✅ Track total ever received (used by admin subscription overview)
  admin.creditsTotalReceived = (admin.creditsTotalReceived || 0) + creditsToAdd;

  // ✅ Update plan only if upgrading (Free → Standard, Standard → Premium)
  const plansOrder = { "Free Plan": 0, "Standard Plan": 1, "Premium Plan": 2 };
  if (plansOrder[planInternal] > plansOrder[admin.plan]) {
    admin.plan = planInternal;
  }

  admin.subscriptionStatus = "active";
  await admin.save();

  const payment = await Payment.create({
    schoolAdmin: admin._id,
    plan: planForStorage,
    orderId,
    amount: capturedAmount,
    currency,
    status: "COMPLETED",
    rawPayPalResponse: order,
    paymentMethod: order?.payer?.email_address || "paypal",
  });

  // ─── Generate PDF Invoice ──────────────────────────────────
  let invoiceId = null;
  let invoiceUrl = null;
  try {
    const invoiceResult = await generateAndUploadInvoice({
      userName: admin.name || "School Admin",
      userEmail: admin.email,
      planType: normalizeSchoolAdminPlanForClient(planForStorage),
      amount: capturedAmount,
      transactionId: order.id || "",
      orderId: orderId,
      date: new Date(),
      description: `${normalizeSchoolAdminPlanForClient(planForStorage)} - Student Licenses`,
      descriptionDetail: `Includes ${creditsToAdd} student credential licenses for your institution`,
    });
    invoiceId = invoiceResult.invoiceId;
    invoiceUrl = invoiceResult.pdfUrl;

    await Payment.findByIdAndUpdate(payment._id, { invoiceId, invoiceUrl });
  } catch (invErr) {
    console.error("⚠️ Failed to generate school admin invoice:", invErr.message);
  }

  // ─── Send confirmation email ────────────────────────────────
  try {
    await sendSchoolAdminPaymentConfirmationEmail({
      email: admin.email,
      name: admin.name || "School Admin",
      planType: normalizeSchoolAdminPlanForClient(planForStorage),
      amount: capturedAmount,
      creditsAdded: creditsToAdd,
      captureId: order.id || "",
      orderId: orderId,
      invoiceUrl,
    });
  } catch (emailErr) {
    console.error("⚠️ Failed to send school admin payment email:", emailErr.message);
  }

  res.status(200).json({
    message: `✅ ${normalizeSchoolAdminPlanForClient(planForStorage)} activated`,
    creditsAdded: creditsToAdd,
    totalCredits: admin.creditsAvailable,
    plan: normalizeSchoolAdminPlanForClient(admin.plan),
  });
});

const getPaymentHistory = asyncHandler(async (req, res) => {
  const adminId = req.schoolAdmin?._id;

  if (!adminId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const [admin, payments] = await Promise.all([
    SchoolAdmin.findById(adminId).lean(),
    Payment.find({ schoolAdmin: adminId }).sort({ createdAt: -1 }).lean(),
  ]);

  if (!admin) {
    return res.status(404).json({ message: "School admin not found" });
  }

  // Auto-generate missing invoices for COMPLETED payments
  const paymentsToGenerate = payments.filter((p) => p.status === "COMPLETED" && !p.invoiceUrl);
  for (const p of paymentsToGenerate) {
    try {
      const result = await generateAndUploadInvoice({
        userName: admin.name || "School Admin",
        userEmail: admin.email,
        planType: normalizeSchoolAdminPlanForClient(p.plan),
        amount: p.amount,
        transactionId: p.rawPayPalResponse?.id || "",
        orderId: p.orderId || "",
        date: p.createdAt || new Date(),
        description: `${normalizeSchoolAdminPlanForClient(p.plan)} - Student Licenses`,
        descriptionDetail: `Includes ${getCreditsForPlan(p.plan)} student credential licenses for your institution`,
      });
      await Payment.findByIdAndUpdate(p._id, {
        $set: { invoiceId: result.invoiceId, invoiceUrl: result.pdfUrl },
      });
      p.invoiceUrl = result.pdfUrl;
    } catch (err) {
      console.warn(`⚠️ Could not auto-generate invoice for school admin payment ${p._id}:`, err.message);
    }
  }

  const paymentHistory = payments.map((payment) => ({
    _id: payment._id,
    plan: normalizeSchoolAdminPlanForClient(payment.plan),
    orderId: payment.orderId,
    amount: payment.amount,
    currency: payment.currency || "USD",
    status: payment.status,
    creditsAdded: getCreditsForPlan(payment.plan),
    purchasedAt: payment.createdAt,
    invoiceUrl: payment.invoiceUrl,
  }));

  const totalCreditsPurchased = paymentHistory.reduce(
    (sum, payment) => sum + payment.creditsAdded,
    0
  );

  res.status(200).json({
    currentPlan: normalizeSchoolAdminPlanForClient(admin.plan),
    creditsAvailable: admin.creditsAvailable || 0,
    totalCreditsPurchased,
    totalPurchases: paymentHistory.length,
    payments: paymentHistory,
  });
});



module.exports = {
  subscribeToPlan,
  verifyPayPalOrder,
  getPaymentHistory,
};
