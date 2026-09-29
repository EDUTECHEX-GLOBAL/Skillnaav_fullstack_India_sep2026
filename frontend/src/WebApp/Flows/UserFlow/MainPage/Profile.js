import React, { useState, useEffect, useRef } from "react";
import axios from "../../../../api/axiosInstance";
import LevelThree from "./LevelThree";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { US_STATES, CA_PROVINCES } from "../../../../constants/locations";
import { PencilIcon, CheckIcon, XMarkIcon } from "@heroicons/react/24/solid";

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
  const [successMessage, setSuccessMessage] = useState("");
  const [isLevel1Open, setIsLevel1Open] = useState(true);
  const [isLevel2Open, setIsLevel2Open] = useState(false);
  const [isLevel3Open, setIsLevel3Open] = useState(false);
  const [createLevelThree, setCreateLevelThree] = useState(true);

  const [isEditing, setIsEditing] = useState(false);
  const [tempUser, setTempUser] = useState({});
  //Add this for loading effect for save changes button - 11-08-2026
  const [isSaving, setIsSaving] = useState(false);

  const stateList =
    tempUser.country === "Canada"
      ? CA_PROVINCES
      : tempUser.country === "United States"
        ? US_STATES
        : [];

  const stateLabel =
    tempUser.country === "Canada"
      ? "Province / Territory"
      : tempUser.country === "United States"
        ? "State"
        : "State / Province";

  const zipLabel =
    tempUser.country === "Canada"
      ? "Postal Code"
      : tempUser.country === "United States"
        ? "ZIP Code"
        : "ZIP / Postal Code";

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
    setTempUser({ ...user });
  };

  const handleCancelClick = () => {
    setIsEditing(false);
    setTempUser({ ...user });
    setCitySuggestions([]);
    setFilteredInstitutionSuggestions([]);
  };

  const handleTempChange = (e) => {
    const { name, value } = e.target;
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
    setCitySuggestions([]);
    setFilteredInstitutionSuggestions([]);
  };

  const handleUpdateProfile = async () => {
    //for save loading effect - 11-08-2026
    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage("");

    try {
      const token = localStorage.getItem("userToken");
      if (!token) {
        setErrorMessage("Please log in again.");
        return;
      }

      const formData = new FormData();

      Object.entries(tempUser).forEach(([key, value]) => {
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
    <div className="min-h-screen mt-12 flex justify-center bg-gray-50 font-poppins">
      <div className="w-full max-w-4xl bg-white p-6 rounded-lg shadow-lg">
        {/* Header with Edit Button */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-3xl font-bold text-gray-800">Your Profile</h2>
            <p className="text-gray-500">
              {isEditing
                ? "Edit your personal and academic details"
                : "View your personal and academic details"}
            </p>
          </div>

          {!isEditing ? (
            //Add the "h-12" for decrease the height of the button - 06-08-2026
            <button
              onClick={handleEditClick}
              className="h-12 flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition duration-200"
            >
              <PencilIcon className="h-4 w-4" />
              Edit Profile
            </button>
          ) : (
            <div className="flex gap-2">
              {/* Add the "h-12" for decrease the height of the button - 06-08-2026 */}
              <button
                onClick={handleCancelClick}
                className="h-12 flex items-center gap-2 bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition duration-200"
              >
                <XMarkIcon className="h-4 w-4" />
                Cancel
              </button>
              {/*Add the "h-12" for decrease the height of the button,change px-4 to px-1 add sm:px-4 - 06-08-2026 */}
              <button
                onClick={handleUpdateProfile}
                disabled={isSaving} //add for loading - 11-08-2026
                //className="h-12 flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-1 sm:px-4 py-2 rounded-lg transition duration-200"
                className={`h-12 flex items-center justify-center gap-2 text-white px-1 sm:px-4 py-2 rounded-lg transition duration-200 ${
                  isSaving
                    ? "bg-green-500 cursor-not-allowed"
                    : "bg-green-600 hover:bg-green-700"
                }`}
              >
                {/*add this condition for effect - 11-08-2026 */}
                {isSaving ? (
                  <>
                    <svg
                      className="animate-spin h-4 w-4"
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
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckIcon className="h-4 w-4" />
                    Save Changes
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
                    <input
                      type="url"
                      name="linkedin"
                      value={tempUser.linkedin}
                      onChange={handleTempChange}
                      className="w-full border border-gray-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="https://linkedin.com/in/username"
                    />
                  ) : (
                    /*Add the "break-words" style to the linkedIn profile - 04-08-2026 */
                    <div className="border border-gray-200 bg-gray-50 px-3 py-2 rounded-lg break-words">
                      {user.linkedin ? (
                        <a
                          href={user.linkedin}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          {user.linkedin}
                        </a>
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
                    <input
                      type="url"
                      name="portfolio"
                      value={tempUser.portfolio}
                      onChange={handleTempChange}
                      className="w-full border border-gray-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="https://yourportfolio.com"
                    />
                  ) : (
                    <div className="border border-gray-200 bg-gray-50 px-3 py-2 rounded-lg">
                      {user.portfolio ? (
                        <a
                          href={user.portfolio}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          {user.portfolio}
                        </a>
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
                  <select
                    name="educationLevel"
                    value={tempUser.educationLevel}
                    onChange={handleTempChange}
                    className="w-full border border-gray-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {educationLevels.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
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
                    <select
                      name="currentGrade"
                      value={tempUser.currentGrade}
                      onChange={handleTempChange}
                      className="w-full border border-gray-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      {gradeOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
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
                  <select
                    name="fieldOfStudy"
                    value={tempUser.fieldOfStudy}
                    onChange={handleTempChange}
                    className="w-full border border-gray-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {fieldOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
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
                  <select
                    name="desiredField"
                    value={tempUser.desiredField}
                    onChange={handleTempChange}
                    className="w-full border border-gray-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {fieldOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
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
                <div className="flex items-center gap-6">
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
                      className="w-24 h-24 rounded-full object-cover border-2 border-gray-300"
                    />
                  )}
                  {isEditing && (
                    <div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
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
                      <select
                        name="country"
                        value={tempUser.country}
                        onChange={(e) => handleCountryChange(e.target.value)}
                        className="w-full border border-gray-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">Select</option>
                        <option value="United States">United States</option>
                        <option value="Canada">Canada</option>
                      </select>
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
                      <select
                        name="state"
                        value={tempUser.state}
                        onChange={handleTempChange}
                        className="w-full border border-gray-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                        disabled={!tempUser.country}
                      >
                        <option value="">Select</option>
                        {stateList.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
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
                          value={tempUser.city}
                          onChange={handleCityInputChange}
                          className="w-full border border-gray-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                          disabled={!tempUser.country}
                          placeholder="Start typing city"
                          autoComplete="off"
                        />
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
                      <div className="border border-gray-200 bg-gray-50 px-3 py-2 rounded-lg">
                        {user.city || "Not provided"}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                      {zipLabel}
                    </label>
                    {isEditing ? (
                      <input
                        type="text"
                        name="postalCode"
                        value={tempUser.postalCode}
                        onChange={handleTempChange}
                        className="w-full border border-gray-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder={
                          tempUser.country === "Canada"
                            ? "e.g., K1A 0B1"
                            : "e.g., 94105"
                        }
                        autoComplete="postal-code"
                      />
                    ) : (
                      <div className="border border-gray-200 bg-gray-50 px-3 py-2 rounded-lg">
                        {user.postalCode || "Not provided"}
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
