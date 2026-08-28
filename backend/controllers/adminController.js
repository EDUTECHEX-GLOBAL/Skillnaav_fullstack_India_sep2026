// File: adminController.js

const User = require("../models/webapp-models/adminModel");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const notifyUser = require("../utils/notifyUser");
const { generateOtpEmailHtml } = require("../utils/otpTemplate");
const SuperAdminSettings = require("../models/webapp-models/SuperAdminSettingsModel");

const securityDefaults = {
  sessionExpiry: 60,
  maxLoginAttempts: 5,
  accountLockDuration: 30,
  require2FA: true,
};

const getSecuritySettings = async () => {
  const settings = await SuperAdminSettings.findOne()
    .select("securitySettings")
    .lean();
  return { ...securityDefaults, ...(settings?.securitySettings || {}) };
};

const createAdminToken = (user, sessionExpiry) =>
  jwt.sign(
    { id: user._id, isAdmin: user.isAdmin },
    process.env.JWT_SECRET || "yoursecretkey",
    { expiresIn: `${sessionExpiry}m` },
  );

// Login Controller
// Login Controller (Step-1: Verify password + send OTP)
const loginUser = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    if (user.status && user.status !== "Active") {
      return res.status(403).json({
        message: "Your administrator account is suspended or inactive.",
      });
    }

    const securitySettings = await getSecuritySettings();
    if (user.loginLockedUntil && user.loginLockedUntil > new Date()) {
      return res.status(429).json({
        message:
          "Account is temporarily locked due to too many failed login attempts.",
      });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      const failedAttempts = (user.loginFailedAttempts || 0) + 1;
      user.loginFailedAttempts = failedAttempts;
      if (failedAttempts >= securitySettings.maxLoginAttempts) {
        user.loginLockedUntil = new Date(
          Date.now() + securitySettings.accountLockDuration * 60 * 1000,
        );
        user.loginFailedAttempts = 0;
      }
      await user.save();
      return res.status(401).json({ message: "Invalid email or password" });
    }

    user.loginFailedAttempts = 0;
    user.loginLockedUntil = null;

    if (!securitySettings.require2FA) {
      user.lastLogin = Date.now();
      await user.save();
      return res.status(200).json({
        id: user._id,
        name: user.name,
        email: user.email,
        isAdmin: user.isAdmin,
        pic: user.pic,
        token: createAdminToken(user, securitySettings.sessionExpiry),
      });
    }

    // ✅ Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // ✅ Hash OTP + store expiry (10 minutes)
    user.loginOtpHash = await bcrypt.hash(otp, 10);
    user.loginOtpExpires = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    // ✅ Respond immediately (no token yet)
    res.status(200).json({
      otpRequired: true,
      message: "OTP sent to your email.",
      email: user.email,
    });

    // ✅ Send OTP email in background
    setImmediate(async () => {
      try {
        await notifyUser(
          user.email,
          "SkillNaav Admin Login OTP",
          generateOtpEmailHtml(otp, "logging in to your admin account"),
        );
      } catch (err) {
        console.error("❌ Admin Login OTP email failed:", err.message || err);
      }
    });

    return;
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
};

// ✅ Forgot Password - Send OTP
const forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });

    // ✅ Always return same message (security best practice)
    if (!user) {
      return res
        .status(200)
        .json({ message: "If this email exists, OTP has been sent." });
    }

    const now = Date.now();

    // Check whether an OTP currently exists
    if (user.resetPasswordOtpExpires) {
      const expiryTime = new Date(user.resetPasswordOtpExpires).getTime();

      // OTP was originally created 10 minutes before expiry
      const otpCreatedAt = expiryTime - 10 * 60 * 1000;

      const elapsedTime = now - otpCreatedAt;

      // 60-second resend cooldown
      if (elapsedTime < 60 * 1000) {
        const remainingSeconds = Math.ceil((60 * 1000 - elapsedTime) / 1000);

        return res.status(429).json({
          message: `Please wait ${remainingSeconds} seconds before requesting another OTP.`,
          retryAfter: remainingSeconds,
        });
      }
    }
    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Hash OTP and store with expiry (10 minutes)
    const otpHash = await bcrypt.hash(otp, 10);
    user.resetPasswordOtpHash = otpHash;
    user.resetPasswordOtpExpires = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    // ✅ Respond immediately (fast)
    res.status(200).json({ message: "A new OTP has been sent to your email." });

    // ✅ Send email in background (do NOT block API response)
    setImmediate(async () => {
      try {
        await notifyUser(
          user.email,
          "SkillNaav Admin Password Reset OTP",
          generateOtpEmailHtml(otp, "resetting your admin password"),
        );
      } catch (err) {
        console.error("❌ Admin OTP email failed:", err.message || err);
      }
    });

    return;
  } catch (error) {
    // return res.status(500).json({ message: "Server error" });
    console.error("Forgot password error:", error);

    return res.status(500).json({
      message: "Server error",
    });
  }
};

// ✅ Reset Password - Verify OTP and Update Password (hashed)
const resetPassword = async (req, res) => {
  const { email, otp, newPassword } = req.body;

  try {
    const user = await User.findOne({ email });

    if (!user || !user.resetPasswordOtpHash || !user.resetPasswordOtpExpires) {
      return res
        .status(400)
        .json({ message: "Invalid request. Please try again." });
    }

    if (user.resetPasswordOtpExpires < new Date()) {
      return res
        .status(400)
        .json({ message: "OTP expired. Please request a new OTP." });
    }

    const isOtpMatch = await bcrypt.compare(otp, user.resetPasswordOtpHash);
    if (!isOtpMatch) {
      return res
        .status(400)
        .json({ message: "Invalid OTP. Please try again." });
    }

    // ✅ Hash new password and save to MongoDB
    user.password = await bcrypt.hash(newPassword, 10);

    // Clear OTP fields
    user.resetPasswordOtpHash = null;
    user.resetPasswordOtpExpires = null;

    await user.save();

    return res.status(200).json({ message: "Password updated successfully." });
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
};

// Resend Login OTP - 18-08-2026
const resendLoginOtp = async (req, res) => {
  const { email } = req.body;

  try {
    if (!email) {
      return res.status(400).json({
        message: "Email is required.",
      });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        message: "Administrator account not found.",
      });
    }

    if (user.status && user.status !== "Active") {
      return res.status(403).json({
        message: "Your administrator account is suspended or inactive.",
      });
    }

    // Prevent repeated resend requests within 60 seconds.
    // loginOtpExpires is set to 10 minutes from the time the OTP was created.
    const now = Date.now();
    const expiryTime = user.loginOtpExpires
      ? new Date(user.loginOtpExpires).getTime()
      : 0;

    const otpCreatedAt = expiryTime - 10 * 60 * 1000;

    if (expiryTime > now && now - otpCreatedAt < 60 * 1000) {
      const remainingSeconds = Math.ceil(
        (60 * 1000 - (now - otpCreatedAt)) / 1000,
      );

      return res.status(429).json({
        message: `Please wait ${remainingSeconds} seconds before requesting another OTP.`,
        retryAfter: remainingSeconds,
      });
    }

    // Generate a new 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Hash OTP and store new expiry
    user.loginOtpHash = await bcrypt.hash(otp, 10);
    user.loginOtpExpires = new Date(Date.now() + 10 * 60 * 1000);

    await user.save();

    // Respond immediately
    res.status(200).json({
      message: "A new OTP has been sent to your email.",
    });

    // Send email in background
    setImmediate(async () => {
      try {
        await notifyUser(
          user.email,
          "SkillNaav Admin Login OTP",
          generateOtpEmailHtml(otp, "logging in to your admin account"),
        );
      } catch (err) {
        console.error(
          "❌ Admin Resend Login OTP email failed:",
          err.message || err,
        );
      }
    });
  } catch (error) {
    console.error("Resend login OTP error:", error);

    return res.status(500).json({
      message: "Unable to resend OTP. Please try again.",
    });
  }
};

// ✅ Verify Login OTP (Step-2: Verify OTP + return token)
const verifyLoginOtp = async (req, res) => {
  const { email, otp } = req.body;

  try {
    const user = await User.findOne({ email });

    if (!user || !user.loginOtpHash || !user.loginOtpExpires) {
      return res
        .status(400)
        .json({ message: "OTP not requested. Please login again." });
    }

    // Re-check status because an account could have been suspended after its
    // OTP was issued but before it was verified.
    if (user.status && user.status !== "Active") {
      user.loginOtpHash = null;
      user.loginOtpExpires = null;
      await user.save();
      return res.status(403).json({
        message: "Your administrator account is suspended or inactive.",
      });
    }

    if (user.loginOtpExpires < new Date()) {
      user.loginOtpHash = null;
      user.loginOtpExpires = null;
      await user.save();
      return res
        .status(400)
        .json({ message: "OTP expired. Please login again." });
    }

    const isOtpMatch = await bcrypt.compare(otp, user.loginOtpHash);
    if (!isOtpMatch) {
      return res
        .status(400)
        .json({ message: "Invalid OTP. Please try again." });
    }

    // ✅ Clear OTP after successful verification and update lastLogin
    user.loginOtpHash = null;
    user.loginOtpExpires = null;
    user.lastLogin = Date.now();
    await user.save();

    // ✅ Generate JWT Token (same as your old login response)
    // Generate JWT Token

    const securitySettings = await getSecuritySettings();
    const token = createAdminToken(user, securitySettings.sessionExpiry);

    return res.status(200).json({
      id: user._id,
      name: user.name,
      email: user.email,
      isAdmin: user.isAdmin,
      pic: user.pic,
      token,
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
};

// ✅ Request OTP for Change Password (Authenticated)
const requestChangePasswordOtp = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "Admin not found." });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.resetPasswordOtpHash = await bcrypt.hash(otp, 10);
    user.resetPasswordOtpExpires = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    res.status(200).json({ message: "OTP sent to your email." });

    setImmediate(async () => {
      try {
        await notifyUser(
          user.email,
          "SkillNaav Security: Password Change OTP",
          generateOtpEmailHtml(otp, "changing your admin password"),
        );
      } catch (err) {
        console.error(
          "❌ Admin Change Password OTP email failed:",
          err.message || err,
        );
      }
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// ✅ Change Password (Authenticated)
const changePassword = async (req, res) => {
  const { otp, newPassword } = req.body;
  try {
    if (typeof newPassword !== "string" || newPassword.length < 8) {
      return res
        .status(400)
        .json({ message: "Password must be at least 8 characters." });
    }

    const user = await User.findById(req.user._id);
    if (!user || !user.resetPasswordOtpHash || !user.resetPasswordOtpExpires) {
      return res.status(400).json({ message: "OTP not requested or invalid." });
    }

    if (user.resetPasswordOtpExpires < new Date()) {
      return res
        .status(400)
        .json({ message: "OTP expired. Please request a new one." });
    }

    const isOtpMatch = await bcrypt.compare(otp, user.resetPasswordOtpHash);
    if (!isOtpMatch) {
      return res
        .status(400)
        .json({ message: "Invalid OTP. Please try again." });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    user.resetPasswordOtpHash = null;
    user.resetPasswordOtpExpires = null;
    await user.save();

    res.status(200).json({ message: "Password updated successfully." });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  loginUser,
  verifyLoginOtp,
  resendLoginOtp, //18-08-2026
  forgotPassword,
  resetPassword,
  requestChangePasswordOtp,
  changePassword,
};
//chnages
//chnanges
