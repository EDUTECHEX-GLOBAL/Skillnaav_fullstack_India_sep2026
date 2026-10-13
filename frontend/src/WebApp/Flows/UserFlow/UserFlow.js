// File: UserFlow.js

import React, { useState } from "react";
import { Formik, Form, Field, ErrorMessage } from "formik";
import * as Yup from "yup";
import { useNavigate, Link } from "react-router-dom";
import createAccountImage from "../../../assets-webapp/login-image-edutechex.png";
import axios from "../../../api/axiosInstance";
import { validateEmail } from "../../../utils/validators";

// Validation schema using the shared strict email validator (.com, .in, .org, etc.)
const validationSchema = Yup.object({
  email: Yup.string()
    .required("Email is required.")
    .test("valid-email", function (value) {
      const err = validateEmail(value);
      if (err) {
        return this.createError({ message: err });
      }
      return true;
    }),
});

const UserFlow = () => {
  const navigate = useNavigate();
  const [serverError, setServerError] = useState("");
  const [checkingEmail, setCheckingEmail] = useState(false);

  // Handle form submission: validate and check registration status
  const handleSubmit = async (values, { setSubmitting }) => {
    setServerError("");
    setCheckingEmail(true);
    const cleanedEmail = (values.email || "").trim().toLowerCase();

    try {
      // Check if email already exists
      const res = await axios.get(
        `/api/users/check-email?email=${encodeURIComponent(cleanedEmail)}`
      );

      if (res.data?.exists) {
        setServerError(
          res.data?.message || "This email is already registered. Please log in."
        );
        setSubmitting(false);
        setCheckingEmail(false);
        return;
      }

      // If email is not registered, navigate to account creation with email passed in state
      navigate("/user-create-account", { state: { email: cleanedEmail } });
    } catch (error) {
      // If check-email endpoint fails, still proceed to account creation
      console.warn("Email check notice, navigating to registration:", error);
      navigate("/user-create-account", { state: { email: cleanedEmail } });
    } finally {
      setSubmitting(false);
      setCheckingEmail(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row min-h-screen font-poppins">
      {/* Left Section (Image) - Hidden on mobile/tablet, full height on desktop like revamp */}
      <div className="hidden lg:flex lg:w-1/2 items-center justify-center">
        <img
          src={createAccountImage}
          alt="Create Account"
          className="w-full h-full object-cover"
        />
      </div>
      <div className="flex flex-col items-center justify-center p-6 sm:p-8 w-full lg:w-1/2 bg-white">
        <div className="w-full max-w-md flex flex-col justify-center min-h-screen lg:min-h-full">
          <h1 className="text-3xl font-extrabold mb-4 text-center text-gray-800">
            Dear Student, Welcome!
          </h1>
          <h2 className="text-lg font-medium mb-6 text-center text-gray-600">
            Please sign in to your account
          </h2>

          {serverError && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-sm flex flex-col gap-2">
              <div>{serverError}</div>
              <Link
                to="/user/login"
                className="inline-block font-semibold text-blue-600 hover:underline"
              >
                Go to Login &rarr;
              </Link>
            </div>
          )}

          <Formik
            initialValues={{ email: "" }}
            validationSchema={validationSchema}
            onSubmit={handleSubmit}
          >
            {({ isSubmitting, errors, touched }) => (
              <Form>
                <div className="mb-4">
                  <Field
                    type="email"
                    name="email"
                    placeholder="Email"
                    autoComplete="email"
                    className={`w-full p-3 border rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-purple-400 ${
                      touched.email && errors.email
                        ? "border-red-400 bg-red-50/30"
                        : "border-gray-300"
                    }`}
                  />
                  <ErrorMessage
                    name="email"
                    component="div"
                    className="text-red-500 text-sm mt-1"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || checkingEmail}
                  className="w-full bg-purple-600 text-white p-3 rounded-lg hover:bg-purple-700 transition duration-200 font-semibold mb-4 disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isSubmitting || checkingEmail ? (
                    <>
                      <svg
                        className="animate-spin h-5 w-5 text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8v8H4z"
                        ></path>
                      </svg>
                      <span>Verifying...</span>
                    </>
                  ) : (
                    "Get Started"
                  )}
                </button>
              </Form>
            )}
          </Formik>

          <div className="flex items-center my-4">
            <hr className="w-full border-t border-gray-300" />
            <span className="px-3 text-gray-500">OR</span>
            <hr className="w-full border-t border-gray-300" />
          </div>

          <p className="text-center text-gray-500 font-poppins font-medium text-base leading-6">
            Already have an account?{" "}
            <Link to="/user/login" className="text-blue-500 hover:underline font-semibold">
              Login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default UserFlow;
