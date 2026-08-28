import React, { useEffect, useState } from "react";

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

const PLAN_COLORS = {
  "Free Plan": "bg-gray-100 text-gray-600",
  "Standard Plan": "bg-blue-100 text-blue-700",
  "Premium Plan": "bg-purple-100 text-purple-700",
  "Premium Plus Plan": "bg-indigo-100 text-indigo-700",
};

const SUB_STATUS_COLORS = {
  active: "bg-emerald-100 text-emerald-700",
  inactive: "bg-red-100 text-red-600",
};

const STATUS_FILTERS = ["All", "Active", "Free"];

const SchoolAdminSubscriptions = () => {
  const [schools, setSchools] = useState([]);
  const [loadingSchools, setLoadingSchools] = useState(true);
  const [schoolError, setSchoolError] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  useEffect(() => {
    const fetchSchools = async () => {
      try {
        const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:5000";
        const res = await fetch(`${API_BASE}/api/school-admin/schooladmins`);
        if (res.status === 404) {
          setSchools([]);
          return;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        setSchools(Array.isArray(json) ? json : []);
      } catch (err) {
        console.error("School admin fetch failed:", err);
        setSchoolError("Failed to load school admin data.");
      } finally {
        setLoadingSchools(false);
      }
    };
    fetchSchools();
  }, []);

  // ── Aggregate stats ──
  const totalSchools = schools.length;
  const activeCount = schools.filter((s) => s.subscriptionStatus === "active").length;
  const inactiveCount = totalSchools - activeCount;
  const totalCreditsBought = schools.reduce(
    (sum, s) => sum + (s.creditsTotalReceived ?? s.creditsAvailable ?? 0),
    0
  );
  const totalCreditsUsed = schools.reduce((sum, s) => sum + (s.creditsUsed ?? 0), 0);
  const totalCreditsRemaining = schools.reduce(
    (sum, s) => sum + (s.creditsAvailable ?? 0),
    0
  );

  // ── Plan breakdown ──
  const planMap = {};
  schools.forEach((s) => {
    const p = s.plan || "Free Plan";
    planMap[p] = (planMap[p] || 0) + 1;
  });
  const planBreakdown = Object.entries(planMap).map(([plan, count]) => ({
    plan,
    count,
    pct: totalSchools ? Math.round((count / totalSchools) * 100) : 0,
  }));

  // ── Compute statuses ──
  const schoolsWithStatus = schools.map((s) => {
    const plan = s.plan || "Free Plan";
    const computedStatus = plan === "Free Plan" ? "Free" : "Active";
    return { ...s, computedStatus };
  });

  const summary = {
    Active: 0,
    Free: 0,
  };
  schoolsWithStatus.forEach((s) => {
    if (summary[s.computedStatus] !== undefined) {
      summary[s.computedStatus]++;
    }
  });

  // ── Filtered table ──
  const filtered = schoolsWithStatus.filter((s) => {
    if (statusFilter !== "All" && s.computedStatus !== statusFilter) return false;
    
    const q = search.toLowerCase();
    return (
      !q ||
      (s.schoolName || "").toLowerCase().includes(q) ||
      (s.email || "").toLowerCase().includes(q) ||
      (s.plan || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-semibold text-gray-800">School Admin Subscriptions &amp; Credits</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Real-time snapshot of all school admin subscription plans and credit usage
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-5">
        {schoolError && (
          <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">
            {schoolError}
          </div>
        )}

        {/* Summary stat cards */}
        {loadingSchools ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 animate-pulse">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-100 rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatCard label="Total Schools" value={totalSchools} colorClass="text-gray-800" />
            <StatCard label="Active Sub." value={activeCount} colorClass="text-emerald-600" />
            <StatCard label="Inactive Sub." value={inactiveCount} colorClass="text-red-500" />
            <StatCard
              label="Credits Bought"
              value={totalCreditsBought.toLocaleString()}
              colorClass="text-teal-600"
              sub="Total received"
            />
            <StatCard
              label="Credits Used"
              value={totalCreditsUsed.toLocaleString()}
              colorClass="text-amber-500"
              sub="Students created"
            />
            <StatCard
              label="Credits Remaining"
              value={totalCreditsRemaining.toLocaleString()}
              colorClass="text-blue-600"
              sub="Available now"
            />
          </div>
        )}

        {/* Plan breakdown bars */}
        {!loadingSchools && planBreakdown.length > 0 && (
          <div>
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Plan breakdown
            </p>
            {planBreakdown.map((p) => (
              <PlanBar key={p.plan} {...p} />
            ))}
          </div>
        )}

        {/* Per-school table */}
        {!loadingSchools && schools.length > 0 && (
          <div>
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Per-school details
            </p>

            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center mb-3">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by school, email or plan…"
                className="w-full sm:w-72 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-300"
              />
              <div className="flex gap-1.5 flex-wrap">
                {STATUS_FILTERS.map((f) => (
                  <button
                    key={f}
                    onClick={() => setStatusFilter(f)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                      statusFilter === f
                        ? "bg-teal-600 text-white border-teal-600"
                        : "bg-white text-gray-600 border-gray-200 hover:border-teal-300 hover:text-teal-600"
                    }`}
                  >
                    {f}
                    {f !== "All" && (
                      <span className="ml-1 opacity-70">
                        ({summary[f] ?? 0})
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-gray-100">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-400">
                    <th className="px-4 py-2.5 text-left font-semibold">#</th>
                    <th className="px-4 py-2.5 text-left font-semibold">School</th>
                    <th className="px-4 py-2.5 text-left font-semibold">Plan</th>
                    <th className="px-4 py-2.5 text-left font-semibold">Sub. Status</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Credits Bought</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Credits Used</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Credits Remaining</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-6 text-center text-gray-400 text-xs">
                        No school admins found.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((s, idx) => {
                      const creditsBought = s.creditsTotalReceived ?? s.creditsAvailable ?? 0;
                      const creditsUsed   = s.creditsUsed ?? 0;
                      const creditsRemaining = s.creditsAvailable ?? 0;
                      const planKey = s.plan || "Free Plan";
                      const subKey  = s.subscriptionStatus || "inactive";
                      return (
                        <tr key={s._id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 text-gray-400">{idx + 1}</td>
                          <td className="px-4 py-3">
                            <p className="font-medium text-gray-800 truncate max-w-[180px]">
                              {s.schoolName || "—"}
                            </p>
                            <p className="text-[11px] text-gray-400 truncate max-w-[180px]">
                              {s.email || ""}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                              PLAN_COLORS[planKey] || "bg-gray-100 text-gray-600"
                            }`}>
                              {planKey}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize ${
                              SUB_STATUS_COLORS[subKey] || "bg-gray-100 text-gray-500"
                            }`}>
                              {subKey}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-teal-600">
                            {creditsBought.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-amber-500">
                            {creditsUsed.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-blue-600">
                            {creditsRemaining.toLocaleString()}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SchoolAdminSubscriptions;
