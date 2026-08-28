import React from 'react';
import { Loader2 } from 'lucide-react';

const ConfirmationModal = ({ student, isActive, onCancel, onConfirm, isLoading }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 font-poppins">
      <div className="bg-white w-[90%] max-w-md rounded-2xl shadow-xl p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">
          {isActive ? "Restrict Student Access" : "Restore Student Access"}
        </h2>
        <p className="text-sm text-gray-600 mb-6">
          Are you sure you want to {isActive ? "restrict" : "restore"} access for
          <strong> {student.name}</strong>?
        </p>
        <div className="flex justify-end gap-4">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={`px-4 py-2 text-white rounded-lg flex items-center gap-2 ${
              isActive ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"
            } disabled:opacity-50`}
          >
            {isLoading && <Loader2 className="animate-spin" size={16} />}
            {isActive ? "Restrict" : "Restore"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;
