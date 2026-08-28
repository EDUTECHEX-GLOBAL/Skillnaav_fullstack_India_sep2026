import React, { useState, useEffect, useCallback } from "react";
import axios from "../../../../api/axiosInstance";

// FIX 1: Server-side price map mirrored on frontend for display only.
// The server derives the real price from planType — this is only for UI rendering.
const PLAN_PRICES = {
  "Free": 0,
  "Premium Basic": 2.99,
  "Premium Plus": 6.99,
};

function PremiumPage() {
  const [alert, setAlert] = useState({ show: false, message: "", type: "" });
  const [isPremium, setIsPremium] = useState(false);
  const [planType, setPlanType] = useState("Free");
  const [premiumExpiration, setPremiumExpiration] = useState(null);
  const [sdkReady, setSdkReady] = useState(false);
  const [selectedPlanIndex, setSelectedPlanIndex] = useState(null);
  const [selectedPlanType, setSelectedPlanType] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  // FIX 2: Separate loading state for initial data fetch
  const [isFetching, setIsFetching] = useState(true);
  // FIX 3: Payment history state
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  // FIX 4: Track expiry warning (within 3 days)
  const [expiryWarning, setExpiryWarning] = useState(false);

  // ─── Fetch premium status on mount ───
  useEffect(() => {
    const fetchPremiumStatus = async () => {
      setIsFetching(true);
      try {
        const token = localStorage.getItem("userToken");
        if (!token) { setIsFetching(false); return; }

        const { data } = await axios.get("/api/users/premium-status", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (data.success && data.user) {
          const updatedUser = {
            ...((JSON.parse(localStorage.getItem("studentInfo")) || JSON.parse(localStorage.getItem("userInfo"))) || {}),
            isPremium: data.user.isPremium,
            planType: data.user.planType,
            premiumExpiration: data.user.premiumExpiration,
          };
          localStorage.setItem("studentInfo", JSON.stringify(updatedUser));
          setIsPremium(data.user.isPremium);
          setPlanType(data.user.planType || "Free");
          setPremiumExpiration(data.user.premiumExpiration || null);

          // FIX 4: Check if expiry is within 3 days
          if (data.user.premiumExpiration) {
            const expMs = new Date(data.user.premiumExpiration).getTime();
            const daysLeft = (expMs - Date.now()) / (1000 * 60 * 60 * 24);
            setExpiryWarning(daysLeft > 0 && daysLeft <= 3);
          }
        }
      } catch (err) {
        console.error("Failed to fetch premium status:", err);
      } finally {
        setIsFetching(false);
      }
    };

    fetchPremiumStatus();
  }, []);

  // ─── Load PayPal SDK ───
  useEffect(() => {
    if (!process.env.REACT_APP_PAYPAL_CLIENT_ID) {
      setAlert({ show: true, message: "PayPal Client ID not set. Please check your .env file.", type: "error" });
      return;
    }
    if (window.paypal) { setSdkReady(true); return; }

    const script = document.createElement("script");
    script.src = `https://www.paypal.com/sdk/js?client-id=${process.env.REACT_APP_PAYPAL_CLIENT_ID}&currency=USD`;
    script.async = true;
    script.onload = () => setSdkReady(true);
    script.onerror = () => {
      setAlert({ show: true, message: "Failed to load PayPal SDK. Check your Client ID.", type: "error" });
    };
    document.body.appendChild(script);
    return () => { if (document.body.contains(script)) document.body.removeChild(script); };
  }, []);

  // ─── Render PayPal Buttons ───
  useEffect(() => {
    if (selectedPlanIndex === null || !selectedPlanType || !sdkReady) return;

    const containerId = `paypal-button-container-${selectedPlanIndex}`;
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = "";

    window.paypal
      .Buttons({
        createOrder: async () => {
          try {
            const token = localStorage.getItem("userToken");
            // FIX 5: Only send planType — server derives amount and duration
            const orderRes = await axios.post(
              "/api/payments/paypal/order",
              { planType: selectedPlanType },
              { headers: { Authorization: `Bearer ${token}` } }
            );
            return orderRes.data.id;
          } catch (err) {
            console.error("Create order failed:", err);
            showAlert("Unable to create PayPal order.", "error");
            throw err;
          }
        },

        onApprove: async (data, actions) => {
          setIsProcessing(true);
          try {
            const token = localStorage.getItem("userToken");
            // FIX 5: Only send orderID and planType — server derives everything else
            const verifyRes = await axios.post(
              "/api/payments/paypal/verify",
              {
                orderID: data.orderID,
                planType: selectedPlanType,
              },
              { headers: { Authorization: `Bearer ${token}` } }
            );

            if (verifyRes.data.success) {
              showAlert("Payment verified successfully! Check your email for a receipt.", "success");

              // Clear stale billing history so UI will refetch on next open
              setPaymentHistory([]);
              setShowHistory(false);

              const userInfo = (JSON.parse(localStorage.getItem("studentInfo")) || JSON.parse(localStorage.getItem("userInfo"))) || {};
              const updatedUser = {
                ...userInfo,
                isPremium: true,
                planType: verifyRes.data.user.planType,
                premiumExpiration: verifyRes.data.user.premiumExpiration,
              };
              localStorage.setItem("studentInfo", JSON.stringify(updatedUser));

              setIsPremium(true);
              setPlanType(updatedUser.planType);
              setPremiumExpiration(updatedUser.premiumExpiration);
              setSelectedPlanIndex(null);
              setSelectedPlanType(null);
              setExpiryWarning(false);
              window.dispatchEvent(new Event("userInfoUpdated"));
            } else {
              showAlert("Payment verification failed. Please contact support.", "error");
            }
          } catch (err) {
            const issue =
              err.response?.data?.details?.details?.[0]?.issue ||
              err.response?.data?.details?.[0]?.issue;

            if (issue === "INSTRUMENT_DECLINED") {
              setIsProcessing(false);
              showAlert("Your card was declined. Please try a different payment method.", "error");
              return actions.restart();
            }

            console.error("Verify failed:", err);
            showAlert("Payment failed. Please try again or contact support.", "error");
          } finally {
            setIsProcessing(false);
          }
        },

        onError: (err) => {
          console.error("PayPal button error:", err);
          showAlert("PayPal encountered an error. Please try again.", "error");
          setIsProcessing(false);
        },

        onCancel: () => {
          showAlert("Payment cancelled.", "error");
          setSelectedPlanIndex(null);
          setSelectedPlanType(null);
        },
      })
      .render(`#${containerId}`);
  }, [selectedPlanIndex, selectedPlanType, sdkReady]);

  const showAlert = (message, type) => {
    setAlert({ show: true, message, type });
    setTimeout(() => setAlert({ show: false, message: "", type: "" }), 6000);
  };

  // FIX 3: Free plan no longer goes through PayPal
  const handleFreePlan = async () => {
    showAlert("You are on the Free plan. No payment needed!", "success");
  };

  const handlePayment = (planTypeStr, index) => {
    // FIX 6: Free plan bypasses PayPal entirely
    if (planTypeStr === "Free") { handleFreePlan(); return; }

    if (!sdkReady) {
      showAlert("PayPal is still loading. Try again shortly.", "error");
      return;
    }
    const userInfo = (JSON.parse(localStorage.getItem("studentInfo")) || JSON.parse(localStorage.getItem("userInfo")));
    if (!userInfo?._id) {
      showAlert("User session not found. Please log in again.", "error");
      return;
    }
    // FIX 5: Store only planType — no amount passed to server from here
    setSelectedPlanIndex(index);
    setSelectedPlanType(planTypeStr);
  };

  // FIX 3: Fetch payment history
  const fetchPaymentHistory = async () => {
    setLoadingHistory(true);
    try {
      const token = localStorage.getItem("userToken");
      const { data } = await axios.get("/api/payments/history", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (data.success) setPaymentHistory(data.payments || []);
    } catch (err) {
      console.error("Failed to fetch payment history:", err);
      showAlert("Failed to load payment history.", "error");
    } finally {
      setLoadingHistory(false);
    }
  };

  const toggleHistory = () => {
    if (!showHistory && paymentHistory.length === 0) fetchPaymentHistory();
    setShowHistory((prev) => !prev);
  };

  const pricingcard = [
    {
      plantype: "Free",
      plantypesubhead: "Basic access to explore internships",
      price: "$0",
      duration: "30",
      durationLabel: "30 days",
      pricebtn: "Start Free",
      pricepoint1: "Apply to 5 internships",
      pricepoint2: "Save 3 internships",
      pricepoint3: "Basic AI suggestions",
    },
    {
      plantype: "Premium Basic",
      plantypesubhead: "Tools for active internship seekers",
      price: "$2.99",
      duration: "2",
      durationLabel: "2 days",
      pricebtn: "Subscribe",
      pricepoint1: "Apply up to 25 internships",
      pricepoint2: "Resume builder + career assistant",
      pricepoint3: "Monthly mentorship + interview tips",
    },
    {
      plantype: "Premium Plus",
      plantypesubhead: "Everything you need to succeed",
      price: "$6.99",
      duration: "7",
      durationLabel: "7 days",
      pricebtn: "Subscribe",
      pricepoint1: "Unlimited applications & saves",
      pricepoint2: "Mock AI interviews & resume AI",
      pricepoint3: "Mentorship + full AI insights",
    },
  ];

  const getBannerData = () => {
    const rawExp = premiumExpiration;
    const expDate = rawExp ? new Date(rawExp?.$date || rawExp) : null;
    const now = new Date();
    let timeLeftText = "Expired";

    if (expDate && !isNaN(expDate) && expDate > now) {
      const diff = expDate - now;
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      timeLeftText = `${days}d ${hours}h ${mins}m`;
    }
    return { expDate, timeLeftText };
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleString("en-IN", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  };

  const getStatusBadge = (status) => {
    const map = {
      Success: "bg-green-100 text-green-700",
      Pending: "bg-yellow-100 text-yellow-700",
      Failed: "bg-red-100 text-red-700",
      Refunded: "bg-gray-100 text-gray-600",
    };
    return map[status] || "bg-gray-100 text-gray-600";
  };

  // ─── Loading skeleton ───
  if (isFetching) {
    return (
      <div className="py-12 my-12 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <svg className="animate-spin h-8 w-8 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
          <p className="text-gray-500 text-sm">Loading your plan details...</p>
        </div>
      </div>
    );
  }

  return (
    <div id="pricing" className="py-12 my-12 pb-12 lg:py-16 relative">

      {/* Alert */}
      {alert.show && (
        <div
          className={`fixed top-4 right-4 border-l-4 p-4 ${
            alert.type === "success"
              ? "bg-green-100 border-green-400 text-green-700"
              : "bg-red-100 border-red-400 text-red-700"
          } rounded-lg shadow-lg z-50 max-w-sm`}
          role="alert"
        >
          <p className="font-medium text-sm">{alert.message}</p>
        </div>
      )}

      {/* Processing overlay */}
      {isProcessing && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 shadow-xl flex flex-col items-center gap-3">
            <svg className="animate-spin h-8 w-8 text-purple-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            <p className="text-gray-700 font-medium">Verifying payment…</p>
            <p className="text-gray-400 text-sm">Do not close this window</p>
          </div>
        </div>
      )}

      {/* FIX 4: Expiry warning banner */}
      {isPremium && expiryWarning && (
        <div className="max-w-7xl mx-auto mb-6">
          <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 flex items-center gap-3">
            <span className="text-amber-500 text-xl">⚠</span>
            <p className="text-amber-800 text-sm font-medium">
              Your <strong>{planType}</strong> subscription expires soon. Renew now to avoid losing access.
            </p>
          </div>
        </div>
      )}

      {/* Header row */}
      <div className="max-w-7xl mx-auto mb-10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-50 border border-indigo-200 mb-4">
            <span className="w-2 h-2 bg-indigo-500 rounded-full"></span>
            <span className="text-xs font-bold tracking-widest text-indigo-600 uppercase">Student Premium Plans</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900">Choose Your Student Plan</h1>
          <div className="w-20 h-1 bg-gradient-to-r from-indigo-500 to-purple-500 mt-3 rounded-full"></div>
        </div>

        {/* Active plan banner */}
        {isPremium && (() => {
          const { expDate, timeLeftText } = getBannerData();
          return (
            <div className="w-full lg:w-auto bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row gap-6 items-start sm:items-center">
              <div>
                <p className="text-xs font-bold tracking-widest text-purple-600 uppercase mb-1">Premium Active</p>
                <h2 className="text-xl font-bold text-purple-700">{planType}</h2>
              </div>
              <div className="hidden sm:block w-px h-10 bg-purple-200"></div>
              <div>
                <p className="text-[10px] font-bold text-gray-500 uppercase">Time Left</p>
                <p className="text-sm font-bold text-purple-700">{timeLeftText}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-500 uppercase">Expires On</p>
                <p className="text-sm font-semibold text-gray-700">
                  {expDate && !isNaN(expDate)
                    ? expDate.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
                    : "N/A"}
                </p>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Pricing cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
        {pricingcard.map((card, index) => {
          const isCurrentActivePlan = isPremium && card.plantype === planType;

          const themes = [
            { bg: "from-green-50 to-green-100", border: "border-green-200", title: "text-green-700", price: "text-green-900", btn: "bg-white text-green-700 border-2 border-green-400 hover:bg-green-50" },
            { bg: "from-purple-50 to-purple-100", border: "border-purple-200", title: "text-purple-700", price: "text-purple-900", btn: "bg-white text-purple-700 border-2 border-purple-400 hover:bg-purple-50" },
            { bg: "from-orange-50 to-orange-100", border: "border-orange-200", title: "text-orange-700", price: "text-orange-900", btn: "bg-white text-orange-700 border-2 border-orange-400 hover:bg-orange-50" },
          ];
          const theme = themes[index % themes.length];

          return (
            <div key={index} className={`bg-gradient-to-b ${theme.bg} border-2 ${theme.border} rounded-3xl p-8 flex flex-col justify-between transition-all hover:shadow-xl hover:scale-105`}>
              <div>
                <h3 className={`text-2xl font-bold ${theme.title} mb-4`}>{card.plantype}</h3>
                <p className="text-gray-600 text-sm mb-4">{card.plantypesubhead}</p>
                <p className={`text-5xl font-bold ${theme.price} mb-2`}>{card.price}</p>
                <p className="text-sm text-gray-600 mb-6">Duration: {card.durationLabel}</p>
                <div className="border-t border-gray-200 my-4"></div>
                <ul className="space-y-3">
                  {[card.pricepoint1, card.pricepoint2, card.pricepoint3].map((point, i) =>
                    point && (
                      <li key={i} className="flex items-center gap-2 text-sm text-gray-700">
                        <span className="text-green-500">✔</span>{point}
                      </li>
                    )
                  )}
                </ul>
              </div>

              <button
                onClick={() => handlePayment(card.plantype, index)}
                disabled={(isCurrentActivePlan && card.plantype === "Free") || isProcessing}
                className={`mt-8 py-3 rounded-lg font-semibold transition-all ${theme.btn} ${
                  (isCurrentActivePlan && card.plantype === "Free") ? "opacity-60 cursor-not-allowed" : ""
                }`}
              >
                {isCurrentActivePlan 
                  ? (card.plantype === "Free" ? "✓ Subscribed" : "Subscribe Again") 
                  : card.pricebtn}
              </button>

              {selectedPlanIndex === index && (
                <div id={`paypal-button-container-${index}`} className="mt-4"></div>
              )}
            </div>
          );
        })}
      </div>

      {/* FIX 3: Payment history section */}
      <div className="max-w-7xl mx-auto mt-12">
        <button
          onClick={toggleHistory}
          className="flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
        >
          <span>{showHistory ? "▲" : "▼"}</span>
          {showHistory ? "Hide" : "View"} Billing History
        </button>

        {showHistory && (
          <div className="mt-4 bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
            {loadingHistory ? (
              <div className="p-8 flex justify-center">
                <svg className="animate-spin h-6 w-6 text-indigo-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
              </div>
            ) : paymentHistory.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">No payment records found.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Date</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Plan</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Amount</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Transaction ID</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Expires</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Invoice</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {paymentHistory.map((p) => (
                      <tr key={p._id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-3 text-gray-700">{formatDate(p.createdAt)}</td>
                        <td className="px-5 py-3 text-gray-900 font-medium">{p.planType}</td>
                        <td className="px-5 py-3 text-gray-700">${Number(p.amount).toFixed(2)}</td>
                        <td className="px-5 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusBadge(p.status)}`}>
                            {p.status}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-gray-400 font-mono text-xs truncate max-w-[140px]" title={p.paymentId}>
                          {p.paymentId === "pending" ? "—" : p.paymentId}
                        </td>
                        <td className="px-5 py-3 text-gray-700">{formatDate(p.premiumExpiration)}</td>
                        <td className="px-5 py-3">
                          {p.invoiceUrl ? (
                            <a
                              href={p.invoiceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-indigo-600 hover:text-indigo-800 text-xs font-semibold underline"
                            >
                              Download
                            </a>
                          ) : (
                            <span className="text-gray-400 text-xs">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
}

export default PremiumPage;