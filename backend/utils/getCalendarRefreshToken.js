require("dotenv").config(); 
const { google } = require("googleapis");
const readline = require("readline");

const oAuth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CALENDAR_CLIENT_ID,
  process.env.GOOGLE_CALENDAR_CLIENT_SECRET,
  "http://localhost:3000"             // ← MUST MATCH GOOGLE CONSOLE
);

const SCOPES = ["https://www.googleapis.com/auth/calendar"];

const authUrl = oAuth2Client.generateAuthUrl({
  access_type: "offline",
  scope: SCOPES,
  prompt: "consent",
});

console.log(authUrl);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question("Paste code: ", async (code) => {
  const { tokens } = await oAuth2Client.getToken(code);
  console.log("REFRESH TOKEN:", tokens.refresh_token);
  rl.close();
});
