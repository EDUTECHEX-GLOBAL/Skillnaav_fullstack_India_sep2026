/**
 * services/aiService.js
 *
 * All calls to AI services live here.
 * Includes native fallback engines so features work seamlessly even when
 * internal Python microservices are offline.
 */

const axios = require('axios');
const FormData = require('form-data');
const zlib = require('zlib');
const pdfParse = require('pdf-parse');

const PYTHON_AI_URL = process.env.PYTHON_AI_URL || 'http://localhost:8000';

// ── 1. Recommendations (recommendation.py) ───────────────────────────────────
async function getPersonalizedRecommendations(studentId, limit = 6) {
  try {
    const res = await axios.get(`${PYTHON_AI_URL}/recommendations/${studentId}?limit=${limit}`, { timeout: 4000 });
    return res.data.recommendations || [];
  } catch (err) {
    console.warn('[aiService] getPersonalizedRecommendations failed:', err.message);
    return [];
  }
}

// ── 2. Shortlisting (partner.py) ─────────────────────────────────────────────
async function shortlistCandidates(internshipId, jobDescription, jobSkills, resumeUrls, atsThreshold = 30) {
  try {
    const form = new FormData();
    form.append('internship_id', internshipId);
    form.append('job_description', jobDescription || '');
    form.append('job_skills', JSON.stringify(jobSkills || []));
    resumeUrls.forEach(url => form.append('resumes', url));
    form.append('ats_threshold', String(atsThreshold));

    const res = await axios.post(`${PYTHON_AI_URL}/partner/shortlist`, form, {
      headers: form.getHeaders(),
      timeout: 10000,
    });
    return res.data.shortlisted_candidates || [];
  } catch (err) {
    console.error('[aiService] shortlistCandidates:', err.message);
    return [];
  }
}

async function getShortlisted(internshipId) {
  try {
    const res = await axios.get(`${PYTHON_AI_URL}/partner/shortlisted/${internshipId}`, { timeout: 4000 });
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
      timeout: 4000,
    });
    return res.data.shortlisted_candidates || [];
  } catch (err) {
    console.error('[aiService] getShortlistedByAdmin:', err.message);
    return [];
  }
}

// ── 3. Helper: Extract text from DOCX (pure Node using built-in zlib) ──────────
function extractTextFromDocx(buffer) {
  try {
    let offset = 0;
    let text = '';

    while (offset < buffer.length - 30) {
      // Check for PK\x03\x04
      if (buffer.readUInt32LE(offset) !== 0x04034b50) break;

      const compressionMethod = buffer.readUInt16LE(offset + 8);
      const compressedSize = buffer.readUInt32LE(offset + 18);
      const fileNameLength = buffer.readUInt16LE(offset + 26);
      const extraFieldLength = buffer.readUInt16LE(offset + 28);

      const fileName = buffer.toString('utf8', offset + 30, offset + 30 + fileNameLength);
      const dataOffset = offset + 30 + fileNameLength + extraFieldLength;

      if (fileName === 'word/document.xml') {
        const compressedData = buffer.slice(dataOffset, dataOffset + compressedSize);
        let xml = '';
        if (compressionMethod === 8) {
          xml = zlib.inflateRawSync(compressedData).toString('utf8');
        } else if (compressionMethod === 0) {
          xml = compressedData.toString('utf8');
        }
        const matches = xml.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g) || [];
        text = matches.map(m => m.replace(/<w:t[^>]*>/, '').replace(/<\/w:t>/, '')).join(' ');
        break;
      }

      offset = dataOffset + compressedSize;
    }

    return text.trim();
  } catch (err) {
    console.warn('Docx parse error, fallback to raw string:', err.message);
    return '';
  }
}

async function extractResumeText(fileBuffer, originalName = '', mimeType = '') {
  const isDocx = (originalName && originalName.toLowerCase().endsWith('.docx')) ||
                 (originalName && originalName.toLowerCase().endsWith('.doc')) ||
                 (mimeType && (mimeType.includes('wordprocessingml') || mimeType.includes('msword')));
  const isPdf = (originalName && originalName.toLowerCase().endsWith('.pdf')) ||
                (mimeType && mimeType.includes('pdf'));

  if (isDocx) {
    const text = extractTextFromDocx(fileBuffer);
    if (text && text.length > 20) return text;
  }

  if (isPdf) {
    try {
      const data = await pdfParse(fileBuffer);
      if (data && data.text && data.text.length > 20) return data.text;
    } catch (e) {
      console.warn('PDF parse failed:', e.message);
    }
  }

  // Fallback to sanitised UTF-8 text
  return fileBuffer.toString('utf8').replace(/[^\x20-\x7E\n\r\t]/g, ' ').trim();
}

// Technical skills reference list
const TECH_SKILLS = [
  "python", "java", "javascript", "c++", "c#", "go", "rust", "swift", "kotlin", "scala",
  "ruby", "php", "typescript", "r", "matlab", "shell", "bash", "html", "css", "react",
  "angular", "vue", "svelte", "node.js", "nodejs", "express", "django", "flask", "spring",
  "bootstrap", "tailwind", "sass", "sql", "mysql", "postgresql", "mongodb", "redis",
  "elasticsearch", "oracle", "sqlite", "aws", "azure", "gcp", "docker", "kubernetes",
  "terraform", "git", "github", "gitlab", "ci/cd", "microservices", "machine learning",
  "deep learning", "tensorflow", "pytorch", "pandas", "numpy", "scikit-learn", "nlp",
  "computer vision", "rest api", "graphql", "agile", "scrum", "devops", "linux", "solidity"
];

function analyzeSkillsLocally(resumeText, jobDescription, requiredSkillsStr) {
  const lowerText = (resumeText || '').toLowerCase();

  const userSkills = TECH_SKILLS.filter(skill => {
    const regex = new RegExp(`\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    return regex.test(lowerText);
  });

  const jobSkills = (requiredSkillsStr || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  const normalizedUserSkills = new Set(userSkills.map(s => s.toLowerCase().replace(/[^a-z0-9]/g, '')));

  const matchingSkills = [];
  const skillGaps = [];

  jobSkills.forEach(js => {
    const norm = js.toLowerCase().replace(/[^a-z0-9]/g, '');
    let matched = false;
    for (const us of normalizedUserSkills) {
      if (us.includes(norm) || norm.includes(us)) {
        matched = true;
        break;
      }
    }
    if (matched) {
      matchingSkills.push(js);
    } else {
      skillGaps.push(js);
    }
  });

  const readinessScore = jobSkills.length > 0
    ? Math.round((matchingSkills.length / jobSkills.length) * 100)
    : 100;

  const courses = (skillGaps.length > 0 ? skillGaps.slice(0, 3) : ["Advanced Web Engineering"]).map((gap) => ({
    title: `Mastering ${gap} for Industry`,
    platform: "Coursera / Edutechex",
    description: `Targeted project-based course covering fundamental concepts, architecture patterns, and production deployment of ${gap}.`,
    duration: "4 weeks (approx. 20 hours)"
  }));

  const quizzes = (skillGaps.length > 0 ? skillGaps.slice(0, 3) : ["React"]).map((gap) => ({
    question: `What is a fundamental best practice when implementing ${gap} in production?`,
    options: [
      `A) Structured modular architecture and continuous automated testing`,
      `B) Disabling runtime error logs to improve response speeds`,
      `C) Hardcoding external database credentials directly in client files`,
      `D) Storing environment configuration keys in public version control`
    ],
    answer: `A) Structured modular architecture and continuous automated testing`
  }));

  return {
    readiness_score: readinessScore,
    user_skills: userSkills.map(s => s.charAt(0).toUpperCase() + s.slice(1)),
    job_skills: jobSkills,
    skill_gaps: skillGaps,
    recommendations: { courses },
    quizzes: quizzes,
    analysis_timestamp: new Date().toISOString()
  };
}

// ── 3. Skill Analysis ────────────────────────────────────────────────────────
async function analyzeSkills(fileBuffer, originalName, mimeType, jobDescription, requiredSkills) {
  // If external Python AI service is explicitly configured and not localhost, attempt it
  const isExternalPython = PYTHON_AI_URL && !PYTHON_AI_URL.includes('localhost') && !PYTHON_AI_URL.includes('127.0.0.1');

  if (isExternalPython) {
    try {
      const form = new FormData();
      form.append('file', fileBuffer, { filename: originalName, contentType: mimeType });
      form.append('job_description', jobDescription || '');
      form.append('required_skills', requiredSkills || '');

      const res = await axios.post(`${PYTHON_AI_URL}/analyze-skills/`, form, {
        headers: form.getHeaders(),
        timeout: 5000,
      });
      return res.data;
    } catch (err) {
      console.warn('[aiService] Python analyze-skills request failed, falling back to built-in engine:', err.message);
    }
  }

  // Built-in Native Skill Analysis Engine (zero external dependency, instant, ultra-reliable)
  const resumeText = await extractResumeText(fileBuffer, originalName, mimeType);
  return analyzeSkillsLocally(resumeText, jobDescription, requiredSkills);
}

// ── 4. Resume + CV ───────────────────────────────────────────────────────────
async function extractResume(resumeUrl) {
  try {
    const res = await axios.post(`${PYTHON_AI_URL}/extract-resume`, { resume_url: resumeUrl }, { timeout: 5000 });
    return res.data;
  } catch (err) {
    console.warn('[aiService] extractResume fallback:', err.message);
    return { name: '', skills: [], experience: [] };
  }
}

async function generateCV(profileData) {
  try {
    const res = await axios.post(`${PYTHON_AI_URL}/cv/generate`, profileData, {
      responseType: 'arraybuffer',
      timeout: 5000,
    });
    return {
      buffer: Buffer.from(res.data),
      filename: `Edutechex_CV_${(profileData.name || 'Resume').replace(/\s+/g, '_')}.pdf`,
    };
  } catch (err) {
    console.error('[aiService] generateCV:', err.message);
    throw err;
  }
}

// ── 5. Instructor Assignment (Instructor.py) ──────────────────────────────────
async function assignInstructors(partnerId = null) {
  try {
    const res = await axios.post(`${PYTHON_AI_URL}/assign-instructors`, { partnerId }, { timeout: 5000 });
    return res.data;
  } catch (err) {
    console.error('[aiService] assignInstructors:', err.message);
    return { success: false, message: 'Assignment engine unavailable' };
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
