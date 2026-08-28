/**
 * services/aiService.js
 *
 * All calls to the internal Python AI service live here.
 * Follows the exact same pattern as your existing getPersonalizedRecommendations().
 *
 * Add to your server .env:
 *   PYTHON_AI_URL=http://localhost:8000
 */

const axios = require('axios');
const FormData = require('form-data');

const PYTHON_AI_URL = process.env.PYTHON_AI_URL || 'http://localhost:8000';

// ── 1. Recommendations (recommendation.py) ── already working, kept for consistency
async function getPersonalizedRecommendations(studentId, limit = 6) {
  try {
    const res = await axios.get(`${PYTHON_AI_URL}/recommendations/${studentId}?limit=${limit}`);
    return res.data.recommendations;
  } catch (err) {
    console.error('[aiService] getPersonalizedRecommendations:', err.message);
    return [];
  }
}

// ── 2. Shortlisting (partner.py) ─────────────────────────────────────────────
// FIX: added atsThreshold parameter (0–100, matches what the partner sets in the UI).
// Previously the function signature had no threshold argument, so the value the
// partner chose was silently dropped here and Python always used its 30% default.
async function shortlistCandidates(internshipId, jobDescription, jobSkills, resumeUrls, atsThreshold = 30) {
  try {
    const form = new FormData();
    form.append('internship_id', internshipId);
    form.append('job_description', jobDescription || '');
    form.append('job_skills', JSON.stringify(jobSkills || []));
    resumeUrls.forEach(url => form.append('resumes', url));
    form.append('ats_threshold', String(atsThreshold));  // ← FIX: forward to Python

    const res = await axios.post(`${PYTHON_AI_URL}/partner/shortlist`, form, {
      headers: form.getHeaders(),
    });
    return res.data.shortlisted_candidates || [];
  } catch (err) {
    console.error('[aiService] shortlistCandidates:', err.message);
    return [];
  }
}

async function getShortlisted(internshipId) {
  try {
    const res = await axios.get(`${PYTHON_AI_URL}/partner/shortlisted/${internshipId}`);
    return res.data.shortlisted_candidates || [];
  } catch (err) {
    console.error('[aiService] getShortlisted:', err.message);
    return [];
  }
}

async function getShortlistedByAdmin(internshipId, schoolAdminId) {
  try {
    const res = await axios.get(`${PYTHON_AI_URL}/partner/shortlisted/by-admin`, {
      params: { internship_id: internshipId, school_admin_id: schoolAdminId },
    });
    return res.data.shortlisted_candidates || [];
  } catch (err) {
    console.error('[aiService] getShortlistedByAdmin:', err.message);
    return [];
  }
}

// ── 3. Skill Analysis (main.py) — Bedrock, costs money per call ──────────────
async function analyzeSkills(fileBuffer, originalName, mimeType, jobDescription, requiredSkills) {
  try {
    const form = new FormData();
    form.append('file', fileBuffer, { filename: originalName, contentType: mimeType });
    form.append('job_description', jobDescription);
    form.append('required_skills', requiredSkills);

    const res = await axios.post(`${PYTHON_AI_URL}/analyze-skills/`, form, {
      headers: form.getHeaders(),
    });
    return res.data;
  } catch (err) {
    console.error('[aiService] analyzeSkills:', err.message);
    throw err; // re-throw so controller can return error to client
  }
}

// ── 4. Resume + CV (partner.py) ───────────────────────────────────────────────
async function extractResume(resumeUrl) {
  try {
    const res = await axios.post(`${PYTHON_AI_URL}/extract-resume`, { resume_url: resumeUrl });
    return res.data;
  } catch (err) {
    console.error('[aiService] extractResume:', err.message);
    throw err;
  }
}

async function generateCV(profileData) {
  try {
    const res = await axios.post(`${PYTHON_AI_URL}/cv/generate`, profileData, {
      responseType: 'arraybuffer',
    });
    return {
      buffer: Buffer.from(res.data),
      filename: `Skillnaav_CV_${(profileData.name || 'Resume').replace(/\s+/g, '_')}.pdf`,
    };
  } catch (err) {
    console.error('[aiService] generateCV:', err.message);
    throw err;
  }
}

// ── 5. Instructor Assignment (Instructor.py) ──────────────────────────────────
async function assignInstructors(partnerId = null) {
  try {
    const res = await axios.post(`${PYTHON_AI_URL}/assign-instructors`, { partnerId });
    return res.data;
  } catch (err) {
    console.error('[aiService] assignInstructors:', err.message);
    throw err;
  }
}

module.exports = {
  getPersonalizedRecommendations,
  shortlistCandidates,
  getShortlisted,
  getShortlistedByAdmin,
  analyzeSkills,
  extractResume,
  generateCV,
  assignInstructors,
};