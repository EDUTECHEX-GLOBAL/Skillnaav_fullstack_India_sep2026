//File: CustomInternshipCertificateManager.js

import React, { useEffect, useMemo, useState } from "react";
import axios from "../../../../api/axiosInstance";
import { motion, AnimatePresence } from "framer-motion";
import {
  Award,
  Upload,
  Image as ImageIcon,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Lightbulb,
  FileBadge,
  Eye,
  X,
  Calendar,
  FileImage,
  Plus,
  Sparkles,
  Search,
  ChevronLeft,
  ChevronRight,
  Palette,
  Clock,
  Download,
} from "lucide-react";
import CertificateTemplate from "../../UserFlow/MainPage/CertificateTemplate";
import skillnaavLogo from "../../../../assets/skillnav_logo_white.png";

/* ─── animation helpers ─── */
const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.07, duration: 0.45, ease: [0.22, 1, 0.36, 1] },
  }),
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.92 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] },
  },
  exit: {
    opacity: 0,
    scale: 0.92,
    transition: { duration: 0.2 },
  },
};

const DESIGNS_PER_PAGE = 12;

const CustomInternshipCertificateManager = () => {
  const partnerId = localStorage.getItem("partnerId");
  const legacyStorageKey = partnerId
    ? `partner_custom_certificate_images_${partnerId}`
    : null;

  const [certificateItems, setCertificateItems] = useState([]);
  const [certificateName, setCertificateName] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedImagePreview, setSelectedImagePreview] = useState("");
  const [selectedFileName, setSelectedFileName] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState("upload"); // "upload" | "gallery"
  const [lightboxData, setLightboxData] = useState(null);
  const [lightboxLoaded, setLightboxLoaded] = useState(false);

  useEffect(() => {
    if (!lightboxData) setLightboxLoaded(false);
  }, [lightboxData]);

  const [pendingDeleteItem, setPendingDeleteItem] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [galleryPage, setGalleryPage] = useState(1);
  const [textColor, setTextColor] = useState("#1f2937");

  const colorOptions = [
    { label: "Dark Gray", value: "#1f2937" },
    { label: "Navy Blue", value: "#1e3a8a" },
    { label: "Forest Green", value: "#166534" },
    { label: "Maroon", value: "#7f1d1d" },
    { label: "Deep Purple", value: "#4c1d95" },
    { label: "Gold", value: "#b45309" },
  ];

  useEffect(() => {
    if (legacyStorageKey) localStorage.removeItem(legacyStorageKey);
  }, [legacyStorageKey]);

  useEffect(() => {
    return () => {
      if (selectedImagePreview && selectedImagePreview.startsWith("blob:"))
        URL.revokeObjectURL(selectedImagePreview);
    };
  }, [selectedImagePreview]);

  const fetchCertificates = async () => {
    if (!partnerId) {
      setCertificateItems([]);
      setMessage("Partner ID not found. Please login again.");
      return;
    }
    try {
      setIsLoading(true);
      const response = await axios.get(
        `/api/custom-internship-certificates/${partnerId}`,
      );
      setCertificateItems(response.data?.items || []);
    } catch (error) {
      console.error("Error fetching certificate templates:", error);
      setCertificateItems([]);
      setMessage(
        error?.response?.data?.message ||
          "Failed to load certificate templates.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  // eslint-disable-next-line
  useEffect(() => {
    fetchCertificates();
  }, [partnerId]);

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setMessage("Please select a valid image file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setMessage("Please upload an image smaller than 5 MB.");
      return;
    }
    if (selectedImagePreview && selectedImagePreview.startsWith("blob:"))
      URL.revokeObjectURL(selectedImagePreview);

    setSelectedFile(file);
    setSelectedImagePreview(URL.createObjectURL(file));
    setSelectedFileName(file.name);
    setMessage("");
  };

  const resetForm = () => {
    if (selectedImagePreview && selectedImagePreview.startsWith("blob:"))
      URL.revokeObjectURL(selectedImagePreview);
    setCertificateName("");
    setSelectedFile(null);
    setSelectedImagePreview("");
    setSelectedFileName("");
    setTextColor("#1f2937");
    const input = document.getElementById("customCertificateImageInput");
    if (input) input.value = "";
  };

  const handleAddCertificate = async () => {
    if (!partnerId) {
      setMessage("Partner ID not found. Please login again.");
      return;
    }
    if (!certificateName.trim()) {
      setMessage("Please enter a certificate name.");
      return;
    }
    if (!selectedFile) {
      setMessage("Please upload a certificate image.");
      return;
    }

    // Capture values before form reset
    const capturedFile = selectedFile;
    const capturedName = certificateName.trim();

    // Create a stable blob URL for the optimistic gallery card
    const optimisticBlobUrl = URL.createObjectURL(capturedFile);
    const tempId = `temp-${Date.now()}`;
    const tempItem = {
      _id: tempId,
      name: capturedName,
      fileName: capturedFile.name,
      imageUrl: optimisticBlobUrl,
      textColor: textColor,
      createdAt: new Date().toISOString(),
    };

    // Optimistic update — show in gallery immediately, reset form
    setCertificateItems((prev) => [tempItem, ...prev]);
    resetForm();

    try {
      setIsSaving(true);
      const formData = new FormData();
      formData.append("partnerId", partnerId);
      formData.append("name", capturedName);
      formData.append("image", capturedFile);
      formData.append("textColor", textColor);

      const response = await axios.post(
        "/api/custom-internship-certificates",
        formData,
      );

      const savedItem = response.data?.item;
      if (savedItem) {
        // Swap temp item with the real one from the server
        setCertificateItems((prev) =>
          prev.map((item) => (item._id === tempId ? savedItem : item)),
        );
      } else {
        await fetchCertificates();
        setCertificateItems((prev) =>
          prev.filter((item) => item._id !== tempId),
        );
      }
      URL.revokeObjectURL(optimisticBlobUrl);
      setMessage("Certificate image added successfully.");
    } catch (error) {
      // Roll back the optimistic item and surface the error
      setCertificateItems((prev) => prev.filter((item) => item._id !== tempId));
      URL.revokeObjectURL(optimisticBlobUrl);
      console.error("Error saving certificate template:", error);
      setMessage(
        error?.response?.data?.message ||
          "Failed to save certificate template.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const openDeleteConfirmation = (item) => {
    setPendingDeleteItem(item);
  };

  const closeDeleteConfirmation = () => {
    if (isDeleting) return;
    setPendingDeleteItem(null);
  };

  const handleDelete = async () => {
    if (!pendingDeleteItem?._id) return;
    if (!partnerId) {
      setMessage("Partner ID not found. Please login again.");
      setPendingDeleteItem(null);
      return;
    }

    const deleteId = pendingDeleteItem._id;
    const previous = [...certificateItems];

    setIsDeleting(true);
    // Optimistic update — remove from UI immediately after confirmation
    setCertificateItems((prev) => prev.filter((item) => item._id !== deleteId));
    try {
      await axios.delete(
        `/api/custom-internship-certificates/${deleteId}?partnerId=${partnerId}`,
      );
      setMessage("Certificate image removed successfully.");
      setPendingDeleteItem(null);
    } catch (error) {
      // Restore the list if the API call failed
      setCertificateItems(previous);
      console.error("Error deleting certificate template:", error);
      setMessage(
        error?.response?.data?.message ||
          "Failed to delete certificate template.",
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return certificateItems;
    return certificateItems.filter((item) =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [certificateItems, searchQuery]);

  const totalGalleryPages = useMemo(
    () => Math.max(1, Math.ceil(filteredItems.length / DESIGNS_PER_PAGE)),
    [filteredItems.length],
  );

  const paginatedItems = useMemo(() => {
    const startIndex = (galleryPage - 1) * DESIGNS_PER_PAGE;
    return filteredItems.slice(startIndex, startIndex + DESIGNS_PER_PAGE);
  }, [filteredItems, galleryPage]);

  const galleryPageNumbers = useMemo(() => {
    if (totalGalleryPages <= 5) {
      return Array.from({ length: totalGalleryPages }, (_, index) => index + 1);
    }

    if (galleryPage <= 3) {
      return [1, 2, 3, 4, "...", totalGalleryPages];
    }

    if (galleryPage >= totalGalleryPages - 2) {
      return [
        1,
        "...",
        totalGalleryPages - 3,
        totalGalleryPages - 2,
        totalGalleryPages - 1,
        totalGalleryPages,
      ];
    }

    return [
      1,
      "...",
      galleryPage - 1,
      galleryPage,
      galleryPage + 1,
      "...",
      totalGalleryPages,
    ];
  }, [galleryPage, totalGalleryPages]);

  const messageTone = useMemo(() => {
    const text = message.toLowerCase();
    return text.includes("successfully") ||
      text.includes("added") ||
      text.includes("removed")
      ? "success"
      : "error";
  }, [message]);

  useEffect(() => {
    if (!message || messageTone !== "success") return undefined;
    const timer = window.setTimeout(() => setMessage(""), 3000);
    return () => window.clearTimeout(timer);
  }, [message, messageTone]);

  useEffect(() => {
    setGalleryPage(1);
  }, [searchQuery]);

  useEffect(() => {
    setGalleryPage((prevPage) => Math.min(prevPage, totalGalleryPages));
  }, [totalGalleryPages]);

  const tips = [
    "Use high-quality PNG or JPG images for the best print results.",
    "Leave the centre area clear so certificate text stays readable.",
    "Landscape orientation is recommended for standard certificates.",
    "Light or pastel backgrounds contrast well with dark text.",
  ];

  /* ─── Tabs config ─── */
  const tabs = [
    { id: "upload", label: "Upload Design", icon: <Plus size={16} /> },
    {
      id: "gallery",
      label: `My Designs (${certificateItems.length})`,
      icon: <FileBadge size={16} />,
    },
  ];

  return (
    <div className="w-full min-h-screen bg-[#fafbfc] font-sans pb-20">
      {/* ── Image Lightbox ── */}
      <AnimatePresence>
        {lightboxData && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-6"
            onClick={() => setLightboxData(null)}
          >
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.85, opacity: 0 }}
              transition={{ type: "spring", duration: 0.5 }}
              className="relative mx-auto"
              style={{
                aspectRatio: "1120 / 792",
                maxWidth: "min(1120px, calc(90vh * 1120 / 792))",
                width: "100%",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setLightboxData(null)}
                className="absolute -top-4 -right-4 w-10 h-10 rounded-full bg-white shadow-xl flex items-center justify-center text-slate-700 hover:bg-slate-100 z-30 transition-colors"
              >
                <X size={20} strokeWidth={2.5} />
              </button>

              <div className="w-full h-full relative overflow-hidden rounded-2xl shadow-2xl bg-white flex items-center justify-center">
                {!lightboxLoaded && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-white z-20">
                    <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
                    <p className="text-sm font-semibold text-slate-600">
                      Loading design...
                    </p>
                  </div>
                )}

                <img
                  src={lightboxData.imageUrl}
                  className="hidden"
                  onLoad={() => setLightboxLoaded(true)}
                  alt="preload"
                />

                <svg
                  viewBox="0 0 1120 792"
                  className={`w-full h-auto transition-opacity duration-300 ${lightboxLoaded ? "opacity-100" : "opacity-0"}`}
                >
                  <foreignObject width="1120" height="792">
                    <CertificateTemplate
                      studentName="John Doe"
                      internshipTitle="Frontend Developer Intern"
                      companyName="Acme Corp"
                      backgroundImageUrl={lightboxData.imageUrl}
                      textColor={lightboxData.textColor}
                      width={1120}
                      height={792}
                    />
                  </foreignObject>
                </svg>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Delete Confirmation ── */}
      <AnimatePresence>
        {pendingDeleteItem && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-900/55 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={closeDeleteConfirmation}
          >
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.96 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-md rounded-3xl bg-white p-6 sm:p-7 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mb-5">
                <AlertCircle size={24} />
              </div>
              <h3 className="text-xl font-extrabold text-slate-900">
                Delete created design?
              </h3>
              <p className="mt-3 text-sm leading-6 text-slate-500">
                Are you sure you want to delete the created design
                {pendingDeleteItem.name ? ` "${pendingDeleteItem.name}"` : ""}?
              </p>
              <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
                <button
                  type="button"
                  onClick={closeDeleteConfirmation}
                  disabled={isDeleting}
                  className="h-11 px-5 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  No
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="h-11 px-5 rounded-xl bg-rose-600 text-sm font-bold text-white hover:bg-rose-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isDeleting ? "Deleting..." : "Yes"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Header ── */}
      <div className="border-b border-slate-200/80 bg-white">
        <div className="max-w-6xl mx-auto px-5 sm:px-8">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex items-center gap-4 py-7"
          >
            <div
              className="w-12 h-12 rounded-[14px] flex items-center justify-center text-white shadow-lg"
              style={{
                background: "linear-gradient(145deg, #6366f1, #8b5cf6)",
              }}
            >
              <Award size={24} strokeWidth={2.2} />
            </div>
            <div>
              <h1 className="text-[22px] sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                Certificate Templates
              </h1>
              <p className="text-[13px] text-slate-500 font-medium mt-0.5">
                Create and manage custom certificate designs for your internship
                program.
              </p>
            </div>
          </motion.div>

          {/* ── Tab Bar ── */}
          <div className="flex gap-1 -mb-px">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center gap-2 px-5 py-3 text-sm font-semibold transition-colors rounded-t-xl ${
                  activeTab === tab.id
                    ? "text-indigo-600 bg-[#fafbfc]"
                    : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                }`}
              >
                {tab.icon}
                {tab.label}
                {activeTab === tab.id && (
                  <motion.div
                    layoutId="activeTabIndicator"
                    className="absolute bottom-0 left-3 right-3 h-[2.5px] bg-indigo-500 rounded-full"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Content Area ── */}
      <div className="max-w-6xl mx-auto px-5 sm:px-8 pt-8">
        <AnimatePresence mode="wait">
          {/* ─────────── UPLOAD TAB ─────────── */}
          {activeTab === "upload" && (
            <motion.div
              key="upload"
              initial="hidden"
              animate="visible"
              exit="hidden"
              variants={scaleIn}
            >
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-7">
                {/* Upload form */}
                <div className="lg:col-span-3">
                  <div className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-8 shadow-sm">
                    <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                      <Upload size={20} className="text-indigo-500" />
                      Upload New Design
                    </h2>

                    <div className="space-y-5">
                      {/* Name */}
                      <div>
                        <label className="block text-[13px] font-bold text-slate-700 mb-2">
                          Certificate Name{" "}
                          <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={certificateName}
                          onChange={(e) => setCertificateName(e.target.value)}
                          placeholder="e.g. Summer 2026 Blue Theme"
                          className="w-full h-12 px-4 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-indigo-400 focus:ring-[3px] focus:ring-indigo-500/10 outline-none transition-all shadow-sm"
                        />
                      </div>

                      {/* File picker */}
                      <div>
                        <label className="block text-[13px] font-bold text-slate-700 mb-2">
                          Background Image{" "}
                          <span className="text-rose-500">*</span>
                        </label>
                        <label
                          className={`group flex flex-col items-center justify-center w-full py-10 px-4 border-2 border-dashed rounded-2xl cursor-pointer transition-all duration-300 ${
                            selectedFile
                              ? "border-indigo-300 bg-indigo-50/50"
                              : "border-slate-300 bg-slate-50/60 hover:border-indigo-300 hover:bg-indigo-50/30"
                          }`}
                        >
                          <input
                            id="customCertificateImageInput"
                            type="file"
                            accept="image/*,image/heic,image/heif"
                            onChange={handleImageChange}
                            className="hidden"
                          />
                          {selectedFile ? (
                            <motion.div
                              initial={{ scale: 0.9, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              className="text-center"
                            >
                              <div className="w-12 h-12 mx-auto rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 text-white flex items-center justify-center mb-3 shadow-md">
                                <CheckCircle2 size={24} />
                              </div>
                              <p className="text-sm font-bold text-slate-800 truncate max-w-[240px]">
                                {selectedFileName}
                              </p>
                              <p className="text-xs font-semibold text-indigo-600 mt-1">
                                File selected — ready to save
                              </p>
                            </motion.div>
                          ) : (
                            <>
                              <div className="w-12 h-12 rounded-full bg-white border border-slate-200 text-slate-400 flex items-center justify-center mb-3 group-hover:text-indigo-500 group-hover:border-indigo-200 group-hover:scale-110 transition-all duration-300 shadow-sm">
                                <FileImage size={20} />
                              </div>
                              <p className="text-sm font-bold text-slate-600">
                                Click to browse or drag an image here
                              </p>
                              <p className="text-xs text-slate-400 mt-1.5">
                                PNG, JPG, WEBP — max 5 MB
                              </p>
                            </>
                          )}
                        </label>
                      </div>

                      {/* Text Color Picker */}
                      <div>
                        <label className="block text-[13px] font-bold text-slate-700 mb-3 flex items-center gap-1.5">
                          <Palette size={16} className="text-indigo-500" />
                          Certificate Text Color
                        </label>
                        <div className="flex flex-wrap gap-3 items-center">
                          {colorOptions.map((color) => (
                            <button
                              key={color.value}
                              type="button"
                              onClick={() => setTextColor(color.value)}
                              className={`relative w-10 h-10 rounded-full cursor-pointer transition-all ${
                                textColor === color.value
                                  ? "ring-2 ring-offset-2 ring-indigo-500 scale-110 shadow-md"
                                  : "border border-slate-200 hover:scale-105"
                              }`}
                              style={{ backgroundColor: color.value }}
                              title={color.label}
                            >
                              {textColor === color.value && (
                                <CheckCircle2
                                  size={16}
                                  className="absolute inset-0 m-auto text-white drop-shadow-sm"
                                />
                              )}
                            </button>
                          ))}
                          <div className="flex items-center gap-2 ml-2 pl-3 border-l border-slate-200">
                            <span className="text-xs font-semibold text-slate-500">
                              Custom:
                            </span>
                            <div className="relative">
                              <input
                                type="color"
                                value={textColor}
                                onChange={(e) => setTextColor(e.target.value)}
                                className="w-10 h-10 p-1 bg-white border border-slate-200 rounded-lg cursor-pointer"
                                title="Choose custom color"
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Message */}
                      <AnimatePresence>
                        {message && (
                          <motion.div
                            initial={{ opacity: 0, y: -6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            className={`flex items-start gap-2.5 p-4 rounded-xl border text-sm font-semibold ${
                              messageTone === "success"
                                ? "bg-emerald-50 border-emerald-200/70 text-emerald-800"
                                : "bg-rose-50 border-rose-200/70 text-rose-800"
                            }`}
                          >
                            {messageTone === "success" ? (
                              <CheckCircle2
                                size={18}
                                className="text-emerald-500 mt-px shrink-0"
                              />
                            ) : (
                              <AlertCircle
                                size={18}
                                className="text-rose-500 mt-px shrink-0"
                              />
                            )}
                            {message}
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Save button */}
                      <motion.button
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.97 }}
                        type="button"
                        onClick={handleAddCertificate}
                        disabled={isSaving}
                        className="w-full flex items-center justify-center gap-2 h-12 rounded-xl text-white text-sm font-bold shadow-lg shadow-indigo-500/20 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                        style={{
                          background:
                            "linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%)",
                        }}
                      >
                        <Sparkles size={16} />
                        {isSaving ? "Saving..." : "Save Certificate Design"}
                      </motion.button>
                    </div>
                  </div>
                </div>

                {/* Right column: Preview + Tips */}
                <div className="lg:col-span-2 space-y-6">
                  {/* Preview */}
                  <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm">
                    <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2">
                      <Eye size={15} className="text-slate-400" />
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                        Live Preview
                      </span>
                    </div>
                    <div className="p-4 min-h-[240px] flex items-center justify-center bg-[#f8f9fb]">
                      {selectedImagePreview ? (
                        <div
                          className="w-full relative shadow-lg rounded-xl overflow-hidden cursor-pointer hover:shadow-xl hover:ring-2 hover:ring-indigo-500/30 transition-all"
                          style={{
                            /* Aspect ratio of 1120/792 ~ 1.41 */
                            aspectRatio: "1120 / 792",
                            maxWidth: "100%",
                          }}
                          onClick={() =>
                            setLightboxData({
                              imageUrl: selectedImagePreview,
                              textColor: textColor,
                            })
                          }
                        >
                          {/* Use SVG foreignObject to responsively scale the original 1120x792 template into the container */}
                          <svg
                            viewBox="0 0 1120 792"
                            style={{
                              width: "100%",
                              height: "auto",
                              display: "block",
                            }}
                          >
                            <foreignObject width="1120" height="792">
                              <CertificateTemplate
                                studentName="John Doe"
                                internshipTitle="Frontend Developer Intern"
                                companyName="Acme Corp"
                                backgroundImageUrl={selectedImagePreview}
                                textColor={textColor}
                                width={1120}
                                height={792}
                              />
                            </foreignObject>
                          </svg>

                          <div className="absolute inset-0 bg-black/0 hover:bg-black/5 transition-colors flex items-center justify-center opacity-0 hover:opacity-100 z-10">
                            <span className="bg-white/90 backdrop-blur-sm text-slate-800 text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-sm">
                              <Eye size={14} /> Enlarge Preview
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <ImageIcon
                            size={40}
                            className="mx-auto text-slate-300 mb-3"
                            strokeWidth={1.2}
                          />
                          <p className="text-sm font-semibold text-slate-400">
                            No image selected
                          </p>
                          <p className="text-xs text-slate-400 mt-1">
                            Your preview will appear here
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Tips */}
                  <div className="bg-gradient-to-b from-amber-50/80 to-orange-50/40 rounded-2xl border border-amber-200/50 p-5 shadow-sm">
                    <h3 className="text-sm font-bold text-amber-900 flex items-center gap-2 mb-4">
                      <Lightbulb size={16} className="text-amber-500" />
                      Quick Tips
                    </h3>
                    <ul className="space-y-3">
                      {tips.map((tip, i) => (
                        <motion.li
                          key={i}
                          custom={i}
                          initial="hidden"
                          animate="visible"
                          variants={fadeUp}
                          className="flex gap-2.5 text-[13px] font-medium text-amber-900/80 leading-relaxed"
                        >
                          <span className="w-5 h-5 rounded-md bg-amber-200/60 text-amber-700 flex items-center justify-center text-[11px] font-extrabold shrink-0 mt-0.5">
                            {i + 1}
                          </span>
                          {tip}
                        </motion.li>
                      ))}
                    </ul>
                  </div>

                  {/* Logo Download */}
                  <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-1">
                        Skillnaav Official Logo
                      </h3>
                      <p className="text-xs text-slate-500">
                        Download the Skillnaav logo to add to your custom certificates.
                      </p>
                    </div>
                    <a
                      href={skillnaavLogo}
                      download="skillnav_logo_white.png"
                      className="shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white transition-colors text-sm font-bold shadow-sm"
                    >
                      <Download size={16} />
                      Download Logo
                    </a>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ─────────── GALLERY TAB ─────────── */}
          {activeTab === "gallery" && (
            <motion.div
              key="gallery"
              initial="hidden"
              animate="visible"
              exit="hidden"
              variants={scaleIn}
            >
              {/* Search Bar */}
              {!isLoading && certificateItems.length > 0 && (
                <div className="mb-7 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="relative w-full flex-1 group">
                    <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                      <Search
                        size={15}
                        className="text-slate-400 group-focus-within:text-indigo-500 transition-colors duration-200"
                      />
                    </div>
                    {/*Add the "!mt-0" for alignment - 04-08-2026 */}
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search designs by name…"
                      className="!mt-0 w-full h-12 pl-10 pr-10 rounded-2xl bg-white border border-slate-200 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 transition-all duration-200 shadow-sm hover:border-slate-300"
                    />
                    <AnimatePresence>
                      {searchQuery && (
                        <motion.button
                          initial={{ opacity: 0, scale: 0.7 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.7 }}
                          transition={{ duration: 0.15 }}
                          onClick={() => setSearchQuery("")}
                          className="absolute inset-y-0 right-3 flex items-center justify-center w-7 h-7 my-auto rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 transition-all duration-150"
                        >
                          <X size={13} strokeWidth={2.5} />
                        </motion.button>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Result count pill */}
                  <AnimatePresence>
                    {searchQuery && (
                      <motion.span
                        initial={{ opacity: 0, scale: 0.8, x: 6 }}
                        animate={{ opacity: 1, scale: 1, x: 0 }}
                        exit={{ opacity: 0, scale: 0.8, x: 6 }}
                        transition={{ duration: 0.2 }}
                        className="shrink-0 h-8 px-3.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 text-xs font-bold flex items-center gap-1.5 whitespace-nowrap"
                      >
                        <FileBadge size={12} />
                        {filteredItems.length} / {certificateItems.length}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20 text-center w-full">
                  <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
                  <p className="text-sm font-semibold text-slate-600">
                    Loading designs...
                  </p>
                </div>
              ) : certificateItems.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-2xl border-2 border-dashed border-slate-200 py-20 flex flex-col items-center text-center"
                >
                  <div className="w-20 h-20 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center mb-5 shadow-sm">
                    <FileBadge
                      size={36}
                      className="text-slate-300"
                      strokeWidth={1.3}
                    />
                  </div>
                  <h3 className="text-lg font-bold text-slate-800">
                    No designs yet
                  </h3>
                  <p className="text-sm text-slate-400 mt-2 max-w-sm">
                    Upload your first certificate background to get started.
                  </p>
                  <button
                    onClick={() => setActiveTab("upload")}
                    className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-bold shadow-md hover:bg-indigo-700 transition-colors active:scale-95"
                  >
                    <Plus size={16} />
                    Upload First Design
                  </button>
                </motion.div>
              ) : filteredItems.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-2xl border-2 border-dashed border-slate-200 py-16 flex flex-col items-center text-center"
                >
                  <Search
                    size={36}
                    className="text-slate-300 mb-4"
                    strokeWidth={1.3}
                  />
                  <h3 className="text-lg font-bold text-slate-800">
                    No results found
                  </h3>
                  <p className="text-sm text-slate-400 mt-2 max-w-sm">
                    No designs match "
                    <span className="font-semibold text-slate-500">
                      {searchQuery}
                    </span>
                    ". Try a different name.
                  </p>
                  <button
                    onClick={() => setSearchQuery("")}
                    className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    <X size={14} /> Clear Search
                  </button>
                </motion.div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
                    {paginatedItems.map((item, i) => (
                      <motion.div
                        key={item._id}
                        custom={i}
                        initial="hidden"
                        animate="visible"
                        variants={fadeUp}
                        className="group flex h-full flex-col bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm hover:shadow-xl hover:shadow-indigo-500/8 hover:border-indigo-200 transition-all duration-300 relative"
                      >
                        {/* Image */}
                        <div
                          className="h-48 bg-slate-50 overflow-hidden relative cursor-pointer"
                          onClick={() =>
                            setLightboxData({
                              imageUrl: item.imageUrl,
                              textColor: item.textColor || "#1f2937",
                            })
                          }
                        >
                          <img
                            src={item.imageUrl}
                            alt={item.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                          {/* Status Badge */}
                          <div className="absolute top-3 right-3 z-10 flex gap-2">
                            {item.status === "Approved" && (
                              <span className="bg-emerald-100 text-emerald-800 text-[11px] font-bold px-2.5 py-1 rounded-md flex items-center gap-1 shadow-sm">
                                <CheckCircle2 size={12} /> Approved
                              </span>
                            )}
                            {item.status === "Rejected" && (
                              <span className="bg-rose-100 text-rose-800 text-[11px] font-bold px-2.5 py-1 rounded-md flex items-center gap-1 shadow-sm">
                                <AlertCircle size={12} /> Rejected
                              </span>
                            )}
                            {(!item.status || item.status === "Pending") && (
                              <span className="bg-amber-100 text-amber-800 text-[11px] font-bold px-2.5 py-1 rounded-md flex items-center gap-1 shadow-sm">
                                <Clock size={12} /> Pending
                              </span>
                            )}
                          </div>
                          {/* Hover overlay */}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4">
                            <span className="text-xs text-white font-semibold bg-white/20 backdrop-blur-sm px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                              <Eye size={13} /> View Full
                            </span>
                          </div>
                        </div>

                        {/* Card body */}
                        <div className="flex flex-1 flex-col p-4">
                          <h4
                            className="text-[15px] font-bold text-slate-900 truncate"
                            title={item.name}
                          >
                            {item.name}
                          </h4>

                          {item.fileName && (
                            <p className="text-xs text-slate-400 mt-1 truncate font-medium">
                              {item.fileName}
                            </p>
                          )}

                          {item.status === "Rejected" && item.adminRemarks && (
                            <div className="mt-3 bg-rose-50/50 p-2.5 rounded-xl border border-rose-100/50">
                              <p className="text-[11px] font-bold text-rose-800 mb-0.5">
                                Admin Remarks
                              </p>
                              <p className="text-xs text-rose-600/90 leading-relaxed">
                                {item.adminRemarks}
                              </p>
                            </div>
                          )}

                          <div className="mt-auto flex flex-col gap-3 pt-4">
                            <div className="border-t border-slate-100" />
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                              <span className="text-xs text-slate-500 font-semibold flex items-center gap-1.5">
                                <Calendar size={12} />
                                {new Date(item.createdAt).toLocaleDateString(
                                  "en-GB",
                                )}
                              </span>

                              <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.92 }}
                                onClick={() => openDeleteConfirmation(item)}
                                disabled={isDeleting}
                                className="inline-flex items-center justify-center gap-1.5 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-500 hover:text-white border border-rose-100 hover:border-rose-500 px-3 py-1.5 rounded-lg transition-all duration-200 shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                              >
                                <Trash2 size={13} />
                                Delete
                              </motion.button>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  {totalGalleryPages > 1 && (
                    <div className="mt-8 flex flex-col gap-4 rounded-2xl border border-slate-200/80 bg-white px-4 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:px-5">
                      <p className="text-sm font-semibold text-slate-500 text-center sm:text-left">
                        Showing {(galleryPage - 1) * DESIGNS_PER_PAGE + 1}-
                        {Math.min(
                          galleryPage * DESIGNS_PER_PAGE,
                          filteredItems.length,
                        )}{" "}
                        of {filteredItems.length} designs
                      </p>

                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setGalleryPage((prevPage) =>
                                Math.max(prevPage - 1, 1),
                              )
                            }
                            disabled={galleryPage === 1}
                            className="inline-flex h-10 min-w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            aria-label="Previous page"
                          >
                            <ChevronLeft size={16} />
                          </button>

                          <div className="flex flex-wrap items-center justify-center gap-2">
                            {galleryPageNumbers.map((pageNumber, index) =>
                              pageNumber === "..." ? (
                                <span
                                  key={`ellipsis-${index}`}
                                  className="inline-flex h-10 min-w-10 items-center justify-center text-sm font-bold text-slate-400"
                                >
                                  ...
                                </span>
                              ) : (
                                <button
                                  key={pageNumber}
                                  type="button"
                                  onClick={() => setGalleryPage(pageNumber)}
                                  className={`inline-flex h-10 min-w-10 items-center justify-center rounded-xl border text-sm font-bold transition-colors ${
                                    galleryPage === pageNumber
                                      ? "border-indigo-500 bg-indigo-600 text-white shadow-lg shadow-indigo-500/20"
                                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                                  }`}
                                >
                                  {pageNumber}
                                </button>
                              ),
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              setGalleryPage((prevPage) =>
                                Math.min(prevPage + 1, totalGalleryPages),
                              )
                            }
                            disabled={galleryPage === totalGalleryPages}
                            className="inline-flex h-10 min-w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            aria-label="Next page"
                          >
                            <ChevronRight size={16} />
                          </button>
                        </div>

                        <span className="text-center text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                          Page {galleryPage} of {totalGalleryPages}
                        </span>
                      </div>
                    </div>
                  )}
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default CustomInternshipCertificateManager;
