import React from "react";
import {
  FaMapMarkerAlt,
  FaClock,
  FaDollarSign,
  FaRupeeSign,
  FaHeart,
  FaGlobe,
} from "react-icons/fa";

/**
 * Safe date formatter -> "02 Oct 2026"
 */
const formatDate = (dateString) => {
  if (!dateString) return null;
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return null;
  }
};

/**
 * Relative time calculation -> "7d ago", "Today", etc.
 */
const calculatePostedTime = (date) => {
  if (!date) return "Recently";
  try {
    const diff = Math.floor(
      (new Date() - new Date(date)) / (1000 * 60 * 60 * 24)
    );
    if (diff <= 0) return "Today";
    if (diff === 1) return "Yesterday";
    return `${diff}d ago`;
  } catch {
    return "Recently";
  }
};

/**
 * Unified, modern JobCardItem matching exact design specifications:
 * - Top header with Mode badge (e.g. "Offline") and Type badge ("FREE") + Heart save icon
 * - Company logo (rounded square) + Title + Company name + relative time
 * - Soft tinted inner container with purple icons (Location, Dates, Compensation)
 * - Lavender skill tag pills (+N count) and vibrant "View details →" link
 */
const JobCardItem = ({
  job,
  isSaved = false,
  onToggleSave,
  onViewDetails,
  isRecommendation = false,
  rankIndex,
  showId = true,
}) => {
  if (!job) return null;

  // Type: FREE, STIPEND, PAID
  const type = (job.internshipType || "FREE").toUpperCase();

  // Mode: Offline, Online, Hybrid
  const rawMode =
    job.internshipMode ||
    (job.jobType?.toLowerCase().includes("online")
      ? "ONLINE"
      : job.jobType?.toLowerCase().includes("offline")
      ? "OFFLINE"
      : job.jobType?.toLowerCase().includes("hybrid")
      ? "HYBRID"
      : "OFFLINE");
  const modeText =
    rawMode.charAt(0).toUpperCase() + rawMode.slice(1).toLowerCase();

  // Compensation details
  const currency = job.compensationDetails?.currency || "INR";
  const isRupee = !currency || currency.toUpperCase() === "INR" || currency === "₹";
  let compensationText = "Unpaid / Free";
  let useRupeeIcon = isRupee;

  if (type === "FREE") {
    compensationText = "Unpaid / Free";
    useRupeeIcon = false;
  } else if (type === "STIPEND") {
    const amount = job.compensationDetails?.amount ?? "";
    const freq = job.compensationDetails?.frequency
      ? ` / ${job.compensationDetails.frequency.toLowerCase().replace(/_/g, " ")}`
      : " / month";
    const currSym = isRupee
      ? "₹"
      : (currency.toUpperCase() === "USD" || currency.toUpperCase() === "CAD")
      ? "$"
      : (currency.toUpperCase() === "EUR" ? "€" : (currency.toUpperCase() === "GBP" ? "£" : "₹"));
    compensationText = `${currSym}${amount}${freq}`;
  } else if (type === "PAID") {
    const amount = job.compensationDetails?.amount ?? "";
    const currSym = isRupee ? "₹" : "";
    const currCode = !isRupee && currency ? ` ${currency}` : "";
    compensationText = `Student Pays: ${currSym}${amount}${currCode}`;
  }

  // Date range
  const startDateStr = formatDate(job.startDate);
  const endDateStr = formatDate(job.endDateOrDuration);
  let dateRangeText = "Flexible Dates";
  if (startDateStr && endDateStr) {
    dateRangeText = `${startDateStr} – ${endDateStr}`;
  } else if (startDateStr) {
    dateRangeText = `${startDateStr} – Ongoing`;
  } else if (job.endDateOrDuration) {
    dateRangeText = job.endDateOrDuration;
  }

  // Location
  const locationText = job.location || "Remote / Anywhere";

  // Skills / Qualifications (display up to 2, remaining count)
  const qualifications = Array.isArray(job.qualifications)
    ? job.qualifications
    : [];
  const displayTags = qualifications.slice(0, 2);
  const remainingCount =
    qualifications.length > 2 ? qualifications.length - 2 : 0;

  return (
    <div
      onClick={() => onViewDetails && onViewDetails(job)}
      className="relative bg-white border border-gray-300 hover:border-purple-400 rounded-2xl p-5 sm:p-6 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between w-full group cursor-pointer font-poppins"
    >
      <div>
        {/* Top-Right: Type Badge + Save Heart */}
        <div className="absolute top-4 right-4 sm:top-5 sm:right-5 flex flex-col items-end gap-2.5 z-10">
          {type && (
            <span
              className={`px-3 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                type === "FREE"
                  ? "bg-green-100 text-green-700"
                  : type === "STIPEND"
                  ? "bg-blue-100 text-blue-700"
                  : "bg-red-100 text-red-600"
              }`}
            >
              {type}
            </span>
          )}

          {onToggleSave && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleSave(job);
              }}
              className={`transition-colors p-1 flex items-center justify-center ${
                isSaved
                  ? "text-red-500 scale-110"
                  : "text-gray-400 hover:text-red-400"
              }`}
              aria-label={isSaved ? "Unsave job" : "Save job"}
              title={isSaved ? "Saved" : "Save job"}
            >
              <FaHeart className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Company Logo + Title + Subtitle + ID */}
        <div className="flex items-start gap-3.5 mb-4 pr-24">
          <img
            src={job.imgUrl || "/favicon-512x469.png"}
            alt={`${job.companyName || "Company"} Logo`}
            className="w-12 h-12 rounded-full object-cover flex-shrink-0 bg-white"
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = "/favicon-512x469.png";
            }}
          />
          <div className="flex-1 min-w-0">
            {isRecommendation && typeof rankIndex === "number" && (
              <div className="mb-1">
                <span className="inline-block text-[10px] font-bold bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                  #{rankIndex + 1} Match
                </span>
              </div>
            )}
            <h3
              className="text-lg sm:text-xl font-bold text-gray-900 truncate leading-snug"
              title={job.jobTitle}
            >
              {job.jobTitle}
            </h3>
            <div className="flex items-center text-sm text-gray-500 font-medium mt-0.5 gap-1.5">
              <span className="truncate" title={job.companyName}>
                {job.companyName || "Company"}
              </span>
              <span>•</span>
              <span className="whitespace-nowrap">
                {calculatePostedTime(job.createdAt)}
              </span>
            </div>
          </div>
        </div>

        {/* Meta Items (Location, Dates, Compensation, Mode) */}
        <div className="space-y-2 mb-4 text-sm text-gray-600 font-medium">
          <div className="flex items-center gap-2.5">
            <FaMapMarkerAlt className="text-gray-500 text-sm shrink-0 w-4" />
            <span className="truncate">{locationText}</span>
          </div>

          <div className="flex items-center gap-2.5">
            <FaClock className="text-gray-500 text-sm shrink-0 w-4" />
            <span className="truncate">{dateRangeText}</span>
          </div>

          <div className="flex items-center gap-2.5">
            {useRupeeIcon ? (
              <FaRupeeSign className="text-gray-500 text-sm shrink-0 w-4" />
            ) : (
              <FaDollarSign className="text-gray-500 text-sm shrink-0 w-4" />
            )}
            <span className="truncate">{compensationText}</span>
          </div>

          <div className="flex items-center gap-2.5">
            <FaGlobe className="text-gray-500 text-sm shrink-0 w-4" />
            <span className="truncate">{modeText}</span>
          </div>
        </div>

        {/* Recommendation Reason (if AI recommended) */}
        {isRecommendation && job.match_reason && (
          <div className="flex items-start gap-2 bg-purple-50 border border-purple-100 rounded-xl px-3 py-2.5 mb-3.5">
            <span className="text-purple-500 text-xs mt-0.5 flex-shrink-0">✦</span>
            <p className="text-xs text-purple-700 leading-relaxed font-medium">
              {job.match_reason}
            </p>
          </div>
        )}
      </div>

      {/* Bottom Row: Skills pills (left) & View details (right) */}
      <div className="flex items-center justify-between gap-2 pt-3 border-t border-gray-100 mt-auto">
        <div className="flex items-center flex-wrap gap-1.5 min-w-0">
          {displayTags.map((tag, idx) => (
            <span
              key={idx}
              className="bg-slate-100 text-slate-700 text-xs font-semibold px-3 py-1 rounded-full truncate max-w-[180px]"
              title={tag}
            >
              {tag}
            </span>
          ))}
          {remainingCount > 0 && (
            <span className="bg-slate-100 text-slate-600 text-xs font-semibold px-2.5 py-1 rounded-full shrink-0">
              +{remainingCount}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onViewDetails && onViewDetails(job);
          }}
          className="text-purple-600 hover:text-purple-700 font-bold text-sm flex items-center gap-1 transition-colors shrink-0 ml-2 whitespace-nowrap"
        >
          <span>View details</span>
          <span className="text-base leading-none">→</span>
        </button>
      </div>
    </div>
  );
};

export default JobCardItem;
