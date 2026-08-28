import React, { useEffect, useState } from "react";
import Navbar from "./Navbar";
import Sidebar from "./Sidebar";
import BodyContent from "./BodyContent";
import { TabProvider } from "./UserHomePageContext/HomePageContext";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronLeft, faChevronRight } from "@fortawesome/free-solid-svg-icons";

const DESKTOP_SIDEBAR_BREAKPOINT = 1200;

const getIsCompactLayout = () =>
  window.innerWidth < DESKTOP_SIDEBAR_BREAKPOINT;

const AdminMainPageContent = () => {
  const [isCompactLayout, setIsCompactLayout] = useState(getIsCompactLayout());
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // mobile
  const [isDesktopSidebarOpen, setIsDesktopSidebarOpen] = useState(true); // desktop

  useEffect(() => {
    const handleResize = () => {
      const compactLayout = getIsCompactLayout();
      setIsCompactLayout(compactLayout);
      if (compactLayout) {
        setIsSidebarOpen(false);
        return;
      }

      setIsDesktopSidebarOpen(true);
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleToggleSidebar = () => setIsSidebarOpen((prev) => !prev);
  const handleCloseSidebar = () => setIsSidebarOpen(false);

  return (
    <div className="flex flex-col h-screen font-poppins bg-gray-50">
      {/* Top Navbar */}
      <Navbar onToggleSidebar={handleToggleSidebar} showMenuToggle={isCompactLayout} />

      {/* Sidebar + Content */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Sidebar */}
        <Sidebar
          isOpen={isSidebarOpen}
          isCompactLayout={isCompactLayout}
          onClose={handleCloseSidebar}
          isDesktopOpen={isDesktopSidebarOpen}
        />

        {/* Desktop Floating Chevron */}
        <button
          onClick={() => setIsDesktopSidebarOpen((prev) => !prev)}
          className={`${isCompactLayout ? "hidden" : "flex"} items-center justify-center absolute top-4 z-50
          w-6 h-6 rounded-full bg-white border border-gray-300 shadow-md
          hover:bg-teal-50 hover:border-teal-400 transition-all duration-200`}
          style={{ left: isDesktopSidebarOpen ? "248px" : "48px" }}
          title={isDesktopSidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
        >
          <FontAwesomeIcon
            icon={isDesktopSidebarOpen ? faChevronLeft : faChevronRight}
            className="text-teal-600 text-xs"
          />
        </button>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto bg-[#f7f9fc]">
          <BodyContent />
        </main>
      </div>
    </div>
  );
};

const AdminMainPage = () => (
  <TabProvider>
    <AdminMainPageContent />
  </TabProvider>
);

export default AdminMainPage;
