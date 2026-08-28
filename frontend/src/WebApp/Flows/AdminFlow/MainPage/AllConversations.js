import React, { useState } from "react";
import { FaBuilding, FaUserGraduate, FaSchool } from "react-icons/fa";
import AdminPartnerSupport from "./AdminPartnerSupport";
import StudentSupportCenter from "./StudentSupportCenter";
import SchoolAdminSupport from "./Schooladminsupport";

export default function AllConversations() {
  const [view, setView] = useState("student");

  const tabs = [
    { key: "student", label: "Student Tickets",  icon: <FaUserGraduate />, color: "blue"  },
    { key: "partner", label: "Partner Tickets",  icon: <FaBuilding />,     color: "blue"  },

    { key: "schooladmin", label: "School Admin", icon: <FaSchool />,       color: "purple"},
  ];

  return (
    <div>
      {/* Switcher */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-1.5 mb-6 flex gap-1 w-fit flex-wrap">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setView(t.key)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              view === t.key
                ? `bg-${t.color}-600 text-white shadow-md`
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {view === "student"     && <StudentSupportCenter initialView="student" />}
      {view === "partner"     && <AdminPartnerSupport />}

      {view === "schooladmin" && <SchoolAdminSupport />}
    </div>
  );
}