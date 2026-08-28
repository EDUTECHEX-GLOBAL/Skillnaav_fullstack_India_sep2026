// File: routes/cityRoutes.js

const express = require("express");
const { searchCities } = require("../../services/geodb.service");

const router = express.Router();

// GET /api/cities?namePrefix=montr&countryIds=CA
router.get("/", async (req, res) => {
  const { namePrefix, countryIds } = req.query;

  if (!namePrefix || namePrefix.trim().length < 2) {
    return res.status(400).json({ error: "namePrefix must be at least 2 characters" });
  }

  try {
    const cities = await searchCities({
      query: namePrefix.trim(),
      country: countryIds === "CA" ? "Canada" : "United States",
    });

    // Return in the same shape the frontend expects: { data: [...] }
    return res.json({ data: cities });
  } catch (err) {
    console.error("City route error:", err.message);
    return res.status(500).json({ error: "City lookup failed" });
  }
});

module.exports = router;