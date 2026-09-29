import React, { useState, useRef, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBars,
  faUser,
  faSignOutAlt,
  faBell,
} from "@fortawesome/free-solid-svg-icons";
import { useNavigate } from "react-router-dom";
import logo from "../../../../assets-webapp/skillnaav_final_logo.svg";
import axios from "../../../../api/axiosInstance";
import { io as ioClient } from "socket.io-client";
import { useTabContext } from "./UserHomePageContext/HomePageContext";

const Navbar = ({ onToggleSidebar, showMenuToggle }) => {
  const [open, setOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [unreadSummary, setUnreadSummary] = useState({ totalUnread: 0, conversations: [] });
  const ref = useRef();
  const notificationsRef = useRef();
  const nav = useNavigate();
  const { handleSelectTab } = useTabContext();

  useEffect(() => {
    const handler = (e) => {
      if (!ref.current?.contains(e.target)) setOpen(false);
      if (!notificationsRef.current?.contains(e.target)) setNotificationsOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const fetchUnreadSummary = async () => {
    try {
      const { data } = await axios.get("/api/chats/unread/admin");
      setUnreadSummary({
        totalUnread: data?.totalUnread || 0,
        conversations: data?.conversations || [],
      });
    } catch (err) {
      console.error("fetchAdminUnreadSummary:", err);
    }
  };

  useEffect(() => {
    fetchUnreadSummary();

    const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || "http://localhost:5000";
    const socket = ioClient(SOCKET_URL, { withCredentials: true });

    const joinAdminRoom = () => socket.emit("joinAdminRoom");
    const handleUnreadUpdated = (payload) => {
      setUnreadSummary({
        totalUnread: payload?.totalUnread || 0,
        conversations: payload?.conversations || [],
      });
    };

    socket.on("connect", joinAdminRoom);
    socket.on("chatUnreadUpdated", handleUnreadUpdated);

    return () => {
      socket.off("connect", joinAdminRoom);
      socket.off("chatUnreadUpdated", handleUnreadUpdated);
      socket.disconnect();
    };
  }, []);

  const openInternshipChat = (conversation) => {
    const internshipId = conversation?.internshipId || conversation?.internship?._id;
    if (!internshipId) return;

    sessionStorage.setItem("adminOpenChatInternshipId", internshipId);
    setNotificationsOpen(false);
    handleSelectTab("internship-posts");
    nav("/admin-main-page/internship-posts");
    window.dispatchEvent(new CustomEvent("adminOpenInternshipChat", { detail: { internshipId } }));
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

  return (
    <header className="h-[90px] bg-white border-b border-gray-200 px-4 lg:px-6 flex items-center justify-between shadow-sm shrink-0">
      {/* Left */}
      <div className="flex items-center gap-4">
        {/* Mobile Hamburger only */}
        <button
          onClick={onToggleSidebar}
          className={`${showMenuToggle ? "flex" : "hidden"} w-10 h-10 rounded-full border border-gray-200 bg-white text-teal-600 hover:bg-teal-50 transition items-center justify-center shadow-sm`}
        >
          <FontAwesomeIcon icon={faBars} className="text-lg" />
        </button>

        {/* Logo */}
        <img
          src={logo}
          alt="Skillnaav"
          className="h-11 object-contain"
        />
      </div>

      {/* Right */}
      <div className="flex items-center gap-3">
        <div className="relative" ref={notificationsRef}>
          <button
            onClick={() => setNotificationsOpen((v) => !v)}
            className="relative w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 transition flex items-center justify-center"
            aria-label="Open unread message notifications"
          >
            <FontAwesomeIcon icon={faBell} className="text-gray-700 text-lg" />
            {unreadSummary.totalUnread > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-red-600 text-white text-[11px] font-bold flex items-center justify-center border-2 border-white">
                {unreadSummary.totalUnread > 99 ? "99+" : unreadSummary.totalUnread}
              </span>
            )}
          </button>

          {notificationsOpen && (
            <div className="absolute right-0 mt-3 w-80 max-w-[92vw] bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden z-50">
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
                      onClick={() => openInternshipChat(item)}
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
                            {item.internship?.companyName || "Partner"}
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

        <div className="relative" ref={ref}>
        <button
          onClick={() => setOpen((v) => !v)}
          className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 transition flex items-center justify-center"
        >
          <FontAwesomeIcon icon={faUser} className="text-gray-700 text-lg" />
        </button>

        {open && (
          <div className="absolute right-0 mt-3 w-44 bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden z-50">
            <button
              onClick={() => {
                localStorage.removeItem("userInfo");
                sessionStorage.removeItem("adminSelectedTab");
                nav("/admin/login");
              }}
              className="w-full flex items-center px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition"
            >
              <FontAwesomeIcon icon={faSignOutAlt} className="mr-3" />
              Logout
            </button>
          </div>
        )}
        </div>
      </div>
    </header>
  );
};

export default Navbar;
