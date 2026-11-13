import React, { useCallback, useEffect, useRef, useState } from "react";
import axios from "../../api/axiosInstance";
import { toast } from "react-toastify";
import ThreeDViewport from "./ThreeDViewport";
import { evaluateJscadScript, exportGeometryToStlBlob } from "./threeDGeometryEngine";
import { getStudentToken, syncStudentActivity } from "./activitySync";

const DEFAULT_SCRIPT = `// Scripted 3D CAD (mm dimensions)
// Helpers: box(w,h,d), cylinder(r,h), cone(rTop,rBot,h), sphere(r), torus(r,tube)
// Transforms: translate(m,x,y,z), rotate(m,rx,ry,rz), scale(m,sx,sy,sz)
// Booleans: union(a,b), subtract(a,b), intersect(a,b)

const basePlate = box(60, 10, 40);
const centerBoss = translate(cylinder(12, 18), 0, 14, 0);
const centerHole = translate(cylinder(6, 36), 0, 10, 0);
const bracket = union(basePlate, centerBoss);
return subtract(bracket, centerHole);
`;

const Scripted3DWorkspace = ({ assignment, initialSubmission, onBack, onUpdated }) => {
  const isSandboxMode = !assignment?._id;
  const [scriptCode, setScriptCode] = useState(
    initialSubmission?.submittedCode || assignment?.starterCode || DEFAULT_SCRIPT
  );
  const [geometry, setGeometry] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [evalError, setEvalError] = useState("");
  const [studentNotes, setStudentNotes] = useState(initialSubmission?.studentNotes || "");
  const [versionNote, setVersionNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submissionState, setSubmissionState] = useState(initialSubmission || null);

  const latestRef = useRef({ scriptCode, metrics, evalError });
  useEffect(() => {
    latestRef.current = { scriptCode, metrics, evalError };
  }, [scriptCode, metrics, evalError]);

  const runScript = useCallback(
    (codeToRun, { recordRun = true } = {}) => {
      try {
        const res = evaluateJscadScript(codeToRun);
        setGeometry(res.geometry);
        setMetrics(res.metrics);
        setEvalError("");
        const summary = `Volume: ${res.metrics.volumeMm3} mm³ | Bounds: ${res.metrics.boundingBoxMm.x}×${res.metrics.boundingBoxMm.y}×${res.metrics.boundingBoxMm.z} mm`;
        if (recordRun && assignment?._id) {
          syncStudentActivity(assignment._id, {
            action: "Compiled Scripted 3D CAD",
            detail: summary,
            isRun: true,
            submittedCode: codeToRun,
            codeLanguage: "jscad",
            codeOutput: summary,
            workSummary: summary,
            liveData: { mode: "jscad", metrics: res.metrics },
          });
        }
      } catch (err) {
        setEvalError(err?.message || "Failed to evaluate 3D CAD script");
      }
    },
    [assignment?._id]
  );

  useEffect(() => {
    runScript(latestRef.current.scriptCode, { recordRun: false });
  }, [runScript]);

  useEffect(() => {
    if (!assignment?._id) return undefined;
    syncStudentActivity(assignment._id, {
      action: "Opened Scripted 3D CAD",
      codeLanguage: "jscad",
      submittedCode: latestRef.current.scriptCode,
    });
    const timer = setInterval(() => {
      const cur = latestRef.current;
      const summary = cur.metrics
        ? `Volume: ${cur.metrics.volumeMm3} mm³ (${cur.metrics.boundingBoxMm.x}×${cur.metrics.boundingBoxMm.y}×${cur.metrics.boundingBoxMm.z} mm)`
        : cur.evalError || "Editing Scripted CAD";
      syncStudentActivity(assignment._id, {
        action: "Working in Scripted 3D CAD",
        elapsedSeconds: 20,
        submittedCode: cur.scriptCode,
        codeLanguage: "jscad",
        codeOutput: summary,
        workSummary: summary,
        liveData: { mode: "jscad", metrics: cur.metrics },
      });
    }, 20000);
    return () => clearInterval(timer);
  }, [assignment?._id]);

  const buildFormData = (isFinal) => {
    const fd = new FormData();
    const summary = metrics
      ? `Volume: ${metrics.volumeMm3} mm³ | Bounds: ${metrics.boundingBoxMm.x}×${metrics.boundingBoxMm.y}×${metrics.boundingBoxMm.z} mm`
      : "";
    fd.append("submittedCode", scriptCode);
    fd.append("codeLanguage", "jscad");
    fd.append("codeOutput", summary);
    fd.append("workSummary", summary);
    if (metrics) fd.append("geometryMetrics", JSON.stringify(metrics));
    fd.append("liveData", JSON.stringify({ mode: "jscad", metrics }));
    if (geometry) {
      const blob = exportGeometryToStlBlob(geometry);
      if (blob) fd.append("stlFile", blob, "scripted-cad-model.stl");
    }
    fd.append("studentNotes", studentNotes);
    fd.append("versionNote", versionNote || (isFinal ? "Final Scripted CAD Submission" : "Scripted CAD Save"));
    return fd;
  };

  const handleSave = async () => {
    if (isSandboxMode) {
      toast.info("Practice Sandbox mode: export .STL locally, or open a partner-assigned task to save.");
      return;
    }
    try {
      setSaving(true);
      const res = await axios.post(`/api/daily-work/submissions/${assignment._id}/save`, buildFormData(false), {
        headers: { Authorization: `Bearer ${getStudentToken()}`, "Content-Type": "multipart/form-data" },
      });
      setSubmissionState(res.data.submission);
      setVersionNote("");
      toast.success("Scripted CAD snapshot saved!");
      onUpdated && onUpdated(res.data.submission);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to save CAD snapshot");
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (isSandboxMode) {
      toast.info("Practice Sandbox mode: open an assigned task to submit for grading.");
      return;
    }
    try {
      setSubmitting(true);
      const res = await axios.post(`/api/daily-work/submissions/${assignment._id}/submit`, buildFormData(true), {
        headers: { Authorization: `Bearer ${getStudentToken()}`, "Content-Type": "multipart/form-data" },
      });
      setSubmissionState(res.data.submission);
      toast.success("Scripted CAD work submitted!");
      onUpdated && onUpdated(res.data.submission);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadStl = () => {
    if (!geometry) {
      toast.warning("Build a valid 3D model first");
      return;
    }
    const blob = exportGeometryToStlBlob(geometry);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "edutechex-scripted-model.stl";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="mb-1 text-xs font-semibold text-blue-600 hover:underline"
          >
            ← Back to Work Space
          </button>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900">{assignment?.title}</h2>
            <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-800">
              Scripted 3D CAD (CSG · MIT)
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => runScript(scriptCode, { recordRun: true })}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
          >
            ▶ Build 3D Model
          </button>
          <button
            type="button"
            onClick={handleDownloadStl}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Export .STL
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="rounded-lg bg-slate-800 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : isSandboxMode ? "Save (Assigned Only)" : "Save Snapshot"}
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={handleSubmit}
            className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? "Submitting..." : isSandboxMode ? "Submit (Assigned Only)" : "Submit Work"}
          </button>
        </div>
      </div>

      {assignment?.instructions && (
        <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-4 text-xs text-slate-700 whitespace-pre-wrap">
          <span className="font-semibold text-blue-900">Instructions: </span>
          {assignment.instructions}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="lg:col-span-5 flex flex-col rounded-xl border border-slate-700 bg-slate-950 overflow-hidden">
          <div className="border-b border-slate-800 bg-slate-900 px-4 py-2 text-xs font-mono text-slate-300">
            model.cad.js
          </div>
          <textarea
            value={scriptCode}
            onChange={(e) => setScriptCode(e.target.value)}
            spellCheck={false}
            rows={18}
            className="w-full flex-1 resize-y bg-slate-950 p-4 font-mono text-xs leading-6 text-slate-100 focus:outline-none"
          />
          {evalError && (
            <div className="border-t border-red-800 bg-red-950/60 p-3 font-mono text-xs text-red-300">
              {evalError}
            </div>
          )}
        </div>

        <div className="lg:col-span-7 space-y-3">
          <ThreeDViewport geometry={geometry} metrics={metrics} className="h-[460px]" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-3">
        <input
          type="text"
          value={versionNote}
          onChange={(e) => setVersionNote(e.target.value)}
          placeholder="Snapshot note..."
          className="rounded-lg border border-slate-300 px-3 py-2 text-xs"
        />
        <input
          type="text"
          value={studentNotes}
          onChange={(e) => setStudentNotes(e.target.value)}
          placeholder="Notes for partner/instructor..."
          className="rounded-lg border border-slate-300 px-3 py-2 text-xs md:col-span-2"
        />
        {submissionState?.versions?.length > 0 && (
          <div className="md:col-span-3 text-xs text-slate-500">
            Status: <span className="font-semibold uppercase text-slate-800">{submissionState.status}</span> · Snapshots saved: {submissionState.versions.length}
          </div>
        )}
      </div>
    </div>
  );
};

export default Scripted3DWorkspace;

