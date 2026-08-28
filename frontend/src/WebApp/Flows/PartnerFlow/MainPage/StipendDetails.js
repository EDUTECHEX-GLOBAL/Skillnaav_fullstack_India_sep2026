import React, { useState, useEffect, useMemo } from "react";
import axios from "../../../../api/axiosInstance";
import Modal from "react-modal";
import { ClipLoader } from "react-spinners";
import { CSVLink } from "react-csv";

Modal.setAppElement("#root");

/* ---------------- Utils ---------------- */
const formatDateRange = (start, end) => {
  if (!start) return "";
  const s = new Date(start).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  });
  const e =
    end && !isNaN(Date.parse(end))
      ? new Date(end).toLocaleDateString("en-GB", {
          day: "2-digit", month: "short", year: "numeric",
        })
      : end || "";
  return `${s} – ${e}`;
};

/* ---------------- Component ---------------- */
const StipendDetails = () => {

  // ── Internship list state ─────────────────────────────────────────────────
  const [internships,    setInternships]    = useState([]);
  const [loading,        setLoading]        = useState(false);
  const [listTotal,      setListTotal]      = useState(0);      // from res.data.total
  const [listTotalPages, setListTotalPages] = useState(1);      // from res.data.totalPages

  // List search + pagination — server-side
  const [listSearch,      setListSearch]      = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [listPage,        setListPage]        = useState(1);
  const LIST_PER_PAGE = 8;

  // ── Modal state ───────────────────────────────────────────────────────────
  const [stipends,           setStipends]           = useState([]);
  const [loadingStipends,    setLoadingStipends]    = useState(false);
  const [modalIsOpen,        setModalIsOpen]        = useState(false);
  const [selectedInternship, setSelectedInternship] = useState(null);
  const [error,              setError]              = useState(null);

  // Modal search + pagination (client-side — stipends list is small)
  const [search, setSearch] = useState("");
  const [page,   setPage]   = useState(1);
  const PER_PAGE = 10;

  const partnerId = localStorage.getItem("partnerId");

  /* ── Debounce list search ────────────────────────────────────────────────*/
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(listSearch);
      setListPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [listSearch]);

  /* ── Fetch STIPEND internships — fully server-side ───────────────────────
     Backend supports: internshipType, page, limit, search query params.
     Response shape:   { data: [...], page, total, totalPages }            */
  useEffect(() => {
    if (!partnerId) return;
    setLoading(true);
    axios
      .get(`/api/interns/partner/${partnerId}`, {
        params: {
          internshipType: "STIPEND",
          page:           listPage,
          limit:          LIST_PER_PAGE,
          search:         debouncedSearch || undefined,
        },
      })
      .then((res) => {
        setInternships(res.data?.data || []);
        setListTotal(res.data?.total ?? 0);           // ✅ "total" — confirmed from network tab
        setListTotalPages(res.data?.totalPages ?? 1);
      })
      .catch(() => setInternships([]))
      .finally(() => setLoading(false));
  }, [partnerId, listPage, debouncedSearch]);

  /* ── Fetch stipend details on card click ─────────────────────────────────*/
  const openStipends = async (internship) => {
    setSelectedInternship(internship);
    setModalIsOpen(true);
    setLoadingStipends(true);
    setSearch("");
    setPage(1);
    setError(null);

    try {
      const res = await axios.get(
        `/api/internship/stipend-details/internship/${internship._id?.$oid || internship._id}`
      );
      setStipends(res.data?.stipendDetails || []);
    } catch {
      setError("Failed to load stipend details");
    } finally {
      setLoadingStipends(false);
    }
  };

  const closeModal = () => {
    setModalIsOpen(false);
    setSelectedInternship(null);
    setStipends([]);
    setError(null);
  };

  /* ── Modal filter + pagination (client-side) ─────────────────────────────*/
  const filtered = useMemo(() => {
    if (!search) return stipends;
    const q = search.toLowerCase();
    return stipends.filter(
      (s) =>
        s.bankAccountName?.toLowerCase().includes(q) ||
        s.ifscOrSwift?.toLowerCase().includes(q) ||
        s.bankAccountNumber?.includes(q)
    );
  }, [stipends, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const pageData   = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  /* ---------------- UI ---------------------------------------------------- */
  return (
    <div className="min-h-screen bg-slate-50 px-6 py-8 font-[Poppins]">

      {/* Header */}
      <div className="max-w-5xl mx-auto mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Stipend Internships</h1>
        <p className="text-slate-500 mt-1">View stipend submissions for your posted internships</p>
      </div>

      <div className="max-w-5xl mx-auto">

        {/* List search bar */}
        <div className="relative mb-4">
          <input
            type="text"
            placeholder="Search by title, company, or location..."
            value={listSearch}
            onChange={(e) => setListSearch(e.target.value)}
            className="w-full pl-4 pr-8 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white"
          />
          {listSearch && (
            <button
              onClick={() => setListSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-lg leading-none"
            >
              ×
            </button>
          )}
        </div>

        {/* Result count — uses server total */}
        {!loading && (
          <p className="text-xs text-slate-400 mb-4">
            {listTotal} stipend internship{listTotal !== 1 ? "s" : ""}
            {debouncedSearch && (
              <> matching <em className="text-slate-600">"{debouncedSearch}"</em></>
            )}
          </p>
        )}

        {/* Loading */}
        {loading ? (
          <div className="flex justify-center py-16">
            <ClipLoader size={36} color="#14b8a6" />
          </div>
        ) : (
          <>
            {/* Empty state */}
            {internships.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                <p className="text-sm font-medium text-slate-500">
                  {!debouncedSearch
                    ? "No approved stipend internships found."
                    : `No internships match "${debouncedSearch}".`}
                </p>
                <p className="text-xs text-slate-300 mt-1">
                  {!debouncedSearch
                    ? "Stipend internships appear here once approved by admin."
                    : "Try adjusting your search."}
                </p>
              </div>
            )}

            {/* Internship Cards */}
            <div className="space-y-4">
              {internships.map((internship) => (
                <div
                  key={internship._id}
                  className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col sm:flex-row gap-5 hover:shadow-md hover:border-teal-100 transition-all duration-200"
                >
                  {internship.imgUrl && (
                    <img
                      src={internship.imgUrl}
                      alt={internship.jobTitle}
                      className="w-20 h-20 rounded-lg object-contain bg-slate-100 flex-shrink-0"
                    />
                  )}
                  <div className="flex-1">
                    <h3 className="text-lg font-medium text-slate-900">{internship.jobTitle}</h3>
                    <p className="text-sm text-slate-600 mt-0.5">{internship.companyName}</p>
                    <p className="text-sm text-slate-500 mt-1">
                      {internship.location} •{" "}
                      {formatDateRange(internship.startDate, internship.endDateOrDuration)}
                    </p>
                    <p className="text-sm text-teal-700 font-medium mt-2">
                      Stipend:{" "}
                      {internship.compensationDetails?.amount
                        ? `${internship.compensationDetails.amount} ${internship.compensationDetails.currency}`
                        : "N/A"}
                    </p>
                    <div className="flex flex-wrap gap-2 mt-3">
                      {internship.qualifications?.map((q, i) => (
                        <span key={i} className="text-xs bg-slate-100 px-3 py-1 rounded-full text-slate-600">
                          {q}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-start sm:items-center flex-shrink-0">
                    <button
                      onClick={() => openStipends(internship)}
                      className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition active:scale-95"
                    >
                      View Stipends
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* List Pagination */}
            {listTotalPages > 1 && (
              <div className="flex justify-between items-center mt-6">
                <button
                  disabled={listPage === 1}
                  onClick={() => setListPage((p) => p - 1)}
                  className="px-4 py-2 rounded-lg bg-white border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 disabled:opacity-40 transition"
                >
                  Previous
                </button>
                <span className="text-sm text-slate-500">
                  Page {listPage} of {listTotalPages}
                </span>
                <button
                  disabled={listPage === listTotalPages}
                  onClick={() => setListPage((p) => p + 1)}
                  className="px-4 py-2 rounded-lg bg-white border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 disabled:opacity-40 transition"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Modal ──────────────────────────────────────────────────────────── */}
      <Modal
        isOpen={modalIsOpen}
        onRequestClose={closeModal}
        overlayClassName="fixed inset-0 bg-black/60 z-50 flex items-center justify-center"
        className="bg-white rounded-2xl max-w-6xl w-full mx-4 outline-none shadow-2xl flex flex-col"
        style={{ content: { maxHeight: "90vh" } }}
      >
        {/* Modal Header */}
        <div className="flex-shrink-0 flex justify-between px-8 pt-8 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">{selectedInternship?.jobTitle}</h2>
            <p className="text-sm text-slate-500 mt-0.5">{selectedInternship?.companyName}</p>
          </div>
          <button onClick={closeModal} className="text-slate-400 hover:text-slate-700 text-xl leading-none">✕</button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 min-h-0 overflow-y-auto px-8 py-6">

          {/* KPI Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="bg-slate-50 border rounded-lg p-4">
              <p className="text-sm text-slate-500">Submissions</p>
              <p className="text-2xl font-semibold">{stipends.length}</p>
            </div>
            <div className="bg-slate-50 border rounded-lg p-4">
              <p className="text-sm text-slate-500">Stipend Amount</p>
              <p className="text-lg font-medium text-teal-700">
                {selectedInternship?.compensationDetails?.amount
                  ? `${selectedInternship.compensationDetails.amount} ${selectedInternship.compensationDetails.currency}`
                  : "N/A"}
              </p>
            </div>
            <CSVLink
              data={filtered}
              filename={`stipends-${selectedInternship?.jobTitle}.csv`}
              className="flex items-center justify-center bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-medium text-sm transition"
            >
              Export CSV
            </CSVLink>
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-red-500 mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              {error}
            </p>
          )}

          {/* Modal Search */}
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search account name, IFSC, number"
            className="w-full mb-4 px-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none"
          />

          {/* Table */}
          {loadingStipends ? (
            <div className="flex justify-center py-20">
              <ClipLoader size={32} color="#14b8a6" />
            </div>
          ) : stipends.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <p className="text-sm font-medium">No stipend submissions yet.</p>
              <p className="text-xs text-slate-300 mt-1">
                Submissions will appear here once students submit their bank details.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-100 rounded-xl">
              <table className="w-full text-sm">
                <thead className="bg-slate-100 text-slate-600">
                  <tr>
                    <th className="px-5 py-3 text-left">Account Name</th>
                    <th className="px-5 py-3 text-left">Account</th>
                    <th className="px-5 py-3 text-left">IFSC</th>
                    <th className="px-5 py-3 text-left">Currency</th>
                    <th className="px-5 py-3 text-left">Submitted</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {pageData.map((s) => (
                    <tr key={s._id} className="hover:bg-slate-50 transition">
                      <td className="px-5 py-3 font-medium">{s.bankAccountName}</td>
                      <td className="px-5 py-3 font-mono">****{s.bankAccountNumber?.slice(-4)}</td>
                      <td className="px-5 py-3">{s.ifscOrSwift}</td>
                      <td className="px-5 py-3">{s.preferredCurrency}</td>
                      <td className="px-5 py-3 text-slate-500">
                        {new Date(s.submittedAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal Footer — Pagination */}
        {!loadingStipends && totalPages > 1 && (
          <div className="flex-shrink-0 flex justify-between items-center px-8 py-4 border-t border-slate-100 bg-white rounded-b-2xl">
            <button
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
              className="px-4 py-2 rounded-md bg-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-300 disabled:opacity-40 transition"
            >
              Previous
            </button>
            <span className="text-sm text-slate-500">Page {page} of {totalPages}</span>
            <button
              disabled={page === totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="px-4 py-2 rounded-md bg-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-300 disabled:opacity-40 transition"
            >
              Next
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default StipendDetails;