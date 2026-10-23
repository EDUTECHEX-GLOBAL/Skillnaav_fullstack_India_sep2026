const fs = require('fs');

const customComponents = `
// ─── CustomTimePicker ────────────────────────────────────────────────────────
// Top box: stylish bordered input box with clock icon
// Down box: dropdown popup strictly matching the width of top box
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
      {/* Top Box: Clean bordered input field */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        className={\`w-full flex items-center justify-between text-left px-3 py-2 border border-gray-300 rounded-lg bg-white shadow-sm text-sm transition-all \${className} \${
          isOpen
            ? "ring-2 ring-indigo-500 border-indigo-500 shadow-sm"
            : "hover:border-gray-400"
        } \${
          disabled
            ? "opacity-60 cursor-not-allowed bg-gray-50 text-gray-400"
            : "cursor-pointer text-gray-900"
        }\`}
      >
        <span className="flex items-center gap-2.5">
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

// 1. Update ScheduleForm.js
let formFile = 'src/WebApp/Flows/PartnerFlow/MainPage/ScheduleForm.js';
let formCode = fs.readFileSync(formFile, 'utf8');

// Replace the CustomTimePicker and CustomDatePicker block in ScheduleForm.js
const formStartMarker = '// ─── CustomTimePicker ────────────────────────────────────────────────────────';
const formEndMarker = 'const ScheduleForm = ({';

const startIndex = formCode.indexOf(formStartMarker);
const endIndex = formCode.indexOf(formEndMarker);

if (startIndex !== -1 && endIndex !== -1) {
  formCode = formCode.slice(0, startIndex) + customComponents.trim() + '\n\n' + formCode.slice(endIndex);
  fs.writeFileSync(formFile, formCode, 'utf8');
  console.log('ScheduleForm.js custom components updated with boxed styling');
} else {
  console.error('Could not find markers in ScheduleForm.js');
}

// 2. Update ScheduleFormPaid.js
let paidFile = 'src/WebApp/Flows/PartnerFlow/MainPage/ScheduleFormPaid.js';
let paidCode = fs.readFileSync(paidFile, 'utf8');

// Ensure DatePicker import is in ScheduleFormPaid.js
if (!paidCode.includes('import DatePicker')) {
  paidCode = paidCode.replace(
    /import CreateMeetingLink from '\.\/CreateMeetingLink';/,
    "import CreateMeetingLink from './CreateMeetingLink';\nimport DatePicker from 'react-datepicker';\nimport 'react-datepicker/dist/react-datepicker.css';"
  );
}

// Insert customComponents right above const ScheduleFormPaid
if (!paidCode.includes('const CustomTimePicker')) {
  paidCode = paidCode.replace(
    'const ScheduleFormPaid = ({',
    customComponents.trim() + '\n\nconst ScheduleFormPaid = ({'
  );
  fs.writeFileSync(paidFile, paidCode, 'utf8');
  console.log('ScheduleFormPaid.js custom components inserted with boxed styling');
} else {
  // If already present, replace it
  const paidStartIndex = paidCode.indexOf(formStartMarker);
  const paidEndIndex = paidCode.indexOf('const ScheduleFormPaid = ({');
  if (paidStartIndex !== -1 && paidEndIndex !== -1) {
    paidCode = paidCode.slice(0, paidStartIndex) + customComponents.trim() + '\n\n' + paidCode.slice(paidEndIndex);
    fs.writeFileSync(paidFile, paidCode, 'utf8');
    console.log('ScheduleFormPaid.js custom components updated with boxed styling');
  }
}
