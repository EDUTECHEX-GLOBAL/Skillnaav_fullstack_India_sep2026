import React, { useEffect, useState } from "react";
import axios from "../../../../api/axiosInstance";
import { toast } from "react-toastify";

const TimeSlotsSelected = ({ internshipId }) => {
    const [loading, setLoading] = useState(true);
    const [acceptedStudents, setAcceptedStudents] = useState([]);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!internshipId) return;

        const fetchAcceptedStudents = async () => {
            setLoading(true);
            setError("");

            try {
                // ✅ This endpoint must return accepted offers for that internship
                const { data } = await axios.get(
                    `/api/offer-letters/accepted/${internshipId}`,
                    { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
                );

                // Support multiple response shapes safely
                const list =
                    data?.accepted ||          // ✅ matches your backend response { accepted: [...] }
                    data?.acceptedOffers ||
                    data?.offers ||
                    data?.offerLetters ||
                    data?.data ||
                    (Array.isArray(data) ? data : []);

                const normalized = (Array.isArray(list) ? list : []).map((o) => ({
                    name:
                        o?.name ||
                        o?.studentName ||
                        o?.student?.name ||
                        o?.student_id?.name ||
                        "-",
                    email:
                        o?.email ||
                        o?.studentEmail ||
                        o?.student?.email ||
                        o?.student_id?.email ||
                        "-",
                    acceptedAt: o?.acceptedAt || o?.updatedAt || o?.createdAt || null,
                    status: o?.status || o?.offerStatus || "Accepted",

                    // ✅ ADD THIS (Time slot selected by student)
                    timeSlot: (
                        o?.preferredTimeSlot ||
                        o?.selectedTimeSlot ||   // ✅ backward support (if any old data exists)
                        o?.timeSlot ||
                        ""
                    ).toString().trim() || "Not selected",
                }));

                setAcceptedStudents(normalized);
            } catch (err) {
                console.error("Failed to fetch accepted students:", err);
                const msg =
                    err.response?.data?.message ||
                    err.response?.data?.error ||
                    "Failed to load accepted students";
                setError(msg);
                setAcceptedStudents([]);
                toast.error(msg);
            } finally {
                setLoading(false);
            }
        };

        fetchAcceptedStudents();
    }, [internshipId]);

    if (loading) {
        return <p className="p-6 text-center text-gray-600">Loading accepted students...</p>;
    }

    if (error) {
        return <p className="p-6 text-center text-red-600">{error}</p>;
    }

    if (acceptedStudents.length === 0) {
        return <p className="p-6 text-center text-gray-600">No students accepted the offer yet.</p>;
    }

    return (
        <div className="p-4">
            <div className="overflow-x-auto">
                <table className="min-w-full border border-gray-200">
                    <thead className="bg-gray-100">
                        <tr>
                            <th className="text-left p-3 border-b">Student Name</th>
                            <th className="text-left p-3 border-b">Email</th>
                            <th className="text-left p-3 border-b">Status</th>
                            <th className="text-left p-3 border-b">Time Slot</th>
                            <th className="text-left p-3 border-b">Accepted Date</th>
                        </tr>
                    </thead>
                    <tbody>
                        {acceptedStudents.map((s, idx) => (
                            <tr key={idx} className="border-b">
                                <td className="p-3">{s.name}</td>
                                <td className="p-3">{s.email}</td>

                                <td className="p-3">
                                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                        {s.status}
                                    </span>
                                </td>

                                <td className="p-3">{s.timeSlot}</td>

                                <td className="p-3">
                                    {s.acceptedAt ? new Date(s.acceptedAt).toLocaleString() : "-"}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default TimeSlotsSelected;