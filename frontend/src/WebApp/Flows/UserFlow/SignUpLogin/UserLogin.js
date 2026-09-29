// File: UserLogin.js

import React, { useState } from "react";
import { Formik, Form, Field, ErrorMessage } from "formik";
import * as Yup from "yup";
import { useNavigate, Link } from "react-router-dom";
import loginImage from "../../../../assets-webapp/login-image.png";
import Loading from "../../../Warnings/Loading/Loading";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEye, faEyeSlash } from "@fortawesome/free-solid-svg-icons";
import ForgotPasswordModal from "../SignUpLogin/UserforgotPassword";
import { GoogleLogin } from "@react-oauth/google";
import axios from "../../../../api/axiosInstance";

const validationSchema = Yup.object({
  email: Yup.string().email("Invalid email address").required("Required"),
  password: Yup.string().required("Required"),
});

const UserLogin = () => {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleSubmit = async (values, { setSubmitting }) => {
    setError("");
    setLoading(true);
    try {
      const config = {
        headers: {
          "Content-type": "application/json",
        },
      };

      const { data } = await axios.post("/api/users/login", values, config);

      if (!data || !data.token) {
        throw new Error("Invalid response from server");
      }

      localStorage.removeItem("userToken");
      localStorage.removeItem("studentInfo");
      localStorage.removeItem("userInfo");
      localStorage.removeItem("sessionId");
      localStorage.setItem("userToken", data.token);

      localStorage.setItem("studentInfo", JSON.stringify({
        _id: data._id,
        name: data.name,
        email: data.email,
        profileImage: data.profileImage,
        isPremium: data.isPremium,
        planType: data.planType,
        premiumExpiration: data.premiumExpiration ?? null, // ✅ FIX: was missing — Navbar reads this from localStorage on load
        adminApproved: data.adminApproved,
        status: data.status,
      }));

      if (data.schoolAdminId) {
        localStorage.setItem("schoolAdminId", data.schoolAdminId);
      }

      const sessionRes = await axios.post(
        "/api/sessions/login",
        {},
        {
          headers: {
            Authorization: `Bearer ${data.token}`,
          },
        }
      );

      if (sessionRes?.data?.sessionId) {
        localStorage.setItem("sessionId", sessionRes.data.sessionId);
      }

      localStorage.setItem("loginTime", Date.now());

      setLoading(false);
      navigate("/user-main-page");
    } catch (err) {
      console.error("Login error:", err.response || err.message);
      setError(err.response?.data?.message || "Something went wrong");
      setLoading(false);
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row min-h-screen font-poppins">
      {/* Left Section (Image) */}
      <div className="hidden lg:flex lg:w-1/2 items-center justify-center">
        <img
          src={loginImage}
          alt="login"
          className="w-full h-full object-cover rounded-lg"
        />
      </div>

      {/* Right Section (Form) */}
      <div className="flex flex-col items-center justify-center p-8 w-full lg:w-1/2">
        <div className="w-full max-w-md flex flex-col justify-center min-h-screen lg:min-h-full">
          <h1 className="text-3xl font-extrabold mb-6 text-center text-gray-800">
            Dear Student, Welcome!
          </h1>
          <h2 className="text-lg font-medium mb-6 text-center text-gray-600">
            Please sign in to your account
          </h2>

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
                  <div className="relative">
                    <Field
                      type="email"
                      name="email"
                      placeholder="Enter your email"
                      className="w-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-400"
                    />
                    <ErrorMessage
                      name="email"
                      component="div"
                      className="text-red-500 text-sm mt-1"
                    />
                  </div>

                  <div className="relative">
                    <Field
                      type={showPassword ? "text" : "password"}
                      name="password"
                      placeholder="Enter your password"
                      className="w-full p-4 pr-16 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-400"
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-4 mt-3 flex items-center justify-center h-full text-gray-600"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      <FontAwesomeIcon
                        icon={showPassword ? faEyeSlash : faEye}
                        size="lg"
                      />
                    </button>
                    <ErrorMessage
                      name="password"
                      component="div"
                      className="text-red-500 text-sm mt-1"
                    />
                  </div>

                  <div className="flex justify-end mb-6">
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(true)}
                      className="text-sm font-medium text-teal-500 hover:text-teal-700 transition duration-150 ease-in-out"
                    >
                      Forgot password?
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-purple-500 text-white p-4 rounded-lg hover:bg-purple-600 transition-colors duration-300 shadow-md"
                  >
                    Sign In
                  </button>
                </Form>
              )}
            </Formik>
          )}

          <div className="flex items-center my-6">
            <hr className="w-full border-gray-300" />
            <span className="px-3 text-gray-500">OR</span>
            <hr className="w-full border-gray-300" />
          </div>

          <GoogleLogin
            onSuccess={async (credentialResponse) => {
              try {
                const idToken = credentialResponse.credential;

                const res = await axios.post("/api/users/google-auth", { idToken });

                localStorage.setItem("userToken", res.data.token);

                localStorage.setItem("studentInfo", JSON.stringify({
                  _id: res.data._id,
                  name: res.data.name,
                  email: res.data.email,
                  profileImage: res.data.profileImage,
                  isGoogleUser: res.data.isGoogleUser,

                  // IMPORTANT
                  adminApproved: res.data.adminApproved,
                  status: res.data.status,
                  isActive: res.data.isActive,

                  isPremium: res.data.isPremium ?? false,
                  planType: res.data.planType ?? "Free",
                  premiumExpiration: res.data.premiumExpiration ?? null,
                }));

                localStorage.setItem("loginTime", Date.now());

                if (res.data.needsProfileCompletion) {
                  navigate("/user-create-account");
                } else {
                  navigate("/user-main-page");
                }

              } catch (err) {
                console.error(err);
                setError(err.response?.data?.message || "Google login failed. Try again.");
              }
            }}
            onError={() => setError("Google login failed")}
          />

          <div className="flex justify-center mt-4">
            <p className="text-sm text-gray-600">
              Don't have an account?{" "}
              <Link 
                to="/user-create-account" 
                onClick={() => {
                  localStorage.removeItem("userToken");
                  localStorage.removeItem("studentInfo");
                  sessionStorage.removeItem("reg_step");
                  sessionStorage.removeItem("reg_formdata");
                }}
                className="text-teal-500 hover:text-teal-700"
              >
                Sign Up
              </Link>
            </p>
          </div>
        </div>
      </div>

      <ForgotPasswordModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
};

export default UserLogin;
//push changes
