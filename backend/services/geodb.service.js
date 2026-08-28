const axios = require("axios");

const GEODB_URL = "https://wft-geo-db.p.rapidapi.com/v1/geo/cities";

const FALLBACK_CITIES = {
  "United States": [
    { name: "New York", region: "New York", regionCode: "NY" },
    { name: "Los Angeles", region: "California", regionCode: "CA" },
    { name: "Chicago", region: "Illinois", regionCode: "IL" },
    { name: "Houston", region: "Texas", regionCode: "TX" },
    { name: "Phoenix", region: "Arizona", regionCode: "AZ" },
    { name: "Philadelphia", region: "Pennsylvania", regionCode: "PA" },
    { name: "San Antonio", region: "Texas", regionCode: "TX" },
    { name: "San Diego", region: "California", regionCode: "CA" },
    { name: "Dallas", region: "Texas", regionCode: "TX" },
    { name: "San Jose", region: "California", regionCode: "CA" },
    { name: "Austin", region: "Texas", regionCode: "TX" },
    { name: "Jacksonville", region: "Florida", regionCode: "FL" },
    { name: "San Francisco", region: "California", regionCode: "CA" },
    { name: "Columbus", region: "Ohio", regionCode: "OH" },
    { name: "Indianapolis", region: "Indiana", regionCode: "IN" },
    { name: "Charlotte", region: "North Carolina", regionCode: "NC" },
    { name: "Seattle", region: "Washington", regionCode: "WA" },
    { name: "Denver", region: "Colorado", regionCode: "CO" },
    { name: "Boston", region: "Massachusetts", regionCode: "MA" },
    { name: "Nashville", region: "Tennessee", regionCode: "TN" },
  ],
  Canada: [
    { name: "Toronto", region: "Ontario", regionCode: "ON" },
    { name: "Montreal", region: "Quebec", regionCode: "QC" },
    { name: "Vancouver", region: "British Columbia", regionCode: "BC" },
    { name: "Calgary", region: "Alberta", regionCode: "AB" },
    { name: "Edmonton", region: "Alberta", regionCode: "AB" },
    { name: "Ottawa", region: "Ontario", regionCode: "ON" },
    { name: "Winnipeg", region: "Manitoba", regionCode: "MB" },
    { name: "Quebec City", region: "Quebec", regionCode: "QC" },
    { name: "Hamilton", region: "Ontario", regionCode: "ON" },
    { name: "Kitchener", region: "Ontario", regionCode: "ON" },
    { name: "London", region: "Ontario", regionCode: "ON" },
    { name: "Halifax", region: "Nova Scotia", regionCode: "NS" },
    { name: "Victoria", region: "British Columbia", regionCode: "BC" },
    { name: "Saskatoon", region: "Saskatchewan", regionCode: "SK" },
    { name: "Regina", region: "Saskatchewan", regionCode: "SK" },
  ],
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
  const countryIds = country === "Canada" ? "CA" : "US";

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
