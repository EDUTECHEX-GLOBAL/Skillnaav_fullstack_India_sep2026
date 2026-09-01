import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import StudentSupport from "./Support";

const UserSupportPage = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("userToken") || sessionStorage.getItem("userToken");
    if (!token) navigate("/user/login", { replace: true });
  }, [navigate]);

  return (
    <div className="min-h-screen flex flex-col bg-gray-100 font-poppins">
      {/* Support system handles top bar directly now */}
      <main className="flex-1 flex flex-col">
        <StudentSupport 
          onBack={() => navigate("/user-main-page/home")}
          backLabel="Dashboard"
        />
      </main>
    </div>
  );
};

export default UserSupportPage;
