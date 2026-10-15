export const COUNTRIES = {
  US: "United States",
  IN: "India",
  CA: "Canada",
  GB: "United Kingdom",
  AU: "Australia",
};

export const COUNTRY_OPTIONS = [
  "United States",
  "India",
  "Canada",
  "United Kingdom",
  "Australia",
];

export const US_STATES = [
  "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut", "Delaware",
  "District of Columbia", "Florida", "Georgia", "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa",
  "Kansas", "Kentucky", "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan", "Minnesota",
  "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire", "New Jersey",
  "New Mexico", "New York", "North Carolina", "North Dakota", "Ohio", "Oklahoma", "Oregon",
  "Pennsylvania", "Rhode Island", "South Carolina", "South Dakota", "Tennessee", "Texas", "Utah",
  "Vermont", "Virginia", "Washington", "West Virginia", "Wisconsin", "Wyoming"
];

export const CA_PROVINCES = [
  "Alberta", "British Columbia", "Manitoba", "New Brunswick", "Newfoundland and Labrador",
  "Northwest Territories", "Nova Scotia", "Nunavut", "Ontario", "Prince Edward Island",
  "Quebec", "Saskatchewan", "Yukon",
];

export const IN_STATES = [
  "Andaman and Nicobar Islands", "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar",
  "Chandigarh", "Chhattisgarh", "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Goa",
  "Gujarat", "Haryana", "Himachal Pradesh", "Jammu and Kashmir", "Jharkhand", "Karnataka",
  "Kerala", "Ladakh", "Lakshadweep", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya",
  "Mizoram", "Nagaland", "Odisha", "Puducherry", "Punjab", "Rajasthan", "Sikkim",
  "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal"
];

export const POSTAL_CODE_PATTERNS = {
  "United States": {
    regex: /^\d{5}(-\d{4})?$/,
    label: "ZIP Code",
    placeholder: "e.g., 75001 or 75001-1234",
    example: "75001",
    error: "Please enter a valid 5-digit US ZIP Code (e.g., 75001 or 75001-1234).",
  },
  US: {
    regex: /^\d{5}(-\d{4})?$/,
    label: "ZIP Code",
    placeholder: "e.g., 75001 or 75001-1234",
    example: "75001",
    error: "Please enter a valid 5-digit US ZIP Code (e.g., 75001 or 75001-1234).",
  },
  India: {
    regex: /^[1-9][0-9]{5}$/,
    label: "PIN Code",
    placeholder: "e.g., 500081 or 110001",
    example: "500081",
    error: "Please enter a valid 6-digit Indian PIN Code (e.g., 500081).",
  },
  IN: {
    regex: /^[1-9][0-9]{5}$/,
    label: "PIN Code",
    placeholder: "e.g., 500081 or 110001",
    example: "500081",
    error: "Please enter a valid 6-digit Indian PIN Code (e.g., 500081).",
  },
  Canada: {
    regex: /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/,
    label: "Postal Code",
    placeholder: "e.g., K1A 0B1",
    example: "K1A 0B1",
    error: "Please enter a valid Canadian Postal Code (e.g., K1A 0B1).",
  },
  CA: {
    regex: /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/,
    label: "Postal Code",
    placeholder: "e.g., K1A 0B1",
    example: "K1A 0B1",
    error: "Please enter a valid Canadian Postal Code (e.g., K1A 0B1).",
  },
  "United Kingdom": {
    regex: /^[A-Za-z]{1,2}\d[A-Za-z\d]? ?\d[A-Za-z]{2}$/,
    label: "Postcode",
    placeholder: "e.g., SW1A 1AA",
    example: "SW1A 1AA",
    error: "Please enter a valid UK Postcode (e.g., SW1A 1AA).",
  },
  GB: {
    regex: /^[A-Za-z]{1,2}\d[A-Za-z\d]? ?\d[A-Za-z]{2}$/,
    label: "Postcode",
    placeholder: "e.g., SW1A 1AA",
    example: "SW1A 1AA",
    error: "Please enter a valid UK Postcode (e.g., SW1A 1AA).",
  },
  Australia: {
    regex: /^\d{4}$/,
    label: "Postal Code",
    placeholder: "e.g., 2000",
    example: "2000",
    error: "Please enter a valid 4-digit Australian Postal Code (e.g., 2000).",
  },
  AU: {
    regex: /^\d{4}$/,
    label: "Postal Code",
    placeholder: "e.g., 2000",
    example: "2000",
    error: "Please enter a valid 4-digit Australian Postal Code (e.g., 2000).",
  },
};

export const getStateList = (country = "") => {
  const c = country ? country.trim() : "";
  if (c === "United States" || c === "US") return US_STATES;
  if (c === "Canada" || c === "CA") return CA_PROVINCES;
  if (c === "India" || c === "IN") return IN_STATES;
  return [];
};

export const getStateLabel = (country = "") => {
  const c = country ? country.trim() : "";
  if (c === "Canada" || c === "CA") return "Province / Territory";
  if (c === "United Kingdom" || c === "GB") return "County / Region";
  if (c === "Australia" || c === "AU") return "State / Territory";
  return "State";
};

export const getZipLabel = (country = "") => {
  const c = country ? country.trim() : "";
  if (c === "United States" || c === "US") return "ZIP Code";
  if (c === "India" || c === "IN") return "PIN Code";
  if (c === "United Kingdom" || c === "GB") return "Postcode";
  return "ZIP / Postal Code";
};

export const getZipPlaceholder = (country = "") => {
  const config = POSTAL_CODE_PATTERNS[country] || POSTAL_CODE_PATTERNS[country?.trim()];
  return config?.placeholder || "e.g., 75001 or 500081";
};

export const isValidPostalCode = (code, country = "") => {
  if (!code || typeof code !== "string") return false;
  const trimmed = code.trim();
  if (!trimmed) return true; // optional if empty

  const config = POSTAL_CODE_PATTERNS[country] || POSTAL_CODE_PATTERNS[country?.trim()];
  if (config) {
    return config.regex.test(trimmed);
  }
  // Generic fallback: 3 to 10 alphanumeric characters (no sentence or random text)
  return /^[a-zA-Z0-9\s-]{3,10}$/.test(trimmed);
};

export const getPostalCodeError = (code, country = "") => {
  if (!code || typeof code !== "string" || !code.trim()) return null;
  const trimmed = code.trim();
  const config = POSTAL_CODE_PATTERNS[country] || POSTAL_CODE_PATTERNS[country?.trim()];
  if (config) {
    if (!config.regex.test(trimmed)) {
      return config.error;
    }
  } else {
    if (!/^[a-zA-Z0-9\s-]{3,10}$/.test(trimmed)) {
      return "Please enter a valid ZIP / Postal Code (3-10 numbers or letters).";
    }
  }
  return null;
};

export const isValidCity = (city) => {
  if (!city || typeof city !== "string") return false;
  const trimmed = city.trim();
  if (!trimmed) return true; // optional if empty
  // Letters (including accented), spaces, hyphens, periods, apostrophes. No numbers.
  const cityRegex = /^[a-zA-Z\u00C0-\u024F\s.'\-]{2,60}$/;
  return cityRegex.test(trimmed) && !/\d/.test(trimmed);
};

export const getCityError = (city) => {
  if (!city || typeof city !== "string" || !city.trim()) return null;
  const trimmed = city.trim();
  if (/\d/.test(trimmed)) {
    return "City name cannot contain numbers. Please enter text only (e.g., Dallas, New York).";
  }
  if (!/^[a-zA-Z\u00C0-\u024F\s.'\-]{2,60}$/.test(trimmed)) {
    return "Please enter a valid city name (letters only, min 2 characters).";
  }
  return null;
};
