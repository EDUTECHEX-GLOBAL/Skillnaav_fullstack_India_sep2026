//File: Sidebar.js

import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faUser,
  faBriefcase,
  faPlus,
  faEnvelope,
  faSignOutAlt,
  faFileAlt,
  faMoneyBillWave,
  faUsers,
  faCertificate,
  faFileInvoiceDollar,
  faTrash,
  faHeadset,
  faFileContract,
  faComments,
} from "@fortawesome/free-solid-svg-icons";

import { useTabContext } from "./UserHomePageContext/HomePageContext";
import { useNavigate } from "react-router-dom";
import { useFeedback } from "../../../../context/FeedbackContext";
import { partnerFlowQuestions } from "../../../../components/FeedbackModal/questionSets";
import axios from "../../../../api/axiosInstance";

const Sidebar = ({ isOpen, onClose, isDesktopOpen = true }) => {
  const { handleSelectTab, selectedTab } = useTabContext();
  const navigate = useNavigate();
  const { openFeedback } = useFeedback();

  const parseStorageJson = (key) => {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : null;
    } catch {
      return null;
    }
  };

  const performLogout = async () => {
    const sessionId = localStorage.getItem("sessionId");
    const token = parseStorageJson("userToken");

    if (sessionId && token) {
      try {
        await axios.post(
          "/api/sessions/logout",
          { sessionId },
          { headers: { Authorization: `Bearer ${token}` } },
        );
      } catch (err) {
        console.warn(
          "Logout session API failed:",
          err?.response?.data || err?.message || err,
        );
      }
    }

    try {
      localStorage.removeItem("sessionId");
      localStorage.removeItem("userToken");
      localStorage.removeItem("userInfo");
      localStorage.removeItem("token");
      localStorage.removeItem("partnerId");
      localStorage.removeItem("adminApproved");
      sessionStorage.removeItem("partnerSelectedTab");
    } catch (err) {
      console.warn("LocalStorage cleanup error:", err);
    }

    navigate("/partner/login");
  };

  const handleLogoutTrigger = async () => {
    const loginTime = Number(localStorage.getItem("loginTime"));
    const oneMinutePassed =
      !isNaN(loginTime) && Date.now() - loginTime >= 60000;

    if (!oneMinutePassed) {
      return performLogout();
    }

    const sessionUser =
      parseStorageJson("partnerInfo") || parseStorageJson("userInfo");
    const userId = sessionUser?._id;

    if (!userId) {
      openFeedback({
        flow: "partner",
        questions: partnerFlowQuestions,
        triggerInfo: { type: "logout", page: window.location.pathname },
        user: null,
        postSubmitCallback: () => performLogout(),
      });
      return;
    }

    try {
      const resp = await axios.get("/api/feedback/check", {
        params: { userId, flow: "partner" },
      });

      if (resp.data?.alreadySubmitted) {
        performLogout();
        return;
      }
    } catch (err) {
      console.warn("Feedback check failed, opening modal");
    }

    openFeedback({
      flow: "partner",
      questions: partnerFlowQuestions,
      triggerInfo: { type: "logout", page: window.location.pathname },
      user: sessionUser,
      postSubmitCallback: () => performLogout(),
    });
  };

  const [showLogoutModal, setShowLogoutModal] = React.useState(false);

  const handleTabClick = (tab) => {
    if (tab === "logout") {
      setShowLogoutModal(true);
      return;
    }

    if (tab === "support") {
      const win = window.open(
        "/partner-support",
        "_blank",
        "noopener,noreferrer",
      );
      if (win) win.opener = null;
      if (onClose) onClose();
      return;
    }

    handleSelectTab(tab);
    if (onClose) onClose();
  };

  const menuItems = [
    { id: "your-job-posts", label: "Internship Posts", icon: faBriefcase },
    { id: "post-a-job", label: "Post An Internship", icon: faPlus },
    { id: "messages", label: "Messages", icon: faEnvelope },
    { id: "applications", label: "Applications", icon: faFileAlt },
    { id: "instructors", label: "Instructor Management", icon: faUsers },
    // change the faFileAlt to faFileContract icon - 04-08-2026
    { id: "offer-templates", label: "Offer Templates", icon: faFileContract },
    {
      id: "custom-internship-certificate",
      label: "Custom Internship Certificate",
      icon: faCertificate,
    },
    { id: "stipend-details", label: "Stipend Details", icon: faMoneyBillWave },
    {
      id: "internship-payments",
      label: "Internship Payments",
      icon: faFileInvoiceDollar,
    },
    { id: "mock-interviews", label: "Mock Interviews", icon: faComments },
    { id: "bin", label: "Bin", icon: faTrash },
    { id: "support", label: "Support", icon: faHeadset },
    { id: "profile", label: "Profile", icon: faUser },
  ];

  const actionItems = [
    {
      id: "logout",
      icon: faSignOutAlt,
      label: "Logout",
      hoverBg: "hover:bg-teal-100",
    },
  ];

  const SidebarButton = ({ item }) => {
    const isSelected = selectedTab === item.id;
    const selectedColor = "bg-teal-100 text-teal-500";
    const defaultColor = "text-gray-700 hover:bg-gray-100";

    return (
      <button
        onClick={() => handleTabClick(item.id)}
        className={`flex items-center p-3 rounded-lg w-full text-left font-semibold ${
          isSelected ? selectedColor : defaultColor
        } ${item.hoverBg || "hover:bg-gray-100"}`}
      >
        <FontAwesomeIcon
          icon={item.icon}
          className={`w-5 h-5 mr-3 flex-shrink-0 ${isSelected ? "text-teal-500" : "text-gray-600"}`}
        />
        <span className={`${isSelected ? "text-teal-500" : "text-gray-700"}`}>
          {item.label}
        </span>
      </button>
    );
  };

  return (
    <>
      {isOpen && (
        <div
          className="fixed top-24 right-0 bottom-0 left-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={onClose}
        />
      )}

      {showLogoutModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full text-center">
            <h3 className="text-xl font-bold text-gray-900 mb-2">Logout</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to logout?
            </p>
            <div className="flex justify-center space-x-3">
              <button
                onClick={() => {
                  setShowLogoutModal(false);
                  handleLogoutTrigger();
                }}
                className="px-5 py-2.5 bg-red-500 text-white font-semibold rounded-lg hover:bg-red-600 transition-colors"
              >
                Yes
              </button>
              <button
                onClick={() => setShowLogoutModal(false)}
                className="px-5 py-2.5 bg-gray-100 text-gray-700 font-semibold rounded-lg hover:bg-gray-200 transition-colors"
              >
                No
              </button>
            </div>
          </div>
        </div>
      )}

      <div
        className={`
          fixed md:relative z-50 md:z-auto
          top-24 left-0 md:top-0
          bg-white shadow-lg font-poppins
          transition-all duration-300 ease-in-out
          flex flex-col overflow-hidden
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
          md:translate-x-0
          w-64
          ${!isDesktopOpen ? "md:w-14" : "md:w-64"}
        `}
        style={{ height: "calc(100vh - 96px)" }}
      >
        <div className="w-64 flex flex-col h-full">
          <div className="flex-1 overflow-y-auto hide-scrollbar px-3 pt-4">
            <ul className="space-y-2">
              {menuItems.map((item) => (
                <li key={item.id}>
                  <SidebarButton item={item} />
                </li>
              ))}

              {actionItems.map((item) => (
                <li key={item.id}>
                  <SidebarButton item={item} />
                </li>
              ))}
            </ul>
          </div>

          {isDesktopOpen && (
            <div className="p-4 bg-teal-100 rounded-lg m-3">
              <h3 className="text-teal-700 text-sm font-semibold">
                UPGRADE TO PREMIUM
              </h3>
              <p className="text-xs text-teal-600 mt-1">
                Your team has used 80% of your available space. Need more?
              </p>
              <button
                onClick={() => handleTabClick("upgrade")}
                className="mt-3 w-full bg-teal-700 text-white py-2 px-4 rounded-lg hover:bg-teal-800 transition"
              >
                Upgrade Plan
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default Sidebar;
