import React, { useState, useEffect } from "react";
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import axios from "../../../../../api/axiosInstance";

const PAYPAL_CLIENT_ID = process.env.REACT_APP_PAYPAL_CLIENT_ID;

const plans = [
  {
    title: "Free Plan",
    price: "$0",
    credits: "50 Student Credits",
    features: ["Basic Dashboard Access", "Limited Email Support"],
    button: "Choose Free Plan",
    cardBg: "from-blue-50 to-blue-100",
    borderColor: "border-blue-200",
    titleColor: "text-blue-700",
    priceColor: "text-blue-900",
    buttonColor: "bg-white text-blue-700 border-2 border-blue-400 hover:bg-blue-50",
    creditIconColor: "text-blue-600",
    checkmarkColor: "text-blue-600",
  },
  {
    title: "Standard Plan",
    price: "$10",
    credits: "500 Student Credits",
    features: ["Full Dashboard Access", "Priority Email Support"],
    button: "Choose Standard Plan",
    cardBg: "from-purple-50 to-purple-100",
    borderColor: "border-purple-200",
    titleColor: "text-purple-700",
    priceColor: "text-purple-900",
    buttonColor: "bg-white text-purple-700 border-2 border-purple-400 hover:bg-purple-50",
    creditIconColor: "text-purple-600",
    checkmarkColor: "text-purple-600",
    paypalAmount: "10.00",
  },
  {
    title: "Premium Plan",
    price: "$25",
    credits: "2000 Student Credits",
    features: [
      "Full Dashboard Access",
      "Advanced Analytics",
      "Priority Email Support",
      "Early Access to Features",
    ],
    button: "Choose Premium Plan",
    cardBg: "from-green-50 to-green-100",
    borderColor: "border-green-200",
    titleColor: "text-green-700",
    priceColor: "text-green-900",
    buttonColor: "bg-white text-green-700 border-2 border-green-400 hover:bg-green-50",
    creditIconColor: "text-green-600",
    checkmarkColor: "text-green-600",
    paypalAmount: "25.00",
  },
  {
    title: "Custom Plan",
    price: "Custom",
    credits: "Unlimited Student Credits",
    features: ["API & Bulk Upload Support", "Dedicated Success Manager"],
    button: "Choose Custom Plan",
    cardBg: "from-amber-50 to-amber-100",
    borderColor: "border-amber-200",
    titleColor: "text-amber-800",
    priceColor: "text-amber-900",
    buttonColor: "bg-white text-amber-700 border-2 border-amber-400 hover:bg-amber-50",
    creditIconColor: "text-amber-600",
    checkmarkColor: "text-amber-600",
  },
];

const SubscriptionPlans = () => {
  const [currentPlan, setCurrentPlan] = useState(null);
  const [selectedPlanForPayment, setSelectedPlanForPayment] = useState(null);

  useEffect(() => {
    const fetchCurrentPlan = async () => {
      try {
        const token = localStorage.getItem("schoolAdminToken");

        const { data } = await axios.get("/api/school-admin/profile", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        setCurrentPlan(data.plan);
      } catch (error) {
        console.error("Failed to fetch current plan:", error);
        toast.error("Failed to load current plan");
      }
    };
    fetchCurrentPlan();
  }, []);

  const handleFreePlanActivation = async () => {
    if (currentPlan === "Free Plan") return;
    try {
      await axios.post("/api/school-admin/activate-free");
      toast.success("✅ Free Plan Activated Successfully!");
      setCurrentPlan("Free Plan");
    } catch (err) {
      console.error("Free Plan activation error:", err);
      const errorMessage = err.response?.data?.message || "Something went wrong.";
      toast.error(`❌ Activation failed: ${errorMessage}`);
    }
  };

 const handlePaidPlanActivation = async (planTitle, orderId) => {
  try {
    const token = localStorage.getItem("schoolAdminToken");

    await axios.post(
      "/api/school-admin/payments/subscribe",
      {
        plan: planTitle,
        orderId,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    toast.success(`✅ ${planTitle} activated successfully!`);
    setCurrentPlan(planTitle);
  } catch (err) {
    console.error("Paid Plan activation error:", err);
  }
};

  const handleContactSales = () => {
    toast.info("📞 Please contact sales at support@example.com");
  };

  if (!PAYPAL_CLIENT_ID) {
    console.error("❌ Missing PayPal Client ID. Check .env file.");
    return <p className="text-red-600 text-center">PayPal is not configured.</p>;
  }

  return (
    <PayPalScriptProvider options={{ "client-id": PAYPAL_CLIENT_ID }}>
      <div className="min-h-screen bg-white py-12 px-6">
        <ToastContainer position="top-center" autoClose={3000} />

        {/* Header */}
        <div className="text-center mb-14 max-w-4xl mx-auto">
          <p className="text-sm font-semibold text-blue-600 tracking-widest mb-3 uppercase">
            Internship Credit Plans
          </p>
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Choose the Right Plan for Your Institution
          </h2>
        </div>

        {/* Plans Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
          {plans.map((plan, index) => (
            <div
              key={index}
              className={`bg-gradient-to-b ${plan.cardBg} border-2 ${plan.borderColor} rounded-3xl p-8 flex flex-col justify-between transition-all hover:shadow-xl hover:scale-105`}
            >
              {/* Plan Title */}
              <div className="mb-6">
                <h3 className={`text-2xl font-bold ${plan.titleColor} mb-6`}>
                  {plan.title}
                </h3>

                {/* Price */}
                <div className="mb-4">
                  <p className={`text-5xl font-bold ${plan.priceColor}`}>
                    {plan.price}
                  </p>
                </div>

                {/* Credits Badge */}
                <div className="flex items-center gap-2 mb-6 pb-6 border-b border-gray-200 border-opacity-30">
                  <svg
                    className={`w-5 h-5 ${plan.creditIconColor}`}
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v1h8v-1zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                  </svg>
                  <p className={`text-sm font-semibold ${plan.creditIconColor}`}>
                    {plan.credits}
                  </p>
                </div>

                {/* Features List */}
                <ul className="space-y-3">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-3">
                      <svg
                        className={`w-5 h-5 flex-shrink-0 ${plan.checkmarkColor}`}
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <span className="text-sm text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Button Section */}
              <div className="mt-8">
                {plan.title === "Free Plan" ? (
                  <button
                    onClick={handleFreePlanActivation}
                    disabled={currentPlan === "Free Plan"}
                    className={`w-full py-3 px-4 rounded-lg font-semibold transition-all ${plan.buttonColor} ${currentPlan === "Free Plan"
                        ? "opacity-60 cursor-not-allowed"
                        : ""
                      }`}
                  >
                    {currentPlan === "Free Plan"
                      ? "Current Plan"
                      : plan.button}
                  </button>
                ) : plan.title === "Standard Plan" ? (
                  selectedPlanForPayment === "Standard Plan" ? (
                    <PayPalButtons
                      style={{
                        layout: "vertical",
                      }}
                      createOrder={(data, actions) => {
                        return actions.order.create({
                          purchase_units: [
                            {
                              amount: {
                                value: "10.00",
                                currency_code: "USD",
                              },
                              description: "500 Student Credits",
                            },
                          ],
                        });
                      }}
                      onApprove={async (data, actions) => {
                        const order = await actions.order.capture();
                        await handlePaidPlanActivation("Standard Plan", order.id);
                      }}
                      onError={(err) => {
                        console.error("PayPal error:", err);
                        toast.error("❌ Payment failed. Please try again.");
                      }}
                    />
                  ) : (
                    <button
                      onClick={() => setSelectedPlanForPayment("Standard Plan")}
                      disabled={currentPlan === "Standard Plan"}
                      className={`w-full py-3 px-4 rounded-lg font-semibold transition-all ${plan.buttonColor} ${
                        currentPlan === "Standard Plan"
                          ? "opacity-60 cursor-not-allowed"
                          : ""
                      }`}
                    >
                      {currentPlan === "Standard Plan"
                        ? "Current Plan"
                        : plan.button}
                    </button>
                  )
                ) : plan.title === "Premium Plan" ? (
                  selectedPlanForPayment === "Premium Plan" ? (
                    <PayPalButtons
                      style={{
                        layout: "vertical",
                      }}
                      createOrder={(data, actions) => {
                        return actions.order.create({
                          purchase_units: [
                            {
                              amount: {
                                value: "25.00",
                                currency_code: "USD",
                              },
                              description: "2000 Student Credits",
                            },
                          ],
                        });
                      }}
                      onApprove={async (data, actions) => {
                        const order = await actions.order.capture();
                        await handlePaidPlanActivation("Premium Plan", order.id);
                      }}
                      onError={(err) => {
                        console.error("PayPal error:", err);
                        toast.error("❌ Payment failed. Please try again.");
                      }}
                    />
                  ) : (
                    <button
                      onClick={() => setSelectedPlanForPayment("Premium Plan")}
                      disabled={currentPlan === "Premium Plan"}
                      className={`w-full py-3 px-4 rounded-lg font-semibold transition-all ${plan.buttonColor} ${
                        currentPlan === "Premium Plan"
                          ? "opacity-60 cursor-not-allowed"
                          : ""
                      }`}
                    >
                      {currentPlan === "Premium Plan"
                        ? "Current Plan"
                        : plan.button}
                    </button>
                  )
                ) : (
                  <button
                    onClick={handleContactSales}
                    className={`w-full py-3 px-4 rounded-lg font-semibold transition-all ${plan.buttonColor}`}
                  >
                    {plan.button}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </PayPalScriptProvider>
  );
};

export default SubscriptionPlans;