// frontend/src/WebApp/Flows/SchoolAdminFlow/MainPage/pages/Support.js
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
  FaUserGraduate,
  FaQuestionCircle,
  FaBriefcase,
  FaUsers,
  FaUserTie,
  FaPaperclip,
  FaTimesCircle,
  FaSchool,
  FaReply,
  FaTrash,
  FaFlag,
  FaHourglassHalf,
  FaInbox,
  FaBug,
  FaLock,
  FaSpinner,
  FaInfoCircle,
  FaChevronLeft,
  FaChevronRight,
  FaPlus,
  FaCheck,
  FaHeadset,
  FaCheckDouble,
  FaFileCsv,
  FaCrown,
  FaFile,
  FaFilePdf,
  FaFileWord,
  FaFileAlt,
  FaImage,
  FaTimes,
  FaArrowLeft,
  FaCalendarAlt,
  FaHistory,
  FaTag,
  FaMicrophone,
  FaMicrophoneSlash,
} from "react-icons/fa";
import axios from "axios";
import io from "socket.io-client";
import logo from "../../../../../assets-webapp/skillnaav_final_logo.svg";

const BASE_URL = process.env.REACT_APP_API_BASE || "http://localhost:5000";
const STUDENT_API = `${BASE_URL}/api/support/school-admin`;
const OWN_API = `${BASE_URL}/api/support/school-admin/my-tickets`;
const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || BASE_URL;

const SENT_GRAD = "linear-gradient(135deg,#3b82f6 0%,#1d4ed8 100%)";
const RECEIVED_GRAD = "linear-gradient(135deg,#059669 0%,#0d9488 100%)";
const ADMIN_GRAD = "linear-gradient(135deg,#7c3aed 0%,#6d28d9 100%)";
const DANGER_GRAD = "linear-gradient(135deg,#ef4444 0%,#dc2626 100%)";

const LONG_PRESS_MS = 600;

const STUDENT_CATEGORIES = [
  {
    id: "Technical Issue",
    name: "Technical Issue",
    icon: <FaBug className="w-3 h-3 text-blue-500" />,
  },
  {
    id: "Billing & Payments",
    name: "Billing & Payments",
    icon: <FaCreditCard className="w-3 h-3 text-green-500" />,
  },
  {
    id: "Internship Access",
    name: "Internship Access",
    icon: <FaBriefcase className="w-3 h-3 text-purple-500" />,
  },
  {
    id: "Account Issue",
    name: "Account Issue",
    icon: <FaLock className="w-3 h-3 text-orange-500" />,
  },
  {
    id: "Student Management",
    name: "Student Management",
    icon: <FaUsers className="w-3 h-3 text-indigo-500" />,
  },
  {
    id: "General Inquiry",
    name: "General Inquiry",
    icon: <FaQuestionCircle className="w-3 h-3 text-gray-500" />,
  },
];

const SCHOOL_ADMIN_CATEGORIES = [
  {
    id: "Technical Issue",
    name: "Technical Issue",
    icon: <FaBug className="w-3 h-3 text-blue-500" />,
  },
  {
    id: "Account Issue",
    name: "Account Issue",
    icon: <FaLock className="w-3 h-3 text-orange-500" />,
  },
  {
    id: "Upload Credentials CSV",
    name: "Upload Credentials CSV",
    icon: <FaFileCsv className="w-3 h-3 text-green-500" />,
  },
  {
    id: "Subscription",
    name: "Subscription",
    icon: <FaCrown className="w-3 h-3 text-yellow-500" />,
  },
  {
    id: "User Management",
    name: "User Management",
    icon: <FaUsers className="w-3 h-3 text-indigo-500" />,
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
const normalizeSchool = (s) => (s || "").trim().toLowerCase();

const getToken = () =>
  localStorage.getItem("schoolAdminToken") ||
  localStorage.getItem("adminToken") ||
  localStorage.getItem("userToken") ||
  localStorage.getItem("token") ||
  null;

const getUser = () => {
  try {
    const s = localStorage.getItem("schoolAdminProfile");
    if (s) {
      const d = JSON.parse(s);
      const school = (d.schoolName || d.school || "").trim();
      return {
        _id: d._id,
        id: d._id,
        name:
          d.profile?.contactPerson || d.name || d.schoolName || "School Admin",
        email: d.email,
        school,
        schoolName: school,
        role: "school-admin",
      };
    }
    const u2 = localStorage.getItem("user");
    if (u2) {
      const u = JSON.parse(u2);
      const school = (u.schoolName || u.school || "").trim();
      return { ...u, school, schoolName: school };
    }
    return null;
  } catch {
    return null;
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

const resolveAttachmentId = (att) => {
  if (att._id) {
    if (typeof att._id === "string") return att._id;
    if (typeof att._id === "object")
      return att._id.$oid || att._id.toString?.() || String(att._id);
  }
  if (att.fileId && att.fileId !== "") return att.fileId;
  return null;
};
const isValidObjectId = (id) => id && /^[a-f\d]{24}$/i.test(String(id));
const buildAttachmentUrl = (att, baseApi) => {
  const id = resolveAttachmentId(att);
  if (!id) return null;
  if (isValidObjectId(id)) return `${baseApi}/file/${id}`;
  return `${BASE_URL}/api/support/file/${id}`;
};

const FileTypeIcon = ({ att }) => {
  const mime = att.mimetype || att.type || "";
  const name = att.filename || att.name || "";
  const ext = name.split(".").pop()?.toLowerCase();
  if (
    mime.startsWith("image/") ||
    ["png", "jpg", "jpeg", "gif", "webp"].includes(ext)
  )
    return <FaImage className="w-3 h-3 flex-shrink-0 text-blue-300" />;
  if (mime === "application/pdf" || ext === "pdf")
    return <FaFilePdf className="w-3 h-3 flex-shrink-0 text-red-300" />;
  if (["doc", "docx"].includes(ext) || mime?.includes("word"))
    return <FaFileWord className="w-3 h-3 flex-shrink-0 text-blue-200" />;
  if (ext === "txt" || mime === "text/plain")
    return <FaFileAlt className="w-3 h-3 flex-shrink-0 text-gray-300" />;
  return <FaFile className="w-3 h-3 flex-shrink-0 text-white/70" />;
};

// ─── FileTypeIcon for modal (dark background needs dark icon colors) ────────
const FileTypeIconDark = ({ att }) => {
  const mime = att.mimetype || att.type || "";
  const name = att.filename || att.name || "";
  const ext = name.split(".").pop()?.toLowerCase();
  if (
    mime.startsWith("image/") ||
    ["png", "jpg", "jpeg", "gif", "webp"].includes(ext)
  )
    return <FaImage className="w-3 h-3 flex-shrink-0 text-blue-500" />;
  if (mime === "application/pdf" || ext === "pdf")
    return <FaFilePdf className="w-3 h-3 flex-shrink-0 text-red-500" />;
  if (["doc", "docx"].includes(ext) || mime?.includes("word"))
    return <FaFileWord className="w-3 h-3 flex-shrink-0 text-blue-400" />;
  if (ext === "txt" || mime === "text/plain")
    return <FaFileAlt className="w-3 h-3 flex-shrink-0 text-gray-400" />;
  return <FaFile className="w-3 h-3 flex-shrink-0 text-gray-400" />;
};

const AttachmentChip = ({ att, onDownload, sending, baseApi }) => {
  const name = att.filename || att.name || "file";
  const attachId = resolveAttachmentId(att);
  const canDownload = !sending && !!attachId;
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
      onClick={canDownload ? () => onDownload(att, baseApi) : undefined}
      title={
        canDownload
          ? `Download ${name}`
          : sending
            ? "Uploading…"
            : "File ID missing"
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

const downloadAttachment = async (att, baseApi, token) => {
  if (!token) {
    alert("Not authenticated.");
    return;
  }
  const url = buildAttachmentUrl(att, baseApi);
  if (!url) {
    alert("File not available — attachment ID is missing.");
    return;
  }
  try {
    const res = await axios.get(url, {
      headers: { Authorization: `Bearer ${token}` },
      responseType: "blob",
    });
    const disposition = res.headers["content-disposition"] || "";
    const match = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
    const dlName = match
      ? decodeURIComponent(match[1].replace(/['"]/g, ""))
      : att.filename || att.name || "download";
    const blobUrl = URL.createObjectURL(
      new Blob([res.data], {
        type: res.headers["content-type"] || "application/octet-stream",
      }),
    );
    const link = document.createElement("a");
    link.href = blobUrl;
    link.setAttribute("download", dlName);
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      link.remove();
      URL.revokeObjectURL(blobUrl);
    }, 1500);
  } catch (err) {
    let msg = err?.message || "Unknown error";
    if (err?.response?.data instanceof Blob) {
      try {
        msg = await err.response.data.text();
      } catch (_) {}
    } else if (err?.response?.data?.message) {
      msg = err.response.data.message;
    }
    alert("Download failed: " + msg);
  }
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
      <p className="text-xs text-gray-500">
        Need more help?{" "}
        <button
          onClick={onRaiseNew}
          className="text-purple-600 font-semibold hover:underline focus:outline-none"
        >
          Open a new ticket.
        </button>
      </p>
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
  isOwn,
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
              Delete Issue?
            </h3>
            <p className="text-xs text-gray-500 text-center mb-2">
              Choose how you want to delete this issue.
            </p>
            <div className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 mb-4">
              <div className="flex items-center gap-2">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: isOwn ? ADMIN_GRAD : RECEIVED_GRAD }}
                >
                  <FaSchool className="text-white w-3 h-3" />
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className="font-semibold text-gray-800 truncate"
                    style={{ fontSize: "0.78rem" }}
                  >
                    {ticket.subject || ticket.category || "My Issue"}
                  </p>
                  <p
                    className="text-purple-600 truncate"
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
      <style>{`
        @keyframes slideUp {
          from { transform: translateY(60px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>
    </>
  );
};

// ─── Chat Bubble ──────────────────────────────────────────────────────────────
const ChatBubble = ({
  msg,
  user,
  selectedTicket,
  onReply,
  onDelete,
  deletingMessage,
  onDownload,
  baseApi,
}) => {
  const role = msg.senderRole;
  const isSA = role === "school-admin";
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

  const isMine = isSA;
  const grad = isSA ? SENT_GRAD : isAdmin ? ADMIN_GRAD : RECEIVED_GRAD;
  const shadow = isSA
    ? "0 3px 10px rgba(99,102,241,0.38)"
    : isAdmin
      ? "0 3px 10px rgba(124,58,237,0.35)"
      : "0 3px 10px rgba(5,150,105,0.30)";
  const label = isSA
    ? user?.name || "School Admin"
    : isAdmin
      ? "Main Admin"
      : msg.senderName || selectedTicket?.studentName || "Student";
  const nameClr = isSA
    ? "text-indigo-500"
    : isAdmin
      ? "text-purple-500"
      : "text-emerald-600";
  const Icon = isSA ? (
    <FaSchool className="w-3 h-3 text-white" />
  ) : isAdmin ? (
    <FaUserTie className="w-3 h-3 text-white" />
  ) : (
    <FaUserGraduate className="w-3 h-3 text-white" />
  );
  const atts = msg.attachments || [];

  const rawText = (msg.text || "").trim();
  const showText =
    atts.length > 0 && rawText === (atts[0]?.filename || atts[0]?.name || "")
      ? ""
      : rawText;

  return (
    <div
      className={`flex group mb-4 ${isMine ? "justify-end" : "justify-start"}`}
    >
      {!isMine && (
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
          className={`font-semibold mb-0.5 px-1 ${isMine ? "text-right" : "text-left"} ${nameClr}`}
          style={{ fontSize: "0.66rem" }}
        >
          {label}
        </p>
        <div
          style={{
            padding: "8px 12px",
            borderRadius: isMine ? "14px 14px 3px 14px" : "14px 14px 14px 3px",
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
                key={att._id || att.fileId || i}
                att={att}
                onDownload={(a, api) => onDownload(a, api)}
                sending={!!msg.isSending}
                baseApi={baseApi}
              />
            ))}
          {!showText && atts.length === 0 && (
            <p className="italic opacity-60" style={{ fontSize: "0.75rem" }}>
              (empty)
            </p>
          )}
          <div
            className={`flex items-center mt-1.5 gap-1 ${isMine ? "justify-end" : ""}`}
            style={{ opacity: 0.8 }}
          >
            <span style={{ fontSize: "0.62rem" }}>
              {fmtTime(msg.createdAt)}
            </span>
            {isMine &&
              (msg.isSending ? (
                <FaSpinner className="w-2 h-2 animate-spin" />
              ) : (
                <FaCheckDouble
                  className={`w-2 h-2 ${msg.read ? "text-blue-200" : ""}`}
                />
              ))}
            {!isMine && msg.read && (
              <span style={{ fontSize: "0.62rem" }}>✓ Read</span>
            )}
          </div>
        </div>
        <div className="absolute -bottom-6 right-0 hidden group-hover:flex items-center space-x-0.5 bg-white rounded-lg shadow-lg border border-gray-100 p-0.5 z-10">
          <button
            onClick={() => onReply(msg)}
            className="p-1 text-gray-500 hover:text-indigo-600 rounded"
          >
            <FaReply className="w-3 h-3" />
          </button>
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
        </div>
      </div>
      {isMine && (
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

// ─── OwnTicketItem — long-press deletes, tap selects ─────────────────────────
const OwnTicketItem = ({
  ticket,
  isSelected,
  onSelect,
  onLongPress,
  priColor,
  statColor,
  getIcon,
  badge,
  aCol,
}) => {
  const timerRef = useRef(null);
  const pressStartRef = useRef(0);
  const didLongPress = useRef(false);
  const pointerTypeRef = useRef(null);
  const startPosRef = useRef({ x: 0, y: 0 });
  const rafRef = useRef(null);
  const MOVE_THRESH = 8;

  const [pressing, setPressing] = useState(false);
  const [pressProgress, setPressProgress] = useState(0);

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
    setPressProgress(0);
  }, []);

  const animateBar = useCallback(() => {
    const pct = Math.min(
      ((Date.now() - pressStartRef.current) / LONG_PRESS_MS) * 100,
      100,
    );
    setPressProgress(pct);
    if (pct < 100) rafRef.current = requestAnimationFrame(animateBar);
  }, []);

  const startPress = useCallback(
    (clientX, clientY) => {
      didLongPress.current = false;
      pressStartRef.current = Date.now();
      startPosRef.current = { x: clientX, y: clientY };
      setPressing(true);
      setPressProgress(0);
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
    pointerTypeRef.current = null;
  }, [clearTimer, onSelect, ticket]);

  const cancelPress = useCallback(() => {
    clearTimer();
    didLongPress.current = false;
    pointerTypeRef.current = null;
  }, [clearTimer]);

  const onMouseDown = useCallback(
    (e) => {
      if (e.button !== 0) return;
      pointerTypeRef.current = "mouse";
      startPress(e.clientX, e.clientY);
    },
    [startPress],
  );
  const onMouseUp = useCallback(() => {
    if (pointerTypeRef.current !== "mouse") return;
    endPress();
  }, [endPress]);
  const onMouseLeave = useCallback(() => {
    if (pointerTypeRef.current === "mouse") cancelPress();
  }, [cancelPress]);
  const onMouseMove = useCallback(
    (e) => {
      if (pointerTypeRef.current !== "mouse") return;
      if (
        Math.abs(e.clientX - startPosRef.current.x) > MOVE_THRESH ||
        Math.abs(e.clientY - startPosRef.current.y) > MOVE_THRESH
      )
        cancelPress();
    },
    [cancelPress],
  );

  const onTouchStart = useCallback(
    (e) => {
      if (pointerTypeRef.current === "mouse") return;
      pointerTypeRef.current = "touch";
      const t = e.touches[0];
      startPress(t.clientX, t.clientY);
    },
    [startPress],
  );
  const onTouchEnd = useCallback(
    (e) => {
      if (pointerTypeRef.current !== "touch") return;
      e.preventDefault();
      endPress();
    },
    [endPress],
  );
  const onTouchMove = useCallback(
    (e) => {
      if (pointerTypeRef.current !== "touch") return;
      const t = e.touches[0];
      if (
        Math.abs(t.clientX - startPosRef.current.x) > MOVE_THRESH ||
        Math.abs(t.clientY - startPosRef.current.y) > MOVE_THRESH
      )
        cancelPress();
    },
    [cancelPress],
  );
  const onTouchCancel = useCallback(() => cancelPress(), [cancelPress]);

  return (
    <div
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseLeave}
      onMouseMove={onMouseMove}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onTouchMove={onTouchMove}
      onTouchCancel={onTouchCancel}
      className={`ticket-row relative flex items-stretch border-b border-gray-100 cursor-pointer transition-colors ${isSelected ? "bg-[#eff2ff]" : "bg-white hover:bg-gray-50"}`}
      style={{
        userSelect: "none",
        WebkitUserSelect: "none",
        position: "relative",
        overflow: "hidden",
        cursor: "pointer",
        transform: pressing ? "scale(0.985)" : "scale(1)",
        transition: "transform 0.1s ease",
      }}
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
            width: `${pressProgress}%`,
            background: DANGER_GRAD,
            transition: "none",
            borderRadius: "0 2px 2px 0",
            zIndex: 2,
          }}
        />
      )}
      {pressing && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `rgba(239,68,68,${Math.min((pressProgress / 100) * 0.08, 0.08)})`,
            pointerEvents: "none",
            zIndex: 1,
          }}
        />
      )}

      <div className="flex-1 flex items-center gap-3 px-4 py-3 min-w-0 overflow-hidden">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-white text-base ${isSelected ? "bg-[#5b52e6]" : "bg-indigo-100 text-indigo-500"}`}
        >
          {getIcon(ticket.category)}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[11px] text-gray-400 shrink-0">
              #{ticket._id?.slice(-6)}
            </span>
            {ticket.unread && (
              <span
                className={`w-2 h-2 rounded-full border border-white animate-pulse ${badge}`}
              />
            )}
          </div>
          <p className="text-sm font-semibold text-gray-900 truncate leading-tight">
            {ticket.subject || ticket.category || "My Issue"}
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
              ticket.lastMessageTime || ticket.updatedAt || ticket.createdAt,
            )}
          </span>
        </div>
      </div>
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════════
const SchoolAdminSupport = () => {
  const [mainTab, setMainTab] = useState("students");
  const [tickets, setTickets] = useState([]);
  const [ownTickets, setOwn] = useState([]);
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
  const [fCategory, setFCategory] = useState("all");
  const [sortBy] = useState("newest");
  const [stats, setStats] = useState({
    total: 0,
    open: 0,
    inProgress: 0,
    resolved: 0,
    urgent: 0,
    unreadMessages: 0,
  });
  const [ownStats, setOwnStats] = useState({
    total: 0,
    open: 0,
    inProgress: 0,
    resolved: 0,
    urgent: 0,
    unreadMessages: 0,
  });
  const [page, setPage] = useState(1);
  const [totPages, setTotPages] = useState(1);
  const [ownPage, setOwnPage] = useState(1);
  const [ownTot, setOwnTot] = useState(1);
  const [mobilePanel, setMobilePanel] = useState("list");
  const [showDetails, setShowDetails] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [activeTab, setActiveTab] = useState("all");
  const [escReason, setEscReason] = useState("");
  const [showEsc, setShowEsc] = useState(false);
  const [escalating, setEscalating] = useState(false);
  const [showRaise, setShowRaise] = useState(false);
  const [raiseData, setRaiseData] = useState({
    category: "",
    priority: "",
    message: "",
  });
  const [alertModal, setAlertModal] = useState({
    show: false,
    title: "",
    message: "",
    type: "success",
  });
  const showAlert = useCallback((title, message, type = "error") => {
    setAlertModal({ show: true, title, message, type });
  }, []);

  // ✅ NEW: attachment state for the Raise Issue modal
  const [raiseAtts, setRaiseAtts] = useState([]);
  const raiseAttsRef = useRef([]);
  const raiseFileRef = useRef(null);

  const [ticketToDelete, setTicketToDelete] = useState(null);
  const [deletingTicket, setDeletingTicket] = useState(null);
  const [isListening, setIsListening] = useState(false);

  const endRef = useRef(null);
  const socketRef = useRef(null);
  const selRef = useRef(null);
  const statsRef = useRef(null);
  const markReadRef = useRef(null);
  const attsRef = useRef([]);
  const fileRef = useRef(null);
  const ownRef = useRef([]);
  const recognitionRef = useRef(null);

  useEffect(() => {
    attsRef.current = atts;
  }, [atts]);
  useEffect(() => {
    ownRef.current = ownTickets;
  }, [ownTickets]);
  useEffect(() => {
    selRef.current = selTicket;
  }, [selTicket]);
  useEffect(() => {
    raiseAttsRef.current = raiseAtts;
  }, [raiseAtts]);

  const user = getUser();
  const school = user?.school || "Your School";
  const isOwn = mainTab === "own";

  const isTicketClosed = useCallback((ticket) => {
    if (!ticket) return false;
    return ticket.status === "resolved" || ticket.status === "closed";
  }, []);

  useEffect(() => {
    setFCategory("all");
  }, [mainTab]);

  const scrollDown = useCallback(() => {
    setTimeout(
      () => endRef.current?.scrollIntoView({ behavior: "smooth" }),
      80,
    );
  }, []);

  const baseFor = useCallback(
    (tid) =>
      ownRef.current.some((t) => t._id === tid) ? OWN_API : STUDENT_API,
    [],
  );

  const hdrs = useCallback(
    () => ({ Authorization: `Bearer ${getToken()}` }),
    [],
  );

  // ── Socket ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const token = getToken();
    const cu = getUser();
    if (!token || !cu) {
      setApiError("No token found");
      return;
    }
    if (socketRef.current) socketRef.current.disconnect();

    socketRef.current = io(SOCKET_URL, {
      auth: { token, role: "school-admin" },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current.on("connect", () => {
      setConnected(true);
      setApiError(null);
      socketRef.current.emit("join_school_admin_room", {
        school: normalizeSchool(cu.school || "").replace(/\s+/g, "_"),
      });
      statsRef.current?.();
    });
    socketRef.current.on("connect_error", (e) => {
      setConnected(false);
      setApiError(`Socket: ${e.message}`);
    });
    socketRef.current.on("disconnect", () => setConnected(false));

    socketRef.current.on("new_message", (data) => {
      const { ticketId, message } = data;
      if (!ticketId || !message) return;
      const isSel = selRef.current?._id === ticketId;
      setMessages((p) => {
        const ex = p[ticketId] || [];
        if (ex.some((m) => m._id === message._id)) return p;
        return { ...p, [ticketId]: dedupMessages([...ex, message]) };
      });
      const bumpToTop = (prev) => {
        const idx = prev.findIndex((t) => t._id === ticketId);
        if (idx === -1) return prev;
        const updated = {
          ...prev[idx],
          lastMessage: message.text,
          lastMessageTime: message.createdAt,
        };
        if (message.senderRole !== "school-admin") {
          if (isSel) {
            markReadRef.current?.(ticketId);
            updated.unread = false;
            updated.unreadCount = 0;
          } else {
            updated.unread = true;
            updated.unreadCount = (prev[idx].unreadCount || 0) + 1;
          }
        }
        return [updated, ...prev.filter((t) => t._id !== ticketId)];
      };
      setTickets(bumpToTop);
      setOwn(bumpToTop);
      if (isSel) scrollDown();
      statsRef.current?.();
    });

    socketRef.current.on("ticket_deleted", ({ ticketId }) => {
      setTickets((p) => p.filter((t) => t._id !== ticketId));
      setOwn((p) => p.filter((t) => t._id !== ticketId));
      if (selRef.current?._id === ticketId) setSelTicket(null);
    });

    socketRef.current.on(
      "ticket_status_update",
      ({ ticketId, status, message }) => {
        const upd = (p) =>
          p.map((t) => (t._id === ticketId ? { ...t, status } : t));
        setTickets(upd);
        setOwn(upd);
        if (selRef.current?._id === ticketId)
          setSelTicket((p) => ({ ...p, status }));
        if (message)
          setMessages((p) => ({
            ...p,
            [ticketId]: dedupMessages([...(p[ticketId] || []), message]),
          }));
      },
    );

    socketRef.current.on("messages_read", ({ ticketId }) => {
      const upd = (p) =>
        p.map((t) =>
          t._id === ticketId ? { ...t, unread: false, unreadCount: 0 } : t,
        );
      setTickets(upd);
      setOwn(upd);
      if (selRef.current?._id === ticketId)
        setSelTicket((p) => ({ ...p, unread: false, unreadCount: 0 }));
      statsRef.current?.();
    });

    socketRef.current.on("new_ticket", ({ ticket }) => {
      if (!ticket) return;
      if (ticket.raisedBySchoolAdmin)
        setOwn((p) =>
          p.some((t) => t._id === ticket._id) ? p : [ticket, ...p],
        );
      else {
        if (normalizeSchool(ticket.school) !== normalizeSchool(school)) return;
        setTickets((p) =>
          p.some((t) => t._id === ticket._id) ? p : [ticket, ...p],
        );
      }
      statsRef.current?.();
    });

    socketRef.current.on("ticket_escalated", (d) => {
      if (!d.ticketId) return;
      if (d.message)
        setMessages((p) => ({
          ...p,
          [d.ticketId]: dedupMessages([...(p[d.ticketId] || []), d.message]),
        }));
      const upd = (p) =>
        p.map((t) =>
          t._id === d.ticketId
            ? { ...t, escalated: true, escalationReason: d.reason || "" }
            : t,
        );
      setTickets(upd);
      setOwn(upd);
      if (selRef.current?._id === d.ticketId)
        setSelTicket((p) => ({
          ...p,
          escalated: true,
          escalationReason: d.reason || "",
        }));
      statsRef.current?.();
    });

    socketRef.current.on("message_deleted", ({ messageId, ticketId }) => {
      setMessages((p) => ({
        ...p,
        [ticketId]: (p[ticketId] || []).filter((m) => m._id !== messageId),
      }));
    });

    return () => socketRef.current?.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (socketRef.current?.connected && selTicket)
      socketRef.current.emit("join_ticket", selTicket._id);
    return () => {
      if (selTicket && socketRef.current?.connected)
        socketRef.current.emit("leave_ticket", selTicket._id);
    };
  }, [selTicket]);

  useEffect(() => {
    if (mainTab === "students") loadTickets();
    else loadOwnTickets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mainTab, page, ownPage, fStatus, fPriority, fCategory, sortBy, search]);

  useEffect(() => {
    if (connected) return;
    const id = setInterval(() => {
      if (selRef.current) loadMessages(selRef.current._id, false);
      if (mainTab === "students") loadTickets();
      else loadOwnTickets();
      loadStats();
    }, 5000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, mainTab]);

  useEffect(() => {
    scrollDown();
  }, [messages, selTicket, scrollDown]);

  // ── API ────────────────────────────────────────────────────────────────────
  const loadStats = useCallback(async () => {
    try {
      const r = await axios.get(`${STUDENT_API}/stats`, { headers: hdrs() });
      setStats(r.data.stats || {});
    } catch {}
  }, [hdrs]);
  useEffect(() => {
    statsRef.current = loadStats;
  }, [loadStats]);

  const loadOwnStats = useCallback(async () => {
    try {
      const r = await axios.get(`${OWN_API}/stats`, { headers: hdrs() });
      setOwnStats(r.data.stats || {});
    } catch {}
  }, [hdrs]);

  const loadTickets = useCallback(async () => {
    try {
      if (!getToken()) {
        setApiError("No token");
        return;
      }
      const p = new URLSearchParams({
        page,
        limit: 20,
        status: fStatus !== "all" ? fStatus : "",
        priority: fPriority !== "all" ? fPriority : "",
        category: fCategory !== "all" ? fCategory : "",
        sort: sortBy,
        search,
      });
      const r = await axios.get(`${STUDENT_API}/tickets?${p}`, {
        headers: hdrs(),
      });
      setTickets(r.data.tickets || []);
      setTotPages(r.data.totalPages || 1);
      setApiError(null);
      loadStats();
    } catch (err) {
      if (err.response?.status === 401) setApiError("Unauthorized");
      else if (err.response?.status === 403) setApiError("Forbidden");
      else setApiError("Failed to load tickets");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, fStatus, fPriority, fCategory, sortBy, search]);

  const loadOwnTickets = useCallback(async () => {
    try {
      if (!getToken()) {
        setApiError("No token");
        return;
      }
      const p = new URLSearchParams({
        page: ownPage,
        limit: 20,
        status: fStatus !== "all" ? fStatus : "",
        priority: fPriority !== "all" ? fPriority : "",
        category: fCategory !== "all" ? fCategory : "",
        sort: sortBy,
        search,
      });
      const r = await axios.get(`${OWN_API}?${p}`, { headers: hdrs() });
      setOwn(r.data.tickets || []);
      setOwnTot(r.data.totalPages || 1);
      setApiError(null);
      loadOwnStats();
    } catch (err) {
      if (err.response?.status === 401) setApiError("Unauthorized");
      else setApiError("Failed to load tickets");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownPage, fStatus, fPriority, fCategory, sortBy, search]);

  const markRead = useCallback(
    async (ticketId) => {
      try {
        const base = baseFor(ticketId);
        const upd = (p) =>
          p.map((t) =>
            t._id === ticketId ? { ...t, unread: false, unreadCount: 0 } : t,
          );
        setTickets(upd);
        setOwn(upd);
        if (selRef.current?._id === ticketId)
          setSelTicket((p) => ({ ...p, unread: false, unreadCount: 0 }));
        await axios.post(
          `${base}/mark-read/${ticketId}`,
          {},
          { headers: hdrs() },
        );
        statsRef.current?.();
      } catch {}
    },
    [baseFor, hdrs],
  );
  useEffect(() => {
    markReadRef.current = markRead;
  }, [markRead]);

  const loadMessages = useCallback(
    async (ticketId, showLoad = true) => {
      if (showLoad) setLoading(true);
      try {
        const base = baseFor(ticketId);
        const r = await axios.get(`${base}/messages/${ticketId}`, {
          headers: hdrs(),
        });
        setMessages((p) => ({
          ...p,
          [ticketId]: dedupMessages(r.data.messages || []),
        }));
        await markRead(ticketId);
        scrollDown();
      } catch (err) {
        console.error("loadMessages:", err);
      } finally {
        if (showLoad) setLoading(false);
      }
    },
    [baseFor, hdrs, markRead, scrollDown],
  );

  const handleSelect = useCallback(
    (ticket) => {
      if (!ticket) return;
      setSelTicket(ticket);
      setMobilePanel("chat");
      setMsgInput("");
      const upd = (p) =>
        p.map((t) =>
          t._id === ticket._id ? { ...t, unread: false, unreadCount: 0 } : t,
        );
      setTickets(upd);
      setOwn(upd);
      loadMessages(ticket._id);
    },
    [loadMessages],
  );

  // ── Delete for Me ──────────────────────────────────────────────────────────
  const handleDeleteForMe = async () => {
    if (!ticketToDelete) return;
    setDeletingTicket("me");
    try {
      setOwn((prev) => prev.filter((t) => t._id !== ticketToDelete._id));
      setMessages((prev) => {
        const c = { ...prev };
        delete c[ticketToDelete._id];
        return c;
      });
      if (selTicket?._id === ticketToDelete._id) setSelTicket(null);
    } catch (err) {
      alert("Failed: " + (err?.message || "Unknown error"));
    } finally {
      setDeletingTicket(null);
      setTicketToDelete(null);
      loadOwnStats();
    }
  };

  // ── Delete for Everyone ────────────────────────────────────────────────────
  const handleDeleteForEveryone = async () => {
    if (!ticketToDelete) return;
    setDeletingTicket("everyone");
    try {
      const token = getToken();
      if (!token) {
        alert("Please login again");
        return;
      }
      await axios.delete(`${OWN_API}/ticket/${ticketToDelete._id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setOwn((prev) => prev.filter((t) => t._id !== ticketToDelete._id));
      setMessages((prev) => {
        const c = { ...prev };
        delete c[ticketToDelete._id];
        return c;
      });
      if (selTicket?._id === ticketToDelete._id) setSelTicket(null);
      loadOwnStats();
    } catch (err) {
      alert(
        "Failed to delete: " +
          (err?.response?.data?.message || err?.message || "Unknown error"),
      );
    } finally {
      setDeletingTicket(null);
      setTicketToDelete(null);
    }
  };

  const handleCancelDeleteTicket = () => {
    if (!deletingTicket) setTicketToDelete(null);
  };

  // ── File picker (chat) ─────────────────────────────────────────────────────
  const handleFileChange = useCallback((e) => {
    const picked = Array.from(e.target.files || []);
    if (!picked.length) return;
    if (attsRef.current.length + picked.length > 10) {
      alert("Maximum 10 files per message.");
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
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
      const updated = [...prev, ...newAtts];
      attsRef.current = updated;
      return updated;
    });
    if (fileRef.current) fileRef.current.value = "";
  }, []);

  const removeAtt = useCallback((id) => {
    setAtts((prev) => {
      const updated = prev.filter((a) => a.id !== id);
      attsRef.current = updated;
      return updated;
    });
  }, []);

  // ✅ NEW: File picker for Raise Issue modal ─────────────────────────────────
  const handleRaiseFileChange = useCallback((e) => {
    const picked = Array.from(e.target.files || []);
    if (!picked.length) return;
    if (raiseAttsRef.current.length + picked.length > 10) {
      alert("Maximum 10 files per message.");
      if (raiseFileRef.current) raiseFileRef.current.value = "";
      return;
    }
    const MAX = 10 * 1024 * 1024;
    for (const f of picked) {
      if (f.size > MAX) {
        alert(`"${f.name}" exceeds 10 MB.`);
        if (raiseFileRef.current) raiseFileRef.current.value = "";
        return;
      }
    }
    const newAtts = picked.map((f) => ({
      id: `raise_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: f.name,
      size: f.size,
      type: f.type,
      file: f,
    }));
    setRaiseAtts((prev) => {
      const updated = [...prev, ...newAtts];
      raiseAttsRef.current = updated;
      return updated;
    });
    if (raiseFileRef.current) raiseFileRef.current.value = "";
  }, []);

  const removeRaiseAtt = useCallback((id) => {
    setRaiseAtts((prev) => {
      const updated = prev.filter((a) => a.id !== id);
      raiseAttsRef.current = updated;
      return updated;
    });
  }, []);

  const handleLongPressOwn = useCallback((ticket) => {
    setTicketToDelete(ticket);
  }, []);

  // ── Send message ───────────────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    const txt = msgInput.trim();
    const curAtts = attsRef.current;
    if (!txt && curAtts.length === 0) return;
    if (!selTicket || sending) return;
    if (isOwn && isTicketClosed(selTicket)) return;
    setSending(true);
    const savedReply = replyTo;
    const ticketIsOwn = ownRef.current.some((t) => t._id === selTicket._id);
    const tempId = `temp_${Date.now()}`;
    const tempMsg = {
      _id: tempId,
      text: txt,
      senderName: user?.name || "School Admin",
      senderRole: "school-admin",
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
    const now = new Date().toISOString();
    const bumpSent = (prev) => {
      const idx = prev.findIndex((t) => t._id === selTicket._id);
      if (idx === -1) return prev;
      const updated = {
        ...prev[idx],
        lastMessage: txt || curAtts[0]?.name || "",
        lastMessageTime: now,
      };
      return [updated, ...prev.filter((t) => t._id !== selTicket._id)];
    };
    setTickets(bumpSent);
    setOwn(bumpSent);
    try {
      const base = ticketIsOwn ? OWN_API : STUDENT_API;
      const fd = new FormData();
      fd.append("text", txt || "");
      if (savedReply?._id) fd.append("replyTo", savedReply._id);
      for (const att of curAtts) {
        if (att.file instanceof File) fd.append("files", att.file, att.name);
      }
      const res = await axios.post(`${base}/message/${selTicket._id}`, fd, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
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
      console.error("[send] error:", err.response?.data || err.message);
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
  }, [
    msgInput,
    replyTo,
    selTicket,
    sending,
    user,
    scrollDown,
    isOwn,
    isTicketClosed,
  ]);

  const handleDownload = useCallback(
    async (att, api) => {
      const token = getToken();
      const baseApi =
        api || (selRef.current ? baseFor(selRef.current._id) : STUDENT_API);
      await downloadAttachment(att, baseApi, token);
    },
    [baseFor],
  );

  const handleStatusChange = useCallback(
    async (ticketId, status) => {
      try {
        const base = baseFor(ticketId);
        const r = await axios.put(
          `${base}/ticket/${ticketId}/status`,
          { status },
          { headers: hdrs() },
        );
        const upd = (p) =>
          p.map((t) => (t._id === ticketId ? { ...t, status } : t));
        setTickets(upd);
        setOwn(upd);
        if (selRef.current?._id === ticketId)
          setSelTicket((p) => ({ ...p, status }));
        if (r.data.systemMessage)
          setMessages((p) => ({
            ...p,
            [ticketId]: dedupMessages([
              ...(p[ticketId] || []),
              r.data.systemMessage,
            ]),
          }));
      } catch {
        alert("Failed to update status");
      }
    },
    [baseFor, hdrs],
  );

  const handleEscalate = useCallback(async () => {
    if (!selTicket || !escReason.trim()) {
      alert("Enter a reason");
      return;
    }
    setEscalating(true);
    try {
      const r = await axios.post(
        `${STUDENT_API}/ticket/${selTicket._id}/escalate`,
        { reason: escReason },
        { headers: hdrs() },
      );
      const upd = (p) =>
        p.map((t) =>
          t._id === selTicket._id
            ? { ...t, escalated: true, escalationReason: escReason.trim() }
            : t,
        );
      setTickets(upd);
      setOwn(upd);
      setSelTicket((p) => ({
        ...p,
        escalated: true,
        escalationReason: escReason.trim(),
      }));
      if (r.data.systemMessage)
        setMessages((p) => ({
          ...p,
          [selTicket._id]: dedupMessages([
            ...(p[selTicket._id] || []),
            r.data.systemMessage,
          ]),
        }));
      setShowEsc(false);
      setEscReason("");
      alert("✅ Escalated successfully");
    } catch (err) {
      alert("Failed: " + (err.response?.data?.message || err.message));
    } finally {
      setEscalating(false);
    }
  }, [selTicket, escReason, hdrs]);

  // ✅ UPDATED: handleRaiseIssue now sends files via FormData
  const handleRaiseIssue = useCallback(async () => {
    if (
      !raiseData.category ||
      !raiseData.priority ||
      !raiseData.message?.trim()
    ) {
      showAlert("Required Fields", "Please fill all required fields", "error");
      return;
    }
    try {
      setLoading(true);

      const fd = new FormData();
      fd.append("subject", raiseData.category);
      fd.append("category", raiseData.category);
      fd.append("priority", raiseData.priority);
      fd.append("message", raiseData.message);
      fd.append("raisedBySchoolAdmin", "true");

      // ── Append any staged attachments ──────────────────────────────────
      for (const att of raiseAttsRef.current) {
        if (att.file instanceof File) fd.append("files", att.file, att.name);
      }

      const r = await axios.post(`${STUDENT_API}/raise-issue`, fd, {
        headers: {
          Authorization: `Bearer ${getToken()}`,
          // Do NOT set Content-Type — axios sets multipart/form-data automatically
        },
      });

      if (r.data.success) {
        const newTkt = r.data.ticket;
        setOwn((p) =>
          p.some((t) => t._id === newTkt._id) ? p : [newTkt, ...p],
        );
        setSelTicket(newTkt);
        setShowRaise(false);
        setRaiseData({ category: "", priority: "", message: "" });
        setRaiseAtts([]);
        raiseAttsRef.current = [];
        if (raiseFileRef.current) raiseFileRef.current.value = "";
        setMainTab("own");
        setMobilePanel("chat");
        loadOwnStats();
        showAlert(
          "Ticket Created Successfully",
          "Your ticket has been created! Our team will connect with you soon.",
          "success",
        );
        setTimeout(() => {
          loadMessages(newTkt._id);
        }, 300);
      }
    } catch (err) {
      showAlert("Failed", err.response?.data?.message || err.message, "error");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raiseData, loadOwnStats, loadMessages, showAlert]);

  const handleDelete = useCallback(
    async (messageId) => {
      if (!window.confirm("Delete this message?")) return;
      setDelMsg(messageId);
      try {
        const base = selTicket ? baseFor(selTicket._id) : STUDENT_API;
        await axios.delete(`${base}/message/${messageId}`, { headers: hdrs() });
        if (selRef.current)
          setMessages((p) => ({
            ...p,
            [selRef.current._id]: (p[selRef.current._id] || []).filter(
              (m) => m._id !== messageId,
            ),
          }));
      } catch {
        alert("Failed to delete");
      } finally {
        setDelMsg(null);
      }
    },
    [selTicket, baseFor, hdrs],
  );

  // ── Derived ────────────────────────────────────────────────────────────────
  const getIcon = (cat) =>
    [...SCHOOL_ADMIN_CATEGORIES, ...STUDENT_CATEGORIES].find(
      (c) => c.id === cat,
    )?.icon || <FaQuestionCircle className="w-3 h-3 text-gray-500" />;
  const priColor = (p) =>
    PRIORITIES.find((x) => x.id === p?.toLowerCase())?.color ||
    "bg-gray-100 text-gray-800";
  const statColor = (s) =>
    STATUSES.find((x) => x.id === s?.toLowerCase())?.color ||
    "bg-gray-100 text-gray-800";

  const list = isOwn ? ownTickets : tickets;
  const curPage = isOwn ? ownPage : page;
  const curTot = isOwn ? ownTot : totPages;
  const setCurPage = isOwn ? setOwnPage : setPage;
  const curStats = isOwn ? ownStats : stats;
  const unread = list.filter((t) => t.unread).length;
  const escalated = !isOwn ? tickets.filter((t) => t.escalated).length : 0;

  const INNER = [
    { id: "all", label: `All (${list.length})` },
    { id: "unread", label: "Unread", badge: unread },
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
    ...(!isOwn && escalated > 0
      ? [
          {
            id: "escalated",
            label: "Escalated",
            badge: escalated,
            bc: "bg-orange-500",
          },
        ]
      : []),
  ];

  const filtered = list
    .filter((t) => {
      if (activeTab === "all") return true;
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
      if (activeTab === "escalated") return t.escalated;
      return true;
    })
    .sort((a, b) => {
      const aTime = new Date(
        a.lastMessageTime || a.updatedAt || a.createdAt || 0,
      ).getTime();
      const bTime = new Date(
        b.lastMessageTime || b.updatedAt || b.createdAt || 0,
      ).getTime();
      return bTime - aTime;
    });

  const pBg = isOwn
    ? "from-purple-600 to-indigo-600"
    : "from-indigo-600 to-blue-600";
  const pRing = isOwn ? "focus:ring-purple-500" : "focus:ring-indigo-500";
  const badge = isOwn ? "bg-purple-600" : "bg-indigo-600";
  const aCol = isOwn ? "#7c3aed" : "#4f46e5";

  const ownTicketClosed = isOwn && isTicketClosed(selTicket);
  const canSend =
    (msgInput.trim().length > 0 || atts.length > 0) &&
    !sending &&
    !ownTicketClosed;
  const currentBaseApi = selTicket ? baseFor(selTicket._id) : STUDENT_API;

  const toggleListening = useCallback(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showAlert(
        "Not Supported",
        "Speech recognition is not supported in your browser. Please try Chrome.",
        "error",
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
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          finalStr += e.results[i][0].transcript;
        } else {
          interimStr += e.results[i][0].transcript;
        }
      }

      if (finalStr) {
        baseText = baseText + (baseText ? " " : "") + finalStr;
        setMsgInput(baseText + (interimStr ? " " + interimStr : ""));
      } else {
        setMsgInput(baseText + (baseText ? " " : "") + interimStr);
      }
    };

    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [isListening, msgInput, showAlert]);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-50 font-poppins relative">
      {/* Unified Logo Header */}
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
              <FaSchool className="text-white w-4 h-4" />
            </div>
            <div>
              <h1 className="text-base font-black text-gray-900 leading-tight">
                {" "}
                SchoolAdmin Desk
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
          {apiError && (
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-red-50 text-red-600 rounded-lg">
              <FaExclamationTriangle className="w-3 h-3" />
              <span className="text-xs font-bold">{apiError}</span>
            </div>
          )}
          <div className="hidden sm:flex items-center gap-1.5">
            <div
              className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-green-500" : "bg-red-400"}`}
            />
            <span className="text-xs text-gray-400">
              {connected ? "Live" : "Connecting"}
            </span>
          </div>

          {curStats.unreadMessages > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-600 rounded-lg">
              <FaEnvelope className="w-3 h-3" />
              <span className="text-xs font-bold hidden sm:inline">
                {curStats.unreadMessages} unread
              </span>
            </div>
          )}

          {isOwn && !selTicket && (
            <button
              onClick={() => setShowRaise(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white font-bold text-xs transition-all hover:opacity-90 active:scale-[0.98]"
              style={{
                background: "linear-gradient(135deg,#7c3aed 0%,#6d28d9 100%)",
                boxShadow: "0 2px 8px rgba(124,58,237,0.3)",
              }}
            >
              <FaPlus className="w-3 h-3" />
              <span className="hidden sm:inline">Raise Issue</span>
              <span className="sm:hidden">New</span>
            </button>
          )}
        </div>
      </div>

      {ticketToDelete && (
        <DeleteTicketModal
          ticket={ticketToDelete}
          onDeleteForMe={handleDeleteForMe}
          onDeleteForEveryone={handleDeleteForEveryone}
          onCancel={handleCancelDeleteTicket}
          deleting={deletingTicket}
          isOwn={true}
        />
      )}

      {/* ── 2-panel body ── */}
      <div className="flex-1 flex overflow-hidden">
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
                  setMainTab("students");
                  setSelTicket(null);
                  setActiveTab("all");
                }}
                className={`flex-1 flex justify-center items-center px-3 py-2 rounded-xl font-semibold text-xs transition-all shadow-sm ${mainTab === "students" ? "bg-indigo-600 text-white shadow-md" : "bg-white text-gray-600 hover:bg-gray-50 border border-gray-200"}`}
              >
                <FaHeadset className="mr-1.5 w-3 h-3" />
                Students
                {stats.unreadMessages > 0 && mainTab !== "students" && (
                  <span className="ml-1.5 bg-indigo-100 text-indigo-700 text-[10px] px-1.5 py-0.5 rounded-full">
                    {stats.unreadMessages}
                  </span>
                )}
              </button>
              <button
                onClick={() => {
                  setMainTab("own");
                  setSelTicket(null);
                  setActiveTab("all");
                }}
                className={`flex-1 flex justify-center items-center px-3 py-2 rounded-xl font-semibold text-xs transition-all shadow-sm ${mainTab === "own" ? "bg-purple-600 text-white shadow-md" : "bg-white text-gray-600 hover:bg-gray-50 border border-gray-200"}`}
              >
                <FaSchool className="mr-1.5 w-3 h-3" />
                My Issues
                {ownStats.unreadMessages > 0 && mainTab !== "own" && (
                  <span className="ml-1.5 bg-purple-100 text-purple-700 text-[10px] px-1.5 py-0.5 rounded-full">
                    {ownStats.unreadMessages}
                  </span>
                )}
              </button>
            </div>

            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-bold text-gray-900">
                  {isOwn ? "My Tickets" : "Student Tickets"}
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  Sorted by latest activity
                </p>
              </div>
            </div>

            {/* Search */}
            <div className="relative">
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-3 h-3" />
              {/*Add "!mt-0" for alignment - 10-08-2026 */}
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
                    onClick={() => setActiveTab(tab.id)}
                    className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      isActive
                        ? "bg-[#5b52e6] text-white shadow-sm"
                        : "bg-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    {tab.label} {tab.badge > 0 ? `(${tab.badge})` : ""}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
            {filtered.length === 0 ? (
              <div className="p-8 text-center">
                <div
                  className={`w-12 h-12 mx-auto mb-3 rounded-full flex items-center justify-center ${isOwn ? "bg-purple-50" : "bg-indigo-50"}`}
                >
                  {isOwn ? (
                    <FaSchool className="w-6 h-6 text-purple-400" />
                  ) : (
                    <FaHeadset className="w-6 h-6 text-indigo-400" />
                  )}
                </div>
                <p className="text-xs text-gray-500">
                  {activeTab === "escalated"
                    ? "No escalated tickets"
                    : isOwn
                      ? "No issues yet"
                      : "No tickets found"}
                </p>
              </div>
            ) : (
              filtered.map((ticket) => {
                if (isOwn) {
                  return (
                    <OwnTicketItem
                      key={ticket._id}
                      ticket={ticket}
                      isSelected={selTicket?._id === ticket._id}
                      onSelect={handleSelect}
                      onLongPress={handleLongPressOwn}
                      priColor={priColor}
                      statColor={statColor}
                      getIcon={getIcon}
                      badge={badge}
                      aCol={aCol}
                    />
                  );
                }

                const isSel = selTicket?._id === ticket._id;
                return (
                  <div
                    key={ticket._id}
                    onClick={() => handleSelect(ticket)}
                    className={`ticket-row relative flex items-stretch border-b border-gray-100 cursor-pointer transition-colors ${isSel ? "bg-[#eff2ff]" : "bg-white hover:bg-gray-50"}`}
                  >
                    {isSel && (
                      <div className="absolute left-0 top-0 bottom-0 w-[4px] bg-[#5b52e6]" />
                    )}
                    <div className="flex-1 flex items-center gap-3 px-4 py-3 min-w-0 overflow-hidden">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-white font-bold text-base ${isSel ? "bg-[#5b52e6]" : "bg-indigo-100 text-indigo-500"}`}
                      >
                        {(ticket.studentName || "?").charAt(0).toUpperCase()}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[11px] text-gray-400 shrink-0">
                            #{ticket._id?.slice(-6)}
                          </span>
                          {ticket.unread && (
                            <span className="w-2 h-2 rounded-full border border-white bg-blue-500 animate-pulse shrink-0" />
                          )}
                          {ticket.escalated && (
                            <span className="text-white px-1.5 py-0.5 rounded bg-orange-500 flex items-center gap-0.5 text-[10px] font-semibold shrink-0">
                              <FaFlag className="w-2 h-2" />
                              Escalated
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-semibold text-gray-900 truncate leading-tight">
                          {ticket.studentName || "Unknown Student"}
                        </p>
                        <p className="text-[11px] text-gray-400 truncate mt-0.5 leading-tight">
                          {ticket.lastMessage ||
                            ticket.subject ||
                            "No messages yet"}
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
                            ticket.lastMessageTime ||
                              ticket.updatedAt ||
                              ticket.createdAt,
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {curTot > 1 && (
            <div className="p-3 border-t border-gray-200 flex items-center justify-between">
              <button
                onClick={() => setCurPage((p) => Math.max(1, p - 1))}
                disabled={curPage === 1}
                className="px-2 py-1 border border-gray-300 rounded-lg text-xs disabled:opacity-50 hover:bg-gray-50"
              >
                <FaChevronLeft className="w-3 h-3" />
              </button>
              <span className="text-xs text-gray-600">
                Page {curPage}/{curTot}
              </span>
              <button
                onClick={() => setCurPage((p) => Math.min(curTot, p + 1))}
                disabled={curPage === curTot}
                className="px-2 py-1 border border-gray-300 rounded-lg text-xs disabled:opacity-50 hover:bg-gray-50"
              >
                <FaChevronRight className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        {/* RIGHT: Conversation */}
        <div
          className={`flex-1 flex flex-col overflow-hidden bg-white ${mobilePanel === "chat" ? "flex" : "hidden lg:flex"}`}
        >
          {selTicket ? (
            <>
              {/* Chat Header */}
              <div
                className={`p-3 border-b border-gray-200 flex-shrink-0 ${selTicket.escalated ? "bg-gradient-to-r from-orange-50 to-red-50" : isOwn ? "bg-gradient-to-r from-purple-50 to-indigo-50" : "bg-gradient-to-r from-indigo-50 to-blue-50"}`}
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
                      className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${selTicket.escalated ? "bg-orange-100" : isOwn ? "bg-purple-100" : "bg-indigo-100"}`}
                    >
                      {selTicket.escalated ? (
                        <FaFlag className="text-orange-500 w-3 h-3" />
                      ) : isOwn ? (
                        <FaSchool className="text-purple-500 w-3 h-3" />
                      ) : (
                        <span className="text-indigo-600 font-bold text-[10px]">
                          {selTicket.studentName?.charAt(0).toUpperCase() ||
                            "S"}
                        </span>
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium text-gray-400">
                          #{selTicket._id?.slice(-6)}
                        </span>
                        <h3 className="font-bold text-gray-900 text-sm flex items-center gap-1.5">
                          {isOwn
                            ? selTicket.subject || "My Issue"
                            : selTicket.studentName || "Unknown"}
                          {selTicket.escalated && (
                            <span
                              className="text-white bg-orange-500 px-1.5 py-0.5 rounded-full flex items-center gap-0.5"
                              style={{ fontSize: "0.65rem" }}
                            >
                              <FaFlag className="w-2.5 h-2.5" />
                              Escalated
                            </span>
                          )}
                        </h3>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {isOwn ? (
                          <span
                            className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${statColor(selTicket.status)}`}
                          >
                            {selTicket.status || "Open"}
                          </span>
                        ) : (
                          <select
                            value={selTicket.status}
                            onChange={(e) =>
                              handleStatusChange(selTicket._id, e.target.value)
                            }
                            className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border focus:ring-2 focus:ring-indigo-500 cursor-pointer ${statColor(selTicket.status)}`}
                          >
                            <option value="open">Open</option>
                            <option value="in-progress">In Progress</option>
                            <option value="resolved">Resolved</option>
                            <option value="closed">Closed</option>
                          </select>
                        )}
                        <span
                          className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${priColor(selTicket.priority)}`}
                        >
                          {selTicket.priority || "Normal"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-end space-x-1.5">
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
                    <button
                      onClick={() => {
                        setSelTicket(null);
                        setMobilePanel("list");
                      }}
                      className="p-2 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors mr-1"
                      title="Close Ticket"
                    >
                      <FaTimes className="w-4 h-4" />
                    </button>
                    {!isOwn && !selTicket.escalated && (
                      <button
                        onClick={() => setShowEsc(true)}
                        className="px-2.5 py-1 bg-orange-500 text-white rounded-lg text-xs hover:bg-orange-600 flex items-center"
                      >
                        <FaFlag className="mr-1 w-2.5 h-2.5" />
                        Escalate
                      </button>
                    )}
                    {!isOwn && selTicket.escalated && (
                      <span className="px-2.5 py-1 bg-orange-100 text-orange-700 rounded-lg text-xs font-medium flex items-center border border-orange-200">
                        <FaFlag className="mr-1 w-2.5 h-2.5" />
                        Escalated
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div
                className="flex-1 p-4 overflow-y-auto"
                style={{
                  background: "linear-gradient(180deg,#f8f7ff 0%,#f1f0ff 100%)",
                }}
              >
                {loading ? (
                  <div className="flex justify-center items-center h-full">
                    <FaSpinner
                      className={`w-6 h-6 animate-spin ${isOwn ? "text-purple-600" : "text-indigo-600"}`}
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
                        selectedTicket={selTicket}
                        onReply={setReplyTo}
                        onDelete={handleDelete}
                        deletingMessage={deletingMsg}
                        onDownload={handleDownload}
                        baseApi={currentBaseApi}
                      />
                    ))}
                    <div ref={endRef} />
                  </>
                )}
              </div>

              {ownTicketClosed ? (
                <ResolvedBanner onRaiseNew={() => setShowRaise(true)} />
              ) : (
                <>
                  {replyTo && (
                    <div className="px-3 py-1.5 bg-indigo-50 border-t border-indigo-100 flex items-center justify-between">
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
                    <div className="px-3 py-2 bg-gray-50 border-t border-gray-200 flex flex-wrap gap-2">
                      {atts.map((att) => (
                        <div
                          key={att.id}
                          className="flex items-center bg-white border border-gray-200 rounded-lg px-2 py-1 gap-1.5 shadow-sm"
                        >
                          <FileTypeIconDark
                            att={{ mimetype: att.type, filename: att.name }}
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
                  <div className="p-3 border-t border-gray-200 bg-white">
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
                        onClick={toggleListening}
                        className={`flex-shrink-0 p-2 rounded-full cursor-pointer transition-colors ${isListening ? "text-red-500 bg-red-50 animate-pulse" : "text-gray-500 hover:text-indigo-600 hover:bg-indigo-50"}`}
                        title="Auto Type (Speech to Text)"
                      >
                        {isListening ? (
                          <FaMicrophoneSlash className="w-4 h-4" />
                        ) : (
                          <FaMicrophone className="w-4 h-4" />
                        )}
                      </button>
                      <input
                        type="text"
                        placeholder={
                          atts.length > 0
                            ? "Add a caption (optional)…"
                            : isListening
                              ? "Listening..."
                              : isOwn
                                ? "Message to main admin…"
                                : "Reply to student…"
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
            </>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col items-center justify-center flex-1 p-8 overflow-y-auto">
              <div className="text-center mb-8">
                <div
                  className={`w-20 h-20 mx-auto mb-5 rounded-full flex items-center justify-center ${isOwn ? "bg-gradient-to-br from-purple-100 to-indigo-100" : "bg-gradient-to-br from-indigo-100 to-blue-100"}`}
                >
                  {isOwn ? (
                    <FaSchool className="w-10 h-10 text-purple-600" />
                  ) : (
                    <FaHeadset className="w-10 h-10 text-indigo-600" />
                  )}
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  {isOwn ? "My Issues" : "Student Support"}
                </h3>
                <p className="text-gray-500 text-sm max-w-md mx-auto">
                  {isOwn
                    ? "Select an issue or raise a new one."
                    : "Select a ticket to view and respond."}
                </p>
                {isOwn && (
                  <button
                    onClick={() => setShowRaise(true)}
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
                    value: curStats.total,
                    icon: <FaInbox className="w-4 h-4" />,
                    color: isOwn ? "purple" : "indigo",
                  },
                  {
                    label: "Open",
                    value: curStats.open,
                    icon: <FaClock className="w-4 h-4" />,
                    color: "green",
                  },
                  {
                    label: "In Progress",
                    value: curStats.inProgress,
                    icon: <FaHourglassHalf className="w-4 h-4" />,
                    color: "blue",
                  },
                  {
                    label: "Resolved",
                    value: curStats.resolved,
                    icon: <FaCheckCircle className="w-4 h-4" />,
                    color: "purple",
                  },
                  {
                    label: "Urgent",
                    value: curStats.urgent,
                    icon: <FaExclamationTriangle className="w-4 h-4" />,
                    color: "red",
                  },
                  {
                    label: "Unread",
                    value: curStats.unreadMessages,
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

        {/* EXTRA RIGHT: Ticket Details Pane */}
        <div
          className={`flex flex-col w-full lg:w-[260px] xl:w-[280px] bg-gray-50 border-l border-gray-200 shrink-0 overflow-y-auto ticket-scroll ${mobilePanel === "detail" ? "flex" : showDetails ? "hidden lg:flex" : "hidden"}`}
          style={{ zIndex: 10 }}
        >
          {/* Mobile back header */}
          <div className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-gray-100">
            <button
              onClick={() => setMobilePanel("chat")}
              className="p-2 text-gray-500 hover:text-gray-900 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <FaChevronLeft className="w-4 h-4" />
            </button>
            <h3 className="font-bold text-sm text-gray-900">Ticket Details</h3>
          </div>

          {selTicket ? (
            <>
              <div className="p-5 border-b border-gray-200 bg-white">
                <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                  Ticket ID
                </h3>
                <p className="text-base font-black text-gray-900 font-mono tracking-wide">
                  #{selTicket._id?.slice(-6).toUpperCase()}
                </p>
              </div>

              <div className="p-5 border-b border-gray-200">
                <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-5">
                  Status
                </h3>
                <div className="relative pl-3 border-l-2 border-gray-100 ml-2 space-y-6">
                  {STATUSES.map((st, idx) => {
                    const isActive = selTicket.status === st.id;
                    const statusOrder = [
                      "open",
                      "in-progress",
                      "resolved",
                      "closed",
                    ];
                    const currentIdx = statusOrder.indexOf(selTicket.status);
                    const thisIdx = statusOrder.indexOf(st.id);
                    const isCompleted = thisIdx < currentIdx;

                    return (
                      <div key={st.id} className="relative flex items-center">
                        <div
                          className={`absolute -left-[17px] w-3 h-3 rounded-full border-2 bg-white ${isActive ? "border-indigo-500 shadow-[0_0_0_3px_rgba(99,102,241,0.15)]" : isCompleted ? "border-gray-300 bg-gray-100" : "border-gray-200"}`}
                        >
                          {isActive && (
                            <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full mx-auto mt-[1px]" />
                          )}
                        </div>
                        <div className="flex items-center gap-2 pl-3">
                          <span
                            className={`text-sm ${isActive ? "font-bold text-indigo-600" : "font-semibold text-gray-400"}`}
                          >
                            {st.name}
                          </span>
                          {isActive && (
                            <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-600 text-[10px] font-bold">
                              Current
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="p-5 border-b border-gray-200">
                <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-4">
                  Details
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-medium text-gray-400">
                      Priority
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${priColor(selTicket.priority)}`}
                    >
                      {selTicket.priority
                        ? selTicket.priority.charAt(0).toUpperCase() +
                          selTicket.priority.slice(1)
                        : "Medium"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-medium text-gray-400">
                      Status
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${statColor(selTicket.status)}`}
                    >
                      {selTicket.status
                        ? STATUSES.find((s) => s.id === selTicket.status)?.name
                        : "Open"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-medium text-gray-400">
                      Category
                    </span>
                    <span className="text-[13px] font-bold text-gray-800">
                      {selTicket.category}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-medium text-gray-400">
                      Routed to
                    </span>
                    <span className="text-[13px] font-bold text-gray-800">
                      {isOwn ? "Main Support" : "School Admin"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[13px] font-medium text-gray-400 flex items-center gap-1.5">
                      <FaEnvelope className="w-3.5 h-3.5" /> Messages
                    </span>
                    <span className="text-[13px] font-bold text-gray-800">
                      {messages[selTicket._id]?.length || 0}
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-5">
                <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-4">
                  Timestamps
                </h3>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <FaCalendarAlt className="w-3.5 h-3.5 text-gray-400 mt-[3px]" />
                    <div>
                      <p className="text-[12px] font-medium text-gray-400 mb-0.5">
                        Created
                      </p>
                      <p className="text-[13px] font-bold text-gray-800">
                        {new Date(selTicket.createdAt).toLocaleString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <FaHistory className="w-3.5 h-3.5 text-gray-400 mt-[3px]" />
                    <div>
                      <p className="text-[12px] font-medium text-gray-400 mb-0.5">
                        Last Activity
                      </p>
                      <p className="text-[13px] font-bold text-gray-800">
                        {new Date(
                          selTicket.lastMessageTime ||
                            selTicket.updatedAt ||
                            selTicket.createdAt,
                        ).toLocaleString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
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
          )}
        </div>
      </div>

      {/* ── Modals ── */}

      {/* ✅ UPDATED: Raise Issue Drawer */}
      <div
        className={`fixed inset-0 z-50 flex justify-end transition-opacity duration-300 ${showRaise ? "opacity-100" : "opacity-0 pointer-events-none"}`}
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]"
          onClick={() => {
            setShowRaise(false);
            setRaiseAtts([]);
            raiseAttsRef.current = [];
            if (raiseFileRef.current) raiseFileRef.current.value = "";
          }}
        />

        {/* Drawer Panel */}
        <div
          className={`relative bg-white shadow-2xl flex flex-col z-10 w-full sm:w-[480px] h-[100dvh] transform transition-transform duration-300 ${showRaise ? "translate-x-0" : "translate-x-full"}`}
        >
          <div
            className="flex items-center justify-between px-6 py-5 border-b border-white/20 shrink-0"
            style={{
              background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
            }}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
                <FaHeadset className="text-white w-5 h-5" />
              </div>
              <div>
                <h2 className="text-white font-bold text-base leading-tight">
                  Raise Issue to Main Admin
                </h2>
                <p className="text-white/70 text-xs mt-0.5">
                  Fill in the details below to get help
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setShowRaise(false);
                setRaiseAtts([]);
                raiseAttsRef.current = [];
                if (raiseFileRef.current) raiseFileRef.current.value = "";
              }}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-white/70 hover:text-white hover:bg-white/20 transition-colors ml-2 shrink-0"
            >
              <FaTimes className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 px-6 py-6 space-y-6 overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Category <span className="text-red-500">*</span>
                </label>
                <select
                  value={raiseData.category}
                  onChange={(e) =>
                    setRaiseData({ ...raiseData, category: e.target.value })
                  }
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                >
                  <option value="">Select Category</option>
                  {SCHOOL_ADMIN_CATEGORIES.map((c) => (
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
                  value={raiseData.priority}
                  onChange={(e) =>
                    setRaiseData({ ...raiseData, priority: e.target.value })
                  }
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
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
                Message <span className="text-red-500">*</span>
              </label>
              <textarea
                value={raiseData.message}
                onChange={(e) =>
                  setRaiseData({ ...raiseData, message: e.target.value })
                }
                rows={5}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 font-mono resize-y"
                placeholder="Describe the issue in detail…"
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
              {raiseAtts.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {raiseAtts.map((att) => (
                    <div
                      key={att.id}
                      className="flex items-center bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 gap-1.5 shadow-sm"
                    >
                      <FileTypeIconDark
                        att={{ mimetype: att.type, filename: att.name }}
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
                        onClick={() => removeRaiseAtt(att.id)}
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
              <label className="flex items-center justify-center gap-2 w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:border-purple-400 hover:text-purple-600 hover:bg-purple-50 transition-all cursor-pointer group">
                <FaPaperclip className="w-4 h-4 group-hover:text-purple-500 transition-colors" />
                <span className="group-hover:text-purple-600 transition-colors">
                  {raiseAtts.length === 0
                    ? "Click to attach files"
                    : `${raiseAtts.length} file${raiseAtts.length > 1 ? "s" : ""} attached — click to add more`}
                </span>
                <input
                  ref={raiseFileRef}
                  type="file"
                  className="hidden"
                  multiple
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.webp,.csv,.txt,.xlsx,.xls,.zip"
                  onChange={handleRaiseFileChange}
                />
              </label>
            </div>

            <div className="flex items-start gap-3 bg-purple-50 border border-purple-200 rounded-xl p-4">
              <FaInfoCircle className="text-purple-600 w-4 h-4 mt-0.5 shrink-0" />
              <p className="text-sm text-purple-700">
                This issue will be sent directly to the{" "}
                <strong>Main Admin</strong>.
              </p>
            </div>
          </div>

          <div className="p-5 border-t border-gray-100 bg-gray-50 flex justify-end space-x-3 shrink-0">
            <button
              onClick={() => {
                setShowRaise(false);
                setRaiseAtts([]);
                raiseAttsRef.current = [];
                if (raiseFileRef.current) raiseFileRef.current.value = "";
              }}
              className="px-5 py-2.5 bg-white border border-gray-300 rounded-xl font-bold text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-all text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleRaiseIssue}
              disabled={
                loading ||
                !raiseData.category ||
                !raiseData.priority ||
                !raiseData.message?.trim()
              }
              className="px-5 py-2.5 text-white rounded-xl font-bold transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center text-sm"
              style={
                loading ||
                !raiseData.category ||
                !raiseData.priority ||
                !raiseData.message?.trim()
                  ? {
                      background: "#d1d5db",
                      color: "#9ca3af",
                      boxShadow: "none",
                      cursor: "not-allowed",
                    }
                  : {
                      background:
                        "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
                      boxShadow: "0 4px 12px rgba(124, 58, 237, 0.3)",
                    }
              }
            >
              {loading ? (
                <FaSpinner className="animate-spin mr-2 w-4 h-4" />
              ) : (
                <FaCheck className="mr-2 w-4 h-4" />
              )}
              {loading ? "Submitting…" : "Submit Issue"}
            </button>
          </div>
        </div>
      </div>

      {showEsc && selTicket && !isOwn && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full">
            <div className="p-5 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-bold">Escalate to Main Admin</h2>
              <button onClick={() => setShowEsc(false)}>
                <FaTimesCircle className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="p-5">
              <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg text-xs text-orange-700">
                <p className="font-medium mb-1">
                  📋 {selTicket.studentName} — #{selTicket._id?.slice(-6)}
                </p>
                <p>
                  This ticket will be escalated to the main admin immediately.
                </p>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reason *
                </label>
                <textarea
                  value={escReason}
                  onChange={(e) => setEscReason(e.target.value)}
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 text-sm"
                  placeholder="Explain why…"
                />
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowEsc(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleEscalate}
                  disabled={escalating || !escReason.trim()}
                  className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 flex items-center text-sm"
                >
                  {escalating ? (
                    <FaSpinner className="animate-spin mr-2 w-3 h-3" />
                  ) : (
                    <FaFlag className="mr-2 w-3 h-3" />
                  )}
                  {escalating ? "Escalating…" : "Escalate"}
                </button>
              </div>
            </div>
          </div>
        </div>
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
              style={{
                background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
                boxShadow: "0 4px 12px rgba(124, 58, 237, 0.3)",
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

export default SchoolAdminSupport;
