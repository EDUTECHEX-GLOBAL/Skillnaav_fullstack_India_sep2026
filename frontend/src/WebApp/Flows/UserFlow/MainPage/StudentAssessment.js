import React, { useCallback, useEffect, useRef, useState } from "react";
import axios from "../../../../api/axiosInstance";
import { useProctoring } from "./useProctoring";
import { loadFaceApi } from "../../../../utils/faceApiLoader";

// ── Camera Preview Component ──────────────────────────────────────────────────
const CameraPreview = ({ stream, setStudentPhoto, faceApi, addViolation }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null); // ✨ NEW: for face tracking overlay
  const noFaceFramesRef = useRef(0);
  const multipleFacesFramesRef = useRef(0);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  // ✨ NEW: Snapshot logic
  useEffect(() => {
    if (stream && setStudentPhoto) {
      let captured = false;
      let timeoutId;
      const attempt = () => {
        if (captured) return;
        if (
          videoRef.current &&
          videoRef.current.readyState >= 2 &&
          videoRef.current.videoWidth > 0
        ) {
          timeoutId = setTimeout(() => {
            if (!videoRef.current) return;
            try {
              const canvas = document.createElement("canvas");
              canvas.width = videoRef.current.videoWidth;
              canvas.height = videoRef.current.videoHeight;
              canvas
                .getContext("2d")
                .drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
              setStudentPhoto(canvas.toDataURL("image/jpeg"));
            } catch (e) {
              console.error("Failed to capture snapshot:", e);
            }
          }, 2000); // 2 second delay for exposure
          captured = true;
        } else {
          timeoutId = setTimeout(attempt, 500);
        }
      };
      attempt();
      return () => clearTimeout(timeoutId);
    }
  }, [stream, setStudentPhoto]);

  // ✨ NEW: Face tracking loop
  useEffect(() => {
    let intervalId;
    if (stream && faceApi) {
      intervalId = setInterval(async () => {
        if (!videoRef.current || !canvasRef.current) return;
        if (
          videoRef.current.readyState === 4 &&
          faceApi.nets.tinyFaceDetector.isLoaded
        ) {
          try {
            const detections = await faceApi.detectAllFaces(
              videoRef.current,
              new faceApi.TinyFaceDetectorOptions(),
            );
            const displaySize = {
              width: videoRef.current.clientWidth,
              height: videoRef.current.clientHeight,
            };
            faceApi.matchDimensions(canvasRef.current, displaySize);
            const resizedDetections = faceApi.resizeResults(
              detections,
              displaySize,
            );

            const ctx = canvasRef.current.getContext("2d");
            ctx.clearRect(
              0,
              0,
              canvasRef.current.width,
              canvasRef.current.height,
            );

            resizedDetections.forEach((detection) => {
              const box = detection.box;
              ctx.strokeStyle = "#00FF00";
              ctx.lineWidth = 3;
              ctx.strokeRect(box.x, box.y, box.width, box.height);
            });

            if (detections.length === 0) {
              noFaceFramesRef.current += 1;
              multipleFacesFramesRef.current = 0;
              if (noFaceFramesRef.current > 15) {
                // 3 seconds at 200ms
                if (addViolation)
                  addViolation(
                    "FACE_NOT_DETECTED",
                    "Face not detected in camera",
                  );
                noFaceFramesRef.current = 0;
              }
            } else if (detections.length > 1) {
              multipleFacesFramesRef.current += 1;
              noFaceFramesRef.current = 0;
              if (multipleFacesFramesRef.current > 15) {
                // 3 seconds
                if (addViolation)
                  addViolation(
                    "MULTIPLE_FACES",
                    "Multiple faces detected in camera",
                  );
                multipleFacesFramesRef.current = 0;
              }
            } else {
              noFaceFramesRef.current = 0;
              multipleFacesFramesRef.current = 0;
            }
          } catch (err) {}
        }
      }, 200);
    }
    return () => clearInterval(intervalId);
  }, [stream, faceApi, addViolation]);

  if (!stream) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: "112px",
        right: "28px",
        zIndex: 40,
        width: "220px",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
      }}
    >
      <div
        style={{
          position: "relative",
          height: "150px",
          borderRadius: "12px",
          overflow: "hidden",
          boxShadow: "0 18px 40px rgba(15,23,42,0.16)",
          border: "1px solid #dbeafe",
          background: "#000",
        }}
      >
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            transform: "scaleX(-1)",
          }}
        />
        {/* ✨ NEW: Overlay canvas for face tracking */}
        <canvas
          ref={canvasRef}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
            transform: "scaleX(-1)",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: "auto 0 0 0",
            padding: "8px 10px",
            background:
              "linear-gradient(180deg, rgba(0,0,0,0), rgba(0,0,0,0.72))",
            color: "#fff",
            fontSize: "12px",
            fontWeight: 700,
          }}
        >
          Student Camera
        </div>
        {/* Recording indicator */}
        <div
          style={{
            position: "absolute",
            top: "8px",
            left: "8px",
            display: "flex",
            alignItems: "center",
            gap: "5px",
            background: "rgba(0,0,0,0.58)",
            borderRadius: "999px",
            padding: "3px 8px",
          }}
        >
          <span
            style={{
              width: "7px",
              height: "7px",
              borderRadius: "50%",
              background: "#ef4444",
              display: "inline-block",
              animation: "pulse 1.2s infinite",
            }}
          />
          <span style={{ color: "#fff", fontSize: "9px", fontWeight: 700 }}>
            LIVE
          </span>
        </div>
      </div>

      <div
        style={{
          height: "132px",
          borderRadius: "9px",
          overflow: "hidden",
          boxShadow: "0 12px 28px rgba(15,23,42,0.16)",
          border: "1px solid rgba(255,255,255,0.65)",
          background: "#565656",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          flexDirection: "column",
          gap: "8px",
        }}
      >
        <div
          style={{
            width: "46px",
            height: "46px",
            borderRadius: "50%",
            background: "#c8cee5",
            border: "1px solid rgba(255,255,255,0.45)",
            position: "relative",
            boxShadow: "inset 0 1px 1px rgba(255,255,255,0.45)",
          }}
        >
          <span
            style={{
              position: "absolute",
              top: "10px",
              left: "50%",
              transform: "translateX(-50%)",
              width: "14px",
              height: "14px",
              borderRadius: "50%",
              background: "#ffffff",
            }}
          />
          <span
            style={{
              position: "absolute",
              left: "50%",
              bottom: "7px",
              transform: "translateX(-50%)",
              width: "28px",
              height: "17px",
              borderRadius: "14px 14px 8px 8px",
              background: "#ffffff",
            }}
          />
        </div>
        <div style={{ color: "#f8fafc", fontSize: "12px", fontWeight: 700 }}>
          Partner
        </div>
      </div>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.3} }`}</style>
    </div>
  );
};

const StudentAssessment = () => {
  const assessmentId = localStorage.getItem("activeAssessmentId");

  const [mode, setMode] = useState("loading"); // loading | instructions | exam | result
  const [assessment, setAssessment] = useState(null);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState({});
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [evaluation, setEvaluation] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // ✨ NEW: AI Voice Assessment State
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [hasGreeted, setHasGreeted] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const recognitionRef = useRef(null);

  const timerRef = useRef(null);
  const hasSubmittedRef = useRef(false);
  const handleSubmitRef = useRef(null);

  const handleViolationRef = useRef(null);

  const cameraStreamRef = useRef(null);
  const [cameraStream, setCameraStream] = useState(null);
  const [studentPhoto, setStudentPhoto] = useState(null); // ✨ NEW: snapshot photo
  const [faceApi, setFaceApi] = useState(null);

  // ✨ NEW: Load face-api models
  useEffect(() => {
    const loadModels = async () => {
      try {
        const loadedFaceApi = await loadFaceApi();
        await loadedFaceApi.nets.tinyFaceDetector.loadFromUri(
          "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/",
        );
        setFaceApi(loadedFaceApi);
      } catch (err) {
        console.error("Failed to load face-api models:", err);
      }
    };
    loadModels();
  }, []);

  const {
    startProctoring,
    stopProctoring,
    enterFullscreen,
    exitFullscreen,
    violationCount,
    warningMessage,
    showWarning,
    addViolation,
  } = useProctoring((violation, count) =>
    handleViolationRef.current?.(violation, count),
  );

  const handleViolation = useCallback(
    async (violation, count) => {
      if (count >= 3 && !hasSubmittedRef.current) {
        showWarning(
          "3 warnings reached. The exam will be submitted automatically.",
          10000,
        );
        await handleSubmitRef.current?.(true);
        return;
      }

      if (count > 0) {
        showWarning(
          `${violation.message}. Warning ${count}/3. Auto-submit after 3 warnings.`,
          6000,
        );
      }
    },
    [showWarning],
  );

  useEffect(() => {
    handleViolationRef.current = handleViolation;
  }, [handleViolation]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null; // Prevent loops
        recognitionRef.current.onresult = null;
        recognitionRef.current.stop();
      } catch (e) {}
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  const currentQRef = useRef(currentQ);
  useEffect(() => {
    currentQRef.current = currentQ;
  }, [currentQ]);

  const startListening = useCallback(() => {
    try {
      const qId = assessment?.questions?.[currentQRef.current]?.questionId;
      const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) return;

      // Ensure old instance is stopped before creating a new one
      stopListening();

      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onresult = (event) => {
        let finalStr = "";
        let interimStr = "";

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalStr += event.results[i][0].transcript;
          } else {
            interimStr += event.results[i][0].transcript;
          }
        }

        setInterimTranscript(interimStr);

        if (finalStr && qId) {
          setAnswers((prev) => {
            const currentAnswer =
              prev[qId] && typeof prev[qId] === "string" ? prev[qId] : "";
            return {
              ...prev,
              [qId]: (currentAnswer + " " + finalStr).trim(),
            };
          });
        }
      };

      recognition.onend = () => {
        // If it ended naturally (we didn't manually stop it), restart it!
        if (recognitionRef.current === recognition) {
          try {
            recognition.start();
          } catch (e) {
            setIsListening(false);
          }
        } else {
          setIsListening(false);
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
      setIsListening(true);
    } catch (e) {
      setIsListening(false);
    }
  }, [assessment, stopListening]);

  const speakQuestion = useCallback(() => {
    if (
      mode === "exam" &&
      assessment?.configSnapshot?.assessmentType === "ai_voice_assessment"
    ) {
      const question = assessment.questions[currentQRef.current];
      if (question) {
        window.speechSynthesis.cancel();
        stopListening();
        setIsSpeaking(true);
        setInterimTranscript(""); // clear interim

        const utterance = new SpeechSynthesisUtterance(question.question);
        utterance.rate = 0.85; // Slower speed
        utterance.onend = () => {
          setIsSpeaking(false);
          startListening();
        };
        utterance.onerror = () => {
          setIsSpeaking(false);
        };
        window.speechSynthesis.speak(utterance);
      }
    }
  }, [mode, assessment, startListening, stopListening]);

  const lastSpokenQRef = useRef(-1);

  // ✨ NEW: Read question out loud if Voice Assessment
  useEffect(() => {
    if (
      mode === "exam" &&
      assessment?.configSnapshot?.assessmentType === "ai_voice_assessment"
    ) {
      if (!hasGreeted) {
        setIsSpeaking(true);
        const utterance = new SpeechSynthesisUtterance(
          "Hello, I am SkillNaav AI. I will now start your assessment. Good luck!",
        );
        utterance.rate = 0.85;
        utterance.onend = () => {
          setHasGreeted(true);
          // Small delay before first question
          setTimeout(() => {
            if (lastSpokenQRef.current !== currentQ) {
              lastSpokenQRef.current = currentQ;
              speakQuestion();
            }
          }, 800);
        };
        window.speechSynthesis.speak(utterance);
      } else {
        if (lastSpokenQRef.current !== currentQ) {
          lastSpokenQRef.current = currentQ;
          speakQuestion();
        }
      }
    }
  }, [mode, currentQ, hasGreeted, speakQuestion, assessment]);

  // Cancel speech on unmount only
  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel();
    };
  }, []);

  // Fetch assessment status and data
  useEffect(() => {
    if (!assessmentId) {
      setMode("error");
      return;
    }

    const fetchAssessment = async () => {
      try {
        // Get assessment status
        const { data: statusData } = await axios.get(
          `/api/l2-assessments/${assessmentId}`,
        );

        if (["evaluated", "passed", "rejected"].includes(statusData.status)) {
          setEvaluation(statusData.evaluation);
          setMode("result");
          return;
        }

        if (statusData.status === "started") {
          setError(
            "This assessment has already been started and cannot be resumed.",
          );
          setMode("error");
          return;
        }

        if (statusData.status === "submitted") {
          setError(
            "This assessment was already submitted. Results will be available soon.",
          );
          setMode("error");
          return;
        }

        // Set basic assessment info for instructions
        setAssessment({
          _id: assessmentId,
          timeLimitMinutes: statusData.timeLimitMinutes || 20,
          status: statusData.status,
          configSnapshot: statusData.configSnapshot,
        });
        setMode("instructions");
      } catch (err) {
        console.error("Failed to load assessment:", err);
        setMode("error");
      }
    };

    fetchAssessment();
  }, [assessmentId]);

  // Timer effect
  useEffect(() => {
    if (mode !== "exam") return;

    setCurrentTime(Date.now());
    timerRef.current = setInterval(() => setCurrentTime(Date.now()), 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [mode]);

  const handleStart = async () => {
    try {
      setMode("loading");

      // Request browser permissions and start proctoring
      const media = await startProctoring();
      if (!media?.success || !media?.verified) {
        showWarning(
          "Please allow camera and microphone permissions in your browser. The exam cannot start without both.",
          8000,
        );
        setMode("instructions");
        return;
      }

      cameraStreamRef.current = media.stream;
      setCameraStream(media.stream);

      // Start assessment
      await axios.post(`/api/l2-assessments/${assessmentId}/start`, {
        ipAddress: await getPublicIP(),
        userAgent: navigator.userAgent,
        proctoringVerified: true,
      });

      // Get questions
      const { data } = await axios.get(`/api/l2-assessments/${assessmentId}`);
      setAssessment(data);

      await enterFullscreen(document.documentElement);
      setMode("exam");
    } catch (err) {
      console.error("Failed to start:", err);
      showWarning(
        "Failed to start assessment. Please allow camera and microphone and try again.",
        6000,
      );
      setMode("instructions");
    }
  };

  const handleSubmit = useCallback(
    async (forced = false) => {
      if (hasSubmittedRef.current) return;
      hasSubmittedRef.current = true;

      setSubmitting(true);

      try {
        const mcqAnswers = Object.entries(answers).map(([qid, val]) => {
          if (typeof val === "number") {
            return { questionId: qid, selectedIndex: val };
          } else {
            return { questionId: qid, voiceAnswer: val };
          }
        });

        await axios.post(`/api/l2-assessments/${assessmentId}/submit`, {
          mcqAnswers,
          forced,
        });

        const { data } = await axios.post(
          `/api/l2-assessments/${assessmentId}/evaluate`,
        );
        setEvaluation(data.evaluation);
        setMode("result");
      } catch (err) {
        console.error("Submit failed:", err);
        showWarning("Submission failed. Please try again.", 6000);
        setSubmitting(false);
        hasSubmittedRef.current = false;
      } finally {
        // Stop camera stream preview
        if (cameraStreamRef.current) {
          cameraStreamRef.current.getTracks().forEach((t) => t.stop());
          cameraStreamRef.current = null;
        }
        setCameraStream(null);
        stopProctoring();
        exitFullscreen();
      }
    },
    [assessmentId, answers, stopProctoring, exitFullscreen, showWarning],
  );

  useEffect(() => {
    handleSubmitRef.current = handleSubmit;
  }, [handleSubmit]);

  // Auto-submit on time expiry
  useEffect(() => {
    if (mode !== "exam" || !assessment) return;

    const startedAt = assessment.startedAt || assessment.timing?.startedAt;
    if (!startedAt) return;

    const limitMs = (assessment.timeLimitMinutes || 20) * 60 * 1000;
    const elapsed = Date.now() - new Date(startedAt).getTime();

    if (elapsed >= limitMs && !hasSubmittedRef.current) {
      handleSubmit(true);
    }
  }, [currentTime, mode, assessment, handleSubmit]);

  const selectAnswer = (questionId, index) => {
    setAnswers((prev) => ({ ...prev, [questionId]: index }));
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const getPublicIP = async () => {
    try {
      const res = await axios.get("https://api.ipify.org?format=json");
      return res.data.ip;
    } catch {
      return "unknown";
    }
  };

  // Loading
  if (mode === "loading") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading assessment...</p>
        </div>
      </div>
    );
  }

  // Error
  if (mode === "error") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-semibold mb-4">
            Assessment Unavailable
          </h2>
          <p className="text-gray-600 mb-6">
            {error || "Unable to load the assessment. Please contact support."}
          </p>
          <button
            onClick={() => window.history.back()}
            className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
          >
            Back to Applications
          </button>
        </div>
      </div>
    );
  }

  // Instructions
  if (mode === "instructions") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-2xl bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold text-center mb-6">
            Assessment Instructions
          </h1>

          <div className="space-y-4 mb-8">
            <div className="flex items-start gap-3">
              <span className="text-blue-600 text-xl">
                {assessment?.configSnapshot?.assessmentType ===
                "ai_voice_assessment"
                  ? "🎤"
                  : "📝"}
              </span>
              <div>
                <p className="font-semibold">Questions</p>
                <p className="text-gray-600">
                  {assessment?.configSnapshot?.assessmentType ===
                  "ai_voice_assessment"
                    ? "AI Voice Assessment (Speaking)"
                    : "Multiple choice questions"}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <span className="text-blue-600 text-xl">⏱️</span>
              <div>
                <p className="font-semibold">Time Limit</p>
                <p className="text-gray-600">
                  {assessment?.timeLimitMinutes || 20} minutes
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <span className="text-blue-600 text-xl">✅</span>
              <div>
                <p className="font-semibold">Passing Score</p>
                <p className="text-gray-600">
                  {assessment?.configSnapshot?.passScore || 70}% or higher
                </p>
              </div>
            </div>
          </div>

          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
            <p className="text-yellow-800 font-semibold mb-2">Important:</p>
            <ul className="text-yellow-700 text-sm space-y-1">
              <li>• Camera and microphone must remain active</li>
              <li>• Allow browser permissions when requested</li>
              <li>• Stay in fullscreen mode</li>
              <li>• Do not switch tabs or windows</li>
              <li>• 3 warnings will auto-submit the exam</li>
              <li>• Once the exam starts, it cannot be resumed later</li>
            </ul>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-sm text-blue-800">
            <p className="font-semibold mb-2">Permissions needed to start:</p>
            <ul className="list-disc ml-5 space-y-1">
              <li>Camera access</li>
              <li>Microphone access</li>
            </ul>
            <p className="mt-2 text-gray-700">
              When you click Start Assessment, your browser will ask for these
              permissions. Please allow both to begin.
            </p>
          </div>

          <button
            onClick={handleStart}
            className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 font-semibold text-lg"
          >
            Start Assessment
          </button>
        </div>
      </div>
    );
  }

  // Exam
  if (mode === "exam") {
    const questions = assessment?.questions || [];
    const totalQuestions = questions.length;
    const currentQuestion = questions[currentQ];

    if (!currentQuestion) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <p>Loading question...</p>
        </div>
      );
    }

    // Calculate time remaining
    const startedAt = assessment.startedAt || assessment.timing?.startedAt;
    const remainingMs = startedAt
      ? Math.max(
          0,
          (assessment.timeLimitMinutes || 20) * 60 * 1000 -
            (Date.now() - new Date(startedAt).getTime()),
        )
      : 0;
    const timeLeft = Math.ceil(remainingMs / 1000);

    const answeredCount = Object.keys(answers).length;

    return (
      <div className="h-screen overflow-hidden bg-[#f7f8fc] text-gray-900">
        {/* Camera preview overlay */}
        <CameraPreview
          stream={cameraStream}
          setStudentPhoto={setStudentPhoto}
          faceApi={faceApi}
          addViolation={addViolation}
        />
        {/* Header */}
        <div className="bg-white border-b border-gray-200 shadow-sm text-gray-900 px-6 py-3 flex justify-between items-center lg:pr-[280px]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-500">
              SkillNaav Assessment
            </p>
            <h1 className="text-xl font-bold">
              Question {currentQ + 1} of {totalQuestions}
            </h1>
          </div>

          <div className="flex items-center gap-6">
            <div className="text-center">
              <div
                className={`text-2xl font-bold ${timeLeft < 60 ? "text-red-600 animate-pulse" : "text-indigo-700"}`}
              >
                {formatTime(timeLeft)}
              </div>
              <div className="text-xs text-gray-500">Time Remaining</div>
            </div>

            {violationCount > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700">
                ⚠️ {violationCount} warning{violationCount > 1 ? "s" : ""}
              </div>
            )}

            <button
              onClick={() => handleSubmit(true)}
              className="rounded-xl bg-red-500 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-red-600"
            >
              End Exam
            </button>

            {/* ✨ NEW: Show snapshot photo on the far right */}
            {studentPhoto && (
              <img
                src={studentPhoto}
                alt="Student snapshot"
                className="w-11 h-11 rounded-lg border-2 border-indigo-500 object-cover shadow-sm"
              />
            )}
          </div>

          {warningMessage && (
            <div className="mt-4 mx-auto max-w-3xl rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
              {warningMessage}
            </div>
          )}
        </div>

        {/* Question */}
        <div className="max-w-6xl mx-auto px-6 py-4 lg:pr-[280px]">
          <div className="mb-3 overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-2 rounded-full bg-indigo-600 transition-all"
              style={{
                width: `${totalQuestions ? ((currentQ + 1) / totalQuestions) * 100 : 0}%`,
              }}
            />
          </div>

          <div className="mb-4 max-h-[calc(100vh-265px)] overflow-y-auto rounded-2xl border border-gray-200 bg-white p-5 shadow-sm md:p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                {assessment?.configSnapshot?.assessmentType ===
                "ai_voice_assessment"
                  ? "AI Voice Assessment"
                  : "Multiple Choice"}
              </span>
              <span className="text-sm font-medium text-gray-500">
                {answeredCount} of {totalQuestions} answered
              </span>
            </div>
            <h2 className="text-lg font-bold leading-snug text-gray-950 mb-5">
              {currentQuestion.question}
            </h2>

            {assessment?.configSnapshot?.assessmentType ===
            "ai_voice_assessment" ? (
              <div className="flex flex-col items-center justify-center py-6">
                <div
                  className={`w-24 h-24 rounded-full flex items-center justify-center mb-6 transition-all duration-300 ${isSpeaking ? "bg-blue-100 animate-pulse ring-4 ring-blue-300" : isListening ? "bg-green-100 ring-4 ring-green-300 animate-pulse" : "bg-gray-100"}`}
                >
                  <span className="text-4xl">
                    {isSpeaking ? "🗣️" : isListening ? "🎙️" : "🎤"}
                  </span>
                </div>
                <h3 className="text-xl font-semibold mb-6 text-gray-800">
                  {isSpeaking
                    ? "AI is speaking..."
                    : isListening
                      ? "AI is listening..."
                      : "Ready for next question"}
                </h3>

                {/* Live Transcript Box */}
                <div className="w-full bg-gray-50 rounded-xl p-5 border border-gray-200 min-h-[140px] shadow-inner text-left">
                  <p className="text-xs font-semibold text-gray-400 mb-3 uppercase tracking-wide flex items-center gap-2">
                    {isListening && (
                      <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    )}
                    Live Transcript
                  </p>

                  <div className="text-gray-800 text-lg leading-relaxed font-medium">
                    {answers[currentQuestion.questionId] && (
                      <span>{answers[currentQuestion.questionId]} </span>
                    )}
                    {interimTranscript && (
                      <span className="text-gray-400 italic">
                        {interimTranscript}
                      </span>
                    )}
                    {!answers[currentQuestion.questionId] &&
                      !interimTranscript && (
                        <span className="text-gray-400 italic">
                          {isSpeaking
                            ? "(Listen carefully to the question...)"
                            : "(Waiting for you to speak...)"}
                        </span>
                      )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                {currentQuestion.options?.map((option, idx) => (
                  <label
                    key={idx}
                    className={`flex items-start gap-3 p-3 border rounded-xl cursor-pointer transition-all ${
                      answers[currentQuestion.questionId] === idx
                        ? "border-indigo-500 bg-indigo-50 shadow-sm"
                        : "border-gray-200 bg-white hover:border-indigo-200 hover:bg-gray-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name={`question-${currentQ}`}
                      checked={answers[currentQuestion.questionId] === idx}
                      onChange={() =>
                        selectAnswer(currentQuestion.questionId, idx)
                      }
                      className="mt-1 w-4 h-4 text-indigo-600"
                    />
                    <span className="text-sm leading-6 text-gray-800">
                      {option}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Navigation */}
          <div className="flex flex-wrap justify-between items-center gap-3">
            <button
              disabled={currentQ === 0}
              onClick={() => setCurrentQ((prev) => prev - 1)}
              className="rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:opacity-45 disabled:cursor-not-allowed"
            >
              ← Previous
            </button>

            <div className="text-center hidden">
              <p className="text-sm text-gray-600">
                {answeredCount} of {totalQuestions} answered
              </p>
            </div>

            {currentQ === totalQuestions - 1 ? (
              <button
                onClick={() => handleSubmit(false)}
                disabled={submitting}
                className="rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
              >
                {submitting ? "Submitting..." : "Submit Exam"}
              </button>
            ) : (
              <button
                onClick={() => setCurrentQ((prev) => prev + 1)}
                className="rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
              >
                Next →
              </button>
            )}
          </div>

          {/* Question indicators */}
          <div className="mt-4 flex flex-wrap gap-2 justify-center">
            {questions.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentQ(idx)}
                className={`w-9 h-9 rounded-lg text-sm font-semibold transition-all ${
                  idx === currentQ
                    ? "bg-indigo-600 text-white shadow-sm"
                    : answers[questions[idx]?.questionId] !== undefined
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-white text-gray-500 ring-1 ring-gray-200 hover:bg-gray-50"
                }`}
              >
                {idx + 1}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Results
  //Change the layout of the results page of the assessment. - 10-08-2026
  if (mode === "result") {
    const feedback = evaluation?.feedback || "";

    // Extract correct answers and total questions
    const scoreMatch = feedback.match(/\((\d+\/\d+)\s+correct\)/i);
    const correctAnswers = scoreMatch ? scoreMatch[1] : "0/0";

    // Extract pass score
    const passScoreMatch = feedback.match(/Pass score is\s+(\d+)%/i);
    const passScore = passScoreMatch
      ? Number(passScoreMatch[1])
      : evaluation?.mcqScore - 10;

    // Extract domain performance
    const domainSection = feedback.match(
      /Performance by domain:\s*([\s\S]*?)(?=\*\*Areas to improve:\*\*|Areas to improve:|$)/i,
    );

    const domainPerformance = domainSection
      ? domainSection[1]
          .split("\n")
          .map((line) => line.replace(/\*\*/g, "").trim())
          .filter(Boolean)
          .map((line) => {
            const match = line.match(
              /^(.+?):\s*(\d+)\s*\/\s*(\d+)\s*\((\d+)%\)/,
            );

            if (!match) return null;

            return {
              domain: match[1].trim(),
              correct: Number(match[2]),
              total: Number(match[3]),
              percentage: Number(match[4]),
            };
          })
          .filter(Boolean)
      : [];

    // Extract areas to improve
    const areasMatch = feedback.match(/Areas to improve:\s*([\s\S]*)$/i);

    const areasToImprove = areasMatch
      ? areasMatch[1]
          .replace(/\*\*/g, "")
          .trim()
          .split(",")
          .map((area) => area.trim())
          .filter(Boolean)
      : [];

    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl bg-white rounded-xl shadow-lg p-5 sm:p-8 text-center">
          {/* Assessment Icon */}
          <div className="text-5xl mb-3">{evaluation?.pass ? "🎉" : "📊"}</div>

          {/* Title */}
          <h1 className="text-2xl sm:text-3xl font-bold mb-4 text-gray-900">
            Assessment Complete
          </h1>

          {/* Score */}
          <div className="text-5xl sm:text-6xl font-bold my-5">
            <span
              className={
                evaluation?.pass ? "text-green-600" : "text-orange-600"
              }
            >
              {evaluation?.mcqScore || 0}%
            </span>
          </div>

          {/* Status Message */}
          {evaluation?.pass ? (
            <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 mb-5">
              <p className="text-green-800 font-semibold text-sm sm:text-base">
                🎉 Congratulations! You passed the assessment.
              </p>
            </div>
          ) : (
            <div className="bg-orange-50 border border-orange-200 rounded-lg px-4 py-3 mb-5">
              <p className="text-orange-800 font-semibold text-sm sm:text-base">
                📈 Assessment completed. Keep practicing!
              </p>
            </div>
          )}

          {/* Summary Cards */}
          <div className="grid grid-cols-3 border border-gray-200 rounded-lg overflow-hidden mb-5">
            {/* Score */}
            <div className="p-3 border-r border-gray-200">
              <div className="text-blue-600 text-lg mb-1">◉</div>
              <p className="text-[11px] text-gray-500">Score</p>
              <p className="text-sm font-semibold text-gray-900">
                {evaluation?.mcqScore || 0}%
              </p>

              <p className="text-[10px] text-gray-400">
                {correctAnswers} correct
              </p>
            </div>

            {/* Pass Score */}
            <div className="p-3 border-r border-gray-200">
              <div className="text-purple-500 text-lg mb-1">◉</div>
              <p className="text-[11px] text-gray-500">Pass Score</p>
              <p className="text-sm font-semibold text-gray-900">
                {passScore}%
              </p>
              <p className="text-[10px] text-gray-400">Required</p>
            </div>

            {/* Result */}
            <div className="p-3">
              <div
                className={`text-lg mb-1 ${
                  evaluation?.pass ? "text-green-500" : "text-orange-500"
                }`}
              >
                ★
              </div>
              <p className="text-[11px] text-gray-500">Result</p>
              <p
                className={`text-sm font-semibold ${
                  evaluation?.pass ? "text-green-600" : "text-orange-600"
                }`}
              >
                {evaluation?.pass ? "Passed" : "Not Passed"}
              </p>
            </div>
          </div>

          {/* Performance by Domain */}
          {domainPerformance.length > 0 && (
            <div className="text-left mb-5">
              <h2 className="text-sm font-semibold text-gray-800 mb-2">
                Performance by Domain
              </h2>

              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <div className="min-w-[500px]">
                    {/* Table Header */}
                    <div className="grid grid-cols-[1fr_70px_70px_100px] gap-2 px-3 py-2 bg-gray-50 border-b border-gray-200 text-[10px] sm:text-xs text-gray-500 font-medium">
                      <span>Domain</span>
                      <span>Score</span>
                      <span>Percentage</span>
                      <span>Progress</span>
                    </div>

                    {/* Domain Rows */}
                    {domainPerformance.map((item, index) => (
                      <div
                        key={`${item.domain}-${index}`}
                        className="grid grid-cols-[1fr_70px_70px_100px] gap-2 items-center px-3 py-2.5 border-b last:border-b-0 border-gray-100"
                      >
                        <span className="text-xs sm:text-sm font-medium text-gray-700 capitalize truncate">
                          {item.domain}
                        </span>

                        <span className="text-xs sm:text-sm text-gray-700">
                          {item.correct}/{item.total}
                        </span>

                        <span
                          className={`text-xs sm:text-sm font-medium ${
                            item.percentage >= passScore
                              ? "text-green-600"
                              : "text-orange-600"
                          }`}
                        >
                          {item.percentage}%
                        </span>

                        <div className="w-full">
                          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                item.percentage >= passScore
                                  ? "bg-green-500"
                                  : "bg-orange-500"
                              }`}
                              style={{
                                width: `${Math.min(item.percentage, 100)}%`,
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Areas to Improve */}
          {areasToImprove.length > 0 && (
            <div className="text-left mb-6">
              <h2 className="text-sm font-semibold text-gray-800 mb-2">
                Areas to Improve
              </h2>

              <div className="flex flex-wrap gap-2">
                {areasToImprove.map((area, index) => (
                  <span
                    key={`${area}-${index}`}
                    className="inline-flex items-center px-3 py-1 bg-orange-50 border border-orange-200 text-orange-700 rounded-full text-xs font-medium capitalize"
                  >
                    ↗ {area}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Back to Dashboard */}
          <button
            onClick={() => {
              localStorage.removeItem("activeAssessmentId");
              window.location.href = "/user-main-page";
            }}
            className="bg-blue-600 text-white px-6 sm:px-8 py-2.5 sm:py-3 rounded-lg hover:bg-blue-700 font-semibold text-sm sm:text-base transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }
  // if (mode === "result") {
  //   return (
  //     <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
  //       <div className="max-w-2xl bg-white rounded-lg shadow-lg p-8 text-center">
  //         <div className="text-6xl mb-4">{evaluation?.pass ? "🎉" : "📊"}</div>

  //         <h1 className="text-3xl font-bold mb-4">Assessment Complete</h1>

  //         <div className="text-6xl font-bold my-6">
  //           <span
  //             className={
  //               evaluation?.pass ? "text-green-600" : "text-orange-600"
  //             }
  //           >
  //             {evaluation?.mcqScore || 0}%
  //           </span>
  //         </div>

  //         {evaluation?.pass ? (
  //           <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
  //             <p className="text-green-800 font-semibold">
  //               Congratulations! You passed the assessment.
  //             </p>
  //           </div>
  //         ) : (
  //           <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
  //             <p className="text-orange-800 font-semibold">
  //               Assessment completed. Keep practicing!
  //             </p>
  //           </div>
  //         )}

  //         {evaluation?.feedback && (
  //           <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left">
  //             <p className="text-sm text-gray-700">{evaluation.feedback}</p>
  //           </div>
  //         )}

  //         <button
  //           onClick={() => {
  //             localStorage.removeItem("activeAssessmentId");
  //             window.location.href = "/user-main-page";
  //           }}
  //           className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 font-semibold"
  //         >
  //           Back to Dashboard
  //         </button>
  //       </div>
  //     </div>
  //   );
  // }

  return null;
};

export default StudentAssessment;
