const axios = require("axios");

const BASE_URL = "https://universities.hipolabs.com/search";
const cache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

const FALLBACK_UNIVERSITIES = {
  "India": [
    { name: "Indian Institute of Technology Bombay", state: "Maharashtra", website: "https://www.iitb.ac.in" },
    { name: "Indian Institute of Technology Delhi", state: "Delhi", website: "https://home.iitd.ac.in" },
    { name: "Indian Institute of Technology Madras", state: "Tamil Nadu", website: "https://www.iitm.ac.in" },
    { name: "Indian Institute of Science", state: "Karnataka", website: "https://iisc.ac.in" },
    { name: "Indian Institute of Technology Kanpur", state: "Uttar Pradesh", website: "https://www.iitk.ac.in" },
    { name: "Indian Institute of Technology Kharagpur", state: "West Bengal", website: "https://www.iitkgp.ac.in" },
    { name: "Indian Institute of Technology Roorkee", state: "Uttarakhand", website: "https://www.iitr.ac.in" },
    { name: "University of Delhi", state: "Delhi", website: "http://www.du.ac.in" },
    { name: "Jawaharlal Nehru University", state: "Delhi", website: "https://www.jnu.ac.in" },
    { name: "Anna University", state: "Tamil Nadu", website: "https://www.annauniv.edu" },
  ]
};

const getCached = (key) => {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data;
};

const setCache = (key, data) => {
  if (cache.size > 200) {
    const firstKey = cache.keys().next().value;
    cache.delete(firstKey);
  }
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
};

const normalizeState = (raw) => (raw && raw.trim() ? raw.trim() : "");

const fallbackUniversitySearch = ({ country, query }) => {
  const source = FALLBACK_UNIVERSITIES[country] || [];
  const q = (query || "").trim().toLowerCase();
  if (!q) return [];

  return source
    .filter((u) => u.name.toLowerCase().includes(q))
    .slice(0, 10)
    .map((u) => ({
      ...u,
      country,
    }));
};

exports.searchUniversities = async ({ country, query }) => {
  const cacheKey = `${country}::${query.toLowerCase()}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  let lastError;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await axios.get(BASE_URL, {
        params: { country, name: query },
        timeout: 3000,
      });

      const results = res.data
        .filter((u) => u.name)
        .map((u) => ({
          name: u.name,
          country: u.country,
          state: normalizeState(u["state-province"]),
          website: u.web_pages?.[0] ?? "",
        }));

      setCache(cacheKey, results);
      return results;
    } catch (err) {
      lastError = err;
      if (attempt === 1) {
        await new Promise((r) => setTimeout(r, 300));
      }
    }
  }

  const fallback = fallbackUniversitySearch({ country, query });
  if (fallback.length > 0) {
    setCache(cacheKey, fallback);
    return fallback;
  }

  throw lastError;
};
