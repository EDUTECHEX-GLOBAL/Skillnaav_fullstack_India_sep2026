// File: OfferLetter.js
import React, { useState, useEffect } from "react";
import axios from "../../../../api/axiosInstance";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPaperPlane, faSpinner, faTimes } from "@fortawesome/free-solid-svg-icons";
import { toast } from "react-toastify";

const SendOfferLetter = ({ student, internshipId, onSuccess, onCancel }) => {
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState(null);
  const [internship, setInternship] = useState(null);
  const [joiningDate, setJoiningDate] = useState("");
  const [position, setPosition] = useState("");

  const partnerId = localStorage.getItem("partnerId");

  useEffect(() => {
    const fetchInternship = async () => {
      try {
        const response = await axios.get(`/api/interns/${internshipId}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        });
        const data = response.data;
        setInternship(data);
        setPosition(data.jobTitle || "");
        setJoiningDate(
          data.startDate ? new Date(data.startDate).toISOString().split("T")[0] : ""
        );
      } catch (err) {
        console.error("Error fetching internship:", err);
        setError(err.response?.data?.message || "Failed to load internship details");
      }
    };
    if (internshipId) fetchInternship();
  }, [internshipId]);

  const handleSendOffer = async () => {
    try {
      setIsSending(true);
      setError(null);

      if (!student || !joiningDate || !internship) {
        throw new Error("Please fill in all required fields");
      }

      const response = await axios.post(
        "/api/offer-letters",
        {
          partnerId,
          student_id: student._id,
          name: student.name,
          email: student.email,
          internshipId,
          position,
          startDate: joiningDate,
          company: internship.companyName,
          location: internship.location,
          duration: internship.duration || internship.endDateOrDuration,
          internshipType: internship.internshipType,
          compensationDetails: internship.compensationDetails,
          jobDescription: internship.jobDescription,
          qualifications: Array.isArray(internship.qualifications)
            ? internship.qualifications
            : (internship.qualifications || "").split(",").map((q) => q.trim()).filter(Boolean),
          contactInfo: {
            name:  internship.contactInfo?.name  || "",
            email: internship.contactInfo?.email || "",
            phone: internship.contactInfo?.phone || "",
          },
         
        },
        { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
      );

      toast.success("Offer sent successfully!");
      if (onSuccess) onSuccess(response.data);
    } catch (err) {
      const msg = err.response?.data?.error || err.message || "Failed to send offer letter";
      setError(msg);
      toast.error(msg);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <h4 className="font-semibold text-lg">Send Offer Letter</h4>
        <button onClick={onCancel} className="text-gray-500 hover:text-gray-700">
          <FontAwesomeIcon icon={faTimes} />
        </button>
      </div>

      {error && (
        <div className="text-red-500 mb-4 p-2 bg-red-50 rounded text-sm">{error}</div>
      )}

      {!internship ? (
        <div className="flex items-center justify-center p-4 text-gray-500 text-sm">
          <FontAwesomeIcon icon={faSpinner} spin className="mr-2" />
          Loading internship details...
        </div>
      ) : (
        <>
          {/* Internship Summary */}
          <div className="mb-4 bg-blue-50 p-3 rounded text-sm">
            <p className="font-medium">{internship.jobTitle}</p>
            <p className="text-gray-600">Company: {internship.companyName}</p>
            <p className="text-gray-600">Location: {internship.location}</p>
            <p className="text-gray-600">Duration: {internship.duration || internship.endDateOrDuration}</p>
          </div>

          {/* Candidate Info */}
          <div className="mb-4 bg-gray-50 p-3 rounded text-sm">
            <p className="font-medium">Candidate: {student.name}</p>
            <p className="text-gray-600">Email: {student.email}</p>
          </div>

          {/* PDF Logo Preview */}
          <div className="mb-4 flex items-center gap-3 p-3 bg-indigo-50 border border-indigo-100 rounded-lg">
            <div className="w-8 h-8 rounded bg-blue-600 flex items-center justify-center">
              <span className="text-white text-[10px] font-bold">SN</span>
            </div>
            <span className="text-xs text-indigo-600 font-medium">SkillNaav</span>
            <span className="text-gray-300">+</span>
            <span className="text-xs text-gray-600 font-medium">{internship.companyName}</span>
            <span className="ml-auto text-[11px] text-indigo-400">logos on PDF</span>
          </div>

          {/* Form */}
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Position</label>
              <input
                type="text"
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                className="w-full border px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Joining Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={joiningDate}
                onChange={(e) => setJoiningDate(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
                className="w-full border px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={onCancel}
              disabled={isSending}
              className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-100 disabled:opacity-50 text-sm"
            >
              Back to List
            </button>
            <button
              onClick={handleSendOffer}
              disabled={isSending || !joiningDate}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 flex items-center text-sm"
            >
              {isSending ? (
                <>
                  <FontAwesomeIcon icon={faSpinner} spin className="mr-2" />
                  Sending...
                </>
              ) : (
                <>
                  <FontAwesomeIcon icon={faPaperPlane} className="mr-2" />
                  Send Offer
                </>
              )}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default SendOfferLetter;