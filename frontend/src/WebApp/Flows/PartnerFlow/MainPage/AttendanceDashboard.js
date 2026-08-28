import React, { useCallback, useEffect, useState } from 'react';
import axios from '../../../../api/axiosInstance';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faUserCheck, faCog, faCheckCircle, faTimesCircle,
    faEdit, faCalendarCheck, faClock, faPlayCircle, faStopCircle
} from '@fortawesome/free-solid-svg-icons';
import { format, parseISO } from 'date-fns';

export default function AttendanceDashboard({
    isOpen,
    onClose,
    internshipId,
    partnerId,
    internshipTitle = 'Internship'
}) {
    const [loading, setLoading] = useState(false);
    const [dashboardData, setDashboardData] = useState(null);
    const [error, setError] = useState(null);
    const [selectedTimetableDate, setSelectedTimetableDate] = useState(null);

    const [markOfflineModal, setMarkOfflineModal] = useState({ open: false, timetableDate: null, students: [] });
    const [overrideModal, setOverrideModal] = useState({ open: false, studentId: null, timetableDate: null, isPresent: true, reason: '' });
    const [settingsModal, setSettingsModal] = useState({ open: false, minAttendancePercent: 80, onlineMinDurationMins: 0, trackingEnabled: true });
    const [studentSummaryModal, setStudentSummaryModal] = useState({ open: false, student: null });

    const [startingSession, setStartingSession] = useState(false);
    const [endingSession, setEndingSession] = useState(false);
    const [reissuingCerts, setReissuingCerts] = useState(false);
    const [reissueResult, setReissueResult] = useState(null);
    const [selectedBatch, setSelectedBatch] = useState(0);

    const fetchDashboard = useCallback(async (showLoading = true) => {
        if (!isOpen || !internshipId || !partnerId) return;
        if (showLoading) setLoading(true);
        try {
            const res = await axios.get(`/api/attendance/dashboard/${internshipId}`, {
                params: { partnerId },
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
            });
            setDashboardData(res.data);
            setError(null);
            setSelectedTimetableDate((currentDate) => {
                if (currentDate || !res.data.timetable?.length) return currentDate;

                // Default to today or the first upcoming session.
                const today = new Date().toDateString();
                const todaySlot = res.data.timetable.find(
                    (slot) => new Date(slot.date).toDateString() === today
                );
                return todaySlot?.date || res.data.timetable[0].date;
            });
        } catch (err) {
            console.error('Failed to fetch attendance dashboard:', err);
            setError(err.response?.data?.message || 'Failed to fetch attendance dashboard.');
        } finally {
            if (showLoading) setLoading(false);
        }
    }, [isOpen, internshipId, partnerId]);

    useEffect(() => {
        if (!isOpen) return;
        setSelectedTimetableDate(null);
        setSelectedBatch(0);
        fetchDashboard(true);
        const interval = setInterval(() => {
            fetchDashboard(false);
        }, 30000);
        return () => clearInterval(interval);
    }, [isOpen, fetchDashboard]);

    const handleStartSession = async (date, startTime) => {
        if (startingSession) return;  // guard against double-click
        setStartingSession(true);
        try {
            await axios.post('/api/attendance/start-session', {
                internshipId,
                partnerId,
                timetableDate: date,
                startTime: startTime   // ← needed to identify the correct slot in multi-batch schedules
            }, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
            await fetchDashboard(false);  // ← awaited so OTP data arrives before spinner stops
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to start session');
        } finally {
            setStartingSession(false);
        }
    };

    const handleReissueCerts = async () => {
        if (reissuingCerts) return;
        setReissuingCerts(true);
        setReissueResult(null);
        try {
            const res = await axios.post('/api/schedule/reissue-certificates', {
                internshipId,
                partnerId
            }, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
            setReissueResult({ type: 'success', message: res.data.message });
            await fetchDashboard(false);
        } catch (err) {
            setReissueResult({ type: 'error', message: err.response?.data?.error || 'Failed to re-issue certificates' });
        } finally {
            setReissuingCerts(false);
        }
    };

    const handleEndSession = async (date, startTime) => {
        if (endingSession) return;  // guard against double-click
        setEndingSession(true);
        try {
            await axios.post('/api/attendance/end-session', {
                internshipId,
                partnerId,
                timetableDate: date,
                startTime: startTime   // ← needed to identify the correct slot in multi-batch schedules
            }, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
            await fetchDashboard(false);  // ← awaited
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to end session');
        } finally {
            setEndingSession(false);
        }
    };

    const handleUpdateSettings = async (e) => {
        e.preventDefault();
        try {
            await axios.patch('/api/attendance/settings', {
                internshipId,
                partnerId,
                minAttendancePercent: settingsModal.minAttendancePercent,
                onlineMinDurationMins: settingsModal.onlineMinDurationMins,
                trackingEnabled: settingsModal.trackingEnabled
            }, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
            setSettingsModal({ ...settingsModal, open: false });
            fetchDashboard(false);
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to update settings');
        }
    };

    const handleMarkOfflineSubmit = async (e) => {
        e.preventDefault();
        try {
            await axios.post('/api/attendance/mark-offline', {
                internshipId,
                partnerId,
                timetableDate: markOfflineModal.timetableDate,
                students: markOfflineModal.students.map(s => ({ studentId: s.studentId, isPresent: s.isPresent }))
            }, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
            setMarkOfflineModal({ open: false, timetableDate: null, students: [] });
            fetchDashboard(false);
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to mark offline attendance');
        }
    };

    const handleOverrideSubmit = async (e) => {
        e.preventDefault();
        try {
            await axios.patch('/api/attendance/override', {
                internshipId,
                studentId: overrideModal.studentId,
                timetableDate: overrideModal.timetableDate,
                isPresent: overrideModal.isPresent,
                reason: overrideModal.reason,
                partnerId
            }, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
            setOverrideModal({ open: false, studentId: null, timetableDate: null, isPresent: true, reason: '' });
            fetchDashboard(false);
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to override attendance');
        }
    };

    if (!isOpen) return null;

    const renderLeftPanel = () => {
        if (!dashboardData?.timetable) return null;

        // Only real multi-batch schedules should be split into tabs. A normal
        // schedule can contain older sessions at their original time after the
        // partner edits future sessions; those historical times are not batches.
        const batches = {};
        if (dashboardData.isBatchSchedule) {
            dashboardData.timetable.forEach(slot => {
                const key = `${slot.startTime} - ${slot.endTime}`;
                if (!batches[key]) batches[key] = [];
                batches[key].push(slot);
            });
        } else {
            const key = dashboardData.defaultTimeSlot
                || (dashboardData.timetable[0]
                    ? `${dashboardData.timetable[0].startTime} - ${dashboardData.timetable[0].endTime}`
                    : 'Schedule');
            batches[key] = dashboardData.timetable;
        }
        const batchKeys = Object.keys(batches);
        const activeBatchIndex = selectedBatch < batchKeys.length ? selectedBatch : 0;
        const activeBatchSlots = batches[batchKeys[activeBatchIndex]] || [];

        return (
            <div className="flex flex-col h-full overflow-hidden">
                {/* Batch Tabs */}
                <div className="flex gap-2 mb-4 border-b border-gray-200 pb-1 shrink-0 flex-wrap">
                    {batchKeys.map((key, idx) => (
                        <button
                            key={key}
                            onClick={() => {
                                setSelectedBatch(idx);
                                const newBatchSlots = batches[key] || [];
                                setSelectedTimetableDate(newBatchSlots.length > 0 ? newBatchSlots[0].date : null);
                            }}
                            className={`px-4 py-1.5 rounded-t-lg text-sm font-semibold border-b-2 transition-colors ${activeBatchIndex === idx
                                ? 'border-indigo-500 text-indigo-700 bg-indigo-50'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                                }`}
                        >
                            Batch: {key}
                        </button>
                    ))}
                </div>

                {/* Table */}
                <div className="flex-1 overflow-y-auto rounded-xl border border-gray-200 bg-white">
                    <table className="w-full text-sm text-left border-collapse">
                        <thead className="bg-gray-50 sticky top-0 z-10">
                            <tr className="border-b border-gray-200 text-xs uppercase tracking-wider text-gray-500 font-semibold">
                                <th className="px-4 py-3">Date</th>
                                <th className="px-4 py-3">Day</th>
                                <th className="px-4 py-3">Time</th>
                                <th className="px-4 py-3">Summary</th>
                                <th className="px-4 py-3">Section Link</th>
                                <th className="px-4 py-3">Type</th>
                                <th className="px-4 py-3">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {activeBatchSlots.map((slot, idx) => {
                                const isSelected = selectedTimetableDate &&
                                    new Date(selectedTimetableDate).toDateString() === new Date(slot.date).toDateString() &&
                                    selectedTimetableDate === slot.date;
                                const otpInfo = slot.sessionOtp;
                                const hasBeenStarted = !!otpInfo?.code;
                                const sessionActive = hasBeenStarted && otpInfo?.isActive && new Date() <= new Date(otpInfo.expiresAt);
                                const sessionEnded = hasBeenStarted && !sessionActive;

                                let statusBadge = (
                                    <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">Not Started</span>
                                );
                                if (sessionActive) statusBadge = (
                                    <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full flex items-center gap-1 w-fit">
                                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span> Active
                                    </span>
                                );
                                else if (sessionEnded) statusBadge = (
                                    <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">Ended</span>
                                );

                                return (
                                    <tr
                                        key={idx}
                                        onClick={() => setSelectedTimetableDate(slot.date)}
                                        className={`cursor-pointer transition-colors ${isSelected
                                                ? 'bg-indigo-50 ring-1 ring-inset ring-indigo-300'
                                                : 'hover:bg-gray-50'
                                            }`}
                                    >
                                        <td className="px-4 py-3 font-medium text-gray-800 whitespace-nowrap">
                                            {format(parseISO(slot.date), 'd MMM yyyy')}
                                        </td>
                                        <td className="px-4 py-3 text-gray-500">{slot.day}</td>
                                        <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                                            {slot.startTime} - {slot.endTime}
                                        </td>
                                        <td className="px-4 py-3 text-gray-500 max-w-[160px]">
                                            {slot.sectionSummary ? (
                                                <span
                                                    className="text-indigo-600 hover:underline cursor-pointer text-xs"
                                                    title={slot.sectionSummary}
                                                    onClick={(e) => { e.stopPropagation(); alert(slot.sectionSummary); }}
                                                >
                                                    View Summary
                                                </span>
                                            ) : (
                                                <span className="text-gray-300 text-xs">—</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">

                                            {slot.eventLink ? (
                                                <a
                                                    href={slot.eventLink}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="text-indigo-600 hover:text-indigo-800 text-xs font-medium flex items-center gap-1"
                                                >
                                                    🔗 Join Meeting
                                                </a>
                                            ) : (
                                                <span className="text-gray-300 text-xs">—</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="text-xs uppercase tracking-wider font-bold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded">
                                                {slot.type || 'Online'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">{statusBadge}</td>
                                    </tr>
                                );
                            })}
                            {activeBatchSlots.length === 0 && (
                                <tr>
                                    <td colSpan="7" className="px-4 py-8 text-center text-gray-400 text-sm">
                                        No sessions in this batch.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Session Action Panel - shows below table when a row is selected */}
                {
                    selectedTimetableDate && (() => {
                        const slot = activeBatchSlots.find(s =>
                            new Date(s.date).toDateString() === new Date(selectedTimetableDate).toDateString()
                        );
                        const preciseSlot = activeBatchSlots.find(s =>
                            new Date(s.date).toDateString() === new Date(selectedTimetableDate).toDateString() &&
                            s.startTime === (slot?.startTime)
                        ) || slot;
                        const resolvedSlot = preciseSlot;
                        if (!resolvedSlot) return null;
                        const otpInfo = resolvedSlot.sessionOtp;
                        const hasBeenStarted = !!otpInfo?.code;
                        const sessionActive = hasBeenStarted && otpInfo?.isActive === true && new Date() <= new Date(otpInfo.expiresAt);
                        const sessionEnded = hasBeenStarted && !sessionActive;
                        const isLocked = dashboardData?.isScheduleClosed === true;

                        return (
                            <div className="mt-3 shrink-0">
                                {isLocked && (
                                    <div className="w-full py-2 px-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm font-medium flex items-center gap-2">
                                        <span>🔒</span> Schedule closed — sessions cannot be started.
                                    </div>
                                )}
                                {!isLocked && !sessionActive && !sessionEnded && (
                                    <button
                                        onClick={() => handleStartSession(resolvedSlot.date, resolvedSlot.startTime)}
                                        disabled={startingSession}
                                        className="w-full py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium flex items-center justify-center transition-colors shadow-sm text-sm"
                                    >
                                        <FontAwesomeIcon icon={faPlayCircle} className="mr-2" />
                                        {startingSession ? 'Starting...' : `Start Session — ${format(parseISO(resolvedSlot.date), 'MMM d')} ${resolvedSlot.startTime}`}
                                    </button>
                                )}
                                {sessionActive && (
                                    <div className="bg-white rounded-lg border border-green-200 p-4 text-center shadow-inner relative overflow-hidden">
                                        <div className="absolute top-0 left-0 w-full h-1 bg-green-500"></div>
                                        <p className="text-xs text-gray-500 font-medium mb-1 uppercase tracking-wider">Session OTP</p>
                                        <div className="text-3xl font-black text-gray-900 tracking-[0.2em] my-2 font-mono">{otpInfo.code}</div>
                                        <p className="text-xs text-gray-600 mb-3 bg-gray-50 py-1 rounded-md inline-block px-3">
                                            <FontAwesomeIcon icon={faClock} className="mr-1 text-gray-400" />
                                            Valid until {format(parseISO(otpInfo.expiresAt), 'h:mm a')}
                                        </p>
                                        {!isLocked && (
                                            <button
                                                onClick={() => handleEndSession(resolvedSlot.date, resolvedSlot.startTime)}
                                                disabled={endingSession}
                                                className="w-full py-1.5 bg-red-50 text-red-600 hover:bg-red-100 border border-red-100 rounded-lg text-sm font-semibold transition-colors"
                                            >
                                                <FontAwesomeIcon icon={faStopCircle} className="mr-2" />
                                                {endingSession ? 'Ending...' : 'End Session Early'}
                                            </button>
                                        )}
                                    </div>
                                )}
                                {sessionEnded && (
                                    <div className="text-center py-2 bg-gray-100 rounded-lg text-gray-600 text-sm font-medium">
                                        Session has ended.
                                    </div>
                                )}
                            </div>
                        );
                    })()
                }
            </div >
        );
    };

    const renderRightPanel = () => {
        if (!dashboardData?.students || !selectedTimetableDate) return null;

        const batches = {};
        dashboardData.timetable.forEach(slot => {
            const key = `${slot.startTime} - ${slot.endTime}`;
            if (!batches[key]) batches[key] = [];
            batches[key].push(slot);
        });
        const batchKeys = Object.keys(batches);
        const currentBatchKey = batchKeys[selectedBatch];

        const selectedDateString = new Date(selectedTimetableDate).toDateString();

        let checkedInCount = 0;
        const studentsList = dashboardData.students
            .filter(s => !currentBatchKey || s.batch === currentBatchKey || s.batch === 'Unassigned')
            .map(s => {
                const sessionRec = s.sessions?.find(ss => new Date(ss.date).toDateString() === selectedDateString);
                if (sessionRec?.isPresent) checkedInCount++;
                return { ...s, sessionRec };
            });

        return (
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm flex flex-col h-full overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center shrink-0">
                    <div>
                        <h3 className="text-lg font-bold text-gray-800">Student Attendance</h3>
                        <p className="text-sm text-gray-500 mt-0.5">Live Updates • {checkedInCount} / {studentsList.length} students checked in</p>
                    </div>
                    {!dashboardData?.isScheduleClosed && (
                        <button
                            onClick={() => {
                                const studentsInit = studentsList.map(s => ({ studentId: s.studentId, isPresent: s.sessionRec?.isPresent || false, name: s.name, email: s.email }));
                                setMarkOfflineModal({ open: true, timetableDate: selectedTimetableDate.split('T')[0], students: studentsInit });
                            }}
                            className="px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-50 transition shadow-sm"
                        >
                            <FontAwesomeIcon icon={faCalendarCheck} className="mr-2" />
                            Mark Offline
                        </button>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-white sticky top-0 shadow-sm z-10">
                            <tr className="border-b border-gray-200 text-xs uppercase tracking-wider text-gray-500 font-semibold">
                                <th className="px-6 py-3">Student</th>
                                <th className="px-6 py-3">Email</th>
                                <th className="px-6 py-3 text-center">Status</th>
                                <th className="px-6 py-3 text-center">Certificate</th>
                                <th className="px-6 py-3 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {studentsList.map((student) => {
                                const isPres = student.sessionRec?.isPresent;
                                const isResolved = student.sessionRec?.resolvedBy;

                                return (
                                    <tr key={student.studentId} className="hover:bg-gray-50/50">
                                        <td className="px-6 py-4 cursor-pointer hover:bg-gray-100" onClick={() => setStudentSummaryModal({ open: true, student })}>
                                            <p className="font-semibold text-indigo-600 text-sm hover:underline">{student.name}</p>
                                        </td>
                                        <td className="px-6 py-4">
                                            <p className="text-sm text-gray-500">{student.email}</p>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            {isPres ? (
                                                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                    <FontAwesomeIcon icon={faCheckCircle} className="mr-1.5" /> Present
                                                </span>
                                            ) : isPres === false ? (
                                                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                                    <FontAwesomeIcon icon={faTimesCircle} className="mr-1.5" /> Absent
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                                    <FontAwesomeIcon icon={faClock} className="mr-1.5" /> Pending
                                                </span>
                                            )}
                                            {isResolved === 'override' && <div className="text-[10px] text-indigo-600 mt-1 font-semibold uppercase tracking-wide">Overridden</div>}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            {student.certificateIssued ? (
                                                <a
                                                    href={student.certificatePdfUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 hover:bg-emerald-200 transition"
                                                    title={`Issued on ${student.certificateIssuedAt ? new Date(student.certificateIssuedAt).toLocaleDateString() : ''}`}
                                                >
                                                    <FontAwesomeIcon icon={faCheckCircle} className="text-emerald-600" />
                                                    Issued
                                                </a>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                                                    <FontAwesomeIcon icon={faClock} className="text-gray-400" />
                                                    Not Released
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            {!dashboardData?.isScheduleClosed && (
                                                <button
                                                    onClick={() => setOverrideModal({
                                                        open: true,
                                                        studentId: student.studentId,
                                                        timetableDate: selectedTimetableDate.split('T')[0],
                                                        isPresent: !isPres,
                                                        reason: ""
                                                    })}
                                                    className="text-indigo-500 hover:text-indigo-700 p-2 rounded-lg hover:bg-indigo-50 transition"
                                                    title="Override Attendance"
                                                >
                                                    <FontAwesomeIcon icon={faEdit} />
                                                </button>
                                            )}
                                            {dashboardData?.isScheduleClosed && (
                                                <span className="text-xs text-gray-400 italic">Locked</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                            {studentsList.length === 0 && (
                                <tr>
                                    <td colSpan="5" className="px-6 py-12 text-center text-gray-500">
                                        No students have accepted offers for this internship yet.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-50 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-gray-50 rounded-2xl shadow-2xl w-full max-w-7xl relative p-6 h-[90vh] flex flex-col overflow-hidden">
                <button
                    onClick={onClose}
                    className="absolute top-5 right-5 w-8 h-8 flex items-center justify-center bg-gray-200 hover:bg-gray-300 text-gray-600 rounded-full transition-colors z-10"
                >
                    &times;
                </button>

                <div className="flex justify-between items-start mb-6 border-b border-gray-200 pb-4 shrink-0 pr-10 gap-6 flex-wrap">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                            <FontAwesomeIcon icon={faUserCheck} className="text-indigo-600" />
                            Attendance Tracker
                        </h2>
                        <p className="text-gray-500 mt-1 font-medium">{internshipTitle}</p>
                    </div>

                    <div className="flex items-center gap-4 flex-wrap">
                        {/* Core stats pill */}
                        <div className="flex items-center gap-4 text-sm bg-white px-4 py-2 rounded-xl shadow-sm border border-gray-100">
                            <div className="flex flex-col">
                                <span className="text-gray-500 text-xs font-semibold uppercase tracking-wider">Min Required</span>
                                <span className="font-bold text-gray-800">{dashboardData?.minAttendancePercent || 80}%</span>
                            </div>
                            <div className="w-px h-8 bg-gray-200"></div>
                            <div className="flex flex-col">
                                <span className="text-gray-500 text-xs font-semibold uppercase tracking-wider">Total Sessions</span>
                                <span className="font-bold text-gray-800">{dashboardData?.totalSessions || 0}</span>
                            </div>
                            <div className="w-px h-8 bg-gray-200"></div>
                            {!dashboardData?.isScheduleClosed ? (
                                <button
                                    onClick={() => setSettingsModal({
                                        open: true,
                                        minAttendancePercent: dashboardData?.minAttendancePercent || 80,
                                        onlineMinDurationMins: dashboardData?.onlineMinDurationMins || 0,
                                        trackingEnabled: dashboardData?.trackingEnabled ?? true
                                    })}
                                    className="text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-2 p-2 hover:bg-indigo-50 rounded-lg transition"
                                >
                                    <FontAwesomeIcon icon={faCog} /> Settings
                                </button>
                            ) : (
                                <span className="text-amber-700 font-semibold flex items-center gap-2 p-2 text-sm">
                                    🔒 Schedule Closed
                                </span>
                            )}
                        </div>

                        {/* Per-batch certificate stats — shown only when schedule is closed */}
                        {dashboardData?.isScheduleClosed && dashboardData?.batchCertSummary?.length > 0 && (
                            <div className="flex items-center gap-2 flex-wrap">
                                {dashboardData.batchCertSummary.map((b, i) => (
                                    <div key={i} className="bg-white border border-gray-200 rounded-xl px-4 py-2 shadow-sm text-xs min-w-[130px]">
                                        <p className="font-bold text-gray-700 mb-1.5 truncate max-w-[160px]" title={b.batch}>
                                            🗂 {b.batch}
                                        </p>
                                        <div className="flex gap-3">
                                            <span className="flex flex-col items-center">
                                                <span className="text-base font-black text-gray-900">{b.total}</span>
                                                <span className="text-gray-400 uppercase tracking-wider" style={{ fontSize: '9px' }}>Total</span>
                                            </span>
                                            <span className="flex flex-col items-center">
                                                <span className="text-base font-black text-emerald-600">{b.eligible}</span>
                                                <span className="text-gray-400 uppercase tracking-wider" style={{ fontSize: '9px' }}>Eligible</span>
                                            </span>
                                            <span className="flex flex-col items-center">
                                                <span className="text-base font-black text-indigo-600">{b.certified}</span>
                                                <span className="text-gray-400 uppercase tracking-wider" style={{ fontSize: '9px' }}>Certified</span>
                                            </span>
                                        </div>
                                    </div>
                                ))}

                                {/* Re-issue button — only when eligible > certified */}
                                {dashboardData.batchCertSummary.some(b => b.eligible > b.certified) && (
                                    <button
                                        onClick={handleReissueCerts}
                                        disabled={reissuingCerts}
                                        className="flex items-center gap-2 px-3 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-60 transition shadow-sm whitespace-nowrap"
                                        title="Generate certificates for all eligible students who haven't received one yet"
                                    >
                                        {reissuingCerts ? '⏳ Processing...' : '🎓 Issue Certificates'}
                                    </button>
                                )}
                            </div>
                        )}

                        {/* Re-issue result toast */}
                        {reissueResult && (
                            <div className={`mt-2 w-full text-xs font-semibold px-3 py-2 rounded-lg ${reissueResult.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                                {reissueResult.message}
                                <button onClick={() => setReissueResult(null)} className="ml-3 text-xs opacity-60 hover:opacity-100">✕</button>
                            </div>
                        )}
                    </div>
                    {studentSummaryModal.open && studentSummaryModal.student && (
                        <div className="fixed inset-0 z-[70] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
                            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl p-6 max-h-[85vh] flex flex-col">
                                <div className="flex justify-between items-start border-b pb-4 shrink-0">
                                    <div>
                                        <h3 className="text-xl font-bold text-gray-900">{studentSummaryModal.student.name}</h3>
                                        <p className="text-sm text-gray-500">{studentSummaryModal.student.email}</p>
                                    </div>
                                    <div className="flex flex-col items-end">
                                        <div className="flex gap-2 mb-2">
                                            {studentSummaryModal.student.certificateIssued ? (
                                                <a
                                                    href={studentSummaryModal.student.certificatePdfUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 hover:bg-emerald-200 transition"
                                                    title={`Issued on ${studentSummaryModal.student.certificateIssuedAt ? new Date(studentSummaryModal.student.certificateIssuedAt).toLocaleDateString() : ''}`}
                                                >
                                                    CERTIFICATE ISSUED
                                                </a>
                                            ) : (
                                                <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-gray-100 text-gray-500">
                                                    CERT NOT RELEASED
                                                </span>
                                            )}
                                            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${studentSummaryModal.student.eligible ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                                {studentSummaryModal.student.eligible ? 'Eligible' : 'Ineligible'}
                                            </span>
                                        </div>
                                        <span className="text-sm font-bold mt-1 text-gray-700">Attendance: {studentSummaryModal.student.percent}% ({studentSummaryModal.student.attended} sessions)</span>
                                    </div>
                                </div>
                                <div className="flex-1 overflow-y-auto mt-4">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-gray-50 sticky top-0">
                                            <tr>
                                                <th className="px-4 py-2 font-semibold text-gray-600">Date</th>
                                                <th className="px-4 py-2 font-semibold text-gray-600">Type</th>
                                                <th className="px-4 py-2 font-semibold text-gray-600 text-center">Status</th>
                                                <th className="px-4 py-2 font-semibold text-gray-600 text-right">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {studentSummaryModal.student.sessions?.map((sess, i) => (
                                                <tr key={i} className="hover:bg-gray-50">
                                                    <td className="px-4 py-3 text-gray-800">{format(parseISO(sess.date), 'MMM d, yyyy')}</td>
                                                    <td className="px-4 py-3"><span className="text-xs uppercase tracking-wider bg-gray-100 text-gray-600 px-2 py-1 rounded">{sess.sessionType || sess.type}</span></td>
                                                    <td className="px-4 py-3 text-center">
                                                        {sess.isPresent ? (
                                                            <span className="text-green-600 font-medium"><FontAwesomeIcon icon={faCheckCircle} className="mr-1" /> Present</span>
                                                        ) : sess.isPresent === false ? (
                                                            <span className="text-red-500 font-medium"><FontAwesomeIcon icon={faTimesCircle} className="mr-1" /> Absent</span>
                                                        ) : (
                                                            <span className="text-yellow-600 font-medium"><FontAwesomeIcon icon={faClock} className="mr-1" /> Pending</span>
                                                        )}
                                                        {sess.resolvedBy === 'override' && <div className="text-[10px] text-indigo-500 mt-0.5">OVERRIDDEN</div>}
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        {!dashboardData?.isScheduleClosed ? (
                                                            <button
                                                                onClick={() => {
                                                                    setStudentSummaryModal({ open: false, student: null });
                                                                    setOverrideModal({
                                                                        open: true,
                                                                        studentId: studentSummaryModal.student.studentId,
                                                                        timetableDate: sess.date.split('T')[0],
                                                                        isPresent: !sess.isPresent,
                                                                        reason: ''
                                                                    });
                                                                }}
                                                                className="text-indigo-600 hover:underline text-xs font-semibold"
                                                            >
                                                                Override
                                                            </button>
                                                        ) : (
                                                            <span className="text-xs text-gray-400 italic">Locked</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="mt-4 pt-4 border-t flex justify-end shrink-0">
                                    <button onClick={() => setStudentSummaryModal({ open: false, student: null })} className="px-4 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg font-medium transition">Close</button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {loading && !dashboardData && (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
                        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4" />
                        Loading dashboard data...
                    </div>
                )}

                {error && !loading && !dashboardData && (
                    <div className="p-4 bg-red-50 text-red-700 rounded-lg border border-red-200 m-auto">
                        {error}
                    </div>
                )}

                {!loading && dashboardData && (
                    <div className="flex gap-6 flex-1 overflow-hidden">
                        {/* LEFT PANEL */}
                        <div className="w-1/3 flex flex-col overflow-hidden">
                            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3 px-1">Sessions</h3>
                            {renderLeftPanel()}
                        </div>

                        {/* RIGHT PANEL */}
                        <div className="w-2/3 flex flex-col overflow-hidden">
                            {renderRightPanel()}
                        </div>
                    </div>
                )}
            </div>

            {/* Modals here... (Mark Offline and Override and Settings) */}
            {markOfflineModal.open && (
                <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6">
                        <h3 className="text-lg font-bold mb-4 text-gray-900 border-b pb-2">Mark Offline Attendance</h3>
                        <form onSubmit={handleMarkOfflineSubmit}>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Session Date *</label>
                                <input
                                    type="date"
                                    required
                                    value={markOfflineModal.timetableDate}
                                    onChange={(e) => setMarkOfflineModal({ ...markOfflineModal, timetableDate: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>

                            <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-lg mb-4">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                                        <tr>
                                            <th className="px-4 py-2 text-left font-medium text-gray-700">Student</th>
                                            <th className="px-4 py-2 text-center font-medium text-gray-700">Present?</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {markOfflineModal.students.map((student, idx) => (
                                            <tr key={student.studentId}>
                                                <td className="px-4 py-2">
                                                    <div className="font-medium text-gray-800">{student.name}</div>
                                                    <div className="text-xs text-gray-500">{student.email}</div>
                                                </td>
                                                <td className="px-4 py-2 text-center">
                                                    <input
                                                        type="checkbox"
                                                        checked={student.isPresent}
                                                        onChange={(e) => {
                                                            const newStudents = [...markOfflineModal.students];
                                                            newStudents[idx].isPresent = e.target.checked;
                                                            setMarkOfflineModal({ ...markOfflineModal, students: newStudents });
                                                        }}
                                                        className="w-5 h-5 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500 cursor-pointer"
                                                    />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="flex justify-end gap-3 pt-2">
                                <button type="button" onClick={() => setMarkOfflineModal({ open: false, timetableDate: null, students: [] })} className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
                                <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium">Save Attendance</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {overrideModal.open && (
                <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
                        <h3 className="text-lg font-bold mb-4 text-gray-900 border-b pb-2">Override Attendance</h3>
                        <form onSubmit={handleOverrideSubmit}>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                                <select
                                    value={overrideModal.isPresent ? 'true' : 'false'}
                                    onChange={(e) => setOverrideModal({ ...overrideModal, isPresent: e.target.value === 'true' })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                >
                                    <option value="true">Present</option>
                                    <option value="false">Absent</option>
                                </select>
                            </div>
                            <div className="mb-5">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Reason (Optional)</label>
                                <input
                                    type="text"
                                    value={overrideModal.reason}
                                    onChange={(e) => setOverrideModal({ ...overrideModal, reason: e.target.value })}
                                    placeholder="e.g. Approved leave"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                            <div className="flex justify-end gap-3">
                                <button type="button" onClick={() => setOverrideModal({ open: false, studentId: null, timetableDate: null, isPresent: true, reason: '' })} className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
                                <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium">Confirm</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {settingsModal.open && (
                <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
                        <h3 className="text-lg font-bold mb-4 text-gray-900 border-b pb-2">Attendance Settings</h3>
                        <form onSubmit={handleUpdateSettings}>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Min Attendance % Required</label>
                                <input
                                    type="number" min="1" max="100" required
                                    value={settingsModal.minAttendancePercent}
                                    onChange={(e) => setSettingsModal({ ...settingsModal, minAttendancePercent: Number(e.target.value) })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Online Session Min Duration (mins)</label>
                                <input
                                    type="number" min="0" required
                                    value={settingsModal.onlineMinDurationMins}
                                    onChange={(e) => setSettingsModal({ ...settingsModal, onlineMinDurationMins: Number(e.target.value) })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                />
                                <p className="text-xs text-gray-500 mt-1">0 = any join counts.</p>
                            </div>
                            <div className="flex items-center gap-2 mb-6">
                                <input
                                    type="checkbox"
                                    id="trackingEnabled"
                                    checked={settingsModal.trackingEnabled}
                                    onChange={(e) => setSettingsModal({ ...settingsModal, trackingEnabled: e.target.checked })}
                                    className="w-4 h-4 text-indigo-600"
                                />
                                <label htmlFor="trackingEnabled" className="text-sm font-medium text-gray-700">Enable Attendance Tracking</label>
                            </div>
                            <div className="flex justify-end gap-3">
                                <button type="button" onClick={() => setSettingsModal({ ...settingsModal, open: false })} className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
                                <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium">Save Settings</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
