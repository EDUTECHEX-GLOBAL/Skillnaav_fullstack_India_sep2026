import React, { useEffect, useState, useCallback } from "react";
import axios from "../../../../api/axiosInstance";
import { BellIcon, CheckCircleIcon } from "@heroicons/react/24/solid";
import { EllipsisVerticalIcon } from "@heroicons/react/24/outline";
import { ArrowPathIcon } from "@heroicons/react/24/outline";
import { useNavigate } from "react-router-dom";

const Notifications = ({ onNavigate }) => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openMenuId, setOpenMenuId] = useState(null);
  const navigate = useNavigate();

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  // ── Fetch ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        setLoading(true);
        const userInfo =
          JSON.parse(localStorage.getItem("studentInfo")) ||
          JSON.parse(localStorage.getItem("userInfo"));
        const studentId = userInfo?._id;
        if (!studentId) {
          setError("Unable to identify user");
          return;
        }
        const { data } = await axios.get(`/api/notifications/${studentId}`);
        if (data.success) {
          setNotifications(
            (data.notifications || []).map((n) => ({
              ...n,
              isRead: Boolean(n.read || n.isRead),
            })),
          );
        } else {
          setError("Failed to fetch notifications");
        }
      } catch (err) {
        console.error("Error fetching notifications:", err);
        setError("Error fetching notifications");
      } finally {
        setLoading(false);
      }
    };

    fetchNotifications();
  }, []);

  // ── Close menu on outside click ────────────────────────────────────────────
  useEffect(() => {
    if (!openMenuId) return;
    const onDocClick = () => setOpenMenuId(null);
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [openMenuId]);

  // ── Dispatch openTab event (with small delay when navigating away) ─────────
  const dispatchOpenTab = useCallback((tab, delayed = false) => {
    const fire = () =>
      window.dispatchEvent(
        new CustomEvent("openTab", { detail: { tab, fromNotification: true } }),
      );
    if (delayed) {
      // Wait for the target page component to mount before firing the event
      setTimeout(fire, 150);
    } else {
      fire();
    }
  }, []);

  // ── Shared navigation helper ───────────────────────────────────────────────
  const navigateToLink = useCallback(
    (link) => {
      if (!link) return;

      // ── 1. Fully absolute URL ──────────────────────────────────────────────
      if (/^https?:\/\//i.test(link)) {
        const url = new URL(link);

        if (url.origin === window.location.origin) {
          // Same-origin absolute URL → treat like an internal path
          const openTab = url.searchParams.get("openTab");
          const targetPath = url.pathname + url.search + url.hash;

          if (url.pathname !== window.location.pathname) {
            // Navigating to a different page; dispatch after mount
            navigate(targetPath);
            if (openTab) dispatchOpenTab(openTab, true);
          } else {
            // Already on the target page; fire immediately
            if (openTab) dispatchOpenTab(openTab, false);
            navigate(targetPath);
          }
        } else {
          // Cross-origin → open in new tab
          window.open(link, "_blank", "noopener,noreferrer");
        }
        return;
      }

      // ── 2. Root-relative path  e.g. "/student/dashboard?openTab=offers" ───
      if (link.startsWith("/")) {
        // ── 2a. Legacy assessment deep-link  /student/assessments/:id ──────
        //    Old notifications stored this path. Navigate to Applications tab
        //    so the student can start the assessment from their card themselves.
        const assessmentMatch = link.match(
          /\/student\/assessments\/([a-f0-9]{24})/i,
        );
        if (assessmentMatch) {
          navigate("/user-main-page?openTab=applications");
          dispatchOpenTab("applications", true);
          return;
        }

        const urlObj = new URL(link, window.location.origin);
        const openTab = urlObj.searchParams.get("openTab");
        const targetPath = urlObj.pathname + urlObj.search + urlObj.hash;

        if (urlObj.pathname !== window.location.pathname) {
          navigate(targetPath);
          if (openTab) dispatchOpenTab(openTab, true);
        } else {
          if (openTab) dispatchOpenTab(openTab, false);
          navigate(targetPath);
        }
        return;
      }

      // ── 3. Hash-only fragment  e.g. "#offers" ─────────────────────────────
      if (link.startsWith("#")) {
        const tab = link.slice(1); // strip leading #
        dispatchOpenTab(tab, false);
        return;
      }

      // ── 4. Named tab shorthand  e.g. "recommendations", "offers", "assessment"
      //    Plain strings with no slash/protocol — treat directly as tab names.
      const knownTabs = [
        "recommendations",
        "offers",
        "profile",
        "interviews",
        "placements",
        "assessment",
        "applications",
      ];
      if (knownTabs.some((t) => link.toLowerCase().includes(t))) {
        const matched = knownTabs.find((t) => link.toLowerCase().includes(t));
        dispatchOpenTab(matched, false);
        return;
      }

      // ── 5. Relative path without leading slash  e.g. "dashboard/offers" ───
      if (!link.includes("://") && !link.startsWith("mailto:")) {
        try {
          const urlObj = new URL(link, window.location.href);
          const openTab = urlObj.searchParams.get("openTab");
          const targetPath = urlObj.pathname + urlObj.search + urlObj.hash;

          if (urlObj.pathname !== window.location.pathname) {
            navigate(targetPath);
            if (openTab) dispatchOpenTab(openTab, true);
          } else {
            if (openTab) dispatchOpenTab(openTab, false);
            navigate(targetPath);
          }
          return;
        } catch {
          // Malformed URL — fall through
        }
      }

      // ── 6. Fallback: let the browser handle it ─────────────────────────────
      window.location.href = link;
    },
    [navigate, dispatchOpenTab],
  );

  // ── Mark single as read ────────────────────────────────────────────────────
  const markOneRead = useCallback(async (id) => {
    setNotifications((prev) =>
      prev.map((n) => (n._id === id ? { ...n, isRead: true } : n)),
    );
    try {
      await axios.put(`/api/notifications/read/${id}`);
    } catch (err) {
      console.error("Error marking notification as read:", err);
    }
  }, []);

  // ── Mark all read ──────────────────────────────────────────────────────────
  const markAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    try {
      const userInfo =
        JSON.parse(localStorage.getItem("studentInfo")) ||
        JSON.parse(localStorage.getItem("userInfo"));
      const studentId = userInfo?._id;
      await axios.put(`/api/notifications/read-all`, { studentId });
    } catch (err) {
      console.error("Error marking all read:", err);
    }
  };

  // ── Main notification click ────────────────────────────────────────────────
  const handleNotificationClick = async (notification, e) => {
    e?.stopPropagation();
    if (!notification.isRead) await markOneRead(notification._id);
    navigateToLink(notification.link);
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDelete = async (notification, e) => {
    e?.stopPropagation();
    try {
      await axios.delete(`/api/notifications/${notification._id}`);
      setNotifications((prev) =>
        prev.filter((n) => n._id !== notification._id),
      );
      setOpenMenuId(null);
    } catch (err) {
      console.error("Error deleting notification:", err);
    }
  };

  // ── Download helper ────────────────────────────────────────────────────────
  // For same-origin links use fetch+blob so the browser actually downloads.
  // For cross-origin links fall back to window.open (download attr is ignored
  // by the browser on cross-origin resources).
  const handleDownload = useCallback(async (link, filename = "document") => {
    if (!link) return;
    try {
      const isAbsolute = /^https?:\/\//i.test(link);
      const isSameOrigin =
        !isAbsolute || new URL(link).origin === window.location.origin;

      if (isSameOrigin) {
        const response = await fetch(link, { credentials: "include" });
        if (!response.ok) throw new Error("Network response was not ok");
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(blobUrl);
      } else {
        // Cross-origin: best-effort via new tab (browser decides whether to download)
        window.open(link, "_blank", "noopener,noreferrer");
      }
    } catch (err) {
      console.error("Download failed:", err);
      // Last-resort fallback
      window.open(link, "_blank", "noopener,noreferrer");
    }
  }, []);

  const linkLabel = (type) => {
    if (type === "offer") return "📄 View Offer Letter";
    if (type === "recommendation") return "📄 View Recommendation";
    if (type === "schedule") return "📅 View Schedule";
    return "🔗 View Details";
  };

  const menuOpenLabel = (type) => {
    if (type === "offer") return "Open Offer Letter";
    if (type === "recommendation") return "Open Recommendation";
    if (type === "schedule") return "Open Schedule";
    return "Open Details";
  };

  const menuDownloadLabel = (type) => {
    if (type === "offer") return "Download Offer Letter";
    if (type === "recommendation") return "Download Recommendation";
    if (type === "schedule") return "Download Schedule";
    return "Download Attachment";
  };

  const downloadFilename = (type) => {
    if (type === "offer") return "offer-letter.pdf";
    if (type === "recommendation") return "recommendation.pdf";
    if (type === "schedule") return "schedule.pdf";
    return "document.pdf";
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="p-2 sm:p-4 md:p-6 min-h-screen font-poppins bg-gradient-to-br from-white via-slate-100 to-slate-200 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
              <BellIcon className="w-5 h-5 text-blue-600" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
              Notifications
            </h1>
            {unreadCount > 0 && (
              <span className="inline-flex items-center text-xs font-semibold bg-blue-600 text-white px-2.5 py-0.5 rounded-full shadow-xs flex-shrink-0">
                {unreadCount} New
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-gray-500 mt-1 pl-0.5">
            Recent updates, offers and recommendations
          </p>
        </div>

        <button
          onClick={markAllRead}
          className="self-start sm:self-auto inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium bg-white text-gray-700 hover:bg-gray-50 border border-gray-200 hover:border-gray-300 px-3 py-1.5 rounded-xl shadow-xs transition active:scale-95 whitespace-nowrap"
          aria-label="Mark all as read"
        >
          <ArrowPathIcon className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
          <span>Mark all read</span>
        </button>
      </div>

      {/* States */}
      {loading ? (
        <div className="flex items-center gap-2 text-gray-500 text-sm mt-10 justify-center">
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          Loading notifications...
        </div>
      ) : error ? (
        <div className="text-red-500 font-medium text-sm">{error}</div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-16">
          <CheckCircleIcon className="w-10 h-10 text-green-400 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">
            You're all caught up — no notifications.
          </p>
        </div>
      ) : (
        <ul className="space-y-3.5 sm:space-y-4">
          {notifications.map((notification) => (
            <li
              key={notification._id}
              onClick={(e) => handleNotificationClick(notification, e)}
              className={`p-3.5 sm:p-5 rounded-2xl shadow-xs flex flex-col transition-all duration-150 border cursor-pointer ${
                notification.isRead
                  ? "bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm"
                  : "bg-gradient-to-r from-blue-50/70 via-indigo-50/30 to-blue-50/70 border-blue-200 hover:border-blue-300 hover:shadow-sm"
              }`}
            >
              {/* Card Header Row: Icon + Content */}
              <div className="flex items-start gap-3 w-full">
                {/* Status Icon */}
                <div className="flex-shrink-0 mt-0.5">
                  {notification.isRead ? (
                    <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                      <CheckCircleIcon className="w-5 h-5 text-green-600" />
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                      <BellIcon className="w-5 h-5 text-blue-600 animate-pulse" />
                    </div>
                  )}
                </div>

                {/* Content: Title & Details */}
                <div className="flex-1 min-w-0">
                  {/* Top line: Title, badge, and 3-dots button */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                      {notification.title && (
                        <h3
                          className={`text-sm sm:text-base font-semibold leading-snug break-words ${
                            notification.isRead
                              ? "text-gray-800"
                              : "text-gray-900 font-bold"
                          }`}
                        >
                          {notification.title}
                        </h3>
                      )}
                      {!notification.isRead && (
                        <span className="text-[10px] font-semibold uppercase tracking-wider bg-blue-600 text-white px-2 py-0.5 rounded-full flex-shrink-0 shadow-xs">
                          New
                        </span>
                      )}
                    </div>

                    {/* 3-dots action toggle */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuId((prev) =>
                          prev === notification._id ? null : notification._id,
                        );
                      }}
                      className={`p-1.5 -mr-1 -mt-1 rounded-lg transition-colors flex-shrink-0 focus:outline-none ${
                        openMenuId === notification._id
                          ? "bg-blue-100 text-blue-700"
                          : "text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                      }`}
                      aria-label="Toggle actions"
                    >
                      <EllipsisVerticalIcon className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Message body - FULL WIDTH without artificial pr-20 */}
                  <p
                    className={`text-xs sm:text-sm mt-1.5 leading-relaxed break-words ${
                      notification.isRead
                        ? "text-gray-600"
                        : "text-gray-800 font-medium"
                    }`}
                  >
                    {notification.message}
                  </p>

                  {/* Link action if available */}
                  {notification.link && (
                    <div className="mt-2">
                      <span className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-semibold underline underline-offset-2 transition-colors">
                        {linkLabel(notification.type)}
                      </span>
                    </div>
                  )}

                  {/* Timestamp */}
                  <div className="mt-2 text-[11px] sm:text-xs text-gray-400">
                    {new Date(notification.createdAt).toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Inline Action Tray (Inside the same card box) */}
              {openMenuId === notification._id && (
                <div
                  className="mt-3.5 pt-3 border-t border-gray-200/80 w-full flex flex-wrap items-center justify-end gap-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  {notification.link && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          navigateToLink(notification.link);
                          setOpenMenuId(null);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium text-gray-700 bg-white hover:bg-gray-100 border border-gray-300 rounded-lg shadow-xs transition active:scale-95"
                      >
                        <span>📄</span>
                        <span>{menuOpenLabel(notification.type)}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          handleDownload(
                            notification.link,
                            downloadFilename(notification.type),
                          );
                          setOpenMenuId(null);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium text-gray-700 bg-white hover:bg-gray-100 border border-gray-300 rounded-lg shadow-xs transition active:scale-95"
                      >
                        <span>⬇️</span>
                        <span>{menuDownloadLabel(notification.type)}</span>
                      </button>
                    </>
                  )}

                  <button
                    type="button"
                    onClick={(e) => {
                      handleDelete(notification, e);
                      setOpenMenuId(null);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg shadow-xs transition active:scale-95"
                  >
                    <span>🗑️</span>
                    <span>Delete</span>
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default Notifications;
