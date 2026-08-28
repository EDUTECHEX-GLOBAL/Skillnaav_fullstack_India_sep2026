// utils/applyS3Cors.js
// Applies the required CORS rules to the S3 image bucket so that browsers
// (localhost:3000, production frontend) can load images with crossOrigin="anonymous".
// Called once on server startup — safe to run on every deploy.

const { S3Client, PutBucketCorsCommand } = require("@aws-sdk/client-s3");
require("dotenv").config();

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const applyS3Cors = async () => {
  const bucket = process.env.AWS_IMAGE_BUCKET;
  if (!bucket) {
    console.warn("⚠️  AWS_IMAGE_BUCKET not set — skipping S3 CORS setup");
    return;
  }

  const allowedOrigins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    process.env.FRONTEND_BASE_URL,
    process.env.FRONTEND_BASE_URL_2,
    process.env.FRONTEND_BASE_URL_3,
  ].filter(Boolean);

  try {
    await s3.send(
      new PutBucketCorsCommand({
        Bucket: bucket,
        CORSConfiguration: {
          CORSRules: [
            {
              AllowedHeaders: ["*"],
              AllowedMethods: ["GET", "HEAD"],
              AllowedOrigins: allowedOrigins,
              ExposeHeaders: ["ETag"],
              MaxAgeSeconds: 3600,
            },
          ],
        },
      })
    );
    console.log(`✅ S3 CORS applied to bucket "${bucket}" for origins:`, allowedOrigins);
  } catch (err) {
    console.error("❌ Failed to apply S3 CORS rules:", err.message);
  }
};

module.exports = { applyS3Cors };
