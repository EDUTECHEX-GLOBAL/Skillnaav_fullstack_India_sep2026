import React from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import useIsMobileChart from "./useIsMobileChart";

const ApplicationsByTypeChart = ({ data }) => {
  const isMobile = useIsMobileChart();

  if (!data || Object.keys(data).length === 0) {
    return <p className="text-center text-gray-500">No application data available.</p>;
  }

  const chartData = [
    { name: "Free", count: data.FREE || 0, color: "#4CAF50" },
    { name: "Stipend", count: data.STIPEND || 0, color: "#FFC107" },
    { name: "Paid", count: data.PAID || 0, color: "#F44336" }
  ];

  return (
    <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md">
      <h3 className="text-base sm:text-lg font-semibold mb-4 text-center">Applications Applied by Students</h3>
      <ResponsiveContainer width="100%" height={isMobile ? 240 : 300}>
        <BarChart data={chartData} margin={{ top: 12, right: 12, left: isMobile ? -12 : 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: isMobile ? 10 : 12 }} />
          <YAxis width={isMobile ? 28 : 40} tick={{ fontSize: isMobile ? 10 : 12 }} />
          <Tooltip />
          <Bar dataKey="count" fill="#8884d8" barSize={isMobile ? 28 : 60} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default ApplicationsByTypeChart;
