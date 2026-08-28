// File: SchoolAdminSidebar.js

import React from "react";
import {
  FaHome,
  FaUserGraduate,
  FaBriefcase,
  FaCreditCard,
  FaSignOutAlt,
  FaIdCard,
  FaBook,
  FaChartPie,
  FaBookmark,
  FaHeadset,
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import axios from "../../../../../api/axiosInstance";
import { useFeedback } from "../../../../../context/FeedbackContext";
import { schoolAdminFlowQuestions } from "../../../../../components/FeedbackModal/questionSets";

const SchoolAdminSidebar = ({
  selectedTab,
  setSelectedTab,
  isOpen,
  onClose,
  isDesktopOpen = true,
}) => {
  const navigate = useNavigate();
  const { openFeedback } = useFeedback();
  const [showLogoutModal, setShowLogoutModal] = React.useState(false);

  const menuItems = [
    { id: "dashboard", label: "Dashboard", icon: <FaHome /> },
    { id: "students", label: "Students", icon: <FaUserGraduate /> },
    { id: "profile-completion", label: "Profile Completion", icon: <FaChartPie /> },
    { id: "upload", label: "Upload Students", icon: <FaBook /> },
    { id: "internships", label: "Internships", icon: <FaBriefcase /> },
    { id: "saved-jobs", label: "Saved Jobs", icon: <FaBookmark /> },
    { id: "subscription-status", label: "Subscriptions History", icon: <FaCreditCard /> },
    { id: "support", label: "Support", icon: <FaHeadset /> },
    { id: "profile", label: "Profile", icon: <FaIdCard /> },
  ];

  const parseJson = (key) => {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : null;
    } catch {
      return null;
    }
  };

  const performLogout = async () => {
    try {
      const sessionId = localStorage.getItem("sessionId");
      const token =
        localStorage.getItem("userToken") ||
        localStorage.getItem("schoolAdminToken");

      if (sessionId && token) {
        try {
          await axios.post(
            "/api/sessions/logout",
            { sessionId },
            { headers: { Authorization: `Bearer ${JSON.parse(token)}` } }
          );
        } catch (err) {
          console.warn("Session logout request failed:", err?.message || err);
        }
      }
    } finally {
      try {
        localStorage.removeItem("sessionId");
        localStorage.removeItem("userToken");
        localStorage.removeItem("userInfo");
        localStorage.removeItem("schoolAdminToken");
        localStorage.removeItem("schoolAdminId");
        localStorage.removeItem("schoolAdminProfile");
        localStorage.removeItem("loginTime");
        sessionStorage.removeItem("schoolAdminSelectedTab");
      } catch (err) {
        console.warn("LocalStorage cleanup error:", err);
      }
      navigate("/schooladmin/login");
    }
  };

  const handleLogoutTrigger = async () => {
    const parseLoginValue = (value) => {
      if (value === null || value === undefined) return NaN;
      const parsed = Number(String(value));
      return Number.isFinite(parsed) ? parsed : NaN;
    };

    const loginTime =
      parseLoginValue(localStorage.getItem("loginTime")) ||
      parseLoginValue(sessionStorage.getItem("loginTime"));
    const oneMinutePassed = !Number.isNaN(loginTime) && Date.now() - loginTime >= 60000;

    if (!oneMinutePassed) return performLogout();

    const parsedUserInfo = parseJson("schoolAdminInfo") || parseJson("userInfo");
    const parsedSchoolProfile = parseJson("schoolAdminProfile");

    const adminId =
      parsedUserInfo?._id ||
      parsedUserInfo?.id ||
      parsedSchoolProfile?._id ||
      parsedSchoolProfile?.id ||
      localStorage.getItem("schoolAdminId") ||
      null;

    const snapshot = {
      _id: adminId,
      name: parsedUserInfo?.name || parsedSchoolProfile?.schoolName || null,
      email: parsedUserInfo?.email || parsedSchoolProfile?.email || null,
    };

    if (!adminId) {
      openFeedback({
        flow: "schoolAdmin",
        questions: schoolAdminFlowQuestions,
        triggerInfo: { type: "logout", page: window.location.pathname },
        user: snapshot,
        postSubmitCallback: () => performLogout(),
      });
      return;
    }

    try {
      const resp = await axios.get("/api/feedback/check", {
        params: { userId: adminId, flow: "schoolAdmin" },
      });
      if (resp.data?.alreadySubmitted) {
        performLogout();
        return;
      }
    } catch (err) {
      console.warn("Feedback check failed; opening modal anyway:", err?.message || err);
    }

    openFeedback({
      flow: "schoolAdmin",
      questions: schoolAdminFlowQuestions,
      triggerInfo: { type: "logout", page: window.location.pathname },
      user: snapshot,
      postSubmitCallback: () => performLogout(),
    });
  };

  const handleTabClick = async (tab) => {
    if (tab === "logout") {
      setShowLogoutModal(true);
      return;
    }

    if (tab === "support") {
      const win = window.open("/schooladmin-support", "_blank", "noopener,noreferrer");
      if (win) win.opener = null;
      if (onClose) onClose();
      return;
    }

    setSelectedTab(tab);
    if (onClose) onClose();
  };

  const SidebarItem = ({ id, label, icon }) => {
    const isActive = selectedTab === id;
    return (
      <button
        onClick={() => handleTabClick(id)}
        className={`flex items-center w-full p-3 rounded-lg font-medium transition-colors ${
          isActive ? "bg-teal-100 text-teal-700" : "text-gray-600 hover:bg-gray-100"
        } ${!isDesktopOpen ? "justify-center" : ""}`}
        title={!isDesktopOpen ? label : ""}
      >
        <span className={`text-lg flex-shrink-0 ${isActive ? "text-teal-600" : "text-gray-500"} ${isDesktopOpen ? "mr-3" : ""}`}>
          {icon}
        </span>
        {isDesktopOpen && <span className="whitespace-nowrap">{label}</span>}
      </button>
    );
  };

  return (
    <>
      {isOpen && (
        <div
          className="fixed top-14 right-0 bottom-0 left-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={onClose}
        />
      )}

      <div
        className={`
          fixed md:relative z-50 md:z-auto
          top-14 bottom-0 left-0 md:top-0 md:bottom-auto
          bg-white shadow-lg font-poppins
          transition-all duration-300 ease-in-out
          flex flex-col overflow-hidden
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
          md:translate-x-0
          ${!isDesktopOpen ? "md:w-14" : "md:w-64"}
          w-64
        `}
      >
        <div className="w-full h-full flex flex-col">
          <div className={`flex-1 overflow-y-auto pt-4 pb-6 hide-scrollbar ${isDesktopOpen ? "px-3" : "px-1"}`}>
            <ul className="space-y-1">
              {menuItems.map((item) => (
                <li key={item.id}>
                  <SidebarItem {...item} />
                </li>
              ))}

              <li>
                <button
                  onClick={() => handleTabClick("logout")}
                  className={`flex items-center w-full p-3 rounded-lg font-medium text-red-500 hover:bg-red-50 transition-colors ${
                    !isDesktopOpen ? "justify-center" : ""
                  }`}
                  title={!isDesktopOpen ? "Logout" : ""}
                >
                  <FaSignOutAlt className={`text-lg flex-shrink-0 ${isDesktopOpen ? "mr-3" : ""}`} />
                  {isDesktopOpen && <span>Logout</span>}
                </button>
              </li>
            </ul>
          </div>

          {isDesktopOpen && (
            <div className="p-4 bg-teal-50 rounded-lg m-3">
              <h3 className="text-teal-700 text-sm font-semibold">UPGRADE PLAN</h3>
              <p className="text-xs text-teal-600 mt-1">
                Unlock more student seats and premium features.
              </p>
              <button
                onClick={() => handleTabClick("subscriptions")}
                className="mt-3 w-full bg-teal-600 text-white py-2 px-4 rounded-lg hover:bg-teal-700 transition text-sm"
              >
                Upgrade Now
              </button>
            </div>
          )}
        </div>
      </div>

      {showLogoutModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-[90%] max-w-sm transform transition-all">
            <h3 className="text-lg font-semibold text-gray-800 text-center mb-6">
              Are you sure you want to logout?
            </h3>
            <div className="flex justify-center gap-4">
              <button
                onClick={async () => {
                  setShowLogoutModal(false);
                  await handleLogoutTrigger();
                }}
                className="px-6 py-2.5 rounded-lg bg-red-500 text-white font-medium hover:bg-red-600 transition-colors"
              >
                Yes
              </button>
              <button
                onClick={() => setShowLogoutModal(false)}
                className="px-6 py-2.5 rounded-lg text-gray-600 font-medium hover:bg-gray-100 transition-colors"
              >
                No
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default SchoolAdminSidebar;
