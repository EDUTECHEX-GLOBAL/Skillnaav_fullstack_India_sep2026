// components/InternshipPaymentCard.jsx
import React from "react";
import { motion } from "framer-motion";
import { FaMapMarkerAlt } from "react-icons/fa";
import { HiOutlineCurrencyDollar, HiOutlineUsers, HiArrowRight } from "react-icons/hi";

const calculatePostedTime = (date) => {
  const diff = Math.floor((new Date() - new Date(date)) / (1000 * 60 * 60 * 24));
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return `${diff}d ago`;
};

const InternshipPaymentCard = ({ internship, onViewPayments }) => {
  const totalPayments = internship.paymentSummary?.totalPayments || 0;
  const totalAmount   = internship.paymentSummary?.totalAmount   || 0;
  const hasPayments   = totalPayments > 0;
  const initial       = (internship.companyName || "C").charAt(0).toUpperCase();

  return (
    <motion.div
      whileHover={{ y: -2 }}
      onClick={() => hasPayments && onViewPayments(internship)}
      className={`bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md hover:border-gray-300 transition-all duration-200 ${hasPayments ? "cursor-pointer" : "cursor-default"}`}
    >
      {/* Top accent */}
      <div className="h-0.5 w-full bg-emerald-600" />

      <div className="p-5">
        {/* Header row */}
        <div className="flex items-start gap-3 mb-4">
          {internship.imgUrl ? (
            <img
              src={internship.imgUrl}
              alt={internship.companyName}
              className="w-9 h-9 rounded-lg object-cover border border-gray-200 flex-shrink-0"
            />
          ) : (
            <div className="w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center text-white text-sm font-medium flex-shrink-0">
              {initial}
            </div>
          )}

          <div className="flex-1 min-w-0">
            <h5 className="text-sm font-medium text-gray-900 truncate leading-snug">
              {internship.jobTitle}
            </h5>
            <p className="text-xs text-gray-500 mt-0.5 truncate">
              {internship.companyName}
              <span className="mx-1 text-gray-300">·</span>
              {calculatePostedTime(internship.createdAt)}
            </p>
          </div>

          <span className="flex-shrink-0 text-[10px] font-medium tracking-widest bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded">
            PAID
          </span>
        </div>

        {/* Divider */}
        <div className="border-t border-gray-100 mb-4" />

        {/* 3-col stats */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div>
            <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1">Location</p>
            <div className="flex items-center gap-1">
              <FaMapMarkerAlt className="text-gray-400 text-[10px] flex-shrink-0" />
              <span className="text-xs font-medium text-gray-800 truncate">{internship.location || "—"}</span>
            </div>
          </div>
          <div>
            <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1">Total paid</p>
            <div className="flex items-center gap-0.5">
              <HiOutlineCurrencyDollar className="text-emerald-600 text-sm flex-shrink-0" />
              <span className="text-sm font-medium text-emerald-700">{totalAmount.toLocaleString()}</span>
            </div>
          </div>
          <div>
            <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1">Students</p>
            <div className="flex items-center gap-1">
              <HiOutlineUsers className="text-gray-400 text-sm flex-shrink-0" />
              <span className="text-sm font-medium text-gray-800">{totalPayments}</span>
            </div>
          </div>
        </div>

        {/* Qualification tags */}
        {internship.qualifications?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {internship.qualifications.slice(0, 3).map((q, i) => (
              <span key={i} className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-medium">{q}</span>
            ))}
            {internship.qualifications.length > 3 && (
              <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded font-medium">
                +{internship.qualifications.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Footer action */}
        <div className="border-t border-gray-100 pt-3 flex items-center justify-center">
          {hasPayments ? (
            <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-700">
              <HiArrowRight className="text-xs" />
              View {totalPayments} payment{totalPayments !== 1 ? "s" : ""}
            </span>
          ) : (
            <span className="text-xs text-gray-400">No payments yet</span>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default InternshipPaymentCard;