import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import EdutechexLogo from "../assets/Edutech-logo.png";
import FacebookIcon from "../assets/facebook-custom.png";
import TwitterIcon from "../assets/X_custom.png";
import FeedIcon from "../assets/youtube.png";
import LinkedinIcon from "../assets/linkedin_custom.png";
import { validateEmail, getEmailSuggestion } from "../utils/validators";
import axios from "../api/axiosInstance";

export default function Footer() {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const timerRef = useRef(null);

  const emailTimerRef = useRef(null);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (emailTimerRef.current) clearTimeout(emailTimerRef.current);
    };
  }, []);

  const handleSubscribe = async (e) => {
    e.preventDefault();

    if (emailTimerRef.current) clearTimeout(emailTimerRef.current);

    // Bug-022: Shared email validation helper
    const error = validateEmail(email);
    if (error) {
      setEmailError(error);
      return;
    }

    try {
      await axios.post("/api/contact/subscribe", { email });
    } catch (err) {
      console.error("Subscription request error:", err);
    }

    setEmailError("");
    setIsSubscribed(true);
    // Bug-020: Clear field after successful subscribe
    setEmail("");

    // Bug-021: Revert to "Subscribe" after ~3 seconds
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setIsSubscribed(false);
    }, 3000);
  };

  const handleEmailChange = (e) => {
    const val = e.target.value;
    setEmail(val);

    // Revert button to "Subscribe" when user edits input
    if (isSubscribed) {
      setIsSubscribed(false);
      if (timerRef.current) clearTimeout(timerRef.current);
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

  return (
    <footer className="bg-white text-gray-800 mt-10 py-12 border-t border-gray-200">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 items-start">
          {/* Footer Logo */}
          <div className="flex items-start justify-center md:justify-start md:col-span-1">
            {/* link to home (valid href) */}
            <a href="/" aria-label="Edutechex home">
              <img
                src={EdutechexLogo}
                alt="Edutechex logo"
                width={150}
                height={50}
              />
            </a>
          </div>

          {/* Contact Details */}
          <div className="md:col-span-1">
            <h5 className="font-semibold mb-4">Contact Details</h5>
            <p className="mt-2">
              Email:{" "}
              <a
                href="mailto:info@edutechex.com"
                className="text-blue-500 hover:underline"
              >
                info@edutechex.com
              </a>
            </p>
          </div>

          {/* Useful Links - Bug-019 */}
          <div className="md:col-span-1">
            <h5 className="font-semibold mb-4">Useful Links</h5>
            <ul className="space-y-2">
              <li>
                <Link to="/about" className="hover:text-gray-600">
                  About Edutechex
                </Link>
              </li>
              <li>
                <Link to="/visa" className="hover:text-gray-600">
                  Visa Information
                </Link>
              </li>
              <li>
                <Link to="/immigration-faq" className="hover:text-gray-600">
                  Immigration FAQ's
                </Link>
              </li>
              <li>
                <Link to="/contact" className="hover:text-gray-600">
                  Contact Us
                </Link>
              </li>
            </ul>
          </div>

          <div className="md:col-span-1">
            <h5 className="font-semibold mb-4">Stay Informed</h5>
            <p className="text-sm text-gray-800 mb-4">
              Subscribe to our newsletters to get the latest news and updates
            </p>
            <form className="flex flex-col gap-4" onSubmit={handleSubscribe} noValidate>
              <div className="flex flex-col gap-1">
                <input
                  type="email"
                  value={email}
                  onChange={handleEmailChange}
                  onBlur={handleEmailBlur}
                  placeholder="Your email address"
                  className={`py-2 px-3 text-sm text-gray-800 rounded border ${
                    emailError ? "border-red-500 focus:ring-red-500" : "border-gray-300 focus:ring-blue-500"
                  } focus:outline-none focus:ring-2`}
                  aria-label="Email address for newsletter subscription"
                  aria-invalid={!!emailError}
                  aria-describedby={emailError ? "footer-email-error" : undefined}
                />
                {emailError && (
                  <div
                    id="footer-email-error"
                    role="alert"
                    aria-live="polite"
                    className="text-red-500 text-xs flex flex-col gap-1 mt-1"
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
                        className="text-blue-600 hover:text-blue-800 text-left font-medium underline cursor-pointer"
                      >
                        Click to use: {getEmailSuggestion(email)}
                      </button>
                    )}
                  </div>
                )}
              </div>
              <button
                type="submit"
                className={`px-6 py-2 text-white text-sm rounded focus:outline-none focus:ring-2 text-center transition-all duration-300 flex items-center justify-center gap-1.5 ${
                  isSubscribed
                    ? "bg-green-600 hover:bg-green-700 focus:ring-green-500"
                    : "bg-blue-600 hover:bg-blue-700 focus:ring-blue-500"
                }`}
                aria-pressed={isSubscribed}
              >
                {isSubscribed ? (
                  <>
                    <svg className="w-4 h-4 fill-current inline-block" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span>Subscribed</span>
                  </>
                ) : (
                  "Subscribe"
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Social Media Links */}
        <div className="flex justify-center mt-8 space-x-4">
          <a
            href="https://www.facebook.com/edutechex"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-600 hover:text-gray-800 transition duration-300"
            aria-label="Edutechex on Facebook (opens in a new tab)"
          >
            <img src={FacebookIcon} alt="Facebook — Edutechex" width={24} height={24} />
          </a>
          <a
            href="https://twitter.com/edutechex"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-600 hover:text-gray-800 transition duration-300"
            aria-label="Edutechex on X (Twitter) (opens in a new tab)"
          >
            <img src={TwitterIcon} alt="X (Twitter) — Edutechex" width={24} height={24} />
          </a>
          <a
            href="https://www.youtube.com/edutechex"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-600 hover:text-gray-800 transition duration-300"
            aria-label="Edutechex on YouTube (opens in a new tab)"
          >
            <img src={FeedIcon} alt="YouTube — Edutechex" width={24} height={24} />
          </a>
          <a
            href="https://www.linkedin.com/company/edutechex"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-600 hover:text-gray-800 transition duration-300"
            aria-label="Edutechex on LinkedIn (opens in a new tab)"
          >
            <img src={LinkedinIcon} alt="LinkedIn — Edutechex" width={24} height={24} />
          </a>
        </div>

        {/* Copyright Text */}
        <div className="mt-8 text-center text-sm text-gray-800">
          <p>&copy; 2026 Edutechex. All Rights Reserved</p>
          <p>
            <Link to="/privacy" className="hover:text-gray-600">
              Privacy Policy
            </Link>
            <span className="mx-1">|</span>
            <Link to="/terms" className="hover:text-gray-600">
              Terms and Conditions
            </Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
