import React, { useState, useEffect, useCallback } from "react";
import axios from "../../../../api/axiosInstance";
import CVBuilder from "./CVBuilder";

/**
 * SmartProfile
 * ─────────────────────────────────────────────────────────────────
 * This component is a COMPANION to the existing ProfileForm.jsx.
 *
 * ProfileForm.jsx  → handles: name, email, skills, linkedin, portfolio,
 *                             education, location, etc. (Userwebapp fields)
 *
 * SmartProfile     → adds:   AI diff approval panel, summary,
 *                             experience, projects, certifications,
 *                             languages, CV generation, profile score
 *
 * Mount SmartProfile alongside or below ProfileForm in your route:
 *
 *   <ProfileForm />
 *   <SmartProfile />
 *
 * Or use the tabbed layout provided at the bottom of this file.
 */

// ── Minimal icon set (inline SVG, no extra deps) ──────────────────────────────
const Ico = ({ d, className = "w-5 h-5" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d={d} />
  </svg>
);
const ICONS = {
  sparkle:   "M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z",
  check:     "m4.5 12.75 6 6 9-13.5",
  x:         "M6 18 18 6M6 6l12 12",
  plus:      "M12 4.5v15m7.5-7.5h-15",
  pencil:    "m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z",
  download:  "M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3",
  briefcase: "M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 0 0 .75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 0 0-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0 1 12 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 0 1-.673-.38m0 0A2.18 2.18 0 0 1 3 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 0 1 3.413-.387m7.5 0V5.25A2.25 2.25 0 0 0 13.5 3h-3a2.25 2.25 0 0 0-2.25 2.25v.894m7.5 0a48.667 48.667 0 0 0-7.5 0",
  code:      "M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5",
  star:      "M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.563.563 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z",
  globe:     "M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253",
  trash:     "m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0",
  warn:      "M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z",
};

// ── Tiny helpers ──────────────────────────────────────────────────────────────
const Tag = ({ label, onRemove }) => (
  <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-3 py-0.5 text-sm font-medium">
    {label}
    {onRemove && (
      <button onClick={onRemove} className="text-blue-400 hover:text-blue-700">
        <Ico d={ICONS.x} className="w-3 h-3" />
      </button>
    )}
  </span>
);

const SectionHeader = ({ icon, title, onEdit }) => (
  <div className="flex items-center justify-between px-5 py-3.5 bg-gradient-to-r from-blue-50 to-white border-b border-blue-100">
    <div className="flex items-center gap-2.5">
      <span className="text-blue-600">{icon}</span>
      <h3 className="font-semibold text-gray-800 text-sm tracking-tight">{title}</h3>
    </div>
    {onEdit && (
      <button onClick={onEdit} className="text-gray-400 hover:text-blue-600 p-1.5 rounded-lg hover:bg-blue-50 transition-colors">
        <Ico d={ICONS.pencil} className="w-4 h-4" />
      </button>
    )}
  </div>
);

const Card = ({ children, className = "" }) => (
  <div className={`bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden ${className}`}>
    {children}
  </div>
);

const EmptyRow = ({ text, onAdd }) => (
  <button
    onClick={onAdd}
    className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-gray-200 hover:border-blue-300 rounded-xl py-5 text-gray-400 hover:text-blue-500 transition-colors text-sm font-medium"
  >
    <Ico d={ICONS.plus} className="w-4 h-4" /> {text}
  </button>
);

// ── Completion ring ───────────────────────────────────────────────────────────
const Ring = ({ score, profileImage }) => {
  const size = 88;
  const r = 38;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = score >= 75 ? "#16a34a" : score >= 45 ? "#d97706" : "#dc2626";
  const labelColor = score >= 75 ? "text-green-600" : score >= 45 ? "text-amber-600" : "text-red-500";

  const getProfileImageUrl = (img) => {
    if (!img || typeof img !== "string" || img.trim() === "") return null;
    if (img.startsWith("data:image") || img.startsWith("http://") || img.startsWith("https://")) return img;
    const baseUrl = process.env.REACT_APP_API_BASE || "http://localhost:5000";
    const normalizedImage = img.replace(/\\/g, "/");
    if (normalizedImage.startsWith("/")) return `${baseUrl}${normalizedImage}`;
    if (normalizedImage.startsWith("uploads/")) return `${baseUrl}/${normalizedImage}`;
    return `${baseUrl}/uploads/${normalizedImage}`;
  };

  return (
    <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
      {/* Ring + photo */}
      <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90" style={{ position: "absolute", top: 0, left: 0 }}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f1f5f9" strokeWidth="7" />
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="7"
            strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 0.7s ease" }} />
        </svg>
        {/* Profile photo or fallback avatar — fills the inside of the ring */}
        <div className="rounded-full overflow-hidden bg-gray-100 border-2 border-white shadow-sm"
          style={{ width: size - 18, height: size - 18 }}>
          {profileImage ? (
            <img src={getProfileImageUrl(profileImage)} alt="Profile" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-100 to-indigo-200">
              <svg className="w-8 h-8 text-indigo-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
              </svg>
            </div>
          )}
        </div>
      </div>
      {/* Percentage below the ring */}
      <span className={`text-sm font-bold ${labelColor}`}>{score}%</span>
    </div>
  );
};

// ── Diff card ─────────────────────────────────────────────────────────────────
const DiffCard = ({ diff, onApprove, onReject }) => {
  const renderVal = (val) => {
    if (!val && val !== 0) return <span className="text-gray-400 italic text-xs">Not set</span>;
    if (Array.isArray(val)) return (
      <div className="flex flex-wrap gap-1 mt-1">
        {val.map((v, i) => <Tag key={i} label={v} />)}
      </div>
    );
    if (typeof val === "object") return (
      <div className="text-xs text-gray-600 space-y-0.5 mt-1">
        {Object.entries(val).map(([k, v]) => v ? (
          <div key={k}><span className="text-gray-400 capitalize">{k}:</span> {String(v)}</div>
        ) : null)}
      </div>
    );
    return <span className="text-sm text-gray-700">{String(val)}</span>;
  };

  const isUserwebapp = diff.target === "userwebapp";

  return (
    <div className="border border-amber-200 bg-amber-50/70 rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Ico d={ICONS.sparkle} className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-gray-800">{diff.label}</p>
            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
              isUserwebapp ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"
            }`}>
              {isUserwebapp ? "Updates your main profile" : "Adds to profile portfolio"}
            </span>
          </div>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button onClick={() => onApprove(diff._id)}
            className="flex items-center gap-1 bg-green-500 hover:bg-green-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors">
            <Ico d={ICONS.check} className="w-3.5 h-3.5" /> Accept
          </button>
          <button onClick={() => onReject(diff._id)}
            className="flex items-center gap-1 bg-white hover:bg-red-50 border border-red-200 text-red-500 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors">
            <Ico d={ICONS.x} className="w-3.5 h-3.5" /> Ignore
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="bg-white rounded-lg p-2.5 border border-gray-100">
          <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Current</p>
          {renderVal(diff.currentValue)}
        </div>
        <div className="bg-white rounded-lg p-2.5 border border-green-100">
          <p className="text-xs font-semibold text-green-600 uppercase mb-1">Suggested</p>
          {renderVal(diff.suggestedValue)}
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN SmartProfile COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
const SmartProfile = () => {
  const [data, setData] = useState(null);        // merged profile object
  const [diffs, setDiffs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("summary");
  const [editModal, setEditModal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showCV, setShowCV] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(null);
  const [toast, setToast] = useState(null);

  const studentInfo = JSON.parse(localStorage.getItem("studentInfo") || "{}");
  const userId = studentInfo?._id;

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // ── Fetch merged profile ──────────────────────────────────────────────────
  const fetchProfile = useCallback(async () => {
    if (!userId) return;
    try {
      const { data: res } = await axios.get(`/api/student-profile/${userId}`);
      setData(res);
      setDiffs(res.pendingDiffs || []);
    } catch (err) {
      console.error("fetch profile error:", err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  // ── Approve single diff ───────────────────────────────────────────────────
  const approveDiff = async (diffId) => {
    try {
      await axios.patch(`/api/student-profile/${userId}/diffs/${diffId}`, { action: "approve" });
      setDiffs(prev => prev.filter(d => d._id !== diffId));
      await fetchProfile();
      showToast("Update applied to your profile!");
    } catch { showToast("Failed to apply update", "error"); }
  };

  const rejectDiff = async (diffId) => {
    try {
      await axios.patch(`/api/student-profile/${userId}/diffs/${diffId}`, { action: "reject" });
      setDiffs(prev => prev.filter(d => d._id !== diffId));
    } catch { showToast("Failed", "error"); }
  };

  const bulkResolve = async (action) => {
    setBulkLoading(action);
    try {
      await axios.patch(`/api/student-profile/${userId}/diffs/bulk`, { action });
      setDiffs([]);
      if (action === "approve") { await fetchProfile(); showToast("All updates applied!"); }
    } catch { showToast("Failed", "error"); }
    finally { setBulkLoading(null); }
  };

  // ── Save extension section ────────────────────────────────────────────────
  const saveSection = async (section, sectionData) => {
    setSaving(true);
    try {
      await axios.put(`/api/student-profile/${userId}`, { section, data: sectionData });
      setEditModal(null);
      await fetchProfile();
      showToast("Saved successfully!");
    } catch { showToast("Save failed", "error"); }
    finally { setSaving(false); }
  };

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-7 h-7 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const hasDiffs = diffs.length > 0;
  const tabs = [
    { id: "summary", label: "Summary" },
    { id: "experience", label: "Experience" },
    { id: "projects", label: "Projects" },
    { id: "certifications", label: "Certifications" },
    { id: "languages", label: "Languages" },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-5 font-poppins">
      {/* ── Toast ──────────────────────────────────────────────────────────── */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg text-white text-sm font-medium transition-all
          ${toast.type === "error" ? "bg-red-500" : "bg-green-500"}`}>
          {toast.msg}
        </div>
      )}

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Career Portfolio</h2>
          <p className="text-gray-500 text-sm mt-0.5">
            Experience, projects, and AI-powered suggestions from your resume
          </p>
        </div>
        <button
          onClick={() => setShowCV(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2.5 rounded-lg transition-all shadow-sm text-sm"
        >
          <Ico d={ICONS.download} className="w-4 h-4" />
          Generate CV / Resume
        </button>
      </div>

      {/* ── Profile Completion Card ─────────────────────────────────────────── */}
      <Card>
        <div className="p-5 flex items-center gap-5">
          <Ring score={data?.profileCompletionScore || 0} profileImage={data?.profileImage} />
          <div className="flex-1">
            <p className="font-semibold text-gray-800">Profile Strength</p>
            <p className="text-gray-500 text-sm mt-0.5">
              {(data?.profileCompletionScore || 0) >= 75
                ? "Strong profile! You're visible to more partners."
                : (data?.profileCompletionScore || 0) >= 45
                ? "Good start — add experience and projects to stand out."
                : "Complete your profile for better AI matching."}
            </p>
            {/* Quick gap hints */}
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              {!data?.summary && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">+ Summary</span>}
              {!(data?.experience?.length) && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">+ Experience</span>}
              {!(data?.projects?.length) && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">+ Projects</span>}
              {!(data?.certifications?.length) && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">+ Certifications</span>}
            </div>
          </div>
          {/* Current skills from Userwebapp (read-only here, editable in ProfileForm) */}
          {(data?.skills || []).length > 0 && (
            <div className="hidden sm:block">
              <p className="text-xs text-gray-400 font-semibold uppercase mb-1.5">Your Skills</p>
              <div className="flex flex-wrap gap-1 max-w-xs">
                {data.skills.slice(0, 6).map((s, i) => <Tag key={i} label={s} />)}
                {data.skills.length > 6 && <span className="text-xs text-gray-400 self-center">+{data.skills.length - 6} more</span>}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* ── AI Diff Banner ──────────────────────────────────────────────────── */}
      {hasDiffs && (
        <Card>
          <div className="px-5 py-4 bg-amber-50 border-b border-amber-100 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2.5">
              <Ico d={ICONS.sparkle} className="w-5 h-5 text-amber-500" />
              <div>
                <p className="font-semibold text-gray-800 text-sm">
                  {diffs.length} AI suggestion{diffs.length > 1 ? "s" : ""} from your resume
                </p>
                <p className="text-amber-700 text-xs">Review and accept updates to enrich your profile</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => bulkResolve("reject")} disabled={!!bulkLoading}
                className="text-xs border border-gray-200 bg-white text-gray-600 px-3 py-1.5 rounded-lg font-medium hover:bg-gray-50 disabled:opacity-50">
                {bulkLoading === "reject" ? "..." : "Ignore All"}
              </button>
              <button onClick={() => bulkResolve("approve")} disabled={!!bulkLoading}
                className="text-xs bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg font-medium disabled:opacity-50">
                {bulkLoading === "approve" ? "Applying..." : "Accept All"}
              </button>
            </div>
          </div>
          <div className="p-5 space-y-3">
            {diffs.map(diff => (
              <DiffCard key={diff._id} diff={diff} onApprove={approveDiff} onReject={rejectDiff} />
            ))}
          </div>
        </Card>
      )}

      {/* ── Tab nav ─────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === t.id ? "bg-blue-600 text-white" : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* SUMMARY */}
      {activeTab === "summary" && (
        <Card>
          <SectionHeader
            icon={<Ico d={ICONS.star} />}
            title="Professional Summary"
            onEdit={() => setEditModal({ type: "summary", data: data?.summary || "" })}
          />
          <div className="px-5 py-4">
            {data?.summary ? (
              <p className="text-gray-600 text-sm leading-relaxed">{data.summary}</p>
            ) : (
              <EmptyRow text="Add a professional summary" onAdd={() => setEditModal({ type: "summary", data: "" })} />
            )}
          </div>
        </Card>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* EXPERIENCE */}
      {activeTab === "experience" && (
        <Card>
          <SectionHeader
            icon={<Ico d={ICONS.briefcase} />}
            title="Experience"
            onEdit={() => setEditModal({ type: "experience", data: [...(data?.experience || [])] })}
          />
          <div className="px-5 py-4 space-y-4">
            {(data?.experience || []).length > 0 ? (
              data.experience.map((exp, i) => (
                <div key={i} className="flex gap-3 pb-4 border-b border-gray-50 last:border-0 last:pb-0">
                  <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Ico d={ICONS.briefcase} className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800 text-sm">{exp.title}</p>
                    <p className="text-gray-600 text-xs">{exp.company}{exp.location ? ` · ${exp.location}` : ""}</p>
                    <p className="text-gray-400 text-xs mt-0.5">{exp.startDate} — {exp.current ? "Present" : exp.endDate}</p>
                    {exp.description && <p className="text-gray-500 text-xs mt-1.5 leading-relaxed">{exp.description}</p>}
                  </div>
                </div>
              ))
            ) : (
              <EmptyRow text="Add internship or work experience" onAdd={() => setEditModal({ type: "experience", data: [] })} />
            )}
          </div>
        </Card>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* PROJECTS */}
      {activeTab === "projects" && (
        <Card>
          <SectionHeader
            icon={<Ico d={ICONS.code} />}
            title="Projects"
            onEdit={() => setEditModal({ type: "projects", data: [...(data?.projects || [])] })}
          />
          <div className="px-5 py-4 space-y-3">
            {(data?.projects || []).length > 0 ? (
              data.projects.map((proj, i) => (
                <div key={i} className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-gray-800 text-sm">{proj.name}</p>
                    {proj.link && (
                      <a href={proj.link} target="_blank" rel="noreferrer"
                        className="text-blue-600 text-xs hover:underline flex-shrink-0">
                        View →
                      </a>
                    )}
                  </div>
                  {proj.description && <p className="text-gray-500 text-xs mt-1 leading-relaxed">{proj.description}</p>}
                  {proj.techStack?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {proj.techStack.map((t, j) => (
                        <span key={j} className="text-xs bg-white border border-gray-200 text-gray-600 px-2 py-0.5 rounded-full">{t}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <EmptyRow text="Add your projects" onAdd={() => setEditModal({ type: "projects", data: [] })} />
            )}
          </div>
        </Card>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* CERTIFICATIONS */}
      {activeTab === "certifications" && (
        <Card>
          <SectionHeader
            icon={<Ico d={ICONS.star} />}
            title="Certifications"
            onEdit={() => setEditModal({ type: "certifications", data: [...(data?.certifications || [])] })}
          />
          <div className="px-5 py-4 space-y-4">
            {(data?.certifications || []).length > 0 ? (
              data.certifications.map((cert, i) => (
                <div key={i} className="flex gap-3">
                  <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
                    <Ico d={ICONS.star} className="w-4 h-4 text-amber-500" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800 text-sm">{cert.name}</p>
                    {cert.issuer && <p className="text-gray-600 text-xs">{cert.issuer}</p>}
                    <p className="text-gray-400 text-xs mt-0.5">
                      {cert.issueDate}{cert.expiryDate ? ` — Expires ${cert.expiryDate}` : ""}
                    </p>
                    {cert.credentialUrl && (
                      <a href={cert.credentialUrl} target="_blank" rel="noreferrer" className="text-blue-600 text-xs hover:underline">
                        View Credential →
                      </a>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <EmptyRow text="Add your certifications" onAdd={() => setEditModal({ type: "certifications", data: [] })} />
            )}
          </div>
        </Card>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* LANGUAGES */}
      {activeTab === "languages" && (
        <Card>
          <SectionHeader
            icon={<Ico d={ICONS.globe} />}
            title="Languages"
            onEdit={() => setEditModal({ type: "languages", data: [...(data?.languages || [])] })}
          />
          <div className="px-5 py-4">
            {(data?.languages || []).length > 0 ? (
              <div className="flex flex-wrap gap-3">
                {data.languages.map((lang, i) => (
                  <div key={i} className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-2.5 text-center min-w-[90px]">
                    <p className="font-semibold text-gray-700 text-sm">{lang.language}</p>
                    <p className="text-gray-400 text-xs">{lang.proficiency}</p>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyRow text="Add languages you speak" onAdd={() => setEditModal({ type: "languages", data: [] })} />
            )}
          </div>
        </Card>
      )}

      {/* ── Edit Modal ────────────────────────────────────────────────────────── */}
      {editModal && (
        <EditModal
          modal={editModal}
          onSave={(section, sectionData) => saveSection(section, sectionData)}
          onClose={() => setEditModal(null)}
          saving={saving}
        />
      )}

      {/* ── CV Builder Modal ──────────────────────────────────────────────────── */}
      {showCV && (
        <CVBuilder profile={data} onClose={() => setShowCV(false)} />
      )}
    </div>
  );
};

// ─── Edit Modal ───────────────────────────────────────────────────────────────
const EditModal = ({ modal, onSave, onClose, saving }) => {
  const [form, setForm] = useState(modal.data);
  const ic = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300";
  const lc = "block text-xs font-semibold text-gray-500 mb-1";

  const templates = {
    experience: { title:"", company:"", location:"", startDate:"", endDate:"", current:false, description:"" },
    projects:   { name:"", description:"", techStack:[], link:"" },
    certifications: { name:"", issuer:"", issueDate:"", expiryDate:"", credentialUrl:"" },
    languages:  { language:"", proficiency:"Intermediate" },
  };

  const fieldDefs = {
    experience:     ["title","company","location","startDate","endDate","description"],
    projects:       ["name","description","link"],
    certifications: ["name","issuer","issueDate","expiryDate","credentialUrl"],
    languages:      ["language","proficiency"],
  };

  const addItem = () => setForm(prev => [...(Array.isArray(prev) ? prev : []), { ...templates[modal.type] }]);
  const removeItem = i => setForm(prev => prev.filter((_, idx) => idx !== i));
  const updateItem = (i, key, val) => setForm(prev => {
    const next = [...prev];
    next[i] = { ...next[i], [key]: val };
    return next;
  });

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800 capitalize">Edit {modal.type}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <Ico d={ICONS.x} className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
          {/* Summary — simple textarea */}
          {modal.type === "summary" && (
            <div>
              <label className={lc}>Professional Summary</label>
              <textarea className={`${ic} min-h-[120px] resize-none`}
                value={form || ""} onChange={e => setForm(e.target.value)}
                placeholder="Briefly describe your professional background, strengths, and goals..." />
            </div>
          )}

          {/* List sections */}
          {["experience","projects","certifications","languages"].includes(modal.type) && (
            <>
              {(Array.isArray(form) ? form : []).map((item, i) => (
                <div key={i} className="border border-gray-100 rounded-xl p-4 space-y-3 relative">
                  <button onClick={() => removeItem(i)}
                    className="absolute top-3 right-3 text-gray-300 hover:text-red-400">
                    <Ico d={ICONS.trash} className="w-4 h-4" />
                  </button>
                  {(fieldDefs[modal.type] || []).map(key => (
                    <div key={key}>
                      <label className={lc}>{key.replace(/([A-Z])/g," $1").replace(/^./,s=>s.toUpperCase())}</label>
                      {key === "description" ? (
                        <textarea className={`${ic} min-h-[60px] resize-none`}
                          value={item[key]||""} onChange={e => updateItem(i,key,e.target.value)} />
                      ) : key === "proficiency" ? (
                        <select className={ic} value={item[key]||"Intermediate"}
                          onChange={e => updateItem(i,key,e.target.value)}>
                          {["Beginner","Intermediate","Advanced","Native"].map(o=>(
                            <option key={o} value={o}>{o}</option>
                          ))}
                        </select>
                      ) : key === "current" ? (
                        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                          <input type="checkbox" checked={item[key]||false}
                            onChange={e => updateItem(i,key,e.target.checked)}
                            className="rounded" />
                          Currently working here
                        </label>
                      ) : (
                        <input className={ic} value={item[key]||""}
                          onChange={e => updateItem(i,key,e.target.value)} placeholder={key} />
                      )}
                    </div>
                  ))}
                  {/* Tech stack for projects */}
                  {modal.type === "projects" && (
                    <div>
                      <label className={lc}>Tech Stack (comma-separated)</label>
                      <input className={ic}
                        value={(item.techStack||[]).join(", ")}
                        onChange={e => updateItem(i,"techStack", e.target.value.split(",").map(s=>s.trim()).filter(Boolean))}
                        placeholder="React, Node.js, MongoDB" />
                    </div>
                  )}
                </div>
              ))}
              <button onClick={addItem}
                className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-gray-200 hover:border-blue-300 rounded-xl py-3 text-gray-400 hover:text-blue-500 transition-colors text-sm font-medium">
                <Ico d={ICONS.plus} className="w-4 h-4" /> Add {modal.type.slice(0,-1)}
              </button>
            </>
          )}
        </div>

        <div className="px-5 py-4 border-t border-gray-100 flex gap-3">
          <button onClick={onClose}
            className="flex-1 border border-gray-200 text-gray-600 rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50">
            Cancel
          </button>
          <button onClick={() => onSave(modal.type, form)} disabled={saving}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-2.5 text-sm font-semibold disabled:opacity-60">
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SmartProfile;
