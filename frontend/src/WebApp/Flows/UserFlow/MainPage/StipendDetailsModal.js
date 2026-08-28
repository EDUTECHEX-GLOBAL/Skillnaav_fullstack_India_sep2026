// StipendDetailsModal.jsx
import React, { useState } from "react";

const StipendDetailsModal = ({ visible, onClose, onSubmit }) => {
  const [form, setForm] = useState({
    bankAccountName: "",
    bankAccountNumber: "",
    ifscOrSwift: "",
    preferredCurrency: "USD",
    notes: ""
  });

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // Basic validation
    if (!form.bankAccountName || !form.bankAccountNumber || !form.ifscOrSwift || !form.preferredCurrency) {
      alert("Please fill all required fields");
      return;
    }
    onSubmit(form);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-2xl shadow-2xl max-w-md w-full relative">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-500 hover:text-gray-700 text-xl"
        >
          &times;
        </button>
        <h2 className="text-xl font-semibold text-gray-800 mb-2">
          Enter Stipend Payment Details
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            name="bankAccountName"
            type="text"
            placeholder="Account Holder Name"
            className="w-full px-3 py-2 border rounded"
            value={form.bankAccountName}
            onChange={handleChange}
            required
          />
          <input
            name="bankAccountNumber"
            type="text"
            placeholder="Bank Account Number"
            className="w-full px-3 py-2 border rounded"
            value={form.bankAccountNumber}
            onChange={handleChange}
            required
          />
          <input
            name="ifscOrSwift"
            type="text"
            placeholder="IFSC/SWIFT Code"
            className="w-full px-3 py-2 border rounded"
            value={form.ifscOrSwift}
            onChange={handleChange}
            required
          />
          <select
            name="preferredCurrency"
            className="w-full px-3 py-2 border rounded"
            value={form.preferredCurrency}
            onChange={handleChange}
            required
          >
            <option value="USD">USD</option>
            <option value="CAD">CAD</option>
            <option value="INR">INR</option>
            <option value="EUR">EUR</option>
          </select>
          <textarea
            name="notes"
            placeholder="Additional notes (optional)"
            className="w-full px-3 py-2 border rounded"
            value={form.notes}
            onChange={handleChange}
          />
          <button
            type="submit"
            className="w-full py-2 rounded bg-indigo-600 text-white font-semibold"
          >
            Send Details
          </button>
        </form>
      </div>
    </div>
  );
};

export default StipendDetailsModal;
