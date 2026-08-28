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
    <div className="p-6 min-h-screen font-poppins bg-gradient-to-br from-white via-slate-100 to-slate-200">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl sm:text-3xl font-semibold text-gray-800 tracking-tight flex items-center gap-3">
            <BellIcon className="w-6 h-6 text-blue-600" />
            Notifications
            {unreadCount > 0 && (
              <span className="ml-2 inline-flex items-center text-xs font-medium bg-blue-600 text-white px-2 py-0.5 rounded-full">
                {unreadCount} New
              </span>
            )}
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Recent updates, offers and recommendations
          </p>
        </div>
        {/* change the style to decrease the size of the button in mobile view gap-2 to gap-1 text-sm to text-xs sm:text-sm px-3 py-1 to px-2 sm:px-3 py-1 sm:py-2* - 06-08-2026 */}
        <button
          onClick={markAllRead}
          className="inline-flex items-center gap-1 text-xs sm:text-sm bg-white border border-gray-200 px-2 sm:px-3 py-1 sm:py-2 rounded-lg shadow-sm hover:shadow-md transition-shadow"
          aria-label="Mark all as read"
        >
          <ArrowPathIcon className="w-4 h-4" />
          Mark all read
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
        <ul className="space-y-4">
          {notifications.map((notification) => (
            <li
              key={notification._id}
              onClick={(e) => handleNotificationClick(notification, e)}
              className={`relative p-4 sm:p-5 rounded-2xl shadow-sm flex gap-4 items-start transition-all duration-150 border cursor-pointer ${
                notification.isRead
                  ? "bg-white border-gray-200 hover:border-gray-300"
                  : "bg-gradient-to-r from-blue-50 to-blue-100 border-blue-200 hover:border-blue-300"
              }`}
            >
              {/* Icon */}
              <div className="flex-shrink-0 mt-1">
                {notification.isRead ? (
                  <CheckCircleIcon className="w-6 h-6 text-green-500" />
                ) : (
                  <BellIcon className="w-6 h-6 text-blue-600 animate-pulse" />
                )}
              </div>

              {/* Body */}
              <div className="flex-1 min-w-0 pr-8">
                {notification.title && (
                  <p
                    className={`text-base font-semibold ${notification.isRead ? "text-gray-800" : "text-gray-900"}`}
                  >
                    {notification.title}
                  </p>
                )}
                <p
                  className={`text-sm ${
                    notification.isRead
                      ? "text-gray-700"
                      : "text-blue-900 font-medium"
                  } ${notification.title ? "mt-1" : ""}`}
                >
                  {notification.message}
                </p>

                {notification.link && (
                  <span className="inline-block mt-2 text-xs text-blue-700 font-medium underline hover:text-blue-900 transition-colors">
                    {linkLabel(notification.type)}
                  </span>
                )}

                <p className="text-xs text-gray-400 mt-2">
                  {new Date(notification.createdAt).toLocaleString()}
                </p>
              </div>

              {/* Unread badge */}
              {!notification.isRead && (
                <span className="flex-shrink-0 text-[10px] font-semibold uppercase tracking-wide bg-blue-600 text-white px-2 py-0.5 rounded-full self-start">
                  New
                </span>
              )}

              {/* ── Per-card context menu ──────────────────────────────────── */}
              <div
                className="absolute top-3 right-3 z-10"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() =>
                    setOpenMenuId((prev) =>
                      prev === notification._id ? null : notification._id,
                    )
                  }
                  className="text-gray-400 hover:text-gray-700 p-1 rounded transition-colors"
                  aria-label="Open notification menu"
                >
                  <EllipsisVerticalIcon className="w-5 h-5" />
                </button>

                {openMenuId === notification._id && (
                  <div
                    className="absolute right-0 mt-2 w-52 bg-white border border-gray-200 rounded-xl shadow-lg z-20 overflow-hidden py-1"
                    role="menu"
                  >
                    {notification.link && (
                      <>
                        <button
                          onClick={() => {
                            navigateToLink(notification.link);
                            setOpenMenuId(null);
                          }}
                          className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          {menuOpenLabel(notification.type)}
                        </button>

                        <button
                          onClick={() => {
                            handleDownload(
                              notification.link,
                              downloadFilename(notification.type),
                            );
                            setOpenMenuId(null);
                          }}
                          className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          {menuDownloadLabel(notification.type)}
                        </button>

                        <div className="border-t border-gray-100 my-1" />
                      </>
                    )}

                    <button
                      onClick={(e) => handleDelete(notification, e)}
                      className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default Notifications;
