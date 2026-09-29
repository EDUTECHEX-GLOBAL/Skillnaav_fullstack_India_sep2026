//File: PartnerMainPage.js

import React, { useState, useEffect } from "react";
import { Skeleton } from "antd";
import { TabProvider } from "./UserHomePageContext/HomePageContext";
import axios from "../../../../api/axiosInstance"; // ✅ add this
import PartnerDashboard from "./PartnerDashboard"; // Import the PartnerDashboard component
import Chatbot2 from "../../../../components/Chatbot2";

const partnerFeatureIndex = [
  { key: "home", label: "Dashboard", description: "Overview cards, quick stats, and recent activity." },
  { key: "user-management", label: "User Management", description: "Manage students, partners, and access roles." },
  { key: "school-accounts", label: "School Admin Accounts", description: "Create/approve school admin accounts." },
  { key: "analytics", label: "Analytics", description: "Charts and KPIs for internships and applications." },
  { key: "settings", label: "Settings", description: "Profile, org details, preferences." },
  { key: "bin", label: "Bin", description: "Restore or permanently delete removed items." },
  { key: "partner-accounts", label: "Partner Accounts", description: "Create and manage partner organizations." },
  { key: "internship-posts", label: "Internship Posts", description: "Create, edit, publish, or close internship postings." },
  { key: "applications", label: "Applications", description: "Review and manage applicants: View Applications, Shortlist, Shortlisted Resumes." },
  { key: "offer-templates", label: "Offer Templates", description: "Create and manage Offer Letter templates; upload a background image and reuse when sending offers." },
  { key: "stipend-details", label: "Stipend Details", description: "See stipend information like 'Student Pays' amounts and currency across internships." },
  { key: "profile", label: "Profile", description: "Update organization & personal details, change password, and profile photo." },
  { key: "support", label: "Support", description: "Contact support; fill the form with your issue and (optionally) add an attachment." },
  { key: "logout", label: "Logout", description: "Securely sign out from the Partner dashboard." },
  { key: "internship-payments", label: "Internship Payments", description: "Track/verify student payments for internships." },
  { key: "partner-payments", label: "Partner Payments", description: "Billing and payments between Skillnaav and partners." },
];

const PartnerMainPage = () => {
  const [loading, setLoading] = useState(true); // Loading state
  const [adminApproved, setAdminApproved] = useState(false); // Track if partner is approved

  useEffect(() => {
    const fetchPartnerInfo = async () => {
      try {
        // Check if the token exists in localStorage
        const token = localStorage.getItem("token");

        // If the token doesn't exist, handle it gracefully (redirect to login, etc.)
        if (!token) {
          console.error("No token found in localStorage.");
          window.location.href = "/login"; // Redirect to login page
          return;
        }

        console.log("Token:", token); // Log the token

        // Use axios to make the API request
        const response = await axios.get("/api/partners/profile", {
          headers: {
            Authorization: `Bearer ${token}`, // Include the token in the header
          },
        });

        // Handle the response data
        setAdminApproved(response.data.adminApproved); // Set approval status based on the response
      } catch (error) {
        console.error("Error fetching partner info:", error);
      } finally {
        setLoading(false); // Stop loading once the data is fetched
      }
    };

    fetchPartnerInfo();
  }, []); // Empty dependency array ensures this runs once when the component mounts

  return (
    <TabProvider>
      <div className="relative">
        {loading ? (
          <div className="p-4">
            <Skeleton active />
          </div>
        ) : (
          <div className="relative flex flex-col min-h-screen">
            <PartnerDashboard />
            {!adminApproved && (
              <div className="absolute inset-0 bg-gray-500 opacity-50 z-10 flex items-center justify-center">
                <div className="bg-white p-4 rounded shadow-md text-center">
                  <h2 className="text-lg font-semibold">Account Not Approved</h2>
                  <p className="text-sm">
                    Your account is not approved by an admin yet. Certain features are restricted until approval.
                  </p>
                </div>
              </div>
            )}
            {/* ✅ ADD IT HERE */}
            <Chatbot2 featureIndex={partnerFeatureIndex} />
          </div>
        )}
      </div>
    </TabProvider>
  );

};

export default PartnerMainPage;
