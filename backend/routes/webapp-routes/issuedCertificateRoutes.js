// routes/webapp-routes/issuedCertificateRoutes.js
const express = require('express');
const router = express.Router();
const { getMyCertificates, verifyCertificate } = require('../../controllers/issuedCertificateController');
const { authenticate } = require('../../middlewares/authMiddleware');

// Get my certificates (protected route for students)
router.get('/my-certificates', authenticate, getMyCertificates);

// Verify a certificate (public route)
router.get('/verify/:certificateId', verifyCertificate);

module.exports = router;
