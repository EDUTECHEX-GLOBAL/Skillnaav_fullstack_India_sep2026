// InternshipPayments.jsx
import React, { useEffect, useState } from "react";
import axios from "../../../../api/axiosInstance";
import { motion, AnimatePresence } from "framer-motion";
import {
  AiOutlineSearch,
  AiOutlineClose,
  AiOutlineLeft,
  AiOutlineRight,
} from "react-icons/ai";
import { HiOutlineCurrencyDollar } from "react-icons/hi";
import UserCard from "./UserCard";
import InternshipPaymentCard from "./InternshipPaymentCard";

const PAGE_SIZE = 6; // cards per page — tweak as needed

const InternshipPayments = () => {
  const [internships, setInternships] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPayments, setSelectedPayments] = useState([]);
  const [selectedInternship, setSelectedInternship] = useState(null);
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [userLoading, setUserLoading] = useState(false);

  // ── Pagination state ────────────────────────────────────────────────────────
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const fetchInternshipsWithPayments = async () => {
      try {
        const { data } = await axios.get("/api/interns");
        const paidInternships = data.filter(
          (i) =>
            i.internshipType === "PAID" ||
            i?.compensationDetails?.type === "PAID",
        );
        const enrichedInternships = await Promise.all(
          paidInternships.map(async (i) => {
            try {
              const res = await axios.get(
                `/api/internship/payments/admin/internship/${i._id}`,
              );
              return {
                ...i,
                paymentSummary: res.data?.data || {
                  totalPayments: 0,
                  totalAmount: 0,
                },
              };
            } catch {
              return {
                ...i,
                paymentSummary: { totalPayments: 0, totalAmount: 0 },
              };
            }
          }),
        );
        setInternships(enrichedInternships);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchInternshipsWithPayments();
  }, []);

  // Reset to page 1 whenever the internship list changes
  useEffect(() => {
    setCurrentPage(1);
  }, [internships]);

  const handleViewPayments = async (internship) => {
    try {
      const res = await axios.get(
        `/api/internship/payments/${internship._id}/payments`,
      );
      setSelectedPayments(res.data.payments || []);
      setSelectedInternship(internship);
      setSearch("");
    } catch (err) {
      console.error("Error fetching payment list:", err);
      setSelectedPayments([]);
      setSelectedInternship(internship);
    }
  };

  const handleViewUser = async (studentIdObj) => {
    try {
      setUserLoading(true);
      const res = await axios.get(`/api/users/${studentIdObj._id}`);
      setSelectedUser(res.data);
    } catch (err) {
      console.error("Error fetching user profile:", err);
      setSelectedUser(studentIdObj);
    } finally {
      setUserLoading(false);
    }
  };

  const filteredPayments = selectedPayments.filter(
    (p) =>
      p.studentId?.name?.toLowerCase().includes(search.toLowerCase()) ||
      p.studentId?.email?.toLowerCase().includes(search.toLowerCase()),
  );

  const totalRevenue = internships.reduce(
    (acc, i) => acc + (i.paymentSummary?.totalAmount || 0),
    0,
  );
  const totalStudents = internships.reduce(
    (acc, i) => acc + (i.paymentSummary?.totalPayments || 0),
    0,
  );

  // ── Pagination calculations ─────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(internships.length / PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * PAGE_SIZE;
  const pagedInternships = internships.slice(
    startIndex,
    startIndex + PAGE_SIZE,
  );

  const goToPage = (page) => {
    setCurrentPage(Math.min(Math.max(1, page), totalPages));
  };

  const getPaginationItems = () => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    if (safeCurrentPage <= 4) {
      return [1, 2, 3, 4, 5, "ellipsis-right", totalPages];
    }

    if (safeCurrentPage >= totalPages - 3) {
      return [
        1,
        "ellipsis-left",
        totalPages - 4,
        totalPages - 3,
        totalPages - 2,
        totalPages - 1,
        totalPages,
      ];
    }

    return [
      1,
      "ellipsis-left",
      safeCurrentPage - 1,
      safeCurrentPage,
      safeCurrentPage + 1,
      "ellipsis-right",
      totalPages,
    ];
  };

  const nextPage = () => goToPage(safeCurrentPage + 1);
  const prevPage = () => goToPage(safeCurrentPage - 1);

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-gray-200 border-t-emerald-600 rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Loading programs…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Page header */}
        <div className="flex items-center gap-3 mb-7">
          <div className="w-9 h-9 bg-emerald-700 rounded-lg flex items-center justify-center flex-shrink-0">
            <HiOutlineCurrencyDollar className="text-white text-lg" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-900 leading-tight">
              Paid Internships
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              {internships.length} programs · payment overview
            </p>
          </div>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-3 gap-3 mb-7">
          {[
            {
              label: "Programs",
              value: internships.length,
              color: "text-gray-900",
            },
            {
              label: "Total Disbursed",
              value: `$${totalRevenue.toLocaleString()}`,
              color: "text-emerald-700 break-words", // Add the "break-words" for revenue alignment in mobile view - 06-08-2026
            },
            {
              label: "Students Paid",
              value: totalStudents,
              color: "text-gray-900",
            },
          ].map(({ label, value, color }) => (
            <div
              key={label}
              className="bg-white border border-gray-200 rounded-lg p-4"
            >
              <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1.5">
                {label}
              </p>
              <p className={`text-xl font-semibold ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Cards grid — paginated */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {pagedInternships.map((internship, index) => (
            <motion.div
              key={internship._id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04 }}
            >
              <InternshipPaymentCard
                internship={internship}
                onViewPayments={handleViewPayments}
              />
            </motion.div>
          ))}
        </div>

        {/* ── Pagination controls ───────────────────────────────────────────── */}
        {totalPages > 1 && (
          <div className="mt-6 flex justify-center">
            <div className="inline-flex w-full sm:w-auto items-center justify-center gap-1.5 rounded-2xl border border-slate-200/80 bg-white/95 p-1.5 shadow-[0_14px_30px_-18px_rgba(15,23,42,0.35)]">
              <button
                onClick={prevPage}
                disabled={safeCurrentPage === 1}
                className={`inline-flex h-10 items-center justify-center gap-2 rounded-xl border px-3 sm:px-4 text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200 ${
                  safeCurrentPage === 1
                    ? "border-transparent bg-slate-50 text-slate-400 cursor-not-allowed"
                    : "border-transparent bg-slate-50 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700"
                }`}
                aria-label="Go to previous page"
              >
                <AiOutlineLeft size={16} />
                <span className="hidden sm:inline">Previous</span>
              </button>

              <div className="hidden sm:flex items-center gap-1">
                {getPaginationItems().map((item, index) => {
                  if (typeof item !== "number") {
                    return (
                      <span
                        key={`${item}-${index}`}
                        className="flex h-10 min-w-[2.25rem] items-center justify-center rounded-xl bg-slate-50 px-2 text-sm font-medium text-slate-400"
                      >
                        ...
                      </span>
                    );
                  }

                  return (
                    <button
                      key={item}
                      onClick={() => goToPage(item)}
                      className={`flex h-10 min-w-[2.5rem] items-center justify-center rounded-xl px-3 text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200 ${
                        safeCurrentPage === item
                          ? "bg-emerald-600 text-white shadow-[0_10px_18px_-12px_rgba(5,150,105,0.85)]"
                          : "bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                      }`}
                      aria-label={`Go to page ${item}`}
                      aria-current={
                        safeCurrentPage === item ? "page" : undefined
                      }
                    >
                      {item}
                    </button>
                  );
                })}
              </div>

              <div className="flex h-10 min-w-[4.75rem] items-center justify-center rounded-xl bg-slate-50 px-4 text-sm font-semibold text-slate-700 sm:hidden">
                {safeCurrentPage} / {totalPages}
              </div>

              <button
                onClick={nextPage}
                disabled={safeCurrentPage === totalPages}
                className={`inline-flex h-10 items-center justify-center gap-2 rounded-xl border px-3 sm:px-4 text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200 ${
                  safeCurrentPage === totalPages
                    ? "border-transparent bg-slate-50 text-slate-400 cursor-not-allowed"
                    : "border-transparent bg-slate-50 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700"
                }`}
                aria-label="Go to next page"
              >
                <span className="hidden sm:inline">Next</span>
                <AiOutlineRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Payments Modal ───────────────────────────────────────────────────── */}
      <AnimatePresence>
        {selectedInternship && (
          <div
            className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
            onClick={() => setSelectedInternship(null)}
          >
            <motion.div
              className="bg-white rounded-xl border border-gray-200 shadow-xl w-full max-w-lg max-h-[88vh] flex flex-col overflow-hidden"
              initial={{ opacity: 0, scale: 0.97, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 10 }}
              transition={{ duration: 0.15 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Accent */}
              <div className="h-0.5 w-full bg-emerald-600 flex-shrink-0" />

              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3.5 border-b border-gray-200 flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-emerald-700 rounded-lg flex items-center justify-center flex-shrink-0">
                    <HiOutlineCurrencyDollar className="text-white text-sm" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 leading-tight">
                      {selectedInternship.jobTitle}
                    </p>
                    <p className="text-xs text-gray-500">
                      {selectedInternship.companyName}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedInternship(null)}
                  className="w-7 h-7 flex items-center justify-center border border-gray-200 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition"
                >
                  <AiOutlineClose size={14} />
                </button>
              </div>

              {/* Stats bar */}
              <div className="grid grid-cols-3 divide-x divide-gray-100 border-b border-gray-200 flex-shrink-0">
                {[
                  {
                    label: "Students",
                    value:
                      selectedInternship.paymentSummary?.totalPayments || 0,
                    cls: "text-gray-900",
                  },
                  {
                    label: "Total paid",
                    value: `$${(selectedInternship.paymentSummary?.totalAmount || 0).toLocaleString()}`,
                    cls: "text-emerald-700",
                  },
                  {
                    label: "Showing",
                    value: filteredPayments.length,
                    cls: "text-gray-900",
                  },
                ].map(({ label, value, cls }) => (
                  <div key={label} className="px-4 py-2.5">
                    <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1">
                      {label}
                    </p>
                    <p className={`text-sm font-semibold ${cls}`}>{value}</p>
                  </div>
                ))}
              </div>

              {/* Search */}
              <div className="px-4 py-2.5 border-b border-gray-100 flex-shrink-0">
                <div className="relative">
                  <AiOutlineSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
                  {/*Add the "!mt-0" for alignment - 06-08-2026 */}
                  <input
                    type="text"
                    placeholder="Search by name or email…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="!mt-0 w-full pl-8 pr-3 py-2 text-xs border border-gray-200 rounded-lg bg-gray-50 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition"
                  />
                </div>
              </div>

              {/* List */}
              <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
                {filteredPayments.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                    <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center mb-3">
                      <AiOutlineSearch className="text-gray-400 text-lg" />
                    </div>
                    <p className="text-sm font-medium text-gray-600">
                      {search ? "No results found" : "No payments yet"}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {search
                        ? "Try a different search term"
                        : "Payments will appear here once processed"}
                    </p>
                  </div>
                ) : (
                  filteredPayments.map((p, index) => {
                    const initial =
                      p.studentId?.name?.charAt(0)?.toUpperCase() || "U";
                    const colors = [
                      "bg-emerald-600",
                      "bg-teal-600",
                      "bg-violet-600",
                      "bg-blue-600",
                      "bg-orange-500",
                    ];
                    const color = colors[index % colors.length];
                    return (
                      <motion.div
                        key={p._id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: index * 0.03 }}
                        onClick={() => handleViewUser(p.studentId)}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer group transition-colors"
                      >
                        <div
                          className={`w-8 h-8 rounded-lg ${color} flex items-center justify-center text-white text-xs font-medium flex-shrink-0`}
                        >
                          {initial}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-900 truncate group-hover:text-emerald-700 transition-colors">
                            {p.studentId?.name}
                          </p>
                          <p className="text-[11px] text-gray-500 truncate">
                            {p.studentId?.email}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-xs font-semibold text-gray-900">
                            ${p.amount.toLocaleString()}
                          </p>
                          <p className="text-[10px] text-gray-400 mt-0.5">
                            {new Date(p.completedAt).toLocaleDateString(
                              "en-US",
                              {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              },
                            )}
                          </p>
                        </div>
                        <span
                          className={`flex-shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded border ${
                            p.status === "COMPLETED"
                              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                              : "bg-red-50 text-red-800 border-red-200"
                          }`}
                        >
                          {p.status}
                        </span>
                      </motion.div>
                    );
                  })
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── User loading ─────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {userLoading && (
          <div className="fixed inset-0 z-[80] bg-black/50 flex items-center justify-center">
            <div className="bg-white rounded-xl border border-gray-200 px-8 py-6 flex flex-col items-center gap-3 shadow-xl">
              <div className="w-7 h-7 border-2 border-gray-200 border-t-emerald-600 rounded-full animate-spin" />
              <p className="text-sm text-gray-500">Loading profile…</p>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* ── User profile modal ───────────────────────────────────────────────── */}
      {selectedUser && !userLoading && (
        <div
          className="fixed inset-0 z-[80] bg-black/50 flex items-center justify-center p-6"
          onClick={() => setSelectedUser(null)}
        >
          <div onClick={(e) => e.stopPropagation()}>
            <UserCard
              user={selectedUser}
              onClose={() => setSelectedUser(null)}
              onApprove={(id) => console.log("Approve", id)}
              onReject={(id) => console.log("Reject", id)}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default InternshipPayments;
