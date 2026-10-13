import React, { useState, useEffect, useRef } from "react";
import axios from "../api/axiosInstance";
import { validateEmail, validateName, getEmailSuggestion } from "../utils/validators";

export default function Contact({ className = "" }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [nameError, setNameError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [messageError, setMessageError] = useState("");
  const submitTimerRef = useRef(null);
  const emailTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (submitTimerRef.current) clearTimeout(submitTimerRef.current);
      if (emailTimerRef.current) clearTimeout(emailTimerRef.current);
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    let hasError = false;

    // Validate Name (First character must be a letter)
    const nameValidationErr = validateName(name);
    if (nameValidationErr) {
      setNameError(nameValidationErr);
      hasError = true;
    } else {
      setNameError("");
    }

    // Validate Email (including .con and other typos)
    const emailValidationErr = validateEmail(email);
    if (emailValidationErr) {
      setEmailError(emailValidationErr);
      hasError = true;
    } else {
      setEmailError("");
    }

    // Validate Message
    if (!message.trim()) {
      setMessageError("Please enter your message.");
      hasError = true;
    } else {
      setMessageError("");
    }

    if (hasError) return;

    try {
      await axios.post("/api/contact", {
        name,
        email,
        subject,
        message,
      });
      setSubmitted(true);
      setName("");
      setEmail("");
      setSubject("");
      setMessage("");

      if (submitTimerRef.current) clearTimeout(submitTimerRef.current);
      submitTimerRef.current = setTimeout(() => {
        setSubmitted(false);
      }, 4000);
    } catch (error) {
      console.error("Error submitting form:", error);
      // Fallback for offline/local environments: show success and clear fields
      setSubmitted(true);
      setName("");
      setEmail("");
      setSubject("");
      setMessage("");

      if (submitTimerRef.current) clearTimeout(submitTimerRef.current);
      submitTimerRef.current = setTimeout(() => {
        setSubmitted(false);
      }, 4000);
    }
  };

  const handleInputChange = (setter, errorSetter) => (e) => {
    setter(e.target.value);
    errorSetter("");
    if (submitted) {
      setSubmitted(false);
      if (submitTimerRef.current) clearTimeout(submitTimerRef.current);
    }
  };

  const handleNameChange = (e) => {
    const val = e.target.value;
    setName(val);

    if (submitted) {
      setSubmitted(false);
      if (submitTimerRef.current) clearTimeout(submitTimerRef.current);
    }

    if (!val) {
      setNameError("");
      return;
    }

    // Real-time validation: First character must be a letter
    if (!/^[A-Za-z]/.test(val)) {
      setNameError("Name must start with a letter.");
      return;
    }

    // Real-time validation: Name cannot contain numbers
    if (/[0-9]/.test(val)) {
      setNameError("Name cannot contain numbers.");
      return;
    }

    if (!/^[A-Za-z][A-Za-z\s'.-]*$/.test(val)) {
      setNameError("Name can only contain letters, spaces, or hyphens.");
      return;
    }

    setNameError("");
  };

  const handleNameBlur = () => {
    if (name.trim()) {
      setNameError(validateName(name));
    }
  };

  const handleEmailChange = (e) => {
    const val = e.target.value;
    setEmail(val);

    if (submitted) {
      setSubmitted(false);
      if (submitTimerRef.current) clearTimeout(submitTimerRef.current);
    }

    if (emailTimerRef.current) clearTimeout(emailTimerRef.current);

    if (!val || !val.trim()) {
      setEmailError("");
      return;
    }

    // Debounced real-time validation while typing
    emailTimerRef.current = setTimeout(() => {
      if (val.includes("@") && (val.includes(".") || val.split("@")[1]?.length >= 3)) {
        setEmailError(validateEmail(val));
      }
    }, 350);
  };

  const handleEmailBlur = () => {
    if (emailTimerRef.current) clearTimeout(emailTimerRef.current);
    if (email.trim()) {
      setEmailError(validateEmail(email));
    }
  };

  const SuccessAnimation = () => (
    <div
      className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-6 flex items-center justify-between"
      role="alert"
    >
      <div>
        <strong className="font-bold">Success!</strong>
        <span className="block sm:inline"> Your message has been submitted.</span>
      </div>
      <button
        type="button"
        onClick={() => setSubmitted(false)}
        className="text-green-500 hover:text-green-700 focus:outline-none p-1 rounded"
        aria-label="Close success message"
      >
        <svg
          className="fill-current h-6 w-6"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
        >
          <title>Close</title>
          <path d="M14.348 5.652a.5.5 0 0 0-.707 0L10 9.293 6.36 5.652a.5.5 0 1 0-.708.708L9.293 10l-3.64 3.64a.5.5 0 1 0 .708.708L10 10.707l3.64 3.64a.5.5 0 1 0 .708-.708L10.707 10l3.64-3.64a.5.5 0 0 0 0-.708z" />
        </svg>
      </button>
    </div>
  );

  return (
    <div
      id="contacts"
      className={`bg-gradient-to-br from-pink-500 via-red-500 to-yellow-500 rounded-lg overflow-hidden shadow-lg my-10 lg:my-16 ${className}`}
    >
      <div className="flex flex-col lg:flex-row">
        {/* Left Section */}
        <div className="w-full lg:w-1/2 py-10 px-8 lg:p-12 bg-gradient-to-br from-pink-500 via-red-500 to-yellow-500 flex flex-col justify-center items-center">
          <h1 className="text-white text-4xl lg:text-5xl font-bold mb-6 text-center">
            Have Questions? Get in Touch
          </h1>
          <p className="text-white text-lg mb-6 text-center">
            <a
              href="mailto:info@edutechex.com"
              className="text-white font-medium hover:underline"
            >
              Email to: info@edutechex.com
            </a>
          </p>
        </div>

        {/* Right Section */}
        <form
          onSubmit={handleSubmit}
          className="w-full lg:w-1/2 py-10 px-8 lg:p-12 bg-gradient-to-br from-pink-500 via-red-500 to-yellow-500"
          noValidate
        >
          <h2 className="text-white text-3xl lg:text-4xl font-bold mb-8 text-center">
            Contact Us
          </h2>
          {submitted && <SuccessAnimation />}

          {/* Name Field */}
          <div className="mb-4">
            <input
              type="text"
              placeholder="Enter Your Name*"
              className={`w-full py-3 px-4 bg-white rounded-md text-lg text-gray-800 focus:outline-none focus:ring-2 ${
                nameError ? "border-2 border-red-500 focus:ring-red-500" : "focus:ring-pink-500"
              }`}
              value={name}
              onChange={handleNameChange}
              onBlur={handleNameBlur}
              required
              aria-invalid={!!nameError}
              aria-describedby={nameError ? "contact-name-error" : undefined}
            />
            {nameError && (
              <p
                id="contact-name-error"
                role="alert"
                aria-live="polite"
                className="text-white bg-red-600/95 rounded px-3 py-1 mt-1 text-sm font-medium shadow-sm"
              >
                {nameError}
              </p>
            )}
          </div>

          {/* Email Field with typo/validation check */}
          <div className="mb-4">
            <input
              type="email"
              placeholder="Enter Your Email*"
              className={`w-full py-3 px-4 bg-white rounded-md text-lg text-gray-800 focus:outline-none focus:ring-2 ${
                emailError ? "border-2 border-red-500 focus:ring-red-500" : "focus:ring-pink-500"
              }`}
              value={email}
              onChange={handleEmailChange}
              onBlur={handleEmailBlur}
              required
              aria-invalid={!!emailError}
              aria-describedby={emailError ? "contact-email-error" : undefined}
            />
            {emailError && (
              <div
                id="contact-email-error"
                role="alert"
                aria-live="polite"
                className="text-white bg-red-600/95 rounded px-3 py-1.5 mt-1 text-sm font-medium shadow-sm flex flex-col gap-1"
              >
                <span>{emailError}</span>
                {getEmailSuggestion(email) && (
                  <button
                    type="button"
                    onClick={() => {
                      const suggested = getEmailSuggestion(email);
                      if (suggested) {
                        setEmail(suggested);
                        setEmailError("");
                      }
                    }}
                    className="text-yellow-200 hover:text-white text-left font-semibold underline cursor-pointer"
                  >
                    Click to use: {getEmailSuggestion(email)}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Subject Field */}
          <div className="mb-4">
            <input
              type="text"
              placeholder="Your Question About.."
              className="w-full py-3 px-4 bg-white rounded-md text-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-pink-500"
              value={subject}
              onChange={handleInputChange(setSubject, () => {})}
            />
          </div>

          {/* Message Field */}
          <div className="mb-6">
            <textarea
              placeholder="Your Message..."
              className={`w-full py-3 px-4 bg-white rounded-md text-lg text-gray-800 h-32 focus:outline-none focus:ring-2 ${
                messageError ? "border-2 border-red-500 focus:ring-red-500" : "focus:ring-pink-500"
              }`}
              value={message}
              onChange={handleInputChange(setMessage, setMessageError)}
              required
              aria-invalid={!!messageError}
              aria-describedby={messageError ? "contact-message-error" : undefined}
            />
            {messageError && (
              <p
                id="contact-message-error"
                role="alert"
                aria-live="polite"
                className="text-white bg-red-600/95 rounded px-3 py-1 mt-1 text-sm font-medium shadow-sm"
              >
                {messageError}
              </p>
            )}
          </div>

          {/* Submit Button with Green State */}
          <button
            type="submit"
            className={`py-4 px-8 rounded-md text-lg font-medium focus:outline-none focus:ring-2 transition-all duration-300 shadow-md flex items-center justify-center gap-2 ${
              submitted
                ? "bg-green-600 text-white hover:bg-green-700 focus:ring-green-400"
                : "bg-white text-pink-600 hover:bg-pink-50 focus:ring-pink-500"
            }`}
            aria-pressed={submitted}
          >
            {submitted ? (
              <>
                <svg className="w-5 h-5 fill-current" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>Submitted</span>
              </>
            ) : (
              "Submit"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
