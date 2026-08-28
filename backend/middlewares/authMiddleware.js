/**
 * backend/middleware/authMiddleware.js
 *
 * Handles token types used in this project:
 *   "token"            -> Partner
 *   "userToken"        -> Student
 *   "schoolAdminToken" -> SchoolAdmin
 *
 * All are signed with the same JWT_SECRET. The authenticate middleware decodes
 * the token once, then tries each supported account model until one matches.
 */

const jwt = require("jsonwebtoken");
const asyncHandler = require("express-async-handler");
const Userwebapp = require("../models/webapp-models/userModel");
const Partnerwebapp = require("../models/webapp-models/partnerModel");
const Adminwebapp = require("../models/webapp-models/adminModel");
const SuperAdminSettings = require("../models/webapp-models/SuperAdminSettingsModel");
const SchoolAdmin = require("../models/webapp-models/schoolAdmin/SchoolAdminModel");

function extractToken(req) {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith("Bearer ")) {
    return auth.split(" ")[1];
  }
  return null;
}

function tokenErrorResponse(res, err) {
  if (err.name === "TokenExpiredError") {
    return res.status(401).json({
      success: false,
      message: "Token expired",
      code: "TOKEN_EXPIRED",
      expiredAt: err.expiredAt,
    });
  }

  return res.status(401).json({
    success: false,
    message: "Not authorized, token invalid",
    code: "TOKEN_INVALID",
  });
}

async function resolveStudentSchool(student) {
  let resolvedSchool = (student.schoolName || student.school || "").trim() || null;

  if (!resolvedSchool && student.schoolAdmin) {
    try {
      const schoolAdmin = await SchoolAdmin.findById(student.schoolAdmin)
        .select("schoolName")
        .lean();

      if (schoolAdmin?.schoolName) {
        resolvedSchool = schoolAdmin.schoolName.trim();
        Userwebapp.findByIdAndUpdate(student._id, {
          schoolName: resolvedSchool,
          school: resolvedSchool,
        }).exec().catch(() => {});
      }
    } catch (err) {
      console.error("School lookup failed in authMiddleware:", err.message);
    }
  }

  return resolvedSchool;
}

const authenticate = asyncHandler(async (req, res, next) => {
  if (req.method === "OPTIONS") {
    return next();
  }

  const token = extractToken(req);

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Not authorized, no token",
      code: "NO_TOKEN",
    });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return tokenErrorResponse(res, err);
  }

  const student = await Userwebapp.findById(decoded.id).select("-password");
  if (student) {
    const user = student.toObject();
    const resolvedSchool = await resolveStudentSchool(student);

    user.name = student.name || student.username || student.email || "Student";
    user.email = student.email || student.username || "";
    user.role = "user";
    user.school = resolvedSchool;
    user.schoolName = resolvedSchool;

    req.user = user;
    req.isPartner = false;
    req.isAdmin = false;
    req.isSchoolAdmin = false;
    return next();
  }

  const partner = await Partnerwebapp.findById(decoded.id).select("-password");
  if (partner) {
    const user = partner.toObject();
    user.role = "partner";
    user.school = null;
    user.schoolName = null;

    req.user = user;
    req.isPartner = true;
    req.isAdmin = false;
    req.isSchoolAdmin = false;
    return next();
  }

  const admin = await Adminwebapp.findById(decoded.id).select("-password");
  if (admin) {
    // Account status must be enforced on every authenticated request.  Without
    // this check, suspending an administrator only changes the value shown in
    // the UI; an already-issued token remains fully usable until it expires.
    const settings = await SuperAdminSettings.findOne().select("securitySettings.forceLogout").lean();
    const forceLogout = settings?.securitySettings?.forceLogout !== false;
    if (forceLogout && admin.status && admin.status !== "Active") {
      return res.status(403).json({
        success: false,
        message: "This administrator account has been suspended or deactivated.",
        code: "ADMIN_ACCOUNT_INACTIVE",
      });
    }

    const user = admin.toObject();
    user.adminRole = admin.role;
    user.role = "admin";
    user.school = null;
    user.schoolName = null;

    req.user = user;
    req.isPartner = false;
    req.isAdmin = true;
    req.isSchoolAdmin = false;
    return next();
  }

  const schoolAdmin = await SchoolAdmin.findById(decoded.id).select("-password");
  if (schoolAdmin) {
    const user = schoolAdmin.toObject();
    const resolvedSchool = (schoolAdmin.schoolName || schoolAdmin.school || "").trim();

    user.role = "school-admin";
    user.school = resolvedSchool;
    user.schoolName = resolvedSchool;
    user.name = schoolAdmin.profile?.contactPerson || schoolAdmin.name || schoolAdmin.schoolName || schoolAdmin.email;
    user.email = schoolAdmin.email;

    req.user = user;
    req.isPartner = false;
    req.isAdmin = false;
    req.isSchoolAdmin = true;
    return next();
  }

  return res.status(401).json({
    success: false,
    message: "Not authorized, user not found",
    code: "NOT_FOUND",
  });
});

const authorizePartner = asyncHandler(async (req, res, next) => {
  if (req.method === "OPTIONS") return next();
  if (!req.isPartner) {
    return res.status(403).json({ success: false, message: "Not authorized as partner" });
  }
  next();
});

const authorizeSchoolAdmin = asyncHandler(async (req, res, next) => {
  if (req.method === "OPTIONS") return next();
  if (!req.isSchoolAdmin) {
    return res.status(403).json({
      success: false,
      message: "Not authorized as school admin",
    });
  }

  if (!req.user?.school) {
    return res.status(403).json({
      success: false,
      message: "School admin has no school assigned",
    });
  }

  next();
});

const authorizeAdmin = asyncHandler(async (req, res, next) => {
  if (req.method === "OPTIONS") return next();
  if (!req.isAdmin && !req.user?.isAdmin) {
    return res.status(403).json({ success: false, message: "Not authorized as admin" });
  }
  next();
});

const partnerProtect = asyncHandler(async (req, res, next) => {
  if (req.method === "OPTIONS") return next();
  const token = extractToken(req);

  if (!token) {
    return res.status(401).json({ message: "Not authorized, no token" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.partner = await Partnerwebapp.findById(decoded.id).select("-password");

    if (!req.partner) {
      return res.status(401).json({ message: "Not authorized, partner not found" });
    }

    req.user = req.partner;
    req.isPartner = true;
    next();
  } catch (error) {
    const message = error.name === "TokenExpiredError"
      ? "Not authorized, token expired"
      : error.name === "JsonWebTokenError"
        ? "Not authorized, token invalid"
        : "Not authorized, token failed";
    res.status(401).json({ message });
  }
});

module.exports = {
  authenticate,
  authorizePartner,
  authorizeSchoolAdmin,
  authorizeAdmin,
  partnerProtect,
};
