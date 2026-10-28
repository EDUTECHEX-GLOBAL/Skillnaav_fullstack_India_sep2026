//File: notifyUser.js

const { transporter } = require("./mailer");

const notifyUser = async (email, subject, bodyHtml, attachments = []) => {
  try {
    // Hosted logo URL for edutechex_logo-250w.png on Brevo's dedicated email asset CDN
    const logoUrl = "https://img.mailinblue.com/11399089/images/rnb/original/6ae1af262bd3da336905052f.png";

    // Always use the Edutechex template wrapper
    const htmlContent = `
      <div style="background-color: #f3f4f6; padding: 20px 10px;">
        <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.05);">
          
          <div style="text-align: center; padding: 25px 20px 15px; background-color: #ffffff;">
            <img src="${logoUrl}" alt="Edutechex Logo" width="170" style="width: 170px; max-width: 100%; height: auto; display: inline-block; border: 0; outline: none; text-decoration: none;" />
          </div>

          <!-- Gradient Line -->
          <div style="height: 4px; background: linear-gradient(90deg, #f97316, #d946ef);"></div>

          <!-- Body -->
          <div style="padding: 25px 20px; text-align: center; color: #333;">
            ${bodyHtml}
          </div>

          <!-- Footer -->
          <footer style="text-align: center; padding: 20px; background-color: #ffffff; color: #9ca3af; font-size: 12px; border-top: 1px solid #f3f4f6;">
            <p style="margin: 0 0 10px; font-size: 14px; color: #6b7280;">Need help? Reach us at <a href="mailto:edutechex@gmail.com" style="color: #d946ef; text-decoration: none; font-weight: 600;">edutechex@gmail.com</a></p>
            <p style="margin: 0 0 10px; font-weight: 500; letter-spacing: 2px;">EXPLORE &nbsp;&middot;&nbsp; LEARN &nbsp;&middot;&nbsp; GROW</p>
            <p style="margin: 0;">&copy; ${new Date().getFullYear()} Edutechex. All rights reserved.</p>
          </footer>
        </div>
      </div>
    `;

    // Only forward caller-specified attachments (do not attach logo as file attachment)
    const finalAttachments = [...attachments];

    const senderEmail = process.env.EMAIL_FROM || process.env.EMAIL_USER || "skillnaav@gmail.com";
    const replyToEmail = process.env.EMAIL_REPLY_TO || process.env.EMAIL_USER || "skillnaav@gmail.com";

    const mailOptions = {
      from: `"Edutechex Support" <${senderEmail}>`,
      replyTo: `"Edutechex Admin" <${replyToEmail}>`,
      to: email,
      subject,
      text: bodyHtml.replace(/<[^>]+>/g, ""), // plain-text fallback
      html: htmlContent,
      attachments: finalAttachments,
    };

    console.log("📧 Sending email to:", email);
    const result = await transporter.sendMail(mailOptions);
    console.log("✅ Email sent successfully:", result?.response || "OK");
    return result;
  } catch (error) {
    console.error("❌ Failed to send email:", error.response?.data || error.message);
    return null;
  }
};
module.exports = notifyUser;