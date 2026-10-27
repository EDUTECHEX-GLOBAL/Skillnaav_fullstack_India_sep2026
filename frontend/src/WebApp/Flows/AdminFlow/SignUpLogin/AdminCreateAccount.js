// File: AdminCreateAccount.js

import React, { useState } from "react";
import { Formik, Form, Field, ErrorMessage } from "formik";
import * as Yup from "yup";
import { useNavigate, Link } from "react-router-dom";
import axios from "../../../../api/axiosInstance";
import Loading from "../../../Warnings/Loading/Loading";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEye, faEyeSlash } from "@fortawesome/free-solid-svg-icons";
import adminImage from "../../../../assets-webapp/partner.jpg"; // Adjust path as necessary
import { validateEmail } from "../../../../utils/validators";

// Validation schema for Formik
const validationSchema = Yup.object({
  name: Yup.string()
    .trim()
    .required("Full Name is Required")
    .min(2, "Name must be at least 2 characters")
    .max(50, "Name cannot exceed 50 characters")
    .matches(/^[A-Za-z]/, "Name must start with a letter")
    .matches(/^[^0-9]*$/, "Name cannot contain numbers")
    .matches(
      /^[A-Za-z][A-Za-z\s'.-]*$/,
      "Name can only contain letters, spaces, hyphens, or apostrophes"
    ),
  email: Yup.string()
    .trim()
    .required("Required")
    .test("is-valid-email", function (value) {
      if (!value) return true;
      const errorMsg = validateEmail(value);
      if (errorMsg) {
        return this.createError({ message: errorMsg });
      }
      return true;
    }),
  password: Yup.string()
    .min(6, "Password must be at least 6 characters")
    .required("Required"),
  confirmPassword: Yup.string()
    .oneOf([Yup.ref("password"), null], "Passwords must match")
    .required("Required"),
});

const AdminCreateAccount = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Function to handle form submission
  const handleSubmit = async (values, { setSubmitting }) => {
    setError("");
    setLoading(true);
    try {
      const response = await axios.post("/api/users/register", values);
      localStorage.setItem("adminInfo", JSON.stringify(response.data));
      navigate("/admin-main-page");
    } catch (err) {
      setError(
        err.response?.data?.message ||
        "Error registering user. Please try again."
      );
    } finally {
      setLoading(false);
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row min-h-screen font-poppins">
      {/* Left Side Image */}
      <div className="hidden lg:flex lg:w-1/2 items-center justify-center">
        <img
          src={adminImage}
          alt="Admin Create Account"
          className="w-full h-full object-cover"
        />
      </div>

      {/* Right Side Registration Form */}
      <div className="flex flex-col items-center justify-center p-8 w-full lg:w-1/2 bg-white">
        <div className="w-full max-w-md">
          <h1 className="text-3xl font-extrabold mb-4 text-center text-gray-800">
            Create an Account
          </h1>
          <h2 className="text-lg font-medium mb-6 text-center text-gray-600">
            Welcome to the Admin Portal. Please create an account to get
            started.
          </h2>

          {/* Error Message */}
          {error && (
            <div className="bg-red-200 text-red-600 p-3 mb-4 text-center rounded-lg">
              {error}
            </div>
          )}

          {/* Loading */}
          {loading ? (
            <Loading />
          ) : (
            <Formik
              initialValues={{
                name: "",
                email: "",
                password: "",
                confirmPassword: "",
              }}
              validationSchema={validationSchema}
              onSubmit={handleSubmit}
            >
              {({ isSubmitting }) => (
                <Form className="space-y-4">
                  {/* Full Name Field */}
                  <div className="relative">
                    <Field
                      type="text"
                      name="name"
                      placeholder="Full Name"
                      maxLength={50}
                      className="w-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400"
                      aria-label="Full Name"
                    />
                    <ErrorMessage
                      name="name"
                      component="div"
                      className="text-red-500 text-sm mt-1"
                    />
                  </div>

                  {/* Email Field */}
                  <div className="relative">
                    <Field
                      type="email"
                      name="email"
                      placeholder="Email"
                      className="w-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400"
                      aria-label="Email"
                    />
                    <ErrorMessage
                      name="email"
                      component="div"
                      className="text-red-500 text-sm mt-1"
                    />
                  </div>

                  {/* Password Field */}
                  <div>
                    <div className="relative flex items-center">
                      <Field
                        type={showPassword ? "text" : "password"}
                        name="password"
                        placeholder="Password"
                        className="w-full !mt-0 p-4 pr-16 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400"
                        aria-label="Password"
                      />
                      <button
                        type="button"
                        className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center justify-center text-gray-600 hover:text-gray-800 cursor-pointer focus:outline-none"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={
                          showPassword ? "Hide Password" : "Show Password"
                        }
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

                  {/* Confirm Password Field */}
                  <div>
                    <div className="relative flex items-center">
                      <Field
                        type={showConfirmPassword ? "text" : "password"}
                        name="confirmPassword"
                        placeholder="Confirm Password"
                        className="w-full !mt-0 p-4 pr-16 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400"
                        aria-label="Confirm Password"
                      />
                      <button
                        type="button"
                        className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center justify-center text-gray-600 hover:text-gray-800 cursor-pointer focus:outline-none"
                        onClick={() =>
                          setShowConfirmPassword(!showConfirmPassword)
                        }
                        aria-label={
                          showConfirmPassword
                            ? "Hide Confirm Password"
                            : "Show Confirm Password"
                        }
                      >
                        <FontAwesomeIcon
                          icon={showConfirmPassword ? faEyeSlash : faEye}
                          size="lg"
                        />
                      </button>
                    </div>
                    <ErrorMessage
                      name="confirmPassword"
                      component="div"
                      className="text-red-500 text-sm mt-1"
                    />
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-blue-500 text-white p-4 rounded-lg hover:bg-blue-600 transition-colors duration-300 shadow-md"
                  >
                    {isSubmitting ? "Creating..." : "Create Account"}
                  </button>
                </Form>
              )}
            </Formik>
          )}

          {/* Divider */}
          <div className="flex items-center my-6">
            <hr className="w-full border-gray-300" />
            <span className="px-3 text-gray-500">OR</span>
            <hr className="w-full border-gray-300" />
          </div>

          {/* Login Link */}
          <p className="text-center text-gray-500">
            Already have an account?
            <Link
              to="/admin/login"
              className="text-blue-500 hover:underline font-semibold"
            >
              Login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default AdminCreateAccount;