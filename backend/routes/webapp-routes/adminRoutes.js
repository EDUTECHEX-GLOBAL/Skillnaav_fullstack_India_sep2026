// File: adminRoutes.js

const express = require("express");
//Add resendLoginOtp 18-08-2026
const {
  loginUser,
  verifyLoginOtp,
  resendLoginOtp,
  forgotPassword,
  resetPassword,
  requestChangePasswordOtp,
  changePassword,
} = require("../../controllers/adminController");
const {
  authenticate,
  authorizeAdmin,
} = require("../../middlewares/authMiddleware");
const Admin = require("../../models/webapp-models/adminModel");
const bcrypt = require("bcryptjs");
const router = express.Router();

const STAFF_ROLES = ["Operations Admin", "Support Admin", "Finance Admin"];

const requireSuperAdmin = (req, res, next) => {
  if (req.user?.isAdmin !== true && req.user?.adminRole !== "Super Admin") {
    return res
      .status(403)
      .json({
        message: "Only a Super Admin can manage administrator accounts.",
      });
  }
  next();
};

// Login Route
router.post("/login", loginUser);
router.post("/verify-login-otp", verifyLoginOtp);
//Add for resend otp - 18-08-2026
router.post("/resend-login-otp", resendLoginOtp);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

// Change Password Routes (Authenticated)
router.post("/change-password-otp", authenticate, requestChangePasswordOtp);
router.post("/change-password", authenticate, changePassword);

// Get all admins
router.get("/all", authenticate, authorizeAdmin, async (req, res) => {
  try {
    const admins = await Admin.find()
      .select("name email role status isAdmin pic createdAt lastLogin")
      .sort({ createdAt: 1 })
      .lean();
    res.json(admins);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create a staff administrator. Super Admin accounts cannot be created from
// the dashboard, preventing staff users from granting elevated access.
router.post(
  "/",
  authenticate,
  authorizeAdmin,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const { name, email, password, role } = req.body;
      const normalizedEmail =
        typeof email === "string" ? email.trim().toLowerCase() : "";

      if (!name?.trim() || !normalizedEmail || !password || !role) {
        return res
          .status(400)
          .json({
            message: "Name, email, temporary password, and role are required.",
          });
      }
      if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
        return res
          .status(400)
          .json({ message: "Enter a valid email address." });
      }
      if (password.length < 8) {
        return res
          .status(400)
          .json({
            message: "Temporary password must be at least 8 characters.",
          });
      }
      if (!STAFF_ROLES.includes(role)) {
        return res
          .status(400)
          .json({ message: "Select a valid staff administrator role." });
      }

      const existing = await Admin.exists({ email: normalizedEmail });
      if (existing)
        return res
          .status(409)
          .json({
            message: "An administrator already uses this email address.",
          });

      const admin = await Admin.create({
        name: name.trim(),
        email: normalizedEmail,
        password: await bcrypt.hash(password, 10),
        role,
        isAdmin: false,
        status: "Active",
      });
      res
        .status(201)
        .json(
          await Admin.findById(admin._id).select(
            "name email role status isAdmin pic createdAt lastLogin",
          ),
        );
    } catch (error) {
      console.error("Unable to create administrator:", error);
      res
        .status(500)
        .json({ message: "Unable to create administrator account." });
    }
  },
);

router.patch(
  "/:id/access",
  authenticate,
  authorizeAdmin,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const roles = [
        "Super Admin",
        "Operations Admin",
        "Support Admin",
        "Finance Admin",
      ];
      const statuses = ["Active", "Inactive", "Suspended"];
      const update = {};
      if (req.body.role !== undefined) {
        if (!roles.includes(req.body.role))
          return res.status(400).json({ message: "Invalid admin role." });
        update.role = req.body.role;
        update.isAdmin = req.body.role === "Super Admin";
      }
      if (req.body.status !== undefined) {
        if (!statuses.includes(req.body.status))
          return res.status(400).json({ message: "Invalid account status." });
        if (
          String(req.params.id) === String(req.user._id) &&
          req.body.status !== "Active"
        ) {
          return res
            .status(400)
            .json({ message: "You cannot deactivate your own account." });
        }
        update.status = req.body.status;
      }
      if (!Object.keys(update).length)
        return res
          .status(400)
          .json({ message: "No access changes were provided." });
      const admin = await Admin.findByIdAndUpdate(req.params.id, update, {
        new: true,
        runValidators: true,
      }).select("name email role status isAdmin pic createdAt lastLogin");
      if (!admin)
        return res.status(404).json({ message: "Admin account not found." });
      res.json(admin);
    } catch (error) {
      res.status(500).json({ message: "Unable to update admin access." });
    }
  },
);

// Permanently remove a staff account. A Super Admin cannot delete their own
// account from an active session, which avoids accidentally removing the last
// administrator able to manage the platform.
router.delete(
  "/:id",
  authenticate,
  authorizeAdmin,
  requireSuperAdmin,
  async (req, res) => {
    try {
      if (String(req.params.id) === String(req.user._id)) {
        return res
          .status(400)
          .json({
            message: "You cannot delete your own administrator account.",
          });
      }

      const admin = await Admin.findByIdAndDelete(req.params.id).select(
        "name email role status",
      );
      if (!admin)
        return res
          .status(404)
          .json({ message: "Administrator account not found." });

      res
        .status(200)
        .json({
          message: "Administrator account deleted.",
          id: String(admin._id),
        });
    } catch (error) {
      if (error.name === "CastError")
        return res
          .status(400)
          .json({ message: "Invalid administrator account." });
      console.error("Unable to delete administrator:", error);
      res
        .status(500)
        .json({ message: "Unable to delete administrator account." });
    }
  },
);

module.exports = router;
