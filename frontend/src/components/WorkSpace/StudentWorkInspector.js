import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Clock,
  Play,
  Activity,
  Copy,
  Check,
  Columns,
  Rows,
  Terminal,
  Code2,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
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
  rubricHeaderCell,
  isRubricOpen = false,
  rubricPanel,
}) => {
  const [viewMode, setViewMode] = useState("stacked"); // "stacked" (default - full width) or "split" (side-by-side)
  const [copied, setCopied] = useState(false);

  const handleCopyCode = () => {
    if (!inspectCode) return;
    navigator.clipboard.writeText(inspectCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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

  const renderUnifiedTopBar = () => (
    <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-2xs min-h-[72px]">
      <div className="flex flex-col lg:flex-row items-stretch divide-y lg:divide-y-0 lg:divide-x divide-slate-100 h-full w-full">
        {/* Cell 1: Live Status */}
        <div className="p-3.5 flex flex-col justify-between shrink-0 min-w-[130px]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 leading-none">
            Live Status
          </span>
          <div className="flex items-center gap-1.5">
            {submission?.isOnlineNow ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Online
              </span>
            ) : submission?.status === "submitted" ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700 border border-blue-200">
                <CheckCircle2 className="h-3 w-3" />
                Submitted
              </span>
            ) : submission?.status === "graded" ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2 py-0.5 text-[11px] font-bold text-purple-700 border border-purple-200">
                🏅 Graded
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700 border border-amber-200">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                Draft Saved
              </span>
            )}
          </div>
        </div>

        {/* Cell 2: Active Lab Time */}
        <div className="p-3.5 flex flex-col justify-between shrink-0 min-w-[130px]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1 leading-none">
            <Clock className="h-3 w-3 text-slate-400" />
            Active Lab Time
          </span>
          <div className="text-sm font-extrabold text-slate-900 tracking-tight">
            {formatDurationSeconds(submission?.timeSpentSeconds || 0)}
          </div>
        </div>

        {/* Cell 3: Runs & Saves */}
        <div className="p-3.5 flex flex-col justify-between shrink-0 min-w-[135px]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1 leading-none">
            <Play className="h-3 w-3 text-slate-400" />
            Runs &amp; Saves
          </span>
          <div className="text-xs font-bold text-slate-800">
            <span className="font-extrabold text-indigo-950">{submission?.runCount || 0}</span>{" "}
            <span className="text-slate-500 font-medium">runs</span> ·{" "}
            <span className="font-extrabold text-indigo-950">{submission?.versions?.length || 0}</span>{" "}
            <span className="text-slate-500 font-medium">saves</span>
          </div>
        </div>

        {/* Cell 4: Current Action */}
        <div className="p-3.5 flex flex-col justify-between flex-1 min-w-[160px]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1 leading-none">
            <Activity className="h-3 w-3 text-slate-400" />
            Current Action
          </span>
          <div
            className="text-xs font-semibold text-slate-700 truncate"
            title={submission?.lastAction || "Workspace opened"}
          >
            {submission?.lastAction ? (
              <span className="inline-block rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-800 truncate max-w-full">
                {submission.lastAction}
              </span>
            ) : (
              <span className="text-slate-400">Workspace active</span>
            )}
          </div>
        </div>

        {/* Cell 5: Rubric Evaluation (In the exact SAME straight row!) */}
        {rubricHeaderCell && (
          <div className="p-3.5 flex items-center justify-between gap-3 shrink-0 min-w-[260px] lg:min-w-[280px] bg-slate-50/40 hover:bg-slate-50/80 transition">
            {rubricHeaderCell}
          </div>
        )}
      </div>
    </div>
  );

  const renderWorkspaceBody = () => {
    if (!submission || submission.isNotStarted) {
      return (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-xs">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 mb-3">
            <Clock className="h-6 w-6" />
          </div>
          <h4 className="text-sm font-bold text-slate-800">Student Has Not Started Yet</h4>
          <p className="mt-1 text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
            Live code, terminal runs, 3D geometry, queries, and activity logs appear here automatically as soon as the student opens their workspace.
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-4">

      {/* Tool-specific Live Preview */}
      {["web-sandbox", "html-css-js-studio"].includes(toolType) && inspectCode && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-800 bg-[#0d1117] p-4 shadow-md">
            <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Code2 className="h-3.5 w-3.5 text-indigo-400" />
              Live HTML / CSS / JS Code
            </div>
            <pre className="sleek-dark-scroll max-h-80 overflow-auto font-mono text-xs text-slate-100 leading-relaxed whitespace-pre-wrap">
              {inspectCode}
            </pre>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-[11px] font-bold text-slate-700 flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
              Live Web Output Preview
            </div>
            <iframe
              title="Student Web Preview"
              sandbox="allow-scripts"
              srcDoc={inspectCode}
              className="h-80 w-full border-0 bg-white"
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
        <div className="space-y-3">
          {/* View Mode & Utility Control Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Live Code &amp; Execution Output
              </span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                {submission.codeLanguage ? submission.codeLanguage.toUpperCase() : "CODE"}
              </span>
            </div>

            {/* View layout toggle: Stacked vs Split */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setViewMode("stacked")}
                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                  viewMode === "stacked"
                    ? "bg-slate-900 text-white shadow-2xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
                title="Stacked layout (Full width code on top, terminal on bottom)"
              >
                <Rows className="h-3 w-3" />
                <span>Stacked (Wide)</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("split")}
                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                  viewMode === "split"
                    ? "bg-slate-900 text-white shadow-2xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
                title="Split layout (Code on left, terminal on right)"
              >
                <Columns className="h-3 w-3" />
                <span>Split (Side-by-Side)</span>
              </button>
            </div>
          </div>

          <div
            className={`grid gap-3 ${
              viewMode === "split" ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1"
            }`}
          >
            {/* Source Code Window with modern IDE header */}
            <div className="rounded-2xl border border-slate-800 bg-[#0d1117] shadow-md overflow-hidden flex flex-col">
              <div className="flex items-center justify-between px-4 py-2.5 bg-[#161b22] border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]" />
                    <span className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]" />
                    <span className="w-2.5 h-2.5 rounded-full bg-[#27c93f]" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Code2 className="h-3.5 w-3.5 text-indigo-400" />
                    <span className="text-xs font-bold tracking-wider text-slate-200">
                      {submission.codeLanguage ? submission.codeLanguage.toUpperCase() : "SOURCE CODE"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="inline-flex items-center gap-1 rounded-md bg-slate-800/80 hover:bg-slate-700 px-2 py-0.5 text-[11px] font-medium text-slate-300 border border-slate-700 transition"
                    title="Copy student code to clipboard"
                  >
                    {copied ? (
                      <>
                        <Check className="h-3 w-3 text-emerald-400" />
                        <span className="text-emerald-400">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                    {submission.studentName || "Student"}
                  </span>
                </div>
              </div>

              {/* Code text area with smooth custom dark scrollbar */}
              <pre
                className={`sleek-dark-scroll p-4 overflow-auto font-mono text-[13px] text-slate-100 leading-relaxed whitespace-pre-wrap flex-1 ${
                  viewMode === "stacked" ? "min-h-[260px] max-h-[400px]" : "min-h-[320px] max-h-[460px]"
                }`}
              >
                {inspectCode || "(No code submitted yet)"}
              </pre>
            </div>

            {/* Console Output Window */}
            <div className="rounded-2xl border border-slate-800 bg-[#0a0d14] shadow-md overflow-hidden flex flex-col">
              <div className="flex items-center justify-between px-4 py-2.5 bg-[#131722] border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <Terminal className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-xs font-bold text-slate-200">Terminal / Output</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/70 border border-emerald-800/70 px-2 py-0.5 rounded">
                    Live Console
                  </span>
                </div>
              </div>

              {/* Terminal text area with smooth custom dark scrollbar */}
              <pre
                className={`sleek-dark-scroll p-4 overflow-auto font-mono text-xs text-emerald-300 leading-relaxed whitespace-pre-wrap flex-1 bg-black/40 ${
                  viewMode === "stacked" ? "min-h-[160px] max-h-[240px]" : "min-h-[320px] max-h-[460px]"
                }`}
              >
                {inspectOutput ? (
                  inspectOutput
                ) : (
                  <span className="text-slate-500 italic">
                    (No execution output yet - student has not clicked Run Code)
                  </span>
                )}
              </pre>
            </div>
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
    </div>
  );
};

  return (
    <div className="space-y-4">
      {/* Sleek Dark Scrollbar Inline CSS */}
      <style>{`
        .sleek-dark-scroll::-webkit-scrollbar {
          width: 7px;
          height: 7px;
        }
        .sleek-dark-scroll::-webkit-scrollbar-track {
          background: #0d1117;
        }
        .sleek-dark-scroll::-webkit-scrollbar-thumb {
          background: #30363d;
          border-radius: 4px;
        }
        .sleek-dark-scroll::-webkit-scrollbar-thumb:hover {
          background: #484f58;
        }
      `}</style>

      {/* Row 1: Unified 5-Cell Bar in the EXACT SAME STRAIGHT ROW! */}
      {renderUnifiedTopBar()}

      {/* Row 2: Code Editor (Full width when closed, split when open) */}
      {isRubricOpen ? (
        /* Expanded / Dropped Down State: Split Layout (8 cols code on left, 4 cols rubric on right) */
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 items-start">
          <div className="lg:col-span-8 xl:col-span-8 2xl:col-span-8 space-y-4 min-w-0">
            {renderWorkspaceBody()}
          </div>
          <div className="lg:col-span-4 xl:col-span-4 2xl:col-span-4 space-y-4 min-w-0">
            {rubricPanel}
          </div>
        </div>
      ) : (
        /* Collapsed / Dropdown Not Open: 100% FULL PAGE Wide Code */
        <div className="w-full">
          {renderWorkspaceBody()}
        </div>
      )}
    </div>
  );
};

export default StudentWorkInspector;

