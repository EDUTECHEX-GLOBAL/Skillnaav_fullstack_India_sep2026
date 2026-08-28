//File: InstructureManagementController.js

const fs = require("fs");
const path = require("path");
const Instructure = require("../models/webapp-models/InstructureManagementModel");
const InternshipSchedule = require("../models/webapp-models/InternshipScheduleModel");
// ADD: email helper to notify instructors after creation
const { sendInstructorCreatedEmail } = require("../utils/instructorMailer");
// ADD (top)
const notifyUser = require("../utils/notifyUser"); // uses your EMAIL_* env
const { issueOtp, verifyOtp, isVerified, clearOtp } = require("../utils/otpStore");
// ADD: S3 upload deps
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const crypto = require("crypto");

// ADD: S3 client
const s3 = new S3Client({
    region: process.env.AWS_REGION,
    credentials: (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    } : undefined,
});

// Map each field to a bucket from your .env
const bucketFor = (field) => {
    if (field === "resume") return process.env.AWS_RESUME_BUCKET;
    if (field === "photo") return process.env.AWS_PROFILE_PIC_BUCKET;
    if (field === "certificates") return process.env.AWS_IMAGE_BUCKET || process.env.AWS_PROFILE_PIC_BUCKET || process.env.AWS_RESUME_BUCKET;
    // default fallback
    return process.env.AWS_IMAGE_BUCKET || process.env.AWS_RESUME_BUCKET;
};

// Map field to the folder (key prefix) you want in S3
// Per your examples: resume -> "resumes/...", images (photo/certificates) -> "jobs/..."
const keyPrefixFor = (field) => (field === "resume" ? "resumes" : "jobs");

// Build a filename like: 1752840415245-508278277.png
const randomSuffix = () => `${Date.now()}-${Math.floor(Math.random() * 1_000_000_000)}`;

// Encode each path segment but preserve folder slashes
const encodeS3KeyForUrl = (k) => k.split("/").map(encodeURIComponent).join("/");
const httpsUrl = (bucket, key) =>
    `https://${bucket}.s3.${process.env.AWS_REGION}.amazonaws.com/${encodeS3KeyForUrl(key)}`;

// REPLACE this function
const fileToMeta = async (file) => {
    if (!file) return undefined;

    // infer fieldname: "resume" | "photo" | "certificates"
    const field = file.fieldname;
    const bucket = bucketFor(field);
    if (!bucket) return undefined;

    const ext = path.extname(file.originalname) || "";
    const key = `${keyPrefixFor(field)}/${randomSuffix()}${ext}`;

    // stream the temp file to S3
    const Body = fs.createReadStream(file.path);
    await s3.send(new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body,
        ContentType: file.mimetype || "application/octet-stream",
        // No ACL here — bucket has "Bucket owner enforced" (ACLs disabled)
    }));

    // remove temp file quietly
    try { fs.unlink(file.path, () => { }); } catch (_) { }

    // return the doc to store in Mongo
    return {
        url: httpsUrl(bucket, key),         // e.g. https://skillnaavres.s3.us-west-1.amazonaws.com/jobs/1752-...png
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
    };
};

const parsePayload = (req) => {
    try {
        // 1) If payload is a text field
        if (req.body && typeof req.body.payload === "string") {
            return JSON.parse(req.body.payload);
        }

        // 2) If payload came as a Blob/file part named "payload"
        if (req.files && req.files.payload && req.files.payload[0]) {
            const f = req.files.payload[0];
            const raw = fs.readFileSync(f.path, "utf8");
            fs.unlink(f.path, () => { });
            return JSON.parse(raw);
        }

        return null;
    } catch (e) {
        const err = new Error("Invalid payload JSON.");
        err.statusCode = 400;
        throw err;
    }
};

exports.createInstructure = async (req, res) => {
    try {
        const payload = parsePayload(req);
        if (!payload) return res.status(400).json({ message: "Missing payload JSON." });

        // ✅ NEW: Partner scope (must come from auth middleware)
        const partnerId = req.partner?._id;
        if (!partnerId) {
            return res.status(401).json({ message: "Partner not authorized." });
        }

        if (payload.availableStart && payload.availableEnd && payload.availableEnd <= payload.availableStart) {
            return res.status(400).json({ message: "End Time must be after Start Time." });
        }

        // >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>  ADD THIS BLOCK  <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
        // OTP email verification guard (run BEFORE handling files or saving)
        const emailToCheck = (payload?.email || "").trim().toLowerCase();
        if (!emailToCheck) {
            return res.status(400).json({ message: "Email is required." });
        }
        if (!isVerified(emailToCheck)) {
            return res.status(400).json({
                message: "Email not verified. Please complete OTP verification and try again.",
            });
        }
        // <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<  ADD THIS BLOCK  >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

        const resumeFile = req.files?.resume?.[0];
        const photoFile = req.files?.photo?.[0];
        const certFiles = req.files?.certificates || [];

        // OLD (disk):
        // files.resume = fileToMeta(resumeFile);
        // if (photoFile) files.photo = fileToMeta(photoFile);
        // if (certFiles.length) files.certificates = certFiles.map(fileToMeta).filter(Boolean);

        // REPLACE WITH (S3, async):
        const files = {};
        if (!resumeFile) return res.status(400).json({ message: "Resume is required." });
        files.resume = await fileToMeta(resumeFile);
        if (!files.resume || !files.resume.url) {
            return res.status(500).json({
                message: "Resume upload failed. Check AWS_REGION, AWS credentials, and AWS_RESUME_BUCKET.",
            });
        }
        if (photoFile) files.photo = await fileToMeta(photoFile);
        if (certFiles.length) files.certificates = (await Promise.all(certFiles.map(fileToMeta))).filter(Boolean);

        // Then include ...files when creating the document:
        const created = await Instructure.create({ ...payload, partnerId, ...files });

        // Try sending the notification email to the instructor.
        // Do NOT fail the API if email fails — just log the error.
        try {
            await sendInstructorCreatedEmail(created);
            // Send Google Calendar auth prompt mail (non-blocking)
            try {
                const { sendGoogleAuthPromptEmail } = require("../utils/googleAuthMailer");
                await sendGoogleAuthPromptEmail({
                    to: created.email,
                    firstName: created.firstName,
                    lastName: created.lastName,
                    // optional state payload (add what you like):
                    statePayload: { createdAt: String(created.createdAt || new Date()) },
                });
            } catch (e) {
                console.error("[createInstructure] Google auth prompt mail failed:", e?.message || e);
            }
        } catch (mailErr) {
            console.error("[createInstructure] Email send failed:", mailErr?.message || mailErr);
        }

        // >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>  ADD THIS LINE  <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
        // Clear OTP for this verified email after successful create (+mail)
        try { clearOtp(emailToCheck); } catch (_) { }
        // <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<  ADD THIS LINE  >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

        return res.status(201).json(created);
    } catch (err) {
        console.error("createInstructure error:", err);

        // ✅ If parsePayload threw a 400
        if (err?.statusCode) {
            return res.status(err.statusCode).json({ message: err.message });
        }

        // ✅ Duplicate instructor for same partner (unique index: partnerId + email)
        if (err?.code === 11000) {
            return res.status(409).json({
                message: "Instructor already exists with this email for your account.",
            });
        }

        // ✅ Mongoose validation errors
        if (err?.name === "ValidationError") {
            return res.status(400).json({ message: err.message });
        }

        // ✅ Show real error so you can fix AWS/S3 quickly
        return res.status(500).json({
            message: err?.message || "Failed to create instructure.",
        });
    }
};

exports.listInstructures = async (req, res) => {
    try {
        const partnerId = req.partner?._id;
        if (!partnerId) {
            return res.status(401).json({ message: "Partner not authorized." });
        }

        const { q = "", page = 1, limit = 20 } = req.query;

        const baseFilter = { partnerId };

        const query = q
            ? {
                ...baseFilter,
                $or: [
                    { firstName: new RegExp(q, "i") },
                    { lastName: new RegExp(q, "i") },
                    { email: new RegExp(q, "i") },
                    { phone: new RegExp(q, "i") },
                    { city: new RegExp(q, "i") },
                    { state: new RegExp(q, "i") },
                    { specializations: { $in: [new RegExp(q, "i")] } },
                    { skills: { $in: [new RegExp(q, "i")] } },
                    { languages: { $in: [new RegExp(q, "i")] } },
                ],
            }
            : baseFilter;

        const skip = (Number(page) - 1) * Number(limit);

        const [items, total] = await Promise.all([
            Instructure.find(query).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
            Instructure.countDocuments(query),
        ]);

        return res.json({ items, total, page: Number(page), limit: Number(limit) });
    } catch (err) {
        console.error("listInstructures error:", err);
        return res.status(500).json({ message: "Failed to fetch instructures." });
    }
};

exports.getInstructure = async (req, res) => {
    try {
        const partnerId = req.partner?._id;
        if (!partnerId) {
            return res.status(401).json({ message: "Partner not authorized." });
        }

        const item = await Instructure.findOne({ _id: req.params.id, partnerId });
        if (!item) return res.status(404).json({ message: "Instructure not found." });
        return res.json(item);
    } catch (err) {
        console.error("getInstructure error:", err);
        return res.status(500).json({ message: "Failed to fetch instructure." });
    }
};

exports.updateInstructure = async (req, res) => {
    try {
        let patch = {};
        if (req.is("multipart/form-data")) {
            const payload = parsePayload(req);
            if (payload) patch = payload;

            const resumeFile = req.files?.resume?.[0];
            const photoFile = req.files?.photo?.[0];
            const certFiles = req.files?.certificates || [];

            if (resumeFile) patch.resume = await fileToMeta(resumeFile);
            if (photoFile) patch.photo = await fileToMeta(photoFile);
            if (certFiles.length) patch.certificates = (await Promise.all(certFiles.map(fileToMeta))).filter(Boolean);
        } else {
            patch = req.body || {};
        }

        if (patch.availableStart && patch.availableEnd && patch.availableEnd <= patch.availableStart) {
            return res.status(400).json({ message: "End Time must be after Start Time." });
        }

        const partnerId = req.partner?._id;
        if (!partnerId) {
            return res.status(401).json({ message: "Partner not authorized." });
        }

        // ✅ extra security: do not allow changing partnerId from payload
        if (patch.partnerId) delete patch.partnerId;

        const updated = await Instructure.findOneAndUpdate(
            { _id: req.params.id, partnerId },
            patch,
            { new: true }
        );
        if (!updated) return res.status(404).json({ message: "Instructure not found." });
        return res.json(updated);
    } catch (err) {
        console.error("updateInstructure error:", err);
        return res.status(500).json({ message: "Failed to update instructure." });
    }
};

exports.deleteInstructure = async (req, res) => {
    try {
        const deleted = await Instructure.findOneAndDelete({
            _id: req.params.id,
            partnerId: req.partner._id,
        });
        if (!deleted) return res.status(404).json({ message: "Instructor not found" });

        // optionally delete files from s3 here...

        res.json({ message: "Instructor deleted successfully" });
    } catch (error) {
        console.error("deleteInstructure error:", error);
        res.status(500).json({ message: "Server error deleting instructor" });
    }
};

// ==============================================
// AUTO-ASSIGN INSTRUCTORS
// ==============================================

// Helper to create basic ICS string
const createICS = (sessions) => {
    let ics = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//SkillNaav//Instructor Schedule//EN\r\n";
    sessions.forEach(s => {
        // Date parsing
        const d = new Date(s.date);
        const yyyy = d.getUTCFullYear();
        const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
        const dd = String(d.getUTCDate()).padStart(2, '0');
        
        const [startH, startM] = (s.startTime || "00:00").split(":");
        const [endH, endM] = (s.endTime || "00:00").split(":");
        
        const startStr = `${yyyy}${mm}${dd}T${startH}${startM}00Z`;
        const endStr = `${yyyy}${mm}${dd}T${endH}${endM}00Z`;
        
        const stamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
        
        ics += "BEGIN:VEVENT\r\n";
        ics += `UID:${crypto.randomBytes(16).toString("hex")}@skillnaav.com\r\n`;
        ics += `DTSTAMP:${stamp}\r\n`;
        ics += `DTSTART:${startStr}\r\n`;
        ics += `DTEND:${endStr}\r\n`;
        ics += `SUMMARY:SkillNaav Class: ${s.sectionSummary || "Session"}\r\n`;
        if (s.eventLink) {
            ics += `LOCATION:${s.eventLink}\r\n`;
        }
        ics += "END:VEVENT\r\n";
    });
    ics += "END:VCALENDAR\r\n";
    return ics;
};

// Helper: check if a given day string matches the date
const daysMap = { "Mon": 1, "Tue": 2, "Wed": 3, "Thu": 4, "Fri": 5, "Sat": 6, "Sun": 0 };

// Helper to parse "HH:MM", "HH:MM AM", "HH:MM PM" into minutes since midnight
const parseTime = (timeStr) => {
    if (!timeStr) return 0;
    const isPM = timeStr.toLowerCase().includes('pm');
    const isAM = timeStr.toLowerCase().includes('am');
    const cleanStr = timeStr.replace(/[^\d:]/g, '').trim();
    let [h, m] = cleanStr.split(':').map(n => parseInt(n) || 0);
    
    if (isPM && h !== 12) h += 12;
    if (isAM && h === 12) h = 0;
    
    return h * 60 + m;
};

exports.autoAssignInstructors = async (req, res) => {
    try {
        const partnerId = req.partner._id;
        
        // 1. Fetch data strictly for this partner
        const schedules = await InternshipSchedule.find({ partnerId }).populate("internshipId");
        const instructors = await Instructure.find({ partnerId });
        
        if (!instructors.length) {
            return res.status(400).json({ message: "No instructors available to assign." });
        }

        let totalAssigned = 0;
        const assignmentMap = new Map(); // instructorId -> array of assigned sessions

        // Build a helper to check conflicts quickly across all existing schedules
        const isConflict = (instId, dateStr, startTime, endTime) => {
            // Very basic conflict check: same instructor, same date, overlapping time.
            // For simplicity, we just check if they are already teaching ANY session on this date overlapping this time.
            const startMins = parseInt(startTime.split(':')[0]) * 60 + parseInt(startTime.split(':')[1]);
            const endMins = parseInt(endTime.split(':')[0]) * 60 + parseInt(endTime.split(':')[1]);
            
            for (const sched of schedules) {
                const allSessions = sched.batches && sched.batches.length > 0 
                    ? sched.batches.flatMap(b => b.timetable)
                    : sched.timetable;
                
                for (const s of allSessions) {
                    if (s.instructorId && s.instructorId.toString() === instId.toString()) {
                        if (!s.startTime || !s.endTime || !s.date) continue;
                        const sDate = new Date(s.date).toISOString().split('T')[0];
                        if (sDate === dateStr) {
                            const sStart = parseTime(s.startTime);
                            const sEnd = parseTime(s.endTime);
                            
                            // check overlap
                            if (startMins < sEnd && endMins > sStart) {
                                return true; // conflict!
                            }
                        }
                    }
                }
            }
            return false;
        };

        // 2. Loop through schedules
        for (const schedule of schedules) {
            let scheduleUpdated = false;
            
            // Get internship skills (qualifications) for matching
            const internshipSkills = schedule.internshipId?.qualifications || [];
            
            const processTimetable = (timetable) => {
                for (const session of timetable) {
                    if (session.instructorId) continue; // Already assigned
                    
                    if (!session.startTime || !session.endTime) continue;

                    const sessionDateStr = new Date(session.date).toISOString().split('T')[0];
                    const sStartMins = parseTime(session.startTime);
                    const sEndMins = parseTime(session.endTime);
                    const startMins = sStartMins;
                    const endMins = sEndMins;
                    
                    const dayAbbrMap = {
                        "Monday": "Mon", "Tuesday": "Tue", "Wednesday": "Wed", 
                        "Thursday": "Thu", "Friday": "Fri", "Saturday": "Sat", "Sunday": "Sun"
                    };
                    const sessionDayAbbr = dayAbbrMap[session.day] || session.day;

                    // 3. Find available instructor
                    for (const inst of instructors) {
                        // Check Day Match
                        const matchesDay = (inst.availableDays || []).includes(sessionDayAbbr);
                        if (!matchesDay) continue;

                        // Check Skills Match
                        let skillMatch = false;
                        if (internshipSkills.length > 0) {
                            if (inst.skills && inst.skills.length > 0) {
                                // Match if they share at least one skill (case-insensitive)
                                skillMatch = inst.skills.some(instSkill => 
                                    internshipSkills.some(intSkill => intSkill.toLowerCase().trim() === instSkill.toLowerCase().trim())
                                );
                            }
                            if (!skillMatch) continue; // Skip if no skills match
                        }
                        
                        
                        // Check Time Match (Preferable slots or overarching)
                        let timeMatches = false;
                        if (inst.preferableSlots && inst.preferableSlots.length > 0) {
                            for (const slot of inst.preferableSlots) {
                                if (!slot.start || !slot.end) continue;
                                const st = parseTime(slot.start);
                                const en = parseTime(slot.end);
                                if (startMins >= st && endMins <= en) {
                                    timeMatches = true;
                                    break;
                                }
                            }
                        } else if (inst.availableStart && inst.availableEnd) {
                            const st = parseTime(inst.availableStart);
                            const en = parseTime(inst.availableEnd);
                            if (startMins >= st && endMins <= en) {
                                timeMatches = true;
                            }
                        } else {
                            // If no time constraints are specified, assume available
                            timeMatches = true;
                        }
                        
                        if (!timeMatches) continue;

                        // Check Conflict
                        if (isConflict(inst._id, sessionDateStr, session.startTime, session.endTime)) {
                            continue; // Instructor busy
                        }
                        
                        // Assign!
                        session.instructorId = inst._id;
                        session.instructor = `${inst.firstName} ${inst.lastName}`;
                        scheduleUpdated = true;
                        totalAssigned++;
                        
                        if (!assignmentMap.has(inst._id.toString())) {
                            assignmentMap.set(inst._id.toString(), { instructor: inst, sessions: [] });
                        }
                        assignmentMap.get(inst._id.toString()).sessions.push(session);
                        break; // Move to next session
                    }
                }
            };
            
            if (schedule.batches && schedule.batches.length > 0) {
                schedule.batches.forEach(b => processTimetable(b.timetable));
            } else {
                processTimetable(schedule.timetable);
            }
            
            if (scheduleUpdated) {
                await schedule.save();
            }
        }
        
        // 5. Send Emails with ICS
        for (const [instId, data] of assignmentMap.entries()) {
            const inst = data.instructor;
            const sessions = data.sessions;
            
            const icsContent = createICS(sessions);
            
            // Generate Excel sheet
            const xlsx = require('xlsx');
            const wsData = sessions.map(s => ({
                Date: new Date(s.date).toDateString(),
                StartTime: s.startTime,
                EndTime: s.endTime,
                Summary: s.sectionSummary || "-",
                Link: s.eventLink || "TBA"
            }));
            const ws = xlsx.utils.json_to_sheet(wsData);
            const wb = xlsx.utils.book_new();
            xlsx.utils.book_append_sheet(wb, ws, "Schedule");
            const excelBuffer = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });

            // ICS and Excel Attachments
            const attachments = [
                {
                    filename: 'schedule.ics',
                    content: icsContent,
                    contentType: 'text/calendar'
                },
                {
                    filename: 'schedule.xlsx',
                    content: excelBuffer,
                    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                }
            ];
            
            const htmlBody = `
                <p>Hello ${inst.firstName},</p>
                <p>You have been automatically assigned to teach ${sessions.length} new session(s).</p>
                <p>Please find your schedule and calendar events attached to this email.</p>
                <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%; margin-top: 15px;">
                    <tr style="background: #f3f4f6;">
                        <th>Date</th>
                        <th>Time</th>
                        <th>Summary</th>
                        <th>Link</th>
                    </tr>
                    ${sessions.map(s => `
                        <tr>
                            <td>${new Date(s.date).toDateString()}</td>
                            <td>${s.startTime} - ${s.endTime}</td>
                            <td>${s.sectionSummary || "-"}</td>
                            <td>${s.eventLink ? `<a href="${s.eventLink}">Join</a>` : "TBA"}</td>
                        </tr>
                    `).join("")}
                </table>
                <p>Best regards,<br/>Your Partner Team</p>
            `;
            
            await notifyUser(inst.email, "New Class Assignments - SkillNaav", htmlBody, attachments).catch(console.error);
        }

        res.json({
            assignments_made: totalAssigned,
            assignments: Array.from(assignmentMap.keys()).map(k => ({
                instructorId: k,
                instructorName: `${assignmentMap.get(k).instructor.firstName} ${assignmentMap.get(k).instructor.lastName}`,
                sessionsUpdated: assignmentMap.get(k).sessions.length
            }))
        });

    } catch (error) {
        console.error("autoAssignInstructors error:", error);
        res.status(500).json({ message: "Server error assigning instructors" });
    }
};

exports.getInstructorAssignments = async (req, res) => {
    try {
        const { id } = req.params;
        const schedules = await InternshipSchedule.find({ partnerId: req.partner._id }).populate('internshipId', 'jobTitle');
        
        let assignments = [];
        
        for (const sched of schedules) {
            const extractSessions = (timetable, batchSlot) => {
                for (const s of timetable) {
                    if (s.instructorId && s.instructorId.toString() === id.toString()) {
                        assignments.push({
                            internshipId: sched.internshipId?._id || sched.internshipId,
                            jobTitle: sched.internshipId?.jobTitle || "Unknown Internship",
                            date: s.date,
                            day: s.day,
                            startTime: s.startTime,
                            endTime: s.endTime,
                            sectionSummary: s.sectionSummary,
                            eventLink: s.eventLink,
                            batch: batchSlot
                        });
                    }
                }
            };
            
            if (sched.batches && sched.batches.length > 0) {
                sched.batches.forEach(b => extractSessions(b.timetable, b.timeSlot));
            } else {
                extractSessions(sched.timetable, null);
            }
        }
        
        res.json(assignments.sort((a, b) => new Date(a.date) - new Date(b.date)));
    } catch (error) {
        console.error("getInstructorAssignments error:", error);
        res.status(500).json({ message: "Server error fetching assignments" });
    }
};

// ADD: Start OTP (send code to provided email)
exports.startInstructorEmailOtp = async (req, res) => {
    try {
        const { email } = req.body || {};
        if (!email) return res.status(400).json({ message: "Email is required." });

        const code = issueOtp(email);
        const subject = "SkillNaav — Verify your email (OTP)";
        const bodyHtml = `
      <div style="font-family:Arial,sans-serif;line-height:1.6">
        <h2>Verify your email</h2>
        <p>Your 6-digit code:</p>
        <p style="font-size:24px;font-weight:700;letter-spacing:2px">${code}</p>
        <p>This code expires in ${process.env.OTP_TTL_MIN || 10} minutes.</p>
      </div>
    `;
        await notifyUser(email, subject, bodyHtml);

        return res.json({ ok: true });
    } catch (err) {
        console.error("startInstructorEmailOtp error:", err);
        return res.status(500).json({ message: "Failed to start OTP." });
    }
};

// ADD: Verify OTP
exports.verifyInstructorEmailOtp = async (req, res) => {
    try {
        const { email, otp } = req.body || {};
        if (!email || !otp) return res.status(400).json({ message: "Email and OTP are required." });

        const ok = verifyOtp(email, otp);
        if (!ok) return res.status(400).json({ message: "Invalid or expired OTP." });

        return res.json({ ok: true });
    } catch (err) {
        console.error("verifyInstructorEmailOtp error:", err);
        return res.status(500).json({ message: "Failed to verify OTP." });
    }
};