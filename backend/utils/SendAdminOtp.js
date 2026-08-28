// File: SendAdminOtp.js

const nodemailer = require("nodemailer");

const sendEmail = async ({ to, subject, text }) => {
    const transporter = nodemailer.createTransport({
        host: "smtp-relay.brevo.com",
        port: 2525,
        secure: false,
        auth: {
            user: process.env.BREVO_SMTP_LOGIN,
            pass: process.env.BREVO_SMTP_KEY,
        },
    });

    await transporter.sendMail({
        from: process.env.EMAIL_FROM || process.env.BREVO_SMTP_LOGIN,
        to,
        replyTo: process.env.EMAIL_REPLY_TO,
        subject,
        text,
    });
};

module.exports = sendEmail;