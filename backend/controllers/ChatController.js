// ─── ChatController.js ────────────────────────────────────────────────────────
const path  = require("path");
const Chat  = require("../models/webapp-models/ChatModel");
const Admin = require("../models/webapp-models/adminModel");
const Internship = require("../models/webapp-models/internshipPostModel");
const { getIO } = require("../utils/socket");

// ✅ Reuse your existing S3 uploader — zero new dependencies
const { chatFileUpload } = require("../utils/multer");
// ↑ Adjust path if your file is elsewhere, e.g.:
//     "../config/s3Uploader"
//     "../middleware/s3Uploader"

// ─── Constants ────────────────────────────────────────────────────────────────
const MESSAGES_PER_PAGE = 20;
const MAX_FILE_BYTES    = 10 * 1024 * 1024; // 10 MB

// Same regex pattern style your project already uses
const ALLOWED_CHAT_FILES = /jpe?g|png|gif|webp|pdf|docx?|txt/;

// ─── Multer-S3 middleware for chat attachments ────────────────────────────────
// Reuses createUploader() exactly like resumeUpload / profilePicUpload do.
// Files land in  s3://<AWS_RESUME_BUCKET>/chat-attachments/<timestamp-random.ext>
// Add AWS_CHAT_BUCKET to your .env if you want a dedicated bucket.
const chatUploadMiddleware = chatFileUpload.single("file");

// ─── Helper ───────────────────────────────────────────────────────────────────
const formatBytes = (bytes) => {
  if (!bytes)               return "0 B";
  if (bytes < 1024)         return bytes + " B";
  if (bytes < 1024 * 1024)  return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
};

// ─── Resolve admin _id from DB ────────────────────────────────────────────────
const getAdminId = async () => {
  let admin = await Admin.findOne({ isAdmin: true }).sort({ createdAt: 1 }).select("_id").lean();
  
  if (!admin) {
    admin = await Admin.findOne({ role: "Super Admin" }).sort({ createdAt: 1 }).select("_id").lean();
  }
  
  if (!admin) {
    admin = await Admin.findOne().sort({ createdAt: 1 }).select("_id").lean();
  }

  if (!admin) throw new Error("No admin user found in the database.");
  return admin._id.toString();
};

const buildUnreadSummary = async (receiverId) => {
  const unreadMessages = await Chat.find({
    receiver: receiverId,
    readAt: null,
    isDeleted: { $ne: true },
  })
    .sort({ createdAt: -1 })
    .lean();

  const conversationsByInternship = new Map();

  unreadMessages.forEach((message) => {
    const internshipId = message.internship?.toString();
    if (!internshipId) return;

    if (!conversationsByInternship.has(internshipId)) {
      conversationsByInternship.set(internshipId, {
        internshipId,
        unreadCount: 0,
        latestMessage: message,
        latestAt: message.createdAt || message.timestamp,
        messageIds: [],
      });
    }

    const conv = conversationsByInternship.get(internshipId);
    conv.unreadCount += 1;
    conv.messageIds.push(message._id);
  });

  const conversations = Array.from(conversationsByInternship.values());
  const internshipIds = conversations.map((item) => item.internshipId);
  const internships = await Internship.find({ _id: { $in: internshipIds } })
    .select("_id jobTitle companyName partnerId imgUrl location internshipType internshipMode deleted")
    .lean();
  const internshipById = new Map(internships.map((item) => [item._id.toString(), item]));

  // Determine whether the receiver is admin or a partner
  let isAdmin = false;
  try {
    const adminId = await getAdminId();
    isAdmin = receiverId.toString() === adminId.toString();
  } catch (_) {}

  // Filter out conversations where the internship doesn't exist, is deleted,
  // or (for partners) doesn't belong to this partner.
  // Auto-mark orphan messages as read so the badge doesn't persist.
  const orphanMessageIds = [];
  const validConversations = conversations.filter((item) => {
    const internship = internshipById.get(item.internshipId) || null;
    item.internship = internship;

    if (!internship || internship.deleted === true) {
      // Internship missing or deleted — these messages are orphans
      orphanMessageIds.push(...item.messageIds);
      return false;
    }

    if (!isAdmin && internship.partnerId) {
      // For partners: only count messages on internships they own
      if (internship.partnerId.toString() !== receiverId.toString()) {
        orphanMessageIds.push(...item.messageIds);
        return false;
      }
    }

    // Remove internal tracking field before returning
    delete item.messageIds;
    return true;
  });

  // Silently mark orphan/invalid messages as read so they stop appearing
  if (orphanMessageIds.length > 0) {
    Chat.updateMany(
      { _id: { $in: orphanMessageIds } },
      { $set: { readAt: new Date() } }
    ).catch((err) => console.error("buildUnreadSummary cleanup:", err));
  }

  validConversations.sort((a, b) => new Date(b.latestAt || 0) - new Date(a.latestAt || 0));

  const totalUnread = validConversations.reduce((sum, c) => sum + c.unreadCount, 0);

  return {
    totalUnread,
    conversations: validConversations,
  };
};

const emitUnreadSummary = async (receiverId, roomName) => {
  const io = getIO();
  if (!io || !receiverId || !roomName) return;

  try {
    const summary = await buildUnreadSummary(receiverId);
    io.to(roomName).emit("chatUnreadUpdated", summary);
  } catch (err) {
    console.error("emitUnreadSummary:", err);
  }
};

// ─── Resolve receiver ─────────────────────────────────────────────────────────
// Partner → Admin  :  receiver = admin _id (from DB)
// Admin   → Partner:  receiver = partnerId (from request body)
const resolveReceiver = async (senderId, partnerIdFromBody) => {
  // Check if sender is ANY admin
  const isAdminSender = await Admin.exists({ _id: senderId });
  
  if (isAdminSender) {
    if (!partnerIdFromBody)
      throw new Error("partnerId is required when admin sends a message.");
    return partnerIdFromBody;
  }
  
  // If sender is partner, receiver is the primary shared admin inbox
  const primaryAdminId = await getAdminId();
  return primaryAdminId;
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /partner/:partnerId/internship/:internshipId?page=1&limit=20
// Partner view — paginated, soft-delete filtered
// ─────────────────────────────────────────────────────────────────────────────
const getChatMessages = async (req, res) => {
  const { internshipId, partnerId } = req.params;
  const page  = Math.max(1, parseInt(req.query.page)  || 1);
  const limit = Math.min(50, parseInt(req.query.limit) || MESSAGES_PER_PAGE);
  const skip  = (page - 1) * limit;

  try {
    if (!internshipId || !partnerId)
      return res.status(400).json({ error: "internshipId and partnerId are required." });

    const filter = { internship: internshipId, isDeleted: { $ne: true } };

    const [messages, total] = await Promise.all([
      Chat.find(filter).sort({ createdAt: 1 }).skip(skip).limit(limit).lean(),
      Chat.countDocuments(filter),
    ]);

    return res.status(200).json({
      data: messages,
      total,
      totalPages: Math.ceil(total / limit),
      page,
    });
  } catch (err) {
    console.error("getChatMessages:", err);
    return res.status(500).json({ error: "Failed to fetch messages.", details: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /internship/:internshipId?page=1&limit=20
// Admin view — paginated, soft-delete filtered
// ─────────────────────────────────────────────────────────────────────────────
const getMessages = async (req, res) => {
  const { internshipId } = req.params;
  const page  = Math.max(1, parseInt(req.query.page)  || 1);
  const limit = Math.min(50, parseInt(req.query.limit) || MESSAGES_PER_PAGE);
  const skip  = (page - 1) * limit;

  try {
    if (!internshipId)
      return res.status(400).json({ error: "internshipId is required." });

    const filter = { internship: internshipId, isDeleted: { $ne: true } };

    const [messages, total] = await Promise.all([
      Chat.find(filter).sort({ createdAt: 1 }).skip(skip).limit(limit).lean(),
      Chat.countDocuments(filter),
    ]);

    return res.status(200).json({
      data: messages,
      total,
      totalPages: Math.ceil(total / limit),
      page,
    });
  } catch (err) {
    console.error("getMessages:", err);
    return res.status(500).json({ error: "Failed to fetch messages.", details: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /send
// Works for text-only AND text + file (after /upload has already run)
//
// Body (partner → admin):  { internshipId, senderId, message }
// Body (admin → partner):  { internshipId, senderId, partnerId, message }
// Body (with attachment):  { ...above, fileUrl, fileName, fileType, fileSize }
// ─────────────────────────────────────────────────────────────────────────────
const sendMessage = async (req, res) => {
  const {
    internshipId, senderId, message,
    fileUrl, fileName, fileType, fileSize,
  } = req.body;
  const partnerIdFromBody = req.body.partnerId || req.body.receiverId || null;

  try {
    if (!internshipId || !senderId)
      return res.status(400).json({ error: "internshipId and senderId are required." });

    if (!message?.trim() && !fileUrl)
      return res.status(400).json({ error: "message or fileUrl is required." });

    let receiverId;
    try {
      receiverId = await resolveReceiver(senderId, partnerIdFromBody);
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }

    const newMessage = await Chat.create({
      internship: internshipId,
      sender:     senderId,
      receiver:   receiverId,
      message:    message?.trim() || (fileName ? `Sent a file: ${fileName}` : ""),
      fileUrl:    fileUrl  || null,
      fileName:   fileName || null,
      fileType:   fileType || null,
      fileSize:   fileSize || null,
    });

    // Socket.io real-time delivery + unread badge refresh
    const io = req.io || getIO();
    if (io) {
      io.to(internshipId).emit("newMessage", newMessage);
      io.to(`chat_${internshipId}`).emit("newMessage", newMessage);
    }

    const adminId = await getAdminId();
    const receiverRoom =
      receiverId.toString() === adminId.toString()
        ? "admin_notifications"
        : `partner_${receiverId}`;
    await emitUnreadSummary(receiverId, receiverRoom);

    return res.status(201).json(newMessage);
  } catch (err) {
    console.error("sendMessage:", err);
    return res.status(500).json({ error: "Failed to send message.", details: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /upload
// Step 1 of file send:
//   - chatUploadMiddleware (runs first in the route) streams the file to S3
//   - multer-s3 adds req.file.location = the public S3 URL automatically
//   - We just read that and return it to the frontend
//
// Step 2: frontend calls POST /send with the returned metadata
// ─────────────────────────────────────────────────────────────────────────────
const uploadChatFile = (req, res) => {
  // multer-s3 has already written to S3 before this function runs
  if (!req.file)
    return res.status(400).json({ error: "No file received." });

  return res.status(200).json({
    fileUrl:  req.file.location,        // S3 public URL (set by multer-s3)
    fileName: req.file.originalname,
    fileType: req.file.mimetype,
    fileSize: formatBytes(req.file.size),
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /:messageId
// Soft-delete — sets isDeleted: true.  Document stays in DB forever.
// Both parties see "This message was deleted" in the UI.
// Body: { requesterId }
// ─────────────────────────────────────────────────────────────────────────────
const deleteMessage = async (req, res) => {
  const { messageId }   = req.params;
  const { requesterId } = req.body;

  try {
    if (!messageId)
      return res.status(400).json({ error: "messageId is required." });

    const msg = await Chat.findById(messageId);
    if (!msg)
      return res.status(404).json({ error: "Message not found." });

    // Guard: only the original sender can delete
    if (requesterId && msg.sender.toString() !== requesterId.toString())
      return res.status(403).json({ error: "You can only delete your own messages." });

    msg.isDeleted = true;
    msg.deletedAt = new Date();
    await msg.save();

    // Real-time: other party's UI updates instantly
    const io = req.io || getIO();
    if (io) {
      io.to(msg.internship.toString()).emit("messageDeleted", { messageId });
      io.to(`chat_${msg.internship.toString()}`).emit("messageDeleted", { messageId });
    }

    return res.status(200).json({ success: true, messageId });
  } catch (err) {
    console.error("deleteMessage:", err);
    return res.status(500).json({ error: "Failed to delete message.", details: err.message });
  }
};

// GET /api/chats/unread/admin
const getAdminUnreadMessages = async (_req, res) => {
  try {
    const adminId = await getAdminId();
    const summary = await buildUnreadSummary(adminId);
    return res.status(200).json(summary);
  } catch (err) {
    console.error("getAdminUnreadMessages:", err);
    return res.status(500).json({ error: "Failed to fetch unread messages.", details: err.message });
  }
};

// GET /api/chats/unread/partner/:partnerId
const getPartnerUnreadMessages = async (req, res) => {
  try {
    const { partnerId } = req.params;
    if (!partnerId) return res.status(400).json({ error: "partnerId is required." });

    const summary = await buildUnreadSummary(partnerId);
    return res.status(200).json(summary);
  } catch (err) {
    console.error("getPartnerUnreadMessages:", err);
    return res.status(500).json({ error: "Failed to fetch unread messages.", details: err.message });
  }
};

// PATCH /api/chats/read
// Body: { internshipId, readerId }
const markConversationRead = async (req, res) => {
  try {
    const { internshipId, readerId } = req.body;
    if (!internshipId || !readerId)
      return res.status(400).json({ error: "internshipId and readerId are required." });

    // If reader is an admin, they are reading the primary admin inbox messages
    const isAdminReader = await Admin.exists({ _id: readerId });
    const targetReceiverId = isAdminReader ? await getAdminId() : readerId;

    const result = await Chat.updateMany(
      {
        internship: internshipId,
        receiver: targetReceiverId,
        readAt: null,
        isDeleted: { $ne: true },
      },
      { $set: { readAt: new Date() } }
    );

    const receiverRoom = isAdminReader
      ? "admin_notifications"
      : `partner_${readerId}`;
    await emitUnreadSummary(targetReceiverId, receiverRoom);

    return res.status(200).json({
      success: true,
      modifiedCount: result.modifiedCount || result.nModified || 0,
    });
  } catch (err) {
    console.error("markConversationRead:", err);
    return res.status(500).json({ error: "Failed to mark messages read.", details: err.message });
  }
};

module.exports = {
  getChatMessages,
  getMessages,
  sendMessage,
  uploadChatFile,
  chatUploadMiddleware,
  deleteMessage,
  getAdminUnreadMessages,
  getPartnerUnreadMessages,
  markConversationRead,
};
