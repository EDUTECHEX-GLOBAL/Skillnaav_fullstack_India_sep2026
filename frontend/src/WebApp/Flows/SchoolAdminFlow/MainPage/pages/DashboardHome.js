import React, { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
  AreaChart,
  Area,
} from "recharts";
import {
  FiKey,
  FiClock,
  FiBarChart2,
  FiUploadCloud,
  FiTrendingUp,
  FiTrendingDown,
  FiRefreshCw,
} from "react-icons/fi";
import { BsFileEarmarkCheck, BsClipboardData } from "react-icons/bs";
import { motion } from "framer-motion";
import axios from "../../../../../api/axiosInstance";
import Papa from "papaparse";

const COLORS = ["#10B981", "#F59E0B", "#EF4444", "#4F46E5", "#E5E7EB"];

// ─── Full-Page Blur Overlay + Modal ──────────────────────────────────────────
function UploadOverlay({ modal, onClose }) {
  if (!modal.show) return null;

  const { generated, total, phase, currentName } = modal;
  const pct = total > 0 ? Math.round((generated / total) * 100) : 0;
  const isDone = phase === "done";

  const STEP_ORDER = [
    "parsing",
    "validating",
    "generating",
    "emailing",
    "done",
  ];
  const currentIdx = STEP_ORDER.indexOf(phase);

  const steps = [
    { key: "parsing", label: "CSV file parsed" },
    { key: "validating", label: "Student records validated" },
    { key: "generating", label: "Generating credentials" },
    { key: "emailing", label: "Emails sent to students" },
  ];

  return (
    <>
      <style>{`
        @keyframes overlayIn  { from{opacity:0} to{opacity:1} }
        @keyframes modalUp    { from{opacity:0;transform:translateY(24px) scale(0.96)} to{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes spinAnim   { to{transform:rotate(360deg)} }
        @keyframes pulseDot   { 0%,100%{opacity:1} 50%{opacity:0.28} }
        @keyframes countPop   { 0%{transform:scale(1)} 40%{transform:scale(1.2)} 100%{transform:scale(1)} }
        @keyframes shimmer    { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
      `}</style>

      {/* ── Fixed overlay — covers sidebar + entire viewport ── */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9999,
          backdropFilter: "blur(7px)",
          WebkitBackdropFilter: "blur(7px)",
          background: "rgba(10, 15, 40, 0.58)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          animation: "overlayIn 0.28s ease",
          pointerEvents: "all",
        }}
      >
        {/* ── Modal card ── */}
        <div
          style={{
            background: "#ffffff",
            borderRadius: 22,
            padding: "32px 28px 26px",
            width: "100%",
            maxWidth: 460,
            margin: "0 16px",
            boxShadow: "0 30px 90px rgba(0,0,0,0.32)",
            animation: "modalUp 0.32s cubic-bezier(0.16,1,0.3,1)",
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              marginBottom: 8,
            }}
          >
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: "50%",
                flexShrink: 0,
                background: isDone ? "#D1FAE5" : "#EFF6FF",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {isDone ? (
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path
                    d="M4 10l4.5 4.5 8-9"
                    stroke="#059669"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : (
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  style={{ animation: "spinAnim 0.85s linear infinite" }}
                >
                  <circle
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="#BFDBFE"
                    strokeWidth="3"
                  />
                  <path
                    d="M12 2a10 10 0 0 1 10 10"
                    stroke="#3B82F6"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                </svg>
              )}
            </div>
            <div>
              <div style={{ fontSize: 17, fontWeight: 700, color: "#0F172A" }}>
                {isDone
                  ? "All Credentials Generated!"
                  : "Generating Credentials…"}
              </div>
              <div style={{ fontSize: 12, color: "#64748B", marginTop: 3 }}>
                {isDone
                  ? `${total} credentials created and emailed successfully.`
                  : "Page is locked — please do not navigate away."}
              </div>
            </div>
          </div>

          <div
            style={{ borderTop: "1px solid #F1F5F9", margin: "18px 0 16px" }}
          />

          {/* ── Live per-student counter ── */}
          <div
            style={{
              background: "linear-gradient(135deg,#F8FAFF,#EFF6FF)",
              border: "1px solid #DBEAFE",
              borderRadius: 14,
              padding: "18px 20px",
              marginBottom: 18,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#94A3B8",
                  letterSpacing: "0.08em",
                  marginBottom: 6,
                }}
              >
                CREDENTIALS GENERATED
              </div>

              {/* Big animated count */}
              <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                <span
                  key={generated}
                  style={{
                    fontSize: 44,
                    fontWeight: 800,
                    color: isDone ? "#059669" : "#3B82F6",
                    lineHeight: 1,
                    display: "inline-block",
                    animation: "countPop 0.38s ease",
                  }}
                >
                  {generated}
                </span>
                <span
                  style={{ fontSize: 24, color: "#CBD5E1", fontWeight: 300 }}
                >
                  /
                </span>
                <span
                  style={{ fontSize: 24, fontWeight: 600, color: "#94A3B8" }}
                >
                  {total}
                </span>
              </div>

              {/* Current student name */}
              {!isDone && currentName && (
                <div
                  style={{
                    fontSize: 12,
                    color: "#6366F1",
                    marginTop: 7,
                    fontStyle: "italic",
                    maxWidth: 230,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  Processing: {currentName}
                </div>
              )}
            </div>

            {/* Circular progress ring */}
            <svg width="70" height="70" viewBox="0 0 70 70">
              <circle
                cx="35"
                cy="35"
                r="29"
                fill="none"
                stroke="#E2E8F0"
                strokeWidth="6"
              />
              <circle
                cx="35"
                cy="35"
                r="29"
                fill="none"
                stroke={isDone ? "#10B981" : "#3B82F6"}
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 29}`}
                strokeDashoffset={`${2 * Math.PI * 29 * (1 - pct / 100)}`}
                transform="rotate(-90 35 35)"
                style={{
                  transition: "stroke-dashoffset 0.38s ease, stroke 0.38s ease",
                }}
              />
              <text
                x="35"
                y="35"
                textAnchor="middle"
                dominantBaseline="central"
                fontSize="13"
                fontWeight="700"
                fill={isDone ? "#059669" : "#3B82F6"}
              >
                {pct}%
              </text>
            </svg>
          </div>

          {/* ── Progress bar ── */}
          <div style={{ marginBottom: 20 }}>
            <div
              style={{
                height: 10,
                background: "#F1F5F9",
                borderRadius: 100,
                overflow: "hidden",
                position: "relative",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${pct}%`,
                  borderRadius: 100,
                  background: isDone
                    ? "linear-gradient(90deg,#059669,#10B981)"
                    : "linear-gradient(90deg,#3B82F6,#818CF8)",
                  transition: "width 0.35s ease",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                {!isDone && (
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      background:
                        "linear-gradient(90deg,transparent 0%,rgba(255,255,255,0.38) 50%,transparent 100%)",
                      backgroundSize: "200% 100%",
                      animation: "shimmer 1.4s linear infinite",
                    }}
                  />
                )}
              </div>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                marginTop: 5,
                fontSize: 12,
                color: isDone ? "#059669" : "#64748B",
                fontWeight: isDone ? 700 : 400,
              }}
            >
              {pct}%
            </div>
          </div>

          {/* ── Step list ── */}
          <div
            style={{
              background: "#F8FAFC",
              border: "1px solid #F1F5F9",
              borderRadius: 12,
              padding: "14px 16px",
              display: "flex",
              flexDirection: "column",
              gap: 11,
              marginBottom: 18,
            }}
          >
            {steps.map((s) => {
              const si = STEP_ORDER.indexOf(s.key);
              const done = currentIdx > si;
              const active = currentIdx === si;
              return (
                <div
                  key={s.key}
                  style={{ display: "flex", alignItems: "center", gap: 10 }}
                >
                  <div
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: "50%",
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: done
                        ? "#D1FAE5"
                        : active
                          ? "#DBEAFE"
                          : "#F1F5F9",
                      transition: "background 0.3s",
                    }}
                  >
                    {done ? (
                      <svg
                        width="11"
                        height="11"
                        viewBox="0 0 11 11"
                        fill="none"
                      >
                        <path
                          d="M2 5.5l2.5 2.5 4.5-5"
                          stroke="#059669"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    ) : active ? (
                      <div
                        style={{
                          width: 7,
                          height: 7,
                          borderRadius: "50%",
                          background: "#3B82F6",
                          animation: "pulseDot 1s ease-in-out infinite",
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 7,
                          height: 7,
                          borderRadius: "50%",
                          background: "#CBD5E1",
                        }}
                      />
                    )}
                  </div>
                  <span
                    style={{
                      fontSize: 13,
                      color: done ? "#065F46" : active ? "#1D4ED8" : "#94A3B8",
                      fontWeight: done || active ? 600 : 400,
                      transition: "color 0.3s",
                    }}
                  >
                    {s.key === "generating" && active
                      ? `Generating credential ${generated + 1} of ${total}…`
                      : s.label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* ── Lock warning ── */}
          {!isDone && (
            <div
              style={{
                background: "#FFFBEB",
                border: "1px solid #FDE68A",
                borderRadius: 10,
                padding: "10px 14px",
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 18,
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                style={{ flexShrink: 0 }}
              >
                <path
                  d="M8 1.5L14.5 13H1.5L8 1.5Z"
                  stroke="#D97706"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
                <path
                  d="M8 6v3.5"
                  stroke="#D97706"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
                <circle cx="8" cy="11.5" r="0.75" fill="#D97706" />
              </svg>
              <span style={{ fontSize: 12, color: "#92400E", lineHeight: 1.5 }}>
                🔒 Full page including sidebar is locked until credential
                generation completes.
              </span>
            </div>
          )}

          {/* ── Action button ── */}
          <button
            disabled={!isDone}
            onClick={onClose}
            style={{
              width: "100%",
              padding: "13px 0",
              borderRadius: 11,
              border: "none",
              background: isDone
                ? "linear-gradient(135deg,#4F46E5 0%,#6366F1 100%)"
                : "#E2E8F0",
              color: isDone ? "#fff" : "#94A3B8",
              fontWeight: 700,
              fontSize: 15,
              cursor: isDone ? "pointer" : "not-allowed",
              letterSpacing: "0.01em",
              boxShadow: isDone ? "0 4px 18px rgba(99,102,241,0.38)" : "none",
              transition: "all 0.22s",
            }}
          >
            {isDone
              ? "✓  Done — Close"
              : `Generating…  ${generated} / ${total}`}
          </button>
        </div>
      </div>
    </>
  );
}

const DashboardSkeleton = () => {
  return (
    <div className="animate-pulse space-y-6">
      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((item) => (
          <div key={item} className="h-52 rounded-2xl bg-gray-200" />
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[1, 2, 3, 4, 5, 6].map((item) => (
          <div key={item} className="h-80 rounded-2xl bg-gray-200" />
        ))}
      </div>
    </div>
  );
};

// ─── Mock Data for New Charts ────────────────────────────────────────────────
// ─── Dashboard ────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState("");
  const [creditError, setCreditError] = useState(""); // ← NEW
  const [progress, setProgress] = useState(null);
  //loading effect - 06-08-2026
  const [loading, setLoading] = useState(true);

  const [uploadModal, setUploadModal] = useState({
    show: false,
    generated: 0,
    total: 0,
    phase: "idle",
    currentName: "",
  });

  const [timeRange, setTimeRange] = useState("allTime");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [metrics, setMetrics] = useState({
    totalCredits: 0,
    generated: 0,
    remaining: 0,
    plan: "N/A",
    subscriptionStatus: "inactive",
    generatedThisPeriod: 0,
    generatedTrend: null,
  });

  const token = localStorage.getItem("schoolAdminToken");

  useEffect(() => {
    //06-08-2026
    setLoading(true);
    let query = `range=${timeRange}`;
    if (timeRange === "custom") {
      if (!customStart || !customEnd) {
        setLoading(false); // add this - 06-08-2026
        return; // Wait until both are picked to avoid useless requests
      }
      query += `&startDate=${customStart}&endDate=${customEnd}`;
    }

    axios
      .get(`/api/school-admin/dashboard-metrics?${query}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((r) => {
        setMetrics(r.data);
        console.log("schooladmin dashboard data", r.data);
      })
      .catch((e) => console.error("Failed to fetch metrics:", e))
      .finally(() => {
        setLoading(false);
        setIsRefreshing(false);
      });
  }, [token, timeRange, customStart, customEnd, refreshTrigger]);

  const handleCSVChange = (e) => {
    setSelectedFile(e.target.files[0]);
    setUploadStatus("");
    setCreditError(""); // ← clear error when new file is picked
  };

  const simulatePerStudentProgress = async (students) => {
    for (let i = 0; i < students.length; i++) {
      await delay(500);
      setUploadModal((prev) => ({
        ...prev,
        generated: i + 1,
        currentName: students[i]["Full Name"] || `Student ${i + 1}`,
      }));
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setUploadStatus("❗ Select a CSV file first.");
      return;
    }

    Papa.parse(selectedFile, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        // ── Validate headers ──────────────────────────────────────
        const requiredHeaders = [
          "Full Name",
          "Email Address",
          "School Name",
          "Grade",
          "Stream/Curriculum",
          "Field of Internship",
        ];
        const uploadedHeaders = Object.keys(results.data[0] || {});
        const isValid = requiredHeaders.every((h) =>
          uploadedHeaders.includes(h),
        );

        if (!isValid) {
          setUploadStatus(
            "❌ CSV format invalid. Expected columns: Full Name, Email Address, School Name, Grade, Stream/Curriculum, Field of Internship.",
          );
          return;
        }

        const students = results.data;
        const total = students.length;
        const remaining = metrics.remaining || 0;

        // ── Credit check ──────────────────────────────────────────
        if (total > remaining) {
          setCreditError(
            `Insufficient credits. You have ${remaining}, need ${total}.`,
          );
          return; // stop — do NOT open the upload overlay
        }
        setCreditError(""); // clear any previous error
        // ─────────────────────────────────────────────────────────

        // Phase 1 — parsing
        setUploadModal({
          show: true,
          generated: 0,
          total,
          phase: "parsing",
          currentName: "",
        });
        await delay(700);

        // Phase 2 — validating
        setUploadModal((p) => ({ ...p, phase: "validating" }));
        await delay(700);

        // Phase 3 — generating
        setUploadModal((p) => ({ ...p, phase: "generating" }));
        const formData = new FormData();
        formData.append("csvFile", selectedFile);

        try {
          const [res] = await Promise.all([
            axios.post("/api/school-admin/upload-students", formData, {
              headers: { Authorization: `Bearer ${token}` },
            }),
            simulatePerStudentProgress(students),
          ]);

          // Phase 4 — emailing
          setUploadModal((p) => ({
            ...p,
            phase: "emailing",
            generated: res.data.generated ?? total,
            currentName: "",
          }));
          await delay(900);

          // Phase 5 — done
          setUploadModal((p) => ({
            ...p,
            phase: "done",
            generated: res.data.generated ?? total,
          }));

          setProgress({ generated: res.data.generated, total: res.data.total });
          setUploadStatus(`✅ ${res.data.message}`);
        } catch (err) {
          console.error("Upload error:", err.response?.data || err.message);
          setUploadModal({
            show: false,
            generated: 0,
            total: 0,
            phase: "idle",
            currentName: "",
          });
          setUploadStatus("❌ Upload failed. Check console for details.");
        }
      },
      error: (err) => {
        console.error("CSV parse error:", err);
        setUploadStatus("❌ Failed to read the file.");
      },
    });
  };

  const handleModalClose = () => {
    setUploadModal({
      show: false,
      generated: 0,
      total: 0,
      phase: "idle",
      currentName: "",
    });
    setSelectedFile(null);
    setUploadStatus("");
    setCreditError("");
  };

  const stats = [
    {
      label: "Total Credentials Received",
      value: metrics.totalCredits || 0,
      icon: <FiBarChart2 size={32} />,
      color: "from-orange-400 to-orange-200",
      textColor: "text-orange-600",
      showTimeInfo: true,
    },
    {
      label: "Credentials Generated",
      // value: metrics.generated || 0,  --remove add the below one for filter - 06-05-2026
      value:
        timeRange === "allTime"
          ? metrics.generated
          : metrics.generatedThisPeriod,
      icon: <FiKey size={32} />,
      color: "from-green-400 to-green-200",
      textColor: "text-green-600",
      trend: metrics.generatedTrend,
      periodValue: metrics.generatedThisPeriod,
    },
    {
      label: "Remaining Credentials",
      value: metrics.remaining || 0,
      icon: <FiClock size={32} />,
      color: "from-pink-400 to-pink-200",
      textColor: "text-pink-600",
    },
    {
      label: "Upload Credentials CSV",
      type: "upload",
      icon: <FiUploadCloud size={32} />,
      color: "from-indigo-500 to-indigo-300",
      textColor: "text-indigo-700",
    },
  ];

  return (
    <div className="p-6 bg-gray-50 min-h-screen font-poppins">
      {/* 🔒 Blur overlay */}
      <UploadOverlay modal={uploadModal} onClose={handleModalClose} />
      {/* Header & Range Selector */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h2 className="text-2xl font-bold text-gray-800">Overview</h2>
        {/*Remove flex-wrap for mobile view compatibility - 05-08-2026 */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setIsRefreshing(true);
              setRefreshTrigger((prev) => prev + 1);
            }}
            disabled={isRefreshing}
            className={`flex items-center gap-2 px-4 py-2 border border-indigo-200 text-indigo-600 rounded-lg transition-colors font-medium bg-white shadow-sm ${isRefreshing ? "opacity-70 cursor-not-allowed" : "hover:bg-indigo-50"}`}
          >
            <FiRefreshCw
              size={18}
              className={isRefreshing ? "animate-spin" : ""}
            />
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </button>
          {timeRange === "custom" && (
            <div className="flex items-center gap-2 bg-white px-3 py-1.5 border border-gray-200 rounded-lg shadow-sm">
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="bg-transparent focus:outline-none text-gray-700 text-sm cursor-pointer"
              />
              <span className="text-gray-400 text-sm">to</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="bg-transparent focus:outline-none text-gray-700 text-sm cursor-pointer"
              />
            </div>
          )}
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-4 py-2 bg-white border border-gray-200 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-700 cursor-pointer font-medium"
          >
            <option value="last7">Last 7 Days</option>
            <option value="last30">Last 30 Days</option>
            <option value="thisYear">This Year</option>
            <option value="allTime">All Time</option>
            <option value="custom">Custom Date Range</option>
          </select>
        </div>
      </div>
      {/*For loading effect - 06-08-2026 */}
      {loading ? (
        <DashboardSkeleton />
      ) : (
        <>
          {/* Stats cards */}
          <div
            key={`stats-${refreshTrigger}`}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10"
          >
            {stats.map((stat, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1, duration: 0.4, type: "spring" }}
                whileHover={{ scale: 1.03 }}
                className={`bg-gradient-to-br ${stat.color} p-6 rounded-xl shadow-md hover:shadow-xl transition duration-300 flex flex-col justify-between`}
              >
                <div className="flex justify-end mb-4">
                  <div className="text-white">{stat.icon}</div>
                </div>
                <div className="text-white text-lg font-semibold leading-snug mb-2">
                  {stat.label}
                </div>

                {stat.type === "upload" ? (
                  <div className="flex flex-col gap-2">
                    {/* File picker */}
                    <div className="flex items-center gap-2">
                      <label className="relative cursor-pointer bg-white text-indigo-700 p-2 rounded-full hover:bg-indigo-100 transition">
                        <FiUploadCloud size={24} />
                        <input
                          type="file"
                          accept=".csv"
                          onChange={handleCSVChange}
                          className="absolute left-0 top-0 w-full h-full opacity-0 cursor-pointer"
                        />
                      </label>
                      <span className="text-sm text-white truncate">
                        {selectedFile ? selectedFile.name : "No file chosen"}
                      </span>
                    </div>

                    {/* ── Credit error banner ── */}
                    {creditError && (
                      <div
                        style={{
                          background: "#FEF2F2",
                          border: "1px solid #FECACA",
                          borderRadius: 8,
                          padding: "8px 10px",
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 6,
                        }}
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 16 16"
                          fill="none"
                          style={{ flexShrink: 0, marginTop: 1 }}
                        >
                          <path
                            d="M8 1.5L14.5 13H1.5L8 1.5Z"
                            stroke="#DC2626"
                            strokeWidth="1.5"
                            strokeLinejoin="round"
                          />
                          <path
                            d="M8 6v3.5"
                            stroke="#DC2626"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                          />
                          <circle cx="8" cy="11.5" r="0.75" fill="#DC2626" />
                        </svg>
                        <span
                          style={{
                            fontSize: 11,
                            color: "#991B1B",
                            fontWeight: 600,
                            lineHeight: 1.5,
                          }}
                        >
                          {creditError}
                        </span>
                      </div>
                    )}

                    {/* Upload button — disabled when credit error exists */}
                    <button
                      onClick={handleUpload}
                      disabled={!!creditError}
                      className={`w-full font-semibold py-2 px-4 rounded transition ${
                        creditError
                          ? "bg-gray-300 text-gray-400 cursor-not-allowed"
                          : "bg-white text-indigo-700 hover:bg-indigo-100 cursor-pointer"
                      }`}
                    >
                      Upload
                    </button>

                    {/* Progress bar (after successful upload) */}
                    {progress && (
                      <div className="mt-1">
                        <div className="flex justify-between text-xs text-white mb-1">
                          <span>Credentials Generated</span>
                          <span className="font-bold">
                            {progress.generated}/{progress.total}
                          </span>
                        </div>
                        <div className="w-full bg-white/30 rounded-full h-2">
                          <div
                            className="bg-white h-2 rounded-full transition-all duration-500"
                            style={{
                              width: `${(progress.generated / progress.total) * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                    )}

                    <a
                      href="/student_template.csv"
                      download
                      className="block w-full text-center bg-white text-indigo-700 font-semibold py-2 px-4 rounded hover:bg-indigo-100 transition"
                    >
                      Download Template
                    </a>

                    {uploadStatus && (
                      <p className="text-xs text-white mt-1">{uploadStatus}</p>
                    )}
                  </div>
                ) : (
                  <div>
                    <div className={`text-4xl font-bold ${stat.textColor}`}>
                      {stat.value}
                    </div>

                    {stat.trend !== undefined &&
                      stat.trend !== null &&
                      timeRange !== "allTime" && (
                        <div className="mt-2 flex items-center gap-1.5 bg-white/30 rounded-full px-2.5 py-1 w-max">
                          {stat.trend >= 0 ? (
                            <FiTrendingUp
                              className="text-emerald-700"
                              size={14}
                            />
                          ) : (
                            <FiTrendingDown
                              className="text-red-700"
                              size={14}
                            />
                          )}
                          <span
                            className={`text-xs font-bold ${stat.trend >= 0 ? "text-emerald-800" : "text-red-800"}`}
                          >
                            {stat.trend > 0 ? "+" : ""}
                            {stat.trend}%
                          </span>
                          <span className="text-xs text-white opacity-90 font-medium ml-1">
                            ({stat.periodValue} this period)
                          </span>
                        </div>
                      )}
                  </div>
                )}
              </motion.div>
            ))}
          </div>

          {/* School Admin Specific Analytics */}
          <h3 className="text-xl font-bold text-gray-800 mb-4 mt-6">
            School Analytics
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6 mb-8">
            <ChartCard
              title="Student Enrollment Growth"
              icon={<FiTrendingUp className="text-blue-500" />}
              type="bar"
              color="#3B82F6"
              chartData={metrics.enrollmentData || []}
            />
            <ChartCard
              title="Internship Overview"
              icon={<BsFileEarmarkCheck className="text-yellow-500" />}
              type="pie"
              pieData={metrics.completionData || []}
            />
          </div>

          {/* Charts */}
          <div
            key={`charts-${refreshTrigger}`}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6 mb-8"
          >
            <ChartCard
              title="Applications (Last 6 Months)"
              icon={<BsClipboardData className="text-indigo-500" />}
              type="bar"
              color="#6366F1"
              chartData={metrics.chartData || []}
            />
            <ChartCard
              title="Application Trend"
              icon={<BsClipboardData className="text-green-500" />}
              type="line"
              color="#10B981"
              chartData={metrics.chartData || []}
            />
          </div>

          {/* Status & Engagement */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6 pb-10">
            <ChartCard
              title="Application Status"
              icon={<BsFileEarmarkCheck className="text-pink-500" />}
              type="pie"
              pieData={metrics.pieData || []}
            />
            <ChartCard
              title="Daily Active Students"
              icon={<FiClock className="text-teal-500" />}
              type="line"
              color="#14B8A6"
              chartData={metrics.activeStudentsData || []}
            />
          </div>
        </>
      )}{" "}
      {/* Add this for loading effect - 06-08-2026*/}
    </div>
  );
}

// ─── Utility ──────────────────────────────────────────────────────────────────
function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

const renderLegendText = (value, entry) => {
  return (
    <span
      style={{
        color: entry.color,
        fontWeight: 500,
        fontSize: "12px",
        textTransform: "uppercase",
      }}
    >
      {value}
    </span>
  );
};

// ─── ChartCard ────────────────────────────────────────────────────────────────
function ChartCard({
  title,
  icon,
  type,
  color,
  chartData = [],
  pieData = [],
  angleX = false,
  className = "",
}) {
  const visiblePieData = pieData
    .map((item) => ({ ...item, value: Number(item.value) || 0 }))
    .filter((item) => item.value > 0);

  return (
    <div
      className={`bg-white p-6 rounded-2xl shadow-md font-poppins ${className}`}
    >
      <div className="flex items-center gap-3 text-gray-800 text-lg font-medium mb-4">
        {icon}
        {title}
      </div>
      {type === "pie" && visiblePieData.length === 0 ? (
        <div className="h-[200px] flex items-center justify-center text-sm text-gray-400">
          No internship data available
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          {type === "bar" ? (
            <BarChart data={chartData}>
              <CartesianGrid
                strokeDasharray="5 5"
                stroke="#ccc"
                vertical={true}
                horizontal={true}
              />
              <XAxis
                dataKey="name"
                height={angleX ? 60 : 30}
                tick={
                  angleX
                    ? {
                        fontSize: 11,
                        angle: -45,
                        textAnchor: "end",
                        fill: "#555",
                      }
                    : { fontSize: 12, fill: "#555" }
                }
                axisLine={{ stroke: "#999" }}
                tickLine={true}
              />
              <YAxis
                width={40}
                tick={{ fontSize: 12, fill: "#555" }}
                axisLine={{ stroke: "#999" }}
                tickLine={true}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: "8px",
                  border: "none",
                  boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                }}
              />
              <Bar
                dataKey="value"
                fill={color}
                radius={[5, 5, 0, 0]}
                maxBarSize={40}
              />
            </BarChart>
          ) : type === "horizontal-bar" ? (
            <BarChart data={chartData} layout="vertical" margin={{ left: 20 }}>
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="name"
                width={120}
                tick={{ fontSize: 11 }}
              />
              <Tooltip />
              <Bar dataKey="value" fill={color} radius={[0, 5, 5, 0]} />
            </BarChart>
          ) : type === "line" ? (
            <LineChart data={chartData}>
              <CartesianGrid
                strokeDasharray="5 5"
                stroke="#ccc"
                vertical={true}
                horizontal={true}
              />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 12, fill: "#555" }}
                axisLine={{ stroke: "#999" }}
                tickLine={true}
              />
              <YAxis
                tick={{ fontSize: 12, fill: "#555" }}
                axisLine={{ stroke: "#999" }}
                tickLine={true}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: "8px",
                  border: "none",
                  boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                }}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke={color}
                strokeWidth={2.5}
                dot={{ r: 4, strokeWidth: 2, fill: "#fff", stroke: color }}
                activeDot={{ r: 6, strokeWidth: 0, fill: color }}
              />
            </LineChart>
          ) : type === "area" ? (
            <AreaChart data={chartData}>
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Area
                type="monotone"
                dataKey="value"
                stroke={color}
                fillOpacity={0.2}
                fill={color}
                strokeWidth={3}
              />
            </AreaChart>
          ) : (
            <PieChart margin={{ top: 20, right: 30, bottom: 10, left: 30 }}>
              <Pie data={visiblePieData} dataKey="value" outerRadius={50} label>
                {visiblePieData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  borderRadius: "8px",
                  border: "none",
                  boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                }}
              />
              <Legend
                iconType="square"
                formatter={renderLegendText}
                layout="horizontal"
                verticalAlign="bottom"
                align="center"
                wrapperStyle={{ paddingTop: "20px" }}
              />
            </PieChart>
          )}
        </ResponsiveContainer>
      )}
    </div>
  );
}
