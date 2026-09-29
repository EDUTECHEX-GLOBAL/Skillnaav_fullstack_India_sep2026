import React, { useEffect, useState, useCallback } from "react";
import axios from "../../../../api/axiosInstance";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faMapMarkerAlt,
  faClock,
  faDollarSign,
  faBriefcase,
  faFileAlt,
} from "@fortawesome/free-solid-svg-icons";
import ApplyCards from "./ApplyCards";

const Applications = () => {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedJob, setSelectedJob] = useState(null);
  const savedScrollRef = React.useRef(0);

  const userInfo = (JSON.parse(localStorage.getItem("studentInfo")) || JSON.parse(localStorage.getItem("userInfo")));
  const studentId = userInfo?._id || null;

  /* ================================
     FETCH APPLICATIONS
  ================================= */
  const fetchDashboardApplications = useCallback(async () => {
    try {
      if (!studentId) {
        setError("Student ID not found. Please login again.");
        setLoading(false);
        return;
      }
      const { data } = await axios.get(
        `/api/applications/student/${studentId}/dashboard`
      );
      setApplications(data.applications || []);
    } catch (err) {
      console.error("Failed to fetch applications:", err);
      setError("Failed to load applications.");
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    fetchDashboardApplications();
  }, [fetchDashboardApplications]);

  useEffect(() => {
    const handleAssessmentCompleted = () => {
      setTimeout(() => fetchDashboardApplications(), 1500);
    };
    const handleVisibility = () => {
      if (!document.hidden) fetchDashboardApplications();
    };
    window.addEventListener("assessmentCompleted", handleAssessmentCompleted);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("assessmentCompleted", handleAssessmentCompleted);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [fetchDashboardApplications]);

  /* ================================
     STATUS RESOLVER
  ================================= */
  const resolveApplicationStatus = (pipeline, appStatus) => {
    if (!pipeline) return appStatus || "Applied";
    
    // L3 Status
    if (pipeline.l3?.status === "passed") return "Interview Passed";
    if (pipeline.l3?.status === "rejected") return "Interview Failed";
    if (pipeline.l3?.status === "completed") return "Interview Completed";
    if (pipeline.l3?.status === "scheduled") return "Interview Scheduled";
    if (pipeline.l3?.status === "sent") return "Interview Invite Sent";
    if (pipeline.l3?.status === "created") return "Interview Pending";
    
    // L2 Status
    if (pipeline.l2?.status === "passed") return "Assessment Cleared";
    if (["generated", "sent", "started", "submitted"].includes(pipeline.l2?.status))
      return "Assessment In Progress";
    if (pipeline.l2?.status === "rejected") return "Assessment Failed";
    
    // L1 Status
    if (pipeline.l1?.status === "shortlisted") return "Shortlisted";
    if (pipeline.l1?.status === "rejected") return "Rejected";
    
    if (appStatus && appStatus !== "Applied") return appStatus;
    return "Applied";
  };

  /* ================================
     STATUS STYLE MAP
  ================================= */
  const statusStyle = {
    Applied:                 { bg: "#f3f4f6", color: "#374151" },
    Shortlisted:             { bg: "#fef9c3", color: "#854d0e" },
    Rejected:                { bg: "#fee2e2", color: "#991b1b" },
    "Assessment In Progress":{ bg: "#ede9fe", color: "#5b21b6" },
    "Assessment Cleared":    { bg: "#dcfce7", color: "#166534" },
    "Assessment Failed":     { bg: "#fee2e2", color: "#991b1b" },
    "Interview Pending":     { bg: "#ffedd5", color: "#9a3412" },
    "Interview Scheduled":   { bg: "#dbeafe", color: "#1e40af" },
    "Interview Invite Sent": { bg: "#dcfce7", color: "#14532d" },
    "Interview Completed":   { bg: "#fef9c3", color: "#854d0e" },
    "Interview Passed":      { bg: "#dcfce7", color: "#166534" },
    "Interview Failed":      { bg: "#fee2e2", color: "#991b1b" },
  };

  /* ================================
     ASSESSMENT CTA
  ================================= */
  const renderAssessmentCTA = (pipeline) => {
    if (!pipeline) return null;
    const { l2, l3 } = pipeline;
    if (l3?.status && l3.status !== "not_used") return null;
    if (!l2 || l2.status === "not_used") return null;

    switch (l2.status) {
      case "generated":
      case "sent":
        return (
          <button
            className="app-cta-btn"
            onClick={() => openAssessment(l2.assessmentId)}
          >
            Start Assessment
          </button>
        );
      case "started":
        return <div className="app-cta-info orange">⏳ Assessment In Progress</div>;
      case "submitted":
        return <div className="app-cta-info blue">📝 Submitted — Awaiting Results</div>;
      case "passed":
        return <div className="app-cta-info green">✅ Assessment Passed</div>;
      case "rejected":
        return <div className="app-cta-info red">❌ Assessment Failed</div>;
      default:
        return null;
    }
  };

  /* ================================
     INTERVIEW INFO
  ================================= */
  const renderInterviewInfo = (pipeline) => {
    const l3 = pipeline?.l3;
    if (!l3 || l3.status === "not_used") return null;

    if (l3.status === "passed") {
      return <div className="app-cta-info green">✅ Interview Passed — Awaiting Offer</div>;
    }
    if (l3.status === "rejected") {
      return <div className="app-cta-info red">❌ Interview Failed</div>;
    }
    if (l3.status === "completed") {
      return <div className="app-cta-info orange">⏳ Interview Completed — Awaiting Results</div>;
    }

    if (!["scheduled", "sent"].includes(l3.status)) return null;

    const interview = typeof l3.interviewId === "object" ? l3.interviewId : null;
    const scheduledAt = interview?.scheduledAt || l3?.scheduledAt;

    return (
      <div className="app-interview-box">
        📅 <strong>Interview Scheduled</strong>
        {scheduledAt && (
          <div className="app-interview-time">
            {new Date(scheduledAt).toLocaleString()}
          </div>
        )}
        {interview?.link ? (
          <div className="app-interview-link">
            🔗{" "}
            <a href={interview.link} target="_blank" rel="noreferrer">
              Join Interview
            </a>
          </div>
        ) : (
          <div className="app-interview-pending">Meeting link coming soon</div>
        )}
      </div>
    );
  };

  const openAssessment = (assessmentId) => {
    if (!assessmentId) return;
    localStorage.setItem("activeAssessmentId", assessmentId);
    window.dispatchEvent(new CustomEvent("openTab", { detail: { tab: "assessment" } }));
  };

  const handleViewDetails = (job) => {
    const container = document.getElementById("main-scroll-container");
    if (container) savedScrollRef.current = container.scrollTop;
    setSelectedJob(job);
  };

  const handleBack = () => {
    setSelectedJob(null);
    requestAnimationFrame(() => {
      const container = document.getElementById("main-scroll-container");
      if (container) container.scrollTop = savedScrollRef.current;
    });
  };

  const getCompensationText = (job) => {
    if (job?.internshipType === "STIPEND")
      return `$${job?.compensationDetails?.amount} ${job?.compensationDetails?.currency} / ${job?.compensationDetails?.frequency?.toLowerCase() || "mo"}`;
    if (job?.internshipType === "FREE") return "Unpaid / Free";
    if (job?.internshipType === "PAID")
      return `Student Pays: $${job?.compensationDetails?.amount}`;
    return "N/A";
  };

  /* ================================
     LOADING / ERROR
  ================================= */
  if (loading) {
    return (
      <>
        <style>{sharedStyles}</style>
        <div className="app-wrapper">
          <div className="app-header">
            <div className="app-header-icon"><FontAwesomeIcon icon={faFileAlt} /></div>
            <h2>Your Applications</h2>
          </div>
          <div className="app-loading">
            <div className="app-spinner" />
            <p>Loading applications…</p>
          </div>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <style>{sharedStyles}</style>
        <div className="app-wrapper">
          <div className="app-error">{error}</div>
        </div>
      </>
    );
  }

  if (selectedJob) {
    return <ApplyCards job={selectedJob} onBack={handleBack} />;
  }

  /* ================================
     MAIN RENDER
  ================================= */
  return (
    <>
      <style>{sharedStyles}</style>
      <div className="app-wrapper">
        {/* Header */}
        <div className="app-header">
          <div className="app-header-icon"><FontAwesomeIcon icon={faFileAlt} /></div>
          <h2>Your Applications</h2>
          {applications.length > 0 && (
            <span className="app-count">{applications.length} applied</span>
          )}
        </div>

        {applications.length === 0 ? (
          <div className="app-empty">
            <div className="app-empty-icon"><FontAwesomeIcon icon={faFileAlt} /></div>
            <h3>No applications yet</h3>
            <p>Jobs you apply to will appear here.</p>
          </div>
        ) : (
          <div className="app-grid">
            {applications.map((app) => {
              const job = app.internship;
              if (!job) return null;

              const finalStatus = resolveApplicationStatus(app.pipeline, app.status);
              const sStyle = statusStyle[finalStatus] || statusStyle["Applied"];

              return (
                <div key={app._id} className="app-card">
                  {/* Status badge */}
                  <div className="app-card-top">
                    <span
                      className="app-status-badge"
                      style={{ background: sStyle.bg, color: sStyle.color }}
                    >
                      {finalStatus}
                    </span>
                  </div>

                  {/* Header */}
                  <div className="app-card-header">
                    {job.imgUrl ? (
                      <img
                        src={job.imgUrl}
                        alt="Company Logo"
                        className="app-logo"
                        onError={(e) => { e.target.style.display = "none"; }}
                      />
                    ) : (
                      <div className="app-logo-fallback">
                        <FontAwesomeIcon icon={faBriefcase} />
                      </div>
                    )}
                    <div className="app-title-block">
                      <p className="app-job-title" title={job.jobTitle}>
                        {job.jobTitle || "Unknown Title"}
                      </p>
                      <p className="app-company" title={job.companyName}>
                        {job.companyName || "Unknown Company"}
                      </p>
                      <p className="app-company" style={{ fontSize: '11px', marginTop: '4px', whiteSpace: 'nowrap' }}>
                        ID: {job._id}
                      </p>
                    </div>
                  </div>

                  {/* Info rows */}
                  <div className="app-info">
                    <div className="app-info-row">
                      <FontAwesomeIcon icon={faMapMarkerAlt} />
                      <span
                        className="app-info-text"
                        title={`${job.location || "N/A"} • ${job.jobType || "N/A"}`}
                      >
                        {job.location || "N/A"} • {job.jobType || "N/A"}
                      </span>
                    </div>
                    <div className="app-info-row">
                      <FontAwesomeIcon icon={faClock} />
                      <span className="app-info-text" title={job.endDateOrDuration || "N/A"}>
                        {job.endDateOrDuration || "N/A"}
                      </span>
                    </div>
                    <div className="app-info-row">
                      <FontAwesomeIcon icon={faDollarSign} />
                      <span className="app-info-text" title={getCompensationText(job)}>
                        {getCompensationText(job)}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="app-card-footer">
                    {renderAssessmentCTA(app.pipeline)}
                    {renderInterviewInfo(app.pipeline)}
                    <button
                      className="app-view-btn"
                      onClick={() => handleViewDetails(job)}
                    >
                      View Details →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
};

/* ================================
   SHARED STYLES
================================= */
const sharedStyles = `
  .app-wrapper {
    padding: 28px 24px;
    font-family: 'Poppins', sans-serif;
    min-height: 100vh;
    background: #f7f8fc;
  }

  /* Header */
  .app-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 24px;
  }
  .app-header-icon {
    width: 38px;
    height: 38px;
    background: linear-gradient(135deg, #7c3aed, #a855f7);
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 16px;
    flex-shrink: 0;
  }
  .app-header h2 {
    font-size: 22px;
    font-weight: 700;
    color: #1a1a2e;
    margin: 0;
  }
  .app-count {
    font-size: 13px;
    font-weight: 500;
    color: #7c3aed;
    background: #ede9fe;
    padding: 2px 10px;
    border-radius: 20px;
    margin-left: 6px;
  }

  /* Grid */
  .app-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 20px;
  }

  /* Card */
  .app-card {
    background: #ffffff;
    border: 1px solid #e8e8f0;
    border-radius: 16px;
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.05);
    position: relative;
    overflow: hidden;
  }

  /* Status badge row */
  .app-card-top {
    display: flex;
    justify-content: flex-end;
  }
  .app-status-badge {
    font-size: 11.5px;
    font-weight: 600;
    padding: 4px 12px;
    border-radius: 20px;
    white-space: nowrap;
    max-width: 180px;
    overflow: hidden;
    text-overflow: ellipsis;
    display: inline-block;
  }

  /* Card header */
  .app-card-header {
    display: flex;
    align-items: flex-start;
    gap: 12px;
  }
  .app-logo {
    width: 46px;
    height: 46px;
    border-radius: 10px;
    object-fit: cover;
    border: 1px solid #f0f0f5;
    flex-shrink: 0;
    background: #f5f5fb;
  }
  .app-logo-fallback {
    width: 46px;
    height: 46px;
    border-radius: 10px;
    background: linear-gradient(135deg, #ede9fe, #ddd6fe);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #7c3aed;
    font-size: 18px;
    flex-shrink: 0;
  }
  .app-title-block {
    min-width: 0;
    flex: 1;
  }
  .app-job-title {
    font-size: 15px;
    font-weight: 700;
    color: #1a1a2e;
    margin: 0 0 3px 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .app-company {
    font-size: 13px;
    color: #6b7280;
    margin: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Info rows */
  .app-info {
    display: flex;
    flex-direction: column;
    gap: 7px;
  }
  .app-info-row {
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 12.5px;
    color: #6b7280;
    min-width: 0;
  }
  .app-info-row svg {
    font-size: 11px;
    color: #a78bfa;
    flex-shrink: 0;
  }
  .app-info-text {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
  }

  /* Footer */
  .app-card-footer {
    display: flex;
    flex-direction: column;
    gap: 8px;
    border-top: 1px solid #f3f4f6;
    padding-top: 12px;
    margin-top: auto;
  }
  .app-view-btn {
    font-size: 13px;
    font-weight: 600;
    color: #7c3aed;
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
    text-align: left;
    transition: color 0.15s;
  }
  .app-view-btn:hover {
    color: #5b21b6;
    text-decoration: underline;
  }

  /* CTA button */
  .app-cta-btn {
    width: 100%;
    padding: 8px 0;
    background: linear-gradient(135deg, #7c3aed, #a855f7);
    color: white;
    font-size: 13px;
    font-weight: 600;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: opacity 0.2s;
  }
  .app-cta-btn:hover { opacity: 0.9; }

  /* CTA info text */
  .app-cta-info {
    font-size: 12.5px;
    font-weight: 600;
    text-align: center;
    padding: 6px 0;
  }
  .app-cta-info.orange { color: #d97706; }
  .app-cta-info.blue   { color: #2563eb; }
  .app-cta-info.green  { color: #16a34a; }
  .app-cta-info.red    { color: #dc2626; }

  /* Interview box */
  .app-interview-box {
    background: #eff6ff;
    border-radius: 8px;
    padding: 10px 12px;
    font-size: 12px;
    color: #1e40af;
    line-height: 1.5;
  }
  .app-interview-time { margin-top: 4px; color: #374151; }
  .app-interview-link { margin-top: 4px; }
  .app-interview-link a {
    color: #7c3aed;
    font-weight: 600;
    text-decoration: underline;
  }
  .app-interview-pending { margin-top: 4px; color: #6b7280; }

  /* Loading */
  .app-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 72px 24px;
    gap: 14px;
    color: #6b7280;
    font-size: 14px;
  }
  .app-spinner {
    width: 36px;
    height: 36px;
    border: 3px solid #ede9fe;
    border-top-color: #7c3aed;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* Error */
  .app-error {
    padding: 20px;
    color: #dc2626;
    font-size: 14px;
    background: #fee2e2;
    border-radius: 10px;
  }

  /* Empty state */
  .app-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 72px 24px;
    text-align: center;
  }
  .app-empty-icon {
    width: 64px;
    height: 64px;
    background: #ede9fe;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 26px;
    color: #a78bfa;
    margin-bottom: 16px;
  }
  .app-empty h3 {
    font-size: 17px;
    font-weight: 700;
    color: #1a1a2e;
    margin: 0 0 6px 0;
  }
  .app-empty p {
    font-size: 14px;
    color: #9ca3af;
    margin: 0;
  }
`;

export default Applications;