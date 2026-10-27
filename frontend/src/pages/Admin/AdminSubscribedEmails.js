import React, { useState, useEffect, useMemo, useCallback } from "react";
import { FaFileExcel, FaFilter, FaUndo, FaSyncAlt } from "react-icons/fa";
import * as XLSX from "xlsx";
import axios from "../../api/axiosInstance";
import { initialSubscribers } from "./mockAdminData";
import Pagination from "./Pagination";
import AdminDatePicker from "./AdminDatePicker";

const AdminSubscribedEmails = () => {
  const [subscribers, setSubscribers] = useState(initialSubscribers);
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [appliedStart, setAppliedStart] = useState("");
  const [appliedEnd, setAppliedEnd] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Fetch live subscribers from MongoDB
  const fetchLiveSubscribers = useCallback(async (isManual = false) => {
    if (isManual) setLoading(true);
    try {
      const res = await axios.get("/api/contact/subscribers");
      if (res.data?.subscribers && Array.isArray(res.data.subscribers) && res.data.subscribers.length > 0) {
        const formatted = res.data.subscribers.map((s, idx) => ({
          id: idx + 1,
          email: s.email,
          name: s.name || s.email.split("@")[0],
          role: s.role || "Student",
          subscribedOn: s.subscribedOn || "Recent",
          rawDate: s.rawDate || "",
        }));
        setSubscribers(formatted);
      }
    } catch (err) {
      console.error("Failed to load live subscribers:", err);
    } finally {
      if (isManual) {
        setTimeout(() => setLoading(false), 350);
      }
    }
  }, []);

  // Initial load + real-time polling every 12 seconds
  useEffect(() => {
    fetchLiveSubscribers(false);
    const interval = setInterval(() => {
      fetchLiveSubscribers(false);
    }, 12000);
    return () => clearInterval(interval);
  }, [fetchLiveSubscribers]);

  const handleFilter = () => {
    if (startDate && endDate && startDate > endDate) {
      alert("Start Date cannot be later than End Date.");
      return;
    }
    setAppliedStart(startDate);
    setAppliedEnd(endDate);
    setCurrentPage(1);
  };

  const handleReset = () => {
    setStartDate("");
    setEndDate("");
    setAppliedStart("");
    setAppliedEnd("");
    setCurrentPage(1);
  };

  const filteredSubscribers = useMemo(() => {
    return subscribers.filter((s) => {
      const d = s.rawDate || (s.subscribedOn ? new Date(s.subscribedOn).toISOString().slice(0, 10) : "");
      if (appliedStart && d && d < appliedStart) return false;
      if (appliedEnd && d && d > appliedEnd) return false;
      return true;
    });
  }, [subscribers, appliedStart, appliedEnd]);

  const paginatedSubscribers = useMemo(() => {
    const totalPages = Math.max(1, Math.ceil(filteredSubscribers.length / pageSize));
    const safePage = Math.min(Math.max(1, currentPage), totalPages);
    const start = (safePage - 1) * pageSize;
    return filteredSubscribers.slice(start, start + pageSize);
  }, [filteredSubscribers, currentPage, pageSize]);

  const exportToExcel = () => {
    const listToExport = filteredSubscribers.length > 0 ? filteredSubscribers : subscribers;
    const exportData = listToExport.map((s, index) => {
      return {
        "#": index + 1,
        Name: s.name || "—",
        Email: s.email,
        Type: s.role || "User",
        "Subscribed On": s.subscribedOn,
      };
    });
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Subscribers");
    XLSX.writeFile(wb, "Subscribed_Emails.xlsx");
  };

  return (
    <div className="space-y-6">
      {/* Header & Export / Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl md:text-2xl font-black text-slate-800 tracking-tight">
              SUBSCRIBED EMAILS
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {appliedStart || appliedEnd
              ? `Filtered: Showing ${filteredSubscribers.length} of ${subscribers.length} subscribers`
              : `${subscribers.length} subscribers found`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => fetchLiveSubscribers(true)}
            disabled={loading}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-3.5 py-2 bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 hover:text-blue-600 border border-slate-200 hover:border-blue-300 rounded-xl text-xs font-semibold shadow-xs hover:shadow-sm transition-all duration-200 cursor-pointer disabled:opacity-50"
            title="Refresh subscribers from database"
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
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors cursor-pointer"
          >
            <FaFileExcel className="text-sm" />
            <span>Export to Excel</span>
          </button>
        </div>
      </div>

      {/* Filter Row */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-4 shadow-sm">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleFilter();
          }}
          className="grid grid-cols-1 md:grid-cols-12 gap-3 sm:gap-4 items-end"
        >
          <div className="md:col-span-6">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
              Date Range
            </label>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <div className="relative flex-1 min-w-0">
                <span className="sm:hidden text-[10px] text-slate-400 font-medium block mb-0.5">Start Date</span>
                <AdminDatePicker
                  value={startDate}
                  onChange={setStartDate}
                  placeholder="Start date"
                />
              </div>
              <span className="hidden sm:inline text-slate-400 text-xs font-bold text-center">→</span>
              <div className="relative flex-1 min-w-0">
                <span className="sm:hidden text-[10px] text-slate-400 font-medium block mb-0.5">End Date</span>
                <AdminDatePicker
                  value={endDate}
                  onChange={setEndDate}
                  placeholder="End date"
                />
              </div>
            </div>
          </div>

          <div className="md:col-span-4 flex items-center gap-2">
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
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-white border border-slate-300 hover:bg-slate-50 active:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold shadow-sm transition-all cursor-pointer"
            >
              <FaUndo size={10} />
              <span>Reset</span>
            </button>
          </div>
        </form>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-[650px] w-full text-left text-xs text-slate-700 border-collapse">
            <thead className="bg-[#0284c7] text-white uppercase text-[11px] font-bold tracking-wider">
              <tr>
                <th className="py-3 px-3 w-12 text-center">#</th>
                <th className="py-3 px-3">Name</th>
                <th className="py-3 px-3">Email</th>
                <th className="py-3 px-3">Account Type</th>
                <th className="py-3 px-3">Subscribed On</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSubscribers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-500">
                    <p className="font-semibold text-slate-700 text-sm">No accounts found</p>
                    <p className="text-xs text-slate-400 mt-1">
                      No accounts registered between {appliedStart || "Start"} and {appliedEnd || "End"}.
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
                paginatedSubscribers.map((s, index) => {
                  const rowNum = (Math.min(currentPage, Math.max(1, Math.ceil(filteredSubscribers.length / pageSize))) - 1) * pageSize + index + 1;
                  return (
                <tr
                  key={s.id || index}
                  className="hover:bg-sky-50/50 transition-colors"
                >
                  <td className="py-3.5 px-3 font-semibold text-slate-500 text-center">
                    {rowNum}
                  </td>
                  <td className="py-3.5 px-3 font-bold text-slate-800">
                    {s.name || "—"}
                  </td>
                  <td className="py-3.5 px-3 font-medium text-slate-800">
                    <a
                      href={`mailto:${s.email}`}
                      className="text-blue-600 hover:underline"
                    >
                      {s.email}
                    </a>
                  </td>
                  <td className="py-3.5 px-3">
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                        s.role && s.role.includes("Partner")
                          ? "bg-purple-100 text-purple-800 border-purple-200"
                          : s.role === "Subscriber"
                          ? "bg-sky-100 text-sky-800 border-sky-200"
                          : "bg-emerald-100 text-emerald-800 border-emerald-200"
                      }`}
                    >
                      {s.role || "User"}
                    </span>
                  </td>
                  <td className="py-3.5 px-3 text-slate-500 whitespace-nowrap">
                    {s.subscribedOn}
                  </td>
                </tr>
              );
              }))}
            </tbody>
          </table>
        </div>
        <Pagination
          totalItems={filteredSubscribers.length}
          currentPage={currentPage}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
          itemLabel="subscribers"
        />
      </div>
    </div>
  );
};

export default AdminSubscribedEmails;
