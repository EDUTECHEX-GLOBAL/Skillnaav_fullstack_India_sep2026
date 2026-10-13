import React from "react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

export default function VisaPage() {
  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Navbar />
      
      <main className="flex-grow pt-28 pb-16 px-5 lg:container lg:mx-auto lg:px-20">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 md:p-12 max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold text-[#36485C] mb-6">Visa Information</h1>
          <p className="text-gray-600 text-lg mb-8 leading-relaxed">
            Welcome to the Edutechex Visa Information portal. Navigating international education requirements can be complex, but we're here to help you understand the process.
          </p>
          
          <div className="space-y-8">
            <section>
              <h2 className="text-2xl font-semibold text-[#451E5D] mb-4">General Visa Requirements</h2>
              <p className="text-gray-600 leading-relaxed mb-4">
                To study abroad, you will typically need to secure a student visa. The exact requirements vary depending on your destination country, but generally include:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-600 ml-4">
                <li>A valid passport (valid for at least 6 months beyond your period of stay)</li>
                <li>Acceptance letter from an accredited educational institution</li>
                <li>Proof of financial support (bank statements, scholarships, etc.)</li>
                <li>Passport-sized photographs</li>
                <li>Completed visa application forms</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-[#451E5D] mb-4">How Edutechex Can Help</h2>
              <p className="text-gray-600 leading-relaxed">
                Our support team is equipped to guide you through the visa application process. From reviewing your documents to preparing you for your visa interview, we ensure you have the best chance of a successful application. Contact our support team for personalized assistance.
              </p>
            </section>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
