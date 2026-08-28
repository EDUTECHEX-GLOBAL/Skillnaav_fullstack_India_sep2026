const mongoose = require("mongoose");

const InternshipPaymentSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: "Student"
  },
  offerId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: "OfferLetter"
  },
  internshipId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: "Internship"
  },
  partnerId: { // ✅ New field for direct partner reference
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: "Partner"
  },
  paypalOrderId: {
    type: String,
    required: true,
    unique: true
  },
  paypalPaymentId: String,
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    required: true,
    default: 'USD',
    uppercase: true
  },
  status: {
    type: String,
    enum: ['CREATED', 'APPROVED', 'COMPLETED', 'FAILED', 'CANCELLED'],
    default: 'CREATED'
  },
  paypalDetails: {
    type: Object,
    default: {}
  },
  completedAt: Date,
  failedAt: Date,
  failureReason: String,
  invoiceId:  { type: String },
  invoiceUrl: { type: String },
}, { timestamps: true });

// ✅ Useful indexes
InternshipPaymentSchema.index({ studentId: 1, status: 1 });
InternshipPaymentSchema.index({ offerId: 1, studentId: 1 });
InternshipPaymentSchema.index({ partnerId: 1, status: 1 }); // ✅ Speeds up partner queries
InternshipPaymentSchema.index({ paypalPaymentId: 1 });

module.exports = mongoose.model("InternshipPayment", InternshipPaymentSchema);
