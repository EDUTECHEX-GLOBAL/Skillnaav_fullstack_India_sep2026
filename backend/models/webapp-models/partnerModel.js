//File: partnerModel.js

const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const partnerwebappSchema = mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },

    // 🔥 Password is optional for Google users
    password: { type: String, required: false },

    universityName: { type: String },
    institutionId: { type: String },

    profileImage: { type: String },
    logoUrl: {
      type: String,
      default: "",
    },

    // 🔥 Google OAuth fields
    googleId: { type: String, default: null },
    isGoogleUser: { type: Boolean, default: false },

    // Flag to track if Google partner still needs to fill institutional info
    needsProfileCompletion: { type: Boolean, default: false },

    adminApproved: { type: Boolean, default: false },

    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected"],
      default: "Pending",
    },

    planType: {
      type: String,
      enum: ["Freemium", "Premium Basic", "Premium Plus"],
      default: "Freemium",
    },
    isPremium: {
      type: Boolean,
      default: false,
    },
    premiumExpiration: {
      type: Date,
    },
    active: { type: Boolean, default: false },
    otp: String,
    otpExpiration: Date,
  },
  {
    timestamps: true,
  }
);

// Index to speed up expiry queries
partnerwebappSchema.index({ premiumExpiration: 1 });

// If you want to be explicit (email already has unique:true)
partnerwebappSchema.index({ email: 1 }, { unique: true });

// 🔥 PASSWORD HASHING — safe for Google users
partnerwebappSchema.pre("save", async function (next) {
  // Skip hashing if no password exists (Google users)
  if (!this.password) return next();

  // Hash only when password is modified
  if (!this.isModified("password")) return next();

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// 🔥 Compare hashed password (Google users skip this)
partnerwebappSchema.methods.matchPassword = async function (enteredPassword) {
  if (!this.password) return false; // Google users don't login via password
  return await bcrypt.compare(enteredPassword, this.password);
};

const Partnerwebapp = mongoose.model("Partnerwebapp", partnerwebappSchema);
module.exports = Partnerwebapp;