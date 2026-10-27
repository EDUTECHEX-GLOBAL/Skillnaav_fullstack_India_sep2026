// backend/utils/emailValidator.js

// Researched primary and generic TLDs (.com, .org, .net, .edu, etc.)
const VALID_PRIMARY_TLDS = new Set([
  "com", "org", "net", "edu", "gov", "mil", "int", "info", "biz",
  "io", "ai", "tech", "dev", "app", "cloud", "digital", "pro", "global",
  "online", "site", "store", "media", "agency", "solutions", "software",
  "academy", "university", "school", "institute", "network", "center",
  "team", "hub", "space", "me", "live", "link", "club", "life", "world",
  "design", "support", "zone", "work", "works", "email", "group", "news",
  "today", "website", "press", "blog", "mobi", "asia", "jobs", "travel",
  "expert", "guru", "care", "city", "services", "community", "consulting",
  "capital", "partners", "ventures", "vip", "direct", "top", "run", "shop", "market"
]);

// Researched multi-part TLDs (critical for India, UK, Australia, etc.)
const VALID_MULTIPART_TLDS = new Set([
  // India (.in)
  "co.in", "org.in", "net.in", "edu.in", "ac.in", "gov.in", "res.in", "gen.in",
  // United Kingdom (.uk)
  "co.uk", "org.uk", "ac.uk", "gov.uk", "net.uk", "me.uk", "ltd.uk", "plc.uk",
  // Australia (.au)
  "com.au", "net.au", "org.au", "edu.au", "gov.au",
  // New Zealand (.nz)
  "co.nz", "org.nz", "ac.nz", "edu.nz", "govt.nz", "net.nz",
  // South Africa (.za)
  "co.za", "org.za", "ac.za", "edu.za", "gov.za", "net.za",
  // Singapore (.sg)
  "com.sg", "edu.sg", "gov.sg", "net.sg", "org.sg",
  // Brazil (.br)
  "com.br", "org.br", "edu.br", "gov.br",
  // Mexico (.mx)
  "com.mx", "org.mx", "edu.mx", "gob.mx",
  // Malaysia (.my)
  "com.my", "edu.my", "org.my", "gov.my"
]);

// Valid country code TLDs (ISO 3166-1 alpha-2) - excluding standalone 'co'
const VALID_CCTLDS = new Set([
  "in", "us", "uk", "ca", "au", "de", "fr", "jp", "sg", "ae", "sa", "nz",
  "br", "mx", "za", "nl", "se", "ch", "es", "it", "ie", "no", "dk", "fi",
  "be", "at", "pl", "pt", "gr", "ru", "kr", "hk", "tw", "my", "id", "th",
  "vn", "ph", "pk", "bd", "lk", "np", "ng", "ke", "eg", "ar", "cl",
  "pe", "is", "lu", "cz", "hu", "ro", "bg", "hr", "sk", "si", "lt", "lv",
  "ee", "cy", "mt", "tr", "qa", "kw", "om", "bh", "cr", "pa", "uy"
]);

// Disposable, temporary burner email domains
const DISPOSABLE_EMAIL_DOMAINS = new Set([
  "goldvester.co", "goldvester.com",
  "hiringview.co", "hiringview.com",
  "mailinator.com", "mailinator.net", "mailinator2.com",
  "tempmail.com", "temp-mail.org", "temp-mail.io", "temp-mail.de",
  "10minutemail.com", "10minutemail.net", "10minemail.com",
  "guerrillamail.com", "guerrillamail.net", "guerrillamail.org", "guerrillamail.biz", "grr.la", "sharklasers.com",
  "throwawaymail.com", "yopmail.com", "yopmail.fr", "yopmail.net",
  "trashmail.com", "trashmail.net", "trashmail.org", "trashmail.me",
  "dispostable.com", "getairmail.com", "dropmail.me",
  "fake.com", "test.com", "example.com", "example.org", "example.net",
  "mohmal.com", "burnermail.io", "getnada.com", "inboxkitten.com",
  "fakemailgenerator.com", "crazymailing.com", "maildrop.cc", "mytemp.email",
  "generator.email", "emailfake.com",
  "chacuo.net", "crossmail.site", "crossmail.co", "dpptd.com", "fawkesmail.com", "fawkesmail.co", "greencafe24.com",
  "armyspy.com", "cuvox.de", "dayrep.com", "dayrep.co", "einrot.com", "einrot.co", "fleckens.hu",
  "gustr.com", "jourrapide.com", "rhyta.com", "superrito.com", "teleworm.us", "tinypm.com"
]);

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[A-Za-z]{2,}$/;

function validateEmailBackend(email) {
  if (!email || typeof email !== "string" || !email.trim()) {
    return "Email is required.";
  }
  const cleaned = email.trim().toLowerCase();
  if (cleaned.length > 254) {
    return "Email address is too long (maximum 254 characters).";
  }
  if (!EMAIL_REGEX.test(cleaned) || cleaned.includes("..")) {
    return "Please provide a valid email address.";
  }
  const parts = cleaned.split("@");
  if (parts.length !== 2) {
    return "Please provide a valid email address.";
  }
  const [localPart, domain] = parts;
  if (DISPOSABLE_EMAIL_DOMAINS.has(domain)) {
    return "Disposable or temporary email addresses are not permitted. Please use a valid personal or work email (e.g., .com, .in, .org).";
  }
  const domainParts = domain.split(".");
  if (domainParts.length < 2) {
    return "Please enter a valid domain (e.g., example.com, example.in, example.org).";
  }
  const tld = domainParts[domainParts.length - 1];
  const multiPartTld = domainParts.length >= 3 ? `${domainParts[domainParts.length - 2]}.${domainParts[domainParts.length - 1]}` : null;
  if (tld === "co" && !multiPartTld) {
    return "Invalid domain ending '.co'. Please enter a valid email address (e.g., .com, .in, .org, .co.in).";
  }
  const isValidTLD =
    (multiPartTld && VALID_MULTIPART_TLDS.has(multiPartTld)) ||
    VALID_PRIMARY_TLDS.has(tld) ||
    VALID_CCTLDS.has(tld);
  if (!isValidTLD) {
    return `Invalid domain ending '.${tld}'. Please enter a valid email address (e.g., .com, .in, .org).`;
  }
  return null;
}

module.exports = {
  validateEmailBackend,
  DISPOSABLE_EMAIL_DOMAINS,
  VALID_PRIMARY_TLDS,
  VALID_MULTIPART_TLDS,
  VALID_CCTLDS,
};
