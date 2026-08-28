const axios = require("axios");

const BASE_URL = "https://universities.hipolabs.com/search";
const cache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

const FALLBACK_UNIVERSITIES = {
  "United States": [
    { name: "Harvard University", state: "Massachusetts", website: "https://www.harvard.edu" },
    { name: "Stanford University", state: "California", website: "https://www.stanford.edu" },
    { name: "Massachusetts Institute of Technology", state: "Massachusetts", website: "https://www.mit.edu" },
    { name: "University of California, Berkeley", state: "California", website: "https://www.berkeley.edu" },
    { name: "University of California, Los Angeles", state: "California", website: "https://www.ucla.edu" },
    { name: "Yale University", state: "Connecticut", website: "https://www.yale.edu" },
    { name: "Princeton University", state: "New Jersey", website: "https://www.princeton.edu" },
    { name: "Columbia University", state: "New York", website: "https://www.columbia.edu" },
    { name: "Cornell University", state: "New York", website: "https://www.cornell.edu" },
    { name: "University of Michigan", state: "Michigan", website: "https://umich.edu" },
    { name: "Carnegie Mellon University", state: "Pennsylvania", website: "https://www.cmu.edu" },
    { name: "University of Washington", state: "Washington", website: "https://www.washington.edu" },
    { name: "University of Texas at Austin", state: "Texas", website: "https://www.utexas.edu" },
    { name: "New York University", state: "New York", website: "https://www.nyu.edu" },
    { name: "University of Chicago", state: "Illinois", website: "https://www.uchicago.edu" },
  ],
  Canada: [
    { name: "University of Toronto", state: "Ontario", website: "https://www.utoronto.ca" },
    { name: "University of British Columbia", state: "British Columbia", website: "https://www.ubc.ca" },
    { name: "McGill University", state: "Quebec", website: "https://www.mcgill.ca" },
    { name: "University of Alberta", state: "Alberta", website: "https://www.ualberta.ca" },
    { name: "University of Waterloo", state: "Ontario", website: "https://uwaterloo.ca" },
    { name: "Western University", state: "Ontario", website: "https://www.uwo.ca" },
    { name: "McMaster University", state: "Ontario", website: "https://www.mcmaster.ca" },
    { name: "Universite de Montreal", state: "Quebec", website: "https://www.umontreal.ca" },
    { name: "University of Calgary", state: "Alberta", website: "https://www.ucalgary.ca" },
    { name: "Queen's University", state: "Ontario", website: "https://www.queensu.ca" },
    { name: "University of Ottawa", state: "Ontario", website: "https://www.uottawa.ca" },
    { name: "Simon Fraser University", state: "British Columbia", website: "https://www.sfu.ca" },
    { name: "Dalhousie University", state: "Nova Scotia", website: "https://www.dal.ca" },
    { name: "University of Manitoba", state: "Manitoba", website: "https://umanitoba.ca" },
    { name: "York University", state: "Ontario", website: "https://www.yorku.ca" },
  ],
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
