// Internshiplistview.js
import React, { useMemo, useCallback, useState } from "react";
import {
  globalCss,
  IconMessages,
  IconSearch,
  IconInfo,
  IconEmptyList,
  getInitials,
  getAvatarColor,
} from "./Chatconstants";

// ─── Avatar ───────────────────────────────────────────────────
const Avatar = React.memo(({ title, size = 42 }) => (
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
      fontSize: Math.floor(size * 0.33),
      fontWeight: 700,
      color: "#fff",
      letterSpacing: "-0.5px",
      userSelect: "none",
    }}
  >
    {getInitials(title)}
  </div>
));

const CompanyImage = React.memo(({ src, title, size = 42 }) => {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <Avatar title={title} size={size} />;
  return (
    <img
      src={src}
      alt={title}
      onError={() => setFailed(true)}
      style={{
        width: size,
        height: size,
        borderRadius: 10,
        objectFit: "cover",
        flexShrink: 0,
        border: "1.5px solid #EEF2F7",
      }}
    />
  );
});

// ─── Spinner ──────────────────────────────────────────────────
const Spinner = React.memo(() => (
  <div
    style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "52px 24px",
      gap: 10,
    }}
  >
    <div
      style={{
        width: 24,
        height: 24,
        borderRadius: "50%",
        border: "2.5px solid #E0E7FF",
        borderTopColor: "#4A6CF7",
        animation: "spin 0.7s linear infinite",
      }}
    />
    <span style={{ fontSize: 12.5, color: "#94A3B8", fontWeight: 500 }}>
      Loading…
    </span>
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
      flex: 1,
      gap: 10,
      padding: "44px 28px",
      textAlign: "center",
    }}
  >
    <div
      style={{
        width: 56,
        height: 56,
        borderRadius: 18,
        background: "linear-gradient(135deg,#EEF2FF,#E0E7FF)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {icon}
    </div>
    <p style={{ margin: 0, fontWeight: 700, fontSize: 14.5, color: "#0F172A" }}>
      {title}
    </p>
    <p
      style={{
        margin: 0,
        fontSize: 12.5,
        color: "#94A3B8",
        maxWidth: 230,
        lineHeight: 1.65,
      }}
    >
      {subtitle}
    </p>
  </div>
));

// ─── Pagination ───────────────────────────────────────────────
export const PaginationBar = React.memo(
  ({ currentPage, totalPages, onGoTo, isLoading }) => {
    const pageNums = useMemo(() => {
      const range = [];
      const left = Math.max(2, currentPage - 1);
      const right = Math.min(totalPages - 1, currentPage + 1);
      range.push(1);
      if (left > 2) range.push("…");
      for (let i = left; i <= right; i++) range.push(i);
      if (right < totalPages - 1) range.push("…");
      if (totalPages > 1) range.push(totalPages);
      return range;
    }, [currentPage, totalPages]);

    if (totalPages <= 1) return null;
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 2,
        }}
      >
        <button
          onClick={() => onGoTo(currentPage - 1)}
          disabled={currentPage === 1 || isLoading}
          style={pgBtn(false, currentPage === 1)}
        >
          ‹
        </button>
        {pageNums.map((p, i) =>
          p === "…" ? (
            <span
              key={`e${i}`}
              style={{ fontSize: 12.5, color: "#CBD5E1", padding: "0 2px" }}
            >
              …
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onGoTo(p)}
              disabled={isLoading}
              style={pgBtn(p === currentPage)}
            >
              {p}
            </button>
          ),
        )}
        <button
          onClick={() => onGoTo(currentPage + 1)}
          disabled={currentPage === totalPages || isLoading}
          style={pgBtn(false, currentPage === totalPages)}
        >
          ›
        </button>
      </div>
    );
  },
);

const pgBtn = (active, disabled) => ({
  minWidth: 30,
  height: 30,
  borderRadius: 8,
  border: "none",
  background: active ? "#4A6CF7" : "transparent",
  color: active ? "#fff" : disabled ? "#CBD5E1" : "#475569",
  fontSize: 13,
  fontWeight: 600,
  cursor: disabled ? "not-allowed" : "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  transition: "all 0.15s",
  padding: "0 5px",
  opacity: disabled ? 0.4 : 1,
});

// ─── Pill ──────────────────────────────────────────────────────
const Pill = ({ label, bg, color, border }) => (
  <span
    style={{
      display: "inline-flex",
      alignItems: "center",
      fontSize: 10,
      fontWeight: 700,
      padding: "2px 6px",
      borderRadius: 999,
      background: bg,
      color,
      border: `1px solid ${border}`,
      whiteSpace: "nowrap",
      flexShrink: 0,
      lineHeight: 1.6,
    }}
  >
    {label}
  </span>
);

// ─── Internship card ───────────────────────────────────────────
const InternshipCard = React.memo(
  ({ internship, onClick, onViewDetails, index, isActive }) => {
    const {
      _id,
      id,
      jobTitle,
      title,
      companyName,
      company,
      location,
      internshipType,
      intType,
      internshipMode,
      intMode,
      compensationDetails,
      image,
      imgUrl,
      companyLogo,
    } = internship;

    const internshipId = _id || id;
    const finalTitle = jobTitle || title || "Untitled";
    const finalCompany = companyName || company || "";
    const finalType = internshipType || intType || "";
    const finalMode = internshipMode || intMode || "";
    const finalImg = image || imgUrl || companyLogo || "";

    const stipendLabel = useMemo(() => {
      if (!compensationDetails) return null;
      const { type, amount, currency } = compensationDetails;
      if (type === "FREE" || !amount) return null;
      const raw = `${currency || ""} ${Number(amount).toLocaleString()}`.trim();
      return raw.length > 13 ? raw.slice(0, 12) + "…" : raw;
    }, [compensationDetails]);

    const typePill =
      finalType === "PAID"
        ? {
            label: `💰 ${stipendLabel || "Paid"}`,
            bg: "#DCFCE7",
            color: "#166534",
            border: "#BBF7D0",
          }
        : finalType === "FREE"
          ? {
              label: "🆓 Free",
              bg: "#FEF3C7",
              color: "#92400E",
              border: "#FDE68A",
            }
          : null;

    const modePill =
      finalMode === "ONLINE"
        ? {
            label: "🌐 Online",
            bg: "#EEF2FF",
            color: "#3730A3",
            border: "#C7D2FE",
          }
        : finalMode === "OFFLINE"
          ? {
              label: "🏢 Offline",
              bg: "#F0FDF4",
              color: "#15803D",
              border: "#BBF7D0",
            }
          : finalMode
            ? {
                label: "🔀 Hybrid",
                bg: "#FFF7ED",
                color: "#C2410C",
                border: "#FED7AA",
              }
            : null;

    const handleCardClick = useCallback(() => {
      onClick(internshipId, finalTitle, {
        companyName: finalCompany,
        imgUrl: finalImg,
        internshipType: finalType,
        internshipMode: finalMode,
        location,
      });
    }, [
      onClick,
      internshipId,
      finalTitle,
      finalCompany,
      finalImg,
      finalType,
      finalMode,
      location,
    ]);

    const handleInfo = useCallback(
      (e) => {
        e.stopPropagation();
        onViewDetails(internship);
      },
      [onViewDetails, internship],
    );

    return (
      <div
        className="int-card"
        onClick={handleCardClick}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "11px 12px",
          background: isActive
            ? "linear-gradient(135deg,#F0F3FF,#EEF2FF)"
            : "#fff",
          borderRadius: 12,
          border: isActive ? "1.5px solid #A5B4FC" : "1px solid #E9EEF6",
          cursor: "pointer",
          transition: "all 0.15s ease",
          animation: "cardIn 0.25s ease both",
          animationDelay: `${Math.min(index * 0.04, 0.28)}s`,
          boxShadow: isActive
            ? "0 2px 10px rgba(74,108,247,0.12)"
            : "0 1px 2px rgba(15,23,42,0.04)",
          WebkitTapHighlightColor: "transparent",
          userSelect: "none",
        }}
      >
        <CompanyImage src={finalImg} title={finalTitle} size={42} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              margin: 0,
              fontWeight: 700,
              fontSize: 13,
              color: "#0F172A",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {finalTitle}
          </p>
          {(finalCompany || location) && (
            <p
              style={{
                margin: "2px 0 0",
                fontSize: 11.5,
                color: "#64748B",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {[finalCompany, location].filter(Boolean).join(" · ")}
            </p>
          )}
          {(typePill || modePill) && (
            <div
              style={{
                display: "flex",
                gap: 4,
                marginTop: 6,
                overflow: "hidden",
              }}
            >
              {typePill && <Pill {...typePill} />}
              {modePill && <Pill {...modePill} />}
            </div>
          )}
        </div>

        {/* Info button — 44×44 touch target */}
        <button
          className="info-btn"
          onClick={handleInfo}
          title="View details"
          style={{
            flexShrink: 0,
            width: 36,
            height: 36,
            borderRadius: 9,
            border: "1px solid #E2E8F0",
            background: isActive ? "rgba(165,180,252,0.16)" : "#F8FAFC",
            color: "#64748B",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all 0.15s ease",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          {IconInfo}
        </button>
      </div>
    );
  },
);

// ─── Main component ───────────────────────────────────────────
const InternshipListView = ({
  internships,
  intLoading,
  intSearching,
  intCurrentPage,
  intTotalPages,
  intTotalCount,
  searchDraft,
  committedQuery,
  selectedId,
  onSearchDraftChange,
  onSearchSubmit,
  onPageChange,
  onInternshipClick,
  onViewDetails,
}) => {
  const [focused, setFocused] = useState(false);

  return (
    <>
      <style>{globalCss}</style>
      <div
        style={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#fff",
          overflow: "hidden",
        }}
      >
        {/* ── Header ──────────────────────────────────────── */}
        <div
          style={{
            padding: "14px 14px 12px",
            borderBottom: "1px solid #EEF2F7",
            flexShrink: 0,
            background: "#fff",
          }}
        >
          {/* Title row */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 11,
                background: "linear-gradient(135deg,#4A6CF7,#3154E8)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 5px 14px rgba(74,108,247,0.26)",
                flexShrink: 0,
              }}
            >
              {IconMessages}
            </div>
            <div>
              <h2
                style={{
                  margin: 0,
                  fontSize: 15.5,
                  fontWeight: 800,
                  color: "#0F172A",
                  letterSpacing: "-0.3px",
                  lineHeight: 1.2,
                }}
              >
                Messages
              </h2>
              <p
                style={{
                  margin: 0,
                  fontSize: 11,
                  color: "#94A3B8",
                  fontWeight: 500,
                }}
              >
                Partner portal
              </p>
            </div>
          </div>

          {/* Search */}
          <div style={{ position: "relative", marginTop: 10 }}>
            <span
              style={{
                position: "absolute",
                left: 10,
                top: "50%",
                transform: "translateY(-50%)",
                pointerEvents: "none",
                display: "flex",
                opacity: 0.55,
              }}
            >
              {IconSearch}
            </span>
            <input
              className="no-zoom"
              type="text"
              value={searchDraft}
              onChange={(e) => onSearchDraftChange(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onSearchSubmit()}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder="Search internships…"
              //Add the marginTop : "0px" for alignment - 04-08-2026
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "8px 30px 8px 30px",
                marginTop: "0px",
                border: focused ? "1.5px solid #4A6CF7" : "1.5px solid #E8ECF4",
                borderRadius: 9,
                color: "#0F172A",
                background: focused ? "#fff" : "#F8FAFC",
                outline: "none",
                transition: "all 0.16s ease",
                boxShadow: focused ? "0 0 0 3px rgba(74,108,247,0.08)" : "none",
              }}
            />
            {searchDraft && (
              <button
                onClick={() => onSearchDraftChange("")}
                style={{
                  position: "absolute",
                  right: 8,
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  border: "none",
                  background: "#CBD5E1",
                  color: "#fff",
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  WebkitTapHighlightColor: "transparent",
                }}
              >
                ×
              </button>
            )}
          </div>

          {/* Count row */}
          <div
            style={{
              marginTop: 7,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span
              style={{
                fontSize: 10,
                color: "#94A3B8",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.07em",
              }}
            >
              {intSearching ? (
                <span style={{ color: "#4A6CF7" }}>Searching…</span>
              ) : (
                <>
                  {intTotalCount} conversation{intTotalCount !== 1 ? "s" : ""}
                  {committedQuery && (
                    <span style={{ color: "#4A6CF7" }}>
                      {" "}
                      · "{committedQuery}"
                    </span>
                  )}
                </>
              )}
            </span>
            {intTotalPages > 1 && (
              <span style={{ fontSize: 10, color: "#94A3B8", fontWeight: 700 }}>
                {intCurrentPage} / {intTotalPages}
              </span>
            )}
          </div>
        </div>

        {/* ── Card list ──────────────────────────────────── */}
        <div
          className="scroll-smooth"
          style={{
            flex: 1,
            overflowY: "auto",
            overflowX: "hidden",
            padding: "8px 10px 0",
          }}
        >
          {intLoading ? (
            <Spinner />
          ) : internships?.length ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 5,
                paddingBottom: 10,
              }}
            >
              {internships.map((item, idx) => (
                <InternshipCard
                  key={item._id || item.id || idx}
                  internship={item}
                  onClick={onInternshipClick}
                  onViewDetails={onViewDetails}
                  index={idx}
                  isActive={
                    !!(
                      selectedId &&
                      (item._id === selectedId || item.id === selectedId)
                    )
                  }
                />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={IconEmptyList}
              title={committedQuery ? "No results found" : "No internships yet"}
              subtitle={
                committedQuery
                  ? `No matches for "${committedQuery}". Try different keywords.`
                  : "Your assigned internship conversations will appear here."
              }
            />
          )}
        </div>

        {/* ── Pagination ─────────────────────────────────── */}
        {intTotalPages > 1 && (
          <div
            style={{
              padding: "9px 12px 12px",
              borderTop: "1px solid #EEF2F7",
              flexShrink: 0,
              background: "#fff",
            }}
          >
            <PaginationBar
              currentPage={intCurrentPage}
              totalPages={intTotalPages}
              onGoTo={onPageChange}
              isLoading={intSearching}
            />
          </div>
        )}
      </div>
    </>
  );
};

export default InternshipListView;
