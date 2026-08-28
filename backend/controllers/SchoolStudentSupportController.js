// controllers/schoolStudentSupportController.js
// Mounted at: /api/support/school-students
//
// Used by PLATFORM ADMINS to view & reply to escalated school STUDENT tickets.
// KEY FILTER: { isSchoolTicket: true, raisedBySchoolAdmin: { $ne: true }, escalated: true }
//
// ✅ FIXES IN THIS VERSION:
//   1. uploadMiddleware exported and used in route  ← THE MAIN FIX (files now save to MongoDB)
//   2. serveFile uses robust toBuffer() instead of Buffer.from(att.data.buffer || att.data)
//      which fails for BSON Binary from mongodb driver v4+

const Ticket      = require("../models/Ticket");
const { Message, decryptMessages, decryptText } = require("../models/Message");
const mongoose    = require("mongoose");
const { upload }  = require("../middlewares/uploadMiddleware");

// ✅ FIX 1: Export uploadMiddleware so the route can apply it.
//    Previously this was exported but the route never used it — so multer
//    never ran, req.files was always [], and attachments was always [].
exports.uploadMiddleware = upload.array("files", 5);

// ── helper — defined at TOP so every function below can use it ────────────────
const io_from = (req) => req.app.get("io");

// ── Base query ────────────────────────────────────────────────────────────────
const BASE = {
  isSchoolTicket:      true,
  raisedBySchoolAdmin: { $ne: true },
  escalated:           { $eq: true },
};

// ── Socket helpers ────────────────────────────────────────────────────────────
const toRoom   = (io, room,     ev, d) => { try { io?.to(room).emit(ev, d);              } catch (_) {} };
const toTicket = (io, ticketId, ev, d) => { try { io?.to(String(ticketId)).emit(ev, d); } catch (_) {} };
const toUser   = (io, userId,   ev, d) => { try { io?.to(`user_${userId}`).emit(ev, d); } catch (_) {} };
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

// ✅ FIX 2: Robust toBuffer() — handles BSON Binary from all mongodb driver versions.
//    The old code used Buffer.from(att.data.buffer || att.data) which fails
//    for mongodb driver v4+ where att.data is a BSON Binary object, not a plain Buffer.
const toBuffer = (data) => {
  if (!data) return null;
  if (Buffer.isBuffer(data)) return data;
  if (data instanceof Uint8Array) return Buffer.from(data);
  if (data && typeof data === "object") {
    // BSON Binary: .value() is most reliable across all driver versions
    if (typeof data.value === "function") {
      try {
        const v = data.value();
        if (Buffer.isBuffer(v))      return v;
        if (typeof v === "string")   return Buffer.from(v, "binary");
        if (v instanceof Uint8Array) return Buffer.from(v);
      } catch (_) {}
    }
    // BSON Binary: .buffer is a Node.js Buffer (driver v3)
    if (data.buffer && Buffer.isBuffer(data.buffer)) return data.buffer;
    // BSON Binary: .buffer is an ArrayBuffer (driver v4+)
    if (data.buffer instanceof ArrayBuffer) return Buffer.from(new Uint8Array(data.buffer));
    // Object with numeric keys (old BSON serialisation fallback)
    if (typeof data.length === "number" && data[0] !== undefined) return Buffer.from(Object.values(data));
  }
  if (typeof data === "string") return Buffer.from(data, "base64");
  return null;
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /stats
// ─────────────────────────────────────────────────────────────────────────────
exports.getStats = async (req, res) => {
  try {
    const ticketIds = await Ticket.find(BASE).distinct("_id");

    const [total, open, inProgress, resolved, urgent, unreadMessages] = await Promise.all([
      Ticket.countDocuments(BASE),
      Ticket.countDocuments({ ...BASE, status: "open" }),
      Ticket.countDocuments({ ...BASE, status: "in-progress" }),
      Ticket.countDocuments({ ...BASE, status: { $in: ["resolved", "closed"] } }),
      Ticket.countDocuments({ ...BASE, priority: "urgent" }),
      Message.countDocuments({
        ticketId:   { $in: ticketIds },
        senderRole: { $in: ["user", "school-admin"] },
        read:       false,
      }),
    ]);

    res.json({ stats: { total, open, inProgress, resolved, urgent, unreadMessages } });
  } catch (err) {
    console.error("schoolStudentSupportController.getStats:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /tickets
// ─────────────────────────────────────────────────────────────────────────────
exports.getAllTickets = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, priority, category, sort = "newest", search } = req.query;

    const query = { ...BASE };
    if (status   && status   !== "all") query.status   = status;
    if (priority && priority !== "all") query.priority = priority;
    if (category && category !== "all") query.category = category;
    if (search) {
      query.$or = [
        { studentName:  { $regex: search, $options: "i" } },
        { studentEmail: { $regex: search, $options: "i" } },
        { subject:      { $regex: search, $options: "i" } },
        { school:       { $regex: search, $options: "i" } },
        { schoolName:   { $regex: search, $options: "i" } },
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
        { $match: { ticketId: { $in: ids }, senderRole: { $in: ["user", "school-admin"] }, read: false } },
        { $group: { _id: "$ticketId", count: { $sum: 1 } } },
      ]),
    ]);

    const lastMsgMap = Object.fromEntries(lastMsgs.map(m    => [m._id.toString(), m]));
    const unreadMap  = Object.fromEntries(unreadCounts.map(u => [u._id.toString(), u.count]));

    const enriched = tickets.map(t => {
      const lm          = lastMsgMap[t._id.toString()];
      const unreadCount = unreadMap[t._id.toString()] || 0;
      return {
        ...t,
        schoolName:       t.schoolName || t.school || "",
        escalated:        true,
        escalationReason: t.escalationReason || "",
        escalatedBy:      t.escalatedBy      || null,
        escalatedAt:      t.escalatedAt      || null,
        lastMessage:      lm?.lastMessage ? decryptText(lm.lastMessage) : (t.lastMessage ?? ""),
        lastMessageTime:  lm?.lastMessageTime ?? t.lastMessageTime ?? t.createdAt,
        lastMessageSender: lm?.lastMessageSender ?? t.lastMessageSender ?? "",
        unreadCount,
        unread:           unreadCount > 0,
      };
    });

    res.json({ tickets: enriched, total, totalPages: Math.ceil(total / Number(limit)), currentPage: Number(page) });
  } catch (err) {
    console.error("schoolStudentSupportController.getAllTickets:", err);
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
    res.json({
      ticket: {
        ...ticket,
        schoolName:       ticket.schoolName || ticket.school || "",
        escalated:        true,
        escalationReason: ticket.escalationReason || "",
        escalatedBy:      ticket.escalatedBy      || null,
        escalatedAt:      ticket.escalatedAt      || null,
        messages:         messageCount,
      },
    });
  } catch (err) {
    console.error("schoolStudentSupportController.getTicketById:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /messages/:ticketId
// ─────────────────────────────────────────────────────────────────────────────
exports.getMessages = async (req, res) => {
  try {
    const ticket = await Ticket.findOne({ _id: req.params.ticketId, ...BASE }).lean();
    if (!ticket) return res.status(404).json({ message: "Ticket not found" });

    const raw = await Message.find({ ticketId: req.params.ticketId }).sort({ createdAt: 1 }).lean();
    const messages = decryptMessages(raw).map(msg => ({
      ...msg,
      attachments: (msg.attachments || []).map(({ data: _omit, ...meta }) => ({
        ...meta,
        _id: meta._id ? meta._id.toString() : meta._id,
      })),
    }));

    res.json({ messages });
  } catch (err) {
    console.error("schoolStudentSupportController.getMessages:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /message/:ticketId  — buffer storage
// ─────────────────────────────────────────────────────────────────────────────
exports.sendAdminMessage = async (req, res) => {
  try {
    const { ticketId }      = req.params;
    const { text, replyTo } = req.body;
    const files             = req.files || [];

    // Debug log — helps confirm multer is running and files are present
    console.log(`sendAdminMessage: ticketId=${ticketId} text="${text}" files=${files.length}`);

    const ticket = await Ticket.findOne({ _id: ticketId, ...BASE });
    if (!ticket) return res.status(404).json({ message: "Ticket not found" });

    if (!text?.trim() && !files.length)
      return res.status(400).json({ message: "Message text or attachment required" });

    // ✅ Each file from memoryStorage has a .buffer property (Node.js Buffer)
    //    This is what gets stored in the MongoDB `data` field.
    const attachments = files.map(f => ({
      filename: f.originalname,
      mimetype: f.mimetype,
      size:     f.size,
      data:     f.buffer,   // ← populated only when multer uses memoryStorage
    }));

    const doc = await Message.create({
      ticketId,
      senderId:   req.user._id,
      senderName: req.user.name || "Support Admin",
      senderRole: "admin",
      text:       text?.trim() || "",
      attachments,
      replyTo:    replyTo || null,
      read:       false,
    });

    const safeMsg = safe(doc);
    const school  = ticket.school || ticket.schoolName;

    let updatedStatus = ticket.status;
    const ticketUpdate = {
      lastMessage:     decryptText(safeMsg.text) || (files.length ? files[0].originalname : ""),
      lastMessageTime: doc.createdAt,
    };
    if (ticket.status === "open") {
      updatedStatus       = "in-progress";
      ticketUpdate.status = "in-progress";
    }
    await Ticket.findByIdAndUpdate(ticketId, ticketUpdate);

    const io = io_from(req);
    toTicket(io, ticketId,   "new_message", { ticketId, message: safeMsg });
    toRoom(io, "admin_room", "new_message", { ticketId, message: safeMsg });
    toSchool(io, school,     "new_message", { ticketId, message: safeMsg });
    if (ticket.studentId) toUser(io, ticket.studentId.toString(), "new_message", { ticketId, message: safeMsg });

    if (updatedStatus !== ticket.status) {
      const sp = { ticketId, status: updatedStatus };
      toTicket(io, ticketId,   "ticket_status_update", sp);
      toRoom(io, "admin_room", "ticket_status_update", sp);
      toSchool(io, school,     "ticket_status_update", sp);
    }

    res.status(201).json({ message: safeMsg });
  } catch (err) {
    console.error("schoolStudentSupportController.sendAdminMessage:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /mark-read/:ticketId
// ─────────────────────────────────────────────────────────────────────────────
exports.markMessagesAsRead = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const ticket = await Ticket.findOne({ _id: ticketId, ...BASE }).lean();
    if (!ticket) return res.status(404).json({ message: "Ticket not found" });

    const result = await Message.updateMany(
      { ticketId, senderRole: { $in: ["user", "school-admin"] }, read: false },
      { $set: { read: true, readAt: new Date() } }
    );
    if (result.modifiedCount > 0) {
      const io     = io_from(req);
      const school = ticket.school || ticket.schoolName;
      toRoom(io, "admin_room", "messages_read", { ticketId });
      toTicket(io, ticketId,   "messages_read", { ticketId });
      toSchool(io, school,     "messages_read", { ticketId });
    }
    res.json({ message: "Marked as read", markedCount: result.modifiedCount });
  } catch (err) {
    console.error("schoolStudentSupportController.markMessagesAsRead:", err);
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
      ticketId,
      senderId:   req.user._id,
      senderName: "System",
      senderRole: "system",
      text:       `Ticket status updated to "${status}" by Admin`,
      read:       true,
    });
    const safeMsg = safe(sysDoc);
    const school  = ticket.school || ticket.schoolName;
    const payload = { ticketId, status, message: safeMsg };
    const io      = io_from(req);

    toRoom(io, "admin_room", "ticket_status_update", payload);
    toTicket(io, ticketId,   "ticket_status_update", payload);
    toSchool(io, school,     "ticket_status_update", payload);
    if (ticket.studentId) toUser(io, ticket.studentId.toString(), "ticket_status_update", payload);

    res.json({ message: "Status updated", ticket, systemMessage: safeMsg });
  } catch (err) {
    console.error("schoolStudentSupportController.updateTicketStatus:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT /ticket/:ticketId/assign
// ─────────────────────────────────────────────────────────────────────────────
exports.assignTicket = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const assignedTo   = { id: req.user._id, name: req.user.name || "Admin", email: req.user.email };

    const ticket = await Ticket.findOneAndUpdate({ _id: ticketId, ...BASE }, { assignedTo }, { new: true });
    if (!ticket) return res.status(404).json({ message: "Ticket not found" });

    const sysDoc = await Message.create({
      ticketId,
      senderId:   req.user._id,
      senderName: "System",
      senderRole: "system",
      text:       `Ticket assigned to ${req.user.name || "Admin"}`,
      read:       true,
    });
    const safeMsg = safe(sysDoc);
    const school  = ticket.school || ticket.schoolName;
    const payload = { ticketId, assignedTo: ticket.assignedTo, message: safeMsg };
    const io      = io_from(req);

    toRoom(io, "admin_room", "ticket_assigned", payload);
    toTicket(io, ticketId,   "ticket_assigned", payload);
    toSchool(io, school,     "ticket_assigned", payload);

    res.json({ ticket, systemMessage: safeMsg });
  } catch (err) {
    console.error("schoolStudentSupportController.assignTicket:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /message/:messageId
// ─────────────────────────────────────────────────────────────────────────────
exports.deleteMessage = async (req, res) => {
  try {
    const message = await Message.findByIdAndDelete(req.params.messageId);
    if (!message) return res.status(404).json({ message: "Message not found" });

    const io = io_from(req);
    toTicket(io, message.ticketId.toString(), "message_deleted", { messageId: message._id, ticketId: message.ticketId });
    toRoom(io, "admin_room",                  "message_deleted", { messageId: message._id, ticketId: message.ticketId });

    res.json({ message: "Deleted" });
  } catch (err) {
    console.error("schoolStudentSupportController.deleteMessage:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Shared helper: find attachment by subdocument _id (full doc fetch — no projection)
// ─────────────────────────────────────────────────────────────────────────────
const findAttachment = async (attachmentId) => {
  const oid     = new mongoose.Types.ObjectId(attachmentId);
  const message = await Message.findOne({ "attachments._id": oid }).lean();
  if (!message) return null;
  return message.attachments.find(a => a._id.toString() === attachmentId) || null;
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /file/:attachmentId          — download (Save-As)
// GET /file/:attachmentId/preview  — inline (browser renders image/PDF)
// ─────────────────────────────────────────────────────────────────────────────
const serveFile = async (req, res, disposition) => {
  try {
    const { attachmentId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(attachmentId))
      return res.status(400).json({ message: "Invalid attachment ID" });

    const att = await findAttachment(attachmentId);
    if (!att)      return res.status(404).json({ message: "File not found" });
    if (!att.data) return res.status(404).json({ message: "File data missing" });

    // ✅ FIX 2: Use robust toBuffer() instead of Buffer.from(att.data.buffer || att.data)
    //    which crashes for BSON Binary objects from mongodb driver v4+
    const buf = toBuffer(att.data);
    if (!buf || buf.length === 0)
      return res.status(500).json({ message: "Failed to read file data" });

    res.set("Content-Type",        att.mimetype || "application/octet-stream");
    res.set("Content-Disposition", `${disposition}; filename="${encodeURIComponent(att.filename || "download")}"`);
    res.set("Content-Length",      buf.length);
    res.set("Cache-Control",       "private, max-age=3600");
    res.end(buf);
  } catch (err) {
    console.error("schoolStudentSupportController.serveFile:", err);
    if (!res.headersSent) res.status(500).json({ message: "Server error", error: err.message });
  }
};

exports.downloadFile = (req, res) => serveFile(req, res, "attachment");
exports.previewFile  = (req, res) => serveFile(req, res, "inline");
// ─────────────────────────────────────────────────────────────────────────────
// DELETE /ticket/:ticketId  (Admin hard-delete for everyone)
// ─────────────────────────────────────────────────────────────────────────────
exports.deleteTicket = async (req, res) => {
  try {
    const { ticketId } = req.params;

    if (!ticketId || !mongoose.Types.ObjectId.isValid(ticketId)) {
      return res.status(400).json({ message: "Invalid ticket ID" });
    }

    const ticket = await Ticket.findOne({ _id: ticketId, ...BASE });
    if (!ticket) return res.status(404).json({ message: "Ticket not found" });

    const io      = io_from(req);
    const payload = { ticketId: ticket._id.toString() };

    toTicket(io, ticket._id.toString(), "ticket_deleted", payload);
    toRoom(io, "admin_room",            "ticket_deleted", payload);

    if (ticket.studentId) {
      toUser(io, ticket.studentId.toString(), "ticket_deleted", payload);
    }
    if (ticket.escalatedToPartner && ticket.partnerId) {
      try { io?.to(`partner_${ticket.partnerId}`).emit("ticket_deleted", payload); } catch (_) {}
    }
    const school = ticket.school || ticket.schoolName;
    if (school) toSchool(io, school, "ticket_deleted", payload);

    await Message.deleteMany({ ticketId: ticket._id });
    await Ticket.findByIdAndDelete(ticketId);

    res.json({ success: true, message: "Ticket deleted for everyone" });
  } catch (err) {
    console.error("schoolStudentSupportController.deleteTicket:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /ticket/:ticketId/escalate-to-partner
// Identical logic to adminSupportController — works for school student tickets too
// ─────────────────────────────────────────────────────────────────────────────
exports.escalateToPartner = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { reason }   = req.body;

    if (!ticketId || !mongoose.Types.ObjectId.isValid(ticketId)) {
      return res.status(400).json({ message: "Invalid ticket ID" });
    }

    // Use BASE filter so we only touch school-student escalated tickets
    const ticket = await Ticket.findOne({ _id: ticketId, ...BASE }).lean();
    if (!ticket) return res.status(404).json({ message: "Ticket not found" });

    if (ticket.category !== "Internship Access")
      return res.status(400).json({ message: "Only 'Internship Access' tickets can be escalated to a partner." });

    if (ticket.escalatedToPartner)
      return res.status(400).json({ message: "This ticket has already been escalated to a partner." });

    const Internship = require("../models/webapp-models/internshipPostModel");

    let internshipId = ticket.internshipId || ticket.internshipMeta?.internshipId || null;
    let internship   = null;

    if (internshipId) {
      try { internship = await Internship.findById(internshipId).lean(); } catch (_) {}
    }

    if (!internship) {
      const searchTitle =
        ticket.internshipMeta?.jobTitle ||
        ticket.courseName ||
        ticket.subject?.replace("Internship Access - ", "").trim();
      if (searchTitle) {
        const esc = searchTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        internship = await Internship.findOne({ jobTitle: { $regex: new RegExp(`^${esc}$`, "i") } }).lean();
        if (!internship)
          internship = await Internship.findOne({ jobTitle: { $regex: new RegExp(esc, "i") } }).lean();
      }
      if (internship) internshipId = internship._id;
    }

    if (!internship)
      return res.status(404).json({ message: `Could not find an internship matching "${ticket.courseName || ticket.subject}".` });

    const partnerId = internship.partnerId || internship.userId || internship.postedBy || internship.createdBy;
    if (!partnerId)
      return res.status(400).json({ message: "Internship has no associated partner ID." });

    const escalationMeta = {
      partnerId,
      forwardedBy:     req.user.name || "Admin",
      forwardedAt:     new Date(),
      internshipTitle: internship.jobTitle || ticket.courseName || ticket.subject,
      internshipId,
      reason:          reason?.trim() || "Escalated by admin",
    };

    await Ticket.findByIdAndUpdate(ticket._id, {
      escalatedToPartner: true,
      partnerId,
      internshipId,
      escalationMeta,
      status:          "in-progress",
      lastMessage:     `Escalated to partner by ${req.user.name || "Admin"}`,
      lastMessageTime: new Date(),
      autoEscalated:   false,
      autoEscalatedAt: null,
    });

    const adminSysMsg = await Message.create({
      ticketId:   ticket._id,
      senderId:   req.user._id,
      senderName: "System",
      senderRole: "system",
      text: `Your ticket has been escalated to the internship partner (${internship.jobTitle}) by ${req.user.name || "Admin"}. Reason: ${reason?.trim() || "Internship access issue"}. The partner will reply directly in this thread.`,
      read: true,
    });

    const io           = io_from(req);
    const school       = ticket.school || ticket.schoolName;
    const safeAdminMsg = { ...adminSysMsg.toObject() };

    toTicket(io, ticket._id.toString(),          "new_message", { ticketId: ticket._id.toString(), message: safeAdminMsg });
    toRoom(io,   "admin_room",                   "new_message", { ticketId: ticket._id.toString(), message: safeAdminMsg });
    toSchool(io, school,                         "new_message", { ticketId: ticket._id.toString(), message: safeAdminMsg });
    if (ticket.studentId) toUser(io, ticket.studentId.toString(), "new_message", { ticketId: ticket._id.toString(), message: safeAdminMsg });

    toRoom(io, "admin_room", "ticket_escalated_to_partner", {
      originalTicketId: ticket._id.toString(),
      partnerId:        partnerId.toString(),
    });
    toRoom(io, "admin_room", "ticket_status_update", { ticketId: ticket._id.toString(), status: "in-progress" });
    if (ticket.studentId) toUser(io, ticket.studentId.toString(), "ticket_status_update", { ticketId: ticket._id.toString(), status: "in-progress" });
    toRoom(io, "admin_room", "ticket_escalation_resolved", { ticketId: ticket._id.toString() });

    const updatedTicket = await Ticket.findById(ticket._id).lean();
    try { io?.to(`partner_${partnerId}`).emit("partner_new_ticket", { ticket: updatedTicket }); } catch (_) {}

    return res.status(200).json({
      success:       true,
      message:       "Ticket successfully escalated to partner",
      systemMessage: safeAdminMsg,
      partnerTicket: updatedTicket,
    });
  } catch (err) {
    console.error("schoolStudentSupportController.escalateToPartner:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};
