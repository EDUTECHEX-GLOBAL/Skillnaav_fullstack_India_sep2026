const fs = require('fs');

const customComponents = `
// ─── CustomTimePicker ────────────────────────────────────────────────────────
// Dropdown popup strictly matches the width of the input ("down box = top box")
const CustomTimePicker = ({
  value,
  onChange,
  name,
  disabled = false,
  required = false,
  className = "",
  placeholder = "HH:MM",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  const [currHour, currMin] = (value || "").split(":");
  const selectedHour =
    currHour !== undefined && currHour !== "" ? currHour.padStart(2, "0") : "";
  const selectedMin =
    currMin !== undefined && currMin !== "" ? currMin.padStart(2, "0") : "";

  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
  const minutes = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
      document.addEventListener("touchstart", handleOutsideClick);
    }
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("touchstart", handleOutsideClick);
    };
  }, [isOpen]);

  const setHour = (h) => {
    const m = selectedMin || "00";
    onChange({ target: { name, value: \`\${h}:\${m}\` } });
  };

  const setMinute = (m) => {
    const h = selectedHour || "09";
    onChange({ target: { name, value: \`\${h}:\${m}\` } });
  };

  return (
    <div
      ref={containerRef}
      className={\`relative w-full \${isOpen ? "z-[80]" : "z-[1]"}\`}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        className={\`w-full flex items-center justify-between text-left transition-all \${className} \${
          isOpen
            ? "ring-2 ring-indigo-500 border-indigo-500"
            : "hover:border-gray-400"
        } \${
          disabled
            ? "opacity-60 cursor-not-allowed bg-gray-50 text-gray-400"
            : "cursor-pointer bg-white text-gray-900"
        }\`}
      >
        <span className="flex items-center gap-2">
          <FiClock className="text-gray-400 flex-shrink-0" />
          <span
            className={
              value ? "text-gray-900 font-medium" : "text-gray-400 font-normal"
            }
          >
            {value || placeholder}
          </span>
        </span>
        <FiClock className="text-gray-400 text-sm flex-shrink-0" />
      </button>

      {/* Down Box (Dropdown Menu) - strictly w-full left-0 right-0 */}
      {isOpen && (
        <div
          className="absolute z-[90] left-0 right-0 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-2xl p-2.5"
          style={{ width: "100%", maxWidth: "100%", boxSizing: "border-box" }}
        >
          <div className="grid grid-cols-2 text-center text-[11px] uppercase tracking-wider font-semibold text-gray-400 pb-1.5 border-b mb-1.5">
            <span>Hour</span>
            <span>Minute</span>
          </div>
          <div className="grid grid-cols-2 gap-1.5 h-44">
            {/* Hours */}
            <div className="overflow-y-auto pr-1 space-y-0.5">
              {hours.map((h) => {
                const isSelected = selectedHour === h;
                return (
                  <button
                    key={h}
                    type="button"
                    onClick={() => setHour(h)}
                    className={\`w-full py-1 text-xs text-center rounded transition-colors \${
                      isSelected
                        ? "bg-indigo-600 text-white font-semibold shadow-sm"
                        : "text-gray-700 hover:bg-indigo-50"
                    }\`}
                  >
                    {h}
                  </button>
                );
              })}
            </div>
            {/* Minutes */}
            <div className="overflow-y-auto pr-1 space-y-0.5">
              {minutes.map((m) => {
                const isSelected = selectedMin === m;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMinute(m)}
                    className={\`w-full py-1 text-xs text-center rounded transition-colors \${
                      isSelected
                        ? "bg-indigo-600 text-white font-semibold shadow-sm"
                        : "text-gray-700 hover:bg-indigo-50"
                    }\`}
                  >
                    {m}
                  </button>
                );
              })}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="w-full mt-2 py-1.5 text-xs font-semibold bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors"
          >
            Done
          </button>
        </div>
      )}
    </div>
  );
};

// ─── CustomDatePicker ────────────────────────────────────────────────────────
const CustomDatePicker = ({
  value,
  onChange,
  name,
  disabled = false,
  minDate,
  maxDate,
  className = "",
  placeholder = "DD-MM-YYYY",
}) => {
  const parsedDate = value ? new Date(String(value).slice(0, 10) + "T00:00:00") : null;

  return (
    <div className="relative w-full">
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 z-10">
        <FiCalendar />
      </div>
      <DatePicker
        selected={parsedDate}
        onChange={(date) => {
          if (!date) {
            onChange({ target: { name, value: "" } });
          } else {
            const y = date.getFullYear();
            const m = String(date.getMonth() + 1).padStart(2, "0");
            const d = String(date.getDate()).padStart(2, "0");
            onChange({ target: { name, value: \`\${y}-\${m}-\${d}\` } });
          }
        }}
        disabled={disabled}
        minDate={minDate}
        maxDate={maxDate}
        dateFormat="dd-MM-yyyy"
        placeholderText={placeholder}
        className={\`block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm cursor-pointer \${className}\`}
        wrapperClassName="w-full"
      />
    </div>
  );
};
`;

// 1. Update ScheduleForm.js remaining items
let formCode = fs.readFileSync('src/WebApp/Flows/PartnerFlow/MainPage/ScheduleForm.js', 'utf8');

// Mock interview date input
formCode = formCode.replace(
  /<input\s+type="date"\s+value=\{dateInputValue\}\s+readOnly=\{readOnly\}\s+onChange=\{[\s\S]*?\}\s+className="[^"]*"\s*\/>/,
  `<CustomDatePicker
                                    value={dateInputValue}
                                    disabled={readOnly}
                                    onChange={(e) => {
                                       const updated = [...mockInterviews];
                                       updated[idx].date = e.target.value;
                                       setMockInterviews(updated);
                                    }}
                                  />`
);

// Add Day date input
formCode = formCode.replace(
  /<div className="relative">\s*<div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">\s*<FiCalendar size=\{16\} \/>\s*<\/div>\s*<input\s+type="date"\s+name="newDate"\s+value=\{form\.newDate\}\s+onChange=\{handleFormChange\}[\s\S]*?\/>\s*<\/div>/,
  `<CustomDatePicker name="newDate" value={form.newDate} onChange={handleFormChange} />`
);

fs.writeFileSync('src/WebApp/Flows/PartnerFlow/MainPage/ScheduleForm.js', formCode, 'utf8');
console.log('ScheduleForm.js updated successfully');

// 2. Update ScheduleFormPaid.js
let paidCode = fs.readFileSync('src/WebApp/Flows/PartnerFlow/MainPage/ScheduleFormPaid.js', 'utf8');

// Imports
if (!paidCode.includes('react-datepicker')) {
  paidCode = paidCode.replace(
    `import CreateMeetingLink from './CreateMeetingLink';`,
    `import CreateMeetingLink from './CreateMeetingLink';\nimport DatePicker from "react-datepicker";\nimport "react-datepicker/dist/react-datepicker.css";`
  );
}

// Add components after normalizeInternshipMode
paidCode = paidCode.replace(
  `const normalizeInternshipMode = (mode = '') => {\n  const value = String(mode).trim().toLowerCase();\n  return ['online', 'offline', 'hybrid'].includes(value) ? value : 'online';\n};`,
  `const normalizeInternshipMode = (mode = '') => {\n  const value = String(mode).trim().toLowerCase();\n  return ['online', 'offline', 'hybrid'].includes(value) ? value : 'online';\n};\n${customComponents}`
);

// Date Range
paidCode = paidCode.replace(
  /<div className="grid grid-cols-1 md:grid-cols-2 gap-5">\s*<div>\s*<label className="block text-sm font-medium text-gray-700 mb-1">\s*Start Date\s*<\/label>\s*<div className="relative">\s*<div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">\s*<FiCalendar \/>\s*<\/div>\s*<input\s+type="date"\s+name="startDate"\s+value=\{form\.startDate\}\s+onChange=\{handleFormChange\}[\s\S]*?required\s*\/>\s*<\/div>\s*<\/div>\s*<div>\s*<label className="block text-sm font-medium text-gray-700 mb-1">\s*End Date\s*<\/label>\s*<div className="relative">\s*<div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">\s*<FiCalendar \/>\s*<\/div>\s*<input\s+type="date"\s+name="endDate"\s+value=\{form\.endDate\}\s+onChange=\{handleFormChange\}[\s\S]*?required\s*\/>\s*<\/div>\s*<\/div>\s*<\/div>/,
  `<div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Start Date
                    </label>
                    <CustomDatePicker
                      name="startDate"
                      value={form.startDate}
                      onChange={handleFormChange}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      End Date
                    </label>
                    <CustomDatePicker
                      name="endDate"
                      value={form.endDate}
                      onChange={handleFormChange}
                      required
                    />
                  </div>
                </div>`
);

// Work Hours
paidCode = paidCode.replace(
  /<div className="flex items-center gap-4">\s*<input\s+type="time"\s+name="workHoursStart"[\s\S]*?\/>\s*<span className="text-gray-500 font-medium">to<\/span>\s*<input\s+type="time"\s+name="workHoursEnd"[\s\S]*?\/>\s*<\/div>/,
  `<div className="flex flex-col sm:flex-row items-center gap-3">
                  <div className="w-full">
                    <CustomTimePicker
                      name="workHoursStart"
                      value={form.workHoursStart}
                      onChange={handleFormChange}
                      required
                    />
                  </div>
                  <span className="text-gray-500 font-medium">to</span>
                  <div className="w-full">
                    <CustomTimePicker
                      name="workHoursEnd"
                      value={form.workHoursEnd}
                      onChange={handleFormChange}
                      required
                    />
                  </div>
                </div>`
);

// Online slots
paidCode = paidCode.replace(
  /<input\s+type="time"\s+value=\{slot\.startTime\}\s+onChange=\{\(e\) => updateSlot\('online', i, 'startTime', e\.target\.value\)\}[\s\S]*?\/>/,
  `<CustomTimePicker
                                      value={slot.startTime}
                                      onChange={(e) => updateSlot('online', i, 'startTime', e.target.value)}
                                    />`
);
paidCode = paidCode.replace(
  /<input\s+type="time"\s+value=\{slot\.endTime\}\s+min=\{slot\.startTime \|\| undefined\}\s+onChange=\{\(e\) => updateSlot\('online', i, 'endTime', e\.target\.value\)\}[\s\S]*?\/>/,
  `<CustomTimePicker
                                      value={slot.endTime}
                                      onChange={(e) => updateSlot('online', i, 'endTime', e.target.value)}
                                    />`
);

// Offline slots
paidCode = paidCode.replace(
  /<input\s+type="time"\s+value=\{slot\.startTime\}\s+onChange=\{\(e\) => updateSlot\('offline', i, 'startTime', e\.target\.value\)\}[\s\S]*?\/>/,
  `<CustomTimePicker
                                      value={slot.startTime}
                                      onChange={(e) => updateSlot('offline', i, 'startTime', e.target.value)}
                                    />`
);
paidCode = paidCode.replace(
  /<input\s+type="time"\s+value=\{slot\.endTime\}\s+min=\{slot\.startTime \|\| undefined\}\s+onChange=\{\(e\) => updateSlot\('offline', i, 'endTime', e\.target\.value\)\}[\s\S]*?\/>/,
  `<CustomTimePicker
                                      value={slot.endTime}
                                      onChange={(e) => updateSlot('offline', i, 'endTime', e.target.value)}
                                    />`
);

// Hybrid slots
paidCode = paidCode.replace(
  /<input\s+type="time"\s+value=\{slot\.startTime\}\s+onChange=\{\(e\) => updateSlot\('hybrid', i, 'startTime', e\.target\.value\)\}[\s\S]*?\/>/,
  `<CustomTimePicker
                                      value={slot.startTime}
                                      onChange={(e) => updateSlot('hybrid', i, 'startTime', e.target.value)}
                                    />`
);
paidCode = paidCode.replace(
  /<input\s+type="time"\s+value=\{slot\.endTime\}\s+min=\{slot\.startTime \|\| undefined\}\s+onChange=\{\(e\) => updateSlot\('hybrid', i, 'endTime', e\.target\.value\)\}[\s\S]*?\/>/,
  `<CustomTimePicker
                                      value={slot.endTime}
                                      onChange={(e) => updateSlot('hybrid', i, 'endTime', e.target.value)}
                                    />`
);

// Mock interviews date input in ScheduleFormPaid.js
paidCode = paidCode.replace(
  /<input\s+type="date"\s+value=\{dateInputValue\}\s+readOnly=\{readOnly\}\s+onChange=\{[\s\S]*?\}\s+className="[^"]*"\s*\/>/,
  `<CustomDatePicker
                                    value={dateInputValue}
                                    disabled={readOnly}
                                    onChange={(e) => {
                                       const updated = [...mockInterviews];
                                       updated[idx].date = e.target.value;
                                       setMockInterviews(updated);
                                    }}
                                  />`
);

// Add Day date input in ScheduleFormPaid.js
paidCode = paidCode.replace(
  /<div className="relative">\s*<div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">\s*<FiCalendar size=\{16\} \/>\s*<\/div>\s*<input\s+type="date"\s+name="newDate"\s+value=\{form\.newDate\}\s+onChange=\{handleFormChange\}[\s\S]*?\/>\s*<\/div>/,
  `<CustomDatePicker name="newDate" value={form.newDate} onChange={handleFormChange} />`
);

fs.writeFileSync('src/WebApp/Flows/PartnerFlow/MainPage/ScheduleFormPaid.js', paidCode, 'utf8');
console.log('ScheduleFormPaid.js updated successfully');
