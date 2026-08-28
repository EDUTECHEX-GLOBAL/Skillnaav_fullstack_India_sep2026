const mongoose = require("mongoose");

const { Schema } = mongoose;

/**
 * PipelineEvent
 * Append-only events for audit + analytics.
 */
const PipelineEventSchema = new Schema(
  {
    internshipId: { type: Schema.Types.ObjectId, ref: "InternshipPost", required: true, index: true },
    studentId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    partnerId: { type: Schema.Types.ObjectId, ref: "Partner", default: null, index: true },

    type: { type: String, required: true, index: true },

    actor: {
      kind: { type: String, enum: ["partner", "student", "system", "admin"], default: "system" },
      id: { type: Schema.Types.ObjectId, default: null },
    },

    payload: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

PipelineEventSchema.index({ internshipId: 1, createdAt: -1 });
PipelineEventSchema.index({ studentId: 1, createdAt: -1 });

module.exports = mongoose.model("PipelineEvent", PipelineEventSchema);
