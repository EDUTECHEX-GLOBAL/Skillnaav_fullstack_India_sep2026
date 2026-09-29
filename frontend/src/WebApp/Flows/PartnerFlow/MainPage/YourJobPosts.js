import React, { useEffect, useState, useRef, useCallback } from "react";
import axios from "../../../../api/axiosInstance";
import Modal from "react-modal";
import defaultCompanyLogo from "../../../../assets/default-company-logo.png";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faXmark,
  faLocationDot,
  faBriefcase,
  faMagnifyingGlass,
  faCircleCheck,
  faCircleXmark,
  faCircle,
  faMoneyBillWave,
  faHandHoldingDollar,
  faGraduationCap,
  faBullseye,
  faGlobe,
  faMapPin,
  faShuffle,
  faLaptopHouse,
  faClock,
  faCoins,
  faCalendarDay,
  faCalendarCheck,
  faCalendarPlus,
  faCalendarDays,
  faIndustry,
  faFileLines,
  faListCheck,
  faCheck,
  faGift,
  faStar,
  faReceipt,
  faCircleDot,
  faAddressCard,
  faUser,
  faEnvelope,
  faPhone,
  faPenToSquare,
  faArrowLeft,
  faFloppyDisk,
  faArrowRight,
  faChevronLeft,
  faChevronRight,
  faArrowUpAZ,
  faArrowDownZA,
  faLayerGroup,
  faCircleInfo,
  faSliders,
  faEllipsisVertical,
  faTrash,
  faArrowsRotate,
} from "@fortawesome/free-solid-svg-icons";

Modal.setAppElement("#root");

// ─── Sector display labels ────────────────────────────────────────────────────
const SECTOR_LABELS = {
  "advanced-ai": "Advanced AI & Autonomous Systems",
  "quantum-computing": "Quantum Computing & Next-Gen Computing",
  "climate-tech": "Climate Tech & Carbon Capture",
  biotech: "Biotechnology & Synthetic Biology",
  "materials-science": "Advanced Materials Science",
  "space-exploration": "Space Exploration & Commercial Space",
  neurotechnology: "Neurotechnology & Brain-Computer Interfaces",
  "precision-agriculture": "Precision Agriculture & AgriTech",
  "advanced-robotics": "Advanced Robotics & Human-Machine Collaboration",
  "renewable-energy": "Renewable Energy & Grid Innovation",
  "architecture-built-environment": "Architecture & Built Environment",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtDate = (d) =>
  d
    ? new Date(d).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "—";

// ─── StatusPill ───────────────────────────────────────────────────────────────
const StatusPill = ({
  adminStatus,
  adminReviewed,
  adminApproved,
  className = "",
}) => {
  // Derive display state from adminStatus (new field) with fallback to legacy booleans
  const status =
    adminStatus ||
    (adminApproved ? "approved" : adminReviewed ? "in_review" : "pending");

  const cfg =
    status === "approved"
      ? {
          bg: "bg-green-100 text-green-800 border border-green-200",
          icon: faCircleCheck,
          label: "Approved",
        }
      : status === "rejected"
        ? {
            bg: "bg-red-100 text-red-700 border border-red-200",
            icon: faCircleXmark,
            label: "Rejected",
          }
        : status === "in_review"
          ? {
              bg: "bg-yellow-100 text-yellow-800 border border-yellow-200",
              icon: faMagnifyingGlass,
              label: "In Review",
            }
          : {
              bg: "bg-gray-100 text-gray-500 border border-gray-200",
              icon: faCircle,
              label: "Pending",
            };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${cfg.bg} ${className}`}
      style={{ fontFamily: "'Poppins', sans-serif" }}
    >
      <FontAwesomeIcon icon={cfg.icon} className="text-[10px]" />
      {cfg.label}
    </span>
  );
};

// ─── ModePill ─────────────────────────────────────────────────────────────────
const ModePill = ({ mode }) => {
  const cfg =
    mode === "ONLINE"
      ? {
          cls: "bg-teal-50 text-teal-700 border border-teal-200",
          icon: faGlobe,
          label: "Online",
        }
      : mode === "OFFLINE"
        ? {
            cls: "bg-orange-50 text-orange-700 border border-orange-200",
            icon: faMapPin,
            label: "Offline",
          }
        : {
            cls: "bg-purple-50 text-purple-700 border border-purple-200",
            icon: faShuffle,
            label: "Hybrid",
          };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.cls}`}
      style={{ fontFamily: "'Poppins', sans-serif" }}
    >
      <FontAwesomeIcon icon={cfg.icon} className="text-[10px]" />
      {cfg.label}
    </span>
  );
};

// ─── TypePill ─────────────────────────────────────────────────────────────────
const TypePill = ({ type }) => {
  const cfg =
    type === "PAID"
      ? {
          cls: "bg-emerald-50 text-emerald-700 border-emerald-200",
          icon: faMoneyBillWave,
          label: "Paid",
        }
      : type === "STIPEND"
        ? {
            cls: "bg-blue-50 text-blue-700 border-blue-200",
            icon: faHandHoldingDollar,
            label: "Stipend",
          }
        : {
            cls: "bg-gray-50 text-gray-500 border-gray-200",
            icon: faGraduationCap,
            label: "Free",
          };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.cls}`}
      style={{ fontFamily: "'Poppins', sans-serif" }}
    >
      <FontAwesomeIcon icon={cfg.icon} className="text-[10px]" />
      {cfg.label}
    </span>
  );
};

// ─── CompLabel ────────────────────────────────────────────────────────────────
const CompLabel = ({ i }) => {
  if (i.internshipType === "FREE")
    return <span className="text-gray-500">Unpaid / Free</span>;
  const c = i.compensationDetails;
  const text = c?.amount
    ? `${c.amount} ${c.currency} / ${(c.frequency || "").toLowerCase()}`
    : "Amount not specified";
  return (
    <span
      className={
        i.internshipType === "PAID" ? "text-green-700" : "text-blue-700"
      }
    >
      {text}
    </span>
  );
};

// ─── DetailRow ────────────────────────────────────────────────────────────────
const DetailRow = ({ icon, label, children }) => (
  <div>
    <p
      className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold mb-1 flex items-center gap-1.5"
      style={{ fontFamily: "'Poppins', sans-serif" }}
    >
      {icon && (
        <FontAwesomeIcon icon={icon} className="text-indigo-400 text-[11px]" />
      )}
      {label}
    </p>
    <div
      className="text-sm text-gray-800"
      style={{ fontFamily: "'Poppins', sans-serif" }}
    >
      {children || "—"}
    </div>
  </div>
);

// ─── SectionLabel (view modal sections) ──────────────────────────────────────
const SectionLabel = ({ icon, children }) => (
  <p
    className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold mb-2 flex items-center gap-1.5"
    style={{ fontFamily: "'Poppins', sans-serif" }}
  >
    {icon && <FontAwesomeIcon icon={icon} className="text-gray-300" />}
    {children}
  </p>
);

// ─── FormSectionLabel (edit modal sections) ───────────────────────────────────
const FormSectionLabel = ({ icon, children }) => (
  <p
    className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold flex items-center gap-1.5"
    style={{ fontFamily: "'Poppins', sans-serif" }}
  >
    {icon && <FontAwesomeIcon icon={icon} className="text-gray-300" />}
    {children}
  </p>
);

// ─── DateInput ────────────────────────────────────────────────────────────────
const DateInput = ({ label, value, onChange }) => {
  const displayVal = value ? String(value).slice(0, 10) : "";
  return (
    <div>
      <label
        className="block text-xs font-semibold text-gray-600 mb-1"
        style={{ fontFamily: "'Poppins', sans-serif" }}
      >
        {label}
      </label>
      <div className="relative">
        <span className="absolute left-3 inset-y-0 flex items-center text-indigo-400 pointer-events-none">
          <FontAwesomeIcon icon={faCalendarDays} className="text-sm" />
        </span>
        <input
          type="date"
          value={displayVal}
          onChange={(e) => onChange(e.target.value)}
          className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm
                     focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent
                     bg-white text-gray-700 cursor-pointer"
          style={{ fontFamily: "'Poppins', sans-serif" }}
        />
      </div>
    </div>
  );
};

const QualTagInput = ({ qualifications, onChange }) => {
  const [inputVal, setInputVal] = useState("");

  const addTag = () => {
    const val = inputVal.trim();
    if (!val || qualifications.includes(val)) return;
    onChange([...qualifications, val]);
    setInputVal("");
  };

  const removeTag = (idx) => {
    onChange(qualifications.filter((_, i) => i !== idx));
  };

  return (
    <div>
      {/* Tag chips */}
      {qualifications.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {qualifications.map((q, idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs rounded-full font-medium"
              style={{ fontFamily: "'Poppins', sans-serif" }}
            >
              <FontAwesomeIcon
                icon={faCheck}
                className="text-[9px] text-indigo-400"
              />
              {q}
              <button
                type="button"
                onClick={() => removeTag(idx)}
                className="ml-0.5 text-indigo-300 hover:text-red-400 transition-colors leading-none"
                aria-label={`Remove ${q}`}
              >
                <FontAwesomeIcon icon={faXmark} className="text-[10px]" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Input row */}
      <div className="flex gap-2">
        <input
          type="text"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addTag();
            }
          }}
          placeholder={
            qualifications.length === 0
              ? "Type a skill and press Enter or Add..."
              : "Add another skill..."
          }
          className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          style={{ fontFamily: "'Poppins', sans-serif" }}
        />
        <button
          type="button"
          onClick={addTag}
          className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 transition font-medium flex-shrink-0"
          style={{ fontFamily: "'Poppins', sans-serif" }}
        >
          <FontAwesomeIcon icon={faCheck} className="text-[10px]" />
          Add
        </button>
      </div>
      <p
        className="text-xs text-gray-400 mt-1"
        style={{ fontFamily: "'Poppins', sans-serif" }}
      >
        Press Enter or click Add. Click × on a tag to remove it.
      </p>
    </div>
  );
};
// ═══════════════════════════════════════════════════════════════════════════════
// VIEW MODAL BODY
// ═══════════════════════════════════════════════════════════════════════════════
const ViewModalBody = ({ internship: i, onEdit, onClose }) => (
  <>
    {/* ── Gradient hero header ── */}
    <div className="flex-shrink-0 relative bg-gradient-to-r from-indigo-600 to-purple-600 px-6 pt-6 pb-14 rounded-t-2xl">
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full
          bg-white/20 text-white hover:bg-white/40 transition font-bold"
        style={{ fontFamily: "'Poppins', sans-serif" }}
      >
        <FontAwesomeIcon icon={faXmark} />
      </button>

      <div className="flex items-start gap-4 pr-10">
        <img
          src={i.imgUrl || defaultCompanyLogo}
          alt={i.companyName}
          width="56"
          height="56"
          loading="eager"
          fetchPriority="high"
          className="w-14 h-14 rounded-xl object-contain bg-white p-1 shadow"
        />
        <div className="min-w-0">
          <h2
            className="text-xl font-bold text-white leading-tight"
            style={{ fontFamily: "'Poppins', sans-serif" }}
          >
            {i.jobTitle}
          </h2>
          <p
            className="text-indigo-100 text-sm mt-0.5 font-medium flex items-center gap-1.5"
            style={{ fontFamily: "'Poppins', sans-serif" }}
          >
            <FontAwesomeIcon
              icon={faBriefcase}
              className="text-[10px] opacity-70"
            />
            {i.companyName}
          </p>
          <p
            className="text-indigo-200 text-xs mt-0.5 flex items-center gap-1"
            style={{ fontFamily: "'Poppins', sans-serif" }}
          >
            <FontAwesomeIcon icon={faLocationDot} className="text-[10px]" />
            {i.location ||
              [i.city, i.state, i.country].filter(Boolean).join(", ")}
          </p>
        </div>
      </div>

      {/* ── Floating badge strip ── */}
      <div className="absolute -bottom-5 left-6 right-6 flex flex-wrap items-center gap-2 z-10">
        <StatusPill
          adminStatus={i.adminStatus}
          adminReviewed={i.adminReviewed}
          adminApproved={i.adminApproved}
        />

        {/* Open / Closed */}
        <span
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold shadow-sm border ${
            i.applicationOpen
              ? "bg-teal-50 text-teal-700 border-teal-200"
              : "bg-gray-100 text-gray-500 border-gray-200"
          }`}
          style={{ fontFamily: "'Poppins', sans-serif" }}
        >
          <FontAwesomeIcon
            icon={faCircle}
            className={`text-[6px] ${i.applicationOpen ? "text-teal-500" : "text-gray-400"}`}
          />
          {i.applicationOpen ? "Open" : "Closed"}
        </span>

        <TypePill type={i.internshipType} />

        {i.classification && (
          <span
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold shadow-sm border bg-purple-50 text-purple-700 border-purple-200"
            style={{ fontFamily: "'Poppins', sans-serif" }}
          >
            <FontAwesomeIcon icon={faBullseye} className="text-[10px]" />
            {i.classification}
          </span>
        )}
      </div>
    </div>

    {/* ── Scrollable body ── */}
    <div className="flex-1 min-h-0 overflow-y-auto px-6 pt-10 pb-4 space-y-5 bg-white">
      {/* Rejection reason banner */}
      {(i.adminStatus === "rejected" ||
        (!i.adminStatus && !i.adminApproved && i.adminReviewed)) &&
        i.rejectionReason && (
          <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
            <FontAwesomeIcon
              icon={faCircleXmark}
              className="text-red-400 mt-0.5 flex-shrink-0"
            />
            <div>
              <p
                className="text-xs font-semibold uppercase tracking-widest text-red-500 mb-1"
                style={{ fontFamily: "'Poppins', sans-serif" }}
              >
                Rejection Reason
              </p>
              <p
                className="text-sm text-red-700"
                style={{ fontFamily: "'Poppins', sans-serif" }}
              >
                {i.rejectionReason}
              </p>
            </div>
          </div>
        )}

      {/* Key facts grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 bg-gray-50 rounded-xl p-4 border border-gray-100">
        <DetailRow icon={faLaptopHouse} label="Mode">
          <ModePill mode={i.internshipMode} />
        </DetailRow>
        <DetailRow icon={faClock} label="Duration">
          {i.duration}
        </DetailRow>
        <DetailRow icon={faCoins} label="Compensation">
          <CompLabel i={i} />
        </DetailRow>
        <DetailRow icon={faCalendarDay} label="Start Date">
          {fmtDate(i.startDate)}
        </DetailRow>
        <DetailRow icon={faCalendarCheck} label="End / Duration">
          {i.endDateOrDuration}
        </DetailRow>
        <DetailRow icon={faCalendarPlus} label="Posted">
          {fmtDate(i.createdAt)}
        </DetailRow>
        <div className="col-span-2 sm:col-span-3">
          <DetailRow icon={faIndustry} label="Sector">
            {SECTOR_LABELS[i.sector] || i.sector}
          </DetailRow>
        </div>
      </div>

      {/* Job Description */}
      <div>
        <SectionLabel icon={faFileLines}>Job Description</SectionLabel>
        <p
          className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap bg-gray-50 rounded-xl p-4 border border-gray-100"
          style={{ fontFamily: "'Poppins', sans-serif" }}
        >
          {i.jobDescription || "No description provided."}
        </p>
      </div>

      {/* Qualifications */}
      {i.qualifications?.length > 0 && (
        <div>
          <SectionLabel icon={faListCheck}>Qualifications</SectionLabel>
          <div className="flex flex-wrap gap-2">
            {(Array.isArray(i.qualifications)
              ? i.qualifications
              : [i.qualifications]
            )
              .filter(Boolean)
              .map((q, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs rounded-full font-medium"
                  style={{ fontFamily: "'Poppins', sans-serif" }}
                >
                  <FontAwesomeIcon
                    icon={faCheck}
                    className="text-[9px] text-indigo-400"
                  />
                  {q}
                </span>
              ))}
          </div>
        </div>
      )}

      {/* Benefits */}
      {i.compensationDetails?.benefits?.length > 0 && (
        <div>
          <SectionLabel icon={faGift}>Benefits</SectionLabel>
          <div className="flex flex-wrap gap-2">
            {i.compensationDetails.benefits.map((b, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-50 border border-green-100 text-green-700 text-xs rounded-full"
                style={{ fontFamily: "'Poppins', sans-serif" }}
              >
                <FontAwesomeIcon
                  icon={faStar}
                  className="text-[9px] text-green-400"
                />
                {b}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Additional Costs */}
      {i.compensationDetails?.additionalCosts?.length > 0 && (
        <div>
          <SectionLabel icon={faReceipt}>Additional Costs</SectionLabel>
          <div className="space-y-1">
            {i.compensationDetails.additionalCosts.map((c, idx) => (
              <p
                key={idx}
                className="text-sm text-gray-600 flex items-center gap-2"
                style={{ fontFamily: "'Poppins', sans-serif" }}
              >
                <FontAwesomeIcon
                  icon={faCircleDot}
                  className="text-[8px] text-gray-400"
                />
                {c.description}: {c.amount} {c.currency}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Contact */}
      <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
        <SectionLabel icon={faAddressCard}>Contact</SectionLabel>
        <div
          className="space-y-2 text-sm"
          style={{ fontFamily: "'Poppins', sans-serif" }}
        >
          {i.contactInfo?.name && (
            <p className="flex items-center gap-2.5">
              <FontAwesomeIcon
                icon={faUser}
                className="w-4 text-center text-indigo-300 text-xs"
              />
              <span className="font-medium text-gray-800">
                {i.contactInfo.name}
              </span>
            </p>
          )}
          {i.contactInfo?.email && (
            <p className="flex items-center gap-2.5">
              <FontAwesomeIcon
                icon={faEnvelope}
                className="w-4 text-center text-indigo-300 text-xs"
              />
              <a
                href={`mailto:${i.contactInfo.email}`}
                className="text-indigo-600 hover:underline"
              >
                {i.contactInfo.email}
              </a>
            </p>
          )}
          {i.contactInfo?.phone && (
            <p className="flex items-center gap-2.5">
              <FontAwesomeIcon
                icon={faPhone}
                className="w-4 text-center text-indigo-300 text-xs"
              />
              <a
                href={`tel:${i.contactInfo.phone}`}
                className="text-indigo-600 hover:underline"
              >
                {i.contactInfo.phone}
              </a>
            </p>
          )}
        </div>
      </div>
    </div>

    {/* ── Sticky footer ── */}
    <div className="flex-shrink-0 flex justify-end items-center px-6 py-4 border-t bg-white rounded-b-2xl">
      <button
        onClick={onEdit}
        className="flex items-center gap-2 px-5 py-2 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition font-semibold"
        style={{ fontFamily: "'Poppins', sans-serif" }}
      >
        <FontAwesomeIcon icon={faPenToSquare} />
        Edit Posting
      </button>
    </div>
  </>
);

// ═══════════════════════════════════════════════════════════════════════════════
// EDIT MODAL BODY
// ═══════════════════════════════════════════════════════════════════════════════
const EditModalBody = ({
  internship: si,
  updateField,
  onSave,
  onBack,
  onClose,
}) => {
  const logoInputRef = useRef(null);

  useEffect(() => {
    const startVal = si.startDate;
    const endVal = si.endDateOrDuration;

    if (
      startVal &&
      endVal &&
      /^\d{4}-\d{2}-\d{2}/.test(String(startVal)) &&
      /^\d{4}-\d{2}-\d{2}/.test(String(endVal))
    ) {
      const s = new Date(startVal);
      const e = new Date(endVal);
      if (!isNaN(s) && !isNaN(e) && s <= e) {
        let m =
          (e.getFullYear() - s.getFullYear()) * 12 +
          (e.getMonth() - s.getMonth());
        let d = e.getDate() - s.getDate();
        if (d < 0) {
          m -= 1;
          const prev = new Date(e.getFullYear(), e.getMonth(), 0);
          d += prev.getDate();
        }
        const parts = [];
        if (m > 0) parts.push(`${m} month${m > 1 ? "s" : ""}`);
        if (d > 0) parts.push(`${d} day${d > 1 ? "s" : ""}`);
        const calcDuration = parts.length > 0 ? parts.join(" ") : "0 days";

        if (si.duration !== calcDuration) {
          updateField("duration", calcDuration);
        }
      }
    }
  }, [si.startDate, si.endDateOrDuration, si.duration, updateField]);

  const handleTypeChange = (value) => {
    updateField("internshipType", value);
    updateField("compensationDetails.type", value);
    if (value === "FREE") {
      updateField("compensationDetails.amount", null);
      updateField("compensationDetails.currency", "");
      updateField("compensationDetails.frequency", "");
    } else {
      if (!si.compensationDetails?.currency)
        updateField("compensationDetails.currency", "USD");
      if (!si.compensationDetails?.frequency)
        updateField("compensationDetails.frequency", "MONTHLY");
    }
  };

  const handleDateChange = (field, value) => {
    updateField(field, value);

    const startVal = field === "startDate" ? value : si.startDate;
    const endVal = field === "endDateOrDuration" ? value : si.endDateOrDuration;

    if (
      startVal &&
      endVal &&
      /^\d{4}-\d{2}-\d{2}/.test(String(startVal)) &&
      /^\d{4}-\d{2}-\d{2}/.test(String(endVal))
    ) {
      const s = new Date(startVal);
      const e = new Date(endVal);
      if (!isNaN(s) && !isNaN(e) && s <= e) {
        let m =
          (e.getFullYear() - s.getFullYear()) * 12 +
          (e.getMonth() - s.getMonth());
        let d = e.getDate() - s.getDate();
        if (d < 0) {
          m -= 1;
          const prev = new Date(e.getFullYear(), e.getMonth(), 0);
          d += prev.getDate();
        }
        const parts = [];
        if (m > 0) parts.push(`${m} month${m > 1 ? "s" : ""}`);
        if (d > 0) parts.push(`${d} day${d > 1 ? "s" : ""}`);
        updateField("duration", parts.length > 0 ? parts.join(" ") : "0 days");
      }
    }
  };

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => updateField("imgUrl", ev.target.result);
    reader.readAsDataURL(file);
  };

  return (
    <>
      {/* Sticky header */}
      <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b rounded-t-2xl bg-white">
        <div className="flex items-center gap-3">
          {/* Clickable logo / profile pic with edit overlay */}
          <div
            className="relative w-12 h-12 flex-shrink-0 cursor-pointer group"
            onClick={() => logoInputRef.current && logoInputRef.current.click()}
            title="Change company logo"
          >
            <img
              src={si.imgUrl || defaultCompanyLogo}
              alt="Company Logo"
              className="w-12 h-12 rounded-xl object-contain bg-gray-50 border border-gray-200 p-1 shadow-sm"
            />
            {/* Hover overlay */}
            <div className="absolute inset-0 rounded-xl bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-150">
              <FontAwesomeIcon
                icon={faPenToSquare}
                className="text-white text-sm"
              />
            </div>
          </div>
          <input
            ref={logoInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleLogoChange}
          />

          <div>
            <h2
              className="text-base font-semibold text-gray-800 flex items-center gap-2"
              style={{ fontFamily: "'Poppins', sans-serif" }}
            >
              Edit Internship
            </h2>
            <p
              className="text-xs text-gray-400 mt-0.5"
              style={{ fontFamily: "'Poppins', sans-serif" }}
            >
              {si.jobTitle} · {si.companyName}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition"
        >
          <FontAwesomeIcon icon={faXmark} className="text-sm" />
        </button>
      </div>

      {/* Scrollable form */}
      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-5">
        <FormSectionLabel icon={faCircleInfo}>Basic Info</FormSectionLabel>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { label: "Job Title", field: "jobTitle", type: "text" },
            { label: "Company Name", field: "companyName", type: "text" },
            { label: "Location", field: "location", type: "text" },
          ].map(({ label, field, type }) => (
            <div key={field}>
              <label
                className="block text-xs font-semibold text-gray-600 mb-1"
                style={{ fontFamily: "'Poppins', sans-serif" }}
              >
                {label}
              </label>

              <input
                type={type}
                value={si[field] || ""}
                onChange={(e) => updateField(field, e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                style={{ fontFamily: "'Poppins', sans-serif" }}
              />
            </div>
          ))}

          {/* Sector */}
          <div>
            <label
              className="block text-xs font-semibold text-gray-600 mb-1"
              style={{ fontFamily: "'Poppins', sans-serif" }}
            >
              Sector
            </label>

            <select
              value={si.sector || ""}
              onChange={(e) => updateField("sector", e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              style={{ fontFamily: "'Poppins', sans-serif" }}
            >
              {Object.entries(SECTOR_LABELS).map(([val, label]) => (
                <option key={val} value={val}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <FormSectionLabel icon={faCalendarDays}>Schedule</FormSectionLabel>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <DateInput
            label="Start Date"
            value={si.startDate ? String(si.startDate).slice(0, 10) : ""}
            onChange={(val) => handleDateChange("startDate", val)}
          />
          <DateInput
            label="End Date"
            value={
              si.endDateOrDuration &&
              /^\d{4}-\d{2}-\d{2}/.test(si.endDateOrDuration)
                ? String(si.endDateOrDuration).slice(0, 10)
                : ""
            }
            onChange={(val) => handleDateChange("endDateOrDuration", val)}
          />
          <div>
            <label
              className="block text-xs font-semibold text-gray-600 mb-1"
              style={{ fontFamily: "'Poppins', sans-serif" }}
            >
              Duration
            </label>
            <input
              type="text"
              readOnly
              value={si.duration || ""}
              placeholder="Auto-calculated"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-500 cursor-not-allowed focus:outline-none"
              style={{ fontFamily: "'Poppins', sans-serif" }}
            />
          </div>
        </div>

        <FormSectionLabel icon={faSliders}>
          Format & Classification
        </FormSectionLabel>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label
              className="block text-xs font-semibold text-gray-600 mb-1"
              style={{ fontFamily: "'Poppins', sans-serif" }}
            >
              Mode
            </label>
            <select
              value={si.internshipMode || ""}
              onChange={(e) => updateField("internshipMode", e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              style={{ fontFamily: "'Poppins', sans-serif" }}
            >
              <option value="ONLINE">Online</option>
              <option value="OFFLINE">Offline</option>
              <option value="HYBRID">Hybrid</option>
            </select>
          </div>
          <div>
            <label
              className="block text-xs font-semibold text-gray-600 mb-1"
              style={{ fontFamily: "'Poppins', sans-serif" }}
            >
              Classification
            </label>
            <select
              value={si.classification || ""}
              onChange={(e) => updateField("classification", e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              style={{ fontFamily: "'Poppins', sans-serif" }}
            >
              <option value="">Select</option>
              <option value="Basic">Basic</option>
              <option value="Intermediate">Intermediate</option>
              <option value="Advanced">Advanced</option>
            </select>
          </div>
          <div>
            <label
              className="block text-xs font-semibold text-gray-600 mb-1"
              style={{ fontFamily: "'Poppins', sans-serif" }}
            >
              Type
            </label>
            <select
              value={si.internshipType || "FREE"}
              onChange={(e) => handleTypeChange(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              style={{ fontFamily: "'Poppins', sans-serif" }}
            >
              <option value="FREE">Free</option>
              <option value="STIPEND">Stipend</option>
              <option value="PAID">Paid</option>
            </select>
          </div>
        </div>

        {si.internshipType !== "FREE" && (
          <>
            <FormSectionLabel icon={faCoins}>Compensation</FormSectionLabel>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label
                  className="block text-xs font-semibold text-gray-600 mb-1"
                  style={{ fontFamily: "'Poppins', sans-serif" }}
                >
                  Amount
                </label>
                <input
                  type="number"
                  placeholder="0"
                  value={si.compensationDetails?.amount || ""}
                  onChange={(e) =>
                    updateField(
                      "compensationDetails.amount",
                      Number(e.target.value),
                    )
                  }
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-0 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  style={{ fontFamily: "'Poppins', sans-serif" }}
                />
              </div>
              <div>
                <label
                  className="block text-xs font-semibold text-gray-600 mb-1"
                  style={{ fontFamily: "'Poppins', sans-serif" }}
                >
                  Currency
                </label>
                <select
                  value={si.compensationDetails?.currency || "USD"}
                  onChange={(e) =>
                    updateField("compensationDetails.currency", e.target.value)
                  }
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  style={{ fontFamily: "'Poppins', sans-serif" }}
                >
                  {["USD", "CAD", "EUR", "INR", "GBP"].map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  className="block text-xs font-semibold text-gray-600 mb-1"
                  style={{ fontFamily: "'Poppins', sans-serif" }}
                >
                  Frequency
                </label>
                <select
                  value={si.compensationDetails?.frequency || "MONTHLY"}
                  onChange={(e) =>
                    updateField("compensationDetails.frequency", e.target.value)
                  }
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  style={{ fontFamily: "'Poppins', sans-serif" }}
                >
                  <option value="MONTHLY">Monthly</option>
                  <option value="WEEKLY">Weekly</option>
                  <option value="ONE_TIME">One-time</option>
                </select>
              </div>
            </div>
          </>
        )}

        <FormSectionLabel icon={faFileLines}>Description</FormSectionLabel>
        <textarea
          rows={4}
          value={si.jobDescription || ""}
          onChange={(e) => updateField("jobDescription", e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          style={{ fontFamily: "'Poppins', sans-serif" }}
        />

        <FormSectionLabel icon={faListCheck}>Qualifications</FormSectionLabel>
        <QualTagInput
          qualifications={
            Array.isArray(si.qualifications) ? si.qualifications : []
          }
          onChange={(updated) => updateField("qualifications", updated)}
        />

        <FormSectionLabel icon={faAddressCard}>Contact</FormSectionLabel>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { label: "Name", field: "contactInfo.name", type: "text" },
            { label: "Email", field: "contactInfo.email", type: "email" },
            { label: "Phone", field: "contactInfo.phone", type: "text" },
          ].map(({ label, field, type }) => (
            <div key={field}>
              <label
                className="block text-xs font-semibold text-gray-600 mb-1"
                style={{ fontFamily: "'Poppins', sans-serif" }}
              >
                {label}
              </label>
              <input
                type={type}
                value={si.contactInfo?.[field.split(".")[1]] || ""}
                onChange={(e) => updateField(field, e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                style={{ fontFamily: "'Poppins', sans-serif" }}
              />
            </div>
          ))}
        </div>

        <div className="h-2" />
      </div>

      {/* Sticky footer */}
      <div className="flex-shrink-0 flex justify-between items-center px-6 py-4 border-t bg-white rounded-b-2xl">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition font-medium"
          style={{ fontFamily: "'Poppins', sans-serif" }}
        >
          <FontAwesomeIcon icon={faArrowLeft} className="text-xs" />
          Back
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onSave}
            className="flex items-center gap-2 px-5 py-2 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition font-semibold"
            style={{ fontFamily: "'Poppins', sans-serif" }}
          >
            <FontAwesomeIcon icon={faFloppyDisk} />
            Save Changes
          </button>
        </div>
      </div>
    </>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
const YourJobPosts = () => {
  const [internships, setInternships] = useState([]);
  const [selectedInternship, setSelectedInternship] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("view");
  const [openMenuId, setOpenMenuId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const [currentPage, setCurrentPage] = useState(1);
  const applicationsPerPage = 12;

  const [loading, setLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [sortCriteria, setSortCriteria] = useState("jobTitle");
  const [sortDirection, setSortDirection] = useState("asc");

  const [searchQuery, setSearchQuery] = useState("");
  const [committedQuery, setCommittedQuery] = useState("");
  const debounceRef = useRef(null);
  const isInitialLoadRef = useRef(true);

  const [isRefreshing, setIsRefreshing] = useState(false);

  const partnerId = localStorage.getItem("partnerId");

  useEffect(() => {
    const handleClickOutside = () => setOpenMenuId(null);
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  const handleDeleteJob = (id) => {
    setConfirmDeleteId(id);
  };

  const confirmDelete = async () => {
    const id = confirmDeleteId;
    setConfirmDeleteId(null);
    try {
      await axios.delete(`/api/interns/${id}`, {
        params: { deletedBy: "partner" },
      });
      setInternships((prev) => prev.filter((i) => i._id !== id));
      setTotalCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error("Error deleting job post:", error);
    }
  };

  const fetchInternships = useCallback(
    async (page, query, sort, order, isFirst = false) => {
      if (!partnerId) return;
      isFirst ? setLoading(true) : setIsSearching(true);
      try {
        const response = await axios.get(`/api/interns/partner/${partnerId}`, {
          params: {
            page,
            limit: applicationsPerPage,
            search: query,
            sort,
            order,
          },
        });
        setInternships(response.data.data || []);
        setTotalPages(response.data.totalPages || 1);
        setTotalCount(response.data.total || 0);
        setCommittedQuery(query);
      } catch (error) {
        console.error("Error fetching internships:", error);
        setInternships([]);
      } finally {
        setLoading(false);
        setIsSearching(false);
      }
    },
    [partnerId],
  );

  useEffect(() => {
    if (
      !selectedInternship?.startDate ||
      !selectedInternship?.endDateOrDuration
    ) {
      return;
    }

    const parseDate = (d) => {
      const s = String(d);
      return new Date(s.includes("T") ? s : s + "T00:00:00");
    };

    const start = parseDate(selectedInternship.startDate);
    const end = parseDate(selectedInternship.endDateOrDuration);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      updateField("duration", "");
      return;
    }

    if (end < start) {
      updateField("duration", "Invalid duration");
      return;
    }

    const totalDays = Math.round((end - start) / (1000 * 60 * 60 * 24));

    const months = Math.floor(totalDays / 30);
    const days = totalDays % 30;

    let duration = "";

    if (months > 0) {
      duration = `${months} month${months > 1 ? "s" : ""}`;

      if (days > 0) {
        duration += ` and ${days} day${days > 1 ? "s" : ""}`;
      }
    } else {
      duration = `${totalDays} day${totalDays > 1 ? "s" : ""}`;
    }

    updateField("duration", duration);
  }, [selectedInternship?.startDate, selectedInternship?.endDateOrDuration]);

  useEffect(() => {
    fetchInternships(1, "", sortCriteria, sortDirection, true);
    isInitialLoadRef.current = false;
  }, []); // eslint-disable-line

  // ── Auto-refresh every 30 s so admin approval status updates automatically ──
  useEffect(() => {
    const interval = setInterval(async () => {
      if (!partnerId) return;
      try {
        const response = await axios.get(`/api/interns/partner/${partnerId}`, {
          params: {
            page: currentPage,
            limit: applicationsPerPage,
            search: committedQuery,
            sort: sortCriteria,
            order: sortDirection,
          },
        });
        setInternships(response.data.data || []);
        setTotalPages(response.data.totalPages || 1);
        setTotalCount(response.data.total || 0);
      } catch (_) {
        /* silent — do not show errors for background poll */
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [partnerId, currentPage, committedQuery, sortCriteria, sortDirection]); // eslint-disable-line

  useEffect(() => {
    if (isInitialLoadRef.current) return;
    fetchInternships(currentPage, committedQuery, sortCriteria, sortDirection);
  }, [currentPage]); // eslint-disable-line

  useEffect(() => {
    if (isInitialLoadRef.current) return;
    setCurrentPage(1);
    fetchInternships(1, committedQuery, sortCriteria, sortDirection);
  }, [sortCriteria, sortDirection]); // eslint-disable-line

  const handleSearchChange = (e) => {
    const q = e.target.value;
    setSearchQuery(q);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setCurrentPage(1);
      fetchInternships(1, q, sortCriteria, sortDirection);
    }, 350);
  };

  const clearSearch = () => {
    setSearchQuery("");
    clearTimeout(debounceRef.current);
    setCurrentPage(1);
    fetchInternships(1, "", sortCriteria, sortDirection);
  };

  const openViewModal = (internship) => {
    setSelectedInternship(internship);
    setModalMode("view");
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setTimeout(() => {
      setSelectedInternship(null);
      setModalMode("view");
    }, 200);
  };

  const updateField = (field, value) => {
    setSelectedInternship((prev) => {
      const keys = field.split(".");
      let updated = { ...prev };
      let cur = updated;
      keys.forEach((key, idx) => {
        if (idx === keys.length - 1) {
          cur[key] = value;
        } else {
          cur[key] = { ...cur[key] };
          cur = cur[key];
        }
      });
      return updated;
    });
  };

  const handleUpdateJob = async () => {
    if (!selectedInternship) return;

    // Send only the editable fields — never let the frontend decide adminApproved/adminStatus.
    // The backend PUT route always resets to "pending" on partner edits.
    const {
      _id,
      jobTitle,
      companyName,
      location,
      jobDescription,
      startDate,
      endDateOrDuration,
      duration,
      sector,
      classification,
      internshipMode,
      internshipType,
      compensationDetails,
      qualifications,
      contactInfo,
      imgUrl,
      applicationOpen,
      country,
      state,
      city,
    } = selectedInternship;

    const payload = {
      jobTitle,
      companyName,
      location,
      jobDescription,
      startDate,
      endDateOrDuration,
      duration,
      sector,
      classification,
      internshipMode,
      internshipType,
      compensationDetails,
      qualifications,
      contactInfo,
      imgUrl,
      applicationOpen,
      country,
      state,
      city,
    };

    try {
      const response = await axios.put(`/api/interns/${_id}`, payload);
      // Update local list with the response (which has adminStatus: "pending" from backend)
      setInternships((prev) =>
        prev.map((i) => (i._id === _id ? response.data : i)),
      );
      // Also update the selected internship so the view modal reflects pending status
      setSelectedInternship(response.data);
      setModalMode("view");
    } catch (error) {
      console.error("Error updating internship:", error);
    }
  };

  return (
    <div
      className="p-6 rounded-lg shadow-md min-h-screen"
      style={{ fontFamily: "'Poppins', sans-serif" }}
    >
      {/* Search + Sort Row */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
            <FontAwesomeIcon icon={faMagnifyingGlass} className="text-sm" />
          </span>
          {/*Add "!mt-0" style to input class for alignment - 04-08-2026 */}
          <input
            type="text"
            placeholder="Search by Organization, Role, or Company"
            value={searchQuery}
            onChange={handleSearchChange}
            className="!mt-0 p-2 pl-9 pr-8 border rounded-lg w-full text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            style={{ fontFamily: "'Poppins', sans-serif" }}
          />
          {isSearching && (
            <div className="absolute right-2 top-1/2 -translate-y-1/2">
              <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {!isSearching && searchQuery && (
            <button
              onClick={clearSearch}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <FontAwesomeIcon icon={faXmark} className="text-sm" />
            </button>
          )}
        </div>
        <select
          value={sortCriteria}
          onChange={(e) => setSortCriteria(e.target.value)}
          className="p-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 w-40 flex-shrink-0"
          style={{ fontFamily: "'Poppins', sans-serif" }}
        >
          <option value="jobTitle">Sort by Title</option>
          <option value="companyName">Sort by Company</option>
          <option value="createdAt">Sort by Date</option>
        </select>
        <button
          onClick={() =>
            setSortDirection((d) => (d === "asc" ? "desc" : "asc"))
          }
          className="flex items-center gap-1.5 px-3 py-2 border rounded-lg text-sm text-gray-700 hover:bg-gray-100 font-medium w-24 justify-center flex-shrink-0"
          style={{ fontFamily: "'Poppins', sans-serif" }}
        >
          <FontAwesomeIcon
            icon={sortDirection === "asc" ? faArrowUpAZ : faArrowDownZA}
            className="text-xs"
          />
          {sortDirection === "asc" ? "Asc" : "Desc"}
        </button>

        {/* Manual refresh button */}
        <button
          title="Refresh status"
          onClick={async () => {
            setIsRefreshing(true);
            await fetchInternships(
              currentPage,
              committedQuery,
              sortCriteria,
              sortDirection,
            );
            setIsRefreshing(false);
          }}
          className="flex items-center gap-1.5 px-3 py-2 border rounded-lg text-sm text-indigo-600 border-indigo-200 hover:bg-indigo-50 font-medium flex-shrink-0"
          style={{ fontFamily: "'Poppins', sans-serif" }}
        >
          <FontAwesomeIcon
            icon={faArrowsRotate}
            className={`text-xs ${isRefreshing ? "animate-spin" : ""}`}
          />
          Refresh
        </button>
      </div>

      {/* Result count */}
      <p
        className="text-xs text-gray-400 mb-3 flex items-center gap-1.5 min-h-[20px]"
        style={{ fontFamily: "'Poppins', sans-serif" }}
      >
        {!loading && totalCount > 0 && (
          <>
            <FontAwesomeIcon icon={faLayerGroup} className="text-gray-300" />
            {totalCount} result{totalCount !== 1 ? "s" : ""}
            {committedQuery && (
              <>
                {" "}
                for "<em className="text-gray-600">{committedQuery}</em>"
              </>
            )}
          </>
        )}
      </p>

      {/* Cards */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 text-center w-full">
          <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
          <p
            className="text-sm font-semibold text-gray-600"
            style={{ fontFamily: "'Poppins', sans-serif" }}
          >
            Loading your job posts...
          </p>
        </div>
      ) : internships.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
          <FontAwesomeIcon
            icon={faBriefcase}
            className="text-4xl mb-3 opacity-30"
          />
          <p
            className="text-sm"
            style={{ fontFamily: "'Poppins', sans-serif" }}
          >
            No internships found.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {internships.map((internship) => (
            <div
              key={internship._id}
              className="bg-white p-5 rounded-xl shadow-sm border border-gray-100
                   hover:shadow-md hover:border-indigo-100 transition-all duration-200 flex flex-col relative"
              style={{ fontFamily: "'Poppins', sans-serif" }}
            >
              {/* Three Dots Menu */}
              <div className="absolute top-3 right-3 z-10">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenMenuId(
                      openMenuId === internship._id ? null : internship._id,
                    );
                  }}
                  className="p-2 flex items-center justify-center text-gray-500 hover:text-gray-700 transition-all"
                >
                  <FontAwesomeIcon icon={faEllipsisVertical} />
                </button>

                {openMenuId === internship._id && (
                  <div
                    className="absolute right-0 mt-1 w-36 bg-white rounded-lg shadow-lg border border-gray-100 z-20 py-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuId(null);
                        handleDeleteJob(internship._id);
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors"
                      style={{ fontFamily: "'Poppins', sans-serif" }}
                    >
                      <FontAwesomeIcon icon={faTrash} className="text-xs" />
                      Delete Post
                    </button>
                  </div>
                )}
              </div>

              {/* Logo / Image */}
              <div className="mb-4 w-full h-32 flex items-center justify-center overflow-hidden">
                <img
                  src={internship.imgUrl || defaultCompanyLogo}
                  alt={internship.jobTitle}
                  className="max-h-28 max-w-full object-contain p-2"
                  width="200"
                  height="112"
                  loading="lazy"
                />
              </div>

              {/* Title + Company */}
              <h3 className="text-[15px] font-bold text-gray-900 leading-snug mb-0.5">
                {internship.jobTitle}
              </h3>
              <div className="flex flex-col gap-1 mb-3">
                <div className="text-xs font-medium text-indigo-500 flex items-center gap-1">
                  <FontAwesomeIcon
                    icon={faBriefcase}
                    className="text-[9px] text-indigo-300 shrink-0"
                  />
                  <span className="truncate">{internship.companyName}</span>
                  <span className="text-gray-300 mx-0.5 shrink-0">·</span>
                  <FontAwesomeIcon
                    icon={faLocationDot}
                    className="text-[9px] text-gray-300 shrink-0"
                  />
                  <span className="text-gray-400 font-normal truncate">
                    {internship.location}
                  </span>
                </div>
                <p className="text-[10px] text-gray-400 whitespace-nowrap">
                  ID: {internship._id}
                </p>
              </div>

              {/* Badges */}
              <div className="flex flex-wrap gap-1.5 mb-4">
                <ModePill mode={internship.internshipMode} />
                <TypePill type={internship.internshipType} />
                {internship.classification && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-600 border border-purple-200">
                    <FontAwesomeIcon icon={faBullseye} className="text-[9px]" />
                    {internship.classification}
                  </span>
                )}
              </div>

              {/* Details */}
              <div className="space-y-1.5 mb-4">
                <p className="text-xs text-gray-600 flex items-center gap-1.5">
                  <FontAwesomeIcon
                    icon={faClock}
                    className="text-gray-300 w-3.5 text-center"
                  />
                  <span className="font-semibold text-gray-700">Duration:</span>{" "}
                  {internship.duration || "—"}
                </p>
                <p className="text-xs text-gray-600 flex items-center gap-1.5">
                  <FontAwesomeIcon
                    icon={faCoins}
                    className="text-gray-300 w-3.5 text-center"
                  />
                  <span className="font-semibold text-gray-700">
                    Compensation:
                  </span>{" "}
                  <CompLabel i={internship} />
                </p>
                {internship.sector && (
                  <p className="text-xs text-gray-600 flex items-center gap-1.5">
                    <FontAwesomeIcon
                      icon={faIndustry}
                      className="text-gray-300 w-3.5 text-center"
                    />
                    <span className="font-semibold text-gray-700">Sector:</span>{" "}
                    <span className="text-indigo-600">
                      {SECTOR_LABELS[internship.sector] || internship.sector}
                    </span>
                  </p>
                )}
              </div>

              {/* Card footer */}
              <div className="mt-auto flex items-center justify-between pt-3 border-t border-gray-100">
                <StatusPill
                  adminStatus={internship.adminStatus}
                  adminReviewed={internship.adminReviewed}
                  adminApproved={internship.adminApproved}
                />
                <button
                  onClick={() => openViewModal(internship)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs font-semibold
                       rounded-lg hover:bg-indigo-700 active:scale-95 transition-all duration-150"
                >
                  View Details
                  <FontAwesomeIcon
                    icon={faArrowRight}
                    className="text-[10px]"
                  />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      <div className="flex justify-between items-center mt-5 min-h-[40px]">
        <button
          onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
          disabled={currentPage === 1 || isSearching || loading} // ✅ also disable during loading
          className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300 disabled:opacity-50 transition"
        >
          <FontAwesomeIcon icon={faChevronLeft} className="text-xs" />
          Previous
        </button>
        <span className="text-sm text-gray-600 font-medium min-w-[100px] text-center">
          {loading ? "" : `Page ${currentPage} of ${totalPages}`}
        </span>
        <button
          onClick={() =>
            setCurrentPage((prev) => Math.min(prev + 1, totalPages))
          }
          disabled={currentPage === totalPages || isSearching || loading}
          className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300 disabled:opacity-50 transition"
        >
          Next
          <FontAwesomeIcon icon={faChevronRight} className="text-xs" />
        </button>
      </div>

      {/* ─── Modal ── */}
      <Modal
        isOpen={isModalOpen}
        onRequestClose={closeModal}
        contentLabel={
          modalMode === "view" ? "Internship Details" : "Edit Internship"
        }
        className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
        overlayClassName="fixed inset-0 bg-black bg-opacity-50 z-[999]"
      >
        <div
          className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col"
          style={{ maxHeight: "90vh", fontFamily: "'Poppins', sans-serif" }}
        >
          {selectedInternship &&
            (modalMode === "view" ? (
              <ViewModalBody
                internship={selectedInternship}
                onEdit={() => setModalMode("edit")}
                onClose={closeModal}
              />
            ) : (
              <EditModalBody
                internship={selectedInternship}
                updateField={updateField}
                onSave={handleUpdateJob}
                onBack={() => setModalMode("view")}
                onClose={closeModal}
              />
            ))}
        </div>
      </Modal>

      {/* ─── Delete Confirmation Modal ─── */}
      {confirmDeleteId && (
        <div
          className="fixed inset-0 z-[2000] flex items-center justify-center"
          style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl px-8 py-8 flex flex-col items-center"
            style={{
              minWidth: 320,
              maxWidth: 380,
              fontFamily: "'Poppins', sans-serif",
            }}
          >
            {/* Icon */}
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-red-50 mb-4">
              <FontAwesomeIcon
                icon={faTrash}
                className="text-red-500 w-7 h-7"
              />
            </div>
            <h2 className="text-lg font-bold text-gray-800 mb-1">
              Move to Bin?
            </h2>
            <p className="text-sm text-gray-500 mb-6 text-center">
              Are you sure you want to move this job post to the Bin?
            </p>
            <div className="flex gap-3 w-full">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-semibold hover:bg-gray-50 transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 py-2.5 rounded-xl bg-red-500 text-white font-semibold hover:bg-red-600 transition-colors text-sm shadow-md"
              >
                OK, Move
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default YourJobPosts;
