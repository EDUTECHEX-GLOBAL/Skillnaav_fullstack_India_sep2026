import React from "react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

export default function TermsPage() {
  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Navbar />
      
      <main className="flex-grow pt-28 pb-16 px-5 lg:container lg:mx-auto lg:px-20">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 md:p-12 max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold text-[#36485C] mb-6">Terms and Conditions</h1>
          <p className="text-gray-500 mb-8">Last updated: October 2026</p>
          
          <div className="space-y-8 text-gray-600 leading-relaxed">
            <section>
              <h2 className="text-2xl font-semibold text-[#451E5D] mb-4">1. Agreement to Terms</h2>
              <p>
                By accessing or using the Edutechex website and services, you agree to be bound by these Terms and Conditions. If you disagree with any part of the terms, then you do not have permission to access the service.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-[#451E5D] mb-4">2. Intellectual Property</h2>
              <p>
                The service and its original content, features, and functionality are and will remain the exclusive property of Edutechex and its licensors. Our trademarks and trade dress may not be used in connection with any product or service without the prior written consent of Edutechex.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-[#451E5D] mb-4">3. User Accounts</h2>
              <p>
                When you create an account with us, you must provide us information that is accurate, complete, and current at all times. Failure to do so constitutes a breach of the terms, which may result in immediate termination of your account on our service.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-[#451E5D] mb-4">4. Limitation of Liability</h2>
              <p>
                In no event shall Edutechex, nor its directors, employees, partners, agents, suppliers, or affiliates, be liable for any indirect, incidental, special, consequential or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from your access to or use of or inability to access or use the service.
              </p>
            </section>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
