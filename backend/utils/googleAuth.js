let oauth2Client;

async function getOAuthClient() {
  if (oauth2Client) return oauth2Client;

  const { google } = await import("googleapis");

  oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CALENDAR_CLIENT_ID,
    process.env.GOOGLE_CALENDAR_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
  });

  return oauth2Client;
}

module.exports = getOAuthClient;
