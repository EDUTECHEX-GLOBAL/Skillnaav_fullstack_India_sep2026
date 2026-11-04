// File: domain.js
// Utility helpers for B2B / Campus subdomain and route detection

export const B2B_STUDENT_DOMAIN =
  process.env.REACT_APP_B2B_DOMAIN || "revamp.edutechexskills.com";
export const B2B_LEGACY_DOMAIN = "revamp.edutechexskills.com";

/**
 * Returns true if the current hostname corresponds to the dedicated B2B student domain.
 * E.g., revamp.edutechexskills.com, b2b.edutechexskills.com, b2b.localhost, etc.
 */
export const isB2BHost = () => {
  if (typeof window === "undefined") return false;
  const hostname = window.location.hostname.toLowerCase();
  if (
    hostname === B2B_STUDENT_DOMAIN.toLowerCase() ||
    hostname === B2B_LEGACY_DOMAIN.toLowerCase()
  ) {
    return true;
  }
  return (
    hostname.startsWith("b2b.") ||
    hostname.startsWith("campus.") ||
    hostname.startsWith("school.") ||
    hostname.startsWith("institution.") ||
    hostname.startsWith("student-b2b.") ||
    hostname.startsWith("b2b-")
  );
};

/**
 * Returns true if the user is in a B2B context.
 */
export const isB2BContext = () => {
  if (typeof window === "undefined") return false;
  if (isB2BHost()) return true;
  const pathname = window.location.pathname.toLowerCase();
  if (pathname.startsWith("/b2b")) return true;
  try {
    const stored = JSON.parse(
      localStorage.getItem("studentInfo") ||
        localStorage.getItem("userInfo") ||
        "{}"
    );
    if (stored.isB2B || stored.schoolAdmin || stored.schoolAdminId) return true;
  } catch (_) {}
  return false;
};

export const MAIN_DOMAIN =
  process.env.REACT_APP_MAIN_DOMAIN || "edutechexskills.com";

/**
 * Redirects the student to the login page after logout.
 * On local dev (localhost/127.0.0.1), uses client navigation to /user/login.
 * On live/production (such as revamp.edutechexskills.com or edutechexskills.com),
 * always redirects to the main domain: https://edutechexskills.com/user/login.
 */
export const redirectToLoginAfterLogout = (navigate) => {
  if (typeof window === "undefined") return;
  const currentHost = window.location.hostname.toLowerCase();

  if (currentHost === "localhost" || currentHost === "127.0.0.1") {
    if (typeof navigate === "function") {
      navigate("/user/login");
    } else {
      window.location.href = "/user/login";
    }
    return;
  }

  const protocol = window.location.protocol || "https:";
  window.location.href = `${protocol}//${MAIN_DOMAIN}/user/login`;
};
