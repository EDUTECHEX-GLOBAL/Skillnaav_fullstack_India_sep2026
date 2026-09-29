import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import axios from "../../../../api/axiosInstance";
import registrationImg from "../../../../assets-webapp/school-reg.png";

const SchoolAdminRegister = () => {
  const [formData, setFormData] = useState({
    schoolName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpVerified, setOtpVerified] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const sendOtp = async () => {
    const { email, password, confirmPassword } = formData;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setErrorMessage("Please enter a valid email.");
      return;
    }

    if (!password || !confirmPassword) {
      setErrorMessage("Please enter and confirm your password first.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    try {
      setLoading(true);
      setErrorMessage("");
      setSuccessMessage("");

      const response = await axios.post("/api/school-admin/send-verification-code", { email });

      if (response.data.message) {
        setOtpSent(true);
        setSuccessMessage("OTP sent to email.");
      }
    } catch (error) {
      setErrorMessage(error.response?.data?.message || "Failed to send OTP. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    try {
      setLoading(true);
      setErrorMessage("");
      setSuccessMessage("");

      const response = await axios.post("/api/school-admin/verify-otp", {
        email: formData.email,
        otp: otp.trim(),
      });

      if (response.data.success) {
        setOtpVerified(true);
        setSuccessMessage("Email verified successfully!");
        navigate("/schooladmin/profile", { state: formData });
      }
    } catch (error) {
      setErrorMessage(error.response?.data?.message || "OTP verification failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // Registration is completed only after OTP verification
  };

  return (
    <div className="min-h-screen flex font-poppins bg-gray-100">
      {/* Left Image */}
      <div className="hidden md:block md:w-1/2">
        <img
          src={registrationImg}
          alt="Charts and Registration"
          className="h-full w-full object-cover"
        />
      </div>

      {/* Right Form Section */}
      <div className="w-full md:w-1/2 flex items-center justify-center p-8">
        <form
          className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md border border-gray-200"
          onSubmit={handleSubmit}
        >
          <h2 className="text-3xl font-bold mb-6 text-center text-blue-700">
            School Admin Registration
          </h2>

          {/* Success / Error Messages */}
          {successMessage && (
            <div className="mb-4 p-3 bg-green-100 text-green-800 rounded text-sm">
              {successMessage}
            </div>
          )}
          {errorMessage && (
            <div className="mb-4 p-3 bg-red-100 text-red-800 rounded text-sm">
              {errorMessage}
            </div>
          )}

          {/* School Name */}
          <input
            type="text"
            name="schoolName"
            placeholder="School / University Name"
            className="w-full mb-4 p-3 border border-gray-300 rounded-md"
            onChange={handleChange}
            required
          />

          {/* Email */}
          <input
            type="email"
            name="email"
            placeholder="Email"
            className="w-full mb-4 p-3 border border-gray-300 rounded-md"
            onChange={handleChange}
            required
            disabled={otpSent || otpVerified}
          />

          {/* Password */}
          <div className="relative mb-4">
            <input
              type={showPassword ? "text" : "password"}
              name="password"
              placeholder="Password"
              className="w-full p-3 border border-gray-300 rounded-md"
              onChange={handleChange}
              required
            />
            <button
              type="button"
              className="absolute top-1/2 right-4 transform -translate-y-1/2 text-gray-500"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <FaEyeSlash size={20} /> : <FaEye size={20} />}
            </button>
          </div>

          {/* Confirm Password */}
          <div className="relative mb-6">
            <input
              type={showConfirm ? "text" : "password"}
              name="confirmPassword"
              placeholder="Confirm Password"
              className="w-full p-3 border border-gray-300 rounded-md"
              onChange={handleChange}
              required
            />
            <button
              type="button"
              className="absolute top-1/2 right-4 transform -translate-y-1/2 text-gray-500"
              onClick={() => setShowConfirm(!showConfirm)}
            >
              {showConfirm ? <FaEyeSlash size={20} /> : <FaEye size={20} />}
            </button>
          </div>

          {/* Send OTP Button */}
          {!otpVerified && (
            <button
              type="button"
              className="w-full bg-blue-500 text-white py-2 rounded-md mb-4 hover:bg-blue-600"
              onClick={sendOtp}
              disabled={loading || otpSent}
            >
              {loading ? "Sending OTP..." : otpSent ? "OTP Sent" : "Send OTP"}
            </button>
          )}

          {/* OTP Input */}
          {otpSent && !otpVerified && (
            <>
              <input
                type="text"
                name="otp"
                placeholder="Enter OTP"
                className="w-full mb-4 p-3 border border-gray-300 rounded-md"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
              />
              <button
                type="button"
                className="w-full bg-green-500 text-white py-2 rounded-md mb-4 hover:bg-green-600"
                onClick={verifyOtp}
                disabled={loading}
              >
                {loading ? "Verifying..." : "Verify OTP"}
              </button>
            </>
          )}

          {/* Sign In Redirect */}
          <div className="text-center mt-4 text-sm text-gray-600">
            Already have an account?
            <button
              type="button"
              onClick={() => navigate("/schooladmin/login")}
              className="ml-1 text-blue-600 font-semibold hover:underline"
            >
              Sign in here
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SchoolAdminRegister;
