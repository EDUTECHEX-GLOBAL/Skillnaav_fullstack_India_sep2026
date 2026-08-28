const axios = require("axios");

const sendEmailViaBrevo = async (mailOptions) => {
  let senderEmail = mailOptions.from || process.env.EMAIL_FROM || process.env.BREVO_SMTP_LOGIN || "support@skillnaav.com";
  let senderName = "SkillNaav";

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
      "List-Unsubscribe": "<mailto:unsubscribe@skillnaav.com?subject=unsubscribe>, <https://skillnaav.com/unsubscribe>",
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click"
    }
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

  if (mailOptions.attachments && mailOptions.attachments.length > 0) {
    payload.attachment = mailOptions.attachments
      .map((att) => {
        if (att.content && Buffer.isBuffer(att.content)) {
          return { name: att.filename, content: att.content.toString("base64") };
        }
        if (att.content && typeof att.content === "string") {
          return { name: att.filename, content: Buffer.from(att.content).toString("base64") };
        }
        return null;
      })
      .filter(Boolean);
  }

  const response = await axios.post("https://api.brevo.com/v3/smtp/email", payload, {
    headers: {
      "api-key": process.env.BREVO_API_KEY || process.env.BREVO_SMTP_KEY,
      "Content-Type": "application/json",
      "accept": "application/json",
    },
  });

  return { response: response.data };
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
