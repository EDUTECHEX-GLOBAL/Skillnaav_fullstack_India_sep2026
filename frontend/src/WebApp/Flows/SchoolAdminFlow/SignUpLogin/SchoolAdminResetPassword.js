import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "../../../../api/axiosInstance";

const SchoolAdminResetPassword = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState({ loading: false, message: "", error: "" });

  const { token } = useParams();
  const navigate = useNavigate();

  const handleReset = async (e) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      setStatus({ ...status, error: "Passwords do not match." });
      return;
    }

    try {
      setStatus({ loading: true, message: "", error: "" });

      const { data } = await axios.post(`/api/school-admin/reset-password/${token}`, { password });
      setStatus({ loading: false, message: data.message });
      setTimeout(() => navigate("/schooladmin/login"), 3000);
    } catch (err) {
      const message = err.response?.data?.message || "Reset failed.";
      console.error(err);
      setStatus({ loading: false, error: message });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center font-poppins bg-gray-50 px-4">
      <form
        onSubmit={handleReset}
        className="w-full max-w-md bg-white p-6 rounded-lg shadow-md"
      >
        <h2 className="text-2xl font-bold text-center mb-4 text-blue-700">Reset Password</h2>

        {status.message && <p className="text-green-600 mb-4 text-center">{status.message}</p>}
        {status.error && <p className="text-red-600 mb-4 text-center">{status.error}</p>}

        <input
          type="password"
          placeholder="New Password"
          className="w-full p-3 mb-4 border border-gray-300 rounded-md"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Confirm Password"
          className="w-full p-3 mb-4 border border-gray-300 rounded-md"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
        />

        <button
          type="submit"
          disabled={status.loading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-md font-semibold"
        >
          {status.loading ? "Resetting..." : "Reset Password"}
        </button>
      </form>
    </div>
  );
};

export default SchoolAdminResetPassword;
