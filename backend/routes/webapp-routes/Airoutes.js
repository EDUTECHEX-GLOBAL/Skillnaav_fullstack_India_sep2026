/**
 * backend/routes/webapp-routes/Airoutes.js
 */

const express = require('express');
const multer  = require('multer');
const router  = express.Router();

// authenticate  → Student or Partner  (authMiddleware.js)
// protectSchool → SchoolAdmin only    (protectSchool.js — already used by schoolAdminRoutes.js)
const { authenticate }   = require('../../middlewares/authMiddleware');
const { protectSchool }  = require('../../middlewares/protectSchool');
const { requirePlatformFeature } = require('../../middlewares/platformSettingsMiddleware');
const {
  shortlistCandidates,
  getShortlistedByAdmin,
  getShortlisted,
  analyzeSkills,
  extractResume,
  generateCV,
  assignInstructors,
} = require('../../controllers/Aicontroller');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB limit
  fileFilter: (req, file, cb) => {
    const name = (file.originalname || '').toLowerCase();
    const mime = (file.mimetype || '').toLowerCase();

    const isPdf = name.endsWith('.pdf') || mime.includes('pdf');
    const isDocx = name.endsWith('.docx') || name.endsWith('.doc') ||
                   mime.includes('word') || mime.includes('officedocument') ||
                   mime === 'application/octet-stream';

    if (isPdf || isDocx) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and DOCX files are allowed'));
    }
  },
});

// Middleware wrapper for handling multer errors gracefully
const handleUpload = (field) => (req, res, next) => {
  upload.single(field)(req, res, (err) => {
    if (err) {
      return res.status(400).json({ success: false, message: err.message || 'File upload error' });
    }
    next();
  });
};

// ── Shortlisting ──────────────────────────────────────────────────────────────
// Called by Partner dashboard → Partner token → authenticate ✅
router.post('/partner/shortlist', requirePlatformFeature('aiShortlisting', 'AI candidate shortlisting'), authenticate, upload.none(), shortlistCandidates);

// Called by School Admin dashboard → schoolAdminToken → protectSchool ✅
// FIXED: was 'authenticate' (Student/Partner only) → 401 NOT_FOUND for SchoolAdmin
router.get('/partner/shortlisted/by-admin',      protectSchool, getShortlistedByAdmin);

// Called by Partner → authenticate ✅
router.get('/partner/shortlisted/:internshipId', authenticate,  getShortlisted);

// ── Skill Analysis ────────────────────────────────────────────────────────────
router.post('/analyze-skills', authenticate, handleUpload('file'), analyzeSkills);

// ── Resume + CV ───────────────────────────────────────────────────────────────
router.post('/extract-resume', authenticate, extractResume);
router.post('/cv/generate',    authenticate, generateCV);

// ── Instructor Assignment ─────────────────────────────────────────────────────
router.post('/assign-instructors', authenticate, assignInstructors);

module.exports = router;
