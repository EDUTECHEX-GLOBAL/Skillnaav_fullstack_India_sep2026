const cron = require('node-cron');
const InternshipSchedule = require('../models/webapp-models/InternshipScheduleModel');
const Attendance = require('../models/webapp-models/AttendanceModel');
const OfferLetter = require('../models/webapp-models/offerLetterModel');
const { syncMeetAttendanceForSession } = require('./meetAttendanceSync');

// Run every 15 minutes
cron.schedule('*/15 * * * *', async () => {
  console.log('⏳ Running attendance auto-sync cron job...');
  try {
    // Find all non-closed InternshipSchedules where trackingEnabled = true
    const schedules = await InternshipSchedule.find({
      isClosed: false,
      'attendanceSettings.trackingEnabled': true
    });

    const now = new Date();
    const thirtyMinsAgo = new Date(now.getTime() - 30 * 60000);
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60000);

    for (const schedule of schedules) {
      if (!Array.isArray(schedule.timetable)) continue;

      for (const slot of schedule.timetable) {
        if (slot.type === 'online' || slot.type === 'hybrid') {
          if (!slot.date || !slot.endTime) continue;

          // Parse slot end time on that date
          const slotDateStr = new Date(slot.date).toDateString();
          const [hours, mins] = slot.endTime.split(':').map(Number);
          
          const slotEndTime = new Date(slotDateStr);
          slotEndTime.setHours(hours, mins, 0, 0);

          // Check if session ended more than 30 mins ago AND less than 24 hours ago
          if (slotEndTime <= thirtyMinsAgo && slotEndTime >= twentyFourHoursAgo) {
            
            // Check if Attendance records already exist for this slot
            // (if all students already have records, skip)
            const acceptedOffersCount = await OfferLetter.countDocuments({
               internshipId: schedule.internshipId,
               status: 'Accepted'
            });

            const recordsCount = await Attendance.countDocuments({
              internshipId: schedule.internshipId,
              timetableDate: slot.date
            });

            if (recordsCount > 0 && recordsCount >= acceptedOffersCount) {
               continue; // all students already have records, skip
            }

            // Call syncMeetAttendanceForSession
            try {
              console.log(`🔄 Syncing attendance for internship ${schedule.internshipId}, slot ${slot.date}`);
              await syncMeetAttendanceForSession({
                internshipId: schedule.internshipId,
                partnerId: schedule.partnerId,
                timetableSlot: slot
              });
            } catch (err) {
              console.error(`❌ Error syncing attendance for internship ${schedule.internshipId}:`, err);
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('❌ Attendance Cron Job Error:', error);
  }
});
