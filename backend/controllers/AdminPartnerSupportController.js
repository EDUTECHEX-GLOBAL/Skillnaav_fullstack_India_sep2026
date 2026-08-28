/**
 * backend/controllers/Adminpartnersupportcontroller.js
 * Mounted at: /api/support/partner/admin
 *
 * ══════════════════════════════════════════════════════════════════
 *  FIXED: Admin Partner Support shows ALL partner tickets:
 *    - Partner's OWN tickets (senderType:"partner", no forwarded flags)
 *    - Escalated student→partner tickets (forwardedToPartner set)
 *
 *  When admin replies here on an ESCALATED ticket:
 *    → message saved to partner ticket
 *    → cross-posted to student ticket (admin sees it in student panel too)
 *    → student notified
 *
 *  When admin replies here on a partner OWN ticket:
 *    → message saved to partner ticket
 *    → partner notified via partner_{id} room
 *    → NO cross-post (no student involved)
 * ══════════════════════════════════════════════════════════════════
 */

const mongoose    = require("mongoose");
const Ticket      = require("../models/Ticket");
const { Message, decryptMessages } = require("../models/Message");
const Partner     = require("../models/webapp-models/partnerModel");

// ── Buffer conversion ─────────────────────────────────────────────────────────
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
    if (data.buffer && Buffer.isBuffer(data.buffer)) return data.buffer;
    if (data.buffer instanceof ArrayBuffer) return Buffer.from(new Uint8Array(data.buffer));
    if (typeof data.length === "number" && data[0] !== undefined)
      return Buffer.from(Object.values(data));
  }
  if (typeof data === "string") return Buffer.from(data, "base64");
  return null;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Base filter: ALL partner tickets (own + escalated from students).
 * The admin partner support panel shows everything in senderType:"partner".
 */
const allPartnerTicketBase = (extra = {}) => ({
  senderType: "partner",
  ...extra,
});

const classifyTicket = (t) => {
  const subj = t.subject || "";
  return (
    subj.startsWith("[Escalated]") ||
    subj.startsWith("[Forwarded]") ||
    !!(t.forwardedToPartner && (t.forwardedToPartner.id || t.forwardedToPartner.originalTicketId)) ||
    !!(t.forwardedFrom && t.forwardedFrom.ticketId)
  );
};

const getIO = (req) => req.app.get("io");

const emit = {
  toRoom:    (io, room,   ev, d) => { try { io?.to(room).emit(ev, d);              } catch (_) {} },
  toTicket:  (io, tId,    ev, d) => { try { io?.to(String(tId)).emit(ev, d);       } catch (_) {} },
  toUser:    (io, userId, ev, d) => { try { io?.to(`user_${userId}`).emit(ev, d);  } catch (_) {} },
  toPartner: (io, pId,    ev, d) => { try { io?.to(`partner_${pId}`).emit(ev, d); } catch (_) {} },
};

const safeMsg = (msg) => {
  const obj = msg.toObject ? msg.toObject() : { ...msg };
  obj.attachments = (obj.attachments || []).map(({ data: _omit, ...meta }) => ({
    ...meta,
    _id: meta._id ? meta._id.toString() : meta._id,
  }));
  return obj;
};

const getOriginalTicket = async (partnerTicket) => {
  const id =
    partnerTicket.forwardedToPartner?.originalTicketId ||
    partnerTicket.forwardedFrom?.ticketId ||
    null;
  if (!id) return null;
  try { return await Ticket.findById(id).lean(); } catch { return null; }
};

// ── Partners list ─────────────────────────────────────────────────────────────
exports.getPartnersList = async (req, res) => {
  try {
    const { search = "", limit = 20 } = req.query;
    const query = search
      ? { $or: [
          { name:        { $regex: search, $options: "i" } },
          { companyName: { $regex: search, $options: "i" } },
          { email:       { $regex: search, $options: "i" } },
        ] }
      : {};
    const partners = await Partner.find(query, "_id name email companyName").limit(parseInt(limit)).lean();
    return res.json({
      partners: partners.map(p => ({
        _id: p._id, name: p.name || p.companyName || p.email,
        companyName: p.companyName, email: p.email,
      })),
    });
  } catch (err) {
    console.error("getPartnersList error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ── Stats (ALL partner tickets) ───────────────────────────────────────────────
exports.getStats = async (req, res) => {
  try {
    const base      = allPartnerTicketBase();
    const ticketIds = await Ticket.distinct("_id", base);

    const [total, open, inProgress, resolved, urgent, unread] = await Promise.all([
      Ticket.countDocuments(base),
      Ticket.countDocuments(allPartnerTicketBase({ status: "open" })),
      Ticket.countDocuments(allPartnerTicketBase({ status: "in-progress" })),
      Ticket.countDocuments(allPartnerTicketBase({ status: { $in: ["resolved", "closed"] } })),
      Ticket.countDocuments(allPartnerTicketBase({ priority: "urgent" })),
      Message.countDocuments({
        ticketId:   { $in: ticketIds },
        senderRole: "partner",
        read:       false,
      }),
    ]);

    return res.json({
      total, open, inProgress, resolved, urgent,
      unread,
      unreadMessages: unread,
    });
  } catch (err) {
    console.error("admin getStats error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ── getAllTickets — ALL partner tickets (own + escalated) ─────────────────────
exports.getAllTickets = async (req, res) => {
  try {
    const { status, priority, search, page = 1, limit = 100 } = req.query;

    const must = [allPartnerTicketBase()];
    if (status   && status   !== "all") must.push({ status });
    if (priority && priority !== "all") must.push({ priority });
    if (search) {
      const rx = { $regex: search, $options: "i" };
      must.push({ $or: [{ subject: rx }, { senderName: rx }, { description: rx }, { studentName: rx }] });
    }

    const filter  = must.length === 1 ? must[0] : { $and: must };
    const skip    = (parseInt(page) - 1) * parseInt(limit);
    const total   = await Ticket.countDocuments(filter);
    const tickets = await Ticket.find(filter)
      .sort({ lastActivity: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const ticketIds = tickets.map(t => t._id);

    // Unread = messages from partner (senderRole:"partner") not yet read by admin
    const unreadAgg = ticketIds.length
      ? await Message.aggregate([
          { $match: { ticketId: { $in: ticketIds }, senderRole: "partner", read: false } },
          { $group: { _id: "$ticketId", count: { $sum: 1 } } },
        ])
      : [];

    // Last message per ticket
    const lastMsgAgg = ticketIds.length
      ? await Message.aggregate([
          { $match: { ticketId: { $in: ticketIds } } },
          { $sort:  { createdAt: -1 } },
          { $group: { _id: "$ticketId", text: { $first: "$text" }, at: { $first: "$createdAt" }, senderRole: { $first: "$senderRole" } } },
        ])
      : [];

    const unreadMap  = Object.fromEntries(unreadAgg.map(r   => [r._id.toString(), r.count]));
    const lastMsgMap = Object.fromEntries(lastMsgAgg.map(r  => [r._id.toString(), r]));

    return res.json({
      tickets: tickets.map(t => {
        const lm = lastMsgMap[t._id.toString()];
        return {
          ...t,
          isEscalated:   classifyTicket(t),
          unreadByAdmin: unreadMap[t._id.toString()] || 0,
          displayName:   t.senderName || t.studentName || "Partner",
          displayEmail:  t.studentEmail || "",
          lastMessage:   lm?.text ?? t.lastMessage ?? "",
          lastMessageTime: lm?.at ?? t.lastMessageTime ?? t.lastActivity ?? t.createdAt,
          lastMessageSender: lm?.senderRole ?? t.lastMessageSender ?? "",
          lastActivity:  lm?.at   ?? t.lastActivity ?? t.createdAt,
        };
      }),
      total,
      page: parseInt(page),
    });
  } catch (err) {
    console.error("getAllTickets error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ── getTicketById ─────────────────────────────────────────────────────────────
exports.getTicketById = async (req, res) => {
  try {
    const ticket = await Ticket.findOne(allPartnerTicketBase({ _id: req.params.ticketId })).lean();
    if (!ticket) return res.status(404).json({ message: "Ticket not found" });
    return res.json({ ticket: { ...ticket, isEscalated: classifyTicket(ticket) } });
  } catch (err) {
    console.error("admin getTicketById error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ── getMessages ───────────────────────────────────────────────────────────────
exports.getMessages = async (req, res) => {
  try {
    const ticket = await Ticket.findOne(allPartnerTicketBase({ _id: req.params.ticketId }));
    if (!ticket) return res.status(404).json({ message: "Ticket not found" });

    const raw = await Message.find({ ticketId: ticket._id }).sort({ createdAt: 1 }).lean();
    const messages = decryptMessages(raw).map(msg => ({
      ...msg,
      attachments: (msg.attachments || []).map(({ data: _omit, ...meta }) => ({
        ...meta,
        _id: meta._id ? meta._id.toString() : meta._id,
      })),
    }));
    return res.json({ messages });
  } catch (err) {
    console.error("admin getMessages error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ── sendMessage ───────────────────────────────────────────────────────────────
// ✅ FIXED: If escalated ticket, cross-post to student ticket too
exports.sendMessage = async (req, res) => {
  try {
    const adminId   = req.user._id || req.user.id;
    const adminName = req.user.name || "Admin";
    const { text, replyTo } = req.body;
    const files = req.files || [];

    if (!text?.trim() && !files.length)
      return res.status(400).json({ message: "Message text or attachment required" });

    const ticket = await Ticket.findOne(allPartnerTicketBase({ _id: req.params.ticketId }));
    if (!ticket) return res.status(404).json({ message: "Ticket not found" });

    const isEscalated = classifyTicket(ticket.toObject ? ticket.toObject() : ticket);

    const attachments = files.map(f => ({
      filename: f.originalname,
      mimetype: f.mimetype,
      type:     f.mimetype,
      size:     f.size,
      data:     f.buffer,
    }));

    // ── Step 1: Save to partner ticket ────────────────────────────────────────
    const message = await Message.create({
      ticketId:   ticket._id,
      senderId:   adminId,
      senderName: adminName,
      senderRole: "admin",
      text:       text?.trim() || "",
      attachments,
      replyTo:    replyTo || undefined,
      read:       false,
    });

    const newStatus = ticket.status === "open" ? "in-progress" : ticket.status;
    await Ticket.findByIdAndUpdate(ticket._id, {
      lastMessage:     (text?.trim() || (files[0]?.originalname ?? "")).substring(0, 100),
      lastMessageTime: new Date(),
      lastActivity:    new Date(),
      status:          newStatus,
    });

    const msgSafe       = safeMsg(message);
    const partnerRoomId = ticket.partnerId ? String(ticket.partnerId) :
                          ticket.forwardedToPartner?.id ? String(ticket.forwardedToPartner.id) : null;
    const io            = getIO(req);

    // Always notify partner of admin reply
    if (partnerRoomId) {
      emit.toPartner(io, partnerRoomId, "partner_new_message", {
        ticketId: ticket._id.toString(), message: msgSafe, adminName,
      });
    }
    // Notify admin partner support panel (for the chat to update)
    emit.toRoom(io, "admin_room", "partner_new_message", {
      ticketId: ticket._id.toString(), message: msgSafe,
    });
    // Also emit to ticket room
    emit.toTicket(io, ticket._id.toString(), "new_message", {
      ticketId: ticket._id.toString(), message: msgSafe,
    });

    // ── Step 2: If ESCALATED → cross-post to student ticket ───────────────────
    if (isEscalated) {
      const originalTicket = await getOriginalTicket(ticket.toObject ? ticket.toObject() : ticket);
      if (originalTicket) {
        // Duplicate guard
        const fiveSecondsAgo = new Date(Date.now() - 5000);
        const alreadySaved   = await Message.findOne({
          ticketId:   originalTicket._id,
          senderRole: "admin",
          senderId:   adminId,
          text:       text?.trim() || "",
          createdAt:  { $gte: fiveSecondsAgo },
        }).lean();

        if (!alreadySaved) {
          const studentMsg = await Message.create({
            ticketId:    originalTicket._id,
            senderId:    adminId,
            senderName:  adminName,
            senderRole:  "admin",
            text:        text?.trim() || "",
            attachments: [],
            read:        false,
          });

          await Ticket.findByIdAndUpdate(originalTicket._id, {
            lastMessage:     (text?.trim() || "Admin message").substring(0, 100),
            lastMessageTime: new Date(),
            lastActivity:    new Date(),
          });

          const safeStudentMsg = { ...studentMsg.toObject(), attachments: [] };

          // Notify admin student support panel
          emit.toRoom(io, "admin_room", "new_message", {
            ticketId: originalTicket._id.toString(), message: safeStudentMsg,
          });
          // Notify student
          if (originalTicket.studentId) {
            emit.toUser(io, originalTicket.studentId.toString(), "new_message", {
              ticketId: originalTicket._id.toString(), message: safeStudentMsg,
            });
          }
          emit.toTicket(io, originalTicket._id.toString(), "new_message", {
            ticketId: originalTicket._id.toString(), message: safeStudentMsg,
          });
        }
      }
    }

    return res.status(201).json({ message: msgSafe });
  } catch (err) {
    console.error("admin sendMessage error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ── markMessagesRead ──────────────────────────────────────────────────────────
exports.markMessagesRead = async (req, res) => {
  try {
    const ticket = await Ticket.findOne(allPartnerTicketBase({ _id: req.params.ticketId }));
    if (!ticket) return res.status(404).json({ message: "Ticket not found" });

    await Message.updateMany(
      { ticketId: ticket._id, senderRole: "partner", read: false },
      { $set: { read: true, readAt: new Date() } }
    );
    await Ticket.findByIdAndUpdate(ticket._id, { unreadCount: 0 });
    return res.json({ success: true });
  } catch (err) {
    console.error("markMessagesRead error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ── deleteMessage ─────────────────────────────────────────────────────────────
exports.deleteMessage = async (req, res) => {
  try {
    const ticket = await Ticket.findOne(allPartnerTicketBase({ _id: req.params.ticketId }));
    if (!ticket) return res.status(404).json({ message: "Ticket not found" });

    const msg = await Message.findOneAndDelete({
      _id:      req.params.messageId,
      ticketId: ticket._id,
    });
    if (!msg) return res.status(404).json({ message: "Message not found" });

    const io            = getIO(req);
    const partnerRoomId = ticket.partnerId ? String(ticket.partnerId) :
                          ticket.forwardedToPartner?.id ? String(ticket.forwardedToPartner.id) : null;
    if (partnerRoomId) {
      emit.toPartner(io, partnerRoomId, "partner_message_deleted", {
        ticketId:  ticket._id.toString(),
        messageId: msg._id.toString(),
      });
    }
    emit.toRoom(io, "admin_room", "partner_message_deleted", {
      ticketId:  ticket._id.toString(),
      messageId: msg._id.toString(),
    });
    return res.json({ success: true });
  } catch (err) {
    console.error("admin deleteMessage error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ── updateStatus ──────────────────────────────────────────────────────────────
exports.updateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const allowed    = ["open", "in-progress", "resolved", "closed"];
    if (!allowed.includes(status))
      return res.status(400).json({ message: `Allowed: ${allowed.join(", ")}` });

    const ticket = await Ticket.findOneAndUpdate(
      allPartnerTicketBase({ _id: req.params.ticketId }),
      { status, lastActivity: new Date() },
      { new: true }
    );
    if (!ticket) return res.status(404).json({ message: "Ticket not found" });

    const isEscalated   = classifyTicket(ticket.toObject());
    const io            = getIO(req);
    const partnerRoomId = ticket.partnerId ? String(ticket.partnerId) :
                          ticket.forwardedToPartner?.id ? String(ticket.forwardedToPartner.id) : null;

    if (partnerRoomId) {
      emit.toPartner(io, partnerRoomId, "partner_ticket_status_update", {
        ticketId: ticket._id.toString(), status, updatedTicket: ticket.toObject(),
      });
    }
    emit.toRoom(io, "admin_room", "partner_ticket_status_update", {
      ticketId: ticket._id.toString(), status,
    });
    emit.toRoom(io, "admin_room", "ticket_status_update", {
      ticketId: ticket._id.toString(), status,
    });

    // If escalated, sync status to original student ticket
    if (isEscalated) {
      const originalTicket = await getOriginalTicket(ticket.toObject());
      if (originalTicket) {
        if (status === "resolved") {
          await Ticket.findByIdAndUpdate(originalTicket._id, {
            status: "resolved", lastActivity: new Date(),
          });
        }
        emit.toRoom(io, "admin_room", "ticket_status_update", {
          ticketId: originalTicket._id.toString(), status,
        });
        if (originalTicket.studentId) {
          emit.toUser(io, originalTicket.studentId.toString(), "ticket_status_update", {
            ticketId: originalTicket._id.toString(), status,
          });
        }
      }
    }

    return res.json({ ticket: { ...ticket.toObject(), isEscalated } });
  } catch (err) {
    console.error("updateStatus error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ── assignTicket ──────────────────────────────────────────────────────────────
exports.assignTicket = async (req, res) => {
  try {
    const admin  = req.user;
    const ticket = await Ticket.findOneAndUpdate(
      allPartnerTicketBase({ _id: req.params.ticketId }),
      {
        assignedTo: {
          id: admin._id || admin.id, name: admin.name,
          email: admin.email, role: "admin",
        },
        status:       "in-progress",
        lastActivity: new Date(),
      },
      { new: true }
    );
    if (!ticket) return res.status(404).json({ message: "Ticket not found" });
    return res.json({ ticket: { ...ticket.toObject(), isEscalated: classifyTicket(ticket.toObject()) } });
  } catch (err) {
    console.error("assignTicket error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ── File download/preview ─────────────────────────────────────────────────────
const serveFile = async (req, res, disposition) => {
  try {
    const { attachmentId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(attachmentId))
      return res.status(400).json({ message: "Invalid attachment ID" });

    const oid     = new mongoose.Types.ObjectId(attachmentId);
    const message = await Message.findOne({ "attachments._id": oid }).lean();
    if (!message) return res.status(404).json({ message: "File not found" });

    const att = message.attachments.find(a => a._id && a._id.toString() === attachmentId);
    if (!att)      return res.status(404).json({ message: "Attachment not found" });
    if (!att.data) return res.status(404).json({ message: "File data missing" });

    const buf = toBuffer(att.data);
    if (!buf || buf.length === 0)
      return res.status(500).json({ message: "Failed to read file data" });

    res.set("Content-Type",        att.mimetype || att.type || "application/octet-stream");
    res.set("Content-Disposition", `${disposition}; filename="${encodeURIComponent(att.filename)}"`);
    res.set("Content-Length",      buf.length);
    res.set("Cache-Control",       "private, max-age=3600");
    return res.end(buf);
  } catch (err) {
    console.error("serveFile error:", err);
    if (!res.headersSent) res.status(500).json({ message: "Server error", error: err.message });
  }
};

exports.downloadFile = (req, res) => serveFile(req, res, "attachment");
exports.previewFile  = (req, res) => serveFile(req, res, "inline");
