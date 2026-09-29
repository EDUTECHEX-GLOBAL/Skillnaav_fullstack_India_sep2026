// ─── InternshipsPosted.jsx ────────────────────────────────────────────────────
import React, { useEffect, useState, useMemo } from "react";
import axios from "../../../../api/axiosInstance";
import Modal from "react-modal";
import { motion } from "framer-motion";
import {
  FaMapMarkerAlt,
  FaClock,
  FaDollarSign,
  FaCommentDots,
  FaSpinner,
} from "react-icons/fa";
import { AiOutlineLeft, AiOutlineRight } from "react-icons/ai";
import { format } from "date-fns";

import Skillnaavlogo from "../../../../assets-webapp/Skillnaavlogo.png";
import AdminChatModal from "./AdminChatModal";

Modal.setAppElement("#root");

// ─── Spinner helper ───────────────────────────────────────────────────────────
const Spinner = ({ size = "w-4 h-4" }) => (
  <FaSpinner className={`${size} animate-spin`} />
);

// ─── Internship detail overlay ────────────────────────────────────────────────
const InternshipDetails = ({ internship, onClose }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
    exit={{ opacity: 0, scale: 0.95 }}
    className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 z-[1000] overflow-y-auto"
  >
    <motion.div
      initial={{ scale: 0.9, y: 30 }}
      animate={{ scale: 1, y: 0 }}
      exit={{ scale: 0.9, y: 30 }}
      className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col border border-white/30"
    >
      {/* Header */}
      <div className="p-8 border-b border-gray-200 bg-gradient-to-r from-purple-50/80 to-indigo-50/80 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <button
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-white/50 rounded-2xl backdrop-blur-sm shadow-md transition-all"
            aria-label="Back to list"
          >
            ← Back to list
          </button>
          <span
            className={`px-3 py-1 text-xs font-bold rounded-full ${
              internship.adminStatus === "approved" || internship.adminApproved
                ? "bg-emerald-100 text-emerald-800"
                : internship.adminStatus === "rejected"
                  ? "bg-red-100 text-red-800"
                  : internship.adminStatus === "in_review" ||
                      internship.adminReviewed
                    ? "bg-yellow-100 text-yellow-800"
                    : "bg-orange-100 text-orange-800"
            }`}
          >
            {internship.adminStatus === "approved" || internship.adminApproved
              ? "Approved"
              : internship.adminStatus === "rejected"
                ? "Rejected"
                : internship.adminStatus === "in_review" ||
                    internship.adminReviewed
                  ? "In Review"
                  : "Pending"}
          </span>
        </div>
        <div className="mt-6 flex items-start gap-6">
          <img
            src={internship.imgUrl || Skillnaavlogo}
            alt={internship.companyName}
            className="w-20 h-20 rounded-2xl object-cover shadow-2xl ring-4 ring-white/50"
          />
          <div>
            <h1 className="text-3xl font-black text-gray-900 mb-2">
              {internship.jobTitle}
            </h1>
            <p className="text-2xl text-gray-700">{internship.companyName}</p>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="p-8 overflow-y-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <div className="space-y-6">
            <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl">
              <FaMapMarkerAlt className="w-6 h-6 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-gray-600">Location</p>
                <p className="text-xl font-bold text-gray-900">
                  {internship.location}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-emerald-50 to-green-50 rounded-2xl">
              <FaClock className="w-6 h-6 text-emerald-600" />
              <div>
                <p className="text-sm font-medium text-gray-600">Duration</p>
                <p className="text-xl font-bold text-gray-900">
                  {format(new Date(internship.startDate), "dd MMM yyyy")} –{" "}
                  {format(
                    new Date(internship.endDateOrDuration),
                    "dd MMM yyyy",
                  )}
                </p>
              </div>
            </div>
            <div className="p-5 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-2xl border border-yellow-200/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FaDollarSign className="w-8 h-8 bg-gradient-to-br from-yellow-400 to-orange-500 text-white rounded-xl p-2" />
                  <div>
                    <p className="text-sm font-medium text-gray-600">
                      Compensation
                    </p>
                    <p className="text-2xl font-bold text-gray-900">
                      {internship.compensationDetails?.amount}{" "}
                      {internship.compensationDetails?.currency}
                    </p>
                  </div>
                </div>
                <span className="text-sm font-semibold px-3 py-1 bg-white/80 rounded-full">
                  {internship.internshipType}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-4">
                Skills Required
              </h3>
              <div className="flex flex-wrap gap-2">
                {internship.qualifications?.map((skill, i) => (
                  <span
                    key={i}
                    className="px-4 py-2 bg-purple-100 text-purple-800 rounded-full text-sm font-medium"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
            <div className="p-5 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-2xl">
              <div className="flex items-center gap-3">
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold ${
                    internship.internshipMode === "ONLINE"
                      ? "bg-blue-500 text-white"
                      : "bg-emerald-500 text-white"
                  }`}
                >
                  {internship.internshipMode === "ONLINE" ? "PC" : "🏢"}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Mode</p>
                  <p className="text-2xl font-bold text-gray-900 capitalize">
                    {internship.internshipMode?.toLowerCase()}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {internship.jobDescription && (
          <div className="mt-8">
            <h3 className="text-2xl font-bold text-gray-900 mb-6">
              About the Internship
            </h3>
            <p className="text-lg text-gray-700 leading-relaxed whitespace-pre-wrap">
              {internship.jobDescription}
            </p>
          </div>
        )}
      </div>
    </motion.div>
  </motion.div>
);

// ─── Main component ───────────────────────────────────────────────────────────
const PartnerManagement = () => {
  const [internships, setInternships] = useState([]);

  //page loading - 05-08-2026
  const [loading, setLoading] = useState(true);
  // Chat modal
  const [chatInternship, setChatInternship] = useState(null);
  const [isChatOpen, setIsChatOpen] = useState(false);

  // Detail overlay
  const [detailInternship, setDetailInternship] = useState(null);

  // Approve modal
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
  const [internshipToApprove, setInternshipToApprove] = useState(null);
  const [isApproving, setIsApproving] = useState(false);

  // Reject modal
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [internshipToReject, setInternshipToReject] = useState(null);
  const [rejectComment, setRejectComment] = useState("");
  const [isRejecting, setIsRejecting] = useState(false);

  // Delete modal
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [internshipToDelete, setInternshipToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Per-card inline action loading  { [id]: "approve" | "reject" | "delete" | "chat" }
  const [cardLoading, setCardLoading] = useState({});

  // Filters / pagination
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // ── Fetch ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      //05-08-2026
      setLoading(true);
      try {
        const res = await axios.get("/api/interns");
        setInternships(res.data || []);
      } catch (err) {
        console.error("fetchInternships:", err);
      } finally {
        //add finally for page loading - 05-08-2026
        setLoading(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    const openTargetChat = (targetId) => {
      if (!targetId || internships.length === 0) return;

      const target = internships.find(
        (item) => String(item._id) === String(targetId),
      );
      if (!target) return;

      setStatusFilter("ALL");
      setSearchQuery("");
      setCurrentPage(
        Math.max(
          1,
          Math.ceil((internships.indexOf(target) + 1) / ITEMS_PER_PAGE),
        ),
      );
      setChatInternship(target);
      setIsChatOpen(true);
      sessionStorage.removeItem("adminOpenChatInternshipId");
    };

    openTargetChat(sessionStorage.getItem("adminOpenChatInternshipId"));

    const handleOpenChatEvent = (event) => {
      openTargetChat(event?.detail?.internshipId);
    };

    window.addEventListener("adminOpenInternshipChat", handleOpenChatEvent);
    return () =>
      window.removeEventListener(
        "adminOpenInternshipChat",
        handleOpenChatEvent,
      );
  }, [internships]);

  // ── Helpers ──────────────────────────────────────────────────────────────
  const calculatePostedTime = (date) => {
    const diff = Math.floor((Date.now() - new Date(date)) / 86_400_000);
    if (diff === 0) return "Today";
    if (diff === 1) return "Yesterday";
    return `${diff}d ago`;
  };

  const setCardAction = (id, action) =>
    setCardLoading((prev) => ({ ...prev, [id]: action }));
  const clearCardAction = (id) =>
    setCardLoading((prev) => {
      const n = { ...prev };
      delete n[id];
      return n;
    });

  // ── Approve ───────────────────────────────────────────────────────────────
  const handleApproveClick = (internship) => {
    setInternshipToApprove(internship);
    setIsApproveModalOpen(true);
  };

  const confirmApprove = async () => {
    if (!internshipToApprove) return;
    setIsApproving(true);
    setCardAction(internshipToApprove._id, "approve");
    try {
      await axios.patch(`/api/interns/${internshipToApprove._id}/approve`, {
        status: "approved",
      });
      setInternships((prev) =>
        prev.map((i) =>
          i._id === internshipToApprove._id
            ? {
                ...i,
                adminStatus: "approved",
                adminApproved: true,
                adminReviewed: true,
              }
            : i,
        ),
      );
      setIsApproveModalOpen(false);
      setInternshipToApprove(null);
    } catch (err) {
      console.error("confirmApprove:", err);
      alert("Failed to approve. Please try again.");
    } finally {
      setIsApproving(false);
      clearCardAction(internshipToApprove?._id);
    }
  };

  // ── Reject ────────────────────────────────────────────────────────────────
  const handleRejectClick = (internship) => {
    setInternshipToReject(internship);
    setIsRejectModalOpen(true);
  };

  const confirmReject = async () => {
    if (!internshipToReject) return;
    setIsRejecting(true);
    setCardAction(internshipToReject._id, "reject");
    try {
      await axios.patch(`/api/interns/${internshipToReject._id}/reject`, {
        status: "rejected",
        reason: rejectComment,
      });
      setInternships((prev) =>
        prev.map((i) =>
          i._id === internshipToReject._id
            ? {
                ...i,
                adminStatus: "rejected",
                adminApproved: false,
                adminReviewed: true,
                rejectionReason: rejectComment,
              }
            : i,
        ),
      );
      setIsRejectModalOpen(false);
      setInternshipToReject(null);
      setRejectComment("");
    } catch (err) {
      console.error("confirmReject:", err);
      alert("Failed to reject. Please try again.");
    } finally {
      setIsRejecting(false);
      clearCardAction(internshipToReject?._id);
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDeleteClick = (internship) => {
    setInternshipToDelete(internship);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!internshipToDelete) return;
    setIsDeleting(true);
    setCardAction(internshipToDelete._id, "delete");
    try {
      await axios.delete(`/api/interns/${internshipToDelete._id}`);
      setInternships((prev) =>
        prev.filter((i) => i._id !== internshipToDelete._id),
      );
      setIsDeleteModalOpen(false);
      setInternshipToDelete(null);
    } catch (err) {
      console.error("confirmDelete:", err);
      alert("Error deleting internship. Please try again.");
    } finally {
      setIsDeleting(false);
      clearCardAction(internshipToDelete?._id);
    }
  };

  // ── Chat ──────────────────────────────────────────────────────────────────
  const handleOpenChat = (internship) => {
    setChatInternship(internship);
    setIsChatOpen(true);
  };

  const handleChatClose = () => {
    setIsChatOpen(false);
    setChatInternship(null);
  };

  const handleReviewedUpdate = (internshipId) => {
    setInternships((prev) =>
      prev.map((i) =>
        i._id === internshipId
          ? {
              ...i,
              adminReviewed: true,
              adminStatus:
                i.adminStatus === "pending" ? "in_review" : i.adminStatus,
            }
          : i,
      ),
    );
    setChatInternship((prev) =>
      prev?._id === internshipId
        ? {
            ...prev,
            adminReviewed: true,
            adminStatus:
              prev.adminStatus === "pending" ? "in_review" : prev.adminStatus,
          }
        : prev,
    );
  };

  // ── Stats & filter ────────────────────────────────────────────────────────
  const { stats, filteredInternships } = useMemo(() => {
    const getStatus = (i) => {
      if (i.adminStatus) return i.adminStatus;
      if (i.adminApproved) return "approved";
      if (i.adminReviewed && i.rejectionReason) return "rejected";
      if (i.adminReviewed) return "in_review";
      return "pending";
    };

    const q = searchQuery.toLowerCase();
    const filtered = internships.filter((i) => {
      const matchesSearch =
        i.jobTitle?.toLowerCase().includes(q) ||
        i.companyName?.toLowerCase().includes(q) ||
        i.organization?.toLowerCase().includes(q) ||
        i._id?.toLowerCase().includes(q);

      const s = getStatus(i);
      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "APPROVED" && s === "approved") ||
        (statusFilter === "REJECTED" && s === "rejected") ||
        (statusFilter === "PENDING" && s === "pending") ||
        (statusFilter === "REVIEWED" && s === "in_review");

      return matchesSearch && matchesStatus;
    });

    const stats = {
      total: internships.length,
      approved: internships.filter((i) => getStatus(i) === "approved").length,
      rejected: internships.filter((i) => getStatus(i) === "rejected").length,
      pending: internships.filter((i) => getStatus(i) === "pending").length,
      reviewed: internships.filter((i) => getStatus(i) === "in_review").length,
    };

    return { stats, filteredInternships: filtered };
  }, [internships, searchQuery, statusFilter]);

  const totalPages = Math.ceil(filteredInternships.length / ITEMS_PER_PAGE);
  const currentItems = filteredInternships.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  const getPaginationItems = () => {
    if (totalPages <= 7)
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    if (currentPage <= 4) return [1, 2, 3, 4, 5, "ellipsis-right", totalPages];
    if (currentPage >= totalPages - 3)
      return [
        1,
        "ellipsis-left",
        totalPages - 4,
        totalPages - 3,
        totalPages - 2,
        totalPages - 1,
        totalPages,
      ];
    return [
      1,
      "ellipsis-left",
      currentPage - 1,
      currentPage,
      currentPage + 1,
      "ellipsis-right",
      totalPages,
    ];
  };

  const nextPage = () => setCurrentPage((p) => Math.min(p + 1, totalPages));
  const prevPage = () => setCurrentPage((p) => Math.max(p - 1, 1));

  // add this function for page loading - 05-08-2026
  if (loading) {
    return (
      <div className="flex items-center justify-center h-[80vh]">
        <div className="flex flex-col items-center gap-4">
          <FaSpinner className="text-4xl text-indigo-600 animate-spin" />
          <p className="text-gray-600 font-medium">Loading internships...</p>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 rounded-lg shadow-md bg-gray-100 font-poppins text-sm">
      <h2 className="text-2xl font-semibold mb-8 text-center text-gray-800">
        Admin Dashboard — Internship Management
      </h2>

      {/* Status Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        {[
          {
            key: "ALL",
            label: "Total",
            count: stats.total,
            color: "bg-gray-100 text-gray-800",
          },
          {
            key: "APPROVED",
            label: "Approved",
            count: stats.approved,
            color: "bg-green-100 text-green-800",
          },
          {
            key: "PENDING",
            label: "Pending",
            count: stats.pending,
            color: "bg-orange-100 text-orange-800",
          },
          {
            key: "REJECTED",
            label: "Rejected",
            count: stats.rejected,
            color: "bg-red-100 text-red-800",
          },
          {
            key: "REVIEWED",
            label: "In Review",
            count: stats.reviewed,
            color: "bg-purple-100 text-purple-800",
          },
        ].map((item) => (
          <button
            key={item.key}
            onClick={() => {
              setStatusFilter(item.key);
              setCurrentPage(1);
            }}
            className={`p-4 rounded-2xl shadow-sm border transition-all text-left ${item.color} ${
              statusFilter === item.key
                ? "ring-2 ring-offset-2 ring-indigo-500 scale-[1.02]"
                : "hover:shadow-md"
            }`}
          >
            <p className="text-sm font-medium">{item.label}</p>
            <p className="text-2xl font-bold mt-1">{item.count}</p>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Search by organisation, role, or company…"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setCurrentPage(1);
          }}
          className="p-3 border rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6 mb-8">
        {currentItems.map((internship, index) => {
          const activeAction = cardLoading[internship._id]; // "approve" | "reject" | "delete" | undefined
          const isApproved =
            internship.adminStatus === "approved" || internship.adminApproved;

          return (
            <motion.div
              key={internship._id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="group bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg hover:shadow-xl border border-gray-200/50 hover:border-purple-300/70 transition-all duration-300 overflow-hidden relative"
              whileHover={{ scale: 1.02 }}
            >
              {/* Full-card loading overlay */}
              {activeAction && (
                <div className="absolute inset-0 z-20 bg-white/70 backdrop-blur-sm flex flex-col items-center justify-center rounded-2xl gap-2">
                  <Spinner size="w-8 h-8" />
                  <span className="text-sm font-semibold text-gray-600 capitalize">
                    {activeAction === "approve" && "Approving…"}
                    {activeAction === "reject" && "Rejecting…"}
                    {activeAction === "delete" && "Deleting…"}
                  </span>
                </div>
              )}

              {/* Badges */}
              <div className="absolute top-3 right-3 z-10 flex flex-col gap-1">
                <span
                  className={`px-2.5 py-1 text-xs font-bold rounded-full shadow-sm ${
                    internship.internshipType === "PAID"
                      ? "bg-red-100 text-red-700"
                      : internship.internshipType === "STIPEND"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-green-100 text-green-700"
                  }`}
                >
                  {internship.internshipType}
                </span>
                <button
                  onClick={() => handleOpenChat(internship)}
                  aria-label="Open chat"
                  disabled={!!activeAction}
                  className={`w-8 h-8 rounded-full flex items-center justify-center shadow-md transition-all group-hover:scale-110 disabled:opacity-60 disabled:cursor-not-allowed ${
                    internship.adminReviewed
                      ? "bg-green-500 text-white"
                      : "bg-gray-200 text-gray-500 hover:bg-purple-500 hover:text-white"
                  }`}
                >
                  <FaCommentDots />
                </button>
              </div>

              {/* Header */}
              <div className="p-5 pt-12 border-b border-gray-100">
                <div className="flex items-start gap-3 mb-3">
                  <img
                    src={internship.imgUrl || Skillnaavlogo}
                    alt={internship.companyName}
                    className="w-12 h-12 rounded-full object-cover shadow-lg ring-2 ring-white/50"
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-bold text-gray-900 line-clamp-1 group-hover:text-purple-700">
                      {internship.jobTitle}
                    </h3>
                    <p className="text-sm text-gray-600 line-clamp-1">
                      {internship.companyName}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {calculatePostedTime(internship.createdAt)}
                    </p>
                    <p className="text-[11px] text-gray-400 mt-0.5 whitespace-nowrap">
                      ID: {internship._id}
                    </p>
                  </div>
                </div>
              </div>

              {/* Details */}
              <div className="p-5 space-y-3">
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <FaMapMarkerAlt className="w-4 h-4 shrink-0" />
                  <span className="truncate">{internship.location}</span>
                  <span className="ml-auto text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full shrink-0">
                    {internship.internshipMode === "ONLINE"
                      ? "Online"
                      : "Offline"}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <FaClock className="w-4 h-4 shrink-0" />
                  <span>
                    {format(new Date(internship.startDate), "dd MMM")} –{" "}
                    {format(
                      new Date(internship.endDateOrDuration),
                      "dd MMM yyyy",
                    )}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 bg-gradient-to-r from-yellow-50 to-orange-50 p-3 rounded-xl border border-yellow-200/50">
                  <FaDollarSign className="w-4 h-4 text-yellow-600 shrink-0" />
                  <span className="truncate flex-1">
                    {internship.internshipType === "STIPEND"
                      ? `${internship.compensationDetails?.amount} ${internship.compensationDetails?.currency}/mo`
                      : internship.internshipType === "PAID"
                        ? `Student Pays: ${internship.compensationDetails?.amount}`
                        : "Free"}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  {internship.qualifications?.slice(0, 2).map((skill, i) => (
                    <span
                      key={i}
                      className="text-xs bg-gray-100 text-gray-800 px-2.5 py-1 rounded-full"
                    >
                      {skill}
                    </span>
                  ))}
                  {internship.qualifications?.length > 2 && (
                    <span className="text-xs bg-gray-100 text-gray-700 px-2.5 py-1 rounded-full">
                      +{internship.qualifications.length - 2}
                    </span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="px-5 pb-5 pt-3 bg-gradient-to-t from-gray-50 to-transparent">
                <div className="flex flex-wrap gap-1.5 text-xs mb-2">
                  {/* Approve */}
                  <button
                    className={`flex-1 py-2 px-3 rounded-xl font-semibold text-white shadow-sm transition-all flex items-center justify-center gap-1.5 ${
                      isApproved
                        ? "bg-green-500 cursor-default opacity-90"
                        : activeAction === "approve"
                          ? "bg-emerald-400 cursor-not-allowed"
                          : "bg-emerald-500 hover:bg-emerald-600 hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
                    }`}
                    onClick={() => handleApproveClick(internship)}
                    disabled={isApproved || !!activeAction}
                  >
                    {activeAction === "approve" ? (
                      <>
                        <Spinner /> Approving…
                      </>
                    ) : isApproved ? (
                      "Approved ✓"
                    ) : (
                      "Approve"
                    )}
                  </button>

                  {/* Review / Chat */}
                  <button
                    className={`px-3 py-2.5 rounded-xl font-semibold text-white shadow-sm transition-all flex items-center justify-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed ${
                      internship.adminReviewed
                        ? "bg-green-600 hover:bg-green-700"
                        : "bg-purple-500 hover:bg-purple-600 hover:shadow-md"
                    }`}
                    onClick={() => handleOpenChat(internship)}
                    disabled={!!activeAction}
                  >
                    {internship.adminReviewed ? "Chat ✓" : "Review"}
                  </button>

                  {/* Reject */}
                  <button
                    className="px-3 py-2.5 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-xl shadow-sm hover:shadow-md transition-all flex-1 flex items-center justify-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed"
                    onClick={() => handleRejectClick(internship)}
                    disabled={!!activeAction}
                  >
                    {activeAction === "reject" ? (
                      <>
                        <Spinner /> Rejecting…
                      </>
                    ) : (
                      "Reject"
                    )}
                  </button>

                  {/* Delete */}
                  <button
                    className="px-3 py-2.5 bg-gray-500 hover:bg-gray-600 text-white font-semibold rounded-xl shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed"
                    onClick={() => handleDeleteClick(internship)}
                    disabled={!!activeAction}
                  >
                    {activeAction === "delete" ? (
                      <>
                        <Spinner />
                      </>
                    ) : (
                      "Delete"
                    )}
                  </button>
                </div>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full py-2.5 px-4 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                  onClick={() => setDetailInternship(internship)}
                  disabled={!!activeAction}
                >
                  View Details
                </motion.button>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Detail overlay */}
      {detailInternship && (
        <InternshipDetails
          internship={detailInternship}
          onClose={() => setDetailInternship(null)}
        />
      )}

      {/* Pagination */}
      {filteredInternships.length > ITEMS_PER_PAGE && (
        <div className="mt-8 border-t border-gray-200 pt-6">
          <div className="flex justify-center">
            <div className="inline-flex w-full sm:w-auto items-center justify-center gap-1.5 rounded-2xl border border-slate-200/80 bg-white/95 p-1.5 shadow-[0_14px_30px_-18px_rgba(15,23,42,0.35)]">
              <button
                onClick={prevPage}
                disabled={currentPage === 1}
                className={`inline-flex h-10 items-center justify-center gap-2 rounded-xl border px-3 sm:px-4 text-sm font-semibold transition-all duration-200 ${
                  currentPage === 1
                    ? "border-transparent bg-slate-50 text-slate-400 cursor-not-allowed"
                    : "border-transparent bg-slate-50 text-slate-700 hover:bg-blue-50 hover:text-blue-700"
                }`}
                aria-label="Go to previous page"
              >
                <AiOutlineLeft size={16} />
                <span className="hidden sm:inline">Previous</span>
              </button>

              <div className="hidden sm:flex items-center gap-1">
                {getPaginationItems().map((item, index) => {
                  if (typeof item !== "number") {
                    return (
                      <span
                        key={`${item}-${index}`}
                        className="flex h-10 min-w-[2.25rem] items-center justify-center rounded-xl bg-slate-50 px-2 text-sm font-medium text-slate-400"
                      >
                        ...
                      </span>
                    );
                  }
                  return (
                    <button
                      key={item}
                      onClick={() => setCurrentPage(item)}
                      className={`flex h-10 min-w-[2.5rem] items-center justify-center rounded-xl px-3 text-sm font-semibold transition-all duration-200 ${
                        currentPage === item
                          ? "bg-blue-600 text-white shadow-[0_10px_18px_-12px_rgba(37,99,235,0.85)]"
                          : "bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                      }`}
                      aria-label={`Go to page ${item}`}
                      aria-current={currentPage === item ? "page" : undefined}
                    >
                      {item}
                    </button>
                  );
                })}
              </div>

              <div className="flex h-10 min-w-[4.75rem] items-center justify-center rounded-xl bg-slate-50 px-4 text-sm font-semibold text-slate-700 sm:hidden">
                {currentPage} / {totalPages}
              </div>

              <button
                onClick={nextPage}
                disabled={currentPage === totalPages}
                className={`inline-flex h-10 items-center justify-center gap-2 rounded-xl border px-3 sm:px-4 text-sm font-semibold transition-all duration-200 ${
                  currentPage === totalPages
                    ? "border-transparent bg-slate-50 text-slate-400 cursor-not-allowed"
                    : "border-transparent bg-slate-50 text-slate-700 hover:bg-blue-50 hover:text-blue-700"
                }`}
                aria-label="Go to next page"
              >
                <span className="hidden sm:inline">Next</span>
                <AiOutlineRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modals ──────────────────────────────────────────────────────────── */}

      {/* Delete */}
      <Modal
        isOpen={isDeleteModalOpen}
        onRequestClose={() => {
          if (!isDeleting) {
            setIsDeleteModalOpen(false);
            setInternshipToDelete(null);
          }
        }}
        overlayClassName="fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-[999]"
        className="bg-white p-8 rounded-2xl shadow-2xl max-w-md w-full mx-4 outline-none font-poppins"
      >
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          Confirm Deletion
        </h2>
        {internshipToDelete && (
          <div>
            <p className="text-gray-700 mb-6 leading-relaxed">
              Are you sure you want to{" "}
              <span className="font-semibold text-red-600">
                permanently delete
              </span>{" "}
              the internship "<strong>{internshipToDelete.jobTitle}</strong>" at{" "}
              <strong>{internshipToDelete.companyName}</strong>?
            </p>
            <div className="flex gap-3 mt-6">
              <button
                onClick={confirmDelete}
                disabled={isDeleting}
                className="flex-1 bg-red-600 text-white py-3 px-6 rounded-xl font-semibold hover:bg-red-700 transition-all shadow-md disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <Spinner /> Deleting…
                  </>
                ) : (
                  "Delete Internship"
                )}
              </button>
              <button
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setInternshipToDelete(null);
                }}
                disabled={isDeleting}
                className="flex-1 bg-gray-200 text-gray-800 py-3 px-6 rounded-xl font-semibold hover:bg-gray-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Approve */}
      <Modal
        isOpen={isApproveModalOpen}
        onRequestClose={() => {
          if (!isApproving) {
            setIsApproveModalOpen(false);
            setInternshipToApprove(null);
          }
        }}
        overlayClassName="fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-[999]"
        className="bg-white p-8 rounded-2xl shadow-2xl max-w-md w-full mx-4 outline-none font-poppins"
      >
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          Approve Internship
        </h2>
        {internshipToApprove && (
          <div>
            <p className="text-gray-700 mb-6 leading-relaxed">
              Are you sure you want to{" "}
              <span className="font-semibold text-green-600">approve</span> the
              internship "<strong>{internshipToApprove.jobTitle}</strong>" at{" "}
              <strong>{internshipToApprove.companyName}</strong>?
            </p>
            <div className="flex gap-3">
              <button
                onClick={confirmApprove}
                disabled={isApproving}
                className="flex-1 bg-emerald-600 text-white py-3 px-6 rounded-xl font-semibold hover:bg-emerald-700 transition-all shadow-md disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isApproving ? (
                  <>
                    <Spinner /> Approving…
                  </>
                ) : (
                  "Yes, Approve"
                )}
              </button>
              <button
                onClick={() => {
                  setIsApproveModalOpen(false);
                  setInternshipToApprove(null);
                }}
                disabled={isApproving}
                className="flex-1 bg-gray-200 text-gray-800 py-3 px-6 rounded-xl font-semibold hover:bg-gray-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Reject */}
      <Modal
        isOpen={isRejectModalOpen}
        onRequestClose={() => {
          if (!isRejecting) {
            setIsRejectModalOpen(false);
            setInternshipToReject(null);
            setRejectComment("");
          }
        }}
        overlayClassName="fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-[999]"
        className="bg-white p-8 rounded-2xl shadow-2xl max-w-md w-full mx-4 outline-none font-poppins"
      >
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          Reject Internship
        </h2>
        {internshipToReject && (
          <div>
            <p className="text-gray-700 mb-6 leading-relaxed">
              You're about to reject "
              <strong>{internshipToReject.jobTitle}</strong>" at{" "}
              <strong>{internshipToReject.companyName}</strong>.
            </p>
            <textarea
              placeholder="Reason for rejection (optional but recommended)…"
              value={rejectComment}
              onChange={(e) => setRejectComment(e.target.value)}
              disabled={isRejecting}
              className="w-full border border-gray-300 p-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 resize-none mb-6 text-gray-800 placeholder-gray-500 disabled:opacity-60 disabled:cursor-not-allowed"
              rows="5"
            />
            <div className="flex gap-3">
              <button
                onClick={confirmReject}
                disabled={isRejecting}
                className="flex-1 bg-red-600 text-white py-3 px-6 rounded-xl font-semibold hover:bg-red-700 transition-all shadow-md disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isRejecting ? (
                  <>
                    <Spinner /> Rejecting…
                  </>
                ) : (
                  "Confirm Rejection"
                )}
              </button>
              <button
                onClick={() => {
                  setIsRejectModalOpen(false);
                  setInternshipToReject(null);
                  setRejectComment("");
                }}
                disabled={isRejecting}
                className="flex-1 bg-gray-200 text-gray-800 py-3 px-6 rounded-xl font-semibold hover:bg-gray-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Chat Modal */}
      <AdminChatModal
        isOpen={isChatOpen}
        internship={chatInternship}
        onClose={handleChatClose}
        onReviewedUpdate={handleReviewedUpdate}
      />
    </div>
  );
};

export default PartnerManagement;
