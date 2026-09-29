import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import axios from "../../../../api/axiosInstance";

const SchoolAdminProfileForm = () => {
  const location = useLocation();
  const initialRegisterData = location.state || {};
  const navigate = useNavigate();

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
      if (initialRegisterData.isGoogleUser) {
        const token = localStorage.getItem("schoolAdminToken");
        const { data } = await axios.put("/api/school-admin/update-profile", formPayload, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
        });
        
        if (!data.admin.isApproved) {
          alert("Profile completed successfully! Your account is pending administrator approval.");
          localStorage.removeItem("schoolAdminToken");
          localStorage.removeItem("schoolAdminInfo");
          localStorage.removeItem("userInfo");
          navigate("/schooladmin/login");
        } else {
          alert("Profile completed successfully!");
          navigate("/schooladmin/dashboard");
        }
      } else {
        await axios.post("/api/school-admin/register", formPayload, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        });
        alert("Registration submitted successfully!");
        navigate("/schooladmin/login");
      }
    } catch (error) {
      const message = error.response?.data?.message || "Registration failed.";
      console.error("Error submitting profile:", error);
      alert(message);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4 font-poppins">
      <form
        onSubmit={handleSubmit}
        className="bg-white shadow-xl rounded-xl w-full max-w-4xl p-8"
      >
        <h2 className="text-3xl font-bold text-blue-700 mb-8 text-center">
          School Profile Details (Canada)
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
              <label className="block text-sm font-medium text-gray-700 mb-5">School Type</label>
              <select
                name="schoolType"
                value={formData.schoolType}
                onChange={handleChange}
                className="w-full p-2 border border-gray-300 rounded-md"
                required
              >
                <option value="">Select School Type</option>
                <option value="Public">Public</option>
                <option value="Catholic">Catholic</option>
                <option value="Private">Private</option>
                <option value="Charter">Charter</option>
              </select>
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
                placeholder="Affiliation (e.g., TDSB)"
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Province</label>
              <input
                type="text"
                name="province"
                placeholder="Province (e.g., Ontario)"
                value={formData.province}
                onChange={handleChange}
                className="w-full p-3 border border-gray-300 rounded-md"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Postal Code</label>
              <input
                type="text"
                name="postalCode"
                placeholder="Postal Code (e.g., M5V 2T6)"
                value={formData.postalCode}
                onChange={handleChange}
                pattern="[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d"
                title="Format: A1A 1A1"
                className="w-full p-3 border border-gray-300 rounded-md"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-5">Country</label>
              <select
                name="country"
                value={formData.country}
                onChange={handleChange}
                className="w-full p-2 border border-gray-300 rounded-md"
                required
              >
                <option value="">Select Country</option>
                <option value="Canada">Canada</option>
                <option value="USA">USA</option>
              </select>
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
            <select
              name="languageOfInstruction"
              value={formData.languageOfInstruction}
              onChange={handleChange}
              className="w-full p-3 border border-gray-300 rounded-md"
              required
            >
              <option value="">Select Language</option>
              <option value="English">English</option>
              <option value="French">French</option>
              <option value="Bilingual">Bilingual (English/French)</option>
            </select>
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
          className="mt-8 w-full bg-blue-600 hover:bg-blue-700 text-white py-3 text-lg rounded-md font-semibold transition"
        >
          Submit Profile
        </button>
      </form>
    </div>
  );
};

export default SchoolAdminProfileForm;
