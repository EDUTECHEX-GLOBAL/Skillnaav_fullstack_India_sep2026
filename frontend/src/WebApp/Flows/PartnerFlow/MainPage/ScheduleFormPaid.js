//File: ScheduleFormPaid.js

import React, { useState, useEffect, useRef } from 'react';
import { parseISO, isBefore, isToday } from 'date-fns';
import {
  FiCalendar,
  FiClock,
  FiLink,
  FiChevronRight,
  FiX,
  FiMapPin
} from 'react-icons/fi';
import axios from "../../../../api/axiosInstance";
import * as XLSX from 'xlsx';
import CreateMeetingLink from './CreateMeetingLink';

const isPastDate = (dateString) => {
  const date = parseISO(dateString);
  return isBefore(date, new Date()) && !isToday(date);
};

// ✅ ADD THIS
const isFutureDate = (dateString) => {
  const date = parseISO(dateString);
  // Treat TODAY as editable (same as future) after first save
  return isToday(date) || !isBefore(date, new Date());
};

// ✅ ADD THIS (below isFutureDate)
// eslint-disable-next-line no-unused-vars
const parseWorkHoursRange = (text = '') => {
  // Accepts: "09:00 - 17:00" or "09:00–17:00"
  const m = String(text).match(/(\d{1,2}:\d{2})\s*[-–—]\s*(\d{1,2}:\d{2})/);
  if (!m) return { startTime: '', endTime: '' };

  const normalize = (t) => {
    const [h, min] = t.split(':');
    return `${String(h).padStart(2, '0')}:${min}`;
  };

  return { startTime: normalize(m[1]), endTime: normalize(m[2]) };
};

// ✅ ADD THIS (below parseWorkHoursRange)
const timeToMinutes = (t = '') => {
  // expects "HH:MM"
  const [hh, mm] = String(t).split(':');
  const h = Number(hh);
  const m = Number(mm);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return NaN;
  return h * 60 + m;
};

const allWeekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const normalizeInternshipMode = (mode = '') => {
  const value = String(mode).trim().toLowerCase();
  return ['online', 'offline', 'hybrid'].includes(value) ? value : 'online';
};

/**
 * Helper to render location fields (name, address, map link).
 *
 * @param {string} prefix       - prefix for the `name` attributes (e.g. "location" or `location-2`)
 * @param {object} location     - object containing { name, address, mapLink }
 * @param {function} handleChange - onChange handler that accepts e.target.name / e.target.value
 */
const renderLocationFields = (prefix, location, handleChange) => (
  <div className="mt-4">
    <h4 className="text-md font-semibold text-gray-700 mb-3 flex items-center">
      <FiMapPin className="mr-2 text-indigo-600" />
      <span className="mr-1">Location Details</span>
      <span className="text-sm text-gray-400 font-normal">(Optional)</span>
    </h4>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Location Name</label>
        <input
          type="text"
          name={`${prefix}.name`}
          value={location.name || ''}
          onChange={handleChange}
          placeholder="Building / Room Name"
          className="block w-full pl-3 pr-3 py-2 border border-gray-300 rounded-lg bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
        <input
          type="text"
          name={`${prefix}.address`}
          value={location.address || ''}
          onChange={handleChange}
          placeholder="Full Address"
          className="block w-full pl-3 pr-3 py-2 border border-gray-300 rounded-lg bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Map Link</label>
        <input
          type="url"
          name={`${prefix}.mapLink`}
          value={location.mapLink || ''}
          onChange={handleChange}
          placeholder="https://maps.example.com/your-location"
          className="block w-full pl-3 pr-3 py-2 border border-gray-300 rounded-lg bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        />
      </div>
    </div>
  </div>
);

const ScheduleFormPaid = ({ internshipId, onClose, initialInternshipMode = '' }) => {
  // Form fields
  const [form, setForm] = useState({
    startDate: '',
    endDate: '',
    workHoursStart: '',
    workHoursEnd: '',
    defaultType: initialInternshipMode ? normalizeInternshipMode(initialInternshipMode) : '', // online / offline / hybrid
    timeSlots: {
      online: [],  // [{ startTime:'HH:MM', endTime:'HH:MM' }, ...]
      offline: [],
      hybrid: []
    },
    selectedDays: allWeekdays.slice(),
    newDate: '',
    onlineEventLink: '',
    offlineLocation: { name: '', address: '', mapLink: '' },
    hybridEventLink: '',
    hybridLocation: { name: '', address: '', mapLink: '' },
    scheduleMode: 'manual', // ✅ manual | automated
    isClosed: false,
    attendanceSettings: {
      minAttendancePercent: 80,
      onlineMinDurationMins: 0,
      trackingEnabled: true
    }
  });

  const [error, setError] = useState(null);
  const [batchTimetables, setBatchTimetables] = useState({});
  const [activeBatchTab, setActiveBatchTab] = useState('');
  const [previewed, setPreviewed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [excelData, setExcelData] = useState({});
  const [mockInterviews, setMockInterviews] = useState([]);
  const todayRef = useRef(null);
  const previewScrollRef = useRef(null);
  const hasAutoScrolledRef = useRef(false);
  const readOnly = !!form.isClosed;
  const [isPersisted, setIsPersisted] = useState(false); // false until load/save
  const [aiGenerating, setAiGenerating] = useState(false);
  const [lockedInternshipType, setLockedInternshipType] = useState(initialInternshipMode ? normalizeInternshipMode(initialInternshipMode) : '');
  const [lockedClassification, setLockedClassification] = useState('');
  const visibleInternshipTypes = lockedInternshipType ? [lockedInternshipType] : [];

  // Default getters so preview toggles use the right source every time
  const getDefaultEventLinkForType = (type) => {
    if (type === 'online') {
      // If the form is set to hybrid, use the hybrid link; otherwise use online link
      return form.defaultType === 'hybrid' ? (form.hybridEventLink || '') : (form.onlineEventLink || '');
    }
    return ''; // offline doesn't use a link by default
  };

  const getDefaultLocationForType = (type) => {
    if (type === 'offline') {
      // If the form is set to hybrid, use the hybrid location; otherwise use offline location
      const loc = form.defaultType === 'hybrid' ? form.hybridLocation : form.offlineLocation;
      return loc && (loc.address || loc.name || loc.mapLink)
        ? loc
        : { name: '', address: '', mapLink: '' };
    }
    // for online we keep location empty
    return { name: '', address: '', mapLink: '' };
  };

  // ✅ NEW: Time Slot helpers (Online/Offline/Hybrid)
  const addSlot = (type) => {
    setForm((f) => ({
      ...f,
      timeSlots: {
        ...f.timeSlots,
        [type]: [...(f.timeSlots?.[type] || []), { startTime: '', endTime: '' }]
      }
    }));
  };

  const updateSlot = (type, idx, field, value) => {
    setForm((f) => {
      const slots = [...(f.timeSlots?.[type] || [])];
      slots[idx] = { ...(slots[idx] || {}), [field]: value };
      return {
        ...f,
        timeSlots: {
          ...f.timeSlots,
          [type]: slots
        }
      };
    });
  };

  const removeSlot = (type, idx) => {
    setForm((f) => {
      const slots = [...(f.timeSlots?.[type] || [])];
      slots.splice(idx, 1);
      return {
        ...f,
        timeSlots: {
          ...f.timeSlots,
          [type]: slots
        }
      };
    });
  };

  const validateSlotsForType = (type) => {
    const slots = form.timeSlots?.[type] || [];

    // ✅ Slots are MANDATORY now (Online / Offline / Hybrid)
    if (!slots.length) {
      return `Please add at least 1 Time Slot under ${type.toUpperCase()} (Select Time Slot is mandatory).`;
    }

    // If user added slots, they must be complete and valid.
    const hasIncomplete = slots.some((s) => !(s?.startTime && s?.endTime));
    if (hasIncomplete) {
      return `Please fill both Start Time and End Time for all Slot(s) under ${type.toUpperCase()} (or remove incomplete slots).`;
    }

    // Validate each slot end > start
    for (let i = 0; i < slots.length; i++) {
      const s = slots[i];
      const start = timeToMinutes(s?.startTime);
      const end = timeToMinutes(s?.endTime);

      if (!Number.isFinite(start) || !Number.isFinite(end)) {
        return `Invalid time format in Slot ${i + 1} under ${type.toUpperCase()}.`;
      }
      if (end <= start) {
        return `Slot ${i + 1}: End Time must be after Start Time under ${type.toUpperCase()}.`;
      }
    }

    return null;
  };

  useEffect(() => {
    axios
      .get(`/api/interns/${internshipId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      })
      .then(({ data }) => {
        const resolvedType = normalizeInternshipMode(data.internshipMode); // ✅ read from DB

        setLockedInternshipType(resolvedType);
        setLockedClassification(data.classification || '');

        setForm(f => ({
          ...f,
          startDate: new Date(data.startDate).toISOString().split('T')[0],
          endDate: new Date(data.endDateOrDuration).toISOString().split('T')[0],
          defaultType: resolvedType // ✅ reflect selected mode in schedule form
        }));
      })
      .catch(err => {
        setError(err.message);

        if (!initialInternshipMode) {
          setLockedInternshipType('online');
          setForm(f => ({
            ...f,
            defaultType: 'online'
          }));
        }
      });
  }, [initialInternshipMode, internshipId]);

  useEffect(() => {
    const fetchSchedule = async () => {
      try {
        const response = await axios.get('/api/schedule/get-schedule', {
          params: { internshipId, partnerId: localStorage.getItem('partnerId') }
        });
        const data = response.data;

        // derive saved defaults for Section Timings
        const savedType = data.defaultType || data?.timetable?.[0]?.type || 'online';
        const savedStart = data.defaultStartTime || data?.timetable?.[0]?.startTime || '';
        const savedEnd = data.defaultEndTime || data?.timetable?.[0]?.endTime || '';

        setForm(f => {
          const effectiveType = f.defaultType || savedType; // ✅ keep type coming from internship post

            const workHoursParts = (data.workHours || '').replace(' Hours', '').split(' - ');
            const savedWHStart = workHoursParts[0]?.trim() || '';
            const savedWHEnd = workHoursParts[1]?.trim() || '';

            return {
              ...f,
              startDate: data.startDate.slice(0, 10),
              endDate: data.endDate.slice(0, 10),
              workHoursStart: savedWHStart,
              workHoursEnd: savedWHEnd,

            defaultType: effectiveType,
            timeSlots: data.timeSlots
              ? {
                online: Array.isArray(data.timeSlots.online) ? data.timeSlots.online : [],
                offline: Array.isArray(data.timeSlots.offline) ? data.timeSlots.offline : [],
                hybrid: Array.isArray(data.timeSlots.hybrid) ? data.timeSlots.hybrid : [],
              }
              : {
                ...f.timeSlots,
                [effectiveType]: (savedStart || savedEnd)
                  ? [{ startTime: savedStart || '', endTime: savedEnd || '' }]
                  : []
              },

            ...(effectiveType === 'online'
              ? { onlineEventLink: data.defaultEventLink || data?.timetable?.[0]?.eventLink || '' }
              : {}),
            ...(effectiveType === 'hybrid'
              ? { hybridEventLink: data.defaultEventLink || data?.timetable?.[0]?.eventLink || '' }
              : {}),

            ...(effectiveType === 'offline'
              ? {
                offlineLocation:
                  data.defaultLocation || data?.timetable?.[0]?.location || { name: '', address: '', mapLink: '' }
              }
              : {}),
            ...(effectiveType === 'hybrid'
              ? {
                hybridLocation:
                  data.defaultLocation || data?.timetable?.[0]?.location || { name: '', address: '', mapLink: '' }
              }
              : {}),

            defaultEventLink: data.timetable[0]?.eventLink || '',
            defaultLocation: data.timetable[0]?.location || {
              name: '',
              address: '',
              mapLink: ''
            },
            isClosed: !!data.isClosed
          };
        });

        const formatTimetable = (tt) => (tt || []).map(entry => ({
          date: entry.date.slice(0, 10),
          day: entry.day,
          selected: true,
          startTime: entry.startTime,
          endTime: entry.endTime,
          eventLink: entry.eventLink || '',
          type: entry.type || 'online',
          location: entry.location || { name: '', address: '', mapLink: '' },
          sectionSummary: entry.sectionSummary || '',
          instructor: entry.instructor || '',
          assignment: entry.assignment || null,
          events: entry.events || [],
          mockInterview: entry.mockInterview || { enabled: false, questions: [] }
        }));

        if (data.batches && data.batches.length > 0) {
          const loadedBatches = {};
          data.batches.forEach(b => {
            loadedBatches[b.timeSlot] = formatTimetable(b.timetable);
          });
          setBatchTimetables(loadedBatches);
          setActiveBatchTab(data.batches[0].timeSlot);
        } else if (data.timetable && data.timetable.length > 0) {
          // Fallback for legacy paid schedules
          let fallbackSlot = 'Default Slot';
          if (data.timeSlots) {
            const effectiveType = data.defaultType || data.timetable[0]?.type || 'online';
            const slots = data.timeSlots[effectiveType];
            if (slots && slots.length > 0) {
              fallbackSlot = `${slots[0].startTime} - ${slots[0].endTime}`;
            }
          }
          setBatchTimetables({ [fallbackSlot]: formatTimetable(data.timetable) });
          setActiveBatchTab(fallbackSlot);
        }

        try {
          const miResponse = await axios.get(`/api/mock-interviews/internship/${internshipId}`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
          });
          setMockInterviews(miResponse.data || []);
        } catch (e) {
          console.error("Failed to load mock interviews", e);
        }

        // ✅ Always go straight to preview if schedule exists
        setPreviewed(true);
        setIsPersisted(true);
      } catch (err) {
        if (err.response?.status !== 404) {
          setError('Error loading schedule');
        }
      }
    };
    fetchSchedule();
  }, [internshipId]);

  const handleFormChange = e => {
    const { name, value } = e.target;

    // Location fields
    if (name.startsWith('offlineLocation.') || name.startsWith('hybridLocation.')) {
      const [prefix, field] = name.split('.');
      setForm(f => ({
        ...f,
        [prefix]: {
          ...f[prefix],
          [field]: value
        }
      }));
    }

    else {
      setForm(f => ({ ...f, [name]: value }));
    }
  };

  const toggleWeekday = day =>
    setForm(f => {
      const sel = new Set(f.selectedDays);
      sel.has(day) ? sel.delete(day) : sel.add(day);
      return { ...f, selectedDays: Array.from(sel) };
    });



  const generatePreview = async () => {
    const {
      startDate,
      endDate,
      defaultType,
      selectedDays,
      workHoursStart,
      workHoursEnd
    } = form;

    const eventLink =
      defaultType === 'online'
        ? form.onlineEventLink
        : defaultType === 'hybrid'
          ? form.hybridEventLink
          : '';

    const location =
      defaultType === 'offline'
        ? form.offlineLocation
        : defaultType === 'hybrid'
          ? form.hybridLocation
          : { name: '', address: '', mapLink: '' };

    if (!startDate || !endDate) {
      return setError('Fill both start date and end date');
    }

    // 🔴 NEW VALIDATION: end date cannot be before start date
    if (endDate < startDate) {
      return setError('End date cannot be before start date');
    }

    if (!workHoursStart || !workHoursEnd) {
      return setError('Fill work hours before generating schedule');
    }

    // Validating Work Hours
    const finalStartTime = workHoursStart;
    const finalEndTime = workHoursEnd;
    const whStart = timeToMinutes(finalStartTime);
    const whEnd = timeToMinutes(finalEndTime);
    if (!finalStartTime || !finalEndTime || !Number.isFinite(whStart) || !Number.isFinite(whEnd)) {
      return setError('Work Hours must be in format like: 09:00 - 17:00');
    }
    if (whEnd <= whStart) {
      return setError('Work Hours: End Time must be after Start Time.');
    }

    // Slots are mandatory
    const slotErr = validateSlotsForType(defaultType);
    if (slotErr) return setError(slotErr);

    if (!selectedDays.length) {
      return setError('Select at least one day');
    }

    const activeSlots = form.timeSlots[defaultType] || [];
    const newBatchTimetables = {};
    let firstSlot = "";

    // Calculate target mock interview weeks
    const startObj = new Date(startDate);
    const endObj = new Date(endDate);
    const diffDays = Math.ceil(Math.abs(endObj - startObj) / (1000 * 60 * 60 * 24));
    const weeksCount = diffDays / 7;
    const targetMockWeeks = [];
    const weeksRound = Math.round(weeksCount);
    if (weeksRound <= 4) {
      targetMockWeeks.push(2);
    } else {
      // Automatically add a mock interview every 3 weeks (3, 6, 9, 12, etc.)
      for (let w = 3; w <= weeksRound - 2; w += 3) {
        targetMockWeeks.push(w);
      }
    }

    const newMockInterviews = [...mockInterviews];

    targetMockWeeks.forEach(w => {
      let lastDayOfW = null;
      for (let d = new Date(startDate); d <= new Date(endDate); d.setDate(d.getDate() + 1)) {
        const wNum = Math.floor((d - startObj) / (7 * 24 * 60 * 60 * 1000)) + 1;
        const dayName = d.toLocaleString('en-us', { weekday: 'long' });
        if (wNum === w && selectedDays.includes(dayName)) {
          lastDayOfW = new Date(d).toISOString().split('T')[0];
        }
      }
      
      if (lastDayOfW) {
         const exists = newMockInterviews.find(mi => mi.weekNumber === w);
         if (!exists) {
            newMockInterviews.push({
               weekNumber: w,
               title: `Mock Interview ${newMockInterviews.length + 1}`,
               interviewType: 'Technical',
               date: lastDayOfW,
               startTime: workHoursStart,
               endTime: workHoursEnd,
               duration: 60,
               interviewer: '',
               meetingLink: '',
               instructions: 'Please be prepared for a technical mock interview.',
               status: 'Scheduled'
            });
         }
      }
    });
    setMockInterviews(newMockInterviews);

    // ✅ PRE-FETCH AI SUMMARIES ONCE FOR ALL BATCHES
    let sharedAiSummaryMap = {};
    if (form.scheduleMode === 'automated') {
      const repDays = [];
      let dayCounter = 1;
      for (let d = new Date(startDate); d <= new Date(endDate); d.setDate(d.getDate() + 1)) {
        const dayName = d.toLocaleString('en-us', { weekday: 'long' });
        if (selectedDays.includes(dayName)) {
          repDays.push({
            date: d.toISOString().split('T')[0],
            dayNumber: dayCounter,
            type: defaultType
          });
          dayCounter++;
        }
      }

      const targetDays = isPersisted ? repDays.filter(d => isFutureDate(d.date)) : repDays;

      if (targetDays.length > 0) {
        setAiGenerating(true);
        try {
          const { data } = await axios.post(
            '/api/schedule/ai-section-summaries',
            {
              internshipId,
              totalDays: repDays.length,
              batchTimeSlot: null, // Don't bind to a specific batch to get identical results
              days: targetDays
            },
            { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
          );
          (data?.summaries || []).forEach(s => {
            if (s?.date) sharedAiSummaryMap[s.date] = s.sectionSummary || '';
          });
        } catch (err) {
          console.error('AI Section Summary generation failed:', err);
          setError(err.response?.data?.error || 'AI generation failed. You can still edit manually.');
        } finally {
          setAiGenerating(false);
        }
      }
    }

    for (let sIdx = 0; sIdx < activeSlots.length; sIdx++) {
      const slot = activeSlots[sIdx];
      const slotName = `${slot.startTime} - ${slot.endTime}`;
      if (sIdx === 0) firstSlot = slotName;

      // If the schedule is already saved, keep a quick lookup to preserve past days for this batch
      const existingByDate = (isPersisted && batchTimetables[slotName])
        ? Object.fromEntries(batchTimetables[slotName].map(d => [d.date, d]))
        : {};

      const days = [];
      let dayCounter = 1;

      for (let d = new Date(startDate); d <= new Date(endDate); d.setDate(d.getDate() + 1)) {
        const dayName = d.toLocaleString('en-us', { weekday: 'long' });

        if (selectedDays.includes(dayName)) {
          const key = `Day - ${dayCounter}`;
          const isoDateKey = d.toISOString().split('T')[0];

          // ⛔ After first save: do NOT let Excel overwrite past dates
          if (isPersisted) {
            const existing = existingByDate[isoDateKey];
            if (existing && isPastDate(isoDateKey)) {
              days.push({ ...existing });
              dayCounter++;
              continue; // skip any Excel/default overrides for this past day
            }
          }

          const excelEntry = excelData[key] || excelData[isoDateKey] || {};
          const useExcelData = Object.keys(excelEntry).length > 0;
          const entryType = excelEntry.type || defaultType;

          const resolvedType =
            defaultType === 'hybrid'
              ? (entryType === 'online' || entryType === 'offline' ? entryType : 'online')
              : defaultType;

          days.push({
            date: d.toISOString().split('T')[0],
            day: dayName,
            selected: true,
            startTime: slot.startTime, // ✅ Use batch's start time
            endTime: slot.endTime,     // ✅ Use batch's end time
            sectionSummary: useExcelData ? excelEntry.summary || '' : '',
            instructor: useExcelData ? excelEntry.instructor || '' : '',
            assignment: null,
            type: resolvedType,
            eventLink: resolvedType === 'online'
              ? (useExcelData ? excelEntry.link || eventLink : eventLink)
              : '',
            location: resolvedType === 'offline'
              ? {
                name: useExcelData ? (excelEntry.locationName || location.name) : location.name,
                address: useExcelData ? (excelEntry.address || location.address) : location.address,
                mapLink: useExcelData ? (excelEntry.mapLink || location.mapLink) : location.mapLink
              }
              : { name: '', address: '', mapLink: '' },
            events: [],
            mockInterview: {
              enabled: false,
              questions: []
            }
          });

          dayCounter++;
        }
      }

      // Apply the pre-fetched shared AI summaries
      const finalDays = days.map(d => {
        const aiText = sharedAiSummaryMap[d.date];
        if (!aiText) return d;
        // If already has summary (Excel/user), keep it
        if (d.sectionSummary && d.sectionSummary.trim() !== '') return d;
        return { ...d, sectionSummary: aiText };
      });
      newBatchTimetables[slotName] = finalDays;
    }

    setBatchTimetables(newBatchTimetables);
    setActiveBatchTab(firstSlot);
    setPreviewed(true);
    setError(null);
  };

  // Auto-scroll to today's date ONLY after the schedule has been saved (isPersisted)
  useEffect(() => {
    // Do not autoscroll on Read-Only page
    if (!previewed || !isPersisted || readOnly || !todayRef.current || !previewScrollRef.current) return;
    if (hasAutoScrolledRef.current) return;

    const scrollToToday = () => {
      const container = previewScrollRef.current;
      const todayElement = todayRef.current;
      const containerRect = container.getBoundingClientRect();
      const todayRect = todayElement.getBoundingClientRect();
      const scrollOffset = todayRect.top - containerRect.top + container.scrollTop - 12;

      container.scrollTo({ top: scrollOffset, behavior: 'smooth' });
      hasAutoScrolledRef.current = true;
    };

    const timeout = setTimeout(scrollToToday, 250);
    return () => clearTimeout(timeout);
  }, [previewed, isPersisted, readOnly]); // ← added isPersisted

  // Reset auto-scroll flag whenever Preview is closed
  useEffect(() => {
    if (!previewed) {
      hasAutoScrolledRef.current = false;
    }
  }, [previewed]);

  const generateMockQuestions = async (idx) => {
    setAiGenerating(true);
    try {
      const { data } = await axios.post(
        '/api/schedule/ai-mock-interview',
        { internshipId },
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
      
      setBatchTimetables(prev => {
        if (!activeBatchTab) return prev;
        const tt = prev[activeBatchTab] || [];
        const copy = [...tt];
        copy[idx].mockInterview.questions = data.questions;
        return { ...prev, [activeBatchTab]: copy };
      });
    } catch (err) {
      console.error('Mock Interview generation failed:', err);
      setError(err.response?.data?.error || 'Failed to generate mock interview questions.');
    } finally {
      setAiGenerating(false);
    }
  };

  const toggleDay = idx =>
    setBatchTimetables(prev => {
      if (!activeBatchTab) return prev;
      const tt = prev[activeBatchTab] || [];
      const copy = [...tt];
      copy[idx].selected = !copy[idx].selected;
      return { ...prev, [activeBatchTab]: copy };
    });

  const changeField = (idx, field, val) =>
    setBatchTimetables(prev => {
      if (!activeBatchTab) return prev;
      const tt = prev[activeBatchTab] || [];
      const copy = [...tt];
      copy[idx][field] = val;

      // Reset / auto-fill when type changes
      if (field === 'type') {
        if (val === 'online') {
          // Clear location, set meeting link from Hybrid/Online defaults
          copy[idx].location = getDefaultLocationForType('online'); // empty object
          copy[idx].eventLink = getDefaultEventLinkForType('online');
        } else if (val === 'offline') {
          // Clear link, set location from Hybrid/Offline defaults
          copy[idx].eventLink = '';
          copy[idx].location = getDefaultLocationForType('offline');
        }
      }

      return { ...prev, [activeBatchTab]: copy };
    });

  const changeLocationField = (idx, field, val) =>
    setBatchTimetables(prev => {
      if (!activeBatchTab) return prev;
      const tt = prev[activeBatchTab] || [];
      const copy = [...tt];
      copy[idx].location = {
        ...copy[idx].location,
        [field]: val
      };
      return { ...prev, [activeBatchTab]: copy };
    });

  const addNewDay = () => {
    const {
      newDate,
      defaultType,
      startDate,
      endDate
    } = form;

    // ✅ Use ONLY Work Hours for added day times (Slots are ignored)
    const finalStartTime = form.workHoursStart;
    const finalEndTime = form.workHoursEnd;

    // Validate Work Hours format and order
    const whStart = timeToMinutes(finalStartTime);
    const whEnd = timeToMinutes(finalEndTime);

    if (!finalStartTime || !finalEndTime || !Number.isFinite(whStart) || !Number.isFinite(whEnd)) {
      return setError('Work Hours must be in format like: 09:00 - 17:00');
    }
    if (whEnd <= whStart) {
      return setError('Work Hours: End Time must be after Start Time.');
    }

    // Slots are optional; validate only if user added slots
    const slotErr = validateSlotsForType(defaultType);
    if (slotErr) return setError(slotErr);

    const defaultEventLink =
      defaultType === 'online'
        ? form.onlineEventLink
        : defaultType === 'hybrid'
          ? form.hybridEventLink
          : null;

    const defaultLocation =
      defaultType === 'offline'
        ? form.offlineLocation
        : defaultType === 'hybrid'
          ? form.hybridLocation
          : { name: '', address: '', mapLink: '' };

    if (!newDate) {
      return setError('Pick a date');
    }
    if (newDate < startDate || newDate > endDate) {
      return setError(`Date must be between ${startDate} and ${endDate}`);
    }
    if (defaultType === 'offline' && !defaultLocation.address) {
      return setError('Location address is required for offline days');
    }

    const name = new Date(newDate).toLocaleString('en-us', { weekday: 'long' });

    const initialType = defaultType === 'hybrid' ? 'online' : (defaultType || 'online');

    const newDayEntry = {
      date: newDate,
      day: name,
      selected: true,
      startTime: activeBatchTab ? activeBatchTab.split(' - ')[0] : (finalStartTime || ''),
      endTime: activeBatchTab ? activeBatchTab.split(' - ')[1] : (finalEndTime || ''),
      type: initialType,
      eventLink: initialType === 'online' ? (defaultEventLink || '') : '',
      location: initialType === 'offline'
        ? (defaultLocation || { name: '', address: '', mapLink: '' })
        : { name: '', address: '', mapLink: '' },
      sectionSummary: '',
      instructor: '',
      assignment: null,
      events: []
    };

    setBatchTimetables(prev => {
      if (!activeBatchTab) return prev;
      const tt = prev[activeBatchTab] || [];
      return { ...prev, [activeBatchTab]: [...tt, newDayEntry] };
    });
    setForm(f => ({ ...f, newDate: '' }));
    setError(null);
  };

  const saveSchedule = async e => {
    e.preventDefault();
    setLoading(true);

    try {
      // ✅ Use ONLY Work Hours for saved default times (Slots are ignored)
      const finalStartTime = form.workHoursStart;
      const finalEndTime = form.workHoursEnd;

      // Validate Work Hours format and order
      const whStart = timeToMinutes(finalStartTime);
      const whEnd = timeToMinutes(finalEndTime);

      if (!finalStartTime || !finalEndTime || !Number.isFinite(whStart) || !Number.isFinite(whEnd)) {
        setLoading(false);
        return setError('Work Hours must be in format like: 09:00 - 17:00');
      }
      if (whEnd <= whStart) {
        setLoading(false);
        return setError('Work Hours: End Time must be after Start Time.');
      }

      // Slots are optional; validate only if user added slots
      const slotErr = validateSlotsForType(form.defaultType);
      if (slotErr) {
        setLoading(false);
        return setError(slotErr);
      }

      const payload = {
        internshipId,
        partnerId: localStorage.getItem('partnerId'),
        startDate: form.startDate,
        endDate: form.endDate,
        workHours: `${form.workHoursStart} - ${form.workHoursEnd} Hours`,
        defaultStartTime: finalStartTime || null,
        defaultEndTime: finalEndTime || null,
        defaultEventLink:
          form.defaultType === 'online'
            ? form.onlineEventLink
            : form.defaultType === 'hybrid'
              ? form.hybridEventLink
              : null,

        defaultLocation:
          form.defaultType === 'offline'
            ? form.offlineLocation
            : form.defaultType === 'hybrid'
              ? form.hybridLocation
              : null,
        defaultType: form.defaultType, timeSlots: {
          [form.defaultType]: form.timeSlots?.[form.defaultType] || []
        },
        selectedDays: form.selectedDays,
        batches: Object.keys(batchTimetables).map(timeSlot => ({
          timeSlot,
          timetable: (batchTimetables[timeSlot] || [])
            .filter(d => d.selected)
            .map(day => ({
              ...day,
              location: day.type === 'online' ? null : day.location,
              assignment: day.assignment?.name || null
            }))
        })),
        attendanceSettings: form.attendanceSettings,
        timetable: [] // legacy field left empty since we use batches now
      };

      const resp = await axios.post('/api/schedule/create', payload, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      
      try {
        await axios.post('/api/mock-interviews', {
          internshipId,
          scheduleId: resp.data.scheduleId || null,
          partnerId: localStorage.getItem('partnerId'),
          mockInterviews
        }, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
      } catch (miErr) {
        console.error("Failed to save mock interviews", miErr);
      }

      setIsPersisted(true); // <— ADD THIS
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Save failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center p-4 z-50">
      <form
        onSubmit={saveSchedule}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-3 text-white">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold">Schedule Configuration</h2>
              <p className="text-indigo-100 opacity-90">
                {previewed
                  ? readOnly
                    ? 'View Schedule (Read - Only)'
                    : 'Review and edit schedule'
                  : 'Set up internship schedule'}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-white hover:text-indigo-200 transition-colors p-1 rounded-full"
            >
              <FiX size={24} />
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 mx-6 mt-4 rounded-r">
            <p className="text-red-700 font-medium">{error}</p>
          </div>
        )}

        {/* Content Area */}
        <div className="p-6 overflow-y-auto flex-1">
          {!previewed ? (
            <div className="space-y-8">
              {/* Date Range Section */}
              <div className={`${!isPersisted ? 'bg-white' : 'bg-gray-50'} p-5 rounded-xl border border-gray-200`}>
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                  <FiCalendar className="mr-2 text-indigo-600" />
                  Date Range
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Start Date
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                        <FiCalendar />
                      </div>
                      <input
                        type="date"
                        name="startDate"
                        value={form.startDate}
                        onChange={handleFormChange}
                        className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      End Date
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                        <FiCalendar />
                      </div>
                      <input
                        type="date"
                        name="endDate"
                        value={form.endDate}
                        onChange={handleFormChange}
                        className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        required
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Work Hours Section */}
              <div className="bg-gray-50 p-5 rounded-xl border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Work Hours</h3>
                <div className="flex items-center gap-4">
                  <input
                    type="time"
                    name="workHoursStart"
                    value={form.workHoursStart}
                    onChange={handleFormChange}
                    className="block w-full px-4 py-2 border border-gray-300 rounded-lg bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    required
                  />
                  <span className="text-gray-500 font-medium">to</span>
                  <input
                    type="time"
                    name="workHoursEnd"
                    value={form.workHoursEnd}
                    onChange={handleFormChange}
                    className="block w-full px-4 py-2 border border-gray-300 rounded-lg bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    required
                  />
                </div>
              </div>

              {/* Internship Type */}
              <div className="bg-gray-50 p-5 rounded-xl border border-gray-200 space-y-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-800 mb-0">Internship Type</h3>

                  <div className="flex items-center gap-4 pr-3">
                    {lockedClassification && (
                      <div className="flex items-center">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${lockedClassification === "Basic"
                            ? "bg-slate-100 text-slate-800"
                            : lockedClassification === "Intermediate"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-rose-100 text-rose-800"
                            }`}
                        >
                          {lockedClassification}
                        </span>
                      </div>
                    )}

                    {visibleInternshipTypes.map(type => (
                      <div key={type} className="flex items-center">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${type === "online"
                            ? "bg-blue-100 text-blue-800"
                            : type === "offline"
                              ? "bg-green-100 text-green-800"
                              : "bg-purple-100 text-purple-800"
                            }`}
                        >
                          {type}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 2 + 3) Default Times + Default Meeting Link – combined only for online type */}
                {form.defaultType === 'online' && (
                  <div className="bg-white mt-6 p-5 rounded-xl border border-gray-300 space-y-6">

                    {/* ✅ Select Time Slot (Online) */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-md font-semibold text-gray-700 flex items-center">
                          <FiClock className="mr-2 text-indigo-600" />
                          <span className="mr-1">Select Time Slot</span>
                          <span className="text-sm text-grey-500 font-normal">*</span>
                        </h4>

                        <button
                          type="button"
                          onClick={() => addSlot('online')}
                          className="px-3 py-1.5 text-sm font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                        >
                          + Add Slot
                        </button>
                      </div>

                      {form.timeSlots.online.length === 0 ? (
                        <p className="text-sm text-gray-500">
                          At least 1 slot is required. Click <b>+ Add Slot</b> to create one.
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {form.timeSlots.online.map((slot, i) => (
                            <div key={i} className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                              <div className="flex items-center justify-between">
                                <p className="text-sm font-semibold text-gray-700">Slot {i + 1}</p>

                                <button
                                  type="button"
                                  onClick={() => removeSlot('online', i)}
                                  className="text-sm font-semibold text-red-600 hover:text-red-700"
                                >
                                  Remove
                                </button>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-3">
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Slot {i + 1}: Start Time (24 Hours Format)
                                  </label>
                                  <input
                                    type="time"
                                    value={slot.startTime}
                                    onChange={(e) => updateSlot('online', i, 'startTime', e.target.value)}
                                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                  />
                                </div>

                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Slot {i + 1}: End Time (24 Hours Format)
                                  </label>
                                  <input
                                    type="time"
                                    value={slot.endTime}
                                    min={slot.startTime || undefined}
                                    onChange={(e) => updateSlot('online', i, 'endTime', e.target.value)}
                                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Default Meeting Link Section */}
                    <h4 className="text-md font-semibold text-gray-700 mb-3 flex items-center">
                      <FiLink className="mr-2 text-indigo-600" />
                      <span className="mr-1">Default Meeting Link</span>
                      <span className="text-sm text-gray-400 font-normal">(Optional)</span>
                    </h4>

                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                        <FiLink />
                      </div>
                      <input
                        type="url"
                        name="onlineEventLink"
                        value={form.onlineEventLink}
                        onChange={handleFormChange}
                        placeholder="https://meet.example.com/your-link"
                        className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>

                    <CreateMeetingLink
                      internshipId={internshipId}
                      meetingLink={form.onlineEventLink}
                      disabled={readOnly}
                      onMeetingLinkCreated={(meetingLink) => setForm((current) => ({
                        ...current,
                        onlineEventLink: meetingLink
                      }))}
                    />

                    {/* DOWNLOAD TEMPLATE BUTTON FOR ONLINE*/}
                    <div className="pt-2">
                      <a
                        href="/Online%20Internship%20Schedule%20Template.xlsx"
                        download
                        className="inline-block px-5 py-2 bg-blue-100 text-blue-700 text-sm font-semibold rounded-lg hover:bg-blue-200 transition"
                      >
                        Download Online Internship Schedule Template
                      </a>
                    </div>
                  </div>
                )}

                {/* Section Timings – only for offline */}
                {form.defaultType === 'offline' && (
                  <div className="bg-white mt-6 p-5 rounded-xl border border-gray-300 space-y-6">

                    {/* ✅ Select Time Slot (Offline) */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-md font-semibold text-gray-700 flex items-center">
                          <FiClock className="mr-2 text-indigo-600" />
                          <span className="mr-1">Select Time Slot</span>
                          <span className="text-sm text-grey-500 font-normal">*</span>
                        </h4>

                        <button
                          type="button"
                          onClick={() => addSlot('offline')}
                          className="px-3 py-1.5 text-sm font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                        >
                          + Add Slot
                        </button>
                      </div>

                      {form.timeSlots.offline.length === 0 ? (
                        <p className="text-sm text-gray-500">
                          At least 1 slot is required. Click <b>+ Add Slot</b> to create one.
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {form.timeSlots.offline.map((slot, i) => (
                            <div key={i} className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                              <div className="flex items-center justify-between">
                                <p className="text-sm font-semibold text-gray-700">Slot {i + 1}</p>

                                <button
                                  type="button"
                                  onClick={() => removeSlot('offline', i)}
                                  className="text-sm font-semibold text-red-600 hover:text-red-700"
                                >
                                  Remove
                                </button>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-3">
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Slot {i + 1}: Start Time (24 Hours Format)
                                  </label>
                                  <input
                                    type="time"
                                    value={slot.startTime}
                                    onChange={(e) => updateSlot('offline', i, 'startTime', e.target.value)}
                                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                  />
                                </div>

                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Slot {i + 1}: End Time (24 Hours Format)
                                  </label>
                                  <input
                                    type="time"
                                    value={slot.endTime}
                                    min={slot.startTime || undefined}
                                    onChange={(e) => updateSlot('offline', i, 'endTime', e.target.value)}
                                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Location Details */}
                    {renderLocationFields('offlineLocation', form.offlineLocation, handleFormChange)}

                    {/* DOWNLOAD TEMPLATE BUTTON FOR OFFLINE */}
                    <div className="pt-2">
                      <a
                        href="/Offline%20Internship%20Schedule%20Template.xlsx"
                        download
                        className="inline-block px-5 py-2 bg-blue-100 text-blue-700 text-sm font-semibold rounded-lg hover:bg-blue-200 transition"
                      >
                        Download Offline Internship Schedule Template
                      </a>
                    </div>
                  </div>
                )}

                {/* Section Timings – only for hybrid */}
                {form.defaultType === 'hybrid' && (
                  <div className="bg-white mt-6 p-5 rounded-xl border border-gray-300 space-y-6">

                    {/* ✅ Select Time Slot (Hybrid) */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-md font-semibold text-gray-700 flex items-center">
                          <FiClock className="mr-2 text-indigo-600" />
                          <span className="mr-1">Select Time Slot</span>
                          <span className="text-sm text-grey-500 font-normal">*</span>
                        </h4>

                        <button
                          type="button"
                          onClick={() => addSlot('hybrid')}
                          className="px-3 py-1.5 text-sm font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                        >
                          + Add Slot
                        </button>
                      </div>

                      {form.timeSlots.hybrid.length === 0 ? (
                        <p className="text-sm text-gray-500">
                          At least 1 slot is required. Click <b>+ Add Slot</b> to create one.
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {form.timeSlots.hybrid.map((slot, i) => (
                            <div key={i} className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                              <div className="flex items-center justify-between">
                                <p className="text-sm font-semibold text-gray-700">Slot {i + 1}</p>

                                <button
                                  type="button"
                                  onClick={() => removeSlot('hybrid', i)}
                                  className="text-sm font-semibold text-red-600 hover:text-red-700"
                                >
                                  Remove
                                </button>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-3">
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Slot {i + 1}: Start Time (24 Hours Format)
                                  </label>
                                  <input
                                    type="time"
                                    value={slot.startTime}
                                    onChange={(e) => updateSlot('hybrid', i, 'startTime', e.target.value)}
                                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                  />
                                </div>

                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Slot {i + 1}: End Time (24 Hours Format)
                                  </label>
                                  <input
                                    type="time"
                                    value={slot.endTime}
                                    min={slot.startTime || undefined}
                                    onChange={(e) => updateSlot('hybrid', i, 'endTime', e.target.value)}
                                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Default Meeting Link – Optional */}
                    <h4 className="text-md font-semibold text-gray-700 mb-3 flex items-center">
                      <FiLink className="mr-2 text-indigo-600" />
                      Default Meeting Link <span className="ml-2 text-sm text-gray-400 font-normal">(Optional)</span>
                    </h4>

                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                        <FiLink />
                      </div>
                      <input
                        type="url"
                        name="hybridEventLink"
                        value={form.hybridEventLink}
                        onChange={handleFormChange}
                        placeholder="https://meet.example.com/your-link"
                        className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>

                    <CreateMeetingLink
                      internshipId={internshipId}
                      meetingLink={form.hybridEventLink}
                      disabled={readOnly}
                      onMeetingLinkCreated={(meetingLink) => setForm((current) => ({
                        ...current,
                        hybridEventLink: meetingLink
                      }))}
                    />

                    {/* Default Location Details – Optional */}
                    {renderLocationFields('hybridLocation', form.hybridLocation, handleFormChange)}

                    {/* Download Template */}
                    <div className="pt-2">
                      <a
                        href="/Hybrid%20Internship%20Schedule%20Template.xlsx"
                        download
                        className="inline-block px-5 py-2 bg-blue-100 text-blue-700 text-sm font-semibold rounded-lg hover:bg-blue-200 transition"
                      >
                        Download Hybrid Internship Schedule Template
                      </a>
                    </div>
                  </div>
                )}

              </div>

              {/* Weekday Selection + Excel Upload */}
              <div className="bg-gray-50 p-5 rounded-xl border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Working Days</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-7 gap-3">
                  {allWeekdays.map(day => (
                    <div key={day} className="flex items-center">
                      <input
                        type="checkbox"
                        id={`day-${day}`}
                        checked={form.selectedDays.includes(day)}
                        onChange={() => toggleWeekday(day)}
                        className="h-5 w-5 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500 -mt-1"
                      />
                      <label
                        htmlFor={`day-${day}`}
                        className={`ml-2 text-sm font-medium ${form.selectedDays.includes(day) ? 'text-gray-900' : 'text-gray-500'
                          }`}
                      >
                        {day.substring(0, 3)}
                      </label>
                    </div>
                  ))}
                </div>

                {/* Upload Excel file below the checkboxes */}
                <div className="mt-6">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Upload Working Days (.xlsx):
                  </label>
                  <input
                    type="file"
                    accept=".xlsx"
                    onChange={e => {
                      const file = e.target.files[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = evt => {
                          const data = new Uint8Array(evt.target.result);
                          const workbook = XLSX.read(data, { type: 'array' });
                          const sheet = workbook.Sheets[workbook.SheetNames[0]];
                          const rows = XLSX.utils.sheet_to_json(sheet);

                          const formatted = {};
                          rows.forEach((row, index) => {
                            const rawDate = row['Date'];

                            if (rawDate) {
                              const dateKey =
                                typeof rawDate === 'string'
                                  ? rawDate.trim()
                                  : rawDate instanceof Date
                                    ? rawDate.toISOString().split('T')[0]
                                    : typeof rawDate === 'number'
                                      ? XLSX.SSF.format('yyyy-mm-dd', rawDate)
                                      : String(rawDate).trim();

                              formatted[dateKey] = {
                                summary: row['section summary'] || '',
                                instructor: row['Instructor Name'] || '',
                                type: (row['Section type'] || '').toLowerCase(),
                                link: row['Meeting Link'] || '',
                                locationName: row['Location Name'] || '',
                                address: row['Address'] || '',
                                mapLink: row['Map Link'] || ''
                              };
                            }
                          });

                          setExcelData(formatted);
                        };
                        reader.readAsArrayBuffer(file);
                      }
                    }}
                    className="block w-full text-sm text-gray-700 bg-white border border-gray-300 rounded-lg p-2 shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* ✅ Schedule Creation Method */}
              <div className="bg-gray-50 p-5 rounded-xl border border-gray-200 space-y-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">
                  Schedule Creation Method
                </h3>

                {/* Same layout style as Internship Type */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="flex items-center">
                    <input
                      type="radio"
                      id="scheduleMode-manual"
                      name="scheduleMode"
                      value="manual"
                      checked={form.scheduleMode === 'manual'}
                      onChange={handleFormChange}
                      className="h-5 w-5 text-indigo-600 focus:ring-indigo-500 -mt-0"
                    />
                    <label
                      htmlFor="scheduleMode-manual"
                      className="ml-2 text-sm font-medium text-gray-700"
                    >
                      Manual Schedule
                    </label>
                  </div>

                  <div className="flex items-center">
                    <input
                      type="radio"
                      id="scheduleMode-automated"
                      name="scheduleMode"
                      value="automated"
                      checked={form.scheduleMode === 'automated'}
                      onChange={handleFormChange}
                      className="h-5 w-5 text-indigo-600 focus:ring-indigo-500 -mt-0"
                    />
                    <label
                      htmlFor="scheduleMode-automated"
                      className="ml-2 text-sm font-medium text-gray-700"
                    >
                      Automated Schedule
                    </label>
                  </div>
                </div>

                {form.scheduleMode === 'automated' && (
                  <p className="text-sm text-gray-500">
                    Automated Schedule will auto-fill <b>Section Summary</b> for each scheduled day
                    based on the internship you posted and its <b>Classification</b> level
                    (<b>Basic</b>, <b>Intermediate</b>, <b>Advanced</b>).
                  </p>
                )}
              </div>

              {/* ✅ Attendance Settings */}
              <div className="bg-gray-50 p-5 rounded-xl border border-gray-200 space-y-4">
                <div className="flex justify-between items-center mb-1 flex-wrap gap-2">
                  <h3 className="text-lg font-semibold text-gray-800">Attendance Settings</h3>
                  <div className="flex items-center">
                    <label htmlFor="trackingEnabledPaid" className="mr-3 text-sm font-medium text-gray-700">
                      Enable Attendance Tracking
                    </label>
                    <button
                      type="button"
                      id="trackingEnabledPaid"
                      onClick={() => setForm(f => ({ ...f, attendanceSettings: { ...f.attendanceSettings, trackingEnabled: !f.attendanceSettings.trackingEnabled } }))}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${form.attendanceSettings.trackingEnabled ? 'bg-indigo-600' : 'bg-gray-300'}`}
                    >
                      <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${form.attendanceSettings.trackingEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                  </div>
                </div>

                {form.attendanceSettings.trackingEnabled && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Minimum Attendance Required (%) *</label>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={form.attendanceSettings.minAttendancePercent}
                        onChange={(e) => setForm(f => ({ ...f, attendanceSettings: { ...f.attendanceSettings, minAttendancePercent: Number(e.target.value) } }))}
                        placeholder="e.g. 80"
                        className="block w-full px-3 py-2 border border-gray-300 rounded-lg bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <p className="mt-1 text-xs text-gray-500">Students must attend at least this % of sessions to receive a certificate.</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Online Session Minimum Duration (minutes)</label>
                      <input
                        type="number"
                        min="0"
                        value={form.attendanceSettings.onlineMinDurationMins}
                        onChange={(e) => setForm(f => ({ ...f, attendanceSettings: { ...f.attendanceSettings, onlineMinDurationMins: Number(e.target.value) } }))}
                        placeholder="0"
                        className="block w-full px-3 py-2 border border-gray-300 rounded-lg bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <p className="mt-1 text-xs text-gray-500">0 = any join counts. Set e.g. 30 to require 30 mins in Google Meet.</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Generate Preview Button */}
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={generatePreview}
                  disabled={aiGenerating}
                  className={`flex items-center justify-center px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-medium rounded-lg shadow-md hover:from-indigo-700 hover:to-purple-700 transition-all transform hover:scale-105 ${aiGenerating ? 'opacity-60 cursor-not-allowed' : ''
                    }`}
                >
                  {aiGenerating ? 'Generating with AI...' : 'Generate Preview'}
                  <FiChevronRight className="ml-2" />
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Schedule Preview */}
              <div className="bg-gray-50 p-5 rounded-xl border border-gray-200">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-800">Schedule Preview</h3>
                </div>
                
                {/* Batch Tabs */}
                {Object.keys(batchTimetables).length > 0 && (
                  <div className="flex overflow-x-auto gap-2 mb-4 pb-2 border-b border-gray-200">
                    {Object.keys(batchTimetables).map(tab => (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setActiveBatchTab(tab)}
                        className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap ${
                          activeBatchTab === tab
                            ? 'bg-indigo-100 text-indigo-700 border-b-2 border-indigo-600'
                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                        }`}
                      >
                        Batch: {tab}
                      </button>
                    ))}
                  </div>
                )}
                
                <div
                  ref={previewScrollRef}
                  className="space-y-3 max-h-96 overflow-y-auto pr-2"
                >
                  {(batchTimetables[activeBatchTab] || []).map((day, idx) => {
                    const isPast = isPastDate(day.date);
                    const isFuture = isFutureDate(day.date);

                    // Rules:
                    // - Always lock if schedule is closed
                    // - If already saved (persisted), only allow editing future events
                    // - If not saved yet, allow editing everything
                    const ro = readOnly || (isPersisted && !isFuture);
                    const canEditDay = day.selected && !ro;

                    return (
                      <div
                        key={day.date}
                        ref={isPersisted && isToday(new Date(`${day.date}T00:00:00`)) ? todayRef : null}
                        className={`p-4 rounded-lg transition-all ${readOnly
                          ? 'bg-white border border-indigo-100 shadow-sm'
                          : (!isPersisted
                            ? 'bg-white border border-indigo-100 shadow-sm'
                            : (day.selected
                              ? (isPast ? 'bg-gray-100 border border-gray-200 opacity-80'
                                : 'bg-white border border-indigo-100 shadow-sm')
                              : 'bg-gray-100 border border-gray-200'))
                          }`}
                      >
                        {/* HEADER Row: Checkbox, Day, Type Dropdown */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            {ro ? (
                              // When a row is blocked (readOnly OR saved schedule & past day), remove the checkbox
                              // but keep the same space so layout doesn’t shift.
                              <span className="inline-block h-5 w-5" aria-hidden />
                            ) : (
                              <input
                                type="checkbox"
                                checked={day.selected}
                                onChange={() => toggleDay(idx)}
                                className="h-5 w-5 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                              />
                            )}
                            <div>
                              <p className="font-medium text-gray-900">
                                {new Date(day.date).toLocaleDateString('en-US', { weekday: 'long' })}
                              </p>
                              <p className="text-sm text-gray-500">
                                {new Date(day.date).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                })}
                              </p>
                              <span
                                className={`inline-block mt-1 px-2 py-0.5 text-xs rounded-full ${(form.defaultType === 'online')
                                  ? 'bg-blue-100 text-blue-800'
                                  : (form.defaultType === 'offline')
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-purple-100 text-purple-800'
                                  } capitalize`}
                              >
                                {form.defaultType}
                              </span>
                            </div>
                          </div>

                          {day.selected && (
                            <div className="flex items-center">
                              {form.defaultType === 'hybrid' ? (
                                // Hybrid: keep only the online/offline selector (no time fields)
                                canEditDay ? (
                                  <select
                                    value={day.type}
                                    onChange={(e) => changeField(idx, 'type', e.target.value)}
                                    className="text-sm rounded-lg border border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 px-2 py-[6px]"
                                  >
                                    <option value="online">online</option>
                                    <option value="offline">offline</option>
                                  </select>
                                ) : (
                                  <span className="px-3 py-1 bg-white border border-gray-300 rounded-lg shadow-sm capitalize">
                                    {day.type}
                                  </span>
                                )
                              ) : (
                                // Online/Offline: show only type text (no time fields)
                                <span className="px-3 py-1 bg-white border border-gray-300 rounded-lg shadow-sm capitalize">
                                  {day.type}
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Editable Details Section */}
                        {day.selected && (
                          <div className="mt-4 ml-14 space-y-4">
                            {/* Online Meeting Link */}
                            {day.type === 'online' && (
                              <div>
                                <h4 className="text-md font-semibold text-gray-700 mb-1 flex items-center">
                                  <FiLink className="mr-2 text-indigo-600" />
                                  Meeting Link
                                </h4>
                                <input
                                  type="text"
                                  value={day.eventLink}
                                  onChange={(e) => !ro && changeField(idx, 'eventLink', e.target.value)}
                                  placeholder="Meeting link"
                                  className="block w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                                  readOnly={ro}
                                />
                              </div>
                            )}

                            {/* Mock Interview UI */}
                            {day.mockInterview?.enabled && (
                              <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-lg">
                                <div className="flex items-center justify-between mb-2">
                                  <h4 className="text-md font-semibold text-indigo-800 flex items-center">
                                    🎯 Mock Interview Scheduled
                                  </h4>
                                  {!ro && (
                                    <button
                                      type="button"
                                      onClick={() => generateMockQuestions(idx)}
                                      disabled={aiGenerating}
                                      className="px-3 py-1 bg-indigo-600 text-white text-xs font-semibold rounded hover:bg-indigo-700"
                                    >
                                      {aiGenerating ? 'Generating...' : 'Generate Mock Questions'}
                                    </button>
                                  )}
                                </div>
                                <p className="text-xs text-indigo-600 mb-2">
                                  This day is designated for a Mock Interview. Students will see a "Take Mock Interview" button on this day.
                                </p>
                                {day.mockInterview.questions && day.mockInterview.questions.length > 0 && (
                                  <div className="mt-2 text-sm text-gray-700">
                                    <p className="font-semibold mb-1">Generated Questions:</p>
                                    <ul className="list-disc pl-5 space-y-1">
                                      {day.mockInterview.questions.map((q, i) => (
                                        <li key={i}>{q}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Section Summary */}
                            <div>
                              <label className="text-md font-semibold text-gray-700 mb-1 flex items-center">
                                Section Summary
                              </label>
                              <textarea
                                value={day.sectionSummary || ''}
                                onChange={(e) => !ro && changeField(idx, 'sectionSummary', e.target.value)}
                                placeholder="Write a brief section summary here..."
                                rows={2}
                                className="block w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                                readOnly={ro}
                              />
                            </div>

                            {/* Instructor */}
                            <div>
                              <label className="text-md font-semibold text-gray-700 mb-1 flex items-center">
                                Instructor Name
                              </label>
                              <textarea
                                value={day.instructor || ''}
                                onChange={(e) => !ro && changeField(idx, 'instructor', e.target.value)}
                                placeholder="Enter instructor name(s)..."
                                rows={1}
                                className="block w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                                readOnly={ro}
                              />
                            </div>

                            {/* Assignment Upload */}
                            {!ro && (
                              <div>
                                <label className="text-md font-semibold text-gray-700 mb-1 flex items-center">
                                  Assignment
                                </label>
                                <input
                                  type="file"
                                  onChange={(e) => {
                                    const file = e.target.files[0];
                                    changeField(idx, 'assignment', file);
                                  }}
                                  className="block w-full text-sm text-gray-700 bg-white border border-gray-300 rounded-lg p-2 shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                                />
                              </div>
                            )}

                            {/* Location for Offline */}
                            {day.type === 'offline' && (
                              <div className="mt-4">
                                <h4 className="text-md font-semibold text-gray-700 mb-3 flex items-center">
                                  <FiMapPin className="mr-2 text-indigo-600" />
                                  Location Details
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                      Location Name
                                    </label>
                                    <input
                                      type="text"
                                      value={day.location.name || ''}
                                      onChange={(e) => !ro && changeLocationField(idx, 'name', e.target.value)}
                                      placeholder="Building / Room Name"
                                      className="block w-full pl-3 pr-3 py-2 border border-gray-300 rounded-lg bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                      readOnly={ro}
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                      Address
                                    </label>
                                    <input
                                      type="text"
                                      value={day.location.address || ''}
                                      onChange={(e) => !ro && changeLocationField(idx, 'address', e.target.value)}
                                      placeholder="Full Address"
                                      className="block w-full pl-3 pr-3 py-2 border border-gray-300 rounded-lg bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                      readOnly={ro}
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                      Map Link
                                    </label>
                                    <input
                                      type="url"
                                      value={day.location.mapLink || ''}
                                      onChange={(e) => !ro && changeLocationField(idx, 'mapLink', e.target.value)}
                                      placeholder="https://maps.example.com/your-location"
                                      className="block w-full pl-3 pr-3 py-2 border border-gray-300 rounded-lg bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                      readOnly={ro}
                                    />
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Mock Interviews Section */}
              <div className="bg-indigo-50 p-5 rounded-xl border border-indigo-200 mt-6 mb-6">
                <h4 className="text-lg font-semibold text-indigo-900 mb-4 flex items-center">
                   🎯 Scheduled Mock Interviews
                </h4>
                {mockInterviews.length === 0 ? (
                   <p className="text-sm text-indigo-700">No mock interviews scheduled for this duration.</p>
                ) : (
                   <div className="space-y-4">
                     {mockInterviews.map((mi, idx) => {
                        // Parse date for input value (YYYY-MM-DD)
                        let dateInputValue = '';
                        let displayDate = mi.date;
                        if (mi.date) {
                           const d = new Date(mi.date);
                           if (!isNaN(d.getTime())) {
                              dateInputValue = d.toISOString().split('T')[0];
                              displayDate = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                           }
                        }

                        return (
                        <div key={idx} className="p-4 bg-white rounded-lg shadow-sm border border-indigo-100 relative">
                           {!readOnly && (
                               <button
                                 type="button"
                                 onClick={() => {
                                    const updated = [...mockInterviews];
                                    updated.splice(idx, 1);
                                    setMockInterviews(updated);
                                 }}
                                 className="absolute top-3 right-3 text-red-400 hover:text-red-600 focus:outline-none"
                                 title="Remove Mock Interview"
                               >
                                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                               </button>
                           )}
                           <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-4 pr-8">
                               <span className="font-bold text-indigo-900 text-base flex items-center">
                                    Mock Interview {idx + 1}
                                   <span className="text-gray-400 font-normal ml-2 mr-2">|</span> 
                                   <span className="text-indigo-600 font-medium">{displayDate}</span>
                               </span>
                               <span className="text-xs bg-indigo-100 text-indigo-800 px-3 py-1 rounded-full font-semibold mt-2 md:mt-0 self-start md:self-auto border border-indigo-200 tracking-wide uppercase">{mi.status}</span>
                           </div>
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                 <label className="block text-xs font-semibold text-gray-600 mb-1">Title</label>
                                 <input
                                   type="text"
                                   value={mi.title}
                                   readOnly={readOnly}
                                   onChange={(e) => {
                                      const updated = [...mockInterviews];
                                      updated[idx].title = e.target.value;
                                      setMockInterviews(updated);
                                   }}
                                   className="block w-full px-2 py-1.5 border border-gray-300 rounded focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                                 />
                              </div>
                              <div>
                                 <label className="block text-xs font-semibold text-gray-600 mb-1">Date</label>
                                 <input
                                   type="date"
                                   value={dateInputValue}
                                   readOnly={readOnly}
                                   onChange={(e) => {
                                      const updated = [...mockInterviews];
                                      updated[idx].date = e.target.value;
                                      setMockInterviews(updated);
                                   }}
                                   className="block w-full px-2 py-1.5 border border-gray-300 rounded focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                                 />
                              </div>
                              <div>
                                 <label className="block text-xs font-semibold text-gray-600 mb-1">Type</label>
                                 <select
                                   value={mi.interviewType}
                                   disabled={readOnly}
                                   onChange={(e) => {
                                      const updated = [...mockInterviews];
                                      updated[idx].interviewType = e.target.value;
                                      setMockInterviews(updated);
                                   }}
                                   className="block w-full px-2 py-1.5 border border-gray-300 rounded focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                                 >
                                    <option value="Technical">Technical</option>
                                    <option value="HR">HR</option>
                                    <option value="AI Voice">AI Voice</option>
                                    <option value="Coding">Coding</option>
                                    <option value="Other">Other</option>
                                 </select>
                              </div>
                              <div>
                                 <label className="block text-xs font-semibold text-gray-600 mb-1">Meeting Link (Live/External)</label>
                                 <input
                                   type="url"
                                   value={mi.meetingLink}
                                   readOnly={readOnly}
                                   onChange={(e) => {
                                      const updated = [...mockInterviews];
                                      updated[idx].meetingLink = e.target.value;
                                      setMockInterviews(updated);
                                   }}
                                   className="block w-full px-2 py-1.5 border border-gray-300 rounded focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                                   placeholder="https://..."
                                 />
                              </div>
                              <div className="md:col-span-2">
                                 <label className="block text-xs font-semibold text-gray-600 mb-1">Interviewer (Optional)</label>
                                 <input
                                   type="text"
                                   value={mi.interviewer}
                                   readOnly={readOnly}
                                   onChange={(e) => {
                                      const updated = [...mockInterviews];
                                      updated[idx].interviewer = e.target.value;
                                      setMockInterviews(updated);
                                   }}
                                   className="block w-full px-2 py-1.5 border border-gray-300 rounded focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                                 />
                              </div>
                           </div>
                           <div className="mt-4">
                              <label className="block text-xs font-semibold text-gray-600 mb-1">Instructions</label>
                              <textarea
                                value={mi.instructions}
                                readOnly={readOnly}
                                onChange={(e) => {
                                   const updated = [...mockInterviews];
                                   updated[idx].instructions = e.target.value;
                                   setMockInterviews(updated);
                                }}
                                className="block w-full px-2 py-1.5 border border-gray-300 rounded focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                                rows={2}
                              />
                           </div>
                        </div>
                        );
                     })}
                   </div>
                )}
                 {!readOnly && (
                    <button
                      type="button"
                      onClick={() => {
                         const nextWeekNum = mockInterviews.length > 0 
                             ? Math.max(...mockInterviews.map(m => m.weekNumber || 0)) + 3 
                             : 2;
                         // Default to a date within the internship if possible
                         let defaultDate = new Date().toISOString();
                         if (mockInterviews.length > 0 && mockInterviews[mockInterviews.length - 1].date) {
                             const lastDate = new Date(mockInterviews[mockInterviews.length - 1].date);
                             if (!isNaN(lastDate.getTime())) {
                                lastDate.setDate(lastDate.getDate() + 21); // add 3 weeks
                                defaultDate = lastDate.toISOString();
                             }
                         }

                         setMockInterviews([...mockInterviews, {
                            weekNumber: nextWeekNum,
                             title: `Mock Interview ${mockInterviews.length + 1}`,
                            interviewType: 'Technical',
                            date: defaultDate,
                            startTime: '09:00',
                            endTime: '10:00',
                            duration: 60,
                            interviewer: '',
                            meetingLink: '',
                            instructions: 'Please be prepared for a technical mock interview.',
                            status: 'Scheduled'
                         }]);
                      }}
                      className="mt-4 flex items-center justify-center w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 border border-transparent font-medium"
                    >
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                      Add Mock Interview
                    </button>
                 )}
              </div>

              {/* Add Additional Day Section */}
              {!readOnly && (
                <div className="bg-gray-50 p-5 rounded-xl border border-gray-200">
                  <h4 className="text-lg font-semibold text-gray-800 mb-4">Add Additional Day</h4>
                  <div className="space-y-3">
                    <div className="flex space-x-2">
                      <div className="flex-1">
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                            <FiCalendar size={16} />
                          </div>
                          <input
                            type="date"
                            name="newDate"
                            value={form.newDate}
                            onChange={handleFormChange}
                            className="block w-full pl-10 pr-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                          />
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={addNewDay}
                      className="flex items-center justify-center w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
                    >
                      <FiChevronRight size={18} className="mr-2" />
                      Add Day
                    </button>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              {readOnly ? (
                <div className="flex justify-end pt-4">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-5 py-2 bg-indigo-600 text-white rounded-lg shadow hover:bg-indigo-700"
                  >
                    Close
                  </button>
                </div>
              ) : (
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setPreviewed(false)}
                    className="px-6 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                  >
                    Back to Settings
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-6 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center"
                  >
                    {loading ? (
                      <>
                        <svg
                          className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          ></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          ></path>
                        </svg>
                        Saving...
                      </>
                    ) : (
                      'Save Schedule'
                    )}
                  </button>
                </div>
              )}

            </div>
          )}
        </div>
      </form>
    </div>
  );
};

export default ScheduleFormPaid;
