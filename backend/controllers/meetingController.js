const crypto = require("crypto");
const { google } = require("googleapis");
const TokenModel = require("../models/webapp-models/TokenModel");

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const googleRedirectUri = process.env.GOOGLE_REDIRECT_URI
  || `${String(process.env.SERVER_BASE_URL || "").replace(/\/+$/, "")}/api/google/callback`;

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const getMeetLink = (event = {}) => {
  if (event.hangoutLink) return event.hangoutLink;

  return event.conferenceData?.entryPoints?.find(
    (entryPoint) => entryPoint.entryPointType === "video"
  )?.uri || "";
};

async function getCalendarClient(partnerEmail) {
  const tokenDocument = await TokenModel.findOne({
    email: String(partnerEmail || "").trim().toLowerCase(),
  });
  const usePartnerToken = Boolean(tokenDocument?.tokens);
  const clientId = usePartnerToken
    ? process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CALENDAR_CLIENT_ID
    : process.env.GOOGLE_CALENDAR_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
  const clientSecret = usePartnerToken
    ? process.env.GOOGLE_CLIENT_SECRET || process.env.GOOGLE_CALENDAR_CLIENT_SECRET
    : process.env.GOOGLE_CALENDAR_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Google Calendar credentials are not configured");
  }

  const auth = new google.auth.OAuth2(
    clientId,
    clientSecret,
    googleRedirectUri
  );

  if (usePartnerToken) {
    auth.setCredentials(tokenDocument.tokens);
  } else if (process.env.GOOGLE_REFRESH_TOKEN) {
    auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  } else {
    const error = new Error("Connect a Google Calendar account before creating a meeting link");
    error.statusCode = 409;
    throw error;
  }

  return google.calendar({ version: "v3", auth });
}

function buildCalendarAuthUrl(partnerEmail) {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) return "";

  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    googleRedirectUri
  );
  const state = Buffer.from(JSON.stringify({
    email: String(partnerEmail || "").trim().toLowerCase(),
    purpose: "create-meeting",
  })).toString("base64");

  return auth.generateAuthUrl({
    access_type: "offline",
    prompt: "consent select_account",
    include_granted_scopes: true,
    scope: [
      "openid",
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/calendar",
      "https://www.googleapis.com/auth/calendar.events",
    ],
    state,
  });
}

// POST /api/google/create-meeting
const createMeeting = async (req, res) => {
  const recipientEmail = String(req.body?.recipientEmail || "").trim().toLowerCase();

  if (!emailPattern.test(recipientEmail)) {
    return res.status(400).json({ success: false, message: "Enter a valid partner email address" });
  }

  try {
    const organizerName = req.partner?.name || "SkillNaav Partner";
    const calendar = await getCalendarClient(req.partner?.email);
    const start = new Date(Date.now() + 5 * 60 * 1000);
    const end = new Date(start.getTime() + 60 * 60 * 1000);

    const response = await calendar.events.insert({
      calendarId: "primary",
      conferenceDataVersion: 1,
      sendUpdates: "all",
      requestBody: {
        summary: `SkillNaav meeting with ${organizerName}`,
        description: `${organizerName} invited you to a Google Meet meeting through SkillNaav.`,
        start: { dateTime: start.toISOString() },
        end: { dateTime: end.toISOString() },
        attendees: [{ email: recipientEmail }],
        conferenceData: {
          createRequest: {
            requestId: `skillnaav-${crypto.randomUUID()}`,
            conferenceSolutionKey: { type: "hangoutsMeet" },
          },
        },
      },
    });

    let event = response.data;
    let meetingLink = getMeetLink(event);

    // Conference creation can briefly be pending even after the event is returned.
    for (let attempt = 0; !meetingLink && attempt < 4; attempt += 1) {
      await wait(500);
      const refreshed = await calendar.events.get({
        calendarId: "primary",
        eventId: event.id,
      });
      event = refreshed.data;
      meetingLink = getMeetLink(event);
    }

    if (!meetingLink) {
      return res.status(502).json({
        success: false,
        message: "Google created the calendar event but did not return a Meet link",
      });
    }

    return res.status(201).json({
      success: true,
      meetingLink,
      eventId: event.id,
      invitationSentTo: recipientEmail,
    });
  } catch (error) {
    const googleMessage = error.response?.data?.error?.message;
    console.error("Create Google Meet failed:", googleMessage || error.message);

    const needsGoogleAuth = error.statusCode === 409
      || error.response?.data?.error === "invalid_grant"
      || error.message === "invalid_grant";

    if (needsGoogleAuth) {
      return res.status(409).json({
        success: false,
        code: "GOOGLE_REAUTH_REQUIRED",
        message: "Connect Google Calendar, then create the meeting again",
        authUrl: buildCalendarAuthUrl(req.partner?.email),
      });
    }

    return res.status(error.statusCode || 500).json({
      success: false,
      message: googleMessage || error.message || "Could not create the meeting link",
    });
  }
};

module.exports = { createMeeting, getCalendarClient, buildCalendarAuthUrl };
