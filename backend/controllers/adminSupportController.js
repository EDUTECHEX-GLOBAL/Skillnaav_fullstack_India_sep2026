// controllers/adminSupportController.js  — Mounted at: /api/support/admin
//
// ✅ SIMPLIFIED MESSAGE FLOW (no duplicate ticket):
//
//   Admin escalates to partner:
//     → ticket.escalatedToPartner = true
//     → ticket.partnerId = <partner id>
//     → system message added to SAME ticket
//     → partner notified via socket (partner_new_ticket) with the ORIGINAL ticket
//     → NO new Ticket document created
//
//   Student sends message:
//     "new_message" on ticket ID → admin_room + partner room
//
//   Admin sends on ANY ticket (escalated or not):
//     → saved to student ticket (senderRole:"admin")
//     → "new_message" on ticket ID → admin_room + student room + partner room (if escalated)
//
//   Partner replies on escalated ticket (via Partnersupportcontroller):
//     → saved to SAME student ticket (senderRole:"partner")
//     → "new_message" on ticket ID → admin_room + student room
//
//   AUTO-ESCALATION (via autoEscalateJob.js):
//     → After 6h with no admin reply → system message added, ticket bumped to top
//     → ticket.autoEscalated = true, ticket.autoEscalationCount++
//     → socket: "ticket_auto_escalated" + "new_message" to admin_room + student
//
// KEY RULES:
//   - Admin can ALWAYS send messages. No locking.
//   - No cross-posting, no duplicate ticket, no partner ticket collection
//   - Partner sees and replies directly in student ticket thread
//
// ✅ STATUS FIX:
//   - Ticket status is "open" when created (correct default)
//   - Status only changes when admin explicitly:
//       (a) sends a reply → auto-progresses open → in-progress
//       (b) changes the dropdown → PUT /ticket/:ticketId/status
//   - updateTicketStatus now validates ticketId and status strictly
//   - Viewing a ticket does NOT change status (by design)

const Ticket                   = require("../models/Ticket");
const { Message, stripBinary, decryptMessages, decryptMessage, decryptText } = require("../models/Message");
const mongoose                 = require("mongoose");
const { upload }               = require("../middlewares/uploadMiddleware");

exports.uploadMiddleware = upload.array("files", 5);

const getIO = (req) => req.app.get("io");

const emit = {
  toRoom:    (io, room,   ev, d) => { try { io?.to(room).emit(ev, d);              } catch (_) {} },
  toTicket:  (io, tId,    ev, d) => { try { io?.to(String(tId)).emit(ev, d);       } catch (_) {} },
  toUser:    (io, userId, ev, d) => { try { io?.to(`user_${userId}`).emit(ev, d);  } catch (_) {} },
  toPartner: (io, pId,    ev, d) => { try { io?.to(`partner_${pId}`).emit(ev, d); } catch (_) {} },
};

const adminBase = () => ({
  isSchoolTicket: { $ne: true },
  senderType:     { $ne: "partner" },
});

const VALID_STATUSES = ["open", "in-progress", "resolved", "closed"];

const toBuffer = (data) => {
  if (!data) return null;
  if (Buffer.isBuffer(data)) return data;
  if (data instanceof Uint8Array) return Buffer.from(data);
  if (data && typeof data === "object") {
    if (typeof data.value === "function") {
      try {
        const v = data.value();
        if (Buffer.isBuffer(v))      return v;
        if (typeof v === "string")   return Buffer.from(v, "binary");
        if (v instanceof Uint8Array) return Buffer.from(v);
      } catch (_) {}
    }
    if (data.buffer && Buffer.isBuffer(data.buffer)) return data.buffer.slice(0);
    if (data.buffer instanceof ArrayBuffer) return Buffer.from(new Uint8Array(data.buffer));
    if (typeof data.length === "number" && data[0] !== undefined)
      return Buffer.from(Object.values(data));
  }
  if (typeof data === "string") return Buffer.from(data, "base64");
  return null;
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /stats
// ─────────────────────────────────────────────────────────────────────────────
exports.getStats = async (req, res) => {
  try {
    const base      = adminBase();
    const ticketIds = await Ticket.find(base).distinct("_id");

    const [total, open, inProgress, resolved, urgent, unreadMessages, autoEscalated] = await Promise.all([
      Ticket.countDocuments(base),
      Ticket.countDocuments({ ...base, status: "open" }),
      Ticket.countDocuments({ ...base, status: "in-progress" }),
      Ticket.countDocuments({ ...base, status: { $in: ["resolved", "closed"] } }),
      Ticket.countDocuments({ ...base, priority: "urgent", status: { $nin: ["resolved", "closed"] } }),
      Message.countDocuments({
        ticketId:   { $in: ticketIds },
        senderRole: { $in: ["user", "partner"] },
        read:       false,
      }),
      Ticket.countDocuments({
        ...base,
        autoEscalated: true,
        status: { $nin: ["resolved", "closed"] },
      }),
    ]);

    const unreadAgg = await Message.aggregate([
      { $match: { ticketId: { $in: ticketIds }, senderRole: { $in: ["user", "partner"] }, read: false } },
      { $group: { _id: "$ticketId" } },
      { $count: "count" },
    ]);

    res.json({
      stats: {
        total, open, inProgress, resolved, urgent,
        unreadMessages,
        ticketsWithUnread: unreadAgg[0]?.count || 0,
        autoEscalated,
      },
    });
  } catch (err) {
    console.error("getStats:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /tickets
// ─────────────────────────────────────────────────────────────────────────────
exports.getAllTickets = async (req, res) => {
  try {
    const {
      page = 1, limit = 20,
      status, priority, category,
      sort = "newest", search, adminView,
      autoEscalated,
    } = req.query;

    let query = {};
    if (adminView === "true") {
      query.isSchoolTicket = { $ne: true };
      query.senderType     = { $ne: "partner" };
    }

    // ✅ FIX: only apply status filter when it's a valid value
    if (status && status !== "all" && VALID_STATUSES.includes(status)) {
      query.status = status;
    }
    if (priority && priority !== "all") query.priority      = priority;
    if (category && category !== "all") query.category      = category;

    if (autoEscalated === "true") {
      query.autoEscalated = true;
      query.status        = { $nin: ["resolved", "closed"] };
    }
    if (search) {
      const r = { $regex: search, $options: "i" };
      query.$or = [{ studentName: r }, { studentEmail: r }, { subject: r }, { description: r }];
    }

    const sortMap = {
      newest:   { lastMessageTime: -1, createdAt: -1 },
      oldest:   { createdAt: 1 },
      priority: { priority: -1, lastMessageTime: -1, createdAt: -1 },
      status:   { status: 1,    lastMessageTime: -1, createdAt: -1 },
    };

    const skip = (Number(page) - 1) * Number(limit);
    const [tickets, total] = await Promise.all([
      Ticket.find(query).sort(sortMap[sort] || sortMap.newest).skip(skip).limit(Number(limit)).lean(),
      Ticket.countDocuments(query),
    ]);

    const ids = tickets.map(t => t._id);
    const [lastMsgs, unreadCounts] = await Promise.all([
      Message.aggregate([
        { $match:  { ticketId: { $in: ids } } },
        { $sort:   { createdAt: -1 } },
        { $group:  { _id: "$ticketId", lastMessage: { $first: "$text" }, lastMessageTime: { $first: "$createdAt" }, lastMessageSender: { $first: "$senderRole" } } },
      ]),
      Message.aggregate([
        { $match:  { ticketId: { $in: ids }, senderRole: { $in: ["user", "partner"] }, read: false } },
        { $group:  { _id: "$ticketId", count: { $sum: 1 } } },
      ]),
    ]);

    const lastMsgMap = Object.fromEntries(lastMsgs.map(m    => [m._id.toString(), m]));
    const unreadMap  = Object.fromEntries(unreadCounts.map(u => [u._id.toString(), u.count]));

    const enriched = tickets.map(t => {
      const lm = lastMsgMap[t._id.toString()];
      return {
        ...t,
        lastMessage:     lm?.lastMessage ? decryptText(lm.lastMessage) : (t.lastMessage ?? ""),
        lastMessageTime: lm?.lastMessageTime ?? t.lastMessageTime ?? t.createdAt,
        lastMessageSender: lm?.lastMessageSender ?? t.lastMessageSender ?? "",
        unreadCount:     unreadMap[t._id.toString()] || 0,
        unread:          (unreadMap[t._id.toString()] || 0) > 0,
      };
    });

    res.json({ tickets: enriched, total, totalPages: Math.ceil(total / Number(limit)), currentPage: Number(page) });
  } catch (err) {
    console.error("getAllTickets:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /ticket/:ticketId
// ─────────────────────────────────────────────────────────────────────────────
exports.getTicketById = async (req, res) => {
  try {
    const { ticketId } = req.params;

    // ✅ FIX: validate ticketId before querying
    if (!ticketId || !mongoose.Types.ObjectId.isValid(ticketId)) {
      return res.status(400).json({ message: "Invalid ticket ID" });
    }

    const ticket = await Ticket.findById(ticketId).lean();
    if (!ticket) return res.status(404).json({ message: "Ticket not found" });

    const messageCount = await Message.countDocuments({ ticketId: ticket._id });
    res.json({ ticket: { ...ticket, messages: messageCount } });
  } catch (err) {
    console.error("getTicketById:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /messages/:ticketId
// ─────────────────────────────────────────────────────────────────────────────
exports.getMessages = async (req, res) => {
  try {
    const { ticketId } = req.params;

    // ✅ FIX: validate ticketId
    if (!ticketId || !mongoose.Types.ObjectId.isValid(ticketId)) {
      return res.status(400).json({ message: "Invalid ticket ID" });
    }

    const raw = await Message.find({ ticketId }).sort({ createdAt: 1 }).lean();
    const messages = decryptMessages(raw).map(msg => ({
      ...msg,
      attachments: (msg.attachments || []).map(({ data: _omit, ...meta }) => meta),
    }));
    res.json({ messages });
  } catch (err) {
    console.error("getMessages:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /message/:ticketId
// ✅ Admin can ALWAYS reply on any ticket (escalated or not). No locking.
//    When admin replies → clear autoEscalated flag + auto-progress open→in-progress
// ─────────────────────────────────────────────────────────────────────────────
exports.sendAdminMessage = async (req, res) => {
  try {
    const { ticketId }      = req.params;
    const { text, replyTo } = req.body;
    const files             = req.files || [];

    // ✅ FIX: validate ticketId
    if (!ticketId || !mongoose.Types.ObjectId.isValid(ticketId)) {
      return res.status(400).json({ message: "Invalid ticket ID" });
    }

    const ticket = await Ticket.findById(ticketId);
    if (!ticket) return res.status(404).json({ message: "Ticket not found" });
    if (!text?.trim() && files.length === 0)
      return res.status(400).json({ message: "Message text or file required" });

    const attachments = files.map(f => ({
      filename: f.originalname, mimetype: f.mimetype, size: f.size, data: f.buffer,
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

    const safeMessage = stripBinary ? stripBinary(decryptMessage(doc.toObject())) : decryptMessage(doc.toObject());

    // ✅ Auto-progress open→in-progress + clear auto-escalation when admin replies
    let updatedStatus  = ticket.status;
    const ticketUpdate = {
      lastMessage:     decryptText(safeMessage.text) || (files.length ? files[0].originalname : "Attachment"),
      lastMessageTime: doc.createdAt,
      autoEscalated:       false,
      autoEscalatedAt:     null,
    };
    if (ticket.status === "open") {
      updatedStatus       = "in-progress";
      ticketUpdate.status = "in-progress";
    }
    await Ticket.findByIdAndUpdate(ticketId, ticketUpdate);

    const io = getIO(req);

    emit.toTicket(io, ticketId,                     "new_message", { ticketId, message: safeMessage });
    emit.toRoom(io,   "admin_room",                 "new_message", { ticketId, message: safeMessage });
    emit.toUser(io,   ticket.studentId?.toString(), "new_message", { ticketId, message: safeMessage });

    if (ticket.escalatedToPartner && ticket.partnerId) {
      emit.toPartner(io, ticket.partnerId.toString(), "new_message", { ticketId, message: safeMessage });
    }

    if (updatedStatus !== ticket.status) {
      const statusPayload = { ticketId, status: updatedStatus };
      emit.toTicket(io, ticketId,                     "ticket_status_update", statusPayload);
      emit.toUser(io,   ticket.studentId?.toString(), "ticket_status_update", statusPayload);
      emit.toRoom(io,   "admin_room",                 "ticket_status_update", statusPayload);
      if (ticket.escalatedToPartner && ticket.partnerId) {
        emit.toPartner(io, ticket.partnerId.toString(), "ticket_status_update", statusPayload);
      }
    }

    // Notify admin room that auto-escalation flag is cleared
    if (ticket.autoEscalated) {
      emit.toRoom(io, "admin_room", "ticket_escalation_resolved", { ticketId });
    }

    res.status(201).json({ message: safeMessage });
  } catch (err) {
    console.error("sendAdminMessage:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /mark-read/:ticketId
// ─────────────────────────────────────────────────────────────────────────────
exports.markMessagesAsRead = async (req, res) => {
  try {
    const { ticketId } = req.params;

    // ✅ FIX: validate ticketId
    if (!ticketId || !mongoose.Types.ObjectId.isValid(ticketId)) {
      return res.status(400).json({ message: "Invalid ticket ID" });
    }

    const result = await Message.updateMany(
      { ticketId, senderRole: { $in: ["user", "partner"] }, read: false },
      { $set: { read: true, readAt: new Date() } }
    );
    if (result.modifiedCount > 0) {
      const io = getIO(req);
      emit.toRoom(io,   "admin_room", "messages_read", { ticketId });
      emit.toTicket(io, ticketId,     "messages_read", { ticketId });
    }
    res.json({ message: "Marked as read", markedCount: result.modifiedCount });
  } catch (err) {
    console.error("markMessagesAsRead:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT /ticket/:ticketId/status
// ✅ FIX: strict validation, clear autoEscalated on resolve/close,
//         proper socket broadcasts so frontend state stays in sync
// ─────────────────────────────────────────────────────────────────────────────
exports.updateTicketStatus = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { status }   = req.body;

    // ✅ FIX: validate ticketId first
    if (!ticketId || !mongoose.Types.ObjectId.isValid(ticketId)) {
      return res.status(400).json({ message: "Invalid ticket ID" });
    }

    // ✅ FIX: strict status validation
    if (!status || !VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        message: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`,
      });
    }

    // ✅ FIX: get the ticket first so we know previous state
    const existingTicket = await Ticket.findById(ticketId);
    if (!existingTicket) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    const updateData = { status };

    // ✅ Clear auto-escalation when resolving or closing
    if (["resolved", "closed"].includes(status)) {
      updateData.autoEscalated   = false;
      updateData.autoEscalatedAt = null;
    }

    const ticket = await Ticket.findByIdAndUpdate(ticketId, updateData, { new: true });
    if (!ticket) return res.status(404).json({ message: "Ticket not found" });

    // Create system message recording the status change
    const sysDoc = await Message.create({
      ticketId,
      senderId:   req.user._id,
      senderName: "System",
      senderRole: "system",
      text:       `Ticket status updated to "${status}" by Admin`,
      read:       true,
    });
    const safe    = stripBinary ? stripBinary(decryptMessage(sysDoc.toObject())) : decryptMessage(sysDoc.toObject());
    const io      = getIO(req);
    const payload = { ticketId, status, message: safe };

    // ✅ FIX: broadcast to all relevant rooms so every connected client updates
    emit.toRoom(io,   "admin_room", "ticket_status_update", payload);
    emit.toTicket(io, ticketId,     "ticket_status_update", payload);
    emit.toUser(io,   ticket.studentId?.toString(), "ticket_status_update", payload);

    if (ticket.escalatedToPartner && ticket.partnerId) {
      emit.toPartner(io, ticket.partnerId.toString(), "ticket_status_update", payload);
    }

    // Clear escalation highlight in admin UI when resolved/closed
    if (["resolved", "closed"].includes(status)) {
      emit.toRoom(io, "admin_room", "ticket_escalation_resolved", { ticketId });
    }

    res.json({ message: "Status updated", ticket, systemMessage: safe });
  } catch (err) {
    console.error("updateTicketStatus:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT /ticket/:ticketId/assign
// ─────────────────────────────────────────────────────────────────────────────
exports.assignTicket = async (req, res) => {
  try {
    const { ticketId } = req.params;

    if (!ticketId || !mongoose.Types.ObjectId.isValid(ticketId)) {
      return res.status(400).json({ message: "Invalid ticket ID" });
    }

    const assignedTo = { id: req.user._id, name: req.user.name || "Admin", email: req.user.email };

    const ticket = await Ticket.findByIdAndUpdate(ticketId, { assignedTo }, { new: true });
    if (!ticket) return res.status(404).json({ message: "Ticket not found" });

    const sysDoc = await Message.create({
      ticketId, senderId: req.user._id, senderName: "System",
      senderRole: "system", text: `Ticket assigned to ${req.user.name || "Admin"}`, read: true,
    });
    const safe    = stripBinary ? stripBinary(decryptMessage(sysDoc.toObject())) : decryptMessage(sysDoc.toObject());
    const io      = getIO(req);
    emit.toRoom(io,   "admin_room", "ticket_assigned", { ticketId, assignedTo: ticket.assignedTo, message: safe });
    emit.toTicket(io, ticketId,     "ticket_assigned", { ticketId, assignedTo: ticket.assignedTo, message: safe });

    res.json({ ticket, systemMessage: safe });
  } catch (err) {
    console.error("assignTicket:", err);
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

    const ticketId = message.ticketId.toString();
    const io       = getIO(req);
    emit.toTicket(io, ticketId,     "message_deleted", { messageId: message._id, ticketId });
    emit.toRoom(io,   "admin_room", "message_deleted", { messageId: message._id, ticketId });
    res.json({ message: "Deleted" });
  } catch (err) {
    console.error("deleteMessage:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /ticket/:ticketId  (Admin hard-delete for everyone)
// ─────────────────────────────────────────────────────────────────────────────
exports.deleteTicket = async (req, res) => {
  try {
    const { ticketId } = req.params;

    if (!ticketId || !mongoose.Types.ObjectId.isValid(ticketId)) {
      return res.status(400).json({ message: "Invalid ticket ID" });
    }

    const ticket = await Ticket.findById(ticketId);
    if (!ticket) return res.status(404).json({ message: "Ticket not found" });

    const io      = getIO(req);
    const payload = { ticketId: ticket._id.toString() };

    emit.toTicket(io, ticket._id.toString(), "ticket_deleted", payload);
    emit.toRoom(io,   "admin_room",           "ticket_deleted", payload);

    if (ticket.studentId) {
      emit.toUser(io, ticket.studentId.toString(), "ticket_deleted", payload);
    }
    if (ticket.escalatedToPartner && ticket.partnerId) {
      emit.toPartner(io, ticket.partnerId.toString(), "ticket_deleted", payload);
    }
    if (ticket.isSchoolTicket && ticket.school && ticket.school !== "Not specified") {
      const schoolRoom = "school_admin_" + ticket.school.replace(/\s+/g, "_");
      emit.toRoom(io, schoolRoom, "ticket_deleted", payload);
    }

    await Message.deleteMany({ ticketId: ticket._id });
    await Ticket.findByIdAndDelete(ticketId);

    res.json({ success: true, message: "Ticket deleted for everyone" });
  } catch (err) {
    console.error("deleteTicket:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// File helpers
// ─────────────────────────────────────────────────────────────────────────────
const findAttachment = async (attachmentId) => {
  const oid     = new mongoose.Types.ObjectId(attachmentId);
  const message = await Message.findOne({ "attachments._id": oid }).lean();
  if (!message) return null;
  return message.attachments.find(a => a._id && a._id.toString() === attachmentId) || null;
};

const serveFile = async (req, res, disposition) => {
  try {
    const { attachmentId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(attachmentId))
      return res.status(400).json({ message: "Invalid attachment ID" });
    const att = await findAttachment(attachmentId);
    if (!att)      return res.status(404).json({ message: "File not found", attachmentId });
    if (!att.data) return res.status(404).json({ message: "File data missing" });
    const buf = toBuffer(att.data);
    if (!buf || buf.length === 0)
      return res.status(500).json({ message: "Failed to read file data" });
    res.set("Content-Type",        att.mimetype || "application/octet-stream");
    res.set("Content-Disposition", `${disposition}; filename="${encodeURIComponent(att.filename || "download")}"`);
    res.set("Content-Length",      buf.length);
    res.set("Cache-Control",       "private, max-age=3600");
    return res.end(buf);
  } catch (err) {
    console.error("serveFile ERROR:", err);
    if (!res.headersSent) res.status(500).json({ message: "Server error", error: err.message });
  }
};

exports.downloadFile = (req, res) => serveFile(req, res, "attachment");
exports.previewFile  = (req, res) => serveFile(req, res, "inline");

// ─────────────────────────────────────────────────────────────────────────────
// POST /ticket/:ticketId/escalate-to-partner
// ─────────────────────────────────────────────────────────────────────────────
exports.escalateToPartner = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { reason }   = req.body;

    if (!ticketId || !mongoose.Types.ObjectId.isValid(ticketId)) {
      return res.status(400).json({ message: "Invalid ticket ID" });
    }

    const ticket = await Ticket.findById(ticketId).lean();
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
      status:             "in-progress",
      lastMessage:        `Escalated to partner by ${req.user.name || "Admin"}`,
      lastMessageTime:    new Date(),
      autoEscalated:      false,
      autoEscalatedAt:    null,
    });

    const adminSysMsg = await Message.create({
      ticketId:   ticket._id,
      senderId:   req.user._id,
      senderName: "System",
      senderRole: "system",
      text: `Your ticket has been escalated to the internship partner (${internship.jobTitle}) by ${req.user.name || "Admin"}. Reason: ${reason?.trim() || "Internship access issue"}. The partner will reply directly in this thread.`,
      read: true,
    });

    const io           = getIO(req);
    const safeAdminMsg = { ...adminSysMsg.toObject() };

    emit.toRoom(io,   "admin_room",           "new_message", { ticketId: ticket._id.toString(), message: safeAdminMsg });
    emit.toTicket(io, ticket._id.toString(),  "new_message", { ticketId: ticket._id.toString(), message: safeAdminMsg });
    emit.toUser(io,   ticket.studentId?.toString(), "new_message", { ticketId: ticket._id.toString(), message: safeAdminMsg });

    emit.toRoom(io, "admin_room", "ticket_escalated_to_partner", {
      originalTicketId: ticket._id.toString(),
      partnerId:        partnerId.toString(),
    });
    emit.toRoom(io, "admin_room", "ticket_status_update", {
      ticketId: ticket._id.toString(), status: "in-progress",
    });
    emit.toUser(io, ticket.studentId?.toString(), "ticket_status_update", {
      ticketId: ticket._id.toString(), status: "in-progress",
    });

    emit.toRoom(io, "admin_room", "ticket_escalation_resolved", { ticketId: ticket._id.toString() });

    const updatedTicket = await Ticket.findById(ticket._id).lean();
    emit.toPartner(io, partnerId.toString(), "partner_new_ticket", { ticket: updatedTicket });

    return res.status(200).json({
      success:       true,
      message:       "Ticket successfully escalated to partner",
      systemMessage: safeAdminMsg,
      partnerTicket: updatedTicket,
    });
  } catch (err) {
    console.error("escalateToPartner ERROR:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};
