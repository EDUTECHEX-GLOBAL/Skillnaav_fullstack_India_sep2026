// services/certificateGenerator.js
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
 * Generate a certificate PDF and upload to S3.
 */
async function generateAndUploadCertificate({
    studentName,
    internshipTitle,
    companyName,
    startDate,
    endDate,
    backgroundImageUrl = '',
    textColor = '#1f2937'
}) {
    const certificateId = crypto.randomUUID();
    const verificationUrl = `${process.env.FRONTEND_URL || 'https://www.skillnaav.com'}/verify/${certificateId}`;
    
    // Format dates safely
    const formatDate = (dateInput) => {
        if (!dateInput) return "—";
        const d = new Date(dateInput);
        if (isNaN(d.getTime())) return "—";
        return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
    };
    
    const formattedStartDate = formatDate(startDate);
    const formattedEndDate = formatDate(endDate);
    const issuedAtStr = formatDate(new Date());

    let base64Image = "";
    if (backgroundImageUrl) {
        try {
            // Fetch the image as buffer to avoid CORS in puppeteer
            // (Assuming Node 18+ native fetch or we can just require node-fetch if needed. Let's use native fetch)
            const response = await globalThis.fetch(backgroundImageUrl);
            if (response.ok) {
                const arrayBuffer = await response.arrayBuffer();
                const buffer = Buffer.from(arrayBuffer);
                const mimeType = response.headers.get("content-type") || "image/png";
                base64Image = `data:${mimeType};base64,${buffer.toString("base64")}`;
            } else {
                console.warn("Failed to fetch certificate background image:", backgroundImageUrl);
            }
        } catch (err) {
            console.error("Error fetching background image for certificate:", err);
        }
    }

    const hasCustomBackground = Boolean(base64Image);

    // Build the HTML strictly matching the frontend CertificateTemplate.js styling
    const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Certificate</title>
        <!-- Import premium fonts -->
        <link href="https://fonts.googleapis.com/css2?family=Great+Vibes&family=Playfair+Display:ital,wght@0,500;0,700;1,500&family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet">
        <style>
            body {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
                font-family: 'Poppins', sans-serif;
            }
            #certificate-content {
                width: 1120px;
                height: 792px;
                position: relative;
                overflow: hidden;
                border: ${hasCustomBackground ? 'none' : '10px solid #4f46e5'};
                border-radius: 12px;
                background-color: #fff;
            }
            .background-img {
                position: absolute;
                inset: 0;
                width: 100%;
                height: 100%;
                object-fit: fill;
                z-index: 1;
            }
            .content-layer {
                position: absolute;
                inset: 0;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                text-align: center;
                padding: ${hasCustomBackground ? '90px 100px' : '60px 80px'};
                color: ${textColor};
                text-shadow: ${hasCustomBackground ? '0 1px 3px rgba(255,255,255,0.9), 0 2px 10px rgba(255,255,255,0.7)' : 'none'};
                z-index: 2;
            }
            h1 {
                font-family: 'Playfair Display', serif;
                font-size: 3.2rem;
                font-weight: 700;
                letter-spacing: 2px;
                text-transform: uppercase;
                margin: 0 0 15px 0;
                color: ${textColor};
            }
            .certify-text {
                font-family: 'Great Vibes', cursive;
                font-size: 2.2rem;
                margin: 0 0 35px 0;
                color: ${textColor};
                opacity: 0.9;
            }
            h2 {
                font-family: 'Playfair Display', serif;
                font-size: 3rem;
                font-style: italic;
                font-weight: 700;
                margin: 0 0 45px 0;
                color: ${textColor};
                border-bottom: 2px solid ${textColor};
                padding-bottom: 5px;
                display: inline-block;
                min-width: 400px;
            }
            .completed-text {
                font-family: 'Poppins', sans-serif;
                font-size: 1.4rem;
                font-weight: 600;
                margin: 0;
                text-transform: uppercase;
                letter-spacing: 3px;
                color: ${textColor};
            }
            .details-text {
                font-family: 'Poppins', sans-serif;
                font-size: 1.25rem;
                margin: 15px 0 0 0;
                font-weight: 400;
                color: ${textColor};
                opacity: 0.9;
            }
            .dates-text {
                font-family: 'Poppins', sans-serif;
                font-size: 1.1rem;
                margin: 15px 0 0 0;
                font-weight: 500;
                color: ${textColor};
                opacity: 0.8;
            }
            .verification-box {
                position: absolute;
                bottom: 35px;
                left: 45px;
                text-align: left;
                font-size: 0.75rem;
                color: ${textColor};
                font-family: monospace;
                background: ${hasCustomBackground ? 'rgba(255,255,255,0.85)' : 'transparent'};
                padding: 12px;
                border-radius: 8px;
                box-shadow: ${hasCustomBackground ? '0 2px 8px rgba(0,0,0,0.05)' : 'none'};
                line-height: 1.6;
            }
        </style>
    </head>
    <body>
        <div id="certificate-content">
            ${hasCustomBackground ? `<img src="${base64Image}" class="background-img" alt="" />` : ''}
            
            <div class="content-layer">
                <h1>Certificate of Internship</h1>
                <p class="certify-text">This is to proudly certify that</p>
                <h2>${studentName || "Student Name"}</h2>
                <p class="completed-text">Internship Completed</p>
                
                <p class="details-text">${internshipTitle} at ${companyName}</p>
                <p class="dates-text">${formattedStartDate} — ${formattedEndDate}</p>

                <div class="verification-box">
                    Certificate ID: ${certificateId}<br/>
                    Verify at: ${verificationUrl}<br/>
                    Issued: ${issuedAtStr}
                </div>
            </div>
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
        await page.setViewport({ width: 1120, height: 792, deviceScaleFactor: 2 });
        await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

        const pdfBuffer = await page.pdf({
            width: '1120px',
            height: '792px',
            printBackground: true,
            pageRanges: '1'
        });

        // Use a permitted S3 prefix (based on existing IAM policies)
        const s3Key = `offer-templates/custom-internship-certificates/issued-${certificateId}.pdf`;
        
        const uploadParams = {
            Bucket: AWS_IMAGE_BUCKET,
            Key: s3Key,
            Body: pdfBuffer,
            ContentType: "application/pdf",
        };

        await s3.send(new PutObjectCommand(uploadParams));

        const pdfUrl = `https://${AWS_IMAGE_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${s3Key}`;

        return {
            certificateId,
            pdfUrl,
            s3Key
        };
    } finally {
        await browser.close();
    }
}

module.exports = {
    generateAndUploadCertificate
};
