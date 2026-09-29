//File: PostAJob.js

import React, { useState, useEffect, useCallback, useRef } from "react";
import axios from "../../../../api/axiosInstance";
import defaultCompanyLogo from "../../../../assets/default-company-logo.png";

import { useTabContext } from "./UserHomePageContext/HomePageContext";

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
        OK — View My Posts
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

const US_STATES = [
  "Alabama",
  "Alaska",
  "Arizona",
  "Arkansas",
  "California",
  "Colorado",
  "Connecticut",
  "Delaware",
  "District of Columbia",
  "Florida",
  "Georgia",
  "Hawaii",
  "Idaho",
  "Illinois",
  "Indiana",
  "Iowa",
  "Kansas",
  "Kentucky",
  "Louisiana",
  "Maine",
  "Maryland",
  "Massachusetts",
  "Michigan",
  "Minnesota",
  "Mississippi",
  "Missouri",
  "Montana",
  "Nebraska",
  "Nevada",
  "New Hampshire",
  "New Jersey",
  "New Mexico",
  "New York",
  "North Carolina",
  "North Dakota",
  "Ohio",
  "Oklahoma",
  "Oregon",
  "Pennsylvania",
  "Rhode Island",
  "South Carolina",
  "South Dakota",
  "Tennessee",
  "Texas",
  "Utah",
  "Vermont",
  "Virginia",
  "Washington",
  "West Virginia",
  "Wisconsin",
  "Wyoming",
];

const CA_PROVINCES = [
  "Alberta",
  "British Columbia",
  "Manitoba",
  "New Brunswick",
  "Newfoundland and Labrador",
  "Northwest Territories",
  "Nova Scotia",
  "Nunavut",
  "Ontario",
  "Prince Edward Island",
  "Quebec",
  "Saskatchewan",
  "Yukon",
];

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
    { id: "architecture-built-environment", name: "Architecture & Built Environment" },
  ];

  const [formData, setFormData] = useState({
    jobTitle: "",
    companyName: "",
    sector: "",
    city: "",
    country: "",
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

  const stateList = formData.country === "Canada" ? CA_PROVINCES : US_STATES;
  const stateLabel =
    formData.country === "Canada" ? "Province / Territory" : "State";
  const [qualInput, setQualInput] = useState("");

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
        const countryIds =
          formData.country === "Canada"
            ? "CA"
            : formData.country === "United States"
              ? "US"
              : "US,CA";

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
        return {
          ...prev,
          contactInfo: { ...prev.contactInfo, [field]: value },
        };
      }
      return { ...prev, [name]: value };
    });
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
      country: "",
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
    setPreviewUrl(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
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
      imgUrl: formData.imgUrl || defaultCompanyLogo,
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
    <div className="max-w-4xl font-poppins mx-auto p-6 bg-white rounded-lg shadow-lg mt-8 mb-40">
      <h2 className="text-2xl font-semibold text-gray-800 mb-4">
        Post an Internship
      </h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Job Title */}
        <div>
          <label className="block text-gray-700 font-medium mb-2">
            Job Title
          </label>
          {/*Add the style attribute for alignment - 04-08-2026 */}
          <input
            type="text"
            name="jobTitle"
            value={formData.jobTitle}
            onChange={handleChange}
            required
            className={inputCls}
            placeholder="Enter job title"
            style={{ marginTop: "0px" }}
          />
        </div>

        {/* Company Name */}
        <div>
          <label className="block text-gray-700 font-medium mb-2">
            Company Name
          </label>
          {/*Add the style attribute for alignment - 04-08-2026 */}
          <input
            type="text"
            name="companyName"
            value={formData.companyName}
            onChange={handleChange}
            required
            className={inputCls}
            style={{ marginTop: "0px" }}
            placeholder="Enter company name"
          />
        </div>

        {/* Sector */}
        <div>
          <label className="block text-gray-700 font-medium mb-2">Sector</label>
          <select
            name="sector"
            value={formData.sector}
            onChange={handleChange}
            required
            className={inputCls}
          >
            <option value="" disabled>
              Select a Sector
            </option>
            {topSectors.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        {/* Classification */}
        <div>
          <label className="block text-gray-700 font-medium mb-2">
            Internship Classification
          </label>
          <select
            name="classification"
            value={formData.classification}
            onChange={handleChange}
            required
            className={inputCls}
          >
            <option value="" disabled>
              Select Classification
            </option>
            <option value="Basic">Basic</option>
            <option value="Intermediate">Intermediate</option>
            <option value="Advanced">Advanced</option>
          </select>
        </div>

        {/* Location */}
        <div>
          <label className="block text-gray-700 font-medium mb-2">
            Location
          </label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
            <div className="flex flex-col gap-1">
              <label htmlFor="country" className="block text-gray-700 text-sm">
                Country *
              </label>
              <select
                id="country"
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
                required
                className={locationInputCls}
              >
                <option value="" disabled>
                  Select Country
                </option>
                <option value="United States">United States</option>
                <option value="Canada">Canada</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="state" className="block text-gray-700 text-sm">
                {stateLabel} *
              </label>
              <select
                id="state"
                name="state"
                value={formData.state}
                onChange={handleChange}
                required
                className={locationInputCls}
              >
                <option value="" disabled>
                  Select {stateLabel}
                </option>
                {stateList.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div className="relative flex flex-col gap-1">
              <label htmlFor="city" className="block text-gray-700 text-sm">
                City *
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
                <ul className="absolute z-[20] left-0 top-full w-full mt-2 max-h-48 overflow-y-auto bg-white border border-gray-300 rounded-lg shadow-lg">
                  {citySuggestions.map((city) => (
                    <li
                      key={city.wikiDataId || city.id || city.name}
                      className="px-4 py-2 cursor-pointer hover:bg-teal-50 hover:text-teal-700"
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
            rows="4"
            className={inputCls}
            style={{ marginTop: "0px" }}
            placeholder="Describe the job responsibilities, requirements, etc."
          />
        </div>

        {/* Start Date */}
        <div>
          <label className="block text-gray-700 font-medium mb-2">
            Start Date
          </label>
          {/*Add the style attribute for alignment - 04-08-2026 */}
          <input
            type="date"
            name="startDate"
            value={formData.startDate}
            onChange={handleChange}
            required
            min={new Date().toISOString().split("T")[0]}
            className={inputCls}
            style={{ marginTop: "0px" }}
          />
        </div>

        {/* End Date */}
        <div>
          <label className="block text-gray-700 font-medium mb-2">
            End Date
          </label>
          {/*Add the style attribute for alignment - 04-08-2026 */}
          <input
            type="date"
            name="endDateOrDuration"
            value={formData.endDateOrDuration}
            onChange={handleChange}
            required
            min={formData.startDate || new Date().toISOString().split("T")[0]}
            className={inputCls}
            style={{ marginTop: "0px" }}
          />
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
          <select
            name="mode"
            value={formData.mode}
            onChange={handleChange}
            required
            className={inputCls}
          >
            <option value="" disabled>
              Select Mode
            </option>
            <option value="Online">Online</option>
            <option value="Offline">Offline</option>
            <option value="Hybrid">Hybrid</option>
          </select>
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
                  ×
                </button>
              </span>
            ))}
            <input
              id="qualInput"
              type="text"
              value={qualInput}
              onChange={(e) => setQualInput(e.target.value)}
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
              className="flex-1 min-w-[160px] outline-none bg-transparent text-sm py-1 px-1"
            />
            <button
              type="button"
              onClick={addQualification}
              className="text-sm px-3 py-1 border border-gray-300 rounded-md text-gray-600 hover:bg-teal-50 hover:text-teal-700 hover:border-teal-300"
            >
              + Add
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Press Enter or click Add. Click × to remove a skill.
          </p>
        </div>

        {/* Contact Information */}
        <div>
          <label className="block text-gray-700 font-medium mb-2">
            Contact Information
          </label>
          <div className="space-y-2">
            <input
              type="text"
              name="contactInfo.name"
              value={formData.contactInfo.name}
              onChange={handleChange}
              required
              className={inputCls}
              placeholder="Contact Name"
            />
            <input
              type="email"
              name="contactInfo.email"
              value={formData.contactInfo.email}
              onChange={handleChange}
              required
              className={inputCls}
              placeholder="Contact Email"
            />
            <input
              type="tel"
              name="contactInfo.phone"
              value={formData.contactInfo.phone}
              onChange={handleChange}
              required
              className={inputCls}
              placeholder="Contact Phone"
            />
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
            src={previewUrl || formData.imgUrl || defaultCompanyLogo}
            alt="Internship preview"
            className="mt-2 h-24 w-24 rounded-lg object-cover border border-gray-200"
          />
        </div>

        {/* Internship Type — select (Free/Stipend) + Paid radio */}
        <div>
          <label className="block text-gray-700 font-medium mb-3">
            Internship Type
          </label>

          {/* Hidden input for form validation — fires if no type is selected */}
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
          <select
            value={
              formData.internshipType === "PAID" ? "" : formData.internshipType
            }
            onChange={handleChange}
            name="internshipType"
            className={inputCls}
          >
            <option value="" disabled>
              Select Internship Type
            </option>
            <option value="FREE">Free</option>
            <option value="STIPEND">Stipend</option>
          </select>

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

        {/* Compensation Details — shown only for STIPEND or PAID */}
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
              <select
                name="compensationDetails.currency"
                value={formData.compensationDetails.currency}
                onChange={handleChange}
                required
                className={inputCls}
              >
                <option value="" disabled>
                  Select Currency
                </option>
                <option value="USD">USD</option>
                <option value="CAD">CAD</option>
                <option value="EUR">EUR</option>
                <option value="INR">INR</option>
                <option value="GBP">GBP</option>
              </select>
            </div>

            {/* Frequency is always One Time — hidden */}
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
        <div className="fixed top-28 right-10 z-[9999] bg-orange-500 text-white py-3 px-6 rounded-lg shadow-lg transition-all duration-300">
          {freemiumAlert}
        </div>
      )}

      {/* Error toast */}
      {errorMessage && (
        <div className="fixed top-36 right-10 z-[9999] bg-red-600 text-white py-3 px-6 rounded-lg shadow-lg transition-all duration-300">
          {errorMessage}
        </div>
      )}
    </div>
  );
};

export default PostAJob;
