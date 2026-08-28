const express = require("express");
const router = express.Router();
const SuperAdminSettings = require("../../models/webapp-models/SuperAdminSettingsModel");
const User = require("../../models/webapp-models/userModel");
const { authenticate, authorizeAdmin } = require("../../middlewares/authMiddleware");

router.use(authenticate, authorizeAdmin);

const FEATURE_KEYS = ["studentReg", "partnerReg", "schoolReg", "aiShortlisting", "mockInterviews", "maintenanceMode", "requireAdminApproval"];
const DATA_SETTING_KEYS = ["automatedBackups", "strictDeviceLimits"];
const SECURITY_RULES = {
  sessionExpiry: [5, 1440],
  maxLoginAttempts: [1, 20],
  accountLockDuration: [1, 1440],
};

const pickBooleans = (value, keys) => Object.fromEntries(
  keys.filter((key) => typeof value?.[key] === "boolean").map((key) => [key, value[key]])
);

const escapeCsv = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;

// Export only the account fields that administrators need. Passwords, OTPs and
// other credentials are intentionally never selected or included in the CSV.
router.get("/export/users", async (req, res) => {
  try {
    const users = await User.find()
      .select("_id name email status adminApproved isActive planType createdAt")
      .sort({ createdAt: -1 })
      .lean();

    const headers = ["User ID", "Name", "Email", "Status", "Admin Approved", "Active", "Plan", "Registered At"];
    const rows = users.map((user) => [
      user._id,
      user.name,
      user.email,
      user.status,
      user.adminApproved,
      user.isActive,
      user.planType,
      user.createdAt ? new Date(user.createdAt).toISOString() : "",
    ].map(escapeCsv).join(","));

    const filename = `skillnaav-users-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.status(200).send([headers.map(escapeCsv).join(","), ...rows].join("\n"));
  } catch (error) {
    console.error("Error exporting users:", error);
    res.status(500).json({ message: "Unable to export user data." });
  }
});

// Get settings
router.get("/", async (req, res) => {
  try {
    let settings = await SuperAdminSettings.findOne();
    if (!settings) {
      // Create default if not exists
      settings = await SuperAdminSettings.create({});
    }
    res.status(200).json(settings);
  } catch (error) {
    console.error("Error fetching settings:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Update settings
router.put("/", async (req, res) => {
  try {
    let settings = await SuperAdminSettings.findOne();
    if (!settings) {
      settings = await SuperAdminSettings.create({});
    }

    const { platformFeatures, securitySettings, dataSettings, reason } = req.body;

    if (!platformFeatures && !securitySettings && !dataSettings && !req.body.brandingSettings && !req.body.notificationsSettings) {
      return res.status(400).json({ message: "No settings were provided." });
    }

    if (platformFeatures) {
      const updates = pickBooleans(platformFeatures, FEATURE_KEYS);
      const isSensitive = Object.entries(updates).some(([key, value]) =>
        key === "maintenanceMode"
          ? value !== settings.platformFeatures[key]
          : value === false && settings.platformFeatures[key] === true
      );
      if (isSensitive && (!reason || reason.trim().length < 10)) {
        return res.status(400).json({ message: "A reason of at least 10 characters is required for this change." });
      }
      Object.entries(updates).forEach(([key, value]) => {
        settings.platformFeatures[key] = value;
      });
      settings.markModified("platformFeatures");
    }
    
    if (securitySettings) {
      const updates = pickBooleans(securitySettings, ["forceLogout", "require2FA"]);
      for (const [key, [min, max]] of Object.entries(SECURITY_RULES)) {
        if (securitySettings[key] !== undefined) {
          const number = Number(securitySettings[key]);
          if (!Number.isInteger(number) || number < min || number > max) {
            return res.status(400).json({ message: `${key} must be a whole number between ${min} and ${max}.` });
          }
          updates[key] = number;
        }
      }
      settings.securitySettings.set(updates);
    }

    if (req.body.brandingSettings) {
      const { primaryColor, darkMode } = req.body.brandingSettings;
      if (primaryColor !== undefined) settings.brandingSettings.primaryColor = primaryColor;
      if (darkMode !== undefined) settings.brandingSettings.darkMode = Boolean(darkMode);
    }

    if (req.body.notificationsSettings) {
      const updates = pickBooleans(req.body.notificationsSettings, ["emailNotif", "smsAlerts", "weeklyDigest", "newSignups"]);
      Object.entries(updates).forEach(([key, value]) => {
        settings.notificationsSettings[key] = value;
      });
    }

    if (dataSettings) {
      const updates = pickBooleans(dataSettings, DATA_SETTING_KEYS);
      Object.entries(updates).forEach(([key, value]) => {
        settings.dataSettings[key] = value;
      });
      settings.markModified("dataSettings");
    }

    settings.lastUpdatedBy = req.user._id;
    settings.lastChangeReason = reason?.trim() || "";
    await settings.save();
    res.status(200).json(settings);
  } catch (error) {
    console.error("Error updating settings:", error);
    res.status(500).json({ message: "Unable to update settings." });
  }
});

module.exports = router;
