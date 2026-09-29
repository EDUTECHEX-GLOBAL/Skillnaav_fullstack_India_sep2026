import React, { useEffect, useRef, useState } from "react";
import axios from "../../../../api/axiosInstance";

const OTP_EXPIRY_SECONDS = 300;
const OTP_RESEND_COOLDOWN_SECONDS = 60; //1 minute -- 18-08-2026

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
    width="16"
    height="16"
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
    if (/[@$!%?&]/.test(pwd)) score++;
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

const SchoolAdminForgotPassword = ({ onClose }) => {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [otpDigits, setOtpDigits] = useState(["", "", "", "", "", ""]);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [step, setStep] = useState(1);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  //18-08-2026
  const [resendCooldown, setResendCooldown] = useState(0);
  const [canResend, setCanResend] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const otpRefs = useRef([]);
  const timerRef = useRef(null);
  //18-08-2026
  const resendTimerRef = useRef(null);

  const isValidPassword = (password) => {
    const passwordRegex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%?&])[A-Za-z\d@$!%*?&]{8,}$/;
    return passwordRegex.test(password);
  };

  // const startTimer = () => {
  //   setTimeLeft(OTP_EXPIRY_SECONDS);
  //   setCanResend(false);

  //   if (timerRef.current) clearInterval(timerRef.current);

  //   timerRef.current = setInterval(() => {
  //     setTimeLeft((prev) => {
  //       if (prev <= 1) {
  //         clearInterval(timerRef.current);
  //         setCanResend(true);
  //         return 0;
  //       }
  //       return prev - 1;
  //     });
  //   }, 1000);
  // };

  //18-08-2026
  const startTimer = () => {
    setTimeLeft(OTP_EXPIRY_SECONDS);

    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          return 0;
        }

        return prev - 1;
      });
    }, 1000);

    setResendCooldown(OTP_RESEND_COOLDOWN_SECONDS);
    setCanResend(false);

    if (resendTimerRef.current) {
      clearInterval(resendTimerRef.current);
    }

    resendTimerRef.current = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(resendTimerRef.current);
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

    const joined = updated.join("");
    setOtp(joined);

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
      const response = await axios.post("/api/school-admin/forgot-password", {
        email: email.trim(),
      });

      setMessage(response.data.message || "OTP sent to your email.");
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
    setOtp("");
    setOtpDigits(["", "", "", "", "", ""]);
    setIsLoading(true);

    try {
      await axios.post("/api/school-admin/forgot-password", {
        email: email.trim(),
      });
      setMessage("A new OTP has been sent to your email.");
      startTimer();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to resend OTP.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleContinueFromOtp = async (e) => {
    e.preventDefault();
    setMessage("");
    setError("");

    if (otp.length < 6) {
      setError("Please enter the complete 6-digit OTP.");
      return;
    }

    // setStep(3);
    //Add this below for otp verification in step-2 -- 19-08-2026
    setIsLoading(true);

    try {
      const response = await axios.post("/api/school-admin/verify-reset-otp", {
        email: email.trim(),
        otp: otp.trim(),
      });

      //setMessage(response.data.message || "OTP verified successfully.");

      setStep(3);
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

    setIsLoading(true);

    try {
      const response = await axios.post("/api/school-admin/reset-password", {
        email: email.trim(),
        otp: otp.trim(),
        newPassword,
      });

      setMessage(
        response.data.message || "Password has been successfully updated.",
      );

      if (timerRef.current) clearInterval(timerRef.current);

      setTimeout(() => {
        onClose?.();
      }, 2200);
    } catch (err) {
      setError(err.response?.data?.message || "Invalid or expired OTP.");
      setStep(2);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      //18-08-2026
      if (resendTimerRef.current) {
        clearInterval(resendTimerRef.current);
      }
    };
  }, []);

  const stepTitles = {
    1: {
      title: "Forgot password?",
      subtitle: "Enter your email and we'll send you a code",
      icon: <MailIcon />,
    },
    2: {
      title: "Check your email",
      subtitle: `We sent a 6-digit code to ${email}`,
      icon: <ShieldIcon />,
    },
    3: {
      title: "New password",
      subtitle: "Choose a strong password for your school admin account",
      icon: <LockIcon />,
    },
  };

  const { title, subtitle, icon } = stepTitles[step];

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

  return (
    <div style={{ width: "100%" }}>
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity:0; transform:translateY(6px); }
          to { opacity:1; transform:translateY(0); }
        }
        .fp-input:focus {
          border-color: #2563eb !important;
          box-shadow: 0 0 0 3px rgba(37,99,235,0.10) !important;
          background: #fff !important;
        }
        .fp-btn-primary {
          background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
          color: #fff;
        }
        .fp-btn-primary:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(37,99,235,0.30);
        }
        .fp-btn-primary:disabled { opacity: 0.65; }
        .fp-otp-box:focus {
          border-color: #2563eb !important;
          box-shadow: 0 0 0 3px rgba(37,99,235,0.12) !important;
          background: #fff !important;
        }
        .fp-otp-box.filled {
          border-color: #2563eb;
          background: #eff6ff;
          color: #1d4ed8;
        }
        .fp-eye-btn:hover { color: #2563eb; }
        .fp-step-dot { width:8px; height:8px; border-radius:50%; transition: all 0.3s; }
      `}</style>

      <div style={{ animation: "fadeSlideIn 0.3s ease" }}>
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
              background: "linear-gradient(135deg, #dbeafe, #bfdbfe)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#2563eb",
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

        <div
          style={{
            display: "flex",
            gap: "6px",
            marginTop: "16px",
            marginBottom: "20px",
            alignItems: "center",
          }}
        >
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className="fp-step-dot"
              style={{
                backgroundColor:
                  s === step ? "#2563eb" : s < step ? "#93c5fd" : "#e5e7eb",
                width: s === step ? "20px" : "8px",
                borderRadius: s === step ? "4px" : "50%",
              }}
            />
          ))}
        </div>

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
                Email address
              </label>
              <input
                className="fp-input"
                type="email"
                placeholder="schooladmin@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={inputBase}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="fp-btn-primary"
              style={btnBase}
            >
              {isLoading ? "Sending…" : "Send verification code"}
            </button>
          </form>
        )}

        {step === 2 && (
          <form
            onSubmit={handleContinueFromOtp}
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
                    className={`fp-otp-box${digit ? " filled" : ""}`}
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
                      backgroundColor: digit ? "#eff6ff" : "#fafafa",
                      color: digit ? "#1d4ed8" : "#111827",
                      caretColor: "#2563eb",
                    }}
                  />
                ))}
              </div>
            </div>

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
                      color: timeLeft < 30 ? "#ef4444" : "#2563eb",
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
                  color: canResend ? "#2563eb" : "#9ca3af",
                  fontFamily: "inherit",
                }}
              >
                {/*18-08-2026 replace "Resend Code" with below one */}
                {canResend
                  ? "Resend code"
                  : `Resend in ${formatTime(resendCooldown)}`}
              </button>
            </div>

            <button
              type="submit"
              disabled={isLoading || otp.length < 6}
              className="fp-btn-primary"
              style={btnBase}
            >
              {/* Continue */}
              {isLoading ? "Verifying…" : "Verify OTP"}
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

        {step === 3 && (
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
                  className="fp-input"
                  type={showNewPassword ? "text" : "password"}
                  placeholder="At least 8 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  style={{ ...inputBase, paddingRight: "44px" }}
                />
                <button
                  type="button"
                  className="fp-eye-btn"
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
                  className="fp-input"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Re-enter your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  style={{
                    ...inputBase,
                    paddingRight: "44px",
                    borderColor:
                      confirmPassword && confirmPassword !== newPassword
                        ? "#fca5a5"
                        : undefined,
                  }}
                />
                <button
                  type="button"
                  className="fp-eye-btn"
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
                { label: "Uppercase letter", test: /[A-Z]/.test(newPassword) },
                { label: "Lowercase letter", test: /[a-z]/.test(newPassword) },
                { label: "Number", test: /\d/.test(newPassword) },
                {
                  label: "Special character (@$!%?&)",
                  test: /[@$!%?&]/.test(newPassword),
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
              className="fp-btn-primary"
              style={btnBase}
            >
              {isLoading ? "Updating…" : "Reset password"}
            </button>

            <button
              type="button"
              onClick={() => setStep(2)}
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
              ← Back to code
            </button>
          </form>
        )}

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
              style={{ margin: "0 0 12px", fontSize: "13px", color: "#6b7280" }}
            >
              Redirecting you to login…
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SchoolAdminForgotPassword;
