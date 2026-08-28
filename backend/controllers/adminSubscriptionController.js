// controllers/adminSubscriptionController.js

const User = require("../models/webapp-models/userModel");
const Partner = require("../models/webapp-models/partnerModel");
const Payment = require("../models/webapp-models/PaymentModel");
const PartnerPayment = require("../models/webapp-models/PartnerPaymentModel");

// ─── Helpers ─────────────────────────────────────────────────────────────────

const EXPIRING_SOON_DAYS = 7;

const getStatus = (entity) => {
  if (!entity.isPremium) return "Free";
  if (!entity.premiumExpiration) return "Active"; // lifetime / no expiry set

  const now = new Date();
  const expiry = new Date(entity.premiumExpiration);

  if (expiry < now) return "Expired";

  const diffDays = (expiry - now) / (1000 * 60 * 60 * 24);
  if (diffDays <= EXPIRING_SOON_DAYS) return "Expiring Soon";

  return "Active";
};

const getDaysLeft = (expiry) => {
  if (!expiry) return null;
  return Math.ceil((new Date(expiry) - new Date()) / (1000 * 60 * 60 * 24));
};

// ─── GET /api/admin/subscriptions/students ───────────────────────────────────

exports.getStudentSubscriptions = async (req, res) => {
  try {
    const { status, search } = req.query;

    const users = await User.find({})
      .select(
        "name email planType isPremium premiumExpiration createdAt " +
        "universityName educationLevel fieldOfStudy desiredField " +
        "isGoogleUser isActive adminApproved status careerChatUsage"
      )
      .sort({ createdAt: -1 })
      .lean();

    let data = users.map((u) => {
      const computedStatus = getStatus(u);
      return {
        id: u._id,
        name: u.name || "Unknown",
        email: u.email || "-",
        // Subscription
        plan: u.planType || "Free",
        status: computedStatus,
        expiry: u.premiumExpiration || null,
        daysLeft: getDaysLeft(u.premiumExpiration),
        // Profile
        universityName: u.universityName || null,
        educationLevel: u.educationLevel || null,
        fieldOfStudy: u.fieldOfStudy || null,
        desiredField: u.desiredField || null,
        // Account
        isGoogleUser: u.isGoogleUser || false,
        isActive: u.isActive || false,
        adminApproved: u.adminApproved || false,
        approvalStatus: u.status || "Pending",   // Pending | Approved | Rejected
        careerChatUsage: u.careerChatUsage || 0,
        joinedAt: u.createdAt,
      };
    });

    if (status && status !== "All") {
      data = data.filter((d) => d.status === status);
    }

    if (search) {
      const q = search.toLowerCase();
      data = data.filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          d.email.toLowerCase().includes(q) ||
          (d.plan && d.plan.toLowerCase().includes(q)) ||
          (d.universityName && d.universityName.toLowerCase().includes(q)) ||
          (d.educationLevel && d.educationLevel.toLowerCase().includes(q)) ||
          (d.fieldOfStudy && d.fieldOfStudy.toLowerCase().includes(q))
      );
    }

    // Summary always from unfiltered full set
    const allStatuses = users.map((u) => getStatus(u));
    const summary = {
      total: users.length,
      active: allStatuses.filter((s) => s === "Active").length,
      expired: allStatuses.filter((s) => s === "Expired").length,
      expiringSoon: allStatuses.filter((s) => s === "Expiring Soon").length,
      free: allStatuses.filter((s) => s === "Free").length,
    };

    res.json({ success: true, data, summary });
  } catch (err) {
    console.error("Student subscription error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── GET /api/admin/subscriptions/partners ───────────────────────────────────

exports.getPartnerSubscriptions = async (req, res) => {
  try {
    const { status, search } = req.query;

    const partners = await Partner.find({})
      .select(
        "name email planType isPremium premiumExpiration createdAt " +
        "universityName institutionId " +
        "isGoogleUser adminApproved status active"
      )
      .sort({ createdAt: -1 })
      .lean();

    let data = partners.map((p) => {
      const computedStatus = getStatus(p);
      return {
        id: p._id,
        company: p.name || "Unknown",
        email: p.email || "-",
        // Subscription
        plan: p.planType || "Freemium",
        status: computedStatus,
        expiry: p.premiumExpiration || null,
        daysLeft: getDaysLeft(p.premiumExpiration),
        // Institution
        universityName: p.universityName || null,
        institutionId: p.institutionId || null,
        // Account
        isGoogleUser: p.isGoogleUser || false,
        adminApproved: p.adminApproved || false,
        approvalStatus: p.status || "Pending",   // Pending | Approved | Rejected
        isActive: p.active || false,
        joinedAt: p.createdAt,
      };
    });

    if (status && status !== "All") {
      data = data.filter((d) => d.status === status);
    }

    if (search) {
      const q = search.toLowerCase();
      data = data.filter(
        (d) =>
          d.company.toLowerCase().includes(q) ||
          d.email.toLowerCase().includes(q) ||
          (d.plan && d.plan.toLowerCase().includes(q)) ||
          (d.universityName && d.universityName.toLowerCase().includes(q)) ||
          (d.institutionId && d.institutionId.toLowerCase().includes(q))
      );
    }

    const allStatuses = partners.map((p) => getStatus(p));
    const summary = {
      total: partners.length,
      active: allStatuses.filter((s) => s === "Active").length,
      expired: allStatuses.filter((s) => s === "Expired").length,
      expiringSoon: allStatuses.filter((s) => s === "Expiring Soon").length,
      free: allStatuses.filter((s) => s === "Free").length,
    };

    res.json({ success: true, data, summary });
  } catch (err) {
    console.error("Partner subscription error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── GET /api/admin/subscriptions/overview ───────────────────────────────────

exports.getSubscriptionOverview = async (req, res) => {
  try {
    const [users, partners, payments, partnerPayments] = await Promise.all([
      User.find({}).select("isPremium premiumExpiration planType createdAt").lean(),
      Partner.find({}).select("isPremium premiumExpiration planType createdAt").lean(),
      Payment.find({ status: "Success" }).select("amount createdAt").lean(),
      PartnerPayment.find({ status: "Success" }).select("amount createdAt").lean(),
    ]);

    const calculateStats = (list) => {
      const statusCounts = { active: 0, expired: 0, free: 0, expiringSoon: 0 };
      const planCounts = {};

      list.forEach((item) => {
        const s = getStatus(item);
        if (s === "Active") statusCounts.active++;
        else if (s === "Expired") statusCounts.expired++;
        else if (s === "Free") statusCounts.free++;
        else if (s === "Expiring Soon") statusCounts.expiringSoon++;

        const plan = item.planType || "Free";
        planCounts[plan] = (planCounts[plan] || 0) + 1;
      });

      return {
        total: list.length,
        ...statusCounts,
        planBreakdown: Object.entries(planCounts).map(([plan, count]) => ({
          plan,
          count,
          pct: Math.round((count / list.length) * 100) || 0,
        })),
      };
    };

    const studentRevenue = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const partnerRevenue = partnerPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const totalRevenue = studentRevenue + partnerRevenue;

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const newStudents = users.filter(
      (u) => u.isPremium && new Date(u.createdAt) >= thirtyDaysAgo
    ).length;
    const newPartners = partners.filter(
      (p) => p.isPremium && new Date(p.createdAt) >= thirtyDaysAgo
    ).length;

    res.json({
      success: true,
      data: {
        students: calculateStats(users),
        partners: calculateStats(partners),
        revenue: {
          total: totalRevenue,
          fromStudents: studentRevenue,
          fromPartners: partnerRevenue,
        },
        newThisMonth: {
          students: newStudents,
          partners: newPartners,
        },
      },
    });
  } catch (err) {
    console.error("Overview error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};