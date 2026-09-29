import React, { useState, useRef, useEffect } from "react";
import axios from "../../../../api/axiosInstance";
import { FaPaperclip, FaPaperPlane, FaSpinner, FaTimes } from "react-icons/fa";
import { useNavigate } from "react-router-dom";

// ✅ SECURITY: No Python URL here. Calls go through Node backend (authenticated).
// Node proxy is mounted at /api/ai — same pattern as Recommendations.jsx
// Token key: partners use "token", students use "userToken"
const getToken = () =>
  localStorage.getItem("userToken") || localStorage.getItem("token") || "";

const SkillAnalysis = ({ job, onClose }) => {
  /* ───────── state & refs ───────── */
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [step, setStep] = useState(1);
  const [file, setFile] = useState(null);
  const [jobDescription, setJobDescription] = useState(
    job?.jobDescription || "",
  );
  const [requiredSkills, setRequiredSkills] = useState(
    job?.qualifications?.join(", ") || "",
  );
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);
  const chatEndRef = useRef(null);

  /* ───────── debug ───────── */
  useEffect(() => {
    console.log("Job prop received:", job);
    console.log("Job Description:", job?.jobDescription);
    console.log("Required Skills:", job?.qualifications);
  }, [job]);

  /* ───────── initial messages ───────── */
  useEffect(() => {
    const welcome = {
      sender: "ai",
      text: "👋 Welcome! Let's analyze your skills. Please upload your resume (PDF/DOCX).",
    };
    if (job) {
      setJobDescription(job.jobDescription || "");
      setRequiredSkills(job.qualifications?.join(", ") || "");
    }
    setMessages([welcome]);
    setStep(1);
  }, [job]);

  /* ───────── keep chat scrolled to bottom ───────── */
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /* ───────── handlers ───────── */
  const handleFileChange = (e) => {
    const uploadedFile = e.target.files[0];
    if (!uploadedFile) return;

    e.target.value = null;

    if (
      uploadedFile &&
      (uploadedFile.type === "application/pdf" ||
        uploadedFile.name.endsWith(".docx"))
    ) {
      setFile(uploadedFile);
      setMessages((prev) => [
        ...prev,
        { sender: "user", text: `📄 Uploaded Resume: ${uploadedFile.name}` },
      ]);

      if (job) {
        setMessages((prev) => [
          ...prev,
          {
            sender: "ai",
            text: "✅ Resume received! Analyzing your skills...",
          },
        ]);
        analyzeSkills(uploadedFile);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            sender: "ai",
            text: "✅ Resume received! Now, please enter the **job description**.",
          },
        ]);
        setStep(2);
      }
    } else {
      setMessages((prev) => [
        ...prev,
        { sender: "ai", text: "⚠️ Please upload a valid PDF or DOCX file." },
      ]);
    }
  };

  const handleUserInput = (text) => {
    if (!text.trim()) return;
    setMessages((prev) => [...prev, { sender: "user", text }]);

    if (step === 2) {
      setJobDescription(text);
      setMessages((prev) => [
        ...prev,
        {
          sender: "ai",
          text: "📌 Great! Now, enter the **required skills for this job**.",
        },
      ]);
      setStep(3);
    } else if (step === 3) {
      setRequiredSkills(text);
      setMessages((prev) => [
        ...prev,
        {
          sender: "ai",
          text: "🔍 Everything is set! Click 'Analyze Skills' to continue.",
        },
      ]);
      setStep(4);
    }
  };

  const analyzeSkills = async (uploadedFile = null) => {
    const fileToUpload = uploadedFile || file;

    if (!fileToUpload) {
      setMessages((prev) => [
        ...prev,
        {
          sender: "ai",
          text: "⚠️ Please upload your resume before analyzing skills.",
        },
      ]);
      return;
    }

    if (!job && (!jobDescription || !requiredSkills)) {
      setMessages((prev) => [
        ...prev,
        {
          sender: "ai",
          text: "⚠️ Please complete all steps before analyzing skills.",
        },
      ]);
      return;
    }

    if (!messages.some((msg) => msg.text === "⏳ Analyzing your skills...")) {
      setMessages((prev) => [
        ...prev,
        { sender: "ai", text: "⏳ Analyzing your skills..." },
      ]);
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("file", fileToUpload);
      formData.append(
        "job_description",
        job ? job.jobDescription : jobDescription,
      );
      formData.append(
        "required_skills",
        job ? job.qualifications.join(", ") : requiredSkills,
      );

      // ✅ SECURITY: Goes through Node backend → Python internally.
      // Auth header uses whichever token is present (student or partner).
      const response = await axios.post("/api/ai/analyze-skills", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
          Authorization: `Bearer ${getToken()}`,
        },
      });

      const {
        readiness_score,
        user_skills,
        skill_gaps,
        recommendations,
        quizzes,
      } = response.data;

      setMessages((prev) => [
        ...prev,
        {
          sender: "ai",
          text: `📊 **Readiness Score:**\n\n🟢 **${readiness_score}%**`,
        },
        {
          sender: "ai",
          text: `✅ **Extracted Skills:**\n\n${
            user_skills.length > 0
              ? user_skills.map((skill) => `• ${skill}`).join("\n")
              : "❌ **No skills detected.**"
          }`,
        },
        {
          sender: "ai",
          text: `⚠️ **Skill Gaps:**\n\n${
            skill_gaps.length > 0
              ? skill_gaps.map((skill) => `🚨 **${skill}**`).join("\n")
              : "✅ **None**"
          }`,
        },
        {
          sender: "ai",
          text: `📚 **Recommended Courses:**\n\n${
            recommendations.courses &&
            Array.isArray(recommendations.courses) &&
            recommendations.courses.length > 0
              ? recommendations.courses
                  .map((course) => {
                    if (typeof course === "object" && course !== null) {
                      return `📚 **${course.title || "Course Title Not Available"}**\n**Platform:** ${course.platform || "N/A"}\n**Description:** ${course.description || "No description available"}\n**Duration:** ${course.duration || "N/A"}`;
                    } else {
                      return `📚 ${course}`;
                    }
                  })
                  .join("\n\n")
              : recommendations.message || "❌ No courses available"
          }`,
        },
        {
          sender: "ai",
          text: `📝 **Practice Quiz:**\n\n${
            Array.isArray(quizzes) && quizzes.length > 0
              ? quizzes
                  .map(
                    (quiz) =>
                      `📝 **${quiz.question}**\n${quiz.options
                        .map((option) => option)
                        .join("\n")}\n**Answer:** ${quiz.answer}`,
                  )
                  .join("\n\n")
              : "❌ **No quizzes available.**"
          }`,
        },
      ]);
    } catch (error) {
      console.error("Analysis error:", error);

      // Surface a clear message for auth failures
      const msg =
        error?.response?.status === 401
          ? "❌ Session expired. Please log in again."
          : `❌ Error analyzing skills: ${error.message || "Try again later."}`;

      setMessages((prev) => [...prev, { sender: "ai", text: msg }]);
    } finally {
      setLoading(false);
    }
  };

  /* ───────── UI ───────── */
  return (
    // Remove "items-center justify-center min-h-screen bg-gray-100 p-6" add "w-full h-full" for remove the extra back white background - 07-08-2026
    <div className="flex flex-col items-center w-full h-full">
      {/*Remove max-w-3xl - 07-08-2026 */}
      <div className="relative w-full bg-white shadow-lg rounded-lg overflow-hidden">
        {/* Header with Close Button */}
        <div className="bg-blue-600 p-6 relative">
          <h2 className="text-2xl font-bold text-white">
            💬 AI Skill Analysis Chat
          </h2>
          <p className="text-sm text-blue-200">
            Upload your resume and analyze your skills for the job.
          </p>

          <button
            onClick={() => {
              if (onClose) onClose();
              else navigate("/user-main-page");
            }}
            className="absolute top-4 right-4 text-white text-lg hover:text-gray-300"
            aria-label="Close"
          >
            <FaTimes />
          </button>
        </div>

        {/* Chat Messages */}
        <div className="h-96 overflow-y-auto p-6 bg-gray-50">
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`flex ${
                msg.sender === "user" ? "justify-end" : "justify-start"
              } mb-4`}
            >
              <div
                className={`p-4 max-w-md rounded-lg text-sm ${
                  msg.sender === "user"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-200 text-gray-800"
                }`}
              >
                {msg.text.split("\n").map((line, idx) => (
                  <p
                    key={idx}
                    className={line.startsWith("**") ? "font-bold" : ""}
                  >
                    {line.replace(/\*\*/g, "")}
                  </p>
                ))}
              </div>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        {/* File Upload */}
        {step === 1 && !loading && (
          <div className="p-6 border-t border-gray-200">
            <button
              className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg flex items-center justify-center gap-2 hover:bg-blue-700 transition-all"
              onClick={() => fileInputRef.current.click()}
              disabled={loading}
              aria-label="Upload Resume"
            >
              <FaPaperclip /> Upload Resume
            </button>
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              onChange={handleFileChange}
              accept=".pdf,.docx"
              disabled={loading}
            />
          </div>
        )}

        {/* Input Fields */}
        {step === 2 && !job && !loading && (
          <div className="p-6 border-t border-gray-200">
            <input
              type="text"
              className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter job description..."
              onKeyDown={(e) =>
                e.key === "Enter" && handleUserInput(e.target.value)
              }
              aria-label="Enter job description"
              disabled={loading}
            />
          </div>
        )}

        {step === 3 && !job && !loading && (
          <div className="p-6 border-t border-gray-200">
            <input
              type="text"
              className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter required skills..."
              onKeyDown={(e) =>
                e.key === "Enter" && handleUserInput(e.target.value)
              }
              aria-label="Enter required skills"
              disabled={loading}
            />
          </div>
        )}

        {/* Analyze Button */}
        {step === 4 && !job && (
          <div className="p-6 border-t border-gray-200">
            <button
              onClick={() => analyzeSkills()}
              className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg flex items-center justify-center gap-2 hover:bg-blue-700 transition-all"
              disabled={loading}
              aria-label="Analyze Skills"
            >
              {loading ? (
                <>
                  <FaSpinner className="animate-spin" /> Analyzing...
                </>
              ) : (
                <>
                  Analyze Skills <FaPaperPlane />
                </>
              )}
            </button>
          </div>
        )}

        {/* Loading indicator */}
        {loading && (
          <div className="p-6 border-t border-gray-200 text-center">
            <FaSpinner className="animate-spin inline-block mr-2" />
            <span>Analyzing your skills. Please wait...</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default SkillAnalysis;
