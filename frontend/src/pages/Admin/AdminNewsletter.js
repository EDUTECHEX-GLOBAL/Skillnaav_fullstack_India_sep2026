import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  FaPaperPlane,
  FaHistory,
  FaCheckCircle,
  FaChevronDown,
  FaCheck,
  FaSpinner,
  FaExclamationCircle,
  FaSyncAlt,
} from "react-icons/fa";
import axios from "../../api/axiosInstance";

const AdminNewsletter = () => {
  const [recipientGroup, setRecipientGroup] = useState("all");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(() =>
    new Date().toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
  );
  const [sentSuccess, setSentSuccess] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const [audienceCounts, setAudienceCounts] = useState({
    all: 41,
    subscribers: 38,
    contacts: 6,
  });

  const [history, setHistory] = useState([
    {
      id: 1,
      subject: "Welcome to October 2026 Platform Updates",
      recipients: "41 Recipients",
      date: "19 Oct 2026",
      status: "Delivered",
    },
    {
      id: 2,
      subject: "Welcome to Edutechex Autumn 2026 Batch",
      recipients: "38 Subscribers",
      date: "14 Oct 2026",
      status: "Delivered",
    },
    {
      id: 3,
      subject: "Global Tech Internship Openings Announcement",
      recipients: "41 Recipients",
      date: "08 Oct 2026",
      status: "Delivered",
    },
  ]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch real audience counts and broadcast history from MongoDB
  const loadData = useCallback(async (isManual = false) => {
    if (isManual) setLoading(true);
    try {
      const [audRes, histRes] = await Promise.all([
        axios.get("/api/contact/newsletter/audiences"),
        axios.get("/api/contact/newsletter/history"),
      ]);

      if (audRes.data?.counts) {
        setAudienceCounts(audRes.data.counts);
      }
      if (histRes.data?.history && Array.isArray(histRes.data.history)) {
        setHistory(histRes.data.history);
      }
      setLastUpdated(
        new Date().toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
    } catch (err) {
      console.error("Failed to load newsletter metadata:", err);
    } finally {
      if (isManual) {
        setTimeout(() => setLoading(false), 350);
      }
    }
  }, []);

  // Initial load + real-time polling every 12 seconds
  useEffect(() => {
    loadData(false);
    const interval = setInterval(() => {
      loadData(false);
    }, 12000);
    return () => clearInterval(interval);
  }, [loadData]);

  const audienceOptions = [
    {
      value: "all",
      label: `All Audiences (${audienceCounts.contacts} Contacts + ${audienceCounts.subscribers} Subscribers = ${audienceCounts.all} recipients)`,
    },
    {
      value: "subscribers",
      label: `Subscribers Only (${audienceCounts.subscribers} recipients)`,
    },
    {
      value: "contacts",
      label: `Contacts Only (${audienceCounts.contacts} recipients)`,
    },
  ];

  const handleSend = async (e) => {
    e.preventDefault();
    if (!subject.trim()) {
      setErrorMessage("Please enter an email subject.");
      return;
    }
    if (!message.trim()) {
      setErrorMessage("Please enter the email announcement content.");
      return;
    }

    setSending(true);
    setErrorMessage("");
    setSentSuccess("");

    try {
      const res = await axios.post("/api/contact/newsletter/send", {
        targetAudience: recipientGroup,
        subject: subject.trim(),
        message: message.trim(),
      });

      if (res.data?.success) {
        setSentSuccess(
          res.data.message || "Newsletter broadcast has been successfully sent!"
        );
        if (res.data.broadcast) {
          setHistory((prev) => [res.data.broadcast, ...prev]);
        }
        setSubject("");
        setMessage("");

        // Auto dismiss success after 6 seconds
        setTimeout(() => {
          setSentSuccess("");
        }, 6000);
      } else {
        setErrorMessage(res.data?.message || "Failed to send newsletter.");
      }
    } catch (err) {
      console.error("Failed to send broadcast:", err);
      setErrorMessage(
        err.response?.data?.message || "Error transmitting broadcast. Please try again."
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl md:text-2xl font-black text-slate-800 tracking-tight">
              NEWSLETTER & BROADCASTS
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Send announcements, updates, and digests to your contacts and subscribers
          </p>
        </div>

        <button
          onClick={() => loadData(true)}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 rounded-lg text-xs font-semibold shadow-xs transition-colors self-start sm:self-auto cursor-pointer"
          title="Refresh audience and broadcast history"
        >
          <FaSyncAlt className={`text-xs ${loading ? "animate-spin text-blue-600" : ""}`} />
          <span>{loading ? "Refreshing..." : "Refresh"}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Compose Card */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <h2 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
            <FaPaperPlane className="text-blue-600" />
            <span>Compose Newsletter</span>
          </h2>

          {sentSuccess && (
            <div className="mb-4 bg-emerald-50 border border-emerald-200 text-emerald-800 p-3.5 rounded-xl flex items-center gap-2.5 text-xs font-semibold animate-fadeIn">
              <FaCheckCircle className="text-emerald-600 text-sm flex-shrink-0" />
              <span>{sentSuccess}</span>
            </div>
          )}

          {errorMessage && (
            <div className="mb-4 bg-rose-50 border border-rose-200 text-rose-800 p-3.5 rounded-xl flex items-center gap-2.5 text-xs font-semibold animate-fadeIn">
              <FaExclamationCircle className="text-rose-600 text-sm flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSend} className="space-y-4">
            <div className="relative" ref={dropdownRef}>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Target Audience
              </label>
              <button
                type="button"
                onClick={() => setIsDropdownOpen((prev) => !prev)}
                className={`w-full flex items-center justify-between px-3 py-2.5 border rounded-xl text-xs bg-white text-slate-800 transition-all cursor-pointer focus:outline-none ${
                  isDropdownOpen
                    ? "border-blue-500 ring-2 ring-blue-500"
                    : "border-slate-300 hover:border-slate-400"
                }`}
              >
                <span className="font-medium truncate">
                  {audienceOptions.find((o) => o.value === recipientGroup)?.label ||
                    "Select Audience"}
                </span>
                <FaChevronDown
                  className={`text-[10px] text-slate-500 transition-transform duration-200 ${
                    isDropdownOpen ? "transform rotate-180 text-blue-600" : ""
                  }`}
                />
              </button>

              {isDropdownOpen && (
                <div className="absolute top-full left-0 right-0 w-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden py-1">
                  {audienceOptions.map((opt) => {
                    const isSelected = recipientGroup === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          setRecipientGroup(opt.value);
                          setIsDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-xs transition-colors flex items-center justify-between cursor-pointer ${
                          isSelected
                            ? "bg-blue-600 text-white font-semibold"
                            : "text-slate-700 hover:bg-blue-50 hover:text-blue-600"
                        }`}
                      >
                        <span className="truncate">{opt.label}</span>
                        {isSelected && (
                          <FaCheck className="text-[10px] text-white flex-shrink-0 ml-2" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Email Subject
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Exciting New Aerospace & AI Internships Open for Applications"
                disabled={sending}
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Message Content
              </label>
              <textarea
                rows={6}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Write your email announcement or newsletter content here..."
                disabled={sending}
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50"
              />
            </div>

            <button
              type="submit"
              disabled={sending}
              className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold shadow-md transition-all ${
                sending
                  ? "bg-blue-400 text-white cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white cursor-pointer"
              }`}
            >
              {sending ? (
                <>
                  <FaSpinner className="animate-spin text-xs" />
                  <span>Transmitting Broadcast...</span>
                </>
              ) : (
                <>
                  <FaPaperPlane size={11} />
                  <span>Send Broadcast Now</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* History / Recent Broadcasts */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col">
          <h2 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
            <FaHistory className="text-slate-500" />
            <span>Recent Broadcasts</span>
          </h2>

          <div className="space-y-3 overflow-y-auto max-h-[460px] pr-1">
            {history.map((item, index) => (
              <div
                key={item.id || index}
                className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/70 hover:bg-slate-50 transition shadow-2xs"
              >
                <div className="text-xs font-bold text-slate-800 line-clamp-2">
                  {item.subject}
                </div>
                <div className="flex justify-between items-center text-[11px] text-slate-500 mt-2">
                  <span className="font-medium text-slate-600">{item.recipients}</span>
                  <span className="text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 text-[10px]">
                    {item.status || "Delivered"}
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 mt-1">{item.date}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminNewsletter;
