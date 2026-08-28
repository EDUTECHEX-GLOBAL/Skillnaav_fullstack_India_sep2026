//File: scheduleRoutes.js

const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const {
  updateInternshipSchedule,
  getInternshipSchedule,
  generateAiSectionSummaries,
  generateAiMockInterviewQuestions,
  submitMockInterview,
  getMockInterviewResults,
} = require('../../controllers/scheduleController');
const InternshipSchedule       = require('../../models/webapp-models/InternshipScheduleModel');
const CustomInternshipCertificate = require('../../models/webapp-models/customInternshipCertificateModel');
const OfferLetter              = require('../../models/webapp-models/offerLetterModel');
const Internship               = require('../../models/webapp-models/internshipPostModel');
const IssuedCertificate        = require('../../models/webapp-models/issuedCertificateModel');
const Attendance               = require('../../models/webapp-models/AttendanceModel');
const { generateAndUploadCertificate } = require('../../services/certificateGenerator');
const nodemailer = require('nodemailer');

const { authenticate } = require('../../middlewares/authMiddleware');

// ── Create or update schedule ────────────────────────────────────────────────
router.post('/create', updateInternshipSchedule);

// ── Get schedule ─────────────────────────────────────────────────────────────
router.get('/get-schedule', getInternshipSchedule);

// ── AI: generate section summaries ──────────────────────────────────────────
router.post('/ai-section-summaries', generateAiSectionSummaries);

// ── AI: generate mock interview questions ─────────────────────────────────────
router.post('/ai-mock-interview', generateAiMockInterviewQuestions);

router.post('/submit-mock-interview', submitMockInterview);
router.get('/mock-interview-results', authenticate, getMockInterviewResults);

// ── Close schedule permanently ───────────────────────────────────────────────
router.put('/close', async (req, res) => {
  const { internshipId, partnerId, certificateTemplateId } = req.body;

  if (!internshipId || !partnerId) {
    return res.status(400).json({ error: 'Missing internshipId or partnerId' });
  }

  try {
    const schedule = await InternshipSchedule.findOne({ internshipId, partnerId });

    if (!schedule) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    if (schedule.isClosed) {
      return res.status(400).json({ error: 'Schedule is already closed' });
    }

    const hasTimetable = Array.isArray(schedule.timetable) && schedule.timetable.length > 0;
    const hasBatches   = Array.isArray(schedule.batches)   && schedule.batches.length   > 0;

    if (!hasTimetable && !hasBatches) {
      return res.status(400).json({
        error: 'First create the internship schedule, then only you can close the internship schedule.'
      });
    }

    // ── Resolve certificate template ────────────────────────────────────────
    let selectedCertificateTemplate = null;

    if (certificateTemplateId) {
      if (!mongoose.Types.ObjectId.isValid(certificateTemplateId)) {
        return res.status(400).json({ error: 'Invalid certificate template id' });
      }

      const template = await CustomInternshipCertificate.findOne({
        _id: certificateTemplateId,
        partnerId
      })
        .select('_id name fileName imageUrl textColor')
        .lean();

      if (!template) {
        return res.status(404).json({ error: 'Selected certificate template not found' });
      }

      selectedCertificateTemplate = {
        templateId: template._id,
        name:       template.name,
        fileName:   template.fileName  || '',
        imageUrl:   template.imageUrl,
        textColor:  template.textColor || '#1f2937'
      };
    }

    // ── Mark schedule as closed ─────────────────────────────────────────────
    schedule.isClosed = true;
    schedule.selectedCertificateTemplate = selectedCertificateTemplate;
    await schedule.save();

    // ── Background: attendance check → certificate generation ───────────────
    if (selectedCertificateTemplate && selectedCertificateTemplate.imageUrl) {
      setImmediate(async () => {
        try {
          const internship = await Internship.findById(internshipId);
          if (!internship) {
            console.error('[CertGen] Internship not found:', internshipId);
            return;
          }

          // ── Resolve active timetable (direct timetable OR flattened batches) ──
          const minPercent = schedule.attendanceSettings?.minAttendancePercent ?? 80;
          let activeTimetable = schedule.timetable || [];
          if (activeTimetable.length === 0 && Array.isArray(schedule.batches) && schedule.batches.length > 0) {
            activeTimetable = schedule.batches
              .flatMap(b => b.timetable || [])
              .sort((a, b) => new Date(a.date) - new Date(b.date));
          }
          const totalSessions = activeTimetable.length;

          console.log(`[CertGen] Internship: ${internshipId} | Partner: ${partnerId}`);
          console.log(`[CertGen] Total sessions: ${totalSessions} | Min attendance required: ${minPercent}%`);

          // ── Fetch all accepted students for THIS partner's internship ────
          const acceptedOffers = await OfferLetter.find({
            internshipId,
            status: 'Accepted'
          }).populate({
            path:   'studentId',
            model:  'Userwebapp',
            select: 'name email'
          });

          if (!acceptedOffers.length) {
            console.log('[CertGen] No accepted offers found.');
            return;
          }

          // ── Filter by attendance percentage ─────────────────────────────
          const eligibleOffers = [];

          for (const offer of acceptedOffers) {
            if (!offer.studentId) continue;

            // Resolve THIS student's timetable (their own batch if applicable)
            let studentTimetable = activeTimetable;
            const preferredSlot = offer.preferredTimeSlot || null;
            if (preferredSlot && Array.isArray(schedule.batches) && schedule.batches.length > 0) {
              const matchedBatch = schedule.batches.find(b => b.timeSlot === preferredSlot);
              if (matchedBatch && matchedBatch.timetable && matchedBatch.timetable.length > 0) {
                studentTimetable = matchedBatch.timetable;
              }
            }
            const studentTotalSessions = studentTimetable.length;

            const attendedCount = await Attendance.countDocuments({
              internshipId,
              partnerId,
              studentId: offer.studentId._id,
              isPresent: true
            });

            const attendancePercent = studentTotalSessions > 0
              ? Math.round((attendedCount / studentTotalSessions) * 100)
              : 0;

            console.log(
              `[CertGen] Student: ${offer.studentId.name} | ` +
              `Attended: ${attendedCount}/${studentTotalSessions} (${attendancePercent}%) | ` +
              `Eligible: ${attendancePercent >= minPercent}`
            );

            if (attendancePercent >= minPercent) {
              eligibleOffers.push(offer);
            }
          }

          console.log(`[CertGen] Eligible students: ${eligibleOffers.length} / ${acceptedOffers.length}`);

          // ── Generate certificates only for eligible students ─────────────
          for (const offer of eligibleOffers) {
            try {
              const student = offer.studentId;

              // Skip if certificate already issued
              const existingCert = await IssuedCertificate.findOne({
                studentId:    student._id,
                internshipId
              });
              if (existingCert) {
                console.log(`[CertGen] Already issued for ${student.email}, skipping.`);
                continue;
              }

              const certData = await generateAndUploadCertificate({
                studentName:         student.name              || 'Student Name',
                internshipTitle:     internship.jobTitle       || 'Internship',
                companyName:         internship.companyName    || 'Company',
                startDate:           internship.startDate,
                endDate:             internship.endDateOrDuration || internship.duration,
                backgroundImageUrl:  selectedCertificateTemplate.imageUrl,
                textColor:           selectedCertificateTemplate.textColor
              });

              // Save issued certificate record
              const issuedCert = new IssuedCertificate({
                studentId:             student._id,
                internshipId:          internship._id,
                partnerId,
                certificateId:         certData.certificateId,
                pdfUrl:                certData.pdfUrl,
                s3Key:                 certData.s3Key,
                certificateTemplateId: selectedCertificateTemplate.templateId,
                studentName:           student.name           || 'Student Name',
                internshipTitle:       internship.jobTitle    || 'Internship',
                companyName:           internship.companyName || 'Company',
                startDate:             internship.startDate,
                endDate:               internship.endDateOrDuration || internship.duration
              });

              await issuedCert.save();
              console.log(`[CertGen] ✅ Certificate saved for ${student.email}`);

              // ── Send email notification ─────────────────────────────────
              try {
                if (process.env.BREVO_SMTP_LOGIN && process.env.BREVO_SMTP_KEY) {
                  const transporter = nodemailer.createTransport({
                    host:   'smtp-relay.brevo.com',
                    port:   2525,
                    secure: false,
                    auth: {
                      user: process.env.BREVO_SMTP_LOGIN,
                      pass: process.env.BREVO_SMTP_KEY
                    }
                  });

                  const verifyUrl = `${process.env.FRONTEND_URL || 'https://www.skillnaav.com'}/verify/${certData.certificateId}`;

                  await transporter.sendMail({
                    from:    process.env.EMAIL_FROM    || process.env.BREVO_SMTP_LOGIN,
                    to:      student.email,
                    replyTo: process.env.EMAIL_REPLY_TO,
                    subject: `Your Internship Certificate is Ready — ${internship.jobTitle || 'Internship'}`,
                    html: `
                      <p>Hi ${student.name},</p>
                      <p>Congratulations on completing your internship: 
                         <strong>${internship.jobTitle || 'Internship'}</strong> 
                         at ${internship.companyName || 'Company'}.</p>
                      <p>Your certificate is now available.</p>
                      <p><a href="${certData.pdfUrl}">Download your Certificate</a></p>
                      <p>Verify your certificate here: <a href="${verifyUrl}">${verifyUrl}</a></p>
                      <p>Best regards,<br>Skillnaav Team</p>
                    `
                  });

                  console.log(`[CertGen] 📧 Email sent to ${student.email}`);
                }
              } catch (mailErr) {
                console.error(`[CertGen] Email failed for ${student.email}:`, mailErr.message);
              }

            } catch (err) {
              console.error(`[CertGen] Failed for student ${offer.studentId?.email}:`, err.message);
            }
          }

        } catch (err) {
          console.error('[CertGen] Background error:', err.message);
        }
      });
    }

    return res.status(200).json({
      message: 'Schedule closed permanently',
      selectedCertificateTemplate
    });

  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to close schedule' });
  }
});

// ── Re-issue certificates for an already-closed schedule ─────────────────────
// POST /api/schedule/reissue-certificates
// Body: { internshipId, partnerId }
router.post('/reissue-certificates', async (req, res) => {
  const { internshipId, partnerId } = req.body;
  if (!internshipId || !partnerId) {
    return res.status(400).json({ error: 'Missing internshipId or partnerId' });
  }

  try {
    const schedule = await InternshipSchedule.findOne({ internshipId, partnerId });
    if (!schedule) return res.status(404).json({ error: 'Schedule not found' });
    if (!schedule.isClosed) return res.status(400).json({ error: 'Schedule must be closed before certificates can be issued' });

    const template = schedule.selectedCertificateTemplate;
    if (!template || !template.imageUrl) {
      return res.status(400).json({ error: 'No certificate template associated with this schedule. Please re-close the schedule with a template selected.' });
    }

    // Resolve active timetable
    let activeTimetable = schedule.timetable || [];
    if (activeTimetable.length === 0 && Array.isArray(schedule.batches) && schedule.batches.length > 0) {
      activeTimetable = schedule.batches.flatMap(b => b.timetable || []);
    }

    const minPercent = schedule.attendanceSettings?.minAttendancePercent ?? 80;
    const internship = await Internship.findById(internshipId);
    if (!internship) return res.status(404).json({ error: 'Internship not found' });

    const acceptedOffers = await OfferLetter.find({ internshipId, status: 'Accepted' })
      .populate({ path: 'studentId', model: 'Userwebapp', select: 'name email' });

    if (!acceptedOffers.length) return res.status(200).json({ message: 'No accepted students found.', issued: 0 });

    // Run synchronously so we can report back
    let issued = 0;
    let skipped = 0;
    const results = [];

    for (const offer of acceptedOffers) {
      if (!offer.studentId) continue;

      // Per-student timetable
      let studentTimetable = activeTimetable;
      const preferredSlot = offer.preferredTimeSlot || null;
      if (preferredSlot && Array.isArray(schedule.batches) && schedule.batches.length > 0) {
        const matchedBatch = schedule.batches.find(b => b.timeSlot === preferredSlot);
        if (matchedBatch?.timetable?.length > 0) studentTimetable = matchedBatch.timetable;
      }
      const studentTotalSessions = studentTimetable.length;

      const attendedCount = await Attendance.countDocuments({
        internshipId, partnerId, studentId: offer.studentId._id, isPresent: true
      });

      const attendancePercent = studentTotalSessions > 0
        ? Math.round((attendedCount / studentTotalSessions) * 100)
        : 0;

      if (attendancePercent < minPercent) {
        results.push({ student: offer.studentId.email, status: 'ineligible', percent: attendancePercent });
        continue;
      }

      // Skip if already issued
      const existingCert = await IssuedCertificate.findOne({ studentId: offer.studentId._id, internshipId });
      if (existingCert) {
        skipped++;
        results.push({ student: offer.studentId.email, status: 'already_issued' });
        continue;
      }

      try {
        const certData = await generateAndUploadCertificate({
          studentName:        offer.studentId.name   || 'Student Name',
          internshipTitle:    internship.jobTitle    || 'Internship',
          companyName:        internship.companyName || 'Company',
          startDate:          internship.startDate,
          endDate:            internship.endDateOrDuration || internship.duration,
          backgroundImageUrl: template.imageUrl,
          textColor:          template.textColor || '#1f2937'
        });

        const issuedCert = new IssuedCertificate({
          studentId:             offer.studentId._id,
          internshipId:          internship._id,
          partnerId,
          certificateId:         certData.certificateId,
          pdfUrl:                certData.pdfUrl,
          s3Key:                 certData.s3Key,
          certificateTemplateId: template.templateId,
          studentName:           offer.studentId.name   || 'Student Name',
          internshipTitle:       internship.jobTitle    || 'Internship',
          companyName:           internship.companyName || 'Company',
          startDate:             internship.startDate,
          endDate:               internship.endDateOrDuration || internship.duration
        });
        await issuedCert.save();
        issued++;
        results.push({ student: offer.studentId.email, status: 'issued', percent: attendancePercent });
      } catch (err) {
        results.push({ student: offer.studentId.email, status: 'error', error: err.message });
      }
    }

    return res.status(200).json({ message: `Certificates processed. Issued: ${issued}, Already had: ${skipped}`, issued, skipped, results });

  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to reissue certificates' });
  }
});

module.exports = router;