/*  backend/services/ragHelpers.js
 *  --------------------------------------------------------------
 *  Light-weight “Retrieve” helpers for our RAG pipeline.
 *  Pulls distinct company names, internship types, and modes
 *  from the InternshipPosting collection (MongoDB).
 */

const Internship = require("../models/webapp-models/internshipPostModel");

/* --- distinct companies, newest first -------------------------------- */
async function listCompanies(limit = 40) {
  const rows = await Internship.aggregate([
    { $match: { adminApproved: true, deleted: false } },
    { $sort:  { createdAt: -1 } },       // needs timestamps:true (see Note 4)
    { $group: { _id: "$companyName" } },
    { $limit: limit },
  ]);
  return rows.map((r) => r._id.trim()).filter(Boolean);
}

/* --- internship types (FREE | STIPEND | PAID) ------------------------- */
async function listTypes() {
  return await Internship.distinct("internshipType", {
    adminApproved: true,
    deleted: false,
  });
}

/* --- internship modes (ONLINE | OFFLINE | HYBRID) --------------------- */
async function listModes() {
  return await Internship.distinct("internshipMode", {
    adminApproved: true,
    deleted: false,
  });
}

/* --- Search Internships by keyword ------------------------------------ */
async function searchInternships(query, limit = 3) {
  // Extract potential keywords from the query (ignore common words)
  const words = query.split(/\s+/).filter(w => w.length > 2 && !/^(what|which|tell|about|like|can|you|the|for|and|with)$/i.test(w));
  
  if (words.length === 0) return [];

  // Escape special regex characters
  const escapeRegExp = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const safeWords = words.map(escapeRegExp);

  // Create a regex for any of the keywords
  const regex = new RegExp(safeWords.join("|"), "i");

  const rows = await Internship.find({
    adminApproved: true,
    deleted: false,
    $or: [
      { jobTitle: regex },
      { companyName: regex },
      { sector: regex },
      { jobDescription: regex }
    ]
  }).sort({ createdAt: -1 }).limit(limit);

  return rows;
}

module.exports = { listCompanies, listTypes, listModes, searchInternships };
