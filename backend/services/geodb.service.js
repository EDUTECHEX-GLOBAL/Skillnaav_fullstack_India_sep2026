const axios = require("axios");

const GEODB_URL = "https://wft-geo-db.p.rapidapi.com/v1/geo/cities";

const FALLBACK_CITIES = {
  "India": [
    { name: "Mumbai", region: "Maharashtra", regionCode: "MH" },
    { name: "Delhi", region: "Delhi", regionCode: "DL" },
    { name: "Bengaluru", region: "Karnataka", regionCode: "KA" },
    { name: "Hyderabad", region: "Telangana", regionCode: "TS" },
    { name: "Chennai", region: "Tamil Nadu", regionCode: "TN" },
    { name: "Kolkata", region: "West Bengal", regionCode: "WB" },
    { name: "Pune", region: "Maharashtra", regionCode: "MH" },
    { name: "Ahmedabad", region: "Gujarat", regionCode: "GJ" },
    { name: "Jaipur", region: "Rajasthan", regionCode: "RJ" },
    { name: "Surat", region: "Gujarat", regionCode: "GJ" }
  ]
};

const fallbackCitySearch = ({ country, query }) => {
  const source = FALLBACK_CITIES[country] || [];
  const q = (query || "").trim().toLowerCase();
  if (!q) return [];
  return source
    .filter((city) => city.name.toLowerCase().includes(q))
    .slice(0, 10);
};

const searchCities = async ({ country, query }) => {
  const countryIds = "IN";

  if (!process.env.GEODB_API_KEY) {
    return fallbackCitySearch({ country, query });
  }

  try {
    const response = await axios.get(GEODB_URL, {
      params: {
        namePrefix: query,
        limit: 10,
        minPopulation: 100000,
        countryIds,
      },
      headers: {
        "X-RapidAPI-Key": process.env.GEODB_API_KEY,
        "X-RapidAPI-Host": "wft-geo-db.p.rapidapi.com",
      },
      timeout: 5000,
    });

    return response.data.data;
  } catch (error) {
    return fallbackCitySearch({ country, query });
  }
};

module.exports = { searchCities };
