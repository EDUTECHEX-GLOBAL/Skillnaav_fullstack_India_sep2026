import React from 'react';

const StatusModal = ({ title, onClose, data }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-30 flex justify-center items-center z-50 font-poppins">
      <div className="bg-white p-6 rounded-lg shadow-xl max-w-3xl w-full relative">
        <button
          onClick={onClose}
          className="absolute top-3 right-4 text-gray-600 text-lg"
        >
          ✕
        </button>
        <h2 className="text-xl font-semibold mb-4 text-gray-800">{title}</h2>
        <div className="overflow-x-auto border rounded">
          <table className="min-w-full text-sm text-left">
            <thead className="bg-pink-100">
              <tr>
                <th className="px-4 py-2">Student Name</th>
                <th className="px-4 py-2">Email</th>
                <th className="px-4 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, idx) => (
                <tr key={idx} className="border-t">
                  <td className="px-4 py-2">{row.name}</td>
                  <td className="px-4 py-2">{row.email}</td>
                  <td className="px-4 py-2">{row.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default StatusModal;
