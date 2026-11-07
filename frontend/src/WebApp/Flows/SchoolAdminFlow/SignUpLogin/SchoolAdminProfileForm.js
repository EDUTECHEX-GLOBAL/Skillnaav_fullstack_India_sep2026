import React, { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import axios from "../../../../api/axiosInstance";

const SCHOOL_TYPE_OPTIONS = [
  { value: "", label: "Select School Type" },
  { value: "Private", label: "Private" },
  { value: "Public", label: "Public / Government" },
  { value: "Charter", label: "Charter / Autonomous" },
  { value: "Catholic", label: "Missionary / Minority" },
];

const COUNTRY_OPTIONS = [
  { value: "", label: "Select Country" },
  { value: "India", label: "India" },
];

const LANGUAGE_OPTIONS = [
  { value: "", label: "Select Language" },
  { value: "English", label: "English" },
  { value: "Hindi", label: "Hindi" },
  { value: "Bilingual", label: "Bilingual / Regional" },
];

const SchoolAdminDropdown = ({
  name,
  value,
  onChange,
  options = [],
  placeholder = "Select...",
  required = false,
  className = "",
  id,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const normalizedOptions = options.map((opt) =>
    typeof opt === "object" && opt !== null
      ? opt
      : { value: opt, label: opt }
  );

  const selectedOpt = normalizedOptions.find(
    (opt) => String(opt.value) === String(value ?? "")
  );
  const displayLabel = selectedOpt && selectedOpt.label ? selectedOpt.label : placeholder;

  const handleSelect = (val) => {
    if (typeof onChange === "function") {
      onChange({
        target: {
          name,
          value: val,
        },
      });
    }
    setIsOpen(false);
  };

  return (
    <div className="relative w-full min-w-0" ref={dropdownRef}>
      <input
        type="hidden"
        name={name}
        id={id}
        value={value ?? ""}
        required={required}
      />
      <button
        type="button"
        id={id ? `${id}-btn` : undefined}
        onClick={() => setIsOpen((prev) => !prev)}
        className={`w-full min-w-0 max-w-full p-3 text-left bg-white border border-gray-300 rounded-md shadow-sm flex items-center justify-between gap-2 transition-all cursor-pointer box-border ${
          isOpen ? "border-blue-500 ring-2 ring-blue-100" : "hover:border-gray-400"
        } ${className}`}
      >
        <span
          className={`truncate text-sm block min-w-0 flex-1 ${
            !selectedOpt || !selectedOpt.value ? "text-gray-400" : "text-gray-800"
          }`}
          title={displayLabel}
        >
          {displayLabel}
        </span>
        <svg
          className={`w-4 h-4 text-gray-500 transition-transform duration-200 flex-shrink-0 ${
            isOpen ? "rotate-180" : ""
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1 w-full max-w-full bg-white border border-gray-200 rounded-md shadow-lg z-50 max-h-56 overflow-y-auto overflow-x-hidden py-1 box-border">
          {normalizedOptions.map((opt, idx) => {
            const isSelected = String(opt.value) === String(value ?? "");
            return (
              <button
                key={opt.value ?? idx}
                type="button"
                title={opt.label}
                onClick={() => handleSelect(opt.value)}
                className={`w-full min-w-0 max-w-full text-left px-3 py-2 text-sm transition-colors cursor-pointer truncate block box-border ${
                  isSelected
                    ? "bg-blue-50 text-blue-700 font-medium"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

const SchoolAdminProfileForm = () => {
  const location = useLocation();
  const initialRegisterData = location.state || {};
  const navigate = useNavigate();

  const [statusModal, setStatusModal] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    schoolName: initialRegisterData.schoolName || "",
    schoolType: "",
    schoolNumber: "",
    address: "",
    affiliation: "",
    city: "",
    province: "",
    postalCode: "",
    country: "",
    website: "",
    contactPerson: "",
    contactEmail: "",
    contactPhone: "",
    languageOfInstruction: "",
    verificationDoc: null,
  });

  const handleChange = (e) => {
    const { name, value, files } = e.target;
    if (name === "verificationDoc") {
      setFormData({ ...formData, [name]: files[0] });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const formPayload = new FormData();
    Object.keys(initialRegisterData).forEach((key) => {
      if (initialRegisterData[key] !== undefined && initialRegisterData[key] !== null) {
        formPayload.set(key, initialRegisterData[key]);
      }
    });

    Object.keys(formData).forEach((key) => {
      if (formData[key] !== undefined && formData[key] !== null) {
        formPayload.set(key, formData[key]);
      }
    });

    try {
      setSubmitting(true);
      if (initialRegisterData.isGoogleUser) {
        const token = localStorage.getItem("schoolAdminToken");
        const { data } = await axios.put("/api/school-admin/update-profile", formPayload, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
        });
        
        if (!data.admin.isApproved) {
          setStatusModal({
            isOpen: true,
            type: "success",
            title: "Profile Completed!",
            message: "Profile completed successfully! Your account is pending administrator approval.",
            onAction: () => {
              localStorage.removeItem("schoolAdminToken");
              localStorage.removeItem("schoolAdminInfo");
              localStorage.removeItem("userInfo");
              navigate("/schooladmin/login");
            },
          });
        } else {
          setStatusModal({
            isOpen: true,
            type: "success",
            title: "Profile Completed!",
            message: "Profile completed successfully!",
            onAction: () => {
              navigate("/schooladmin/dashboard");
            },
          });
        }
      } else {
        await axios.post("/api/school-admin/register", formPayload, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        });
        setStatusModal({
          isOpen: true,
          type: "success",
          title: "Registration Successful!",
          message: "Registration submitted successfully!",
          onAction: () => {
            navigate("/schooladmin/login");
          },
        });
      }
    } catch (error) {
      const message = error.response?.data?.message || "Registration failed. Please check your information and try again.";
      console.error("Error submitting profile:", error);
      setStatusModal({
        isOpen: true,
        type: "error",
        title: "Registration Failed",
        message: message,
        onAction: () => {},
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4 font-poppins">
      <form
        onSubmit={handleSubmit}
        className="bg-white shadow-xl rounded-xl w-full max-w-4xl p-8"
      >
        <h2 className="text-3xl font-bold text-blue-700 mb-8 text-center">
          School Profile Details (India)
        </h2>

        {/* Institution Details */}
        <div>
          <h3 className="text-lg font-semibold text-gray-700 mb-4">Institution Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">School Name</label>
              <input
                type="text"
                name="schoolName"
                placeholder="School Name"
                value={formData.schoolName}
                onChange={handleChange}
                className="w-full p-3 border border-gray-300 rounded-md"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">School Type</label>
              <SchoolAdminDropdown
                name="schoolType"
                value={formData.schoolType}
                onChange={handleChange}
                options={SCHOOL_TYPE_OPTIONS}
                placeholder="Select School Type"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">School Number</label>
              <input
                type="text"
                name="schoolNumber"
                placeholder="School Number (if applicable)"
                value={formData.schoolNumber}
                onChange={handleChange}
                className="w-full p-3 border border-gray-300 rounded-md"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Affiliation</label>
              <input
                type="text"
                name="affiliation"
                placeholder="Affiliation (e.g., CBSE, ICSE, State Board, AICTE)"
                value={formData.affiliation}
                onChange={handleChange}
                className="w-full p-3 border border-gray-300 rounded-md"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
              <input
                type="text"
                name="city"
                placeholder="City"
                value={formData.city}
                onChange={handleChange}
                className="w-full p-3 border border-gray-300 rounded-md"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">State / Union Territory</label>
              <input
                type="text"
                name="province"
                placeholder="State (e.g., Maharashtra, Karnataka, Delhi)"
                value={formData.province}
                onChange={handleChange}
                className="w-full p-3 border border-gray-300 rounded-md"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">PIN / Postal Code</label>
              <input
                type="text"
                name="postalCode"
                placeholder="PIN Code (e.g., 500081 or 110001)"
                value={formData.postalCode}
                onChange={handleChange}
                pattern="^[1-9][0-9]{5}$|^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$|^\d{5}(-\d{4})?$"
                title="Format: 6-digit PIN code (e.g., 500081)"
                className="w-full p-3 border border-gray-300 rounded-md"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
              <SchoolAdminDropdown
                name="country"
                value={formData.country}
                onChange={handleChange}
                options={COUNTRY_OPTIONS}
                placeholder="Select Country"
                required
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Website (optional)</label>
              <input
                type="url"
                name="website"
                placeholder="Website (optional)"
                value={formData.website}
                onChange={handleChange}
                className="w-full p-3 border border-gray-300 rounded-md"
              />
            </div>
          </div>
        </div>

        {/* Full Address */}
        <div className="mt-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Full Address</h3>
          <textarea
            name="address"
            placeholder="Street, Area, Landmark"
            value={formData.address}
            onChange={handleChange}
            className="w-full p-3 border border-gray-300 rounded-md"
            rows={3}
            required
          />
        </div>

        {/* Language of Instruction */}
        <div className="mt-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Language of Instruction</h3>
          <div className="w-full md:w-1/2">
            <SchoolAdminDropdown
              name="languageOfInstruction"
              value={formData.languageOfInstruction}
              onChange={handleChange}
              options={LANGUAGE_OPTIONS}
              placeholder="Select Language"
              required
            />
          </div>
        </div>

        {/* Contact Info */}
        <div className="mt-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">Contact Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contact Person</label>
              <input
                type="text"
                name="contactPerson"
                placeholder="Contact Person Name"
                value={formData.contactPerson}
                onChange={handleChange}
                className="w-full p-3 border border-gray-300 rounded-md"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contact Email</label>
              <input
                type="email"
                name="contactEmail"
                placeholder="Contact Email"
                value={formData.contactEmail}
                onChange={handleChange}
                className="w-full p-3 border border-gray-300 rounded-md"
                required
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Contact Phone</label>
              <input
                type="tel"
                name="contactPhone"
                placeholder="Contact Phone"
                value={formData.contactPhone}
                onChange={(e) => {
                  const numericOnly = e.target.value.replace(/\D/g, "");
                  setFormData({ ...formData, contactPhone: numericOnly });
                }}
                inputMode="numeric"
                pattern="[0-9]*"
                title="Please enter numbers only"
                className="w-full p-3 border border-gray-300 rounded-md"
                required
              />
            </div>
          </div>
        </div>

        {/* Upload Verification Doc */}
        <div className="mt-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-2">
            Upload Verification Document (optional)
          </h3>
          <input
            type="file"
            name="verificationDoc"
            onChange={handleChange}
            className="p-2 border border-gray-300 rounded-md w-full"
          />
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting}
          className="mt-8 w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-3 text-lg rounded-md font-semibold transition cursor-pointer flex items-center justify-center gap-2"
        >
          {submitting ? "Submitting Profile..." : "Submit Profile"}
        </button>
      </form>

      {/* Centered Stylish Status Modal */}
      {statusModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 font-poppins">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center transform transition-all border border-gray-100 relative">
            {statusModal.type === "success" ? (
              <div className="w-16 h-16 mx-auto mb-4 bg-green-100 text-green-600 rounded-full flex items-center justify-center shadow-inner">
                <svg
                  className="w-8 h-8"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            ) : (
              <div className="w-16 h-16 mx-auto mb-4 bg-red-100 text-red-600 rounded-full flex items-center justify-center shadow-inner">
                <svg
                  className="w-8 h-8"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
            )}

            <h3 className="text-xl font-bold text-gray-800 mb-2">
              {statusModal.title}
            </h3>
            <p className="text-gray-600 text-sm mb-6 leading-relaxed">
              {statusModal.message}
            </p>

            <button
              type="button"
              onClick={() => {
                const action = statusModal.onAction;
                setStatusModal(null);
                if (action) action();
              }}
              className={`w-full py-3 px-6 text-white font-semibold rounded-xl shadow-md transition cursor-pointer ${
                statusModal.type === "success"
                  ? "bg-blue-600 hover:bg-blue-700 shadow-blue-200"
                  : "bg-red-600 hover:bg-red-700 shadow-red-200"
              }`}
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SchoolAdminProfileForm;
