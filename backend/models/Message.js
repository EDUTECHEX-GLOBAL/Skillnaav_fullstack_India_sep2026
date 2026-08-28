// models/Message.js
// Unified Message model.
//
// Attachment storage strategy:
//   NEW (admin messages): buffer stored in `data` field — no disk, no GridFS.
//   OLD (student messages via studentSupportController): disk-based with `fileId`.
//
// Both schemas live together in one `attachments` array.
// `stripBinary()` removes the buffer before sending over REST / Socket.io.

const mongoose = require("mongoose");

const attachmentSchema = new mongoose.Schema(
  {
    // ── Shared fields (both old and new) ──────────────────────────────────────
    filename: { type: String, default: "" },   // original filename shown to user

    // ── NEW: buffer-based (admin uploads via memoryStorage) ──────────────────
    mimetype: { type: String, default: "" },   // e.g. "image/png"
    size:     { type: Number, default: 0  },   // bytes
    data:     { type: Buffer, default: null },  // actual file binary (null for old disk files)

    // ── OLD: disk-based (student uploads via studentSupportController) ────────
    fileId:   { type: String, default: "" },   // stored filename on disk / unique key
    type:     { type: String, default: "" },   // mimetype alias used by old code
  },
  { _id: true }  // each attachment gets its own _id — used as download key for new files
);

const messageSchema = new mongoose.Schema(
  {
    ticketId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "Ticket",
      required: true,
      index:    true,
    },
    senderId: {
      type:     mongoose.Schema.Types.ObjectId,
      required: true,
    },
    senderName: {
      type:     String,
      required: true,
    },
    senderRole: {
      type:     String,
      required: true,
      enum:     ["user", "admin", "school-admin", "partner", "system"],
    },
    text: {
      type:    String,
      default: "",
    },
    attachments: {
      type:    [attachmentSchema],
      default: [],
    },
    replyTo: {
      type:    mongoose.Schema.Types.ObjectId,
      ref:     "Message",
      default: null,
    },
    read: {
      type:    Boolean,
      default: false,
    },
    readAt: {
      type:    Date,
      default: null,
    },
  },
  { timestamps: true }
);

messageSchema.index({ ticketId: 1, createdAt: 1 });
messageSchema.index({ ticketId: 1, senderRole: 1, read: 1 });

// ─────────────────────────────────────────────────────────────────────────────
// stripBinary(msg)
//
// Removes the binary `data` buffer from every attachment before the message is
// sent over REST or Socket.io.  The frontend fetches files separately:
//   • New (buffer) files  → GET /api/support/admin/file/:attachmentId
//   • Old (disk) files    → GET /api/support/file/:fileId
// ─────────────────────────────────────────────────────────────────────────────
const stripBinary = (msg) => {
  if (!msg) return msg;
  return {
    ...msg,
    attachments: (msg.attachments || []).map((att) => {
      // eslint-disable-next-line no-unused-vars
      const { data: _omit, ...meta } = att;
      // Ensure _id is a plain string so frontend URL construction always works
      // (Mongoose toObject() can leave _id as an ObjectId instance)
      if (meta._id) meta._id = meta._id.toString();
      return meta;
    }),
  };
};

// ── Encryption / Decryption Logic ──────────────────────────────────────────────
const crypto = require("crypto");
const ENCRYPTION_KEY = process.env.CHAT_ENCRYPTION_KEY || "my_secret_key_for_chat_encry_123"; // Must be 32 bytes
const IV_LENGTH = 16;

function encrypt(text) {
  if (!text) return text;
  if (text.includes(':')) {
    const parts = text.split(':');
    if (parts.length === 2 && parts[0].length === 32) return text; 
  }
  
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv("aes-256-cbc", Buffer.from(ENCRYPTION_KEY), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString("hex") + ":" + encrypted.toString("hex");
  } catch (err) {
    console.error("Support Message encryption error:", err);
    return text;
  }
}

function decrypt(text) {
  if (!text) return text;
  if (!text.includes(':')) return text;
  
  const textParts = text.split(':');
  if (textParts.length !== 2 || textParts[0].length !== 32) return text;
  
  try {
    const iv = Buffer.from(textParts[0], "hex");
    const encryptedText = Buffer.from(textParts[1], "hex");
    const decipher = crypto.createDecipheriv("aes-256-cbc", Buffer.from(ENCRYPTION_KEY), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (err) {
    console.error("Support Message decryption error:", err);
    return text; 
  }
}

messageSchema.pre("save", function (next) {
  if (this.isModified("text") && this.text) {
    this.text = encrypt(this.text);
  }
  next();
});

messageSchema.post("save", function (doc, next) {
  if (doc && doc.text) {
    doc.text = decrypt(doc.text);
  }
  next();
});

messageSchema.post("find", function (docs) {
  if (Array.isArray(docs)) {
    for (const doc of docs) {
      if (doc && doc.text) {
        doc.text = decrypt(doc.text);
      }
    }
  }
});

messageSchema.post("findOne", function (doc) {
  if (doc && doc.text) {
    doc.text = decrypt(doc.text);
  }
});

const Message =
  mongoose.models.Message || mongoose.model("Message", messageSchema);

// ── Exported helpers for .lean() callers ────────────────────────────────────
// Mongoose post-find hooks are skipped when .lean() is used.
// Call decryptMessage(doc) or decryptMessages(docs) manually after any .lean() query.
const decryptMessage = (doc) => {
  if (!doc) return doc;
  if (doc.text) doc.text = decrypt(doc.text);
  return doc;
};

const decryptMessages = (docs) => {
  if (!Array.isArray(docs)) return docs;
  return docs.map(decryptMessage);
};

// Decrypt a raw text string — use this for aggregation results or any raw DB text
const decryptText = (text) => decrypt(text);

module.exports = { Message, stripBinary, decryptMessage, decryptMessages, decryptText };