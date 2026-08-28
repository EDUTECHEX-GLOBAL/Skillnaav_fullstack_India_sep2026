const express = require("express");
const router = express.Router();

// ✅ FIXED PATHS (../../)
const { getCities } = require("../../controllers/location.controller");
const { getUniversities } = require("../../controllers/university.controller");

// Routes
router.get("/cities", getCities);
router.get("/universities", getUniversities);

module.exports = router;
