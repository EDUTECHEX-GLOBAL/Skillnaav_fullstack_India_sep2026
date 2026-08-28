// models/Ticket.js
const mongoose = require("mongoose");

// ─── Category constants ───────────────────────────────────────────────────────
const STUDENT_CATEGORIES = [
  "Technical Issue",
  "Billing & Payments",
  "Internship Access",
  "Account Issue",
  "Student Management",
  "General Inquiry",
];

const SCHOOL_ADMIN_CATEGORIES = [
  "Technical Issue",
  "Account Issue",
  "Upload Credentials CSV",
  "Subscription",
  "User Management",
  "General Inquiry",
];

const PARTNER_CATEGORIES = [
  "Technical Issue",
  "Subscription Issues",
  "Account Issues",
  "Posted Internship Issues",
  "General Inquiry",
];

const ALL_CATEGORIES = [...new Set([
  ...STUDENT_CATEGORIES,
  ...SCHOOL_ADMIN_CATEGORIES,
  ...PARTNER_CATEGORIES,
])];

// ─── Schema ───────────────────────────────────────────────────────────────────
const ticketSchema = new mongoose.Schema(
  {
    // ── Student / Requester info ──────────────────────────────────────────────
    studentId:    { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    studentName:  { type: String, default: "" },
    studentEmail: { type: String, default: "" },

    // ── Partner info ──────────────────────────────────────────────────────────
    partnerId:  { type: mongoose.Schema.Types.ObjectId, ref: "Partner", default: null },
    senderName: { type: String, default: "" },

    // ── KEY ROUTING FIELD ─────────────────────────────────────────────────────
    senderType: {
      type:    String,
      default: "student",
      enum:    ["student", "partner"],
      index:   true,
    },

    // ── School info ───────────────────────────────────────────────────────────
    school:          { type: String, default: "" },
    schoolName:      { type: String, default: "" },
    schoolAdminId:   { type: mongoose.Schema.Types.ObjectId, ref: "SchoolAdmin", default: null },
    schoolAdminName: { type: String, default: "" },

    // ── Ticket content ────────────────────────────────────────────────────────
    subject:     { type: String, required: true },
    description: { type: String, required: true },

    category: {
      type:    String,
      default: "General Inquiry",
      enum: {
        values:  ALL_CATEGORIES,
        message: `"{VALUE}" is not a valid category.`,
      },
    },

    priority: {
      type:    String,
      default: "medium",
      enum:    ["low", "medium", "high", "urgent"],
    },

    status: {
      type:    String,
      default: "open",
      enum:    ["open", "in-progress", "resolved", "closed"],
    },

    // ── Course / Internship Name ──────────────────────────────────────────────
    // Populated when category === "Internship Access"
    courseName: { type: String, default: "" },

    // ── Routing flags (school tickets) ───────────────────────────────────────
    isSchoolTicket:      { type: Boolean, default: false, index: true },
    raisedBySchoolAdmin: { type: Boolean, default: false, index: true },

    // ── Escalation (school → admin) ───────────────────────────────────────────
    escalated:        { type: Boolean, default: false },
    escalationReason: { type: String,  default: "" },
    escalatedBy: {
      id:     { type: mongoose.Schema.Types.ObjectId, default: null },
      name:   { type: String, default: "" },
      school: { type: String, default: "" },
    },
    escalatedAt: { type: Date, default: null },

    // ── Escalation to Partner (admin → partner) ───────────────────────────────
    escalatedToPartner: { type: Boolean, default: false },

    // Audit trail for the admin→partner escalation
    escalationMeta: {
      partnerId:       { type: mongoose.Schema.Types.ObjectId, ref: "Partner", default: null },
      forwardedBy:     { type: String, default: "" },   // admin name who escalated
      forwardedAt:     { type: Date,   default: null },
      internshipTitle: { type: String, default: "" },   // snapshot of internship name at escalation time
      reason:          { type: String, default: "" },   // reason text entered in EscalateModal
    },

    // ── Forward to Partner (legacy / alternate path) ──────────────────────────
    forwardedToPartner: {
      id:          { type: mongoose.Schema.Types.ObjectId, ref: "Partner", default: null },
      name:        { type: String, default: "" },
      forwardedAt: { type: Date, default: null },
    },

    // ── Forward from Student ──────────────────────────────────────────────────
    forwardedFrom: {
      ticketId:     { type: mongoose.Schema.Types.ObjectId, ref: "Ticket", default: null },
      studentName:  { type: String, default: "" },
      studentEmail: { type: String, default: "" },
      forwardedBy:  { type: String, default: "" },
      forwardedAt:  { type: Date, default: null },
    },

    // ── Assignment ────────────────────────────────────────────────────────────
    assignedTo: {
      id:    { type: mongoose.Schema.Types.ObjectId, default: null },
      name:  { type: String, default: "" },
      email: { type: String, default: "" },
      role:  { type: String, default: "" },
    },

    // ── Message cache ─────────────────────────────────────────────────────────
    lastMessage:     { type: String, default: "" },
    lastMessageTime: { type: Date,   default: null },
    lastActivity:    { type: Date,   default: null },
    unreadCount:     { type: Number, default: 0 },

    // ── Optional internship context ───────────────────────────────────────────
    internshipId:    { type: mongoose.Schema.Types.ObjectId, ref: "Internship", default: null },
    internshipTitle: { type: String, default: "" },

    // ── Attachments ───────────────────────────────────────────────────────────
    attachments: [
      {
        filename: String,
        fileId:   String,
        size:     Number,
        type:     String,
      },
    ],
  },
  { timestamps: true }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
ticketSchema.index({ senderType: 1, lastActivity: -1 });
ticketSchema.index({ senderType: 1, status: 1 });
ticketSchema.index({ senderType: 1, partnerId: 1 });
ticketSchema.index({ "forwardedToPartner.id": 1 });
ticketSchema.index({ isSchoolTicket: 1, status: 1, createdAt: -1 });
ticketSchema.index({ isSchoolTicket: 1, raisedBySchoolAdmin: 1, status: 1 });
ticketSchema.index({ isSchoolTicket: 1, escalated: 1 });
ticketSchema.index({ studentId: 1, createdAt: -1 });
ticketSchema.index({ school: 1, createdAt: -1 });
ticketSchema.index({ status: 1, priority: -1 });
// ── New: fast lookup of all tickets escalated to a partner ────────────────────
ticketSchema.index({ escalatedToPartner: 1, status: 1 });
ticketSchema.index({ "escalationMeta.partnerId": 1 });

// ─── Static helpers ───────────────────────────────────────────────────────────
ticketSchema.statics.getCategoriesFor = function (type) {
  if (type === "partner")      return PARTNER_CATEGORIES;
  if (type === "school-admin") return SCHOOL_ADMIN_CATEGORIES;
  return STUDENT_CATEGORIES;
};

ticketSchema.statics.validateCategory = function (category, type) {
  const allowed = this.getCategoriesFor(type);
  if (!category) return null;
  if (!allowed.includes(category)) {
    return `"${category}" is not valid for this ticket type. Allowed: ${allowed.join(", ")}`;
  }
  return null;
};

// ─── Model ────────────────────────────────────────────────────────────────────
const Ticket = mongoose.models.Ticket || mongoose.model("Ticket", ticketSchema);

module.exports = Ticket;
module.exports.STUDENT_CATEGORIES      = STUDENT_CATEGORIES;
module.exports.SCHOOL_ADMIN_CATEGORIES = SCHOOL_ADMIN_CATEGORIES;
module.exports.PARTNER_CATEGORIES      = PARTNER_CATEGORIES;
module.exports.ALL_CATEGORIES          = ALL_CATEGORIES;