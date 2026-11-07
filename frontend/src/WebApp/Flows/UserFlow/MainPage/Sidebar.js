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
import { redirectToLoginAfterLogout } from "../../../../utils/domain";

const Sidebar = ({ isMobile, isOpen, onClose, isDesktopOpen = true }) => {
  const [showSectors, setShowSectors] = useState(false);
  const [showAllSectors, setShowAllSectors] = useState(false);
  const { selectedTab, handleSelectTab } = useTabContext();
  const navigate = useNavigate();
  const { openFeedback } = useFeedback();
  const [showLogoutModal, setShowLogoutModal] = useState(false);

    const topSectors = [
    { id: "advanced-ai", name: "AI & Autonomous" },
    { id: "quantum-computing", name: "Quantum Computing" },
    { id: "climate-tech", name: "Climate Tech" },
    { id: "biotech", name: "Biotech" },
    { id: "materials-science", name: "Materials Science" },
    { id: "space-exploration", name: "Space Exploration" },
    { id: "neurotechnology", name: "Neurotechnology" },
    { id: "precision-agriculture", name: "Precision Agriculture" },
    { id: "advanced-robotics", name: "Advanced Robotics" },
    { id: "renewable-energy", name: "Renewable Energy" },
    { id: "architecture-built-environment", name: "Architecture & Built Env" },
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
      localStorage.removeItem("schoolAdminId");
      sessionStorage.clear();
    } catch (err) {
      console.warn("LocalStorage clear failed:", err);
    }

    redirectToLoginAfterLogout(navigate);
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
          ${
            isMobile
              ? isOpen
                ? "fixed top-[72px] bottom-0 left-0 z-[100] w-64 max-w-[85vw] bg-white shadow-xl flex flex-col"
                : "hidden"
              : `sticky top-[72px] z-10 h-[calc(100vh-72px)] bg-white shadow-lg flex flex-col ${
                  isDesktopOpen ? "w-64" : "w-16"
                }`
          }
          font-poppins transition-all duration-300 ease-in-out
        `}
      >
        {/* Inner content */}
        <div className="w-full h-full flex flex-col min-h-0">
          {/* Scrollable nav area - ONLY THIS AREA SCROLLS */}
          <div
            style={{ WebkitOverflowScrolling: "touch" }}
            className={`flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y ${
              isDesktopOpen || isMobile ? "px-4 pt-4" : "px-1.5 pt-6"
            } pb-3 hide-scrollbar`}
          >
            <nav className="space-y-2">
              {menuItems.map(({ id, icon, label }) => (
                <button
                  key={id}
                  onClick={() => handleTabClick(id)}
                  title={!isDesktopOpen && !isMobile ? label : ""}
                  className={`flex items-center rounded-xl transition-all
    ${
      selectedTab === id
        ? "bg-[#F0DEFD] text-[#7520A9]"
        : "text-gray-600 hover:bg-gray-100"
    }
    ${
      !isDesktopOpen && !isMobile
        ? "justify-center w-11 h-11 mx-auto p-0"
        : "p-3 w-full text-left font-medium"
    }
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
                    <div className="mt-1">
                      <div className="divide-y divide-gray-100">
                        {(showAllSectors ? topSectors : topSectors.slice(0, 5)).map(
                          (sector) => (
                            <button
                              key={sector.id}
                              type="button"
                              onClick={() => handleTabClick(sector.id)}
                              className={`w-full text-left py-2.5 px-3 text-xs sm:text-[13px] transition-colors rounded-md ${
                                selectedTab === sector.id
                                  ? "bg-[#F0DEFD] text-[#7520A9] font-semibold"
                                  : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                              }`}
                            >
                              {sector.name}
                            </button>
                          )
                        )}
                      </div>
                      <div className="pt-2 px-1 pb-1">
                        <button
                          type="button"
                          onClick={() => setShowAllSectors(!showAllSectors)}
                          className="w-full py-1.5 px-4 text-xs font-medium text-gray-600 hover:text-gray-900 bg-white hover:bg-gray-50 border border-gray-200 rounded-full transition-colors text-center"
                        >
                          {showAllSectors ? "Show less" : "Show all sectors"}
                        </button>
                      </div>
                    </div>
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

          {/* Pinned bottom: Image 2 Upgrade to Premium card (never scrolls, never overlaps) */}
          {(isDesktopOpen || isMobile) && (
            <div className="p-3.5 shrink-0 border-t border-purple-100 bg-white">
              <div className="bg-[#FAF2FE] rounded-2xl p-4 border border-[#EEDBFA] shadow-sm">
                <h3 className="text-[#7520A9] text-xs font-bold uppercase tracking-wider">
                  UPGRADE TO PREMIUM
                </h3>
                <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                  Apply to more jobs and unlock premium benefits!
                </p>
                <button
                  onClick={() => handleTabClick("premium")}
                  className="mt-3.5 w-full bg-[#7520A9] hover:bg-purple-800 active:scale-95 text-white text-sm font-semibold py-2.5 px-4 rounded-xl transition shadow-sm cursor-pointer text-center"
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
