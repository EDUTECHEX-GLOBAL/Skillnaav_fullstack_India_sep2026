// frontend/src/WebApp/Flows/AdminFlow/MainPage/AdminPartnerSupport.jsx
// SUPPORT ADMIN UI:
//   - Shared support palette and ticket panels
//   - Needs Reply is a 6-hour tab/bell state without top-bumping tickets

import React, { useState, useEffect, useRef, useCallback } from "react";
import { io } from "socket.io-client";
import { useNavigate } from "react-router-dom";
import axios from "../../../../api/axiosInstance";
import {
  FaPaperPlane,
  FaSpinner,
  FaUserTie,
  FaInbox,
  FaCheckCircle,
  FaClock,
  FaHeadset,
  FaBuilding,
  FaSearch,
  FaChevronDown,
  FaTrash,
  FaPaperclip,
  FaDownload,
  FaFilePdf,
  FaFileWord,
  FaFileAlt,
  FaFileImage,
  FaFile,
  FaTimes,
  FaExclamationTriangle,
  FaBolt,
  FaExclamationCircle,
  FaGraduationCap,
  FaFilter,
  FaChevronUp,
  FaArrowLeft,
  FaFlag,
  FaHourglass,
  FaChevronRight,
  FaChevronLeft,
  FaMicrophone,
  FaMicrophoneSlash,
  FaBell,
  FaExternalLinkAlt,
} from "react-icons/fa";

const API_BASE = "/api/support/partner/admin";
const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || "http://localhost:5000";
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_EXTENSIONS = [
  ".pdf",
  ".doc",
  ".docx",
  ".txt",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
];
const MONGO_ID_RE = /^[a-f\d]{24}$/i;

const TICKETS_PER_PAGE = 10;

const getToken = () => localStorage.getItem("adminToken") || "";

const isJwtExpired = (token) => {
  if (!token) return true;
  try {
    const payload = JSON.parse(
      atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
    );
    return payload.exp ? payload.exp * 1000 <= Date.now() : false;
  } catch {
    return false;
  }
};

const getAuthHeaders = () => {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const STATUS_CLASSES = {
  open: "bg-green-100 text-green-800",
  "in-progress": "bg-yellow-100 text-yellow-800",
  resolved: "bg-purple-100 text-purple-800",
  closed: "bg-gray-100 text-gray-800",
};
const PRIORITY_CLASSES = {
  urgent: "bg-red-100 text-red-800",
  high: "bg-orange-100 text-orange-800",
  medium: "bg-yellow-100 text-yellow-800",
  low: "bg-green-100 text-green-800",
};

const G_INDIGO = "linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%)";
const G_GREEN = "linear-gradient(135deg,#059669 0%,#0d9488 100%)";
const G_ORANGE = "linear-gradient(135deg,#f97316 0%,#ef4444 100%)";
const G_AMBER = "linear-gradient(135deg,#3b82f6 0%,#2563eb 100%)";
const G_CHAT = "linear-gradient(180deg,#f8f7ff 0%,#f1f0ff 100%)";
const NEEDS_REPLY_AFTER_MS = 6 * 60 * 60 * 1000;
const CLOSED_STATUSES = ["resolved", "closed"];
const PARTNER_NEEDS_REPLY_ROLES = ["partner", "user", "school-admin"];

const PARTNER_CATEGORIES = [
  "Technical Issue",
  "Subscription Issues",
  "Account Issues",
  "Posted Internship Issues",
  "General Inquiry",
  "Internship Access",
];
const STATUS_OPTIONS = ["All", "open", "in-progress", "resolved", "closed"];
const PRIORITY_OPTIONS = ["All", "low", "medium", "high", "urgent"];
const PARTNER_CATEGORY_OPTIONS = ["All", ...PARTNER_CATEGORIES];
const SORT_OPTIONS = ["Newest", "Oldest", "Status", "Priority"];
const BLANK_FILTERS = {
  search: "",
  status: "All",
  priority: "All",
  category: "All",
  sort: "Newest",
};

const isEscalatedFromStudent = (t) => {
  const subj = t.subject || "";
  return (
    subj.startsWith("[Escalated]") ||
    subj.startsWith("[Forwarded]") ||
    !!t.forwardedToPartner?.originalTicketId ||
    !!t.forwardedFrom?.ticketId
  );
};

const dedupe = (arr) => {
  const seen = new Set();
  return arr.filter((m) => {
    if (!m._id || seen.has(String(m._id))) return false;
    seen.add(String(m._id));
    return true;
  });
};

const timeAgo = (d) => {
  if (!d) return "";
  const s = Math.floor((Date.now() - new Date(d)) / 1000);
  if (s < 60) return "Just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};
const fmtBytes = (b) => {
  if (!b) return "0 B";
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
};
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

const getFileIcon = (type, name) => {
  const ext = name?.split(".").pop()?.toLowerCase();
  if (type?.includes("pdf") || ext === "pdf")
    return <FaFilePdf className="w-4 h-4 text-red-400" />;
  if (type?.includes("word") || ["doc", "docx"].includes(ext))
    return <FaFileWord className="w-4 h-4 text-blue-400" />;
  if (type?.includes("text") || ext === "txt")
    return <FaFileAlt className="w-4 h-4 text-gray-300" />;
  if (
    type?.includes("image") ||
    ["png", "jpg", "jpeg", "gif", "webp"].includes(ext)
  )
    return <FaFileImage className="w-4 h-4 text-green-300" />;
  return <FaFile className="w-4 h-4 text-gray-300" />;
};
const isImageFile = (type, name) => {
  const ext = name?.split(".").pop()?.toLowerCase();
  return (
    type?.includes("image") ||
    ["png", "jpg", "jpeg", "gif", "webp"].includes(ext)
  );
};

const sendDesktopNotification = (title, body, tag) => {
  if (Notification?.permission === "granted") {
    try {
      new Notification(title, { body, icon: "/favicon.ico", tag });
    } catch (_) {}
  }
};
const requestNotificationPermission = () => {
  if (Notification?.permission === "default") {
    Notification.requestPermission().catch(() => {});
  }
};

const applyFilters = (tickets, f) => {
  let list = [...tickets];
  if (f.search) {
    const q = f.search.toLowerCase();
    list = list.filter(
      (t) =>
        (t.subject || "").toLowerCase().includes(q) ||
        (t.senderName || "").toLowerCase().includes(q) ||
        (t.displayName || "").toLowerCase().includes(q) ||
        (t.studentName || "").toLowerCase().includes(q),
    );
  }
  if (f.status !== "All") list = list.filter((t) => t.status === f.status);
  if (f.priority !== "All")
    list = list.filter((t) => t.priority === f.priority);
  if (f.category !== "All")
    list = list.filter((t) => (t.category || "") === f.category);

  const sortFn = (a, b) => {
    if (f.sort === "Oldest")
      return (
        new Date(a.lastActivity || a.createdAt) -
        new Date(b.lastActivity || b.createdAt)
      );
    if (f.sort === "Priority") {
      const r = { urgent: 0, high: 1, medium: 2, low: 3 };
      return (r[a.priority] ?? 4) - (r[b.priority] ?? 4);
    }
    if (f.sort === "Status")
      return (a.status || "").localeCompare(b.status || "");
    return (
      new Date(b.lastActivity || b.createdAt) -
      new Date(a.lastActivity || a.createdAt)
    );
  };

  return list.sort(sortFn);
};

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const fn = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  return isMobile;
}

// ═══════════════════════════════════════════════════════════════════════════
// NEEDS REPLY MODE
//
// Needs Reply is displayed as a tab, banner, and bell state only.
// A lightweight timer refreshes the display; it does not mutate or reorder tickets.
// ═══════════════════════════════════════════════════════════════════════════
function useNeedsReplyMode() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);
  return now;
}

const lastMessageRole = (ticket) =>
  (
    ticket?.lastMessageSender ||
    ticket?.lastMessageRole ||
    ticket?.lastSenderRole ||
    ""
  ).toLowerCase();

const lastMessageAt = (ticket) => {
  const raw =
    ticket?.lastMessageTime ||
    ticket?.lastActivity ||
    ticket?.updatedAt ||
    ticket?.createdAt;
  const at = raw ? new Date(raw).getTime() : NaN;
  return Number.isFinite(at) ? at : null;
};

const isNeedsReplyTicket = (ticket, now = Date.now()) => {
  if (!ticket || CLOSED_STATUSES.includes(ticket.status)) return false;
  if (ticket.autoEscalated) return true;
  const at = lastMessageAt(ticket);
  if (!at || now - at < NEEDS_REPLY_AFTER_MS) return false;
  const role = lastMessageRole(ticket);
  if (role) return PARTNER_NEEDS_REPLY_ROLES.includes(role);
  return (
    (ticket.unreadByAdmin || 0) > 0 ||
    (ticket.unreadCount || 0) > 0 ||
    !!ticket.unread
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// ✅ FIXED: ESCALATION TOASTS — capped at 3 visible at a time
//
// Keeps only the latest few Needs Reply toasts visible.
// ═══════════════════════════════════════════════════════════════════════════
function EscalationToasts({ toasts, onDismiss }) {
  if (!toasts.length) return null;
  return (
    <div
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        zIndex: 99999,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        maxWidth: 340,
      }}
    >
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(120%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
      {toasts.map((t) => (
        <div
          key={t.id}
          style={{
            background: "linear-gradient(135deg,#fffbeb,#fef3c7)",
            border: "1.5px solid #fbbf24",
            borderRadius: 14,
            padding: "12px 14px",
            boxShadow:
              "0 8px 30px rgba(251,191,36,0.2), 0 2px 8px rgba(0,0,0,0.06)",
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
            animation: "slideInRight 0.4s cubic-bezier(0.34,1.56,0.64,1) both",
          }}
        >
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: "50%",
              background: G_AMBER,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              boxShadow: "0 3px 8px rgba(251,191,36,0.35)",
            }}
          >
            <FaHourglass style={{ color: "#fff", width: 13, height: 13 }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p
              style={{
                fontSize: "0.75rem",
                fontWeight: 700,
                color: "#92400e",
                margin: "0 0 2px",
              }}
            >
              ⚠️ Ticket needs response
            </p>
            <p
              style={{
                fontSize: "0.7rem",
                color: "#b45309",
                margin: "0 0 1px",
                fontWeight: 600,
              }}
            >
              {t.partnerName}
            </p>
            <p style={{ fontSize: "0.67rem", color: "#d97706", margin: 0 }}>
              Needs reply · {(t.subject || "").substring(0, 40)}
            </p>
          </div>
          <button
            onClick={() => onDismiss(t.id)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#d97706",
              padding: 2,
              flexShrink: 0,
              lineHeight: 1,
            }}
          >
            <FaTimes style={{ width: 10, height: 10 }} />
          </button>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// NOTIFICATION BELL
// ═══════════════════════════════════════════════════════════════════════════
function NotificationBell({ unreadCount, needsReplyCount, onClick }) {
  const totalCount = (unreadCount || 0) + (needsReplyCount || 0);
  const active = totalCount > 0;
  const isAmber = needsReplyCount > 0;

  const [ring, setRing] = useState(false);
  const prevCountRef = useRef(totalCount);
  useEffect(() => {
    if (totalCount > prevCountRef.current) {
      setRing(true);
      const t = setTimeout(() => setRing(false), 800);
      return () => clearTimeout(t);
    }
    prevCountRef.current = totalCount;
  }, [totalCount]);

  return (
    <>
      <style>{`
        @keyframes bell-ring {
          0%,100% { transform: rotate(0deg); }
          15%      { transform: rotate(15deg); }
          30%      { transform: rotate(-12deg); }
          45%      { transform: rotate(10deg); }
          60%      { transform: rotate(-8deg); }
          75%      { transform: rotate(5deg); }
        }
        @keyframes badge-pop {
          0%   { transform: scale(0.5); opacity:0; }
          70%  { transform: scale(1.2); }
          100% { transform: scale(1);   opacity:1; }
        }
        @keyframes bell-pulse-green {
          0%   { box-shadow: 0 0 0 0 rgba(16,185,129,0.5); }
          70%  { box-shadow: 0 0 0 8px rgba(16,185,129,0); }
          100% { box-shadow: 0 0 0 0 rgba(16,185,129,0); }
        }
        @keyframes bell-pulse-indigo {
          0%   { box-shadow: 0 0 0 0 rgba(99,102,241,0.5); }
          70%  { box-shadow: 0 0 0 8px rgba(99,102,241,0); }
          100% { box-shadow: 0 0 0 0 rgba(99,102,241,0); }
        }
        .bell-icon-wrap { animation: ${ring ? "bell-ring 0.8s ease-in-out" : "none"}; transform-origin: top center; display:inline-block; }
        .bell-badge-anim { animation: badge-pop 0.35s cubic-bezier(.34,1.56,.64,1) both; }
      `}</style>
      <button
        onClick={onClick}
        title={
          needsReplyCount > 0
            ? `${needsReplyCount} ticket${needsReplyCount > 1 ? "s" : ""} need reply · ${unreadCount} unread`
            : unreadCount > 0
              ? `${unreadCount} unread ticket${unreadCount > 1 ? "s" : ""}`
              : "No notifications"
        }
        style={{
          position: "relative",
          width: 38,
          height: 38,
          borderRadius: "50%",
          border: "none",
          background: active
            ? isAmber
              ? "linear-gradient(135deg,#10b981 0%,#059669 100%)"
              : G_INDIGO
            : "#f3f4f6",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "all 0.2s ease",
          flexShrink: 0,
          boxShadow: active
            ? isAmber
              ? "0 4px 14px rgba(16,185,129,0.4)"
              : "0 4px 14px rgba(99,102,241,0.4)"
            : "none",
          animation: active
            ? isAmber
              ? "bell-pulse-green 1.5s ease infinite"
              : "bell-pulse-indigo 1.5s ease infinite"
            : "none",
        }}
      >
        <span className="bell-icon-wrap">
          <FaBell
            style={{
              width: 14,
              height: 14,
              color: active ? "#fff" : "#9ca3af",
            }}
          />
        </span>
        {totalCount > 0 && (
          <span
            className="bell-badge-anim"
            style={{
              position: "absolute",
              top: -4,
              right: -4,
              minWidth: 17,
              height: 17,
              borderRadius: 999,
              background: "linear-gradient(135deg,#ef4444,#dc2626)",
              color: "#fff",
              fontSize: "0.58rem",
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 3px",
              border: "2px solid #fff",
              boxShadow: "0 2px 6px rgba(239,68,68,0.5)",
              lineHeight: 1,
            }}
          >
            {totalCount > 99 ? "99+" : totalCount}
          </span>
        )}
      </button>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// UNREAD BANNER
// ═══════════════════════════════════════════════════════════════════════════
function UnreadBanner({ count, onViewUnread, onDismiss }) {
  if (count === 0) return null;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        background: "linear-gradient(135deg,#eff6ff,#dbeafe)",
        border: "1px solid #3b82f6",
        borderRadius: 12,
        padding: "10px 16px",
        marginBottom: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: "50%",
            background: "linear-gradient(135deg,#3b82f6,#2563eb)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            boxShadow: "0 3px 8px rgba(59,130,246,0.35)",
          }}
        >
          <FaBell style={{ width: 13, height: 13, color: "#fff" }} />
        </div>
        <div>
          <p
            style={{
              fontSize: "0.82rem",
              fontWeight: 700,
              color: "#1d4ed8",
              margin: 0,
            }}
          >
            {count} unread message{count > 1 ? "s" : ""} from partners
          </p>
          <p
            style={{ fontSize: "0.7rem", color: "#1d4ed8", margin: "1px 0 0" }}
          >
            Click to view tickets with new messages
          </p>
        </div>
      </div>
      <div
        style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}
      >
        <button
          onClick={onViewUnread}
          style={{
            padding: "7px 16px",
            borderRadius: 8,
            border: "none",
            background: "linear-gradient(135deg,#3b82f6,#2563eb)",
            color: "#fff",
            fontSize: "0.76rem",
            fontWeight: 700,
            cursor: "pointer",
            boxShadow: "0 3px 10px rgba(59,130,246,0.35)",
            whiteSpace: "nowrap",
          }}
        >
          View Unread
        </button>
        <button
          onClick={onDismiss}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 4,
            display: "flex",
            alignItems: "center",
            color: "#3b82f6",
          }}
        >
          <FaTimes style={{ width: 10, height: 10 }} />
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// NEEDS REPLY BANNER
// ═══════════════════════════════════════════════════════════════════════════
function NeedsReplyBanner({ count, onViewAll }) {
  if (!count) return null;
  return (
    <div
      style={{
        background: "linear-gradient(135deg,#eff6ff,#dbeafe)",
        border: "1px solid #3b82f6",
        borderRadius: 12,
        padding: "10px 16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 10,
        gap: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: "50%",
            background: "linear-gradient(135deg,#3b82f6,#2563eb)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            boxShadow: "0 3px 8px rgba(59,130,246,0.35)",
          }}
        >
          <FaExclamationTriangle
            style={{ color: "#fff", width: 13, height: 13 }}
          />
        </div>
        <div>
          <p
            style={{
              fontSize: "0.82rem",
              fontWeight: 700,
              color: "#1e3a8a",
              margin: 0,
            }}
          >
            {count} ticket{count > 1 ? "s" : ""} need{count === 1 ? "s" : ""} a
            reply
          </p>
          <p
            style={{ fontSize: "0.7rem", color: "#1d4ed8", margin: "1px 0 0" }}
          >
            Use the Needs Reply tab or bell notification to review them
          </p>
        </div>
      </div>
      <button
        onClick={onViewAll}
        style={{
          background: "linear-gradient(135deg,#3b82f6,#2563eb)",
          border: "none",
          borderRadius: 8,
          padding: "7px 16px",
          color: "#fff",
          fontSize: "0.76rem",
          fontWeight: 700,
          cursor: "pointer",
          flexShrink: 0,
          boxShadow: "0 3px 10px rgba(59,130,246,0.35)",
          whiteSpace: "nowrap",
        }}
      >
        View All
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// StatusDropdown
// ═══════════════════════════════════════════════════════════════════════════
function StatusDropdown({ value, onChange, isAmberHeader }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const options = [
    { value: "open", label: "Open", color: "#059669" },
    { value: "in-progress", label: "In Progress", color: "#d97706" },
    { value: "resolved", label: "Resolved", color: "#7c3aed" },
    { value: "closed", label: "Closed", color: "#6b7280" },
  ];
  const current = options.find((o) => o.value === value) || options[0];
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);
  return (
    <div ref={ref} style={{ position: "relative", flexShrink: 0 }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "5px 10px",
          borderRadius: 8,
          border: isAmberHeader
            ? "1px solid rgba(120,53,15,0.3)"
            : "1px solid rgba(255,255,255,0.35)",
          background: isAmberHeader
            ? "rgba(255,255,255,0.4)"
            : "rgba(255,255,255,0.15)",
          color: isAmberHeader ? "#78350f" : "#fff",
          fontWeight: 700,
          fontSize: "0.7rem",
          cursor: "pointer",
          whiteSpace: "nowrap",
          fontFamily: "inherit",
        }}
      >
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: current.color,
            flexShrink: 0,
            display: "inline-block",
            boxShadow: isAmberHeader
              ? "0 0 0 2px rgba(120,53,15,0.2)"
              : "0 0 0 2px rgba(255,255,255,0.3)",
          }}
        />
        {current.label}
        <FaChevronDown
          style={{
            width: 8,
            height: 8,
            opacity: 0.75,
            transition: "transform 0.2s",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
          }}
        />
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            background: "#ffffff",
            borderRadius: 10,
            boxShadow:
              "0 8px 30px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.08)",
            border: "1px solid #e5e7eb",
            minWidth: 148,
            zIndex: 9999,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "6px 12px 4px",
              fontSize: "0.6rem",
              fontWeight: 700,
              color: "#9ca3af",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              borderBottom: "1px solid #f3f4f6",
              fontFamily: "inherit",
            }}
          >
            Update Status
          </div>
          {options.map((opt) => {
            const isActive = opt.value === value;
            return (
              <button
                key={opt.value}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  width: "100%",
                  padding: "8px 12px",
                  background: isActive ? "#f5f3ff" : "transparent",
                  border: "none",
                  cursor: "pointer",
                  textAlign: "left",
                  fontSize: "0.78rem",
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? "#4f46e5" : "#374151",
                  transition: "background 0.12s",
                  fontFamily: "inherit",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.background = "#f9fafb";
                }}
                onMouseLeave={(e) => {
                  if (!isActive)
                    e.currentTarget.style.background = "transparent";
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: opt.color,
                    flexShrink: 0,
                    boxShadow: isActive ? `0 0 0 3px ${opt.color}22` : "none",
                  }}
                />
                {opt.label}
                {isActive && (
                  <span
                    style={{
                      marginLeft: "auto",
                      color: "#6366f1",
                      fontSize: "0.72rem",
                    }}
                  >
                    ✓
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SearchFilterBar
// ═══════════════════════════════════════════════════════════════════════════
function SearchFilterBar({
  filters,
  onChange,
  unreadCount,
  needsReplyCount,
  onBellClick,
}) {
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const accent = "#6366f1";
  const update = (k, v) => onChange({ ...filters, [k]: v });
  const reset = () => onChange({ ...BLANK_FILTERS });
  const filterFields = [
    { label: "Status", key: "status", opts: STATUS_OPTIONS },
    { label: "Priority", key: "priority", opts: PRIORITY_OPTIONS },
    { label: "Category", key: "category", opts: PARTNER_CATEGORY_OPTIONS },
  ];
  const activeCount =
    (filters.status !== "All" ? 1 : 0) +
    (filters.priority !== "All" ? 1 : 0) +
    (filters.category !== "All" ? 1 : 0);

  return (
    <div style={{ fontFamily: "'DM Sans','Segoe UI',sans-serif" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "nowrap",
        }}
      >
        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            alignItems: "center",
            gap: 8,
            height: 38,
            background: "#fff",
            border: focused ? `1.5px solid ${accent}` : "1.5px solid #d1d5db",
            borderRadius: 8,
            padding: "0 12px",
            boxShadow: focused ? `0 0 0 3px rgba(99,102,241,0.08)` : "none",
            transition: "border-color 0.18s,box-shadow 0.18s",
          }}
        >
          <FaSearch
            style={{
              color: focused ? accent : "#9ca3af",
              width: 12,
              height: 12,
              flexShrink: 0,
            }}
          />
          {/*Add marginTop: "0px" for alignment - 06-08-2026 */}
          <input
            value={filters.search}
            onChange={(e) => update("search", e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="Search partner, subject…"
            style={{
              marginTop: "0px",
              flex: 1,
              border: "none",
              outline: "none",
              fontSize: "0.8rem",
              color: "#1e293b",
              background: "transparent",
              fontFamily: "inherit",
              minWidth: 0,
            }}
          />
          {filters.search && (
            <button
              onClick={() => update("search", "")}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 0,
                display: "flex",
                alignItems: "center",
                flexShrink: 0,
              }}
            >
              <FaTimes style={{ color: "#9ca3af", width: 10, height: 10 }} />
            </button>
          )}
        </div>
        <button
          onClick={() => setOpen((o) => !o)}
          style={{
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            gap: 5,
            height: 38,
            padding: "0 12px",
            border:
              open || activeCount > 0
                ? `1.5px solid ${accent}`
                : "1.5px solid #d1d5db",
            borderRadius: 8,
            background:
              open || activeCount > 0 ? "rgba(99,102,241,0.06)" : "#fff",
            color: open || activeCount > 0 ? accent : "#374151",
            fontWeight: 600,
            fontSize: "0.78rem",
            cursor: "pointer",
            whiteSpace: "nowrap",
            transition: "all 0.18s",
            fontFamily: "inherit",
          }}
        >
          <FaFilter style={{ width: 10, height: 10 }} />
          <span>Filters</span>
          {activeCount > 0 && (
            <span
              style={{
                background: accent,
                color: "#fff",
                borderRadius: "50%",
                width: 16,
                height: 16,
                fontSize: "0.58rem",
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {activeCount}
            </span>
          )}
          {open ? (
            <FaChevronUp style={{ width: 8, height: 8 }} />
          ) : (
            <FaChevronDown style={{ width: 8, height: 8 }} />
          )}
        </button>
        <div style={{ position: "relative", flexShrink: 0 }}>
          <select
            value={filters.sort}
            onChange={(e) => update("sort", e.target.value)}
            style={{
              appearance: "none",
              height: 38,
              padding: "0 24px 0 10px",
              border: "1.5px solid #d1d5db",
              borderRadius: 8,
              background: "#fff",
              color: "#374151",
              fontWeight: 600,
              fontSize: "0.78rem",
              cursor: "pointer",
              outline: "none",
              fontFamily: "inherit",
            }}
          >
            {SORT_OPTIONS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <FaChevronDown
            style={{
              position: "absolute",
              right: 7,
              top: "50%",
              transform: "translateY(-50%)",
              width: 8,
              height: 8,
              color: "#9ca3af",
              pointerEvents: "none",
            }}
          />
        </div>
        {activeCount > 0 && (
          <button
            onClick={reset}
            style={{
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              gap: 4,
              height: 38,
              padding: "0 10px",
              border: "1.5px solid #fca5a5",
              borderRadius: 8,
              background: "#fff5f5",
              color: "#ef4444",
              fontSize: "0.74rem",
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            <FaTimes style={{ width: 8, height: 8 }} />
          </button>
        )}
        <NotificationBell
          unreadCount={unreadCount}
          needsReplyCount={needsReplyCount}
          onClick={onBellClick}
        />
      </div>
      <div
        style={{
          overflow: "hidden",
          maxHeight: open ? 200 : 0,
          opacity: open ? 1 : 0,
          transition: "max-height 0.25s ease, opacity 0.2s ease",
          marginTop: open ? 10 : 0,
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3,1fr)",
            gap: 8,
            background: "#f9fafb",
            border: "1.5px solid #e5e7eb",
            borderRadius: 10,
            padding: "10px 12px",
          }}
        >
          {filterFields.map(({ label, key, opts }) => (
            <div key={key}>
              <label
                style={{
                  display: "block",
                  fontSize: "0.62rem",
                  fontWeight: 700,
                  color: "#6b7280",
                  marginBottom: 4,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  fontFamily: "inherit",
                }}
              >
                {label}
              </label>
              <div style={{ position: "relative" }}>
                <select
                  value={filters[key]}
                  onChange={(e) => update(key, e.target.value)}
                  style={{
                    width: "100%",
                    appearance: "none",
                    padding: "5px 22px 5px 8px",
                    border:
                      filters[key] !== "All"
                        ? `1.5px solid ${accent}`
                        : "1.5px solid #d1d5db",
                    borderRadius: 7,
                    background:
                      filters[key] !== "All" ? "rgba(99,102,241,0.06)" : "#fff",
                    color: filters[key] !== "All" ? accent : "#374151",
                    fontWeight: filters[key] !== "All" ? 600 : 400,
                    fontSize: "0.76rem",
                    cursor: "pointer",
                    outline: "none",
                    fontFamily: "inherit",
                  }}
                >
                  {opts.map((o) => (
                    <option key={o} value={o}>
                      {o === "All" ? "All" : cap(o)}
                    </option>
                  ))}
                </select>
                <FaChevronDown
                  style={{
                    position: "absolute",
                    right: 6,
                    top: "50%",
                    transform: "translateY(-50%)",
                    width: 7,
                    height: 7,
                    color: "#9ca3af",
                    pointerEvents: "none",
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// AttachmentBubble
// ═══════════════════════════════════════════════════════════════════════════
function AttachmentBubble({ attachment, ticketId, messageId }) {
  const [downloading, setDownloading] = useState(false);
  const [imgSrc, setImgSrc] = useState(null);
  const [imgError, setImgError] = useState(false);

  const attId = attachment._id ? String(attachment._id) : null;
  const isValidId = attId && MONGO_ID_RE.test(attId);
  const prvUrl = isValidId ? `${API_BASE}/file/${attId}/preview` : null;
  const dlUrl = isValidId ? `${API_BASE}/file/${attId}` : null;
  const showPrev =
    isImageFile(attachment.mimetype || attachment.type, attachment.filename) &&
    !imgError &&
    isValidId;

  useEffect(() => {
    if (!showPrev || !prvUrl) return;
    let alive = true;
    (async () => {
      try {
        const r = await axios.get(prvUrl, {
          headers: getAuthHeaders(),
          responseType: "blob",
        });
        if (alive) setImgSrc(URL.createObjectURL(r.data));
      } catch {
        if (alive) setImgError(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [prvUrl, showPrev]);
  useEffect(
    () => () => {
      if (imgSrc) URL.revokeObjectURL(imgSrc);
    },
    [imgSrc],
  );

  const handleDl = async (e) => {
    if (e) e.stopPropagation();
    if (downloading || !dlUrl) return;
    setDownloading(true);
    try {
      const r = await axios.get(dlUrl, {
        headers: getAuthHeaders(),
        responseType: "blob",
      });
      const blob = r.data;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = attachment.filename || "file";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      alert("Download failed.");
    } finally {
      setDownloading(false);
    }
  };

  if (showPrev)
    return (
      <div
        className="mt-1.5 rounded-xl overflow-hidden"
        style={{ maxWidth: 220 }}
      >
        {imgSrc ? (
          <img
            src={imgSrc}
            alt={attachment.filename}
            style={{ width: "100%", display: "block", borderRadius: 10 }}
          />
        ) : (
          <div
            style={{
              width: 220,
              height: 130,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(255,255,255,0.1)",
              borderRadius: 10,
            }}
          >
            <FaSpinner
              className="animate-spin"
              style={{ color: "#fff", width: 20, height: 20 }}
            />
          </div>
        )}
        <button
          onClick={handleDl}
          disabled={downloading}
          className="flex items-center gap-1.5 w-full px-2 py-1.5"
          style={{
            background: "rgba(0,0,0,0.25)",
            color: "#fff",
            fontSize: "0.7rem",
            borderTop: "1px solid rgba(255,255,255,0.15)",
          }}
        >
          {downloading ? (
            <FaSpinner className="w-3 h-3 animate-spin" />
          ) : (
            <FaDownload className="w-3 h-3" />
          )}
          <span className="truncate flex-1 text-left">
            {attachment.filename}
          </span>
          <span style={{ opacity: 0.75 }}>{fmtBytes(attachment.size)}</span>
        </button>
      </div>
    );

  return (
    <button
      onClick={handleDl}
      disabled={downloading}
      className="flex items-center gap-2 mt-1.5 px-3 py-2 rounded-xl w-full text-left"
      style={{
        background: "rgba(255,255,255,0.15)",
        border: "1px solid rgba(255,255,255,0.25)",
        minWidth: 160,
        maxWidth: 240,
        cursor: downloading ? "not-allowed" : "pointer",
        opacity: downloading ? 0.7 : 1,
      }}
    >
      {getFileIcon(attachment.mimetype || attachment.type, attachment.filename)}
      <div className="flex-1 min-w-0">
        <p
          className="text-white font-medium truncate"
          style={{ fontSize: "0.75rem" }}
        >
          {attachment.filename}
        </p>
        <p style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.7)" }}>
          {fmtBytes(attachment.size)}
        </p>
      </div>
      {downloading ? (
        <FaSpinner className="w-3.5 h-3.5 text-white animate-spin" />
      ) : (
        <FaDownload className="w-3.5 h-3.5 text-white opacity-80" />
      )}
    </button>
  );
}

function FilePreviewStrip({ files, onRemove }) {
  if (!files.length) return null;
  return (
    <div className="flex flex-wrap gap-2 px-3 py-2 border-t border-gray-100 bg-gray-50">
      {files.map((f, i) => (
        <div
          key={i}
          className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg px-2 py-1.5 shadow-sm"
          style={{ maxWidth: 170 }}
        >
          {getFileIcon(f.type, f.name)}
          <div className="min-w-0 flex-1">
            <p
              className="text-gray-700 font-medium truncate"
              style={{ fontSize: "0.7rem" }}
            >
              {f.name}
            </p>
            <p className="text-gray-400" style={{ fontSize: "0.62rem" }}>
              {fmtBytes(f.size)}
            </p>
          </div>
          <button
            onClick={() => onRemove(i)}
            className="text-gray-400 hover:text-red-500 flex-shrink-0 ml-1"
          >
            <FaTimes className="w-2.5 h-2.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

function DeleteModal({ onConfirm, onCancel, loading }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: "0 16px",
      }}
      onClick={onCancel}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 16,
          padding: "24px 24px",
          width: "100%",
          maxWidth: 320,
          boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
          textAlign: "center",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            background: "#fee2e2",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 12px",
          }}
        >
          <FaTrash style={{ color: "#ef4444", width: 16, height: 16 }} />
        </div>
        <h3
          style={{
            fontSize: "1rem",
            fontWeight: 700,
            color: "#111827",
            marginBottom: 6,
          }}
        >
          Delete Message?
        </h3>
        <p style={{ fontSize: "0.8rem", color: "#6b7280", marginBottom: 20 }}>
          This action cannot be undone.
        </p>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1,
              padding: "9px 0",
              borderRadius: 10,
              border: "1px solid #e5e7eb",
              background: "#fff",
              color: "#374151",
              fontWeight: 600,
              fontSize: "0.8rem",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            style={{
              flex: 1,
              padding: "9px 0",
              borderRadius: 10,
              border: "none",
              background: "linear-gradient(135deg,#ef4444,#dc2626)",
              color: "#fff",
              fontWeight: 600,
              fontSize: "0.8rem",
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ChatBubble
// ═══════════════════════════════════════════════════════════════════════════
function ChatBubble({ msg, selected, onDelete }) {
  const [hovered, setHovered] = useState(false);
  const isAdmin = msg.senderRole === "admin";
  const isPartner = msg.senderRole === "partner";
  const isStudent = msg.senderRole === "user";
  const isSystem = msg.senderRole === "system";

  if (isSystem)
    return (
      <div className="flex justify-center my-2">
        <span
          className="px-3 py-1 rounded-full bg-gray-200 text-gray-600 text-center"
          style={{ fontSize: "0.7rem" }}
        >
          {msg.text}
        </span>
      </div>
    );

  if (isAdmin)
    return (
      <div
        className="flex group mb-3 justify-end"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div className="relative" style={{ maxWidth: "75%" }}>
          <p
            className="font-medium text-right mb-0.5 px-1 text-indigo-500"
            style={{ fontSize: "0.66rem" }}
          >
            {msg.senderName || "Admin"}
          </p>
          <div
            style={{
              padding: "7px 11px",
              borderRadius: "14px 14px 3px 14px",
              background: G_INDIGO,
              color: "#fff",
              boxShadow: "0 3px 10px rgba(99,102,241,0.3)",
            }}
          >
            {msg.text && (
              <p
                style={{
                  fontSize: "0.8rem",
                  lineHeight: 1.45,
                  wordBreak: "break-word",
                  margin: 0,
                }}
              >
                {msg.text}
              </p>
            )}
            {(msg.attachments || []).map((att, ai) => (
              <AttachmentBubble
                key={att._id || ai}
                attachment={att}
                ticketId={selected?._id}
                messageId={msg._id}
              />
            ))}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                marginTop: 4,
                gap: 3,
                opacity: 0.8,
              }}
            >
              <span style={{ fontSize: "0.62rem" }}>
                {timeAgo(msg.createdAt)}
              </span>
            </div>
          </div>
          {hovered && (
            <button
              onClick={() => onDelete(msg._id)}
              title="Delete"
              style={{
                position: "absolute",
                top: "50%",
                transform: "translateY(-50%)",
                left: "-28px",
                width: 22,
                height: 22,
                borderRadius: "50%",
                background: "#fee2e2",
                border: "1px solid #fca5a5",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                zIndex: 10,
              }}
            >
              <FaTrash style={{ width: 8, height: 8, color: "#ef4444" }} />
            </button>
          )}
        </div>
        <div
          className="w-6 h-6 rounded-full flex items-center justify-center ml-1.5 mt-1 flex-shrink-0 shadow-sm"
          style={{ background: G_INDIGO }}
        >
          <FaUserTie className="w-3 h-3 text-white" />
        </div>
      </div>
    );

  if (isPartner)
    return (
      <div className="flex group mb-3 justify-start">
        <div
          className="w-6 h-6 rounded-full flex items-center justify-center mr-1.5 mt-1 flex-shrink-0 shadow-sm text-white font-bold"
          style={{ background: G_GREEN, fontSize: "0.6rem" }}
        >
          {(msg.senderName || "P")[0]?.toUpperCase()}
        </div>
        <div className="relative" style={{ maxWidth: "75%" }}>
          <p
            className="font-semibold text-emerald-600 mb-0.5 px-1"
            style={{ fontSize: "0.66rem" }}
          >
            {msg.senderName || selected?.displayName || "Partner"}
          </p>
          <div
            style={{
              padding: "7px 11px",
              borderRadius: "14px 14px 14px 3px",
              background: G_GREEN,
              color: "#fff",
              boxShadow: "0 3px 10px rgba(5,150,105,0.25)",
            }}
          >
            {msg.text && (
              <p
                style={{
                  fontSize: "0.8rem",
                  lineHeight: 1.45,
                  wordBreak: "break-word",
                  margin: 0,
                }}
              >
                {msg.text}
              </p>
            )}
            {(msg.attachments || []).map((att, ai) => (
              <AttachmentBubble
                key={att._id || ai}
                attachment={att}
                ticketId={selected?._id}
                messageId={msg._id}
              />
            ))}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                marginTop: 4,
                gap: 3,
                opacity: 0.8,
              }}
            >
              <span style={{ fontSize: "0.62rem" }}>
                {timeAgo(msg.createdAt)}
              </span>
            </div>
          </div>
        </div>
      </div>
    );

  if (isStudent)
    return (
      <div className="flex group mb-3 justify-start">
        <div
          className="w-6 h-6 rounded-full flex items-center justify-center mr-1.5 mt-1 flex-shrink-0 shadow-sm"
          style={{ background: G_ORANGE }}
        >
          <FaGraduationCap className="w-3 h-3 text-white" />
        </div>
        <div className="relative" style={{ maxWidth: "75%" }}>
          <p
            className="font-semibold text-orange-600 mb-0.5 px-1"
            style={{ fontSize: "0.66rem" }}
          >
            {msg.senderName || "Student"}{" "}
            <span className="text-gray-400 font-normal">(student)</span>
          </p>
          <div
            style={{
              padding: "7px 11px",
              borderRadius: "14px 14px 14px 3px",
              background: G_ORANGE,
              color: "#fff",
              boxShadow: "0 3px 10px rgba(249,115,22,0.25)",
            }}
          >
            {msg.text && (
              <p
                style={{
                  fontSize: "0.8rem",
                  lineHeight: 1.45,
                  wordBreak: "break-word",
                  margin: 0,
                }}
              >
                {msg.text}
              </p>
            )}
            {(msg.attachments || []).map((att, ai) => (
              <AttachmentBubble
                key={att._id || ai}
                attachment={att}
                ticketId={selected?._id}
                messageId={msg._id}
              />
            ))}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                marginTop: 4,
                gap: 3,
                opacity: 0.8,
              }}
            >
              <span style={{ fontSize: "0.62rem" }}>
                {timeAgo(msg.createdAt)}
              </span>
            </div>
          </div>
        </div>
      </div>
    );

  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// PAGINATION COMPONENT
// ═══════════════════════════════════════════════════════════════════════════
function Pagination({ currentPage, totalPages, onPageChange }) {
  if (totalPages <= 1) return null;

  const pages = [];
  const delta = 1;
  const left = currentPage - delta;
  const right = currentPage + delta;

  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= left && i <= right)) {
      pages.push(i);
    }
  }

  const withEllipsis = [];
  let prev = null;
  for (const p of pages) {
    if (prev !== null && p - prev > 1) withEllipsis.push("...");
    withEllipsis.push(p);
    prev = p;
  }

  const btnBase = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 30,
    height: 30,
    borderRadius: 7,
    border: "none",
    fontSize: "0.75rem",
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.15s",
    fontFamily: "inherit",
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
        padding: "10px 12px",
        borderTop: "1px solid #f3f4f6",
        background: "#fafafa",
      }}
    >
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        style={{
          ...btnBase,
          background: currentPage === 1 ? "#f3f4f6" : "#fff",
          color: currentPage === 1 ? "#d1d5db" : "#374151",
          border: "1px solid #e5e7eb",
          cursor: currentPage === 1 ? "not-allowed" : "pointer",
        }}
      >
        <FaChevronLeft style={{ width: 9, height: 9 }} />
      </button>
      {withEllipsis.map((p, i) =>
        p === "..." ? (
          <span
            key={`e-${i}`}
            style={{ color: "#9ca3af", fontSize: "0.75rem", padding: "0 2px" }}
          >
            …
          </span>
        ) : (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            style={{
              ...btnBase,
              background:
                p === currentPage
                  ? "linear-gradient(135deg,#6366f1,#8b5cf6)"
                  : "#fff",
              color: p === currentPage ? "#fff" : "#374151",
              border: p === currentPage ? "none" : "1px solid #e5e7eb",
              boxShadow:
                p === currentPage ? "0 2px 8px rgba(99,102,241,0.35)" : "none",
            }}
          >
            {p}
          </button>
        ),
      )}
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        style={{
          ...btnBase,
          background: currentPage === totalPages ? "#f3f4f6" : "#fff",
          color: currentPage === totalPages ? "#d1d5db" : "#374151",
          border: "1px solid #e5e7eb",
          cursor: currentPage === totalPages ? "not-allowed" : "pointer",
        }}
      >
        <FaChevronRight style={{ width: 9, height: 9 }} />
      </button>
      <span
        style={{
          fontSize: "0.68rem",
          color: "#9ca3af",
          marginLeft: 4,
          whiteSpace: "nowrap",
        }}
      >
        {currentPage} / {totalPages}
      </span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TicketList
// ═══════════════════════════════════════════════════════════════════════════
function TicketList({
  tickets,
  selected,
  onSelect,
  loading,
  isMobile,
  activeTab,
  setActiveTab,
  needsReplyNow,
}) {
  const accent = "#6366f1";
  const [currentPage, setCurrentPage] = useState(1);
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, tickets.length]);

  const unread = tickets.filter((t) => (t.unreadByAdmin || 0) > 0).length;
  const needsReply = tickets.filter((t) =>
    isNeedsReplyTicket(t, needsReplyNow),
  ).length;
  const open = tickets.filter((t) => t.status === "open").length;
  const urgent = tickets.filter(
    (t) =>
      t.priority === "urgent" && !["resolved", "closed"].includes(t.status),
  ).length;
  const inProg = tickets.filter((t) => t.status === "in-progress").length;

  const TABS = [
    { key: "all", label: "All", count: tickets.length },
    {
      key: "needs-reply",
      label: "Needs Reply",
      count: needsReply,
      isAmber: true,
    },
    { key: "unread", label: "Unread", count: unread },
    { key: "urgent", label: "Urgent", count: urgent, isUrgentTab: true },
    { key: "open", label: "Open", count: open },
    { key: "in-progress", label: "In Progress", count: inProg },
  ];

  const allVisible = tickets.filter((t) => {
    if (activeTab === "needs-reply")
      return isNeedsReplyTicket(t, needsReplyNow);
    if (activeTab === "unread") return (t.unreadByAdmin || 0) > 0;
    if (activeTab === "urgent")
      return (
        t.priority === "urgent" && !["resolved", "closed"].includes(t.status)
      );
    if (activeTab === "open") return t.status === "open";
    if (activeTab === "in-progress") return t.status === "in-progress";
    return true;
  });

  const totalPages = Math.max(
    1,
    Math.ceil(allVisible.length / TICKETS_PER_PAGE),
  );
  const safePage = Math.min(currentPage, totalPages);
  const startIdx = (safePage - 1) * TICKETS_PER_PAGE;
  const visible = allVisible.slice(startIdx, startIdx + TICKETS_PER_PAGE);

  const renderTicket = (t) => {
    const name = t.displayName || t.senderName || t.studentName || "Partner";
    const isSel = selected?._id === t._id;
    const isUrg = t.priority === "urgent";
    const isEsc = isEscalatedFromStudent(t);
    const isAutoEsc = isNeedsReplyTicket(t, needsReplyNow);
    const hasUnread = (t.unreadByAdmin || 0) > 0;
    const accentColor = isAutoEsc ? "#f59e0b" : isEsc ? "#f97316" : "#6366f1";

    return (
      <div
        key={t._id}
        onClick={() => onSelect(t)}
        style={{
          borderLeft: `4px solid ${isSel ? accentColor : isAutoEsc ? "#fbbf24" : isUrg ? "#ef4444" : hasUnread ? "#6366f1" : "transparent"}`,
          transition: "background 0.15s, border-color 0.15s",
          background:
            isAutoEsc && !isSel
              ? "#ffffff"
              : hasUnread && !isSel
                ? "#eff6ff"
                : undefined,
        }}
      >
        <div
          className={`p-3 cursor-pointer hover:bg-gray-50 transition-all ${isSel ? (isAutoEsc ? "bg-yellow-50" : isEsc ? "bg-orange-50" : "bg-indigo-50") : ""}`}
          style={isAutoEsc || hasUnread ? { background: "transparent" } : {}}
        >
          <div className="flex items-start justify-between mb-1">
            <div className="flex items-center gap-2">
              <div
                className="relative w-8 h-8 rounded-full flex items-center justify-center font-bold text-white flex-shrink-0 shadow-sm"
                style={{
                  background: isAutoEsc ? G_GREEN : isEsc ? G_ORANGE : G_GREEN,
                  fontSize: "0.7rem",
                }}
              >
                {name[0]?.toUpperCase() || "P"}
                {(hasUnread || isAutoEsc) && (
                  <span
                    style={{
                      position: "absolute",
                      top: -2,
                      right: -2,
                      width: 10,
                      height: 10,
                      background: isAutoEsc
                        ? "#3b82f6"
                        : "linear-gradient(135deg,#6366f1,#8b5cf6)",
                      borderRadius: "50%",
                      border: "2px solid #fff",
                      animation:
                        "partner-ping 1.5s cubic-bezier(0,0,0.2,1) infinite",
                    }}
                  />
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span
                    className={`font-semibold truncate max-w-[100px] ${hasUnread || isAutoEsc ? "text-gray-900" : "text-gray-700"}`}
                    style={{ fontSize: "0.8rem" }}
                  >
                    {name}
                  </span>

                  {isEsc && (
                    <span
                      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 font-bold border border-orange-200 flex-shrink-0"
                      style={{ fontSize: "0.6rem" }}
                    >
                      <FaFlag className="w-2 h-2" />
                      Escalated
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0 ml-1">
              {hasUnread && (
                <span
                  className="text-white font-bold min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1"
                  style={{
                    background: G_INDIGO,
                    fontSize: "0.58rem",
                    boxShadow: "0 2px 6px rgba(99,102,241,0.4)",
                  }}
                >
                  {t.unreadByAdmin}
                </span>
              )}
              <span className="text-gray-400" style={{ fontSize: "0.63rem" }}>
                {timeAgo(t.lastActivity || t.createdAt)}
              </span>
            </div>
          </div>
          {t.category && (
            <p
              style={{ fontSize: "0.66rem", color: "#9ca3af", marginBottom: 4 }}
            >
              {t.category}
            </p>
          )}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              className={`px-2 py-0.5 rounded-full font-semibold ${PRIORITY_CLASSES[t.priority] || "bg-gray-100 text-gray-600"}`}
              style={{ fontSize: "0.63rem" }}
            >
              {t.priority}
            </span>
            <span
              className={`px-2 py-0.5 rounded-full font-semibold ${STATUS_CLASSES[t.status] || "bg-gray-100 text-gray-600"}`}
              style={{ fontSize: "0.63rem" }}
            >
              {t.status}
            </span>
            {isAutoEsc && (
              <span
                className="px-2 py-0.5 rounded-full font-semibold bg-blue-100 text-blue-800"
                style={{ fontSize: "0.63rem" }}
              >
                needs reply
              </span>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col"
      style={{
        height: isMobile ? "auto" : 580,
        minHeight: isMobile ? 200 : 580,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <style>{`
        @keyframes partner-ping {
          0%,100% { box-shadow: 0 0 0 0 rgba(99,102,241,0.5); }
          50%      { box-shadow: 0 0 0 4px rgba(99,102,241,0); }
        }
        @keyframes auto-esc-pulse {
          0%,100% { box-shadow: 0 0 0 0 rgba(251,191,36,0); }
          50%      { box-shadow: 0 0 0 4px rgba(251,191,36,0.12); }
        }
        .auto-esc-ticket { animation: auto-esc-pulse 3s ease-in-out infinite; }
      `}</style>

      <div
        className="px-3 pt-3 pb-2 border-b border-gray-100"
        style={{ background: "linear-gradient(to right,#f5f3ff,#eef2ff)" }}
      >
        <h2
          className="font-bold text-gray-800 mb-2"
          style={{ fontSize: "0.88rem" }}
        >
          Partner Tickets ({allVisible.length}
          {allVisible.length !== tickets.length ? ` / ${tickets.length}` : ""})
        </h2>
        <div
          style={{
            display: "flex",
            gap: 6,
            flexWrap: "nowrap",
            overflowX: "auto",
            overflowY: "hidden",
            paddingBottom: 4,
            alignItems: "center",
            maxWidth: "100%",
          }}
        >
          {TABS.map(({ key, label, count, isUrgentTab, isAmber }) => {
            const isActive = activeTab === key;
            return (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                style={{
                  flexShrink: 0,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 3,
                  padding: "4px 10px",
                  borderRadius: 999,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontSize: "0.7rem",
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                  lineHeight: 1.4,
                  transition: "all 0.15s",
                  background: isActive ? "#ffffff" : "#f1f5f9",
                  color: isActive
                    ? "#111827"
                    : isAmber && count > 0
                      ? "#1a741f"
                      : isUrgentTab && count > 0
                        ? "#ef4444"
                        : "#64748b",
                  border: isActive ? "1px solid #e5e7eb" : "none",
                }}
              >
                {isUrgentTab && (
                  <FaBolt style={{ width: 6, height: 6, flexShrink: 0 }} />
                )}
                {isAmber && (
                  <FaHourglass style={{ width: 6, height: 6, flexShrink: 0 }} />
                )}
                {label}
                {count > 0 && (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      minWidth: 13,
                      height: 13,
                      borderRadius: 999,
                      fontSize: "0.52rem",
                      fontWeight: 700,
                      padding: "0 2px",
                      lineHeight: 1,
                      background: isAmber
                        ? "#10b981"
                        : isUrgentTab
                          ? "#ef4444"
                          : accent,
                      color: "#fff",
                    }}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", maxHeight: 480 }}>
        {loading && tickets.length === 0 ? (
          <div className="p-8 text-center">
            <FaSpinner
              className="w-5 h-5 animate-spin mx-auto mb-2"
              style={{ color: accent }}
            />
            <p className="text-xs text-gray-400">Loading…</p>
          </div>
        ) : allVisible.length === 0 ? (
          <div className="p-8 text-center">
            <FaBuilding className="w-10 h-10 text-gray-200 mx-auto mb-2" />
            <p className="text-xs text-gray-400">
              {activeTab === "needs-reply"
                ? "No tickets waiting — great job! 🎉"
                : activeTab === "unread"
                  ? "All messages read ✓"
                  : "No tickets found"}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {visible.map(renderTicket)}
          </div>
        )}
      </div>

      <Pagination
        currentPage={safePage}
        totalPages={totalPages}
        onPageChange={(p) => setCurrentPage(p)}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ChatArea
// ═══════════════════════════════════════════════════════════════════════════
function ChatArea({
  selected,
  messages,
  loadingMsgs,
  reply,
  setReply,
  pendingFiles,
  setPendingFiles,
  fileError,
  setFileError,
  sending,
  onSend,
  onDelete,
  onUpdateStatus,
  onAssign,
  deleteTarget,
  setDeleteTarget,
  deleteLoading,
  onConfirmDelete,
  isMobile,
  onBack,
  needsReplyNow,
}) {
  const msgsEnd = useRef(null);
  const fileInput = useRef(null);
  const recognitionRef = useRef(null);
  const [isListening, setIsListening] = useState(false);

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

    let baseText = reply.trim();

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
        setReply(baseText + (interimStr ? " " + interimStr : ""));
      } else {
        setReply(baseText + (baseText ? " " : "") + interimStr);
      }
    };

    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [isListening, reply, setReply]);
  useEffect(() => {
    msgsEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, selected]);

  const accent = "#6366f1";
  const isEsc = selected ? isEscalatedFromStudent(selected) : false;
  const isAutoEsc = isNeedsReplyTicket(selected, needsReplyNow);
  const chatBg =
    isEsc && !isAutoEsc
      ? "linear-gradient(180deg,#fff8f1 0%,#fff3e8 100%)"
      : G_CHAT;
  const headerGrad = isAutoEsc ? G_INDIGO : isEsc ? G_ORANGE : G_INDIGO;
  const handleFileSelect = (e) => {
    setFileError("");
    const valid = [];
    const errors = [];
    Array.from(e.target.files || []).forEach((f) => {
      const ext = "." + f.name.split(".").pop().toLowerCase();
      if (f.size > MAX_FILE_SIZE) errors.push(`${f.name}: exceeds 10 MB`);
      else if (!ALLOWED_EXTENSIONS.includes(ext))
        errors.push(`${f.name}: type not allowed`);
      else if (pendingFiles.length + valid.length >= 5)
        errors.push("Max 5 files");
      else valid.push(f);
    });
    if (errors.length) setFileError(errors.join(" · "));
    if (valid.length) setPendingFiles((p) => [...p, ...valid].slice(0, 5));
    e.target.value = "";
  };

  const canSend = (reply.trim() || pendingFiles.length > 0) && !sending;
  const chatHeight = isMobile ? "calc(100vh - 120px)" : 580;

  if (!selected)
    return (
      <div
        className="bg-white rounded-xl shadow-sm border border-gray-200 flex items-center justify-center"
        style={{ height: isMobile ? 300 : 580 }}
      >
        <div className="text-center px-6">
          <div
            className="w-14 h-14 mx-auto mb-3 rounded-full flex items-center justify-center"
            style={{ background: "linear-gradient(135deg,#eef2ff,#ede9fe)" }}
          >
            <FaBuilding className="w-7 h-7" style={{ color: "#6366f1" }} />
          </div>
          <h3 className="text-base font-bold text-gray-900 mb-1">
            Partner Support
          </h3>
          <p className="text-gray-500 text-xs max-w-xs mx-auto">
            Select a ticket to view and respond.
          </p>
        </div>
      </div>
    );

  const displayName =
    selected.displayName ||
    selected.senderName ||
    selected.studentName ||
    "Partner";
  const subjectDisplay = (selected.subject || selected.category || "").replace(
    /^\[(Escalated|Forwarded)\]\s*/i,
    "",
  );

  return (
    <div
      className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col"
      style={{
        height: chatHeight,
        borderColor: undefined,
        boxShadow: undefined,
      }}
    >
      {deleteTarget && (
        <DeleteModal
          onConfirm={onConfirmDelete}
          onCancel={() => setDeleteTarget(null)}
          loading={deleteLoading}
        />
      )}
      <input
        ref={fileInput}
        type="file"
        multiple
        accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.gif,.webp"
        style={{ display: "none" }}
        onChange={handleFileSelect}
      />

      <div
        className="p-3 border-b border-gray-200"
        style={{ background: headerGrad }}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {isMobile && onBack && (
              <button
                onClick={onBack}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "4px",
                  display: "flex",
                  alignItems: "center",
                  flexShrink: 0,
                }}
              >
                <FaArrowLeft
                  style={{
                    width: 14,
                    height: 14,
                    color: "rgba(255,255,255,0.8)",
                  }}
                />
              </button>
            )}
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-white flex-shrink-0 shadow-sm"
              style={{
                background: "rgba(255,255,255,0.2)",
                fontSize: "0.7rem",
              }}
            >
              {isAutoEsc ? (
                <FaHourglass className="w-3 h-3" />
              ) : isEsc ? (
                <FaFlag className="w-3 h-3" />
              ) : (
                displayName[0]?.toUpperCase()
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1 flex-wrap">
                <h3
                  className="font-semibold text-white truncate"
                  style={{ fontSize: "0.82rem" }}
                >
                  {subjectDisplay}
                </h3>
                {selected.priority === "urgent" && (
                  <span
                    className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-red-200 text-red-800 font-semibold flex-shrink-0"
                    style={{ fontSize: "0.58rem" }}
                  >
                    <FaBolt className="w-2 h-2" />
                    Urgent
                  </span>
                )}
                {isAutoEsc && (
                  <span
                    className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-white/20 text-white font-semibold flex-shrink-0"
                    style={{ fontSize: "0.58rem" }}
                  >
                    <FaHourglass className="w-2 h-2" />
                    Needs Reply
                  </span>
                )}
                {isEsc && !isAutoEsc && (
                  <span
                    className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-white/20 text-white font-semibold flex-shrink-0"
                    style={{ fontSize: "0.58rem" }}
                  >
                    <FaExternalLinkAlt className="w-2 h-2" />
                    Escalated
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 flex-wrap mt-0.5">
                <span
                  className="text-white/80 truncate"
                  style={{ fontSize: "0.68rem" }}
                >
                  {displayName}
                </span>
                {isEsc && selected.forwardedToPartner?.studentName && (
                  <span
                    className="text-white/70"
                    style={{ fontSize: "0.65rem" }}
                  >
                    · Student: {selected.forwardedToPartner.studentName}
                  </span>
                )}
                <span
                  className="px-1.5 py-0.5 rounded-full font-medium bg-white/20 text-white"
                  style={{ fontSize: "0.62rem" }}
                >
                  {selected.status}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <StatusDropdown
              value={selected.status}
              onChange={(status) => onUpdateStatus(selected._id, status)}
              isAmberHeader={false}
            />
          </div>
        </div>

        {isAutoEsc && (
          <div
            className="mt-2 p-2.5 rounded-xl flex items-start gap-2.5"
            style={{
              background: "linear-gradient(135deg,#eff6ff,#dbeafe)",
              border: "1px solid rgba(255,255,255,0.3)",
            }}
          >
            <FaHourglass
              style={{
                color: "#1e40af",
                width: 14,
                height: 14,
                flexShrink: 0,
                marginTop: 2,
              }}
            />
            <div>
              <p
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  color: "#1e40af",
                  margin: "0 0 2px",
                }}
              >
                This ticket is marked as Needs Reply
              </p>
              <p style={{ fontSize: "0.68rem", color: "#1d4ed8", margin: 0 }}>
                First raised {timeAgo(selected.createdAt)} · Use the Needs Reply
                tab to review it
              </p>
            </div>
          </div>
        )}

        {isEsc && selected.forwardedToPartner && !isAutoEsc && (
          <div
            className="mt-2 p-2 bg-white/10 rounded-lg flex items-start gap-1.5"
            style={{ fontSize: "0.68rem" }}
          >
            <FaExternalLinkAlt className="text-white/80 w-2.5 h-2.5 mt-0.5 flex-shrink-0" />
            <div className="text-white/90">
              <strong>Escalated</strong> by{" "}
              {selected.forwardedToPartner.forwardedBy || "Admin"}
              {selected.forwardedToPartner.internshipTitle && (
                <>
                  {" "}
                  · Internship:{" "}
                  <strong>{selected.forwardedToPartner.internshipTitle}</strong>
                </>
              )}
              {selected.forwardedToPartner.reason && (
                <> · Reason: {selected.forwardedToPartner.reason}</>
              )}
            </div>
          </div>
        )}
      </div>

      <div
        className="flex-1 overflow-y-auto p-3"
        style={{ background: chatBg }}
      >
        {loadingMsgs ? (
          <div className="flex items-center justify-center h-full">
            <FaSpinner
              className="w-6 h-6 animate-spin"
              style={{ color: accent }}
            />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full flex-col">
            <FaHeadset
              className="w-8 h-8 mb-2 opacity-20"
              style={{ color: accent }}
            />
            <p className="text-sm text-gray-400">No messages yet</p>
          </div>
        ) : (
          messages.map((msg) => (
            <ChatBubble
              key={msg._id}
              msg={msg}
              selected={selected}
              onDelete={(id) => setDeleteTarget(id)}
            />
          ))
        )}
        <div ref={msgsEnd} />
      </div>

      {fileError && (
        <div className="px-3 py-1.5 bg-red-50 border-t border-red-100 flex items-center gap-2">
          <FaExclamationTriangle className="text-red-400 w-3 h-3 flex-shrink-0" />
          <span className="text-red-600" style={{ fontSize: "0.7rem" }}>
            {fileError}
          </span>
          <button
            onClick={() => setFileError("")}
            className="ml-auto text-red-400 hover:text-red-600"
          >
            <FaTimes className="w-3 h-3" />
          </button>
        </div>
      )}
      <FilePreviewStrip
        files={pendingFiles}
        onRemove={(i) => setPendingFiles((p) => p.filter((_, j) => j !== i))}
      />

      {["resolved", "closed"].includes(selected.status) ? (
        <div className="p-3 border-t border-gray-200 text-center text-xs text-gray-400 bg-gray-50">
          Ticket is <strong>{selected.status}</strong>.
        </div>
      ) : (
        <div className="p-3 border-t border-gray-200 bg-white">
          <div className="flex items-center gap-2">
            <button
              onClick={() => fileInput.current?.click()}
              className="p-2 rounded-full flex-shrink-0 hover:scale-105 transition-all"
              style={{
                background: "#f3f4f6",
                color: isAutoEsc ? "#d97706" : isEsc ? "#f97316" : accent,
              }}
            >
              <FaPaperclip className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={toggleListening}
              title="Auto Type (Speech to Text)"
              className="p-2 rounded-full flex-shrink-0 transition-all"
              style={{
                background: isListening ? "#fef2f2" : "#f3f4f6",
                color: isListening
                  ? "#ef4444"
                  : isAutoEsc
                    ? "#d97706"
                    : isEsc
                      ? "#f97316"
                      : accent,
                position: "relative",
              }}
            >
              {isListening && (
                <span
                  style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: "50%",
                    animation:
                      "partner-ping 1.5s cubic-bezier(0,0,0.2,1) infinite",
                    border: "2px solid #ef4444",
                    zIndex: 0,
                  }}
                />
              )}
              <div style={{ position: "relative", zIndex: 1 }}>
                {isListening ? (
                  <FaMicrophoneSlash className="w-3.5 h-3.5" />
                ) : (
                  <FaMicrophone className="w-3.5 h-3.5" />
                )}
              </div>
            </button>
            <input
              type="text"
              placeholder={
                isListening
                  ? "Listening..."
                  : isAutoEsc
                    ? "Reply now — marked Needs Reply"
                    : pendingFiles.length
                      ? "Add a caption…"
                      : "Reply… (Enter to send)"
              }
              className="flex-1 border border-gray-300 rounded-full px-3 py-2 outline-none"
              style={{
                fontSize: "0.8rem",
                minWidth: 0,
                borderColor: isAutoEsc ? "#41198b" : undefined,
                boxShadow: isAutoEsc
                  ? "0 0 0 2px rgba(251,191,36,0.15)"
                  : undefined,
              }}
              onFocus={(e) => {
                e.target.style.borderColor = isAutoEsc
                  ? "#4a0e97"
                  : isEsc
                    ? "#171585"
                    : accent;
                e.target.style.boxShadow = `0 0 0 3px rgba(${isAutoEsc ? "251,191,36" : isEsc ? "249,115,22" : "99,102,241"},0.15)`;
              }}
              onBlur={(e) => {
                e.target.style.borderColor = isAutoEsc ? "#3b82f6" : "#d1d5db";
                e.target.style.boxShadow = isAutoEsc
                  ? "0 0 0 2px rgba(251,191,36,0.15)"
                  : "none";
              }}
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  onSend();
                }
              }}
              disabled={sending}
            />
            <button
              onClick={onSend}
              disabled={!canSend}
              className="p-2 rounded-full transition-all flex-shrink-0"
              style={
                canSend
                  ? {
                      background: isAutoEsc
                        ? G_AMBER
                        : isEsc
                          ? G_ORANGE
                          : G_INDIGO,
                      color: "#fff",
                      boxShadow: "0 3px 10px rgba(99,102,241,0.35)",
                    }
                  : {
                      background: "#e5e7eb",
                      color: "#9ca3af",
                      cursor: "not-allowed",
                    }
              }
            >
              {sending ? (
                <FaSpinner className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FaPaperPlane className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════
export default function AdminPartnerSupport() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [mobileView, setMobileView] = useState("list");

  const [allTickets, setAllTickets] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    open: 0,
    inProgress: 0,
    resolved: 0,
    urgent: 0,
    unread: 0,
  });
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState({});
  const [filtersP, setFiltersP] = useState({ ...BLANK_FILTERS });
  const [activeTab, setActiveTab] = useState("all");

  const [selectedP, setSelectedP] = useState(null);
  const [replyP, setReplyP] = useState("");
  const [filesP, setFilesP] = useState([]);
  const [fileErrP, setFileErrP] = useState("");
  const [sendingP, setSendingP] = useState(false);
  const [loadMsgsP, setLoadMsgsP] = useState(false);
  const [delTargetP, setDelTargetP] = useState(null);
  const [delLoadP, setDelLoadP] = useState(false);

  const [unreadBannerDismissed, setUnreadBannerDismissed] = useState(false);
  const [needsReplyBannerDismissed, setNeedsReplyBannerDismissed] =
    useState(false);

  const [escalationToasts, setEscalationToasts] = useState([]);

  const socketRef = useRef(null);
  const selPRef = useRef(null);
  selPRef.current = selectedP;
  const loadStRef = useRef(null);
  const allTicketsRef = useRef([]);
  allTicketsRef.current = allTickets;
  const authRedirectedRef = useRef(false);

  const handleAuthExpired = useCallback(() => {
    if (authRedirectedRef.current) return;
    authRedirectedRef.current = true;
    localStorage.removeItem("adminToken");
    localStorage.removeItem("adminInfo");
    sessionStorage.removeItem("adminSelectedTab");
    navigate("/admin/login", { replace: true });
  }, [navigate]);

  const needsReplyNow = useNeedsReplyMode();
  const unreadTotal = allTickets.filter(
    (t) => (t.unreadByAdmin || 0) > 0,
  ).length;
  const needsReplyTotal = allTickets.filter((t) =>
    isNeedsReplyTicket(t, needsReplyNow),
  ).length;
  const urgentTotal = allTickets.filter(
    (t) =>
      t.priority === "urgent" && !["resolved", "closed"].includes(t.status),
  ).length;

  const prevUnreadRef = useRef(0);
  const prevEscRef = useRef(0);
  useEffect(() => {
    if (unreadTotal > prevUnreadRef.current) setUnreadBannerDismissed(false);
    prevUnreadRef.current = unreadTotal;
  }, [unreadTotal]);
  useEffect(() => {
    if (needsReplyTotal > prevEscRef.current)
      setNeedsReplyBannerDismissed(false);
    prevEscRef.current = needsReplyTotal;
  }, [needsReplyTotal]);

  useEffect(() => {
    requestNotificationPermission();
  }, []);

  // ✅ FIX 2: addEscalationToast now caps at 3 visible toasts max
  // Old code used slice(-4) which allowed up to 5 toasts to stack
  // New code uses slice(-2) so max = 2 old + 1 new = 3 total
  const addEscalationToast = useCallback((data) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    setEscalationToasts((prev) => [...prev.slice(-2), { id, ...data }]);
    setTimeout(() => {
      setEscalationToasts((prev) => prev.filter((t) => t.id !== id));
    }, 12000);
  }, []);

  const dismissToast = useCallback((id) => {
    setEscalationToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const apiFetch = useCallback(
    async (path, opts = {}) => {
      if (isJwtExpired(getToken())) {
        handleAuthExpired();
        throw new Error("Admin session expired. Please login again.");
      }

      try {
        const { body, headers, ...config } = opts;
        const res = await axios({
          url: `${API_BASE}${path}`,
          method: opts.method || "GET",
          data: body,
          headers: { ...getAuthHeaders(), ...(headers || {}) },
          ...config,
        });
        return res.data;
      } catch (err) {
        if (
          err.response?.status === 401 &&
          err.response?.data?.code === "TOKEN_EXPIRED"
        ) {
          handleAuthExpired();
        }
        throw err;
      }
    },
    [handleAuthExpired],
  );

  const loadStats = useCallback(async () => {
    try {
      const d = await apiFetch("/stats");
      setStats(d);
    } catch {}
  }, [apiFetch]);
  loadStRef.current = loadStats;

  const loadAllTickets = useCallback(async () => {
    setLoading(true);
    try {
      const d = await apiFetch("/tickets?limit=200");
      setAllTickets(d.tickets || []);
    } catch {
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  const loadMsgs = useCallback(
    async (ticketId) => {
      if (!ticketId) return;
      try {
        setLoadMsgsP(true);
        const d = await apiFetch(`/tickets/${ticketId}/messages`);
        const msgs = dedupe(d.messages || []);
        setMessages((prev) => ({ ...prev, [ticketId]: msgs }));
      } catch (err) {
        console.error("loadMsgs error:", err);
      } finally {
        setLoadMsgsP(false);
      }
    },
    [apiFetch],
  );

  useEffect(() => {
    loadStats();
    loadAllTickets();
  }, [loadStats, loadAllTickets]);

  useEffect(() => {
    if (isJwtExpired(getToken())) {
      handleAuthExpired();
      return undefined;
    }
    const s = io(SOCKET_URL, {
      auth: { token: getToken() },
      transports: ["websocket", "polling"],
    });
    socketRef.current = s;
    s.on("connect", () => s.emit("join_admin_room"));

    s.on("partner_new_message", ({ ticketId, message }) => {
      const isSel = selPRef.current?._id === ticketId;
      setMessages((prev) => {
        if (!(ticketId in prev)) return prev;
        return {
          ...prev,
          [ticketId]: dedupe([...(prev[ticketId] || []), message]),
        };
      });
      setAllTickets((prev) =>
        prev.map((t) =>
          t._id === ticketId
            ? {
                ...t,
                lastMessage: message.text || "",
                lastMessageTime: message.createdAt || new Date(),
                lastActivity: message.createdAt || new Date(),
                lastMessageSender: message.senderRole,
                unreadByAdmin: isSel ? 0 : (t.unreadByAdmin || 0) + 1,
              }
            : t,
        ),
      );
      if (isSel) {
        setSelectedP((q) =>
          q
            ? {
                ...q,
                lastMessage: message.text || q.lastMessage,
                lastMessageTime: message.createdAt || new Date(),
                lastActivity: message.createdAt || new Date(),
                lastMessageSender: message.senderRole,
              }
            : q,
        );
      }
      if (!isSel && message.senderRole !== "admin") {
        const ticket = allTicketsRef.current.find((t) => t._id === ticketId);
        sendDesktopNotification(
          `💬 New message from ${ticket?.displayName || ticket?.senderName || "Partner"}`,
          message.text?.substring(0, 80) || "New attachment",
          `msg-${ticketId}`,
        );
      }
      if (isSel) {
        apiFetch(`/tickets/${ticketId}/messages/read`, {
          method: "PATCH",
        }).catch(() => {});
      }
      loadStRef.current?.();
    });

    s.on("new_message", ({ ticketId, message }) => {
      const ticketExists = allTicketsRef.current.some(
        (t) => t._id === ticketId,
      );
      if (!ticketExists) return;
      setMessages((prev) => {
        if (!(ticketId in prev)) return prev;
        return {
          ...prev,
          [ticketId]: dedupe([...(prev[ticketId] || []), message]),
        };
      });
      setAllTickets((prev) =>
        prev.map((t) =>
          t._id === ticketId
            ? {
                ...t,
                lastMessage: message.text || "",
                lastMessageTime: message.createdAt || new Date(),
                lastActivity: message.createdAt || new Date(),
                lastMessageSender: message.senderRole,
              }
            : t,
        ),
      );
      if (selPRef.current?._id === ticketId) {
        setSelectedP((q) =>
          q
            ? {
                ...q,
                lastMessage: message.text || q.lastMessage,
                lastMessageTime: message.createdAt || new Date(),
                lastActivity: message.createdAt || new Date(),
                lastMessageSender: message.senderRole,
              }
            : q,
        );
      }
    });

    s.on("partner_new_ticket", ({ ticket }) => {
      setAllTickets((p) =>
        p.some((t) => t._id === ticket._id) ? p : [ticket, ...p],
      );
      loadStRef.current?.();
      sendDesktopNotification(
        `🎫 New partner ticket`,
        ticket.subject || "New support ticket",
        `ticket-${ticket._id}`,
      );
    });
    s.on("partner_ticket_created", ({ ticket }) => {
      setAllTickets((p) =>
        p.some((t) => t._id === ticket._id) ? p : [ticket, ...p],
      );
      loadStRef.current?.();
    });

    s.on("ticket_auto_escalated", (data) => {
      const {
        ticketId,
        studentName,
        partnerName,
        subject,
        hoursWaiting,
        escalationCount,
        message,
      } = data;
      if (!ticketId) return;
      const nameLabel = partnerName || studentName || "Partner";
      addEscalationToast({
        ticketId,
        partnerName: nameLabel,
        subject,
        hoursWaiting,
        escalationCount,
      });

      setAllTickets((q) => {
        const hasTkt = q.some((t) => t._id === ticketId);
        if (!hasTkt) return q;
        return q.map((t) =>
          t._id === ticketId
            ? {
                ...t,
                autoEscalated: true,
                autoEscalatedAt: new Date().toISOString(),
                autoEscalationCount: (t.autoEscalationCount || 0) + 1,
              }
            : t,
        );
      });

      if (selPRef.current?._id === ticketId) {
        setSelectedP((q) =>
          q
            ? {
                ...q,
                autoEscalated: true,
                autoEscalatedAt: new Date().toISOString(),
              }
            : q,
        );
      }
      if (message) {
        setMessages((prev) => {
          if (!(ticketId in prev)) return prev;
          return {
            ...prev,
            [ticketId]: dedupe([...(prev[ticketId] || []), message]),
          };
        });
      }
      loadStRef.current?.();
      sendDesktopNotification(
        `⚠️ Partner ticket needs response — ${nameLabel}`,
        `Needs reply • ${subject}`,
        `escalate-${ticketId}`,
      );
    });

    s.on("ticket_escalation_resolved", ({ ticketId }) => {
      if (!ticketId) return;
      setAllTickets((q) =>
        q.map((t) => (t._id === ticketId ? { ...t, autoEscalated: false } : t)),
      );
      if (selPRef.current?._id === ticketId) {
        setSelectedP((q) => (q ? { ...q, autoEscalated: false } : q));
      }
    });

    s.on("ticket_escalated_to_partner", ({ originalTicketId, message }) => {
      loadAllTickets();
      loadStRef.current?.();
      if (message && selPRef.current?._id === originalTicketId) {
        setMessages((p) => ({
          ...p,
          [originalTicketId]: dedupe([...(p[originalTicketId] || []), message]),
        }));
      }
    });

    s.on("partner_ticket_status_update", ({ ticketId, status }) => {
      setAllTickets((p) =>
        p.map((t) =>
          t._id === ticketId
            ? {
                ...t,
                status,
                autoEscalated: ["resolved", "closed"].includes(status)
                  ? false
                  : t.autoEscalated,
              }
            : t,
        ),
      );
      if (selPRef.current?._id === ticketId)
        setSelectedP((p) =>
          p
            ? {
                ...p,
                status,
                autoEscalated: ["resolved", "closed"].includes(status)
                  ? false
                  : p.autoEscalated,
              }
            : p,
        );
    });
    s.on("ticket_status_update", ({ ticketId, status }) => {
      setAllTickets((p) =>
        p.map((t) =>
          t._id === ticketId
            ? {
                ...t,
                status,
                autoEscalated: ["resolved", "closed"].includes(status)
                  ? false
                  : t.autoEscalated,
              }
            : t,
        ),
      );
      if (selPRef.current?._id === ticketId)
        setSelectedP((p) =>
          p
            ? {
                ...p,
                status,
                autoEscalated: ["resolved", "closed"].includes(status)
                  ? false
                  : p.autoEscalated,
              }
            : p,
        );
    });
    s.on("partner_message_deleted", ({ ticketId, messageId }) => {
      setMessages((p) => ({
        ...p,
        [ticketId]: (p[ticketId] || []).filter((m) => m._id !== messageId),
      }));
    });

    return () => s.disconnect();
  }, [apiFetch, loadAllTickets, addEscalationToast, handleAuthExpired]);

  const openTicket = useCallback(
    async (t) => {
      setSelectedP(t);
      setReplyP("");
      setFilesP([]);
      setFileErrP("");
      if (isMobile) setMobileView("chat");
      setMessages((prev) => ({ ...prev, [t._id]: prev[t._id] || [] }));
      await loadMsgs(t._id);
      if ((t.unreadByAdmin || 0) > 0) {
        try {
          await apiFetch(`/tickets/${t._id}/messages/read`, {
            method: "PATCH",
          });
          setAllTickets((p) =>
            p.map((x) => (x._id === t._id ? { ...x, unreadByAdmin: 0 } : x)),
          );
          loadStats();
        } catch {}
      }
    },
    [isMobile, loadMsgs, apiFetch, loadStats],
  );

  const handleBellClick = useCallback(() => {
    if (needsReplyTotal > 0) {
      setActiveTab("needs-reply");
    } else if (unreadTotal > 0) {
      setActiveTab("unread");
    }
  }, [needsReplyTotal, unreadTotal]);

  const sendMsg = async () => {
    const sel = selectedP;
    if ((!replyP.trim() && filesP.length === 0) || !sel) return;
    if (isJwtExpired(getToken())) {
      handleAuthExpired();
      return;
    }
    setSendingP(true);
    const txt = replyP.trim();
    const fls = [...filesP];
    setReplyP("");
    setFilesP([]);
    setFileErrP("");
    try {
      const fd = new FormData();
      if (txt) fd.append("text", txt);
      fls.forEach((f) => fd.append("files", f));
      const res = await axios.post(
        `${API_BASE}/tickets/${sel._id}/messages`,
        fd,
        {
          headers: getAuthHeaders(),
        },
      );
      const d = res.data;
      setMessages((p) => ({
        ...p,
        [sel._id]: dedupe([...(p[sel._id] || []), d.message]),
      }));
      setAllTickets((p) =>
        p.map((t) =>
          t._id === sel._id
            ? {
                ...t,
                lastMessage: txt || (fls[0]?.name ?? ""),
                lastMessageTime: new Date(),
                lastActivity: new Date(),
                lastMessageSender: "admin",
                autoEscalated: false,
              }
            : t,
        ),
      );
      if (selPRef.current?._id === sel._id) {
        setSelectedP((q) =>
          q
            ? {
                ...q,
                lastMessage: txt || (fls[0]?.name ?? ""),
                lastMessageTime: new Date(),
                lastActivity: new Date(),
                lastMessageSender: "admin",
                autoEscalated: false,
              }
            : q,
        );
      }
    } catch (e) {
      if (
        e.response?.status === 401 &&
        e.response?.data?.code === "TOKEN_EXPIRED"
      ) {
        handleAuthExpired();
      } else {
        alert("Failed to send: " + e.message);
      }
    } finally {
      setSendingP(false);
    }
  };

  const delMsg = async () => {
    const sel = selectedP;
    const msgId = delTargetP;
    if (!msgId || !sel) return;
    setDelLoadP(true);
    try {
      await apiFetch(`/tickets/${sel._id}/messages/${msgId}`, {
        method: "DELETE",
      });
      setMessages((p) => ({
        ...p,
        [sel._id]: (p[sel._id] || []).filter((m) => m._id !== msgId),
      }));
      setDelTargetP(null);
    } catch {
      alert("Failed to delete");
    } finally {
      setDelLoadP(false);
    }
  };

  const updateStatus = async (id, status) => {
    try {
      const d = await apiFetch(`/tickets/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      setAllTickets((p) =>
        p.map((t) =>
          t._id === id
            ? {
                ...d.ticket,
                autoEscalated: ["resolved", "closed"].includes(status)
                  ? false
                  : d.ticket.autoEscalated,
              }
            : t,
        ),
      );
      setSelectedP({
        ...d.ticket,
        autoEscalated: ["resolved", "closed"].includes(status)
          ? false
          : d.ticket.autoEscalated,
      });
    } catch {}
  };

  const assignSelf = async (id) => {
    try {
      const d = await apiFetch(`/tickets/${id}/assign`, { method: "PATCH" });
      setAllTickets((p) => p.map((t) => (t._id === id ? d.ticket : t)));
      setSelectedP(d.ticket);
    } catch {}
  };

  const CARDS = [
    {
      label: "Total",
      value: stats.total,
      icon: <FaInbox className="w-4 h-4" />,
      bg: "bg-indigo-50",
      txt: "text-indigo-600",
    },
    {
      label: "Open",
      value: stats.open,
      icon: <FaClock className="w-4 h-4" />,
      bg: "bg-emerald-50",
      txt: "text-emerald-600",
    },
    {
      label: "In Progress",
      value: stats.inProgress,
      icon: <FaHeadset className="w-4 h-4" />,
      bg: "bg-amber-50",
      txt: "text-amber-600",
    },
    {
      label: "Resolved",
      value: stats.resolved,
      icon: <FaCheckCircle className="w-4 h-4" />,
      bg: "bg-violet-50",
      txt: "text-violet-600",
    },
    {
      label: "Needs Reply",
      value: needsReplyTotal,
      icon: <FaHourglass className="w-4 h-4" />,
      bg: "bg-blue-50",
      txt: "text-blue-600",
    },
    {
      label: "Urgent",
      value: urgentTotal,
      icon: <FaExclamationCircle className="w-4 h-4" />,
      bg: "bg-red-50",
      txt: "text-red-600",
    },
  ];

  const selectedMessages = selectedP ? messages[selectedP._id] || [] : [];
  const displayTickets = applyFilters(allTickets, filtersP);

  return (
    <div
      className="min-h-screen bg-gray-50"
      style={{ padding: isMobile ? "12px" : "24px" }}
    >
      <EscalationToasts toasts={escalationToasts} onDismiss={dismissToast} />

      <div style={{ maxWidth: "100%", margin: "0 auto" }}>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1
              className="font-bold text-gray-900 flex items-center gap-2"
              style={{ fontSize: isMobile ? "1.1rem" : "1.4rem" }}
            >
              <FaBuilding
                className="text-indigo-600"
                style={{
                  width: isMobile ? 14 : 18,
                  height: isMobile ? 14 : 18,
                }}
              />
              Partner Support
            </h1>
            {!isMobile && (
              <p className="text-gray-500 text-sm mt-0.5">
                Manage partner support tickets
              </p>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {needsReplyTotal > 0 && (
              <div
                className="flex items-center px-2 py-1 rounded-lg border"
                style={{
                  color: "#a16207",
                  background: "#fefce8",
                  borderColor: "#fde68a",
                }}
              >
                <FaHourglass
                  style={{ width: 10, height: 10 }}
                  className="mr-1"
                />
                <span style={{ fontSize: "0.72rem", fontWeight: 600 }}>
                  {needsReplyTotal} need reply
                </span>
              </div>
            )}
            {urgentTotal > 0 && (
              <div className="flex items-center px-2 py-1 rounded-lg border text-red-700 bg-red-50 border-red-200">
                <FaBolt style={{ width: 10, height: 10 }} className="mr-1" />
                <span style={{ fontSize: "0.72rem", fontWeight: 600 }}>
                  {urgentTotal}
                </span>
              </div>
            )}
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "repeat(3,1fr)" : "repeat(6,1fr)",
            gap: isMobile ? 8 : 12,
            marginBottom: isMobile ? 12 : 16,
          }}
        >
          {CARDS.map(({ label, value, icon, bg, txt }) => (
            <div
              key={label}
              className="bg-white rounded-xl border border-gray-200 hover:shadow-sm transition-shadow"
              style={{ padding: isMobile ? "8px 10px" : "12px" }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p
                    className="text-gray-400 leading-tight"
                    style={{ fontSize: isMobile ? "0.58rem" : "0.72rem" }}
                  >
                    {label}
                  </p>
                  <p
                    className={`font-bold leading-tight mt-0.5 ${txt}`}
                    style={{ fontSize: isMobile ? "1rem" : "1.2rem" }}
                  >
                    {value ?? 0}
                  </p>
                </div>
                <div
                  className={`${bg} rounded-lg ${txt}`}
                  style={{ padding: isMobile ? "5px" : "7px" }}
                >
                  {icon}
                </div>
              </div>
            </div>
          ))}
        </div>

        {needsReplyTotal > 0 && !needsReplyBannerDismissed && (
          <NeedsReplyBanner
            count={needsReplyTotal}
            onViewAll={() => {
              setActiveTab("needs-reply");
              setNeedsReplyBannerDismissed(true);
            }}
          />
        )}

        {unreadTotal > 0 && !unreadBannerDismissed && (
          <UnreadBanner
            count={unreadTotal}
            onViewUnread={() => {
              setActiveTab("unread");
              setUnreadBannerDismissed(true);
            }}
            onDismiss={() => setUnreadBannerDismissed(true)}
          />
        )}

        <div
          className="bg-white rounded-xl border border-gray-200 mb-3"
          style={{ padding: isMobile ? "10px 12px" : "12px 20px" }}
        >
          <SearchFilterBar
            filters={filtersP}
            onChange={setFiltersP}
            unreadCount={unreadTotal}
            needsReplyCount={needsReplyTotal}
            onBellClick={handleBellClick}
          />
        </div>

        {isMobile ? (
          <>
            {mobileView === "list" && (
              <TicketList
                tickets={displayTickets}
                selected={selectedP}
                onSelect={openTicket}
                loading={loading}
                isMobile={true}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                needsReplyNow={needsReplyNow}
              />
            )}
            {mobileView === "chat" && (
              <ChatArea
                selected={selectedP}
                messages={selectedMessages}
                loadingMsgs={loadMsgsP}
                reply={replyP}
                setReply={setReplyP}
                pendingFiles={filesP}
                setPendingFiles={setFilesP}
                fileError={fileErrP}
                setFileError={setFileErrP}
                sending={sendingP}
                onSend={sendMsg}
                onDelete={(id) => setDelTargetP(id)}
                onUpdateStatus={updateStatus}
                onAssign={assignSelf}
                deleteTarget={delTargetP}
                setDeleteTarget={setDelTargetP}
                deleteLoading={delLoadP}
                onConfirmDelete={delMsg}
                isMobile={true}
                onBack={() => setMobileView("list")}
                needsReplyNow={needsReplyNow}
              />
            )}
          </>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-1">
              <TicketList
                tickets={displayTickets}
                selected={selectedP}
                onSelect={openTicket}
                loading={loading}
                isMobile={false}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                needsReplyNow={needsReplyNow}
              />
            </div>
            <div className="lg:col-span-2">
              <ChatArea
                selected={selectedP}
                messages={selectedMessages}
                loadingMsgs={loadMsgsP}
                reply={replyP}
                setReply={setReplyP}
                pendingFiles={filesP}
                setPendingFiles={setFilesP}
                fileError={fileErrP}
                setFileError={setFileErrP}
                sending={sendingP}
                onSend={sendMsg}
                onDelete={(id) => setDelTargetP(id)}
                onUpdateStatus={updateStatus}
                onAssign={assignSelf}
                deleteTarget={delTargetP}
                setDeleteTarget={setDelTargetP}
                deleteLoading={delLoadP}
                onConfirmDelete={delMsg}
                isMobile={false}
                needsReplyNow={needsReplyNow}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
