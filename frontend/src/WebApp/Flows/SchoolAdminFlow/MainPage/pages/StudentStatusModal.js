import React, { useEffect, useState } from 'react';
import axios from "../../../../../api/axiosInstance";

// Helper: convert milliseconds to "Xh Xm Xs"
const formatDuration = (ms) => {
  const h = Math.floor(ms / (1000 * 60 * 60));
  const m = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  const s = Math.floor((ms % (1000 * 60)) / 1000);
  return `${h}h ${m}m ${s}s`;
};

const StudentStatusModal = ({ student, onClose }) => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSessionHistory = async () => {
      try {
       const token = localStorage.getItem('schoolAdminToken'); // ✅ make sure it matches

        const res = await axios.get(`/api/sessions/students/${student._id}/sessions`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        setHistory(res.data);
      } catch (error) {
        console.error('Error fetching session history:', error);
      } finally {
        setLoading(false);
      }
    };

    if (student?._id) {
      fetchSessionHistory();
    }
  }, [student]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 font-poppins">
      <div className="bg-white w-[90%] max-w-3xl rounded-2xl shadow-lg p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-800">{student.name}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
          {loading ? (
            <p className="text-gray-500 px-4 py-6">Loading session history...</p>
          ) : history.length === 0 ? (
            <p className="text-gray-500 px-4 py-6">No login history found.</p>
          ) : (
            <table className="min-w-full text-sm border border-blue-200 rounded-xl">
              <thead className="bg-pink-100 text-gray-700 font-medium">
                <tr>
                  <th className="px-4 py-3 border">Login Date</th>
                  <th className="px-4 py-3 border">Login Time</th>
                  <th className="px-4 py-3 border">Logout Date</th>
                  <th className="px-4 py-3 border">Logout Time</th>
                  <th className="px-4 py-3 border">Session Duration</th>
                </tr>
              </thead>
              <tbody>
                {history.map((entry, index) => {
                  const login = new Date(entry.loginAt);
                  const logout = entry.logoutAt ? new Date(entry.logoutAt) : null;

                  return (
                    <tr key={index} className="border border-blue-100">
                      <td className="px-4 py-2 border">{login.toLocaleDateString()}</td>
                      <td className="px-4 py-2 border">{login.toLocaleTimeString()}</td>
                      <td className="px-4 py-2 border">{logout?.toLocaleDateString() || '-'}</td>
                      <td className="px-4 py-2 border">{logout?.toLocaleTimeString() || '-'}</td>
                      <td className="px-4 py-2 border">
                        {entry.sessionDuration ? formatDuration(entry.sessionDuration) : 'Active'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudentStatusModal;
