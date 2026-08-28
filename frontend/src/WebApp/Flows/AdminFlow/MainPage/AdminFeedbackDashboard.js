import React, { useCallback, useEffect, useState } from "react";
import axios from "../../../../api/axiosInstance";
import { useNavigate } from "react-router-dom";

export default function AdminFeedbackDashboard({ flow = "all" }) {
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeRange, setTimeRange] = useState("30d");
  const [exporting, setExporting] = useState(false);
  const API = process.env.REACT_APP_API_URL?.replace(/\/$/, "") || "";

  const fetchSummary = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const url = `${API}/api/feedback/summary?flow=${encodeURIComponent(flow || "all")}&timeRange=${timeRange}`;
      const res = await axios.get(url, { timeout: 10000 });
      setSummary(res.data || null);
    } catch (e) {
      console.error("Failed to load feedback data:", e);
      setError(e.message || "Unable to load data");
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [API, flow, timeRange]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  // Export to CSV using your backend endpoint
  const handleExportCSV = async () => {
    try {
      setExporting(true);
      
      // Use your existing /api/feedback/export endpoint
      const response = await axios.get(`${API}/api/feedback/export`, {
        params: { 
          flow: flow === "all" ? "" : flow, 
          timeRange 
        },
        responseType: 'blob'
      });
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const timestamp = new Date().toISOString().split('T')[0];
      link.setAttribute('download', `feedback_${flow}_${timestamp}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
      alert('Failed to export data. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  // View all feedback
  const handleViewAllFeedback = () => {
    navigate('/admin/feedback');
  };

  // Address top issues
  const handleAddressTopIssues = () => {
    if (!summary?.issuesByFlow) {
      alert('No issues found to address.');
      return;
    }
    
    // Collect all issues
    const allIssues = Object.entries(summary.issuesByFlow).flatMap(([flowType, issues]) =>
      issues.map(issue => ({ ...issue, flowType }))
    ).sort((a, b) => (b.count || 0) - (a.count || 0));
    
    const topIssue = allIssues[0];
    
    if (topIssue) {
      const message = `Top Issue to Address:\n\n"${topIssue.text || 'No description'}"\n\n📊 Reported ${topIssue.count} times by ${topIssue.flowType}s\n📝 Sentiment: ${topIssue.sentiment || 'neutral'}\n\n✅ Suggested Actions:\n1. Investigate this issue\n2. Create a task for the development team\n3. Contact affected users if needed\n4. Schedule a follow-up review`;
      
      if (window.confirm(message)) {
        // You can open a task creation modal or navigate to task management
        console.log('Creating task for issue:', topIssue);
      }
    } else {
      alert('No issues found to address.');
    }
  };

  // Schedule review
  const handleScheduleReview = () => {
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    
    const message = `Schedule Feedback Review Meeting\n\n📅 Suggested: ${nextWeek.toLocaleDateString()} at 2:00 PM (30 min)\n\n📋 Agenda:\n1. Review feedback trends\n2. Discuss top issues\n3. Plan improvements\n\nCreate calendar event?`;
    
    if (window.confirm(message)) {
      // Create Google Calendar event
      const startDate = new Date(nextWeek);
      startDate.setHours(14, 0, 0);
      const endDate = new Date(startDate);
      endDate.setHours(14, 30, 0);
      
      const formatDateForCalendar = (date) => {
        return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
      };
      
      const calendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=Feedback+Review+Meeting&details=Monthly+feedback+review+and+planning&dates=${formatDateForCalendar(startDate)}/${formatDateForCalendar(endDate)}`;
      window.open(calendarUrl, '_blank');
    }
  };

  // Export summary as Excel/CSV (client-side)
  const handleExportSummary = () => {
    if (!summary) return;
    
    try {
      // Prepare data for export
      const exportData = [];
      
      // Header
      exportData.push(['FEEDBACK ANALYTICS SUMMARY', '', '', '']);
      exportData.push(['Generated:', new Date().toLocaleString(), '', '']);
      exportData.push(['Period:', timeRange.replace('d', ' days'), '', '']);
      exportData.push(['Flow:', flow === "all" ? "All" : flow, '', '']);
      exportData.push([]);
      
      // Key Metrics
      exportData.push(['KEY METRICS', '', '', '']);
      exportData.push(['Total Feedback', summary.total || 0, '', '']);
      exportData.push(['Average Rating', summary.avgOverall?.toFixed(1) || "—", '', '/5']);
      exportData.push(['NPS Score', summary.avgNps?.toFixed(1) || "—", '', '/10']);
      exportData.push([]);
      
      // Rating Distribution
      exportData.push(['RATING DISTRIBUTION', 'Count', 'Percentage', '']);
      const ratingCounts = Array.isArray(summary.ratingCounts) ? summary.ratingCounts : [];
      const totalRatings = ratingCounts.reduce((a, b) => a + b, 0);
      [5, 4, 3, 2, 1].forEach((star, index) => {
        const count = ratingCounts[star - 1] || 0;
        const percentage = totalRatings > 0 ? Math.round((count / totalRatings) * 100) : 0;
        exportData.push([`${star} stars`, count, `${percentage}%`, '']);
      });
      exportData.push([]);
      
      // By Flow
      exportData.push(['FEEDBACK BY USER TYPE', 'Count', 'Percentage', 'Average Rating']);
      summary.byFlow?.forEach(flowData => {
        exportData.push([
          flowData._id?.charAt(0).toUpperCase() + flowData._id?.slice(1) || "Unknown",
          flowData.count || 0,
          `${Math.round((flowData.count / summary.total) * 100)}%`,
          flowData.avgOverall?.toFixed(1) || "—"
        ]);
      });
      exportData.push([]);
      
      // Top Issues
      exportData.push(['TOP ISSUES', 'User Type', 'Count', 'Sentiment']);
      Object.entries(summary.issuesByFlow || {}).forEach(([flowType, issues]) => {
        issues.slice(0, 5).forEach(issue => {
          exportData.push([
            issue.text?.substring(0, 100) || "No text",
            flowType,
            issue.count || 0,
            issue.sentiment || 'neutral'
          ]);
        });
      });
      
      // Create CSV
      let csvContent = "data:text/csv;charset=utf-8,";
      exportData.forEach(row => {
        csvContent += row.map(cell => `"${cell}"`).join(",") + "\r\n";
      });
      
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `feedback_summary_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Summary export failed:', err);
      alert('Failed to export summary.');
    }
  };

  // Helper functions
  const formatNumber = (num) => {
    if (num === undefined || num === null) return "—";
    return num.toLocaleString();
  };

  const getRatingColor = (rating) => {
    if (rating >= 4) return "text-green-600 bg-green-50 border-green-200";
    if (rating >= 3) return "text-yellow-600 bg-yellow-50 border-yellow-200";
    return "text-red-600 bg-red-50 border-red-200";
  };

  const getSentimentLabel = (score) => {
    if (score >= 80) return "Excellent";
    if (score >= 60) return "Good";
    if (score >= 40) return "Fair";
    return "Needs Attention";
  };

  const getSentimentColor = (score) => {
    if (score >= 80) return "text-green-700 bg-green-100";
    if (score >= 60) return "text-green-600 bg-green-50";
    if (score >= 40) return "text-yellow-600 bg-yellow-50";
    return "text-red-600 bg-red-50";
  };

  // Calculate sentiment score
  const calculateSentiment = () => {
    if (!summary) return 0;
    const counts = Array.isArray(summary.ratingCounts) ? summary.ratingCounts : [];
    const totalRatings = counts.reduce((sum, count) => sum + (count || 0), 0);
    if (totalRatings === 0) return 50;
    
    const positive = (counts[4] || 0) + (counts[3] || 0);
    return Math.round((positive / totalRatings) * 100);
  };

  const sentimentScore = calculateSentiment();

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 md:p-6">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-64 mb-8"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-32 bg-gray-200 rounded-xl"></div>
              ))}
            </div>
            <div className="h-64 bg-gray-200 rounded-xl mb-8"></div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="h-96 bg-gray-200 rounded-xl"></div>
              <div className="h-96 bg-gray-200 rounded-xl"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-8 flex items-center justify-center">
        <div className="bg-white rounded-xl p-8 max-w-md w-full text-center shadow-lg">
          <div className="text-red-500 text-4xl mb-4">⚠️</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Failed to Load Data</h3>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={fetchSummary}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // No data state
  if (!summary) {
    return (
      <div className="min-h-screen bg-gray-50 p-8 flex items-center justify-center">
        <div className="bg-white rounded-xl p-8 max-w-md w-full text-center shadow-lg">
          <div className="text-gray-400 text-4xl mb-4">📊</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No Feedback Data</h3>
          <p className="text-gray-600">No feedback has been collected yet for the selected period.</p>
        </div>
      </div>
    );
  }

  const { total = 0, avgOverall = 0, avgNps = 0, ratingCounts = [], byFlow = [], issuesByFlow = {} } = summary;

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Feedback Dashboard</h1>
              <p className="text-gray-600 mt-1">
                Understanding user experience across {flow === "all" ? "all platforms" : flow}
              </p>
            </div>
            
            <div className="flex items-center space-x-3 mt-4 md:mt-0">
              <select 
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="90d">Last 90 days</option>
                <option value="1y">Last year</option>
              </select>
              
              <button
                onClick={fetchSummary}
                className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm flex items-center"
              >
                <span className="mr-2">↻</span> Refresh
              </button>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="bg-white rounded-xl p-5 shadow border border-gray-200">
              <div className="text-sm text-gray-500 mb-1">Total Feedback</div>
              <div className="text-3xl font-bold text-gray-900">{formatNumber(total)}</div>
              <div className="text-sm text-gray-500 mt-2">Responses collected</div>
            </div>

            <div className="bg-white rounded-xl p-5 shadow border border-gray-200">
              <div className="text-sm text-gray-500 mb-1">Average Rating</div>
              <div className={`text-3xl font-bold ${getRatingColor(avgOverall)} px-3 py-1 rounded-lg inline-block`}>
                {avgOverall.toFixed(1)}/5
              </div>
              <div className="flex items-center mt-2">
                {[1, 2, 3, 4, 5].map(star => (
                  <span key={star} className={`text-lg ${star <= Math.round(avgOverall) ? 'text-yellow-400' : 'text-gray-300'}`}>
                    ★
                  </span>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl p-5 shadow border border-gray-200">
              <div className="text-sm text-gray-500 mb-1">NPS Score</div>
              <div className="text-3xl font-bold text-gray-900">{avgNps.toFixed(1)}/10</div>
              <div className="text-sm text-gray-500 mt-2">
                {avgNps >= 9 ? "Promoters" : avgNps >= 7 ? "Passive" : "Detractors"}
              </div>
            </div>

            <div className="bg-white rounded-xl p-5 shadow border border-gray-200">
              <div className="text-sm text-gray-500 mb-1">Overall Sentiment</div>
              <div className="text-3xl font-bold text-gray-900">{sentimentScore}%</div>
              <div className={`text-sm font-medium px-2 py-1 rounded-full inline-block ${getSentimentColor(sentimentScore)}`}>
                {getSentimentLabel(sentimentScore)}
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column */}
          <div className="space-y-6">
            {/* Rating Distribution */}
            <div className="bg-white rounded-xl p-6 shadow border border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Rating Distribution</h2>
              <div className="space-y-3">
                {[5, 4, 3, 2, 1].map(star => {
                  const count = ratingCounts[star - 1] || 0;
                  const totalRatings = ratingCounts.reduce((a, b) => a + b, 0);
                  const percentage = totalRatings > 0 ? Math.round((count / totalRatings) * 100) : 0;
                  
                  return (
                    <div key={star} className="flex items-center">
                      <div className="w-16">
                        <div className="flex items-center">
                          <span className="text-yellow-400 mr-1">★</span>
                          <span className="text-gray-700 font-medium">{star}</span>
                        </div>
                      </div>
                      <div className="flex-1 ml-4">
                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${
                              star >= 4 ? 'bg-green-500' : 
                              star === 3 ? 'bg-yellow-500' : 
                              'bg-red-500'
                            } rounded-full transition-all duration-500`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                      <div className="w-20 text-right">
                        <span className="text-gray-900 font-medium">{count}</span>
                        <span className="text-gray-500 text-sm ml-1">({percentage}%)</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* User Type Breakdown */}
            <div className="bg-white rounded-xl p-6 shadow border border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Feedback by User Type</h2>
              <div className="space-y-4">
                {byFlow.map((flowData, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg">
                    <div className="flex items-center">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center mr-3 ${
                        flowData._id === "student" ? "bg-blue-100 text-blue-600" :
                        flowData._id === "partner" ? "bg-green-100 text-green-600" :
                        "bg-purple-100 text-purple-600"
                      }`}>
                        <span className="font-bold">{flowData._id?.charAt(0).toUpperCase() || "U"}</span>
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 capitalize">{flowData._id || "Unknown"}</div>
                        <div className="text-sm text-gray-500">
                          Avg: <span className={`font-medium ${getRatingColor(flowData.avgOverall)}`}>
                            {flowData.avgOverall?.toFixed(1) || "—"}/5
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-gray-900">{flowData.count || 0}</div>
                      <div className="text-sm text-gray-500">
                        {total > 0 ? Math.round(((flowData.count || 0) / total) * 100) : 0}% of total
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Top Issues */}
         <div className="bg-white rounded-xl p-6 shadow border border-gray-200">
  <h2 className="text-lg font-semibold text-gray-900 mb-4">Top Issues Reported</h2>
  
  <div className="space-y-6 max-h-[500px] overflow-y-auto pr-2">
    {Object.entries(issuesByFlow).map(([flowType, issues]) => {
      // Only show flow type if it has issues
      if (!issues || issues.length === 0) return null;
      
      return (
        <div key={flowType} className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
          {/* Flow Header */}
          <div className="flex items-center justify-between mb-3 sticky top-0 bg-white py-2">
            <div className="flex items-center">
              <div className={`w-3 h-3 rounded-full mr-3 ${
                flowType === "student" ? "bg-blue-500" :
                flowType === "user" ? "bg-blue-500" :
                flowType === "partner" ? "bg-green-500" :
                "bg-purple-500"
              }`} />
              <div>
                <span className="font-semibold text-gray-900 capitalize">
                  {flowType === "user" ? "Students" : 
                   flowType === "partner" ? "Partners" : 
                   flowType === "schoolAdmin" ? "School Admins" : flowType}
                </span>
                <span className="ml-2 text-sm text-gray-500">
                  ({issues.length} issue{issues.length !== 1 ? 's' : ''})
                </span>
              </div>
            </div>
            <div className="text-sm text-gray-500">
              {issues.reduce((total, issue) => total + (issue.count || 1), 0)} total reports
            </div>
          </div>
          
          {/* Issues List */}
          <div className="space-y-3 ml-6">
            {issues.slice(0, 5).map((issue, idx) => (
              <div key={idx} className="group p-3 border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-sm transition-all">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center">
                    <div className={`w-2 h-2 rounded-full mr-2 ${
                      issue.sentiment === "negative" ? "bg-red-500" :
                      issue.sentiment === "positive" ? "bg-green-500" :
                      "bg-blue-500"
                    }`} />
                    <div className={`px-2 py-1 text-xs font-medium rounded ${
                      issue.sentiment === "negative" ? "bg-red-50 text-red-800 border border-red-100" :
                      issue.sentiment === "positive" ? "bg-green-50 text-green-800 border border-green-100" :
                      "bg-blue-50 text-blue-800 border border-blue-100"
                    }`}>
                      {issue.sentiment === "negative" ? "Problem" : 
                       issue.sentiment === "positive" ? "Improvement" : "Suggestion"}
                    </div>
                    <div className="ml-2 text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                      {issue.count} report{issue.count !== 1 ? 's' : ''}
                    </div>
                  </div>
                  <span className="text-xs text-gray-400 group-hover:text-gray-600">
                    #{idx + 1}
                  </span>
                </div>
                
                <p className="text-gray-800 text-sm font-medium mb-1">
                  {issue.text || "No description provided"}
                </p>
                
                {/* Show short text if available */}
                {issue.text && issue.text.length > 100 && (
                  <div className="mt-1">
                    <p className="text-gray-600 text-sm line-clamp-2">
                      {issue.text.substring(0, 150)}
                      {issue.text.length > 150 && "..."}
                    </p>
                  </div>
                )}
              </div>
            ))}
            
            {/* Show "view more" if there are more issues */}
            {issues.length > 5 && (
              <div className="text-center pt-2">
                <button 
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                  onClick={() => {
                    // You could add expand functionality here
                    console.log(`View all ${flowType} issues`);
                  }}
                >
                  + {issues.length - 5} more issue{issues.length - 5 !== 1 ? 's' : ''}
                </button>
              </div>
            )}
          </div>
        </div>
      );
    })}
    
    {/* No issues state */}
    {Object.keys(issuesByFlow).length === 0 && (
      <div className="text-center py-8">
        <div className="text-gray-400 text-4xl mb-3">🎉</div>
        <p className="text-gray-500">No issues reported in this period</p>
        <p className="text-sm text-gray-400 mt-1">Great job!</p>
      </div>
    )}
  </div>
  
  {/* Summary footer */}
  <div className="mt-4 pt-4 border-t border-gray-200">
    <div className="flex justify-between items-center text-sm">
      <div className="text-gray-600">
        Showing issues from {Object.keys(issuesByFlow).length} user group{Object.keys(issuesByFlow).length !== 1 ? 's' : ''}
      </div>
      <div className="flex space-x-2">
        <div className="flex items-center">
          <div className="w-2 h-2 rounded-full bg-red-500 mr-1"></div>
          <span className="text-xs text-gray-500">Problems</span>
        </div>
        <div className="flex items-center">
          <div className="w-2 h-2 rounded-full bg-blue-500 mr-1"></div>
          <span className="text-xs text-gray-500">Suggestions</span>
        </div>
        <div className="flex items-center">
          <div className="w-2 h-2 rounded-full bg-green-500 mr-1"></div>
          <span className="text-xs text-gray-500">Improvements</span>
        </div>
      </div>
    </div>
  </div>
</div>

            {/* Key Insights */}
            <div className="bg-white rounded-xl p-6 shadow border border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Key Insights</h2>
              <div className="space-y-4">
                {/* Overall Sentiment */}
                <div className="flex items-start">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                    <span className="text-blue-600">📈</span>
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">Overall Sentiment</div>
                    <div className="text-sm text-gray-600">
                      {sentimentScore >= 80 
                        ? "Users are highly satisfied with their experience."
                        : sentimentScore >= 60
                        ? "Users are generally satisfied but there's room for improvement."
                        : "Attention needed to improve user experience."}
                    </div>
                  </div>
                </div>

                {/* Top Rating */}
                <div className="flex items-start">
                  <div className="flex-shrink-0 w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center mr-3">
                    <span className="text-green-600">⭐</span>
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">Average Rating</div>
                    <div className="text-sm text-gray-600">
                      {avgOverall >= 4 
                        ? "Excellent overall rating from users."
                        : "Average rating indicates areas for improvement."}
                    </div>
                  </div>
                </div>

                {/* Most Active Group */}
                {byFlow.length > 0 && (
                  <div className="flex items-start">
                    <div className="flex-shrink-0 w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center mr-3">
                      <span className="text-purple-600">👥</span>
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">Most Active User Group</div>
                      <div className="text-sm text-gray-600">
                        {byFlow.reduce((max, flow) => (flow.count || 0) > (max.count || 0) ? flow : max, byFlow[0])._id}s 
                        are providing the most feedback ({Math.round((byFlow[0].count / total) * 100)}% of total).
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-xl p-6 shadow border border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button 
                  onClick={handleExportCSV}
                  disabled={exporting || !summary}
                  className={`px-4 py-3 rounded-lg transition-colors text-sm font-medium flex items-center justify-center ${
                    exporting || !summary
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                  }`}
                >
                  {exporting ? (
                    <>
                      <svg className="animate-spin h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Exporting...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Export to CSV
                    </>
                  )}
                </button>
                
                <button 
                  onClick={handleViewAllFeedback}
                  className="px-4 py-3 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors text-sm font-medium flex items-center justify-center"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  View All Feedback
                </button>
                
                <button 
                  onClick={handleAddressTopIssues}
                  disabled={!summary?.issuesByFlow || Object.keys(summary.issuesByFlow).length === 0}
                  className={`px-4 py-3 rounded-lg transition-colors text-sm font-medium flex items-center justify-center ${
                    !summary?.issuesByFlow || Object.keys(summary.issuesByFlow).length === 0
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-red-50 text-red-700 hover:bg-red-100'
                  }`}
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.998-.833-2.732 0L4.346 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  Address Top Issues
                </button>
                
                <button 
                  onClick={handleScheduleReview}
                  className="px-4 py-3 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition-colors text-sm font-medium flex items-center justify-center"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Schedule Review
                </button>
                
                <button 
                  onClick={handleExportSummary}
                  disabled={!summary}
                  className={`px-4 py-3 rounded-lg transition-colors text-sm font-medium flex items-center justify-center ${
                    !summary
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100'
                  }`}
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Export Summary
                </button>
              </div>
              
              {exporting && (
                <div className="mt-4 text-sm text-gray-500 text-center">
                  Preparing your export... This may take a moment.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <div className="flex flex-col md:flex-row justify-between items-center text-sm text-gray-500">
            <div>
              Last updated: {new Date().toLocaleString('en-US', { 
                dateStyle: 'medium', 
                timeStyle: 'short' 
              })}
            </div>
            <div className="mt-2 md:mt-0">
              Showing data for the last {timeRange.replace('d', ' days').replace('m', ' months').replace('y', ' year')}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
