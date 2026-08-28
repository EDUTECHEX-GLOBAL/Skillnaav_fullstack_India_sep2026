// frontend/src/WebApp/Flows/AdminFlow/MainPage/SchoolAdminSupport.js
// STYLING: Fully ported to match AdminPartnerSupport design system
//   - Same gradient constants (G_INDIGO, G_GREEN, G_AMBER, G_CHAT)
//   - Same TicketList header with gradient background
//   - Same floating pill tab style
//   - Same Pagination component (indigo active, chevron arrows, page x/y)
//   - Same ChatArea header gradient (indigo for normal, escalated banner in blue)
//   - Same chat bubble style (indigo admin right, green school-admin left)
//   - Same stat cards layout
//   - Same SearchFilterBar layout with NotificationBell
//   - Same NeedsReplyBanner, EscalationToasts
//   - Needs Reply is a 6-hour tab/bell state without top-bumping tickets

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Send,
  AlertTriangle,
  Clock,
  CheckCircle,
  Download,
  Search,
  Headphones,
  ChevronDown,
  CreditCard,
  HelpCircle,
  UserCheck,
  CheckCheck,
  Paperclip,
  XCircle,
  School,
  Filter,
  Reply,
  Trash2,
  Flag,
  Hourglass,
  Inbox,
  Bug,
  Lock,
  Loader2,
  Info,
  ChevronLeft,
  ChevronRight,
  Upload,
  RefreshCw,
  AlertCircle,
  X,
  FileText,
  File,
  FileImage,
  Zap,
  Bell,
  Mic,
  MicOff,
} from "lucide-react";
import axios from "axios";
import io from "socket.io-client";

const API_URL = "http://localhost:5000/api/support/admin/school-admin";
const SOCKET_URL = "http://localhost:5000";

const TICKETS_PER_PAGE = 10;

// ─── Gradient constants (matches AdminPartnerSupport exactly) ─────────────────
const G_INDIGO = "linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%)";
const G_GREEN = "linear-gradient(135deg,#059669 0%,#0d9488 100%)";
const G_AMBER = "linear-gradient(135deg,#3b82f6 0%,#2563eb 100%)";
const G_CHAT = "linear-gradient(180deg,#f8f7ff 0%,#f1f0ff 100%)";
const NEEDS_REPLY_AFTER_MS = 6 * 60 * 60 * 1000;
const CLOSED_STATUSES = ["resolved", "closed"];
const SCHOOL_ADMIN_NEEDS_REPLY_ROLES = ["school-admin"];

const CATEGORIES = [
  {
    id: "Technical Issue",
    name: "Technical Issue",
    icon: <Bug style={{ width: 12, height: 12, color: "#3b82f6" }} />,
    color: "blue",
  },
  {
    id: "Upload Credentials CSV",
    name: "Upload Credentials CSV",
    icon: <Upload style={{ width: 12, height: 12, color: "#14b8a6" }} />,
    color: "teal",
  },
  {
    id: "Subscription Issues",
    name: "Subscription Issues",
    icon: <CreditCard style={{ width: 12, height: 12, color: "#22c55e" }} />,
    color: "green",
  },
  {
    id: "Account Issue",
    name: "Account Issue",
    icon: <Lock style={{ width: 12, height: 12, color: "#f97316" }} />,
    color: "orange",
  },
  {
    id: "General Inquiry",
    name: "General Inquiry",
    icon: <HelpCircle style={{ width: 12, height: 12, color: "#6b7280" }} />,
    color: "gray",
  },
];

const PRIORITIES = [
  { id: "low", name: "Low", color: "bg-green-100 text-green-800" },
  { id: "medium", name: "Medium", color: "bg-yellow-100 text-yellow-800" },
  { id: "high", name: "High", color: "bg-orange-100 text-orange-800" },
  { id: "urgent", name: "Urgent", color: "bg-red-100 text-red-800" },
];

const STATUSES = [
  { id: "open", name: "Open", color: "bg-green-100 text-green-800" },
  {
    id: "in-progress",
    name: "In Progress",
    color: "bg-blue-100 text-blue-800",
  },
  { id: "resolved", name: "Resolved", color: "bg-purple-100 text-purple-800" },
  { id: "closed", name: "Closed", color: "bg-gray-100 text-gray-800" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const dedupMessages = (msgs) => {
  const seen = new Set();
  return msgs.filter((m) => {
    if (!m._id || seen.has(m._id)) return false;
    seen.add(m._id);
    return true;
  });
};

const sortTicketsNewest = (tickets) =>
  [...tickets].sort((a, b) => {
    const ta = new Date(a.lastMessageTime || a.createdAt || 0).getTime();
    const tb = new Date(b.lastMessageTime || b.createdAt || 0).getTime();
    return tb - ta;
  });

const isActiveUrgent = (ticket) =>
  ticket.priority === "urgent" &&
  ticket.status !== "resolved" &&
  ticket.status !== "closed";

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
  if (role) return SCHOOL_ADMIN_NEEDS_REPLY_ROLES.includes(role);
  return !!(
    ticket.unread ||
    ticket.unreadCount > 0 ||
    ticket.unreadByAdmin > 0
  );
};

const getToken = () =>
  localStorage.getItem("adminToken") ||
  localStorage.getItem("schoolAdminToken") ||
  localStorage.getItem("userToken") ||
  localStorage.getItem("token") ||
  null;

const getUser = () => {
  try {
    const s = localStorage.getItem("user");
    return s ? JSON.parse(s) : null;
  } catch {
    return null;
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

const formatFileSize = (b) => {
  if (!b) return "0 B";
  if (b < 1024) return b + " B";
  if (b < 1048576) return (b / 1024).toFixed(1) + " KB";
  return (b / 1048576).toFixed(1) + " MB";
};

const isImageMime = (mime = "") => mime.startsWith("image/");

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

const FileIconComp = ({ mime = "", size = 14 }) => {
  const s = { width: size, height: size };
  if (isImageMime(mime)) return <FileImage style={s} />;
  if (mime === "application/pdf") return <FileText style={s} />;
  return <File style={s} />;
};

// ─── Image lightbox ───────────────────────────────────────────────────────────
const Lightbox = ({ src, name, onClose }) => (
  <div
    onClick={onClose}
    style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.88)",
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
          maxWidth: 260,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
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

// ─── Delete modal (matches AdminPartnerSupport) ───────────────────────────────
const DeleteModal = ({ onConfirm, onCancel, loading }) => (
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
        <Trash2 style={{ color: "#ef4444", width: 16, height: 16 }} />
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

// ─── AttachmentItem ───────────────────────────────────────────────────────────
const AttachmentItem = ({ att, token }) => {
  const [downloading, setDownloading] = useState(false);
  const [imgSrc, setImgSrc] = useState(null);
  const [lightbox, setLightbox] = useState(false);

  const attachmentId =
    att._id && typeof att._id === "object"
      ? att._id.$oid || att._id.toString?.() || String(att._id)
      : att._id || "";

  const mime = att.mimetype || att.type || "";

  useEffect(() => {
    if (!isImageMime(mime) || !attachmentId) return;
    let alive = true;
    (async () => {
      try {
        const res = await axios.get(`${API_URL}/file/${attachmentId}/preview`, {
          headers: { Authorization: `Bearer ${token}` },
          responseType: "blob",
        });
        if (alive) setImgSrc(URL.createObjectURL(res.data));
      } catch (_) {}
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line
  }, [attachmentId]);

  useEffect(
    () => () => {
      if (imgSrc) URL.revokeObjectURL(imgSrc);
    },
    [imgSrc],
  );

  const handleDownload = async (e) => {
    e?.stopPropagation();
    if (downloading || !attachmentId) return;
    setDownloading(true);
    try {
      const res = await axios.get(`${API_URL}/file/${attachmentId}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: "blob",
      });
      const url = URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", att.filename || att.name || "file");
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(
        "Download failed: " +
          (err?.response?.data?.message || err?.message || "Unknown error"),
      );
    } finally {
      setDownloading(false);
    }
  };

  // image attachment — matches AdminPartnerSupport AttachmentBubble image style
  if (isImageMime(mime)) {
    return (
      <>
        {lightbox && imgSrc && (
          <Lightbox
            src={imgSrc}
            name={att.filename || att.name}
            onClose={() => setLightbox(false)}
          />
        )}
        <div
          onClick={() => imgSrc && setLightbox(true)}
          style={{
            marginTop: 6,
            borderRadius: 10,
            overflow: "hidden",
            maxWidth: 220,
            cursor: imgSrc ? "pointer" : "default",
            background: "rgba(255,255,255,0.1)",
          }}
        >
          {imgSrc ? (
            <img
              src={imgSrc}
              alt={att.filename || att.name}
              style={{
                width: "100%",
                display: "block",
                borderRadius: "10px 10px 0 0",
              }}
            />
          ) : (
            <div
              style={{
                width: 220,
                height: 130,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Loader2
                style={{ width: 20, height: 20, color: "#fff" }}
                className="animate-spin"
              />
            </div>
          )}
          <button
            onClick={handleDownload}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              width: "100%",
              padding: "5px 8px",
              background: "rgba(0,0,0,0.25)",
              color: "#fff",
              fontSize: "0.7rem",
              borderTop: "1px solid rgba(255,255,255,0.15)",
              border: "none",
              cursor: "pointer",
            }}
          >
            {downloading ? (
              <Loader2
                style={{ width: 12, height: 12 }}
                className="animate-spin"
              />
            ) : (
              <Download style={{ width: 12, height: 12 }} />
            )}
            <span
              style={{
                flex: 1,
                textAlign: "left",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {att.filename || att.name}
            </span>
            <span style={{ opacity: 0.75, flexShrink: 0 }}>
              {formatFileSize(att.size)}
            </span>
          </button>
        </div>
      </>
    );
  }

  // non-image — matches AdminPartnerSupport AttachmentBubble file style
  return (
    <button
      onClick={handleDownload}
      disabled={downloading}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        marginTop: 6,
        padding: "8px 12px",
        borderRadius: 10,
        width: "100%",
        textAlign: "left",
        background: "rgba(255,255,255,0.15)",
        border: "1px solid rgba(255,255,255,0.25)",
        minWidth: 160,
        maxWidth: 240,
        cursor: downloading ? "not-allowed" : "pointer",
        opacity: downloading ? 0.7 : 1,
        color: "#fff",
      }}
    >
      <FileIconComp mime={mime} size={16} />
      <div style={{ flex: 1, overflow: "hidden", minWidth: 0 }}>
        <p
          style={{
            fontSize: "0.75rem",
            fontWeight: 600,
            margin: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {att.filename || att.name}
        </p>
        <p style={{ fontSize: "0.65rem", opacity: 0.7, margin: "2px 0 0" }}>
          {formatFileSize(att.size)}
        </p>
      </div>
      {downloading ? (
        <Loader2 style={{ width: 14, height: 14 }} className="animate-spin" />
      ) : (
        <Download style={{ width: 14, height: 14, opacity: 0.8 }} />
      )}
    </button>
  );
};

// ─── Staged attachments ───────────────────────────────────────────────────────
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
            maxWidth: 200,
          }}
        >
          <div
            style={{
              width: 24,
              height: 24,
              background: "#eef2ff",
              borderRadius: 5,
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <FileIconComp mime={att.type} size={12} />
          </div>
          <div style={{ overflow: "hidden", flex: 1, minWidth: 0 }}>
            <p
              style={{
                margin: 0,
                fontWeight: 600,
                fontSize: "0.7rem",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                maxWidth: 100,
              }}
            >
              {att.name}
            </p>
            <p style={{ margin: 0, color: "#9ca3af", fontSize: "0.62rem" }}>
              {formatFileSize(att.size)}
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

// ─── Chat bubble (AdminPartnerSupport style) ──────────────────────────────────
const ChatBubble = ({ msg, selectedTicket, onReply, onDelete, token }) => {
  const [hovered, setHovered] = useState(false);
  const isAdmin = msg.senderRole === "admin";
  const isSystem = msg.senderRole === "system";
  const schoolLabel =
    msg.schoolName ||
    selectedTicket?.school ||
    selectedTicket?.schoolAdminName ||
    "School Admin";

  if (isSystem)
    return (
      <div
        style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}
      >
        <span
          style={{
            padding: "4px 12px",
            borderRadius: 999,
            background: "#e5e7eb",
            color: "#6b7280",
            fontSize: "0.7rem",
          }}
        >
          {msg.text}
        </span>
      </div>
    );

  if (isAdmin)
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          marginBottom: 12,
          alignItems: "flex-end",
          gap: 6,
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div style={{ position: "relative", maxWidth: "75%" }}>
          <p
            style={{
              fontSize: "0.66rem",
              fontWeight: 600,
              color: "#6366f1",
              textAlign: "right",
              marginBottom: 2,
              paddingRight: 4,
            }}
          >
            {msg.senderName || "Main Admin"}
          </p>
          <div
            style={{
              padding: "7px 11px",
              borderRadius: "14px 14px 3px 14px",
              background: G_INDIGO,
              color: "#fff",
              boxShadow: "0 3px 10px rgba(99,102,241,0.3)",
              opacity: msg.isSending ? 0.6 : 1,
            }}
          >
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
                  <AttachmentItem
                    key={att._id || att.fileId || i}
                    att={att}
                    token={token}
                  />
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
                opacity: 0.8,
              }}
            >
              <span style={{ fontSize: "0.62rem" }}>
                {timeAgo(msg.createdAt)}
              </span>
              <CheckCheck style={{ width: 10, height: 10 }} />
            </div>
          </div>
          {hovered && !msg.isSending && (
            <div
              style={{
                position: "absolute",
                top: "50%",
                transform: "translateY(-50%)",
                left: "-64px",
                display: "flex",
                alignItems: "center",
                gap: 4,
                background: "#fff",
                borderRadius: 8,
                boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
                border: "1px solid #e5e7eb",
                padding: "3px 6px",
                zIndex: 10,
              }}
            >
              <button
                onClick={() => onReply(msg)}
                title="Reply"
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#6b7280",
                  padding: 3,
                  borderRadius: 4,
                  display: "flex",
                }}
              >
                <Reply style={{ width: 12, height: 12 }} />
              </button>
              <button
                onClick={() => onDelete(msg._id)}
                title="Delete"
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#6b7280",
                  padding: 3,
                  borderRadius: 4,
                  display: "flex",
                }}
              >
                <Trash2 style={{ width: 12, height: 12 }} />
              </button>
            </div>
          )}
        </div>
        {/* Admin avatar */}
        <div
          style={{
            width: 24,
            height: 24,
            borderRadius: "50%",
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: G_INDIGO,
            boxShadow: "0 2px 6px rgba(99,102,241,0.3)",
          }}
        >
          <UserCheck style={{ width: 12, height: 12, color: "#fff" }} />
        </div>
      </div>
    );

  // School admin bubble (left side — green, matches partner bubble)
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "flex-start",
        marginBottom: 12,
        alignItems: "flex-end",
        gap: 6,
      }}
    >
      {/* School avatar */}
      <div
        style={{
          width: 24,
          height: 24,
          borderRadius: "50%",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: G_GREEN,
          boxShadow: "0 2px 6px rgba(5,150,105,0.3)",
          fontSize: "0.6rem",
          fontWeight: 700,
          color: "#fff",
        }}
      >
        {(schoolLabel[0] || "S").toUpperCase()}
      </div>
      <div style={{ maxWidth: "75%", position: "relative" }}>
        <p
          style={{
            fontSize: "0.66rem",
            fontWeight: 600,
            color: "#059669",
            marginBottom: 2,
            paddingLeft: 4,
          }}
        >
          {schoolLabel}
        </p>
        <div
          style={{
            padding: "7px 11px",
            borderRadius: "14px 14px 14px 3px",
            background: G_GREEN,
            color: "#fff",
            boxShadow: "0 3px 10px rgba(5,150,105,0.25)",
            opacity: msg.isSending ? 0.6 : 1,
          }}
        >
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
                <AttachmentItem
                  key={att._id || att.fileId || i}
                  att={att}
                  token={token}
                />
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
};

// ══════════════════════════════════════════════════════════════════════════════
// NEEDS REPLY MODE
// ══════════════════════════════════════════════════════════════════════════════
function useNeedsReplyMode() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);
  return now;
}

// ══════════════════════════════════════════════════════════════════════════════
// ESCALATION TOASTS — matches AdminPartnerSupport exactly
// ══════════════════════════════════════════════════════════════════════════════
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
        @keyframes sa-slideInRight {
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
            animation:
              "sa-slideInRight 0.4s cubic-bezier(0.34,1.56,0.64,1) both",
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
            <Hourglass style={{ color: "#fff", width: 13, height: 13 }} />
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
              ⚠️ School ticket needs response
            </p>
            <p
              style={{
                fontSize: "0.7rem",
                color: "#b45309",
                margin: "0 0 1px",
                fontWeight: 600,
              }}
            >
              {t.schoolName}
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
            <X style={{ width: 10, height: 10 }} />
          </button>
        </div>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// NOTIFICATION BELL — matches AdminPartnerSupport exactly
// ══════════════════════════════════════════════════════════════════════════════
function NotificationBell({ unreadCount, needsReplyCount, onClick }) {
  const totalCount = (unreadCount || 0) + (needsReplyCount || 0);
  const active = totalCount > 0;
  const isGreen = needsReplyCount > 0;

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
        @keyframes sa-bell-ring {
          0%,100%{transform:rotate(0deg);}15%{transform:rotate(15deg);}
          30%{transform:rotate(-12deg);}45%{transform:rotate(10deg);}
          60%{transform:rotate(-8deg);}75%{transform:rotate(5deg);}
        }
        @keyframes sa-badge-pop {
          0%{transform:scale(0.5);opacity:0;}70%{transform:scale(1.2);}100%{transform:scale(1);opacity:1;}
        }
        @keyframes sa-bell-pulse-green {
          0%{box-shadow:0 0 0 0 rgba(16,185,129,0.5);}
          70%{box-shadow:0 0 0 8px rgba(16,185,129,0);}
          100%{box-shadow:0 0 0 0 rgba(16,185,129,0);}
        }
        @keyframes sa-bell-pulse-indigo {
          0%{box-shadow:0 0 0 0 rgba(99,102,241,0.5);}
          70%{box-shadow:0 0 0 8px rgba(99,102,241,0);}
          100%{box-shadow:0 0 0 0 rgba(99,102,241,0);}
        }
        .sa-bell-icon-wrap{animation:${ring ? "sa-bell-ring 0.8s ease-in-out" : "none"};transform-origin:top center;display:inline-block;}
        .sa-bell-badge-anim{animation:sa-badge-pop 0.35s cubic-bezier(.34,1.56,.64,1) both;}
      `}</style>
      <button
        onClick={onClick}
        title={
          needsReplyCount > 0
            ? `${needsReplyCount} need reply · ${unreadCount} unread`
            : unreadCount > 0
              ? `${unreadCount} unread`
              : "No notifications"
        }
        style={{
          position: "relative",
          width: 38,
          height: 38,
          borderRadius: "50%",
          border: "none",
          background: active
            ? isGreen
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
            ? isGreen
              ? "0 4px 14px rgba(16,185,129,0.4)"
              : "0 4px 14px rgba(99,102,241,0.4)"
            : "none",
          animation: active
            ? isGreen
              ? "sa-bell-pulse-green 1.5s ease infinite"
              : "sa-bell-pulse-indigo 1.5s ease infinite"
            : "none",
        }}
      >
        <span className="sa-bell-icon-wrap">
          <Bell
            style={{
              width: 14,
              height: 14,
              color: active ? "#fff" : "#9ca3af",
            }}
          />
        </span>
        {totalCount > 0 && (
          <span
            className="sa-bell-badge-anim"
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

// ══════════════════════════════════════════════════════════════════════════════
// NEEDS REPLY BANNER — matches AdminPartnerSupport exactly
// ══════════════════════════════════════════════════════════════════════════════
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
        marginBottom: 16,
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
          <AlertTriangle style={{ color: "#fff", width: 13, height: 13 }} />
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

// ══════════════════════════════════════════════════════════════════════════════
// STATUS DROPDOWN — matches AdminPartnerSupport StatusDropdown
// ══════════════════════════════════════════════════════════════════════════════
function StatusDropdown({ value, onChange, disabled }) {
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
        onClick={() => !disabled && setOpen((o) => !o)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "5px 10px",
          borderRadius: 8,
          border: "1px solid rgba(255,255,255,0.35)",
          background: "rgba(255,255,255,0.15)",
          color: "#fff",
          fontWeight: 700,
          fontSize: "0.7rem",
          cursor: disabled ? "not-allowed" : "pointer",
          whiteSpace: "nowrap",
          fontFamily: "inherit",
          opacity: disabled ? 0.7 : 1,
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
            boxShadow: "0 0 0 2px rgba(255,255,255,0.3)",
          }}
        />
        {current.label}
        {disabled ? (
          <Loader2
            style={{ width: 8, height: 8, opacity: 0.75 }}
            className="animate-spin"
          />
        ) : (
          <ChevronDown
            style={{
              width: 8,
              height: 8,
              opacity: 0.75,
              transition: "transform 0.2s",
              transform: open ? "rotate(180deg)" : "rotate(0deg)",
            }}
          />
        )}
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

// ══════════════════════════════════════════════════════════════════════════════
// PAGINATION — matches AdminPartnerSupport Pagination exactly
// ══════════════════════════════════════════════════════════════════════════════
function Pagination({ currentPage, totalPages, onPageChange }) {
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
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
const SchoolAdminSupport = () => {
  const [tickets, setTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [messages, setMessages] = useState({});
  const [messageInput, setMessageInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [replyingTo, setReplyingTo] = useState(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [showFilters, setShowFilters] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    open: 0,
    inProgress: 0,
    resolved: 0,
    urgent: 0,
    unreadMessages: 0,
    escalated: 0,
  });
  const page = 1;
  const [ticketDetails, setTicketDetails] = useState(null);
  const [showTicketDetails, setShowTicketDetails] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [activeTab, setActiveTab] = useState("all");
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [filterFocused, setFilterFocused] = useState(false);

  const [escalationToasts, setEscalationToasts] = useState([]);
  const [needsReplyBannerDismissed, setNeedsReplyBannerDismissed] =
    useState(false);

  // pagination state for ticket list
  const [listPage, setListPage] = useState(1);
  const [isListening, setIsListening] = useState(false);

  const messagesEndRef = useRef(null);
  const socketRef = useRef(null);
  const selectedTicketRef = useRef(null);
  const loadStatsRef = useRef(null);
  const markMessagesAsReadRef = useRef(null);
  const recognitionRef = useRef(null);

  const token = getToken();
  const user = getUser();

  useEffect(() => {
    selectedTicketRef.current = selectedTicket;
  }, [selectedTicket]);

  const needsReplyNow = useNeedsReplyMode();
  const needsReplyTotal = tickets.filter((t) =>
    isNeedsReplyTicket(t, needsReplyNow),
  ).length;
  const urgentCount = tickets.filter((t) => isActiveUrgent(t)).length;
  const bellUnread = tickets.filter((t) => t.unread).length;

  const prevEscRef = useRef(0);
  useEffect(() => {
    if (needsReplyTotal > prevEscRef.current)
      setNeedsReplyBannerDismissed(false);
    prevEscRef.current = needsReplyTotal;
  }, [needsReplyTotal]);

  useEffect(() => {
    requestNotificationPermission();
  }, []);

  const scrollToBottom = () =>
    setTimeout(
      () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }),
      100,
    );

  const addEscalationToast = useCallback((data) => {
    const id = `sa-toast-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    setEscalationToasts((prev) => [...prev.slice(-2), { id, ...data }]);
    setTimeout(() => {
      setEscalationToasts((prev) => prev.filter((t) => t.id !== id));
    }, 12000);
  }, []);

  const dismissToast = useCallback((id) => {
    setEscalationToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // ── Socket ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!token) {
      setApiError("No authentication token found.");
      return;
    }
    if (socketRef.current) socketRef.current.disconnect();
    socketRef.current = io(SOCKET_URL, {
      auth: { token, role: "admin" },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
    socketRef.current.on("connect", () => {
      setSocketConnected(true);
      setApiError(null);
      socketRef.current.emit("join_admin_room");
      loadStatsRef.current?.();
    });
    socketRef.current.on("connect_error", (err) => {
      setSocketConnected(false);
      setApiError(`Socket error: ${err.message}`);
    });
    socketRef.current.on("disconnect", () => setSocketConnected(false));
    socketRef.current.on("new_message", handleNewMessage);
    socketRef.current.on("ticket_status_update", handleTicketStatusUpdate);
    socketRef.current.on("ticket_assigned", handleTicketAssigned);
    socketRef.current.on("messages_read", handleMessagesRead);
    socketRef.current.on("new_ticket", handleNewTicket);
    socketRef.current.on("ticket_escalated", (d) => {
      if (d.message)
        setMessages((prev) => ({
          ...prev,
          [d.ticketId]: dedupMessages([...(prev[d.ticketId] || []), d.message]),
        }));
      if (d.ticket)
        setTickets((prev) =>
          sortTicketsNewest(
            prev.map((t) => (t._id === d.ticketId ? { ...t, ...d.ticket } : t)),
          ),
        );
      loadStatsRef.current?.();
    });
    socketRef.current.on("message_deleted", ({ messageId, ticketId }) => {
      setMessages((prev) => ({
        ...prev,
        [ticketId]: (prev[ticketId] || []).filter((m) => m._id !== messageId),
      }));
    });
    socketRef.current.on("ticket_auto_escalated", (data) => {
      const {
        ticketId,
        schoolName,
        subject,
        hoursWaiting,
        escalationCount,
        message,
      } = data;
      if (!ticketId) return;
      const nameLabel = schoolName || "School Admin";
      addEscalationToast({
        ticketId,
        schoolName: nameLabel,
        subject,
        hoursWaiting,
        escalationCount,
      });
      setTickets((q) => {
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
      if (selectedTicketRef.current?._id === ticketId) {
        setSelectedTicket((q) =>
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
            [ticketId]: dedupMessages([...(prev[ticketId] || []), message]),
          };
        });
      }
      loadStatsRef.current?.();
      sendDesktopNotification(
        `⚠️ School ticket needs response — ${nameLabel}`,
        `Needs reply • ${subject}`,
        `escalate-school-${ticketId}`,
      );
    });
    socketRef.current.on("ticket_escalation_resolved", ({ ticketId }) => {
      if (!ticketId) return;
      setTickets((q) =>
        q.map((t) => (t._id === ticketId ? { ...t, autoEscalated: false } : t)),
      );
      if (selectedTicketRef.current?._id === ticketId) {
        setSelectedTicket((q) => (q ? { ...q, autoEscalated: false } : q));
      }
    });
    socketRef.current.on("ticket_status_update", ({ ticketId, status }) => {
      setTickets((p) =>
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
      if (selectedTicketRef.current?._id === ticketId) {
        setSelectedTicket((p) =>
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
      }
    });
    return () => socketRef.current?.disconnect();
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    if (socketRef.current?.connected && selectedTicket)
      socketRef.current.emit("join_ticket", selectedTicket._id);
    return () => {
      if (selectedTicket && socketRef.current?.connected)
        socketRef.current.emit("leave_ticket", selectedTicket._id);
    };
  }, [selectedTicket]);

  useEffect(
    () => {
      loadTickets();
    },
    // eslint-disable-next-line
    [page, filterStatus, filterPriority, filterCategory, sortBy, searchTerm],
  );

  useEffect(() => {
    if (socketConnected) return;
    const id = setInterval(() => {
      if (selectedTicketRef.current)
        loadMessages(selectedTicketRef.current._id, false);
      loadTickets();
      loadStats();
    }, 5000);
    return () => clearInterval(id);
    // eslint-disable-next-line
  }, [socketConnected]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, selectedTicket]);

  // ── Socket handlers ────────────────────────────────────────────────────────
  const handleNewMessage = useCallback((data) => {
    const { ticketId, message } = data;
    if (!ticketId || !message) return;
    const isSel = selectedTicketRef.current?._id === ticketId;
    setMessages((prev) => {
      const ex = prev[ticketId] || [];
      if (ex.some((m) => m._id === message._id)) return prev;
      return { ...prev, [ticketId]: dedupMessages([...ex, message]) };
    });
    setTickets((prev) => {
      const updated = prev.map((t) => {
        if (t._id !== ticketId) return t;
        if (message.senderRole === "school-admin") {
          if (isSel) {
            markMessagesAsReadRef.current?.(ticketId);
            return {
              ...t,
              lastMessage: message.text,
              lastMessageTime: message.createdAt,
              lastMessageSender: message.senderRole,
              unread: false,
              unreadCount: 0,
            };
          }
          return {
            ...t,
            lastMessage: message.text,
            lastMessageTime: message.createdAt,
            lastMessageSender: message.senderRole,
            unread: true,
            unreadCount: (t.unreadCount || 0) + 1,
          };
        }
        if (message.senderRole === "admin")
          return {
            ...t,
            lastMessage: message.text,
            lastMessageTime: message.createdAt,
            lastMessageSender: message.senderRole,
            autoEscalated: false,
          };
        return {
          ...t,
          lastMessage: message.text,
          lastMessageTime: message.createdAt,
          lastMessageSender: message.senderRole,
        };
      });
      return sortTicketsNewest(updated);
    });
    if (isSel) {
      setSelectedTicket((prev) =>
        prev
          ? {
              ...prev,
              lastMessage: message.text || prev.lastMessage,
              lastMessageTime: message.createdAt,
              lastMessageSender: message.senderRole,
              autoEscalated:
                message.senderRole === "admin" ? false : prev.autoEscalated,
            }
          : prev,
      );
    }
    if (isSel) setTimeout(scrollToBottom, 100);
    loadStatsRef.current?.();
  }, []);

  const handleNewTicket = useCallback((data) => {
    const { ticket } = data;
    if (!ticket || !ticket.raisedBySchoolAdmin) return;
    setTickets((prev) =>
      prev.some((t) => t._id === ticket._id)
        ? prev
        : sortTicketsNewest([ticket, ...prev]),
    );
    loadStatsRef.current?.();
  }, []);

  const handleTicketStatusUpdate = useCallback((data) => {
    const { ticketId, status, message } = data;
    setTickets((prev) =>
      sortTicketsNewest(
        prev.map((t) =>
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
      ),
    );
    setSelectedTicket((prev) => {
      if (!prev || prev._id !== ticketId) return prev;
      return {
        ...prev,
        status,
        autoEscalated: ["resolved", "closed"].includes(status)
          ? false
          : prev.autoEscalated,
      };
    });
    if (message)
      setMessages((prev) => ({
        ...prev,
        [ticketId]: dedupMessages([...(prev[ticketId] || []), message]),
      }));
    loadStatsRef.current?.();
  }, []);

  const handleTicketAssigned = useCallback((data) => {
    const { ticketId, assignedTo, message } = data;
    setTickets((prev) =>
      prev.map((t) => (t._id === ticketId ? { ...t, assignedTo } : t)),
    );
    setSelectedTicket((prev) => {
      if (!prev || prev._id !== ticketId) return prev;
      return { ...prev, assignedTo };
    });
    if (message)
      setMessages((prev) => ({
        ...prev,
        [ticketId]: dedupMessages([...(prev[ticketId] || []), message]),
      }));
  }, []);

  const handleMessagesRead = useCallback((data) => {
    const { ticketId } = data;
    setTickets((prev) =>
      prev.map((t) =>
        t._id === ticketId ? { ...t, unread: false, unreadCount: 0 } : t,
      ),
    );
    setSelectedTicket((prev) => {
      if (!prev || prev._id !== ticketId) return prev;
      return { ...prev, unread: false, unreadCount: 0 };
    });
    loadStatsRef.current?.();
  }, []);

  // ── API ────────────────────────────────────────────────────────────────────
  const loadTickets = async () => {
    try {
      if (!token) {
        setApiError("No auth token");
        return;
      }
      const params = new URLSearchParams({
        page,
        limit: 200,
        status: filterStatus !== "all" ? filterStatus : "",
        priority: filterPriority !== "all" ? filterPriority : "",
        category: filterCategory !== "all" ? filterCategory : "",
        sort: sortBy,
        search: searchTerm,
      });
      const res = await axios.get(`${API_URL}/tickets?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const rawTickets = res.data.tickets || [];
      setTickets(
        sortBy === "newest" ? sortTicketsNewest(rawTickets) : rawTickets,
      );
      setApiError(null);
      loadStats();
    } catch (err) {
      if (err.response?.status === 401)
        setApiError("Unauthorized — please log in again");
      else if (err.response?.status === 403)
        setApiError(`Forbidden: ${err.response.data?.message || "no access"}`);
      else setApiError("Failed to load tickets.");
    }
  };

  const loadStats = async () => {
    try {
      if (!token) return;
      const res = await axios.get(`${API_URL}/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setStats(res.data.stats || {});
    } catch (err) {
      console.error("loadStats:", err);
    }
  };
  useEffect(() => {
    loadStatsRef.current = loadStats;
  });

  const markMessagesAsRead = async (ticketId) => {
    try {
      if (!token) return;
      setTickets((prev) =>
        prev.map((t) =>
          t._id === ticketId ? { ...t, unread: false, unreadCount: 0 } : t,
        ),
      );
      setSelectedTicket((prev) => {
        if (!prev || prev._id !== ticketId) return prev;
        return { ...prev, unread: false, unreadCount: 0 };
      });
      await axios.post(
        `${API_URL}/mark-read/${ticketId}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      );
      loadStatsRef.current?.();
    } catch (err) {
      console.error("markMessagesAsRead:", err);
    }
  };
  useEffect(() => {
    markMessagesAsReadRef.current = markMessagesAsRead;
  });

  const loadMessages = async (ticketId, showLoading = true) => {
    try {
      if (!token) return;
      if (showLoading) setLoading(true);
      const res = await axios.get(`${API_URL}/messages/${ticketId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMessages((prev) => ({
        ...prev,
        [ticketId]: dedupMessages(res.data.messages || []),
      }));
      await markMessagesAsRead(ticketId);
      scrollToBottom();
    } catch (err) {
      console.error("loadMessages:", err);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const handleSelectTicket = (ticket) => {
    setSelectedTicket(ticket);
    setTickets((prev) =>
      prev.map((t) =>
        t._id === ticket._id ? { ...t, unread: false, unreadCount: 0 } : t,
      ),
    );
    loadMessages(ticket._id);
  };

  const handleSendMessage = async () => {
    if (
      (!messageInput.trim() && attachments.length === 0) ||
      !selectedTicket ||
      sendingMessage
    )
      return;
    setSendingMessage(true);
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const messageText = messageInput;
    const now = new Date().toISOString();
    const tempMessage = {
      _id: tempId,
      text: messageText,
      senderName: user?.name || "Main Admin",
      senderRole: "admin",
      createdAt: now,
      read: true,
      isSending: true,
      attachments: attachments.map((a) => ({
        filename: a.name,
        size: a.size,
        mimetype: a.type,
        type: a.type,
      })),
      replyTo: replyingTo,
    };
    setMessages((prev) => ({
      ...prev,
      [selectedTicket._id]: dedupMessages([
        ...(prev[selectedTicket._id] || []),
        tempMessage,
      ]),
    }));
    setTickets((prev) =>
      sortTicketsNewest(
        prev.map((t) =>
          t._id === selectedTicket._id
            ? {
                ...t,
                lastMessage: messageText,
                lastMessageTime: now,
                lastMessageSender: "admin",
                autoEscalated: false,
              }
            : t,
        ),
      ),
    );
    if (selectedTicketRef.current?._id === selectedTicket._id) {
      setSelectedTicket((q) =>
        q
          ? {
              ...q,
              lastMessage: messageText,
              lastMessageTime: now,
              lastMessageSender: "admin",
              autoEscalated: false,
            }
          : q,
      );
    }
    setMessageInput("");
    const snap = [...attachments];
    setAttachments([]);
    setReplyingTo(null);
    scrollToBottom();
    try {
      if (!token) return;
      const form = new FormData();
      form.append("text", messageText);
      if (replyingTo) form.append("replyTo", replyingTo._id || "");
      snap.forEach((a) => {
        if (a.file) form.append("files", a.file);
      });
      const res = await axios.post(
        `${API_URL}/message/${selectedTicket._id}`,
        form,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
        },
      );
      setMessages((prev) => {
        const updated = (prev[selectedTicket._id] || []).map((m) =>
          m._id === tempId ? res.data.message : m,
        );
        return { ...prev, [selectedTicket._id]: dedupMessages(updated) };
      });
      setTickets((prev) =>
        sortTicketsNewest(
          prev.map((t) =>
            t._id === selectedTicket._id
              ? {
                  ...t,
                  lastMessage: messageText || (snap[0]?.name ?? ""),
                  lastMessageTime: res.data.message.createdAt,
                  lastMessageSender: "admin",
                }
              : t,
          ),
        ),
      );
      scrollToBottom();
    } catch (err) {
      setMessages((prev) => ({
        ...prev,
        [selectedTicket._id]: (prev[selectedTicket._id] || []).filter(
          (m) => m._id !== tempId,
        ),
      }));
      alert("Failed to send: " + (err.response?.data?.message || err.message));
    } finally {
      setSendingMessage(false);
    }
  };

  const handleUpdateTicketStatus = async (ticketId, status) => {
    if (statusUpdating) return;
    setStatusUpdating(true);
    const isClosing = ["resolved", "closed"].includes(status);
    setTickets((prev) =>
      sortTicketsNewest(
        prev.map((t) =>
          t._id === ticketId
            ? {
                ...t,
                status,
                autoEscalated: isClosing ? false : t.autoEscalated,
              }
            : t,
        ),
      ),
    );
    setSelectedTicket((prev) => {
      if (!prev || prev._id !== ticketId) return prev;
      return {
        ...prev,
        status,
        autoEscalated: isClosing ? false : prev.autoEscalated,
      };
    });
    try {
      if (!token) return;
      const res = await axios.put(
        `${API_URL}/ticket/${ticketId}/status`,
        { status },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (res.data.ticket) {
        setTickets((prev) =>
          sortTicketsNewest(
            prev.map((t) =>
              t._id === ticketId ? { ...t, ...res.data.ticket } : t,
            ),
          ),
        );
        setSelectedTicket((prev) => {
          if (!prev || prev._id !== ticketId) return prev;
          return { ...prev, ...res.data.ticket };
        });
      }
      if (res.data.systemMessage) {
        setMessages((prev) => ({
          ...prev,
          [ticketId]: dedupMessages([
            ...(prev[ticketId] || []),
            res.data.systemMessage,
          ]),
        }));
      }
      loadStatsRef.current?.();
    } catch (err) {
      loadTickets();
      alert(
        "Failed to update status: " +
          (err.response?.data?.message || err.message),
      );
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleAssignToMe = async (ticketId) => {
    try {
      if (!token) return;
      const res = await axios.put(
        `${API_URL}/ticket/${ticketId}/assign`,
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setTickets((prev) =>
        prev.map((t) =>
          t._id === ticketId
            ? { ...t, assignedTo: res.data.ticket.assignedTo }
            : t,
        ),
      );
      setSelectedTicket((prev) => {
        if (!prev || prev._id !== ticketId) return prev;
        return { ...prev, assignedTo: res.data.ticket.assignedTo };
      });
      if (res.data.systemMessage)
        setMessages((prev) => ({
          ...prev,
          [ticketId]: dedupMessages([
            ...(prev[ticketId] || []),
            res.data.systemMessage,
          ]),
        }));
    } catch (err) {
      alert("Failed to assign ticket");
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      if (!token) return;
      await axios.delete(`${API_URL}/message/${deleteTarget}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (selectedTicketRef.current)
        setMessages((prev) => ({
          ...prev,
          [selectedTicketRef.current._id]: (
            prev[selectedTicketRef.current._id] || []
          ).filter((m) => m._id !== deleteTarget),
        }));
      setDeleteTarget(null);
    } catch (err) {
      alert("Failed to delete message");
    } finally {
      setDeleteLoading(false);
    }
  };

  const pickFiles = (e) => {
    const files = Array.from(e.target.files);
    if (attachments.length + files.length > 5) {
      alert("Max 5 files per message");
      return;
    }
    setAttachments((prev) => [
      ...prev,
      ...files.map((f) => ({
        id: `att-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: f.name,
        size: f.size,
        type: f.type,
        file: f,
      })),
    ]);
    e.target.value = "";
  };

  // ── Derived ────────────────────────────────────────────────────────────────
  const getPriorityColor = (p) =>
    PRIORITIES.find((pr) => pr.id === p?.toLowerCase())?.color ||
    "bg-gray-100 text-gray-800";
  const getStatusColor = (s) =>
    STATUSES.find((st) => st.id === s?.toLowerCase())?.color ||
    "bg-gray-100 text-gray-800";

  const unreadCount = bellUnread;
  const openCount = tickets.filter((t) => t.status === "open").length;
  const inProgressCount = tickets.filter(
    (t) => t.status === "in-progress",
  ).length;
  const resolvedCount = tickets.filter(
    (t) => t.status === "resolved" || t.status === "closed",
  ).length;

  // ── Tabs (matches AdminPartnerSupport TABS exactly) ────────────────────────
  const TABS = [
    { id: "all", label: "All", badge: tickets.length },
    {
      id: "needs-reply",
      label: "Needs Reply",
      badge: needsReplyTotal,
      isNeedsReply: true,
    },
    { id: "unread", label: "Unread", badge: unreadCount },
    { id: "urgent", label: "Urgent", badge: urgentCount, isUrgent: true },
    { id: "open", label: "Open", badge: openCount },
    { id: "in-progress", label: "In Progress", badge: inProgressCount },
    { id: "resolved", label: "Resolved", badge: resolvedCount },
  ];

  const filteredTickets = tickets.filter((t) => {
    if (activeTab === "all") return true;
    if (activeTab === "needs-reply")
      return isNeedsReplyTicket(t, needsReplyNow);
    if (activeTab === "unread") return t.unread;
    if (activeTab === "urgent") return isActiveUrgent(t);
    if (activeTab === "open") return t.status === "open";
    if (activeTab === "in-progress") return t.status === "in-progress";
    if (activeTab === "resolved")
      return t.status === "resolved" || t.status === "closed";
    return true;
  });

  // client-side pagination for ticket list
  const listTotalPages = Math.max(
    1,
    Math.ceil(filteredTickets.length / TICKETS_PER_PAGE),
  );
  const safeListPage = Math.min(listPage, listTotalPages);
  const pagedTickets = filteredTickets.slice(
    (safeListPage - 1) * TICKETS_PER_PAGE,
    safeListPage * TICKETS_PER_PAGE,
  );

  const handleBellClick = useCallback(() => {
    if (needsReplyTotal > 0) setActiveTab("needs-reply");
    else if (unreadCount > 0) setActiveTab("unread");
  }, [needsReplyTotal, unreadCount]);

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

  // reset list page on tab change
  useEffect(() => {
    setListPage(1);
  }, [activeTab]);

  // ── stat cards (matches AdminPartnerSupport CARDS) ─────────────────────────
  const CARDS = [
    {
      label: "Total",
      value: stats.total,
      icon: <Inbox style={{ width: 16, height: 16 }} />,
      bg: "bg-indigo-50",
      txt: "text-indigo-600",
    },
    {
      label: "Open",
      value: stats.open,
      icon: <Clock style={{ width: 16, height: 16 }} />,
      bg: "bg-emerald-50",
      txt: "text-emerald-600",
    },
    {
      label: "In Progress",
      value: stats.inProgress,
      icon: <Hourglass style={{ width: 16, height: 16 }} />,
      bg: "bg-amber-50",
      txt: "text-amber-600",
    },
    {
      label: "Resolved",
      value: stats.resolved,
      icon: <CheckCircle style={{ width: 16, height: 16 }} />,
      bg: "bg-violet-50",
      txt: "text-violet-600",
    },
    {
      label: "Needs Reply",
      value: needsReplyTotal,
      icon: <Hourglass style={{ width: 16, height: 16 }} />,
      bg: "bg-blue-50",
      txt: "text-blue-600",
    },
    {
      label: "Urgent",
      value: urgentCount,
      icon: <AlertCircle style={{ width: 16, height: 16 }} />,
      bg: "bg-red-50",
      txt: "text-red-600",
    },
  ];

  // ── Render ─────────────────────────────────────────────────────────────────
  const accent = "#6366f1";
  const selectedNeedsReply = isNeedsReplyTicket(selectedTicket, needsReplyNow);

  return (
    <div className="min-h-screen bg-gray-50" style={{ padding: "24px" }}>
      <style>{`
        @keyframes sa-ping {
          0%,100% { box-shadow:0 0 0 0 rgba(99,102,241,0.5); }
          50%      { box-shadow:0 0 0 4px rgba(99,102,241,0); }
        }
        @keyframes sa-ping-blue {
          0%,100% { box-shadow:0 0 0 0 rgba(59,130,246,0.5); }
          50%      { box-shadow:0 0 0 4px rgba(59,130,246,0); }
        }
        @keyframes sa-ping-red {
          0%,100% { box-shadow:0 0 0 0 rgba(239,68,68,0.5); }
          50%      { box-shadow:0 0 0 4px rgba(239,68,68,0); }
        }
        .sa-ping      { animation:sa-ping 1.5s cubic-bezier(0,0,0.2,1) infinite; }
        .sa-ping-blue { animation:sa-ping-blue 1.5s cubic-bezier(0,0,0.2,1) infinite; }
        .sa-ping-red  { animation:sa-ping-red 1.5s cubic-bezier(0,0,0.2,1) infinite; }
      `}</style>

      <EscalationToasts toasts={escalationToasts} onDismiss={dismissToast} />
      {deleteTarget && (
        <DeleteModal
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
          loading={deleteLoading}
        />
      )}

      <div style={{ maxWidth: "100%", margin: "0 auto" }}>
        {/* ── Header (matches AdminPartnerSupport) ── */}
        <div className="mb-4 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1
              className="font-bold text-gray-900 flex items-center gap-2"
              style={{ fontSize: "1.4rem" }}
            >
              <School style={{ color: "#6366f1", width: 18, height: 18 }} />
              School Admin Support
            </h1>
            <p className="text-gray-500 text-sm mt-0.5">
              Support tickets raised by school admins about the platform
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {needsReplyTotal > 0 && (
              <div
                className="flex items-center px-2 py-1 rounded-lg border cursor-pointer"
                style={{
                  color: "#1e40af",
                  background: "#eff6ff",
                  borderColor: "#3b82f6",
                }}
                onClick={() => setActiveTab("needs-reply")}
              >
                <Hourglass style={{ width: 10, height: 10, marginRight: 4 }} />
                <span style={{ fontSize: "0.72rem", fontWeight: 600 }}>
                  {needsReplyTotal} need reply
                </span>
              </div>
            )}
            {urgentCount > 0 && (
              <div className="flex items-center text-red-700 bg-red-50 px-2 py-1 rounded-lg border border-red-200">
                <Zap style={{ width: 10, height: 10, marginRight: 4 }} />
                <span style={{ fontSize: "0.72rem", fontWeight: 600 }}>
                  {urgentCount}
                </span>
              </div>
            )}
            {apiError && (
              <div className="flex items-center text-red-600 bg-red-50 px-2 py-1 rounded-lg border border-red-200">
                <AlertTriangle
                  style={{
                    width: 10,
                    height: 10,
                    marginRight: 4,
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: "0.72rem" }}>{apiError}</span>
              </div>
            )}
            <button
              onClick={loadTickets}
              className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
              title="Refresh"
            >
              <RefreshCw style={{ width: 14, height: 14 }} />
            </button>
            <div
              className={`flex items-center px-2.5 py-1 rounded-full border text-xs ${
                socketConnected
                  ? "text-green-600 bg-green-50 border-green-200"
                  : "text-yellow-600 bg-yellow-50 border-yellow-200"
              }`}
            >
              {socketConnected ? (
                <>
                  <div className="w-1.5 h-1.5 bg-green-600 rounded-full mr-1.5 animate-pulse" />
                  Live
                </>
              ) : (
                <>
                  <Loader2
                    style={{ width: 10, height: 10, marginRight: 6 }}
                    className="animate-spin"
                  />
                  Connecting…
                </>
              )}
            </div>
          </div>
        </div>

        {/* ── Stat Cards (matches AdminPartnerSupport) ── */}
        {/*Change template columns from 6 to 3, change gap from 12 to 8 for mobile view alignment - 06-08-2026 */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3,1fr)",
            gap: 8,
            marginBottom: 16,
          }}
        >
          {CARDS.map(({ label, value, icon, bg, txt }) => (
            <div
              key={label}
              className={`bg-white rounded-xl border border-gray-200 hover:shadow-sm transition-shadow`}
              style={{ padding: "12px" }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p
                    className="text-gray-400 leading-tight"
                    style={{ fontSize: "0.72rem" }}
                  >
                    {label}
                  </p>
                  <p
                    className={`font-bold leading-tight mt-0.5 ${txt}`}
                    style={{ fontSize: "1.2rem" }}
                  >
                    {value ?? 0}
                  </p>
                </div>
                <div
                  className={`${bg} rounded-lg ${txt}`}
                  style={{ padding: "7px" }}
                >
                  {icon}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Needs Reply Banner ── */}
        {needsReplyTotal > 0 && !needsReplyBannerDismissed && (
          <NeedsReplyBanner
            count={needsReplyTotal}
            onViewAll={() => {
              setActiveTab("needs-reply");
              setNeedsReplyBannerDismissed(true);
            }}
          />
        )}

        {/* ── Search + Filters + Bell (matches AdminPartnerSupport SearchFilterBar) ── */}
        <div
          className="bg-white rounded-xl border border-gray-200 mb-4"
          style={{ padding: "12px 20px" }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "nowrap",
            }}
          >
            {/* Search */}
            <div
              style={{
                flex: 1,
                minWidth: 0,
                display: "flex",
                alignItems: "center",
                gap: 8,
                height: 38,
                background: "#fff",
                border: filterFocused
                  ? `1.5px solid ${accent}`
                  : "1.5px solid #d1d5db",
                borderRadius: 8,
                padding: "0 12px",
                boxShadow: filterFocused
                  ? `0 0 0 3px rgba(99,102,241,0.08)`
                  : "none",
                transition: "border-color 0.18s,box-shadow 0.18s",
              }}
            >
              <Search
                style={{
                  color: filterFocused ? accent : "#9ca3af",
                  width: 12,
                  height: 12,
                  flexShrink: 0,
                }}
              />
              {/*Add marginTop: "0px" for alignment - 06-08-2026 */}
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onFocus={() => setFilterFocused(true)}
                onBlur={() => setFilterFocused(false)}
                placeholder="Search school, subject…"
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
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
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
                  <X style={{ color: "#9ca3af", width: 10, height: 10 }} />
                </button>
              )}
            </div>

            {/* Filters toggle */}
            <button
              onClick={() => setShowFilters((o) => !o)}
              style={{
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                gap: 5,
                height: 38,
                padding: "0 12px",
                border: showFilters
                  ? `1.5px solid ${accent}`
                  : "1.5px solid #d1d5db",
                borderRadius: 8,
                background: showFilters ? `rgba(99,102,241,0.06)` : "#fff",
                color: showFilters ? accent : "#374151",
                fontWeight: 600,
                fontSize: "0.78rem",
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "all 0.18s",
                fontFamily: "inherit",
              }}
            >
              <Filter style={{ width: 10, height: 10 }} />
              <span>Filters</span>
              {showFilters ? (
                <ChevronDown
                  style={{ width: 8, height: 8, transform: "rotate(180deg)" }}
                />
              ) : (
                <ChevronDown style={{ width: 8, height: 8 }} />
              )}
            </button>

            {/* Sort */}
            <div style={{ position: "relative", flexShrink: 0 }}>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
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

            {/* Bell */}
            <NotificationBell
              unreadCount={bellUnread}
              needsReplyCount={needsReplyTotal}
              onClick={handleBellClick}
            />
          </div>

          {/* Filter dropdowns panel */}
          {showFilters && (
            <div style={{ overflow: "hidden", marginTop: 10 }}>
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
                    v: filterStatus,
                    set: setFilterStatus,
                    opts: [{ id: "all", name: "All Statuses" }, ...STATUSES],
                  },
                  {
                    label: "Priority",
                    v: filterPriority,
                    set: setFilterPriority,
                    opts: [
                      { id: "all", name: "All Priorities" },
                      ...PRIORITIES,
                    ],
                  },
                  {
                    label: "Category",
                    v: filterCategory,
                    set: setFilterCategory,
                    opts: [
                      { id: "all", name: "All Categories" },
                      ...CATEGORIES,
                    ],
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
                        fontFamily: "inherit",
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
                              ? `1.5px solid ${accent}`
                              : "1.5px solid #d1d5db",
                          borderRadius: 7,
                          background:
                            v !== "all" ? `rgba(99,102,241,0.06)` : "#fff",
                          color: v !== "all" ? accent : "#374151",
                          fontWeight: v !== "all" ? 600 : 400,
                          fontSize: "0.76rem",
                          cursor: "pointer",
                          outline: "none",
                          fontFamily: "inherit",
                        }}
                      >
                        {opts.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.name}
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

        {/* ── Main grid (1/3 list + 2/3 chat, matches AdminPartnerSupport) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* ── Ticket List ── */}
          <div className="lg:col-span-1">
            <div
              className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col"
              style={{ height: 580, display: "flex", flexDirection: "column" }}
            >
              {/* List header — matches AdminPartnerSupport TicketList header */}
              <div
                style={{
                  padding: "12px 12px 8px",
                  borderBottom: "1px solid #f3f4f6",
                  background: "linear-gradient(to right,#f5f3ff,#eef2ff)",
                }}
              >
                <h2
                  className="font-bold text-gray-800 mb-2"
                  style={{ fontSize: "0.88rem" }}
                >
                  School Tickets ({filteredTickets.length}
                  {filteredTickets.length !== tickets.length
                    ? ` / ${tickets.length}`
                    : ""}
                  )
                </h2>
                {/* Pill tabs — matches AdminPartnerSupport exactly */}
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
                  {TABS.map(({ id, label, badge, isUrgent, isNeedsReply }) => {
                    const isActive = activeTab === id;
                    const showUrgentRed = isUrgent && urgentCount > 0;
                    const showNeedsBadge = isNeedsReply && needsReplyTotal > 0;
                    const badgeBg = showUrgentRed
                      ? "linear-gradient(135deg,#ef4444,#dc2626)"
                      : showNeedsBadge
                        ? "linear-gradient(135deg,#10b981,#059669)"
                        : G_INDIGO;
                    return (
                      <button
                        key={id}
                        onClick={() => setActiveTab(id)}
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
                            : showNeedsBadge
                              ? "#059669"
                              : showUrgentRed
                                ? "#ef4444"
                                : "#64748b",
                          border: isActive ? "1px solid #e5e7eb" : "none",
                        }}
                      >
                        {isNeedsReply && (
                          <Hourglass
                            style={{ width: 6, height: 6, flexShrink: 0 }}
                          />
                        )}
                        {isUrgent && (
                          <Zap style={{ width: 6, height: 6, flexShrink: 0 }} />
                        )}
                        {label}
                        {(badge || 0) > 0 && (
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
                              background: badgeBg,
                              color: "#fff",
                            }}
                          >
                            {badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Ticket rows */}
              <div style={{ flex: 1, overflowY: "auto", maxHeight: 460 }}>
                {pagedTickets.length === 0 ? (
                  <div style={{ padding: "32px 16px", textAlign: "center" }}>
                    <div
                      style={{
                        width: 48,
                        height: 48,
                        margin: "0 auto 12px",
                        background: "#eef2ff",
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Headphones
                        style={{ width: 24, height: 24, color: "#a5b4fc" }}
                      />
                    </div>
                    <p style={{ fontSize: "0.78rem", color: "#9ca3af" }}>
                      {activeTab === "urgent"
                        ? "No active urgent tickets"
                        : activeTab === "needs-reply"
                          ? "No tickets waiting — great job! 🎉"
                          : "No tickets found"}
                    </p>
                    {apiError && (
                      <p
                        style={{
                          fontSize: "0.7rem",
                          color: "#f87171",
                          marginTop: 4,
                        }}
                      >
                        {apiError}
                      </p>
                    )}
                  </div>
                ) : (
                  <div style={{ borderTop: "1px solid #f3f4f6" }}>
                    {pagedTickets.map((ticket) => {
                      const isAutoEsc = isNeedsReplyTicket(
                        ticket,
                        needsReplyNow,
                      );
                      const isUrgentT = isActiveUrgent(ticket);
                      const isSel = selectedTicket?._id === ticket._id;
                      const hasUnread =
                        ticket.unread && (ticket.unreadCount || 0) > 0;
                      const schoolName =
                        ticket.school ||
                        ticket.schoolAdminName ||
                        "School Admin";

                      return (
                        <div
                          key={ticket._id}
                          onClick={() => handleSelectTicket(ticket)}
                          style={{
                            borderLeft: isSel
                              ? `4px solid ${isAutoEsc ? "#3b82f6" : accent}`
                              : isAutoEsc
                                ? "4px solid #93c5fd"
                                : isUrgentT
                                  ? "4px solid #ef4444"
                                  : hasUnread
                                    ? `4px solid ${accent}`
                                    : "4px solid transparent",
                            background:
                              isAutoEsc && !isSel
                                ? "linear-gradient(to right,#eff6ff,#fff)"
                                : hasUnread && !isSel
                                  ? "#eff6ff40"
                                  : undefined,
                            borderBottom: "1px solid #f3f4f6",
                            transition: "background 0.15s,border-color 0.15s",
                          }}
                        >
                          <div
                            className={`p-3 cursor-pointer transition-all hover:bg-gray-50 ${
                              isSel
                                ? isAutoEsc
                                  ? "bg-blue-50"
                                  : "bg-indigo-50"
                                : ""
                            }`}
                          >
                            {/* Row top */}
                            <div
                              style={{
                                display: "flex",
                                alignItems: "flex-start",
                                justifyContent: "space-between",
                                marginBottom: 6,
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 8,
                                }}
                              >
                                {/* Avatar */}
                                <div
                                  style={{
                                    position: "relative",
                                    width: 32,
                                    height: 32,
                                    borderRadius: "50%",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    background: G_GREEN,
                                    fontSize: "0.7rem",
                                    fontWeight: 700,
                                    color: "#fff",
                                    flexShrink: 0,
                                    boxShadow: "0 2px 6px rgba(0,0,0,0.12)",
                                  }}
                                >
                                  {schoolName[0]?.toUpperCase() || "S"}
                                  {isAutoEsc && (
                                    <span
                                      className="sa-ping-blue"
                                      style={{
                                        position: "absolute",
                                        top: -2,
                                        right: -2,
                                        width: 10,
                                        height: 10,
                                        background: "#3b82f6",
                                        borderRadius: "50%",
                                        border: "2px solid #fff",
                                      }}
                                    />
                                  )}
                                  {!isAutoEsc && hasUnread && (
                                    <span
                                      className="sa-ping"
                                      style={{
                                        position: "absolute",
                                        top: -2,
                                        right: -2,
                                        width: 10,
                                        height: 10,
                                        background: G_INDIGO,
                                        borderRadius: "50%",
                                        border: "2px solid #fff",
                                      }}
                                    />
                                  )}
                                </div>
                                <div style={{ minWidth: 0 }}>
                                  <div
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 6,
                                      flexWrap: "wrap",
                                    }}
                                  >
                                    <span
                                      style={{
                                        fontWeight: 600,
                                        fontSize: "0.8rem",
                                        color:
                                          hasUnread || isAutoEsc
                                            ? "#111827"
                                            : "#374151",
                                        maxWidth: 100,
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap",
                                      }}
                                    >
                                      {schoolName}
                                    </span>
                                    {isUrgentT && (
                                      <span
                                        style={{
                                          display: "inline-flex",
                                          alignItems: "center",
                                          gap: 2,
                                          padding: "2px 6px",
                                          borderRadius: 999,
                                          background: "#fee2e2",
                                          color: "#b91c1c",
                                          fontSize: "0.6rem",
                                          fontWeight: 700,
                                          flexShrink: 0,
                                        }}
                                      >
                                        <Zap style={{ width: 6, height: 6 }} />
                                        Urgent
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 6,
                                  flexShrink: 0,
                                  marginLeft: 4,
                                }}
                              >
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
                                      padding: "0 4px",
                                      background: G_INDIGO,
                                      fontSize: "0.58rem",
                                      boxShadow:
                                        "0 2px 6px rgba(99,102,241,0.4)",
                                    }}
                                  >
                                    {ticket.unreadCount}
                                  </span>
                                )}
                                <span
                                  style={{
                                    fontSize: "0.63rem",
                                    color: "#9ca3af",
                                  }}
                                >
                                  {timeAgo(
                                    ticket.lastMessageTime || ticket.createdAt,
                                  )}
                                </span>
                              </div>
                            </div>

                            {ticket.category && (
                              <p
                                style={{
                                  fontSize: "0.66rem",
                                  color: "#9ca3af",
                                  marginBottom: 4,
                                }}
                              >
                                {ticket.category}
                              </p>
                            )}
                            {/* Badges */}
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                                flexWrap: "wrap",
                              }}
                            >
                              <span
                                className={`px-2 py-0.5 rounded-full font-semibold ${getPriorityColor(ticket.priority)}`}
                                style={{ fontSize: "0.63rem" }}
                              >
                                {ticket.priority || "Normal"}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded-full font-semibold ${getStatusColor(ticket.status)}`}
                                style={{ fontSize: "0.63rem" }}
                              >
                                {ticket.status || "Open"}
                              </span>
                              {isAutoEsc && (
                                <span
                                  style={{
                                    padding: "2px 8px",
                                    borderRadius: 999,
                                    fontSize: "0.63rem",
                                    fontWeight: 600,
                                    background: "#dbeafe",
                                    color: "#1e40af",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 3,
                                  }}
                                >
                                  <Hourglass style={{ width: 8, height: 8 }} />
                                  needs reply
                                </span>
                              )}
                              {ticket.escalated && !isAutoEsc && (
                                <span
                                  style={{
                                    padding: "2px 8px",
                                    borderRadius: 999,
                                    fontSize: "0.63rem",
                                    fontWeight: 600,
                                    background: "#ffedd5",
                                    color: "#c2410c",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 3,
                                  }}
                                >
                                  <Flag style={{ width: 8, height: 8 }} />
                                  Escalated
                                </span>
                              )}
                            </div>

                            {ticket.assignedTo && (
                              <div
                                style={{
                                  marginTop: 4,
                                  display: "flex",
                                  alignItems: "center",
                                  fontSize: "0.68rem",
                                  color: "#9ca3af",
                                }}
                              >
                                <UserCheck
                                  style={{
                                    width: 10,
                                    height: 10,
                                    marginRight: 4,
                                    color: "#a5b4fc",
                                  }}
                                />
                                {ticket.assignedTo.name}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Pagination — matches AdminPartnerSupport Pagination */}
              <Pagination
                currentPage={safeListPage}
                totalPages={listTotalPages}
                onPageChange={(p) => setListPage(p)}
              />
            </div>
          </div>

          {/* ── Chat Area ── */}
          <div className="lg:col-span-2">
            {selectedTicket ? (
              <div
                className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col"
                style={{ height: 580 }}
              >
                {/* Chat header — matches AdminPartnerSupport ChatArea header */}
                <div
                  style={{
                    padding: "12px",
                    borderBottom: "1px solid rgba(255,255,255,0.2)",
                    background: G_INDIGO,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 8,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        minWidth: 0,
                      }}
                    >
                      {/* Avatar */}
                      <div
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: "50%",
                          flexShrink: 0,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          background: "rgba(255,255,255,0.2)",
                          fontSize: "0.7rem",
                          fontWeight: 700,
                          color: "#fff",
                        }}
                      >
                        {selectedNeedsReply ? (
                          <Hourglass style={{ width: 12, height: 12 }} />
                        ) : (
                          (selectedTicket.school ||
                            selectedTicket.schoolAdminName ||
                            "S")[0]?.toUpperCase()
                        )}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            flexWrap: "wrap",
                          }}
                        >
                          <h3
                            style={{
                              fontWeight: 600,
                              color: "#fff",
                              fontSize: "0.82rem",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {selectedTicket.subject ||
                              selectedTicket.category ||
                              "Support Ticket"}
                          </h3>
                          {isActiveUrgent(selectedTicket) && (
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 2,
                                padding: "2px 6px",
                                borderRadius: 999,
                                background: "rgba(254,226,226,0.9)",
                                color: "#991b1b",
                                fontSize: "0.58rem",
                                fontWeight: 700,
                                flexShrink: 0,
                              }}
                            >
                              <Zap style={{ width: 8, height: 8 }} />
                              Urgent
                            </span>
                          )}
                          {selectedNeedsReply && (
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 2,
                                padding: "2px 6px",
                                borderRadius: 999,
                                background: "rgba(255,255,255,0.2)",
                                color: "#fff",
                                fontSize: "0.58rem",
                                fontWeight: 600,
                                flexShrink: 0,
                              }}
                            >
                              <Hourglass style={{ width: 8, height: 8 }} />
                              Needs Reply
                            </span>
                          )}
                          {selectedTicket.escalated && !selectedNeedsReply && (
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 2,
                                padding: "2px 6px",
                                borderRadius: 999,
                                background: "rgba(255,255,255,0.2)",
                                color: "#fff",
                                fontSize: "0.58rem",
                                fontWeight: 600,
                                flexShrink: 0,
                              }}
                            >
                              <Flag style={{ width: 8, height: 8 }} />
                              Escalated
                            </span>
                          )}
                        </div>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            marginTop: 2,
                            flexWrap: "wrap",
                          }}
                        >
                          <span
                            style={{
                              color: "rgba(255,255,255,0.8)",
                              fontSize: "0.68rem",
                            }}
                          >
                            {selectedTicket.school ||
                              selectedTicket.schoolAdminName ||
                              "School Admin"}
                          </span>
                          <span
                            style={{
                              padding: "2px 6px",
                              borderRadius: 999,
                              fontSize: "0.62rem",
                              fontWeight: 500,
                              background: "rgba(255,255,255,0.2)",
                              color: "#fff",
                            }}
                          >
                            {selectedTicket.status}
                          </span>
                        </div>
                      </div>
                    </div>
                    {/* Right side actions */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        flexShrink: 0,
                      }}
                    >
                      <button
                        onClick={async () => {
                          try {
                            const res = await axios.get(
                              `${API_URL}/ticket/${selectedTicket._id}`,
                              { headers: { Authorization: `Bearer ${token}` } },
                            );
                            setTicketDetails(res.data.ticket);
                            setShowTicketDetails(true);
                          } catch (_) {}
                        }}
                        style={{
                          background: "rgba(255,255,255,0.15)",
                          border: "1px solid rgba(255,255,255,0.3)",
                          borderRadius: 8,
                          padding: "4px 8px",
                          color: "#fff",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          fontSize: "0.7rem",
                          gap: 4,
                        }}
                        title="View Details"
                      >
                        <Info style={{ width: 12, height: 12 }} />
                      </button>
                      {!selectedTicket.assignedTo && (
                        <button
                          onClick={() => handleAssignToMe(selectedTicket._id)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                            padding: "5px 10px",
                            borderRadius: 8,
                            border: "1px solid rgba(255,255,255,0.35)",
                            background: "rgba(255,255,255,0.15)",
                            color: "#fff",
                            fontWeight: 700,
                            fontSize: "0.7rem",
                            cursor: "pointer",
                          }}
                        >
                          <UserCheck style={{ width: 10, height: 10 }} />
                          Assign
                        </button>
                      )}
                      <StatusDropdown
                        value={selectedTicket.status}
                        onChange={(status) =>
                          handleUpdateTicketStatus(selectedTicket._id, status)
                        }
                        disabled={statusUpdating}
                      />
                    </div>
                  </div>

                  {/* Auto-escalation warning banner — matches AdminPartnerSupport */}
                  {selectedNeedsReply && (
                    <div
                      style={{
                        marginTop: 8,
                        padding: "10px 12px",
                        borderRadius: 12,
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 10,
                        background: "linear-gradient(135deg,#eff6ff,#dbeafe)",
                        border: "1px solid rgba(255,255,255,0.3)",
                      }}
                    >
                      <Hourglass
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
                        <p
                          style={{
                            fontSize: "0.68rem",
                            color: "#1d4ed8",
                            margin: 0,
                          }}
                        >
                          First raised {timeAgo(selectedTicket.createdAt)} · Use
                          the Needs Reply tab to review it
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Messages — same chat background as AdminPartnerSupport */}
                <div
                  style={{
                    flex: 1,
                    padding: 12,
                    overflowY: "auto",
                    background: G_CHAT,
                  }}
                >
                  {loading ? (
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        height: "100%",
                      }}
                    >
                      <Loader2
                        style={{ width: 24, height: 24, color: accent }}
                        className="animate-spin"
                      />
                    </div>
                  ) : (
                    <>
                      {(!messages[selectedTicket._id] ||
                        messages[selectedTicket._id].length === 0) && (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            height: "100%",
                            flexDirection: "column",
                          }}
                        >
                          <Headphones
                            style={{
                              width: 32,
                              height: 32,
                              marginBottom: 8,
                              opacity: 0.2,
                              color: accent,
                            }}
                          />
                          <p style={{ fontSize: "0.8rem", color: "#9ca3af" }}>
                            No messages yet. Start the conversation!
                          </p>
                        </div>
                      )}
                      {messages[selectedTicket._id]?.map((msg) => (
                        <ChatBubble
                          key={`msg-${msg._id}`}
                          msg={msg}
                          selectedTicket={selectedTicket}
                          onReply={setReplyingTo}
                          onDelete={setDeleteTarget}
                          token={token}
                        />
                      ))}
                      <div ref={messagesEndRef} />
                    </>
                  )}
                </div>

                {/* Reply banner */}
                {replyingTo && (
                  <div
                    style={{
                      padding: "6px 12px",
                      borderTop: "1px solid #c7d2fe",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      background: "#eef2ff",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        fontSize: "0.72rem",
                        color: "#4338ca",
                      }}
                    >
                      <Reply style={{ width: 12, height: 12 }} />
                      <span>
                        Replying: "
                        <span style={{ fontWeight: 600 }}>
                          {replyingTo.text?.substring(0, 40)}…
                        </span>
                        "
                      </span>
                    </div>
                    <button
                      onClick={() => setReplyingTo(null)}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: "#9ca3af",
                      }}
                    >
                      <XCircle style={{ width: 14, height: 14 }} />
                    </button>
                  </div>
                )}

                <StagedAttachments
                  attachments={attachments}
                  onRemove={(id) =>
                    setAttachments((prev) => prev.filter((a) => a.id !== id))
                  }
                />

                {/* Input area — matches AdminPartnerSupport input style */}
                {["resolved", "closed"].includes(selectedTicket.status) ? (
                  <div
                    style={{
                      padding: 12,
                      borderTop: "1px solid #e5e7eb",
                      textAlign: "center",
                      fontSize: "0.75rem",
                      color: "#9ca3af",
                      background: "#f9fafb",
                    }}
                  >
                    Ticket is <strong>{selectedTicket.status}</strong>.
                  </div>
                ) : (
                  <div
                    style={{
                      padding: 12,
                      borderTop: "1px solid #e5e7eb",
                      background: "#fff",
                    }}
                  >
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 8 }}
                    >
                      <label style={{ flexShrink: 0, cursor: "pointer" }}>
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: "50%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            background: "#f3f4f6",
                            color: selectedNeedsReply ? "#3b82f6" : accent,
                            transition: "all 0.15s",
                          }}
                        >
                          <Paperclip style={{ width: 14, height: 14 }} />
                        </div>
                        <input
                          type="file"
                          style={{ display: "none" }}
                          multiple
                          onChange={pickFiles}
                          accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.gif,.webp"
                        />
                      </label>
                      <button
                        onClick={toggleListening}
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
                          className={`${isListening ? "sa-ping-red" : ""}`}
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: "50%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            background: isListening ? "#fef2f2" : "#f3f4f6",
                            color: isListening
                              ? "#ef4444"
                              : selectedNeedsReply
                                ? "#3b82f6"
                                : accent,
                            transition: "all 0.15s",
                          }}
                        >
                          {isListening ? (
                            <MicOff style={{ width: 14, height: 14 }} />
                          ) : (
                            <Mic style={{ width: 14, height: 14 }} />
                          )}
                        </div>
                      </button>
                      <input
                        type="text"
                        placeholder={
                          isListening
                            ? "Listening..."
                            : selectedNeedsReply
                              ? "Reply now — marked Needs Reply"
                              : attachments.length
                                ? "Add a caption…"
                                : "Reply to school admin… (Enter to send)"
                        }
                        style={{
                          flex: 1,
                          border: `1px solid ${selectedNeedsReply ? "#93c5fd" : "#d1d5db"}`,
                          borderRadius: 999,
                          padding: "8px 14px",
                          fontSize: "0.8rem",
                          outline: "none",
                          minWidth: 0,
                          boxShadow: selectedNeedsReply
                            ? "0 0 0 2px rgba(59,130,246,0.1)"
                            : "none",
                          fontFamily: "inherit",
                        }}
                        onFocus={(e) => {
                          e.target.style.borderColor = selectedNeedsReply
                            ? "#3b82f6"
                            : accent;
                          e.target.style.boxShadow = `0 0 0 3px rgba(${selectedNeedsReply ? "59,130,246" : "99,102,241"},0.15)`;
                        }}
                        onBlur={(e) => {
                          e.target.style.borderColor = selectedNeedsReply
                            ? "#93c5fd"
                            : "#d1d5db";
                          e.target.style.boxShadow = selectedNeedsReply
                            ? "0 0 0 2px rgba(59,130,246,0.1)"
                            : "none";
                        }}
                        value={messageInput}
                        onChange={(e) => setMessageInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleSendMessage();
                          }
                        }}
                        disabled={sendingMessage}
                      />
                      <button
                        onClick={handleSendMessage}
                        disabled={
                          (!messageInput.trim() && attachments.length === 0) ||
                          sendingMessage
                        }
                        style={{
                          flexShrink: 0,
                          width: 32,
                          height: 32,
                          borderRadius: "50%",
                          border: "none",
                          transition: "all 0.15s",
                          ...((messageInput.trim() || attachments.length > 0) &&
                          !sendingMessage
                            ? {
                                background: selectedNeedsReply
                                  ? G_AMBER
                                  : G_INDIGO,
                                color: "#fff",
                                boxShadow: "0 3px 10px rgba(99,102,241,0.35)",
                                cursor: "pointer",
                              }
                            : {
                                background: "#e5e7eb",
                                color: "#9ca3af",
                                cursor: "not-allowed",
                              }),
                        }}
                      >
                        {sendingMessage ? (
                          <Loader2
                            style={{ width: 14, height: 14 }}
                            className="animate-spin"
                          />
                        ) : (
                          <Send style={{ width: 14, height: 14 }} />
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Empty state */
              <div
                className="bg-white rounded-xl shadow-sm border border-gray-200 flex items-center justify-center"
                style={{ height: 580 }}
              >
                <div style={{ textAlign: "center", padding: "40px 24px" }}>
                  <div
                    style={{
                      width: 56,
                      height: 56,
                      margin: "0 auto 12px",
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "linear-gradient(135deg,#eef2ff,#ede9fe)",
                    }}
                  >
                    <School
                      style={{ width: 28, height: 28, color: "#6366f1" }}
                    />
                  </div>
                  <h3
                    style={{
                      fontSize: "1rem",
                      fontWeight: 700,
                      color: "#111827",
                      marginBottom: 4,
                    }}
                  >
                    School Admin Support
                  </h3>
                  <p
                    style={{
                      fontSize: "0.8rem",
                      color: "#9ca3af",
                      maxWidth: 280,
                    }}
                  >
                    Select a ticket to view and respond to school admins.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Ticket Details Modal ── */}
      {showTicketDetails && ticketDetails && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
            padding: "16px",
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 16,
              maxWidth: 640,
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "0 24px 80px rgba(0,0,0,0.2)",
            }}
          >
            <div
              style={{
                padding: "20px 24px",
                borderBottom: "1px solid #e5e7eb",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <h2
                style={{ fontSize: "1rem", fontWeight: 700, color: "#111827" }}
              >
                Ticket Details
              </h2>
              <button
                onClick={() => setShowTicketDetails(false)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#9ca3af",
                }}
              >
                <XCircle style={{ width: 20, height: 20 }} />
              </button>
            </div>
            <div
              style={{
                padding: "20px 24px",
                display: "flex",
                flexDirection: "column",
                gap: 16,
              }}
            >
              <div>
                <label
                  style={{
                    fontSize: "0.7rem",
                    fontWeight: 600,
                    color: "#6b7280",
                    display: "block",
                    marginBottom: 4,
                  }}
                >
                  School
                </label>
                <p
                  style={{
                    fontSize: "0.88rem",
                    fontWeight: 600,
                    color: "#111827",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    margin: 0,
                  }}
                >
                  <School style={{ width: 14, height: 14, color: "#6366f1" }} />
                  {ticketDetails.school || "Not specified"}
                </p>
                <p
                  style={{
                    fontSize: "0.75rem",
                    color: "#6b7280",
                    margin: "2px 0 0",
                  }}
                >
                  {ticketDetails.schoolAdminName}
                </p>
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 16,
                }}
              >
                <div>
                  <label
                    style={{
                      fontSize: "0.7rem",
                      fontWeight: 600,
                      color: "#6b7280",
                      display: "block",
                      marginBottom: 4,
                    }}
                  >
                    Category
                  </label>
                  <p
                    style={{ fontSize: "0.88rem", color: "#111827", margin: 0 }}
                  >
                    {ticketDetails.category}
                  </p>
                </div>
                <div>
                  <label
                    style={{
                      fontSize: "0.7rem",
                      fontWeight: 600,
                      color: "#6b7280",
                      display: "block",
                      marginBottom: 4,
                    }}
                  >
                    Priority
                  </label>
                  <p
                    style={{
                      fontSize: "0.88rem",
                      fontWeight: 600,
                      color:
                        ticketDetails.priority === "urgent"
                          ? "#dc2626"
                          : "#111827",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      margin: 0,
                    }}
                  >
                    {ticketDetails.priority === "urgent" && (
                      <Zap
                        style={{ width: 12, height: 12, color: "#ef4444" }}
                      />
                    )}
                    {ticketDetails.priority}
                  </p>
                </div>
              </div>
              <div>
                <label
                  style={{
                    fontSize: "0.7rem",
                    fontWeight: 600,
                    color: "#6b7280",
                    display: "block",
                    marginBottom: 4,
                  }}
                >
                  Subject
                </label>
                <p style={{ fontSize: "0.88rem", color: "#111827", margin: 0 }}>
                  {ticketDetails.subject}
                </p>
              </div>
              <div>
                <label
                  style={{
                    fontSize: "0.7rem",
                    fontWeight: 600,
                    color: "#6b7280",
                    display: "block",
                    marginBottom: 4,
                  }}
                >
                  Description
                </label>
                <p
                  style={{
                    fontSize: "0.88rem",
                    color: "#374151",
                    background: "#f9fafb",
                    padding: "12px",
                    borderRadius: 8,
                    margin: 0,
                  }}
                >
                  {ticketDetails.description}
                </p>
              </div>
              {ticketDetails.escalated && (
                <div
                  style={{
                    background: "#fff7ed",
                    border: "1px solid #fed7aa",
                    borderRadius: 8,
                    padding: 12,
                  }}
                >
                  <p
                    style={{
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      color: "#c2410c",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      margin: "0 0 4px",
                    }}
                  >
                    <Flag style={{ width: 12, height: 12 }} />
                    Escalated
                  </p>
                  <p
                    style={{ fontSize: "0.75rem", color: "#ea580c", margin: 0 }}
                  >
                    {ticketDetails.escalationReason}
                  </p>
                </div>
              )}
              {ticketDetails.autoEscalated && (
                <div
                  style={{
                    background: "#eff6ff",
                    border: "1px solid #bfdbfe",
                    borderRadius: 8,
                    padding: 12,
                  }}
                >
                  <p
                    style={{
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      color: "#1e40af",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      margin: "0 0 4px",
                    }}
                  >
                    <Hourglass style={{ width: 12, height: 12 }} />
                    Needs Reply
                  </p>
                  <p
                    style={{ fontSize: "0.75rem", color: "#1d4ed8", margin: 0 }}
                  >
                    This ticket is marked as needing an admin reply.
                  </p>
                </div>
              )}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 16,
                }}
              >
                <div>
                  <label
                    style={{
                      fontSize: "0.7rem",
                      fontWeight: 600,
                      color: "#6b7280",
                      display: "block",
                      marginBottom: 4,
                    }}
                  >
                    Created
                  </label>
                  <p
                    style={{ fontSize: "0.88rem", color: "#111827", margin: 0 }}
                  >
                    {new Date(ticketDetails.createdAt).toLocaleString()}
                  </p>
                </div>
                <div>
                  <label
                    style={{
                      fontSize: "0.7rem",
                      fontWeight: 600,
                      color: "#6b7280",
                      display: "block",
                      marginBottom: 4,
                    }}
                  >
                    Messages
                  </label>
                  <p
                    style={{ fontSize: "0.88rem", color: "#111827", margin: 0 }}
                  >
                    {ticketDetails.messages || 0}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SchoolAdminSupport;
