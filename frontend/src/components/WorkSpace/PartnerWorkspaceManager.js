import React, { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import axios from "../../api/axiosInstance";
import StudentWorkInspector from "./StudentWorkInspector";
import { formatDurationSeconds } from "./activitySync";
import {
  FREE_TOOL_CATALOG,
  WORK_SPACE_SECTORS,
  getToolMeta,
  getToolsForSector,
} from "./toolCatalog";

const CUSTOM_TOOLS_STORAGE_KEY = "edutechex_custom_tools_v1";

const loadSavedCustomTools = () => {
  try {
    const raw = localStorage.getItem(CUSTOM_TOOLS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const resolveFileUrl = (url = "") => {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  const base = (process.env.REACT_APP_API_BASE || "").replace(/\/+$/, "");
  return `${base}${url.startsWith("/") ? url : `/${url}`}`;
};

const readStoredToken = (key) => {
  const raw = localStorage.getItem(key) || sessionStorage.getItem(key);
  if (!raw) return "";
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === "string" ? parsed : raw;
  } catch {
    return raw;
  }
};

const getAuthToken = (role = "school-admin") => {
  if (role === "partner") {
    return readStoredToken("token") || readStoredToken("userToken") || "";
  }
  if (role === "admin") {
    return readStoredToken("adminToken") || readStoredToken("token") || "";
  }
  return (
    readStoredToken("schoolAdminToken") ||
    readStoredToken("token") ||
    readStoredToken("adminToken") ||
    ""
  );
};

const createInitialForm = () => ({
  title: "",
  description: "",
  instructions: "",
  category: "Mechanical CAD",
  toolType: "builtin-cad",
  workDate: new Date().toISOString().slice(0, 10),
  starterCode: "",
  codeLanguage: "cpp",
  expectedOutput: "",
  difficulty: "Beginner",
  workspaceMode: "builtin-cad",
  externalToolUrl: "",
  dueDate: "",
  maxScore: 100,
  allowLateSubmission: true,
  isGlobal: false,
  targetScope: "all",
  internshipId: "",
  internshipTitle: "",
  targetAudience: "all-applicants",
  targetStudentIds: [],
  targetSpecs: {
    enabled: false,
    expectedVolumeMm3: "",
    volumeTolerancePct: 5,
    expectedBoundsMm: { x: "", y: "", z: "" },
    boundsToleranceMm: 2,
    requireWatertight: true,
  },
});

const PartnerWorkspaceManager = ({ role = "school-admin" }) => {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [toolCategoryFilter, setToolCategoryFilter] = useState("all");
  const [toolSearchQuery, setToolSearchQuery] = useState("");
  const [form, setForm] = useState(() => createInitialForm());
  const [starterFile, setStarterFile] = useState(null);
  const [savingAssignment, setSavingAssignment] = useState(false);

  // Internship & Applicant targeting state
  const [internships, setInternships] = useState([]);
  const [applicants, setApplicants] = useState([]);
  const [loadingApplicants, setLoadingApplicants] = useState(false);

  // Live Monitor & Submissions Review State
  const [reviewAssignment, setReviewAssignment] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [inspectVersionIdx, setInspectVersionIdx] = useState(null);
  const [livePolling, setLivePolling] = useState(true);
  const [gradeFeedback, setGradeFeedback] = useState("");
  const [rubricPoints, setRubricPoints] = useState([]);
  const [grading, setGrading] = useState(false);

  // Direct Instructor Custom Tool State
  const [customTools, setCustomTools] = useState(() => loadSavedCustomTools());
  const [showAddCustomTool, setShowAddCustomTool] = useState(false);
  const [customToolDraft, setCustomToolDraft] = useState({
    name: "",
    category: "Custom Lab",
    embedUrl: "",
    license: "Open Source / Free",
    description: "",
  });

  // Guided Share Flow inside Modal: Sector -> Internship -> Tool -> Send
  const [modalSectorId, setModalSectorId] = useState("");
  const [modalSectorMenuOpen, setModalSectorMenuOpen] = useState(false);
  const [showAllToolsInModal, setShowAllToolsInModal] = useState(false);
  const modalSectorRef = useRef(null);

  useEffect(() => {
    const onOutside = (e) => {
      if (modalSectorRef.current && !modalSectorRef.current.contains(e.target)) {
        setModalSectorMenuOpen(false);
      }
    };
    const onEsc = (e) => {
      if (e.key === "Escape") setModalSectorMenuOpen(false);
    };
    document.addEventListener("mousedown", onOutside);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onOutside);
      document.removeEventListener("keydown", onEsc);
    };
  }, []);

  const fetchAssignments = useCallback(async () => {
    try {
      setLoading(true);
      setApiError("");
      const token = getAuthToken(role);
      const res = await axios.get("/api/daily-work/assignments", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAssignments(res.data?.assignments || []);
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        "Failed to load daily work assignments. If the backend server was already running, restart it to activate /api/daily-work routes.";
      setApiError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [role]);

  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  const fetchInternships = useCallback(async () => {
    if (role === "school-admin") return;
    try {
      const token = getAuthToken(role);
      const res = await axios.get("/api/daily-work/partner/internships", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const list = res.data?.internships || [];
      setInternships(list);
      if (list.length > 0) {
        setForm((prev) =>
          prev.internshipId
            ? prev
            : {
                ...prev,
                targetScope: "internship",
                internshipId: list[0]._id,
                internshipTitle: list[0].jobTitle || "",
              }
        );
      }
    } catch {
      // Optional for school-admin or if backend not restarted yet
    }
  }, [role]);

  useEffect(() => {
    fetchInternships();
  }, [fetchInternships]);

  useEffect(() => {
    if (!form.internshipId || form.targetScope !== "internship") {
      setApplicants([]);
      return;
    }
    let active = true;
    const loadApplicants = async () => {
      try {
        setLoadingApplicants(true);
        const token = getAuthToken(role);
        const res = await axios.get(
          `/api/daily-work/partner/internships/${form.internshipId}/applicants`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (active) setApplicants(res.data?.applicants || []);
      } catch {
        if (active) setApplicants([]);
      } finally {
        if (active) setLoadingApplicants(false);
      }
    };
    loadApplicants();
    return () => {
      active = false;
    };
  }, [form.internshipId, form.targetScope, role]);

  const handleSelectTool = (toolId) => {
    const meta = getToolMeta(toolId);
    const nextWorkspaceMode = meta.mode || "builtin-cad";

    setForm((prev) => ({
      ...prev,
      toolType: toolId,
      workspaceMode: nextWorkspaceMode,
      category: meta.category || prev.category,
      codeLanguage: meta.language || prev.codeLanguage,
      starterCode: meta.defaultCode !== undefined ? meta.defaultCode : prev.starterCode,
      externalToolUrl: meta.embedUrl || "",
    }));
  };

  const handleAddCustomTool = (e) => {
    e.preventDefault();
    const cleanName = customToolDraft.name.trim();
    const cleanUrl = customToolDraft.embedUrl.trim();
    if (!cleanName || !cleanUrl) {
      toast.warning("Please enter a tool name and valid URL.");
      return;
    }
    const newTool = {
      id: `custom-${Date.now()}`,
      isCustom: true,
      name: cleanName,
      shortLabel: cleanName.slice(0, 24),
      category: customToolDraft.category.trim() || "Custom Lab",
      license: customToolDraft.license.trim() || "Open Source / Free",
      mode: "iframe",
      embedUrl: cleanUrl,
      liveMonitored: false,
      description:
        customToolDraft.description.trim() ||
        "Custom open-source or web tool added by instructor.",
    };
    const next = [newTool, ...customTools];
    setCustomTools(next);
    try {
      localStorage.setItem(CUSTOM_TOOLS_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore storage quota errors
    }
    setCustomToolDraft({
      name: "",
      category: "Custom Lab",
      embedUrl: "",
      license: "Open Source / Free",
      description: "",
    });
    setShowAddCustomTool(false);
    toast.success(`"${newTool.name}" added! Click "Share to Students" anytime to assign it.`);
  };

  const handleDeleteCustomTool = (customId) => {
    const next = customTools.filter((t) => t.id !== customId);
    setCustomTools(next);
    try {
      localStorage.setItem(CUSTOM_TOOLS_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
    toast.info("Custom tool removed from your library.");
  };

  const handleShareToolWithStudents = (tool) => {
    const isCustom = Boolean(tool.isCustom);
    setForm({
      ...createInitialForm(),
      title: tool.name,
      description: tool.description || "",
      category: tool.category || "Custom Lab",
      toolType: isCustom ? "custom-oss-tool" : tool.id,
      workspaceMode: isCustom ? "iframe" : tool.mode || "builtin-cad",
      codeLanguage: tool.language || "cpp",
      starterCode: tool.defaultCode || "",
      externalToolUrl: tool.embedUrl || "",
    });
    setShowCreateModal(true);
  };

  const handleCreateAssignment = async (e) => {
    e.preventDefault();
    try {
      if (form.targetScope === "internship" && !form.internshipId) {
        toast.warning("Please select an internship or switch target audience.");
        return;
      }
      setSavingAssignment(true);
      const token = getAuthToken(role);
      const payload = {
        ...form,
        isGlobal: form.targetScope === "all",
        internshipId: form.targetScope === "internship" ? form.internshipId : null,
        targetStudentIds:
          form.targetScope === "internship" && form.targetAudience === "specific-students"
            ? form.targetStudentIds
            : [],
        maxScore: Number(form.maxScore) || 100,
        targetSpecs: {
          enabled: Boolean(form.targetSpecs.enabled),
          expectedVolumeMm3: form.targetSpecs.expectedVolumeMm3
            ? Number(form.targetSpecs.expectedVolumeMm3)
            : null,
          volumeTolerancePct: Number(form.targetSpecs.volumeTolerancePct) || 5,
          expectedBoundsMm: {
            x: form.targetSpecs.expectedBoundsMm.x ? Number(form.targetSpecs.expectedBoundsMm.x) : null,
            y: form.targetSpecs.expectedBoundsMm.y ? Number(form.targetSpecs.expectedBoundsMm.y) : null,
            z: form.targetSpecs.expectedBoundsMm.z ? Number(form.targetSpecs.expectedBoundsMm.z) : null,
          },
          boundsToleranceMm: Number(form.targetSpecs.boundsToleranceMm) || 2,
          requireWatertight: Boolean(form.targetSpecs.requireWatertight),
        },
      };

      const res = await axios.post("/api/daily-work/assignments", payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const created = res.data.assignment;

      if (starterFile && created?._id) {
        const fd = new FormData();
        fd.append("file", starterFile);
        await axios.post(`/api/daily-work/assignments/${created._id}/upload-starter`, fd, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
        });
      }

      toast.success("Daily work & free open-source tool sent to targeted students!");
      setShowCreateModal(false);
      setForm(createInitialForm());
      setStarterFile(null);
      fetchAssignments();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to send daily work");
    } finally {
      setSavingAssignment(false);
    }
  };

  const handleDeleteAssignment = async (id) => {
    if (!window.confirm("Delete this daily work task?")) return;
    try {
      const token = getAuthToken(role);
      await axios.delete(`/api/daily-work/assignments/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success("Deleted");
      fetchAssignments();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Delete failed");
    }
  };

  const selectSubmissionForReview = useCallback((sub, assignmentObj = reviewAssignment) => {
    setSelectedSubmission(sub);
    setInspectVersionIdx(null);
    setGradeFeedback(sub.grade?.feedback || "");
    const existingRubric = sub.grade?.rubricScores;
    if (Array.isArray(existingRubric) && existingRubric.length > 0) {
      setRubricPoints(existingRubric);
    } else {
      setRubricPoints(
        (assignmentObj?.rubric || []).map((r) => ({
          criterion: r.criterion,
          maxPoints: r.maxPoints,
          points: r.maxPoints,
          comment: "",
        }))
      );
    }
  }, [reviewAssignment]);

  const openSubmissionsReview = useCallback(async (assignment, { silent = false } = {}) => {
    try {
      const token = getAuthToken(role);
      const res = await axios.get(`/api/daily-work/assignments/${assignment._id}/submissions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setReviewAssignment(res.data.assignment);
      const subs = res.data.submissions || [];
      setSubmissions(subs);
      setSelectedSubmission((prevSelected) => {
        if (prevSelected) {
          const updatedMatch = subs.find(
            (s) => String(s.studentId) === String(prevSelected.studentId)
          );
          if (updatedMatch) return updatedMatch;
        }
        if (subs.length > 0) {
          if (!silent) {
            selectSubmissionForReview(subs[0], res.data.assignment);
          }
          return subs[0];
        }
        return null;
      });
    } catch (err) {
      if (!silent) {
        toast.error(err?.response?.data?.message || "Failed to fetch live student activity");
      }
    }
  }, [role, selectSubmissionForReview]);

  // Live auto-refresh every 10s while Partner is monitoring student work
  useEffect(() => {
    if (!reviewAssignment?._id || !livePolling) return undefined;
    const timer = setInterval(() => {
      openSubmissionsReview(reviewAssignment, { silent: true });
    }, 10000);
    return () => clearInterval(timer);
  }, [reviewAssignment, livePolling, openSubmissionsReview]);

  const handleSubmitGrade = async () => {
    if (!selectedSubmission || selectedSubmission.isNotStarted) return;
    try {
      setGrading(true);
      const token = getAuthToken(role);
      const totalScore = rubricPoints.reduce((sum, r) => sum + (Number(r.points) || 0), 0);
      const res = await axios.put(
        `/api/daily-work/submissions/${selectedSubmission._id}/grade`,
        {
          score: totalScore,
          rubricScores: rubricPoints,
          feedback: gradeFeedback,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const updated = res.data.submission;
      setSubmissions((prev) => prev.map((s) => (s._id === updated._id ? updated : s)));
      setSelectedSubmission(updated);
      toast.success("Grade saved!");
      fetchAssignments();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to save grade");
    } finally {
      setGrading(false);
    }
  };

  const selectedToolMeta = getToolMeta(form.toolType);
  const isSelectedCodeTool = [
    "code",
    "web",
    "sql",
    "jscad",
    "diagram",
    "data",
    "markdown",
    "regex",
  ].includes(selectedToolMeta.mode);

  // Submissions Review View
  if (reviewAssignment) {
    const reviewToolMeta = getToolMeta(reviewAssignment.toolType || reviewAssignment.workspaceMode);
    const activeVersion =
      inspectVersionIdx !== null && selectedSubmission?.versions?.[inspectVersionIdx]
        ? selectedSubmission.versions[inspectVersionIdx]
        : null;

    const inspectUrl = resolveFileUrl(
      activeVersion?.stlUrl ||
        activeVersion?.stepUrl ||
        selectedSubmission?.stlUrl ||
        selectedSubmission?.stepUrl ||
        ""
    );
    const inspectName = inspectUrl ? inspectUrl.split("/").pop() : "model.stl";
    const inspectCode = activeVersion?.submittedCode ?? selectedSubmission?.submittedCode ?? "";
    const inspectOutput = activeVersion?.codeOutput ?? selectedSubmission?.codeOutput ?? "";

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
          <div>
            <button
              type="button"
              onClick={() => {
                setReviewAssignment(null);
                setSelectedSubmission(null);
              }}
              className="text-xs font-semibold text-blue-600 hover:underline"
            >
              ← Back to Daily Work
            </button>
            <h2 className="text-lg font-bold text-slate-900">
              Live Monitor &amp; Grade: {reviewAssignment.title}
            </h2>
            <span className="text-xs text-slate-500">
              Assigned Tool: {reviewToolMeta.name} ({reviewToolMeta.license})
              {reviewAssignment.internshipTitle ? ` · Internship: ${reviewAssignment.internshipTitle}` : ""}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setLivePolling((v) => !v)}
              className={`rounded-full px-3 py-1 text-xs font-semibold border ${
                livePolling
                  ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                  : "border-slate-200 bg-slate-100 text-slate-600"
              }`}
            >
              {livePolling ? "● Live Auto-Refresh (10s)" : "Auto-Refresh Paused"}
            </button>
            <button
              type="button"
              onClick={() => openSubmissionsReview(reviewAssignment)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              ↻ Refresh Now
            </button>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              {submissions.length} Student(s)
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          {/* Student Live Activity Roster */}
          <div className="lg:col-span-3 space-y-2 rounded-xl border border-slate-200 bg-white p-3">
            <h3 className="text-xs font-bold uppercase text-slate-500">Students ({submissions.length})</h3>
            {submissions.length === 0 ? (
              <p className="text-xs text-slate-400 py-4">No targeted students or activity yet.</p>
            ) : (
              submissions.map((sub) => {
                const isSelected = String(selectedSubmission?.studentId) === String(sub.studentId);
                return (
                  <button
                    key={sub._id || sub.studentId}
                    type="button"
                    onClick={() => selectSubmissionForReview(sub)}
                    className={`w-full rounded-lg border p-2.5 text-left text-xs transition ${
                      isSelected
                        ? "border-blue-500 bg-blue-50"
                        : "border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 font-semibold text-slate-900">
                      <span className="truncate">{sub.studentName}</span>
                      {sub.isOnlineNow ? (
                        <span className="shrink-0 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
                          LIVE
                        </span>
                      ) : sub.plagiarismFlags?.duplicateHashMatch ? (
                        <span className="shrink-0 rounded bg-rose-100 px-1.5 py-0.5 text-[10px] text-rose-700">
                          Hash Match!
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
                      <span className="uppercase">{sub.status}</span>
                      <span>
                        {sub.timeSpentSeconds > 0
                          ? formatDurationSeconds(sub.timeSpentSeconds)
                          : sub.applicationStatus || "Pending"}
                      </span>
                    </div>
                    {sub.lastAction && (
                      <div className="mt-1 truncate text-[10px] text-slate-500">
                        {sub.lastAction}
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Live Work Inspector + Grading */}
          {selectedSubmission ? (
            <div className="lg:col-span-9 grid grid-cols-1 gap-4 xl:grid-cols-12">
              <div className="xl:col-span-7 space-y-3">
                <StudentWorkInspector
                  assignment={reviewAssignment}
                  submission={selectedSubmission}
                  activeVersion={activeVersion}
                  inspectUrl={inspectUrl}
                  inspectName={inspectName}
                  inspectCode={inspectCode}
                  inspectOutput={inspectOutput}
                />

                {selectedSubmission.versions?.length > 0 && (
                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <div className="text-xs font-bold text-slate-700 mb-2">
                      Version History ({selectedSubmission.versions.length} snapshots)
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => setInspectVersionIdx(null)}
                        className={`rounded-md px-2.5 py-1 text-xs font-medium border ${
                          inspectVersionIdx === null
                            ? "bg-blue-600 text-white border-blue-600"
                            : "bg-slate-50 text-slate-700 border-slate-200"
                        }`}
                      >
                        Live / Latest
                      </button>
                      {selectedSubmission.versions.map((v, idx) => (
                        <button
                          key={v._id || idx}
                          type="button"
                          onClick={() => setInspectVersionIdx(idx)}
                          className={`rounded-md px-2.5 py-1 text-xs font-medium border ${
                            inspectVersionIdx === idx
                              ? "bg-blue-600 text-white border-blue-600"
                              : "bg-slate-50 text-slate-700 border-slate-200"
                          }`}
                        >
                          v{v.versionNumber}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Right: Auto-checks, Plagiarism Flag & Rubric */}
              <div className="xl:col-span-5 space-y-3">
                {selectedSubmission.plagiarismFlags?.duplicateHashMatch && (
                  <div className="rounded-xl border border-rose-300 bg-rose-50 p-3 text-xs text-rose-800">
                    <strong>Similarity Alert:</strong>{" "}
                    {selectedSubmission.plagiarismFlags.note}
                  </div>
                )}

                {selectedSubmission.geometryMetrics && (
                  <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
                    <h4 className="text-xs font-bold uppercase text-slate-500">
                      Server Geometry Metrics
                    </h4>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded bg-slate-50 p-2">
                        <div className="text-slate-400">Volume</div>
                        <div className="font-bold text-slate-800">
                          {selectedSubmission.geometryMetrics.volumeMm3} mm³
                        </div>
                      </div>
                      <div className="rounded bg-slate-50 p-2">
                        <div className="text-slate-400">Bounds (mm)</div>
                        <div className="font-bold text-slate-800">
                          {selectedSubmission.geometryMetrics.boundingBoxMm?.x} ×{" "}
                          {selectedSubmission.geometryMetrics.boundingBoxMm?.y} ×{" "}
                          {selectedSubmission.geometryMetrics.boundingBoxMm?.z}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {selectedSubmission.autoCheckResults?.checks?.length > 0 && (
                  <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-1">
                    <h4 className="text-xs font-bold uppercase text-slate-500 mb-1">Auto-Checks</h4>
                    {selectedSubmission.autoCheckResults.checks.map((c, idx) => (
                      <div
                        key={idx}
                        className={`rounded px-2 py-1 text-[11px] ${
                          c.passed ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"
                        }`}
                      >
                        {c.passed ? "✓" : "✕"} {c.name}: {c.actual}
                      </div>
                    ))}
                  </div>
                )}

                {/* Rubric Grading Card */}
                <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                  <h4 className="text-xs font-bold uppercase text-slate-500">Rubric Grading</h4>
                  {rubricPoints.map((r, idx) => (
                    <div key={r.criterion} className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-800">{r.criterion}</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min={0}
                          max={r.maxPoints}
                          value={r.points}
                          onChange={(e) => {
                            const val = Math.min(r.maxPoints, Math.max(0, Number(e.target.value)));
                            setRubricPoints((prev) =>
                              prev.map((item, i) => (i === idx ? { ...item, points: val } : item))
                            );
                          }}
                          className="w-16 rounded border border-slate-300 px-2 py-1 text-right text-xs"
                        />
                        <span className="text-slate-400">/ {r.maxPoints}</span>
                      </div>
                    </div>
                  ))}

                  <textarea
                    rows={3}
                    placeholder="Feedback for student..."
                    value={gradeFeedback}
                    onChange={(e) => setGradeFeedback(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                  />

                  <button
                    type="button"
                    disabled={grading || selectedSubmission.isNotStarted}
                    onClick={handleSubmitGrade}
                    className="w-full rounded-lg bg-emerald-600 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {selectedSubmission.isNotStarted
                      ? "Waiting for Student Activity"
                      : grading
                      ? "Saving Grade..."
                      : `Save Grade (${rubricPoints.reduce((s, r) => s + (Number(r.points) || 0), 0)} pts)`}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="lg:col-span-9 flex items-center justify-center rounded-xl border border-slate-200 bg-white p-12 text-sm text-slate-400">
              Select a student submission to inspect their work and grade.
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Modern Partner & Instructor Work Space Hero */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-gradient-to-r from-[#0f172a] via-[#1e1b4b] to-[#312e81] px-6 py-5 text-white shadow-md">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold tracking-wide text-indigo-100 border border-white/15 mb-2">
            EduTechEx Work Space · Partner &amp; Instructor Studio
          </span>
          <h1 className="text-2xl font-bold tracking-tight">Work Space</h1>
          <p className="mt-1 text-xs sm:text-sm text-indigo-100/90 max-w-2xl">
            Add custom open-source tools, pick from {FREE_TOOL_CATALOG.length + customTools.length} tools across 11 sectors, share directly to students, and monitor progress live.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowAddCustomTool((prev) => !prev)}
            className="rounded-xl border border-white/25 bg-white/10 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/20"
          >
            {showAddCustomTool ? "Close Custom Tool Form" : "+ Add Custom Tool"}
          </button>
          <button
            type="button"
            onClick={() => {
              setForm(createInitialForm());
              setModalSectorId("");
              setModalSectorMenuOpen(false);
              setShowAllToolsInModal(false);
              setShowCreateModal(true);
            }}
            className="rounded-xl bg-indigo-500 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-400"
          >
            + Share Tool / Task to Students
          </button>
        </div>
      </div>

      {/* Inline Instructor Custom Tool Builder */}
      {showAddCustomTool && (
        <form
          onSubmit={handleAddCustomTool}
          className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-5 shadow-sm space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Add Custom Open-Source or Web Tool Directly
              </h2>
              <p className="text-xs text-slate-500">
                Add any browser tool URL (JupyterLite, Octave, LibreCAD, custom sandbox, etc.) to your library and share it with students in 1 click.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Tool Name *
              </label>
              <input
                type="text"
                required
                value={customToolDraft.name}
                onChange={(e) =>
                  setCustomToolDraft((p) => ({ ...p, name: e.target.value }))
                }
                placeholder="e.g., LibreCAD Web / Octave Lab"
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Tool / Embed URL *
              </label>
              <input
                type="url"
                required
                value={customToolDraft.embedUrl}
                onChange={(e) =>
                  setCustomToolDraft((p) => ({ ...p, embedUrl: e.target.value }))
                }
                placeholder="https://..."
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Category / Sector Label
              </label>
              <input
                type="text"
                value={customToolDraft.category}
                onChange={(e) =>
                  setCustomToolDraft((p) => ({ ...p, category: e.target.value }))
                }
                placeholder="e.g., Robotics / AI / CAD"
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                License
              </label>
              <input
                type="text"
                value={customToolDraft.license}
                onChange={(e) =>
                  setCustomToolDraft((p) => ({ ...p, license: e.target.value }))
                }
                placeholder="MIT / GPL / Open Source"
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Description
              </label>
              <input
                type="text"
                value={customToolDraft.description}
                onChange={(e) =>
                  setCustomToolDraft((p) => ({ ...p, description: e.target.value }))
                }
                placeholder="Brief note explaining what students can build or test with this tool..."
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowAddCustomTool(false)}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700"
              >
                Save Tool to Library
              </button>
            </div>
          </div>
        </form>
      )}

      {apiError && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-900">
          <span>{apiError}</span>
          <button
            type="button"
            onClick={fetchAssignments}
            className="rounded-md bg-amber-200 px-2.5 py-1 font-semibold text-amber-950 hover:bg-amber-300"
          >
            Retry
          </button>
        </div>
      )}

      {/* Sent Tasks / Active Student Assignments */}
      {loading ? (
        <div className="h-24 animate-pulse rounded-xl bg-slate-200" />
      ) : assignments.length === 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/90 px-4 py-3.5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700 font-bold text-xs">
              0
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-800">
                Shared Tools &amp; Sent Tasks
              </h3>
              <p className="text-xs text-slate-500">
                No tasks shared yet. Click <strong>Share to Students →</strong> on any tool below or use <strong>+ Share Tool / Task to Students</strong>.
              </p>
            </div>
          </div>
          <span className="rounded-full bg-white border border-slate-200 px-3 py-1 text-[11px] font-medium text-slate-500">
            Ready to Share
          </span>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-600">
              Shared Tools &amp; Active Tasks ({assignments.length})
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {assignments.map((a) => {
              const toolMeta = getToolMeta(a.toolType || a.workspaceMode);
              return (
                <div
                  key={a._id}
                  className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-indigo-200 hover:shadow-md"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex flex-wrap items-center gap-1.5 mb-1">
                          <span className="rounded bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 border border-indigo-200">
                            {toolMeta.shortLabel}
                          </span>
                          {a.internshipTitle && (
                            <span className="rounded bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200">
                              Internship: {a.internshipTitle}
                            </span>
                          )}
                          <span className="text-[11px] font-semibold uppercase text-slate-500">
                            {a.category} · {a.difficulty}
                          </span>
                        </div>
                        <h3 className="text-base font-bold text-slate-900">{a.title}</h3>
                      </div>
                      <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold uppercase text-emerald-700">
                        {a.status}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-slate-600 line-clamp-2">{a.description}</p>
                    <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
                      <span>Active/Draft: {a.submissionStats?.working || 0}</span>
                      <span>Submitted: {a.submissionStats?.submitted || 0}</span>
                      <span>Graded: {a.submissionStats?.graded || 0}</span>
                      {a.dueDate && <span>Due: {new Date(a.dueDate).toLocaleDateString()}</span>}
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                    <button
                      type="button"
                      onClick={() => handleDeleteAssignment(a._id)}
                      className="text-xs font-medium text-rose-600 hover:underline"
                    >
                      Delete
                    </button>
                    <button
                      type="button"
                      onClick={() => openSubmissionsReview(a)}
                      className="rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
                    >
                      Monitor Live &amp; Grade
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Custom Tools Added by Instructor (only shown if custom tools exist) */}
      {customTools.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                My Added Custom Tools ({customTools.length})
              </h2>
              <p className="text-xs text-slate-500">
                Custom tools you added directly — click Share to Students to assign any of them.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {customTools.map((tool) => (
              <div
                key={tool.id}
                className="flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50/60 p-4 shadow-sm transition hover:border-indigo-300 hover:bg-white"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-indigo-700 truncate">
                      {tool.category}
                    </span>
                    <span className="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                      Custom Tool
                    </span>
                  </div>
                  <h3 className="mt-2 text-sm font-bold text-slate-900">{tool.name}</h3>
                  <p className="mt-1 text-xs text-slate-600 line-clamp-2">{tool.description}</p>
                </div>

                <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-200/70 pt-3">
                  <button
                    type="button"
                    onClick={() => handleDeleteCustomTool(tool.id)}
                    className="text-[11px] font-medium text-rose-600 hover:underline"
                  >
                    Remove
                  </button>
                  <button
                    type="button"
                    onClick={() => handleShareToolWithStudents(tool)}
                    className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700"
                  >
                    Share to Students →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Send Daily Work + Guided Sector -> Internship -> Tool Modal */}
      {showCreateModal && (() => {
        const selectedModalSector =
          WORK_SPACE_SECTORS.find((s) => s.id === modalSectorId) || null;
        const sectorInternships = modalSectorId
          ? internships.filter((i) => i.sector === modalSectorId)
          : [];
        const sectorSpecificTools = modalSectorId
          ? [...customTools, ...getToolsForSector(modalSectorId)]
          : [...customTools, ...FREE_TOOL_CATALOG];
        const modalToolPool = showAllToolsInModal
          ? [...customTools, ...FREE_TOOL_CATALOG]
          : sectorSpecificTools;
        const filteredSectorTools = modalToolPool.filter((t) => {
          if (toolSearchQuery.trim()) {
            const q = toolSearchQuery.trim().toLowerCase();
            const hay = `${t.name} ${t.shortLabel} ${t.category} ${t.license} ${t.description}`.toLowerCase();
            if (!hay.includes(q)) return false;
          }
          if (toolCategoryFilter === "all") return true;
          if (toolCategoryFilter === "live") return Boolean(t.liveMonitored);
          if (toolCategoryFilter === "web") {
            return t.mode === "web" || ["livecodes-playground", "p5js-editor", "regex-json-lab"].includes(t.id);
          }
          if (toolCategoryFilter === "cad") {
            return (
              ["cad", "jscad"].includes(t.mode) ||
              ["freecad-wasm", "openscad-wasm", "solvespace-web", "freecad-container"].includes(t.id)
            );
          }
          if (toolCategoryFilter === "code") return ["code", "web", "regex"].includes(t.mode);
          if (toolCategoryFilter === "data") return ["sql", "data"].includes(t.mode) || t.id === "jupyter-lite";
          if (toolCategoryFilter === "design") {
            return ["diagram", "drawio", "whiteboard", "markdown"].includes(t.mode) || t.id === "excalidraw-board";
          }
          return ["circuit-sim", "wokwi-sim", "cyberchef-lab", "custom-oss-tool"].includes(t.id) || t.isCustom;
        });

        const handlePickModalSector = (sectorId) => {
          setModalSectorId(sectorId);
          setModalSectorMenuOpen(false);
          setShowAllToolsInModal(false);
          const matching = internships.filter((i) => i.sector === sectorId);
          if (matching.length > 0) {
            setForm((prev) => ({
              ...prev,
              targetScope: "internship",
              internshipId: matching[0]._id,
              internshipTitle: matching[0].jobTitle || "",
              targetStudentIds: [],
            }));
          } else {
            setForm((prev) => ({
              ...prev,
              targetScope: role === "school-admin" ? "all" : "internship",
              internshipId: "",
              internshipTitle: "",
              targetStudentIds: [],
            }));
          }
        };

        return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-[2px]">
          <form
            onSubmit={handleCreateAssignment}
            className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
          >
            {/* Clean Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-6 py-4">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                  Share Tool / Task to Students
                </h2>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] font-medium">
                  <span className={`rounded-full px-2 py-0.5 ${modalSectorId ? "bg-indigo-100 text-indigo-700 font-semibold" : "bg-indigo-600 text-white font-semibold"}`}>
                    1. Sector
                  </span>
                  <span className="text-slate-400">→</span>
                  <span className={`rounded-full px-2 py-0.5 ${form.internshipId ? "bg-indigo-100 text-indigo-700 font-semibold" : modalSectorId ? "bg-indigo-600 text-white font-semibold" : "bg-slate-200 text-slate-500"}`}>
                    2. Internship
                  </span>
                  <span className="text-slate-400">→</span>
                  <span className={`rounded-full px-2 py-0.5 ${modalSectorId ? "bg-slate-200 text-slate-700" : "bg-slate-100 text-slate-400"}`}>
                    3. Tool &amp; Task
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-200/70 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {/* Step 1 & Step 2 Side-by-Side (Clean, Zero Orphan Cards) */}
              <div className="grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4 sm:grid-cols-2">
                {/* 1. Sector Dropdown */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1.5">
                    1. Select Sector *
                  </label>
                  <div ref={modalSectorRef} className="relative w-full">
                    <button
                      type="button"
                      aria-haspopup="listbox"
                      aria-expanded={modalSectorMenuOpen}
                      onClick={() => setModalSectorMenuOpen((prev) => !prev)}
                      className="flex w-full items-center justify-between gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-left text-xs font-medium text-slate-800 shadow-sm hover:border-indigo-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                    >
                      <span className="truncate">
                        {selectedModalSector
                          ? `${selectedModalSector.name} (${sectorInternships.length})`
                          : "-- Choose Sector --"}
                      </span>
                      <svg
                        className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${
                          modalSectorMenuOpen ? "rotate-180" : ""
                        }`}
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <path
                          fillRule="evenodd"
                          d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>

                    {modalSectorMenuOpen && (
                      <div
                        role="listbox"
                        aria-label="Select Sector"
                        className="absolute left-0 right-0 top-full z-40 mt-1.5 max-h-56 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-xl"
                      >
                        {WORK_SPACE_SECTORS.map((sector, idx) => {
                          const count = internships.filter((i) => i.sector === sector.id).length;
                          const isSelected = modalSectorId === sector.id;
                          return (
                            <button
                              key={sector.id}
                              type="button"
                              onClick={() => handlePickModalSector(sector.id)}
                              className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs transition ${
                                isSelected
                                  ? "bg-indigo-600 font-semibold text-white"
                                  : "text-slate-700 hover:bg-indigo-50/70"
                              }`}
                            >
                              <span className="truncate">
                                {String(idx + 1).padStart(2, "0")}. {sector.name}
                              </span>
                              <span
                                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                  isSelected
                                    ? "bg-white/20 text-white"
                                    : "bg-slate-100 text-slate-600"
                                }`}
                              >
                                {count}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. Posted Internship Selector */}
                {role !== "school-admin" && (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold text-slate-800">
                        2. Posted Internship *
                      </label>
                      {selectedModalSector && (
                        <button
                          type="button"
                          onClick={() =>
                            setForm((prev) => ({
                              ...prev,
                              targetScope: prev.targetScope === "all" ? "internship" : "all",
                              internshipId:
                                prev.targetScope === "all" ? sectorInternships[0]?._id || "" : "",
                              internshipTitle:
                                prev.targetScope === "all" ? sectorInternships[0]?.jobTitle || "" : "",
                              targetStudentIds: [],
                            }))
                          }
                          className="text-[11px] font-semibold text-indigo-600 hover:underline"
                        >
                          {form.targetScope === "all" ? "Pick Internship" : "Or All Students"}
                        </button>
                      )}
                    </div>

                    {!selectedModalSector ? (
                      <div className="rounded-xl border border-dashed border-slate-300 bg-white/70 px-3 py-2 text-xs text-slate-400">
                        Select a sector first
                      </div>
                    ) : form.targetScope === "all" ? (
                      <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-800">
                        Targeting: All EduTechEx Students
                      </div>
                    ) : sectorInternships.length === 0 ? (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                        No internships posted in this sector yet
                      </div>
                    ) : (
                      <select
                        value={form.internshipId}
                        onChange={(e) => {
                          const picked = sectorInternships.find((i) => i._id === e.target.value);
                          setForm((prev) => ({
                            ...prev,
                            targetScope: "internship",
                            internshipId: e.target.value,
                            internshipTitle: picked?.jobTitle || "",
                            targetStudentIds: [],
                          }));
                        }}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                      >
                        {sectorInternships.map((item) => (
                          <option key={item._id} value={item._id}>
                            {item.jobTitle} ({item.internshipMode || "ONLINE"} · {item.totalApplicants || 0} applicants)
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )}
              </div>

            {/* Step 3: Pick Free Open-Source Tool (shown once sector is selected) */}
            {selectedModalSector && (
            <div className="space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-slate-800">
                    3. Select Tool ({filteredSectorTools.length})
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowAllToolsInModal((prev) => !prev)}
                    className="rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-100"
                  >
                    {showAllToolsInModal ? "Sector Tools Only" : "Show All 41 Tools"}
                  </button>
                </div>
                <input
                  type="text"
                  value={toolSearchQuery}
                  onChange={(e) => setToolSearchQuery(e.target.value)}
                  placeholder="Search tool..."
                  className="w-44 rounded-lg border border-slate-300 px-2.5 py-1 text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>

              {showAllToolsInModal && (
                <div className="flex flex-wrap gap-1">
                  {[
                    ["all", "All"],
                    ["live", "Live Monitored"],
                    ["web", "HTML & Web"],
                    ["code", "Compilers"],
                    ["cad", "3D CAD"],
                    ["data", "SQL & Data"],
                    ["design", "Diagrams"],
                    ["sim", "Labs & Custom"],
                  ].map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setToolCategoryFilter(key)}
                      className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                        toolCategoryFilter === key
                          ? "bg-indigo-600 text-white"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}

              <div className="grid max-h-52 grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3">
                {filteredSectorTools.map((tool) => {
                  const active = tool.isCustom
                    ? form.toolType === "custom-oss-tool" && form.externalToolUrl === tool.embedUrl
                    : form.toolType === tool.id;
                  return (
                    <button
                      key={tool.id}
                      type="button"
                      onClick={() => {
                        if (tool.isCustom) {
                          setForm((prev) => ({
                            ...prev,
                            toolType: "custom-oss-tool",
                            workspaceMode: "iframe",
                            category: tool.category || prev.category,
                            externalToolUrl: tool.embedUrl || "",
                          }));
                        } else {
                          handleSelectTool(tool.id);
                        }
                      }}
                      className={`rounded-xl border p-2.5 text-left transition ${
                        active
                          ? "border-blue-600 bg-blue-50 ring-1 ring-blue-600"
                          : "border-slate-200 bg-white hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-bold text-slate-900">{tool.shortLabel}</span>
                        {tool.liveMonitored && (
                          <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700">
                            LIVE TRACK
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] font-semibold text-indigo-600">{tool.license}</div>
                      <div className="mt-1 text-[11px] text-slate-500 line-clamp-2">
                        {tool.description}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
            )}

            {/* Step 2: Daily Task Details */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Daily Task Title *
                </label>
                <input
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder={
                    isSelectedCodeTool
                      ? "e.g., Day 4: Implement Binary Search in C++"
                      : "e.g., Day 4: Design Bearing Flange in 3D CAD"
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
                <input
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Difficulty</label>
                <select
                  value={form.difficulty}
                  onChange={(e) => setForm({ ...form, difficulty: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                >
                  <option value="Beginner">Beginner</option>
                  <option value="Intermediate">Intermediate</option>
                  <option value="Advanced">Advanced</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Work Date</label>
                <input
                  type="date"
                  value={form.workDate}
                  onChange={(e) => setForm({ ...form, workDate: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Due Date</label>
                <input
                  type="datetime-local"
                  value={form.dueDate}
                  onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                />
              </div>

              {(selectedToolMeta.mode === "iframe") && (
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Open-Source Tool Embed URL
                  </label>
                  <input
                    value={form.externalToolUrl}
                    onChange={(e) => setForm({ ...form, externalToolUrl: e.target.value })}
                    placeholder="https://..."
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                  />
                </div>
              )}

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description *</label>
                <textarea
                  required
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Summary of today's practical work..."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Detailed Instructions / Specs
                </label>
                <textarea
                  rows={3}
                  value={form.instructions}
                  onChange={(e) => setForm({ ...form, instructions: e.target.value })}
                  placeholder="Step-by-step instructions, sample input/output, or CAD dimensions..."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                />
              </div>

              {isSelectedCodeTool ? (
                <>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Starter Code (preloaded inside student&apos;s compiler)
                    </label>
                    <textarea
                      rows={5}
                      value={form.starterCode}
                      onChange={(e) => setForm({ ...form, starterCode: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 bg-slate-950 p-3 font-mono text-xs text-slate-100"
                    />
                  </div>
                  {selectedToolMeta.mode === "code" && (
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Expected Program Output (optional — enables automatic output check)
                      </label>
                      <textarea
                        rows={2}
                        value={form.expectedOutput}
                        onChange={(e) => setForm({ ...form, expectedOutput: e.target.value })}
                        placeholder="Exact expected stdout..."
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs"
                      />
                    </div>
                  )}
                </>
              ) : (
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Attach Starter CAD / Blueprint File (.step, .stl, .fcstd, .scad, .pdf)
                  </label>
                  <input
                    type="file"
                    accept=".step,.stp,.stl,.iges,.igs,.fcstd,.scad,.json,.pdf"
                    onChange={(e) => setStarterFile(e.target.files?.[0] || null)}
                    className="w-full text-xs"
                  />
                </div>
              )}
            </div>

            {!isSelectedCodeTool && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-800">
                  <input
                    type="checkbox"
                    checked={form.targetSpecs.enabled}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        targetSpecs: { ...form.targetSpecs, enabled: e.target.checked },
                      })
                    }
                  />
                  Enable Automated 3D Geometry Auto-Checks
                </label>

                {form.targetSpecs.enabled && (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 text-xs pt-1">
                    <div>
                      <label className="block text-[11px] text-slate-600">Expected Volume (mm³)</label>
                      <input
                        type="number"
                        value={form.targetSpecs.expectedVolumeMm3}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            targetSpecs: {
                              ...form.targetSpecs,
                              expectedVolumeMm3: e.target.value,
                            },
                          })
                        }
                        className="w-full rounded border border-slate-300 px-2 py-1"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-600">Volume Tol (%)</label>
                      <input
                        type="number"
                        value={form.targetSpecs.volumeTolerancePct}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            targetSpecs: {
                              ...form.targetSpecs,
                              volumeTolerancePct: e.target.value,
                            },
                          })
                        }
                        className="w-full rounded border border-slate-300 px-2 py-1"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-600">Bounds Tol (mm)</label>
                      <input
                        type="number"
                        value={form.targetSpecs.boundsToleranceMm}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            targetSpecs: {
                              ...form.targetSpecs,
                              boundsToleranceMm: e.target.value,
                            },
                          })
                        }
                        className="w-full rounded border border-slate-300 px-2 py-1"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {role !== "school-admin" && form.targetScope === "internship" && form.internshipId && (
              <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs font-bold text-indigo-950">
                    Which Applicants Receive Tool ({form.internshipTitle || "Selected Internship"})
                  </div>
                  <select
                    value={form.targetAudience}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, targetAudience: e.target.value }))
                    }
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs"
                  >
                    <option value="all-applicants">All Applicants (Applied + Accepted)</option>
                    <option value="shortlisted-accepted">Shortlisted / Accepted Only</option>
                    <option value="specific-students">Pick Specific Applied Students</option>
                  </select>
                </div>

                {form.targetAudience === "specific-students" && (
                  <div className="rounded-lg border border-slate-200 bg-white p-2.5">
                    <div className="mb-1.5 flex items-center justify-between text-[11px] font-semibold text-slate-600">
                      <span>Select Applied Students ({form.targetStudentIds.length} chosen)</span>
                      {loadingApplicants && <span>Loading applicants...</span>}
                    </div>
                    {applicants.length === 0 ? (
                      <p className="text-xs text-slate-400">No students have applied to this internship yet.</p>
                    ) : (
                      <div className="max-h-36 overflow-y-auto space-y-1">
                        {applicants.map((ap) => {
                          const checked = form.targetStudentIds.includes(ap.studentId);
                          return (
                            <label
                              key={ap.studentId}
                              className="flex items-center justify-between gap-2 rounded px-2 py-1 text-xs hover:bg-slate-50 cursor-pointer"
                            >
                              <span className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(e) => {
                                    const on = e.target.checked;
                                    setForm((prev) => ({
                                      ...prev,
                                      targetStudentIds: on
                                        ? [...prev.targetStudentIds, ap.studentId]
                                        : prev.targetStudentIds.filter((id) => id !== ap.studentId),
                                    }));
                                  }}
                                />
                                <span className="font-medium text-slate-800">{ap.name}</span>
                                <span className="text-slate-400">{ap.email}</span>
                              </span>
                              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                                {ap.status}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            </div>

            <div className="flex items-center justify-end gap-2.5 border-t border-slate-100 bg-slate-50/80 px-6 py-3.5">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingAssignment || !modalSectorId}
                className="rounded-lg bg-indigo-600 px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
              >
                {savingAssignment ? "Sending..." : "Send Tool & Task to Users"}
              </button>
            </div>
          </form>
        </div>
        );
      })()}
    </div>
  );
};

export default PartnerWorkspaceManager;
