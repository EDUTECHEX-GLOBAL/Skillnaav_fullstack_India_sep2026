const asyncHandler = require("express-async-handler");
const Partnerwebapp = require("../models/webapp-models/partnerModel");
const generateToken = require("../utils/generateToken");
const notifyUser = require("../utils/notifyUser");
const { generateOtpEmailHtml } = require("../utils/otpTemplate");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const PartnerEmailVerification = require("../models/webapp-models/partnerVerificationModel");
const { OAuth2Client } = require("google-auth-library"); // 🔥 NEW: Google OAuth client
const Userwebapp = require("../models/webapp-models/userModel");
const SchoolAdmin = require("../models/webapp-models/schoolAdmin/SchoolAdminModel");

// 🔥 NEW: Initialize Google OAuth client (same Client ID used in the frontend)
const googleClient = new OAuth2Client(process.env.GOOGLE_SIGNUP_CLIENT_ID);

// Helper function to check required fields (not used in provided logic but kept for completeness)
const areFieldsFilled = (fields) => fields.every((field) => field);

// Generate a random OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString(); // Generates a 6-digit OTP
};

// ------------------------------------
// 🎯 PUBLIC/AUTHENTICATION ENDPOINTS
// ------------------------------------

// Check if email exists
const checkEmailExists = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    res.status(400);
    throw new Error("Email is required.");
  }

  const partnerExists = await Partnerwebapp.findOne({ email });
  const userExists = await Userwebapp.findOne({ email });
  const schoolAdminExists = await SchoolAdmin.findOne({ email });

  res.json({ exists: !!partnerExists || !!userExists || !!schoolAdminExists });
});

// Send OTP for partner signup
const sendPartnerVerificationCode = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400);
    throw new Error("Invalid email address.");
  }

  const existing = await Partnerwebapp.findOne({ email });
  const existingUser = await Userwebapp.findOne({ email });
  const existingSchoolAdmin = await SchoolAdmin.findOne({ email });
  if (existing || existingUser || existingSchoolAdmin) {
    res.status(400);
    throw new Error("Email already registered.");
  }

  const otp = generateOTP();
  const otpExpiration = Date.now() + 10 * 60 * 1000; // OTP valid for 10 minutes

  // Store OTP in separate verification model
  await PartnerEmailVerification.findOneAndUpdate(
    { email },
    { otp, otpExpiration },
    { upsert: true, new: true },
  );

  await notifyUser(
    email,
    "SkillNaav Partner Email Verification Code",
    generateOtpEmailHtml(otp, "creating your SkillNaav partner account"),
  );

  res.status(200).json({ message: "Verification code sent to email." });
});

// Verify OTP
const verifyPartnerOTP = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;

  const record = await PartnerEmailVerification.findOne({ email });

  if (!record || record.otp !== otp || Date.now() > record.otpExpiration) {
    res.status(400);
    throw new Error("Invalid or expired OTP.");
  }

  // Delete the record after verification
  await PartnerEmailVerification.deleteOne({ email });

  res.status(200).json({ success: true, message: "OTP verified" });
});

// Register a new partner (Handles Multer file upload)
const registerPartner = asyncHandler(async (req, res) => {
  // Text fields from req.body
  const {
    name,
    email,
    password,
    confirmPassword,
    universityName,
    institutionId,
  } = req.body;

  // File object from req.file (Requires Multer middleware on the route)
  const profileImageFile = req.file;

  // 1. Check for required text fields
  if (
    !name ||
    !email ||
    !password ||
    !confirmPassword ||
    !universityName ||
    !institutionId
  ) {
    res.status(400);
    throw new Error("Please fill all required text fields.");
  }

  // 2. Check for required file upload
  if (!profileImageFile) {
    res.status(400);
    throw new Error("Profile picture file is required.");
  }

  // 3. Check if passwords match
  if (password !== confirmPassword) {
    res.status(400);
    throw new Error("Passwords do not match.");
  }

  // 4. Check if email is already registered
  const existingPartner = await Partnerwebapp.findOne({ email });
  const existingUser = await Userwebapp.findOne({ email });
  const existingSchoolAdmin = await SchoolAdmin.findOne({ email });
  if (existingPartner || existingUser || existingSchoolAdmin) {
    res.status(400);
    throw new Error("Email already registered.");
  }

  // 5. Create new partner
  const partner = await Partnerwebapp.create({
    name,
    email,
    password,
    universityName,
    institutionId,
    profileImage: profileImageFile.location || profileImageFile.path, // Use .location for MulterS3, or .path for disk storage
    adminApproved: false,
    status: "Pending",
  });

  if (partner) {
    res.status(201).json({
      _id: partner._id,
      name: partner.name,
      email: partner.email,
      universityName: partner.universityName,
      institutionId: partner.institutionId,
      profileImage: partner.profileImage,
      token: generateToken(partner._id),
      adminApproved: partner.adminApproved,
      status: partner.status,
    });
  } else {
    res.status(400);
    throw new Error("Error occurred while registering partner.");
  }
});

// 🔥 NEW: Google OAuth for Partners
const googleAuthPartner = asyncHandler(async (req, res) => {
  const { idToken } = req.body;
  console.log("GOOGLE_CLIENT_ID:", process.env.GOOGLE_SIGNUP_CLIENT_ID);
  if (!idToken) {
    res.status(400);
    throw new Error("Google ID token is required.");
  }

  // 1. Verify the Google ID token
  const ticket = await googleClient.verifyIdToken({
    idToken,
    audience: process.env.GOOGLE_SIGNUP_CLIENT_ID,
  });

  const payload = ticket.getPayload();
  const { sub: googleId, email, name, picture } = payload;

  // 2. Check if partner already exists
  let partner = await Partnerwebapp.findOne({ email });

  if (partner) {
    // 2a. Existing partner — update googleId if not already set
    if (!partner.googleId) {
      partner.googleId = googleId;
      partner.isGoogleUser = true;
      await partner.save();
    }

    // Return login response
    return res.json({
      _id: partner._id,
      name: partner.name,
      email: partner.email,
      profileImage: partner.profileImage,
      isGoogleUser: partner.isGoogleUser,
      universityName: partner.universityName,
      institutionId: partner.institutionId,
      isPremium: partner.isPremium ?? false,
      planType: partner.planType ?? "Freemium",
      premiumExpiration: partner.premiumExpiration ?? null,
      adminApproved: partner.adminApproved,
      status: partner.status,
      // 🔥 If institutional info is still missing, tell the frontend
      needsProfileCompletion: !partner.universityName || !partner.institutionId,
      token: generateToken(partner._id),
    });
  }

  // 2b. If partner does not exist, check other collections
  const userExists = await Userwebapp.findOne({ email });
  const schoolAdminExists = await SchoolAdmin.findOne({ email });
  if (userExists || schoolAdminExists) {
    res.status(400);
    throw new Error("Email already registered with another account type.");
  }

  // 3. New Google partner — create account, mark as needing profile completion
  partner = await Partnerwebapp.create({
    name,
    email,
    googleId,
    isGoogleUser: true,
    profileImage: picture || "",
    adminApproved: false,
    status: "Pending",
    needsProfileCompletion: true, // 🔥 Must still fill universityName + institutionId
  });

  res.status(201).json({
    _id: partner._id,
    name: partner.name,
    email: partner.email,
    profileImage: partner.profileImage,
    isGoogleUser: partner.isGoogleUser,
    isPremium: partner.isPremium ?? false,
    planType: partner.planType ?? "Freemium",
    premiumExpiration: partner.premiumExpiration ?? null,
    adminApproved: partner.adminApproved,
    status: partner.status,
    needsProfileCompletion: true,
    token: generateToken(partner._id),
  });
});

// 🔥 NEW: Complete Google partner profile (universityName + institutionId + profileImage)
const completePartnerProfile = asyncHandler(async (req, res) => {
  const { universityName, institutionId } = req.body;
  const profileImageFile = req.file;

  if (!req.user) {
    res.status(401);
    throw new Error("Not authenticated.");
  }

  if (!universityName || !institutionId) {
    res.status(400);
    throw new Error(
      "University/Company name and Institutional ID are required.",
    );
  }

  if (!profileImageFile) {
    res.status(400);
    throw new Error("Profile picture is required.");
  }

  const partner = await Partnerwebapp.findById(req.user._id);
  if (!partner) {
    res.status(404);
    throw new Error("Partner not found.");
  }

  partner.universityName = universityName;
  partner.institutionId = institutionId;
  partner.profileImage = profileImageFile.location || profileImageFile.path;
  partner.needsProfileCompletion = false;

  const updated = await partner.save();

  res.json({
    _id: updated._id,
    name: updated.name,
    email: updated.email,
    universityName: updated.universityName,
    institutionId: updated.institutionId,
    profileImage: updated.profileImage,
    isGoogleUser: updated.isGoogleUser,
    isPremium: updated.isPremium,
    planType: updated.planType,
    premiumExpiration: updated.premiumExpiration ?? null,
    adminApproved: updated.adminApproved,
    status: updated.status,
    needsProfileCompletion: false,
    token: generateToken(updated._id),
  });
});

// Authenticate partner - ALLOW LOGIN REGARDLESS OF APPROVAL STATUS
const authPartner = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const partner = await Partnerwebapp.findOne({ email });

  // 🔥 GUARD: If this is a Google-only account, block password login
  if (partner && partner.isGoogleUser && !partner.password) {
    res.status(400);
    throw new Error(
      "This account was registered with Google. Please use Google Sign-In.",
    );
  }

  if (partner && (await partner.matchPassword(password))) {
    const token = generateToken(partner._id);

    res.json({
      _id: partner._id,
      name: partner.name,
      email: partner.email,
      universityName: partner.universityName,
      institutionId: partner.institutionId,
      token,
      profileImage: partner.profileImage,
      isPremium: partner.isPremium,
      planType: partner.planType,
      premiumExpiration: partner.premiumExpiration,
      adminApproved: partner.adminApproved,
      status: partner.status,
      active: partner.active,
    });
  } else {
    res.status(400);
    throw new Error("Invalid email or password.");
  }
});

// Request Password Reset with OTP
// ✅ FIXED: Request Password Reset — stores OTP in PartnerEmailVerification
// OTP validity: 5 minutes
// Resend cooldown: 1 minute
const requestPasswordReset = asyncHandler(async (req, res) => {
  const { email } = req.body;

  const partner = await Partnerwebapp.findOne({ email });
  if (!partner) {
    res.status(404);
    throw new Error("No account found with that email.");
  }

  // Check existing OTP record 18-08-2026
  const existingRecord = await PartnerEmailVerification.findOne({ email });

  if (existingRecord?.otpExpiration) {
    // OTP was originally created 5 minutes before its expiry
    const otpCreatedAt =
      new Date(existingRecord.otpExpiration).getTime() - 5 * 60 * 1000;

    const elapsed = Date.now() - otpCreatedAt;

    // Resend cooldown = 1 minute
    const resendCooldown = 60 * 1000;

    if (elapsed < resendCooldown) {
      const remainingSeconds = Math.ceil((resendCooldown - elapsed) / 1000);

      res.status(429);
      throw new Error(
        `Please wait ${remainingSeconds} seconds before requesting another OTP.`,
      );
    }
  }

  const otp = generateOTP();
  const otpExpiration = Date.now() + 5 * 60 * 1000; // 5 minutes (matches frontend timer)

  // ✅ Store in PartnerEmailVerification — consistent with the rest of the OTP system
  await PartnerEmailVerification.findOneAndUpdate(
    { email },
    { otp, otpExpiration },
    { upsert: true, new: true },
  );

  await notifyUser(
    partner.email,
    "Your OTP for Password Reset",
    generateOtpEmailHtml(otp, "resetting your password"),
  );

  res.status(200).json({ message: "OTP sent to your email." });
});

// ✅ FIXED: Verify OTP only (Step 2) — reads from PartnerEmailVerification
const verifyPartnerOTPOnly = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;

  const record = await PartnerEmailVerification.findOne({ email });

  if (!record || record.otp !== otp || record.otpExpiration < Date.now()) {
    res.status(400);
    throw new Error("Invalid or expired OTP.");
  }

  // Do NOT delete record — still needed for Step 3 (password reset)
  res.status(200).json({ message: "OTP verified successfully." });
});

// ✅ FIXED: Verify OTP + Reset Password (Step 3) — reads from PartnerEmailVerification
const verifyOTPAndResetPassword = asyncHandler(async (req, res) => {
  const { email, otp, newPassword } = req.body;

  const record = await PartnerEmailVerification.findOne({ email });

  if (!record || record.otp !== otp || record.otpExpiration < Date.now()) {
    res.status(400);
    throw new Error("Invalid or expired OTP.");
  }

  const partner = await Partnerwebapp.findOne({ email });
  if (!partner) {
    res.status(404);
    throw new Error("Partner not found.");
  }

  partner.password = newPassword;
  await partner.save();

  // ✅ Clean up OTP record after successful reset
  await PartnerEmailVerification.deleteOne({ email });

  res.status(200).json({ message: "Password has been successfully updated." });
});

// ------------------------------------
// 👤 PROTECTED & ADMIN ENDPOINTS
// ------------------------------------

// Get partner profile
const getPartnerProfile = asyncHandler(async (req, res) => {
  if (!req.user) {
    res.status(401);
    throw new Error("User not authenticated.");
  }

  const partner = await Partnerwebapp.findById(req.user._id);

  if (!partner) {
    res.status(404);
    throw new Error("Partner not found.");
  }

  const profileData = {
    _id: partner._id,
    name: partner.name,
    email: partner.email,
    universityName: partner.universityName,
    institutionId: partner.institutionId,
    profileImage: partner.profileImage,
    logoUrl: partner.logoUrl,
    adminApproved: partner.adminApproved,
    isPremium: partner.isPremium,
    planType: partner.planType,
    premiumExpiration: partner.premiumExpiration,
    active: partner.active,
  };

  res.json(profileData);
});

// Update partner profile
const updatePartnerProfile = asyncHandler(async (req, res) => {
  if (!req.user) {
    res.status(401);
    throw new Error("User not authenticated.");
  }

  const partner = await Partnerwebapp.findById(req.user._id);
  if (!partner) {
    res.status(404);
    throw new Error("Partner not found.");
  }

  // Update text fields
  partner.name = req.body.name || partner.name;
  partner.email = req.body.email || partner.email;
  partner.universityName = req.body.universityName || partner.universityName;
  partner.institutionId = req.body.institutionId || partner.institutionId;

  // Optional password update
  if (req.body.password) {
    partner.password = req.body.password;
  }

  // Handle uploaded image
  const profileImageFile = req.file;
  if (profileImageFile) {
    const rawPath = profileImageFile.location || profileImageFile.path;
    const finalImageUrl = rawPath.startsWith("http")
      ? rawPath
      : `${req.protocol}://${req.get("host")}/${rawPath.replace(/\\/g, "/")}`;

    partner.profileImage = finalImageUrl;
  }

  // Save updated partner info
  const updatedPartner = await partner.save();

  res.json({
    _id: updatedPartner._id,
    name: updatedPartner.name,
    email: updatedPartner.email,
    universityName: updatedPartner.universityName,
    institutionId: updatedPartner.institutionId,
    profileImage: updatedPartner.profileImage,
    adminApproved: updatedPartner.adminApproved,
    token: generateToken(updatedPartner._id),
  });
});

// Admin approve a partner account
const approvePartner = asyncHandler(async (req, res) => {
  const { partnerId } = req.params;

  const partner = await Partnerwebapp.findById(partnerId);
  if (!partner) {
    res.status(404);
    throw new Error("Partner not found.");
  }

  partner.adminApproved = true;
  partner.status = "Approved";
  partner.active = true;
  await partner.save();

  await notifyUser(
    partner.email,
    "Your SkillNaav Partner Account has been approved!",
    "Congratulations! Your SkillNaav partner account has been approved by the admin. You can now log in and access all features.",
  );

  res.status(200).json({ message: "Partner approved successfully." });
});

// Admin reject a partner account
const rejectPartner = asyncHandler(async (req, res) => {
  const { partnerId } = req.params;
  console.log("Rejecting Partner ID:", partnerId);

  const partner = await Partnerwebapp.findById(partnerId);
  if (!partner) {
    res.status(404);
    throw new Error("Partner not found.");
  }

  partner.adminApproved = false;
  partner.status = "Rejected";
  partner.active = false;
  await partner.save();

  const rejectionReason =
    req.body.reason ||
    "Your SkillNaav partner account has been rejected by the admin.";

  await notifyUser(
    partner.email,
    "Your SkillNaav Partner Account has been rejected.",
    rejectionReason,
  );

  res.status(200).json({ message: "Partner rejected successfully." });
});

// Get all partners
const getAllPartners = asyncHandler(async (req, res) => {
  const partners = await Partnerwebapp.find(
    {},
    "name email universityName institutionId adminApproved status profileImage",
  ); // Include profileImage

  if (!partners || partners.length === 0) {
    res.status(404);
    throw new Error("No partners found.");
  }

  res.status(200).json(partners);
});

// Update Partner Subscription Plan
const updatePartnerPlan = asyncHandler(async (req, res) => {
  const { planType, durationInDays } = req.body;

  const partner = await Partnerwebapp.findById(req.user._id);
  if (!partner) {
    res.status(404);
    throw new Error("Partner not found.");
  }

  const validPlans = ["Freemium", "Premium Basic", "Premium Plus"];
  if (!validPlans.includes(planType)) {
    res.status(400);
    throw new Error("Invalid plan type.");
  }

  const now = new Date();

  if (planType === "Freemium") {
    partner.planType = "Freemium";
    partner.isPremium = false;
    partner.premiumExpiration = null;
  } else {
    partner.planType = planType;
    partner.isPremium = true;
    partner.premiumExpiration = new Date(
      now.getTime() + durationInDays * 24 * 60 * 60 * 1000,
    );
  }

  const updated = await partner.save();

  res.status(200).json({
    message: `Plan updated to ${planType}`,
    planType: updated.planType,
    isPremium: updated.isPremium,
    premiumExpiration: updated.premiumExpiration,
  });
});

// ✅ NEW: Remove Partner Logo
const removeLogo = asyncHandler(async (req, res) => {
  if (!req.user) {
    res.status(401);
    throw new Error("User not authenticated.");
  }

  const partner = await Partnerwebapp.findById(req.user._id);
  if (!partner) {
    res.status(404);
    throw new Error("Partner not found.");
  }

  partner.logoUrl = null;
  await partner.save();

  res
    .status(200)
    .json({ success: true, message: "Logo removed successfully." });
});

// Exporting all controller functions
module.exports = {
  registerPartner,
  authPartner,
  googleAuthPartner, // 🔥 NEW
  completePartnerProfile, // 🔥 NEW
  updatePartnerProfile,
  getAllPartners,
  approvePartner,
  rejectPartner,
  checkEmailExists,
  requestPasswordReset,
  verifyOTPAndResetPassword,
  getPartnerProfile,
  sendPartnerVerificationCode,
  verifyPartnerOTP,
  updatePartnerPlan,
  verifyPartnerOTPOnly,
  removeLogo, // ✅ NEW
};
