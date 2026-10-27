import React, { useState, useEffect, useRef } from "react";
import axios from "../../../../api/axiosInstance";
import LevelThree from "./LevelThree";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import {
  COUNTRY_OPTIONS,
  getStateList,
  getStateLabel,
  getZipLabel,
  getZipPlaceholder,
  isValidPostalCode,
  getPostalCodeError,
  isValidCity,
  getCityError,
} from "../../../../constants/locations";
import { PencilIcon, CheckIcon, XMarkIcon } from "@heroicons/react/24/solid";

const isValidUrl = (url) => {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim();
  if (!trimmed) return true; // optional/empty is valid
  const urlRegex = /^(https?:\/\/)?([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(:\d+)?(\/[^\s]*)?$/i;
  return urlRegex.test(trimmed);
};

const isValidLinkedInUrl = (url) => {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim();
  if (!trimmed) return true; // optional/empty is valid
  const linkedinRegex = /^(https?:\/\/)?((www|\w\w)\.)?linkedin\.com\/[^\s]+$/i;
  return linkedinRegex.test(trimmed);
};

const normalizeUrl = (url) => {
  if (!url || typeof url !== "string") return "";
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (!/^https?:\/\//i.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return trimmed;
};

const ProfileDropdown = ({
  name,
  value,
  onChange,
  options = [],
  placeholder = "Select...",
  disabled = false,
  className = "",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const normalizedOptions = options.map((opt) =>
    typeof opt === "object" && opt !== null
      ? opt
      : { value: opt, label: opt }
  );

  const selectedOpt = normalizedOptions.find(
    (opt) => String(opt.value) === String(value ?? "")
  );
  const displayLabel = selectedOpt && selectedOpt.label ? selectedOpt.label : placeholder;

  return (
    <div className="relative w-full min-w-0" ref={dropdownRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        className={`w-full min-w-0 border px-3 py-2 rounded-lg text-left bg-white text-gray-700 flex items-center justify-between gap-2 transition-all cursor-pointer ${
          disabled
            ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
            : isOpen
            ? "border-blue-500 ring-2 ring-blue-500"
            : "border-gray-300 hover:border-gray-400"
        } ${className}`}
      >
        <span
          className={`truncate text-sm ${
            !selectedOpt || !selectedOpt.value ? "text-gray-500" : "text-gray-800"
          }`}
        >
          {displayLabel}
        </span>
        <svg
          className={`w-4 h-4 text-gray-500 transition-transform duration-200 flex-shrink-0 ${
            isOpen ? "rotate-180" : ""
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

      {isOpen && !disabled && (
        <div className="absolute left-0 right-0 top-full mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto py-1">
          {normalizedOptions.map((opt, idx) => {
            const isSelected = String(opt.value) === String(value ?? "");
            return (
              <button
                key={opt.value ?? idx}
                type="button"
                title={opt.label}
                onClick={() => {
                  if (typeof onChange === "function") {
                    onChange({ target: { name, value: opt.value } });
                  }
                  setIsOpen(false);
                }}
                className={`w-full min-w-0 text-left px-3 py-2 text-sm transition-colors cursor-pointer truncate ${
                  isSelected
                    ? "bg-sky-100 text-sky-900 font-medium"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

const ProfileForm = () => {
  const [user, setUser] = useState({
    name: "",
    email: "",
    universityName: "",
    dob: "",
    educationLevel: "",
    fieldOfStudy: "",
    desiredField: "",
    linkedin: "",
    portfolio: "",
    financialStatus: "",
    state: "",
    country: "",
    city: "",
    postalCode: "",
    address: "",
    currentGrade: "",
    gradePercentage: "",
    profileImage: "",
    skills: "",
    interests: "",
    preferredLocations: "",
  });

  const [citySuggestions, setCitySuggestions] = useState([]);
  const [filteredInstitutionSuggestions, setFilteredInstitutionSuggestions] =
    useState([]);
  const cityTimerRef = useRef(null);
  const cityAbortRef = useRef(null);
  const institutionTimerRef = useRef(null);

  const [errorMessage, setErrorMessage] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState("");
  const [isLevel1Open, setIsLevel1Open] = useState(true);
  const [isLevel2Open, setIsLevel2Open] = useState(false);
  const [isLevel3Open, setIsLevel3Open] = useState(false);
  const [createLevelThree, setCreateLevelThree] = useState(true);

  const [isEditing, setIsEditing] = useState(false);
  const [tempUser, setTempUser] = useState({});
  //Add this for loading effect for save changes button - 11-08-2026
  const [isSaving, setIsSaving] = useState(false);

  const stateList = getStateList(tempUser.country);
  const stateLabel = getStateLabel(tempUser.country);
  const zipLabel = getZipLabel(tempUser.country);
  const zipPlaceholder = getZipPlaceholder(tempUser.country);

  const educationLevels = [
    { value: "", label: "Select Education Level" },
    { value: "highschool", label: "High School" },
    { value: "undergraduate", label: "Undergraduate" },
    { value: "graduate", label: "Graduate" },
  ];

  const gradeOptions = [
    { value: "", label: "Select Grade" },
    ...Array.from({ length: 5 }, (_, i) => {
      const grade = i + 8;
      return { value: `Grade ${grade}`, label: `Grade ${grade}` };
    }),
  ];

  const fieldOptions = [
    { value: "", label: "Select Your Field" },
    { value: "Space", label: "Space Internships" },
    { value: "Aeronautical", label: "Aeronautical Internships" },
    { value: "Tech", label: "Tech Internships" },
    { value: "Research", label: "Research Internships" },
    { value: "Education", label: "Education Internships" },
  ];

  const isValidDate = (date) => {
    if (!date || typeof date !== "string") return false;
    const parsed = new Date(date);
    return !isNaN(parsed.getTime());
  };

  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const token = localStorage.getItem("userToken");
        if (!token) {
          setErrorMessage("Please log in again.");
          return;
        }

        const { data } = await axios.get("/api/users/profile", {
          headers: { Authorization: `Bearer ${token}` },
        });

        const formattedData = {
          ...data,
          dob: isValidDate(data.dob) ? new Date(data.dob) : "",
          skills: Array.isArray(data.skills)
            ? data.skills.join(", ")
            : data.skills || "",
          interests: Array.isArray(data.interests)
            ? data.interests.join(", ")
            : data.interests || "",
          preferredLocations: Array.isArray(data.preferredLocations)
            ? data.preferredLocations.join(", ")
            : data.preferredLocations || "",
          universityName: data.universityName || data.institutionName || "",
          currentGrade: data.currentGrade || data.grade || "",
          postalCode: data.postalCode || data.zip || "",
        };

        setUser(formattedData);
        setTempUser(formattedData);
      } catch (err) {
        console.error(err);
        setErrorMessage("Failed to load profile.");
      }
    };

    fetchUserProfile();
  }, []);

  useEffect(() => {
    const cityTimer = cityTimerRef.current;
    const cityAbort = cityAbortRef.current;
    const institutionTimer = institutionTimerRef.current;

    return () => {
      if (cityTimer) clearTimeout(cityTimer);
      if (cityAbort) cityAbort.abort();
      if (institutionTimer) clearTimeout(institutionTimer);
    };
  }, []);

  const handleEditClick = () => {
    setIsEditing(true);
    setFieldErrors({});
    setErrorMessage(null);
    setTempUser({ ...user });
  };

  const handleCancelClick = () => {
    setIsEditing(false);
    setFieldErrors({});
    setErrorMessage(null);
    setTempUser({ ...user });
    setCitySuggestions([]);
    setFilteredInstitutionSuggestions([]);
  };

  const handleTempChange = (e) => {
    const { name, value } = e.target;
    if (name === "postalCode") {
      const err = getPostalCodeError(value, tempUser.country);
      setFieldErrors((prev) => ({ ...prev, postalCode: err }));
    } else if (fieldErrors[name]) {
      setFieldErrors((prev) => ({ ...prev, [name]: null }));
    }
    // ✅ FIX: Use functional update with spread to avoid stale state
    setTempUser((prev) => {
      const updated = { ...prev, [name]: value };
      // Clear currentGrade when education level changes away from highschool
      if (name === "educationLevel" && value !== "highschool") {
        updated.currentGrade = "";
      }
      return updated;
    });
  };

  const handleDateChange = (date) => {
    const updatedDate = date ? new Date(date) : null;
    if (updatedDate) updatedDate.setHours(0, 0, 0, 0);
    setTempUser((prev) => ({ ...prev, dob: updatedDate }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please upload an image file (JPEG, PNG, JPG)");
      return;
    }

    setTempUser((prev) => ({ ...prev, profileImage: file }));
  };

  const handleInstitutionInputChange = (e) => {
    const value = e.target.value;

    setTempUser((prev) => ({ ...prev, universityName: value }));

    if (institutionTimerRef.current) clearTimeout(institutionTimerRef.current);

    if (tempUser.educationLevel === "highschool") {
      setFilteredInstitutionSuggestions([]);
      return;
    }

    if (!value || value.trim().length < 2 || !tempUser.country) {
      setFilteredInstitutionSuggestions([]);
      return;
    }

    institutionTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/locations/universities?country=${encodeURIComponent(
            tempUser.country,
          )}&query=${encodeURIComponent(value.trim())}`,
        );

        if (!res.ok) return;

        const data = await res.json();
        setFilteredInstitutionSuggestions(data);
      } catch (err) {
        console.error("Institution fetch error:", err);
      }
    }, 400);
  };

  const handleCityInputChange = (e) => {
    const value = e.target.value;

    setTempUser((prev) => ({ ...prev, city: value }));

    if (value && /\d/.test(value)) {
      setFieldErrors((prev) => ({
        ...prev,
        city: "City name cannot contain numbers. Please enter text only (e.g., Dallas, New York).",
      }));
    } else if (fieldErrors.city) {
      setFieldErrors((prev) => ({ ...prev, city: null }));
    }

    if (cityTimerRef.current) clearTimeout(cityTimerRef.current);

    if (!tempUser.country) {
      setCitySuggestions([]);
      return;
    }

    if (!value || value.trim().length < 2) {
      setCitySuggestions([]);
      return;
    }

    cityTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/locations/cities?country=${encodeURIComponent(
            tempUser.country,
          )}&query=${encodeURIComponent(value.trim())}`,
        );

        if (!res.ok) return;

        const data = await res.json();
        setCitySuggestions(data);
      } catch (err) {
        console.error("City fetch error:", err);
      }
    }, 400);
  };

  const handleCitySelect = (c) => {
    setTempUser((prev) => ({
      ...prev,
      city: c.city,
      state: c.state,
    }));
    setFieldErrors((prev) => ({ ...prev, city: null }));
    setCitySuggestions([]);
  };

  const handleCountryChange = (value) => {
    setTempUser((prev) => ({
      ...prev,
      country: value,
      state: "",
      city: "",
      universityName: "",
    }));
    setFieldErrors((prev) => {
      const next = { ...prev, city: null };
      if (prev.postalCode && isValidPostalCode(tempUser.postalCode, value)) {
        next.postalCode = null;
      } else if (tempUser.postalCode) {
        next.postalCode = getPostalCodeError(tempUser.postalCode, value);
      }
      return next;
    });
    setCitySuggestions([]);
    setFilteredInstitutionSuggestions([]);
  };

  const handleUpdateProfile = async () => {
    //for save loading effect - 11-08-2026
    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage("");

    // Validate LinkedIn & Portfolio links
    const errors = {};
    const linkedinVal = tempUser.linkedin ? String(tempUser.linkedin).trim() : "";
    const portfolioVal = tempUser.portfolio ? String(tempUser.portfolio).trim() : "";

    if (linkedinVal && !isValidLinkedInUrl(linkedinVal)) {
      errors.linkedin = "Please enter a valid LinkedIn URL (e.g. https://linkedin.com/in/username)";
    }

    if (portfolioVal && !isValidUrl(portfolioVal)) {
      errors.portfolio = "Please enter a valid Portfolio URL (e.g. https://yourportfolio.com)";
    }

    // Validate City (text only, no numbers)
    if (tempUser.city && !isValidCity(tempUser.city)) {
      errors.city = getCityError(tempUser.city);
    }

    // Validate ZIP / Postal Code as per country
    if (tempUser.postalCode && !isValidPostalCode(tempUser.postalCode, tempUser.country)) {
      errors.postalCode = getPostalCodeError(tempUser.postalCode, tempUser.country);
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setErrorMessage("Please correct the highlighted errors before saving.");
      setIsSaving(false);
      return;
    }
    setFieldErrors({});

    try {
      const token = localStorage.getItem("userToken");
      if (!token) {
        setErrorMessage("Please log in again.");
        setIsSaving(false);
        return;
      }

      const formData = new FormData();

      // Normalize valid links or clear them
      const normalizedLinkedin = linkedinVal ? normalizeUrl(linkedinVal) : "";
      const normalizedPortfolio = portfolioVal ? normalizeUrl(portfolioVal) : "";
      formData.append("linkedin", normalizedLinkedin);
      formData.append("portfolio", normalizedPortfolio);
      formData.append("city", tempUser.city ? tempUser.city.trim() : "");
      formData.append("postalCode", tempUser.postalCode ? tempUser.postalCode.trim() : "");

      Object.entries(tempUser).forEach(([key, value]) => {
        if (
          key === "linkedin" ||
          key === "portfolio" ||
          key === "city" ||
          key === "postalCode"
        )
          return;
        if (value === undefined || value === null || value === "") return;
        if (key === "profileImage" && typeof value === "object") return;

        if (["skills", "interests", "preferredLocations"].includes(key)) {
          const list = value
            .split(",")
            .map((v) => v.trim())
            .filter(Boolean);
          formData.append(key, list.join(","));
          return;
        }

        if (key === "dob" && value instanceof Date) {
          formData.append("dob", value.toISOString());
          return;
        }

        formData.append(key, value);
      });

      if (tempUser.profileImage && typeof tempUser.profileImage === "object") {
        formData.append("profileImage", tempUser.profileImage);
      }

      await axios.put("/api/users/profile", formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      });

      const { data: updatedUser } = await axios.get("/api/users/profile", {
        headers: { Authorization: `Bearer ${token}` },
      });

      const formattedUpdatedUser = {
        ...updatedUser,
        dob: isValidDate(updatedUser.dob) ? new Date(updatedUser.dob) : "",
        skills: Array.isArray(updatedUser.skills)
          ? updatedUser.skills.join(", ")
          : updatedUser.skills || "",
        interests: Array.isArray(updatedUser.interests)
          ? updatedUser.interests.join(", ")
          : updatedUser.interests || "",
        preferredLocations: Array.isArray(updatedUser.preferredLocations)
          ? updatedUser.preferredLocations.join(", ")
          : updatedUser.preferredLocations || "",
        universityName:
          updatedUser.universityName || updatedUser.institutionName || "",
        currentGrade: updatedUser.currentGrade || updatedUser.grade || "",
        postalCode: updatedUser.postalCode || updatedUser.zip || "",
      };

      setUser(formattedUpdatedUser);
      setTempUser(formattedUpdatedUser); // ✅ FIX: sync tempUser too, otherwise Cancel after save shows stale data

      // ✅ FIX: Store the full updated profile in localStorage (not just updatedUser which
      //    lacks isPremium/planType fields that Navbar reads). Merge with existing stored
      //    premium fields so they are never wiped on a profile save.
      const existingStored = (() => {
        try {
          return (
            JSON.parse(localStorage.getItem("studentInfo")) ||
            JSON.parse(localStorage.getItem("userInfo")) ||
            {}
          );
        } catch {
          return {};
        }
      })();
      localStorage.setItem(
        "studentInfo",
        JSON.stringify({
          ...existingStored,
          ...updatedUser,
          // Never overwrite premium fields from a profile-update response
          isPremium: existingStored.isPremium ?? updatedUser.isPremium,
          planType: existingStored.planType ?? updatedUser.planType ?? "Free",
          premiumExpiration:
            existingStored.premiumExpiration ?? updatedUser.premiumExpiration,
        }),
      );

      // ✅ FIX: Dispatch "userInfoUpdated" (what Navbar actually listens for after our fix),
      //    AND the native "storage" event for any other listeners.
      window.dispatchEvent(new Event("storage"));
      window.dispatchEvent(new Event("userInfoUpdated"));

      setSuccessMessage("Profile updated successfully!");
      setIsEditing(false);

      setCitySuggestions([]);
      setFilteredInstitutionSuggestions([]);
    } catch (err) {
      console.error(err);
      setErrorMessage(err.response?.data?.message || "Profile update failed.");
    } finally {
      //Add this for save loading effect - 11-08-2026
      setIsSaving(false);
    }
  };

  const formatDate = (date) => {
    if (!date) return "";
    if (typeof date === "string") {
      const d = new Date(date);
      return isNaN(d.getTime()) ? "" : d.toLocaleDateString();
    }
    if (date instanceof Date) {
      return date.toLocaleDateString();
    }
    return "";
  };

  const getDisplayValue = (value, options) => {
    if (!value) return "";
    const option = options.find((opt) => opt.value === value);
    return option ? option.label : value;
  };

  // ✅ FIX: Use tempUser.educationLevel in edit mode for conditional rendering,
  //    and user.educationLevel in view mode — previously both always used user.educationLevel
  //    which meant grade/school fields showed stale values while editing.
  const activeEducationLevel = isEditing
    ? tempUser.educationLevel
    : user.educationLevel;

  return (
    <div className="min-h-screen mt-2 sm:mt-8 flex justify-center bg-gray-50 font-poppins px-0 sm:px-4">
      <div className="w-full max-w-4xl bg-white p-3.5 sm:p-6 rounded-lg shadow-lg">
        {/* Header with Edit Button */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-6">
          <div>
            <h2 className="text-xl sm:text-3xl font-bold text-gray-800">Your Profile</h2>
            <p className="text-xs sm:text-base text-gray-500">
              {isEditing
                ? "Edit your personal and academic details"
                : "View your personal and academic details"}
            </p>
          </div>

          {!isEditing ? (
            <button
              onClick={handleEditClick}
              className="h-9 sm:h-11 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl transition duration-150 self-start sm:self-auto text-xs sm:text-sm font-semibold shadow-sm hover:shadow active:scale-[0.98] whitespace-nowrap"
            >
              <PencilIcon className="h-4 w-4" />
              Edit Profile
            </button>
          ) : (
            <div className="flex flex-row items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleCancelClick}
                className="flex-1 sm:flex-initial h-9 sm:h-10 flex items-center justify-center gap-1.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl transition duration-150 text-xs sm:text-sm font-semibold shadow-sm hover:border-gray-400 active:scale-[0.98] whitespace-nowrap min-w-0"
              >
                <XMarkIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-gray-500 flex-shrink-0" />
                <span>Cancel</span>
              </button>
              <button
                type="button"
                onClick={handleUpdateProfile}
                disabled={isSaving}
                className={`flex-1 sm:flex-initial h-9 sm:h-10 flex items-center justify-center gap-1.5 text-white px-3 sm:px-5 py-1.5 sm:py-2 rounded-xl transition duration-150 text-xs sm:text-sm font-semibold shadow-sm active:scale-[0.98] whitespace-nowrap min-w-0 ${
                  isSaving
                    ? "bg-emerald-400 cursor-not-allowed"
                    : "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20 hover:shadow-md"
                }`}
              >
                {isSaving ? (
                  <>
                    <svg
                      className="animate-spin h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0"
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
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                      />
                    </svg>
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <CheckIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
                    <span>Save Changes</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {errorMessage && (
          <div className="mb-4 p-4 bg-red-100 text-red-700 border border-red-200 rounded-lg">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="mb-4 p-4 bg-green-100 text-green-700 border border-green-200 rounded-lg">
            {successMessage}
          </div>
        )}

        {/* Profile Level 1 */}
        <div className="mb-6 border border-gray-200 rounded-lg overflow-hidden">
          <div
            className="flex justify-between items-center p-4 bg-blue-50 cursor-pointer hover:bg-blue-100"
            onClick={() => setIsLevel1Open(!isLevel1Open)}
          >
            <h3 className="text-xl font-semibold text-gray-800">
              Personal & Academic Information
            </h3>
            <span className="text-gray-600">{isLevel1Open ? "▲" : "▼"}</span>
          </div>

          {isLevel1Open && (
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Full Name */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    Full Name
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      name="name"
                      value={tempUser.name}
                      onChange={handleTempChange}
                      className="w-full border border-gray-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  ) : (
                    <div className="border border-gray-200 bg-gray-50 px-3 py-2 rounded-lg">
                      {user.name || "Not provided"}
                    </div>
                  )}
                </div>

                {/* Email Address */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    Email Address
                  </label>
                  {/*Add the "break-words" style to the email - 04-08-2026 */}
                  <div className="border border-gray-200 bg-gray-50 px-3 py-2 rounded-lg break-words">
                    {user.email}
                  </div>
                </div>

                {/* LinkedIn Profile */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    LinkedIn Profile
                  </label>
                  {isEditing ? (
                    <div>
                      <input
                        type="url"
                        name="linkedin"
                        value={tempUser.linkedin || ""}
                        onChange={handleTempChange}
                        className={`w-full border px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                          fieldErrors.linkedin
                            ? "border-red-500 bg-red-50/40 text-red-900"
                            : "border-gray-300"
                        }`}
                        placeholder="https://linkedin.com/in/username"
                      />
                      {fieldErrors.linkedin && (
                        <p className="text-xs text-red-600 mt-1 font-medium flex items-center gap-1">
                          <span>⚠️</span> {fieldErrors.linkedin}
                        </p>
                      )}
                    </div>
                  ) : (
                    /*Add the "break-words" style to the linkedIn profile - 04-08-2026 */
                    <div className="border border-gray-200 bg-gray-50 px-3 py-2 rounded-lg break-words">
                      {user.linkedin ? (
                        isValidLinkedInUrl(user.linkedin) || isValidUrl(user.linkedin) ? (
                          <a
                            href={normalizeUrl(user.linkedin)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            {user.linkedin}
                          </a>
                        ) : (
                          <span className="text-red-500 text-xs flex items-center gap-1.5">
                            <span className="font-semibold">⚠️ Invalid link:</span>
                            <span>{user.linkedin}</span>
                            <span className="text-gray-400 text-[11px]">(Click "Edit" to fix)</span>
                          </span>
                        )
                      ) : (
                        "Not provided"
                      )}
                    </div>
                  )}
                </div>

                {/* Portfolio */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    Portfolio
                  </label>
                  {isEditing ? (
                    <div>
                      <input
                        type="url"
                        name="portfolio"
                        value={tempUser.portfolio || ""}
                        onChange={handleTempChange}
                        className={`w-full border px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                          fieldErrors.portfolio
                            ? "border-red-500 bg-red-50/40 text-red-900"
                            : "border-gray-300"
                        }`}
                        placeholder="https://yourportfolio.com"
                      />
                      {fieldErrors.portfolio && (
                        <p className="text-xs text-red-600 mt-1 font-medium flex items-center gap-1">
                          <span>⚠️</span> {fieldErrors.portfolio}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="border border-gray-200 bg-gray-50 px-3 py-2 rounded-lg break-words">
                      {user.portfolio ? (
                        isValidUrl(user.portfolio) ? (
                          <a
                            href={normalizeUrl(user.portfolio)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            {user.portfolio}
                          </a>
                        ) : (
                          <span className="text-red-500 text-xs flex items-center gap-1.5">
                            <span className="font-semibold">⚠️ Invalid link:</span>
                            <span>{user.portfolio}</span>
                            <span className="text-gray-400 text-[11px]">(Click "Edit" to fix)</span>
                          </span>
                        )
                      ) : (
                        "Not provided"
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Education Level */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  Current level of education
                </label>
                {isEditing ? (
                  <ProfileDropdown
                    name="educationLevel"
                    value={tempUser.educationLevel}
                    onChange={handleTempChange}
                    options={educationLevels}
                    placeholder="Select Education Level"
                  />
                ) : (
                  <div className="border border-gray-200 bg-gray-50 px-3 py-2 rounded-lg">
                    {getDisplayValue(user.educationLevel, educationLevels)}
                  </div>
                )}
              </div>

              {/* ✅ FIX: Use activeEducationLevel so grade/school fields react to edits instantly */}
              {activeEducationLevel === "highschool" && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    Current Grade
                  </label>
                  {isEditing ? (
                    <ProfileDropdown
                      name="currentGrade"
                      value={tempUser.currentGrade}
                      onChange={handleTempChange}
                      options={gradeOptions}
                      placeholder="Select Grade"
                    />
                  ) : (
                    <div className="border border-gray-200 bg-gray-50 px-3 py-2 rounded-lg">
                      {user.currentGrade || "Not provided"}
                    </div>
                  )}
                </div>
              )}

              {activeEducationLevel && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    {activeEducationLevel === "highschool"
                      ? "School Name"
                      : "College / University Name"}
                  </label>
                  {isEditing ? (
                    <div className="relative">
                      <input
                        type="text"
                        name="universityName"
                        value={tempUser.universityName}
                        onChange={handleInstitutionInputChange}
                        placeholder={
                          tempUser.educationLevel === "highschool"
                            ? "Enter your school name"
                            : "Search college or university"
                        }
                        autoComplete="off"
                        className="w-full border border-gray-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      {tempUser.educationLevel !== "highschool" &&
                        filteredInstitutionSuggestions.length > 0 && (
                          <ul className="absolute z-10 w-full bg-white border border-gray-300 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
                            {filteredInstitutionSuggestions.map((u, index) => (
                              <li
                                key={index}
                                onClick={() => {
                                  setTempUser((prev) => ({
                                    ...prev,
                                    universityName: u.name,
                                  }));
                                  setFilteredInstitutionSuggestions([]);
                                }}
                                className="cursor-pointer px-4 py-2 hover:bg-blue-50"
                              >
                                {u.name}
                                {u.state && (
                                  <span className="text-xs text-gray-500 ml-2">
                                    {u.state}
                                  </span>
                                )}
                              </li>
                            ))}
                          </ul>
                        )}
                    </div>
                  ) : (
                    <div className="border border-gray-200 bg-gray-50 px-3 py-2 rounded-lg">
                      {user.universityName || "Not provided"}
                    </div>
                  )}
                </div>
              )}

              {/* Date of Birth */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  Date of Birth
                </label>
                {isEditing ? (
                  <DatePicker
                    selected={tempUser.dob}
                    onChange={handleDateChange}
                    dateFormat="dd/MM/yyyy"
                    maxDate={new Date()}
                    showYearDropdown
                    showMonthDropdown
                    dropdownMode="select"
                    placeholderText="DD/MM/YYYY"
                    className="w-full border border-gray-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                ) : (
                  <div className="border border-gray-200 bg-gray-50 px-3 py-2 rounded-lg">
                    {formatDate(user.dob) || "Not provided"}
                  </div>
                )}
              </div>

              {/* Field of Study */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  Field of Study
                </label>
                {isEditing ? (
                  <ProfileDropdown
                    name="fieldOfStudy"
                    value={tempUser.fieldOfStudy}
                    onChange={handleTempChange}
                    options={fieldOptions}
                    placeholder="Select Your Field"
                  />
                ) : (
                  <div className="border border-gray-200 bg-gray-50 px-3 py-2 rounded-lg">
                    {getDisplayValue(user.fieldOfStudy, fieldOptions)}
                  </div>
                )}
              </div>

              {/* Desired Field */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  Desired field of Internship/Job
                </label>
                {isEditing ? (
                  <ProfileDropdown
                    name="desiredField"
                    value={tempUser.desiredField}
                    onChange={handleTempChange}
                    options={fieldOptions}
                    placeholder="Select Your Field"
                  />
                ) : (
                  <div className="border border-gray-200 bg-gray-50 px-3 py-2 rounded-lg">
                    {getDisplayValue(user.desiredField, fieldOptions)}
                  </div>
                )}
              </div>

              {/* Skills, Interests, Preferred Locations */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    Skills
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      name="skills"
                      value={tempUser.skills}
                      onChange={handleTempChange}
                      placeholder="e.g. React, Python, SQL"
                      className="w-full border border-gray-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  ) : (
                    <div className="border border-gray-200 bg-gray-50 px-3 py-2 rounded-lg min-h-[42px]">
                      {user.skills || "Not provided"}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    Interests
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      name="interests"
                      value={tempUser.interests}
                      onChange={handleTempChange}
                      placeholder="e.g. AI, Robotics, Data Science"
                      className="w-full border border-gray-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  ) : (
                    <div className="border border-gray-200 bg-gray-50 px-3 py-2 rounded-lg min-h-[42px]">
                      {user.interests || "Not provided"}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    Preferred Locations
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      name="preferredLocations"
                      value={tempUser.preferredLocations}
                      onChange={handleTempChange}
                      placeholder="e.g. Hyderabad, Remote, Bangalore"
                      className="w-full border border-gray-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  ) : (
                    <div className="border border-gray-200 bg-gray-50 px-3 py-2 rounded-lg min-h-[42px]">
                      {user.preferredLocations || "Not provided"}
                    </div>
                  )}
                </div>
              </div>

              {/* Profile Image */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  Profile Image
                </label>
                <div className="flex flex-col sm:flex-row sm:items-center items-start gap-4 sm:gap-6">
                  {(user.profileImage || tempUser.profileImage) && (
                    <img
                      src={
                        typeof (isEditing
                          ? tempUser.profileImage
                          : user.profileImage) === "object"
                          ? URL.createObjectURL(
                              isEditing
                                ? tempUser.profileImage
                                : user.profileImage,
                            )
                          : isEditing
                            ? tempUser.profileImage
                            : user.profileImage
                      }
                      alt="Profile"
                      className="w-24 h-24 min-w-[96px] min-h-[96px] max-w-[96px] max-h-[96px] shrink-0 flex-shrink-0 aspect-square rounded-full object-cover border-2 border-gray-300 shadow-sm block"
                    />
                  )}
                  {isEditing && (
                    <div className="flex-1 min-w-0">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Upload a new profile image (JPEG, PNG, JPG)
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Profile Level 2 */}
        <div className="mb-6 border border-gray-200 rounded-lg overflow-hidden">
          <div
            className="flex justify-between items-center p-4 bg-blue-50 cursor-pointer hover:bg-blue-100"
            onClick={() => setIsLevel2Open(!isLevel2Open)}
          >
            <h3 className="text-xl font-semibold text-gray-800">
              Location & Additional Information
            </h3>
            <span className="text-gray-600">{isLevel2Open ? "▲" : "▼"}</span>
          </div>

          {isLevel2Open && (
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    Financial Status
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      name="financialStatus"
                      value={tempUser.financialStatus}
                      onChange={handleTempChange}
                      placeholder="e.g. Need financial aid"
                      className="w-full border border-gray-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  ) : (
                    <div className="border border-gray-200 bg-gray-50 px-3 py-2 rounded-lg">
                      {user.financialStatus || "Not provided"}
                    </div>
                  )}
                </div>

                {/* ✅ FIX: Use activeEducationLevel here too for consistency */}
                {activeEducationLevel !== "highschool" && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                      Grade Percentage
                    </label>
                    {isEditing ? (
                      <input
                        type="text"
                        name="gradePercentage"
                        value={tempUser.gradePercentage}
                        onChange={handleTempChange}
                        placeholder="e.g. 85% or 3.5 GPA"
                        className="w-full border border-gray-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    ) : (
                      <div className="border border-gray-200 bg-gray-50 px-3 py-2 rounded-lg">
                        {user.gradePercentage || "Not provided"}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <h4 className="text-lg font-semibold text-gray-700">
                  Location Information
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                      Country
                    </label>
                    {isEditing ? (
                      <ProfileDropdown
                        name="country"
                        value={tempUser.country || ""}
                        onChange={(e) => handleCountryChange(e.target.value)}
                        options={COUNTRY_OPTIONS}
                        placeholder="Select Country"
                      />
                    ) : (
                      <div className="border border-gray-200 bg-gray-50 px-3 py-2 rounded-lg">
                        {user.country || "Not provided"}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                      {stateLabel}
                    </label>
                    {isEditing ? (
                      <ProfileDropdown
                        name="state"
                        value={tempUser.state || ""}
                        onChange={handleTempChange}
                        options={stateList}
                        placeholder="Select"
                        disabled={!tempUser.country}
                      />
                    ) : (
                      <div className="border border-gray-200 bg-gray-50 px-3 py-2 rounded-lg">
                        {user.state || "Not provided"}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                      City
                    </label>
                    {isEditing ? (
                      <div className="relative">
                        <input
                          type="text"
                          name="city"
                          value={tempUser.city || ""}
                          onChange={handleCityInputChange}
                          className={`w-full border px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 ${
                            fieldErrors.city
                              ? "border-red-500 bg-red-50/40 text-red-900"
                              : "border-gray-300"
                          }`}
                          disabled={!tempUser.country}
                          placeholder="Start typing city"
                          autoComplete="off"
                        />
                        {fieldErrors.city && (
                          <p className="text-xs text-red-600 mt-1 font-medium flex items-center gap-1">
                            <span>⚠️</span> {fieldErrors.city}
                          </p>
                        )}
                        {citySuggestions.length > 0 && (
                          <ul className="absolute z-10 w-full bg-white border border-gray-300 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
                            {citySuggestions.map((c) => (
                              <li
                                key={`${c.city}-${c.state}`}
                                onClick={() => handleCitySelect(c)}
                                className="cursor-pointer px-4 py-2 hover:bg-blue-50"
                              >
                                {c.city}, {c.state}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ) : (
                      <div className="border border-gray-200 bg-gray-50 px-3 py-2 rounded-lg break-words">
                        {user.city ? (
                          isValidCity(user.city) ? (
                            user.city
                          ) : (
                            <span className="text-red-500 text-xs flex items-center gap-1.5">
                              <span className="font-semibold">⚠️ Invalid city (contains numbers):</span>
                              <span>{user.city}</span>
                              <span className="text-gray-400 text-[11px]">(Click "Edit" to fix)</span>
                            </span>
                          )
                        ) : (
                          "Not provided"
                        )}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                      {zipLabel}
                    </label>
                    {isEditing ? (
                      <div>
                        <input
                          type="text"
                          name="postalCode"
                          value={tempUser.postalCode || ""}
                          onChange={handleTempChange}
                          className={`w-full border px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                            fieldErrors.postalCode
                              ? "border-red-500 bg-red-50/40 text-red-900"
                              : "border-gray-300"
                          }`}
                          placeholder={zipPlaceholder}
                          autoComplete="postal-code"
                        />
                        {fieldErrors.postalCode && (
                          <p className="text-xs text-red-600 mt-1 font-medium flex items-center gap-1">
                            <span>⚠️</span> {fieldErrors.postalCode}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="border border-gray-200 bg-gray-50 px-3 py-2 rounded-lg break-words">
                        {user.postalCode ? (
                          isValidPostalCode(user.postalCode, user.country) ? (
                            user.postalCode
                          ) : (
                            <span className="text-red-500 text-xs flex items-center gap-1.5">
                              <span className="font-semibold">⚠️ Invalid {zipLabel}:</span>
                              <span>{user.postalCode}</span>
                              <span className="text-gray-400 text-[11px]">(Click "Edit" to fix)</span>
                            </span>
                          )
                        ) : (
                          "Not provided"
                        )}
                      </div>
                    )}
                  </div>

                  <div className="md:col-span-2 space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                      Address
                    </label>
                    {isEditing ? (
                      <textarea
                        name="address"
                        value={tempUser.address}
                        onChange={handleTempChange}
                        rows={3}
                        className="w-full border border-gray-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Street address, Apt/Suite (City is above), State/Province"
                        autoComplete="street-address"
                      />
                    ) : (
                      <div className="border border-gray-200 bg-gray-50 px-3 py-2 rounded-lg min-h-[84px]">
                        {user.address || "Not provided"}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Profile Level 3 */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div
            className="flex justify-between items-center p-4 bg-blue-50 cursor-pointer hover:bg-blue-100"
            onClick={() => setIsLevel3Open(!isLevel3Open)}
          >
            <h3 className="text-xl font-semibold text-gray-800">
              Profile Level 3
            </h3>
            <span className="text-gray-600">{isLevel3Open ? "▲" : "▼"}</span>
          </div>

          {isLevel3Open && createLevelThree && (
            <div className="p-6">
              <LevelThree
                profileData={user}
                setCreateLevelThree={setCreateLevelThree}
                handleProfileData={handleUpdateProfile}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfileForm;
//changes
