import React, { useState, useRef, useEffect, useCallback } from "react";
import ReactDOM from "react-dom";
import axiosInstance from "../api/axiosInstance";
import chatbotIcon from "../assets-webapp/chat-bot.png";
import AvatarCanvas, { AVATAR_STATE } from "./AvatarCanvas";
import {
  AudioSpeechEngine,
  cleanForSpeech,
  splitIntoSpeechChunks,
  pickBestVoice,
} from "../utils/audioSpeechEngine";
import { motion, AnimatePresence } from "framer-motion";
import {
  Maximize2,
  Minimize2,
  X,
  ChevronUp,
  Mic,
  MessageSquare,
  PhoneOff,
  Send,
  Volume2,
  AlertCircle,
} from "lucide-react";

export { cleanForSpeech, splitIntoSpeechChunks, pickBestVoice };

const NEURAL_VOICES = [
  { id: "neural:onyx", serverVoice: "onyx", label: "Studio Male — Onyx (Neural)" },
  { id: "neural:ash", serverVoice: "ash", label: "Studio Male — Ash (Neural)" },
  { id: "neural:echo", serverVoice: "echo", label: "Studio Warm — Echo (Neural)" },
  { id: "neural:alloy", serverVoice: "alloy", label: "Studio Clear — Alloy (Neural)" },
];

export default function Chatbot({ isTextChatOpen = false }) {
  // Widget UI states: 'fab' | 'menu' | 'collapsed' | 'expanded' | 'fullscreen'
  // Start in 'collapsed' compact widescreen homepage preview matching Edutechex floating dock
  const [widgetState, setWidgetState] = useState("collapsed");
  const isMenuFromCollapsedRef = useRef(true);

  // Single conflict-free avatar animation & session state machine
  const [avatarState, setAvatarState] = useState(AVATAR_STATE.IDLE);
  const avatarStateRef = useRef(AVATAR_STATE.IDLE);

  const [isLoading, setIsLoading] = useState(false);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [debugText, setDebugText] = useState("");
  const [liveTranscript, setLiveTranscript] = useState("");
  const [chatHistory, setChatHistory] = useState([]);
  const [isTranscriptOpen, setIsTranscriptOpen] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [micStatus, setMicStatus] = useState("idle"); // 'idle' | 'listening' | 'heard' | 'thinking' | 'speaking' | 'muted' | 'error'

  // Voice Selection State (defaults to Studio Neural Male, falls back transparently to Web Speech)
  const [availableVoices, setAvailableVoices] = useState([]);
  const [selectedVoiceName, setSelectedVoiceName] = useState(() => {
    return localStorage.getItem("assistant_voice_name") || "neural:onyx";
  });

  // Speech Recognition Language Toggle State
  const [speechLang, setSpeechLang] = useState(() => {
    return localStorage.getItem("assistant_speech_lang") || "en-IN";
  });

  // Singleton Audio + Viseme Engine
  const audioEngineRef = useRef(null);
  if (!audioEngineRef.current) {
    audioEngineRef.current = new AudioSpeechEngine();
  }

  const recognitionRef = useRef(null);
  const messagesEndRef = useRef(null);
  const textInputRef = useRef(null);
  const isProcessingRef = useRef(false);
  const isSpeakingRef = useRef(false);
  const isSessionActiveRef = useRef(false);
  const isAutoListeningRef = useRef(true);
  const isRecActiveRef = useRef(false);
  const isStartingRecRef = useRef(false);
  const consecutiveErrorsRef = useRef(0);
  const reconnectTimeoutRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const finalDispatchTimerRef = useRef(null);
  const resumeListenTimerRef = useRef(null);
  const greetTimerRef = useRef(null);
  const latestTranscriptRef = useRef("");
  const dispatchUserQueryRef = useRef(null);
  const selectedVoiceRef = useRef(selectedVoiceName);
  selectedVoiceRef.current = selectedVoiceName;

  const setUnifiedState = useCallback((nextState) => {
    avatarStateRef.current = nextState;
    setAvatarState(nextState);
  }, []);

  const token =
    localStorage.getItem("userToken") ||
    sessionStorage.getItem("userToken") ||
    localStorage.getItem("token") ||
    "";

  // Resolve full backend TTS endpoint URL cleanly with axiosInstance baseURL
  const getTtsUrl = useCallback(() => {
    const base = (axiosInstance?.defaults?.baseURL || "").replace(/\/+$/, "");
    return base ? `${base}/api/tts` : "/api/tts";
  }, []);

  // Load and rank browser Web Speech API fallback voices
  useEffect(() => {
    const updateVoices = () => {
      if ("speechSynthesis" in window) {
        const vList = window.speechSynthesis.getVoices() || [];
        if (vList.length > 0) {
          const enVoices = vList.filter((v) => v.lang?.startsWith("en"));
          setAvailableVoices(enVoices.length > 0 ? enVoices : vList);
        }
      }
    };

    if ("speechSynthesis" in window) {
      updateVoices();
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }

    return () => {
      if ("speechSynthesis" in window) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, []);

  const clearPendingTimers = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (finalDispatchTimerRef.current) {
      clearTimeout(finalDispatchTimerRef.current);
      finalDispatchTimerRef.current = null;
    }
    if (resumeListenTimerRef.current) {
      clearTimeout(resumeListenTimerRef.current);
      resumeListenTimerRef.current = null;
    }
    if (greetTimerRef.current) {
      clearTimeout(greetTimerRef.current);
      greetTimerRef.current = null;
    }
  }, []);

  // Temporary pause (while speaking or waiting on backend) keeping auto-listen intent
  const pauseListening = useCallback(() => {
    isRecActiveRef.current = false;
    isStartingRecRef.current = false;
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (finalDispatchTimerRef.current) {
      clearTimeout(finalDispatchTimerRef.current);
      finalDispatchTimerRef.current = null;
    }
    const rec = recognitionRef.current;
    if (rec) {
      try {
        rec.onstart = null;
        rec.onresult = null;
        rec.onerror = null;
        rec.onend = null;
        rec.abort();
      } catch (_) {}
      recognitionRef.current = null;
    }
    setIsRecording(false);
  }, []);

  // Permanent user mute / end-session stop
  const stopListeningByUser = useCallback(() => {
    isAutoListeningRef.current = false;
    pauseListening();
    setMicStatus("muted");
    setDebugText("Muted. Click mic to speak, or 💬 to type");
    if (!isSpeakingRef.current && !isProcessingRef.current) {
      setUnifiedState(AVATAR_STATE.IDLE);
    }
  }, [pauseListening, setUnifiedState]);

  // Safe SpeechRecognition starter
  const startListening = useCallback(() => {
    if (!isSessionActiveRef.current) return;
    if (isSpeakingRef.current || isProcessingRef.current) return;
    if (!isAutoListeningRef.current) return;
    if (isRecActiveRef.current || isStartingRecRef.current) return;
    if (consecutiveErrorsRef.current >= 3) {
      console.log("[SpeechRec] Auto-restart halted due to 3 consecutive errors");
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setDebugText("Voice isn't available in this browser, please type your question");
      setMicStatus("error");
      setUnifiedState(AVATAR_STATE.ERROR);
      setIsTranscriptOpen(true);
      return;
    }

    isStartingRecRef.current = true;

    if (recognitionRef.current) {
      try {
        recognitionRef.current.onstart = null;
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.abort();
      } catch (_) {}
      recognitionRef.current = null;
    }

    try {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = true;
      rec.maxAlternatives = 1;
      rec.lang = speechLang || "en-IN";

      rec.onstart = () => {
        if (isSpeakingRef.current || isProcessingRef.current || !isSessionActiveRef.current) {
          try {
            rec.abort();
          } catch (_) {}
          return;
        }
        isRecActiveRef.current = true;
        isStartingRecRef.current = false;
        setIsRecording(true);
        setMicStatus("listening");
        setDebugText("Listening to you... Speak your question");
        setUnifiedState(AVATAR_STATE.LISTENING);
      };

      rec.onresult = (event) => {
        consecutiveErrorsRef.current = 0;
        let fullFinal = "";
        let interim = "";
        let hasFinalResult = false;

        for (let i = 0; i < event.results.length; ++i) {
          const item = event.results[i];
          const text = item[0]?.transcript || "";
          if (item.isFinal) {
            fullFinal += text + " ";
            hasFinalResult = true;
          } else {
            interim += text;
          }
        }

        const currentSpeech = (fullFinal + " " + interim).replace(/\s+/g, " ").trim();
        if (currentSpeech) {
          setLiveTranscript(currentSpeech);
          setTextInput(currentSpeech);
          latestTranscriptRef.current = currentSpeech;
          setMicStatus("heard");
          setDebugText(`Heard: "${currentSpeech}"`);

          if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
          if (finalDispatchTimerRef.current) clearTimeout(finalDispatchTimerRef.current);

          if (hasFinalResult && currentSpeech.length >= 2) {
            finalDispatchTimerRef.current = setTimeout(() => {
              const queryToSend = latestTranscriptRef.current;
              if (queryToSend && queryToSend.length >= 2) {
                dispatchUserQueryRef.current?.(queryToSend);
              }
            }, 450);
          } else {
            silenceTimerRef.current = setTimeout(() => {
              const queryToSend = latestTranscriptRef.current;
              if (queryToSend && queryToSend.length >= 2) {
                dispatchUserQueryRef.current?.(queryToSend);
              }
            }, 1150);
          }
        }
      };

      rec.onerror = (event) => {
        const err = event.error;
        if (err === "not-allowed") {
          consecutiveErrorsRef.current = 99;
          isAutoListeningRef.current = false;
          pauseListening();
          setMicStatus("error");
          setUnifiedState(AVATAR_STATE.ERROR);
          setDebugText("Microphone permission blocked. Please allow mic or type your question.");
          setIsTranscriptOpen(true);
        } else if (err === "network" || err === "service-not-allowed") {
          consecutiveErrorsRef.current = 99;
          isAutoListeningRef.current = false;
          pauseListening();
          setMicStatus("error");
          setUnifiedState(AVATAR_STATE.ERROR);
          setDebugText("Voice isn't available in this browser, please type your question");
          setIsTranscriptOpen(true);
        } else if (err === "audio-capture") {
          consecutiveErrorsRef.current = 99;
          isAutoListeningRef.current = false;
          pauseListening();
          setMicStatus("error");
          setUnifiedState(AVATAR_STATE.ERROR);
          setDebugText("No microphone detected. Please check your mic connection or type.");
          setIsTranscriptOpen(true);
        } else if (err === "aborted") {
          isRecActiveRef.current = false;
          isStartingRecRef.current = false;
        } else if (err === "no-speech") {
          // Normal silence; onend will smoothly reconnect if active
        } else {
          consecutiveErrorsRef.current += 1;
          isRecActiveRef.current = false;
          isStartingRecRef.current = false;
          if (consecutiveErrorsRef.current >= 3) {
            isAutoListeningRef.current = false;
            pauseListening();
            setMicStatus("error");
            setUnifiedState(AVATAR_STATE.ERROR);
            setDebugText("Voice error. Please type your question.");
            setIsTranscriptOpen(true);
          }
        }
      };

      rec.onend = () => {
        isRecActiveRef.current = false;
        isStartingRecRef.current = false;
        setIsRecording(false);

        const textToDispatch = (latestTranscriptRef.current || "").trim();
        if (textToDispatch.length >= 2 && !isProcessingRef.current && !isSpeakingRef.current) {
          latestTranscriptRef.current = "";
          setLiveTranscript("");
          dispatchUserQueryRef.current?.(textToDispatch);
          return;
        }

        if (
          isSessionActiveRef.current &&
          isAutoListeningRef.current &&
          !isSpeakingRef.current &&
          !isProcessingRef.current &&
          consecutiveErrorsRef.current < 3
        ) {
          if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = setTimeout(() => {
            if (
              isSessionActiveRef.current &&
              isAutoListeningRef.current &&
              !isSpeakingRef.current &&
              !isProcessingRef.current &&
              consecutiveErrorsRef.current < 3
            ) {
              startListening();
            }
          }, 180);
        } else if (!isSpeakingRef.current && !isProcessingRef.current) {
          setUnifiedState(AVATAR_STATE.IDLE);
        }
      };

      recognitionRef.current = rec;
      rec.start();
    } catch (err) {
      isRecActiveRef.current = false;
      isStartingRecRef.current = false;
      setIsRecording(false);
      if (err.name !== "NotAllowedError") {
        reconnectTimeoutRef.current = setTimeout(() => {
          if (isSessionActiveRef.current && isAutoListeningRef.current && !isSpeakingRef.current) {
            startListening();
          }
        }, 300);
      }
    }
  }, [pauseListening, setUnifiedState, speechLang]);

  const toggleSpeechLang = () => {
    const nextLang = speechLang === "en-IN" ? "en-US" : "en-IN";
    setSpeechLang(nextLang);
    localStorage.setItem("assistant_speech_lang", nextLang);
    if (isRecording) {
      pauseListening();
      reconnectTimeoutRef.current = setTimeout(() => {
        if (isSessionActiveRef.current && isAutoListeningRef.current && !isSpeakingRef.current) {
          startListening();
        }
      }, 200);
    }
  };

  // Immediate interruption & clean stop of speech audio + animation
  const cancelSpeakingAndReset = useCallback(
    (nextState = AVATAR_STATE.IDLE) => {
      if (resumeListenTimerRef.current) {
        clearTimeout(resumeListenTimerRef.current);
        resumeListenTimerRef.current = null;
      }
      if (greetTimerRef.current) {
        clearTimeout(greetTimerRef.current);
        greetTimerRef.current = null;
      }
      audioEngineRef.current?.stop();
      isSpeakingRef.current = false;
      setIsSpeaking(false);
      setUnifiedState(nextState);
    },
    [setUnifiedState]
  );

  // Full resource cleanup on component unmount
  useEffect(() => {
    const engine = audioEngineRef.current;
    return () => {
      isSessionActiveRef.current = false;
      clearPendingTimers();
      pauseListening();
      engine?.dispose();
    };
  }, [clearPendingTimers, pauseListening]);

  // Auto-scroll transcript overlay cleanly
  useEffect(() => {
    if (isTranscriptOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatHistory, isTranscriptOpen, isLoading]);

  // Notify Home/UserMainPage about assistant visibility and layout state
  useEffect(() => {
    const isCollapsedVisible =
      widgetState === "collapsed" || (widgetState === "menu" && isMenuFromCollapsedRef.current);
    const isCardVisible =
      isCollapsedVisible || widgetState === "expanded" || widgetState === "fullscreen";
    window.__edutechexAssistantPreviewVisible = isCardVisible;
    window.dispatchEvent(
      new CustomEvent("edutechex-assistant-preview", {
        detail: {
          visible: isCardVisible,
          collapsed: isCollapsedVisible,
          expanded: widgetState === "expanded",
          fullscreen: widgetState === "fullscreen",
        },
      })
    );
  }, [widgetState]);

  // Pause/resume Web Speech & AudioContext safely across tab switches
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        if ("speechSynthesis" in window && window.speechSynthesis.speaking) {
          window.speechSynthesis.pause();
        }
      } else {
        if ("speechSynthesis" in window && window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }
        if (audioEngineRef.current?.ctx?.state === "suspended" && isSessionActiveRef.current) {
          audioEngineRef.current.ctx.resume().catch(() => {});
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  // Audio-locked synchronized speech runner (server neural TTS -> Web Audio -> fallback)
  const speakText = useCallback(
    (text, onEnd) => {
      if (!text || typeof text !== "string" || !cleanForSpeech(text)) {
        isSpeakingRef.current = false;
        setIsSpeaking(false);
        setUnifiedState(AVATAR_STATE.IDLE);
        onEnd?.();
        return;
      }

      pauseListening();
      if (resumeListenTimerRef.current) {
        clearTimeout(resumeListenTimerRef.current);
        resumeListenTimerRef.current = null;
      }

      isSpeakingRef.current = true;
      setIsSpeaking(true);
      setMicStatus("speaking");
      setDebugText("Speaking...");
      setUnifiedState(AVATAR_STATE.SPEAKING);

      const sel = selectedVoiceRef.current || "";
      const neuralChoice = NEURAL_VOICES.find((nv) => nv.id === sel);
      const serverVoice = neuralChoice ? neuralChoice.serverVoice : "onyx";
      const fallbackVoiceName = neuralChoice ? "" : sel;

      audioEngineRef.current.speak(text, {
        ttsUrl: getTtsUrl(),
        token,
        serverVoice,
        fallbackVoiceName,
        speed: 1.0,
        onStart: () => {
          if (!isSessionActiveRef.current && avatarStateRef.current === AVATAR_STATE.INTERRUPTED) return;
          isSpeakingRef.current = true;
          setIsSpeaking(true);
          setMicStatus("speaking");
          setDebugText("Speaking...");
          setUnifiedState(AVATAR_STATE.SPEAKING);
        },
        onEnd: () => {
          isSpeakingRef.current = false;
          setIsSpeaking(false);
          setUnifiedState(AVATAR_STATE.IDLE);
          setMicStatus(isAutoListeningRef.current ? "listening" : "muted");
          setDebugText(
            isAutoListeningRef.current ? "Listening to you..." : "Muted. Click mic to speak"
          );
          onEnd?.();

          if (isSessionActiveRef.current && isAutoListeningRef.current) {
            resumeListenTimerRef.current = setTimeout(() => {
              if (
                isSessionActiveRef.current &&
                isAutoListeningRef.current &&
                !isSpeakingRef.current &&
                !isProcessingRef.current
              ) {
                startListening();
              }
            }, 350);
          }
        },
        onError: () => {
          isSpeakingRef.current = false;
          setIsSpeaking(false);
          setUnifiedState(AVATAR_STATE.ERROR);
          setMicStatus("error");
          setDebugText("Audio playback unavailable. Text response shown in chat.");
          setIsTranscriptOpen(true);
        },
      });
    },
    [getTtsUrl, pauseListening, setUnifiedState, startListening, token]
  );

  // Send query to /api/career-chat and immediately speak synchronized reply
  const handleSendToBackend = async (text) => {
    const cleanText = (text || "").trim();
    if (!cleanText || isProcessingRef.current) return;

    // Unlock audio context synchronously inside user gesture callstack if invoked from click/Enter
    audioEngineRef.current?.ensureAudioContext();

    isProcessingRef.current = true;
    setIsLoading(true);
    pauseListening();
    setLiveTranscript("");
    latestTranscriptRef.current = "";
    cancelSpeakingAndReset(AVATAR_STATE.THINKING);

    setIsSessionActive(true);
    isSessionActiveRef.current = true;
    setIsRecording(false);

    setChatHistory((prev) => [...prev, { role: "user", text: cleanText }]);
    setMicStatus("thinking");
    setDebugText("Thinking of an answer...");
    setUnifiedState(AVATAR_STATE.THINKING);

    try {
      const res = await axiosInstance.post(
        "/api/career-chat",
        { message: cleanText, voice: true },
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          timeout: 15000,
        }
      );
      const reply =
        res.data?.reply ||
        "I am here to assist you with internships and career opportunities on Edutechex.";

      setChatHistory((prev) => [...prev, { role: "ai", text: reply }]);
      speakText(reply);
    } catch (err) {
      console.error("[Chatbot] Backend chat error:", err);
      const fallbackReply =
        "Edutechex provides career acceleration, verified internships, and domain mentorship. Feel free to ask about available roles!";
      setChatHistory((prev) => [...prev, { role: "ai", text: fallbackReply }]);
      speakText(fallbackReply);
    } finally {
      setIsLoading(false);
      isProcessingRef.current = false;
    }
  };

  const handleTextSubmit = async (e) => {
    if (e) e.preventDefault();
    const query = textInput.trim();
    if (!query || isProcessingRef.current || isLoading) return;
    // Allow interrupting active avatar speech by submitting a new typed question
    if (isSpeakingRef.current) {
      cancelSpeakingAndReset(AVATAR_STATE.INTERRUPTED);
    }
    setTextInput("");
    await handleSendToBackend(query);
  };

  const dispatchUserQuery = async (queryText) => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (finalDispatchTimerRef.current) {
      clearTimeout(finalDispatchTimerRef.current);
      finalDispatchTimerRef.current = null;
    }
    const cleanText = (queryText || "").trim();
    if (!cleanText || cleanText.length < 2) return;
    if (/^(uh|um|ah|mm|eh|er)$/i.test(cleanText)) return;

    pauseListening();
    setLiveTranscript("");
    setTextInput("");
    latestTranscriptRef.current = "";
    await handleSendToBackend(cleanText);
  };
  dispatchUserQueryRef.current = dispatchUserQuery;

  const startSession = () => {
    audioEngineRef.current?.ensureAudioContext();
    cancelSpeakingAndReset(AVATAR_STATE.IDLE);
    isSessionActiveRef.current = true;
    isAutoListeningRef.current = true;
    consecutiveErrorsRef.current = 0;
    setIsSessionActive(true);
    setIsRecording(false);
    setLiveTranscript("");
    setTextInput("");
    setMicStatus("idle");

    const greeting = "Welcome to Edutechex! How can I help you today?";
    setChatHistory([{ role: "ai", text: greeting }]);
    setIsLoading(false);

    greetTimerRef.current = setTimeout(() => {
      if (isSessionActiveRef.current) {
        speakText(greeting);
      }
    }, 150);
  };

  const endSession = () => {
    isSessionActiveRef.current = false;
    clearPendingTimers();
    cancelSpeakingAndReset(AVATAR_STATE.IDLE);
    stopListeningByUser();
    setLiveTranscript("");
    setTextInput("");
    setIsSessionActive(false);
    setIsRecording(false);
    setIsSpeaking(false);
    setDebugText("");
    setMicStatus("idle");
    setWidgetState("fab");
  };

  // Supports clean mid-speech user interruption via microphone button!
  const toggleRecording = () => {
    audioEngineRef.current?.ensureAudioContext();

    if (isSpeakingRef.current) {
      // Explicit user interruption while avatar is speaking
      cancelSpeakingAndReset(AVATAR_STATE.INTERRUPTED);
      consecutiveErrorsRef.current = 0;
      isAutoListeningRef.current = true;
      setMicStatus("listening");
      setDebugText("Listening to you...");
      reconnectTimeoutRef.current = setTimeout(() => {
        if (isSessionActiveRef.current && !isSpeakingRef.current) {
          startListening();
        }
      }, 60);
      return;
    }

    if (isRecording) {
      if (latestTranscriptRef.current && latestTranscriptRef.current.trim().length >= 2) {
        const text = latestTranscriptRef.current.trim();
        latestTranscriptRef.current = "";
        setLiveTranscript("");
        setTextInput("");
        handleSendToBackend(text);
      } else {
        stopListeningByUser();
      }
    } else {
      consecutiveErrorsRef.current = 0;
      isAutoListeningRef.current = true;
      startListening();
    }
  };

  const handlePreviewClick = () => {
    setWidgetState("expanded");
    if (!isSessionActive) {
      startSession();
    }
  };

  const handleFabClick = () => {
    if (widgetState === "menu") {
      setWidgetState(isMenuFromCollapsedRef.current ? "collapsed" : "fab");
    } else {
      isMenuFromCollapsedRef.current = widgetState === "collapsed";
      setWidgetState("menu");
    }
  };

  const isFullscreen = widgetState === "fullscreen";
  const isExpanded = widgetState === "expanded";
  const isCollapsed = widgetState === "collapsed";
  const isMenu = widgetState === "menu";
  const showCardWhileMenu = isMenu && isMenuFromCollapsedRef.current;
  const isVideoOpen = isExpanded || isFullscreen || isCollapsed || showCardWhileMenu;

  let dialogStyle = {};
  if (isTextChatOpen || !isVideoOpen) {
    dialogStyle = {
      right: 24,
      bottom: 24,
      width: 0,
      height: 0,
      opacity: 0,
      borderRadius: "20px",
      overflow: "hidden",
      pointerEvents: "none",
      boxSizing: "border-box",
    };
  } else if (isFullscreen) {
    dialogStyle = {
      left: 0,
      top: 0,
      right: 0,
      bottom: 0,
      width: "100vw",
      height: "100vh",
      opacity: 1,
      borderRadius: 0,
      maxWidth: "100vw",
      maxHeight: "100vh",
      pointerEvents: "auto",
      boxSizing: "border-box",
    };
  } else if (isExpanded) {
    dialogStyle = {
      right: 24,
      bottom: 24,
      width: 650,
      height: 350,
      opacity: 1,
      borderRadius: "20px",
      maxWidth: "calc(100vw - 48px)",
      maxHeight: "calc(100vh - 48px)",
      pointerEvents: "auto",
      boxSizing: "border-box",
    };
  } else if (isCollapsed || showCardWhileMenu) {
    dialogStyle = {
      right: 24,
      bottom: 20,
      width: 320,
      height: 180,
      opacity: 1,
      borderRadius: "16px",
      maxWidth: "calc(100vw - 48px)",
      maxHeight: "calc(100vh - 48px)",
      pointerEvents: "auto",
      boxSizing: "border-box",
    };
  }

  return (
    <>
      <div
        style={dialogStyle}
        className={`fixed z-50 overflow-hidden bg-slate-900 shadow-[0_14px_38px_rgba(15,23,42,0.28)] transition-all duration-300 border border-white/25 ${
          !isVideoOpen ? "pointer-events-none" : ""
        }`}
      >
        {/* 60fps Audio-Synchronized Viseme & Expression Canvas Rig */}
        <div className="relative w-full h-full overflow-hidden bg-slate-900 pointer-events-none box-border">
          <AvatarCanvas
            avatarState={avatarState}
            audioEngineRef={audioEngineRef}
            isVisible={isVideoOpen && !isTextChatOpen}
          />
          <div
            className={`absolute inset-0 pointer-events-none box-border ${
              isCollapsed || showCardWhileMenu
                ? "bg-gradient-to-t from-black/10 via-transparent to-transparent"
                : "bg-gradient-to-t from-black/55 via-transparent to-black/20"
            }`}
          />
        </div>

        {/* COLLAPSED STATE OVERLAYS */}
        <AnimatePresence>
          {(isCollapsed || showCardWhileMenu) && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-20 cursor-pointer box-border group"
              title="Click to interact with Edutechex AI Video Assistant"
              onClick={handlePreviewClick}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  endSession();
                  setWidgetState("fab");
                }}
                className="absolute top-2.5 right-2.5 flex h-7 w-7 items-center justify-center rounded-full bg-slate-900/55 text-white/95 backdrop-blur-md hover:bg-slate-900/80 transition-colors box-border shadow-sm"
                title="Close"
              >
                <X size={14} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* EXPANDED / FULLSCREEN CONTROLS */}
        <AnimatePresence>
          {(isExpanded || isFullscreen) && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-20 pointer-events-none box-border group"
            >
              {/* Top Controls Area */}
              <div className="absolute top-0 left-0 right-0 p-3 flex items-center justify-between pointer-events-none box-border z-30">
                <div className="flex gap-2 pointer-events-auto items-center">
                  <button
                    onClick={() => setWidgetState(isFullscreen ? "expanded" : "fullscreen")}
                    title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-md hover:bg-black/70 transition-colors box-border"
                  >
                    {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                  </button>
                  <button
                    onClick={() => setWidgetState("collapsed")}
                    title="Minimize"
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-md hover:bg-black/70 transition-colors box-border"
                  >
                    <ChevronUp size={16} className="rotate-180" />
                  </button>

                  {/* Active Phase Status Pill */}
                  {micStatus === "speaking" || isSpeaking ? (
                    <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full border border-rose-500/30 shadow-lg">
                      <span className="w-1.5 h-3 bg-rose-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                      <span className="w-1.5 h-4 bg-orange-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                      <span className="w-1.5 h-3 bg-pink-400 rounded-full animate-bounce"></span>
                      <span className="text-[11px] font-semibold text-rose-200 ml-1">Speaking...</span>
                    </div>
                  ) : micStatus === "thinking" || isLoading ? (
                    <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full border border-blue-500/30 shadow-lg">
                      <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></span>
                      <span className="text-[11px] font-semibold text-blue-200">Thinking...</span>
                    </div>
                  ) : micStatus === "heard" && liveTranscript ? (
                    <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full border border-emerald-500/40 shadow-lg max-w-[220px] truncate">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping shrink-0"></span>
                      <span className="text-[11px] font-semibold text-emerald-200 truncate">
                        Heard: "{liveTranscript}"
                      </span>
                    </div>
                  ) : micStatus === "listening" || isRecording ? (
                    <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full border border-emerald-500/30 shadow-lg">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                      <span className="text-[11px] font-semibold text-emerald-200">Listening to you...</span>
                    </div>
                  ) : micStatus === "error" ? (
                    <div className="flex items-center gap-1.5 bg-rose-950/80 backdrop-blur-md px-3 py-1 rounded-full border border-rose-500/40 shadow-lg max-w-[240px] truncate">
                      <AlertCircle size={13} className="text-rose-400 shrink-0" />
                      <span className="text-[11px] font-medium text-rose-200 truncate">
                        {debugText || "Voice error"}
                      </span>
                    </div>
                  ) : null}
                </div>

                {/* Right Controls */}
                <div className="flex gap-2 items-center pointer-events-auto">
                  <button
                    onClick={toggleSpeechLang}
                    title={`Speech recognition language: ${
                      speechLang === "en-IN" ? "English (India)" : "English (US)"
                    }. Click to switch.`}
                    className="flex items-center gap-1 rounded-full bg-black/40 hover:bg-black/60 h-8 px-2.5 backdrop-blur-md border border-white/10 text-white text-[11px] font-semibold transition-colors cursor-pointer"
                  >
                    <span>{speechLang === "en-IN" ? "EN (IN)" : "EN (US)"}</span>
                  </button>

                  <div className="pointer-events-none box-border flex items-center justify-center rounded-full bg-black/40 h-8 px-3 backdrop-blur-md border border-white/10 hidden sm:flex">
                    <span className="text-[10px] font-bold text-white tracking-widest uppercase leading-none">
                      Edutechex
                    </span>
                  </div>

                  <button
                    onClick={() => {
                      endSession();
                      setWidgetState("fab");
                    }}
                    title="Close Video Assistant"
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-md hover:bg-rose-500/90 transition-colors box-border"
                  >
                    <X size={15} />
                  </button>
                </div>
              </div>

              {/* Bottom Left Badge */}
              <div className="absolute bottom-12 left-2 flex items-center justify-center rounded-full bg-black/40 px-2 py-1 backdrop-blur-md border border-white/10 pointer-events-none box-border max-w-full">
                <span className="text-[9px] font-semibold tracking-wider text-white truncate box-border">
                  AI ASSISTANT
                </span>
              </div>

              {/* Start Session Button Overlay */}
              {!isSessionActive && (
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none box-border p-4">
                  <button
                    onClick={startSession}
                    disabled={isLoading}
                    className="pointer-events-auto px-6 py-2.5 bg-gradient-to-r from-orange-500 via-rose-500 to-pink-500 text-white text-sm font-bold rounded-full shadow-xl hover:shadow-orange-500/50 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed max-w-full truncate box-border mt-4 cursor-pointer"
                  >
                    Start Video
                  </button>
                  <p className="text-white/80 text-xs mt-2 font-medium drop-shadow pointer-events-none">
                    100% Free AI Career Assistant
                  </p>
                </div>
              )}

              {/* Floating Interaction Guide Pill */}
              <div className="absolute bottom-16 left-1/2 -translate-x-1/2 pointer-events-auto z-30 transition-all duration-200">
                {liveTranscript ? (
                  <button
                    onClick={() => {
                      if (latestTranscriptRef.current) {
                        dispatchUserQueryRef.current?.(latestTranscriptRef.current);
                      }
                    }}
                    className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-1.5 rounded-full text-xs font-semibold shadow-xl border border-emerald-400/40 backdrop-blur-md animate-pulse max-w-[340px] truncate cursor-pointer transition-all hover:scale-105 active:scale-95"
                    title="Click to send immediately"
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping shrink-0"></span>
                    <span className="truncate font-medium">"{liveTranscript}"</span>
                    <Send size={12} className="shrink-0 ml-1 opacity-80" />
                  </button>
                ) : isRecording ? (
                  <button
                    onClick={toggleRecording}
                    className="flex items-center gap-2 bg-emerald-600/95 hover:bg-emerald-600 text-white px-4 py-1.5 rounded-full text-xs font-semibold shadow-xl border border-emerald-400/40 cursor-pointer backdrop-blur-md transition-all hover:scale-102"
                    title="Microphone active. Click to mute."
                  >
                    <div className="flex items-center gap-1 h-3.5">
                      <span className="w-1 bg-white rounded-full animate-bounce [animation-delay:-0.3s] h-3"></span>
                      <span className="w-1 bg-white rounded-full animate-bounce [animation-delay:-0.15s] h-3.5"></span>
                      <span className="w-1 bg-white rounded-full animate-bounce h-3"></span>
                    </div>
                    <span>Listening... Speak your question</span>
                  </button>
                ) : isSpeaking ? (
                  <button
                    onClick={toggleRecording}
                    className="flex items-center gap-2 bg-rose-600/90 hover:bg-rose-500 text-white px-4 py-1.5 rounded-full text-xs font-semibold shadow-xl border border-rose-400/40 backdrop-blur-md cursor-pointer transition-all"
                    title="Click to interrupt and speak"
                  >
                    <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>
                    <span>Assistant is speaking... (Tap to interrupt)</span>
                  </button>
                ) : debugText === "Thinking of an answer..." || isLoading ? (
                  <div className="flex items-center gap-2 bg-blue-600/90 text-white px-4 py-1.5 rounded-full text-xs font-semibold shadow-xl border border-blue-400/40 backdrop-blur-md">
                    <span className="w-2.5 h-2.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    <span>Thinking of an answer...</span>
                  </div>
                ) : micStatus === "error" ? (
                  <button
                    onClick={() => {
                      setIsTranscriptOpen(true);
                      setTimeout(() => textInputRef.current?.focus(), 150);
                    }}
                    className="flex items-center gap-2 bg-rose-900/90 hover:bg-rose-800 text-white px-4 py-1.5 rounded-full text-xs font-medium shadow-xl border border-rose-400/30 cursor-pointer backdrop-blur-md transition-all"
                    title="Click to type your question"
                  >
                    <AlertCircle size={13} className="text-rose-300" />
                    <span>Voice unavailable. Click here to type</span>
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setIsTranscriptOpen(true);
                      setTimeout(() => textInputRef.current?.focus(), 150);
                    }}
                    className="flex items-center gap-2 bg-black/70 hover:bg-black/90 text-white px-4 py-1.5 rounded-full text-xs font-medium shadow-xl border border-white/20 cursor-pointer backdrop-blur-md hover:scale-105 active:scale-95 transition-all"
                    title="Click to type a question or click mic to speak"
                  >
                    <Mic size={14} className="text-emerald-400" />
                    <span>Click to type, or click mic to speak</span>
                  </button>
                )}
              </div>

              {/* Bottom Center Controls */}
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-full bg-black/50 p-1.5 backdrop-blur-lg border border-white/10 shadow-lg pointer-events-auto box-border max-w-[calc(100%-16px)] overflow-x-auto [&::-webkit-scrollbar]:hidden transition-opacity duration-300">
                <button
                  onClick={() => {
                    setIsTranscriptOpen((prev) => !prev);
                    if (!isTranscriptOpen) {
                      setTimeout(() => textInputRef.current?.focus(), 150);
                    }
                  }}
                  className="flex shrink-0 h-10 w-10 items-center justify-center rounded-full text-white hover:bg-white/10 transition-colors box-border"
                  title="Open Chat & Transcript"
                >
                  <ChevronUp
                    size={20}
                    className={
                      isTranscriptOpen ? "rotate-180 transition-transform" : "transition-transform"
                    }
                  />
                </button>

                <button
                  onClick={isSessionActive ? toggleRecording : undefined}
                  disabled={!isSessionActive}
                  className={`flex shrink-0 h-10 w-10 items-center justify-center rounded-full transition-all box-border ${
                    !isSessionActive
                      ? "opacity-50 cursor-not-allowed text-white"
                      : isRecording
                      ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/50 scale-110 animate-pulse"
                      : isSpeaking
                      ? "bg-rose-500/80 text-white hover:bg-rose-500 hover:scale-105 active:scale-95"
                      : "bg-white/10 text-white hover:bg-white/20 hover:scale-105 active:scale-95"
                  }`}
                  title={
                    isSpeaking
                      ? "Interrupt avatar and speak"
                      : isRecording
                      ? "Listening... Click to mute"
                      : "Click microphone to speak"
                  }
                >
                  <Mic size={20} className="text-white" />
                </button>

                <button
                  onClick={() => {
                    const nextState = !isTranscriptOpen;
                    setIsTranscriptOpen(nextState);
                    if (nextState) {
                      setTimeout(() => textInputRef.current?.focus(), 150);
                    }
                  }}
                  className={`flex shrink-0 h-10 w-10 items-center justify-center rounded-full transition-colors box-border ${
                    isTranscriptOpen ? "bg-white/20 text-white" : "text-white hover:bg-white/10"
                  }`}
                  title="Live Transcript & Chat"
                >
                  <MessageSquare size={20} />
                </button>

                <button
                  onClick={endSession}
                  className="flex shrink-0 h-10 w-16 items-center justify-center rounded-full bg-rose-600 text-white hover:bg-rose-700 transition-colors shadow-md ml-1 box-border"
                  title="End Session"
                >
                  <PhoneOff size={20} />
                </button>
              </div>

              {/* Transcript & Chat Overlay */}
              <AnimatePresence>
                {isTranscriptOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute bottom-16 right-2 w-80 max-w-[calc(100%-16px)] max-h-64 bg-black/85 backdrop-blur-md rounded-2xl border border-white/10 flex flex-col pointer-events-auto overflow-hidden box-border z-30 shadow-2xl"
                  >
                    <div className="p-2 border-b border-white/10 bg-white/5 flex justify-between items-center box-border gap-2">
                      <span className="text-white text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 shrink-0">
                        <MessageSquare size={13} className="text-blue-400" />
                        <span>Chat</span>
                      </span>

                      <div className="flex items-center gap-1 flex-1 justify-end max-w-[190px]">
                        <span className="text-[10px] text-gray-400 shrink-0">Voice:</span>
                        <select
                          value={selectedVoiceName}
                          onChange={(e) => {
                            const val = e.target.value;
                            setSelectedVoiceName(val);
                            localStorage.setItem("assistant_voice_name", val);
                          }}
                          className="bg-black/60 text-white text-[10px] rounded px-1.5 py-0.5 border border-white/20 focus:outline-none focus:ring-1 focus:ring-blue-400 w-full truncate cursor-pointer"
                          title="Select avatar speaking voice"
                        >
                          <optgroup label="Neural Studio Voices" className="bg-gray-900 text-white">
                            {NEURAL_VOICES.map((nv) => (
                              <option key={nv.id} value={nv.id} className="bg-gray-900 text-white">
                                {nv.label}
                              </option>
                            ))}
                          </optgroup>
                          {availableVoices.length > 0 && (
                            <optgroup label="Browser Voices (Fallback)" className="bg-gray-900 text-white">
                              {availableVoices.map((v) => (
                                <option key={v.name} value={v.name} className="bg-gray-900 text-white">
                                  {v.name} ({v.lang})
                                </option>
                              ))}
                            </optgroup>
                          )}
                        </select>
                      </div>

                      <button
                        onClick={() => setIsTranscriptOpen(false)}
                        className="text-gray-400 hover:text-white transition-colors shrink-0"
                      >
                        <X size={14} />
                      </button>
                    </div>

                    <div
                      className="flex-1 overflow-y-auto p-2.5 space-y-2.5 [&::-webkit-scrollbar]:hidden box-border"
                      style={{ scrollBehavior: "smooth" }}
                    >
                      {chatHistory.length === 0 ? (
                        <p className="text-gray-400 text-xs text-center italic my-3">
                          No messages yet. Speak or type below.
                        </p>
                      ) : (
                        chatHistory.map((msg, i) => (
                          <div
                            key={i}
                            className={`flex flex-col ${
                              msg.role === "user" ? "items-end" : "items-start"
                            } box-border`}
                          >
                            <div
                              className={`px-3 py-1.5 rounded-xl max-w-[88%] text-xs leading-relaxed box-border flex items-start gap-1.5 ${
                                msg.role === "user"
                                  ? "bg-blue-600 text-white rounded-br-none shadow-sm"
                                  : "bg-gray-800 text-white rounded-bl-none border border-white/10 shadow-sm"
                              }`}
                            >
                              <span className="flex-1 whitespace-pre-wrap">{msg.text}</span>
                              {msg.role === "ai" && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    audioEngineRef.current?.ensureAudioContext();
                                    speakText(msg.text);
                                  }}
                                  className="text-gray-400 hover:text-blue-300 transition-colors p-0.5 shrink-0 mt-0.5"
                                  title="Play answer voice again"
                                >
                                  <Volume2 size={12} />
                                </button>
                              )}
                            </div>
                          </div>
                        ))
                      )}

                      {isLoading && (
                        <div className="flex flex-col items-start box-border">
                          <div className="px-3 py-2 rounded-xl bg-gray-800 text-white rounded-bl-none border border-white/10 flex items-center gap-1.5 text-xs shadow-sm">
                            <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce"></span>
                            <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:0.15s]"></span>
                            <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:0.3s]"></span>
                            <span className="text-gray-400 text-[11px] ml-1">Thinking...</span>
                          </div>
                        </div>
                      )}
                      <div ref={messagesEndRef} />
                    </div>

                    <form
                      onSubmit={handleTextSubmit}
                      className="p-2 border-t border-white/10 flex gap-1.5 bg-black/50"
                    >
                      <input
                        ref={textInputRef}
                        type="text"
                        value={textInput}
                        onChange={(e) => setTextInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleTextSubmit(e);
                          }
                        }}
                        disabled={isLoading}
                        placeholder={isLoading ? "Thinking of an answer..." : "Type question & press Enter..."}
                        className="bg-white/10 text-white text-xs px-3 py-1.5 rounded-full flex-1 focus:outline-none focus:ring-1 focus:ring-blue-400 placeholder-gray-400 disabled:opacity-50"
                      />
                      <button
                        type="submit"
                        disabled={isLoading || !textInput.trim()}
                        className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:hover:bg-blue-600 text-white p-1.5 rounded-full transition-colors shrink-0 cursor-pointer"
                        title="Send question (Enter)"
                      >
                        <Send size={14} />
                      </button>
                    </form>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* FLOATING ACTION MENU - Clean Light Card Style */}
      {ReactDOM.createPortal(
        <AnimatePresence>
          {isMenu && !isTextChatOpen && (
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.96 }}
              transition={{ duration: 0.2 }}
              className={`fixed right-6 z-[9999] w-64 ${
                showCardWhileMenu ? "bottom-[282px]" : "bottom-24"
              }`}
            >
              <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden">
                <div className="px-4 pt-3.5 pb-2 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
                  CHOOSE ASSISTANT
                </div>

                <button
                  onClick={() => {
                    setWidgetState("fab");
                    window.dispatchEvent(new CustomEvent("open-text-chat"));
                  }}
                  className="w-full flex items-center gap-3.5 px-4 py-3 hover:bg-slate-50 transition-colors text-left group cursor-pointer"
                >
                  <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <span className="text-lg">💬</span>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-900 leading-tight">Text Chat</div>
                    <div className="text-xs text-slate-500 mt-0.5">Quick answers &amp; help</div>
                  </div>
                </button>

                <div className="mx-4 border-t border-slate-100" />

                <button
                  onClick={() => {
                    setWidgetState("expanded");
                    startSession();
                  }}
                  className="w-full flex items-center gap-3.5 px-4 py-3 pb-3.5 hover:bg-slate-50 transition-colors text-left group cursor-pointer"
                >
                  <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <span className="text-lg">📹</span>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-900 leading-tight">Video Assistant</div>
                    <div className="text-xs text-slate-500 mt-0.5">Interactive AI avatar</div>
                  </div>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* FLOATING ACTION BUTTON */}
      {ReactDOM.createPortal(
        !(isExpanded || isFullscreen) && !isTextChatOpen && (
          <div
            className={`fixed right-6 z-[9999] transition-all duration-300 ${
              isCollapsed || showCardWhileMenu ? "bottom-[214px]" : "bottom-6"
            }`}
          >
            <button
              onClick={handleFabClick}
              className="relative flex items-center justify-center w-14 h-14 rounded-full bg-transparent transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer"
              title={isMenu ? "Close menu" : "Open Edutechex Assistant"}
            >
              <img
                src={chatbotIcon}
                alt="Assistant"
                className="w-14 h-14 object-contain drop-shadow-[0_6px_16px_rgba(37,99,235,0.32)] transition-transform duration-300"
              />
            </button>
          </div>
        ),
        document.body
      )}
    </>
  );
}
