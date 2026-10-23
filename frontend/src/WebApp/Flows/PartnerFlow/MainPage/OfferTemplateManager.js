// File: PartnerLogoManager.js

import React, { useState, useEffect, useRef } from "react";
import axios from "../../../../api/axiosInstance";
import { toast } from "react-toastify";
import edutechexLogo from "../../../../assets/Edutech-logo.png";

const PartnerLogoManager = () => {
  const [currentLogoUrl, setCurrentLogoUrl] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const getInitialPlanType = () => {
    try {
      const partnerInfo = JSON.parse(localStorage.getItem("partnerInfo") || "null");
      if (partnerInfo?.planType) return partnerInfo.planType;
      const userInfo = JSON.parse(localStorage.getItem("userInfo") || "null");
      if (userInfo?.planType) return userInfo.planType;
    } catch (e) {}
    return null;
  };

  const [planType, setPlanType] = useState(getInitialPlanType);
  const [loadingProfile, setLoadingProfile] = useState(() => getInitialPlanType() === null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [fileInputKey, setFileInputKey] = useState(0);

  const fileInputRef = useRef(null);
  const token = localStorage.getItem("token");

  // Helper to completely clear selected file from state and native file input DOM
  const resetFileInput = () => {
    setImageFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setFileInputKey((prev) => prev + 1);
  };

  // =============================
  // Load Partner Profile
  // =============================
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await axios.get("/api/partners/profile", {
          headers: { Authorization: `Bearer ${token}` },
        });

        setCurrentLogoUrl(res.data?.logoUrl || null);
        setPlanType(res.data?.planType || "Freemium");
      } catch (err) {
        console.error("Profile fetch failed:", err);
      } finally {
        setLoadingProfile(false);
      }
    };

    fetchProfile();
  }, [token]);

  // =============================
  // File Select
  // =============================
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setImageFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  // =============================
  // Upload Logo
  // =============================
  const handleUpload = async () => {
    if (!imageFile) {
      toast.warning("Please select a logo image.");
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("image", imageFile);

      const res = await axios.post(
        "/api/partners/upload-logo",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setCurrentLogoUrl(res.data.logoUrl);
      resetFileInput();

      toast.success("Logo uploaded successfully!");
    } catch (err) {
      toast.error(
        err.response?.data?.message || "Upload failed"
      );
    } finally {
      setUploading(false);
    }
  };

  // =============================
  // Remove Logo
  // =============================
  const handleConfirmRemove = async () => {
    setRemoving(true);
    try {
      await axios.put(
        "/api/partners/remove-logo",
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      setCurrentLogoUrl(null);
      resetFileInput();
      setShowConfirmModal(false);
      toast.success("Logo removed successfully");
    } catch (err) {
      toast.error("Failed to remove logo");
    } finally {
      setRemoving(false);
    }
  };

  // =============================
  // UI
  // =============================
  return (
    <div className="p-4 max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-2 text-gray-800">
        Company Logo
      </h2>

      <p className="text-sm text-gray-500 mb-6">
        Your logo appears alongside the Edutechex logo on every offer letter PDF.
      </p>

      {/* Preview Header */}
      <div className="flex items-center gap-4 p-4 bg-blue-50 border border-blue-100 rounded-xl mb-6">
        <img
  src={edutechexLogo}
  alt="Edutechex Logo"
  className="h-10 w-auto object-contain bg-white border rounded-lg p-1"
/>

        <span className="text-gray-400 font-bold text-lg">+</span>

        {currentLogoUrl ? (
          <img
            src={currentLogoUrl}
            alt="Partner Logo"
            className="h-10 max-w-[120px] object-contain bg-white border rounded-lg p-1"
          />
        ) : loadingProfile ? (
          <div className="w-16 h-10 bg-blue-100/60 animate-pulse rounded-lg flex items-center justify-center text-[10px] text-blue-400">
            ...
          </div>
        ) : (
          <div className="w-16 h-10 bg-gray-200 border-2 border-dashed rounded-lg flex items-center justify-center text-[10px] text-gray-400">
            Your Logo
          </div>
        )}
      </div>

      {/* Upload Card */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        {loadingProfile && !planType ? (
          <div className="flex items-center justify-center py-8 text-gray-400 gap-3">
            <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-sm font-medium">Loading...</span>
          </div>
        ) : planType === "Freemium" ? (
          <div className="text-amber-600 text-sm bg-amber-50 p-3 rounded-lg border border-amber-100">
            Upgrade to Premium to add your company logo.
          </div>
        ) : (
          <div className="space-y-4">
            <input
              key={fileInputKey}
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="block w-full text-sm file:mr-4 file:py-2 file:px-4
              file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700
              hover:file:bg-blue-100 cursor-pointer"
            />

            {previewUrl && (
              <div className="flex items-center gap-3">
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="max-h-16 border rounded-lg bg-gray-50 p-2 object-contain"
                />
                <button
                  type="button"
                  onClick={resetFileInput}
                  className="text-xs text-gray-500 hover:text-red-600 underline"
                >
                  Clear Selection
                </button>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleUpload}
                disabled={!imageFile || uploading}
                className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 transition"
              >
                {uploading ? "Uploading..." : "Save Logo"}
              </button>

              {currentLogoUrl && (
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(true)}
                  className="px-4 py-2 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 cursor-pointer transition"
                >
                  Remove Logo
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Centered Confirmation Popup Modal */}
      {showConfirmModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn"
          onClick={() => !removing && setShowConfirmModal(false)}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm text-center transform transition-all animate-scaleIn"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-6 h-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-gray-800 mb-2">
              Remove Company Logo?
            </h3>
            <p className="text-sm text-gray-500 mb-6">
              Are you sure you want to remove your company logo? It will no longer appear on your offer letters.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                disabled={removing}
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-medium hover:bg-gray-100 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRemove}
                disabled={removing}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 text-white font-medium hover:bg-red-700 transition shadow-sm cursor-pointer disabled:opacity-50"
              >
                {removing ? "Removing..." : "Remove"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PartnerLogoManager;
