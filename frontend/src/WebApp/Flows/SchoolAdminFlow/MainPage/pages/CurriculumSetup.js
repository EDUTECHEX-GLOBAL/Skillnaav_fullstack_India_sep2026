import React, { useState, useEffect } from "react";
import axios from "../../../../../api/axiosInstance";
import { FaPlus, FaSave, FaTimes } from "react-icons/fa";

const grades = ["Grade 9", "Grade 10", "Grade 11", "Grade 12",];
const defaultSubjects = [
  "Mathematics",
  "Science",
  "English",
  "Social Studies",
  "Computer Science",
];

const CurriculumSetup = () => {
  const [selectedGrade, setSelectedGrade] = useState("");
  const [subjects, setSubjects] = useState([...defaultSubjects]);
  const [customSubject, setCustomSubject] = useState("");
  const [loading, setLoading] = useState(false);
  const [savedCurriculums, setSavedCurriculums] = useState([]);

  const token = localStorage.getItem("schoolAdminToken");

  // Fetch saved curriculum for selected grade
  useEffect(() => {
    const fetchCurriculumByGrade = async () => {
      if (!selectedGrade || !token) return;
      setLoading(true);
      try {
        const { data } = await axios.get(
          `/api/curriculum?grade=${selectedGrade}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        setSubjects(data.subjects || [...defaultSubjects]);
      } catch (error) {
        console.log("No existing curriculum found, using default subjects.");
        setSubjects([...defaultSubjects]);
      } finally {
        setLoading(false);
      }
    };
    fetchCurriculumByGrade();
  }, [selectedGrade, token]);

  // Fetch all saved curriculums for logged-in admin
  useEffect(() => {
    const fetchAllCurriculums = async () => {
      if (!token) return;
      try {
        const { data } = await axios.get(
          `/api/curriculum`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        setSavedCurriculums(data);
      } catch (error) {
        console.log("Error fetching saved curriculums:", error);
      }
    };
    fetchAllCurriculums();
  }, [token, loading]); // Reload saved curriculums after save

  const handleRemoveSubject = (subject) => {
    setSubjects(subjects.filter((s) => s !== subject));
  };

  const handleAddCustomSubject = () => {
    const trimmed = customSubject.trim();
    if (trimmed && !subjects.includes(trimmed)) {
      setSubjects([...subjects, trimmed]);
      setCustomSubject("");
    }
  };

  const handleSave = async () => {
    if (!selectedGrade) {
      alert("Please select a grade before saving.");
      return;
    }
    if (!token) {
      alert("Please login to save curriculum.");
      return;
    }

    setLoading(true);
    try {
      const { data } = await axios.post(
        "/api/curriculum",
        { grade: selectedGrade, subjects },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert(data.message || "Curriculum saved successfully!");
    } catch (error) {
      console.error("Error saving curriculum:", error);
      alert(error.response?.data?.message || "Failed to save curriculum. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 w-full max-w-5xl mx-auto font-[Poppins]">
      <h2 className="text-4xl font-bold text-gray-800 mb-8 tracking-wide">
        📚 Curriculum Setup
      </h2>

      {/* Grade Selection */}
      <div className="mb-8 bg-gradient-to-r from-blue-50 to-white p-6 rounded-xl shadow-md border border-blue-100">
        <label className="block text-gray-700 font-semibold mb-3 text-lg">Select Grade</label>
        <select
          className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none transition text-gray-800 font-medium"
          value={selectedGrade}
          onChange={(e) => setSelectedGrade(e.target.value)}
        >
          <option value="">-- Select Grade --</option>
          {grades.map((grade) => (
            <option key={grade} value={grade}>{grade}</option>
          ))}
        </select>
      </div>

      {/* Subjects Section */}
      <div className="mb-8 bg-gradient-to-r from-green-50 to-white p-6 rounded-xl shadow-md border border-green-100">
        <label className="block text-gray-700 font-semibold mb-3 text-lg">Subjects</label>

        {loading ? (
          <p className="text-gray-500 italic">Loading subjects...</p>
        ) : (
          <div className="flex flex-wrap gap-3 mb-4">
            {subjects.map((subject) => (
              <div
                key={subject}
                className="flex items-center gap-2 px-4 py-2 bg-white border rounded-full shadow-sm cursor-pointer hover:shadow-md transition"
              >
                <span className="text-gray-700 font-medium">{subject}</span>
                <FaTimes
                  className="text-red-500 hover:text-red-700 transition"
                  onClick={() => handleRemoveSubject(subject)}
                />
              </div>
            ))}
          </div>
        )}

        {/* Add Custom Subject */}
        <div className="flex flex-col md:flex-row gap-3 items-start md:items-center">
          <input
            type="text"
            placeholder="Add custom subject"
            className="flex-1 border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-green-400 focus:border-green-400 outline-none transition text-gray-800 font-medium"
            value={customSubject}
            onChange={(e) => setCustomSubject(e.target.value)}
          />
          <button
            type="button"
            onClick={handleAddCustomSubject}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-600 to-green-500 text-white rounded-xl shadow-lg hover:shadow-xl hover:from-green-700 hover:to-green-600 transition font-semibold"
          >
            <FaPlus /> Add
          </button>
        </div>
      </div>

      {/* Saved Curriculums Section */}
      <div className="mb-8 bg-gray-50 p-6 rounded-xl shadow-md border border-gray-200">
        <h3 className="text-2xl font-semibold mb-4">Saved Curriculums</h3>
        {savedCurriculums.length === 0 ? (
          <p className="text-gray-500">No curriculums saved yet.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {savedCurriculums.map((curriculum) => (
              <div
                key={curriculum.grade}
                className="p-4 bg-white border rounded-xl shadow-sm hover:shadow-md transition"
              >
                <h4 className="font-semibold text-lg mb-2">{curriculum.grade}</h4>
                <ul className="list-disc list-inside text-gray-700">
                  {curriculum.subjects.map((subject) => (
                    <li key={subject}>{subject}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Floating Save Button */}
      <div className="fixed bottom-8 right-8">
        <button
          onClick={handleSave}
          disabled={loading}
          className={`flex items-center gap-3 px-6 py-4 ${
            loading
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600"
          } text-white rounded-2xl shadow-2xl transition font-bold text-lg`}
        >
          <FaSave /> {loading ? "Saving..." : "Save Curriculum"}
        </button>
      </div>
    </div>
  );
};

export default CurriculumSetup;
