import React, { useCallback, useEffect, useRef, useState } from "react";
import axios from "../../api/axiosInstance";
import { toast } from "react-toastify";
import { getStudentToken, syncStudentActivity } from "./activitySync";

let sqlJsPromise = null;

function loadSqlJsRuntime() {
  if (sqlJsPromise) return sqlJsPromise;
  sqlJsPromise = new Promise((resolve, reject) => {
    const init = () => {
      if (typeof window.initSqlJs !== "function") {
        reject(new Error("SQLite WASM loader failed to initialize"));
        return;
      }
      window
        .initSqlJs({ locateFile: (file) => `/sql/${file}` })
        .then(resolve)
        .catch(reject);
    };

    if (typeof window.initSqlJs === "function") {
      init();
      return;
    }

    const script = document.createElement("script");
    script.src = "/sql/sql-wasm.js";
    script.async = true;
    script.onload = init;
    script.onerror = () => reject(new Error("Could not load /sql/sql-wasm.js"));
    document.head.appendChild(script);
  });
  return sqlJsPromise;
}

const DEFAULT_SQL = `-- Real SQLite Database running inside EduTechEx!
CREATE TABLE interns (id INTEGER PRIMARY KEY, name TEXT, track TEXT, score INTEGER);
INSERT INTO interns (name, track, score) VALUES
  ('Aarav', 'Mechanical CAD', 92),
  ('Diya', 'Backend Engineering', 96),
  ('Kabir', 'Data Analytics', 89);

SELECT track, COUNT(*) AS students, ROUND(AVG(score), 1) AS avg_score
FROM interns
GROUP BY track
ORDER BY avg_score DESC;
`;

const SqlLabWorkspace = ({ assignment, initialSubmission, onBack, onUpdated }) => {
  const [sqlCode, setSqlCode] = useState(
    initialSubmission?.submittedCode || assignment?.starterCode || DEFAULT_SQL
  );
  const [results, setResults] = useState([]);
  const [schemaTables, setSchemaTables] = useState([]);
  const [execError, setExecError] = useState("");
  const [execTimeMs, setExecTimeMs] = useState(null);
  const [engineReady, setEngineReady] = useState(false);
  const [studentNotes, setStudentNotes] = useState(initialSubmission?.studentNotes || "");
  const [versionNote, setVersionNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submissionState, setSubmissionState] = useState(initialSubmission || null);

  const sqlModuleRef = useRef(null);
  const latestRef = useRef({ sqlCode, results, schemaTables, execError });
  const isSandboxMode = !assignment?._id;

  useEffect(() => {
    latestRef.current = { sqlCode, results, schemaTables, execError };
  }, [sqlCode, results, schemaTables, execError]);

  const executeQuery = useCallback(
    (queryText, { recordRun = true } = {}) => {
      const SQL = sqlModuleRef.current;
      if (!SQL) return;
      const t0 = performance.now();
      let db;
      try {
        db = new SQL.Database();
        const resSets = db.exec(String(queryText || ""));
        const elapsed = Math.round((performance.now() - t0) * 10) / 10;

        // Query SQLite schema tables created by script
        let tables = [];
        try {
          const schemaRes = db.exec(
            "SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;"
          );
          if (schemaRes?.[0]?.values) {
            tables = schemaRes[0].values.map(([name, ddl]) => ({ name, ddl }));
          }
        } catch {
          tables = [];
        }

        const formattedSets = resSets.map((rs, idx) => ({
          id: idx,
          columns: rs.columns || [],
          values: (rs.values || []).slice(0, 200),
          totalRows: (rs.values || []).length,
        }));

        setResults(formattedSets);
        setSchemaTables(tables);
        setExecError("");
        setExecTimeMs(elapsed);

        const summary =
          formattedSets.length > 0
            ? formattedSets
                .map((s) => `[${s.columns.join(", ")}] -> ${s.totalRows} row(s)`)
                .join("\n")
            : `Executed cleanly in ${elapsed} ms (${tables.length} table(s)).`;

        if (recordRun && assignment?._id) {
          syncStudentActivity(assignment._id, {
            action: "Executed SQL Query",
            detail: `${formattedSets.length} result set(s), ${tables.length} table(s)`,
            isRun: true,
            submittedCode: String(queryText || ""),
            codeLanguage: "sql",
            codeOutput: summary,
            workSummary: summary,
            liveData: {
              mode: "sql",
              results: formattedSets.slice(0, 3),
              schemaTables: tables,
            },
          });
        }
      } catch (err) {
        setExecError(err.message || "SQL Syntax Error");
        setResults([]);
        if (recordRun && assignment?._id) {
          syncStudentActivity(assignment._id, {
            action: "SQL Error",
            detail: String(err.message || "").slice(0, 120),
            isRun: true,
            submittedCode: String(queryText || ""),
            codeLanguage: "sql",
            codeOutput: `ERROR: ${err.message}`,
          });
        }
      } finally {
        if (db) {
          try {
            db.close();
          } catch {
            // ignore
          }
        }
      }
    },
    [assignment]
  );

  useEffect(() => {
    let mounted = true;
    loadSqlJsRuntime()
      .then((SQL) => {
        if (!mounted) return;
        sqlModuleRef.current = SQL;
        setEngineReady(true);
        executeQuery(latestRef.current.sqlCode, { recordRun: false });
      })
      .catch((err) => {
        if (!mounted) return;
        setExecError(err.message || "Failed to initialize SQLite WASM");
      });
    return () => {
      mounted = false;
    };
  }, [executeQuery]);

  // Periodic 20s heartbeat while student is inside the SQL workspace
  useEffect(() => {
    if (!assignment?._id) return undefined;
    syncStudentActivity(assignment._id, {
      action: "Opened SQL Database Lab",
      codeLanguage: "sql",
      submittedCode: latestRef.current.sqlCode,
    });
    const timer = setInterval(() => {
      const cur = latestRef.current;
      const summary = cur.execError
        ? `SQL Error: ${cur.execError}`
        : cur.results.length > 0
          ? cur.results.map((r) => `${r.columns.join(", ")} (${r.totalRows} rows)`).join(" | ")
          : "Editing SQL script";
      syncStudentActivity(assignment._id, {
        action: "Working in SQL Lab",
        elapsedSeconds: 20,
        submittedCode: cur.sqlCode,
        codeLanguage: "sql",
        codeOutput: summary,
        workSummary: summary,
        liveData: {
          mode: "sql",
          results: cur.results.slice(0, 3),
          schemaTables: cur.schemaTables,
        },
      });
    }, 20000);
    return () => clearInterval(timer);
  }, [assignment?._id]);

  const buildFormData = (isFinal) => {
    const fd = new FormData();
    const summary = execError
      ? `ERROR: ${execError}`
      : results.length > 0
        ? results.map((s) => `[${s.columns.join(", ")}] (${s.totalRows} rows)`).join("\n")
        : `Tables: ${schemaTables.map((t) => t.name).join(", ") || "none"}`;
    fd.append("submittedCode", sqlCode);
    fd.append("codeLanguage", "sql");
    fd.append("codeOutput", summary);
    fd.append("workSummary", summary);
    fd.append(
      "liveData",
      JSON.stringify({ mode: "sql", results: results.slice(0, 4), schemaTables })
    );
    fd.append("studentNotes", studentNotes);
    fd.append("versionNote", versionNote || (isFinal ? "Final SQL Submission" : "SQL Save"));
    return fd;
  };

  const handleSave = async () => {
    if (isSandboxMode) {
      try {
        localStorage.setItem("skillnaav_sql_saved", String(sqlCode || ""));
        toast.success("Practice SQL snapshot saved locally!");
      } catch {
        toast.info("Practice mode: query preserved in this session.");
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
      toast.success("SQL snapshot saved!");
      onUpdated && onUpdated(res.data.submission);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to save SQL snapshot");
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (isSandboxMode) {
      try {
        localStorage.setItem("skillnaav_sql_submitted", String(sqlCode || ""));
        toast.success("Practice SQL query submitted and verified!");
        setTimeout(() => {
          if (onBack) onBack();
        }, 1200);
      } catch {
        toast.success("Practice SQL work submitted!");
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
      toast.success("SQL work submitted successfully!");
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
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800">
              SQLite WASM · Live Monitored
            </span>
          </div>
          <p className="text-xs text-slate-500">
            100% browser-native SQLite database engine (MIT sql.js). Runs offline inside EduTechEx.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={!engineReady}
            onClick={() => executeQuery(sqlCode, { recordRun: true })}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            ▶ Run SQL
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
        {/* Schema Explorer */}
        <div className="lg:col-span-3 rounded-xl border border-slate-200 bg-white p-3 space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
            Database Schema ({schemaTables.length})
          </h3>
          {schemaTables.length === 0 ? (
            <p className="text-xs text-slate-400">Run CREATE TABLE statements to inspect tables here.</p>
          ) : (
            <div className="space-y-2 max-h-[380px] overflow-y-auto">
              {schemaTables.map((t) => (
                <div key={t.name} className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                  <div className="text-xs font-bold text-slate-800">{t.name}</div>
                  <pre className="mt-1 whitespace-pre-wrap text-[10px] font-mono text-slate-600">{t.ddl}</pre>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* SQL Editor + Result Tables */}
        <div className="lg:col-span-9 space-y-4">
          <div className="rounded-xl border border-slate-700 bg-slate-950 overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-4 py-2 text-xs text-slate-300">
              <span className="font-mono font-semibold">query.sql</span>
              <span className="text-[11px] text-slate-400">
                {engineReady ? (execTimeMs !== null ? `Executed in ${execTimeMs} ms` : "SQLite Ready") : "Loading SQLite WASM..."}
              </span>
            </div>
            <textarea
              value={sqlCode}
              onChange={(e) => setSqlCode(e.target.value)}
              spellCheck={false}
              rows={11}
              className="w-full resize-y bg-slate-950 p-4 font-mono text-xs leading-6 text-slate-100 focus:outline-none"
            />
          </div>

          {execError && (
            <div className="rounded-xl border border-red-300 bg-red-50 p-3 text-xs font-mono text-red-700">
              {execError}
            </div>
          )}

          {results.map((set) => (
            <div key={set.id} className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
              <div className="flex items-center justify-between bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700">
                <span>Result Set #{set.id + 1}</span>
                <span>{set.totalRows} row(s)</span>
              </div>
              <div className="overflow-x-auto max-h-72">
                <table className="min-w-full divide-y divide-slate-200 text-xs">
                  <thead className="bg-slate-50">
                    <tr>
                      {set.columns.map((col, idx) => (
                        <th key={`${col}-${idx}`} className="px-3 py-2 text-left font-bold text-slate-700">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {set.values.map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-slate-50">
                        {row.map((cell, cIdx) => (
                          <td key={cIdx} className="px-3 py-1.5 font-mono text-slate-700">
                            {cell === null ? <span className="italic text-slate-400">NULL</span> : String(cell)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-3">
        <input
          type="text"
          value={versionNote}
          onChange={(e) => setVersionNote(e.target.value)}
          placeholder="Snapshot note (e.g., Added JOIN query)"
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

export default SqlLabWorkspace;

