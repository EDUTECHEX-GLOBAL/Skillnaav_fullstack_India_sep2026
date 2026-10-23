/**
 * Validation utilities
 */

/**
 * Validates a person's name.
 * Requires that the first character is an alphabetic letter.
 *
 * @param {string} name - The name to validate.
 * @returns {string} Error message string if invalid, or "" if valid.
 */
export const validateName = (name) => {
  if (!name || !name.trim()) {
    return "Please enter your name.";
  }

  const trimmed = name.trim();

  // First character must be an alphabetic letter
  if (!/^[A-Za-z]/.test(trimmed)) {
    return "Name must start with a letter.";
  }

  // Name cannot contain numbers
  if (/[0-9]/.test(trimmed)) {
    return "Name cannot contain numbers.";
  }

  // Name should only contain letters, spaces, hyphens, periods, and apostrophes
  if (!/^[A-Za-z][A-Za-z\s'.-]*$/.test(trimmed)) {
    return "Name can only contain letters, spaces, hyphens, or apostrophes.";
  }

  if (trimmed.length < 2) {
    return "Name must be at least 2 characters long.";
  }

  if (trimmed.length > 50) {
    return "Name cannot exceed 50 characters.";
  }

  return "";
};

/**
 * Validates a University or Company name.
 * - Must start with an alphabetic letter
 * - Length between 2 and 60 characters
 * - Only allowed characters: letters, numbers, spaces, and basic punctuation (&, ., ,, ', -, /, ())
 *
 * @param {string} name - The university/company name to validate.
 * @returns {string} Error message string if invalid, or "" if valid.
 */
export const validateUniversityOrCompanyName = (name) => {
  if (!name || !name.trim()) {
    return "University or Company name is required.";
  }

  const trimmed = name.trim();

  if (trimmed.length < 2) {
    return "University or Company name must be at least 2 characters.";
  }

  if (trimmed.length > 60) {
    return "University or Company name cannot exceed 60 characters.";
  }

  if (!/^[A-Za-z]/.test(trimmed)) {
    return "University or Company name must start with a letter.";
  }

  if (!/^[A-Za-z][A-Za-z0-9\s.,'&/()\-]*$/.test(trimmed)) {
    return "University or Company name can only contain letters, numbers, spaces, and basic punctuation (&, ., ,, ', -, /).";
  }

  return "";
};

/**
 * Validates a Job Title.
 * - Must start with an alphabetic letter (A-Z or a-z)
 * - Length between 3 and 100 characters
 * - Only letters, numbers, spaces, and standard punctuation (&, ., ,, ', -, /, +, ())
 * - Disallows special symbols like #, $, %, ^, *, @, !, ~, <, >, etc.
 *
 * @param {string} title - The job title to validate.
 * @returns {string} Error message string if invalid, or "" if valid.
 */
export const validateJobTitle = (title) => {
  if (!title || !title.trim()) {
    return "Job title is required.";
  }

  const trimmed = title.trim();

  if (trimmed.length < 3) {
    return "Job title must be at least 3 characters.";
  }

  if (trimmed.length > 100) {
    return "Job title cannot exceed 100 characters.";
  }

  if (!/^[A-Za-z]/.test(trimmed)) {
    return "Job title must start with a letter.";
  }

  if (!/^[A-Za-z][A-Za-z0-9\s.,'&/()\-+]*$/.test(trimmed)) {
    return "Job title can only contain letters, numbers, spaces, and basic punctuation (&, ., ,, ', -, /, +, ()).";
  }

  return "";
};

/**
 * Validates a Company Name.
 * - Must start with an alphabetic letter (A-Z or a-z)
 * - Length between 2 and 100 characters
 * - Only letters, numbers, spaces, and standard punctuation (&, ., ,, ', -, /, ())
 * - Disallows special symbols like #, $, %, ^, *, @, !, etc.
 *
 * @param {string} name - The company name to validate.
 * @returns {string} Error message string if invalid, or "" if valid.
 */
export const validateCompanyName = (name) => {
  if (!name || !name.trim()) {
    return "Company name is required.";
  }

  const trimmed = name.trim();

  if (trimmed.length < 2) {
    return "Company name must be at least 2 characters.";
  }

  if (trimmed.length > 100) {
    return "Company name cannot exceed 100 characters.";
  }

  if (!/^[A-Za-z]/.test(trimmed)) {
    return "Company name must start with a letter.";
  }

  if (!/^[A-Za-z][A-Za-z0-9\s.,'&/()\-]*$/.test(trimmed)) {
    return "Company name can only contain letters, numbers, spaces, and basic punctuation (&, ., ,, ', -, /).";
  }

  return "";
};

/**
 * Validates an Institutional ID.
 * - Alphanumeric with optional hyphens and underscores
 * - Length between 3 and 25 characters
 * - No special characters like #, $, %, ^, &, *, (, )
 *
 * @param {string} id - The institutional ID to validate.
 * @returns {string} Error message string if invalid, or "" if valid.
 */
export const validateInstitutionId = (id) => {
  if (!id || !id.trim()) {
    return "Institutional ID is required.";
  }

  const trimmed = id.trim();

  if (trimmed.length < 3) {
    return "Institutional ID must be at least 3 characters.";
  }

  if (trimmed.length > 25) {
    return "Institutional ID cannot exceed 25 characters.";
  }

  if (!/^[A-Za-z0-9\-_]+$/.test(trimmed)) {
    return "Institutional ID can only contain letters, numbers, hyphens, and underscores.";
  }

  return "";
};

// Stricter email regex requiring valid format
export const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[A-Za-z]{2,}$/;

// Common recognized gTLDs
const VALID_GTLDS = new Set([
  "com", "org", "net", "edu", "gov", "mil", "int", "info", "biz",
  "io", "co", "ai", "me", "app", "dev", "tech", "xyz", "site", "online",
  "store", "cloud", "digital", "link", "pro", "live", "space", "club",
  "global", "life", "world", "agency", "media", "solutions", "studio",
  "design", "academy", "center", "support", "zone", "team", "hub",
  "work", "works", "email", "group", "news", "today", "website", "press",
  "blog", "mobi", "asia", "jobs", "travel", "museum", "coop", "name",
  "expert", "guru", "care", "city", "services", "community", "consulting",
  "software", "security", "capital", "partners", "ventures", "network",
  "vip", "direct", "top", "run", "shop", "market", "school", "university"
]);

// Valid 2-letter country code TLDs (ISO 3166-1 alpha-2)
const VALID_CCTLDS = new Set([
  "ac", "ad", "ae", "af", "ag", "ai", "al", "am", "ao", "aq", "ar", "as", "at", "au", "aw", "ax", "az",
  "ba", "bb", "bd", "be", "bf", "bg", "bh", "bi", "bj", "bm", "bn", "bo", "br", "bs", "bt", "bw", "by", "bz",
  "ca", "cc", "cd", "cf", "cg", "ch", "ci", "ck", "cl", "cm", "cn", "co", "cr", "cu", "cv", "cw", "cx", "cy", "cz",
  "de", "dj", "dk", "dm", "do", "dz", "ec", "ee", "eg", "er", "es", "et", "eu", "fi", "fj", "fk", "fm", "fo", "fr",
  "ga", "gb", "gd", "ge", "gf", "gg", "gh", "gi", "gl", "gm", "gn", "gp", "gq", "gr", "gs", "gt", "gu", "gw", "gy",
  "hk", "hm", "hn", "hr", "ht", "hu", "id", "ie", "il", "im", "in", "io", "iq", "ir", "is", "it",
  "je", "jm", "jo", "jp", "ke", "kg", "kh", "ki", "km", "kn", "kp", "kr", "kw", "ky", "kz",
  "la", "lb", "lc", "li", "lk", "lr", "ls", "lt", "lu", "lv", "ly", "ma", "mc", "md", "me", "mf", "mg", "mh", "mk",
  "ml", "mm", "mn", "mo", "mp", "mq", "mr", "ms", "mt", "mu", "mv", "mw", "mx", "my", "mz",
  "na", "nc", "ne", "nf", "ng", "ni", "nl", "no", "np", "nr", "nu", "nz", "om",
  "pa", "pe", "pf", "pg", "ph", "pk", "pl", "pm", "pn", "pr", "ps", "pt", "pw", "py", "qa",
  "re", "ro", "rs", "ru", "rw", "sa", "sb", "sc", "sd", "se", "sg", "sh", "si", "sk", "sl", "sm", "sn", "so", "sr",
  "ss", "st", "sv", "sx", "sy", "sz", "tc", "td", "tf", "tg", "th", "tj", "tk", "tl", "tm", "tn", "to", "tr", "tt",
  "tv", "tw", "tz", "ua", "ug", "uk", "us", "uy", "uz", "va", "vc", "ve", "vg", "vi", "vn", "vu",
  "ws", "ye", "yt", "za", "zm", "zw"
]);

// Common mistyped TLDs with their intended replacement
const INVALID_TLD_SUGGESTIONS = {
  con: "com", cmo: "com", cpm: "com", coom: "com", comm: "com",
  col: "com", vom: "com", xom: "com", ocm: "com", kom: "com",
  cm: "com", om: "com",
  met: "net", ner: "net", ney: "net",
  ogr: "org", orgg: "org",
  eddu: "edu"
};

// Recognized provider TLD extensions including .in, .org, .net, .com, .co.in, etc.
const ALLOWED_PROVIDER_TLDS = new Set([
  "com", "in", "org", "net", "co.in", "org.in", "net.in", "edu", "ac.in", "edu.in"
]);

const MAJOR_PROVIDERS = {
  gmail: "gmail",
  googlemail: "googlemail",
  yahoo: "yahoo",
  hotmail: "hotmail",
  outlook: "outlook",
  icloud: "icloud",
  protonmail: "protonmail",
  zoho: "zoho",
  aol: "aol"
};

// Disposable/throwaway temporary domains
const DISPOSABLE_EMAIL_DOMAINS = new Set([
  "mailinator.com", "tempmail.com", "10minutemail.com", "guerrillamail.com",
  "throwawaymail.com", "yopmail.com", "sharklasers.com", "trashmail.com",
  "dispostable.com", "fake.com", "test.com", "example.com"
]);

/**
 * Computes Levenshtein edit distance between two strings.
 */
function levenshtein(a, b) {
  const matrix = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[a.length][b.length];
}

/**
 * Finds a corrected domain suggestion if the provided domain is a typo of a popular provider.
 * Returns the suggested domain string (e.g. 'gmail.com', 'gmail.in') or null if no typo detected.
 */
export function findDomainSuggestion(domain) {
  if (!domain || !domain.includes(".")) return null;

  const parts = domain.split(".");
  const name = parts[0];
  const tld = parts.slice(1).join(".");

  // 1. If provider name is valid and TLD is an accepted extension (.in, .org, .net, .com, .co.in, etc.), it is valid!
  if (MAJOR_PROVIDERS[name] && ALLOWED_PROVIDER_TLDS.has(tld)) {
    return null;
  }

  // 2. If major provider ends with .co, it's typically a missing 'm' for .com
  if (MAJOR_PROVIDERS[name] && tld === "co") {
    return `${name}.com`;
  }

  // Determine appropriate target TLD (keep user's valid TLD like .in, .org, or default to .com)
  const targetTld = ALLOWED_PROVIDER_TLDS.has(tld) ? tld : "com";

  // 3. Collapse repeated characters (e.g. gmmmail -> gmail)
  const collapsed = name.replace(/(.)\1{2,}/g, "$1");
  if (MAJOR_PROVIDERS[collapsed] && collapsed !== name) {
    return `${MAJOR_PROVIDERS[collapsed]}.${targetTld}`;
  }
  const collapsedDouble = name.replace(/([a-z])\1/g, "$1");
  if (MAJOR_PROVIDERS[collapsedDouble] && collapsedDouble !== name) {
    return `${MAJOR_PROVIDERS[collapsedDouble]}.${targetTld}`;
  }

  // 4. Fuzzy match provider name
  for (const [provider, baseName] of Object.entries(MAJOR_PROVIDERS)) {
    const dist = levenshtein(name, provider);
    const maxLen = Math.max(name.length, provider.length);
    if ((dist <= 2 && maxLen >= 5) || (dist === 1 && maxLen === 4)) {
      return `${baseName}.${targetTld}`;
    }
  }

  return null;
}

/**
 * Suggests an entire email fix if there is a typo in the domain.
 * @param {string} email
 * @returns {string|null} Full corrected email or null
 */
export function getEmailSuggestion(email) {
  if (!email || !email.includes("@")) return null;
  const parts = email.trim().toLowerCase().split("@");
  if (parts.length !== 2) return null;
  const [localPart, domain] = parts;
  const suggestedDomain = findDomainSuggestion(domain);
  if (suggestedDomain && suggestedDomain !== domain) {
    return `${localPart}@${suggestedDomain}`;
  }
  return null;
}

/**
 * Validates an email address with strict TLD, provider typo detection, and syntax checks.
 * Shared helper for Contact Form, Newsletter, Login, and Sign Up.
 *
 * @param {string} email - The email string to validate.
 * @returns {string} Error message string if invalid, or "" if valid.
 */
export const validateEmail = (email) => {
  if (!email || !email.trim()) {
    return "Email is required.";
  }

  const cleaned = email.trim().toLowerCase();

  if (cleaned.length > 254) {
    return "Email address is too long (maximum 254 characters).";
  }

  if (cleaned.includes("..")) {
    return "Email address cannot contain consecutive dots.";
  }

  const atParts = cleaned.split("@");
  if (atParts.length !== 2) {
    return "Please enter a valid email address with a single @ symbol.";
  }

  const [localPart, domain] = atParts;
  if (!localPart || !domain) {
    return "Please enter both a username and a domain (e.g., name@example.com).";
  }

  if (localPart.startsWith(".") || localPart.endsWith(".")) {
    return "Email username cannot start or end with a dot.";
  }

  if (localPart.length > 64) {
    return "Email username is too long (maximum 64 characters).";
  }

  if (domain.startsWith("-") || domain.endsWith("-") || domain.startsWith(".") || domain.endsWith(".")) {
    return "Invalid domain format.";
  }

  const domainParts = domain.split(".");
  if (domainParts.length < 2) {
    return "Please enter a valid domain (e.g., example.com).";
  }

  const tld = domainParts[domainParts.length - 1];

  // Common TLD typos (.con -> .com, etc.)
  if (INVALID_TLD_SUGGESTIONS[tld]) {
    return `Invalid domain ending '.${tld}'. Did you mean '.${INVALID_TLD_SUGGESTIONS[tld]}'?`;
  }

  // Disposable domain block
  if (DISPOSABLE_EMAIL_DOMAINS.has(domain)) {
    return "Disposable or temporary email addresses are not permitted.";
  }

  // Provider typo & suggestion (e.g. gmmmail.co -> gmail.com)
  const suggestedDomain = findDomainSuggestion(domain);
  if (suggestedDomain && suggestedDomain !== domain) {
    return `Invalid domain '${domain}'. Did you mean '${localPart}@${suggestedDomain}'?`;
  }

  // TLD validity check against valid ccTLDs and gTLDs
  const isValidTLD = VALID_CCTLDS.has(tld) || VALID_GTLDS.has(tld);
  if (!isValidTLD) {
    return `Invalid domain ending '.${tld}'. Please enter a valid email address (e.g., .com, .in, .org).`;
  }

  // Strict regex check for full email pattern
  if (!EMAIL_REGEX.test(cleaned)) {
    return "Please enter a valid email address (e.g., name@example.com).";
  }

  // Gmail specific length rule (Google enforces 6-30 chars for Gmail usernames)
  if (domain.startsWith("gmail.") && (localPart.length < 6 || localPart.length > 30)) {
    return "Gmail usernames must be between 6 and 30 characters.";
  }

  return "";
};

