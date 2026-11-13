import React, { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import axios from "../../api/axiosInstance";
import { getToolMeta } from "./toolCatalog";
import { getStudentToken, syncStudentActivity } from "./activitySync";

const LANG_FILENAMES = {
  cpp: "main.cpp",
  c: "main.c",
  python: "main.py",
  java: "Main.java",
  go: "main.go",
  rust: "main.rs",
  javascript: "main.js",
  typescript: "main.ts",
  php: "main.php",
  ruby: "main.rb",
  csharp: "Main.cs",
  bash: "script.sh",
};

const parseSplitWebFiles = (raw) => {
  try {
    const obj = JSON.parse(raw || "{}");
    if (obj && typeof obj === "object" && ("html" in obj || "css" in obj || "js" in obj)) {
      return {
        html: String(obj.html || ""),
        css: String(obj.css || ""),
        js: String(obj.js || ""),
      };
    }
  } catch {
    // plain HTML fallback
  }
  return { html: String(raw || ""), css: "", js: "" };
};

const buildConsoleBridgeScript = () => `<script>
(function(){
  var send = function(level, args){
    try {
      window.parent.postMessage({
        __edutechexConsole: true,
        level: level,
        text: Array.prototype.slice.call(args).map(function(a){
          try { return typeof a === "object" ? JSON.stringify(a) : String(a); } catch(e) { return String(a); }
        }).join(" ")
      }, "*");
    } catch(e){}
  };
  ["log","info","warn","error"].forEach(function(fn){
    var orig = console[fn];
    console[fn] = function(){ send(fn, arguments); if (orig) orig.apply(console, arguments); };
  });
  window.addEventListener("error", function(ev){ send("error", [ev.message]); });
})();
</script>`;

const CodeCompilerWorkspace = ({ assignment, initialSubmission, onBack, onUpdated }) => {
  const toolMeta = getToolMeta(assignment?.toolType || "cpp-compiler");
  const isSplitWebStudio = assignment?.toolType === "html-css-js-studio";
  const isWebMode =
    toolMeta.mode === "web" ||
    assignment?.toolType === "web-sandbox" ||
    isSplitWebStudio;

  const initialLang =
    initialSubmission?.codeLanguage ||
    assignment?.codeLanguage ||
    toolMeta.language ||
    "cpp";

  const initialCode =
    initialSubmission?.submittedCode ||
    assignment?.starterCode ||
    toolMeta.defaultCode ||
    "";

  const initialSplit = useMemo(() => parseSplitWebFiles(initialCode), [initialCode]);

  const [language, setLanguage] = useState(initialLang);
  const [code, setCode] = useState(initialCode);
  const [webTab, setWebTab] = useState("html");
  const [splitHtml, setSplitHtml] = useState(initialSplit.html);
  const [splitCss, setSplitCss] = useState(initialSplit.css);
  const [splitJs, setSplitJs] = useState(initialSplit.js);
  const [webLogs, setWebLogs] = useState([]);
  const [stdin, setStdin] = useState("");
  const [stdout, setStdout] = useState(initialSubmission?.codeOutput || "");
  const [stderr, setStderr] = useState("");
  const [compileError, setCompileError] = useState("");
  const [runnerLabel, setRunnerLabel] = useState("");
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [studentNotes, setStudentNotes] = useState(initialSubmission?.studentNotes || "");
  const [versionNote, setVersionNote] = useState("");
  const [submissionState, setSubmissionState] = useState(initialSubmission || null);
  const [webRefreshKey, setWebRefreshKey] = useState(0);

  const combinedWebHtml = useMemo(() => {
    if (!isWebMode) return "";
    if (isSplitWebStudio) {
      return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>${splitCss}</style>
</head>
<body>
${splitHtml}
${buildConsoleBridgeScript()}
<script>${splitJs}</script>
</body>
</html>`;
    }
    return code;
  }, [isWebMode, isSplitWebStudio, splitHtml, splitCss, splitJs, code]);

  const activeSubmittedCode = isSplitWebStudio ? combinedWebHtml : code;

  const webSrcDoc = useMemo(() => {
    if (!isWebMode) return "";
    if (isSplitWebStudio) return combinedWebHtml;
    const bridge = buildConsoleBridgeScript();
    if (code.includes("<head>")) return code.replace("<head>", `<head>${bridge}`);
    return `${bridge}${code}`;
  }, [code, isWebMode, isSplitWebStudio, combinedWebHtml]);

  useEffect(() => {
    if (!isWebMode) return undefined;
    const onMsg = (ev) => {
      if (ev.data && ev.data.__edutechexConsole) {
        setWebLogs((prev) => [...prev.slice(-39), { level: ev.data.level, text: ev.data.text }]);
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [isWebMode]);

  const latestRef = useRef({ code: activeSubmittedCode, language, stdout, stderr, compileError });
  useEffect(() => {
    latestRef.current = { code: activeSubmittedCode, language, stdout, stderr, compileError };
  }, [activeSubmittedCode, language, stdout, stderr, compileError]);

  useEffect(() => {
    if (!assignment?._id) return undefined;
    syncStudentActivity(assignment._id, {
      action: isWebMode ? "Opened HTML/Web Sandbox" : `Opened ${language.toUpperCase()} Compiler`,
      codeLanguage: isWebMode ? "html" : language,
      submittedCode: latestRef.current.code,
    });
    const timer = setInterval(() => {
      const cur = latestRef.current;
      const out = cur.stdout || cur.stderr || cur.compileError || "";
      syncStudentActivity(assignment._id, {
        action: isWebMode ? "Working in HTML/Web Studio" : `Working in ${cur.language.toUpperCase()}`,
        elapsedSeconds: 20,
        submittedCode: cur.code,
        codeLanguage: isWebMode ? "html" : cur.language,
        codeOutput: out,
        workSummary: isWebMode
          ? `HTML/CSS/JS (${cur.code.length} chars)`
          : `${cur.language.toUpperCase()} (${cur.code.split("\n").length} lines)`,
      });
    }, 20000);
    return () => clearInterval(timer);
  }, [assignment?._id, isWebMode, language]);

  const handleRunCode = async () => {
    if (isWebMode) {
      setWebLogs([]);
      setWebRefreshKey((k) => k + 1);
      const summary = "Rendered live HTML/CSS/JS preview.";
      setStdout(summary);
      syncStudentActivity(assignment?._id, {
        action: "Refreshed HTML/Web Preview",
        isRun: true,
        submittedCode: activeSubmittedCode,
        codeLanguage: "html",
        codeOutput: summary,
        workSummary: `HTML/CSS/JS (${activeSubmittedCode.length} chars)`,
      });
      return;
    }

    try {
      setRunning(true);
      setCompileError("");
      setStderr("");
      const token = getStudentToken();
      const res = await axios.post(
        "/api/daily-work/run-code",
        { language, code, stdin },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const nextOut = res.data.stdout || "";
      const nextErr = res.data.stderr || "";
      const nextCompErr = res.data.compileError || "";
      setStdout(nextOut);
      setStderr(nextErr);
      setCompileError(nextCompErr);
      setRunnerLabel(res.data.runner || "online-compiler");
      syncStudentActivity(assignment?._id, {
        action: `Ran ${language.toUpperCase()} Code`,
        detail: nextCompErr ? "Compiler returned errors" : "Executed successfully",
        isRun: true,
        submittedCode: code,
        codeLanguage: language,
        codeOutput: nextOut || nextErr || nextCompErr || "(no output)",
        workSummary: `${language.toUpperCase()} run · ${(nextOut || nextCompErr || "").slice(0, 120)}`,
      });
      if (nextCompErr) {
        toast.warning("Compilation returned errors/warnings");
      } else {
        toast.success("Executed successfully");
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to execute code");
    } finally {
      setRunning(false);
    }
  };

  const buildPayload = (isFinal = false) => {
    const fd = new FormData();
    fd.append("submittedCode", activeSubmittedCode);
    fd.append("codeLanguage", isWebMode ? "html" : language);
    fd.append("codeOutput", stdout || stderr || compileError || "");
    fd.append("studentNotes", studentNotes);
    fd.append(
      "versionNote",
      versionNote || (isFinal ? "Final Code Submission" : `Code Save (${language})`)
    );
    return fd;
  };

  const isSandboxMode = !assignment?._id;

  const handleSaveSnapshot = async () => {
    if (isSandboxMode) {
      toast.info("Practice Sandbox mode: run and test your code freely! Open an assigned task to save snapshots.");
      return;
    }
    try {
      setSaving(true);
      const token = getStudentToken();
      const res = await axios.post(
        `/api/daily-work/submissions/${assignment._id}/save`,
        buildPayload(false),
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
        }
      );
      setSubmissionState(res.data.submission);
      setVersionNote("");
      toast.success(`Saved snapshot v${res.data.submission?.versions?.length || 1}`);
      onUpdated && onUpdated(res.data.submission);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to save progress");
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (isSandboxMode) {
      toast.info("Practice Sandbox mode: open a partner-assigned task to submit work for grading.");
      return;
    }
    try {
      setSubmitting(true);
      const token = getStudentToken();
      const res = await axios.post(
        `/api/daily-work/submissions/${assignment._id}/submit`,
        buildPayload(true),
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
        }
      );
      setSubmissionState(res.data.submission);
      toast.success("Daily work submitted successfully!");
      onUpdated && onUpdated(res.data.submission);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Bar */}
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
              {toolMeta.name} · {toolMeta.license}
            </span>
          </div>
          <p className="text-xs text-slate-500">
            {assignment?.category} · {assignment?.difficulty}
            {assignment?.dueDate ? ` · Due ${new Date(assignment.dueDate).toLocaleString()}` : ""}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!isWebMode && (
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700"
            >
              <option value="cpp">C++20 (GCC)</option>
              <option value="c">C17 (GCC)</option>
              <option value="python">Python 3</option>
              <option value="java">Java (OpenJDK)</option>
              <option value="go">Go</option>
              <option value="rust">Rust</option>
              <option value="javascript">JavaScript (Node)</option>
              <option value="typescript">TypeScript</option>
              <option value="php">PHP 8</option>
              <option value="ruby">Ruby 3</option>
              <option value="csharp">C# (Mono / .NET)</option>
              <option value="bash">Bash / Linux Shell</option>
            </select>
          )}

          <button
            type="button"
            disabled={running}
            onClick={handleRunCode}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {running ? "Compiling & Running..." : isWebMode ? "▶ Refresh Preview" : "▶ Run Code"}
          </button>

          <button
            type="button"
            disabled={saving}
            onClick={handleSaveSnapshot}
            title={isSandboxMode ? "Practice Sandbox: open a partner-assigned task to save snapshots" : ""}
            className="rounded-lg bg-slate-800 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : isSandboxMode ? "Save (Assigned Only)" : "Save Snapshot"}
          </button>

          <button
            type="button"
            disabled={submitting}
            onClick={handleSubmit}
            title={isSandboxMode ? "Practice Sandbox: open a partner-assigned task to submit work" : ""}
            className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? "Submitting..." : isSandboxMode ? "Submit (Assigned Only)" : "Submit Work"}
          </button>
        </div>
      </div>

      {/* Task Instructions */}
      {assignment?.instructions && (
        <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-4 text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
          <span className="font-semibold text-blue-900">Task Instructions: </span>
          {assignment.instructions}
        </div>
      )}

      {/* Split Editor & Output/Preview */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="lg:col-span-7 flex flex-col rounded-xl border border-slate-700 bg-slate-950 overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-4 py-2 text-xs text-slate-300">
            {isSplitWebStudio ? (
              <div className="flex items-center gap-1.5">
                {[
                  ["html", "index.html"],
                  ["css", "styles.css"],
                  ["js", "app.js"],
                ].map(([t, label]) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setWebTab(t)}
                    className={`rounded px-2.5 py-1 font-mono text-[11px] font-semibold ${
                      webTab === t ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-slate-800"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            ) : (
              <span className="font-mono font-semibold">
                {isWebMode ? "index.html" : LANG_FILENAMES[language] || "main.cpp"}
              </span>
            )}
            <span className="text-[11px] text-slate-400">Free Open-Source Workspace</span>
          </div>
          {isSplitWebStudio ? (
            <textarea
              value={webTab === "html" ? splitHtml : webTab === "css" ? splitCss : splitJs}
              onChange={(e) => {
                const v = e.target.value;
                if (webTab === "html") setSplitHtml(v);
                else if (webTab === "css") setSplitCss(v);
                else setSplitJs(v);
              }}
              spellCheck={false}
              className="min-h-[430px] w-full flex-1 resize-y bg-slate-950 p-4 font-mono text-xs leading-6 text-slate-100 focus:outline-none"
              placeholder={`Write ${webTab.toUpperCase()} code here...`}
            />
          ) : (
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              spellCheck={false}
              className="min-h-[430px] w-full flex-1 resize-y bg-slate-950 p-4 font-mono text-xs leading-6 text-slate-100 focus:outline-none"
              placeholder="Write your code here..."
            />
          )}
        </div>

        <div className="lg:col-span-5 flex flex-col gap-3">
          {isWebMode ? (
            <>
              <div className="flex-1 overflow-hidden rounded-xl border border-slate-300 bg-white">
                <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
                  Live Sandboxed HTML Output
                </div>
                <iframe
                  key={webRefreshKey}
                  title="Web Sandbox Preview"
                  sandbox="allow-scripts"
                  srcDoc={webSrcDoc}
                  className="h-[310px] w-full bg-white"
                />
              </div>
              <div className="rounded-xl border border-slate-700 bg-slate-950 p-3 text-xs">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-semibold uppercase text-slate-400">
                    Browser Console Output
                  </span>
                  {webLogs.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setWebLogs([])}
                      className="text-[10px] text-slate-400 hover:text-white"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <div className="h-24 overflow-auto space-y-0.5 font-mono text-[11px]">
                  {webLogs.length === 0 ? (
                    <span className="text-slate-500">console.log(...) messages appear here.</span>
                  ) : (
                    webLogs.map((l, idx) => (
                      <div
                        key={idx}
                        className={
                          l.level === "error"
                            ? "text-rose-400"
                            : l.level === "warn"
                              ? "text-amber-300"
                              : "text-emerald-300"
                        }
                      >
                        [{l.level}] {l.text}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="rounded-xl border border-slate-700 bg-slate-900 p-3 text-slate-100">
                <label className="block text-[11px] font-semibold uppercase text-slate-400 mb-1.5">
                  Standard Input (stdin)
                </label>
                <textarea
                  rows={3}
                  value={stdin}
                  onChange={(e) => setStdin(e.target.value)}
                  placeholder="Optional test input lines..."
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 p-2.5 font-mono text-xs text-slate-100 focus:outline-none"
                />
              </div>

              <div className="flex-1 rounded-xl border border-slate-700 bg-slate-950 p-3 text-slate-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-semibold uppercase text-slate-400">
                    Compiler &amp; Program Output
                  </span>
                  {runnerLabel && (
                    <span className="text-[10px] text-emerald-400 font-mono">{runnerLabel}</span>
                  )}
                </div>

                {compileError && (
                  <pre className="mb-2 max-h-36 overflow-auto rounded bg-rose-950/60 p-2.5 font-mono text-xs text-rose-300 whitespace-pre-wrap">
                    {compileError}
                  </pre>
                )}
                {stderr && (
                  <pre className="mb-2 max-h-28 overflow-auto rounded bg-amber-950/60 p-2.5 font-mono text-xs text-amber-300 whitespace-pre-wrap">
                    {stderr}
                  </pre>
                )}
                <pre className="min-h-[210px] max-h-64 overflow-auto rounded bg-slate-900 p-3 font-mono text-xs text-emerald-300 whitespace-pre-wrap">
                  {stdout || (compileError || stderr ? "" : "Click 'Run Code' to see output...")}
                </pre>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Notes, Auto-Checks & Version History */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2.5">
          <h4 className="text-sm font-bold text-slate-900">Work Notes &amp; Snapshot Label</h4>
          <input
            type="text"
            placeholder="Snapshot note (e.g., Fixed loop edge case)"
            value={versionNote}
            onChange={(e) => setVersionNote(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
          />
          <textarea
            rows={2}
            placeholder="Notes for partner / instructor..."
            value={studentNotes}
            onChange={(e) => setStudentNotes(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
          />
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-slate-900">Auto-Checks &amp; Version History</h4>
            {submissionState?.status && (
              <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] font-semibold uppercase text-blue-700">
                {submissionState.status}
              </span>
            )}
          </div>

          {submissionState?.autoCheckResults?.checks?.length > 0 ? (
            <div className="space-y-1">
              {submissionState.autoCheckResults.checks.map((c, idx) => (
                <div
                  key={idx}
                  className={`rounded-lg px-2.5 py-1.5 text-xs ${
                    c.passed ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"
                  }`}
                >
                  {c.passed ? "✓" : "✕"} {c.name}: {c.actual}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500">
              {assignment?.expectedOutput
                ? "Run your code and submit to check output automatically."
                : "Save snapshots anytime; click Submit Work when ready for partner review."}
            </p>
          )}

          {submissionState?.versions?.length > 0 && (
            <div className="pt-2 border-t border-slate-100 max-h-24 overflow-y-auto space-y-1">
              {[...submissionState.versions].reverse().map((v) => (
                <div
                  key={v._id || v.versionNumber}
                  className="flex items-center justify-between text-[11px] text-slate-600"
                >
                  <span>
                    v{v.versionNumber}: {v.note}
                  </span>
                  {v.submittedCode && (
                    <button
                      type="button"
                      onClick={() => {
                        setCode(v.submittedCode);
                        if (isSplitWebStudio) {
                          const parsed = parseSplitWebFiles(v.submittedCode);
                          setSplitHtml(parsed.html);
                          setSplitCss(parsed.css);
                          setSplitJs(parsed.js);
                        }
                        if (v.codeOutput) setStdout(v.codeOutput);
                        toast.info(`Restored code from v${v.versionNumber}`);
                      }}
                      className="text-blue-600 font-medium hover:underline"
                    >
                      Restore
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CodeCompilerWorkspace;

