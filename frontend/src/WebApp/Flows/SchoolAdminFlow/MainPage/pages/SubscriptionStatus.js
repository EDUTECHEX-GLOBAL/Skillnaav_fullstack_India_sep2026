import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "../../../../../api/axiosInstance";
import { FaArrowRight, FaChartLine, FaCoins, FaCreditCard, FaReceipt } from "react-icons/fa";

const formatCurrency = (amount, currency = "USD") => {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
    }).format(amount || 0);
  } catch {
    return `${currency} ${Number(amount || 0).toFixed(2)}`;
  }
};

const formatDate = (value) => {
  if (!value) return "N/A";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const statusClasses = {
  COMPLETED: "bg-green-100 text-green-700",
  PENDING: "bg-yellow-100 text-yellow-700",
  FAILED: "bg-red-100 text-red-700",
};

export default function SubscriptionStatus() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState({
    currentPlan: "Free Plan",
    creditsAvailable: 0,
    totalCreditsPurchased: 0,
    totalPurchases: 0,
  });
  const [payments, setPayments] = useState([]);

  useEffect(() => {
    const fetchPaymentHistory = async () => {
      try {
        setLoading(true);
        setError("");

        const token = localStorage.getItem("schoolAdminToken");
        const { data } = await axios.get("/api/school-admin/payments/history", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        setSummary({
          currentPlan: data?.currentPlan || "Free Plan",
          creditsAvailable: data?.creditsAvailable || 0,
          totalCreditsPurchased: data?.totalCreditsPurchased || 0,
          totalPurchases: data?.totalPurchases || 0,
        });
        setPayments(Array.isArray(data?.payments) ? data.payments : []);
      } catch (err) {
        console.error("Failed to fetch school admin payment history:", err);
        setError(
          err.response?.data?.message || "Unable to load purchased credits status right now."
        );
      } finally {
        setLoading(false);
      }
    };

    fetchPaymentHistory();
  }, []);

  const summaryCards = [
    {
      key: "plan",
      label: "Current Plan",
      value: summary.currentPlan,
      icon: <FaChartLine className="text-teal-600" />,
      accent: "from-teal-100 to-cyan-50",
    },
    {
      key: "available",
      label: "Available Credits",
      value: summary.creditsAvailable,
      icon: <FaCoins className="text-blue-600" />,
      accent: "from-blue-100 to-indigo-50",
    },
    {
      key: "purchased",
      label: "Purchased Credits",
      value: summary.totalCreditsPurchased,
      icon: <FaCreditCard className="text-purple-600" />,
      accent: "from-purple-100 to-fuchsia-50",
    },
    {
      key: "orders",
      label: "Credit Purchases",
      value: summary.totalPurchases,
      icon: <FaReceipt className="text-orange-600" />,
      accent: "from-orange-100 to-amber-50",
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8 font-poppins sm:px-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-gray-100 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-teal-600">
              Credits Overview
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-gray-900">
              Purchased Credits Status
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-gray-500">
              Track every completed credit purchase, the plan used, and the credits added to this school admin account.
            </p>
          </div>

          <button
            onClick={() => navigate("/schooladmin/dashboard/subscriptions")}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-teal-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-700"
          >
            Buy More Credits
            <FaArrowRight className="text-xs" />
          </button>
        </div>

        {error && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((card) => (
            <div
              key={card.key}
              className={`rounded-3xl bg-gradient-to-br ${card.accent} p-5 shadow-sm ring-1 ring-gray-100`}
            >
              <div className="mb-4 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600">{card.label}</span>
                <span className="rounded-full bg-white/80 p-3 shadow-sm">{card.icon}</span>
              </div>
              <div className="text-3xl font-semibold text-gray-900">{card.value}</div>
            </div>
          ))}
        </div>

        <div className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-gray-100">
          <div className="border-b border-gray-100 px-6 py-5">
            <h2 className="text-xl font-semibold text-gray-900">Purchase History</h2>
            <p className="mt-1 text-sm text-gray-500">
              Every credit purchase made by this school admin account appears here.
            </p>
          </div>

          {loading ? (
            <div className="px-6 py-12 text-center text-sm text-gray-500">
              Loading purchased credits status...
            </div>
          ) : payments.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 text-gray-500">
                <FaReceipt />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-gray-900">No purchased credits yet</h3>
              <p className="mt-2 text-sm text-gray-500">
                Once the admin buys credits, each purchase status will appear here.
              </p>
              <button
                onClick={() => navigate("/schooladmin/dashboard/subscriptions")}
                className="mt-5 inline-flex items-center justify-center rounded-2xl bg-teal-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-700"
              >
                Open Credit Plans
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50">
                  <tr className="text-left text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                    <th className="px-6 py-4">Plan</th>
                    <th className="px-6 py-4">Credits Added</th>
                    <th className="px-6 py-4">Amount</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Order ID</th>
                    <th className="px-6 py-4">Purchased On</th>
                    <th className="px-6 py-4">Invoice</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {payments.map((payment) => (
                    <tr key={payment._id} className="text-sm text-gray-700">
                      <td className="px-6 py-4 font-semibold text-gray-900">{payment.plan}</td>
                      <td className="px-6 py-4">{payment.creditsAdded}</td>
                      <td className="px-6 py-4">{formatCurrency(payment.amount, payment.currency)}</td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                            statusClasses[payment.status] || "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {payment.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-gray-500">{payment.orderId}</td>
                      <td className="px-6 py-4">{formatDate(payment.purchasedAt)}</td>
                      <td className="px-6 py-4">
                        {payment.invoiceUrl ? (
                          <a
                            href={payment.invoiceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-teal-600 hover:text-teal-800 text-xs font-semibold underline"
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
      </div>
    </div>
  );
}
