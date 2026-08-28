// File: AdminModel.js


const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Define the schema
const adminwebappsSchema = new mongoose.Schema({

  name: {
    type: String,
    required: true
  },

  email: {
    type: String,
    required: true,
    unique: true
  },

  password: {
    type: String,
    required: true
  },

  isAdmin: {
    type: Boolean,
    default: false
  },

  role: {
    type: String,
    default: "Support Admin"
  },

  status: {
    type: String,
    enum: ["Active", "Inactive", "Suspended"],
    default: "Active"
  },

  lastLogin: {
    type: Date
  },

  loginFailedAttempts: {
    type: Number,
    default: 0
  },

  loginLockedUntil: {
    type: Date,
    default: null
  },

  pic: {
    type: String,
    default: 'https://example.com/avatar.png'
  },

  resetPasswordOtpHash: {
    type: String,
    default: null
  },

  resetPasswordOtpExpires: {
    type: Date,
    default: null
  },

  // ✅ Login OTP (for entering dashboard after password)
  loginOtpHash: {
    type: String,
    default: null,
  },

  loginOtpExpires: {
    type: Date,
    default: null,
  },

}, {
  timestamps: true
});

// Method to compare passwords
adminwebappsSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Create the model using the schema and export it
module.exports = mongoose.model('adminwebapps', adminwebappsSchema);
