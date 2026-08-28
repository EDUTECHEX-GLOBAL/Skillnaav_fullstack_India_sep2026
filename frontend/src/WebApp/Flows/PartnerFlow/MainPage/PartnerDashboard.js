import React, { useState } from "react";
import Navbar from "./Navbar";
import Sidebar from "./Sidebar";
import BodyContent from "./BodyContent";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronLeft, faChevronRight } from "@fortawesome/free-solid-svg-icons";

const PartnerDashboard = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // mobile
  const [isDesktopSidebarOpen, setIsDesktopSidebarOpen] = useState(true); // desktop

  const handleToggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
  const handleCloseSidebar = () => setIsSidebarOpen(false);

  return (
    <div className="flex flex-col h-screen font-poppins bg-gray-50">
      {/* Navbar */}
      <Navbar onToggleSidebar={handleToggleSidebar} />

      {/* Layout: Sidebar + Content */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Sidebar — passes desktop open state */}
        <Sidebar
          isOpen={isSidebarOpen}
          onClose={handleCloseSidebar}
          isDesktopOpen={isDesktopSidebarOpen}
        />

        {/* Desktop toggle button — sits at the boundary of the sidebar */}
        <button
  onClick={() => setIsDesktopSidebarOpen(!isDesktopSidebarOpen)}
  className="hidden md:flex items-center justify-center absolute top-4 z-50
    w-6 h-6 rounded-full bg-white border border-gray-300 shadow-md
    hover:bg-teal-50 hover:border-teal-400 transition-all duration-200"
  style={{ left: isDesktopSidebarOpen ? "248px" : "48px" }} // 48px = w-14 (3.5rem)
  title={isDesktopSidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
>
  <FontAwesomeIcon
    icon={isDesktopSidebarOpen ? faChevronLeft : faChevronRight}
    className="text-teal-600 text-xs"
  />
</button>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-4">
          <BodyContent />
        </main>
      </div>
    </div>
  );
};

export default PartnerDashboard;