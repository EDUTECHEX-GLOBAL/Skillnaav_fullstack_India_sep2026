import React, { useState, useEffect, useMemo } from "react";
import PropTypes from "prop-types";
import jsPDF from "jspdf";
import SendOfferLetter from "./OfferLetter";
import BulkSendOffer from "./BulkSendOffer";
import {
  checkOfferStatuses,
  getOfferStatusText,
  getOfferStatusColor,
} from "./offerUtils";
import {
  fetchPipelineByStage,
  fetchL2AssessmentReview,
  fetchL2AssessmentReviewByCandidate,
  generateL2Assessment,
  sendL2Assessment,
  createInterview,
  scheduleInterview,
  sendInterviewInvite,
  completeInterview,
} from "./pipelineUtils";

// ─────────────────────────────────────────────────────────────────────────────
// Skeleton row — used as loading placeholder
// ─────────────────────────────────────────────────────────────────────────────
const SkeletonRow = ({ cols }) => (
  <tr>
    {Array.from({ length: cols }).map((_, i) => (
      <td key={i} className="px-5 py-4">
        <div className="h-3.5 bg-gray-100 rounded-full animate-pulse w-3/4 mx-auto" />
      </td>
    ))}
  </tr>
);

// ─────────────────────────────────────────────────────────────────────────────
// Empty state
// ─────────────────────────────────────────────────────────────────────────────
const EmptyState = ({ icon, message, sub }) => (
  <tr>
    <td colSpan={99}>
      <div className="flex flex-col items-center justify-center py-16 gap-2 text-gray-400">
        <span className="text-4xl">{icon}</span>
        <p className="text-sm font-semibold text-gray-500">{message}</p>
        {sub && <p className="text-xs text-gray-400">{sub}</p>}
      </div>
    </td>
  </tr>
);

// ─────────────────────────────────────────────────────────────────────────────
// Count pill
// ─────────────────────────────────────────────────────────────────────────────
const CountPill = ({ count, color = "blue" }) => {
  const colors = {
    blue: "bg-blue-100 text-blue-700",
    green: "bg-green-100 text-green-700",
    yellow: "bg-yellow-100 text-yellow-800",
    red: "bg-red-100 text-red-700",
    gray: "bg-gray-100 text-gray-600",
    purple: "bg-purple-100 text-purple-700",
  };
  return (
    <span
      className={`ml-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold ${colors[color] || colors.gray}`}
    >
      {count}
    </span>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Filter pill button
// ─────────────────────────────────────────────────────────────────────────────
const FilterPill = ({ active, onClick, children }) => (
  <button
    onClick={onClick}
    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${
      active
        ? "bg-gray-900 text-white border-gray-900 shadow-sm"
        : "bg-white text-gray-600 border-gray-200 hover:border-gray-400 hover:text-gray-800"
    }`}
  >
    {children}
  </button>
);

const OFFER_SENT_STATUSES = new Set(["Sent", "Accepted", "Rejected"]);

// ─────────────────────────────────────────────────────────────────────────────
// Table wrapper — sticky header, scrollable body
// ─────────────────────────────────────────────────────────────────────────────
const TableWrapper = ({ children }) => (
  <div className="rounded-xl border border-gray-200 overflow-hidden">
    <div className="overflow-auto max-h-[65vh]">
      <table className="min-w-[1120px] font-poppins text-sm bg-white">
        {children}
      </table>
    </div>
  </div>
);

const Th = ({ children, className = "" }) => (
  <th
    className={`px-5 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider bg-gray-50 sticky top-0 z-10 border-b border-gray-200 ${className}`}
  >
    {children}
  </th>
);

const Td = ({ children, className = "" }) => (
  <td className={`px-5 py-3.5 text-sm text-gray-700 align-middle ${className}`}>
    {children}
  </td>
);

// ─────────────────────────────────────────────────────────────────────────────
// L2 Status helpers
// ─────────────────────────────────────────────────────────────────────────────
const getL2StatusLabel = (status) => {
  switch ((status || "").toLowerCase()) {
    case "not_sent":
    case "not_used":
    case "":
      return "Pending";
    case "generated":
      return "Generated";
    case "sent":
      return "Sent";
    case "started":
      return "In Progress";
    case "submitted":
      return "Submitted";
    case "evaluated":
      return "Evaluated";
    case "passed":
      return "Passed";
    case "rejected":
      return "Rejected";
    case "expired":
      return "Expired";
    default:
      return status;
  }
};

const getL2StatusColor = (status) => {
  switch ((status || "").toLowerCase()) {
    case "sent":
      return "bg-blue-100 text-blue-700 border-blue-200";
    case "started":
      return "bg-amber-100 text-amber-800 border-amber-200";
    case "submitted":
      return "bg-purple-100 text-purple-800 border-purple-200";
    case "evaluated":
      return "bg-indigo-100 text-indigo-800 border-indigo-200";
    case "passed":
      return "bg-green-100 text-green-800 border-green-200";
    case "rejected":
    case "expired":
      return "bg-red-100 text-red-800 border-red-200";
    case "generated":
      return "bg-teal-100 text-teal-700 border-teal-200";
    default:
      return "bg-gray-100 text-gray-500 border-gray-200";
  }
};

const ASSIGNMENT_LOCKED_STATUSES = new Set([
  "sent",
  "started",
  "submitted",
  "evaluated",
  "passed",
  "rejected",
  "expired",
]);

const ASSESSMENT_RESULT_STATUSES = new Set(["evaluated", "passed", "rejected"]);

const getAssessmentResult = (item) => {
  const status = (item?.l2?.status || "").toLowerCase();
  const rawScore = item?.l2?.score;
  const score =
    typeof rawScore === "number" ? Math.round(rawScore * 10) / 10 : null;

  if (!ASSESSMENT_RESULT_STATUSES.has(status) || score == null) {
    return null;
  }

  const passed = status === "passed" || (status === "evaluated" && score >= 70);
  return {
    status,
    passed,
    marks: score,
    percentage: score,
    label: passed ? "Pass" : "Fail",
  };
};

const hasReviewQuestions = (review) =>
  Array.isArray(review?.questions) && review.questions.length > 0;

const downloadAssessmentResultPDF = async ({
  item,
  internshipTitle,
  internshipId,
}) => {
  const result = getAssessmentResult(item);
  if (!result) return;

  const student = item?.studentId || {};
  const name = student?.name || "Candidate";
  const email = student?.email || "N/A";
  const assessmentId = item?.l2?.assessmentId;
  const studentId = student?._id || item?.studentId;
  const itemInternshipId = item?.internshipId || internshipId;

  let review = null;
  if (assessmentId) {
    try {
      review = await fetchL2AssessmentReview(assessmentId);
    } catch (err) {
      console.error("Failed to fetch assessment review by id:", err);
    }
  }

  if (!hasReviewQuestions(review) && itemInternshipId && studentId) {
    try {
      review = await fetchL2AssessmentReviewByCandidate({
        internshipId: itemInternshipId,
        studentId,
      });
    } catch (err) {
      console.error("Failed to fetch assessment review by candidate:", err);
    }
  }

  if (!hasReviewQuestions(review)) {
    window.alert(
      "Question and answer details are not available yet. Please evaluate or refresh the assessment result and try again.",
    );
    return;
  }

  const completedSource =
    review?.evaluatedAt || review?.submittedAt || item?.l2?.updatedAt;
  const completedAt = completedSource
    ? new Date(completedSource).toLocaleString()
    : new Date().toLocaleString();

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const marginX = 16;
  const pageWidth = 210;
  const pageHeight = 297;
  const contentWidth = pageWidth - marginX * 2;
  let y = 18;

  const cleanText = (value) => {
    if (value === null || value === undefined || value === "") return "N/A";
    return String(value).replace(/\s+/g, " ").trim();
  };

  const ensureSpace = (height = 12) => {
    if (y + height <= pageHeight - 16) return;
    doc.addPage();
    y = 18;
  };

  const writeWrapped = (text, x, maxWidth, lineHeight = 5) => {
    const lines = doc.splitTextToSize(cleanText(text), maxWidth);
    ensureSpace(lines.length * lineHeight + 2);
    doc.text(lines, x, y);
    y += lines.length * lineHeight;
  };

  const writeLabelValue = (label, value) => {
    ensureSpace(8);
    doc.setFont("helvetica", "bold");
    doc.text(label, marginX, y);
    doc.setFont("helvetica", "normal");
    writeWrapped(value, marginX + 34, contentWidth - 34, 5);
    y += 1;
  };

  doc.setFillColor(37, 99, 235);
  doc.rect(0, 0, 210, 38, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("SkillNaav Assessment Answer Paper", marginX, y);
  y += 10;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(internshipTitle || "Internship Assessment", marginX, y);
  y = 52;

  doc.setTextColor(17, 24, 39);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(result.passed ? "PASS" : "FAIL", marginX, y);
  doc.setFontSize(28);
  doc.text(`${result.percentage}%`, 194, y, { align: "right" });
  y += 16;

  doc.setDrawColor(226, 232, 240);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Candidate Details", marginX, y);
  y += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  writeLabelValue("Name:", name);
  writeLabelValue("Email:", email);
  writeLabelValue(
    "Assessment ID:",
    review?.assessmentId || assessmentId || "N/A",
  );
  writeLabelValue("Completed:", completedAt);

  y += 4;
  ensureSpace(30);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("AI Result Summary", marginX, y);
  y += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  writeLabelValue("Marks:", `${result.marks}/100`);
  writeLabelValue("Percentage:", `${result.percentage}%`);
  writeLabelValue("Status:", result.label);
  if (review?.feedback) writeLabelValue("AI Feedback:", review.feedback);
  if (review?.textAnswer) writeLabelValue("Written Answer:", review.textAnswer);
  if (Array.isArray(review?.files) && review.files.length > 0) {
    writeLabelValue(
      "Uploaded Files:",
      review.files.map((file) => file.name || file.url).join(", "),
    );
  }

  const questions = Array.isArray(review?.questions) ? review.questions : [];
  y += 5;
  ensureSpace(12);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Question And Answer Review", marginX, y);
  y += 9;

  if (questions.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    writeWrapped(
      "Question and answer details are not available for this assessment yet.",
      marginX,
      contentWidth,
    );
  }

  questions.forEach((question, index) => {
    ensureSpace(34);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    writeWrapped(`Q${index + 1}. ${question.question}`, marginX, contentWidth);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    (question.options || []).forEach((option, optionIndex) => {
      const prefix = `${String.fromCharCode(65 + optionIndex)}.`;
      const markers = [];
      if (optionIndex === question.selectedIndex) markers.push("Student");
      if (optionIndex === question.correctIndex) markers.push("Correct");
      writeWrapped(
        `${prefix} ${option}${markers.length ? ` (${markers.join(", ")})` : ""}`,
        marginX + 4,
        contentWidth - 4,
        4.5,
      );
    });

    y += 1;
    doc.setFont("helvetica", "bold");
    doc.setTextColor(
      question.isCorrect ? 22 : 185,
      question.isCorrect ? 101 : 28,
      question.isCorrect ? 52 : 28,
    );
    writeWrapped(
      `AI Result: ${question.isCorrect ? "Correct" : "Incorrect"}`,
      marginX + 4,
      contentWidth - 4,
      4.5,
    );
    doc.setTextColor(17, 24, 39);
    doc.setFont("helvetica", "normal");
    writeWrapped(
      `Student Answer: ${question.selectedAnswer || "Not answered"}`,
      marginX + 4,
      contentWidth - 4,
      4.5,
    );
    writeWrapped(
      `Correct Answer: ${question.correctAnswer || "Not available"}`,
      marginX + 4,
      contentWidth - 4,
      4.5,
    );
    if (question.explanation) {
      writeWrapped(
        `AI Explanation: ${question.explanation}`,
        marginX + 4,
        contentWidth - 4,
        4.5,
      );
    }
    if (question.domain || question.difficulty || question.timeSpentSeconds) {
      const meta = [
        question.domain ? `Domain: ${question.domain}` : null,
        question.difficulty ? `Difficulty: ${question.difficulty}` : null,
        question.timeSpentSeconds
          ? `Time: ${question.timeSpentSeconds}s`
          : null,
      ]
        .filter(Boolean)
        .join(" | ");
      writeWrapped(meta, marginX + 4, contentWidth - 4, 4.5);
    }
    y += 6;
  });

  const pageCount = doc.internal.getNumberOfPages();
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(9);
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.text("Generated from SkillNaav partner dashboard.", marginX, 286);
    doc.text(`Page ${page} of ${pageCount}`, 194, 286, { align: "right" });
  }

  const safeName =
    name.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "") || "candidate";
  doc.save(`assessment_answer_paper_${safeName}.pdf`);
};

// ─────────────────────────────────────────────────────────────────────────────
// Application date/status helpers
// ─────────────────────────────────────────────────────────────────────────────
const formatAppDate = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};

const APP_STATUS_CONFIG = {
  shortlisted: {
    label: "Shortlisted",
    cls: "bg-amber-100 text-amber-800 border-amber-200",
  },
  approved: {
    label: "Approved",
    cls: "bg-green-100 text-green-800 border-green-200",
  },
  selected: {
    label: "Approved",
    cls: "bg-green-100 text-green-800 border-green-200",
  },
  accepted: {
    label: "Accepted",
    cls: "bg-green-100 text-green-800 border-green-200",
  },
  rejected: {
    label: "Rejected",
    cls: "bg-red-100 text-red-800 border-red-200",
  },
  declined: {
    label: "Rejected",
    cls: "bg-red-100 text-red-800 border-red-200",
  },
  pending: {
    label: "Applied",
    cls: "bg-gray-100 text-gray-600 border-gray-200",
  },
};

const getAppStatusConfig = (status) => {
  const key = (status || "").trim().toLowerCase();
  return (
    APP_STATUS_CONFIG[key] || {
      label: status
        ? status.charAt(0).toUpperCase() + status.slice(1)
        : "Applied",
      cls: "bg-gray-100 text-gray-600 border-gray-200",
    }
  );
};

const StatusPill = ({ label, cls }) => (
  <span
    className={`inline-flex items-center whitespace-nowrap px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${cls}`}
  >
    {label}
  </span>
);

// ─────────────────────────────────────────────────────────────────────────────
// ✅ FIX: Normalise a raw shortlist candidate doc into a consistent shape.
//
// The Python backend stores candidates with snake_case keys (student_id,
// ats_score_pct, similarity_score). But depending on whether the record
// comes from a fresh POST response or a GET fetch of existing DB docs,
// subtle differences can exist:
//
//   • Fresh POST  → ats_score_pct is always set (line 378 partner.py)
//   • GET from DB → ats_score_pct should be set, but old docs (before the
//                   field was added) may only have similarity_score
//   • student_id  → may be stored as ObjectId-turned-string or as null if
//                   the application used "studentId" (camelCase) and the
//                   converter didn't reach it
//
// This helper normalises all of that so the rest of the component can rely
// on consistent field names regardless of record age.
// ─────────────────────────────────────────────────────────────────────────────
const normaliseCandidate = (raw) => {
  if (!raw) return null;

  // student_id: prefer snake_case, fall back to camelCase variants
  const student_id = raw.student_id || raw.studentId || raw.student_ID || null;

  // ATS score: prefer ats_score_pct, derive from similarity_score if absent
  let ats_score_pct = raw.ats_score_pct;
  if (ats_score_pct == null && raw.similarity_score != null) {
    ats_score_pct = Math.round(raw.similarity_score * 1000) / 10; // 1 decimal
  }

  return {
    ...raw,
    student_id,
    ats_score_pct: ats_score_pct ?? null,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// ATS Score pill — standalone so it can be reused
// ─────────────────────────────────────────────────────────────────────────────
const AtsScorePill = ({ score }) => {
  if (score == null) {
    return <span className="text-gray-400 text-xs italic">N/A</span>;
  }
  const cls =
    score >= 70
      ? "bg-green-100 text-green-700 border-green-200"
      : score >= 50
        ? "bg-amber-100 text-amber-800 border-amber-200"
        : "bg-red-100 text-red-700 border-red-200";
  return (
    <span
      className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${cls}`}
    >
      {score}%
    </span>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// AI Reasoning badge + expandable panel — shown for borderline Claude decisions
// ─────────────────────────────────────────────────────────────────────────────
const AiReasoningPanel = ({ reasoning }) => {
  const [open, setOpen] = useState(false);
  if (!reasoning || reasoning.claude_evaluated === false) return null;

  const {
    shortlist,
    confidence,
    strengths = [],
    gaps = [],
    recommendation,
    reasoning: reason,
  } = reasoning;
  const confColor =
    confidence >= 80
      ? "text-green-700 bg-green-50 border-green-200"
      : confidence >= 60
        ? "text-amber-700 bg-amber-50 border-amber-200"
        : "text-red-700 bg-red-50 border-red-200";

  return (
    <div className="mt-1">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100 transition"
      >
        🤖 AI {shortlist ? "Approved" : "Flagged"} · {confidence}%
        <span className="ml-0.5">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="mt-2 p-3 rounded-xl border border-violet-100 bg-violet-50 text-xs space-y-2 w-72 shadow-sm">
          {/* Confidence */}
          <div
            className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[11px] font-semibold ${confColor}`}
          >
            Confidence: {confidence}%
          </div>

          {/* Recommendation */}
          {recommendation && (
            <p className="text-gray-700 font-medium leading-snug">
              {recommendation}
            </p>
          )}

          {/* Reasoning */}
          {reason && <p className="text-gray-500 leading-snug">{reason}</p>}

          {/* Strengths */}
          {strengths.length > 0 && (
            <div>
              <p className="font-semibold text-green-700 mb-1">✅ Strengths</p>
              <ul className="space-y-0.5">
                {strengths.map((s, i) => (
                  <li key={i} className="text-gray-600">
                    • {s}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Gaps */}
          {gaps.length > 0 && (
            <div>
              <p className="font-semibold text-red-600 mb-1">⚠️ Gaps</p>
              <ul className="space-y-0.5">
                {gaps.map((g, i) => (
                  <li key={i} className="text-gray-600">
                    • {g}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// ApplicationsTable
// ─────────────────────────────────────────────────────────────────────────────
export const ApplicationsTable = ({ applications = [] }) => {
  const [filter, setFilter] = useState("all");
  const [appSearch, setAppSearch] = useState("");

  const counts = useMemo(() => {
    const c = {
      all: applications.length,
      shortlisted: 0,
      applied: 0,
      rejected: 0,
    };
    applications.forEach((a) => {
      const key = (a.status || "").trim().toLowerCase();
      if (key === "shortlisted") c.shortlisted++;
      else if (key === "rejected" || key === "declined") c.rejected++;
      else c.applied++;
    });
    return c;
  }, [applications]);

  const filtered = useMemo(() => {
    let base = applications;
    if (filter === "shortlisted")
      base = applications.filter(
        (a) => (a.status || "").toLowerCase() === "shortlisted",
      );
    else if (filter === "rejected")
      base = applications.filter((a) =>
        ["rejected", "declined"].includes((a.status || "").toLowerCase()),
      );
    else if (filter === "applied")
      base = applications.filter(
        (a) =>
          !["shortlisted", "rejected", "declined"].includes(
            (a.status || "").toLowerCase(),
          ),
      );
    if (appSearch.trim()) {
      const q = appSearch.trim().toLowerCase();
      base = base.filter(
        (a) =>
          (a.userName || "").toLowerCase().includes(q) ||
          (a.userEmail || "").toLowerCase().includes(q),
      );
    }
    return base;
  }, [applications, filter, appSearch]);

  return (
    <div className="p-5 space-y-4">
      {/* ── Stats bar ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            key: "shortlisted",
            label: "Shortlisted",
            color: "border-l-amber-400",
            bg: "bg-amber-50",
            text: "text-amber-700",
          },
          {
            key: "applied",
            label: "Applied",
            color: "border-l-blue-400",
            bg: "bg-blue-50",
            text: "text-blue-700",
          },
          {
            key: "rejected",
            label: "Rejected",
            color: "border-l-red-400",
            bg: "bg-red-50",
            text: "text-red-700",
          },
        ].map(({ key, label, color, bg, text }) => (
          <button
            key={key}
            onClick={() => setFilter(filter === key ? "all" : key)}
            className={`${bg} border border-transparent border-l-4 ${color} rounded-xl px-4 py-3 text-left transition hover:shadow-sm ${
              filter === key ? "ring-2 ring-offset-1 ring-gray-400" : ""
            }`}
          >
            <p className={`text-2xl font-bold ${text}`}>{counts[key]}</p>
            <p className="text-xs text-gray-500 font-medium mt-0.5">{label}</p>
          </button>
        ))}
      </div>

      {/* ── Filter pills + total ── */}
      <div className="flex flex-wrap items-center gap-2">
        <FilterPill active={filter === "all"} onClick={() => setFilter("all")}>
          All <CountPill count={counts.all} color="gray" />
        </FilterPill>
        <FilterPill
          active={filter === "shortlisted"}
          onClick={() => setFilter("shortlisted")}
        >
          Shortlisted <CountPill count={counts.shortlisted} color="yellow" />
        </FilterPill>
        <FilterPill
          active={filter === "applied"}
          onClick={() => setFilter("applied")}
        >
          Applied <CountPill count={counts.applied} color="blue" />
        </FilterPill>
        <FilterPill
          active={filter === "rejected"}
          onClick={() => setFilter("rejected")}
        >
          Rejected <CountPill count={counts.rejected} color="red" />
        </FilterPill>
        <span className="ml-auto text-xs text-gray-400">
          Showing{" "}
          <span className="font-semibold text-gray-700">{filtered.length}</span>{" "}
          of <span className="font-semibold text-gray-700">{counts.all}</span>
        </span>
      </div>

      {/* ── Search ── */}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">
          🔍
        </span>
        {/*Add "!mt-0" for icon alignment - 07-08-2026 */}
        <input
          type="text"
          value={appSearch}
          onChange={(e) => setAppSearch(e.target.value)}
          placeholder="Search by name or email…"
          className="!mt-0 w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white placeholder-gray-400"
        />
        {appSearch && (
          <button
            onClick={() => setAppSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
          >
            ✕
          </button>
        )}
      </div>

      {/* ── Table ── */}
      <TableWrapper>
        <thead>
          <tr>
            <Th>#</Th>
            <Th>Applicant</Th>
            <Th>Email</Th>
            <Th>Applied Date</Th>
            <Th>Resume</Th>
            <Th>Status</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {filtered.length === 0 ? (
            <EmptyState
              icon="🔍"
              message={`No ${filter === "all" ? "" : filter + " "}applications`}
              sub="Try a different filter"
            />
          ) : (
            filtered.map((student, idx) => {
              const cfg = getAppStatusConfig(student.status);
              return (
                <tr
                  key={student._id}
                  className="hover:bg-gray-50 transition-colors"
                >
                  <Td className="text-gray-400 text-xs w-10">{idx + 1}</Td>
                  <Td>
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-indigo-600 text-xs font-bold">
                          {(student.userName || "?").charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <span className="font-medium text-gray-800">
                        {student.userName || "N/A"}
                      </span>
                    </div>
                  </Td>
                  <Td className="text-gray-500">
                    {student.userEmail || "N/A"}
                  </Td>
                  <Td className="text-gray-500 whitespace-nowrap">
                    {formatAppDate(student.appliedDate)}
                  </Td>
                  <Td>
                    {student.resumeUrl ? (
                      <a
                        href={student.resumeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-medium text-xs border border-blue-200 rounded-lg px-2.5 py-1 hover:bg-blue-50 transition"
                      >
                        📄 View
                      </a>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </Td>
                  <Td>
                    <StatusPill label={cfg.label} cls={cfg.cls} />
                  </Td>
                </tr>
              );
            })
          )}
        </tbody>
      </TableWrapper>
    </div>
  );
};
ApplicationsTable.propTypes = { applications: PropTypes.array.isRequired };

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const getPartnerId = () => {
  try {
    const info = JSON.parse(localStorage.getItem("partnerInfo") || "null");
    if (info?._id) return info._id;
  } catch (_) {}
  return localStorage.getItem("partnerId") || null;
};

const TabBtn = ({ active, children, onClick }) => (
  <button
    onClick={onClick}
    className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all border ${
      active
        ? "bg-gray-900 text-white border-gray-900 shadow-sm"
        : "bg-white text-gray-600 border-gray-200 hover:border-gray-400 hover:text-gray-800"
    }`}
  >
    {children}
  </button>
);

// ─────────────────────────────────────────────────────────────────────────────
// ShortlistedTable
// ─────────────────────────────────────────────────────────────────────────────
export const ShortlistedTable = ({
  candidates,
  internshipId,
  internshipTitle = "Internship",
}) => {
  const partnerId = useMemo(() => getPartnerId(), []);

  const [activeLevel, setActiveLevel] = useState("L1");

  // Offer
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [offerStatuses, setOfferStatuses] = useState({});
  const [isLoadingAll, setIsLoadingAll] = useState(false);
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);

  // Pipeline
  const [l2Items, setL2Items] = useState([]);
  const [l3Items, setL3Items] = useState([]);
  const [offerItems, setOfferItems] = useState([]);
  const [pipelineLoading, setPipelineLoading] = useState(false);
  const [sendingMap, setSendingMap] = useState({});

  // L3 schedule modal
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleTarget, setScheduleTarget] = useState(null);
  const [scheduleForm, setScheduleForm] = useState({
    scheduledAt: "",
    durationMinutes: 30,
  });
  const [googleAuthUrl, setGoogleAuthUrl] = useState("");
  const [googleConnected, setGoogleConnected] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);

  useEffect(() => {
    const handleGoogleConnected = (event) => {
      if (event.data?.type !== "skillnaav-google-calendar-connected") return;
      setGoogleAuthUrl("");
      setGoogleConnected(true);
    };
    window.addEventListener("message", handleGoogleConnected);
    return () => window.removeEventListener("message", handleGoogleConnected);
  }, []);

  // L1 filter + search
  const [l1Filter, setL1Filter] = useState("all");
  const [l1Search, setL1Search] = useState("");
  const [l2Search, setL2Search] = useState("");
  const [l3Search, setL3Search] = useState("");
  const [offerSearch, setOfferSearch] = useState("");

  // L2 config
  const [l2Config, setL2Config] = useState({
    assessmentType: "mcqs",
    questionCount: 10,
    difficulty: 2,
    timeLimitMinutes: 20,
    passScore: 70,
    allowText: true,
    allowFileUpload: true,
  });

  // ✅ FIX: Normalise every candidate on the way in so all downstream code
  //         gets consistent field names (student_id, ats_score_pct) regardless
  //         of whether the data came from a fresh POST or a GET of old DB docs.
  const normalisedCandidates = useMemo(
    () => (candidates || []).map(normaliseCandidate).filter(Boolean),
    [candidates],
  );

  // ── Dedup candidates ────────────────────────────────────────────────────────
  // ✅ FIX: Use resumeUrl as secondary dedup key when student_id is null,
  //         so old records without a valid student_id still all appear.
  const uniqueCandidates = useMemo(() => {
    const seen = new Set();
    return normalisedCandidates.filter((s) => {
      // Prefer student_id for dedup; fall back to resumeUrl for old records
      const key = s.student_id || s.resumeUrl || Math.random().toString();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [normalisedCandidates]);

  const candidateIds = useMemo(
    () =>
      uniqueCandidates
        .map((s) => s.student_id)
        .filter(Boolean)
        .sort()
        .join(","),
    [uniqueCandidates],
  );

  // ── Load offer statuses ─────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      if (!internshipId) return;
      const ids = candidateIds ? candidateIds.split(",") : [];
      if (!ids.length) return;
      setIsLoadingAll(true);
      try {
        const map = await checkOfferStatuses(ids, internshipId);
        setOfferStatuses((prev) => ({ ...prev, ...map }));
      } catch (e) {
        console.error("Offer status load failed:", e);
      } finally {
        setIsLoadingAll(false);
      }
    };
    load();
  }, [internshipId, candidateIds]);

  // ── Load pipeline data when tab changes ────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      if (!internshipId) return;
      setPipelineLoading(true);
      try {
        const [nextL2, nextL3, nextOffer] = await Promise.all([
          fetchPipelineByStage(internshipId, "L2"),
          fetchPipelineByStage(internshipId, "L3"),
          fetchPipelineByStage(internshipId, "OFFER"),
        ]);
        setL2Items(nextL2);
        setL3Items(nextL3);
        setOfferItems(nextOffer);
      } catch (e) {
        console.error("Pipeline load failed:", e);
      } finally {
        setPipelineLoading(false);
      }
    };
    load();
  }, [internshipId]);

  const l1Count = uniqueCandidates.length;
  const l2Count = l2Items.length;
  const l3Count = l3Items.length;
  const offerCount = offerItems.length;

  // ── L1 filter counts ────────────────────────────────────────────────────────
  const l1Counts = useMemo(() => {
    const c = {
      all: l1Count,
      shortlisted: 0,
      applied: 0,
      accepted: 0,
      rejected: 0,
    };
    uniqueCandidates.forEach((s) => {
      const st = offerStatuses[s.student_id] || "";
      if (st === "Accepted") c.accepted++;
      else if (st === "Rejected") c.rejected++;
      else if (st === "Sent") c.shortlisted++;
      else c.applied++;
    });
    return c;
  }, [uniqueCandidates, offerStatuses, l1Count]);

  const filteredL1 = useMemo(() => {
    let base = uniqueCandidates;
    if (l1Filter === "accepted")
      base = uniqueCandidates.filter(
        (s) => offerStatuses[s.student_id] === "Accepted",
      );
    else if (l1Filter === "rejected")
      base = uniqueCandidates.filter(
        (s) => offerStatuses[s.student_id] === "Rejected",
      );
    else if (l1Filter === "shortlisted")
      base = uniqueCandidates.filter(
        (s) => offerStatuses[s.student_id] === "Sent",
      );
    else if (l1Filter === "applied")
      base = uniqueCandidates.filter(
        (s) => !OFFER_SENT_STATUSES.has(offerStatuses[s.student_id]),
      );
    if (l1Search.trim()) {
      const q = l1Search.trim().toLowerCase();
      base = base.filter(
        (s) =>
          (s.name || "").toLowerCase().includes(q) ||
          (s.email || "").toLowerCase().includes(q),
      );
    }
    return base;
  }, [uniqueCandidates, offerStatuses, l1Filter, l1Search]);

  // ── L1 bulk selection ───────────────────────────────────────────────────────
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedStudents(
        filteredL1
          .filter(
            (s) =>
              s.student_id &&
              !OFFER_SENT_STATUSES.has(offerStatuses[s.student_id]),
          )
          .map((s) => s.student_id),
      );
    } else {
      setSelectedStudents([]);
    }
  };

  const toggleStudentSelect = (id) => {
    if (!id || OFFER_SENT_STATUSES.has(offerStatuses[id])) return;
    setSelectedStudents((prev) =>
      prev.includes(id) ? prev.filter((sid) => sid !== id) : [...prev, id],
    );
  };

  // ── Offer modal ─────────────────────────────────────────────────────────────
  const handleSendOfferClick = (student) => {
    if (OFFER_SENT_STATUSES.has(offerStatuses[student.student_id])) return;
    setSelectedStudent(student);
    setShowOfferModal(true);
  };

  const handleOfferSuccess = () => {
    if (selectedStudent?.student_id) {
      setOfferStatuses((prev) => ({
        ...prev,
        [selectedStudent.student_id]: "Sent",
      }));
    }
    setShowOfferModal(false);
    setSelectedStudent(null);
  };

  const handleCloseOfferModal = () => {
    setShowOfferModal(false);
    setSelectedStudent(null);
  };

  const handleBulkOfferSuccess = (sentStudents) => {
    setShowBulkModal(false);
    setSelectedStudents([]);
    setOfferStatuses((prev) => {
      const updated = { ...prev };
      sentStudents.forEach((s) => {
        if (s?.student_id) updated[s.student_id] = "Sent";
      });
      return updated;
    });
  };

  // ── L2: Send Assignment ─────────────────────────────────────────────────────
  const handleSendAssignment = async (item) => {
    const sid = item?.studentId?._id
      ? String(item.studentId._id)
      : item?.studentId
        ? String(item.studentId)
        : null;

    if (!sid || sendingMap[sid]) return;
    const l2Status = item?.l2?.status;
    if (ASSIGNMENT_LOCKED_STATUSES.has(l2Status)) return;

    setSendingMap((prev) => ({ ...prev, [sid]: true }));
    try {
      let assessmentId = item?.l2?.assessmentId
        ? String(item.l2.assessmentId)
        : null;
      if (!assessmentId) {
        const genRes = await generateL2Assessment({
          internshipId,
          studentId: sid,
          partnerId,
          config: l2Config,
        });
        assessmentId = genRes?.assessmentId
          ? String(genRes.assessmentId)
          : null;
        if (!assessmentId) throw new Error("Generate returned no assessmentId");
      }
      await sendL2Assessment({ assessmentId, partnerId });
      setL2Items(await fetchPipelineByStage(internshipId, "L2"));
    } catch (err) {
      console.error("❌ [L2] Send assignment failed:", err);
      alert(`Failed to send assignment:\n${err.message}`);
    } finally {
      setSendingMap((prev) => ({ ...prev, [sid]: false }));
    }
  };

  // ── L3: Schedule Interview ──────────────────────────────────────────────────
  const handleScheduleInterview = async (item) => {
    if (!scheduleForm.scheduledAt) {
      alert("Please select a valid date and time.");
      return;
    }
    try {
      setIsScheduling(true);
      const sid = item?.studentId?._id || item?.studentId;
      let interviewId = item?.l3?.interviewId?._id || item?.l3?.interviewId;
      if (!interviewId) {
        const res = await createInterview({
          internshipId,
          studentId: sid,
          partnerId,
        });
        interviewId = res.interviewId;
      }
      await scheduleInterview({
        interviewId,
        scheduledAt: scheduleForm.scheduledAt,
        durationMinutes: scheduleForm.durationMinutes,
        studentEmail: item.studentId.email,
        studentName: item.studentId.name,
        internshipTitle: internshipTitle,
      });
      await sendInterviewInvite(interviewId);
      setL3Items(await fetchPipelineByStage(internshipId, "L3"));
      setShowScheduleModal(false);
      setScheduleTarget(null);
    } catch (err) {
      console.error("❌ Schedule failed:", err);
      if (err.response?.status === 409 && err.response?.data?.authUrl) {
        setGoogleAuthUrl(err.response.data.authUrl);
      } else {
        alert("Failed to schedule interview. Please try again.");
      }
    } finally {
      setIsScheduling(false);
    }
  };

  // ── L3: Mark Result (Pass/Reject) ──────────────────────────────────────────
  const handleInterviewResult = async (item, result) => {
    try {
      const interviewId = item?.l3?.interviewId?._id || item?.l3?.interviewId;
      if (!interviewId) {
        alert("Interview not scheduled yet.");
        return;
      }

      const confirmMsg =
        result === "passed"
          ? "Mark candidate as Passed? They will be moved to the Offer stage."
          : "Mark candidate as Rejected?";

      if (!window.confirm(confirmMsg)) return;

      setPipelineLoading(true);
      await completeInterview({ interviewId, result, feedback: "" });
      setL3Items(await fetchPipelineByStage(internshipId, "L3"));
    } catch (err) {
      console.error("❌ Failed to update interview result:", err);
      alert("Failed to update status. Please try again.");
    } finally {
      setPipelineLoading(false);
    }
  };

  // ── Offer pill ──────────────────────────────────────────────────────────────
  const renderOfferStatusPill = (sid) => {
    const status = offerStatuses[sid] || "Not Sent";
    return (
      <StatusPill
        label={getOfferStatusText(status)}
        cls={getOfferStatusColor(status) + " border"}
      />
    );
  };

  const isLoading = isLoadingAll || pipelineLoading;
  const isInlinePanel = showOfferModal || showBulkModal || showScheduleModal;

  // ────────────────────────────────────────────────────────────────────────────
  return (
    <div className="p-5 space-y-5">
      {/* ── Main table content — hidden when an inline panel is showing ── */}
      {!isInlinePanel && (
        <>
          <div className="flex flex-wrap gap-2">
            <TabBtn
              active={activeLevel === "L1"}
              onClick={() => setActiveLevel("L1")}
            >
              Shortlisted L1 <CountPill count={l1Count} color="yellow" />
            </TabBtn>
            <TabBtn
              active={activeLevel === "L2"}
              onClick={() => setActiveLevel("L2")}
            >
              Assessment L2 <CountPill count={l2Count} color="purple" />
            </TabBtn>
            <TabBtn
              active={activeLevel === "L3"}
              onClick={() => setActiveLevel("L3")}
            >
              Interview L3 <CountPill count={l3Count} color="blue" />
            </TabBtn>
            <TabBtn
              active={activeLevel === "OFFER"}
              onClick={() => setActiveLevel("OFFER")}
            >
              Offer <CountPill count={offerCount} color="green" />
            </TabBtn>
          </div>

          {/* ── Loading bar ── */}
          {isLoading && (
            <div className="flex items-center gap-3 px-4 py-3 bg-blue-50 border border-blue-100 rounded-xl text-sm text-blue-700">
              <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
              Loading pipeline data…
            </div>
          )}

          {/* ════════════════════════════ LEVEL 1 ════════════════════════════ */}
          {activeLevel === "L1" && (
            <div className="space-y-4">
              {/* Stats row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  {
                    key: "shortlisted",
                    label: "Offer Sent",
                    color: "border-l-amber-400",
                    bg: "bg-amber-50",
                    text: "text-amber-700",
                  },
                  {
                    key: "applied",
                    label: "Pending",
                    color: "border-l-blue-400",
                    bg: "bg-blue-50",
                    text: "text-blue-700",
                  },
                  {
                    key: "accepted",
                    label: "Accepted",
                    color: "border-l-green-400",
                    bg: "bg-green-50",
                    text: "text-green-700",
                  },
                  {
                    key: "rejected",
                    label: "Rejected",
                    color: "border-l-red-400",
                    bg: "bg-red-50",
                    text: "text-red-700",
                  },
                ].map(({ key, label, color, bg, text }) => (
                  <div
                    key={key}
                    className={`${bg} border-l-4 ${color} rounded-xl px-4 py-3`}
                  >
                    <p className={`text-2xl font-bold ${text}`}>
                      {l1Counts[key]}
                    </p>
                    <p className="text-xs text-gray-500 font-medium mt-0.5">
                      {label}
                    </p>
                  </div>
                ))}
              </div>

              {/* Filter pills */}
              <div className="flex flex-wrap items-center gap-2">
                {[
                  {
                    key: "all",
                    label: "All",
                    count: l1Counts.all,
                    color: "gray",
                  },
                  {
                    key: "shortlisted",
                    label: "Offer Sent",
                    count: l1Counts.shortlisted,
                    color: "yellow",
                  },
                  {
                    key: "applied",
                    label: "Pending",
                    count: l1Counts.applied,
                    color: "blue",
                  },
                  {
                    key: "accepted",
                    label: "Accepted",
                    count: l1Counts.accepted,
                    color: "green",
                  },
                  {
                    key: "rejected",
                    label: "Rejected",
                    count: l1Counts.rejected,
                    color: "red",
                  },
                ].map(({ key, label, count, color }) => (
                  <FilterPill
                    key={key}
                    active={l1Filter === key}
                    onClick={() => setL1Filter(key)}
                  >
                    {label} <CountPill count={count} color={color} />
                  </FilterPill>
                ))}

                <div className="ml-auto flex items-center gap-2">
                  <span className="text-xs text-gray-400">
                    {selectedStudents.length > 0 && (
                      <span className="mr-2 font-semibold text-gray-700">
                        {selectedStudents.length} selected
                      </span>
                    )}
                  </span>
                  <button
                    disabled={selectedStudents.length === 0}
                    onClick={() => setShowBulkModal(true)}
                    className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
                  >
                    ✉ Bulk Offer ({selectedStudents.length})
                  </button>
                </div>
              </div>

              {/* Search */}
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">
                  🔍
                </span>
                {/*Add "!mt-0" for icon alignment - 07-08-2026 */}
                <input
                  type="text"
                  value={l1Search}
                  onChange={(e) => setL1Search(e.target.value)}
                  placeholder="Search by name or email…"
                  className="!mt-0 w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white placeholder-gray-400"
                />
                {l1Search && (
                  <button
                    onClick={() => setL1Search("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Table */}
              <TableWrapper>
                <thead>
                  <tr>
                    <Th className="w-10">
                      <input
                        type="checkbox"
                        className="rounded"
                        checked={
                          selectedStudents.length > 0 &&
                          selectedStudents.length ===
                            filteredL1.filter(
                              (s) =>
                                s.student_id &&
                                !OFFER_SENT_STATUSES.has(
                                  offerStatuses[s.student_id],
                                ),
                            ).length
                        }
                        onChange={handleSelectAll}
                      />
                    </Th>
                    <Th>#</Th>
                    <Th>Candidate</Th>
                    <Th>Email</Th>
                    <Th>ATS Score</Th>
                    <Th>AI Verdict</Th>
                    <Th>Resume</Th>
                    <Th>Offer Status</Th>
                    <Th>Action</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {isLoading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <SkeletonRow key={i} cols={9} />
                    ))
                  ) : filteredL1.length === 0 ? (
                    <EmptyState
                      icon="👤"
                      message="No candidates found"
                      sub="Try a different filter"
                    />
                  ) : (
                    filteredL1.map((student, idx) => {
                      const status =
                        offerStatuses[student.student_id] || "Not Sent";
                      const offerSent = OFFER_SENT_STATUSES.has(status);
                      return (
                        <tr
                          key={student.student_id || student.resumeUrl || idx}
                          className="hover:bg-gray-50 transition-colors"
                        >
                          <Td>
                            <input
                              type="checkbox"
                              className="rounded"
                              checked={selectedStudents.includes(
                                student.student_id,
                              )}
                              // ✅ FIX: disable checkbox only when offer is already sent OR student_id is missing
                              disabled={offerSent || !student.student_id}
                              onChange={() =>
                                toggleStudentSelect(student.student_id)
                              }
                            />
                          </Td>
                          <Td className="text-gray-400 text-xs">{idx + 1}</Td>
                          <Td>
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                                <span className="text-indigo-600 text-xs font-bold">
                                  {(student.name || "?")
                                    .charAt(0)
                                    .toUpperCase()}
                                </span>
                              </div>
                              <span className="font-medium text-gray-800">
                                {student.name || "N/A"}
                              </span>
                            </div>
                          </Td>
                          <Td className="text-gray-500">
                            {student.email || "N/A"}
                          </Td>
                          <Td>
                            {/* ✅ FIX: Use AtsScorePill which handles null gracefully and reads
                            the normalised ats_score_pct field (derived from similarity_score
                            as fallback for old DB records) */}
                            <AtsScorePill score={student.ats_score_pct} />
                          </Td>
                          <Td>
                            {/* AI reasoning panel — only visible for borderline Claude-evaluated candidates */}
                            {student.ai_reasoning?.claude_evaluated ? (
                              <AiReasoningPanel
                                reasoning={student.ai_reasoning}
                              />
                            ) : (
                              <span className="text-gray-300 text-xs">—</span>
                            )}
                          </Td>
                          <Td>
                            {student.resumeUrl ? (
                              <a
                                href={student.resumeUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-xs font-medium border border-blue-200 rounded-lg px-2.5 py-1 hover:bg-blue-50 transition"
                              >
                                📄 View
                              </a>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </Td>
                          <Td>{renderOfferStatusPill(student.student_id)}</Td>
                          <Td>
                            {!offerSent && student.student_id ? (
                              <button
                                onClick={() => handleSendOfferClick(student)}
                                className="px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition active:scale-95"
                              >
                                Send Offer
                              </button>
                            ) : (
                              <span className="text-xs text-gray-400 italic">
                                {offerSent
                                  ? getOfferStatusText(status)
                                  : "No ID"}
                              </span>
                            )}
                          </Td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </TableWrapper>
            </div>
          )}

          {/* ════════════════════════════ LEVEL 2 ════════════════════════════ */}
          {activeLevel === "L2" && (
            <div className="space-y-4">
              {/* Config panel */}
              <details className="group">
                <summary className="cursor-pointer px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 flex items-center gap-2 list-none">
                  <span className="group-open:rotate-90 transition-transform text-gray-400 inline-block">
                    ▶
                  </span>
                  Assessment Configuration
                </summary>
                <div className="mt-2 p-4 bg-gray-50 border border-gray-200 rounded-xl">
                  <div className="mb-4">
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Assessment Type
                    </label>
                    <select
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
                      value={l2Config.assessmentType || "mcqs"}
                      onChange={(e) =>
                        setL2Config((p) => ({
                          ...p,
                          assessmentType: e.target.value,
                        }))
                      }
                    >
                      <option value="mcqs">MCQs</option>
                      <option value="ai_voice_assessment">
                        AI Voice Assessment
                      </option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {[
                      {
                        label:
                          l2Config.assessmentType === "ai_voice_assessment"
                            ? "Question Count"
                            : "MCQ Count",
                        key: "questionCount",
                        type: "number",
                        min: 1,
                      },
                      {
                        label: "Difficulty (1-3)",
                        key: "difficulty",
                        type: "number",
                        min: 1,
                        max: 3,
                      },
                      {
                        label: "Time (mins)",
                        key: "timeLimitMinutes",
                        type: "number",
                        min: 1,
                      },
                      {
                        label: "Pass Score (%)",
                        key: "passScore",
                        type: "number",
                        min: 1,
                        max: 100,
                      },
                    ].map(({ label, key, ...rest }) => (
                      <div key={key}>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          {label}
                        </label>
                        <input
                          {...rest}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                          value={l2Config[key]}
                          onChange={(e) =>
                            setL2Config((p) => ({
                              ...p,
                              [key]: Number(e.target.value),
                            }))
                          }
                        />
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-6 mt-3">
                    {[
                      { label: "Text Answer", key: "allowText" },
                      { label: "File Upload", key: "allowFileUpload" },
                    ].map(({ label, key }) => (
                      <label
                        key={key}
                        className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer"
                      >
                        {/*Add "!mt-0 h-7" for decrease the checkboxes size - 10-08-2026 */}
                        <input
                          type="checkbox"
                          className="!mt-0 h-7 rounded"
                          checked={l2Config[key]}
                          onChange={(e) =>
                            setL2Config((p) => ({
                              ...p,
                              [key]: e.target.checked,
                            }))
                          }
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>
              </details>

              {/* Count + Search */}
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-500">
                  Assessment stage:{" "}
                  <span className="font-bold text-gray-800">{l2Count}</span>
                </span>
                <div className="relative flex-1 max-w-xs">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">
                    🔍
                  </span>
                  {/*Add "!mt-0" for icon alignment - 07-08-2026 */}
                  <input
                    type="text"
                    value={l2Search}
                    onChange={(e) => setL2Search(e.target.value)}
                    placeholder="Search name or email…"
                    className="!mt-0 w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white placeholder-gray-400"
                  />
                  {l2Search && (
                    <button
                      onClick={() => setL2Search("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              <TableWrapper>
                <thead>
                  <tr>
                    <Th>#</Th>
                    <Th>Candidate</Th>
                    <Th>Email</Th>
                    <Th>Assessment Status</Th>
                    <Th>Result</Th>
                    <Th>Offer Status</Th>
                    <Th>Actions</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {isLoading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <SkeletonRow key={i} cols={7} />
                    ))
                  ) : l2Items.filter((item) => {
                      if (!l2Search.trim()) return true;
                      const q = l2Search.trim().toLowerCase();
                      return (
                        (item?.studentId?.name || "")
                          .toLowerCase()
                          .includes(q) ||
                        (item?.studentId?.email || "").toLowerCase().includes(q)
                      );
                    }).length === 0 ? (
                    <EmptyState
                      icon="📋"
                      message="No matching candidates"
                      sub="Try a different search"
                    />
                  ) : (
                    l2Items
                      .filter((item) => {
                        if (!l2Search.trim()) return true;
                        const q = l2Search.trim().toLowerCase();
                        return (
                          (item?.studentId?.name || "")
                            .toLowerCase()
                            .includes(q) ||
                          (item?.studentId?.email || "")
                            .toLowerCase()
                            .includes(q)
                        );
                      })
                      .map((item, idx) => {
                        const sid = item?.studentId?._id
                          ? String(item.studentId._id)
                          : String(item?.studentId);
                        const name = item?.studentId?.name || "—";
                        const email = item?.studentId?.email || "—";
                        const l2Status = item?.l2?.status || "";
                        const offerStatus = offerStatuses[sid] || "Not Sent";
                        const offerCandidate = {
                          student_id: sid,
                          name,
                          email,
                          resumeUrl: item?.resumeUrl,
                        };
                        const isSending = !!sendingMap[sid];
                        const isLocked =
                          ASSIGNMENT_LOCKED_STATUSES.has(l2Status);
                        const assessmentResult = getAssessmentResult(item);

                        return (
                          <tr
                            key={sid}
                            className="hover:bg-gray-50 transition-colors"
                          >
                            <Td className="text-gray-400 text-xs">{idx + 1}</Td>
                            <Td>
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                                  <span className="text-purple-600 text-xs font-bold">
                                    {name.charAt(0).toUpperCase()}
                                  </span>
                                </div>
                                <span className="font-medium text-gray-800">
                                  {name}
                                </span>
                              </div>
                            </Td>
                            <Td className="text-gray-500">{email}</Td>
                            <Td>
                              <StatusPill
                                label={getL2StatusLabel(l2Status)}
                                cls={getL2StatusColor(l2Status)}
                              />
                            </Td>
                            <Td className="min-w-[180px]">
                              {assessmentResult ? (
                                <div className="flex flex-col gap-1.5">
                                  <span
                                    className={`inline-flex w-fit items-center px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                                      assessmentResult.passed
                                        ? "bg-green-50 text-green-700 border-green-200"
                                        : "bg-red-50 text-red-700 border-red-200"
                                    }`}
                                  >
                                    {assessmentResult.label}
                                  </span>
                                  <p className="text-sm text-gray-700 whitespace-nowrap">
                                    Marks:{" "}
                                    <span className="font-semibold text-gray-900">
                                      {assessmentResult.marks}/100
                                    </span>
                                  </p>
                                  <p className="text-sm text-gray-700 whitespace-nowrap">
                                    Percentage:{" "}
                                    <span className="font-semibold text-gray-900">
                                      {assessmentResult.percentage}%
                                    </span>
                                  </p>
                                </div>
                              ) : (
                                <span className="text-xs text-gray-400 italic">
                                  Not completed
                                </span>
                              )}
                            </Td>
                            <Td>{renderOfferStatusPill(sid)}</Td>
                            <Td className="w-[330px] max-w-[330px]">
                              <div className="flex w-[330px] max-w-full flex-nowrap items-center gap-2 overflow-x-auto pb-1 whitespace-nowrap">
                                <button
                                  onClick={() => handleSendAssignment(item)}
                                  disabled={isSending || isLocked}
                                  className={`flex-shrink-0 px-3 py-1.5 text-xs font-semibold rounded-lg transition active:scale-95 disabled:cursor-not-allowed ${
                                    isLocked
                                      ? "bg-purple-100 text-purple-700"
                                      : "bg-purple-50 text-purple-700 hover:bg-purple-100 disabled:opacity-40"
                                  }`}
                                >
                                  {isSending
                                    ? "Sending…"
                                    : isLocked
                                      ? "Sent ✓"
                                      : "Send Assessment"}
                                </button>
                                {assessmentResult && (
                                  <button
                                    onClick={() =>
                                      downloadAssessmentResultPDF({
                                        item,
                                        internshipTitle,
                                        internshipId,
                                      })
                                    }
                                    className="flex-shrink-0 px-3 py-1.5 bg-orange-50 text-orange-600 text-xs font-semibold rounded-lg hover:bg-orange-100 transition active:scale-95"
                                  >
                                    Download PDF
                                  </button>
                                )}
                                {offerStatus === "Not Sent" && (
                                  <button
                                    onClick={() =>
                                      handleSendOfferClick(offerCandidate)
                                    }
                                    className="flex-shrink-0 px-3 py-1.5 bg-blue-50 text-blue-600 text-xs font-semibold rounded-lg hover:bg-blue-100 transition active:scale-95"
                                  >
                                    Send Offer
                                  </button>
                                )}
                              </div>
                            </Td>
                          </tr>
                        );
                      })
                  )}
                </tbody>
              </TableWrapper>
            </div>
          )}

          {/* ════════════════════════════ LEVEL 3 ════════════════════════════ */}
          {activeLevel === "L3" && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-500">
                  Interview stage:{" "}
                  <span className="font-bold text-gray-800">{l3Count}</span>
                </span>
                <div className="relative flex-1 max-w-xs">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">
                    🔍
                  </span>
                  {/*Add "!mt-0" for icon alignment - 07-08-2026 */}
                  <input
                    type="text"
                    value={l3Search}
                    onChange={(e) => setL3Search(e.target.value)}
                    placeholder="Search name or email…"
                    className="!mt-0 w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white placeholder-gray-400"
                  />
                  {l3Search && (
                    <button
                      onClick={() => setL3Search("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              <TableWrapper>
                <thead>
                  <tr>
                    <Th>#</Th>
                    <Th>Candidate</Th>
                    <Th>Email</Th>
                    <Th>Interview Status</Th>
                    <Th>Offer Status</Th>
                    <Th>Actions</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {isLoading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <SkeletonRow key={i} cols={6} />
                    ))
                  ) : l3Items.filter((item) => {
                      if (!l3Search.trim()) return true;
                      const q = l3Search.trim().toLowerCase();
                      return (
                        (item?.studentId?.name || "")
                          .toLowerCase()
                          .includes(q) ||
                        (item?.studentId?.email || "").toLowerCase().includes(q)
                      );
                    }).length === 0 ? (
                    <EmptyState
                      icon="🎙️"
                      message="No matching candidates"
                      sub="Try a different search"
                    />
                  ) : (
                    l3Items
                      .filter((item) => {
                        if (!l3Search.trim()) return true;
                        const q = l3Search.trim().toLowerCase();
                        return (
                          (item?.studentId?.name || "")
                            .toLowerCase()
                            .includes(q) ||
                          (item?.studentId?.email || "")
                            .toLowerCase()
                            .includes(q)
                        );
                      })
                      .map((item, idx) => {
                        const sid = item?.studentId?._id
                          ? String(item.studentId._id)
                          : String(item?.studentId);
                        const name = item?.studentId?.name || "—";
                        const email = item?.studentId?.email || "—";
                        const l3Status = item?.l3?.status || "";
                        const offerStatus = offerStatuses[sid] || "Not Sent";
                        const offerCandidate = {
                          student_id: sid,
                          name,
                          email,
                          resumeUrl: item?.resumeUrl,
                        };

                        return (
                          <tr
                            key={sid}
                            className="hover:bg-gray-50 transition-colors"
                          >
                            <Td className="text-gray-400 text-xs">{idx + 1}</Td>
                            <Td>
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                                  <span className="text-blue-600 text-xs font-bold">
                                    {name.charAt(0).toUpperCase()}
                                  </span>
                                </div>
                                <span className="font-medium text-gray-800">
                                  {name}
                                </span>
                              </div>
                            </Td>
                            <Td className="text-gray-500">{email}</Td>
                            <Td>
                              <div className="flex flex-col gap-1.5">
                                <StatusPill
                                  label={l3Status || "Scheduled"}
                                  cls="bg-blue-100 text-blue-700 border-blue-200 self-start"
                                />
                                {(item?.l3?.scheduledAt ||
                                  item?.l3?.interviewId?.scheduledAt) && (
                                  <span className="text-[11px] text-gray-500 font-medium">
                                    {new Date(
                                      item?.l3?.scheduledAt ||
                                        item?.l3?.interviewId?.scheduledAt,
                                    ).toLocaleString("en-GB", {
                                      day: "2-digit",
                                      month: "short",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}
                                  </span>
                                )}
                                {item?.l3?.interviewId?.link && (
                                  <a
                                    href={item.l3.interviewId.link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[11px] text-blue-600 font-medium hover:underline flex items-center gap-1 w-fit"
                                  >
                                    🎥 Meet Link
                                  </a>
                                )}
                              </div>
                            </Td>
                            <Td>{renderOfferStatusPill(sid)}</Td>
                            <Td>
                              <div className="flex gap-2 flex-wrap items-center">
                                {["scheduled", "sent", "completed"].includes(
                                  l3Status,
                                ) ? (
                                  <button
                                    onClick={() => {
                                      setScheduleTarget(item);
                                      setShowScheduleModal(true);
                                    }}
                                    className="px-3 py-1.5 bg-white text-orange-600 border border-orange-200 text-xs font-semibold rounded-lg hover:bg-orange-50 transition active:scale-95 shadow-sm"
                                  >
                                    Reschedule
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => {
                                      setScheduleTarget(item);
                                      setShowScheduleModal(true);
                                    }}
                                    className="px-3 py-1.5 bg-orange-500 text-white text-xs font-semibold rounded-lg hover:bg-orange-600 transition active:scale-95 shadow-sm"
                                  >
                                    Schedule
                                  </button>
                                )}

                                {/* Pass / Reject actions once interview is scheduled */}
                                {["scheduled", "sent", "completed"].includes(
                                  l3Status,
                                ) && (
                                  <>
                                    <button
                                      onClick={() =>
                                        handleInterviewResult(item, "passed")
                                      }
                                      className="px-3 py-1.5 bg-emerald-500 text-white text-xs font-semibold rounded-lg hover:bg-emerald-600 transition active:scale-95 shadow-sm"
                                    >
                                      Pass
                                    </button>
                                    <button
                                      onClick={() =>
                                        handleInterviewResult(item, "rejected")
                                      }
                                      className="px-3 py-1.5 bg-rose-500 text-white text-xs font-semibold rounded-lg hover:bg-rose-600 transition active:scale-95 shadow-sm"
                                    >
                                      Reject
                                    </button>
                                  </>
                                )}

                                {offerStatus === "Not Sent" && (
                                  <button
                                    onClick={() =>
                                      handleSendOfferClick(offerCandidate)
                                    }
                                    className="px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition active:scale-95 shadow-sm"
                                  >
                                    Send Offer
                                  </button>
                                )}
                              </div>
                            </Td>
                          </tr>
                        );
                      })
                  )}
                </tbody>
              </TableWrapper>
            </div>
          )}

          {/* ════════════════════════════ OFFER STAGE ════════════════════════════ */}
          {activeLevel === "OFFER" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <span className="ml-auto font-semibold">
                  {offerCount} candidate{offerCount !== 1 ? "s" : ""}
                </span>
              </div>

              <div className="relative max-w-xs">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">
                  🔍
                </span>
                {/*Add "!mt-0" for icon alignment - 07-08-2026 */}
                <input
                  type="text"
                  value={offerSearch}
                  onChange={(e) => setOfferSearch(e.target.value)}
                  placeholder="Search name or email…"
                  className="!mt-0 w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-400 bg-white placeholder-gray-400"
                />
                {offerSearch && (
                  <button
                    onClick={() => setOfferSearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
                  >
                    ✕
                  </button>
                )}
              </div>

              <TableWrapper>
                <thead>
                  <tr>
                    <Th>#</Th>
                    <Th>Candidate</Th>
                    <Th>Email</Th>
                    <Th>Interview Result</Th>
                    <Th>Offer Status</Th>
                    <Th>Action</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {isLoading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <SkeletonRow key={i} cols={6} />
                    ))
                  ) : offerItems.filter((item) => {
                      if (!offerSearch.trim()) return true;
                      const q = offerSearch.trim().toLowerCase();
                      return (
                        (item?.studentId?.name || "")
                          .toLowerCase()
                          .includes(q) ||
                        (item?.studentId?.email || "").toLowerCase().includes(q)
                      );
                    }).length === 0 ? (
                    <EmptyState
                      icon="📬"
                      message="No matching candidates"
                      sub="Try a different search"
                    />
                  ) : (
                    offerItems
                      .filter((item) => {
                        if (!offerSearch.trim()) return true;
                        const q = offerSearch.trim().toLowerCase();
                        return (
                          (item?.studentId?.name || "")
                            .toLowerCase()
                            .includes(q) ||
                          (item?.studentId?.email || "")
                            .toLowerCase()
                            .includes(q)
                        );
                      })
                      .map((item, idx) => {
                        const sid = String(item?.studentId?._id);
                        const offerStatus = offerStatuses[sid] || "Not Sent";
                        return (
                          <tr
                            key={item._id}
                            className="hover:bg-gray-50 transition-colors"
                          >
                            <Td className="text-gray-400 text-xs">{idx + 1}</Td>
                            <Td>
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                                  <span className="text-green-600 text-xs font-bold">
                                    {(item.studentId?.name || "?")
                                      .charAt(0)
                                      .toUpperCase()}
                                  </span>
                                </div>
                                <span className="font-medium text-gray-800">
                                  {item.studentId?.name}
                                </span>
                              </div>
                            </Td>
                            <Td className="text-gray-500">
                              {item.studentId?.email}
                            </Td>
                            <Td>
                              <StatusPill
                                label="Passed"
                                cls="bg-green-100 text-green-800 border-green-200"
                              />
                            </Td>
                            <Td>{renderOfferStatusPill(sid)}</Td>
                            <Td>
                              {offerStatus === "Not Sent" ? (
                                <button
                                  onClick={() =>
                                    handleSendOfferClick({
                                      student_id: sid,
                                      name: item.studentId?.name,
                                      email: item.studentId?.email,
                                      resumeUrl: item?.resumeUrl,
                                    })
                                  }
                                  className="px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition active:scale-95"
                                >
                                  Send Offer
                                </button>
                              ) : (
                                <span className="text-xs text-gray-400 italic">
                                  {getOfferStatusText(offerStatus)}
                                </span>
                              )}
                            </Td>
                          </tr>
                        );
                      })
                  )}
                </tbody>
              </TableWrapper>
            </div>
          )}
        </> /* end !isInlinePanel */
      )}

      {/* ════════════════════════════ INLINE PANELS ════════════════════════════ */}
      {/* Offer Letter — rendered inline, no nested Modal */}
      {showOfferModal && selectedStudent && (
        <div className="p-5">
          <SendOfferLetter
            student={{
              _id: selectedStudent.student_id,
              name: selectedStudent.name,
              email: selectedStudent.email,
              resumeUrl: selectedStudent.resumeUrl,
            }}
            internshipId={internshipId}
            onSuccess={handleOfferSuccess}
            onCancel={handleCloseOfferModal}
          />
        </div>
      )}

      {/* Bulk Send Offer — rendered inline, no nested Modal */}
      {showBulkModal && (
        <div className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <button
              onClick={() => setShowBulkModal(false)}
              className="text-sm text-gray-500 hover:text-gray-800 flex items-center gap-1"
            >
              ← Back
            </button>
            <h3 className="text-base font-bold text-gray-900">
              Send Offers to {selectedStudents.length} Student
              {selectedStudents.length !== 1 ? "s" : ""}
            </h3>
          </div>
          <BulkSendOffer
            selectedStudents={selectedStudents
              .map((id) => uniqueCandidates.find((s) => s.student_id === id))
              .filter(Boolean)}
            internshipId={internshipId}
            onCancel={() => setShowBulkModal(false)}
            onSuccess={handleBulkOfferSuccess}
          />
        </div>
      )}

      {/* Schedule Interview — rendered inline, no nested Modal */}
      {showScheduleModal && scheduleTarget && (
        <div className="p-5 space-y-5">
          <div className="flex items-center gap-2 mb-2">
            <button
              onClick={() => setShowScheduleModal(false)}
              className="text-sm text-gray-500 hover:text-gray-800 flex items-center gap-1"
            >
              ← Back
            </button>
            <h3 className="text-base font-bold text-gray-900">
              Schedule Interview
            </h3>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Date & Time
            </label>
            <input
              type="datetime-local"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              value={scheduleForm.scheduledAt}
              onChange={(e) =>
                setScheduleForm((p) => ({ ...p, scheduledAt: e.target.value }))
              }
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Duration (minutes)
            </label>
            <input
              type="number"
              min={15}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              value={scheduleForm.durationMinutes}
              onChange={(e) =>
                setScheduleForm((p) => ({
                  ...p,
                  durationMinutes: Number(e.target.value),
                }))
              }
            />
          </div>
          {googleConnected && (
            <p className="text-sm text-green-600 font-medium">
              ✅ Google Calendar connected! You can now click confirm to schedule.
            </p>
          )}
          {googleAuthUrl && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-2">
              <p className="text-sm text-blue-800 mb-3">
                Your Google Calendar connection has expired. You must reconnect it to automatically generate Google Meet links.
              </p>
              <button
                onClick={() => window.open(googleAuthUrl, "skillnaav-google-calendar", "width=520,height=700")}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl transition"
              >
                Connect Google Calendar
              </button>
            </div>
          )}
          <button
            onClick={() => handleScheduleInterview(scheduleTarget)}
            disabled={isScheduling}
            className={`w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-2.5 rounded-xl transition active:scale-95 flex justify-center items-center gap-2 ${isScheduling ? "opacity-70 cursor-not-allowed" : ""}`}
          >
            {isScheduling ? (
              <>
                <svg
                  className="animate-spin h-5 w-5 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Scheduling...
              </>
            ) : (
              "Confirm & Send Invite"
            )}
          </button>
        </div>
      )}
    </div>
  );
};

ShortlistedTable.propTypes = {
  candidates: PropTypes.array.isRequired,
  internshipId: PropTypes.string.isRequired,
};

export default ShortlistedTable;
