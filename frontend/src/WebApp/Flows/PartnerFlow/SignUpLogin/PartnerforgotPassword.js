import React, { useState, useEffect, useRef } from "react";
import axios from "../../../../api/axiosInstance";

const OTP_EXPIRY_SECONDS = 300; // 5 minutes
const RESEND_COOLDOWN_SECONDS = 60; // 1 minute
const EyeIcon = ({ open }) =>
  open ? (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );

const CheckCircleIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

const MailIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
    <polyline points="22,6 12,13 2,6" />
  </svg>
);

const LockIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const ShieldIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const PasswordStrengthBar = ({ password }) => {
  const getStrength = (pwd) => {
    let score = 0;
    if (pwd.length >= 8) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[a-z]/.test(pwd)) score++;
    if (/\d/.test(pwd)) score++;
    if (/[@$!%*?&]/.test(pwd)) score++;
    return score;
  };

  const score = getStrength(password);
  const labels = ["", "Weak", "Fair", "Good", "Strong", "Very strong"];
  const colors = ["", "#ef4444", "#f97316", "#eab308", "#22c55e", "#10b981"];

  if (!password) return null;

  return (
    <div style={{ marginTop: "6px" }}>
      <div style={{ display: "flex", gap: "4px", marginBottom: "4px" }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: "3px",
              borderRadius: "99px",
              backgroundColor: i <= score ? colors[score] : "#e5e7eb",
              transition: "background-color 0.3s ease",
            }}
          />
        ))}
      </div>
      <p
        style={{
          fontSize: "11px",
          color: colors[score],
          fontWeight: "500",
          margin: 0,
        }}
      >
        {labels[score]}
      </p>
    </div>
  );
};

const PartnerForgotPasswordModal = ({ isOpen, onClose }) => {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [step, setStep] = useState(1);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [otpVerified, setOtpVerified] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [canResend, setCanResend] = useState(false);
  //18-08-2026
  const [resendTimeLeft, setResendTimeLeft] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [otpDigits, setOtpDigits] = useState(["", "", "", "", "", ""]);
  const otpRefs = useRef([]);
  const timerRef = useRef(null);

  const isValidPassword = (password) => {
    const passwordRegex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    return passwordRegex.test(password);
  };

  const startTimer = () => {
    setTimeLeft(OTP_EXPIRY_SECONDS);
    //18-08-2026
    setResendTimeLeft(RESEND_COOLDOWN_SECONDS);
    setCanResend(false);
    if (timerRef.current) clearInterval(timerRef.current);
    // timerRef.current = setInterval(() => {
    //   setTimeLeft((prev) => {
    //     if (prev <= 1) {
    //       clearInterval(timerRef.current);
    //       setCanResend(true);
    //       return 0;
    //     }
    //     return prev - 1;
    //   });
    // }, 1000);
    //18-08-2026
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => Math.max(prev - 1, 0));

      setResendTimeLeft((prev) => {
        if (prev <= 1) {
          setCanResend(true);
          return 0;
        }

        return prev - 1;
      });
    }, 1000);
  };

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60)
      .toString()
      .padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const handleOtpDigitChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    const updated = [...otpDigits];
    updated[index] = value.slice(-1);
    setOtpDigits(updated);
    setOtp(updated.join(""));
    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === "Backspace" && !otpDigits[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, 6);
    const updated = pasted.split("").concat(Array(6).fill("")).slice(0, 6);
    setOtpDigits(updated);
    setOtp(updated.join(""));
    const nextEmpty = updated.findIndex((d) => !d);
    otpRefs.current[nextEmpty === -1 ? 5 : nextEmpty]?.focus();
  };

  const handleRequestOtp = async (e) => {
    e.preventDefault();
    setMessage("");
    setError("");
    setIsLoading(true);
    try {
      // ✅ Partner-specific endpoint
      const response = await axios.post(
        "/api/partners/request-password-reset",
        { email },
      );
      setMessage(response.data.message);
      setStep(2);
      startTimer();
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (!canResend) return;
    setMessage("");
    setError("");
    setOtpDigits(["", "", "", "", "", ""]);
    setOtp("");
    setIsLoading(true);
    try {
      const response = await axios.post(
        "/api/partners/request-password-reset",
        { email },
      );
      //   setMessage("A new OTP has been sent to your email.");
      //   startTimer();
      // } catch (err) {
      setMessage(
        response.data.message || "A new OTP has been sent to your email.",
      );

      // Restart both timers
      startTimer();

      // Focus first OTP input
      setTimeout(() => {
        otpRefs.current[0]?.focus();
      }, 100);
    } catch (err) {
      const retryAfter = err.response?.data?.retryAfter;

      if (retryAfter) {
        setResendTimeLeft(retryAfter);
        setCanResend(false);
      }

      setError(err.response?.data?.message || "Failed to resend OTP.");
    } finally {
      setIsLoading(false);
    }
  };

  // ✅ NOW calls the backend for real OTP validation
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setMessage("");
    setError("");

    const finalOtp = otpDigits.join("").trim(); // ✅ always latest

    if (finalOtp.length !== 6) {
      setError("Please enter the complete 6-digit OTP.");
      return;
    }

    setIsLoading(true);
    try {
      const response = await axios.post("/api/partners/verify-reset-otp", {
        email,
        otp: finalOtp,
      });

      setMessage(response.data.message);
      setOtpVerified(true);

      //if (timerRef.current) clearInterval(timerRef.current);
      //18-08-2026
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      setTimeLeft(0);
      setResendTimeLeft(0);
      setCanResend(false);
    } catch (err) {
      setError(err.response?.data?.message || "Invalid or expired OTP.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setMessage("");
    setError("");

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (!isValidPassword(newPassword)) {
      setError(
        "Password must be at least 8 characters with uppercase, lowercase, number, and special character.",
      );
      return;
    }

    const finalOtp = otpDigits.join("").trim();

    setIsLoading(true);
    try {
      const response = await axios.post(
        "/api/partners/verify-otp-reset-password",
        {
          email,
          otp: otp || finalOtp,
          newPassword,
        },
      );

      setMessage(response.data.message);
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (message.includes("successfully updated")) {
      const timer = setTimeout(() => onClose(), 2500);
      return () => clearTimeout(timer);
    }
  }, [message, onClose]);

  useEffect(() => {
    if (!isOpen) {
      setEmail("");
      setOtp("");
      setOtpDigits(["", "", "", "", "", ""]);
      setNewPassword("");
      setConfirmPassword("");
      setStep(1);
      setMessage("");
      setError("");
      setOtpVerified(false);
      setShowNewPassword(false);
      setShowConfirmPassword(false);
      setTimeLeft(0);
      setResendTimeLeft(0); //18-08-2026
      setCanResend(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  if (!isOpen) return null;

  const currentStep = otpVerified ? 3 : step;

  const stepMeta = {
    1: {
      title: "Forgot password?",
      subtitle: "Enter your partner email to receive a code",
      icon: <MailIcon />,
    },
    2: {
      title: "Check your email",
      subtitle: `We sent a 6-digit code to ${email}`,
      icon: <ShieldIcon />,
    },
    3: {
      title: "New password",
      subtitle: "Choose a strong password for your account",
      icon: <LockIcon />,
    },
  };
  const { title, subtitle, icon } = stepMeta[currentStep];

  const inputBase = {
    width: "100%",
    padding: "11px 14px",
    border: "1.5px solid #e5e7eb",
    borderRadius: "10px",
    fontSize: "14px",
    outline: "none",
    transition: "border-color 0.2s, box-shadow 0.2s",
    boxSizing: "border-box",
    color: "#111827",
    backgroundColor: "#fafafa",
    fontFamily: "inherit",
  };

  const btnBase = {
    width: "100%",
    padding: "12px",
    borderRadius: "10px",
    border: "none",
    fontSize: "14px",
    fontWeight: "600",
    cursor: isLoading ? "not-allowed" : "pointer",
    transition: "all 0.2s",
    letterSpacing: "0.01em",
    fontFamily: "inherit",
  };

  // Partner brand accent: teal instead of indigo
  const accent = "#0d9488";
  const accentLight = "#ccfbf1";
  const accentMid = "#14b8a6";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.45)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
        padding: "16px",
      }}
    >
      <div
        style={{
          backgroundColor: "#fff",
          borderRadius: "20px",
          boxShadow: "0 24px 60px rgba(0,0,0,0.15)",
          width: "100%",
          maxWidth: "420px",
          overflow: "hidden",
          animation: "modalIn 0.25s cubic-bezier(0.34,1.56,0.64,1)",
        }}
      >
        <style>{`
                    @keyframes modalIn { from { opacity:0; transform:scale(0.94) translateY(8px); } to { opacity:1; transform:scale(1) translateY(0); } }
                    @keyframes fadeSlideIn { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
                    .pfp-input:focus { border-color: ${accent} !important; box-shadow: 0 0 0 3px rgba(13,148,136,0.1) !important; background: #fff !important; }
                    .pfp-btn-primary { background: linear-gradient(135deg, ${accentMid} 0%, ${accent} 100%); color: #fff; }
                    .pfp-btn-primary:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(13,148,136,0.35); }
                    .pfp-btn-primary:active:not(:disabled) { transform: translateY(0); }
                    .pfp-btn-primary:disabled { opacity: 0.65; }
                    .pfp-otp-box:focus { border-color: ${accent} !important; box-shadow: 0 0 0 3px rgba(13,148,136,0.12) !important; background: #fff !important; }
                    .pfp-otp-box.filled { border-color: ${accent}; background: #f0fdfa; color: #0f766e; }
                    .pfp-eye-btn:hover { color: ${accent}; }
                    .pfp-step-dot { width:8px; height:8px; border-radius:50%; transition: all 0.3s; }
                `}</style>

        {/* Header */}
        <div style={{ padding: "28px 28px 0" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                marginBottom: "4px",
              }}
            >
              <div
                style={{
                  width: "38px",
                  height: "38px",
                  borderRadius: "10px",
                  background: `linear-gradient(135deg, #f0fdfa, ${accentLight})`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: accent,
                  flexShrink: 0,
                }}
              >
                {icon}
              </div>
              <div>
                <h2
                  style={{
                    margin: 0,
                    fontSize: "18px",
                    fontWeight: "700",
                    color: "#111827",
                    lineHeight: 1.2,
                  }}
                >
                  {title}
                </h2>
                <p
                  style={{
                    margin: "3px 0 0",
                    fontSize: "12.5px",
                    color: "#6b7280",
                    lineHeight: 1.4,
                  }}
                >
                  {subtitle}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "#9ca3af",
                fontSize: "20px",
                lineHeight: 1,
                padding: "2px 4px",
                borderRadius: "6px",
                transition: "color 0.15s",
              }}
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          {/* Step dots */}
          <div
            style={{
              display: "flex",
              gap: "6px",
              marginTop: "16px",
              alignItems: "center",
            }}
          >
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className="pfp-step-dot"
                style={{
                  backgroundColor:
                    s === currentStep
                      ? accent
                      : s < currentStep
                        ? accentMid
                        : "#e5e7eb",
                  width: s === currentStep ? "20px" : "8px",
                  borderRadius: s === currentStep ? "4px" : "50%",
                }}
              />
            ))}
          </div>
        </div>

        {/* Body */}
        <div
          style={{
            padding: "20px 28px 28px",
            animation: "fadeSlideIn 0.3s ease",
          }}
        >
          {/* Alerts */}
          {error && (
            <div
              style={{
                backgroundColor: "#fef2f2",
                border: "1px solid #fecaca",
                color: "#dc2626",
                padding: "10px 14px",
                borderRadius: "10px",
                marginBottom: "16px",
                fontSize: "13px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <span style={{ fontSize: "16px" }}>⚠</span> {error}
            </div>
          )}
          {message && !message.includes("successfully updated") && (
            <div
              style={{
                backgroundColor: "#f0fdf4",
                border: "1px solid #bbf7d0",
                color: "#16a34a",
                padding: "10px 14px",
                borderRadius: "10px",
                marginBottom: "16px",
                fontSize: "13px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <CheckCircleIcon /> {message}
            </div>
          )}

          {/* STEP 1 — Email */}
          {step === 1 && (
            <form
              onSubmit={handleRequestOtp}
              style={{ display: "flex", flexDirection: "column", gap: "14px" }}
            >
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "13px",
                    fontWeight: "600",
                    color: "#374151",
                    marginBottom: "6px",
                  }}
                >
                  Partner email address
                </label>
                <input
                  className="pfp-input"
                  type="email"
                  placeholder="you@institution.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  style={inputBase}
                />
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="pfp-btn-primary"
                style={btnBase}
              >
                {isLoading ? "Sending…" : "Send verification code"}
              </button>
            </form>
          )}

          {/* STEP 2 — OTP */}
          {step === 2 && !otpVerified && (
            <form
              onSubmit={handleVerifyOtp}
              style={{ display: "flex", flexDirection: "column", gap: "16px" }}
            >
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "13px",
                    fontWeight: "600",
                    color: "#374151",
                    marginBottom: "10px",
                  }}
                >
                  Verification code
                </label>
                <div
                  style={{
                    display: "flex",
                    gap: "8px",
                    justifyContent: "center",
                  }}
                  onPaste={handleOtpPaste}
                >
                  {otpDigits.map((digit, i) => (
                    <input
                      key={i}
                      ref={(el) => (otpRefs.current[i] = el)}
                      className={`pfp-otp-box${digit ? " filled" : ""}`}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpDigitChange(i, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(i, e)}
                      style={{
                        width: "44px",
                        height: "52px",
                        padding: "0px", //Add this for alignment 18-08-2026
                        textAlign: "center",
                        fontSize: "20px",
                        fontWeight: "700",
                        border: "1.5px solid #e5e7eb",
                        borderRadius: "10px",
                        outline: "none",
                        transition: "all 0.2s",
                        backgroundColor: digit ? "#f0fdfa" : "#fafafa",
                        color: digit ? "#0f766e" : "#111827",
                        caretColor: accent,
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Timer + Resend */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                {timeLeft > 0 ? (
                  <p style={{ margin: 0, fontSize: "13px", color: "#6b7280" }}>
                    Code expires in{" "}
                    <span
                      style={{
                        color: timeLeft < 30 ? "#ef4444" : accent,
                        fontWeight: "600",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {formatTime(timeLeft)}
                    </span>
                  </p>
                ) : (
                  <p style={{ margin: 0, fontSize: "13px", color: "#ef4444" }}>
                    Code expired
                  </p>
                )}
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={!canResend || isLoading}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: canResend ? "pointer" : "not-allowed",
                    fontSize: "13px",
                    fontWeight: "600",
                    padding: 0,
                    color: canResend ? accent : "#9ca3af",
                    transition: "color 0.2s",
                    fontFamily: "inherit",
                  }}
                >
                  {/*18-08-2026 */}
                  {canResend
                    ? "Resend code"
                    : `Resend code in ${formatTime(resendTimeLeft)}`}
                </button>
              </div>

              <button
                type="submit"
                disabled={isLoading || otp.length < 6}
                className="pfp-btn-primary"
                style={btnBase}
              >
                {isLoading ? "Verifying…" : "Verify code"}
              </button>

              <button
                type="button"
                onClick={() => setStep(1)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "13px",
                  color: "#6b7280",
                  textAlign: "center",
                  padding: "4px",
                  fontFamily: "inherit",
                }}
              >
                ← Use a different email
              </button>
            </form>
          )}

          {/* STEP 3 — New password */}
          {otpVerified && (
            <form
              onSubmit={handleResetPassword}
              style={{ display: "flex", flexDirection: "column", gap: "14px" }}
            >
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "13px",
                    fontWeight: "600",
                    color: "#374151",
                    marginBottom: "6px",
                  }}
                >
                  New password
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    className="pfp-input"
                    type={showNewPassword ? "text" : "password"}
                    placeholder="At least 8 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    style={{
                      ...inputBase,
                      paddingRight: "44px",
                      margin: "0px",
                    }}
                  />
                  <button
                    type="button"
                    className="pfp-eye-btn"
                    onClick={() => setShowNewPassword((p) => !p)}
                    style={{
                      position: "absolute",
                      right: "12px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "#9ca3af",
                      padding: "2px",
                      display: "flex",
                      transition: "color 0.15s",
                    }}
                    aria-label={
                      showNewPassword ? "Hide password" : "Show password"
                    }
                  >
                    <EyeIcon open={showNewPassword} />
                  </button>
                </div>
                <PasswordStrengthBar password={newPassword} />
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "13px",
                    fontWeight: "600",
                    color: "#374151",
                    marginBottom: "6px",
                  }}
                >
                  Confirm password
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    className="pfp-input"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Re-enter your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    style={{
                      ...inputBase,
                      paddingRight: "44px",
                      margin: "0px",
                      borderColor:
                        confirmPassword && confirmPassword !== newPassword
                          ? "#fca5a5"
                          : undefined,
                    }}
                  />
                  <button
                    type="button"
                    className="pfp-eye-btn"
                    onClick={() => setShowConfirmPassword((p) => !p)}
                    style={{
                      position: "absolute",
                      right: "12px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "#9ca3af",
                      padding: "2px",
                      display: "flex",
                      transition: "color 0.15s",
                    }}
                    aria-label={
                      showConfirmPassword ? "Hide password" : "Show password"
                    }
                  >
                    <EyeIcon open={showConfirmPassword} />
                  </button>
                </div>
                {confirmPassword && confirmPassword !== newPassword && (
                  <p
                    style={{
                      fontSize: "12px",
                      color: "#ef4444",
                      margin: "4px 0 0",
                    }}
                  >
                    Passwords don't match
                  </p>
                )}
                {confirmPassword && confirmPassword === newPassword && (
                  <p
                    style={{
                      fontSize: "12px",
                      color: "#16a34a",
                      margin: "4px 0 0",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <CheckCircleIcon /> Passwords match
                  </p>
                )}
              </div>

              {/* Password requirements checklist */}
              <div
                style={{
                  background: "#f9fafb",
                  borderRadius: "10px",
                  padding: "10px 12px",
                }}
              >
                <p
                  style={{
                    margin: "0 0 6px",
                    fontSize: "12px",
                    fontWeight: "600",
                    color: "#6b7280",
                  }}
                >
                  Password must include:
                </p>
                {[
                  { label: "8+ characters", test: newPassword.length >= 8 },
                  {
                    label: "Uppercase letter",
                    test: /[A-Z]/.test(newPassword),
                  },
                  {
                    label: "Lowercase letter",
                    test: /[a-z]/.test(newPassword),
                  },
                  { label: "Number", test: /\d/.test(newPassword) },
                  {
                    label: "Special character (@$!%*?&)",
                    test: /[@$!%*?&]/.test(newPassword),
                  },
                ].map(({ label, test }) => (
                  <div
                    key={label}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      marginBottom: "3px",
                    }}
                  >
                    <div
                      style={{
                        width: "14px",
                        height: "14px",
                        borderRadius: "50%",
                        flexShrink: 0,
                        backgroundColor: test ? "#dcfce7" : "#f3f4f6",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        transition: "background-color 0.2s",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "9px",
                          color: test ? "#16a34a" : "#9ca3af",
                        }}
                      >
                        {test ? "✓" : "·"}
                      </span>
                    </div>
                    <span
                      style={{
                        fontSize: "12px",
                        color: test ? "#374151" : "#9ca3af",
                        transition: "color 0.2s",
                      }}
                    >
                      {label}
                    </span>
                  </div>
                ))}
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="pfp-btn-primary"
                style={btnBase}
              >
                {isLoading ? "Updating…" : "Reset password"}
              </button>
            </form>
          )}

          {/* Success state */}
          {message.includes("successfully updated") && (
            <div
              style={{
                marginTop: "16px",
                textAlign: "center",
                padding: "16px",
                background: "#f0fdf4",
                borderRadius: "12px",
                animation: "fadeSlideIn 0.3s ease",
              }}
            >
              <div style={{ fontSize: "32px", marginBottom: "8px" }}>🎉</div>
              <p
                style={{
                  margin: "0 0 4px",
                  fontWeight: "700",
                  color: "#15803d",
                  fontSize: "15px",
                }}
              >
                Password updated!
              </p>
              <p
                style={{
                  margin: "0 0 12px",
                  fontSize: "13px",
                  color: "#6b7280",
                }}
              >
                Redirecting you to partner login…
              </p>
              <a
                href="/partner/login"
                style={{
                  display: "inline-block",
                  fontSize: "13px",
                  fontWeight: "600",
                  color: accent,
                  textDecoration: "none",
                  padding: "6px 16px",
                  border: `1.5px solid ${accentLight}`,
                  borderRadius: "8px",
                }}
              >
                Go to partner login →
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PartnerForgotPasswordModal;
