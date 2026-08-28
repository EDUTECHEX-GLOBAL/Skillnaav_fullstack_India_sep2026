const express = require('express');
const router = express.Router();
const { googleAuth, googleCallback, updateScheduleInGoogleCalendar, getSyncStatus } = require('../../controllers/GoogleController');
const { createMeeting } = require('../../controllers/meetingController');
const { partnerProtect } = require('../../middlewares/Partnerauthmiddleware');

router.get('/auth', googleAuth);
router.get('/callback', googleCallback);
router.post('/update-schedule', updateScheduleInGoogleCalendar);
router.get('/sync-status', getSyncStatus);
router.post('/create-meeting', partnerProtect, createMeeting);

module.exports = router;
