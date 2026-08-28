import React, { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
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
const RevenueChart = ({ data }) => {
  const isMobile = useIsMobileChart();
  const isCompactRevenueLayout = useIsMobileChart(1100);
  const COLORS = [
    "#0088FE",
    "#00C49F",
    "#FFBB28",
    "#FF8042",
    "#7C3AED",
    "#14B8A6",
    "#94A3B8",
  ];

  const pieData = useMemo(() => {
    const normalizedData = (Array.isArray(data) ? data : [])
      .filter((item) => Number(item?.revenue) > 0)
      .map((item) => ({
        month: item.month,
        revenue: Number(item.revenue),
      }))
      .sort((a, b) => b.revenue - a.revenue);

    const maxSlices = isCompactRevenueLayout ? 4 : 6;
    if (normalizedData.length <= maxSlices) return normalizedData;

    const visibleSlices = normalizedData.slice(0, maxSlices);
    const otherRevenue = normalizedData
      .slice(maxSlices)
      .reduce((sum, item) => sum + item.revenue, 0);

    if (otherRevenue > 0) {
      visibleSlices.push({ month: "Others", revenue: otherRevenue });
    }

    return visibleSlices;
  }, [data, isCompactRevenueLayout]);

  const renderLegend = ({ payload = [] }) => (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        width: "100%",
        marginTop: 12,
      }}
    >
      <ul
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: isCompactRevenueLayout ? "6px 10px" : "8px 14px",
          listStyle: "none",
          margin: 0,
          padding: 0,
          maxWidth: "100%",
          fontSize: isCompactRevenueLayout ? "10px" : "12px",
          lineHeight: 1.4,
        }}
      >
        {payload.map((entry, index) => (
          <li
            key={`${entry.value}-${index}`}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flex: "0 0 auto",
            }}
          >
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 2,
                backgroundColor: entry.color,
                display: "inline-block",
                marginRight: 6,
                flexShrink: 0,
              }}
            />
            <span>{entry.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md">
      <h3 className="text-lg sm:text-xl font-semibold mb-4 text-center">
        Revenue Analysis
      </h3>

      {/* Bar Chart for Revenue Trend */}
      <ResponsiveContainer width="100%" height={isMobile ? 240 : 300}>
        <BarChart
          data={data}
          margin={{
            top: 10,
            right: 12,
            left: isMobile ? -12 : 0,
            bottom: isMobile ? 16 : 0,
          }}
        >
          <XAxis
            dataKey="month"
            tickFormatter={formatMonthLabel}
            tick={{ fontSize: isMobile ? 10 : 12 }}
            minTickGap={isMobile ? 20 : 8}
            angle={isMobile ? -20 : 0}
            textAnchor={isMobile ? "end" : "middle"}
            height={isMobile ? 44 : 30}
          />
          <YAxis
            width={isMobile ? 28 : 40}
            tick={{ fontSize: isMobile ? 10 : 12 }}
          />
          <Tooltip labelFormatter={formatMonthLabel} />
          <Bar dataKey="revenue" fill="#8884d8" barSize={isMobile ? 28 : 50} />
        </BarChart>
      </ResponsiveContainer>

      {/* Pie Chart for Revenue Distribution */}
      <div className="mt-6 sm:mt-8">
        <ResponsiveContainer
          width="100%"
          height={isCompactRevenueLayout ? 320 : 360}
        >
          <PieChart>
            <Pie
              data={pieData}
              dataKey="revenue"
              nameKey="month"
              cx="50%"
              cy={isCompactRevenueLayout ? "35%" : "42%"}
              innerRadius={isCompactRevenueLayout ? 34 : 58}
              outerRadius={isCompactRevenueLayout ? 62 : 110}
              paddingAngle={2}
              label={false}
              labelLine={false}
            >
              {pieData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={COLORS[index % COLORS.length]}
                />
              ))}
            </Pie>
            <Tooltip />
            <Legend content={renderLegend} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default RevenueChart;
