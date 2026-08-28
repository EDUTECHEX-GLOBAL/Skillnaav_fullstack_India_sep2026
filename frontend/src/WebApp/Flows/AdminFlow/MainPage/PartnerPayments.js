import React, {
  useEffect,
  useState,
  useRef,
  useCallback,
  useMemo,
} from "react";
import {
  HiOutlineChevronLeft,
  HiOutlineChevronRight as HiOutlineChevronRightPag,
} from "react-icons/hi";
import axios from "../../../../api/axiosInstance";
import { motion, AnimatePresence } from "framer-motion";
import {
  HiOutlineSearch,
  HiOutlineOfficeBuilding,
  HiOutlineMail,
  HiOutlineCurrencyRupee,
  HiOutlineUsers,
  HiOutlineChevronRight,
  HiOutlineX,
  HiOutlineRefresh,
} from "react-icons/hi";
import { AiOutlineBank } from "react-icons/ai";

// ── Constants ─────────────────────────────────────────────────────────────────
const AVATAR_COLORS = [
  "bg-emerald-600",
  "bg-teal-600",
  "bg-violet-600",
  "bg-blue-600",
  "bg-orange-500",
  "bg-rose-600",
  "bg-cyan-600",
];
const PAGE_SIZE = 20; // partners per page

// ── Helpers ───────────────────────────────────────────────────────────────────
const getAvatarColor = (name = "") => {
  let hash = 0;
  for (let i = 0; i < name.length; i++)
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

const useDebounce = (value, delay = 300) => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
};

// ── Sub-components ────────────────────────────────────────────────────────────
const SkeletonCard = () => (
  <div className="bg-white border border-gray-200 rounded-xl p-4 animate-pulse">
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-gray-200 flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3 bg-gray-200 rounded w-2/3" />
        <div className="h-2.5 bg-gray-100 rounded w-1/2" />
        <div className="h-2 bg-gray-100 rounded w-1/3" />
      </div>
    </div>
  </div>
);

const StatTile = ({ label, value, icon: Icon, accent, loading }) => (
  <div className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col gap-3">
    <div
      className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${accent}`}
    >
      <Icon className="text-white text-base" />
    </div>
    <div>
      <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1">
        {label}
      </p>
      {loading ? (
        <div className="h-7 w-24 bg-gray-200 rounded animate-pulse" />
      ) : (
        <p className="text-2xl font-semibold text-gray-900">{value}</p>
      )}
    </div>
  </div>
);

// Memoized so re-renders from parent state don't repaint all 100+ rows
const PartnerItem = React.memo(({ partner, isSelected, onClick }) => {
  const initial = (partner.name || "P").charAt(0).toUpperCase();
  const avatarBg = getAvatarColor(partner.name);
  return (
    <div
      onClick={onClick}
      className={`group flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-all duration-150 ${
        isSelected
          ? "bg-emerald-50 border-emerald-300 shadow-sm"
          : "bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm"
      }`}
    >
      <div
        className={`w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-semibold flex-shrink-0 ${avatarBg}`}
      >
        {initial}
      </div>
      <div className="flex-1 min-w-0">
        <p
          className={`text-sm font-medium truncate ${isSelected ? "text-emerald-900" : "text-gray-900"}`}
        >
          {partner.name}
        </p>
        <p className="text-[11px] text-gray-500 truncate">{partner.email}</p>
        {partner.universityName && (
          <p className="text-[10px] text-gray-400 truncate mt-0.5">
            {partner.universityName}
          </p>
        )}
      </div>
      <HiOutlineChevronRight
        className={`flex-shrink-0 text-base transition-colors ${
          isSelected
            ? "text-emerald-600"
            : "text-gray-300 group-hover:text-gray-400"
        }`}
      />
    </div>
  );
});

// ── Main component ────────────────────────────────────────────────────────────
const PartnerPayments = () => {
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [selectedPartner, setSelectedPartner] = useState(null);
  const [paymentSummary, setPaymentSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);

  const listRef = useRef(null);
  const debouncedSearch = useDebounce(search, 300);

  // ── Fetch all partners once ──────────────────────────────────────────────────
  const fetchPartners = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await axios.get("/api/partners/partners");
      setPartners(data);
    } catch (err) {
      setError(err.message || "Failed to fetch partners");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPartners();
  }, [fetchPartners]);

  // ── Reset to page 1 on search change ────────────────────────────────────────
  useEffect(() => {
    setCurrentPage(1);
    if (listRef.current) listRef.current.scrollTop = 0;
  }, [debouncedSearch]);

  // ── Memoized filter + slice ──────────────────────────────────────────────────
  const filteredPartners = useMemo(() => {
    const q = debouncedSearch.toLowerCase();
    if (!q) return partners;
    return partners.filter(
      (p) =>
        p.name?.toLowerCase().includes(q) ||
        p.email?.toLowerCase().includes(q) ||
        p.universityName?.toLowerCase().includes(q),
    );
  }, [partners, debouncedSearch]);

  const totalPages = Math.ceil(filteredPartners.length / PAGE_SIZE);

  const visiblePartners = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredPartners.slice(start, start + PAGE_SIZE);
  }, [filteredPartners, currentPage]);

  const handlePageChange = (page) => {
    setCurrentPage(page);
    if (listRef.current) listRef.current.scrollTop = 0;
  };

  // ── Fetch summary for selected partner ───────────────────────────────────────
  const fetchPartnerPayments = async (partner) => {
    // Already selected — just re-open mobile sheet
    if (selectedPartner?._id === partner._id) {
      setMobileDetailOpen(true);
      return;
    }
    setSelectedPartner(partner);
    setMobileDetailOpen(true);
    setSummaryLoading(true);
    setPaymentSummary(null);
    try {
      const { data } = await axios.get(
        `/api/internship/payments/admin/partner/${partner._id}`,
      );
      setPaymentSummary(data.data);
    } catch (err) {
      console.error(err);
      setPaymentSummary({ totalPayments: 0, totalAmount: 0 });
    } finally {
      setSummaryLoading(false);
    }
  };

  // ── Shared summary content (desktop panel + mobile sheet) ────────────────────
  const SummaryContent = () =>
    !selectedPartner ? null : (
      <>
        <div className="flex items-center gap-4 p-5 border-b border-gray-100">
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center text-white text-lg font-semibold flex-shrink-0 ${getAvatarColor(
              selectedPartner.name,
            )}`}
          >
            {(selectedPartner.name || "P").charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-gray-900 truncate">
              {selectedPartner.name}
            </h2>
            <p className="text-xs text-gray-500 truncate flex items-center gap-1 mt-0.5">
              <HiOutlineMail className="flex-shrink-0" />
              {selectedPartner.email}
            </p>
            {selectedPartner.universityName && (
              <p className="text-[11px] text-gray-400 truncate flex items-center gap-1 mt-0.5">
                <HiOutlineOfficeBuilding className="flex-shrink-0" />
                {selectedPartner.universityName}
              </p>
            )}
          </div>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-2 gap-4">
            <StatTile
              label="Total Payments"
              value={paymentSummary?.totalPayments?.toLocaleString() || "0"}
              icon={HiOutlineUsers}
              accent="bg-blue-600"
              loading={summaryLoading}
            />
            <StatTile
              label="Total Amount"
              value={`₹${(paymentSummary?.totalAmount || 0).toLocaleString()}`}
              icon={HiOutlineCurrencyRupee}
              accent="bg-emerald-600"
              loading={summaryLoading}
            />
          </div>
        </div>
      </>
    );

  // ── Page-level loading skeleton ──────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
          <div className="flex items-center gap-3 mb-7 animate-pulse">
            <div className="w-9 h-9 bg-gray-200 rounded-lg" />
            <div className="space-y-1.5">
              <div className="h-4 w-36 bg-gray-200 rounded" />
              <div className="h-3 w-24 bg-gray-100 rounded" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-7">
            <div className="h-20 bg-gray-200 rounded-lg animate-pulse" />
            <div className="h-20 bg-gray-200 rounded-lg animate-pulse" />
          </div>
          <div className="h-10 bg-gray-200 rounded-xl mb-5 animate-pulse" />
          <div className="grid gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {/* Page header */}
        <div className="flex items-center justify-between mb-7">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-emerald-700 rounded-lg flex items-center justify-center flex-shrink-0">
              <AiOutlineBank className="text-white text-lg" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-900 leading-tight">
                Partner Payments
              </h1>
              <p className="text-xs text-gray-500 mt-0.5">
                {partners.length} partners · payment overview
              </p>
            </div>
          </div>
          <button
            onClick={fetchPartners}
            className="w-8 h-8 flex items-center justify-center border border-gray-200 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition"
            title="Refresh"
          >
            <HiOutlineRefresh className="text-sm" />
          </button>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-2 gap-3 mb-7">
          {[
            {
              label: "Total Partners",
              value: partners.length,
              color: "text-gray-900",
            },
            {
              label: "Filtered Results",
              value: filteredPartners.length,
              color: "text-emerald-700",
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

        {/* Search */}
        <div className="relative mb-3">
          <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
          {/*Add the "!mt-0" for alignment - 06-08-2026 */}
          <input
            type="text"
            name="payment_search_query"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoComplete="on"
            className="!mt-0 w-full pl-9 pr-9 py-2.5 text-sm border border-gray-200 rounded-xl bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition truncate"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
            >
              <HiOutlineX className="text-sm" />
            </button>
          )}
        </div>

        {/* Search result label */}
        {debouncedSearch && (
          <p className="text-xs text-gray-500 mb-4">
            <span className="font-medium text-gray-700">
              {filteredPartners.length}
            </span>{" "}
            result
            {filteredPartners.length !== 1 ? "s" : ""} for{" "}
            <span className="font-medium text-gray-700">
              "{debouncedSearch}"
            </span>
          </p>
        )}
        {!debouncedSearch && <div className="mb-4" />}

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          {/* ── Partner list ─────────────────────────────────────────────────── */}
          <div className="lg:col-span-2">
            {error ? (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 flex items-center justify-between gap-3">
                <span>{error}</span>
                <button
                  onClick={fetchPartners}
                  className="text-xs font-medium underline hover:no-underline"
                >
                  Retry
                </button>
              </div>
            ) : filteredPartners.length === 0 ? (
              <div className="bg-white border border-gray-200 rounded-xl px-4 py-10 text-center">
                <p className="text-sm text-gray-500">No partners found</p>
                <p className="text-xs text-gray-400 mt-1">
                  Try adjusting your search
                </p>
              </div>
            ) : (
              <>
                {/* Page info */}
                {filteredPartners.length > PAGE_SIZE && (
                  <p className="text-[10px] text-gray-400 mb-2 text-right pr-1">
                    Page {currentPage} of {totalPages} ·{" "}
                    {filteredPartners.length} partners
                  </p>
                )}

                <div
                  ref={listRef}
                  className="space-y-2.5 overflow-y-auto pr-0.5 scroll-smooth"
                  style={{
                    maxHeight: "70vh",
                    scrollbarWidth: "thin",
                    scrollbarColor: "#d1d5db transparent",
                  }}
                >
                  {visiblePartners.map((partner) => (
                    <PartnerItem
                      key={partner._id}
                      partner={partner}
                      isSelected={selectedPartner?._id === partner._id}
                      onClick={() => fetchPartnerPayments(partner)}
                    />
                  ))}
                </div>

                {/* Pagination controls */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
                    <button
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                    >
                      <HiOutlineChevronLeft className="text-sm" />
                      Prev
                    </button>

                    <div className="flex items-center gap-1">
                      {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter(
                          (p) =>
                            p === 1 ||
                            p === totalPages ||
                            Math.abs(p - currentPage) <= 1,
                        )
                        .reduce((acc, p, idx, arr) => {
                          if (idx > 0 && p - arr[idx - 1] > 1) {
                            acc.push("...");
                          }
                          acc.push(p);
                          return acc;
                        }, [])
                        .map((p, idx) =>
                          p === "..." ? (
                            <span
                              key={`ellipsis-${idx}`}
                              className="px-1 text-xs text-gray-400"
                            >
                              …
                            </span>
                          ) : (
                            <button
                              key={p}
                              onClick={() => handlePageChange(p)}
                              className={`w-7 h-7 text-xs font-medium rounded-lg transition ${
                                p === currentPage
                                  ? "bg-emerald-600 text-white"
                                  : "border border-gray-200 text-gray-600 hover:bg-gray-50"
                              }`}
                            >
                              {p}
                            </button>
                          ),
                        )}
                    </div>

                    <button
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                    >
                      Next
                      <HiOutlineChevronRightPag className="text-sm" />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* ── Summary panel — Desktop ───────────────────────────────────────── */}
          <div className="hidden lg:block lg:col-span-3">
            <AnimatePresence mode="wait">
              {selectedPartner ? (
                <motion.div
                  key={selectedPartner._id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.18 }}
                  className="bg-white border border-gray-200 rounded-xl overflow-hidden"
                >
                  <div className="h-0.5 w-full bg-emerald-600" />
                  <SummaryContent />
                </motion.div>
              ) : (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="min-h-[300px] flex flex-col items-center justify-center bg-white border border-dashed border-gray-300 rounded-xl text-center px-6 py-16 gap-3"
                >
                  <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mb-1">
                    <AiOutlineBank className="text-gray-400 text-xl" />
                  </div>
                  <p className="text-sm font-medium text-gray-500">
                    Select a partner
                  </p>
                  <p className="text-xs text-gray-400">
                    Click any partner to view their payment summary
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* ── Mobile bottom sheet ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {mobileDetailOpen && selectedPartner && (
          <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end">
            <motion.div
              className="absolute inset-0 bg-black/40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileDetailOpen(false)}
            />
            <motion.div
              className="relative bg-white rounded-t-2xl overflow-hidden shadow-2xl"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
            >
              {/* Drag handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-gray-300" />
              </div>
              <div className="flex items-center justify-between px-5 pt-2 pb-0">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Payment Summary
                </span>
                <button
                  onClick={() => setMobileDetailOpen(false)}
                  className="w-8 h-8 flex items-center justify-center border border-gray-200 rounded-lg text-gray-400 hover:text-gray-600"
                >
                  <HiOutlineX size={14} />
                </button>
              </div>
              <div className="h-0.5 w-full bg-emerald-600 mt-3" />
              <SummaryContent />
              <div className="h-8" /> {/* iOS safe area */}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PartnerPayments;
