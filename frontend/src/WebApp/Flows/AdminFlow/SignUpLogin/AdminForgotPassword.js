// File: AdminForgotPassword.js

import React from "react";
import { Formik, Form, Field, ErrorMessage } from "formik";
import * as Yup from "yup";
import { useNavigate, Link } from "react-router-dom";
import axios from "../../../../api/axiosInstance";
import Loading from "../../../Warnings/Loading/Loading";
import adminImage from "../../../../assets-webapp/partner.jpg";

const validationSchema = Yup.object({
  email: Yup.string().email("Invalid email address").required("Required"),
});

const AdminForgotPassword = () => {
  const navigate = useNavigate();
  const loading = false;
  const error = "";
  const successMsg = "";

  const handleSubmit = async (values, { setSubmitting }) => {
    const email = values.email?.trim() || "";

    try {
      // ✅ Send OTP in background (do not block UI)
      await axios.post("/api/admin/forgot-password", { email }).catch((err) => {
        console.error("Failed to send OTP:", err.response?.data || err.message);
      });

      // ✅ Navigate immediately (no waiting)
      navigate(`/admin/reset-password?email=${encodeURIComponent(email)}`);
    } catch (err) {
      console.error("Failed to send OTP:", err.response?.data || err.message);
    } finally {
      // ✅ Stop Formik submit immediately
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row min-h-screen font-poppins">
      <div className="hidden lg:flex lg:w-1/2 items-center justify-center">
        <img
          src={adminImage}
          alt="Admin Forgot Password"
          className="w-full h-full object-cover"
        />
      </div>

      <div className="flex flex-col items-center justify-center p-8 w-full lg:w-1/2 bg-white">
        <div className="w-full max-w-md">
          <h1 className="text-3xl font-extrabold mb-2 text-center text-gray-800">
            Forgot Password
          </h1>
          <p className="text-center text-gray-600 mb-6">
            Enter your admin email to receive a 6-digit OTP.
          </p>

          {error && (
            <div className="bg-red-200 text-red-600 p-3 mb-4 text-center rounded-lg">
              {error}
            </div>
          )}

          {successMsg && (
            <div className="bg-green-100 text-green-700 p-3 mb-4 text-center rounded-lg">
              {successMsg}
            </div>
          )}

          {loading ? (
            <Loading />
          ) : (
            <Formik
              initialValues={{ email: "" }}
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
                      className="w-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400"
                    />
                    <ErrorMessage
                      name="email"
                      component="div"
                      className="text-red-500 text-sm mt-1"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-blue-500 text-white p-4 rounded-lg hover:bg-blue-600 transition-colors duration-300 shadow-md"
                  >
                    {isSubmitting ? "Sending..." : "Send OTP"}
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
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminForgotPassword;
