// File: UserLogin.js

import React, { useState } from "react";
import { Formik, Form, Field, ErrorMessage } from "formik";
import * as Yup from "yup";
import { useNavigate, Link } from "react-router-dom";
import loginImage from "../../../../assets-webapp/login-image-edutechex.png";
import Loading from "../../../Warnings/Loading/Loading";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEye, faEyeSlash } from "@fortawesome/free-solid-svg-icons";
import ForgotPasswordModal from "../SignUpLogin/UserforgotPassword";
import { GoogleLogin } from "@react-oauth/google";
import axios from "../../../../api/axiosInstance";
import { validateEmail } from "../../../../utils/validators";
import { useGoogleButtonWidth } from "../../../../hooks/useGoogleButtonWidth";

const validationSchema = Yup.object({
  email: Yup.string()
    .required("Email is required.")
    .test("valid-email", function (value) {
      const err = validateEmail(value);
      if (err) return this.createError({ message: err });
      return true;
    }),
  password: Yup.string().required("Password is required."),
});

const redirectToAppropriateDashboard = (isB2BStudent, navigate, token, sessionId, studentData) => {
  const currentHost = window.location.hostname;
  const port = window.location.port ? `:${window.location.port}` : "";
  const protocol = window.location.protocol;

  const authQueryParams = token
    ? `?authToken=${encodeURIComponent(token)}${sessionId ? `&authSession=${encodeURIComponent(sessionId)}` : ""}${studentData ? `&studentData=${encodeURIComponent(JSON.stringify(studentData))}` : ""}`
    : "";

  if (isB2BStudent) {
    if (currentHost === "localhost" || currentHost === "127.0.0.1") {
      window.location.href = `${protocol}//b2b.localhost${port}/user-main-page${authQueryParams}`;
      return;
    } else if (!currentHost.startsWith("b2b.") && !currentHost.startsWith("campus.")) {
      const b2bHost = currentHost.replace(/^www\./, "");
      window.location.href = `${protocol}//b2b.${b2bHost}${port}/user-main-page${authQueryParams}`;
      return;
    }
  } else {
    if (currentHost.startsWith("b2b.localhost")) {
      window.location.href = `${protocol}//localhost${port}/user-main-page${authQueryParams}`;
      return;
    } else if (currentHost.startsWith("b2b.") || currentHost.startsWith("campus.")) {
      const mainHost = currentHost.replace(/^(b2b|campus)\./, "");
      window.location.href = `${protocol}//${mainHost}${port}/user-main-page${authQueryParams}`;
      return;
    }
  }

  navigate("/user-main-page");
};

const UserLogin = () => {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { containerRef: googleBtnRef, buttonWidth: googleBtnWidth } =
    useGoogleButtonWidth(384);

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

      const schoolAdminId = data.schoolAdmin || data.schoolAdminId || null;
      const schoolName = data.schoolName || data.school || null;

      const studentInfoData = {
        _id: data._id,
        name: data.name,
        email: data.email,
        profileImage: data.profileImage,
        isPremium: data.isPremium,
        planType: data.planType,
        premiumExpiration: data.premiumExpiration ?? null,
        adminApproved: data.adminApproved,
        status: data.status,
        schoolAdmin: schoolAdminId,
        schoolAdminId: schoolAdminId,
        schoolName: schoolName,
        isB2B: !!schoolAdminId,
      };

      localStorage.setItem("studentInfo", JSON.stringify(studentInfoData));

      if (schoolAdminId) {
        localStorage.setItem("schoolAdminId", schoolAdminId);
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
      redirectToAppropriateDashboard(!!schoolAdminId, navigate, data.token, sessionRes?.data?.sessionId, studentInfoData);
    } catch (err) {
      console.error("Login error:", err.response || err.message);
      setError(err.response?.data?.message || "Something went wrong");
      setLoading(false);
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row min-h-screen font-poppins">
      {/* Left Section (Image) - Hidden on mobile/tablet, full height on desktop like revamp */}
      <div className="hidden lg:flex lg:w-1/2 items-center justify-center">
        <img
          src={loginImage}
          alt="login"
          className="w-full h-full object-cover"
        />
      </div>

      {/* Right Section (Form) */}
      <div className="flex flex-col items-center justify-center px-4 py-8 sm:p-8 w-full lg:w-1/2">
        <div className="w-full max-w-md flex flex-col justify-center my-auto py-4">
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
                  <div>
                    <Field
                      type="email"
                      name="email"
                      placeholder="Enter your email"
                      className="w-full !mt-0 p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-400"
                    />
                    <ErrorMessage
                      name="email"
                      component="div"
                      className="text-red-500 text-sm mt-1"
                    />
                  </div>

                  <div>
                    <div className="relative flex items-center">
                      <Field
                        type={showPassword ? "text" : "password"}
                        name="password"
                        placeholder="Enter your password"
                        className="w-full !mt-0 p-4 pr-16 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-400"
                      />
                      <button
                        type="button"
                        className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center justify-center text-gray-500 hover:text-gray-700 focus:outline-none cursor-pointer"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        <FontAwesomeIcon
                          icon={showPassword ? faEyeSlash : faEye}
                          size="lg"
                        />
                      </button>
                    </div>
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

          <div ref={googleBtnRef} className="google-login-wrapper w-full">
            <GoogleLogin
              width={googleBtnWidth}
              onSuccess={async (credentialResponse) => {
              try {
                const idToken = credentialResponse.credential;

                const res = await axios.post("/api/users/google-auth", { idToken });

                localStorage.setItem("userToken", res.data.token);

                const schoolAdminId = res.data.schoolAdmin || res.data.schoolAdminId || null;
                const schoolName = res.data.schoolName || res.data.school || null;

                const studentInfoData = {
                  _id: res.data._id,
                  name: res.data.name,
                  email: res.data.email,
                  profileImage: res.data.profileImage,
                  isGoogleUser: res.data.isGoogleUser,

                  // B2B fields — needed for correct redirect
                  schoolAdmin: schoolAdminId,
                  schoolAdminId: schoolAdminId,
                  schoolName: schoolName,
                  isB2B: !!schoolAdminId,

                  adminApproved: res.data.adminApproved,
                  status: res.data.status,
                  isActive: res.data.isActive,

                  isPremium: res.data.isPremium ?? false,
                  planType: res.data.planType ?? "Free",
                  premiumExpiration: res.data.premiumExpiration ?? null,
                };

                localStorage.setItem("studentInfo", JSON.stringify(studentInfoData));

                if (schoolAdminId) {
                  localStorage.setItem("schoolAdminId", schoolAdminId);
                }

                localStorage.setItem("loginTime", Date.now());

                if (res.data.needsProfileCompletion) {
                  navigate("/user-create-account");
                } else {
                  // ✅ Same B2B/B2C redirect logic as email login
                  redirectToAppropriateDashboard(!!schoolAdminId, navigate, res.data.token, null, studentInfoData);
                }

              } catch (err) {
                console.error(err);
                setError(err.response?.data?.message || "Google login failed. Try again.");
              }
            }}
            onError={() => setError("Google login failed")}
            size="large"
            text="signin_with"
            shape="rectangular"
          />
          </div>

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
