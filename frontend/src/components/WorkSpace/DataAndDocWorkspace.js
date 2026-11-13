import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "../../api/axiosInstance";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { toast } from "react-toastify";
import { getStudentToken, syncStudentActivity } from "./activitySync";

const DEFAULT_CSV = `Month,Output_Units,Defect_Rate,Efficiency_Pct
Jan,1200,2.4,88
Feb,1450,1.9,91
Mar,1680,1.5,94
Apr,1590,1.7,92
May,1840,1.2,96
`;

const DEFAULT_MD = `# Daily Engineering Report

## Objective
Document today's findings and metrics.

## Observations
- Completed validation checks cleanly.
`;

const DataAndDocWorkspace = ({
  assignment,
  initialSubmission,
  mode = "data", // "data" | "markdown"
  onBack,
  onUpdated,
}) => {
  const isSandboxMode = !assignment?._id;
  const [content, setContent] = useState(
    initialSubmission?.submittedCode ||
      assignment?.starterCode ||
      (mode === "markdown" ? DEFAULT_MD : DEFAULT_CSV)
  );
  const [chartType, setChartType] = useState("bar");
  const [xAxisKey, setXAxisKey] = useState("");
  const [yAxisKey, setYAxisKey] = useState("");
  const [studentNotes, setStudentNotes] = useState(initialSubmission?.studentNotes || "");
  const [versionNote, setVersionNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submissionState, setSubmissionState] = useState(initialSubmission || null);

  const parsedDataset = useMemo(() => {
    if (mode !== "data") return { headers: [], rows: [], numericStats: [] };
    const res = Papa.parse(String(content || "").trim(), {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
    });
    const headers = res.meta?.fields || [];
    const rows = res.data || [];
    const numericStats = headers
      .map((col) => {
        const nums = rows
          .map((r) => Number(r[col]))
          .filter((v) => Number.isFinite(v) && String(v) !== "");
        if (nums.length === 0) return null;
        const sum = nums.reduce((a, b) => a + b, 0);
        return {
          column: col,
          count: nums.length,
          min: Math.min(...nums),
          max: Math.max(...nums),
          avg: Math.round((sum / nums.length) * 100) / 100,
          sum: Math.round(sum * 100) / 100,
        };
      })
      .filter(Boolean);
    return { headers, rows, numericStats };
  }, [content, mode]);

  useEffect(() => {
    if (parsedDataset.headers.length > 0) {
      if (!xAxisKey || !parsedDataset.headers.includes(xAxisKey)) {
        setXAxisKey(parsedDataset.headers[0]);
      }
      if (!yAxisKey || !parsedDataset.headers.includes(yAxisKey)) {
        const numCol = parsedDataset.numericStats[0]?.column || parsedDataset.headers[1] || parsedDataset.headers[0];
        setYAxisKey(numCol);
      }
    }
  }, [parsedDataset, xAxisKey, yAxisKey]);

  const latestRef = useRef({ content, parsedDataset, chartType, xAxisKey, yAxisKey });
  useEffect(() => {
    latestRef.current = { content, parsedDataset, chartType, xAxisKey, yAxisKey };
  }, [content, parsedDataset, chartType, xAxisKey, yAxisKey]);

  useEffect(() => {
    if (!assignment?._id) return undefined;
    const label = mode === "markdown" ? "Report Studio" : "Data Analytics Lab";
    syncStudentActivity(assignment._id, {
      action: `Opened ${label}`,
      codeLanguage: mode,
    });
    const timer = setInterval(() => {
      const cur = latestRef.current;
      const summary =
        mode === "markdown"
          ? `Report length: ${cur.content.length} chars, ${cur.content.split(/\s+/).filter(Boolean).length} words`
          : `${cur.parsedDataset.rows.length} rows × ${cur.parsedDataset.headers.length} columns`;
      syncStudentActivity(assignment._id, {
        action: `Working in ${label}`,
        elapsedSeconds: 20,
        submittedCode: cur.content,
        codeLanguage: mode,
        workSummary: summary,
        liveData:
          mode === "data"
            ? {
                mode: "data",
                headers: cur.parsedDataset.headers,
                rowCount: cur.parsedDataset.rows.length,
                numericStats: cur.parsedDataset.numericStats,
              }
            : { mode: "markdown", charCount: cur.content.length },
      });
    }, 20000);
    return () => clearInterval(timer);
  }, [assignment?._id, mode]);

  const handleUploadSpreadsheet = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      if (file.name.toLowerCase().endsWith(".csv")) {
        const text = await file.text();
        setContent(text);
        toast.success(`Loaded ${file.name}`);
      } else {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const csv = XLSX.utils.sheet_to_csv(ws);
        setContent(csv);
        toast.success(`Imported sheet from ${file.name}`);
      }
    } catch {
      toast.error("Failed to read CSV/Excel file");
    }
  };

  const buildFormData = (isFinal) => {
    const fd = new FormData();
    const summary =
      mode === "markdown"
        ? `Markdown report (${content.split(/\s+/).filter(Boolean).length} words)`
        : `${parsedDataset.rows.length} rows × ${parsedDataset.headers.length} columns`;
    fd.append("submittedCode", content);
    fd.append("codeLanguage", mode);
    fd.append("codeOutput", summary);
    fd.append("workSummary", summary);
    fd.append(
      "liveData",
      JSON.stringify(
        mode === "data"
          ? {
              mode: "data",
              headers: parsedDataset.headers,
              rowCount: parsedDataset.rows.length,
              numericStats: parsedDataset.numericStats,
            }
          : { mode: "markdown" }
      )
    );
    fd.append("studentNotes", studentNotes);
    fd.append("versionNote", versionNote || (isFinal ? "Final Submission" : "Draft Save"));
    return fd;
  };

  const handleSave = async () => {
    if (isSandboxMode) {
      toast.info("Practice Sandbox mode: open a partner-assigned task to save on server.");
      return;
    }
    try {
      setSaving(true);
      const res = await axios.post(`/api/daily-work/submissions/${assignment._id}/save`, buildFormData(false), {
        headers: { Authorization: `Bearer ${getStudentToken()}`, "Content-Type": "multipart/form-data" },
      });
      setSubmissionState(res.data.submission);
      setVersionNote("");
      toast.success("Snapshot saved!");
      onUpdated && onUpdated(res.data.submission);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to save snapshot");
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (isSandboxMode) {
      toast.info("Practice Sandbox mode: open a partner-assigned task to submit work.");
      return;
    }
    try {
      setSubmitting(true);
      const res = await axios.post(`/api/daily-work/submissions/${assignment._id}/submit`, buildFormData(true), {
        headers: { Authorization: `Bearer ${getStudentToken()}`, "Content-Type": "multipart/form-data" },
      });
      setSubmissionState(res.data.submission);
      toast.success("Work submitted successfully!");
      onUpdated && onUpdated(res.data.submission);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  const ChartComp = chartType === "line" ? LineChart : chartType === "area" ? AreaChart : BarChart;

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
            <span className="rounded-full bg-teal-100 px-2.5 py-0.5 text-[11px] font-semibold text-teal-800">
              {mode === "markdown" ? "Markdown Studio · Live Sync" : "CSV/Excel Data Lab · Live Sync"}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {mode === "data" && (
            <label className="cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
              Import .CSV / .XLSX
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleUploadSpreadsheet}
                className="hidden"
              />
            </label>
          )}
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

      {mode === "markdown" ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="lg:col-span-6 rounded-xl border border-slate-700 bg-slate-950 overflow-hidden">
            <div className="border-b border-slate-800 bg-slate-900 px-4 py-2 text-xs font-mono text-slate-300">
              report.md ({content.split(/\s+/).filter(Boolean).length} words)
            </div>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={20}
              className="w-full resize-y bg-slate-950 p-4 font-mono text-xs leading-6 text-slate-100 focus:outline-none"
            />
          </div>
          <div className="lg:col-span-6 rounded-xl border border-slate-200 bg-white p-5 prose prose-sm max-w-none max-h-[520px] overflow-y-auto">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Numeric Column Stats */}
          {parsedDataset.numericStats.length > 0 && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {parsedDataset.numericStats.map((st) => (
                <div key={st.column} className="rounded-xl border border-slate-200 bg-white p-3 text-xs">
                  <div className="font-bold text-slate-900">{st.column}</div>
                  <div className="mt-1 grid grid-cols-2 gap-1 text-slate-600">
                    <span>Avg: <strong>{st.avg}</strong></span>
                    <span>Sum: <strong>{st.sum}</strong></span>
                    <span>Min: <strong>{st.min}</strong></span>
                    <span>Max: <strong>{st.max}</strong></span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            <div className="lg:col-span-5 rounded-xl border border-slate-700 bg-slate-950 overflow-hidden">
              <div className="border-b border-slate-800 bg-slate-900 px-4 py-2 text-xs font-mono text-slate-300">
                dataset.csv ({parsedDataset.rows.length} rows)
              </div>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={15}
                className="w-full resize-y bg-slate-950 p-4 font-mono text-xs leading-6 text-slate-100 focus:outline-none"
              />
            </div>

            <div className="lg:col-span-7 rounded-xl border border-slate-200 bg-white p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase text-slate-700">Live Visualization</span>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <select
                    value={chartType}
                    onChange={(e) => setChartType(e.target.value)}
                    className="rounded border border-slate-300 px-2 py-1"
                  >
                    <option value="bar">Bar Chart</option>
                    <option value="line">Line Chart</option>
                    <option value="area">Area Chart</option>
                  </select>
                  <select
                    value={xAxisKey}
                    onChange={(e) => setXAxisKey(e.target.value)}
                    className="rounded border border-slate-300 px-2 py-1"
                  >
                    {parsedDataset.headers.map((h) => (
                      <option key={h} value={h}>X: {h}</option>
                    ))}
                  </select>
                  <select
                    value={yAxisKey}
                    onChange={(e) => setYAxisKey(e.target.value)}
                    className="rounded border border-slate-300 px-2 py-1"
                  >
                    {parsedDataset.headers.map((h) => (
                      <option key={h} value={h}>Y: {h}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="h-[290px] w-full">
                {parsedDataset.rows.length > 0 && xAxisKey && yAxisKey ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <ChartComp data={parsedDataset.rows}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey={xAxisKey} tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      {chartType === "line" ? (
                        <Line type="monotone" dataKey={yAxisKey} stroke="#2563eb" strokeWidth={2} />
                      ) : chartType === "area" ? (
                        <Area type="monotone" dataKey={yAxisKey} stroke="#2563eb" fill="#bfdbfe" />
                      ) : (
                        <Bar dataKey={yAxisKey} fill="#2563eb" radius={[4, 4, 0, 0]} />
                      )}
                    </ChartComp>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-slate-400">
                    Provide valid CSV rows to preview chart.
                  </div>
                )}
              </div>
            </div>
          </div>
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

export default DataAndDocWorkspace;

