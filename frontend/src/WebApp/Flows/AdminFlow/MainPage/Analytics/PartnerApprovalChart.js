import React from "react";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import useIsMobileChart from "./useIsMobileChart";

const PartnerApprovalChart = ({ data }) => {
  const isMobile = useIsMobileChart();

  // Prepare data array from the partnerApproval object
  const chartData = [
    { name: "Approved", value: data.approved || 0 },
    { name: "Pending", value: data.pending || 0 }
  ];
  const COLORS = ["#00C49F", "#FF8042"];

  return (
    <div className="bg-white p-4 sm:p-6 rounded-lg shadow-lg">
      <h3 className="text-base sm:text-lg font-semibold mb-4">Partner Approval Status</h3>
      <ResponsiveContainer width="100%" height={isMobile ? 220 : 250}>
        <PieChart>
          <Pie
            data={chartData}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy={isMobile ? "45%" : "50%"}
            outerRadius={isMobile ? 68 : 80}
            label={!isMobile}
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: isMobile ? "11px" : "12px", paddingTop: "8px" }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

export default PartnerApprovalChart;
