// frontend/src/WebApp/Flows/PartnerFlow/MainPage/Navbar.jsx
import React, { useState, useRef, useEffect, useCallback } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSignOutAlt, faBars, faBell } from "@fortawesome/free-solid-svg-icons";
import logo from "../../../../assets-webapp/skillnaav_final_logo.svg";
import defaultCompanyLogo from "../../../../assets/default-company-logo.png";

import { useTabContext } from "./UserHomePageContext/HomePageContext";
import { useNavigate } from "react-router-dom";
import axios from "../../../../api/axiosInstance";
import { io as ioClient } from "socket.io-client";

// Feedback
import { useFeedback } from "../../../../context/FeedbackContext";
import { partnerFlowQuestions } from "../../../../components/FeedbackModal/questionSets";

const Navbar = ({ onToggleSidebar }) => {
  const { handleSelectTab } = useTabContext();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [unreadSummary, setUnreadSummary] = useState({ totalUnread: 0, conversations: [] });
  const [userInfo, setUserInfo] = useState({ name: "", email: "", planType: "", profileImage: "" });
  const dropdownRef = useRef(null);
  const notificationsRef = useRef(null);
  const navigate = useNavigate();

  const { openFeedback } = useFeedback();

  const getPartnerId = useCallback(() => {
    const direct = localStorage.getItem("partnerId") || localStorage.getItem("partner_id");
    if (direct) return direct;

    for (const key of ["userInfo", "partnerInfo", "partner", "user"]) {
      try {
        const parsed = JSON.parse(localStorage.getItem(key) || "null");
        const id = parsed?._id || parsed?.id || parsed?.partnerId;
        if (id) return id;
      } catch (_) {}
    }

    return null;
  }, []);

  const fetchUnreadSummary = useCallback(async () => {
    const partnerId = getPartnerId();
    if (!partnerId) return;

    try {
      const { data } = await axios.get(`/api/chats/unread/partner/${partnerId}`);
      setUnreadSummary({
        totalUnread: data?.totalUnread || 0,
        conversations: data?.conversations || [],
      });
    } catch (err) {
      console.error("fetchPartnerUnreadSummary:", err);
    }
  }, [getPartnerId]);

  // Read from localStorage on mount
  useEffect(() => {
    try {
      const storedUserInfo = (JSON.parse(localStorage.getItem("partnerInfo")) || JSON.parse(localStorage.getItem("userInfo")));
      if (storedUserInfo) {
        setUserInfo(storedUserInfo);
      }
    } catch (err) {
      console.warn("Failed reading userInfo from localStorage", err);
    }
  }, []);

  // Fetch premium status from backend and sync localStorage & state
  const fetchPremiumStatus = useCallback(async () => {
    try {
      // Login saves the token under the key "token" (plain string, no JSON).
      // The previous code used JSON.parse(localStorage.getItem("userToken")) which
      // (a) read the wrong key "userToken" and (b) unnecessarily JSON-parsed a plain string.
      const token = localStorage.getItem("token");
      if (!token) return;

      const { data } = await axios.get("/api/partners/profile", {
        headers: { Authorization: `Bearer ${token}` },
      });

      // Accept flexible backend shape: { user: {...} } or the profile object directly
      const resp = data?.user ? data.user : data;
      if (!resp) return;

      const existingInfo = JSON.parse(localStorage.getItem("partnerInfo")) || JSON.parse(localStorage.getItem("userInfo")) || {};
      const updatedUser = {
        ...existingInfo,
        isPremium:         resp.isPremium,
        planType:          resp.planType,
        premiumExpiration: resp.premiumExpiration,
        name:              resp.name         ?? undefined,
        email:             resp.email        ?? undefined,
        profileImage:      resp.profileImage ?? undefined,
      };

      // Remove undefined keys so they don't accidentally overwrite existing values
      Object.keys(updatedUser).forEach((k) => updatedUser[k] === undefined && delete updatedUser[k]);

      localStorage.setItem("partnerInfo", JSON.stringify(updatedUser));
      setUserInfo((prev) => ({ ...prev, ...updatedUser }));
    } catch (error) {
      console.error("Failed to fetch premium status:", error);
    }
  }, []);

  // Sync on mount, on tab focus, on localStorage change, and on custom partnerUpdated events
  useEffect(() => {
    fetchPremiumStatus();
    fetchUnreadSummary();

    const onFocus = () => {
      fetchPremiumStatus();
      fetchUnreadSummary();
    };
    window.addEventListener("focus", onFocus);

    const onStorage = (e) => {
      if (e.key === "userInfo") {
        try {
          const newVal = JSON.parse(e.newValue);
          if (newVal) setUserInfo(newVal);
        } catch (_) {}
      }
    };
    window.addEventListener("storage", onStorage);

    // Dispatched by PartnerPremiumPage (onApprove success) and by socket handler below
    const onPartnerUpdatedEvent = (e) => {
      try {
        const updated = e?.detail;
        if (updated) setUserInfo((prev) => ({ ...prev, ...updated }));
      } catch (_) {}
    };
    window.addEventListener("partnerUpdated", onPartnerUpdatedEvent);

    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("partnerUpdated", onPartnerUpdatedEvent);
    };
  }, [fetchPremiumStatus, fetchUnreadSummary]);

  // Real-time partner update listener (Socket.IO)
  useEffect(() => {
    const partnerId = getPartnerId();
    if (!partnerId) return;

    const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || "http://localhost:5000";
    const socket = ioClient(SOCKET_URL, { withCredentials: true });

    const handleConnect = () => {
      socket.emit("joinPartnerRoom", { partnerId });
    };

    const onPartnerUpdated = (payload) => {
      try {
        if (!payload || payload.partnerId !== partnerId) return;

        const existing = (() => {
          try { return (JSON.parse(localStorage.getItem("partnerInfo")) || JSON.parse(localStorage.getItem("userInfo"))) || {}; } catch { return {}; }
        })();
        const updated = {
          ...existing,
          isPremium:         payload.isPremium,
          planType:          payload.planType,
          premiumExpiration: payload.premiumExpiration,
        };

        localStorage.setItem("partnerInfo", JSON.stringify(updated));
        setUserInfo(updated);
        window.dispatchEvent(new CustomEvent("partnerUpdated", { detail: updated }));
      } catch (err) {
        console.error("Error handling partner:updated payload", err);
      }
    };

    const onUnreadUpdated = (payload) => {
      setUnreadSummary({
        totalUnread: payload?.totalUnread || 0,
        conversations: payload?.conversations || [],
      });
    };

    socket.on("connect", handleConnect);
    socket.on("partner:updated", onPartnerUpdated);
    socket.on("chatUnreadUpdated", onUnreadUpdated);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("partner:updated", onPartnerUpdated);
      socket.off("chatUnreadUpdated", onUnreadUpdated);
      socket.disconnect();
    };
  }, [getPartnerId]);

  const openMessageChat = (conversation) => {
    const internshipId = conversation?.internshipId || conversation?.internship?._id;
    if (!internshipId) return;

    sessionStorage.setItem("partnerOpenChatInternshipId", internshipId);
    setNotificationsOpen(false);
    handleSelectTab("messages");
    navigate("/partner-main-page/messages");
    window.dispatchEvent(new CustomEvent("partnerOpenInternshipChat", { detail: { internshipId } }));
  };

  const formatNotificationTime = (value) => {
    if (!value) return "";
    return new Date(value).toLocaleString([], {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleUserClick = () => setIsDropdownOpen((prev) => !prev);

  // Actual logout clears session and navigates away
  const performLogout = async () => {
    const sessionId = localStorage.getItem("sessionId");
    // Read token from the correct key "token" (plain string)
    const token = localStorage.getItem("token");

    if (sessionId && token) {
      try {
        await axios.post(
          "/api/sessions/logout",
          { sessionId },
          { headers: { Authorization: `Bearer ${token}` } },
        );
      } catch (err) {
        console.warn("Logout session API failed:", err?.response?.data || err?.message || err);
        // Continue with client-side logout regardless
      }
    }

    try {
      // Remove "token" (the key Login actually writes), not the non-existent "userToken"
      localStorage.removeItem("token");
      localStorage.removeItem("sessionId");
      localStorage.removeItem("userInfo");
      localStorage.removeItem("adminApproved");
      localStorage.removeItem("partnerId");
      localStorage.removeItem("loginTime");
      sessionStorage.removeItem("partnerSelectedTab");
    } catch (err) {
      console.warn("LocalStorage cleanup error:", err);
    }

    navigate("/partner/login");
  };

  // When logout is clicked: gate behind feedback modal if required
  const handleLogoutTrigger = async () => {
    const loginTime = Number(localStorage.getItem("loginTime"));
    const oneMinutePassed = !isNaN(loginTime) && (Date.now() - loginTime >= 60000);

    if (!oneMinutePassed) {
      return performLogout();
    }

    const sessionUser = (() => {
      try { return (JSON.parse(localStorage.getItem("partnerInfo")) || JSON.parse(localStorage.getItem("userInfo"))); } catch { return null; }
    })();
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
      console.warn("Feedback check failed, opening modal anyway");
    }

    openFeedback({
      flow: "partner",
      questions: partnerFlowQuestions,
      triggerInfo: { type: "logout", page: window.location.pathname },
      user: sessionUser,
      postSubmitCallback: () => performLogout(),
    });
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(event.target)) {
        setNotificationsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isPremiumExpired = userInfo.isPremium && userInfo.planType !== "Freemium" && userInfo.premiumExpiration && new Date(userInfo.premiumExpiration) <= new Date();
  const displayPlan = isPremiumExpired ? "Expired" : (userInfo.planType || "Loading");

  return (
    <header className="bg-white font-poppins text-gray-800 py-3 sm:py-5 px-4 border-b border-gray-300 sticky top-0 z-50 flex justify-between items-center">
      {/* Left: Logo + hamburger */}
      <div className="flex items-center gap-3">
        <button onClick={onToggleSidebar} className="md:hidden text-gray-700 focus:outline-none">
          <FontAwesomeIcon icon={faBars} className="text-xl" />
        </button>
        <img src={logo} alt="Skillnaav Logo" className="h-8 sm:h-10 w-auto object-contain" width="120" height="56" />
      </div>

      {/* Right: User info + dropdown */}
      <div className="relative flex items-center gap-2 sm:gap-3 ml-auto">
        {userInfo.name && (
          <div className="order-2 hidden sm:flex flex-col items-end min-w-[90px] min-h-[40px] justify-center">
            <span className="text-gray-800 text-sm">{userInfo.name}</span>
            <span
              className={`mt-1 px-2 py-0.5 text-xs font-medium rounded-full transition-opacity duration-200
                ${displayPlan ? "opacity-100" : "opacity-0"}
                ${
                  isPremiumExpired                ? "bg-red-100 text-red-700"       :
                  displayPlan === "Freemium"      ? "bg-gray-200 text-gray-700"     :
                  displayPlan === "Premium Basic" ? "bg-purple-200 text-purple-800" :
                  displayPlan === "Premium Plus"  ? "bg-orange-200 text-orange-800" :
                                                    "bg-gray-100 text-gray-500"
                }`}
            >
              {displayPlan}
            </span>
          </div>
        )}

        {/* Unread message notifications */}
        <div className="relative order-1" ref={notificationsRef}>
          <button
            onClick={() => setNotificationsOpen((prev) => !prev)}
            className="relative focus:outline-none w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 border border-gray-200 transition"
            aria-label="Open unread message notifications"
          >
            <FontAwesomeIcon icon={faBell} className="w-4 h-4 text-gray-600" />
            {unreadSummary.totalUnread > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-red-600 text-white text-[11px] font-bold flex items-center justify-center border-2 border-white">
                {unreadSummary.totalUnread > 99 ? "99+" : unreadSummary.totalUnread}
              </span>
            )}
          </button>

          {notificationsOpen && (
            <div className="absolute right-0 top-10 mt-2 bg-white shadow-xl rounded-xl border border-gray-200 z-50 w-80 max-w-[92vw] overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-sm font-bold text-gray-900">Unread Messages</p>
                <p className="text-xs text-gray-500">{unreadSummary.totalUnread} unread message{unreadSummary.totalUnread === 1 ? "" : "s"}</p>
              </div>

              <div className="max-h-80 overflow-y-auto">
                {unreadSummary.conversations.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-gray-500">
                    No unread messages.
                  </div>
                ) : (
                  unreadSummary.conversations.map((item) => (
                    <button
                      key={item.internshipId}
                      onClick={() => openMessageChat(item)}
                      className="w-full text-left px-4 py-3 hover:bg-indigo-50 transition border-b border-gray-100 last:border-b-0"
                    >
                      <div className="flex items-start gap-3">
                        <img
                          src={item.internship?.imgUrl || logo}
                          alt={item.internship?.companyName || "Internship"}
                          className="w-10 h-10 rounded-xl object-cover border border-gray-200"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-semibold text-gray-900 truncate">
                              {item.internship?.jobTitle || "Internship Chat"}
                            </p>
                            <span className="shrink-0 rounded-full bg-red-100 text-red-700 text-[11px] font-bold px-2 py-0.5">
                              {item.unreadCount}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 truncate">
                            {item.internship?.companyName || "Admin"}
                          </p>
                          <p className="mt-1 text-xs text-gray-700 truncate">
                            {item.latestMessage?.message || item.latestMessage?.fileName || "New attachment"}
                          </p>
                          <p className="mt-1 text-[11px] text-gray-400">
                            {formatNotificationTime(item.latestAt)}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Profile image / fallback icon */}
        <button onClick={handleUserClick} className="order-3 focus:outline-none w-10 h-10 flex items-center justify-center flex-shrink-0">
          <img
            src={userInfo.profileImage || defaultCompanyLogo}
            alt="Profile"
            className="w-10 h-10 rounded-full object-cover border border-gray-300"
          />
        </button>

        {/* Dropdown */}
        {isDropdownOpen && (
          <div ref={dropdownRef} className="absolute right-0 top-10 mt-2 bg-white shadow-xl rounded-xl border border-gray-200 z-50 w-auto min-w-[20rem] max-w-[90vw]">
            {/* Profile header */}
            <div className="px-4 py-3 border-b rounded-t-xl bg-white">
              <div className="flex items-center gap-3 text-black">
                <div className="h-12 w-12 rounded-full overflow-hidden border border-gray-300">
                  <img
                    src={userInfo.profileImage || defaultCompanyLogo}
                    alt="User"
                    className="h-full w-full object-cover"
                  />
                </div>
                <span className="block text-sm font-medium whitespace-nowrap" title={userInfo.email}>
                  {userInfo.email}
                </span>
              </div>
            </div>

            {/* Logout */}
            <button
              onClick={handleLogoutTrigger}
              className="w-full flex items-center gap-2 px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition rounded-b-xl"
            >
              <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center">
                <FontAwesomeIcon icon={faSignOutAlt} className="w-5 h-5" />
              </div>
              <span>Logout</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
};

export default Navbar;
