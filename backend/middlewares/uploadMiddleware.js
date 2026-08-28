/**
 * backend/middleware/uploadMiddleware.js
 *
 * memoryStorage only — files NEVER touch disk.
 * Buffers land in req.files[i].buffer and are saved
 * straight into MongoDB by adminSupportController.js
 */

const multer = require("multer");
const path   = require("path");

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "video/mp4",
  "video/webm",
  "video/quicktime",
]);

const ALLOWED_EXTENSIONS = new Set([
  ".pdf", ".doc", ".docx", ".txt",
  ".png", ".jpg", ".jpeg", ".gif", ".webp",
  ".mp4", ".webm", ".mov",
]);

const fileFilter = (_req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ALLOWED_MIME_TYPES.has(file.mimetype) && ALLOWED_EXTENSIONS.has(ext)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        `File type not allowed: "${file.originalname}". ` +
        `Accepted: PDF, Word (.doc/.docx), TXT, PNG, JPG, GIF, WEBP, MP4, WEBM, MOV`
      ),
      false
    );
  }
};

const upload = multer({
  storage:    multer.memoryStorage(),  // files go to RAM, not disk
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024,        // 10 MB per file
                            
  },
});

module.exports = { upload };
