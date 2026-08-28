import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  ResponsiveContainer,
} from "recharts";
import useIsMobileChart from "./useIsMobileChart";

const formatMonthLabel = (value) => {
  if (!value) return "";

  const [year, month] = value.split("-");

  return new Date(year, month - 1).toLocaleString("default", {
    month: "short",
    year: "numeric",
  });
};

const DashboardCharts = ({ userGrowth, jobPostings }) => {
  const isMobile = useIsMobileChart();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8 mt-6 sm:mt-8">
      {/* Line Chart for User Growth */}
      <div className="bg-white p-4 sm:p-6 rounded-lg shadow-lg">
        <h3 className="text-base sm:text-lg font-semibold mb-4">
          User Growth Over Time
        </h3>
        <ResponsiveContainer width="100%" height={isMobile ? 220 : 250}>
          <LineChart
            data={userGrowth}
            margin={{ top: 8, right: 10, left: isMobile ? -20 : 0, bottom: 0 }}
          >
            <XAxis
              dataKey="month"
              tickFormatter={formatMonthLabel}
              tick={{ fontSize: isMobile ? 10 : 12 }}
              minTickGap={isMobile ? 18 : 10}
            />
            <YAxis
              width={isMobile ? 28 : 40}
              tick={{ fontSize: isMobile ? 10 : 12 }}
            />
            <Tooltip labelFormatter={formatMonthLabel} />
            <CartesianGrid strokeDasharray="3 3" />
            <Line
              type="monotone"
              dataKey="users"
              stroke="#4CAF50"
              strokeWidth={2}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Bar Chart for Job Postings */}
      <div className="bg-white p-4 sm:p-6 rounded-lg shadow-lg">
        <h3 className="text-base sm:text-lg font-semibold mb-4">
          Monthly Job Postings
        </h3>
        <ResponsiveContainer width="100%" height={isMobile ? 220 : 250}>
          <BarChart
            data={jobPostings}
            margin={{ top: 8, right: 10, left: isMobile ? -20 : 0, bottom: 0 }}
          >
            <XAxis
              dataKey="month"
              tickFormatter={formatMonthLabel}
              tick={{ fontSize: isMobile ? 10 : 12 }}
              minTickGap={isMobile ? 18 : 10}
            />
            <YAxis
              width={isMobile ? 28 : 40}
              tick={{ fontSize: isMobile ? 10 : 12 }}
            />
            <Tooltip labelFormatter={formatMonthLabel} />
            <CartesianGrid strokeDasharray="3 3" />
            <Bar dataKey="jobsPosted" fill="#2196F3" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default DashboardCharts;
