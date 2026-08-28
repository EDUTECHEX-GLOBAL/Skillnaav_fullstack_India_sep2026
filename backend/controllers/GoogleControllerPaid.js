// GoogleControllerPaid.js
require('dotenv').config();

const TokenModel = require('../models/webapp-models/TokenModel');
const InternshipScheduleModel = require('../models/webapp-models/InternshipScheduleModel');
const OfferLetterModel = require('../models/webapp-models/offerLetterModel');

// ✅ Reuse the working Google Calendar upsert logic from GoogleController.js
const { upsertScheduleForStudent } = require('./GoogleController');

// ✅ Function for Online Events (PAID controller copy)
function buildOnlineEvent({ slot, dateStr, startDateTime, endDateTime, internshipTitle, finalEventLink }) {
    return {
        summary: `Online Section by ${slot.instructor || 'Instructor'}`,
        description: `Topic: ${slot.sectionSummary || 'Internship session'}
    
👨‍🏫 ${slot.instructor || 'Not assigned'}

🔗 Online Meeting Links: ${finalEventLink || 'Link not available'}

📅 Date: ${formatDate(dateStr)}
⏰ Time: ${slot.startTime} - ${slot.endTime} (IST)

Generated on: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
    `,
        start: { dateTime: startDateTime, timeZone: 'Asia/Kolkata' },
        end: { dateTime: endDateTime, timeZone: 'Asia/Kolkata' },
        reminders: {
            useDefault: false,
            overrides: [
                { method: 'email', minutes: 1440 }, // 1 day before
                { method: 'popup', minutes: 60 },
                { method: 'popup', minutes: 15 },
                { method: 'popup', minutes: 1 }
            ]
        },
        colorId: '9',
        visibility: 'default',
        status: 'confirmed',
        conferenceData: (!finalEventLink && slot.includeMeet !== false) ? {
            createRequest: {
                requestId: `meet-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                conferenceSolutionKey: { type: 'hangoutsMeet' }
            }
        } : undefined
    };
}

// ✅ Function for Offline Events (PAID controller copy)
function buildOfflineEvent({ slot, dateStr, startDateTime, endDateTime, internshipTitle }) {
    return {
        summary: `Offline Section by ${slot.instructor || 'Instructor'}`,
        description: `Topic: ${slot.sectionSummary || 'Internship session'}

👨‍🏫 ${slot.instructor || 'Not assigned'}
📅 Date: ${formatDate(dateStr)}
⏰ Time: ${slot.startTime} - ${slot.endTime} (IST)

📍 Location: ${slot.location?.address || 'Offline'}

${slot.location?.mapLink ? `🗺️ Map: ${slot.location.mapLink}` : ''}

Generated on: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
    `,
        location: slot.location?.mapLink || 'Offline',
        start: { dateTime: startDateTime, timeZone: 'Asia/Kolkata' },
        end: { dateTime: endDateTime, timeZone: 'Asia/Kolkata' },
        reminders: {
            useDefault: false,
            overrides: [
                { method: 'email', minutes: 1440 }, // 1 day before
                { method: 'popup', minutes: 60 },
                { method: 'popup', minutes: 15 },
                { method: 'popup', minutes: 1 }
            ]
        },
        colorId: '9',
        visibility: 'default',
        status: 'confirmed'
    };
}

// Helper used by the above descriptions
function formatDate(dateString) {
    const date = new Date(dateString + 'T00:00:00.000Z');
    return date.toLocaleDateString('en-IN', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

// --- Helpers (Paid only) ---
// PAID: "Time" = class duration (ex: "11:00 - 12:00")
// Working Hours (ex: "09:00 - 17:00") should NOT be used as event duration.

function parseClassDurationSlot(slotStr) {
    if (!slotStr || typeof slotStr !== 'string') return null;

    // Accept: "11:00 - 12:00" or "11:00-12:00"
    const m = slotStr.match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
    if (!m) return null;

    const pad = (t) => {
        const [h, min] = t.split(':');
        return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
    };

    return { startTime: pad(m[1]), endTime: pad(m[2]) };
}

function applyClassDurationToTimetable(timetable, duration) {
    if (!Array.isArray(timetable) || !duration?.startTime || !duration?.endTime) return timetable;

    return timetable.map((s) => {
        const obj = (s && typeof s.toObject === 'function') ? s.toObject() : { ...s };
        return {
            ...obj,
            startTime: duration.startTime,
            endTime: duration.endTime,
        };
    });
}

// ✅ POST /api/google/update-schedule  (PAID only)
const updateScheduleInGoogleCalendarPaid = async (req, res) => {
    console.log("[PAID controller] updateScheduleInGoogleCalendarPaid called:", req.body?.internshipId, req.body?.studentEmail);
    try {
        const { internshipId, studentEmail } = req.body;

        // Must be authenticated first
        const studentToken = await TokenModel.findOne({ email: studentEmail });
        if (!studentToken?.tokens) {
            return res.status(401).json({ success: false, message: "Student not authenticated with Google" });
        }

        // Load schedule from DB
        const scheduleDoc = await InternshipScheduleModel.findOne({ internshipId });
        if (!scheduleDoc) {
            return res.status(404).json({ success: false, message: "No schedule found" });
        }

        // ✅ For PAID: Use the student's specific batch timetable from OfferLetter/batches
        let timetableToSync = scheduleDoc.timetable;

        try {
            const offerDoc = await OfferLetterModel.findOne({
                internshipId,
                email: studentEmail,
                status: { $regex: /^accepted$/i },
            }).sort({ updatedAt: -1 });

            // In your DB it can be preferredTimeSlot or selectedTimeSlot
            const durationStr = offerDoc?.preferredTimeSlot || offerDoc?.selectedTimeSlot;

            if (durationStr) {
                const normalizeSlot = (str) => String(str || "").replace(/\s+/g, "").trim();
                const studentNormalized = normalizeSlot(durationStr);

                let matchedBatch = null;
                if (Array.isArray(scheduleDoc.batches) && scheduleDoc.batches.length > 0) {
                    matchedBatch = scheduleDoc.batches.find(
                        (b) => normalizeSlot(b.timeSlot) === studentNormalized
                    );
                }

                if (matchedBatch && Array.isArray(matchedBatch.timetable) && matchedBatch.timetable.length > 0) {
                    timetableToSync = matchedBatch.timetable;
                    console.log(`[Google Paid Sync] Matching batch found for ${studentEmail}: ${matchedBatch.timeSlot}. Syncing batch timetable directly.`);
                } else {
                    // Fallback to legacy regex parse + override
                    const parsed = parseClassDurationSlot(durationStr);
                    if (parsed?.startTime && parsed?.endTime) {
                        timetableToSync = applyClassDurationToTimetable(scheduleDoc.timetable, parsed);
                        console.log(`[Google Paid Sync] Fallback: Class duration applied for ${studentEmail}: ${parsed.startTime}-${parsed.endTime}`);
                    } else {
                        console.warn(`[Google Paid Sync] No valid class duration or batch found on offer letter for ${studentEmail}. Using timetable times as-is.`);
                    }
                }
            } else {
                console.warn(`[Google Paid Sync] No preferredTimeSlot/selectedTimeSlot found for ${studentEmail}. Using master timetable as-is.`);
            }
        } catch (e) {
            console.warn("[Google Paid Sync] Could not load offer letter / apply class duration:", e?.message || e);
        }

        // ✅ Respond immediately (no timeout)
        setImmediate(async () => {
            try {
                await upsertScheduleForStudent({
                    studentEmail,
                    internshipId,
                    timetable: timetableToSync,
                    internshipTitle: scheduleDoc.internshipTitle || 'Internship Schedule',
                    defaultEventLink: scheduleDoc.defaultEventLink || '',
                    buildOnlineEvent,
                    buildOfflineEvent
                });
            } catch (e) {
                console.error('[Google Paid Sync] Async sync failed:', e);
            }
        });

        return res.status(202).json({ success: true, started: true });

    } catch (error) {
        console.error("[Google Paid Sync] Error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    updateScheduleInGoogleCalendarPaid,
};