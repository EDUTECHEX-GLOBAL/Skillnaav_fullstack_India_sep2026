const express = require("express");
const router = express.Router();

const {
    getAllCertificates,
    updateCertificateStatus
} = require("../../controllers/adminCertificateController");

router.get("/", getAllCertificates);
router.put("/:id/status", updateCertificateStatus);

module.exports = router;
