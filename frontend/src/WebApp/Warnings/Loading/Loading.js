import React from "react";

const Loading = () => {
  const iconSrc = `${process.env.PUBLIC_URL || ""}/favicon.ico`;

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-50">
      <div className="flex flex-col items-center">
        {/* Spinner with centered Favicon */}
        <div className="relative flex items-center justify-center w-20 h-20">
          <div className="absolute inset-0 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
          <img
            src={iconSrc}
            alt="Loading..."
            className="w-10 h-10 object-contain rounded-md"
          />
        </div>

        {/* Loading Text */}
        <p className="mt-4 text-blue-600 text-sm font-semibold tracking-wider uppercase">Loading...</p>
      </div>
    </div>
  );
};

export default Loading;
