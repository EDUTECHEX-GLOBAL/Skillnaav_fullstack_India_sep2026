import React, { useCallback, useEffect, useRef, useState } from "react";
import axios from "../../../../api/axiosInstance";
import {
  FaChevronDown,
  FaDollarSign,
  FaHeadset,
  FaMapMarkerAlt,
  FaTrash,
} from "react-icons/fa";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faClock } from "@fortawesome/free-solid-svg-icons";
import { format } from "date-fns";
import { toast } from "react-toastify";
import SkillAnalysis from "./SkillnaavAnalysis";
import ProctoredAssessment from "./AssessmentModal";

const MAX_LIMITS = {
  Free: { applications: 5, saves: 3 },
  Freemium: { applications: 5, saves: 3 },
  "Premium Basic": { applications: 25, saves: 25 },
  "Premium Plus": { applications: Infinity, saves: Infinity },
};

const parseStoredJson = (...keys) => {
  for (const key of keys) {
    try {
      const value = localStorage.getItem(key);
      if (value) return JSON.parse(value);
    } catch {
      // Continue to the next storage key.
    }
  }
  return null;
};

const getUserToken = () => {
  const token = localStorage.getItem("userToken");
  if (!token) return null;
  try {
    return JSON.parse(token);
  } catch {
    return token;
  }
};

const isActiveTicket = (ticket) => ticket.status !== "resolved" && ticket.status !== "closed";

const openInNewTab = (url) => {
  const win = window.open(url, "_blank", "noopener,noreferrer");
  if (win) win.opener = null;
};

const getStatusStyle = (status) => {
  const value = status?.toLowerCase();
  if (value === "open") return { bg: "#dcfce7", text: "#166534", dot: "#22c55e", border: "#86efac" };
  if (value === "in-progress") return { bg: "#fef9c3", text: "#854d0e", dot: "#eab308", border: "#fde047" };
  if (value === "resolved") return { bg: "#f3e8ff", text: "#6b21a8", dot: "#a855f7", border: "#d8b4fe" };
  return { bg: "#f1f5f9", text: "#475569", dot: "#94a3b8", border: "#cbd5e1" };
};

const TicketBadge = ({ ticket, index, onClick }) => {
  const [hovered, setHovered] = useState(false);
  const active = isActiveTicket(ticket);
  const statusStyle = getStatusStyle(ticket.status);

  return (
    <button
      type="button"
      onClick={() => onClick(ticket)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 5,
        background: active ? "#f0fdf4" : "#f8fafc",
        border: `1.5px solid ${active ? "#86efac" : "#e2e8f0"}`,
        borderRadius: 20,
        padding: "4px 10px 4px 5px",
        cursor: "pointer",
        fontSize: 12,
        fontWeight: 600,
        transform: hovered ? "translateY(-1px)" : "none",
        boxShadow: hovered ? "0 4px 10px rgba(0,0,0,0.10)" : "none",
        transition: "transform 0.12s, box-shadow 0.12s",
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 20,
          height: 20,
          borderRadius: "50%",
          background: active ? "#22c55e" : "#cbd5e1",
          color: "#fff",
          fontSize: 11,
          fontWeight: 700,
          flexShrink: 0,
        }}
      >
        {index + 1}
      </span>
      <span style={{ color: active ? "#166534" : "#64748b" }}>
        #{ticket._id?.slice(-6)}
      </span>
      <span
        style={{
          display: "flex",
          alignItems: "center",
          gap: 3,
          background: statusStyle.bg,
          borderRadius: 10,
          padding: "1px 6px",
          fontSize: 10,
          color: statusStyle.text,
          fontWeight: 500,
          textTransform: "capitalize",
        }}
      >
        <span
          style={{
            width: 5,
            height: 5,
            borderRadius: "50%",
            background: statusStyle.dot,
            flexShrink: 0,
            animation: active ? "ticketPulse 1.5s ease-in-out infinite" : "none",
          }}
        />
        {ticket.status}
      </span>
    </button>
  );
};

const DropdownTicketRow = ({ ticket, index, onClick, onClose }) => {
  const [hovered, setHovered] = useState(false);
  const active = isActiveTicket(ticket);
  const statusStyle = getStatusStyle(ticket.status);

  return (
    <div
      onClick={() => {
        onClick(ticket);
        onClose();
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 12px",
        cursor: "pointer",
        background: hovered ? (active ? "#f0fdf4" : "#f8fafc") : "#fff",
        borderRadius: 10,
        transition: "background 0.12s",
      }}
    >
      <span
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 22,
          height: 22,
          borderRadius: "50%",
          background: active ? "#22c55e" : "#cbd5e1",
          color: "#fff",
          fontSize: 11,
          fontWeight: 700,
          flexShrink: 0,
        }}
      >
        {index + 1}
      </span>

      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: active ? "#166534" : "#475569" }}>
          #{ticket._id?.slice(-6)}
        </p>
        {ticket.lastMessage && (
          <p
            style={{
              margin: 0,
              fontSize: 10,
              color: "#9ca3af",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {ticket.lastMessage.substring(0, 45)}
            {ticket.lastMessage.length > 45 ? "..." : ""}
          </p>
        )}
      </div>

      <span
        style={{
          display: "flex",
          alignItems: "center",
          gap: 3,
          background: statusStyle.bg,
          border: `1px solid ${statusStyle.border}`,
          borderRadius: 10,
          padding: "2px 7px",
          fontSize: 10,
          color: statusStyle.text,
          fontWeight: 500,
          textTransform: "capitalize",
          flexShrink: 0,
        }}
      >
        <span style={{ width: 5, height: 5, borderRadius: "50%", background: statusStyle.dot, flexShrink: 0 }} />
        {ticket.status}
      </span>
    </div>
  );
};

const ApplyCards = ({ job, onBack }) => {
  const [isApplied, setIsApplied] = useState(false);
  const [resume, setResume] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [applicationCount, setApplicationCount] = useState(0);
  const [showLimitPopup, setShowLimitPopup] = useState(false);
  const [showResumePopup, setShowResumePopup] = useState(false);
  const [showSkillAnalysis, setShowSkillAnalysis] = useState(false);
  const [planType, setPlanType] = useState("Free");
  const [schoolAdminId, setSchoolAdminId] = useState(null);
  const [loadingAssessment, setLoadingAssessment] = useState(false);
  const [assessment, setAssessment] = useState(null);
  const [showAssessmentModal, setShowAssessmentModal] = useState(false);
  const [existingResumes, setExistingResumes] = useState([]);
  const [selectedResumeUrl, setSelectedResumeUrl] = useState(null);
  const [showResumeDropdown, setShowResumeDropdown] = useState(false);
  const [existingTickets, setExistingTickets] = useState([]);
  const [checkingTicket, setCheckingTicket] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [resumeToDelete, setResumeToDelete] = useState(null);
  const dropdownRef = useRef(null);
  const visibleCount = 2;

  useEffect(() => {
    const handler = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    const fetchApplicationData = async () => {
      const userInfo = parseStoredJson("studentInfo", "userInfo");
      const studentId = userInfo?._id;
      const token = getUserToken();
      setSchoolAdminId(userInfo?.schoolAdminId || userInfo?.schoolAdmin || null);

      if (!studentId) return;

      try {
        let freshPlan = userInfo?.planType || "Free";
        if (token) {
          try {
            const { data: profileData } = await axios.get("/api/users/profile", {
              headers: { Authorization: `Bearer ${token}` },
            });
            freshPlan = profileData.planType || freshPlan;
            localStorage.setItem("studentInfo", JSON.stringify({ ...userInfo, planType: freshPlan }));
          } catch {
            // Fall back to the locally stored plan type.
          }
        }
        setPlanType(freshPlan);

        const { data: appliedData } = await axios.get(`/api/applications/check-applied/${studentId}/${job._id}`);
        setIsApplied(appliedData.isApplied);

        const { data: countData } = await axios.get(`/api/applications/count/${studentId}`);
        setApplicationCount(countData.count);
      } catch (error) {
        console.error("Error fetching application data:", error);
      }
    };

    fetchApplicationData();
  }, [job._id]);

  useEffect(() => {
    const fetchResumes = async () => {
      const userInfo = parseStoredJson("studentInfo", "userInfo");
      const studentId = userInfo?._id;
      if (!studentId) return;

      try {
        const res = await axios.get(`/api/resumes/user/${studentId}`);
        setExistingResumes(res.data.resumes || []);
      } catch (error) {
        console.error("Error fetching resumes", error);
      }
    };

    fetchResumes();
  }, []);

  useEffect(() => {
    const fetchAssessment = async () => {
      const userInfo = parseStoredJson("studentInfo", "userInfo");
      const studentId = userInfo?._id;
      if (!studentId) return;

      try {
        const { data } = await axios.get(`/api/assessments/${studentId}/${job._id}`);
        if (data?.assessment) setAssessment(data.assessment);
      } catch (error) {
        if (error.response?.status !== 404) {
          console.error("Error fetching existing assessment:", error);
        }
      }
    };

    fetchAssessment();
  }, [job._id]);

  const checkExistingTickets = useCallback(async () => {
    const userInfo = parseStoredJson("studentInfo", "userInfo");
    const token = getUserToken();
    if (!userInfo?._id || !token) return;

    setCheckingTicket(true);
    try {
      const { data } = await axios.get("/api/support/my-tickets", {
        headers: { Authorization: `Bearer ${token}` },
      });

      const matched = (data.tickets || [])
        .filter(
          (ticket) =>
            (ticket.courseName === job.jobTitle ||
              (job._id && ticket.internshipId && ticket.internshipId.toString() === job._id.toString())) &&
            ticket.category === "Internship Access"
        )
        .sort((a, b) => (isActiveTicket(a) ? 0 : 1) - (isActiveTicket(b) ? 0 : 1));
      setExistingTickets(matched);
    } catch (error) {
      console.error("Error checking existing tickets:", error);
      setExistingTickets([]);
    } finally {
      setCheckingTicket(false);
    }
  }, [job._id, job.jobTitle]);

  useEffect(() => {
    checkExistingTickets();
  }, [checkExistingTickets]);

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const allowedTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];

    if (!allowedTypes.includes(file.type)) return toast.error("Only PDF, DOC and DOCX files are allowed.");
    if (file.size > 5 * 1024 * 1024) return toast.error("File size should not exceed 5MB.");

    setResume(file);
    setSelectedResumeUrl(null);
  };

  const handleApply = async () => {
    if (isApplied) return;

    const userInfo = parseStoredJson("studentInfo", "userInfo");
    const studentId = userInfo?._id;
    const token = getUserToken();

    if (!studentId || !token) {
      toast.error("Session expired. Please log in again.");
      return;
    }

    if (job.internshipType === "STIPEND") {
      let studentAssessment = assessment;

      if (!studentAssessment) {
        try {
          const { data } = await axios.get(`/api/assessments/${studentId}/${job._id}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          studentAssessment = data.assessment;
          setAssessment(studentAssessment);
        } catch (error) {
          if (error.response?.status !== 404) console.error("Error fetching assessment:", error);
        }
      }

      if (planType !== "Premium Plus" && planType !== "Premium Basic") {
        toast.error("You must generate and complete the assessment before applying.");
        return;
      }

      let submission;
      try {
        const { data } = await axios.get(`/api/assessments/submission/${studentId}/${studentAssessment._id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        submission = data.submission;
      } catch {
        submission = null;
      }

      if (!submission || submission.score < job.passingScore) {
        toast.error("You must pass the assessment to apply.");
        return;
      }
    }

    if (!resume && !selectedResumeUrl) {
      setShowResumePopup(true);
      return;
    }

    try {
      const { data: countData } = await axios.get(`/api/applications/count/${studentId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const maxApps = MAX_LIMITS[planType]?.applications || 5;
      if (countData.count >= maxApps) {
        setShowLimitPopup(true);
        return;
      }
    } catch (error) {
      console.error("Error checking application count:", error);
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("studentId", studentId);
      formData.append("internshipId", job._id);
      if (resume) formData.append("resume", resume);
      if (selectedResumeUrl) formData.append("resumeUrl", selectedResumeUrl);
      if (schoolAdminId) formData.append("schoolAdminId", schoolAdminId);

      const res = await axios.post("/api/applications/apply", formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      });

      if (res.status === 201) {
        setIsApplied(true);
        const { data } = await axios.get(`/api/applications/count/${studentId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setApplicationCount(data.count);
      }
    } catch (error) {
      const { status, data } = error.response || {};
      if (status === 403 || data?.message?.includes("already applied")) {
        toast.error("Please login to apply");
      } else {
        toast.error(data?.message || "Something went wrong.");
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handleSkillAnalysis = () => {
    if (!job?.jobDescription || !job?.qualifications?.length) {
      toast.error("Job details are incomplete for skill analysis.");
      return;
    }
    setShowSkillAnalysis(true);
  };

  const handleGenerateAssessment = async () => {
    const userInfo = parseStoredJson("studentInfo", "userInfo");
    const studentId = userInfo?._id;
    if (!studentId) return toast.error("Please log in first.");

    if (assessment) {
      toast.error("You already have an assessment for this internship!");
      return;
    }

    setLoadingAssessment(true);
    try {
      const response = await axios.post("/api/assessments/generate", {
        internshipId: job._id,
        studentId,
      });
      setAssessment(response.data.assessment);
      toast.success("AI Assessment generated successfully!");
    } catch (error) {
      console.error("Failed to fetch assessment:", error);
      toast.error("Failed to generate assessment. Please try again later.");
    } finally {
      setLoadingAssessment(false);
    }
  };

  const handleDeleteResume = async (resumeId) => {
    const deletedResume = existingResumes.find((item) => item._id === resumeId);
    try {
      await axios.delete(`/api/resumes/${resumeId}`);
      setExistingResumes((prev) => prev.filter((item) => item._id !== resumeId));
      if (deletedResume?.fileUrl === selectedResumeUrl) setSelectedResumeUrl(null);
      toast.success("Resume deleted successfully");
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete resume");
    } finally {
      setResumeToDelete(null);
    }
  };

  const internshipContext = {
    internshipId: job._id,
    jobTitle: job.jobTitle,
    companyName: job.companyName,
    location: job.location,
    internshipType: job.internshipType,
    isApplied,
    applicationCount,
    planType,
    contactName: job.contactInfo?.name || null,
    contactEmail: job.contactInfo?.email || null,
    contactPhone: job.contactInfo?.phone || null,
  };

  const handleBadgeClick = (ticket) => {
    setShowDropdown(false);
    const url = `/user-support?ticketId=${encodeURIComponent(ticket._id)}`;
    openInNewTab(url);
  };

  const handleRaiseTicketClick = () => {
    setShowDropdown(false);
    const prefillKey = `userSupportPrefill:${Date.now()}`;
    localStorage.setItem(prefillKey, JSON.stringify(internshipContext));

    const url = `/user-support?prefillKey=${encodeURIComponent(prefillKey)}`;
    openInNewTab(url);
  };

  const activeTickets = existingTickets.filter(isActiveTicket);
  const latestActive = activeTickets[0] || null;
  const visibleBadges = activeTickets.slice(0, visibleCount);
  const hiddenBadges = activeTickets.slice(visibleCount);
  const hiddenCount = hiddenBadges.length;
  const maxAppsDisplay = MAX_LIMITS[planType]?.applications || 5;
  const selectedResumeName =
    existingResumes.find((item) => item.fileUrl === selectedResumeUrl)?.fileName || "No resume selected";

  return (
    <div className="relative bg-white rounded-lg shadow-lg max-w-full mx-auto p-4 sm:p-6 lg:p-8 xl:p-12 overflow-auto">
      <button className="text-gray-500 w-12 h-12 text-sm mb-4" onClick={onBack}>
        &lt; back
      </button>

      <div className="flex flex-col md:flex-row items-start justify-between mb-4">
        <div className="flex items-start mb-4 md:mb-0">
          {job.imgUrl && (
            <img src={job.imgUrl} alt="company-logo" className="rounded-full w-12 h-12 mr-4" />
          )}
          <div>
            <h2 className="text-xl md:text-2xl font-semibold text-gray-800">{job.jobTitle}</h2>
            <p className="text-gray-500">{job.companyName}</p>
            <p className="text-gray-400 text-sm mt-1 whitespace-nowrap">ID: {job._id}</p>

            <div className="text-gray-500 mt-2 text-sm md:text-base flex items-center">
              <FaMapMarkerAlt className="mr-2" />
              <p>{job.location || "Location not specified"}</p>
            </div>

            <div className="flex items-center text-gray-500 mt-2 text-sm md:text-base">
              <p className="flex items-center">
                <FontAwesomeIcon icon={faClock} className="mr-2" />
                {isNaN(Date.parse(job.startDate)) ? (job.startDate || "Date unknown") : format(new Date(job.startDate), "dd MMM yyyy")} -{" "}
                {(job.endDateOrDuration || job.duration) ? (isNaN(Date.parse(job.endDateOrDuration || job.duration)) ? (job.endDateOrDuration || job.duration) : format(new Date(job.endDateOrDuration || job.duration), "dd MMM yyyy")) : "-"}
              </p>
            </div>

            <div className="flex items-center text-gray-500 mt-2 text-sm md:text-base">
              <FaDollarSign className="mr-2" />
              <p>
                {job.compensationDetails?.pdfExtractedCompensation
                  ? job.compensationDetails.pdfExtractedCompensation
                  : job.internshipType === "STIPEND"
                  ? `${job.compensationDetails?.amount || "—"} ${job.compensationDetails?.currency || ""}${
                      job.compensationDetails?.frequency ? ` per ${job.compensationDetails.frequency.toLowerCase()}` : ""
                    }`.trim()
                  : job.internshipType === "FREE"
                  ? "Unpaid / Free"
                  : job.internshipType === "PAID"
                  ? `Student Pays: ${job.compensationDetails?.amount || "—"} ${job.compensationDetails?.currency || ""}`.trim()
                  : "N/A"}
              </p>
            </div>

            <div className="mt-4">
              {existingResumes.length > 0 && (
                <div className="mb-3">
                  <p className="text-sm font-semibold text-gray-700 mb-1">Select Existing Resume</p>
                  <div className="relative w-full">
                    <button
                      type="button"
                      disabled={isApplied}
                      onClick={() => setShowResumeDropdown((prev) => !prev)}
                      className={`w-full border rounded-md px-4 py-2 flex justify-between items-center bg-white ${
                        isApplied ? "cursor-not-allowed bg-gray-100" : ""
                      }`}
                    >
                      <span>{selectedResumeUrl ? selectedResumeName : "-- Choose Resume --"}</span>
                      <FaChevronDown />
                    </button>

                    {showResumeDropdown && !isApplied && (
                      <div className="absolute z-50 w-full bg-white border rounded-md shadow-lg mt-1 max-h-60 overflow-y-auto">
                        {existingResumes.map((item) => (
                          <div
                            key={item._id}
                            className="flex items-center justify-between px-4 py-2 hover:bg-gray-100 cursor-pointer"
                          >
                            <span
                              className="flex-1 truncate"
                              onClick={() => {
                                setSelectedResumeUrl(item.fileUrl);
                                setResume(null);
                                setShowResumeDropdown(false);
                              }}
                            >
                              {item.fileName}
                            </span>
                            <button
                              type="button"
                              className="text-red-500 hover:text-red-700 ml-3"
                              onClick={(event) => {
                                event.stopPropagation();
                                setResumeToDelete(item._id);
                              }}
                            >
                              <FaTrash />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {selectedResumeUrl && (
                    <button
                      type="button"
                      onClick={() => setSelectedResumeUrl(null)}
                      className="text-red-500 text-sm hover:underline mt-2"
                    >
                      Clear selected resume
                    </button>
                  )}
                </div>
              )}

              <p className="text-sm text-gray-500 mt-1">{existingResumes.length}/5 resumes used</p>
              {existingResumes.length >= 5 && (
                <p className="text-red-500 text-sm mt-1">Maximum 5 resumes allowed. Delete one to upload another.</p>
              )}

              <div className="mt-3">
                <input
                  type="file"
                  accept=".pdf,.doc,.docx"
                  disabled={isApplied || existingResumes.length >= 5}
                  onChange={handleFileChange}
                  className={`block w-full text-sm ${
                    isApplied || existingResumes.length >= 5 ? "text-gray-400 cursor-not-allowed" : "text-gray-500"
                  }`}
                />

                {resume && (
                  <button type="button" onClick={() => setResume(null)} className="text-red-500 text-sm hover:underline mt-2">
                    Remove uploaded resume
                  </button>
                )}

                {selectedResumeUrl && (
                  <p className="text-gray-500 text-sm mt-2">File upload disabled because a saved resume is selected.</p>
                )}
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-4">
                <p className="text-sm font-semibold text-gray-700">Resume that will be submitted</p>
                <p className="text-blue-700 mt-1 font-medium">
                  {resume?.name || (selectedResumeUrl ? selectedResumeName : "No resume selected")}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 mt-4">
              {job.applicationOpen ? (
                <button
                  onClick={handleApply}
                  disabled={isApplied || isUploading}
                  className={`text-white px-4 py-2 rounded-full font-semibold ${
                    isApplied ? "bg-green-500" : "bg-purple-500 hover:bg-purple-600"
                  }`}
                >
                  {isApplied ? "Applied" : isUploading ? "Uploading..." : "Apply now"}
                </button>
              ) : (
                <div className="text-red-600 font-semibold p-2 border border-red-400 rounded">
                  Applications are currently closed for this internship.
                </div>
              )}

              <button onClick={handleSkillAnalysis} className="text-white bg-blue-500 hover:bg-blue-600 px-4 py-2 rounded-full font-semibold">
                Skill Analysis
              </button>

              {job.internshipType === "STIPEND" && (
                <button
                  onClick={async () => {
                    if (!assessment) await handleGenerateAssessment();
                    setShowAssessmentModal(true);
                  }}
                  disabled={loadingAssessment}
                  className={`px-4 py-2 rounded-full font-semibold ${
                    assessment ? "bg-green-500 hover:bg-green-600 text-white" : "bg-orange-500 hover:bg-orange-600 text-white"
                  }`}
                >
                  {assessment ? "Take Assessment" : loadingAssessment ? "Generating..." : "Generate Assessment"}
                </button>
              )}

              <button
                onClick={handleRaiseTicketClick}
                disabled={checkingTicket}
                className={`flex items-center gap-2 text-white px-4 py-2 rounded-full font-semibold transition-all ${
                  checkingTicket ? "bg-gray-400 cursor-not-allowed" : "bg-rose-500 hover:bg-rose-600"
                }`}
              >
                <FaHeadset className="text-sm" />
                {checkingTicket ? "Checking..." : "Raise Ticket"}
              </button>
            </div>

            {activeTickets.length > 0 && !checkingTicket && (
              <div style={{ marginTop: 14, maxWidth: 440 }}>
                {latestActive && (
                  <div
                    onClick={() => handleBadgeClick(latestActive)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      background: "#f0fdf4",
                      border: "1px solid #bbf7d0",
                      borderRadius: 14,
                      padding: "9px 14px",
                      cursor: "pointer",
                      marginBottom: 10,
                      transition: "background 0.15s",
                    }}
                  >
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: "#22c55e",
                        flexShrink: 0,
                        animation: "ticketPulse 1.5s ease-in-out infinite",
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 12, fontWeight: 700, color: "#166534", margin: 0, lineHeight: 1.4 }}>
                        Ticket #{latestActive._id?.slice(-6)} is active
                      </p>
                      <p
                        style={{
                          fontSize: 11,
                          color: "#15803d",
                          margin: 0,
                          lineHeight: 1.4,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        Status: <span style={{ fontWeight: 600, textTransform: "capitalize" }}>{latestActive.status}</span>
                        {latestActive.lastMessage && (
                          <> - "{latestActive.lastMessage.substring(0, 35)}{latestActive.lastMessage.length > 35 ? "..." : ""}"</>
                        )}
                      </p>
                    </div>
                    <span style={{ fontSize: 11, color: "#166534", fontWeight: 600, flexShrink: 0 }}>View</span>
                  </div>
                )}

                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 11, color: "#9ca3af", fontWeight: 500, marginRight: 2 }}>All tickets:</span>
                  {visibleBadges.map((ticket, index) => (
                    <TicketBadge key={ticket._id} ticket={ticket} index={index} onClick={handleBadgeClick} />
                  ))}
                  {hiddenCount > 0 && (
                    <div ref={dropdownRef} style={{ position: "relative" }}>
                      <button
                        type="button"
                        onClick={() => setShowDropdown((prev) => !prev)}
                        style={{
                          height: 28,
                          padding: "0 10px",
                          background: showDropdown ? "#e5e7eb" : "#f3f4f6",
                          border: "1.5px solid #e5e7eb",
                          borderRadius: 20,
                          cursor: "pointer",
                          fontSize: 12,
                          fontWeight: 600,
                          color: "#374151",
                          whiteSpace: "nowrap",
                        }}
                      >
                        +{hiddenCount}
                      </button>
                      {showDropdown && (
                        <div
                          style={{
                            position: "absolute",
                            bottom: "calc(100% + 8px)",
                            left: 0,
                            minWidth: 260,
                            background: "#fff",
                            border: "1px solid #e5e7eb",
                            borderRadius: 14,
                            boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                            zIndex: 50,
                            overflow: "hidden",
                            animation: "dropIn 0.18s ease",
                          }}
                        >
                          <div
                            style={{
                              padding: "10px 14px 8px",
                              borderBottom: "1px solid #f3f4f6",
                              fontSize: 11,
                              fontWeight: 700,
                              color: "#6b7280",
                              textTransform: "uppercase",
                              letterSpacing: "0.05em",
                            }}
                          >
                            {hiddenCount} more ticket{hiddenCount > 1 ? "s" : ""}
                          </div>
                          <div style={{ padding: "6px" }}>
                            {hiddenBadges.map((ticket, index) => (
                              <DropdownTicketRow
                                key={ticket._id}
                                ticket={ticket}
                                index={visibleCount + index}
                                onClick={handleBadgeClick}
                                onClose={() => setShowDropdown(false)}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            <style>{`
              @keyframes ticketPulse {
                0%, 100% { opacity: 1; transform: scale(1); }
                50% { opacity: 0.45; transform: scale(0.75); }
              }
              @keyframes dropIn {
                from { opacity: 0; transform: translateY(6px); }
                to { opacity: 1; transform: translateY(0); }
              }
            `}</style>
          </div>
        </div>

        {showResumePopup && (
          <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
            <div className="bg-white p-6 rounded-lg shadow-lg text-center">
              <h2 className="text-xl font-semibold mb-2">Resume Required</h2>
              <p className="text-gray-600">Please upload or select your resume before applying.</p>
              <button onClick={() => setShowResumePopup(false)} className="mt-4 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600">
                Close
              </button>
            </div>
          </div>
        )}

        {showLimitPopup && (
          <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
            <div className="bg-white p-6 rounded-lg shadow-lg max-w-sm text-center">
              <h2 className="text-xl font-semibold text-gray-800">Application Limit Reached</h2>
              <p className="text-gray-600 mt-2">
                You have reached the maximum of {maxAppsDisplay === Infinity ? "unlimited" : maxAppsDisplay} applications allowed under your plan ({planType}).
              </p>
              <p className="text-gray-600 mt-1">Upgrade your plan to apply for more internships.</p>
              <button className="bg-purple-500 text-white px-4 py-2 rounded-md mt-4 hover:bg-purple-600" onClick={() => setShowLimitPopup(false)}>
                Close
              </button>
            </div>
          </div>
        )}

        {resumeToDelete && (
          <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
            <div className="bg-white p-6 rounded-lg shadow-lg max-w-sm w-full text-center">
              <h2 className="text-xl font-semibold text-gray-800">Delete Resume</h2>
              <p className="text-gray-600 mt-2 mb-6">
                Are you sure you want to delete this resume? This action cannot be undone.
              </p>
              <div className="flex justify-center gap-4">
                <button
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-100"
                  onClick={() => setResumeToDelete(null)}
                >
                  Cancel
                </button>
                <button
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                  onClick={() => handleDeleteResume(resumeToDelete)}
                >
                  Confirm Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {showSkillAnalysis && (
          <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
            <div className="bg-white rounded-lg shadow-lg max-w-3xl w-full overflow-hidden">
              <SkillAnalysis job={job} onClose={() => setShowSkillAnalysis(false)} />
            </div>
          </div>
        )}

      </div>

      <hr className="my-4" />

      <div className="mb-6">
        <h3 className="text-lg md:text-xl font-semibold text-gray-800 mb-2">About the job</h3>
        <p className="text-gray-600 leading-relaxed">{job.jobDescription || "No description available"}</p>
      </div>

      <div>
        <h3 className="text-lg md:text-xl font-semibold text-gray-800 mb-2">Skills required</h3>
        <div className="flex flex-wrap gap-2">
          {(job.qualifications || []).map((qualification, index) => (
            <span key={index} className="text-sm bg-gray-200 text-gray-800 py-1 px-3 rounded-full">
              {qualification}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-6">
        <h3 className="text-lg md:text-xl font-semibold text-gray-800 mb-2">Contact Information</h3>
          <div className="bg-gray-50 border rounded-lg p-3 md:p-4 text-sm md:text-base text-gray-700">
            {job.contactInfo?.name || "Not provided"}
            {job.contactInfo?.email ? `, ${job.contactInfo.email}` : ""}
            {job.contactInfo?.phone ? `, ${job.contactInfo.phone}` : ""}
          </div>
      </div>

      {showAssessmentModal && assessment && (
        <ProctoredAssessment
          assessment={assessment}
          studentId={parseStoredJson("studentInfo", "userInfo")?._id}
          onClose={() => setShowAssessmentModal(false)}
        />
      )}
    </div>
  );
};

export default ApplyCards;
