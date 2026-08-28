import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft } from "react-icons/fa";
import logo from "../../../../assets-webapp/skillnaav_final_logo.svg";
import PartnerSupport from "./PartnerSupport";

const PartnerSupportPage = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("partnerToken") || localStorage.getItem("token");
    if (!token) navigate("/partner/login", { replace: true });
  }, [navigate]);

  return (
    <div className="min-h-screen h-screen flex flex-col bg-gray-100 font-poppins overflow-hidden">
      <main className="flex-1 flex flex-col overflow-hidden">
        <PartnerSupport />
      </main>
    </div>
  );
};

export default PartnerSupportPage;
