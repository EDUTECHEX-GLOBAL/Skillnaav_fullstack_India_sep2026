// File: UserAgeGateConsent.js
import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "../../../../../api/axiosInstance";

const UNDER18_CONSENT_POINTS = [
  "You confirm you are the child's parent or legal guardian and are legally allowed to provide consent.",
  "You consent to creating the child's account and allowing the child to use the platform features (including internships, learning tasks, and schedules).",
  "You consent to our processing of the child's basic account information and activity data to provide the service (e.g., login, scheduling, progress tracking, and support).",
  "We may contact the guardian email provided for verification, important account notices, safety-related communication, or consent-related updates.",
  "You understand you can request account deletion or withdraw consent at any time by contacting support (access may be removed if consent is withdrawn).",
];

const UserAgeGateConsent = ({ open, onComplete, saving = false, mode = "DEFAULT", onClose, userEmail = "" }) => {
  const isReverify = mode === "REVERIFY_OVER18";

  const [stage, setStage] = useState(isReverify ? "OVER18_CAMERA" : "AGE");
  const [ageCategory, setAgeCategory] = useState(isReverify ? "OVER_18" : "");

  const [guardianName, setGuardianName] = useState("");
  const [guardianEmail, setGuardianEmail] = useState("");
  const [guardianRelationship, setGuardianRelationship] = useState("Parent");
  const [agreeGuardian, setAgreeGuardian] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);

  // OTP state for User Email verification
  const [userOtp, setUserOtp] = useState("");
  const [userOtpSent, setUserOtpSent] = useState(false);
  const [userOtpError, setUserOtpError] = useState("");
  const [sendingUserOtp, setSendingUserOtp] = useState(false);
  const [verifyingUserOtp, setVerifyingUserOtp] = useState(false);

  // OTP state for Guardian Email verification
  const [guardianOtp, setGuardianOtp] = useState("");
  const [guardianOtpSent, setGuardianOtpSent] = useState(false);
  const [guardianOtpError, setGuardianOtpError] = useState("");
  const [sendingGuardianOtp, setSendingGuardianOtp] = useState(false);
  const [verifyingGuardianOtp, setVerifyingGuardianOtp] = useState(false);

  const [error, setError] = useState("");

  // --- Over 18 camera capture ---
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const [cameraError, setCameraError] = useState("");
  const [capturedPreview, setCapturedPreview] = useState("");
  const [capturedFile, setCapturedFile] = useState(null);

  const emailOk = useMemo(() => {
    if (!guardianEmail) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guardianEmail);
  }, [guardianEmail]);

  const isSameAsUserEmail = useMemo(() => {
    if (!guardianEmail || !userEmail) return false;
    return guardianEmail.trim().toLowerCase() === userEmail.trim().toLowerCase();
  }, [guardianEmail, userEmail]);

  const under18FieldsOk = useMemo(() => {
    const nameOk = guardianName.trim().length > 0;
    const relationshipOk = !!guardianRelationship;
    const emailValid = guardianEmail.trim().length > 0 && emailOk && !isSameAsUserEmail;
    return nameOk && emailValid && relationshipOk;
  }, [guardianName, guardianEmail, guardianRelationship, emailOk, isSameAsUserEmail]);

  const resetError = () => setError("");

  const stopCamera = () => {
    const stream = streamRef.current;
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  const startCamera = async () => {
    setCameraError("");
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError("Camera is not supported in this browser.");
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (err) {
      console.error("Camera start error:", err);
      setCameraError(
        "Unable to access camera. Please allow camera permission and try again. (Camera works only on HTTPS or localhost.)"
      );
    }
  };

  const capturePhoto = () => {
    resetError();
    setCameraError("");
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) {
      setError("Camera not ready. Please try again.");
      return;
    }
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) {
      setError("Camera not ready. Please wait a moment and try again.");
      return;
    }
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, w, h);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    setCapturedPreview(dataUrl);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setError("Failed to capture photo. Please try again.");
          return;
        }
        const file = new File([blob], `age-verification-${Date.now()}.jpg`, {
          type: "image/jpeg",
        });
        setCapturedFile(file);
        stopCamera();
      },
      "image/jpeg",
      0.92
    );
  };

  const retakePhoto = async () => {
    resetError();
    setCapturedPreview("");
    setCapturedFile(null);
    await startCamera();
  };

  useEffect(() => {
    if (!open) {
      stopCamera();
      return;
    }
    if (stage === "OVER18_CAMERA" && !capturedPreview) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, stage, capturedPreview]);

  useEffect(() => {
    if (!open) return;
    if (isReverify) {
      setStage("OVER18_CAMERA");
      setAgeCategory("OVER_18");
      setCapturedPreview("");
      setCapturedFile(null);
      setError("");
      setCameraError("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const handleUnder18Click = () => {
    resetError();
    setAgeCategory("UNDER_18");
    setStage("UNDER18");
  };

  const handleOver18Click = () => {
    resetError();
    setAgeCategory("OVER_18");
    setCapturedPreview("");
    setCapturedFile(null);
    setStage("OVER18_CAMERA");
  };

  const handleUnder18Continue = () => {
    resetError();
    if (!guardianName.trim()) return setError("Please enter guardian name.");
    if (!guardianEmail.trim() || !emailOk) return setError("Please enter a valid guardian email.");
    if (isSameAsUserEmail) return setError("Guardian Email cannot be the same as the User Email. Please enter a different Guardian Email.");
    if (!guardianRelationship) return setError("Please select relationship.");
    if (!agreeGuardian) return setError("Please confirm guardian consent.");
    if (!agreeTerms) return setError("Please accept Terms & Privacy.");
    // 2705 FIX: User email already verified in Step 1 signup. Go directly to Guardian OTP.
    setStage("UNDER18_GUARDIAN_OTP");
  };

  const handleSendUserOtp = async () => {
    setUserOtpError("");
    setSendingUserOtp(true);
    try {
      // ✅ Use the dedicated age gate OTP endpoint (no registered-user check)
      await axios.post("/api/users/send-age-gate-otp", { email: userEmail });
      setUserOtpSent(true);
    } catch (err) {
      setUserOtpError("Failed to send OTP to your email. Please try again.");
    } finally {
      setSendingUserOtp(false);
    }
  };

  const handleVerifyUserOtp = async () => {
    setUserOtpError("");
    if (!userOtp) return setUserOtpError("Please enter the OTP.");
    setVerifyingUserOtp(true);
    try {
      const res = await axios.post("/api/users/verify-otp", {
        email: userEmail,
        otp: userOtp,
      });
      if (res.data.success) {
        setUserOtpError("");
        setStage("UNDER18_GUARDIAN_OTP");
      } else {
        setUserOtpError("Invalid OTP. Please try again.");
      }
    } catch (err) {
      setUserOtpError("OTP verification failed. Please try again.");
    } finally {
      setVerifyingUserOtp(false);
    }
  };

  const handleSendGuardianOtp = async () => {
    setGuardianOtpError("");
    setSendingGuardianOtp(true);
    try {
      // ✅ Use dedicated age gate OTP endpoint — guardian email is NOT a registered user
      await axios.post("/api/users/send-age-gate-otp", { email: guardianEmail.trim() });
      setGuardianOtpSent(true);
    } catch (err) {
      setGuardianOtpError("Failed to send OTP to guardian email. Please try again.");
    } finally {
      setSendingGuardianOtp(false);
    }
  };

  const handleVerifyGuardianOtp = async () => {
    setGuardianOtpError("");
    if (!guardianOtp) return setGuardianOtpError("Please enter the OTP.");
    setVerifyingGuardianOtp(true);
    try {
      const res = await axios.post("/api/users/verify-otp", {
        email: guardianEmail.trim(),
        otp: guardianOtp,
      });
      if (res.data.success) {
        setGuardianOtpError("");
        const payload = {
          ageCategory: "UNDER_18",
          ageGateCompleted: true,
          guardianConsentAccepted: true,
          guardianConsentAcceptedAt: new Date().toISOString(),
          guardianName: guardianName.trim(),
          guardianEmail: guardianEmail.trim(),
          guardianRelationship,
        };
        onComplete?.(payload);
      } else {
        setGuardianOtpError("Invalid OTP. Please try again.");
      }
    } catch (err) {
      setGuardianOtpError("OTP verification failed. Please try again.");
    } finally {
      setVerifyingGuardianOtp(false);
    }
  };

  const handleOver18Continue = () => {
    resetError();
    if (!capturedFile) {
      return setError("Please capture a photo to continue.");
    }
    const payload = {
      ageCategory: "OVER_18",
      ageGateCompleted: true,
      ageVerificationPhoto: capturedFile,
    };
    onComplete?.(payload);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="w-full max-w-lg bg-white rounded-xl shadow-xl flex flex-col max-h-[calc(100vh-2rem)] overflow-hidden">
        <div className="p-6 pb-4">
          <div className="mb-4">
            <h2 className="text-xl font-bold text-gray-800">
              {stage === "AGE"
                ? "Age Confirmation"
                : stage === "UNDER18"
                  ? "Guardian Consent (Under 18)"
                  : stage === "UNDER18_USER_OTP"
                    ? "Verify Your Email"
                    : stage === "UNDER18_GUARDIAN_OTP"
                      ? "Verify Guardian Email"
                      : "Age Verification Selfie"}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {stage === "AGE"
                ? "Please confirm your age group to continue."
                : stage === "UNDER18"
                  ? "A parent/guardian must provide consent to proceed."
                  : stage === "UNDER18_USER_OTP"
                    ? "Enter the OTP sent to your email to verify your identity."
                    : stage === "UNDER18_GUARDIAN_OTP"
                      ? "Enter the OTP sent to the guardian's email to verify consent."
                      : "Please capture a clear selfie to continue."}
            </p>
          </div>
          {error && (
            <div className="p-3 rounded-md bg-red-100 text-red-700 text-sm border border-red-200">
              {error}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-6">

          {/* AGE SELECTION */}
          {!isReverify && stage === "AGE" && (
            <div className="space-y-3">
              <button
                type="button"
                onClick={handleUnder18Click}
                disabled={saving}
                className="w-full bg-purple-600 text-white py-3 rounded-lg hover:bg-purple-700 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Under 18
              </button>
              <button
                type="button"
                onClick={handleOver18Click}
                disabled={saving}
                className="w-full bg-gray-900 text-white py-3 rounded-lg hover:bg-black disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Over 18
              </button>
            </div>
          )}

          {/* GUARDIAN CONSENT FORM */}
          {!isReverify && stage === "UNDER18" && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Guardian Full Name *</label>
                <input
                  type="text"
                  value={guardianName}
                  onChange={(e) => setGuardianName(e.target.value)}
                  className="mt-1 w-full px-3 py-2 border rounded-md border-gray-300"
                  placeholder="Enter guardian full name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Guardian Email *</label>
                <input
                  type="email"
                  value={guardianEmail}
                  onChange={(e) => setGuardianEmail(e.target.value)}
                  className="mt-1 w-full px-3 py-2 border rounded-md border-gray-300"
                  placeholder="Enter guardian email"
                />
                {guardianEmail && !emailOk && (
                  <p className="text-xs text-red-500 mt-1">Invalid email format.</p>
                )}
                {guardianEmail && emailOk && isSameAsUserEmail && (
                  <p className="text-xs text-red-500 mt-1">
                    Guardian Email cannot be the same as the User Email. Please enter a different Guardian Email.
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Relationship *</label>
                <select
                  value={guardianRelationship}
                  onChange={(e) => setGuardianRelationship(e.target.value)}
                  className="mt-1 w-full px-3 py-2 border rounded-md border-gray-300 bg-white"
                >
                  <option value="Parent">Parent</option>
                  <option value="Guardian">Guardian</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="rounded-md border border-purple-200 bg-purple-50 p-3">
                <p className="text-sm font-semibold text-purple-900">What you're consenting to</p>
                <ul className="mt-2 list-disc pl-5 text-sm text-purple-900 space-y-1">
                  {UNDER18_CONSENT_POINTS.map((point, idx) => (
                    <li key={idx}>{point}</li>
                  ))}
                </ul>
              </div>
              <div className="space-y-2 bg-gray-50 p-3 rounded-md border">
                <label className="flex items-start gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={agreeGuardian}
                    onChange={(e) => setAgreeGuardian(e.target.checked)}
                    className="mt-1 h-4 w-4"
                  />
                  <span>
                    I have read and agree to Terms of Service and Privacy Policy, including how personal
                    information is collected and used.
                  </span>
                </label>
                <label className="flex items-start gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={agreeTerms}
                    onChange={(e) => setAgreeTerms(e.target.checked)}
                    className="mt-1 h-4 w-4"
                  />
                  <span>I agree to the platform Terms & Privacy Policy.</span>
                </label>
              </div>
            </div>
          )}

          {/* STAGE: Verify User Email OTP */}
          {stage === "UNDER18_USER_OTP" && (
            <div className="space-y-4">
              <p className="text-sm text-gray-700">
                We need to verify your email: <strong>{userEmail}</strong>.
              </p>
              {!userOtpSent ? (
                <button
                  type="button"
                  disabled={sendingUserOtp}
                  onClick={handleSendUserOtp}
                  className="w-full py-3 rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {sendingUserOtp ? "Sending..." : "Send OTP to My Email"}
                </button>
              ) : (
                <>
                  <input
                    type="text"
                    maxLength={6}
                    value={userOtp}
                    onChange={(e) => setUserOtp(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="Enter OTP sent to your email"
                  />
                  {userOtpError && (
                    <p className="text-xs text-red-500">{userOtpError}</p>
                  )}
                  <button
                    type="button"
                    disabled={verifyingUserOtp || !userOtp}
                    onClick={handleVerifyUserOtp}
                    className="w-full py-3 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {verifyingUserOtp ? "Verifying..." : "Verify My Email OTP"}
                  </button>
                  <button
                    type="button"
                    disabled={sendingUserOtp}
                    onClick={handleSendUserOtp}
                    className="text-sm text-blue-500 hover:underline"
                  >
                    {sendingUserOtp ? "Resending..." : "Resend OTP"}
                  </button>
                </>
              )}
            </div>
          )}

          {/* STAGE: Verify Guardian Email OTP */}
          {stage === "UNDER18_GUARDIAN_OTP" && (
            <div className="space-y-4">
              <p className="text-sm text-gray-700">
                We need to verify the guardian email: <strong>{guardianEmail}</strong>.
              </p>
              {!guardianOtpSent ? (
                <button
                  type="button"
                  disabled={sendingGuardianOtp}
                  onClick={handleSendGuardianOtp}
                  className="w-full py-3 rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {sendingGuardianOtp ? "Sending..." : "Send OTP to Guardian Email"}
                </button>
              ) : (
                <>
                  <input
                    type="text"
                    maxLength={6}
                    value={guardianOtp}
                    onChange={(e) => setGuardianOtp(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="Enter OTP sent to guardian email"
                  />
                  {guardianOtpError && (
                    <p className="text-xs text-red-500">{guardianOtpError}</p>
                  )}
                  <button
                    type="button"
                    disabled={verifyingGuardianOtp || !guardianOtp}
                    onClick={handleVerifyGuardianOtp}
                    className="w-full py-3 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {verifyingGuardianOtp ? "Verifying..." : "Verify Guardian Email OTP"}
                  </button>
                  <button
                    type="button"
                    disabled={sendingGuardianOtp}
                    onClick={handleSendGuardianOtp}
                    className="text-sm text-blue-500 hover:underline"
                  >
                    {sendingGuardianOtp ? "Resending..." : "Resend OTP"}
                  </button>
                </>
              )}
            </div>
          )}

          {/* OVER 18 CAMERA */}
          {stage === "OVER18_CAMERA" && (
            <div className="space-y-4">
              <p className="text-sm text-gray-700">
                Please take a clear selfie for age verification.
              </p>
              {cameraError && (
                <div className="p-3 rounded-md bg-yellow-100 text-yellow-800 text-sm border border-yellow-200">
                  {cameraError}
                </div>
              )}
              {!capturedPreview ? (
                <div className="w-full overflow-hidden rounded-lg border bg-black">
                  <video ref={videoRef} className="w-full h-auto" playsInline muted />
                </div>
              ) : (
                <div className="w-full overflow-hidden rounded-lg border">
                  <img src={capturedPreview} alt="Captured selfie" className="w-full h-auto" />
                </div>
              )}
              <canvas ref={canvasRef} className="hidden" />
            </div>
          )}

          <input type="hidden" value={ageCategory} readOnly />
        </div>

        {/* FOOTER: Guardian Consent */}
        {stage === "UNDER18" && (
          <div className="p-6 pt-4 border-t bg-white">
            <div className="flex gap-3">
              <button
                type="button"
                disabled={saving}
                onClick={() => { resetError(); setStage("AGE"); setAgeCategory(""); }}
                className="w-full py-3 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Back
              </button>
              <button
                type="button"
                disabled={saving || !under18FieldsOk || !agreeGuardian || !agreeTerms}
                onClick={handleUnder18Continue}
                className="w-full py-3 rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-gray-400 disabled:hover:bg-gray-400"
              >
                {saving ? "Saving..." : "Continue"}
              </button>
            </div>
          </div>
        )}

        {/* FOOTER: User OTP */}
        {stage === "UNDER18_USER_OTP" && (
          <div className="p-6 pt-4 border-t bg-white">
            <button
              type="button"
              disabled={verifyingUserOtp || sendingUserOtp}
              onClick={() => {
                resetError();
                setUserOtp("");
                setUserOtpSent(false);
                setUserOtpError("");
                setStage("UNDER18");
              }}
              className="w-full py-3 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              Back
            </button>
          </div>
        )}

        {/* FOOTER: Guardian OTP */}
        {stage === "UNDER18_GUARDIAN_OTP" && (
          <div className="p-6 pt-4 border-t bg-white">
            <button
              type="button"
              disabled={verifyingGuardianOtp || sendingGuardianOtp}
              onClick={() => {
                resetError();
                setGuardianOtp("");
                setGuardianOtpSent(false);
                setGuardianOtpError("");
                setUserOtp("");
                setUserOtpSent(false);
                // 2705 FIX: Go back to guardian form, not user OTP (user OTP step is skipped)
                setStage("UNDER18");
              }}
              className="w-full py-3 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              Back
            </button>
          </div>
        )}

        {/* FOOTER: Over 18 Camera */}
        {stage === "OVER18_CAMERA" && (
          <div className="p-6 pt-4 border-t bg-white">
            <div className="flex gap-3">
              {isReverify ? (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => onClose?.()}
                  className="w-full py-3 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  Close
                </button>
              ) : (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => {
                    resetError();
                    stopCamera();
                    setCapturedPreview("");
                    setCapturedFile(null);
                    setStage("AGE");
                    setAgeCategory("");
                  }}
                  className="w-full py-3 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  Back
                </button>
              )}
              {!capturedPreview ? (
                <button
                  type="button"
                  disabled={saving || !!cameraError}
                  onClick={capturePhoto}
                  className="w-full py-3 rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-gray-400"
                >
                  Capture
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={retakePhoto}
                    className="w-full py-3 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    Retake
                  </button>
                  <button
                    type="button"
                    disabled={saving || !capturedFile}
                    onClick={handleOver18Continue}
                    className="w-full py-3 rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-gray-400"
                  >
                    {saving ? "Saving..." : "Continue"}
                  </button>
                </>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default UserAgeGateConsent;