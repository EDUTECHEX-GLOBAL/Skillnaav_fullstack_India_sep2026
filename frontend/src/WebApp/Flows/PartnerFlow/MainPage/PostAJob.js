//File: PostAJob.js

import React, { useState, useEffect, useCallback, useRef } from "react";
import axios from "../../../../api/axiosInstance";
import edutechex_logo_white from "../../../../assets/edutechex_logo_white (1).png";
import { useTabContext } from "./UserHomePageContext/HomePageContext";
import { IN_STATES } from "../../../../constants/locations";
import {
  validateJobTitle,
  validateCompanyName,
  validateContactName,
  validateEmail,
  validateContactPhone,
} from "../../../../utils/validators";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
const SuccessModal = ({ onOk }) => (
  <div
    className="fixed inset-0 z-[9999] flex items-center justify-center"
    style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)" }}
  >
    <div
      className="bg-white rounded-2xl shadow-2xl flex flex-col items-center px-10 py-10 max-w-sm w-full mx-4"
      style={{
        animation: "successModalIn 0.35s cubic-bezier(.34,1.56,.64,1) both",
      }}
    >
      {/* Animated circle + tick */}
      <div className="relative flex items-center justify-center mb-6">
        <svg width="96" height="96" viewBox="0 0 96 96" fill="none">
          <circle
            cx="48"
            cy="48"
            r="44"
            stroke="#10b981"
            strokeWidth="4"
            fill="#ecfdf5"
            style={{ animation: "circleIn 0.45s ease both" }}
          />
          <polyline
            points="28,50 42,64 68,34"
            stroke="#10b981"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            style={{
              strokeDasharray: 60,
              strokeDashoffset: 0,
              animation: "tickDraw 0.45s 0.3s ease both",
            }}
          />
        </svg>
      </div>
      <h2
        className="text-xl font-bold text-gray-800 mb-1 text-center"
        style={{ fontFamily: "'Poppins', sans-serif" }}
      >
        Internship Posted!
      </h2>
      <p
        className="text-sm text-gray-500 mb-7 text-center"
        style={{ fontFamily: "'Poppins', sans-serif" }}
      >
        Your internship has been submitted successfully and is pending admin
        approval.
      </p>
      <button
        onClick={onOk}
        className="w-full py-3 rounded-xl bg-teal-600 text-white font-semibold text-sm hover:bg-teal-700 active:scale-95 transition-all"
        style={{ fontFamily: "'Poppins', sans-serif" }}
      >
        OK - View My Posts
      </button>
    </div>
    <style>{`
      @keyframes successModalIn {
        from { opacity: 0; transform: scale(0.8) translateY(30px); }
        to   { opacity: 1; transform: scale(1) translateY(0); }
      }
      @keyframes tickDraw {
        from { stroke-dashoffset: 60; opacity: 0; }
        to   { stroke-dashoffset: 0;  opacity: 1; }
      }
      @keyframes circleIn {
        from { opacity: 0; transform: scale(0.6); transform-origin: center; }
        to   { opacity: 1; transform: scale(1); }
      }
    `}</style>
  </div>
);

// CustomSelect ensures the dropdown menu ("down box") matches the exact width of the trigger ("top box")
const CustomSelect = ({
  name,
  value,
  onChange,
  options,
  placeholder = "Select an option",
  required = false,
  error = "",
  className = "",
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  const selectedOption = options.find(
    (opt) => String(opt.value) === String(value)
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

  const handleOptionClick = (val) => {
    onChange({ target: { name, value: val } });
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className={`relative w-full ${isOpen ? "z-[60]" : "z-[1]"}`}>
      {/* Top Box (Trigger) */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        className={`w-full h-12 box-border p-3 border rounded-lg bg-white text-gray-900 flex justify-between items-center text-left text-sm font-poppins transition-all focus:outline-none focus:ring-2 ${
          isOpen
            ? "border-teal-500 ring-2 ring-teal-500"
            : error
              ? "border-red-500 focus:ring-red-400"
              : "border-gray-300 hover:border-gray-400 focus:ring-teal-500"
        } ${disabled ? "opacity-60 cursor-not-allowed bg-gray-50" : "cursor-pointer"} ${className}`}
        style={{ marginTop: "0px" }}
      >
        <span
          className={`truncate pr-2 ${
            selectedOption
              ? "text-gray-900 font-medium"
              : "text-gray-400 font-normal"
          }`}
        >
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <svg
          className={`w-4 h-4 flex-shrink-0 text-gray-400 transition-transform duration-200 ${
            isOpen ? "rotate-180 text-teal-600" : ""
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Down Box (Dropdown Menu) - strictly w-full left-0 right-0 */}
      {isOpen && (
        <div
          className="absolute z-[70] left-0 right-0 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-y-auto py-1"
          style={{ width: "100%", maxWidth: "100%", boxSizing: "border-box" }}
        >
          {options.length === 0 ? (
            <div className="px-4 py-3 text-xs text-gray-400 text-center">
              No options available
            </div>
          ) : (
            options.map((opt) => {
              const isSelected = String(value) === String(opt.value);
              return (
                <div
                  key={opt.value}
                  onClick={() => handleOptionClick(opt.value)}
                  className={`px-4 py-2.5 text-xs sm:text-sm cursor-pointer transition-colors break-words leading-relaxed ${
                    isSelected
                      ? "bg-teal-50 text-teal-700 font-semibold"
                      : "text-gray-700 hover:bg-teal-50/70 hover:text-teal-700"
                  }`}
                >
                  {opt.label}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

const PostAJob = () => {
  const { saveJob, handleSelectTab } = useTabContext();

  const topSectors = [
    { id: "advanced-ai", name: "Advanced AI & Autonomous Systems" },
    { id: "quantum-computing", name: "Quantum Computing & Next-Gen Computing" },
    { id: "climate-tech", name: "Climate Tech & Carbon Capture" },
    { id: "biotech", name: "Biotechnology & Synthetic Biology" },
    { id: "materials-science", name: "Advanced Materials Science" },
    { id: "space-exploration", name: "Space Exploration & Commercial Space" },
    {
      id: "neurotechnology",
      name: "Neurotechnology & Brain-Computer Interfaces",
    },
    { id: "precision-agriculture", name: "Precision Agriculture & AgriTech" },
    {
      id: "advanced-robotics",
      name: "Advanced Robotics & Human-Machine Collaboration",
    },
    { id: "renewable-energy", name: "Renewable Energy & Grid Innovation" },
    {
      id: "architecture-built-environment",
      name: "Architecture & Built Environment",
    },
  ];

  const [formData, setFormData] = useState({
    jobTitle: "",
    companyName: "",
    sector: "",
    city: "",
    country: "India",
    state: "",
    jobType: "Internship",
    jobDescription: "",
    startDate: "",
    endDateOrDuration: "",
    duration: "",
    internshipType: "",
    classification: "",
    compensationDetails: {
      type: "",
      amount: null,
      currency: "",
      frequency: "",
    },
    mode: "",
    qualifications: [],
    contactInfo: { name: "", email: "", phone: "" },
    imgUrl: "",
    studentApplied: false,
    adminApproved: false,
    applicationOpen: true,
  });

  const [citySuggestions, setCitySuggestions] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [userType, setUserType] = useState("");
  const [freemiumAlert, setFreemiumAlert] = useState("");
  const cityDebounceRef = useRef(null);

  const [fieldErrors, setFieldErrors] = useState({
    jobTitle: "",
    companyName: "",
    "contactInfo.name": "",
    "contactInfo.email": "",
    "contactInfo.phone": "",
  });
  const [touchedFields, setTouchedFields] = useState({
    jobTitle: false,
    companyName: false,
    "contactInfo.name": false,
    "contactInfo.email": false,
    "contactInfo.phone": false,
  });

  const stateList = formData.country === "India" ? IN_STATES : [];
  const stateLabel =
    formData.country === "India" ? "State / Union Territory" : "State";
  const [qualInput, setQualInput] = useState("");
  const [skillError, setSkillError] = useState("");

  useEffect(() => {
    try {
      const ui =
        JSON.parse(localStorage.getItem("partnerInfo")) ||
        JSON.parse(localStorage.getItem("userInfo"));
      if (ui) setUserType(ui.planType);
    } catch (err) {
      console.error("PostAJob: failed reading localStorage", err);
    }
  }, []);

  const searchCities = useCallback(
    async (q) => {
      if (!q || q.trim().length < 2) {
        setCitySuggestions([]);
        return;
      }
      try {
        const countryIds = formData.country === "India" ? "IN" : "IN";

        const resp = await axios.get("/api/cities", {
          params: {
            namePrefix: q.trim(),
            limit: 10,
            minPopulation: 100000,
            countryIds,
          },
        });
        setCitySuggestions(resp.data?.data || []);
      } catch (err) {
        console.error("City lookup failed:", err);
        setCitySuggestions([]);
      }
    },
    [formData.country],
  );

  const handleCityInputChange = (e) => {
    const { value } = e.target;
    setFormData((p) => ({ ...p, city: value }));
    clearTimeout(cityDebounceRef.current);
    cityDebounceRef.current = setTimeout(() => searchCities(value), 300);
  };

  const handleCitySelect = (name) => {
    setFormData((p) => ({ ...p, city: name }));
    setCitySuggestions([]);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === "jobTitle") {
      setTouchedFields((prev) => ({ ...prev, jobTitle: true }));
      setFieldErrors((prev) => ({
        ...prev,
        jobTitle: validateJobTitle(value),
      }));
    } else if (name === "companyName") {
      setTouchedFields((prev) => ({ ...prev, companyName: true }));
      setFieldErrors((prev) => ({
        ...prev,
        companyName: validateCompanyName(value),
      }));
    }

    setFormData((prev) => {
      if (name === "internshipType") {
        return {
          ...prev,
          internshipType: value,
          compensationDetails: {
            ...prev.compensationDetails,
            type: value,
            frequency: value === "FREE" ? "" : "ONE_TIME",
            ...(value === "FREE" && { amount: null, currency: "" }),
          },
        };
      }
      if (name.startsWith("compensationDetails.")) {
        const field = name.split(".")[1];
        return {
          ...prev,
          compensationDetails: { ...prev.compensationDetails, [field]: value },
        };
      }
      if (name.startsWith("contactInfo.")) {
        const field = name.split(".")[1];
        if (touchedFields[name]) {
          let err = "";
          if (field === "name") err = validateContactName(value);
          else if (field === "email") err = validateEmail(value);
          else if (field === "phone") err = validateContactPhone(value, prev.country);
          setFieldErrors((prevErr) => ({ ...prevErr, [name]: err }));
        }
        return {
          ...prev,
          contactInfo: { ...prev.contactInfo, [field]: value },
        };
      }
      return { ...prev, [name]: value };
    });
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    if (name === "jobTitle") {
      setTouchedFields((prev) => ({ ...prev, jobTitle: true }));
      setFieldErrors((prev) => ({
        ...prev,
        jobTitle: validateJobTitle(value),
      }));
    } else if (name === "companyName") {
      setTouchedFields((prev) => ({ ...prev, companyName: true }));
      setFieldErrors((prev) => ({
        ...prev,
        companyName: validateCompanyName(value),
      }));
    } else if (name === "contactInfo.name") {
      setTouchedFields((prev) => ({ ...prev, "contactInfo.name": true }));
      setFieldErrors((prev) => ({
        ...prev,
        "contactInfo.name": validateContactName(value),
      }));
    } else if (name === "contactInfo.email") {
      setTouchedFields((prev) => ({ ...prev, "contactInfo.email": true }));
      setFieldErrors((prev) => ({
        ...prev,
        "contactInfo.email": validateEmail(value),
      }));
    } else if (name === "contactInfo.phone") {
      setTouchedFields((prev) => ({ ...prev, "contactInfo.phone": true }));
      setFieldErrors((prev) => ({
        ...prev,
        "contactInfo.phone": validateContactPhone(value, formData.country),
      }));
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    setUploading(true);
    const reader = new FileReader();
    reader.onloadend = () => setPreviewUrl(reader.result);
    reader.readAsDataURL(file);
    try {
      const data = new FormData();
      data.append("image", file);
      const res = await axios.post("/api/upload/job-image", data, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (res.data?.success) {
        setFormData((prev) => ({ ...prev, imgUrl: res.data.imageUrl }));
      } else {
        console.error("Upload failed:", res?.data?.message || "no message");
      }
    } catch (err) {
      console.error("Image upload error:", err);
    } finally {
      setUploading(false);
    }
  };

  const calculateDuration = useCallback((startDate, endDateOrDuration) => {
    if (!startDate || !endDateOrDuration) {
      setFormData((prev) => ({ ...prev, duration: "" }));
      return;
    }
    const start = new Date(startDate + "T00:00:00");
    const end = new Date(endDateOrDuration + "T00:00:00");
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      setFormData((prev) => ({ ...prev, duration: "" }));
      return;
    }
    if (end < start) {
      setFormData((prev) => ({ ...prev, duration: "Invalid duration" }));
      return;
    }
    const totalDays = Math.floor((end - start) / (1000 * 60 * 60 * 24));
    const months = Math.floor(totalDays / 30);
    const days = totalDays % 30;
    const durationText =
      months > 0
        ? `${months} month${months > 1 ? "s" : ""}${days > 0 ? ` and ${days} day${days > 1 ? "s" : ""}` : ""}`
        : `${totalDays} day${totalDays > 1 ? "s" : ""}`;
    setFormData((prev) => ({ ...prev, duration: durationText }));
  }, []);

  const addQualification = () => {
    const val = qualInput.trim();
    if (!val) return;
    if (/^\d+$/.test(val)) {
      setSkillError("Skills cannot be just numbers. Please enter a valid skill name.");
      return;
    }
    if (
      !/[a-zA-Z]/.test(val) ||
      (val.length < 2 && !["C", "R"].includes(val.toUpperCase()))
    ) {
      setSkillError("Please enter a valid skill name with letters (min 2 characters).");
      return;
    }
    if (
      formData.qualifications.some(
        (q) => q.toLowerCase() === val.toLowerCase()
      )
    ) {
      setSkillError("This skill has already been added.");
      return;
    }
    setSkillError("");
    setFormData((prev) => ({
      ...prev,
      qualifications: [...prev.qualifications, val],
    }));
    setQualInput("");
  };

  const removeQualification = (index) => {
    setFormData((prev) => ({
      ...prev,
      qualifications: prev.qualifications.filter((_, i) => i !== index),
    }));
  };

  useEffect(() => {
    calculateDuration(formData.startDate, formData.endDateOrDuration);
  }, [formData.startDate, formData.endDateOrDuration, calculateDuration]);

  const resetForm = () => {
    setFormData({
      jobTitle: "",
      companyName: "",
      sector: "",
      city: "",
      country: "India",
      state: "",
      jobType: "Internship",
      jobDescription: "",
      startDate: "",
      endDateOrDuration: "",
      duration: "",
      internshipType: "",
      classification: "",
      compensationDetails: {
        type: "",
        amount: null,
        currency: "",
        frequency: "",
      },
      mode: "",
      qualifications: [],
      contactInfo: { name: "", email: "", phone: "" },
      imgUrl: "",
      studentApplied: false,
      adminApproved: false,
      applicationOpen: true,
    });
    setFieldErrors({
      jobTitle: "",
      companyName: "",
      "contactInfo.name": "",
      "contactInfo.email": "",
      "contactInfo.phone": "",
    });
    setTouchedFields({
      jobTitle: false,
      companyName: false,
      "contactInfo.name": false,
      "contactInfo.email": false,
      "contactInfo.phone": false,
    });
    setPreviewUrl(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const titleErr = validateJobTitle(formData.jobTitle);
    const compErr = validateCompanyName(formData.companyName);
    const contactNameErr = validateContactName(formData.contactInfo?.name);
    const contactEmailErr = validateEmail(formData.contactInfo?.email);
    const contactPhoneErr = validateContactPhone(formData.contactInfo?.phone, formData.country);

    if (titleErr || compErr || contactNameErr || contactEmailErr || contactPhoneErr) {
      setFieldErrors({
        jobTitle: titleErr,
        companyName: compErr,
        "contactInfo.name": contactNameErr,
        "contactInfo.email": contactEmailErr,
        "contactInfo.phone": contactPhoneErr,
      });
      setTouchedFields({
        jobTitle: true,
        companyName: true,
        "contactInfo.name": true,
        "contactInfo.email": true,
        "contactInfo.phone": true,
      });
      const firstErr =
        titleErr ||
        compErr ||
        contactNameErr ||
        contactEmailErr ||
        contactPhoneErr;
      setErrorMessage(firstErr);
      setTimeout(() => setErrorMessage(""), 6000);
      return;
    }

    if (!formData.sector) {
      setErrorMessage("Please select a Sector.");
      setTimeout(() => setErrorMessage(""), 6000);
      return;
    }
    if (!formData.classification) {
      setErrorMessage("Please select an Internship Classification.");
      setTimeout(() => setErrorMessage(""), 6000);
      return;
    }
    if (!formData.country) {
      setErrorMessage("Please select a Country.");
      setTimeout(() => setErrorMessage(""), 6000);
      return;
    }
    if (!formData.state) {
      setErrorMessage(`Please select a ${stateLabel}.`);
      setTimeout(() => setErrorMessage(""), 6000);
      return;
    }
    if (!formData.city || !formData.city.trim()) {
      setErrorMessage("Please enter a City.");
      setTimeout(() => setErrorMessage(""), 6000);
      return;
    }
    if (!formData.jobDescription || !formData.jobDescription.trim()) {
      setErrorMessage("Please enter a Job Description.");
      setTimeout(() => setErrorMessage(""), 6000);
      return;
    }
    if (!formData.startDate) {
      setErrorMessage("Please select a Start Date.");
      setTimeout(() => setErrorMessage(""), 6000);
      return;
    }
    if (!formData.endDateOrDuration) {
      setErrorMessage("Please select an End Date.");
      setTimeout(() => setErrorMessage(""), 6000);
      return;
    }
    if (!formData.mode) {
      setErrorMessage("Please select a Mode of Internship.");
      setTimeout(() => setErrorMessage(""), 6000);
      return;
    }
    if (!formData.internshipType) {
      setErrorMessage("Please select an Internship Type.");
      setTimeout(() => setErrorMessage(""), 6000);
      return;
    }

    const pid = localStorage.getItem("partnerId");
    if (!pid) {
      console.error("No partner ID");
      return;
    }

    if (userType === "Freemium" && formData.internshipType === "PAID") {
      setFreemiumAlert("Upgrade required to post paid internships.");
      setTimeout(() => setFreemiumAlert(""), 3500);
      return;
    }

    const payload = {
      ...formData,
      imgUrl: formData.imgUrl || edutechex_logo_white,
      internshipMode: (formData.mode || "ONLINE").toUpperCase(),
      location: formData.state
        ? `${formData.city}, ${formData.state}, ${formData.country}`
        : `${formData.city}, ${formData.country}`,
      partnerId: pid,
      qualifications:
        typeof formData.qualifications === "string"
          ? formData.qualifications
              .split(",")
              .map((q) => q.trim())
              .filter(Boolean)
          : formData.qualifications,
    };

    try {
      const res = await axios.post("/api/interns", payload);
      saveJob(res.data);
      resetForm();
      setShowSuccessModal(true);
    } catch (err) {
      console.error("Error posting internship:", err);
      let errMsg = "Failed to post internship. Please try again.";

      const backendMsg = err.response?.data?.message || "";
      const backendErr = err.response?.data?.error || "";
      const combinedError = `${backendMsg} ${backendErr}`.trim();

      if (
        combinedError.includes(
          "Freemium partners can post up to 2 internships only",
        )
      ) {
        errMsg =
          "You have reached the free limit of 2 internships. Please upgrade your subscription to post more.";
      } else if (combinedError.includes("validation failed")) {
        const errorPart = combinedError.split("validation failed: ")[1];
        if (errorPart) {
          const rawFields = errorPart
            .split(",")
            .map((part) => part.split(":")[0].trim());
          const friendlyNames = {
            "compensationDetails.type": "Compensation Type",
            internshipType: "Internship Type",
            jobTitle: "Job Title",
            companyName: "Company Name",
            sector: "Sector",
            city: "City",
            state: "State",
            country: "Country",
            classification: "Classification",
          };
          const cleanFields = rawFields.map((f) => friendlyNames[f] || f);
          errMsg = `Please fill in all required fields: ${cleanFields.join(", ")}`;
        } else {
          errMsg = "Please fill in all required fields.";
        }
      } else if (combinedError) {
        errMsg = combinedError;
      }

      setErrorMessage(errMsg);
      setTimeout(() => setErrorMessage(""), 6000);
    }
  };

  const inputCls =
    "w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring focus:ring-teal-500";
  const locationInputCls =
    "!mt-0 w-full h-12 box-border p-3 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 focus:ring-offset-white";

  return (
    <div className="max-w-4xl font-poppins mx-auto px-4 py-6 sm:p-6 bg-white rounded-lg shadow-lg mt-4 sm:mt-8">
      <h2 className="text-2xl font-semibold text-gray-800 mb-4">
        Post an Internship
      </h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Job Title */}
        <div>
          <label className="block text-gray-700 font-medium mb-2">
            Job Title <span className="text-red-500">*</span>
          </label>
          {/*Add the style attribute for alignment - 04-08-2026 */}
          <input
            type="text"
            name="jobTitle"
            value={formData.jobTitle}
            onChange={handleChange}
            onBlur={handleBlur}
            required
            maxLength={100}
            className={`${inputCls} ${
              touchedFields.jobTitle && fieldErrors.jobTitle
                ? "!border-red-500 focus:!ring-red-400 bg-red-50/20"
                : ""
            }`}
            placeholder="Enter job title"
            style={{ marginTop: "0px" }}
          />
          {touchedFields.jobTitle && fieldErrors.jobTitle && (
            <p className="text-red-500 text-xs sm:text-sm mt-1 font-medium">
              {fieldErrors.jobTitle}
            </p>
          )}
        </div>

        {/* Company Name */}
        <div>
          <label className="block text-gray-700 font-medium mb-2">
            Company Name <span className="text-red-500">*</span>
          </label>
          {/*Add the style attribute for alignment - 04-08-2026 */}
          <input
            type="text"
            name="companyName"
            value={formData.companyName}
            onChange={handleChange}
            onBlur={handleBlur}
            required
            maxLength={100}
            className={`${inputCls} ${
              touchedFields.companyName && fieldErrors.companyName
                ? "!border-red-500 focus:!ring-red-400 bg-red-50/20"
                : ""
            }`}
            style={{ marginTop: "0px" }}
            placeholder="Enter company name"
          />
          {touchedFields.companyName && fieldErrors.companyName && (
            <p className="text-red-500 text-xs sm:text-sm mt-1 font-medium">
              {fieldErrors.companyName}
            </p>
          )}
        </div>

        {/* Sector */}
        <div>
          <label className="block text-gray-700 font-medium mb-2">Sector</label>
          <CustomSelect
            name="sector"
            value={formData.sector}
            onChange={handleChange}
            options={topSectors.map((s) => ({ value: s.id, label: s.name }))}
            placeholder="Select a Sector"
          />
        </div>

        {/* Classification */}
        <div>
          <label className="block text-gray-700 font-medium mb-2">
            Internship Classification
          </label>
          <CustomSelect
            name="classification"
            value={formData.classification}
            onChange={handleChange}
            options={[
              { value: "Basic", label: "Basic" },
              { value: "Intermediate", label: "Intermediate" },
              { value: "Advanced", label: "Advanced" },
            ]}
            placeholder="Select Classification"
          />
        </div>

        {/* Location */}
        <div>
          <label className="block text-gray-700 font-medium mb-2">
            Location
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-start">
            <div className="w-full min-w-0 flex flex-col">
              <label htmlFor="country" className="block text-gray-700 text-sm font-medium mb-1.5 h-5 flex items-center">
                Country <span className="text-red-500 ml-0.5">*</span>
              </label>
              <CustomSelect
                name="country"
                value={formData.country}
                onChange={(e) => {
                  setFormData((p) => ({
                    ...p,
                    country: e.target.value,
                    state: "",
                  }));
                  setCitySuggestions([]);
                }}
                options={[{ value: "India", label: "India" }]}
                placeholder="Select Country"
              />
            </div>

            <div className="w-full min-w-0 flex flex-col">
              <label htmlFor="state" className="block text-gray-700 text-sm font-medium mb-1.5 h-5 flex items-center">
                {stateLabel} <span className="text-red-500 ml-0.5">*</span>
              </label>
              <CustomSelect
                name="state"
                value={formData.state}
                onChange={handleChange}
                options={stateList.map((s) => ({ value: s, label: s }))}
                placeholder={`Select ${stateLabel}`}
              />
            </div>

            <div className="w-full min-w-0 relative flex flex-col">
              <label htmlFor="city" className="block text-gray-700 text-sm font-medium mb-1.5 h-5 flex items-center">
                City <span className="text-red-500 ml-0.5">*</span>
              </label>
              <input
                id="city"
                type="text"
                name="city"
                value={formData.city}
                onChange={handleCityInputChange}
                autoComplete="address-level2"
                required
                placeholder="Start typing city"
                className={`${locationInputCls} relative z-[15]`}
              />
              {citySuggestions.length > 0 && (
                <ul className="absolute z-[20] left-0 right-0 w-full mt-2 top-[72px] max-h-48 overflow-y-auto bg-white border border-gray-300 rounded-lg shadow-lg">
                  {citySuggestions.map((city) => (
                    <li
                      key={city.wikiDataId || city.id || city.name}
                      className="px-4 py-2 cursor-pointer hover:bg-teal-50 hover:text-teal-700 break-words text-sm"
                      onClick={() => handleCitySelect(city.name)}
                    >
                      {city.name}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* Job Description */}
        <div>
          <label className="block text-gray-700 font-medium mb-2">
            Job Description
          </label>
          {/*Add the style attribute for alignment - 04-08-2026 */}
          <textarea
            name="jobDescription"
            value={formData.jobDescription}
            onChange={handleChange}
            required
            maxLength={4000}
            rows="4"
            className={inputCls}
            style={{ marginTop: "0px" }}
            placeholder="Describe the job responsibilities, requirements, etc. (max 4000 chars)"
          />
        </div>

        {/* Start Date */}
        <div>
          <label className="block text-gray-700 font-medium mb-2">
            Start Date
          </label>
          <div className="relative w-full">
            <DatePicker
              selected={
                formData.startDate ? new Date(formData.startDate + "T00:00:00") : null
              }
              onChange={(date) => {
                if (!date) {
                  handleChange({ target: { name: "startDate", value: "" } });
                } else {
                  const y = date.getFullYear();
                  const m = String(date.getMonth() + 1).padStart(2, "0");
                  const d = String(date.getDate()).padStart(2, "0");
                  handleChange({
                    target: { name: "startDate", value: `${y}-${m}-${d}` },
                  });
                }
              }}
              minDate={(() => {
                const d = new Date();
                d.setMonth(d.getMonth() + 1);
                return d;
              })()}
              dateFormat="yyyy-MM-dd"
              placeholderText="Select start date (YYYY-MM-DD)"
              className="w-full h-12 box-border p-3 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-500 font-poppins text-sm cursor-pointer"
              wrapperClassName="w-full"
            />
          </div>
        </div>

        {/* End Date */}
        <div>
          <label className="block text-gray-700 font-medium mb-2">
            End Date
          </label>
          <div className="relative w-full">
            <DatePicker
              selected={
                formData.endDateOrDuration
                  ? new Date(formData.endDateOrDuration + "T00:00:00")
                  : null
              }
              onChange={(date) => {
                if (!date) {
                  handleChange({
                    target: { name: "endDateOrDuration", value: "" },
                  });
                } else {
                  const y = date.getFullYear();
                  const m = String(date.getMonth() + 1).padStart(2, "0");
                  const d = String(date.getDate()).padStart(2, "0");
                  handleChange({
                    target: { name: "endDateOrDuration", value: `${y}-${m}-${d}` },
                  });
                }
              }}
              minDate={(() => {
                const base = formData.startDate
                  ? new Date(formData.startDate + "T00:00:00")
                  : new Date();
                base.setMonth(base.getMonth() + 1);
                return base;
              })()}
              dateFormat="yyyy-MM-dd"
              placeholderText="Select end date (YYYY-MM-DD)"
              className="w-full h-12 box-border p-3 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-500 font-poppins text-sm cursor-pointer"
              wrapperClassName="w-full"
            />
          </div>
        </div>

        {/* Calculated Duration */}
        <div>
          <label className="block text-gray-700 font-medium mb-2">
            Calculated Duration
          </label>
          {/*Add the style attribute for alignment - 04-08-2026 */}
          <input
            type="text"
            name="duration"
            value={formData.duration}
            readOnly
            placeholder="Duration will be calculated"
            className={inputCls}
            style={{ marginTop: "0px" }}
          />
        </div>

        {/* Mode */}
        <div>
          <label className="block text-gray-700 font-medium mb-2">
            Mode of Internship
          </label>
          <CustomSelect
            name="mode"
            value={formData.mode}
            onChange={handleChange}
            options={[
              { value: "Online", label: "Online" },
              { value: "Offline", label: "Offline" },
              { value: "Hybrid", label: "Hybrid" },
            ]}
            placeholder="Select Mode"
          />
        </div>

        {/* Qualifications */}
        <div>
          <label className="block text-gray-700 font-medium mb-2">
            Qualifications
          </label>
          <div
            className="flex flex-wrap gap-2 items-center min-h-[48px] p-2 border border-gray-300 rounded-lg bg-white focus-within:ring focus-within:ring-teal-500 cursor-text"
            onClick={() => document.getElementById("qualInput").focus()}
          >
            {formData.qualifications.map((q, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 bg-teal-50 text-teal-700 text-sm px-3 py-1 rounded-full border border-teal-200"
              >
                {q}
                <button
                  type="button"
                  onClick={() => removeQualification(i)}
                  className="ml-1 text-teal-500 hover:text-red-500 leading-none"
                  aria-label={`Remove ${q}`}
                >
                  &times;
                </button>
              </span>
            ))}
            {/*Add "!mt-0" for alignment - 15-09-2026 */}
            <input
              id="qualInput"
              type="text"
              value={qualInput}
              onChange={(e) => {
                setQualInput(e.target.value);
                if (skillError) setSkillError("");
              }}
              maxLength={50}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addQualification();
                }
              }}
              placeholder={
                formData.qualifications.length === 0
                  ? "Type a skill and press Enter or Add..."
                  : "Add another..."
              }
              className="!mt-0 flex-1 min-w-[160px] outline-none bg-transparent text-sm py-1 px-1"
            />
            <button
              type="button"
              onClick={addQualification}
              className="text-sm px-3 py-1 border border-gray-300 rounded-md text-gray-600 hover:bg-teal-50 hover:text-teal-700 hover:border-teal-300"
            >
              + Add
            </button>
          </div>
          {skillError && (
            <p className="text-xs text-red-500 font-medium mt-1">
              {skillError}
            </p>
          )}
          <p className="text-xs text-gray-400 mt-1">
            Press Enter or click Add. Click &times; to remove a skill.
          </p>
        </div>

        {/* Contact Information */}
        <div>
          <label className="block text-gray-700 font-medium mb-2">
            Contact Information <span className="text-red-500">*</span>
          </label>
          <div className="space-y-3">
            <div>
              <input
                type="text"
                name="contactInfo.name"
                value={formData.contactInfo.name}
                onChange={handleChange}
                onBlur={handleBlur}
                required
                maxLength={60}
                className={`${inputCls} ${
                  touchedFields["contactInfo.name"] && fieldErrors["contactInfo.name"]
                    ? "!border-red-500 focus:!ring-red-400 bg-red-50/20"
                    : ""
                }`}
                placeholder="Contact Name (e.g. Priya Sharma)"
              />
              {touchedFields["contactInfo.name"] && fieldErrors["contactInfo.name"] && (
                <p className="text-xs text-red-500 mt-1 font-medium flex items-center gap-1">
                  <span>⚠️</span> {fieldErrors["contactInfo.name"]}
                </p>
              )}
            </div>

            <div>
              <input
                type="email"
                name="contactInfo.email"
                value={formData.contactInfo.email}
                onChange={handleChange}
                onBlur={handleBlur}
                required
                maxLength={80}
                className={`${inputCls} ${
                  touchedFields["contactInfo.email"] && fieldErrors["contactInfo.email"]
                    ? "!border-red-500 focus:!ring-red-400 bg-red-50/20"
                    : ""
                }`}
                placeholder="Contact Email (e.g. name@example.com)"
              />
              {touchedFields["contactInfo.email"] && fieldErrors["contactInfo.email"] && (
                <p className="text-xs text-red-500 mt-1 font-medium flex items-center gap-1">
                  <span>⚠️</span> {fieldErrors["contactInfo.email"]}
                </p>
              )}
            </div>

            <div>
              <input
                type="tel"
                name="contactInfo.phone"
                value={formData.contactInfo.phone}
                onChange={handleChange}
                onBlur={handleBlur}
                required
                maxLength={25}
                className={`${inputCls} ${
                  touchedFields["contactInfo.phone"] && fieldErrors["contactInfo.phone"]
                    ? "!border-red-500 focus:!ring-red-400 bg-red-50/20"
                    : ""
                }`}
                placeholder="Contact Phone (e.g. 9876543210)"
              />
              {touchedFields["contactInfo.phone"] && fieldErrors["contactInfo.phone"] && (
                <p className="text-xs text-red-500 mt-1 font-medium flex items-center gap-1">
                  <span>⚠️</span> {fieldErrors["contactInfo.phone"]}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Upload Image */}
        <div>
          <label className="block text-gray-700 font-medium mb-2">
            Upload Image
          </label>
          {/*Add the style attribute for alignment - 04-08-2026 */}
          <input
            type="file"
            accept="image/*, image/svg+xml, .svg"
            onChange={handleFileUpload}
            className={inputCls}
            style={{ padding: "4px" }}
          />
          {uploading && (
            <p className="text-sm text-gray-500 mt-1">Uploading image...</p>
          )}
          <img
            src={previewUrl || formData.imgUrl || edutechex_logo_white}
            alt="Internship preview"
            className="mt-2 h-24 w-24 rounded-lg object-cover border border-gray-200"
          />
        </div>

        {/* Internship Type - select (Free/Stipend) + Paid radio */}
        <div>
          <label className="block text-gray-700 font-medium mb-3">
            Internship Type
          </label>

          {/* Hidden input for form validation - fires if no type is selected */}
          <input
            type="text"
            value={formData.internshipType}
            required
            readOnly
            tabIndex={-1}
            style={{
              position: "absolute",
              opacity: 0,
              height: 0,
              width: 0,
              pointerEvents: "none",
            }}
            aria-hidden="true"
          />

          {/* Select for Free / Stipend */}
          <CustomSelect
            name="internshipType"
            value={
              formData.internshipType === "PAID" ? "" : formData.internshipType
            }
            onChange={handleChange}
            options={[
              { value: "FREE", label: "Free" },
              { value: "STIPEND", label: "Stipend" },
            ]}
            placeholder="Select Internship Type"
          />

          {/* Description banner for Free or Stipend */}
          {(formData.internshipType === "FREE" ||
            formData.internshipType === "STIPEND") && (
            <div
              className={`mt-3 px-4 py-3 rounded-xl border flex items-start gap-2 ${
                formData.internshipType === "STIPEND"
                  ? "bg-emerald-50/60 border-emerald-100"
                  : "bg-slate-50 border-slate-200"
              }`}
            >
              <p
                className={`text-sm leading-tight ${
                  formData.internshipType === "STIPEND"
                    ? "text-emerald-700"
                    : "text-slate-600"
                }`}
              >
                {formData.internshipType === "STIPEND" ? (
                  <>
                    <strong>Stipend:</strong> Students receive a stipend from
                    your organization during the internship.
                  </>
                ) : (
                  <>
                    <strong>Free:</strong> Students join without paying any fee
                    and do not receive a stipend.
                  </>
                )}
              </p>
            </div>
          )}

          {/* Paid radio option */}
          <div className="mt-4">
            <label
              className={`flex h-11 items-center px-3 border rounded-lg transition-all ${
                userType === "Freemium"
                  ? "opacity-50 cursor-not-allowed bg-gray-50 border-gray-200"
                  : formData.internshipType === "PAID"
                    ? "border-teal-500 bg-teal-50 ring-1 ring-teal-500 cursor-pointer"
                    : "border-gray-300 hover:bg-gray-50 cursor-pointer"
              }`}
            >
              <input
                type="radio"
                name="internshipTypeRadio"
                value="PAID"
                disabled={userType === "Freemium"}
                checked={formData.internshipType === "PAID"}
                onChange={(e) =>
                  handleChange({
                    target: { name: "internshipType", value: e.target.value },
                  })
                }
                className="m-0 h-5 w-5 shrink-0 self-center text-teal-600 focus:ring-teal-500 border-gray-300 disabled:cursor-not-allowed cursor-pointer"
              />
              <span className="ml-3 flex items-center gap-2 font-medium leading-none text-gray-800">
                <span className="leading-none">Paid</span>
                {userType === "Freemium" && (
                  <span className="text-xs text-red-500 mt-0.5">
                    (Upgrade required)
                  </span>
                )}
              </span>
            </label>
          </div>

          {/* Description banner for Paid */}
          {formData.internshipType === "PAID" && (
            <div className="mt-3 px-4 py-3 bg-orange-50/60 rounded-xl border border-orange-100 flex items-start gap-2">
              <p className="text-sm text-orange-700 leading-tight">
                <strong>Paid:</strong> Students pay a fee to enroll in this
                internship program.
              </p>
            </div>
          )}
        </div>

        {/* Compensation Details - shown only for STIPEND or PAID */}
        {(formData.internshipType === "STIPEND" ||
          formData.internshipType === "PAID") && (
          <div className="space-y-4">
            <div>
              <label className="block text-gray-700 font-medium mb-2">
                Amount
              </label>
              {/*Add the style attribute for alignment - 04-08-2026 */}
              <input
                type="number"
                name="compensationDetails.amount"
                value={formData.compensationDetails.amount || ""}
                onChange={handleChange}
                required
                min="0"
                className={inputCls}
                style={{ marginTop: "0px" }}
                placeholder="Enter amount"
              />
            </div>

            <div>
              <label className="block text-gray-700 font-medium mb-2">
                Currency
              </label>
              <CustomSelect
                name="compensationDetails.currency"
                value={formData.compensationDetails.currency}
                onChange={handleChange}
                options={[{ value: "INR", label: "INR" }]}
                placeholder="Select Currency"
              />
            </div>

            {/* Frequency is always One Time - hidden */}
            <input
              type="hidden"
              name="compensationDetails.frequency"
              value="ONE_TIME"
            />
          </div>
        )}

        {/* Open for Applications */}
        <div>
          <label className="inline-flex items-center space-x-2">
            <input
              type="checkbox"
              name="applicationOpen"
              checked={formData.applicationOpen}
              onChange={(e) =>
                setFormData((p) => ({
                  ...p,
                  applicationOpen: e.target.checked,
                }))
              }
              className="form-checkbox h-5 w-5 text-teal-600"
            />
            {/*Add "mt-4" style for alignment - 04-08-2026 */}
            <span className="mt-4 text-gray-700 font-medium">
              Open for Applications
            </span>
          </label>
        </div>

        {/* Submit */}
        <div>
          <button
            type="submit"
            className="w-full py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 focus:outline-none focus:ring focus:ring-teal-500"
          >
            Post Internship
          </button>
        </div>
      </form>

      {/* Success modal */}
      {showSuccessModal && (
        <SuccessModal
          onOk={() => {
            setShowSuccessModal(false);
            handleSelectTab("your-job-posts");
          }}
        />
      )}

      {/* Freemium upgrade alert */}
      {freemiumAlert && (
        <div className="fixed top-5 left-4 right-4 sm:left-auto sm:right-8 sm:top-20 z-[9999] max-w-md bg-orange-500 text-white py-3 px-5 rounded-xl shadow-2xl transition-all duration-300 text-sm font-medium">
          {freemiumAlert}
        </div>
      )}

      {/* Error toast */}
      {errorMessage && (
        <div className="fixed top-5 left-4 right-4 sm:left-auto sm:right-8 sm:top-20 z-[9999] max-w-md bg-red-600 text-white py-3 px-5 rounded-xl shadow-2xl transition-all duration-300 text-sm font-medium flex items-start justify-between gap-3 animate-fade-in">
          <span>{errorMessage}</span>
          <button
            type="button"
            onClick={() => setErrorMessage("")}
            className="text-white/80 hover:text-white font-bold ml-2 text-base leading-none"
            aria-label="Close error"
          >
            &times;
          </button>
        </div>
      )}
    </div>
  );
};

export default PostAJob;