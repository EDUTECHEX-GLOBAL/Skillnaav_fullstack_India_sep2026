import { useEffect, useRef, useState } from "react";

// New component - 07-09-2026
export const StateDropdown = ({
  value,
  onChange,
  options,
  label,
  className,
  disabled,
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const close = (e) =>
      ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <div className="flex flex-col gap-1 relative" ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={`${className} text-left flex justify-between items-center ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        <span className={value ? "text-gray-900" : "text-gray-400"}>
          {value || `Select ${label}`}
        </span>
        <span className="text-gray-400">▾</span>
      </button>
      {open && !disabled && (
        <ul className="absolute z-[20] left-0 top-full mt-1 w-full max-w-[280px] max-h-56 overflow-y-auto bg-white border border-gray-300 rounded-lg shadow-lg">
          {options.map((s) => (
            <li
              key={s}
              onClick={() => {
                onChange(s);
                setOpen(false);
              }}
              className="px-4 py-2 cursor-pointer hover:bg-teal-50 hover:text-teal-700 truncate"
              title={s}
            >
              {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
