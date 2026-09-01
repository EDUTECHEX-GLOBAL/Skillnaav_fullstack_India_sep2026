import React, { useState, useRef, useEffect } from "react";
import axiosInstance from "../api/axiosInstance";
import { LiveAvatarSession, SessionEvent } from "@heygen/liveavatar-web-sdk";
import { FaMicrophone, FaPhoneSlash } from "react-icons/fa";
import aiAssistantBg from "../assets/Aiassistant.png";

export default function Chatbot({ onClose }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [debugText, setDebugText] = useState("");
  const [dialogPosition, setDialogPosition] = useState(null);

  const videoRef = useRef(null);
  const dialogRef = useRef(null);
  const sessionRef = useRef(null);
  const recognitionRef = useRef(null);
  const dragRef = useRef(null);
  
  const token = localStorage.getItem("userToken") || "";

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

  // The assistant window can be repositioned by dragging its header.
  useEffect(() => {
    const moveDialog = (event) => {
      if (!dragRef.current || !dialogRef.current) return;

      const { offsetX, offsetY } = dragRef.current;
      const rect = dialogRef.current.getBoundingClientRect();
      const nextX = Math.min(Math.max(12, event.clientX - offsetX), window.innerWidth - rect.width - 12);
      const nextY = Math.min(Math.max(12, event.clientY - offsetY), window.innerHeight - rect.height - 12);
      setDialogPosition({ x: nextX, y: nextY });
    };

    const stopDragging = () => {
      dragRef.current = null;
    };

    window.addEventListener("pointermove", moveDialog);
    window.addEventListener("pointerup", stopDragging);
    return () => {
      window.removeEventListener("pointermove", moveDialog);
      window.removeEventListener("pointerup", stopDragging);
    };
  }, []);

  const startDragging = (event) => {
    if (event.button !== 0 || !dialogRef.current) return;
    const rect = dialogRef.current.getBoundingClientRect();
    dragRef.current = { offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top };
    setDialogPosition({ x: rect.left, y: rect.top });
  };

  const dialogStyle = dialogPosition
    ? { left: dialogPosition.x, top: dialogPosition.y, transform: "none" }
    : { left: "50%", top: "50%", transform: "translate(-50%, -50%)" };

  const AssistantWindow = ({ children }) => (
    <div className="fixed inset-0 z-50 bg-slate-950/70" role="dialog" aria-modal="true" aria-label="AI video assistant">
      <div
        ref={dialogRef}
        style={dialogStyle}
        className="fixed w-[calc(100vw-2rem)] max-w-4xl h-[min(80vh,720px)] overflow-hidden rounded-3xl bg-white shadow-2xl"
      >
        <div
          onPointerDown={startDragging}
          className="absolute top-0 left-0 right-0 z-40 flex h-12 cursor-grab touch-none items-center justify-between bg-slate-950/65 px-5 text-white backdrop-blur-md active:cursor-grabbing"
        >
          <span className="text-sm font-semibold">SkillNaav AI Video Assistant</span>
          <button
            onPointerDown={(event) => event.stopPropagation()}
            onClick={endSession}
            aria-label="Close AI assistant"
            className="rounded-full p-1.5 text-white transition hover:bg-white/20"
          >
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" d="m5 5 10 10M15 5 5 15" /></svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );

  const handleSendToBackend = async (text) => {
    if (!text.trim()) return;
    
    setDebugText("Thinking...");
    try {
      const res = await axiosInstance.post(
        "/api/career-chat",
        { message: text },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const { reply } = res.data;
      
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
    setIsLoading(true);
    setDebugText("Initializing Avatar...");
    try {
      // 1. Fetch token from backend
      const res = await axiosInstance.post(
        "/api/heygen-token",
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const avatarToken = res.data.token;

      // 2. Initialize Avatar Session
      const session = new LiveAvatarSession(avatarToken, {
        voiceChat: false, // We use custom Web Speech API
      });
      sessionRef.current = session;

      session.on(SessionEvent.SESSION_STREAM_READY, () => {
        if (videoRef.current) {
          session.attach(videoRef.current);
        }
      });
      
      session.on(SessionEvent.SESSION_DISCONNECTED, () => {
        endSession();
      });

      // 3. Start Session
      await session.start();

      setIsOpen(true);
      setDebugText("Connected. Click the microphone to speak.");
      
      // Optional: Have avatar greet the user immediately
      session.repeat("Hello! I am your Skill Naav assistant. How can I help you today?");

    } catch (error) {
      console.error("Failed to start avatar session:", error);
      setDebugText("Failed to connect. Please try again.");
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
    setIsOpen(false);
    setIsRecording(false);
    setDebugText("");
    if (onClose) onClose();
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

  if (!isOpen) {
    return (
      <AssistantWindow>
        <div className="relative h-full w-full pt-12 flex items-center justify-center">
          {/* Background mimicking SkillNaav office */}
          <img 
            src={aiAssistantBg} 
            alt="AI Assistant Background"
            className="absolute inset-0 w-full h-full object-cover"
          />
          {/* Optional overlay to make button stand out */}
          <div className="absolute inset-0 bg-black bg-opacity-20"></div>
          
          <button
            onClick={startSession}
            disabled={isLoading}
            className="relative z-10 px-8 py-4 bg-blue-600 text-white font-semibold rounded-full shadow-lg hover:bg-blue-700 transition-transform transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? "Connecting..." : "Start Assistant"}
          </button>
          
        </div>
      </AssistantWindow>
    );
  }

  return (
    <AssistantWindow>
      <div className="relative h-full w-full bg-gray-100 pt-12 flex flex-col">
        
        {/* Video Area */}
        <div className="flex-1 relative bg-gradient-to-br from-blue-50 to-blue-100">
           {/* Fallback background if video is transparent or fails to load */}
           <img 
             src={aiAssistantBg} 
             alt="AI Assistant Background"
             className="absolute inset-0 w-full h-full object-cover pointer-events-none z-0"
           />

           <video
             ref={videoRef}
             autoPlay
             playsInline
             className="absolute inset-0 w-full h-full object-cover z-10"
           >
             <track kind="captions" />
           </video>

           {/* Debug / Status text */}
           <div className="absolute top-4 left-4 bg-black bg-opacity-50 text-white text-xs px-3 py-1 rounded-full z-20">
             {debugText}
           </div>
        </div>

        {/* Control Bar (Bottom overlay) */}
        <div className="absolute bottom-10 left-1/2 transform -translate-x-1/2 flex items-center gap-6 bg-black/40 backdrop-blur-md px-8 py-4 rounded-[40px] border border-white/10 shadow-2xl z-30">
          
          <button
            onClick={toggleRecording}
            className={`w-16 h-16 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 ${
              isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-red-500/80 text-white/80 hover:bg-red-500 hover:text-white'
            }`}
          >
            <FaMicrophone size={26} />
          </button>

          <div className="w-[2px] h-10 bg-white/30 rounded-full mx-1"></div>

          <button
            onClick={endSession}
            className="w-16 h-16 rounded-full flex items-center justify-center shadow-lg bg-red-600 text-white hover:bg-red-700 transition-all duration-300"
          >
            <FaPhoneSlash size={28} />
          </button>
          
        </div>

      </div>
    </AssistantWindow>
  );
}
