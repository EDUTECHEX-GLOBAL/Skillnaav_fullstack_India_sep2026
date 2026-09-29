import React, { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faHome,
  faSearch,
  faFileAlt,
  faFileSignature,
  faHeart,
  faUser,
  faLifeRing,
  faSignOutAlt,
  faChevronDown,
  faChevronUp,
  faStar,
  faCheckCircle,
  faLayerGroup,
} from "@fortawesome/free-solid-svg-icons";
import { useTabContext } from "./UserHomePageContext/HomePageContext";
import { useNavigate } from "react-router-dom";
import axios from "../../../../api/axiosInstance";
import { useFeedback } from "../../../../context/FeedbackContext";
import { userFlowQuestions } from "../../../../components/FeedbackModal/questionSets";

const Sidebar = ({ isMobile, isOpen, onClose, isDesktopOpen = true }) => {
  const [showSectors, setShowSectors] = useState(false);
  const { selectedTab, handleSelectTab } = useTabContext();
  const navigate = useNavigate();
  const { openFeedback } = useFeedback();
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const topSectors = [
    { id: "advanced-ai", name: "Advanced AI & Autonomous Systems" },
    { id: "quantum-computing", name: "Quantum Computing & Next-Gen Computing" },
    { id: "climate-tech", name: "Climate Tech & Carbon Capture" },
    { id: "biotech", name: "Biotechnology & Synthetic Biology" },
    { id: "materials-science", name: "Advanced Materials Science" },
    { id: "space-exploration", name: "Space Exploration & Commercial Space" },
    {
      id: "neurotechnology",
      name: "Neurotechnology & Brain-Computer Interfaces",
    },
    { id: "precision-agriculture", name: "Precision Agriculture & AgriTech" },
    {
      id: "advanced-robotics",
      name: "Advanced Robotics & Human-Machine Collaboration",
    },
    { id: "renewable-energy", name: "Renewable Energy & Grid Innovation" },
    { id: "architecture-built-environment", name: "Architecture & Built Environment" },
  ];

  const menuItems = [
    { id: "home", icon: faHome, label: "HomePage" },
    { id: "searchbar", icon: faSearch, label: "Search" },
    { id: "recommendations", icon: faStar, label: "Recommendations" },
    { id: "applications", icon: faFileAlt, label: "Applications" },
    //change faFileAlt to faFileSignature of offer letter - 04-08-2026
    { id: "offer-letter", icon: faFileSignature, label: "Offer Letter" },
    { id: "attendance", icon: faCheckCircle, label: "Attendance" },
    { id: "saved-jobs", icon: faHeart, label: "Saved Jobs" },
    { id: "profile", icon: faUser, label: "Profile" },
  ];

  /* ---- performLogout declared first to avoid TDZ error ---- */
  const performLogout = async () => {
    const sessionId = localStorage.getItem("sessionId");
    const token = localStorage.getItem("userToken");
    if (sessionId && token) {
      try {
        await axios.post(
          "/api/sessions/logout",
          { sessionId },
          { headers: { Authorization: `Bearer ${token}` } },
        );
      } catch (error) {
        console.error(
          "Logout session error:",
          error?.response?.data || error?.message,
        );
      }
    }
    try {
      localStorage.removeItem("userToken");
      localStorage.removeItem("studentInfo");
      localStorage.removeItem("userInfo");
      localStorage.removeItem("sessionId");
    } catch (err) {
      console.warn("LocalStorage clear failed:", err);
    }
    navigate("/user/login");
  };

  const handleLogoutTrigger = async () => {
    const loginTime = Number(localStorage.getItem("loginTime"));
    const oneMinutePassed =
      !isNaN(loginTime) && Date.now() - loginTime >= 60000;
    if (!oneMinutePassed) return performLogout();

    const sessionUser =
      JSON.parse(localStorage.getItem("studentInfo")) ||
      JSON.parse(localStorage.getItem("userInfo")) ||
      null;
    const userId = sessionUser?._1d || sessionUser?._id;

    if (!userId) {
      openFeedback({
        flow: "user",
        questions: userFlowQuestions,
        triggerInfo: { type: "logout", page: window.location.pathname },
        user: null,
        postSubmitCallback: () => performLogout(),
      });
      return;
    }

    try {
      const resp = await axios.get("/api/feedback/check", {
        params: { userId, flow: "user" },
      });
      if (resp.data?.alreadySubmitted) {
        performLogout();
        return;
      }
    } catch (err) {
      console.warn("Feedback check failed, opening modal");
    }

    openFeedback({
      flow: "user",
      questions: userFlowQuestions,
      triggerInfo: { type: "logout", page: window.location.pathname },
      user: sessionUser,
      postSubmitCallback: () => performLogout(),
    });
  };

  const handleTabClick = async (tab) => {
    if (tab === "logout") {
      setShowLogoutModal(true);
    } else {
      handleSelectTab(tab);
      if (isMobile && onClose) onClose();
    }
  };

  // ⛔ Hide sidebar completely during assessment
  if (selectedTab === "assessment") return null;

  return (
    <>
      {/* Backdrop for mobile */}
      {isMobile && isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={onClose}
        />
      )}

      {/* Sidebar panel */}
      <div
        className={`
          fixed md:sticky top-16
          h-[calc(100vh-4rem)] bg-white shadow-lg font-poppins
          z-[100] md:z-10
          transform transition-all duration-300 ease-in-out
          ${
            isMobile
              ? isOpen
                ? "translate-x-0 w-64"
                : "-translate-x-full w-64"
              : `translate-x-0 ${isDesktopOpen ? "w-64" : "w-14"}`
          }
        `}
      >
        {/* Inner content — always 256px wide; parent clips when collapsed */}
        <div className="w-full h-full flex flex-col">
          {/* Scrollable nav area */}
          <div
            className={`flex-1 min-h-0 overflow-y-auto pt-4 pb-6 hide-scrollbar ${isDesktopOpen || isMobile ? "px-4" : "px-1"}`}
          >
            <nav className="space-y-2">
              {menuItems.map(({ id, icon, label }) => (
                <button
                  key={id}
                  onClick={() => handleTabClick(id)}
                  className={`flex items-center p-3 rounded-lg w-full text-left font-medium transition-colors
    ${
      selectedTab === id
        ? "bg-[#F0DEFD] text-[#7520A9]"
        : "text-gray-600 hover:bg-gray-100"
    }
    ${!isDesktopOpen && !isMobile ? "justify-center" : ""}
  `}
                >
                  <FontAwesomeIcon
                    icon={icon}
                    className={`w-5 h-5 flex-shrink-0 ${isDesktopOpen || isMobile ? "mr-3" : ""}`}
                  />
                  {(isDesktopOpen || isMobile) && (
                    <span className="whitespace-nowrap">{label}</span>
                  )}
                </button>
              ))}

              {/* Top Sectors Dropdown — hidden when collapsed */}
              {(isDesktopOpen || isMobile) && (
                <div className="mt-2">
                  <button
                    onClick={() => setShowSectors(!showSectors)}
                    className="flex items-center justify-between p-3 rounded-lg w-full font-medium text-gray-700 hover:bg-gray-100"
                  >
                    <span className="flex items-center">
                      <FontAwesomeIcon
                        icon={faLayerGroup} //change the icon faFileAlt to faLayerGroup - 04-08-2026
                        className="w-5 h-5 mr-3"
                      />
                      Top Sectors
                    </span>
                    <FontAwesomeIcon
                      icon={showSectors ? faChevronUp : faChevronDown}
                    />
                  </button>

                  {showSectors && (
                    <ul className="pl-8 mt-2 space-y-1">
                      {topSectors.map((sector, index) => (
                        <li
                          key={index}
                          className="text-sm text-gray-600 hover:text-[#7520A9] cursor-pointer"
                          onClick={() => handleTabClick(sector.id)}
                        >
                          • {sector.name}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </nav>

            {/* Support & Logout */}
            <div className="mt-6 space-y-2">
              <button
                onClick={() => {
                  const win = window.open(
                    "/user-support",
                    "_blank",
                    "noopener,noreferrer",
                  );
                  if (win) win.opener = null;
                  if (isMobile && onClose) onClose();
                }}
                className={`flex items-center p-3 rounded-lg w-full text-left font-medium transition-colors
    text-gray-600 hover:bg-gray-100
    ${!isDesktopOpen && !isMobile ? "justify-center" : ""}
  `}
              >
                <FontAwesomeIcon
                  icon={faLifeRing}
                  className={`w-5 h-5 flex-shrink-0 ${isDesktopOpen || isMobile ? "mr-3" : ""}`}
                />
                {(isDesktopOpen || isMobile) && <span>Support</span>}
              </button>

              <button
                onClick={() => handleTabClick("logout")}
                className={`flex items-center p-3 rounded-lg w-full text-left font-medium text-red-600 hover:bg-red-100
    ${!isDesktopOpen && !isMobile ? "justify-center" : ""}
  `}
              >
                <FontAwesomeIcon
                  icon={faSignOutAlt}
                  className={`w-5 h-5 flex-shrink-0 ${isDesktopOpen || isMobile ? "mr-3" : ""}`}
                />
                {(isDesktopOpen || isMobile) && <span>Logout</span>}
              </button>
            </div>
          </div>

          {/* Fixed bottom Upgrade Box — hidden when collapsed */}
          {(isDesktopOpen || isMobile) && (
            <div className="shrink-0 p-4 pt-0">
              <div className="bg-purple-100 rounded-lg p-4">
                <h3 className="text-purple-700 text-sm font-semibold">
                  UPGRADE TO PREMIUM
                </h3>
                <p className="text-xs text-gray-600 mt-1">
                  Apply to more jobs and unlock premium benefits!
                </p>
                <button
                  onClick={() => handleTabClick("premium")}
                  className="mt-4 w-full bg-purple-700 text-white py-2 px-4 rounded-lg hover:bg-purple-800 transition"
                >
                  Upgrade Now
                </button>
              </div>
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
                className="px-6 py-2.5 rounded-lg bg-[#7520A9] text-white font-medium hover:bg-purple-800 transition-colors"
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

export default Sidebar;
