// Chatconstants.js
import { useState, useEffect } from "react";

export const INTERNSHIPS_PER_PAGE = 6;
export const MESSAGES_PER_PAGE = 20;

// ─── Helpers ─────────────────────────────────────────────────
export const getInitials = (title = "") =>
  title.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();

const avatarColors = ["#4A6CF7","#7C3AED","#0891B2","#16A34A","#EA580C","#DC2626","#9333EA","#2563EB"];
export const getAvatarColor = (str = "") =>
  avatarColors[(str?.charCodeAt?.(0) || 0) % avatarColors.length];

export const fmtTime = (ts) => {
  if (!ts) return "";
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

export const fmtDate = (ts) => {
  if (!ts) return "";
  const d = new Date(ts);
  const today = new Date();
  const isToday = d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
  if (isToday) return "Today";
  return d.toLocaleDateString([], { day: "numeric", month: "short", year: d.getFullYear() !== today.getFullYear() ? "numeric" : undefined });
};

// ─── Auth ─────────────────────────────────────────────────────
export const resolvePartnerId = () => {
  const direct = localStorage.getItem("partnerId") || localStorage.getItem("partner_id") || localStorage.getItem("userId") || localStorage.getItem("id");
  if (direct) return String(direct);
  for (const key of ["partner", "user", "authUser", "partnerInfo"]) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      const id = parsed?._id || parsed?.id || parsed?.partnerId;
      if (id) return String(id);
    } catch {}
  }
  return null;
};

// ─── Debounce ─────────────────────────────────────────────────
export const useDebounce = (value, delay) => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => { const t = setTimeout(() => setDebounced(value), delay); return () => clearTimeout(t); }, [value, delay]);
  return debounced;
};

// ─── Reducers ────────────────────────────────────────────────
export const intInitial = { list: [], loading: false, searching: false, currentPage: 1, totalPages: 1, totalCount: 0, searchDraft: "", committedQuery: "" };
export const intReducer = (s, a) => {
  switch (a.type) {
    case "FETCH_START":   return { ...s, [a.isFirst ? "loading" : "searching"]: true };
    case "FETCH_SUCCESS": return { ...s, loading: false, searching: false, list: a.data, totalPages: a.totalPages, totalCount: a.totalCount, committedQuery: a.query };
    case "FETCH_ERROR":   return { ...s, loading: false, searching: false, list: [] };
    case "SET_PAGE":      return { ...s, currentPage: a.page };
    case "SET_DRAFT":     return { ...s, searchDraft: a.value };
    default:              return s;
  }
};

export const msgInitial = { list: [], loading: false, paging: false, currentPage: 1, totalPages: 1, totalCount: 0 };
export const msgReducer = (s, a) => {
  switch (a.type) {
    case "FETCH_START":   return { ...s, [a.isFirst ? "loading" : "paging"]: true };
    case "FETCH_SUCCESS": return { ...s, loading: false, paging: false, list: a.data, totalPages: a.totalPages, totalCount: a.totalCount };
    case "FETCH_ERROR":   return { ...s, loading: false, paging: false, list: [] };
    case "SET_PAGE":      return { ...s, currentPage: a.page };
    case "APPEND":        return { ...s, list: [...s.list, a.msg] };
    case "REPLACE_LAST":  return { ...s, list: [...s.list.slice(0, -1), a.msg], totalCount: s.totalCount + 1 };
    case "REMOVE":        return { ...s, list: s.list.filter((m) => m._id !== a.id) };
    case "RESET":         return { ...msgInitial };
    default:              return s;
  }
};

// ─── Styles ───────────────────────────────────────────────────
export const S = {
  appShell: { height: "100dvh", width: "100%", display: "flex", background: "#F7F8FC", overflow: "hidden", fontFamily: "'DM Sans','Inter',sans-serif" },
  rowFull:  { height: "100dvh", width: "100%", display: "flex", overflow: "hidden", minWidth: 0 },
  sidebarWrap: { width: 300, minWidth: 260, maxWidth: 320, flexShrink: 0, height: "100%", background: "#fff", borderRight: "1px solid #EAECF4", display: "flex", flexDirection: "column", overflow: "hidden" },
  chatCol:  { flex: 1, minWidth: 0, display: "flex", flexDirection: "column", height: "100%", background: "#F7F8FC", overflow: "hidden" },
  chatHeader: { background: "#fff", borderBottom: "1px solid #EAECF4", padding: "10px 14px", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, boxShadow: "0 1px 5px rgba(15,23,42,0.04)", minWidth: 0 },
  headerRow: { display: "flex", alignItems: "center", gap: 9, minWidth: 0, flex: 1, overflow: "hidden" },
  backBtn: { background: "#F1F5F9", border: "1px solid #E2E8F0", borderRadius: 10, width: 36, height: 36, cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" },
  headerImg: { width: 38, height: 38, borderRadius: 10, objectFit: "cover", flexShrink: 0, border: "1px solid #E5EAF3" },
  headerMeta: { flex: 1, minWidth: 0, overflow: "hidden" },
  headerTitle: { margin: 0, fontWeight: 700, fontSize: 14, color: "#0F172A", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  headerSub: { margin: "1px 0 0", fontSize: 11.5, color: "#64748B", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  pillRow: { display: "flex", gap: 4, marginTop: 4, flexWrap: "nowrap", overflow: "hidden" },
  headerRight: { display: "flex", gap: 7, alignItems: "center", flexShrink: 0 },
  msgCount: { background: "#EEF2FF", borderRadius: 999, padding: "4px 9px", flexShrink: 0 },
  msgCountText: { fontSize: 11, color: "#4338CA", fontWeight: 600, whiteSpace: "nowrap" },
  msgArea: { flex: 1, overflowY: "auto", overflowX: "hidden", padding: "16px 14px 8px", background: "#F7F8FC", minWidth: 0 },
  msgsPager: { display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "4px 0 12px" },
  pagerText: { margin: 0, fontSize: 11, color: "#94A3B8" },
  inputBar: { background: "#fff", borderTop: "1px solid #EAECF4", padding: "10px 12px 12px", flexShrink: 0, boxShadow: "0 -2px 8px rgba(15,23,42,0.04)" },
  inputRow: { display: "flex", alignItems: "flex-end", gap: 7 },
  textarea: { flex: 1, minWidth: 0, padding: "10px 13px", border: "1.5px solid #E2E8F0", borderRadius: 12, fontSize: 14, color: "#0F172A", resize: "none", lineHeight: 1.5, minHeight: 42, maxHeight: 100, overflow: "auto", background: "#F8FAFC", outline: "none", fontFamily: "inherit" },
  sendBtn: { width: 42, height: 42, borderRadius: 12, border: "none", background: "linear-gradient(135deg,#4A6CF7,#3154E8)", color: "#fff", cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 5px 15px rgba(74,108,247,0.28)" },
  hintText: { margin: "6px 0 0", textAlign: "center", fontSize: 10.5, color: "#94A3B8" },
  noSession: { height: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F7F8FC", padding: "20px" },
  noSessionIcon: { width: 52, height: 52, borderRadius: 16, margin: "0 auto 14px", background: "#EEF2FF", display: "flex", alignItems: "center", justifyContent: "center" },
};

// ─── Pills ────────────────────────────────────────────────────
export const PAID_PILL = { fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999, color: "#166534", background: "#DCFCE7", border: "1px solid #BBF7D0", whiteSpace: "nowrap" };
export const FREE_PILL = { fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999, color: "#92400E", background: "#FEF3C7", border: "1px solid #FDE68A", whiteSpace: "nowrap" };
export const MODE_PILL = { fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999, background: "#EEF2FF", color: "#3730A3", border: "1px solid #C7D2FE", whiteSpace: "nowrap" };
export const ACTIVE_DOT  = { width: 6, height: 6, borderRadius: "50%", background: "#22C55E", display: "inline-block", flexShrink: 0 };
export const ACTIVE_WRAP = { display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "#64748B", whiteSpace: "nowrap", flexShrink: 0 };

// ─── Global CSS ───────────────────────────────────────────────
export const globalCss = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body, #root { height: 100%; width: 100%; }
  body { font-family: 'DM Sans','Inter',sans-serif; background: #F7F8FC; -webkit-font-smoothing: antialiased; }
  ::-webkit-scrollbar { width: 4px; height: 4px; }
  ::-webkit-scrollbar-thumb { background: rgba(148,163,184,0.28); border-radius: 999px; }
  ::-webkit-scrollbar-track { background: transparent; }
  @media (hover:hover) {
    .int-card:hover    { transform:translateY(-1px); box-shadow:0 8px 22px rgba(74,108,247,0.10)!important; border-color:#C7D2FE!important; }
    .back-btn:hover    { background:#E2E8F0!important; }
    .attach-btn:hover  { background:#E2E8F0!important; }
  }
  .int-card:active { transform:scale(0.987)!important; }
  textarea:focus, input:focus { border-color:#4A6CF7!important; box-shadow:0 0 0 3px rgba(74,108,247,0.10)!important; background:#fff!important; }
  button:disabled { cursor:not-allowed!important; opacity:0.5!important; }
  .scroll-smooth { -webkit-overflow-scrolling: touch; }
  .no-zoom { font-size: 16px !important; }

  @keyframes spin    { to   { transform: rotate(360deg); } }
  @keyframes msgIn   { from { opacity:0; transform:translateY(4px); } to { opacity:1; transform:translateY(0); } }
  @keyframes cardIn  { from { opacity:0; transform:translateY(5px); } to { opacity:1; transform:translateY(0); } }
  @keyframes typing  { 0%,80%,100%{transform:scale(0.8);opacity:0.5} 40%{transform:scale(1);opacity:1} }
  @keyframes fadeIn  { from { opacity:0; } to { opacity:1; } }
  @keyframes slideUp { from { opacity:0; transform:translateY(100%); } to { opacity:1; transform:translateY(0); } }
  @keyframes slideInRight { from { opacity:0; transform:translateX(24px); } to { opacity:1; transform:translateX(0); } }

  /* ── Detail panel: bottom sheet on mobile, side panel on desktop ── */
  .detail-overlay {
    position: fixed; inset: 0; z-index: 9999;
    background: rgba(15,23,42,0.42);
    backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px);
    animation: fadeIn 0.18s ease both;
    display: flex; align-items: flex-end;
  }
  .detail-sheet {
    width: 100%; background: #fff;
    border-radius: 22px 22px 0 0;
    height: 88dvh;
    display: flex; flex-direction: column; overflow: hidden;
    animation: slideUp 0.3s cubic-bezier(0.16,1,0.3,1) both;
    box-shadow: 0 -8px 40px rgba(15,23,42,0.14);
  }
  .sheet-handle {
    width: 36px; height: 4px; border-radius: 999px;
    background: #CBD5E1; margin: 10px auto 0; flex-shrink: 0;
  }
  @media (min-width: 769px) {
    .detail-overlay { align-items: stretch; justify-content: flex-end; }
    .detail-sheet {
      width: min(420px, 38vw); height: 100%; border-radius: 0;
      animation: slideInRight 0.26s cubic-bezier(0.16,1,0.3,1) both;
      box-shadow: -6px 0 28px rgba(15,23,42,0.10);
    }
    .sheet-handle { display: none; }
  }
`;

// ─── Icons ────────────────────────────────────────────────────
export const IconMessages = (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  </svg>
);
export const IconSearch = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>
  </svg>
);
export const IconBack = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 18l-6-6 6-6"/>
  </svg>
);
export const IconInfo = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>
  </svg>
);
export const IconSend = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 2L11 13"/><path d="M22 2 15 22 11 13 2 9 22 2z"/>
  </svg>
);
export const IconClose = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6L6 18M6 6l12 12"/>
  </svg>
);
export const IconEmptyChat = (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#4A6CF7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  </svg>
);
export const IconEmptyList = (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#4A6CF7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>
  </svg>
);
export const IconNoSession = (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#4A6CF7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 8v4M12 16h.01"/><circle cx="12" cy="12" r="10"/>
  </svg>
);