import React, { useEffect, useRef, useState } from "react";
import axios from "../../api/axiosInstance";
import { toast } from "react-toastify";
import { getStudentToken, syncStudentActivity } from "./activitySync";

let mermaidLoadPromise = null;

function loadMermaidRuntime() {
  if (mermaidLoadPromise) return mermaidLoadPromise;
  mermaidLoadPromise = new Promise((resolve, reject) => {
    const init = () => {
      if (!window.mermaid) {
        reject(new Error("Mermaid runtime failed to initialize"));
        return;
      }
      window.mermaid.initialize({
        startOnLoad: false,
        theme: "default",
        securityLevel: "strict",
      });
      resolve(window.mermaid);
    };

    if (window.mermaid) {
      init();
      return;
    }

    const script = document.createElement("script");
    script.src = "/mermaid/mermaid.min.js";
    script.async = true;
    script.onload = init;
    script.onerror = () => reject(new Error("Could not load /mermaid/mermaid.min.js"));
    document.head.appendChild(script);
  });
  return mermaidLoadPromise;
}

const DEFAULT_MERMAID = `flowchart TD
  A[Start Process] --> B{Condition Check}
  B -->|Pass| C[Execute Module]
  B -->|Fail| D[Log Exception]
  C --> E[Complete Task]
`;

const DEFAULT_DRAWIO_XML =
  '<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel>';

const MERMAID_TEMPLATES = {
  Flowchart: DEFAULT_MERMAID,
  Sequence: `sequenceDiagram
  Student->>EduTechEx: Open Daily Tool
  EduTechEx-->>Partner: Live Activity Sync
  Partner->>EduTechEx: Inspect & Grade
`,
  ERD: `erDiagram
  INTERNSHIP ||--o{ APPLICATION : receives
  STUDENT ||--o{ APPLICATION : submits
  ASSIGNMENT ||--o{ SUBMISSION : tracks
`,
};

const DiagramAndWhiteboardWorkspace = ({
  assignment,
  initialSubmission,
  mode = "diagram", // "diagram" (mermaid) | "drawio" | "whiteboard"
  onBack,
  onUpdated,
}) => {
  const isSandboxMode = !assignment?._id;
  const initialXml =
    initialSubmission?.submittedCode || assignment?.starterCode || DEFAULT_DRAWIO_XML;

  // Shared state
  const [code, setCode] = useState(
    initialSubmission?.submittedCode ||
      assignment?.starterCode ||
      (mode === "diagram" ? DEFAULT_MERMAID : mode === "drawio" ? initialXml : "")
  );
  const [svgMarkup, setSvgMarkup] = useState("");
  const [renderError, setRenderError] = useState("");
  const [drawioXml, setDrawioXml] = useState(initialXml);
  const [drawioSavedAt, setDrawioSavedAt] = useState(null);

  // Whiteboard state
  const [elements, setElements] = useState(() => {
    try {
      const parsed = JSON.parse(initialSubmission?.submittedCode || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [wbTool, setWbTool] = useState("pen");
  const [wbColor, setWbColor] = useState("#1d4ed8");
  const [showGrid, setShowGrid] = useState(true);
  const [drawingCurrent, setDrawingCurrent] = useState(null);

  const [studentNotes, setStudentNotes] = useState(initialSubmission?.studentNotes || "");
  const [versionNote, setVersionNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submissionState, setSubmissionState] = useState(initialSubmission || null);

  const drawioIframeRef = useRef(null);
  const canvasRef = useRef(null);
  const latestRef = useRef({ code, svgMarkup, drawioXml, elements });

  useEffect(() => {
    latestRef.current = { code, svgMarkup, drawioXml, elements };
  }, [code, svgMarkup, drawioXml, elements]);

  // ── Mode 1: Mermaid live render ────────────────────────────────────────────
  useEffect(() => {
    if (mode !== "diagram") return undefined;
    let active = true;
    const id = `mmd-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    loadMermaidRuntime()
      .then((mmd) => mmd.render(id, String(code || "flowchart TD\n  A-->B")))
      .then(({ svg }) => {
        if (!active) return;
        setSvgMarkup(svg);
        setRenderError("");
      })
      .catch((err) => {
        if (!active) return;
        setRenderError(err?.message || "Invalid Mermaid syntax");
      });
    return () => {
      active = false;
    };
  }, [code, mode]);

  // ── Mode 2: Draw.io postMessage protocol (Apache-2.0 embed.diagrams.net) ───
  useEffect(() => {
    if (mode !== "drawio") return undefined;
    const targetOrigin = "https://embed.diagrams.net";
    const onMessage = (evt) => {
      if (evt.origin !== targetOrigin) return;
      try {
        const msg = typeof evt.data === "string" ? JSON.parse(evt.data) : evt.data;
        if (msg.event === "init") {
          drawioIframeRef.current?.contentWindow?.postMessage(
            JSON.stringify({
              action: "load",
              autosave: 1,
              xml: latestRef.current.drawioXml || DEFAULT_DRAWIO_XML,
            }),
            targetOrigin
          );
        } else if (msg.event === "autosave" || msg.event === "save") {
          const nextXml = msg.xml || "";
          setDrawioXml(nextXml);
          setCode(nextXml);
          setDrawioSavedAt(new Date());
          if (assignment?._id) {
            syncStudentActivity(assignment._id, {
              action: msg.event === "save" ? "Saved Draw.io Diagram" : "Edited Draw.io Diagram",
              elapsedSeconds: 5,
              isEdit: true,
              submittedCode: nextXml,
              codeLanguage: "drawio-xml",
              workSummary: `Draw.io diagram updated (${nextXml.length} bytes)`,
              liveData: { mode: "drawio", xml: nextXml },
            });
          }
        }
      } catch {
        // Ignore non-JSON frames
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [assignment?._id, mode]);

  // ── Mode 3: Whiteboard Canvas drawing ──────────────────────────────────────
  useEffect(() => {
    if (mode !== "whiteboard" || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);

    if (showGrid) {
      ctx.strokeStyle = "#f1f5f9";
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 24) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += 24) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
    }

    const drawEl = (el) => {
      ctx.strokeStyle = el.color || "#1d4ed8";
      ctx.fillStyle = el.color || "#1d4ed8";
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      if (el.type === "pen" && Array.isArray(el.points) && el.points.length > 1) {
        ctx.beginPath();
        ctx.moveTo(el.points[0].x, el.points[0].y);
        for (let i = 1; i < el.points.length; i += 1) {
          ctx.lineTo(el.points[i].x, el.points[i].y);
        }
        ctx.stroke();
      } else if (el.type === "rect") {
        ctx.strokeRect(el.x, el.y, el.w, el.h);
      } else if (el.type === "circle") {
        const r = Math.hypot(el.w || 0, el.h || 0);
        ctx.beginPath();
        ctx.arc(el.x, el.y, r, 0, Math.PI * 2);
        ctx.stroke();
      } else if (el.type === "line" || el.type === "arrow") {
        const x2 = el.x + (el.w || 0);
        const y2 = el.y + (el.h || 0);
        ctx.beginPath();
        ctx.moveTo(el.x, el.y);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        if (el.type === "arrow") {
          const angle = Math.atan2(y2 - el.y, x2 - el.x);
          const head = 11;
          ctx.beginPath();
          ctx.moveTo(x2, y2);
          ctx.lineTo(x2 - head * Math.cos(angle - Math.PI / 6), y2 - head * Math.sin(angle - Math.PI / 6));
          ctx.moveTo(x2, y2);
          ctx.lineTo(x2 - head * Math.cos(angle + Math.PI / 6), y2 - head * Math.sin(angle + Math.PI / 6));
          ctx.stroke();
        }
      } else if (el.type === "text" && el.text) {
        ctx.font = "600 15px Inter, sans-serif";
        ctx.fillText(el.text, el.x, el.y);
      }
    };

    elements.forEach(drawEl);
    if (drawingCurrent) drawEl(drawingCurrent);
  }, [drawingCurrent, elements, mode, showGrid]);

  // Heartbeat sync every 20s
  useEffect(() => {
    if (!assignment?._id) return undefined;
    const modeLabel =
      mode === "drawio"
        ? "Draw.io Architect"
        : mode === "whiteboard"
          ? "Engineering Whiteboard"
          : "Mermaid Diagram Studio";
    syncStudentActivity(assignment._id, {
      action: `Opened ${modeLabel}`,
      codeLanguage: mode,
    });
    const timer = setInterval(() => {
      const cur = latestRef.current;
      const submittedPayload =
        mode === "drawio"
          ? cur.drawioXml
          : mode === "whiteboard"
            ? JSON.stringify(cur.elements)
            : cur.code;
      const liveData =
        mode === "drawio"
          ? { mode: "drawio", xml: cur.drawioXml }
          : mode === "whiteboard"
            ? { mode: "whiteboard", elements: cur.elements }
            : { mode: "mermaid", svgMarkup: cur.svgMarkup };
      syncStudentActivity(assignment._id, {
        action: `Working in ${modeLabel}`,
        elapsedSeconds: 20,
        submittedCode: submittedPayload,
        codeLanguage: mode,
        workSummary:
          mode === "whiteboard"
            ? `${cur.elements.length} sketch object(s)`
            : mode === "drawio"
              ? `Draw.io XML (${(cur.drawioXml || "").length} bytes)`
              : `Mermaid script (${(cur.code || "").length} chars)`,
        liveData,
      });
    }, 20000);
    return () => clearInterval(timer);
  }, [assignment?._id, mode]);

  const getCanvasPoint = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    return {
      x: Math.round((e.clientX - rect.left) * scaleX),
      y: Math.round((e.clientY - rect.top) * scaleY),
    };
  };

  const handleCanvasDown = (e) => {
    const pt = getCanvasPoint(e);
    if (wbTool === "text") {
      const label = window.prompt("Enter annotation text:", "Component A");
      if (label) {
        const next = [...elements, { type: "text", x: pt.x, y: pt.y, text: label, color: wbColor }];
        setElements(next);
      }
      return;
    }
    if (wbTool === "pen") {
      setDrawingCurrent({ type: "pen", points: [pt], color: wbColor });
    } else {
      setDrawingCurrent({ type: wbTool, x: pt.x, y: pt.y, w: 0, h: 0, color: wbColor });
    }
  };

  const handleCanvasMove = (e) => {
    if (!drawingCurrent) return;
    const pt = getCanvasPoint(e);
    if (drawingCurrent.type === "pen") {
      setDrawingCurrent((prev) => ({ ...prev, points: [...prev.points, pt] }));
    } else {
      setDrawingCurrent((prev) => ({ ...prev, w: pt.x - prev.x, h: pt.y - prev.y }));
    }
  };

  const handleCanvasUp = () => {
    if (!drawingCurrent) return;
    const next = [...elements, drawingCurrent];
    setElements(next);
    setDrawingCurrent(null);
  };

  const buildFormData = (isFinal) => {
    const fd = new FormData();
    const payloadStr =
      mode === "drawio"
        ? drawioXml
        : mode === "whiteboard"
          ? JSON.stringify(elements)
          : code;
    const liveData =
      mode === "drawio"
        ? { mode: "drawio", xml: drawioXml }
        : mode === "whiteboard"
          ? { mode: "whiteboard", elements }
          : { mode: "mermaid", svgMarkup };
    const summary =
      mode === "whiteboard"
        ? `Whiteboard with ${elements.length} element(s)`
        : mode === "drawio"
          ? `Draw.io XML (${drawioXml.length} chars)`
          : `Mermaid Diagram (${code.split("\n").length} lines)`;

    fd.append("submittedCode", payloadStr);
    fd.append("codeLanguage", mode);
    fd.append("codeOutput", summary);
    fd.append("workSummary", summary);
    fd.append("liveData", JSON.stringify(liveData));
    fd.append("studentNotes", studentNotes);
    fd.append("versionNote", versionNote || (isFinal ? "Final Diagram Submission" : "Diagram Save"));
    return fd;
  };

  const handleSave = async () => {
    if (isSandboxMode) {
      try {
        localStorage.setItem(`skillnaav_diagram_saved_${mode}`, JSON.stringify(elements || code || drawioXml));
        toast.success("Practice snapshot saved locally!");
      } catch {
        toast.info("Practice mode: diagram preserved in this session.");
      }
      return;
    }
    try {
      setSaving(true);
      const token = getStudentToken();
      const res = await axios.post(`/api/daily-work/submissions/${assignment._id}/save`, buildFormData(false), token ? {
        headers: { Authorization: `Bearer ${token}` },
      } : {});
      setSubmissionState(res.data.submission);
      setVersionNote("");
      toast.success("Diagram snapshot saved!");
      onUpdated && onUpdated(res.data.submission);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to save diagram");
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (isSandboxMode) {
      try {
        localStorage.setItem(`skillnaav_diagram_submitted_${mode}`, JSON.stringify(elements || code || drawioXml));
        toast.success("Practice diagram submitted and verified!");
        setTimeout(() => {
          if (onBack) onBack();
        }, 1200);
      } catch {
        toast.success("Practice diagram submitted!");
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
      const res = await axios.post(`/api/daily-work/submissions/${assignment._id}/submit`, buildFormData(true), {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSubmissionState(res.data.submission);
      toast.success("Diagram work submitted successfully!");
      if (onUpdated) onUpdated(res.data.submission);
      setTimeout(() => {
        if (onBack) onBack();
      }, 1200);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Submission failed");
    } finally {
      setSubmitting(false);
    }
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
              {mode === "drawio"
                ? "Draw.io (Apache-2.0 · Live XML Sync)"
                : mode === "whiteboard"
                  ? "Whiteboard Canvas · Live Sync"
                  : "Mermaid.js Studio (MIT · Live Sync)"}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="rounded-lg bg-slate-800 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Snapshot"}
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={handleSubmit}
            className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? "Submitting..." : "Submit Work"}
          </button>
        </div>
      </div>

      {assignment?.instructions && (
        <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-4 text-xs text-slate-700 whitespace-pre-wrap">
          <span className="font-semibold text-blue-900">Instructions: </span>
          {assignment.instructions}
        </div>
      )}

      {mode === "diagram" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="lg:col-span-5 rounded-xl border border-slate-700 bg-slate-950 overflow-hidden flex flex-col">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-300">
              <span className="font-mono font-semibold">diagram.mmd</span>
              <div className="flex gap-1">
                {Object.entries(MERMAID_TEMPLATES).map(([name, tpl]) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => setCode(tpl)}
                    className="rounded bg-slate-800 px-2 py-0.5 text-[11px] hover:bg-slate-700"
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              spellCheck={false}
              rows={18}
              className="w-full flex-1 resize-y bg-slate-950 p-4 font-mono text-xs leading-6 text-slate-100 focus:outline-none"
            />
          </div>

          <div className="lg:col-span-7 rounded-xl border border-slate-200 bg-white p-4 flex flex-col">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-bold uppercase text-slate-600">Live SVG Render</span>
              {svgMarkup && (
                <button
                  type="button"
                  onClick={() => {
                    const blob = new Blob([svgMarkup], { type: "image/svg+xml" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = "diagram.svg";
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="rounded border border-slate-300 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Download .SVG
                </button>
              )}
            </div>
            {renderError ? (
              <div className="rounded-lg bg-red-50 p-3 text-xs font-mono text-red-700">{renderError}</div>
            ) : (
              <div
                className="flex-1 overflow-auto rounded-lg border border-slate-100 bg-slate-50 p-4 flex items-center justify-center min-h-[380px]"
                dangerouslySetInnerHTML={{ __html: svgMarkup }}
              />
            )}
          </div>
        </div>
      )}

      {mode === "drawio" && (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-600">
            <span>
              Use File → Save inside Draw.io (or auto-save every edit) — diagram XML syncs automatically to EduTechEx.
            </span>
            {drawioSavedAt && (
              <span className="font-semibold text-emerald-700">
                Synced at {drawioSavedAt.toLocaleTimeString()}
              </span>
            )}
          </div>
          <iframe
            ref={drawioIframeRef}
            title="Draw.io Diagrams.net"
            src="https://embed.diagrams.net/?embed=1&proto=json&libraries=1&ui=min&spin=1"
            className="h-[620px] w-full border-0"
          />
        </div>
      )}

      {mode === "whiteboard" && (
        <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                ["pen", "Pen"],
                ["line", "Line"],
                ["arrow", "Arrow"],
                ["rect", "Rectangle"],
                ["circle", "Circle"],
                ["text", "Text"],
              ].map(([toolId, label]) => (
                <button
                  key={toolId}
                  type="button"
                  onClick={() => setWbTool(toolId)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                    wbTool === toolId
                      ? "bg-blue-600 text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  {label}
                </button>
              ))}
              {["#1d4ed8", "#0f172a", "#dc2626", "#16a34a", "#d97706"].map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Color ${c}`}
                  onClick={() => setWbColor(c)}
                  className={`h-6 w-6 rounded-full border-2 ${
                    wbColor === c ? "border-slate-900 scale-110" : "border-white"
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowGrid((g) => !g)}
                className="rounded border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700"
              >
                Grid: {showGrid ? "ON" : "OFF"}
              </button>
              <button
                type="button"
                onClick={() => setElements((prev) => prev.slice(0, -1))}
                className="rounded border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700"
              >
                Undo
              </button>
              <button
                type="button"
                onClick={() => setElements([])}
                className="rounded border border-red-200 px-2.5 py-1 text-xs font-semibold text-red-600"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => {
                  const url = canvasRef.current?.toDataURL("image/png");
                  if (!url) return;
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "sketch.png";
                  a.click();
                }}
                className="rounded border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700"
              >
                Export .PNG
              </button>
            </div>
          </div>

          <canvas
            ref={canvasRef}
            width={1100}
            height={520}
            onMouseDown={handleCanvasDown}
            onMouseMove={handleCanvasMove}
            onMouseUp={handleCanvasUp}
            onMouseLeave={handleCanvasUp}
            className="w-full h-[460px] rounded-lg border border-slate-200 cursor-crosshair bg-white"
          />
        </div>
      )}

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

export default DiagramAndWhiteboardWorkspace;

