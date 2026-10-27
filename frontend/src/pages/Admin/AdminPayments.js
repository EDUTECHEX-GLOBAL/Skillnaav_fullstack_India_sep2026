import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import {
  FaFileExcel,
  FaFilter,
  FaUndo,
  FaChevronDown,
  FaCheck,
  FaRupeeSign,
  FaCheckCircle,
  FaClock,
  FaFileInvoiceDollar,
  FaDownload,
  FaSyncAlt,
} from "react-icons/fa";
import * as XLSX from "xlsx";
import axios from "../../api/axiosInstance";
import { initialPayments, initialStats } from "./mockAdminData";

const AdminPayments = () => {
  const [payments, setPayments] = useState(initialPayments);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(() =>
    new Date().toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
  );

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedType, setSelectedType] = useState("All");
  const [selectedStatus, setSelectedStatus] = useState("All");

  const [isTypeDropdownOpen, setIsTypeDropdownOpen] = useState(false);
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);

  const typeDropdownRef = useRef(null);
  const statusDropdownRef = useRef(null);

  // Fetch live payments from MongoDB database
  const fetchLivePayments = useCallback(async (isManual = false) => {
    if (isManual) setLoading(true);
    try {
      const res = await axios.get("/api/contact/payments");
      if (res.data?.payments && Array.isArray(res.data.payments) && res.data.payments.length > 0) {
        setPayments(res.data.payments);
        setLastUpdated(
          new Date().toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })
        );
      }
    } catch (err) {
      console.error("Failed to load live payments:", err);
    } finally {
      if (isManual) {
        setTimeout(() => setLoading(false), 350);
      }
    }
  }, []);

  // Initial load + real-time polling every 12 seconds
  useEffect(() => {
    fetchLivePayments(false);
    const interval = setInterval(() => {
      fetchLivePayments(false);
    }, 12000);
    return () => clearInterval(interval);
  }, [fetchLivePayments]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (typeDropdownRef.current && !typeDropdownRef.current.contains(e.target)) {
        setIsTypeDropdownOpen(false);
      }
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(e.target)) {
        setIsStatusDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const [appliedStart, setAppliedStart] = useState("");
  const [appliedEnd, setAppliedEnd] = useState("");
  const [appliedType, setAppliedType] = useState("All");
  const [appliedStatus, setAppliedStatus] = useState("All");

  const availableTypes = ["All", "Student", "Partner", "Internship", "Institution"];
  const availableStatuses = ["All", "Success", "Pending"];

  const handleFilter = () => {
    if (startDate && endDate && startDate > endDate) {
      alert("Start Date cannot be later than End Date.");
      return;
    }
    setIsTypeDropdownOpen(false);
    setIsStatusDropdownOpen(false);
    setAppliedStart(startDate);
    setAppliedEnd(endDate);
    setAppliedType(selectedType);
    setAppliedStatus(selectedStatus);
  };

  const handleReset = () => {
    setStartDate("");
    setEndDate("");
    setSelectedType("All");
    setSelectedStatus("All");
    setIsTypeDropdownOpen(false);
    setIsStatusDropdownOpen(false);
    setAppliedStart("");
    setAppliedEnd("");
    setAppliedType("All");
    setAppliedStatus("All");
  };

  // Filtered payments
  const filteredPayments = useMemo(() => {
    return payments.filter((item) => {
      if (appliedType !== "All" && item.type !== appliedType) {
        return false;
      }
      if (appliedStatus !== "All") {
        const isMatch =
          appliedStatus === "Pending"
            ? item.status === "Pending" || item.status === "CREATED"
            : item.status === appliedStatus;
        if (!isMatch) return false;
      }
      const d = item.rawDate;
      if (appliedStart && d && d < appliedStart) {
        return false;
      }
      if (appliedEnd && d && d > appliedEnd) {
        return false;
      }
      return true;
    });
  }, [payments, appliedType, appliedStatus, appliedStart, appliedEnd]);

  // Dynamic Metrics based on filtered items
  const statsMetrics = useMemo(() => {
    const totalCollected = filteredPayments
      .filter((p) => p.status === "Success")
      .reduce((sum, p) => sum + (p.amount || 0), 0);
    const successCount = filteredPayments.filter((p) => p.status === "Success").length;
    const pendingCount = filteredPayments.filter(
      (p) => p.status === "Pending" || p.status === "CREATED"
    ).length;
    const avgAmount = successCount > 0 ? Math.round(totalCollected / successCount) : 0;

    return { totalCollected, successCount, pendingCount, avgAmount };
  }, [filteredPayments]);

  const exportToExcel = () => {
    const exportData = filteredPayments.map((p, index) => ({
      "#": index + 1,
      "Order ID": p.orderId,
      "Payment ID": p.paymentId,
      "Customer Name": p.payerName,
      "Customer Email": p.payerEmail,
      "Account Type": p.type,
      Plan: p.plan,
      "Amount (INR)": p.amount,
      Status: p.status,
      Date: p.date,
      "Invoice URL": p.invoiceUrl || "N/A",
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Payments");
    XLSX.writeFile(wb, "Edutechex_Payments_Report.xlsx");
  };

  const getTypeBadge = (type) => {
    switch (type) {
      case "Partner":
        return "bg-purple-100 text-purple-800 border-purple-200";
      case "Student":
        return "bg-emerald-100 text-emerald-800 border-emerald-200";
      case "Internship":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "Institution":
        return "bg-indigo-100 text-indigo-800 border-indigo-200";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  return (
    <div className="space-y-6">
      {/* Title & Export / Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl md:text-2xl font-black text-slate-800 tracking-tight">
              PAYMENTS & TRANSACTIONS
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {appliedStart || appliedEnd || appliedType !== "All" || appliedStatus !== "All"
              ? `Filtered: Showing ${filteredPayments.length} of ${payments.length} transactions • Total: ₹${statsMetrics.totalCollected.toLocaleString()}`
              : `${payments.length} transactions recorded • Total Revenue: ₹${statsMetrics.totalCollected.toLocaleString()}`}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => fetchLivePayments(true)}
            disabled={loading}
            className="group inline-flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 hover:text-blue-600 border border-slate-200 hover:border-blue-300 rounded-xl text-xs font-semibold shadow-xs hover:shadow-sm transition-all duration-200 cursor-pointer disabled:opacity-50"
            title="Refresh payments from database"
          >
            <FaSyncAlt
              className={`text-xs text-slate-400 group-hover:text-blue-600 transition-colors duration-200 ${
                loading ? "animate-spin text-blue-600" : "group-hover:rotate-180 transition-transform duration-500"
              }`}
            />
            <span>{loading ? "Refreshing..." : "Refresh"}</span>
          </button>

          <button
            onClick={exportToExcel}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors cursor-pointer"
          >
            <FaFileExcel className="text-sm" />
            <span>Export to Excel</span>
          </button>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">
            <FaRupeeSign className="text-emerald-600" />
            <span>Total Collected</span>
          </div>
          <div className="text-2xl font-black text-slate-800">
            ₹{statsMetrics.totalCollected.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Verified platform payments</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">
            <FaCheckCircle className="text-blue-600" />
            <span>Successful Orders</span>
          </div>
          <div className="text-2xl font-black text-slate-800">
            {statsMetrics.successCount}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Completed transactions</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">
            <FaClock className="text-amber-500" />
            <span>Pending Orders</span>
          </div>
          <div className="text-2xl font-black text-slate-800">
            {statsMetrics.pendingCount}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Incomplete checkout sessions</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">
            <FaFileInvoiceDollar className="text-purple-600" />
            <span>Average Order Value</span>
          </div>
          <div className="text-2xl font-black text-slate-800">
            ₹{statsMetrics.avgAmount.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Per successful transaction</div>
        </div>
      </div>

      {/* Filter Row */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleFilter();
          }}
          className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end"
        >
          {/* Date Range */}
          <div className="md:col-span-5">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
              Date Range
            </label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                placeholder="Start date"
                className="w-full pl-3 pr-2 py-1.5 border border-slate-300 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-slate-400 text-xs">→</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                placeholder="End date"
                className="w-full pl-3 pr-2 py-1.5 border border-slate-300 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Account Type Custom Dropdown */}
          <div className="md:col-span-2 relative" ref={typeDropdownRef}>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
              Account Type
            </label>
            <button
              type="button"
              onClick={() => setIsTypeDropdownOpen((prev) => !prev)}
              className={`w-full flex items-center justify-between px-3 py-1.5 border rounded-lg text-xs bg-white text-slate-700 shadow-sm transition-all cursor-pointer focus:outline-none ${
                isTypeDropdownOpen
                  ? "border-blue-500 ring-2 ring-blue-500"
                  : "border-slate-300 hover:border-slate-400"
              }`}
            >
              <span className="font-medium truncate">{selectedType}</span>
              <FaChevronDown
                className={`text-[10px] text-slate-500 transition-transform duration-200 ${
                  isTypeDropdownOpen ? "transform rotate-180 text-blue-600" : ""
                }`}
              />
            </button>
            {isTypeDropdownOpen && (
              <div className="absolute top-full left-0 right-0 w-full mt-1.5 bg-white border border-slate-200 rounded-lg shadow-xl z-50 overflow-hidden py-1 max-h-56 overflow-y-auto">
                {availableTypes.map((t) => {
                  const isSelected = selectedType === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => {
                        setSelectedType(t);
                        setIsTypeDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-xs transition-colors flex items-center justify-between cursor-pointer ${
                        isSelected
                          ? "bg-blue-600 text-white font-semibold"
                          : "text-slate-700 hover:bg-blue-50 hover:text-blue-600"
                      }`}
                    >
                      <span className="truncate">{t}</span>
                      {isSelected && <FaCheck className="text-[10px] text-white flex-shrink-0 ml-2" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Status Custom Dropdown */}
          <div className="md:col-span-2 relative" ref={statusDropdownRef}>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
              Payment Status
            </label>
            <button
              type="button"
              onClick={() => setIsStatusDropdownOpen((prev) => !prev)}
              className={`w-full flex items-center justify-between px-3 py-1.5 border rounded-lg text-xs bg-white text-slate-700 shadow-sm transition-all cursor-pointer focus:outline-none ${
                isStatusDropdownOpen
                  ? "border-blue-500 ring-2 ring-blue-500"
                  : "border-slate-300 hover:border-slate-400"
              }`}
            >
              <span className="font-medium truncate">{selectedStatus}</span>
              <FaChevronDown
                className={`text-[10px] text-slate-500 transition-transform duration-200 ${
                  isStatusDropdownOpen ? "transform rotate-180 text-blue-600" : ""
                }`}
              />
            </button>
            {isStatusDropdownOpen && (
              <div className="absolute top-full left-0 right-0 w-full mt-1.5 bg-white border border-slate-200 rounded-lg shadow-xl z-50 overflow-hidden py-1">
                {availableStatuses.map((s) => {
                  const isSelected = selectedStatus === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => {
                        setSelectedStatus(s);
                        setIsStatusDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-xs transition-colors flex items-center justify-between cursor-pointer ${
                        isSelected
                          ? "bg-blue-600 text-white font-semibold"
                          : "text-slate-700 hover:bg-blue-50 hover:text-blue-600"
                      }`}
                    >
                      <span className="truncate">{s}</span>
                      {isSelected && <FaCheck className="text-[10px] text-white flex-shrink-0 ml-2" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Buttons */}
          <div className="md:col-span-3 flex items-center gap-2">
            <button
              type="submit"
              onClick={handleFilter}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-lg text-xs font-semibold shadow-sm transition-all cursor-pointer"
            >
              <FaFilter size={10} />
              <span>Filter</span>
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-white border border-slate-300 hover:bg-slate-50 active:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold shadow-sm transition-all cursor-pointer"
            >
              <FaUndo size={10} />
              <span>Reset</span>
            </button>
          </div>
        </form>
      </div>

      {/* Payments Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700 border-collapse">
            <thead className="bg-[#0284c7] text-white uppercase text-[11px] font-bold tracking-wider">
              <tr>
                <th className="py-3 px-3 w-10 text-center">#</th>
                <th className="py-3 px-3">Order / Payment ID</th>
                <th className="py-3 px-3">Customer / Organization</th>
                <th className="py-3 px-3">Type</th>
                <th className="py-3 px-3">Plan / Description</th>
                <th className="py-3 px-3">Amount</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3">Date</th>
                <th className="py-3 px-3 text-center">Invoice</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500">
                    <p className="font-semibold text-slate-700 text-sm">No transactions found</p>
                    <p className="text-xs text-slate-400 mt-1">
                      No payments match the selected date range or filter criteria.
                    </p>
                    <button
                      type="button"
                      onClick={handleReset}
                      className="mt-3 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
                    >
                      Reset Filter
                    </button>
                  </td>
                </tr>
              ) : (
                filteredPayments.map((p, index) => (
                  <tr key={p.id || index} className="hover:bg-sky-50/50 transition-colors">
                    <td className="py-3 px-3 font-semibold text-slate-500 text-center">
                      {index + 1}
                    </td>
                    <td className="py-3 px-3 font-mono">
                      <div className="font-bold text-slate-800 text-[11px]">{p.orderId}</div>
                      <div className="text-[10px] text-slate-400">{p.paymentId}</div>
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <div className="font-bold text-slate-800">{p.payerName}</div>
                      <a
                        href={`mailto:${p.payerEmail}`}
                        className="text-[11px] text-blue-600 hover:underline block"
                      >
                        {p.payerEmail}
                      </a>
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${getTypeBadge(
                          p.type
                        )}`}
                      >
                        {p.type}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-medium text-slate-700 whitespace-nowrap">
                      {p.plan}
                    </td>
                    <td className="py-3 px-3 font-black text-slate-900 whitespace-nowrap">
                      ₹{p.amount.toLocaleString()}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                          p.status === "Success"
                            ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                            : "bg-amber-100 text-amber-800 border-amber-200"
                        }`}
                      >
                        {p.status === "CREATED" ? "Pending" : p.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-500 whitespace-nowrap text-[11px]">
                      {p.date}
                    </td>
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      {p.invoiceUrl ? (
                        <a
                          href={p.invoiceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-blue-50 text-blue-600 hover:text-blue-700 border border-slate-200 hover:border-blue-300 rounded-md text-[11px] font-medium transition cursor-pointer"
                        >
                          <FaDownload size={10} />
                          <span>PDF</span>
                        </a>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminPayments;
