// src/utils/offerUtils.js
import axios from "../../../../api/axiosInstance";

// Batch status check - much more efficient
export const checkOfferStatuses = async (studentIds, internshipId) => {
  try {
    const response = await axios.post(
      `/api/offer-letters/internship/${internshipId}/statuses`,
      { studentIds },
      { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
    );
    
    // Convert array response to a map
    const statusMap = {};
    if (response.data && Array.isArray(response.data)) {
      response.data.forEach(item => {
        statusMap[item.studentId] = item.status || 'Not Sent';
      });
    }
    
    return statusMap;
  } catch (error) {
    console.error('Error checking offer statuses:', error);
    return {};
  }
};

// Keep individual check for fallback if needed
export const checkOfferStatus = async (studentId, internshipId) => {
  try {
    const response = await axios.post(
      `/api/offer-letters/internship/${internshipId}/statuses`,
      { studentIds: [studentId] },
      { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
    );
    
    if (response.data && response.data.length > 0) {
      return response.data[0].status || 'Not Sent';
    }
    
    return 'Not Sent';
  } catch (error) {
    console.error('Error checking offer status:', error);
    return 'Not Sent';
  }
};

export const getOfferStatusText = (status) => {
  switch (status) {
    // NBSP ensures the two words don't wrap
    case 'Sent':      return 'Offer\u00A0Sent';
    case 'Accepted':  return 'Accepted';
    case 'Rejected':  return 'Rejected';
    case 'Not Sent':  return 'Not\u00A0Sent';
    default:          return status || 'Not\u00A0Sent';
  }
};

export const getOfferStatusColor = (status) => {
  switch (status) {
    case 'Sent':      return 'bg-yellow-200 text-yellow-800 whitespace-nowrap';
    case 'Accepted':  return 'bg-green-200 text-green-800 whitespace-nowrap';
    case 'Rejected':  return 'bg-red-200 text-red-800 whitespace-nowrap';
    case 'Not Sent':  return 'bg-gray-200 text-gray-800 whitespace-nowrap';
    default:          return 'bg-gray-200 text-gray-800 whitespace-nowrap';
  }
};