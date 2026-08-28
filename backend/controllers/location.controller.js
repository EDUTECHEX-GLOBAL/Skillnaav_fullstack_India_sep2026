const { searchCities } = require("../services/geodb.service");

const getCities = async (req, res) => {
  try {
    const { country, query } = req.query;

    if (!country || !query || query.length < 2) {
      return res.status(400).json({ message: "country and query required" });
    }

    const cities = await searchCities({ country, query });

    const normalized = cities.map((c) => ({
      city: c.name,
      state: c.region,
      stateCode: c.regionCode,
    }));

    res.json(normalized);
  } catch (err) {
    console.error("City fetch error:", err.message);
    res.status(500).json({ message: err.message });
  }
};

module.exports = { getCities };
