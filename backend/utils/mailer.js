const axios = require("axios");
const fs = require("fs");

const sendEmailViaBrevo = async (mailOptions) => {
  let senderEmail =
    mailOptions.from ||
    process.env.EMAIL_FROM ||
    process.env.EMAIL_USER ||
    process.env.BREVO_SMTP_LOGIN ||
    "skillnaav@gmail.com";
  let senderName = "Edutechex";

  if (senderEmail && senderEmail.includes("<")) {
    const match = senderEmail.match(/(.*)<(.*)>/);
    if (match) {
      senderName = match[1].replace(/"/g, "").trim() || senderName;
      senderEmail = match[2].trim();
    }
  }

  const payload = {
    sender: { name: senderName, email: senderEmail },
    to: [{ email: mailOptions.to }],
    subject: mailOptions.subject,
    headers: {
      "List-Unsubscribe": "<mailto:unsubscribe@edutechex.com?subject=unsubscribe>, <https://edutechex.com/unsubscribe>",
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  };

  if (mailOptions.html) {
    payload.htmlContent = mailOptions.html;
  }
  if (mailOptions.text) {
    payload.textContent = mailOptions.text;
  }

  if (mailOptions.replyTo) {
    let replyEmail = mailOptions.replyTo;
    if (replyEmail.includes("<")) {
      const match = replyEmail.match(/(.*)<(.*)>/);
      if (match) replyEmail = match[2].trim();
    }
    payload.replyTo = { email: replyEmail };
  }

  if (mailOptions.attachments && Array.isArray(mailOptions.attachments) && mailOptions.attachments.length > 0) {
    const processedAttachments = mailOptions.attachments
      .map((att) => {
        try {
          if (att.content && Buffer.isBuffer(att.content)) {
            return { name: att.filename || "attachment", content: att.content.toString("base64") };
          }
          if (att.content && typeof att.content === "string") {
            return { name: att.filename || "attachment", content: Buffer.from(att.content).toString("base64") };
          }
          if (att.path && fs.existsSync(att.path)) {
            const fileBuffer = fs.readFileSync(att.path);
            return { name: att.filename || "attachment", content: fileBuffer.toString("base64") };
          }
        } catch (readErr) {
          console.warn("Could not process email attachment:", att.filename, readErr.message);
        }
        return null;
      })
      .filter(Boolean);

    if (processedAttachments.length > 0) {
      payload.attachment = processedAttachments;
    }
  }

  const apiKey = process.env.BREVO_API_KEY || process.env.BREVO_SMTP_KEY;

  try {
    const response = await axios.post("https://api.brevo.com/v3/smtp/email", payload, {
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
        accept: "application/json",
      },
    });

    return { response: response.data };
  } catch (error) {
    console.error("❌ Brevo API Error details:", error.response?.data || error.message);

    // Fallback if sender domain was rejected by Brevo
    if (error.response?.status === 400 && senderEmail !== process.env.EMAIL_USER && process.env.EMAIL_USER) {
      console.log(`🔄 Retrying email send with verified fallback sender: ${process.env.EMAIL_USER}`);
      payload.sender = { name: "Edutechex", email: process.env.EMAIL_USER };
      const retryResponse = await axios.post("https://api.brevo.com/v3/smtp/email", payload, {
        headers: {
          "api-key": apiKey,
          "Content-Type": "application/json",
          accept: "application/json",
        },
      });
      return { response: retryResponse.data };
    }

    throw error;
  }
};

const transporter = {
  sendMail: async (mailOptions) => {
    return await sendEmailViaBrevo(mailOptions);
  },
  verify: async () => {
    return new Promise((resolve) => resolve(true));
  },
};

transporter.verify().then(() => {
  console.log("✅ Email transporter is ready (Brevo HTTP API)");
});

module.exports = { transporter, sendEmailViaBrevo };
