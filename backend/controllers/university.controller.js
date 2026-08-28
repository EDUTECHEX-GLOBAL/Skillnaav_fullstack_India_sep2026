// controllers/university.controller.js
const { searchUniversities } = require("../services/university.service");

// ✅ FIX 6: Accepted country values match exactly what the frontend dropdown sends
const ALLOWED_COUNTRIES = ["United States", "Canada"];

exports.getUniversities = async (req, res) => {
  try {
    const { country, query } = req.query;

    // Return empty list for short/missing inputs — not an error
    if (!country || !query || query.trim().length < 2) {
      return res.json([]);
    }

    if (!ALLOWED_COUNTRIES.includes(country)) {
      return res.status(400).json({ message: "Invalid country" });
    }

    const universities = await searchUniversities({
      country,
      query: query.trim(),
    });

    // Limit to 10 results for the dropdown
    res.json(universities.slice(0, 10));
  } catch (error) {
    console.error("University fetch error:", error.message);

    // ✅ FIX 7: Return empty array (not 500) so the UI degrades gracefully —
    //    the user can still type the name manually if the API is unreachable.
    res.status(200).json([]);
  }
};