import React, { useEffect, useState } from "react";
import axios from "../../../../api/axiosInstance";
import jsPDF from "jspdf";
import {
  AiOutlineCheck,
  AiOutlineCloseCircle,
  AiOutlineSearch,
  AiOutlineFilePdf,
  AiOutlineEye,
  AiOutlineLeft,
  AiOutlineRight,
  AiOutlineMail,
  AiOutlineIdcard,
} from "react-icons/ai";

const PartnerManagement = () => {
  // ---------------- STATES ----------------
  const [partners, setPartners] = useState([]);
  const [filteredPartners, setFilteredPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [selectedPartner, setSelectedPartner] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [confirmAction, setConfirmAction] = useState(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const itemsPerPage = 9;

  // ---------------- FETCH ----------------
  useEffect(() => {
    const fetchPartners = async () => {
      try {
        const { data } = await axios.get("/api/partners/partners");
        setPartners(data);
        setFilteredPartners(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchPartners();
  }, []);

  // ---------------- FILTER ----------------
  useEffect(() => {
    let result = partners;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.universityName?.toLowerCase().includes(q) ||
          p.email?.toLowerCase().includes(q),
      );
    }

    setFilteredPartners(result);
    setCurrentPage(1);
  }, [searchQuery, partners]);

  // ---------------- PAGINATION ----------------
  const totalPages = Math.ceil(filteredPartners.length / itemsPerPage);
  const indexOfLast = currentPage * itemsPerPage;
  const indexOfFirst = indexOfLast - itemsPerPage;
  const currentPartners = filteredPartners.slice(indexOfFirst, indexOfLast);

  const getPaginationItems = () => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    if (currentPage <= 4) {
      return [1, 2, 3, 4, 5, "ellipsis-right", totalPages];
    }

    if (currentPage >= totalPages - 3) {
      return [
        1,
        "ellipsis-left",
        totalPages - 4,
        totalPages - 3,
        totalPages - 2,
        totalPages - 1,
        totalPages,
      ];
    }

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

  // ---------------- HELPERS ----------------
  const hasProfileImage = (partner) =>
    partner.profileImage &&
    partner.profileImage !== "null" &&
    partner.profileImage !== "undefined" &&
    partner.profileImage.trim() !== "";

  const getProfileImageUrl = (profileImage) => {
    if (!profileImage || profileImage.trim() === "") return null;
    if (profileImage.startsWith("http://") || profileImage.startsWith("https://")) {
      return profileImage;
    }
    const baseUrl = process.env.REACT_APP_API_BASE || "http://localhost:5000";
    const normalizedImage = profileImage.replace(/\\/g, "/");
    if (normalizedImage.startsWith("/")) return `${baseUrl}${normalizedImage}`;
    if (normalizedImage.startsWith("uploads/")) return `${baseUrl}/${normalizedImage}`;
    return `${baseUrl}/uploads/${normalizedImage}`;
  };

  const getAvatarInitial = (name) => name?.charAt(0)?.toUpperCase() || "P";

  const getAvatarColor = (name) => {
    const colors = [
      "bg-gradient-to-br from-blue-500 to-indigo-600",
      "bg-gradient-to-br from-emerald-500 to-teal-600",
      "bg-gradient-to-br from-violet-500 to-purple-600",
      "bg-gradient-to-br from-rose-500 to-pink-600",
      "bg-gradient-to-br from-amber-500 to-orange-600",
    ];
    const index =
      name?.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) %
      colors.length;
    return colors[index];
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "Approved":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "Rejected":
        return "bg-rose-50 text-rose-700 border-rose-200";
      default:
        return "bg-amber-50 text-amber-700 border-amber-200";
    }
  };

  const nextPage = () =>
    setCurrentPage((page) => Math.min(page + 1, totalPages));
  const prevPage = () => setCurrentPage((page) => Math.max(page - 1, 1));

  // ---------------- ACTIONS ----------------
  const handleConfirm = async () => {
    if (!confirmAction) return;
    setConfirmLoading(true);

    try {
      await axios.patch(
        `/api/partners/${confirmAction.type}/${confirmAction.partnerId}`,
      );

      setPartners((prev) =>
        prev.map((p) =>
          p._id === confirmAction.partnerId
            ? {
                ...p,
                status:
                  confirmAction.type === "approve" ? "Approved" : "Rejected",
              }
            : p,
        ),
      );
    } catch (err) {
      console.error(err);
    } finally {
      setConfirmLoading(false);
      setConfirmAction(null);
    }
  };

  const downloadPDF = () => {
    if (!selectedPartner) return;

    const doc = new jsPDF();
    doc.text("Partner Details", 20, 20);
    doc.text(`University: ${selectedPartner.universityName}`, 20, 35);
    doc.text(`Email: ${selectedPartner.email}`, 20, 45);
    doc.text(
      `Institution ID: ${selectedPartner.institutionId || "N/A"}`,
      20,
      55,
    );
    doc.text(`Status: ${selectedPartner.status || "Pending"}`, 20, 65);

    doc.save(`${selectedPartner.universityName}_Partner.pdf`);
  };

  // ---------------- LOADING ----------------
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 font-poppins">Loading partners...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="bg-white rounded-2xl p-8 shadow-lg max-w-md text-center">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AiOutlineCloseCircle className="text-2xl text-red-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 font-poppins mb-2">
            Error Loading Data
          </h2>
          <p className="text-gray-600 font-poppins">{error}</p>
        </div>
      </div>
    );
  }

  // ---------------- RENDER ----------------
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 font-poppins p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* HEADER */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 font-poppins">
            Partner Applications
          </h1>
          <p className="text-gray-600 mt-2 font-poppins">
            Review and manage partner onboarding requests
          </p>

          {/* STATS */}
          <div className="flex flex-wrap gap-4 mt-6">
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
              <p className="text-sm text-gray-600 font-poppins">
                Total Partners
              </p>
              <p className="text-2xl font-bold text-gray-900 font-poppins">
                {partners.length}
              </p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
              <p className="text-sm text-gray-600 font-poppins">
                Pending Review
              </p>
              <p className="text-2xl font-bold text-amber-600 font-poppins">
                {
                  partners.filter((p) => !p.status || p.status === "Pending")
                    .length
                }
              </p>
            </div>
          </div>
        </div>

        {/* SEARCH BAR */}
        <div className="mb-8">
          <div className="relative max-w-xl">
            <AiOutlineSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 text-xl" />
            {/*Add the "!mt-0" style for the alignment - 05-08-2026 */}
            <input
              type="text"
              name="partner_search_query"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              autoComplete="on"
              className="!mt-0 w-full pl-12 pr-4 py-3.5 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-poppins placeholder-gray-500 truncate"
            />
          </div>
        </div>

        {/* PARTNER GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {currentPartners.map((partner) => (
            <div
              key={partner._id}
              className="bg-white rounded-2xl shadow-sm border border-gray-200 hover:shadow-lg hover:border-gray-300 transition-all duration-300 overflow-hidden"
            >
              {/* Card Header */}
              <div className="p-6 pb-4">
                <div className="flex items-start gap-4">
                  {/* Avatar */}
                  <div className="flex-shrink-0">
                    {hasProfileImage(partner) ? (
                      <img
                        src={getProfileImageUrl(partner.profileImage)}
                        alt={partner.name}
                        className="w-14 h-14 rounded-xl object-cover border-4 border-white shadow-md"
                        onError={(e) => (e.target.style.display = "none")}
                      />
                    ) : (
                      <div
                        className={`w-14 h-14 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-md ${getAvatarColor(
                          partner.name,
                        )}`}
                      >
                        {getAvatarInitial(partner.universityName)}
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-gray-900 truncate font-poppins">
                      {partner.universityName}
                    </h3>
                    <p className="text-sm text-gray-600 truncate font-poppins flex items-center gap-1 mt-1">
                      <AiOutlineMail className="flex-shrink-0" />
                      <span className="truncate">{partner.email}</span>
                    </p>

                    {/* Status */}
                    <div className="mt-3">
                      <span
                        className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(
                          partner.status,
                        )} font-poppins`}
                      >
                        <div
                          className={`w-2 h-2 rounded-full mr-2 ${
                            partner.status === "Approved"
                              ? "bg-emerald-500"
                              : partner.status === "Rejected"
                                ? "bg-rose-500"
                                : "bg-amber-500"
                          }`}
                        ></div>
                        {partner.status || "Pending Review"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card Actions */}
              <div className="px-6 pb-6">
                <div className="space-y-3">
                  <button
                    onClick={() => {
                      setSelectedPartner(partner);
                      setIsModalOpen(true);
                    }}
                    className="w-full flex items-center justify-center gap-2 bg-gray-50 hover:bg-gray-100 text-gray-800 py-2.5 px-4 rounded-xl border border-gray-300 transition-all font-medium font-poppins"
                  >
                    <AiOutlineEye />
                    View Details
                  </button>

                  <div className="flex gap-2">
                    <button
                      disabled={partner.status === "Approved"}
                      onClick={() =>
                        setConfirmAction({
                          type: "approve",
                          partnerId: partner._id,
                        })
                      }
                      className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-medium transition-all font-poppins ${
                        partner.status === "Approved"
                          ? "bg-emerald-100 text-emerald-700 cursor-not-allowed"
                          : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                      }`}
                    >
                      <AiOutlineCheck className="text-base" />
                      Approve
                    </button>

                    <button
                      disabled={partner.status === "Rejected"}
                      onClick={() =>
                        setConfirmAction({
                          type: "reject",
                          partnerId: partner._id,
                        })
                      }
                      className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-medium transition-all font-poppins ${
                        partner.status === "Rejected"
                          ? "bg-rose-100 text-rose-700 cursor-not-allowed"
                          : "bg-rose-600 hover:bg-rose-700 text-white shadow-sm"
                      }`}
                    >
                      <AiOutlineCloseCircle className="text-base" />
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* NO RESULTS */}
        {filteredPartners.length === 0 && (
          <div className="text-center py-12">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AiOutlineSearch className="text-3xl text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 font-poppins mb-2">
              No partners found
            </h3>
            <p className="text-gray-600 font-poppins">
              {searchQuery
                ? "Try adjusting your search"
                : "No partner applications available"}
            </p>
          </div>
        )}

        {/* PAGINATION */}
        {filteredPartners.length > itemsPerPage && (
          <div className="mt-8 border-t border-gray-200 pt-6">
            <div className="flex justify-center">
              <div className="inline-flex w-full sm:w-auto items-center justify-center gap-1.5 rounded-2xl border border-slate-200/80 bg-white/95 p-1.5 shadow-[0_14px_30px_-18px_rgba(15,23,42,0.35)]">
                <button
                  onClick={prevPage}
                  disabled={currentPage === 1}
                  className={`inline-flex h-10 items-center justify-center gap-2 rounded-xl border px-3 sm:px-4 text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 ${
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
                        className={`flex h-10 min-w-[2.5rem] items-center justify-center rounded-xl px-3 text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 ${
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
                  className={`inline-flex h-10 items-center justify-center gap-2 rounded-xl border px-3 sm:px-4 text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 ${
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
      </div>

      {/* DETAILS MODAL */}
      {isModalOpen && selectedPartner && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          {/*Remove overflow-hidden add "flex flex-col" for scrolling purpose in mobile view - 05-08-2026*/}
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] flex flex-col shadow-2xl animate-fadeIn">
            {/* Modal Header */}
            {/*Add the flex-shrink-0 for fixed position in scrolling in the mobile view - 05-08-2026 */}
            <div className="p-6 border-b border-gray-200 flex-shrink-0">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-900 font-poppins">
                  Partner Details
                </h3>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  &times;
                </button>
              </div>
            </div>

            {/* Modal Content */}
            {/*Add the flex-1 for scrolling the content in mobile view - 05-06-2026 */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Avatar & Name */}
              <div className="text-center">
                {hasProfileImage(selectedPartner) ? (
                  <img
                    src={getProfileImageUrl(selectedPartner.profileImage)}
                    alt={selectedPartner.name}
                    className="w-24 h-24 rounded-2xl object-cover border-4 border-white shadow-lg mx-auto"
                  />
                ) : (
                  <div
                    className={`w-24 h-24 rounded-2xl flex items-center justify-center text-white text-3xl font-bold mx-auto shadow-lg ${getAvatarColor(
                      selectedPartner.name,
                    )}`}
                  >
                    {getAvatarInitial(selectedPartner.universityName)}
                  </div>
                )}

                <h3 className="text-2xl font-bold mt-4 text-gray-900 font-poppins">
                  {selectedPartner.universityName}
                </h3>
                <span
                  className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium mt-2 ${getStatusColor(
                    selectedPartner.status,
                  )} font-poppins`}
                >
                  {selectedPartner.status || "Pending Review"}
                </span>
              </div>

              {/* Details Grid */}
              <div className="space-y-4">
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="flex items-center gap-3 text-gray-600 mb-1">
                    <AiOutlineMail className="text-lg" />
                    <span className="text-sm font-medium font-poppins">
                      Email Address
                    </span>
                  </div>
                  <p className="text-gray-900 font-poppins pl-8">
                    {selectedPartner.email}
                  </p>
                </div>

                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="flex items-center gap-3 text-gray-600 mb-1">
                    <AiOutlineIdcard className="text-lg" />
                    <span className="text-sm font-medium font-poppins">
                      Institution ID
                    </span>
                  </div>
                  <p className="text-gray-900 font-poppins pl-8">
                    {selectedPartner.institutionId || "Not provided"}
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            {/*Add the flex-shrink-0 for fixed position in scrolling in the mobile view - 05-08-2026  */}
            <div className="border-t border-gray-200 p-6 bg-gray-50  flex-shrink-0">
              <div className="flex gap-3">
                <button
                  onClick={downloadPDF}
                  className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-xl font-medium transition-all font-poppins"
                >
                  <AiOutlineFilePdf className="text-lg" />
                  Download PDF
                </button>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-3 px-4 rounded-xl font-medium transition-all font-poppins"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM MODAL */}
      {confirmAction && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl animate-fadeIn">
            <div className="p-8 text-center">
              <div
                className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 ${
                  confirmAction.type === "approve"
                    ? "bg-emerald-100"
                    : "bg-rose-100"
                }`}
              >
                {confirmAction.type === "approve" ? (
                  <AiOutlineCheck className="text-3xl text-emerald-600" />
                ) : (
                  <AiOutlineCloseCircle className="text-3xl text-rose-600" />
                )}
              </div>

              <h3 className="text-xl font-bold text-gray-900 mb-3 font-poppins">
                Confirm{" "}
                {confirmAction.type === "approve" ? "Approval" : "Rejection"}
              </h3>

              <p className="text-gray-600 mb-8 font-poppins">
                Are you sure you want to {confirmAction.type} this partner
                application? This action cannot be undone.
              </p>

              <div className="flex gap-3">
                <button
                  onClick={handleConfirm}
                  disabled={confirmLoading}
                  className={`flex-1 py-3 rounded-xl font-medium transition-all font-poppins ${
                    confirmAction.type === "approve"
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                      : "bg-rose-600 hover:bg-rose-700 text-white"
                  } disabled:opacity-50`}
                >
                  {confirmLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Processing...
                    </span>
                  ) : (
                    "Yes, Continue"
                  )}
                </button>

                <button
                  onClick={() => setConfirmAction(null)}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-3 rounded-xl font-medium transition-all font-poppins"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PartnerManagement;
