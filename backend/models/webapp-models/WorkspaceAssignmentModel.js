const mongoose = require("mongoose");

const starterFileSchema = new mongoose.Schema(
  {
    fileName: { type: String, required: true, trim: true },
    fileUrl: { type: String, required: true },
    fileFormat: { type: String, trim: true, lowercase: true },
    fileSize: { type: Number, default: 0 },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const rubricCriterionSchema = new mongoose.Schema(
  {
    criterion: { type: String, required: true, trim: true },
    maxPoints: { type: Number, required: true, min: 1 },
    description: { type: String, trim: true, default: "" },
  },
  { _id: false }
);

const workspaceAssignmentSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    instructions: { type: String, trim: true, default: "" },
    category: {
      type: String,
      trim: true,
      default: "Mechanical CAD",
    },
    toolType: {
      type: String,
      enum: [
        "builtin-cad",
        "jscad-studio",
        "cpp-compiler",
        "python-lab",
        "java-compiler",
        "go-rust-compiler",
        "sql-lab",
        "web-sandbox",
        "html-css-js-studio",
        "typescript-compiler",
        "php-compiler",
        "ruby-compiler",
        "csharp-compiler",
        "bash-shell-lab",
        "regex-json-lab",
        "data-lab",
        "mermaid-studio",
        "diagram-studio",
        "whiteboard-lab",
        "markdown-lab",
        "livecodes-playground",
        "p5js-editor",
        "excalidraw-board",
        "cyberchef-lab",
        "circuit-sim",
        "wokwi-sim",
        "jupyter-lite",
        "freecad-wasm",
        "freecad-container",
        "openscad-wasm",
        "solvespace-web",
        "quirk-quantum",
        "3dmol-viewer",
        "phet-molecule-shapes",
        "phet-greenhouse",
        "phet-gravity-orbits",
        "phet-neuron",
        "phet-energy-forms",
        "phet-circuit-dc",
        "umap-gis-studio",
        "custom-oss-tool",
      ],
      default: "builtin-cad",
      index: true,
    },
    workDate: { type: Date, default: Date.now },
    starterCode: { type: String, default: "" },
    starterData: { type: mongoose.Schema.Types.Mixed, default: null },
    codeLanguage: { type: String, trim: true, default: "cpp" },
    expectedOutput: { type: String, default: "" },
    difficulty: {
      type: String,
      enum: ["Beginner", "Intermediate", "Advanced"],
      default: "Beginner",
    },
    workspaceMode: {
      type: String,
      enum: [
        "builtin-cad",
        "jscad",
        "code",
        "web",
        "sql",
        "diagram",
        "whiteboard",
        "data",
        "markdown",
        "regex",
        "iframe",
        "freecad-wasm",
        "freecad-container",
        "hybrid",
      ],
      default: "builtin-cad",
    },
    externalToolUrl: { type: String, trim: true, default: "" },

    targetScope: {
      type: String,
      enum: ["all", "school", "internship"],
      default: "all",
      index: true,
    },
    internshipId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "InternshipPosting",
      default: null,
      index: true,
    },
    internshipTitle: { type: String, trim: true, default: "" },
    targetAudience: {
      type: String,
      enum: ["all-applicants", "shortlisted-accepted", "specific-students"],
      default: "all-applicants",
    },
    targetStudentIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Userwebapp", index: true }],

    createdBy: {
      id: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
      role: {
        type: String,
        enum: ["partner", "school-admin", "admin"],
        required: true,
      },
      name: { type: String, trim: true, default: "Instructor" },
      email: { type: String, trim: true, default: "" },
    },
    schoolName: { type: String, trim: true, default: null, index: true },

    dueDate: { type: Date, default: null },
    allowLateSubmission: { type: Boolean, default: true },
    maxScore: { type: Number, default: 100, min: 1 },

    starterFiles: { type: [starterFileSchema], default: [] },
    starterSceneJson: { type: mongoose.Schema.Types.Mixed, default: null },

    targetSpecs: {
      enabled: { type: Boolean, default: false },
      expectedVolumeMm3: { type: Number, default: null },
      volumeTolerancePct: { type: Number, default: 5, min: 0.1, max: 100 },
      expectedBoundsMm: {
        x: { type: Number, default: null },
        y: { type: Number, default: null },
        z: { type: Number, default: null },
      },
      boundsToleranceMm: { type: Number, default: 2, min: 0.01 },
      requireWatertight: { type: Boolean, default: true },
      referenceFileUrl: { type: String, default: "" },
    },

    rubric: {
      type: [rubricCriterionSchema],
      default: [
        {
          criterion: "Geometry & Dimensional Accuracy",
          maxPoints: 40,
          description: "Matches required part dimensions, hole sizes, and overall volume.",
        },
        {
          criterion: "Parametric Feature Tree & Modeling Workflow",
          maxPoints: 30,
          description: "Clean sketch profiles, proper boolean cuts/bosses, and logical feature order.",
        },
        {
          criterion: "Design Completeness & Export Quality",
          maxPoints: 30,
          description: "Watertight solid mesh/B-Rep ready for STEP/STL fabrication.",
        },
      ],
    },

    status: {
      type: String,
      enum: ["draft", "published", "archived"],
      default: "published",
      index: true,
    },
  },
  { timestamps: true }
);

workspaceAssignmentSchema.index({ status: 1, schoolName: 1, createdAt: -1 });
workspaceAssignmentSchema.index({ targetScope: 1, internshipId: 1, status: 1 });

// Keep explicit "cadassignments" collection name so existing assignments remain intact
module.exports = mongoose.model("WorkspaceAssignment", workspaceAssignmentSchema, "cadassignments");

