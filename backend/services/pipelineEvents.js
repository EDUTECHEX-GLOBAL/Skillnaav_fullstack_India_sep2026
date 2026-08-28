const PipelineEvent = require("../models/pipeline/PipelineEvent");

// Non-blocking audit/event log (never breaks main flow)
async function logEvent({
  internshipId,
  studentId,
  partnerId = null,
  type,
  actorKind = "system",
  actorId = null,
  payload = {},
}) {
  try {
    await PipelineEvent.create({
      internshipId,
      studentId,
      partnerId,
      type,
      actor: { kind: actorKind, id: actorId },
      payload,
    });
  } catch (e) {
    console.error("PipelineEvent log failed:", e.message);
  }
}

module.exports = { logEvent };
