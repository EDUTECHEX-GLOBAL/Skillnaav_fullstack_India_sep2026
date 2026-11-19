import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import {
  Sparkles,
  Search,
  X,
  ChevronRight,
  Check,
  Layers,
} from "lucide-react";
import axios from "../../api/axiosInstance";
import ThreeDModelWorkspace from "./ThreeDModelWorkspace";
import CodeCompilerWorkspace from "./CodeCompilerWorkspace";
import SqlLabWorkspace from "./SqlLabWorkspace";
import DiagramAndWhiteboardWorkspace from "./DiagramAndWhiteboardWorkspace";
import DataAndDocWorkspace from "./DataAndDocWorkspace";
import Scripted3DWorkspace from "./Scripted3DWorkspace";
import RegexAndJsonWorkspace from "./RegexAndJsonWorkspace";
import ThreeDViewport from "./ThreeDViewport";
import {
  WORK_SPACE_SECTORS,
  getToolsForSector,
  getToolMeta,
} from "./toolCatalog";

const getStudentToken = () =>
  localStorage.getItem("userToken") || sessionStorage.getItem("userToken") || "";

const resolveFileUrl = (url = "") => {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  const base = (process.env.REACT_APP_API_BASE || "").replace(/\/+$/, "");
  return `${base}${url.startsWith("/") ? url : `/${url}`}`;
};

const StudentWorkSpace = () => {
  const [assignments, setAssignments] = useState([]);
  const [cadConfig, setCadConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeAssignment, setActiveAssignment] = useState(null);
  const [activeSubmission, setActiveSubmission] = useState(null);
  const [previewFile, setPreviewFile] = useState(null);
  const [apiError, setApiError] = useState("");
  const [selectedSectorId, setSelectedSectorId] = useState("");
  const [isSectorModalOpen, setIsSectorModalOpen] = useState(false);
  const [sectorSearchQuery, setSectorSearchQuery] = useState("");

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setIsSectorModalOpen(false);
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const fetchAssignments = useCallback(async () => {
    try {
      setLoading(true);
      setApiError("");
      const token = getStudentToken();
      const [assignRes, cfgRes] = await Promise.all([
        axios.get("/api/daily-work/assignments", {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get("/api/daily-work/config", {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      setAssignments(assignRes.data?.assignments || []);
      setCadConfig(cfgRes.data || null);
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        "Could not load partner tasks. If the backend server was already running, restart it to activate /api/daily-work routes.";
      setApiError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  const handleOpenWorkspace = async (assignment) => {
    try {
      const token = getStudentToken();
      const res = await axios.get(`/api/daily-work/assignments/${assignment._id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setActiveAssignment(res.data.assignment);
      setActiveSubmission(res.data.mySubmission || null);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Could not open tool workspace");
    }
  };

  const selectedSector =
    WORK_SPACE_SECTORS.find((sector) => sector.id === selectedSectorId) || null;
  const sectorTools = selectedSectorId ? getToolsForSector(selectedSectorId) : [];

  const filteredSectors = useMemo(() => {
    if (!sectorSearchQuery.trim()) return WORK_SPACE_SECTORS;
    const q = sectorSearchQuery.toLowerCase();
    return WORK_SPACE_SECTORS.filter((s) => {
      const matchName = s.name.toLowerCase().includes(q);
      const matchTag = s.tagline.toLowerCase().includes(q);
      const matchTools = getToolsForSector(s.id).some(
        (t) => t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)
      );
      return matchName || matchTag || matchTools;
    });
  }, [sectorSearchQuery]);

  const openToolForTesting = (tool) => {
    setActiveSubmission(null);
    setActiveAssignment({
      _id: null,
      title: `${tool.name} (${selectedSector ? selectedSector.name : "Practice & Testing"})`,
      category: selectedSector ? selectedSector.name : tool.category,
      difficulty: "Sector Playground",
      toolType: tool.id,
      workspaceMode: tool.id,
      codeLanguage: tool.language || "cpp",
      starterCode: tool.defaultCode || "",
      instructions: `${tool.description} Open-Source License: ${tool.license}. Run and test freely inside Work Space.`,
    });
  };

  if (activeAssignment) {
    const toolMeta = getToolMeta(activeAssignment.toolType || activeAssignment.workspaceMode);
    const mode = toolMeta.mode || "cad";
    const handleWorkspaceBack = () => {
      setActiveAssignment(null);
      setActiveSubmission(null);
      fetchAssignments();
    };

    return (
      <div className="p-2 sm:p-4">
        {mode === "code" || mode === "web" ? (
          <CodeCompilerWorkspace
            assignment={activeAssignment}
            initialSubmission={activeSubmission}
            onBack={handleWorkspaceBack}
            onUpdated={(updatedSub) => setActiveSubmission(updatedSub)}
          />
        ) : mode === "sql" ? (
          <SqlLabWorkspace
            assignment={activeAssignment}
            initialSubmission={activeSubmission}
            onBack={handleWorkspaceBack}
            onUpdated={(updatedSub) => setActiveSubmission(updatedSub)}
          />
        ) : mode === "jscad" ? (
          <Scripted3DWorkspace
            assignment={activeAssignment}
            initialSubmission={activeSubmission}
            onBack={handleWorkspaceBack}
            onUpdated={(updatedSub) => setActiveSubmission(updatedSub)}
          />
        ) : mode === "diagram" || mode === "drawio" || mode === "whiteboard" ? (
          <DiagramAndWhiteboardWorkspace
            assignment={activeAssignment}
            initialSubmission={activeSubmission}
            mode={mode}
            onBack={handleWorkspaceBack}
            onUpdated={(updatedSub) => setActiveSubmission(updatedSub)}
          />
        ) : mode === "data" || mode === "markdown" ? (
          <DataAndDocWorkspace
            assignment={activeAssignment}
            initialSubmission={activeSubmission}
            mode={mode}
            onBack={handleWorkspaceBack}
            onUpdated={(updatedSub) => setActiveSubmission(updatedSub)}
          />
        ) : mode === "regex" ? (
          <RegexAndJsonWorkspace
            assignment={activeAssignment}
            initialSubmission={activeSubmission}
            onBack={handleWorkspaceBack}
            onUpdated={(updatedSub) => setActiveSubmission(updatedSub)}
          />
        ) : (
          <ThreeDModelWorkspace
            assignment={activeAssignment}
            initialSubmission={activeSubmission}
            cadConfig={cadConfig}
            onBack={handleWorkspaceBack}
            onUpdated={(updatedSub) => setActiveSubmission(updatedSub)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* Sleek Hero Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-gradient-to-r from-[#1e1b4b] via-[#312e81] to-[#4c1d95] px-6 py-5 text-white shadow-md">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold tracking-wide text-purple-100 border border-white/15 mb-2">
            EduTechEx Work Space · Interactive Labs &amp; Compilers
          </span>
          <h1 className="text-2xl font-bold tracking-tight">Work Space</h1>
          <p className="mt-1 text-xs sm:text-sm text-indigo-100/90 max-w-2xl">
            Complete Partner-assigned tasks or select a sector below to launch open-source compilers and interactive simulators.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-xl bg-white/10 border border-white/15 px-3 py-1.5 font-semibold text-white">
            Partner Tasks: {assignments.length}
          </span>
        </div>
      </div>

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

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {[1, 2].map((n) => (
            <div key={n} className="h-36 animate-pulse rounded-xl bg-slate-200" />
          ))}
        </div>
      ) : assignments.length === 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/90 px-4 py-3.5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-purple-100 text-purple-700 font-bold text-sm">
              PW
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-800">
                Partner-Assigned Work
              </h3>
              <p className="text-xs text-slate-500">
                No tasks assigned yet. Tools sent by your Partner will appear here automatically.
              </p>
            </div>
          </div>
          <span className="rounded-full bg-white border border-slate-200 px-3 py-1 text-[11px] font-medium text-slate-500">
            Waiting for Partner
          </span>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {assignments.map((a) => {
            const sub = a.mySubmission;
            const status = sub?.status || "not-started";
            const toolMeta = getToolMeta(a.toolType || a.workspaceMode);
            const badgeColor =
              status === "graded"
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                : status === "submitted"
                  ? "bg-blue-50 text-blue-700 border border-blue-200"
                  : status === "in-progress"
                    ? "bg-amber-50 text-amber-800 border border-amber-200"
                    : "bg-slate-50 text-slate-700 border border-slate-200";

            const cardBgStyle =
              "bg-gradient-to-br from-indigo-50/40 via-white to-slate-50/60 border-slate-200/90 hover:border-indigo-300";

            return (
              <div
                key={a._id}
                className={`flex flex-col justify-between rounded-2xl border p-3.5 sm:p-4 shadow-xs transition hover:shadow-md ${cardBgStyle}`}
              >
                <div className="space-y-2">
                  {/* Card Top Header: Title & Status */}
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                        {a.title}
                      </h3>
                      {a.internshipTitle && (
                        <p className="mt-0.5 text-[11px] font-semibold text-emerald-700 truncate">
                          {a.internshipTitle}
                        </p>
                      )}
                    </div>
                    <span className={`shrink-0 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${badgeColor}`}>
                      {status.replace("-", " ")}
                    </span>
                  </div>

                  {/* Tool & Category Badges */}
                  <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                    <span className="rounded-md bg-indigo-50 border border-indigo-200/70 px-2 py-0.5 font-semibold text-indigo-700">
                      {toolMeta.shortLabel}
                    </span>
                    <span className="rounded-md bg-slate-100 border border-slate-200 px-2 py-0.5 font-medium text-slate-600">
                      {a.category}
                    </span>
                    {(a.targetSpecs?.enabled || a.expectedOutput) && (
                      <span className="rounded-md bg-emerald-50 border border-emerald-200 px-2 py-0.5 font-semibold text-emerald-700">
                        Auto-Check
                      </span>
                    )}
                  </div>

                  {/* Description */}
                  {a.description && (
                    <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                      {a.description}
                    </p>
                  )}

                  {/* Structured 3-Column Metadata Grid */}
                  <div className="grid grid-cols-3 gap-1.5 rounded-lg bg-white/85 border border-slate-200/80 p-1.5 text-center text-xs shadow-xs">
                    <div className="min-w-0">
                      <span className="block text-[9px] uppercase font-semibold text-slate-400">Instructor</span>
                      <span className="font-bold text-slate-800 truncate block mt-0.5 text-xs">{a.createdBy?.name || "Partner"}</span>
                    </div>
                    <div className="border-x border-slate-200/70 min-w-0">
                      <span className="block text-[9px] uppercase font-semibold text-slate-400">Difficulty</span>
                      <span className="font-bold text-indigo-600 block mt-0.5 text-xs">{a.difficulty || "Beginner"}</span>
                    </div>
                    <div className="min-w-0">
                      <span className="block text-[9px] uppercase font-semibold text-slate-400">Due Date</span>
                      <span className="font-medium text-slate-700 truncate block mt-0.5 text-xs">
                        {a.dueDate ? new Date(a.dueDate).toLocaleDateString() : "No deadline"}
                      </span>
                    </div>
                  </div>

                  {a.starterFiles?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {a.starterFiles.map((sf) => {
                        const is3d = ["stl", "step", "stp", "iges", "igs"].includes(sf.fileFormat);
                        return is3d ? (
                          <button
                            key={sf._id || sf.fileName}
                            type="button"
                            onClick={() =>
                              setPreviewFile({
                                fileName: sf.fileName,
                                fileUrl: resolveFileUrl(sf.fileUrl),
                              })
                            }
                            className="rounded-lg border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-700 hover:bg-slate-50 shadow-xs"
                          >
                            👁 Preview {sf.fileName}
                          </button>
                        ) : null;
                      })}
                    </div>
                  )}

                  {sub?.grade?.score !== null && sub?.grade?.score !== undefined && (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50/90 p-2 text-xs text-emerald-900">
                      <div className="font-bold">
                        Grade: {sub.grade.score} / {sub.grade.maxScore || a.maxScore}
                      </div>
                      {sub.grade.feedback && <p className="mt-0.5 text-[11px]">{sub.grade.feedback}</p>}
                    </div>
                  )}
                </div>

                <div className="mt-2.5 flex items-center justify-end border-t border-slate-100 pt-2">
                  <button
                    type="button"
                    onClick={() => handleOpenWorkspace(a)}
                    className="shrink-0 whitespace-nowrap rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 active:scale-95 transition"
                  >
                    Open Task &rarr;
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 11 Sectors Section — Tools Show After Selecting a Sector via the Modal */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex flex-col gap-3.5 border-b border-slate-100 bg-slate-50/80 px-5 py-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-500/20">
              <Layers className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 truncate">
                Sector Tools &amp; Online Compilers
              </h2>
              <p className="text-xs text-slate-500 mt-0.5 truncate sm:overflow-visible sm:whitespace-normal">
                Explore in-browser labs, cloud compilers, and 3D simulators curated for each sector.
              </p>
            </div>
          </div>

          {/* Trigger Button or Active Sector Toolbar */}
          <div className="flex items-center gap-2 shrink-0">
            {!selectedSector ? (
              <button
                type="button"
                onClick={() => {
                  setSectorSearchQuery("");
                  setIsSectorModalOpen(true);
                }}
                className="group inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-600 px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow-sm shadow-indigo-500/25 transition-all hover:from-indigo-700 hover:to-purple-700 hover:shadow-md active:scale-95"
              >
                <Sparkles className="h-4 w-4 text-purple-200 transition-transform group-hover:rotate-12" />
                <span>Select a Sector</span>
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSectorSearchQuery("");
                    setIsSectorModalOpen(true);
                  }}
                  title="Click to change sector"
                  className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50/90 px-3.5 py-1.5 text-xs font-semibold text-indigo-900 shadow-xs hover:bg-indigo-100/80 transition cursor-pointer"
                >
                  <span className="font-bold">{selectedSector.name}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedSectorId("")}
                  className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 transition active:scale-95 shadow-xs"
                  title="Clear sector"
                  aria-label="Clear selected sector"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        {!selectedSector ? (
          <div className="py-3 px-4 text-center bg-slate-50/50">
            <p className="text-xs font-medium text-slate-500">
              Click <span className="font-semibold text-indigo-600">&quot;Select a Sector&quot;</span> above to unlock its curated toolset and compilers.
            </p>
          </div>
        ) : (
          <div className="p-5 sm:p-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {sectorTools.map((tool) => {
                  const runtimeBadge =
                    tool.mode === "code"
                      ? "Cloud GCC / Runtime"
                      : tool.mode === "iframe"
                        ? "Interactive Lab"
                        : "In-Browser";

                  const badgeStyle = "bg-indigo-50 border-indigo-200 text-indigo-700";
                  const cardBg = "bg-gradient-to-br from-indigo-50/40 via-white to-slate-50/60 border-slate-200/90 hover:border-indigo-300";

                  return (
                    <div
                      key={tool.id}
                      className={`group flex flex-col justify-between rounded-2xl border p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${cardBg}`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-semibold uppercase tracking-wide text-indigo-700 truncate min-w-0">
                            {tool.category}
                          </span>
                          <span className={`shrink-0 whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-semibold ${badgeStyle}`}>
                            {runtimeBadge}
                          </span>
                        </div>
                        <h4 className="mt-2 text-sm font-bold text-slate-900 group-hover:text-indigo-700 transition-colors">
                          {tool.name}
                        </h4>
                        <p className="mt-1 text-xs text-slate-600 line-clamp-2">
                          {tool.description}
                        </p>
                      </div>
                      <div className="mt-4 flex items-center justify-end border-t border-slate-100 pt-3">
                        <button
                          type="button"
                          onClick={() => openToolForTesting(tool)}
                          className="shrink-0 whitespace-nowrap rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700 active:scale-95"
                        >
                          Open &amp; Test &rarr;
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
          </div>
        )}
      </div>

      {/* 11 Sectors Modal Popup */}
      {isSectorModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 sm:p-6 backdrop-blur-sm transition-opacity"
          onClick={() => setIsSectorModalOpen(false)}
        >
          <div
            className="relative w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-3xl bg-white shadow-2xl border border-slate-100 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Top Header */}
            <div className="relative overflow-hidden bg-gradient-to-r from-[#0f172a] via-[#1e1b4b] to-[#312e81] p-5 sm:p-6 text-white border-b border-slate-800">
              <div className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full bg-indigo-500/20 blur-3xl" />
              <div className="relative z-10 flex items-start justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 border border-white/15 px-3 py-0.5 text-[11px] font-semibold text-purple-200 mb-2">
                    <Sparkles className="h-3 w-3 text-purple-300" />
                    EduTechEx Industry Labs · Engineering Sectors
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                    Select an Industry Sector
                  </h2>
                  <p className="mt-1 text-xs sm:text-sm text-indigo-200/90 max-w-xl">
                    Choose a sector to reveal its specialized open-source compilers and interactive simulators.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsSectorModalOpen(false)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white hover:bg-white/20 transition active:scale-95"
                  aria-label="Close sector modal"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Live Search inside Modal */}
              <div className="relative mt-4">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={sectorSearchQuery}
                  onChange={(e) => setSectorSearchQuery(e.target.value)}
                  placeholder="Search sectors or tools (e.g., AI, Robotics, Quantum, Python)..."
                  className="w-full rounded-xl border border-white/15 bg-white/10 py-2.5 pl-10 pr-16 text-xs sm:text-sm text-white placeholder-slate-400 backdrop-blur-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
                />
                {sectorSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setSectorSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Modal Body: 11 Sector Cards Grid */}
            <div className="p-5 sm:p-6 overflow-y-auto max-h-[60vh]">
              {filteredSectors.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-sm font-semibold text-slate-700">No sectors match "{sectorSearchQuery}"</p>
                  <button
                    type="button"
                    onClick={() => setSectorSearchQuery("")}
                    className="mt-2 text-xs font-semibold text-indigo-600 hover:underline"
                  >
                    Reset Search
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {filteredSectors.map((sector) => {
                    const isSelected = selectedSectorId === sector.id;
                    const tools = getToolsForSector(sector.id);

                    return (
                      <button
                        key={sector.id}
                        type="button"
                        onClick={() => {
                          setSelectedSectorId(sector.id);
                          setIsSectorModalOpen(false);
                        }}
                        className={`group relative flex flex-col justify-between rounded-2xl border p-4 sm:p-5 text-left transition-all duration-200 cursor-pointer ${
                          isSelected
                            ? "border-indigo-600 bg-gradient-to-br from-indigo-50/90 via-white to-purple-50/40 ring-2 ring-indigo-500/25 shadow-md"
                            : "border-slate-200 bg-white hover:border-indigo-300 hover:shadow-md hover:-translate-y-0.5"
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-2.5">
                            <span className="shrink-0 whitespace-nowrap rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-700 border border-slate-200">
                              {tools.length} Tools
                            </span>
                            {isSelected ? (
                              <span className="shrink-0 whitespace-nowrap inline-flex items-center gap-1 rounded-full bg-indigo-600 px-2.5 py-0.5 text-[10px] font-bold text-white shadow-xs">
                                <Check className="h-3 w-3 stroke-[3]" />
                                Active
                              </span>
                            ) : (
                              <span className="text-[11px] font-semibold text-slate-400 group-hover:text-indigo-600 transition-colors">
                                Select &rarr;
                              </span>
                            )}
                          </div>

                          <h4 className={`text-base font-bold transition-colors ${
                            isSelected ? "text-indigo-950 font-extrabold" : "text-slate-900 group-hover:text-indigo-700"
                          }`}>
                            {sector.name}
                          </h4>
                          <p className="mt-1.5 text-xs text-slate-500 line-clamp-2 leading-relaxed">
                            {sector.tagline}
                          </p>
                        </div>

                        <div className={`mt-4 flex items-center justify-between border-t pt-3 text-xs font-semibold ${
                          isSelected
                            ? "border-indigo-200/80 text-indigo-700"
                            : "border-slate-100 text-indigo-600 group-hover:text-indigo-800"
                        }`}>
                          <span>{isSelected ? "Currently Viewing" : "Explore Tools"}</span>
                          <ChevronRight className={`h-4 w-4 transition-transform group-hover:translate-x-1 ${
                            isSelected ? "text-indigo-600" : "text-slate-400 group-hover:text-indigo-600"
                          }`} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/80 px-6 py-3.5 text-xs text-slate-500">
              <span>All sectors include 100% free open-source compilers and simulators.</span>
              <button
                type="button"
                onClick={() => setIsSectorModalOpen(false)}
                className="rounded-xl border border-slate-300 bg-white px-4 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition active:scale-95"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Starter 3D File Preview Modal */}
      {previewFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="w-full max-w-3xl rounded-2xl bg-white p-4 shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">
                3D Reference Preview: {previewFile.fileName}
              </h3>
              <button
                type="button"
                onClick={() => setPreviewFile(null)}
                className="rounded-lg bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200"
              >
                Close
              </button>
            </div>
            <ThreeDViewport
              fileUrl={previewFile.fileUrl}
              fileName={previewFile.fileName}
              className="h-[420px]"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentWorkSpace;
