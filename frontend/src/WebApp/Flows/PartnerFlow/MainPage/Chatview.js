// Chatview.js
import React, { useLayoutEffect, useMemo, useRef } from "react";
import { PaginationBar } from "./Internshiplistview";
import {
  S,
  globalCss,
  fmtTime,
  fmtDate,
  getInitials,
  getAvatarColor,
  IconBack,
  IconInfo,
  IconSend,
  IconEmptyChat,
  PAID_PILL,
  FREE_PILL,
  MODE_PILL,
  ACTIVE_DOT,
  ACTIVE_WRAP,
} from "./Chatconstants";

// ─── Download icon ────────────────────────────────────────────
const IconDownload = (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.3"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

// ─── Avatar ───────────────────────────────────────────────────
const Avatar = React.memo(({ title, size = 38 }) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: 10,
      background: getAvatarColor(title),
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
      fontSize: Math.floor(size * 0.34),
      fontWeight: 700,
      color: "#fff",
    }}
  >
    {getInitials(title)}
  </div>
));

// ─── Spinner ──────────────────────────────────────────────────
const Spinner = React.memo(() => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      height: "100%",
      gap: 10,
    }}
  >
    <div
      style={{
        width: 22,
        height: 22,
        borderRadius: "50%",
        border: "2.5px solid #E0E7FF",
        borderTopColor: "#4A6CF7",
        animation: "spin 0.7s linear infinite",
      }}
    />
    <span style={{ fontSize: 13, color: "#94A3B8" }}>Loading messages…</span>
  </div>
));

// ─── Empty state ──────────────────────────────────────────────
const EmptyState = React.memo(({ icon, title, subtitle }) => (
  <div
    style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      height: "100%",
      gap: 12,
      padding: 28,
    }}
  >
    <div
      style={{
        width: 64,
        height: 64,
        borderRadius: 20,
        background: "linear-gradient(135deg,#EEF2FF,#E0E7FF)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {icon}
    </div>
    <p style={{ margin: 0, fontWeight: 700, fontSize: 15.5, color: "#0F172A" }}>
      {title}
    </p>
    <p
      style={{
        margin: 0,
        fontSize: 13,
        color: "#64748B",
        textAlign: "center",
        maxWidth: 280,
        lineHeight: 1.7,
      }}
    >
      {subtitle}
    </p>
  </div>
));

// ─── Typing indicator ─────────────────────────────────────────
const TypingIndicator = React.memo(() => (
  <div
    style={{ display: "flex", justifyContent: "flex-start", marginBottom: 10 }}
  >
    <div
      style={{
        background: "#fff",
        border: "1px solid #E9EDF5",
        borderRadius: "16px 16px 16px 5px",
        padding: "10px 14px",
        display: "flex",
        gap: 4,
        alignItems: "center",
        boxShadow: "0 2px 10px rgba(15,23,42,0.05)",
      }}
    >
      {[0, 0.15, 0.3].map((delay, i) => (
        <span
          key={i}
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "#94A3B8",
            display: "inline-block",
            animation: "typing 1.2s ease-in-out infinite",
            animationDelay: `${delay}s`,
          }}
        />
      ))}
    </div>
  </div>
));

// ─── File attachment preview strip ────────────────────────────
const FileAttachmentPreview = React.memo(({ files, onRemove }) => {
  if (!files?.length) return null;
  return (
    <div
      style={{ display: "flex", flexWrap: "wrap", gap: 6, paddingBottom: 8 }}
    >
      {files.map((f, idx) => {
        const isImg = f.type.startsWith("image/");
        const url = isImg ? URL.createObjectURL(f) : null;
        return (
          <div
            key={idx}
            style={{
              position: "relative",
              borderRadius: 9,
              border: "1.5px solid #E2E8F0",
              background: "#F8FAFC",
              overflow: "hidden",
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: isImg ? 0 : "6px 9px",
              maxWidth: isImg ? 70 : 190,
            }}
          >
            {isImg ? (
              <img
                src={url}
                alt={f.name}
                style={{
                  width: 70,
                  height: 70,
                  objectFit: "cover",
                  display: "block",
                }}
              />
            ) : (
              <>
                <span style={{ fontSize: 17 }}>{fileIcon(f.type)}</span>
                <div style={{ minWidth: 0 }}>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 11.5,
                      fontWeight: 600,
                      color: "#0F172A",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      maxWidth: 120,
                    }}
                  >
                    {f.name}
                  </p>
                  <p style={{ margin: 0, fontSize: 10, color: "#94A3B8" }}>
                    {formatBytes(f.size)}
                  </p>
                </div>
              </>
            )}
            <button
              onClick={() => onRemove(idx)}
              style={{
                position: "absolute",
                top: 3,
                right: 3,
                width: 16,
                height: 16,
                borderRadius: "50%",
                border: "none",
                background: "rgba(15,23,42,0.5)",
                color: "#fff",
                fontSize: 10,
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
});

// ─── File bubble inside a message ────────────────────────────
const FileBubble = React.memo(({ file, isOwn }) => {
  const isImg =
    file?.mimeType?.startsWith("image/") ||
    /\.(png|jpg|jpeg|gif|webp)$/i.test(file?.originalName || "");

  if (isImg && file?.url) {
    return (
      <a
        href={file.url}
        download={file.originalName || "image"}
        target="_blank"
        rel="noreferrer"
        style={{ textDecoration: "none", display: "block" }}
      >
        <img
          src={file.url}
          alt={file.originalName}
          style={{
            maxWidth: 200,
            maxHeight: 200,
            borderRadius: 9,
            display: "block",
            border: isOwn ? "none" : "1px solid #E2E8F0",
            marginTop: 4,
            cursor: "pointer",
          }}
        />
        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            marginTop: 4,
            fontSize: 10.5,
            color: isOwn ? "rgba(255,255,255,0.7)" : "#64748B",
          }}
        >
          {IconDownload}
          {file.originalName || "Download image"}
        </span>
      </a>
    );
  }

  return (
    <a
      href={file?.url || "#"}
      download={file?.originalName || "attachment"}
      target="_blank"
      rel="noreferrer"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "9px 13px",
        borderRadius: 10,
        marginTop: 4,
        maxWidth: 240,
        background: isOwn ? "rgba(255,255,255,0.15)" : "#F1F5F9",
        border: isOwn
          ? "1px solid rgba(255,255,255,0.25)"
          : "1px solid #E2E8F0",
        textDecoration: "none",
        transition: "background 0.15s",
      }}
    >
      <span style={{ fontSize: 20 }}>{fileIcon(file?.mimeType)}</span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <p
          style={{
            margin: 0,
            fontSize: 12,
            fontWeight: 600,
            color: isOwn ? "#fff" : "#0F172A",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            maxWidth: 140,
          }}
        >
          {file?.originalName || "Attachment"}
        </p>
        <p
          style={{
            margin: "2px 0 0",
            fontSize: 10,
            color: isOwn ? "rgba(255,255,255,0.6)" : "#94A3B8",
          }}
        >
          {file?.size ? formatBytes(file.size) : "Tap to download"}
        </p>
      </div>
      <span
        style={{
          color: isOwn ? "rgba(255,255,255,0.8)" : "#4A6CF7",
          flexShrink: 0,
        }}
      >
        {IconDownload}
      </span>
    </a>
  );
});

// ─── Message bubble ───────────────────────────────────────────
const MessageBubble = React.memo(({ message, isOwn, showDate }) => {
  // Normalise both formats:
  //   • Partner-sent: message.files = [{ url, originalName, mimeType, size }]
  //   • Admin-sent  : message.fileUrl / message.fileName / message.fileType / message.fileSize (flat)
  const normalizedFiles = (() => {
    if (message.files?.length) return message.files;
    if (message.fileUrl) {
      return [
        {
          url: message.fileUrl,
          originalName: message.fileName || "attachment",
          mimeType: message.fileType || "",
          size: message.fileSize || 0,
        },
      ];
    }
    return [];
  })();

  // Hide the auto-generated "Sent a file: ..." text when a real file bubble is shown
  const displayText =
    normalizedFiles.length > 0 && message.message?.startsWith("Sent a file:")
      ? ""
      : message.message;

  return (
    <>
      {showDate && (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            margin: "12px 0 14px",
          }}
        >
          <div
            style={{
              padding: "4px 11px",
              borderRadius: 999,
              background: "#E2E8F0",
              color: "#475569",
              fontSize: 10.5,
              fontWeight: 600,
            }}
          >
            {fmtDate(message.timestamp || message.createdAt)}
          </div>
        </div>
      )}
      <div
        style={{
          display: "flex",
          justifyContent: isOwn ? "flex-end" : "flex-start",
          marginBottom: 8,
          animation: "msgIn 0.18s ease both",
        }}
      >
        <div
          style={{
            maxWidth: "72%",
            padding: "9px 12px",
            borderRadius: isOwn ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
            background: isOwn
              ? "linear-gradient(135deg,#4A6CF7,#3154E8)"
              : "#FFFFFF",
            color: isOwn ? "#fff" : "#0F172A",
            border: isOwn ? "none" : "1px solid #E9EDF5",
            boxShadow: isOwn
              ? "0 5px 16px rgba(74,108,247,0.18)"
              : "0 2px 10px rgba(15,23,42,0.05)",
          }}
        >
          {normalizedFiles.map((file, idx) => (
            <FileBubble key={idx} file={file} isOwn={isOwn} />
          ))}
          {displayText && (
            <p
              style={{
                margin: normalizedFiles.length ? "7px 0 0" : 0,
                fontSize: 13.5,
                lineHeight: 1.65,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {displayText}
            </p>
          )}
          <p
            style={{
              margin: "5px 0 0",
              fontSize: 10,
              textAlign: "right",
              color: isOwn ? "rgba(255,255,255,0.6)" : "#94A3B8",
            }}
          >
            {fmtTime(message.timestamp || message.createdAt)}
          </p>
        </div>
      </div>
    </>
  );
});

// ─── Pager ────────────────────────────────────────────────────
const MessagesPager = React.memo(
  ({ currentPage, totalPages, onGoTo, totalCount, isLoading }) => {
    if (totalPages <= 1) return null;
    return (
      <div style={S.msgsPager}>
        <p style={S.pagerText}>
          Page {currentPage} of {totalPages} · {totalCount} total
        </p>
        <PaginationBar
          currentPage={currentPage}
          totalPages={totalPages}
          onGoTo={onGoTo}
          isLoading={isLoading}
        />
      </div>
    );
  },
);

// ─── Attach icon ──────────────────────────────────────────────
const IconAttach = (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#64748B"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
  </svg>
);

// ─── ChatView ─────────────────────────────────────────────────
const ChatView = ({
  selected,
  partnerId,
  messages,
  msgLoading,
  msgPaging,
  msgCurrentPage,
  msgTotalPages,
  msgTotalCount,
  isTyping,
  sending,
  input,
  inputRef,
  messagesEndRef,
  showDetailPanel,
  pendingFiles,
  onBack,
  onMsgPageChange,
  onSend,
  onKeyDown,
  onInputChange,
  onToggleDetail,
  onFilesSelected,
  onRemoveFile,
}) => {
  const fileInputRef = useRef(null);

  /* Add this effect for the message textarea for initially 42 upto 120 
  means 3 lines the message is visible of the message - 04-08-2026 */
  useLayoutEffect(() => {
    if (!inputRef.current) return;

    inputRef.current.style.height = "42px";
    inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 120)}px`;
  }, [input]);

  const messageList = useMemo(
    () =>
      messages.map((msg, idx) => {
        const curDate = fmtDate(msg.timestamp || msg.createdAt);
        const prevDate =
          idx > 0
            ? fmtDate(
                messages[idx - 1].timestamp || messages[idx - 1].createdAt,
              )
            : null;
        return (
          <MessageBubble
            key={msg._id || idx}
            message={msg}
            isOwn={String(msg.sender) === String(partnerId)}
            showDate={curDate !== prevDate}
          />
        );
      }),
    [messages, partnerId],
  );

  const canSend = (input.trim() || pendingFiles?.length > 0) && !sending;

  return (
    <>
      <style>{globalCss}</style>
      <div
        style={{
          display: "flex",
          height: "100%",
          width: "100%",
          overflow: "hidden",
          minWidth: 0,
        }}
      >
        <div style={S.chatCol}>
          {/* ── Header ─────────────────────────────────────── */}
          <div style={S.chatHeader}>
            <div style={S.headerRow}>
              <button
                className="back-btn"
                onClick={onBack}
                style={S.backBtn}
                aria-label="Back"
              >
                {IconBack}
              </button>

              {selected.imgUrl ? (
                <img
                  src={selected.imgUrl}
                  alt={selected.title}
                  style={S.headerImg}
                  onError={(e) => {
                    e.target.style.display = "none";
                  }}
                />
              ) : (
                <Avatar title={selected.title} size={38} />
              )}

              <div style={S.headerMeta}>
                <h3 style={S.headerTitle}>{selected.title || "Untitled"}</h3>
                <p style={S.headerSub}>
                  {[selected.company, selected.location]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                <div style={S.pillRow}>
                  {selected.intType && (
                    <span
                      style={
                        selected.intType === "PAID" ? PAID_PILL : FREE_PILL
                      }
                    >
                      {selected.intType === "PAID" ? "Paid" : "Free"}
                    </span>
                  )}
                  {selected.intMode && (
                    <span style={MODE_PILL}>
                      {selected.intMode === "ONLINE"
                        ? "Online"
                        : selected.intMode === "OFFLINE"
                          ? "Offline"
                          : "Hybrid"}
                    </span>
                  )}
                  <span style={ACTIVE_WRAP}>
                    <span style={ACTIVE_DOT} />
                    Active
                  </span>
                </div>
              </div>
            </div>

            {/* Right: msg count + info toggle */}
            <div style={S.headerRight}>
              {msgTotalCount > 0 && (
                <div style={S.msgCount}>
                  <span style={S.msgCountText}>
                    {msgTotalCount} msg{msgTotalCount !== 1 ? "s" : ""}
                  </span>
                </div>
              )}
              <button
                onClick={onToggleDetail}
                title="Internship details"
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  border: showDetailPanel
                    ? "1.5px solid #A5B4FC"
                    : "1px solid #E2E8F0",
                  background: showDetailPanel ? "#EEF2FF" : "#F8FAFC",
                  cursor: "pointer",
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: showDetailPanel ? "#4A6CF7" : "#64748B",
                  transition: "all 0.15s",
                }}
              >
                {IconInfo}
              </button>
            </div>
          </div>

          {/* ── Messages ────────────────────────────────────── */}
          <div style={S.msgArea} className="scroll-smooth">
            {msgLoading ? (
              <Spinner />
            ) : messages?.length ? (
              <>
                <MessagesPager
                  currentPage={msgCurrentPage}
                  totalPages={msgTotalPages}
                  totalCount={msgTotalCount}
                  onGoTo={onMsgPageChange}
                  isLoading={msgPaging}
                />
                {messageList}
                {isTyping && <TypingIndicator />}
                <div ref={messagesEndRef} />
              </>
            ) : (
              <EmptyState
                icon={IconEmptyChat}
                title="No messages yet"
                subtitle="Start the conversation with the admin team about this internship."
              />
            )}
          </div>

          {/* ── Input bar ───────────────────────────────────── */}
          <div style={S.inputBar}>
            <FileAttachmentPreview
              files={pendingFiles}
              onRemove={onRemoveFile}
            />
            <div style={S.inputRow}>
              <input
                type="file"
                ref={fileInputRef}
                multiple
                accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar"
                style={{ display: "none" }}
                onChange={(e) => {
                  if (e.target.files?.length)
                    onFilesSelected(Array.from(e.target.files));
                  e.target.value = "";
                }}
              />

              <button
                className="attach-btn"
                title="Attach files"
                onClick={() => fileInputRef.current?.click()}
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 11,
                  border: "1px solid #E2E8F0",
                  background: "#F8FAFC",
                  cursor: "pointer",
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "background 0.15s",
                }}
              >
                {IconAttach}
              </button>

              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => onInputChange(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Type your message…"
                style={S.textarea}
                rows={1}
                className="no-zoom"
              />

              <button
                onClick={onSend}
                disabled={!canSend}
                style={{ ...S.sendBtn, opacity: !canSend ? 0.5 : 1 }}
                aria-label="Send"
              >
                {sending ? (
                  <div
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: "50%",
                      border: "2px solid rgba(255,255,255,0.4)",
                      borderTopColor: "#fff",
                      animation: "spin 0.7s linear infinite",
                    }}
                  />
                ) : (
                  IconSend
                )}
              </button>
            </div>
            <p style={S.hintText}>
              <strong>Enter</strong> to send · <strong>Shift+Enter</strong> new
              line · attach
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default ChatView;

// ─── Utilities ───────────────────────────────────────────────
function formatBytes(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function fileIcon(mime = "") {
  if (mime.startsWith("image/")) return "🖼️";
  if (mime === "application/pdf") return "📄";
  if (mime.includes("word")) return "📝";
  if (mime.includes("excel") || mime.includes("spreadsheet")) return "📊";
  if (mime.includes("powerpoint") || mime.includes("presentation")) return "📑";
  if (mime.includes("zip") || mime.includes("rar")) return "🗜️";
  return "📎";
}
