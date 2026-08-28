import React, { useEffect, useState } from 'react';
import axios from "../../../../../api/axiosInstance";
import StudentStatusModal from './StudentStatusModal';
import ConfirmationModal from './ConfirmationModal';
import { Search, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';

// ─── Windowed page number builder ────────────────────────────────────────────
const getPageNumbers = (current, total) => {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set([1, total]);
  for (let i = Math.max(2, current - 2); i <= Math.min(total - 1, current + 2); i++) pages.add(i);
  const sorted = [...pages].sort((a, b) => a - b);
  const result = [];
  let prev = 0;
  for (const p of sorted) {
    if (p - prev > 1) result.push("...");
    result.push(p);
    prev = p;
  }
  return result;
};

const STUDENTS_PER_PAGE = 40;

const StudentsList = () => {
  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [studentToConfirm, setStudentToConfirm] = useState(null);
  const [isToggleActive, setIsToggleActive] = useState(true);
  const [isLoadingStudents, setIsLoadingStudents] = useState(true);
  const [loadingStudentId, setLoadingStudentId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const fetchStudents = async () => {
      const token = localStorage.getItem('schoolAdminToken');
      if (!token) return console.warn("❌ No token found, skipping API call");

      setIsLoadingStudents(true);
      try {
        const res = await axios.get('/api/school-admin/students', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setStudents(res.data);
      } catch (err) {
        console.error("❌ Fetch error:", err.response?.data || err.message);
      } finally {
        setIsLoadingStudents(false);
      }
    };

    fetchStudents();
  }, []);

  // Reset to page 1 whenever search term changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const handleRequestToggle = (student) => {
    setStudentToConfirm(student);
    setIsToggleActive(student.isActive);
  };

  const toggleAccess = async () => {
    if (!studentToConfirm) return;
    const token = localStorage.getItem('schoolAdminToken');

    setLoadingStudentId(studentToConfirm._id);
    try {
      await axios.patch(
        `/api/school-admin/students/${studentToConfirm._id}/access`,
        { isActive: !isToggleActive },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      setStudents(prev =>
        prev.map(student =>
          student._id === studentToConfirm._id
            ? { ...student, isActive: !isToggleActive }
            : student
        )
      );
    } catch (error) {
      console.error("Failed to update student access:", error.response?.data || error.message);
      alert("Failed to update student access.");
    } finally {
      setStudentToConfirm(null);
      setLoadingStudentId(null);
    }
  };

  const filteredStudents = students.filter(student =>
    student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filteredStudents.length / STUDENTS_PER_PAGE);

  const paginatedStudents = filteredStudents.slice(
    (currentPage - 1) * STUDENTS_PER_PAGE,
    currentPage * STUDENTS_PER_PAGE
  );

  const handlePrevPage = () => setCurrentPage(prev => Math.max(prev - 1, 1));
  const handleNextPage = () => setCurrentPage(prev => Math.min(prev + 1, totalPages));

  return (
    <div className="p-8 bg-white rounded-xl shadow-md font-poppins">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold text-blue-600">Students</h2>

        <div className="relative w-72">
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search by name or email"
            className="w-full pl-4 pr-10 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-blue-600 pointer-events-none mt-2">
            <Search size={18} />
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm text-left border border-blue-200 rounded-lg overflow-hidden">
          <thead className="bg-pink-100 text-gray-700 text-base font-medium">
            <tr>
              <th className="px-6 py-4 border-r border-blue-200">Student Name</th>
              <th className="px-6 py-4 border-r border-blue-200">Email</th>
              <th className="px-6 py-4 border-r border-blue-200">Status</th>
              <th className="px-6 py-4 border-r border-blue-200">Login History</th>
              <th className="px-6 py-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoadingStudents ? (
              <tr>
                <td colSpan="5" className="text-center py-6">
                  <div className="flex justify-center items-center gap-2 text-blue-500">
                    <Loader2 className="animate-spin" size={20} />
                    <span>Loading students...</span>
                  </div>
                </td>
              </tr>
            ) : paginatedStudents.length > 0 ? (
              paginatedStudents.map((student, idx) => (
                <tr key={student._id || idx} className="bg-white border-t border-blue-100 hover:bg-blue-50">
                  <td className="px-6 py-4">{student.name}</td>
                  <td className="px-6 py-4">{student.email}</td>
                  <td className="px-6 py-4">
                    {student.isActive ? (
                      <span className="text-green-600 font-semibold">Active</span>
                    ) : (
                      <span className="text-red-500 font-semibold">Restricted</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => setSelectedStudent(student)}
                      className="bg-blue-500 text-white px-4 py-1 rounded-md text-sm hover:bg-blue-600 transition"
                    >
                      View Status
                    </button>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => handleRequestToggle(student)}
                      className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-1 rounded-md text-sm"
                    >
                      Manage Access
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="5" className="text-center py-4 text-gray-500">
                  No students found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {!isLoadingStudents && totalPages > 1 && (
        <div className="flex justify-center px-4 py-8 bg-gray-50/50 rounded-b-lg">
          <div className="flex items-center gap-1.5 bg-white p-1.5 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-gray-100/50">
            {/* Prev */}
            <button
              onClick={handlePrevPage}
              disabled={currentPage === 1}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-slate-50 text-slate-500 hover:bg-slate-100 disabled:text-slate-400 disabled:bg-slate-50/50"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
              Previous
            </button>

            {/* Windowed page numbers */}
            {getPageNumbers(currentPage, totalPages).map((p, i) =>
              p === "..." ? (
                <div key={`ellipsis-${i}`} className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-50 text-slate-400 text-sm font-semibold select-none">
                  ...
                </div>
              ) : (
                <button
                  key={p}
                  onClick={() => setCurrentPage(p)}
                  className={`w-10 h-10 flex items-center justify-center rounded-xl text-sm font-semibold transition-all ${
                    currentPage === p
                      ? "bg-[#2563EB] text-white shadow-lg shadow-blue-500/30"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {p}
                </button>
              )
            )}

            {/* Next */}
            <button
              onClick={handleNextPage}
              disabled={currentPage === totalPages}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-slate-50 text-slate-700 hover:bg-slate-100 disabled:text-slate-400 disabled:bg-slate-50/50"
            >
              Next
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
        </div>
      )}

      {selectedStudent && (
        <StudentStatusModal
          student={selectedStudent}
          onClose={() => setSelectedStudent(null)}
        />
      )}

      {studentToConfirm && (
        <ConfirmationModal
          student={studentToConfirm}
          isActive={isToggleActive}
          onCancel={() => setStudentToConfirm(null)}
          onConfirm={toggleAccess}
          isLoading={loadingStudentId === studentToConfirm._id}
        />
      )}
    </div>
  );
};

export default StudentsList;