import React, { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faHome,
  faUsers,
  faClipboardList,
  faChevronDown,
  faUniversity,
  faChartBar,
  faCogs,
  faTrash,
  faSignOutAlt,
  faCreditCard,
  faCommentDots,
  faStar,
  faHeadset,
  faComments,
  faUserTie,
  faUserGraduate,
  faSchool,
} from "@fortawesome/free-solid-svg-icons";
import { useNavigate } from "react-router-dom";
import { useTabContext } from "./UserHomePageContext/HomePageContext";

const primaryNavItems = [
  { key: "home", icon: faHome, label: "Dashboard" },
  { key: "user-management", icon: faUsers, label: "User Management" },
];

const preSettingsNavItems = [
  { key: "school-accounts", icon: faUniversity, label: "School Admin Accounts" },
  { key: "analytics", icon: faChartBar, label: "Analytics" },
];

const postSettingsNavItems = [
  { key: "bin", icon: faTrash, label: "Bin" },
];

const partnerManagementItems = [
  { key: "partner-accounts", label: "Partner Accounts" },
  { key: "internship-posts", label: "Internship Posts" },
  { key: "certificate-approvals", label: "Certificate Approvals" },
];

const paymentManagementItems = [
  { key: "internship-payments", label: "Internship Payments" },
  { key: "partner-payments", label: "Partner Payments" },
];

const feedbackManagementItems = [
  { key: "feedback-list", label: "All Feedback" },
  { key: "user-feedback", label: "User Feedback" },
  { key: "partner-feedback", label: "Partner Feedback" },
  { key: "school-feedback", label: "School Admin Feedback" },
];

const subscriptionItems = [
  { key: "student-subscriptions", label: "Student Subscriptions" },
  { key: "partner-subscriptions", label: "Partner Subscriptions" },
  { key: "school-admin-subscriptions", label: "School Subscriptions" },
];

const supportItems = [
  { key: "admin-support", label: "All Conversations", icon: faComments },
  { key: "support-Partner-admins", label: "Partner Support", icon: faUserTie },
  { key: "support-tickets", label: "Student Tickets", icon: faUserGraduate },
  { key: "support-school-students", label: "School Student", icon: faUserGraduate },
  { key: "support-school-admins", label: "School Admin", icon: faSchool },
];

const settingsItems = [
  { key: "settings-platform", label: "Platform Settings" },
  { key: "settings-roles", label: "Admin Access" },
  { key: "settings-security", label: "Security" }
];

const PARTNER_MANAGEMENT_TABS = new Set(partnerManagementItems.map(({ key }) => key));
const PAYMENT_MANAGEMENT_TABS = new Set(paymentManagementItems.map(({ key }) => key));
const FEEDBACK_MANAGEMENT_TABS = new Set(feedbackManagementItems.map(({ key }) => key));
const SUBSCRIPTION_TABS = new Set(subscriptionItems.map(({ key }) => key));
const SUPPORT_TABS = new Set(supportItems.map(({ key }) => key));
const SETTINGS_TABS = new Set(settingsItems.map(({ key }) => key));

const SubBadge = ({ children, color = "green" }) => {
  const styles = {
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    red: "bg-red-50 text-red-700",
    blue: "bg-blue-50 text-blue-700",
  };
  return (
    <span className={`ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${styles[color]}`}>
      {children}
    </span>
  );
};

const Sidebar = ({ isOpen, isCompactLayout, onClose, isDesktopOpen = true }) => {
  const { handleSelectTab, selectedTab } = useTabContext();
  const navigate = useNavigate();
  const showLabels = isCompactLayout || isDesktopOpen;

  const [partnerOpen, setPartnerOpen] = useState(PARTNER_MANAGEMENT_TABS.has(selectedTab));
  const [paymentOpen, setPaymentOpen] = useState(PAYMENT_MANAGEMENT_TABS.has(selectedTab));
  const [feedbackOpen, setFeedbackOpen] = useState(FEEDBACK_MANAGEMENT_TABS.has(selectedTab));
  const [subscriptionOpen, setSubscriptionOpen] = useState(SUBSCRIPTION_TABS.has(selectedTab));
  const [supportOpen, setSupportOpen] = useState(SUPPORT_TABS.has(selectedTab));
  const [settingsOpen, setSettingsOpen] = useState(SETTINGS_TABS.has(selectedTab));
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  useEffect(() => {
    setPartnerOpen(PARTNER_MANAGEMENT_TABS.has(selectedTab));
    setPaymentOpen(PAYMENT_MANAGEMENT_TABS.has(selectedTab));
    setFeedbackOpen(FEEDBACK_MANAGEMENT_TABS.has(selectedTab));
    setSubscriptionOpen(SUBSCRIPTION_TABS.has(selectedTab));
    setSupportOpen(SUPPORT_TABS.has(selectedTab));
    setSettingsOpen(SETTINGS_TABS.has(selectedTab));
  }, [selectedTab]);

  const handleTabClick = (key) => {
    if (key === "logout") {
      setShowLogoutModal(true);
    } else {
      handleSelectTab(key);
      if (isCompactLayout) onClose?.();
    }
  };

  const confirmLogout = () => {
    localStorage.removeItem("userInfo");
    localStorage.removeItem("adminInfo");
    localStorage.removeItem("adminToken");
    sessionStorage.removeItem("adminSelectedTab");
    setShowLogoutModal(false);
    navigate("/admin/login");
  };

  const SidebarButton = ({ item, isActive, onClick, icon }) => (
    <button
      onClick={onClick}
      title={!showLabels ? item.label : ""}
      className={`flex items-center w-full p-3 rounded-lg font-medium transition-colors ${
        isActive ? "bg-teal-100 text-teal-700" : "text-gray-600 hover:bg-gray-100"
      } ${showLabels ? "items-start" : "items-center justify-center"}`}
    >
      <FontAwesomeIcon
        icon={icon}
        className={`w-5 h-5 flex-shrink-0 ${isActive ? "text-teal-600" : "text-gray-500"} ${
          showLabels ? "mr-3 mt-0.5" : ""
        }`}
      />
      {showLabels && (
        <span className="min-w-0 text-left whitespace-normal break-words leading-5">
          {item.label}
        </span>
      )}
    </button>
  );

  const SidebarSection = ({
    icon,
    label,
    isActive,
    isExpanded,
    setExpanded,
    items,
    itemBadges = {},
    itemIconClassName = "",
  }) => (
    <div>
      <button
        onClick={() => showLabels && setExpanded((prev) => !prev)}
        title={!showLabels ? label : ""}
        className={`flex w-full p-3 rounded-lg font-medium transition-colors ${
          isActive ? "bg-teal-100 text-teal-700" : "text-gray-600 hover:bg-gray-100"
        } ${showLabels ? "justify-between" : "justify-center"}`}
      >
        {showLabels ? (
          <>
            <span className="flex flex-1 items-center min-w-0 pr-2">
              <FontAwesomeIcon
                icon={icon}
                className={`w-5 h-5 flex-shrink-0 ${isActive ? "text-teal-600" : "text-gray-500"} mr-3`}
              />
              <span className="min-w-0 text-left whitespace-normal break-words leading-5 text-[15px]">
                {label}
              </span>
            </span>
            <FontAwesomeIcon
              icon={faChevronDown}
              className={`ml-2 flex-shrink-0 text-xs transition-transform self-center ${
                isExpanded ? "rotate-180" : ""
              }`}
            />
          </>
        ) : (
          <FontAwesomeIcon
            icon={icon}
            className={`w-5 h-5 flex-shrink-0 ${isActive ? "text-teal-600" : "text-gray-500"}`}
          />
        )}
      </button>

      {showLabels && isExpanded && (
        <div className="mt-1 ml-3 space-y-1 border-l border-gray-200 pl-3">
          {items.map((item) => {
            const isSelected = selectedTab === item.key;
            const badge = itemBadges[item.key];

            return (
              <button
                key={item.key}
                onClick={() => handleTabClick(item.key)}
                className={`w-full rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors flex items-center ${
                  isSelected ? "bg-teal-50 text-teal-700" : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                {item.icon && (
                  <FontAwesomeIcon icon={item.icon} className={`w-4 h-4 mr-2 flex-shrink-0 ${itemIconClassName}`} />
                )}
                <span className="whitespace-normal break-words leading-5 flex-1">
                  {item.label}
                </span>
                {badge && <SubBadge color={badge.color}>{badge.label}</SubBadge>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Logout Confirmation Modal */}
      {showLogoutModal && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl px-8 py-8 flex flex-col items-center"
            style={{ minWidth: 320, maxWidth: 380 }}
          >
            {/* Icon */}
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-red-50 mb-4">
              <FontAwesomeIcon icon={faSignOutAlt} className="text-red-500 w-8 h-8" />
            </div>
            <h2 className="text-lg font-bold text-gray-800 mb-1">Confirm Logout</h2>
            <p className="text-sm text-gray-500 mb-6 text-center">
              Are you sure you want to logout?<br />You will be redirected to the login page.
            </p>
            <div className="flex gap-3 w-full">
              <button
                onClick={confirmLogout}
                className="flex-1 py-2.5 rounded-xl bg-red-500 text-white font-semibold hover:bg-red-600 transition-colors text-sm shadow-md"
              >
                Yes
              </button>
              <button
                onClick={() => setShowLogoutModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-semibold hover:bg-gray-50 transition-colors text-sm"
              >
                No
              </button>
            </div>
          </div>
        </div>
      )}
      {isCompactLayout && isOpen && (
        <div
          className="fixed top-[90px] right-0 bottom-0 left-0 bg-black/40 z-40"
          onClick={onClose}
        />
      )}

      <aside
        className={`
          ${isCompactLayout ? "fixed top-[90px] bottom-0 left-0 z-50" : "relative z-auto"}
          bg-white shadow-lg font-poppins
          transition-all duration-300 ease-in-out
          flex flex-col overflow-hidden shrink-0
          ${
            isCompactLayout
              ? `${isOpen ? "translate-x-0" : "-translate-x-full"} w-64`
              : `translate-x-0 ${!isDesktopOpen ? "w-14" : "w-64"}`
          }
        `}
        style={{ height: isCompactLayout ? "calc(100vh - 90px)" : "100%" }}
      >
        <div className="w-full h-full flex flex-col">
          <div className={`flex-1 overflow-y-auto hide-scrollbar pt-4 pb-6 ${showLabels ? "px-3" : "px-1"}`}>
            <ul className="space-y-2">
              {primaryNavItems.map((item) => (
                <li key={item.key}>
                  <SidebarButton
                    item={item}
                    icon={item.icon}
                    isActive={selectedTab === item.key}
                    onClick={() => handleTabClick(item.key)}
                  />
                </li>
              ))}

              <li>
                <SidebarSection
                  icon={faClipboardList}
                  label="Partner Management"
                  isActive={PARTNER_MANAGEMENT_TABS.has(selectedTab)}
                  isExpanded={partnerOpen}
                  setExpanded={setPartnerOpen}
                  items={partnerManagementItems}
                />
              </li>

              <li>
                <SidebarSection
                  icon={faCreditCard}
                  label="Payment Management"
                  isActive={PAYMENT_MANAGEMENT_TABS.has(selectedTab)}
                  isExpanded={paymentOpen}
                  setExpanded={setPaymentOpen}
                  items={paymentManagementItems}
                />
              </li>

              <li>
                <SidebarSection
                  icon={faCommentDots}
                  label="Feedback Management"
                  isActive={FEEDBACK_MANAGEMENT_TABS.has(selectedTab)}
                  isExpanded={feedbackOpen}
                  setExpanded={setFeedbackOpen}
                  items={feedbackManagementItems}
                />
              </li>

              <li>
                <SidebarSection
                  icon={faHeadset}
                  label="Support Center"
                  isActive={SUPPORT_TABS.has(selectedTab)}
                  isExpanded={supportOpen}
                  setExpanded={setSupportOpen}
                  items={supportItems}
                  itemIconClassName="text-green-500"
                />
              </li>

              <li>
                <SidebarSection
                  icon={faStar}
                  label="Subscriptions"
                  isActive={SUBSCRIPTION_TABS.has(selectedTab)}
                  isExpanded={subscriptionOpen}
                  setExpanded={setSubscriptionOpen}
                  items={subscriptionItems}
                />
              </li>

              {preSettingsNavItems.map((item) => (
                <li key={item.key}>
                  <SidebarButton
                    item={item}
                    icon={item.icon}
                    isActive={selectedTab === item.key}
                    onClick={() => handleTabClick(item.key)}
                  />
                </li>
              ))}

              <li>
                <SidebarSection
                  icon={faCogs}
                  label="Settings"
                  isActive={SETTINGS_TABS.has(selectedTab)}
                  isExpanded={settingsOpen}
                  setExpanded={setSettingsOpen}
                  items={settingsItems}
                />
              </li>

              {postSettingsNavItems.map((item) => (
                <li key={item.key}>
                  <SidebarButton
                    item={item}
                    icon={item.icon}
                    isActive={selectedTab === item.key}
                    onClick={() => handleTabClick(item.key)}
                  />
                </li>
              ))}
            </ul>
          </div>

          <div className="p-3 shrink-0">
            <button
              onClick={() => handleTabClick("logout")}
              title={!showLabels ? "Logout" : ""}
              className={`flex items-center w-full p-3 rounded-lg font-medium text-red-500 hover:bg-red-50 transition-colors ${
                showLabels ? "" : "justify-center"
              }`}
            >
              <FontAwesomeIcon icon={faSignOutAlt} className={`w-5 h-5 flex-shrink-0 ${showLabels ? "mr-3" : ""}`} />
              {showLabels && <span>Logout</span>}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
