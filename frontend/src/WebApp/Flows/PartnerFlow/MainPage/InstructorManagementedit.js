//File: InstructorManagementedit.js

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import axios from "../../../../api/axiosInstance";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTimes,
  faEnvelope,
  faStar,
  faShieldAlt,
  faClock,
  faDollarSign,
  faClipboardList,
  faPlus,
} from "@fortawesome/free-solid-svg-icons";

/* ─── Shared style tokens ─── */
const inputCls =
  "w-full h-11 rounded-xl border border-slate-200 bg-white/95 px-4 text-sm text-slate-800 placeholder:text-slate-400 shadow-sm transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-violet-500/10 focus:border-violet-400 hover:border-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-gradient-to-r file:from-indigo-50 file:to-sky-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-indigo-700";
const textareaCls =
  "w-full rounded-xl border border-slate-200 bg-white/95 px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 shadow-sm transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-violet-500/10 focus:border-violet-400 hover:border-slate-300 min-h-[7rem] resize-y";
const labelCls =
  "block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5";

const dayOpts = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const US_STATES = [
  "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut", "Delaware",
  "District of Columbia", "Florida", "Georgia", "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa",
  "Kansas", "Kentucky", "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan", "Minnesota",
  "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire", "New Jersey",
  "New Mexico", "New York", "North Carolina", "North Dakota", "Ohio", "Oklahoma", "Oregon",
  "Pennsylvania", "Rhode Island", "South Carolina", "South Dakota", "Tennessee", "Texas", "Utah",
  "Vermont", "Virginia", "Washington", "West Virginia", "Wisconsin", "Wyoming",
];

const CA_PROVINCES = [
  "Alberta", "British Columbia", "Manitoba", "New Brunswick", "Newfoundland and Labrador",
  "Northwest Territories", "Nova Scotia", "Nunavut", "Ontario", "Prince Edward Island",
  "Quebec", "Saskatchewan", "Yukon",
];

const TIMEZONES_US_MX = [
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-x-5 gap-y-5">{children}</div>
    </div>
  );
};

/* ─── Field wrapper ─── */
const Field = ({ label, required, span = 1, children }) => (
  <div className={span === 2 ? "md:col-span-2" : span === 3 ? "md:col-span-3" : ""}>
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

  const itemId = useMemo(() => item?._id || item?.id, [item]);

  const initialCountry = item?.country === "Canada" ? "Canada" : "United States";
  const [country, setCountry] = useState(initialCountry);
  const [stateProv, setStateProv] = useState(item?.state || "");
  const [city, setCity] = useState(item?.city || "");
  const [postalCode, setPostalCode] = useState(item?.postalCode || "");
  const [address1, setAddress1] = useState(item?.address1 || "");
  const [address2, setAddress2] = useState(item?.address2 || "");

  const [currency, setCurrency] = useState(
    item?.currency || (initialCountry === "Canada" ? "CAD" : "USD")
  );

  useEffect(() => {
    setCurrency((c) => {
      if (country === "Canada" && c === "USD") return "CAD";
      if (country === "United States" && c === "CAD") return "USD";
      return c;
    });
  }, [country]);

  const [payoutMethod, setPayoutMethod] = useState(() => {
    const us = ["ACH (US Bank)", "Zelle", "PayPal"];
    const ca = ["EFT (CA Bank)", "Interac e-Transfer", "PayPal"];
    const m = item?.payoutMethod;
    if (initialCountry === "Canada") return ca.includes(m) ? m : "EFT (CA Bank)";
    return us.includes(m) ? m : "ACH (US Bank)";
  });

  useEffect(() => {
    if (typeof document !== "undefined" && document.body) {
      setPortalTarget(document.body);
    }
  }, []);

  useEffect(() => {
    const us = ["ACH (US Bank)", "Zelle", "PayPal"];
    const ca = ["EFT (CA Bank)", "Interac e-Transfer", "PayPal"];
    if (country === "Canada" && !ca.includes(payoutMethod)) setPayoutMethod("EFT (CA Bank)");
    else if (country === "United States" && !us.includes(payoutMethod)) setPayoutMethod("ACH (US Bank)");
  }, [country, payoutMethod]);

  const [availStart, setAvailStart] = useState(item?.availableStart || "");
  const [availEnd, setAvailEnd] = useState(item?.availableEnd || "");
  const [tz, setTz] = useState(item?.timezone || "America/Los_Angeles");

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

  const stateList = country === "Canada" ? CA_PROVINCES : US_STATES;
  const stateLabel = country === "Canada" ? "Province / Territory" : "State";
  const postalLabel = country === "Canada" ? "Postal Code" : "ZIP Code";
  const phonePlaceholder = country === "Canada" ? "+1 (416) 555-1234" : "+1 (555) 555-1234";
  const cityPlaceholder = country === "Canada" ? "e.g., Toronto" : "e.g., San Jose";
  const address1Placeholder = "Street address, suite, unit";

  const payIdPlaceholder =
    payoutMethod === "ACH (US Bank)"
      ? "Routing & last-4 (e.g., 111000025 | ****1234)"
      : payoutMethod === "Zelle"
        ? "Zelle email or phone"
        : payoutMethod === "EFT (CA Bank)"
          ? "Transit|Institution|Account (e.g., 12345|004|0012345)"
          : payoutMethod === "Interac e-Transfer"
            ? "Email or mobile number"
            : "PayPal email";

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

    if (!country) form.querySelector('[name="country"]')?.setCustomValidity("Please fill in this field.");
    if (!stateProv) form.querySelector('[name="state"]')?.setCustomValidity("Please fill in this field.");
    if (!city) form.querySelector('[name="city"]')?.setCustomValidity("Please fill in this field.");
    if (!postalCode) form.querySelector('[name="postalCode"]')?.setCustomValidity("Please fill in this field.");
    if (!address1) form.querySelector('[name="address1"]')?.setCustomValidity("Please fill in this field.");

    if (!form.checkValidity()) {
      form.reportValidity();
      setSubmitting(false);
      return;
    }

    try {
      const fd = new FormData(form);
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
        email: (fd.get("email") || "").trim(),
        phone: fd.get("phone") || "",
        altPhone: fd.get("altPhone") || "",
        country,
        state: fd.get("state") || "",
        city: fd.get("city") || "",
        postalCode: fd.get("postalCode") || "",
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
        alert("Email is required to send OTP.");
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
      alert(err?.response?.data?.message || "Failed to start OTP for update.");
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
      alert(err?.response?.data?.message || "Invalid OTP or update failed.");
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
                  name="firstName"
                  required
                  className={inputCls}
                  defaultValue={item?.firstName || ""}
                  placeholder="e.g., Priya"
                />
              </Field>

              <Field label="Last Name" required>
                <input
                  name="lastName"
                  required
                  className={inputCls}
                  defaultValue={item?.lastName || ""}
                  placeholder="e.g., Sharma"
                />
              </Field>

              <Field label="Email" required>
                <input
                  type="email"
                  name="email"
                  required
                  className={inputCls}
                  defaultValue={item?.email || ""}
                  placeholder="name@example.com"
                />
              </Field>

              <Field label="Mobile" required>
                <input
                  name="phone"
                  required
                  className={inputCls}
                  defaultValue={item?.phone || ""}
                  placeholder={phonePlaceholder}
                />
              </Field>

              <Field label="Alternate Phone">
                <input
                  name="altPhone"
                  className={inputCls}
                  defaultValue={item?.altPhone || ""}
                  placeholder={phonePlaceholder}
                />
              </Field>

              <Field label="Country" required>
                <select
                  name="country"
                  required
                  className={inputCls}
                  value={country}
                  onChange={(e) => {
                    setCountry(e.target.value);
                    setStateProv("");
                    setCity("");
                    setPostalCode("");
                    setAddress1("");
                    setAddress2("");
                  }}
                >
                  <option>United States</option>
                  <option>Canada</option>
                </select>
              </Field>

              <Field label={stateLabel} required>
                <select
                  name="state"
                  required
                  disabled={!country}
                  className={inputCls}
                  value={stateProv}
                  onChange={(e) => setStateProv(e.target.value)}
                >
                  <option value="" disabled hidden>
                    Select
                  </option>
                  {stateList.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
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
                  name="postalCode"
                  required
                  className={inputCls}
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  placeholder={country === "Canada" ? "M5V 3L9" : "95113"}
                />
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
                <select
                  name="qualification"
                  required
                  className={inputCls}
                  defaultValue={item?.qualification || ""}
                >
                  <option value="" disabled hidden>
                    Select
                  </option>
                  <option value="Diploma">Diploma</option>
                  <option value="Bachelor">Bachelor</option>
                  <option value="Master">Master</option>
                  <option value="PhD">PhD</option>
                  <option value="Other">Other</option>
                </select>
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
                <select
                  name="teachingMode"
                  required
                  className={inputCls}
                  defaultValue={item?.teachingMode || ""}
                >
                  <option value="" disabled hidden>
                    Select
                  </option>
                  <option value="Online">Online</option>
                  <option value="Offline">Offline</option>
                  <option value="Hybrid">Hybrid</option>
                </select>
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
                <input
                  type="time"
                  name="availableStart"
                  className={inputCls}
                  ref={startRef}
                  step="60"
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
                />
              </Field>

              <Field label="End Time (24h)" required>
                <input
                  type="time"
                  name="availableEnd"
                  className={inputCls}
                  ref={endRef}
                  step="60"
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
                />
              </Field>

              <Field label="Timezone">
                <select
                  name="timezone"
                  className={inputCls}
                  value={tz}
                  onChange={(e) => setTz(e.target.value)}
                >
                  {TIMEZONES_US_MX.map((z) => (
                    <option key={z} value={z}>
                      {z}
                    </option>
                  ))}
                </select>
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
                          <input
                            type="time"
                            value={s.start}
                            onChange={(e) => {
                              prefStartRefs.current[idx]?.setCustomValidity("");
                              prefEndRefs.current[idx]?.setCustomValidity("");
                              updatePrefSlot(idx, "start", e.target.value);
                            }}
                            className={inputCls}
                            ref={(el) => (prefStartRefs.current[idx] = el)}
                            step="60"
                          />
                        </div>

                        <div className="md:col-span-3">
                          <label className={labelCls}>Slot {idx + 1}: End</label>
                          <input
                            type="time"
                            value={s.end}
                            onChange={(e) => {
                              prefEndRefs.current[idx]?.setCustomValidity("");
                              prefStartRefs.current[idx]?.setCustomValidity("");
                              updatePrefSlot(idx, "end", e.target.value);
                            }}
                            className={inputCls}
                            ref={(el) => (prefEndRefs.current[idx] = el)}
                            step="60"
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
                      <FormSection title="Compensation / Payout" icon={faDollarSign}>
              <Field label="Rate Type">
                <select
                  name="rateType"
                  className={inputCls}
                  defaultValue={item?.rateType || "Hourly"}
                >
                  <option>Hourly</option>
                  <option>Per Session</option>
                  <option>Fixed</option>
                </select>
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
                <select
                  name="currency"
                  className={inputCls}
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                >
                  <option>USD</option>
                  <option>CAD</option>
                  <option>EUR</option>
                </select>
              </Field>

              <Field label="Preferred Payout Method">
                <select
                  name="payoutMethod"
                  className={inputCls}
                  value={payoutMethod}
                  onChange={(e) => setPayoutMethod(e.target.value)}
                >
                  {country === "Canada" ? (
                    <>
                      <option>EFT (CA Bank)</option>
                      <option>Interac e-Transfer</option>
                      <option>PayPal</option>
                    </>
                  ) : (
                    <>
                      <option>ACH (US Bank)</option>
                      <option>Zelle</option>
                      <option>PayPal</option>
                    </>
                  )}
                </select>
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
                  className={inputCls}
                  accept=".pdf,.doc,.docx"
                />
              </Field>

              <Field label="Profile Photo (upload to replace)">
                <input
                  type="file"
                  name="photo"
                  className={inputCls}
                  accept="image/*"
                />
              </Field>

              <Field label="Certificates (upload to add)">
                <input
                  type="file"
                  name="certificates"
                  className={inputCls}
                  accept=".pdf,.png,.jpg,.jpeg"
                  multiple
                />
              </Field>

              <Field label="Background Check">
                <select
                  name="backgroundCheck"
                  className={inputCls}
                  defaultValue={item?.backgroundCheck || "Pending"}
                >
                  <option>Pending</option>
                  <option>Cleared</option>
                  <option>Not Required</option>
                </select>
              </Field>

              <div className="md:col-span-2 flex items-center gap-6">
                <label className="inline-flex items-center gap-2.5 cursor-pointer group">
                  <input
                    type="checkbox"
                    name="ndaSigned"
                    defaultChecked={!!item?.ndaSigned}
                    className="w-4 h-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                  />
                  <span className="text-sm text-slate-600 group-hover:text-slate-800">
                    NDA signed
                  </span>
                </label>

                <label className="inline-flex items-center gap-2.5 cursor-pointer group">
                  <input
                    type="checkbox"
                    name="agreeToTerms"
                    defaultChecked={!!item?.agreeToTerms}
                    className="w-4 h-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                  />
                  <span className="text-sm text-slate-600 group-hover:text-slate-800">
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
                    alert("OTP resent.");
                  } catch {
                    alert("Failed to resend OTP.");
                  }
                }}
              >
                Didn't receive a code? Resend
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    portalTarget
  );
}
