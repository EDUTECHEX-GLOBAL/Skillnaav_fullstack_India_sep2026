import React from "react";
import { useTabContext } from "./UserHomePageContext/HomePageContext";

import Dashboard from "./Dashboard";
import UserManagement from "./UserManagement";
import PartnerAccounts from "./PartnerAccounts";
import InternshipsPosted from "./InternshipsPosted";
import SchoolAdminAccounts from "./SchoolAdminAccounts";
import Bin from "./Bin";
import InternshipPayments from "./InternshipPayments";
import PartnerPayments from "./PartnerPayments";
import CertificateApprovals from "./CertificateApprovals";

// Feedback
import AdminFeedbackList from "./AdminFeedbackList";
import AdminFeedbackDashboard from "./AdminFeedbackDashboard";
import UserFeedback from "./UserFeedback";
import PartnerFeedback from "./PartnerFeedback";
import SchoolFeedback from "./SchoolFeedback";

// Subscriptions
import SubscriptionOverview from "./SubscriptionOverview";
import StudentSubscriptions from "./StudentSubscriptions";
import PartnerSubscriptions from "./PartnerSubscriptions";
import SchoolAdminSubscriptions from "./SchoolAdminSubscriptions";
// ✅ Support Components
import AdminPartnerSupport from "./AdminPartnerSupport";
import AllConversations from "./AllConversations";
import StudentSupportCenter from "./StudentSupportCenter";
import SchoolAdminSupport from "./Schooladminsupport";       // ✅ NEW
import { PlatformConfigSettings } from "./Settings/PlatformConfigSettings";
import { AdminRolesSettings } from "./Settings/AdminRolesSettings";
import { SecuritySettings } from "./Settings/SecuritySettings";

const BodyContent = () => {
  const { selectedTab } = useTabContext();

  const renderContent = () => {
    switch (selectedTab) {
      case "home":
        return <Dashboard />;

      case "user-management":
        return <UserManagement />;

      case "partner-accounts":
        return <PartnerAccounts />;

      case "internship-posts":
        return <InternshipsPosted />;

      case "school-accounts":
        return <SchoolAdminAccounts />;

      case "bin":
        return <Bin />;

      // Payments
      case "internship-payments":
        return <InternshipPayments />;

      case "partner-payments":
        return <PartnerPayments />;

      case "certificate-approvals":
        return <CertificateApprovals />;

      // Analytics
      case "analytics":
        return <AdminFeedbackDashboard flow="all" />;

      // Feedback
      case "feedback-list":
        return <AdminFeedbackList />;

      case "user-feedback":
        return <UserFeedback />;

      case "partner-feedback":
        return <PartnerFeedback />;

      case "school-feedback":
        return <SchoolFeedback />;

      // Subscriptions
      case "subscription-overview":
        return <SubscriptionOverview />;

      case "student-subscriptions":
        return <StudentSubscriptions />;

      case "partner-subscriptions":
        return <PartnerSubscriptions />;

      case "school-admin-subscriptions":
        return <SchoolAdminSubscriptions />;

      // Support
      case "admin-support":
        return <AllConversations />;

      case "support-Partner-admins":
        return <AdminPartnerSupport />;

      case "support-tickets":
        return <StudentSupportCenter initialView="student" />;

      case "support-school-students":
        return <StudentSupportCenter initialView="school" />;

      case "support-school-admins":
        return <SchoolAdminSupport />;

      // Settings
      case "settings-platform":
        return <PlatformConfigSettings />;
      case "settings-roles":
        return <AdminRolesSettings />;
      case "settings-security":
        return <SecuritySettings />;


      default:
        return (
          <div className="text-center text-gray-500 mt-10">
            Select a tab
          </div>
        );
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#f7f9fc] p-3 sm:p-4 lg:p-6">
      {renderContent()}
    </div>
  );
};

export default BodyContent;
