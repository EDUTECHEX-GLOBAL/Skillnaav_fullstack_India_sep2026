/**
 * backend/controllers/aiController.js
 *
 * Path from here to aiService:  ../services/aiService
 *   controllers/ → backend/ → services/aiService  ✅
 */

const aiService = require('../services/AiServices');

// Sanity check on load — helps catch missing exports immediately
const required = [
  'getPersonalizedRecommendations','shortlistCandidates','getShortlisted',
  'getShortlistedByAdmin','analyzeSkills','extractResume','generateCV','assignInstructors'
];
required.forEach(fn => {
  if (typeof aiService[fn] !== 'function') {
    throw new Error(`[aiController] aiService.${fn} is not a function — check aiService.js exports`);
  }
});

// ── 1. Recommendations ───────────────────────────────────────────────────────
const getRecommendationsForStudent = async (req, res) => {
  try {
    const studentId = req.query.studentId || req.user._id;
    const limit = Number(req.query.limit) || 10;
    const recs = await aiService.getPersonalizedRecommendations(studentId, limit);
    res.status(200).json({ success: true, recommendations: recs });
  } catch (e) {
    console.error('[aiController] getRecommendationsForStudent:', e);
    res.status(500).json({ success: false, message: 'Failed to fetch recommendations' });
  }
};

// ── 2. Shortlisting ───────────────────────────────────────────────────────────
const shortlistCandidates = async (req, res) => {
  try {
    const { internship_id, job_description, job_skills } = req.body;

    // multer puts repeated fields as an array, single fields as a string
    const rawResumes = req.body.resumes;
    const resumeUrls = Array.isArray(rawResumes)
      ? rawResumes
      : rawResumes ? [rawResumes] : [];

    const parsedSkills = typeof job_skills === 'string'
      ? JSON.parse(job_skills)
      : (job_skills || []);

    // FIX: read ats_threshold from the form and pass it through to Python.
    // Previously this field was destructured but never forwarded, so Python
    // always fell back to its hardcoded 30% default regardless of what the
    // partner set in the UI.
    const atsThreshold = Number(req.body.ats_threshold ?? 30);

    console.log('[aiController] shortlistCandidates → internship_id:', internship_id,
      '| resumes:', resumeUrls.length, '| skills:', parsedSkills.length,
      '| ats_threshold:', atsThreshold + '%');

    const candidates = await aiService.shortlistCandidates(
      internship_id, job_description, parsedSkills, resumeUrls, atsThreshold
    );
    res.status(200).json({ success: true, shortlisted_candidates: candidates });
  } catch (e) {
    console.error('[aiController] shortlistCandidates:', e);
    res.status(500).json({ success: false, message: 'Shortlisting failed' });
  }
};

const getShortlistedByAdmin = async (req, res) => {
  try {
    const { internship_id, school_admin_id } = req.query;
    const candidates = await aiService.getShortlistedByAdmin(internship_id, school_admin_id);
    res.status(200).json({ success: true, shortlisted_candidates: candidates });
  } catch (e) {
    console.error('[aiController] getShortlistedByAdmin:', e);
    res.status(500).json({ success: false, message: 'Failed to fetch shortlisted candidates' });
  }
};

const getShortlisted = async (req, res) => {
  try {
    const { internshipId } = req.params;
    const candidates = await aiService.getShortlisted(internshipId);
    res.status(200).json({ success: true, shortlisted_candidates: candidates });
  } catch (e) {
    console.error('[aiController] getShortlisted:', e);
    res.status(500).json({ success: false, message: 'Failed to fetch shortlisted candidates' });
  }
};

// ── 3. Skill Analysis (Bedrock) ───────────────────────────────────────────────
const analyzeSkills = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Resume file is required' });
    }
    const result = await aiService.analyzeSkills(
      req.file.buffer, req.file.originalname, req.file.mimetype,
      req.body.job_description, req.body.required_skills
    );
    res.status(200).json({ success: true, ...result });
  } catch (e) {
    console.error('[aiController] analyzeSkills:', e);
    res.status(500).json({ success: false, message: 'Skill analysis failed' });
  }
};

// ── 4. Resume + CV ────────────────────────────────────────────────────────────
const extractResume = async (req, res) => {
  try {
    const result = await aiService.extractResume(req.body.resume_url);
    res.status(200).json({ success: true, ...result });
  } catch (e) {
    console.error('[aiController] extractResume:', e);
    res.status(500).json({ success: false, message: 'Resume extraction failed' });
  }
};

const generateCV = async (req, res) => {
  try {
    const { buffer, filename } = await aiService.generateCV(req.body);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (e) {
    console.error('[aiController] generateCV:', e);
    res.status(500).json({ success: false, message: 'CV generation failed' });
  }
};

// ── 5. Instructor Assignment ──────────────────────────────────────────────────
const assignInstructors = async (req, res) => {
  try {
    const result = await aiService.assignInstructors(req.body?.partnerId || null);
    res.status(200).json({ success: true, ...result });
  } catch (e) {
    console.error('[aiController] assignInstructors:', e);
    res.status(500).json({ success: false, message: 'Instructor assignment failed' });
  }
};

module.exports = {
  getRecommendationsForStudent,
  shortlistCandidates,
  getShortlistedByAdmin,
  getShortlisted,
  analyzeSkills,
  extractResume,
  generateCV,
  assignInstructors,
};