// File: PartnerLogoManager.js

import React, { useState, useEffect } from "react";
import axios from "../../../../api/axiosInstance";
import { toast } from "react-toastify";
import skillnaavLogo from "../../../../assets/skillnaav_logo-250w.png";

const PartnerLogoManager = () => {
  const [currentLogoUrl, setCurrentLogoUrl] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [planType, setPlanType] = useState("Freemium");

  const token = localStorage.getItem("token");

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
      setPreviewUrl(null);
      setImageFile(null);

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
  const handleRemoveLogo = async () => {
    if (!window.confirm("Remove your company logo?")) return;

    try {
      await axios.put(
        "/api/partners/remove-logo",
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      setCurrentLogoUrl(null);
      toast.success("Logo removed successfully");
    } catch (err) {
      toast.error("Failed to remove logo");
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
        Your logo appears alongside the SkillNaav logo on every offer letter PDF.
      </p>

      {/* Preview Header */}
      <div className="flex items-center gap-4 p-4 bg-blue-50 border border-blue-100 rounded-xl mb-6">
        <img
  src={skillnaavLogo}
  alt="SkillNaav Logo"
  className="h-10 w-auto object-contain bg-white border rounded-lg p-1"
/>

        <span className="text-gray-400 font-bold text-lg">+</span>

        {currentLogoUrl ? (
          <img
            src={currentLogoUrl}
            alt="Partner Logo"
            className="h-10 max-w-[120px] object-contain bg-white border rounded-lg p-1"
          />
        ) : (
          <div className="w-16 h-10 bg-gray-200 border-2 border-dashed rounded-lg flex items-center justify-center text-[10px] text-gray-400">
            Your Logo
          </div>
        )}
      </div>

      {/* Upload Card */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        {planType === "Freemium" ? (
          <div className="text-amber-600 text-sm bg-amber-50 p-3 rounded-lg border border-amber-100">
            Upgrade to Premium to add your company logo.
          </div>
        ) : (
          <div className="space-y-4">
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="block w-full text-sm file:mr-4 file:py-2 file:px-4
              file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700
              hover:file:bg-blue-100 cursor-pointer"
            />

            {previewUrl && (
              <img
                src={previewUrl}
                alt="Preview"
                className="max-h-16 border rounded-lg bg-gray-50 p-2"
              />
            )}

            <div className="flex gap-3">
              <button
                onClick={handleUpload}
                disabled={!imageFile || uploading}
                className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300"
              >
                {uploading ? "Uploading..." : "Save Logo"}
              </button>

              {currentLogoUrl && (
                <button
                  onClick={handleRemoveLogo}
                  className="px-4 py-2 border border-red-200 text-red-600 rounded-lg hover:bg-red-50"
                >
                  Remove Logo
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PartnerLogoManager;