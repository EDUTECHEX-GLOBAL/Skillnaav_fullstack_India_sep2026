const asyncHandler = require("express-async-handler");
const Userwebapp = require("../models/webapp-models/userModel");
const UserAgeGateConsent = require("../models/webapp-models/UserAgeGateConsentModel");
const generateToken = require("../utils/generateToken");
const notifyUser = require("../utils/notifyUser");
const { profilePicUpload } = require('../utils/multer');
const EmailVerification = require("../models/webapp-models/EmailVerificationModel");
const LoginSession = require("../models/webapp-models/LoginSession");
const { OAuth2Client } = require("google-auth-library");
const client = new OAuth2Client(process.env.GOOGLE_SIGNUP_CLIENT_ID);
const Partnerwebapp = require("../models/webapp-models/partnerModel");
const SchoolAdmin = require("../models/webapp-models/schoolAdmin/SchoolAdminModel");


// helper: expire subscription if expiration date is in the past or now
async function expireIfNeeded(user) {
  if (!user) return false;
  const exp = user.premiumExpiration ? new Date(user.premiumExpiration) : null;
  if (exp && !isNaN(exp.getTime()) && exp.getTime() <= Date.now()) {
    user.isPremium = false;
    user.planType = "Free";
    user.premiumExpiration = null;
    await user.save();
    return true;
  }
  return false;
}

// Get user profile
const getUserProfile = asyncHandler(async (req, res) => {
  let user = await Userwebapp.findById(req.user._id);
  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }
  await expireIfNeeded(user);
  const userProfile = {
    _id: user._id,
    name: user.name,
    email: user.email,
    universityName: user.universityName,
    dob: user.dob,
    educationLevel: user.educationLevel,
    fieldOfStudy: user.fieldOfStudy,
    desiredField: user.desiredField,
    linkedin: user.linkedin,
    portfolio: user.portfolio,
    skills: user.skills,
    interests: user.interests,
    preferredLocations: user.preferredLocations,
    adminApproved: user.adminApproved,
    status: user.status,
    financialStatus: user.financialStatus,
    state: user.state,
    country: user.country,
    city: user.city,
    postalCode: user.postalCode,
    address: user.address,
    currentGrade: user.currentGrade,
    gradePercentage: user.gradePercentage,
    profileImage: user.profileImage,
    isPremium: user.isPremium,
    planType: user.planType,
    premiumExpiration: user.premiumExpiration,
  };
  res.json(userProfile);
});

// Helper function to check required fields
const areFieldsFilled = (fields) => fields.every((field) => field);

// Check if user exists by email
const checkIfUserExists = asyncHandler(async (req, res) => {
  const { email } = req.query;
  if (!email) {
    res.status(400);
    throw new Error("Email query parameter is required.");
  }
  const userExists = await Userwebapp.findOne({ email });
  const partnerExists = await Partnerwebapp.findOne({ email });
  const schoolAdminExists = await SchoolAdmin.findOne({ email });

  let message = "Email already registered.";
  if (partnerExists || schoolAdminExists) {
    message = "Email already registered with another account type.";
  }

  res.json({ exists: !!userExists || !!partnerExists || !!schoolAdminExists, message });
});

const { generateOtpEmailHtml } = require("../utils/otpTemplate");

// Generate a random OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Request Password Reset with OTP
const requestPasswordReset = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const user = await Userwebapp.findOne({ email });
  if (!user) {
    res.status(404);
    throw new Error("No account found with that email.");
  }
  const otp = generateOTP();
  user.otp = otp;
  user.otpExpiration = Date.now() + 300000; // OTP valid for 5 minutes
  await user.save();
  await notifyUser(user.email, "Your OTP for Password Reset", generateOtpEmailHtml(otp, "resetting your password"));
  res.status(200).json({ message: "OTP sent to your email." });
});

// Verify OTP and Reset Password
const verifyOTPAndResetPassword = asyncHandler(async (req, res) => {
  const { email, otp, newPassword } = req.body;
  const user = await Userwebapp.findOne({
    email,
    otp,
    otpExpiration: { $gt: Date.now() }
  });
  if (!user) {
    res.status(400);
    throw new Error("Invalid or expired OTP.");
  }
  user.password = newPassword;
  user.otp = undefined;
  user.otpExpiration = undefined;
  await user.save();
  res.status(200).json({ message: "Password has been successfully updated." });
});

// Helper: clean arrays (remove empty strings, trim values)
const cleanArray = (arr) =>
  Array.isArray(arr)
    ? arr.map((x) => x.trim()).filter(Boolean)
    : arr && typeof arr === "string"
      ? arr.split(",").map((x) => x.trim()).filter(Boolean)
      : [];

// Register a new user
const registerUser = asyncHandler(async (req, res) => {
  console.log("Request Body:", req.body);
  const {
    name, email, password, confirmPassword, universityName, dob,
    educationLevel, fieldOfStudy, desiredField, linkedin, portfolio,
    skills, interests, preferredLocations, state, country, city,
    postalCode, zip, address,
  } = req.body;

  const isGoogleSignup = !password && !confirmPassword;

  const requiredGoogleFields = [name, email, universityName, dob, educationLevel, fieldOfStudy, desiredField, linkedin];
  const requiredNormalFields = [name, email, password, confirmPassword, universityName, dob, educationLevel, fieldOfStudy, desiredField, linkedin];

  if (isGoogleSignup) {
    if (!areFieldsFilled(requiredGoogleFields)) {
      res.status(400);
      throw new Error("Please fill all required fields for Google sign-up.");
    }
  } else {
    if (!areFieldsFilled(requiredNormalFields)) {
      res.status(400);
      throw new Error("Please fill all required fields.");
    }
    if (password !== confirmPassword) {
      res.status(400);
      throw new Error("Passwords do not match.");
    }
  }

  // Check if the user already exists in any collection
  const userExists = await Userwebapp.findOne({ email });
  const partnerExists = await Partnerwebapp.findOne({ email });
  const schoolAdminExists = await SchoolAdmin.findOne({ email });

  if (userExists || partnerExists || schoolAdminExists) {
    res.status(400);
    throw new Error("Email already registered");
  }

  let profilePicUrl = null;
  if (!isGoogleSignup) {
    if (!req.file) {
      res.status(400);
      throw new Error("Profile picture is required.");
    }
    profilePicUrl = req.file.location;
  } else {
    profilePicUrl = req.body.profileImage || null;
  }

  const parsedSkills = cleanArray(skills);
  const parsedInterests = cleanArray(interests);
  const parsedLocations = cleanArray(preferredLocations);

  const user = await Userwebapp.create({
    name,
    email,
    password: isGoogleSignup ? undefined : password,
    universityName,
    dob: new Date(dob),
    educationLevel,
    fieldOfStudy,
    desiredField,
    linkedin,
    portfolio,
    skills: parsedSkills,
    interests: parsedInterests,
    preferredLocations: parsedLocations,
    state,
    country,
    city,
    postalCode: postalCode || zip || "",
    address,
    profileImage: profilePicUrl,
    isGoogleUser: isGoogleSignup,
    status: "Pending",
    adminApproved: false,
    isActive: false,
    premiumExpiration: null,
  });

  res.status(201).json({
    _id: user._id,
    name: user.name,
    email: user.email,
    token: generateToken(user._id),
    status: user.status,
    adminApproved: user.adminApproved,
  });
});

// Authenticate user (login)
const authUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await Userwebapp.findOne({ email });
  if (!user) {
    res.status(400);
    throw new Error("Invalid email or password.");
  }

  // 🚫 Block manual login for Google users
  if (user.isGoogleUser) {
    res.status(400);
    throw new Error("This account was created using Google. Please sign in with Google.");
  }

  const isMatch = await user.matchPassword(password);
  if (!isMatch) {
    res.status(400);
    throw new Error("Invalid email or password.");
  }

  // School-admin restriction
  if (user.schoolAdmin && !user.isActive) {
    res.status(403);
    throw new Error("Your account has been restricted by your school administrator.");
  }

  await expireIfNeeded(user);

  const token = generateToken(user._id);

  const session = await LoginSession.create({
    studentId: user._id,
    schoolAdmin: user.schoolAdmin,
    loginAt: new Date(),
  });

  // ✅ FIX: Resolve schoolName from multiple sources:
  // 1. user.schoolName (directly stored on user doc — set for newly created students)
  // 2. user.school (alternate field name)
  // 3. DB lookup via user.schoolAdmin ObjectId (fallback for old students missing schoolName)
  let resolvedSchool = user.schoolName || user.school || null;

  if (!resolvedSchool && user.schoolAdmin) {
    try {
      const schoolAdminDoc = await SchoolAdmin.findById(user.schoolAdmin).select("schoolName").lean();
      if (schoolAdminDoc?.schoolName) {
        resolvedSchool = schoolAdminDoc.schoolName;
        // ✅ Backfill: save onto user doc so next login skips this extra query
        await Userwebapp.findByIdAndUpdate(user._id, {
          schoolName: resolvedSchool,
          school: resolvedSchool,
        });
        console.log(`✅ Backfilled schoolName "${resolvedSchool}" onto user ${user._id}`);
      }
    } catch (err) {
      console.error("Could not resolve schoolName from schoolAdmin:", err.message);
    }
  }

  console.log(`🔑 authUser "${user.email}" schoolAdmin:${user.schoolAdmin} → resolvedSchool:"${resolvedSchool}"`);

  res.json({
    _id: user._id,
    name: user.name,
    email: user.email,
    profileImage: user.profileImage,
    isPremium: user.isPremium,
    planType: user.planType,
    premiumExpiration: user.premiumExpiration,
    token,
    sessionId: session._id,
    schoolAdmin: user.schoolAdmin,
    // ✅ Both keys populated — frontend & studentSupportController both find the value
    schoolName: resolvedSchool,
    school: resolvedSchool,
    adminApproved: user.adminApproved,
    status: user.status,
    isFullyApproved: user.status === "Approved" && user.adminApproved,
  });
});

// Update user profile
const updateUserProfile = asyncHandler(async (req, res) => {
  console.log("BODY RECEIVED ===>", req.body);
  console.log("FILE RECEIVED ===>", req.file);

  // 🚫 Block dangerous fields
  delete req.body.password;
  delete req.body.confirmPassword;
  delete req.body.isPremium;
  delete req.body.planType;
  delete req.body.premiumExpiration;
  delete req.body.adminApproved;
  delete req.body.status;

  const user = await Userwebapp.findById(req.user._id);
  if (!user) {
    res.status(404);
    throw new Error("User not found.");
  }

  const fields = [
    "name", "email", "universityName", "educationLevel", "fieldOfStudy",
    "desiredField", "linkedin", "portfolio", "financialStatus", "state",
    "country", "city", "address", "currentGrade", "gradePercentage",
  ];

  fields.forEach((field) => {
    if (req.body[field] !== undefined && req.body[field] !== "") {
      user[field] = req.body[field];
    }
  });

  if (req.body.dob) {
    user.dob = new Date(req.body.dob);
  }

  if (req.body.zip || req.body.postalCode) {
    user.postalCode = req.body.zip || req.body.postalCode;
  }

  const arrayFields = ["skills", "interests", "preferredLocations"];
  arrayFields.forEach((field) => {
    if (req.body[field] !== undefined) {
      if (Array.isArray(req.body[field])) {
        user[field] = req.body[field];
      } else if (typeof req.body[field] === "string") {
        user[field] = req.body[field]
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean);
      }
    }
  });

  if (req.file) {
    user.profileImage = req.file.location;
  }

  // if (user.isGoogleUser) {
  //   user.adminApproved = true;
  //   user.status = "Approved";
  //   user.isActive = true;
  // }

  const updatedUser = await user.save();
  return res.json({
    _id: updatedUser._id,
    message: "Profile updated successfully",
  });
});

// Get all users with additional fields + AgeGate consent selfie (OVER_18)
const getAllUsers = asyncHandler(async (req, res) => {
  // 1) Fetch users (use lean() so we can attach extra fields)
  const users = await Userwebapp.find(
    {},
    `
      name
      email
      universityName
      dob
      educationLevel
      fieldOfStudy
      desiredField
      linkedin
      status
      adminApproved
      profileImage
      isPremium
      planType
      skills
      interests
      preferredLocations
      state
      country
      city
      postalCode
      address
      currentGrade
      gradePercentage
      schoolAdmin
    `
  ).lean();
  if (!users || users.length === 0) {
    res.status(404);
    throw new Error("No users found.");
  }
  // 2) Fetch consent records for these users
  const userIds = users.map((u) => u._id);

  const consents = await UserAgeGateConsent.find({
    user: { $in: userIds },
  })
    .sort({ updatedAt: -1 })
    .select("user ageCategory ageGateCompleted ageVerificationPhotoUrl ageVerificationPhotoKey guardianName guardianEmail guardianRelationship")
    .lean();

  // 3) Map latest consent by userId
  const consentMap = new Map();
  for (const c of consents) {
    const key = String(c.user);
    if (!consentMap.has(key)) consentMap.set(key, c); // keep latest due to sort
  }

  // 4) Merge consent fields into user objects
  const mergedUsers = users.map((u) => {
    const c = consentMap.get(String(u._id));
    return {
      ...u,
      ageCategory: c?.ageCategory || "",
      ageGateCompleted: c?.ageGateCompleted || false,
      ageVerificationPhotoUrl: c?.ageVerificationPhotoUrl || "",
      ageVerificationPhotoKey: c?.ageVerificationPhotoKey || "",

      // ✅ UNDER_18 consent details (send to frontend)
      guardianName: c?.guardianName || "",
      guardianEmail: c?.guardianEmail || "",
      guardianRelationship: c?.guardianRelationship || "",
    };
  });

  res.status(200).json(mergedUsers);
});

// Admin approve a user
const approveUser = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  console.log("Approving User ID:", userId);
  const user = await Userwebapp.findById(userId);
  if (!user) {
    res.status(404);
    throw new Error("User not found.");
  }
  user.status = "Approved";
  user.adminApproved = true;
  user.isActive = true;
  await user.save();
  await notifyUser(
    user.email,
    "Your SkillNaav account has been approved!",
    "Congratulations! Your SkillNaav account has been approved by the admin. You can now log in and access all features."
  );
  res.status(200).json({ message: "User approved successfully." });
});

// Admin rejects a user
const rejectUser = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  console.log("Rejecting User ID:", userId);
  const user = await Userwebapp.findById(userId);
  if (!user) {
    res.status(404);
    throw new Error("User not found.");
  }
  user.status = "Rejected";
  user.adminApproved = false;
  user.isActive = false;
  await user.save();
  await notifyUser(
    user.email,
    "Your SkillNaav account has been rejected.",
    "Your SkillNaav account has been rejected by the admin. Please contact support for more information."
  );
  res.status(200).json({ message: "User rejected successfully." });
});

// Get premium status
const getPremiumStatus = asyncHandler(async (req, res) => {
  let user = await Userwebapp.findById(req.user._id).select("-password");
  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }
  await expireIfNeeded(user);
  const freshUser = await Userwebapp.findById(req.user._id).select("-password");
  return res.status(200).json({
    success: true,       // 🔥 REQUIRED FOR FRONTEND
    user: freshUser      // 🔥 Must remain as "user"
  });
});

// Send verification code for signup
const sendSignupVerificationCode = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    res.status(400);
    throw new Error("Invalid email format.");
  }
  const existingUser = await Userwebapp.findOne({ email });

  if (existingUser) {
    // ✅ FIX: distinguish a complete registration from an incomplete one.
    // A user who refreshed mid-registration lands back on Step 1 and may try
    // to re-enter their email. Block only fully-registered users; allow
    // incomplete ones to re-enter the OTP flow so they can finish.
    const profileComplete =
      existingUser.universityName &&
      existingUser.dob &&
      existingUser.educationLevel &&
      existingUser.fieldOfStudy &&
      existingUser.country &&
      existingUser.desiredField &&
      existingUser.linkedin &&
      existingUser.profileImage;

    if (profileComplete) {
      res.status(400);
      throw new Error("Email already registered.");
    }
    // Incomplete profile — allow OTP so the user can complete registration
  } else {
    // Check if it's registered in partner or schoolAdmin
    const partnerExists = await Partnerwebapp.findOne({ email });
    const schoolAdminExists = await SchoolAdmin.findOne({ email });
    if (partnerExists || schoolAdminExists) {
      res.status(400);
      throw new Error("Email already registered with another account type.");
    }
  }
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const otpExpiration = Date.now() + 10 * 60 * 1000;
  await EmailVerification.findOneAndUpdate(
    { email },
    { otp, otpExpiration },
    { upsert: true, new: true }
  );
  await notifyUser(
    email,
    "SkillNaav Email Verification Code",
    generateOtpEmailHtml(otp, "creating your SkillNaav account")
  );
  res.status(200).json({ message: "Verification code sent to email." });
});

// Verify the signup OTP
const verifySignupOTP = asyncHandler(async (req, res) => {
  const { email, otp, password, name } = req.body;
  const record = await EmailVerification.findOne({ email });
  if (!record || record.otp !== otp || Date.now() > record.otpExpiration) {
    res.status(400);
    throw new Error("Invalid or expired verification code.");
  }
  await EmailVerification.deleteOne({ email });
  let user = await Userwebapp.findOne({ email });
  if (!user) {
    // Brand new user — create the minimal record
    user = await Userwebapp.create({
      email,
      name: (name || "").trim() || undefined,
      password,
      status: "Pending",
      adminApproved: false,
      isActive: false,
      isGoogleUser: false,
    });
  } else {
    // ✅ FIX: user already exists (refreshed mid-registration) — just update
    // the name/password in case they changed them and reissue a token.
    // Never overwrite a completed profile.
    if (name && name.trim()) user.name = name.trim();
    if (password)            user.password = password; // triggers bcrypt pre-save hook
    await user.save();
  }
  const token = generateToken(user._id);
  res.status(200).json({ success: true, token, message: "Email verified successfully" });
});

// Google auth
const googleAuthUser = asyncHandler(async (req, res) => {
  const { idToken } = req.body;
  const ticket = await client.verifyIdToken({
    idToken,
    audience: process.env.GOOGLE_SIGNUP_CLIENT_ID,
  });
  const payload = ticket.getPayload();
  const { sub, email, name, picture } = payload;

  let user = await Userwebapp.findOne({ googleId: sub });
  if (!user) {
    user = await Userwebapp.findOne({ email });
  }

  if (!user) {
    // Check if registered as partner or schooladmin
    const partnerExists = await Partnerwebapp.findOne({ email });
    const schoolAdminExists = await SchoolAdmin.findOne({ email });
    if (partnerExists || schoolAdminExists) {
      res.status(400);
      throw new Error("Email already registered with another account type.");
    }
  }

  // 3️⃣ If user exists → update googleId & login
  if (user) {
    if (!user.googleId) {
      user.googleId = sub;
      user.isGoogleUser = true;
      await user.save();
    }
    const token = generateToken(user._id);
    return res.json({
      token,
      _id: user._id,
      email: user.email,
      name: user.name,
      profileImage: user.profileImage,
      isGoogleUser: true,
      schoolAdmin: user.schoolAdmin,  // ✅ IMPORTANT
      schoolName: user.schoolName || user.school || null,
      school: user.schoolName || user.school || null,
      needsProfileCompletion:
        !user.universityName || !user.dob || !user.educationLevel ||
        !user.fieldOfStudy || !user.country || !user.desiredField ||
        !user.linkedin || !user.profileImage,
    });
  }

  // Create new Google user
  user = await Userwebapp.create({
    googleId: sub,
    email,
    name,
    profileImage: picture,
    isGoogleUser: true,
    status: "Pending",
    adminApproved: false,
    isActive: false,
    schoolAdmin: false,   // ✅ IMPORTANT DEFAULT
  });

  const token = generateToken(user._id);
  return res.json({
    token,
    _id: user._id,
    email,
    name,
    profileImage: picture,
    isGoogleUser: true,
    schoolAdmin: false,   // ✅ IMPORTANT
    schoolName: null,
    school: null,
    needsProfileCompletion: true,
  });
});

// Get user by ID
const getUserById = asyncHandler(async (req, res) => {
  const user = await Userwebapp.findById(req.params.id);
  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }
  await expireIfNeeded(user);
  const userProfile = {
    _id: user._id,
    name: user.name,
    email: user.email,
    universityName: user.universityName,
    dob: user.dob,
    educationLevel: user.educationLevel,
    fieldOfStudy: user.fieldOfStudy,
    desiredField: user.desiredField,
    linkedin: user.linkedin,
    portfolio: user.portfolio,
    skills: user.skills,
    interests: user.interests,
    preferredLocations: user.preferredLocations,
    adminApproved: user.adminApproved,
    status: user.status,
    financialStatus: user.financialStatus,
    state: user.state,
    country: user.country,
    city: user.city,
    postalCode: user.postalCode,
    address: user.address,
    currentGrade: user.currentGrade,
    gradePercentage: user.gradePercentage,
    profileImage: user.profileImage,
    isPremium: user.isPremium,
    planType: user.planType,
    premiumExpiration: user.premiumExpiration,
  };
  res.json(userProfile);
});

const verifyOTPOnly = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;

  // 1) Check EmailVerification (used for Age Gate / Signup)
  const record = await EmailVerification.findOne({ email });
  if (record && record.otp === otp && Date.now() <= record.otpExpiration) {
    return res.status(200).json({ success: true, message: "OTP verified successfully." });
  }

  // 2) Check Userwebapp (used for Password Reset)
  const user = await Userwebapp.findOne({ email });
  if (user && user.otp === otp && user.otpExpiration > Date.now()) {
    return res.status(200).json({ success: true, message: "OTP verified successfully." });
  }

  res.status(400);
  throw new Error("Invalid or expired OTP.");
});


// ✅ NEW: Send OTP for age gate (works for ANY email — user OR guardian)
// Unlike sendSignupVerificationCode, this does NOT check if email is registered.
// Guardian email will never be a registered user, so we must skip that check.
const sendAgeGateVerificationCode = asyncHandler(async (req, res) => {
  const { email } = req.body;

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    res.status(400);
    throw new Error("Invalid email format.");
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const otpExpiration = Date.now() + 10 * 60 * 1000; // 10 minutes

  await EmailVerification.findOneAndUpdate(
    { email },
    { otp, otpExpiration },
    { upsert: true, new: true }
  );

  await notifyUser(
    email,
    "SkillNaav Age Verification Code",
    generateOtpEmailHtml(otp, "verifying your age")
  );

  res.status(200).json({ success: true, message: "Verification code sent to email." });
});




module.exports = {
  registerUser,
  authUser,
  updateUserProfile,
  getAllUsers,
  approveUser,
  rejectUser,
  checkIfUserExists,
  requestPasswordReset,
  verifyOTPAndResetPassword,
  getUserProfile,
  getPremiumStatus,
  sendSignupVerificationCode,
  verifySignupOTP,
  googleAuthUser,
  getUserById,
  verifyOTPOnly,
  sendAgeGateVerificationCode,
};
