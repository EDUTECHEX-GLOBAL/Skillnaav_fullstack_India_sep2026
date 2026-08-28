// frontend/src/WebApp/Flows/AdminFlow/MainPage/StudentSupportCenter.js

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Send,
  Paperclip,
  Loader2,
  CheckCheck,
  Reply,
  Trash2,
  Download,
  XCircle,
  UserCheck,
  GraduationCap,
  AlertTriangle,
  Bug,
  CreditCard,
  Briefcase,
  Lock,
  Users,
  HelpCircle,
  Inbox,
  CheckCircle,
  Clock,
  Headphones,
  Filter,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Info,
  Flag,
  School,
  MessageSquare,
  AlertCircle,
  Hourglass,
  FileText,
  File,
  FileImage,
  Eye,
  X,
  ExternalLink,
  Bell,
  BellRing,
  Timer,
  Mic,
  MicOff,
} from "lucide-react";
import axios from "axios";
import io from "socket.io-client";

// ─── API URLs ─────────────────────────────────────────────────────────────────
const STUDENT_API_URL = "http://localhost:5000/api/support/admin";
const SCHOOL_STU_API_URL = "http://localhost:5000/api/support/school-students";
const SOCKET_URL = "http://localhost:5000";

const ADMIN_FILE_URL = "http://localhost:5000/api/support/admin";
const STUDENT_FILE_URL = "http://localhost:5000/api/support";

// ─── Gradient constants ────────────────────────────────────────────────────────
const G_INDIGO = "linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%)";
const G_GREEN = "linear-gradient(135deg,#059669 0%,#0d9488 100%)";
const G_AMBER = "linear-gradient(135deg,#3b82f6 0%,#2563eb 100%)";
const G_CHAT = "linear-gradient(180deg,#f8f7ff 0%,#f1f0ff 100%)";

const NEEDS_REPLY_AFTER_MS = 6 * 60 * 60 * 1000;
const CLOSED_STATUSES = ["resolved", "closed"];
const NEEDS_REPLY_ROLES = {
  student: ["user", "partner"],
  schoolStudent: ["user", "school-admin", "partner"],
};

const isClosedTicket = (ticket) => CLOSED_STATUSES.includes(ticket?.status);
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

const isNeedsReplyTicket = (ticket, roles, now = Date.now()) => {
  if (!ticket || isClosedTicket(ticket)) return false;
  if (ticket.autoEscalated) return true;
  const at = lastMessageAt(ticket);
  if (!at || now - at < NEEDS_REPLY_AFTER_MS) return false;
  const role = lastMessageRole(ticket);
  if (role) return roles.includes(role);
  return !!(
    ticket.unread ||
    ticket.unreadCount > 0 ||
    ticket.unreadByAdmin > 0
  );
};

// ─── Pure helpers ─────────────────────────────────────────────────────────────
const dedupe = (msgs) => {
  const seen = new Set();
  return msgs.filter((m) => {
    if (!m._id || seen.has(m._id)) return false;
    seen.add(m._id);
    return true;
  });
};

const priorityColor = (p) => {
  switch (p?.toLowerCase()) {
    case "urgent":
      return "bg-red-100 text-red-800 border-red-200";
    case "high":
      return "bg-orange-100 text-orange-800 border-orange-200";
    case "medium":
      return "bg-yellow-100 text-yellow-800 border-yellow-200";
    case "low":
      return "bg-green-100 text-green-800 border-green-200";
    default:
      return "bg-gray-100 text-gray-800 border-gray-200";
  }
};

const timeAgo = (ts) => {
  if (!ts) return "";
  const d = Math.floor((Date.now() - new Date(ts)) / 60000);
  if (d < 1) return "Just now";
  if (d < 60) return `${d}m ago`;
  if (d < 1440) return `${Math.floor(d / 60)}h ago`;
  if (d < 2880) return "Yesterday";
  return new Date(ts).toLocaleDateString();
};

const fmtSize = (b) => {
  if (!b) return "0 B";
  if (b < 1024) return b + " B";
  if (b < 1048576) return (b / 1024).toFixed(1) + " KB";
  return (b / 1048576).toFixed(1) + " MB";
};

const isImg = (mime = "") => mime.startsWith("image/");

const attId = (att) => {
  if (!att?._id) return null;
  if (typeof att._id === "string") return att._id;
  if (typeof att._id === "object" && att._id.toString)
    return att._id.toString();
  return null;
};

const FileIcon = ({ mime = "", size = 16 }) => {
  const s = { width: size, height: size };
  if (isImg(mime)) return <FileImage style={s} />;
  if (mime === "application/pdf") return <FileText style={s} />;
  return <File style={s} />;
};

// ─── Filter / sort constants ──────────────────────────────────────────────────
const CATS = [
  { value: "all", label: "All" },
  { value: "Technical Issue", label: "Technical" },
  { value: "Billing & Payments", label: "Billing" },
  { value: "Internship Access", label: "Internship" },
  { value: "Account Issue", label: "Account" },
  { value: "Student Management", label: "Management" },
  { value: "General Inquiry", label: "General" },
];
const PRIS = [
  { value: "all", label: "All" },
  { value: "urgent", label: "Urgent" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];
const STATUSES = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "in-progress", label: "In Progress" },
  { value: "resolved", label: "Resolved" },
];

// ─── STATUS DROPDOWN ──────────────────────────────────────────────────────────
const STATUS_OPTIONS = [
  { value: "open", label: "Open", dot: "#22c55e" },
  { value: "in-progress", label: "In Progress", dot: "#f97316" },
  { value: "resolved", label: "Resolved", dot: "#a855f7" },
  { value: "closed", label: "Closed", dot: "#9ca3af" },
];

const StatusDropdown = ({ value, onChange, isLight }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const current =
    STATUS_OPTIONS.find((s) => s.value === value) || STATUS_OPTIONS[0];

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
          gap: 5,
          padding: "5px 10px",
          borderRadius: 8,
          cursor: "pointer",
          border: isLight
            ? "1px solid #3b82f6"
            : "1px solid rgba(255,255,255,0.35)",
          background: isLight
            ? "rgba(255,255,255,0.8)"
            : "rgba(255,255,255,0.15)",
          color: isLight ? "#1e3a8a" : "#fff",
          fontWeight: 700,
          fontSize: "0.7rem",
          fontFamily: "inherit",
        }}
      >
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: current.dot,
            flexShrink: 0,
            display: "inline-block",
          }}
        />
        {current.label}
        <ChevronDown style={{ width: 8, height: 8, marginLeft: 2 }} />
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            zIndex: 999,
            background: "#fff",
            borderRadius: 10,
            border: "1px solid #e5e7eb",
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
            minWidth: 150,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "6px 10px",
              fontSize: "0.6rem",
              fontWeight: 700,
              color: "#9ca3af",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              borderBottom: "1px solid #f3f4f6",
            }}
          >
            Update Status
          </div>
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
                padding: "8px 12px",
                border: "none",
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: "0.78rem",
                fontWeight: 500,
                color: value === opt.value ? "#111827" : "#374151",
                background: value === opt.value ? "#f9fafb" : "transparent",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "#f3f4f6")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background =
                  value === opt.value ? "#f9fafb" : "transparent")
              }
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: opt.dot,
                    flexShrink: 0,
                    display: "inline-block",
                  }}
                />
                {opt.label}
              </div>
              {value === opt.value && (
                <span style={{ color: "#6366f1", fontSize: "0.9rem" }}>✓</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
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

// ─── NOTIFICATION BELL ────────────────────────────────────────────────────────
const NotificationBell = ({ unreadCount, needsReplyCount, onClick }) => {
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
          background: active ? (isAmber ? G_GREEN : G_INDIGO) : "#f3f4f6",
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
          {active ? (
            <BellRing style={{ color: "#fff", width: 14, height: 14 }} />
          ) : (
            <Bell style={{ color: "#9ca3af", width: 14, height: 14 }} />
          )}
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
            {totalCount > 9 ? "9+" : totalCount}
          </span>
        )}
      </button>
    </>
  );
};

// ─── ESCALATION BANNER ────────────────────────────────────────────────────────
const EscalationBanner = ({ count, onViewAll }) => {
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
        marginBottom: 12,
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
          <AlertTriangle style={{ color: "#fff", width: 14, height: 14 }} />
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
};

// ─── UNREAD BANNER ────────────────────────────────────────────────────────────
const UnreadBanner = ({ count, onViewAll, onDismiss }) => {
  if (!count) return null;
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
          <MessageSquare style={{ color: "#fff", width: 13, height: 13 }} />
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
            {count} unread message{count > 1 ? "s" : ""} from students
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
          onClick={onViewAll}
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
        {onDismiss && (
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
            <X style={{ width: 10, height: 10 }} />
          </button>
        )}
      </div>
    </div>
  );
};

// ─── PAGINATION ───────────────────────────────────────────────────────────────
const Pagination = ({ currentPage, totalPages, onPageChange }) => {
  if (totalPages <= 1) return null;

  const pages = [];
  const delta = 1;
  const left = currentPage - delta;
  const right = currentPage + delta;

  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= left && i <= right)) pages.push(i);
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
        <ChevronLeft style={{ width: 9, height: 9 }} />
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
              background: p === currentPage ? G_INDIGO : "#fff",
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
        <ChevronRight style={{ width: 9, height: 9 }} />
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
};

// ─── ESCALATION TOASTS ────────────────────────────────────────────────────────
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
              boxShadow: "0 3px 8px rgba(59,130,246,0.35)",
            }}
          >
            <Timer style={{ color: "#fff", width: 13, height: 13 }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p
              style={{
                fontSize: "0.75rem",
                fontWeight: 700,
                color: "#1e3a8a",
                margin: "0 0 2px",
              }}
            >
              ⚠️ Ticket needs response
            </p>
            <p
              style={{
                fontSize: "0.7rem",
                color: "#1d4ed8",
                margin: "0 0 1px",
                fontWeight: 600,
              }}
            >
              {t.studentName || t.partnerName}
            </p>
            <p style={{ fontSize: "0.67rem", color: "#2563eb", margin: 0 }}>
              Needs reply · {(t.subject || "").substring(0, 40)}
            </p>
          </div>
          <button
            onClick={() => onDismiss(t.id)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#2563eb",
              padding: 2,
              flexShrink: 0,
              lineHeight: 1,
            }}
          >
            <X style={{ width: 10, height: 10 }} />
          </button>
        </div>
      ))}
    </div>
  );
}

const Lightbox = ({ src, name, onClose }) => (
  <div
    onClick={onClose}
    style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.9)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 10000,
    }}
  >
    <div
      style={{
        position: "absolute",
        top: 14,
        right: 14,
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}
    >
      <span
        style={{
          color: "rgba(255,255,255,0.75)",
          fontSize: "0.78rem",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          maxWidth: 260,
        }}
      >
        {name}
      </span>
      <button
        onClick={onClose}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "#fff",
          padding: 4,
          lineHeight: 1,
        }}
      >
        <X style={{ width: 22, height: 22 }} />
      </button>
    </div>
    <img
      src={src}
      alt={name}
      onClick={(e) => e.stopPropagation()}
      style={{
        maxWidth: "90vw",
        maxHeight: "86vh",
        objectFit: "contain",
        borderRadius: 10,
        boxShadow: "0 24px 80px rgba(0,0,0,0.7)",
      }}
    />
  </div>
);

const DeleteModal = ({ onConfirm, onCancel, loading }) => (
  <div
    style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.45)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 9999,
    }}
    onClick={onCancel}
  >
    <div
      style={{
        background: "#fff",
        borderRadius: 16,
        padding: "24px 28px",
        width: 320,
        textAlign: "center",
        boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
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
        <Trash2 style={{ color: "#ef4444", width: 16, height: 16 }} />
      </div>
      <h3
        style={{
          fontSize: "0.95rem",
          fontWeight: 700,
          color: "#111827",
          marginBottom: 6,
        }}
      >
        Delete Message?
      </h3>
      <p style={{ fontSize: "0.78rem", color: "#6b7280", marginBottom: 18 }}>
        This action cannot be undone.
      </p>
      <div style={{ display: "flex", gap: 10 }}>
        <button
          onClick={onCancel}
          style={{
            flex: 1,
            padding: "8px 0",
            borderRadius: 10,
            border: "1px solid #e5e7eb",
            background: "#fff",
            color: "#374151",
            fontWeight: 600,
            fontSize: "0.78rem",
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
            padding: "8px 0",
            borderRadius: 10,
            border: "none",
            background: "linear-gradient(135deg,#ef4444,#dc2626)",
            color: "#fff",
            fontWeight: 600,
            fontSize: "0.78rem",
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

const DeleteTicketModal = ({ ticket, onConfirm, onCancel, loading }) => (
  <div
    style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.55)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 9999,
      padding: 16,
    }}
    onClick={onCancel}
  >
    <div
      style={{
        background: "#fff",
        borderRadius: 16,
        padding: "24px 28px",
        width: 380,
        textAlign: "center",
        boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: "50%",
          background: "linear-gradient(135deg,#fee2e2,#fecaca)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 14px",
        }}
      >
        <Trash2 style={{ color: "#ef4444", width: 22, height: 22 }} />
      </div>
      <h3
        style={{
          fontSize: "1rem",
          fontWeight: 700,
          color: "#111827",
          marginBottom: 6,
        }}
      >
        Delete Ticket for Everyone?
      </h3>
      <p style={{ fontSize: "0.78rem", color: "#6b7280", marginBottom: 6 }}>
        This will permanently delete ticket{" "}
        <strong>#{ticket?._id?.slice(-6)}</strong> and all its messages for{" "}
        <strong>everyone</strong>, including the student.
      </p>
      <p
        style={{
          fontSize: "0.72rem",
          color: "#ef4444",
          marginBottom: 20,
          fontWeight: 600,
        }}
      >
        ⚠️ This action cannot be undone.
      </p>
      <div style={{ display: "flex", gap: 10 }}>
        <button
          onClick={onCancel}
          disabled={loading}
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
            opacity: loading ? 0.5 : 1,
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
            fontWeight: 700,
            fontSize: "0.8rem",
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.7 : 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
        >
          {loading ? (
            <Loader2
              style={{ width: 14, height: 14 }}
              className="animate-spin"
            />
          ) : (
            <Trash2 style={{ width: 14, height: 14 }} />
          )}
          {loading ? "Deleting…" : "Delete for Everyone"}
        </button>
      </div>
    </div>
  </div>
);

const EscalationSuccessModal = ({ onClose }) => {
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="escalation-success-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        padding: 16,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(15,23,42,0.58)",
        backdropFilter: "blur(5px)",
      }}
      onClick={onClose}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 460,
          padding: "42px 38px 34px",
          textAlign: "center",
          background: "#fff",
          borderRadius: 28,
          border: "1px solid rgba(255,255,255,0.7)",
          boxShadow: "0 28px 80px rgba(15,23,42,0.30)",
          animation: "supportSuccessIn 220ms cubic-bezier(0.34,1.56,0.64,1)",
        }}
      >
        <div
          style={{
            width: 96,
            height: 96,
            margin: "0 auto 26px",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "linear-gradient(135deg,#ecfdf5,#dcfce7)",
          }}
        >
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#6fcf97",
              boxShadow: "0 10px 24px rgba(34,197,94,0.24)",
            }}
          >
            <CheckCheck
              style={{ width: 30, height: 30, color: "#fff", strokeWidth: 3 }}
            />
          </div>
        </div>

        <h2
          id="escalation-success-title"
          style={{
            margin: "0 0 12px",
            color: "#111827",
            fontSize: "1.65rem",
            lineHeight: 1.25,
            fontWeight: 800,
            letterSpacing: "-0.025em",
          }}
        >
          Ticket Escalated Successfully
        </h2>
        <p
          style={{
            margin: "0 auto 32px",
            maxWidth: 350,
            color: "#6b7280",
            fontSize: "1rem",
            lineHeight: 1.6,
          }}
        >
          The ticket has been forwarded to the partner. Their replies will
          appear in this conversation.
        </p>
        <button
          type="button"
          onClick={onClose}
          autoFocus
          style={{
            width: "100%",
            padding: "14px 20px",
            border: 0,
            borderRadius: 16,
            color: "#fff",
            fontSize: "1rem",
            fontWeight: 700,
            cursor: "pointer",
            background: "linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%)",
            boxShadow: "0 12px 28px rgba(99,102,241,0.30)",
            fontFamily: "inherit",
          }}
        >
          Okay
        </button>
      </div>
      <style>{`
        @keyframes supportSuccessIn {
          from { opacity:0; transform:translateY(18px) scale(0.96); }
          to { opacity:1; transform:translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
};

const EscalateModal = ({ ticket, onConfirm, onCancel, loading }) => {
  const [reason, setReason] = useState("");
  const internshipInfo = ticket?.internshipMeta || {};
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: 16,
      }}
      onClick={onCancel}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 16,
          padding: "24px 28px",
          width: 480,
          maxWidth: "100%",
          boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 16,
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: "50%",
              background: "linear-gradient(135deg,#7c3aed,#6d28d9)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <ExternalLink style={{ color: "#fff", width: 18, height: 18 }} />
          </div>
          <div>
            <h3
              style={{
                fontSize: "1rem",
                fontWeight: 700,
                color: "#111827",
                margin: 0,
              }}
            >
              Escalate to Partner
            </h3>
            <p style={{ fontSize: "0.75rem", color: "#6b7280", margin: 0 }}>
              Forward this internship access issue to the posting partner
            </p>
          </div>
        </div>
        {(internshipInfo.jobTitle || ticket?.courseName) && (
          <div
            style={{
              background: "#f5f3ff",
              border: "1px solid #ddd6fe",
              borderRadius: 10,
              padding: "10px 14px",
              marginBottom: 14,
            }}
          >
            <p
              style={{
                fontSize: "0.7rem",
                fontWeight: 600,
                color: "#7c3aed",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                margin: "0 0 4px",
              }}
            >
              Internship
            </p>
            <p
              style={{
                fontSize: "0.85rem",
                fontWeight: 700,
                color: "#1e1b4b",
                margin: "0 0 2px",
              }}
            >
              {internshipInfo.jobTitle || ticket?.courseName}
            </p>
            {internshipInfo.companyName && (
              <p style={{ fontSize: "0.75rem", color: "#5b21b6", margin: 0 }}>
                {internshipInfo.companyName}
              </p>
            )}
          </div>
        )}
        <div
          style={{
            background: "#f9fafb",
            border: "1px solid #e5e7eb",
            borderRadius: 10,
            padding: "10px 14px",
            marginBottom: 14,
          }}
        >
          <p
            style={{
              fontSize: "0.7rem",
              fontWeight: 600,
              color: "#374151",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              margin: "0 0 4px",
            }}
          >
            Student
          </p>
          <p
            style={{
              fontSize: "0.82rem",
              fontWeight: 600,
              color: "#111827",
              margin: 0,
            }}
          >
            {ticket?.studentName}
          </p>
          {ticket?.studentEmail && (
            <p
              style={{
                fontSize: "0.72rem",
                color: "#6b7280",
                margin: "2px 0 0",
              }}
            >
              {ticket.studentEmail}
            </p>
          )}
        </div>
        <div style={{ marginBottom: 18 }}>
          <label
            style={{
              display: "block",
              fontSize: "0.75rem",
              fontWeight: 600,
              color: "#374151",
              marginBottom: 6,
            }}
          >
            Escalation Reason{" "}
            <span style={{ color: "#9ca3af", fontWeight: 400 }}>
              (optional)
            </span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Student cannot access the internship portal..."
            rows={3}
            style={{
              width: "100%",
              border: "1px solid #d1d5db",
              borderRadius: 8,
              padding: "8px 12px",
              fontSize: "0.8rem",
              resize: "vertical",
              outline: "none",
              fontFamily: "inherit",
              boxSizing: "border-box",
            }}
          />
        </div>
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
            onClick={() => onConfirm(reason)}
            disabled={loading || ticket?.escalatedToPartner}
            style={{
              flex: 2,
              padding: "9px 0",
              borderRadius: 10,
              border: "none",
              background: "linear-gradient(135deg,#7c3aed,#6d28d9)",
              color: "#fff",
              fontWeight: 600,
              fontSize: "0.8rem",
              cursor:
                loading || ticket?.escalatedToPartner
                  ? "not-allowed"
                  : "pointer",
              opacity: loading || ticket?.escalatedToPartner ? 0.7 : 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            {loading && (
              <Loader2
                style={{ width: 14, height: 14 }}
                className="animate-spin"
              />
            )}
            {loading ? "Escalating…" : "Escalate to Partner"}
          </button>
        </div>
      </div>
    </div>
  );
};

const MONGO_ID_RE = /^[a-f\d]{24}$/i;

const AttachmentItem = ({ att, token }) => {
  const [busy, setBusy] = useState(false);
  const [imgSrc, setImgSrc] = useState(null);
  const [lightbox, setLightbox] = useState(false);

  const mime = att.mimetype || att.type || "";
  const name = att.filename || att.name || "file";
  const size = att.size || 0;

  const hasFileId = att.fileId && att.fileId !== "" && att.fileId !== "pending";
  const rawId = att._id
    ? typeof att._id === "string"
      ? att._id
      : (att._id.toString?.() ?? "")
    : "";
  const isValidMongoId =
    MONGO_ID_RE.test(rawId) &&
    !rawId.startsWith("s-") &&
    !rawId.startsWith("tmp-");

  const downloadUrl = hasFileId
    ? `${STUDENT_FILE_URL}/file/${att.fileId}`
    : isValidMongoId
      ? `${ADMIN_FILE_URL}/file/${rawId}`
      : null;

  const previewUrl = hasFileId
    ? `${STUDENT_FILE_URL}/file/${att.fileId}`
    : isValidMongoId
      ? `${ADMIN_FILE_URL}/file/${rawId}/preview`
      : null;

  useEffect(() => {
    if (!mime.startsWith("image/") || !previewUrl) return;
    let alive = true;
    (async () => {
      try {
        const res = await axios.get(previewUrl, {
          headers: { Authorization: `Bearer ${token}` },
          responseType: "blob",
        });
        if (alive) setImgSrc(URL.createObjectURL(res.data));
      } catch (_) {}
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawId, att.fileId]);

  useEffect(
    () => () => {
      if (imgSrc) URL.revokeObjectURL(imgSrc);
    },
    [imgSrc],
  );

  const handleDownload = async (e) => {
    e.stopPropagation();
    if (busy) return;
    if (!downloadUrl) {
      alert("File not available yet.");
      return;
    }
    setBusy(true);
    try {
      const res = await axios.get(downloadUrl, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: "blob",
      });
      const url = URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", name);
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      alert("Download failed.");
    } finally {
      setBusy(false);
    }
  };

  if (mime.startsWith("image/")) {
    return (
      <>
        {lightbox && imgSrc && (
          <Lightbox
            src={imgSrc}
            name={name}
            onClose={() => setLightbox(false)}
          />
        )}
        <div
          onClick={() => imgSrc && setLightbox(true)}
          style={{
            marginTop: 6,
            borderRadius: 8,
            overflow: "hidden",
            maxWidth: 230,
            cursor: imgSrc ? "pointer" : "default",
          }}
        >
          {imgSrc ? (
            <img
              src={imgSrc}
              alt={name}
              style={{
                width: "100%",
                display: "block",
                borderRadius: "8px 8px 0 0",
              }}
            />
          ) : (
            <div
              style={{
                width: 230,
                height: 130,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Loader2
                style={{ width: 20, height: 20 }}
                className="animate-spin"
              />
            </div>
          )}
          <div
            style={{
              background: "rgba(0,0,0,0.45)",
              padding: "3px 8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 6,
            }}
          >
            <span
              style={{
                fontSize: "0.62rem",
                color: "rgba(255,255,255,0.85)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                flex: 1,
              }}
            >
              {name}
            </span>
            <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
              {imgSrc && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setLightbox(true);
                  }}
                  style={{
                    background: "rgba(255,255,255,0.2)",
                    border: "none",
                    borderRadius: 5,
                    padding: "2px 6px",
                    color: "#fff",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 3,
                    fontSize: "0.62rem",
                  }}
                >
                  <Eye style={{ width: 9, height: 9 }} /> View
                </button>
              )}
              <button
                onClick={handleDownload}
                style={{
                  background: "rgba(255,255,255,0.2)",
                  border: "none",
                  borderRadius: 5,
                  padding: "2px 6px",
                  color: "#fff",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 3,
                  fontSize: "0.62rem",
                }}
              >
                {busy ? (
                  <Loader2
                    style={{ width: 9, height: 9 }}
                    className="animate-spin"
                  />
                ) : (
                  <Download style={{ width: 9, height: 9 }} />
                )}
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <div
      style={{
        marginTop: 6,
        display: "flex",
        alignItems: "center",
        gap: 8,
        background: "rgba(255,255,255,0.18)",
        borderRadius: 10,
        padding: "8px 10px",
        maxWidth: 260,
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 8,
          background: "rgba(255,255,255,0.25)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <FileIcon mime={mime} size={18} />
      </div>
      <div style={{ flex: 1, overflow: "hidden", minWidth: 0 }}>
        <p
          style={{
            fontSize: "0.72rem",
            fontWeight: 600,
            margin: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {name}
        </p>
        <p style={{ fontSize: "0.62rem", opacity: 0.75, margin: "2px 0 0" }}>
          {(mime.split("/")[1] || "file").toUpperCase()} · {fmtSize(size)}
        </p>
      </div>
      <button
        onClick={handleDownload}
        disabled={busy}
        style={{
          background: "rgba(255,255,255,0.25)",
          border: "none",
          borderRadius: 8,
          padding: "6px 9px",
          color: "#fff",
          cursor: busy ? "not-allowed" : "pointer",
          display: "flex",
          alignItems: "center",
          gap: 4,
          flexShrink: 0,
        }}
      >
        {busy ? (
          <Loader2 style={{ width: 12, height: 12 }} className="animate-spin" />
        ) : (
          <Download style={{ width: 12, height: 12 }} />
        )}
      </button>
    </div>
  );
};

const StagedAttachments = ({ attachments, onRemove }) => {
  if (!attachments.length) return null;
  return (
    <div
      style={{
        padding: "8px 12px",
        background: "#f9fafb",
        borderTop: "1px solid #e5e7eb",
        display: "flex",
        flexWrap: "wrap",
        gap: 8,
      }}
    >
      {attachments.map((att) => (
        <div
          key={att.id}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 10,
            padding: "5px 8px",
            fontSize: "0.7rem",
            maxWidth: 200,
          }}
        >
          {att.preview ? (
            <img
              src={att.preview}
              alt={att.name}
              style={{
                width: 28,
                height: 28,
                objectFit: "cover",
                borderRadius: 5,
                flexShrink: 0,
              }}
            />
          ) : (
            <div
              style={{
                width: 28,
                height: 28,
                background: "#eef2ff",
                borderRadius: 5,
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <FileIcon mime={att.type} size={14} />
            </div>
          )}
          <div style={{ overflow: "hidden", flex: 1, minWidth: 0 }}>
            <p
              style={{
                margin: 0,
                fontWeight: 600,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                maxWidth: 100,
              }}
            >
              {att.name}
            </p>
            <p style={{ margin: 0, color: "#9ca3af", fontSize: "0.62rem" }}>
              {fmtSize(att.size)}
            </p>
          </div>
          <button
            onClick={() => onRemove(att.id)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#ef4444",
              padding: 0,
              lineHeight: 1,
              flexShrink: 0,
            }}
          >
            <XCircle style={{ width: 14, height: 14 }} />
          </button>
        </div>
      ))}
    </div>
  );
};

const ChatBubble = ({ msg, selectedTicket, onReply, onDelete, token }) => {
  const isAdmin = msg.senderRole === "admin";
  const isSchool = msg.senderRole === "school-admin";
  const isPartner = msg.senderRole === "partner";

  const bubble = isAdmin
    ? {
        background: G_INDIGO,
        borderRadius: "14px 14px 3px 14px",
        boxShadow: "0 3px 10px rgba(99,102,241,0.38)",
      }
    : {
        background: G_GREEN,
        borderRadius: "14px 14px 14px 3px",
        boxShadow: "0 3px 10px rgba(5,150,105,0.30)",
      };

  const avatarBg = isAdmin
    ? G_INDIGO
    : isPartner
      ? "linear-gradient(135deg,#7c3aed,#6d28d9)"
      : G_GREEN;
  const nameColor = isAdmin
    ? "text-indigo-500"
    : isPartner
      ? "text-violet-600"
      : "text-emerald-600";
  const nameLabel = isAdmin
    ? msg.senderName || "Support Admin"
    : isPartner
      ? msg.senderName || "Partner"
      : isSchool
        ? msg.senderName || "School Admin"
        : msg.senderName || selectedTicket?.studentName || "Student";

  return (
    <div
      className={`flex flex-col ${isAdmin ? "items-end" : "items-start"} mb-3 group`}
    >
      <div
        className={`flex items-center gap-1 mb-0.5 px-1 ${isAdmin ? "flex-row-reverse" : "flex-row"}`}
      >
        <div
          className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm"
          style={{ background: avatarBg }}
        >
          {isAdmin ? (
            <UserCheck style={{ width: 10, height: 10, color: "#fff" }} />
          ) : isPartner ? (
            <ExternalLink style={{ width: 10, height: 10, color: "#fff" }} />
          ) : isSchool ? (
            <School style={{ width: 10, height: 10, color: "#fff" }} />
          ) : (
            <GraduationCap style={{ width: 10, height: 10, color: "#fff" }} />
          )}
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          <span
            className={`font-semibold ${nameColor}`}
            style={{ fontSize: "0.66rem" }}
          >
            {nameLabel}
          </span>
          {isPartner && (
            <span
              style={{
                fontSize: "0.58rem",
                fontWeight: 700,
                color: "#fff",
                background: "linear-gradient(135deg,#7c3aed,#6d28d9)",
                borderRadius: 20,
                padding: "1px 6px",
              }}
            >
              Partner
            </span>
          )}
        </div>
      </div>
      <div
        className={`relative max-w-[70%] ${msg.isSending ? "opacity-60" : ""}`}
        style={{ alignSelf: isAdmin ? "flex-end" : "flex-start" }}
      >
        <div style={{ ...bubble, padding: "7px 11px", color: "#fff" }}>
          {!!msg.text && (
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
          {msg.attachments?.length > 0 && (
            <div style={{ marginTop: msg.text ? 6 : 0 }}>
              {msg.attachments.map((att, i) => (
                <AttachmentItem key={attId(att) || i} att={att} token={token} />
              ))}
            </div>
          )}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              marginTop: 4,
              gap: 3,
            }}
          >
            <span
              style={{ fontSize: "0.60rem", color: "rgba(255,255,255,0.72)" }}
            >
              {timeAgo(msg.createdAt)}
            </span>
            {isAdmin && (
              <CheckCheck
                style={{
                  width: 10,
                  height: 10,
                  color: "rgba(255,255,255,0.72)",
                }}
              />
            )}
          </div>
        </div>
        {isAdmin && !msg.isSending && (
          <div className="absolute -bottom-6 right-0 hidden group-hover:flex items-center gap-0.5 bg-white rounded-lg shadow-lg border border-gray-100 p-0.5 z-10">
            <button
              onClick={() => onReply(msg)}
              className="p-1 text-gray-500 hover:text-indigo-600 rounded"
            >
              <Reply className="w-3 h-3" />
            </button>
            <button
              onClick={() => onDelete(msg._id)}
              className="p-1 text-gray-500 hover:text-red-600 rounded"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── StatCards ────────────────────────────────────────────────────────────────
const StatCards = ({ items }) => (
  <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-5">
    {items.map(({ label, value, icon, color }) => (
      <div
        key={label}
        className="bg-white rounded-xl border border-gray-200 hover:shadow-sm transition-shadow"
        style={{ padding: "12px" }}
      >
        <div className="flex items-center justify-between">
          <div>
            <p
              style={{
                fontSize: "0.72rem",
                color: "#9ca3af",
                margin: 0,
                lineHeight: 1.3,
              }}
            >
              {label}
            </p>
            <p
              style={{
                fontSize: "1.2rem",
                fontWeight: 700,
                margin: "2px 0 0",
                color: color || "#6366f1",
                lineHeight: 1.2,
              }}
            >
              {value ?? 0}
            </p>
          </div>
          <div
            style={{
              padding: "7px",
              borderRadius: 8,
              background: color ? `${color}18` : "#eef2ff",
              color: color || "#6366f1",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {icon}
          </div>
        </div>
      </div>
    ))}
  </div>
);

// ─── Shared state hook ────────────────────────────────────────────────────────
const usePanel = () => {
  const [tickets, setTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [messages, setMessages] = useState({});
  const [messageInput, setMessageInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [staged, setStaged] = useState([]);
  const [replyingTo, setReplyingTo] = useState(null);
  const [socketConn, setSocketConn] = useState(false);
  const [delTarget, setDelTarget] = useState(null);
  const [delLoading, setDelLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [fStatus, setFStatus] = useState("all");
  const [fPriority, setFPriority] = useState("all");
  const [fCategory, setFCategory] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [showFilters, setShowFilters] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    open: 0,
    inProgress: 0,
    resolved: 0,
    urgent: 0,
    unreadMessages: 0,
    autoEscalated: 0,
  });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [ticketDetail, setTicketDetail] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [activeTab, setActiveTab] = useState("all");
  const [escalateTarget, setEscalateTarget] = useState(null);
  const [escalateLoading, setEscalateLoading] = useState(false);
  const [ticketToDelete, setTicketToDelete] = useState(null);
  const [deletingTicket, setDeletingTicket] = useState(false);
  const [escalationToasts, setEscalationToasts] = useState([]);
  const [showEscalationSuccess, setShowEscalationSuccess] = useState(false);
  const [isListening, setIsListening] = useState(false);

  const recognitionRef = useRef(null);
  const endRef = useRef(null);
  const socketRef = useRef(null);
  const selRef = useRef(null);
  const ticketsRef = useRef([]);
  const loadStatsRef = useRef(null);
  const markReadRef = useRef(null);
  const loadTicketsRef = useRef(null);

  useEffect(() => {
    selRef.current = selectedTicket;
  }, [selectedTicket]);
  useEffect(() => {
    ticketsRef.current = tickets;
  }, [tickets]);

  const getToken = () => localStorage.getItem("adminToken");
  const scrollEnd = useCallback(() => {
    setTimeout(() => {
      endRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 50);
  }, []);

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

    let baseText = messageInput.trim();

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
        setMessageInput(baseText + (interimStr ? " " + interimStr : ""));
      } else {
        setMessageInput(baseText + (baseText ? " " : "") + interimStr);
      }
    };

    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [isListening, messageInput]);

  const pickFiles = (e) => {
    const files = Array.from(e.target.files);
    if (staged.length + files.length > 5) {
      alert("Max 5 files per message");
      return;
    }
    setStaged((prev) => [
      ...prev,
      ...files.map((f) => ({
        id: `s-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        name: f.name,
        size: f.size,
        type: f.type,
        file: f,
        preview: isImg(f.type) ? URL.createObjectURL(f) : null,
      })),
    ]);
    e.target.value = "";
  };

  const removeStaged = (id) => {
    setStaged((prev) => {
      const att = prev.find((a) => a.id === id);
      if (att?.preview) URL.revokeObjectURL(att.preview);
      return prev.filter((a) => a.id !== id);
    });
  };

  return {
    tickets,
    setTickets,
    selectedTicket,
    setSelectedTicket,
    messages,
    setMessages,
    messageInput,
    setMessageInput,
    loading,
    setLoading,
    sending,
    setSending,
    staged,
    setStaged,
    replyingTo,
    setReplyingTo,
    socketConn,
    setSocketConn,
    delTarget,
    setDelTarget,
    delLoading,
    setDelLoading,
    search,
    setSearch,
    fStatus,
    setFStatus,
    fPriority,
    setFPriority,
    fCategory,
    setFCategory,
    sortBy,
    setSortBy,
    showFilters,
    setShowFilters,
    stats,
    setStats,
    page,
    setPage,
    totalPages,
    setTotalPages,
    ticketDetail,
    setTicketDetail,
    showDetail,
    setShowDetail,
    apiError,
    setApiError,
    activeTab,
    setActiveTab,
    escalateTarget,
    setEscalateTarget,
    escalateLoading,
    setEscalateLoading,
    ticketToDelete,
    setTicketToDelete,
    deletingTicket,
    setDeletingTicket,
    escalationToasts,
    addEscalationToast,
    dismissToast,
    showEscalationSuccess,
    setShowEscalationSuccess,
    endRef,
    socketRef,
    selRef,
    ticketsRef,
    loadStatsRef,
    markReadRef,
    loadTicketsRef,
    getToken,
    scrollEnd,
    pickFiles,
    removeStaged,
    isListening,
    toggleListening,
  };
};

// ─── Shared send-message logic ────────────────────────────────────────────────
const makeSender = (p, API_URL) => async () => {
  if (
    (!p.messageInput.trim() && !p.staged.length) ||
    !p.selectedTicket ||
    p.sending
  )
    return;
  p.setSending(true);

  const tempId = `tmp-${Date.now()}`;
  const text = p.messageInput;
  const snapFiles = [...p.staged];
  const currentTicket = p.selRef.current || p.selectedTicket;

  p.setMessages((prev) => ({
    ...prev,
    [currentTicket._id]: dedupe([
      ...(prev[currentTicket._id] || []),
      {
        _id: tempId,
        text,
        senderName: "Support Admin",
        senderRole: "admin",
        createdAt: new Date().toISOString(),
        read: true,
        isSending: true,
        attachments: snapFiles.map((f) => ({
          _id: f.id,
          filename: f.name,
          mimetype: f.type,
          size: f.size,
        })),
      },
    ]),
  }));
  p.setMessageInput("");
  p.setStaged([]);
  p.setReplyingTo(null);

  try {
    const token = p.getToken();
    const form = new FormData();
    form.append("text", text);
    if (p.replyingTo) form.append("replyTo", p.replyingTo._id || "");
    snapFiles.forEach((f) => {
      if (f.file) form.append("files", f.file);
    });

    const res = await axios.post(
      `${API_URL}/message/${currentTicket._id}`,
      form,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      },
    );

    p.setMessages((prev) => ({
      ...prev,
      [currentTicket._id]: dedupe(
        (prev[currentTicket._id] || []).map((m) =>
          m._id === tempId ? res.data.message : m,
        ),
      ),
    }));
    p.setTickets((prev) => {
      const updated = prev.map((t) =>
        t._id === currentTicket._id
          ? {
              ...t,
              lastMessage: text || (snapFiles[0]?.name ?? ""),
              lastMessageTime: res.data.message.createdAt,
              lastMessageSender: "admin",
              autoEscalated: false,
            }
          : t,
      );
      const idx = updated.findIndex((t) => t._id === currentTicket._id);
      if (idx > 0) {
        const [ticket] = updated.splice(idx, 1);
        updated.unshift(ticket);
      }
      return updated;
    });
    if (p.selRef.current?._id === currentTicket._id) {
      p.setSelectedTicket((q) =>
        q
          ? {
              ...q,
              lastMessage: text || (snapFiles[0]?.name ?? ""),
              lastMessageTime: res.data.message.createdAt,
              lastMessageSender: "admin",
              autoEscalated: false,
            }
          : q,
      );
    }
    p.scrollEnd();
  } catch (err) {
    console.error(err);
    p.setMessages((prev) => ({
      ...prev,
      [currentTicket._id]: (prev[currentTicket._id] || []).filter(
        (m) => m._id !== tempId,
      ),
    }));
    alert("Failed to send. Please try again.");
  } finally {
    p.setSending(false);
  }
};

const addMessage = (setMessages, ticketId, message) => {
  setMessages((prev) => {
    const existing = prev[ticketId] || [];
    if (existing.some((m) => m._id === message._id)) return prev;
    return { ...prev, [ticketId]: dedupe([...existing, message]) };
  });
};

// ─── FIX: makeTicketDeleter now accepts the correct API_URL per panel ─────────
const makeTicketDeleter = (p, API_URL) => async () => {
  if (!p.ticketToDelete) return;
  p.setDeletingTicket(true);
  try {
    const token = p.getToken();
    if (!token) {
      alert("Please login again.");
      return;
    }
    await axios.delete(`${API_URL}/ticket/${p.ticketToDelete._id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    p.setTickets((prev) => prev.filter((t) => t._id !== p.ticketToDelete._id));
    p.setMessages((prev) => {
      const copy = { ...prev };
      delete copy[p.ticketToDelete._id];
      return copy;
    });
    if (p.selRef.current?._id === p.ticketToDelete._id)
      p.setSelectedTicket(null);
    p.loadStatsRef.current?.();
    p.setTicketToDelete(null);
  } catch (err) {
    alert(
      "Failed to delete ticket: " +
        (err?.response?.data?.message || err?.message || "Unknown error"),
    );
  } finally {
    p.setDeletingTicket(false);
  }
};

// ─── NEEDS REPLY MODE ────────────────────────────────────────────────────────
const useNeedsReplyMode = () => {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);
  return now;
};

// ─────────────────────────────────────────────────────────────────────────────
// STUDENT TICKETS PANEL
// ─────────────────────────────────────────────────────────────────────────────
const StudentTicketsPanel = () => {
  const API_URL = STUDENT_API_URL;
  const p = usePanel();
  const send = makeSender(p, API_URL);
  const deleteTicket = makeTicketDeleter(p, API_URL);

  useEffect(() => {
    requestNotificationPermission();
  }, []);

  const needsReplyNow = useNeedsReplyMode();
  const isNeedsReply = useCallback(
    (ticket) =>
      isNeedsReplyTicket(ticket, NEEDS_REPLY_ROLES.student, needsReplyNow),
    [needsReplyNow],
  );

  const statusColor = (s) => {
    switch (s?.toLowerCase()) {
      case "open":
        return "bg-green-100 text-green-800 border-green-200";
      case "in-progress":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "resolved":
        return "bg-purple-100 text-purple-800 border-purple-200";
      case "closed":
        return "bg-gray-100 text-gray-800 border-gray-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const catIcon = (cat) => {
    switch (cat?.toLowerCase()) {
      case "technical issue":
        return <Bug className="w-3 h-3 text-blue-500" />;
      case "billing & payments":
        return <CreditCard className="w-3 h-3 text-green-500" />;
      case "internship access":
        return <Briefcase className="w-3 h-3 text-purple-500" />;
      case "account issue":
        return <Lock className="w-3 h-3 text-orange-500" />;
      case "student management":
        return <Users className="w-3 h-3 text-indigo-500" />;
      case "general inquiry":
        return <HelpCircle className="w-3 h-3 text-gray-500" />;
      default:
        return <AlertTriangle className="w-3 h-3 text-gray-500" />;
    }
  };

  const loadTickets = useCallback(async () => {
    try {
      const token = p.getToken();
      if (!token) {
        p.setApiError("No auth token");
        return;
      }
      const qs = new URLSearchParams({
        page: p.page,
        limit: 20,
        adminView: "true",
        sort: p.sortBy,
        search: p.search,
        status: p.fStatus !== "all" ? p.fStatus : "",
        priority: p.fPriority !== "all" ? p.fPriority : "",
        category: p.fCategory !== "all" ? p.fCategory : "",
      });
      const res = await axios.get(`${API_URL}/tickets?${qs}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      p.setTickets(res.data.tickets || []);
      p.setTotalPages(res.data.totalPages || 1);
      p.setApiError(null);
      p.loadStatsRef.current?.();
    } catch (err) {
      p.setApiError(
        err.response?.status === 401
          ? "Unauthorized"
          : "Failed to load tickets.",
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.page, p.fStatus, p.fPriority, p.fCategory, p.sortBy, p.search]);

  useEffect(() => {
    p.loadTicketsRef.current = loadTickets;
  }, [loadTickets]); // eslint-disable-line
  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  const loadStats = useCallback(async () => {
    try {
      const token = p.getToken();
      if (!token) return;
      const res = await axios.get(`${API_URL}/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      p.setStats(res.data.stats || {});
    } catch (_) {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [API_URL]);

  useEffect(() => {
    p.loadStatsRef.current = loadStats;
  }, [loadStats]); // eslint-disable-line

  const loadMessages = useCallback(
    async (ticketId, showSpinner = true) => {
      try {
        const token = p.getToken();
        if (!token) return [];
        if (showSpinner) p.setLoading(true);
        const res = await axios.get(`${API_URL}/messages/${ticketId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const msgs = dedupe(res.data.messages || []);
        p.setMessages((prev) => ({ ...prev, [ticketId]: msgs }));
        return msgs;
      } catch (err) {
        console.error(err);
        return [];
      } finally {
        if (showSpinner) p.setLoading(false);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [API_URL],
  );

  const markRead = useCallback(
    async (ticketId) => {
      try {
        const token = p.getToken();
        if (!token) return;
        p.setTickets((q) =>
          q.map((t) =>
            t._id === ticketId ? { ...t, unread: false, unreadCount: 0 } : t,
          ),
        );
        if (p.selRef.current?._id === ticketId)
          p.setSelectedTicket((q) =>
            q ? { ...q, unread: false, unreadCount: 0 } : q,
          );
        await axios.post(
          `${API_URL}/mark-read/${ticketId}`,
          {},
          { headers: { Authorization: `Bearer ${token}` } },
        );
        p.loadStatsRef.current?.();
      } catch (err) {
        console.error(err);
        p.loadTicketsRef.current?.();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [API_URL],
  );

  useEffect(() => {
    p.markReadRef.current = markRead;
  }, [markRead]); // eslint-disable-line

  useEffect(() => {
    const token = p.getToken();
    if (!token) return;
    const s = io(SOCKET_URL, {
      auth: { token, role: "admin" },
      transports: ["polling", "websocket"],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });
    p.socketRef.current = s;

    s.on("connect", () => {
      p.setSocketConn(true);
      s.emit("join_admin_room");
      p.loadStatsRef.current?.();
      p.loadTicketsRef.current?.();
    });
    s.on("connect_error", () => p.setSocketConn(false));
    s.on("disconnect", () => p.setSocketConn(false));

    s.on("new_message", ({ ticketId, message }) => {
      if (!ticketId || !message) return;
      if (!p.ticketsRef.current.some((t) => t._id === ticketId)) return;
      const isSel = p.selRef.current?._id === ticketId;
      addMessage(p.setMessages, ticketId, message);
      if (isSel) {
        p.setSelectedTicket((q) =>
          q
            ? {
                ...q,
                lastMessage: message.text || q.lastMessage,
                lastMessageTime: message.createdAt,
                lastMessageSender: message.senderRole,
              }
            : q,
        );
      }
      if (message.senderRole === "user") {
        if (isSel) {
          p.setTickets((q) =>
            q.map((t) =>
              t._id === ticketId
                ? {
                    ...t,
                    lastMessage: message.text || t.lastMessage,
                    lastMessageTime: message.createdAt,
                    lastMessageSender: message.senderRole,
                    unread: false,
                    unreadCount: 0,
                  }
                : t,
            ),
          );
          p.markReadRef.current?.(ticketId);
        } else {
          const ticket = p.ticketsRef.current.find((t) => t._id === ticketId);
          if (ticket)
            sendDesktopNotification(
              `💬 New message from ${ticket.studentName || "Student"}`,
              message.text?.substring(0, 80) || "New attachment",
              `msg-${ticketId}`,
            );
          p.setTickets((q) => {
            const updated = q.map((t) =>
              t._id === ticketId
                ? {
                    ...t,
                    lastMessage: message.text,
                    lastMessageTime: message.createdAt,
                    lastMessageSender: message.senderRole,
                    unread: true,
                    unreadCount: (t.unreadCount || 0) + 1,
                  }
                : t,
            );
            const idx = updated.findIndex((t) => t._id === ticketId);
            if (idx > 0) {
              const [ticket] = updated.splice(idx, 1);
              updated.unshift(ticket);
            }
            return updated;
          });
          p.loadStatsRef.current?.();
        }
      } else {
        p.setTickets((q) =>
          q.map((t) =>
            t._id === ticketId
              ? {
                  ...t,
                  lastMessage: message.text || t.lastMessage,
                  lastMessageTime: message.createdAt,
                  lastMessageSender: message.senderRole,
                }
              : t,
          ),
        );
      }
      if (isSel) p.scrollEnd();
    });

    s.on("ticket_auto_escalated", (data) => {
      const {
        ticketId,
        studentName,
        subject,
        hoursWaiting,
        escalationCount,
        message,
      } = data;
      if (!ticketId) return;
      p.addEscalationToast({
        ticketId,
        studentName,
        subject,
        hoursWaiting,
        escalationCount,
      });
      p.setTickets((q) => {
        if (!q.some((t) => t._id === ticketId)) return q;
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
      if (p.selRef.current?._id === ticketId)
        p.setSelectedTicket((q) =>
          q
            ? {
                ...q,
                autoEscalated: true,
                autoEscalatedAt: new Date().toISOString(),
              }
            : q,
        );
      if (message) addMessage(p.setMessages, ticketId, message);
      p.loadStatsRef.current?.();
      sendDesktopNotification(
        `⚠️ Ticket needs response — ${studentName}`,
        `Needs reply • ${subject}`,
        `escalate-${ticketId}`,
      );
    });

    s.on("ticket_escalation_resolved", ({ ticketId }) => {
      if (!ticketId) return;
      p.setTickets((q) =>
        q.map((t) => (t._id === ticketId ? { ...t, autoEscalated: false } : t)),
      );
      if (p.selRef.current?._id === ticketId)
        p.setSelectedTicket((q) => (q ? { ...q, autoEscalated: false } : q));
    });

    s.on("ticket_deleted", ({ ticketId }) => {
      if (!ticketId) return;
      p.setTickets((prev) => prev.filter((t) => t._id !== ticketId));
      p.setMessages((prev) => {
        const copy = { ...prev };
        delete copy[ticketId];
        return copy;
      });
      if (p.selRef.current?._id === ticketId) p.setSelectedTicket(null);
      p.loadStatsRef.current?.();
    });

    s.on("ticket_status_update", ({ ticketId, status, message }) => {
      if (!ticketId || !status) return;
      p.setTickets((q) =>
        q.map((t) =>
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
      if (p.selRef.current?._id === ticketId)
        p.setSelectedTicket((q) =>
          q
            ? {
                ...q,
                status,
                autoEscalated: ["resolved", "closed"].includes(status)
                  ? false
                  : q.autoEscalated,
              }
            : q,
        );
      if (message) addMessage(p.setMessages, ticketId, message);
      p.loadStatsRef.current?.();
    });

    s.on("ticket_assigned", ({ ticketId, assignedTo, message }) => {
      p.setTickets((q) =>
        q.map((t) => (t._id === ticketId ? { ...t, assignedTo } : t)),
      );
      if (p.selRef.current?._id === ticketId)
        p.setSelectedTicket((q) => (q ? { ...q, assignedTo } : q));
      if (message) addMessage(p.setMessages, ticketId, message);
    });

    s.on("messages_read", ({ ticketId }) => {
      p.setTickets((q) =>
        q.map((t) =>
          t._id === ticketId ? { ...t, unread: false, unreadCount: 0 } : t,
        ),
      );
      if (p.selRef.current?._id === ticketId)
        p.setSelectedTicket((q) =>
          q ? { ...q, unread: false, unreadCount: 0 } : q,
        );
      p.loadStatsRef.current?.();
    });

    s.on("new_ticket", ({ ticket }) => {
      if (!ticket || (ticket.isSchoolTicket && !ticket.escalated)) return;
      p.setTickets((q) =>
        q.some((t) => t._id === ticket._id) ? q : [ticket, ...q],
      );
      p.loadStatsRef.current?.();
      sendDesktopNotification(
        `🎫 New ticket from ${ticket.studentName || "Student"}`,
        ticket.subject || "New support ticket",
        `ticket-${ticket._id}`,
      );
    });

    s.on("ticket_escalated_to_partner", ({ originalTicketId }) => {
      p.setTickets((q) =>
        q.map((t) =>
          t._id === originalTicketId ? { ...t, escalatedToPartner: true } : t,
        ),
      );
      if (p.selRef.current?._id === originalTicketId)
        p.setSelectedTicket((q) =>
          q ? { ...q, escalatedToPartner: true } : q,
        );
    });

    s.on("message_deleted", ({ messageId, ticketId }) => {
      p.setMessages((prev) => ({
        ...prev,
        [ticketId]: (prev[ticketId] || []).filter((m) => m._id !== messageId),
      }));
    });

    return () => s.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (p.socketRef.current?.connected && p.selectedTicket)
      p.socketRef.current.emit("join_ticket", p.selectedTicket._id);
    return () => {
      if (p.selectedTicket && p.socketRef.current)
        p.socketRef.current.emit("leave_ticket", p.selectedTicket._id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.selectedTicket?._id]);

  useEffect(() => {
    if (p.socketConn) return;
    const id = setInterval(async () => {
      if (p.selRef.current) await loadMessages(p.selRef.current._id, false);
      p.loadTicketsRef.current?.();
      p.loadStatsRef.current?.();
    }, 5000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.socketConn]);

  useEffect(() => {
    if (p.selectedTicket && p.messages[p.selectedTicket._id]?.length)
      p.scrollEnd();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.messages[p.selectedTicket?._id]?.length]);

  const selectTicket = useCallback(
    async (t) => {
      p.setTickets((q) =>
        q.map((x) =>
          x._id === t._id ? { ...x, unread: false, unreadCount: 0 } : x,
        ),
      );
      p.setSelectedTicket(t);
      await loadMessages(t._id);
      await p.markReadRef.current?.(t._id);
      p.scrollEnd();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [loadMessages],
  );

  const updateStatus = async (ticketId, status) => {
    if (!ticketId || !status) return;
    try {
      const token = p.getToken();
      if (!token) return;
      const res = await axios.put(
        `${API_URL}/ticket/${ticketId}/status`,
        { status },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      p.setTickets((q) =>
        q.map((t) =>
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
      if (p.selRef.current?._id === ticketId)
        p.setSelectedTicket((q) =>
          q
            ? {
                ...q,
                status,
                autoEscalated: ["resolved", "closed"].includes(status)
                  ? false
                  : q.autoEscalated,
              }
            : q,
        );
      if (res.data.systemMessage)
        addMessage(p.setMessages, ticketId, res.data.systemMessage);
      p.loadStatsRef.current?.();
    } catch {
      alert("Failed to update status");
    }
  };

  const assignToMe = async (ticketId) => {
    try {
      const token = p.getToken();
      if (!token) return;
      const res = await axios.put(
        `${API_URL}/ticket/${ticketId}/assign`,
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      );
      p.setTickets((q) =>
        q.map((t) =>
          t._id === ticketId
            ? { ...t, assignedTo: res.data.ticket.assignedTo }
            : t,
        ),
      );
      if (p.selRef.current?._id === ticketId)
        p.setSelectedTicket((q) =>
          q ? { ...q, assignedTo: res.data.ticket.assignedTo } : q,
        );
      if (res.data.systemMessage)
        addMessage(p.setMessages, ticketId, res.data.systemMessage);
    } catch {
      alert("Failed to assign");
    }
  };

  const confirmDeleteMessage = async () => {
    if (!p.delTarget) return;
    p.setDelLoading(true);
    try {
      const token = p.getToken();
      if (!token) return;
      await axios.delete(`${API_URL}/message/${p.delTarget}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (p.selRef.current)
        p.setMessages((prev) => ({
          ...prev,
          [p.selRef.current._id]: (prev[p.selRef.current._id] || []).filter(
            (m) => m._id !== p.delTarget,
          ),
        }));
      p.setDelTarget(null);
    } catch {
      alert("Failed to delete");
    } finally {
      p.setDelLoading(false);
    }
  };

  const handleEscalateToPartner = async (reason) => {
    if (!p.escalateTarget) return;
    if (p.escalateTarget.escalatedToPartner) {
      alert("Already escalated.");
      p.setEscalateTarget(null);
      return;
    }
    p.setEscalateLoading(true);
    try {
      const token = p.getToken();
      if (!token) return;
      const res = await axios.post(
        `${API_URL}/ticket/${p.escalateTarget._id}/escalate-to-partner`,
        { reason },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      p.setTickets((q) =>
        q.map((t) =>
          t._id === p.escalateTarget._id
            ? { ...t, escalatedToPartner: true, autoEscalated: false }
            : t,
        ),
      );
      if (p.selRef.current?._id === p.escalateTarget._id)
        p.setSelectedTicket((q) =>
          q ? { ...q, escalatedToPartner: true, autoEscalated: false } : q,
        );
      if (res.data.systemMessage)
        addMessage(p.setMessages, p.escalateTarget._id, res.data.systemMessage);
      p.setEscalateTarget(null);
      p.setShowEscalationSuccess(true);
    } catch (err) {
      alert(
        `❌ Escalation failed: ${err.response?.data?.message || err.message}`,
      );
    } finally {
      p.setEscalateLoading(false);
    }
  };

  const token = p.getToken();

  const unreadCount = p.tickets.filter((t) => t.unread).length;
  const urgentCount = p.tickets.filter(
    (t) =>
      t.priority === "urgent" &&
      t.status !== "resolved" &&
      t.status !== "closed",
  ).length;
  const openCount = p.tickets.filter((t) => t.status === "open").length;
  const inProgressCount = p.tickets.filter(
    (t) => t.status === "in-progress",
  ).length;
  const resolvedCount = p.tickets.filter((t) => t.status === "resolved").length;
  const escalatedCount = p.tickets.filter(
    (t) =>
      t.escalatedToPartner && t.status !== "resolved" && t.status !== "closed",
  ).length;
  const autoEscCount = p.tickets.filter(isNeedsReply).length;
  const totalUnread = p.tickets.filter((t) => t.unread).length;

  const TABS = [
    { id: "all", label: "All", count: p.tickets.length },
    {
      id: "needs-reply",
      label: "Needs Reply",
      count: autoEscCount,
      isAmber: true,
    },
    { id: "unread", label: "Unread", count: totalUnread },
    { id: "urgent", label: "Urgent", count: urgentCount, isUrgent: true },
    { id: "open", label: "Open", count: openCount },
    { id: "in-progress", label: "In Progress", count: inProgressCount },
    { id: "escalated", label: "Escalated", count: escalatedCount },
    { id: "resolved", label: "Resolved", count: resolvedCount },
  ];

  const filtered = p.tickets.filter((t) => {
    if (p.activeTab === "all") return true;
    if (p.activeTab === "needs-reply") return isNeedsReply(t);
    if (p.activeTab === "unread") return t.unread;
    if (p.activeTab === "urgent")
      return (
        t.priority === "urgent" &&
        t.status !== "resolved" &&
        t.status !== "closed"
      );
    if (p.activeTab === "open") return t.status === "open";
    if (p.activeTab === "in-progress") return t.status === "in-progress";
    if (p.activeTab === "escalated") return !!t.escalatedToPartner;
    if (p.activeTab === "resolved")
      return t.status === "resolved" && !t.escalatedToPartner;
    return true;
  });

  const STAT_ITEMS = [
    {
      label: "Total",
      value: p.stats.total,
      icon: <Inbox className="w-4 h-4" />,
      color: "#6366f1",
    },
    {
      label: "Open",
      value: p.stats.open,
      icon: <Clock className="w-4 h-4" />,
      color: "#059669",
    },
    {
      label: "In Progress",
      value: p.stats.inProgress,
      icon: <Hourglass className="w-4 h-4" />,
      color: "#d97706",
    },
    {
      label: "Resolved",
      value: p.stats.resolved,
      icon: <CheckCircle className="w-4 h-4" />,
      color: "#7c3aed",
    },
    {
      label: "Urgent",
      value: p.stats.urgent,
      icon: <AlertCircle className="w-4 h-4" />,
      color: "#ef4444",
    },
    {
      label: "Needs Reply",
      value: autoEscCount,
      icon: <Timer className="w-4 h-4" />,
      color: "#3b82f6",
    },
  ];

  const isEscalatedInfo = !!p.selectedTicket?.escalatedToPartner;
  const isAutoEscalated = isNeedsReply(p.selectedTicket);

  const handleBellClick = () => {
    if (autoEscCount > 0) p.setActiveTab("needs-reply");
    else if (totalUnread > 0) p.setActiveTab("unread");
  };

  const renderTicket = (t) => {
    const isSel = p.selectedTicket?._id === t._id;
    const isAutoEsc = isNeedsReply(t);
    const hasUnread = t.unread && !isAutoEsc;
    const accentColor = isAutoEsc
      ? "#3b82f6"
      : hasUnread
        ? "#6366f1"
        : "transparent";
    const avatarBg = G_INDIGO;

    return (
      <div
        key={t._id}
        className="group relative"
        style={{
          borderLeft: `4px solid ${isSel ? accentColor : isAutoEsc ? "#3b82f6" : hasUnread ? "#6366f1" : "transparent"}`,
          background:
            isAutoEsc && !isSel
              ? "#ffffff"
              : hasUnread && !isSel
                ? "#eff6ff"
                : undefined,
          transition: "background 0.15s, border-color 0.15s",
        }}
        onClick={() => selectTicket(t)}
      >
        <div
          className={`p-3 cursor-pointer hover:bg-gray-50 transition-all ${isSel ? (isAutoEsc ? "bg-blue-50" : "bg-indigo-50") : ""}`}
        >
          <div className="flex items-start justify-between mb-1">
            <div className="flex items-center gap-2 min-w-0">
              <div
                className="relative w-8 h-8 rounded-full flex items-center justify-center font-bold text-white flex-shrink-0 shadow-sm"
                style={{ background: avatarBg, fontSize: "0.7rem" }}
              >
                {(t.studentName || "?").charAt(0).toUpperCase()}
                {(hasUnread || isAutoEsc) && (
                  <span
                    style={{
                      position: "absolute",
                      top: -2,
                      right: -2,
                      width: 10,
                      height: 10,
                      background: isAutoEsc ? "#3b82f6" : G_INDIGO,
                      borderRadius: "50%",
                      border: "2px solid #fff",
                      animation:
                        "stu-ping 1.5s cubic-bezier(0,0,0.2,1) infinite",
                    }}
                  />
                )}
              </div>
              <div className="min-w-0">
                <p
                  className={`font-semibold truncate ${hasUnread || isAutoEsc ? "text-gray-900" : "text-gray-700"}`}
                  style={{ fontSize: "0.8rem", margin: 0 }}
                >
                  {t.studentName || "Unknown"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0 ml-1">
              {hasUnread && (
                <span
                  style={{
                    color: "#fff",
                    fontWeight: 700,
                    minWidth: 18,
                    height: 18,
                    borderRadius: 999,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "0 3px",
                    background: G_INDIGO,
                    fontSize: "0.58rem",
                    boxShadow: "0 2px 6px rgba(8, 10, 153, 0.88)",
                  }}
                >
                  {t.unreadCount || 1}
                </span>
              )}
              <span className="text-gray-400" style={{ fontSize: "0.63rem" }}>
                {timeAgo(t.lastMessageTime || t.createdAt)}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  p.setTicketToDelete(t);
                }}
                className="opacity-0 group-hover:opacity-100 p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-all flex-shrink-0"
                title="Delete ticket"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>

          {t.category && (
            <p
              className="flex items-center gap-0.5 text-gray-400 mb-1"
              style={{ fontSize: "0.66rem" }}
            >
              {catIcon(t.category)}
              <span>{t.category}</span>
            </p>
          )}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              className={`px-1.5 py-0.5 rounded-full border ${priorityColor(t.priority)}`}
              style={{ fontSize: "0.63rem" }}
            >
              {t.priority || "Normal"}
            </span>
            <span
              className={`px-1.5 py-0.5 rounded-full border ${statusColor(t.status)}`}
              style={{ fontSize: "0.63rem" }}
            >
              {t.status || "open"}
            </span>
            {isAutoEsc && (
              <span
                className="px-1.5 py-0.5 rounded-full border flex items-center gap-0.5 bg-blue-100 text-blue-800 border-blue-200"
                style={{ fontSize: "0.63rem" }}
              >
                <Timer style={{ width: 9, height: 9 }} />
                Needs Reply
              </span>
            )}
            {t.escalatedToPartner && (
              <span
                className="px-1.5 py-0.5 rounded-full border flex items-center gap-0.5 bg-violet-100 text-violet-800 border-violet-200"
                style={{ fontSize: "0.63rem" }}
              >
                <ExternalLink className="w-2.5 h-2.5" />
                Partner
              </span>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div>
      <style>{`
        @keyframes stu-ping {
          0%,100% { box-shadow: 0 0 0 0 rgba(99,102,241,0.5); }
          50%      { box-shadow: 0 0 0 4px rgba(99,102,241,0); }
        }
      `}</style>

      <EscalationToasts
        toasts={p.escalationToasts}
        onDismiss={p.dismissToast}
      />

      {p.delTarget && (
        <DeleteModal
          onConfirm={confirmDeleteMessage}
          onCancel={() => p.setDelTarget(null)}
          loading={p.delLoading}
        />
      )}
      {p.ticketToDelete && (
        <DeleteTicketModal
          ticket={p.ticketToDelete}
          onConfirm={deleteTicket}
          onCancel={() => {
            if (!p.deletingTicket) p.setTicketToDelete(null);
          }}
          loading={p.deletingTicket}
        />
      )}
      {p.escalateTarget && (
        <EscalateModal
          ticket={p.escalateTarget}
          onConfirm={handleEscalateToPartner}
          onCancel={() => p.setEscalateTarget(null)}
          loading={p.escalateLoading}
        />
      )}
      {p.showEscalationSuccess && (
        <EscalationSuccessModal
          onClose={() => p.setShowEscalationSuccess(false)}
        />
      )}

      <StatCards items={STAT_ITEMS} />
      {unreadCount > 0 && (
        <UnreadBanner
          count={unreadCount}
          onViewAll={() => p.setActiveTab("unread")}
        />
      )}
      <EscalationBanner
        count={autoEscCount}
        onViewAll={() => p.setActiveTab("needs-reply")}
      />

      {/* Search + Filter bar */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 mb-5">
        <div className="flex items-center gap-3 flex-wrap">
          <div
            className="relative flex-1 min-w-[180px] max-w-md"
            style={{
              height: 38,
              display: "flex",
              alignItems: "center",
              background: "#fff",
              border: "1.5px solid #d1d5db",
              borderRadius: 8,
              padding: "0 12px",
              gap: 8,
            }}
          >
            <Search
              style={{ color: "#9ca3af", width: 12, height: 12, flexShrink: 0 }}
            />
            {/*Add marginTop: "0px" for alignment - 06-08-2026 */}
            <input
              type="text"
              placeholder="Search student, subject…"
              value={p.search}
              onChange={(e) => p.setSearch(e.target.value)}
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
            {p.search && (
              <button
                onClick={() => p.setSearch("")}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                <X style={{ color: "#9ca3af", width: 10, height: 10 }} />
              </button>
            )}
          </div>
          <button
            onClick={() => p.setShowFilters(!p.showFilters)}
            style={{
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              gap: 5,
              height: 38,
              padding: "0 12px",
              border: "1.5px solid #d1d5db",
              borderRadius: 8,
              background: "#fff",
              color: "#374151",
              fontWeight: 600,
              fontSize: "0.78rem",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            <Filter style={{ width: 10, height: 10 }} />
            Filters
            <ChevronDown
              style={{
                width: 8,
                height: 8,
                transition: "transform 0.2s",
                transform: p.showFilters ? "rotate(180deg)" : "rotate(0deg)",
              }}
            />
          </button>
          <div style={{ position: "relative", flexShrink: 0 }}>
            <select
              value={p.sortBy}
              onChange={(e) => p.setSortBy(e.target.value)}
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
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="priority">Priority</option>
              <option value="status">Status</option>
            </select>
            <ChevronDown
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
          <NotificationBell
            unreadCount={totalUnread}
            needsReplyCount={autoEscCount}
            onClick={handleBellClick}
          />
        </div>
        {p.showFilters && (
          <div
            style={{
              overflow: "hidden",
              maxHeight: 200,
              opacity: 1,
              marginTop: 10,
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
              {[
                {
                  label: "Status",
                  v: p.fStatus,
                  set: p.setFStatus,
                  opts: STATUSES,
                },
                {
                  label: "Priority",
                  v: p.fPriority,
                  set: p.setFPriority,
                  opts: PRIS,
                },
                {
                  label: "Category",
                  v: p.fCategory,
                  set: p.setFCategory,
                  opts: CATS,
                },
              ].map(({ label, v, set, opts }) => (
                <div key={label}>
                  <label
                    style={{
                      display: "block",
                      fontSize: "0.62rem",
                      fontWeight: 700,
                      color: "#6b7280",
                      marginBottom: 4,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    {label}
                  </label>
                  <div style={{ position: "relative" }}>
                    <select
                      value={v}
                      onChange={(e) => set(e.target.value)}
                      style={{
                        width: "100%",
                        appearance: "none",
                        padding: "5px 22px 5px 8px",
                        border:
                          v !== "all"
                            ? "1.5px solid #6366f1"
                            : "1.5px solid #d1d5db",
                        borderRadius: 7,
                        background:
                          v !== "all" ? "rgba(99,102,241,0.06)" : "#fff",
                        color: v !== "all" ? "#6366f1" : "#374151",
                        fontWeight: v !== "all" ? 600 : 400,
                        fontSize: "0.76rem",
                        cursor: "pointer",
                        outline: "none",
                        fontFamily: "inherit",
                      }}
                    >
                      {opts.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
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
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* TICKET LIST */}
        <div className="lg:col-span-1">
          <div
            className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col"
            style={{ minHeight: 580 }}
          >
            <div
              className="px-3 pt-3 pb-2 border-b border-gray-100"
              style={{
                background: "linear-gradient(to right,#f5f3ff,#eef2ff)",
              }}
            >
              <h2
                className="font-bold text-gray-800 mb-2"
                style={{ fontSize: "0.88rem" }}
              >
                Student Tickets ({filtered.length}
                {filtered.length !== p.tickets.length
                  ? ` / ${p.tickets.length}`
                  : ""}
                )
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
                }}
              >
                {TABS.map(({ id, label, count, isAmber, isUrgent }) => {
                  const isActive = p.activeTab === id;
                  return (
                    <button
                      key={id}
                      onClick={() => p.setActiveTab(id)}
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
                          : isUrgent && count > 0
                            ? "#ef4444"
                            : "#64748b",
                        border: isActive ? "1px solid #e5e7eb" : "none",
                      }}
                    >
                      {isUrgent && (
                        <AlertCircle
                          style={{ width: 6, height: 6, flexShrink: 0 }}
                        />
                      )}
                      {isAmber && (
                        <Timer style={{ width: 6, height: 6, flexShrink: 0 }} />
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
                              ? "#3b82f6"
                              : isUrgent
                                ? "#ef4444"
                                : "#6366f1",
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
              {filtered.length === 0 ? (
                <div className="p-8 text-center">
                  <div className="w-12 h-12 mx-auto mb-3 bg-gray-100 rounded-full flex items-center justify-center">
                    {p.activeTab === "needs-reply" ? (
                      <Timer className="w-6 h-6 text-blue-400" />
                    ) : p.activeTab === "unread" ? (
                      <MessageSquare className="w-6 h-6 text-indigo-400" />
                    ) : (
                      <Headphones className="w-6 h-6 text-gray-400" />
                    )}
                  </div>
                  <p className="text-sm text-gray-500">
                    {p.activeTab === "needs-reply"
                      ? "No tickets waiting — great job! 🎉"
                      : p.activeTab === "unread"
                        ? "All messages read ✓"
                        : "No tickets found"}
                  </p>
                  {p.apiError && (
                    <p className="text-xs text-red-400 mt-1">{p.apiError}</p>
                  )}
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {filtered.map(renderTicket)}
                </div>
              )}
            </div>

            <Pagination
              currentPage={p.page}
              totalPages={p.totalPages}
              onPageChange={(pg) => p.setPage(pg)}
            />
          </div>
        </div>

        {/* CHAT AREA */}
        <div className="lg:col-span-2">
          {p.selectedTicket ? (
            <div
              className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden"
              style={{
                height: 660,
                borderColor: isAutoEscalated ? "#3b82f6" : undefined,
                borderWidth: isAutoEscalated ? 2 : undefined,
                boxShadow: isAutoEscalated
                  ? "0 0 0 3px rgba(59,130,246,0.1)"
                  : undefined,
              }}
            >
              {/* Chat header */}
              <div
                className="p-3 border-b border-gray-200"
                style={{
                  background: isAutoEscalated
                    ? "linear-gradient(135deg,#eff6ff,#dbeafe)"
                    : G_INDIGO,
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center shadow-sm flex-shrink-0"
                      style={{
                        background: isAutoEscalated
                          ? G_AMBER
                          : "rgba(255,255,255,0.2)",
                      }}
                    >
                      {isAutoEscalated ? (
                        <Timer
                          style={{ color: "#fff", width: 14, height: 14 }}
                        />
                      ) : (
                        <span
                          style={{
                            color: "#fff",
                            fontWeight: 700,
                            fontSize: "0.75rem",
                          }}
                        >
                          {(p.selectedTicket.studentName || "?")
                            .charAt(0)
                            .toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h3
                          style={{
                            fontSize: "0.82rem",
                            fontWeight: 700,
                            color: isAutoEscalated ? "#1e3a8a" : "#fff",
                            margin: 0,
                          }}
                          className="truncate"
                        >
                          {p.selectedTicket.subject ||
                            p.selectedTicket.category ||
                            "No subject"}
                        </h3>
                        {p.selectedTicket.priority === "urgent" && (
                          <span
                            className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-red-200 text-red-800 font-semibold flex-shrink-0"
                            style={{ fontSize: "0.58rem" }}
                          >
                            <AlertCircle className="w-2 h-2" />
                            Urgent
                          </span>
                        )}
                        {isAutoEscalated && (
                          <span
                            className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0"
                            style={{
                              fontSize: "0.58rem",
                              background: "rgba(59,130,246,0.15)",
                              color: "#1e3a8a",
                            }}
                          >
                            <Timer className="w-2 h-2" />
                            Needs Reply
                          </span>
                        )}
                        {isEscalatedInfo && !isAutoEscalated && (
                          <span
                            className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-white/20 text-white font-semibold flex-shrink-0"
                            style={{ fontSize: "0.58rem" }}
                          >
                            <ExternalLink className="w-2 h-2" />
                            Escalated
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 flex-wrap mt-0.5">
                        <span
                          style={{
                            color: isAutoEscalated
                              ? "#4b5563"
                              : "rgba(255,255,255,0.8)",
                            fontSize: "0.68rem",
                          }}
                        >
                          {p.selectedTicket.studentName || "Unknown"}
                        </span>
                        <span
                          style={{
                            color: isAutoEscalated
                              ? "#6b7280"
                              : "rgba(255,255,255,0.6)",
                            fontSize: "0.62rem",
                          }}
                        >
                          · #{p.selectedTicket._id?.slice(-6)}
                        </span>
                        {p.selectedTicket.internshipId && (
                          <span
                            style={{
                              color: isAutoEscalated
                                ? "#6b7280"
                                : "rgba(255,255,255,0.6)",
                              fontSize: "0.62rem",
                            }}
                          >
                            · ID: {p.selectedTicket.internshipId}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap">
                    <button
                      onClick={async () => {
                        try {
                          const r = await axios.get(
                            `${API_URL}/ticket/${p.selectedTicket._id}`,
                            { headers: { Authorization: `Bearer ${token}` } },
                          );
                          p.setTicketDetail(r.data.ticket);
                          p.setShowDetail(true);
                        } catch {}
                      }}
                      className="p-1.5 rounded-full transition-colors flex-shrink-0"
                      style={{
                        background: "rgba(255,255,255,0.15)",
                        color: isAutoEscalated ? "#374151" : "#fff",
                      }}
                    >
                      <Info className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => p.setTicketToDelete(p.selectedTicket)}
                      className="p-1.5 rounded-full transition-colors flex-shrink-0"
                      style={{
                        background: "rgba(255,255,255,0.15)",
                        color: isAutoEscalated ? "#374151" : "#fff",
                      }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    {!p.selectedTicket.assignedTo &&
                      p.selectedTicket.status !== "resolved" && (
                        <button
                          onClick={() => assignToMe(p.selectedTicket._id)}
                          className="flex items-center gap-1 px-2 py-1 border rounded-lg font-semibold"
                          style={{
                            fontSize: "0.7rem",
                            border: isAutoEscalated
                              ? "1px solid #3b82f6"
                              : "1px solid rgba(255,255,255,0.3)",
                            background: isAutoEscalated
                              ? "rgba(59,130,246,0.1)"
                              : "rgba(255,255,255,0.15)",
                            color: isAutoEscalated ? "#1d4ed8" : "#fff",
                          }}
                        >
                          <UserCheck className="w-2.5 h-2.5" />
                          Assign
                        </button>
                      )}
                    {p.selectedTicket.category === "Internship Access" &&
                      p.selectedTicket.status !== "resolved" && (
                        <button
                          onClick={() => p.setEscalateTarget(p.selectedTicket)}
                          disabled={p.selectedTicket.escalatedToPartner}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg font-semibold"
                          style={{
                            fontSize: "0.7rem",
                            background:
                              "linear-gradient(135deg,#7c3aed,#6d28d9)",
                            color: "#fff",
                            border: "none",
                            cursor: p.selectedTicket.escalatedToPartner
                              ? "not-allowed"
                              : "pointer",
                            opacity: p.selectedTicket.escalatedToPartner
                              ? 0.6
                              : 1,
                          }}
                        >
                          <ExternalLink className="w-2.5 h-2.5" />
                          {p.selectedTicket.escalatedToPartner
                            ? "Escalated"
                            : "Escalate"}
                        </button>
                      )}
                    <StatusDropdown
                      value={p.selectedTicket.status || "open"}
                      onChange={(val) => {
                        const tid =
                          p.selRef.current?._id || p.selectedTicket._id;
                        updateStatus(tid, val);
                      }}
                      isLight={isAutoEscalated}
                    />
                  </div>
                </div>

                {isAutoEscalated && (
                  <div
                    className="mt-2 p-2.5 rounded-xl flex items-start gap-2.5"
                    style={{
                      background: "linear-gradient(135deg,#dbeafe,#bfdbfe)",
                      border: "1px solid #3b82f6",
                    }}
                  >
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        background: G_AMBER,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <Timer style={{ color: "#fff", width: 14, height: 14 }} />
                    </div>
                    <div>
                      <p
                        style={{
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          color: "#1e3a8a",
                          margin: "0 0 2px",
                        }}
                      >
                        This ticket is marked as Needs Reply
                      </p>
                      <p
                        style={{
                          fontSize: "0.68rem",
                          color: "#1d4ed8",
                          margin: 0,
                        }}
                      >
                        First raised {timeAgo(p.selectedTicket.createdAt)} · Use
                        the Needs Reply tab to review it
                      </p>
                    </div>
                  </div>
                )}

                {isEscalatedInfo && !isAutoEscalated && (
                  <div
                    className="mt-2 p-2 rounded-lg flex items-start gap-2"
                    style={{
                      background: "rgba(255,255,255,0.1)",
                      fontSize: "0.72rem",
                    }}
                  >
                    <ExternalLink
                      style={{
                        width: 12,
                        height: 12,
                        color: "rgba(255,255,255,0.8)",
                        flexShrink: 0,
                        marginTop: 1,
                      }}
                    />
                    <span style={{ color: "rgba(255,255,255,0.9)" }}>
                      This ticket is escalated to a partner. Partner replies
                      appear here automatically.
                    </span>
                  </div>
                )}
              </div>

              {/* Messages */}
              <div
                className="flex-1 p-3 overflow-y-auto"
                style={{ background: "#f8f7ff" }}
              >
                {p.loading ? (
                  <div className="flex justify-center items-center h-full">
                    <Loader2
                      className="w-6 h-6 animate-spin"
                      style={{ color: "#6366f1" }}
                    />
                  </div>
                ) : (
                  <>
                    {!p.messages[p.selectedTicket._id]?.length && (
                      <div className="flex flex-col items-center justify-center h-full gap-3 opacity-60">
                        <MessageSquare className="w-10 h-10 text-gray-300" />
                        <p className="text-center text-gray-400 text-sm">
                          No messages yet. Start the conversation.
                        </p>
                      </div>
                    )}
                    {(p.messages[p.selectedTicket._id] || []).map((msg) => (
                      <div key={`msg-${msg._id}`}>
                        {msg.senderRole === "system" ? (
                          <div className="flex justify-center my-2">
                            <span
                              className={`px-3 py-1 rounded-full font-medium text-center max-w-[85%] ${
                                msg.autoEscalation
                                  ? "bg-blue-100 text-blue-800 border border-blue-300"
                                  : msg.text
                                        ?.toLowerCase()
                                        .includes(
                                          "escalated to the internship partner",
                                        )
                                    ? "bg-violet-100 text-violet-700 border border-violet-200"
                                    : "bg-gray-200 text-gray-600"
                              }`}
                              style={{ fontSize: "0.7rem" }}
                            >
                              {msg.text}
                            </span>
                          </div>
                        ) : (
                          <ChatBubble
                            msg={msg}
                            selectedTicket={p.selectedTicket}
                            onReply={p.setReplyingTo}
                            onDelete={p.setDelTarget}
                            token={token}
                          />
                        )}
                      </div>
                    ))}
                    <div ref={p.endRef} />
                  </>
                )}
              </div>

              {p.replyingTo && (
                <div
                  className="px-3 py-1.5 border-t flex items-center justify-between"
                  style={{ background: "#eef2ff", borderColor: "#c7d2fe" }}
                >
                  <div
                    className="flex items-center text-xs gap-1.5"
                    style={{ color: "#4338ca" }}
                  >
                    <Reply className="w-3 h-3" />
                    <span>
                      Replying: "
                      <span className="font-medium">
                        {p.replyingTo.text?.substring(0, 40)}…
                      </span>
                      "
                    </span>
                  </div>
                  <button
                    onClick={() => p.setReplyingTo(null)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              <StagedAttachments
                attachments={p.staged}
                onRemove={p.removeStaged}
              />

              {/* Input */}
              <div className="p-3 border-t border-gray-200 bg-white">
                <div className="flex items-center gap-2">
                  <label
                    className="p-1.5 rounded-full flex-shrink-0 cursor-pointer transition-colors"
                    style={{
                      background: "#f3f4f6",
                      color: isAutoEscalated ? "#2563eb" : "#6366f1",
                    }}
                  >
                    <Paperclip className="w-3.5 h-3.5" />
                    <input
                      type="file"
                      className="hidden"
                      multiple
                      accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.gif,.webp"
                      onChange={p.pickFiles}
                    />
                  </label>
                  <button
                    onClick={p.toggleListening}
                    title="Auto Type (Speech to Text)"
                    style={{
                      flexShrink: 0,
                      cursor: "pointer",
                      border: "none",
                      background: "transparent",
                      padding: 0,
                    }}
                  >
                    <div
                      className={`${p.isListening ? "sa-ping-red" : ""}`}
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: p.isListening ? "#fef2f2" : "#f3f4f6",
                        color: p.isListening
                          ? "#ef4444"
                          : isAutoEscalated
                            ? "#2563eb"
                            : "#6366f1",
                        transition: "all 0.15s",
                      }}
                    >
                      {p.isListening ? (
                        <MicOff style={{ width: 14, height: 14 }} />
                      ) : (
                        <Mic style={{ width: 14, height: 14 }} />
                      )}
                    </div>
                  </button>
                  <input
                    type="text"
                    placeholder={
                      p.isListening
                        ? "Listening..."
                        : isAutoEscalated
                          ? "Reply now — marked Needs Reply"
                          : isEscalatedInfo
                            ? "Reply to student…"
                            : "Reply… (Enter to send)"
                    }
                    className="flex-1 border border-gray-300 rounded-full px-3 py-2 outline-none"
                    style={{
                      fontSize: "0.8rem",
                      minWidth: 0,
                      borderColor: isAutoEscalated ? "#3b82f6" : undefined,
                      boxShadow: isAutoEscalated
                        ? "0 0 0 2px rgba(59,130,246,0.15)"
                        : undefined,
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = isAutoEscalated
                        ? "#2563eb"
                        : "#6366f1";
                      e.target.style.boxShadow = `0 0 0 3px rgba(${isAutoEscalated ? "37,99,235" : "99,102,241"},0.15)`;
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = isAutoEscalated
                        ? "#3b82f6"
                        : "#d1d5db";
                      e.target.style.boxShadow = isAutoEscalated
                        ? "0 0 0 2px rgba(59,130,246,0.15)"
                        : "none";
                    }}
                    value={p.messageInput}
                    onChange={(e) => p.setMessageInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        send();
                      }
                    }}
                    disabled={p.sending}
                  />
                  <button
                    onClick={send}
                    disabled={
                      (!p.messageInput.trim() && !p.staged.length) || p.sending
                    }
                    className="p-2 rounded-full transition-all flex-shrink-0"
                    style={
                      (p.messageInput.trim() || p.staged.length) && !p.sending
                        ? {
                            background: isAutoEscalated ? G_AMBER : G_INDIGO,
                            color: "#fff",
                            boxShadow: `0 3px 10px rgba(${isAutoEscalated ? "59,130,246" : "99,102,241"},0.4)`,
                          }
                        : {
                            background: "#e5e7eb",
                            color: "#9ca3af",
                            cursor: "not-allowed",
                          }
                    }
                  >
                    {p.sending ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-1 ml-10">
                  PDF · Word · TXT · Images — max 10 MB
                </p>
              </div>
            </div>
          ) : (
            <div
              className="bg-white rounded-xl shadow-sm border border-gray-200 flex items-center justify-center"
              style={{ height: 660 }}
            >
              <div className="text-center px-6">
                <div
                  className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
                  style={{
                    background: "linear-gradient(135deg,#eef2ff,#ede9fe)",
                  }}
                >
                  <Headphones
                    className="w-8 h-8"
                    style={{ color: "#6366f1" }}
                  />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-1">
                  Student Tickets
                </h3>
                <p className="text-gray-500 text-sm max-w-xs mx-auto">
                  Select a ticket to view and respond.
                </p>
                <div className="flex flex-col gap-2 mt-4">
                  {autoEscCount > 0 && (
                    <button
                      onClick={() => p.setActiveTab("needs-reply")}
                      className="px-4 py-2 rounded-xl text-white text-sm font-semibold"
                      style={{
                        background: G_AMBER,
                        boxShadow: "0 4px 14px rgba(59,130,246,0.4)",
                      }}
                    >
                      ⚠️ {autoEscCount} ticket{autoEscCount > 1 ? "s" : ""} need
                      {autoEscCount === 1 ? "s" : ""} your reply
                    </button>
                  )}
                  {totalUnread > 0 && (
                    <button
                      onClick={() => p.setActiveTab("unread")}
                      className="px-4 py-2 rounded-xl text-white text-sm font-semibold"
                      style={{
                        background: G_INDIGO,
                        boxShadow: "0 4px 14px rgba(99,102,241,0.4)",
                      }}
                    >
                      💬 {totalUnread} unread message
                      {totalUnread > 1 ? "s" : ""}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Ticket detail modal */}
      {p.showDetail && p.ticketDetail && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">
                Ticket Details
              </h2>
              <button
                onClick={() => p.setShowDetail(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-500">
                  Student
                </label>
                <p className="text-sm font-medium text-gray-900">
                  {p.ticketDetail.studentName}
                </p>
                <p className="text-xs text-gray-500">
                  {p.ticketDetail.studentEmail}
                </p>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500">
                  School
                </label>
                <p className="text-sm text-gray-900">
                  {p.ticketDetail.school || "Not specified"}
                </p>
              </div>
              {p.ticketDetail.autoEscalated && (
                <div
                  className="rounded-xl p-3"
                  style={{ background: "#dbeafe", border: "1px solid #3b82f6" }}
                >
                  <label
                    className="text-xs font-medium flex items-center gap-1"
                    style={{ color: "#1e40af" }}
                  >
                    <Timer className="w-3 h-3" />
                    Auto-Escalation
                  </label>
                  <p className="text-sm mt-1" style={{ color: "#1e3a8a" }}>
                    Marked as Needs Reply
                  </p>
                  {p.ticketDetail.autoEscalatedAt && (
                    <p className="text-xs mt-0.5" style={{ color: "#1d4ed8" }}>
                      Last marked:{" "}
                      {new Date(
                        p.ticketDetail.autoEscalatedAt,
                      ).toLocaleString()}
                    </p>
                  )}
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-500">
                    Category
                  </label>
                  <p className="text-sm text-gray-900">
                    {p.ticketDetail.category}
                  </p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">
                    Priority
                  </label>
                  <p className="text-sm text-gray-900">
                    {p.ticketDetail.priority}
                  </p>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500">
                  Status
                </label>
                <p className="text-sm text-gray-900 capitalize">
                  {p.ticketDetail.status}
                </p>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500">
                  Subject
                </label>
                <p className="text-sm text-gray-900">
                  {p.ticketDetail.subject}
                </p>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500">
                  Description
                </label>
                <p className="text-sm text-gray-900 bg-gray-50 p-3 rounded-lg">
                  {p.ticketDetail.description}
                </p>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500">
                  Created
                </label>
                <p className="text-sm text-gray-900">
                  {new Date(p.ticketDetail.createdAt).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// SCHOOL STUDENT PANEL  ← FULLY FIXED
// ─────────────────────────────────────────────────────────────────────────────
const SchoolStudentPanel = () => {
  const API_URL = SCHOOL_STU_API_URL;
  const p = usePanel();
  const send = makeSender(p, API_URL);
  // ✅ FIX 1: use API_URL (SCHOOL_STU_API_URL) instead of STUDENT_API_URL
  const deleteTicket = makeTicketDeleter(p, API_URL);

  useEffect(() => {
    requestNotificationPermission();
  }, []);

  const needsReplyNow = useNeedsReplyMode();
  const isNeedsReply = useCallback(
    (ticket) =>
      isNeedsReplyTicket(
        ticket,
        NEEDS_REPLY_ROLES.schoolStudent,
        needsReplyNow,
      ),
    [needsReplyNow],
  );

  const statusColor = (s) => {
    switch (s?.toLowerCase()) {
      case "open":
        return "bg-green-100 text-green-800 border-green-200";
      case "in-progress":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "resolved":
        return "bg-purple-100 text-purple-800 border-purple-200";
      case "closed":
        return "bg-gray-100 text-gray-800 border-gray-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const loadTickets = useCallback(async () => {
    try {
      const token = p.getToken();
      if (!token) {
        p.setApiError("No auth token");
        return;
      }
      const qs = new URLSearchParams({
        page: p.page,
        limit: 20,
        sort: p.sortBy,
        search: p.search,
        status: p.fStatus !== "all" ? p.fStatus : "",
        priority: p.fPriority !== "all" ? p.fPriority : "",
        category: p.fCategory !== "all" ? p.fCategory : "",
      });
      const res = await axios.get(`${API_URL}/tickets?${qs}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      p.setTickets(res.data.tickets || []);
      p.setTotalPages(res.data.totalPages || 1);
      p.setApiError(null);
      p.loadStatsRef.current?.();
    } catch (err) {
      p.setApiError(
        err.response?.status === 401
          ? "Unauthorized"
          : "Failed to load tickets.",
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.page, p.fStatus, p.fPriority, p.fCategory, p.sortBy, p.search]);

  useEffect(() => {
    p.loadTicketsRef.current = loadTickets;
  }, [loadTickets]); // eslint-disable-line
  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  const loadStats = useCallback(async () => {
    try {
      const token = p.getToken();
      if (!token) return;
      const res = await axios.get(`${API_URL}/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      p.setStats(res.data.stats || {});
    } catch (_) {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [API_URL]);

  useEffect(() => {
    p.loadStatsRef.current = loadStats;
  }, [loadStats]); // eslint-disable-line

  const loadMessages = useCallback(
    async (ticketId, showSpinner = true) => {
      try {
        const token = p.getToken();
        if (!token) return [];
        if (showSpinner) p.setLoading(true);
        const res = await axios.get(`${API_URL}/messages/${ticketId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const msgs = dedupe(res.data.messages || []);
        p.setMessages((prev) => ({ ...prev, [ticketId]: msgs }));
        return msgs;
      } catch (err) {
        console.error(err);
        return [];
      } finally {
        if (showSpinner) p.setLoading(false);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [API_URL],
  );

  const markRead = useCallback(
    async (ticketId) => {
      try {
        const token = p.getToken();
        if (!token) return;
        p.setTickets((q) =>
          q.map((t) =>
            t._id === ticketId ? { ...t, unread: false, unreadCount: 0 } : t,
          ),
        );
        if (p.selRef.current?._id === ticketId)
          p.setSelectedTicket((q) =>
            q ? { ...q, unread: false, unreadCount: 0 } : q,
          );
        await axios.post(
          `${API_URL}/mark-read/${ticketId}`,
          {},
          { headers: { Authorization: `Bearer ${token}` } },
        );
        p.loadStatsRef.current?.();
      } catch (err) {
        console.error(err);
        p.loadTicketsRef.current?.();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [API_URL],
  );

  useEffect(() => {
    p.markReadRef.current = markRead;
  }, [markRead]); // eslint-disable-line

  useEffect(() => {
    const token = p.getToken();
    if (!token) return;
    const s = io(SOCKET_URL, {
      auth: { token, role: "admin" },
      transports: ["polling", "websocket"],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });
    p.socketRef.current = s;
    s.on("connect", () => {
      p.setSocketConn(true);
      s.emit("join_admin_room");
      p.loadStatsRef.current?.();
      p.loadTicketsRef.current?.();
    });
    s.on("connect_error", () => p.setSocketConn(false));
    s.on("disconnect", () => p.setSocketConn(false));

    s.on("new_message", ({ ticketId, message }) => {
      if (!ticketId || !message) return;
      if (!p.ticketsRef.current.some((t) => t._id === ticketId)) return;
      const isSel = p.selRef.current?._id === ticketId;
      addMessage(p.setMessages, ticketId, message);
      if (isSel) {
        p.setSelectedTicket((q) =>
          q
            ? {
                ...q,
                lastMessage: message.text || q.lastMessage,
                lastMessageTime: message.createdAt,
                lastMessageSender: message.senderRole,
              }
            : q,
        );
      }
      if (
        message.senderRole === "user" ||
        message.senderRole === "school-admin"
      ) {
        if (isSel) {
          p.setTickets((q) =>
            q.map((t) =>
              t._id === ticketId
                ? {
                    ...t,
                    lastMessage: message.text || t.lastMessage,
                    lastMessageTime: message.createdAt,
                    lastMessageSender: message.senderRole,
                    unread: false,
                    unreadCount: 0,
                  }
                : t,
            ),
          );
          p.markReadRef.current?.(ticketId);
        } else {
          const ticket = p.ticketsRef.current.find((t) => t._id === ticketId);
          if (ticket)
            sendDesktopNotification(
              `💬 New message from ${ticket.studentName || "Student"}`,
              message.text?.substring(0, 80) || "New attachment",
              `msg-${ticketId}`,
            );
          p.setTickets((q) => {
            const updated = q.map((t) =>
              t._id === ticketId
                ? {
                    ...t,
                    lastMessage: message.text,
                    lastMessageTime: message.createdAt,
                    lastMessageSender: message.senderRole,
                    unread: true,
                    unreadCount: (t.unreadCount || 0) + 1,
                  }
                : t,
            );
            const idx = updated.findIndex((t) => t._id === ticketId);
            if (idx > 0) {
              const [ticket] = updated.splice(idx, 1);
              updated.unshift(ticket);
            }
            return updated;
          });
          p.loadStatsRef.current?.();
        }
      } else {
        p.setTickets((q) => {
          const updated = q.map((t) =>
            t._id === ticketId
              ? {
                  ...t,
                  lastMessage: message.text || t.lastMessage,
                  lastMessageTime: message.createdAt,
                  lastMessageSender: message.senderRole,
                }
              : t,
          );
          const idx = updated.findIndex((t) => t._id === ticketId);
          if (idx > 0) {
            const [ticket] = updated.splice(idx, 1);
            updated.unshift(ticket);
          }
          return updated;
        });
      }
      if (isSel) p.scrollEnd();
    });

    s.on("ticket_auto_escalated", (data) => {
      const {
        ticketId,
        studentName,
        subject,
        hoursWaiting,
        escalationCount,
        message,
      } = data;
      if (!ticketId || !p.ticketsRef.current.some((t) => t._id === ticketId))
        return;
      p.addEscalationToast({
        ticketId,
        studentName,
        subject,
        hoursWaiting,
        escalationCount,
      });
      p.setTickets((q) =>
        q.map((t) =>
          t._id === ticketId
            ? {
                ...t,
                autoEscalated: true,
                autoEscalatedAt: new Date().toISOString(),
                autoEscalationCount: (t.autoEscalationCount || 0) + 1,
              }
            : t,
        ),
      );
      if (p.selRef.current?._id === ticketId)
        p.setSelectedTicket((q) =>
          q
            ? {
                ...q,
                autoEscalated: true,
                autoEscalatedAt: new Date().toISOString(),
              }
            : q,
        );
      if (message) addMessage(p.setMessages, ticketId, message);
      p.loadStatsRef.current?.();
      sendDesktopNotification(
        `⚠️ Ticket needs response — ${studentName}`,
        `Needs reply • ${subject}`,
        `escalate-${ticketId}`,
      );
    });

    s.on("ticket_escalation_resolved", ({ ticketId }) => {
      p.setTickets((q) =>
        q.map((t) => (t._id === ticketId ? { ...t, autoEscalated: false } : t)),
      );
      if (p.selRef.current?._id === ticketId)
        p.setSelectedTicket((q) => (q ? { ...q, autoEscalated: false } : q));
    });

    s.on("ticket_deleted", ({ ticketId }) => {
      if (!ticketId) return;
      p.setTickets((prev) => prev.filter((t) => t._id !== ticketId));
      p.setMessages((prev) => {
        const copy = { ...prev };
        delete copy[ticketId];
        return copy;
      });
      if (p.selRef.current?._id === ticketId) p.setSelectedTicket(null);
      p.loadStatsRef.current?.();
    });

    s.on("ticket_escalated", (data) => {
      if (!data?.ticketId) return;
      if (data.adminTab && data.adminTab !== "school_student") return;
      const { ticketId, ticket, message, reason, school } = data;
      p.setTickets((q) => {
        if (q.some((t) => t._id === ticketId))
          return q.map((t) =>
            t._id === ticketId
              ? {
                  ...t,
                  escalated: true,
                  escalationReason: reason || t.escalationReason,
                  unread: true,
                  unreadCount: (t.unreadCount || 0) + 1,
                }
              : t,
          );
        const nt = ticket
          ? { ...ticket, escalated: true }
          : {
              _id: ticketId,
              escalated: true,
              escalationReason: reason || "",
              school,
              unread: true,
              unreadCount: 1,
            };
        return [nt, ...q];
      });
      if (message) addMessage(p.setMessages, ticketId, message);
      p.loadStatsRef.current?.();
    });

    // ✅ FIX 2: listen for ticket_escalated_to_partner in SchoolStudentPanel too
    s.on("ticket_escalated_to_partner", ({ originalTicketId }) => {
      p.setTickets((q) =>
        q.map((t) =>
          t._id === originalTicketId ? { ...t, escalatedToPartner: true } : t,
        ),
      );
      if (p.selRef.current?._id === originalTicketId)
        p.setSelectedTicket((q) =>
          q ? { ...q, escalatedToPartner: true } : q,
        );
    });

    s.on("ticket_status_update", ({ ticketId, status, message }) => {
      if (!ticketId || !status) return;
      p.setTickets((q) =>
        q.map((t) =>
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
      if (p.selRef.current?._id === ticketId)
        p.setSelectedTicket((q) =>
          q
            ? {
                ...q,
                status,
                autoEscalated: ["resolved", "closed"].includes(status)
                  ? false
                  : q.autoEscalated,
              }
            : q,
        );
      if (message) addMessage(p.setMessages, ticketId, message);
      p.loadStatsRef.current?.();
    });

    s.on("messages_read", ({ ticketId }) => {
      p.setTickets((q) =>
        q.map((t) =>
          t._id === ticketId ? { ...t, unread: false, unreadCount: 0 } : t,
        ),
      );
      if (p.selRef.current?._id === ticketId)
        p.setSelectedTicket((q) =>
          q ? { ...q, unread: false, unreadCount: 0 } : q,
        );
      p.loadStatsRef.current?.();
    });

    s.on("message_deleted", ({ messageId, ticketId }) => {
      p.setMessages((prev) => ({
        ...prev,
        [ticketId]: (prev[ticketId] || []).filter((m) => m._id !== messageId),
      }));
    });

    return () => s.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (p.socketRef.current?.connected && p.selectedTicket)
      p.socketRef.current.emit("join_ticket", p.selectedTicket._id);
    return () => {
      if (p.selectedTicket && p.socketRef.current)
        p.socketRef.current.emit("leave_ticket", p.selectedTicket._id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.selectedTicket?._id]);

  useEffect(() => {
    if (p.socketConn) return;
    const id = setInterval(async () => {
      if (p.selRef.current) await loadMessages(p.selRef.current._id, false);
      p.loadTicketsRef.current?.();
      p.loadStatsRef.current?.();
    }, 5000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.socketConn]);

  useEffect(() => {
    if (p.selectedTicket && p.messages[p.selectedTicket._id]?.length)
      p.scrollEnd();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.messages[p.selectedTicket?._id]?.length]);

  const selectTicket = useCallback(
    async (t) => {
      p.setTickets((q) =>
        q.map((x) =>
          x._id === t._id ? { ...x, unread: false, unreadCount: 0 } : x,
        ),
      );
      p.setSelectedTicket(t);
      await loadMessages(t._id);
      await p.markReadRef.current?.(t._id);
      p.scrollEnd();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [loadMessages],
  );

  const updateStatus = async (ticketId, status) => {
    if (!ticketId || !status) return;
    try {
      const token = p.getToken();
      if (!token) return;
      const res = await axios.put(
        `${API_URL}/ticket/${ticketId}/status`,
        { status },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      p.setTickets((q) =>
        q.map((t) =>
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
      if (p.selRef.current?._id === ticketId)
        p.setSelectedTicket((q) =>
          q
            ? {
                ...q,
                status,
                autoEscalated: ["resolved", "closed"].includes(status)
                  ? false
                  : q.autoEscalated,
              }
            : q,
        );
      if (res.data.systemMessage)
        addMessage(p.setMessages, ticketId, res.data.systemMessage);
      p.loadStatsRef.current?.();
    } catch {
      alert("Failed");
    }
  };

  const assignToMe = async (ticketId) => {
    try {
      const token = p.getToken();
      if (!token) return;
      const res = await axios.put(
        `${API_URL}/ticket/${ticketId}/assign`,
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      );
      p.setTickets((q) =>
        q.map((t) =>
          t._id === ticketId
            ? { ...t, assignedTo: res.data.ticket.assignedTo }
            : t,
        ),
      );
      if (p.selRef.current?._id === ticketId)
        p.setSelectedTicket((q) =>
          q ? { ...q, assignedTo: res.data.ticket.assignedTo } : q,
        );
      if (res.data.systemMessage)
        addMessage(p.setMessages, ticketId, res.data.systemMessage);
    } catch {
      alert("Failed");
    }
  };

  const confirmDeleteMessage = async () => {
    if (!p.delTarget) return;
    p.setDelLoading(true);
    try {
      const token = p.getToken();
      if (!token) return;
      await axios.delete(`${API_URL}/message/${p.delTarget}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (p.selRef.current)
        p.setMessages((prev) => ({
          ...prev,
          [p.selRef.current._id]: (prev[p.selRef.current._id] || []).filter(
            (m) => m._id !== p.delTarget,
          ),
        }));
      p.setDelTarget(null);
    } catch {
      alert("Failed");
    } finally {
      p.setDelLoading(false);
    }
  };

  // ✅ FIX 3: Full escalate-to-partner handler for SchoolStudentPanel
  const handleEscalateToPartner = async (reason) => {
    if (!p.escalateTarget) return;
    if (p.escalateTarget.escalatedToPartner) {
      alert("Already escalated.");
      p.setEscalateTarget(null);
      return;
    }
    p.setEscalateLoading(true);
    try {
      const token = p.getToken();
      if (!token) return;
      const res = await axios.post(
        `${API_URL}/ticket/${p.escalateTarget._id}/escalate-to-partner`,
        { reason },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      p.setTickets((q) =>
        q.map((t) =>
          t._id === p.escalateTarget._id
            ? { ...t, escalatedToPartner: true, autoEscalated: false }
            : t,
        ),
      );
      if (p.selRef.current?._id === p.escalateTarget._id) {
        p.setSelectedTicket((q) =>
          q ? { ...q, escalatedToPartner: true, autoEscalated: false } : q,
        );
      }
      if (res.data.systemMessage)
        addMessage(p.setMessages, p.escalateTarget._id, res.data.systemMessage);
      p.setEscalateTarget(null);
      p.setShowEscalationSuccess(true);
    } catch (err) {
      alert(
        `❌ Escalation failed: ${err.response?.data?.message || err.message}`,
      );
    } finally {
      p.setEscalateLoading(false);
    }
  };

  const token = p.getToken();
  const autoEscCount = p.tickets.filter(isNeedsReply).length;
  const totalUnread = p.tickets.filter((t) => t.unread).length;
  const unreadCount = p.tickets.filter((t) => t.unread).length;
  const openCount = p.tickets.filter((t) => t.status === "open").length;
  const inProgressCount = p.tickets.filter(
    (t) => t.status === "in-progress",
  ).length;
  const resolvedCount = p.tickets.filter(
    (t) => t.status === "resolved" || t.status === "closed",
  ).length;

  const TABS = [
    { id: "all", label: "All", count: p.tickets.length },
    {
      id: "needs-reply",
      label: "Needs Reply",
      count: autoEscCount,
      isAmber: true,
    },
    { id: "unread", label: "Unread", count: totalUnread },
    { id: "open", label: "Open", count: openCount },
    { id: "in-progress", label: "In Progress", count: inProgressCount },
    { id: "resolved", label: "Resolved", count: resolvedCount },
  ];

  const filtered = p.tickets.filter((t) => {
    if (p.activeTab === "all") return true;
    if (p.activeTab === "needs-reply") return isNeedsReply(t);
    if (p.activeTab === "unread") return t.unread;
    if (p.activeTab === "open") return t.status === "open";
    if (p.activeTab === "in-progress") return t.status === "in-progress";
    if (p.activeTab === "resolved") return t.status === "resolved";
    return true;
  });

  const isAutoEscalated = isNeedsReply(p.selectedTicket);
  // ✅ FIX 4: derive isEscalatedInfo so the escalated-to-partner info banner works
  const isEscalatedInfo = !!p.selectedTicket?.escalatedToPartner;

  const STAT_ITEMS = [
    {
      label: "Escalated",
      value: p.stats.total,
      icon: <Flag className="w-4 h-4" />,
      color: "#6366f1",
    },
    {
      label: "Open",
      value: p.stats.open,
      icon: <Clock className="w-4 h-4" />,
      color: "#059669",
    },
    {
      label: "In Progress",
      value: p.stats.inProgress,
      icon: <Hourglass className="w-4 h-4" />,
      color: "#d97706",
    },
    {
      label: "Resolved",
      value: p.stats.resolved,
      icon: <CheckCircle className="w-4 h-4" />,
      color: "#7c3aed",
    },
    {
      label: "Needs Reply",
      value: autoEscCount,
      icon: <Timer className="w-4 h-4" />,
      color: "#3b82f6",
    },
    {
      label: "Unread",
      value: p.stats.unreadMessages,
      icon: <MessageSquare className="w-4 h-4" />,
      color: "#6366f1",
    },
  ];

  const handleBellClick = () => {
    if (autoEscCount > 0) p.setActiveTab("needs-reply");
    else if (totalUnread > 0) p.setActiveTab("unread");
  };

  const renderTicket = (t) => {
    const isSel = p.selectedTicket?._id === t._id;
    const isAutoEsc = isNeedsReply(t);
    const hasUnread = t.unread && !isAutoEsc;
    const avatarBg = G_INDIGO;

    return (
      <div
        key={t._id}
        className="group relative"
        style={{
          borderLeft: `4px solid ${isSel ? (isAutoEsc ? "#3b82f6" : "#6366f1") : isAutoEsc ? "#3b82f6" : hasUnread ? "#6366f1" : "transparent"}`,
          background:
            isAutoEsc && !isSel
              ? "#ffffff"
              : hasUnread && !isSel
                ? "#eff6ff"
                : undefined,
          transition: "background 0.15s, border-color 0.15s",
        }}
        onClick={() => selectTicket(t)}
      >
        <div
          className={`p-3 cursor-pointer hover:bg-gray-50 transition-all ${isSel ? (isAutoEsc ? "bg-blue-50" : "bg-indigo-50") : ""}`}
        >
          <div className="flex items-start justify-between mb-1">
            <div className="flex items-center gap-2 min-w-0">
              <div
                className="relative w-8 h-8 rounded-full flex items-center justify-center font-bold text-white flex-shrink-0 shadow-sm"
                style={{ background: avatarBg, fontSize: "0.7rem" }}
              >
                {(t.studentName || "?").charAt(0).toUpperCase()}
                {(hasUnread || isAutoEsc) && (
                  <span
                    style={{
                      position: "absolute",
                      top: -2,
                      right: -2,
                      width: 10,
                      height: 10,
                      background: isAutoEsc ? "#3b82f6" : "#6366f1",
                      borderRadius: "50%",
                      border: "2px solid #fff",
                      animation:
                        "sch-ping 1.5s cubic-bezier(0,0,0.2,1) infinite",
                    }}
                  />
                )}
              </div>
              <div className="min-w-0">
                <p
                  className={`font-semibold truncate ${hasUnread || isAutoEsc ? "text-gray-900" : "text-gray-700"}`}
                  style={{ fontSize: "0.8rem", margin: 0 }}
                >
                  {t.studentName || "Unknown"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0 ml-1">
              {hasUnread && (
                <span
                  style={{
                    color: "#fff",
                    fontWeight: 700,
                    minWidth: 18,
                    height: 18,
                    borderRadius: 999,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "0 3px",
                    background: G_INDIGO,
                    fontSize: "0.58rem",
                    boxShadow: "0 2px 6px rgba(99,102,241,0.4)",
                  }}
                >
                  {t.unreadCount || 1}
                </span>
              )}
              <span className="text-gray-400" style={{ fontSize: "0.63rem" }}>
                {timeAgo(t.lastMessageTime || t.createdAt)}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  p.setTicketToDelete(t);
                }}
                className="opacity-0 group-hover:opacity-100 p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-all flex-shrink-0"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>

          {t.category && (
            <p className="text-gray-400 mb-1" style={{ fontSize: "0.66rem" }}>
              {t.category}
            </p>
          )}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              className={`px-1.5 py-0.5 rounded-full border ${priorityColor(t.priority)}`}
              style={{ fontSize: "0.63rem" }}
            >
              {t.priority || "Normal"}
            </span>
            <span
              className={`px-1.5 py-0.5 rounded-full border ${statusColor(t.status)}`}
              style={{ fontSize: "0.63rem" }}
            >
              {t.status || "open"}
            </span>
            {isAutoEsc && (
              <span
                className="px-1.5 py-0.5 rounded-full border flex items-center gap-0.5 bg-blue-100 text-blue-800 border-blue-200"
                style={{ fontSize: "0.63rem" }}
              >
                <Timer style={{ width: 9, height: 9 }} />
                Needs Reply
              </span>
            )}
            {/* ✅ FIX 5: show Partner badge in ticket list for school panel too */}
            {t.escalatedToPartner && (
              <span
                className="px-1.5 py-0.5 rounded-full border flex items-center gap-0.5 bg-violet-100 text-violet-800 border-violet-200"
                style={{ fontSize: "0.63rem" }}
              >
                <ExternalLink className="w-2.5 h-2.5" />
                Partner
              </span>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div>
      <style>{`
        @keyframes sch-ping {
          0%,100% { box-shadow: 0 0 0 0 rgba(99,102,241,0.5); }
          50%      { box-shadow: 0 0 0 4px rgba(99,102,241,0); }
        }
      `}</style>

      <EscalationToasts
        toasts={p.escalationToasts}
        onDismiss={p.dismissToast}
      />

      {p.delTarget && (
        <DeleteModal
          onConfirm={confirmDeleteMessage}
          onCancel={() => p.setDelTarget(null)}
          loading={p.delLoading}
        />
      )}
      {p.ticketToDelete && (
        <DeleteTicketModal
          ticket={p.ticketToDelete}
          onConfirm={deleteTicket}
          onCancel={() => {
            if (!p.deletingTicket) p.setTicketToDelete(null);
          }}
          loading={p.deletingTicket}
        />
      )}
      {/* ✅ FIX 6: EscalateModal wired up in SchoolStudentPanel */}
      {p.escalateTarget && (
        <EscalateModal
          ticket={p.escalateTarget}
          onConfirm={handleEscalateToPartner}
          onCancel={() => p.setEscalateTarget(null)}
          loading={p.escalateLoading}
        />
      )}
      {p.showEscalationSuccess && (
        <EscalationSuccessModal
          onClose={() => p.setShowEscalationSuccess(false)}
        />
      )}

      <StatCards items={STAT_ITEMS} />
      {unreadCount > 0 && (
        <UnreadBanner
          count={unreadCount}
          onViewAll={() => p.setActiveTab("unread")}
        />
      )}
      <EscalationBanner
        count={autoEscCount}
        onViewAll={() => p.setActiveTab("needs-reply")}
      />

      {/* Search bar */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 mb-5">
        <div className="flex items-center gap-3 flex-wrap">
          <div
            className="relative flex-1 min-w-[180px] max-w-md"
            style={{
              height: 38,
              display: "flex",
              alignItems: "center",
              background: "#fff",
              border: "1.5px solid #d1d5db",
              borderRadius: 8,
              padding: "0 12px",
              gap: 8,
            }}
          >
            <Search
              style={{ color: "#9ca3af", width: 12, height: 12, flexShrink: 0 }}
            />
            {/*Add marginTop : "0px" for alignment - 06-08-2026 */}
            <input
              type="text"
              placeholder="Search student, subject…"
              value={p.search}
              onChange={(e) => p.setSearch(e.target.value)}
              style={{
                flex: 1,
                marginTop: "0px",
                border: "none",
                outline: "none",
                fontSize: "0.8rem",
                color: "#1e293b",
                background: "transparent",
                fontFamily: "inherit",
                minWidth: 0,
              }}
            />
            {p.search && (
              <button
                onClick={() => p.setSearch("")}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                <X style={{ color: "#9ca3af", width: 10, height: 10 }} />
              </button>
            )}
          </div>
          <button
            onClick={() => p.setShowFilters(!p.showFilters)}
            style={{
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              gap: 5,
              height: 38,
              padding: "0 12px",
              border: "1.5px solid #d1d5db",
              borderRadius: 8,
              background: "#fff",
              color: "#374151",
              fontWeight: 600,
              fontSize: "0.78rem",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            <Filter style={{ width: 10, height: 10 }} />
            Filters
            <ChevronDown
              style={{
                width: 8,
                height: 8,
                transition: "transform 0.2s",
                transform: p.showFilters ? "rotate(180deg)" : "rotate(0deg)",
              }}
            />
          </button>
          <div style={{ position: "relative", flexShrink: 0 }}>
            <select
              value={p.sortBy}
              onChange={(e) => p.setSortBy(e.target.value)}
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
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="priority">Priority</option>
              <option value="status">Status</option>
            </select>
            <ChevronDown
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
          <NotificationBell
            unreadCount={totalUnread}
            needsReplyCount={autoEscCount}
            onClick={handleBellClick}
          />
        </div>
        {p.showFilters && (
          <div style={{ marginTop: 10 }}>
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
              {[
                {
                  label: "Status",
                  v: p.fStatus,
                  set: p.setFStatus,
                  opts: STATUSES,
                },
                {
                  label: "Priority",
                  v: p.fPriority,
                  set: p.setFPriority,
                  opts: PRIS,
                },
                {
                  label: "Category",
                  v: p.fCategory,
                  set: p.setFCategory,
                  opts: CATS,
                },
              ].map(({ label, v, set, opts }) => (
                <div key={label}>
                  <label
                    style={{
                      display: "block",
                      fontSize: "0.62rem",
                      fontWeight: 700,
                      color: "#6b7280",
                      marginBottom: 4,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    {label}
                  </label>
                  <div style={{ position: "relative" }}>
                    <select
                      value={v}
                      onChange={(e) => set(e.target.value)}
                      style={{
                        width: "100%",
                        appearance: "none",
                        padding: "5px 22px 5px 8px",
                        border:
                          v !== "all"
                            ? "1.5px solid #6366f1"
                            : "1.5px solid #d1d5db",
                        borderRadius: 7,
                        background:
                          v !== "all" ? "rgba(99,102,241,0.06)" : "#fff",
                        color: v !== "all" ? "#6366f1" : "#374151",
                        fontWeight: v !== "all" ? 600 : 400,
                        fontSize: "0.76rem",
                        cursor: "pointer",
                        outline: "none",
                        fontFamily: "inherit",
                      }}
                    >
                      {opts.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
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
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-1">
          <div
            className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col"
            style={{ minHeight: 580 }}
          >
            <div
              className="px-3 pt-3 pb-2 border-b border-gray-100"
              style={{
                background: "linear-gradient(to right,#f5f3ff,#eef2ff)",
              }}
            >
              <h2
                className="font-bold text-gray-800 mb-2"
                style={{ fontSize: "0.88rem" }}
              >
                <span className="flex items-center gap-1.5">
                  <Flag style={{ width: 12, height: 12, color: "#6366f1" }} />
                  Escalated ({filtered.length}
                  {filtered.length !== p.tickets.length
                    ? ` / ${p.tickets.length}`
                    : ""}
                  )
                </span>
              </h2>
              <div
                style={{
                  display: "flex",
                  gap: 6,
                  flexWrap: "nowrap",
                  overflowX: "auto",
                  paddingBottom: 4,
                  alignItems: "center",
                }}
              >
                {TABS.map(({ id, label, count, isAmber }) => {
                  const isActive = p.activeTab === id;
                  return (
                    <button
                      key={id}
                      onClick={() => p.setActiveTab(id)}
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
                        color: isActive ? "#111827" : "#64748b",
                        border: isActive ? "1px solid #e5e7eb" : "none",
                      }}
                    >
                      {isAmber && (
                        <Timer style={{ width: 6, height: 6, flexShrink: 0 }} />
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
                            background: isAmber ? "#3b82f6" : "#6366f1",
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
              {filtered.length === 0 ? (
                <div className="p-8 text-center">
                  <div
                    className="w-12 h-12 mx-auto mb-3 rounded-full flex items-center justify-center"
                    style={{ background: "#eef2ff" }}
                  >
                    {p.activeTab === "needs-reply" ? (
                      <Timer className="w-6 h-6 text-blue-400" />
                    ) : p.activeTab === "unread" ? (
                      <MessageSquare className="w-6 h-6 text-indigo-400" />
                    ) : (
                      <Flag className="w-6 h-6 text-indigo-300" />
                    )}
                  </div>
                  <p className="text-sm text-gray-500">
                    {p.activeTab === "needs-reply"
                      ? "No tickets waiting — great job! 🎉"
                      : p.activeTab === "unread"
                        ? "All messages read ✓"
                        : "No tickets found"}
                  </p>
                  {p.apiError && (
                    <p className="text-xs text-red-400 mt-1">{p.apiError}</p>
                  )}
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {filtered.map(renderTicket)}
                </div>
              )}
            </div>

            <Pagination
              currentPage={p.page}
              totalPages={p.totalPages}
              onPageChange={(pg) => p.setPage(pg)}
            />
          </div>
        </div>

        <div className="lg:col-span-2">
          {p.selectedTicket ? (
            <div
              className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden"
              style={{
                height: 660,
                borderColor: isAutoEscalated ? "#3b82f6" : undefined,
                borderWidth: isAutoEscalated ? 2 : undefined,
                boxShadow: isAutoEscalated
                  ? "0 0 0 3px rgba(59,130,246,0.1)"
                  : undefined,
              }}
            >
              <div
                className="p-3 border-b border-gray-200"
                style={{
                  background: isAutoEscalated
                    ? "linear-gradient(135deg,#eff6ff,#dbeafe)"
                    : G_INDIGO,
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center shadow-sm flex-shrink-0"
                      style={{
                        background: isAutoEscalated
                          ? G_AMBER
                          : "rgba(255,255,255,0.2)",
                      }}
                    >
                      {isAutoEscalated ? (
                        <Timer
                          style={{ color: "#fff", width: 14, height: 14 }}
                        />
                      ) : (
                        <Flag
                          style={{ color: "#fff", width: 14, height: 14 }}
                        />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h3
                          style={{
                            fontSize: "0.82rem",
                            fontWeight: 700,
                            color: isAutoEscalated ? "#1e3a8a" : "#fff",
                            margin: 0,
                          }}
                          className="truncate"
                        >
                          {p.selectedTicket.subject ||
                            p.selectedTicket.category ||
                            "Escalated Ticket"}
                        </h3>
                        {p.selectedTicket.priority === "urgent" && (
                          <span
                            className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-red-200 text-red-800 font-semibold flex-shrink-0"
                            style={{ fontSize: "0.58rem" }}
                          >
                            <AlertCircle className="w-2 h-2" />
                            Urgent
                          </span>
                        )}
                        {isAutoEscalated && (
                          <span
                            className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0"
                            style={{
                              fontSize: "0.58rem",
                              background: "rgba(59,130,246,0.15)",
                              color: "#1e3a8a",
                            }}
                          >
                            <Timer className="w-2 h-2" />
                            Needs Reply
                          </span>
                        )}
                        {/* ✅ FIX 7: Escalated-to-partner badge in chat header */}
                        {isEscalatedInfo && !isAutoEscalated && (
                          <span
                            className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-white/20 text-white font-semibold flex-shrink-0"
                            style={{ fontSize: "0.58rem" }}
                          >
                            <ExternalLink className="w-2 h-2" />
                            Escalated
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 flex-wrap mt-0.5">
                        <span
                          style={{
                            color: isAutoEscalated
                              ? "#4b5563"
                              : "rgba(255,255,255,0.8)",
                            fontSize: "0.68rem",
                          }}
                        >
                          {p.selectedTicket.studentName || "Unknown"}
                        </span>
                        {p.selectedTicket.school && (
                          <span
                            style={{
                              color: isAutoEscalated
                                ? "#6b7280"
                                : "rgba(255,255,255,0.6)",
                              fontSize: "0.62rem",
                            }}
                          >
                            · {p.selectedTicket.school}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap">
                    <button
                      onClick={() => p.setTicketToDelete(p.selectedTicket)}
                      className="p-1.5 rounded-full transition-colors flex-shrink-0"
                      style={{
                        background: "rgba(255,255,255,0.15)",
                        color: isAutoEscalated ? "#374151" : "#fff",
                      }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    {!p.selectedTicket.assignedTo &&
                      p.selectedTicket.status !== "resolved" && (
                        <button
                          onClick={() => assignToMe(p.selectedTicket._id)}
                          className="flex items-center gap-1 px-2 py-1 border rounded-lg font-semibold"
                          style={{
                            fontSize: "0.7rem",
                            border: isAutoEscalated
                              ? "1px solid #3b82f6"
                              : "1px solid rgba(255,255,255,0.3)",
                            background: isAutoEscalated
                              ? "rgba(59,130,246,0.1)"
                              : "rgba(255,255,255,0.15)",
                            color: isAutoEscalated ? "#1d4ed8" : "#fff",
                          }}
                        >
                          <UserCheck className="w-2.5 h-2.5" />
                          Assign
                        </button>
                      )}
                    {/* ✅ FIX 8: Escalate-to-partner button in SchoolStudentPanel chat header */}
                    {p.selectedTicket.category === "Internship Access" &&
                      p.selectedTicket.status !== "resolved" && (
                        <button
                          onClick={() => p.setEscalateTarget(p.selectedTicket)}
                          disabled={p.selectedTicket.escalatedToPartner}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg font-semibold"
                          style={{
                            fontSize: "0.7rem",
                            background:
                              "linear-gradient(135deg,#7c3aed,#6d28d9)",
                            color: "#fff",
                            border: "none",
                            cursor: p.selectedTicket.escalatedToPartner
                              ? "not-allowed"
                              : "pointer",
                            opacity: p.selectedTicket.escalatedToPartner
                              ? 0.6
                              : 1,
                          }}
                        >
                          <ExternalLink className="w-2.5 h-2.5" />
                          {p.selectedTicket.escalatedToPartner
                            ? "Escalated"
                            : "Escalate"}
                        </button>
                      )}
                    <StatusDropdown
                      value={p.selectedTicket.status || "open"}
                      onChange={(val) => {
                        const tid =
                          p.selRef.current?._id || p.selectedTicket._id;
                        updateStatus(tid, val);
                      }}
                      isLight={isAutoEscalated}
                    />
                  </div>
                </div>

                {isAutoEscalated && (
                  <div
                    className="mt-2 p-2.5 rounded-xl flex items-start gap-2.5"
                    style={{
                      background: "linear-gradient(135deg,#dbeafe,#bfdbfe)",
                      border: "1px solid #3b82f6",
                    }}
                  >
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        background: G_AMBER,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <Timer style={{ color: "#fff", width: 14, height: 14 }} />
                    </div>
                    <div>
                      <p
                        style={{
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          color: "#1e3a8a",
                          margin: "0 0 2px",
                        }}
                      >
                        This ticket is marked as Needs Reply
                      </p>
                      <p
                        style={{
                          fontSize: "0.68rem",
                          color: "#1d4ed8",
                          margin: 0,
                        }}
                      >
                        Ticket opened {timeAgo(p.selectedTicket.createdAt)} ·
                        Use the Needs Reply tab to review it
                      </p>
                    </div>
                  </div>
                )}

                {/* ✅ FIX 9: Partner-escalated info banner in SchoolStudentPanel */}
                {isEscalatedInfo && !isAutoEscalated && (
                  <div
                    className="mt-2 p-2 rounded-lg flex items-start gap-2"
                    style={{
                      background: "rgba(255,255,255,0.1)",
                      fontSize: "0.72rem",
                    }}
                  >
                    <ExternalLink
                      style={{
                        width: 12,
                        height: 12,
                        color: "rgba(255,255,255,0.8)",
                        flexShrink: 0,
                        marginTop: 1,
                      }}
                    />
                    <span style={{ color: "rgba(255,255,255,0.9)" }}>
                      This ticket is escalated to a partner. Partner replies
                      appear here automatically.
                    </span>
                  </div>
                )}

                <div className="mt-2 flex items-center gap-2 flex-wrap">
                  <span
                    className={`text-xs px-2.5 py-1 rounded-lg border ${priorityColor(p.selectedTicket.priority)}`}
                  >
                    {p.selectedTicket.priority || "Normal"}
                  </span>
                  {p.selectedTicket.assignedTo && (
                    <span
                      className="text-xs flex items-center gap-1"
                      style={{
                        color: isAutoEscalated
                          ? "#374151"
                          : "rgba(255,255,255,0.8)",
                      }}
                    >
                      <UserCheck className="w-3 h-3" />
                      {p.selectedTicket.assignedTo.name}
                    </span>
                  )}
                </div>
              </div>

              <div
                className="flex-1 p-3 overflow-y-auto"
                style={{ background: G_CHAT }}
              >
                {p.loading ? (
                  <div className="flex justify-center items-center h-full">
                    <Loader2
                      className="w-6 h-6 animate-spin"
                      style={{ color: "#6366f1" }}
                    />
                  </div>
                ) : (
                  <>
                    {!p.messages[p.selectedTicket._id]?.length && (
                      <div className="flex flex-col items-center justify-center h-full gap-3 opacity-60">
                        <MessageSquare className="w-10 h-10 text-gray-300" />
                        <p className="text-center text-gray-400 text-sm">
                          No messages yet.
                        </p>
                      </div>
                    )}
                    {(p.messages[p.selectedTicket._id] || []).map((msg) => (
                      <div key={`msg-${msg._id}`}>
                        {msg.senderRole === "system" ? (
                          <div className="flex justify-center my-2">
                            <span
                              className={`px-3 py-1 rounded-full font-medium max-w-[85%] text-center ${
                                msg.autoEscalation
                                  ? "bg-blue-100 text-blue-800 border border-blue-300"
                                  : msg.text
                                        ?.toLowerCase()
                                        .includes(
                                          "escalated to the internship partner",
                                        )
                                    ? "bg-violet-100 text-violet-700 border border-violet-200"
                                    : msg.text?.includes("Escalated")
                                      ? "bg-orange-100 text-orange-700 border border-orange-200"
                                      : "bg-gray-200 text-gray-600"
                              }`}
                              style={{ fontSize: "0.7rem" }}
                            >
                              {msg.text}
                            </span>
                          </div>
                        ) : (
                          <ChatBubble
                            msg={msg}
                            selectedTicket={p.selectedTicket}
                            onReply={p.setReplyingTo}
                            onDelete={p.setDelTarget}
                            token={token}
                          />
                        )}
                      </div>
                    ))}
                    <div ref={p.endRef} />
                  </>
                )}
              </div>

              {p.replyingTo && (
                <div
                  className="px-3 py-1.5 border-t flex items-center justify-between"
                  style={{ background: "#eef2ff", borderColor: "#c7d2fe" }}
                >
                  <div
                    className="flex items-center text-xs gap-1.5"
                    style={{ color: "#4338ca" }}
                  >
                    <Reply className="w-3 h-3" />
                    <span>
                      Replying: "
                      <span className="font-medium">
                        {p.replyingTo.text?.substring(0, 40)}…
                      </span>
                      "
                    </span>
                  </div>
                  <button
                    onClick={() => p.setReplyingTo(null)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              <StagedAttachments
                attachments={p.staged}
                onRemove={p.removeStaged}
              />

              <div className="p-3 border-t border-gray-200 bg-white">
                <div className="flex items-center gap-2">
                  <label
                    className="p-1.5 rounded-full flex-shrink-0 cursor-pointer transition-colors"
                    style={{
                      background: "#f3f4f6",
                      color: isAutoEscalated ? "#2563eb" : "#6366f1",
                    }}
                  >
                    <Paperclip className="w-3.5 h-3.5" />
                    <input
                      type="file"
                      className="hidden"
                      multiple
                      accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.gif,.webp"
                      onChange={p.pickFiles}
                    />
                  </label>
                  <button
                    onClick={p.toggleListening}
                    title="Auto Type (Speech to Text)"
                    style={{
                      flexShrink: 0,
                      cursor: "pointer",
                      border: "none",
                      background: "transparent",
                      padding: 0,
                    }}
                  >
                    <div
                      className={`${p.isListening ? "sa-ping-red" : ""}`}
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: p.isListening ? "#fef2f2" : "#f3f4f6",
                        color: p.isListening
                          ? "#ef4444"
                          : isAutoEscalated
                            ? "#2563eb"
                            : "#6366f1",
                        transition: "all 0.15s",
                      }}
                    >
                      {p.isListening ? (
                        <MicOff style={{ width: 14, height: 14 }} />
                      ) : (
                        <Mic style={{ width: 14, height: 14 }} />
                      )}
                    </div>
                  </button>
                  <input
                    type="text"
                    placeholder={
                      p.isListening
                        ? "Listening..."
                        : isAutoEscalated
                          ? "Reply now — marked Needs Reply"
                          : isEscalatedInfo
                            ? "Reply to student (partner notified)…"
                            : "Type your response…"
                    }
                    className="flex-1 border border-gray-300 rounded-full px-3 py-2 outline-none"
                    style={{
                      fontSize: "0.8rem",
                      minWidth: 0,
                      borderColor: isAutoEscalated ? "#3b82f6" : undefined,
                      boxShadow: isAutoEscalated
                        ? "0 0 0 2px rgba(59,130,246,0.15)"
                        : undefined,
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = isAutoEscalated
                        ? "#2563eb"
                        : "#6366f1";
                      e.target.style.boxShadow = `0 0 0 3px rgba(${isAutoEscalated ? "37,99,235" : "99,102,241"},0.15)`;
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = isAutoEscalated
                        ? "#3b82f6"
                        : "#d1d5db";
                      e.target.style.boxShadow = isAutoEscalated
                        ? "0 0 0 2px rgba(59,130,246,0.15)"
                        : "none";
                    }}
                    value={p.messageInput}
                    onChange={(e) => p.setMessageInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        send();
                      }
                    }}
                    disabled={p.sending}
                  />
                  <button
                    onClick={send}
                    disabled={
                      (!p.messageInput.trim() && !p.staged.length) || p.sending
                    }
                    className="p-2 rounded-full transition-all flex-shrink-0"
                    style={
                      (p.messageInput.trim() || p.staged.length) && !p.sending
                        ? {
                            background: isAutoEscalated ? G_AMBER : G_INDIGO,
                            color: "#fff",
                            boxShadow: `0 3px 10px rgba(${isAutoEscalated ? "59,130,246" : "99,102,241"},0.4)`,
                          }
                        : {
                            background: "#e5e7eb",
                            color: "#9ca3af",
                            cursor: "not-allowed",
                          }
                    }
                  >
                    {p.sending ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-1 ml-10">
                  PDF · Word · TXT · Images — max 10 MB
                </p>
              </div>
            </div>
          ) : (
            <div
              className="bg-white rounded-xl shadow-sm border border-gray-200 flex items-center justify-center"
              style={{ height: 660 }}
            >
              <div className="text-center px-6">
                <div
                  className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
                  style={{
                    background: "linear-gradient(135deg,#eef2ff,#ede9fe)",
                  }}
                >
                  <Flag className="w-8 h-8" style={{ color: "#6366f1" }} />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-1">
                  Escalated Student Tickets
                </h3>
                <p className="text-gray-500 text-sm max-w-xs mx-auto">
                  Select a ticket to view and respond.
                </p>
                <div className="flex flex-col gap-2 mt-4">
                  {autoEscCount > 0 && (
                    <button
                      onClick={() => p.setActiveTab("needs-reply")}
                      className="px-4 py-2 rounded-xl text-white text-sm font-semibold"
                      style={{
                        background: G_AMBER,
                        boxShadow: "0 4px 14px rgba(59,130,246,0.4)",
                      }}
                    >
                      ⚠️ {autoEscCount} need{autoEscCount === 1 ? "s" : ""}{" "}
                      reply
                    </button>
                  )}
                  {totalUnread > 0 && (
                    <button
                      onClick={() => p.setActiveTab("unread")}
                      className="px-4 py-2 rounded-xl text-white text-sm font-semibold"
                      style={{
                        background: G_INDIGO,
                        boxShadow: "0 4px 14px rgba(99,102,241,0.4)",
                      }}
                    >
                      💬 {totalUnread} unread
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────────────────────────────────────
const StudentSupportCenter = ({ initialView = "student" }) => {
  const [activeView, setActiveView] = useState(initialView);
  useEffect(() => {
    setActiveView(initialView);
  }, [initialView]);

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <style>{`
        @keyframes sa-ping-red {
          0%,100% { box-shadow:0 0 0 0 rgba(239,68,68,0.5); }
          50%      { box-shadow:0 0 0 4px rgba(239,68,68,0); }
        }
        .sa-ping-red  { animation:sa-ping-red 1.5s cubic-bezier(0,0,0.2,1) infinite; }
      `}</style>
      <div className="max-w-7xl mx-auto">
        <div className="mb-5">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2.5">
            <Headphones className="w-7 h-7" style={{ color: "#6366f1" }} />
            Student Support Center
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Manage and respond to student support tickets
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-1.5 mb-5 flex gap-1 w-fit">
          <button
            onClick={() => setActiveView("student")}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
            style={
              activeView === "student"
                ? {
                    background: G_INDIGO,
                    color: "#fff",
                    boxShadow: "0 3px 10px rgba(99,102,241,0.35)",
                  }
                : { color: "#4b5563" }
            }
          >
            <Headphones className="w-3.5 h-3.5" />
            Student Tickets
          </button>
          <button
            onClick={() => setActiveView("school")}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
            style={
              activeView === "school"
                ? {
                    background: G_INDIGO,
                    color: "#fff",
                    boxShadow: "0 3px 10px rgba(99,102,241,0.35)",
                  }
                : { color: "#4b5563" }
            }
          >
            <Flag className="w-3.5 h-3.5" />
            School Student (Escalated)
          </button>
        </div>

        {activeView === "student" ? (
          <StudentTicketsPanel />
        ) : (
          <SchoolStudentPanel />
        )}
      </div>
    </div>
  );
};

export default StudentSupportCenter;
