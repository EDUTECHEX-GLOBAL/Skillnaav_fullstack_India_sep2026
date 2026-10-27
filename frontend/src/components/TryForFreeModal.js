import React, { useEffect } from "react";
import edutechexlogo from "../assets/Edutech-logo.png";
import { useNavigate } from "react-router-dom";

const TryForFreeModal = ({ isOpen, onClose }) => {
  const navigate = useNavigate();

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.body.style.overflow = "unset";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleOptionClick = (path) => {
    onClose();
    navigate(path);
  };

  const options = [
    {
      title: "Continue as Student",
      path: "/user",
      bgColor: "#744bd8",
      hoverColor: "hover:bg-[#683ece]",
    },
    {
      title: "Continue as Partner",
      path: "/partner",
      bgColor: "#008e7b",
      hoverColor: "hover:bg-[#007b6a]",
    },
    {
      title: "Continue as Admin",
      path: "/admin/login",
      bgColor: "#70caf6",
      hoverColor: "hover:bg-[#5bbfee]",
    },
    {
      title: "Continue as School Admin",
      path: "/schooladmin/login",
      bgColor: "#fa6738",
      hoverColor: "hover:bg-[#e85829]",
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity duration-200"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative z-10 w-full max-w-sm overflow-hidden rounded-2xl bg-white p-6 shadow-2xl transition-all font-poppins text-center">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-3.5 top-3.5 rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          title="Close"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Logo */}
        <img
          src={edutechexlogo}
          alt="Edutechex Logo"
          className="mx-auto w-36 h-auto mb-3 object-contain"
        />

        <h3 className="text-xl sm:text-2xl font-extrabold text-[#014438] tracking-tight mb-1">
          Try for Free
        </h3>
        <p className="text-xs sm:text-sm font-medium text-[#00796b] mb-4">
          Choose how you'd like to continue:
        </p>

        {/* Role Buttons matching revamp UI */}
        <div className="flex flex-col gap-2.5">
          {options.map((opt, i) => (
            <button
              key={i}
              onClick={() => handleOptionClick(opt.path)}
              style={{ backgroundColor: opt.bgColor }}
              className={`w-full text-white font-semibold py-2.5 px-5 rounded-lg shadow-sm transition-all duration-150 transform active:scale-98 text-center text-sm outline-none cursor-pointer ${opt.hoverColor}`}
            >
              {opt.title}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TryForFreeModal;
