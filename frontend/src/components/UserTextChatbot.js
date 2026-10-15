import React, { useState, useEffect, useRef } from "react";
import axiosInstance from "../api/axiosInstance";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/* ─── Typing indicator dots ─── */
function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-4 py-3">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-2 h-2 rounded-full bg-blue-400 animate-bounce"
          style={{ animationDelay: `${i * 0.15}s`, animationDuration: "0.9s" }}
        />
      ))}
    </div>
  );
}

/* ─── Avatar ─── */
function Avatar({ type }) {
  if (type === "bot") {
    return (
      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-sm">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="8" r="4" />
          <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
        </svg>
      </div>
    );
  }
  return (
    <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-violet-400 to-purple-600 flex items-center justify-center shadow-sm">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    </div>
  );
}

/* ─── Message bubble ─── */
function MessageBubble({ msg, isNew }) {
  const isBot = msg.sender === "bot";
  return (
    <div className={`flex gap-2 items-end ${isBot ? "justify-start" : "justify-end"} ${isNew ? "animate-slideUp" : ""}`}>
      {isBot && <Avatar type="bot" />}
      <div
        className={`
          max-w-[78%] rounded-2xl text-sm leading-relaxed shadow-sm
          ${isBot
            ? "bg-white border border-gray-100 text-gray-800 rounded-bl-sm px-4 py-3"
            : "bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-br-sm px-4 py-3"
          }
        `}
      >
        {isBot ? (
          <div className="prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                p: ({ node, ...props }) => <p className="my-1" {...props} />,
                li: ({ node, ...props }) => <li className="ml-4 list-disc" {...props} />,
              }}
            >
              {msg.text}
            </ReactMarkdown>
          </div>
        ) : (
          <span className="break-words whitespace-pre-wrap">{msg.text}</span>
        )}
      </div>
      {!isBot && <Avatar type="user" />}
    </div>
  );
}

const SUGGESTIONS = [
  "What is Edutechex?",
  "How do I apply for jobs?",
  "How does premium work?",
];

const UserTextChatbot = ({ onClose }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [newMsgIdx, setNewMsgIdx] = useState(null);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const sendMessage = async (text) => {
    const msg = (text || input).trim();
    if (!msg) return;

    const userMsg = { sender: "user", text: msg };
    setMessages((prev) => [...prev, userMsg]);
    setNewMsgIdx((prev) => (prev === null ? 0 : prev + 1));
    setInput("");
    if (inputRef.current) {
      inputRef.current.style.height = "38px";
    }
    setLoading(true);

    try {
      const token = localStorage.getItem("userToken") || "";
      const res = await axiosInstance.post(
        "/api/career-chat",
        { message: msg },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMessages((prev) => [...prev, { sender: "bot", text: res.data.reply }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { sender: "bot", text: "Something went wrong. Please try again." },
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const isEmpty = messages.length === 0;

  return (
    <>
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        .animate-slideUp { animation: slideUp 0.25s ease-out; }
        .animate-fadeIn { animation: fadeIn 0.2s ease-out; }
        .scrollbar-thin::-webkit-scrollbar { width: 4px; }
        .scrollbar-thin::-webkit-scrollbar-track { background: transparent; }
        .scrollbar-thin::-webkit-scrollbar-thumb { background: #e5e7eb; border-radius: 99px; }
        .chat-input-textarea {
          height: 38px !important;
          min-height: 38px !important;
          max-height: 80px !important;
          border: none !important;
          outline: none !important;
          box-shadow: none !important;
          margin: 0 !important;
          padding: 8px 12px !important;
          background: transparent !important;
          resize: none !important;
          line-height: 20px !important;
          font-size: 14px !important;
          width: 100% !important;
        }
        .chat-input-textarea:focus {
          border: none !important;
          outline: none !important;
          box-shadow: none !important;
        }
      `}</style>

      {/* Mobile Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-xs z-[9999] sm:hidden animate-fadeIn"
        onClick={onClose}
      />

      {/* Main Container */}
      <div
        className="fixed inset-0 sm:inset-auto sm:bottom-24 sm:right-6 z-[10000] flex flex-col justify-end pointer-events-none"
        style={{ transformOrigin: "bottom right" }}
      >
        <div
          className="w-full sm:w-[380px] sm:max-w-[calc(100vw-32px)] bg-white sm:rounded-2xl shadow-2xl border-t sm:border border-gray-100 flex flex-col overflow-hidden pointer-events-auto animate-slideUp h-[100dvh] sm:h-[540px] sm:max-h-[calc(100vh-120px)]"
        >
          {/* Header */}
          <div 
            className="flex items-center justify-between px-4 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 flex-shrink-0"
            style={{ paddingTop: "max(14px, env(safe-area-inset-top, 14px))" }}
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <div>
                <p className="text-white font-semibold text-sm leading-tight">Edutechex Assistant</p>
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-white/70 text-[10px]">Online</span>
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/10 hover:bg-white/20 active:bg-white/30 transition-colors text-white"
              aria-label="Close chat"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div
            className="flex-1 overflow-y-auto px-4 py-3 space-y-4 scrollbar-thin"
            style={{ minHeight: 0 }}
          >
            {isEmpty && !loading && (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-4 py-6">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-gray-800 text-sm">Edutechex Assistant</p>
                  <p className="text-xs text-gray-400 mt-1">Ask me anything about Edutechex</p>
                </div>
                <div className="flex flex-col gap-2 w-full mt-1">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => sendMessage(s)}
                      className="text-xs text-left px-3.5 py-2.5 rounded-xl border border-blue-100 bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors duration-150 active:scale-[0.99]"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, idx) => (
              <MessageBubble
                key={idx}
                msg={msg}
                isNew={idx === newMsgIdx || idx === newMsgIdx + 1}
              />
            ))}

            {loading && (
              <div className="flex gap-2 items-end justify-start animate-slideUp">
                <Avatar type="bot" />
                <div className="bg-white border border-gray-100 rounded-2xl rounded-bl-sm shadow-sm">
                  <TypingDots />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div 
            className="px-3 sm:px-4 pt-2 pb-3 bg-white border-t border-gray-100 flex-shrink-0"
            style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom, 12px))" }}
          >
            <div className={`flex items-center gap-1.5 bg-gray-50 border rounded-full px-2 py-1 transition-all duration-200 ${input ? "border-blue-500 ring-2 ring-blue-100 bg-white" : "border-gray-200"}`}>
              <textarea
                ref={inputRef}
                rows={1}
                className="chat-input-textarea flex-1 text-gray-800 placeholder-gray-400 overflow-y-auto"
                style={{
                  height: "38px",
                  minHeight: "38px",
                  maxHeight: "80px",
                  border: "none",
                  outline: "none",
                  boxShadow: "none",
                  margin: 0,
                  padding: "8px 12px",
                  background: "transparent",
                  resize: "none",
                  lineHeight: "20px",
                  fontSize: "14px",
                  width: "100%",
                }}
                placeholder="Ask something…"
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  e.target.style.height = "38px";
                  e.target.style.height = Math.min(Math.max(e.target.scrollHeight, 38), 80) + "px";
                }}
                onKeyDown={handleKeyDown}
                disabled={loading}
              />
              <button
                onClick={() => sendMessage()}
                disabled={loading || !input.trim()}
                className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 mr-0.5
                  ${input.trim() && !loading
                    ? "bg-blue-600 hover:bg-blue-700 shadow-sm hover:shadow-blue-200 active:scale-95 text-white"
                    : "bg-gray-200 cursor-not-allowed opacity-60 text-gray-400"
                  }`}
                aria-label="Send"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </div>
            <p className="text-center text-gray-400 text-[10px] mt-1 hidden sm:block">Press Enter to send · Shift+Enter for new line</p>
          </div>
        </div>
      </div>
    </>
  );
};

export default UserTextChatbot;
