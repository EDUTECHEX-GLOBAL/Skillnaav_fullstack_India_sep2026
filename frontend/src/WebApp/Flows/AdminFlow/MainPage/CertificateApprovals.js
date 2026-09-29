import React, { useState, useEffect } from "react";
import axios from "../../../../api/axiosInstance";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  XCircle,
  Search,
  FileBadge,
  Eye,
  X,
  Building2,
  Mail,
  User,
} from "lucide-react";
import { toast } from "react-toastify";

const CertificateApprovals = () => {
  const [certificates, setCertificates] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedImage, setSelectedImage] = useState(null);
  const [actionModal, setActionModal] = useState({
    isOpen: false,
    type: "",
    certId: null,
  });
  const [adminRemarks, setAdminRemarks] = useState("");

  useEffect(() => {
    fetchCertificates();
  }, []);

  const fetchCertificates = async () => {
    try {
      setIsLoading(true);
      const res = await axios.get("/api/admin/certificates");
      setCertificates(res.data.items || []);
    } catch (err) {
      console.error("Error fetching certificates", err);
      toast.error("Failed to load certificates");
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusUpdate = async () => {
    if (actionModal.type === "Rejected" && !adminRemarks.trim()) {
      toast.error("Please provide a reason for rejection.");
      return;
    }

    try {
      await axios.put(`/api/admin/certificates/${actionModal.certId}/status`, {
        status: actionModal.type,
        adminRemarks: actionModal.type === "Rejected" ? adminRemarks : "",
      });
      toast.success(
        `Certificate ${actionModal.type.toLowerCase()} successfully`,
      );
      setActionModal({ isOpen: false, type: "", certId: null });
      setAdminRemarks("");
      fetchCertificates();
    } catch (err) {
      console.error("Error updating status", err);
      toast.error("Failed to update status");
    }
  };

  const filteredCerts = certificates.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.partnerId?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.partnerId?.universityName
        ?.toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      c.partnerId?.email?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            Certificate Approvals
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Review custom internship certificates uploaded by partners.
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            size={18}
          />
          {/*Add the "!mt-0" for alignment - 05-08-2026 */}
          <input
            type="text"
            placeholder="Search by name or company..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="!mt-0 w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
        </div>
      ) : filteredCerts.length === 0 ? (
        <div className="bg-white rounded-2xl p-16 text-center shadow-sm border border-slate-100">
          <FileBadge className="mx-auto h-16 w-16 text-slate-300 mb-4" />
          <h3 className="text-lg font-medium text-slate-900">
            No certificates found
          </h3>
          <p className="text-sm text-slate-500 mt-1">
            There are no templates matching your criteria.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCerts.map((cert) => (
            <div
              key={cert._id}
              className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-shadow"
            >
              <div
                className="h-48 bg-slate-100 relative cursor-pointer group"
                onClick={() => setSelectedImage(cert.imageUrl)}
              >
                <img
                  src={cert.imageUrl}
                  alt={cert.name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <span className="text-white bg-black/40 px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 backdrop-blur-sm">
                    <Eye size={16} /> View Image
                  </span>
                </div>
                <div className="absolute top-3 right-3">
                  {cert.status === "Approved" && (
                    <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2 py-1 rounded-md shadow-sm">
                      Approved
                    </span>
                  )}
                  {cert.status === "Rejected" && (
                    <span className="bg-rose-100 text-rose-800 text-xs font-bold px-2 py-1 rounded-md shadow-sm">
                      Rejected
                    </span>
                  )}
                  {cert.status === "Pending" && (
                    <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2 py-1 rounded-md shadow-sm">
                      Pending
                    </span>
                  )}
                </div>
              </div>

              <div className="p-5 flex-1 flex flex-col">
                <h3
                  className="font-bold text-slate-800 truncate"
                  title={cert.name}
                >
                  {cert.name}
                </h3>

                {/* Partner Info Block */}
                <div className="mt-3 flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                  {/* Avatar */}
                  {cert.partnerId?.logoUrl ? (
                    <img
                      src={cert.partnerId.logoUrl}
                      alt={cert.partnerId.name}
                      className="w-10 h-10 rounded-full object-cover border border-slate-200 shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center text-white font-bold text-sm shrink-0 border-2 border-white shadow">
                      {cert.partnerId?.name?.charAt(0)?.toUpperCase() || (
                        <User size={16} />
                      )}
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    {/* Partner Name */}
                    <p className="text-sm font-bold text-slate-800 truncate flex items-center gap-1">
                      <User size={12} className="text-indigo-400 shrink-0" />
                      {cert.partnerId?.name || "Unknown Partner"}
                    </p>

                    {/* Institution */}
                    {cert.partnerId?.universityName && (
                      <p className="text-xs text-slate-500 truncate flex items-center gap-1 mt-0.5">
                        <Building2
                          size={11}
                          className="text-slate-400 shrink-0"
                        />
                        {cert.partnerId.universityName}
                      </p>
                    )}

                    {/* Email */}
                    {cert.partnerId?.email && (
                      <p className="text-xs text-slate-400 truncate flex items-center gap-1 mt-0.5">
                        <Mail size={11} className="text-slate-400 shrink-0" />
                        {cert.partnerId.email}
                      </p>
                    )}
                  </div>
                </div>

                <p className="text-xs text-slate-400 mt-2">
                  {new Date(cert.createdAt).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </p>

                {cert.status === "Rejected" && cert.adminRemarks && (
                  <div className="mt-3 bg-rose-50 p-2.5 rounded-lg border border-rose-100">
                    <p className="text-xs font-semibold text-rose-800">
                      Remarks:
                    </p>
                    <p className="text-xs text-rose-600 line-clamp-2">
                      {cert.adminRemarks}
                    </p>
                  </div>
                )}

                <div className="mt-auto pt-5 flex gap-3">
                  {cert.status !== "Approved" && (
                    <button
                      onClick={() =>
                        setActionModal({
                          isOpen: true,
                          type: "Approved",
                          certId: cert._id,
                        })
                      }
                      className="flex-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 py-2 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-1.5"
                    >
                      <CheckCircle2 size={16} /> Approve
                    </button>
                  )}
                  {cert.status !== "Rejected" && (
                    <button
                      onClick={() =>
                        setActionModal({
                          isOpen: true,
                          type: "Rejected",
                          certId: cert._id,
                        })
                      }
                      className="flex-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 py-2 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-1.5"
                    >
                      <XCircle size={16} /> Reject
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Action Modal */}
      <AnimatePresence>
        {actionModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden"
            >
              <div
                className={`p-5 border-b ${actionModal.type === "Approved" ? "bg-emerald-50 border-emerald-100" : "bg-rose-50 border-rose-100"}`}
              >
                <h3
                  className={`text-lg font-bold flex items-center gap-2 ${actionModal.type === "Approved" ? "text-emerald-800" : "text-rose-800"}`}
                >
                  {actionModal.type === "Approved" ? (
                    <CheckCircle2 />
                  ) : (
                    <XCircle />
                  )}
                  {actionModal.type === "Approved"
                    ? "Approve Certificate"
                    : "Reject Certificate"}
                </h3>
              </div>
              <div className="p-5 space-y-4">
                <p className="text-sm text-slate-600">
                  Are you sure you want to mark this certificate as{" "}
                  <strong
                    className={
                      actionModal.type === "Approved"
                        ? "text-emerald-600"
                        : "text-rose-600"
                    }
                  >
                    {actionModal.type}
                  </strong>
                  ?
                </p>
                {actionModal.type === "Rejected" && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Reason for Rejection *
                    </label>
                    <textarea
                      value={adminRemarks}
                      onChange={(e) => setAdminRemarks(e.target.value)}
                      placeholder="e.g. SkillNaav logo is missing or incorrect size."
                      className="w-full border border-slate-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-rose-200 focus:border-rose-400 outline-none resize-none h-24 bg-slate-50"
                    />
                  </div>
                )}
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => {
                      setActionModal({ isOpen: false, type: "", certId: null });
                      setAdminRemarks("");
                    }}
                    className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl font-medium hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleStatusUpdate}
                    className={`flex-1 px-4 py-2.5 text-white rounded-xl font-medium transition-colors ${actionModal.type === "Approved" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"}`}
                  >
                    Confirm {actionModal.type}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Lightbox */}
      <AnimatePresence>
        {selectedImage && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm"
            onClick={() => setSelectedImage(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative max-w-5xl max-h-[90vh] w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setSelectedImage(null)}
                className="absolute -top-4 -right-4 bg-white text-slate-800 rounded-full p-2 shadow-lg hover:bg-slate-100 z-10"
              >
                <X size={20} />
              </button>
              <img
                src={selectedImage}
                alt="Certificate Preview"
                className="w-full h-auto max-h-[85vh] object-contain rounded-lg shadow-2xl bg-white"
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CertificateApprovals;