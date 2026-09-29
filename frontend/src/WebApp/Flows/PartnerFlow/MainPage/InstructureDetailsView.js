//File: InstructureDetailsView.jsx

import React, { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import axios from "../../../../api/axiosInstance";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTimes,
  faEnvelope,
  faStar,
  faShieldAlt,
  faClock,
  faDollarSign,
  faExclamationTriangle,
  faTrash,
  faExternalLinkAlt,
  faCalendarAlt,
} from "@fortawesome/free-solid-svg-icons";

import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";

const parseTimeFrontend = (timeStr) => {
    if (!timeStr) return { h: 0, m: 0 };
    const isPM = timeStr.toLowerCase().includes('pm');
    const isAM = timeStr.toLowerCase().includes('am');
    const cleanStr = timeStr.replace(/[^\d:]/g, '').trim();
    let [h, m] = cleanStr.split(':').map(n => parseInt(n, 10) || 0);
    
    if (isPM && h !== 12) h += 12;
    if (isAM && h === 12) h = 0;
    return { h, m };
};

const getPartnerToken = () => {
  const direct =
    localStorage.getItem("partnerToken") ||
    localStorage.getItem("token") ||
    localStorage.getItem("partnerJwt");
  if (direct) return direct;

  try {
    const raw =
      localStorage.getItem("partnerInfo") ||
      localStorage.getItem("partner") ||
      localStorage.getItem("partnerData");
    if (!raw) return null;
    const obj = JSON.parse(raw);
    return obj?.token || obj?.partnerToken || obj?.jwt || null;
  } catch {
    return null;
  }
};

const authHeaders = () => {
  const token = getPartnerToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const valueBoxCls =
  "min-h-[44px] rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 text-sm text-slate-800 shadow-sm leading-relaxed break-words";

const labelCls =
  "block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5";

const sectionThemes = {
  "Personal & Contact": {
    wrap:
      "rounded-3xl border border-slate-200/80 bg-gradient-to-br from-white via-sky-50/30 to-indigo-50/40 p-5 shadow-sm shadow-slate-200/60",
    title:
      "text-xs font-bold text-sky-700 uppercase tracking-widest flex items-center gap-2 after:content-[''] after:flex-1 after:h-px after:bg-gradient-to-r after:from-sky-300 after:via-indigo-200 after:to-transparent",
    icon: "text-sky-500 text-[10px]",
  },
  "Professional & Teaching": {
    wrap:
      "rounded-3xl border border-slate-200/80 bg-gradient-to-br from-white via-violet-50/25 to-fuchsia-50/35 p-5 shadow-sm shadow-slate-200/60",
    title:
      "text-xs font-bold text-violet-700 uppercase tracking-widest flex items-center gap-2 after:content-[''] after:flex-1 after:h-px after:bg-gradient-to-r after:from-violet-300 after:via-fuchsia-200 after:to-transparent",
    icon: "text-violet-500 text-[10px]",
  },
  Availability: {
    wrap:
      "rounded-3xl border border-slate-200/80 bg-gradient-to-br from-white via-cyan-50/25 to-blue-50/35 p-5 shadow-sm shadow-slate-200/60",
    title:
      "text-xs font-bold text-cyan-700 uppercase tracking-widest flex items-center gap-2 after:content-[''] after:flex-1 after:h-px after:bg-gradient-to-r after:from-cyan-300 after:via-blue-200 after:to-transparent",
    icon: "text-cyan-500 text-[10px]",
  },
  "Compensation / Payout": {
    wrap:
      "rounded-3xl border border-slate-200/80 bg-gradient-to-br from-white via-emerald-50/25 to-teal-50/35 p-5 shadow-sm shadow-slate-200/60",
    title:
      "text-xs font-bold text-emerald-700 uppercase tracking-widest flex items-center gap-2 after:content-[''] after:flex-1 after:h-px after:bg-gradient-to-r after:from-emerald-300 after:via-teal-200 after:to-transparent",
    icon: "text-emerald-500 text-[10px]",
  },
  "Compliance & Documents": {
    wrap:
      "rounded-3xl border border-slate-200/80 bg-gradient-to-br from-white via-amber-50/25 to-orange-50/35 p-5 shadow-sm shadow-slate-200/60",
    title:
      "text-xs font-bold text-amber-700 uppercase tracking-widest flex items-center gap-2 after:content-[''] after:flex-1 after:h-px after:bg-gradient-to-r after:from-amber-300 after:via-orange-200 after:to-transparent",
    icon: "text-amber-500 text-[10px]",
  },
  "Instructor Timetable": {
    wrap:
      "rounded-3xl border border-slate-200/80 bg-gradient-to-br from-white via-rose-50/20 to-pink-50/30 p-5 shadow-sm shadow-slate-200/60",
    title:
      "text-xs font-bold text-rose-700 uppercase tracking-widest flex items-center gap-2 after:content-[''] after:flex-1 after:h-px after:bg-gradient-to-r after:from-rose-300 after:via-pink-200 after:to-transparent",
    icon: "text-rose-500 text-[10px]",
  },
};

const defaultSectionTheme = {
  wrap:
    "rounded-3xl border border-slate-200/80 bg-gradient-to-br from-white via-slate-50 to-indigo-50/20 p-5 shadow-sm shadow-slate-200/60",
  title:
    "text-xs font-bold text-indigo-700 uppercase tracking-widest flex items-center gap-2 after:content-[''] after:flex-1 after:h-px after:bg-gradient-to-r after:from-indigo-300 after:to-transparent",
  icon: "text-indigo-500 text-[10px]",
};

const toUrl = (f) => {
  if (!f) return null;
  if (typeof f === "string") return f;
  if (typeof f === "object") return f.url || f.path || f.location || null;
  return null;
};

const join = (arr) => (Array.isArray(arr) && arr.length ? arr.join(", ") : null);

const StyledLink = ({ href, children, external = false }) => (
  <a
    href={href}
    target={external ? "_blank" : undefined}
    rel={external ? "noreferrer" : undefined}
    className="inline-flex items-center gap-1.5 text-indigo-600 font-medium hover:text-indigo-700 hover:underline underline-offset-2 transition-colors break-all"
  >
    {children}
    {external && (
      <FontAwesomeIcon
        icon={faExternalLinkAlt}
        className="text-[9px] opacity-60"
      />
    )}
  </a>
);

const StatusBadge = ({ value, trueLabel = "Yes", falseLabel = "No" }) => {
  if (value === true) {
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-600 border border-emerald-100">
        {trueLabel}
      </span>
    );
  }

  if (value === false) {
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-500 border border-slate-200">
        {falseLabel}
      </span>
    );
  }

  return null;
};

const FormSection = ({ title, icon, children }) => {
  const theme = sectionThemes[title] || defaultSectionTheme;

  return (
    <div className={`space-y-5 ${theme.wrap}`}>
      <div className={theme.title}>
        {icon && <FontAwesomeIcon icon={icon} className={theme.icon} />}
        {title}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-x-5 gap-y-5">{children}</div>
    </div>
  );
};

const DetailField = ({ label, value, span = 1 }) => {
  const empty =
    value == null ||
    (Array.isArray(value) && value.length === 0) ||
    (typeof value === "string" && value.trim() === "");

  if (empty) return null;

  return (
    <div className={span === 2 ? "md:col-span-2" : span === 3 ? "md:col-span-3" : ""}>
      <label className={labelCls}>{label}</label>
      <div className={valueBoxCls}>{value}</div>
    </div>
  );
};

export default function InstructureDetailsView({
  open,
  item,
  onClose,
  autoDeletePrompt = false,
  onDeleted,
  confirmOnly = false,
}) {
  const [confirmStage, setConfirmStage] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const [assignments, setAssignments] = useState([]);
  const [loadingAssignments, setLoadingAssignments] = useState(false);

  const [portalTarget, setPortalTarget] = useState(null);

  useEffect(() => {
    if (open && item && (item._id || item.id)) {
      const fetchAssignments = async () => {
        try {
          setLoadingAssignments(true);
          const { data } = await axios.get(`/api/instructors/${item._id || item.id}/assignments`, { headers: authHeaders() });
          setAssignments(data);
        } catch (err) {
          console.error("Failed to fetch assignments:", err);
        } finally {
          setLoadingAssignments(false);
        }
      };
      fetchAssignments();
    } else {
      setAssignments([]);
    }
  }, [open, item]);

  useEffect(() => {
    if (open && (autoDeletePrompt || confirmOnly)) setConfirmStage(1);
  }, [open, autoDeletePrompt, confirmOnly]);

  useEffect(() => {
    if (!open) {
      setConfirmStage(0);
      setDeleting(false);
      return;
    }
    if (open && !autoDeletePrompt && !confirmOnly) {
      setConfirmStage(0);
    }
  }, [open, item, autoDeletePrompt, confirmOnly]);

  const doDelete = useCallback(async () => {
    const id = item?._id || item?.id;
    if (!id) {
      alert("Missing instructor id.");
      return;
    }

    const token = getPartnerToken();
    if (!token) {
      alert("Session expired. Please login again.");
      return;
    }

    try {
      setDeleting(true);
      await axios.delete(`/api/instructors/${id}`, { headers: authHeaders() });
      setDeleting(false);
      setConfirmStage(0);
      onDeleted?.(id);
      onClose?.();
      if (!onDeleted) window.location.reload();
    } catch (err) {
      console.error("Delete failed:", err);
      setDeleting(false);

      if (err?.response?.status === 401) {
        alert("Unauthorized. Please login again (token missing/expired).");
        return;
      }

      alert(err?.response?.data?.message || "Failed to delete instructor.");
    }
  }, [item, onClose, onDeleted]);

  useEffect(() => {
    if (!open) return;

    const onKey = (e) => {
      if (e.key === "Escape") {
        if (confirmStage > 0) setConfirmStage(0);
        else onClose?.();
      }

      if (e.key === "Enter" && confirmStage === 2 && !deleting) {
        doDelete();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, confirmStage, deleting, onClose, doDelete]);

  useEffect(() => {
    if (typeof document !== "undefined" && document.body) {
      setPortalTarget(document.body);
    }
  }, []);

  if (!open || !item || !portalTarget) return null;

  return createPortal(
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center p-4 ${confirmOnly ? "" : "bg-slate-950/45 backdrop-blur-[3px]"
        }`}
      role="dialog"
      aria-modal="true"
    >
      {!confirmOnly && (
        <div className="bg-white w-full max-w-5xl max-h-[92vh] rounded-[28px] shadow-[0_25px_60px_-15px_rgba(15,23,42,0.35)] flex flex-col overflow-hidden border border-slate-200/70">
          {/* ── Header ── */}
          <div className="sticky top-0 z-10 flex items-center justify-between px-7 py-4 border-b border-slate-100 bg-white/95 backdrop-blur-sm">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Instructor Details</h2>
              {(item?.firstName || item?.lastName) && (
                <p className="text-xs text-slate-400 mt-0.5">
                  {item.firstName} {item.lastName}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            >
              <FontAwesomeIcon icon={faTimes} />
            </button>
          </div>

          {/* ── Body ── */}
          <div className="p-7 overflow-y-auto flex-1 min-h-0 bg-gradient-to-b from-slate-50/70 via-white to-slate-50/60">
            <div className="space-y-7">
              {/* ── Personal & Contact ── */}
              <FormSection title="Personal & Contact" icon={faEnvelope}>
                <DetailField label="First Name" value={item.firstName} />
                <DetailField label="Last Name" value={item.lastName} />
                <DetailField
                  label="Email"
                  value={
                    item.email ? (
                      <StyledLink href={`mailto:${item.email}`}>{item.email}</StyledLink>
                    ) : null
                  }
                />
                <DetailField
                  label="Mobile"
                  value={
                    item.phone ? (
                      <StyledLink href={`tel:${item.phone}`}>{item.phone}</StyledLink>
                    ) : null
                  }
                />
                <DetailField
                  label="Alternate Phone"
                  value={
                    item.altPhone ? (
                      <StyledLink href={`tel:${item.altPhone}`}>{item.altPhone}</StyledLink>
                    ) : null
                  }
                />
                <DetailField label="Country" value={item.country} />
                <DetailField label="State / Province" value={item.state} />
                <DetailField label="City" value={item.city} />
                <DetailField label="Postal Code" value={item.postalCode} />
                <DetailField label="Address Line 1" value={item.address1} span={2} />
                <DetailField label="Address Line 2" value={item.address2} />
              </FormSection>

              {/* ── Professional & Teaching ── */}
              <FormSection title="Professional & Teaching" icon={faStar}>
                <DetailField label="Highest Qualification" value={item.qualification} />
                <DetailField
                  label="Years of Experience"
                  value={item.experienceYears != null ? String(item.experienceYears) : null}
                />
                <DetailField
                  label="Current / Recent Organization"
                  value={item.organization}
                />

                <DetailField
                  label="Skills / Technologies"
                  value={join(item.skills)}
                  span={3}
                />
                <DetailField label="Spoken Languages" value={join(item.languages)} span={2} />
                <DetailField label="Teaching Mode" value={item.teachingMode} />
                <DetailField label="Short Bio / Summary" value={item.bio} span={3} />
              </FormSection>

              {/* ── Availability ── */}
              <FormSection title="Availability" icon={faClock}>
                <DetailField label="Weekdays" value={join(item.availableDays)} span={3} />
                <DetailField label="Start Time (24h)" value={item.availableStart} />
                <DetailField label="End Time (24h)" value={item.availableEnd} />
                <DetailField label="Timezone" value={item.timezone} />
                <DetailField
                  label="Preferable Time Slots"
                  span={3}
                  value={
                    Array.isArray(item.preferableSlots) && item.preferableSlots.length ? (
                      <div className="flex flex-wrap gap-2">
                        {item.preferableSlots.map((slot, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-50 to-blue-50 text-blue-700 text-xs font-semibold border border-cyan-100"
                          >
                            {slot?.start && slot?.end
                              ? `${slot.start} – ${slot.end}`
                              : slot?.start || slot?.end || "—"}
                          </span>
                        ))}
                      </div>
                    ) : null
                  }
                />
              </FormSection>

              {/* ── Compensation / Payout ── */}
              <FormSection title="Compensation / Payout" icon={faDollarSign}>
                <DetailField label="Rate Type" value={item.rateType} />
                <DetailField
                  label="Expected Rate"
                  value={
                    item.expectedRate != null
                      ? `${item.currency ? `${item.currency} ` : ""}${item.expectedRate}`
                      : null
                  }
                />
                <DetailField label="Currency" value={item.currency} />
                <DetailField label="Payout Method" value={item.payoutMethod} />
                <DetailField label="Payout Identifier" value={item.payoutIdentifier} span={2} />
              </FormSection>

              {/* ── Compliance & Documents ── */}
              <FormSection title="Compliance & Documents" icon={faShieldAlt}>
                <DetailField
                  label="Background Check"
                  value={
                    typeof item.backgroundCheck === "boolean" ? (
                      <StatusBadge
                        value={item.backgroundCheck}
                        trueLabel="Cleared"
                        falseLabel="Pending"
                      />
                    ) : item.backgroundCheck ? (
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold border ${item.backgroundCheck === "Cleared"
                          ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                          : item.backgroundCheck === "Pending"
                            ? "bg-amber-50 text-amber-600 border-amber-100"
                            : "bg-slate-100 text-slate-500 border-slate-200"
                          }`}
                      >
                        {item.backgroundCheck}
                      </span>
                    ) : null
                  }
                />
                <DetailField
                  label="NDA Signed"
                  value={item.ndaSigned != null ? <StatusBadge value={item.ndaSigned} /> : null}
                />
                <DetailField
                  label="Agreed to Terms"
                  value={
                    item.agreeToTerms != null ? (
                      <StatusBadge value={item.agreeToTerms} />
                    ) : null
                  }
                />
                <DetailField
                  label="Resume"
                  value={
                    toUrl(item.resume) ? (
                      <StyledLink href={toUrl(item.resume)} external>
                        Open Resume
                      </StyledLink>
                    ) : null
                  }
                />
                <DetailField
                  label="Profile Photo"
                  value={
                    toUrl(item.photo) ? (
                      <StyledLink href={toUrl(item.photo)} external>
                        Open Photo
                      </StyledLink>
                    ) : null
                  }
                />
                <DetailField
                  label="Certificates"
                  span={3}
                  value={
                    Array.isArray(item.certificates) && item.certificates.length ? (
                      <div className="flex flex-wrap gap-3">
                        {item.certificates.map((c, idx) => {
                          const url = toUrl(c);
                          const name =
                            (typeof c === "object" && c?.originalName) ||
                            `Certificate ${idx + 1}`;

                          return url ? (
                            <StyledLink key={idx} href={url} external>
                              {name}
                            </StyledLink>
                          ) : (
                            <span key={idx} className="text-sm text-slate-700">
                              {name}
                            </span>
                          );
                        })}
                      </div>
                    ) : null
                  }
                />
              </FormSection>

              {/* ── Instructor Timetable ── */}
              <FormSection title="Instructor Timetable" icon={faCalendarAlt}>
                <div className="md:col-span-3 space-y-6">
                  <label className={labelCls}>Assigned Schedule</label>
                  {loadingAssignments ? (
                    <div className="text-sm text-slate-500">Loading assignments...</div>
                  ) : assignments.length > 0 ? (
                    <>
                      <div className="overflow-x-auto rounded-xl border border-slate-200">
                      <table className="min-w-full text-sm text-left text-slate-600">
                        <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                          <tr>
                            <th className="px-4 py-3">Internship</th>
                            <th className="px-4 py-3">Date</th>
                            <th className="px-4 py-3">Time</th>
                            <th className="px-4 py-3">Batch</th>
                            <th className="px-4 py-3">Summary</th>
                            <th className="px-4 py-3">Link</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 bg-white/95">
                          {assignments.map((a, i) => (
                            <tr key={i} className="hover:bg-slate-50">
                              <td className="px-4 py-3 whitespace-nowrap">{a.jobTitle || "—"}</td>
                              <td className="px-4 py-3 whitespace-nowrap">{new Date(a.date).toLocaleDateString()}</td>
                              <td className="px-4 py-3 whitespace-nowrap">{a.startTime} - {a.endTime}</td>
                              <td className="px-4 py-3 whitespace-nowrap">{a.batch ? <span className="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-semibold bg-indigo-50 text-indigo-600 border border-indigo-100">{a.batch}</span> : <span className="text-slate-400">Default</span>}</td>
                              <td className="px-4 py-3">{a.sectionSummary || "-"}</td>
                              <td className="px-4 py-3 whitespace-nowrap">{a.eventLink ? <StyledLink href={a.eventLink} external>Join</StyledLink> : "TBA"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    
                    <div className="mt-8 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm p-4">
                      <style>{`
                        .fc-theme-standard .fc-scrollgrid { border-color: #e2e8f0; }
                        .fc-theme-standard th { border-color: #e2e8f0; padding: 8px 0; background-color: #f8fafc; font-weight: 600; color: #334155; }
                        .fc-theme-standard td { border-color: #e2e8f0; }
                        .fc-event { cursor: pointer; border-radius: 4px; padding: 2px 4px; border: none; background-color: #4f46e5; color: white; font-size: 11px; }
                        .fc-event:hover { background-color: #4338ca; }
                        .fc .fc-toolbar-title { font-size: 1.1rem; font-weight: 700; color: #1e293b; }
                        .fc .fc-button-primary { background-color: #fff; color: #475569; border-color: #cbd5e1; text-transform: capitalize; }
                        .fc .fc-button-primary:hover { background-color: #f1f5f9; color: #0f172a; border-color: #94a3b8; }
                        .fc .fc-button-primary:not(:disabled).fc-button-active, .fc .fc-button-primary:not(:disabled):active { background-color: #f1f5f9; color: #0f172a; border-color: #94a3b8; }
                        .fc .fc-today-button { background-color: #f8fafc; }
                      `}</style>
                      <FullCalendar
                        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                        initialView="dayGridMonth"
                        headerToolbar={{
                          left: 'prev,next today',
                          center: 'title',
                          right: 'dayGridMonth,timeGridWeek,timeGridDay'
                        }}
                        height="auto"
                        contentHeight={500}
                        events={assignments.map(a => {
                          const startT = parseTimeFrontend(a.startTime);
                          const endT = parseTimeFrontend(a.endTime);
                          const startDate = new Date(a.date);
                          startDate.setHours(startT.h, startT.m, 0, 0);
                          const endDate = new Date(a.date);
                          endDate.setHours(endT.h, endT.m, 0, 0);
                          return {
                            title: `${a.batch ? `[${a.batch}] ` : ''}${a.sectionSummary || 'Session'}`,
                            start: startDate,
                            end: endDate,
                            url: a.eventLink || undefined
                          };
                        })}
                        eventClick={(info) => {
                          if (info.event.url) {
                            info.jsEvent.preventDefault();
                            window.open(info.event.url, "_blank");
                          }
                        }}
                      />
                    </div>
                  </>
                  ) : (
                    <div className="text-sm text-slate-500 italic">No assigned sessions currently.</div>
                  )}
                </div>
                <DetailField label="Notes" value={item.notes} span={3} />
              </FormSection>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Delete Confirmation #1 ═══ */}
      {confirmStage === 1 && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/45 backdrop-blur-[3px]">
          <div className="bg-white rounded-[28px] shadow-[0_25px_60px_-15px_rgba(15,23,42,0.35)] w-full max-w-md p-7 border border-slate-200/70">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-rose-100 via-orange-50 to-amber-50 flex items-center justify-center mb-5 shadow-sm">
              <FontAwesomeIcon
                icon={faExclamationTriangle}
                className="text-rose-600 text-xl"
              />
            </div>

            <h3 className="text-lg font-bold text-slate-900 mb-1">Are you sure?</h3>

            <p className="text-sm text-slate-500 leading-relaxed mb-5">
              Are you sure that you want to delete this instructor? This will
              remove all their associated data.
            </p>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => (confirmOnly ? onClose?.() : setConfirmStage(0))}
                className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium bg-white hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => setConfirmStage(2)}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 text-white text-sm font-semibold hover:from-rose-700 hover:to-red-700 shadow-lg shadow-rose-200/70 transition-all"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Delete Confirmation #2 ═══ */}
      {confirmStage === 2 && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/45 backdrop-blur-[3px]">
          <div className="bg-white rounded-[28px] shadow-[0_25px_60px_-15px_rgba(15,23,42,0.35)] w-full max-w-md p-7 border border-rose-200/70">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-rose-100 via-rose-50 to-red-100 flex items-center justify-center mb-5 shadow-sm">
              <FontAwesomeIcon icon={faTrash} className="text-rose-600 text-xl" />
            </div>

            <h3 className="text-lg font-bold text-slate-900 mb-1">
              Confirm one last time
            </h3>

            <p className="text-sm text-slate-500 leading-relaxed mb-5">
              This action{" "}
              <span className="font-semibold text-rose-600">cannot be undone</span>.
              Do you still want to permanently delete this instructor?
            </p>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => (confirmOnly ? onClose?.() : setConfirmStage(1))}
                className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium bg-white hover:bg-slate-50 transition-colors"
                disabled={deleting}
              >
                Go Back
              </button>

              <button
                type="button"
                onClick={doDelete}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 text-white text-sm font-semibold hover:from-rose-700 hover:to-red-700 shadow-lg shadow-rose-200/70 disabled:opacity-50 transition-all"
                disabled={deleting}
              >
                <FontAwesomeIcon icon={faTrash} className="text-[11px]" />
                {deleting ? "Deleting..." : "Delete Permanently"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    portalTarget
  );
}
