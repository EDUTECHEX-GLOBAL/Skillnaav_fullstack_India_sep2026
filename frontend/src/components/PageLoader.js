import React from "react";
import logo from "../assets-webapp/Skillnaavlogo.png"; // update path to your actual logo

const PageLoader = () => {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white">
      <div className="animate-spin rounded-full p-1"
        style={{ animation: "spin 1s linear infinite" }}>
        <img
          src={logo}
          alt="Loading..."
          className="w-16 h-16 object-contain"
          style={{ animation: "pulse-spin 1.2s ease-in-out infinite" }}
        />
      </div>
      <p className="mt-4 text-sm text-gray-400 tracking-widest uppercase">
        Loading...
      </p>

      <style>{`
        @keyframes pulse-spin {
          0%   { transform: rotate(0deg) scale(1);    opacity: 1; }
          50%  { transform: rotate(180deg) scale(1.1); opacity: 0.7; }
          100% { transform: rotate(360deg) scale(1);  opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default PageLoader;