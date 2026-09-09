// src/components/Partner/PartnerPremiumPage.js
import React, { useState, useEffect } from "react";
import axios from "../../../../api/axiosInstance";
import { useSelector } from "react-redux";

const RAZORPAY_KEY_ID = process.env.REACT_APP_RAZORPAY_KEY_ID;

// Frontend plan definitions — price/duration here is display-only.
// Server derives all values from planType — client never sends amount or duration.
const plans = [
  {
    title: "Freemium",
    price: "0.00",
    duration: 0,
    features: [
      "Post up to 2 active internships",
      "Free & Stipend-Based internships only",
      "Manual shortlisting of applicants",
      "Basic internship scheduling tools",
      "Send standard offer letters",
      "Mentor details visible on listing",
      "Admin approval required for posting",
      "Email-only support",
      "Application notifications (basic)",
    ],
    btnText: "You're Already on Free",
    disabled: true,
  },
  {
    title: "Premium Basic",
    price: "849",
    duration: 2,
    features: [
      "Unlimited internship postings",
      "Free, Stipend-Based & Paid internships",
      "Manual + Basic AI shortlisting tool",
      "Structured internship scheduling",
      "Customizable offer letter templates",
      "Logo visibility on internship cards",
      "Priority admin approval for job posts",
      "View basic analytics (views, applications)",
      "Priority email support",
    ],
    btnText: "Upgrade to Premium Basic",
    disabled: false,
  },
  {
    title: "Premium Plus",
    price: "1699",
    duration: 5,
    features: [
      "All Premium Basic features",
      "Advanced AI-powered shortlisting",
      "Calendar-synced scheduling with auto updates",
      "Smart offer letters with acceptance tracking",
      "Featured internship posts with highlight badge",
      "Full analytics: engagement & drop-off metrics",
      "Downloadable resume books",
      "Monthly insight reports to email",
      "Real-time notifications for applications",
      "Live chat & email support",
    ],
    btnText: "Upgrade to Premium Plus",
    disabled: false,
  },
];

export default function PartnerPremiumPage() {
  const [sdkReady, setSdkReady]               = useState(false);
  const [alert, setAlert]                     = useState(null);

  const [isProcessing, setIsProcessing]       = useState(false);
  const [, setTick]                           = useState(0);
  const [paymentHistory, setPaymentHistory]   = useState([]);
  const [showHistory, setShowHistory]         = useState(false);
  const [loadingHistory, setLoadingHistory]   = useState(false);
  const [expiryWarning, setExpiryWarning]     = useState(false);
  const [selectedPlanType, setSelectedPlanType] = useState(null);
  const [selectedIndex, setSelectedIndex]     = useState(null);



  // ✅ FIX 1: partner MUST be declared before any usage — moved to top of component body
  const reduxPartner = useSelector((s) => s.auth?.partnerInfo);
  const stored  = (JSON.parse(localStorage.getItem("partnerInfo")) || JSON.parse(localStorage.getItem("userInfo") || "{}"));
  const partner = reduxPartner || stored;

  // ✅ FIX 2: Token is saved as "token" by PartnerLogin — read the correct key.
  // partner object (from userInfo) also carries .token, so we prefer that.
  // Falls back to the standalone "token" key as a safety net.
  const getAuthHeader = () => {
    const token = partner?.token || localStorage.getItem("token");
    return { Authorization: `Bearer ${token}` };
  };

  // Countdown ticker — re-renders every minute so time-left display stays live
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 60000);
    return () => clearInterval(id);
  }, []);

  // Check expiry warning on mount / whenever expiration changes
  useEffect(() => {
    if (partner?.premiumExpiration) {
      const expMs = new Date(partner.premiumExpiration).getTime();
      const daysLeft = (expMs - Date.now()) / (1000 * 60 * 60 * 24);
      setExpiryWarning(daysLeft > 0 && daysLeft <= 3);
    }
  }, [partner?.premiumExpiration]);

  // ─── Load Razorpay SDK ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!RAZORPAY_KEY_ID) {
      setAlert({ type: "error", message: "Razorpay Key ID not set. Check .env" });
      return;
    }
    if (window.Razorpay) {
      setSdkReady(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload  = () => setSdkReady(true);
    script.onerror = () => setAlert({ type: "error", message: "Failed to load Razorpay SDK." });
    document.body.appendChild(script);
    return () => { setSdkReady(false); if (script?.parentNode) script.parentNode.removeChild(script); };
  }, []);

  // Razorpay handler in selectPlan

  // ─── Select a plan ────────────────────────────────────────────────────────
  const selectPlan = async (plan, idx) => {
    if (plan.price === "0.00") return;
    if (!sdkReady) {
      setAlert({ type: "error", message: "Razorpay is still loading. Please wait a moment." });
      return;
    }
    setSelectedPlanType(plan.title);
    setSelectedIndex(idx);
    
    setIsProcessing(true);
    try {
      const authHeader = getAuthHeader();
      const { data: orderRes } = await axios.post(
        "/api/partner/payments/razorpay/order",
        { planType: plan.title },
        { headers: authHeader },
      );

      const options = {
        key: RAZORPAY_KEY_ID,
        amount: orderRes.amount,
        currency: orderRes.currency,
        name: "Skillnaav",
        description: `Upgrade to ${plan.title}`,
        order_id: orderRes.id,
        handler: async function (response) {
          setIsProcessing(true);
          try {
            const { data: verify } = await axios.post(
              "/api/partner/payments/razorpay/verify",
              { 
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                planType: plan.title 
              },
              { headers: authHeader },
            );

            if (verify.success) {
              setAlert({ type: "success", message: "Payment successful! Check your email for a receipt." });

              const updated = {
                ...partner,
                isPremium:         true,
                planType:          verify.partner.planType,
                premiumExpiration: verify.partner.premiumExpiration,
              };
              localStorage.setItem("partnerInfo", JSON.stringify(updated));
              window.dispatchEvent(new CustomEvent("partnerUpdated", { detail: updated }));

              setPaymentHistory([]);
              setShowHistory(false);
              setSelectedIndex(null);
              setSelectedPlanType(null);
              setExpiryWarning(false);
            } else {
              setAlert({ type: "error", message: verify.message || "Payment verification failed." });
              setSelectedIndex(null);
              setSelectedPlanType(null);
            }
          } catch (err) {
            console.error("Partner verification error:", err);
            setAlert({ type: "error", message: "Payment verification error. Please contact support." });
            setSelectedIndex(null);
            setSelectedPlanType(null);
          } finally {
            setIsProcessing(false);
          }
        },
        prefill: {
          name: partner?.name || "",
          email: partner?.email || "",
          contact: partner?.phone || "",
        },
        theme: {
          color: "#4f46e5",
        },
      };

      const rzp1 = new window.Razorpay(options);
      rzp1.on("payment.failed", function (response) {
        console.error("Razorpay payment failed:", response.error);
        setAlert({ type: "error", message: "Payment failed: " + response.error.description });
      });
      rzp1.open();
    } catch (err) {
      console.error("Partner order creation failed:", err);
      const msg = err?.response?.data?.message || err?.message || "Unable to create Razorpay order. Please try again.";
      setAlert({ type: "error", message: msg });
    } finally {
      setIsProcessing(false);
    }
  };

  // ─── Fetch payment history ────────────────────────────────────────────────
  const fetchPaymentHistory = async () => {
    setLoadingHistory(true);
    try {
      // ✅ FIX 5: Use same getAuthHeader() helper
      const { data } = await axios.get("/api/partner/payments/history", {
        headers: getAuthHeader(),
      });
      if (data.success) setPaymentHistory(data.payments || []);
    } catch (err) {
      console.error("Failed to fetch partner payment history:", err);
      setAlert({ type: "error", message: "Failed to load billing history." });
    } finally {
      setLoadingHistory(false);
    }
  };

  const toggleHistory = () => {
    if (!showHistory && paymentHistory.length === 0) fetchPaymentHistory();
    setShowHistory((prev) => !prev);
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
      Success:  "bg-green-100 text-green-700",
      Pending:  "bg-yellow-100 text-yellow-700",
      Failed:   "bg-red-100 text-red-700",
      Refunded: "bg-gray-100 text-gray-600",
    };
    return map[status] || "bg-gray-100 text-gray-600";
  };

  const themes = [
    { bg: "from-green-50 to-green-100",   border: "border-green-200",  title: "text-green-700",  price: "text-green-900",  btn: "bg-white text-green-700 border-2 border-green-400 hover:bg-green-50"   },
    { bg: "from-purple-50 to-purple-100", border: "border-purple-200", title: "text-purple-700", price: "text-purple-900", btn: "bg-white text-purple-700 border-2 border-purple-400 hover:bg-purple-50" },
    { bg: "from-orange-50 to-orange-100", border: "border-orange-200", title: "text-orange-700", price: "text-orange-900", btn: "bg-white text-orange-700 border-2 border-orange-400 hover:bg-orange-50" },
  ];

  return (
    <div className="p-6 font-poppins min-h-screen bg-white">

      {/* Alert toast */}
      {alert && (
        <div className={`fixed top-4 right-4 z-50 p-3 rounded shadow-lg flex items-center gap-2 max-w-sm ${
          alert.type === "success" ? "bg-green-100 text-green-800 border-l-4 border-green-400" : "bg-red-100 text-red-800 border-l-4 border-red-400"
        }`}>
          <span className="text-sm font-medium">{alert.message}</span>
          <button onClick={() => setAlert(null)} className="ml-2 font-bold text-lg leading-none">×</button>
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

      {/* Expiry warning banner */}
      {partner?.isPremium && expiryWarning && (
        <div className="max-w-7xl mx-auto mb-6">
          <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 flex items-center gap-3">
            <span className="text-amber-500 text-xl">⚠</span>
            <p className="text-amber-800 text-sm font-medium">
              Your <strong>{partner.planType}</strong> subscription expires soon. Renew to avoid losing premium features.
            </p>
          </div>
        </div>
      )}

      {/* Header row */}
      <div className="max-w-7xl mx-auto mb-10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-50 border border-indigo-200 mb-4">
            <span className="w-2 h-2 bg-indigo-500 rounded-full"></span>
            <span className="text-xs font-bold tracking-widest text-indigo-600 uppercase">Partner Premium Plans</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900">Choose Your Partner Plan</h1>
          <div className="w-20 h-1 bg-gradient-to-r from-indigo-500 to-purple-500 mt-3 rounded-full"></div>
        </div>

        {/* Active plan banner */}
        {partner?.isPremium && partner?.planType !== "Freemium" && (() => {
          const exp = partner.premiumExpiration ? new Date(partner.premiumExpiration) : null;
          const now = new Date();
          const isExpired = exp && exp <= now;
          let remainingText = "Expired";
          if (!isExpired) {
            const diff = exp - now;
            const days  = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const mins  = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            remainingText = `${days}d ${hours}h ${mins}m`;
          }
          return (
            <div className={`w-full lg:w-auto bg-gradient-to-r ${isExpired ? "from-red-50 to-orange-50 border-red-200" : "from-purple-50 to-indigo-50 border-purple-200"} border rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row gap-6 items-start sm:items-center`}>
              <div>
                <p className={`text-xs font-bold tracking-widest ${isExpired ? "text-red-600" : "text-purple-600"} uppercase mb-1`}>
                  {isExpired ? "Partner Premium Expired" : "Partner Premium Active"}
                </p>
                <h2 className={`text-xl font-bold ${isExpired ? "text-red-700" : "text-purple-700"}`}>{partner.planType || "Premium"}</h2>
              </div>
              <div className={`hidden sm:block w-px h-10 ${isExpired ? "bg-red-200" : "bg-purple-200"}`}></div>
              <div>
                <p className="text-[10px] font-bold text-gray-500 uppercase">Time Left</p>
                <p className={`text-sm font-bold ${isExpired ? "text-red-600" : "text-purple-700"}`}>{remainingText}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-500 uppercase">Expires On</p>
                <p className="text-sm font-semibold text-gray-700">
                  {exp ? exp.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "N/A"}
                </p>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Plan cards */}
      <div id="plan-cards" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
        {plans.map((plan, idx) => {
          const isCurrentPlan =
            partner?.isPremium &&
            partner.planType === plan.title &&
            new Date(partner.premiumExpiration) > new Date();

          const theme = themes[idx % themes.length];

          return (
            <div key={idx} className={`bg-gradient-to-b ${theme.bg} border-2 ${theme.border} rounded-3xl p-8 flex flex-col justify-between transition-all hover:shadow-xl hover:scale-105`}>
              <div>
                <h3 className={`text-2xl font-bold ${theme.title} mb-3`}>{plan.title}</h3>
                {isCurrentPlan && (
                  <p className="text-sm text-green-600 mb-3 font-semibold">✓ Active Plan</p>
                )}
                <p className={`text-5xl font-bold ${theme.price} mb-2`}>₹{plan.price}</p>
                <p className="text-sm text-gray-600 mb-5">
                  Duration: {plan.duration ? `${plan.duration} Days` : "Unlimited"}
                </p>
                <div className="border-t border-gray-200 my-4"></div>
                <ul className="space-y-3">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                      <span className="text-green-500 mt-1">✔</span>{f}
                    </li>
                  ))}
                </ul>
              </div>

              <button
                onClick={() => selectPlan(plan, idx)}
                disabled={plan.disabled || isCurrentPlan || isProcessing}
                className={`mt-8 py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 ${
                  plan.disabled || isCurrentPlan
                    ? "bg-gray-300 text-gray-600 cursor-not-allowed"
                    : "bg-[#0b123d] text-white hover:bg-[#1a2356] shadow-md"
                }`}
              >
                {isCurrentPlan ? (
                  "✓ Subscribed"
                ) : plan.disabled ? (
                  `On ${plan.title}`
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
                    </svg>
                    Pay with Razorpay
                  </>
                )}
              </button>


            </div>
          );
        })}
      </div>

      {/* Billing history section */}
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
                        <td className="px-5 py-3 text-gray-700">₹{Number(p.amount).toFixed(2)}</td>
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