import React, { useState, useEffect, useMemo, useCallback } from "react";
import { FaFileExcel, FaFilter, FaUndo, FaSyncAlt } from "react-icons/fa";
import * as XLSX from "xlsx";
import axios from "../../api/axiosInstance";
import { initialVisitors } from "./mockAdminData";
import Pagination from "./Pagination";
import AdminDatePicker from "./AdminDatePicker";

const AdminVisitorsList = () => {
  const [visitors, setVisitors] = useState(initialVisitors);
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [appliedStart, setAppliedStart] = useState("");
  const [appliedEnd, setAppliedEnd] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Fetch live visitors from MongoDB
  const fetchLiveVisitors = useCallback(async (isManual = false) => {
    if (isManual) setLoading(true);
    try {
      const res = await axios.get("/api/contact/visitors");
      if (res.data?.visitors && Array.isArray(res.data.visitors) && res.data.visitors.length > 0) {
        setVisitors(res.data.visitors);
      }
    } catch (err) {
      console.error("Failed to load live visitors:", err);
    } finally {
      if (isManual) {
        setTimeout(() => setLoading(false), 350);
      }
    }
  }, []);

  // Initial load + real-time polling every 12 seconds
  useEffect(() => {
    fetchLiveVisitors(false);
    const interval = setInterval(() => {
      fetchLiveVisitors(false);
    }, 12000);
    return () => clearInterval(interval);
  }, [fetchLiveVisitors]);

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

  const filteredVisitors = useMemo(() => {
    return visitors.filter((v) => {
      const d = v.rawDate || (v.visitedOn ? new Date(v.visitedOn).toISOString().slice(0, 10) : "");
      if (appliedStart && d && d < appliedStart) return false;
      if (appliedEnd && d && d > appliedEnd) return false;
      return true;
    });
  }, [visitors, appliedStart, appliedEnd]);

  const paginatedVisitors = useMemo(() => {
    const totalPages = Math.max(1, Math.ceil(filteredVisitors.length / pageSize));
    const safePage = Math.min(Math.max(1, currentPage), totalPages);
    const start = (safePage - 1) * pageSize;
    return filteredVisitors.slice(start, start + pageSize);
  }, [filteredVisitors, currentPage, pageSize]);

  const exportToExcel = () => {
    const listToExport = filteredVisitors.length > 0 ? filteredVisitors : visitors;
    const exportData = listToExport.map((v, index) => {
      return {
        "#": index + 1,
        "IP Address": v.ipAddress,
        City: v.city,
        Region: v.region,
        "Postal Code": v.postalCode,
        Country: v.country,
        "Visited On": v.visitedOn,
      };
    });
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Visitors");
    XLSX.writeFile(wb, "Visitors_List.xlsx");
  };

  return (
    <div className="space-y-6">
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl md:text-2xl font-black text-slate-800 tracking-tight">
              VISITORS LIST
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {appliedStart || appliedEnd
              ? `Filtered: Showing ${filteredVisitors.length} of ${visitors.length} visitors`
              : `${visitors.length} visitors found`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => fetchLiveVisitors(true)}
            disabled={loading}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-3.5 py-2 bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 hover:text-blue-600 border border-slate-200 hover:border-blue-300 rounded-xl text-xs font-semibold shadow-xs hover:shadow-sm transition-all duration-200 cursor-pointer disabled:opacity-50"
            title="Refresh live visitor logs"
          >
            <FaSyncAlt
              className={`text-xs text-slate-400 group-hover:text-blue-600 transition-colors duration-200 ${
                loading ? "animate-spin text-blue-600" : "group-hover:rotate-180 transition-transform duration-500"
              }`}
            />
            <span>{loading ? "Refreshing..." : "Refresh"}</span>
          </button>
          <button
            type="button"
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
          <table className="min-w-[720px] w-full text-left text-xs text-slate-700 border-collapse">
            <thead className="bg-[#0284c7] text-white uppercase text-[11px] font-bold tracking-wider">
              <tr>
                <th className="py-3 px-3 w-10 text-center">#</th>
                <th className="py-3 px-3">IP Address</th>
                <th className="py-3 px-3">City</th>
                <th className="py-3 px-3">Region</th>
                <th className="py-3 px-3">Postal Code</th>
                <th className="py-3 px-3">Country</th>
                <th className="py-3 px-3">Visited On</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredVisitors.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    <p className="font-semibold text-slate-700 text-sm">No visitor sessions found</p>
                    <p className="text-xs text-slate-400 mt-1">
                      No sessions recorded between {appliedStart || "Start"} and {appliedEnd || "End"}.
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
                paginatedVisitors.map((v, index) => {
                  const rowNum = (Math.min(currentPage, Math.max(1, Math.ceil(filteredVisitors.length / pageSize))) - 1) * pageSize + index + 1;
                  return (
                  <tr
                    key={v.id || index}
                    className="hover:bg-sky-50/50 transition-colors"
                  >
                    <td className="py-3 px-3 font-semibold text-slate-500 text-center">
                      {rowNum}
                    </td>
                    <td className="py-3 px-3 font-mono font-medium text-slate-800">
                      {v.ipAddress}
                    </td>
                    <td className="py-3 px-3 text-slate-600">{v.city}</td>
                    <td className="py-3 px-3 text-slate-600">{v.region}</td>
                    <td className="py-3 px-3 text-slate-600 font-mono">
                      {v.postalCode}
                    </td>
                    <td className="py-3 px-3 font-semibold text-slate-800">
                      {v.country}
                    </td>
                    <td className="py-3 px-3 text-slate-500 whitespace-nowrap">
                      {v.visitedOn}
                    </td>
                  </tr>
                );
                })
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          totalItems={filteredVisitors.length}
          currentPage={currentPage}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
          itemLabel="visitors"
        />
      </div>
    </div>
  );
};

export default AdminVisitorsList;
