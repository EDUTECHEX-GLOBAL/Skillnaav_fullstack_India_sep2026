const jwt          = require("jsonwebtoken");
const asyncHandler = require("express-async-handler");
const SchoolAdmin  = require("../models/webapp-models/schoolAdmin/SchoolAdminModel");

/* ═══════════════════════════════════════════════════════════════
   protect  —  School Admin route guard
   Used on:  /api/schooladmin/* routes (dashboard, students, etc.)

   Sets:
     req.user           — full SchoolAdmin document (minus password)
     req.user.school    — schoolName string  ← used by support controllers
     req.user.schoolName— same value (alias)
     req.user.name      — contactPerson or schoolName or email
     req.user.role      — "school-admin"
     req.isSchoolAdmin  — true   ← authorizeSchoolAdmin guard reads this
═══════════════════════════════════════════════════════════════ */
const protect = asyncHandler(async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      token = req.headers.authorization.split(" ")[1];

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      const sa = await SchoolAdmin.findById(decoded.id).select("-password");

      if (!sa) {
        return res.status(401).json({
          success: false,
          message: "Not authorized — school admin not found",
          code: "NOT_FOUND",
        });
      }

      // ✅ Normalise onto req.user — same shape as authMiddleware.js step 4
      const obj        = sa.toObject();
      const resolvedSchool = (sa.schoolName || sa.school || "").trim();

      obj.role       = "school-admin";
      obj.school     = resolvedSchool;   // ← support controllers read this
      obj.schoolName = resolvedSchool;   // ← alias, keep both in sync
      obj.name       = sa.profile?.contactPerson || sa.name || sa.schoolName || sa.email;
      obj.email      = sa.email;

      req.user          = obj;
      req.isSchoolAdmin = true;   // ← authorizeSchoolAdmin reads this
      req.isAdmin       = false;
      req.isPartner     = false;

      console.log(`🔐 [protect] school-admin: "${obj.name}" | school: "${obj.school}"`);
      return next();

    } catch (error) {
      if (error.name === "TokenExpiredError") {
        return res.status(401).json({
          success: false,
          message: "Token expired",
          code: "TOKEN_EXPIRED",
        });
      }
      return res.status(401).json({
        success: false,
        message: "Not authorized, token failed",
        code: "TOKEN_INVALID",
      });
    }
  }

  // No token at all
  return res.status(401).json({
    success: false,
    message: "Not authorized, no token",
    code: "NO_TOKEN",
  });
});

module.exports = { protect };