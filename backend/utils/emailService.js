// utils/emailService.js
// Uses nodemailer. Set these env vars: EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS or EMAIL_PASSWORD, EMAIL_FROM
const { transporter } = require("./mailer");

/**
 * Send a branded payment confirmation email after successful PayPal capture.
 *
 * @param {Object} opts
 * @param {string} opts.email            - Recipient email address
 * @param {string} opts.name             - Recipient display name
 * @param {string} opts.planType         - e.g. "Premium Basic"
 * @param {number} opts.amount           - e.g. 2.99
 * @param {string} opts.captureId        - PayPal capture transaction ID
 * @param {string} opts.orderId          - PayPal order ID
 * @param {Date}   opts.premiumExpiration - When the subscription expires
 * @param {string} [opts.invoiceUrl]      - Optional link to download the PDF invoice
 */
async function sendPaymentConfirmationEmail({
  email,
  name,
  planType,
  amount,
  captureId,
  orderId,
  premiumExpiration,
  invoiceUrl,
}) {
  const expiryStr = premiumExpiration
    ? new Date(premiumExpiration).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Kolkata",
      })
    : "N/A";

  const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e5e5;">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:32px 40px;text-align:center;">
            <p style="color:rgba(255,255,255,0.75);margin:0 0 4px;font-size:12px;font-weight:600;letter-spacing:2px;text-transform:uppercase;">SkillNaav</p>
            <h1 style="color:#ffffff;margin:0;font-size:22px;font-weight:700;">Payment Confirmed</h1>
            <p style="color:rgba(255,255,255,0.85);margin:6px 0 0;font-size:14px;">Thank you for subscribing to SkillNaav Premium!</p>
          </td>
        </tr>

        <!-- Greeting -->
        <tr>
          <td style="padding:32px 40px 0;">
            <p style="margin:0;font-size:15px;color:#374151;">Hi ${name},</p>
            <p style="margin:12px 0 0;font-size:14px;color:#6b7280;line-height:1.6;">
              Your payment was successful and your <strong style="color:#374151;">${planType}</strong> subscription on <strong style="color:#6366f1;">SkillNaav</strong> is now active. You can now enjoy full premium access to all features.
            </p>
          </td>
        </tr>

        <!-- Plan summary card -->
        <tr>
          <td style="padding:24px 40px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;">
              <tr>
                <td style="padding:20px;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="font-size:13px;color:#6b7280;padding-bottom:10px;">Plan</td>
                      <td style="font-size:13px;color:#111827;font-weight:600;text-align:right;padding-bottom:10px;">${planType}</td>
                    </tr>
                    <tr>
                      <td style="font-size:13px;color:#6b7280;padding-bottom:10px;">Amount paid</td>
                      <td style="font-size:13px;color:#111827;font-weight:600;text-align:right;padding-bottom:10px;">$${amount.toFixed(2)} USD</td>
                    </tr>
                    <tr>
                      <td colspan="2" style="border-top:1px solid #e5e7eb;padding-top:10px;"></td>
                    </tr>
                    <tr>
                      <td style="font-size:13px;color:#6b7280;padding-bottom:6px;">Transaction ID</td>
                      <td style="font-size:12px;color:#6b7280;text-align:right;font-family:monospace;padding-bottom:6px;">${captureId}</td>
                    </tr>
                    <tr>
                      <td style="font-size:13px;color:#6b7280;padding-bottom:6px;">Order ID</td>
                      <td style="font-size:12px;color:#6b7280;text-align:right;font-family:monospace;padding-bottom:6px;">${orderId}</td>
                    </tr>
                    <tr>
                      <td style="font-size:13px;color:#6b7280;">Expires on</td>
                      <td style="font-size:13px;color:#111827;font-weight:600;text-align:right;">${expiryStr} IST</td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- CTA -->
        <tr>
          <td style="padding:0 40px 32px;text-align:center;">
            <a href="${process.env.APP_URL || "#"}/premium"
               style="display:inline-block;background:#6366f1;color:#ffffff;text-decoration:none;padding:12px 32px;border-radius:8px;font-size:14px;font-weight:600;margin-right:10px;">
              Go to my account
            </a>
            ${invoiceUrl ? `
            <a href="${invoiceUrl}"
               target="_blank"
               style="display:inline-block;background:#f3f4f6;color:#374151;text-decoration:none;padding:12px 32px;border-radius:8px;font-size:14px;font-weight:600;border:1px solid #d1d5db;">
              Download Invoice
            </a>
            ` : ''}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:20px 40px;text-align:center;">
            <p style="margin:0;font-size:12px;color:#9ca3af;">
              If you have questions about your subscription, contact us at
              <a href="mailto:skillnaav@gmail.com" style="color:#6366f1;text-decoration:none;">skillnaav@gmail.com</a>
              or visit <a href="https://skillnaav.com" style="color:#6366f1;text-decoration:none;">skillnaav.com</a>.
            </p>
            <p style="margin:8px 0 0;font-size:11px;color:#d1d5db;">
              &copy; ${new Date().getFullYear()} SkillNaav. All rights reserved.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>
  `.trim();

  await transporter.sendMail({
    from: `"${process.env.EMAIL_FROM_NAME || "SkillNaav"}" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
    to: email,
    subject: `Payment confirmed — Your SkillNaav ${planType} is now active`,
    html,
  });

  console.log(`✅ Confirmation email sent to ${email}`);
}

/**
 * Send a branded internship payment confirmation email to a student
 * who has paid the internship fee for a PAID internship.
 *
 * @param {Object} opts
 * @param {string} opts.email              - Student email
 * @param {string} opts.name               - Student name
 * @param {string} opts.internshipTitle    - Job/internship title
 * @param {string} opts.companyName        - Company name
 * @param {number} opts.amount             - Amount paid
 * @param {string} opts.currency           - Currency code e.g. "USD"
 * @param {string} opts.paypalPaymentId    - PayPal capture/payment ID
 * @param {string} opts.paypalOrderId      - PayPal order ID
 * @param {string} [opts.startDate]        - Internship start date
 * @param {string} [opts.invoiceUrl]       - Optional link to download PDF invoice
 */
async function sendInternshipPaymentConfirmationEmail({
  email,
  name,
  internshipTitle,
  companyName,
  amount,
  currency = "USD",
  paypalPaymentId,
  paypalOrderId,
  startDate,
  offerId,
  invoiceUrl,
}) {
  const dateStr = startDate
    ? new Date(startDate).toLocaleDateString("en-IN", {
        day: "2-digit", month: "short", year: "numeric",
        timeZone: "Asia/Kolkata",
      })
    : "N/A";

  const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e5e5;">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#0ea5e9,#6366f1);padding:32px 40px;text-align:center;">
            <p style="color:rgba(255,255,255,0.75);margin:0 0 4px;font-size:12px;font-weight:600;letter-spacing:2px;text-transform:uppercase;">SkillNaav</p>
            <h1 style="color:#ffffff;margin:0;font-size:22px;font-weight:700;">Internship Fee Paid!</h1>
            <p style="color:rgba(255,255,255,0.85);margin:6px 0 0;font-size:14px;">Your internship seat is confirmed.</p>
          </td>
        </tr>

        <!-- Greeting -->
        <tr>
          <td style="padding:32px 40px 0;">
            <p style="margin:0;font-size:15px;color:#374151;">Hi ${name},</p>
            <p style="margin:12px 0 0;font-size:14px;color:#6b7280;line-height:1.6;">
              Your payment for the internship <strong style="color:#374151;">${internshipTitle}</strong>
              at <strong style="color:#0ea5e9;">${companyName}</strong> has been successfully received.
              You are now officially enrolled.
            </p>
          </td>
        </tr>

        <!-- Summary card -->
        <tr>
          <td style="padding:24px 40px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;">
              <tr>
                <td style="padding:20px;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="font-size:13px;color:#6b7280;padding-bottom:10px;">Internship</td>
                      <td style="font-size:13px;color:#111827;font-weight:600;text-align:right;padding-bottom:10px;">${internshipTitle}</td>
                    </tr>
                    <tr>
                      <td style="font-size:13px;color:#6b7280;padding-bottom:10px;">Company</td>
                      <td style="font-size:13px;color:#111827;font-weight:600;text-align:right;padding-bottom:10px;">${companyName}</td>
                    </tr>
                    <tr>
                      <td style="font-size:13px;color:#6b7280;padding-bottom:10px;">Amount Paid</td>
                      <td style="font-size:13px;color:#111827;font-weight:600;text-align:right;padding-bottom:10px;">${currency} ${Number(amount).toFixed(2)}</td>
                    </tr>
                    <tr>
                      <td colspan="2" style="border-top:1px solid #e5e7eb;padding-top:10px;"></td>
                    </tr>
                    <tr>
                      <td style="font-size:13px;color:#6b7280;padding-bottom:6px;">PayPal Payment ID</td>
                      <td style="font-size:12px;color:#6b7280;text-align:right;font-family:monospace;padding-bottom:6px;">${paypalPaymentId || "—"}</td>
                    </tr>
                    <tr>
                      <td style="font-size:13px;color:#6b7280;padding-bottom:6px;">Order ID</td>
                      <td style="font-size:12px;color:#6b7280;text-align:right;font-family:monospace;padding-bottom:6px;">${paypalOrderId || "—"}</td>
                    </tr>
                    <tr>
                      <td style="font-size:13px;color:#6b7280;">Internship Start Date</td>
                      <td style="font-size:13px;color:#111827;font-weight:600;text-align:right;">${dateStr}</td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- CTA -->
        <tr>
          <td style="padding:0 40px 32px;text-align:center;">
            ${invoiceUrl ? `
            <a href="${invoiceUrl}"
               target="_blank"
               style="display:inline-block;background:#0ea5e9;color:#ffffff;text-decoration:none;padding:12px 32px;border-radius:8px;font-size:14px;font-weight:600;">
              Download Invoice
            </a>
            ` : ""}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:20px 40px;text-align:center;">
            <p style="margin:0;font-size:12px;color:#9ca3af;">
              For questions, contact us at
              <a href="mailto:skillnaav@gmail.com" style="color:#0ea5e9;text-decoration:none;">skillnaav@gmail.com</a>
              or visit <a href="https://skillnaav.com" style="color:#0ea5e9;text-decoration:none;">skillnaav.com</a>.
            </p>
            <p style="margin:8px 0 0;font-size:11px;color:#d1d5db;">
              &copy; ${new Date().getFullYear()} SkillNaav. All rights reserved.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>
  `.trim();

  await transporter.sendMail({
    from: `"SkillNaav" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
    to: email,
    subject: `Internship fee confirmed — ${internshipTitle} at ${companyName}`,
    html,
  });

  console.log(`✅ Internship payment email sent to ${email}`);
}

/**
 * Send a branded payment confirmation email for School Admins
 *
 * @param {Object} opts
 * @param {string} opts.email              - School Admin email
 * @param {string} opts.name               - School Admin name
 * @param {string} opts.planType           - Plan name e.g. "Standard Plan"
 * @param {number} opts.amount             - Amount paid
 * @param {number} opts.creditsAdded       - Number of student licenses
 * @param {string} opts.captureId          - PayPal capture/payment ID
 * @param {string} opts.orderId            - PayPal order ID
 * @param {string} [opts.invoiceUrl]       - Optional link to download PDF invoice
 */
async function sendSchoolAdminPaymentConfirmationEmail({
  email,
  name,
  planType,
  amount,
  creditsAdded,
  captureId,
  orderId,
  invoiceUrl,
}) {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e5e5;">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:32px 40px;text-align:center;">
            <p style="color:rgba(255,255,255,0.75);margin:0 0 4px;font-size:12px;font-weight:600;letter-spacing:2px;text-transform:uppercase;">SkillNaav</p>
            <h1 style="color:#ffffff;margin:0;font-size:22px;font-weight:700;">Payment Confirmed</h1>
            <p style="color:rgba(255,255,255,0.85);margin:6px 0 0;font-size:14px;">Thank you for purchasing student licenses!</p>
          </td>
        </tr>

        <!-- Greeting -->
        <tr>
          <td style="padding:32px 40px 0;">
            <p style="margin:0;font-size:15px;color:#374151;">Hi ${name},</p>
            <p style="margin:12px 0 0;font-size:14px;color:#6b7280;line-height:1.6;">
              Your payment was successful and your <strong style="color:#374151;">${planType}</strong> on <strong style="color:#6366f1;">SkillNaav</strong> is now active. You have been granted ${creditsAdded} student licenses.
            </p>
          </td>
        </tr>

        <!-- Plan summary card -->
        <tr>
          <td style="padding:24px 40px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;">
              <tr>
                <td style="padding:20px;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="font-size:13px;color:#6b7280;padding-bottom:10px;">Plan</td>
                      <td style="font-size:13px;color:#111827;font-weight:600;text-align:right;padding-bottom:10px;">${planType}</td>
                    </tr>
                    <tr>
                      <td style="font-size:13px;color:#6b7280;padding-bottom:10px;">Student Licenses</td>
                      <td style="font-size:13px;color:#111827;font-weight:600;text-align:right;padding-bottom:10px;">${creditsAdded}</td>
                    </tr>
                    <tr>
                      <td style="font-size:13px;color:#6b7280;padding-bottom:10px;">Amount paid</td>
                      <td style="font-size:13px;color:#111827;font-weight:600;text-align:right;padding-bottom:10px;">$${Number(amount).toFixed(2)} USD</td>
                    </tr>
                    <tr>
                      <td colspan="2" style="border-top:1px solid #e5e7eb;padding-top:10px;"></td>
                    </tr>
                    <tr>
                      <td style="font-size:13px;color:#6b7280;padding-bottom:6px;">Transaction ID</td>
                      <td style="font-size:12px;color:#6b7280;text-align:right;font-family:monospace;padding-bottom:6px;">${captureId}</td>
                    </tr>
                    <tr>
                      <td style="font-size:13px;color:#6b7280;padding-bottom:6px;">Order ID</td>
                      <td style="font-size:12px;color:#6b7280;text-align:right;font-family:monospace;padding-bottom:6px;">${orderId}</td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- CTA -->
        <tr>
          <td style="padding:0 40px 32px;text-align:center;">
            ${invoiceUrl ? `
            <a href="${invoiceUrl}"
               target="_blank"
               style="display:inline-block;background:#6366f1;color:#ffffff;text-decoration:none;padding:12px 32px;border-radius:8px;font-size:14px;font-weight:600;">
              Download Invoice
            </a>
            ` : ''}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:20px 40px;text-align:center;">
            <p style="margin:0;font-size:12px;color:#9ca3af;">
              If you have questions about your subscription, contact us at
              <a href="mailto:skillnaav@gmail.com" style="color:#6366f1;text-decoration:none;">skillnaav@gmail.com</a>
              or visit <a href="https://skillnaav.com" style="color:#6366f1;text-decoration:none;">skillnaav.com</a>.
            </p>
            <p style="margin:8px 0 0;font-size:11px;color:#d1d5db;">
              &copy; ${new Date().getFullYear()} SkillNaav. All rights reserved.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>
  `.trim();

  await transporter.sendMail({
    from: `"${process.env.EMAIL_FROM_NAME || "SkillNaav"}" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
    to: email,
    subject: `Payment confirmed — ${planType} on SkillNaav`,
    html,
  });

  console.log(`✅ School Admin confirmation email sent to ${email}`);
}

module.exports = { sendPaymentConfirmationEmail, sendInternshipPaymentConfirmationEmail, sendSchoolAdminPaymentConfirmationEmail, transporter };
