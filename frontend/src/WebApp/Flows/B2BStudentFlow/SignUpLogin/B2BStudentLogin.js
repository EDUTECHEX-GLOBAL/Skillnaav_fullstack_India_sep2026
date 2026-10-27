// File: B2BStudentLogin.js
// Dedicated Institutional / Campus Student Login Flow

import React, { useState } from "react";
import { Formik, Form, Field, ErrorMessage } from "formik";
import * as Yup from "yup";
import { useNavigate, Link } from "react-router-dom";
import loginImage from "../../../../assets-webapp/school-reg.png";
import edutechexLogo from "../../../../assets-webapp/Edutechex-logo.png";
import Loading from "../../../Warnings/Loading/Loading";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEye, faEyeSlash, faGraduationCap, faBuildingColumns, faArrowRight } from "@fortawesome/free-solid-svg-icons";
import ForgotPasswordModal from "../../UserFlow/SignUpLogin/UserforgotPassword";
import axios from "../../../../api/axiosInstance";
import { validateEmail } from "../../../../utils/validators";

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

const B2BStudentLogin = () => {
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

      const { data } = await axios.post("/api/users/b2b/login", values, config);

      if (!data || !data.token) {
        throw new Error("Invalid response from server");
      }

      localStorage.removeItem("userToken");
      localStorage.removeItem("studentInfo");
      localStorage.removeItem("userInfo");
      localStorage.removeItem("sessionId");
      localStorage.setItem("userToken", data.token);

      localStorage.setItem(
        "studentInfo",
        JSON.stringify({
          _id: data._id,
          name: data.name,
          email: data.email,
          profileImage: data.profileImage,
          isPremium: data.isPremium,
          planType: data.planType,
          premiumExpiration: data.premiumExpiration ?? null,
          adminApproved: data.adminApproved,
          status: data.status,
          schoolAdmin: data.schoolAdmin,
          schoolName: data.schoolName || data.school,
          isB2B: true,
        })
      );

      if (data.schoolAdminId || data.schoolAdmin) {
        localStorage.setItem("schoolAdminId", data.schoolAdminId || data.schoolAdmin);
      }

      try {
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
      } catch (sessionErr) {
        console.warn("Session tracking error (non-fatal):", sessionErr.message);
      }

      localStorage.setItem("loginTime", Date.now());

      setLoading(false);
      const currentHost = window.location.hostname;
      const port = window.location.port ? `:${window.location.port}` : "";
      const protocol = window.location.protocol;
      const authQueryParams = `?authToken=${encodeURIComponent(data.token)}${sessionRes?.data?.sessionId ? `&authSession=${encodeURIComponent(sessionRes.data.sessionId)}` : ""}`;

      if (currentHost === "localhost" || currentHost === "127.0.0.1") {
        window.location.href = `${protocol}//b2b.localhost${port}/user-main-page${authQueryParams}`;
      } else if (!currentHost.startsWith("b2b.") && !currentHost.startsWith("campus.")) {
        const b2bHost = currentHost.replace(/^www\./, "");
        window.location.href = `${protocol}//b2b.${b2bHost}${port}/user-main-page${authQueryParams}`;
      } else {
        navigate("/user-main-page");
      }
    } catch (err) {
      console.error("B2B Student Login error:", err.response || err.message);
      setError(err.response?.data?.message || "Login failed. Please check your credentials.");
      setLoading(false);
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row min-h-screen font-poppins bg-gray-50">
      {/* Left Section (Campus Branding Banner) */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-emerald-800 via-teal-900 to-indigo-950 items-center justify-center p-12 text-white overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]"></div>

        <div className="relative z-10 max-w-lg space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-xs font-semibold uppercase tracking-wider text-emerald-300">
            <FontAwesomeIcon icon={faBuildingColumns} /> Institutional Access
          </div>

          <h2 className="text-4xl font-extrabold tracking-tight leading-tight">
            Campus & School Student Portal
          </h2>

          <p className="text-emerald-100 text-base leading-relaxed">
            Welcome to your institution-sponsored career development ecosystem. Access curated internships, live assessments, and career tracking directly through your school partnership.
          </p>

          <div className="pt-4 grid grid-cols-2 gap-4 text-left">
            <div className="p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm">
              <div className="text-2xl font-bold text-emerald-400">100%</div>
              <div className="text-xs text-emerald-200 mt-1">Campus Sponsored Access</div>
            </div>
            <div className="p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm">
              <div className="text-2xl font-bold text-teal-300">Direct</div>
              <div className="text-xs text-emerald-200 mt-1">School Admin Verification</div>
            </div>
          </div>

          {loginImage && (
            <div className="mt-8 rounded-2xl overflow-hidden shadow-2xl border border-white/10 max-h-56">
              <img
                src={loginImage}
                alt="Institutional Campus"
                className="w-full h-full object-cover opacity-90"
              />
            </div>
          )}
        </div>
      </div>

      {/* Right Section (Form) */}
      <div className="flex flex-col items-center justify-center p-6 sm:p-12 w-full lg:w-1/2 bg-white">
        <div className="w-full max-w-md flex flex-col justify-center">
          <div className="flex justify-center mb-6">
            <img
              src={edutechexLogo}
              alt="Edutechex Logo"
              className="h-10 w-auto object-contain"
            />
          </div>

          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 mb-3">
              <FontAwesomeIcon icon={faGraduationCap} size="lg" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
              Institution Student Login
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Sign in with your school-registered student account
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 mb-5 rounded text-sm shadow-sm">
              <p className="font-semibold">Authentication Alert</p>
              <p>{error}</p>
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
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1">
                      Institutional Email
                    </label>
                    <div className="relative">
                      <Field
                        type="email"
                        name="email"
                        placeholder="student@school.edu or your registered email"
                        className="w-full !mt-0 px-4 py-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition"
                      />
                    </div>
                    <ErrorMessage
                      name="email"
                      component="div"
                      className="text-red-500 text-xs mt-1"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1">
                      Password
                    </label>
                    <div className="relative flex items-center">
                      <Field
                        type={showPassword ? "text" : "password"}
                        name="password"
                        placeholder="Enter your student account password"
                        className="w-full !mt-0 px-4 py-3 pr-12 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition"
                      />
                      <button
                        type="button"
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center justify-center text-gray-400 hover:text-gray-600 focus:outline-none cursor-pointer"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        <FontAwesomeIcon icon={showPassword ? faEyeSlash : faEye} />
                      </button>
                    </div>
                    <ErrorMessage
                      name="password"
                      component="div"
                      className="text-red-500 text-xs mt-1"
                    />
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(true)}
                      className="text-xs font-medium text-emerald-600 hover:text-emerald-800 transition"
                    >
                      Forgot password?
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3.5 px-4 rounded-lg shadow-md hover:shadow-lg transition duration-200 flex items-center justify-center gap-2 mt-2"
                  >
                    <span>Sign In to Campus Portal</span>
                    <FontAwesomeIcon icon={faArrowRight} className="text-xs" />
                  </button>
                </Form>
              )}
            </Formik>
          )}

          <div className="mt-8 pt-6 border-t border-gray-200 text-center space-y-3">
            <p className="text-xs text-gray-500">
              Are you an individual / retail learner without a school partnership?
            </p>
            <div>
              <Link
                to="/user/login"
                className="inline-flex items-center text-xs font-semibold text-purple-600 hover:text-purple-800 transition"
              >
                Go to Standard B2C Student Login &rarr;
              </Link>
            </div>
            <div>
              <Link
                to="/choose-role"
                className="text-xs text-gray-400 hover:text-gray-600 transition"
              >
                Back to Role Selector
              </Link>
            </div>
          </div>
        </div>
      </div>

      <ForgotPasswordModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
};

export default B2BStudentLogin;
