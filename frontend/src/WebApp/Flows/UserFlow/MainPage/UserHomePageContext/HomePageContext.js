import React, { createContext, useState, useContext, useEffect, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "../../../../../api/axiosInstance";
import { isB2BContext } from "../../../../../utils/domain";

const UserHomePageContext = createContext();
const DEFAULT_TAB = "home";
const DEFAULT_BASE_PATH = "/user-main-page";

export const getBasePath = (pathname = "") => {
  if (pathname.startsWith("/b2b-main-page")) return "/b2b-main-page";
  if (pathname.startsWith("/user-main-page")) return "/user-main-page";
  if (isB2BContext()) return "/b2b-main-page";
  return DEFAULT_BASE_PATH;
};

export const getTabPath = (tab, basePath = DEFAULT_BASE_PATH) => {
  const segment = TAB_ROUTE_SEGMENTS[tab] || tab;
  return `${basePath}/${segment}`;
};
const VALID_TABS = new Set([
  "home",
  "searchbar",
  "recommendations",
  "messages",
  "applications",
  "saved-jobs",
  "assessment",
  "profile",
  "support",
  "filter",
  "notifications",
  "premium",
  "offer-letter",
  "attendance",
  "advanced-ai",
  "quantum-computing",
  "climate-tech",
  "biotech",
  "materials-science",
  "space-exploration",
  "neurotechnology",
  "precision-agriculture",
  "advanced-robotics",
  "renewable-energy",
  "architecture-built-environment",
]);

const TAB_ROUTE_SEGMENTS = {
  home: "home",
  searchbar: "search",
  recommendations: "recommendations",
  messages: "messages",
  applications: "applications",
  "saved-jobs": "saved-jobs",
  assessment: "assessment",
  profile: "profile",
  support: "support",
  filter: "filter",
  notifications: "notifications",
  premium: "premium",
  "offer-letter": "offer-letter",
  attendance: "attendance",
  "advanced-ai": "advanced-ai",
  "quantum-computing": "quantum-computing",
  "climate-tech": "climate-tech",
  biotech: "biotech",
  "materials-science": "materials-science",
  "space-exploration": "space-exploration",
  "neurotechnology": "neurotechnology",
  "precision-agriculture": "precision-agriculture",
  "advanced-robotics": "advanced-robotics",
  "renewable-energy": "renewable-energy",
  "architecture-built-environment": "architecture-built-environment",
};

const normalizePath = (path = "") => {
  const cleanedPath = path.replace(/\/+$/, "");
  return cleanedPath || "/";
};

const getTabFromLocation = (pathname = "", search = "") => {
  const normalizedPath = normalizePath(pathname);
  const basePath = getBasePath(normalizedPath);

  if (normalizedPath !== basePath) {
    const matchedTab = Object.entries(TAB_ROUTE_SEGMENTS).find(
      ([, segment]) => `${basePath}/${segment}` === normalizedPath
    );
    if (matchedTab) return matchedTab[0];
  }

  const openTab = new URLSearchParams(search).get("openTab");
  if (VALID_TABS.has(openTab)) return openTab;

  if (normalizedPath === basePath) {
    return DEFAULT_TAB;
  }

  return null;
};

export const TabProvider = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [selectedTab, setSelectedTab] = useState(() => {
    if (typeof window === "undefined") return DEFAULT_TAB;
    return getTabFromLocation(window.location.pathname, window.location.search) || DEFAULT_TAB;
  });
  const [savedJobs, setSavedJobs] = useState([]);
  const [applications] = useState([]);
  const [isLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isLoadingSavedJobs, setIsLoadingSavedJobs] = useState(true);

  const userInfo = (JSON.parse(localStorage.getItem("studentInfo")) || JSON.parse(localStorage.getItem("userInfo")));
  const userId = userInfo?._id;

  const getSavedJobs = useCallback(async () => {
    if (!userId) {
      setIsLoadingSavedJobs(false);
      return;
    }

    setIsLoadingSavedJobs(true);
    try {
      const { data } = await axios.get(`/api/savedJobs/getSavedJobs/${userId}`);
      console.log("✅ Fetched saved jobs:", data);
      setSavedJobs(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("❌ Error fetching saved jobs:", err);
      setError("Failed to fetch saved jobs. Please try again later.");
    } finally {
      setIsLoadingSavedJobs(false);
    }
  }, [userId]);

  useEffect(() => {
    getSavedJobs();
  }, [getSavedJobs]);

  const handleSelectTab = useCallback((tab) => {
    if (!VALID_TABS.has(tab)) return;

    setSelectedTab(tab);

    const currentPath = typeof window !== "undefined" ? normalizePath(window.location.pathname) : "";
    const hasLegacyQuery = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("openTab");
    const basePath = getBasePath(currentPath);
    const nextPath = getTabPath(tab, basePath);

    if (currentPath !== nextPath || hasLegacyQuery) {
      navigate(nextPath);
    }
  }, [navigate]);

  useEffect(() => {
    const currentPath = normalizePath(location.pathname);
    const basePath = getBasePath(currentPath);

    if (!currentPath.startsWith("/user-main-page") && !currentPath.startsWith("/b2b-main-page")) return;

    const hasLegacyQuery = new URLSearchParams(location.search).has("openTab");
    const tabFromLocation = getTabFromLocation(location.pathname, location.search);

    if (tabFromLocation) {
      setSelectedTab((currentTab) => (currentTab === tabFromLocation ? currentTab : tabFromLocation));

      if (hasLegacyQuery) {
        navigate(getTabPath(tabFromLocation, basePath), { replace: true });
      }
      return;
    }

    setSelectedTab(DEFAULT_TAB);
    navigate(basePath, { replace: true });
  }, [location.pathname, location.search, navigate]);

  const saveJob = async (job) => {
    try {
      const { data } = await axios.post("/api/savedJobs/save", { userId, jobId: job._id });

      setSavedJobs((prev) => [
        ...prev,
        data?.jobId ? data : { ...data, jobId: job },
      ]);
    } catch (saveError) {
      console.error("❌ Error saving job:", saveError.response?.data || saveError.message);
    }
  };

  const removeJob = async (jobId) => {
    try {
      await axios.delete(`/api/savedJobs/remove/${userId}/${jobId}`);

      setSavedJobs((prevJobs) =>
        prevJobs.filter((job) => {
          const jobToCheck = job.savedJob || job;
          return jobToCheck.jobId?._id !== jobId && jobToCheck._id !== jobId;
        })
      );
    } catch (removeError) {
      console.error("❌ Error removing job:", removeError.response?.data || removeError.message);
    }
  };

  return (
    <UserHomePageContext.Provider
      value={{
        selectedTab,
        handleSelectTab,
        savedJobs,
        getSavedJobs,
        saveJob,
        removeJob,
        applications,
        isLoading,
        error,
        isLoadingSavedJobs,
      }}
    >
      {children}
    </UserHomePageContext.Provider>
  );
};

export const useTabContext = () => useContext(UserHomePageContext);
export { UserHomePageContext };
