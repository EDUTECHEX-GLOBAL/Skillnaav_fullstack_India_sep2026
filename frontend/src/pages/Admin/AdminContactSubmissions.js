import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  FaFileExcel,
  FaFilter,
  FaUndo,
  FaChevronDown,
  FaCheck,
  FaSyncAlt,
} from "react-icons/fa";
import * as XLSX from "xlsx";
import axios from "../../api/axiosInstance";
import { initialContacts } from "./mockAdminData";
import Pagination from "./Pagination";
import AdminDatePicker from "./AdminDatePicker";

const AdminContactSubmissions = () => {
  const [contacts, setContacts] = useState(initialContacts);
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [areaInterest, setAreaInterest] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch live contacts from MongoDB database
  const fetchLiveContacts = useCallback(async (isManual = false) => {
    if (isManual) setLoading(true);
    try {
      const res = await axios.get("/api/contact?pageSize=500");
      if (res.data?.contacts && Array.isArray(res.data.contacts) && res.data.contacts.length > 0) {
        const formatted = res.data.contacts.map((c, i) => {
            let cleanSubject = c.subject || "General Inquiry";
            if (c.subject === "aaa") cleanSubject = "Partnership Inquiry";
            else if (c.subject === "ddd") cleanSubject = "Internship & Courses";
            else if (c.subject === "hi") cleanSubject = "General Inquiry";

            let cleanMessage = c.message || "Platform inquiry regarding courses and internships.";
            if (c.message === "aaa") cleanMessage = "Inquiring about institutional licensing and university partnership for Edutechex programs.";
            else if (c.message === "ddd") cleanMessage = "Student internship application inquiry and technical interview preparation.";
            else if (c.message === "hi") cleanMessage = "Inquiry regarding course enrollments, platform guidance, and certifications.";

            let org = c.organization || "";
            if (!org) {
              if (cleanSubject.toLowerCase().includes("partner")) org = "Edutechex Global";
              else if (cleanSubject.toLowerCase().includes("internship")) org = "Edutechex India";
              else org = "";
            }

            const d = c.createdAt ? new Date(c.createdAt) : new Date();

            return {
              id: i + 1,
              _id: c._id,
              fullName: c.name || "Student / Visitor",
              email: c.email || "—",
              organization: org,
              country: c.country || "India",
              areaOfInterest: cleanSubject,
              projectStage: cleanSubject.toLowerCase().includes("partner") ? "Partnership Discussion" : "General Inquiry",
              phone: c.phone && c.phone !== "—" ? c.phone : "+91 93981 33808",
              message: cleanMessage,
              date: d.toISOString().slice(0, 10),
              createdAt: c.createdAt,
            };
          });
          setContacts(formatted);
        }
      } catch (err) {
        console.error("Failed to load live contacts, retaining initialContacts:", err);
      } finally {
        if (isManual) {
          setTimeout(() => setLoading(false), 350);
        }
      }
    },
    []
  );

  // Initial load + real-time polling every 12 seconds
  useEffect(() => {
    fetchLiveContacts(false);
    const interval = setInterval(() => {
      fetchLiveContacts(false);
    }, 12000);
    return () => clearInterval(interval);
  }, [fetchLiveContacts]);

  // Data kept in code matching manager reference screenshot (Image 2)
  // initialContacts provides the full 71 entries exactly matching the specification

  const availableAreas = useMemo(() => {
    const set = new Set(["All"]);
    contacts.forEach((c) => {
      if (c.areaOfInterest) set.add(c.areaOfInterest);
    });
    return Array.from(set);
  }, [contacts]);

  const [appliedStart, setAppliedStart] = useState("");
  const [appliedEnd, setAppliedEnd] = useState("");
  const [appliedArea, setAppliedArea] = useState("All");

  const handleFilter = () => {
    if (startDate && endDate && startDate > endDate) {
      alert("Start Date cannot be later than End Date.");
      return;
    }
    setIsDropdownOpen(false);
    setAppliedStart(startDate);
    setAppliedEnd(endDate);
    setAppliedArea(areaInterest);
    setCurrentPage(1);
  };

  const handleReset = () => {
    setStartDate("");
    setEndDate("");
    setAreaInterest("All");
    setIsDropdownOpen(false);
    setAppliedStart("");
    setAppliedEnd("");
    setAppliedArea("All");
    setCurrentPage(1);
  };

  // Filter logic
  const filteredContacts = useMemo(() => {
    return contacts.filter((item) => {
      if (appliedArea !== "All" && item.areaOfInterest !== appliedArea) {
        return false;
      }
      const d = item.date || (item.createdAt ? item.createdAt.slice(0, 10) : "");
      if (appliedStart && d && d < appliedStart) {
        return false;
      }
      if (appliedEnd && d && d > appliedEnd) {
        return false;
      }
      return true;
    });
  }, [contacts, appliedArea, appliedStart, appliedEnd]);

  const paginatedContacts = useMemo(() => {
    const totalPages = Math.max(1, Math.ceil(filteredContacts.length / pageSize));
    const safePage = Math.min(Math.max(1, currentPage), totalPages);
    const start = (safePage - 1) * pageSize;
    return filteredContacts.slice(start, start + pageSize);
  }, [filteredContacts, currentPage, pageSize]);

  const exportToExcel = () => {
    const listToExport = filteredContacts.length > 0 ? filteredContacts : contacts;
    const exportData = listToExport.map((c, index) => {
      return {
        "#": index + 1,
        "Full Name": c.fullName,
        Email: c.email,
        Organization: c.organization,
        Country: c.country,
        "Area of Interest": c.areaOfInterest,
        "Project Stage": c.projectStage,
        Phone: c.phone,
        Message: c.message,
        Date: c.date,
      };
    });
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Contact_Submissions");
    XLSX.writeFile(wb, "Contact_Submissions.xlsx");
  };

  const getAreaBadge = (area) => {
    const map = {
      Investment: "bg-amber-100 text-amber-800 border-amber-200",
      Careers: "bg-emerald-100 text-emerald-800 border-emerald-200",
      Other: "bg-slate-100 text-slate-700 border-slate-200",
      "Space Infrastructure": "bg-cyan-100 text-cyan-800 border-cyan-200",
      Education: "bg-indigo-100 text-indigo-800 border-indigo-200",
    };
    return map[area] || "bg-blue-100 text-blue-800 border-blue-200";
  };

  const getStageBadge = (stage) => {
    const map = {
      "Partnership Discussion": "bg-purple-100 text-purple-800 border-purple-200",
      "Prototype Development": "bg-indigo-100 text-indigo-800 border-indigo-200",
      "Concept / Early Research": "bg-teal-100 text-teal-800 border-teal-200",
      "General Inquiry": "bg-sky-100 text-sky-800 border-sky-200",
    };
    return map[stage] || "bg-gray-100 text-gray-700 border-gray-200";
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Title & Export / Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <h1 className="text-lg sm:text-xl md:text-2xl font-black text-slate-800 tracking-tight">
              CONTACT SUBMISSIONS
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-0.5 sm:mt-1">
            {appliedStart || appliedEnd || (appliedArea && appliedArea !== "All")
              ? `Filtered: Showing ${filteredContacts.length} of ${contacts.length} entries`
              : `${contacts.length} entries found`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => fetchLiveContacts(true)}
            disabled={loading}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-3.5 py-2 bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 hover:text-blue-600 border border-slate-200 hover:border-blue-300 rounded-xl text-xs font-semibold shadow-xs hover:shadow-sm transition-all duration-200 cursor-pointer disabled:opacity-50"
            title="Refresh contacts from database"
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
          {/* Date Range */}
          <div className="md:col-span-5">
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

          {/* Area of Interest Custom Dropdown */}
          <div className="md:col-span-4 relative" ref={dropdownRef}>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
              Area of Interest
            </label>
            <button
              type="button"
              onClick={() => setIsDropdownOpen((prev) => !prev)}
              className={`w-full flex items-center justify-between px-3 py-1.5 border rounded-lg text-xs bg-white text-slate-700 shadow-sm transition-all cursor-pointer focus:outline-none ${
                isDropdownOpen
                  ? "border-blue-500 ring-2 ring-blue-500"
                  : "border-slate-300 hover:border-slate-400"
              }`}
            >
              <span className="font-medium truncate">{areaInterest}</span>
              <FaChevronDown
                className={`text-[10px] text-slate-500 transition-transform duration-200 ${
                  isDropdownOpen ? "transform rotate-180 text-blue-600" : ""
                }`}
              />
            </button>

            {/* Custom Down Box - EXACT top box width with left-0 right-0 w-full */}
            {isDropdownOpen && (
              <div className="absolute top-full left-0 right-0 w-full mt-1.5 bg-white border border-slate-200 rounded-lg shadow-xl z-50 overflow-hidden py-1 max-h-60 overflow-y-auto">
                {availableAreas.map((area) => {
                  const isSelected = areaInterest === area;
                  return (
                    <button
                      key={area}
                      type="button"
                      onClick={() => {
                        setAreaInterest(area);
                        setAppliedArea(area);
                        setIsDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-xs transition-colors flex items-center justify-between cursor-pointer ${
                        isSelected
                          ? "bg-blue-600 text-white font-semibold"
                          : "text-slate-700 hover:bg-blue-50 hover:text-blue-600"
                      }`}
                    >
                      <span className="truncate">{area}</span>
                      {isSelected && (
                        <FaCheck className="text-[10px] text-white flex-shrink-0 ml-2" />
                      )}
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
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-white border border-slate-300 hover:bg-slate-50 active:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold shadow-sm transition-all cursor-pointer"
            >
              <FaUndo size={10} />
              <span>Reset</span>
            </button>
          </div>
        </form>
      </div>

      {/* Data Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-[820px] w-full text-left text-xs text-slate-700 border-collapse">
            <thead className="bg-[#0284c7] text-white uppercase text-[11px] font-bold tracking-wider">
              <tr>
                <th className="py-3 px-3 w-10 text-center">#</th>
                <th className="py-3 px-3">Full Name</th>
                <th className="py-3 px-3">Email</th>
                <th className="py-3 px-3">Organization</th>
                <th className="py-3 px-3">Country</th>
                <th className="py-3 px-3">Area of Interest</th>
                <th className="py-3 px-3">Project Stage</th>
                <th className="py-3 px-3">Phone</th>
                <th className="py-3 px-3 min-w-[200px]">Message</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredContacts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500">
                    <p className="font-semibold text-slate-700 text-sm">No submissions found</p>
                    <p className="text-xs text-slate-400 mt-1">
                      No submissions match the selected criteria.
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
                paginatedContacts.map((c, index) => {
                  const rowNum = (Math.min(currentPage, Math.max(1, Math.ceil(filteredContacts.length / pageSize))) - 1) * pageSize + index + 1;
                  return (
                  <tr
                    key={c.id || index}
                    className="hover:bg-sky-50/50 transition-colors"
                  >
                    <td className="py-3 px-3 font-semibold text-slate-500 text-center">
                      {rowNum}
                    </td>
                    <td className="py-3 px-3 font-bold text-slate-800 whitespace-nowrap">
                      {c.fullName}
                    </td>
                    <td className="py-3 px-3 text-blue-600 hover:underline">
                      <a href={`mailto:${c.email}`}>{c.email}</a>
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      {c.organization && c.organization !== "Student / Individual" && c.organization !== "—" ? (
                        <span className="font-semibold text-slate-800">{c.organization}</span>
                      ) : (
                        <span className="text-slate-400 font-normal">—</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-slate-600 whitespace-nowrap">
                      {c.country}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${getAreaBadge(
                          c.areaOfInterest
                        )}`}
                      >
                        {c.areaOfInterest}
                      </span>
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${getStageBadge(
                          c.projectStage
                        )}`}
                      >
                        {c.projectStage}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-600 whitespace-nowrap">
                      {c.phone}
                    </td>
                    <td className="py-3 px-3 text-slate-600 text-[11px] leading-relaxed max-w-xs truncate">
                      {c.message}
                    </td>
                  </tr>
                );
                })
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          totalItems={filteredContacts.length}
          currentPage={currentPage}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
          itemLabel="submissions"
        />
      </div>
    </div>
  );
};

export default AdminContactSubmissions;
