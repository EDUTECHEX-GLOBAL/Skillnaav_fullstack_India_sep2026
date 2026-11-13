const mongoose = require("mongoose");

const cadFileSchema = new mongoose.Schema(
  {
    fileName: { type: String, required: true, trim: true },
    fileUrl: { type: String, required: true },
    fileFormat: { type: String, trim: true, lowercase: true },
    fileSize: { type: Number, default: 0 },
    sha256: { type: String, default: "" },
  },
  { _id: false }
);

const geometryMetricsSchema = new mongoose.Schema(
  {
    volumeMm3: { type: Number, default: 0 },
    surfaceAreaMm2: { type: Number, default: 0 },
    boundingBoxMm: {
      x: { type: Number, default: 0 },
      y: { type: Number, default: 0 },
      z: { type: Number, default: 0 },
    },
    centerOfMass: {
      x: { type: Number, default: 0 },
      y: { type: Number, default: 0 },
      z: { type: Number, default: 0 },
    },
    triangleCount: { type: Number, default: 0 },
    featureCount: { type: Number, default: 0 },
    isWatertight: { type: Boolean, default: true },
    analyzedBy: { type: String, default: "server-stl" },
  },
  { _id: false }
);

const autoCheckItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    expected: { type: String, default: "" },
    actual: { type: String, default: "" },
    passed: { type: Boolean, required: true },
    message: { type: String, default: "" },
  },
  { _id: false }
);

const versionSnapshotSchema = new mongoose.Schema(
  {
    versionNumber: { type: Number, required: true },
    savedAt: { type: Date, default: Date.now },
    note: { type: String, trim: true, default: "Progress saved" },
    stlUrl: { type: String, default: "" },
    stepUrl: { type: String, default: "" },
    nativeUrl: { type: String, default: "" },
    sceneJson: { type: mongoose.Schema.Types.Mixed, default: null },
    submittedCode: { type: String, default: "" },
    codeLanguage: { type: String, default: "" },
    codeOutput: { type: String, default: "" },
    geometryMetrics: { type: geometryMetricsSchema, default: null },
    sha256: { type: String, default: "" },
  },
  { _id: true }
);

const workspaceSubmissionSchema = new mongoose.Schema(
  {
    assignmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WorkspaceAssignment",
      required: true,
      index: true,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Userwebapp",
      required: true,
      index: true,
    },
    studentName: { type: String, trim: true, default: "Student" },
    studentEmail: { type: String, trim: true, default: "" },
    schoolName: { type: String, trim: true, default: null },

    status: {
      type: String,
      enum: ["in-progress", "submitted", "graded", "returned"],
      default: "in-progress",
      index: true,
    },

    activeStatus: {
      type: String,
      enum: ["not-started", "working", "idle", "submitted", "graded", "returned"],
      default: "working",
    },
    lastActiveAt: { type: Date, default: Date.now, index: true },
    timeSpentSeconds: { type: Number, default: 0 },
    runCount: { type: Number, default: 0 },
    editCount: { type: Number, default: 0 },
    lastAction: { type: String, trim: true, default: "" },
    workSummary: { type: String, trim: true, default: "" },
    liveData: { type: mongoose.Schema.Types.Mixed, default: null },
    activityLog: {
      type: [
        {
          timestamp: { type: Date, default: Date.now },
          action: { type: String, trim: true, default: "" },
          detail: { type: String, trim: true, default: "" },
        },
      ],
      default: [],
    },

    currentFiles: { type: [cadFileSchema], default: [] },
    stlUrl: { type: String, default: "" },
    stepUrl: { type: String, default: "" },
    nativeUrl: { type: String, default: "" },
    sceneJson: { type: mongoose.Schema.Types.Mixed, default: null },
    submittedCode: { type: String, default: "" },
    codeLanguage: { type: String, default: "" },
    codeOutput: { type: String, default: "" },

    geometryMetrics: { type: geometryMetricsSchema, default: null },
    autoCheckResults: {
      passed: { type: Boolean, default: false },
      passedCount: { type: Number, default: 0 },
      totalChecks: { type: Number, default: 0 },
      checks: { type: [autoCheckItemSchema], default: [] },
    },

    versions: { type: [versionSnapshotSchema], default: [] },

    plagiarismFlags: {
      duplicateHashMatch: { type: Boolean, default: false },
      matchedStudentIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Userwebapp" }],
      note: { type: String, default: "" },
    },

    grade: {
      score: { type: Number, default: null },
      maxScore: { type: Number, default: 100 },
      rubricScores: [
        {
          criterion: String,
          points: Number,
          maxPoints: Number,
          comment: String,
        },
      ],
      feedback: { type: String, default: "" },
      gradedBy: { type: mongoose.Schema.Types.ObjectId, default: null },
      gradedByName: { type: String, default: "" },
      gradedAt: { type: Date, default: null },
    },

    submittedAt: { type: Date, default: null },
    isLate: { type: Boolean, default: false },
    studentNotes: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

workspaceSubmissionSchema.index({ assignmentId: 1, studentId: 1 }, { unique: true });

// Keep explicit "cadsubmissions" collection name so existing submissions remain intact
module.exports = mongoose.model("WorkspaceSubmission", workspaceSubmissionSchema, "cadsubmissions");

