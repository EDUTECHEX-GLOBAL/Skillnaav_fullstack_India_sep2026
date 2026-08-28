const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const schoolAdminSchema = new mongoose.Schema(
  {
    schoolName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String }, // Made optional for Google login
    googleId: { type: String },
    isGoogleUser: { type: Boolean, default: false },

    isApproved: { type: Boolean, default: false },

    plan: {
      type: String,
      enum: ["Free Plan", "Standard Plan", "Premium Plan"],
      default: "Free Plan",
    },

    creditsAvailable: { type: Number, default: 50 },
    creditsTotalReceived: { type: Number, default: 50 },
    creditsUsed: { type: Number, default: 0 },

    subscriptionStatus: {
      type: String,
      enum: ["inactive", "active"],
      default: "inactive",
    },

    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date },

    otp: { type: String },
    otpExpiration: { type: Date },

    profile: {
      affiliation: { type: String },
      address: { type: String },
      city: { type: String },
      province: { type: String },
      postalCode: { type: String },
      country: { type: String },
      website: { type: String },
      contactPerson: { type: String },
      contactEmail: { type: String },
      contactPhone: { type: String },
      schoolType: {
        type: String,
        enum: ["Public", "Catholic", "Private", "Charter"],
      },
      schoolNumber: { type: String },
      languageOfInstruction: {
        type: String,
        enum: ["English", "French", "Bilingual"],
      },
      verificationDoc: { type: String },
    },

    lastPaymentDate: { type: Date },
    lastLogin: { type: Date },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "AdminUser" },
  },
  { timestamps: true }
);

// ✅ Password hashing middleware
schoolAdminSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// ✅ Password check method
schoolAdminSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const SchoolAdmin =
  mongoose.models.SchoolAdmin ||
  mongoose.model("SchoolAdmin", schoolAdminSchema);

module.exports = SchoolAdmin;