import React, { useState, useEffect, useRef } from "react";
import ApplyCards from "./ApplyCards";
import { useTabContext } from "./UserHomePageContext/HomePageContext";
import axios from "../../../../api/axiosInstance";
import { useNavigate } from "react-router-dom";
import Edutechexlogo from "../../../../assets/edutechex_logo_white (1).png";
import JobCardItem from "./JobCardItem";

const Homeimage = "/Home-Image-Edutechex.png";

const MAX_LIMITS = {
  Free: 5,
  Freemium: 5,
  "Premium Basic": 25,
  "Premium Plus": Infinity,
};

const getSavedLimitByPlan = (planType) => {
  switch (planType) {
    case "Premium Plus":
      return Infinity;
    case "Premium Basic":
      return 25;
    case "Freemium":
    default:
      return 3;
  }
};

const Home = () => {
  const { savedJobs, saveJob, removeJob, handleSelectTab } = useTabContext();

  // ─── selectedJob controls which view is shown ───────────────────────────
  // Keeping this as local state means Home is never unmounted → jobData stays
  // intact → scroll position can be restored cheaply.
  const [selectedJob, setSelectedJob] = useState(null);
  const [jobData, setJobData] = useState([]);
  const [, setApplicationCount] = useState(0);
  const [showLimitPopup, setShowLimitPopup] = useState(false);
  const [showSavedJobPopup, setShowSavedJobPopup] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [planType, setPlanType] = useState("Freemium");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const loadMoreRef = useRef(null);

  // Saved scroll position of <main id="main-scroll-container"> before entering detail view
  const savedScrollRef = useRef(0);

  const navigate = useNavigate();
  const loadingRef = useRef(false);
  const hasMoreRef = useRef(true);

  // ─── Data fetching ───────────────────────────────────────────────────────
  const fetchJobData = async (pageNumber = 1) => {
    try {
      if (loadingRef.current || !hasMoreRef.current) return;

      loadingRef.current = true;
      setLoadingJobs(true);

      const userInfo =
        JSON.parse(localStorage.getItem("studentInfo")) ||
        JSON.parse(localStorage.getItem("userInfo")) ||
        {};
      const isPremiumUser = userInfo.isPremium ? "true" : "false";

      const response = await axios.get(
        `/api/interns/approved?isPremium=${isPremiumUser}&page=${pageNumber}&limit=6`,
      );

      const { data, hasMore: more } = response.data;

      setJobData((prev) => (pageNumber === 1 ? data : [...prev, ...data]));
      hasMoreRef.current = more;
      setHasMore(more);
      setPage(pageNumber);
    } catch (error) {
      console.error("Error fetching internships:", error);
    } finally {
      loadingRef.current = false;
      setLoadingJobs(false);
    }
  };

  // ─── Effects ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "preload";
    link.as = "image";
    link.href = "/Home-Image-Edutechex.png";
    link.setAttribute("fetchpriority", "high");
    document.head.appendChild(link);
    return () => document.head.removeChild(link);
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

    fetchJobData(1);
    fetchUserProfile();
  }, []);

  // IntersectionObserver for infinite scroll — only active when list is visible
  useEffect(() => {
    if (!loadMoreRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const firstEntry = entries[0];
        if (
          firstEntry.isIntersecting &&
          hasMoreRef.current &&
          !loadingRef.current
        ) {
          fetchJobData(page + 1);
        }
      },
      { threshold: 0.8 },
    );

    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [page, hasMore, loadingJobs, selectedJob]);

  // ─── Handlers ────────────────────────────────────────────────────────────
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
        // Allow them to view details of jobs they already applied to
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
        // Save the scroll position of the main container BEFORE switching view
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

    // jobData is still in state (Home never unmounted) so cards render
    // synchronously. requestAnimationFrame fires after paint — scroll is ready.
    requestAnimationFrame(() => {
      const container = document.getElementById("main-scroll-container");
      if (container) container.scrollTop = savedScrollRef.current;
    });
  };

  const toggleSaveJob = async (job) => {
    try {
      if (isPremium && planType === "Freemium") return;

      const savedLimit = getSavedLimitByPlan(planType);
      const jobExists = savedJobs.some((savedJob) => {
        const jobToCheck = savedJob.savedJob || savedJob;
        return jobToCheck.jobId?._id === job._id || jobToCheck._id === job._id;
      });

      if (
        !jobExists &&
        savedJobs.length >= savedLimit &&
        savedLimit !== Infinity
      ) {
        setShowSavedJobPopup(true);
        return;
      }

      if (jobExists) {
        await removeJob(job._id);
      } else {
        await saveJob(job);
      }
    } catch (error) {
      console.error("Error toggling job save:", error);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="font-poppins">
      {selectedJob ? (
        // ── Detail view ──────────────────────────────────────────────────
        // selectedJob is set → list is NOT rendered → IntersectionObserver
        // does NOT fire → no background pagination requests.
        <ApplyCards
          job={selectedJob}
          onBack={handleBack}
          isPremium={isPremium}
        />
      ) : (
        // ── List view ────────────────────────────────────────────────────
        <>
          {/* Header Banner */}
          <div className="relative w-full rounded-none overflow-hidden shadow-sm bg-white mb-6 border border-gray-200 flex items-center justify-center">
            <img
              src={Homeimage}
              alt="Finding Your Dream Job Now Made Easier With Edutechex"
              className="w-full h-auto object-contain block max-w-full rounded-none"
              fetchpriority="high"
              width="1132"
              height="300"
            />
          </div>

          {/* Job cards */}
          <section className="pt-2 pb-10 px-0 sm:px-2 lg:px-4">
            <h2 className="text-3xl font-bold mb-2">Find your next role</h2>
            <p className="text-gray-600 mb-6">
              Recommendations based on your profile
            </p>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5 lg:gap-6 w-full min-w-0">
              {jobData.map((job) => {
                const saved = savedJobs.some(
                  (savedJob) =>
                    savedJob.jobId?._id === job._id ||
                    savedJob.jobId === job._id ||
                    savedJob._id === job._id,
                );

                return (
                  <JobCardItem
                    key={job._id}
                    job={job}
                    isSaved={saved}
                    onToggleSave={toggleSaveJob}
                    onViewDetails={handleViewDetails}
                  />
                );
              })}
            </div>

            {/* Load-more sentinel — inside list branch so observer is disconnected
                when the detail view is shown, preventing background fetches */}
            <div
              ref={loadMoreRef}
              className="h-10 flex justify-center items-center mt-4"
            >
              {loadingJobs && (
                <span className="text-gray-500 text-sm">
                  Loading more internships…
                </span>
              )}
            </div>
          </section>
        </>
      )}

      {/* Edutechex analysis FAB */}
      <div className="fixed bottom-28 right-6 z-50">
        <button
          onClick={() => navigate("/edutechex-analysis")}
          className="bg-white text-white rounded-full shadow-lg p-4 hover:bg-blue-700 transition duration-300"
        >
          <img
            src={Edutechexlogo}
            alt="Edutechex Analysis"
            className="w-12 h-12"
          />
        </button>
      </div>

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

export default Home;
