// frontend/src/WebApp/Flows/AdminFlow/MainPage/SubscriptionOverview.js
import React, { useEffect, useState } from "react";
import { useTabContext } from "./UserHomePageContext/HomePageContext";

// ─── Sub-components ───────────────────────────────────────────────────────────

const StatCard = ({ label, value, sub, colorClass = "text-gray-800" }) => (
  <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
    <p className="text-xs text-gray-400 mb-1">{label}</p>
    <p className={`text-2xl font-semibold ${colorClass}`}>{value ?? "—"}</p>
    {sub && <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>}
  </div>
);

const PlanBar = ({ plan, count, pct }) => (
  <div className="flex items-center gap-3 mb-2">
    <span className="text-sm text-gray-600 w-32 shrink-0 truncate">{plan}</span>
    <div className="flex-1 bg-gray-100 rounded-full h-1.5">
      <div
        className="h-1.5 rounded-full bg-teal-400"
        style={{ width: `${pct}%` }}
      />
    </div>
    <span className="text-sm font-medium text-gray-700 w-8 text-right">{count}</span>
  </div>
);

const SectionPanel = ({ title, stats, planBreakdown, onViewAll, loading }) => (
  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
    <div className="flex items-center justify-between">
      <h2 className="text-base font-semibold text-gray-800">{title}</h2>
      <button
        onClick={onViewAll}
        className="text-xs text-teal-600 hover:text-teal-700 font-medium transition-colors"
      >
        View all →
      </button>
    </div>

    {loading ? (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 animate-pulse">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-16 bg-gray-100 rounded-xl" />
        ))}
      </div>
    ) : (
      <>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {stats.map((s) => (
            <StatCard key={s.label} {...s} />
          ))}
        </div>

        {planBreakdown?.length > 0 && (
          <div>
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Plan breakdown
            </p>
            {planBreakdown.map((p) => (
              <PlanBar key={p.plan} {...p} />
            ))}
          </div>
        )}
      </>
    )}
  </div>
);

// ─── Main component ───────────────────────────────────────────────────────────

const SubscriptionOverview = () => {
  const { handleSelectTab } = useTabContext();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchOverview = async () => {
      try {
        const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:5000";
        const [res, schoolRes] = await Promise.all([
          fetch(`${API_BASE}/api/admin/subscriptions/overview`),
          fetch(`${API_BASE}/api/school-admin/schooladmins`).catch(() => ({ ok: false, json: () => [] }))
        ]);
        
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const result = await res.json();
        
        let schoolAdmins = [];
        if (schoolRes.ok) {
           schoolAdmins = await schoolRes.json();
        }

        if (result.success) {
           const overviewData = result.data;
           
           // Calculate stats for school admins
           const schoolList = Array.isArray(schoolAdmins) ? schoolAdmins : [];
           const totalSchools = schoolList.length;
           const activeCount = schoolList.filter((s) => s.subscriptionStatus === "active").length;
           const inactiveCount = totalSchools - activeCount;
           const totalCreditsBought = schoolList.reduce((sum, s) => sum + (s.creditsTotalReceived ?? s.creditsAvailable ?? 0), 0);
           const totalCreditsRemaining = schoolList.reduce((sum, s) => sum + (s.creditsAvailable ?? 0), 0);
           
           const planMap = {};
           schoolList.forEach((s) => {
             const p = s.plan || "Free Plan";
             planMap[p] = (planMap[p] || 0) + 1;
           });
           const planBreakdown = Object.entries(planMap).map(([plan, count]) => ({
             plan,
             count,
             pct: totalSchools ? Math.round((count / totalSchools) * 100) : 0,
           }));
           
           overviewData.schoolAdmins = {
             total: totalSchools,
             active: activeCount,
             inactive: inactiveCount,
             creditsBought: totalCreditsBought,
             creditsRemaining: totalCreditsRemaining,
             planBreakdown
           };
           
           setData(overviewData);
        } else throw new Error("API returned success: false");
      } catch (err) {
        console.error("Overview fetch failed:", err);
        setError("Failed to load subscription data.");
      } finally {
        setLoading(false);
      }
    };

    fetchOverview();
  }, []);

  const studentStats = data
    ? [
        { label: "Total Students", value: data.students.total, colorClass: "text-gray-800" },
        { label: "Active", value: data.students.active, colorClass: "text-emerald-600" },
        {
          label: "Expiring Soon",
          value: data.students.expiringSoon,
          colorClass: "text-amber-500",
          sub: "Within 7 days",
        },
        { label: "Expired", value: data.students.expired, colorClass: "text-red-500" },
      ]
    : [];

  const partnerStats = data
    ? [
        { label: "Total Partners", value: data.partners.total, colorClass: "text-gray-800" },
        { label: "Active", value: data.partners.active, colorClass: "text-emerald-600" },
        {
          label: "Expiring Soon",
          value: data.partners.expiringSoon,
          colorClass: "text-amber-500",
          sub: "Within 7 days",
        },
        { label: "Expired", value: data.partners.expired, colorClass: "text-red-500" },
      ]
    : [];

  const schoolAdminStats = data && data.schoolAdmins
    ? [
        { label: "Total Schools", value: data.schoolAdmins.total, colorClass: "text-gray-800" },
        { label: "Active Sub.", value: data.schoolAdmins.active, colorClass: "text-emerald-600" },
        { label: "Credits Bought", value: data.schoolAdmins.creditsBought, colorClass: "text-teal-600" },
        { label: "Credits Remaining", value: data.schoolAdmins.creditsRemaining, colorClass: "text-blue-600" },
      ]
    : [];

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-semibold text-gray-800">Subscription Overview</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Real-time snapshot of all student and partner subscription plans
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      {/* Revenue summary */}
      {(loading || data) && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <StatCard
            label="Total Revenue"
            value={data ? `₹${data.revenue.total.toLocaleString("en-IN")}` : "—"}
            colorClass="text-teal-600"
          />
          <StatCard
            label="Revenue from Students"
            value={data ? `₹${data.revenue.fromStudents.toLocaleString("en-IN")}` : "—"}
            colorClass="text-blue-600"
          />
          <StatCard
            label="Revenue from Partners"
            value={data ? `₹${data.revenue.fromPartners.toLocaleString("en-IN")}` : "—"}
            colorClass="text-purple-600"
          />
        </div>
      )}

      {/* New this month */}
      {data && (
        <div className="flex gap-3">
          <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-2.5 flex items-center gap-2">
            <span className="text-emerald-600 font-semibold text-sm">
              +{data.newThisMonth.students}
            </span>
            <span className="text-xs text-emerald-700">new student subscribers this month</span>
          </div>
          <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-2.5 flex items-center gap-2">
            <span className="text-blue-600 font-semibold text-sm">
              +{data.newThisMonth.partners}
            </span>
            <span className="text-xs text-blue-700">new partner subscribers this month</span>
          </div>
        </div>
      )}

      {/* Student panel */}
      <SectionPanel
        title="Student Subscriptions"
        stats={studentStats}
        planBreakdown={data?.students.planBreakdown}
        onViewAll={() => handleSelectTab("student-subscriptions")}
        loading={loading}
      />

      {/* Partner panel */}
      <SectionPanel
        title="Partner Subscriptions"
        stats={partnerStats}
        planBreakdown={data?.partners.planBreakdown}
        onViewAll={() => handleSelectTab("partner-subscriptions")}
        loading={loading}
      />

      {/* School Admin panel */}
      <SectionPanel
        title="School Admin Subscriptions"
        stats={schoolAdminStats}
        planBreakdown={data?.schoolAdmins?.planBreakdown}
        onViewAll={() => handleSelectTab("school-admin-subscriptions")}
        loading={loading}
      />
    </div>
  );
};

export default SubscriptionOverview;