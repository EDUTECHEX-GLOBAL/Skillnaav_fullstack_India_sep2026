const notifyUser = require("./notifyUser");

function formatDateTime(date, timezone = "Asia/Kolkata") {
  return new Date(date).toLocaleString("en-IN", {
    timeZone: timezone, 
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/**
 * Interview Scheduled Email (Student)
 */
async function sendInterviewScheduledToStudent({
  to,
  studentName,
  internshipTitle,
  companyName,
  meetLink,
  scheduledAt,
  timezone,
  partnerName,
}) {
  const subject = "Your SkillNaav Interview is Scheduled 🎯";
  const companyText = companyName ? ` at <strong>${companyName}</strong>` : "";

  const bodyHtml = `
    <p style="font-size: 16px; margin-bottom: 20px;">Hi ${studentName || "there"},</p>
    <p style="font-size: 16px; color: #555;">Your interview for <strong>${internshipTitle}</strong>${companyText} has been scheduled successfully. Please find the details of your upcoming meeting below.</p>

    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin: 30px 0;">
      <h3 style="margin-top: 0; color: #1e293b; font-size: 18px; border-bottom: 1px solid #e2e8f0; padding-bottom: 12px;">Interview Details</h3>
      <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-weight: 600; width: 120px;">🗓️ Date & Time:</td>
          <td style="padding: 8px 0; color: #0f172a; font-weight: 500;">${formatDateTime(scheduledAt, timezone)}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-weight: 600;">👤 Interviewer:</td>
          <td style="padding: 8px 0; color: #0f172a; font-weight: 500;">${partnerName}</td>
        </tr>
      </table>
      
      <div style="margin-top: 24px; text-align: center;">
        ${typeof meetLink === 'string' && meetLink.startsWith("http") ? `
        <a href="${meetLink}" target="_blank" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          Join Google Meet
        </a>
        ` : `
        <p style="color: #ef4444; font-weight: bold; font-size: 14px; background-color: #fef2f2; padding: 12px; border-radius: 8px; display: inline-block; border: 1px solid #fee2e2;">
          ⚠️ Google Meet Link pending. The partner will share it with you shortly.
        </p>
        `}
      </div>
    </div>

    <p style="font-size: 14px; color: #64748b; text-align: center;">Please join the meeting 5 minutes early to ensure a smooth start.</p>
    <p style="font-size: 16px; text-align: center; font-weight: 600; color: #1e293b;">All the best! 🚀</p>
  `;

  return notifyUser(to, subject, bodyHtml);
}

/**
 * Interview Scheduled Email (Partner)
 */
async function sendInterviewScheduledToPartner({
  to,
  partnerName,
  studentName,
  internshipTitle,
  companyName,
  meetLink,
  scheduledAt,
  timezone,
}) {
  const subject = "Interview Scheduled Successfully ✅";
  const companyText = companyName ? ` at <strong>${companyName}</strong>` : "";

  const bodyHtml = `
    <p style="font-size: 16px; margin-bottom: 20px;">Hi ${partnerName || "Partner"},</p>
    <p style="font-size: 16px; color: #555;">You have successfully scheduled an interview with <strong>${studentName}</strong> for the <strong>${internshipTitle}</strong> position${companyText}.</p>

    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin: 30px 0;">
      <h3 style="margin-top: 0; color: #1e293b; font-size: 18px; border-bottom: 1px solid #e2e8f0; padding-bottom: 12px;">Meeting Overview</h3>
      <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-weight: 600; width: 120px;">👤 Candidate:</td>
          <td style="padding: 8px 0; color: #0f172a; font-weight: 500;">${studentName}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-weight: 600;">💼 Internship:</td>
          <td style="padding: 8px 0; color: #0f172a; font-weight: 500;">${internshipTitle}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-weight: 600;">🗓️ Date & Time:</td>
          <td style="padding: 8px 0; color: #0f172a; font-weight: 500;">${formatDateTime(scheduledAt, timezone)}</td>
        </tr>
      </table>

      <div style="margin-top: 24px; text-align: center;">
        ${meetLink && meetLink.startsWith("http") ? `
        <a href="${meetLink}" target="_blank" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          Join Meeting
        </a>
        ` : `
        <p style="color: #ef4444; font-weight: bold; font-size: 14px; background-color: #fef2f2; padding: 12px; border-radius: 8px; display: inline-block; border: 1px solid #fee2e2;">
          ⚠️ Google Auth Error: Could not generate a Meet link automatically. Please share a meeting link with the candidate manually.
        </p>
        `}
      </div>
    </div>

    <p style="font-size: 14px; color: #64748b; text-align: center;">You can manage this interview and view candidate details directly from your SkillNaav dashboard.</p>
  `;

  return notifyUser(to, subject, bodyHtml);
}

module.exports = {
  sendInterviewScheduledToStudent,
  sendInterviewScheduledToPartner,
};
