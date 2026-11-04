// PendingApprovalCard.jsx
import React from 'react';

const PendingApprovalCard = ({ userInfo }) => {
  const steps = [
    { label: 'Account created', done: true },
    { label: 'Profile submitted', done: true },
    { label: 'Admin review', done: false, active: true },
    { label: 'Access granted', done: false },
  ];

  const firstName = userInfo?.name ? userInfo.name.split(' ')[0] : 'there';
  const email = userInfo?.email || '';

  return (
    <div className="bg-white rounded-2xl shadow-2xl p-5 sm:p-8 max-w-[440px] w-full mx-auto text-center border border-gray-100 box-border animate-[cardIn_0.4s_cubic-bezier(0.34,1.56,0.64,1)]">
      <style>{`
        @keyframes cardIn { from { opacity:0; transform:scale(0.94) translateY(10px); } to { opacity:1; transform:scale(1) translateY(0); } }
        @keyframes pulse-ring { 0%,100%{transform:scale(1);opacity:0.6} 50%{transform:scale(1.15);opacity:0.2} }
      `}</style>

      {/* Animated icon */}
      <div className="relative inline-flex mb-4 sm:mb-5">
        <div className="absolute -inset-1.5 sm:-inset-2 rounded-full border-2 border-purple-400 animate-[pulse-ring_2s_ease-in-out_infinite]" />
        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-purple-100 to-indigo-100 flex items-center justify-center text-2xl sm:text-3xl shadow-xs">
          ⏳
        </div>
      </div>

      <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-1.5 sm:mb-2">
        Awaiting Admin Approval
      </h2>

      <p className="text-xs sm:text-sm text-gray-500 mb-5 sm:mb-6 leading-relaxed max-w-sm mx-auto px-1">
        Hi <strong className="text-purple-800 font-semibold">{firstName}</strong>! Your account is under review.
        You'll get full access once an admin approves your profile.
      </p>

      {/* Progress steps - Fully responsive 4-column layout */}
      <div className="relative mb-5 sm:mb-6">
        {/* Background track line */}
        <div className="absolute top-3.5 sm:top-4 left-6 right-6 h-0.5 bg-gray-200 -z-0" />
        {/* Active progress fill */}
        <div className="absolute top-3.5 sm:top-4 left-6 w-[60%] h-0.5 bg-purple-600 -z-0" />

        <div className="grid grid-cols-4 gap-1 relative z-10">
          {steps.map((step, i) => (
            <div key={i} className="flex flex-col items-center">
              <div
                className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all shadow-xs ${
                  step.done
                    ? 'bg-purple-600 text-white'
                    : step.active
                      ? 'bg-purple-50 text-purple-600 border-2 border-purple-600 ring-2 sm:ring-4 ring-purple-100'
                      : 'bg-gray-100 text-gray-400 border border-gray-200'
                }`}
              >
                {step.done ? (
                  '✓'
                ) : step.active ? (
                  <span className="inline-block w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-purple-600 animate-[pulse-ring_1.4s_ease-in-out_infinite]" />
                ) : (
                  i + 1
                )}
              </div>
              <span
                className={`text-[10px] sm:text-xs mt-1.5 font-medium leading-tight text-center break-words hyphens-auto max-w-[70px] sm:max-w-none ${
                  step.active
                    ? 'text-purple-900 font-bold'
                    : step.done
                      ? 'text-purple-700'
                      : 'text-gray-400'
                }`}
              >
                {step.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Info notification row with word-break on email */}
      <div className="bg-purple-50 border border-purple-100 rounded-xl p-3 sm:p-4 mb-4 text-left flex items-start gap-2.5">
        <span className="text-base sm:text-lg shrink-0 mt-0.5">📧</span>
        <p className="m-0 text-xs sm:text-sm text-purple-950 leading-relaxed min-w-0">
          We'll send an email to <strong className="font-semibold text-purple-900 break-all">{email}</strong> as soon as your account is approved.
        </p>
      </div>

      <p className="text-[11px] sm:text-xs text-gray-500 m-0">
        Approval usually takes 1–2 business days. Questions?{' '}
        <a
          href="mailto:support@edutechex.com"
          className="text-purple-600 hover:text-purple-800 font-semibold transition"
        >
          Contact support
        </a>
      </p>
    </div>
  );
};

export default PendingApprovalCard;
