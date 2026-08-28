const { google } = require('googleapis');
const TokenModel = require('../models/webapp-models/TokenModel');
const Attendance = require('../models/webapp-models/AttendanceModel');
const OfferLetter = require('../models/webapp-models/offerLetterModel');
const InternshipSchedule = require('../models/webapp-models/InternshipScheduleModel');
const { upsertOnlineAttendance } = require('../controllers/attendanceController');

async function syncMeetAttendanceForSession({ internshipId, partnerId, timetableSlot }) {
  const schedule = await InternshipSchedule.findOne({ internshipId, partnerId });
  if (!schedule) return;

  const minDuration = schedule.attendanceSettings?.onlineMinDurationMins ?? 0;

  // Extract Google Meet space ID from eventLink
  // eventLink format: https://meet.google.com/abc-defg-hij
  const meetCode = timetableSlot.eventLink?.split('/').pop(); // "abc-defg-hij"
  if (!meetCode) return;

  // Get partner's Google token to call Meet API
  const partnerToken = await TokenModel.findOne({ partnerId });
  if (!partnerToken?.tokens) return;

  const auth = new google.auth.OAuth2();
  auth.setCredentials(partnerToken.tokens);
  const meetClient = google.meet({ version: 'v2', auth });

  // List participants from the conference
  const spaceName = `spaces/${meetCode}`;
  const conferencesResp = await meetClient.spaces.conferences.list({ parent: spaceName });
  const conferences = conferencesResp.data.conferences || [];
  if (!conferences.length) return;

  const conferenceId = conferences[0].name; // take most recent conference
  const participantsResp = await meetClient.spaces.conferences.participants.list({
    parent: conferenceId
  });
  const participants = participantsResp.data.participants || [];

  // Get all accepted students for this internship
  const acceptedOffers = await OfferLetter.find({ internshipId, status: 'Accepted' });
  const emailToStudentId = {};
  for (const o of acceptedOffers) {
    emailToStudentId[o.email.toLowerCase()] = o.studentId;
  }

  for (const participant of participants) {
    const email = participant.signedinUser?.displayName; // or use email field
    const studentId = emailToStudentId[email?.toLowerCase()];
    if (!studentId) continue;

    const joinTime = new Date(participant.earliestStartTime);
    const leaveTime = new Date(participant.latestEndTime);
    const durationMins = Math.round((leaveTime - joinTime) / 60000);
    const meetsThreshold = durationMins >= minDuration;

    await upsertOnlineAttendance({
      internshipId,
      scheduleId: schedule._id,
      partnerId,
      studentId,
      timetableDate: timetableSlot.date,
      sessionType: timetableSlot.type,
      joined: true,
      joinedAt: joinTime,
      leftAt: leaveTime,
      durationMins,
      minDurationMins: minDuration
    });
  }
}

module.exports = { syncMeetAttendanceForSession };