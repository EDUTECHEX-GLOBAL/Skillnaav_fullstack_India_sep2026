//File: SchoolAdminNavbar.js

import React, { useCallback, useTransition } from "react";
import { FaBars, FaSignOutAlt } from "react-icons/fa";
import axios from "../../../../../api/axiosInstance";
import { useNavigate } from "react-router-dom";
import logo from "../../../../../assets-webapp/skillnaav_final_logo.svg";
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
    <nav className="w-full bg-white shadow-sm px-4 py-3 flex items-center justify-between z-50">

      {/* Left: Hamburger (visible on ALL screens) + Logo */}
      <div className="flex items-center gap-3">
        {/* ✅ No md:hidden — visible on desktop too */}
        <button
          onClick={onToggleSidebar}
          className="text-gray-600 md:hidden mr-4"
          aria-label="Toggle sidebar"
        >
          <FaBars className="text-xl" />
        </button>

        <img src={logo} alt="SkillNaav" className="h-10 w-auto" />
      </div>

      {/* Right: Logout button — keep your existing logout button here */}
      <button
        onClick={handleLogoutClick}
        disabled={isPending}
        className="flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-50 rounded-lg transition"
      >
        <FaSignOutAlt />
        <span className="hidden sm:inline">Logout</span>
      </button>
    </nav>

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