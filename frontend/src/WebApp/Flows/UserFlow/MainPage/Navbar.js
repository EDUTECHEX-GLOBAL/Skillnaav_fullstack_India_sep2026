// Navbar.jsx (updated & cleaned)
import React, { useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUser, faSignOutAlt, faBell, faBars, faCrown } from "@fortawesome/free-solid-svg-icons";
import logo from "../../../../assets-webapp/skillnaav_final_logo.svg";
import { useTabContext } from "./UserHomePageContext/HomePageContext";
import { useNavigate } from "react-router-dom";
import axios from "../../../../api/axiosInstance";
import { useFeedback } from "../../../../context/FeedbackContext";
import { userFlowQuestions } from "../../../../components/FeedbackModal/questionSets";

const Navbar = ({ onToggleSidebar }) => {
  const { handleSelectTab, selectedTab } = useTabContext();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  const [userInfo, setUserInfo] = useState({ name: "", email: "", profileImage: "" });
  const [planType, setPlanType] = useState("Free");
  const [unreadCount, setUnreadCount] = useState(0);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const { openFeedback } = useFeedback();

  const getProfileImageUrl = (profileImage) => {
    if (!profileImage || typeof profileImage !== "string" || profileImage.trim() === "") return null;
    if (profileImage.startsWith("data:image") || profileImage.startsWith("http://") || profileImage.startsWith("https://")) {
      return profileImage;
    }
    const baseUrl = process.env.REACT_APP_API_BASE || "http://localhost:5000";
    const normalizedImage = profileImage.replace(/\\/g, "/");
    if (normalizedImage.startsWith("/")) return `${baseUrl}${normalizedImage}`;
    if (normalizedImage.startsWith("uploads/")) return `${baseUrl}/${normalizedImage}`;
    return `${baseUrl}/uploads/${normalizedImage}`;
  };

  const syncUserInfoFromStorage = () => {
    const rawUserInfo = localStorage.getItem("studentInfo") || localStorage.getItem("userInfo");
    if (!rawUserInfo) return;

    let storedUserInfo;
    try {
      storedUserInfo = JSON.parse(rawUserInfo);
    } catch (err) {
      console.error("Invalid userInfo in storage");
      return;
    }

    if (!storedUserInfo?._id) return;

    setUserInfo(storedUserInfo);
    setPlanType(storedUserInfo.planType || "Free");
  };

  useEffect(() => {
    syncUserInfoFromStorage();

    window.addEventListener("userInfoUpdated", syncUserInfoFromStorage);
    window.addEventListener("storage", syncUserInfoFromStorage);
    return () => {
      window.removeEventListener("userInfoUpdated", syncUserInfoFromStorage);
      window.removeEventListener("storage", syncUserInfoFromStorage);
    };
  }, []);

  const userId = userInfo?._id;

  useEffect(() => {
    if (!userId) return;

    const fetchNotifications = async () => {
      try {
        const { data } = await axios.get(`/api/notifications/${userId}`);
        if (data?.success) {
          const unread = data.notifications.filter((n) => !n.isRead).length;
          setUnreadCount(unread);
        }
      } catch (err) {
        console.warn("Failed to fetch notifications:", err);
      }
    };

    fetchNotifications();
  }, [userId]);

  const handleUserClick = () => setIsDropdownOpen((prev) => !prev);

  const performLogout = () => {
    localStorage.removeItem("userToken");
    localStorage.removeItem("studentInfo");
    localStorage.removeItem("userInfo");
    localStorage.removeItem("sessionId");
    sessionStorage.clear();
    navigate("/user/login");
  };

  const handleLogoutTrigger = async () => {
    const loginTime = Number(localStorage.getItem("loginTime"));
    const oneMinutePassed = !isNaN(loginTime) && Date.now() - loginTime >= 60000;

    if (!oneMinutePassed) return performLogout();

    let sessionUser = null;
    try {
      sessionUser = JSON.parse(localStorage.getItem("studentInfo")) || JSON.parse(localStorage.getItem("userInfo")) || null;
    } catch {
      sessionUser = null;
    }
    const uid = sessionUser?._id;

    if (!uid) {
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
        params: { userId: uid, flow: "user" },
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

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const planStyles = {
    "Premium Plus": "bg-gradient-to-r from-orange-400 to-orange-600 text-white",
    "Premium Basic": "bg-gradient-to-r from-purple-500 to-purple-700 text-white",
    Free: "bg-gray-200 text-gray-700",
  };

  if (selectedTab === "assessment") return null;

  return (
    <div className="bg-white font-poppins border-b border-gray-200 sticky top-0 z-50 w-full">
      <div className="flex items-center justify-between px-4 sm:px-6 py-4">
        <div className="flex items-center space-x-4">
          <button onClick={onToggleSidebar} className="text-gray-700 md:hidden">
            <FontAwesomeIcon icon={faBars} className="text-xl" />
          </button>
          <img src={logo} alt="Skillnaav Logo" className="h-10" />
        </div>

        <div className="relative flex items-center space-x-5">

          {/* 1st — Bell */}
          <div className="relative">
            <button
              onClick={() => handleSelectTab("notifications")}
              className="relative focus:outline-none w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 border border-gray-200 transition"
              aria-label="Open notifications"
            >
              <FontAwesomeIcon icon={faBell} className="w-4 h-4 text-gray-600" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-red-600 text-white text-[11px] font-bold flex items-center justify-center border-2 border-white">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </button>
          </div>

          {/* 2nd — Name + Plan */}
          <div className="hidden sm:flex flex-col items-start">
            <span className="text-gray-800 text-sm font-semibold">{userInfo.name}</span>
            <span className={`text-xs font-semibold rounded-full px-2 py-0.5 mt-1 flex items-center gap-1 ${planStyles[planType] || planStyles["Free"]}`}>
              <FontAwesomeIcon icon={faCrown} className="text-[10px]" />
              {planType}
            </span>
          </div>

          {/* 3rd — Profile Image */}
          <div className="relative" onClick={handleUserClick}>
            {userInfo.profileImage ? (
              <img
                src={getProfileImageUrl(userInfo.profileImage)}
                alt="Profile"
                className="w-9 h-9 rounded-full object-cover cursor-pointer shadow-md border-2 border-purple-300 hover:scale-105"
              />
            ) : (
              <FontAwesomeIcon icon={faUser} className="w-8 h-8 text-gray-800 cursor-pointer" />
            )}
          </div>

          {isDropdownOpen && (
            <div
              ref={dropdownRef}
              className="absolute right-0 top-16 mt-2 bg-white shadow-xl rounded-xl border border-gray-200 z-50 w-auto min-w-[20rem]"
            >
              <div className="px-4 py-3 border-b rounded-t-xl">
                <div className="flex items-center gap-2 text-black">
                  <img
                    src={require("../../../../assets-webapp/user-logo.svg").default}
                    alt="User Logo"
                    className="h-7 w-7"
                  />
                  <span className="text-sm font-medium">{userInfo.email}</span>
                </div>
              </div>

              <button
                onClick={() => {
                  setIsDropdownOpen(false);
                  setShowLogoutModal(true);
                }}
                className="w-full flex items-center gap-2 px-4 py-3 text-sm text-red-600 hover:bg-red-50 rounded-b-xl"
              >
                <FontAwesomeIcon icon={faSignOutAlt} className="w-5 h-5" />
                <span>Logout</span>
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
                onClick={() => setShowLogoutModal(false)}
                className="px-6 py-2.5 rounded-lg text-gray-600 font-medium hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  setShowLogoutModal(false);
                  await handleLogoutTrigger();
                }}
                className="px-6 py-2.5 rounded-lg bg-[#7520A9] text-white font-medium hover:bg-purple-800 transition-colors"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Navbar;