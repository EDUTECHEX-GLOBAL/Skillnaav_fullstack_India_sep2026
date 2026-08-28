const mongoose = require("mongoose");
const CandidatePipeline = require("../../models/pipeline/CandidatePipeline");
const { logEvent } = require("../../services/pipelineEvents");

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

/**
 * GET /api/pipeline/internship/:internshipId?stage=L1|L2|L3
 */
async function getPipelineByInternship(req, res) {
  const { internshipId } = req.params;

  if (!isValidObjectId(internshipId)) {
    return res.status(400).json({ message: "Invalid internship id" });
  }

  const pipelines = await CandidatePipeline.find({ internshipId })
    .populate("studentId", "name email")
    .populate({
      path: "l3.interviewId",
      model: "Interview",
      select: "link scheduledAt durationMinutes timezone status completedAt",
    })
    .lean();

  const hasAssessment = (pipeline) => {
    const status = pipeline?.l2?.status;
    return Boolean(
      pipeline?.l2?.enabled ||
      pipeline?.l2?.assessmentId ||
      (status && status !== "not_used")
    );
  };

  const grouped = {
  L1: pipelines.filter(p => p.stage === "L1"),
  L2: pipelines.filter(p => p.stage === "L2" || hasAssessment(p)),
  L3: pipelines.filter(p => p.stage === "L3"),
  OFFER: pipelines.filter(p => p.stage === "OFFER"),
};


  res.json(grouped);
}


/**
 * POST /api/pipeline/internship/:internshipId/promote
 * ❌ L2 promotion DISABLED
 * ✅ Only L3 allowed
 */
async function promoteCandidates(req, res) {
  const { internshipId } = req.params;
  const { studentIds, toStage, partnerId } = req.body;

  if (toStage !== "L3") {
    return res.status(400).json({
      message: "Manual promotion is only allowed to Level 3",
    });
  }

  if (
    !isValidObjectId(internshipId) ||
    !isValidObjectId(partnerId) ||
    !Array.isArray(studentIds)
  ) {
    return res.status(400).json({ message: "Invalid data" });
  }

  const now = new Date();
  const bulk = [];

  for (const sid of studentIds) {
    if (!isValidObjectId(sid)) continue;

    bulk.push({
      updateOne: {
        filter: { internshipId, studentId: sid },
        update: {
          $set: {
            stage: "L3",
            partnerId,
            "l3.enabled": true,
            "l3.status": "created",
            "l3.updatedAt": now,
          },
        },
        upsert: true,
      },
    });

    logEvent({
      internshipId,
      studentId: sid,
      partnerId,
      type: "PROMOTED_TO_L3",
      actorKind: "partner",
      actorId: partnerId,
    });
  }

  await CandidatePipeline.bulkWrite(bulk);

  return res.json({ ok: true });
}


/**
 * PATCH /api/pipeline/:internshipId/:studentId
 * body: { stage?, l1Status?, l2Status?, l3Status?, score? }
 */
async function updatePipeline(req, res) {
  const { internshipId, studentId } = req.params;
  const { stage, l1Status, l2Status, l3Status, score } = req.body;

  if (!isValidObjectId(internshipId) || !isValidObjectId(studentId)) {
    return res.status(400).json({ message: "Invalid ids" });
  }

  const now = new Date();
  const set = {};

  if (stage && ["L1", "L2", "L3"].includes(stage)) set.stage = stage;

  if (l1Status && ["shortlisted", "rejected"].includes(l1Status)) {
    set["l1.status"] = l1Status;
    set["l1.updatedAt"] = now;
  }

  const l2Allowed = ["not_used", "generated", "sent", "started", "submitted", "evaluated", "passed", "rejected", "expired"];
  if (l2Status && l2Allowed.includes(l2Status)) {
    set["l2.status"] = l2Status;
    set["l2.updatedAt"] = now;
  }

  const l3Allowed = ["not_used", "created", "sent", "scheduled", "completed", "passed", "rejected"];
  if (l3Status && l3Allowed.includes(l3Status)) {
    set["l3.status"] = l3Status;
    set["l3.updatedAt"] = now;
  }

  if (typeof score === "number") set["l2.score"] = score;

  const item = await CandidatePipeline.findOneAndUpdate(
    { internshipId, studentId },
    { $set: set, $setOnInsert: { internshipId, studentId } },
    { new: true, upsert: true }
  );

  return res.json({ item });
}

module.exports = { getPipelineByInternship, promoteCandidates, updatePipeline };
