import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  memo,
  startTransition,
} from "react";
import {
  FaPaperPlane,
  FaPaperclip,
  FaSpinner,
  FaCheckDouble,
  FaReply,
  FaTrash,
  FaDownload,
  FaTimesCircle,
  FaUserTie,
  FaExclamationTriangle,
  FaBug,
  FaCreditCard,
  FaBriefcase,
  FaLock,
  FaUsers,
  FaQuestionCircle,
  FaInbox,
  FaCheckCircle,
  FaClock,
  FaEnvelope,
  FaHeadset,
  FaSchool,
  FaBookOpen,
  FaInfoCircle,
  FaMapMarkerAlt,
  FaDollarSign,
  FaGraduationCap,
  FaFile,
  FaFilePdf,
  FaFileWord,
  FaFileAlt,
  FaFileImage,
  FaFileVideo,
  FaUserSlash,
  FaGlobe,
  FaSearch,
  FaPlus,
  FaTimes,
  FaChevronRight,
  FaChevronLeft,
  FaTag,
  FaHistory,
  FaCalendarAlt,
  FaComments,
  FaArrowLeft,
  FaMicrophone,
  FaMicrophoneSlash,
} from "react-icons/fa";
import axios from "../../../../../api/axiosInstance";
import { useLocation } from "react-router-dom";
import logo from "../../../../../assets-webapp/skillnaav_final_logo.svg";

// ── Socket lazy loader ─────────────────────────────────────────────
let _ioPromise = null;
const getSocket = () => {
  if (!_ioPromise) _ioPromise = import("socket.io-client");
  return _ioPromise;
};

const API_BASE = process.env.REACT_APP_API_URL || "";
const API_URL = `${API_BASE}/api/support`;
const ADMIN_FILE_URL = `${API_BASE}/api/support/admin`;
const SOCKET_URL =
  process.env.REACT_APP_SOCKET_URL || API_BASE || "http://localhost:5000";

// ── Design tokens ──────────────────────────────────────────────────
const BRAND_GRAD = "linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%)";
const BRAND_SHADOW = "0 4px 14px rgba(99,102,241,0.25)";

const PRIORITY_CONFIG = {
  urgent: {
    bg: "#FDEDEC",
    text: "#C0392B",
    border: "#E74C3C",
    dot: "#E74C3C",
    label: "Urgent",
    barColor: "#E74C3C",
  },
  high: {
    bg: "#FEF9E7",
    text: "#CA6F1E",
    border: "#E67E22",
    dot: "#F39C12",
    label: "High",
    barColor: "#F39C12",
  },
  medium: {
    bg: "#EBF5FB",
    text: "#1A5276",
    border: "#2E86C1",
    dot: "#2E86C1",
    label: "Medium",
    barColor: "#2E86C1",
  },
  low: {
    bg: "#EAFAF1",
    text: "#1E8449",
    border: "#27AE60",
    dot: "#27AE60",
    label: "Low",
    barColor: "#27AE60",
  },
};

const STATUS_CONFIG = {
  open: { label: "Open", color: "#27AE60", bg: "#EAFAF1", step: 0 },
  "in-progress": {
    label: "In Progress",
    color: "#2E86C1",
    bg: "#EBF5FB",
    step: 1,
  },
  resolved: { label: "Resolved", color: "#7D3C98", bg: "#F4ECF7", step: 2 },
  closed: { label: "Closed", color: "#7F8C8D", bg: "#F2F3F4", step: 3 },
};

const STATUS_STEPS = [
  { key: "open", label: "Open" },
  { key: "in-progress", label: "In Progress" },
  { key: "resolved", label: "Resolved" },
  { key: "closed", label: "Closed" },
];

// ── Category icons ─────────────────────────────────────────────────
const CATEGORY_ICON_MAP = {
  "technical issue": <FaBug />,
  "billing & payments": <FaCreditCard />,
  "internship access": <FaBriefcase />,
  "account issue": <FaLock />,
  "student management": <FaUsers />,
  "general inquiry": <FaQuestionCircle />,
};
const DEFAULT_CATEGORY_ICON = <FaExclamationTriangle />;

// ── Role display ───────────────────────────────────────────────────
const ROLE_CONFIG = {
  user: { name: "You", initials: "U", bg: "#6366f1", textColor: "#fff" },
  admin: {
    name: "Support Admin",
    initials: "A",
    bg: "#059669",
    textColor: "#fff",
  },
  "school-admin": {
    name: "School Admin",
    initials: "S",
    bg: "#0891b2",
    textColor: "#fff",
  },
  partner: { name: "Partner", initials: "P", bg: "#7c3aed", textColor: "#fff" },
  system: { name: "System", initials: "⚙", bg: "#94a3b8", textColor: "#fff" },
};

// ── File icon ──────────────────────────────────────────────────────
const _iconCache = new Map();
const getFileIcon = (type = "", name = "") => {
  const ext = (name || "").split(".").pop()?.toLowerCase();
  const key = type + ext;
  if (_iconCache.has(key)) return _iconCache.get(key);
  let icon;
  if (type === "application/pdf" || ext === "pdf")
    icon = <FaFilePdf className="text-red-400 w-3.5 h-3.5 shrink-0" />;
  else if (["doc", "docx"].includes(ext) || (type || "").includes("word"))
    icon = <FaFileWord className="text-blue-600 w-3.5 h-3.5 shrink-0" />;
  else if (
    (type || "").startsWith("image/") ||
    ["png", "jpg", "jpeg", "gif", "webp"].includes(ext)
  )
    icon = <FaFileImage className="text-emerald-500 w-3.5 h-3.5 shrink-0" />;
  else if (
    (type || "").startsWith("video/") ||
    ["mp4", "webm", "mov"].includes(ext)
  )
    icon = <FaFileVideo className="text-violet-500 w-3.5 h-3.5 shrink-0" />;
  else icon = <FaFileAlt className="text-gray-400 w-3.5 h-3.5 shrink-0" />;
  _iconCache.set(key, icon);
  return icon;
};

// ── Time formatters ────────────────────────────────────────────────
const _tCache = new Map();
const formatTime = (ts) => {
  if (!ts) return "";
  const bucket = Math.floor(new Date(ts).getTime() / 60000);
  const cached = _tCache.get(bucket);
  if (cached) return cached;
  const d = new Date(ts);
  const m = Math.floor((Date.now() - d) / 60000);
  let r;
  if (m < 1) r = "Just now";
  else if (m < 60) r = `${m}m ago`;
  else if (m < 1440) r = `${Math.floor(m / 60)}h ago`;
  else if (m < 2880) r = "Yesterday";
  else r = d.toLocaleDateString();
  _tCache.set(bucket, r);
  return r;
};

const formatAbsTime = (ts) => {
  if (!ts) return "—";
  return new Date(ts).toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

// ── File validation ────────────────────────────────────────────────
const ACCEPTED_FILE_TYPES_INPUT =
  ".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.gif,.webp,.mp4,.webm,.mov," +
  "application/pdf,application/msword," +
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain," +
  "image/png,image/jpeg,image/gif,image/webp,video/mp4,video/webm,video/quicktime";
const MAX_FILE_SIZE = 2 * 1024 * 1024;
const LONG_PRESS_DURATION = 600;

const validateAndMapFiles = (rawFiles, existingCount) => {
  const allowedExt = [
    "pdf",
    "doc",
    "docx",
    "txt",
    "png",
    "jpg",
    "jpeg",
    "gif",
    "webp",
    "mp4",
    "webm",
    "mov",
  ];
  const allowedMime = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
    "image/png",
    "image/jpeg",
    "image/gif",
    "image/webp",
    "video/mp4",
    "video/webm",
    "video/quicktime",
  ];
  const isOk = (f) => {
    const ext = (f.name || "").split(".").pop()?.toLowerCase();
    return allowedExt.includes(ext) || (f.type && allowedMime.includes(f.type));
  };
  const arr = Array.from(rawFiles);
  if (!arr.length) return { mapped: [], error: null };
  const rej = arr.filter((f) => !isOk(f));
  if (rej.length)
    return {
      mapped: [],
      error: `Only PDF, Word, TXT, images, and videos allowed.\nRejected: ${rej.map((f) => f.name).join(", ")}`,
    };
  const ok = arr.filter(isOk);
  if (!ok.length) return { mapped: [], error: null };
  if (existingCount + ok.length > 5)
    return { mapped: [], error: "Maximum 5 files per message." };
  const big = ok.filter((f) => f.size > MAX_FILE_SIZE);
  if (big.length)
    return {
      mapped: [],
      error: `File(s) too large (max 2 MB):\n${big.map((f) => f.name).join(", ")}`,
    };
  return {
    mapped: ok.map((f) => ({
      id: `att-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: f.name,
      size: f.size,
      type: f.type || "",
      file: f,
    })),
    error: null,
  };
};

const sortTicketsNewest = (tickets) =>
  [...tickets].sort(
    (a, b) =>
      new Date(b.lastMessageTime || b.createdAt || 0) -
      new Date(a.lastMessageTime || a.createdAt || 0),
  );

const formatCompensation = (internship) => {
  if (!internship) return "N/A";
  const { internshipType, compensation } = internship;
  if (internshipType === "STIPEND")
    return `${compensation?.amount} ${compensation?.currency} / ${compensation?.frequency?.toLowerCase()}`;
  if (internshipType === "FREE") return "Unpaid / Free";
  if (internshipType === "PAID")
    return `Student Pays: ${compensation?.amount} ${compensation?.currency}`;
  return "N/A";
};

const buildDefaultMessage = (internship) => {
  if (!internship?.jobTitle) return "";
  const c =
    internship.contactName || internship.contactEmail || internship.contactPhone
      ? `\nPartner Contact:\n  Name:  ${internship.contactName || "N/A"}\n  Email: ${internship.contactEmail || "N/A"}\n  Phone: ${internship.contactPhone || "N/A"}`
      : "";
  return `I need help regarding the internship:\n\nTitle: ${internship.jobTitle}\nCompany: ${internship.companyName || "N/A"}\nLocation: ${internship.location || "N/A"}\nType: ${internship.internshipType || "N/A"}\nCompensation: ${formatCompensation(internship)}\nApplied: ${internship.isApplied ? "Yes" : "No"}${c}\n\nPlease describe your issue below:\n`;
};

const fmtSize = (b) =>
  !b
    ? "0 B"
    : b < 1024
      ? b + " B"
      : b < 1048576
        ? (b / 1024).toFixed(1) + " KB"
        : (b / 1048576).toFixed(1) + " MB";

// ── Global CSS ─────────────────────────────────────────────────────
const GLOBAL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
@keyframes slideUp{from{transform:translateY(40px);opacity:0}to{transform:translateY(0);opacity:1}}
@keyframes slideInRight{from{transform:translateX(100%)}to{transform:translateX(0)}}
@keyframes fadeInBg{from{opacity:0}to{opacity:1}}
@keyframes modalFadeIn{from{opacity:0;transform:scale(0.97)}to{opacity:1;transform:scale(1)}}
@keyframes stepGlow{0%,100%{box-shadow:0 0 0 0 rgba(99,102,241,0.5)}60%{box-shadow:0 0 0 7px rgba(99,102,241,0)}}

.animate-pulse{animation:pulse 1.5s cubic-bezier(.4,0,.6,1) infinite}
.step-active{animation:stepGlow 2s ease-in-out infinite}
.drawer-panel{animation:slideInRight 0.28s cubic-bezier(0.25,1,0.5,1)}
.drawer-bg{animation:fadeInBg 0.2s ease}

/* Scrollbars */
.jira-scroll::-webkit-scrollbar{width:5px}
.jira-scroll::-webkit-scrollbar-track{background:#f8fafc}
.jira-scroll::-webkit-scrollbar-thumb{background:#c7d2fe;border-radius:4px}
.jira-scroll::-webkit-scrollbar-thumb:hover{background:#a5b4fc}
.tab-strip::-webkit-scrollbar{height:0}

/* Ticket row hover actions */
.ticket-row .row-actions{opacity:0;pointer-events:none;transition:opacity 0.15s}
.ticket-row:hover .row-actions{opacity:1;pointer-events:auto}

/* Comment hover */
.activity-comment{transition:background 0.12s}
.activity-comment:hover{background:#f8fafc}

/* Long press bar */
.press-bar{transition:width 0.05s linear}
`;

// ── Skeleton components ────────────────────────────────────────────
const SkeletonPulse = memo(({ className = "", style = {} }) => (
  <div
    className={`animate-pulse bg-gray-200 rounded ${className}`}
    style={style}
  />
));

const TicketRowSkeleton = memo(() => (
  <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3">
    <SkeletonPulse className="w-1 h-12 rounded-full shrink-0" />
    <SkeletonPulse className="w-9 h-9 rounded-xl shrink-0" />
    <div className="flex-1 space-y-1.5">
      <SkeletonPulse className="h-3.5 w-44" />
      <SkeletonPulse className="h-2.5 w-28" />
    </div>
    <SkeletonPulse className="h-5 w-16 rounded-full shrink-0" />
  </div>
));

const MsgSkeleton = memo(({ right = false }) => (
  <div className={`flex gap-3 py-3 ${right ? "justify-end" : ""}`}>
    {!right && <SkeletonPulse className="w-8 h-8 rounded-full shrink-0 mt-1" />}
    <div className={`space-y-2 ${right ? "items-end flex flex-col" : ""}`}>
      <SkeletonPulse className="h-2.5 w-28" />
      <SkeletonPulse className="h-14 rounded-xl" style={{ width: 220 }} />
    </div>
    {right && <SkeletonPulse className="w-8 h-8 rounded-full shrink-0 mt-1" />}
  </div>
));

// ── FileInputButton ────────────────────────────────────────────────
const FileInputButton = memo(
  ({ onFilesSelected, children, className, style }) => {
    const inputRef = useRef(null);
    const cbRef = useRef(onFilesSelected);
    useEffect(() => {
      cbRef.current = onFilesSelected;
    }, [onFilesSelected]);
    const handleChange = useCallback((e) => {
      const files = e.target.files;
      if (!files?.length) return;
      const arr = Array.from(files);
      e.target.value = "";
      cbRef.current(arr);
    }, []);
    const handleClick = useCallback((e) => {
      e.preventDefault();
      e.stopPropagation();
      inputRef.current?.click();
    }, []);
    return (
      <>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          multiple
          accept={ACCEPTED_FILE_TYPES_INPUT}
          onChange={handleChange}
        />
        <button
          type="button"
          onClick={handleClick}
          className={className}
          style={style}
        >
          {children}
        </button>
      </>
    );
  },
);

// ── AttachmentChip ─────────────────────────────────────────────────
const AttachmentChip = memo(({ att, onRemove }) => (
  <div className="inline-flex items-center bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 shadow-sm gap-2 max-w-[220px] text-xs group">
    {getFileIcon(att.type, att.name)}
    <span className="truncate flex-1 text-gray-700 font-medium">
      {att.name}
    </span>
    <span className="text-gray-400 shrink-0">{fmtSize(att.size)}</span>
    {onRemove && (
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onRemove();
        }}
        className="text-gray-300 hover:text-red-500 shrink-0 transition-colors"
      >
        <FaTimesCircle className="w-3 h-3" />
      </button>
    )}
  </div>
));

// ── InternshipBanner ───────────────────────────────────────────────
const InternshipBanner = memo(({ internship }) => {
  const compensation = useMemo(
    () => formatCompensation(internship),
    [internship],
  );
  if (!internship?.jobTitle) return null;
  return (
    <div className="bg-violet-50 border border-violet-200 rounded-xl p-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center shrink-0">
          <FaBriefcase className="text-violet-600 w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-violet-500 uppercase tracking-wider mb-0.5">
            Raising ticket for internship
          </p>
          <p className="font-bold text-violet-900 text-sm">
            {internship.jobTitle}
          </p>
          <p className="text-violet-700 text-xs mt-0.5">
            {internship.companyName}
          </p>
          <div className="flex flex-wrap gap-3 mt-2 text-xs text-violet-600">
            {internship.location && (
              <span className="flex items-center gap-1">
                <FaMapMarkerAlt className="w-2.5 h-2.5" />
                {internship.location}
              </span>
            )}
            <span className="flex items-center gap-1">
              <FaDollarSign className="w-2.5 h-2.5" />
              {compensation}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
});

// ══════════════════════════════════════════════════════════════
// ── CreateTicketDrawer — Jira-style slide-over ────────────────
// ══════════════════════════════════════════════════════════════
const CreateTicketDrawer = memo(
  ({
    open,
    onClose,
    category,
    setCategory,
    priority,
    setPriority,
    initialMessage,
    setInitialMessage,
    courseName,
    setCourseName,
    inputInternshipId,
    setInputInternshipId,
    onSubmit,
    creatingTicket,
    attachments,
    onFilesSelected,
    onRemoveAttachment,
    isSchoolStudent,
    hasPrefill,
    prefillInternship,
  }) => {
    const isInternshipCategory = category === "Internship Access";
    const [infoMsg, setInfoMsg] = useState("");

    useEffect(() => {
      if (open) {
        document.body.style.overflow = "hidden";
        setInfoMsg("");
      } else document.body.style.overflow = "";
      return () => {
        document.body.style.overflow = "";
      };
    }, [open]);

    if (!open) return null;

    return (
      <div className="fixed inset-0 z-50 flex justify-end">
        {/* Backdrop */}
        <div
          className="drawer-bg absolute inset-0"
          style={{
            background: "rgba(15,23,42,0.55)",
            backdropFilter: "blur(3px)",
          }}
          onClick={onClose}
        />

        {/* Drawer */}
        <div
          className="drawer-panel relative bg-white shadow-2xl flex flex-col z-10"
          style={{
            width: "min(540px,96vw)",
            height: "100dvh",
            overflowY: "auto",
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-6 py-5 border-b border-white/20 shrink-0"
            style={{ background: BRAND_GRAD }}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
                <FaHeadset className="text-white w-5 h-5" />
              </div>
              <div>
                <h2 className="text-white font-bold text-base leading-tight">
                  {hasPrefill
                    ? "Raise Ticket for Internship"
                    : "Create Support Ticket"}
                </h2>
                <p className="text-white/70 text-xs mt-0.5">
                  Fill in the details below to get help
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-white/70 hover:text-white hover:bg-white/20 transition-colors ml-2 shrink-0"
            >
              <FaTimes className="w-4 h-4" />
            </button>
          </div>

          {/* Form body */}
          <div className="flex-1 px-6 py-6 space-y-5 overflow-y-auto jira-scroll">
            {hasPrefill && <InternshipBanner internship={prefillInternship} />}

            {/* Category — visual card picker */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Category <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  {
                    value: "Technical Issue",
                    label: "Technical Issue",
                    icon: <FaBug className="w-5 h-5" />,
                    color: "#6366f1",
                    bg: "#eef2ff",
                    border: "#a5b4fc",
                  },
                  {
                    value: "Billing & Payments",
                    label: "Billing & Payments",
                    icon: <FaCreditCard className="w-5 h-5" />,
                    color: "#0891b2",
                    bg: "#ecfeff",
                    border: "#67e8f9",
                  },
                  {
                    value: "Internship Access",
                    label: "Internship Access",
                    icon: <FaBriefcase className="w-5 h-5" />,
                    color: "#7c3aed",
                    bg: "#f5f3ff",
                    border: "#c4b5fd",
                  },
                  {
                    value: "Account Issue",
                    label: "Account Issue",
                    icon: <FaLock className="w-5 h-5" />,
                    color: "#dc2626",
                    bg: "#fef2f2",
                    border: "#fca5a5",
                  },
                  {
                    value: "Student Management",
                    label: "Student Mgmt",
                    icon: <FaUsers className="w-5 h-5" />,
                    color: "#059669",
                    bg: "#ecfdf5",
                    border: "#6ee7b7",
                  },
                  {
                    value: "General Inquiry",
                    label: "General Inquiry",
                    icon: <FaQuestionCircle className="w-5 h-5" />,
                    color: "#d97706",
                    bg: "#fffbeb",
                    border: "#fcd34d",
                  },
                ].map(({ value, label, icon, color, bg, border }) => {
                  const isSelected = category === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      disabled={hasPrefill && !isSelected}
                      onClick={() => {
                        setInfoMsg("");
                        if (!hasPrefill) {
                          setCategory(value);
                          setCourseName("");
                          setInputInternshipId("");
                        }
                      }}
                      className="flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all text-center"
                      style={{
                        borderColor: isSelected
                          ? color
                          : hasPrefill && !isSelected
                            ? "#f3f4f6"
                            : "#e5e7eb",
                        background: isSelected
                          ? bg
                          : hasPrefill && !isSelected
                            ? "#fafafa"
                            : "#fff",
                        boxShadow: isSelected ? `0 0 0 3px ${color}22` : "none",
                        opacity: hasPrefill && !isSelected ? 0.4 : 1,
                        cursor:
                          hasPrefill && !isSelected ? "not-allowed" : "pointer",
                      }}
                    >
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{
                          background: isSelected ? color : bg,
                          color: isSelected ? "#fff" : color,
                        }}
                      >
                        {icon}
                      </div>
                      <span
                        className="text-xs font-bold leading-tight"
                        style={{ color: isSelected ? color : "#374151" }}
                      >
                        {label}
                      </span>
                      {isSelected && (
                        <span
                          className="w-4 h-4 rounded-full flex items-center justify-center"
                          style={{ background: color }}
                        >
                          <FaCheckCircle className="text-white w-2.5 h-2.5" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              {infoMsg && (
                <p className="text-xs text-red-500 font-semibold mt-2">
                  {infoMsg}
                </p>
              )}
              {!category && !infoMsg && (
                <p className="text-xs text-red-400 mt-1.5">
                  Please select a category
                </p>
              )}
            </div>

            {/* Course / Internship name (conditional) */}
            {isInternshipCategory && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <FaBookOpen className="inline mr-1.5 text-violet-500 w-3.5 h-3.5" />
                    Course / Internship Name{" "}
                    <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={courseName}
                    onChange={(e) => setCourseName(e.target.value)}
                    autoFocus={!hasPrefill}
                    readOnly={hasPrefill}
                    placeholder="e.g. Web Development Internship"
                    className={`w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 ${
                      hasPrefill
                        ? "bg-violet-50 border-violet-200 text-violet-800 cursor-default"
                        : "border-gray-300"
                    }`}
                  />
                </div>
                {!hasPrefill && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      <FaBriefcase className="inline mr-1.5 text-violet-500 w-3.5 h-3.5" />
                      Internship ID{" "}
                      <span className="text-gray-400 font-normal">
                        (optional)
                      </span>
                    </label>
                    <input
                      type="text"
                      value={inputInternshipId}
                      onChange={(e) => setInputInternshipId(e.target.value)}
                      placeholder="e.g. 64d9f... (Find this on the internship card)"
                      className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                    />
                  </div>
                )}
                {hasPrefill && (
                  <p className="flex items-center gap-1 text-xs text-violet-600 mt-1.5">
                    <FaInfoCircle className="w-3 h-3" /> Auto-filled from the
                    internship you're viewing.
                  </p>
                )}
              </div>
            )}

            {/* Priority — visual card picker */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Priority <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  {
                    key: "low",
                    label: "Low",
                    emoji: "🟢",
                    desc: "Not urgent",
                    color: "#27AE60",
                    bg: "#EAFAF1",
                    bar: "#27AE60",
                  },
                  {
                    key: "medium",
                    label: "Medium",
                    emoji: "🔵",
                    desc: "Moderate",
                    color: "#2E86C1",
                    bg: "#EBF5FB",
                    bar: "#2E86C1",
                  },
                  {
                    key: "high",
                    label: "High",
                    emoji: "🟠",
                    desc: "Important",
                    color: "#CA6F1E",
                    bg: "#FEF9E7",
                    bar: "#E67E22",
                  },
                  {
                    key: "urgent",
                    label: "Urgent",
                    emoji: "🔴",
                    desc: "Critical!",
                    color: "#C0392B",
                    bg: "#FDEDEC",
                    bar: "#E74C3C",
                  },
                ].map(({ key, label, emoji, desc, color, bg, bar }) => {
                  const isSelected = priority === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setPriority(key)}
                      className="relative flex flex-col items-center gap-1.5 py-3 px-1 rounded-xl border-2 transition-all focus:outline-none overflow-hidden"
                      style={{
                        borderColor: isSelected ? color : "#e5e7eb",
                        background: isSelected ? bg : "#fff",
                        boxShadow: isSelected
                          ? `0 0 0 3px ${color}22, 0 4px 12px ${color}20`
                          : "0 1px 3px rgba(0,0,0,0.06)",
                      }}
                    >
                      {/* Top color bar */}
                      <div
                        className="absolute top-0 left-0 right-0 h-1 rounded-t-lg"
                        style={{ background: isSelected ? bar : "#e5e7eb" }}
                      />
                      <span className="text-lg mt-0.5">{emoji}</span>
                      <span
                        className="text-xs font-black"
                        style={{ color: isSelected ? color : "#374151" }}
                      >
                        {label}
                      </span>
                      <span
                        className="text-xs leading-tight text-center"
                        style={{
                          color: isSelected ? color : "#9ca3af",
                          fontSize: "0.6rem",
                        }}
                      >
                        {desc}
                      </span>
                      {isSelected && (
                        <div className="absolute top-2 right-2">
                          <div
                            className="w-3.5 h-3.5 rounded-full flex items-center justify-center"
                            style={{ background: color }}
                          >
                            <FaCheckCircle
                              className="text-white"
                              style={{ fontSize: 8 }}
                            />
                          </div>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
              {!priority && (
                <p className="text-xs text-red-400 mt-1.5">
                  Please select a priority level
                </p>
              )}
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                {isInternshipCategory
                  ? "Describe the Access Issue"
                  : "Description"}{" "}
                <span className="text-red-500">*</span>
              </label>
              <textarea
                value={initialMessage}
                onChange={(e) => setInitialMessage(e.target.value)}
                rows={hasPrefill ? 9 : 5}
                placeholder={
                  isInternshipCategory
                    ? "Describe the internship access issue in detail…"
                    : "Describe your issue clearly. Include steps to reproduce if applicable…"
                }
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 font-mono resize-y"
              />
              {hasPrefill && (
                <p className="flex items-center gap-1 text-xs text-gray-400 mt-1.5">
                  <FaInfoCircle className="w-3 h-3" /> Internship details are
                  pre-filled. Add your specific issue at the bottom.
                </p>
              )}
            </div>

            {/* Attachments */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Attachments{" "}
                <span className="text-gray-400 font-normal">
                  (optional · PDF, images, videos · max 2 MB each)
                </span>
              </label>
              <FileInputButton
                onFilesSelected={onFilesSelected}
                className="flex items-center justify-center gap-2 w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all"
              >
                <FaPaperclip className="w-4 h-4" />
                {attachments.length === 0
                  ? "Click to attach files"
                  : `${attachments.length} file${attachments.length > 1 ? "s" : ""} attached — click to add more`}
              </FileInputButton>
              {attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {attachments.map((att) => (
                    <AttachmentChip
                      key={att.id}
                      att={att}
                      onRemove={() => onRemoveAttachment(att.id)}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* School routing notice */}
            {isSchoolStudent && (
              <div className="flex items-start gap-3 bg-teal-50 border border-teal-200 rounded-xl p-4">
                <FaSchool className="text-teal-600 w-4 h-4 mt-0.5 shrink-0" />
                <p className="text-sm text-teal-700">
                  Your ticket will be routed to your{" "}
                  <strong>school admin</strong> for faster resolution.
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center gap-3 shrink-0">
            <button
              onClick={onClose}
              disabled={creatingTicket}
              className="px-5 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-semibold text-sm hover:bg-gray-100 disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onSubmit}
              disabled={creatingTicket}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-white font-bold text-sm transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-60"
              style={{ background: BRAND_GRAD, boxShadow: BRAND_SHADOW }}
            >
              {creatingTicket ? (
                <>
                  <FaSpinner className="animate-spin w-4 h-4" /> Creating
                  Ticket…
                </>
              ) : (
                <>
                  <FaPlus className="w-3.5 h-3.5" /> Submit Ticket
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  },
);

// ── DeleteTicketModal ──────────────────────────────────────────────
const DeleteTicketModal = memo(
  ({ ticket, onDeleteForMe, onDeleteForEveryone, onCancel, deleting }) => {
    if (!ticket) return null;
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
        onClick={onCancel}
      >
        <div
          className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl"
          style={{ animation: "modalFadeIn 0.22s ease-out" }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className="h-1.5 w-full"
            style={{ background: "linear-gradient(90deg,#ef4444,#dc2626)" }}
          />
          <div className="flex flex-col items-center pt-6 pb-4 px-6">
            <div className="w-14 h-14 rounded-full flex items-center justify-center mb-4 bg-red-50">
              <FaTrash className="w-6 h-6 text-red-500" />
            </div>
            <h3 className="text-base font-bold text-gray-900 mb-1">
              Delete Ticket?
            </h3>
            <p className="text-sm text-gray-500 text-center mb-5">
              Choose how you'd like to delete this ticket.
            </p>
            <div className="w-full space-y-2.5 mb-4">
              <button
                onClick={onDeleteForMe}
                disabled={!!deleting}
                className="w-full py-3 rounded-xl text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60 transition-all hover:opacity-90"
                style={{
                  background: "linear-gradient(135deg,#f97316,#ea580c)",
                }}
              >
                {deleting === "me" ? (
                  <FaSpinner className="animate-spin w-4 h-4" />
                ) : (
                  <FaUserSlash className="w-4 h-4" />
                )}
                {deleting === "me" ? "Deleting…" : "Delete for Me"}
              </button>
              <p className="text-center text-gray-400 text-xs">
                Removes from your view only. Admin can still see the ticket.
              </p>
              <button
                onClick={onDeleteForEveryone}
                disabled={!!deleting}
                className="w-full py-3 rounded-xl text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60 transition-all hover:opacity-90"
                style={{
                  background: "linear-gradient(135deg,#ef4444,#dc2626)",
                }}
              >
                {deleting === "everyone" ? (
                  <FaSpinner className="animate-spin w-4 h-4" />
                ) : (
                  <FaGlobe className="w-4 h-4" />
                )}
                {deleting === "everyone" ? "Deleting…" : "Delete for Everyone"}
              </button>
              <p className="text-center text-gray-400 text-xs">
                Permanently deletes ticket and all messages.
              </p>
            </div>
            <button
              onClick={onCancel}
              disabled={!!deleting}
              className="w-full py-2.5 rounded-xl border border-gray-200 text-gray-700 font-semibold text-sm hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  },
);

// ── StatusTimeline — compact vertical stepper ─────────────────────
const StatusTimeline = memo(({ status }) => {
  const currentStep = STATUS_CONFIG[status?.toLowerCase()]?.step ?? 0;
  return (
    <div className="space-y-0">
      {STATUS_STEPS.map((step, i) => {
        const isDone = i < currentStep;
        const isCurrent = i === currentStep;
        const conf = STATUS_CONFIG[step.key];
        return (
          <div key={step.key} className="flex items-start gap-2 relative">
            {/* Connector line */}
            {i < STATUS_STEPS.length - 1 && (
              <div
                className="absolute left-[9px] top-5 w-0.5 h-4"
                style={{ background: isDone ? "#6366f1" : "#e5e7eb" }}
              />
            )}
            {/* Step circle */}
            <div
              className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 border-2 mt-0.5 ${
                isDone
                  ? "border-indigo-600 bg-indigo-600"
                  : isCurrent
                    ? "border-indigo-500 bg-white step-active"
                    : "border-gray-200 bg-white"
              }`}
            >
              {isDone ? (
                <FaCheckCircle className="text-white w-2 h-2" />
              ) : isCurrent ? (
                <div className="w-2 h-2 rounded-full bg-indigo-500" />
              ) : (
                <div className="w-2 h-2 rounded-full bg-gray-200" />
              )}
            </div>
            {/* Label */}
            <div className="flex-1 pb-3.5">
              <div className="flex items-center gap-1.5">
                <span
                  className={`text-xs font-semibold ${
                    isCurrent
                      ? "text-indigo-600"
                      : isDone
                        ? "text-gray-600"
                        : "text-gray-400"
                  }`}
                >
                  {step.label}
                </span>
                {isCurrent && (
                  <span
                    className="px-1.5 py-0.5 rounded-full text-xs font-bold"
                    style={{
                      background: conf.bg,
                      color: conf.color,
                      fontSize: "0.6rem",
                    }}
                  >
                    Current
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
});

// ── TicketDetailSidebar ────────────────────────────────────────────
const TicketDetailSidebar = memo(({ ticket, messages }) => {
  if (!ticket)
    return (
      <div className="h-full flex flex-col items-center justify-center p-4 text-center">
        <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center mb-2">
          <FaTag className="text-gray-300 w-4 h-4" />
        </div>
        <p className="text-xs font-semibold text-gray-400">
          No ticket selected
        </p>
        <p className="text-xs text-gray-300 mt-0.5">
          Select a ticket to view details
        </p>
      </div>
    );

  const pc =
    PRIORITY_CONFIG[ticket.priority?.toLowerCase()] || PRIORITY_CONFIG.medium;
  const sc =
    STATUS_CONFIG[ticket.status?.toLowerCase()] || STATUS_CONFIG["open"];

  return (
    <div className="h-full overflow-y-auto jira-scroll">
      {/* Ticket ID banner */}
      <div className="px-3 py-2.5 border-b border-gray-100">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-0.5">
          Ticket ID
        </p>
        <p className="text-sm font-black text-gray-800 font-mono tracking-wide">
          #{ticket._id?.slice(-6)?.toUpperCase()}
        </p>
        {ticket.isSchoolTicket && (
          <span className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded-full bg-teal-50 text-teal-700 text-xs font-semibold">
            <FaSchool className="w-2.5 h-2.5" /> School Ticket
          </span>
        )}
      </div>

      {/* Status pipeline */}
      <div className="px-3 pt-3 pb-1 border-b border-gray-100">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
          Status
        </p>
        <StatusTimeline status={ticket.status} />
      </div>

      {/* Metadata */}
      <div className="px-3 py-2.5 border-b border-gray-100">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
          Details
        </p>
        <div className="space-y-2">
          {/* Priority */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">Priority</span>
            <span
              className="px-2 py-0.5 rounded-full text-xs font-bold"
              style={{ background: pc.bg, color: pc.text }}
            >
              {pc.label}
            </span>
          </div>
          {/* Status */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">Status</span>
            <span
              className="px-2 py-0.5 rounded-full text-xs font-bold"
              style={{ background: sc.bg, color: sc.color }}
            >
              {sc.label}
            </span>
          </div>
          {/* Category */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">Category</span>
            <span className="text-xs font-semibold text-gray-700 text-right max-w-[110px] truncate">
              {ticket.category}
            </span>
          </div>
          {/* Course */}
          {ticket.courseName && (
            <div className="flex items-start justify-between gap-1">
              <span className="text-xs text-gray-400 shrink-0">Course</span>
              <span className="text-xs font-semibold text-violet-700 text-right truncate max-w-[110px]">
                {ticket.courseName}
              </span>
            </div>
          )}
          {/* Routing */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">Routed to</span>
            <span className="text-xs font-semibold text-gray-700">
              {ticket.isSchoolTicket
                ? "School Admin"
                : ticket.escalatedToPartner
                  ? "Partner"
                  : "Main Support"}
            </span>
          </div>
          {/* Messages count */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <FaComments className="w-2.5 h-2.5" /> Messages
            </span>
            <span className="text-xs font-bold text-gray-700">
              {messages?.length ?? 0}
            </span>
          </div>
          {ticket.escalatedToPartner && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">Escalated</span>
              <span className="px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 text-xs font-bold">
                Partner
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Timestamps */}
      <div className="px-3 py-2.5">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
          Timestamps
        </p>
        <div className="space-y-1.5">
          <div>
            <p className="text-xs text-gray-400 flex items-center gap-1">
              <FaCalendarAlt className="w-2.5 h-2.5" /> Created
            </p>
            <p className="text-xs font-semibold text-gray-700 mt-0.5">
              {formatAbsTime(ticket.createdAt)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400 flex items-center gap-1">
              <FaHistory className="w-2.5 h-2.5" /> Last Activity
            </p>
            <p className="text-xs font-semibold text-gray-700 mt-0.5">
              {formatAbsTime(ticket.lastMessageTime || ticket.updatedAt)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
});

// ── Jira-style ticket row ──────────────────────────────────────────
const ITEM_HEIGHT = 90;
const OVERSCAN = 3;

const JiraTicketRow = memo(({ ticket, isSelected, onSelect, onLongPress }) => {
  const timerRef = useRef(null);
  const pressStartRef = useRef(0);
  const didLongPress = useRef(false);
  const ptrTypeRef = useRef(null);
  const startPosRef = useRef({ x: 0, y: 0 });
  const rafRef = useRef(null);
  const [pressing, setPressing] = useState(false);
  const [progress, setProgress] = useState(0);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setPressing(false);
    setProgress(0);
  }, []);

  const animateBar = useCallback(() => {
    const pct = Math.min(
      ((Date.now() - pressStartRef.current) / LONG_PRESS_DURATION) * 100,
      100,
    );
    setProgress(pct);
    if (pct < 100) rafRef.current = requestAnimationFrame(animateBar);
  }, []);

  const startPress = useCallback(
    (x, y) => {
      didLongPress.current = false;
      pressStartRef.current = Date.now();
      startPosRef.current = { x, y };
      setPressing(true);
      setProgress(0);
      rafRef.current = requestAnimationFrame(animateBar);
      timerRef.current = setTimeout(() => {
        didLongPress.current = true;
        clearTimer();
        if (navigator.vibrate) navigator.vibrate(60);
        onLongPress(ticket);
      }, LONG_PRESS_DURATION);
    },
    [animateBar, clearTimer, onLongPress, ticket],
  );

  const endPress = useCallback(() => {
    const elapsed = Date.now() - pressStartRef.current;
    clearTimer();
    if (!didLongPress.current && elapsed < LONG_PRESS_DURATION)
      onSelect(ticket);
    didLongPress.current = false;
    ptrTypeRef.current = null;
  }, [clearTimer, onSelect, ticket]);

  const cancelPress = useCallback(() => {
    clearTimer();
    didLongPress.current = false;
    ptrTypeRef.current = null;
  }, [clearTimer]);

  useEffect(() => () => clearTimer(), [clearTimer]);

  const pc =
    PRIORITY_CONFIG[ticket.priority?.toLowerCase()] || PRIORITY_CONFIG.medium;
  const sc =
    STATUS_CONFIG[ticket.status?.toLowerCase()] || STATUS_CONFIG["open"];
  const catIcon =
    CATEGORY_ICON_MAP[ticket.category?.toLowerCase()] || DEFAULT_CATEGORY_ICON;
  const timeLabel = useMemo(
    () => formatTime(ticket.lastMessageTime || ticket.createdAt),
    [ticket.lastMessageTime, ticket.createdAt],
  );

  return (
    <div
      className={`ticket-row relative flex items-stretch border-b border-gray-100 cursor-pointer transition-colors ${
        isSelected ? "bg-indigo-50" : "bg-white hover:bg-gray-50"
      }`}
      style={{
        userSelect: "none",
        WebkitUserSelect: "none",
        minHeight: ITEM_HEIGHT,
      }}
      onMouseDown={(e) => {
        if (e.button !== 0) return;
        ptrTypeRef.current = "mouse";
        startPress(e.clientX, e.clientY);
      }}
      onMouseUp={() => {
        if (ptrTypeRef.current !== "mouse") return;
        endPress();
      }}
      onMouseLeave={() => {
        if (ptrTypeRef.current === "mouse") cancelPress();
      }}
      onMouseMove={(e) => {
        if (ptrTypeRef.current !== "mouse") return;
        if (
          Math.abs(e.clientX - startPosRef.current.x) > 8 ||
          Math.abs(e.clientY - startPosRef.current.y) > 8
        )
          cancelPress();
      }}
      onTouchStart={(e) => {
        if (ptrTypeRef.current === "mouse") return;
        ptrTypeRef.current = "touch";
        const t = e.touches[0];
        startPress(t.clientX, t.clientY);
      }}
      onTouchEnd={(e) => {
        if (ptrTypeRef.current !== "touch") return;
        e.preventDefault();
        endPress();
      }}
      onTouchMove={(e) => {
        if (ptrTypeRef.current !== "touch") return;
        const t = e.touches[0];
        if (
          Math.abs(t.clientX - startPosRef.current.x) > 8 ||
          Math.abs(t.clientY - startPosRef.current.y) > 8
        )
          cancelPress();
      }}
      onTouchCancel={cancelPress}
    >
      {/* Priority left border */}
      <div
        className="w-1 shrink-0 rounded-r-sm"
        style={{ background: pc.barColor }}
      />

      {/* Content */}
      <div className="flex-1 flex items-center gap-3 px-4 py-3 min-w-0 overflow-hidden">
        {/* Category icon box */}
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-white text-sm"
          style={{
            background: isSelected ? "#6366f1" : "#e0e7ff",
            color: isSelected ? "#fff" : "#6366f1",
          }}
        >
          {catIcon}
        </div>

        {/* Main text */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-xs font-mono text-gray-400 shrink-0">
              #{ticket._id?.slice(-6)}
            </span>
            {ticket.unread && (
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shrink-0" />
            )}
            {ticket.isSchoolTicket && (
              <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-teal-50 text-teal-600 text-xs font-semibold shrink-0">
                <FaSchool className="w-2.5 h-2.5" />
                School
              </span>
            )}
          </div>
          <p className="text-sm font-semibold text-gray-900 truncate leading-tight">
            {ticket.category}
          </p>
          <p className="text-xs text-gray-400 truncate mt-0.5 leading-tight">
            {ticket.lastMessage || ticket.description || "No activity yet"}
          </p>
        </div>

        {/* Right: status + time */}
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <span
            className="px-2 py-0.5 rounded-full text-xs font-bold whitespace-nowrap"
            style={{ background: sc.bg, color: sc.color }}
          >
            {sc.label}
          </span>
          <span className="text-xs text-gray-400">{timeLabel}</span>
          {ticket.unreadCount > 0 && (
            <span className="bg-blue-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">
              {ticket.unreadCount > 9 ? "9+" : ticket.unreadCount}
            </span>
          )}
        </div>
      </div>

      {/* Long press progress bar */}
      {pressing && (
        <div
          className="absolute bottom-0 left-0 h-0.5 bg-red-400 press-bar"
          style={{ width: `${progress}%` }}
        />
      )}
      {pressing && progress > 30 && (
        <div className="absolute top-2 right-2 bg-red-500 text-white rounded-lg px-2 py-0.5 text-xs font-bold z-10">
          🗑 Hold to delete
        </div>
      )}

      {/* Selected indicator */}
      {isSelected && (
        <div className="absolute right-0 top-0 bottom-0 w-0.5 bg-indigo-500" />
      )}
    </div>
  );
});

// ── VirtualTicketList ──────────────────────────────────────────────
const VirtualTicketList = memo(
  ({ tickets, selectedTicketId, onSelectTicket, onLongPress }) => {
    const containerRef = useRef(null);
    const [scrollTop, setScrollTop] = useState(0);
    const [height, setHeight] = useState(400);

    useEffect(() => {
      const el = containerRef.current;
      if (!el) return;
      setHeight(el.clientHeight);
      const ro = new ResizeObserver((entries) => {
        for (const e of entries) setHeight(e.contentRect.height);
      });
      ro.observe(el);
      return () => ro.disconnect();
    }, []);

    const onScroll = useCallback(
      (e) => setScrollTop(e.currentTarget.scrollTop),
      [],
    );

    const totalHeight = tickets.length * ITEM_HEIGHT;
    const startIdx = Math.max(
      0,
      Math.floor(scrollTop / ITEM_HEIGHT) - OVERSCAN,
    );
    const endIdx = Math.min(
      tickets.length - 1,
      Math.ceil((scrollTop + height) / ITEM_HEIGHT) + OVERSCAN,
    );
    const visibleTickets = tickets.slice(startIdx, endIdx + 1);
    const paddingTop = startIdx * ITEM_HEIGHT;
    const paddingBottom = Math.max(0, totalHeight - (endIdx + 1) * ITEM_HEIGHT);

    return (
      <div
        ref={containerRef}
        className="overflow-y-auto jira-scroll flex-1"
        onScroll={onScroll}
      >
        <div style={{ height: totalHeight, position: "relative" }}>
          <div
            style={{
              paddingTop,
              paddingBottom,
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
            }}
          >
            {visibleTickets.map((ticket) => (
              <JiraTicketRow
                key={ticket._id}
                ticket={ticket}
                isSelected={selectedTicketId === ticket._id}
                onSelect={onSelectTicket}
                onLongPress={onLongPress}
              />
            ))}
          </div>
        </div>
      </div>
    );
  },
);

// ── Pagination ─────────────────────────────────────────────────────
const Pagination = memo(({ currentPage, totalPages, onPageChange }) => {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-1.5 py-2.5 px-3 border-t border-gray-100 bg-white flex-shrink-0">
      {/* Prev */}
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className={`w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 transition-all text-indigo-600 hover:bg-indigo-50
          ${currentPage === 1 ? "text-gray-300 cursor-not-allowed bg-gray-50" : "cursor-pointer"}`}
      >
        <FaChevronLeft className="w-2.5 h-2.5" />
      </button>

      {/* Page numbers */}
      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
        const show =
          page === 1 ||
          page === totalPages ||
          Math.abs(page - currentPage) <= 1;
        if (!show) {
          if (page === 2 && currentPage > 3)
            return (
              <span
                key="ellipsis-start"
                className="text-gray-400 text-xs px-0.5"
              >
                …
              </span>
            );
          if (page === totalPages - 1 && currentPage < totalPages - 2)
            return (
              <span key="ellipsis-end" className="text-gray-400 text-xs px-0.5">
                …
              </span>
            );
          return null;
        }
        return (
          <button
            key={page}
            onClick={() => onPageChange(page)}
            className={`w-7 h-7 flex items-center justify-center rounded-lg border text-xs font-semibold transition-all
              ${
                currentPage === page
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "border-gray-200 text-gray-600 bg-white hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-300"
              }`}
          >
            {page}
          </button>
        );
      })}

      {/* Next */}
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className={`w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 transition-all text-indigo-600 hover:bg-indigo-50
          ${currentPage === totalPages ? "text-gray-300 cursor-not-allowed bg-gray-50" : "cursor-pointer"}`}
      >
        <FaChevronRight className="w-2.5 h-2.5" />
      </button>

      {/* Page label */}
      <span className="text-xs text-gray-400 ml-1">
        Page {currentPage}/{totalPages}
      </span>
    </div>
  );
});

// ── TicketList panel ───────────────────────────────────────────────
const TicketList = memo(
  ({
    tickets,
    ticketsLoading,
    selectedTicketId,
    activeTab,
    tabRows,
    onSelectTicket,
    onLongPress,
    ticketSearch,
    onTicketSearchChange,
    onNewTicket,
    currentPage,
    totalPages,
    onPageChange,
  }) => (
    <div className="flex flex-col h-full bg-white">
      {/* List header */}
      <div className="px-4 pt-4 pb-3 border-b border-gray-100 shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-bold text-gray-900">My Tickets</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Sorted by latest activity
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-3 h-3" />
          {/*Add the "!mt-0" for icon alignment - 07-08-2026 */}
          <input
            value={ticketSearch}
            onChange={(e) => onTicketSearchChange(e.target.value)}
            placeholder="Search tickets…"
            className="!mt-0 w-full border border-gray-200 rounded-lg pl-8 pr-3 py-2 text-xs bg-gray-50 outline-none focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
          />
        </div>

        {/* Tabs */}
        <div className="tab-strip flex gap-1 mt-2.5 overflow-x-auto pb-0.5">
          {tabRows}
        </div>
      </div>

      {/* Ticket rows */}
      {ticketsLoading ? (
        <div className="flex-1 divide-y divide-gray-100">
          {[0, 1, 2, 3, 4].map((i) => (
            <TicketRowSkeleton key={i} />
          ))}
        </div>
      ) : tickets.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mb-3">
            <FaHeadset className="text-gray-300 w-6 h-6" />
          </div>
          <p className="text-sm font-semibold text-gray-500">
            {activeTab === "inprogress"
              ? "No in-progress tickets"
              : activeTab === "resolved"
                ? "No resolved tickets"
                : activeTab === "urgent"
                  ? "No urgent tickets"
                  : "No tickets found"}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Create a new ticket to get started
          </p>
        </div>
      ) : (
        <>
          <VirtualTicketList
            tickets={tickets}
            selectedTicketId={selectedTicketId}
            onSelectTicket={onSelectTicket}
            onLongPress={onLongPress}
          />
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={onPageChange}
          />
        </>
      )}
    </div>
  ),
);

// ── ActivityComment — Jira-style comment block ─────────────────────
const ActivityComment = memo(
  ({ msg, onDelete, onDownload, deletingMessage }) => {
    const isMine = msg.senderRole === "user";
    const isSystem = msg.senderRole === "system";
    const timeLabel = useMemo(() => formatTime(msg.createdAt), [msg.createdAt]);
    const roleConf = ROLE_CONFIG[msg.senderRole] || ROLE_CONFIG.admin;

    if (isSystem) {
      const isForwarded = (msg.text || "")
        .toLowerCase()
        .includes("forwarded to");
      return (
        <div className="flex justify-center my-3">
          <span
            className={`px-3 py-1 rounded-full text-xs font-semibold ${
              isForwarded
                ? "bg-violet-100 text-violet-700 border border-violet-200"
                : "bg-gray-100 text-gray-500 border border-gray-200"
            }`}
          >
            {msg.text}
          </span>
        </div>
      );
    }

    // User's own messages — right-aligned bubble
    if (isMine) {
      return (
        <div
          className={`flex justify-end items-end gap-2 px-3 py-1 group ${msg.isSending ? "opacity-60" : ""}`}
        >
          <div
            className="flex flex-col items-end min-w-0 overflow-hidden"
            style={{ maxWidth: "70%" }}
          >
            {/* Meta row */}
            <div className="flex items-center gap-2 mb-0.5">
              {!msg.isSending && (
                <div className="hidden group-hover:flex">
                  <button
                    onClick={() => onDelete(msg._id)}
                    disabled={deletingMessage === msg._id}
                    className="p-0.5 text-gray-300 hover:text-red-500 rounded transition-colors"
                  >
                    {deletingMessage === msg._id ? (
                      <FaSpinner className="w-2.5 h-2.5 animate-spin" />
                    ) : (
                      <FaTrash className="w-2.5 h-2.5" />
                    )}
                  </button>
                </div>
              )}
              <span className="text-xs text-gray-400">{timeLabel}</span>
              {msg.isSending && (
                <FaSpinner className="w-2.5 h-2.5 text-gray-400 animate-spin" />
              )}
            </div>
            {/* Bubble */}
            {msg.text && (
              <div className="bg-blue-600 text-white px-3 py-2 rounded-2xl rounded-tr-sm text-sm leading-relaxed whitespace-pre-wrap break-all shadow-sm">
                {msg.text}
              </div>
            )}
            {/* Attachments */}
            {(msg.attachments || []).length > 0 && (
              <div className="mt-1.5 space-y-1 w-full">
                {(msg.attachments || []).map((att, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-blue-500 cursor-pointer hover:bg-blue-700 transition-colors"
                    onClick={() =>
                      onDownload({ ...att, senderRole: msg.senderRole })
                    }
                  >
                    {getFileIcon(
                      att.type || att.mimetype,
                      att.filename || att.name,
                    )}
                    <span className="flex-1 truncate text-xs font-medium text-white">
                      {att.filename || att.name}
                    </span>
                    <span className="text-xs text-blue-200">
                      {fmtSize(att.size)}
                    </span>
                    <FaDownload className="w-2.5 h-2.5 text-blue-200 shrink-0" />
                  </div>
                ))}
              </div>
            )}
            {/* Read receipt */}
            {!msg.isSending && (
              <FaCheckDouble
                className={`w-2.5 h-2.5 mt-1 ${msg.read ? "text-blue-400" : "text-gray-300"}`}
              />
            )}
          </div>
          {/* Avatar */}
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mb-1 shadow-sm"
            style={{ background: roleConf.bg, color: roleConf.textColor }}
          >
            <FaGraduationCap className="w-3 h-3" />
          </div>
        </div>
      );
    }

    // Others (admin, partner, school-admin) — left-aligned bubble
    return (
      <div
        className={`flex items-end gap-2 px-3 py-1 ${msg.isSending ? "opacity-60" : ""}`}
      >
        {/* Avatar */}
        <div
          className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mb-1 shadow-sm"
          style={{ background: roleConf.bg, color: roleConf.textColor }}
        >
          {msg.senderRole === "school-admin" ? (
            <FaSchool className="w-3 h-3" />
          ) : msg.senderRole === "partner" ? (
            <FaBriefcase className="w-3 h-3" />
          ) : (
            <FaUserTie className="w-3 h-3" />
          )}
        </div>
        <div
          className="flex flex-col items-start min-w-0 overflow-hidden"
          style={{ maxWidth: "70%" }}
        >
          {/* Meta row */}
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-xs font-bold text-gray-700">
              {msg.senderRole === "school-admin"
                ? msg.schoolName || msg.senderName || "School Admin"
                : msg.senderRole === "partner"
                  ? msg.senderName || "Partner"
                  : msg.senderName || "Support Admin"}
            </span>
            {msg.senderRole === "partner" && (
              <span className="px-1.5 py-0.5 bg-violet-100 text-violet-600 text-xs font-bold rounded-full">
                Partner
              </span>
            )}
            {msg.senderRole === "school-admin" && (
              <span className="px-1.5 py-0.5 bg-teal-100 text-teal-600 text-xs font-bold rounded-full">
                School
              </span>
            )}
            <span className="text-xs text-gray-400 ml-auto">{timeLabel}</span>
          </div>
          {/* Bubble */}
          {msg.text && (
            <div className="bg-blue-600 text-white px-3 py-2 rounded-2xl rounded-tl-sm text-sm leading-relaxed whitespace-pre-wrap break-all shadow-sm">
              {msg.text}
            </div>
          )}
          {/* Attachments */}
          {(msg.attachments || []).length > 0 && (
            <div className="mt-1.5 space-y-1">
              {(msg.attachments || []).map((att, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-blue-500 cursor-pointer hover:bg-blue-700 transition-colors"
                  onClick={() =>
                    onDownload({ ...att, senderRole: msg.senderRole })
                  }
                >
                  {getFileIcon(
                    att.type || att.mimetype,
                    att.filename || att.name,
                  )}
                  <span className="flex-1 truncate text-xs font-medium text-white">
                    {att.filename || att.name}
                  </span>
                  <span className="text-xs text-blue-200">
                    {fmtSize(att.size)}
                  </span>
                  <FaDownload className="w-2.5 h-2.5 text-blue-200 shrink-0" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  },
);

// ── ChatMessages ───────────────────────────────────────────────────
const ChatMessages = memo(
  ({
    ticketMessages,
    messagesLoading,
    onDelete,
    onDownload,
    deletingMessage,
    messagesEndRef,
  }) => (
    <div
      className="flex-1 overflow-y-auto jira-scroll bg-gray-50/50"
      style={{ minHeight: 0 }}
    >
      {messagesLoading ? (
        <div className="p-4 space-y-2">
          <MsgSkeleton />
          <MsgSkeleton right />
          <MsgSkeleton />
          <MsgSkeleton right />
        </div>
      ) : !ticketMessages || ticketMessages.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full gap-3 p-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center">
            <FaComments className="w-7 h-7 text-indigo-300" />
          </div>
          <p className="text-sm font-semibold text-gray-500">No messages yet</p>
          <p className="text-xs text-gray-400">
            Start the conversation by sending a message below
          </p>
        </div>
      ) : (
        <div className="py-2 space-y-1">
          {ticketMessages.map((msg) => (
            <ActivityComment
              key={`msg-${msg._id}`}
              msg={msg}
              onDelete={onDelete}
              onDownload={onDownload}
              deletingMessage={deletingMessage}
            />
          ))}
          <div ref={messagesEndRef} className="h-2" />
        </div>
      )}
    </div>
  ),
);

// ── ChatInput ──────────────────────────────────────────────────────
const ChatInput = memo(
  ({
    onSendMessage,
    onFilesSelected,
    attachments,
    onRemoveAttachment,
    replyingTo,
    onCancelReply,
    sendingMessage,
    isTicketClosed,
    onNewTicket,
    openTicketId,
    selectedTicketStatus,
    clearSignal,
  }) => {
    const inputRef = useRef(null);
    const [hasText, setHasText] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const recognitionRef = useRef(null);

    useEffect(() => {
      if (inputRef.current) inputRef.current.value = "";
      setHasText(false);
    }, [clearSignal]);

    const toggleListening = useCallback(() => {
      const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        alert(
          "Speech recognition is not supported in your browser. Please try Chrome.",
        );
        return;
      }

      if (isListening) {
        recognitionRef.current?.stop();
        setIsListening(false);
        return;
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;

      let baseText = inputRef.current?.value.trim() || "";

      recognition.onresult = (e) => {
        let finalStr = "";
        let interimStr = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          if (e.results[i].isFinal) {
            finalStr += e.results[i][0].transcript;
          } else {
            interimStr += e.results[i][0].transcript;
          }
        }

        if (finalStr) {
          baseText = baseText + (baseText ? " " : "") + finalStr;
          if (inputRef.current)
            inputRef.current.value =
              baseText + (interimStr ? " " + interimStr : "");
        } else {
          if (inputRef.current)
            inputRef.current.value =
              baseText + (baseText ? " " : "") + interimStr;
        }

        setHasText(inputRef.current.value.trim().length > 0);
      };

      recognition.onend = () => setIsListening(false);
      recognition.onerror = () => setIsListening(false);

      recognitionRef.current = recognition;
      recognition.start();
      setIsListening(true);
    }, [isListening]);

    const canSend =
      (hasText || attachments.length > 0) && !sendingMessage && !isTicketClosed;

    const handleInput = useCallback((e) => {
      const t = e.target.value.trim().length > 0;
      setHasText((p) => (p === t ? p : t));
    }, []);

    const doSend = useCallback(() => {
      const val = inputRef.current?.value?.trim() || "";
      if (!val && attachments.length === 0) return;
      onSendMessage(val);
    }, [onSendMessage, attachments.length]);

    const handleKeyDown = useCallback(
      (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          doSend();
        }
      },
      [doSend],
    );

    if (isTicketClosed)
      return (
        <div className="px-4 py-4 border-t border-gray-200 bg-gray-50 flex flex-col items-center gap-2">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <FaCheckCircle className="text-violet-500 w-4 h-4 shrink-0" />
            This ticket is{" "}
            <span className="font-bold text-violet-600 capitalize">
              {selectedTicketStatus}
            </span>{" "}
            — messaging disabled.
          </div>
          {!openTicketId && (
            <button
              onClick={onNewTicket}
              className="mt-1 px-5 py-2 text-white text-sm font-bold rounded-xl hover:opacity-90 active:scale-95 transition-all"
              style={{ background: BRAND_GRAD, boxShadow: BRAND_SHADOW }}
            >
              + Open New Ticket
            </button>
          )}
        </div>
      );

    return (
      <div className="border-t border-gray-200 bg-white shrink-0">
        {/* Reply preview */}
        {replyingTo && (
          <div className="mx-4 mt-3 flex items-center justify-between gap-2 px-3 py-2 bg-indigo-50 border border-indigo-200 rounded-lg">
            <div className="flex items-center gap-2 text-xs text-indigo-700 min-w-0">
              <FaReply className="w-3 h-3 shrink-0" />
              <span className="truncate">
                Replying: "<em>{replyingTo.text?.substring(0, 50)}…</em>"
              </span>
            </div>
            <button
              onClick={onCancelReply}
              className="text-gray-400 hover:text-gray-600 shrink-0"
            >
              <FaTimesCircle className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Attachment preview */}
        {attachments.length > 0 && (
          <div className="mx-4 mt-2 flex flex-wrap gap-1.5">
            {attachments.map((att) => (
              <AttachmentChip
                key={att.id}
                att={att}
                onRemove={() => onRemoveAttachment(att.id)}
              />
            ))}
          </div>
        )}

        {/* Input row */}
        <div className="flex items-center gap-2 px-4 py-3">
          <FileInputButton
            onFilesSelected={onFilesSelected}
            className="p-2.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl cursor-pointer transition-colors shrink-0"
          >
            <FaPaperclip className="w-4 h-4" />
          </FileInputButton>
          <button
            onClick={toggleListening}
            className={`p-2.5 rounded-xl cursor-pointer transition-colors shrink-0 ${isListening ? "text-red-500 bg-red-50 animate-pulse" : "text-gray-400 hover:text-indigo-600 hover:bg-indigo-50"}`}
            title="Auto Type (Speech to Text)"
          >
            {isListening ? (
              <FaMicrophoneSlash className="w-4 h-4" />
            ) : (
              <FaMicrophone className="w-4 h-4" />
            )}
          </button>

          <input
            ref={inputRef}
            type="text"
            placeholder={
              attachments.length > 0
                ? "Add a message (optional)…"
                : isListening
                  ? "Listening..."
                  : "Reply to this ticket…"
            }
            //17-08-2026 add !mt-0
            className="!mt-0 flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-gray-50 outline-none focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
            onFocus={(e) => {
              e.target.style.borderColor = "#6366f1";
              e.target.style.boxShadow = "0 0 0 3px rgba(99,102,241,0.15)";
            }}
            onBlur={(e) => {
              e.target.style.borderColor = "#e5e7eb";
              e.target.style.boxShadow = "none";
            }}
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            disabled={sendingMessage}
          />

          <button
            onClick={doSend}
            disabled={!canSend}
            className="p-2.5 rounded-xl transition-all shrink-0 flex items-center justify-center"
            style={
              canSend
                ? {
                    background: BRAND_GRAD,
                    color: "#fff",
                    boxShadow: BRAND_SHADOW,
                  }
                : {
                    background: "#f3f4f6",
                    color: "#9ca3af",
                    cursor: "not-allowed",
                  }
            }
          >
            {sendingMessage ? (
              <FaSpinner className="w-4 h-4 animate-spin" />
            ) : (
              <FaPaperPlane className="w-4 h-4" />
            )}
          </button>
        </div>

        <p
          className="text-center text-gray-300 pb-2"
          style={{ fontSize: "0.65rem" }}
        >
          Attach PDF, Word, images or videos · max 2 MB each
        </p>
      </div>
    );
  },
);

// ════════════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ════════════════════════════════════════════════════════════════════
const StudentSupport = ({
  prefillInternship: propPrefillInternship,
  openTicketId: propOpenTicketId,
  onTicketCreated,
  onBack,
  backLabel,
}) => {
  const location = useLocation();
  const routeState = location.state || {};
  const searchParams = new URLSearchParams(location.search);
  const ticketIdFromQuery = searchParams.get("ticketId");
  const prefillKey = searchParams.get("prefillKey");

  const [storedPrefillInternship] = useState(() => {
    if (!prefillKey) return null;
    try {
      const value = localStorage.getItem(prefillKey);
      localStorage.removeItem(prefillKey);
      return value ? JSON.parse(value) : null;
    } catch {
      return null;
    }
  });

  const prefillInternship =
    propPrefillInternship ||
    routeState.prefillInternship ||
    storedPrefillInternship;
  const openTicketId =
    propOpenTicketId || routeState.openTicketId || ticketIdFromQuery || null;

  const [user] = useState(() => {
    try {
      let u =
        JSON.parse(localStorage.getItem("user") || "null") ||
        JSON.parse(sessionStorage.getItem("user") || "null");
      if (!u || !u._id) {
        const token =
          localStorage.getItem("userToken") ||
          sessionStorage.getItem("userToken");
        if (token) {
          const decoded = JSON.parse(atob(token.split(".")[1]));
          if (decoded && (decoded._id || decoded.id)) {
            u = { ...decoded, _id: decoded._id || decoded.id };
          }
        }
      }
      return u;
    } catch {
      return null;
    }
  });

  // ── Core state ─────────────────────────────────────────────────
  const [showDetails, setShowDetails] = useState(false);
  const [tickets, setTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [messages, setMessages] = useState({});
  const [sendClearSignal, setSendClearSignal] = useState(0);
  const [ticketsLoading, setTicketsLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [creatingTicket, setCreatingTicket] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const isSendingRef = useRef(false);

  // ── Attachment state ────────────────────────────────────────────
  const [attachments, setAttachments] = useState([]);
  const [newTicketAttachments, setNewTicketAttachments] = useState([]);
  const attachmentsRef = useRef([]);
  const newTicketAttachmentsRef = useRef([]);
  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);
  useEffect(() => {
    newTicketAttachmentsRef.current = newTicketAttachments;
  }, [newTicketAttachments]);

  // ── Form state ─────────────────────────────────────────────────
  const [showNewTicketForm, setShowNewTicketForm] = useState(false);
  const [category, setCategory] = useState("");
  const [priority, setPriority] = useState("");
  const [initialMessage, setInitialMessage] = useState("");
  const [courseName, setCourseName] = useState("");
  const [inputInternshipId, setInputInternshipId] = useState("");

  // ── UI state ───────────────────────────────────────────────────
  const [replyingTo, setReplyingTo] = useState(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const [deletingMessage, setDeletingMessage] = useState(null);
  const [stats, setStats] = useState({
    total: 0,
    unreadMessages: 0,
    resolved: 0,
    open: 0,
  });
  const [activeTab, setActiveTab] = useState("all");
  const [ticketSearch, setTicketSearch] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [alertModal, setAlertModal] = useState({
    show: false,
    title: "",
    message: "",
    type: "success",
  });
  const showAlert = useCallback((title, message, type = "error") => {
    setAlertModal({ show: true, title, message, type });
  }, []);
  const [ticketToDelete, setTicketToDelete] = useState(null);
  const [deletingTicket, setDeletingTicket] = useState(false);
  const [page, setPage] = useState(1);
  // Mobile: which panel is visible
  const [mobilePanel, setMobilePanel] = useState("list"); // "list" | "chat" | "detail"

  // ── Refs ───────────────────────────────────────────────────────
  const initialLoadDone = useRef(false);
  const lastOpenTicketIdRef = useRef(null);
  const messagesEndRef = useRef(null);
  const socketRef = useRef(null);
  const selectedTicketRef = useRef(null);
  const ticketsRef = useRef([]);
  const replyingToRef = useRef(null);
  const selectedTicketIdRef = useRef(null);
  const scrollPendingRef = useRef(false);

  const getToken = useCallback(() => localStorage.getItem("userToken"), []);

  useEffect(() => {
    selectedTicketRef.current = selectedTicket;
    selectedTicketIdRef.current = selectedTicket?._id || null;
  }, [selectedTicket]);
  useEffect(() => {
    ticketsRef.current = tickets;
  }, [tickets]);
  useEffect(() => {
    replyingToRef.current = replyingTo;
  }, [replyingTo]);

  const prevSelectedIdRef = useRef("__INIT__");
  useEffect(() => {
    const id = selectedTicket?._id ?? null;
    if (id === prevSelectedIdRef.current) return;
    prevSelectedIdRef.current = id;
    setAttachments([]);
    setSendClearSignal((s) => s + 1);
    setReplyingTo(null);
  }, [selectedTicket?._id]);

  // ── Prefill effect ─────────────────────────────────────────────
  useEffect(() => {
    if (prefillInternship?.jobTitle) {
      setShowNewTicketForm(true);
      setCategory("Internship Access");
      setCourseName(prefillInternship.jobTitle);
      setInitialMessage(buildDefaultMessage(prefillInternship));
      setPriority("medium");
    }
  }, [prefillInternship]);

  // ── Open ticket from route ─────────────────────────────────────
  useEffect(() => {
    if (openTicketId === lastOpenTicketIdRef.current) return;
    lastOpenTicketIdRef.current = openTicketId;
    if (!openTicketId) {
      if (prefillInternship?.jobTitle) {
        setShowNewTicketForm(true);
        setSelectedTicket(null);
      }
      return;
    }
    const found = ticketsRef.current.find((t) => t._id === openTicketId);
    if (found) {
      setShowNewTicketForm(false);
      handleSelectTicket(found);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openTicketId]);

  useEffect(() => {
    if (!openTicketId || selectedTicket?._id === openTicketId) return;
    const found = tickets.find((t) => t._id === openTicketId);
    if (found) {
      setShowNewTicketForm(false);
      handleSelectTicket(found);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickets, openTicketId]);

  // ── SOCKET ─────────────────────────────────────────────────────
  useEffect(() => {
    const token = getToken();
    const cu = user;
    if (!token) return;
    const initSocket = async () => {
      const socketModule = await getSocket();
      const io = socketModule.io || socketModule.default || socketModule;
      if (socketRef.current) {
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      socketRef.current = io(SOCKET_URL, {
        auth: { token },
        transports: ["websocket", "polling"],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 10000,
        timeout: 20000,
      });
      const s = socketRef.current;
      s.on("connect", () => {
        setSocketConnected(true);
        if (cu?._id) s.emit("join_user_room", cu?._id);
        if (selectedTicketRef.current?._id)
          s.emit("join_ticket", selectedTicketRef.current._id);
      });
      s.on("disconnect", () => setSocketConnected(false));
      s.on("connect_error", () => setSocketConnected(false));
      s.on("reconnect", () => {
        setSocketConnected(true);
        startTransition(() => {
          loadTickets();
          loadStats();
        });
      });
      s.on("stats_refresh", () => startTransition(loadStats));
      s.on("new_message", ({ ticketId, message }) => {
        if (
          !["admin", "school-admin", "partner", "system"].includes(
            message.senderRole,
          )
        )
          return;
        const isSel = selectedTicketRef.current?._id === ticketId;
        setMessages((prev) => {
          const msgs = prev[ticketId] || [];
          if (msgs.some((m) => m._id === message._id)) return prev;
          return { ...prev, [ticketId]: [...msgs, message] };
        });
        startTransition(() => {
          setTickets((prev) =>
            sortTicketsNewest(
              prev.map((t) => {
                if (t._id !== ticketId) return t;
                const n = isSel ? 0 : (t.unreadCount || 0) + 1;
                return {
                  ...t,
                  lastMessage: message.text,
                  lastMessageTime: message.createdAt,
                  unread: !isSel && n > 0,
                  unreadCount: n,
                };
              }),
            ),
          );
        });
        if (isSel) {
          markMessagesAsRead(ticketId);
          scrollToBottom();
        }
        startTransition(loadStats);
      });
      s.on("message_deleted", ({ ticketId, messageId }) =>
        setMessages((prev) => ({
          ...prev,
          [ticketId]: (prev[ticketId] || []).filter((m) => m._id !== messageId),
        })),
      );
      s.on("messages_read", ({ ticketId }) => {
        setMessages((prev) => ({
          ...prev,
          [ticketId]: (prev[ticketId] || []).map((m) => ({ ...m, read: true })),
        }));
        startTransition(() => {
          setTickets((prev) =>
            prev.map((t) =>
              t._id === ticketId ? { ...t, unread: false, unreadCount: 0 } : t,
            ),
          );
          if (selectedTicketRef.current?._id === ticketId)
            setSelectedTicket((p) => ({ ...p, unread: false, unreadCount: 0 }));
        });
      });
      s.on("ticket_status_update", (data) => {
        startTransition(() => {
          setTickets((prev) =>
            prev.map((t) =>
              t._id === data.ticketId ? { ...t, status: data.status } : t,
            ),
          );
          if (selectedTicketRef.current?._id === data.ticketId) {
            setSelectedTicket((p) => ({ ...p, status: data.status }));
            if (data.message)
              setMessages((prev) => ({
                ...prev,
                [data.ticketId]: [...(prev[data.ticketId] || []), data.message],
              }));
          }
        });
      });
    };
    const timer = setTimeout(initSocket, 400);
    return () => {
      clearTimeout(timer);
      if (socketRef.current) {
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!socketRef.current || !selectedTicket) return;
    socketRef.current.emit("join_ticket", selectedTicket._id);
    return () => {
      if (selectedTicket)
        socketRef.current?.emit("leave_ticket", selectedTicket._id);
    };
  }, [selectedTicket]);

  // ── Initial load ───────────────────────────────────────────────
  useEffect(() => {
    if (initialLoadDone.current) return;
    initialLoadDone.current = true;
    const token = getToken();
    if (!token) {
      setTicketsLoading(false);
      return;
    }
    const headers = { Authorization: `Bearer ${token}` };
    Promise.all([
      axios
        .get(`${API_URL}/my-tickets`, {
          headers,
          signal: AbortSignal.timeout(8000),
        })
        .catch(() => null),
      axios
        .get(`${API_URL}/my-stats`, {
          headers,
          signal: AbortSignal.timeout(8000),
        })
        .catch(() => null),
    ]).then(([tRes, sRes]) => {
      if (tRes?.data?.tickets)
        startTransition(() => setTickets(sortTicketsNewest(tRes.data.tickets)));
      setTicketsLoading(false);
      if (sRes?.data?.stats) {
        const s = sRes.data.stats;
        startTransition(() =>
          setStats({
            total: s.total || 0,
            open: s.open || 0,
            resolved: s.resolved || s.closed || 0,
            unreadMessages: s.unreadMessages || 0,
          }),
        );
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fallback polling when socket is offline
  useEffect(() => {
    if (socketConnected) return;
    const iv = setInterval(() => {
      if (selectedTicketRef.current)
        loadMessages(selectedTicketRef.current._id, false);
      startTransition(() => {
        loadTickets();
        loadStats();
      });
    }, 10000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socketConnected]);

  useEffect(() => {
    if (scrollPendingRef.current) return;
    scrollPendingRef.current = true;
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      scrollPendingRef.current = false;
    });
  }, [messages, selectedTicket]);

  // ── Stable callbacks ───────────────────────────────────────────
  const scrollToBottom = useCallback(() => {
    if (scrollPendingRef.current) return;
    scrollPendingRef.current = true;
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      scrollPendingRef.current = false;
    });
  }, []);

  const loadTickets = useCallback(async () => {
    try {
      const token = getToken();
      if (!token) return;
      const res = await axios.get(`${API_URL}/my-tickets`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const cur = ticketsRef.current;
      startTransition(() =>
        setTickets(
          sortTicketsNewest(
            (res.data.tickets || []).map((t) => {
              const ex = cur.find((c) => c._id === t._id);
              return ex?.unread
                ? { ...t, unread: ex.unread, unreadCount: ex.unreadCount }
                : t;
            }),
          ),
        ),
      );
    } catch {
      startTransition(() => setTickets([]));
    }
  }, [getToken]);

  const loadStats = useCallback(async () => {
    try {
      const token = getToken();
      if (!token) return;
      const res = await axios.get(`${API_URL}/my-stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data.stats) {
        const s = res.data.stats;
        startTransition(() =>
          setStats({
            total: s.total || 0,
            open: s.open || 0,
            resolved: s.resolved || s.closed || 0,
            unreadMessages: s.unreadMessages || 0,
          }),
        );
      }
    } catch {}
  }, [getToken]);

  const loadMessages = useCallback(
    async (ticketId, showLoading = true) => {
      try {
        if (showLoading) setMessagesLoading(true);
        const token = getToken();
        if (!token) return;
        const res = await axios.get(`${API_URL}/messages/${ticketId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setMessages((prev) => ({
          ...prev,
          [ticketId]: res.data.messages || [],
        }));
        if (res.data.ticket && selectedTicketRef.current?._id === ticketId)
          setSelectedTicket((prev) => ({
            ...prev,
            courseName: res.data.ticket.courseName || prev?.courseName || "",
          }));
        startTransition(() => {
          setTickets((prev) =>
            prev.map((t) =>
              t._id === ticketId ? { ...t, unread: false, unreadCount: 0 } : t,
            ),
          );
          if (selectedTicketRef.current?._id === ticketId)
            setSelectedTicket((prev) => ({
              ...prev,
              unread: false,
              unreadCount: 0,
            }));
        });
        await loadStats();
      } catch {
        setMessages((prev) => ({ ...prev, [ticketId]: [] }));
      } finally {
        if (showLoading) setMessagesLoading(false);
      }
    },
    [getToken, loadStats],
  );

  const markMessagesAsRead = useCallback(
    async (ticketId) => {
      try {
        const token = getToken();
        if (!token) return;
        startTransition(() => {
          setTickets((prev) =>
            prev.map((t) =>
              t._id === ticketId ? { ...t, unread: false, unreadCount: 0 } : t,
            ),
          );
          if (selectedTicketRef.current?._id === ticketId)
            setSelectedTicket((prev) => ({
              ...prev,
              unread: false,
              unreadCount: 0,
            }));
        });
        await axios.post(
          `${API_URL}/mark-read/${ticketId}`,
          {},
          { headers: { Authorization: `Bearer ${token}` } },
        );
        await loadStats();
      } catch {}
    },
    [getToken, loadStats],
  );

  // ── Ticket deletion ────────────────────────────────────────────
  const handleLongPressTicket = useCallback(
    (ticket) => setTicketToDelete(ticket),
    [],
  );
  const handleCancelDeleteTicket = useCallback(() => {
    if (!deletingTicket) setTicketToDelete(null);
  }, [deletingTicket]);

  const handleDeleteForMe = useCallback(async () => {
    if (!ticketToDelete) return;
    setDeletingTicket("me");
    try {
      const token = getToken();
      if (!token) {
        showAlert("Authentication Required", "Please login again", "error");
        return;
      }
      await axios.patch(
        `${API_URL}/ticket/${ticketToDelete._id}/hide`,
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      );
      startTransition(() => {
        setTickets((prev) => prev.filter((t) => t._id !== ticketToDelete._id));
        setMessages((prev) => {
          const c = { ...prev };
          delete c[ticketToDelete._id];
          return c;
        });
        if (selectedTicket?._id === ticketToDelete._id) {
          setSelectedTicket(null);
          setMobilePanel("list");
        }
      });
      await loadStats();
    } catch (err) {
      showAlert(
        "Error",
        err?.response?.data?.message || err?.message || "Unknown error",
        "error",
      );
    } finally {
      setDeletingTicket(false);
      setTicketToDelete(null);
    }
  }, [ticketToDelete, selectedTicket, getToken, loadStats, showAlert]);

  const handleDeleteForEveryone = useCallback(async () => {
    if (!ticketToDelete) return;
    setDeletingTicket("everyone");
    try {
      const token = getToken();
      if (!token) {
        showAlert("Authentication Required", "Please login again", "error");
        return;
      }
      await axios.delete(`${API_URL}/ticket/${ticketToDelete._id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      startTransition(() => {
        setTickets((prev) => prev.filter((t) => t._id !== ticketToDelete._id));
        setMessages((prev) => {
          const c = { ...prev };
          delete c[ticketToDelete._id];
          return c;
        });
        if (selectedTicket?._id === ticketToDelete._id) {
          setSelectedTicket(null);
          setMobilePanel("list");
        }
      });
      await loadStats();
    } catch (err) {
      showAlert(
        "Error",
        err?.response?.data?.message || err?.message || "Unknown error",
        "error",
      );
    } finally {
      setDeletingTicket(false);
      setTicketToDelete(null);
    }
  }, [ticketToDelete, selectedTicket, getToken, loadStats, showAlert]);

  // ── Form helpers ───────────────────────────────────────────────
  const resetForm = useCallback(() => {
    setShowNewTicketForm(false);
    setCategory("");
    setPriority("");
    setInitialMessage("");
    setCourseName("");
    setInputInternshipId("");
    setNewTicketAttachments([]);
  }, []);

  const handleFilesSelected = useCallback(
    (fileArray) => {
      const { mapped, error } = validateAndMapFiles(
        fileArray,
        attachmentsRef.current.length,
      );
      if (error) {
        showAlert("File Error", error, "error");
        return;
      }
      if (mapped.length) setAttachments((prev) => [...prev, ...mapped]);
    },
    [showAlert],
  );

  const handleNewTicketFilesSelected = useCallback(
    (fileArray) => {
      const { mapped, error } = validateAndMapFiles(
        fileArray,
        newTicketAttachmentsRef.current.length,
      );
      if (error) {
        showAlert("File Error", error, "error");
        return;
      }
      if (mapped.length)
        setNewTicketAttachments((prev) => [...prev, ...mapped]);
    },
    [showAlert],
  );

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);
  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);
  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files?.length)
        handleFilesSelected(Array.from(e.dataTransfer.files));
    },
    [handleFilesSelected],
  );

  const handleCreateTicket = useCallback(async () => {
    const curAtts = newTicketAttachmentsRef.current;
    if (!category || !priority || !initialMessage) {
      showAlert("Required Fields", "Please fill all required fields", "error");
      return;
    }
    if (category === "Internship Access" && !courseName.trim()) {
      showAlert(
        "Required Fields",
        "Please enter the course / internship name",
        "error",
      );
      return;
    }
    setCreatingTicket(true);
    try {
      const token = getToken();
      if (!token) {
        showAlert("Authentication Required", "Please login again", "error");
        return;
      }
      const fd = new FormData();
      fd.append("category", category);
      fd.append("priority", priority);
      fd.append("message", initialMessage);
      fd.append("courseName", courseName.trim());
      if (prefillInternship?.internshipId) {
        fd.append("internshipId", prefillInternship.internshipId);
        fd.append(
          "internshipMeta",
          JSON.stringify({
            jobTitle: prefillInternship.jobTitle,
            companyName: prefillInternship.companyName,
            location: prefillInternship.location,
            internshipType: prefillInternship.internshipType,
            isApplied: prefillInternship.isApplied,
            planType: prefillInternship.planType,
            contactName: prefillInternship.contactName || null,
            contactEmail: prefillInternship.contactEmail || null,
            contactPhone: prefillInternship.contactPhone || null,
          }),
        );
      } else if (inputInternshipId.trim()) {
        fd.append("internshipId", inputInternshipId.trim());
      }
      curAtts.forEach((att) => fd.append("files", att.file, att.name));
      const res = await axios.post(`${API_URL}/create`, fd, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      });
      if (res.data.success && res.data.ticket) {
        const newTicket = res.data.ticket;
        const firstMsg = res.data.message || {
          _id: `init-${Date.now()}`,
          text: initialMessage,
          senderName: user?.name || "You",
          senderRole: "user",
          createdAt: new Date().toISOString(),
          read: false,
          isSending: false,
          attachments: curAtts.map((a) => ({
            filename: a.name,
            size: a.size,
            type: a.type,
            mimetype: a.type,
            _id: "pending",
          })),
        };
        startTransition(() => {
          setTickets((prev) =>
            sortTicketsNewest([
              {
                ...newTicket,
                lastMessage: initialMessage,
                lastMessageTime: firstMsg.createdAt,
              },
              ...(Array.isArray(prev) ? prev : []),
            ]),
          );
          setSelectedTicket(newTicket);
          setMessages((prev) => ({ ...prev, [newTicket._id]: [firstMsg] }));
        });
        resetForm();
        loadStats();
        setTimeout(() => loadMessages(newTicket._id, false), 1200);
        if (onTicketCreated) onTicketCreated(newTicket);
        setMobilePanel("chat");
        showAlert(
          "Ticket Created Successfully",
          newTicket.isSchoolTicket
            ? "Your ticket has been created! It will be handled by your School Admin."
            : "Your ticket has been created! Our team will connect with you soon.",
          "success",
        );
      }
    } catch (err) {
      showAlert(
        "Error",
        err.response?.data?.message || "Failed to create ticket",
        "error",
      );
    } finally {
      setCreatingTicket(false);
    }
  }, [
    category,
    priority,
    initialMessage,
    courseName,
    prefillInternship,
    inputInternshipId,
    user,
    getToken,
    resetForm,
    loadStats,
    loadMessages,
    onTicketCreated,
    showAlert,
  ]);

  // ── Send message ───────────────────────────────────────────────
  const handleSendMessage = useCallback(
    async (textFromInput) => {
      if (isSendingRef.current) return;
      const ticketId = selectedTicketIdRef.current;
      const curTicket = selectedTicketRef.current;
      const curAtts = [...attachmentsRef.current];
      const curText = typeof textFromInput === "string" ? textFromInput : "";
      const curReplyTo = replyingToRef.current;
      if (!ticketId || !curTicket) return;
      if (curTicket.status === "resolved" || curTicket.status === "closed")
        return;
      if (!curText.trim() && curAtts.length === 0) return;
      isSendingRef.current = true;
      setSendingMessage(true);
      const tempId = `temp-${Date.now()}`,
        now = new Date().toISOString();
      setMessages((prev) => ({
        ...prev,
        [ticketId]: [
          ...(prev[ticketId] || []),
          {
            _id: tempId,
            text: curText,
            senderName: "You",
            senderRole: "user",
            createdAt: now,
            read: true,
            isSending: true,
            attachments: curAtts.map((a) => ({
              filename: a.name,
              size: a.size,
              type: a.type,
              _id: "pending",
            })),
            replyTo: curReplyTo,
          },
        ],
      }));
      startTransition(() => {
        setTickets((prev) =>
          sortTicketsNewest(
            prev.map((t) =>
              t._id === ticketId
                ? {
                    ...t,
                    lastMessage: curText || "📎 Attachment",
                    lastMessageTime: now,
                  }
                : t,
            ),
          ),
        );
      });
      setSendClearSignal((s) => s + 1);
      setAttachments([]);
      setReplyingTo(null);
      scrollToBottom();
      try {
        const token = getToken();
        if (!token) {
          isSendingRef.current = false;
          setSendingMessage(false);
          return;
        }
        const fd = new FormData();
        fd.append("text", curText);
        curAtts.forEach((att) => fd.append("files", att.file, att.name));
        if (curReplyTo) fd.append("replyTo", curReplyTo._id);
        const res = await axios.post(`${API_URL}/message/${ticketId}`, fd, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
        });
        const serverMsg = res.data.message;
        setMessages((prev) => ({
          ...prev,
          [ticketId]: (prev[ticketId] || []).map((m) =>
            m._id === tempId ? serverMsg : m,
          ),
        }));
        startTransition(() => {
          setTickets((prev) =>
            sortTicketsNewest(
              prev.map((t) =>
                t._id === ticketId
                  ? {
                      ...t,
                      lastMessage: curText || "📎 Attachment",
                      lastMessageTime: serverMsg.createdAt,
                    }
                  : t,
              ),
            ),
          );
        });
        scrollToBottom();
      } catch (err) {
        setMessages((prev) => ({
          ...prev,
          [ticketId]: (prev[ticketId] || []).filter((m) => m._id !== tempId),
        }));
        setAttachments(curAtts);
        if (curReplyTo) setReplyingTo(curReplyTo);
        showAlert(
          "Send Failed",
          err?.response?.data?.message || err?.message || "Unknown error",
          "error",
        );
      } finally {
        isSendingRef.current = false;
        setSendingMessage(false);
      }
    },
    [scrollToBottom, getToken, showAlert],
  );

  const handleSelectTicket = useCallback(
    (ticket) => {
      setSelectedTicket(ticket);
      setShowNewTicketForm(false);
      setMobilePanel("chat");
      startTransition(() =>
        setTickets((prev) =>
          prev.map((t) =>
            t._id === ticket._id ? { ...t, unread: false, unreadCount: 0 } : t,
          ),
        ),
      );
      loadMessages(ticket._id);
    },
    [loadMessages],
  );

  const handleDeleteMessage = useCallback(
    async (messageId) => {
      if (!window.confirm("Delete this message?")) return;
      setDeletingMessage(messageId);
      try {
        const token = getToken();
        if (!token) return;
        await axios.delete(`${API_URL}/message/${messageId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {
        showAlert("Delete Failed", "Failed to delete message", "error");
      } finally {
        setDeletingMessage(null);
      }
    },
    [getToken, showAlert],
  );

  // ── File download ──────────────────────────────────────────────
  const downloadFile = useCallback(
    async (att) => {
      try {
        const token = getToken();
        if (!token) return;
        const attId = att._id || att.id;
        if (
          !attId ||
          attId === "pending" ||
          String(attId).startsWith("temp-")
        ) {
          showAlert(
            "File Not Ready",
            "Please wait for the message to finish sending.",
            "error",
          );
          return;
        }
        const isAdminSender = ["admin", "school-admin", "partner"].includes(
          att.senderRole,
        );
        const primaryUrl = isAdminSender
          ? `${ADMIN_FILE_URL}/file/${attId}`
          : `${API_URL}/file/${attId}`;
        const fallbackUrl = isAdminSender
          ? `${API_URL}/file/${attId}`
          : `${ADMIN_FILE_URL}/file/${attId}`;
        const headers = { Authorization: `Bearer ${token}` };
        let response;
        try {
          response = await axios.get(primaryUrl, {
            headers,
            responseType: "blob",
            timeout: 30000,
          });
        } catch (primaryErr) {
          if (primaryErr?.response?.status >= 400) {
            response = await axios.get(fallbackUrl, {
              headers,
              responseType: "blob",
              timeout: 30000,
            });
          } else throw primaryErr;
        }
        const filename =
          att.filename ||
          att.name ||
          (() => {
            const cd = response.headers?.["content-disposition"] || "";
            const match = cd.match(/filename[^;=\n]*=(['"]?)([^'"\n]+)\1/);
            return match ? match[2].trim() : "download";
          })();
        const blob = new Blob([response.data], {
          type: response.headers["content-type"] || "application/octet-stream",
        });
        const blobUrl = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
      } catch (err) {
        const status = err?.response?.status;
        const message =
          err?.response?.data instanceof Blob
            ? await err.response.data.text().then((t) => {
                try {
                  return JSON.parse(t).message;
                } catch {
                  return t;
                }
              })
            : err?.response?.data?.message || err?.message || "Unknown error";
        showAlert(
          "Download Failed",
          `Download failed (${status || "network error"}): ${message}`,
          "error",
        );
      }
    },
    [getToken, showAlert],
  );

  // ── Derived values ─────────────────────────────────────────────
  const tabCounts = useMemo(() => {
    const c = {
      all: 0,
      unread: 0,
      open: 0,
      inprogress: 0,
      resolved: 0,
      urgent: 0,
    };
    for (const t of tickets) {
      c.all++;
      if (t.unread) c.unread++;
      if (t.status === "open") c.open++;
      if (t.status === "in-progress") c.inprogress++;
      if (t.status === "resolved" || t.status === "closed") c.resolved++;
      if (
        t.priority === "urgent" &&
        t.status !== "resolved" &&
        t.status !== "closed"
      )
        c.urgent++;
    }
    return c;
  }, [tickets]);

  const filteredTickets = useMemo(() => {
    if (!Array.isArray(tickets)) return [];
    let rows = tickets;
    if (activeTab === "unread") rows = rows.filter((t) => t.unread);
    if (activeTab === "open") rows = rows.filter((t) => t.status === "open");
    if (activeTab === "inprogress")
      rows = rows.filter((t) => t.status === "in-progress");
    if (activeTab === "resolved")
      rows = rows.filter(
        (t) => t.status === "resolved" || t.status === "closed",
      );
    if (activeTab === "urgent")
      rows = rows.filter(
        (t) =>
          t.priority === "urgent" &&
          t.status !== "resolved" &&
          t.status !== "closed",
      );
    const q = ticketSearch.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((t) =>
      [
        t._id,
        t.category,
        t.courseName,
        t.priority,
        t.status,
        t.lastMessage,
        t.description,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [tickets, activeTab, ticketSearch]);

  useEffect(() => {
    setPage(1);
  }, [activeTab, ticketSearch]);

  const TICKETS_PER_PAGE = 10;
  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(filteredTickets.length / TICKETS_PER_PAGE));
  }, [filteredTickets.length]);

  const safePage = useMemo(() => {
    return Math.min(page, totalPages);
  }, [page, totalPages]);

  const paginatedTickets = useMemo(() => {
    const startIdx = (safePage - 1) * TICKETS_PER_PAGE;
    return filteredTickets.slice(startIdx, startIdx + TICKETS_PER_PAGE);
  }, [filteredTickets, safePage]);

  const isSchoolStudent = useMemo(
    () => !!(user?.school && user.school !== "Not specified"),
    [user],
  );
  const hasPrefill = !!prefillInternship?.jobTitle;
  const isTicketClosed =
    selectedTicket?.status === "resolved" ||
    selectedTicket?.status === "closed";
  const currentTicketMessages = useMemo(
    () => (selectedTicket ? messages[selectedTicket._id] || [] : []),
    [messages, selectedTicket?._id], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const handleNewTicketClick = useCallback(() => {
    if (hasPrefill) {
      setShowNewTicketForm(true);
      setCategory("Internship Access");
      setCourseName(prefillInternship.jobTitle);
      setInitialMessage(buildDefaultMessage(prefillInternship));
      setPriority("medium");
    } else {
      setShowNewTicketForm(true);
    }
  }, [hasPrefill, prefillInternship]);

  const handleCancelReply = useCallback(() => setReplyingTo(null), []);
  const removeAttachment = useCallback(
    (id) => setAttachments((prev) => prev.filter((a) => a.id !== id)),
    [],
  );
  const removeNewTicketAttachment = useCallback(
    (id) => setNewTicketAttachments((prev) => prev.filter((a) => a.id !== id)),
    [],
  );

  // Tab buttons
  const tabButtons = useMemo(() => {
    const tabs = [
      { id: "all", label: `All (${tabCounts.all})` },
      {
        id: "unread",
        label: `Unread${tabCounts.unread > 0 ? ` (${tabCounts.unread})` : ""}`,
      },
      {
        id: "urgent",
        label: `Urgent${tabCounts.urgent > 0 ? ` (${tabCounts.urgent})` : ""}`,
      },
      { id: "open", label: `Open (${tabCounts.open})` },
      {
        id: "inprogress",
        label: `In Progress${tabCounts.inprogress > 0 ? ` (${tabCounts.inprogress})` : ""}`,
      },
      {
        id: "resolved",
        label: `Resolved${tabCounts.resolved > 0 ? ` (${tabCounts.resolved})` : ""}`,
      },
    ];
    return tabs.map(({ id, label }) => (
      <button
        key={id}
        onClick={() => setActiveTab(id)}
        className={`flex-shrink-0 px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
          activeTab === id
            ? "bg-indigo-600 text-white shadow-sm"
            : "bg-transparent text-gray-500 hover:text-gray-900 hover:bg-gray-100"
        }`}
      >
        {label}
      </button>
    ));
  }, [tabCounts, activeTab]);

  // ─────────────────────────────────────────────────────────────
  //  RENDER
  // ─────────────────────────────────────────────────────────────
  return (
    <div
      className="h-screen flex flex-col overflow-hidden"
      style={{
        background: "#F4F5F7",
        fontFamily: "Inter,system-ui,sans-serif",
      }}
    >
      <style>{GLOBAL_CSS}</style>

      {/* Modals */}
      {ticketToDelete && (
        <DeleteTicketModal
          ticket={ticketToDelete}
          onDeleteForMe={handleDeleteForMe}
          onDeleteForEveryone={handleDeleteForEveryone}
          onCancel={handleCancelDeleteTicket}
          deleting={deletingTicket}
        />
      )}

      {alertModal.show && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{
            background: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(4px)",
          }}
          onClick={() => setAlertModal((p) => ({ ...p, show: false }))}
        >
          <div
            className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl flex flex-col items-center text-center border border-slate-100 animate-[modalFadeIn_0.22s_ease-out]"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 animate-pulse ${
                alertModal.type === "success"
                  ? "bg-green-100 text-green-600"
                  : "bg-red-100 text-red-600"
              }`}
            >
              {alertModal.type === "success" ? (
                <FaCheckCircle className="w-8 h-8" />
              ) : (
                <FaExclamationTriangle className="w-8 h-8" />
              )}
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              {alertModal.title}
            </h3>
            <p className="text-sm text-gray-500 mb-6">{alertModal.message}</p>
            <button
              onClick={() => setAlertModal((p) => ({ ...p, show: false }))}
              className="w-full py-3 rounded-xl text-white font-bold text-sm shadow-lg hover:opacity-90 active:scale-95 transition-all"
              style={{ background: BRAND_GRAD, boxShadow: BRAND_SHADOW }}
            >
              Okay
            </button>
          </div>
        </div>
      )}

      {/* Create Ticket Drawer */}
      <CreateTicketDrawer
        open={showNewTicketForm}
        onClose={resetForm}
        category={category}
        setCategory={setCategory}
        priority={priority}
        setPriority={setPriority}
        initialMessage={initialMessage}
        setInitialMessage={setInitialMessage}
        courseName={courseName}
        setCourseName={setCourseName}
        inputInternshipId={inputInternshipId}
        setInputInternshipId={setInputInternshipId}
        onSubmit={handleCreateTicket}
        creatingTicket={creatingTicket}
        attachments={newTicketAttachments}
        onFilesSelected={handleNewTicketFilesSelected}
        onRemoveAttachment={removeNewTicketAttachment}
        isSchoolStudent={isSchoolStudent}
        hasPrefill={hasPrefill}
        prefillInternship={prefillInternship}
      />

      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-5 py-2.5 bg-white border-b border-gray-200 shrink-0 shadow-sm z-40">
        {/* Left: Title */}
        <div className="flex items-center gap-4 flex-1">
          <div className="hidden lg:flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: BRAND_GRAD }}
            >
              <FaHeadset className="text-white w-4 h-4" />
            </div>
            <div>
              <h1 className="text-base font-black text-gray-900 leading-tight">
                {hasPrefill
                  ? "Raise a Ticket"
                  : openTicketId
                    ? "Support Ticket"
                    : "Support Desk"}
              </h1>
            </div>
          </div>
        </div>

        {/* Center: Logo */}
        <div className="flex-1 flex justify-center">
          <img
            src={logo}
            alt="Skillnaav"
            className="h-8 w-auto object-contain"
          />
        </div>

        {/* Right side: socket status + unread badge + Create Ticket */}
        <div className="flex items-center justify-end gap-3 flex-1">
          {/* Socket indicator */}
          <div className="hidden sm:flex items-center gap-1.5">
            <div
              className={`w-1.5 h-1.5 rounded-full ${socketConnected ? "bg-green-500" : "bg-red-400"}`}
            />
            <span className="text-xs text-gray-400">
              {socketConnected ? "Live" : "Polling"}
            </span>
          </div>

          {stats.unreadMessages > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-600 rounded-lg">
              <FaEnvelope className="w-3 h-3" />
              <span className="text-xs font-bold hidden sm:inline">
                {stats.unreadMessages} unread
              </span>
            </div>
          )}

          {/* Create Ticket */}
          {!openTicketId && (
            <button
              onClick={handleNewTicketClick}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white font-bold text-xs transition-all hover:opacity-90 active:scale-[0.98]"
              style={{ background: BRAND_GRAD, boxShadow: BRAND_SHADOW }}
            >
              <FaPlus className="w-3 h-3" />
              <span className="hidden sm:inline">Create Ticket</span>
              <span className="sm:hidden">New</span>
            </button>
          )}
        </div>
      </div>

      {/* ── 3-panel body ── */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT: Ticket list */}
        <div
          className={`
          flex flex-col border-r border-gray-200 bg-white
          w-full lg:w-[300px] xl:w-[320px] lg:flex shrink-0
          ${mobilePanel === "list" ? "flex" : "hidden lg:flex"}
        `}
        >
          <TicketList
            tickets={paginatedTickets}
            ticketsLoading={ticketsLoading}
            selectedTicketId={selectedTicket?._id}
            activeTab={activeTab}
            tabRows={tabButtons}
            onSelectTicket={handleSelectTicket}
            onLongPress={handleLongPressTicket}
            ticketSearch={ticketSearch}
            onTicketSearchChange={setTicketSearch}
            onNewTicket={handleNewTicketClick}
            currentPage={safePage}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </div>

        {/* CENTER: Conversation */}
        <div
          className={`
          flex-1 flex flex-col overflow-hidden
          ${mobilePanel === "chat" ? "flex" : "hidden lg:flex"}
        `}
        >
          {selectedTicket ? (
            <>
              {/* Ticket conversation header */}
              <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200 shrink-0">
                {/* Mobile back */}
                <button
                  onClick={() => setMobilePanel("list")}
                  className="lg:hidden p-2 text-gray-500 hover:text-gray-900 rounded-lg hover:bg-gray-100"
                >
                  <FaArrowLeft className="w-4 h-4" />
                </button>

                {/* Category icon */}
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-indigo-600 bg-indigo-100">
                  {CATEGORY_ICON_MAP[selectedTicket.category?.toLowerCase()] ||
                    DEFAULT_CATEGORY_ICON}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs text-gray-400">
                      #{selectedTicket._id?.slice(-6)}
                    </span>
                    <h3 className="font-bold text-gray-900 text-sm truncate">
                      {selectedTicket.category}
                    </h3>
                    {selectedTicket.courseName && (
                      <span className="flex items-center gap-1 px-2 py-0.5 bg-violet-100 text-violet-700 text-xs font-semibold rounded-full">
                        <FaBookOpen className="w-2.5 h-2.5" />
                        {selectedTicket.courseName}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {(() => {
                      const pc =
                        PRIORITY_CONFIG[
                          selectedTicket.priority?.toLowerCase()
                        ] || PRIORITY_CONFIG.medium;
                      const sc =
                        STATUS_CONFIG[selectedTicket.status?.toLowerCase()] ||
                        STATUS_CONFIG["open"];
                      return (
                        <>
                          <span
                            className="px-2 py-0.5 rounded-full text-xs font-bold"
                            style={{ background: sc.bg, color: sc.color }}
                          >
                            {sc.label}
                          </span>
                          <span
                            className="px-2 py-0.5 rounded-full text-xs font-bold"
                            style={{ background: pc.bg, color: pc.text }}
                          >
                            {pc.label}
                          </span>
                        </>
                      );
                    })()}
                  </div>
                </div>

                {/* Desktop Toggle Details / Mobile Detail */}
                <button
                  onClick={() => {
                    if (window.innerWidth < 1024) setMobilePanel("detail");
                    else setShowDetails((prev) => !prev);
                  }}
                  className={`p-2 rounded-lg transition-colors ${showDetails ? "text-indigo-600 bg-indigo-50" : "text-gray-500 hover:text-gray-900 hover:bg-gray-100"}`}
                  title="Toggle Ticket Details"
                >
                  <FaTag className="w-4 h-4" />
                </button>

                {/* Close Chat */}
                <button
                  onClick={() => setSelectedTicket(null)}
                  className="p-2 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"
                  title="Close Ticket"
                >
                  <FaTimes className="w-4 h-4" />
                </button>
              </div>

              {/* Drag overlay */}
              <div
                className="relative flex-1 flex flex-col overflow-hidden"
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                {isDragging && (
                  <div className="absolute inset-0 z-20 bg-indigo-500/10 border-2 border-dashed border-indigo-400 rounded-xl flex flex-col items-center justify-center gap-2 pointer-events-none">
                    <FaFile className="w-10 h-10 text-indigo-400" />
                    <p className="text-indigo-600 font-bold">
                      Drop files to attach
                    </p>
                  </div>
                )}
                <ChatMessages
                  ticketMessages={currentTicketMessages}
                  messagesLoading={messagesLoading}
                  onDelete={handleDeleteMessage}
                  onDownload={downloadFile}
                  deletingMessage={deletingMessage}
                  messagesEndRef={messagesEndRef}
                />
              </div>

              <ChatInput
                onSendMessage={handleSendMessage}
                onFilesSelected={handleFilesSelected}
                attachments={attachments}
                onRemoveAttachment={removeAttachment}
                replyingTo={replyingTo}
                onCancelReply={handleCancelReply}
                sendingMessage={sendingMessage}
                isTicketClosed={isTicketClosed}
                onNewTicket={handleNewTicketClick}
                openTicketId={openTicketId}
                selectedTicketStatus={selectedTicket?.status}
                clearSignal={sendClearSignal}
              />
            </>
          ) : (
            /* Empty state */
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col items-center justify-center flex-1 p-8 overflow-y-auto m-6">
              <div className="text-center mb-8">
                <div className="w-20 h-20 mx-auto mb-5 rounded-full flex items-center justify-center bg-gradient-to-br from-indigo-100 to-blue-100">
                  <FaHeadset className="w-10 h-10 text-indigo-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  {isSchoolStudent ? "School Support Desk" : "Support Desk"}
                </h3>
                <p className="text-gray-500 text-sm max-w-md mx-auto">
                  {isSchoolStudent
                    ? "Select a ticket or create a new one to get help from your school admin"
                    : "Select a ticket from the list or create a new one to get started"}
                </p>
                {!openTicketId && (
                  <button
                    onClick={handleNewTicketClick}
                    className="mt-5 px-5 py-2.5 text-white rounded-xl font-bold transition-all hover:opacity-90 active:scale-[0.98] flex items-center gap-1.5 mx-auto text-sm"
                    style={{ background: BRAND_GRAD, boxShadow: BRAND_SHADOW }}
                  >
                    <FaPlus className="w-3.5 h-3.5" />
                    {hasPrefill
                      ? "Raise Ticket for This Internship"
                      : "Create Ticket"}
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full max-w-2xl">
                {[
                  {
                    label: "Total",
                    value: stats.total,
                    icon: <FaInbox className="w-4 h-4" />,
                    color: "indigo",
                  },
                  {
                    label: "Open",
                    value: stats.open,
                    icon: <FaClock className="w-4 h-4" />,
                    color: "green",
                  },
                  {
                    label: "Resolved",
                    value: stats.resolved,
                    icon: <FaCheckCircle className="w-4 h-4" />,
                    color: "purple",
                  },
                  {
                    label: "Unread",
                    value: stats.unreadMessages,
                    icon: <FaEnvelope className="w-4 h-4" />,
                    color: "yellow",
                  },
                ].map(({ label, value, icon, color }) => (
                  <div
                    key={label}
                    className="bg-gray-50 rounded-xl border border-gray-100 p-4 flex items-center gap-3"
                  >
                    <div
                      className={`bg-${color}-100 p-2.5 rounded-lg text-${color}-600 flex-shrink-0`}
                    >
                      {icon}
                    </div>
                    <div>
                      <p
                        className={`text-xl font-bold text-${color}-700 leading-none`}
                      >
                        {value ?? 0}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">{label}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: Ticket detail sidebar */}
        <div
          className={`
          flex flex-col border-l border-gray-200 bg-white overflow-hidden
          w-full lg:w-[260px] xl:w-[280px]
          ${mobilePanel === "detail" ? "flex" : showDetails ? "hidden lg:flex" : "hidden"}
        `}
        >
          {/* Mobile back header */}
          <div className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-gray-100">
            <button
              onClick={() => setMobilePanel("chat")}
              className="p-2 text-gray-500 hover:text-gray-900 rounded-lg hover:bg-gray-100"
            >
              <FaArrowLeft className="w-4 h-4" />
            </button>
            <h3 className="font-bold text-sm text-gray-900">Ticket Details</h3>
          </div>

          <TicketDetailSidebar
            ticket={selectedTicket}
            messages={currentTicketMessages}
          />
        </div>
      </div>
    </div>
  );
};

export default StudentSupport;

export const useDeferredModalMount = (delayMs = 2000) => {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setReady(true), delayMs);
    return () => clearTimeout(t);
  }, [delayMs]);
  return ready;
};
