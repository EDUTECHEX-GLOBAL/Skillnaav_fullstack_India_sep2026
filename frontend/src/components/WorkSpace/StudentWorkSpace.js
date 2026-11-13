import React, { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
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
  const [sectorMenuOpen, setSectorMenuOpen] = useState(false);
  const sectorDropdownRef = useRef(null);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (
        sectorDropdownRef.current &&
        !sectorDropdownRef.current.contains(event.target)
      ) {
        setSectorMenuOpen(false);
      }
    };
    const handleEscape = (event) => {
      if (event.key === "Escape") setSectorMenuOpen(false);
    };
    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
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
            Complete Partner-assigned tasks or select a sector below to launch open-source compilers, 3D CAD, and interactive simulators.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-xl bg-white/10 border border-white/15 px-3 py-1.5 font-semibold text-white">
            Partner Tasks: {assignments.length}
          </span>
          <span className="rounded-xl bg-purple-400/20 border border-purple-300/25 px-3 py-1.5 font-semibold text-purple-100">
            11 Sectors
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
                ? "bg-emerald-100 text-emerald-800"
                : status === "submitted"
                  ? "bg-blue-100 text-blue-800"
                  : status === "in-progress"
                    ? "bg-amber-100 text-amber-800"
                    : "bg-slate-100 text-slate-700";

            return (
              <div
                key={a._id}
                className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-1.5 mb-1">
                        <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 border border-indigo-200">
                          Tool: {toolMeta.shortLabel}
                        </span>
                        {a.internshipTitle && (
                          <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200">
                            Internship: {a.internshipTitle}
                          </span>
                        )}
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          {a.category} · {a.difficulty}
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-slate-900">{a.title}</h3>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase ${badgeColor}`}>
                      {status.replace("-", " ")}
                    </span>
                  </div>

                  <p className="text-sm text-slate-600 line-clamp-3">{a.description}</p>

                  <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                    <span>Sent by: {a.createdBy?.name || "Partner"}</span>
                    <span>· Max Score: {a.maxScore}</span>
                    {a.dueDate && (
                      <span>· Due: {new Date(a.dueDate).toLocaleDateString()}</span>
                    )}
                    {(a.targetSpecs?.enabled || a.expectedOutput) && (
                      <span className="text-emerald-700 font-medium">· Auto-Check</span>
                    )}
                  </div>

                  {a.starterFiles?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
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
                            className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
                          >
                            👁 Preview {sf.fileName}
                          </button>
                        ) : null;
                      })}
                    </div>
                  )}

                  {sub?.grade?.score !== null && sub?.grade?.score !== undefined && (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
                      <div className="font-bold">
                        Grade: {sub.grade.score} / {sub.grade.maxScore || a.maxScore}
                      </div>
                      {sub.grade.feedback && <p className="mt-1">{sub.grade.feedback}</p>}
                    </div>
                  )}
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                  <span className="text-[11px] text-slate-400">
                    License: {toolMeta.license}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleOpenWorkspace(a)}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                  >
                    {status === "not-started" ? `Launch ${toolMeta.shortLabel}` : "Resume Work"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 11 Sectors Dropdown — Tools Show Only After Selecting a Particular Sector */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 rounded-t-2xl border-b border-slate-100 bg-slate-50/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-xs font-bold text-white shadow-sm">
              11
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                Sector Tools &amp; Online Compilers
              </h2>
              <p className="text-xs text-slate-500">
                Select a sector from the dropdown to reveal its open-source compilers, labs, and simulators.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div ref={sectorDropdownRef} className="relative w-full sm:w-80">
              <button
                type="button"
                aria-haspopup="listbox"
                aria-expanded={sectorMenuOpen}
                onClick={() => setSectorMenuOpen((prev) => !prev)}
                className="flex w-full items-center justify-between gap-2 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-left text-sm font-medium text-slate-800 shadow-sm transition hover:border-indigo-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              >
                <span className="truncate">
                  {selectedSector
                    ? `${selectedSector.name} (${sectorTools.length} Tools)`
                    : "-- Select a Sector (11 Sectors) --"}
                </span>
                <svg
                  className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${
                    sectorMenuOpen ? "rotate-180" : ""
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

              {sectorMenuOpen && (
                <div
                  role="listbox"
                  aria-label="Select Sector"
                  className="absolute left-0 right-0 top-full z-30 mt-1.5 max-h-64 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-xl"
                >
                  <button
                    type="button"
                    role="option"
                    aria-selected={!selectedSectorId}
                    onClick={() => {
                      setSelectedSectorId("");
                      setSectorMenuOpen(false);
                    }}
                    className={`flex w-full items-center justify-between px-3.5 py-2 text-left text-xs transition ${
                      !selectedSectorId
                        ? "bg-indigo-50 font-semibold text-indigo-700"
                        : "text-slate-500 hover:bg-slate-50"
                    }`}
                  >
                    <span className="truncate">-- Select a Sector (11 Sectors) --</span>
                  </button>
                  {WORK_SPACE_SECTORS.map((sector, idx) => {
                    const isSelected = selectedSectorId === sector.id;
                    const count = getToolsForSector(sector.id).length;
                    return (
                      <button
                        key={sector.id}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => {
                          setSelectedSectorId(sector.id);
                          setSectorMenuOpen(false);
                        }}
                        className={`flex w-full items-center justify-between gap-2 px-3.5 py-2 text-left text-xs transition ${
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
                          {count} Tools
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {selectedSector && (
              <button
                type="button"
                onClick={() => {
                  setSelectedSectorId("");
                  setSectorMenuOpen(false);
                }}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        <div className="p-5">
          {!selectedSector ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3.5">
                  <div className="text-xs font-bold text-indigo-900">
                    In-Browser Labs
                  </div>
                  <p className="mt-1 text-[11px] text-slate-600">
                    HTML5/CSS3/JS Split Studio, SQLite WASM, Regex/JSON &amp; Data Analytics run 100% locally.
                  </p>
                </div>
                <div className="rounded-xl border border-purple-100 bg-purple-50/50 p-3.5">
                  <div className="text-xs font-bold text-purple-900">
                    Online Cloud Compilers
                  </div>
                  <p className="mt-1 text-[11px] text-slate-600">
                    C/C++, Python 3, Java, TypeScript, PHP, Go/Rust, Ruby, C# &amp; Bash with live stdin/stdout.
                  </p>
                </div>
                <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3.5">
                  <div className="text-xs font-bold text-emerald-900">
                    Sector Simulators &amp; CAD
                  </div>
                  <p className="mt-1 text-[11px] text-slate-600">
                    Quirk Quantum, 3Dmol Biotech, PhET Physics, Wokwi IoT, CircuitJS1 &amp; 3D CAD Studios.
                  </p>
                </div>
              </div>
              <p className="text-center text-xs font-medium text-slate-500">
                Choose a sector from the dropdown above to unlock its curated toolset.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {selectedSector.name} ({sectorTools.length} Tools)
                  </h3>
                  <p className="text-xs text-slate-500">{selectedSector.tagline}</p>
                </div>
                <span className="rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-700">
                  100% Free &amp; Open Source
                </span>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {sectorTools.map((tool) => {
                  const runtimeBadge =
                    tool.mode === "code"
                      ? "Cloud GCC / Runtime"
                      : tool.mode === "iframe"
                        ? "Interactive Lab"
                        : "In-Browser";
                  const badgeStyle =
                    tool.mode === "code"
                      ? "bg-purple-50 border-purple-200 text-purple-700"
                      : tool.mode === "iframe"
                        ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                        : "bg-indigo-50 border-indigo-200 text-indigo-700";
                  return (
                    <div
                      key={tool.id}
                      className="group flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-semibold uppercase tracking-wide text-indigo-700">
                            {tool.category}
                          </span>
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${badgeStyle}`}>
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
                      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                        <span className="text-[11px] text-slate-400 truncate max-w-[155px]">
                          {tool.license}
                        </span>
                        <button
                          type="button"
                          onClick={() => openToolForTesting(tool)}
                          className="rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700"
                        >
                          Open &amp; Test →
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

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
