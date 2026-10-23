import React, { useEffect, useState, lazy, useMemo, Suspense, useRef } from "react";
import {
  FaHome,
  FaEnvelope,
  FaUserPlus,
  FaUsers,
  FaPaperPlane,
  FaSignOutAlt,
  FaBars,
  FaSpinner,
  FaRupeeSign,
  FaBell,
} from "react-icons/fa";
import EdutechLogo from "../../assets/Edutech-logo.png";

// Main Admin Management Views
const AdminDashboardHome = lazy(() => import("./AdminDashboardHome"));
const AdminContactSubmissions = lazy(() => import("./AdminContactSubmissions"));
const AdminSubscribedEmails = lazy(() => import("./AdminSubscribedEmails"));
const AdminVisitorsList = lazy(() => import("./AdminVisitorsList"));
const AdminNewsletter = lazy(() => import("./AdminNewsletter"));
const AdminPayments = lazy(() => import("./AdminPayments"));

// Loader component for suspense fallback
const Loader = () => (
  <div className="flex justify-center items-center h-64">
    <FaSpinner className="animate-spin text-3xl text-sky-500" />
  </div>
);

const Admin = () => {
  const [selectedTab, setSelectedTab] = useState("Home");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const notificationRef = useRef(null);

  const [notifications, setNotifications] = useState([
    {
      id: 1,
      title: "New Contact Inquiry",
      desc: "Satya Umesh submitted an inquiry regarding course programs",
      time: "10m ago",
      type: "contact",
      read: false,
    },
    {
      id: 2,
      title: "Live Visitor Milestone",
      desc: "209 real visitor sessions recorded on platform",
      time: "25m ago",
      type: "visitor",
      read: false,
    },
    {
      id: 3,
      title: "Subscribers Sync Complete",
      desc: "38 active subscribers synced with MongoDB",
      time: "1h ago",
      type: "subscriber",
      read: true,
    },
    {
      id: 4,
      title: "Payment Records Verified",
      desc: "Real-time payment gateway ledger is operational",
      time: "2h ago",
      type: "payment",
      read: true,
    },
  ]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  const markNotificationRead = (id) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const markAllNotificationsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const clearAllNotifications = () => {
    setNotifications([]);
  };

  // Close notifications dropdown when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (notificationRef.current && !notificationRef.current.contains(e.target)) {
        setNotificationsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  // Main Dashboard Items
  const dashboardItems = useMemo(
    () => [
      { id: "Home", label: "Home", component: <AdminDashboardHome />, icon: <FaHome /> },
      { id: "ContactUs", label: "Contact Us", component: <AdminContactSubmissions />, icon: <FaEnvelope /> },
      { id: "Subscribe", label: "Subscribe", component: <AdminSubscribedEmails />, icon: <FaUserPlus /> },
      { id: "Visitors", label: "Visitors", component: <AdminVisitorsList />, icon: <FaUsers /> },
      { id: "Newsletter", label: "Newsletter", component: <AdminNewsletter />, icon: <FaPaperPlane /> },
      { id: "Payments", label: "Payments", component: <AdminPayments />, icon: <FaRupeeSign /> },
    ],
    []
  );

  const activeItem = useMemo(
    () => dashboardItems.find((i) => i.id === selectedTab) || dashboardItems[0],
    [selectedTab, dashboardItems]
  );

  const handleLogout = () => {
    localStorage.removeItem("edutechexAdminSession");
    window.location.href = "/admin-login";
  };

  useEffect(() => {
    const session = localStorage.getItem("edutechexAdminSession");
    if (!session) {
      window.location.href = "/admin-login";
      return;
    }
    try {
      const parsedSession = JSON.parse(session);
      if (parsedSession?.success && parsedSession?.data?._id) {
        setIsAuthorized(true);
        return;
      }
    } catch {
      // Invalid session
    }
    localStorage.removeItem("edutechexAdminSession");
    window.location.href = "/admin-login";
  }, []);

  useEffect(() => {
    document.title = `EDUTECHEX - Admin | ${selectedTab}`;
  }, [selectedTab]);

  if (!isAuthorized) {
    return (
      <div className="flex justify-center items-center h-screen bg-slate-50">
        <Loader />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#f8fafc] font-poppins overflow-hidden">
      {/* Sidebar - Sleek reduced width */}
      <aside
        className={`${
          sidebarOpen ? "w-56 sm:w-60" : "w-16"
        } bg-white border-r border-slate-200 transition-all duration-300 flex flex-col justify-between z-20 shadow-xs flex-shrink-0 font-poppins`}
      >
        <div>
          {/* Logo & Toggle Header */}
          <div className="h-14 sm:h-16 px-3.5 flex items-center justify-between border-b border-slate-100 bg-white">
            {sidebarOpen ? (
              <>
                <div className="flex items-center min-w-0">
                  <img
                    src={EdutechLogo}
                    alt="EDUTECHEX"
                    className="h-[38px] sm:h-[42px] w-auto max-w-[160px] sm:max-w-[180px] object-contain ml-0.5 sm:ml-2"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setSidebarOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition cursor-pointer flex-shrink-0"
                  title="Close sidebar"
                >
                  <FaBars size={14} />
                </button>
              </>
            ) : (
              <div className="w-full flex justify-center">
                <button
                  type="button"
                  onClick={() => setSidebarOpen(true)}
                  className="w-9 h-9 rounded-xl bg-slate-50 hover:bg-sky-50 text-slate-600 hover:text-sky-600 flex items-center justify-center transition cursor-pointer border border-slate-200 shadow-xs"
                  title="Open sidebar"
                >
                  <FaBars size={14} />
                </button>
              </div>
            )}
          </div>

          {/* Navigation Items */}
          <nav className="p-2 space-y-1 overflow-y-auto max-h-[calc(100vh-140px)]">
            {dashboardItems.map((item) => {
              const isActive = selectedTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedTab(item.id)}
                  className={`w-full flex items-center ${
                    sidebarOpen ? "gap-2.5 px-3" : "justify-center px-0"
                  } py-2 rounded-xl text-xs transition-all font-poppins ${
                    isActive
                      ? "bg-sky-100 text-sky-800 font-bold shadow-xs"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium"
                  }`}
                  title={item.label}
                >
                  <span className={`text-sm ${isActive ? "text-sky-600" : "text-slate-400"}`}>
                    {item.icon}
                  </span>
                  {sidebarOpen && <span className="truncate">{item.label}</span>}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Logout */}
        <div className="p-2 border-t border-slate-100">
          <button
            type="button"
            onClick={handleLogout}
            className={`w-full flex items-center ${
              sidebarOpen ? "gap-2.5 px-3" : "justify-center px-0"
            } py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer font-poppins`}
            title="Logout"
          >
            <FaSignOutAlt className="text-rose-500 text-sm flex-shrink-0" />
            {sidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Body */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden font-poppins">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shadow-xs font-poppins">
          {/* Left: Clean Active Title (No "Admin /") */}
          <div className="flex items-center gap-3">
            <h1 className="text-base sm:text-lg font-bold text-slate-800 tracking-tight font-poppins">
              {activeItem.label}
            </h1>
          </div>

          {/* Right: Notifications & Profile */}
          <div className="flex items-center gap-3 sm:gap-4">
            {/* Working Notification Bell with Dropdown */}
            <div className="relative" ref={notificationRef}>
              <button
                type="button"
                onClick={() => setNotificationsOpen((prev) => !prev)}
                className={`relative w-9 h-9 rounded-full flex items-center justify-center transition cursor-pointer shadow-xs border ${
                  notificationsOpen
                    ? "bg-sky-100 text-sky-700 border-sky-300"
                    : "bg-slate-50 hover:bg-sky-50 text-slate-600 hover:text-sky-600 border-slate-200"
                }`}
                title="Notifications"
              >
                <FaBell size={13} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white rounded-full text-[9px] font-black flex items-center justify-center shadow-xs animate-pulse">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Popover Dropdown */}
              {notificationsOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-slate-100 z-50 overflow-hidden font-poppins animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-800">Notifications</span>
                      {unreadCount > 0 && (
                        <span className="px-1.5 py-0.5 text-[10px] font-bold bg-sky-100 text-sky-700 rounded-full">
                          {unreadCount} new
                        </span>
                      )}
                    </div>
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={markAllNotificationsRead}
                        className="text-[11px] font-semibold text-sky-600 hover:text-sky-800 transition cursor-pointer"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>

                  <div className="max-h-72 overflow-y-auto divide-y divide-slate-50">
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-400">
                        No notifications
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          onClick={() => markNotificationRead(n.id)}
                          className={`p-3 text-xs transition cursor-pointer hover:bg-slate-50 flex items-start gap-2.5 ${
                            !n.read ? "bg-sky-50/50" : ""
                          }`}
                        >
                          <div
                            className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                              !n.read ? "bg-sky-500" : "bg-transparent"
                            }`}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1">
                              <p
                                className={`font-semibold truncate ${
                                  !n.read ? "text-slate-900" : "text-slate-600"
                                }`}
                              >
                                {n.title}
                              </p>
                              <span className="text-[10px] text-slate-400 flex-shrink-0">
                                {n.time}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5 leading-snug line-clamp-2">
                              {n.desc}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="p-2 border-t border-slate-100 bg-slate-50 flex justify-between items-center text-[11px]">
                    <button
                      type="button"
                      onClick={clearAllNotifications}
                      className="text-slate-500 hover:text-rose-600 font-medium px-2 py-1 rounded transition cursor-pointer"
                    >
                      Clear all
                    </button>
                    <span className="text-slate-400 font-medium px-2">Live System Alerts</span>
                  </div>
                </div>
              )}
            </div>

            {/* Profile Avatar & Info */}
            <div className="flex items-center gap-2.5 pl-3 border-l border-slate-200">
              <div className="w-8 h-8 rounded-full bg-sky-600 text-white flex items-center justify-center font-bold text-xs shadow-sm font-poppins">
                A
              </div>
              <div className="hidden sm:flex flex-col">
                <span className="text-xs font-semibold text-slate-800 leading-tight font-poppins">
                  Administrator
                </span>
                <span className="text-[10px] text-slate-400 font-medium font-poppins">
                  Super Admin
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* View Content */}
        <main className="flex-1 p-5 md:p-8 overflow-y-auto bg-[#f8fafc]">
          <div className="max-w-7xl mx-auto">
            <Suspense fallback={<Loader />}>
              {activeItem
                ? React.cloneElement(activeItem.component, {
                    key: selectedTab,
                    onSelectTab: setSelectedTab,
                  })
                : <AdminDashboardHome onSelectTab={setSelectedTab} />}
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  );
};

export default React.memo(Admin);
