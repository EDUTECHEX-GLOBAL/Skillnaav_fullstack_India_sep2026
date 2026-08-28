/**
 * backend/controllers/Partnersupportcontroller.js
 * Mounted at: /api/support/partner
 *
 * ATTACHMENT FIX SUMMARY
 * ─────────────────────────────────────────────────────────────
 * Route that exists:   GET /tickets/:tid/messages/:mid/attachments/:aid/preview
 * Route that exists:   GET /tickets/:tid/messages/:mid/attachments/:aid          (download)
 *
 * Old bug: getMessages and sendMessage built URLs with a "/download" suffix
 * that did NOT match any route, so every attachment 404'd.
 *
 * Fix: both getMessages and sendMessage now build only the /preview URL in
 * the `url` field. The frontend uses that single URL for both display AND
 * authenticated download via fetch() + Blob, so no bare <a href> is needed.
 */

const mongoose    = require("mongoose");
const Ticket      = require("../models/Ticket");
const { Message, decryptMessages, decryptText } = require("../models/Message");

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
    if (data.buffer && Buffer.isBuffer(data.buffer))   return data.buffer;
    if (data.buffer instanceof ArrayBuffer)            return Buffer.from(new Uint8Array(data.buffer));
    if (typeof data.length === "number" && data[0] !== undefined)
      return Buffer.from(Object.values(data));
  }
  if (typeof data === "string") return Buffer.from(data, "base64");
  return null;
};

const toObjectId = (id) => {
  try   { return new mongoose.Types.ObjectId(String(id)); }
  catch { return null; }
};

const io = (req) => req.app.get("io");

const emit = {
  toRoom:    (req, room,   ev, d) => { try { io(req)?.to(room).emit(ev, d);              } catch (_) {} },
  toTicket:  (req, tId,    ev, d) => { try { io(req)?.to(String(tId)).emit(ev, d);       } catch (_) {} },
  toUser:    (req, userId, ev, d) => { try { io(req)?.to(`user_${userId}`).emit(ev, d);  } catch (_) {} },
  toPartner: (req, pId,    ev, d) => { try { io(req)?.to(`partner_${pId}`).emit(ev, d); } catch (_) {} },
};

const stripAttachmentData = (msg) => {
  const obj = msg.toObject ? msg.toObject() : { ...msg };
  if (obj.attachments?.length) {
    obj.attachments = obj.attachments.map(({ data, ...rest }) => ({
      ...rest,
      _id: rest._id ? rest._id.toString() : rest._id,
    }));
  }
  return obj;
};

/**
 * Build the attachment URL sent to the frontend.
 * We always use the /preview endpoint — it serves the file inline with the
 * correct Content-Type. The frontend's authenticated downloader hits the
 * same URL, fetches with Authorization header, and saves the blob.
 *
 * Route: GET /api/support/partner/tickets/:tid/messages/:mid/attachments/:aid/preview
 */
const buildAttachmentUrls = (ticketId, messageId, attachments = []) =>
  attachments.map((att) => {
    const attId = att._id ? att._id.toString() : null;
    const base  = attId
      ? `/api/support/partner/tickets/${ticketId}/messages/${messageId}/attachments/${attId}/preview`
      : null;
    return {
      filename: att.filename,
      size:     att.size,
      mimetype: att.mimetype || att.type,
      type:     att.mimetype || att.type,
      _id:      attId,
      url:      base,   // used by frontend for both preview and download
      path:     base,   // kept for backwards compat
    };
  });

// ── createTicket ──────────────────────────────────────────────────────────────
exports.createTicket = async (req, res) => {
  try {
    const partnerId   = req.user._id || req.user.id;
    const partnerName = req.user.companyName || req.user.name || "Partner";
    const { description, category = "General Inquiry", priority = "medium" } = req.body;

    if (!description?.trim())
      return res.status(400).json({ message: "Description is required" });

    const PARTNER_CATEGORIES = [
      "Technical Issue", "Subscription Issues", "Account Issues",
      "Posted Internship Issues", "General Inquiry",
    ];
    const safeCategory = PARTNER_CATEGORIES.includes(category) ? category : "General Inquiry";
    const now = new Date();

    const files = req.files || [];
    const attachments = files.map(f => ({
      filename: f.originalname,
      size:     f.size,
      mimetype: f.mimetype,
      type:     f.mimetype,
      data:     f.buffer,
    }));

    const ticket = await Ticket.create({
      partnerId, senderName: partnerName, senderType: "partner",
      subject: safeCategory, description: description.trim(),
      category: safeCategory, priority, status: "open",
      lastMessage: description.trim().substring(0, 100),
      lastMessageTime: now, lastActivity: now,
    });

    const initMsg = await Message.create({
      ticketId:   ticket._id,
      senderId:   partnerId,
      senderName: partnerName,
      senderRole: "partner",
      text:       description.trim(),
      attachments,
      read:       false,
    });

    // Build safe init message with correct URLs
    const initMsgObj = initMsg.toObject ? initMsg.toObject() : { ...initMsg };
    const safeInitMsg = {
      ...stripAttachmentData(initMsg),
      attachments: buildAttachmentUrls(ticket._id, initMsg._id, initMsgObj.attachments || []),
    };

    emit.toRoom(req, "admin_room", "partner_new_ticket",     { ticket: ticket.toObject() });
    emit.toRoom(req, "admin_room", "partner_ticket_created", { ticket: ticket.toObject() });
    emit.toRoom(req, "admin_room", "partner_new_message",    { ticketId: ticket._id.toString(), message: safeInitMsg, partnerName });

    return res.status(201).json({ ticket, initMessage: safeInitMsg });
  } catch (err) {
    console.error("createTicket error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ── getStats ──────────────────────────────────────────────────────────────────
exports.getStats = async (req, res) => {
  try {
    const partnerId = req.user._id || req.user.id;
    const oid       = toObjectId(partnerId);
    const base      = { partnerId: oid, $or: [{ senderType: "partner" }, { escalatedToPartner: true }] };

    const ticketIds = await Ticket.distinct("_id", base);
    const unreadMessages = ticketIds.length
      ? await Message.countDocuments({
          ticketId:   { $in: ticketIds },
          senderRole: { $in: ["admin", "system", "user"] },
          read:       false,
        })
      : 0;

    const [total, open, inProgress, resolved, escalated, urgent] = await Promise.all([
      Ticket.countDocuments(base),
      Ticket.countDocuments({ ...base, status: "open" }),
      Ticket.countDocuments({ ...base, status: "in-progress" }),
      Ticket.countDocuments({ ...base, status: "resolved" }),
      Ticket.countDocuments({ partnerId: oid, escalatedToPartner: true }),
      Ticket.countDocuments({ ...base, priority: "urgent", status: { $nin: ["resolved", "closed"] } }),
    ]);

    return res.json({ total, open, inProgress, resolved, unreadMessages, escalated, urgent });
  } catch (err) {
    console.error("partner getStats error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ── getMyTickets ──────────────────────────────────────────────────────────────
exports.getMyTickets = async (req, res) => {
  try {
    const partnerId = req.user._id || req.user.id;
    const oid       = toObjectId(partnerId);
    const { status, search, page = 1, limit = 100 } = req.query;

    const base = {
      partnerId: oid,
      $or: [{ senderType: "partner" }, { escalatedToPartner: true }],
    };

    const conditions = [base];
    if (status && status !== "all") conditions.push({ status });
    if (search) {
      const rx = { $regex: search.trim(), $options: "i" };
      conditions.push({ $or: [{ subject: rx }, { description: rx }, { senderName: rx }, { studentName: rx }] });
    }

    const filter  = conditions.length === 1 ? conditions[0] : { $and: conditions };
    const skip    = (parseInt(page) - 1) * parseInt(limit);
    const total   = await Ticket.countDocuments(filter);
    const tickets = await Ticket.find(filter).sort({ lastActivity: -1, lastMessageTime: -1, createdAt: -1 }).skip(skip).limit(parseInt(limit)).lean();

    const ticketIds = tickets.map(t => t._id);
    const unreadAgg = ticketIds.length
      ? await Message.aggregate([
          { $match: { ticketId: { $in: ticketIds }, senderRole: { $in: ["admin", "system", "user"] }, read: false } },
          { $group: { _id: "$ticketId", count: { $sum: 1 } } },
        ])
      : [];

    const unreadMap = {};
    unreadAgg.forEach(r => { unreadMap[r._id.toString()] = r.count; });

    return res.json({
      tickets: tickets.map(t => ({
        ...t,
        isEscalated:     !!t.escalatedToPartner,
        unreadByPartner: unreadMap[t._id.toString()] || 0,
      })),
      total, page: parseInt(page),
    });
  } catch (err) {
    console.error("getMyTickets error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ── getMessages ───────────────────────────────────────────────────────────────
exports.getMessages = async (req, res) => {
  try {
    const partnerId = req.user._id || req.user.id;
    const oid       = toObjectId(partnerId);
    const ticket    = await Ticket.findOne({
      _id: req.params.ticketId,
      partnerId: oid,
      $or: [{ senderType: "partner" }, { escalatedToPartner: true }],
    });
    if (!ticket) return res.status(404).json({ message: "Ticket not found" });

    const raw = await Message.find({ ticketId: ticket._id }).sort({ createdAt: 1 }).lean();

    // FIXED: use buildAttachmentUrls helper — single /preview URL, no stray /download
    const messages = decryptMessages(raw).map(msg => ({
      ...msg,
      attachments: buildAttachmentUrls(ticket._id, msg._id, msg.attachments || []),
    }));

    return res.json({ messages });
  } catch (err) {
    console.error("getMessages error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ── sendMessage ───────────────────────────────────────────────────────────────
exports.sendMessage = async (req, res) => {
  try {
    const partnerId   = req.user._id || req.user.id;
    const partnerName = req.user.companyName || req.user.name || "Partner";
    const text        = (req.body?.text || "").trim();
    const replyTo     = req.body?.replyTo || undefined;
    const files       = req.files || [];
    const oid         = toObjectId(partnerId);

    if (!text && files.length === 0)
      return res.status(400).json({ message: "Message text or at least one attachment is required" });

    const ticket = await Ticket.findOne({
      _id: req.params.ticketId,
      partnerId: oid,
      $or: [{ senderType: "partner" }, { escalatedToPartner: true }],
    });
    if (!ticket) return res.status(404).json({ message: "Ticket not found" });
    if (["resolved", "closed"].includes(ticket.status))
      return res.status(400).json({ message: "Cannot reply to a closed/resolved ticket" });

    const isEscalated = !!ticket.escalatedToPartner;

    const attachments = files.map(f => ({
      filename: f.originalname, size: f.size, mimetype: f.mimetype, type: f.mimetype, data: f.buffer,
    }));

    const message = await Message.create({
      ticketId:   ticket._id,
      senderId:   partnerId,
      senderName: partnerName,
      senderRole: "partner",
      text,
      attachments,
      replyTo: replyTo || undefined,
      read:    false,
    });

    const preview = text || (files.length ? `📎 ${files[0].originalname}` : "");
    await Ticket.findByIdAndUpdate(ticket._id, {
      lastMessage:     decryptText(preview).substring(0, 100),
      lastMessageTime: new Date(),
      lastActivity:    new Date(),
    });

    // FIXED: use buildAttachmentUrls helper — single /preview URL, no stray /download
    const msgObj = message.toObject ? message.toObject() : { ...message };
    const safeMessage = {
      ...msgObj,
      attachments: buildAttachmentUrls(ticket._id, message._id, msgObj.attachments || []),
    };

    if (isEscalated) {
      emit.toRoom(req,   "admin_room",                  "new_message", { ticketId: ticket._id.toString(), message: safeMessage });
      emit.toTicket(req, ticket._id.toString(),         "new_message", { ticketId: ticket._id.toString(), message: safeMessage });
      emit.toPartner(req, partnerId.toString(),         "new_message", { ticketId: ticket._id.toString(), message: safeMessage });
      if (ticket.studentId) {
        emit.toUser(req, ticket.studentId.toString(),   "new_message", { ticketId: ticket._id.toString(), message: safeMessage });
      }
    } else {
      emit.toRoom(req,   "admin_room",         "partner_new_message", { ticketId: ticket._id.toString(), message: safeMessage, partnerName });
      emit.toPartner(req, partnerId.toString(),"partner_new_message", { ticketId: ticket._id.toString(), message: safeMessage, partnerName });
      emit.toTicket(req, ticket._id.toString(),"new_message",         { ticketId: ticket._id.toString(), message: safeMessage });
    }

    return res.status(201).json({ message: safeMessage });
  } catch (err) {
    console.error("sendMessage error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ── markMessagesRead ──────────────────────────────────────────────────────────
exports.markMessagesRead = async (req, res) => {
  try {
    const partnerId = req.user._id || req.user.id;
    const oid       = toObjectId(partnerId);
    const ticket    = await Ticket.findOne({
      _id: req.params.ticketId,
      partnerId: oid,
      $or: [{ senderType: "partner" }, { escalatedToPartner: true }],
    });
    if (!ticket) return res.status(404).json({ message: "Ticket not found" });

    await Message.updateMany(
      { ticketId: ticket._id, senderRole: { $in: ["admin", "system", "user"] }, read: false },
      { $set: { read: true, readAt: new Date() } }
    );
    emit.toRoom(req, "admin_room", "partner_messages_read", {
      ticketId:  ticket._id.toString(),
      partnerId: partnerId.toString(),
    });
    return res.json({ success: true });
  } catch (err) {
    console.error("markMessagesRead error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ── deleteMessage ─────────────────────────────────────────────────────────────
exports.deleteMessage = async (req, res) => {
  try {
    const partnerId = req.user._id || req.user.id;
    const oid       = toObjectId(partnerId);
    const ticket    = await Ticket.findOne({
      _id: req.params.ticketId,
      partnerId: oid,
      $or: [{ senderType: "partner" }, { escalatedToPartner: true }],
    });
    if (!ticket) return res.status(404).json({ message: "Ticket not found" });

    const msg = await Message.findOne({
      _id: req.params.messageId, ticketId: ticket._id, senderId: partnerId, senderRole: "partner",
    });
    if (!msg) return res.status(404).json({ message: "Message not found or not yours" });

    await msg.deleteOne();

    const isEscalated = !!ticket.escalatedToPartner;
    if (isEscalated) {
      emit.toRoom(req, "admin_room", "message_deleted", { ticketId: ticket._id.toString(), messageId: msg._id.toString() });
      emit.toTicket(req, ticket._id.toString(), "message_deleted", { ticketId: ticket._id.toString(), messageId: msg._id.toString() });
      emit.toPartner(req, partnerId.toString(), "message_deleted", { ticketId: ticket._id.toString(), messageId: msg._id.toString() });
    } else {
      emit.toRoom(req, "admin_room", "partner_message_deleted", { ticketId: ticket._id.toString(), messageId: msg._id.toString() });
      emit.toPartner(req, partnerId.toString(), "partner_message_deleted", { ticketId: ticket._id.toString(), messageId: msg._id.toString() });
    }
    return res.json({ success: true });
  } catch (err) {
    console.error("deleteMessage error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ── updateStatus ──────────────────────────────────────────────────────────────
exports.updateStatus = async (req, res) => {
  try {
    const partnerId  = req.user._id || req.user.id;
    const oid        = toObjectId(partnerId);
    const { status } = req.body;
    const allowed    = ["open", "in-progress", "resolved"];
    if (!allowed.includes(status))
      return res.status(400).json({ message: `Allowed statuses: ${allowed.join(", ")}` });

    const ticket = await Ticket.findOneAndUpdate(
      { _id: req.params.ticketId, partnerId: oid, $or: [{ senderType: "partner" }, { escalatedToPartner: true }] },
      { status, lastActivity: new Date() },
      { new: true }
    );
    if (!ticket) return res.status(404).json({ message: "Ticket not found" });

    const isEscalated = !!ticket.escalatedToPartner;
    const statusPayload = { ticketId: ticket._id.toString(), status };

    emit.toPartner(req, partnerId.toString(), "ticket_status_update", statusPayload);
    emit.toRoom(req,    "admin_room",         "ticket_status_update", statusPayload);
    emit.toTicket(req,  ticket._id.toString(),"ticket_status_update", statusPayload);

    if (isEscalated) {
      const sysMsg = await Message.create({
        ticketId:   ticket._id,
        senderId:   partnerId,
        senderName: "System",
        senderRole: "system",
        text:       `Partner has updated the internship issue status to "${status}".`,
        read:       false,
      });
      const safeSysMsg = { ...sysMsg.toObject() };

      emit.toRoom(req,   "admin_room",                "new_message", { ticketId: ticket._id.toString(), message: safeSysMsg });
      emit.toTicket(req, ticket._id.toString(),       "new_message", { ticketId: ticket._id.toString(), message: safeSysMsg });
      emit.toPartner(req, partnerId.toString(),       "new_message", { ticketId: ticket._id.toString(), message: safeSysMsg });
      if (ticket.studentId) {
        emit.toUser(req, ticket.studentId.toString(), "new_message", { ticketId: ticket._id.toString(), message: safeSysMsg });
        emit.toUser(req, ticket.studentId.toString(), "ticket_status_update", statusPayload);
      }
    }

    return res.json({ ticket: { ...ticket.toObject(), isEscalated } });
  } catch (err) {
    console.error("updateStatus error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ── getTicketById ─────────────────────────────────────────────────────────────
exports.getTicketById = async (req, res) => {
  try {
    const partnerId = req.user._id || req.user.id;
    const oid       = toObjectId(partnerId);
    const ticket    = await Ticket.findOne({
      _id: req.params.ticketId,
      partnerId: oid,
      $or: [{ senderType: "partner" }, { escalatedToPartner: true }],
    }).lean();
    if (!ticket) return res.status(404).json({ message: "Ticket not found" });
    return res.json({ ticket: { ...ticket, isEscalated: !!ticket.escalatedToPartner } });
  } catch (err) {
    console.error("getTicketById error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ── getTicketActivity ─────────────────────────────────────────────────────────
exports.getTicketActivity = async (req, res) => {
  try {
    const partnerId = req.user._id || req.user.id;
    const oid       = toObjectId(partnerId);
    const ticket    = await Ticket.findOne({
      _id: req.params.ticketId,
      partnerId: oid,
      $or: [{ senderType: "partner" }, { escalatedToPartner: true }],
    }).lean();
    if (!ticket) return res.status(404).json({ message: "Ticket not found" });
    const activity = await Message.find({ ticketId: ticket._id, senderRole: "system" }).sort({ createdAt: 1 }).lean();
    return res.json({ activity });
  } catch (err) {
    console.error("getTicketActivity error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ── deleteTicket ──────────────────────────────────────────────────────────────
exports.deleteTicket = async (req, res) => {
  try {
    const partnerId    = req.user._id || req.user.id;
    const oid          = toObjectId(partnerId);
    const { ticketId } = req.params;
    const mode         = (req.query.mode || "everyone").toLowerCase();

    if (!["me", "everyone"].includes(mode))
      return res.status(400).json({ message: "Invalid mode. Use ?mode=me or ?mode=everyone" });

    const ticket = await Ticket.findOne({ _id: ticketId, partnerId: oid, senderType: "partner" });
    if (!ticket)
      return res.status(404).json({ message: "Ticket not found or you don't have permission." });

    if (ticket.escalatedToPartner)
      return res.status(403).json({ message: "Escalated tickets cannot be deleted by partners." });

    if (mode === "me") {
      await Ticket.findByIdAndUpdate(ticketId, { $addToSet: { deletedForPartners: oid } });
      emit.toPartner(req, partnerId, "partner_ticket_deleted_for_me", {
        ticketId, partnerId: String(partnerId), mode: "me",
      });
      return res.json({ success: true, mode: "me", message: "Ticket hidden from your view." });
    }

    await Message.deleteMany({ ticketId: ticket._id });
    await Ticket.findByIdAndDelete(ticketId);

    emit.toRoom(req,    "admin_room", "partner_ticket_deleted", { ticketId, partnerId: String(partnerId), mode: "everyone" });
    emit.toPartner(req, partnerId,   "partner_ticket_deleted", { ticketId, partnerId: String(partnerId), mode: "everyone" });
    return res.json({ success: true, mode: "everyone", message: "Ticket deleted for everyone." });
  } catch (err) {
    console.error("deleteTicket error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ── getTicketsSummary ─────────────────────────────────────────────────────────
exports.getTicketsSummary = async (req, res) => {
  try {
    const partnerId = req.user._id || req.user.id;
    const oid       = toObjectId(partnerId);
    const base      = { partnerId: oid, $or: [{ senderType: "partner" }, { escalatedToPartner: true }] };

    const [total, open, inProgress, resolved] = await Promise.all([
      Ticket.countDocuments(base),
      Ticket.countDocuments({ ...base, status: "open" }),
      Ticket.countDocuments({ ...base, status: "in-progress" }),
      Ticket.countDocuments({ ...base, status: "resolved" }),
    ]);

    return res.json({ total, open, inProgress, resolved });
  } catch (err) {
    console.error("getTicketsSummary error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ── downloadAttachment ────────────────────────────────────────────────────────
// Serves file with Content-Disposition: attachment (forces browser save dialog)
exports.downloadAttachment = async (req, res) => {
  try {
    const partnerId = req.user._id || req.user.id;
    const oid       = toObjectId(partnerId);
    const { ticketId, messageId, attachmentId } = req.params;
    const ticket = await Ticket.findOne({
      _id: ticketId,
      partnerId: oid,
      $or: [{ senderType: "partner" }, { escalatedToPartner: true }],
    }).lean();
    if (!ticket) return res.status(404).json({ message: "Ticket not found" });
    const message = await Message.findOne({ _id: messageId, ticketId: ticket._id }).lean();
    if (!message) return res.status(404).json({ message: "Message not found" });
    const attachment = (message.attachments || []).find(a => a._id && a._id.toString() === attachmentId);
    if (!attachment || !attachment.data) return res.status(404).json({ message: "Attachment not found" });
    const buf = toBuffer(attachment.data);
    if (!buf || buf.length === 0) return res.status(500).json({ message: "Failed to read file data" });
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(attachment.filename)}"`);
    res.setHeader("Content-Type", attachment.mimetype || attachment.type || "application/octet-stream");
    res.setHeader("Content-Length", buf.length);
    res.setHeader("Cache-Control", "private, max-age=3600");
    return res.end(buf);
  } catch (err) {
    console.error("downloadAttachment error:", err);
    if (!res.headersSent) res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ── previewAttachment ─────────────────────────────────────────────────────────
// Serves file inline (images display in browser, other types download).
// This is the SINGLE URL used by the frontend for BOTH display and download.
exports.previewAttachment = async (req, res) => {
  try {
    const partnerId = req.user._id || req.user.id;
    const oid       = toObjectId(partnerId);
    const { ticketId, messageId, attachmentId } = req.params;
    const ticket = await Ticket.findOne({
      _id: ticketId,
      partnerId: oid,
      $or: [{ senderType: "partner" }, { escalatedToPartner: true }],
    }).lean();
    if (!ticket) return res.status(404).json({ message: "Ticket not found" });
    const message = await Message.findOne({ _id: messageId, ticketId: ticket._id }).lean();
    if (!message) return res.status(404).json({ message: "Message not found" });
    const attachment = (message.attachments || []).find(a => a._id && a._id.toString() === attachmentId);
    if (!attachment || !attachment.data) return res.status(404).json({ message: "Attachment not found" });
    const buf = toBuffer(attachment.data);
    if (!buf || buf.length === 0) return res.status(500).json({ message: "Failed to read file data" });

    const mime = attachment.mimetype || attachment.type || "application/octet-stream";
    // Images, videos, and PDFs display inline; everything else forces a download
    const isInline = mime.startsWith("image/") || mime.startsWith("video/") || mime === "application/pdf";
    res.setHeader(
      "Content-Disposition",
      `${isInline ? "inline" : "attachment"}; filename="${encodeURIComponent(attachment.filename)}"`
    );
    res.setHeader("Content-Type", mime);
    res.setHeader("Content-Length", buf.length);
    res.setHeader("Cache-Control", "private, max-age=3600");
    return res.end(buf);
  } catch (err) {
    console.error("previewAttachment error:", err);
    if (!res.headersSent) res.status(500).json({ message: "Server error", error: err.message });
  }
};
