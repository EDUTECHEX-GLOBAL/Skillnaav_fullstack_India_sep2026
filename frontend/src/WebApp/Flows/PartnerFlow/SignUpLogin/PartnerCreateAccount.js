import React, { useState, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom"; // 🔥 add useLocation
import { Formik, Form, Field, ErrorMessage } from "formik";
import * as Yup from "yup";
import { EyeIcon, EyeSlashIcon } from "@heroicons/react/24/solid";
import axios from "../../../../api/axiosInstance";
import partner2Image from "../../../../assets-webapp/partner2_img.jpg";
import { GoogleLogin } from "@react-oauth/google"; // 🔥 NEW

// --- VALIDATION SCHEMAS ---

// Step 1: Account Creation
const step1ValidationSchema = Yup.object({
  name: Yup.string().required("Full Name is Required"),
  email: Yup.string().email("Invalid email address").required("Email is Required"),
  password: Yup.string()
    .min(6, "Password must be at least 6 characters")
    .matches(/[A-Z]/, "Must contain an uppercase letter")
    .matches(/[a-z]/, "Must contain a lowercase letter")
    .matches(/[0-9]/, "Must contain a number")
    .matches(/[!@#$%^&*-_=+]/, "Must contain a special character")
    .required("Password is Required"),
  confirmPassword: Yup.string()
    .oneOf([Yup.ref("password"), null], "Passwords must match")
    .required("Confirm Password is Required"),
});

// Step 2 (Final Step): Institutional Info & Profile Picture
const step2ValidationSchema = Yup.object({
  universityName: Yup.string().required("University/Company Name is Required"),
  institutionId: Yup.string().required("Institutional ID is Required"),
});


const PartnerSignUpFlow = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [errorMessage, setErrorMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // 🔥 NEW: Track whether the partner came via Google signup
  const [isGoogleSignup, setIsGoogleSignup] = useState(false);

  // Timer state for Resend OTP button
  const [resendTimer, setResendTimer] = useState(0);

  // Consolidated form data state
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    otp: "",
    universityName: "",
    institutionId: "",
    profileImageFile: null,
    profileImageUrl: null,
    // 🔥 NEW: Store token from Google signup to authenticate the complete-profile call
    token: null,
  });

  // --- TIMER EFFECT ---
  useEffect(() => {
    let timerId;
    if (resendTimer > 0) {
      timerId = setInterval(() => {
        setResendTimer((prevTime) => prevTime - 1);
      }, 1000);
    }
    return () => clearInterval(timerId);
  }, [resendTimer, step]);

  const startResendTimer = () => {
    setResendTimer(60);
  };

  const location = useLocation();

  useEffect(() => {
    const state = location.state;
    if (state?.googleSignup) {
      setIsGoogleSignup(true);
      setFormData(prev => ({
        ...prev,
        name: state.name,
        email: state.email,
        token: state.token,
      }));
      setStep(2);
    }
  }, [location.state]);
  // --- STEP 1: ACCOUNT & OTP LOGIC ---

  const handleStep1Submit = async (values, { setSubmitting }) => {
    setErrorMessage("");
    try {
      const check = await axios.post("/api/partners/check-email", {
        email: values.email.trim(),
      });

      if (check.data.exists) {
        setErrorMessage(check.data.message || "Partner already registered.");
        setSubmitting(false);
        return;
      }

      await axios.post("/api/partners/send-verification-code", {
        email: values.email.trim(),
      });

      setFormData(prev => ({
        ...prev,
        ...values,
        otp: ""
      }));
      setStep(1.5);
      startResendTimer();

    } catch (error) {
      setErrorMessage(error.response?.data?.message || "Failed to send OTP.");
    } finally {
      setSubmitting(false);
    }
  };

  // RESEND OTP
  const resendOtp = async () => {
    if (resendTimer > 0) return;

    setErrorMessage("");
    try {
      await axios.post("/api/partners/send-verification-code", {
        email: formData.email,
      });
      startResendTimer();
      setErrorMessage("New verification code sent to your email.");
    } catch (error) {
      setErrorMessage(error.response?.data?.message || "Failed to resend OTP.");
    }
  };

  // VERIFY OTP
  const verifyOtpAndProceed = async (values, { setSubmitting }) => {
    setErrorMessage("");
    try {
      const verify = await axios.post("/api/partners/verify-otp", {
        email: formData.email,
        otp: values.otp,
      });

      if (verify.data.success) {
        setFormData(prev => ({ ...prev, otp: values.otp }));
        setStep(2);
      }
    } catch (error) {
      setErrorMessage("Invalid or expired OTP.");
    } finally {
      setSubmitting(false);
    }
  };

  // 🔥 NEW: Google Sign-Up handler
  // On success: creates partner account via Google, then skips OTP and goes straight to Step 2
  const handleGoogleSignup = async (credentialResponse) => {
    setErrorMessage("");
    try {
      const idToken = credentialResponse.credential;

      const res = await axios.post("/api/partners/google-auth", { idToken });

      // Pre-fill name and email from Google, save token for the complete-profile call
      setFormData(prev => ({
        ...prev,
        name: res.data.name,
        email: res.data.email,
        token: res.data.token,
      }));

      setIsGoogleSignup(true);

      // If profile is already complete (returning Google partner), go to main page
      if (!res.data.needsProfileCompletion) {
        localStorage.setItem("token", res.data.token);
        localStorage.setItem("adminApproved", res.data.adminApproved);
        localStorage.setItem("partnerId", res.data._id);
        localStorage.setItem("partnerInfo", JSON.stringify({
          _id: res.data._id,
          name: res.data.name,
          email: res.data.email,
          profileImage: res.data.profileImage,
          isGoogleUser: res.data.isGoogleUser,
          universityName: res.data.universityName,
          institutionId: res.data.institutionId,
          isPremium: res.data.isPremium ?? false,
          planType: res.data.planType ?? "Freemium",
          premiumExpiration: res.data.premiumExpiration ?? null,
          adminApproved: res.data.adminApproved,
          status: res.data.status,
        }));
        localStorage.setItem("loginTime", Date.now().toString());
        navigate("/partner-main-page");
        return;
      }

      // 🔥 New Google partner — skip OTP (email already verified by Google), go to Step 2
      setStep(2);

    } catch (err) {
      console.error(err);
      setErrorMessage("Google sign-up failed. Please try again.");
    }
  };

  // --- STEP 2 (FINAL): INSTITUTIONAL INFO & PICTURE LOGIC ---

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFormData(prev => ({
        ...prev,
        profileImageFile: file,
        profileImageUrl: URL.createObjectURL(file)
      }));
    }
  };

  const showRegistrationSuccess = () => {
    setShowSuccessModal(true);
  };

  const handleSuccessModalClose = () => {
    setShowSuccessModal(false);
    navigate("/partner/login");
  };

  const handleStep2Submit = async (values, { setSubmitting }) => {
    setErrorMessage("");

    if (!formData.profileImageFile) {
      setErrorMessage("Profile picture is required.");
      setSubmitting(false);
      return;
    }

    try {
      const finalFormData = new FormData();
      finalFormData.append("universityName", values.universityName);
      finalFormData.append("institutionId", values.institutionId);
      finalFormData.append("profileImage", formData.profileImageFile);

      if (isGoogleSignup) {
        // 🔥 Google signup path — call complete-profile endpoint with Bearer token
        const response = await axios.post(
          "/api/partners/complete-profile",
          finalFormData,
          {
            headers: {
              "Content-Type": "multipart/form-data",
              Authorization: `Bearer ${formData.token}`,
            },
          }
        );

        // Save everything to localStorage after profile is complete
        localStorage.setItem("token", response.data.token);
        localStorage.setItem("adminApproved", response.data.adminApproved);
        localStorage.setItem("partnerId", response.data._id);
        localStorage.setItem("partnerInfo", JSON.stringify({
          _id: response.data._id,
          name: response.data.name,
          email: response.data.email,
          profileImage: response.data.profileImage,
          isGoogleUser: response.data.isGoogleUser,
          universityName: response.data.universityName,
          institutionId: response.data.institutionId,
          isPremium: response.data.isPremium ?? false,
          planType: response.data.planType ?? "Freemium",
          premiumExpiration: response.data.premiumExpiration ?? null,
          adminApproved: response.data.adminApproved,
          status: response.data.status,
        }));
        localStorage.setItem("loginTime", Date.now().toString());

        showRegistrationSuccess();

      } else {
        // Normal signup path — call register endpoint with all fields
        finalFormData.append("name", formData.name);
        finalFormData.append("email", formData.email);
        finalFormData.append("password", formData.password);
        finalFormData.append("confirmPassword", formData.password);

        const response = await axios.post(
          "/api/partners/register",
          finalFormData,
          { headers: { "Content-Type": "multipart/form-data" } }
        );

        if (response.status === 201) {
          showRegistrationSuccess();
        }
      }
    } catch (error) {
      console.error("Error submitting form:", error);
      setErrorMessage(error.response?.data?.message || "Registration failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };


  // --- RENDERING STEPS ---

  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
          // STEP 1: Account Creation Form
          <Formik
            initialValues={{ name: formData.name, email: formData.email, password: formData.password, confirmPassword: formData.confirmPassword }}
            validationSchema={step1ValidationSchema}
            onSubmit={handleStep1Submit}
          >
            {({ isSubmitting }) => (
              <Form className="space-y-4">
                <Field type="text" name="name" placeholder="Full Name" className="w-full p-3 border border-gray-300 rounded-lg" />
                <ErrorMessage name="name" component="div" className="text-red-500 text-sm mt-1" />

                <Field type="email" name="email" placeholder="Email" className="w-full p-3 border border-gray-300 rounded-lg" />
                <ErrorMessage name="email" component="div" className="text-red-500 text-sm mt-1" />

                <div className="relative">
                  <Field
                    type={showPassword ? "text" : "password"}
                    name="password"
                    placeholder="Password"
                    className="w-full p-3 border border-gray-300 rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2"
                  >
                    {showPassword ? (<EyeIcon className="h-5 w-5 text-gray-500" />) : (<EyeSlashIcon className="h-5 w-5 text-gray-500" />)}
                  </button>
                  <ErrorMessage name="password" component="div" className="text-red-500 text-sm mt-1" />
                </div>

                <div className="relative">
                  <Field
                    type={showConfirmPassword ? "text" : "password"}
                    name="confirmPassword"
                    placeholder="Confirm Password"
                    className="w-full p-3 border border-gray-300 rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2"
                  >
                    {showConfirmPassword ? (<EyeIcon className="h-5 w-5 text-gray-500" />) : (<EyeSlashIcon className="h-5 w-5 text-gray-500" />)}
                  </button>
                  <ErrorMessage name="confirmPassword" component="div" className="text-red-500 text-sm mt-1" />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-teal-500 text-white p-4 rounded-lg hover:bg-teal-600 transition-colors duration-300 shadow-md disabled:bg-teal-300"
                >
                  Send Verification Code
                </button>

                {/* 🔥 NEW: Google Sign-Up — shown only on Step 1 */}
                <div className="flex items-center my-2">
                  <hr className="w-full border-gray-300" />
                  <span className="px-3 text-gray-500 text-sm whitespace-nowrap">OR sign up with</span>
                  <hr className="w-full border-gray-300" />
                </div>

                <div className="flex justify-center">
                  <GoogleLogin
                    onSuccess={handleGoogleSignup}
                    onError={() => setErrorMessage("Google sign-up failed")}
                  />
                </div>
              </Form>
            )}
          </Formik>
        );

      case 1.5:
        return (
          // STEP 1.5: OTP Verification
          <Formik
            initialValues={{ otp: formData.otp }}
            onSubmit={verifyOtpAndProceed}
          >
            {({ isSubmitting, values, handleChange }) => (
              <Form>
                <p className="text-center text-sm text-gray-600 mb-4">
                  A verification code has been sent to **{formData.email}**.
                </p>
                <div className="mb-4">
                  <input
                    type="text"
                    name="otp"
                    value={values.otp}
                    onChange={handleChange}
                    placeholder="Enter 6-digit OTP"
                    maxLength="6"
                    className="w-full p-3 border border-gray-300 rounded-lg text-center tracking-widest text-lg"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-teal-500 text-white p-4 rounded-lg hover:bg-teal-600 transition-colors duration-300 shadow-md disabled:bg-teal-300"
                >
                  Verify OTP & Continue
                </button>

                {/* RESEND OTP BUTTON */}
                <div className="mt-4 text-center">
                  {resendTimer > 0 ? (
                    <p className="text-gray-500 text-sm">Resend available in **{resendTimer}** seconds</p>
                  ) : (
                    <button
                      type="button"
                      onClick={resendOtp}
                      disabled={isSubmitting}
                      className="text-teal-500 font-medium hover:underline disabled:text-gray-400"
                    >
                      Resend Verification Code
                    </button>
                  )}
                </div>
              </Form>
            )}
          </Formik>
        );

      case 2:
        return (
          // STEP 2 (FINAL): Institutional Info & Profile Picture
          <Formik
            initialValues={{ universityName: formData.universityName, institutionId: formData.institutionId }}
            validationSchema={step2ValidationSchema}
            onSubmit={handleStep2Submit}
          >
            {({ isSubmitting, values }) => (
              <Form className="space-y-6">
                <h2 className="text-xl font-semibold text-gray-700 bg-purple-100 p-3 rounded-md">
                  INSTITUTIONAL INFO & PROFILE PICTURE
                </h2>

                {/* Display Name for context */}
                <div>
                  <label className="block text-sm font-medium text-gray-700"> Name </label>
                  <p className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-50">{formData.name}</p>
                </div>

                {/* University or Company Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2"> University or Company name </label>
                  <Field type="text" name="universityName" placeholder="Tesla Inc" className="w-full border border-gray-300 rounded-md p-3 focus:outline-none focus:ring-2 focus:ring-purple-200" />
                  <ErrorMessage name="universityName" component="div" className="text-red-500 text-sm mt-1" />
                </div>

                {/* Institutional ID */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2"> Institutional ID </label>
                  <Field type="text" name="institutionId" placeholder="XXXXXXXXXX" className="w-full border border-gray-300 rounded-md p-3 focus:outline-none focus:ring-2 focus:ring-purple-200" />
                  <ErrorMessage name="institutionId" component="div" className="text-red-500 text-sm mt-1" />
                </div>

                {/* Profile Picture */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2"> Profile picture </label>
                  <div className="flex justify-center items-center w-full">
                    <label htmlFor="profile-picture" className="flex flex-col items-center justify-center w-24 h-24 bg-gray-50 rounded-full shadow-sm cursor-pointer hover:bg-gray-100 transition duration-200">
                      {formData.profileImageUrl ? (
                        <img src={formData.profileImageUrl} alt="Profile Preview" className="w-full h-full object-cover rounded-full" />
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5v14" />
                        </svg>
                      )}
                      <input id="profile-picture" type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                    </label>
                  </div>
                  {!formData.profileImageFile && <div className="text-red-500 text-sm text-center mt-2">Profile Picture is required.</div>}
                </div>

                {/* Final Submit Button */}
                <div>
                  <button
                    type="submit"
                    className={`w-full py-3 rounded-md font-semibold text-center text-white transition duration-200 disabled:bg-purple-300 ${(values.universityName && values.institutionId && formData.profileImageFile)
                      ? "bg-purple-400 hover:bg-purple-700"
                      : "bg-purple-100 cursor-not-allowed"
                      }`}
                    disabled={isSubmitting || !formData.profileImageFile}
                  >
                    Complete Registration
                  </button>
                </div>
              </Form>
            )}
          </Formik>
        );

      default:
        return null;
    }
  };


  return (
    <div className="flex flex-col lg:flex-row min-h-screen font-poppins">
      {showSuccessModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="registration-success-title"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-2xl text-green-600">
              ✓
            </div>
            <h2 id="registration-success-title" className="mt-4 text-xl font-semibold text-gray-900">
              Registration successful!
            </h2>
            <p className="mt-2 text-gray-600">
              Your account has been created. You will now be redirected to login.
            </p>
            <button
              type="button"
              onClick={handleSuccessModalClose}
              className="mt-6 w-full rounded-lg bg-purple-600 px-4 py-3 font-semibold text-white transition hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-2"
            >
              Continue to Login
            </button>
          </div>
        </div>
      )}
      {/* Image Side */}
      <div className="hidden md:flex md:w-full lg:w-1/2 items-center justify-center">
        <img src={partner2Image} alt="Create Account" className="w-full h-full object-contain max-w-[830px] max-h-[900px] p-6 ml-6 shadow-lg" />
      </div>

      {/* Form Side */}
      <div className="flex flex-col items-center justify-center p-8 w-full lg:w-1/2 bg-white">
        <div className="w-full max-w-md flex flex-col justify-center min-h-screen lg:min-h-full">
          <h1 className="text-2xl font-semibold mb-6 text-center">
            {step === 1 ? "Create an Account" : step === 1.5 ? "Verify OTP" : "Finalize Profile"}
          </h1>

          {/* Error Message Display */}
          {errorMessage && (
            <div className="mb-4 p-4 bg-red-100 text-red-800 border border-red-400 rounded">
              {errorMessage}
            </div>
          )}

          {/* Step Progress Indicator */}
          <div className="flex justify-between mb-6 w-1/2 mx-auto">
            <div className={`p-2 rounded-full ${step >= 1 ? 'bg-teal-500 text-white' : 'bg-gray-200 text-gray-500'}`}>1</div>
            <div className={`p-2 rounded-full ${step >= 2 ? 'bg-teal-500 text-white' : 'bg-gray-200 text-gray-500'}`}>2</div>
          </div>

          {/* Render Current Step Content */}
          {renderStepContent()}

          {/* Back Buttons */}
          {step === 1.5 && (
            <button
              type="button"
              onClick={() => setStep(1)}
              className="mt-4 p-2 text-center text-teal-500 hover:underline"
            >
              &larr; Back to Account Details
            </button>
          )}
          {/* 🔥 On Google signup, Step 2 back button is hidden (no OTP step was shown) */}
          {step === 2 && !isGoogleSignup && (
            <button
              type="button"
              onClick={() => setStep(1.5)}
              className="mt-4 p-2 text-center text-teal-500 hover:underline"
            >
              &larr; Back to OTP Verification
            </button>
          )}

          {/* Login Link — only on Step 1 */}
          {step === 1 && (
            <>
              <div className="flex items-center my-4">
                <hr className="w-full border-t border-gray-300" />
                <span className="px-3 text-gray-500">OR</span>
                <hr className="w-full border-t border-gray-300" />
              </div>

              <p className="text-center text-gray-500 font-poppins font-medium text-base leading-6">
                Already have an account?{" "}
                <Link
                  to="/partner/login"
                  className="text-teal-500 hover:underline font-semibold"
                >
                  Login
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default PartnerSignUpFlow;
