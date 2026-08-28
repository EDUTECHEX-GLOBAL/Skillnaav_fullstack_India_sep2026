//File: customInternshipCertificateRoutes.js

const express = require("express");
const router = express.Router();
const { imageUploader } = require("../../utils/multer");

const {
    getCertificatesByPartner,
    createCertificate,
    deleteCertificate,
} = require("../../controllers/customInternshipCertificateController");

router.get("/:partnerId", getCertificatesByPartner);
router.post(
    "/",
    imageUploader("offer-templates/custom-internship-certificates", 5).single("image"),
    createCertificate
);
router.delete("/:id", deleteCertificate);

module.exports = router;
