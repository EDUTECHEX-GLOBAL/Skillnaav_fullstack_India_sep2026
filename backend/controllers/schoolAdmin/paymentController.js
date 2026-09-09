const asyncHandler = require("express-async-handler");
const Payment = require("../../models/webapp-models/schoolAdmin/SchoolAdminPayment");
const SchoolAdmin = require("../../models/webapp-models/schoolAdmin/SchoolAdminModel");
const crypto = require("crypto");
const Razorpay = require("razorpay");
const { generateAndUploadInvoice } = require("../../services/invoiceGenerator");
const { sendSchoolAdminPaymentConfirmationEmail } = require("../../utils/emailService");

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

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

const createRazorpayOrder = asyncHandler(async (req, res) => {
  const { plan } = req.body;
  const adminId = req.schoolAdmin?._id;

  if (!adminId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const planForStorage = normalizeSchoolAdminPlanForStorage(plan);
  
  let amount = 0;
  if (planForStorage === "Standard Plan") amount = 849;
  else if (planForStorage === "Premium Plan") amount = 2100;
  else return res.status(400).json({ message: "Invalid plan selected" });

  try {
    const options = {
      amount: Math.round(amount * 100), // paise
      currency: "INR",
      receipt: `schooladmin_${adminId}`,
    };

    const order = await razorpay.orders.create(options);
    res.json({ success: true, id: order.id, amount: options.amount, currency: options.currency });
  } catch (error) {
    console.error("❌ Error creating Razorpay order:", error);
    res.status(500).json({ message: "Failed to create order" });
  }
});

const verifyRazorpayPayment = asyncHandler(async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan } = req.body;
  const adminId = req.schoolAdmin?._id;

  const admin = await SchoolAdmin.findById(adminId);
  if (!admin) return res.status(401).json({ message: "Unauthorized" });

  const body = razorpay_order_id + "|" + razorpay_payment_id;
  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(body.toString())
    .digest("hex");

  if (expectedSignature !== razorpay_signature) {
    return res.status(400).json({ message: "Invalid signature" });
  }

  const planForStorage = normalizeSchoolAdminPlanForStorage(plan);
  const creditsToAdd = getCreditsForPlan(planForStorage);
  
  let planInternal;
  let amount = 0;
  switch (planForStorage) {
    case "Standard Plan":
      planInternal = "Standard Plan";
      amount = 849;
      break;
    case "Premium Plan":
      planInternal = "Premium Plan";
      amount = 2100;
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
    orderId: razorpay_order_id,
    amount,
    currency: "INR",
    status: "COMPLETED",
    rawRazorpayResponse: { id: razorpay_payment_id }, // keeping the structure similar for frontend/backend
    paymentMethod: "razorpay",
  });

  // ─── Generate PDF Invoice ──────────────────────────────────
  let invoiceId = null;
  let invoiceUrl = null;
  try {
    const invoiceResult = await generateAndUploadInvoice({
      userName: admin.name || "School Admin",
      userEmail: admin.email,
      planType: normalizeSchoolAdminPlanForClient(planForStorage),
      amount,
      transactionId: razorpay_payment_id || "",
      orderId: razorpay_order_id,
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
      amount,
      creditsAdded: creditsToAdd,
      captureId: razorpay_payment_id || "",
      orderId: razorpay_order_id,
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
        transactionId: p.rawRazorpayResponse?.id || "",
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
    currency: payment.currency || "INR",
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
  createRazorpayOrder,
  verifyRazorpayPayment,
  getPaymentHistory,
};
