import React, { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import {
  Play,
  RotateCw,
  Send,
  ArrowLeft,
  Code2,
  AlertTriangle,
  Clock,
  FileCode,
  Trash2,
  Maximize,
  Maximize2,
  Minimize2,
  Columns,
} from "lucide-react";
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

// Singleton Web Worker instance for Pyodide (Python WebAssembly)
// Offloads Python execution to the student's browser CPU for unlimited concurrency (100+ students)
let pyWorkerInstance = null;
const pyPendingRequests = new Map();

function getPyodideWorker() {
  if (typeof window === "undefined" || typeof Worker === "undefined") return null;
  if (pyWorkerInstance) return pyWorkerInstance;
  try {
    pyWorkerInstance = new Worker("/pyodideWorker.js");
    pyWorkerInstance.onmessage = (e) => {
      const data = e.data || {};
      if (data.id && pyPendingRequests.has(data.id)) {
        const { resolve, reject } = pyPendingRequests.get(data.id);
        pyPendingRequests.delete(data.id);
        if (data.success) {
          resolve(data);
        } else {
          reject(new Error(data.error || "Pyodide execution failed"));
        }
      }
    };
    pyWorkerInstance.onerror = () => {
      pyWorkerInstance = null;
    };
  } catch (err) {
    pyWorkerInstance = null;
  }
  return pyWorkerInstance;
}

function runPythonInBrowser(code, stdin) {
  return new Promise((resolve, reject) => {
    const worker = getPyodideWorker();
    if (!worker) {
      return reject(new Error("Web Worker not supported"));
    }
    const id = `py_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const timer = setTimeout(() => {
      if (pyPendingRequests.has(id)) {
        pyPendingRequests.delete(id);
        reject(new Error("Client Python execution timeout"));
      }
    }, 14000);

    pyPendingRequests.set(id, {
      resolve: (data) => {
        clearTimeout(timer);
        resolve(data);
      },
      reject: (err) => {
        clearTimeout(timer);
        reject(err);
      },
    });

    worker.postMessage({ id, code, stdin });
  });
}

const LANG_NAME_LABELS = {
  cpp: "C++20 (GCC)",
  c: "C17 (GCC)",
  python: "Python 3",
  py: "Python 3",
  java: "Java (OpenJDK)",
  go: "Go",
  rust: "Rust",
  javascript: "JavaScript (Node)",
  js: "JavaScript (Node)",
  typescript: "TypeScript",
  ts: "TypeScript",
  php: "PHP 8",
  ruby: "Ruby 3",
  rb: "Ruby 3",
  csharp: "C# (Mono / .NET)",
  cs: "C# (Mono / .NET)",
  bash: "Bash / Linux Shell",
  sh: "Bash / Linux Shell",
};

const LANG_DISPLAY = {
  cpp: "C++20 (GCC)",
  c: "C17 (GCC)",
  python: "Python 3.11",
  java: "Java 21 (OpenJDK)",
  go: "Go 1.22",
  rust: "Rust 1.77",
  javascript: "Node.js 20",
  typescript: "TypeScript 5.4",
  php: "PHP 8.3",
  ruby: "Ruby 3.3",
  csharp: "C# (.NET)",
  bash: "Bash / Linux Shell",
};

const DEFAULT_LANG_TEMPLATES = {
  cpp: `#include <iostream>\nusing namespace std;\n\nint main() {\n    cout << "Hello from C++20!" << endl;\n    return 0;\n}\n`,
  c: `#include <stdio.h>\n\nint main() {\n    printf("Hello from C17!\\n");\n    return 0;\n}\n`,
  python: `# Python 3\ndef solve():\n    print("Hello from Python 3!")\n\nif __name__ == "__main__":\n    solve()\n`,
  java: `import java.util.*;\n\npublic class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello from Java!");\n    }\n}\n`,
  go: `package main\n\nimport "fmt"\n\nfunc main() {\n    fmt.Println("Hello from Go!")\n}\n`,
  rust: `fn main() {\n    println!("Hello from Rust!");\n}\n`,
  javascript: `console.log("Hello from Node.js!");\n`,
  typescript: `const msg: string = "Hello from TypeScript!";\nconsole.log(msg);\n`,
  php: `<?php\necho "Hello from PHP!\\n";\n`,
  ruby: `puts "Hello from Ruby!"\n`,
  csharp: `using System;\n\nclass Program {\n    static void Main() {\n        Console.WriteLine("Hello from C#!");\n    }\n}\n`,
  bash: `#!/usr/bin/env bash\necho "Hello from Bash!"\n`,
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

  const [language] = useState(initialLang);
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
  const [hasRun, setHasRun] = useState(Boolean(initialSubmission?.codeOutput));
  const [submitting, setSubmitting] = useState(false);
  const studentNotes = initialSubmission?.studentNotes || "";
  const versionNote = "";
  const [, setSubmissionState] = useState(initialSubmission || null);
  const [webRefreshKey, setWebRefreshKey] = useState(0);
  const [rightPanelTab, setRightPanelTab] = useState("output");
  const [screenLayout, setScreenLayout] = useState("split"); // "split" | "editor" | "output"
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen]);

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

  const handleResetTemplate = () => {
    const template = DEFAULT_LANG_TEMPLATES[language] || toolMeta.defaultCode || "";
    if (template) {
      setCode(template);
      setHasRun(false);
      setStdout("");
      setStderr("");
      setCompileError("");
      toast.info(`Reset to ${LANG_DISPLAY[language] || language} template`);
    }
  };

  const handleRunCode = async () => {
    if (!code.trim() && !isWebMode) {
      toast.warning("Please write some code before running");
      return;
    }

    if (screenLayout === "editor") {
      setScreenLayout("split");
    }

    if (isWebMode) {
      setWebLogs([]);
      setWebRefreshKey((k) => k + 1);
      const summary = "Rendered live HTML/CSS/JS preview.";
      setStdout(summary);
      setHasRun(true);
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

    if (language === "python" || language === "py") {
      try {
        setRunning(true);
        setCompileError("");
        setStderr("");
        // 100+ concurrent students run Python 100% in-browser via Pyodide WebAssembly
        const clientRes = await runPythonInBrowser(code, stdin);
        const nextOut = clientRes.stdout || "";
        const nextErr = clientRes.stderr || "";
        setStdout(nextOut);
        setStderr(nextErr);
        setCompileError("");
        setHasRun(true);
        setRunnerLabel(clientRes.runner || "Pyodide WASM (Client)");
        setRightPanelTab("output");
        syncStudentActivity(assignment?._id, {
          action: "Ran PYTHON Code",
          detail: nextErr ? "Python returned stderr" : "Executed successfully in browser",
          isRun: true,
          submittedCode: code,
          codeLanguage: "python",
          codeOutput: nextOut || nextErr || "(no output)",
          workSummary: `PYTHON run · ${(nextOut || nextErr || "").slice(0, 120)}`,
        });
        if (nextErr) {
          toast.warning("Execution completed with stderr");
        } else {
          toast.success("Executed locally in browser (WASM)");
        }
        setRunning(false);
        return;
      } catch (clientErr) {
        console.warn("Pyodide in-browser execution fell back to server:", clientErr.message);
        // Seamlessly falls through to backend server API
      }
    }

    try {
      setRunning(true);
      setCompileError("");
      setStderr("");
      const token = getStudentToken();
      const res = await axios.post(
        "/api/daily-work/run-code",
        { language, code, stdin },
        token ? { headers: { Authorization: `Bearer ${token}` } } : {}
      );
      const nextOut = res.data.stdout || "";
      const nextErr = res.data.stderr || "";
      const nextCompErr = res.data.compileError || "";
      setStdout(nextOut);
      setStderr(nextErr);
      setCompileError(nextCompErr);
      setHasRun(true);
      setRunnerLabel(res.data.runner || "online-compiler");
      setRightPanelTab("output");
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

  const handleSubmit = async () => {
    if (!activeSubmittedCode || !activeSubmittedCode.trim()) {
      toast.warning("Please write some code before submitting your work.");
      return;
    }

    if (isSandboxMode) {
      try {
        localStorage.setItem(`skillnaav_sandbox_submitted_${language}`, activeSubmittedCode);
        toast.success(`Practice work submitted and verified for ${LANG_DISPLAY[language] || language}!`);
        setTimeout(() => {
          if (onBack) onBack();
        }, 1200);
      } catch {
        toast.success("Practice work submitted successfully!");
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
      const res = await axios.post(
        `/api/daily-work/submissions/${assignment._id}/submit`,
        buildPayload(true),
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSubmissionState(res.data.submission);
      toast.success("Daily work submitted successfully!");
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
      {/* Top Bar - Modern EduTechEx IDE Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#0f172a] via-[#1e1b4b] to-[#312e81] px-4 py-2.5 sm:px-5 sm:py-3 text-white shadow-lg border border-slate-800">
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl" />

        <div className="relative z-10 flex flex-wrap items-center justify-between gap-3">
          {/* Left: Navigation & Task Info */}
          <div className="min-w-0 max-w-xl">
            <button
              type="button"
              onClick={onBack}
              className="group inline-flex items-center gap-1.5 text-[11px] font-semibold text-indigo-300 hover:text-white transition-colors mb-0.5"
            >
              <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
              <span>Back to Work Space</span>
            </button>

            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold tracking-tight text-white truncate">
                {assignment?.title || toolMeta.name}
              </h2>
              <span className="inline-flex items-center gap-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 px-2 py-0.5 text-[10px] font-semibold text-indigo-200">
                <Code2 className="h-3 w-3 text-indigo-300" />
                {toolMeta.name}
              </span>
              <span className="rounded-full bg-slate-800/80 border border-slate-700/80 px-2 py-0.5 text-[9px] font-medium text-slate-300">
                {toolMeta.license}
              </span>
            </div>

            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-indigo-200/80">
              {assignment?.category && (
                <span className="font-medium text-slate-300">{assignment.category}</span>
              )}
              {assignment?.difficulty && (
                <>
                  <span className="text-slate-500">·</span>
                  <span className="capitalize text-slate-300">{assignment.difficulty}</span>
                </>
              )}
              {assignment?.dueDate && (
                <>
                  <span className="text-slate-500">·</span>
                  <span className="inline-flex items-center gap-1 text-indigo-200">
                    <Clock className="h-3 w-3" />
                    Due {new Date(assignment.dueDate).toLocaleDateString()}
                  </span>
                </>
              )}
              {isSandboxMode && (
                <span className="rounded-md bg-amber-400/20 border border-amber-400/30 px-1.5 py-0.5 text-[9px] font-semibold text-amber-200">
                  Practice Sandbox Mode
                </span>
              )}
            </div>
          </div>

          {/* Right: Actions & Language Selector */}
          <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap shrink-0">
            {!isWebMode && (
              <div className="inline-flex h-8 shrink-0 items-center rounded-lg border border-white/20 bg-slate-900/95 px-3 text-xs font-semibold text-white shadow-inner backdrop-blur-sm">
                <span>
                  {LANG_NAME_LABELS[language?.toLowerCase()] || LANG_DISPLAY[language] || language?.toUpperCase()}
                </span>
              </div>
            )}

            {/* Run Code / Refresh Preview Button */}
            <button
              type="button"
              disabled={running}
              onClick={handleRunCode}
              className="inline-flex h-8 shrink-0 whitespace-nowrap items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 px-3 text-xs font-semibold text-white shadow-sm transition hover:from-emerald-600 hover:to-teal-700 active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
            >
              {running ? (
                <>
                  <RotateCw className="h-3.5 w-3.5 animate-spin" />
                  <span>Compiling &amp; Running...</span>
                </>
              ) : isWebMode ? (
                <>
                  <RotateCw className="h-3.5 w-3.5" />
                  <span>Refresh Preview</span>
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5 fill-current" />
                  <span>Run Code</span>
                </>
              )}
            </button>

            {/* Submit Work Button */}
            <button
              type="button"
              disabled={submitting}
              onClick={handleSubmit}
              className="inline-flex h-8 shrink-0 whitespace-nowrap items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-3 text-xs font-semibold text-white shadow-sm transition hover:from-blue-700 hover:to-indigo-700 active:scale-95 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <RotateCw className="h-3.5 w-3.5 animate-spin" />
                  <span>Submitting...</span>
                </>
              ) : (
                <>
                  <Send className="h-3.5 w-3.5" />
                  <span>Submit Work</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Task Instructions */}
      {assignment?.instructions && (
        <div className="rounded-2xl border border-indigo-100/90 bg-gradient-to-br from-indigo-50/70 via-white to-purple-50/40 p-4 sm:p-5 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-950 mb-2">
            <div className="flex h-5 w-5 items-center justify-center rounded-md bg-indigo-600 text-[11px] text-white font-bold shadow-sm">
              📋
            </div>
            <span>Assignment Guidelines &amp; Requirements</span>
          </div>
          <div className="text-xs sm:text-sm text-slate-700 whitespace-pre-wrap leading-relaxed pl-7">
            {assignment.instructions}
          </div>
        </div>
      )}

      {/* Split Editor & Output/Preview */}
      <div
        className={`${
          isFullscreen
            ? "fixed inset-0 z-50 bg-[#07090e] p-3 sm:p-5 flex flex-col h-screen overflow-y-auto"
            : ""
        }`}
      >
        {isFullscreen && (
          <div className="flex items-center justify-between bg-[#161b22] border border-slate-800 rounded-xl px-4 py-2 mb-3 text-xs text-slate-300">
            <span className="font-semibold text-white flex items-center gap-2">
              <Code2 className="h-4 w-4 text-indigo-400" />
              {screenLayout === "output"
                ? "Fullscreen Terminal & Console Output"
                : screenLayout === "editor"
                ? "Fullscreen Code Editor"
                : "Fullscreen Coding IDE & Console"}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setScreenLayout(screenLayout === "split" ? "output" : "split")}
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition"
              >
                <Columns className="h-3.5 w-3.5 text-indigo-400" />
                <span>{screenLayout === "split" ? "Focus Console" : "Split View"}</span>
              </button>
              <button
                type="button"
                onClick={() => setIsFullscreen(false)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1 text-xs font-semibold text-white hover:bg-indigo-700 transition"
              >
                <Minimize2 className="h-3.5 w-3.5" />
                <span>Exit Fullscreen (Esc)</span>
              </button>
            </div>
          </div>
        )}

        <div className={`grid grid-cols-1 gap-4 ${
          screenLayout === "editor"
            ? "grid-cols-1"
            : screenLayout === "output"
              ? "grid-cols-1"
              : "lg:grid-cols-12"
        } ${isFullscreen ? "flex-1" : ""}`}>
          {/* Minimized Editor Bar (shown when Output is Maximized) */}
          {screenLayout === "output" && (
            <div className="flex items-center justify-between rounded-2xl border border-slate-800 bg-[#161b22] px-4 py-3 text-xs text-slate-300 shadow-sm">
              <div className="flex items-center gap-2.5">
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-rose-500/80" />
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-500/80" />
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
                </div>
                <Code2 className="h-4 w-4 text-indigo-400 ml-1" />
                <span className="font-semibold text-slate-200">
                  Code Editor Minimized ({isWebMode ? "Web Studio" : LANG_FILENAMES[language] || "main.cpp"})
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setScreenLayout("split")}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition"
                >
                  <Columns className="h-3.5 w-3.5 text-indigo-400" />
                  <span>Split View</span>
                </button>
                <button
                  type="button"
                  onClick={() => setScreenLayout("editor")}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition"
                >
                  <Maximize2 className="h-3.5 w-3.5 text-indigo-400" />
                  <span>Maximize Editor</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 transition shadow-sm"
                  title={isFullscreen ? "Exit Fullscreen" : "Full Screen Console"}
                >
                  {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize className="h-3.5 w-3.5" />}
                  <span>{isFullscreen ? "Exit Fullscreen" : "Full Screen"}</span>
                </button>
              </div>
            </div>
          )}

          {/* Left: Code Editor with Mac-style IDE chrome */}
          {screenLayout !== "output" && (
            <div className={`${screenLayout === "editor" ? "col-span-1" : "lg:col-span-7"} flex flex-col rounded-2xl border border-slate-800 bg-[#0d1117] shadow-lg overflow-hidden`}>
          {/* Window Chrome Header */}
          <div className="flex items-center justify-between gap-3 border-b border-slate-800/80 bg-[#161b22] px-4 py-2.5 text-xs text-slate-300">
            <div className="flex items-center gap-3 shrink-0">
              {/* macOS window dots with active minimize / maximize controls */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setScreenLayout("split")}
                  title="Reset 50/50 Split View (Red)"
                  className="h-2.5 w-2.5 rounded-full bg-rose-500/80 hover:bg-rose-500 transition-transform hover:scale-125 cursor-pointer"
                />
                <button
                  type="button"
                  onClick={() => setScreenLayout(screenLayout === "output" ? "split" : "output")}
                  title={screenLayout === "output" ? "Restore Split View" : "Minimize Editor / Maximize Output (Yellow)"}
                  className="h-2.5 w-2.5 rounded-full bg-amber-500/80 hover:bg-amber-500 transition-transform hover:scale-125 cursor-pointer"
                />
                <button
                  type="button"
                  onClick={() => setScreenLayout(screenLayout === "editor" ? "split" : "editor")}
                  title={screenLayout === "editor" ? "Restore Split View" : "Maximize Editor Full Width (Green)"}
                  className="h-2.5 w-2.5 rounded-full bg-emerald-500/80 hover:bg-emerald-500 transition-transform hover:scale-125 cursor-pointer"
                />
              </div>

              {/* Tab / Filename */}
              {isSplitWebStudio ? (
                <div className="flex items-center gap-1 ml-2">
                  {[
                    ["html", "index.html"],
                    ["css", "styles.css"],
                    ["js", "app.js"],
                  ].map(([t, label]) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setWebTab(t)}
                      className={`rounded-lg px-2.5 py-1 font-mono text-[11px] font-semibold transition ${
                        webTab === t
                          ? "bg-indigo-600 text-white shadow-sm"
                          : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="inline-flex items-center gap-1.5 rounded-md bg-[#0d1117] px-2.5 py-1 border border-slate-800 text-slate-200 font-mono text-[11px] font-semibold">
                  <FileCode className="h-3 w-3 text-indigo-400" />
                  <span>{isWebMode ? "index.html" : LANG_FILENAMES[language] || "main.cpp"}</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0 ml-auto">
              <span className="flex items-center gap-1.5 text-[10px] font-medium text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Auto-Sync
              </span>
              <span className="text-[10px] text-slate-500">|</span>
              <span className="text-[10px] text-slate-400 font-mono">
                {isWebMode ? "Web Studio" : LANG_DISPLAY[language] || language.toUpperCase()}
              </span>
              {!isWebMode && (
                <button
                  type="button"
                  onClick={handleResetTemplate}
                  className="inline-flex items-center gap-1 rounded-md bg-slate-800/90 hover:bg-slate-700 border border-slate-700/80 px-2 py-0.5 text-[10px] font-semibold text-slate-300 transition"
                  title={`Reset editor to ${LANG_DISPLAY[language] || language} starter template`}
                >
                  <RotateCw className="h-2.5 w-2.5" />
                  <span>Reset</span>
                </button>
              )}
              <div className="flex items-center gap-1 border-l border-slate-700/80 pl-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setScreenLayout(screenLayout === "editor" ? "split" : "editor")}
                  className={`rounded-md p-1 transition ${
                    screenLayout === "editor"
                      ? "bg-indigo-600 text-white"
                      : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                  }`}
                  title={screenLayout === "editor" ? "Restore Split View" : "Maximize Editor Full Width"}
                >
                  {screenLayout === "editor" ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                </button>
                <button
                  type="button"
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  className={`rounded-md p-1 transition ${
                    isFullscreen
                      ? "bg-indigo-600 text-white"
                      : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                  }`}
                  title={isFullscreen ? "Exit Fullscreen" : "Full Screen Editor"}
                >
                  {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
          </div>

          {/* Editor Content */}
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
              className={`${screenLayout === "editor" ? "min-h-[580px]" : "min-h-[460px]"} w-full flex-1 resize-y bg-[#0d1117] p-4 font-mono text-xs leading-6 text-slate-100 placeholder-slate-600 focus:outline-none`}
              placeholder={`Write ${webTab.toUpperCase()} code here...`}
            />
          ) : (
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              spellCheck={false}
              className={`${screenLayout === "editor" ? "min-h-[580px]" : "min-h-[460px]"} w-full flex-1 resize-y bg-[#0d1117] p-4 font-mono text-xs leading-6 text-slate-100 placeholder-slate-600 focus:outline-none selection:bg-indigo-900 selection:text-white`}
              placeholder="Write your code here..."
            />
          )}
        </div>
      )}

      {/* Minimized Output Bar (shown when Editor is Maximized) */}
      {screenLayout === "editor" && (
        <div className="flex items-center justify-between rounded-2xl border border-slate-800 bg-[#161b22] px-4 py-3 text-xs text-slate-300 shadow-sm">
          <div className="flex items-center gap-2.5">
            <span className="font-semibold text-slate-200">Terminal &amp; Console Output Minimized</span>
            {stdout && !compileError && (
              <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                output ready
              </span>
            )}
            {compileError && (
              <span className="rounded-full bg-rose-500/20 px-2 py-0.5 text-[10px] font-semibold text-rose-400">
                error
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setScreenLayout("split")}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition active:scale-95"
            >
              <Columns className="h-3.5 w-3.5 text-indigo-400" />
              <span>Split View</span>
            </button>
            <button
              type="button"
              onClick={() => setScreenLayout("output")}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition active:scale-95"
            >
              <Maximize2 className="h-3.5 w-3.5 text-indigo-400" />
              <span>Maximize Console</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setScreenLayout("output");
                setIsFullscreen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 transition active:scale-95 shadow-sm"
              title="Open Terminal & Console in Full Screen"
            >
              <Maximize className="h-3.5 w-3.5" />
              <span>Full Screen</span>
            </button>
          </div>
        </div>
      )}

      {/* Right: Output / Web Preview */}
      {screenLayout !== "editor" && (
        <div className={`${screenLayout === "output" ? "col-span-1" : "lg:col-span-5"} flex flex-col gap-3`}>
          {isWebMode ? (
            <>
              {/* Live Web Sandbox */}
              <div className="flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm flex flex-col">
                <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/90 px-3.5 py-2.5 text-xs font-semibold text-slate-700">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    Live Sandboxed HTML Preview
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setWebRefreshKey((k) => k + 1)}
                      className="text-[11px] text-indigo-600 hover:text-indigo-800 font-medium"
                    >
                      Reload Frame
                    </button>
                    <div className="flex items-center gap-1 border-l border-slate-300 pl-2">
                      <button
                        type="button"
                        onClick={() => setScreenLayout(screenLayout === "output" ? "split" : "output")}
                        className={`rounded-md p-1 transition ${
                          screenLayout === "output"
                            ? "bg-indigo-600 text-white"
                            : "text-slate-600 hover:bg-slate-200"
                        }`}
                        title={screenLayout === "output" ? "Restore Split Screen" : "Maximize Web Preview"}
                      >
                        {screenLayout === "output" ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setScreenLayout("output");
                          setIsFullscreen(!isFullscreen);
                        }}
                        className={`rounded-md p-1 transition ${
                          isFullscreen
                            ? "bg-indigo-600 text-white"
                            : "text-slate-600 hover:bg-slate-200"
                        }`}
                        title={isFullscreen ? "Exit Fullscreen" : "Full Screen Web Preview"}
                      >
                        {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>
                <iframe
                  key={webRefreshKey}
                  title="Web Sandbox Preview"
                  sandbox="allow-scripts"
                  srcDoc={webSrcDoc}
                  className="min-h-[320px] w-full flex-1 bg-white"
                />
              </div>

              {/* Browser Console Logs */}
              <div className="rounded-2xl border border-slate-800 bg-[#0d1117] p-3.5 text-xs shadow-md">
                <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Browser Console
                    </span>
                    {webLogs.length > 0 && (
                      <span className="rounded-full bg-indigo-500/20 px-2 py-0.2 text-[10px] font-semibold text-indigo-300">
                        {webLogs.length}
                      </span>
                    )}
                  </div>
                  {webLogs.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setWebLogs([])}
                      className="text-[11px] text-slate-400 hover:text-slate-200"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <div className="h-28 overflow-auto space-y-1 font-mono text-[11px]">
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
            /* Compiler Mode: Tabbed Console Output & Custom Input */
            <div className="flex-1 flex flex-col rounded-2xl border border-slate-800 bg-[#0a0d14] shadow-lg overflow-hidden">
              {/* Tab Header */}
              <div className="flex items-center justify-between gap-3 border-b border-slate-800/80 bg-[#161b22] px-3.5 py-2 text-xs">
                {/* Left Tabs */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => setRightPanelTab("output")}
                    className={`shrink-0 whitespace-nowrap inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      rightPanelTab === "output"
                        ? "bg-slate-800 text-white shadow-sm"
                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
                    }`}
                  >
                    <span>Console Output</span>
                    {stdout && !compileError && (
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />
                    )}
                    {compileError && (
                      <span className="h-1.5 w-1.5 rounded-full bg-rose-400 shrink-0" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setRightPanelTab("stdin")}
                    className={`shrink-0 whitespace-nowrap inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      rightPanelTab === "stdin"
                        ? "bg-slate-800 text-white shadow-sm"
                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
                    }`}
                  >
                    <span>Input (stdin)</span>
                    {stdin.trim() && (
                      <span className="shrink-0 rounded-full bg-indigo-500/30 px-1.5 py-0.2 text-[9px] font-bold text-indigo-300">
                        active
                      </span>
                    )}
                  </button>
                </div>

                {/* Right Controls */}
                <div className="flex items-center gap-2 shrink-0 ml-auto">
                  {(stdout || stderr || compileError || hasRun) && rightPanelTab === "output" && (
                    <button
                      type="button"
                      onClick={() => {
                        setStdout("");
                        setStderr("");
                        setCompileError("");
                        setHasRun(false);
                      }}
                      className="text-[11px] text-slate-400 hover:text-rose-400 hover:bg-slate-800/80 p-1.5 rounded-lg flex items-center gap-1 shrink-0 transition"
                      title="Clear Output"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Clear</span>
                    </button>
                  )}
                  <div className="flex items-center gap-1 border-l border-slate-700/80 pl-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setScreenLayout(screenLayout === "output" ? "split" : "output")}
                      className={`rounded-md p-1 transition ${
                        screenLayout === "output"
                          ? "bg-indigo-600 text-white"
                          : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                      }`}
                      title={screenLayout === "output" ? "Restore Split View" : "Maximize Console Screen"}
                    >
                      {screenLayout === "output" ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setScreenLayout("output");
                        setIsFullscreen(!isFullscreen);
                      }}
                      className={`rounded-md p-1 transition ${
                        isFullscreen
                          ? "bg-indigo-600 text-white"
                          : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                      }`}
                      title={isFullscreen ? "Exit Fullscreen" : "Full Screen Console"}
                    >
                      {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Tab Content */}
              {rightPanelTab === "stdin" ? (
                <div className="p-4 flex-1 flex flex-col justify-between space-y-3 bg-[#0d1117]">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-200">
                      Standard Input (stdin)
                    </label>
                    <p className="text-[11px] text-slate-400">
                      Provide line-by-line inputs that your program reads via standard input (e.g., cin in C++, input() in Python, Scanner in Java).
                    </p>
                    <textarea
                      rows={10}
                      value={stdin}
                      onChange={(e) => setStdin(e.target.value)}
                      placeholder="Enter test inputs here (e.g. sample numbers, strings)..."
                      className="w-full rounded-xl border border-slate-800 bg-[#090d16] p-3 font-mono text-xs text-slate-100 placeholder-slate-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                    <span className="text-[11px] text-slate-400">
                      {stdin.trim() ? `${stdin.split("\n").length} input line(s)` : "No input provided"}
                    </span>
                    <button
                      type="button"
                      disabled={running}
                      onClick={handleRunCode}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      <Play className="h-3 w-3 fill-current" />
                      <span>Run with Input</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-4 flex-1 flex flex-col space-y-2 bg-[#090d16] overflow-auto">
                  {compileError && (
                    <div className="rounded-xl border border-rose-900/50 bg-rose-950/40 p-3">
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-rose-300 mb-1">
                        <AlertTriangle className="h-3.5 w-3.5 text-rose-400" />
                        <span>Compilation Error / Warnings</span>
                      </div>
                      <pre className="max-h-40 overflow-auto font-mono text-xs text-rose-200 whitespace-pre-wrap leading-relaxed">
                        {compileError}
                      </pre>
                    </div>
                  )}

                  {stderr && (
                    <div className="rounded-xl border border-amber-900/50 bg-amber-950/40 p-3">
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-300 mb-1">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                        <span>Standard Error (stderr)</span>
                      </div>
                      <pre className="max-h-32 overflow-auto font-mono text-xs text-amber-200 whitespace-pre-wrap leading-relaxed">
                        {stderr}
                      </pre>
                    </div>
                  )}

                  <div className={`flex-1 flex flex-col ${screenLayout === "output" ? (isFullscreen ? "min-h-[580px]" : "min-h-[460px]") : "min-h-[300px]"}`}>
                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 mb-1.5">
                      <span className="flex items-center gap-2 min-w-0">
                        <span className="text-emerald-400 font-mono font-bold">&gt;</span>
                        <span>Program Output (stdout)</span>
                        {runnerLabel && (
                          <span className="rounded-md bg-slate-900/90 px-2 py-0.5 text-[10px] text-emerald-400 font-mono border border-slate-800">
                            {runnerLabel}
                          </span>
                        )}
                      </span>
                      {!stdin.trim() && (
                        <button
                          type="button"
                          onClick={() => setRightPanelTab("stdin")}
                          className="text-[10px] text-indigo-400 hover:text-indigo-300"
                        >
                          + Add standard input
                        </button>
                      )}
                    </div>

                    <div className="flex-1 w-full rounded-xl border border-slate-800/80 bg-[#0d1117] p-3.5 font-mono text-xs text-emerald-300 whitespace-pre-wrap leading-relaxed overflow-auto">
                      {hasRun ? (
                        stdout ? (
                          <pre className="font-mono text-xs text-emerald-300 whitespace-pre-wrap">{stdout}</pre>
                        ) : !compileError && !stderr ? (
                          <div className="space-y-2 font-sans py-1">
                            <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs">
                              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 text-xs">✓</span>
                              <span>Code compiled and executed successfully with zero errors (Exit code 0).</span>
                            </div>
                            <p className="text-slate-400 text-xs leading-relaxed">
                              No output was printed to stdout. If you want to see values in the console, add a print statement (e.g. <code className="text-indigo-300 font-mono bg-slate-800/80 px-1 py-0.5 rounded">console.log(...)</code> in TypeScript/JavaScript, <code className="text-indigo-300 font-mono bg-slate-800/80 px-1 py-0.5 rounded">print(...)</code> in Python, or <code className="text-indigo-300 font-mono bg-slate-800/80 px-1 py-0.5 rounded">std::cout &lt;&lt; ...</code> in C++).
                            </p>
                          </div>
                        ) : null
                      ) : (
                        <span className="text-slate-500">Click &apos;Run Code&apos; above to compile and execute...</span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
        </div>
      </div>
    </div>
  );
};

export default CodeCompilerWorkspace;

