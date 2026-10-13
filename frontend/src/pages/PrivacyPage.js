import React from "react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

export default function PrivacyPage() {
  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Navbar />
      
      <main className="flex-grow pt-28 pb-16 px-5 lg:container lg:mx-auto lg:px-20">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 md:p-12 max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold text-[#36485C] mb-6">Privacy Policy</h1>
          <p className="text-gray-500 mb-8">Last updated: October 2026</p>
          
          <div className="space-y-8 text-gray-600 leading-relaxed">
            <section>
              <h2 className="text-2xl font-semibold text-[#451E5D] mb-4">1. Introduction</h2>
              <p>
                At Edutechex, we take your privacy seriously. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website or use our services.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-[#451E5D] mb-4">2. Information We Collect</h2>
              <p className="mb-4">We may collect information about you in a variety of ways. The information we may collect includes:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Personal Data (e.g., name, email address, phone number)</li>
                <li>Educational and Professional Background</li>
                <li>Usage Data (e.g., your IP address, browser type, and operating system)</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-[#451E5D] mb-4">3. How We Use Your Information</h2>
              <p className="mb-4">We use the information we collect to:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Provide, operate, and maintain our services</li>
                <li>Improve and personalize your experience</li>
                <li>Communicate with you regarding updates, support, and marketing</li>
                <li>Process transactions and manage your account</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-[#451E5D] mb-4">4. Contact Us</h2>
              <p>
                If you have questions or comments about this Privacy Policy, please contact us at: <a href="mailto:privacy@edutechex.com" className="text-blue-600 hover:underline">privacy@edutechex.com</a>.
              </p>
            </section>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
