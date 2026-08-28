// frontend/src/WebApp/Flows/PartnerFlow/MainPage/PartnerSupport.jsx
// Rebuilt to match SchoolAdminSupport style exactly

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  FaEnvelope,
  FaPaperPlane,
  FaExclamationTriangle,
  FaClock,
  FaCheckCircle,
  FaDownload,
  FaSearch,
  FaCreditCard,
  FaQuestionCircle,
  FaBriefcase,
  FaPaperclip,
  FaTimesCircle,
  FaTrash,
  FaFlag,
  FaHourglassHalf,
  FaInbox,
  FaBug,
  FaLock,
  FaSpinner,
  FaInfoCircle,
  FaPlus,
  FaCheck,
  FaHeadset,
  FaCheckDouble,
  FaFile,
  FaFilePdf,
  FaFileWord,
  FaFileAlt,
  FaImage,
  FaHandshake,
  FaUserTie,
  FaReply,
  FaChevronLeft,
  FaChevronRight,
  FaTimes,
  FaTag,
  FaArrowLeft,
  FaMicrophone,
  FaMicrophoneSlash,
} from "react-icons/fa";
import logo from "../../../../assets-webapp/skillnaav_final_logo.svg";
import axios from "axios";
import { io } from "socket.io-client";

const BASE_URL = process.env.REACT_APP_API_BASE || "http://localhost:5000";
const API_BASE = `${BASE_URL}/api/support/partner`;
const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || BASE_URL;

const SENT_GRAD = "linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%)";
const RECEIVED_GRAD = "linear-gradient(135deg,#059669 0%,#0d9488 100%)";
const ADMIN_GRAD = "linear-gradient(135deg,#7c3aed 0%,#6d28d9 100%)";
const DANGER_GRAD = "linear-gradient(135deg,#ef4444 0%,#dc2626 100%)";

const LONG_PRESS_MS = 600;
const TICKETS_PER_PAGE = 10;

const PARTNER_CATEGORIES = [
  {
    id: "Technical Issue",
    name: "Technical Issue",
    icon: <FaBug className="w-3 h-3 text-blue-500" />,
  },
  {
    id: "Subscription Issues",
    name: "Subscription Issues",
    icon: <FaCreditCard className="w-3 h-3 text-green-500" />,
  },
  {
    id: "Account Issues",
    name: "Account Issues",
    icon: <FaLock className="w-3 h-3 text-orange-500" />,
  },
  {
    id: "Posted Internship Issues",
    name: "Posted Internship Issues",
    icon: <FaBriefcase className="w-3 h-3 text-purple-500" />,
  },
  {
    id: "General Inquiry",
    name: "General Inquiry",
    icon: <FaQuestionCircle className="w-3 h-3 text-gray-500" />,
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

const normaliseToken = (value) => {
  if (typeof value !== "string") return null;
  const token = value
    .trim()
    .replace(/^Bearer\s+/i, "")
    .replace(/^['"]|['"]$/g, "");
  return token || null;
};

const decodeToken = (token) => {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const base64 = part
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(Math.ceil(part.length / 4) * 4, "=");
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
};

const getStoredObject = (key) => {
  try {
    return JSON.parse(localStorage.getItem(key) || "null");
  } catch {
    return null;
  }
};

const getToken = () => {
  const partnerInfo = getStoredObject("partnerInfo");
  const partner = getStoredObject("partner");
  const candidates = [
    localStorage.getItem("token"), // canonical key written by PartnerLogin
    localStorage.getItem("partnerToken"),
    localStorage.getItem("partnerJwt"),
    sessionStorage.getItem("partnerToken"),
    sessionStorage.getItem("token"),
    partnerInfo?.token,
    partnerInfo?.partnerToken,
    partner?.token,
    partner?.partnerToken,
  ]
    .map(normaliseToken)
    .filter(Boolean);

  const valid = candidates
    .map((token) => ({ token, payload: decodeToken(token) }))
    .filter(
      ({ payload }) =>
        payload && (!payload.exp || payload.exp * 1000 > Date.now()),
    );
  const partnerId =
    localStorage.getItem("partnerId") ||
    partnerInfo?._id ||
    partnerInfo?.id ||
    partner?._id ||
    partner?.id;

  // Avoid accidentally using another flow's generic `token` when both users
  // have logged in in the same browser.
  const matching =
    partnerId &&
    valid.find(
      ({ payload }) =>
        String(payload.id || payload._id || payload.partnerId || "") ===
        String(partnerId),
    );
  return partnerId ? matching?.token || null : valid[0]?.token || null;
};

const getUser = () => {
  try {
    let raw =
      localStorage.getItem("partnerInfo") ||
      localStorage.getItem("partnerProfile") ||
      localStorage.getItem("userInfo");
    if (!raw) raw = localStorage.getItem("partner");
    let p = raw ? JSON.parse(raw) : null;
    if (!p || (!p._id && !p.id)) {
      const token = getToken();
      if (token) {
        const decoded = decodeToken(token);
        if (decoded && (decoded._id || decoded.id || decoded.partnerId)) {
          p = {
            ...decoded,
            _id: decoded._id || decoded.id || decoded.partnerId,
          };
        }
      }
    }
    return p && (p._id || p.id)
      ? { ...p, _id: p._id || p.id, name: p.companyName || p.name || "Partner" }
      : { name: "Partner" };
  } catch {
    return { name: "Partner" };
  }
};

const fmtTime = (ts) => {
  if (!ts) return "";
  const diff = Math.floor((Date.now() - new Date(ts)) / 60000);
  if (diff < 1) return "Just now";
  if (diff < 60) return `${diff}m ago`;
  if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
  if (diff < 2880) return "Yesterday";
  return new Date(ts).toLocaleDateString();
};
const fmtSize = (b) => {
  if (!b) return "";
  if (b < 1024) return b + " B";
  if (b < 1048576) return (b / 1024).toFixed(1) + " KB";
  return (b / 1048576).toFixed(1) + " MB";
};

const isTicketClosed = (t) =>
  t?.status === "resolved" || t?.status === "closed";
const isEscalated = (t) => !!t?.escalatedToPartner;

const buildAttachmentUrl = (att) => {
  if (att.url && att.url.startsWith("http")) return att.url;
  if (att.url && att.url.startsWith("/api")) return `${BASE_URL}${att.url}`;
  if (att.path && att.path.startsWith("/api")) return `${BASE_URL}${att.path}`;
  if (att.url) return `${BASE_URL}/${att.url.replace(/^\//, "")}`;
  if (att.path) return `${BASE_URL}/${att.path.replace(/^\//, "")}`;
  return null;
};

// ─── File Icons ───────────────────────────────────────────────────────────────
const FileTypeIcon = ({ att, dark }) => {
  const mime = att.mimetype || att.type || "";
  const name = att.filename || att.name || "";
  const ext = name.split(".").pop()?.toLowerCase();
  const cls = dark ? "" : "text-white";
  if (
    mime.startsWith("image/") ||
    ["png", "jpg", "jpeg", "gif", "webp"].includes(ext)
  )
    return (
      <FaImage
        className={`w-3 h-3 flex-shrink-0 ${dark ? "text-blue-500" : "text-blue-200"}`}
      />
    );
  if (mime === "application/pdf" || ext === "pdf")
    return (
      <FaFilePdf
        className={`w-3 h-3 flex-shrink-0 ${dark ? "text-red-500" : "text-red-300"}`}
      />
    );
  if (["doc", "docx"].includes(ext) || mime?.includes("word"))
    return (
      <FaFileWord
        className={`w-3 h-3 flex-shrink-0 ${dark ? "text-blue-400" : "text-blue-200"}`}
      />
    );
  if (ext === "txt" || mime === "text/plain")
    return (
      <FaFileAlt
        className={`w-3 h-3 flex-shrink-0 ${dark ? "text-gray-400" : "text-gray-300"}`}
      />
    );
  return (
    <FaFile
      className={`w-3 h-3 flex-shrink-0 ${dark ? "text-gray-400" : cls}`}
    />
  );
};

// ─── Download Attachment ──────────────────────────────────────────────────────
const downloadAttachment = async (att, token) => {
  if (!token) {
    alert("Not authenticated.");
    return;
  }
  const url = buildAttachmentUrl(att);
  if (!url) {
    alert("File not available.");
    return;
  }
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Server returned ${res.status}`);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = att.filename || att.name || "download";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      a.remove();
      URL.revokeObjectURL(blobUrl);
    }, 1500);
  } catch (err) {
    alert("Download failed: " + err.message);
  }
};

// ─── Attachment Chip ──────────────────────────────────────────────────────────
const AttachmentChip = ({ att, onDownload, sending }) => {
  const name = att.filename || att.name || "file";
  const canDownload = !sending && !!(att.url || att.path);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        background: "rgba(255,255,255,0.18)",
        borderRadius: 8,
        padding: "5px 8px",
        marginTop: 6,
        cursor: canDownload ? "pointer" : "default",
      }}
      onClick={canDownload ? () => onDownload(att) : undefined}
      title={
        canDownload
          ? `Download ${name}`
          : sending
            ? "Uploading…"
            : "Not available"
      }
    >
      <FileTypeIcon att={att} />
      <span
        className="truncate flex-1"
        style={{ fontSize: "0.72rem", maxWidth: 160 }}
      >
        {name}
      </span>
      {att.size > 0 && (
        <span style={{ fontSize: "0.62rem", opacity: 0.75, flexShrink: 0 }}>
          {fmtSize(att.size)}
        </span>
      )}
      {sending ? (
        <FaSpinner className="w-2.5 h-2.5 animate-spin flex-shrink-0 opacity-80" />
      ) : canDownload ? (
        <FaDownload className="w-2.5 h-2.5 flex-shrink-0 opacity-80 hover:opacity-100" />
      ) : (
        <span style={{ fontSize: "0.6rem", opacity: 0.5 }}>n/a</span>
      )}
    </div>
  );
};

// ─── Resolved Banner ──────────────────────────────────────────────────────────
const ResolvedBanner = ({ onRaiseNew }) => (
  <div className="p-4 border-t border-gray-200 bg-white">
    <div className="flex flex-col items-center justify-center py-3 px-4 bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-xl gap-2">
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-full bg-purple-600 flex items-center justify-center flex-shrink-0">
          <FaCheckCircle className="w-3.5 h-3.5 text-white" />
        </div>
        <p className="text-sm font-semibold text-gray-800">
          This ticket is <span className="text-purple-600">Resolved</span> —
          messaging is disabled.
        </p>
      </div>
      {onRaiseNew && (
        <p className="text-xs text-gray-500">
          Need more help?{" "}
          <button
            onClick={onRaiseNew}
            className="text-purple-600 font-semibold hover:underline focus:outline-none"
          >
            Open a new ticket.
          </button>
        </p>
      )}
    </div>
  </div>
);

// ─── Delete Ticket Modal ──────────────────────────────────────────────────────
const DeleteTicketModal = ({
  ticket,
  onDeleteForMe,
  onDeleteForEveryone,
  onCancel,
  deleting,
}) => {
  if (!ticket) return null;
  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
        style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
        onClick={onCancel}
      >
        <div
          className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-sm mx-0 sm:mx-4 overflow-hidden shadow-2xl"
          style={{ animation: "slideUp 0.25s cubic-bezier(0.34,1.56,0.64,1)" }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="h-1.5 w-full" style={{ background: DANGER_GRAD }} />
          <div className="flex justify-center pt-2 pb-0 sm:hidden">
            <div className="w-10 h-1 bg-gray-300 rounded-full" />
          </div>
          <div className="flex flex-col items-center pt-5 pb-2 px-6">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center mb-3"
              style={{ background: "linear-gradient(135deg,#fee2e2,#fecaca)" }}
            >
              <FaTrash className="w-6 h-6 text-red-500" />
            </div>
            <h3 className="text-base font-bold text-gray-900 mb-1">
              Delete Ticket?
            </h3>
            <p className="text-xs text-gray-500 text-center mb-2">
              Choose how you want to delete this ticket.
            </p>
            <div className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 mb-4">
              <div className="flex items-center gap-2">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: SENT_GRAD }}
                >
                  <FaHandshake className="text-white w-3 h-3" />
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className="font-semibold text-gray-800 truncate"
                    style={{ fontSize: "0.78rem" }}
                  >
                    {ticket.subject || ticket.category || "My Ticket"}
                  </p>
                  <p
                    className="text-indigo-600 truncate"
                    style={{ fontSize: "0.68rem" }}
                  >
                    {ticket.category}
                  </p>
                  <p className="text-gray-400" style={{ fontSize: "0.65rem" }}>
                    ID: #{ticket._id?.slice(-6)}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex flex-col w-full gap-2 pb-5">
              <button
                onClick={onDeleteForMe}
                disabled={deleting}
                className="w-full py-2.5 rounded-xl text-white font-semibold text-sm flex items-center justify-center gap-2 transition-all hover:opacity-90 active:scale-95 disabled:opacity-60"
                style={{
                  background: "linear-gradient(135deg,#6366f1 0%,#4f46e5 100%)",
                  boxShadow: "0 4px 14px rgba(99,102,241,0.35)",
                }}
              >
                {deleting === "me" ? (
                  <FaSpinner className="animate-spin w-3.5 h-3.5" />
                ) : (
                  <FaTrash className="w-3.5 h-3.5" />
                )}
                {deleting === "me" ? "Deleting…" : "Delete for Me"}
              </button>
              <p
                className="text-center text-gray-400 px-2"
                style={{ fontSize: "0.62rem", marginTop: -4 }}
              >
                Removes from your view only
              </p>
              <button
                onClick={onDeleteForEveryone}
                disabled={deleting}
                className="w-full py-2.5 rounded-xl text-white font-semibold text-sm flex items-center justify-center gap-2 transition-all hover:opacity-90 active:scale-95 disabled:opacity-60"
                style={{
                  background: DANGER_GRAD,
                  boxShadow: "0 4px 14px rgba(239,68,68,0.4)",
                }}
              >
                {deleting === "everyone" ? (
                  <FaSpinner className="animate-spin w-3.5 h-3.5" />
                ) : (
                  <FaTrash className="w-3.5 h-3.5" />
                )}
                {deleting === "everyone" ? "Deleting…" : "Delete for Everyone"}
              </button>
              <p
                className="text-center text-gray-400 px-2"
                style={{ fontSize: "0.62rem", marginTop: -4 }}
              >
                Permanently deleted for all parties
              </p>
              <button
                onClick={onCancel}
                disabled={!!deleting}
                className="w-full py-2.5 rounded-xl border border-gray-300 text-gray-700 font-semibold text-sm hover:bg-gray-50 transition-colors disabled:opacity-50 mt-1"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
      <style>{`@keyframes slideUp{from{transform:translateY(60px);opacity:0}to{transform:translateY(0);opacity:1}}`}</style>
    </>
  );
};

// ─── Chat Bubble ──────────────────────────────────────────────────────────────
const ChatBubble = ({
  msg,
  user,
  onReply,
  onDelete,
  deletingMessage,
  onDownload,
}) => {
  const role = msg.senderRole;
  const isOwn = role === "partner";
  const isAdmin = role === "admin";

  if (role === "system") {
    return (
      <div className="flex justify-center mb-3">
        <span
          className={`px-3 py-1 rounded-full text-xs ${msg.text?.includes("🚨") ? "bg-orange-100 text-orange-700 border border-orange-200" : "bg-gray-200 text-gray-600"}`}
        >
          {msg.text}
        </span>
      </div>
    );
  }

  const grad = isOwn ? SENT_GRAD : isAdmin ? ADMIN_GRAD : RECEIVED_GRAD;
  const shadow = isOwn
    ? "0 3px 10px rgba(99,102,241,0.38)"
    : isAdmin
      ? "0 3px 10px rgba(124,58,237,0.35)"
      : "0 3px 10px rgba(5,150,105,0.30)";
  const label = isOwn
    ? user?.name || "Partner"
    : isAdmin
      ? "Admin"
      : msg.senderName || "Student";
  const nameClr = isOwn
    ? "text-indigo-500"
    : isAdmin
      ? "text-purple-500"
      : "text-emerald-600";
  const Icon = isOwn ? (
    <FaHandshake className="w-3 h-3 text-white" />
  ) : isAdmin ? (
    <FaUserTie className="w-3 h-3 text-white" />
  ) : (
    <FaHeadset className="w-3 h-3 text-white" />
  );
  const atts = msg.attachments || [];

  const rawText = (msg.text || "").trim();
  const showText =
    atts.length > 0 && rawText === (atts[0]?.filename || atts[0]?.name || "")
      ? ""
      : rawText;

  return (
    <div
      className={`flex group mb-4 ${isOwn ? "justify-end" : "justify-start"}`}
    >
      {!isOwn && (
        <div
          className="w-6 h-6 rounded-full flex items-center justify-center mr-1.5 mt-1 flex-shrink-0 shadow-sm"
          style={{ background: grad }}
        >
          {Icon}
        </div>
      )}
      <div
        className={`relative max-w-[72%] ${msg.isSending ? "opacity-60" : ""}`}
      >
        <p
          className={`font-semibold mb-0.5 px-1 ${isOwn ? "text-right" : "text-left"} ${nameClr}`}
          style={{ fontSize: "0.66rem" }}
        >
          {label}
        </p>
        <div
          style={{
            padding: "8px 12px",
            borderRadius: isOwn ? "14px 14px 3px 14px" : "14px 14px 14px 3px",
            background: grad,
            color: "#fff",
            boxShadow: shadow,
            minWidth: "120px",
          }}
        >
          {msg.replyTo && (
            <div
              className="mb-1.5 p-1.5 border-l-2 border-white/50 pl-2 bg-white/10 rounded opacity-80"
              style={{ fontSize: "0.68rem" }}
            >
              {msg.replyTo.text?.substring(0, 50)}…
            </div>
          )}
          {showText ? (
            <p
              className="break-words whitespace-pre-wrap"
              style={{ fontSize: "0.82rem", lineHeight: 1.45 }}
            >
              {showText}
            </p>
          ) : null}
          {atts.length > 0 &&
            atts.map((att, i) => (
              <AttachmentChip
                key={att._id || i}
                att={att}
                onDownload={onDownload}
                sending={!!msg.isSending}
              />
            ))}
          {!showText && atts.length === 0 && (
            <p className="italic opacity-60" style={{ fontSize: "0.75rem" }}>
              (empty)
            </p>
          )}
          <div
            className={`flex items-center mt-1.5 gap-1 ${isOwn ? "justify-end" : ""}`}
            style={{ opacity: 0.8 }}
          >
            <span style={{ fontSize: "0.62rem" }}>
              {fmtTime(msg.createdAt)}
            </span>
            {isOwn &&
              (msg.isSending ? (
                <FaSpinner className="w-2 h-2 animate-spin" />
              ) : (
                <FaCheckDouble
                  className={`w-2 h-2 ${msg.read ? "text-blue-200" : ""}`}
                />
              ))}
          </div>
        </div>
        <div className="absolute -bottom-6 right-0 hidden group-hover:flex items-center space-x-0.5 bg-white rounded-lg shadow-lg border border-gray-100 p-0.5 z-10">
          <button
            onClick={() => onReply(msg)}
            className="p-1 text-gray-500 hover:text-indigo-600 rounded"
          >
            <FaReply className="w-3 h-3" />
          </button>
          {isOwn && (
            <button
              onClick={() => onDelete(msg._id)}
              disabled={deletingMessage === msg._id}
              className="p-1 text-gray-500 hover:text-red-600 rounded"
            >
              {deletingMessage === msg._id ? (
                <FaSpinner className="w-3 h-3 animate-spin" />
              ) : (
                <FaTrash className="w-3 h-3" />
              )}
            </button>
          )}
        </div>
      </div>
      {isOwn && (
        <div
          className="w-6 h-6 rounded-full flex items-center justify-center ml-1.5 mt-1 flex-shrink-0 shadow-sm"
          style={{ background: grad }}
        >
          {Icon}
        </div>
      )}
    </div>
  );
};

// ─── Own Ticket Item (long-press to delete) ───────────────────────────────────
const OwnTicketItem = ({
  ticket,
  isSelected,
  onSelect,
  onLongPress,
  priColor,
  statColor,
  getIcon,
  aCol,
}) => {
  const timerRef = useRef(null);
  const pressStartRef = useRef(0);
  const didLongPress = useRef(false);
  const startPosRef = useRef({ x: 0, y: 0 });
  const rafRef = useRef(null);
  const ptypeRef = useRef(null);

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
      ((Date.now() - pressStartRef.current) / LONG_PRESS_MS) * 100,
      100,
    );
    setProgress(pct);
    if (pct < 100) rafRef.current = requestAnimationFrame(animateBar);
  }, []);

  const startPress = useCallback(
    (cx, cy) => {
      didLongPress.current = false;
      pressStartRef.current = Date.now();
      startPosRef.current = { x: cx, y: cy };
      setPressing(true);
      setProgress(0);
      rafRef.current = requestAnimationFrame(animateBar);
      timerRef.current = setTimeout(() => {
        didLongPress.current = true;
        clearTimer();
        if (navigator.vibrate) navigator.vibrate(60);
        onLongPress(ticket);
      }, LONG_PRESS_MS);
    },
    [animateBar, clearTimer, onLongPress, ticket],
  );

  const endPress = useCallback(() => {
    const elapsed = Date.now() - pressStartRef.current;
    clearTimer();
    if (!didLongPress.current && elapsed < LONG_PRESS_MS) onSelect(ticket);
    didLongPress.current = false;
    ptypeRef.current = null;
  }, [clearTimer, onSelect, ticket]);

  const cancelPress = useCallback(() => {
    clearTimer();
    didLongPress.current = false;
    ptypeRef.current = null;
  }, [clearTimer]);
  const moveCheck = useCallback(
    (cx, cy) => {
      if (
        Math.abs(cx - startPosRef.current.x) > 8 ||
        Math.abs(cy - startPosRef.current.y) > 8
      )
        cancelPress();
    },
    [cancelPress],
  );

  return (
    <div
      onMouseDown={(e) => {
        if (e.button !== 0) return;
        ptypeRef.current = "mouse";
        startPress(e.clientX, e.clientY);
      }}
      onMouseUp={() => {
        if (ptypeRef.current !== "mouse") return;
        endPress();
      }}
      onMouseLeave={() => {
        if (ptypeRef.current === "mouse") cancelPress();
      }}
      onMouseMove={(e) => {
        if (ptypeRef.current !== "mouse") return;
        moveCheck(e.clientX, e.clientY);
      }}
      onTouchStart={(e) => {
        if (ptypeRef.current === "mouse") return;
        ptypeRef.current = "touch";
        const t = e.touches[0];
        startPress(t.clientX, t.clientY);
      }}
      onTouchEnd={(e) => {
        if (ptypeRef.current !== "touch") return;
        e.preventDefault();
        endPress();
      }}
      onTouchMove={(e) => {
        if (ptypeRef.current !== "touch") return;
        const t = e.touches[0];
        moveCheck(t.clientX, t.clientY);
      }}
      onTouchCancel={cancelPress}
      style={{
        userSelect: "none",
        WebkitUserSelect: "none",
        position: "relative",
        overflow: "hidden",
        cursor: "pointer",
        transform: pressing ? "scale(0.985)" : "scale(1)",
        transition: "transform 0.1s ease",
      }}
      className={`ticket-row relative flex items-stretch border-b border-gray-100 cursor-pointer transition-colors ${isSelected ? "bg-[#eff2ff]" : "bg-white hover:bg-gray-50"}`}
    >
      {isSelected && (
        <div className="absolute left-0 top-0 bottom-0 w-[4px] bg-[#5b52e6]" />
      )}
      {pressing && (
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            height: "3px",
            width: `${progress}%`,
            background: DANGER_GRAD,
            zIndex: 2,
            borderRadius: "0 2px 2px 0",
          }}
        />
      )}
      {pressing && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `rgba(239,68,68,${Math.min((progress / 100) * 0.08, 0.08)})`,
            pointerEvents: "none",
            zIndex: 1,
          }}
        />
      )}

      <div className="flex-1 flex items-center gap-3 px-4 py-3 min-w-0 overflow-hidden">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-white font-bold text-base ${isSelected ? "bg-[#5b52e6]" : "bg-indigo-100 text-indigo-500"}`}
        >
          {getIcon(ticket.category)}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[11px] text-gray-400 shrink-0">
              #{ticket._id?.slice(-6)}
            </span>
            {ticket.unread && (
              <span className="w-2 h-2 rounded-full border border-white bg-blue-500 animate-pulse shrink-0" />
            )}
          </div>
          <p className="text-sm font-semibold text-gray-900 truncate leading-tight">
            {ticket.subject || ticket.category || "My Ticket"}
          </p>
          <p className="text-[11px] text-gray-400 truncate mt-0.5 leading-tight">
            {ticket.lastMessage || ticket.description || "No messages yet"}
          </p>
        </div>

        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap border ${statColor(ticket.status)}`}
          >
            {ticket.status || "Open"}
          </span>
          <span className="text-[11px] text-gray-400">
            {fmtTime(
              ticket.lastActivity || ticket.lastMessageTime || ticket.createdAt,
            )}
          </span>
        </div>
      </div>

      {pressing && progress > 30 && (
        <div
          style={{
            position: "absolute",
            top: 6,
            right: 6,
            background: "rgba(239,68,68,0.92)",
            color: "#fff",
            borderRadius: 6,
            padding: "2px 8px",
            fontSize: "0.62rem",
            fontWeight: 600,
            zIndex: 3,
          }}
        >
          🗑 Hold to delete
        </div>
      )}
    </div>
  );
};

// ─── Escalated Ticket Item ────────────────────────────────────────────────────
const EscTicketItem = ({
  ticket,
  isSelected,
  onSelect,
  priColor,
  statColor,
}) => {
  return (
    <div
      onClick={() => onSelect(ticket)}
      className={`ticket-row relative flex items-stretch border-b border-gray-100 cursor-pointer transition-colors ${isSelected ? "bg-[#fff2e5]" : "bg-white hover:bg-gray-50"}`}
    >
      {isSelected && (
        <div className="absolute left-0 top-0 bottom-0 w-[4px] bg-[#f97316]" />
      )}
      <div className="flex-1 flex items-center gap-3 px-4 py-3 min-w-0 overflow-hidden">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-white font-bold text-base ${isSelected ? "bg-[#f97316]" : "bg-orange-100 text-orange-500"}`}
        >
          {(ticket.studentName || "S").charAt(0).toUpperCase()}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[11px] text-gray-400 shrink-0">
              #{ticket._id?.slice(-6)}
            </span>
            {ticket.unread && (
              <span className="w-2 h-2 rounded-full border border-white bg-blue-500 animate-pulse shrink-0" />
            )}
          </div>
          <p className="text-sm font-semibold text-gray-900 truncate leading-tight">
            {ticket.studentName || "Student"}
          </p>
          <p className="text-[11px] text-gray-400 truncate mt-0.5 leading-tight">
            {(ticket.subject || ticket.category || "No subject")
              .replace("[Escalated] ", "")
              .replace("Internship Access - ", "")}
          </p>
        </div>

        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap border ${statColor(ticket.status)}`}
          >
            {ticket.status || "Open"}
          </span>
          <span className="text-[11px] text-gray-400">
            {fmtTime(ticket.lastActivity || ticket.createdAt)}
          </span>
        </div>
      </div>
    </div>
  );
};

// ─── Pagination Component ─────────────────────────────────────────────────────
const Pagination = ({ currentPage, totalPages, onPageChange, isEsc }) => {
  if (totalPages <= 1) return null;
  const accentColor = isEsc
    ? "bg-orange-500 text-white border-orange-500"
    : "bg-indigo-600 text-white border-indigo-600";
  const hoverColor = isEsc
    ? "hover:bg-orange-50 hover:text-orange-600 hover:border-orange-300"
    : "hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-300";
  const arrowActive = isEsc
    ? "text-orange-500 hover:bg-orange-50"
    : "text-indigo-600 hover:bg-indigo-50";

  return (
    <div className="flex items-center justify-center gap-1.5 py-2.5 px-3 border-t border-gray-100 bg-white flex-shrink-0">
      {/* Prev */}
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className={`w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 transition-all
          ${currentPage === 1 ? "text-gray-300 cursor-not-allowed bg-gray-50" : `${arrowActive} cursor-pointer`}`}
      >
        <FaChevronLeft className="w-2.5 h-2.5" />
      </button>

      {/* Page numbers */}
      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
        // Show first, last, current, and neighbors
        const show =
          page === 1 ||
          page === totalPages ||
          Math.abs(page - currentPage) <= 1;
        if (!show) {
          // Show ellipsis only once per gap
          if (page === 2 && currentPage > 3)
            return (
              <span
                key={`ellipsis-start`}
                className="text-gray-400 text-xs px-0.5"
              >
                …
              </span>
            );
          if (page === totalPages - 1 && currentPage < totalPages - 2)
            return (
              <span
                key={`ellipsis-end`}
                className="text-gray-400 text-xs px-0.5"
              >
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
                  ? accentColor
                  : `border-gray-200 text-gray-600 bg-white ${hoverColor}`
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
        className={`w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 transition-all
          ${currentPage === totalPages ? "text-gray-300 cursor-not-allowed bg-gray-50" : `${arrowActive} cursor-pointer`}`}
      >
        <FaChevronRight className="w-2.5 h-2.5" />
      </button>

      {/* Page label */}
      <span className="text-xs text-gray-400 ml-1">
        Page {currentPage}/{totalPages}
      </span>
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════════
const PartnerSupport = () => {
  const [mainTab, setMainTab] = useState("own"); // "own" | "escalated"
  const [ownTickets, setOwn] = useState([]);
  const [escTickets, setEsc] = useState([]);
  const [selTicket, setSelTicket] = useState(null);
  const [messages, setMessages] = useState({});
  const [msgInput, setMsgInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [atts, setAtts] = useState([]);
  const [replyTo, setReplyTo] = useState(null);
  const [connected, setConnected] = useState(false);
  const [deletingMsg, setDelMsg] = useState(null);
  const [search, setSearch] = useState("");
  const [fStatus] = useState("all");
  const [fPriority] = useState("all");
  const [fCategory] = useState("all");
  const [sortBy] = useState("newest");
  const [stats, setStats] = useState({
    total: 0,
    open: 0,
    inProgress: 0,
    resolved: 0,
    urgent: 0,
    unreadMessages: 0,
  });
  const [activeTab, setActiveTab] = useState("all");
  const [mobilePanel, setMobilePanel] = useState("list");
  const [showDetails, setShowDetails] = useState(false);
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [newTicket, setNewTicket] = useState({
    category: "",
    priority: "",
    description: "",
  });
  const [newTicketAtts, setNewTicketAtts] = useState([]);
  const newTicketFileRef = useRef(null);
  const [ticketToDelete, setTicketToDelete] = useState(null);
  const [deletingTicket, setDeletingTicket] = useState(null);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [alertModal, setAlertModal] = useState({
    show: false,
    title: "",
    message: "",
    type: "success",
  });
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);
  const showAlert = useCallback((title, message, type = "error") => {
    setAlertModal({ show: true, title, message, type });
  }, []);

  // ── Pagination state ────────────────────────────────────────────────────────
  const [ownPage, setOwnPage] = useState(1);
  const [escPage, setEscPage] = useState(1);

  const endRef = useRef(null);
  const socketRef = useRef(null);
  const selRef = useRef(null);
  const attsRef = useRef([]);
  const fileRef = useRef(null);
  const ownRef = useRef([]);
  const escRef = useRef([]);
  const authAlertShownRef = useRef(false);

  useEffect(() => {
    attsRef.current = atts;
  }, [atts]);
  useEffect(() => {
    ownRef.current = ownTickets;
  }, [ownTickets]);
  useEffect(() => {
    escRef.current = escTickets;
  }, [escTickets]);
  useEffect(() => {
    selRef.current = selTicket;
  }, [selTicket]);

  const user = getUser();
  const isEsc = mainTab === "escalated";
  const pBg = isEsc
    ? "from-orange-500 to-red-500"
    : "from-indigo-600 to-blue-600";
  const pRing = isEsc ? "focus:ring-orange-400" : "focus:ring-indigo-500";

  const scrollDown = useCallback(() => {
    setTimeout(
      () => endRef.current?.scrollIntoView({ behavior: "smooth" }),
      80,
    );
  }, []);

  const hdrs = useCallback(() => {
    const token = getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  const handleAuthError = useCallback(
    (err) => {
      const status = err?.response?.status;
      const code = err?.response?.data?.code;
      if (
        status !== 401 &&
        status !== 403 &&
        code !== "TOKEN_EXPIRED" &&
        code !== "NO_TOKEN"
      )
        return false;
      if (!authAlertShownRef.current) {
        authAlertShownRef.current = true;
        showAlert(
          "Session Expired",
          "Your partner session is missing or expired. Please sign in again.",
          "error",
        );
      }
      return true;
    },
    [showAlert],
  );

  // ── Socket ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const token = getToken();
    const cu = getUser();
    if (!token) {
      handleAuthError({
        response: { status: 401, data: { code: "NO_TOKEN" } },
      });
      return;
    }
    if (socketRef.current) socketRef.current.disconnect();

    socketRef.current = io(SOCKET_URL, {
      auth: { token, role: "partner" },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current.on("connect", () => {
      setConnected(true);
      if (cu?._id)
        socketRef.current.emit("join_partner_room", { partnerId: cu._id });
    });
    socketRef.current.on("connect_error", () => setConnected(false));
    socketRef.current.on("disconnect", () => setConnected(false));

    const bumpMsg = (ticketId, message, isOwnEv) => {
      const isSel = selRef.current?._id === ticketId;
      const setter = isOwnEv ? setOwn : setEsc;
      setMessages((p) => {
        const ex = p[ticketId] || [];
        if (ex.some((m) => m._id === message._id)) return p;
        return { ...p, [ticketId]: dedupMessages([...ex, message]) };
      });
      setter((prev) => {
        const idx = prev.findIndex((t) => t._id === ticketId);
        if (idx === -1) return prev;
        const upd = {
          ...prev[idx],
          lastMessage: message.text,
          lastActivity: new Date(),
        };
        if (!isSel && message.senderRole !== "partner") {
          upd.unread = true;
          upd.unreadCount = (prev[idx].unreadCount || 0) + 1;
        }
        return [upd, ...prev.filter((t) => t._id !== ticketId)];
      });
      if (isSel) scrollDown();
    };

    socketRef.current.on("partner_new_message", ({ ticketId, message }) =>
      bumpMsg(ticketId, message, true),
    );
    socketRef.current.on("new_message", ({ ticketId, message }) => {
      const isOwnTicket = ownRef.current.some((t) => t._id === ticketId);
      const isEscTicket = escRef.current.some((t) => t._id === ticketId);
      if (isOwnTicket) bumpMsg(ticketId, message, true);
      else if (isEscTicket) bumpMsg(ticketId, message, false);
    });

    socketRef.current.on("partner_new_ticket", ({ ticket }) => {
      if (!ticket) return;
      if (ticket.escalatedToPartner)
        setEsc((p) =>
          p.some((t) => t._id === ticket._id) ? p : [ticket, ...p],
        );
      else
        setOwn((p) =>
          p.some((t) => t._id === ticket._id) ? p : [ticket, ...p],
        );
    });

    socketRef.current.on("ticket_status_update", ({ ticketId, status }) => {
      const upd = (p) =>
        p.map((t) => (t._id === ticketId ? { ...t, status } : t));
      setOwn(upd);
      setEsc(upd);
      if (selRef.current?._id === ticketId)
        setSelTicket((p) => ({ ...p, status }));
    });

    socketRef.current.on("partner_message_deleted", ({ ticketId, messageId }) =>
      setMessages((p) => ({
        ...p,
        [ticketId]: (p[ticketId] || []).filter((m) => m._id !== messageId),
      })),
    );
    socketRef.current.on("message_deleted", ({ ticketId, messageId }) =>
      setMessages((p) => ({
        ...p,
        [ticketId]: (p[ticketId] || []).filter((m) => m._id !== messageId),
      })),
    );
    socketRef.current.on("partner_messages_read", ({ ticketId }) => {
      const upd = (p) =>
        p.map((t) =>
          t._id === ticketId ? { ...t, unread: false, unreadCount: 0 } : t,
        );
      setOwn(upd);
      setEsc(upd);
    });
    socketRef.current.on("partner_ticket_deleted_for_me", ({ ticketId }) => {
      setOwn((p) => p.filter((t) => t._id !== ticketId));
      if (selRef.current?._id === ticketId) setSelTicket(null);
    });
    socketRef.current.on("partner_ticket_deleted", ({ ticketId }) => {
      setOwn((p) => p.filter((t) => t._id !== ticketId));
      if (selRef.current?._id === ticketId) setSelTicket(null);
    });

    return () => socketRef.current?.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleAuthError]);

  useEffect(() => {
    if (socketRef.current?.connected && selTicket)
      socketRef.current.emit("join_ticket", selTicket._id);
    return () => {
      if (selTicket && socketRef.current?.connected)
        socketRef.current.emit("leave_ticket", selTicket._id);
    };
  }, [selTicket]);

  // ── Polling fallback ───────────────────────────────────────────────────────
  useEffect(() => {
    if (connected) return;
    const id = setInterval(() => {
      loadAllTickets();
      loadStats();
      if (selRef.current) loadMessages(selRef.current._id, false);
    }, 8000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected]);

  useEffect(() => {
    scrollDown();
  }, [messages, selTicket, scrollDown]);

  // ── API ────────────────────────────────────────────────────────────────────
  const loadStats = useCallback(async () => {
    try {
      const r = await axios.get(`${API_BASE}/stats`, { headers: hdrs() });
      setStats(r.data || {});
    } catch (err) {
      handleAuthError(err);
    }
  }, [hdrs, handleAuthError]);

  const loadAllTickets = useCallback(async () => {
    try {
      setLoading(true);
      const p = new URLSearchParams({
        limit: 100,
        status: fStatus !== "all" ? fStatus : "",
        search,
      });
      const r = await axios.get(`${API_BASE}/tickets?${p}`, {
        headers: hdrs(),
      });
      const all = r.data.tickets || [];
      const own = all.filter((t) => !isEscalated(t));
      const esc = all.filter((t) => isEscalated(t));
      setOwn(
        own.map((t) => ({
          ...t,
          unread: (t.unreadByPartner || 0) > 0,
          unreadCount: t.unreadByPartner || 0,
        })),
      );
      setEsc(
        esc.map((t) => ({
          ...t,
          unread: (t.unreadByPartner || 0) > 0,
          unreadCount: t.unreadByPartner || 0,
        })),
      );
      loadStats();
    } catch (err) {
      if (!handleAuthError(err)) console.error("loadAllTickets:", err);
    } finally {
      setLoading(false);
    }
  }, [fStatus, search, hdrs, loadStats, handleAuthError]);

  useEffect(() => {
    loadAllTickets();
  }, [loadAllTickets]);

  // Reset page to 1 when filters / tab / search changes
  useEffect(() => {
    setOwnPage(1);
  }, [activeTab, fStatus, fPriority, fCategory, search, sortBy]);
  useEffect(() => {
    setEscPage(1);
  }, [activeTab, fStatus, fPriority, fCategory, search, sortBy]);

  const markRead = useCallback(
    async (ticketId) => {
      try {
        const upd = (p) =>
          p.map((t) =>
            t._id === ticketId ? { ...t, unread: false, unreadCount: 0 } : t,
          );
        setOwn(upd);
        setEsc(upd);
        if (selRef.current?._id === ticketId)
          setSelTicket((p) => ({ ...p, unread: false, unreadCount: 0 }));
        await axios.patch(
          `${API_BASE}/tickets/${ticketId}/messages/read`,
          {},
          { headers: hdrs() },
        );
        loadStats();
      } catch {}
    },
    [hdrs, loadStats],
  );

  const loadMessages = useCallback(
    async (ticketId, showLoad = true) => {
      if (showLoad) setLoading(true);
      try {
        const r = await axios.get(`${API_BASE}/tickets/${ticketId}/messages`, {
          headers: hdrs(),
        });
        setMessages((p) => ({
          ...p,
          [ticketId]: dedupMessages(
            (r.data.messages || []).filter((m) => m.senderRole !== "system"),
          ),
        }));
        await markRead(ticketId);
        scrollDown();
      } catch (err) {
        console.error("loadMessages:", err);
      } finally {
        if (showLoad) setLoading(false);
      }
    },
    [hdrs, markRead, scrollDown],
  );

  const handleSelect = useCallback(
    (ticket) => {
      setSelTicket(ticket);
      setMobilePanel("chat");
      const upd = (p) =>
        p.map((t) =>
          t._id === ticket._id ? { ...t, unread: false, unreadCount: 0 } : t,
        );
      setOwn(upd);
      setEsc(upd);
      loadMessages(ticket._id);
    },
    [loadMessages],
  );

  // ── Delete Ticket ──────────────────────────────────────────────────────────
  const handleDeleteForMe = async () => {
    if (!ticketToDelete) return;
    setDeletingTicket("me");
    try {
      await axios.delete(`${API_BASE}/tickets/${ticketToDelete._id}?mode=me`, {
        headers: hdrs(),
      });
      setOwn((p) => p.filter((t) => t._id !== ticketToDelete._id));
      setMessages((p) => {
        const c = { ...p };
        delete c[ticketToDelete._id];
        return c;
      });
      if (selTicket?._id === ticketToDelete._id) setSelTicket(null);
    } catch (err) {
      alert("Failed: " + err?.response?.data?.message || err?.message);
    } finally {
      setDeletingTicket(null);
      setTicketToDelete(null);
      loadStats();
    }
  };

  const handleDeleteForEveryone = async () => {
    if (!ticketToDelete) return;
    setDeletingTicket("everyone");
    try {
      await axios.delete(
        `${API_BASE}/tickets/${ticketToDelete._id}?mode=everyone`,
        { headers: hdrs() },
      );
      setOwn((p) => p.filter((t) => t._id !== ticketToDelete._id));
      setMessages((p) => {
        const c = { ...p };
        delete c[ticketToDelete._id];
        return c;
      });
      if (selTicket?._id === ticketToDelete._id) setSelTicket(null);
    } catch (err) {
      alert("Failed: " + err?.response?.data?.message || err?.message);
    } finally {
      setDeletingTicket(null);
      setTicketToDelete(null);
      loadStats();
    }
  };

  // ── File picker (chat) ─────────────────────────────────────────────────────
  const handleFileChange = useCallback((e) => {
    const picked = Array.from(e.target.files || []);
    if (!picked.length) return;
    const MAX = 10 * 1024 * 1024;
    for (const f of picked) {
      if (f.size > MAX) {
        alert(`"${f.name}" exceeds 10 MB.`);
        if (fileRef.current) fileRef.current.value = "";
        return;
      }
    }
    const newAtts = picked.map((f) => ({
      id: `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: f.name,
      size: f.size,
      type: f.type,
      file: f,
    }));
    setAtts((prev) => {
      const u = [...prev, ...newAtts];
      attsRef.current = u;
      return u;
    });
    if (fileRef.current) fileRef.current.value = "";
  }, []);

  const removeAtt = useCallback((id) => {
    setAtts((prev) => {
      const u = prev.filter((a) => a.id !== id);
      attsRef.current = u;
      return u;
    });
  }, []);

  // ── File picker for new ticket modal ──────────────────────────────────────
  const handleNewTicketFileChange = useCallback((e) => {
    const picked = Array.from(e.target.files || []);
    if (!picked.length) return;
    const MAX = 10 * 1024 * 1024;
    for (const f of picked) {
      if (f.size > MAX) {
        alert(`"${f.name}" exceeds 10 MB.`);
        if (newTicketFileRef.current) newTicketFileRef.current.value = "";
        return;
      }
    }
    const mapped = picked.map((f) => ({
      id: `nt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: f.name,
      size: f.size,
      type: f.type,
      file: f,
    }));
    setNewTicketAtts((prev) => [...prev, ...mapped]);
    if (newTicketFileRef.current) newTicketFileRef.current.value = "";
  }, []);

  const removeNewTicketAtt = useCallback((id) => {
    setNewTicketAtts((prev) => prev.filter((a) => a.id !== id));
  }, []);

  // ── Send message ───────────────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    const txt = msgInput.trim();
    const curAtts = attsRef.current;
    if (!txt && curAtts.length === 0) return;
    if (!selTicket || sending) return;
    if (isTicketClosed(selTicket)) return;
    setSending(true);
    const savedReply = replyTo;
    const tempId = `temp_${Date.now()}`;
    const tempMsg = {
      _id: tempId,
      text: txt,
      senderName: user?.name || "Partner",
      senderRole: "partner",
      createdAt: new Date().toISOString(),
      read: true,
      isSending: true,
      attachments: curAtts.map((a) => ({
        filename: a.name,
        size: a.size,
        mimetype: a.type,
        type: a.type,
      })),
      replyTo: savedReply || null,
    };
    setMessages((p) => ({
      ...p,
      [selTicket._id]: dedupMessages([...(p[selTicket._id] || []), tempMsg]),
    }));
    setMsgInput("");
    setAtts([]);
    attsRef.current = [];
    setReplyTo(null);
    if (fileRef.current) fileRef.current.value = "";
    scrollDown();
    try {
      const fd = new FormData();
      if (txt) fd.append("text", txt);
      if (savedReply?._id) fd.append("replyTo", savedReply._id);
      for (const att of curAtts) {
        if (att.file instanceof File)
          fd.append("attachments", att.file, att.name);
      }
      const res = await axios.post(
        `${API_BASE}/tickets/${selTicket._id}/messages`,
        fd,
        { headers: hdrs() },
      );
      const serverMsg = res.data.message;
      setMessages((p) => ({
        ...p,
        [selTicket._id]: dedupMessages(
          (p[selTicket._id] || []).map((m) =>
            m._id === tempId ? serverMsg : m,
          ),
        ),
      }));
      scrollDown();
    } catch (err) {
      setMessages((p) => ({
        ...p,
        [selTicket._id]: (p[selTicket._id] || []).filter(
          (m) => m._id !== tempId,
        ),
      }));
      alert("Send failed: " + (err.response?.data?.message || err.message));
    } finally {
      setSending(false);
    }
  }, [msgInput, replyTo, selTicket, sending, user, scrollDown, hdrs]);

  const handleDownload = useCallback((att) => {
    downloadAttachment(att, getToken());
  }, []);

  const handleStatusChange = useCallback(
    async (ticketId, status) => {
      setStatusUpdating(true);
      try {
        await axios.patch(
          `${API_BASE}/tickets/${ticketId}/status`,
          { status },
          { headers: hdrs() },
        );
        const upd = (p) =>
          p.map((t) => (t._id === ticketId ? { ...t, status } : t));
        setOwn(upd);
        setEsc(upd);
        if (selRef.current?._id === ticketId)
          setSelTicket((p) => ({ ...p, status }));
      } catch {
        alert("Failed to update status");
      } finally {
        setStatusUpdating(false);
      }
    },
    [hdrs],
  );

  const handleDelete = useCallback(
    async (messageId) => {
      if (!window.confirm("Delete this message?")) return;
      setDelMsg(messageId);
      try {
        await axios.delete(
          `${API_BASE}/tickets/${selTicket._id}/messages/${messageId}`,
          { headers: hdrs() },
        );
        setMessages((p) => ({
          ...p,
          [selTicket._id]: (p[selTicket._id] || []).filter(
            (m) => m._id !== messageId,
          ),
        }));
      } catch {
        alert("Failed to delete");
      } finally {
        setDelMsg(null);
      }
    },
    [selTicket, hdrs],
  );

  // ── Create Ticket ──────────────────────────────────────────────────────────
  const handleCreateTicket = useCallback(async () => {
    if (
      !newTicket.category ||
      !newTicket.priority ||
      !newTicket.description?.trim()
    ) {
      showAlert("Required Fields", "Please fill all required fields", "error");
      return;
    }
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("category", newTicket.category);
      fd.append("priority", newTicket.priority);
      fd.append("description", newTicket.description);
      for (const att of newTicketAtts) {
        if (att.file instanceof File)
          fd.append("attachments", att.file, att.name);
      }
      const r = await axios.post(`${API_BASE}/tickets`, fd, {
        headers: hdrs(),
      });
      if (r.data.ticket) {
        const t = r.data.ticket;
        setOwn((p) =>
          p.some((existing) => existing._id === t._id) ? p : [t, ...p],
        );
        setSelTicket(t);
        setShowNewTicket(false);
        setNewTicket({ category: "", priority: "", description: "" });
        setNewTicketAtts([]);
        setMainTab("own");
        setMobilePanel("chat");
        if (r.data.initMessage)
          setMessages((p) => ({ ...p, [t._id]: [r.data.initMessage] }));
        setTimeout(() => loadMessages(t._id, false), 400);
        loadStats();
        showAlert(
          "Ticket Created Successfully",
          "Your ticket has been created! Our team will connect with you soon.",
          "success",
        );
      }
    } catch (err) {
      showAlert("Failed", err.response?.data?.message || err.message, "error");
    } finally {
      setLoading(false);
    }
  }, [newTicket, newTicketAtts, loadMessages, loadStats, showAlert, hdrs]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const getIcon = (cat) =>
    PARTNER_CATEGORIES.find((c) => c.id === cat)?.icon || (
      <FaQuestionCircle className="w-3 h-3 text-gray-500" />
    );
  const priColor = (p) =>
    PRIORITIES.find((x) => x.id === p?.toLowerCase())?.color ||
    "bg-gray-100 text-gray-800";
  const statColor = (s) =>
    STATUSES.find((x) => x.id === s?.toLowerCase())?.color ||
    "bg-gray-100 text-gray-800";

  const list = isEsc ? escTickets : ownTickets;
  const ownUnread = ownTickets.filter((t) => t.unread).length;
  const escUnread = escTickets.filter((t) => t.unread).length;

  const INNER = [
    { id: "all", label: `All (${list.length})` },
    {
      id: "unread",
      label: "Unread",
      badge: list.filter((t) => t.unread).length,
    },
    { id: "open", label: "Open" },
    {
      id: "urgent",
      label: "Urgent",
      badge: list.filter(
        (t) =>
          t.priority === "urgent" &&
          t.status !== "closed" &&
          t.status !== "resolved",
      ).length,
      bc: "bg-red-500",
    },
    { id: "in-progress", label: "In Progress" },
    { id: "resolved", label: "Resolved" },
  ];

  const filtered = list
    .filter((t) => {
      if (activeTab === "unread") return t.unread;
      if (activeTab === "open") return t.status === "open";
      if (activeTab === "urgent")
        return (
          t.priority === "urgent" &&
          t.status !== "closed" &&
          t.status !== "resolved"
        );
      if (activeTab === "in-progress") return t.status === "in-progress";
      if (activeTab === "resolved")
        return t.status === "resolved" || t.status === "closed";
      return true;
    })
    .filter((t) => {
      if (fStatus !== "all" && t.status !== fStatus) return false;
      if (fPriority !== "all" && t.priority !== fPriority) return false;
      if (fCategory !== "all" && t.category !== fCategory) return false;
      if (
        search &&
        !(
          t.subject ||
          t.category ||
          t.description ||
          t._id ||
          t.studentName ||
          ""
        )
          .toLowerCase()
          .includes(search.toLowerCase())
      )
        return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "oldest")
        return (
          new Date(a.lastActivity || a.createdAt || 0) -
          new Date(b.lastActivity || b.createdAt || 0)
        );
      if (sortBy === "priority") {
        const order = { urgent: 0, high: 1, medium: 2, low: 3 };
        return (order[a.priority] ?? 4) - (order[b.priority] ?? 4);
      }
      return (
        new Date(b.lastActivity || b.createdAt || 0) -
        new Date(a.lastActivity || a.createdAt || 0)
      );
    });

  // ── Pagination calculations ────────────────────────────────────────────────
  const currentPage = isEsc ? escPage : ownPage;
  const setPage = isEsc ? setEscPage : setOwnPage;
  const totalPages = Math.max(1, Math.ceil(filtered.length / TICKETS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const startIdx = (safePage - 1) * TICKETS_PER_PAGE;
  const paginated = filtered.slice(startIdx, startIdx + TICKETS_PER_PAGE);

  const handlePageChange = (page) => {
    if (page < 1 || page > totalPages) return;
    setPage(page);
  };

  const ownTicketClosed = isTicketClosed(selTicket);
  const canSend =
    (msgInput.trim().length > 0 || atts.length > 0) &&
    !sending &&
    !ownTicketClosed;

  // ── Scrollbar CSS injected once ────────────────────────────────────────────
  const scrollbarStyles = `
    .ticket-scroll::-webkit-scrollbar {
      width: 5px;
    }
    .ticket-scroll::-webkit-scrollbar-track {
      background: transparent;
    }
    .ticket-scroll::-webkit-scrollbar-thumb {
      background: #c7d2fe;
      border-radius: 99px;
      transition: background 0.2s;
    }
    .ticket-scroll::-webkit-scrollbar-thumb:hover {
      background: #818cf8;
    }
    .ticket-scroll-esc::-webkit-scrollbar {
      width: 5px;
    }
    .ticket-scroll-esc::-webkit-scrollbar-track {
      background: transparent;
    }
    .ticket-scroll-esc::-webkit-scrollbar-thumb {
      background: #fed7aa;
      border-radius: 99px;
    }
    .ticket-scroll-esc::-webkit-scrollbar-thumb:hover {
      background: #fb923c;
    }
    /* Firefox */
    .ticket-scroll {
      scrollbar-width: thin;
      scrollbar-color: #c7d2fe transparent;
    }
    .ticket-scroll-esc {
      scrollbar-width: thin;
      scrollbar-color: #fed7aa transparent;
    }
    @keyframes slideUp {
      from { transform: translateY(60px); opacity: 0; }
      to   { transform: translateY(0);    opacity: 1; }
    }
    @keyframes sa-ping-red {
      0%,100% { box-shadow:0 0 0 0 rgba(239,68,68,0.5); }
      50%      { box-shadow:0 0 0 4px rgba(239,68,68,0); }
    }
    .sa-ping-red  { animation:sa-ping-red 1.5s cubic-bezier(0,0,0.2,1) infinite; }
  `;

  return (
    <div className="h-full bg-gray-100 flex flex-col overflow-hidden">
      <style>{scrollbarStyles}</style>

      {/* ── Top Bar ── */}
      <div className="flex items-center justify-between px-5 py-2.5 bg-white border-b border-gray-200 shrink-0 shadow-sm z-40">
        {/* Left: Title */}
        <div className="flex items-center gap-4 flex-1">
          <div className="hidden lg:flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{
                background: "linear-gradient(135deg,#6366f1 0%,#4f46e5 100%)",
              }}
            >
              <FaHandshake className="text-white w-4 h-4" />
            </div>
            <div>
              <h1 className="text-base font-black text-gray-900 leading-tight">
                Partner Support Desk
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
          <div className="hidden sm:flex items-center gap-1.5">
            <div
              className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-green-500" : "bg-red-400"}`}
            />
            <span className="text-xs text-gray-400">
              {connected ? "Live" : "Connecting"}
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

          {!isEsc && !selTicket && (
            <button
              onClick={() => setShowNewTicket(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white font-bold text-xs transition-all hover:opacity-90 active:scale-[0.98]"
              style={{
                background: "linear-gradient(135deg,#6366f1 0%,#4f46e5 100%)",
                boxShadow: "0 2px 8px rgba(99,102,241,0.3)",
              }}
            >
              <FaPlus className="w-3 h-3" />
              <span className="hidden sm:inline">Create Ticket</span>
              <span className="sm:hidden">New</span>
            </button>
          )}
        </div>
      </div>

      {/* ── 2-panel body ── */}
      <div className="flex-1 flex overflow-hidden">
        {ticketToDelete && (
          <DeleteTicketModal
            ticket={ticketToDelete}
            onDeleteForMe={handleDeleteForMe}
            onDeleteForEveryone={handleDeleteForEveryone}
            onCancel={() => {
              if (!deletingTicket) setTicketToDelete(null);
            }}
            deleting={deletingTicket}
          />
        )}

        {/* LEFT: Ticket list */}
        <div
          className={`flex flex-col border-r border-gray-200 bg-white w-full lg:w-[320px] xl:w-[350px] shrink-0 ${mobilePanel === "list" ? "flex" : "hidden lg:flex"}`}
        >
          {/* List header */}
          <div className="px-4 pt-4 pb-3 border-b border-gray-100 shrink-0">
            {/* Tab switch */}
            <div className="flex space-x-2 mb-3">
              <button
                onClick={() => {
                  setMainTab("own");
                  setSelTicket(null);
                  setActiveTab("all");
                  setOwnPage(1);
                }}
                className={`flex-1 flex justify-center items-center px-3 py-2 rounded-xl font-semibold text-xs transition-all shadow-sm ${mainTab === "own" ? "bg-indigo-600 text-white shadow-md" : "bg-white text-gray-600 hover:bg-gray-50 border border-gray-200"}`}
              >
                <FaHeadset className="mr-1.5 w-3 h-3" />
                My Tickets
                {ownUnread > 0 && mainTab !== "own" && (
                  <span className="ml-1.5 bg-indigo-100 text-indigo-700 text-[10px] px-1.5 py-0.5 rounded-full">
                    {ownUnread}
                  </span>
                )}
              </button>
              <button
                onClick={() => {
                  setMainTab("escalated");
                  setSelTicket(null);
                  setActiveTab("all");
                  setEscPage(1);
                }}
                className={`flex-1 flex justify-center items-center px-3 py-2 rounded-xl font-semibold text-xs transition-all shadow-sm ${mainTab === "escalated" ? "bg-orange-500 text-white shadow-md" : "bg-white text-gray-600 hover:bg-gray-50 border border-gray-200"}`}
              >
                <FaFlag className="mr-1.5 w-3 h-3" />
                Escalated Tickets
                {escUnread > 0 && mainTab !== "escalated" && (
                  <span className="ml-1.5 bg-orange-100 text-orange-700 text-[10px] px-1.5 py-0.5 rounded-full">
                    {escUnread}
                  </span>
                )}
              </button>
            </div>

            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-bold text-gray-900">
                  {isEsc ? "Escalated Tickets" : "My Tickets"}
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  Sorted by latest activity
                </p>
              </div>
            </div>

            {/* Search */}
            <div className="relative">
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-3 h-3" />
              {/*Add !mt-0 for alignment - 07-8-2026 */}
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search tickets…"
                className="!mt-0 w-full border border-gray-200 rounded-lg pl-8 pr-3 py-2 text-xs bg-gray-50 outline-none focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
              />
            </div>

            {/* Tabs */}
            <div
              className="flex gap-1 mt-2.5 overflow-x-auto pb-0.5"
              style={{ scrollbarWidth: "none" }}
            >
              {INNER.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id);
                      setPage(1);
                    }}
                    className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      isActive
                        ? "bg-[#5b52e6] text-white shadow-sm"
                        : "bg-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    {tab.label} {(tab.badge || 0) > 0 ? `(${tab.badge})` : ""}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-gray-100 ticket-scroll">
            {filtered.length === 0 ? (
              <div className="p-8 text-center">
                <div
                  className={`w-12 h-12 mx-auto mb-3 rounded-full flex items-center justify-center ${isEsc ? "bg-orange-50" : "bg-indigo-50"}`}
                >
                  {isEsc ? (
                    <FaFlag className="w-6 h-6 text-orange-400" />
                  ) : (
                    <FaHeadset className="w-6 h-6 text-indigo-400" />
                  )}
                </div>
                <p className="text-xs text-gray-500">
                  {isEsc ? "No escalated tickets" : "No tickets found"}
                </p>
              </div>
            ) : (
              paginated.map((ticket) =>
                isEsc ? (
                  <EscTicketItem
                    key={ticket._id}
                    ticket={ticket}
                    isSelected={selTicket?._id === ticket._id}
                    onSelect={handleSelect}
                    priColor={priColor}
                    statColor={statColor}
                  />
                ) : (
                  <OwnTicketItem
                    key={ticket._id}
                    ticket={ticket}
                    isSelected={selTicket?._id === ticket._id}
                    onSelect={handleSelect}
                    onLongPress={(t) => setTicketToDelete(t)}
                    priColor={priColor}
                    statColor={statColor}
                    getIcon={getIcon}
                    aCol={"#5b52e6"}
                  />
                ),
              )
            )}
          </div>

          <Pagination
            currentPage={safePage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
            isEsc={isEsc}
          />
        </div>

        {/* RIGHT: Conversation & Details */}
        <div
          className={`flex-1 flex overflow-hidden bg-white ${mobilePanel === "chat" ? "flex" : "hidden lg:flex"}`}
        >
          {selTicket ? (
            <>
              <div className="bg-white flex flex-col overflow-hidden flex-1 border-r border-gray-200">
                {/* Chat Header */}
                <div
                  className={`p-3 border-b border-gray-200 flex-shrink-0 ${isEsc ? "bg-gradient-to-r from-orange-50 to-red-50" : "bg-gradient-to-r from-indigo-50 to-blue-50"}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-2.5">
                      <button
                        className="lg:hidden p-2 -ml-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
                        onClick={() => setMobilePanel("list")}
                      >
                        <FaArrowLeft className="w-4 h-4" />
                      </button>
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${isEsc ? "bg-orange-100" : "bg-indigo-100"}`}
                      >
                        {isEsc ? (
                          <FaFlag className="text-orange-500 w-3 h-3" />
                        ) : (
                          getIcon(selTicket.category)
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-gray-400">
                            #{selTicket._id?.slice(-6)}
                          </span>
                          <h3 className="font-bold text-gray-900 text-sm flex items-center gap-1.5">
                            {isEsc
                              ? selTicket.studentName || "Student"
                              : selTicket.subject ||
                                selTicket.category ||
                                "My Ticket"}
                            {isEsc && (
                              <span
                                className="text-white bg-orange-500 px-1.5 py-0.5 rounded-full flex items-center gap-0.5"
                                style={{ fontSize: "0.65rem" }}
                              >
                                <FaFlag className="w-2.5 h-2.5" />
                                Escalated
                              </span>
                            )}
                            {selTicket.unread && (
                              <span
                                className="w-2 h-2 rounded-full border border-white bg-blue-500 animate-pulse"
                                title="Unread message"
                              />
                            )}
                          </h3>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          {isEsc ? (
                            <select
                              value={selTicket.status}
                              onChange={(e) =>
                                handleStatusChange(
                                  selTicket._id,
                                  e.target.value,
                                )
                              }
                              disabled={statusUpdating}
                              className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border focus:ring-2 focus:ring-orange-400 cursor-pointer ${statColor(selTicket.status)}`}
                            >
                              <option value="open">Open</option>
                              <option value="in-progress">In Progress</option>
                              <option value="resolved">Resolved</option>
                            </select>
                          ) : (
                            <span
                              className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${statColor(selTicket.status)}`}
                            >
                              {selTicket.status || "Open"}
                            </span>
                          )}
                          <span
                            className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${priColor(selTicket.priority)}`}
                          >
                            {selTicket.priority || "Normal"}
                          </span>
                          {statusUpdating && (
                            <FaSpinner className="w-3 h-3 animate-spin text-gray-400" />
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          if (window.innerWidth < 1024)
                            setMobilePanel("detail");
                          else setShowDetails((prev) => !prev);
                        }}
                        className={`p-2 rounded-lg transition-colors ${showDetails ? "text-indigo-600 bg-indigo-50" : "text-gray-500 hover:text-gray-900 hover:bg-gray-100"}`}
                        title="Toggle Ticket Details"
                      >
                        <FaTag className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setSelTicket(null);
                          setMobilePanel("list");
                        }}
                        className="p-2 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"
                        title="Close Ticket"
                      >
                        <FaTimes className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Messages */}
                <div
                  className="flex-1 p-4 overflow-y-auto ticket-scroll"
                  style={{
                    background:
                      "linear-gradient(180deg,#f8f7ff 0%,#f1f0ff 100%)",
                  }}
                >
                  {loading ? (
                    <div className="flex justify-center items-center h-full">
                      <FaSpinner
                        className={`w-6 h-6 animate-spin ${isEsc ? "text-orange-500" : "text-indigo-600"}`}
                      />
                    </div>
                  ) : (
                    <>
                      {(!messages[selTicket._id] ||
                        messages[selTicket._id].length === 0) && (
                        <p className="text-center text-gray-400 text-sm mt-8">
                          No messages yet. Start the conversation!
                        </p>
                      )}
                      {(messages[selTicket._id] || []).map((msg) => (
                        <ChatBubble
                          key={`msg-${msg._id}`}
                          msg={msg}
                          user={user}
                          onReply={setReplyTo}
                          onDelete={handleDelete}
                          deletingMessage={deletingMsg}
                          onDownload={handleDownload}
                        />
                      ))}
                      <div ref={endRef} />
                    </>
                  )}
                </div>

                {/* Input */}
                {ownTicketClosed ? (
                  <ResolvedBanner
                    onRaiseNew={!isEsc ? () => setShowNewTicket(true) : null}
                  />
                ) : (
                  <>
                    {replyTo && (
                      <div className="px-3 py-1.5 bg-indigo-50 border-t border-indigo-100 flex items-center justify-between flex-shrink-0">
                        <div className="flex items-center text-xs text-indigo-700 gap-1.5">
                          <FaReply className="w-3 h-3" />
                          Replying: "{replyTo.text?.substring(0, 50)}…"
                        </div>
                        <button
                          onClick={() => setReplyTo(null)}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          <FaTimesCircle className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                    {atts.length > 0 && (
                      <div className="px-3 py-2 bg-gray-50 border-t border-gray-200 flex flex-wrap gap-2 flex-shrink-0">
                        {atts.map((att) => (
                          <div
                            key={att.id}
                            className="flex items-center bg-white border border-gray-200 rounded-lg px-2 py-1 gap-1.5 shadow-sm"
                          >
                            <FileTypeIcon
                              att={{ mimetype: att.type, filename: att.name }}
                              dark
                            />
                            <span
                              className="text-gray-700 truncate max-w-[100px]"
                              style={{ fontSize: "0.72rem" }}
                            >
                              {att.name}
                            </span>
                            <span
                              className="text-gray-400"
                              style={{ fontSize: "0.65rem" }}
                            >
                              {fmtSize(att.size)}
                            </span>
                            <button
                              onClick={() => removeAtt(att.id)}
                              className="text-red-400 hover:text-red-600 ml-0.5"
                            >
                              <FaTimesCircle className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="p-3 border-t border-gray-200 bg-white flex-shrink-0">
                      <div className="flex items-center gap-2">
                        <label
                          className="flex-shrink-0 p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-full cursor-pointer"
                          title="Attach files (max 10 MB each)"
                        >
                          <FaPaperclip className="w-4 h-4" />
                          <input
                            ref={fileRef}
                            type="file"
                            className="hidden"
                            multiple
                            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.webp,.csv,.txt,.xlsx,.xls,.zip"
                            onChange={handleFileChange}
                          />
                        </label>
                        <button
                          onClick={() => {
                            const SpeechRecognition =
                              window.SpeechRecognition ||
                              window.webkitSpeechRecognition;
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

                            let baseText = msgInput.trim();

                            recognition.onresult = (e) => {
                              let finalStr = "";
                              let interimStr = "";
                              for (
                                let i = e.resultIndex;
                                i < e.results.length;
                                i++
                              ) {
                                if (e.results[i].isFinal) {
                                  finalStr += e.results[i][0].transcript;
                                } else {
                                  interimStr += e.results[i][0].transcript;
                                }
                              }

                              if (finalStr) {
                                baseText =
                                  baseText + (baseText ? " " : "") + finalStr;
                                setMsgInput(
                                  baseText +
                                    (interimStr ? " " + interimStr : ""),
                                );
                              } else {
                                setMsgInput(
                                  baseText + (baseText ? " " : "") + interimStr,
                                );
                              }
                            };

                            recognition.onend = () => setIsListening(false);
                            recognition.onerror = () => setIsListening(false);

                            recognitionRef.current = recognition;
                            recognition.start();
                            setIsListening(true);
                          }}
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
                                : isEsc
                                  ? "#f97316"
                                  : "#6366f1",
                              transition: "all 0.15s",
                            }}
                          >
                            {isListening ? (
                              <FaMicrophoneSlash
                                style={{ width: 14, height: 14 }}
                              />
                            ) : (
                              <FaMicrophone style={{ width: 14, height: 14 }} />
                            )}
                          </div>
                        </button>
                        <input
                          type="text"
                          placeholder={
                            isListening
                              ? "Listening..."
                              : atts.length > 0
                                ? "Add a caption (optional)…"
                                : isEsc
                                  ? "Reply to student ticket…"
                                  : "Message to admin…"
                          }
                          className={`flex-1 border border-gray-300 rounded-full px-4 py-2 text-sm focus:ring-2 ${pRing} focus:border-transparent outline-none`}
                          value={msgInput}
                          onChange={(e) => setMsgInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              handleSend();
                            }
                          }}
                          disabled={sending}
                        />
                        <button
                          onClick={handleSend}
                          disabled={!canSend}
                          className={`flex-shrink-0 p-2.5 rounded-full transition-all ${canSend ? `bg-gradient-to-r ${pBg} text-white shadow hover:shadow-md hover:scale-105` : "bg-gray-200 text-gray-400 cursor-not-allowed"}`}
                        >
                          {sending ? (
                            <FaSpinner className="w-4 h-4 animate-spin" />
                          ) : (
                            <FaPaperPlane className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                      {atts.length > 0 && (
                        <p className="text-xs text-gray-400 mt-1 pl-10">
                          {atts.length} file{atts.length > 1 ? "s" : ""} ready —
                          press Enter or click send
                        </p>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* TICKET DETAILS SIDEBAR */}
              <div
                className={`
                flex flex-col border-l border-gray-200 bg-gray-50 overflow-y-auto ticket-scroll shrink-0
                w-full lg:w-[260px] xl:w-[280px]
                ${mobilePanel === "detail" ? "flex" : showDetails ? "hidden lg:flex" : "hidden"}
              `}
              >
                {/* Mobile back header */}
                <div className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-gray-100">
                  <button
                    onClick={() => setMobilePanel("chat")}
                    className="p-2 text-gray-500 hover:text-gray-900 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    <FaChevronLeft className="w-4 h-4" />
                  </button>
                  <h3 className="font-bold text-sm text-gray-900">
                    Ticket Details
                  </h3>
                </div>

                <div className="p-4 border-b border-gray-100">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                    Ticket ID
                  </p>
                  <p className="text-sm font-bold text-gray-900 font-mono">
                    #{selTicket._id?.slice(-6).toUpperCase()}
                  </p>
                </div>

                <div className="p-4 border-b border-gray-100">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-4">
                    Status
                  </p>
                  <div className="flex flex-col gap-0 relative">
                    {["open", "in-progress", "resolved", "closed"].map(
                      (step, idx, arr) => {
                        const curIdx = arr.indexOf(selTicket.status || "open");
                        const isPast = idx < curIdx;
                        const isCurrent = idx === curIdx;
                        const label =
                          step === "in-progress"
                            ? "In Progress"
                            : step.charAt(0).toUpperCase() + step.slice(1);
                        return (
                          <div
                            key={step}
                            className="flex items-start relative pb-4 last:pb-0"
                          >
                            {idx < arr.length - 1 && (
                              <div
                                className={`absolute top-5 left-2.5 w-[2px] h-full -ml-[1px] ${idx < curIdx ? "bg-indigo-500" : "bg-gray-200"}`}
                              />
                            )}
                            <div className="relative flex items-center justify-center w-5 h-5 shrink-0 mt-0.5">
                              <div
                                className={`w-3.5 h-3.5 rounded-full z-10 border-2 ${isCurrent ? "border-indigo-500 bg-white" : isPast ? "bg-indigo-500 border-indigo-500" : "border-gray-300 bg-white"}`}
                              />
                              {isCurrent && (
                                <div className="absolute inset-0 rounded-full border border-indigo-200 bg-indigo-100 opacity-50 scale-150" />
                              )}
                            </div>
                            <div className="ml-3 flex items-center gap-2">
                              <span
                                className={`text-sm ${isCurrent ? "font-bold text-indigo-600" : isPast ? "font-semibold text-gray-800" : "font-medium text-gray-400"}`}
                              >
                                {label}
                              </span>
                              {isCurrent && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-700">
                                  Current
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      },
                    )}
                  </div>
                </div>

                <div className="p-4 border-b border-gray-100">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">
                    Details
                  </p>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500">Priority</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${priColor(selTicket.priority)}`}
                      >
                        {selTicket.priority || "Normal"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500">Status</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${statColor(selTicket.status)}`}
                      >
                        {selTicket.status || "Open"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500">Category</span>
                      <span
                        className="text-xs font-semibold text-gray-800 text-right max-w-[120px] truncate"
                        title={selTicket.category}
                      >
                        {selTicket.category}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500">Routed to</span>
                      <span className="text-xs font-semibold text-gray-800">
                        {isEsc ? "Main Admin" : "Main Support"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-200">
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <FaEnvelope className="w-3 h-3" /> Messages
                      </span>
                      <span className="text-xs font-bold text-gray-800">
                        {(messages[selTicket._id] || []).length}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-4">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">
                    Timestamps
                  </p>
                  <div className="space-y-3">
                    <div>
                      <p className="text-[10px] text-gray-500 flex items-center gap-1 mb-0.5">
                        <FaClock className="w-2.5 h-2.5" /> Created
                      </p>
                      <p className="text-xs font-semibold text-gray-800">
                        {new Date(selTicket.createdAt).toLocaleString(
                          undefined,
                          { dateStyle: "medium", timeStyle: "short" },
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-500 flex items-center gap-1 mb-0.5">
                        <FaClock className="w-2.5 h-2.5" /> Last Activity
                      </p>
                      <p className="text-xs font-semibold text-gray-800">
                        {new Date(
                          selTicket.updatedAt || selTicket.createdAt,
                        ).toLocaleString(undefined, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col items-center justify-center flex-1 p-8 overflow-y-auto">
              <div className="text-center mb-8">
                <div
                  className={`w-20 h-20 mx-auto mb-5 rounded-full flex items-center justify-center ${isEsc ? "bg-gradient-to-br from-orange-100 to-red-100" : "bg-gradient-to-br from-indigo-100 to-blue-100"}`}
                >
                  {isEsc ? (
                    <FaFlag className="w-10 h-10 text-orange-500" />
                  ) : (
                    <FaHeadset className="w-10 h-10 text-indigo-600" />
                  )}
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  {isEsc ? "Escalated Tickets" : "My Support Tickets"}
                </h3>
                <p className="text-gray-500 text-sm max-w-md mx-auto">
                  {isEsc
                    ? "Select an escalated ticket to respond to student issues."
                    : "Select a ticket to view, or raise a new one."}
                </p>
                {!isEsc && (
                  <button
                    onClick={() => setShowNewTicket(true)}
                    className={`mt-5 px-5 py-2 text-white rounded-lg bg-gradient-to-r ${pBg} text-sm`}
                  >
                    <FaPlus className="inline mr-1.5 w-3 h-3" />
                    Raise Issue
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 w-full max-w-2xl">
                {[
                  {
                    label: "Total",
                    value: stats.total,
                    icon: <FaInbox className="w-4 h-4" />,
                    color: isEsc ? "orange" : "indigo",
                  },
                  {
                    label: "Open",
                    value: stats.open,
                    icon: <FaClock className="w-4 h-4" />,
                    color: "green",
                  },
                  {
                    label: "In Progress",
                    value: stats.inProgress,
                    icon: <FaHourglassHalf className="w-4 h-4" />,
                    color: "blue",
                  },
                  {
                    label: "Resolved",
                    value: stats.resolved,
                    icon: <FaCheckCircle className="w-4 h-4" />,
                    color: "purple",
                  },
                  {
                    label: "Urgent",
                    value: stats.urgent,
                    icon: <FaExclamationTriangle className="w-4 h-4" />,
                    color: "red",
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
      </div>

      {/* Drawer Panel for New Support Ticket */}
      <div
        className={`fixed inset-0 z-50 flex justify-end transition-opacity duration-300 ${showNewTicket ? "opacity-100" : "opacity-0 pointer-events-none"}`}
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]"
          onClick={() => {
            setShowNewTicket(false);
            setNewTicketAtts([]);
            if (newTicketFileRef.current) newTicketFileRef.current.value = "";
          }}
        />

        {/* Drawer Panel */}
        <div
          className={`relative bg-white shadow-2xl flex flex-col z-10 w-full sm:w-[480px] h-[100dvh] transform transition-transform duration-300 ${showNewTicket ? "translate-x-0" : "translate-x-full"}`}
        >
          <div
            className="flex items-center justify-between px-6 py-5 border-b border-white/20 shrink-0"
            style={{
              background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
            }}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
                <FaHeadset className="text-white w-5 h-5" />
              </div>
              <div>
                <h2 className="text-white font-bold text-base leading-tight">
                  New Support Ticket
                </h2>
                <p className="text-white/70 text-xs mt-0.5">
                  Fill in the details below to get help
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setShowNewTicket(false);
                setNewTicketAtts([]);
                if (newTicketFileRef.current)
                  newTicketFileRef.current.value = "";
              }}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-white/70 hover:text-white hover:bg-white/20 transition-colors ml-2 shrink-0"
            >
              <FaTimes className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 px-6 py-6 space-y-6 overflow-y-auto ticket-scroll">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Category <span className="text-red-500">*</span>
                </label>
                <select
                  value={newTicket.category}
                  onChange={(e) =>
                    setNewTicket({ ...newTicket, category: e.target.value })
                  }
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                >
                  <option value="">Select Category</option>
                  {PARTNER_CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Priority <span className="text-red-500">*</span>
                </label>
                <select
                  value={newTicket.priority}
                  onChange={(e) =>
                    setNewTicket({ ...newTicket, priority: e.target.value })
                  }
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                >
                  <option value="">Select Priority</option>
                  {PRIORITIES.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Description <span className="text-red-500">*</span>
              </label>
              <textarea
                value={newTicket.description}
                onChange={(e) =>
                  setNewTicket({ ...newTicket, description: e.target.value })
                }
                rows={5}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-y"
                placeholder="Describe your issue in detail…"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Attachments{" "}
                <span className="text-gray-400 font-normal">
                  (optional · max 10 MB each)
                </span>
              </label>

              {/* Staged files list */}
              {newTicketAtts.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {newTicketAtts.map((att) => (
                    <div
                      key={att.id}
                      className="flex items-center bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 gap-1.5 shadow-sm"
                    >
                      <FileTypeIcon
                        att={{ mimetype: att.type, filename: att.name }}
                        dark
                      />
                      <span
                        className="text-gray-700 truncate max-w-[120px]"
                        style={{ fontSize: "0.72rem" }}
                      >
                        {att.name}
                      </span>
                      <span
                        className="text-gray-400 flex-shrink-0"
                        style={{ fontSize: "0.65rem" }}
                      >
                        {fmtSize(att.size)}
                      </span>
                      <button
                        onClick={() => removeNewTicketAtt(att.id)}
                        className="text-red-400 hover:text-red-600 ml-0.5 flex-shrink-0"
                        title="Remove"
                      >
                        <FaTimesCircle className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Drop zone / click to pick */}
              <label className="flex items-center justify-center gap-2 w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all cursor-pointer group">
                <FaPaperclip className="w-4 h-4 group-hover:text-indigo-500 transition-colors" />
                <span className="group-hover:text-indigo-600 transition-colors">
                  {newTicketAtts.length === 0
                    ? "Click to attach files"
                    : `${newTicketAtts.length} file${newTicketAtts.length > 1 ? "s" : ""} attached — click to add more`}
                </span>
                <input
                  ref={newTicketFileRef}
                  type="file"
                  className="hidden"
                  multiple
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.webp,.csv,.txt,.xlsx,.xls,.zip"
                  onChange={handleNewTicketFileChange}
                />
              </label>
            </div>

            <div className="flex items-start gap-3 bg-indigo-50 border border-indigo-200 rounded-xl p-4">
              <FaInfoCircle className="text-indigo-600 w-4 h-4 mt-0.5 shrink-0" />
              <p className="text-sm text-indigo-700">
                Your ticket will be sent directly to the{" "}
                <strong>Main Admin</strong>.
              </p>
            </div>
          </div>

          <div className="p-5 border-t border-gray-100 bg-gray-50 flex justify-end space-x-3 shrink-0">
            <button
              onClick={() => {
                setShowNewTicket(false);
                setNewTicketAtts([]);
                if (newTicketFileRef.current)
                  newTicketFileRef.current.value = "";
              }}
              className="px-5 py-2.5 bg-white border border-gray-300 rounded-xl font-bold text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-all text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateTicket}
              disabled={
                loading ||
                !newTicket.category ||
                !newTicket.priority ||
                !newTicket.description?.trim()
              }
              className="px-5 py-2.5 text-white rounded-xl font-bold transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center text-sm"
              style={
                loading ||
                !newTicket.category ||
                !newTicket.priority ||
                !newTicket.description?.trim()
                  ? {
                      background: "#d1d5db",
                      color: "#9ca3af",
                      boxShadow: "none",
                      cursor: "not-allowed",
                    }
                  : {
                      background:
                        "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
                      boxShadow: "0 4px 12px rgba(99,102,241,0.3)",
                    }
              }
            >
              {loading ? (
                <FaSpinner className="animate-spin mr-2 w-4 h-4" />
              ) : (
                <FaCheck className="mr-2 w-4 h-4" />
              )}
              {loading ? "Submitting…" : "Submit Ticket"}
            </button>
          </div>
        </div>
      </div>
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
              style={{
                background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
                boxShadow: "0 4px 12px rgba(99,102,241,0.3)",
              }}
            >
              Okay
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PartnerSupport;
