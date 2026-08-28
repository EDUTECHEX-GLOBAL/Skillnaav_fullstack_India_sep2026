//File: internshipPostModel.js

const mongoose = require("mongoose");

const internshipPostingSchema = new mongoose.Schema(
  {
    jobTitle: { type: String, required: true },
    companyName: { type: String, required: true },
    location: { type: String, required: true },

    /**
 * Normalized location fields (US/CA only)
 * Kept alongside the legacy `location` string for backward compatibility.
 */
    country: {
      type: String,
      enum: ["United States", "Canada"],
      required: true
    },
    state: { type: String, required: true },
    city: { type: String, required: true },

    jobDescription: { type: String, required: true },

    startDate: { type: Date, required: true },
    endDateOrDuration: { type: String, required: true },
    duration: { type: String, required: true },

    sector: {
      type: String,
      enum: [
        "advanced-ai",
        "quantum-computing",
        "climate-tech",
        "biotech",
        "materials-science",
        "space-exploration",
        "neurotechnology",
        "precision-agriculture",
        "advanced-robotics",
        "renewable-energy",
        "architecture-built-environment"
      ],
      required: true,
    },

    internshipType: {
      type: String,
      enum: ["FREE", "STIPEND", "PAID"],
      required: true,
    },

    internshipMode: {
      type: String,
      enum: ["OFFLINE", "ONLINE", "HYBRID"],
      default: "ONLINE",
      required: true,
    },

    // 🔹 New field for Internship Classification
    classification: {
      type: String,
      enum: ["Basic", "Intermediate", "Advanced"],
      required: true,
    },

    compensationDetails: {
      type: {
        type: String,
        enum: ["FREE", "STIPEND", "PAID"],
        required: true,
      },
      amount: { type: Number },
      currency: { type: String },
      frequency: { type: String, enum: ["MONTHLY", "WEEKLY", "ONE_TIME"] },
      benefits: { type: [String] },
      additionalCosts: [
        {
          description: { type: String },
          amount: { type: Number },
          currency: { type: String },
        },
      ],
    },

    partnerId: { type: mongoose.Schema.Types.ObjectId, ref: "Partner", required: true },
    qualifications: { type: [String], required: true },

    contactInfo: {
      name: { type: String, required: true },
      email: { type: String, required: true },
      phone: { type: String, required: true },
    },

    imgUrl: { type: String, default: "https://default-image-url.com/image.png" },

    studentApplied: { type: Boolean, default: false },

    // ─── Single source of truth for admin workflow ────────────────────────
    // "pending"   → freshly posted, admin hasn't touched it yet
    // "in_review" → admin opened chat / started reviewing
    // "approved"  → admin approved (visible to students)
    // "rejected"  → admin rejected (hidden from students, reason stored below)
    adminStatus: {
      type: String,
      enum: ["pending", "in_review", "approved", "rejected"],
      default: "pending",
    },
    rejectionReason: { type: String, default: "" },

    // Legacy booleans kept for backward-compatibility with existing documents.
    // New code should read/write adminStatus; these are derived on save via pre-save hook.
    adminApproved: { type: Boolean, default: false },
    adminReviewed: { type: Boolean, default: false },
    deleted: { type: Boolean, default: false },
    deletedBy: {
      type: String,
      enum: ["admin", "partner"],
      default: null,
    },

    // New field to control application open/close status
    applicationOpen: { type: Boolean, default: true },
  },
  {
    versionKey: false,
    timestamps: true,
  }
);

// ─── Keep legacy booleans in sync with adminStatus ───────────────────────────
// This means old admin/partner code that reads adminApproved / adminReviewed
// continues to work correctly without any changes.
//changes
internshipPostingSchema.pre("save", function (next) {
  this.adminApproved = this.adminStatus === "approved";
  this.adminReviewed = this.adminStatus === "in_review" || this.adminStatus === "approved" || this.adminStatus === "rejected";
  next();
});

// Also sync on findOneAndUpdate / findByIdAndUpdate
internshipPostingSchema.pre(["findOneAndUpdate", "updateOne", "updateMany"], function (next) {
  const update = this.getUpdate();
  const set = update.$set || {};

  if (set.adminStatus !== undefined) {
    set.adminApproved = set.adminStatus === "approved";
    set.adminReviewed = ["in_review", "approved", "rejected"].includes(set.adminStatus);
    update.$set = set;
    this.setUpdate(update);
  }
  next();
});

module.exports = mongoose.model("InternshipPosting", internshipPostingSchema);
