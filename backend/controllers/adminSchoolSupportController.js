// controllers/adminSchoolSupportController.js
// Mounted at: /api/support/admin/school-admin
//
// Used by MAIN ADMIN to see & reply to tickets raised BY school admins.
// KEY FILTER: { isSchoolTicket: true, raisedBySchoolAdmin: true }

const Ticket              = require("../models/Ticket");
const { Message, decryptMessages }         = require("../models/Message");   // ← FIXED: destructured
const mongoose            = require("mongoose");
const { upload }          = require("../middlewares/uploadMiddleware");

exports.uploadMiddleware = upload.array("files", 5);

// ── Base query ────────────────────────────────────────────────────────────────
const BASE = { isSchoolTicket: true, raisedBySchoolAdmin: true };

// ── Socket helpers ────────────────────────────────────────────────────────────
const toRoom   = (io, room,     ev, d) => { try { io?.to(room).emit(ev, d);              } catch (_) {} };
const toTicket = (io, ticketId, ev, d) => { try { io?.to(String(ticketId)).emit(ev, d); } catch (_) {} };
const toSchool = (io, school,   ev, d) => {
  if (!school) return;
  try { io?.to(`school_admin_${String(school).replace(/\s+/g, "_")}`).emit(ev, d); } catch (_) {}
};

// ── Strip binary before sending over wire ────────────────────────────────────
const safe = (msg) => {
  if (!msg) return msg;
  const obj = typeof msg.toObject === "function" ? msg.toObject() : { ...msg };
  return {
    ...obj,
    attachments: (obj.attachments || []).map((att) => {
      const { data: _omit, ...meta } = att;
      if (meta._id) meta._id = meta._id.toString();
      return meta;
    }),
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /stats
// ─────────────────────────────────────────────────────────────────────────────
exports.getStats = async (req, res) => {
  try {
    const ticketIds = await Ticket.find(BASE).distinct("_id");

    const [total, open, inProgress, resolved, urgent, unreadMessages, escalated] = await Promise.all([
      Ticket.countDocuments(BASE),
      Ticket.countDocuments({ ...BASE, status: "open" }),
      Ticket.countDocuments({ ...BASE, status: "in-progress" }),
      Ticket.countDocuments({ ...BASE, status: { $in: ["resolved", "closed"] } }),
      Ticket.countDocuments({ ...BASE, priority: "urgent" }),
      Message.countDocuments({ ticketId: { $in: ticketIds }, senderRole: "school-admin", read: false }),
      Ticket.countDocuments({ ...BASE, escalated: true }),
    ]);

    res.json({ stats: { total, open, inProgress, resolved, urgent, unreadMessages, escalated } });
  } catch (err) {
    console.error("adminSchoolSupportController.getStats:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /tickets
// ─────────────────────────────────────────────────────────────────────────────
exports.getTickets = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, priority, category, sort = "newest", search, school, escalated } = req.query;

    const query = { ...BASE };
    if (status   && status   !== "all") query.status   = status;
    if (priority && priority !== "all") query.priority = priority;
    if (category && category !== "all") query.category = category;
    if (school   && school   !== "all") query.school   = { $regex: school, $options: "i" };
    if (escalated === "true")           query.escalated = true;
    if (search) {
      query.$or = [
        { subject:         { $regex: search, $options: "i" } },
        { description:     { $regex: search, $options: "i" } },
        { school:          { $regex: search, $options: "i" } },
        { schoolAdminName: { $regex: search, $options: "i" } },
        { category:        { $regex: search, $options: "i" } },
      ];
    }

    const sortMap = {
      newest:   { createdAt: -1 },
      oldest:   { createdAt:  1 },
      priority: { priority: -1, createdAt: -1 },
      status:   { status:    1, createdAt: -1 },
    };

    const skip = (Number(page) - 1) * Number(limit);
    const [tickets, total] = await Promise.all([
      Ticket.find(query).sort(sortMap[sort] || { createdAt: -1 }).skip(skip).limit(Number(limit)).lean(),
      Ticket.countDocuments(query),
    ]);

    const ids = tickets.map(t => t._id);
    const [lastMsgs, unreadCounts] = await Promise.all([
      Message.aggregate([
        { $match: { ticketId: { $in: ids } } },
        { $sort:  { createdAt: -1 } },
        { $group: { _id: "$ticketId", lastMessage: { $first: "$text" }, lastMessageTime: { $first: "$createdAt" }, lastMessageSender: { $first: "$senderRole" } } },
      ]),
      Message.aggregate([
        { $match: { ticketId: { $in: ids }, senderRole: "school-admin", read: false } },
        { $group: { _id: "$ticketId", count: { $sum: 1 } } },
      ]),
    ]);

    const lastMsgMap = Object.fromEntries(lastMsgs.map(m    => [m._id.toString(), m]));
    const unreadMap  = Object.fromEntries(unreadCounts.map(u => [u._id.toString(), u.count]));

    const enriched = tickets.map(t => {
      const lm = lastMsgMap[t._id.toString()];
      return {
        ...t,
        lastMessage:     lm?.lastMessage     ?? t.lastMessage     ?? "",
        lastMessageTime: lm?.lastMessageTime ?? t.lastMessageTime ?? t.createdAt,
        lastMessageSender: lm?.lastMessageSender ?? t.lastMessageSender ?? "",
        unreadCount:     unreadMap[t._id.toString()] || 0,
        unread:         (unreadMap[t._id.toString()] || 0) > 0,
      };
    });

    res.json({ tickets: enriched, total, totalPages: Math.ceil(total / Number(limit)), currentPage: Number(page) });
  } catch (err) {
    console.error("adminSchoolSupportController.getTickets:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /ticket/:ticketId
// ─────────────────────────────────────────────────────────────────────────────
exports.getTicketById = async (req, res) => {
  try {
    const ticket = await Ticket.findOne({ _id: req.params.ticketId, ...BASE }).lean();
    if (!ticket) return res.status(404).json({ message: "Ticket not found" });
    const messageCount = await Message.countDocuments({ ticketId: ticket._id });
    res.json({ ticket: { ...ticket, messages: messageCount } });
  } catch (err) {
    console.error("adminSchoolSupportController.getTicketById:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /messages/:ticketId
// ─────────────────────────────────────────────────────────────────────────────
exports.getMessages = async (req, res) => {
  try {
    const ticket = await Ticket.findOne({ _id: req.params.ticketId, ...BASE });
    if (!ticket) return res.status(403).json({ message: "Access denied" });

    const raw = await Message.find({ ticketId: req.params.ticketId }).sort({ createdAt: 1 }).lean();
    const messages = decryptMessages(raw).map(msg => ({
      ...msg,
      attachments: (msg.attachments || []).map(({ data: _omit, ...meta }) => ({
        ...meta,
        _id: meta._id ? meta._id.toString() : meta._id,
      })),
    }));

    const result = await Message.updateMany(
      { ticketId: req.params.ticketId, senderRole: "school-admin", read: false },
      { $set: { read: true, readAt: new Date() } }
    );
    if (result.modifiedCount > 0) {
      const io = req.app.get("io");
      toSchool(io, ticket.school, "messages_read", { ticketId: req.params.ticketId });
      toRoom(io, "admin_room",    "messages_read", { ticketId: req.params.ticketId });
    }

    res.json({ messages });
  } catch (err) {
    console.error("adminSchoolSupportController.getMessages:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /message/:ticketId  — buffer storage (memoryStorage)
// ─────────────────────────────────────────────────────────────────────────────
exports.sendMessage = async (req, res) => {
  try {
    const { ticketId }      = req.params;
    const { text, replyTo } = req.body;
    const files             = req.files || [];

    const ticket = await Ticket.findOne({ _id: ticketId, ...BASE });
    if (!ticket) return res.status(404).json({ message: "Ticket not found" });

    if (!text?.trim() && !files.length)
      return res.status(400).json({ message: "Message text or attachment required" });

    const attachments = files.map(f => ({
      filename: f.originalname,
      mimetype: f.mimetype,
      size:     f.size,
      data:     f.buffer,
    }));

    const doc = await Message.create({
      ticketId,
      senderId:   req.user._id,
      senderName: req.user.name || "Main Admin",
      senderRole: "admin",
      text:       text?.trim() || "",
      attachments,
      replyTo:    replyTo || null,
      read:       false,
    });

    const safeMsg = safe(doc);

    await Ticket.findByIdAndUpdate(ticketId, {
      lastMessage:     safeMsg.text || (files.length ? files[0].originalname : ""),
      lastMessageTime: doc.createdAt,
    });

    const io = req.app.get("io");
    toTicket(io, ticketId,      "new_message", { ticketId, message: safeMsg });
    toRoom(io, "admin_room",    "new_message", { ticketId, message: safeMsg });
    toSchool(io, ticket.school, "new_message", { ticketId, message: safeMsg });

    res.status(201).json({ message: safeMsg });
  } catch (err) {
    console.error("adminSchoolSupportController.sendMessage:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /mark-read/:ticketId
// ─────────────────────────────────────────────────────────────────────────────
exports.markMessagesAsRead = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const ticket = await Ticket.findOne({ _id: ticketId, ...BASE });
    if (!ticket) return res.status(403).json({ message: "Access denied" });

    const result = await Message.updateMany(
      { ticketId, senderRole: "school-admin", read: false },
      { $set: { read: true, readAt: new Date() } }
    );
    if (result.modifiedCount > 0) {
      const io = req.app.get("io");
      toSchool(io, ticket.school, "messages_read", { ticketId });
      toRoom(io, "admin_room",    "messages_read", { ticketId });
    }
    res.json({ message: "Marked as read", markedCount: result.modifiedCount });
  } catch (err) {
    console.error("adminSchoolSupportController.markMessagesAsRead:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT /ticket/:ticketId/status
// ─────────────────────────────────────────────────────────────────────────────
exports.updateTicketStatus = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { status }   = req.body;
    if (!["open", "in-progress", "resolved", "closed"].includes(status))
      return res.status(400).json({ message: "Invalid status" });

    const ticket = await Ticket.findOneAndUpdate({ _id: ticketId, ...BASE }, { status }, { new: true });
    if (!ticket) return res.status(404).json({ message: "Ticket not found" });

    const sysDoc = await Message.create({
      ticketId, senderId: req.user._id, senderName: "System",
      senderRole: "system", text: `Ticket status updated to "${status}" by Main Admin`, read: true,
    });
    const safeMsg = safe(sysDoc);
    const payload = { ticketId, status, message: safeMsg };
    const io      = req.app.get("io");
    toTicket(io, ticketId,      "ticket_status_update", payload);
    toSchool(io, ticket.school, "ticket_status_update", payload);
    toRoom(io, "admin_room",    "ticket_status_update", payload);

    res.json({ message: "Status updated", ticket, systemMessage: safeMsg });
  } catch (err) {
    console.error("adminSchoolSupportController.updateTicketStatus:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT /ticket/:ticketId/assign
// ─────────────────────────────────────────────────────────────────────────────
exports.assignTicket = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const assignedTo   = { id: req.user._id, name: req.user.name || "Main Admin", email: req.user.email || "", role: "admin" };

    const ticket = await Ticket.findOneAndUpdate({ _id: ticketId, ...BASE }, { assignedTo }, { new: true });
    if (!ticket) return res.status(404).json({ message: "Ticket not found" });

    const sysDoc = await Message.create({
      ticketId, senderId: req.user._id, senderName: "System",
      senderRole: "system", text: `Ticket assigned to Main Admin: ${req.user.name || "Admin"}`, read: true,
    });
    const safeMsg = safe(sysDoc);
    const payload = { ticketId, assignedTo: ticket.assignedTo, message: safeMsg };
    const io      = req.app.get("io");
    toTicket(io, ticketId,      "ticket_assigned", payload);
    toSchool(io, ticket.school, "ticket_assigned", payload);
    toRoom(io, "admin_room",    "ticket_assigned", payload);

    res.json({ ticket, systemMessage: safeMsg });
  } catch (err) {
    console.error("adminSchoolSupportController.assignTicket:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /message/:messageId
// ─────────────────────────────────────────────────────────────────────────────
exports.deleteMessage = async (req, res) => {
  try {
    const msg = await Message.findById(req.params.messageId);
    if (!msg) return res.status(404).json({ message: "Message not found" });
    if (msg.senderRole !== "admin")
      return res.status(403).json({ message: "You can only delete your own messages" });

    await Message.findByIdAndDelete(req.params.messageId);

    const io = req.app.get("io");
    toRoom(io, "admin_room",              "message_deleted", { messageId: msg._id, ticketId: msg.ticketId });
    toTicket(io, msg.ticketId.toString(), "message_deleted", { messageId: msg._id, ticketId: msg.ticketId });

    res.json({ message: "Message deleted" });
  } catch (err) {
    console.error("adminSchoolSupportController.deleteMessage:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /file/:attachmentId          — download (Save-As)
// GET /file/:attachmentId/preview  — inline (browser renders)
// Both require only authenticate — not authorizeAdmin
// ─────────────────────────────────────────────────────────────────────────────
const findAttachment = async (attachmentId) => {
  const oid     = new mongoose.Types.ObjectId(attachmentId);
  const message = await Message.findOne({ "attachments._id": oid }).lean();
  if (!message) return null;
  return message.attachments.find(a => a._id.toString() === attachmentId) || null;
};

exports.downloadFile = async (req, res) => {
  try {
    const { attachmentId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(attachmentId))
      return res.status(400).json({ message: "Invalid attachment ID" });

    const att = await findAttachment(attachmentId);
    if (!att || !att.data)
      return res.status(404).json({ message: "File not found" });

    const buf = Buffer.isBuffer(att.data) ? att.data : Buffer.from(att.data.buffer || att.data);
    res.set("Content-Type",        att.mimetype || "application/octet-stream");
    res.set("Content-Disposition", `attachment; filename="${encodeURIComponent(att.filename)}"`);
    res.set("Content-Length",      buf.length);
    res.set("Cache-Control",       "private, max-age=3600");
    res.end(buf);
  } catch (err) {
    console.error("adminSchoolSupportController.downloadFile:", err);
    if (!res.headersSent) res.status(500).json({ message: "Server error", error: err.message });
  }
};

exports.previewFile = async (req, res) => {
  try {
    const { attachmentId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(attachmentId))
      return res.status(400).json({ message: "Invalid attachment ID" });

    const att = await findAttachment(attachmentId);
    if (!att || !att.data)
      return res.status(404).json({ message: "File not found" });

    const buf = Buffer.isBuffer(att.data) ? att.data : Buffer.from(att.data.buffer || att.data);
    res.set("Content-Type",        att.mimetype || "application/octet-stream");
    res.set("Content-Disposition", `inline; filename="${encodeURIComponent(att.filename)}"`);
    res.set("Content-Length",      buf.length);
    res.set("Cache-Control",       "private, max-age=3600");
    res.end(buf);
  } catch (err) {
    console.error("adminSchoolSupportController.previewFile:", err);
    if (!res.headersSent) res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /schools  — distinct school names for filter dropdown
// ─────────────────────────────────────────────────────────────────────────────
exports.getSchoolList = async (req, res) => {
  try {
    const schools = await Ticket.distinct("school", BASE);
    res.json({ schools: schools.filter(Boolean).sort() });
  } catch (err) {
    console.error("adminSchoolSupportController.getSchoolList:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
