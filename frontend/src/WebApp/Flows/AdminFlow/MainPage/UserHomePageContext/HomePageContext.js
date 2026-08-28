import React, { createContext, useEffect, useState, useContext } from 'react';
import { useLocation, useNavigate } from "react-router-dom";

const UserHomePageContext = createContext();
const DEFAULT_TAB = "home";
const ADMIN_SELECTED_TAB_KEY = "adminSelectedTab";
const ADMIN_BASE_PATH = "/admin-main-page";
const VALID_TABS = new Set([
  "home",
  "user-management",
  "school-accounts",
  "analytics",
  "settings-platform",
  "settings-roles",
  "settings-security",
  "bin",
  "partner-accounts",
  "internship-posts",
  "certificate-approvals",
  "internship-payments",
  "partner-payments",
  "feedback-list",
  "user-feedback",
  "partner-feedback",
  "school-feedback",
  "subscription-overview",
  "student-subscriptions",
  "partner-subscriptions",
  "school-admin-subscriptions",
  "admin-support",
  "support-Partner-admins",
  "support-tickets",
  "support-school-students",
  "support-school-admins",
]);

const TAB_ROUTE_SEGMENTS = {
  home: "dashboard",
  "user-management": "user-management",
  "school-accounts": "school-accounts",
  analytics: "analytics",
  "settings-platform": "settings/platform",
  "settings-roles": "settings/roles",
  "settings-security": "settings/security",
  bin: "bin",
  "partner-accounts": "partner-accounts",
  "internship-posts": "internship-posts",
  "certificate-approvals": "certificate-approvals",
  "internship-payments": "internship-payments",
  "partner-payments": "partner-payments",
  "feedback-list": "feedback-list",
  "user-feedback": "user-feedback",
  "partner-feedback": "partner-feedback",
  "school-feedback": "school-feedback",
  "subscription-overview": "subscriptions",
  "student-subscriptions": "subscriptions/students",
  "partner-subscriptions": "subscriptions/partners",
  "school-admin-subscriptions": "subscriptions/schools",
  "admin-support": "support/all",
  "support-Partner-admins": "support/partners",
  "support-tickets": "support/students",
  "support-school-students": "support/school-students",
  "support-school-admins": "support/school-admins",
};

const normalizePath = (path = "") => {
  const cleanedPath = path.replace(/\/+$/, "");
  return cleanedPath || "/";
};

const TAB_PATHS = Object.fromEntries(
  Object.entries(TAB_ROUTE_SEGMENTS).map(([tab, segment]) => [
    tab,
    `${ADMIN_BASE_PATH}/${segment}`,
  ])
);

const getTabFromPathname = (pathname = "") => {
  const normalizedPath = normalizePath(pathname);

  if (normalizedPath === ADMIN_BASE_PATH) {
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

    const savedTab = window.sessionStorage.getItem(ADMIN_SELECTED_TAB_KEY);
    return VALID_TABS.has(savedTab) ? savedTab : DEFAULT_TAB;
  });
  const [savedJobs, setSavedJobs] = useState([]);
  const [applications, setApplications] = useState([]);

  const handleSelectTab = (tab) => {
    if (!VALID_TABS.has(tab)) return;

    setSelectedTab(tab);

    const currentPath = normalizePath(location.pathname);
    const nextPath = TAB_PATHS[tab] || ADMIN_BASE_PATH;

    if (currentPath !== nextPath) {
      navigate(nextPath);
    }
  };

  useEffect(() => {
    if (typeof window === "undefined" || !VALID_TABS.has(selectedTab)) return;

    window.sessionStorage.setItem(ADMIN_SELECTED_TAB_KEY, selectedTab);
  }, [selectedTab]);

  useEffect(() => {
    const currentPath = normalizePath(location.pathname);

    if (!currentPath.startsWith(ADMIN_BASE_PATH)) return;

    const tabFromPath = getTabFromPathname(currentPath);

    if (tabFromPath) {
      setSelectedTab((currentTab) => (currentTab === tabFromPath ? currentTab : tabFromPath));
      return;
    }

    setSelectedTab(DEFAULT_TAB);
    navigate(ADMIN_BASE_PATH, { replace: true });
  }, [location.pathname, navigate]);

  const saveJob = (job) => {
    setSavedJobs((prevJobs) => {
      const existingJobIndex = prevJobs.findIndex(savedJob => savedJob.jobTitle === job.jobTitle);
      if (existingJobIndex !== -1) {
        const updatedJobs = [...prevJobs];
        updatedJobs[existingJobIndex] = job;
        return updatedJobs;
      }
      return [...prevJobs, job];
    });
  };

  const removeJob = (job) => {
    setSavedJobs((prevJobs) => prevJobs.filter((j) => j.jobTitle !== job.jobTitle));
  };

  const applyJob = (job) => {
    setApplications((prevJobs) => {
      const existingJobIndex = prevJobs.findIndex(appJob => appJob.jobTitle === job.jobTitle);
      if (existingJobIndex !== -1) {
        return prevJobs;
      }
      return [...prevJobs, job];
    });
  };

  return (
    <UserHomePageContext.Provider value={{ selectedTab, handleSelectTab, savedJobs, saveJob, removeJob, applications, applyJob }}>
      {children}
    </UserHomePageContext.Provider>
  );
};

export const useTabContext = () => useContext(UserHomePageContext);
