import React, { useState, useEffect, useCallback } from "react";
import {
  FaEnvelope,
  FaEye,
  FaUsers,
  FaArrowDown,
  FaBriefcase,
  FaFileAlt,
  FaBuilding,
  FaRupeeSign,
  FaSyncAlt,
} from "react-icons/fa";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import axios from "../../api/axiosInstance";

import {
  initialStats,
  categoryTrendsData,
  categoryDistributionData,
} from "./mockAdminData";

const AdminDashboardHome = ({ onSelectTab }) => {
  const todayStr = new Date()
    .toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    })
    .toUpperCase();

  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(() =>
    new Date().toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
  );

  const [stats, setStats] = useState({
    contactsCount: initialStats.contactsCount,
    visitorsCount: initialStats.visitorsCount,
    subscribersCount: initialStats.subscribersCount,
    contactsTrend: initialStats.contactsTrend,
    visitorsTrend: initialStats.visitorsTrend,
    subscribersTrend: initialStats.subscribersTrend,
    internshipsCount: 40,
    applicationsCount: 21,
    partnersCount: 12,
    totalRevenue: initialStats.totalRevenue || 46964,
  });

  const [trends, setTrends] = useState(categoryTrendsData);
  const [distribution, setDistribution] = useState(categoryDistributionData);

  const fetchPlatformStats = useCallback(async (isManual = false) => {
    if (isManual) setLoading(true);
    try {
      const [countsRes, contactsRes, visitorsRes, subsRes, payRes] = await Promise.allSettled([
        axios.get("/api/dashboard/counts"),
        axios.get("/api/contact?pageSize=500"),
        axios.get("/api/contact/visitors"),
        axios.get("/api/contact/subscribers"),
        axios.get("/api/contact/payments"),
      ]);

      const countsData = countsRes.status === "fulfilled" ? countsRes.value.data : null;
      const contactsList =
        contactsRes.status === "fulfilled" && Array.isArray(contactsRes.value.data?.contacts)
          ? contactsRes.value.data.contacts
          : null;
      const visitorsList =
        visitorsRes.status === "fulfilled" && Array.isArray(visitorsRes.value.data?.visitors)
          ? visitorsRes.value.data.visitors
          : null;
      const subsList =
        subsRes.status === "fulfilled" && Array.isArray(subsRes.value.data?.subscribers)
          ? subsRes.value.data.subscribers
          : null;
      const payData = payRes.status === "fulfilled" ? payRes.value.data : null;

      let cCount = 8;
      let vCount = 209;
      let sCount = 38;

      setStats((prev) => {
        cCount = contactsList
          ? contactsList.length
          : contactsRes.status === "fulfilled" && typeof contactsRes.value.data?.total === "number"
          ? contactsRes.value.data.total
          : prev.contactsCount;

        vCount =
          visitorsRes.status === "fulfilled" && typeof visitorsRes.value.data?.total === "number"
            ? visitorsRes.value.data.total
            : visitorsList
            ? visitorsList.length
            : prev.visitorsCount;

        sCount =
          subsRes.status === "fulfilled" && typeof subsRes.value.data?.total === "number"
            ? subsRes.value.data.total
            : subsList
            ? subsList.length
            : prev.subscribersCount;

        const rev = payData?.stats?.totalCollected ?? (countsData?.totalRevenue ?? prev.totalRevenue);

        return {
          ...prev,
          contactsCount: cCount,
          contactsTrend: `${cCount} verified inquiries`,
          visitorsCount: vCount,
          visitorsTrend: `${vCount} real user sessions`,
          subscribersCount: sCount,
          subscribersTrend: `${sCount} verified subscribers`,
          internshipsCount: countsData?.internshipsCount ?? prev.internshipsCount,
          applicationsCount: countsData?.applicationsCount ?? prev.applicationsCount,
          partnersCount: countsData?.partnersCount ?? prev.partnersCount,
          totalRevenue: rev,
        };
      });

      // Dynamic Trends Chart
      setTrends([
        { name: "Contacts", count: cCount },
        { name: "Visitors", count: vCount },
        { name: "Subscribers", count: sCount },
      ]);

      // Dynamic Distribution Pie
      const totalSum = cCount + vCount + sCount;
      if (totalSum > 0) {
        const vPct = Math.round((vCount / totalSum) * 100);
        const sPct = Math.round((sCount / totalSum) * 100);
        const cPct = Math.max(1, 100 - vPct - sPct);

        setDistribution([
          { name: "Visitors", value: vCount, percent: `${vPct}%`, color: "#2563eb" },
          { name: "Subscribers", value: sCount, percent: `${sPct}%`, color: "#ea580c" },
          { name: "Contacts", value: cCount, percent: `${cPct}%`, color: "#7c3aed" },
        ]);
      }

      setLastUpdated(
        new Date().toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
    } catch (err) {
      console.error("Dashboard auto-sync error:", err);
    } finally {
      if (isManual) {
        setTimeout(() => setLoading(false), 350);
      }
    }
  }, []);

  // Initial load + real-time polling every 12 seconds
  useEffect(() => {
    fetchPlatformStats(false);
    const interval = setInterval(() => {
      fetchPlatformStats(false);
    }, 12000);
    return () => clearInterval(interval);
  }, [fetchPlatformStats]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-baseline gap-3">
            <h1 className="text-xl md:text-2xl font-black text-slate-800 tracking-tight">
              DASHBOARD OVERVIEW
            </h1>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {todayStr}
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Live Auto-Sync ({lastUpdated})
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            All-time platform totals, verified metrics, and real-time database activity
          </p>
        </div>

        <button
          onClick={() => fetchPlatformStats(true)}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 rounded-lg text-xs font-semibold shadow-xs transition-colors self-start sm:self-auto cursor-pointer"
          title="Refresh dashboard metrics from database"
        >
          <FaSyncAlt className={`text-xs ${loading ? "animate-spin text-blue-600" : ""}`} />
          <span>{loading ? "Refreshing..." : "Refresh"}</span>
        </button>
      </div>

      {/* 3 Main Metric Cards matching Manager Reference Screenshot */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Contacts Card */}
        <div
          onClick={() => onSelectTab && onSelectTab("ContactUs")}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#1e1b4b] via-[#2e1065] to-[#3b0764] p-5 text-white shadow-lg transition-all duration-200 hover:-translate-y-1 hover:shadow-2xl cursor-pointer group select-none"
          title="Click to view Contact Submissions"
        >
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-slate-300 group-hover:text-white transition-colors">Contacts</span>
            <div className="w-8 h-8 rounded-full bg-white/10 group-hover:bg-white/20 flex items-center justify-center text-slate-200 transition-colors">
              <FaEnvelope size={13} />
            </div>
          </div>
          <div className="mt-3 text-3xl font-black tracking-tight">
            {stats.contactsCount}
          </div>
          <div className="mt-2 text-[11px] text-slate-300 font-medium flex items-center justify-between">
            <span>{stats.contactsTrend}</span>
            <span className="text-[10px] text-slate-400 group-hover:text-white transition-colors font-semibold">View details &rarr;</span>
          </div>
        </div>

        {/* Visitors Card */}
        <div
          onClick={() => onSelectTab && onSelectTab("Visitors")}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#059669] via-[#10b981] to-[#14b8a6] p-5 text-white shadow-lg transition-all duration-200 hover:-translate-y-1 hover:shadow-2xl cursor-pointer group select-none"
          title="Click to view Live Visitors List"
        >
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-emerald-100 group-hover:text-white transition-colors">Visitors</span>
            <div className="w-8 h-8 rounded-full bg-white/20 group-hover:bg-white/30 flex items-center justify-center text-white transition-colors">
              <FaEye size={13} />
            </div>
          </div>
          <div className="mt-3 text-3xl font-black tracking-tight">
            {stats.visitorsCount.toLocaleString()}
          </div>
          <div className="mt-2 text-[11px] text-emerald-100 flex items-center justify-between font-medium">
            <span>{stats.visitorsTrend}</span>
            <span className="text-[10px] text-emerald-200 group-hover:text-white transition-colors font-semibold">View details &rarr;</span>
          </div>
        </div>

        {/* Subscribers Card */}
        <div
          onClick={() => onSelectTab && onSelectTab("Subscribe")}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#dc2626] via-[#ea580c] to-[#f97316] p-5 text-white shadow-lg transition-all duration-200 hover:-translate-y-1 hover:shadow-2xl cursor-pointer group select-none"
          title="Click to view Subscribed Emails"
        >
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-rose-100 group-hover:text-white transition-colors">
              Subscribers
            </span>
            <div className="w-8 h-8 rounded-full bg-white/20 group-hover:bg-white/30 flex items-center justify-center text-white transition-colors">
              <FaUsers size={14} />
            </div>
          </div>
          <div className="mt-3 text-3xl font-black tracking-tight">
            {stats.subscribersCount}
          </div>
          <div className="mt-2 text-[11px] text-rose-100 font-medium flex items-center justify-between">
            <span>{stats.subscribersTrend}</span>
            <span className="text-[10px] text-rose-200 group-hover:text-white transition-colors font-semibold">View details &rarr;</span>
          </div>
        </div>
      </div>

      {/* Secondary Project Statistics Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">
            <FaBriefcase className="text-indigo-600" />
            <span>Active Internships</span>
          </div>
          <div className="text-2xl font-black text-slate-800">
            {stats.internshipsCount}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Job postings in database</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">
            <FaFileAlt className="text-emerald-600" />
            <span>Applications</span>
          </div>
          <div className="text-2xl font-black text-slate-800">
            {stats.applicationsCount}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Student applications submitted</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">
            <FaBuilding className="text-blue-600" />
            <span>Partners</span>
          </div>
          <div className="text-2xl font-black text-slate-800">
            {stats.partnersCount}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Companies & Universities</div>
        </div>

        <div
          onClick={() => onSelectTab && onSelectTab("Payments")}
          className="bg-white border border-slate-200 hover:border-sky-400 rounded-xl p-4 shadow-xs cursor-pointer transition-all hover:-translate-y-0.5 group"
          title="Click to view Payments & Transactions"
        >
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">
            <div className="flex items-center gap-2">
              <FaRupeeSign className="text-amber-600" />
              <span>Total Revenue</span>
            </div>
            <span className="text-[10px] text-sky-500 font-semibold opacity-0 group-hover:opacity-100 transition-opacity">View &rarr;</span>
          </div>
          <div className="text-2xl font-black text-slate-800">
            ₹{stats.totalRevenue.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Completed transactions</div>
        </div>
      </div>

      {/* Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Trends Chart */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-800">Category Trends</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Total count by category
            </p>
          </div>

          <div className="h-64 mt-4 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={trends}
                margin={{ top: 15, right: 20, left: -10, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="name"
                  tickLine={false}
                  axisLine={{ stroke: "#e2e8f0" }}
                  tick={{ fontSize: 11, fill: "#64748b" }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  domain={[0, (dataMax) => Math.ceil(dataMax * 1.25)]}
                />
                <Tooltip
                  formatter={(value) => [Number(value).toLocaleString(), "Count"]}
                  contentStyle={{
                    borderRadius: "0.75rem",
                    border: "1px solid #e2e8f0",
                    fontSize: "12px",
                    boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="#2563eb"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#trendGrad)"
                  dot={{ r: 5, fill: "#2563eb", strokeWidth: 2, stroke: "#fff" }}
                  activeDot={{ r: 7 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category Distribution Chart */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-800">
              Category Distribution
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Proportional breakdown
            </p>
          </div>

          <div className="h-60 mt-2 relative flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={distribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={65}
                  outerRadius={95}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {distribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value, name) => [
                    `${Number(value).toLocaleString()} (${
                      distribution.find((d) => d.name === name)?.percent || ""
                    })`,
                    name,
                  ]}
                  contentStyle={{
                    borderRadius: "0.75rem",
                    border: "1px solid #e2e8f0",
                    fontSize: "12px",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            {/* Center Label */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-xs font-semibold text-slate-500">Visitors</span>
              <span className="text-base font-bold text-slate-800">
                {distribution[0]?.percent || "99%"}
              </span>
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-[11px] text-slate-500">
            <div className="flex items-center gap-4">
              {distribution.map((item) => (
                <div key={item.name} className="flex items-center gap-1.5">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span>
                    {item.name} ({item.percent})
                  </span>
                </div>
              ))}
            </div>
            <span className="text-blue-600 font-medium text-[11px]">
              Edutechex Live DB
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboardHome;
