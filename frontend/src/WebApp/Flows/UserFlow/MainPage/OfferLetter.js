import React, { useEffect, useState } from "react";
import axios from "../../../../api/axiosInstance";
import OfferLetterCard from "./OfferLetterCard";
import { Skeleton } from "antd";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheckCircle, faTimesCircle, faExclamationCircle } from "@fortawesome/free-solid-svg-icons";

const offerGridClassName =
  "grid w-full gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr))] xl:[grid-template-columns:repeat(3,minmax(0,1fr))]";

const OfferLetters = () => {
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [certificates, setCertificates] = useState([]);
  const [loadingCertificates, setLoadingCertificates] = useState(true);

  const userInfo = (JSON.parse(localStorage.getItem("studentInfo")) || JSON.parse(localStorage.getItem("userInfo")));
  // Ensure correct id field
  const studentId = userInfo?.studentId || userInfo?._id;

  useEffect(() => {
    const fetchOffers = async () => {
      if (!studentId) {
        setError("Student ID not found. Please log in.");
        setLoading(false);
        setLoadingCertificates(false);
        return;
      }

      try {
        const res = await axios.get(`/api/offer-letters/student/${studentId}`);
        setOffers(res.data || []);
      } catch (err) {
        console.error("Error fetching offers:", err);
        setError("Failed to load offer letters.");
      } finally {
        setLoading(false);
      }
    };

    const fetchCertificates = async () => {
      if (!studentId) return;
      const userToken = localStorage.getItem("userToken");
      try {
        const res = await axios.get(`/api/certificates/my-certificates`, {
          headers: {
            Authorization: `Bearer ${userToken}`
          }
        });
        if (res.data.success) {
          setCertificates(res.data.certificates || []);
        }
      } catch (err) {
        console.error("Error fetching certificates:", err);
      } finally {
        setLoadingCertificates(false);
      }
    };

    fetchOffers();
    fetchCertificates();
  }, [studentId]);

  return (
    <div className="w-full p-2 font-poppins sm:p-3 lg:p-4">
      <h2 className="text-xl font-semibold mb-4">Your Offer Letters</h2>

      {loading && (
        <div className={offerGridClassName}>
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex flex-col h-full min-h-[420px] min-w-0 w-full p-4 border rounded shadow-sm bg-white">
              <Skeleton active />
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-red-500 font-medium">{error}</p>}

      {!loading && !error && offers.length === 0 && (
        <p className="text-gray-600 italic">
          No offer letters yet. Please check back later.
        </p>
      )}

      {!loading && !error && offers.length > 0 && (
        <div className={offerGridClassName}>
          {offers.map((offer) => (
            <OfferLetterCard
              key={offer._id}
              offer={offer}
              onStatusChange={(newStatus) =>
                setOffers((prev) =>
                  prev.map((o) =>
                    o._id === offer._id ? { ...o, status: newStatus } : o
                  )
                )
              }
            />
          ))}
        </div>
      )}

      {/* CERTIFICATES SECTION */}
      <h2 className="text-xl font-semibold mt-10 mb-4">Your Certificates</h2>
      
      {loadingCertificates ? (
        <div className="flex gap-4">
          <Skeleton active paragraph={{ rows: 2 }} />
        </div>
      ) : certificates.length === 0 ? (
        <p className="text-gray-600 italic">No certificates issued yet.</p>
      ) : (
        <div className="grid w-full gap-4 [grid-template-columns:repeat(auto-fit,minmax(300px,1fr))]">
          {certificates.map((cert) => (
            <div key={cert._id} className="p-5 border border-gray-200 rounded-lg shadow-sm bg-white flex flex-col justify-between">
              <div>
                <h3 className="font-bold text-lg text-gray-800">{cert.internshipTitle}</h3>
                <p className="text-sm text-gray-600 mb-1">{cert.companyName}</p>
                <p className="text-xs text-gray-500 mb-4">
                  Issued on: {new Date(cert.issuedAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-3 mt-4">
                <a
                  href={cert.pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 bg-indigo-600 text-white text-center text-sm font-medium py-2 rounded hover:bg-indigo-700 transition"
                >
                  Download
                </a>
                <a
                  href={`/verify/${cert.certificateId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 border border-indigo-600 text-indigo-600 text-center text-sm font-medium py-2 rounded hover:bg-indigo-50 transition"
                >
                  Verify Link
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ATTENDANCE SECTION — Moved to separate UserAttendance component */}
    </div>
  );
};

export default OfferLetters;
