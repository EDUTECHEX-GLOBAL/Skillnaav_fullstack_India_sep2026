// services/invoiceGenerator.js
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const crypto = require("crypto");

const AWS_REGION = process.env.AWS_REGION;
const AWS_IMAGE_BUCKET = process.env.AWS_IMAGE_BUCKET;

const s3 = new S3Client({
    region: AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

/**
 * Generate a PDF invoice and upload to S3.
 */
async function generateAndUploadInvoice({
    userName,
    userEmail,
    planType,
    amount,
    transactionId,
    orderId,
    date = new Date(),
    description = null,
    descriptionDetail = null
}) {
    const invoiceId = crypto.randomUUID();
    
    const formatDate = (dateInput) => {
        if (!dateInput) return "—";
        const d = new Date(dateInput);
        if (isNaN(d.getTime())) return "—";
        return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
    };
    
    const formattedDate = formatDate(date);

    // Simple, clean invoice HTML template
    const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Invoice</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
        <style>
            body {
                margin: 0;
                padding: 40px;
                font-family: 'Inter', sans-serif;
                color: #1f2937;
                background: #fff;
            }
            .header {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                margin-bottom: 40px;
                border-bottom: 2px solid #f3f4f6;
                padding-bottom: 20px;
            }
            .logo-placeholder {
                font-size: 24px;
                font-weight: 700;
                color: #4f46e5;
                letter-spacing: -0.5px;
            }
            .invoice-title {
                font-size: 32px;
                font-weight: 700;
                color: #111827;
                margin: 0;
            }
            .invoice-meta {
                text-align: right;
                color: #6b7280;
                font-size: 14px;
                margin-top: 5px;
            }
            .billing-info {
                display: flex;
                justify-content: space-between;
                margin-bottom: 40px;
            }
            .billing-col h3 {
                font-size: 12px;
                text-transform: uppercase;
                color: #9ca3af;
                letter-spacing: 1px;
                margin-bottom: 10px;
            }
            .billing-col p {
                margin: 0 0 5px 0;
                font-size: 15px;
                font-weight: 500;
            }
            .billing-col .light-text {
                color: #6b7280;
                font-weight: 400;
            }
            table {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 40px;
            }
            th {
                text-align: left;
                padding: 12px 0;
                border-bottom: 2px solid #e5e7eb;
                color: #6b7280;
                font-weight: 600;
                font-size: 13px;
                text-transform: uppercase;
            }
            td {
                padding: 16px 0;
                border-bottom: 1px solid #e5e7eb;
                font-size: 15px;
            }
            .amount-col {
                text-align: right;
            }
            .total-row {
                display: flex;
                justify-content: flex-end;
                margin-top: 20px;
            }
            .total-box {
                width: 300px;
            }
            .total-line {
                display: flex;
                justify-content: space-between;
                padding: 10px 0;
                font-size: 15px;
            }
            .total-final {
                font-size: 20px;
                font-weight: 700;
                color: #111827;
                border-top: 2px solid #e5e7eb;
                padding-top: 15px;
                margin-top: 5px;
            }
            .footer {
                margin-top: 60px;
                text-align: center;
                color: #9ca3af;
                font-size: 13px;
                border-top: 1px solid #f3f4f6;
                padding-top: 20px;
            }
        </style>
    </head>
    <body>
        <div class="header">
            <div>
                <div class="logo-placeholder">SkillNaav</div>
                <div style="color: #6b7280; font-size: 12px; margin-top: 6px; line-height: 1.7;">
                    skillnaav.com<br/>
                    skillnaav@gmail.com
                </div>
            </div>
            <div>
                <h1 class="invoice-title">INVOICE</h1>
                <div class="invoice-meta">Invoice #${invoiceId.split('-')[0].toUpperCase()}</div>
                <div class="invoice-meta">Date: ${formattedDate}</div>
            </div>
        </div>

        <div class="billing-info">
            <div class="billing-col">
                <h3>Billed To</h3>
                <p>${userName}</p>
                <p class="light-text">${userEmail}</p>
            </div>
            <div class="billing-col" style="text-align: right;">
                <h3>Payment Details</h3>
                <p class="light-text">Transaction ID: ${transactionId}</p>
                <p class="light-text">Order ID: ${orderId}</p>
            </div>
        </div>

        <table>
            <thead>
                <tr>
                    <th>Description</th>
                    <th class="amount-col">Amount</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>
                        <strong>${description || (planType + ' — SkillNaav Premium Subscription')}</strong><br/>
                    <span style="color: #6b7280; font-size: 13px;">${descriptionDetail || 'Internship platform premium access: unlimited applications, AI career tools, resume builder, mock interviews &amp; mentorship'}</span>
                    </td>
                    <td class="amount-col">$${amount.toFixed(2)}</td>
                </tr>
            </tbody>
        </table>

        <div class="total-row">
            <div class="total-box">
                <div class="total-line">
                    <span>Subtotal</span>
                    <span>$${amount.toFixed(2)}</span>
                </div>
                <div class="total-line total-final">
                    <span>Total Paid</span>
                    <span>$${amount.toFixed(2)}</span>
                </div>
            </div>
        </div>

        <div class="footer">
            Thank you for choosing SkillNaav. For any queries, please contact us at
            <strong>skillnaav@gmail.com</strong> or visit <strong>skillnaav.com</strong>.<br/>
            &copy; ${new Date().getFullYear()} SkillNaav. All rights reserved.
        </div>
    </body>
    </html>
    `;

    const puppeteerModule = await import("puppeteer");
    const puppeteer = puppeteerModule.default || puppeteerModule;

    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 800, height: 1000, deviceScaleFactor: 2 });
        await page.setContent(htmlContent, { waitUntil: 'networkidle2' });

        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: { top: '0', bottom: '0', left: '0', right: '0' }
        });

        // Use a permitted S3 prefix
        const s3Key = `offer-templates/invoices/invoice-${invoiceId}.pdf`;
        
        const uploadParams = {
            Bucket: AWS_IMAGE_BUCKET,
            Key: s3Key,
            Body: pdfBuffer,
            ContentType: "application/pdf",
        };

        await s3.send(new PutObjectCommand(uploadParams));

        const pdfUrl = `https://${AWS_IMAGE_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${s3Key}`;

        return {
            invoiceId,
            pdfUrl,
            s3Key
        };
    } finally {
        await browser.close();
    }
}

module.exports = {
    generateAndUploadInvoice
};
