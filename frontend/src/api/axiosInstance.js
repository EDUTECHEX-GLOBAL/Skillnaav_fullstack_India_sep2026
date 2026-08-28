import axios from "axios";

const axiosInstance = axios.create({
  baseURL: process.env.REACT_APP_API_BASE,
  withCredentials: true,
});

axiosInstance.interceptors.request.use((config) => {
  console.log("🚀 API Request:", `${config.baseURL}${config.url}`);
  return config;
});

axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    // Suppress console error for expected 404s (e.g., schedule not created yet)
    const url = error?.config?.url || "";
    const isExpected404 = error?.response?.status === 404 && url.includes("/api/schedule/get-schedule");

    if (!isExpected404) {
      console.error("❌ API Error:", error?.response || error.message);
    }
    
    return Promise.reject(error);
  }
);

export default axiosInstance;