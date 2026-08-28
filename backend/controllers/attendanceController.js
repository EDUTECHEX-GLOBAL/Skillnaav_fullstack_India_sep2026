// controllers/attendanceController.js

const Attendance           = require('../models/webapp-models/AttendanceModel');
const InternshipSchedule   = require('../models/webapp-models/InternshipScheduleModel');
const OfferLetter          = require('../models/webapp-models/offerLetterModel');
const Userwebapp           = require('../models/webapp-models/userModel');
const IssuedCertificate    = require('../models/webapp-models/issuedCertificateModel');
const moment               = require('moment');

// ─────────────────────────────────────────────────────────────────────────────
// HELPER — resolve isPresent based on session type
// ─────────────────────────────────────────────────────────────────────────────
function resolveIsPresent(record) {
  const type = record.sessionType;

  if (type === 'online') {
    return record.onlineAttendance?.meetsThreshold === true;
  }

  if (type === 'offline') {
    return record.offlineAttendance?.markedPresent === true;
  }

  if (type === 'hybrid') {
    // Both portions must be satisfied
    return (
      record.onlineAttendance?.meetsThreshold === true &&
      record.offlineAttendance?.markedPresent === true
    );
  }

  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// PARTNER — Mark offline attendance for a session
// POST /api/attendance/mark-offline
// Body: { internshipId, partnerId, timetableDate, students: [{ studentId, isPresent }] }
// ─────────────────────────────────────────────────────────────────────────────
const markOfflineAttendance = async (req, res) => {
  try {
    const { internshipId, partnerId, timetableDate, students } = req.body;

    if (!internshipId || !partnerId || !timetableDate || !Array.isArray(students)) {
      return res.status(400).json({
        success: false,
        message: 'internshipId, partnerId, timetableDate and students[] are required.'
      });
    }

    const schedule = await InternshipSchedule.findOne({ internshipId, partnerId });
    if (!schedule) {
      return res.status(404).json({ success: false, message: 'Schedule not found.' });
    }
    if (schedule.isClosed) {
      return res.status(403).json({ success: false, message: 'This internship schedule is closed. Attendance records are locked and cannot be modified.' });
    }

    // Find the matching timetable slot to get session type
    const sessionDate = new Date(timetableDate);
    const slot = schedule.timetable.find(
      (t) => new Date(t.date).toDateString() === sessionDate.toDateString()
    );
    const sessionType = slot?.type || 'offline';

    const results = [];

    for (const { studentId, isPresent } of students) {
      if (!studentId) continue;

      const existing = await Attendance.findOne({ internshipId, studentId, timetableDate: sessionDate });

      let finalIsPresent = isPresent;
      let resolvedBy = 'manual';

      if (existing?.resolvedBy === 'override') {
        results.push({ studentId, isPresent: existing.isPresent, skipped: true, reason: 'overridden' });
        continue;
      }

      // For hybrid: offline portion marked here, but check if online portion already done
      if (sessionType === 'hybrid' && existing?.onlineAttendance?.meetsThreshold === true) {
        finalIsPresent = isPresent; // both needed; online already passed
      }

      const updated = await Attendance.findOneAndUpdate(
        { internshipId, studentId, timetableDate: sessionDate },
        {
          $set: {
            scheduleId: schedule._id,
            partnerId,
            sessionType,
            'offlineAttendance.markedPresent': isPresent,
            'offlineAttendance.markedBy':      partnerId,
            'offlineAttendance.markedAt':      new Date(),
            resolvedBy
          }
        },
        { upsert: true, new: true }
      );

      // Recalculate isPresent after update
      updated.isPresent = resolveIsPresent(updated);
      await updated.save();

      results.push({ studentId, isPresent: updated.isPresent });
    }

    return res.status(200).json({ success: true, results });

  } catch (error) {
    console.error('markOfflineAttendance error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PARTNER — Override any attendance record (correct mistakes)
// PATCH /api/attendance/override
// Body: { internshipId, studentId, timetableDate, isPresent, reason }
// ─────────────────────────────────────────────────────────────────────────────
const overrideAttendance = async (req, res) => {
  try {
    const { internshipId, studentId, timetableDate, isPresent, reason, partnerId } = req.body;
    const resolvedPartnerId = req.user?._id || partnerId;

    if (!internshipId || !studentId || !timetableDate || isPresent === undefined || !resolvedPartnerId) {
      return res.status(400).json({
        success: false,
        message: 'internshipId, studentId, timetableDate, partnerId, and isPresent are required.'
      });
    }

    const schedule = await InternshipSchedule.findOne({ internshipId, partnerId: resolvedPartnerId });
    if (!schedule) {
      return res.status(404).json({ success: false, message: 'Schedule not found.' });
    }
    if (schedule.isClosed) {
      return res.status(403).json({ success: false, message: 'This internship schedule is closed. Attendance records cannot be overridden after the schedule is closed.' });
    }

    let slot = schedule.timetable.find(s => new Date(s.date).toDateString() === new Date(timetableDate).toDateString());
    if (!slot && schedule.batches) {
      for (const batch of schedule.batches) {
        slot = batch.timetable.find(s => new Date(s.date).toDateString() === new Date(timetableDate).toDateString());
        if (slot) break;
      }
    }

    const sessionType = slot?.type || slot?.sessionType || 'offline';

    const record = await Attendance.findOneAndUpdate(
      { internshipId, studentId, timetableDate: new Date(timetableDate) },
      {
        $set: {
          scheduleId: schedule._id,
          partnerId: resolvedPartnerId,
          sessionType,
          isPresent,
          resolvedBy:     'override',
          overriddenBy:   resolvedPartnerId,
          overrideReason: reason || ''
        }
      },
      { new: true, upsert: true }
    );

    return res.status(200).json({ success: true, record });

  } catch (error) {
    console.error('overrideAttendance error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};


// ─────────────────────────────────────────────────────────────────────────────
// PARTNER — Full attendance dashboard for an internship
// GET /api/attendance/dashboard/:internshipId?partnerId=xxx
// Returns per-student summary with per-session breakdown
// ─────────────────────────────────────────────────────────────────────────────
const getAttendanceDashboard = async (req, res) => {
  try {
    const { internshipId } = req.params;
    const partnerId = req.query.partnerId || req.user?._id;

    if (!internshipId) {
      return res.status(400).json({ success: false, message: 'internshipId is required.' });
    }

    // Load schedule to know total sessions and attendance settings
    const schedule = await InternshipSchedule.findOne({ internshipId, partnerId });
    if (!schedule) {
      return res.status(404).json({ success: false, message: 'Schedule not found.' });
    }

    let activeTimetable = schedule.timetable;
    const isBatchSchedule = Array.isArray(schedule.batches) && schedule.batches.length > 0;
    if ((!activeTimetable || activeTimetable.length === 0) && isBatchSchedule) {
      activeTimetable = schedule.batches
        .flatMap(batch => batch.timetable || [])
        .sort((a, b) => {
          const dateCompare = new Date(a.date) - new Date(b.date);
          if (dateCompare !== 0) return dateCompare;
          return a.startTime.localeCompare(b.startTime); // sort by time within same day
        });
    }

    const minPercent        = schedule.attendanceSettings?.minAttendancePercent ?? 80;
    const totalSessions     = activeTimetable.length;

    // Get all accepted students for this internship
    const acceptedOffers = await OfferLetter.find({ internshipId, status: 'Accepted' });
    if (!acceptedOffers.length) {
      return res.status(200).json({
        success: true,
        internshipId,
        totalSessions,
        minAttendancePercent: minPercent,
        isBatchSchedule,
        defaultTimeSlot: schedule.defaultStartTime && schedule.defaultEndTime
          ? `${schedule.defaultStartTime} - ${schedule.defaultEndTime}`
          : null,
        timetable: activeTimetable,
        students: []
      });
    }

    const studentIds = acceptedOffers.map((o) => o.studentId);
    const offerMap = {};
    for (const o of acceptedOffers) offerMap[String(o.studentId)] = o.preferredTimeSlot;

    // Fetch issued certificates for this internship to show certificate status per student
    const issuedCerts = await IssuedCertificate.find({ internshipId }).lean();
    const certMap = {};
    for (const c of issuedCerts) {
      certMap[String(c.studentId)] = {
        certificateId: c.certificateId,
        pdfUrl:        c.pdfUrl,
        issuedAt:      c.issuedAt
      };
    }

    // Fetch all student user records for names/emails
    const users = await Userwebapp.find({ _id: { $in: studentIds } }).select('name email');
    const userMap = {};
    for (const u of users) userMap[String(u._id)] = u;

    // Fetch all attendance records for this internship
    const allRecords = await Attendance.find({ internshipId, studentId: { $in: studentIds } })
      .sort({ timetableDate: 1 })
      .lean();

    // Group records by studentId
    const recordsByStudent = {};
    for (const r of allRecords) {
      const sid = String(r.studentId);
      if (!recordsByStudent[sid]) recordsByStudent[sid] = [];
      recordsByStudent[sid].push(r);
    }

    const students = studentIds.map((sid) => {
      const sidStr   = String(sid);
      const user     = userMap[sidStr];
      const records  = recordsByStudent[sidStr] || [];
      const studentBatch = offerMap[sidStr] || null;

      // Filter timetable to only this student's batch slots
      // If schedule uses batches, find the student's specific batch
      let studentTimetable = activeTimetable;
      if (schedule.batches && schedule.batches.length > 0 && studentBatch) {
        const matchedBatch = schedule.batches.find(b => b.timeSlot === studentBatch);
        if (matchedBatch && matchedBatch.timetable && matchedBatch.timetable.length > 0) {
          studentTimetable = matchedBatch.timetable;
        }
      }

      const studentTotalSessions = studentTimetable.length;
      const attended = records.filter((r) => r.isPresent).length;
      const absent   = studentTotalSessions - attended;
      const percent  = studentTotalSessions > 0 ? Math.round((attended / studentTotalSessions) * 100) : 0;
      const eligible = percent >= minPercent;

      // Per-session breakdown — only sessions from the student's own batch
      const sessions = studentTimetable.map((slot) => {
        const slotDate = new Date(slot.date).toDateString();
        const record   = records.find(
          (r) => new Date(r.timetableDate).toDateString() === slotDate
        );

        return {
          date:          slot.date,
          day:           slot.day,
          startTime:     slot.startTime,
          endTime:       slot.endTime,
          sessionType:   slot.type,
          isPresent:     record?.isPresent ?? null,
          resolvedBy:    record?.resolvedBy ?? null,
          durationMins:  record?.onlineAttendance?.durationMins ?? null,
          overridden:    record?.resolvedBy === 'override',
          overrideReason: record?.overrideReason ?? null
        };
      });

      const cert = certMap[sidStr] || null;

      return {
        studentId: sidStr,
        name:      user?.name  || 'Unknown',
        email:     user?.email || 'Unknown',
        batch:     studentBatch || 'Unassigned',
        attended,
        absent,
        percent,
        eligible,
        sessions,
        certificateIssued:   !!cert,
        certificateId:       cert?.certificateId  || null,
        certificatePdfUrl:   cert?.pdfUrl         || null,
        certificateIssuedAt: cert?.issuedAt       || null
      };
    });

    // Serialize timetable explicitly so sessionOtp is never stripped by Mongoose
    const timetableOutput = activeTimetable.map(slot => ({
      date:        slot.date,
      day:         slot.day,
      startTime:   slot.startTime,
      endTime:     slot.endTime,
      type:        slot.type || slot.sessionType || 'online',
      eventLink:   slot.eventLink || null,
      location:    slot.location || null,
      sectionSummary: slot.sectionSummary || '',
      instructor:  slot.instructor || '',
      sessionOtp:  slot.sessionOtp
        ? {
            code:        slot.sessionOtp.code,
            isActive:    slot.sessionOtp.isActive,
            expiresAt:   slot.sessionOtp.expiresAt,
            generatedAt: slot.sessionOtp.generatedAt
          }
        : null
    }));

    // ── Per-batch certificate summary for the partner header ─────────────────
    let batchCertSummary = [];
    if (schedule.batches && schedule.batches.length > 0) {
      const batchKeys = [...new Set(students.map(s => s.batch))];
      batchCertSummary = batchKeys.map(batchKey => {
        const batchStudents = students.filter(s => s.batch === batchKey);
        return {
          batch:            batchKey,
          total:            batchStudents.length,
          eligible:         batchStudents.filter(s => s.eligible).length,
          certified:        batchStudents.filter(s => s.certificateIssued).length
        };
      });
    } else {
      batchCertSummary = [{
        batch:     'All Students',
        total:     students.length,
        eligible:  students.filter(s => s.eligible).length,
        certified: students.filter(s => s.certificateIssued).length
      }];
    }

    return res.status(200).json({
      success: true,
      internshipId,
      totalSessions,
      minAttendancePercent: minPercent,
      onlineMinDurationMins: schedule.attendanceSettings?.onlineMinDurationMins ?? 0,
      isScheduleClosed: schedule.isClosed === true,
      isBatchSchedule,
      defaultTimeSlot: schedule.defaultStartTime && schedule.defaultEndTime
        ? `${schedule.defaultStartTime} - ${schedule.defaultEndTime}`
        : null,
      batchCertSummary,
      timetable: timetableOutput,
      students
    });

  } catch (error) {
    console.error('getAttendanceDashboard error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// STUDENT — View own attendance for an internship
// GET /api/attendance/my/:internshipId
// ─────────────────────────────────────────────────────────────────────────────
const getMyAttendance = async (req, res) => {
  try {
    const { internshipId } = req.params;
    const studentId        = req.user?._id;

    if (!studentId) {
      return res.status(401).json({ success: false, message: 'Unauthorized.' });
    }

    const schedule = await InternshipSchedule.findOne({ internshipId });
    if (!schedule) {
      return res.status(404).json({ success: false, message: 'Schedule not found.' });
    }

    // Look up the student's preferred time slot (the batch they chose when accepting the offer)
    const offerLetter = await OfferLetter.findOne({ internshipId, studentId, status: 'Accepted' }).lean();
    const preferredTimeSlot = offerLetter?.preferredTimeSlot || null;

    let activeTimetable = schedule.timetable;
    if ((!activeTimetable || activeTimetable.length === 0) && schedule.batches && schedule.batches.length > 0) {
      if (preferredTimeSlot) {
        // Only show the batch the student selected
        const matchedBatch = schedule.batches.find(b => b.timeSlot === preferredTimeSlot);
        activeTimetable = (matchedBatch?.timetable || []).sort((a, b) => {
          const dateCompare = new Date(a.date) - new Date(b.date);
          if (dateCompare !== 0) return dateCompare;
          return a.startTime.localeCompare(b.startTime);
        });
      } else {
        // Fallback: merge all batches (no slot assigned yet)
        activeTimetable = schedule.batches
          .flatMap(batch => batch.timetable || [])
          .sort((a, b) => {
            const dateCompare = new Date(a.date) - new Date(b.date);
            if (dateCompare !== 0) return dateCompare;
            return a.startTime.localeCompare(b.startTime);
          });
      }
    }

    const minPercent    = schedule.attendanceSettings?.minAttendancePercent ?? 80;
    const totalSessions = activeTimetable.length;

    const records = await Attendance.find({ internshipId, studentId }).sort({ timetableDate: 1 }).lean();

    const attended = records.filter((r) => r.isPresent).length;
    const percent  = totalSessions > 0 ? Math.round((attended / totalSessions) * 100) : 0;
    const eligible = percent >= minPercent;

    // Check if a certificate was issued for this student
    const issuedCert = await IssuedCertificate.findOne({ internshipId, studentId }).lean();

    const sessions = activeTimetable.map((slot) => {
      const slotDate = new Date(slot.date).toDateString();
      const record   = records.find(
        (r) => new Date(r.timetableDate).toDateString() === slotDate
      );

      return {
        date:        slot.date,
        day:         slot.day,
        sessionType: slot.type,
        startTime:   slot.startTime,
        endTime:     slot.endTime,
        isPresent:   record?.isPresent ?? null,
        durationMins: record?.onlineAttendance?.durationMins ?? null,
        resolvedBy:  record?.resolvedBy ?? null
      };
    });

    return res.status(200).json({
      success: true,
      internshipId,
      totalSessions,
      attended,
      absent:    totalSessions - attended,
      percent,
      eligible,
      minAttendancePercent: minPercent,
      isScheduleClosed: schedule.isClosed === true,
      certificateIssued:   !!issuedCert,
      certificatePdfUrl:   issuedCert?.pdfUrl || null,
      certificateId:       issuedCert?.certificateId || null,
      sessions
    });

  } catch (error) {
    console.error('getMyAttendance error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PARTNER — Update attendance settings for an internship schedule
// PATCH /api/attendance/settings
// Body: { internshipId, partnerId, minAttendancePercent, onlineMinDurationMins, trackingEnabled }
// ─────────────────────────────────────────────────────────────────────────────
const updateAttendanceSettings = async (req, res) => {
  try {
    const { internshipId, partnerId, minAttendancePercent, onlineMinDurationMins, trackingEnabled } = req.body;

    if (!internshipId || !partnerId) {
      return res.status(400).json({ success: false, message: 'internshipId and partnerId are required.' });
    }

    const existingSchedule = await InternshipSchedule.findOne({ internshipId, partnerId });
    if (existingSchedule?.isClosed) {
      return res.status(403).json({ success: false, message: 'This internship schedule is closed. Settings cannot be changed.' });
    }

    const update = {};
    if (minAttendancePercent  !== undefined) update['attendanceSettings.minAttendancePercent']  = minAttendancePercent;
    if (onlineMinDurationMins !== undefined) update['attendanceSettings.onlineMinDurationMins'] = onlineMinDurationMins;
    if (trackingEnabled       !== undefined) update['attendanceSettings.trackingEnabled']        = trackingEnabled;

    const schedule = await InternshipSchedule.findOneAndUpdate(
      { internshipId, partnerId },
      { $set: update },
      { new: true }
    );

    if (!schedule) {
      return res.status(404).json({ success: false, message: 'Schedule not found.' });
    }

    return res.status(200).json({
      success: true,
      attendanceSettings: schedule.attendanceSettings
    });

  } catch (error) {
    console.error('updateAttendanceSettings error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL — Called by meetAttendanceSync.js after Google Meet data is pulled
// Updates online attendance portion and recalculates isPresent
// ─────────────────────────────────────────────────────────────────────────────
const upsertOnlineAttendance = async ({
  internshipId,
  scheduleId,
  partnerId,
  studentId,
  timetableDate,
  sessionType,
  joined,
  joinedAt,
  leftAt,
  durationMins,
  minDurationMins
}) => {
  const meetsThreshold = durationMins >= (minDurationMins || 0);

  const existing = await Attendance.findOne({ internshipId, studentId, timetableDate });

  const updated = await Attendance.findOneAndUpdate(
    { internshipId, studentId, timetableDate },
    {
      $set: {
        scheduleId,
        partnerId,
        sessionType,
        'onlineAttendance.joined':         joined,
        'onlineAttendance.joinedAt':        joinedAt,
        'onlineAttendance.leftAt':          leftAt,
        'onlineAttendance.durationMins':    durationMins,
        'onlineAttendance.meetsThreshold':  meetsThreshold,
        resolvedBy: existing?.resolvedBy === 'override' ? 'override' : 'auto'
      }
    },
    { upsert: true, new: true }
  );

  // Don't overwrite a manual override
  if (updated.resolvedBy !== 'override') {
    updated.isPresent = resolveIsPresent(updated);
    await updated.save();
  }

  return updated;
};

// ─────────────────────────────────────────────────────────────────────────────
// OTP Phase 2.1 — Start Session
// POST /api/attendance/start-session
// ─────────────────────────────────────────────────────────────────────────────
const startSession = async (req, res) => {
  try {
    const { internshipId, partnerId, timetableDate, startTime } = req.body;

    const schedule = await InternshipSchedule.findOne({ internshipId, partnerId });
    if (!schedule) return res.status(404).json({ success: false, message: 'Schedule not found.' });
    if (schedule.isClosed) return res.status(403).json({ success: false, message: 'This internship schedule is closed. No new sessions can be started.' });

    // Match by date, and also by startTime when provided (required for multi-batch schedules
    // where two different batches have sessions on the same day)
    const matchSlot = (s) => {
      const dateMatch = new Date(s.date).toDateString() === new Date(timetableDate).toDateString();
      if (!dateMatch) return false;
      if (startTime) return s.startTime === startTime;
      return true;
    };

    let slot = schedule.timetable.find(matchSlot);
    if (!slot && schedule.batches) {
      for (const batch of schedule.batches) {
        slot = batch.timetable.find(matchSlot);
        if (slot) break;
      }
    }
    if (!slot) return res.status(404).json({ success: false, message: 'Timetable slot not found.' });

    const type = slot.type || slot.sessionType || 'online';
    if (type === 'offline') {
      return res.status(400).json({ success: false, message: 'Offline sessions do not use OTP' });
    }

    const now = new Date();  // ← declared ONCE here
    const [startHour, startMin] = slot.startTime.split(':').map(Number);
    const sessionStart = moment.utc(slot.date).utcOffset('+05:30').set({ hour: startHour, minute: startMin, second: 0, millisecond: 0 }).toDate();

    if (now < sessionStart) {
      return res.status(400).json({ success: false, message: 'Session has not started yet' });
    }

    const otp = Math.floor(1000 + Math.random() * 9000).toString();

    const [endHour, endMin] = slot.endTime.split(':').map(Number);

    // Expiry = slot end time + 15 min, but never earlier than now + 15 min
    // (prevents instantly-expired OTPs when a partner starts the session late)
    const sessionEndExpiry = moment.utc(slot.date).utcOffset('+05:30').set({ hour: endHour, minute: endMin + 15, second: 0, millisecond: 0 }).toDate();
    const minimumExpiry = new Date(now.getTime() + 15 * 60 * 1000);
    const expiresAt = sessionEndExpiry > minimumExpiry ? sessionEndExpiry : minimumExpiry;

    slot.sessionOtp = {
      code: otp,
      generatedAt: now,
      expiresAt: expiresAt,
      isActive: true
    };

    await schedule.save();

    return res.status(200).json({ success: true, otp, expiresAt, timetableDate });
  } catch (error) {
    console.error('startSession error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// OTP Phase 2.1 — Submit OTP
// POST /api/attendance/submit-otp
// ─────────────────────────────────────────────────────────────────────────────
const submitOtp = async (req, res) => {
  try {
    const { internshipId, timetableDate, otp } = req.body;
    const studentId = req.user._id;

    const schedule = await InternshipSchedule.findOne({ internshipId });
    if (!schedule) return res.status(404).json({ success: false, message: 'Schedule not found.' });

    // Use the student's preferredTimeSlot to find the CORRECT batch slot
    // (avoids picking the first batch on the same day in multi-batch schedules)
    const offerLetter = await OfferLetter.findOne({ internshipId, studentId, status: 'Accepted' }).lean();
    const preferredTimeSlot = offerLetter?.preferredTimeSlot || null;

    let slot = schedule.timetable.find(s => new Date(s.date).toDateString() === new Date(timetableDate).toDateString());
    if (!slot && schedule.batches) {
      if (preferredTimeSlot) {
        const matchedBatch = schedule.batches.find(b => b.timeSlot === preferredTimeSlot);
        if (matchedBatch) {
          slot = matchedBatch.timetable.find(s => new Date(s.date).toDateString() === new Date(timetableDate).toDateString());
        }
      }
      if (!slot) {
        // Fallback: search all batches
        for (const batch of schedule.batches) {
          slot = batch.timetable.find(s => new Date(s.date).toDateString() === new Date(timetableDate).toDateString());
          if (slot) break;
        }
      }
    }
    if (!slot) return res.status(404).json({ success: false, message: 'Timetable slot not found.' });

    const type = slot.type || slot.sessionType || 'online';
    if (type === 'offline') {
      return res.status(400).json({ success: false, message: 'Offline sessions do not use OTP' });
    }

    if (!slot.sessionOtp || slot.sessionOtp.isActive !== true) {
      return res.status(400).json({ success: false, message: 'No active session' });
    }

    if (new Date() > new Date(slot.sessionOtp.expiresAt)) {
      return res.status(400).json({ success: false, message: 'OTP has expired' });
    }

    if (slot.sessionOtp.code !== otp) {
      return res.status(400).json({ success: false, message: 'Invalid OTP' });
    }

    const offer = await OfferLetter.findOne({ internshipId, studentId, status: 'Accepted' });
    if (!offer) {
      return res.status(403).json({ success: false, message: 'Not enrolled in this internship' });
    }

    let existingRecord = await Attendance.findOne({
      internshipId,
      studentId,
      timetableDate: new Date(timetableDate)
    });

    if (existingRecord) {
      if (existingRecord.resolvedBy === 'override') {
        return res.status(400).json({ success: false, message: 'Attendance has been manually overridden by the partner' });
      }
      
      if (existingRecord.isPresent || existingRecord.onlineAttendance?.meetsThreshold || existingRecord.onlineDetails?.joined) {
        return res.status(200).json({ success: true, message: 'Already marked present for online portion' });
      }
    }

    const isHybrid = type === 'hybrid';

    if (!existingRecord) {
      existingRecord = new Attendance({
        internshipId,
        scheduleId: schedule._id,
        studentId,
        partnerId: schedule.partnerId,
        timetableDate: new Date(timetableDate),
        sessionType: type,
        isPresent: false,
        resolvedBy: 'auto'
      });
    }

    existingRecord.onlineDetails = existingRecord.onlineDetails || {};
    existingRecord.onlineDetails.joined = true;
    
    existingRecord.onlineAttendance = existingRecord.onlineAttendance || {};
    existingRecord.onlineAttendance.meetsThreshold = true;

    existingRecord.otpCheckin = {
      enteredOtp: otp,
      checkedInAt: new Date(),
      ipAddress: req.ip
    };

    if (isHybrid) {
      existingRecord.resolvedBy = 'manual';
    }

    // Resolve isPresent locally
    let newIsPresent = false;
    if (type === 'online') {
      newIsPresent = true;
    } else if (type === 'hybrid') {
      newIsPresent = (existingRecord.onlineAttendance?.meetsThreshold === true && existingRecord.offlineAttendance?.markedPresent === true);
    }
    
    existingRecord.isPresent = newIsPresent;

    await existingRecord.save();

    return res.status(200).json({ success: true, message: isHybrid ? 'Online portion marked. Pending offline attendance.' : 'Attendance marked successfully' });
  } catch (error) {
    console.error('submitOtp error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// OTP Phase 2.1 — End Session
// POST /api/attendance/end-session
// ─────────────────────────────────────────────────────────────────────────────
const endSession = async (req, res) => {
  try {
    const { internshipId, partnerId, timetableDate, startTime } = req.body;
    
    const schedule = await InternshipSchedule.findOne({ internshipId, partnerId });
    if (!schedule) return res.status(404).json({ success: false, message: 'Schedule not found.' });
    if (schedule.isClosed) return res.status(403).json({ success: false, message: 'This internship schedule is closed.' });

    const matchSlot = (s) => {
      const dateMatch = new Date(s.date).toDateString() === new Date(timetableDate).toDateString();
      if (!dateMatch) return false;
      if (startTime) return s.startTime === startTime;
      return true;
    };

    let slot = schedule.timetable.find(matchSlot);
    if (!slot && schedule.batches) {
      for (const batch of schedule.batches) {
        slot = batch.timetable.find(matchSlot);
        if (slot) break;
      }
    }
    if (!slot) return res.status(404).json({ success: false, message: 'Timetable slot not found.' });

    if (slot.sessionOtp) {
      slot.sessionOtp.isActive = false;
      await schedule.save();
    }

    return res.status(200).json({ success: true, message: 'Session ended. OTP deactivated.' });
  } catch (error) {
    console.error('endSession error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// OTP Phase 2.1 — Get Session Status
// GET /api/attendance/session-status/:internshipId?timetableDate=xxx
// ─────────────────────────────────────────────────────────────────────────────
const getSessionStatus = async (req, res) => {
  try {
    const { internshipId } = req.params;
    const studentId = req.user._id;

    const schedule = await InternshipSchedule.findOne({ internshipId });
    if (!schedule) return res.status(404).json({ success: false, message: 'Schedule not found.' });

    // Get the student's preferred batch so we only check their batch's slot
    const offerLetter = await OfferLetter.findOne({ internshipId, studentId, status: 'Accepted' }).lean();
    const preferredTimeSlot = offerLetter?.preferredTimeSlot || null;

    let studentTimetable = schedule.timetable || [];
    if (schedule.batches && schedule.batches.length > 0) {
      if (preferredTimeSlot) {
        // Only search within the student's own batch
        const matchedBatch = schedule.batches.find(b => b.timeSlot === preferredTimeSlot);
        if (matchedBatch) {
          studentTimetable = matchedBatch.timetable || [];
        }
      } else {
        // Fallback: search all batches
        studentTimetable = schedule.batches.flatMap(b => b.timetable || []);
      }
    }

    // Find the first currently active session slot for this student
    const slot = studentTimetable.find(s => 
      s.sessionOtp?.isActive === true && new Date() <= new Date(s.sessionOtp.expiresAt)
    );

    if (!slot) {
       return res.status(200).json({
         success: true,
         sessionActive: false
       });
    }

    const sessionActive = true;
    const expiresAt = slot.sessionOtp.expiresAt;
    
    const existingRecord = await Attendance.findOne({
      internshipId,
      studentId,
      timetableDate: new Date(slot.date)
    });
    
    const alreadyMarked = !!(existingRecord && (existingRecord.isPresent || existingRecord.onlineAttendance?.meetsThreshold || existingRecord.onlineDetails?.joined));

    return res.status(200).json({
      success: true,
      sessionActive,
      alreadyMarked,
      expiresAt,
      slotDate:      slot.date,
      slotStartTime: slot.startTime,
      sessionType: slot.type || slot.sessionType || 'online'
    });
  } catch (error) {
    console.error('getSessionStatus error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};


module.exports = {
  markOfflineAttendance,
  overrideAttendance,
  getAttendanceDashboard,
  getMyAttendance,
  updateAttendanceSettings,
  upsertOnlineAttendance,  // used internally by meetAttendanceSync
  startSession,
  submitOtp,
  endSession,
  getSessionStatus
};
