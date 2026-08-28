// controllers/schoolAdmin/schoolAdminSupportController.js
// Mounted at: /api/support/school-admin

const Ticket      = require("../../models/Ticket");
const { Message, decryptMessage, decryptText } = require("../../models/Message");
const mongoose    = require("mongoose");

// ─── Socket helpers ───────────────────────────────────────────────────────────
const toRoom   = (io, room,     ev, d) => { try { io?.to(room).emit(ev, d);              } catch (_) {} };
const toTicket = (io, ticketId, ev, d) => { try { io?.to(String(ticketId)).emit(ev, d); } catch (_) {} };
const toUser   = (io, userId,   ev, d) => { try { io?.to(`user_${userId}`).emit(ev, d); } catch (_) {} };
const toSchool = (io, school,   ev, d) => {
  if (!school) return;
  try { io?.to(`school_admin_${String(school).replace(/\s+/g, "_")}`).emit(ev, d); } catch (_) {}
};

const getSchool = (req) => (req.user.schoolName || req.user.school || "").trim();

// ─── Robust binary → Buffer ───────────────────────────────────────────────────
const toBuffer = (data) => {
  if (!data) return null;
  if (Buffer.isBuffer(data)) return data;
  if (data instanceof Uint8Array) return Buffer.from(data);
  if (data && typeof data === "object") {
    if (typeof data.value === "function") {
      try {
        const v = data.value();
        if (Buffer.isBuffer(v)) return v;
        if (typeof v === "string") return Buffer.from(v, "binary");
        if (v instanceof Uint8Array) return Buffer.from(v);
      } catch (_) {}
    }
    if (data.buffer && Buffer.isBuffer(data.buffer)) return data.buffer;
    if (data.buffer instanceof ArrayBuffer) return Buffer.from(new Uint8Array(data.buffer));
    if (typeof data.length === "number" && data[0] !== undefined) return Buffer.from(Object.values(data));
  }
  if (typeof data === "string") return Buffer.from(data, "base64");
  return null;
};

// ─── Serialize message — strip binary data, stringify _id ────────────────────
const serializeMessage = (msg) => {
  const plain = msg.toObject ? msg.toObject() : { ...msg };
  // Decrypt the text field in case it was fetched via .lean() or .toObject()
  if (plain.text) plain.text = decryptMessage(plain).text;
  plain.attachments = (plain.attachments || []).map(({ data: _omit, ...meta }) => ({
    ...meta,
    _id: meta._id ? meta._id.toString() : meta._id,
  }));
  return plain;
};

// ─── Find attachment subdoc by its _id ───────────────────────────────────────
const findAttachment = async (attachmentId) => {
  const oid     = new mongoose.Types.ObjectId(attachmentId);
  const message = await Message.findOne({ "attachments._id": oid }).lean();
  if (!message) return null;
  return message.attachments.find(a => a._id && a._id.toString() === attachmentId) || null;
};

// ─── Shared file-serve helper ─────────────────────────────────────────────────
const serveFile = async (req, res, disposition) => {
  try {
    const { attachmentId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(attachmentId))
      return res.status(400).json({ message: "Invalid attachment ID" });
    const att = await findAttachment(attachmentId);
    if (!att)      return res.status(404).json({ message: "File not found" });
    if (!att.data) return res.status(404).json({ message: "File data missing" });
    const buf = toBuffer(att.data);
    if (!buf || buf.length === 0)
      return res.status(500).json({ message: "Failed to read file data" });
    res.set("Content-Type",        att.mimetype || att.type || "application/octet-stream");
    res.set("Content-Disposition", `${disposition}; filename="${encodeURIComponent(att.filename || "file")}"`);
    res.set("Content-Length",      buf.length);
    res.set("Cache-Control",       "private, max-age=3600");
    return res.end(buf);
  } catch (err) {
    console.error("serveFile ERROR:", err);
    if (!res.headersSent) res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ─── Enrich ticket list with lastMessage + unread counts ─────────────────────
const enrichTickets = async (tickets, unreadSenderRoles = ["admin"]) => {
  if (!tickets.length) return [];
  const ids = tickets.map((t) => t._id);
  const [lastMsgs, unreadCounts] = await Promise.all([
    Message.aggregate([
      { $match: { ticketId: { $in: ids } } },
      { $sort:  { createdAt: -1 } },
      { $group: { _id: "$ticketId", lastMessage: { $first: "$text" }, lastMessageTime: { $first: "$createdAt" } } },
    ]),
    Message.aggregate([
      { $match: { ticketId: { $in: ids }, senderRole: { $in: unreadSenderRoles }, read: false } },
      { $group: { _id: "$ticketId", count: { $sum: 1 } } },
    ]),
  ]);
  const lmMap = Object.fromEntries(lastMsgs.map((m)    => [m._id.toString(), m]));
  const urMap = Object.fromEntries(unreadCounts.map((u) => [u._id.toString(), u.count]));
  return tickets.map((t) => {
    const lm = lmMap[t._id.toString()];
    const uc = urMap[t._id.toString()] || 0;
    return {
      ...t,
      lastMessage:     lm?.lastMessage ? decryptText(lm.lastMessage) : (t.lastMessage ?? ""),
      lastMessageTime: lm?.lastMessageTime ?? t.lastMessageTime ?? t.createdAt,
      unreadCount: uc,
      unread:      uc > 0,
    };
  });
};

// ══════════════════════════════════════════════════════════════════════════════
//  A) STUDENT TICKETS  (/api/support/school-admin/...)
// ══════════════════════════════════════════════════════════════════════════════

exports.getSchoolStats = async (req, res) => {
  try {
    const school = getSchool(req);
    if (!school) return res.status(400).json({ message: "School name not found on your account" });
    const base = { isSchoolTicket: true, school, raisedBySchoolAdmin: { $ne: true } };
    const ids  = await Ticket.find(base).distinct("_id");
    const [total, open, inProgress, resolved, urgent, unreadMessages] = await Promise.all([
      Ticket.countDocuments(base),
      Ticket.countDocuments({ ...base, status: "open" }),
      Ticket.countDocuments({ ...base, status: "in-progress" }),
      Ticket.countDocuments({ ...base, status: { $in: ["resolved", "closed"] } }),
      Ticket.countDocuments({ ...base, priority: "urgent" }),
      Message.countDocuments({ ticketId: { $in: ids }, senderRole: { $in: ["user", "admin"] }, read: false }),
    ]);
    res.json({ stats: { total, open, inProgress, resolved, urgent, unreadMessages } });
  } catch (err) {
    console.error("getSchoolStats:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

exports.getSchoolTickets = async (req, res) => {
  try {
    const school = getSchool(req);
    if (!school) return res.status(400).json({ message: "School name not found" });
    const { page = 1, limit = 20, status, priority, category, sort = "newest", search } = req.query;
    const query = { isSchoolTicket: true, school, raisedBySchoolAdmin: { $ne: true } };
    if (status   && status   !== "all") query.status   = status;
    if (priority && priority !== "all") query.priority = priority;
    if (category && category !== "all") query.category = category;
    if (search) {
      query.$or = [
        { studentName:  { $regex: search, $options: "i" } },
        { studentEmail: { $regex: search, $options: "i" } },
        { subject:      { $regex: search, $options: "i" } },
      ];
    }
    const sortMap = { newest:{ createdAt:-1 }, oldest:{ createdAt:1 }, priority:{ priority:-1, createdAt:-1 }, status:{ status:1, createdAt:-1 } };
    const skip = (Number(page) - 1) * Number(limit);
    const [tickets, total] = await Promise.all([
      Ticket.find(query).sort(sortMap[sort] || { createdAt:-1 }).skip(skip).limit(Number(limit)).lean(),
      Ticket.countDocuments(query),
    ]);
    const enriched = await enrichTickets(tickets, ["user", "admin"]);
    res.json({ tickets: enriched, total, totalPages: Math.ceil(total / Number(limit)), currentPage: Number(page) });
  } catch (err) {
    console.error("getSchoolTickets:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

exports.getTicketById = async (req, res) => {
  try {
    const school = getSchool(req);
    const ticket = await Ticket.findOne({ _id: req.params.ticketId, isSchoolTicket: true, school }).lean();
    if (!ticket) return res.status(404).json({ message: "Ticket not found or access denied" });
    const messageCount = await Message.countDocuments({ ticketId: ticket._id });
    res.json({ ticket: { ...ticket, messages: messageCount } });
  } catch (err) {
    console.error("getTicketById:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

exports.createTicket = async (req, res) => {
  try {
    const school = getSchool(req);
    if (!school) return res.status(400).json({ message: "School name not found on your account" });
    const { studentName, studentEmail, studentId, category, priority, message: msgText } = req.body;
    if (!studentName || !msgText) return res.status(400).json({ message: "studentName and message are required" });

    const ticket = await Ticket.create({
      studentId: studentId || null, studentName: studentName || "Unknown Student",
      studentEmail: studentEmail || "", school, schoolName: school,
      schoolAdminId: req.user._id, schoolAdminName: req.user.name || req.user.schoolName || "School Admin",
      subject: category || "General Inquiry", description: msgText,
      category: category || "General Inquiry", priority: priority || "medium",
      status: "open", isSchoolTicket: true, raisedBySchoolAdmin: false, escalated: false,
      lastMessage: msgText, lastMessageTime: new Date(),
    });

    const firstMessage = await Message.create({
      ticketId: ticket._id, senderId: req.user._id,
      senderName: req.user.name || req.user.schoolName || "School Admin",
      senderRole: "school-admin", text: msgText, read: false,
    });

    const io = req.app.get("io");
    const serializedMsg = serializeMessage(firstMessage);
    const payload = { ticketId: ticket._id, ticket: { ...ticket.toObject(), unread: true, unreadCount: 1, lastMessage: msgText, lastMessageTime: new Date() } };
    toRoom(io, "admin_room", "new_ticket",  payload);
    toRoom(io, "admin_room", "new_message", { ticketId: ticket._id, message: serializedMsg, unread: true });
    toSchool(io, school, "new_ticket",  payload);
    toSchool(io, school, "new_message", { ticketId: ticket._id, message: serializedMsg });
    if (studentId) toUser(io, studentId.toString(), "ticket_created", { ticket: ticket.toObject() });

    res.status(201).json({ success: true, ticket: ticket.toObject() });
  } catch (err) {
    console.error("createTicket:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

exports.getMessages = async (req, res) => {
  try {
    const school = getSchool(req);
    const ticket = await Ticket.findOne({ _id: req.params.ticketId, isSchoolTicket: true, school });
    if (!ticket) return res.status(403).json({ message: "Access denied" });

    const raw      = await Message.find({ ticketId: req.params.ticketId }).sort({ createdAt: 1 }).lean();
    const messages = raw.map(serializeMessage);

    const result = await Message.updateMany(
      { ticketId: req.params.ticketId, senderRole: { $in: ["user", "admin"] }, read: false },
      { $set: { read: true, readAt: new Date() } }
    );
    if (result.modifiedCount > 0) {
      const io = req.app.get("io");
      toSchool(io, school,     "messages_read", { ticketId: req.params.ticketId });
      toRoom(io, "admin_room", "messages_read", { ticketId: req.params.ticketId });
    }
    res.json({ messages });
  } catch (err) {
    console.error("getMessages:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

exports.sendSchoolAdminMessage = async (req, res) => {
  try {
    const school       = getSchool(req);
    const { ticketId } = req.params;
    const { text, replyTo } = req.body;
    const files = req.files || [];

    const ticket = await Ticket.findOne({ _id: ticketId, isSchoolTicket: true, school });
    if (!ticket) return res.status(404).json({ message: "Ticket not found or access denied" });
    if (!text?.trim() && !files.length) return res.status(400).json({ message: "Message or attachment required" });

    const attachments = files.map(f => ({ filename: f.originalname, mimetype: f.mimetype, type: f.mimetype, size: f.size, data: f.buffer }));

    const messageDoc = await Message.create({
      ticketId, senderId: req.user._id,
      senderName: req.user.name || req.user.schoolName || "School Admin",
      senderRole: "school-admin", text: text?.trim() || "",
      attachments, replyTo: replyTo || null, read: false,
    });

    await Ticket.findByIdAndUpdate(ticketId, {
      lastMessage:     decryptText(messageDoc.text) || (attachments[0]?.filename ?? ""),
      lastMessageTime: messageDoc.createdAt,
    });

    const message = serializeMessage(messageDoc);
    const io = req.app.get("io");
    toTicket(io, ticketId,   "new_message", { ticketId, message });
    toRoom(io, "admin_room", "new_message", { ticketId, message });
    toSchool(io, school,     "new_message", { ticketId, message });
    if (ticket.studentId) toUser(io, ticket.studentId.toString(), "new_message", { ticketId, message });

    res.status(201).json({ message });
  } catch (err) {
    console.error("sendSchoolAdminMessage:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

exports.markMessagesAsRead = async (req, res) => {
  try {
    const school       = getSchool(req);
    const { ticketId } = req.params;
    const ticket = await Ticket.findOne({ _id: ticketId, isSchoolTicket: true, school });
    if (!ticket) return res.status(403).json({ message: "Access denied" });
    const result = await Message.updateMany(
      { ticketId, senderRole: { $in: ["user", "admin"] }, read: false },
      { $set: { read: true, readAt: new Date() } }
    );
    if (result.modifiedCount > 0) {
      const io = req.app.get("io");
      toSchool(io, school,     "messages_read", { ticketId });
      toRoom(io, "admin_room", "messages_read", { ticketId });
    }
    res.json({ message: "Messages marked as read", markedCount: result.modifiedCount });
  } catch (err) {
    console.error("markMessagesAsRead:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

exports.updateTicketStatus = async (req, res) => {
  try {
    const school       = getSchool(req);
    const { ticketId } = req.params;
    const { status }   = req.body;
    if (!["open","in-progress","resolved","closed"].includes(status))
      return res.status(400).json({ message: "Invalid status" });

    const ticket = await Ticket.findOneAndUpdate({ _id: ticketId, isSchoolTicket: true, school }, { status }, { new: true });
    if (!ticket) return res.status(404).json({ message: "Ticket not found" });

    const sysDoc = await Message.create({ ticketId, senderId: req.user._id, senderName: "System", senderRole: "system", text: `Ticket status updated to "${status}" by School Admin`, read: true });
    const payload = { ticketId, status, message: serializeMessage(sysDoc) };
    const io = req.app.get("io");
    toTicket(io, ticketId,   "ticket_status_update", payload);
    toSchool(io, school,     "ticket_status_update", payload);
    toRoom(io, "admin_room", "ticket_status_update", payload);
    if (ticket.studentId) toUser(io, ticket.studentId.toString(), "ticket_status_update", payload);

    res.json({ message: "Status updated", ticket, systemMessage: serializeMessage(sysDoc) });
  } catch (err) {
    console.error("updateTicketStatus:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

exports.escalateToAdmin = async (req, res) => {
  try {
    const school       = getSchool(req);
    const { ticketId } = req.params;
    const { reason }   = req.body;
    if (!reason?.trim()) return res.status(400).json({ message: "Escalation reason is required" });

    const ticket = await Ticket.findOne({ _id: ticketId, isSchoolTicket: true, school });
    if (!ticket) return res.status(404).json({ message: "Ticket not found or access denied" });
    if (ticket.escalated) return res.status(400).json({ message: "Ticket is already escalated" });

    ticket.escalated        = true;
    ticket.escalationReason = reason.trim();
    ticket.escalatedBy      = { id: req.user._id, name: req.user.name || req.user.schoolName, school };
    ticket.escalatedAt      = new Date();
    await ticket.save();

    const sysDoc = await Message.create({
      ticketId, senderId: req.user._id, senderName: "System", senderRole: "system",
      text: `🚨 Escalated to main admin by School Admin (${req.user.name || req.user.schoolName}). Reason: ${reason.trim()}`,
      read: false,
    });

    const io = req.app.get("io");
    const unreadCount = await Message.countDocuments({ ticketId: ticket._id, senderRole: { $in: ["user","school-admin"] }, read: false });
    const lastMsg     = await Message.findOne({ ticketId: ticket._id }).sort({ createdAt: -1 }).select("text createdAt").lean();
    const fullTicket  = { ...ticket.toObject(), unread: unreadCount > 0, unreadCount, lastMessage: lastMsg?.text || ticket.description, lastMessageTime: lastMsg?.createdAt || ticket.createdAt };
    const serializedSysMsg = serializeMessage(sysDoc);

    toRoom(io, "admin_room", "ticket_escalated", { ticketId, ticket: fullTicket, message: serializedSysMsg, school, reason: reason.trim(), adminTab: "school_student" });
    toRoom(io, "admin_room", "new_message",      { ticketId, message: serializedSysMsg, unread: true });
    toTicket(io, ticketId,   "ticket_escalated", { ticketId, message: serializedSysMsg });
    toTicket(io, ticketId,   "new_message",      { ticketId, message: serializedSysMsg });
    toSchool(io, school,     "ticket_escalated", { ticketId, message: serializedSysMsg });
    toSchool(io, school,     "new_message",      { ticketId, message: serializedSysMsg });

    res.json({ success: true, message: "Ticket escalated successfully", systemMessage: serializedSysMsg, ticket: fullTicket });
  } catch (err) {
    console.error("escalateToAdmin:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

exports.deleteMessage = async (req, res) => {
  try {
    const school  = getSchool(req);
    const message = await Message.findById(req.params.messageId).lean();
    if (!message) return res.status(404).json({ message: "Message not found" });
    const ticket  = await Ticket.findOne({ _id: message.ticketId, isSchoolTicket: true, school }).lean();
    if (!ticket)  return res.status(403).json({ message: "Access denied" });
    await Message.findByIdAndDelete(req.params.messageId);
    const io = req.app.get("io");
    toTicket(io, message.ticketId.toString(), "message_deleted", { messageId: message._id, ticketId: message.ticketId });
    toSchool(io, school, "message_deleted", { messageId: message._id, ticketId: message.ticketId });
    res.json({ message: "Message deleted" });
  } catch (err) {
    console.error("deleteMessage:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

exports.downloadFile = (req, res) => serveFile(req, res, "attachment");

// ══════════════════════════════════════════════════════════════════════════════
//  B) OWN ISSUES  (/api/support/school-admin/my-tickets/...)
// ══════════════════════════════════════════════════════════════════════════════

// ✅ FIX: subject is now OPTIONAL — only message is required.
//         subject falls back to category so the form only needs a message.
//         Root cause of "Subject and message are required" was that the route
//         was missing upload.array() middleware, so req.body was always empty
//         when the frontend posted FormData. Fixed in routes file.
exports.raiseIssue = async (req, res) => {
  try {
    const school = getSchool(req);
    if (!school) return res.status(400).json({ message: "School name not found on your account" });

    const category = (req.body.category || "General Inquiry").trim();
    const priority = (req.body.priority || "medium").trim();
    const msgText  = (req.body.message  || "").trim();

    // subject is optional — fall back to category
    const subject  = (req.body.subject  || "").trim() || category;

    if (!msgText) {
      return res.status(400).json({ message: "Message is required" });
    }

    const files = req.files || [];
    const attachments = files.map(f => ({
      filename: f.originalname,
      mimetype: f.mimetype,
      type:     f.mimetype,
      size:     f.size,
      data:     f.buffer,
    }));

    const lastMsgPreview = msgText || (attachments[0]?.filename ?? "");

    const ticket = await Ticket.create({
      studentId:    null,
      studentName:  req.user.name || req.user.schoolName || "School Admin",
      studentEmail: req.user.email || "",
      school,
      schoolName:      school,
      schoolAdminId:   req.user._id,
      schoolAdminName: req.user.name || req.user.schoolName || "School Admin",
      subject,
      description:         msgText,
      category,
      priority,
      status:              "open",
      isSchoolTicket:      true,
      raisedBySchoolAdmin: true,
      escalated:           false,
      lastMessage:     lastMsgPreview,
      lastMessageTime: new Date(),
    });

    const firstMessage = await Message.create({
      ticketId:   ticket._id,
      senderId:   req.user._id,
      senderName: req.user.name || req.user.schoolName || "School Admin",
      senderRole: "school-admin",
      text:       msgText,
      attachments,
      read:       false,
    });

    const io = req.app.get("io");
    const serializedMsg = serializeMessage(firstMessage);
    const payload = {
      ticketId: ticket._id,
      ticket: {
        ...ticket.toObject(),
        unread:          true,
        unreadCount:     1,
        lastMessage:     lastMsgPreview,
        lastMessageTime: new Date(),
      },
    };
    toRoom(io, "admin_room", "new_ticket",  payload);
    toRoom(io, "admin_room", "new_message", { ticketId: ticket._id, message: serializedMsg, unread: true });
    toSchool(io, school, "new_ticket",  payload);
    toSchool(io, school, "new_message", { ticketId: ticket._id, message: serializedMsg });

    res.status(201).json({ success: true, ticket: ticket.toObject() });
  } catch (err) {
    console.error("raiseIssue:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

exports.getOwnTickets = async (req, res) => {
  try {
    const school = getSchool(req);
    if (!school) return res.status(400).json({ message: "School name not found" });
    const { page = 1, limit = 20, status, priority, category, sort = "newest", search } = req.query;
    const query = { isSchoolTicket: true, school, raisedBySchoolAdmin: true };
    if (status   && status   !== "all") query.status   = status;
    if (priority && priority !== "all") query.priority = priority;
    if (category && category !== "all") query.category = category;
    if (search) query.$or = [{ subject: { $regex: search, $options:"i" } }, { description: { $regex: search, $options:"i" } }];
    const sortMap = { newest:{ createdAt:-1 }, oldest:{ createdAt:1 }, priority:{ priority:-1, createdAt:-1 }, status:{ status:1, createdAt:-1 } };
    const skip = (Number(page) - 1) * Number(limit);
    const [tickets, total] = await Promise.all([
      Ticket.find(query).sort(sortMap[sort] || { createdAt:-1 }).skip(skip).limit(Number(limit)).lean(),
      Ticket.countDocuments(query),
    ]);
    const enriched = await enrichTickets(tickets, ["admin"]);
    res.json({ tickets: enriched, total, totalPages: Math.ceil(total / Number(limit)), currentPage: Number(page) });
  } catch (err) {
    console.error("getOwnTickets:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

exports.getOwnStats = async (req, res) => {
  try {
    const school = getSchool(req);
    if (!school) return res.status(400).json({ message: "School name not found" });
    const base = { isSchoolTicket: true, school, raisedBySchoolAdmin: true };
    const ids  = await Ticket.find(base).distinct("_id");
    const [total, open, inProgress, resolved, urgent, unreadMessages] = await Promise.all([
      Ticket.countDocuments(base),
      Ticket.countDocuments({ ...base, status: "open" }),
      Ticket.countDocuments({ ...base, status: "in-progress" }),
      Ticket.countDocuments({ ...base, status: { $in: ["resolved","closed"] } }),
      Ticket.countDocuments({ ...base, priority: "urgent" }),
      Message.countDocuments({ ticketId: { $in: ids }, senderRole: "admin", read: false }),
    ]);
    res.json({ stats: { total, open, inProgress, resolved, urgent, unreadMessages } });
  } catch (err) {
    console.error("getOwnStats:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

exports.getOwnTicketById = async (req, res) => {
  try {
    const school = getSchool(req);
    const ticket = await Ticket.findOne({ _id: req.params.ticketId, isSchoolTicket: true, school, raisedBySchoolAdmin: true }).lean();
    if (!ticket) return res.status(404).json({ message: "Ticket not found or access denied" });
    const messageCount = await Message.countDocuments({ ticketId: ticket._id });
    res.json({ ticket: { ...ticket, messages: messageCount } });
  } catch (err) {
    console.error("getOwnTicketById:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

exports.getOwnMessages = async (req, res) => {
  try {
    const school = getSchool(req);
    const ticket = await Ticket.findOne({ _id: req.params.ticketId, isSchoolTicket: true, school, raisedBySchoolAdmin: true });
    if (!ticket) return res.status(403).json({ message: "Access denied" });

    const raw      = await Message.find({ ticketId: req.params.ticketId }).sort({ createdAt: 1 }).lean();
    const messages = raw.map(serializeMessage);

    const result = await Message.updateMany(
      { ticketId: req.params.ticketId, senderRole: "admin", read: false },
      { $set: { read: true, readAt: new Date() } }
    );
    if (result.modifiedCount > 0) {
      const io = req.app.get("io");
      toSchool(io, school,     "messages_read", { ticketId: req.params.ticketId });
      toRoom(io, "admin_room", "messages_read", { ticketId: req.params.ticketId });
    }
    res.json({ messages });
  } catch (err) {
    console.error("getOwnMessages:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

exports.sendOwnMessage = async (req, res) => {
  try {
    const school       = getSchool(req);
    const { ticketId } = req.params;
    const { text, replyTo } = req.body;
    const files = req.files || [];

    const ticket = await Ticket.findOne({ _id: ticketId, isSchoolTicket: true, school, raisedBySchoolAdmin: true });
    if (!ticket) return res.status(404).json({ message: "Ticket not found or access denied" });
    if (!text?.trim() && !files.length) return res.status(400).json({ message: "Message or attachment required" });

    const attachments = files.map(f => ({ filename: f.originalname, mimetype: f.mimetype, type: f.mimetype, size: f.size, data: f.buffer }));

    const messageDoc = await Message.create({
      ticketId, senderId: req.user._id,
      senderName: req.user.name || req.user.schoolName || "School Admin",
      senderRole: "school-admin", text: text?.trim() || "",
      attachments, replyTo: replyTo || null, read: false,
    });

    await Ticket.findByIdAndUpdate(ticketId, {
      lastMessage:     decryptText(messageDoc.text) || (attachments[0]?.filename ?? ""),
      lastMessageTime: messageDoc.createdAt,
    });

    const message = serializeMessage(messageDoc);
    const io = req.app.get("io");
    toTicket(io, ticketId,   "new_message", { ticketId, message });
    toRoom(io, "admin_room", "new_message", { ticketId, message });
    toSchool(io, school,     "new_message", { ticketId, message });

    res.status(201).json({ message });
  } catch (err) {
    console.error("sendOwnMessage:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

exports.markOwnMessagesAsRead = async (req, res) => {
  try {
    const school       = getSchool(req);
    const { ticketId } = req.params;
    const ticket = await Ticket.findOne({ _id: ticketId, isSchoolTicket: true, school, raisedBySchoolAdmin: true });
    if (!ticket) return res.status(403).json({ message: "Access denied" });
    const result = await Message.updateMany(
      { ticketId, senderRole: "admin", read: false },
      { $set: { read: true, readAt: new Date() } }
    );
    if (result.modifiedCount > 0) {
      const io = req.app.get("io");
      toSchool(io, school,     "messages_read", { ticketId });
      toRoom(io, "admin_room", "messages_read", { ticketId });
    }
    res.json({ message: "Messages marked as read", markedCount: result.modifiedCount });
  } catch (err) {
    console.error("markOwnMessagesAsRead:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

exports.updateOwnTicketStatus = async (req, res) => {
  try {
    const school       = getSchool(req);
    const { ticketId } = req.params;
    const { status }   = req.body;
    if (!["open","in-progress","resolved","closed"].includes(status))
      return res.status(400).json({ message: "Invalid status" });
    const ticket = await Ticket.findOneAndUpdate(
      { _id: ticketId, isSchoolTicket: true, school, raisedBySchoolAdmin: true },
      { status }, { new: true }
    );
    if (!ticket) return res.status(404).json({ message: "Ticket not found" });
    const sysDoc = await Message.create({ ticketId, senderId: req.user._id, senderName: "System", senderRole: "system", text: `Ticket status updated to "${status}"`, read: true });
    const payload = { ticketId, status, message: serializeMessage(sysDoc) };
    const io = req.app.get("io");
    toTicket(io, ticketId,   "ticket_status_update", payload);
    toSchool(io, school,     "ticket_status_update", payload);
    toRoom(io, "admin_room", "ticket_status_update", payload);
    res.json({ message: "Status updated", ticket, systemMessage: serializeMessage(sysDoc) });
  } catch (err) {
    console.error("updateOwnTicketStatus:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

exports.deleteOwnMessage = async (req, res) => {
  try {
    const school  = getSchool(req);
    const message = await Message.findById(req.params.messageId).lean();
    if (!message) return res.status(404).json({ message: "Message not found" });
    const ticket  = await Ticket.findOne({ _id: message.ticketId, isSchoolTicket: true, school, raisedBySchoolAdmin: true }).lean();
    if (!ticket)  return res.status(403).json({ message: "Access denied" });
    await Message.findByIdAndDelete(req.params.messageId);
    const io = req.app.get("io");
    toTicket(io, message.ticketId.toString(), "message_deleted", { messageId: message._id, ticketId: message.ticketId });
    toSchool(io, school, "message_deleted", { messageId: message._id, ticketId: message.ticketId });
    res.json({ message: "Message deleted" });
  } catch (err) {
    console.error("deleteOwnMessage:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

exports.deleteOwnTicket = async (req, res) => {
  try {
    const school       = getSchool(req);
    const { ticketId } = req.params;
    const ticket = await Ticket.findOne({ _id: ticketId, isSchoolTicket: true, school, raisedBySchoolAdmin: true });
    if (!ticket) return res.status(404).json({ success: false, message: "Ticket not found or access denied" });
    await Message.deleteMany({ ticketId });
    await Ticket.findByIdAndDelete(ticketId);
    const io = req.app.get("io");
    toSchool(io, school,     "ticket_deleted", { ticketId });
    toRoom(io, "admin_room", "ticket_deleted", { ticketId });
    res.json({ success: true, message: "Ticket deleted successfully" });
  } catch (err) {
    console.error("deleteOwnTicket:", err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};

exports.downloadOwnFile = (req, res) => serveFile(req, res, "attachment");