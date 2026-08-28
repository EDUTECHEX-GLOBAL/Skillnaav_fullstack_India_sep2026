//File: scheduleController.js

const InternshipSchedule = require('../models/webapp-models/InternshipScheduleModel');
const { addScheduleToGoogleCalendar } = require('../controllers/GoogleController');
const Student = require('../models/webapp-models/userModel'); // <-- replace with your actual student model
const OfferLetter = require('../models/webapp-models/offerLetterModel');
const notifyUser = require('../utils/notifyUser');
const sendNotification = require('../utils/Notification');

const timeToMinutes = (t = "") => {
  const [hh, mm] = String(t).split(":");
  const h = Number(hh);
  const m = Number(mm);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return NaN;
  return h * 60 + m;
};

// ✅ Only keep the selected internship type slots (online OR offline OR hybrid)
const sanitizeTimeSlots = (timeSlots = {}, onlyType) => {
  const type = String(onlyType || "").toLowerCase();
  const allowed = ["online", "offline", "hybrid"];
  if (!allowed.includes(type)) return null;

  const arr = Array.isArray(timeSlots[type]) ? timeSlots[type] : [];

  return {
    [type]: arr
      .filter(s => s && (s.startTime || s.endTime)) // keep partially filled to validate
      .map(s => ({
        startTime: String(s.startTime || "").trim(),
        endTime: String(s.endTime || "").trim()
      }))
  };
};

const validateSlotsForTypeBackend = (slotsByType, type) => {
  const slots = slotsByType?.[type] || [];

  // Only validate if timeSlots is being used (paid schedule sends it)
  if (!slots.length) {
    return `Please add at least 1 Time Slot under ${type.toUpperCase()} (Select Time Slot is mandatory).`;
  }

  const hasIncomplete = slots.some(s => !(s?.startTime && s?.endTime));
  if (hasIncomplete) {
    return `Please fill both Start Time and End Time for all Slot(s) under ${type.toUpperCase()} (or remove incomplete slots).`;
  }

  for (let i = 0; i < slots.length; i++) {
    const s = slots[i];
    const start = timeToMinutes(s.startTime);
    const end = timeToMinutes(s.endTime);

    if (!Number.isFinite(start) || !Number.isFinite(end)) {
      return `Invalid time format in Slot ${i + 1} under ${type.toUpperCase()}.`;
    }
    if (end <= start) {
      return `Slot ${i + 1}: End Time must be after Start Time under ${type.toUpperCase()}.`;
    }
  }

  return null;
};

// ✅ Anthropic SDK (replaces AWS Bedrock)
const Anthropic = require("@anthropic-ai/sdk");

// ✅ IMPORTANT: Use the SAME internship model you use in /api/interns/:id route
// Change the path/name if your model file name is different
const Internship = require('../models/webapp-models/internshipPostModel');

// Utility function to fetch student who accepted
const getStudentByInternshipId = async (internshipId) => {
  // Adjust query based on your schema (assumption: status = 'accepted')
  return await Student.findOne({ internshipId, status: 'accepted' });
};

// Send schedule email only to accepted students of this internship
async function notifyAcceptedStudentsOfSchedule({ internshipId, scheduleDoc, isNew }) {
  // Find accepted offers for this internship
  const offers = await OfferLetter
    .find({ internshipId, status: 'Accepted' })
    .select('email studentId name')
    .lean();

  if (!offers.length) return; // nobody accepted yet → do nothing

  // Minimal “what’s next” preview
  const upcoming = (scheduleDoc?.timetable || []).find(s => {
    const d = new Date(s.date);
    const today = new Date();
    d.setHours(0, 0, 0, 0); today.setHours(0, 0, 0, 0);
    return d >= today;
  });

  const subject = isNew
    ? 'Your internship schedule is published'
    : 'Your internship schedule was updated';

  // Send users to the offer letter tab
  const appUrl = (process.env.FRONTEND_BASE_URL || process.env.WEBAPP_BASE_URL || 'https://www.skillnaav.com') + '/user-main-page/offer-letter';

  const previewHtml = upcoming
    ? `<p><b>Next session:</b> ${new Date(upcoming.date).toLocaleDateString('en-IN')} ${upcoming.startTime}–${upcoming.endTime} (${upcoming.type || 'online'})</p>`
    : '';

  // Send emails
  await Promise.all(
    offers.map(o =>
      notifyUser(
        o.email,
        subject,
        `
        <p>Hi ${o.name || 'there'},</p>
        <p>${isNew ? 'A new' : 'An updated'} schedule has been posted for your internship.</p>
        ${previewHtml}
        <p><a href="${appUrl}">Open your dashboard</a> to view all sessions.</p>
        <p>- Skillnaav Team</p>
        `
      ).catch(err => console.error('Schedule email failed:', o.email, err))
    )
  );

  // Optional in-app notification
  await Promise.all(
    offers.map(o =>
      sendNotification({
        studentId: o.studentId,
        title: isNew ? 'Schedule published' : 'Schedule updated',
        message: 'Tap to view your sessions.',
        link: appUrl,
        type: 'schedule'
      }).catch(() => { })
    )
  );
}

const sanitizeTimetableEntries = (timetable = []) => {
  return timetable.map((entry) => {
    const entryType = entry.type || "online";

    return {
      date: new Date(entry.date),
      day: entry.day,
      startTime: entry.startTime,
      endTime: entry.endTime,
      eventLink: entry.eventLink || "",
      sectionSummary: entry.sectionSummary || "",
      instructor: entry.instructor || "",
      assignment: entry.assignment || null,
      type: entryType,
      location: entryType === "online" ? null : {
        name: entry.location?.name || "",
        address: entry.location?.address || "",
        mapLink: entry.location?.mapLink || ""
      },
      eventId: entry.eventId || "",
      events: (entry.events || [])
        .filter(ev => ev && String(ev.description || "").trim())
        .map((ev) => {
          const evType = ev.type || "online";
          return {
            description: ev.description,
            type: evType,
            location: evType === "online" ? null : {
              name: ev.location?.name || "",
              address: ev.location?.address || "",
              mapLink: ev.location?.mapLink || ""
            }
          };
        }),
      sessionOtp: entry.sessionOtp || undefined,
      mockInterview: entry.mockInterview || undefined
    };
  });
};

// Create or update a schedule
const updateInternshipSchedule = async (req, res) => {
  try {
    const {
      internshipId,
      partnerId,
      startDate,
      endDate,
      workHours,
      timetable = [],
      defaultStartTime,
      defaultEndTime,
      defaultEventLink,
      defaultLocation,
      defaultType,
      selectedDays,
      timeSlots,
      batches = [],
      attendanceSettings
    } = req.body;

    if (!internshipId || !partnerId || !startDate || !endDate || !workHours) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const minPercent = attendanceSettings?.minAttendancePercent;
    if (minPercent === undefined || minPercent === null || minPercent < 1 || minPercent > 100) {
      return res.status(400).json({ error: 'minAttendancePercent is required and must be between 1 and 100.' });
    }

    // ✅ Paid schedule: validate timeSlots ONLY if frontend sends it
    let sanitizedSlots = null;
    if (timeSlots && typeof timeSlots === "object") {
      const typeToValidate = defaultType || "online";

      // ✅ sanitize only selected type
      sanitizedSlots = sanitizeTimeSlots(timeSlots, typeToValidate);

      const slotErr = validateSlotsForTypeBackend(sanitizedSlots, typeToValidate);
      if (slotErr) {
        return res.status(400).json({ error: slotErr });
      }
    }

    // Sanitize timetable for saving
    const sanitizedTimetable = sanitizeTimetableEntries(timetable);

    // Sanitize batches if present
    let sanitizedBatches = [];
    if (Array.isArray(batches) && batches.length > 0) {
      sanitizedBatches = batches.map(batch => ({
        timeSlot: String(batch.timeSlot || "").trim(),
        timetable: sanitizeTimetableEntries(batch.timetable || [])
      }));
    }

    const scheduleData = {
      internshipId,
      partnerId,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      workHours,
      defaultStartTime,
      defaultEndTime,
      defaultEventLink,
      defaultLocation: (defaultType === 'online') ? null : {
        name: defaultLocation?.name || '',
        address: defaultLocation?.address || '',
        mapLink: defaultLocation?.mapLink || ''
      },
      defaultType,
      selectedDays,

      // ✅ Save Select Time Slots (Paid schedule only)
      ...(sanitizedSlots ? { timeSlots: sanitizedSlots } : {}),

      timetable: sanitizedTimetable,
      batches: sanitizedBatches,
      attendanceSettings: {
        minAttendancePercent: minPercent,
        onlineMinDurationMins: attendanceSettings?.onlineMinDurationMins ?? 0,
        trackingEnabled: attendanceSettings?.trackingEnabled ?? true
      }
    };

    let schedule = await InternshipSchedule.findOne({ internshipId, partnerId });

    // 🚫 Block updates if schedule already closed
    if (schedule && schedule.isClosed) {
      return res.status(403).json({
        error: 'This schedule has been closed permanently and cannot be updated.'
      });
    }

    let wasCreated = false;
    if (schedule) {
      schedule.set(scheduleData);
    } else {
      schedule = new InternshipSchedule(scheduleData);
      wasCreated = true;
    }

    // ✅ ADD THIS
    if (sanitizedSlots) {
      schedule.timeSlots = sanitizedSlots;
      schedule.markModified("timeSlots");
    }

    if (sanitizedBatches.length > 0) {
      schedule.batches = sanitizedBatches;
      schedule.markModified("batches");
    }

    // ✅ Faster save for big schedules (skip mongoose validations; you already sanitize fields)
    if (sanitizedTimetable.length > 80) {
      await schedule.save({ validateBeforeSave: false });
    } else {
      await schedule.save();
    }

    // ✅ RESPOND IMMEDIATELY (FAST)
    res.status(200).json({
      message: "Schedule saved successfully",
      schedule,
    });

    // ✅ Run email + calendar sync AFTER response (non-blocking)
    setImmediate(async () => {
      // 1) Emails + in-app notification
      try {
        await notifyAcceptedStudentsOfSchedule({
          internshipId,
          scheduleDoc: schedule,
          isNew: wasCreated,
        });
      } catch (e) {
        console.error("notifyAcceptedStudentsOfSchedule failed:", e);
      }

      // 2) Google Calendar sync
      try {
        const acceptedOffers = await OfferLetter
          .find({ internshipId, status: "Accepted" })
          .select("email")
          .lean();

        await Promise.allSettled(
          acceptedOffers.map((o) =>
            addScheduleToGoogleCalendar({
              studentEmail: o.email,
              timetable: sanitizedTimetable,
              internshipTitle: "Internship Schedule",
            })
          )
        );
      } catch (e) {
        console.error("Google Calendar sync failed:", e);
      }
    });

    return; // ✅ IMPORTANT: stop execution (response already sent)

  } catch (err) {
    console.error('Schedule Save Error:', err);
    return res.status(500).json({
      error: err.message || 'Failed to save schedule',
    });
  }
};

// Get schedule by internshipId and partnerId
const getInternshipSchedule = async (req, res) => {
  try {
    const { internshipId, partnerId } = req.query;

    if (!internshipId || !partnerId) {
      return res.status(400).json({ error: 'Missing internshipId or partnerId' });
    }

    const schedule = await InternshipSchedule.findOne({ internshipId, partnerId });

    if (!schedule) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    return res.status(200).json(schedule);
  } catch (err) {
    console.error('Fetch Schedule Error:', err);
    return res.status(500).json({ error: err.message || 'Failed to fetch schedule' });
  }
};

// ✅ Anthropic client (uses ANTHROPIC_API_KEY from .env)
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

function extractJson(text) {
  if (!text) return null;

  // Remove common wrappers if the model accidentally adds them
  let t = String(text).trim()
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  // Try direct parse first
  try {
    const parsed = JSON.parse(t);
    return parsed;
  } catch (e) { /* ignore */ }

  // Fallback: slice first JSON array/object region
  const firstArray = t.indexOf("[");
  const lastArray = t.lastIndexOf("]");
  if (firstArray !== -1) {
    let slice = lastArray !== -1 ? t.slice(firstArray, lastArray + 1) : t.slice(firstArray);

    // If truncated: close array at last complete object
    if (lastArray === -1) {
      const lastObjEnd = slice.lastIndexOf("}");
      if (lastObjEnd !== -1) slice = slice.slice(0, lastObjEnd + 1) + "]";
    }

    // Remove trailing commas
    slice = slice.replace(/,\s*]/g, "]").replace(/,\s*}/g, "}");

    // Replace smart quotes just in case
    slice = slice.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");

    try { return JSON.parse(slice); } catch (e) { /* ignore */ }
  }

  return null;
}

// ✅ ADD THIS (just below extractJson)
function chunkArray(arr = [], size = 20) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

// ✅ ADD THIS (just below chunkArray)
function clampSummary(text = "", max = 200) {
  const t = String(text || "").trim();
  return t.length > max ? t.slice(0, max - 1).trim() : t;
}

// ✅ ADD THIS (just below clampSummary)
function getClassificationGuidance(classification = "") {
  const c = String(classification || "").trim().toLowerCase();

  if (c === "basic") {
    return [
      "- Keep the work beginner-friendly and foundation-oriented.",
      "- Use simple terminology and small guided tasks.",
      "- Focus on onboarding, tool familiarization, observation, basic practice, and simple outcomes.",
      "- Avoid advanced ownership, architecture, optimization, or expert-level wording."
    ].join("\n");
  }

  if (c === "intermediate") {
    return [
      "- Assume the intern knows the basics and can do guided hands-on work.",
      "- Include practical tasks, moderate analysis, structured problem-solving, and collaboration.",
      "- Focus on applying concepts, completing assigned tasks, and producing usable outputs.",
      "- Avoid expert-only research, strategy ownership, or very advanced technical depth."
    ].join("\n");
  }

  return [
    "- Treat the internship as advanced and outcome-driven.",
    "- Use deeper analysis, independent execution, optimization, evaluation, ownership, and measurable results.",
    "- Include complex problem-solving, stronger decision-making, and polished deliverables.",
    "- Keep the wording realistic for an advanced internship, while still concise."
  ].join("\n");
}

// ✅ ADD THIS (just below getClassificationGuidance)
function getFallbackSummaryByClassification(phasePrefix = "Setup:", classification = "") {
  const c = String(classification || "").trim().toLowerCase();

  const fallbackMap = {
    basic: {
      "Setup:": "Setup: set up tools, understand basics, and follow guided onboarding tasks.",
      "Practice:": "Practice: work on a simple hands-on task and apply core concepts step by step.",
      "Outcome:": "Outcome: complete a basic deliverable and document key learnings clearly."
    },
    intermediate: {
      "Setup:": "Setup: review workflow, align on goals, and prepare for practical task execution.",
      "Practice:": "Practice: complete structured hands-on work and apply concepts with moderate independence.",
      "Outcome:": "Outcome: finalize a practical output and summarize results with clear observations."
    },
    advanced: {
      "Setup:": "Setup: align on objectives, tools, and scope for deeper task ownership.",
      "Practice:": "Practice: execute complex work, analyze outcomes, and refine the approach independently.",
      "Outcome:": "Outcome: deliver a strong result, validate impact, and document final recommendations."
    },
    generic: {
      "Setup:": "Setup: set up tools and understand today’s goals.",
      "Practice:": "Practice: complete a hands-on task and capture learnings.",
      "Outcome:": "Outcome: finalize output and document results clearly."
    }
  };

  const bucket = fallbackMap[c] || fallbackMap.generic;
  return bucket[phasePrefix] || bucket["Setup:"];
}

async function runWithConcurrency(items, concurrency, handler) {
  let idx = 0;
  const workers = new Array(Math.max(1, concurrency)).fill(0).map(async () => {
    while (idx < items.length) {
      const current = idx++;
      await handler(items[current], current);
    }
  });
  await Promise.all(workers);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ✅ Anthropic Claude (replaces AWS Bedrock Nova Pro)
async function bedrockGenerateText({ prompt, maxTokens = 1200, retries = 2 }) {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("Missing ANTHROPIC_API_KEY in .env");
  }

  try {
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001", // fast + cheap; swap to claude-sonnet-4-6 for higher quality
      max_tokens: maxTokens,
      temperature: 0.3,
      messages: [{ role: "user", content: prompt }],
    });

    return message.content?.[0]?.text || "";
  } catch (err) {
    const status = err?.status || err?.statusCode;
    const isThrottled = status === 429 || String(err?.message || "").toLowerCase().includes("rate");

    if (isThrottled && retries > 0) {
      await sleep((3 - retries) * 800);
      return bedrockGenerateText({ prompt, maxTokens, retries: retries - 1 });
    }
    throw err;
  }
}
const generateAiSectionSummaries = async (req, res) => {
  try {
    const { internshipId, totalDays, days, batchTimeSlot } = req.body;

    if (!internshipId) {
      return res.status(400).json({ error: "Missing internshipId" });
    }
    if (!Array.isArray(days) || days.length === 0) {
      return res.status(400).json({ error: "Missing days list" });
    }

    // ✅ Fetch internship data (jobTitle/jobDescription/etc.) from your PostAJob saved doc
    const internship = await Internship.findById(internshipId).lean();
    if (!internship) {
      return res.status(404).json({ error: "Internship not found" });
    }

    const context = {
      jobTitle: internship.jobTitle || "",
      companyName: internship.companyName || "",
      sector: internship.sector || "",
      classification: internship.classification || "",
      mode: internship.mode || "",
      jobDescription: internship.jobDescription || "",
      qualifications: internship.qualifications || [],
      duration: internship.duration || "",
      location: internship.location || "",
    };

    const compactContext = {
      jobTitle: context.jobTitle,
      companyName: context.companyName,
      sector: context.sector,
      classification: context.classification,
      mode: context.mode,
      location: context.location,
      duration: context.duration,
      jobDescription: String(context.jobDescription || "").slice(0, 900), // ✅ reduce tokens
      qualifications: Array.isArray(context.qualifications)
        ? context.qualifications.slice(0, 10)
        : [],
    };

    const classificationGuidance = getClassificationGuidance(compactContext.classification);

    // ✅ milestone + day mapping (prompt rules)
    const N = Number(totalDays || days.length || 0);
    const earlyEnd = Math.max(1, Math.round(N * 0.33));
    const middleEnd = Math.max(1, Math.round(N * 0.75));
    const dayNumToDate = {};
    days.forEach(d => {
      if (d?.dayNumber && d?.date) dayNumToDate[d.dayNumber] = String(d.date).slice(0, 10);
    });

    // milestone day numbers
    const dCheckpoint = Math.max(1, Math.round(N * 0.25));
    const dMid = Math.max(1, Math.round(N * 0.50));
    const dFinal = Math.max(1, Math.round(N * 0.90));

    const milestones = [
      { label: "Checkpoint", dayNumber: dCheckpoint, date: dayNumToDate[dCheckpoint] || null },
      { label: "Mid-review", dayNumber: dMid, date: dayNumToDate[dMid] || null },
      { label: "Final deliverable", dayNumber: dFinal, date: dayNumToDate[dFinal] || null },
    ].filter(m => m.date);

    // ✅ chunk + parallel calls
    const CHUNK_SIZE = Number(process.env.BEDROCK_DAYS_PER_CALL || 25);
    const CONCURRENCY = Number(process.env.BEDROCK_CONCURRENCY || 3);

    // ✅ only send minimal day fields to AI
    const normalizedDays = (days || []).map(d => ({
      date: String(d.date).slice(0, 10),
      dayNumber: d.dayNumber,
      type: d.type || "online",
    }));

    // Build milestone lookup
    const milestoneLabelByDate = {};
    milestones.forEach(m => {
      if (m?.date) milestoneLabelByDate[String(m.date).slice(0, 10)] = m.label;
    });

    const summaryMap = {}; // date -> sectionSummary
    const chunks = chunkArray(normalizedDays, CHUNK_SIZE);

    // ✅ PARALLEL execution
    await runWithConcurrency(chunks, CONCURRENCY, async (chunk) => {
      const prompt = `
You generate "Section Summary" text for an internship schedule.

Return ONLY valid JSON array (no markdown, no extra text), exactly:
[
  { "date": "YYYY-MM-DD", "sectionSummary": "..." }
]

Rules:
- MUST include an item for EVERY input day in THIS request (same dates, no missing).
- Each sectionSummary must be 1–2 lines, max 200 characters.
- Do NOT repeat the same sectionSummary across days.
- Use dayNumber to maintain progress across the full internship (dayNumber is global).

Phase format (MANDATORY):
- If dayNumber <= ${earlyEnd}, sectionSummary MUST start with "Setup:" and focus on setup + understanding.
- If ${earlyEnd} < dayNumber <= ${middleEnd}, sectionSummary MUST start with "Practice:" and focus on practice + hands-on work.
- If dayNumber > ${middleEnd}, sectionSummary MUST start with "Outcome:" and focus on outcomes + results.

Classification-specific rules (MANDATORY):
- Current internship classification: ${compactContext.classification || "Not provided"}
${classificationGuidance}

${batchTimeSlot ? `Batch context:
- Time slot: ${batchTimeSlot} (Please tailor summaries to fit a session running during this time slot if relevant)
` : ""}

Milestone requirements:
- If a milestone date is in this chunk, that day's summary MUST include the milestone label word:
${JSON.stringify(milestones, null, 2)}

Internship info:
${JSON.stringify(compactContext, null, 2)}

Days (do not change dates):
${JSON.stringify(chunk, null, 2)}
`;

      const maxTokens = Math.min(1800, 250 + chunk.length * 55);

      const raw = await bedrockGenerateText({ prompt, maxTokens });
      const parsed = extractJson(raw);

      if (!Array.isArray(parsed)) {
        console.error("Bedrock output (not JSON array):", raw);
        throw new Error("AI did not return valid JSON.");
      }

      parsed.forEach(x => {
        if (!x?.date) return;
        const dt = String(x.date).slice(0, 10);
        if (!dt) return;
        summaryMap[dt] = clampSummary(x.sectionSummary || "", 200);
      });
    });

    // ✅ GUARANTEE: return summary for every requested day
    const used = new Set();

    const summaries = normalizedDays.map(d => {
      const dt = d.date;
      const milestoneLabel = milestoneLabelByDate[dt];

      const phasePrefix =
        d.dayNumber <= earlyEnd
          ? "Setup:"
          : d.dayNumber <= middleEnd
            ? "Practice:"
            : "Outcome:";

      let text = summaryMap[dt];

      // fallback only if missing
      if (!text || !text.trim()) {
        text = getFallbackSummaryByClassification(
          phasePrefix,
          compactContext.classification
        );
      } else {
        // Ensure the output follows required phase prefix (in case AI forgets)
        if (!/^(Setup:|Practice:|Outcome:)\s*/i.test(String(text).trim())) {
          text = `${phasePrefix} ${text}`;
        }
      }

      // ✅ Ensure milestone word exists WITHOUT breaking the required prefix
      if (milestoneLabel && !String(text).toLowerCase().includes(milestoneLabel.toLowerCase())) {
        text = String(text).replace(/^(Setup:|Practice:|Outcome:)\s*/i, (m) => `${m}${milestoneLabel} - `);
      }

      text = clampSummary(text, 200);

      // ✅ Prevent duplicates without breaking prefix format
      if (used.has(text)) {
        text = clampSummary(`${text} (Day ${d.dayNumber})`, 200);
      }
      used.add(text);

      return {
        date: dt,
        sectionSummary: text,
      };
    });

    return res.status(200).json({ summaries });
  } catch (err) {
    console.error("generateAiSectionSummaries error:", err);
    return res.status(500).json({ error: err.message || "AI generation failed" });
  }
};

const generateAiMockInterviewQuestions = async (req, res) => {
  try {
    const { internshipId } = req.body;
    if (!internshipId) return res.status(400).json({ error: "Missing internshipId" });

    const internship = await Internship.findById(internshipId).lean();
    if (!internship) return res.status(404).json({ error: "Internship not found" });

    const prompt = `
You generate exactly 4 mock interview questions for an internship.
Internship Title: ${internship.jobTitle || "Not provided"}
Sector: ${internship.sector || "Not provided"}
Description: ${internship.jobDescription || "Not provided"}

Rules:
1. You MUST generate exactly 4 questions.
2. The first question MUST be a variant of: "Is this internship useful to you so far? Why or why not?" (keep it simple and basic).
3. The next 3 questions should be basic, simple questions related to the internship sector or skills.
4. Return ONLY a valid JSON array of strings. No markdown, no explanation.

Example Output:
[
  "How useful is this internship to you so far?",
  "What is the most important skill for a data analyst?",
  "Can you describe a challenge you faced and how you solved it?",
  "Why do you want to work in this industry?"
]
    `;

    const raw = await bedrockGenerateText({ prompt, maxTokens: 800 });
    let parsed;
    try {
      parsed = JSON.parse(raw.trim().replace(/^```json/, "").replace(/```$/, ""));
    } catch (e) {
      const match = raw.match(/\[([\s\S]*?)\]/);
      if (match) parsed = JSON.parse(match[0]);
      else throw new Error("Could not parse JSON array from AI output.");
    }

    if (!Array.isArray(parsed) || parsed.length !== 4) {
      throw new Error("AI did not return exactly 4 questions.");
    }

    return res.status(200).json({ questions: parsed });
  } catch (err) {
    console.error("generateAiMockInterviewQuestions error:", err);
    return res.status(500).json({ error: err.message || "AI generation failed" });
  }
};

const MockInterviewSubmission = require('../models/webapp-models/MockInterviewSubmissionModel');

const submitMockInterview = async (req, res) => {
  try {
    const { studentId, internshipId, partnerId, scheduleDate, answers } = req.body;

    if (!studentId || !internshipId || !partnerId || !scheduleDate || !answers) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const submission = new MockInterviewSubmission({
      studentId,
      internshipId,
      partnerId,
      scheduleDate,
      answers,
      status: 'completed',
      submittedAt: new Date()
    });
    
    await submission.save();
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("submitMockInterview error:", err);
    return res.status(500).json({ error: err.message || "Failed to submit mock interview" });
  }
};

const getMockInterviewResults = async (req, res) => {
  try {
    const partnerId = req.user._id || req.user.id;
    const submissions = await MockInterviewSubmission.find({ partnerId })
      .populate('internshipId', 'jobTitle companyName')
      .populate('studentId', 'firstName lastName email profilePhoto')
      .sort({ submittedAt: -1 })
      .lean();
    
    return res.status(200).json({ submissions });
  } catch (err) {
    console.error("getMockInterviewResults error:", err);
    return res.status(500).json({ error: err.message || "Failed to fetch mock interview results" });
  }
};

module.exports = {
  updateInternshipSchedule,
  getInternshipSchedule,
  generateAiSectionSummaries,
  generateAiMockInterviewQuestions,
  submitMockInterview,
  getMockInterviewResults,
};