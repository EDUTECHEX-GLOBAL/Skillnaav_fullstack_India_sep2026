const mongoose = require("mongoose");

const partnerPaymentSchema = new mongoose.Schema(
  {
    partnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Partnerwebapp",
      required: true,
    },
    planType: {
      type: String,
      enum: ["Freemium", "Premium Basic", "Premium Plus"],
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    // FIX: Number instead of String — enables correct comparisons and aggregation
    amount: {
      type: Number,
      required: true,
    },
    paymentId: {
      type: String,
      required: true, // capture transaction ID (or "pending" before capture)
    },
    orderId: {
      type: String,
      required: true, // PayPal order ID — always distinct from paymentId
    },
    // FIX: Added "Refunded" to cover all real-world terminal states
    status: {
      type: String,
      enum: ["Pending", "Success", "Failed", "Refunded"],
      default: "Pending",
    },
    premiumExpiration: { type: Date },
    invoiceId:  { type: String },
    invoiceUrl: { type: String },
  },
  // FIX: Use timestamps:true for automatic createdAt + updatedAt
  { timestamps: true }
);

// FIX: Index on orderId for fast idempotency lookups
partnerPaymentSchema.index({ orderId: 1 }, { unique: true });
// FIX: Index on partnerId + createdAt for fast billing history queries
partnerPaymentSchema.index({ partnerId: 1, createdAt: -1 });

module.exports = mongoose.model("PartnerPayment", partnerPaymentSchema);