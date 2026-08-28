// FILE: src/components/InternshipScheduleViewer.jsx
import React, { useEffect, useRef, useState } from "react";
import axios from "../../../../api/axiosInstance";import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faCalendarAlt,
    faMapMarkerAlt,
    faLink,
    faClock,
} from "@fortawesome/free-solid-svg-icons";
import { format, parseISO, isToday, isValid } from "date-fns";

const normalizeUrl = (url) => {
    if (!url) return "";
    return /^https?:\/\//i.test(url) ? url : `https://${url}`;
};

export default function InternshipScheduleViewer({
    isOpen,
    onClose,
    internshipId,
    partnerId,
}) {
    const [loading, setLoading] = useState(false);
    const [schedule, setSchedule] = useState(null);
    const [error, setError] = useState(null);
    const [mockInterviews, setMockInterviews] = useState([]);

    const [selectedLocation, setSelectedLocation] = useState(null);
    const [selectedSummary, setSelectedSummary] = useState(null);
    const [activeBatchTab, setActiveBatchTab] = useState('');

    const scrollContainerRef = useRef(null);
    const rowRefs = useRef({});

    // Set active tab when schedule loads
    useEffect(() => {
        if (schedule?.batches?.length > 0 && !activeBatchTab) {
            setActiveBatchTab(schedule.batches[0].timeSlot);
        }
    }, [schedule, activeBatchTab]);

    const displayTimetable = React.useMemo(() => {
        if (!schedule) return [];
        if (Array.isArray(schedule.batches) && schedule.batches.length > 0) {
            const batch = schedule.batches.find(b => b.timeSlot === activeBatchTab);
            return batch ? batch.timetable : (schedule.batches[0]?.timetable || []);
        }
        if (Array.isArray(schedule.timetable)) {
            return schedule.timetable;
        }
        return [];
    }, [schedule, activeBatchTab]);

    // Fetch schedule when opened
    useEffect(() => {
        if (!isOpen || !internshipId || !partnerId) return;

        let cancelled = false;
        const run = async () => {
            setLoading(true);
            setError(null);
            try {
                const res = await axios.get(`/api/schedule/get-schedule`, {
                    params: { internshipId, partnerId },
                    headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
                });
                
                let miData = [];
                try {
                    const miRes = await axios.get(`/api/mock-interviews/internship/${internshipId}`, {
                        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
                    });
                    miData = miRes.data;
                } catch (miErr) {
                    console.error("Failed to fetch mock interviews", miErr);
                }

                if (!cancelled) {
                    setSchedule(res.data);
                    setMockInterviews(miData || []);
                }
            } catch (err) {
                console.error("Failed to fetch schedule:", err);
                if (!cancelled) {
                    const status = err?.response?.status;
                    const msg = String(err?.response?.data?.message || "").toLowerCase();

                    // Treat “no schedule” as an empty state → show the table skeleton like OfferLetterCard
                    const isNoSchedule =
                        status === 404 ||
                        status === 204 ||
                        msg.includes("no schedule") ||
                        msg.includes("not found");

                    if (isNoSchedule) {
                        setSchedule(null);   // so tbody renders “Internship schedule coming soon.”
                        setError(null);      // avoid red banner
                    } else {
                        setError("Failed to fetch the schedule. Please try again.");
                    }
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        run();

        return () => {
            cancelled = true;
        };
    }, [isOpen, internshipId, partnerId]);

    // Scroll to today's session
    useEffect(() => {
        if (!isOpen || displayTimetable.length === 0) return;

        const today = displayTimetable.find((s) => {
            const d = parseISO(s.date);
            return isValid(d) && isToday(d);
        });

        if (today) {
            const key = `${today.date}-${today.startTime}`;
            const ref = rowRefs.current[key];
            if (ref?.current && scrollContainerRef.current) {
                scrollContainerRef.current.scrollTo({
                    top: ref.current.offsetTop - 33,
                    behavior: "smooth",
                });
            }
        }
    }, [isOpen, schedule, displayTimetable]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4 sm:p-6">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl relative p-6 max-h-[90vh] overflow-y-auto custom-scrollbar flex flex-col">
                <button
                    onClick={onClose}
                    className="absolute top-3 right-3 text-gray-500 hover:text-gray-700 text-2xl"
                    aria-label="Close"
                >
                    &times;
                </button>

                <h2 className="text-lg font-semibold mb-4 text-gray-800 flex items-center">
                    <FontAwesomeIcon icon={faCalendarAlt} className="mr-2 text-indigo-500" />
                    Internship Schedule
                </h2>

                {/* Summary cards */}
                <div className="mt-2">
                    <div className="sticky top-0 z-10 bg-white pt-2 pb-4">
                        {displayTimetable.length > 0 &&
                            schedule?.startDate && schedule?.endDate && schedule?.workHours && (
                                <div className="grid grid-cols-3 gap-4 text-center">
                                    <div className="bg-gray-50 border border-gray-200 rounded-md p-3 flex flex-col items-center justify-center">
                                        <p className="text-xs text-gray-500">Start Date</p>
                                        <p className="mt-1 font-medium text-gray-800">
                                            {isValid(parseISO(schedule.startDate))
                                                ? format(parseISO(schedule.startDate), "MMM d, yyyy")
                                                : "—"}
                                        </p>
                                    </div>
                                    <div className="bg-gray-50 border border-gray-200 rounded-md p-3 flex flex-col items-center justify-center">
                                        <p className="text-xs text-gray-500">End Date</p>
                                        <p className="mt-1 font-medium text-gray-800">
                                            {isValid(parseISO(schedule.endDate))
                                                ? format(parseISO(schedule.endDate), "MMM d, yyyy")
                                                : "—"}
                                        </p>
                                    </div>
                                    <div className="bg-gray-50 border border-gray-200 rounded-md p-3 flex flex-col items-center justify-center">
                                        <p className="text-xs text-gray-500">Working Hours</p>
                                        <p className="mt-1 font-medium text-gray-800">
                                            {schedule.workHours || "—"}
                                        </p>
                                    </div>
                                </div>
                            )}
                    </div>
                </div>

                {/* Loading / Error */}
                {loading && (
                    <div className="mt-4 p-4 bg-gray-50 rounded-xl animate-pulse">
                        <p className="h-4 bg-gray-200 rounded w-1/3 mb-3" />
                        <div className="space-y-2">
                            {[...Array(4)].map((_, i) => (
                                <p key={i} className="h-3 bg-gray-200 rounded w-full" />
                            ))}
                        </div>
                    </div>
                )}
                {error && !loading && (
                    <div className="mt-4 p-4 bg-red-50 text-red-700 rounded">{error}</div>
                )}

                {/* Table */}
                {!loading && !error && (
                    <div className="mt-4">
                        {Array.isArray(schedule?.batches) && schedule.batches.length > 0 && (
                            <div className="flex overflow-x-auto gap-2 mb-2 pb-2 border-b border-gray-200">
                                {schedule.batches.map(batch => (
                                    <button
                                        key={batch.timeSlot}
                                        type="button"
                                        onClick={() => setActiveBatchTab(batch.timeSlot)}
                                        className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap ${
                                            activeBatchTab === batch.timeSlot
                                                ? 'bg-indigo-100 text-indigo-700 border-b-2 border-indigo-600'
                                                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                                        }`}
                                    >
                                        Batch: {batch.timeSlot}
                                    </button>
                                ))}
                            </div>
                        )}
                        <div
                            ref={scrollContainerRef}
                            className="max-h-[65vh] overflow-auto relative"
                        >
                        <table className="min-w-full bg-white rounded-lg">
                            <thead className="bg-indigo-50 border-b border-indigo-200 sticky top-0 z-10">
                                <tr>
                                    <th className="px-4 py-2 text-xs font-medium text-gray-600 text-center">
                                        Date
                                    </th>
                                    <th className="px-4 py-2 text-xs font-medium text-gray-600 text-center">
                                        Day
                                    </th>
                                    <th className="px-4 py-2 text-xs font-medium text-gray-600 text-center">
                                        Time
                                    </th>
                                    <th className="px-4 py-2 text-xs font-medium text-gray-600 text-center">
                                        Summary
                                    </th>
                                    <th className="px-4 py-2 text-xs font-medium text-gray-600 text-center">
                                        Section Link
                                    </th>
                                    <th className="px-4 py-2 text-xs font-medium text-gray-600 text-center">
                                        Type
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {displayTimetable.length > 0 ? (
                                    displayTimetable.map((session, idx) => {
                                        const sessionDate = parseISO(session.date);
                                        const isTodayRow =
                                            isValid(sessionDate) && isToday(sessionDate);

                                        const refKey = `${session.date}-${session.startTime}`;
                                        if (isTodayRow) rowRefs.current[refKey] = React.createRef();

                                        const summaryText = session.sectionSummary || "-";
                                        const isOnline = session.type === "online";
                                        const isOffline = session.type === "offline";

                                        return (
                                            <tr
                                                key={`${session.date}-${idx}`}
                                                ref={isTodayRow ? rowRefs.current[refKey] : null}
                                                className={idx % 2 === 0 ? "bg-gray-50" : "bg-white"}
                                            >
                                                <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap text-center">
                                                    {isValid(sessionDate)
                                                        ? format(sessionDate, "dd MMM yyyy")
                                                        : "—"}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap text-center">
                                                    {isValid(sessionDate) ? format(sessionDate, "EEE") : "—"}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap text-center">
                                                    {session.startTime} - {session.endTime}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-indigo-600 hover:text-indigo-800 whitespace-nowrap text-center">
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            setSelectedSummary({
                                                                sectionSummary: summaryText,
                                                                instructor: session.instructor || "",
                                                            })
                                                        }
                                                        className="text-indigo-600 hover:underline text-xs font-medium block mx-auto"
                                                    >
                                                        View Summary
                                                    </button>
                                                    {session.mockInterview?.enabled && (
                                                        <span className="mt-2 block bg-indigo-100 text-indigo-800 text-[10px] px-2 py-1 rounded font-semibold border border-indigo-200">
                                                            Mock Interview
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap text-center">
                                                    {isOnline ? (
                                                        session.eventLink ? (
                                                            <a
                                                                href={normalizeUrl(session.eventLink)}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="inline-flex items-center text-indigo-600 hover:text-indigo-800 text-xs font-medium"
                                                            >
                                                                <FontAwesomeIcon icon={faLink} className="mr-1" />
                                                                Join Meeting
                                                            </a>
                                                        ) : (
                                                            <span className="text-gray-400 text-xs">
                                                                Link Pending
                                                            </span>
                                                        )
                                                    ) : isOffline ? (
                                                        session.location?.address ? (
                                                            <button
                                                                type="button"
                                                                onClick={() => setSelectedLocation(session.location)}
                                                                className="inline-flex items-center text-indigo-600 hover:text-indigo-800 text-xs font-medium"
                                                            >
                                                                <FontAwesomeIcon
                                                                    icon={faMapMarkerAlt}
                                                                    className="mr-1"
                                                                />
                                                                Location
                                                            </button>
                                                        ) : (
                                                            <span className="text-gray-400 text-xs">
                                                                Location TBA
                                                            </span>
                                                        )
                                                    ) : (
                                                        <>
                                                            {session.eventLink && (
                                                                <a
                                                                    href={normalizeUrl(session.eventLink)}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="inline-flex items-center text-indigo-600 hover:text-indigo-800 text-xs font-medium mr-2"
                                                                >
                                                                    <FontAwesomeIcon
                                                                        icon={faLink}
                                                                        className="mr-1"
                                                                    />
                                                                    Join Meeting
                                                                </a>
                                                            )}
                                                            {session.location?.address && (
                                                                <p className="inline-flex items-center">
                                                                    <FontAwesomeIcon
                                                                        icon={faMapMarkerAlt}
                                                                        className="mr-1 text-gray-600"
                                                                    />
                                                                    <span className="text-gray-700 text-sm">
                                                                        {session.location.name}
                                                                    </span>
                                                                </p>
                                                            )}
                                                            {!session.eventLink && !session.location?.address && (
                                                                <span className="text-gray-400 text-xs">TBA</span>
                                                            )}
                                                        </>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-sm whitespace-nowrap text-center">
                                                    <span
                                                        className={`inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full capitalize ${isOnline
                                                            ? "bg-blue-100 text-blue-700"
                                                            : isOffline
                                                                ? "bg-green-100 text-green-700"
                                                                : "bg-purple-100 text-purple-700"
                                                            }`}
                                                    >
                                                        {session.type}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td
                                            colSpan="6"
                                            className="px-4 py-8 text-center text-gray-500 italic"
                                        >
                                            Internship schedule coming soon.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>

                        {/* Mock Interviews Display */}
                        {schedule && mockInterviews.length > 0 && (
                            <div className="mt-8 px-2">
                                <h3 className="text-md font-semibold text-gray-800 mb-4 flex items-center border-b pb-2">
                                   <span className="text-xl mr-2">🎯</span> Scheduled Mock Interviews
                                </h3>
                                <div className="space-y-4">
                                   {mockInterviews.map((mi, idx) => (
                                      <div key={idx} className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-100 rounded-xl p-5 flex flex-col md:flex-row justify-between items-start md:items-center shadow-sm hover:shadow-md transition-shadow">
                                         <div className="mb-3 md:mb-0">
                                            <p className="text-lg font-bold text-indigo-900">{`Mock Interview ${idx + 1}`}</p>
                                            <div className="flex items-center gap-3 mt-1 text-sm font-medium text-indigo-700 bg-white/60 w-max px-3 py-1 rounded-full shadow-sm border border-indigo-50">
                                                <span className="flex items-center"><FontAwesomeIcon icon={faCalendarAlt} className="mr-1.5" /> {isValid(parseISO(mi.date)) ? format(parseISO(mi.date), "dd MMM yyyy") : mi.date}</span>
                                                <span className="text-indigo-300">|</span>
                                                <span className="flex items-center"><FontAwesomeIcon icon={faClock} className="mr-1.5" /> {mi.startTime} - {mi.endTime}</span>
                                            </div>
                                            <p className="text-sm text-gray-700 mt-3 font-medium bg-white/50 px-3 py-1 rounded-md inline-block">
                                                <span className="text-gray-500 mr-1">Type:</span> <span className="text-gray-800">{mi.interviewType}</span>
                                                {mi.interviewer && (
                                                    <span className="ml-3 border-l pl-3 border-gray-300">
                                                        <span className="text-gray-500 mr-1">Interviewer:</span> <span className="text-gray-800">{mi.interviewer}</span>
                                                    </span>
                                                )}
                                            </p>
                                         </div>
                                         <div className="text-right flex flex-col items-end w-full md:w-auto">
                                            <span className="inline-flex items-center px-4 py-1.5 bg-white text-indigo-700 border-2 border-indigo-100 rounded-full text-xs font-bold shadow-sm uppercase tracking-wide">
                                               {mi.status}
                                            </span>
                                            {mi.meetingLink && (
                                                <a href={normalizeUrl(mi.meetingLink)} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center text-indigo-600 hover:text-indigo-800 hover:bg-indigo-100/50 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors">
                                                   <FontAwesomeIcon icon={faLink} className="mr-2" /> Join Meeting Link
                                                </a>
                                            )}
                                         </div>
                                      </div>
                                   ))}
                                </div>
                            </div>
                        )}
                        </div>
                    </div>
                )}

                {/* LOCATION MODAL */}
                {selectedLocation && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
                        <div className="bg-white p-6 rounded-2xl shadow-xl w-full max-w-md relative">
                            <button
                                onClick={() => setSelectedLocation(null)}
                                className="absolute top-3 right-3 text-gray-500 hover:text-gray-700 text-xl"
                            >
                                &times;
                            </button>

                            <h3 className="text-lg font-semibold text-gray-800 mb-6 flex items-center">
                                <FontAwesomeIcon
                                    icon={faMapMarkerAlt}
                                    className="mr-2 text-indigo-600"
                                />
                                Location Details
                            </h3>

                            <div className="text-sm text-gray-700 space-y-6">
                                <p>
                                    <strong className="text-gray-700">Location Name:</strong>{" "}
                                    {selectedLocation.name || "—"}
                                </p>
                                <p>
                                    <strong className="text-gray-700">Address:</strong>{" "}
                                    {selectedLocation.address || "—"}
                                </p>
                                <p>
                                    <strong className="text-gray-700">Map Link:</strong>{" "}
                                    {selectedLocation.mapLink ? (
                                        <a
                                            href={normalizeUrl(selectedLocation.mapLink)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-indigo-600 hover:underline"
                                        >
                                            View on Map
                                        </a>
                                    ) : (
                                        "—"
                                    )}
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* SUMMARY MODAL */}
                {selectedSummary && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
                        <div className="bg-white p-6 rounded-2xl shadow-xl w-full max-w-md relative">
                            <button
                                onClick={() => setSelectedSummary(null)}
                                className="absolute top-3 right-3 text-gray-500 hover:text-gray-700 text-xl"
                            >
                                &times;
                            </button>
                            <h3 className="text-lg font-semibold text-gray-800 mb-6 flex items-center">
                                <FontAwesomeIcon icon={faClock} className="mr-2 text-indigo-600" />
                                Summary
                            </h3>
                            <div className="text-sm text-gray-700 space-y-6">
                                <p>
                                    <strong className="text-gray-700">Section Summary:</strong>{" "}
                                    {selectedSummary.sectionSummary || "—"}
                                </p>
                                <p>
                                    <strong className="text-gray-700">Instructor Name:</strong>{" "}
                                    {selectedSummary.instructor || "—"}
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
