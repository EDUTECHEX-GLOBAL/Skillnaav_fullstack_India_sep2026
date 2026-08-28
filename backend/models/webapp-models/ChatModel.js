// ─── ChatModel.js ─────────────────────────────────────────────────────────────
const mongoose = require("mongoose");

const ChatSchema = new mongoose.Schema(
  {
    sender:     { type: mongoose.Schema.Types.ObjectId, ref: "User",       required: true },
    receiver:   { type: mongoose.Schema.Types.ObjectId, ref: "User",       required: true },
    internship: { type: mongoose.Schema.Types.ObjectId, ref: "Internship", required: true },

    // ── Text content ─────────────────────────────────────────────────────────
    message: { type: String, default: "", trim: true },

    // ── File attachment (optional) ────────────────────────────────────────────
    fileUrl:   { type: String,  default: null },   // S3 / Cloudinary / your CDN URL
    fileName:  { type: String,  default: null },   // original file name
    fileType:  { type: String,  default: null },   // MIME type e.g. "application/pdf"
    fileSize:  { type: String,  default: null },   // human-readable e.g. "1.2 MB"

    // ── Soft delete ───────────────────────────────────────────────────────────
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date,    default: null  },

    // Unread tracking. A message is unread only for its receiver until readAt is set.
    readAt: { type: Date, default: null },

    // ── Original timestamp kept for legacy compatibility ──────────────────────
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: true }   // adds createdAt + updatedAt
);

// ── Indexes ────────────────────────────────────────────────────────────────────
// Fast thread fetch: all messages for an internship ordered by time
ChatSchema.index({ internship: 1, createdAt: 1 });

// Fast thread fetch with soft-delete filter (most common query)
ChatSchema.index({ internship: 1, isDeleted: 1, createdAt: 1 });

// Fast lookup for a specific sender's messages in a thread
ChatSchema.index({ sender: 1, receiver: 1, internship: 1 });

// Fast unread notification summaries and mark-as-read updates
ChatSchema.index({ receiver: 1, readAt: 1, isDeleted: 1, createdAt: -1 });
ChatSchema.index({ receiver: 1, internship: 1, readAt: 1, isDeleted: 1 });

// ── Encryption / Decryption Logic ──────────────────────────────────────────────
const crypto = require("crypto");
const ENCRYPTION_KEY = process.env.CHAT_ENCRYPTION_KEY || "my_secret_key_for_chat_encry_123"; // Must be 32 bytes
const IV_LENGTH = 16;

function encrypt(text) {
  if (!text) return text;
  // Basic check to avoid double encryption
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
    console.error("Chat encryption error:", err);
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
    console.error("Chat decryption error:", err);
    return text; // Return original if decryption fails
  }
}

// Hooks for automatic encryption and decryption
ChatSchema.pre("save", function (next) {
  if (this.isModified("message") && this.message) {
    this.message = encrypt(this.message);
  }
  next();
});

ChatSchema.post("save", function (doc, next) {
  if (doc && doc.message) {
    doc.message = decrypt(doc.message);
  }
  next();
});

ChatSchema.post("find", function (docs) {
  if (Array.isArray(docs)) {
    for (const doc of docs) {
      if (doc && doc.message) {
        doc.message = decrypt(doc.message);
      }
    }
  }
});

ChatSchema.post("findOne", function (doc) {
  if (doc && doc.message) {
    doc.message = decrypt(doc.message);
  }
});

module.exports = mongoose.model("Chat", ChatSchema);
