import React, { useState } from "react";
import { useDispatch } from "react-redux";
import EdutechexLogo from "../../assets/Edutech-logo.png";
import axios from "../../api/axiosInstance";
import { message } from "antd";
import { ShowLoading, HideLoading } from "../../redux/rootSlice";
import { FaEye, FaEyeSlash } from "react-icons/fa";

function Login() {
  const [user, setUser] = useState({
    username: "",
    password: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const dispatch = useDispatch();

  const handleSubmit = async (e) => {
    e.preventDefault();
    await login();
  };

  const login = async () => {
    try {
      dispatch(ShowLoading());
      const response = await axios.post("/api/edutechex/admin-login", user);
      dispatch(HideLoading());

      if (response.data.success) {
        message.success(response.data.message);
        localStorage.setItem("edutechexAdminSession", JSON.stringify(response.data));
        window.location.href = "/admin"; // Redirect to admin page on successful login
      } else {
        message.error(response.data.message);
      }
    } catch (error) {
      message.error(error.response?.data?.message || error.message);
      dispatch(HideLoading());
    }
  };

  return (
    <div className="flex justify-center items-center h-screen bg-gray-200">
      <div className="w-96 p-8 bg-white rounded-lg shadow-md">
        <div className="flex justify-center mb-6">
          <img src={EdutechexLogo} alt="logo" className="w-36 h-auto" />
        </div>
        <h1 className="text-3xl text-center text-gray-800 mb-6 font-semibold">
          Admin Login
        </h1>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label
              htmlFor="username"
              className="block text-gray-700 font-semibold mb-1"
            >
              Username
            </label>
            <input
              id="username"
              type="text"
              value={user.username}
              onChange={(e) =>
                setUser({ ...user, username: e.target.value.trim() })
              }
              placeholder="Enter your username"
              className="px-4 py-3 rounded-lg border border-gray-300 w-full focus:outline-none focus:border-blue-500 !mt-0"
            />
          </div>
          <div className="mb-6">
            <label
              htmlFor="password"
              className="block text-gray-700 font-semibold mb-1"
            >
              Password
            </label>
            <div className="relative flex items-center">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={user.password}
                onChange={(e) => setUser({ ...user, password: e.target.value })}
                placeholder="Enter your password"
                className="px-4 py-3 rounded-lg border border-gray-300 w-full focus:outline-none focus:border-blue-500 pr-12 !mt-0"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center justify-center text-gray-500 hover:text-gray-700 focus:outline-none cursor-pointer"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>
          </div>
          <button
            type="submit"
            className="w-full bg-blue-500 text-white py-3 rounded-lg font-semibold hover:bg-blue-600 focus:outline-none focus:bg-blue-600"
          >
            Login
          </button>
        </form>
      </div>
    </div>
  );
}

export default Login;
