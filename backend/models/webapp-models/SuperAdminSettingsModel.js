const mongoose = require("mongoose");

const SuperAdminSettingsSchema = new mongoose.Schema(
  {
    platformFeatures: {
      studentReg: { type: Boolean, default: true },
      partnerReg: { type: Boolean, default: true },
      schoolReg: { type: Boolean, default: false },
      aiShortlisting: { type: Boolean, default: true },
      mockInterviews: { type: Boolean, default: true },
      maintenanceMode: { type: Boolean, default: false },
      requireAdminApproval: { type: Boolean, default: true },
    },
    securitySettings: {
      sessionExpiry: { type: Number, default: 60 },
      forceLogout: { type: Boolean, default: true },
      maxLoginAttempts: { type: Number, default: 5 },
      accountLockDuration: { type: Number, default: 30 },
      require2FA: { type: Boolean, default: true },
    },
    brandingSettings: {
      primaryColor: { type: String, default: "#0d9488" },
      darkMode: { type: Boolean, default: false },
    },
    notificationsSettings: {
      emailNotif: { type: Boolean, default: true },
      smsAlerts: { type: Boolean, default: false },
      weeklyDigest: { type: Boolean, default: true },
      newSignups: { type: Boolean, default: true },
    },
    dataSettings: {
      automatedBackups: { type: Boolean, default: true },
      strictDeviceLimits: { type: Boolean, default: false },
    },
    lastUpdatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "adminwebapps" },
    lastChangeReason: { type: String, trim: true, maxlength: 500, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("SuperAdminSettings", SuperAdminSettingsSchema);
