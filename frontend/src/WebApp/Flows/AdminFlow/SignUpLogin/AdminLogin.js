// File: AdminLogin.js

import React, { useState } from "react";
import { Formik, Form, Field, ErrorMessage } from "formik";
import * as Yup from "yup";
import { useNavigate, Link } from "react-router-dom";
import axios from "../../../../api/axiosInstance";
import Loading from "../../../Warnings/Loading/Loading";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEye, faEyeSlash } from "@fortawesome/free-solid-svg-icons";
import adminImage from "../../../../assets-webapp/partner.jpg";

// Validation schema for Formik
const validationSchema = Yup.object({
  email: Yup.string().email("Invalid email address").required("Required"),
  password: Yup.string().required("Required"),
});

const AdminLogin = () => {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (values, { setSubmitting }) => {
    setError("");
    setLoading(true);

    try {
      // API configuration
      const config = {
        headers: {
          "Content-Type": "application/json",
        },
      };

      // ✅ Call login API first, then use data
      const response = await axios.post("/api/admin/login", values, config);
      const data = response.data;

      console.log("Login response:", data);

      // ✅ If OTP is required, go to OTP page (do not store token yet)
      if (data?.otpRequired) {
        navigate(`/admin/login-otp?email=${encodeURIComponent(values.email)}`);
        return;
      }

      // ✅ Fallback: if backend returns token directly
      localStorage.setItem("adminToken", data.token);
      localStorage.setItem(
        "adminInfo",
        JSON.stringify({
          id: data.id,
          name: data.name,
          email: data.email,
          isAdmin: data.isAdmin,
          pic: data.pic,
        })
      );

      navigate("/admin-main-page");
    } catch (err) {
      console.error("Login error:", err.response || err.message);
      setError(err.response?.data?.message || "Login failed. Please try again.");
    } finally {
      setLoading(false);
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row min-h-screen font-poppins">
      <div className="hidden lg:flex lg:w-1/2 items-center justify-center">
        <img src={adminImage} alt="Admin Login" className="w-full h-full object-cover" />
      </div>

      <div className="flex flex-col items-center justify-center p-8 w-full lg:w-1/2 bg-white">
        <div className="w-full max-w-md">
          <h1 className="text-3xl font-extrabold mb-4 text-center text-gray-800">Admin Login</h1>
          <h2 className="text-lg font-medium mb-6 text-center text-gray-600">Sign in to access the dashboard</h2>

          {error && (
            <div className="bg-red-200 text-red-600 p-3 mb-4 text-center rounded-lg">
              {error}
            </div>
          )}

          {loading ? (
            <Loading />
          ) : (
            <Formik
              initialValues={{ email: "", password: "" }}
              validationSchema={validationSchema}
              onSubmit={handleSubmit}
            >
              {({ isSubmitting }) => (
                <Form className="space-y-4">
                  {/* Email Field */}
                  <div className="relative">
                    <Field
                      type="email"
                      name="email"
                      placeholder="Enter your email"
                      className="w-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400"
                    />
                    <ErrorMessage name="email" component="div" className="text-red-500 text-sm mt-1" />
                  </div>

                  {/* Password Field */}
                  <div>
                    <div className="relative">
                      <Field
                        type={showPassword ? "text" : "password"}
                        name="password"
                        placeholder="Enter your password"
                        className="w-full p-4 pr-16 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400"
                      />

                      <button
                        type="button"
                        className="absolute right-4 top-1/2 -translate-y-1/2 mt-[9px] flex items-center justify-center"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        <FontAwesomeIcon
                          icon={showPassword ? faEyeSlash : faEye}
                          size="lg"
                          className="text-gray-600"
                        />
                      </button>
                    </div>

                    <ErrorMessage name="password" component="div" className="text-red-500 text-sm mt-1" />
                  </div>

                  {/* Forgot Password Link */}
                  <div className="flex justify-end -mt-2">
                    <Link
                      to="/admin/forgot-password"
                      className="text-sm text-blue-600 hover:underline"
                    >
                      Forgot password?
                    </Link>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-blue-500 text-white p-4 rounded-lg hover:bg-blue-600 transition-colors duration-300 shadow-md"
                  >
                    Sign In
                  </button>
                </Form>
              )}
            </Formik>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;
//axios should be imported from the correct path and not from the school admin flow. Also, export default should be at the end of the file.
//changes
