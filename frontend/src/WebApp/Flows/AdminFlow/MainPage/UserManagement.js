//File: UserManagement.js

import React, { useState, useEffect } from "react";
import axios from "../../../../api/axiosInstance";
import {
  AiOutlineClose,
  AiOutlineSearch,
  AiOutlineCheck,
  AiOutlineCloseCircle,
  AiOutlineEye,
  AiOutlineLeft,
  AiOutlineMail,
  AiOutlineRight,
  AiOutlineCalendar,
  AiOutlineBook,
  AiOutlineUser,
  AiOutlineCamera,
} from "react-icons/ai";
import { MdOutlineSchool } from "react-icons/md";
import UserCard from "./UserCard";

const CustomSelect = ({ value, options, onChange, placeholder }) => {
  const [isOpen, setIsOpen] = useState(false);

  const selectedOption = options.find((opt) => opt.value === value);

  return (
    <div
      className="relative w-full"
      tabIndex={0}
      onBlur={() => setIsOpen(false)}
    >
      <div
        className="w-full px-4 py-3 text-sm sm:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-poppins bg-white cursor-pointer flex justify-between items-center"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="truncate">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <svg
          className={`w-4 h-4 ml-2 flex-shrink-0 fill-current text-gray-500 transition-transform ${isOpen ? "rotate-180" : ""}`}
          viewBox="0 0 20 20"
        >
          <path
            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
            clipRule="evenodd"
            fillRule="evenodd"
          />
        </svg>
      </div>
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-auto py-1 left-0 right-0">
          {options.map((opt) => (
            <div
              key={opt.value}
              className={`px-4 py-2.5 text-sm sm:text-base cursor-pointer transition-colors ${value === opt.value ? "bg-blue-50 text-blue-700 font-medium" : "text-gray-700 hover:bg-gray-50"}`}
              onMouseDown={(e) => {
                // use onMouseDown instead of onClick so it fires before onBlur
                e.preventDefault();
                onChange(opt.value);
                setIsOpen(false);
              }}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const UserManagement = () => {
  // ————————————————————————
  // HOOKS
  // ————————————————————————
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [viewMode, setViewMode] = useState("grid");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [isUserCardOpen, setIsUserCardOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const usersPerPage = 9;

  // Calculate pagination data
  const totalPages = Math.ceil(filteredUsers.length / usersPerPage);
  const idxLast = currentPage * usersPerPage;
  const idxFirst = idxLast - usersPerPage;
  const currentUsers = filteredUsers.slice(idxFirst, idxLast);

  const getPaginationItems = () => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    if (currentPage <= 4) {
      return [1, 2, 3, 4, 5, "ellipsis-right", totalPages];
    }

    if (currentPage >= totalPages - 3) {
      return [
        1,
        "ellipsis-left",
        totalPages - 4,
        totalPages - 3,
        totalPages - 2,
        totalPages - 1,
        totalPages,
      ];
    }

    return [
      1,
      "ellipsis-left",
      currentPage - 1,
      currentPage,
      currentPage + 1,
      "ellipsis-right",
      totalPages,
    ];
  };

  // ————————————————————————
  // Token setup & validity check
  // ————————————————————————
  const raw = localStorage.getItem("adminToken");
  const isValidToken = raw && raw.split(".").length === 3;

  useEffect(() => {
    if (!isValidToken) return;

    axios.defaults.headers.common["Authorization"] = `Bearer ${raw}`;

    const fetchUsers = async () => {
      try {
        const { data } = await axios.get("/api/users/users");
        console.log("Fetched users:", data);
        const processedUsers = data.map((u) => ({
          ...u,
          status:
            u.schoolAdmin && (!u.status || u.status === "Pending")
              ? "Approved"
              : u.status || "Pending",
        }));
        setUsers(processedUsers);
        setFilteredUsers(processedUsers);
      } catch (err) {
        setError(err.response?.data?.message || err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, [isValidToken, raw]);

  // Filter users based on search and status
  useEffect(() => {
    let result = users;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (user) =>
          user.name?.toLowerCase().includes(query) ||
          user.email?.toLowerCase().includes(query) ||
          user.universityName?.toLowerCase().includes(query) ||
          user.fieldOfStudy?.toLowerCase().includes(query),
      );
    }

    if (statusFilter !== "all") {
      result = result.filter((user) => {
        if (statusFilter === "pending")
          return !user.status || user.status === "Pending";
        if (statusFilter === "approved") return user.status === "Approved";
        if (statusFilter === "rejected") return user.status === "Rejected";
        return true;
      });
    }

    if (typeFilter !== "all") {
      result = result.filter((user) => {
        if (typeFilter === "b2b") return !!user.schoolAdmin;
        if (typeFilter === "b2c") return !user.schoolAdmin;
        return true;
      });
    }

    setFilteredUsers(result);
    setCurrentPage(1);
  }, [searchQuery, statusFilter, typeFilter, users]);

  const handleApprove = (userId) =>
    setConfirmAction({ type: "approve", userId });
  const handleReject = (userId) => setConfirmAction({ type: "reject", userId });
  const handleRequestReverify = (userId) =>
    setConfirmAction({ type: "reverify", userId });

  const confirmActionHandler = async () => {
    const { type, userId } = confirmAction || {};
    if (!type || !userId) return;

    setConfirmLoading(true);

    try {
      if (type === "reverify") {
        await axios.patch(
          `/api/user-age-gate-consent/request-reverify/${userId}`,
        );

        // ✅ minimal UI update (so admin sees it immediately without refresh)
        setUsers((prevUsers) =>
          prevUsers.map((u) =>
            u._id === userId
              ? { ...u, status: "Pending", adminApproved: false }
              : u,
          ),
        );

        setSelectedUser((prev) =>
          prev && prev._id === userId
            ? { ...prev, status: "Pending", adminApproved: false }
            : prev,
        );

        return;
      }

      await axios.patch(`/api/users/${type}/${userId}`, {
        status: type === "approve" ? "Approved" : "Rejected",
      });

      setUsers((prevUsers) =>
        prevUsers.map((u) =>
          u._id === userId
            ? { ...u, status: type === "approve" ? "Approved" : "Rejected" }
            : u,
        ),
      );

      setSelectedUser((prev) =>
        prev && prev._id === userId
          ? { ...prev, status: type === "approve" ? "Approved" : "Rejected" }
          : prev,
      );
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setConfirmLoading(false);
      setConfirmAction(null);
    }
  };

  const handleViewProfile = (user) => {
    setSelectedUser(user);
    setIsUserCardOpen(true);
  };

  const closeProfileModal = () => {
    setIsUserCardOpen(false);
    setSelectedUser(null);
  };

  const nextPage = () => setCurrentPage((p) => Math.min(p + 1, totalPages));
  const prevPage = () => setCurrentPage((p) => Math.max(p - 1, 1));

  const getStatusColor = (status) => {
    switch (status) {
      case "Approved":
        return "bg-green-100 text-green-800 border-green-200";
      case "Rejected":
        return "bg-red-100 text-red-800 border-red-200";
      default:
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "Approved":
        return <AiOutlineCheck className="text-green-600" size={14} />;
      case "Rejected":
        return <AiOutlineCloseCircle className="text-red-600" size={14} />;
      default:
        return <AiOutlineCalendar className="text-yellow-600" size={14} />;
    }
  };

  const getAvatarInitial = (name) => {
    if (!name) return "U";
    const names = name.trim().split(" ");
    if (names.length > 1) {
      return (
        names[0].charAt(0) + names[names.length - 1].charAt(0)
      ).toUpperCase();
    }
    return name.charAt(0).toUpperCase();
  };

  const getAvatarColor = (name) => {
    if (!name) return "from-blue-500 to-purple-600";

    const colors = [
      "from-blue-500 to-purple-600",
      "from-green-500 to-teal-600",
      "from-orange-500 to-red-600",
      "from-purple-500 to-pink-600",
      "from-teal-500 to-cyan-600",
      "from-pink-500 to-rose-600",
      "from-indigo-500 to-blue-600",
      "from-emerald-500 to-green-600",
    ];

    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  };

  const hasProfileImage = (user) => {
    return (
      user.profileImage &&
      user.profileImage.trim() !== "" &&
      user.profileImage !== "null" &&
      user.profileImage !== "undefined"
    );
  };

  const getProfileImageUrl = (profileImage) => {
    if (!profileImage || profileImage.trim() === "") return null;

    if (
      profileImage.startsWith("http://") ||
      profileImage.startsWith("https://")
    ) {
      return profileImage;
    }

    const baseUrl = process.env.REACT_APP_API_BASE || "http://localhost:5000";

    // Standardize slashes for windows paths if needed
    const normalizedImage = profileImage.replace(/\\/g, "/");

    if (normalizedImage.startsWith("/")) {
      return `${baseUrl}${normalizedImage}`;
    }
    
    if (normalizedImage.startsWith("uploads/")) {
      return `${baseUrl}/${normalizedImage}`;
    }

    return `${baseUrl}/uploads/${normalizedImage}`;
  };

  // Render loading state
  if (!isValidToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 font-poppins">
        <div className="text-center p-8 bg-white rounded-2xl shadow-lg max-w-md">
          <div className="text-red-500 text-6xl mb-4">🔒</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            Session Expired
          </h2>
          <p className="text-gray-600 mb-6">
            Your admin session has expired or is invalid.
          </p>
          <a
            href="/admin/login"
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
          >
            Log In Again
          </a>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 font-poppins">
        <div className="relative">
          <div className="w-20 h-20 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <AiOutlineUser className="text-2xl text-blue-600" />
          </div>
        </div>
        <p className="mt-4 text-gray-600 font-medium">Loading user data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 font-poppins">
        <div className="text-center p-8 bg-white rounded-2xl shadow-lg max-w-md">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            Error Loading Data
          </h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Main render
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-3 sm:p-4 lg:p-6 font-poppins">
      {/* Header */}
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 sm:mb-8 gap-3 sm:gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
              Student Applications
            </h1>
            <p className="text-gray-600 mt-2">
              Review and manage student applications
            </p>
          </div>

          <div className="flex w-full md:w-auto items-center gap-4">
            <div className="text-sm font-medium text-gray-700 bg-white px-4 py-2 rounded-lg shadow">
              Total:{" "}
              <span className="font-bold text-blue-600">
                {filteredUsers.length}
              </span>{" "}
              students
            </div>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="bg-white rounded-2xl shadow-lg p-4 sm:p-6 mb-6 sm:mb-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
            {/* Search */}
            <div className="relative">
              <AiOutlineSearch
                className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400"
                size={20}
              />
              {/*Add the "!mt-0 h-12" for the alignment - 05-08-2026 */}
              <input
                type="text"
                name="user_search_query"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoComplete="on"
                className="!mt-0 h-12 w-full pl-12 pr-10 py-3 text-sm sm:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-poppins truncate"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <AiOutlineClose size={20} />
                </button>
              )}
            </div>

            {/* Status Filter */}
            <div className="relative">
              <CustomSelect
                value={statusFilter}
                onChange={(val) => setStatusFilter(val)}
                placeholder="All Statuses"
                options={[
                  { value: "all", label: "All Statuses" },
                  { value: "pending", label: "Pending Review" },
                  { value: "approved", label: "Approved" },
                  { value: "rejected", label: "Rejected" },
                ]}
              />
            </div>

            {/* Type Filter */}
            <div className="relative">
              <CustomSelect
                value={typeFilter}
                onChange={(val) => setTypeFilter(val)}
                placeholder="All Student Types"
                options={[
                  { value: "all", label: "All Student Types" },
                  { value: "b2b", label: "B2B Students" },
                  { value: "b2c", label: "B2C Students" },
                ]}
              />
            </div>

            {/* View Toggle */}
            {/*Change the justify-between to justify-end for the mobile compatibility - 05-08-2026 */}
            <div className="flex items-center justify-end sm:justify-end gap-2 xl:col-span-1">
              <span className="text-gray-600 mr-2 text-sm sm:text-base">
                View:
              </span>
              <button
                onClick={() => setViewMode("grid")}
                className={`p-2 rounded-lg ${viewMode === "grid" ? "bg-blue-100 text-blue-600" : "bg-gray-100 text-gray-600"} hover:bg-blue-50 transition`}
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
                  />
                </svg>
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`p-2 rounded-lg ${viewMode === "list" ? "bg-blue-100 text-blue-600" : "bg-gray-100 text-gray-600"} hover:bg-blue-50 transition`}
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              </button>
            </div>
          </div>

          {/* Status Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-yellow-800">
                    Pending Review
                  </p>
                  <p className="text-2xl font-bold text-yellow-900">
                    {
                      users.filter((u) => !u.status || u.status === "Pending")
                        .length
                    }
                  </p>
                </div>
                <AiOutlineCalendar className="text-yellow-600 text-2xl" />
              </div>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-800">Approved</p>
                  <p className="text-2xl font-bold text-green-900">
                    {users.filter((u) => u.status === "Approved").length}
                  </p>
                </div>
                <AiOutlineCheck className="text-green-600 text-2xl" />
              </div>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-red-800">Rejected</p>
                  <p className="text-2xl font-bold text-red-900">
                    {users.filter((u) => u.status === "Rejected").length}
                  </p>
                </div>
                <AiOutlineCloseCircle className="text-red-600 text-2xl" />
              </div>
            </div>
          </div>
        </div>

        {/* User Cards Grid/List */}
        {viewMode === "grid" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
            {currentUsers.map((user) => (
              <div
                key={user._id}
                className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-100 hover:border-blue-100 flex flex-col h-full"
              >
                {/* Card Header with Profile Image */}
                <div className="relative">
                  <div className="h-24 bg-gradient-to-r from-blue-50 to-indigo-50"></div>

                  {/* Profile Image/Initial */}
                  <div className="absolute -bottom-8 left-6">
                    {hasProfileImage(user) ? (
                      <div className="relative">
                        <img
                          src={getProfileImageUrl(user.profileImage)}
                          alt={user.name}
                          className="w-20 h-20 rounded-full border-4 border-white shadow-lg object-cover bg-gray-100"
                          onError={(e) => {
                            e.target.style.display = "none";
                            const parent = e.target.parentElement;
                            if (parent) {
                              parent.innerHTML = `
                                <div class="w-20 h-20 rounded-full border-4 border-white shadow-lg flex items-center justify-center text-white font-bold text-2xl bg-gradient-to-br ${getAvatarColor(user.name)}">
                                  ${getAvatarInitial(user.name)}
                                </div>
                              `;
                            }
                          }}
                        />
                      </div>
                    ) : (
                      <div className="relative">
                        <div
                          className={`w-20 h-20 rounded-full border-4 border-white shadow-lg flex items-center justify-center text-white font-bold text-2xl bg-gradient-to-br ${getAvatarColor(user.name)}`}
                        >
                          {getAvatarInitial(user.name)}
                        </div>
                        <div className="absolute -bottom-1 -right-1 bg-gray-100 p-1 rounded-full border-2 border-white">
                          <AiOutlineCamera className="text-gray-400 text-xs" />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Status Badge */}
                  <div className="absolute top-3 right-3 sm:top-4 sm:right-4">
                    <div
                      className={`inline-flex max-w-full items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border ${getStatusColor(user.status)}`}
                    >
                      {getStatusIcon(user.status)}
                      <span>{user.status || "Pending"}</span>
                    </div>
                  </div>
                </div>

                {/* Card Content */}
                <div className="pt-12 px-4 sm:px-6 pb-5 sm:pb-6 flex-1 flex flex-col">
                  {/* User Info */}
                  <div className="mb-6">
                    <h3 className="font-bold text-lg sm:text-xl text-gray-900 mb-1 truncate">
                      {user.name || "No Name"}
                    </h3>
                    <div className="flex items-center gap-2 text-gray-600 mb-3 min-w-0">
                      <AiOutlineMail size={14} />
                      <span className="text-sm truncate min-w-0">
                        {user.email || "No Email"}
                      </span>
                    </div>

                    {user.universityName && (
                      <div className="flex items-center gap-2 text-gray-700 mb-2 min-w-0">
                        <MdOutlineSchool size={16} />
                        <span className="text-sm truncate min-w-0">
                          {user.universityName}
                        </span>
                      </div>
                    )}

                    {user.fieldOfStudy && (
                      <div className="text-sm text-gray-600 truncate min-w-0">
                        <span className="font-medium">Field:</span>{" "}
                        {user.fieldOfStudy}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="space-y-3 mt-auto">
                    <button
                      onClick={() => handleViewProfile(user)}
                      className="w-full px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium text-sm flex items-center justify-center gap-2"
                    >
                      <AiOutlineEye />
                      View Full Profile
                    </button>

                    <div className="flex flex-col sm:flex-row gap-2">
                      {/* Approve Button — Grid View */}
                      <button
                        onClick={() => handleApprove(user._id)}
                        disabled={user.status === "Approved"}
                        className={`w-full flex-1 px-3 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-1 transition ${
                          user.status === "Approved"
                            ? "bg-green-600 text-white cursor-not-allowed opacity-70"
                            : "bg-green-500 text-white hover:bg-green-600"
                        }`}
                      >
                        <AiOutlineCheck size={14} />
                        {user.status === "Approved" ? "Approved" : "Approve"}
                      </button>

                      {/* Reject Button — Grid View */}
                      <button
                        onClick={() => handleReject(user._id)}
                        disabled={user.status === "Rejected"}
                        className={`w-full flex-1 px-3 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-1 transition ${
                          user.status === "Rejected"
                            ? "bg-red-600 text-white cursor-not-allowed opacity-70"
                            : "bg-red-500 text-white hover:bg-red-600"
                        }`}
                      >
                        <AiOutlineCloseCircle size={14} />
                        {user.status === "Rejected" ? "Rejected" : "Reject"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* List View */
          <div className="space-y-4 mb-8">
            {currentUsers.map((user) => (
              <div
                key={user._id}
                className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 p-4 sm:p-6"
              >
                <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 sm:gap-6">
                  <div className="flex flex-col sm:flex-row sm:items-start gap-4 min-w-0 flex-1">
                    {/* Profile Image/Initial */}
                    {hasProfileImage(user) ? (
                      <div className="relative">
                        <img
                          src={getProfileImageUrl(user.profileImage)}
                          alt={user.name}
                          className="w-16 h-16 rounded-full border-4 border-white shadow-lg object-cover bg-gray-100"
                          onError={(e) => {
                            e.target.style.display = "none";
                            const parent = e.target.parentElement;
                            if (parent) {
                              parent.innerHTML = `
                                <div class="w-16 h-16 rounded-full border-4 border-white shadow-lg flex items-center justify-center text-white font-bold text-xl bg-gradient-to-br ${getAvatarColor(user.name)}">
                                  ${getAvatarInitial(user.name)}
                                </div>
                              `;
                            }
                          }}
                        />
                      </div>
                    ) : (
                      <div className="relative">
                        <div
                          className={`w-16 h-16 rounded-full border-4 border-white shadow-lg flex items-center justify-center text-white font-bold text-xl bg-gradient-to-br ${getAvatarColor(user.name)}`}
                        >
                          {getAvatarInitial(user.name)}
                        </div>
                        <div className="absolute -bottom-1 -right-1 bg-gray-100 p-1 rounded-full border-2 border-white">
                          <AiOutlineCamera className="text-gray-400 text-xs" />
                        </div>
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-2 min-w-0">
                        <h3 className="font-bold text-lg text-gray-900 break-words">
                          {user.name || "No Name"}
                        </h3>
                        <div
                          className={`inline-flex w-fit items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(user.status)}`}
                        >
                          {getStatusIcon(user.status)}
                          <span>{user.status || "Pending"}</span>
                        </div>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:gap-4 min-w-0">
                        <div className="flex items-start gap-2 text-gray-600 min-w-0">
                          <AiOutlineMail size={14} />
                          <span className="text-sm break-all">
                            {user.email || "No Email"}
                          </span>
                        </div>
                        {user.universityName && (
                          <div className="flex items-start gap-2 text-gray-600 min-w-0">
                            <MdOutlineSchool size={14} />
                            <span className="text-sm break-words">
                              {user.universityName}
                            </span>
                          </div>
                        )}
                        {user.fieldOfStudy && (
                          <div className="flex items-start gap-2 text-gray-600 min-w-0">
                            <AiOutlineBook size={14} />
                            <span className="text-sm break-words">
                              {user.fieldOfStudy}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:flex-wrap xl:flex-nowrap items-stretch sm:items-center gap-3 w-full xl:w-auto">
                    <button
                      onClick={() => handleViewProfile(user)}
                      className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium flex items-center justify-center gap-2 text-sm"
                    >
                      <AiOutlineEye />
                      View Profile
                    </button>

                    <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                      {/* Approve Button — List View */}
                      <button
                        onClick={() => handleApprove(user._id)}
                        disabled={user.status === "Approved"}
                        className={`w-full flex-1 px-3 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-1 transition ${
                          user.status === "Approved"
                            ? "bg-green-600 text-white cursor-not-allowed opacity-70"
                            : "bg-green-500 text-white hover:bg-green-600"
                        }`}
                      >
                        <AiOutlineCheck size={14} />
                        {user.status === "Approved" ? "Approved" : "Approve"}
                      </button>

                      {/* Reject Button — List View */}
                      <button
                        onClick={() => handleReject(user._id)}
                        disabled={user.status === "Rejected"}
                        className={`w-full flex-1 px-3 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-1 transition ${
                          user.status === "Rejected"
                            ? "bg-red-600 text-white cursor-not-allowed opacity-70"
                            : "bg-red-500 text-white hover:bg-red-600"
                        }`}
                      >
                        <AiOutlineCloseCircle size={14} />
                        {user.status === "Rejected" ? "Rejected" : "Reject"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {filteredUsers.length > usersPerPage && (
          <div className="flex justify-center">
            <div className="inline-flex w-full sm:w-auto items-center justify-center gap-1.5 rounded-2xl border border-slate-200/80 bg-white/95 p-1.5 shadow-[0_14px_30px_-18px_rgba(15,23,42,0.35)]">
              <button
                onClick={prevPage}
                disabled={currentPage === 1}
                className={`inline-flex h-10 items-center justify-center gap-2 rounded-xl border px-3 sm:px-4 text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 ${
                  currentPage === 1
                    ? "border-transparent bg-slate-50 text-slate-400 cursor-not-allowed"
                    : "border-transparent bg-slate-50 text-slate-700 hover:bg-blue-50 hover:text-blue-700"
                }`}
                aria-label="Go to previous page"
              >
                <AiOutlineLeft size={16} />
                <span className="hidden sm:inline">Previous</span>
              </button>

              <div className="hidden sm:flex items-center gap-1">
                {getPaginationItems().map((item, index) => {
                  if (typeof item !== "number") {
                    return (
                      <span
                        key={`${item}-${index}`}
                        className="flex h-10 min-w-[2.25rem] items-center justify-center rounded-xl bg-slate-50 px-2 text-sm font-medium text-slate-400"
                      >
                        ...
                      </span>
                    );
                  }

                  return (
                    <button
                      key={item}
                      onClick={() => setCurrentPage(item)}
                      className={`flex h-10 min-w-[2.5rem] items-center justify-center rounded-xl px-3 text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 ${
                        currentPage === item
                          ? "bg-blue-600 text-white shadow-[0_10px_18px_-12px_rgba(37,99,235,0.85)]"
                          : "bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                      }`}
                      aria-label={`Go to page ${item}`}
                      aria-current={currentPage === item ? "page" : undefined}
                    >
                      {item}
                    </button>
                  );
                })}
              </div>

              <div className="sm:hidden flex h-10 min-w-[4.75rem] items-center justify-center rounded-xl bg-slate-50 px-4 text-sm font-semibold text-slate-700">
                {currentPage} / {totalPages}
              </div>

              <button
                onClick={nextPage}
                disabled={currentPage === totalPages}
                className={`inline-flex h-10 items-center justify-center gap-2 rounded-xl border px-3 sm:px-4 text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 ${
                  currentPage === totalPages
                    ? "border-transparent bg-slate-50 text-slate-400 cursor-not-allowed"
                    : "border-transparent bg-slate-50 text-slate-700 hover:bg-blue-50 hover:text-blue-700"
                }`}
                aria-label="Go to next page"
              >
                <span className="hidden sm:inline">Next</span>
                <AiOutlineRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Empty State */}
        {filteredUsers.length === 0 && (
          <div className="text-center py-12 sm:py-16 px-4 sm:px-6 bg-white rounded-2xl shadow-lg">
            <div className="text-gray-400 text-6xl mb-4">👤</div>
            <h3 className="text-xl font-bold text-gray-700 mb-2">
              No users found
            </h3>
            <p className="text-gray-500">
              {searchQuery
                ? `No users match "${searchQuery}"`
                : "No users match the selected filters"}
            </p>
            {(searchQuery ||
              statusFilter !== "all" ||
              typeFilter !== "all") && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("all");
                  setTypeFilter("all");
                }}
                className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
              >
                Clear Filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* UserCard Component Modal */}

      {isUserCardOpen && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-start sm:items-center justify-center z-50 p-3 sm:p-4 overflow-y-auto">
          <div className="relative w-full max-w-4xl my-4 sm:my-0">
            <UserCard
              user={selectedUser}
              onClose={closeProfileModal}
              onApprove={handleApprove}
              onReject={handleReject}
              onRequestReverify={handleRequestReverify}
            />
          </div>
        </div>
      )}

      {/* Confirm Action Modal */}
      {confirmAction && (
        <div className="fixed inset-0 bg-black/50 flex items-start sm:items-center justify-center z-50 p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl p-5 sm:p-8 max-w-md w-full my-4 sm:my-0">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                {confirmAction.type === "approve" ? (
                  <AiOutlineCheck className="text-green-600 text-3xl" />
                ) : confirmAction.type === "reject" ? (
                  <AiOutlineCloseCircle className="text-red-600 text-3xl" />
                ) : (
                  <AiOutlineCamera className="text-yellow-600 text-3xl" />
                )}
              </div>

              <h3 className="text-xl font-bold text-gray-900 mb-2">
                {confirmAction.type === "approve"
                  ? "Approve Application"
                  : confirmAction.type === "reject"
                    ? "Reject Application"
                    : "Request Age Re-Verification"}
              </h3>

              <p className="text-gray-600">
                {confirmAction.type === "reverify"
                  ? "This will ask the user to recapture their selfie on next login and move them back to Pending."
                  : `Are you sure you want to ${confirmAction.type} this user's application?`}
              </p>
            </div>

            <div className="flex flex-col-reverse sm:flex-row gap-3">
              <button
                onClick={() => setConfirmAction(null)}
                className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium"
              >
                Cancel
              </button>

              <button
                onClick={confirmActionHandler}
                disabled={confirmLoading}
                className={`flex-1 px-4 py-3 rounded-lg text-white font-medium transition
    ${
      confirmAction.type === "approve"
        ? "bg-green-600 hover:bg-green-700"
        : confirmAction.type === "reject"
          ? "bg-red-600 hover:bg-red-700"
          : "bg-yellow-600 hover:bg-yellow-700"
    }
    ${confirmLoading ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                {confirmLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Processing...
                  </span>
                ) : confirmAction.type === "reverify" ? (
                  "Yes, request re-verification"
                ) : (
                  `Yes, ${confirmAction.type}`
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
