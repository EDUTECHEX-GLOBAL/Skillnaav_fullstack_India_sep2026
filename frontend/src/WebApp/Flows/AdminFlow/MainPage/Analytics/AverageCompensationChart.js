import React from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from "recharts";
import useIsMobileChart from "./useIsMobileChart";

const AverageCompensationChart = ({ data }) => {
  const isMobile = useIsMobileChart();

  // Prepare data as an array for the chart
  const chartData = [
    { type: "Stipend", amount: data.STIPEND || 0 },
    { type: "Paid", amount: data.PAID || 0 }
  ];

  return (
    <div className="bg-white p-4 sm:p-6 rounded-lg shadow-lg">
      <h3 className="text-base sm:text-lg font-semibold mb-4">Average Compensation</h3>
      <ResponsiveContainer width="100%" height={isMobile ? 220 : 250}>
        <BarChart data={chartData} margin={{ top: 8, right: 10, left: isMobile ? -16 : 0, bottom: 0 }}>
          <XAxis dataKey="type" tick={{ fontSize: isMobile ? 10 : 12 }} />
          <YAxis width={isMobile ? 28 : 40} tick={{ fontSize: isMobile ? 10 : 12 }} />
          <Tooltip />
          <CartesianGrid strokeDasharray="3 3" />
          <Bar dataKey="amount" fill="#8884d8" barSize={isMobile ? 32 : 48} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default AverageCompensationChart;
