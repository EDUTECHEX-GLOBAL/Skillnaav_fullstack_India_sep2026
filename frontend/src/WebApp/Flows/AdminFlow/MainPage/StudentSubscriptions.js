// frontend/src/WebApp/Flows/AdminFlow/MainPage/StudentSubscriptions.js
import React, { useEffect, useState, useCallback } from "react";
import axiosInstance from "../../../../api/axiosInstance";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_FILTERS = ["All", "Active", "Expiring Soon", "Expired", "Free"];

const statusStyles = {
  Active: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  "Expiring Soon": "bg-amber-50 text-amber-700 border border-amber-200",
  Expired: "bg-red-50 text-red-600 border border-red-200",
  Free: "bg-gray-100 text-gray-500 border border-gray-200",
};

const daysLeftStyle = (days) => {
  if (days === null) return "text-gray-400";
  if (days < 0) return "text-red-500 font-semibold";
  if (days <= 7) return "text-amber-500 font-semibold";
  return "text-gray-600";
};

const formatDate = (dateStr) => {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatDaysLeft = (days) => {
  if (days === null) return "—";
  if (days < 0) return `${Math.abs(days)}d ago`;
  if (days === 0) return "Today";
  return `${days}d`;
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const StatusBadge = ({ status }) => (
  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${statusStyles[status] ?? "bg-gray-100 text-gray-500 border border-gray-200"}`}>
    {status}
  </span>
);

const Avatar = ({ name, index }) => {
  const colors = [
    "bg-teal-100 text-teal-700",
    "bg-blue-100 text-blue-700",
    "bg-purple-100 text-purple-700",
    "bg-amber-100 text-amber-700",
    "bg-rose-100 text-rose-700",
  ];
  const initials = (name || "?").split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();
  return (
    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${colors[index % colors.length]}`}>
      {initials}
    </div>
  );
};

const SummaryCard = ({ label, value, colorClass, icon }) => (
  <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
    <div className="flex items-center justify-between mb-1">
      <p className="text-xs text-gray-400">{label}</p>
      {icon && <span className="text-base">{icon}</span>}
    </div>
    <p className={`text-2xl font-semibold ${colorClass}`}>{value}</p>
  </div>
);

const SkeletonRow = () => (
  <tr className="border-b border-gray-50 animate-pulse">
    {[...Array(6)].map((_, i) => (
      <td key={i} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded w-full" /></td>
    ))}
  </tr>
);

// ─── Windowed page number builder ────────────────────────────────────────────

const getPageNumbers = (current, total) => {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set([1, total]);
  for (let i = Math.max(2, current - 2); i <= Math.min(total - 1, current + 2); i++) pages.add(i);
  const sorted = [...pages].sort((a, b) => a - b);
  const result = [];
  let prev = 0;
  for (const p of sorted) {
    if (p - prev > 1) result.push("...");
    result.push(p);
    prev = p;
  }
  return result;
};

// ─── Main component ───────────────────────────────────────────────────────────

const StudentSubscriptions = () => {
  const [students, setStudents] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [statusFilter, setStatusFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("joinedAt");
  const [sortDir, setSortDir] = useState("desc");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const paramsObj = {};
      if (statusFilter !== "All") paramsObj.status = statusFilter;
      if (search.trim()) paramsObj.search = search.trim();

      const res = await axiosInstance.get("api/admin/subscriptions/students", { params: paramsObj });
      const data = res.data;

      if (data && data.success) {
        setStudents(data.data);
        setSummary(data.summary);
        setPage(1);
      } else {
        throw new Error("API returned success: false");
      }
    } catch (err) {
      console.error("Student fetch failed:", err);
      setError("Failed to load student data.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search]);

  useEffect(() => {
    const t = setTimeout(fetchStudents, search ? 400 : 0);
    return () => clearTimeout(t);
  }, [fetchStudents, search]);

  useEffect(() => {
    fetchStudents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const sorted = [...students].sort((a, b) => {
    let aVal, bVal;
    if (sortBy === "daysLeft") { aVal = a.daysLeft ?? Infinity; bVal = b.daysLeft ?? Infinity; }
    else if (sortBy === "plan") { aVal = a.plan ?? ""; bVal = b.plan ?? ""; }
    else if (sortBy === "name") { aVal = a.name ?? ""; bVal = b.name ?? ""; }
    else { aVal = new Date(a.joinedAt); bVal = new Date(b.joinedAt); }
    if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
    if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
    return 0;
  });

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const toggleSort = (col) => {
    if (sortBy === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortBy(col); setSortDir("asc"); }
  };

  const SortIcon = ({ col }) =>
    sortBy === col
      ? <span className="ml-1 text-teal-500">{sortDir === "asc" ? "↑" : "↓"}</span>
      : <span className="ml-1 text-gray-300">↕</span>;

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-gray-800">Student Subscriptions</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          All registered students — plan, expiry, and subscription status
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">
          {error}{" "}
          <button onClick={fetchStudents} className="underline ml-2 font-medium">Retry</button>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <SummaryCard label="Total Students" value={summary?.total ?? "—"} colorClass="text-gray-800" icon="👥" />
        <SummaryCard label="Active"         value={summary?.active ?? "—"} colorClass="text-emerald-600" icon="✅" />
        <SummaryCard label="Expiring Soon"  value={summary?.expiringSoon ?? "—"} colorClass="text-amber-500" icon="⚠" />
        <SummaryCard label="Expired"        value={summary?.expired ?? "—"} colorClass="text-red-500" icon="❌" />
        <SummaryCard label="Free"           value={summary?.free ?? "—"} colorClass="text-gray-500" icon="🆓" />
      </div>

      {/* Urgent callout */}
      {summary?.expiringSoon > 0 && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <span className="text-amber-500 text-lg">⚠</span>
          <p className="text-sm text-amber-700">
            <span className="font-semibold">
              {summary.expiringSoon} student{summary.expiringSoon > 1 ? "s" : ""}
            </span>{" "}
            {summary.expiringSoon > 1 ? "have" : "has"} a subscription expiring within 7 days.
          </p>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, email, university…"
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 w-full sm:w-72 focus:outline-none focus:ring-2 focus:ring-teal-300 focus:border-transparent"
        />
        <div className="flex gap-1.5 flex-wrap">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                statusFilter === f
                  ? "bg-teal-600 text-white border-teal-600"
                  : "bg-white text-gray-600 border-gray-200 hover:border-teal-300 hover:text-teal-600"
              }`}
            >
              {f}
              {f !== "All" && summary && (
                <span className="ml-1 opacity-70">
                  ({f === "Expiring Soon" ? summary.expiringSoon : summary[f.toLowerCase()] ?? 0})
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Table — 6 focused columns */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th
                  className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide cursor-pointer select-none"
                  onClick={() => toggleSort("name")}
                >
                  Student <SortIcon col="name" />
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  University
                </th>
                <th
                  className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide cursor-pointer select-none"
                  onClick={() => toggleSort("plan")}
                >
                  Plan <SortIcon col="plan" />
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  Status
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  Expiry
                </th>
                <th
                  className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide cursor-pointer select-none"
                  onClick={() => toggleSort("daysLeft")}
                >
                  Days Left <SortIcon col="daysLeft" />
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(8)].map((_, i) => <SkeletonRow key={i} />)
              ) : paginated.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-400 text-sm">
                    No students match your filters.
                  </td>
                </tr>
              ) : (
                paginated.map((s, idx) => (
                  <tr
                    key={s.id}
                    className={`border-b border-gray-50 hover:bg-gray-50/80 transition-colors last:border-none ${
                      s.status === "Expiring Soon" ? "bg-amber-50/30" : ""
                    } ${s.status === "Expired" ? "bg-red-50/20" : ""}`}
                  >
                    {/* Student */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={s.name} index={(page - 1) * PAGE_SIZE + idx} />
                        <div className="min-w-0">
                          <p className="font-medium text-gray-800 truncate">{s.name}</p>
                          <p className="text-xs text-gray-400 truncate">{s.email}</p>
                        </div>
                      </div>
                    </td>

                    {/* University */}
                    <td className="px-4 py-3">
                      <p className="text-gray-600 text-sm truncate max-w-[200px]" title={s.universityName}>
                        {s.universityName || <span className="text-gray-300">—</span>}
                      </p>
                    </td>

                    {/* Plan */}
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-medium whitespace-nowrap ${
                        s.plan === "Premium Plus"
                          ? "bg-purple-50 text-purple-700 border border-purple-200"
                          : s.plan === "Premium Basic"
                          ? "bg-teal-50 text-teal-700 border border-teal-200"
                          : "bg-gray-100 text-gray-500 border border-gray-200"
                      }`}>
                        {s.plan || "Free"}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <StatusBadge status={s.status} />
                    </td>

                    {/* Expiry */}
                    <td className="px-4 py-3 text-gray-500 text-sm whitespace-nowrap">
                      {formatDate(s.expiry)}
                    </td>

                    {/* Days Left */}
                    <td className={`px-4 py-3 text-sm font-mono ${daysLeftStyle(s.daysLeft)}`}>
                      {formatDaysLeft(s.daysLeft)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="flex justify-center px-4 py-8 bg-gray-50/50">
            <div className="flex items-center gap-1.5 bg-white p-1.5 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-gray-100/50">
              {/* Prev */}
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-slate-50 text-slate-500 hover:bg-slate-100 disabled:text-slate-400 disabled:bg-slate-50/50"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                Previous
              </button>

              {/* Windowed page numbers */}
              {getPageNumbers(page, totalPages).map((p, i) =>
                p === "..." ? (
                  <div key={`ellipsis-${i}`} className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-50 text-slate-400 text-sm font-semibold select-none">
                    ...
                  </div>
                ) : (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`w-10 h-10 flex items-center justify-center rounded-xl text-sm font-semibold transition-all ${
                      page === p
                        ? "bg-[#2563EB] text-white shadow-lg shadow-blue-500/30"
                        : "text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {p}
                  </button>
                )
              )}

              {/* Next */}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-slate-50 text-slate-700 hover:bg-slate-100 disabled:text-slate-400 disabled:bg-slate-50/50"
              >
                Next
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
              </button>
            </div>
          </div>
        )}
      </div>

      <p className="text-xs text-gray-400">{!loading && `${sorted.length} students found`}</p>
    </div>
  );
};

export default StudentSubscriptions;