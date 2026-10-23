//File: SchoolAdminNavbar.js

import React, { useCallback, useTransition } from "react";
import { FaBars, FaSignOutAlt } from "react-icons/fa";
import axios from "../../../../../api/axiosInstance";
import { useNavigate } from "react-router-dom";
import logo from "../../../../../assets/Edutech-logo.png";
import { useFeedback } from "../../../../../context/FeedbackContext";
import { schoolAdminFlowQuestions } from "../../../../../components/FeedbackModal/questionSets";

const SchoolAdminNavbar = React.memo(({ onLogout, onToggleSidebar }) => {
  const { openFeedback } = useFeedback();
  const navigate = useNavigate();
  const [isPending, startTransition] = useTransition();
  const [showLogoutModal, setShowLogoutModal] = React.useState(false);

  const performLogout = useCallback(() => {
    try {
      if (typeof onLogout === "function") onLogout();
    } catch (err) {
      console.warn("onLogout callback threw:", err);
    } finally {
      try {
        localStorage.removeItem("userInfo");
        localStorage.removeItem("userToken");
        localStorage.removeItem("schoolAdminProfile");
        localStorage.removeItem("schoolAdminId");
        localStorage.removeItem("schoolAdminToken");
        sessionStorage.removeItem("schoolAdminSelectedTab");
      } catch (e) { }
      navigate("/schooladmin/login");
    }
  }, [onLogout, navigate]);

  const handleLogoutClick = useCallback(() => {
    setShowLogoutModal(true);
  }, []);

  const handleConfirmLogout = useCallback(() => {
    // ✅ useTransition defers heavy work off the main thread
    // so the click feels instant (INP improvement)
    startTransition(async () => {
      const parseLoginValue = (v) => {
        if (v === null || v === undefined) return NaN;
        const n = Number(String(v));
        return Number.isFinite(n) ? n : NaN;
      };

      const loginTime =
        parseLoginValue(localStorage.getItem("loginTime")) ||
        parseLoginValue(sessionStorage.getItem("loginTime"));
      const oneMinutePassed =
        !Number.isNaN(loginTime) && Date.now() - loginTime >= 60000;

      if (!oneMinutePassed) return performLogout();

      const parsedUserInfo = (() => {
        try { return (JSON.parse(localStorage.getItem("schoolAdminInfo")) || JSON.parse(localStorage.getItem("userInfo"))); } catch { return null; }
      })();
      const parsedSchoolProfile = (() => {
        try { return JSON.parse(localStorage.getItem("schoolAdminProfile")); } catch { return null; }
      })();

      const adminId =
        parsedUserInfo?._id || parsedUserInfo?.id ||
        parsedSchoolProfile?._id || parsedSchoolProfile?.id ||
        localStorage.getItem("schoolAdminId") || null;

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
        const { data } = await axios.get("/api/feedback/check", {
          params: { userId: adminId, flow: "schoolAdmin" },
        });
        if (data?.alreadySubmitted) return performLogout();
      } catch (err) {
        console.warn("Feedback check failed:", err?.message);
      }

      openFeedback({
        flow: "schoolAdmin",
        questions: schoolAdminFlowQuestions,
        triggerInfo: { type: "logout", page: window.location.pathname },
        user: snapshot,
        postSubmitCallback: () => performLogout(),
      });
    });
  }, [performLogout, openFeedback, startTransition]);

  return (
    <>
    <header className="bg-white font-poppins text-gray-800 py-2 sm:py-2.5 px-3 sm:px-6 border-b border-gray-300 sticky top-0 z-50 flex justify-between items-center gap-2 w-full">

      {/* Left: Hamburger + Logo */}
      <div className="flex items-center gap-2 sm:gap-3 pl-0 sm:pl-2 min-w-0 flex-shrink">
        <button
          onClick={onToggleSidebar}
          className="md:hidden w-10 h-10 rounded-full border border-gray-200 bg-white text-teal-600 hover:bg-teal-50 transition flex items-center justify-center shadow-sm shrink-0"
          aria-label="Toggle sidebar"
        >
          <FaBars className="text-lg" />
        </button>

        <img
          src={logo}
          alt="Edutechex Logo"
          className="h-[38px] sm:h-[42px] w-auto max-w-[160px] sm:max-w-[180px] object-contain ml-0.5 sm:ml-2"
        />
      </div>

      {/* Right: Logout button */}
      <button
        onClick={handleLogoutClick}
        disabled={isPending}
        className="w-10 h-10 sm:w-auto sm:px-3 sm:py-2 rounded-full sm:rounded-lg bg-gray-100 sm:bg-transparent hover:bg-red-50 text-red-500 transition flex items-center justify-center gap-2 shrink-0"
        title="Logout"
      >
        <FaSignOutAlt className="text-base" />
        <span className="hidden sm:inline text-sm font-medium">Logout</span>
      </button>
    </header>

      {showLogoutModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-[90%] max-w-sm transform transition-all">
            <h3 className="text-lg font-semibold text-gray-800 text-center mb-6">
              Are you sure you want to logout?
            </h3>
            <div className="flex justify-center gap-4">
              <button
                onClick={() => {
                  setShowLogoutModal(false);
                  handleConfirmLogout();
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
});

export default SchoolAdminNavbar;
