// StipendDetailsModal.jsx
import React, { useState } from "react";

const StipendDetailsModal = ({ visible, onClose, onSubmit }) => {
  const [form, setForm] = useState({
    bankAccountName: "",
    bankAccountNumber: "",
    ifscOrSwift: "",
    preferredCurrency: "INR",
    notes: ""
  });

  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  const validateField = (name, value, currency = form.preferredCurrency) => {
    let error = "";
    const trimmed = (value || "").trim();

    switch (name) {
      case "bankAccountName":
        if (!trimmed) {
          error = "Account holder name is required";
        } else if (trimmed.length < 2) {
          error = "Name must be at least 2 characters";
        } else if (!/^[a-zA-Z\s.'-]+$/.test(trimmed)) {
          error = "Name must contain only letters and spaces";
        } else if (trimmed.length > 60) {
          error = "Name cannot exceed 60 characters";
        }
        break;

      case "bankAccountNumber":
        if (!trimmed) {
          error = "Bank account number is required";
        } else if (!/^\d+$/.test(trimmed)) {
          error = "Account number must contain digits only";
        } else if (trimmed.length < 8 || trimmed.length > 18) {
          error = "Account number must be between 8 and 18 digits";
        }
        break;

      case "ifscOrSwift":
        if (!trimmed) {
          error = "IFSC/SWIFT code is required";
        } else {
          const upper = trimmed.toUpperCase();
          if (currency === "INR") {
            // Standard Indian IFSC: 4 letters, 0, 6 alphanumeric
            if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(upper)) {
              error = "Invalid IFSC format (e.g. SBIN0001234 - 11 chars)";
            }
          } else {
            // SWIFT / BIC code: 8 or 11 alphanumeric characters
            if (!/^[A-Z0-9]{8,11}$/.test(upper)) {
              error = "Must be a valid 8 or 11 character SWIFT/IFSC code";
            }
          }
        }
        break;

      default:
        break;
    }

    return error;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    let sanitizedValue = value;

    if (name === "bankAccountNumber") {
      // Allow only digits and limit to 18 digits max
      sanitizedValue = value.replace(/[^0-9]/g, "").slice(0, 18);
    } else if (name === "ifscOrSwift") {
      // Auto uppercase, alphanumeric only, limit to 11 chars max
      sanitizedValue = value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 11);
    } else if (name === "bankAccountName") {
      sanitizedValue = value.slice(0, 60);
    }

    setForm((prev) => ({ ...prev, [name]: sanitizedValue }));

    // Revalidate if field has been touched
    if (touched[name]) {
      const error = validateField(name, sanitizedValue);
      setErrors((prev) => ({ ...prev, [name]: error }));
    }
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));
    const error = validateField(name, value);
    setErrors((prev) => ({ ...prev, [name]: error }));
  };

  const handleCurrencyChange = (e) => {
    const newCurrency = e.target.value;
    setForm((prev) => ({ ...prev, preferredCurrency: newCurrency }));
    if (touched.ifscOrSwift || form.ifscOrSwift) {
      const error = validateField("ifscOrSwift", form.ifscOrSwift, newCurrency);
      setErrors((prev) => ({ ...prev, ifscOrSwift: error }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // Mark all as touched
    const allTouched = {
      bankAccountName: true,
      bankAccountNumber: true,
      ifscOrSwift: true,
    };
    setTouched(allTouched);

    const nameErr = validateField("bankAccountName", form.bankAccountName);
    const accErr = validateField("bankAccountNumber", form.bankAccountNumber);
    const ifscErr = validateField("ifscOrSwift", form.ifscOrSwift);

    const newErrors = {
      bankAccountName: nameErr,
      bankAccountNumber: accErr,
      ifscOrSwift: ifscErr,
    };
    setErrors(newErrors);

    if (nameErr || accErr || ifscErr) {
      return;
    }

    onSubmit({
      ...form,
      bankAccountName: form.bankAccountName.trim(),
      bankAccountNumber: form.bankAccountNumber.trim(),
      ifscOrSwift: form.ifscOrSwift.trim().toUpperCase(),
    });
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white p-6 rounded-2xl shadow-2xl max-w-md w-full relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-2xl font-light w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition"
          aria-label="Close"
        >
          &times;
        </button>
        <h2 className="text-xl font-bold text-gray-800 mb-1">
          Enter Stipend Payment Details
        </h2>
        <p className="text-xs text-gray-500 mb-4">
          Please provide accurate bank account details to receive your stipend.
        </p>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* Account Holder Name */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Account Holder Name <span className="text-red-500">*</span>
            </label>
            <input
              name="bankAccountName"
              type="text"
              placeholder="e.g. John Doe"
              maxLength={60}
              className={`w-full px-3 py-2 text-sm border rounded-lg outline-none transition ${
                errors.bankAccountName
                  ? "border-red-400 bg-red-50/30 focus:ring-2 focus:ring-red-200"
                  : "border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              }`}
              value={form.bankAccountName}
              onChange={handleChange}
              onBlur={handleBlur}
            />
            {errors.bankAccountName && (
              <p className="text-red-500 text-xs mt-1 flex items-center gap-1 font-medium">
                <span>⚠️</span> {errors.bankAccountName}
              </p>
            )}
          </div>

          {/* Bank Account Number */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Bank Account Number <span className="text-red-500">*</span>
            </label>
            <input
              name="bankAccountNumber"
              type="text"
              inputMode="numeric"
              placeholder="8 to 18 digits (e.g. 123456789012)"
              maxLength={18}
              className={`w-full px-3 py-2 text-sm border rounded-lg outline-none transition font-mono tracking-wide ${
                errors.bankAccountNumber
                  ? "border-red-400 bg-red-50/30 focus:ring-2 focus:ring-red-200"
                  : "border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              }`}
              value={form.bankAccountNumber}
              onChange={handleChange}
              onBlur={handleBlur}
            />
            {errors.bankAccountNumber ? (
              <p className="text-red-500 text-xs mt-1 flex items-center gap-1 font-medium">
                <span>⚠️</span> {errors.bankAccountNumber}
              </p>
            ) : (
              <p className="text-gray-400 text-[11px] mt-0.5">
                Digits only (8 to 18 characters)
              </p>
            )}
          </div>

          {/* IFSC / SWIFT Code */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              IFSC / SWIFT Code <span className="text-red-500">*</span>
            </label>
            <input
              name="ifscOrSwift"
              type="text"
              placeholder={form.preferredCurrency === "INR" ? "e.g. SBIN0001234" : "e.g. HDFCINBB or IFSC"}
              maxLength={11}
              className={`w-full px-3 py-2 text-sm border rounded-lg outline-none transition font-mono uppercase ${
                errors.ifscOrSwift
                  ? "border-red-400 bg-red-50/30 focus:ring-2 focus:ring-red-200"
                  : "border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              }`}
              value={form.ifscOrSwift}
              onChange={handleChange}
              onBlur={handleBlur}
            />
            {errors.ifscOrSwift && (
              <p className="text-red-500 text-xs mt-1 flex items-center gap-1 font-medium">
                <span>⚠️</span> {errors.ifscOrSwift}
              </p>
            )}
          </div>

          {/* Preferred Currency */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Preferred Currency
            </label>
            <select
              name="preferredCurrency"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 cursor-pointer"
              value={form.preferredCurrency}
              onChange={handleCurrencyChange}
            >
              <option value="INR">INR (₹)</option>
              <option value="USD">USD ($)</option>
              <option value="CAD">CAD (C$)</option>
              <option value="EUR">EUR (€)</option>
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Additional Notes <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              name="notes"
              placeholder="Branch name, routing number, or any specific instructions..."
              rows={2}
              maxLength={250}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              value={form.notes}
              onChange={handleChange}
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition shadow-sm cursor-pointer active:scale-[0.99] mt-2"
          >
            Send Details
          </button>
        </form>
      </div>
    </div>
  );
};

export default StipendDetailsModal;
