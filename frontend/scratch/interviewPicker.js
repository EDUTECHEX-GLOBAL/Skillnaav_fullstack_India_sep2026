const fs = require('fs');

let code = fs.readFileSync('src/WebApp/Flows/PartnerFlow/MainPage/MockInterviewResults.js', 'utf8');

// Add react-datepicker imports if not present
if (!code.includes('react-datepicker')) {
  code = code.replace(
    'import axios from "../../../../api/axiosInstance";',
    'import axios from "../../../../api/axiosInstance";\nimport DatePicker from "react-datepicker";\nimport "react-datepicker/dist/react-datepicker.css";'
  );
}

// Add custom time picker
const customPickers = `
// Custom Time Picker (Width strictly bound to trigger input box)
const RescheduleTimePicker = ({ value, onChange, placeholder = "HH:MM" }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  const [currHour, currMin] = (value || "").split(":");
  const selectedHour = currHour !== undefined && currHour !== "" ? currHour.padStart(2, "0") : "";
  const selectedMin = currMin !== undefined && currMin !== "" ? currMin.padStart(2, "0") : "";

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

  return (
    <div ref={containerRef} className={\`relative w-full \${isOpen ? "z-[80]" : "z-[1]"}\`}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full flex items-center justify-between text-left bg-slate-50 border border-slate-200/80 rounded-2xl px-4 py-3 text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 cursor-pointer"
      >
        <span className="flex items-center gap-2">
          <FontAwesomeIcon icon={faClock} className="text-slate-400" />
          <span className={value ? "text-slate-800" : "text-slate-400"}>{value || placeholder}</span>
        </span>
      </button>

      {isOpen && (
        <div
          className="absolute z-[90] left-0 right-0 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl p-2.5"
          style={{ width: "100%", maxWidth: "100%", boxSizing: "border-box" }}
        >
          <div className="grid grid-cols-2 text-center text-[10px] uppercase font-bold text-slate-400 pb-1 border-b mb-1.5">
            <span>Hour</span>
            <span>Minute</span>
          </div>
          <div className="grid grid-cols-2 gap-1.5 h-40">
            <div className="overflow-y-auto pr-1 space-y-0.5">
              {hours.map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => onChange({ target: { value: \`\${h}:\${selectedMin || '00'}\` } })}
                  className={\`w-full py-1 text-xs text-center rounded \${selectedHour === h ? 'bg-indigo-600 text-white font-bold' : 'text-slate-700 hover:bg-indigo-50'}\`}
                >
                  {h}
                </button>
              ))}
            </div>
            <div className="overflow-y-auto pr-1 space-y-0.5">
              {minutes.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => onChange({ target: { value: \`\${selectedHour || '09'}:\${m}\` } })}
                  className={\`w-full py-1 text-xs text-center rounded \${selectedMin === m ? 'bg-indigo-600 text-white font-bold' : 'text-slate-700 hover:bg-indigo-50'}\`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="w-full mt-2 py-1 text-xs font-bold bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg"
          >
            Done
          </button>
        </div>
      )}
    </div>
  );
};
`;

if (!code.includes('RescheduleTimePicker')) {
  code = code.replace(
    '// Reusable Statistics Card Component',
    customPickers + '\n// Reusable Statistics Card Component'
  );
}

// Replace Date input
code = code.replace(
  /<input\s+type="date"\s+value=\{editFormData\.date\}[\s\S]*?\/>/,
  `<div className="relative w-full">
                  <DatePicker
                    selected={editFormData.date ? new Date(editFormData.date + "T00:00:00") : null}
                    onChange={(date) => {
                      if (!date) {
                        setEditFormData({ ...editFormData, date: "" });
                      } else {
                        const y = date.getFullYear();
                        const m = String(date.getMonth() + 1).padStart(2, "0");
                        const d = String(date.getDate()).padStart(2, "0");
                        setEditFormData({ ...editFormData, date: \`\${y}-\${m}-\${d}\` });
                      }
                    }}
                    dateFormat="dd-MM-yyyy"
                    placeholderText="DD-MM-YYYY"
                    className="w-full bg-slate-50 border border-slate-200/80 rounded-2xl px-4 py-3 text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 cursor-pointer"
                    wrapperClassName="w-full"
                  />
                </div>`
);

// Replace Start Time and End Time inputs
code = code.replace(
  /<input\s+type="time"\s+value=\{editFormData\.startTime\}[\s\S]*?\/>/,
  `<RescheduleTimePicker
                    value={editFormData.startTime}
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        startTime: e.target.value,
                      })
                    }
                  />`
);

code = code.replace(
  /<input\s+type="time"\s+value=\{editFormData\.endTime\}[\s\S]*?\/>/,
  `<RescheduleTimePicker
                    value={editFormData.endTime}
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        endTime: e.target.value,
                      })
                    }
                  />`
);

fs.writeFileSync('src/WebApp/Flows/PartnerFlow/MainPage/MockInterviewResults.js', code, 'utf8');
console.log('MockInterviewResults.js updated successfully');
