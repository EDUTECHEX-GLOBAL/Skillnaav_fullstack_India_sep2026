const mongoose = require("mongoose");

const schoolAdminPaymentSchema = new mongoose.Schema(
  {
    schoolAdmin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SchoolAdmin",
      required: true,
    },
    plan: {
      type: String,
      enum: ["Free Plan", "Standard Plan", "Premium Plan"],
      required: true,
    },
    orderId: {
      type: String,
      required: true,
      unique: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: "USD",
    },
    status: {
      type: String,
      enum: ["PENDING", "COMPLETED", "FAILED"],
      default: "PENDING",
    },
    paymentMethod: {
      type: String,
      default: "paypal",
    },
    rawPayPalResponse: {
      type: Object,
    },
    invoiceId: {
      type: String,
    },
    invoiceUrl: {
      type: String,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("SchoolAdminPayment", schoolAdminPaymentSchema);
