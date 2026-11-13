import React, { useEffect, useMemo, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import ThreeDViewport from "./ThreeDViewport";
import { evaluateFeatureTree, evaluateJscadScript } from "./threeDGeometryEngine";
import { formatDurationSeconds } from "./activitySync";

const WhiteboardPreviewCanvas = ({ elements = [] }) => {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (const el of elements) {
      ctx.strokeStyle = el.color || "#1d4ed8";
      ctx.fillStyle = el.color || "#1d4ed8";
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
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
        ctx.beginPath();
        ctx.arc(el.x, el.y, Math.hypot(el.w || 0, el.h || 0), 0, Math.PI * 2);
        ctx.stroke();
      } else if (el.type === "line" || el.type === "arrow") {
        ctx.beginPath();
        ctx.moveTo(el.x, el.y);
        ctx.lineTo(el.x + (el.w || 0), el.y + (el.h || 0));
        ctx.stroke();
      } else if (el.type === "text" && el.text) {
        ctx.font = "600 15px Inter, sans-serif";
        ctx.fillText(el.text, el.x, el.y);
      }
    }
  }, [elements]);

  return (
    <canvas
      ref={ref}
      width={1100}
      height={520}
      className="w-full h-[300px] rounded-xl border border-slate-200 bg-white object-contain"
    />
  );
};

const StudentWorkInspector = ({
  assignment,
  submission,
  activeVersion,
  inspectUrl,
  inspectName,
  inspectCode,
  inspectOutput,
}) => {
  const toolType = assignment?.toolType || assignment?.workspaceMode || "builtin-cad";
  const sceneJson = activeVersion?.sceneJson || submission?.sceneJson || null;
  const liveData = submission?.liveData || null;

  // Live 3D reconstruction from synced feature tree or JSCAD script when STL wasn't exported yet
  const liveGeometryObj = useMemo(() => {
    if (inspectUrl) return null;
    if (toolType === "jscad-studio" && inspectCode) {
      try {
        return evaluateJscadScript(inspectCode);
      } catch {
        return null;
      }
    }
    if (sceneJson?.features?.length > 0) {
      try {
        return evaluateFeatureTree(sceneJson.features);
      } catch {
        return null;
      }
    }
    return null;
  }, [inspectUrl, toolType, inspectCode, sceneJson]);

  useEffect(() => {
    return () => {
      if (liveGeometryObj?.geometry) {
        liveGeometryObj.geometry.dispose();
      }
    };
  }, [liveGeometryObj]);

  const wbElements = useMemo(() => {
    if (toolType !== "whiteboard-lab") return [];
    if (Array.isArray(liveData?.elements)) return liveData.elements;
    try {
      const parsed = JSON.parse(inspectCode || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [toolType, liveData, inspectCode]);

  if (!submission || submission.isNotStarted) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-xs text-slate-500">
        This student has not opened the assigned tool yet. Live code, 3D geometry, queries, and activity appear here automatically as soon as they start working inside EduTechEx.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Live Telemetry Summary Bar */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 text-xs">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
          <div className="text-[10px] uppercase text-slate-500">Live Status</div>
          <div className="mt-0.5 font-bold text-slate-900">
            {submission.isOnlineNow
              ? "🟢 Working Live Now"
              : submission.status === "submitted"
                ? "🔵 Submitted"
                : submission.status === "graded"
                  ? "🏅 Graded"
                  : "🟡 Draft Saved"}
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
          <div className="text-[10px] uppercase text-slate-500">Active Time</div>
          <div className="mt-0.5 font-bold text-slate-900">
            {formatDurationSeconds(submission.timeSpentSeconds)}
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
          <div className="text-[10px] uppercase text-slate-500">Tool Runs / Edits</div>
          <div className="mt-0.5 font-bold text-slate-900">
            {submission.runCount || 0} runs · {submission.versions?.length || 0} snapshots
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
          <div className="text-[10px] uppercase text-slate-500">Last Action</div>
          <div className="mt-0.5 font-semibold text-slate-800 truncate" title={submission.lastAction || ""}>
            {submission.lastAction || "Workspace opened"}
          </div>
        </div>
      </div>

      {/* Tool-specific Live Preview */}
      {["web-sandbox", "html-css-js-studio"].includes(toolType) && inspectCode && (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-700 bg-slate-950 p-3">
            <div className="mb-1 text-[11px] font-bold uppercase text-slate-400">Live HTML / CSS / JS Code</div>
            <pre className="max-h-72 overflow-auto font-mono text-xs text-slate-100 whitespace-pre-wrap">
              {inspectCode}
            </pre>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="border-b border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-bold text-slate-600">
              Live Web Output Preview
            </div>
            <iframe
              title="Student Web Preview"
              sandbox="allow-scripts"
              srcDoc={inspectCode}
              className="h-72 w-full border-0 bg-white"
            />
          </div>
        </div>
      )}

      {[
        "cpp-compiler",
        "python-lab",
        "java-compiler",
        "go-rust-compiler",
        "typescript-compiler",
        "php-compiler",
        "ruby-compiler",
        "csharp-compiler",
        "bash-shell-lab",
      ].includes(toolType) && (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-700 bg-slate-950 p-3">
            <div className="mb-1 text-[11px] font-bold uppercase text-slate-400">
              Student Code ({submission.codeLanguage || assignment.codeLanguage || "code"})
            </div>
            <pre className="max-h-72 overflow-auto font-mono text-xs text-slate-100 whitespace-pre-wrap">
              {inspectCode || "(typing...)"}
            </pre>
          </div>
          <div className="rounded-xl border border-slate-700 bg-slate-900 p-3">
            <div className="mb-1 text-[11px] font-bold uppercase text-slate-400">Latest Output</div>
            <pre className="max-h-72 overflow-auto font-mono text-xs text-emerald-300 whitespace-pre-wrap">
              {inspectOutput || "(not run yet)"}
            </pre>
          </div>
        </div>
      )}

      {toolType === "regex-json-lab" && (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-700 bg-slate-950 p-3">
            <div className="mb-1 text-[11px] font-bold uppercase text-slate-400">Regex &amp; JSON State</div>
            <pre className="max-h-64 overflow-auto font-mono text-xs text-slate-100 whitespace-pre-wrap">
              {inspectCode || "(typing...)"}
            </pre>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="mb-1 text-[11px] font-bold uppercase text-slate-500">Validation Summary</div>
            <pre className="font-mono text-xs text-emerald-700 whitespace-pre-wrap">
              {inspectOutput || submission.workSummary || "(waiting for edits)"}
            </pre>
          </div>
        </div>
      )}

      {toolType === "sql-lab" && (
        <div className="space-y-3">
          <div className="rounded-xl border border-slate-700 bg-slate-950 p-3">
            <div className="mb-1 text-[11px] font-bold uppercase text-slate-400">Live SQL Script</div>
            <pre className="max-h-56 overflow-auto font-mono text-xs text-slate-100 whitespace-pre-wrap">
              {inspectCode || "(no SQL yet)"}
            </pre>
          </div>
          {Array.isArray(liveData?.results) && liveData.results.length > 0 && (
            <div className="rounded-xl border border-slate-200 overflow-x-auto">
              <div className="bg-slate-100 px-3 py-1.5 text-[11px] font-bold text-slate-700">
                Latest Query Output ({liveData.results[0].totalRows} row(s))
              </div>
              <table className="min-w-full divide-y divide-slate-200 text-xs">
                <thead className="bg-slate-50">
                  <tr>
                    {liveData.results[0].columns?.map((c, idx) => (
                      <th key={`${c}-${idx}`} className="px-3 py-1.5 text-left font-semibold text-slate-700">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(liveData.results[0].values || []).slice(0, 12).map((row, rIdx) => (
                    <tr key={rIdx}>
                      {row.map((cell, cIdx) => (
                        <td key={cIdx} className="px-3 py-1 font-mono text-slate-700">
                          {cell === null ? "NULL" : String(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {toolType === "mermaid-studio" && (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-700 bg-slate-950 p-3">
            <div className="mb-1 text-[11px] font-bold uppercase text-slate-400">Mermaid Code</div>
            <pre className="max-h-72 overflow-auto font-mono text-xs text-slate-100 whitespace-pre-wrap">
              {inspectCode}
            </pre>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 overflow-auto max-h-72">
            {liveData?.svgMarkup ? (
              <div dangerouslySetInnerHTML={{ __html: liveData.svgMarkup }} />
            ) : (
              <span className="text-xs text-slate-400">Diagram SVG appears as student edits.</span>
            )}
          </div>
        </div>
      )}

      {toolType === "whiteboard-lab" && (
        <div className="space-y-1">
          <div className="text-[11px] font-bold uppercase text-slate-500">
            Live Whiteboard Canvas ({wbElements.length} stroke/shape objects)
          </div>
          <WhiteboardPreviewCanvas elements={wbElements} />
        </div>
      )}

      {toolType === "diagram-studio" && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-800">Draw.io Synced XML Diagram</span>
            {inspectCode && (
              <button
                type="button"
                onClick={() => {
                  const blob = new Blob([inspectCode], { type: "application/xml" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `${submission.studentName || "student"}-diagram.drawio`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="rounded border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700"
              >
                Download .drawio
              </button>
            )}
          </div>
          <pre className="max-h-48 overflow-auto rounded bg-slate-900 p-3 font-mono text-[11px] text-slate-200">
            {inspectCode || "(No XML synced yet)"}
          </pre>
        </div>
      )}

      {toolType === "markdown-lab" && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 prose prose-sm max-w-none max-h-80 overflow-y-auto">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{inspectCode || ""}</ReactMarkdown>
        </div>
      )}

      {toolType === "data-lab" && (
        <div className="space-y-2">
          {Array.isArray(liveData?.numericStats) && liveData.numericStats.length > 0 && (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 text-xs">
              {liveData.numericStats.map((st) => (
                <div key={st.column} className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                  <div className="font-bold text-slate-800">{st.column}</div>
                  <div className="text-slate-600">
                    Avg: {st.avg} · Min: {st.min} · Max: {st.max}
                  </div>
                </div>
              ))}
            </div>
          )}
          <pre className="max-h-56 overflow-auto rounded-xl bg-slate-950 p-3 font-mono text-xs text-slate-100">
            {inspectCode || "(No CSV data yet)"}
          </pre>
        </div>
      )}

      {(inspectUrl || liveGeometryObj?.geometry) && (
        <ThreeDViewport
          fileUrl={inspectUrl || undefined}
          fileName={inspectName}
          geometry={!inspectUrl ? liveGeometryObj?.geometry : undefined}
          metrics={!inspectUrl ? liveGeometryObj?.metrics : submission.geometryMetrics}
          className="h-[340px]"
        />
      )}

      {/* Live Activity Timeline */}
      {Array.isArray(submission.activityLog) && submission.activityLog.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="mb-2 text-[11px] font-bold uppercase text-slate-600">
            Live Activity Log inside EduTechEx ({submission.activityLog.length} recent events)
          </div>
          <div className="max-h-36 overflow-y-auto space-y-1">
            {[...submission.activityLog].reverse().map((ev, idx) => (
              <div key={idx} className="flex items-center justify-between gap-2 text-xs text-slate-700">
                <span>
                  <span className="font-semibold text-slate-900">{ev.action}</span>
                  {ev.detail ? ` — ${ev.detail}` : ""}
                </span>
                <span className="shrink-0 text-[10px] text-slate-400">
                  {ev.timestamp ? new Date(ev.timestamp).toLocaleTimeString() : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentWorkInspector;

