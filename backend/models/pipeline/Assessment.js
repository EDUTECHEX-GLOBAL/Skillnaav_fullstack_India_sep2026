const mongoose = require("mongoose");

const { Schema } = mongoose;

/**
 * Assessment Schema - Level 2
 * MCQ single-correct assessment with enhanced security and anti-cheat measures
 * Note: correctIndex is stored as a salted hash to prevent answer leakage
 */
const AssessmentSchema = new Schema(
  {
    internshipId: {
      type: Schema.Types.ObjectId,
      ref: "InternshipPosting",
      required: true,
      index: true,
    },
    studentId: {
      type: Schema.Types.ObjectId,
      ref: "Userwebapp",
      required: true,
      index: true,
    },
    partnerId: {
      type: Schema.Types.ObjectId,
      ref: "Partnerwebapp",
      required: true,
      index: true,
    },

    type: {
      type: String,
      enum: ["MCQ_SINGLE_CORRECT"],
      default: "MCQ_SINGLE_CORRECT",
    },

    // Snapshot of the config used at generation time (audit-safe)
    configSnapshot: {
      assessmentType: { type: String, default: "mcqs" },
      allowText: { type: Boolean, default: false },
      allowFileUpload: { type: Boolean, default: false },
      difficulty: { type: Number, default: 2, min: 1, max: 3 },
      questionCount: { type: Number, default: 10, min: 5, max: 50 },
      timeLimitMinutes: { type: Number, default: 20, min: 5, max: 180 },
      passScore: { type: Number, default: 70, min: 0, max: 100 },
    },

    attempt: { type: Number, default: 1, min: 1 },

    status: {
      type: String,
      enum: ["generated", "sent", "started", "submitted", "evaluated", "passed", "rejected", "expired"],
      default: "generated",
      index: true,
    },

    // Timing + anti-cheat basics
    timing: {
      timeLimitMinutes: { type: Number, default: 20 },
      startedAt: { type: Date, default: null },
      submittedAt: { type: Date, default: null },
      totalElapsedMs: { type: Number, default: null }, // ✅ Actual time taken
    },

    // Generated questions with metadata
    questions: [
      {
        questionId: { type: String, required: true },
        question: { type: String, required: true },
        options: {
          type: [String],
          required: true,
          validate: {
            validator: (v) => Array.isArray(v) && v.length === 4,
            message: "Must have exactly 4 options",
          },
        },
        correctIndexHash: { type: String, required: true }, // ✅ Salted hash
        explanation: { type: String, default: null },
        
        // ✅ Question metadata for analytics
        metadata: {
          domain: {
            type: String,
            default: "general",
            // No enum restriction - allow AI to categorize freely
          },
          bloomLevel: {
            type: String,
            enum: ["remember", "understand", "apply", "analyze", "evaluate", "create"],
            default: "apply",
          },
          difficulty: { type: Number, min: 1, max: 3 },
          generatedAt: { type: Date, default: Date.now },
        },

        // ✅ Question-level statistics (for future question bank)
        stats: {
          timesShown: { type: Number, default: 0 },
          timesCorrect: { type: Number, default: 0 },
          avgTimeSeconds: { type: Number, default: null },
        },
      },
    ],

    // Student submission
    submission: {
      mcqAnswers: [
        {
          questionId: { type: String, required: true },
          selectedIndex: { type: Number, min: 0, max: 3 },
          voiceAnswer: { type: String, default: null },
        },
      ],
      textAnswer: { type: String, default: null },
      files: [
        {
          url: { type: String, required: true },
          name: { type: String, default: null },
          size: { type: Number, default: null },
          mime: { type: String, default: null },
        },
      ],
      
      // ✅ Timing pattern for each question (anti-cheat)
      timingPattern: [
        {
          questionId: { type: String, required: true },
          timeSpentSeconds: { type: Number, required: true, min: 0 },
        },
      ],
    },

    // Evaluation with detailed breakdown
    evaluation: {
      mcqScore: { type: Number, default: null, min: 0, max: 100 },
      finalScore: { type: Number, default: null, min: 0, max: 100 },
      pass: { type: Boolean, default: null },
      feedback: { type: String, default: null },
      evaluatedAt: { type: Date, default: null },
      
      // ✅ Detailed per-question results (for review)
      detailed: [
        {
          questionId: String,
          selectedIndex: Number,
          isCorrect: Boolean,
          domain: String,
          difficulty: Number,
        },
      ],
      
      // ✅ Domain-specific breakdown
      domainStats: {
        type: Map,
        of: {
          correct: Number,
          total: Number,
        },
      },
      
      // ✅ Timing analysis results
      timingAnalysis: {
        suspicious: { type: Boolean, default: false },
        reason: { type: String, default: null },
        avgTimeSeconds: { type: Number, default: null },
      },
    },

    // ✅ Anti-cheat measures
    antiCheat: {
      ipAddress: { type: String, default: null },
      // Indicates whether frontend proctoring (camera+mic) was successfully verified
      proctoringVerified: { type: Boolean, default: false },
      proctoringVerifiedAt: { type: Date, default: null },
      userAgent: { type: String, default: null },
      tabSwitches: { type: Number, default: 0 },
      suspiciousActivity: [
        {
          type: {
            type: String,
            enum: [
              "tab_switch",
              "window_blur",
              "copy_paste",
              "right_click",
              "devtools_open",
              "rapid_submission",
              "other",
            ],
          },
          timestamp: Date,
          details: String,
        },
      ],
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt
  }
);

// ✅ INDEXES FOR QUERY PERFORMANCE
// Compound index for common queries
AssessmentSchema.index({ internshipId: 1, status: 1, updatedAt: -1 });
AssessmentSchema.index({ studentId: 1, status: 1, updatedAt: -1 });
AssessmentSchema.index({ partnerId: 1, status: 1, updatedAt: -1 });

// Uniqueness per attempt (allows multiple attempts in future)
AssessmentSchema.index(
  { internshipId: 1, studentId: 1, attempt: 1 },
  { unique: true }
);

// Index for finding expired assessments
AssessmentSchema.index({ status: 1, "timing.startedAt": 1 });

// ✅ VIRTUAL FIELDS
AssessmentSchema.virtual("isExpired").get(function () {
  if (!this.timing.startedAt || this.status !== "started") {
    return false;
  }
  const elapsedMs = Date.now() - new Date(this.timing.startedAt).getTime();
  const limitMs = this.timing.timeLimitMinutes * 60 * 1000;
  return elapsedMs > limitMs;
});

AssessmentSchema.virtual("timeRemainingMs").get(function () {
  if (!this.timing.startedAt || this.status !== "started") {
    return null;
  }
  const elapsedMs = Date.now() - new Date(this.timing.startedAt).getTime();
  const limitMs = this.timing.timeLimitMinutes * 60 * 1000;
  return Math.max(0, limitMs - elapsedMs);
});

// ✅ INSTANCE METHODS
AssessmentSchema.methods.checkTimeExpiry = function () {
  return this.isExpired;
};

AssessmentSchema.methods.getSafeQuestionsForStudent = function () {
  return this.questions.map((q) => ({
    questionId: q.questionId,
    question: q.question,
    options: q.options,
    // ❌ DO NOT include: correctIndexHash, metadata, stats
  }));
};

AssessmentSchema.methods.calculateScore = function () {
  if (!this.evaluation || this.evaluation.mcqScore === null) {
    return null;
  }
  return {
    score: this.evaluation.mcqScore,
    pass: this.evaluation.pass,
    percentage: this.evaluation.mcqScore,
  };
};

// ✅ STATIC METHODS
AssessmentSchema.statics.findExpired = function () {
  const now = new Date();
  return this.find({
    status: "started",
    "timing.startedAt": { $ne: null },
    $expr: {
      $gt: [
        { $subtract: [now, "$timing.startedAt"] },
        { $multiply: ["$timing.timeLimitMinutes", 60000] },
      ],
    },
  });
};

AssessmentSchema.statics.getStatsByInternship = async function (internshipId) {
  return this.aggregate([
    { $match: { internshipId: mongoose.Types.ObjectId(internshipId) } },
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
        avgScore: { $avg: "$evaluation.mcqScore" },
      },
    },
  ]);
};

// ✅ PRE-SAVE MIDDLEWARE
AssessmentSchema.pre("save", function (next) {
  // Calculate total elapsed time on submission
  if (
    this.status === "submitted" &&
    this.timing.startedAt &&
    this.timing.submittedAt
  ) {
    this.timing.totalElapsedMs =
      new Date(this.timing.submittedAt).getTime() -
      new Date(this.timing.startedAt).getTime();
  }

  next();
});

// ✅ ENABLE VIRTUALS IN JSON
AssessmentSchema.set("toJSON", { virtuals: true });
AssessmentSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("Assessment", AssessmentSchema);