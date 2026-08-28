//File: notifyUser.js

const { transporter } = require("./mailer");
const fs = require("fs");
const path = require("path");

const notifyUser = async (email, subject, bodyHtml, attachments = []) => {
  try {
    let logoBuffer = null;
    const logoFileName = 'skillnaav_logo-250w.png'; // Reverting to dark logo because background is white now
    try {
      logoBuffer = fs.readFileSync(path.resolve(__dirname, `../../frontend/src/assets/${logoFileName}`));
    } catch (e) {
      console.error("Could not load logo for email:", e);
    }

    // Always use the SkillNaav template wrapper
    const htmlContent = `
      <div style="background-color: #f3f4f6; padding: 20px 10px;">
        <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.05);">
          
          <!-- Header -->
          <header style="text-align: center; padding: 25px 20px 15px; background-color: #ffffff;">
            ${logoBuffer ? `<img src="cid:${logoFileName}" alt="SkillNaav Logo" style="width: 120px; max-width: 100%; height: auto;" />` : '<h1 style="color: #1a202c; margin: 0;">SkillNaav</h1>'}
          </header>

          <!-- Gradient Line -->
          <div style="height: 4px; background: linear-gradient(90deg, #f97316, #d946ef);"></div>

          <!-- Body -->
          <div style="padding: 25px 20px; text-align: center; color: #333;">
            ${bodyHtml}
          </div>

          <!-- Footer -->
          <footer style="text-align: center; padding: 20px; background-color: #ffffff; color: #9ca3af; font-size: 12px; border-top: 1px solid #f3f4f6;">
            <p style="margin: 0 0 10px; font-size: 14px; color: #6b7280;">Need help? Reach us at <a href="mailto:skillnaav@gmail.com" style="color: #d946ef; text-decoration: none; font-weight: 600;">skillnaav@gmail.com</a></p>
            <p style="margin: 0 0 10px; font-weight: 500; letter-spacing: 2px;">EXPLORE &nbsp;&middot;&nbsp; LEARN &nbsp;&middot;&nbsp; GROW</p>
            <p style="margin: 0;">&copy; ${new Date().getFullYear()} SkillNaav. All rights reserved.</p>
          </footer>
        </div>
      </div>
    `;

    const finalAttachments = [...attachments];
    if (logoBuffer) {
      finalAttachments.push({
        filename: logoFileName, // nodemailer standard
        name: logoFileName,     // Brevo requirement
        content: logoBuffer
      });
    }

    const mailOptions = {
      from: `"SkillNaav Support" <${process.env.EMAIL_FROM}>`,
      replyTo: `"SkillNaav Admin" <${process.env.EMAIL_REPLY_TO}>`,
      to: email,
      subject,
      text: bodyHtml.replace(/<[^>]+>/g, ""), // plain-text fallback
      html: htmlContent,
      attachments: finalAttachments,
    };

    console.log("📧 Sending email to:", email);
    const result = await transporter.sendMail(mailOptions);
    console.log("✅ Email sent successfully:", result.response);
    return result;
  } catch (error) {
    console.error("❌ Failed to send email:", error.message);
    return null;
  }
};
module.exports = notifyUser;