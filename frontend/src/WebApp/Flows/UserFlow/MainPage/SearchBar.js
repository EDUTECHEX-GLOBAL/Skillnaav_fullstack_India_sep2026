import React, { useState, useEffect, useRef, useCallback } from "react";
import { TextField, IconButton, InputAdornment } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";
import axios from "../../../../api/axiosInstance";
import { useTabContext } from "./UserHomePageContext/HomePageContext";
import ApplyCards from "./ApplyCards";
import JobCardItem from "./JobCardItem";

// ── Filter config ─────────────────────────────────────────────────────────────
const FILTER_GROUPS = [
  {
    key: "internshipType",
    label: "Type",
    options: [
      { value: "FREE", label: "Free" },
      { value: "STIPEND", label: "Stipend" },
      { value: "PAID", label: "Paid" },
    ],
  },
  {
    key: "internshipMode",
    label: "Mode",
    options: [
      { value: "ONLINE", label: "Online" },
      { value: "OFFLINE", label: "Offline" },
      { value: "HYBRID", label: "Hybrid" },
    ],
  },
  {
    key: "classification",
    label: "Level",
    options: [
      { value: "Basic", label: "Basic" },
      { value: "Intermediate", label: "Intermediate" },
      { value: "Advanced", label: "Advanced" },
    ],
  },
];

const SearchBar = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilters, setActiveFilters] = useState({
    internshipType: null,
    internshipMode: null,
    classification: null,
  });
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 400);
    return () => clearTimeout(handler);
  }, [searchTerm]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [, setApplicationCount] = useState(0);
  const [showLimitPopup, setShowLimitPopup] = useState(false);
  const [, setIsPremium] = useState(false);
  const [planType, setPlanType] = useState("Freemium");
  const [showSavedJobPopup, setShowSavedJobPopup] = useState(false);
  const [openDropdownKey, setOpenDropdownKey] = useState(null);

  useEffect(() => {
    const handleGlobalClick = (e) => {
      if (!e.target.closest(".filter-dropdown-container")) {
        setOpenDropdownKey(null);
      }
    };
    document.addEventListener("mousedown", handleGlobalClick);
    return () => document.removeEventListener("mousedown", handleGlobalClick);
  }, []);

  const [jobData, setJobData] = useState([]);
  const [page, setPage] = useState(1);
  const [, setHasMore] = useState(true);
  const [loadingJobs, setLoadingJobs] = useState(false);

  // Saves the <main> scrollTop before entering the detail view
  const savedScrollRef = useRef(0);
  const loadMoreRef = useRef(null);
  const loadingJobsRef = useRef(false);
  const hasMoreRef = useRef(true);

  const MAX_LIMITS = {
    Free: 5,
    Freemium: 5,
    "Premium Basic": 25,
    "Premium Plus": Infinity,
  };

  const { savedJobs, saveJob, removeJob, handleSelectTab } = useTabContext();

  // ── Filter helpers ────────────────────────────────────────────────────────
  const clearAllFilters = () =>
    setActiveFilters({
      internshipType: null,
      internshipMode: null,
      classification: null,
    });

  const hasActiveFilters = Object.values(activeFilters).some(Boolean);

  // ── Plan helpers ──────────────────────────────────────────────────────────
  const getSavedLimitByPlan = (plan) => {
    switch (plan) {
      case "Premium Plus":
        return Infinity;
      case "Premium Basic":
        return 25;
      case "Freemium":
      default:
        return 3;
    }
  };

  // ── Data fetching ─────────────────────────────────────────────────────────
  const fetchJobData = useCallback(async (pageNumber = 1, searchQuery = "") => {
    try {
      if (loadingJobsRef.current || (pageNumber !== 1 && !hasMoreRef.current))
        return;
      loadingJobsRef.current = true;
      setLoadingJobs(true);

      const response = await axios.get(
        `/api/interns/approved?page=${pageNumber}&limit=6&search=${encodeURIComponent(searchQuery)}`,
      );
      const { data, hasMore: more } = response.data;

      setJobData((prev) => (pageNumber === 1 ? data : [...prev, ...data]));
      hasMoreRef.current = more;
      setHasMore(more);
      setPage(pageNumber);
    } catch (error) {
      console.error("Error fetching internships:", error);
    } finally {
      loadingJobsRef.current = false;
      setLoadingJobs(false);
    }
  }, []);

  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const token = localStorage.getItem("userToken");
        if (!token) return;

        const { data } = await axios.get("/api/users/profile", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setIsPremium(data.isPremium);
        setPlanType(data.planType || "Freemium");

        const userInfo =
          JSON.parse(localStorage.getItem("studentInfo")) ||
          JSON.parse(localStorage.getItem("userInfo")) ||
          {};
        if (userInfo._id) {
          const { data: countData } = await axios.get(
            `/api/applications/count/${userInfo._id}`,
          );
          setApplicationCount(countData.count);
        }
      } catch (error) {
        console.error(
          "Error fetching user profile or application count:",
          error,
        );
      }
    };

    fetchUserProfile();
  }, []);

  useEffect(() => {
    fetchJobData(1, debouncedSearchTerm);
  }, [debouncedSearchTerm, fetchJobData]);

  // ── Infinite scroll — only active when list is visible ───────────────────
  useEffect(() => {
    if (!loadMoreRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const firstEntry = entries[0];
        if (
          firstEntry.isIntersecting &&
          hasMoreRef.current &&
          !loadingJobsRef.current
        ) {
          fetchJobData(page + 1, debouncedSearchTerm);
        }
      },
      { threshold: 0.8 },
    );
    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [fetchJobData, page, selectedJob, debouncedSearchTerm]);

  // ── Job actions ───────────────────────────────────────────────────────────
  const handleViewDetails = async (job) => {
    try {
      const userInfo =
        JSON.parse(localStorage.getItem("studentInfo")) ||
        JSON.parse(localStorage.getItem("userInfo"));
      if (!userInfo) return;

      const { data: checkData } = await axios.get(
        `/api/applications/check-applied/${userInfo._id}/${job._id}`,
      );

      if (checkData.isApplied) {
        const container = document.getElementById("main-scroll-container");
        if (container) savedScrollRef.current = container.scrollTop;
        setSelectedJob(job);
        return;
      }

      const { data: countData } = await axios.get(
        `/api/applications/count/${userInfo._id}`,
      );
      setApplicationCount(countData.count);

      const maxApps = MAX_LIMITS[planType] || 5;

      if (countData.count >= maxApps) {
        setShowLimitPopup(true);
      } else {
        // Save scroll position of <main> before switching to detail view
        const container = document.getElementById("main-scroll-container");
        if (container) savedScrollRef.current = container.scrollTop;
        setSelectedJob(job);
      }
    } catch (error) {
      console.error("Error fetching updated application count:", error);
    }
  };

  const handleBack = () => {
    setSelectedJob(null);
    // jobData is still in state — restore scroll after React repaints
    requestAnimationFrame(() => {
      const container = document.getElementById("main-scroll-container");
      if (container) container.scrollTop = savedScrollRef.current;
    });
  };

  const isJobSaved = (jobId) =>
    savedJobs?.some(
      (savedJob) =>
        savedJob.jobId?._id === jobId ||
        savedJob.jobId === jobId ||
        savedJob._id === jobId,
    );

  const toggleSaveJob = async (job) => {
    try {
      const savedLimit = getSavedLimitByPlan(planType);
      if (
        !isJobSaved(job._id) &&
        savedJobs?.length >= savedLimit &&
        savedLimit !== Infinity
      ) {
        setShowSavedJobPopup(true);
        return;
      }
      if (isJobSaved(job._id)) {
        await removeJob(job._id);
      } else {
        await saveJob(job);
      }
    } catch (err) {
      console.error("Error toggling save job:", err);
    }
  };

  // ── Filtered jobs ─────────────────────────────────────────────────────────
  const filteredJobs = jobData.filter((job) => {
    const matchesSearch =
      job.jobTitle?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.companyName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.location?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job._id?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesTags = Object.entries(activeFilters).every(
      ([key, val]) => !val || job[key] === val,
    );

    return matchesSearch && matchesTags;
  });

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="font-poppins py-4">
      {selectedJob ? (
        // Detail view — list is unmounted so IntersectionObserver is disconnected
        <ApplyCards job={selectedJob} onBack={handleBack} />
      ) : (
        <>
          {/* Search bar + filter tags */}
          <div className="bg-white border-b p-4 space-y-3">
            <TextField
              fullWidth
              size="small"
              placeholder="Search for internships and jobs"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              sx={{
                "& .MuiOutlinedInput-root": {
                  borderRadius: "0.5rem",
                  fontSize: "0.875rem",
                  backgroundColor: "#ffffff",
                  height: "40px",
                  "& fieldset": {
                    borderColor: "#d1d5db",
                  },
                  "&:hover fieldset": {
                    borderColor: "#9ca3af",
                  },
                  "&.Mui-focused fieldset": {
                    borderColor: "#14b8a6",
                    borderWidth: "1.5px",
                  },
                },
                "& .MuiInputBase-input": {
                  padding: "8px 12px",
                },
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: "#6b7280", fontSize: "1.25rem" }} />
                  </InputAdornment>
                ),
                endAdornment: searchTerm && (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setSearchTerm("")}>
                      <ClearIcon sx={{ fontSize: "1.1rem" }} />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            {/* Filter dropdowns */}
            <div className="flex flex-wrap gap-3 pt-1">
              {FILTER_GROUPS.map((group) => {
                const isOpen = openDropdownKey === group.key;
                const selectedOpt = group.options.find(
                  (opt) => opt.value === activeFilters[group.key]
                );
                const currentLabel = selectedOpt
                  ? selectedOpt.label
                  : `All ${group.label}s`;

                return (
                  <div
                    key={group.key}
                    className="filter-dropdown-container flex flex-col gap-1 relative min-w-[130px] flex-1 sm:flex-none"
                  >
                    <label className="text-xs text-gray-500 font-medium">
                      {group.label}
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setOpenDropdownKey(isOpen ? null : group.key)
                      }
                      className={`w-full px-3 py-2 rounded-lg text-sm border bg-white text-gray-700 flex items-center justify-between gap-2 cursor-pointer transition-all ${
                        isOpen
                          ? "border-teal-500 ring-2 ring-teal-500"
                          : "border-gray-300 hover:border-gray-400"
                      }`}
                    >
                      <span className="truncate">{currentLabel}</span>
                      <svg
                        className={`w-4 h-4 text-gray-500 transition-transform duration-200 flex-shrink-0 ${
                          isOpen ? "rotate-180" : ""
                        }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </button>

                    {isOpen && (
                      <div className="absolute left-0 right-0 top-full mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg z-50 overflow-hidden py-1">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveFilters((prev) => ({
                              ...prev,
                              [group.key]: null,
                            }));
                            setOpenDropdownKey(null);
                          }}
                          className={`w-full text-left px-3 py-2 text-sm transition-colors cursor-pointer truncate ${
                            !activeFilters[group.key]
                              ? "bg-blue-600 text-white font-medium"
                              : "text-gray-700 hover:bg-gray-100"
                          }`}
                        >
                          All {group.label}s
                        </button>
                        {group.options.map((opt) => {
                          const isSelected = activeFilters[group.key] === opt.value;
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => {
                                setActiveFilters((prev) => ({
                                  ...prev,
                                  [group.key]: opt.value,
                                }));
                                setOpenDropdownKey(null);
                              }}
                              className={`w-full text-left px-3 py-2 text-sm transition-colors cursor-pointer truncate ${
                                isSelected
                                  ? "bg-blue-600 text-white font-medium"
                                  : "text-gray-700 hover:bg-gray-100"
                              }`}
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {hasActiveFilters && (
              <button
                onClick={clearAllFilters}
                className="text-xs text-teal-600 underline hover:text-teal-800"
              >
                Clear all filters
              </button>
            )}
          </div>

          {/* Job cards */}
          <div className="py-2 lg:py-4">
            <section className="py-2 px-0">
              <h2 className="text-2xl md:text-3xl font-bold mb-2">
                Search Results
              </h2>
              <p className="text-gray-600 mb-4">
                Showing internships and jobs matching your query
              </p>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 w-full min-w-0">
                {/* {filteredJobs.length > 0 ? ( */}
                {/*comment the above condition add the below condition for correct loading effect while searching - 07-08-2026 */}
                {loadingJobs && filteredJobs.length === 0 ? (
                  <div className="col-span-full text-center py-10">
                    <p className="text-gray-500">Searching internships...</p>
                  </div>
                ) : filteredJobs.length > 0 ? (
                  filteredJobs.map((job) => (
                    <JobCardItem
                      key={job._id}
                      job={job}
                      isSaved={isJobSaved(job._id)}
                      onToggleSave={toggleSaveJob}
                      onViewDetails={handleViewDetails}
                    />
                  ))
                ) : (
                  <div className="text-center text-gray-500 col-span-full py-10">
                    <p className="text-gray-500">No jobs found</p>
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* Load-more sentinel — inside list branch only, so observer stops when detail is shown */}
          <div
            ref={loadMoreRef}
            className="h-10 flex justify-center items-center"
          >
            {/* {loadingJobs && (
              <span className="text-gray-500 text-sm">
                Loading more internships…
              </span>
            )} */}
            {/*Add this for correct functionality while searching the internships - 07-08-2026 */}
            {loadingJobs && filteredJobs.length > 0 && hasMoreRef.current && (
              <span className="text-gray-500 text-sm">
                Loading more internships...
              </span>
            )}
          </div>
        </>
      )}

      {/* Application limit popup */}
      {showLimitPopup && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-sm text-center">
            <h2 className="text-xl font-semibold text-gray-800">
              Application Limit Reached
            </h2>
            <p className="text-gray-600 mt-2">
              You have reached the maximum of {MAX_LIMITS[planType] || 5}{" "}
              applications allowed under your plan ({planType}).
            </p>
            <p className="text-gray-600 mt-1">
              Upgrade your account to apply for more jobs.
            </p>
            <div className="flex justify-between mt-4">
              <button
                className="bg-gray-400 text-white px-4 py-2 rounded-md hover:bg-gray-500"
                onClick={() => setShowLimitPopup(false)}
              >
                Close
              </button>
              <button
                className="bg-purple-500 text-white px-4 py-2 rounded-md hover:bg-purple-600"
                onClick={() => {
                  setShowLimitPopup(false);
                  if (handleSelectTab) handleSelectTab("premium");
                }}
              >
                Upgrade Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Saved jobs limit popup */}
      {showSavedJobPopup && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-sm text-center">
            <h2 className="text-xl font-semibold text-gray-800">
              Saved Jobs Limit Reached
            </h2>
            <p className="text-gray-600 mt-2">
              You have reached the maximum of{" "}
              {getSavedLimitByPlan(planType) === Infinity
                ? "unlimited"
                : getSavedLimitByPlan(planType)}{" "}
              saved jobs.
            </p>
            <div className="flex justify-between mt-4">
              <button
                className="bg-gray-400 text-white px-4 py-2 rounded-md hover:bg-gray-500"
                onClick={() => setShowSavedJobPopup(false)}
              >
                Close
              </button>
              <button
                className="bg-purple-500 text-white px-4 py-2 rounded-md hover:bg-purple-600"
                onClick={() => {
                  setShowSavedJobPopup(false);
                  if (handleSelectTab) handleSelectTab("premium");
                }}
              >
                Upgrade Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchBar;
