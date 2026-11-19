import React, { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import {
  Trash2,
  Pencil,
  Sparkles,
  Eye,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Search,
  Check,
  X,
  Briefcase,
  Award,
} from "lucide-react";
import axios from "../../api/axiosInstance";
import StudentWorkInspector from "./StudentWorkInspector";
import { formatDurationSeconds } from "./activitySync";
import {
  FREE_TOOL_CATALOG,
  WORK_SPACE_SECTORS,
  SECTOR_TOOL_MAP,
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
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editingAssignmentId, setEditingAssignmentId] = useState(null);
  const [isRubricAccordionOpen, setIsRubricAccordionOpen] = useState(false);

  // Student Dropdown & Roster Navigation State (for 100+ students)
  const [studentDropdownOpen, setStudentDropdownOpen] = useState(false);
  const [studentSearchQuery, setStudentSearchQuery] = useState("");
  const [studentStatusFilter, setStudentStatusFilter] = useState("all");
  const studentDropdownRef = useRef(null);

  useEffect(() => {
    const onOutsideDropdown = (e) => {
      if (studentDropdownRef.current && !studentDropdownRef.current.contains(e.target)) {
        setStudentDropdownOpen(false);
      }
    };
    if (studentDropdownOpen) {
      document.addEventListener("mousedown", onOutsideDropdown);
    }
    return () => {
      document.removeEventListener("mousedown", onOutsideDropdown);
    };
  }, [studentDropdownOpen]);

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
    setEditingAssignmentId(null);
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

  const handleEditAssignment = (assignment) => {
    if (!assignment?._id) return;
    setEditingAssignmentId(assignment._id);
    const toolMeta = getToolMeta(assignment.toolType || assignment.workspaceMode);

    // Identify sector for this tool
    const matchedSector =
      Object.entries(SECTOR_TOOL_MAP).find(([, toolIds]) =>
        toolIds.includes(assignment.toolType || assignment.workspaceMode)
      )?.[0] || WORK_SPACE_SECTORS[0].id;
    setModalSectorId(matchedSector);

    setForm({
      title: assignment.title || "",
      description: assignment.description || "",
      instructions: assignment.instructions || "",
      category: assignment.category || toolMeta.category || "Mechanical CAD",
      toolType: assignment.toolType || "builtin-cad",
      workDate: assignment.workDate ? assignment.workDate.slice(0, 10) : new Date().toISOString().slice(0, 10),
      starterCode: assignment.starterCode || "",
      codeLanguage: assignment.codeLanguage || toolMeta.language || "cpp",
      expectedOutput: assignment.expectedOutput || "",
      difficulty: assignment.difficulty || "Beginner",
      workspaceMode: assignment.workspaceMode || toolMeta.mode || "builtin-cad",
      externalToolUrl: assignment.externalToolUrl || toolMeta.embedUrl || "",
      dueDate: assignment.dueDate ? assignment.dueDate.slice(0, 10) : "",
      maxScore: assignment.maxScore || 100,
      allowLateSubmission: assignment.allowLateSubmission !== false,
      isGlobal: Boolean(assignment.isGlobal),
      targetScope: assignment.targetScope || (assignment.internshipId ? "internship" : "all"),
      internshipId: assignment.internshipId || "",
      internshipTitle: assignment.internshipTitle || "",
      targetAudience: assignment.targetAudience || "all-applicants",
      targetStudentIds: assignment.targetStudentIds || [],
      targetSpecs: assignment.targetSpecs || {
        enabled: false,
        expectedVolumeMm3: "",
        volumeTolerancePct: 5,
        expectedBoundsMm: { x: "", y: "", z: "" },
        boundsToleranceMm: 2,
        requireWatertight: true,
      },
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

      if (editingAssignmentId) {
        await axios.put(`/api/daily-work/assignments/${editingAssignmentId}`, payload, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (starterFile) {
          const fd = new FormData();
          fd.append("file", starterFile);
          await axios.post(`/api/daily-work/assignments/${editingAssignmentId}/upload-starter`, fd, {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "multipart/form-data",
            },
          });
        }

        toast.success("Daily work task updated successfully!");
      } else {
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
      }

      setShowCreateModal(false);
      setEditingAssignmentId(null);
      setForm(createInitialForm());
      setStarterFile(null);
      fetchAssignments();
    } catch (err) {
      toast.error(
        err?.response?.data?.message ||
          (editingAssignmentId ? "Failed to update task" : "Failed to send daily work")
      );
    } finally {
      setSavingAssignment(false);
    }
  };

  const handleDeleteAssignment = (assignment) => {
    setDeleteConfirmTarget(assignment);
  };

  const confirmDeleteAssignment = async () => {
    if (!deleteConfirmTarget?._id) return;
    try {
      setIsDeleting(true);
      const token = getAuthToken(role);
      await axios.delete(`/api/daily-work/assignments/${deleteConfirmTarget._id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success("Daily work task deleted successfully");
      setDeleteConfirmTarget(null);
      fetchAssignments();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Delete failed");
    } finally {
      setIsDeleting(false);
    }
  };

const getToolRubric = (toolMeta, existingRubric) => {
  const isCadTool =
    toolMeta.mode === "cad" ||
    toolMeta.category === "Mechanical CAD" ||
    toolMeta.category === "3D CAD" ||
    toolMeta.toolType === "edutechex-cad";
  const isCodeTool =
    ["code", "web", "sql", "regex"].includes(toolMeta.mode) ||
    toolMeta.category === "Compilers & DSA" ||
    toolMeta.category === "Web Development" ||
    toolMeta.category === "Backend & Systems" ||
    toolMeta.category === "Database & SQL";
  const isSimTool =
    ["sim", "quantum", "physics", "circuit"].includes(toolMeta.mode) ||
    toolMeta.category === "Circuit & Embedded";

  // Check if existing rubric has CAD-only criteria while this is NOT a CAD tool
  const hasGenericCadDefault =
    Array.isArray(existingRubric) &&
    existingRubric.length > 0 &&
    existingRubric.some(
      (r) =>
        r.criterion?.includes("Parametric Feature Tree") ||
        r.criterion?.includes("Dimensional Accuracy") ||
        r.criterion?.includes("Geometry & Dimensional")
    );

  if (Array.isArray(existingRubric) && existingRubric.length > 0 && !(hasGenericCadDefault && !isCadTool)) {
    return existingRubric.map((r) => ({
      criterion: r.criterion,
      maxPoints: r.maxPoints ?? 30,
      points: r.points ?? r.maxPoints ?? 30,
      description: r.description || "",
    }));
  }

  if (isCodeTool) {
    return [
      {
        criterion: "Code Correctness & Logic",
        maxPoints: 40,
        points: 40,
        description: "Program compiles and produces expected stdout/outputs without runtime crashes.",
      },
      {
        criterion: "Code Structure & Best Practices",
        maxPoints: 30,
        points: 30,
        description: "Clean syntax, proper variable naming, and modular function structure.",
      },
      {
        criterion: "Problem Requirements & Edge Cases",
        maxPoints: 30,
        points: 30,
        description: "Handles edge cases, validation, and expected task requirements.",
      },
    ];
  }

  if (isSimTool) {
    return [
      {
        criterion: "Simulation Setup & Methodology",
        maxPoints: 40,
        points: 40,
        description: "Accurate parameter configuration and experiment execution.",
      },
      {
        criterion: "Data Analysis & Results",
        maxPoints: 30,
        points: 30,
        description: "Valid simulation outputs, observations, and data interpretation.",
      },
      {
        criterion: "Conclusions & Documentation",
        maxPoints: 30,
        points: 30,
        description: "Clear documentation of scientific findings and conclusions.",
      },
    ];
  }

  if (isCadTool) {
    return [
      {
        criterion: "Geometry & Dimensional Accuracy",
        maxPoints: 40,
        points: 40,
        description: "Matches required part dimensions, hole sizes, and volume constraints.",
      },
      {
        criterion: "Parametric Feature Tree & Workflow",
        maxPoints: 30,
        points: 30,
        description: "Clean sketch profiles, proper booleans, and logical feature order.",
      },
      {
        criterion: "Design Completeness & Export Quality",
        maxPoints: 30,
        points: 30,
        description: "Watertight solid mesh or B-Rep ready for STEP/STL fabrication.",
      },
    ];
  }

  return [
    {
      criterion: "Technical Accuracy & Completeness",
      maxPoints: 40,
      points: 40,
      description: "Meets all core assignment objectives and deliverables.",
    },
    {
      criterion: "Clarity & Methodology",
      maxPoints: 30,
      points: 30,
      description: "Logical execution, clean formatting, and structured workflow.",
    },
    {
      criterion: "Deliverable Quality",
      maxPoints: 30,
      points: 30,
      description: "High-quality final submission, diagrams, or documentation.",
    },
  ];
};

  const selectSubmissionForReview = useCallback((sub, assignmentObj = reviewAssignment) => {
    setSelectedSubmission(sub);
    setInspectVersionIdx(null);
    setGradeFeedback(sub.grade?.feedback || "");
    const toolMeta = getToolMeta(assignmentObj?.toolType || assignmentObj?.workspaceMode);
    const existingRubric = sub.grade?.rubricScores;
    setRubricPoints(getToolRubric(toolMeta, existingRubric || assignmentObj?.rubric));
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
            (s) =>
              (prevSelected._id && String(s._id) === String(prevSelected._id)) ||
              String(s.studentId) === String(prevSelected.studentId) ||
              (Boolean(s.studentEmail && prevSelected.studentEmail) &&
                s.studentEmail.toLowerCase() === prevSelected.studentEmail.toLowerCase())
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
  const isSelectedCadTool =
    selectedToolMeta.mode === "cad" ||
    selectedToolMeta.category === "Mechanical CAD" ||
    selectedToolMeta.toolType === "edutechex-cad";

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

    // 100+ Students Dropdown Navigation & Filtering Calculations
    const currentIndex = submissions.findIndex(
      (s) =>
        (selectedSubmission?._id && String(s._id) === String(selectedSubmission._id)) ||
        String(s.studentId) === String(selectedSubmission?.studentId) ||
        (Boolean(s.studentEmail && selectedSubmission?.studentEmail) &&
          s.studentEmail.toLowerCase() === selectedSubmission.studentEmail.toLowerCase())
    );

    const handlePrevStudent = () => {
      if (submissions.length <= 1) return;
      const prevIdx = currentIndex > 0 ? currentIndex - 1 : submissions.length - 1;
      selectSubmissionForReview(submissions[prevIdx]);
    };

    const handleNextStudent = () => {
      if (submissions.length <= 1) return;
      const nextIdx = currentIndex < submissions.length - 1 ? currentIndex + 1 : 0;
      selectSubmissionForReview(submissions[nextIdx]);
    };

    const statusCounts = {
      all: submissions.length,
      live: submissions.filter((s) => s.isOnlineNow).length,
      submitted: submissions.filter((s) => s.status === "submitted").length,
      draft: submissions.filter((s) => !s.isNotStarted && s.status !== "submitted" && s.status !== "graded").length,
      graded: submissions.filter((s) => s.status === "graded").length,
      notStarted: submissions.filter((s) => s.isNotStarted).length,
    };

    const filteredSubmissions = submissions.filter((sub) => {
      const q = studentSearchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        (sub.studentName && sub.studentName.toLowerCase().includes(q)) ||
        (sub.studentEmail && sub.studentEmail.toLowerCase().includes(q)) ||
        (sub.lastAction && sub.lastAction.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      if (studentStatusFilter === "live") return Boolean(sub.isOnlineNow);
      if (studentStatusFilter === "submitted") return sub.status === "submitted";
      if (studentStatusFilter === "draft") return !sub.isNotStarted && sub.status !== "submitted" && sub.status !== "graded";
      if (studentStatusFilter === "graded") return sub.status === "graded";
      if (studentStatusFilter === "not-started") return Boolean(sub.isNotStarted);
      return true;
    });

    return (
      <div className="space-y-4">
        {/* Sleek EduTechEx Studio Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-gradient-to-r from-[#0f172a] via-[#1e1b4b] to-[#312e81] p-5 text-white shadow-md">
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => {
                setReviewAssignment(null);
                setSelectedSubmission(null);
              }}
              className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-200 hover:text-white transition"
            >
              <span>←</span>
              <span>Back to Work Space Tasks</span>
            </button>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-200 border border-white/15">
                Live Studio
              </span>
              <h2 className="text-lg font-bold text-white tracking-tight">
                {reviewAssignment.title}
              </h2>
            </div>
            <p className="text-xs text-indigo-100/80">
              Assigned Tool: <span className="font-semibold text-white">{reviewToolMeta.name}</span> ({reviewToolMeta.license})
              {reviewAssignment.internshipTitle ? ` · Internship: ${reviewAssignment.internshipTitle}` : ""}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => setLivePolling((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold border transition ${
                livePolling
                  ? "border-emerald-400 bg-emerald-500/20 text-emerald-200 shadow-xs"
                  : "border-white/20 bg-white/10 text-slate-300"
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  livePolling ? "bg-emerald-400 animate-ping" : "bg-slate-400"
                }`}
              />
              <span>{livePolling ? "Auto-Refresh (10s)" : "Paused"}</span>
            </button>
            <button
              type="button"
              onClick={() => openSubmissionsReview(reviewAssignment)}
              className="rounded-xl border border-white/20 bg-white/10 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-white/20 transition active:scale-95"
            >
              ↻ Refresh
            </button>
            <span className="rounded-xl bg-white/15 px-3 py-1.5 text-xs font-semibold text-indigo-100 border border-white/15">
              {submissions.length} Students
            </span>
          </div>
        </div>

        {/* Top Student Switcher Bar - Dropdown, Navigation & Filters for 100+ Students */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Interactive Dropdown Trigger for 100 Students */}
            <div className="relative flex-1 min-w-[280px] max-w-2xl" ref={studentDropdownRef}>
              <button
                type="button"
                onClick={() => setStudentDropdownOpen((v) => !v)}
                className="w-full flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-2.5 text-left transition shadow-2xs hover:border-indigo-300 hover:bg-white"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-2xs ${
                      selectedSubmission?.isOnlineNow
                        ? "bg-emerald-600 ring-2 ring-emerald-300"
                        : selectedSubmission
                        ? "bg-indigo-600"
                        : "bg-slate-400"
                    }`}
                  >
                    {selectedSubmission?.studentName
                      ? selectedSubmission.studentName
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .substring(0, 2)
                          .toUpperCase()
                      : "?"}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-xs sm:text-sm truncate">
                        {selectedSubmission?.studentName || "Select a student to inspect"}
                      </span>
                      {selectedSubmission?.isOnlineNow ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-extrabold text-emerald-800">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          LIVE
                        </span>
                      ) : selectedSubmission?.status === "graded" ? (
                        <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-700">
                          GRADED
                        </span>
                      ) : selectedSubmission?.status === "submitted" ? (
                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                          SUBMITTED
                        </span>
                      ) : selectedSubmission?.isNotStarted ? (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                          NOT STARTED
                        </span>
                      ) : (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                          DRAFT
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate mt-0.5">
                      <span>{selectedSubmission?.studentEmail || `Browse all ${submissions.length} students`}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-slate-400 shrink-0">
                  <span className="text-xs font-semibold text-indigo-600 hidden sm:inline">
                    Switch Student ({submissions.length})
                  </span>
                  {studentDropdownOpen ? (
                    <ChevronUp className="h-4 w-4 text-indigo-600" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-slate-500" />
                  )}
                </div>
              </button>

              {/* Dropdown Menu Popup with Instant Search & Status Filters */}
              {studentDropdownOpen && (
                <div className="absolute left-0 top-full mt-2 w-full sm:w-[500px] z-50 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
                  {/* Search Box */}
                  <div className="relative mb-2.5">
                    <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder={`Search across all ${submissions.length} students...`}
                      value={studentSearchQuery}
                      onChange={(e) => setStudentSearchQuery(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 pl-9 pr-8 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                      autoFocus
                    />
                    {studentSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setStudentSearchQuery("")}
                        className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Filter Tabs */}
                  <div className="flex flex-wrap items-center gap-1.5 pb-2.5 border-b border-slate-100 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setStudentStatusFilter("all")}
                      className={`rounded-lg px-2.5 py-1 font-semibold transition ${
                        studentStatusFilter === "all"
                          ? "bg-slate-900 text-white"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      All ({statusCounts.all})
                    </button>
                    {statusCounts.live > 0 && (
                      <button
                        type="button"
                        onClick={() => setStudentStatusFilter("live")}
                        className={`rounded-lg px-2.5 py-1 font-semibold transition flex items-center gap-1 ${
                          studentStatusFilter === "live"
                            ? "bg-emerald-700 text-white"
                            : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                        }`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Live ({statusCounts.live})
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setStudentStatusFilter("submitted")}
                      className={`rounded-lg px-2.5 py-1 font-semibold transition ${
                        studentStatusFilter === "submitted"
                          ? "bg-blue-700 text-white"
                          : "bg-blue-50 text-blue-700 hover:bg-blue-100"
                      }`}
                    >
                      Submitted ({statusCounts.submitted})
                    </button>
                  </div>

                  {/* Student Options List */}
                  <div className="mt-2 max-h-72 overflow-y-auto space-y-1 pr-1">
                    {filteredSubmissions.length === 0 ? (
                      <p className="py-6 text-center text-xs text-slate-400">
                        No students match your search or filter.
                      </p>
                    ) : (
                      filteredSubmissions.map((sub) => {
                        const isSelected =
                          (selectedSubmission?._id && String(selectedSubmission._id) === String(sub._id)) ||
                          String(selectedSubmission?.studentId) === String(sub.studentId) ||
                          (Boolean(selectedSubmission?.studentEmail && sub.studentEmail) &&
                            selectedSubmission.studentEmail.toLowerCase() === sub.studentEmail.toLowerCase());
                        const initials = (sub.studentName || "S")
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .substring(0, 2)
                          .toUpperCase();

                        return (
                          <button
                            key={sub._id || sub.studentId}
                            type="button"
                            onClick={() => {
                              selectSubmissionForReview(sub);
                              setStudentDropdownOpen(false);
                            }}
                            className={`w-full flex items-center justify-between gap-2.5 rounded-xl p-2.5 text-left transition ${
                              isSelected
                                ? "bg-indigo-50/80 border border-indigo-200 text-indigo-950"
                                : "hover:bg-slate-50 border border-transparent"
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div
                                className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 ${
                                  sub.isOnlineNow
                                    ? "bg-emerald-600 ring-2 ring-emerald-300"
                                    : isSelected
                                    ? "bg-indigo-600"
                                    : "bg-slate-400"
                                }`}
                              >
                                {initials}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-bold text-xs text-slate-900 truncate">
                                    {sub.studentName}
                                  </span>
                                  {sub.isOnlineNow && (
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                  )}
                                </div>
                                <div className="text-[10px] text-slate-500 truncate">
                                  {sub.studentEmail ||
                                    (sub.timeSpentSeconds > 0
                                      ? formatDurationSeconds(sub.timeSpentSeconds)
                                      : "Not started")}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                  sub.isOnlineNow
                                    ? "bg-emerald-100 text-emerald-800"
                                    : sub.status === "graded"
                                    ? "bg-purple-100 text-purple-700"
                                    : sub.status === "submitted"
                                    ? "bg-blue-100 text-blue-700"
                                    : sub.isNotStarted
                                    ? "bg-slate-100 text-slate-500"
                                    : "bg-amber-100 text-amber-800"
                                }`}
                              >
                                {sub.isOnlineNow
                                  ? "Live"
                                  : sub.status || (sub.isNotStarted ? "Not Started" : "Draft")}
                              </span>
                              {isSelected && <Check className="h-4 w-4 text-indigo-600" />}
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Quick Prev / Next Controls & Position Indicator */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50/70 p-1">
                <button
                  type="button"
                  onClick={handlePrevStudent}
                  disabled={submissions.length <= 1}
                  className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition active:scale-95 disabled:opacity-40"
                  title="Previous student in list"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Prev</span>
                </button>
                <span className="px-2 text-xs font-bold text-slate-700 min-w-[70px] text-center">
                  {currentIndex >= 0 ? currentIndex + 1 : 1} / {submissions.length}
                </span>
                <button
                  type="button"
                  onClick={handleNextStudent}
                  disabled={submissions.length <= 1}
                  className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition active:scale-95 disabled:opacity-40"
                  title="Next student in list"
                >
                  <span className="hidden sm:inline">Next</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Main Review Workspace Area */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 pb-36">
          {/* Live Work Inspector + Grading */}
          {selectedSubmission ? (() => {
            const totalScore = rubricPoints.reduce((s, r) => s + (Number(r.points) || 0), 0);
            const standardScores = [100, 95, 90, 85, 80, 75, 70, 60, 50, 0];
            const isCustom = !standardScores.includes(totalScore);

            const handleTotalChange = (newTotal) => {
              const maxTotal =
                rubricPoints.reduce((sum, r) => sum + (Number(r.maxPoints) || 0), 0) || 100;
              const ratio = Math.max(0, Math.min(1, newTotal / maxTotal));
              let distributed = 0;
              setRubricPoints((prev) =>
                prev.map((r, i) => {
                  if (i === prev.length - 1) {
                    const remainder = Math.max(0, Math.min(r.maxPoints, newTotal - distributed));
                    return { ...r, points: remainder };
                  }
                  const val = Math.round((Number(r.maxPoints) || 0) * ratio);
                  distributed += val;
                  return { ...r, points: val };
                })
              );
            };

            const renderRubricHeaderCell = () => (
              <button
                type="button"
                onClick={() => setIsRubricAccordionOpen((v) => !v)}
                className="flex items-center justify-between w-full h-full text-left group transition cursor-pointer border-none bg-transparent p-0"
                title={isRubricAccordionOpen ? "Click to collapse rubric" : "Click to drop down rubric"}
              >
                <div className="flex flex-col justify-between h-[44px] min-w-0 pr-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 group-hover:text-indigo-600 transition leading-none whitespace-nowrap">
                    Rubric Evaluation
                  </span>
                  <span className="text-xs font-semibold text-slate-700 group-hover:text-indigo-950 transition whitespace-nowrap">
                    Tool-specific benchmarks
                  </span>
                </div>

                {/* Clean indicator with total score & chevron - No bulky select dropdown here */}
                <div className="shrink-0 flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 shadow-2xs group-hover:border-indigo-300 transition">
                  <Award className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                  <span className="text-xs font-bold text-slate-800">
                    {totalScore} pts
                  </span>
                  {isRubricAccordionOpen ? (
                    <ChevronUp className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5 text-slate-400 group-hover:text-indigo-600 shrink-0 transition" />
                  )}
                </div>
              </button>
            );

            const renderRubricPanel = () => (
              <div className="space-y-4">
                {/* Plagiarism flag if any */}
                {selectedSubmission.plagiarismFlags?.duplicateHashMatch && (
                  <div className="rounded-2xl border border-rose-300 bg-rose-50 p-4 text-xs text-rose-800 shadow-2xs">
                    <strong className="font-bold text-rose-900">Similarity Alert:</strong>{" "}
                    {selectedSubmission.plagiarismFlags.note}
                  </div>
                )}

                {/* Geometry Metrics if any */}
                {selectedSubmission.geometryMetrics && (
                  <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Server Geometry Metrics
                    </h4>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-xl bg-slate-50 p-2.5 border border-slate-100">
                        <div className="text-slate-400 text-[11px]">Volume</div>
                        <div className="font-bold text-slate-800 text-xs">
                          {selectedSubmission.geometryMetrics.volumeMm3} mm³
                        </div>
                      </div>
                      <div className="rounded-xl bg-slate-50 p-2.5 border border-slate-100">
                        <div className="text-slate-400 text-[11px]">Bounds (mm)</div>
                        <div className="font-bold text-slate-800 text-xs">
                          {selectedSubmission.geometryMetrics.boundingBoxMm?.x} ×{" "}
                          {selectedSubmission.geometryMetrics.boundingBoxMm?.y} ×{" "}
                          {selectedSubmission.geometryMetrics.boundingBoxMm?.z}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Auto-checks if any */}
                {selectedSubmission.autoCheckResults?.checks?.length > 0 && (
                  <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Auto-Checks</h4>
                    <div className="space-y-1">
                      {selectedSubmission.autoCheckResults.checks.map((c, idx) => (
                        <div
                          key={idx}
                          className={`rounded-lg px-2.5 py-1.5 text-xs font-medium flex items-center justify-between ${
                            c.passed
                              ? "bg-emerald-50 text-emerald-800 border border-emerald-100"
                              : "bg-rose-50 text-rose-800 border border-rose-100"
                          }`}
                        >
                          <span>{c.passed ? "✓" : "✕"} {c.name}</span>
                          <span className="font-mono text-[11px]">{c.actual}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Rubric Evaluation Detailed Breakdown */}
                <div className="rounded-2xl border border-slate-200/90 bg-white shadow-2xs overflow-hidden transition-all">
                  <div className="border-b border-slate-100 px-4 py-3 bg-slate-50/50 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Award className="h-4 w-4 text-emerald-600 shrink-0" />
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                          Rubric Evaluation
                        </h4>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Tool-specific grading benchmarks
                      </p>
                    </div>

                    {/* Overall Score Dropdown inside details panel */}
                    <div className="shrink-0 flex items-center gap-2">
                      <select
                        value={totalScore}
                        onChange={(e) => handleTotalChange(Number(e.target.value))}
                        className={`rounded-xl border px-3 py-1 text-xs font-extrabold shadow-2xs transition cursor-pointer ${
                          totalScore >= 90
                            ? "bg-emerald-50 text-emerald-800 border-emerald-300 hover:border-emerald-400"
                            : totalScore >= 70
                            ? "bg-indigo-50 text-indigo-900 border-indigo-300 hover:border-indigo-400"
                            : totalScore >= 50
                            ? "bg-amber-50 text-amber-800 border-amber-300 hover:border-amber-400"
                            : "bg-rose-50 text-rose-800 border-rose-300 hover:border-rose-400"
                        }`}
                        title="Quick select overall grade score"
                      >
                        {isCustom && (
                          <option value={totalScore}>
                            {totalScore} / 100 pts (Custom)
                          </option>
                        )}
                        <option value={100}>100 / 100 pts (A+)</option>
                        <option value={95}>95 / 100 pts (A)</option>
                        <option value={90}>90 / 100 pts (A)</option>
                        <option value={85}>85 / 100 pts (B+)</option>
                        <option value={80}>80 / 100 pts (B)</option>
                        <option value={75}>75 / 100 pts (B)</option>
                        <option value={70}>70 / 100 pts (C)</option>
                        <option value={60}>60 / 100 pts (D)</option>
                        <option value={50}>50 / 100 pts (Pass)</option>
                        <option value={0}>0 / 100 pts (0%)</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => setIsRubricAccordionOpen(false)}
                        className="text-[11px] font-semibold text-slate-400 hover:text-slate-700 transition"
                        title="Collapse rubric details"
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  <div className="p-4 space-y-3.5 bg-white">
                    {/* Criteria Items */}
                    <div className="space-y-2.5">
                      {rubricPoints.map((r, idx) => {
                        const currentScore = Number(r.points) || 0;
                        const max = Number(r.maxPoints) || 1;
                        const scoreOptions = Array.from({ length: max + 1 }, (_, i) => max - i);

                        return (
                          <div
                            key={r.criterion}
                            className="rounded-xl border border-slate-200/80 bg-white p-3 hover:border-slate-300 transition shadow-2xs"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <h5 className="text-xs font-bold text-slate-800 leading-snug">
                                  {r.criterion}
                                </h5>
                                {r.description && (
                                  <p className="text-[11px] text-slate-500 leading-normal mt-0.5">
                                    {r.description}
                                  </p>
                                )}
                              </div>

                              <div className="shrink-0">
                                <select
                                  value={currentScore}
                                  onChange={(e) => {
                                    const val = Number(e.target.value);
                                    setRubricPoints((prev) =>
                                      prev.map((item, i) => (i === idx ? { ...item, points: val } : item))
                                    );
                                  }}
                                  className="w-28 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-bold text-slate-800 shadow-2xs hover:border-indigo-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition cursor-pointer text-center"
                                >
                                  {scoreOptions.map((score) => (
                                    <option key={score} value={score}>
                                      {score} / {max} pts
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Instructor Feedback Box */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Instructor Feedback
                      </label>
                      <textarea
                        rows={3}
                        placeholder="Add personalized feedback, guidance, or next steps for the student..."
                        value={gradeFeedback}
                        onChange={(e) => setGradeFeedback(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 shadow-2xs"
                      />
                    </div>

                    {/* Publish Grade Action Button */}
                    <button
                      type="button"
                      disabled={grading || selectedSubmission.isNotStarted}
                      onClick={handleSubmitGrade}
                      className="w-full rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 py-3 text-xs font-bold text-white shadow-sm hover:from-emerald-700 hover:to-teal-700 transition active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {selectedSubmission.isNotStarted
                        ? "Waiting for Student Activity"
                        : grading
                        ? "Saving Grade..."
                        : `Save & Publish Grade (${rubricPoints.reduce(
                            (s, r) => s + (Number(r.points) || 0),
                            0
                          )} pts)`}
                    </button>
                  </div>
                </div>
              </div>
            );

            return (
              <div className="col-span-12 space-y-4">
                <StudentWorkInspector
                  assignment={reviewAssignment}
                  submission={selectedSubmission}
                  activeVersion={activeVersion}
                  inspectUrl={inspectUrl}
                  inspectName={inspectName}
                  inspectCode={inspectCode}
                  inspectOutput={inspectOutput}
                  rubricHeaderCell={renderRubricHeaderCell()}
                  isRubricOpen={isRubricAccordionOpen}
                  rubricPanel={renderRubricPanel()}
                />
              </div>
            );
          })() : (
            <div className="lg:col-span-8 xl:col-span-9 2xl:col-span-10 flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-14 text-center">
              <span className="text-3xl mb-2">👤</span>
              <p className="text-sm font-semibold text-slate-700">Select a student from the roster</p>
              <p className="text-xs text-slate-400 mt-1 max-w-sm">
                Click any student on the left to monitor live code, telemetry, version history, and grade their submission.
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Modern Partner & Instructor Work Space Hero */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-[#0f172a] via-[#1e1b4b] to-[#312e81] px-5 py-3 text-white shadow-md">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-0.5 text-[10px] font-semibold tracking-wide text-indigo-100 border border-white/15 mb-1">
            EduTechEx Work Space · Partner &amp; Instructor Studio
          </span>
          <h1 className="text-xl font-bold tracking-tight">Work Space</h1>
          <p className="mt-0.5 text-xs text-indigo-100/90 max-w-2xl">
            Add custom open-source tools, pick from {FREE_TOOL_CATALOG.length + customTools.length} tools across 11 sectors, share directly to students, and monitor progress live.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowAddCustomTool((prev) => !prev)}
            className="rounded-lg border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/20"
          >
            {showAddCustomTool ? "Close Custom Tool Form" : "+ Add Custom Tool"}
          </button>
          <button
            type="button"
            onClick={() => {
              setEditingAssignmentId(null);
              setForm(createInitialForm());
              setModalSectorId("");
              setModalSectorMenuOpen(false);
              setShowAllToolsInModal(false);
              setShowCreateModal(true);
            }}
            className="rounded-lg bg-indigo-500 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-400"
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

              const theme = {
                cardBorder: "border-slate-200/90 hover:border-indigo-300 hover:shadow-indigo-100/40",
                toolBadge: "bg-indigo-50 text-indigo-700 border-indigo-200/80",
              };

              return (
                <div
                  key={a._id}
                  className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl border bg-white shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg ${theme.cardBorder}`}
                >
                  {/* Top Single Plain Color Accent Line */}
                  <div className="h-1 w-full bg-indigo-600" />

                  <div className="p-3.5 sm:p-4">
                    {/* Clean Top Meta Row: Tool Pill + Difficulty Pill on Left, Status Pill on Right */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 rounded-lg border border-indigo-200/90 bg-indigo-50/80 px-2 py-0.5 text-[11px] font-bold text-indigo-700 shadow-2xs">
                          <Sparkles className="h-3 w-3 text-indigo-600" />
                          <span>{toolMeta.shortLabel}</span>
                        </span>
                        <span
                          className={`inline-flex items-center rounded-lg border px-2 py-0.5 text-[11px] font-semibold shadow-2xs ${
                            a.difficulty === "Advanced"
                              ? "border-rose-200 bg-rose-50 text-rose-700"
                              : a.difficulty === "Intermediate"
                              ? "border-amber-200 bg-amber-50 text-amber-700"
                              : "border-sky-200 bg-sky-50 text-sky-700"
                          }`}
                        >
                          {a.difficulty || "Beginner"}
                        </span>
                      </div>

                      <span className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-800 shadow-2xs shrink-0">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
                        <span>{a.status || "PUBLISHED"}</span>
                      </span>
                    </div>

                    {/* Clean Sub-meta Line: Category & Internship Context */}
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                      <span className="font-bold uppercase tracking-wider text-slate-500">
                        {a.category}
                      </span>
                      {a.internshipTitle && (
                        <>
                          <span className="text-slate-300">•</span>
                          <span className="inline-flex items-center gap-1 font-medium text-slate-700 truncate max-w-[220px]">
                            <Briefcase className="h-3 w-3 text-slate-400 shrink-0" />
                            <span className="truncate">
                              Internship: <strong className="font-semibold text-slate-900">{a.internshipTitle}</strong>
                            </span>
                          </span>
                        </>
                      )}
                    </div>

                    {/* Title */}
                    <h3 className="mt-1 text-sm sm:text-base font-bold text-slate-900 group-hover:text-indigo-950 transition-colors line-clamp-1">
                      {a.title}
                    </h3>

                    {/* Description */}
                    <p className="mt-1 text-xs text-slate-600 line-clamp-2 leading-relaxed">
                      {a.description}
                    </p>

                    {/* Mini-Metric Plain Dashboard (No colors, clean neutral style) */}
                    <div className="mt-2.5 grid grid-cols-3 gap-1.5">
                      <div className="rounded-lg border border-slate-200 bg-slate-50/80 px-2 py-1.5 text-center transition hover:bg-slate-100/80">
                        <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-500">Active/Draft</span>
                        <span className="text-xs font-extrabold text-slate-900">{a.submissionStats?.working || 0}</span>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-slate-50/80 px-2 py-1.5 text-center transition hover:bg-slate-100/80">
                        <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-500">Submitted</span>
                        <span className="text-xs font-extrabold text-slate-900">{a.submissionStats?.submitted || 0}</span>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-slate-50/80 px-2 py-1.5 text-center transition hover:bg-slate-100/80">
                        <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-500">Due Date</span>
                        <span className="text-[11px] font-bold text-slate-900 truncate block">
                          {a.dueDate ? new Date(a.dueDate).toLocaleDateString() : "No deadline"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Footer Action Buttons with Edit */}
                  <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/60 px-3.5 py-2">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleEditAssignment(a)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-2xs hover:border-indigo-300 hover:bg-indigo-50/60 hover:text-indigo-700 transition active:scale-95"
                        title="Edit task guidelines, dates, or rubrics"
                      >
                        <Pencil className="h-3 w-3 text-indigo-600" />
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteAssignment(a)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-rose-600 shadow-2xs hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 transition active:scale-95"
                        title="Delete this task"
                      >
                        <Trash2 className="h-3 w-3" />
                        <span className="hidden sm:inline">Delete</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => openSubmissionsReview(a)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-slate-900 to-indigo-950 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:from-slate-800 hover:to-indigo-900 hover:shadow transition active:scale-95"
                    >
                      <Eye className="h-3 w-3 text-indigo-300" />
                      <span>Monitor Live &amp; Grade</span>
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
                  {editingAssignmentId ? "Edit Daily Work Task & Tool" : "Share Tool / Task to Students"}
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
                onClick={() => {
                  setShowCreateModal(false);
                  setEditingAssignmentId(null);
                }}
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

            {/* Step 2: Weekly Task Details */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Weekly Task Title *
                </label>
                <input
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder={
                    isSelectedCodeTool
                      ? "e.g., Week 1: Implement Binary Search in C++"
                      : "e.g., Week 1: Design Bearing Flange in 3D CAD"
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
                <label className="block text-xs font-semibold text-slate-700 mb-1">Task Summary *</label>
                <textarea
                  required
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Brief summary of this weekly task..."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Assignment Guidelines &amp; Requirements
                </label>
                <textarea
                  rows={3}
                  value={form.instructions}
                  onChange={(e) => setForm({ ...form, instructions: e.target.value })}
                  placeholder="Step-by-step instructions, expected deliverables, and evaluation criteria..."
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
                    Attach Starter File or Reference Document (Optional)
                  </label>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.zip,.json,.csv,.txt,.step,.stp,.stl,.iges,.igs,.fcstd,.scad"
                    onChange={(e) => setStarterFile(e.target.files?.[0] || null)}
                    className="w-full text-xs text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-slate-700 hover:file:bg-slate-200 cursor-pointer"
                  />
                  <p className="mt-1 text-[11px] text-slate-400">
                    Upload an optional starter file, dataset, problem PDF, or project reference.
                  </p>
                </div>
              )}
            </div>

            {isSelectedCadTool && (
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
                onClick={() => {
                  setShowCreateModal(false);
                  setEditingAssignmentId(null);
                }}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingAssignment || !modalSectorId}
                className="rounded-lg bg-indigo-600 px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
              >
                {savingAssignment
                  ? editingAssignmentId
                    ? "Updating..."
                    : "Sending..."
                  : editingAssignmentId
                  ? "Update Task"
                  : "Send Tool & Task to Users"}
              </button>
            </div>
          </form>
        </div>
        );
      })()}

      {/* Centered Modal Popup for Task Deletion */}
      {deleteConfirmTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div
            className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-100 transform transition-all"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-start gap-3.5 mb-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600">
                <Trash2 className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold text-slate-900">Delete Daily Work Task</h3>
                <p className="text-xs text-slate-500 mt-0.5">This action cannot be undone</p>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-slate-600 mt-2 leading-relaxed">
              Are you sure you want to delete{" "}
              <span className="font-semibold text-slate-900">
                "{deleteConfirmTarget.title || "this task"}"
              </span>
              ? All student drafts, live activity logs, and submissions for this task will be permanently removed.
            </p>

            <div className="mt-6 flex items-center justify-end gap-2.5">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeleteConfirmTarget(null)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={confirmDeleteAssignment}
                className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50 transition shadow-sm"
              >
                {isDeleting ? "Deleting..." : "Delete Task"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PartnerWorkspaceManager;
