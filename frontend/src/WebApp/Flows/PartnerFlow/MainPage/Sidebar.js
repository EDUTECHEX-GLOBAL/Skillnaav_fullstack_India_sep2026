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
        title={!isDesktopOpen ? item.label : ""}
        className={`flex items-center rounded-lg w-full text-left font-semibold transition-all duration-150 ${
          isSelected ? selectedColor : defaultColor
        } ${item.hoverBg || ""} ${
          isDesktopOpen ? "p-3" : "p-2.5 justify-center"
        }`}
      >
        <FontAwesomeIcon
          icon={item.icon}
          className={`w-5 h-5 flex-shrink-0 text-base ${
            isSelected ? "text-teal-500" : "text-gray-600"
          } ${isDesktopOpen ? "mr-3" : ""}`}
        />
        {isDesktopOpen && (
          <span className={`text-sm text-left leading-tight break-words ${isSelected ? "text-teal-500" : "text-gray-700"}`}>
            {item.label}
          </span>
        )}
      </button>
    );
  };

  return (
    <>
      {isOpen && (
        <div
          className="fixed top-[57px] sm:top-[81px] right-0 bottom-0 left-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={onClose}
        />
      )}

      {showLogoutModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full text-center border border-slate-100">
            <h3 className="text-xl font-bold text-slate-900 mb-2">Logout</h3>
            <p className="text-slate-600 mb-6 text-sm">
              Are you sure you want to logout?
            </p>
            <div className="flex justify-center space-x-3">
              <button
                onClick={() => {
                  setShowLogoutModal(false);
                  handleLogoutTrigger();
                }}
                className="px-5 py-2.5 bg-rose-600 text-white font-semibold text-sm rounded-xl hover:bg-rose-700 transition-colors shadow-sm"
              >
                Yes
              </button>
              <button
                onClick={() => setShowLogoutModal(false)}
                className="px-5 py-2.5 bg-slate-100 text-slate-700 font-semibold text-sm rounded-xl hover:bg-slate-200 transition-colors"
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
          top-[57px] sm:top-[81px] left-0 md:top-0
          bg-white shadow-lg font-poppins
          transition-all duration-300 ease-in-out
          flex flex-col overflow-hidden
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
          md:translate-x-0
          ${!isDesktopOpen ? "w-14" : "w-64"}
          h-[calc(100vh-57px)] sm:h-[calc(100vh-81px)] md:h-full
        `}
      >
        <div className="w-full flex flex-col h-full">
          <div className={`flex-1 overflow-y-auto hide-scrollbar pt-4 pb-4 ${isDesktopOpen ? "px-3" : "px-1.5"}`}>
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
            <div className="p-4 bg-teal-100 rounded-lg m-3.5 border-none shadow-none">
              <h3 className="text-teal-700 text-xs font-bold uppercase tracking-wider">
                UPGRADE TO PREMIUM
              </h3>
              <p className="text-xs font-semibold text-teal-600 mt-1.5 leading-snug">
                Your team has used 80% of your available space. Need more?
              </p>
              <button
                onClick={() => handleTabClick("upgrade")}
                className="mt-3.5 w-full bg-teal-700 hover:bg-teal-800 active:scale-[0.98] text-white py-2.5 px-4 rounded-lg text-sm font-semibold transition shadow-sm"
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
