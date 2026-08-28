import React, { useState, useEffect, useMemo, useRef } from "react";
import axios from "../../../../api/axiosInstance";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCalendarAlt,
  faChevronDown,
  faTrash,
  faEdit,
  faPlay,
  faPause,
  faSearch,
  faClock,
  faCheckCircle,
  faChartLine,
  faSpinner,
  faBuilding,
  faLocationDot,
  faCalendarDays,
  faBriefcase,
  faArrowLeft,
} from "@fortawesome/free-solid-svg-icons";

// Reusable Statistics Card Component
const StatCard = ({
  title,
  value,
  icon,
  iconColorClass,
  iconBgClass,
  textClass,
  bgClass,
}) => (
  <div
    className={`${bgClass} px-5 py-4 rounded-[1.25rem] flex items-center gap-4 transition-transform duration-300 hover:-translate-y-0.5`}
  >
    <div
      className={`w-11 h-11 rounded-full flex items-center justify-center text-lg flex-shrink-0 ${iconBgClass} ${iconColorClass}`}
    >
      <FontAwesomeIcon icon={icon} />
    </div>
    <div className="flex flex-col justify-center">
      <span
        className={`text-[9px] font-extrabold uppercase tracking-widest leading-none mb-1.5 ${textClass}`}
      >
        {title}
      </span>
      <span className="text-[22px] font-bold text-slate-800 leading-none">
        {value}
      </span>
    </div>
  </div>
);

// Reusable Custom Audio Player Component
const AudioPlayer = ({ src }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => setDuration(audio.duration);
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [src]);

  const togglePlay = () => {
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleSliderChange = (e) => {
    const time = parseFloat(e.target.value);
    audioRef.current.currentTime = time;
    setCurrentTime(time);
  };

  const formatTime = (time) => {
    if (isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
  };

  return (
    <div className="flex items-center gap-3 bg-slate-50 border border-slate-100 p-3 rounded-2xl w-full max-w-sm mt-1.5 shadow-[0_4px_15px_rgba(0,0,0,0.01)]">
      <audio ref={audioRef} src={src} preload="metadata" />
      <button
        onClick={togglePlay}
        className="w-9 h-9 rounded-full bg-indigo-600 text-white flex items-center justify-center hover:bg-indigo-700 transition active:scale-95 shadow-sm shrink-0"
      >
        <FontAwesomeIcon
          icon={isPlaying ? faPause : faPlay}
          className="text-xs"
        />
      </button>
      <div className="flex-1 flex flex-col gap-0.5">
        <input
          type="range"
          min={0}
          max={duration || 100}
          value={currentTime}
          onChange={handleSliderChange}
          className="w-full accent-indigo-600 h-1 bg-slate-200 rounded-lg cursor-pointer"
        />
        <div className="flex items-center justify-between text-[10px] text-slate-450 font-bold tracking-wider">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>
    </div>
  );
};

// Format date range helper for InternshipCard
const fmtDateRange = (start, end) => {
  if (!start && !end) return "Flexible Dates";
  const startStr = start
    ? new Date(start).toLocaleDateString("en-US", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "";
  const endStr = end
    ? new Date(end).toLocaleDateString("en-US", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "";
  if (startStr && endStr) return `${startStr} - ${endStr}`;
  return startStr || endStr;
};

// Reusable Internship Selection Card
const InternshipCard = ({ internship, onSelect }) => (
  <div className="bg-white border border-slate-100 rounded-xl p-5 flex flex-col sm:flex-row gap-4 shadow-[0_2px_15px_rgb(0,0,0,0.02)] hover:shadow-md hover:border-indigo-100 transition-all duration-300">
    {/* Logo */}
    {internship.imgUrl ? (
      <img
        src={internship.imgUrl}
        alt={internship.jobTitle}
        className="w-16 h-16 rounded-xl object-contain bg-slate-50 border border-slate-100 flex-shrink-0"
      />
    ) : (
      <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100 flex items-center justify-center flex-shrink-0 shadow-sm">
        <FontAwesomeIcon
          icon={faBriefcase}
          className="text-indigo-300 text-xl"
        />
      </div>
    )}

    {/* Info */}
    <div className="flex-1 min-w-0 flex flex-col justify-center">
      <h3 className="text-sm font-bold text-slate-800 truncate mb-1">
        {internship.jobTitle}
      </h3>
      <p className="text-xs text-indigo-500 font-semibold mb-2 flex items-center gap-1.5">
        <FontAwesomeIcon
          icon={faBuilding}
          className="text-[10px] text-indigo-300"
        />
        {internship.companyName}
      </p>
      <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-400 font-medium">
        {internship.location && (
          <span className="flex items-center gap-1.5">
            <FontAwesomeIcon icon={faLocationDot} className="text-[10px]" />
            {internship.location}
          </span>
        )}
        {(internship.startDate || internship.endDateOrDuration) && (
          <span className="flex items-center gap-1.5">
            <FontAwesomeIcon icon={faCalendarDays} className="text-[10px]" />
            {fmtDateRange(internship.startDate, internship.endDateOrDuration)}
          </span>
        )}
      </div>

      {internship.qualifications?.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {internship.qualifications.slice(0, 4).map((q, i) => (
            <span
              key={i}
              className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2.5 py-1 rounded-full uppercase tracking-wide"
            >
              {q}
            </span>
          ))}
          {internship.qualifications.length > 4 && (
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide px-1 py-1">
              +{internship.qualifications.length - 4} more
            </span>
          )}
        </div>
      )}
    </div>

    {/* Action Button */}
    <div className="flex items-center sm:pl-4 sm:border-l sm:border-slate-100 mt-4 sm:mt-0">
      <button
        onClick={() => onSelect(internship._id)}
        className="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition flex items-center justify-center gap-2 text-xs shadow-sm hover:shadow-md active:scale-95"
      >
        <FontAwesomeIcon icon={faCalendarAlt} className="text-[11px]" />
        View Schedule
      </button>
    </div>
  </div>
);

const MockInterviewResults = () => {
  const partnerId = localStorage.getItem("partnerId");

  // State Management
  const [internships, setInternships] = useState([]);
  const [selectedInternshipId, setSelectedInternshipId] = useState("");
  const [mockInterviews, setMockInterviews] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Active filters and views
  const [activeMockId, setActiveMockId] = useState(null); // Which mock interview card is expanded to show student list
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL"); // ALL, COMPLETED, UPCOMING, MISSED
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 6;
  const [currentInternshipPage, setCurrentInternshipPage] = useState(1);
  const INTERNSHIPS_PER_PAGE = 6;

  // Modals / Drawer / Toggles
  const [selectedSubmission, setSelectedSubmission] = useState(null); // Side Drawer
  const [editingSchedule, setEditingSchedule] = useState(null); // Schedule update Modal
  const [editFormData, setEditFormData] = useState({
    date: "",
    startTime: "",
    endTime: "",
  });
  const [deletingScheduleId, setDeletingScheduleId] = useState(null); // Delete schedule Modal
  const [isTimelineOpen, setIsTimelineOpen] = useState(false); // Timeline accordion toggle

  const studentListRef = useRef(null);

  // Fetch all partner internships on mount
  useEffect(() => {
    if (!partnerId) {
      setError("Partner Session not found. Please log in.");
      setLoading(false);
      return;
    }

    const fetchInternships = async () => {
      try {
        const { data } = await axios.get(`/api/interns/partner/${partnerId}`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token") || localStorage.getItem("partnerToken")}`,
          },
        });
        const items = (data?.data || []).filter(
          (item) => item.internshipType !== "FREE",
        );
        setInternships(items);
        setInternships(items);
        setLoading(false);
      } catch (err) {
        console.error("Failed to load internships:", err);
        setError("Could not load internships. Please refresh.");
        setLoading(false);
      }
    };
    fetchInternships();
  }, [partnerId]);

  // Fetch mock interviews, submissions, and students whenever the selected internship changes
  useEffect(() => {
    if (!selectedInternshipId) return;

    const fetchInternshipData = async () => {
      setLoading(true);
      setError(null);
      try {
        // 1. Fetch Mock Interview schedule configurations
        const { data: miList } = await axios.get(
          `/api/mock-interviews/internship/${selectedInternshipId}`,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("token") || localStorage.getItem("partnerToken")}`,
            },
          },
        );
        setMockInterviews(miList || []);

        // 2. Fetch completed student results
        const { data: subData } = await axios.get(
          "/api/schedule/mock-interview-results",
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("token") || localStorage.getItem("partnerToken")}`,
            },
          },
        );
        const uniqueSubsMap = new Map();
        
        (subData.submissions || [])
          .filter((sub) => sub.internshipId?._id === selectedInternshipId)
          .forEach((sub) => {
            const studentIdStr = sub.studentId?._id?.toString() || sub.studentId?.toString();
            const subKey = studentIdStr + "|" + sub.scheduleDate;
            
            if (!uniqueSubsMap.has(subKey)) {
              const uniqueAnswers = [];
              const seen = new Set();
              let newTotalScore = 0;
              
              (sub.answers || []).forEach((ans) => {
                const ansKey = (ans.questionText || "").trim().toLowerCase();
                if (ansKey && !seen.has(ansKey)) {
                  seen.add(ansKey);
                  uniqueAnswers.push(ans);
                  newTotalScore += ans.aiScore || 0;
                }
              });
              
              uniqueSubsMap.set(subKey, {
                ...sub,
                answers: uniqueAnswers,
                totalScore: newTotalScore,
              });
            }
          });
          
        setSubmissions(Array.from(uniqueSubsMap.values()));

        // 3. Fetch active/accepted students in this internship
        let acceptedStudents = [];
        try {
          const { data: offerData } = await axios.get(
            `/api/offer-letters/accepted/${selectedInternshipId}`,
            {
              headers: {
                Authorization: `Bearer ${localStorage.getItem("token") || localStorage.getItem("partnerToken")}`,
              },
            },
          );
          const offerList = offerData?.accepted || [];
          acceptedStudents = offerList
            .filter((offer) => offer.studentId)
            .map((offer) => offer.studentId);
        } catch (appErr) {
          console.log(
            "No accepted offers found or loaded for this internship:",
            appErr,
          );
        }
        setStudents(acceptedStudents);

        setActiveMockId(null);
      } catch (err) {
        console.error("Failed to load internship mock details:", err);
        setError("Failed to load mock interview results. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchInternshipData();
  }, [selectedInternshipId]);

  // Actions
  const handleEditOpen = (mi) => {
    setEditingSchedule(mi);
    setEditFormData({
      date: mi.date ? new Date(mi.date).toISOString().split("T")[0] : "",
      startTime: mi.startTime || "",
      endTime: mi.endTime || "",
    });
  };

  const handleEditSave = async () => {
    if (!editingSchedule) return;
    try {
      await axios.put(
        `/api/mock-interviews/${editingSchedule._id}`,
        editFormData,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token") || localStorage.getItem("partnerToken")}`,
          },
        },
      );
      // Refresh current schedule list
      const { data: miList } = await axios.get(
        `/api/mock-interviews/internship/${selectedInternshipId}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token") || localStorage.getItem("partnerToken")}`,
          },
        },
      );
      setMockInterviews(miList || []);
      setEditingSchedule(null);
    } catch (err) {
      alert("Failed to update schedule. Please try again.");
    }
  };

  const handleDeleteSchedule = async () => {
    if (!deletingScheduleId) return;
    try {
      await axios.delete(`/api/mock-interviews/${deletingScheduleId}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token") || localStorage.getItem("partnerToken")}`,
        },
      });
      // Refresh
      const { data: miList } = await axios.get(
        `/api/mock-interviews/internship/${selectedInternshipId}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token") || localStorage.getItem("partnerToken")}`,
          },
        },
      );
      setMockInterviews(miList || []);
      setDeletingScheduleId(null);
      if (activeMockId === deletingScheduleId) {
        setActiveMockId(miList.length > 0 ? miList[0]._id : null);
      }
    } catch (err) {
      alert("Failed to delete scheduled interview.");
    }
  };

  // Computations for Selected Internship
  const stats = useMemo(() => {
    const total = mockInterviews.length;
    const completedCount = submissions.length;
    const upcomingCount = mockInterviews.filter(
      (mi) => mi.date && new Date(mi.date) >= new Date(),
    ).length;

    let totalScoreSum = 0;
    let maxScoreSum = 0;
    submissions.forEach((sub) => {
      totalScoreSum += sub.totalScore || 0;
      maxScoreSum += sub.answers?.length || 5;
    });
    const avgScore =
      completedCount > 0 ? (totalScoreSum / completedCount).toFixed(1) : "0.0";
    const avgMaxScore =
      completedCount > 0 ? Math.round(maxScoreSum / completedCount) : 5;

    return {
      total,
      completed: completedCount,
      upcoming: upcomingCount,
      avgScore,
      avgMaxScore,
    };
  }, [mockInterviews, submissions]);

  // Dynamic student list computation happens in render now.

  // Mock schedule timelines
  const sortedTimeline = useMemo(() => {
    return [...mockInterviews].sort(
      (a, b) => new Date(a.date) - new Date(b.date),
    );
  }, [mockInterviews]);

  if (loading && internships.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 min-h-[400px] text-slate-500 gap-3">
        <FontAwesomeIcon
          icon={faSpinner}
          className="animate-spin text-3xl text-indigo-600"
        />
        <span className="font-semibold text-sm">
          Loading Mock Interview Dashboard...
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-rose-50 border border-rose-100 rounded-3xl p-8 text-center max-w-lg mx-auto mt-10 shadow-sm flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center text-lg">
          ⚠️
        </div>
        <div>
          <h3 className="font-extrabold text-slate-800 text-base">
            Dashboard Error
          </h3>
          <p className="text-xs text-slate-550 font-semibold leading-relaxed mt-1">
            {error}
          </p>
        </div>
      </div>
    );
  }

  if (internships.length === 0) {
    return (
      <div className="bg-white rounded-3xl border border-slate-100 p-12 text-center max-w-xl mx-auto shadow-sm flex flex-col items-center gap-6 mt-10">
        <div className="text-5xl">📁</div>
        <div>
          <h3 className="text-xl font-black text-slate-850">
            No Internships Active
          </h3>
          <p className="text-xs text-slate-400 font-semibold mt-1.5 leading-relaxed">
            Create an internship post first to start scheduling mock interviews.
          </p>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-3.5 bg-slate-900 text-white rounded-2xl font-bold shadow-md hover:bg-slate-800 transition active:scale-98 text-xs uppercase tracking-wide"
        >
          Check Again
        </button>
      </div>
    );
  }

  // Internship Pagination Logic
  const totalInternshipPages =
    Math.ceil(internships.length / INTERNSHIPS_PER_PAGE) || 1;
  const paginatedInternships = internships.slice(
    (currentInternshipPage - 1) * INTERNSHIPS_PER_PAGE,
    currentInternshipPage * INTERNSHIPS_PER_PAGE,
  );

  return (
    <div
      className="flex flex-col gap-6 max-w-7xl mx-auto py-2 font-poppins"
      style={{ fontFamily: '"Poppins", sans-serif' }}
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Mock Interview Management
          </h1>
          <p className="text-slate-500 mt-1">
            Manage student mock interviews, schedules, and evaluation
            transcripts.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4 z-50 mt-4 md:mt-0">
          {selectedInternshipId && (
            <button
              onClick={() => setSelectedInternshipId("")}
              className="px-5 py-2.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-indigo-600 rounded-xl font-bold transition flex items-center justify-center gap-2 text-xs shadow-sm active:scale-95"
            >
              <FontAwesomeIcon icon={faArrowLeft} className="text-[10px]" />
              Back to Internships
            </button>
          )}
        </div>
      </div>

      {!selectedInternshipId ? (
        <div className="flex flex-col gap-4 mt-2">
          {paginatedInternships.map((int) => (
            <InternshipCard
              key={int._id}
              internship={int}
              onSelect={(id) => setSelectedInternshipId(id)}
            />
          ))}

          {/* Pagination */}
          {totalInternshipPages > 1 && (
            <div className="px-6 py-4 flex items-center justify-between bg-transparent">
              <button
                onClick={() =>
                  setCurrentInternshipPage((p) => Math.max(1, p - 1))
                }
                disabled={currentInternshipPage === 1}
                className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
              >
                &lt; Previous
              </button>
              <span className="text-xs font-semibold text-slate-500">
                Page {currentInternshipPage} of {totalInternshipPages}
              </span>
              <button
                onClick={() =>
                  setCurrentInternshipPage((p) =>
                    Math.min(totalInternshipPages, p + 1),
                  )
                }
                disabled={currentInternshipPage === totalInternshipPages}
                className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
              >
                Next &gt;
              </button>
            </div>
          )}
        </div>
      ) : mockInterviews.length === 0 ? (
        /* Empty State */
        <div className="bg-white rounded-3xl border border-slate-100 p-12 text-center shadow-sm flex flex-col items-center gap-6">
          <div className="text-6xl animate-bounce">📋</div>
          <div>
            <h3 className="text-lg font-extrabold text-slate-800">
              No Mock Interviews Scheduled
            </h3>
            <p className="text-xs text-slate-455 font-semibold mt-1 max-w-sm mx-auto leading-relaxed">
              No interview slots have been scheduled for this internship
              schedule yet.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Dashboard Statistics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Total Interviews"
              value={stats.total}
              icon={faCalendarAlt}
              iconColorClass="text-emerald-700"
              iconBgClass="bg-emerald-200/60"
              textClass="text-emerald-700"
              bgClass="bg-emerald-50/80"
            />
            <StatCard
              title="Completed Results"
              value={stats.completed}
              icon={faCheckCircle}
              iconColorClass="text-violet-700"
              iconBgClass="bg-violet-200/60"
              textClass="text-violet-700"
              bgClass="bg-violet-50/80"
            />
            <StatCard
              title="Upcoming Slots"
              value={stats.upcoming}
              icon={faClock}
              iconColorClass="text-lime-700"
              iconBgClass="bg-lime-200/60"
              textClass="text-lime-700"
              bgClass="bg-lime-50/80"
            />
            <StatCard
              title="Average AI Score"
              value={`${stats.avgScore}/${stats.avgMaxScore}`}
              icon={faChartLine}
              iconColorClass="text-amber-700"
              iconBgClass="bg-amber-200/60"
              textClass="text-amber-700"
              bgClass="bg-amber-50/80"
            />
          </div>

          <div className="flex flex-col gap-6">
            {/* Top row with Title */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <h3 className="text-xs font-bold text-slate-450 uppercase tracking-widest flex items-center gap-2">
                <span className="w-1.5 h-3 rounded-full bg-indigo-500"></span>{" "}
                Scheduled Slots
              </h3>

              {/* Interview Timeline Dropdown */}
              <div className="relative z-20">
                <div
                  className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-2.5 cursor-pointer flex justify-between items-center gap-6 hover:bg-blue-100/50 transition-colors shadow-sm"
                  onClick={() => setIsTimelineOpen(!isTimelineOpen)}
                >
                  <div>
                    <h3 className="text-[10px] font-extrabold text-blue-900 uppercase tracking-widest">
                      Interview Timeline
                    </h3>
                    <p className="text-[9px] text-blue-500 font-bold uppercase tracking-wider mt-0.5">
                      Chronological slots
                    </p>
                  </div>
                  <FontAwesomeIcon
                    icon={faChevronDown}
                    className={`text-blue-500 text-xs transition-transform duration-300 ${isTimelineOpen ? "rotate-180" : ""}`}
                  />
                </div>

                {/* Timeline Absolute Dropdown Menu */}
                <div
                  className={`absolute right-0 top-full mt-2 w-64 bg-white border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.08)] rounded-2xl z-20 transition-all duration-300 origin-top-right ${isTimelineOpen ? "scale-100 opacity-100" : "scale-95 opacity-0 pointer-events-none"}`}
                >
                  <div className="relative border-l border-slate-100 pl-5 ml-8 space-y-6 pb-6 pt-5">
                    {sortedTimeline.map((mi, i) => {
                      const isUpcoming =
                        mi.date && new Date(mi.date) >= new Date();
                      const dateStr = mi.date
                        ? new Date(mi.date).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })
                        : "N/A";

                      return (
                        <div key={mi._id} className="relative group">
                          {/* Timeline dot */}
                          <div
                            className={`absolute -left-[26px] top-1 w-3.5 h-3.5 rounded-full border-2 bg-white transition group-hover:scale-110 ${
                              isUpcoming
                                ? "border-blue-500 ring-4 ring-blue-50"
                                : "border-emerald-500 ring-4 ring-emerald-50"
                            }`}
                          />

                          <div className="flex flex-col">
                            <span className="text-xs font-black text-slate-800 leading-tight">
                              {`Mock Interview ${i + 1} (${mi.startTime || "N/A"} - ${mi.endTime || "N/A"})`}
                            </span>
                            <span className="text-[10px] text-slate-505 font-semibold mt-1">
                              {dateStr}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Mock Interview Cards Section */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {mockInterviews.map((mi, idx) => {
                const isActive = activeMockId === mi._id;
                const dateStr = mi.date
                  ? new Date(mi.date).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })
                  : "N/A";
                const isUpcoming = mi.date && new Date(mi.date) >= new Date();

                return (
                  <div
                    key={mi._id}
                    onClick={() => {
                      setActiveMockId(mi._id);
                      setCurrentPage(1);
                      if (studentListRef.current) {
                        setTimeout(() => {
                          studentListRef.current.scrollIntoView({
                            behavior: "smooth",
                            block: "start",
                          });
                        }, 100);
                      }
                    }}
                    className={`p-5 rounded-[1.75rem] border transition-all duration-300 cursor-pointer flex flex-col relative hover:-translate-y-0.5 ${
                      isActive
                        ? "bg-indigo-50/60 border-indigo-500 ring-4 ring-indigo-500/10 shadow-[0_12px_25px_rgba(99,102,241,0.08)]"
                        : "bg-indigo-50/30 border-indigo-200 hover:border-indigo-300 shadow-[0_8px_30px_rgb(0,0,0,0.02)] hover:shadow-[0_12px_30px_rgb(0,0,0,0.04)]"
                    }`}
                  >
                    {/* Title & Status */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-2 h-2 rounded-full ${isUpcoming ? "bg-blue-500 animate-pulse" : "bg-emerald-500"}`}
                        ></span>
                        <span className="text-sm font-extrabold text-slate-800">{`Mock Interview ${idx + 1}`}</span>
                      </div>
                      <span
                        className={`text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider border ${
                          isUpcoming
                            ? "bg-blue-50 text-blue-600 border-blue-100/50"
                            : "bg-emerald-50 text-emerald-600 border-emerald-100/50"
                        }`}
                      >
                        {isUpcoming ? "Upcoming" : "Past"}
                      </span>
                    </div>

                    {/* Date & Time Segment */}
                    <div className="flex flex-col gap-2 bg-slate-50/50 p-3.5 rounded-2xl border border-slate-100/60 mb-4">
                      <div className="flex items-center gap-2.5 text-xs text-slate-605 font-bold">
                        <FontAwesomeIcon
                          icon={faCalendarAlt}
                          className="text-indigo-500 text-[11px]"
                        />
                        <span>{dateStr}</span>
                      </div>
                      <div className="flex items-center gap-2.5 text-xs text-slate-605 font-bold">
                        <FontAwesomeIcon
                          icon={faClock}
                          className="text-indigo-500 text-[11px]"
                        />
                        <span>
                          {mi.startTime || "N/A"} - {mi.endTime || "N/A"}
                        </span>
                      </div>
                    </div>

                    {/* Student counter dashboard breakdown */}
                    <div className="grid grid-cols-3 bg-white border border-slate-100 rounded-2xl py-3.5 mb-4 shadow-[0_4px_12px_rgba(0,0,0,0.01)] text-center divide-x divide-slate-100">
                      <div>
                        <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider block">
                          Total
                        </span>
                        <span className="text-sm font-black text-indigo-650 mt-1 block">
                          {students.length}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider block">
                          Done
                        </span>
                        <span className="text-sm font-black text-emerald-600 mt-1 block">
                          {(() => {
                            const formattedDate = mi.date
                              ? new Date(mi.date).toISOString().split("T")[0]
                              : "";
                            const doneCount = submissions.filter((s) => {
                              const isSameDate =
                                s.scheduleDate === formattedDate;
                              const subStudentId =
                                s.studentId?._id || s.studentId;
                              const isStudentEnrolled = students.some(
                                (std) =>
                                  std._id?.toString() ===
                                  subStudentId?.toString(),
                              );
                              return isSameDate && isStudentEnrolled;
                            }).length;
                            return doneCount;
                          })()}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider block">
                          Pending
                        </span>
                        <span className="text-sm font-black text-slate-500 mt-1 block">
                          {(() => {
                            const formattedDate = mi.date
                              ? new Date(mi.date).toISOString().split("T")[0]
                              : "";
                            const doneCount = submissions.filter((s) => {
                              const isSameDate =
                                s.scheduleDate === formattedDate;
                              const subStudentId =
                                s.studentId?._id || s.studentId;
                              const isStudentEnrolled = students.some(
                                (std) =>
                                  std._id?.toString() ===
                                  subStudentId?.toString(),
                              );
                              return isSameDate && isStudentEnrolled;
                            }).length;
                            return students.length - doneCount;
                          })()}
                        </span>
                      </div>
                    </div>

                    {/* Control buttons */}
                    <div className="flex items-center gap-2 mt-auto pt-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditOpen(mi);
                        }}
                        className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold transition flex items-center justify-center gap-1.5 text-xs shadow-sm hover:shadow-md active:scale-98"
                      >
                        <FontAwesomeIcon
                          icon={faEdit}
                          className="text-[10px]"
                        />{" "}
                        Reschedule
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingScheduleId(mi._id);
                        }}
                        className="p-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-2xl font-bold transition border border-rose-100/80 shadow-sm hover:shadow-md hover:scale-105 active:scale-95"
                        title="Remove Schedule"
                      >
                        <FontAwesomeIcon
                          icon={faTrash}
                          className="text-[10px]"
                        />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Active Mock Interview Student Table */}
            {activeMockId &&
              (() => {
                const mi = mockInterviews.find((m) => m._id === activeMockId);
                if (!mi) return null;
                const idx = mockInterviews.findIndex(
                  (m) => m._id === activeMockId,
                );

                const formattedMockDateStr = mi.date
                  ? new Date(mi.date).toISOString().split("T")[0]
                  : "";
                const today = new Date().toISOString().split("T")[0];
                const isPast =
                  formattedMockDateStr && formattedMockDateStr < today;

                const miStudentRows = students.map((std) => {
                  const sub = submissions.find((s) => {
                    const subStudentId = s.studentId?._id || s.studentId;
                    return (
                      subStudentId?.toString() === std._id?.toString() &&
                      s.scheduleDate === formattedMockDateStr
                    );
                  });
                  let status = "Upcoming";
                  if (sub) status = "Completed";
                  else if (isPast) status = "Missed";

                  return {
                    student: std,
                    status,
                    submission: sub || null,
                    score: sub ? `${sub.totalScore}/${sub.answers?.length || 5}` : "-",
                    completedDate: sub
                      ? new Date(sub.submittedAt).toLocaleDateString()
                      : "-",
                  };
                });

                const filteredMiStudents = miStudentRows.filter((row) => {
                  const name =
                    `${row.student.firstName || ""} ${row.student.lastName || ""}`.toLowerCase();
                  const matchesSearch = name.includes(
                    searchQuery.toLowerCase(),
                  );
                  const matchesStatus =
                    statusFilter === "ALL" ||
                    row.status.toUpperCase() === statusFilter;
                  return matchesSearch && matchesStatus;
                });

                // Pagination Logic
                const totalPages =
                  Math.ceil(filteredMiStudents.length / ITEMS_PER_PAGE) || 1;
                const paginatedStudents = filteredMiStudents.slice(
                  (currentPage - 1) * ITEMS_PER_PAGE,
                  currentPage * ITEMS_PER_PAGE,
                );

                return (
                  <div
                    ref={studentListRef}
                    className="bg-[#f8f9fc] rounded-3xl border border-slate-100/50 shadow-sm flex flex-col mt-6 overflow-hidden transition-all duration-300"
                  >
                    {/* Header */}
                    <div className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <FontAwesomeIcon
                          icon={faChevronDown}
                          className="text-indigo-500 text-sm rotate-180"
                          onClick={() => setActiveMockId(null)}
                          cursor="pointer"
                        />
                        <div>
                          <h4 className="text-sm font-bold text-indigo-900">
                            {`Mock Interview ${idx + 1} - Students Enrolled`}
                          </h4>
                          <p className="text-[10px] font-bold uppercase tracking-wide mt-0.5 text-indigo-500/80">
                            Enrolled List
                          </p>
                        </div>
                      </div>

                      {/* Search & Filters */}
                      <div className="flex items-center gap-3 h-9">
                        <div className="relative h-full flex items-center">
                          <input
                            type="text"
                            placeholder="Search Student..."
                            value={searchQuery}
                            onChange={(e) => {
                              setSearchQuery(e.target.value);
                              setCurrentPage(1);
                            }}
                            className="!mt-0 h-full pl-8 pr-4 bg-white border border-indigo-50 rounded-xl text-xs font-semibold outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 w-44 shadow-[0_2px_10px_rgb(0,0,0,0.02)] box-border"
                          />
                          <FontAwesomeIcon
                            icon={faSearch}
                            className="absolute left-3 text-indigo-300 text-[10px]"
                          />
                        </div>
                        <select
                          value={statusFilter}
                          onChange={(e) => {
                            setStatusFilter(e.target.value);
                            setCurrentPage(1);
                          }}
                          className="h-full px-3 bg-white border border-indigo-50 rounded-xl text-xs font-semibold outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 cursor-pointer shadow-[0_2px_10px_rgb(0,0,0,0.02)] text-slate-700 box-border"
                        >
                          <option value="ALL">All Statuses</option>
                          <option value="COMPLETED">Completed</option>
                          <option value="UPCOMING">Upcoming</option>
                          <option value="MISSED">Missed</option>
                        </select>
                      </div>
                    </div>

                    {/* Table */}
                    <div className="px-6 pb-6">
                      <div className="overflow-x-auto bg-white rounded-2xl shadow-[0_2px_15px_rgb(0,0,0,0.02)]">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-slate-50">
                              <th className="w-[35%] py-4 px-5 text-[10px] font-extrabold text-slate-400 uppercase tracking-widest text-left">
                                Student Name
                              </th>
                              <th className="w-[15%] py-4 px-5 text-[10px] font-extrabold text-slate-400 uppercase tracking-widest text-left">
                                Status
                              </th>
                              <th className="w-[15%] py-4 px-5 text-[10px] font-extrabold text-slate-400 uppercase tracking-widest text-left">
                                Score
                              </th>
                              <th className="w-[20%] py-4 px-5 text-[10px] font-extrabold text-slate-400 uppercase tracking-widest text-left">
                                Completed Date
                              </th>
                              <th className="w-[15%] py-4 px-5 text-[10px] font-extrabold text-slate-400 uppercase tracking-widest text-right">
                                Actions
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {paginatedStudents.map(
                              ({
                                student,
                                status,
                                submission,
                                score,
                                completedDate,
                              }) => (
                                <tr
                                  key={student._id}
                                  className="hover:bg-slate-50/50 transition-colors"
                                >
                                  <td className="py-4 px-5">
                                    <div className="flex items-center gap-3">
                                      <div className="w-7 h-7 flex-shrink-0 rounded-full bg-indigo-50 flex items-center justify-center text-[10px] text-indigo-600 font-bold uppercase shadow-sm">
                                        {student.firstName
                                          ? `${student.firstName[0]}${student.lastName?.[0] || ""}`
                                          : student.email?.[0] || "?"}
                                      </div>
                                      <span className="text-xs font-semibold text-slate-500 truncate">
                                        {student.email}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="py-4 px-5 text-left">
                                    <span
                                      className={`inline-flex items-center justify-center px-3 py-1 rounded-full text-[9px] font-extrabold uppercase tracking-wider ${
                                        status === "Completed"
                                          ? "bg-emerald-50 text-emerald-700"
                                          : status === "Missed"
                                            ? "bg-rose-50 text-rose-700"
                                            : "bg-blue-50 text-blue-700"
                                      }`}
                                    >
                                      {status}
                                    </span>
                                  </td>
                                  <td className="py-4 px-5 text-left text-xs font-black text-slate-700">
                                    {score}
                                  </td>
                                  <td className="py-4 px-5 text-left text-xs text-slate-500 font-semibold">
                                    {completedDate}
                                  </td>
                                  <td className="py-4 px-5 text-right">
                                    {submission ? (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setSelectedSubmission(submission)
                                        }
                                        className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg text-[10px] font-extrabold tracking-wide uppercase transition active:scale-95 shadow-sm"
                                      >
                                        View Answers
                                      </button>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => handleEditOpen(mi)}
                                        className="px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-500 rounded-lg text-[10px] font-extrabold tracking-wide uppercase transition"
                                      >
                                        Reschedule
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              ),
                            )}

                            {filteredMiStudents.length === 0 && (
                              <tr>
                                <td
                                  colSpan={5}
                                  className="py-8 text-center text-xs text-slate-450 italic"
                                >
                                  No students matching current filters found.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                      <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-white rounded-b-3xl">
                        <button
                          onClick={() =>
                            setCurrentPage((p) => Math.max(1, p - 1))
                          }
                          disabled={currentPage === 1}
                          className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                        >
                          &lt; Previous
                        </button>
                        <span className="text-xs font-semibold text-slate-500">
                          Page {currentPage} of {totalPages}
                        </span>
                        <button
                          onClick={() =>
                            setCurrentPage((p) => Math.min(totalPages, p + 1))
                          }
                          disabled={currentPage === totalPages}
                          className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                        >
                          Next &gt;
                        </button>
                      </div>
                    )}
                  </div>
                );
              })()}
          </div>
        </>
      )}

      {/* MODAL: Reschedule / Edit Schedule */}
      {editingSchedule && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-xl border border-slate-100 w-full max-w-md p-6 flex flex-col gap-5">
            <div>
              <h3 className="text-base font-extrabold text-slate-805">
                Reschedule Slot
              </h3>
              <p className="text-[10px] text-indigo-650 font-bold uppercase tracking-wider mt-0.5">
                Update date and timing bounds
              </p>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  Date
                </label>
                <input
                  type="date"
                  value={editFormData.date}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, date: e.target.value })
                  }
                  className="bg-slate-50 border border-slate-200/80 rounded-2xl px-4 py-3 text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 cursor-pointer"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    Start Time
                  </label>
                  <input
                    type="time"
                    value={editFormData.startTime}
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        startTime: e.target.value,
                      })
                    }
                    className="bg-slate-50 border border-slate-200/80 rounded-2xl px-4 py-3 text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 cursor-pointer"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    End Time
                  </label>
                  <input
                    type="time"
                    value={editFormData.endTime}
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        endTime: e.target.value,
                      })
                    }
                    className="bg-slate-50 border border-slate-200/80 rounded-2xl px-4 py-3 text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 cursor-pointer"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-55">
              <button
                type="button"
                onClick={() => setEditingSchedule(null)}
                className="px-4 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-550 rounded-xl font-bold transition text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleEditSave}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-750 text-white rounded-xl font-bold transition shadow-md text-xs"
              >
                Save Updates
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Delete Schedule Confirmation */}
      {deletingScheduleId && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-xl border border-slate-100 w-full max-w-sm p-6 flex flex-col gap-5 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center text-lg mx-auto border border-rose-100">
              <FontAwesomeIcon icon={faTrash} />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-850">
                Delete Schedule?
              </h3>
              <p className="text-xs text-slate-450 font-semibold mt-1 leading-relaxed">
                This will remove the scheduled mock interview for all selected
                students.
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingScheduleId(null)}
                className="flex-1 py-3 bg-slate-50 hover:bg-slate-100 text-slate-550 rounded-xl font-bold transition text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteSchedule}
                className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold transition shadow-sm text-xs"
              >
                Delete Slot
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SIDE DRAWER: Student Answers Details */}
      {selectedSubmission && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex justify-end">
          <div className="bg-white w-full max-w-xl h-full shadow-2xl flex flex-col animate-slide-in relative border-l border-slate-100">
            {/* Drawer Header */}
            <div className="px-6 py-5 flex items-center justify-between bg-slate-900 text-white shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center shadow-inner text-indigo-400">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="w-4 h-4"
                  >
                    <path
                      fillRule="evenodd"
                      d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25Zm0 16.5a6.75 6.75 0 1 0 0-13.5 6.75 6.75 0 0 0 0 13.5Zm0-2.25a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Zm0-2.25a2.25 2.25 0 1 0 0-4.5 2.25 2.25 0 0 0 0 4.5Z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-bold leading-tight">
                    {(() => {
                      const sId =
                        selectedSubmission.studentId?._id ||
                        selectedSubmission.studentId;
                      const studentObj =
                        students.find((s) => s._id === sId) ||
                        selectedSubmission.studentId;
                      const fName = studentObj?.firstName || "";
                      const lName = studentObj?.lastName || "";
                      const fullName = `${fName} ${lName}`.trim();
                      return fullName || studentObj?.email || "Student Results";
                    })()}
                  </h3>
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                    Mock Evaluation Transcript
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedSubmission(null)}
                className="text-slate-400 hover:text-white p-2 rounded-full hover:bg-slate-800 transition"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2.5"
                    d="M6 18L18 6M6 6l12 12"
                  ></path>
                </svg>
              </button>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50 flex flex-col gap-6">
              {/* Circular Gauge Scorecard */}
              <div className="text-center bg-white p-5 rounded-2xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.015)] flex flex-col items-center gap-3">
                <div className="relative w-24 h-24 flex items-center justify-center">
                  <svg
                    className="w-full h-full transform -rotate-90"
                    viewBox="0 0 36 36"
                  >
                    <path
                      className="text-slate-100"
                      strokeWidth="3.2"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                    <path
                      className="text-indigo-600 transition-all duration-1000"
                      strokeDasharray={`${((selectedSubmission.totalScore ?? 0) / (selectedSubmission.answers?.length || 5)) * 100}, 100`}
                      strokeWidth="3.2"
                      strokeLinecap="round"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                  </svg>
                  <div className="absolute text-center flex flex-col">
                    <span className="text-2xl font-black text-slate-800 leading-none">
                      {selectedSubmission.totalScore ?? 0}
                      <span className="text-xs text-slate-400">/{selectedSubmission.answers?.length || 5}</span>
                    </span>
                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                      Score
                    </span>
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-extrabold text-slate-800">
                    Transcript Details
                  </h4>
                  <p className="text-[10px] text-indigo-600 font-bold tracking-wide uppercase mt-0.5">
                    Evaluation metrics synchronized
                  </p>
                </div>
              </div>

              {/* Answers list */}
              <div className="flex flex-col gap-4">
                <h4 className="text-[10px] font-bold text-slate-450 uppercase tracking-widest flex items-center gap-2">
                  <span className="w-1.5 h-3 bg-indigo-500 rounded-full"></span>{" "}
                  Interview Transcripts
                </h4>

                {(selectedSubmission.answers || []).map((ans, idx) => {
                  const score = ans.aiScore ?? 0;
                  const scoreLabel =
                    score === 1
                      ? "Correct"
                      : score === 0.5
                        ? "Partially Correct"
                        : "Needs Improvement";
                  const colorClass =
                    score === 1
                      ? "bg-emerald-50 text-emerald-800 border-emerald-100"
                      : score === 0.5
                        ? "bg-amber-50 text-amber-800 border-amber-100"
                        : "bg-rose-50 text-rose-800 border-rose-100";

                  return (
                    <div
                      key={idx}
                      className="bg-white p-5 rounded-2xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.01)] flex flex-col gap-3"
                    >
                      <div>
                        <span className="text-[9px] text-slate-700 font-extrabold uppercase tracking-wider block mb-1">
                          Question {idx + 1}
                        </span>
                        <p className="text-xs text-slate-600 font-semibold leading-relaxed">
                          {ans.questionText}
                        </p>
                      </div>

                      <div className="bg-slate-50/50 p-3.5 rounded-xl border border-slate-100/50">
                        <span className="text-[9px] text-slate-455 font-bold uppercase tracking-wider block mb-1">
                          Student Response
                        </span>
                        <p className="text-xs text-slate-705 font-medium leading-relaxed">
                          {ans.answerText || (
                            <span className="text-slate-400 italic">
                              No text response provided
                            </span>
                          )}
                        </p>
                        {ans.audioUrl && (
                          <div className="mt-2.5">
                            <span className="text-[9px] text-slate-455 font-bold uppercase tracking-wider block mb-1">
                              Voice Recording
                            </span>
                            <AudioPlayer src={ans.audioUrl} />
                          </div>
                        )}
                        {!ans.audioUrl && (
                          <span className="text-[9px] text-slate-400 font-semibold block mt-1">
                            No voice recording available.
                          </span>
                        )}
                      </div>

                      {ans.aiFeedback && (
                        <div
                          className={`p-3 rounded-xl border text-[11px] font-semibold leading-relaxed flex flex-col gap-1.5 ${colorClass}`}
                        >
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider border ${
                                score === 1
                                  ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                                  : score === 0.5
                                    ? "bg-amber-100 text-amber-800 border-amber-200"
                                    : "bg-rose-100 text-rose-800 border-rose-200"
                              }`}
                            >
                              {scoreLabel}
                            </span>
                            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                              AI Evaluation
                            </span>
                          </div>
                          <p>{ans.aiFeedback}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MockInterviewResults;
