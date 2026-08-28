// routes/webapp-routes/imageProxyRoutes.js
// Proxies GET requests for S3-hosted images through the Express server.
// This completely eliminates the S3 CORS problem for images used in
// canvas/html2canvas/certificate rendering, because the browser fetches
// from the same origin (localhost:5000 → S3 → back to browser).
//
// Usage:
//   GET /api/image-proxy?url=https://skillnaavres.s3.us-west-1.amazonaws.com/...
//
// The frontend replaces direct S3 URLs with this proxy URL.

const express = require("express");
const router = express.Router();
const axios = require("axios");
const { URL } = require("url");

// Allowed S3 buckets (whitelist to prevent open-redirect abuse)
const ALLOWED_HOSTS = [
  "skillnaavres.s3.us-west-1.amazonaws.com",
  "skillnaavres.s3.amazonaws.com",
  `${process.env.AWS_IMAGE_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com`,
  `${process.env.AWS_RESUME_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com`,
].filter(Boolean);

router.get("/", async (req, res) => {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: "Missing url query parameter" });
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch {
    return res.status(400).json({ error: "Invalid URL" });
  }

  // Security: only proxy from known S3 buckets
  const isAllowed = ALLOWED_HOSTS.some(
    (host) => host && parsedUrl.hostname === host
  );
  if (!isAllowed) {
    return res.status(403).json({ error: "URL host not allowed" });
  }

  try {
    const response = await axios.get(url, {
      responseType: "stream",
      timeout: 15000,
      headers: {
        // Forward a browser-like Accept header
        Accept: "image/webp,image/apng,image/*,*/*;q=0.8",
      },
    });

    // Forward content-type so the browser renders it correctly
    res.setHeader(
      "Content-Type",
      response.headers["content-type"] || "image/jpeg"
    );
    // Allow the frontend to use it in canvas / html2canvas
    res.setHeader("Access-Control-Allow-Origin", "*");
    // Cache for 1 hour to avoid repeated S3 fetches
    res.setHeader("Cache-Control", "public, max-age=3600");

    response.data.pipe(res);
  } catch (err) {
    console.error("Image proxy error:", err.message);
    res.status(502).json({ error: "Failed to fetch image from S3" });
  }
});

module.exports = router;
