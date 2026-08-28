import React, { useState, useEffect, useCallback, useRef } from "react";
import axios from "../../../../../api/axiosInstance";
import {
  FaMapMarkerAlt,
  FaCalendarAlt,
  FaDollarSign,
  FaLaptopHouse,
  FaHeart,
  FaSearch,
  FaTimes,
  FaChevronLeft,
  FaChevronRight,
} from "react-icons/fa";
import { AiOutlineStar, AiOutlineLike, AiOutlineDislike } from "react-icons/ai";

const AI_API = "/api/ai";

const PAGE_SIZE = 6;

/* ─────────────────────────── FILTER CONFIG ─────────────────────────── */
const FILTER_GROUPS = [
  {
    key: "sector",
    label: "Sector",
    options: [
      { value: "advanced-ai", label: "Advanced AI" },
      { value: "quantum-computing", label: "Quantum Computing" },
      { value: "climate-tech", label: "Climate Tech" },
      { value: "biotech", label: "Biotech" },
      { value: "materials-science", label: "Materials Science" },
    ],
  },
  {
    key: "internshipType",
    label: "Type",
    options: [
      { value: "FREE", label: "Free" },
      { value: "STIPEND", label: "Stipend" },
      { value: "PAID", label: "Paid" },
    ],
  },
  {
    key: "internshipMode",
    label: "Mode",
    options: [
      { value: "ONLINE", label: "Online" },
      { value: "OFFLINE", label: "Offline" },
      { value: "HYBRID", label: "Hybrid" },
    ],
  },
  {
    key: "classification",
    label: "Level",
    options: [
      { value: "Basic", label: "Basic" },
      { value: "Intermediate", label: "Intermediate" },
      { value: "Advanced", label: "Advanced" },
    ],
  },
];

/* ─────────────────────────── SKELETON CARD ─────────────────────────── */
const SkeletonCard = () => (
  <div className="bg-white shadow-sm rounded-2xl p-5 animate-pulse border border-gray-100">
    <div className="flex items-start gap-3 mb-4">
      <div className="w-10 h-10 rounded-full bg-gray-200" />
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-gray-200 rounded w-3/4" />
        <div className="h-3 bg-gray-100 rounded w-1/2" />
      </div>
      <div className="w-14 h-5 bg-gray-100 rounded-full" />
    </div>
    <div className="space-y-2 mb-4">
      {[70, 55, 45, 40].map((w, i) => (
        <div
          key={i}
          className={`h-3 bg-gray-100 rounded`}
          style={{ width: `${w}%` }}
        />
      ))}
    </div>
    <div className="flex gap-2 mb-4">
      {[60, 80, 50].map((w, i) => (
        <div
          key={i}
          className="h-6 bg-gray-100 rounded-full"
          style={{ width: `${w}px` }}
        />
      ))}
    </div>
    <div className="grid grid-cols-2 gap-2">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-8 bg-gray-100 rounded-lg" />
      ))}
    </div>
  </div>
);

/* ─────────────────────────── EMPTY STATE ─────────────────────────── */
const EmptyState = ({ query, onClear }) => (
  <div className="col-span-full flex flex-col items-center justify-center py-20 text-center">
    <div className="w-20 h-20 rounded-full bg-purple-50 flex items-center justify-center mb-4">
      <FaSearch className="text-purple-300 text-2xl" />
    </div>
    <h3 className="text-lg font-semibold text-gray-700 mb-1">
      {query ? `No results for "${query}"` : "No internships available"}
    </h3>
    <p className="text-sm text-gray-400 mb-4">
      {query
        ? "Try a different keyword or clear the search."
        : "Check back later for new opportunities."}
    </p>
    {query && (
      <button
        onClick={onClear}
        className="px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
      >
        Clear Search
      </button>
    )}
  </div>
);

/* ─────────────────────────── MINI STAT ─────────────────────────── */
const MiniStat = ({ icon, label, bg, onClick }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg ${bg} cursor-pointer hover:opacity-80 transition text-xs font-medium w-full`}
  >
    {icon}
    <span>{label}</span>
  </button>
);

/* ─────────────────────────── DETAILS MODAL ─────────────────────────── */
const InternshipDetailsModal = ({ internship, onClose }) => {
  if (!internship) return null;

  // Local formatDate to avoid hoisting issues with the one at the bottom
  const formatDateLocal = (dateStr) => {
    if (!dateStr) return "—";
    try {
      return new Date(dateStr).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex justify-center items-center z-[100] p-4 sm:p-6 overflow-y-auto">
      <div
        className="bg-white rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl border border-white/20 transform transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-purple-50 to-indigo-50/50 sticky top-0 z-10 flex items-start justify-between rounded-t-2xl">
          <div className="flex items-center gap-5">
            <div className="bg-white p-2 rounded-xl shadow-sm border border-purple-100 shrink-0">
              <img
                src={
                  internship.imgUrl ||
                  "https://dummyimage.com/100x100/f3f4f6/a855f7&text=No+Logo"
                }
                alt={internship.companyName || "Company"}
                className="w-14 h-14 sm:w-16 sm:h-16 rounded-lg object-contain"
              />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-gray-900 tracking-tight mb-0.5">
                {internship.jobTitle || "Internship"}
              </h2>
              <p className="text-sm sm:text-base text-purple-600 font-semibold">
                {internship.companyName || "Unknown Company"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-white shadow-sm text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0 border border-gray-100"
            aria-label="Close details"
          >
            <FaTimes className="text-sm" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-grow text-gray-700 space-y-6 bg-white/50">
          {/* Quick Info Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Location */}
            <div className="flex items-center gap-3 p-4 bg-gradient-to-br from-blue-50 to-indigo-50/50 rounded-xl border border-blue-100/50 hover:shadow-sm transition-shadow">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                <FaMapMarkerAlt className="text-blue-600 text-lg" />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-blue-600/70 uppercase tracking-wider mb-0.5">
                  Location
                </p>
                <p className="font-bold text-gray-900 text-sm leading-tight">
                  {internship.location || "—"}
                </p>
              </div>
            </div>

            {/* Duration */}
            <div className="flex items-center gap-3 p-4 bg-gradient-to-br from-emerald-50 to-green-50/50 rounded-xl border border-emerald-100/50 hover:shadow-sm transition-shadow">
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                <FaCalendarAlt className="text-emerald-600 text-lg" />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-emerald-600/70 uppercase tracking-wider mb-0.5">
                  Duration
                </p>
                <p className="font-bold text-gray-900 text-sm leading-tight">
                  {formatDateLocal(internship.startDate)} –{" "}
                  {formatDateLocal(internship.endDateOrDuration)}
                </p>
              </div>
            </div>

            {/* Pay / Stipend */}
            <div className="flex items-center gap-3 p-4 bg-gradient-to-br from-orange-50 to-yellow-50/50 rounded-xl border border-orange-100/50 hover:shadow-sm transition-shadow">
              <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
                <FaDollarSign className="text-orange-600 text-lg" />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-orange-600/70 uppercase tracking-wider mb-0.5">
                  Compensation
                </p>
                <p className="font-bold text-gray-900 text-sm leading-tight">
                  {internship.pay || "Unpaid / Free"}
                </p>
              </div>
            </div>

            {/* Mode / Type */}
            <div className="flex items-center gap-3 p-4 bg-gradient-to-br from-purple-50 to-pink-50/50 rounded-xl border border-purple-100/50 hover:shadow-sm transition-shadow">
              <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
                <FaLaptopHouse className="text-purple-600 text-lg" />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-purple-600/70 uppercase tracking-wider mb-0.5">
                  Mode / Type
                </p>
                <p className="font-bold text-gray-900 text-sm leading-tight">
                  {internship.internshipMode || "—"} ·{" "}
                  {internship.internshipType || "—"}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column (Description) */}
            <div className="lg:col-span-2 space-y-6">
              {internship.jobDescription && (
                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                    <span className="w-1 h-5 bg-purple-500 rounded-full inline-block"></span>
                    About the Internship
                  </h3>
                  <div className="prose prose-sm prose-purple max-w-none text-gray-600 leading-relaxed whitespace-pre-wrap">
                    {internship.jobDescription}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column (Skills & Meta) */}
            <div className="space-y-6">
              {/* Skills */}
              {((internship.qualifications &&
                internship.qualifications.length > 0) ||
                (internship.skills && internship.skills.length > 0)) && (
                <div className="bg-gray-50/80 p-5 rounded-xl border border-gray-100">
                  <h3 className="text-base font-bold text-gray-900 mb-3">
                    Skills & Requirements
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {(internship.qualifications?.length
                      ? internship.qualifications
                      : internship.skills
                    ).map((q, i) => (
                      <span
                        key={i}
                        className="px-2.5 py-1 bg-white border border-purple-100 text-purple-700 text-[13px] rounded-lg font-medium shadow-sm"
                      >
                        {q}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Classification & Sector */}
              {(internship.sector || internship.classification) && (
                <div className="bg-gray-50/80 p-5 rounded-xl border border-gray-100 space-y-3">
                  {internship.sector && (
                    <div>
                      <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-0.5">
                        Industry Sector
                      </p>
                      <p className="text-sm font-bold text-gray-800">
                        {internship.sector}
                      </p>
                    </div>
                  )}
                  {internship.classification && (
                    <div>
                      <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-0.5">
                        Experience Level
                      </p>
                      <span className="inline-block px-2.5 py-1 bg-indigo-100 text-indigo-700 font-semibold text-xs rounded-md">
                        {internship.classification}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ─────────────────────────── STATUS MODAL ─────────────────────────── */
const StatusModal = ({ status, students, loading, onClose }) => (
  <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center z-50 p-4">
    <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b flex items-center justify-between bg-gradient-to-r from-purple-50 to-pink-50">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">
            Students — <span className="text-purple-600">{status}</span>
          </h2>
          {!loading && (
            <p className="text-xs text-gray-400 mt-0.5">
              {students.length} student{students.length !== 1 ? "s" : ""} found
            </p>
          )}
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-full bg-white shadow text-gray-500 hover:text-red-500 hover:shadow-md transition"
        >
          <FaTimes className="text-sm" />
        </button>
      </div>

      {/* Body */}
      <div className="overflow-y-auto flex-grow">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <div className="w-10 h-10 rounded-full border-4 border-pink-200 border-t-pink-500 animate-spin" />
            <p className="text-sm text-gray-400">Loading students…</p>
          </div>
        ) : students.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-2">
            <p className="text-gray-500 font-medium">
              No students in this category
            </p>
            <p className="text-sm text-gray-400">
              Nobody has been marked as {status} yet.
            </p>
          </div>
        ) : (
          <table className="w-full text-sm text-gray-700">
            <thead className="bg-pink-50 sticky top-0 z-10">
              <tr>
                {["Name", "Email", "Applied Date", "Resume", "Status"].map(
                  (h) => (
                    <th
                      key={h}
                      className="text-left px-5 py-3 font-semibold text-gray-600 border-b border-pink-100"
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {students.map((s, i) => (
                <tr
                  key={i}
                  className="hover:bg-gray-50 transition border-b border-gray-50"
                >
                  <td className="px-5 py-3 font-medium">{s.userName}</td>
                  <td className="px-5 py-3 text-gray-500">{s.userEmail}</td>
                  <td className="px-5 py-3 text-gray-500">
                    {s.appliedDate
                      ? new Date(s.appliedDate).toLocaleDateString()
                      : "—"}
                  </td>
                  <td className="px-5 py-3">
                    {s.resumeUrl ? (
                      <a
                        href={s.resumeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:underline font-medium"
                      >
                        View Resume
                      </a>
                    ) : (
                      <span className="text-gray-400">N/A</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                        s.status === "Accepted"
                          ? "bg-green-100 text-green-700"
                          : s.status === "Rejected"
                            ? "bg-red-100 text-red-600"
                            : s.status === "Shortlisted"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {s.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  </div>
);

/* ─────────────────────────── PAGINATION ─────────────────────────── */
const Pagination = ({ page, totalPages, onPageChange, loading }) => {
  if (totalPages <= 1) return null;

  const pages = [];
  const delta = 2;
  for (
    let i = Math.max(1, page - delta);
    i <= Math.min(totalPages, page + delta);
    i++
  ) {
    pages.push(i);
  }

  return (
    <div className="col-span-full flex items-center justify-center gap-2 pt-4 pb-8">
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page === 1 || loading}
        className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-purple-50 hover:border-purple-200 hover:text-purple-600 disabled:opacity-40 disabled:cursor-not-allowed transition"
      >
        <FaChevronLeft className="text-xs" />
      </button>

      {pages[0] > 1 && (
        <>
          <button
            onClick={() => onPageChange(1)}
            className="w-9 h-9 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-purple-50 hover:border-purple-200 hover:text-purple-600 transition"
          >
            1
          </button>
          {pages[0] > 2 && (
            <span className="text-gray-400 text-sm px-1">…</span>
          )}
        </>
      )}

      {pages.map((p) => (
        <button
          key={p}
          onClick={() => onPageChange(p)}
          disabled={loading}
          className={`w-9 h-9 rounded-lg border text-sm font-medium transition disabled:cursor-not-allowed ${
            p === page
              ? "bg-purple-600 border-purple-600 text-white shadow-sm"
              : "border-gray-200 text-gray-600 hover:bg-purple-50 hover:border-purple-200 hover:text-purple-600"
          }`}
        >
          {p}
        </button>
      ))}

      {pages[pages.length - 1] < totalPages && (
        <>
          {pages[pages.length - 1] < totalPages - 1 && (
            <span className="text-gray-400 text-sm px-1">…</span>
          )}
          <button
            onClick={() => onPageChange(totalPages)}
            className="w-9 h-9 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-purple-50 hover:border-purple-200 hover:text-purple-600 transition"
          >
            {totalPages}
          </button>
        </>
      )}

      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page === totalPages || loading}
        className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-purple-50 hover:border-purple-200 hover:text-purple-600 disabled:opacity-40 disabled:cursor-not-allowed transition"
      >
        <FaChevronRight className="text-xs" />
      </button>
    </div>
  );
};

/* ─────────────────────────── MAIN COMPONENT ─────────────────────────── */
const Internships = () => {
  const [internships, setInternships] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Saved Jobs
  const [savedJobs, setSavedJobs] = useState([]);

  // Search
  const [searchQuery, setSearchQuery] = useState("");
  const debounceRef = useRef(null);
  // debouncedQuery tracks what was last actually fetched (for display labels)
  const [debouncedQuery, setDebouncedQuery] = useState("");

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Filters
  const [activeFilters, setActiveFilters] = useState({
    sector: null,
    internshipType: null,
    internshipMode: null,
    classification: null,
  });
  const hasActiveFilters = Object.values(activeFilters).some(Boolean);
  const clearAllFilters = () =>
    setActiveFilters({
      sector: null,
      internshipType: null,
      internshipMode: null,
      classification: null,
    });

  // Modal
  const [modalStatus, setModalStatus] = useState(null);
  const [applications, setApplications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isFetchingApplications, setIsFetchingApplications] = useState(false);

  // Details Modal
  const [detailsInternship, setDetailsInternship] = useState(null);

  const fetchInternships = useCallback(async (pageNumber = 1, query = "") => {
    try {
      setLoading(true);
      setError(null);

      const params = { page: pageNumber, limit: PAGE_SIZE };
      if (query && query.trim()) params.search = query.trim();

      const response = await axios.get("/api/interns/approved", { params });
      const d = response.data;

      setInternships(d.data || []);
      setPage(pageNumber);
      setDebouncedQuery(query || ""); // sync label to what was actually fetched

      if (d.totalCount !== undefined && d.totalCount !== null) {
        const count = Number(d.totalCount);
        setTotalCount(count);
        setTotalPages(Math.ceil(count / PAGE_SIZE) || 1);
      } else if (d.totalPages !== undefined && d.totalPages !== null) {
        setTotalPages(Number(d.totalPages) || 1);
        setTotalCount((Number(d.totalPages) || 1) * PAGE_SIZE);
      }
    } catch (err) {
      setError("Failed to load internships. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Single mount effect — runs exactly once, no dependency races
  useEffect(() => {
    fetchInternships(1, "");
    fetchSavedJobs();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchSavedJobs = useCallback(async () => {
    try {
      const token =
        localStorage.getItem("schoolAdminToken") ||
        localStorage.getItem("token");
      const { data } = await axios.get("/api/school-admin/saved-jobs", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const schoolAdminId =
        localStorage.getItem("schoolAdminId") ||
        localStorage.getItem("adminId");
      const adminSaved = (data.savedJobs || []).filter(
        (sj) => sj.userId?._id === schoolAdminId || sj.userId === schoolAdminId,
      );
      setSavedJobs(adminSaved);
    } catch (err) {
      console.error("Failed to load saved jobs", err);
    }
  }, []);

  const isJobSaved = (jobId) =>
    savedJobs.some(
      (savedJob) =>
        savedJob.jobId?._id === jobId ||
        savedJob.jobId === jobId ||
        savedJob._id === jobId,
    );

  const toggleSaveJob = async (job) => {
    try {
      const schoolAdminId =
        localStorage.getItem("schoolAdminId") ||
        localStorage.getItem("adminId");
      const token =
        localStorage.getItem("schoolAdminToken") ||
        localStorage.getItem("token");
      if (!schoolAdminId || !token) return;

      if (isJobSaved(job._id)) {
        await axios.delete(
          `/api/school-admin/saved-jobs/remove/${schoolAdminId}/${job._id}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        setSavedJobs((prev) =>
          prev.filter(
            (sj) => sj.jobId?._id !== job._id && sj.jobId !== job._id,
          ),
        );
      } else {
        const { data } = await axios.post(
          "/api/school-admin/saved-jobs/save",
          { schoolAdminId, jobId: job._id },
          { headers: { Authorization: `Bearer ${token}` } },
        );
        setSavedJobs((prev) => [
          ...prev,
          data?.jobId ? data : { ...data, jobId: job },
        ]);
      }
    } catch (err) {
      console.error("Error toggling save job:", err);
    }
  };

  // Search input handler — debounce then fetch, never resets state mid-flight
  const handleSearchChange = (e) => {
    const q = e.target.value;
    setSearchQuery(q);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(1);
      fetchInternships(1, q);
    }, 350);
  };

  const handlePageChange = (newPage) => {
    fetchInternships(newPage, searchQuery);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const openModal = async (status, internshipId) => {
    // Try multiple possible token keys — whichever your auth flow stores
    const token =
      localStorage.getItem("schoolAdminToken") ||
      localStorage.getItem("token") ||
      localStorage.getItem("authToken") ||
      localStorage.getItem("adminToken");

    const schoolAdminId =
      localStorage.getItem("schoolAdminId") || localStorage.getItem("adminId");

    if (!token) {
      alert("Session expired. Please log in again.");
      return;
    }
    if (!internshipId || !schoolAdminId) {
      alert("Missing required data. Please login again.");
      return;
    }

    setIsOpen(true);
    setModalStatus(status);
    setApplications([]);
    setIsFetchingApplications(true);

    try {
      let response;

      if (status === "Shortlisted") {
        // Route fixed: Airoutes.js now uses protectSchool instead of authenticate
        // so schoolAdminToken is accepted correctly. Call through the Node proxy.
        response = await axios.get(
          `${AI_API}/partner/shortlisted/by-admin?internship_id=${internshipId}&school_admin_id=${schoolAdminId}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        setApplications(
          (response.data.shortlisted_candidates || []).map((c) => ({
            userName: c.name || "N/A",
            userEmail: c.email || "N/A",
            appliedDate: c.appliedDate || "",
            resumeUrl: c.resumeUrl || "",
            status: "Shortlisted",
          })),
        );
      } else if (status === "Accepted" || status === "Rejected") {
        response = await axios.get(
          `/api/offer-letters/internship/${internshipId}?schoolAdminId=${schoolAdminId}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        setApplications(
          response.data.offers
            .filter((o) => o.status === status)
            .map((o) => ({
              userName: o.name,
              userEmail: o.email,
              appliedDate: o.sentDate,
              resumeUrl: o.s3Url,
              status: o.status,
            })),
        );
      } else {
        response = await axios.get(
          `/api/applications/internship/${internshipId}?schoolAdmin=${schoolAdminId}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        setApplications(response.data.applications);
      }
    } catch (err) {
      setApplications([]);
    } finally {
      setIsFetchingApplications(false);
    }
  };

  const closeModal = () => {
    setIsOpen(false);
    setModalStatus(null);
    setApplications([]);
  };

  return (
    <div className="min-h-screen bg-gray-50 font-poppins">
      {/* ── Search bar + summary ── */}
      {/*Remove "sticky" for mobile alignment - 05-08-2026  */}
      <div className="top-0 z-30 bg-white border-b border-gray-100 shadow-sm px-6 py-4">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row sm:items-center gap-3">
          {/* Search input */}
          <div className="relative flex-1">
            <FaSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none" />
            {/*Add !mt-0 for alignment - 05-08-2026 */}
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder="Search by title, company, skills, location…"
              className="!mt-0 w-full pl-9 pr-9 py-2.5 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent bg-gray-50 placeholder-gray-400 transition"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  clearTimeout(debounceRef.current);
                  setPage(1);
                  fetchInternships(1, "");
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
              >
                <FaTimes className="text-xs" />
              </button>
            )}
          </div>

          {/* Result count */}
          <p className="text-sm text-gray-500 whitespace-nowrap shrink-0">
            {loading ? (
              <span className="inline-block w-24 h-4 bg-gray-200 rounded animate-pulse" />
            ) : (
              <>
                {totalCount > 0
                  ? `${totalCount} internship${totalCount !== 1 ? "s" : ""}${debouncedQuery ? ` for "${debouncedQuery}"` : ""}`
                  : debouncedQuery
                    ? `No results for "${debouncedQuery}"`
                    : "No internships found"}
                {totalPages > 1 && ` · Page ${page} of ${totalPages}`}
              </>
            )}
          </p>
        </div>

        {/* Filter dropdowns */}
        <div className="max-w-5xl mx-auto pt-3 pb-1">
          <div className="flex flex-wrap gap-3">
            {FILTER_GROUPS.map((group) => (
              <div key={group.key} className="flex flex-col gap-1">
                <label className="text-xs text-gray-500 font-medium">
                  {group.label}
                </label>
                <select
                  value={activeFilters[group.key] ?? ""}
                  onChange={(e) =>
                    setActiveFilters((prev) => ({
                      ...prev,
                      [group.key]: e.target.value || null,
                    }))
                  }
                  className="px-3 py-2 rounded-lg text-sm border border-gray-200 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-purple-400 cursor-pointer min-w-[130px] transition"
                >
                  <option value="">All {group.label}s</option>
                  {group.options.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            ))}
            {hasActiveFilters && (
              <div className="flex flex-col justify-end">
                <button
                  onClick={clearAllFilters}
                  className="text-xs text-purple-600 underline hover:text-purple-800 pb-2"
                >
                  Clear all filters
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Grid ── */}
      <div className="p-6 max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Loading skeletons */}
        {loading &&
          Array.from({ length: PAGE_SIZE }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}

        {/* Error state */}
        {error && !loading && (
          <div className="col-span-full text-center py-12">
            <p className="text-red-500 font-medium mb-3">{error}</p>
            <button
              onClick={() => fetchInternships(page, debouncedQuery)}
              className="px-5 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && internships.length === 0 && (
          <EmptyState
            query={debouncedQuery}
            onClear={() => {
              setSearchQuery("");
              clearTimeout(debounceRef.current);
              setPage(1);
              fetchInternships(1, "");
            }}
          />
        )}

        {/* Cards */}
        {!loading &&
          !error &&
          internships
            .filter((item) =>
              Object.entries(activeFilters).every(
                ([key, val]) => !val || item[key] === val,
              ),
            )
            .map((item) => (
              <div
                key={item._id}
                className="bg-white shadow-sm hover:shadow-md transition-shadow rounded-2xl p-5 relative border border-gray-100 flex flex-col"
              >
                {/* Top Right Actions: Save & Type badge */}
                <div className="absolute top-4 right-4 flex items-center gap-3">
                  <button
                    onClick={() => toggleSaveJob(item)}
                    className={`transition text-[22px] mt-0.5 ${isJobSaved(item._id) ? "text-pink-500" : "text-gray-200 hover:text-pink-400"}`}
                    aria-label={
                      isJobSaved(item._id) ? "Unsave job" : "Save job"
                    }
                  >
                    <FaHeart />
                  </button>
                  <span
                    className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                      item.internshipType === "STIPEND"
                        ? "bg-blue-100 text-blue-700"
                        : item.internshipType === "PAID"
                          ? "bg-red-100 text-red-700"
                          : "bg-green-100 text-green-700"
                    }`}
                  >
                    {item.internshipType || "FREE"}
                  </span>
                </div>

                {/* Header */}
                <div className="flex items-start gap-3">
                  <img
                    src={
                      item.imgUrl ||
                      "https://dummyimage.com/40x40/cccccc/000000&text=No+Image"
                    }
                    alt="logo"
                    className="w-10 h-10 object-contain rounded-full border border-gray-100 shrink-0"
                  />
                  {/*Add pr-2 change pr-28 to sm:pr-28 for ID alignment in tablet - 10-08-2026 */}
                  <div className="min-w-0 pr-2 sm:pr-28">
                    <h3 className="text-base font-semibold text-gray-800 truncate">
                      {item.jobTitle}
                    </h3>
                    <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
                      {item.companyName}
                      <span className="text-gray-300">·</span>
                      <span>{formatPostedDate(item.createdAt)}</span>
                    </p>
                    {/*Remove "whitespace-nowrap"  for tab alignment - 10-08-2026*/}
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      ID: {item._id}
                    </p>
                  </div>
                </div>

                {/* Details */}
                <div className="text-sm text-gray-600 mt-4 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <FaMapMarkerAlt className="text-gray-400 shrink-0" />
                    <span className="truncate">{item.location}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <FaCalendarAlt className="text-gray-400 shrink-0" />
                    <span>
                      {formatDate(item.startDate)} –{" "}
                      {formatDate(item.endDateOrDuration)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <FaDollarSign className="text-gray-400 shrink-0" />
                    <span>{item.pay || "Unpaid / Free"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <FaLaptopHouse className="text-gray-400 shrink-0" />
                    <span>{item.internshipType}</span>
                  </div>
                </div>

                {/* Skills */}
                {item.skills?.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {item.skills.slice(0, 5).map((skill, i) => (
                      <span
                        key={i}
                        className="px-2.5 py-0.5 bg-purple-50 text-purple-700 text-xs rounded-full font-medium"
                      >
                        {skill}
                      </span>
                    ))}
                    {item.skills.length > 5 && (
                      <span className="px-2.5 py-0.5 bg-gray-100 text-gray-500 text-xs rounded-full">
                        +{item.skills.length - 5}
                      </span>
                    )}
                  </div>
                )}

                {/* Footer */}
                <div className="mt-4 flex justify-end items-center">
                  <button
                    onClick={() => setDetailsInternship(item)}
                    className="text-purple-600 text-sm font-medium hover:text-purple-700 hover:underline transition"
                  >
                    View details
                  </button>
                </div>

                {/* Status actions */}
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-medium">
                  <MiniStat
                    icon={<FaLaptopHouse className="text-orange-400" />}
                    label="Applied"
                    bg="bg-orange-50 text-orange-700"
                    onClick={() => openModal("Applied", item._id)}
                  />
                  <MiniStat
                    icon={<AiOutlineStar className="text-green-500" />}
                    label="Shortlisted"
                    bg="bg-green-50 text-green-700"
                    onClick={() => openModal("Shortlisted", item._id)}
                  />
                  <MiniStat
                    icon={<AiOutlineLike className="text-pink-500" />}
                    label="Accepted"
                    bg="bg-pink-50 text-pink-700"
                    onClick={() => openModal("Accepted", item._id)}
                  />
                  <MiniStat
                    icon={<AiOutlineDislike className="text-indigo-400" />}
                    label="Rejected"
                    bg="bg-indigo-50 text-indigo-700"
                    onClick={() => openModal("Rejected", item._id)}
                  />
                </div>
              </div>
            ))}

        {/* Pagination */}
        {!loading && !error && internships.length > 0 && (
          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={handlePageChange}
            loading={loading}
          />
        )}
      </div>

      {/* Modal */}
      {isOpen && (
        <StatusModal
          status={modalStatus}
          loading={isFetchingApplications}
          students={applications}
          onClose={closeModal}
        />
      )}

      {/* Details Modal */}
      {detailsInternship && (
        <InternshipDetailsModal
          internship={detailsInternship}
          onClose={() => setDetailsInternship(null)}
        />
      )}
    </div>
  );
};

/* ─────────────────────────── HELPERS ─────────────────────────── */
const formatPostedDate = (dateStr) => {
  if (!dateStr) return "";
  const daysAgo = Math.floor((Date.now() - new Date(dateStr)) / 86400000);
  if (daysAgo === 0) return "Today";
  if (daysAgo === 1) return "1d ago";
  return `${daysAgo}d ago`;
};

const formatDate = (dateStr) => {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
};

export default Internships;
