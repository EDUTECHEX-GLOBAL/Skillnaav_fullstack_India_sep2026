import React, { useState, useEffect } from "react";
import axios from "../../../../api/axiosInstance";
import { toast } from "react-toastify";

const BulkSendOffer = ({ selectedStudents: rawStudents, internshipId, onCancel, onSuccess }) => {
  // Guard: filter out any undefined/null entries that .find() may have injected
  const selectedStudents = (rawStudents || []).filter(Boolean);

  const [joiningDate, setJoiningDate] = useState("");
  const [position, setPosition] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState(null);
  const [internship, setInternship] = useState(null);
  const partnerId = localStorage.getItem("partnerId");

  useEffect(() => {
    const fetchInternship = async () => {
      try {
        const res = await axios.get(`/api/interns/${internshipId}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        });
        const data = res.data;
        setInternship(data);
        setPosition(data.jobTitle || "");
        setJoiningDate(data.startDate ? new Date(data.startDate).toISOString().split("T")[0] : "");
      } catch (err) {
        console.error("Error loading internship:", err);
      }
    };
    fetchInternship();
  }, [internshipId]);

  const getValidSchoolAdminId = () => {
    const raw = localStorage.getItem("schoolAdminId");
    return raw && /^[a-f\d]{24}$/i.test(raw) ? raw : null;
  };

  const sendOfferToStudent = async (student) => {
    if (!student || !student.student_id || !student.email) {
      console.warn("Skipping invalid student entry:", student);
      return;
    }
    await axios.post(
      "/api/offer-letters",
      {
        partnerId,
        student_id: student.student_id,
        name: student.name,
        email: student.email,
        internshipId,
        position,
        startDate: joiningDate,
        company: internship?.companyName,
        location: internship?.location,
        duration: internship?.duration || internship?.endDateOrDuration,
        internshipType: internship?.internshipType,
        compensationDetails: internship?.compensationDetails,
        jobDescription: internship?.jobDescription,
        qualifications: Array.isArray(internship?.qualifications)
          ? internship.qualifications
          : (internship?.qualifications || "").split(",").map((q) => q.trim()).filter(Boolean),
        // contactInfo resolved on backend from internship document
        contactInfo: {
          name:  internship?.contactInfo?.name  || "",
          email: internship?.contactInfo?.email || "",
          phone: internship?.contactInfo?.phone || "",
        },
    
      },
      { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
    );
  };

  const handleSendBulk = async () => {
    if (!joiningDate) {
      setError("Please select a joining date");
      return;
    }
    setIsSending(true);
    setError(null);

    const validStudents = selectedStudents.filter((s) => s && s.student_id && s.email);
    const results = await Promise.allSettled(validStudents.map((s) => sendOfferToStudent(s)));

    const succeeded  = results.filter((r) => r.status === "fulfilled").length;
    const failedCount = results.filter((r) => r.status === "rejected").length;

    if (failedCount === 0) {
      toast.success(`All ${succeeded} offer letter${succeeded !== 1 ? "s" : ""} sent successfully!`);
      if (onSuccess) onSuccess(validStudents);
    } else if (succeeded > 0) {
      toast.warn(`${succeeded} sent, ${failedCount} failed. Please retry the failed ones.`);
      setError(`${failedCount} offer(s) failed to send. The rest were sent successfully.`);
      const failedIndexes = new Set(
        results.map((r, i) => (r.status === "rejected" ? i : -1)).filter((i) => i >= 0)
      );
      const succeededStudents = validStudents.filter((_, i) => !failedIndexes.has(i));
      if (onSuccess) onSuccess(succeededStudents);
    } else {
      toast.error("All offer letters failed to send.");
      setError("Failed to send offer letters. Please try again.");
    }

    setIsSending(false);
  };

  return (
    <div>
      {/* Sending to N students */}
      <div className="mb-4 p-3 bg-blue-50 border border-blue-100 rounded-lg">
        <p className="text-sm text-blue-700 font-medium">
          Sending offer letters to{" "}
          <span className="font-bold">{selectedStudents.length}</span> student
          {selectedStudents.length !== 1 ? "s" : ""}
        </p>
        <p className="text-xs text-blue-500 mt-0.5">
          Offer PDF will include SkillNaav + your company logo automatically.
        </p>
      </div>

      {/* Position */}
      <div className="mb-4">
        <label className="block font-semibold mb-1 text-sm text-gray-700">Position</label>
        <input
          type="text"
          value={position}
          onChange={(e) => setPosition(e.target.value)}
          className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
      </div>

      {/* Joining Date */}
      <div className="mb-4">
        <label className="block font-semibold mb-1 text-sm text-gray-700">
          Joining Date <span className="text-red-500">*</span>
        </label>
        <input
          type="date"
          value={joiningDate}
          onChange={(e) => setJoiningDate(e.target.value)}
          className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          min={new Date().toISOString().split("T")[0]}
        />
      </div>

      {error && <div className="text-red-600 mb-4 text-sm bg-red-50 p-2 rounded">{error}</div>}

      <div className="flex justify-end gap-3">
        <button
          onClick={onCancel}
          disabled={isSending}
          className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-100 text-sm"
        >
          Cancel
        </button>
        <button
          onClick={handleSendBulk}
          disabled={isSending || !joiningDate}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center disabled:opacity-50 text-sm"
        >
          {isSending ? "Sending..." : `Send ${selectedStudents.length} Offer${selectedStudents.length !== 1 ? "s" : ""}`}
        </button>
      </div>
    </div>
  );
};

export default BulkSendOffer;