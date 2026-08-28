// File: backend/utils/UserAgeGateConsentMail.js

const notifyUser = require("./notifyUser");

const CONSENT_POINTS = [
    "You confirm you are the child’s parent or legal guardian and are legally allowed to provide consent.",
    "You consent to creating the child’s account and allowing the child to use the platform features (including internships, learning tasks, and schedules).",
    "You consent to our processing of the child’s basic account information and activity data to provide the service (e.g., login, scheduling, progress tracking, and support).",
    "We may contact the guardian email provided for verification, important account notices, safety-related communication, or consent-related updates.",
    "You understand you can request account deletion or withdraw consent at any time by replying to this email (access may be removed if consent is withdrawn).",
];

async function sendGuardianConsentEmail({
    guardianEmail,
    guardianName,
    studentEmail,
    studentName,
    consentAt,
}) {
    if (!guardianEmail) return;

    const subject = "Guardian consent received for Skillnaav (Under 18)";

    const appUrl = process.env.WEBAPP_BASE_URL || "https://www.skillnaav.com";
    const when = consentAt ? new Date(consentAt) : new Date();

    const safeGuardianName = (guardianName || "Guardian").trim();
    const safeStudentName = (studentName || "your child").trim();
    const safeStudentEmail = (studentEmail || "").trim();

    const pointsHtml = CONSENT_POINTS.map((p) => `<li>${p}</li>`).join("");

    const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5;">
      <p>Hi ${safeGuardianName},</p>

      <p>
        We received a guardian consent submission for <b>${safeStudentName}</b> to use Skillnaav and apply for internships.
      </p>

      ${safeStudentEmail ? `<p><b>Child account email:</b> ${safeStudentEmail}</p>` : ""}

      <p><b>Consent summary:</b></p>
      <ul>
        ${pointsHtml}
      </ul>

      <p><b>Submitted at:</b> ${when.toLocaleString("en-IN")}</p>

      <p>
        If you did <b>not</b> authorize this, please reply to this email immediately.
      </p>

      <p>
        You can log in anytime at: <a href="${appUrl}/user/login">${appUrl}/user/login</a>
      </p>

      <p>- Skillnaav Team</p>
    </div>
  `;

    // notifyUser(to, subject, html)
    await notifyUser(guardianEmail, subject, html);
}

module.exports = sendGuardianConsentEmail;