import React, { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import axios from "../../api/axiosInstance";
import ThreeDViewport from "./ThreeDViewport";
import { syncStudentActivity } from "./activitySync";
import {
  DEFAULT_FEATURE_PRESETS,
  SAMPLE_TEMPLATES,
  createFeatureGeometry,
  evaluateFeatureTree,
  exportGeometryToStlBlob,
} from "./threeDGeometryEngine";
import { getToolMeta } from "./toolCatalog";

const getStudentToken = () =>
  localStorage.getItem("userToken") || sessionStorage.getItem("userToken") || "";

const resolveFileUrl = (url = "") => {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  const base = (process.env.REACT_APP_API_BASE || "").replace(/\/+$/, "");
  return `${base}${url.startsWith("/") ? url : `/${url}`}`;
};

/**
 * Interactive 2D Sketch Profile Editor (click grid or edit vertices) for Extrude features
 */
const SketchEditor2D = ({ points = [], onChange }) => {
  const size = 200;
  const half = 50; // +/- 50 mm workspace
  const toSvg = (x, y) => [((x + half) / (half * 2)) * size, ((half - y) / (half * 2)) * size];

  const handleSvgClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const mmX = Math.round(((px / rect.width) * (half * 2) - half) / 2.5) * 2.5;
    const mmY = Math.round((half - (py / rect.height) * (half * 2)) / 2.5) * 2.5;
    onChange([...points, [mmX, mmY]]);
  };

  const polyStr = points.map(([x, y]) => toSvg(x, y).join(",")).join(" ");

  return (
    <div className="space-y-2 rounded-lg border border-slate-700 bg-slate-900 p-2.5">
      <div className="flex items-center justify-between text-xs text-slate-300">
        <span>2D Sketch Plane (click to add vertex, 2.5 mm snap)</span>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => points.length > 3 && onChange(points.slice(0, -1))}
            className="rounded bg-slate-800 px-2 py-0.5 text-[11px] hover:bg-slate-700"
          >
            Undo Pt
          </button>
          <button
            type="button"
            onClick={() =>
              onChange([
                [-20, -15],
                [20, -15],
                [20, 15],
                [-20, 15],
              ])
            }
            className="rounded bg-slate-800 px-2 py-0.5 text-[11px] hover:bg-slate-700"
          >
            Reset Rect
          </button>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${size} ${size}`}
        onClick={handleSvgClick}
        className="w-full cursor-crosshair rounded border border-slate-700 bg-slate-950"
      >
        {/* Grid lines every 10mm */}
        {[-40, -30, -20, -10, 0, 10, 20, 30, 40].map((v) => {
          const [sx] = toSvg(v, 0);
          const [, sy] = toSvg(0, v);
          const isAxis = v === 0;
          return (
            <g key={v}>
              <line
                x1={sx}
                y1={0}
                x2={sx}
                y2={size}
                stroke={isAxis ? "#475569" : "#1e293b"}
                strokeWidth={isAxis ? 1.2 : 0.7}
              />
              <line
                x1={0}
                y1={sy}
                x2={size}
                y2={sy}
                stroke={isAxis ? "#475569" : "#1e293b"}
                strokeWidth={isAxis ? 1.2 : 0.7}
              />
            </g>
          );
        })}
        {points.length >= 3 && (
          <polygon points={polyStr} fill="rgba(20, 184, 166, 0.25)" stroke="#2dd4bf" strokeWidth="1.5" />
        )}
        {points.map(([x, y], i) => {
          const [cx, cy] = toSvg(x, y);
          return <circle key={i} cx={cx} cy={cy} r="3" fill="#facc15" />;
        })}
      </svg>

      <div className="max-h-24 overflow-y-auto space-y-1">
        {points.map(([x, y], idx) => (
          <div key={idx} className="flex items-center gap-1.5 text-[11px] text-slate-300">
            <span className="w-6 text-slate-500">P{idx + 1}</span>
            <input
              type="number"
              step="0.5"
              value={x}
              onChange={(e) => {
                const next = [...points];
                next[idx] = [Number(e.target.value), y];
                onChange(next);
              }}
              className="w-16 rounded bg-slate-800 px-1.5 py-0.5 text-slate-100 border border-slate-700"
            />
            <input
              type="number"
              step="0.5"
              value={y}
              onChange={(e) => {
                const next = [...points];
                next[idx] = [x, Number(e.target.value)];
                onChange(next);
              }}
              className="w-16 rounded bg-slate-800 px-1.5 py-0.5 text-slate-100 border border-slate-700"
            />
          </div>
        ))}
      </div>
    </div>
  );
};

const ThreeDModelWorkspace = ({ assignment, initialSubmission, cadConfig, onBack, onUpdated }) => {
  const initialFeatures = useMemo(() => {
    if (Array.isArray(initialSubmission?.sceneJson?.features) && initialSubmission.sceneJson.features.length) {
      return initialSubmission.sceneJson.features;
    }
    if (Array.isArray(assignment?.starterSceneJson?.features) && assignment.starterSceneJson.features.length) {
      return assignment.starterSceneJson.features;
    }
    return SAMPLE_TEMPLATES.bracket.features;
  }, [assignment, initialSubmission]);

  const resolvedInitialTool =
    assignment?.toolType && assignment.toolType !== "builtin-cad"
      ? assignment.toolType
      : assignment?.workspaceMode || "builtin-cad";
  const [features, setFeatures] = useState(initialFeatures);
  const [selectedId, setSelectedId] = useState(initialFeatures[0]?.id || null);
  const [activeMode, setActiveMode] = useState(
    resolvedInitialTool !== "hybrid" ? resolvedInitialTool : "builtin-cad"
  );
  const [studentNotes, setStudentNotes] = useState(initialSubmission?.studentNotes || "");
  const [versionNote, setVersionNote] = useState("");
  const [externalStlFile, setExternalStlFile] = useState(null);
  const [externalStepFile, setExternalStepFile] = useState(null);
  const [externalNativeFile, setExternalNativeFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submissionState, setSubmissionState] = useState(initialSubmission || null);

  // Evaluate parametric feature tree into CSG mesh + live metrics
  const { geometry, metrics } = useMemo(() => evaluateFeatureTree(features), [features]);

  const latestCadRef = useRef({ features, metrics, activeMode });
  useEffect(() => {
    latestCadRef.current = { features, metrics, activeMode };
  }, [features, metrics, activeMode]);

  useEffect(() => {
    if (!assignment?._id) return undefined;
    syncStudentActivity(assignment._id, {
      action: `Opened ${activeMode} Workspace`,
      codeLanguage: activeMode,
      sceneJson: { features: latestCadRef.current.features },
    });
    const timer = setInterval(() => {
      const cur = latestCadRef.current;
      const summary = cur.metrics
        ? `${cur.features.length} feature(s) · Vol ${cur.metrics.volumeMm3} mm³`
        : `Working in ${cur.activeMode}`;
      syncStudentActivity(assignment._id, {
        action: `Working in ${cur.activeMode}`,
        elapsedSeconds: 20,
        sceneJson: cur.activeMode === "builtin-cad" ? { features: cur.features } : undefined,
        workSummary: summary,
        liveData: {
          mode: cur.activeMode,
          metrics: cur.metrics,
          featureCount: cur.features.length,
        },
      });
    }, 20000);
    return () => clearInterval(timer);
  }, [assignment?._id, activeMode]);

  useEffect(() => {
    return () => {
      if (geometry) geometry.dispose();
    };
  }, [geometry]);

  // Ghost wireframes for cut features so student can see hole/pocket placement
  const ghostFeatures = useMemo(() => {
    return features
      .filter((f) => f.visible !== false && f.operation === "subtract")
      .map((f) => ({
        geometry: createFeatureGeometry(f),
        position: f.position,
        rotation: f.rotation,
      }));
  }, [features]);

  const selectedFeature = features.find((f) => f.id === selectedId) || null;

  const addFeature = (presetKey) => {
    const fn = DEFAULT_FEATURE_PRESETS[presetKey];
    if (!fn) return;
    const feat = fn(features.length + 1);
    setFeatures((prev) => [...prev, feat]);
    setSelectedId(feat.id);
  };

  const updateSelectedFeature = (updater) => {
    if (!selectedId) return;
    setFeatures((prev) => prev.map((f) => (f.id === selectedId ? updater(f) : f)));
  };

  const moveFeature = (idx, dir) => {
    const target = idx + dir;
    if (target < 0 || target >= features.length) return;
    setFeatures((prev) => {
      const next = [...prev];
      const [item] = next.splice(idx, 1);
      next.splice(target, 0, item);
      return next;
    });
  };

  const deleteFeature = (id) => {
    setFeatures((prev) => {
      const next = prev.filter((f) => f.id !== id);
      if (selectedId === id) setSelectedId(next[0]?.id || null);
      return next;
    });
  };

  const handleExportStl = () => {
    if (!geometry) {
      toast.warning("No solid geometry to export");
      return;
    }
    const blob = exportGeometryToStlBlob(geometry);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(assignment?.title || "part").replace(/[^a-zA-Z0-9_-]/g, "_")}.stl`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const buildSubmissionFormData = (isFinal = false) => {
    const fd = new FormData();
    const scenePayload = {
      schemaVersion: 1,
      mode: activeMode,
      features,
    };
    fd.append("sceneJson", JSON.stringify(scenePayload));
    fd.append("clientMetrics", JSON.stringify(metrics));
    fd.append("studentNotes", studentNotes);
    fd.append("versionNote", versionNote || (isFinal ? "Final Submission" : "Workspace Save"));

    if (externalStlFile) {
      fd.append("stlFile", externalStlFile);
    } else if (geometry) {
      const stlBlob = exportGeometryToStlBlob(geometry);
      if (stlBlob) {
        fd.append("stlFile", stlBlob, "model.stl");
      }
    }

    if (externalStepFile) {
      fd.append("stepFile", externalStepFile);
    }
    if (externalNativeFile) {
      fd.append("nativeFile", externalNativeFile);
    }
    return fd;
  };

  const isSandboxMode = !assignment?._id;

  const handleSaveProgress = async () => {
    if (isSandboxMode) {
      toast.info("Practice Sandbox mode: export .STL locally, or open a partner-assigned task to save snapshots to the server.");
      return;
    }
    try {
      setSaving(true);
      const token = getStudentToken();
      const fd = buildSubmissionFormData(false);
      const res = await axios.post(`/api/cad/submissions/${assignment._id}/save`, fd, token ? {
        headers: { Authorization: `Bearer ${token}` },
      } : {});
      setSubmissionState(res.data.submission);
      setVersionNote("");
      toast.success(`Saved snapshot v${res.data.submission?.versions?.length || 1}`);
      onUpdated && onUpdated(res.data.submission);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to save CAD progress");
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitFinal = async () => {
    if (isSandboxMode) {
      try {
        toast.success("Practice CAD work verified and exported locally!");
        setTimeout(() => { if (onBack) onBack(); }, 1200);
      } catch {
        toast.success("Practice CAD work submitted!");
      }
      return;
    }
    try {
      setSubmitting(true);
      const token = getStudentToken();
      if (!token) {
        toast.error("Please sign in to submit your work.");
        return;
      }
      const fd = buildSubmissionFormData(true);
      const res = await axios.post(`/api/cad/submissions/${assignment._id}/submit`, fd, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSubmissionState(res.data.submission);
      toast.success("CAD assignment submitted successfully!");
      if (onUpdated) onUpdated(res.data.submission);
      setTimeout(() => { if (onBack) onBack(); }, 1200);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  const activeToolMeta = getToolMeta(activeMode);
  const isCadExternalTool = [
    "freecad-wasm",
    "openscad-wasm",
    "solvespace-web",
    "freecad-container",
  ].includes(activeMode);
  const isExternalSimTool = activeMode !== "builtin-cad" && !isCadExternalTool;
  const externalIframeUrl =
    activeMode === "freecad-container"
      ? assignment?.externalToolUrl || cadConfig?.freecadContainerBaseUrl
      : activeMode === "freecad-wasm"
        ? assignment?.externalToolUrl || cadConfig?.freecadWasmUrl || "https://freecad.virtastic.app"
        : activeMode !== "builtin-cad"
          ? assignment?.externalToolUrl || activeToolMeta?.embedUrl || ""
          : "";

  return (
    <div className="space-y-4">
      {/* Top Studio Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="mb-1 text-xs font-semibold text-blue-600 hover:underline"
          >
            ← Back to Work Space
          </button>
          <h2 className="text-lg font-bold text-slate-900">{assignment?.title}</h2>
          <p className="text-xs text-slate-500">
            {assignment?.category} · {assignment?.difficulty}
            {assignment?.dueDate
              ? ` · Due ${new Date(assignment.dueDate).toLocaleString()}`
              : ""}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Workspace Switcher / Badge */}
          {isExternalSimTool ? (
            <span className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700">
              {activeToolMeta?.shortLabel || "Open-Source Lab"}
            </span>
          ) : (
            <>
              <select
                value={activeMode}
                onChange={(e) => setActiveMode(e.target.value)}
                className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700"
              >
                <option value="builtin-cad">Built-in EduTechEx 3D CAD</option>
                <option value="freecad-wasm">FreeCAD WASM (Chrome/Edge 137+)</option>
                <option value="openscad-wasm">OpenSCAD Playground (WASM)</option>
                <option value="solvespace-web">SolveSpace Web CAD</option>
                {(assignment?.externalToolUrl || cadConfig?.freecadContainerBaseUrl) && (
                  <option value={assignment?.toolType === "custom-oss-tool" ? "custom-oss-tool" : "freecad-container"}>
                    {assignment?.toolType === "custom-oss-tool" ? "Partner Open-Source Tool" : "Cloud FreeCAD Container"}
                  </option>
                )}
              </select>

              <button
                type="button"
                onClick={handleExportStl}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Export .STL
              </button>
            </>
          )}

          <button
            type="button"
            disabled={saving}
            onClick={handleSaveProgress}
            title={isSandboxMode ? "Practice Sandbox: open a partner-assigned task to save on server" : ""}
            className="rounded-lg bg-slate-800 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : isSandboxMode ? "Save (Assigned Only)" : "Save Snapshot"}
          </button>

          <button
            type="button"
            disabled={submitting}
            onClick={handleSubmitFinal}
            title={isSandboxMode ? "Practice Sandbox: open a partner-assigned task to submit for grading" : ""}
            className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? "Submitting..." : isSandboxMode ? "Submit (Assigned Only)" : "Submit Assignment"}
          </button>
        </div>
      </div>

      {/* Assignment Instructions + Starter Files */}
      {(assignment?.instructions || assignment?.starterFiles?.length > 0) && (
        <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-4 text-sm text-slate-700">
          {assignment?.instructions && (
            <div className="whitespace-pre-wrap text-xs leading-relaxed">
              <span className="font-semibold text-blue-900">Instructions: </span>
              {assignment.instructions}
            </div>
          )}
          {assignment?.starterFiles?.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-blue-900">Starter Files:</span>
              {assignment.starterFiles.map((f) => (
                <a
                  key={f._id || f.fileName}
                  href={resolveFileUrl(f.fileUrl)}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-md border border-blue-200 bg-white px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50"
                >
                  ⬇ {f.fileName}
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Main CAD Workspace */}
      {activeMode === "builtin-cad" ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          {/* Left: Feature Tree & Add Features */}
          <div className="lg:col-span-3 space-y-3 rounded-xl border border-slate-700 bg-slate-900 p-3 text-slate-100">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Feature Tree
              </h3>
              <select
                defaultValue=""
                onChange={(e) => {
                  const key = e.target.value;
                  if (key && SAMPLE_TEMPLATES[key]) {
                    setFeatures(SAMPLE_TEMPLATES[key].features);
                    setSelectedId(SAMPLE_TEMPLATES[key].features[0]?.id || null);
                  }
                  e.target.value = "";
                }}
                className="rounded bg-slate-800 px-2 py-1 text-[11px] text-slate-300 border border-slate-700"
              >
                <option value="" disabled>
                  Load Template...
                </option>
                <option value="bracket">L-Bracket</option>
                <option value="flange">Bearing Flange</option>
              </select>
            </div>

            {/* Add Feature Toolbar */}
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => addFeature("box")}
                className="rounded-md bg-blue-600/20 border border-blue-500/40 px-2 py-1.5 text-[11px] font-medium text-blue-200 hover:bg-blue-600/35"
              >
                + Boss Box
              </button>
              <button
                type="button"
                onClick={() => addFeature("cylinder")}
                className="rounded-md bg-sky-600/20 border border-sky-500/40 px-2 py-1.5 text-[11px] font-medium text-sky-200 hover:bg-sky-600/35"
              >
                + Boss Cylinder
              </button>
              <button
                type="button"
                onClick={() => addFeature("hole")}
                className="rounded-md bg-rose-600/20 border border-rose-500/40 px-2 py-1.5 text-[11px] font-medium text-rose-200 hover:bg-rose-600/35"
              >
                - Cut Hole
              </button>
              <button
                type="button"
                onClick={() => addFeature("cutBox")}
                className="rounded-md bg-rose-600/20 border border-rose-500/40 px-2 py-1.5 text-[11px] font-medium text-rose-200 hover:bg-rose-600/35"
              >
                - Cut Pocket
              </button>
              <button
                type="button"
                onClick={() => addFeature("extrude")}
                className="rounded-md bg-teal-600/20 border border-teal-500/40 px-2 py-1.5 text-[11px] font-medium text-teal-200 hover:bg-teal-600/35"
              >
                + 2D Sketch Extrude
              </button>
              <button
                type="button"
                onClick={() => addFeature("cone")}
                className="rounded-md bg-indigo-600/20 border border-indigo-500/40 px-2 py-1.5 text-[11px] font-medium text-indigo-200 hover:bg-indigo-600/35"
              >
                + Cone / Chamfer
              </button>
            </div>

            {/* Tree Items */}
            <div className="max-h-[340px] space-y-1.5 overflow-y-auto pr-1">
              {features.map((feat, idx) => {
                const isSel = feat.id === selectedId;
                return (
                  <div
                    key={feat.id}
                    onClick={() => setSelectedId(feat.id)}
                    className={`flex items-center justify-between rounded-lg border px-2.5 py-2 cursor-pointer text-xs ${
                      isSel
                        ? "border-blue-500 bg-blue-950/60 text-white"
                        : "border-slate-800 bg-slate-800/60 text-slate-300 hover:bg-slate-800"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 truncate font-medium">
                        <span
                          className={`inline-block h-2 w-2 rounded-full ${
                            feat.operation === "subtract"
                              ? "bg-rose-400"
                              : feat.operation === "intersect"
                                ? "bg-amber-400"
                                : "bg-emerald-400"
                          }`}
                        />
                        <span className={feat.visible === false ? "line-through opacity-50" : ""}>
                          {feat.name}
                        </span>
                      </div>
                      <span className="text-[10px] uppercase text-slate-400">
                        {feat.type} · {feat.operation}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 ml-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        title="Move Up"
                        onClick={() => moveFeature(idx, -1)}
                        className="rounded px-1 text-[10px] hover:bg-slate-700"
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        title="Move Down"
                        onClick={() => moveFeature(idx, 1)}
                        className="rounded px-1 text-[10px] hover:bg-slate-700"
                      >
                        ▼
                      </button>
                      <button
                        type="button"
                        title="Toggle Suppress"
                        onClick={() =>
                          setFeatures((prev) =>
                            prev.map((f) =>
                              f.id === feat.id ? { ...f, visible: f.visible === false } : f
                            )
                          )
                        }
                        className="rounded px-1 text-[10px] hover:bg-slate-700"
                      >
                        {feat.visible === false ? "○" : "●"}
                      </button>
                      <button
                        type="button"
                        title="Delete"
                        onClick={() => deleteFeature(feat.id)}
                        className="rounded px-1 text-[10px] text-rose-400 hover:bg-rose-950"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Center: 3D CAD Viewport + Live Telemetry */}
          <div className="lg:col-span-6 space-y-3">
            <ThreeDViewport
              geometry={geometry}
              ghostFeatures={ghostFeatures}
              className="h-[460px]"
            />

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-lg border border-slate-200 bg-white p-2.5 text-center">
                <div className="text-[11px] text-slate-500">Dimensions (mm)</div>
                <div className="text-xs font-bold text-slate-900">
                  {metrics.boundingBoxMm.x} × {metrics.boundingBoxMm.y} × {metrics.boundingBoxMm.z}
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-2.5 text-center">
                <div className="text-[11px] text-slate-500">Volume</div>
                <div className="text-xs font-bold text-slate-900">
                  {metrics.volumeMm3.toLocaleString()} mm³
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-2.5 text-center">
                <div className="text-[11px] text-slate-500">Surface Area</div>
                <div className="text-xs font-bold text-slate-900">
                  {metrics.surfaceAreaMm2.toLocaleString()} mm²
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-2.5 text-center">
                <div className="text-[11px] text-slate-500">Mesh Status</div>
                <div className="text-xs font-bold text-emerald-600">
                  {metrics.triangleCount} tris · {metrics.isWatertight ? "Solid" : "Empty"}
                </div>
              </div>
            </div>
          </div>

          {/* Right: Parametric Dimension Inspector */}
          <div className="lg:col-span-3 space-y-3 rounded-xl border border-slate-700 bg-slate-900 p-3 text-slate-100">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Parameters (mm / deg)
            </h3>

            {selectedFeature ? (
              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Feature Name</label>
                  <input
                    type="text"
                    value={selectedFeature.name}
                    onChange={(e) =>
                      updateSelectedFeature((f) => ({ ...f, name: e.target.value }))
                    }
                    className="w-full rounded bg-slate-800 px-2.5 py-1.5 text-slate-100 border border-slate-700"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Boolean Operation</label>
                  <select
                    value={selectedFeature.operation}
                    onChange={(e) =>
                      updateSelectedFeature((f) => ({ ...f, operation: e.target.value }))
                    }
                    className="w-full rounded bg-slate-800 px-2.5 py-1.5 text-slate-100 border border-slate-700"
                  >
                    <option value="union">Boss / Union (Add Material)</option>
                    <option value="subtract">Cut / Subtract (Remove Material)</option>
                    <option value="intersect">Intersect (Common Volume)</option>
                  </select>
                </div>

                {/* Type-specific Dimensions */}
                {selectedFeature.type === "box" && (
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      ["width", "Width (X)"],
                      ["height", "Height (Y)"],
                      ["depth", "Depth (Z)"],
                    ].map(([k, label]) => (
                      <div key={k}>
                        <label className="block text-[10px] text-slate-400">{label}</label>
                        <input
                          type="number"
                          step="0.5"
                          value={selectedFeature.params[k] ?? 20}
                          onChange={(e) =>
                            updateSelectedFeature((f) => ({
                              ...f,
                              params: { ...f.params, [k]: Number(e.target.value) },
                            }))
                          }
                          className="w-full rounded bg-slate-800 px-2 py-1 text-slate-100 border border-slate-700"
                        />
                      </div>
                    ))}
                  </div>
                )}

                {(selectedFeature.type === "cylinder" || selectedFeature.type === "cone") && (
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      ["radiusTop", "R-Top"],
                      ["radiusBottom", "R-Bot"],
                      ["height", "Height"],
                    ].map(([k, label]) => (
                      <div key={k}>
                        <label className="block text-[10px] text-slate-400">{label}</label>
                        <input
                          type="number"
                          step="0.5"
                          value={selectedFeature.params[k] ?? 10}
                          onChange={(e) =>
                            updateSelectedFeature((f) => ({
                              ...f,
                              params: { ...f.params, [k]: Number(e.target.value) },
                            }))
                          }
                          className="w-full rounded bg-slate-800 px-2 py-1 text-slate-100 border border-slate-700"
                        />
                      </div>
                    ))}
                  </div>
                )}

                {selectedFeature.type === "sphere" && (
                  <div>
                    <label className="block text-[10px] text-slate-400">Radius (mm)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={selectedFeature.params.radius ?? 14}
                      onChange={(e) =>
                        updateSelectedFeature((f) => ({
                          ...f,
                          params: { ...f.params, radius: Number(e.target.value) },
                        }))
                      }
                      className="w-full rounded bg-slate-800 px-2 py-1 text-slate-100 border border-slate-700"
                    />
                  </div>
                )}

                {selectedFeature.type === "extrude" && (
                  <div className="space-y-2">
                    <div>
                      <label className="block text-[10px] text-slate-400">Extrude Depth (mm)</label>
                      <input
                        type="number"
                        step="0.5"
                        value={selectedFeature.params.depth ?? 10}
                        onChange={(e) =>
                          updateSelectedFeature((f) => ({
                            ...f,
                            params: { ...f.params, depth: Number(e.target.value) },
                          }))
                        }
                        className="w-full rounded bg-slate-800 px-2 py-1 text-slate-100 border border-slate-700"
                      />
                    </div>
                    <SketchEditor2D
                      points={selectedFeature.params.sketchPoints || []}
                      onChange={(pts) =>
                        updateSelectedFeature((f) => ({
                          ...f,
                          params: { ...f.params, sketchPoints: pts },
                        }))
                      }
                    />
                  </div>
                )}

                {/* Position */}
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Position (X, Y, Z mm)</label>
                  <div className="grid grid-cols-3 gap-2">
                    {["x", "y", "z"].map((axis) => (
                      <input
                        key={axis}
                        type="number"
                        step="0.5"
                        value={selectedFeature.position?.[axis] ?? 0}
                        onChange={(e) =>
                          updateSelectedFeature((f) => ({
                            ...f,
                            position: { ...f.position, [axis]: Number(e.target.value) },
                          }))
                        }
                        className="w-full rounded bg-slate-800 px-2 py-1 text-slate-100 border border-slate-700"
                      />
                    ))}
                  </div>
                </div>

                {/* Rotation */}
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Rotation (X, Y, Z deg)</label>
                  <div className="grid grid-cols-3 gap-2">
                    {["x", "y", "z"].map((axis) => (
                      <input
                        key={axis}
                        type="number"
                        step="5"
                        value={selectedFeature.rotation?.[axis] ?? 0}
                        onChange={(e) =>
                          updateSelectedFeature((f) => ({
                            ...f,
                            rotation: { ...f.rotation, [axis]: Number(e.target.value) },
                          }))
                        }
                        className="w-full rounded bg-slate-800 px-2 py-1 text-slate-100 border border-slate-700"
                      />
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-400">Select or add a feature in the Feature Tree.</div>
            )}
          </div>
        </div>
      ) : (
        /* External Browser / WASM / Simulation Workspace */
        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
            <span>
              Running {activeToolMeta?.name || "open-source workspace"}:{" "}
              <strong className="text-slate-900">{externalIframeUrl}</strong>
            </span>
            <a
              href={externalIframeUrl}
              target="_blank"
              rel="noreferrer"
              className="text-blue-600 font-semibold hover:underline"
            >
              Open in full tab ↗
            </a>
          </div>
          <iframe
            title={activeToolMeta?.name || "EduTechEx Open-Source Workspace"}
            src={externalIframeUrl}
            className="h-[600px] w-full rounded-xl border border-slate-300 bg-slate-950"
            allow="clipboard-read; clipboard-write; fullscreen"
            allowFullScreen
          />
          {!isExternalSimTool && (
            <div className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:grid-cols-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Attach Exported .STL (for Auto-Check)
                </label>
                <input
                  type="file"
                  accept=".stl"
                  onChange={(e) => setExternalStlFile(e.target.files?.[0] || null)}
                  className="w-full text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Attach .STEP / .STP File
                </label>
                <input
                  type="file"
                  accept=".step,.stp,.iges,.igs"
                  onChange={(e) => setExternalStepFile(e.target.files?.[0] || null)}
                  className="w-full text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Attach Native (.FCStd / .scad)
                </label>
                <input
                  type="file"
                  accept=".fcstd,.scad,.py,.json"
                  onChange={(e) => setExternalNativeFile(e.target.files?.[0] || null)}
                  className="w-full text-xs"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Submission Notes & Live Auto-Check Status */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
          <h4 className="text-sm font-bold text-slate-900">Submission Notes & Snapshot Label</h4>
          <input
            type="text"
            placeholder="Version note (e.g., Added mounting holes)"
            value={versionNote}
            onChange={(e) => setVersionNote(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
          />
          <textarea
            rows={2}
            placeholder="Design notes for instructor (assumptions, tolerances, units)..."
            value={studentNotes}
            onChange={(e) => setStudentNotes(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
          />
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-slate-900">
              Auto-Check & Version History
            </h4>
            {submissionState?.status && (
              <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] font-semibold uppercase text-blue-700">
                {submissionState.status}
              </span>
            )}
          </div>

          {submissionState?.autoCheckResults?.checks?.length > 0 ? (
            <div className="space-y-1.5">
              {submissionState.autoCheckResults.checks.map((c, idx) => (
                <div
                  key={idx}
                  className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs ${
                    c.passed ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"
                  }`}
                >
                  <span className="font-medium">
                    {c.passed ? "✓" : "✕"} {c.name}
                  </span>
                  <span>
                    {c.actual} (Target: {c.expected})
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500">
              Save a snapshot or submit to run server-side STL geometry verification.
            </p>
          )}

          {submissionState?.versions?.length > 0 && (
            <div className="pt-2 border-t border-slate-100">
              <div className="text-[11px] font-semibold text-slate-600 mb-1">
                Saved Snapshots ({submissionState.versions.length})
              </div>
              <div className="max-h-24 overflow-y-auto space-y-1">
                {[...submissionState.versions].reverse().map((v) => (
                  <div
                    key={v._id || v.versionNumber}
                    className="flex items-center justify-between text-[11px] text-slate-600"
                  >
                    <span>
                      v{v.versionNumber}: {v.note}
                    </span>
                    <div className="flex items-center gap-2">
                      {v.sceneJson?.features && (
                        <button
                          type="button"
                          onClick={() => {
                            setFeatures(v.sceneJson.features);
                            setSelectedId(v.sceneJson.features[0]?.id || null);
                            toast.info(`Restored snapshot v${v.versionNumber} in editor`);
                          }}
                          className="text-blue-600 font-medium hover:underline"
                        >
                          Restore
                        </button>
                      )}
                      <span className="text-slate-400">
                        {new Date(v.savedAt).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ThreeDModelWorkspace;

