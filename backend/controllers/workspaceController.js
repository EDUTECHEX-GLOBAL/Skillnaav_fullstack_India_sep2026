const path = require("path");
const fs = require("fs");
const axiosRaw = require("axios");
const axios = axiosRaw.default || axiosRaw;
const mongoose = require("mongoose");
const asyncHandler = require("express-async-handler");
const WorkspaceAssignment = require("../models/webapp-models/WorkspaceAssignmentModel");
const WorkspaceSubmission = require("../models/webapp-models/WorkspaceSubmissionModel");
const InternshipPosting = require("../models/webapp-models/internshipPostModel");
const Application = require("../models/webapp-models/applicationModel");
const { uploadFile } = require("../utils/multer");
const {
  computeSha256,
  analyzeStlBuffer,
  evaluateTargetSpecs,
} = require("../utils/cadGeometryAnalyzer");

const LOCAL_CAD_UPLOAD_DIR = path.join(__dirname, "..", "uploads", "cad");

function ensureLocalDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function hasS3Credentials() {
  return Boolean(
    process.env.AWS_ACCESS_KEY_ID &&
      process.env.AWS_SECRET_ACCESS_KEY &&
      (process.env.AWS_S3_BUCKET || process.env.AWS_RESUME_BUCKET || process.env.AWS_IMAGE_BUCKET)
  );
}

/**
 * Store a CAD artifact to S3 when configured, falling back to local /uploads/cad
 * so local development and self-hosted VPS setups work without AWS keys.
 */
async function persistCadBuffer(buffer, keyPath, contentType = "application/octet-stream") {
  if (hasS3Credentials()) {
    try {
      const url = await uploadFile({
        Key: keyPath,
        Body: buffer,
        ContentType: contentType,
      });
      return url;
    } catch (err) {
      console.warn("S3 CAD upload failed, falling back to local storage:", err.message);
    }
  }

  const safeRel = keyPath.replace(/^\/+/, "");
  const fullPath = path.join(LOCAL_CAD_UPLOAD_DIR, safeRel);
  ensureLocalDir(path.dirname(fullPath));
  fs.writeFileSync(fullPath, buffer);
  return `/uploads/cad/${safeRel.replace(/\\/g, "/")}`;
}

function canManageAssignments(req) {
  return Boolean(req.isPartner || req.isSchoolAdmin || req.isAdmin);
}

function getCreatorScopeFilter(req) {
  if (req.isAdmin) return {};
  if (req.isSchoolAdmin) {
    return {
      $or: [
        { "createdBy.id": req.user._id },
        ...(req.user.schoolName ? [{ schoolName: req.user.schoolName }] : []),
      ],
    };
  }
  if (req.isPartner) {
    return { "createdBy.id": req.user._id };
  }
  return { status: "published" };
}

function canAccessAssignment(req, assignment) {
  if (req.isAdmin) return true;
  if (req.isPartner) return String(assignment.createdBy?.id) === String(req.user._id);
  if (req.isSchoolAdmin) {
    return (
      String(assignment.createdBy?.id) === String(req.user._id) ||
      (req.user.schoolName && assignment.schoolName === req.user.schoolName)
    );
  }
  if (assignment.status !== "published") return false;
  if (assignment.targetScope === "internship" || assignment.internshipId) {
    return false;
  }
  if (!assignment.schoolName) return true;
  return Boolean(req.user.schoolName && assignment.schoolName === req.user.schoolName);
}

const ACCEPTED_OR_SHORTLISTED_STATUSES = ["Under Review", "Accepted", "In Progress", "Completed"];

async function canAccessAssignmentAsync(req, assignment) {
  if (canAccessAssignment(req, assignment)) return true;
  if (req.user?.role !== "user" || assignment.status !== "published") return false;

  if (assignment.targetScope === "internship" || assignment.internshipId) {
    if (
      assignment.targetAudience === "specific-students" &&
      Array.isArray(assignment.targetStudentIds) &&
      assignment.targetStudentIds.length > 0
    ) {
      return assignment.targetStudentIds.some((id) => String(id) === String(req.user._id));
    }

    if (!assignment.internshipId) return false;
    const app = await Application.findOne({
      internshipId: assignment.internshipId,
      $or: [
        { studentId: req.user._id },
        ...(req.user.email ? [{ userEmail: req.user.email }] : []),
      ],
    })
      .select("status")
      .lean();
    if (!app || app.status === "Rejected") return false;
    if (assignment.targetAudience === "shortlisted-accepted") {
      return ACCEPTED_OR_SHORTLISTED_STATUSES.includes(app.status);
    }
    return true;
  }

  return false;
}

function appendActivityEntry(submission, action, detail = "") {
  if (!action) return;
  if (!Array.isArray(submission.activityLog)) {
    submission.activityLog = [];
  }
  const latest = submission.activityLog[submission.activityLog.length - 1];
  const now = new Date();
  // Avoid spamming identical consecutive heartbeat entries within 45s
  if (
    latest &&
    latest.action === action &&
    latest.detail === detail &&
    now.getTime() - new Date(latest.timestamp).getTime() < 45000
  ) {
    latest.timestamp = now;
  } else {
    submission.activityLog.push({
      timestamp: now,
      action: String(action).slice(0, 80),
      detail: String(detail || "").slice(0, 200),
    });
  }
  if (submission.activityLog.length > 40) {
    submission.activityLog = submission.activityLog.slice(-40);
  }
}

// @desc    Get partner's internships + applicant counts for targeted tool sending
// @route   GET /api/daily-work/partner/internships
const getPartnerInternships = asyncHandler(async (req, res) => {
  if (!canManageAssignments(req)) {
    return res.status(403).json({ success: false, message: "Forbidden" });
  }

  const filter = { deleted: { $ne: true } };
  if (req.isPartner) {
    filter.partnerId = req.user._id;
  }

  const internships = await InternshipPosting.find(filter)
    .select("jobTitle companyName sector internshipType internshipMode adminStatus createdAt")
    .sort({ createdAt: -1 })
    .lean();

  const ids = internships.map((i) => i._id);
  const appAgg =
    ids.length > 0
      ? await Application.aggregate([
          { $match: { internshipId: { $in: ids }, status: { $ne: "Rejected" } } },
          {
            $group: {
              _id: "$internshipId",
              totalApplicants: { $sum: 1 },
              acceptedCount: {
                $sum: {
                  $cond: [{ $in: ["$status", ACCEPTED_OR_SHORTLISTED_STATUSES] }, 1, 0],
                },
              },
            },
          },
        ])
      : [];

  const countsMap = new Map(appAgg.map((c) => [String(c._id), c]));
  const enriched = internships.map((item) => {
    const counts = countsMap.get(String(item._id)) || { totalApplicants: 0, acceptedCount: 0 };
    return {
      ...item,
      totalApplicants: counts.totalApplicants,
      acceptedCount: counts.acceptedCount,
    };
  });

  res.json({ success: true, internships: enriched });
});

// @desc    Get applicants for a specific internship owned by partner
// @route   GET /api/daily-work/partner/internships/:internshipId/applicants
const getInternshipApplicants = asyncHandler(async (req, res) => {
  if (!canManageAssignments(req)) {
    return res.status(403).json({ success: false, message: "Forbidden" });
  }
  const { internshipId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(internshipId)) {
    return res.status(400).json({ success: false, message: "Invalid internship ID" });
  }

  const internship = await InternshipPosting.findById(internshipId).lean();
  if (!internship) {
    return res.status(404).json({ success: false, message: "Internship not found" });
  }
  if (req.isPartner && String(internship.partnerId) !== String(req.user._id)) {
    return res.status(403).json({ success: false, message: "Not authorized for this internship" });
  }

  const apps = await Application.find({ internshipId })
    .populate("studentId", "name username email profileImage schoolName")
    .sort({ appliedDate: -1 })
    .lean();

  const seen = new Set();
  const applicants = [];
  for (const app of apps) {
    const sid = String(app.studentId?._id || app.studentId || "");
    if (!sid || seen.has(sid)) continue;
    seen.add(sid);
    applicants.push({
      applicationId: app._id,
      studentId: sid,
      name: app.studentId?.name || app.userName || app.studentId?.username || "Student",
      email: app.studentId?.email || app.userEmail || "",
      schoolName: app.studentId?.schoolName || "",
      status: app.status || "Applied",
      appliedDate: app.appliedDate,
    });
  }

  res.json({ success: true, internship: { _id: internship._id, jobTitle: internship.jobTitle }, applicants });
});

// @desc    Get CAD runtime configuration (for optional FreeCAD WASM / container URLs)
// @route   GET /api/cad/config
const getCadConfig = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    builtinEnabled: true,
    freecadWasmUrl: process.env.FREECAD_WASM_URL || "https://freecad.virtastic.app",
    freecadContainerBaseUrl: process.env.FREECAD_CONTAINER_URL || "",
    supportedFormats: [".step", ".stp", ".stl", ".iges", ".igs", ".fcstd", ".cad.json", ".scad"],
  });
});

// @desc    List CAD assignments (role-scoped + internship applicant targeting)
// @route   GET /api/cad/assignments
const listAssignments = asyncHandler(async (req, res) => {
  if (canManageAssignments(req)) {
    const filter = getCreatorScopeFilter(req);
    const assignments = await WorkspaceAssignment.find(filter).sort({ createdAt: -1 }).lean();
    const assignmentIds = assignments.map((a) => a._id);
    const counts = await WorkspaceSubmission.aggregate([
      { $match: { assignmentId: { $in: assignmentIds } } },
      {
        $group: {
          _id: "$assignmentId",
          total: { $sum: 1 },
          working: {
            $sum: {
              $cond: [{ $eq: ["$status", "in-progress"] }, 1, 0],
            },
          },
          submitted: {
            $sum: {
              $cond: [{ $in: ["$status", ["submitted", "graded"]] }, 1, 0],
            },
          },
          graded: {
            $sum: {
              $cond: [{ $eq: ["$status", "graded"] }, 1, 0],
            },
          },
        },
      },
    ]);
    const countMap = new Map(counts.map((c) => [String(c._id), c]));
    const enriched = assignments.map((a) => ({
      ...a,
      submissionStats: countMap.get(String(a._id)) || {
        total: 0,
        working: 0,
        submitted: 0,
        graded: 0,
      },
    }));
    return res.json({ success: true, assignments: enriched });
  }

  // Student view: published assignments matching school/global OR targeted internship applications
  const studentApps = await Application.find({
    $or: [
      { studentId: req.user._id },
      ...(req.user.email ? [{ userEmail: req.user.email }] : []),
    ],
  })
    .select("internshipId status")
    .lean();
  const appByInternship = new Map(
    studentApps.map((app) => [String(app.internshipId), app.status])
  );

  const appliedInternshipIds = [];
  const acceptedInternshipIds = [];
  for (const [intId, st] of appByInternship.entries()) {
    if (st !== "Rejected") {
      appliedInternshipIds.push(intId);
      if (ACCEPTED_OR_SHORTLISTED_STATUSES.includes(st)) {
        acceptedInternshipIds.push(intId);
      }
    }
  }

  const schoolFilters = [{ schoolName: null }, { schoolName: "" }];
  if (req.user.schoolName) {
    schoolFilters.push({ schoolName: req.user.schoolName });
  }

  const visibilityBranches = [
    {
      $and: [
        { $or: [{ targetScope: { $in: ["all", "school"] } }, { targetScope: { $exists: false } }] },
        { $or: [{ internshipId: null }, { internshipId: { $exists: false } }] },
        { $or: schoolFilters },
      ],
    },
    { targetStudentIds: req.user._id },
  ];

  if (appliedInternshipIds.length > 0) {
    visibilityBranches.push({
      internshipId: { $in: appliedInternshipIds },
      targetAudience: "all-applicants",
    });
  }
  if (acceptedInternshipIds.length > 0) {
    visibilityBranches.push({
      internshipId: { $in: acceptedInternshipIds },
      targetAudience: "shortlisted-accepted",
    });
  }

  const assignments = await WorkspaceAssignment.find({
    status: "published",
    $or: visibilityBranches,
  })
    .sort({ dueDate: 1, createdAt: -1 })
    .lean();

  const submissions = await WorkspaceSubmission.find({
    studentId: req.user._id,
    assignmentId: { $in: assignments.map((a) => a._id) },
  })
    .select(
      "assignmentId status activeStatus lastActiveAt timeSpentSeconds runCount lastAction submittedAt grade autoCheckResults versions geometryMetrics"
    )
    .lean();

  const subMap = new Map(submissions.map((s) => [String(s.assignmentId), s]));
  const enriched = assignments.map((a) => ({
    ...a,
    mySubmission: subMap.get(String(a._id)) || null,
  }));

  res.json({ success: true, assignments: enriched });
});

// @desc    Get single assignment + student's submission if student
// @route   GET /api/cad/assignments/:id
const getAssignmentById = asyncHandler(async (req, res) => {
  const assignment = await WorkspaceAssignment.findById(req.params.id).lean();
  if (!assignment) {
    return res.status(404).json({ success: false, message: "CAD assignment not found" });
  }
  if (!(await canAccessAssignmentAsync(req, assignment))) {
    return res.status(403).json({ success: false, message: "Not authorized to access this assignment" });
  }

  let mySubmission = null;
  if (req.user.role === "user") {
    mySubmission = await WorkspaceSubmission.findOne({
      $or: [
        { assignmentId: assignment._id, studentId: req.user._id },
        ...(req.user.email ? [{ assignmentId: assignment._id, studentEmail: req.user.email }] : []),
      ],
    }).lean();
  }

  res.json({ success: true, assignment, mySubmission });
});

// @desc    Create a CAD assignment (with optional internship applicant targeting)
// @route   POST /api/cad/assignments
const createAssignment = asyncHandler(async (req, res) => {
  if (!canManageAssignments(req)) {
    return res.status(403).json({ success: false, message: "Only instructors/admins can create CAD assignments" });
  }

  const {
    title,
    description,
    instructions,
    category,
    toolType,
    workDate,
    starterCode,
    starterData,
    codeLanguage,
    expectedOutput,
    difficulty,
    workspaceMode,
    externalToolUrl,
    dueDate,
    allowLateSubmission,
    maxScore,
    targetSpecs,
    rubric,
    starterSceneJson,
    status,
    isGlobal,
    targetScope,
    internshipId,
    internshipTitle,
    targetAudience,
    targetStudentIds,
  } = req.body;

  if (!title || !description) {
    return res.status(400).json({ success: false, message: "Title and description are required" });
  }

  let resolvedInternshipId = null;
  let resolvedInternshipTitle = internshipTitle || "";
  if (internshipId && mongoose.Types.ObjectId.isValid(internshipId)) {
    const posting = await InternshipPosting.findById(internshipId).select("jobTitle partnerId").lean();
    if (!posting) {
      return res.status(404).json({ success: false, message: "Selected internship not found" });
    }
    if (req.isPartner && String(posting.partnerId) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: "You can only target your own internships" });
    }
    resolvedInternshipId = posting._id;
    resolvedInternshipTitle = posting.jobTitle || resolvedInternshipTitle;
  }

  const cleanStudentIds = Array.isArray(targetStudentIds)
    ? targetStudentIds.filter((id) => mongoose.Types.ObjectId.isValid(id))
    : [];

  const resolvedScope = resolvedInternshipId
    ? "internship"
    : targetScope === "school" || req.isSchoolAdmin
      ? "school"
      : "all";

  const schoolName =
    resolvedScope === "internship"
      ? null
      : req.isSchoolAdmin
        ? req.user.schoolName || null
        : isGlobal
          ? null
          : req.body.schoolName || null;

  const assignment = await WorkspaceAssignment.create({
    title: title.trim(),
    description: description.trim(),
    instructions: instructions || "",
    category: category || "Mechanical CAD",
    toolType: toolType || workspaceMode || "builtin-cad",
    workDate: workDate ? new Date(workDate) : new Date(),
    starterCode: starterCode || "",
    starterData: starterData || null,
    codeLanguage: codeLanguage || "cpp",
    expectedOutput: expectedOutput || "",
    difficulty: difficulty || "Beginner",
    workspaceMode: workspaceMode || "builtin-cad",
    externalToolUrl: externalToolUrl || "",
    targetScope: resolvedScope,
    internshipId: resolvedInternshipId,
    internshipTitle: resolvedInternshipTitle,
    targetAudience: targetAudience || (cleanStudentIds.length > 0 ? "specific-students" : "all-applicants"),
    targetStudentIds: cleanStudentIds,
    createdBy: {
      id: req.user._id,
      role: req.user.role,
      name: req.user.name || req.user.organization || "Instructor",
      email: req.user.email || "",
    },
    schoolName,
    dueDate: dueDate ? new Date(dueDate) : null,
    allowLateSubmission: allowLateSubmission !== undefined ? Boolean(allowLateSubmission) : true,
    maxScore: Number(maxScore) || 100,
    targetSpecs: targetSpecs || { enabled: false },
    rubric: Array.isArray(rubric) && rubric.length > 0 ? rubric : undefined,
    starterSceneJson: starterSceneJson || null,
    status: status || "published",
  });

  res.status(201).json({ success: true, assignment });
});

// @desc    Update a CAD assignment
// @route   PUT /api/cad/assignments/:id
const updateAssignment = asyncHandler(async (req, res) => {
  if (!canManageAssignments(req)) {
    return res.status(403).json({ success: false, message: "Forbidden" });
  }
  const assignment = await WorkspaceAssignment.findById(req.params.id);
  if (!assignment) {
    return res.status(404).json({ success: false, message: "CAD assignment not found" });
  }
  if (!canAccessAssignment(req, assignment)) {
    return res.status(403).json({ success: false, message: "Not authorized to edit this assignment" });
  }

  const updatable = [
    "title",
    "description",
    "instructions",
    "category",
    "toolType",
    "workDate",
    "starterCode",
    "starterData",
    "codeLanguage",
    "expectedOutput",
    "difficulty",
    "workspaceMode",
    "externalToolUrl",
    "targetScope",
    "internshipId",
    "internshipTitle",
    "targetAudience",
    "targetStudentIds",
    "dueDate",
    "allowLateSubmission",
    "maxScore",
    "targetSpecs",
    "rubric",
    "starterSceneJson",
    "status",
  ];
  for (const field of updatable) {
    if (req.body[field] !== undefined) {
      assignment[field] = req.body[field];
    }
  }
  await assignment.save();
  res.json({ success: true, assignment });
});

// @desc    Delete a CAD assignment
// @route   DELETE /api/cad/assignments/:id
const deleteAssignment = asyncHandler(async (req, res) => {
  if (!canManageAssignments(req)) {
    return res.status(403).json({ success: false, message: "Forbidden" });
  }
  const assignment = await WorkspaceAssignment.findById(req.params.id);
  if (!assignment) {
    return res.status(404).json({ success: false, message: "CAD assignment not found" });
  }
  if (!canAccessAssignment(req, assignment)) {
    return res.status(403).json({ success: false, message: "Not authorized" });
  }
  await assignment.deleteOne();
  res.json({ success: true, message: "Assignment deleted" });
});

// @desc    Upload a starter file (.step, .stp, .stl, .iges, .fcstd, .json, .pdf)
// @route   POST /api/cad/assignments/:id/upload-starter
const uploadStarterFile = asyncHandler(async (req, res) => {
  if (!canManageAssignments(req)) {
    return res.status(403).json({ success: false, message: "Forbidden" });
  }
  const assignment = await WorkspaceAssignment.findById(req.params.id);
  if (!assignment) {
    return res.status(404).json({ success: false, message: "CAD assignment not found" });
  }
  if (!canAccessAssignment(req, assignment)) {
    return res.status(403).json({ success: false, message: "Not authorized" });
  }
  if (!req.file) {
    return res.status(400).json({ success: false, message: "No file uploaded" });
  }

  const ext = path.extname(req.file.originalname).toLowerCase().replace(".", "");
  const key = `starters/${assignment._id}/${Date.now()}-${req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const fileUrl = await persistCadBuffer(req.file.buffer, key, req.file.mimetype);

  assignment.starterFiles.push({
    fileName: req.file.originalname,
    fileUrl,
    fileFormat: ext,
    fileSize: req.file.size,
  });

  // If starter STL is uploaded and targetSpecs has no reference bounds yet, auto-populate helper hint
  if (ext === "stl") {
    const { metrics } = analyzeStlBuffer(req.file.buffer, 0);
    if (!assignment.targetSpecs?.referenceFileUrl) {
      assignment.targetSpecs = {
        ...assignment.targetSpecs,
        referenceFileUrl: fileUrl,
      };
    }
    await assignment.save();
    return res.json({ success: true, assignment, analyzedStarterMetrics: metrics });
  }

  await assignment.save();
  res.json({ success: true, assignment });
});

// Helper to process uploaded STL / STEP / Native files for save or submit
async function processStudentSubmissionPayload(req, assignment) {
  const files = req.files || {};
  const stlFile = files.stlFile?.[0] || null;
  const stepFile = files.stepFile?.[0] || null;
  const nativeFile = files.nativeFile?.[0] || null;

  let sceneJson = null;
  if (req.body.sceneJson) {
    try {
      sceneJson = typeof req.body.sceneJson === "string" ? JSON.parse(req.body.sceneJson) : req.body.sceneJson;
    } catch {
      sceneJson = null;
    }
  }

  let clientMetrics = null;
  if (req.body.clientMetrics) {
    try {
      clientMetrics =
        typeof req.body.clientMetrics === "string"
          ? JSON.parse(req.body.clientMetrics)
          : req.body.clientMetrics;
    } catch {
      clientMetrics = null;
    }
  }

  const featureCount = Array.isArray(sceneJson?.features) ? sceneJson.features.length : clientMetrics?.featureCount || 0;
  const stamp = Date.now();
  const basePrefix = `submissions/${assignment._id}/${req.user._id}/${stamp}`;

  const currentFiles = [];
  let stlUrl = "";
  let stepUrl = "";
  let nativeUrl = "";
  let sha256 = "";
  let geometryMetrics = null;

  if (stlFile) {
    const analyzed = analyzeStlBuffer(stlFile.buffer, featureCount);
    sha256 = analyzed.sha256;
    geometryMetrics = analyzed.metrics;
    stlUrl = await persistCadBuffer(
      stlFile.buffer,
      `${basePrefix}-${stlFile.originalname.replace(/[^a-zA-Z0-9._-]/g, "_")}`,
      "model/stl"
    );
    currentFiles.push({
      fileName: stlFile.originalname,
      fileUrl: stlUrl,
      fileFormat: "stl",
      fileSize: stlFile.size,
      sha256,
    });
  }

  if (stepFile) {
    const stepHash = computeSha256(stepFile.buffer);
    if (!sha256) sha256 = stepHash;
    stepUrl = await persistCadBuffer(
      stepFile.buffer,
      `${basePrefix}-${stepFile.originalname.replace(/[^a-zA-Z0-9._-]/g, "_")}`,
      "application/step"
    );
    currentFiles.push({
      fileName: stepFile.originalname,
      fileUrl: stepUrl,
      fileFormat: path.extname(stepFile.originalname).toLowerCase().replace(".", "") || "step",
      fileSize: stepFile.size,
      sha256: stepHash,
    });
  }

  if (nativeFile) {
    const nativeHash = computeSha256(nativeFile.buffer);
    if (!sha256) sha256 = nativeHash;
    nativeUrl = await persistCadBuffer(
      nativeFile.buffer,
      `${basePrefix}-${nativeFile.originalname.replace(/[^a-zA-Z0-9._-]/g, "_")}`,
      nativeFile.mimetype || "application/octet-stream"
    );
    currentFiles.push({
      fileName: nativeFile.originalname,
      fileUrl: nativeUrl,
      fileFormat: path.extname(nativeFile.originalname).toLowerCase().replace(".", "") || "cad",
      fileSize: nativeFile.size,
      sha256: nativeHash,
    });
  }

  if (!geometryMetrics && clientMetrics) {
    geometryMetrics = {
      volumeMm3: Number(clientMetrics.volumeMm3) || 0,
      surfaceAreaMm2: Number(clientMetrics.surfaceAreaMm2) || 0,
      boundingBoxMm: clientMetrics.boundingBoxMm || { x: 0, y: 0, z: 0 },
      centerOfMass: clientMetrics.centerOfMass || { x: 0, y: 0, z: 0 },
      triangleCount: Number(clientMetrics.triangleCount) || 0,
      featureCount,
      isWatertight: clientMetrics.isWatertight !== false,
      analyzedBy: "client-reported",
    };
  }

  if (!sha256 && sceneJson) {
    sha256 = computeSha256(Buffer.from(JSON.stringify(sceneJson)));
  }

  const submittedCode = req.body.submittedCode !== undefined ? String(req.body.submittedCode) : undefined;
  const codeLanguage = req.body.codeLanguage !== undefined ? String(req.body.codeLanguage) : undefined;
  const codeOutput = req.body.codeOutput !== undefined ? String(req.body.codeOutput) : undefined;

  if (!sha256 && submittedCode) {
    sha256 = computeSha256(Buffer.from(submittedCode));
  }

  return {
    sceneJson,
    currentFiles,
    stlUrl,
    stepUrl,
    nativeUrl,
    sha256,
    geometryMetrics,
    submittedCode,
    codeLanguage,
    codeOutput,
  };
}

function buildAutoChecks(assignment, submission) {
  const geomResult = evaluateTargetSpecs(assignment.targetSpecs, submission.geometryMetrics);
  const checks = [...(geomResult.checks || [])];

  if (assignment.expectedOutput && assignment.expectedOutput.trim()) {
    const expectedNorm = assignment.expectedOutput.trim().replace(/\r\n/g, "\n");
    const actualNorm = (submission.codeOutput || "").trim().replace(/\r\n/g, "\n");
    const passed = expectedNorm === actualNorm;
    checks.push({
      name: "Program Output Match",
      expected: expectedNorm.slice(0, 120),
      actual: actualNorm ? actualNorm.slice(0, 120) : "(no output)",
      passed,
      message: passed ? "Output matches expected result." : "Program output differs from expected.",
    });
  }

  const passedCount = checks.filter((c) => c.passed).length;
  return {
    passed: checks.length === 0 ? true : passedCount === checks.length,
    passedCount,
    totalChecks: checks.length,
    checks,
  };
}

// @desc    Record student live activity heartbeat & auto-draft inside EduTechEx tool
// @route   POST /api/daily-work/submissions/:assignmentId/activity
const recordActivity = asyncHandler(async (req, res) => {
  const assignment = await WorkspaceAssignment.findById(req.params.assignmentId);
  if (!assignment) {
    return res.status(404).json({ success: false, message: "Assignment not found" });
  }
  if (!(await canAccessAssignmentAsync(req, assignment))) {
    return res.status(403).json({ success: false, message: "Not authorized for this assignment" });
  }

  const {
    action,
    detail,
    elapsedSeconds = 0,
    isRun = false,
    isEdit = false,
    submittedCode,
    codeLanguage,
    codeOutput,
    sceneJson,
    liveData,
    workSummary,
  } = req.body || {};

  let submission = await WorkspaceSubmission.findOne({
    assignmentId: assignment._id,
    studentId: req.user._id,
  });

  if (!submission) {
    submission = new WorkspaceSubmission({
      assignmentId: assignment._id,
      studentId: req.user._id,
      studentName: req.user.name || "Student",
      studentEmail: req.user.email || "",
      schoolName: req.user.schoolName || null,
      status: "in-progress",
      activeStatus: "working",
      grade: { maxScore: assignment.maxScore || 100 },
    });
  }

  const delta = Math.max(0, Math.min(90, Number(elapsedSeconds) || 0));
  submission.timeSpentSeconds = (submission.timeSpentSeconds || 0) + delta;
  submission.lastActiveAt = new Date();

  if (submission.status === "in-progress") {
    submission.activeStatus = "working";
  }
  if (isRun) submission.runCount = (submission.runCount || 0) + 1;
  if (isEdit) submission.editCount = (submission.editCount || 0) + 1;
  if (action) submission.lastAction = String(action).slice(0, 100);
  if (workSummary !== undefined) submission.workSummary = String(workSummary).slice(0, 500);
  if (submittedCode !== undefined) submission.submittedCode = String(submittedCode);
  if (codeLanguage !== undefined) submission.codeLanguage = String(codeLanguage);
  if (codeOutput !== undefined) submission.codeOutput = String(codeOutput);
  if (sceneJson !== undefined) submission.sceneJson = sceneJson;
  if (liveData !== undefined) submission.liveData = liveData;

  if (action) {
    appendActivityEntry(submission, action, detail || "");
  }

  await submission.save();
  res.json({
    success: true,
    lastActiveAt: submission.lastActiveAt,
    timeSpentSeconds: submission.timeSpentSeconds,
    runCount: submission.runCount,
    editCount: submission.editCount,
    lastAction: submission.lastAction,
  });
});

// @desc    Save student CAD progress snapshot (creates version history)
// @route   POST /api/cad/submissions/:assignmentId/save
const saveProgress = asyncHandler(async (req, res) => {
  const assignment = await WorkspaceAssignment.findById(req.params.assignmentId);
  if (!assignment) {
    return res.status(404).json({ success: false, message: "CAD assignment not found" });
  }
  if (!(await canAccessAssignmentAsync(req, assignment))) {
    return res.status(403).json({ success: false, message: "Not authorized for this assignment" });
  }

  const parsed = await processStudentSubmissionPayload(req, assignment);

  let submission = await WorkspaceSubmission.findOne({
    assignmentId: assignment._id,
    studentId: req.user._id,
  });

  if (!submission) {
    submission = new WorkspaceSubmission({
      assignmentId: assignment._id,
      studentId: req.user._id,
      studentName: req.user.name || "Student",
      studentEmail: req.user.email || "",
      schoolName: req.user.schoolName || null,
      status: "in-progress",
      activeStatus: "working",
      grade: { maxScore: assignment.maxScore || 100 },
    });
  }

  if (parsed.currentFiles.length > 0) submission.currentFiles = parsed.currentFiles;
  if (parsed.stlUrl) submission.stlUrl = parsed.stlUrl;
  if (parsed.stepUrl) submission.stepUrl = parsed.stepUrl;
  if (parsed.nativeUrl) submission.nativeUrl = parsed.nativeUrl;
  if (parsed.sceneJson) submission.sceneJson = parsed.sceneJson;
  if (parsed.submittedCode !== undefined) submission.submittedCode = parsed.submittedCode;
  if (parsed.codeLanguage !== undefined) submission.codeLanguage = parsed.codeLanguage;
  if (parsed.codeOutput !== undefined) submission.codeOutput = parsed.codeOutput;
  if (parsed.geometryMetrics) submission.geometryMetrics = parsed.geometryMetrics;
  if (req.body.studentNotes !== undefined) submission.studentNotes = req.body.studentNotes;
  if (req.body.workSummary !== undefined) submission.workSummary = String(req.body.workSummary).slice(0, 500);
  if (req.body.liveData !== undefined) {
    try {
      submission.liveData =
        typeof req.body.liveData === "string" ? JSON.parse(req.body.liveData) : req.body.liveData;
    } catch {
      submission.liveData = req.body.liveData;
    }
  }

  submission.autoCheckResults = buildAutoChecks(assignment, submission);

  const nextVersionNum = (submission.versions?.length || 0) + 1;
  submission.versions.push({
    versionNumber: nextVersionNum,
    savedAt: new Date(),
    note: req.body.versionNote || `Autosave v${nextVersionNum}`,
    stlUrl: parsed.stlUrl || submission.stlUrl,
    stepUrl: parsed.stepUrl || submission.stepUrl,
    nativeUrl: parsed.nativeUrl || submission.nativeUrl,
    sceneJson: parsed.sceneJson || submission.sceneJson,
    submittedCode: submission.submittedCode,
    codeLanguage: submission.codeLanguage,
    codeOutput: submission.codeOutput,
    geometryMetrics: submission.geometryMetrics,
    sha256: parsed.sha256,
  });

  // Keep latest 25 version snapshots to avoid unbounded doc growth
  if (submission.versions.length > 25) {
    submission.versions = submission.versions.slice(-25);
  }

  submission.lastActiveAt = new Date();
  submission.activeStatus = submission.status === "submitted" ? "submitted" : "working";
  submission.lastAction = `Saved snapshot v${nextVersionNum}`;
  appendActivityEntry(submission, "Saved Snapshot", req.body.versionNote || `Version v${nextVersionNum}`);

  await submission.save();
  res.json({ success: true, submission });
});

// @desc    Submit student CAD work for grading
// @route   POST /api/cad/submissions/:assignmentId/submit
const submitAssignment = asyncHandler(async (req, res) => {
  const assignment = await WorkspaceAssignment.findById(req.params.assignmentId);
  if (!assignment) {
    return res.status(404).json({ success: false, message: "CAD assignment not found" });
  }
  if (!(await canAccessAssignmentAsync(req, assignment))) {
    return res.status(403).json({ success: false, message: "Not authorized for this assignment" });
  }

  const now = new Date();
  const isLate = Boolean(assignment.dueDate && now > new Date(assignment.dueDate));
  if (isLate && !assignment.allowLateSubmission) {
    return res.status(400).json({ success: false, message: "Deadline has passed and late submissions are disabled" });
  }

  const parsed = await processStudentSubmissionPayload(req, assignment);

  let submission = await WorkspaceSubmission.findOne({
    assignmentId: assignment._id,
    studentId: req.user._id,
  });

  if (!submission) {
    submission = new WorkspaceSubmission({
      assignmentId: assignment._id,
      studentId: req.user._id,
      studentName: req.user.name || "Student",
      studentEmail: req.user.email || "",
      schoolName: req.user.schoolName || null,
      grade: { maxScore: assignment.maxScore || 100 },
    });
  }

  if (parsed.currentFiles.length > 0) submission.currentFiles = parsed.currentFiles;
  if (parsed.stlUrl) submission.stlUrl = parsed.stlUrl;
  if (parsed.stepUrl) submission.stepUrl = parsed.stepUrl;
  if (parsed.nativeUrl) submission.nativeUrl = parsed.nativeUrl;
  if (parsed.sceneJson) submission.sceneJson = parsed.sceneJson;
  if (parsed.submittedCode !== undefined) submission.submittedCode = parsed.submittedCode;
  if (parsed.codeLanguage !== undefined) submission.codeLanguage = parsed.codeLanguage;
  if (parsed.codeOutput !== undefined) submission.codeOutput = parsed.codeOutput;
  if (parsed.geometryMetrics) submission.geometryMetrics = parsed.geometryMetrics;
  if (req.body.studentNotes !== undefined) submission.studentNotes = req.body.studentNotes;
  if (req.body.workSummary !== undefined) submission.workSummary = String(req.body.workSummary).slice(0, 500);
  if (req.body.liveData !== undefined) {
    try {
      submission.liveData =
        typeof req.body.liveData === "string" ? JSON.parse(req.body.liveData) : req.body.liveData;
    } catch {
      submission.liveData = req.body.liveData;
    }
  }

  if (
    !submission.stlUrl &&
    !submission.stepUrl &&
    !submission.nativeUrl &&
    !submission.sceneJson &&
    !submission.submittedCode &&
    !submission.liveData &&
    !submission.studentNotes
  ) {
    return res.status(400).json({ success: false, message: "Please complete your CAD model, code, diagram, or work output before submitting" });
  }

  submission.autoCheckResults = buildAutoChecks(assignment, submission);

  // Duplicate hash check against other students on the same assignment
  const latestHash = parsed.sha256 || submission.currentFiles?.[0]?.sha256 || "";
  if (latestHash) {
    const matches = await WorkspaceSubmission.find({
      assignmentId: assignment._id,
      studentId: { $ne: req.user._id },
      "currentFiles.sha256": latestHash,
    })
      .select("studentId studentName")
      .lean();

    if (matches.length > 0) {
      submission.plagiarismFlags = {
        duplicateHashMatch: true,
        matchedStudentIds: matches.map((m) => m.studentId),
        note: `Exact file hash matches ${matches.length} other submission(s).`,
      };
    } else {
      submission.plagiarismFlags = {
        duplicateHashMatch: false,
        matchedStudentIds: [],
        note: "",
      };
    }
  }

  const nextVersionNum = (submission.versions?.length || 0) + 1;
  submission.versions.push({
    versionNumber: nextVersionNum,
    savedAt: now,
    note: "Final Submission",
    stlUrl: submission.stlUrl,
    stepUrl: submission.stepUrl,
    nativeUrl: submission.nativeUrl,
    sceneJson: submission.sceneJson,
    submittedCode: submission.submittedCode,
    codeLanguage: submission.codeLanguage,
    codeOutput: submission.codeOutput,
    geometryMetrics: submission.geometryMetrics,
    sha256: latestHash,
  });

  submission.status = "submitted";
  submission.activeStatus = "submitted";
  submission.lastActiveAt = now;
  submission.lastAction = "Final Submission";
  submission.submittedAt = now;
  submission.isLate = isLate;
  appendActivityEntry(submission, "Final Submission", `Snapshot v${nextVersionNum}`);

  await submission.save();
  res.json({ success: true, submission });
});

// @desc    List all targeted students & live/submitted work for an assignment (Instructor view)
// @route   GET /api/cad/assignments/:id/submissions
const listSubmissionsForAssignment = asyncHandler(async (req, res) => {
  if (!canManageAssignments(req)) {
    return res.status(403).json({ success: false, message: "Forbidden" });
  }
  const assignment = await WorkspaceAssignment.findById(req.params.id).lean();
  if (!assignment) {
    return res.status(404).json({ success: false, message: "CAD assignment not found" });
  }
  if (!canAccessAssignment(req, assignment)) {
    return res.status(403).json({ success: false, message: "Not authorized" });
  }

  const rawSubs = await WorkspaceSubmission.find({ assignmentId: assignment._id })
    .sort({ lastActiveAt: -1, submittedAt: -1, updatedAt: -1 })
    .lean();

  const nowMs = Date.now();
  const submissions = rawSubs.map((s) => ({
    ...s,
    isOnlineNow: Boolean(s.lastActiveAt && nowMs - new Date(s.lastActiveAt).getTime() < 75000),
    isNotStarted: false,
  }));

  // Also include targeted internship applicants who haven't opened the tool yet
  if (assignment.targetScope === "internship" && assignment.internshipId) {
    const existingStudentIds = new Set(submissions.map((s) => String(s.studentId)));
    const appQuery = { internshipId: assignment.internshipId, status: { $ne: "Rejected" } };
    if (assignment.targetAudience === "shortlisted-accepted") {
      appQuery.status = { $in: ACCEPTED_OR_SHORTLISTED_STATUSES };
    } else if (
      assignment.targetAudience === "specific-students" &&
      Array.isArray(assignment.targetStudentIds) &&
      assignment.targetStudentIds.length > 0
    ) {
      appQuery.studentId = { $in: assignment.targetStudentIds };
    }

    const targetedApps = await Application.find(appQuery)
      .populate("studentId", "name username email")
      .lean();

    for (const app of targetedApps) {
      const sid = String(app.studentId?._id || app.studentId || "");
      if (!sid || existingStudentIds.has(sid)) continue;
      existingStudentIds.add(sid);
      submissions.push({
        _id: `pending-${sid}`,
        isNotStarted: true,
        assignmentId: assignment._id,
        studentId: sid,
        studentName: app.studentId?.name || app.userName || app.studentId?.username || "Applicant",
        studentEmail: app.studentId?.email || app.userEmail || "",
        applicationStatus: app.status || "Applied",
        status: "not-started",
        activeStatus: "not-started",
        isOnlineNow: false,
        timeSpentSeconds: 0,
        runCount: 0,
        editCount: 0,
        lastAction: "Has not opened tool yet",
        activityLog: [],
        versions: [],
      });
    }
  }

  res.json({ success: true, assignment, submissions });
});

// @desc    Grade a student CAD submission
// @route   PUT /api/cad/submissions/:submissionId/grade
const gradeSubmission = asyncHandler(async (req, res) => {
  if (!canManageAssignments(req)) {
    return res.status(403).json({ success: false, message: "Forbidden" });
  }
  const submission = await WorkspaceSubmission.findById(req.params.submissionId);
  if (!submission) {
    return res.status(404).json({ success: false, message: "Submission not found" });
  }
  const assignment = await WorkspaceAssignment.findById(submission.assignmentId).lean();
  if (!assignment || !canAccessAssignment(req, assignment)) {
    return res.status(403).json({ success: false, message: "Not authorized to grade this submission" });
  }

  const { score, rubricScores, feedback, status } = req.body;
  const maxScore = assignment.maxScore || 100;
  const numericScore =
    score !== undefined && score !== null
      ? Math.min(maxScore, Math.max(0, Number(score)))
      : Array.isArray(rubricScores)
        ? rubricScores.reduce((sum, r) => sum + (Number(r.points) || 0), 0)
        : 0;

  submission.grade = {
    score: numericScore,
    maxScore,
    rubricScores: Array.isArray(rubricScores) ? rubricScores : submission.grade?.rubricScores || [],
    feedback: feedback || "",
    gradedBy: req.user._id,
    gradedByName: req.user.name || req.user.organization || "Instructor",
    gradedAt: new Date(),
  };
  submission.status = status === "returned" ? "returned" : "graded";

  await submission.save();
  res.json({ success: true, submission });
});

let cachedPythonBin = null;
function getLocalPythonCommand() {
  if (cachedPythonBin) return cachedPythonBin;
  const rawCandidates = [
    process.env.PYTHON_PATH,
    "C:\\Users\\dell\\AppData\\Local\\Programs\\Python\\Python311\\python.exe",
    "python",
    "python3",
  ].filter(Boolean);

  for (const raw of rawCandidates) {
    const cmd = String(raw).replace(/^["']|["']$/g, "").trim();
    try {
      const { execSync } = require("child_process");
      execSync(`"${cmd}" --version`, { timeout: 1500, stdio: "ignore" });
      cachedPythonBin = cmd;
      return cmd;
    } catch {}
  }
  return null;
}

// Judge0 Community Edition (open source, 70+ languages, 100% free, zero api key required)
const JUDGE0_LANGUAGE_IDS = {
  python: 100, // Python (3.12.5)
  py: 100,
  cpp: 105, // C++ (GCC 14.1.0)
  "c++": 105,
  c: 103, // C (GCC 14.1.0)
  javascript: 102, // JavaScript (Node.js 22.08.0)
  js: 102,
  node: 102,
  typescript: 101, // TypeScript (5.6.2)
  ts: 101,
  java: 91, // Java (JDK 17.0.6)
  go: 107, // Go (1.23.5)
  rust: 108, // Rust (1.85.0)
  php: 98, // PHP (8.3.11)
  ruby: 72, // Ruby (2.7.0)
  bash: 46, // Bash (5.0.0)
  sh: 46,
  csharp: 51, // C# (Mono 6.6.0.161)
  cs: 51,
};

// Cached dynamic Wandbox compiler catalog (refreshed every 30 minutes) so language tags stay resilient
let wandboxCatalogCache = { fetchedAt: 0, list: [] };

async function getWandboxCatalog() {
  const now = Date.now();
  if (wandboxCatalogCache.list.length > 0 && now - wandboxCatalogCache.fetchedAt < 30 * 60 * 1000) {
    return wandboxCatalogCache.list;
  }
  try {
    const resp = await axios.get("https://wandbox.org/api/list.json", { timeout: 6000 });
    if (Array.isArray(resp.data)) {
      wandboxCatalogCache = { fetchedAt: now, list: resp.data };
      return resp.data;
    }
  } catch (err) {
    console.warn("Wandbox list fetch failed, using static fallback:", err.message);
  }
  return wandboxCatalogCache.list;
}

const WANDBOX_FALLBACKS = {
  cpp: { compiler: "gcc-head", options: "warning,c++20", langMatch: /^c\+\+$/i, nameMatch: /^gcc-/i },
  c: { compiler: "gcc-head-c", options: "warning,c17", langMatch: /^c$/i, nameMatch: /^gcc-/i },
  python: { compiler: "cpython-3.10.15", options: "", langMatch: /^python$/i, nameMatch: /^cpython-3\.10/i },
  javascript: { compiler: "nodejs-20.17.0", options: "", langMatch: /^javascript$/i, nameMatch: /^nodejs-/i },
  typescript: { compiler: "typescript-5.6.2", options: "", langMatch: /^typescript$/i, nameMatch: /^typescript-/i },
  java: { compiler: "openjdk-jdk-21+35", options: "", langMatch: /^java$/i, nameMatch: /^openjdk-/i },
  go: { compiler: "go-1.23.2", options: "", langMatch: /^go$/i, nameMatch: /^go-/i },
  rust: { compiler: "rust-1.82.0", options: "", langMatch: /^rust$/i, nameMatch: /^rust-/i },
  php: { compiler: "php-8.3.12", options: "", langMatch: /^php$/i, nameMatch: /^php-/i },
  ruby: { compiler: "ruby-3.3.11", options: "", langMatch: /^ruby$/i, nameMatch: /^ruby-/i },
  csharp: { compiler: "mcs-head", options: "", langMatch: /^c#$/i, nameMatch: /^(mcs|mono|dotnet)/i },
  bash: { compiler: "bash", options: "", langMatch: /^bash/i, nameMatch: /^bash/i },
};

async function resolveWandboxTarget(lang) {
  const cfg = WANDBOX_FALLBACKS[lang] || WANDBOX_FALLBACKS.cpp;
  const list = await getWandboxCatalog();
  if (list.length > 0) {
    const exact = list.find((c) => c.name === cfg.compiler);
    if (exact) return { compiler: exact.name, options: cfg.options };
    const matched =
      list.find((c) => cfg.langMatch.test(c.language || "") && cfg.nameMatch.test(c.name || "")) ||
      list.find((c) => cfg.langMatch.test(c.language || ""));
    if (matched) return { compiler: matched.name, options: cfg.options };
  }
  return { compiler: cfg.compiler, options: cfg.options };
}

// High-concurrency FIFO execution queue: ensures 50-100 simultaneous student compiles
// never starve server memory or hit external API concurrency throttles
class ConcurrencyQueue {
  constructor(maxConcurrency = 12) {
    this.maxConcurrency = maxConcurrency;
    this.running = 0;
    this.queue = [];
  }

  async run(task) {
    if (this.running >= this.maxConcurrency) {
      await new Promise((resolve) => this.queue.push(resolve));
    }
    this.running++;
    try {
      return await task();
    } finally {
      this.running--;
      if (this.queue.length > 0) {
        const next = this.queue.shift();
        next();
      }
    }
  }
}
const compilationQueue = new ConcurrencyQueue(12);

// @desc    Compile & run code via local sandbox, Judge0 CE, self-hosted Piston, or Wandbox
// @route   POST /api/cad/run-code  |  POST /api/daily-work/run-code
const runCode = asyncHandler(async (req, res) => {
  const { language = "cpp", code = "", stdin = "" } = req.body || {};
  if (!code || !String(code).trim()) {
    return res.status(400).json({ success: false, message: "Code cannot be empty" });
  }

  const lang = String(language).toLowerCase();

  return await compilationQueue.run(async () => {
    // Fast, local sandboxed execution for TypeScript, JavaScript and Python when available
    if (lang === "typescript" || lang === "ts") {
      try {
        const os = require("os");
        const tmpPath = path.join(os.tmpdir(), `skillnaav_${Date.now()}_${Math.random().toString(36).slice(2)}.ts`);
        fs.writeFileSync(tmpPath, String(code), "utf-8");
        try {
          const { execSync } = require("child_process");
          const out = execSync(`node --experimental-strip-types "${tmpPath}"`, {
            timeout: 8000,
            encoding: "utf-8",
            input: String(stdin || ""),
          });
          return res.json({
            success: true,
            runner: "Node.js 22 (TypeScript Native)",
            stdout: out,
            stderr: "",
            compileError: "",
            exitCode: 0,
          });
        } catch (runErr) {
          return res.json({
            success: true,
            runner: "Node.js 22 (TypeScript Native)",
            stdout: runErr.stdout || "",
            stderr: runErr.stderr || runErr.message || "",
            compileError: "",
            exitCode: runErr.status ?? 1,
          });
        } finally {
          try { fs.unlinkSync(tmpPath); } catch {}
        }
      } catch (e) {
        console.warn("Local TypeScript execution failed:", e.message);
      }
    }

    if (lang === "javascript" || lang === "js" || lang === "node") {
      try {
        const os = require("os");
        const tmpPath = path.join(os.tmpdir(), `skillnaav_${Date.now()}_${Math.random().toString(36).slice(2)}.js`);
        fs.writeFileSync(tmpPath, String(code), "utf-8");
        try {
          const { execSync } = require("child_process");
          const out = execSync(`node "${tmpPath}"`, {
            timeout: 8000,
            encoding: "utf-8",
            input: String(stdin || ""),
          });
          return res.json({
            success: true,
            runner: "Node.js 22",
            stdout: out,
            stderr: "",
            compileError: "",
            exitCode: 0,
          });
        } catch (runErr) {
          return res.json({
            success: true,
            runner: "Node.js 22",
            stdout: runErr.stdout || "",
            stderr: runErr.stderr || runErr.message || "",
            compileError: "",
            exitCode: runErr.status ?? 1,
          });
        } finally {
          try { fs.unlinkSync(tmpPath); } catch {}
        }
      } catch (e) {
        console.warn("Local JavaScript execution failed:", e.message);
      }
    }

    if (lang === "python" || lang === "py") {
      const pyCmd = getLocalPythonCommand();
      if (pyCmd) {
        try {
          const os = require("os");
          const tmpPath = path.join(os.tmpdir(), `skillnaav_${Date.now()}_${Math.random().toString(36).slice(2)}.py`);
          fs.writeFileSync(tmpPath, String(code), "utf-8");
          try {
            const { execSync } = require("child_process");
            const out = execSync(`"${pyCmd}" "${tmpPath}"`, {
              timeout: 8000,
              encoding: "utf-8",
              input: String(stdin || ""),
            });
            return res.json({
              success: true,
              runner: "Python 3.11 (Native Sandbox)",
              stdout: out,
              stderr: "",
              compileError: "",
              exitCode: 0,
            });
          } catch (runErr) {
            return res.json({
              success: true,
              runner: "Python 3.11 (Native Sandbox)",
              stdout: runErr.stdout || "",
              stderr: runErr.stderr || runErr.message || "",
              compileError: "",
              exitCode: runErr.status ?? 1,
            });
          } finally {
            try { fs.unlinkSync(tmpPath); } catch {}
          }
        } catch (e) {
          console.warn("Local Python execution failed:", e.message);
        }
      }
    }

    // Pre-process code for languages with specific file-naming quirks on Wandbox
    let processedCode = String(code);
    if (lang === "java") {
      processedCode = processedCode.replace(/\bpublic\s+class\b/g, "class");
    }

    // Optional self-hosted Piston instance if configured in backend/.env (PISTON_API_URL)
    if (process.env.PISTON_API_URL) {
      try {
        const pistonLangMap = {
          cpp: { language: "c++", version: "*", file: "main.cpp" },
          c: { language: "c", version: "*", file: "main.c" },
          python: { language: "python", version: "*", file: "main.py" },
          javascript: { language: "javascript", version: "*", file: "main.js" },
          typescript: { language: "typescript", version: "*", file: "main.ts" },
          java: { language: "java", version: "*", file: "Main.java" },
          go: { language: "go", version: "*", file: "main.go" },
          rust: { language: "rust", version: "*", file: "main.rs" },
          php: { language: "php", version: "*", file: "main.php" },
          ruby: { language: "ruby", version: "*", file: "main.rb" },
          csharp: { language: "csharp", version: "*", file: "Main.cs" },
          bash: { language: "bash", version: "*", file: "script.sh" },
        };
        const cfg = pistonLangMap[lang] || pistonLangMap.cpp;
        const pistonResp = await axios.post(
          process.env.PISTON_API_URL,
          {
            language: cfg.language,
            version: cfg.version,
            files: [{ name: cfg.file, content: code }],
            stdin: String(stdin || ""),
          },
          { timeout: 15000 }
        );
        const d = pistonResp.data || {};
        return res.json({
          success: true,
          runner: "piston-self-hosted",
          stdout: d.run?.stdout || "",
          stderr: d.run?.stderr || "",
          compileError: d.compile?.stderr || d.compile?.output || "",
          exitCode: d.run?.code ?? 0,
        });
      } catch (err) {
        console.warn("Self-hosted Piston failed, falling back to Judge0/Wandbox:", err.message);
      }
    }

    // Primary Cloud Sandbox: Judge0 Community Edition (open-source, 70+ languages, 100% free, high performance)
    const judge0Id = JUDGE0_LANGUAGE_IDS[lang];
    if (judge0Id) {
      try {
        const j0Resp = await axios.post(
          "https://ce.judge0.com/submissions?wait=true",
          {
            source_code: String(code),
            language_id: judge0Id,
            stdin: String(stdin || ""),
          },
          { timeout: 14000 }
        );
        const j0Data = j0Resp?.data || {};
        const statusId = j0Data.status?.id;
        const statusDesc = j0Data.status?.description || "";
        const stdout = j0Data.stdout || "";
        const stderr = j0Data.stderr || "";
        const compileErr =
          j0Data.compile_output ||
          (statusId && statusId !== 3 && statusId !== 4 ? statusDesc : "");

        if (stdout || stderr || compileErr || statusId === 3) {
          const timeBadge = j0Data.time ? ` · ${j0Data.time}s` : "";
          return res.json({
            success: true,
            runner: `Judge0 CE (${lang.toUpperCase()}${timeBadge})`,
            stdout,
            stderr,
            compileError: compileErr,
            exitCode: statusId === 3 ? 0 : 1,
          });
        }
      } catch (j0Err) {
        console.warn("Judge0 CE execution failed, falling back to Wandbox:", j0Err.message);
      }
    }

    // Secondary Cloud Sandbox: Wandbox open-source compiler API
    const target = await resolveWandboxTarget(lang);

    try {
      let wbResp;
      try {
        wbResp = await axios.post(
          "https://wandbox.org/api/compile.json",
          {
            compiler: target.compiler,
            code: processedCode,
            options: target.options,
            stdin: String(stdin || ""),
          },
          { timeout: 18000 }
        );
      } catch (optErr) {
        if (target.options) {
          wbResp = await axios.post(
            "https://wandbox.org/api/compile.json",
            {
              compiler: target.compiler,
              code: processedCode,
              stdin: String(stdin || ""),
            },
            { timeout: 18000 }
          );
        } else {
          throw optErr;
        }
      }
      let data = wbResp?.data || {};
      let compErr = data.compiler_error || data.compiler_message || "";
      const progErr = data.program_error || "";

      // If Wandbox returned container init error (catatonit or OCI clone error), reject and trigger fallback
      if (/catatonit|failed to exec pid1|OCI runtime error|crun: clone/i.test(compErr + progErr)) {
        throw new Error("Wandbox container runtime error: " + (progErr || compErr));
      }

      return res.json({
        success: true,
        runner: `wandbox (${target.compiler})`,
        stdout: data.program_output || "",
        stderr: progErr,
        compileError: compErr,
        exitCode: Number(data.status ?? 0),
      });
    } catch (err) {
      // Final native fallbacks
      if (lang === "python" || lang === "py") {
        const pyCmd = getLocalPythonCommand();
        if (pyCmd) {
          try {
            const { execSync } = require("child_process");
            const out = execSync(`"${pyCmd}" -c ` + JSON.stringify(String(code)), {
              timeout: 8000,
              encoding: "utf-8",
              input: String(stdin || ""),
            });
            return res.json({
              success: true,
              runner: "Python 3.11 (Native Fallback)",
              stdout: out,
              stderr: "",
              compileError: "",
              exitCode: 0,
            });
          } catch (localErr) {
            return res.json({
              success: true,
              runner: "Python 3.11 (Native Fallback)",
              stdout: localErr.stdout || "",
              stderr: localErr.stderr || localErr.message || "",
              compileError: "",
              exitCode: 1,
            });
          }
        }
      }

      return res.status(502).json({
        success: false,
        message: "Online compiler service is temporarily unreachable. Please retry.",
        error: err.message,
      });
    }
  });
});

module.exports = {
  getCadConfig,
  getPartnerInternships,
  getInternshipApplicants,
  listAssignments,
  getAssignmentById,
  createAssignment,
  updateAssignment,
  deleteAssignment,
  uploadStarterFile,
  recordActivity,
  saveProgress,
  submitAssignment,
  listSubmissionsForAssignment,
  gradeSubmission,
  runCode,
};

