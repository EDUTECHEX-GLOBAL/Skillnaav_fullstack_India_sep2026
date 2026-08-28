import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import axiosInstance from "../api/axiosInstance";

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
  const isBot = msg.type === "bot";
  return (
    <div
      className={`flex gap-2 items-end ${isBot ? "justify-start" : "justify-end"} ${isNew ? "animate-slideUp" : ""}`}
    >
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
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.text}</ReactMarkdown>
          </div>
        ) : (
          <span className="break-words whitespace-pre-wrap">{msg.text}</span>
        )}
      </div>

      {!isBot && <Avatar type="user" />}
    </div>
  );
}

/* ─── Suggested prompts ─── */
const SUGGESTIONS = [
  "What is SkillNaav?",
  "How do I apply for jobs?",
  "How does premium work?",
];

export default function Chatbot() {
  const user = JSON.parse(localStorage.getItem("userInfo") || "{}") ?? {};
  const token = localStorage.getItem("userToken") || "";

  const [chatHistory, setChatHistory] = useState(() => {
    try {
      const saved = sessionStorage.getItem("careerChatHistory");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [userInput, setUserInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [newMsgIdx, setNewMsgIdx] = useState(null);

  const [, setReplyCount] = useState(user?.careerChatUsage ?? 0);
  const [, setIsPremium] = useState(
    user?.isPremium && new Date(user.premiumExpiration) > new Date()
  );

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const messagesRef = useRef(null);

  /* sync user profile */
  useEffect(() => {
    if (!token) return;
    const fetchUsage = async () => {
      try {
        const res = await fetch("/api/users/profile", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 401) return;
        const data = await res.json();
        setReplyCount(data.careerChatUsage ?? 0);
        setIsPremium(data.isPremium && new Date(data.premiumExpiration) > new Date());
      } catch (err) {
        console.error("Failed to fetch user info:", err);
      }
    };
    fetchUsage();
  }, [token]);

  /* auto scroll to bottom */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory, loading]);

  /* persist */
  useEffect(() => {
    try {
      sessionStorage.setItem("careerChatHistory", JSON.stringify(chatHistory));
    } catch {}
  }, [chatHistory]);

  /* clear on page refresh */
  useEffect(() => {
    const clear = () => sessionStorage.removeItem("careerChatHistory");
    window.addEventListener("beforeunload", clear);
    return () => window.removeEventListener("beforeunload", clear);
  }, []);

  const sendMessage = async (text) => {
    const msg = (text || userInput).trim();
    if (!msg) return;

    const userMsg = { type: "user", text: msg };
    setChatHistory((prev) => [...prev, userMsg]);
    setNewMsgIdx((prev) => (prev === null ? 0 : prev + 1));
    setUserInput("");
    setLoading(true);
    setError("");

    try {
      const res = await axiosInstance.post(
        "/api/career-chat",
        { message: msg },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const { reply } = res.data;
      const botMsg = { type: "bot", text: reply };
      setChatHistory((prev) => [...prev, botMsg]);
    } catch (err) {
      console.error("Chat error:", err);
      setError("Could not connect. Please try again.");
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

  const isEmpty = chatHistory.length === 0;

  return (
    <div className="flex flex-col h-full">
      {/* ── Message area ── */}
      <div
        ref={messagesRef}
        className="flex-1 overflow-y-auto px-3 py-3 space-y-4 scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent"
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
              <p className="font-semibold text-gray-800 text-sm">SkillNaav Assistant</p>
              <p className="text-xs text-gray-400 mt-1">Ask me anything about SkillNaav</p>
            </div>
            <div className="flex flex-col gap-2 w-full mt-1">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => sendMessage(s)}
                  className="text-xs text-left px-3 py-2 rounded-xl border border-blue-100 bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors duration-150"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {chatHistory.map((msg, idx) => (
          <MessageBubble
            key={idx}
            msg={msg}
            isNew={idx === newMsgIdx || idx === newMsgIdx + 1}
          />
        ))}

        {/* Typing indicator */}
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

      {/* ── Error ── */}
      {error && (
        <div className="mx-3 mb-1 px-3 py-2 rounded-lg bg-red-50 border border-red-100 text-red-500 text-xs flex items-center gap-1.5">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {error}
        </div>
      )}

      {/* ── Input area ── */}
      <div className="px-3 pb-3 pt-2">
        <div className={`flex items-center gap-2 bg-gray-50 border rounded-2xl px-3 py-2 transition-all duration-200 ${userInput ? "border-blue-400 ring-1 ring-blue-200" : "border-gray-200"}`}>
          <textarea
            ref={inputRef}
            rows={1}
            className="flex-1 bg-transparent text-sm text-gray-800 placeholder-gray-400 resize-none outline-none leading-5 max-h-24 overflow-y-auto"
            placeholder="Ask something…"
            value={userInput}
            onChange={(e) => {
              setUserInput(e.target.value);
              // auto-grow
              e.target.style.height = "auto";
              e.target.style.height = Math.min(e.target.scrollHeight, 96) + "px";
            }}
            onKeyDown={handleKeyDown}
            disabled={loading}
          />
          <button
            onClick={() => sendMessage()}
            disabled={loading || !userInput.trim()}
            className={`flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-200
              ${userInput.trim() && !loading
                ? "bg-blue-600 hover:bg-blue-700 shadow-sm hover:shadow-blue-200 hover:shadow-md scale-100 active:scale-95"
                : "bg-gray-200 cursor-not-allowed opacity-60"
              }`}
            aria-label="Send"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
        <p className="text-center text-gray-300 text-[10px] mt-1.5">Press Enter to send · Shift+Enter for new line</p>
      </div>

      {/* ── CSS for animations ── */}
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .animate-slideUp { animation: slideUp 0.25s ease-out; }

        .scrollbar-thin::-webkit-scrollbar { width: 4px; }
        .scrollbar-thin::-webkit-scrollbar-track { background: transparent; }
        .scrollbar-thin::-webkit-scrollbar-thumb { background: #e5e7eb; border-radius: 99px; }
      `}</style>
    </div>
  );
}