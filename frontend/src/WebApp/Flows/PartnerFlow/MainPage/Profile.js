import React, { useState, useEffect } from "react";
import axios from "../../../../api/axiosInstance";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUser } from "@fortawesome/free-solid-svg-icons";
import { PencilIcon, CheckIcon, XMarkIcon } from "@heroicons/react/24/solid";

const ProfileForm = () => {
  const [user, setUser] = useState({
    name: "",
    email: "",
    universityName: "",
    institutionId: "",
    adminApproved: false,
    active: false,
    profileImage: "",
  });

  const [tempUser, setTempUser] = useState({
    name: "",
    email: "",
    universityName: "",
    institutionId: "",
    password: "",
    confirmPassword: "",
    profileImageFile: null,
    profileImagePreview: "",
  });

  const [isEditing, setIsEditing] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [isSectionOpen, setIsSectionOpen] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const userInfo =
          JSON.parse(localStorage.getItem("partnerInfo")) ||
          JSON.parse(localStorage.getItem("userInfo"));
        const token = localStorage.getItem("token") || userInfo?.token;

        if (!token) return;

        // Fetch fresh data from backend
        const { data } = await axios.get("/api/partners/profile", {
          headers: { Authorization: `Bearer ${token}` },
        });

        console.log("[PartnerProfile] API response:", data);

        const loadedUser = {
          name: data.name || "",
          email: data.email || "",
          universityName: data.universityName || "",
          institutionId: data.institutionId || "",
          adminApproved: data.adminApproved || false,
          active: data.active || false,
          profileImage: data.profileImage || "",
        };

        setUser(loadedUser);
        setTempUser({
          ...loadedUser,
          password: "",
          confirmPassword: "",
          profileImageFile: null,
          profileImagePreview: loadedUser.profileImage,
        });

        // Sync with localStorage
        const updatedUserInfo = { ...userInfo, ...data, token };
        localStorage.setItem("partnerInfo", JSON.stringify(updatedUserInfo));
      } catch (err) {
        console.error("Failed to load partner profile:", err);
      }
    };

    fetchProfile();
  }, []);

  const handleEditClick = () => {
    setIsEditing(true);
    setErrorMessage(null);
    setSuccessMessage("");
    setTempUser({
      ...user,
      password: "",
      confirmPassword: "",
      profileImageFile: null,
      profileImagePreview: user.profileImage,
    });
  };

  const handleCancelClick = () => {
    setIsEditing(false);
    setErrorMessage(null);
    setSuccessMessage("");
    setTempUser({
      ...user,
      password: "",
      confirmPassword: "",
      profileImageFile: null,
      profileImagePreview: user.profileImage,
    });
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setTempUser((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setTempUser((prev) => ({
        ...prev,
        profileImageFile: file,
        profileImagePreview: URL.createObjectURL(file),
      }));
    }
  };

  const handleUpdateProfile = async () => {
    setErrorMessage("");
    setSuccessMessage("");

    if (tempUser.password && tempUser.password.length < 6) {
      setErrorMessage("Password must be at least 6 characters long.");
      return;
    }
    if (tempUser.password !== tempUser.confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    try {
      const userInfo =
        JSON.parse(localStorage.getItem("partnerInfo")) ||
        JSON.parse(localStorage.getItem("userInfo"));
      const token = localStorage.getItem("token") || userInfo?.token;

      if (!token) {
        setErrorMessage("No token found. Please log in again.");
        return;
      }

      let formData = new FormData();
      formData.append("name", tempUser.name);
      formData.append("email", tempUser.email);
      formData.append("universityName", tempUser.universityName);
      formData.append("institutionId", tempUser.institutionId);

      if (tempUser.password) {
        formData.append("password", tempUser.password);
        formData.append("confirmPassword", tempUser.confirmPassword);
      }

      if (tempUser.profileImageFile) {
        formData.append("profileImage", tempUser.profileImageFile);
      }

      const config = {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      };

      const { data } = await axios.put(
        "/api/partners/profile",
        formData,
        config,
      );

      const updatedUserInfo = { ...userInfo, ...data, token };
      localStorage.setItem("partnerInfo", JSON.stringify(updatedUserInfo));

      setUser((prev) => ({
        ...prev,
        ...data,
      }));

      setTempUser((prev) => ({
        ...prev,
        ...data,
        password: "",
        confirmPassword: "",
        profileImageFile: null,
        profileImagePreview: data.profileImage || prev.profileImagePreview,
      }));

      setSuccessMessage("Profile updated successfully!");
      setIsEditing(false);

      // Dispatch event to update Navbar/Sidebar if they listen for it
      window.dispatchEvent(new Event("storage"));
      window.dispatchEvent(
        new CustomEvent("partnerUpdated", { detail: updatedUserInfo }),
      );
    } catch (error) {
      setErrorMessage(
        error.response?.data?.message || "Failed to update profile",
      );
    }
  };

  return (
    <div className="min-h-screen mt-12 flex justify-center bg-gray-50 font-poppins pb-12">
      <div className="w-full max-w-4xl bg-white p-6 rounded-lg shadow-lg">
        {/* Header with Edit/Save Buttons */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-3xl font-bold text-gray-800">
              Partner Profile
            </h2>
            <p className="text-gray-500">
              {isEditing
                ? "Edit your organizational details"
                : "View your organizational details"}
            </p>
          </div>

          {!isEditing ? (
            <button
              onClick={handleEditClick}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition duration-200"
            >
              <PencilIcon className="h-4 w-4" />
              Edit Profile
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={handleCancelClick}
                className="flex items-center gap-2 bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition duration-200"
              >
                <XMarkIcon className="h-4 w-4" />
                Cancel
              </button>
              <button
                onClick={handleUpdateProfile}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition duration-200"
              >
                <CheckIcon className="h-4 w-4" />
                Save Changes
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

        {/* Section 1 */}
        <div className="mb-6 border border-gray-200 rounded-lg overflow-hidden">
          <div
            className="flex justify-between items-center p-4 bg-blue-50 cursor-pointer hover:bg-blue-100 transition-colors"
            onClick={() => setIsSectionOpen(!isSectionOpen)}
          >
            <h3 className="text-xl font-semibold text-gray-800">
              Organization Information
            </h3>
            <span className="text-gray-600">{isSectionOpen ? "▲" : "▼"}</span>
          </div>

          {isSectionOpen && (
            <div className="p-6 space-y-6">
              {/* Profile Image Section */}
              <div className="space-y-2 pb-6 border-b border-gray-100">
                <label className="text-sm font-medium text-gray-700">
                  Logo / Profile Image
                </label>
                <div className="flex items-center gap-6">
                  <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center overflow-hidden border-2 border-gray-300">
                    {(
                      isEditing
                        ? tempUser.profileImagePreview
                        : user.profileImage
                    ) ? (
                      <img
                        className="w-full h-full object-cover"
                        src={
                          isEditing
                            ? tempUser.profileImagePreview
                            : user.profileImage
                        }
                        alt="Profile"
                      />
                    ) : (
                      <FontAwesomeIcon
                        icon={faUser}
                        className="text-4xl text-gray-400"
                      />
                    )}
                  </div>

                  {isEditing && (
                    <div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 transition-colors cursor-pointer"
                      />
                      <p className="text-xs text-gray-500 mt-2">
                        Upload a new image (JPEG, PNG, JPG)
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Full Name */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    Full Name / Representative Name
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      name="name"
                      value={tempUser.name}
                      onChange={handleChange}
                      className="w-full border border-gray-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                    />
                  ) : (
                    <div className="border border-gray-200 bg-gray-50 px-3 py-2 rounded-lg min-h-[42px] flex items-center">
                      {user.name || "Not provided"}
                    </div>
                  )}
                </div>

                {/* Email Address */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    Email Address (Read-only)
                  </label>
                  {/*Add the "break-all" style for email address for alignment - 04-08-2026 */}
                  <div className="break-all border border-gray-200 bg-gray-100 text-gray-500 px-3 py-2 rounded-lg min-h-[42px] flex items-center cursor-not-allowed">
                    {user.email}
                  </div>
                </div>

                {/* University / Company Name */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    Organization / University Name
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      name="universityName"
                      value={tempUser.universityName}
                      onChange={handleChange}
                      className="w-full border border-gray-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                    />
                  ) : (
                    <div className="border border-gray-200 bg-gray-50 px-3 py-2 rounded-lg min-h-[42px] flex items-center">
                      {user.universityName || "Not provided"}
                    </div>
                  )}
                </div>

                {/* Institution ID */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    Institution ID
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      name="institutionId"
                      value={tempUser.institutionId}
                      onChange={handleChange}
                      className="w-full border border-gray-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                    />
                  ) : (
                    <div className="border border-gray-200 bg-gray-50 px-3 py-2 rounded-lg min-h-[42px] flex items-center">
                      {user.institutionId || "Not provided"}
                    </div>
                  )}
                </div>

                {/* Password Fields (Only in Edit Mode) */}
                {isEditing && (
                  <>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">
                        New Password
                      </label>
                      <input
                        type="password"
                        name="password"
                        placeholder="Leave blank to keep current"
                        value={tempUser.password}
                        onChange={handleChange}
                        className="w-full border border-gray-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">
                        Confirm New Password
                      </label>
                      <input
                        type="password"
                        name="confirmPassword"
                        placeholder="Confirm your new password"
                        value={tempUser.confirmPassword}
                        onChange={handleChange}
                        className="w-full border border-gray-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfileForm;
