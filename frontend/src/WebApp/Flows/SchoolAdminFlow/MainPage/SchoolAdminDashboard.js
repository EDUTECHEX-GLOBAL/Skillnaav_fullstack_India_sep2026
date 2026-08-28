// File: SchoolAdminDashboard.js

import React, { useState, useCallback, useEffect } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import DashboardHome from "./pages/DashboardHome";
import StudentsList from "./pages/StudentsList";
import Subscriptions from "./pages/Subscriptions";
import SubscriptionStatus from "./pages/SubscriptionStatus";
import Internships from "./pages/Internships";
import SchoolAdminProfile from "./pages/SchoolAdminProfile";
import SchoolAdminNavbar from "./pages/SchoolAdminNavbar";
import SchoolAdminSidebar from "./pages/SchoolAdminSidebar";
import UploadStudents from "./pages/UploadStudents";
import StudentProfileOverview from "./pages/StudentProfileOverview";
import SavedJobsPage from "./pages/SavedJobsPage";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa";

const DEFAULT_TAB = "dashboard";
const SCHOOL_ADMIN_SELECTED_TAB_KEY = "schoolAdminSelectedTab";
const SCHOOL_ADMIN_BASE_PATH = "/schooladmin/dashboard";
const VALID_TABS = new Set([
  "dashboard",
  "students",
  "upload",
  "internships",
  "saved-jobs",
  "subscription-status",
  "subscriptions",
  "profile",
  "curriculum",
  "profile-completion",
  "support",
]);

const TAB_ROUTE_SEGMENTS = {
  dashboard: "",
  students: "students",
  upload: "upload",
  internships: "internships",
  "saved-jobs": "saved-jobs",
  "subscription-status": "subscription-status",
  subscriptions: "subscriptions",
  profile: "profile",
  "profile-completion": "profile-completion",
  support: "support",
};

const normalizePath = (path = "") => {
  const cleanedPath = path.replace(/\/+$/, "");
  return cleanedPath || "/";
};

const getPathForTab = (tab) => {
  const segment = TAB_ROUTE_SEGMENTS[tab];
  return segment ? `${SCHOOL_ADMIN_BASE_PATH}/${segment}` : SCHOOL_ADMIN_BASE_PATH;
};

const getTabFromPathname = (pathname = "") => {
  const normalizedPath = normalizePath(pathname);

  if (normalizedPath === SCHOOL_ADMIN_BASE_PATH) {
    return DEFAULT_TAB;
  }

  const matchedTab = Object.entries(TAB_ROUTE_SEGMENTS).find(([, segment]) => {
    if (!segment) return false;
    return `${SCHOOL_ADMIN_BASE_PATH}/${segment}` === normalizedPath;
  });

  return matchedTab ? matchedTab[0] : null;
};

const SchoolAdminDashboard = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [selectedTab, setSelectedTab] = useState(() => {
    if (typeof window === "undefined") return DEFAULT_TAB;

    const tabFromPath = getTabFromPathname(window.location.pathname);
    if (tabFromPath) return tabFromPath;

    const savedTab = window.sessionStorage.getItem(SCHOOL_ADMIN_SELECTED_TAB_KEY);
    return VALID_TABS.has(savedTab) ? savedTab : DEFAULT_TAB;
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDesktopSidebarOpen, setIsDesktopSidebarOpen] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined" || !VALID_TABS.has(selectedTab)) return;
    window.sessionStorage.setItem(SCHOOL_ADMIN_SELECTED_TAB_KEY, selectedTab);
  }, [selectedTab]);

  useEffect(() => {
    const currentPath = normalizePath(location.pathname);
    if (!currentPath.startsWith(SCHOOL_ADMIN_BASE_PATH)) return;

    const tabFromPath = getTabFromPathname(currentPath);
    if (tabFromPath) {
      setSelectedTab((currentTab) => (currentTab === tabFromPath ? currentTab : tabFromPath));
      return;
    }

    setSelectedTab(DEFAULT_TAB);
    navigate(SCHOOL_ADMIN_BASE_PATH, { replace: true });
  }, [location.pathname, navigate]);

  const handleLogout = useCallback(() => {
    localStorage.removeItem("schoolAdminToken");
    sessionStorage.removeItem(SCHOOL_ADMIN_SELECTED_TAB_KEY);
    navigate("/schooladmin/login");
  }, [navigate]);

  const handleToggleSidebar = useCallback(() => {
    setIsSidebarOpen((prev) => !prev);
  }, []);

  const handleCloseSidebar = useCallback(() => {
    setIsSidebarOpen(false);
  }, []);

  const handleSelectTab = useCallback((tab) => {
    if (!VALID_TABS.has(tab)) return;

    setSelectedTab(tab);

    const nextPath = getPathForTab(tab);
    const currentPath = normalizePath(location.pathname);

    if (currentPath !== nextPath) {
      navigate(nextPath);
    }
  }, [location.pathname, navigate]);

  const renderContent = useCallback(() => {
    switch (selectedTab) {
      case "dashboard":
        return <DashboardHome />;
      case "students":
        return <StudentsList />;
      case "upload":
        return <UploadStudents />;
      case "internships":
        return <Internships />;
      case "saved-jobs":
        return <SavedJobsPage />;
      case "subscription-status":
        return <SubscriptionStatus />;
      case "subscriptions":
        return <Subscriptions />;
      case "profile":
        return <SchoolAdminProfile />;
      case "profile-completion":
        return <StudentProfileOverview />;
      case "support":
        return <Navigate to="/schooladmin-support" replace />;
      default:
        return <DashboardHome />;
    }
  }, [selectedTab]);

  return (
    <div className="flex flex-col h-screen font-poppins bg-gray-50">
      <SchoolAdminNavbar
        onLogout={handleLogout}
        onToggleSidebar={handleToggleSidebar}
      />

      <div className="flex flex-1 overflow-hidden relative">
        <SchoolAdminSidebar
          selectedTab={selectedTab}
          setSelectedTab={handleSelectTab}
          isOpen={isSidebarOpen}
          onClose={handleCloseSidebar}
          isDesktopOpen={isDesktopSidebarOpen}
        />

        <button
          onClick={() => setIsDesktopSidebarOpen((prev) => !prev)}
          className="hidden md:flex items-center justify-center absolute top-4 z-50 w-6 h-6 rounded-full bg-white border border-gray-300 shadow-md hover:bg-teal-50 hover:border-teal-400 transition-all duration-200"
          style={{ left: isDesktopSidebarOpen ? "248px" : "48px" }}
          title={isDesktopSidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
        >
          {isDesktopSidebarOpen ? (
            <FaChevronLeft className="text-teal-600 text-xs" />
          ) : (
            <FaChevronRight className="text-teal-600 text-xs" />
          )}
        </button>

        <main className="flex-1 overflow-y-auto hide-scrollbar p-4">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default SchoolAdminDashboard;
