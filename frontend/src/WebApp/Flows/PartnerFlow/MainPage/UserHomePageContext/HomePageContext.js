//File: HomePageContext.js

import React, { createContext, useEffect, useState, useContext } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const LS_TAB_KEY = "partnerDashboard_selectedTab";
const UserHomePageContext = createContext();
const DEFAULT_TAB = "your-job-posts";
const PARTNER_SELECTED_TAB_KEY = "partnerSelectedTab";
const PARTNER_BASE_PATH = "/partner-main-page";

const VALID_TABS = new Set([
  "your-job-posts",
  "post-a-job",
  "messages",
  "applications",
  "instructors",
  "offer-templates",
  "custom-internship-certificate",
  "stipend-details",
  "internship-payments",
  "mock-interviews",
  "bin",
  "profile",
  "support",
  "support-center",
  "admin-support",
  "support-Partner-admins",
  "support-tickets",
  "support-school-students",
  "support-school-admins",
  "upgrade",
]);

const TAB_ROUTE_SEGMENTS = {
  "your-job-posts": "internship-posts",
  "post-a-job": "post-internship",
  messages: "messages",
  applications: "applications",
  instructors: "instructors",
  "offer-templates": "offer-templates",
  "custom-internship-certificate": "internship-certificate",
  "stipend-details": "stipend-details",
  "internship-payments": "internship-payments",
  "mock-interviews": "mock-interviews",
  bin: "bin",
  profile: "profile",
  support: "support",
  "support-center": "support-center",
  "admin-support": "admin-support",
  "support-Partner-admins": "support-partner-admins",
  "support-tickets": "support-tickets",
  "support-school-students": "support-school-students",
  "support-school-admins": "support-school-admins",
  upgrade: "upgrade",
};

const normalizePath = (path = "") => {
  const cleanedPath = path.replace(/\/+$/, "");
  return cleanedPath || "/";
};

const TAB_PATHS = Object.fromEntries(
  Object.entries(TAB_ROUTE_SEGMENTS).map(([tab, segment]) => [
    tab,
    `${PARTNER_BASE_PATH}/${segment}`,
  ])
);

const getTabFromPathname = (pathname = "") => {
  const normalizedPath = normalizePath(pathname);

  if (normalizedPath === PARTNER_BASE_PATH) {
    return DEFAULT_TAB;
  }

  const matchedTab = Object.entries(TAB_PATHS).find(([, path]) => path === normalizedPath);
  return matchedTab ? matchedTab[0] : null;
};

export const TabProvider = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [selectedTab, setSelectedTab] = useState(() => {
    if (typeof window === "undefined") return DEFAULT_TAB;

    const tabFromPath = getTabFromPathname(window.location.pathname);
    if (tabFromPath) return tabFromPath;

    const sessionTab = window.sessionStorage.getItem(PARTNER_SELECTED_TAB_KEY);
    if (VALID_TABS.has(sessionTab)) return sessionTab;

    const localTab = window.localStorage.getItem(LS_TAB_KEY);
    return VALID_TABS.has(localTab) ? localTab : DEFAULT_TAB;
  });
  const [savedJobs, setSavedJobs] = useState([]);
  const [applications, setApplications] = useState([]);

  const handleSelectTab = (tab) => {
    if (!VALID_TABS.has(tab)) return;

    try {
      window.localStorage.setItem(LS_TAB_KEY, tab);
    } catch {}

    setSelectedTab(tab);

    const currentPath = normalizePath(location.pathname);
    const nextPath = TAB_PATHS[tab] || PARTNER_BASE_PATH;

    if (currentPath !== nextPath) {
      navigate(nextPath);
    }
  };

  useEffect(() => {
    if (typeof window === "undefined" || !VALID_TABS.has(selectedTab)) return;

    window.sessionStorage.setItem(PARTNER_SELECTED_TAB_KEY, selectedTab);
  }, [selectedTab]);

  useEffect(() => {
    const currentPath = normalizePath(location.pathname);

    if (!currentPath.startsWith(PARTNER_BASE_PATH)) return;

    const tabFromPath = getTabFromPathname(currentPath);

    if (tabFromPath) {
      setSelectedTab((currentTab) => (currentTab === tabFromPath ? currentTab : tabFromPath));
      return;
    }

    setSelectedTab(DEFAULT_TAB);
    navigate(PARTNER_BASE_PATH, { replace: true });
  }, [location.pathname, navigate]);

  const saveJob = (job) => {
    setSavedJobs((prevJobs) => {
      const existingJobIndex = prevJobs.findIndex(
        (savedJob) => savedJob.jobTitle === job.jobTitle
      );
      if (existingJobIndex !== -1) {
        const updatedJobs = [...prevJobs];
        updatedJobs[existingJobIndex] = job;
        return updatedJobs;
      }
      return [...prevJobs, job];
    });
  };

  const removeJob = (job) => {
    setSavedJobs((prevJobs) =>
      prevJobs.filter((j) => j.jobTitle !== job.jobTitle)
    );
  };

  const applyJob = (job) => {
    setApplications((prevJobs) => {
      const existingJobIndex = prevJobs.findIndex(
        (appJob) => appJob.jobTitle === job.jobTitle
      );
      if (existingJobIndex !== -1) {
        return prevJobs;
      }
      return [...prevJobs, job];
    });
  };

  return (
    <UserHomePageContext.Provider
      value={{
        selectedTab,
        handleSelectTab,
        savedJobs,
        saveJob,
        removeJob,
        applications,
        applyJob,
      }}
    >
      {children}
    </UserHomePageContext.Provider>
  );
};

export const useTabContext = () => useContext(UserHomePageContext);
