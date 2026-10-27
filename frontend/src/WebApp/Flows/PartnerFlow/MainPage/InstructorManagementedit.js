//File: InstructorManagementedit.js

import React, { useEffect, useMemo, useRef, useState, forwardRef } from "react";
import { createPortal } from "react-dom";
import axios from "../../../../api/axiosInstance";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTimes,
  faEnvelope,
  faStar,
  faShieldAlt,
  faClock,
  faIndianRupeeSign,
  faClipboardList,
  faPlus,
  faChevronDown,
  faCheck,
} from "@fortawesome/free-solid-svg-icons";
import {
  validateName,
  validateEmail,
  getEmailSuggestion,
  validateIndianMobile,
  extractIndianMobileDigits,
  formatIndianMobile,
  validateIndianPinCode,
  extractIndianPinCodeDigits,
} from "../../../../utils/validators";

/* ─── Shared style tokens ─── */
const inputCls =
  "!mt-0 w-full h-11 rounded-xl border border-slate-200 bg-white/95 px-4 text-sm text-slate-800 placeholder:text-slate-400 shadow-sm transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-violet-500/10 focus:border-violet-400 hover:border-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-gradient-to-r file:from-indigo-50 file:to-sky-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-indigo-700 file:cursor-pointer file:align-middle";
const fileInputCls =
  "!mt-0 w-full h-11 rounded-xl border border-slate-200 bg-white/95 px-3 py-[5px] text-sm text-slate-800 shadow-sm transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-violet-500/10 focus:border-violet-400 hover:border-slate-300 cursor-pointer flex items-center file:mr-3 file:rounded-lg file:border-0 file:bg-gradient-to-r file:from-indigo-50 file:to-sky-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-indigo-700 file:cursor-pointer file:align-middle";
const textareaCls =
  "!mt-0 w-full rounded-xl border border-slate-200 bg-white/95 px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 shadow-sm transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-violet-500/10 focus:border-violet-400 hover:border-slate-300 min-h-[7rem] resize-y";
const labelCls =
  "block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5";

const IndiaFlag = () => (
  <svg
    className="w-[18px] h-[13px] rounded-[2px] shadow-xs shrink-0 object-cover"
    viewBox="0 0 640 480"
    aria-hidden="true"
  >
    <path fill="#FF9933" d="M0 0h640v160H0z" />
    <path fill="#FFFFFF" d="M0 160h640v160H0z" />
    <path fill="#128807" d="M0 320h640v160H0z" />
    <circle cx="320" cy="240" r="28" fill="#000080" />
    <circle cx="320" cy="240" r="23" fill="#FFFFFF" />
    <circle cx="320" cy="240" r="7" fill="#000080" />
  </svg>
);

// ─── CustomSelect ─────────────────────────────────────────────────────────────
// Ensures the dropdown menu ("down box") strictly matches the width of the trigger ("top box")
const CustomSelect = forwardRef(({
  name,
  value,
  defaultValue = "",
  onChange,
  options = [],
  placeholder = "Select",
  required = false,
  disabled = false,
  className = "",
  error = "",
}, ref) => {
  const [isOpen, setIsOpen] = useState(false);
  const [internalValue, setInternalValue] = useState(defaultValue);
  const containerRef = useRef(null);
  const hiddenInputRef = useRef(null);

  const currentValue = value !== undefined ? value : internalValue;

  useEffect(() => {
    if (defaultValue !== undefined) {
      setInternalValue(defaultValue);
    }
  }, [defaultValue]);

  const setRefs = (el) => {
    hiddenInputRef.current = el;
    if (typeof ref === "function") ref(el);
    else if (ref) ref.current = el;
  };

  const normalizedOptions = useMemo(() => {
    return options.map((opt) =>
      typeof opt === "object" && opt !== null && "value" in opt
        ? opt
        : { value: opt, label: opt }
    );
  }, [options]);

  const selectedOption = normalizedOptions.find(
    (opt) => String(opt.value) === String(currentValue)
  );

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
      document.addEventListener("touchstart", handleOutsideClick);
    }
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("touchstart", handleOutsideClick);
    };
  }, [isOpen]);

  const handleSelect = (val) => {
    setInternalValue(val);
    if (onChange) {
      onChange({ target: { name, value: val } });
    }
    setIsOpen(false);
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full ${isOpen ? "z-[60]" : "z-[1]"}`}
    >
      <input
        type="hidden"
        name={name}
        value={currentValue || ""}
        required={required}
        ref={setRefs}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        className={`w-full h-11 rounded-xl border bg-white/95 px-4 text-sm shadow-sm transition-all duration-200 flex items-center justify-between text-left focus:outline-none focus:ring-4 focus:ring-violet-500/10 focus:border-violet-400 hover:border-slate-300 ${
          isOpen
            ? "border-violet-400 ring-4 ring-violet-500/10"
            : error
              ? "!border-rose-400 focus:!border-rose-500"
              : "border-slate-200"
        } ${disabled ? "opacity-60 cursor-not-allowed bg-slate-50" : "cursor-pointer"} ${className}`}
      >
        <span
          className={`truncate pr-2 ${
            selectedOption && selectedOption.value !== ""
              ? "text-slate-800 font-medium"
              : "text-slate-400 font-normal"
          }`}
        >
          {selectedOption && selectedOption.value !== ""
            ? selectedOption.label
            : placeholder}
        </span>
        <FontAwesomeIcon
          icon={faChevronDown}
          className={`text-xs text-slate-400 shrink-0 transition-transform duration-200 ${
            isOpen ? "rotate-180 text-violet-600" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div
          className="absolute z-[80] left-0 right-0 w-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl max-h-56 overflow-y-auto py-1 divide-y divide-slate-50"
          style={{ width: "100%", maxWidth: "100%", boxSizing: "border-box" }}
        >
          {normalizedOptions.length === 0 ? (
            <div className="px-4 py-3 text-xs text-slate-400 text-center">
              No options available
            </div>
          ) : (
            normalizedOptions.map((opt) => {
              const isSelected = String(currentValue) === String(opt.value);
              return (
                <div
                  key={opt.value}
                  onClick={() => handleSelect(opt.value)}
                  className={`px-4 py-2.5 text-xs sm:text-sm cursor-pointer transition-colors flex items-center justify-between ${
                    isSelected
                      ? "bg-violet-50 text-violet-700 font-semibold"
                      : "text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  <span className="truncate">{opt.label}</span>
                  {isSelected && opt.value !== "" && (
                    <span className="text-violet-600 text-xs font-bold">✓</span>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
});

// ─── CustomTimeSelect ─────────────────────────────────────────────────────────
// Time picker dropdown matching the exact width of the top box
const CustomTimeSelect = forwardRef(({
  name,
  value,
  defaultValue = "",
  onChange,
  placeholder = "--:--",
  required = false,
  disabled = false,
  className = "",
  error = "",
}, ref) => {
  const [isOpen, setIsOpen] = useState(false);
  const [internalValue, setInternalValue] = useState(defaultValue);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  const currentValue = value !== undefined ? value : internalValue;

  useEffect(() => {
    if (defaultValue !== undefined) {
      setInternalValue(defaultValue);
    }
  }, [defaultValue]);

  const setRefs = (el) => {
    inputRef.current = el;
    if (typeof ref === "function") ref(el);
    else if (ref) ref.current = el;
  };

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
      document.addEventListener("touchstart", handleOutsideClick);
    }
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("touchstart", handleOutsideClick);
    };
  }, [isOpen]);

  const [currentHour, currentMin] = (currentValue && currentValue.includes(":"))
    ? currentValue.split(":")
    : ["", ""];

  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
  const minutes = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));

  const handleHourSelect = (h) => {
    const m = currentMin || "00";
    const newVal = `${h}:${m}`;
    setInternalValue(newVal);
    if (onChange) onChange({ target: { name, value: newVal } });
  };

  const handleMinSelect = (m) => {
    const h = currentHour || "09";
    const newVal = `${h}:${m}`;
    setInternalValue(newVal);
    if (onChange) onChange({ target: { name, value: newVal } });
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full ${isOpen ? "z-[60]" : "z-[1]"}`}
    >
      <input
        type="hidden"
        name={name}
        value={currentValue || ""}
        required={required}
        ref={setRefs}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        className={`w-full h-11 rounded-xl border bg-white/95 px-4 text-sm shadow-sm transition-all duration-200 flex items-center justify-between text-left focus:outline-none focus:ring-4 focus:ring-violet-500/10 focus:border-violet-400 hover:border-slate-300 ${
          isOpen
            ? "border-violet-400 ring-4 ring-violet-500/10"
            : error
              ? "!border-rose-400 focus:!border-rose-500"
              : "border-slate-200"
        } ${disabled ? "opacity-60 cursor-not-allowed bg-slate-50" : "cursor-pointer"} ${className}`}
      >
        <span className={currentValue ? "text-slate-800 font-medium" : "text-slate-400 font-normal"}>
          {currentValue || placeholder}
        </span>
        <FontAwesomeIcon
          icon={faClock}
          className={`text-xs transition-colors ${
            isOpen ? "text-violet-600" : "text-slate-400"
          }`}
        />
      </button>

      {isOpen && (
        <div
          className="absolute z-[80] left-0 right-0 w-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden animate-fade-in"
          style={{ width: "100%", maxWidth: "100%", boxSizing: "border-box" }}
        >
          <div className="grid grid-cols-2 bg-slate-50 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider py-1.5 text-center">
            <span>Hour (24h)</span>
            <span>Minute</span>
          </div>

          <div className="grid grid-cols-2 divide-x divide-slate-100 h-44">
            <div className="overflow-y-auto py-1 scrollbar-thin">
              {hours.map((h) => {
                const isSelected = currentHour === h;
                return (
                  <button
                    key={h}
                    type="button"
                    onClick={() => handleHourSelect(h)}
                    className={`w-full py-1.5 text-xs text-center font-medium transition-colors ${
                      isSelected
                        ? "bg-violet-600 text-white font-bold"
                        : "text-slate-700 hover:bg-violet-50 hover:text-violet-700"
                    }`}
                  >
                    {h}
                  </button>
                );
              })}
            </div>

            <div className="overflow-y-auto py-1 scrollbar-thin">
              {minutes.map((m) => {
                const isSelected = currentMin === m;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => handleMinSelect(m)}
                    className={`w-full py-1.5 text-xs text-center font-medium transition-colors ${
                      isSelected
                        ? "bg-violet-600 text-white font-bold"
                        : "text-slate-700 hover:bg-violet-50 hover:text-violet-700"
                    }`}
                  >
                    {m}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="p-2 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                setInternalValue("");
                if (onChange) onChange({ target: { name, value: "" } });
              }}
              className="text-[11px] font-semibold text-slate-400 hover:text-rose-500 transition-colors"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-3 py-1 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-[11px] font-semibold transition-all active:scale-95 shadow-sm"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

const dayOpts = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const IN_STATES = [
  "Andaman and Nicobar Islands", "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar",
  "Chandigarh", "Chhattisgarh", "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Goa",
  "Gujarat", "Haryana", "Himachal Pradesh", "Jammu and Kashmir", "Jharkhand", "Karnataka",
  "Kerala", "Ladakh", "Lakshadweep", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya",
  "Mizoram", "Nagaland", "Odisha", "Puducherry", "Punjab", "Rajasthan", "Sikkim",
  "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal"
];

const TIMEZONES = [
  "Asia/Kolkata",
  "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
  "America/Phoenix", "America/Anchorage", "America/Honolulu",
  "America/Toronto", "America/Vancouver", "America/Edmonton", "America/Winnipeg",
  "America/Halifax", "America/St_Johns", "America/Regina", "America/Whitehorse",
  "America/Yellowknife", "America/Iqaluit",
];

const sectionThemes = {
  "Personal & Contact": {
    wrap:
      "rounded-3xl border border-slate-200/80 bg-gradient-to-br from-white via-sky-50/30 to-indigo-50/40 p-5 shadow-sm shadow-slate-200/60",
    title:
      "text-xs font-bold text-sky-700 uppercase tracking-widest flex items-center gap-2 after:content-[''] after:flex-1 after:h-px after:bg-gradient-to-r after:from-sky-300 after:via-indigo-200 after:to-transparent",
    icon: "text-sky-500 text-[10px]",
  },
  "Professional & Teaching": {
    wrap:
      "rounded-3xl border border-slate-200/80 bg-gradient-to-br from-white via-violet-50/25 to-fuchsia-50/35 p-5 shadow-sm shadow-slate-200/60",
    title:
      "text-xs font-bold text-violet-700 uppercase tracking-widest flex items-center gap-2 after:content-[''] after:flex-1 after:h-px after:bg-gradient-to-r after:from-violet-300 after:via-fuchsia-200 after:to-transparent",
    icon: "text-violet-500 text-[10px]",
  },
  Availability: {
    wrap:
      "rounded-3xl border border-slate-200/80 bg-gradient-to-br from-white via-cyan-50/25 to-blue-50/35 p-5 shadow-sm shadow-slate-200/60",
    title:
      "text-xs font-bold text-cyan-700 uppercase tracking-widest flex items-center gap-2 after:content-[''] after:flex-1 after:h-px after:bg-gradient-to-r after:from-cyan-300 after:via-blue-200 after:to-transparent",
    icon: "text-cyan-500 text-[10px]",
  },
  "Compensation / Payout": {
    wrap:
      "rounded-3xl border border-slate-200/80 bg-gradient-to-br from-white via-emerald-50/25 to-teal-50/35 p-5 shadow-sm shadow-slate-200/60",
    title:
      "text-xs font-bold text-emerald-700 uppercase tracking-widest flex items-center gap-2 after:content-[''] after:flex-1 after:h-px after:bg-gradient-to-r after:from-emerald-300 after:via-teal-200 after:to-transparent",
    icon: "text-emerald-500 text-[10px]",
  },
  "Compliance & Documents": {
    wrap:
      "rounded-3xl border border-slate-200/80 bg-gradient-to-br from-white via-amber-50/25 to-orange-50/35 p-5 shadow-sm shadow-slate-200/60",
    title:
      "text-xs font-bold text-amber-700 uppercase tracking-widest flex items-center gap-2 after:content-[''] after:flex-1 after:h-px after:bg-gradient-to-r after:from-amber-300 after:via-orange-200 after:to-transparent",
    icon: "text-amber-500 text-[10px]",
  },
  Assignment: {
    wrap:
      "rounded-3xl border border-slate-200/80 bg-gradient-to-br from-white via-rose-50/20 to-pink-50/30 p-5 shadow-sm shadow-slate-200/60",
    title:
      "text-xs font-bold text-rose-700 uppercase tracking-widest flex items-center gap-2 after:content-[''] after:flex-1 after:h-px after:bg-gradient-to-r after:from-rose-300 after:via-pink-200 after:to-transparent",
    icon: "text-rose-500 text-[10px]",
  },
};

const defaultSectionTheme = {
  wrap:
    "rounded-3xl border border-slate-200/80 bg-gradient-to-br from-white via-slate-50 to-indigo-50/20 p-5 shadow-sm shadow-slate-200/60",
  title:
    "text-xs font-bold text-indigo-700 uppercase tracking-widest flex items-center gap-2 after:content-[''] after:flex-1 after:h-px after:bg-gradient-to-r after:from-indigo-300 after:to-transparent",
  icon: "text-indigo-500 text-[10px]",
};

/* ─── Form section wrapper ─── */
const FormSection = ({ title, icon, children }) => {
  const theme = sectionThemes[title] || defaultSectionTheme;

  return (
    <div className={`space-y-5 ${theme.wrap}`}>
      <div className={theme.title}>
        {icon && <FontAwesomeIcon icon={icon} className={theme.icon} />}
        {title}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-4 sm:gap-x-5 gap-y-5">{children}</div>
    </div>
  );
};

/* ─── Field wrapper ─── */
const Field = ({ label, required, span = 1, children }) => (
  <div className={`flex flex-col justify-start ${span === 2 ? "sm:col-span-2 md:col-span-2" : span === 3 ? "sm:col-span-3 md:col-span-3" : ""}`}>
    <label className={labelCls}>
      {label} {required && <span className="text-rose-500">*</span>}
    </label>
    {children}
  </div>
);

export default function InstructorManagementedit({ open, item, onClose, onSaved }) {
  const authCfg = () => {
    const token =
      localStorage.getItem("partnerToken") ||
      localStorage.getItem("token") ||
      sessionStorage.getItem("partnerToken");
    const cfg = { withCredentials: true };
    if (token) cfg.headers = { Authorization: `Bearer ${token}` };
    return cfg;
  };

  const [submitting, setSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [otpOpen, setOtpOpen] = useState(false);
  const [otpEmail, setOtpEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [pendingFormData, setPendingFormData] = useState(null);
  const [pendingId, setPendingId] = useState(null);
  const [portalTarget, setPortalTarget] = useState(null);
  const [alertInfo, setAlertInfo] = useState(null);

  const showAlert = (message, type = "success", title) => {
    setAlertInfo({ message, type, title });
  };

  const itemId = useMemo(() => item?._id || item?.id, [item]);

  const initialCountry = item?.country === "India" ? "India" : "India";
  const [country, setCountry] = useState(initialCountry);
  const [stateProv, setStateProv] = useState(item?.state || "");
  const [city, setCity] = useState(item?.city || "");
  const [postalCode, setPostalCode] = useState(() => extractIndianPinCodeDigits(item?.postalCode));
  const [postalError, setPostalError] = useState("");
  const [address1, setAddress1] = useState(item?.address1 || "");
  const [address2, setAddress2] = useState(item?.address2 || "");

  const phoneRef = useRef(null);
  const altPhoneRef = useRef(null);
  const postalRef = useRef(null);
  const emailRef = useRef(null);
  const firstNameRef = useRef(null);
  const lastNameRef = useRef(null);
  const [firstName, setFirstName] = useState(() => item?.firstName || "");
  const [lastName, setLastName] = useState(() => item?.lastName || "");
  const [firstNameError, setFirstNameError] = useState("");
  const [lastNameError, setLastNameError] = useState("");
  const [email, setEmail] = useState(() => (item?.email || "").trim());
  const [emailError, setEmailError] = useState("");
  const [emailSuggestion, setEmailSuggestion] = useState("");
  const [phone, setPhone] = useState(() => extractIndianMobileDigits(item?.phone));
  const [altPhone, setAltPhone] = useState(() => extractIndianMobileDigits(item?.altPhone));
  const [phoneError, setPhoneError] = useState("");
  const [altPhoneError, setAltPhoneError] = useState("");

  useEffect(() => {
    setFirstName(item?.firstName || "");
    setLastName(item?.lastName || "");
    setFirstNameError("");
    setLastNameError("");
    setEmail((item?.email || "").trim());
    setEmailError("");
    setEmailSuggestion("");
    setPhone(extractIndianMobileDigits(item?.phone));
    setAltPhone(extractIndianMobileDigits(item?.altPhone));
    setPostalCode(extractIndianPinCodeDigits(item?.postalCode));
    setPhoneError("");
    setAltPhoneError("");
    setPostalError("");
  }, [item, open]);

  const [currency, setCurrency] = useState(item?.currency || "INR");

  useEffect(() => {
    setCurrency((c) => {
      if (country === "India" && !c) return "INR";
      return c;
    });
  }, [country]);

  const [payoutMethod, setPayoutMethod] = useState(() => {
    const inMethods = ["Bank Transfer (NEFT/RTGS)", "UPI", "Razorpay"];
    const m = item?.payoutMethod;
    if (initialCountry === "India") return inMethods.includes(m) ? m : "Bank Transfer (NEFT/RTGS)";
    return inMethods.includes(m) ? m : "Bank Transfer (NEFT/RTGS)";
  });

  useEffect(() => {
    if (typeof document !== "undefined" && document.body) {
      setPortalTarget(document.body);
    }
  }, []);

  useEffect(() => {
    const inMethods = ["Bank Transfer (NEFT/RTGS)", "UPI", "Razorpay"];
    if (country === "India" && !inMethods.includes(payoutMethod)) {
      setPayoutMethod("Bank Transfer (NEFT/RTGS)");
    }
  }, [country, payoutMethod]);

  const [availStart, setAvailStart] = useState(item?.availableStart || "");
  const [availEnd, setAvailEnd] = useState(item?.availableEnd || "");
  const [tz, setTz] = useState(item?.timezone || "Asia/Kolkata");

  const [prefSlots, setPrefSlots] = useState(
    Array.isArray(item?.preferableSlots)
      ? item.preferableSlots.map((s) => ({ start: s.start || "", end: s.end || "" }))
      : []
  );

  const addPrefSlot = () => setPrefSlots((p) => [...p, { start: "", end: "" }]);
  const updatePrefSlot = (idx, field, value) =>
    setPrefSlots((p) => p.map((s, i) => (i === idx ? { ...s, [field]: value } : s)));
  const removePrefSlot = (idx) => setPrefSlots((p) => p.filter((_, i) => i !== idx));

  const startRef = useRef(null);
  const endRef = useRef(null);
  const prefStartRefs = useRef([]);
  const prefEndRefs = useRef([]);

  const stateList = IN_STATES;
  const stateLabel = "State / Union Territory";
  const postalLabel = "PIN Code";
  const phonePlaceholder = "+91 98765 43210";
  const cityPlaceholder = "e.g., Mumbai";
  const address1Placeholder = "Flat, house no., street address";

  const payIdPlaceholder =
    payoutMethod === "Bank Transfer (NEFT/RTGS)"
      ? "Account No. & IFSC (e.g., 123456789 | SBIN0000123)"
      : payoutMethod === "UPI"
        ? "UPI ID (e.g., name@okicici)"
        : "Razorpay email / ID";

  const toCSV = (arr) =>
    Array.isArray(arr) ? arr.join(", ") : typeof arr === "string" ? arr : "";

  const initialSkills = toCSV(item?.skills);
  const initialLanguages = toCSV(item?.languages);

  /* ─── Submit Step 1: validate & trigger OTP ─── */
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!itemId) return;
    setSubmitting(true);

    [...e.currentTarget.querySelectorAll('input[name="availableDays"]')].forEach((el) =>
      el.setCustomValidity("")
    );
    startRef.current?.setCustomValidity("");
    endRef.current?.setCustomValidity("");
    (prefStartRefs.current || []).forEach((el) => el?.setCustomValidity(""));
    (prefEndRefs.current || []).forEach((el) => el?.setCustomValidity(""));

      const form = e.currentTarget;
      form.querySelector('[name="country"]')?.setCustomValidity("");
      form.querySelector('[name="state"]')?.setCustomValidity("");
      form.querySelector('[name="city"]')?.setCustomValidity("");
      form.querySelector('[name="postalCode"]')?.setCustomValidity("");
      form.querySelector('[name="address1"]')?.setCustomValidity("");
      firstNameRef.current?.setCustomValidity("");
      lastNameRef.current?.setCustomValidity("");

      if (!country) form.querySelector('[name="country"]')?.setCustomValidity("Please fill in this field.");
      if (!stateProv) form.querySelector('[name="state"]')?.setCustomValidity("Please fill in this field.");
      if (!city) form.querySelector('[name="city"]')?.setCustomValidity("Please fill in this field.");
      form.querySelector('[name="postalCode"]')?.setCustomValidity("");
      postalRef.current?.setCustomValidity("");
      if (!address1) form.querySelector('[name="address1"]')?.setCustomValidity("Please fill in this field.");

      if (!form.checkValidity()) {
        form.reportValidity();
        setSubmitting(false);
        return;
      }

      try {
        const fd = new FormData(form);

      const fName = (firstName || fd.get("firstName") || "").trim();
      const fnErr = validateName(fName);
      if (fnErr) {
        setFirstNameError(fnErr);
        firstNameRef.current?.setCustomValidity(fnErr);
        firstNameRef.current?.reportValidity();
        setSubmitting(false);
        return;
      }

      const lName = (lastName || fd.get("lastName") || "").trim();
      const lnErr = validateName(lName);
      if (lnErr) {
        setLastNameError(lnErr);
        lastNameRef.current?.setCustomValidity(lnErr);
        lastNameRef.current?.reportValidity();
        setSubmitting(false);
        return;
      }
      const availableDays = fd.getAll("availableDays");

      if (availableDays.length === 0) {
        const firstBox = form.querySelector('input[name="availableDays"]');
        if (firstBox) {
          firstBox.setCustomValidity("Select at least one weekday.");
          firstBox.reportValidity();
        }
        setSubmitting(false);
        return;
      }

      const start = fd.get("availableStart");
      const end = fd.get("availableEnd");

      emailRef.current?.setCustomValidity("");
      phoneRef.current?.setCustomValidity("");
      altPhoneRef.current?.setCustomValidity("");
      postalRef.current?.setCustomValidity("");

      const emailErr = validateEmail(email);
      if (emailErr) {
        setEmailError(emailErr);
        setEmailSuggestion(getEmailSuggestion(email) || "");
        emailRef.current?.setCustomValidity(emailErr);
        emailRef.current?.reportValidity();
        setSubmitting(false);
        return;
      }

      const pinErr = validateIndianPinCode(postalCode, true);
      if (pinErr) {
        setPostalError(pinErr);
        postalRef.current?.setCustomValidity(pinErr);
        postalRef.current?.reportValidity();
        setSubmitting(false);
        return;
      }

      const pErr = validateIndianMobile(phone, true);
      if (pErr) {
        setPhoneError(pErr);
        phoneRef.current?.setCustomValidity(pErr);
        phoneRef.current?.reportValidity();
        setSubmitting(false);
        return;
      }
      if (altPhone) {
        const apErr = validateIndianMobile(altPhone, false);
        if (apErr) {
          setAltPhoneError(apErr);
          altPhoneRef.current?.setCustomValidity(apErr);
          altPhoneRef.current?.reportValidity();
          setSubmitting(false);
          return;
        }
        if (phone === altPhone) {
          const dupErr = "Alternate phone cannot be the same as primary mobile number.";
          setAltPhoneError(dupErr);
          altPhoneRef.current?.setCustomValidity(dupErr);
          altPhoneRef.current?.reportValidity();
          setSubmitting(false);
          return;
        }
      }

      if (start && end && end <= start) {
        endRef.current?.setCustomValidity("End Time must be AFTER Start Time.");
        endRef.current?.reportValidity();
        setSubmitting(false);
        return;
      }

      const cleanedSlots = (prefSlots || [])
        .filter((s) => s.start && s.end)
        .map((s) => ({ start: s.start, end: s.end }));

      for (let i = 0; i < cleanedSlots.length; i++) {
        const s = cleanedSlots[i];

        if (!(s.start < s.end)) {
          prefEndRefs.current[i]?.setCustomValidity("End must be after Start for this slot.");
          prefEndRefs.current[i]?.reportValidity();
          setSubmitting(false);
          return;
        }

        if (start && s.start < start) {
          prefStartRefs.current[i]?.setCustomValidity(
            `Slot ${i + 1}: Start must be ≥ overall Start (${start}).`
          );
          prefStartRefs.current[i]?.reportValidity();
          setSubmitting(false);
          return;
        }

        if (end && s.end > end) {
          prefEndRefs.current[i]?.setCustomValidity(
            `Slot ${i + 1}: End must be ≤ overall End (${end}).`
          );
          prefEndRefs.current[i]?.reportValidity();
          setSubmitting(false);
          return;
        }
      }

      const sorted = cleanedSlots
        .map((s, idx) => ({ ...s, __idx: idx }))
        .sort((a, b) => a.start.localeCompare(b.start));

      for (let i = 1; i < sorted.length; i++) {
        if (sorted[i].start < sorted[i - 1].end) {
          const laterEl = prefStartRefs.current[sorted[i].__idx];
          laterEl?.setCustomValidity("Preferable Time Slots cannot overlap.");
          laterEl?.reportValidity();
          setSubmitting(false);
          return;
        }
      }

      const ndaSigned = fd.get("ndaSigned") === "on";
      const agreeToTerms = fd.get("agreeToTerms") === "on";

      const payload = {
        firstName: fd.get("firstName") || "",
        lastName: fd.get("lastName") || "",
        email: (email || fd.get("email") || "").trim(),
        phone: formatIndianMobile(phone),
        altPhone: altPhone ? formatIndianMobile(altPhone) : "",
        country,
        state: fd.get("state") || "",
        city: fd.get("city") || "",
        postalCode: extractIndianPinCodeDigits(postalCode),
        address1: fd.get("address1") || "",
        address2: fd.get("address2") || "",
        qualification: fd.get("qualification") || "",
        experienceYears: fd.get("experienceYears") ? Number(fd.get("experienceYears")) : null,
        organization: fd.get("organization") || "",
        specializations: (fd.get("specializations") || "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        skills: (fd.get("skills") || "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        languages: (fd.get("languages") || "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        teachingMode: fd.get("teachingMode") || "Online",
        bio: fd.get("bio") || "",
        availableDays,
        availableStart: start || "",
        availableEnd: end || "",
        timezone: fd.get("timezone") || tz,
        preferableSlots: cleanedSlots,
        rateType: fd.get("rateType") || "Hourly",
        expectedRate: fd.get("expectedRate") ? Number(fd.get("expectedRate")) : null,
        currency,
        payoutMethod,
        payoutIdentifier: fd.get("payoutIdentifier") || "",
        backgroundCheck: fd.get("backgroundCheck") || "Pending",
        ndaSigned,
        agreeToTerms,
        assignInternship: fd.get("assignInternship") || "",
        notes: fd.get("notes") || "",
      };

      const resume = fd.get("resume");
      const photo = fd.get("photo");
      const certs = fd.getAll("certificates");

      const formData = new FormData();
      formData.append(
        "payload",
        new Blob([JSON.stringify(payload)], { type: "application/json" })
      );

      if (resume instanceof File && resume.size) formData.append("resume", resume);
      if (photo instanceof File && photo.size) formData.append("photo", photo);
      (certs || [])
        .filter((f) => f && f.size)
        .forEach((file) => formData.append("certificates", file));

      const emailForOtp = payload.email;
      if (!emailForOtp) {
        showAlert("Email is required to send OTP.", "error");
        setSubmitting(false);
        return;
      }

      await axios.post("/api/instructors/otp/start", { email: emailForOtp }, authCfg());

      setPendingFormData(formData);
      setPendingId(itemId);
      setOtpEmail(emailForOtp);
      setOtpOpen(true);
    } catch (err) {
      console.error("Edit start failed:", err);
      showAlert(err?.response?.data?.message || "Failed to start OTP for update.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  /* ─── Submit Step 2: verify OTP then PUT ─── */
  const doVerifyAndSave = async () => {
    if (!pendingId || !pendingFormData) return;

    try {
      await axios.post(
        "/api/instructors/otp/verify",
        { email: otpEmail, otp: otpCode },
        authCfg()
      );

      const { data } = await axios.put(
        `/api/instructors/${pendingId}`,
        pendingFormData,
        authCfg()
      );

      onSaved?.(data);
      setOtpOpen(false);
      setOtpCode("");
      setPendingFormData(null);
      setPendingId(null);
    } catch (err) {
      console.error("Verify/Save failed:", err);
      showAlert(err?.response?.data?.message || "Invalid OTP or update failed.", "error");
    }
  };

  if (!open || !portalTarget) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/45 backdrop-blur-[3px]"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white w-full max-w-4xl max-h-[92vh] rounded-[28px] shadow-[0_25px_60px_-15px_rgba(15,23,42,0.35)] flex flex-col overflow-hidden border border-slate-200/70">
        {/* ── Header ── */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-7 py-4 border-b border-slate-100 bg-white/95 backdrop-blur-sm">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Edit Instructor Details</h2>
            {(item?.firstName || item?.lastName) && (
              <p className="text-xs text-slate-400 mt-0.5">
                {item.firstName} {item.lastName}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        {/* ── Body ── */}
        <div id="wizard-scroll-container" className="p-7 overflow-y-auto flex-1 min-h-0 bg-gradient-to-b from-slate-50/70 via-white to-slate-50/60">
          <form onSubmit={handleSubmit} className="space-y-7" noValidate>
            {/* ── Personal & Contact ── */}
            <div className={currentStep === 1 ? 'block animate-fade-in' : 'hidden'}>
                      <FormSection title="Personal & Contact" icon={faEnvelope}>
              <Field label="First Name" required>
                <input
                  ref={firstNameRef}
                  name="firstName"
                  required
                  value={firstName}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFirstName(val);
                    const err = validateName(val);
                    firstNameRef.current?.setCustomValidity(err || "");
                    setFirstNameError(err);
                  }}
                  className={`${inputCls} ${
                    firstNameError
                      ? "!border-rose-400 focus:!border-rose-500 focus:!ring-rose-500/10"
                      : ""
                  }`}
                  placeholder="e.g., Priya"
                />
                {firstNameError && (
                  <p className="mt-1 text-xs text-rose-500 font-medium">
                    {firstNameError}
                  </p>
                )}
              </Field>

              <Field label="Last Name" required>
                <input
                  ref={lastNameRef}
                  name="lastName"
                  required
                  value={lastName}
                  onChange={(e) => {
                    const val = e.target.value;
                    setLastName(val);
                    const err = validateName(val);
                    lastNameRef.current?.setCustomValidity(err || "");
                    setLastNameError(err);
                  }}
                  className={`${inputCls} ${
                    lastNameError
                      ? "!border-rose-400 focus:!border-rose-500 focus:!ring-rose-500/10"
                      : ""
                  }`}
                  placeholder="e.g., Sharma"
                />
                {lastNameError && (
                  <p className="mt-1 text-xs text-rose-500 font-medium">
                    {lastNameError}
                  </p>
                )}
              </Field>

              <Field label="Email" required>
                <input
                  ref={emailRef}
                  type="email"
                  name="email"
                  required
                  value={email}
                  onChange={(e) => {
                    const val = e.target.value;
                    setEmail(val);
                    if (!val || !val.trim()) {
                      setEmailError("Email is required.");
                      setEmailSuggestion("");
                      emailRef.current?.setCustomValidity("Email is required.");
                    } else {
                      const err = validateEmail(val);
                      const sug = getEmailSuggestion(val);
                      setEmailError(err || "");
                      setEmailSuggestion(sug || "");
                      emailRef.current?.setCustomValidity(err || "");
                    }
                  }}
                  onBlur={() => {
                    const err = validateEmail(email);
                    const sug = getEmailSuggestion(email);
                    setEmailError(err || "");
                    setEmailSuggestion(sug || "");
                    emailRef.current?.setCustomValidity(err || "");
                  }}
                  className={`${inputCls} ${emailError ? "!border-rose-400 focus:!border-rose-500 focus:!ring-rose-500/10" : ""}`}
                  placeholder="name@example.com"
                />
                {emailError && (
                  <div className="mt-1.5 text-xs text-rose-500 font-medium">
                    <p className="flex items-center gap-1">
                      <span className="text-rose-400">⚠️</span> {emailError}
                    </p>
                    {emailSuggestion && (
                      <button
                        type="button"
                        onClick={() => {
                          setEmail(emailSuggestion);
                          setEmailError("");
                          setEmailSuggestion("");
                          emailRef.current?.setCustomValidity("");
                        }}
                        className="mt-1 inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-semibold underline cursor-pointer"
                      >
                        <span>💡 Did you mean <strong>{emailSuggestion}</strong>? Click to use.</span>
                      </button>
                    )}
                  </div>
                )}
              </Field>

              <Field label="Mobile" required>
                <div
                  className={`flex items-center w-full h-11 rounded-xl border bg-white/95 shadow-sm transition-all duration-200 overflow-hidden focus-within:ring-4 focus-within:ring-violet-500/10 focus-within:border-violet-400 hover:border-slate-300 ${
                    phoneError
                      ? "!border-rose-400 focus-within:!border-rose-500 focus-within:!ring-rose-500/10"
                      : "border-slate-200"
                  }`}
                  onClick={() => phoneRef.current?.focus()}
                >
                  <div className="flex items-center gap-1.5 pl-3.5 pr-2.5 text-slate-600 font-semibold text-xs sm:text-sm select-none shrink-0">
                    <IndiaFlag />
                    <span className="text-slate-700 font-semibold text-xs sm:text-sm">+91</span>
                    <span className="ml-1 h-4 w-px bg-slate-200"></span>
                  </div>
                  <input
                    ref={phoneRef}
                    type="tel"
                    name="phone"
                    required
                    inputMode="numeric"
                    maxLength={10}
                    value={phone}
                    onChange={(e) => {
                      const val = e.target.value;
                      const digits = extractIndianMobileDigits(val);
                      setPhone(digits);
                      if (digits.length === 0) {
                        setPhoneError("Mobile number is required.");
                        phoneRef.current?.setCustomValidity("Mobile number is required.");
                      } else if (!/^[6-9]/.test(digits)) {
                        setPhoneError("Indian mobile numbers must start with 6, 7, 8, or 9.");
                        phoneRef.current?.setCustomValidity("Indian mobile numbers must start with 6, 7, 8, or 9.");
                      } else if (digits.length < 10) {
                        setPhoneError(`Mobile number must be 10 digits (${digits.length}/10).`);
                        phoneRef.current?.setCustomValidity(`Mobile number must be 10 digits (${digits.length}/10).`);
                      } else {
                        setPhoneError("");
                        phoneRef.current?.setCustomValidity("");
                      }
                    }}
                    onBlur={() => {
                      const err = validateIndianMobile(phone, true);
                      setPhoneError(err);
                      phoneRef.current?.setCustomValidity(err);
                    }}
                    placeholder="98765 43210"
                    className="input-reset !mt-0 !border-0 focus:!border-0 !outline-none !shadow-none !bg-transparent w-full h-full pl-1.5 pr-3 text-sm text-slate-800 placeholder:text-slate-400 flex-1 min-w-0"
                    style={{ marginTop: 0, border: "none", outline: "none", boxShadow: "none" }}
                  />
                </div>
                {phoneError && (
                  <p className="mt-1.5 text-xs text-rose-500 font-medium flex items-center gap-1">
                    <span className="text-rose-400">⚠️</span> {phoneError}
                  </p>
                )}
              </Field>

              <Field label="Alternate Phone">
                <div
                  className={`flex items-center w-full h-11 rounded-xl border bg-white/95 shadow-sm transition-all duration-200 overflow-hidden focus-within:ring-4 focus-within:ring-violet-500/10 focus-within:border-violet-400 hover:border-slate-300 ${
                    altPhoneError
                      ? "!border-rose-400 focus-within:!border-rose-500 focus-within:!ring-rose-500/10"
                      : "border-slate-200"
                  }`}
                  onClick={() => altPhoneRef.current?.focus()}
                >
                  <div className="flex items-center gap-1.5 pl-3.5 pr-2.5 text-slate-600 font-semibold text-xs sm:text-sm select-none shrink-0">
                    <IndiaFlag />
                    <span className="text-slate-700 font-semibold text-xs sm:text-sm">+91</span>
                    <span className="ml-1 h-4 w-px bg-slate-200"></span>
                  </div>
                  <input
                    ref={altPhoneRef}
                    type="tel"
                    name="altPhone"
                    inputMode="numeric"
                    maxLength={10}
                    value={altPhone}
                    onChange={(e) => {
                      const val = e.target.value;
                      const digits = extractIndianMobileDigits(val);
                      setAltPhone(digits);
                      if (digits.length === 0) {
                        setAltPhoneError("");
                        altPhoneRef.current?.setCustomValidity("");
                      } else if (!/^[6-9]/.test(digits)) {
                        setAltPhoneError("Indian mobile numbers must start with 6, 7, 8, or 9.");
                        altPhoneRef.current?.setCustomValidity("Indian mobile numbers must start with 6, 7, 8, or 9.");
                      } else if (digits.length < 10) {
                        setAltPhoneError(`Alternate phone must be 10 digits (${digits.length}/10).`);
                        altPhoneRef.current?.setCustomValidity(`Alternate phone must be 10 digits (${digits.length}/10).`);
                      } else if (digits === phone) {
                        setAltPhoneError("Alternate phone cannot be the same as primary mobile number.");
                        altPhoneRef.current?.setCustomValidity("Alternate phone cannot be the same as primary mobile number.");
                      } else {
                        setAltPhoneError("");
                        altPhoneRef.current?.setCustomValidity("");
                      }
                    }}
                    onBlur={() => {
                      const err = validateIndianMobile(altPhone, false);
                      if (!err && altPhone && altPhone === phone) {
                        const dupErr = "Alternate phone cannot be the same as primary mobile number.";
                        setAltPhoneError(dupErr);
                        altPhoneRef.current?.setCustomValidity(dupErr);
                      } else {
                        setAltPhoneError(err);
                        altPhoneRef.current?.setCustomValidity(err);
                      }
                    }}
                    placeholder="98765 43210"
                    className="input-reset !mt-0 !border-0 focus:!border-0 !outline-none !shadow-none !bg-transparent w-full h-full pl-1.5 pr-3 text-sm text-slate-800 placeholder:text-slate-400 flex-1 min-w-0"
                    style={{ marginTop: 0, border: "none", outline: "none", boxShadow: "none" }}
                  />
                </div>
                {altPhoneError && (
                  <p className="mt-1.5 text-xs text-rose-500 font-medium flex items-center gap-1">
                    <span className="text-rose-400">⚠️</span> {altPhoneError}
                  </p>
                )}
              </Field>

              <Field label="Country" required>
                <CustomSelect
                  name="country"
                  required
                  value={country}
                  onChange={(e) => {
                    setCountry(e.target.value);
                    setStateProv("");
                    setCity("");
                    setPostalCode("");
                    setAddress1("");
                    setAddress2("");
                  }}
                  options={[
                    { value: "India", label: "India" }
                  ]}
                  placeholder="Select Country"
                />
              </Field>

              <Field label={stateLabel} required>
                <CustomSelect
                  name="state"
                  required
                  disabled={!country}
                  value={stateProv}
                  onChange={(e) => setStateProv(e.target.value)}
                  options={[
                    { value: "", label: "Select State" },
                    ...stateList.map((s) => ({ value: s, label: s }))
                  ]}
                  placeholder="Select State"
                />
              </Field>

              <Field label="City" required>
                <input
                  name="city"
                  required
                  className={inputCls}
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder={cityPlaceholder}
                />
              </Field>

              <Field label={postalLabel} required>
                <input
                  ref={postalRef}
                  name="postalCode"
                  required
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  className={`${inputCls} font-mono tracking-wide ${postalError ? "!border-rose-400 focus:!border-rose-500 focus:!ring-rose-500/10" : ""}`}
                  value={postalCode}
                  onChange={(e) => {
                    const val = e.target.value;
                    const digits = extractIndianPinCodeDigits(val);
                    setPostalCode(digits);
                    if (digits.length === 0) {
                      setPostalError("PIN code is required.");
                      postalRef.current?.setCustomValidity("PIN code is required.");
                    } else if (digits.startsWith("0")) {
                      setPostalError("PIN code cannot start with 0 (must start with 1-9).");
                      postalRef.current?.setCustomValidity("PIN code cannot start with 0 (must start with 1-9).");
                    } else if (digits.length < 6) {
                      setPostalError(`PIN code must be 6 digits (${digits.length}/6).`);
                      postalRef.current?.setCustomValidity(`PIN code must be 6 digits (${digits.length}/6).`);
                    } else {
                      setPostalError("");
                      postalRef.current?.setCustomValidity("");
                    }
                  }}
                  onBlur={() => {
                    const err = validateIndianPinCode(postalCode, true);
                    setPostalError(err);
                    postalRef.current?.setCustomValidity(err);
                  }}
                  placeholder="400001"
                />
                {postalError && (
                  <p className="mt-1.5 text-xs text-rose-500 font-medium flex items-center gap-1">
                    <span className="text-rose-400">⚠️</span> {postalError}
                  </p>
                )}
              </Field>

              <Field label="Address Line 1" required span={2}>
                <input
                  name="address1"
                  required
                  className={inputCls}
                  value={address1}
                  onChange={(e) => setAddress1(e.target.value)}
                  placeholder={address1Placeholder}
                />
              </Field>

              <Field label="Address Line 2">
                <input
                  name="address2"
                  className={inputCls}
                  value={address2}
                  onChange={(e) => setAddress2(e.target.value)}
                  placeholder="Optional"
                />
              </Field>
            </FormSection>
                    </div>

            {/* ── Professional & Teaching ── */}
            <div className={currentStep === 2 ? 'block animate-fade-in' : 'hidden'}>
                      <FormSection title="Professional & Teaching" icon={faStar}>
              <Field label="Highest Qualification" required>
                <CustomSelect
                  name="qualification"
                  required
                  defaultValue={item?.qualification || ""}
                  options={[
                    { value: "", label: "Select" },
                    { value: "Diploma", label: "Diploma" },
                    { value: "Bachelor", label: "Bachelor" },
                    { value: "Master", label: "Master" },
                    { value: "PhD", label: "PhD" },
                    { value: "Other", label: "Other" },
                  ]}
                  placeholder="Select"
                />
              </Field>

              <Field label="Years of Experience">
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  name="experienceYears"
                  className={inputCls}
                  defaultValue={item?.experienceYears ?? ""}
                  placeholder="e.g., 3"
                />
              </Field>

              <Field label="Current / Recent Organization">
                <input
                  name="organization"
                  className={inputCls}
                  defaultValue={item?.organization || ""}
                  placeholder="Company / Institute"
                />
              </Field>



              <Field label="Skills / Technologies" required span={3}>
                <input
                  name="skills"
                  required
                  className={inputCls}
                  defaultValue={initialSkills}
                  placeholder="e.g., MongoDB, Node.js, AWS (comma-separated)"
                />
              </Field>

              <Field label="Spoken Languages" span={2}>
                <input
                  name="languages"
                  className={inputCls}
                  defaultValue={initialLanguages}
                  placeholder="e.g., English, Spanish (comma-separated)"
                />
              </Field>

              <Field label="Teaching Mode" required>
                <CustomSelect
                  name="teachingMode"
                  required
                  defaultValue={item?.teachingMode || "Online"}
                  options={[
                    { value: "Online", label: "Online" },
                    { value: "Offline", label: "Offline" },
                    { value: "Hybrid", label: "Hybrid" },
                  ]}
                  placeholder="Select Teaching Mode"
                />
              </Field>

              <Field label="Short Bio / Summary" span={3}>
                <textarea
                  name="bio"
                  rows={3}
                  className={textareaCls}
                  defaultValue={item?.bio || ""}
                  placeholder="Brief profile to show on your site"
                />
              </Field>
            </FormSection>
                    </div>

            {/* ── Availability ── */}
            <div className={currentStep === 3 ? 'block animate-fade-in' : 'hidden'}>
                      <FormSection title="Availability" icon={faClock}>
              <div className="md:col-span-3">
                <label className={labelCls}>
                  Weekdays <span className="text-rose-500">*</span>
                </label>

                <div
                  role="group"
                  aria-label="Weekdays"
                  className="mt-2 grid grid-cols-4 sm:grid-cols-7 gap-2"
                >
                  {dayOpts.map((d) => {
                    const checked = Array.isArray(item?.availableDays)
                      ? item.availableDays.includes(d)
                      : false;

                    return (
                      <label key={d} className="relative block cursor-pointer">
                        <input
                          type="checkbox"
                          name="availableDays"
                          value={d}
                          defaultChecked={checked}
                          className="peer absolute inset-0 h-full w-full cursor-pointer opacity-0"
                          onChange={(e) => {
                            const formEl = e.currentTarget.form;
                            if (!formEl) return;

                            const boxes = formEl.querySelectorAll(
                              'input[name="availableDays"]'
                            );
                            const anyChecked = Array.from(boxes).some((b) => b.checked);

                            boxes.forEach((b) => b.setCustomValidity(""));
                            if (!anyChecked) {
                              e.currentTarget.setCustomValidity(
                                "Select at least one weekday."
                              );
                            }
                          }}
                        />
                        <span className="flex h-11 items-center justify-center rounded-xl border-2 border-slate-200 bg-white text-sm font-semibold text-slate-600 shadow-sm transition-all duration-150 peer-checked:bg-gradient-to-r peer-checked:from-cyan-500 peer-checked:to-blue-600 peer-checked:text-white peer-checked:border-blue-500 peer-checked:shadow-md peer-checked:shadow-cyan-200/70 peer-focus-visible:ring-2 peer-focus-visible:ring-cyan-400 hover:border-cyan-300">
                          {d}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <Field label="Start Time (24h)" required>
                <CustomTimeSelect
                  name="availableStart"
                  ref={startRef}
                  required
                  value={availStart}
                  onChange={(e) => {
                    setAvailStart(e.target.value);
                    startRef.current?.setCustomValidity("");
                    (prefStartRefs.current || []).forEach((el) =>
                      el?.setCustomValidity("")
                    );
                    (prefEndRefs.current || []).forEach((el) =>
                      el?.setCustomValidity("")
                    );
                  }}
                  placeholder="--:--"
                />
              </Field>

              <Field label="End Time (24h)" required>
                <CustomTimeSelect
                  name="availableEnd"
                  ref={endRef}
                  required
                  value={availEnd}
                  onChange={(e) => {
                    setAvailEnd(e.target.value);
                    endRef.current?.setCustomValidity("");
                    (prefStartRefs.current || []).forEach((el) =>
                      el?.setCustomValidity("")
                    );
                    (prefEndRefs.current || []).forEach((el) =>
                      el?.setCustomValidity("")
                    );
                  }}
                  placeholder="--:--"
                />
              </Field>

              <Field label="Timezone">
                <CustomSelect
                  name="timezone"
                  value={tz}
                  onChange={(e) => setTz(e.target.value)}
                  options={TIMEZONES.map((z) => ({
                    value: z,
                    label: z === "Asia/Kolkata" ? "Asia/Kolkata (IST)" : z,
                  }))}
                  placeholder="Select Timezone"
                />
              </Field>

              <div className="md:col-span-3 mt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Preferable Time Slots{" "}
                    <span className="text-slate-400 font-normal normal-case">
                      (optional)
                    </span>
                  </span>

                  <button
                    type="button"
                    onClick={addPrefSlot}
                    disabled={!availStart || !availEnd}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-cyan-50 to-blue-50 text-blue-700 text-xs font-semibold border border-cyan-100 hover:from-cyan-100 hover:to-blue-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <FontAwesomeIcon icon={faPlus} className="text-[10px]" /> Add Slot
                  </button>
                </div>

                <p className="text-[11px] text-slate-400 mt-1">
                  Must fall within your overall start &amp; end times.
                </p>

                <div className="mt-3 space-y-3">
                  {prefSlots.length === 0 ? (
                    <div className="text-xs text-slate-500 italic py-3 text-center border border-dashed border-cyan-200 bg-white/70 rounded-xl">
                      No preferable slots added. Set times above, then click "Add Slot."
                    </div>
                  ) : (
                    prefSlots.map((s, idx) => (
                      <div
                        key={idx}
                        className="grid grid-cols-1 md:grid-cols-7 gap-3 items-end bg-gradient-to-r from-white to-cyan-50/50 rounded-2xl p-3 border border-cyan-100 shadow-sm"
                      >
                        <div className="md:col-span-3">
                          <label className={labelCls}>Slot {idx + 1}: Start</label>
                          <CustomTimeSelect
                            value={s.start}
                            onChange={(e) => {
                              prefStartRefs.current[idx]?.setCustomValidity("");
                              prefEndRefs.current[idx]?.setCustomValidity("");
                              updatePrefSlot(idx, "start", e.target.value);
                            }}
                            ref={(el) => (prefStartRefs.current[idx] = el)}
                            placeholder="--:--"
                          />
                        </div>

                        <div className="md:col-span-3">
                          <label className={labelCls}>Slot {idx + 1}: End</label>
                          <CustomTimeSelect
                            value={s.end}
                            onChange={(e) => {
                              prefEndRefs.current[idx]?.setCustomValidity("");
                              prefStartRefs.current[idx]?.setCustomValidity("");
                              updatePrefSlot(idx, "end", e.target.value);
                            }}
                            ref={(el) => (prefEndRefs.current[idx] = el)}
                            placeholder="--:--"
                          />
                        </div>

                        <div className="md:col-span-1">
                          <button
                            type="button"
                            onClick={() => removePrefSlot(idx)}
                            className="w-full h-11 rounded-xl border border-rose-200 text-rose-600 bg-white text-sm font-medium hover:bg-rose-50 transition-colors"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </FormSection>
                    </div>

            {/* ── Compensation / Payout ── */}
            <div className={currentStep === 4 ? 'block animate-fade-in' : 'hidden'}>
                      <FormSection title="Compensation / Payout" icon={faIndianRupeeSign}>
              <Field label="Rate Type">
                <CustomSelect
                  name="rateType"
                  defaultValue={item?.rateType || "Hourly"}
                  options={[
                    { value: "Hourly", label: "Hourly" },
                    { value: "Per Session", label: "Per Session" },
                    { value: "Fixed", label: "Fixed" },
                  ]}
                  placeholder="Select Rate Type"
                />
              </Field>

              <Field label="Expected Rate">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  name="expectedRate"
                  className={inputCls}
                  defaultValue={item?.expectedRate ?? ""}
                  placeholder="e.g., 1500"
                />
              </Field>

              <Field label="Currency">
                <CustomSelect
                  name="currency"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  options={[
                    { value: "INR", label: "INR" },
                    { value: "USD", label: "USD" },
                    { value: "CAD", label: "CAD" },
                    { value: "EUR", label: "EUR" },
                  ]}
                  placeholder="Select Currency"
                />
              </Field>

              <Field label="Preferred Payout Method">
                <CustomSelect
                  name="payoutMethod"
                  value={payoutMethod}
                  onChange={(e) => setPayoutMethod(e.target.value)}
                  options={
                    country === "India"
                      ? [
                          { value: "Bank Transfer (NEFT/RTGS)", label: "Bank Transfer (NEFT/RTGS)" },
                          { value: "UPI", label: "UPI" },
                          { value: "Razorpay", label: "Razorpay" },
                        ]
                      : []
                  }
                  placeholder="Select Payout Method"
                />
              </Field>

              <Field label="Payout Identifier" span={2}>
                <input
                  name="payoutIdentifier"
                  className={inputCls}
                  defaultValue={item?.payoutIdentifier || ""}
                  placeholder={payIdPlaceholder}
                />
              </Field>
            </FormSection>
                    </div>

            {/* ── Compliance & Documents ── */}
            <div className={currentStep === 5 ? 'block animate-fade-in' : 'hidden'}>
                      <FormSection title="Compliance & Documents" icon={faShieldAlt}>
              <Field label="Resume / CV (upload to replace)">
                <input
                  type="file"
                  name="resume"
                  className={fileInputCls}
                  accept=".pdf,.doc,.docx"
                />
              </Field>

              <Field label="Profile Photo (upload to replace)">
                <input
                  type="file"
                  name="photo"
                  className={fileInputCls}
                  accept="image/*"
                />
              </Field>

              <Field label="Certificates (upload to add)">
                <input
                  type="file"
                  name="certificates"
                  className={fileInputCls}
                  accept=".pdf,.png,.jpg,.jpeg"
                  multiple
                />
              </Field>

              <Field label="Background Check">
                <CustomSelect
                  name="backgroundCheck"
                  defaultValue={item?.backgroundCheck || "Pending"}
                  options={[
                    { value: "Pending", label: "Pending" },
                    { value: "Cleared", label: "Cleared" },
                    { value: "Not Required", label: "Not Required" },
                  ]}
                  placeholder="Select Status"
                />
              </Field>

              <div className="md:col-span-2 flex flex-wrap items-center gap-6 pt-1">
                <label className="inline-flex items-center gap-2.5 cursor-pointer select-none group">
                  <input
                    type="checkbox"
                    name="ndaSigned"
                    defaultChecked={!!item?.ndaSigned}
                    className="w-4 h-4 !m-0 rounded border-slate-300 text-violet-600 focus:ring-violet-500 cursor-pointer shrink-0 accent-violet-600"
                  />
                  <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900 whitespace-nowrap">
                    NDA signed
                  </span>
                </label>

                <label className="inline-flex items-center gap-2.5 cursor-pointer select-none group">
                  <input
                    type="checkbox"
                    name="agreeToTerms"
                    defaultChecked={!!item?.agreeToTerms}
                    className="w-4 h-4 !m-0 rounded border-slate-300 text-violet-600 focus:ring-violet-500 cursor-pointer shrink-0 accent-violet-600"
                  />
                  <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900 whitespace-nowrap">
                    I confirm all details are accurate
                  </span>
                </label>
              </div>
            </FormSection>
                    </div>

            {/* ── Assignment ── */}
            <div className={currentStep === 5 ? 'block animate-fade-in' : 'hidden'}>
                      <FormSection title="Assignment" icon={faClipboardList}>
              <Field label="Assign to Internship (title or ID)">
                <input
                  name="assignInternship"
                  className={inputCls}
                  defaultValue={item?.assignInternship || ""}
                  placeholder="e.g., MERN Bootcamp – 2025 Summer"
                />
              </Field>

              <Field label="Notes" span={3}>
                <textarea
                  name="notes"
                  rows={3}
                  className={textareaCls}
                  defaultValue={item?.notes || ""}
                  placeholder="Internal notes"
                />
              </Field>
            </FormSection>
                    </div>

            
                    {/* Wizard Footer */}
                    <div className="flex items-center justify-between pt-5 border-t border-slate-100 mt-8">
                      <button
                        type="button"
                        onClick={() => {
                           setCurrentStep(s => Math.max(1, s - 1));
                           document.getElementById('wizard-scroll-container')?.scrollTo(0,0);
                        }}
                        disabled={currentStep === 1}
                        className={`px-6 py-2.5 rounded-xl font-semibold text-sm transition-all ${currentStep === 1 ? 'opacity-50 cursor-not-allowed bg-slate-50 text-slate-400 border border-slate-200' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 shadow-sm'}`}
                      >
                        Back
                      </button>

                      <div className="flex items-center gap-3">
                        {currentStep < 5 && (
                          <button
                            type="button"
                            onClick={() => {
                                const container = document.getElementById('wizard-scroll-container');
                                if (!container) return;
                                
                                if (currentStep === 1) {
                                  const emailErr = validateEmail(email);
                                  if (emailErr) {
                                    setEmailError(emailErr);
                                    setEmailSuggestion(getEmailSuggestion(email) || "");
                                    emailRef.current?.setCustomValidity(emailErr);
                                    emailRef.current?.reportValidity();
                                    return;
                                  }
                                  const pErr = validateIndianMobile(phone, true);
                                  if (pErr) {
                                    setPhoneError(pErr);
                                    phoneRef.current?.setCustomValidity(pErr);
                                    phoneRef.current?.reportValidity();
                                    return;
                                  }
                                  if (altPhone) {
                                    const apErr = validateIndianMobile(altPhone, false);
                                    if (apErr) {
                                      setAltPhoneError(apErr);
                                      altPhoneRef.current?.setCustomValidity(apErr);
                                      altPhoneRef.current?.reportValidity();
                                      return;
                                    }
                                    if (phone === altPhone) {
                                      const dupErr = "Alternate phone cannot be the same as primary mobile number.";
                                      setAltPhoneError(dupErr);
                                      altPhoneRef.current?.setCustomValidity(dupErr);
                                      altPhoneRef.current?.reportValidity();
                                      return;
                                    }
                                  }
                                  const pinErr = validateIndianPinCode(postalCode, true);
                                  if (pinErr) {
                                    setPostalError(pinErr);
                                    postalRef.current?.setCustomValidity(pinErr);
                                    postalRef.current?.reportValidity();
                                    return;
                                  }
                                }

                                const visibleStep = container.querySelector('.block.animate-fade-in');
                                if (!visibleStep) return;

                                const inputs = visibleStep.querySelectorAll('input, select, textarea');
                                let isValid = true;
                                for (const input of inputs) {
                                    if (!input.checkValidity()) {
                                        input.reportValidity();
                                        isValid = false;
                                        break;
                                    }
                                }

                                if (isValid) {
                                    setCurrentStep(s => Math.min(5, s + 1));
                                    container.scrollTo(0,0);
                                }
                            }}
                            className="px-7 py-2.5 rounded-xl bg-slate-900 text-white font-semibold text-sm shadow-md hover:bg-slate-800 active:scale-95 transition-all"
                          >
                            Next
                          </button>
                        )}
                        {currentStep === 5 && (
                          <button
                            type="submit"
                            disabled={submitting }
                            className="inline-flex items-center gap-2.5 px-7 py-2.5 bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 text-white text-sm font-bold rounded-xl shadow-lg shadow-violet-200/70 hover:from-indigo-700 hover:via-violet-700 hover:to-fuchsia-700 disabled:opacity-50 active:scale-[0.98] transition-all duration-150"
                          >
                            {submitting ? "Saving..." : "Save Instructor"}
                          </button>
                        )}
                      </div>
                    </div>
    
          </form>
        </div>
      </div>

      {/* ═══ OTP MODAL ═══ */}
      {otpOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/45 backdrop-blur-[3px]">
          <div className="bg-white rounded-[28px] shadow-[0_25px_60px_-15px_rgba(15,23,42,0.35)] w-full max-w-sm p-7 border border-slate-200/70">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-100 via-violet-100 to-fuchsia-100 flex items-center justify-center mb-5 shadow-sm">
              <FontAwesomeIcon icon={faEnvelope} className="text-violet-600 text-xl" />
            </div>

            <h3 className="text-lg font-bold text-slate-900 mb-1">Verify Email</h3>

            <p className="text-sm text-slate-500 mb-5">
              We sent a 6-digit code to{" "}
              <span className="font-semibold text-slate-700">{otpEmail}</span>
            </p>

            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="Enter 6-digit OTP"
              value={otpCode}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                setOtpCode(v);
              }}
              className={`${inputCls} text-center text-lg tracking-[0.35em] font-bold mb-5`}
            />

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setOtpOpen(false)}
                className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium bg-white hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={doVerifyAndSave}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-sm font-semibold hover:from-indigo-700 hover:to-violet-700 shadow-lg shadow-violet-200/70 transition-all"
              >
                Verify &amp; Save
              </button>
            </div>

            <div className="mt-4 text-center">
              <button
                type="button"
                className="text-xs text-violet-700 font-medium hover:underline"
                onClick={async () => {
                  try {
                    await axios.post("/api/instructors/otp/start", { email: otpEmail }, authCfg());
                    showAlert("OTP resent.", "info");
                  } catch {
                    showAlert("Failed to resend OTP.", "error");
                  }
                }}
              >
                Didn't receive a code? Resend
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ CENTERED FEEDBACK / ALERT MODAL ═══ */}
      {alertInfo && (
        <div
          className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-slate-950/45 backdrop-blur-[3px] animate-fade-in"
          role="dialog"
          aria-modal="true"
          onClick={() => setAlertInfo(null)}
        >
          <div
            className="bg-white rounded-[24px] shadow-[0_25px_60px_-15px_rgba(15,23,42,0.35)] w-full max-w-sm p-6 sm:p-7 border border-slate-100 flex flex-col items-center text-center transform transition-all scale-100 animate-zoom-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 shadow-sm ${
                alertInfo.type === "error"
                  ? "bg-rose-50 text-rose-500 border border-rose-100"
                  : alertInfo.type === "info"
                  ? "bg-sky-50 text-sky-600 border border-sky-100"
                  : "bg-emerald-50 text-emerald-600 border border-emerald-100"
              }`}
            >
              <FontAwesomeIcon
                icon={
                  alertInfo.type === "error"
                    ? faTimes
                    : alertInfo.type === "info"
                    ? faEnvelope
                    : faCheck
                }
                className="text-2xl"
              />
            </div>

            <h3 className="text-lg font-bold text-slate-900 mb-1.5">
              {alertInfo.title ||
                (alertInfo.type === "error"
                  ? "Error"
                  : alertInfo.type === "info"
                  ? "Notice"
                  : "Success")}
            </h3>

            <p className="text-sm text-slate-600 mb-6 leading-relaxed">
              {alertInfo.message}
            </p>

            <button
              type="button"
              onClick={() => setAlertInfo(null)}
              className="w-full py-2.5 px-5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white text-sm font-semibold shadow-lg shadow-violet-200/70 transition-all focus:outline-none focus:ring-4 focus:ring-violet-500/20 active:scale-[0.98]"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>,
    portalTarget
  );
}
