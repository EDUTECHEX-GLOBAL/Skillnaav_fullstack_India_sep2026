// controllers/internshipPaymentController.js
const Payment = require('../models/webapp-models/internshipPaymentModel');
const OfferLetter = require('../models/webapp-models/offerLetterModel');
const mongoose = require('mongoose');
const Internship = require('../models/webapp-models/internshipPostModel');
const Partner = require('../models/webapp-models/partnerModel');
const Student = require('../models/webapp-models/userModel');
const axios = require('axios');

const { generateAndUploadInvoice } = require('../services/invoiceGenerator');
const { sendInternshipPaymentConfirmationEmail } = require('../utils/emailService');
const Razorpay = require('razorpay');
const crypto = require('crypto');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const getAuthenticatedStudentId = (req, res) => {
  if (req.user?.role !== 'user') {
    res.status(403).json({ error: 'Only students can pay for internships' });
    return null;
  }
  return req.user._id;
};

// ─── Create Razorpay Order ───────────────────────────────────────────────────────
const createRazorpayOrder = async (req, res) => {
  try {
    const { internshipId, offerId } = req.body;
    const studentId = getAuthenticatedStudentId(req, res);
    if (!studentId) return;

    if (!internshipId || !offerId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const [internship, offer] = await Promise.all([
      Internship.findById(internshipId).select('partnerId internshipType compensationDetails'),
      OfferLetter.findById(offerId).select('studentId internshipId status'),
    ]);
    if (!internship) {
      return res.status(404).json({ error: 'Internship not found' });
    }

    if (!offer || String(offer.studentId) !== String(studentId) || String(offer.internshipId) !== String(internshipId)) {
      return res.status(403).json({ error: 'This offer does not belong to the current student' });
    }

    if (offer.status !== 'Sent' || internship.internshipType !== 'PAID') {
      return res.status(400).json({ error: 'This offer is not eligible for payment' });
    }

    const amount = Number(internship.compensationDetails?.amount);
    const currency = String(internship.compensationDetails?.currency || 'INR').toUpperCase();
    if (!Number.isFinite(amount) || amount <= 0 || !/^[A-Z]{3}$/.test(currency)) {
      return res.status(400).json({ error: 'The internship payment amount or currency is invalid' });
    }

    if (!internship.partnerId) {
      return res.status(400).json({ error: 'Internship is missing partnerId' });
    }

    const options = {
      amount: Math.round(amount * 100), // amount in smallest currency unit
      currency,
      receipt: `receipt_${offerId}`,
    };

    const order = await razorpay.orders.create(options);

    const payment = new Payment({
      studentId,
      offerId,
      internshipId,
      partnerId: internship.partnerId,
      razorpayOrderId: order.id,
      amount: parseFloat(amount),
      currency,
      status: 'CREATED',
    });

    await payment.save();

    res.status(201).json({
      success: true,
      orderId: order.id,
      paymentId: payment._id,
      amount: options.amount,
      currency: options.currency,
    });
  } catch (error) {
    console.error('Error creating Razorpay order:', error);
    res.status(500).json({ error: 'Failed to create payment order', details: error.message });
  }
};

// ─── Verify Razorpay Payment ────────────────────────────────────────────────────
const verifyRazorpayPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, offerId } = req.body;
    const studentId = getAuthenticatedStudentId(req, res);
    if (!studentId) return;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !offerId) {
      return res.status(400).json({ error: 'Missing required fields for payment verification' });
    }

    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ error: 'Invalid signature. Payment verification failed.' });
    }

    const existingPayment = await Payment.findOne({ razorpayOrderId: razorpay_order_id, studentId, offerId });
    if (!existingPayment) {
      return res.status(404).json({ error: 'Payment record not found' });
    }
    
    if (existingPayment.status === 'COMPLETED') {
      return res.status(200).json({
        success: true,
        paymentId: existingPayment._id,
        razorpayPaymentId: existingPayment.razorpayPaymentId,
        status: existingPayment.status,
        amount: existingPayment.amount,
        currency: existingPayment.currency,
      });
    }

    const payment = await Payment.findOneAndUpdate(
      { razorpayOrderId: razorpay_order_id, studentId },
      {
        status: 'COMPLETED',
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature,
        completedAt: new Date(),
      },
      { new: true }
    );

    if (!payment) {
      return res.status(404).json({ error: 'Payment record not found after verification' });
    }

    // ─── Fetch student + internship info for email & invoice ───────────────
    let studentDoc = null;
    let internshipDoc = null;
    try {
      studentDoc    = await Student.findById(payment.studentId).select('name email');
      internshipDoc = await Internship.findById(payment.internshipId).select('jobTitle companyName startDate');
    } catch (lookupErr) {
      console.warn('⚠️ Could not fetch student/internship for invoice:', lookupErr.message);
    }

    // ─── Generate PDF Invoice (non-fatal) ──────────────────────────────────
    let invoiceId  = null;
    let invoiceUrl = null;
    if (studentDoc && internshipDoc) {
      try {
        const invoiceResult = await generateAndUploadInvoice({
          userName:          studentDoc.name || 'Student',
          userEmail:         studentDoc.email,
          planType:          internshipDoc.jobTitle || 'Paid Internship',
          amount:            payment.amount,
          transactionId:     razorpay_payment_id,
          orderId:           razorpay_order_id,
          date:              new Date(),
          description:       `${internshipDoc.jobTitle} at ${internshipDoc.companyName}`,
          descriptionDetail: `Paid internship fee — Internship ID: ${payment.internshipId}`,
        });
        invoiceId  = invoiceResult.invoiceId;
        invoiceUrl = invoiceResult.pdfUrl;

        // Save invoice fields back to the payment record
        await Payment.findByIdAndUpdate(payment._id, { invoiceId, invoiceUrl });
      } catch (invErr) {
        console.error('⚠️ Failed to generate internship invoice:', invErr.message);
      }
    }

    // ─── Send confirmation email to student (non-fatal) ───────────────────
    if (studentDoc && internshipDoc) {
      try {
        await sendInternshipPaymentConfirmationEmail({
          email:           studentDoc.email,
          name:            studentDoc.name || 'Student',
          internshipTitle: internshipDoc.jobTitle || 'Internship',
          companyName:     internshipDoc.companyName || 'Company',
          amount:          payment.amount,
          currency:        payment.currency || 'INR',
          razorpayPaymentId: razorpay_payment_id,
          razorpayOrderId:   razorpay_order_id,
          startDate:       internshipDoc.startDate,
          offerId:         payment.offerId?.toString() || '',
          invoiceUrl,
        });
      } catch (emailErr) {
        console.error('⚠️ Failed to send internship payment email:', emailErr.message);
      }
    }

    res.status(200).json({
      success: true,
      paymentId: payment._id,
      razorpayPaymentId: razorpay_payment_id,
      status: 'COMPLETED',
      amount: payment.amount,
      currency: payment.currency,
    });
  } catch (error) {
    console.error('Error verifying Razorpay payment:', error);

    if (req.body.razorpay_order_id) {
      try {
        await Payment.findOneAndUpdate(
          { razorpayOrderId: req.body.razorpay_order_id },
          {
            status: 'FAILED',
            failureReason: error.message,
            failedAt: new Date(),
          }
        );
      } catch (updateError) {
        console.error('Error updating failed payment:', updateError);
      }
    }

    res.status(500).json({
      error: 'Failed to verify payment',
      details: error.message,
    });
  }
};

// ─── Get Payment Status ────────────────────────────────────────────────────────
const getPaymentStatus = async (req, res) => {
  try {
    const { offerId } = req.params;
    const studentId = getAuthenticatedStudentId(req, res);
    if (!studentId) return;

    const payment = await Payment.findOne({ offerId, studentId, status: 'COMPLETED' });

    res.json({
      paid: !!payment,
      paymentId: payment?._id,
      amount: payment?.amount,
      currency: payment?.currency,
      paymentDate: payment?.completedAt || payment?.updatedAt,
      razorpayPaymentId: payment?.razorpayPaymentId,
    });
  } catch (error) {
    console.error('Error getting payment status:', error);
    res.status(500).json({ error: 'Failed to get payment status' });
  }
};

// ─── Get All Payments for Student ─────────────────────────────────────────────
const getStudentPayments = async (req, res) => {
  try {
    const { studentId } = req.params;

    const payments = await Payment.find({ studentId })
      .populate('offerId', 'position companyName')
      .populate('internshipId', 'jobTitle companyName')
      .sort({ createdAt: -1 });

    res.json({ success: true, payments });
  } catch (error) {
    console.error('Error getting student payments:', error);
    res.status(500).json({ error: 'Failed to get payment history' });
  }
};

// ─── Admin: Payment Summary for a Specific Internship ─────────────────────────
const getPaymentsForInternship = async (req, res) => {
  try {
    const { internshipId } = req.params;

    if (!internshipId) {
      return res.status(400).json({ error: 'Internship ID is required' });
    }

    const result = await Payment.aggregate([
      { $match: { internshipId: new mongoose.Types.ObjectId(internshipId), status: 'COMPLETED' } },
      { $group: { _id: '$internshipId', totalPayments: { $sum: 1 }, totalAmount: { $sum: '$amount' } } },
      { $lookup: { from: 'internships', localField: '_id', foreignField: '_id', as: 'internshipDetails' } },
      { $unwind: { path: '$internshipDetails', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          internshipId: '$_id',
          internshipTitle: '$internshipDetails.jobTitle',
          companyName: '$internshipDetails.companyName',
          totalPayments: 1,
          totalAmount: 1,
        }
      }
    ]);

    res.json({ success: true, data: result[0] || { totalPayments: 0, totalAmount: 0 } });
  } catch (error) {
    console.error('Error fetching internship payment summary:', error);
    res.status(500).json({ error: 'Failed to fetch internship payment summary' });
  }
};

// ─── Admin: Payment Summary for All Internships of a Partner ──────────────────
const getPaymentsForPartner = async (req, res) => {
  try {
    const { partnerId } = req.params;

    if (!partnerId) {
      return res.status(400).json({ error: 'Partner ID is required' });
    }

    const result = await Payment.aggregate([
      { $match: { partnerId: new mongoose.Types.ObjectId(partnerId), status: 'COMPLETED' } },
      { $group: { _id: '$partnerId', totalPayments: { $sum: 1 }, totalAmount: { $sum: '$amount' } } },
      { $project: { _id: 0, partnerId: '$_id', totalPayments: 1, totalAmount: 1 } }
    ]);

    res.json({ success: true, data: result[0] || { totalPayments: 0, totalAmount: 0 } });
  } catch (error) {
    console.error('Error fetching partner payment summary:', error);
    res.status(500).json({ error: 'Failed to fetch partner payment summary' });
  }
};

// ─── Admin: Detailed Payment List for a Specific Internship ───────────────────
const getPaymentsListForInternship = async (req, res) => {
  try {
    const { internshipId } = req.params;

    if (!internshipId) {
      return res.status(400).json({ error: "Internship ID is required" });
    }

    const payments = await Payment.find({
      internshipId: new mongoose.Types.ObjectId(internshipId),
      status: "COMPLETED",
    })
      .populate({ path: "studentId", select: "name email", model: Student })
      .populate({ path: "offerId", select: "position", model: OfferLetter })
      .sort({ createdAt: -1 });

    res.json({ success: true, count: payments.length, payments });
  } catch (error) {
    console.error("Error fetching payments list for internship:", error.message);
    res.status(500).json({ error: "Failed to fetch payments list" });
  }
};

// ─── NEW: Detailed Payment List for a Partner (all internships) ────────────────
// Used by the partner-facing InternshipPayments.jsx dashboard tab.
// Returns ALL payments (all statuses by default) for the given partnerId,
// with student info and internship info populated — ready to be grouped
// by internship on the frontend.
const getPaymentsForPartnerDetailed = async (req, res) => {
  try {
    const { partnerId } = req.params;

    if (!partnerId) {
      return res.status(400).json({ error: "Partner ID is required" });
    }

    // Optional status filter via query param, e.g. ?status=COMPLETED
    // If not provided, returns all statuses so the frontend can filter
    const { status } = req.query;
    const matchQuery = { partnerId: new mongoose.Types.ObjectId(partnerId) };
    if (status) matchQuery.status = status;

    const payments = await Payment.find(matchQuery)
      .populate({
        path: "studentId",
        select: "name email profileImage",
        model: Student,
      })
      .populate({
        path: "internshipId",
        select: "jobTitle companyName internshipType location",
        model: Internship,
      })
      .populate({
        path: "offerId",
        select: "position",
        model: OfferLetter,
      })
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: payments.length,
      payments,
    });
  } catch (error) {
    console.error("Error fetching detailed partner payments:", error.message);
    res.status(500).json({ error: "Failed to fetch partner payment details" });
  }
};

// ─── Exports ──────────────────────────────────────────────────────────────────
module.exports = {
  createRazorpayOrder,
  verifyRazorpayPayment,
  getPaymentStatus,
  getStudentPayments,
  getPaymentsForInternship,
  getPaymentsForPartner,
  getPaymentsListForInternship,
  getPaymentsForPartnerDetailed, // ✅ New — partner dashboard payments tab
};
