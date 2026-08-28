//File: BodyContent.js

import React from "react";
import { Navigate } from "react-router-dom";
import { useTabContext } from "./UserHomePageContext/HomePageContext";
import Message from "./Message";
import Applications from "./Applications";
import Profile from "./Profile";
import YourJobPosts from "./YourJobPosts";
import PostAJob from "./PostAJob";
import PartnerPremiumPage from "./PartnerPremiumPage";
import OfferTemplateManager from "./OfferTemplateManager";
import CustomInternshipCertificateManager from "./CustomInternshipCertificateManager";
import StipendDetails from "./StipendDetails";
import InstructureManagement from "./InstructureManagement";
import InternshipPayments from "./InternshipPayments";
import MockInterviewResults from "./MockInterviewResults";
import Bin from "./Bin";

const BodyContent = () => {
  const { selectedTab } = useTabContext();

  let content;

  switch (selectedTab) {
    case "your-job-posts":
      content = <YourJobPosts />;
      break;
    case "instructors":
      content = <InstructureManagement />;
      break;
    case "post-a-job":
      content = <PostAJob />;
      break;
    case "messages":
      content = <Message />;
      break;
    case "applications":
      content = <Applications />;
      break;
    case "profile":
      content = <Profile />;
      break;
    case "support":
    case "support-center": // Added this case for support-center
    case "admin-support":
    case "support-Partner-admins":
    case "support-tickets":
    case "support-school-students":
    case "support-school-admins":
      content = <Navigate to="/partner-support" replace />;
      break;
    case "upgrade":
      content = <PartnerPremiumPage />;
      break;
    case "offer-templates":
      content = <OfferTemplateManager />;
      break;
    case "custom-internship-certificate":
      content = <CustomInternshipCertificateManager />;
      break;
    case "stipend-details":
      content = <StipendDetails />;
      break;
    case "internship-payments":
      content = <InternshipPayments />;
      break;
    case "mock-interviews":
      content = <MockInterviewResults />;
      break;
    case "bin":
      content = <Bin />;
      break;
    case "logout":
      content = <div className="flex items-center justify-center h-full">You have been logged out. Please log in again.</div>;
      break;
    default:
      content = <div className="flex items-center justify-center h-full text-gray-500">Select a tab from the sidebar</div>;
  }

  return (
    <div className="flex-1 overflow-auto bg-gray-50">
      <div className="p-4 md:p-6 min-h-full">
        {content}
      </div>
    </div>
  );
};

export default BodyContent;
