const mongoose = require("mongoose");
const { getCalendarClient, buildCalendarAuthUrl } = require("../meetingController");



const CandidatePipeline = require("../../models/pipeline/CandidatePipeline");
const Interview = require("../../models/pipeline/Interview");
const Partnerwebapp = require("../../models/webapp-models/partnerModel");
const Internship = require("../../models/webapp-models/internshipPostModel");


const {
  sendInterviewScheduledToStudent,
  sendInterviewScheduledToPartner,
} = require("../../utils/interviewMailer");

const { logEvent } = require("../../services/pipelineEvents");

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);


/**
 * =========================================================
 * POST /api/interviews/create
 * Create L3 interview container (NO date, NO link)
 * body: { internshipId, studentId, partnerId }
 * =========================================================
 */
async function createInterview(req, res) {
  try {
    const { internshipId, studentId, partnerId } = req.body;

    if (![internshipId, studentId, partnerId].every(isValidObjectId)) {
      return res.status(400).json({ message: "Invalid ids" });
    }

    // 🔑 CHECK FOR EXISTING ACTIVE INTERVIEW
    const existing = await Interview.findOne({
      internshipId,
      studentId,
      partnerId,
      status: { $nin: ["passed", "rejected"] },
    });

    if (existing) {
      // ✅ REUSE — DO NOT CREATE AGAIN
      return res.json({ interviewId: existing._id });
    }

    // ❌ create only if none exists
    const interview = await Interview.create({
      internshipId,
      studentId,
      partnerId,
      status: "created",
      createdBySystem: true,
    });

    await CandidatePipeline.findOneAndUpdate(
      { internshipId, studentId },
      {
        $set: {
          partnerId,
          stage: "L3",
          "l3.enabled": true,
          "l3.status": "created",
          "l3.interviewId": interview._id,
          "l3.updatedAt": new Date(),
        },
        $setOnInsert: { internshipId, studentId },
      },
      { upsert: true }
    );

    await logEvent({
      internshipId,
      studentId,
      partnerId,
      type: "L3_CREATED",
      actorKind: "partner",
      actorId: partnerId,
      payload: { interviewId: String(interview._id) },
    });

    return res.status(201).json({ interviewId: interview._id });
  } catch (err) {
    console.error("❌ createInterview failed:", err);
    res.status(500).json({ message: "Failed to create interview" });
  }
}

/**
 * =========================================================
 * POST /api/interviews/:id/schedule
 * Auto-generate Google Meet + fix date/time
 * body: {
 *   scheduledAt,
 *   durationMinutes,
 *   timezone,
 *   studentEmail,
 *   studentName,
 *   partnerEmail,
 *   partnerName,
 *   internshipTitle
 * }
 * =========================================================
 */
async function scheduleInterview(req, res) {
  try {
    const { id } = req.params;
    const {
      scheduledAt,
      durationMinutes = 30,
      timezone = "Asia/Kolkata",
      studentEmail,
      studentName,
      internshipTitle,
    } = req.body;

    const interview = await Interview.findById(id);
    if (!interview) {
      return res.status(404).json({ message: "Interview not found" });
    }

    // ✅ Fetch partner
    const partner = await Partnerwebapp.findById(interview.partnerId)
      .select("email name");

    const finalPartnerEmail = partner?.email || null;
    const finalPartnerName = partner?.name || "Partner";

    // ✅ Fetch internship
    const internship = await Internship.findById(interview.internshipId).select("jobTitle companyName");
    const finalInternshipTitle = internship?.jobTitle || internshipTitle || "Internship";
    const finalCompanyName = internship?.companyName || "";

    // ✅ Google Calendar using Partner's Email
    let calendar;
    try {
      calendar = await getCalendarClient(finalPartnerEmail);
    } catch (err) {
      if (err.statusCode === 409 || err.message.includes("Google Calendar credentials")) {
        return res.status(409).json({
          message: "Connect Google Calendar before scheduling an interview.",
          authUrl: buildCalendarAuthUrl(finalPartnerEmail),
        });
      }
      throw err;
    }

    const start = new Date(scheduledAt);
    const end = new Date(start.getTime() + durationMinutes * 60000);

    const event = {
      summary: `SkillNaav Interview – ${finalInternshipTitle}`,
      start: { dateTime: start.toISOString(), timeZone: timezone },
      end: { dateTime: end.toISOString(), timeZone: timezone },
      conferenceData: {
        createRequest: {
          requestId: `skillnaav-${Date.now()}`,
          conferenceSolutionKey: { type: "hangoutsMeet" },
        },
      },
      // Note: attendees intentionally excluded so Google doesn't send 
      // the automated calendar invite from the internal service email.
    };

    let hangoutLink = "";
    try {
      const response = await calendar.events.insert({
        calendarId: "primary",
        resource: event,
        conferenceDataVersion: 1,
      });
      hangoutLink = response.data.hangoutLink || "";
    } catch (gcalErr) {
      console.error("⚠️ Google Calendar API Error:", gcalErr.message);
      
      const needsGoogleAuth = gcalErr.code === 409 || gcalErr.response?.data?.error === "invalid_grant" || gcalErr.message === "invalid_grant";
      if (needsGoogleAuth) {
        return res.status(409).json({
          message: "Your Google Calendar connection is invalid or expired. Please reconnect.",
          authUrl: buildCalendarAuthUrl(finalPartnerEmail),
        });
      }
    }

    // ✅ Update Interview
    interview.link = hangoutLink;
    interview.status = "scheduled";
    interview.scheduledAt = start;
    await interview.save();

    // ✅🔥 UPDATE PIPELINE (THIS IS THE KEY FIX)
    await CandidatePipeline.findOneAndUpdate(
      {
        internshipId: interview.internshipId,
        studentId: interview.studentId,
      },
      {
        $set: {
          stage: "L3",
          "l3.enabled": true,
          "l3.status": "scheduled",   // ✅ NOT "sent"
          "l3.scheduledAt": start,
          "l3.updatedAt": new Date(),
        },
      }
    );

    // ✅ Emails
    await sendInterviewScheduledToStudent({
      to: studentEmail,
      studentName,
      internshipTitle: finalInternshipTitle,
      companyName: finalCompanyName,
      meetLink: interview.link,
      scheduledAt: start,
      timezone,
      partnerName: finalPartnerName,
    });

    if (finalPartnerEmail) {
      await sendInterviewScheduledToPartner({
        to: finalPartnerEmail,
        partnerName: finalPartnerName,
        studentName,
        internshipTitle: finalInternshipTitle,
        companyName: finalCompanyName,
        meetLink: interview.link,
        scheduledAt: start,
        timezone,
      });
    }

    return res.json({
      ok: true,
      meetLink: interview.link,
    });
  } catch (err) {
    console.error("❌ scheduleInterview failed:", err);
    require('fs').appendFileSync('error.log', new Date().toISOString() + ' ' + err.stack + '\n');
    res.status(500).json({ message: "Failed to schedule interview", error: err.message, stack: err.stack });
  }
}





/**
 * =========================================================
 * POST /api/interviews/:id/send
 * Mark invite as sent (email already delivered)
 * =========================================================
 */
async function sendInterviewInvite(req, res) {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid interview id" });
    }

    const interview = await Interview.findById(id);
    if (!interview) {
      return res.status(404).json({ message: "Interview not found" });
    }

    if (interview.status !== "scheduled") {
      return res.status(400).json({ message: "Interview must be scheduled first" });
    }

    interview.status = "sent";
    await interview.save();

    await CandidatePipeline.findOneAndUpdate(
      { internshipId: interview.internshipId, studentId: interview.studentId },
      { $set: { "l3.status": "sent", "l3.updatedAt": new Date() } }
    );

    await logEvent({
      internshipId: interview.internshipId,
      studentId: interview.studentId,
      partnerId: interview.partnerId,
      type: "L3_INVITE_SENT",
      actorKind: "system",
      payload: { interviewId: String(interview._id) },
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error("❌ sendInterviewInvite failed:", err);
    res.status(500).json({ message: "Failed to send interview invite" });
  }
}

/**
 * =========================================================
 * PATCH /api/interviews/:id/status
 * Final outcome: completed / passed / rejected
 * =========================================================
 */
async function updateInterviewStatus(req, res) {
  try {
    const { id } = req.params;
    const { status, notes, rating } = req.body;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid interview id" });
    }

    if (!["completed", "passed", "rejected"].includes(status)) {
      return res.status(400).json({ message: "Invalid status transition" });
    }

    const interview = await Interview.findById(id);
    if (!interview) {
      return res.status(404).json({ message: "Interview not found" });
    }

    interview.status = status;
    if (notes !== undefined) interview.notes = notes;
    if (typeof rating === "number") interview.rating = rating;

    await interview.save();

    await CandidatePipeline.findOneAndUpdate(
      { internshipId: interview.internshipId, studentId: interview.studentId },
      {
        $set: {
          stage: "L3",
          "l3.status": status,
          "l3.updatedAt": new Date(),
        },
      }
    );

    await logEvent({
      internshipId: interview.internshipId,
      studentId: interview.studentId,
      partnerId: interview.partnerId,
      type: "L3_STATUS_UPDATED",
      actorKind: "partner",
      actorId: interview.partnerId,
      payload: { interviewId: String(interview._id), status },
    });

    return res.json({ ok: true, interview });
  } catch (err) {
    console.error("❌ updateInterviewStatus failed:", err);
    res.status(500).json({ message: "Failed to update interview status" });
  }
}

const completeInterview = async (req, res) => {
  try {
    const { id } = req.params;
    const { result, feedback } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid interview id" });
    }

    if (!["passed", "rejected"].includes(result)) {
      return res.status(400).json({ message: "Invalid result" });
    }

    const interview = await Interview.findById(id);
    if (!interview) {
      return res.status(404).json({ message: "Interview not found" });
    }

    if (["passed", "rejected"].includes(interview.status)) {
  return res.status(409).json({ message: "Final decision already made" });
}


    interview.status = "completed";
    interview.result = result;
    interview.feedback = feedback || null;
    interview.completedAt = new Date();
    await interview.save();

    // 🔁 Update pipeline
    await CandidatePipeline.findOneAndUpdate(
      {
        internshipId: interview.internshipId,
        studentId: interview.studentId,
      },
      {
        $set: {
          stage: result === "passed" ? "OFFER" : "L3",
          "l3.status": result,
          "l3.updatedAt": new Date(),
        },
      }
    );

    // 🔔 Notify student
    // await sendNotification({
    //   studentId: interview.studentId,
    //   title:
    //     result === "passed"
    //       ? "Interview Cleared 🎉"
    //       : "Interview Result",
    //   message:
    //     result === "passed"
    //       ? "Congratulations! You have cleared the interview round."
    //       : "Thank you for attending the interview. Unfortunately, you were not selected.",
    //   link: `/student/applications/${interview.internshipId}`,
    //   type: "general",
    // });

    return res.json({ success: true });
  } catch (err) {
    console.error("❌ Interview completion error:", err);
    res.status(500).json({ message: "Failed to complete interview" });
  }
};

const markInterviewCompleted = async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Invalid interview id" });
  }

  const interview = await Interview.findById(id);
  if (!interview) {
    return res.status(404).json({ message: "Interview not found" });
  }

  // ✅ Idempotent
  if (interview.completedAt) {
    return res.json({ ok: true });
  }

  interview.completedAt = new Date();
  interview.status = "completed";
  await interview.save();

  // Update pipeline → decision ready
  await CandidatePipeline.findOneAndUpdate(
    {
      internshipId: interview.internshipId,
      studentId: interview.studentId,
    },
    {
      $set: {
        "l3.status": "completed",
        "l3.updatedAt": new Date(),
      },
    }
  );

  return res.json({ ok: true });
};

module.exports = {
  createInterview,
  scheduleInterview,
  sendInterviewInvite,
  updateInterviewStatus,
  completeInterview,
  markInterviewCompleted,
};
