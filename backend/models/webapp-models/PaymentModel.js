const mongoose = require("mongoose");

const PaymentSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    email: { type: String, required: true },
    planType: { type: String, required: true },
    amount: { type: Number, required: true },
    paymentId: { type: String, required: true },   // Capture transaction ID (or "pending" before capture)
    orderId: { type: String, required: true },     // PayPal order ID
    // FIX: Added "Failed" and "Refunded" to cover all real-world terminal states
    status: {
      type: String,
      enum: ["Pending", "Success", "Failed", "Refunded"],
      default: "Pending",
    },
    premiumExpiration: { type: Date },
    invoiceId: { type: String },
    invoiceUrl: { type: String },
  },
  { timestamps: true }
);

// FIX: Unique index on orderId for strong idempotency guarantees
// NOTE: unique index prevents duplicate order documents for the same PayPal orderId
PaymentSchema.index({ orderId: 1 }, { unique: true });
// FIX: Index on userId for fast payment history queries
PaymentSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model("Payment", PaymentSchema);