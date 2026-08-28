import React, { useEffect, useState } from "react";
import axios from "../../../../api/axiosInstance";
import { Skeleton } from "antd";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { 
  faCheckCircle, faTimesCircle, faExclamationCircle, 
  faBuilding, faMapMarkerAlt, faClock, faMoneyBillWave, faCalendarAlt, faTimes
} from "@fortawesome/free-solid-svg-icons";

const UserAttendance = () => {
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const userInfo = (JSON.parse(localStorage.getItem("studentInfo")) || JSON.parse(localStorage.getItem("userInfo")));
  const studentId = userInfo?.studentId || userInfo?._id;

  useEffect(() => {
    const fetchOffers = async () => {
      if (!studentId) {
        setError("Student ID not found. Please log in.");
        setLoading(false);
        return;
      }

      try {
        const res = await axios.get(`/api/offer-letters/student/${studentId}`);
        setOffers(res.data || []);
      } catch (err) {
        console.error("Error fetching offers:", err);
        setError("Failed to load offer letters for attendance.");
      } finally {
        setLoading(false);
      }
    };

    fetchOffers();
  }, [studentId]);

  if (loading) {
    return (
      <div className="w-full p-2 font-poppins sm:p-3 lg:p-4">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Attendance Tracker</h2>
        <Skeleton active paragraph={{ rows: 4 }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full p-2 font-poppins sm:p-3 lg:p-4">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Attendance Tracker</h2>
        <p className="text-red-500 font-medium">{error}</p>
      </div>
    );
  }

  const acceptedOffers = offers.filter(
    (o) => o.status?.toLowerCase() === "accepted" && o.internshipId
  );

  return (
    <div className="w-full p-2 font-poppins sm:p-3 lg:p-4 max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-600">
          <FontAwesomeIcon icon={faCalendarAlt} className="text-xl" />
        </div>
        <h2 className="text-2xl font-bold text-gray-800">Attendance Tracker</h2>
      </div>
      
      {acceptedOffers.length === 0 ? (
        <div className="bg-white p-8 text-center rounded-xl border border-gray-200 shadow-sm">
          <FontAwesomeIcon icon={faCalendarAlt} className="text-4xl text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">No active internships found to track attendance.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {acceptedOffers.map((offer) => {
            const iid = typeof offer.internshipId === "object" && offer.internshipId !== null
                ? offer.internshipId._id || String(offer.internshipId)
                : String(offer.internshipId);
            const title = offer.internshipTitle || offer.position || "Internship";
            return (
              <StudentAttendanceCard
                key={iid}
                internshipId={iid}
                internshipTitle={title}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

// --- Attendance Summary Component ---
const StudentAttendanceCard = ({ internshipId, internshipTitle }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [job, setJob] = useState(null);
  const [jobLoading, setJobLoading] = useState(true);

  // OTP Session Status
  const [sessionStatus, setSessionStatus] = useState(null);
  const [otpInput, setOtpInput] = useState('');
  const [submittingOtp, setSubmittingOtp] = useState(false);
  const [otpMessage, setOtpMessage] = useState(null);

  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const fetchAttendanceAndJob = async () => {
      try {
        const userToken = localStorage.getItem("userToken");
        
        // Fetch Attendance
        const attRes = await axios.get(`/api/attendance/my/${internshipId}`, {
          headers: { Authorization: `Bearer ${userToken}` }
        });
        setData(attRes.data);
      } catch (err) {
        if (err.response?.status === 404) {
          setError("Attendance tracking not enabled for this schedule.");
        } else {
          setError("Failed to load attendance.");
        }
      } finally {
        setLoading(false);
      }

      try {
        // Fetch Job Details
        const jobRes = await axios.get(`/api/interns/${internshipId}`);
        setJob(jobRes.data);
      } catch (err) {
        console.error("Failed to fetch job details:", err);
      } finally {
        setJobLoading(false);
      }
    };

    const fetchSessionStatus = async () => {
      try {
        const userToken = localStorage.getItem("userToken");
        const todayStr = new Date().toISOString();
        const res = await axios.get(`/api/attendance/session-status/${internshipId}`, {
          params: { timetableDate: todayStr },
          headers: { Authorization: `Bearer ${userToken}` }
        });
        setSessionStatus(res.data);
      } catch (err) {
        setSessionStatus(null);
      }
    };

    fetchAttendanceAndJob();
    fetchSessionStatus();

    const interval = setInterval(fetchSessionStatus, 30000);
    return () => clearInterval(interval);
  }, [internshipId]);

  const handleSubmitOtp = async (e) => {
    e.preventDefault();
    if (otpInput.length !== 4) return;
    setSubmittingOtp(true);
    setOtpMessage(null);
    try {
      const userToken = localStorage.getItem("userToken");
      const timetableDate = sessionStatus?.slotDate || new Date().toISOString();
      await axios.post('/api/attendance/submit-otp', {
        internshipId,
        timetableDate,
        otp: otpInput
      }, { headers: { Authorization: `Bearer ${userToken}` } });
      
      setSessionStatus(prev => prev ? { ...prev, alreadyMarked: true } : null);
      
      setTimeout(() => {
        const fetchAttendance = async () => {
          const res = await axios.get(`/api/attendance/my/${internshipId}`, { headers: { Authorization: `Bearer ${userToken}` } });
          setData(res.data);
        };
        fetchAttendance();
      }, 1000);
      
    } catch (err) {
      setOtpMessage({ type: 'error', text: err.response?.data?.message || 'Failed to verify OTP' });
    } finally {
      setSubmittingOtp(false);
    }
  };

  if (loading || jobLoading) {
    return <div className="w-full p-4 border rounded-xl shadow-sm bg-white"><Skeleton active paragraph={{ rows: 3 }} /></div>;
  }

  const companyName = job?.companyName || job?.postedBy || "Company";

  return (
    <>
      <div className="w-full p-4 border rounded-xl shadow-sm relative flex flex-col gap-3 hover:shadow-md transition-shadow bg-white font-poppins flex-grow">
        
        {/* 1. TOP-RIGHT TYPE BADGE */}
        <div className="absolute top-3 right-3 flex items-center gap-2">
          {job?.internshipType && (
            <span className="text-[10px] font-bold bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full uppercase tracking-wider">
              {job.internshipType}
            </span>
          )}
        </div>

        {/* 2. COMPANY + TITLE */}
        <div className="flex items-start gap-3 mt-1">
          <img
            src={job?.imgUrl || "/favicon-512x469.png"}
            alt="Company Logo"
            className="w-10 h-10 rounded-full object-cover flex-shrink-0 border border-gray-100"
            onError={(e) => { e.target.onerror = null; e.target.src = "/favicon-512x469.png"; }}
          />
          <div className="flex-grow min-w-0 pr-12">
            <h5 className="text-base font-bold text-gray-900 truncate">
              {job?.internshipTitle || job?.jobTitle || internshipTitle}
            </h5>
            <p className="text-xs font-semibold text-gray-500 truncate">
              {companyName}
            </p>
          </div>
        </div>

        {/* 3. META: LOCATION, DATES, COMPENSATION */}
        <div className="space-y-1.5 mt-1">
          <p className="flex items-center text-xs font-medium text-gray-500">
            <FontAwesomeIcon icon={faMapMarkerAlt} className="mr-2 text-gray-400 flex-shrink-0" />
            {job?.location || "N/A"}
          </p>
          <p className="flex items-center text-xs font-medium text-gray-500">
            <FontAwesomeIcon icon={faClock} className="mr-2 text-gray-400 flex-shrink-0" />
            {job?.startDate ? new Date(job.startDate).toLocaleDateString() : "—"}
            {" – "}
            {job?.endDateOrDuration ? new Date(job.endDateOrDuration).toLocaleDateString() : (job?.duration || "—")}
          </p>
        </div>

          <div className="border-t border-gray-100 mt-1 flex flex-col flex-grow">
          
            {/* Error State overriding internal data */}
            {error ? (
              <div className="bg-red-50 p-3 rounded-lg border border-red-100 text-red-600 text-xs font-medium flex items-center mt-3">
                 <FontAwesomeIcon icon={faExclamationCircle} className="mr-2 flex-shrink-0" />
                 <span>{error}</span>
              </div>
            ) : (
              <div className="mt-4">
                {/* SCHEDULE CLOSED BANNER */}
                {data?.isScheduleClosed && (
                  <div className="mb-3 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 flex items-center gap-2">
                    <FontAwesomeIcon icon={faCheckCircle} className="text-emerald-500 flex-shrink-0" />
                    <span className="text-xs font-bold text-emerald-700">Schedule Completed</span>
                  </div>
                )}

                {/* COMPACT ATTENDANCE PROGRESS */}
                <div className="flex justify-between items-end mb-1">
                  <span className="text-xs font-bold text-gray-700">Attendance</span>
                  <span className="text-xs font-bold text-gray-700">{data?.percent || 0}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2 mb-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${!data?.eligible ? 'bg-orange-500' : 'bg-emerald-500'}`}
                    style={{ width: `${Math.min(data?.percent || 0, 100)}%` }}
                  ></div>
                </div>
                <div className="flex justify-between items-center text-[10px] font-semibold text-gray-500 mb-3">
                  <span>Required: {data?.minAttendancePercent || 0}%</span>
                  <span className={`${!data?.eligible ? 'text-orange-600' : 'text-emerald-600'}`}>
                    {!data?.eligible ? 'At Risk' : 'On Track'}
                  </span>
                </div>

                {/* CERTIFICATE STATUS — only shown when schedule is closed */}
                {data?.isScheduleClosed && (
                  data?.certificateIssued ? (
                    <a
                      href={data.certificatePdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full mb-3 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
                    >
                      🎓 Download Certificate
                    </a>
                  ) : data?.eligible ? (
                    <div className="w-full mb-3 py-2 rounded-lg bg-amber-50 text-amber-700 text-xs font-bold border border-amber-200 flex items-center justify-center gap-2">
                      ⏳ Certificate Processing...
                    </div>
                  ) : (
                    <div className="w-full mb-3 py-2 rounded-lg bg-red-50 text-red-700 text-xs font-bold border border-red-100 flex items-center justify-center gap-2">
                      <FontAwesomeIcon icon={faTimesCircle} /> Not Eligible
                    </div>
                  )
                )}

                {/* ACTION BUTTON */}
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="w-full py-2 rounded-lg bg-indigo-50 text-indigo-600 text-sm font-bold hover:bg-indigo-100 transition-colors mt-auto relative"
                >
                  {/* Notification dot if there's an active session */}
                  {sessionStatus?.sessionActive && !sessionStatus?.alreadyMarked && (
                    <span className="absolute top-0 right-0 -mt-1 -mr-1 flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 border border-white"></span>
                    </span>
                  )}
                  View Details & Mark
                </button>
              </div>
            )}
          </div>
      </div>

      {/* MODAL FOR OTP AND HISTORY */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col font-poppins relative animate-fadeIn">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-xl shrink-0">
               <div>
                 <h3 className="text-lg font-bold text-gray-800">{job?.internshipTitle || internshipTitle}</h3>
                 <p className="text-sm font-semibold text-gray-500">Attendance Details</p>
               </div>
               <button onClick={() => setIsModalOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-200 text-gray-600 hover:bg-gray-300 transition-colors">
                  <FontAwesomeIcon icon={faTimes} />
               </button>
            </div>
            
            {/* Modal Body (Scrollable) */}
            <div className="p-6 overflow-y-auto custom-scrollbar flex-grow bg-white rounded-b-xl">
              
              {/* CERTIFICATE BANNER — shown at top of modal when schedule is closed */}
              {data?.isScheduleClosed && (
                data?.certificateIssued ? (
                  <div className="mb-6 rounded-xl p-5 flex items-center gap-4 shadow-sm bg-gradient-to-r from-emerald-50 to-emerald-100 border border-emerald-200">
                    <div className="w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0 text-2xl bg-emerald-100">
                      🎓
                    </div>
                    <div className="flex-grow">
                      <p className="font-bold text-lg text-emerald-900">Certificate Issued!</p>
                      <p className="text-sm mt-0.5 text-emerald-700">Your internship completion certificate is ready to download.</p>
                    </div>
                    <a
                      href={data.certificatePdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-emerald-600 text-white text-sm font-bold rounded-lg hover:bg-emerald-700 transition-colors flex-shrink-0 whitespace-nowrap shadow-md"
                    >
                      Download
                    </a>
                  </div>
                ) : data?.eligible ? (
                  <div className="mb-6 rounded-xl p-5 flex items-center gap-4 shadow-sm bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200">
                    <div className="w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0 text-2xl bg-amber-100">
                      ⏳
                    </div>
                    <div className="flex-grow">
                      <p className="font-bold text-lg text-amber-900">Certificate Pending</p>
                      <p className="text-sm mt-0.5 text-amber-700">
                        You met the {data?.minAttendancePercent}% attendance requirement ({data?.percent}%). Your certificate is being processed and will be available soon.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="mb-6 rounded-xl p-5 flex items-center gap-4 shadow-sm bg-gradient-to-r from-red-50 to-orange-50 border border-red-200">
                    <div className="w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0 text-2xl bg-red-100">
                      ❌
                    </div>
                    <div className="flex-grow">
                      <p className="font-bold text-lg text-red-800">Certificate Not Issued</p>
                      <p className="text-sm mt-0.5 text-red-600">
                        Your attendance ({data?.percent || 0}%) did not meet the minimum requirement of {data?.minAttendancePercent || 0}%.
                      </p>
                    </div>
                  </div>
                )
              )}

              {/* Detailed Progress */}
              <div className="mb-8 bg-gray-50 p-5 rounded-xl border border-gray-200 shadow-sm">
                <div className="flex justify-between items-end mb-2">
                  <div>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Attendance Rate</p>
                    <p className="text-3xl font-bold text-gray-800">{data?.percent || 0}%</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Sessions</p>
                    <p className="text-xl font-bold text-gray-700">{data?.attended || 0} <span className="text-gray-400 text-base">/ {data?.totalSessions || 0}</span></p>
                  </div>
                </div>
                
                <div className="w-full bg-gray-200 rounded-full h-3 mb-3 overflow-hidden shadow-inner mt-4">
                  <div
                    className={`h-full rounded-full transition-all duration-1000 ${!data?.eligible ? 'bg-orange-500' : 'bg-emerald-500'}`}
                    style={{ width: `${Math.min(data?.percent || 0, 100)}%` }}
                  ></div>
                </div>
                
                <div className="flex justify-between items-center text-sm font-semibold">
                  <span className="text-gray-500">Minimum Required: <span className="text-gray-800">{data?.minAttendancePercent || 0}%</span></span>
                  <span className={`px-2.5 py-1 rounded-md text-xs flex items-center ${!data?.eligible ? 'bg-orange-100 text-orange-700' : 'bg-emerald-100 text-emerald-700'}`}>
                    <FontAwesomeIcon icon={!data?.eligible ? faExclamationCircle : faCheckCircle} className="mr-1.5" />
                    {!data?.eligible ? 'At Risk' : 'On Track'}
                  </span>
                </div>
              </div>

              {/* TODAY'S SESSION OTP */}
              {sessionStatus && (
                <div className="mb-8">
                  {sessionStatus.sessionActive && !sessionStatus.alreadyMarked && (
                    <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-6 shadow-sm relative overflow-hidden group">
                      <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-500"></div>
                      <div className="flex items-center gap-2 mb-2 pl-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]"></span>
                        <h4 className="text-indigo-900 font-bold text-lg">Live Session Active</h4>
                      </div>
                      <p className="text-indigo-700 text-sm mb-5 pl-2 font-medium">
                        Your instructor has shared a 4-digit attendance code. Enter it below to mark yourself present:
                      </p>
                      
                      <form onSubmit={handleSubmitOtp} className="flex flex-col sm:flex-row gap-3 items-start sm:items-center pl-2">
                        <input
                          type="text"
                          maxLength="4"
                          value={otpInput}
                          onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ''))}
                          placeholder="••••"
                          className="px-4 py-2 text-2xl tracking-[0.5em] font-mono text-center w-36 rounded-lg border-2 border-indigo-200 focus:outline-none focus:border-indigo-500 focus:ring-0 bg-white shadow-inner"
                        />
                        <button
                          type="submit"
                          disabled={submittingOtp || otpInput.length !== 4}
                          className="px-8 py-2 h-[52px] bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-md hover:shadow-lg w-full sm:w-auto"
                        >
                          {submittingOtp ? 'Verifying...' : 'Mark Present'}
                        </button>
                      </form>
                      
                      {otpMessage && (
                        <div className={`mt-4 pl-2 text-sm font-bold ${otpMessage.type === 'error' ? 'text-red-600' : 'text-emerald-600'}`}>
                          {otpMessage.text}
                        </div>
                      )}
                      
                      {sessionStatus.expiresAt && (
                        <p className="text-xs text-indigo-400 mt-4 pl-2 font-semibold">
                          Code expires at {new Date(sessionStatus.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      )}
                    </div>
                  )}

                  {sessionStatus.alreadyMarked && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 flex items-center text-emerald-800 shadow-sm">
                      <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mr-4 flex-shrink-0">
                        <FontAwesomeIcon icon={faCheckCircle} className="text-emerald-600 text-2xl" />
                      </div>
                      <div>
                        <span className="font-bold block text-lg text-emerald-900">Present Today</span>
                        <span className="text-sm text-emerald-700 font-medium">Your attendance was marked successfully.</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* SESSIONS TABLE */}
              {data?.sessions && data.sessions.length > 0 && (
                <div>
                  <h4 className="text-sm font-bold text-gray-700 mb-3 uppercase tracking-wider">Recent Sessions History</h4>
                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-gray-100 text-gray-600 border-b border-gray-200">
                        <tr>
                          <th className="px-5 py-3 font-bold whitespace-nowrap text-xs uppercase">Date</th>
                          <th className="px-5 py-3 font-bold whitespace-nowrap text-xs uppercase">Type</th>
                          <th className="px-5 py-3 font-bold whitespace-nowrap text-xs uppercase text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white">
                        {data.sessions.map((session, idx) => {
                          const isPres = session.isPresent;
                          return (
                            <tr key={idx} className="hover:bg-gray-50 transition-colors">
                              <td className="px-5 py-4 text-gray-800 font-semibold whitespace-nowrap">
                                {new Date(session.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                              </td>
                              <td className="px-5 py-4 capitalize text-gray-500 font-medium whitespace-nowrap">
                                {session.sessionType}
                              </td>
                              <td className="px-5 py-4 text-right">
                                {isPres === null ? (
                                  <span className="inline-flex items-center px-2.5 py-1 rounded text-xs font-bold bg-gray-100 text-gray-500">
                                    Pending
                                  </span>
                                ) : isPres ? (
                                  <span className="inline-flex items-center px-2.5 py-1 rounded text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-100 shadow-sm">
                                    <FontAwesomeIcon icon={faCheckCircle} className="mr-1.5" />
                                    Present
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2.5 py-1 rounded text-xs font-bold bg-red-50 text-red-700 border border-red-100 shadow-sm">
                                    <FontAwesomeIcon icon={faTimesCircle} className="mr-1.5" />
                                    Absent
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default UserAttendance;
