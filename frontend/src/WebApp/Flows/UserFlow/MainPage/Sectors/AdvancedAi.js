import React, { useEffect, useState } from "react";
import axios from "../../../../../api/axiosInstance";
import JobCard from "../Card";
import ApplyCards from "../ApplyCards";

const AdvancedAi = () => {
  // State to store fetched internships
  const [internships, setInternships] = useState([]);
  // State to store the selected job for detailed view
  const [selectedJob, setSelectedJob] = useState(null);
  // Loading state to handle API call status
  const [loading, setLoading] = useState(true);
  // Error state to show if API request fails
  const [error, setError] = useState(null);

  // Fetch internships for "Advanced AI" sector when component mounts
  useEffect(() => {
    const fetchSectorInternships = async () => {
      try {
        setLoading(true); // Show loading message
        const res = await axios.get("/api/interns/approved", {
          params: { isPremium: false, sector: "advanced-ai" }, // Filtering by sector
        });
        setInternships(res.data.data);// Save internships in state
      } catch (err) {
        console.error("Error fetching sector internships:", err);
        setError("Failed to load internships"); // Show error message
      } finally {
        setLoading(false); // Hide loading message
      }
    };

    fetchSectorInternships();
  }, []); // Empty dependency array → runs only once when mounted

  // Show loading or error messages
  if (loading) return <p>Loading internships...</p>;
  if (error) return <p>{error}</p>;

  return (
    <div className="p-4 font-poppins">
      {/* Page Title */}
      <h1 className="text-2xl font-bold mb-2">Advanced AI Internships ({internships.length})</h1>

      {/* Short description */}
      <p className="text-gray-600 mb-4">
        Explore the latest opportunities in the field of Advanced AI.
      </p>

      {/* If no job is selected, show the job listing */}
      {!selectedJob ? (
        <JobCard
          jobs={internships}
          searchTerm=""
          onViewDetails={(job) => setSelectedJob(job)} // Clicking "View details" will open ApplyCards
        />
      ) : (
        // If a job is selected, show the ApplyCards component
        <ApplyCards job={selectedJob} onBack={() => setSelectedJob(null)} />
      )}
    </div>
  );
};

export default AdvancedAi;
