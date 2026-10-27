/**
 * Safe calendar date utilities that avoid timezone shifts (e.g. UTC off-by-one errors).
 * Calendar dates (like interview dates or schedule dates) should represent the same 
 * Day, Month, Year regardless of the user's browser timezone.
 */

// Formats a date value to "YYYY-MM-DD" for HTML date inputs or component state
export const toCalendarDateInput = (val) => {
  if (!val) return "";
  if (typeof val === "string") {
    const match = val.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return `${match[1]}-${match[2]}-${match[3]}`;
    }
  }
  const d = new Date(val);
  if (isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

// Formats a date value for human-friendly display (e.g. "Oct 6, 2026")
export const formatCalendarDate = (val, options = { month: "short", day: "numeric", year: "numeric" }) => {
  if (!val) return "";
  if (typeof val === "string") {
    const match = val.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      const year = parseInt(match[1], 10);
      const monthIndex = parseInt(match[2], 10) - 1;
      const day = parseInt(match[3], 10);
      const monthsShort = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const monthsLong = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
      ];
      if (monthIndex >= 0 && monthIndex < 12) {
        const monthName = options?.month === "long" ? monthsLong[monthIndex] : monthsShort[monthIndex];
        if (options?.year === false) {
          return `${monthName} ${day}`;
        }
        return `${monthName} ${day}, ${year}`;
      }
    }
  }
  const d = new Date(val);
  if (isNaN(d.getTime())) return String(val);
  const monthsShort = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthsLong = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const monthName = options?.month === "long" ? monthsLong[d.getMonth()] : monthsShort[d.getMonth()];
  if (options?.year === false) {
    return `${monthName} ${d.getDate()}`;
  }
  return `${monthName} ${d.getDate()}, ${d.getFullYear()}`;
};

// Parses a "YYYY-MM-DD" string into a local Date object set to noon (12:00:00)
// Setting to noon prevents any daylight savings or midnight timezone conversions from shifting the date
export const parseCalendarDateNoon = (val) => {
  if (!val) return null;
  const str = String(val);
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const year = parseInt(match[1], 10);
    const monthIndex = parseInt(match[2], 10) - 1;
    const day = parseInt(match[3], 10);
    return new Date(year, monthIndex, day, 12, 0, 0);
  }
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
};
