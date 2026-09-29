import React, { useState, useEffect, useRef, useCallback } from "react";
import { TextField, IconButton, InputAdornment } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";
import axios from "../../../../api/axiosInstance";
import { FaMapMarkerAlt, FaClock, FaDollarSign, FaHeart } from "react-icons/fa";
import { useTabContext } from "./UserHomePageContext/HomePageContext";
import { format } from "date-fns";
import ApplyCards from "./ApplyCards";

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

  const calculatePostedTime = (date) => {
    if (!date) return "—";
    const diff = Math.floor(
      (new Date() - new Date(date)) / (1000 * 60 * 60 * 24),
    );
    if (diff === 0) return "Today";
    if (diff === 1) return "Yesterday";
    return `${diff}d ago`;
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
              placeholder="Search for internships and jobs"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
                endAdornment: searchTerm && (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setSearchTerm("")}>
                      <ClearIcon />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            {/* Filter dropdowns */}
            <div className="flex flex-wrap gap-3 pt-1">
              {FILTER_GROUPS.map((group) => (
                <div key={group.key} className="flex flex-col gap-1">
                  <label className="text-xs text-gray-500 font-medium">
                    {group.label}
                  </label>
                  <select
                    value={activeFilters[group.key] ?? ""}
                    onChange={(e) =>
                      setActiveFilters((prev) => ({
                        ...prev,
                        [group.key]: e.target.value || null,
                      }))
                    }
                    className="px-3 py-2 rounded-lg text-sm border border-gray-300 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 cursor-pointer min-w-[130px]"
                  >
                    <option value="">All {group.label}s</option>
                    {group.options.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
                {/* {filteredJobs.length > 0 ? ( */}
                {/*comment the above condition add the below condition for correct loading effect while searching - 07-08-2026 */}
                {loadingJobs && filteredJobs.length === 0 ? (
                  <div className="col-span-full text-center py-10">
                    <p className="text-gray-500">Searching internships...</p>
                  </div>
                ) : filteredJobs.length > 0 ? (
                  filteredJobs.map((job) => (
                    <div
                      key={job._id}
                      className="relative border rounded-lg p-6 shadow-sm"
                    >
                      <div className="absolute top-2 right-2 flex items-center gap-2">
                        {job.internshipType && (
                          <span
                            className={`px-3 py-1 text-xs md:text-sm font-semibold uppercase rounded-full ${
                              job.internshipType === "FREE"
                                ? "bg-green-100 text-green-700"
                                : job.internshipType === "STIPEND"
                                  ? "bg-blue-100 text-blue-700"
                                  : job.internshipType === "PAID"
                                    ? "bg-red-100 text-red-700"
                                    : ""
                            }`}
                          >
                            {job.internshipType}
                          </span>
                        )}
                        <button
                          onClick={() => toggleSaveJob(job)}
                          className={`transition ${
                            isJobSaved(job._id)
                              ? "text-red-500"
                              : "text-gray-500 hover:text-red-500"
                          }`}
                          aria-label={
                            isJobSaved(job._id) ? "Unsave job" : "Save job"
                          }
                        >
                          <FaHeart />
                        </button>
                      </div>

                      <div className="flex items-center mb-4">
                        <img
                          src={job.imgUrl}
                          alt={`${job.companyName} logo`}
                          className="w-12 h-12 rounded-full mr-4 object-cover"
                          width="48"
                          height="48"
                          loading="lazy"
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = "/favicon-512x469.png";
                          }}
                        />
                        <div className="flex-1 min-w-0 pr-12">
                          <h3
                            className="text-lg md:text-xl font-semibold truncate"
                            title={job.jobTitle}
                          >
                            {job.jobTitle}
                          </h3>
                          <div className="flex items-center text-gray-600">
                            <span className="truncate" title={job.companyName}>
                              {job.companyName}
                            </span>
                            <span className="mx-1">•</span>
                            <span className="whitespace-nowrap">
                              {calculatePostedTime(job.createdAt)}
                            </span>
                          </div>
                          {/*Remove "whitespace-nowrap" add "break-all" for alignment in tabs - 07-08-2026*/}
                          <p className="text-xs text-gray-400 mt-1 break-all">
                            ID: {job._id}
                          </p>
                        </div>
                      </div>

                      <div className="text-gray-600 mb-4">
                        <p className="flex items-center text-sm md:text-base">
                          <FaMapMarkerAlt className="mr-2" />
                          {job.location} {job.jobType}
                        </p>
                        <p className="flex items-center mt-2 text-sm md:text-base">
                          <FaClock className="mr-2" />
                          {job.startDate
                            ? format(new Date(job.startDate), "dd MMM yyyy")
                            : "—"}{" "}
                          –{" "}
                          {job.endDateOrDuration
                            ? format(
                                new Date(job.endDateOrDuration),
                                "dd MMM yyyy",
                              )
                            : "—"}
                        </p>
                        <div className="flex items-center gap-2 text-gray-600 text-sm md:text-base leading-none mt-2">
                          <FaDollarSign className="text-gray-600 w-4 h-4 flex-shrink-0" />
                          <span className="leading-none">
                            {job.internshipType === "STIPEND"
                              ? `${job.compensationDetails?.amount} ${job.compensationDetails?.currency}`
                              : job.internshipType === "FREE"
                                ? "Unpaid / Free"
                                : job.internshipType === "PAID"
                                  ? `Student Pays: ${job.compensationDetails?.amount} ${job.compensationDetails?.currency}`
                                  : "N/A"}
                          </span>
                        </div>
                        <p className="flex items-center mt-2 text-sm md:text-base">
                          <span className="font-medium text-gray-600">
                            {job.internshipMode === "ONLINE"
                              ? "Online"
                              : job.internshipMode === "OFFLINE"
                                ? "Offline"
                                : "Hybrid"}
                          </span>
                        </p>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex flex-wrap gap-2">
                          {job.qualifications &&
                            job.qualifications
                              .slice(0, 2)
                              .map((qualification, i) => (
                                <span
                                  key={i}
                                  className="text-sm md:text-base bg-gray-200 text-gray-800 py-1 px-3 rounded-full"
                                >
                                  {qualification}
                                </span>
                              ))}
                          {job.qualifications &&
                            job.qualifications.length > 2 && (
                              <span className="text-sm md:text-base bg-gray-100 text-gray-700 py-1 px-3 rounded-full">
                                +{job.qualifications.length - 2}
                              </span>
                            )}
                        </div>
                        <button
                          className="text-purple-600 hover:underline text-sm md:text-base"
                          onClick={() => handleViewDetails(job)}
                        >
                          View details
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-center text-gray-500 col-span-full">
                    {/* Add style to this text - 07-08-2026*/}
                    <p className="text-gray-500">No jobs found</p>
                  </p>
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
