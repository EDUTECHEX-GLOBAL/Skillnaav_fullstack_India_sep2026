import React, { useEffect, useState, useCallback } from "react";
import axios from "../../../../../api/axiosInstance";
import {
  Search,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Eye,
  ChevronDown,
  ChevronUp,
  User,
} from "lucide-react";
import StudentProfileDetailModal from "./StudentProfileDetailModal";

// ─── Shared image helper (same logic as in StudentProfileDetailModal) ─────────
function imageIsFilled(val) {
  if (!val || typeof val !== "string" || val.trim() === "") return false;
  return (
    val.startsWith("data:image") ||
    val.startsWith("http") ||
    val.startsWith("/") ||
    val.startsWith("uploads")
  );
}

const getProfileImageUrl = (profileImage) => {
  if (!profileImage || typeof profileImage !== "string" || profileImage.trim() === "") return null;
  if (profileImage.startsWith("data:image") || profileImage.startsWith("http://") || profileImage.startsWith("https://")) {
    return profileImage;
  }
  const baseUrl = process.env.REACT_APP_API_BASE || "http://localhost:5000";
  const normalizedImage = profileImage.replace(/\\/g, "/");
  if (normalizedImage.startsWith("/")) return `${baseUrl}${normalizedImage}`;
  if (normalizedImage.startsWith("uploads/")) return `${baseUrl}/${normalizedImage}`;
  return `${baseUrl}/uploads/${normalizedImage}`;
};

// ─── Avatar — renders image or initial/icon fallback ─────────────────────────
function StudentAvatar({ src, name }) {
  const [broken, setBroken] = useState(false);
  const valid = imageIsFilled(src) && !broken;

  if (valid) {
    return (
      <img
        src={getProfileImageUrl(src)}
        alt=""
        onError={() => setBroken(true)}
        className="w-8 h-8 rounded-full object-cover flex-shrink-0"
      />
    );
  }

  // Show first letter of name if available, otherwise a User icon
  return (
    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0">
      {name?.[0] ? (
        <span className="text-xs font-bold uppercase">{name[0]}</span>
      ) : (
        <User size={14} />
      )}
    </div>
  );
}

// ─── Completion ring SVG ──────────────────────────────────────────────────────
function CompletionRing({ pct }) {
  const r = 16;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct / 100);
  const color = pct >= 80 ? "#16a34a" : pct >= 50 ? "#d97706" : "#dc2626";

  return (
    <div className="flex items-center gap-2">
      <svg width="40" height="40" viewBox="0 0 40 40">
        <circle
          cx="20"
          cy="20"
          r={r}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth="4"
        />
        <circle
          cx="20"
          cy="20"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          transform="rotate(-90 20 20)"
          style={{
            transition: "stroke-dashoffset 0.5s ease, stroke 0.4s ease",
          }}
        />
        <text
          x="20"
          y="20"
          textAnchor="middle"
          dominantBaseline="central"
          fontSize="9"
          fontWeight="700"
          fill={color}
        >
          {pct}%
        </text>
      </svg>
      <div className="text-sm font-semibold" style={{ color }}>
        {pct}%
      </div>
    </div>
  );
}

// ─── Completion badge ─────────────────────────────────────────────────────────
function CompletionBadge({ pct }) {
  if (pct >= 80)
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
        <CheckCircle2 size={11} /> On track
      </span>
    );
  if (pct >= 50)
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
        <AlertTriangle size={11} /> Needs push
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
      <AlertTriangle size={11} /> Stalled
    </span>
  );
}

// ─── Windowed page number builder ────────────────────────────────────────────
const getPageNumbers = (current, total) => {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set([1, total]);
  for (
    let i = Math.max(2, current - 2);
    i <= Math.min(total - 1, current + 2);
    i++
  )
    pages.add(i);
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
const StudentProfileOverview = () => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [sortKey, setSortKey] = useState("completion");
  const [sortAsc, setSortAsc] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState(null);

  // Pagination state
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [search, filter, sortKey, sortAsc]);

  const fetchOverview = useCallback(async () => {
    const token = localStorage.getItem("schoolAdminToken");
    if (!token) return;
    setLoading(true);
    try {
      const res = await axios.get(
        "/api/school-admin/students/profile-overview",
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      setStudents(res.data);
    } catch (err) {
      console.error(
        "Profile overview fetch error:",
        err.response?.data || err.message,
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  // ── Filter + sort ──────────────────────────────────────────────────────────
  const filtered = students
    .filter((s) => {
      const matchSearch =
        s.name?.toLowerCase().includes(search.toLowerCase()) ||
        s.email?.toLowerCase().includes(search.toLowerCase());
      const matchFilter =
        filter === "all"
          ? true
          : filter === "stalled"
            ? s.completion < 60
            : filter === "on-track"
              ? s.completion >= 80
              : true;
      return matchSearch && matchFilter;
    })
    .sort((a, b) => {
      const av = sortKey === "name" ? (a.name ?? "") : a.completion;
      const bv = sortKey === "name" ? (b.name ?? "") : b.completion;
      if (av < bv) return sortAsc ? -1 : 1;
      if (av > bv) return sortAsc ? 1 : -1;
      return 0;
    });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleSort = (key) => {
    if (sortKey === key) setSortAsc((prev) => !prev);
    else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  const SortIcon = ({ col }) =>
    sortKey === col ? (
      sortAsc ? (
        <ChevronUp size={14} />
      ) : (
        <ChevronDown size={14} />
      )
    ) : (
      <ChevronDown size={14} className="opacity-30" />
    );

  // ── Aggregate stats ────────────────────────────────────────────────────────
  const avgCompletion = students.length
    ? Math.round(
        students.reduce((sum, x) => sum + x.completion, 0) / students.length,
      )
    : 0;
  const stalledCount = students.filter((s) => s.completion < 60).length;
  const completedCount = students.filter((s) => s.completion >= 80).length;

  return (
    <div className="p-8 bg-white rounded-xl shadow-md font-poppins">
      {/* ── Header ── */}
      <div className="flex justify-between items-start mb-6 flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-blue-600">
            Profile Completion
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Monitor and support students with incomplete profiles.
          </p>
        </div>

        {/* Quick stats */}
        <div className="flex gap-3 flex-wrap">
          {[
            {
              label: "Avg Completion",
              value: `${avgCompletion}%`,
              color: "text-blue-600 bg-blue-50 border-blue-200",
            },
            {
              label: "On Track",
              value: completedCount,
              color: "text-green-700 bg-green-50 border-green-200",
            },
            {
              label: "Stalled",
              value: stalledCount,
              color: "text-red-700 bg-red-50 border-red-200",
            },
          ].map((s) => (
            <div
              key={s.label}
              className={`border rounded-lg px-4 py-2 text-center ${s.color}`}
            >
              <div className="text-xl font-bold">{s.value}</div>
              <div className="text-xs mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Search + filter bar ── */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          {/*Add "!mt-0" for alignment - 05-08-2026 */}
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email"
            className="!mt-0 w-full pl-4 pr-10 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
          <Search
            size={16}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-400 pointer-events-none"
          />
        </div>

        <div className="flex gap-1 border border-gray-200 rounded-lg overflow-hidden text-sm">
          {["all", "stalled", "on-track"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 font-medium transition-colors capitalize ${
                filter === f
                  ? "bg-blue-600 text-white"
                  : "bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              {f === "all"
                ? "All"
                : f === "stalled"
                  ? "⚠ Stalled"
                  : "✓ On Track"}
            </button>
          ))}
        </div>
      </div>

      {/* ── Table ── */}
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm text-left border border-blue-200 rounded-lg overflow-hidden">
          <thead className="bg-pink-100 text-gray-700 text-base font-medium">
            <tr>
              <th className="px-6 py-4 border-r border-blue-200">
                <button
                  className="flex items-center gap-1"
                  onClick={() => handleSort("name")}
                >
                  Student <SortIcon col="name" />
                </button>
              </th>
              <th className="px-6 py-4 border-r border-blue-200">Email</th>
              <th className="px-6 py-4 border-r border-blue-200">
                <button
                  className="flex items-center gap-1"
                  onClick={() => handleSort("completion")}
                >
                  Completion <SortIcon col="completion" />
                </button>
              </th>
              <th className="px-6 py-4 border-r border-blue-200">Status</th>
              <th className="px-6 py-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="5" className="text-center py-8">
                  <div className="flex justify-center items-center gap-2 text-blue-500">
                    <Loader2 className="animate-spin" size={20} />
                    <span>Loading profiles…</span>
                  </div>
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan="5" className="text-center py-6 text-gray-500">
                  No students match your filter.
                </td>
              </tr>
            ) : (
              paginated.map((student) => (
                <tr
                  key={student._id}
                  className="bg-white border-t border-blue-100 hover:bg-blue-50 transition-colors"
                >
                  {/* Name + avatar */}
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <StudentAvatar
                        src={student.profileImage}
                        name={student.name}
                      />
                      <span className="font-medium text-gray-800">
                        {student.name || "—"}
                      </span>
                    </div>
                  </td>

                  {/* Email */}
                  <td className="px-6 py-4 text-gray-600">{student.email}</td>

                  {/* Completion ring */}
                  <td className="px-6 py-4">
                    <CompletionRing pct={student.completion} />
                  </td>

                  {/* Badge */}
                  <td className="px-6 py-4">
                    <CompletionBadge pct={student.completion} />
                  </td>

                  {/* Deep-dive button */}
                  <td className="px-6 py-4">
                    <button
                      onClick={() => setSelectedStudent(student)}
                      className="inline-flex items-center gap-1.5 bg-blue-500 hover:bg-blue-600 text-white text-sm px-4 py-1.5 rounded-md transition"
                    >
                      <Eye size={14} /> View Profile
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex justify-center px-4 py-8 bg-gray-50/50 rounded-b-lg">
          <div className="flex items-center gap-1.5 bg-white p-1.5 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-gray-100/50">
            {/* Prev */}
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-slate-50 text-slate-500 hover:bg-slate-100 disabled:text-slate-400 disabled:bg-slate-50/50"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              Previous
            </button>

            {/* Windowed page numbers */}
            {getPageNumbers(page, totalPages).map((p, i) =>
              p === "..." ? (
                <div
                  key={`ellipsis-${i}`}
                  className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-50 text-slate-400 text-sm font-semibold select-none"
                >
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
              ),
            )}

            {/* Next */}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-slate-50 text-slate-700 hover:bg-slate-100 disabled:text-slate-400 disabled:bg-slate-50/50"
            >
              Next
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* ── Detail modal ── */}
      {selectedStudent && (
        <StudentProfileDetailModal
          studentId={selectedStudent._id}
          onClose={() => setSelectedStudent(null)}
        />
      )}
    </div>
  );
};

export default StudentProfileOverview;
