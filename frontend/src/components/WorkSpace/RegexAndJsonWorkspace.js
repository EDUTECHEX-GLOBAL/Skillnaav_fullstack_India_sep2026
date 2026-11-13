import React, { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import axios from "../../api/axiosInstance";
import { getToolMeta } from "./toolCatalog";
import { getStudentToken, syncStudentActivity } from "./activitySync";

const parseInitialState = (raw) => {
  try {
    const parsed = JSON.parse(raw || "{}");
    if (parsed && typeof parsed === "object") {
      return {
        pattern: parsed.pattern || "\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}\\b",
        flags: parsed.flags ?? "gi",
        testText: parsed.testText || "",
        jsonText: parsed.jsonText || "{}",
      };
    }
  } catch {
    // fall through
  }
  return {
    pattern: "\\d+",
    flags: "g",
    testText: "Order #1042 shipped 3 items.",
    jsonText: raw || '{\n  "status": "ok"\n}',
  };
};

const RegexAndJsonWorkspace = ({ assignment, initialSubmission, onBack, onUpdated }) => {
  const toolMeta = getToolMeta(assignment?.toolType || "regex-json-lab");
  const initial = useMemo(
    () =>
      parseInitialState(
        initialSubmission?.submittedCode || assignment?.starterCode || toolMeta.defaultCode
      ),
    [initialSubmission?.submittedCode, assignment?.starterCode, toolMeta.defaultCode]
  );

  const [pattern, setPattern] = useState(initial.pattern);
  const [flags, setFlags] = useState(initial.flags);
  const [testText, setTestText] = useState(initial.testText);
  const [jsonText, setJsonText] = useState(initial.jsonText);
  const [studentNotes, setStudentNotes] = useState(initialSubmission?.studentNotes || "");
  const [versionNote, setVersionNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submissionState, setSubmissionState] = useState(initialSubmission || null);

  const regexEval = useMemo(() => {
    if (!pattern) return { valid: true, matches: [], error: "" };
    try {
      const safeFlags = flags.includes("g") ? flags : `${flags}g`;
      const re = new RegExp(pattern, safeFlags);
      const matches = [];
      let m;
      let guard = 0;
      while ((m = re.exec(testText)) !== null && guard < 200) {
        matches.push({ value: m[0], index: m.index, groups: m.slice(1) });
        if (m[0].length === 0) re.lastIndex += 1;
        guard += 1;
      }
      return { valid: true, matches, error: "" };
    } catch (err) {
      return { valid: false, matches: [], error: err.message };
    }
  }, [pattern, flags, testText]);

  const jsonEval = useMemo(() => {
    try {
      const parsed = JSON.parse(jsonText || "null");
      const keyCount =
        parsed && typeof parsed === "object" && !Array.isArray(parsed)
          ? Object.keys(parsed).length
          : Array.isArray(parsed)
            ? parsed.length
            : 0;
      return { valid: true, parsed, keyCount, error: "" };
    } catch (err) {
      return { valid: false, parsed: null, keyCount: 0, error: err.message };
    }
  }, [jsonText]);

  const serializedCode = useMemo(
    () => JSON.stringify({ pattern, flags, testText, jsonText }, null, 2),
    [pattern, flags, testText, jsonText]
  );

  const outputSummary = useMemo(
    () =>
      `Regex matches: ${regexEval.matches.length}${regexEval.error ? ` (Regex err: ${regexEval.error})` : ""} | JSON: ${jsonEval.valid ? `Valid (${jsonEval.keyCount} top keys/items)` : `Invalid (${jsonEval.error})`}`,
    [regexEval, jsonEval]
  );

  const latestRef = useRef({ serializedCode, outputSummary, pattern, matchesCount: 0, jsonValid: true });
  useEffect(() => {
    latestRef.current = {
      serializedCode,
      outputSummary,
      pattern,
      matchesCount: regexEval.matches.length,
      jsonValid: jsonEval.valid,
    };
  }, [serializedCode, outputSummary, pattern, regexEval.matches.length, jsonEval.valid]);

  useEffect(() => {
    if (!assignment?._id) return undefined;
    syncStudentActivity(assignment._id, {
      action: "Opened Regex & JSON Lab",
      codeLanguage: "json",
      submittedCode: latestRef.current.serializedCode,
      codeOutput: latestRef.current.outputSummary,
      workSummary: latestRef.current.outputSummary,
    });
    const timer = setInterval(() => {
      const cur = latestRef.current;
      syncStudentActivity(assignment._id, {
        action: "Working in Regex & JSON Lab",
        elapsedSeconds: 20,
        codeLanguage: "json",
        submittedCode: cur.serializedCode,
        codeOutput: cur.outputSummary,
        workSummary: cur.outputSummary,
        liveData: { pattern: cur.pattern, matchesCount: cur.matchesCount, jsonValid: cur.jsonValid },
      });
    }, 20000);
    return () => clearInterval(timer);
  }, [assignment?._id]);

  const handleFormatJson = (minify = false) => {
    if (!jsonEval.valid) {
      toast.error("Fix JSON syntax errors first");
      return;
    }
    setJsonText(JSON.stringify(jsonEval.parsed, null, minify ? 0 : 2));
    syncStudentActivity(assignment?._id, {
      action: minify ? "Minified JSON" : "Formatted JSON",
      isRun: true,
      codeLanguage: "json",
      submittedCode: serializedCode,
      codeOutput: outputSummary,
      workSummary: outputSummary,
    });
  };

  const buildPayload = (isFinal = false) => {
    const fd = new FormData();
    fd.append("submittedCode", serializedCode);
    fd.append("codeLanguage", "json");
    fd.append("codeOutput", outputSummary);
    fd.append("studentNotes", studentNotes);
    fd.append("versionNote", versionNote || (isFinal ? "Final Regex & JSON Submission" : "Regex & JSON Snapshot"));
    return fd;
  };

  const handleSave = async (isFinal = false) => {
    if (!assignment?._id) return;
    try {
      isFinal ? setSubmitting(true) : setSaving(true);
      const token = getStudentToken();
      const endpoint = isFinal
        ? `/api/daily-work/submissions/${assignment._id}/submit`
        : `/api/daily-work/submissions/${assignment._id}/save`;
      const res = await axios.post(endpoint, buildPayload(isFinal), {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      });
      setSubmissionState(res.data.submission);
      setVersionNote("");
      toast.success(isFinal ? "Regex & JSON work submitted!" : "Snapshot saved!");
      onUpdated && onUpdated(res.data.submission);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Save failed");
    } finally {
      setSaving(false);
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
              {toolMeta.name} · {toolMeta.license}
            </span>
          </div>
          <p className="text-xs text-slate-500">
            {assignment?.category} · {assignment?.difficulty}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={() => handleSave(false)}
            className="rounded-lg bg-slate-800 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Snapshot"}
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={() => handleSave(true)}
            className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? "Submitting..." : "Submit Work"}
          </button>
        </div>
      </div>

      {assignment?.instructions && (
        <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-4 text-xs text-slate-700 whitespace-pre-wrap">
          <span className="font-semibold text-blue-900">Task Instructions: </span>
          {assignment.instructions}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Regex Tester */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">1. Regular Expression Tester</h3>
            <span
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                regexEval.valid ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
              }`}
            >
              {regexEval.valid ? `${regexEval.matches.length} Match(es)` : "Invalid Pattern"}
            </span>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              placeholder="Regex pattern (without / /)"
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs"
            />
            <input
              type="text"
              value={flags}
              onChange={(e) => setFlags(e.target.value)}
              placeholder="Flags (gi)"
              className="w-20 rounded-lg border border-slate-300 px-2.5 py-2 font-mono text-xs"
            />
          </div>
          {regexEval.error && (
            <div className="rounded bg-rose-50 px-3 py-1.5 text-xs text-rose-700">
              {regexEval.error}
            </div>
          )}
          <textarea
            rows={5}
            value={testText}
            onChange={(e) => setTestText(e.target.value)}
            placeholder="Sample test text..."
            className="w-full rounded-lg border border-slate-300 p-2.5 font-mono text-xs"
          />
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
            <div className="text-[11px] font-semibold text-slate-600 mb-1">Matched Tokens</div>
            {regexEval.matches.length === 0 ? (
              <div className="text-xs text-slate-400">No matches found</div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {regexEval.matches.slice(0, 40).map((m, idx) => (
                  <span
                    key={`${m.index}-${idx}`}
                    className="rounded bg-blue-100 px-2 py-0.5 font-mono text-xs text-blue-900"
                  >
                    {m.value} <span className="text-[10px] text-blue-600">@{m.index}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* JSON Validator & Formatter */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-slate-900">2. JSON Validator &amp; Formatter</h3>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleFormatJson(false)}
                className="rounded bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-slate-700"
              >
                Pretty Print
              </button>
              <button
                type="button"
                onClick={() => handleFormatJson(true)}
                className="rounded bg-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-800 hover:bg-slate-300"
              >
                Minify
              </button>
            </div>
          </div>
          <div
            className={`rounded px-3 py-1.5 text-xs font-medium ${
              jsonEval.valid ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-700"
            }`}
          >
            {jsonEval.valid ? `✓ Valid JSON (${jsonEval.keyCount} root keys/items)` : `✕ ${jsonEval.error}`}
          </div>
          <textarea
            rows={11}
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            spellCheck={false}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 p-3 font-mono text-xs text-emerald-300"
          />
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <input
          type="text"
          placeholder="Snapshot note..."
          value={versionNote}
          onChange={(e) => setVersionNote(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-xs"
        />
        <input
          type="text"
          placeholder="Notes for partner..."
          value={studentNotes}
          onChange={(e) => setStudentNotes(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-xs"
        />
        {submissionState?.status && (
          <div className="text-[11px] text-slate-500 sm:col-span-2">
            Status: <span className="font-semibold uppercase text-blue-700">{submissionState.status}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default RegexAndJsonWorkspace;

