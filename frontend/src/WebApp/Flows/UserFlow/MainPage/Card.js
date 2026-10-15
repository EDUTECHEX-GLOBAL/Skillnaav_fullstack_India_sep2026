import React, { useCallback, useEffect, useRef, useState } from "react";
import axios from "../../../../api/axiosInstance";
import { useTabContext } from "./UserHomePageContext/HomePageContext";

import JobCardItem from "./JobCardItem";

// Cache
const jobCache = {
  data: [],
  page: 1,
  hasMore: true,
  timestamp: null,
};

const CACHE_DURATION = 60000;

const JobCard = ({
  jobs: externalJobs,
  searchTerm = "",
  onViewDetails,
  isRecommendation = false, // NEW: true when rendered inside Recommendations.jsx
}) => {
  const { savedJobs, saveJob, removeJob, handleSelectTab } = useTabContext();
  const [, setIsPremium] = useState(false);
  const [planType, setPlanType] = useState("Freemium");
  const [showSavedJobPopup, setShowSavedJobPopup] = useState(false);

  const isRecommendationMode = Array.isArray(externalJobs);

  const [jobs, setJobs] = useState(externalJobs || jobCache.data || []);
  const [page, setPage] = useState(jobCache.page || 1);
  const [, setHasMore] = useState(jobCache.hasMore !== false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const loadMoreRef = useRef(null);
  const loadingRef = useRef(false);
  const hasMoreRef = useRef(jobCache.hasMore !== false);

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

  /* ----------------------------------
     USE RECOMMENDATION JOBS DIRECTLY
  ---------------------------------- */
  useEffect(() => {
    if (isRecommendationMode) {
      setJobs(externalJobs);
      setHasMore(false);
    }
  }, [externalJobs, isRecommendationMode]);

  /* ----------------------------------
     FETCH APPROVED JOBS (HOME PAGE)
  ---------------------------------- */
  const fetchJobs = useCallback(
    async (pageNumber = 1) => {
      if (
        loadingRef.current ||
        (pageNumber !== 1 && !hasMoreRef.current) ||
        isRecommendationMode
      ) {
        return;
      }

      try {
        loadingRef.current = true;
        setLoading(true);

        if (
          pageNumber === 1 &&
          jobCache.timestamp &&
          Date.now() - jobCache.timestamp < CACHE_DURATION
        ) {
          setJobs(jobCache.data);
          setPage(jobCache.page);
          setHasMore(jobCache.hasMore);
          hasMoreRef.current = jobCache.hasMore;
          loadingRef.current = false;
          setLoading(false);
          return;
        }

        const res = await axios.get(
          `/api/interns/approved?page=${pageNumber}&limit=6`,
        );
        const { data, hasMore: more } = res.data;

        setJobs((prev) => {
          const updated = pageNumber === 1 ? data : [...prev, ...data];
          jobCache.data = updated;
          jobCache.page = pageNumber;
          jobCache.hasMore = more;
          jobCache.timestamp = Date.now();
          return updated;
        });

        hasMoreRef.current = more;
        setHasMore(more);
        setPage(pageNumber);
      } catch {
        setError("Failed to load jobs.");
      } finally {
        loadingRef.current = false;
        setLoading(false);
      }
    },
    [isRecommendationMode],
  );

  /* ----------------------------------
     INITIAL LOAD (ONLY HOME PAGE)
  ---------------------------------- */
  useEffect(() => {
    if (isRecommendationMode) return;
    if (jobCache.data.length > 0) {
      setJobs(jobCache.data);
      setPage(jobCache.page);
      setHasMore(jobCache.hasMore);
      return;
    }
    fetchJobs(1);
  }, [fetchJobs, isRecommendationMode]);

  /* ----------------------------------
     INFINITE SCROLL (ONLY HOME PAGE)
  ---------------------------------- */
  useEffect(() => {
    if (isRecommendationMode || !loadMoreRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMoreRef.current && !loadingRef.current) {
          fetchJobs(page + 1);
        }
      },
      { threshold: 0.8 },
    );

    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [fetchJobs, isRecommendationMode, page]);

  /* ----------------------------------
     SAVED JOB LOGIC
  ---------------------------------- */
  const isJobSaved = (jobId) =>
    savedJobs.some(
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
        savedJobs.length >= savedLimit &&
        savedLimit !== Infinity
      ) {
        setShowSavedJobPopup(true);
        return;
      }
      isJobSaved(job._id) ? await removeJob(job._id) : await saveJob(job);
    } catch (err) {
      console.error("Error toggling save job:", err);
    }
  };

  /* ----------------------------------
     FETCH USER PROFILE
  ---------------------------------- */
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
      } catch (err) {
        console.error("Error fetching user profile:", err);
      }
    };
    fetchUserProfile();
  }, []);

  const filteredJobs = jobs.filter((job) =>
    job.jobTitle?.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  if (error) return <p>{error}</p>;

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5 lg:gap-6 w-full min-w-0">
        {filteredJobs.length > 0 ? (
          filteredJobs.map((job, index) => (
            <JobCardItem
              key={job._id || index}
              job={job}
              isSaved={isJobSaved(job._id)}
              onToggleSave={toggleSaveJob}
              onViewDetails={onViewDetails}
              isRecommendation={isRecommendation}
              rankIndex={index}
            />
          ))
        ) : (
          <div className="col-span-2 flex flex-col items-center justify-center py-16 text-gray-400 gap-2">
            <p className="text-sm font-medium">No jobs found</p>
          </div>
        )}
      </div>

      {/* Saved Jobs Limit Popup */}
      {showSavedJobPopup && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white p-6 rounded-xl shadow-xl max-w-sm w-full text-center">
            <h2 className="text-lg font-semibold text-gray-800">
              Saved Jobs Limit Reached
            </h2>
            <p className="text-gray-500 mt-2 text-sm">
              You have reached the maximum of{" "}
              {getSavedLimitByPlan(planType) === Infinity
                ? "unlimited"
                : getSavedLimitByPlan(planType)}{" "}
              saved jobs for your plan.
            </p>
            <div className="flex justify-between mt-5 gap-3">
              <button
                className="flex-1 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-500 hover:bg-gray-50 transition"
                onClick={() => setShowSavedJobPopup(false)}
              >
                Close
              </button>
              <button
                className="flex-1 py-2 rounded-lg bg-purple-500 hover:bg-purple-600 text-white text-sm font-medium transition"
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

      {/* Infinite scroll trigger (home page only) */}
      {!isRecommendationMode && (
        <div
          ref={loadMoreRef}
          className="h-10 flex justify-center items-center"
        >
          {loading && (
            <span className="text-gray-400 text-sm">
              Loading more internships…
            </span>
          )}
        </div>
      )}
    </>
  );
};

export default JobCard;
