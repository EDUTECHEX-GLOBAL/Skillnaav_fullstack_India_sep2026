import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import axios from "../../api/axiosInstance";

const VerifyCertificate = () => {
  const { certificateId } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [certificate, setCertificate] = useState(null);

  useEffect(() => {
    const fetchCertificate = async () => {
      try {
        const response = await axios.get(`/api/certificates/verify/${certificateId}`);
        if (response.data.success) {
          setCertificate(response.data.certificate);
        } else {
          setError("Certificate not found or invalid.");
        }
      } catch (err) {
        console.error("Verification error:", err);
        setError(err.response?.data?.message || "Failed to verify certificate.");
      } finally {
        setLoading(false);
      }
    };

    fetchCertificate();
  }, [certificateId]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 font-poppins">
      <div className="max-w-xl w-full bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="bg-indigo-600 px-6 py-4 text-center">
          <h1 className="text-2xl font-bold text-white">Certificate Verification</h1>
        </div>
        
        <div className="p-6 sm:p-10">
          {loading ? (
            <div className="flex flex-col items-center justify-center space-y-4 py-10">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
              <p className="text-gray-500">Verifying certificate...</p>
            </div>
          ) : error ? (
            <div className="text-center py-10">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mb-4">
                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-800 mb-2">Verification Failed</h2>
              <p className="text-gray-600">{error}</p>
              <Link to="/" className="mt-6 inline-block text-indigo-600 hover:text-indigo-800 font-medium">
                Return Home
              </Link>
            </div>
          ) : (
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-1">Valid Certificate</h2>
              <p className="text-green-600 font-medium mb-8">This certificate is officially verified by Skillnaav.</p>
              
              <div className="bg-gray-50 rounded-xl p-6 text-left space-y-4">
                <div>
                  <p className="text-sm text-gray-500 uppercase tracking-wide font-semibold mb-1">Issued To</p>
                  <p className="text-lg font-semibold text-gray-900">{certificate.studentName}</p>
                </div>
                
                <div>
                  <p className="text-sm text-gray-500 uppercase tracking-wide font-semibold mb-1">Internship Title</p>
                  <p className="text-lg font-medium text-gray-800">{certificate.internshipTitle}</p>
                </div>
                
                <div>
                  <p className="text-sm text-gray-500 uppercase tracking-wide font-semibold mb-1">Company</p>
                  <p className="text-lg text-gray-800">{certificate.companyName}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500 uppercase tracking-wide font-semibold mb-1">Issue Date</p>
                    <p className="text-gray-800">{new Date(certificate.issuedAt).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 uppercase tracking-wide font-semibold mb-1">Certificate ID</p>
                    <p className="text-gray-800 text-sm font-mono break-all">{certificate.certificateId}</p>
                  </div>
                </div>
              </div>

              <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
                <a 
                  href={certificate.pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-6 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition"
                >
                  View Original PDF
                </a>
                <Link to="/" className="px-6 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition">
                  Go to Homepage
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VerifyCertificate;
