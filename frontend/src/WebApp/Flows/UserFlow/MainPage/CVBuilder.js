import React, { useState } from "react";
import axios from "../../../../api/axiosInstance";

/**
 * CVBuilder — drop this wherever the "Generate CV / Resume" button should live.
 *
 * Props:
 *  - profile: the StudentProfile object from your API (or null)
 *  - onClose: function to close the modal
 *
 * It fetches the profile if not passed, then POST /cv/generate → downloads PDF.
 */
const CVBuilder = ({ profile: propProfile, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  const userInfo = JSON.parse(localStorage.getItem("userInfo") || "{}");
  const userId = userInfo?._id;

const handleGenerate = async () => {
  setLoading(true);
  setError(null);

  try {
    const response = await axios.post(
      `/api/cv/generate/${userId}`,
      {}, // backend fetches profile itself
      { responseType: "blob" }
    );

    const blob = new Blob([response.data], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Skillnaav_CV.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setDone(true);
  } catch (err) {
    setError(err?.response?.data?.detail || "Failed to generate CV.");
  } finally {
    setLoading(false);
  }
};
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-700 to-indigo-500 px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
              </div>
              <div>
                <h2 className="text-white font-bold text-lg leading-tight">Generate Your CV</h2>
                <p className="text-indigo-200 text-xs">Skillnaav-branded PDF resume</p>
              </div>
            </div>
            <button onClick={onClose} className="text-white/60 hover:text-white transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-6 space-y-5">
          {/* Preview card */}
          <div className="bg-slate-50 rounded-xl border border-slate-100 p-4 flex gap-4 items-start">
            <div className="w-12 h-16 bg-indigo-700 rounded-lg flex-shrink-0 flex items-end justify-center pb-1.5 shadow-sm">
              <span className="text-white text-[8px] font-bold">skillnaav</span>
            </div>
            <div>
              <p className="font-semibold text-slate-800 text-sm">What you'll get</p>
              <ul className="text-slate-500 text-xs mt-1.5 space-y-1">
                {[
                  "Clean A4 PDF with Skillnaav branding",
                  "All your profile sections included",
                  "Professional layout, ready to share",
                  "Skill badges, project links, contact info",
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Profile completeness hint */}
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-amber-700 text-xs flex items-start gap-2">
            <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
            <span>For the best CV, ensure your profile is filled with education, skills, and experience before generating.</span>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-600 text-sm">
              {error}
            </div>
          )}

          {/* Success */}
          {done && !error && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-emerald-700 text-sm flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
              Your CV has been downloaded successfully!
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 border border-slate-200 text-slate-600 rounded-xl py-2.5 text-sm font-medium hover:bg-slate-50 transition-colors"
          >
            {done ? "Close" : "Cancel"}
          </button>
          <button
            onClick={handleGenerate}
            disabled={loading || done}
            className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-all
              ${done
                ? "bg-emerald-500 text-white"
                : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm hover:shadow-indigo-200 hover:shadow-md"
              } disabled:opacity-60`}
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Generating...
              </>
            ) : done ? (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
                Downloaded!
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                Download CV (PDF)
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CVBuilder;
