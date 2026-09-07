import React, { useState, useRef, useEffect } from "react";
import ReactDOM from 'react-dom';
import axiosInstance from "../api/axiosInstance";
import { LiveAvatarSession, SessionEvent } from "@heygen/liveavatar-web-sdk";
import aiAssistantBg from "../assets/Aiassistant.png";
import assistantVideo from "../assets/skillnaav-corporate-assistant-body-only-v3-silent_1.mp4";
import chatbotIcon from "../assets-webapp/chat-bot.png";
import { motion, AnimatePresence } from 'framer-motion';
import { Maximize2, Minimize2, X, ChevronUp, Mic, MicOff, MoreHorizontal, MessageSquare, PhoneOff } from 'lucide-react';

const languages = [
  "Arabic", "Bulgarian", "Chinese", "Croatian", "Czech", "Danish", 
  "Dutch", "English", "Finnish", "French", "German", "Greek", 
  "Hindi", "Hungarian", "Indonesian", "Italian", "Japanese", "Korean", 
  "Norwegian", "Polish", "Portuguese", "Romanian", "Russian", "Slovak", 
  "Spanish", "Swedish", "Thai", "Turkish", "Ukrainian", "Vietnamese"
];

export default function Chatbot() {
  // Widget States: 'fab' (just button), 'collapsed' (preview card), 'expanded' (large card), 'fullscreen'
  const [widgetState, setWidgetState] = useState('collapsed');
  
  const [isLoading, setIsLoading] = useState(false);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [debugText, setDebugText] = useState("");
  const [language, setLanguage] = useState('English');
  const [isLanguageOpen, setIsLanguageOpen] = useState(false);
  const [chatHistory, setChatHistory] = useState([]);
  const [isTranscriptOpen, setIsTranscriptOpen] = useState(false);

  const videoRef = useRef(null);
  const sessionRef = useRef(null);
  const recognitionRef = useRef(null);
  const dropdownRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Auto-scroll transcript when new messages arrive
  useEffect(() => {
    if (isTranscriptOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatHistory, isTranscriptOpen]);
  
  const token = localStorage.getItem("userToken") || sessionStorage.getItem("userToken") || "";

  // Close dropdown if clicked outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsLanguageOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Dispatch event when widget state changes so external FABs (like Home.js) can adjust their position
  useEffect(() => {
    const isCardVisible = widgetState === 'collapsed' || widgetState === 'expanded' || widgetState === 'fullscreen';
    window.__skillnaavAssistantPreviewVisible = isCardVisible;
    window.dispatchEvent(new CustomEvent("skillnaav-assistant-preview", { detail: { visible: isCardVisible, expanded: widgetState === 'expanded' } }));
  }, [widgetState]);

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = async (event) => {
        const transcript = event.results[0][0].transcript;
        setDebugText("Heard: " + transcript);
        await handleSendToBackend(transcript);
      };

      recognitionRef.current.onerror = (event) => {
        console.error("Speech recognition error", event.error);
        setIsRecording(false);
      };

      recognitionRef.current.onend = () => {
        setIsRecording(false);
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSendToBackend = async (text) => {
    if (!text.trim()) return;
    
    setChatHistory(prev => [...prev, { role: 'user', text }]);
    setDebugText("Thinking...");
    try {
      const res = await axiosInstance.post(
        "/api/career-chat",
        { message: text },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const { reply } = res.data;
      
      setChatHistory(prev => [...prev, { role: 'ai', text: reply }]);
      setDebugText("Speaking...");
      if (sessionRef.current) {
        sessionRef.current.repeat(reply);
      }
      setDebugText("Click the microphone to speak.");
    } catch (err) {
      console.error("Chat error:", err);
      setDebugText("Sorry, I could not process that request.");
    }
  };

  const startSession = async () => {
    if (isSessionActive) return;
    setIsLoading(true);
    setDebugText("Initializing Avatar...");
    try {
      const res = await axiosInstance.post(
        "/api/heygen-token",
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const avatarToken = res.data.token;

      const session = new LiveAvatarSession(avatarToken, {
        voiceChat: false,
      });
      sessionRef.current = session;

      session.on(SessionEvent.SESSION_STREAM_READY, () => {
        if (videoRef.current) {
          session.attach(videoRef.current);
        }
        
        // Wait a tiny bit for video to render, then greet
        setTimeout(() => {
          if (sessionRef.current) {
            try {
              sessionRef.current.repeat("Hello! I am your Skill Naav assistant. How can I help you today?");
            } catch (err) {
              console.warn("Avatar repeat error:", err);
            }
          }
        }, 500);

        // Auto start microphone after greeting finishes
        setTimeout(() => {
          if (recognitionRef.current && sessionRef.current) {
            try {
              recognitionRef.current.start();
              setIsRecording(true);
              setDebugText("Listening...");
            } catch(e) {
              console.error("Auto mic start failed:", e);
            }
          }
        }, 4000);
      });
      
      session.on(SessionEvent.SESSION_DISCONNECTED, () => {
        endSession();
      });

      await session.start();
      setIsSessionActive(true);
      setDebugText("Connected. Starting microphone...");

    } catch (error) {
      console.error("Failed to start avatar session:", error);
      const errMsg = error?.response?.data?.error || error?.message || "Please try again.";
      setDebugText("Failed to connect: " + errMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const endSession = async () => {
    if (sessionRef.current) {
      try {
        await sessionRef.current.stop();
      } catch (e) {
        console.error("Error stopping avatar", e);
      }
    }
    sessionRef.current = null;
    setIsSessionActive(false);
    setIsRecording(false);
    setDebugText("");
    // When session ends, go back to collapsed state
    setWidgetState('collapsed');
  };

  const toggleRecording = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
    } else {
      if (!recognitionRef.current) {
        alert("Microphone access is not supported in this browser. Try Safari/Chrome on a secure (HTTPS) connection.");
        setDebugText("Mic not supported.");
        return;
      }
      try {
        recognitionRef.current.start();
        setIsRecording(true);
        setDebugText("Listening...");
      } catch (e) {
        console.error(e);
        alert("Failed to start microphone. This usually happens if you are not using HTTPS, or permissions were denied.");
        setDebugText("Error starting microphone.");
      }
    }
  };

  const handlePreviewClick = () => {
    setWidgetState('expanded');
  };

  const handleFabClick = () => {
    if (widgetState === 'fab') setWidgetState('menu');
    else if (widgetState === 'menu') setWidgetState('fab');
    else setWidgetState('fab');
  };

  const languageCode = language.substring(0, 2).toUpperCase();

  // STYLES FOR THE 3 STATES
  // All states render the SAME video container, we just animate the container sizing
  const isFullscreen = widgetState === 'fullscreen';
  const isExpanded = widgetState === 'expanded';
  const isCollapsed = widgetState === 'collapsed';
  const isMenu = widgetState === 'menu';
  const isFab = widgetState === 'fab';

  let dialogStyle = {};
  if (isFullscreen) {
    dialogStyle = { left: 0, top: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', borderRadius: 0, maxWidth: '100vw', maxHeight: '100vh', boxSizing: 'border-box' };
  } else if (isExpanded) {
    dialogStyle = { right: 24, bottom: 24, width: '650px', height: '350px', borderRadius: '20px', maxWidth: 'calc(100vw - 48px)', maxHeight: 'calc(100vh - 48px)', boxSizing: 'border-box' };
  } else if (isCollapsed) {
    dialogStyle = { right: 24, bottom: 24, width: '320px', height: '180px', borderRadius: '20px', maxWidth: 'min(400px, calc(100vw - 48px))', maxHeight: 'calc(100vh - 120px)', boxSizing: 'border-box' };
  } else {
    dialogStyle = { right: 24, bottom: 24, width: '0px', height: '0px', opacity: 0, overflow: 'hidden', boxSizing: 'border-box' };
  }

  const modalContent = (
    <>
      {/* Background Overlay (only for expanded/fullscreen) */}
      <AnimatePresence>
        {(isExpanded || isFullscreen) && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm pointer-events-auto z-[9998]"
            onClick={() => setWidgetState('collapsed')}
          />
        )}
      </AnimatePresence>

      {/* The Unified Video Container */}
      <motion.div
        layout
        initial={false}
        animate={dialogStyle}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="fixed overflow-hidden bg-[#001f3f] shadow-2xl pointer-events-auto origin-bottom-right box-border"
        style={{ zIndex: 9999 }} // ensure above everything
      >
        {/* Background Image / Video Placeholder */}
        <div className="absolute inset-0 box-border">
          <video
            src={assistantVideo}
            autoPlay
            loop
            muted
            playsInline
            poster={aiAssistantBg}
            className="w-full h-full object-cover box-border"
          />
          {/* We always render the video tag so it never loses reference */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className={`absolute inset-0 w-full h-full object-cover z-10 box-border ${!isSessionActive ? 'opacity-0' : 'opacity-100'}`}
          >
            <track kind="captions" />
          </video>
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent z-0 pointer-events-none box-border"></div>
        </div>

        {/* COLLAPSED STATE OVERLAYS */}
        <AnimatePresence>
          {isCollapsed && (
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 z-20 cursor-pointer box-border"
              onClick={handlePreviewClick}
            >
              {/* Close 'X' for Preview Card */}
              <button 
                onClick={(e) => { e.stopPropagation(); setWidgetState('fab'); }}
                className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-md hover:bg-rose-500/80 transition-colors box-border"
              >
                <X size={14} />
              </button>

            </motion.div>
          )}
        </AnimatePresence>

        {/* EXPANDED / FULLSCREEN CONTROLS */}
        <AnimatePresence>
          {(isExpanded || isFullscreen) && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-20 pointer-events-none box-border group">
              
              {/* Top Controls Area */}
              <div className="absolute top-0 left-0 right-0 p-2 flex items-start justify-between pointer-events-none box-border">
                {/* Left Controls */}
                <div className="flex gap-1 pointer-events-auto flex-wrap transition-opacity duration-300">
                  <button 
                    onClick={() => setWidgetState(isFullscreen ? 'expanded' : 'fullscreen')}
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-md hover:bg-black/60 transition-colors box-border"
                  >
                    {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                  </button>
                  

                </div>

                {/* Right Controls */}
                <div className="flex gap-1 items-center ml-auto">
                  {/* Branding text "Skillnaav" logo */}
                  <div className="pointer-events-none box-border flex items-center justify-center rounded-full bg-black/40 h-7 px-2 backdrop-blur-md border border-white/10 hidden sm:flex transition-opacity duration-300">
                      <span className="text-[9px] font-bold text-white tracking-widest uppercase leading-none">Skillnaav</span>
                  </div>
                  
                  {/* X button is always visible so user can always close it */}
                  <button 
                    onClick={() => setWidgetState('collapsed')}
                    className="flex h-7 w-7 pointer-events-auto items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-md hover:bg-rose-500/80 transition-colors box-border"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>

              {/* Debug / Status Text */}
              {debugText && (
                <div className="absolute top-12 right-2 pointer-events-none box-border max-w-[calc(100%-16px)]">
                  <div className="bg-black/50 backdrop-blur-md text-white text-[9px] px-2 py-1 rounded-full border border-white/10 truncate box-border">
                    {debugText}
                  </div>
                </div>
              )}

              {/* Bottom Left Badge */}
              <div className="absolute bottom-12 left-2 flex items-center justify-center rounded-full bg-black/40 px-2 py-1 backdrop-blur-md border border-white/10 pointer-events-none box-border max-w-full">
                <span className="text-[9px] font-semibold tracking-wider text-white truncate box-border">AI ASSISTANT</span>
              </div>

              {/* Start Session Button Overlay */}
              {!isSessionActive && (
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none box-border p-2">
                  <button
                    onClick={startSession}
                    disabled={isLoading}
                    className="pointer-events-auto px-4 py-2 bg-gradient-to-r from-orange-500 to-rose-500 text-white text-xs font-bold rounded-full shadow-lg hover:shadow-orange-500/50 hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed max-w-full truncate box-border mt-4"
                  >
                    {isLoading ? "Connecting..." : "Start Video"}
                  </button>
                </div>
              )}

              {/* Bottom Center Controls */}
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-full bg-black/50 p-1.5 backdrop-blur-lg border border-white/10 shadow-lg pointer-events-auto box-border max-w-[calc(100%-16px)] overflow-x-auto [&::-webkit-scrollbar]:hidden transition-opacity duration-300">
                <button className="flex shrink-0 h-10 w-10 items-center justify-center rounded-full text-white hover:bg-white/10 transition-colors box-border">
                  <ChevronUp size={20} />
                </button>
                
                <button 
                  onClick={isSessionActive ? toggleRecording : undefined}
                  disabled={!isSessionActive}
                  className={`flex shrink-0 h-10 w-10 items-center justify-center rounded-full transition-colors box-border ${
                    !isSessionActive ? 'opacity-50 cursor-not-allowed text-white' : 
                    isRecording ? 'bg-white/20 text-rose-400' : 'text-white hover:bg-white/10'
                  }`}
                >
                  {isRecording ? <Mic size={20} className="animate-pulse" /> : <MicOff size={20} />}
                </button>
                
                <button className="flex shrink-0 h-10 w-10 items-center justify-center rounded-full text-white hover:bg-white/10 transition-colors box-border">
                  <MoreHorizontal size={20} />
                </button>
                
                <button 
                  onClick={() => setIsTranscriptOpen(!isTranscriptOpen)}
                  className={`flex shrink-0 h-10 w-10 items-center justify-center rounded-full transition-colors box-border ${isTranscriptOpen ? 'bg-white/20 text-white' : 'text-white hover:bg-white/10'}`}
                >
                  <MessageSquare size={20} />
                </button>
                
                <button 
                  onClick={endSession}
                  className="flex shrink-0 h-10 w-16 items-center justify-center rounded-full bg-rose-600 text-white hover:bg-rose-700 transition-colors shadow-md ml-1 box-border"
                >
                  <PhoneOff size={20} />
                </button>
              </div>

              {/* Transcript Overlay */}
              <AnimatePresence>
                {isTranscriptOpen && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute bottom-12 right-2 w-72 max-w-[calc(100%-16px)] max-h-48 bg-black/60 backdrop-blur-md rounded-xl border border-white/10 flex flex-col pointer-events-auto overflow-hidden box-border z-30"
                  >
                    <div className="p-2 border-b border-white/10 bg-white/5 flex justify-between items-center box-border">
                      <span className="text-white text-[10px] font-bold uppercase tracking-wider">Live Transcript</span>
                      <button onClick={() => setIsTranscriptOpen(false)} className="text-gray-400 hover:text-white transition-colors">
                        <X size={12} />
                      </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-2 [&::-webkit-scrollbar]:hidden box-border" style={{ scrollBehavior: 'smooth' }}>
                      {chatHistory.length === 0 ? (
                        <p className="text-gray-400 text-[10px] text-center italic mt-2">No messages yet. Click the mic to speak.</p>
                      ) : (
                        chatHistory.map((msg, i) => (
                          <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} box-border`}>
                            <div className={`px-2 py-1.5 rounded-lg max-w-[85%] text-[10px] leading-relaxed box-border ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-br-sm' : 'bg-gray-700 text-white rounded-bl-sm'}`}>
                              {msg.text}
                            </div>
                          </div>
                        ))
                      )}
                      <div ref={messagesEndRef} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* MENU - Appears next to FAB when state is 'menu' */}
      <AnimatePresence>
        {isMenu && (
          <motion.div 
            initial={{ opacity: 0, x: 10, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 10, scale: 0.95 }}
            className="fixed right-[100px] z-[9999] w-56 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden pointer-events-auto origin-bottom-right box-border"
            style={{ bottom: isCollapsed ? '220px' : '24px' }}
          >
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 box-border">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Choose Assistant</p>
            </div>
            <button 
              onClick={() => {
                setWidgetState('fab');
                window.dispatchEvent(new CustomEvent('open-text-chat'));
              }}
              className="w-full px-4 py-4 text-left hover:bg-blue-50 flex items-center gap-3 text-sm font-medium text-gray-700 transition-colors box-border"
            >
              <span className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 shadow-sm text-lg box-border">
                💬
              </span>
              <div className="box-border">
                <p className="font-semibold text-gray-800">Text Chat</p>
                <p className="text-xs text-gray-400 mt-0.5 font-normal">Quick answers & help</p>
              </div>
            </button>
            <div className="h-px bg-gray-100 mx-2 box-border"></div>
            <button 
              onClick={() => setWidgetState('collapsed')}
              className="w-full px-4 py-4 text-left hover:bg-purple-50 flex items-center gap-3 text-sm font-medium text-gray-700 transition-colors box-border"
            >
              <span className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 shadow-sm text-lg box-border">
                📹
              </span>
              <div className="box-border">
                <p className="font-semibold text-gray-800">Video Assistant</p>
                <p className="text-xs text-gray-400 mt-0.5 font-normal">Interactive AI avatar</p>
              </div>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FIXED FAB ICON */}
      <AnimatePresence>
        {!isExpanded && !isFullscreen && (
          <motion.div 
            initial={{ scale: 0 }}
            animate={{ scale: 1, bottom: isCollapsed ? 220 : 24 }}
            exit={{ scale: 0 }}
            className="fixed right-6 z-[9999] pointer-events-auto box-border flex flex-col gap-4 items-center transition-all duration-300"
          >
            {/* Chatbot Menu FAB */}
            <button
              onClick={handleFabClick}
              className="flex items-center justify-center rounded-full shadow-xl transition-transform duration-200 hover:scale-105 box-border relative group"
              style={{ width: '64px', height: '64px' }}
            >
              <div className="absolute right-full mr-4 bg-gray-800 text-white text-xs px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none font-semibold">
                AI Assistant
              </div>
              <img
                src={chatbotIcon}
                alt="AI Assistant Menu"
                className="w-full h-full rounded-full object-cover box-border"
              />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

    </>
  );

  return ReactDOM.createPortal(modalContent, document.body);
}
