import React, { useState, useEffect, useMemo } from "react";
import axios from "../../../../api/axiosInstance";
import Modal from "react-modal";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faFileInvoiceDollar,
  faBriefcase,
  faBuilding,
  faLocationDot,
  faCalendarDays,
  faCoins,
  faMoneyBillWave,
  faCircleCheck,
  faCircleXmark,
  faClock,
  faMagnifyingGlass,
  faXmark,
  faChevronLeft,
  faChevronRight,
  faHashtag,
  faUser,
  faEnvelope,
  faSpinner,
  faTriangleExclamation,
  faLayerGroup,
  faFileArrowDown,
  faEye,
} from "@fortawesome/free-solid-svg-icons";

Modal.setAppElement("#root");

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtDate = (d) =>
  d && !isNaN(Date.parse(d))
    ? new Date(d).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "—";

const fmtDateRange = (start, end) => {
  const s =
    start && !isNaN(Date.parse(start))
      ? new Date(start).toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
      : "";
  const e =
    end && !isNaN(Date.parse(end))
      ? new Date(end).toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
      : end || "";
  return s ? `${s}${e ? ` – ${e}` : ""}` : "—";
};

const fmtAmount = (amount, currency = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency }).format(
    amount || 0,
  );

// ─── CSV Export ───────────────────────────────────────────────────────────────
const exportCSV = (payments, internshipTitle) => {
  if (!payments.length) return;
  const headers = [
    "Student Name",
    "Student Email",
    "Amount",
    "Currency",
    "Status",
    "PayPal Order ID",
    "PayPal Payment ID",
    "Date",
  ];
  const rows = payments.map((p) => [
    p.studentId?.name || "",
    p.studentId?.email || "",
    p.amount || 0,
    p.currency || "",
    p.status || "",
    p.paypalOrderId || "",
    p.paypalPaymentId || "",
    p.completedAt
      ? new Date(p.completedAt).toLocaleString()
      : new Date(p.createdAt).toLocaleString(),
  ]);
  const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `payments-${internshipTitle || "export"}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

// ─── Status Badge ─────────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const cfg = {
    COMPLETED: {
      cls: "bg-green-100 text-green-700 border-green-200",
      icon: faCircleCheck,
      label: "Completed",
    },
    CREATED: {
      cls: "bg-yellow-100 text-yellow-700 border-yellow-200",
      icon: faClock,
      label: "Pending",
    },
    FAILED: {
      cls: "bg-red-100 text-red-600 border-red-200",
      icon: faCircleXmark,
      label: "Failed",
    },
    CANCELLED: {
      cls: "bg-gray-100 text-gray-500 border-gray-200",
      icon: faCircleXmark,
      label: "Cancelled",
    },
    APPROVED: {
      cls: "bg-blue-100 text-blue-700 border-blue-200",
      icon: faClock,
      label: "Approved",
    },
  }[status] || {
    cls: "bg-gray-100 text-gray-500 border-gray-200",
    icon: faClock,
    label: status,
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

// ─── KPI Card ─────────────────────────────────────────────────────────────────
const KpiCard = ({ icon, label, value, color }) => (
  <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
    <div className="flex items-center gap-2 mb-1">
      <div
        className={`w-6 h-6 rounded-md flex items-center justify-center ${color}`}
      >
        <FontAwesomeIcon icon={icon} className="text-white text-[10px]" />
      </div>
      <p
        className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold"
        style={{ fontFamily: "'Poppins', sans-serif" }}
      >
        {label}
      </p>
    </div>
    <p
      className="text-2xl font-bold text-gray-800 mt-1"
      style={{ fontFamily: "'Poppins', sans-serif" }}
    >
      {value}
    </p>
  </div>
);

// ─── Internship Card (Step 1 list) ────────────────────────────────────────────
const InternshipCard = ({ internship, onView }) => (
  <div
    className="bg-white border border-gray-100 rounded-xl p-5 flex flex-col sm:flex-row gap-4 shadow-sm hover:shadow-md hover:border-indigo-100 transition-all duration-200"
    style={{ fontFamily: "'Poppins', sans-serif" }}
  >
    {/* Logo */}
    {internship.imgUrl ? (
      <img
        src={internship.imgUrl}
        alt={internship.jobTitle}
        className="w-16 h-16 rounded-lg object-contain bg-gray-50 border border-gray-100 flex-shrink-0"
      />
    ) : (
      <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100 flex items-center justify-center flex-shrink-0">
        <FontAwesomeIcon
          icon={faBriefcase}
          className="text-indigo-300 text-xl"
        />
      </div>
    )}

    {/* Info */}
    <div className="flex-1 min-w-0">
      <h3 className="text-sm font-bold text-gray-900 truncate mb-0.5">
        {internship.jobTitle}
      </h3>
      <p className="text-xs text-indigo-500 font-medium mb-2 flex items-center gap-1">
        <FontAwesomeIcon
          icon={faBuilding}
          className="text-[9px] text-indigo-300"
        />
        {internship.companyName}
      </p>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400">
        {internship.location && (
          <span className="flex items-center gap-1">
            <FontAwesomeIcon icon={faLocationDot} className="text-[9px]" />
            {internship.location}
          </span>
        )}
        {(internship.startDate || internship.endDateOrDuration) && (
          <span className="flex items-center gap-1">
            <FontAwesomeIcon icon={faCalendarDays} className="text-[9px]" />
            {fmtDateRange(internship.startDate, internship.endDateOrDuration)}
          </span>
        )}
        {internship.compensationDetails?.amount && (
          <span className="flex items-center gap-1 font-semibold text-emerald-600">
            <FontAwesomeIcon icon={faCoins} className="text-[9px]" />
            {internship.compensationDetails.amount}{" "}
            {internship.compensationDetails.currency}
            {internship.compensationDetails.frequency
              ? ` / ${internship.compensationDetails.frequency.toLowerCase()}`
              : ""}
          </span>
        )}
      </div>

      {internship.qualifications?.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {internship.qualifications.slice(0, 4).map((q, i) => (
            <span
              key={i}
              className="text-[11px] bg-gray-100 text-gray-500 px-2.5 py-0.5 rounded-full"
            >
              {q}
            </span>
          ))}
          {internship.qualifications.length > 4 && (
            <span className="text-[11px] text-gray-400">
              +{internship.qualifications.length - 4} more
            </span>
          )}
        </div>
      )}
    </div>

    {/* View Button */}
    <div className="flex items-start sm:items-center flex-shrink-0">
      <button
        onClick={() => onView(internship)}
        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition active:scale-95"
        style={{ fontFamily: "'Poppins', sans-serif" }}
      >
        <FontAwesomeIcon icon={faEye} className="text-[10px]" />
        View Payments
      </button>
    </div>
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
const InternshipPayments = () => {
  // ── STEP 1: Internship list state ─────────────────────────────────────────
  const [internships, setInternships] = useState([]);
  const [loadingInternships, setLoadingInternships] = useState(false);
  const [internshipError, setInternshipError] = useState(null);
  const [listSearch, setListSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [listPage, setListPage] = useState(1);
  const [listTotalPages, setListTotalPages] = useState(1);
  const [listTotalCount, setListTotalCount] = useState(0);
  const LIST_PER_PAGE = 8;

  // ── STEP 2: Modal payments state ──────────────────────────────────────────
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedInternship, setSelectedInternship] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [paymentError, setPaymentError] = useState(null);

  // Modal filters + pagination
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const MODAL_PER_PAGE = 10;

  const partnerId = localStorage.getItem("partnerId");

  // Debounce search — wait 400ms after typing stops, then reset to page 1
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(listSearch);
      setListPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [listSearch]);

  // ── STEP 1: Fetch PAID internships — full server-side pagination ──────────
  // Backend response shape: { data, page, totalCount, totalPages }
  // We pass internshipType=PAID + page + limit + search so the server
  // handles filtering and pagination entirely — no limit:100 hack needed.
  useEffect(() => {
    if (!partnerId) {
      setInternshipError("Partner ID not found. Please log in again.");
      return;
    }
    setLoadingInternships(true);
    setInternshipError(null);

    axios
      .get(`/api/interns/partner/${partnerId}`, {
        params: {
          internshipType: "PAID",
          page: listPage,
          limit: LIST_PER_PAGE,
          search: debouncedSearch || undefined,
        },
      })
      .then((res) => {
        // ✅ Use totalCount (not total) — matches backend response shape
        setInternships(res.data?.data || []);
        setListTotalPages(res.data?.totalPages || 1);
        setListTotalCount(res.data?.total ?? 0); // ✅ backend returns 'total', not 'totalCount'
      })
      .catch(() => {
        setInternshipError("Failed to load internships. Please try again.");
        setInternships([]);
      })
      .finally(() => setLoadingInternships(false));
  }, [partnerId, listPage, debouncedSearch]);

  // Server returns already-filtered, already-paginated data — use directly
  const paginatedInternships = internships;

  // ── STEP 2: Click internship card → open modal → fetch its payments ───────
  const openPayments = async (internship) => {
    setSelectedInternship(internship);
    setModalOpen(true);
    setLoadingPayments(true);
    setPaymentError(null);
    setPayments([]);
    setSearch("");
    setStatusFilter("ALL");
    setPage(1);

    try {
      // Uses getPaymentsListForInternship — same as StipendDetails pattern
      const internshipId = internship._id?.$oid || internship._id;
      const res = await axios.get(
        `/api/internship/payments/${internshipId}/payments`,
      );
      setPayments(res.data?.payments || []);
    } catch {
      setPaymentError("Failed to load payments. Please try again.");
    } finally {
      setLoadingPayments(false);
    }
  };

  const closeModal = () => {
    setModalOpen(false);
    setSelectedInternship(null);
    setPayments([]);
    setPaymentError(null);
  };

  // ── Modal filter + pagination ─────────────────────────────────────────────
  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      const matchesStatus = statusFilter === "ALL" || p.status === statusFilter;
      const matchesSearch =
        !search ||
        p.studentId?.name?.toLowerCase().includes(search.toLowerCase()) ||
        p.studentId?.email?.toLowerCase().includes(search.toLowerCase()) ||
        p.paypalOrderId?.toLowerCase().includes(search.toLowerCase()) ||
        p.paypalPaymentId?.toLowerCase().includes(search.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [payments, statusFilter, search]);

  const modalTotalPages = Math.max(
    1,
    Math.ceil(filteredPayments.length / MODAL_PER_PAGE),
  );
  const pageData = filteredPayments.slice(
    (page - 1) * MODAL_PER_PAGE,
    page * MODAL_PER_PAGE,
  );

  // Modal summary stats — always from ALL payments (not filtered)
  const completedPayments = payments.filter((p) => p.status === "COMPLETED");
  const totalReceived = completedPayments.reduce(
    (s, p) => s + (p.amount || 0),
    0,
  );
  const currency =
    completedPayments[0]?.currency || payments[0]?.currency || "USD";

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className="min-h-screen bg-slate-50 px-6 py-8"
      style={{ fontFamily: "'Poppins', sans-serif" }}
    >
      <div className="max-w-5xl mx-auto">
        {/* ── Page Header ── */}
        <div className="flex items-start gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center flex-shrink-0">
            <FontAwesomeIcon
              icon={faFileInvoiceDollar}
              className="text-white"
            />
          </div>
          <div>
            <h1
              className="text-xl font-bold text-gray-900"
              style={{ fontFamily: "'Poppins', sans-serif" }}
            >
              Internship Payments
            </h1>
            <p
              className="text-xs text-gray-400 mt-0.5"
              style={{ fontFamily: "'Poppins', sans-serif" }}
            >
              Select a paid internship to view PayPal payments received from
              students
            </p>
          </div>
        </div>

        {/* ── Search bar ── */}
        <div className="relative mb-4">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
            <FontAwesomeIcon icon={faMagnifyingGlass} className="text-sm" />
          </span>
          {/*Add the "!mt-0" for alignment - 04-08-2026 */}
          <input
            type="text"
            placeholder="Search by title, company, or location..."
            value={listSearch}
            onChange={(e) => {
              setListSearch(e.target.value);
              setListPage(1);
            }}
            className="!mt-0 w-full pl-9 pr-8 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
            style={{ fontFamily: "'Poppins', sans-serif" }}
          />
          {listSearch && (
            <button
              onClick={() => {
                setListSearch("");
                setListPage(1);
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <FontAwesomeIcon icon={faXmark} className="text-sm" />
            </button>
          )}
        </div>

        {/* Result count */}
        {!loadingInternships && !internshipError && (
          <p
            className="text-xs text-gray-400 mb-4 flex items-center gap-1.5"
            style={{ fontFamily: "'Poppins', sans-serif" }}
          >
            <FontAwesomeIcon icon={faLayerGroup} className="text-gray-300" />
            {listTotalCount} paid internship{listTotalCount !== 1 ? "s" : ""}
            {listSearch && (
              <>
                {" "}
                matching <em className="text-gray-600">"{listSearch}"</em>
              </>
            )}
          </p>
        )}

        {/* ── Error ── */}
        {internshipError && (
          <div
            className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600 mb-4"
            style={{ fontFamily: "'Poppins', sans-serif" }}
          >
            <FontAwesomeIcon icon={faTriangleExclamation} />
            {internshipError}
          </div>
        )}

        {/* ── Loading internships ── */}
        {loadingInternships && (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-gray-400">
            <FontAwesomeIcon
              icon={faSpinner}
              className="text-3xl text-indigo-400 animate-spin"
            />
            <p
              className="text-sm"
              style={{ fontFamily: "'Poppins', sans-serif" }}
            >
              Loading internships…
            </p>
          </div>
        )}

        {/* ── Empty state ── */}
        {!loadingInternships &&
          !internshipError &&
          internships.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                <FontAwesomeIcon
                  icon={faFileInvoiceDollar}
                  className="text-2xl text-gray-300"
                />
              </div>
              <p
                className="text-sm font-medium text-gray-500"
                style={{ fontFamily: "'Poppins', sans-serif" }}
              >
                {!debouncedSearch
                  ? "No approved paid internships found."
                  : `No internships match "${debouncedSearch}".`}
              </p>
              <p
                className="text-xs text-gray-300 mt-1"
                style={{ fontFamily: "'Poppins', sans-serif" }}
              >
                {!debouncedSearch
                  ? "Paid internships appear here once approved by admin."
                  : "Try a different search term."}
              </p>
            </div>
          )}

        {/* ── Internship cards list ── */}
        {!loadingInternships && paginatedInternships.length > 0 && (
          <div className="space-y-4">
            {paginatedInternships.map((internship) => (
              <InternshipCard
                key={internship._id}
                internship={internship}
                onView={openPayments}
              />
            ))}
          </div>
        )}

        {/* ── List Pagination ── */}
        {!loadingInternships && listTotalPages > 1 && (
          <div className="flex justify-between items-center mt-6">
            <button
              disabled={listPage === 1}
              onClick={() => setListPage((p) => p - 1)}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50 transition"
              style={{ fontFamily: "'Poppins', sans-serif" }}
            >
              <FontAwesomeIcon icon={faChevronLeft} className="text-xs" />
              Previous
            </button>
            <span
              className="text-sm text-gray-400"
              style={{ fontFamily: "'Poppins', sans-serif" }}
            >
              Page {listPage} of {listTotalPages}
            </span>
            <button
              disabled={listPage === listTotalPages}
              onClick={() => setListPage((p) => p + 1)}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50 transition"
              style={{ fontFamily: "'Poppins', sans-serif" }}
            >
              Next
              <FontAwesomeIcon icon={faChevronRight} className="text-xs" />
            </button>
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════════════════════════════
          STEP 2 — PAYMENTS MODAL
      ════════════════════════════════════════════════════════════════ */}
      <Modal
        isOpen={modalOpen}
        onRequestClose={closeModal}
        overlayClassName="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
        className="bg-white rounded-2xl max-w-5xl w-full outline-none shadow-2xl flex flex-col"
        style={{ content: { maxHeight: "90vh" } }}
      >
        {/* Modal Header */}
        <div className="flex-shrink-0 flex items-start justify-between px-6 pt-6 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center">
              <FontAwesomeIcon
                icon={faFileInvoiceDollar}
                className="text-indigo-500"
              />
            </div>
            <div>
              <h2
                className="text-base font-bold text-gray-900"
                style={{ fontFamily: "'Poppins', sans-serif" }}
              >
                {selectedInternship?.jobTitle}
              </h2>
              <p
                className="text-xs text-gray-400 mt-0.5"
                style={{ fontFamily: "'Poppins', sans-serif" }}
              >
                {selectedInternship?.companyName}
              </p>
            </div>
          </div>
          <button
            onClick={closeModal}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition flex-shrink-0"
          >
            <FontAwesomeIcon icon={faXmark} className="text-sm" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5">
          {/* KPI Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
            <KpiCard
              icon={faLayerGroup}
              label="Total Payments"
              value={payments.length}
              color="bg-indigo-500"
            />
            <KpiCard
              icon={faMoneyBillWave}
              label="Total Received"
              value={fmtAmount(totalReceived, currency)}
              color="bg-emerald-500"
            />
            {/*Add the export-btn-internship class for button alignment in mobile view - 04-08-2026 */}
            <button
              onClick={() =>
                exportCSV(filteredPayments, selectedInternship?.jobTitle)
              }
              disabled={filteredPayments.length === 0 || loadingPayments}
              className="export-btn-internship flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition"
              style={{ fontFamily: "'Poppins', sans-serif" }}
            >
              <FontAwesomeIcon icon={faFileArrowDown} />
              Export CSV
            </button>
          </div>

          {/* Search + Status filter */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                <FontAwesomeIcon icon={faMagnifyingGlass} className="text-sm" />
              </span>
              {/*Add the "!mt-0" for alignment - 04-08-2026 */}
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search by student name, email, or PayPal ID..."
                className="!mt-0 w-full pl-9 pr-8 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                style={{ fontFamily: "'Poppins', sans-serif" }}
              />
              {search && (
                <button
                  onClick={() => {
                    setSearch("");
                    setPage(1);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <FontAwesomeIcon icon={faXmark} className="text-sm" />
                </button>
              )}
            </div>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="py-2 px-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              style={{ fontFamily: "'Poppins', sans-serif" }}
            >
              <option value="ALL">All Statuses</option>
              <option value="COMPLETED">Completed</option>
              <option value="CREATED">Pending</option>
              <option value="FAILED">Failed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          {/* Payment error */}
          {paymentError && (
            <div
              className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600 mb-4"
              style={{ fontFamily: "'Poppins', sans-serif" }}
            >
              <FontAwesomeIcon icon={faTriangleExclamation} />
              {paymentError}
            </div>
          )}

          {/* Loading payments */}
          {loadingPayments && (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-400">
              <FontAwesomeIcon
                icon={faSpinner}
                className="text-3xl text-indigo-400 animate-spin"
              />
              <p
                className="text-sm"
                style={{ fontFamily: "'Poppins', sans-serif" }}
              >
                Loading payments…
              </p>
            </div>
          )}

          {/* Empty payments */}
          {!loadingPayments && !paymentError && payments.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                <FontAwesomeIcon
                  icon={faMoneyBillWave}
                  className="text-xl text-gray-300"
                />
              </div>
              <p
                className="text-sm font-medium"
                style={{ fontFamily: "'Poppins', sans-serif" }}
              >
                No payments yet for this internship.
              </p>
              <p
                className="text-xs text-gray-300 mt-1"
                style={{ fontFamily: "'Poppins', sans-serif" }}
              >
                Payments appear here once students complete checkout.
              </p>
            </div>
          )}

          {/* No results after filter */}
          {!loadingPayments &&
            !paymentError &&
            payments.length > 0 &&
            filteredPayments.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                <FontAwesomeIcon
                  icon={faMagnifyingGlass}
                  className="text-2xl text-gray-200 mb-3"
                />
                <p
                  className="text-sm"
                  style={{ fontFamily: "'Poppins', sans-serif" }}
                >
                  No payments match your search or filter.
                </p>
              </div>
            )}

          {/* Payments Table */}
          {!loadingPayments && pageData.length > 0 && (
            <div className="overflow-x-auto border border-gray-100 rounded-xl">
              <table
                className="w-full text-sm"
                style={{ fontFamily: "'Poppins', sans-serif" }}
              >
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {[
                      { icon: faUser, label: "Student" },
                      { icon: faCoins, label: "Amount" },
                      { icon: faCircleCheck, label: "Status" },
                      { icon: faHashtag, label: "PayPal ID" },
                      { icon: faCalendarDays, label: "Date" },
                    ].map(({ icon, label }) => (
                      <th
                        key={label}
                        className="px-5 py-3 text-left text-[10px] uppercase tracking-widest text-gray-400 font-semibold"
                      >
                        <span className="flex items-center gap-1.5">
                          <FontAwesomeIcon
                            icon={icon}
                            className="text-gray-300 text-[9px]"
                          />
                          {label}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {pageData.map((p) => (
                    <tr key={p._id} className="hover:bg-gray-50 transition">
                      {/* Student */}
                      <td className="px-5 py-3">
                        <p className="text-xs font-semibold text-gray-800 flex items-center gap-1.5">
                          <FontAwesomeIcon
                            icon={faUser}
                            className="text-indigo-300 text-[9px]"
                          />
                          {p.studentId?.name || "Unknown"}
                        </p>
                        <p className="text-[11px] text-gray-400 flex items-center gap-1.5 mt-0.5">
                          <FontAwesomeIcon
                            icon={faEnvelope}
                            className="text-[9px]"
                          />
                          {p.studentId?.email || "—"}
                        </p>
                      </td>
                      {/* Amount */}
                      <td className="px-5 py-3 font-bold text-emerald-600">
                        {fmtAmount(p.amount, p.currency)}
                      </td>
                      {/* Status */}
                      <td className="px-5 py-3">
                        <StatusBadge status={p.status} />
                      </td>
                      {/* PayPal ID */}
                      <td className="px-5 py-3 font-mono text-xs text-gray-500 max-w-[140px]">
                        <span className="flex items-center gap-1 truncate">
                          <FontAwesomeIcon
                            icon={faHashtag}
                            className="text-gray-300 text-[9px] flex-shrink-0"
                          />
                          {p.paypalPaymentId
                            ? p.paypalPaymentId.slice(0, 16) + "…"
                            : p.paypalOrderId
                              ? p.paypalOrderId.slice(0, 16) + "…"
                              : "—"}
                        </span>
                      </td>
                      {/* Date */}
                      <td className="px-5 py-3 text-xs text-gray-400">
                        {fmtDate(p.completedAt || p.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal Footer — Pagination */}
        {!loadingPayments && modalTotalPages > 1 && (
          <div className="flex-shrink-0 flex justify-between items-center px-6 py-4 border-t border-gray-100 bg-white rounded-b-2xl">
            <button
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-200 disabled:opacity-50 transition"
              style={{ fontFamily: "'Poppins', sans-serif" }}
            >
              <FontAwesomeIcon icon={faChevronLeft} className="text-xs" />
              Previous
            </button>
            <span
              className="text-sm text-gray-400"
              style={{ fontFamily: "'Poppins', sans-serif" }}
            >
              Page {page} of {modalTotalPages}
            </span>
            <button
              disabled={page === modalTotalPages}
              onClick={() => setPage((p) => p + 1)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-200 disabled:opacity-50 transition"
              style={{ fontFamily: "'Poppins', sans-serif" }}
            >
              Next
              <FontAwesomeIcon icon={faChevronRight} className="text-xs" />
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default InternshipPayments;
