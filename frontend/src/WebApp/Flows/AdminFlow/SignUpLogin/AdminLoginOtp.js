import React, { useEffect, useMemo, useState } from "react";
import { Formik, Form, Field, ErrorMessage } from "formik";
import * as Yup from "yup";
import { useNavigate, useLocation, Link } from "react-router-dom";
import axios from "../../../../api/axiosInstance";
import adminImage from "../../../../assets-webapp/partner.jpg";

const validationSchema = Yup.object({
  otp: Yup.string()
    .required("Required")
    .matches(/^\d{6}$/, "OTP must be 6 digits"),
});

const AdminLoginOtp = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState("");
  //Add this below 3 for resend otp - 18-08-2026
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(60);
  const [resendMessage, setResendMessage] = useState("");

  const email = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get("email") || "";
  }, [location.search]);

  //Add this cooldown for resend otp - 18-08-2026
  useEffect(() => {
    if (resendCooldown <= 0) return;

    const timer = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [resendCooldown]);

  // 18-08-2026
  const handleResendOtp = async () => {
    if (!email || resendCooldown > 0 || resendLoading) {
      return;
    }

    setError("");
    setResendMessage("");
    setResendLoading(true);

    try {
      const { data } = await axios.post("/api/admin/resend-login-otp", {
        email,
      });

      setResendMessage(
        data.message || "A new OTP has been sent to your email.",
      );
      setTimeout(() => {
        setResendMessage("");
      }, 10000);
      setResendCooldown(60);
    } catch (err) {
      const message =
        err.response?.data?.message ||
        "Unable to resend OTP. Please try again.";

      setError(message);

      // If backend sends retryAfter, sync frontend timer with it
      if (err.response?.data?.retryAfter) {
        setResendCooldown(err.response.data.retryAfter);
      }
    } finally {
      setResendLoading(false);
    }
  };

  const handleSubmit = async (values, { setSubmitting }) => {
    setError("");
    try {
      const { data } = await axios.post("/api/admin/verify-login-otp", {
        email,
        otp: values.otp,
      });

      // ✅ Store token and admin info (same as AdminLogin.js)
      localStorage.setItem("adminToken", data.token);
      localStorage.setItem(
        "adminInfo",
        JSON.stringify({
          id: data.id,
          name: data.name,
          email: data.email,
          isAdmin: data.isAdmin,
          pic: data.pic,
        }),
      );

      navigate("/admin-main-page");
    } catch (err) {
      setError(err.response?.data?.message || "OTP verification failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row min-h-screen font-poppins">
      <div className="hidden lg:flex lg:w-1/2 items-center justify-center">
        <img
          src={adminImage}
          alt="Admin OTP"
          className="w-full h-full object-cover"
        />
      </div>

      <div className="flex flex-col items-center justify-center p-8 w-full lg:w-1/2 bg-white">
        <div className="w-full max-w-md">
          <h1 className="text-3xl font-extrabold mb-2 text-center text-gray-800">
            Enter Login OTP
          </h1>
          <p className="text-center text-gray-600 mb-6">
            OTP has been sent to your email.
          </p>

          {/*18-08-2026 */}
          {resendMessage && (
            <div className="text-green-600 text-sm text-center mt-3">
              {resendMessage}
            </div>
          )}

          {!email && (
            <div className="bg-yellow-100 text-yellow-800 p-3 mb-4 text-center rounded-lg">
              Email missing. Please login again.
            </div>
          )}

          {error && (
            <div className="bg-red-200 text-red-600 p-3 mb-4 text-center rounded-lg">
              {error}
            </div>
          )}

          <Formik
            initialValues={{ otp: "" }}
            validationSchema={validationSchema}
            onSubmit={handleSubmit}
          >
            {({ isSubmitting }) => (
              <Form className="space-y-4">
                <div className="relative">
                  <input
                    type="email"
                    value={email}
                    readOnly
                    className="w-full p-4 border border-gray-200 bg-gray-50 rounded-lg"
                  />
                </div>

                <div className="relative">
                  <Field
                    type="text"
                    name="otp"
                    placeholder="Enter 6-digit OTP"
                    className="w-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400"
                  />
                  <ErrorMessage
                    name="otp"
                    component="div"
                    className="text-red-500 text-sm mt-1"
                  />
                </div>

                {/*Add this for resend otp - 18-08-2026*/}
                <div className="text-right">
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={!email || resendCooldown > 0 || resendLoading}
                    className="text-blue-600 hover:underline text-sm disabled:text-gray-400 disabled:no-underline"
                  >
                    {resendLoading
                      ? "Sending..."
                      : resendCooldown > 0
                        ? `Resend OTP in ${resendCooldown}s`
                        : "Resend OTP"}
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || !email}
                  className="w-full bg-blue-500 text-white p-4 rounded-lg hover:bg-blue-600 transition-colors duration-300 shadow-md disabled:bg-blue-300"
                >
                  {isSubmitting ? "Verifying..." : "Verify & Continue"}
                </button>

                <div className="text-center">
                  <Link
                    to="/admin/login"
                    className="text-blue-600 hover:underline text-sm"
                  >
                    Back to Login
                  </Link>
                </div>
              </Form>
            )}
          </Formik>
        </div>
      </div>
    </div>
  );
};

export default AdminLoginOtp;
