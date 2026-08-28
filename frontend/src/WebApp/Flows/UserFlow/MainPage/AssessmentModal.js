import React, { useState, useEffect, useRef, useCallback } from "react";
import axios from "../../../../api/axiosInstance";
import { useProctoring } from "./useProctoring";
import ProctoringWarningBanner from "./ProctoringWarningBanner";
import DetailedAssessmentResults from "./DetailedAssessmentResults"; // ✨ NEW
import { loadFaceApi } from "../../../../utils/faceApiLoader";

const ProctoredAssessment = ({ assessment, studentId, onClose }) => {
  const [answers, setAnswers] = useState(
    Array(assessment.questions.length).fill(null)
  );
  const [submitting, setSubmitting] = useState(false);
  const [submission, setSubmission] = useState(null);
  const [showResults, setShowResults] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [startTime, setStartTime] = useState(null); // ✨ NEW: Track exam start time
  const [currentTime, setCurrentTime] = useState(Date.now()); // ✨ NEW: Current time for countdown
  const [studentPhoto, setStudentPhoto] = useState(null); // ✨ NEW: snapshot photo
  const containerRef = useRef(null);
  const canvasRef = useRef(null); // ✨ NEW: for face tracking overlay
  const faceApiRef = useRef(null);
  const noFaceFramesRef = useRef(0);
  const multipleFacesFramesRef = useRef(0);

  // ─── In-app confirmation dialog (replaces alert for auto-submit) ───
  const [confirmDialog, setConfirmDialog] = useState(null);

  // ─── Track whether we already auto-submitted ─────────────────────
  const autoSubmittedRef = useRef(false);

  // ─── VIOLATION HANDLER ────────────────────────────────────────────
  const handleViolation = useCallback(
    (violation, count) => {
      if (count >= 3 && !autoSubmittedRef.current) {
        autoSubmittedRef.current = true;
        setConfirmDialog({
          title: "Assessment Auto-Submitted",
          message: `Too many violations detected (${count}/3). Your assessment has been auto-submitted with the answers you've completed so far.`,
          onConfirm: () => {
            setConfirmDialog(null);
            handleSubmit(true);
          },
        });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const {
    violations,
    stream,
    isFullscreen,
    videoRef,
    warningMessage,
    startProctoring,
    stopProctoring,
    enterFullscreen,
    exitFullscreen,
    violationCount,
    showWarning,
    addViolation,
  } = useProctoring(handleViolation);

  // ─── CHECK FOR EXISTING SUBMISSION ────────────────────────────────
  useEffect(() => {
    const fetchSubmission = async () => {
      try {
        const res = await axios.get(
          `/api/assessments/submission/${studentId}/${assessment._id}`
        );
        if (res.data.submission) {
          setSubmission(res.data.submission);
          setShowResults(true);
        }
      } catch (err) {
        // No submission found — that's fine
      }
    };
    fetchSubmission();
  }, [assessment._id, studentId]);

  // ✨ NEW: Load face-api models
  useEffect(() => {
    const loadModels = async () => {
      try {
        const faceapi = await loadFaceApi();
        faceApiRef.current = faceapi;
        await faceapi.nets.tinyFaceDetector.loadFromUri('https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/');
      } catch (err) {
        console.error("Failed to load face-api models:", err);
      }
    };
    loadModels();
  }, []);

  // ✨ NEW: Timer update effect - Update current time every second
  useEffect(() => {
    if (!isReady) return;
    
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    
    return () => clearInterval(interval);
  }, [isReady]);

  // ✨ NEW: Auto-submit when time expires
  useEffect(() => {
    const timeData = getTimeRemaining();
    if (timeData?.isExpired && isReady && !submitting) {
      console.log("⏰ Time expired - auto-submitting assessment");
      handleSubmit(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTime, isReady, submitting]);

  // ✨ NEW: Helper function to calculate time remaining
  const getTimeRemaining = () => {
    if (!isReady || !startTime) return null;
    
    const timeLimit = assessment.configSnapshot?.timeLimitMinutes || 20;
    const timeLimitMs = timeLimit * 60 * 1000;
    const elapsedMs = currentTime - startTime;
    const remainingMs = Math.max(0, timeLimitMs - elapsedMs);
    
    return {
      remainingMs,
      remainingMinutes: Math.floor(remainingMs / 60000),
      remainingSeconds: Math.floor((remainingMs % 60000) / 1000),
      isExpired: remainingMs <= 0,
      percentageRemaining: (remainingMs / timeLimitMs) * 100
    };
  };

  // ─── START ASSESSMENT ─────────────────────────────────────────────
  const handleStartAssessment = async () => {
    const media = await startProctoring();
    if (!media?.success || !media?.verified) {
      return;
    }



    if (containerRef.current) {
      await enterFullscreen(containerRef.current);
    }

    setIsReady(true);
    setStartTime(Date.now()); // ✨ NEW: Set start time for timer
  };

  // ─── CLEANUP ON UNMOUNT ───────────────────────────────────────────
  useEffect(() => {
    return () => {
      stopProctoring();
      exitFullscreen();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✨ Ensure video stream is attached when the video element mounts
  useEffect(() => {
    if (isReady && stream && videoRef.current) {
      if (videoRef.current.srcObject !== stream) {
        videoRef.current.srcObject = stream;
      }
      videoRef.current.play().catch(e => console.error("Error playing video:", e));
    }
  }, [isReady, stream, videoRef]);

  // ✨ NEW: Snapshot logic
  useEffect(() => {
    if (isReady && stream && !studentPhoto) {
      let timeoutId;
      const attemptCapture = () => {
        if (videoRef.current && videoRef.current.readyState >= 2 && videoRef.current.videoWidth > 0) {
          timeoutId = setTimeout(() => {
            if (!videoRef.current) return;
            try {
              const canvas = document.createElement("canvas");
              canvas.width = videoRef.current.videoWidth;
              canvas.height = videoRef.current.videoHeight;
              canvas.getContext("2d").drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
              setStudentPhoto(canvas.toDataURL("image/jpeg"));
            } catch (e) {
              console.error("Failed to capture snapshot:", e);
            }
          }, 2000);
        } else {
          timeoutId = setTimeout(attemptCapture, 500);
        }
      };
      attemptCapture();
      return () => clearTimeout(timeoutId);
    }
  }, [isReady, stream, studentPhoto, videoRef]);

  // ✨ NEW: Face tracking loop
  useEffect(() => {
    let intervalId;
    if (isReady && stream && videoRef.current && canvasRef.current) {
      intervalId = setInterval(async () => {
        const faceapi = faceApiRef.current;
        if (!faceapi) return;

        if (videoRef.current && videoRef.current.readyState === 4 && faceapi.nets.tinyFaceDetector.isLoaded) {
          try {
            const detections = await faceapi.detectAllFaces(
              videoRef.current,
              new faceapi.TinyFaceDetectorOptions()
            );
            const displaySize = {
              width: videoRef.current.clientWidth,
              height: videoRef.current.clientHeight,
            };
            faceapi.matchDimensions(canvasRef.current, displaySize);
            const resizedDetections = faceapi.resizeResults(detections, displaySize);
            
            const canvas = canvasRef.current;
            const ctx = canvas.getContext("2d");
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            resizedDetections.forEach((detection) => {
              const box = detection.box;
              ctx.strokeStyle = "#00FF00";
              ctx.lineWidth = 3;
              ctx.strokeRect(box.x, box.y, box.width, box.height);
            });

            if (detections.length === 0) {
              noFaceFramesRef.current += 1;
              multipleFacesFramesRef.current = 0;
              if (noFaceFramesRef.current > 15) { // 3 seconds at 200ms
                if (addViolation) addViolation('FACE_NOT_DETECTED', 'Face not detected in camera');
                noFaceFramesRef.current = 0;
              }
            } else if (detections.length > 1) {
              multipleFacesFramesRef.current += 1;
              noFaceFramesRef.current = 0;
              if (multipleFacesFramesRef.current > 15) { // 3 seconds
                if (addViolation) addViolation('MULTIPLE_FACES', 'Multiple faces detected in camera');
                multipleFacesFramesRef.current = 0;
              }
            } else {
              noFaceFramesRef.current = 0;
              multipleFacesFramesRef.current = 0;
            }
          } catch (err) {
            console.error("Face detection error:", err);
          }
        }
      }, 200);
    }
    return () => clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, stream]);

  // ─── OPTION SELECT ────────────────────────────────────────────────
  const handleOptionSelect = (index, optionIndex) => {
    const newAnswers = [...answers];
    newAnswers[index] = optionIndex;
    setAnswers(newAnswers);
  };

  // ─── SUBMIT ───────────────────────────────────────────────────────
  const handleSubmit = async (isAutoSubmit = false) => {
    if (!isAutoSubmit && answers.includes(null)) {
      showWarning("Please answer all questions before submitting.", 4000);
      return;
    }

    const timeTaken = Math.floor((Date.now() - (startTime || Date.now())) / 1000);

    const payload = {
      assessmentId: assessment._id,
      studentId,
      responses: assessment.questions.map((q, i) => ({
        questionText: q.questionText,
        options: q.options,
        studentAnswer: answers[i] ?? -1,
        correctAnswer: q.correctAnswer,
        marks: q.marks || 1,
        topic: q.topic || null,
      })),
      timeTaken,
      violations,
      violationCount,
      isAutoSubmit,
      proctoringData: {
        mode: "real",
        cameraEnabled: !!stream,
        microphoneEnabled: !!stream,
        fullscreenEnabled: isFullscreen,
        startedAt: startTime ? new Date(startTime) : new Date(),
      },
    };

    setSubmitting(true);
    try {
      const response = await axios.post("/api/assessments/submit", payload);

      if (response.data.warnings) {
        showWarning(response.data.warnings.message, 5000);
      }

      const res = await axios.get(
        `/api/assessments/submission/${studentId}/${assessment._id}`
      );
      setSubmission(res.data.submission);
      setShowResults(true);
      stopProctoring();
      await exitFullscreen();

      // ✅ Notify parent components that assessment was completed
      window.dispatchEvent(new CustomEvent("assessmentCompleted"));
    } catch (err) {
      console.error(err);
      if (
        err.response?.status === 400 &&
        err.response?.data?.message?.includes("already submitted")
      ) {
        showWarning("You have already submitted this assessment.", 4000);
        try {
          const res = await axios.get(
            `/api/assessments/submission/${studentId}/${assessment._id}`
          );
          setSubmission(res.data.submission);
          setShowResults(true);
          stopProctoring();
          await exitFullscreen();
        } catch (fetchErr) {
          console.error("Error fetching existing submission:", fetchErr);
        }
      } else {
        showWarning("Failed to submit assessment. Please try again.", 5000);
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ─── EXIT ─────────────────────────────────────────────────────────
  const handleExit = async () => {
    stopProctoring();
    await exitFullscreen();
    onClose();
  };

  const answeredCount = answers.filter((a) => a !== null).length;
  const totalQuestions = assessment.questions.length;

  /* ════════════════════════════════════════════════════════════════
     RESULTS VIEW
  ════════════════════════════════════════════════════════════════ */
  if (showResults && submission) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-90 z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[90vh] overflow-y-auto p-8">
          {/* ✨ NEW: Use DetailedAssessmentResults for shortlist assessments */}
          {assessment.type === "MCQ_SINGLE_CORRECT" ? (
            <DetailedAssessmentResults
              submission={submission}
              assessment={assessment}
              assessmentType={assessment.type}
            />
          ) : (
            // For other assessment types, show simple results
            <>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">
                Assessment Results
              </h2>
              <p className="text-lg text-gray-600 mb-4">
                Score:{" "}
                <span className="font-bold text-purple-600">
                  {submission.score}/{submission.totalMarks}
                </span>{" "}
                ({Math.round(submission.percentage)}%)
              </p>
            </>
          )}

          {/* Footer buttons */}
          <div className="flex gap-4 justify-center mt-8">
            <button
              onClick={handleExit}
              className="px-6 py-3 bg-gray-300 text-gray-700 rounded-xl hover:bg-gray-400 transition font-semibold"
            >
              Close
            </button>

            {/* Show retake button if failed and it's shortlist */}
            {assessment.type === "MCQ_SINGLE_CORRECT" && 
             !submission.evaluation?.pass && (
              <button
                onClick={() => {
                  setShowResults(false);
                  setAnswers(Array(assessment.questions.length).fill(null));
                  autoSubmittedRef.current = false;
                  handleStartAssessment();
                }}
                className="px-6 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition font-semibold"
              >
                Retake Assessment
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ════════════════════════════════════════════════════════════════
     READY CONFIRMATION VIEW
  ════════════════════════════════════════════════════════════════ */
  if (!isReady && !showResults) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-90 z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-8">
          <div className="mb-6 text-center">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              Before You Start
            </h2>
            <p className="text-lg text-gray-600">
              Please review the guidelines below
            </p>
          </div>

          <div className="mb-6 space-y-4">
            <h3 className="font-semibold text-lg mb-3">Proctoring Guidelines:</h3>
            <ul className="space-y-2 text-gray-700">
              <li>✓ Your camera and microphone will be enabled</li>
              <li>✓ You must stay in fullscreen mode</li>
              <li>✓ Switching tabs or windows will be recorded as a violation</li>
              <li>✓ Using keyboard shortcuts will be blocked</li>
              <li>✓ After 3 violations, the test will auto-submit</li>
              <li>✓ Ensure you're in a quiet, well-lit environment</li>
              <li>✓ Do not leave your seat during the assessment</li>
            </ul>
          </div>

          <div className="mb-6">
            <h3 className="font-semibold text-lg mb-2">Assessment Details:</h3>
            <p className="text-gray-600">
              Total Questions: {assessment.questions.length}
            </p>
            <p className="text-gray-600">
              Total Marks:{" "}
              {assessment.questions.reduce(
                (sum, q) => sum + (q.marks || 1),
                0
              )}
            </p>
            <p className="text-gray-600">
              Time Limit: {assessment.configSnapshot?.timeLimitMinutes || 20} minutes
            </p>
          </div>

          <div className="flex gap-4 justify-center">
            <button
              onClick={handleExit}
              className="px-6 py-3 bg-gray-300 text-gray-700 rounded-xl hover:bg-gray-400 transition font-semibold"
            >
              Cancel
            </button>
            <button
              onClick={handleStartAssessment}
              className="px-6 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition font-semibold"
            >
              I Agree – Start Assessment
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ════════════════════════════════════════════════════════════════
     MAIN ASSESSMENT VIEW
  ════════════════════════════════════════════════════════════════ */
  return (
    <div
      ref={containerRef}
      className="fixed inset-0 bg-gradient-to-br from-purple-900 to-indigo-900 z-50 overflow-hidden"
    >
      {/* ✅ Hook-driven warning banner */}
      <ProctoringWarningBanner message={warningMessage} />

      {/* ✅ In-app confirmation dialog */}
      {confirmDialog && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-70 z-[60]">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6 text-center">
            <div className="text-4xl mb-3">⚠️</div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              {confirmDialog.title}
            </h3>
            <p className="text-gray-600 mb-6">{confirmDialog.message}</p>
            <button
              onClick={confirmDialog.onConfirm}
              className="px-6 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition font-semibold w-full"
            >
              OK
            </button>
          </div>
        </div>
      )}

      {/* Header with progress, timer, and violations */}
      <div className="bg-white shadow-lg p-4 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              Internship Assessment
            </h2>
            <p className="text-sm text-gray-500">
              Stay focused – This session is being monitored
            </p>
          </div>
        </div>

        <div className="flex items-center gap-6">


          {/* Progress Bar */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Progress:</span>
            <div className="w-32 bg-gray-200 rounded-full h-2.5">
              <div
                className="bg-purple-600 h-2.5 rounded-full transition-all"
                style={{
                  width: `${(answeredCount / totalQuestions) * 100}%`,
                }}
              />
            </div>
            <span className="text-sm font-semibold text-gray-700">
              {answeredCount}/{totalQuestions}
            </span>
          </div>

          {/* ✨ NEW: Timer Display */}
          {isReady && getTimeRemaining() && (
            <div className="flex items-center gap-3">
              <div className="flex items-baseline gap-1">
                <span className={`font-bold text-lg ${
                  getTimeRemaining()?.remainingMinutes <= 5 
                    ? 'text-red-600' 
                    : 'text-gray-700'
                }`}>
                  {getTimeRemaining()?.remainingMinutes}:{String(getTimeRemaining()?.remainingSeconds || 0).padStart(2, '0')}
                </span>
                <span className="text-xs text-gray-500">remaining</span>
              </div>
              
              {/* Time bar */}
              <div className="w-24 bg-gray-300 rounded-full h-2.5">
                <div
                  className={`h-2.5 rounded-full transition-all ${
                    getTimeRemaining()?.remainingMinutes <= 5 
                      ? 'bg-red-600' 
                      : 'bg-green-600'
                  }`}
                  style={{ 
                    width: `${Math.max(0, getTimeRemaining()?.percentageRemaining || 0)}%` 
                  }}
                />
              </div>
            </div>
          )}

          {/* Violation Counter */}
          <div
            className={`flex items-center gap-2 px-3 py-1 rounded-lg ${
              violationCount === 0
                ? "bg-green-50"
                : violationCount < 3
                ? "bg-yellow-50"
                : "bg-red-50"
            }`}
          >
            <span
              className={`text-sm font-semibold ${
                violationCount === 0
                  ? "text-green-600"
                  : violationCount < 3
                  ? "text-yellow-600"
                  : "text-red-600"
              }`}
            >
              Violations: {violationCount}/3
            </span>
          </div>

          {/* ✨ NEW: Show snapshot photo on the far right without the word SNAPSHOT */}
          {studentPhoto && (
            <img src={studentPhoto} alt="Student snapshot" className="w-12 h-12 rounded-lg border-2 border-purple-500 object-cover shadow-sm" />
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex h-[calc(100vh-80px)]">
        {/* Questions Section */}
        <div className="flex-1 overflow-y-auto p-8 bg-white">
          {assessment.questions.map((q, i) => (
            <div
              key={i}
              className="mb-8 p-6 border-2 rounded-xl bg-gray-50 shadow-md"
            >
              <p className="font-bold text-gray-800 mb-4 text-lg">
                Question {i + 1}: {q.questionText}
              </p>
              <div className="flex flex-col gap-3">
                {q.options.map((opt, j) => (
                  <label
                    key={j}
                    className={`flex items-center gap-3 p-4 rounded-xl cursor-pointer transition-all ${
                      answers[i] === j
                        ? "bg-purple-100 border-2 border-purple-600 shadow-lg"
                        : "hover:bg-gray-100 border-2 border-gray-200"
                    }`}
                  >
                    <input
                      type="radio"
                      name={`question-${i}`}
                      value={j}
                      checked={answers[i] === j}
                      onChange={() => handleOptionSelect(i, j)}
                      className="accent-purple-600 w-5 h-5"
                    />
                    <span className="text-gray-800 font-medium">
                      {String.fromCharCode(65 + j)}) {opt}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Proctoring Sidebar */}
        <div className="w-80 bg-gray-900 text-white p-6 flex flex-col">
          <h3 className="text-xl font-bold mb-4">Live Monitoring</h3>

          {/* Camera Feed */}
          <div className="mb-6 relative">
            <video
              ref={(el) => {
                videoRef.current = el;
                if (el && stream && el.srcObject !== stream) {
                  el.srcObject = stream;
                  el.play().catch(e => console.error("Error playing video:", e));
                }
              }}
              autoPlay
              muted
              playsInline
              style={{ transform: "scaleX(-1)" }}
              className="w-full rounded-lg border-2 border-purple-500 relative z-10"
            />
            {/* ✨ NEW: Overlay canvas for face tracking */}
            <canvas
              ref={canvasRef}
              style={{ transform: "scaleX(-1)" }}
              className="absolute top-0 left-0 w-full h-full z-20 pointer-events-none"
            />
            <p className="text-xs text-gray-400 mt-2 text-center">
              📹 Your camera is active
            </p>
          </div>

          {/* Violation Log */}
          <div className="flex-1 overflow-y-auto mb-4">
            <h4 className="font-semibold mb-2 text-purple-300">
              Violation Log:
            </h4>
            {violations.length === 0 ? (
              <p className="text-sm text-gray-400">No violations detected</p>
            ) : (
              <div className="space-y-2">
                {violations.map((v, idx) => (
                  <div key={idx} className="bg-red-900 p-2 rounded text-xs">
                    <p className="font-semibold">{v.type}</p>
                    <p className="text-gray-300">{v.message}</p>
                    <p className="text-gray-500 text-xs">
                      {new Date(v.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Submit Button */}
          <button
            onClick={() => handleSubmit(false)}
            disabled={submitting}
            className="w-full mt-auto px-6 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition font-bold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "Submitting..." : "Submit Assessment"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProctoredAssessment;
