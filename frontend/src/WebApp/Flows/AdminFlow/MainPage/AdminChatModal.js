// ─── AdminChatModal.jsx ───────────────────────────────────────────────────────
// Standalone chat modal for the Admin flow.
// Aligns with:  POST /api/chats/send
//               GET  /api/chats/internship/:internshipId?page=&limit=
//               POST /api/chats/upload  (multipart, field = "file")
//               DELETE /api/chats/:messageId  (body: { requesterId })
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useRef, useState, useCallback } from "react";
import Modal from "react-modal";
import { io as ioClient } from "socket.io-client";
import axios from "../../../../api/axiosInstance"; // ← adjust if needed
import {
  FaCommentDots,
  FaPaperclip,
  FaTrash,
  FaDownload,
  FaFilePdf,
  FaFileWord,
  FaFileAlt,
  FaTimes,
} from "react-icons/fa";
import { IoSend } from "react-icons/io5";

Modal.setAppElement("#root");

// ─── Constants ────────────────────────────────────────────────────────────────
const POLL_INTERVAL_MS = 3000;
const MESSAGES_PER_PAGE = 20;
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

// ─── Helpers ──────────────────────────────────────────────────────────────────
const getAdminInfo = () => {
  try {
    const raw = localStorage.getItem("adminInfo");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const getAdminId = () => {
  const info = getAdminInfo();
  return info?._id || info?.id || null;
};

const formatTime = (ts) =>
  new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const formatDate = (ts) => {
  const d = new Date(ts);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

// ─── File icon helper ─────────────────────────────────────────────────────────
const FileIcon = ({ type }) => {
  if (!type) return <FaFileAlt className="w-5 h-5 text-gray-500" />;
  if (type.includes("pdf"))
    return <FaFilePdf className="w-5 h-5 text-red-500" />;
  if (type.includes("word") || type.includes("doc"))
    return <FaFileWord className="w-5 h-5 text-blue-600" />;
  return <FaFileAlt className="w-5 h-5 text-gray-500" />;
};

// ─── Single message bubble ─────────────────────────────────────────────────────
const MessageBubble = ({ message, isOwn, onDelete, adminId }) => {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isImage = message.fileType?.startsWith("image/");
  const hasFile = !!message.fileUrl;

  return (
    <div
      className={`flex mb-3 group ${isOwn ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`relative max-w-[70%] ${isOwn ? "items-end" : "items-start"} flex flex-col`}
      >
        {/* Bubble */}
        <div
          className={`px-4 py-3 rounded-2xl shadow-sm text-sm leading-relaxed
            ${
              isOwn
                ? "bg-gradient-to-br from-indigo-500 to-blue-600 text-white rounded-br-sm"
                : "bg-white text-gray-800 border border-gray-200 rounded-bl-sm"
            }
            ${message.isDeleted ? "opacity-60 italic" : ""}
          `}
        >
          {message.isDeleted ? (
            <span className="text-xs">This message was deleted.</span>
          ) : (
            <>
              {/* File attachment */}
              {hasFile && (
                <div
                  className={`mb-2 rounded-xl overflow-hidden border relative group/img ${isOwn ? "border-white/30" : "border-gray-200"}`}
                >
                  {isImage ? (
                    <>
                      {/* Clicking the image opens/downloads it */}
                      <a
                        href={message.fileUrl}
                        download={message.fileName || "image"}
                        target="_blank"
                        rel="noreferrer"
                        style={{ display: "block" }}
                      >
                        <img
                          src={message.fileUrl}
                          alt={message.fileName || "attachment"}
                          className="max-w-full max-h-52 object-cover rounded-xl cursor-pointer"
                        />
                      </a>
                      {/* Download badge — appears on hover */}
                      <a
                        href={message.fileUrl}
                        download={message.fileName || "image"}
                        target="_blank"
                        rel="noreferrer"
                        className="absolute bottom-2 right-2 p-1.5 rounded-full bg-black/50 text-white opacity-0 group-hover/img:opacity-100 transition-opacity"
                        title="Download image"
                      >
                        <FaDownload className="w-3 h-3" />
                      </a>
                    </>
                  ) : (
                    <div
                      className={`flex items-center gap-3 px-3 py-2 ${isOwn ? "bg-white/15" : "bg-gray-50"}`}
                    >
                      <FileIcon type={message.fileType} />
                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-xs font-semibold truncate ${isOwn ? "text-white" : "text-gray-700"}`}
                        >
                          {message.fileName}
                        </p>
                        {message.fileSize && (
                          <p
                            className={`text-xs ${isOwn ? "text-blue-100" : "text-gray-500"}`}
                          >
                            {message.fileSize}
                          </p>
                        )}
                      </div>
                      <a
                        href={message.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className={`p-1.5 rounded-full transition-colors ${isOwn ? "hover:bg-white/20 text-white" : "hover:bg-gray-200 text-gray-600"}`}
                        title="Download"
                      >
                        <FaDownload className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  )}
                </div>
              )}

              {/* Text */}
              {message.message &&
                !message.message.startsWith("Sent a file:") && (
                  <p className="whitespace-pre-wrap break-words">
                    {message.message}
                  </p>
                )}
            </>
          )}

          {/* Timestamp */}
          <p
            className={`text-[10px] mt-1.5 text-right ${isOwn ? "text-blue-100" : "text-gray-400"}`}
          >
            {formatTime(message.timestamp || message.createdAt)}
          </p>
        </div>

        {/* Delete button (own messages only, not already deleted) */}
        {isOwn &&
          !message.isDeleted &&
          !message._id?.toString().includes("optimistic") && (
            <div className="mt-1 opacity-0 group-hover:opacity-100 transition-opacity flex justify-end">
              {confirmDelete ? (
                <div className="flex gap-1 items-center text-xs">
                  <span className="text-gray-500 mr-1">Delete?</span>
                  <button
                    onClick={() => {
                      onDelete(message._id);
                      setConfirmDelete(false);
                    }}
                    className="px-2 py-0.5 bg-red-500 text-white rounded-full hover:bg-red-600"
                  >
                    Yes
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="px-2 py-0.5 bg-gray-200 text-gray-700 rounded-full hover:bg-gray-300"
                  >
                    No
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="p-1 rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all"
                  title="Delete message"
                >
                  <FaTrash className="w-3 h-3" />
                </button>
              )}
            </div>
          )}
      </div>
    </div>
  );
};

// ─── Date separator ───────────────────────────────────────────────────────────
const DateSeparator = ({ label }) => (
  <div className="flex items-center gap-3 my-4">
    <div className="flex-1 h-px bg-gray-200" />
    <span className="text-xs text-gray-400 font-medium px-2">{label}</span>
    <div className="flex-1 h-px bg-gray-200" />
  </div>
);

// ─── Upload preview pill ──────────────────────────────────────────────────────
const UploadPreview = ({ file, onRemove, uploading }) => {
  const isImage = file.type.startsWith("image/");
  const previewUrl = isImage ? URL.createObjectURL(file) : null;
  return (
    <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2 text-sm max-w-xs">
      {isImage ? (
        <img
          src={previewUrl}
          alt="preview"
          className="w-8 h-8 object-cover rounded-lg"
        />
      ) : (
        <FileIcon type={file.type} />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-gray-700 truncate">
          {file.name}
        </p>
        {uploading && (
          <div className="w-full h-1 mt-1 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full animate-pulse w-2/3" />
          </div>
        )}
      </div>
      {!uploading && (
        <button
          onClick={onRemove}
          className="p-1 hover:bg-blue-100 rounded-full text-gray-500"
        >
          <FaTimes className="w-3 h-3" />
        </button>
      )}
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────
/**
 * AdminChatModal
 *
 * Props:
 *  isOpen           {boolean}  – controls modal visibility
 *  internship       {object}   – the internship document (must have _id, jobTitle, companyName, partnerId)
 *  onClose          {function} – called when modal should close
 *  onReviewedUpdate {function} – (internshipId) => void — parent refreshes adminReviewed flag
 */
const AdminChatModal = ({ isOpen, internship, onClose, onReviewedUpdate }) => {
  const adminId = getAdminId();

  // ── State ──────────────────────────────────────────────────────────────────
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [chatError, setChatError] = useState(null);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pendingFile, setPendingFile] = useState(null); // File object before upload
  const [uploadedMeta, setUploadedMeta] = useState(null); // { fileUrl, fileName, fileType, fileSize }
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const pollerRef = useRef(null);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const scrollToBottom = useCallback(
    () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }),
    [],
  );

  // ── Fetch messages ─────────────────────────────────────────────────────────
  const fetchMessages = useCallback(
    async (silent = false) => {
      if (!internship?._id) return;
      try {
        const res = await axios.get(`/api/chats/internship/${internship._id}`, {
          params: { page: 1, limit: MESSAGES_PER_PAGE, t: Date.now() },
        });
        const data = res.data?.data || [];
        setTotalPages(res.data?.totalPages || 1);

        if (!silent)
          setChatError(
            data.length === 0
              ? "No messages yet. Be the first to say something!"
              : null,
          );
        setMessages(data);
        if (isOpen && adminId) {
          axios
            .patch("/api/chats/read", {
              internshipId: internship._id,
              readerId: adminId,
            })
            .catch((err) => console.error("markAdminConversationRead:", err));
        }
      } catch (err) {
        if (!silent) setChatError("Failed to load messages.");
        console.error("fetchMessages:", err);
      }
    },
    [internship?._id, isOpen, adminId],
  );

  const markConversationRead = useCallback(async () => {
    if (!internship?._id || !adminId) return;
    try {
      await axios.patch("/api/chats/read", {
        internshipId: internship._id,
        readerId: adminId,
      });
    } catch (err) {
      console.error("markAdminConversationRead:", err);
    }
  }, [internship?._id, adminId]);

  // ── Load older messages (pagination) ──────────────────────────────────────
  const loadOlderMessages = async () => {
    if (loadingMore || page >= totalPages || !internship?._id) return;
    const nextPage = page + 1;
    setLoadingMore(true);
    try {
      const res = await axios.get(`/api/chats/internship/${internship._id}`, {
        params: { page: nextPage, limit: MESSAGES_PER_PAGE },
      });
      const older = res.data?.data || [];
      setMessages((prev) => [...older, ...prev]);
      setPage(nextPage);
    } catch (err) {
      console.error("loadOlderMessages:", err);
    } finally {
      setLoadingMore(false);
    }
  };

  // ── Open / close lifecycle ─────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen || !internship?._id) return;

    setMessages([]);
    setNewMessage("");
    setChatError(null);
    setPendingFile(null);
    setUploadedMeta(null);
    setPage(1);
    fetchMessages(false);
    markConversationRead();

    // Polling
    pollerRef.current = setInterval(
      () => fetchMessages(true),
      POLL_INTERVAL_MS,
    );
    return () => clearInterval(pollerRef.current);
  }, [isOpen, internship?._id, fetchMessages, markConversationRead]);

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, messages, scrollToBottom]);

  useEffect(() => {
    if (!isOpen || !internship?._id || !adminId) return;

    const SOCKET_URL =
      process.env.REACT_APP_SOCKET_URL || "http://localhost:5000";
    const socket = ioClient(SOCKET_URL, { withCredentials: true });

    const joinRooms = () => {
      socket.emit("joinAdminRoom");
      socket.emit("joinChatRoom", { internshipId: internship._id });
    };

    const handleNewMessage = (message) => {
      if (String(message?.internship) !== String(internship._id)) return;
      if (String(message?.sender) === String(adminId)) return;

      setMessages((prev) =>
        prev.some((item) => String(item._id) === String(message._id))
          ? prev
          : [...prev, message],
      );

      axios
        .patch("/api/chats/read", {
          internshipId: internship._id,
          readerId: adminId,
        })
        .catch((err) => console.error("markAdminConversationRead:", err));
    };

    const handleMessageDeleted = ({ messageId }) => {
      setMessages((prev) =>
        prev.map((item) =>
          String(item._id) === String(messageId)
            ? { ...item, isDeleted: true, deletedAt: new Date().toISOString() }
            : item,
        ),
      );
    };

    socket.on("connect", joinRooms);
    socket.on("newMessage", handleNewMessage);
    socket.on("messageDeleted", handleMessageDeleted);

    return () => {
      socket.emit("leaveChatRoom", { internshipId: internship._id });
      socket.off("connect", joinRooms);
      socket.off("newMessage", handleNewMessage);
      socket.off("messageDeleted", handleMessageDeleted);
      socket.disconnect();
    };
  }, [isOpen, internship?._id, adminId]);

  // ── Group messages by date ─────────────────────────────────────────────────
  const groupedMessages = (() => {
    const groups = [];
    let lastDate = null;
    for (const msg of messages) {
      const label = formatDate(msg.timestamp || msg.createdAt);
      if (label !== lastDate) {
        groups.push({ type: "separator", label, key: `sep-${msg._id}` });
        lastDate = label;
      }
      groups.push({ type: "message", data: msg, key: msg._id });
    }
    return groups;
  })();

  // ── File selection ─────────────────────────────────────────────────────────
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      setChatError("File too large. Maximum size is 10 MB.");
      return;
    }
    setPendingFile(file);
    setUploadedMeta(null); // reset previous upload
    e.target.value = "";
  };

  const removePendingFile = () => {
    setPendingFile(null);
    setUploadedMeta(null);
  };

  // ── Upload file to S3 via POST /api/chats/upload ───────────────────────────
  const uploadFile = async () => {
    if (!pendingFile) return null;
    setUploading(true);
    const formData = new FormData();
    formData.append("file", pendingFile);
    try {
      const res = await axios.post("/api/chats/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setUploadedMeta(res.data);
      return res.data; // { fileUrl, fileName, fileType, fileSize }
    } catch (err) {
      console.error("uploadFile:", err);
      setChatError("File upload failed. Please try again.");
      return null;
    } finally {
      setUploading(false);
    }
  };

  // ── Send message  POST /api/chats/send ────────────────────────────────────
  const handleSend = async () => {
    if ((!newMessage.trim() && !pendingFile) || sending || !adminId) return;

    const messageText = newMessage.trim();
    setNewMessage("");
    setSending(true);
    setChatError(null);

    // Upload file first if needed
    let fileMeta = uploadedMeta;
    if (pendingFile && !uploadedMeta) {
      fileMeta = await uploadFile();
      if (!fileMeta) {
        setSending(false);
        return;
      }
    }

    // Optimistic message
    const optimistic = {
      _id: `optimistic-${Date.now()}`,
      sender: adminId,
      receiver: internship.partnerId,
      internship: internship._id,
      message:
        messageText ||
        (fileMeta?.fileName ? `Sent a file: ${fileMeta.fileName}` : ""),
      fileUrl: fileMeta?.fileUrl || null,
      fileName: fileMeta?.fileName || null,
      fileType: fileMeta?.fileType || null,
      fileSize: fileMeta?.fileSize || null,
      timestamp: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimistic]);
    setPendingFile(null);
    setUploadedMeta(null);

    try {
      // Body matches ChatController.sendMessage expectations
      const payload = {
        internshipId: internship._id,
        senderId: adminId,
        partnerId: internship.partnerId, // required when admin sends
        message: messageText,
        ...(fileMeta || {}),
      };

      const res = await axios.post("/api/chats/send", payload);

      // Replace optimistic with real doc
      setMessages((prev) =>
        prev.map((m) => (m._id === optimistic._id ? res.data : m)),
      );

      // Mark internship as reviewed (first admin message)
      if (!internship.adminReviewed) {
        try {
          await axios.post(`/api/interns/${internship._id}/review`);
          onReviewedUpdate?.(internship._id);
        } catch {
          /* non-critical */
        }
      }
    } catch (err) {
      console.error("handleSend:", err);
      setMessages((prev) => prev.filter((m) => m._id !== optimistic._id));
      setNewMessage(messageText);
      setChatError("Failed to send message. Please try again.");
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  // ── Soft-delete  DELETE /api/chats/:messageId ──────────────────────────────
  const handleDelete = async (messageId) => {
    if (!adminId) return;
    // Optimistic
    setMessages((prev) =>
      prev.map((m) =>
        m._id === messageId
          ? { ...m, isDeleted: true, deletedAt: new Date() }
          : m,
      ),
    );
    try {
      await axios.delete(`/api/chats/${messageId}`, {
        data: { requesterId: adminId },
      });
    } catch (err) {
      console.error("handleDelete:", err);
      // Revert
      setMessages((prev) =>
        prev.map((m) =>
          m._id === messageId ? { ...m, isDeleted: false, deletedAt: null } : m,
        ),
      );
      setChatError("Failed to delete message.");
    }
  };

  // ── Key handler ────────────────────────────────────────────────────────────
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ── Auto-resize textarea ───────────────────────────────────────────────────
  const handleTextareaChange = (e) => {
    setNewMessage(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  };

  const canSend = (newMessage.trim() || pendingFile) && !sending && !uploading;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onClose}
      overlayClassName="fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-[999]"
      className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] outline-none font-poppins flex flex-col overflow-hidden mx-4"
    >
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-indigo-600 to-blue-600 text-white px-6 py-5 rounded-t-3xl flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center shrink-0">
            <FaCommentDots className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="font-bold text-base leading-tight truncate">
              {internship?.jobTitle}
            </h2>
            <p className="text-blue-100 text-xs truncate">
              {internship?.companyName}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-white/20 rounded-full transition-all shrink-0 ml-4"
          aria-label="Close"
        >
          <FaTimes className="w-5 h-5" />
        </button>
      </div>

      {/* ── Load Older Messages ────────────────────────────────────────────── */}
      {page < totalPages && (
        <div className="text-center py-2 bg-gray-50 border-b border-gray-200 shrink-0">
          <button
            onClick={loadOlderMessages}
            disabled={loadingMore}
            className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold disabled:opacity-60"
          >
            {loadingMore ? "Loading…" : "↑ Load older messages"}
          </button>
        </div>
      )}

      {/* ── Messages Area ──────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-5 py-4 bg-gray-50 space-y-1">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center py-12">
            <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mb-4">
              <FaCommentDots className="w-8 h-8 text-indigo-500" />
            </div>
            <p className="text-gray-500 text-sm max-w-xs">
              {chatError ||
                "No messages yet. Start the conversation to review this internship."}
            </p>
          </div>
        ) : (
          <>
            {groupedMessages.map((item) =>
              item.type === "separator" ? (
                <DateSeparator key={item.key} label={item.label} />
              ) : (
                <MessageBubble
                  key={item.key}
                  message={item.data}
                  isOwn={String(item.data.sender) === String(adminId)}
                  onDelete={handleDelete}
                  adminId={adminId}
                />
              ),
            )}
            <div ref={messagesEndRef} />
          </>
        )}
        {chatError && messages.length > 0 && (
          <p className="text-center text-xs text-red-500 bg-red-50 rounded-lg py-2 px-3 mt-2">
            {chatError}
          </p>
        )}
      </div>

      {/* ── Input Area ─────────────────────────────────────────────────────── */}
      <div className="bg-white border-t border-gray-200 px-4 pt-3 pb-4 shrink-0">
        {/* File preview */}
        {pendingFile && (
          <div className="mb-2">
            <UploadPreview
              file={pendingFile}
              onRemove={removePendingFile}
              uploading={uploading}
            />
          </div>
        )}

        <div className="flex items-end gap-2">
          {/* Attach button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={sending || uploading}
            className="p-2.5 rounded-xl text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 transition-all disabled:opacity-40 shrink-0"
            title="Attach file"
            aria-label="Attach file"
          >
            <FaPaperclip className="w-4 h-4" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf,.doc,.docx,.txt"
            className="hidden"
            onChange={handleFileSelect}
          />

          {/* Textarea */}
          {/*Add the "sm:h-12" for the message - 05-08-2026 */}
          <textarea
            ref={inputRef}
            placeholder="Type your message…"
            value={newMessage}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={sending || uploading}
            className="flex-1 sm:h-12 resize-none px-4 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-all disabled:bg-gray-50"
          />

          {/* Send button */}
          <button
            onClick={handleSend}
            disabled={!canSend}
            className={`p-2.5 rounded-xl transition-all shrink-0 ${
              canSend
                ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-md hover:shadow-lg"
                : "bg-gray-200 text-gray-400 cursor-not-allowed"
            }`}
            aria-label="Send message"
          >
            {sending ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <IoSend className="w-5 h-5" />
            )}
          </button>
        </div>

        <p className="text-center text-[10px] text-gray-400 mt-2">
          <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-500">
            Enter
          </kbd>{" "}
          to send &nbsp;·&nbsp;
          <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-500">
            Shift+Enter
          </kbd>{" "}
          for new line &nbsp;·&nbsp; Max file size 10 MB
        </p>
      </div>
    </Modal>
  );
};

export default AdminChatModal;
