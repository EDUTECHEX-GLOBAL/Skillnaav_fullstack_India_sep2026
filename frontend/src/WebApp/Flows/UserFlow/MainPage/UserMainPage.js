import React, { useState, useEffect, useRef } from "react";
import { Skeleton, Modal } from "antd";
import { useNavigate, useSearchParams } from "react-router-dom";
import Navbar from "./Navbar";
import Sidebar from "./Sidebar";
import BodyContent from "./BodyContent";
import { TabProvider, useTabContext } from "./UserHomePageContext/HomePageContext";
import axios from "../../../../api/axiosInstance";

import Chatbot from "../../../../components/Chatbot";
import UserTextChatbot from "../../../../components/UserTextChatbot";
import UserAgeGateConsent from "../SignUpLogin/UserProfileBuilding/UserAgeGateConsent";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronLeft, faChevronRight } from "@fortawesome/free-solid-svg-icons";
import PendingApprovalCard from './PendingApprovalCard';
import chatbotIcon from "../../../../assets-webapp/chat-bot.png";
import videoAssistantPreview from "../../../../assets/Aiassistant.png";

const UserMainPageContent = () => {
  const { handleSelectTab, selectedTab } = useTabContext();

  const [userInfo, setUserInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isApproved, setIsApproved] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);           // mobile
  const [isDesktopSidebarOpen, setIsDesktopSidebarOpen] = useState(true); // desktop
  const [showUpgradePopup, setShowUpgradePopup] = useState(false);

  // Chatbot widget state
  const [activeChat, setActiveChat] = useState(null); // 'text' | 'video' | null
  const [menuOpen, setMenuOpen] = useState(false);
  const [assistantBubblePosition, setAssistantBubblePosition] = useState(null);
  const [assistantBubbleHidden, setAssistantBubbleHidden] = useState(false);
  const assistantBubbleDragRef = useRef(null);
  const [showReverifyModal, setShowReverifyModal] = useState(false);
  const [reverifySaving, setReverifySaving] = useState(false);
  const [popupDismissed, setPopupDismissed] = useState(false);
  const popupTimerRef = useRef(null);

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) setIsSidebarOpen(false);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Let other floating controls move out of the assistant preview's space.
  useEffect(() => {
    const previewVisible = !assistantBubbleHidden;
    window.__skillnaavAssistantPreviewVisible = previewVisible;
    window.dispatchEvent(new CustomEvent("skillnaav-assistant-preview", { detail: { visible: previewVisible } }));
  }, [assistantBubbleHidden]);

  const startAssistantBubbleDrag = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    assistantBubbleDragRef.current = {
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveAssistantBubble = (event) => {
    if (!assistantBubbleDragRef.current) return;
    const drag = assistantBubbleDragRef.current;
    drag.moved = true;
    setAssistantBubblePosition({
      x: Math.min(Math.max(12, event.clientX - drag.offsetX), window.innerWidth - 255),
      y: Math.min(Math.max(12, event.clientY - drag.offsetY), window.innerHeight - 205),
    });
  };

  const openVideoAssistant = () => {
    const wasDragged = assistantBubbleDragRef.current?.moved;
    assistantBubbleDragRef.current = null;
    if (!wasDragged) setActiveChat('video');
  };

  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        let token = localStorage.getItem("userToken");
        if (!token) {
          token = sessionStorage.getItem("userToken");
          if (token) localStorage.setItem("userToken", token);
          if (!token) {
            navigate("/user/login");
            return;
          }
        }

        const [profileRes, consentRes] = await Promise.all([
          axios.get("/api/users/profile", {
            headers: { Authorization: `Bearer ${token}` },
          }),
          axios.get("/api/user-age-gate-consent", {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        setUserInfo(profileRes.data);

        // Keep localStorage synced so Navbar (and other components) see fresh data like planType
        const existingUserInfo = JSON.parse(localStorage.getItem("studentInfo") || localStorage.getItem("userInfo") || "{}");
        const updatedUserInfo = { ...existingUserInfo, ...profileRes.data };
        localStorage.setItem("studentInfo", JSON.stringify(updatedUserInfo));
        window.dispatchEvent(new Event("userInfoUpdated"));

        const reverifyRequested = !!consentRes.data?.data?.reverificationRequested;
        setIsApproved(reverifyRequested ? false : profileRes.data.adminApproved);

        if (reverifyRequested) setShowReverifyModal(true);

        const openTab = searchParams.get("openTab");
        if (openTab) handleSelectTab(openTab);
      } catch (error) {
        console.error("Failed to fetch user info:", error);
        localStorage.removeItem("userToken");
        localStorage.removeItem("studentInfo");
        localStorage.removeItem("userInfo");
        localStorage.removeItem("sessionId");
        navigate("/user/login");
      } finally {
        setLoading(false);
      }
    };
    fetchUserInfo();
  }, [searchParams, navigate, handleSelectTab]);

  useEffect(() => {
    if (!userInfo || userInfo.isPremium || popupDismissed) return;
    const initialDelay = setTimeout(() => {
      setShowUpgradePopup(true);
      popupTimerRef.current = setTimeout(() => setShowUpgradePopup(false), 10000);
    }, 60000);
    return () => {
      clearTimeout(initialDelay);
      clearTimeout(popupTimerRef.current);
    };
  }, [userInfo, popupDismissed]);

  const handleDismissPopup = () => {
    setShowUpgradePopup(false);
    setPopupDismissed(true);
    clearTimeout(popupTimerRef.current);
  };

  const handleToggleSidebar = () => setIsSidebarOpen((prev) => !prev);
  const handleCloseSidebar = () => setIsSidebarOpen(false);

  const handleReverifyComplete = async (payload) => {
    try {
      let token = localStorage.getItem("userToken") || sessionStorage.getItem("userToken");
      if (!token) { navigate("/user/login"); return; }
      setReverifySaving(true);
      const fd = new FormData();
      fd.append("ageCategory", "OVER_18");
      fd.append("ageGateCompleted", "true");
      fd.append("ageVerificationPhoto", payload.ageVerificationPhoto);
      await axios.post("/api/user-age-gate-consent", fd, {
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "multipart/form-data" },
      });
      setShowReverifyModal(false);
      setIsApproved(false);
    } catch (err) {
      console.error("Reverification upload failed:", err);
    } finally {
      setReverifySaving(false);
    }
  };

  if (loading) {
    return <div className="p-6"><Skeleton active /></div>;
  }

  return (
    <>
      <div className="flex flex-col h-screen font-poppins bg-gray-50">
        {/* Navbar */}
        <Navbar onToggleSidebar={handleToggleSidebar} />

        {/* Layout: Sidebar + Content */}
        <div className="flex flex-1 overflow-hidden relative">

          {/* Sidebar */}
          <Sidebar
            isOpen={isSidebarOpen}
            isMobile={isMobile}
            onClose={handleCloseSidebar}
            isDesktopOpen={isDesktopSidebarOpen}
          />

          {/* Desktop chevron toggle button at sidebar boundary */}
          {selectedTab !== "assessment" && (
            <button
              onClick={() => setIsDesktopSidebarOpen((prev) => !prev)}
              className="hidden md:flex items-center justify-center absolute top-4 z-50
    w-6 h-6 rounded-full bg-white border border-gray-300 shadow-md
    hover:bg-purple-50 hover:border-purple-400 transition-all duration-200"
              style={{ left: isDesktopSidebarOpen ? "248px" : "48px" }}
            >
              <FontAwesomeIcon
                icon={isDesktopSidebarOpen ? faChevronLeft : faChevronRight}
                className="text-purple-600 text-xs"
              />
            </button>
          )}

          {/* Main content */}
         <main
  id="main-scroll-container"
  className={`flex-1 p-4 relative ${
    !isApproved ? 'overflow-hidden' : 'overflow-y-auto'
  }`}
>
            {/* Blur + block when not approved */}
            {!isApproved && (
              <div
                className="absolute inset-0 z-40 flex items-center justify-center"
                style={{ backdropFilter: 'blur(6px)', backgroundColor: 'rgba(255,255,255,0.55)' }}
              >
                <PendingApprovalCard userInfo={userInfo} />
              </div>
            )}

            {/* Always render content underneath so blur shows something */}
            <div
  className={!isApproved ? 'pointer-events-none select-none overflow-hidden h-full' : 'h-full'}
  style={!isApproved ? { position: 'fixed', width: '100%' } : {}}
>
  <BodyContent />
</div>
          </main>
        </div>
      </div>

      {/* Upgrade popup */}
      {showUpgradePopup && (
        <div className="fixed bottom-6 right-6 z-50 bg-white border border-purple-300 shadow-xl rounded-xl p-4 max-w-xs">
          <button
            onClick={handleDismissPopup}
            className="absolute top-2 right-3 text-gray-400 hover:text-gray-600 text-lg font-bold"
          >
            ×
          </button>
          <p className="text-sm text-gray-700 font-medium">
            Upgrade to Premium to apply for unlimited jobs, get priority listings, and exclusive opportunities.
          </p>
          <button
            onClick={() => {
              handleDismissPopup();
              handleSelectTab("premium");
            }}
            className="mt-3 w-full bg-purple-600 hover:bg-purple-700 text-white text-sm py-2 rounded-lg"
          >
            Upgrade Now
          </button>
        </div>
      )}

      {/* Reverify Modal */}
      <Modal open={showReverifyModal} footer={null} closable={false} centered>
        <UserAgeGateConsent onComplete={handleReverifyComplete} saving={reverifySaving} />
      </Modal>

      {/* Chatbot widget (fixed floating toggle + panel) */}
      {selectedTab !== "assessment" && (
      <div className={`fixed right-6 z-50 transition-all duration-300 ${assistantBubbleHidden ? "bottom-6" : "bottom-[14rem]"}`}>
        {!activeChat && (
          <div className="relative flex flex-col items-end">
            {/* The Menu */}
            {menuOpen && (
              <div className="mb-4 w-56 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-50 animate-fade-in origin-bottom-right transition-all">
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Choose Assistant</p>
                </div>
                <button 
                  onClick={() => { setActiveChat('text'); setMenuOpen(false); }}
                  className="w-full px-4 py-4 text-left hover:bg-blue-50 flex items-center gap-3 text-sm font-medium text-gray-700 transition-colors"
                >
                  <span className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 shadow-sm text-lg">
                    💬
                  </span>
                  <div>
                    <p className="font-semibold text-gray-800">Text Chat</p>
                    <p className="text-xs text-gray-400 mt-0.5 font-normal">Quick answers & help</p>
                  </div>
                </button>
                <div className="h-px bg-gray-100 mx-2"></div>
                <button 
                  onClick={() => { setActiveChat('video'); setMenuOpen(false); }}
                  className="w-full px-4 py-4 text-left hover:bg-purple-50 flex items-center gap-3 text-sm font-medium text-gray-700 transition-colors"
                >
                  <span className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 shadow-sm text-lg">
                    📹
                  </span>
                  <div>
                    <p className="font-semibold text-gray-800">Video Assistant</p>
                    <p className="text-xs text-gray-400 mt-0.5 font-normal">Interactive AI avatar</p>
                  </div>
                </button>
              </div>
            )}

            {/* The FAB */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="rounded-full shadow-lg transition-transform duration-200 hover:scale-105 relative z-50"
              aria-label="Open chat menu"
            >
              <img
                src={chatbotIcon}
                alt="Chatbot"
                className="h-16 w-16 rounded-full"
              />
            </button>
          </div>
        )}

        {activeChat === 'video' && (
          <Chatbot onClose={() => setActiveChat(null)} />
        )}

        {activeChat === 'text' && (
          <UserTextChatbot onClose={() => setActiveChat(null)} />
        )}
      </div>
      )}

      {/* Draggable AI video assistant preview — click to open the large assistant window */}
      {selectedTab !== "assessment" && !activeChat && !assistantBubbleHidden && (
        <button
          type="button"
          onPointerDown={startAssistantBubbleDrag}
          onPointerMove={moveAssistantBubble}
          onPointerUp={openVideoAssistant}
          onPointerCancel={() => { assistantBubbleDragRef.current = null; }}
          style={assistantBubblePosition
            ? { left: assistantBubblePosition.x, top: assistantBubblePosition.y }
            : { right: "1.5rem", bottom: "1.5rem" }}
          className="fixed z-40 h-[180px] w-[230px] touch-none overflow-visible rounded-[28px] border-4 border-white shadow-2xl transition-shadow hover:shadow-purple-300 focus:outline-none focus:ring-4 focus:ring-purple-300"
          aria-label="Open AI video assistant. Drag to move."
          title="AI video assistant — drag to move"
        >
          <img src={videoAssistantPreview} alt="AI video assistant" className="h-full w-full rounded-[24px] object-cover object-center" />
          <span
            role="button"
            tabIndex={0}
            onPointerDown={(event) => event.stopPropagation()}
            onPointerMove={(event) => event.stopPropagation()}
            onPointerUp={(event) => {
              event.stopPropagation();
              setAssistantBubbleHidden(true);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") setAssistantBubbleHidden(true);
            }}
            className="absolute right-2 top-2 flex h-8 w-8 cursor-pointer items-center justify-center text-2xl leading-none text-slate-900 transition hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-slate-400"
            aria-label="Hide AI video assistant"
            title="Hide assistant"
          >
            ×
          </span>
        </button>
      )}
    </>
  );
};

const UserMainPage = () => (
  <TabProvider>
    <UserMainPageContent />
  </TabProvider>
);

export default UserMainPage;
