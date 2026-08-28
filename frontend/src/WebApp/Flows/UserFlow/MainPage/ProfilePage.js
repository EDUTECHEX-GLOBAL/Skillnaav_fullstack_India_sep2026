import React, { useState } from "react";
import Profile from "./Profile";
import SmartProfile from "./SmartProfile";

const ProfilePage = () => {
  const [tab, setTab] = useState("basic");

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Tab Bar */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 flex gap-1 pt-3">
          <button
            onClick={() => setTab("basic")}
            className={`px-5 py-2.5 text-sm font-semibold rounded-t-lg border-b-2 transition-all ${
              tab === "basic"
                ? "border-blue-600 text-blue-600 bg-blue-50"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
            }`}
          >
            Personal Info
          </button>

          <button
            onClick={() => setTab("career")}
            className={`px-5 py-2.5 text-sm font-semibold rounded-t-lg border-b-2 transition-all ${
              tab === "career"
                ? "border-blue-600 text-blue-600 bg-blue-50"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
            }`}
          >
            Career Portfolio ✨
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="pt-4">
        {tab === "basic" && <Profile />}
        {tab === "career" && <SmartProfile />}
      </div>
    </div>
  );
};

export default ProfilePage;