import React from "react";

const PageLoader = () => {
  const iconSrc = `${process.env.PUBLIC_URL || ""}/favicon.ico`;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white">
      <div className="relative flex items-center justify-center w-20 h-20">
        {/* Soft rotating ring */}
        <div
          className="absolute inset-0 rounded-full border-4 border-blue-100 border-t-blue-600 animate-spin"
          style={{ animationDuration: "1s" }}
        />

        {/* Brand favicon icon */}
        <img
          src={iconSrc}
          alt="Loading..."
          className="w-11 h-11 object-contain rounded-lg shadow-sm"
          style={{ animation: "pulse-scale 1.5s ease-in-out infinite" }}
        />
      </div>
      <p className="mt-4 text-xs font-semibold text-gray-400 tracking-widest uppercase">
        Loading...
      </p>

      <style>{`
        @keyframes pulse-scale {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.08); opacity: 0.85; }
        }
      `}</style>
    </div>
  );
};

export default PageLoader;
