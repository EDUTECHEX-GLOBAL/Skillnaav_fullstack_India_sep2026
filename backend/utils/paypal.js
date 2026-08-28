// utils/paypal.js
// FIX: Cache the access token for its TTL to avoid a full OAuth round-trip
// on every single payment request. PayPal tokens typically live for 32400s (9h).
const axios = require("axios");

let _cachedToken = null;
let _tokenExpiresAt = 0;

const getAccessToken = async () => {
  const now = Date.now();

  // Return cached token if it still has more than 60 seconds left
  if (_cachedToken && _tokenExpiresAt - now > 60_000) {
    return _cachedToken;
  }

  const response = await axios({
    method: "post",
    url: `${process.env.PAYPAL_API}/v1/oauth2/token`,
    auth: {
      username: process.env.PAYPAL_CLIENT_ID,
      password: process.env.PAYPAL_CLIENT_SECRET,
    },
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    data: "grant_type=client_credentials",
  });

  _cachedToken = response.data.access_token;
  // expires_in is in seconds; convert to ms and store absolute timestamp
  _tokenExpiresAt = now + (response.data.expires_in || 32400) * 1000;

  return _cachedToken;
};

module.exports = { getAccessToken };