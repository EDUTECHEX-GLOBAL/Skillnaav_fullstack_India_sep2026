// SchoolAdminAccounts.js
import React, { useState, useEffect } from "react";
import jsPDF from "jspdf";
import axios from "../../../../api/axiosInstance";
import { AiOutlineLeft, AiOutlineRight } from "react-icons/ai";


const SchoolAdminAccounts = () => {
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedAdmin, setSelectedAdmin] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const fetchAdmins = async () => {
      try {
        const response = await axios.get("/api/school-admin/schooladmins");
        const adminsWithStatus = response.data.map((admin) => ({
          ...admin,
          status: admin.isApproved ? "Approved" : "Pending",
          ...admin.profile // assuming profile fields (affiliation, contactPhone, etc.) are inside profile object
        }));
        setAdmins(adminsWithStatus);
        setLoading(false);
      } catch (err) {
        setError("Failed to fetch school admins.");
        setLoading(false);
      }
    };

    fetchAdmins();
  }, []);


  const filteredAdmins = admins.filter((admin) =>
    admin.schoolName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    admin.contactEmail.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleApprove = async () => {
    try {
      await axios.patch(`/api/school-admin/approve/${confirmAction.adminId}`);

      setAdmins((prev) =>
        prev.map((admin) =>
          admin._id === confirmAction.adminId ? { ...admin, status: "Approved" } : admin
        )
      );
      setConfirmAction(null);
    } catch (err) {
      alert("Approval failed.");
    }
  };


  const handleReject = async () => {
    try {
      await axios.patch(`/api/school-admin/reject/${confirmAction.adminId}`);
      setAdmins((prev) =>
        prev.map((admin) =>
          admin._id === confirmAction.adminId ? { ...admin, status: "Rejected" } : admin
        )
      );
      setConfirmAction(null);
    } catch (err) {
      alert("Rejection failed.");
    }
  };


  const confirmActionHandler = () => {
    if (confirmAction.type === "approve") handleApprove();
    else handleReject();
  };

  const openModal = (admin) => {
    setSelectedAdmin(admin);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setSelectedAdmin(null);
    setIsModalOpen(false);
  };

  const openConfirmationModal = (adminId, type) => {
    setConfirmAction({ adminId, type });
  };

  const downloadPDF = () => {
    const doc = new jsPDF();
    doc.text("School Admin Details", 10, 10);
    doc.text(`School Name: ${selectedAdmin.schoolName}`, 10, 20);
    doc.text(`Email: ${selectedAdmin.contactEmail}`, 10, 30);
    doc.text(`Phone: ${selectedAdmin.contactPhone}`, 10, 40);
    doc.text(`City: ${selectedAdmin.city}`, 10, 50);
    doc.text(`State: ${selectedAdmin.state}`, 10, 60);
    doc.text(`Country: ${selectedAdmin.country}`, 10, 70);
    doc.text(`Status: ${selectedAdmin.status}`, 10, 80);
    doc.save(`${selectedAdmin.schoolName}_Details.pdf`);
  };

  const indexOfLast = currentPage * itemsPerPage;
  const indexOfFirst = indexOfLast - itemsPerPage;
  const currentAdmins = filteredAdmins.slice(indexOfFirst, indexOfLast);
  const totalPages = Math.ceil(filteredAdmins.length / itemsPerPage);

  const getPaginationItems = () => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    if (currentPage <= 4) {
      return [1, 2, 3, 4, 5, "ellipsis-right", totalPages];
    }

    if (currentPage >= totalPages - 3) {
      return [1, "ellipsis-left", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }

    return [1, "ellipsis-left", currentPage - 1, currentPage, currentPage + 1, "ellipsis-right", totalPages];
  };

  const nextPage = () => setCurrentPage((page) => Math.min(page + 1, totalPages));
  const prevPage = () => setCurrentPage((page) => Math.max(page - 1, 1));

  const handleSearch = (e) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1);
  };

  if (loading) return <div className="text-center py-20">Loading...</div>;
  if (error) return <div className="text-center text-red-500">Error: {error}</div>;

  return (
    <div className="p-6 bg-white rounded-lg shadow-lg max-w-6xl mx-auto font-poppins">
      <h2 className="text-3xl font-bold text-center text-blue-700 mb-6">School Admin Accounts for Approval</h2>

      <input
        type="text"
        value={searchQuery}
        onChange={handleSearch}
        placeholder="Search by School Name or Email"
        className="w-full p-3 border border-gray-300 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-blue-400"
      />

      <div className="overflow-x-auto shadow-md rounded-lg">
        <table className="w-full table-auto border-collapse whitespace-nowrap min-w-max">
          <thead className="bg-blue-100 text-left">
            <tr>
              <th className="px-4 py-3 font-semibold text-gray-700">S.No</th>
              <th className="px-4 py-3 font-semibold text-gray-700">School Name</th>
              <th className="px-4 py-3 font-semibold text-gray-700">Email</th>
              <th className="px-4 py-3 font-semibold text-gray-700">Status</th>
              <th className="px-4 py-3 font-semibold text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody>
            {currentAdmins.map((admin, idx) => (
              <tr key={admin._id} className="text-sm border-t hover:bg-gray-50">
                <td className="px-4 py-3">{indexOfFirst + idx + 1}</td>
                <td className="px-4 py-3 font-medium">{admin.schoolName}</td>
                <td className="px-4 py-3">{admin.email}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${admin.status === 'Approved' ? 'bg-green-100 text-green-600' : admin.status === 'Rejected' ? 'bg-red-100 text-red-600' : 'bg-yellow-100 text-yellow-600'}`}>
                    {admin.status}
                  </span>
                </td>
                <td className="px-4 py-3 space-x-2">
                  <button className="text-blue-600 hover:underline" onClick={() => openModal(admin)}>Details</button>
                  <button className="text-green-600 hover:underline" disabled={admin.status === 'Approved'} onClick={() => openConfirmationModal(admin._id, 'approve')}>Approve</button>
                  <button className="text-red-600 hover:underline" disabled={admin.status === 'Rejected'} onClick={() => openConfirmationModal(admin._id, 'reject')}>Reject</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredAdmins.length > itemsPerPage && (
        <div className="mt-6 flex justify-center">
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
      )}

      {isModalOpen && selectedAdmin && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl px-8 py-6 max-h-[90vh] overflow-y-auto font-poppins">

            {/* Modal Header */}
            <div className="mb-6">
              <h2 className="text-3xl font-semibold text-center text-blue-700">
                School Admin Details
              </h2>
              <p className="text-sm text-center text-gray-500 mt-1">
                Full profile submitted for verification
              </p>
            </div>

            {/* Modal Body */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm text-gray-800">
              <div>
                <label className="font-semibold block">School Name</label>
                <p>{selectedAdmin.schoolName}</p>
              </div>
              <div>
                <label className="font-semibold block">Affiliation</label>
                <p>{selectedAdmin.affiliation}</p>
              </div>
              <div>
                <label className="font-semibold block">Address</label>
                <p>{selectedAdmin.address}</p>
              </div>
              <div>
                <label className="font-semibold block">City</label>
                <p>{selectedAdmin.city}</p>
              </div>
              <div>
                <label className="font-semibold block">State</label>
                <p>{selectedAdmin.state}</p>
              </div>
              <div>
                <label className="font-semibold block">Postal Code</label>
                <p>{selectedAdmin.postalCode}</p>
              </div>
              <div>
                <label className="font-semibold block">Country</label>
                <p>{selectedAdmin.country}</p>
              </div>
              <div>
                <label className="font-semibold block">Website</label>
                <a
                  href={selectedAdmin.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 underline"
                >
                  {selectedAdmin.website || "N/A"}
                </a>
              </div>
              <div>
                <label className="font-semibold block">Contact Person</label>
                <p>{selectedAdmin.contactPerson}</p>
              </div>
              <div>
                <label className="font-semibold block">Email</label>
                <p>{selectedAdmin.contactEmail}</p>
              </div>
              <div>
                <label className="font-semibold block">Phone</label>
                <p>{selectedAdmin.contactPhone}</p>
              </div>
              <div>
                <label className="font-semibold block">Status</label>
                <span className={`inline-block px-2 py-1 text-xs rounded-full font-semibold ${selectedAdmin.status === "Approved"
                    ? "bg-green-100 text-green-700"
                    : selectedAdmin.status === "Rejected"
                      ? "bg-red-100 text-red-700"
                      : "bg-yellow-100 text-yellow-700"
                  }`}>
                  {selectedAdmin.status}
                </span>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end mt-8 gap-4">
              <button
                className="bg-blue-600 text-white px-5 py-2 rounded-md hover:bg-blue-700 transition duration-200"
                onClick={downloadPDF}
              >
                Download PDF
              </button>
              <button
                className="bg-gray-200 text-gray-800 px-5 py-2 rounded-md hover:bg-gray-300 transition duration-200"
                onClick={closeModal}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmAction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md text-center">
            <h3 className="text-lg font-bold mb-4">Confirm {confirmAction.type}?</h3>
            <button className="bg-green-500 text-white px-4 py-2 rounded mr-2" onClick={confirmActionHandler}>Yes</button>
            <button className="bg-gray-300 text-black px-4 py-2 rounded" onClick={() => setConfirmAction(null)}>No</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SchoolAdminAccounts;
