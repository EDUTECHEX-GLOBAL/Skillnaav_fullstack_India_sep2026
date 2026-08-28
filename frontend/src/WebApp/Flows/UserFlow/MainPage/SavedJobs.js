import React, { useEffect, useState } from "react";
import { useTabContext } from "./UserHomePageContext/HomePageContext";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faHeart,
  faMapMarkerAlt,
  faClock,
  faDollarSign,
  faBookmark,
  faBriefcase,
} from "@fortawesome/free-solid-svg-icons";
import ApplyCards from "./ApplyCards";

const SavedJobs = () => {
  const { savedJobs, removeJob, getSavedJobs } = useTabContext();
  const [selectedJob, setSelectedJob] = useState(null);
  const [removingId, setRemovingId] = useState(null);
  const userInfo = (JSON.parse(localStorage.getItem("studentInfo")) || JSON.parse(localStorage.getItem("userInfo"))) || {};
  const userId = userInfo?._id;

  const validSavedJobs = savedJobs?.filter(job => job?.jobId?._id) || [];

  useEffect(() => {
    if (userId) {
      getSavedJobs();
    }
  }, [userId, getSavedJobs]);

  const handleRemove = async (jobId) => {
    setRemovingId(jobId);
    await removeJob(jobId);
    setRemovingId(null);
  };

  const getCompensationText = (job) => {
    if (job?.internshipType === "STIPEND") {
      return `$${job?.compensationDetails?.amount} ${job?.compensationDetails?.currency} / ${job?.compensationDetails?.frequency?.toLowerCase()}`;
    } else if (job?.internshipType === "FREE") {
      return "Unpaid";
    } else if (job?.internshipType === "PAID") {
      return `Student Pays: $${job?.compensationDetails?.amount}`;
    }
    return "N/A";
  };

  if (selectedJob) {
    return <ApplyCards job={selectedJob} onBack={() => setSelectedJob(null)} />;
  }

  return (
    <>
      <style>{`
        .sj-wrapper {
          padding: 28px 24px;
          font-family: 'Poppins', sans-serif;
          min-height: 100vh;
          background: #f7f8fc;
        }

        .sj-header {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 24px;
        }

        .sj-header-icon {
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

        .sj-header h2 {
          font-size: 22px;
          font-weight: 700;
          color: #1a1a2e;
          margin: 0;
        }

        .sj-count {
          margin-left: 6px;
          font-size: 13px;
          font-weight: 500;
          color: #7c3aed;
          background: #ede9fe;
          padding: 2px 10px;
          border-radius: 20px;
        }

        /* Grid */
        .sj-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 20px;
        }

        /* Card */
        .sj-card {
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

        /* Remove button */
        .sj-remove-btn {
          position: absolute;
          top: 14px;
          right: 14px;
          width: 30px;
          height: 30px;
          border-radius: 50%;
          border: none;
          background: #fff0f0;
          color: #ef4444;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 13px;
          transition: background 0.2s, transform 0.15s;
          flex-shrink: 0;
        }

        .sj-remove-btn:hover {
          background: #fee2e2;
          transform: scale(1.1);
        }

        .sj-remove-btn.removing {
          opacity: 0.5;
          pointer-events: none;
        }

        /* Header row */
        .sj-card-header {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding-right: 36px;
        }

        .sj-logo {
          width: 46px;
          height: 46px;
          border-radius: 10px;
          object-fit: cover;
          border: 1px solid #f0f0f5;
          flex-shrink: 0;
          background: #f5f5fb;
        }

        .sj-logo-fallback {
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

        .sj-title-block {
          min-width: 0;
          flex: 1;
        }

        .sj-job-title {
          font-size: 15px;
          font-weight: 700;
          color: #1a1a2e;
          margin: 0 0 3px 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .sj-company {
          font-size: 13px;
          color: #6b7280;
          margin: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        /* Info rows */
        .sj-info {
          display: flex;
          flex-direction: column;
          gap: 7px;
        }

        .sj-info-row {
          display: flex;
          align-items: center;
          gap: 7px;
          font-size: 12.5px;
          color: #6b7280;
          min-width: 0;
        }

        .sj-info-row svg {
          font-size: 11px;
          color: #a78bfa;
          flex-shrink: 0;
        }

        .sj-info-text {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        /* Skills */
        .sj-skills {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          min-height: 28px;
        }

        .sj-skill-tag {
          font-size: 11.5px;
          font-weight: 500;
          background: #f3f0ff;
          color: #6d28d9;
          padding: 3px 10px;
          border-radius: 20px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 110px;
          display: inline-block;
        }

        .sj-skill-more {
          font-size: 11.5px;
          font-weight: 500;
          background: #f3f4f6;
          color: #6b7280;
          padding: 3px 10px;
          border-radius: 20px;
          flex-shrink: 0;
        }

        /* Footer */
        .sj-card-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-top: 1px solid #f3f4f6;
          padding-top: 12px;
          margin-top: auto;
        }

        .sj-view-btn {
          font-size: 13px;
          font-weight: 600;
          color: #7c3aed;
          background: none;
          border: none;
          cursor: pointer;
          padding: 0;
          transition: color 0.15s;
          white-space: nowrap;
        }

        .sj-view-btn:hover {
          color: #5b21b6;
          text-decoration: underline;
        }

        /* Empty state */
        .sj-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 72px 24px;
          text-align: center;
        }

        .sj-empty-icon {
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

        .sj-empty h3 {
          font-size: 17px;
          font-weight: 700;
          color: #1a1a2e;
          margin: 0 0 6px 0;
        }

        .sj-empty p {
          font-size: 14px;
          color: #9ca3af;
          margin: 0;
        }
      `}</style>

      <div className="sj-wrapper">
        {/* Header */}
        <div className="sj-header">
          <div className="sj-header-icon">
            <FontAwesomeIcon icon={faBookmark} />
          </div>
          <h2>Saved Jobs</h2>
          {validSavedJobs.length > 0 && (
            <span className="sj-count">{validSavedJobs.length} saved</span>
          )}
        </div>

        {/* Grid or Empty */}
        {validSavedJobs.length > 0 ? (
          <div className="sj-grid">
            {validSavedJobs.map((job) =>
              job?.jobId?._id ? (
                <div key={job.jobId._id} className="sj-card">
                  {/* Remove button */}
                  <button
                    className={`sj-remove-btn ${removingId === job.jobId._id ? "removing" : ""}`}
                    onClick={() => handleRemove(job.jobId._id)}
                    title="Remove from saved"
                  >
                    <FontAwesomeIcon icon={faHeart} />
                  </button>

                  {/* Header */}
                  <div className="sj-card-header">
                    {job.jobId?.imgUrl ? (
                      <img
                        src={job.jobId.imgUrl}
                        alt="Company Logo"
                        className="sj-logo"
                        onError={(e) => { e.target.style.display = "none"; }}
                      />
                    ) : (
                      <div className="sj-logo-fallback">
                        <FontAwesomeIcon icon={faBriefcase} />
                      </div>
                    )}
                    <div className="sj-title-block">
                      <p className="sj-job-title" title={job.jobId?.jobTitle}>
                        {job.jobId?.jobTitle || "Unknown Title"}
                      </p>
                      <p className="sj-company" title={job.jobId?.companyName}>
                        {job.jobId?.companyName || "Unknown Company"}
                      </p>
                      <p className="sj-company" style={{ fontSize: '11px', marginTop: '4px', whiteSpace: 'nowrap' }}>
                        ID: {job.jobId?._id}
                      </p>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="sj-info">
                    <div className="sj-info-row">
                      <FontAwesomeIcon icon={faMapMarkerAlt} />
                      <span
                        className="sj-info-text"
                        title={`${job.jobId?.location} • ${job.jobId?.type}`}
                      >
                        {job.jobId?.location || "Unknown Location"} • {job.jobId?.type || "N/A"}
                      </span>
                    </div>
                    <div className="sj-info-row">
                      <FontAwesomeIcon icon={faClock} />
                      <span className="sj-info-text">
                        {job.jobId?.startDate
                          ? new Date(job.jobId.startDate).toLocaleDateString()
                          : "N/A"}{" "}
                        — {job.jobId?.endDateOrDuration || "N/A"}
                      </span>
                    </div>
                    <div className="sj-info-row">
                      <FontAwesomeIcon icon={faDollarSign} />
                      <span className="sj-info-text" title={getCompensationText(job.jobId)}>
                        {getCompensationText(job.jobId)}
                      </span>
                    </div>
                  </div>

                  {/* Skills */}
                  <div className="sj-skills">
                    {job.jobId?.qualifications?.length > 0 ? (
                      <>
                        {job.jobId.qualifications.slice(0, 2).map((q, idx) => (
                          <span key={idx} className="sj-skill-tag" title={q}>
                            {q}
                          </span>
                        ))}
                        {job.jobId.qualifications.length > 2 && (
                          <span className="sj-skill-more">
                            +{job.jobId.qualifications.length - 2}
                          </span>
                        )}
                      </>
                    ) : (
                      <span style={{ fontSize: "12px", color: "#9ca3af" }}>
                        No qualifications listed
                      </span>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="sj-card-footer">
                    <button
                      className="sj-view-btn"
                      onClick={() => setSelectedJob(job.jobId)}
                    >
                      View Details →
                    </button>
                  </div>
                </div>
              ) : null
            )}
          </div>
        ) : (
          <div className="sj-empty">
            <div className="sj-empty-icon">
              <FontAwesomeIcon icon={faBookmark} />
            </div>
            <h3>No saved jobs yet</h3>
            <p>Jobs you save will appear here for easy access.</p>
          </div>
        )}
      </div>
    </>
  );
};

export default SavedJobs;