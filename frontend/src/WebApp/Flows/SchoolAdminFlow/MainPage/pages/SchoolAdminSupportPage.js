import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft } from "react-icons/fa";
import logo from "../../../../../assets-webapp/skillnaav_final_logo.svg";
import SchoolAdminSupport from "./Support";

const SchoolAdminSupportPage = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("schoolAdminToken");
    if (!token) navigate("/schooladmin/login", { replace: true });
  }, [navigate]);

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-gray-100 font-poppins">
      <main className="flex-1 flex flex-col">
        <SchoolAdminSupport 
          onBack={() => navigate("/schooladmin/dashboard")}
          backLabel="Dashboard"
        />
      </main>
    </div>
  );
};

export default SchoolAdminSupportPage;
