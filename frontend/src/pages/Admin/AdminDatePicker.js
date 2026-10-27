import React, { useState, useRef, useEffect, useMemo } from "react";
import { FaChevronLeft, FaChevronRight, FaRegCalendarAlt, FaTimes } from "react-icons/fa";

const DAYS_OF_WEEK = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const AdminDatePicker = ({
  value = "",
  onChange,
  placeholder = "dd-mm-yyyy",
  className = "",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Parse YYYY-MM-DD
  const selectedDate = useMemo(() => {
    if (!value) return null;
    const parts = value.split("-");
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      return new Date(year, month, day);
    }
    return null;
  }, [value]);

  // Current view month and year
  const [viewDate, setViewDate] = useState(() => {
    if (selectedDate) return new Date(selectedDate);
    return new Date();
  });

  // Keep viewDate in sync when value changes externally
  useEffect(() => {
    if (selectedDate) {
      setViewDate(new Date(selectedDate));
    }
  }, [selectedDate]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [isOpen]);

  const currentYear = viewDate.getFullYear();
  const currentMonth = viewDate.getMonth();

  const prevMonth = (e) => {
    e.stopPropagation();
    setViewDate(new Date(currentYear, currentMonth - 1, 1));
  };

  const nextMonth = (e) => {
    e.stopPropagation();
    setViewDate(new Date(currentYear, currentMonth + 1, 1));
  };

  // Generate calendar days
  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
    const daysInCurrentMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();

    const days = [];

    // Previous month padding days
    for (let i = firstDayOfMonth - 1; i >= 0; i--) {
      days.push({
        day: daysInPrevMonth - i,
        isCurrentMonth: false,
        year: currentMonth === 0 ? currentYear - 1 : currentYear,
        month: currentMonth === 0 ? 11 : currentMonth - 1,
      });
    }

    // Current month days
    for (let i = 1; i <= daysInCurrentMonth; i++) {
      days.push({
        day: i,
        isCurrentMonth: true,
        year: currentYear,
        month: currentMonth,
      });
    }

    // Next month padding days to complete 6 weeks grid (42 days) or at least 35
    const totalCells = days.length > 35 ? 42 : 35;
    const remaining = totalCells - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({
        day: i,
        isCurrentMonth: false,
        year: currentMonth === 11 ? currentYear + 1 : currentYear,
        month: currentMonth === 11 ? 0 : currentMonth + 1,
      });
    }

    return days;
  }, [currentYear, currentMonth]);

  const formatDisplayDate = (val) => {
    if (!val) return "";
    const parts = val.split("-");
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`; // DD-MM-YYYY
    }
    return val;
  };

  const handleSelectDay = (year, month, day, e) => {
    e.stopPropagation();
    const mm = String(month + 1).padStart(2, "0");
    const dd = String(day).padStart(2, "0");
    const dateStr = `${year}-${mm}-${dd}`;
    onChange(dateStr);
    setIsOpen(false);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange("");
    setIsOpen(false);
  };

  const handleToday = (e) => {
    e.stopPropagation();
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    const dateStr = `${yyyy}-${mm}-${dd}`;
    onChange(dateStr);
    setViewDate(today);
    setIsOpen(false);
  };

  const isToday = (year, month, day) => {
    const today = new Date();
    return (
      today.getFullYear() === year &&
      today.getMonth() === month &&
      today.getDate() === day
    );
  };

  const isSelected = (year, month, day) => {
    if (!selectedDate) return false;
    return (
      selectedDate.getFullYear() === year &&
      selectedDate.getMonth() === month &&
      selectedDate.getDate() === day
    );
  };

  return (
    <div className={`relative w-full ${className}`} ref={containerRef}>
      {/* Top Box Input Button - Click to open/close */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`w-full flex items-center justify-between px-3 py-1.5 border rounded-lg text-xs bg-white text-slate-700 shadow-xs transition-all cursor-pointer focus:outline-none select-none ${
          isOpen
            ? "border-blue-500 ring-2 ring-blue-500"
            : "border-slate-300 hover:border-slate-400"
        }`}
      >
        <span className={value ? "text-slate-800 font-medium" : "text-slate-400"}>
          {value ? formatDisplayDate(value) : placeholder}
        </span>
        <div className="flex items-center gap-1.5 text-slate-400">
          {value && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                handleClear(e);
              }}
              className="hover:text-rose-500 p-0.5 rounded transition cursor-pointer"
              title="Clear date"
            >
              <FaTimes size={10} />
            </span>
          )}
          <FaRegCalendarAlt size={12} className={isOpen ? "text-blue-600" : "text-slate-400"} />
        </div>
      </button>

      {/* Custom Down Box - EXACT top box width with left-0 right-0 w-full */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 w-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-2xl z-50 overflow-hidden p-3 font-poppins animate-in fade-in zoom-in-95 duration-100">
          {/* Calendar Header: Month & Year with Navigation Arrows */}
          <div className="flex items-center justify-between mb-2.5 px-1">
            <span className="text-xs font-bold text-slate-800">
              {MONTH_NAMES[currentMonth]}, {currentYear}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={prevMonth}
                className="w-6 h-6 rounded-md hover:bg-slate-100 text-slate-500 hover:text-slate-800 flex items-center justify-center transition cursor-pointer"
                title="Previous month"
              >
                <FaChevronLeft size={10} />
              </button>
              <button
                type="button"
                onClick={nextMonth}
                className="w-6 h-6 rounded-md hover:bg-slate-100 text-slate-500 hover:text-slate-800 flex items-center justify-center transition cursor-pointer"
                title="Next month"
              >
                <FaChevronRight size={10} />
              </button>
            </div>
          </div>

          {/* Days of Week Header */}
          <div className="grid grid-cols-7 text-center mb-1">
            {DAYS_OF_WEEK.map((day) => (
              <span key={day} className="text-[11px] font-bold text-slate-500 py-1">
                {day}
              </span>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {calendarDays.map((d, index) => {
              const selected = isSelected(d.year, d.month, d.day);
              const today = isToday(d.year, d.month, d.day);

              return (
                <button
                  key={`${d.year}-${d.month}-${d.day}-${index}`}
                  type="button"
                  onClick={(e) => handleSelectDay(d.year, d.month, d.day, e)}
                  className={`h-7 w-full rounded-md text-xs transition-colors flex items-center justify-center cursor-pointer select-none ${
                    selected
                      ? "bg-blue-600 text-white font-bold shadow-xs"
                      : today
                      ? "border border-blue-500 font-bold text-blue-600 hover:bg-blue-50"
                      : d.isCurrentMonth
                      ? "text-slate-700 hover:bg-blue-50 hover:text-blue-600 font-medium"
                      : "text-slate-300 hover:bg-slate-50 hover:text-slate-400 font-normal"
                  }`}
                >
                  {d.day}
                </button>
              );
            })}
          </div>

          {/* Bottom Footer Action Buttons: Clear and Today */}
          <div className="flex items-center justify-between pt-2.5 mt-2 border-t border-slate-100 px-1 text-xs font-semibold">
            <button
              type="button"
              onClick={handleClear}
              className="text-blue-600 hover:text-blue-800 transition cursor-pointer"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={handleToday}
              className="text-blue-600 hover:text-blue-800 transition cursor-pointer"
            >
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(AdminDatePicker);
