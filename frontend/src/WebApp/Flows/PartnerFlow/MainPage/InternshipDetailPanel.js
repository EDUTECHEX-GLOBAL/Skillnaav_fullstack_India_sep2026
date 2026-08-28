// InternshipDetailPanel.js
// Renders as a bottom sheet on mobile, side panel on desktop.
// Triggered from the parent via a portal-style overlay.
import React from "react";
import { globalCss, IconClose } from "./Chatconstants";

const InternshipDetailPanel = ({ open, item, loading, onClose }) => {
  if (!open) return null;

  // ── Field mapping ──────────────────────────────────────────
  const title          = item?.jobTitle || "Untitled Internship";
  const company        = item?.companyName || "Unknown Company";
  const location       = item?.location || "Not specified";
  const mode           = item?.internshipMode || "";
  const type           = item?.internshipType || "";
  const description    = item?.jobDescription || "No description available.";
  const duration       = item?.duration || "Not specified";
  const classification = item?.classification || "Not specified";
  const sector         = item?.sector || "Not specified";
  const applicationOpen = typeof item?.applicationOpen === "boolean"
    ? (item.applicationOpen ? "Open" : "Closed") : "Not specified";

  const stipend = item?.compensationDetails?.type === "FREE" || !item?.compensationDetails?.amount
    ? "Unpaid"
    : `${item?.compensationDetails?.currency || ""} ${item?.compensationDetails?.amount} / ${item?.compensationDetails?.frequency || "month"}`.trim();

  const qualifications  = Array.isArray(item?.qualifications)  ? item.qualifications  : [];
  const benefits        = Array.isArray(item?.compensationDetails?.benefits)       ? item.compensationDetails.benefits       : [];
  const additionalCosts = Array.isArray(item?.compensationDetails?.additionalCosts) ? item.compensationDetails.additionalCosts : [];

  const contactName  = item?.contactInfo?.name  || "Not specified";
  const contactEmail = item?.contactInfo?.email || "Not specified";
  const contactPhone = item?.contactInfo?.phone || "Not specified";

  const fmt = (d) => d ? new Date(d).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" }) : "Not specified";
  const startDate  = fmt(item?.startDate);
  const endDate    = item?.endDateOrDuration && !isNaN(new Date(item.endDateOrDuration).getTime())
    ? fmt(item.endDateOrDuration) : (item?.endDateOrDuration || "Not specified");
  const createdAt  = fmt(item?.createdAt);
  const updatedAt  = fmt(item?.updatedAt);

  const modeLabel = mode === "ONLINE" ? "Online" : mode === "OFFLINE" ? "Offline" : mode === "HYBRID" ? "Hybrid" : mode;
  const typeLabel = type === "PAID" ? "Paid" : type === "FREE" ? "Free" : type;

  return (
    <>
      <style>{globalCss}</style>
      {/* Backdrop */}
      <div className="detail-overlay" onClick={onClose}>
        {/* Sheet — stop propagation so clicking inside doesn't close */}
        <div className="detail-sheet" onClick={(e) => e.stopPropagation()}>
          {/* Drag handle (mobile only) */}
          <div className="sheet-handle" />

          {/* ── Header ─────────────────────────────────────────── */}
          <div style={{
            padding: "12px 16px 12px",
            borderBottom: "1px solid #EEF2F7",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexShrink: 0,
            background: "#fff",
          }}>
            <div>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "#0F172A" }}>
                Internship Details
              </p>
              <p style={{ margin: "2px 0 0", fontSize: 11.5, color: "#94A3B8" }}>
                Full internship information
              </p>
            </div>
            <button
              onClick={onClose}
              style={{
                width: 32, height: 32, borderRadius: 9,
                border: "1px solid #E2E8F0", background: "#F8FAFC",
                cursor: "pointer", color: "#64748B",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.15s", flexShrink: 0,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "#FEE2E2"; e.currentTarget.style.color = "#DC2626"; e.currentTarget.style.borderColor = "#FECACA"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "#F8FAFC"; e.currentTarget.style.color = "#64748B"; e.currentTarget.style.borderColor = "#E2E8F0"; }}
            >
              {IconClose}
            </button>
          </div>

          {/* ── Body ───────────────────────────────────────────── */}
          <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "14px 14px 28px", background: "#FAFBFF" }}
            className="scroll-smooth">
            {loading ? (
              <div style={{ textAlign: "center", paddingTop: 56, color: "#64748B", fontSize: 13.5 }}>
                <div style={{ width: 26, height: 26, borderRadius: "50%", border: "2.5px solid #E0E7FF", borderTopColor: "#4A6CF7", animation: "spin 0.7s linear infinite", margin: "0 auto 12px" }} />
                Loading details…
              </div>
            ) : !item ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 48, gap: 10 }}>
                <div style={{ width: 50, height: 50, borderRadius: 16, background: "#EEF2FF", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4A6CF7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>
                  </svg>
                </div>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: "#0F172A" }}>No details found</p>
                <p style={{ margin: 0, fontSize: 12.5, color: "#94A3B8", textAlign: "center" }}>Could not load internship details.</p>
              </div>
            ) : (
              <>
                {/* Title card */}
                <div style={card}>
                  {item?.imgUrl && (
                    <img src={item.imgUrl} alt={company} style={{ width: "100%", height: 130, objectFit: "cover", borderRadius: 10, marginBottom: 12, border: "1px solid #E9EDF5" }} />
                  )}
                  <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#0F172A", lineHeight: 1.3, wordBreak: "break-word" }}>{title}</h2>
                  <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "#64748B" }}>{company}</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 10 }}>
                    {modeLabel && <span style={pill("#EEF2FF","#3730A3")}>{modeLabel}</span>}
                    {typeLabel && <span style={type === "PAID" ? pill("#DCFCE7","#166534") : pill("#FEF3C7","#92400E")}>{typeLabel}</span>}
                    <span style={applicationOpen === "Open" ? pill("#DCFCE7","#166534") : pill("#FEE2E2","#B91C1C")}>{applicationOpen}</span>
                  </div>
                </div>

                <InfoRow icon="📍" label="Location"              value={location}   />
                <InfoRow icon="💰" label="Compensation"          value={stipend}    />
                <InfoRow icon="📅" label="Start Date"            value={startDate}  />
                <InfoRow icon="📅" label="End Date / Duration"   value={endDate}    />
                <InfoRow icon="⏳" label="Internship Duration"   value={duration}   />
                <InfoRow icon="🏷️" label="Classification"        value={classification} />
                <InfoRow icon="🧠" label="Sector"                value={sector}     />
                <InfoRow icon="🗓️" label="Created On"            value={createdAt}  />
                <InfoRow icon="🔄" label="Last Updated"          value={updatedAt}  />

                {/* Description */}
                <div style={card}>
                  <SectionHead icon="📄" label="Description" />
                  <p style={secText}>{description}</p>
                </div>

                {/* Qualifications */}
                <div style={card}>
                  <SectionHead icon="🎓" label="Qualifications" />
                  {qualifications.length > 0
                    ? <TagList tags={qualifications} />
                    : <p style={secText}>No qualifications specified.</p>}
                </div>

                {/* Benefits */}
                <div style={card}>
                  <SectionHead icon="🎁" label="Benefits" />
                  {benefits.length > 0
                    ? <TagList tags={benefits} />
                    : <p style={secText}>No benefits listed.</p>}
                </div>

                {/* Additional Costs */}
                <div style={card}>
                  <SectionHead icon="💳" label="Additional Costs" />
                  {additionalCosts.length > 0
                    ? <TagList tags={additionalCosts} />
                    : <p style={secText}>No additional costs mentioned.</p>}
                </div>

                {/* Contact */}
                <div style={{ ...card, marginBottom: 0 }}>
                  <SectionHead icon="📞" label="Contact Info" />
                  <p style={secText}><span style={secMuted}>Name</span>  {contactName}</p>
                  <p style={{ ...secText, marginTop: 4 }}><span style={secMuted}>Email</span> {contactEmail}</p>
                  <p style={{ ...secText, marginTop: 4 }}><span style={secMuted}>Phone</span> {contactPhone}</p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

// ── Sub-components ─────────────────────────────────────────────
const SectionHead = ({ icon, label }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
    <span style={{ fontSize: 13 }}>{icon}</span>
    <span style={{ fontSize: 10.5, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</span>
  </div>
);

const TagList = ({ tags }) => (
  <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 8 }}>
    {tags.map((t, i) => (
      <span key={i} style={{ padding: "4px 10px", borderRadius: 999, background: "#F1F5F9", color: "#334155", fontSize: 11.5, fontWeight: 600, border: "1px solid #E2E8F0" }}>{t}</span>
    ))}
  </div>
);

const InfoRow = ({ icon, label, value }) => (
  <div style={{ ...card, marginBottom: 8 }}>
    <SectionHead icon={icon} label={label} />
    <p style={secText}>{value || "Not specified"}</p>
  </div>
);

// ── Styles ─────────────────────────────────────────────────────
const card    = { background: "#fff", border: "1px solid #E9EDF5", borderRadius: 12, padding: "11px 13px", marginBottom: 8, boxShadow: "0 1px 4px rgba(15,23,42,0.03)" };
const secText = { margin: "5px 0 0", fontSize: 13, color: "#1E293B", lineHeight: 1.6, wordBreak: "break-word" };
const secMuted = { display: "inline-block", fontSize: 11, color: "#94A3B8", fontWeight: 600, width: 42, marginRight: 4 };
const pill = (bg, color) => ({ padding: "3px 9px", borderRadius: 999, background: bg, color, fontSize: 11, fontWeight: 700, border: "1px solid rgba(0,0,0,0.06)" });

export default InternshipDetailPanel;