import React, { useEffect, useState } from "react";
import { useFeedback } from "../../context/FeedbackContext";
import "../../index.css"; // ensure Poppins is globally loaded
import axios from "../../api/axiosInstance";

export default function FeedbackModal() {
  const {
    open,
    closeFeedback,
    questions,
    flow,
    triggerInfo,
    userObj,
    postSubmitCallback,

    // 🔥 ADD THESE
    externalUserId,
    externalUserName,
    externalUserEmail
  } = useFeedback();


  const [answers, setAnswers] = useState({});
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  // const firstErrorRef = useRef(null);

  useEffect(() => {
    if (open && Array.isArray(questions)) {
      const initial = {};
      questions.forEach((q) => {
        initial[q.id] = ""; // intentionally empty
      });
      if (userObj?.email) {
        initial.contactEmail = userObj.email;
        initial.contactEmail_partner = userObj.email;
        initial.contactEmail_school = userObj.email;
      }
      setAnswers(initial);
      setErrors({});
    }
  }, [open, questions, userObj]);

  if (!open) return null;

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const isYes = (v) => {
    if (v === true) return true;
    if (!v) return false;
    return String(v).toLowerCase() === "yes" || String(v) === "1" || String(v).toLowerCase() === "true";
  };

  const getIssueToggleKey = (descId) => {
    const mapping = {
      issueDesc: "issueEncountered",
      issueDesc_partner: "issues_partner",
      issueDesc_school: "issue_school",
      issueDesc_partner_alt: "issues_partner"
    };
    if (mapping[descId]) return mapping[descId];
    if (descId.endsWith("_partner")) return "issues_partner";
    if (descId.endsWith("_school")) return "issue_school";
    return "issueEncountered";
  };

  const getFollowUpKey = (contactId) => {
    const mapping = {
      contactEmail: "followUp",
      contactEmail_partner: "followUp_partner",
      contactEmail_school: "followUp_school"
    };
    return mapping[contactId] || (contactId.endsWith("_partner") ? "followUp_partner" : contactId.endsWith("_school") ? "followUp_school" : "followUp");
  };

  const validate = () => {
    const newErrors = {};

    for (const q of questions) {
      const val = answers[q.id];

      if (q.required) {
        if (q.type === "text" || q.type === "textarea" || q.type === "select") {
          if (!val || String(val).trim() === "") {
            newErrors[q.id] = "This field is required";
            continue;
          }
        } else if (q.type === "rating" || q.type === "scale") {
          const num = Number(val);
          if (Number.isNaN(num)) {
            newErrors[q.id] = "Please select a valid number";
            continue;
          }
          if (q.type === "rating" && (num < 1 || num > 5)) {
            newErrors[q.id] = "Rating must be between 1 and 5";
            continue;
          }
        } else if (q.type === "yesno") {
          if (!val || (val !== "yes" && val !== "no" && val !== true && val !== false)) {
            newErrors[q.id] = "Please choose yes or no";
            continue;
          }
        }
      }

      if (q.id.startsWith("issueDesc")) {
        const toggleKey = getIssueToggleKey(q.id);
        if (isYes(answers[toggleKey])) {
          if (!val || String(val).trim() === "") {
            newErrors[q.id] = "Please describe the issue";
            continue;
          }
        }
      }

      if (q.id.toLowerCase().includes("contactemail")) {
        const followKey = getFollowUpKey(q.id);
        if (isYes(answers[followKey])) {
          if (!val || String(val).trim() === "") {
            newErrors[q.id] = "Email is required because you requested follow-up";
            continue;
          }
          if (!emailRegex.test(String(val).trim())) {
            newErrors[q.id] = "Enter a valid email address";
            continue;
          }
        } else {
          if (val && String(val).trim() !== "" && !emailRegex.test(String(val).trim())) {
            newErrors[q.id] = "Enter a valid email address";
            continue;
          }
        }
      }

      if (q.validation === "email" && val) {
        if (!emailRegex.test(String(val).trim())) {
          newErrors[q.id] = "Enter a valid email address";
          continue;
        }
      }
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      setTimeout(() => {
        const firstKey = Object.keys(newErrors)[0];
        if (typeof document !== "undefined") {
          const el = document.querySelector(`[name="${firstKey}"]`);
          if (el) el.focus();
        }

      }, 50);
    }

    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (id, value) => {
    setAnswers((prev) => ({ ...prev, [id]: value }));
    setErrors((prev) => {
      if (!prev[id]) return prev;
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
  };

  const handleCancel = () => {
    try {
      if (typeof postSubmitCallback === "function") {
        postSubmitCallback({ submitted: false });
      }
    } finally {
      closeFeedback();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;

    if (!validate()) return;
    setSubmitting(true);

    const questionMeta = Array.isArray(questions)
      ? questions.map((q) => ({
        id: q.id,
        label: q.label,
        type: q.type || "text",
        required: !!q.required,
        validation: q.validation || null,
        options: Array.isArray(q.options) ? q.options : undefined
      }))
      : undefined;

    // Resolve user fields: explicit external fields first, then userObj, then answers
    // const resolvedUserId = externalUserId || (userObj && (userObj._id || userObj.id)) || null;
    // const resolvedUserName = externalUserName || (userObj && (userObj.name || userObj.schoolName || userObj.displayName)) || (answers.contactName || null);
    // const resolvedUserEmail = externalUserEmail || (userObj && (userObj.email || userObj.schoolEmail || userObj.contactEmail)) || (answers.contactEmail || null);

    const payload = {
      flow,

      // 🔥 Always use snapshots from context (not userObj)
      userId: externalUserId || null,
      userName: externalUserName || null,
      userEmail: externalUserEmail || null,

      // Optional full user object — safe to keep
      user: userObj || null,

      triggeredBy: triggerInfo?.type,
      page: triggerInfo?.page,
      answers,
      questionMeta,
      meta: {
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null,
        path: typeof window !== "undefined" ? window.location.pathname : null
      }

    };


    // Debug during dev:
    // console.log("Feedback payload:", payload);

    try {
      let data;
      let isOk = true;
      let status = 200;

      try {
        const res = await axios.post("/api/feedback", payload);
        data = res.data;
        status = res.status;
      } catch (err) {
        isOk = false;
        status = err.response?.status;
        data = err.response?.data;
      }

      if (!isOk && status === 409 && data?.message === "already_submitted") {
        if (typeof postSubmitCallback === "function") {
          postSubmitCallback({ submitted: true, id: data?.id || null, serverResponse: data });
        }
        closeFeedback();
        return;
      }

      if (!isOk) throw new Error(data?.message || "Submit failed");

      if (typeof postSubmitCallback === "function") {
        postSubmitCallback({ submitted: true, id: data?.id });
      }
      closeFeedback();
    } catch (err) {
      console.error("Feedback submit error:", err);
      alert(err?.message || "Could not submit feedback. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const renderError = (id) => errors[id] ? <p className="text-red-500 text-xs mt-1">{errors[id]}</p> : null;

  const shouldShowIssueDesc = (descId) => isYes(answers[getIssueToggleKey(descId)]);
  const shouldShowContactEmail = (contactId) => isYes(answers[getFollowUpKey(contactId)]);

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/60 p-4 font-poppins">
      <form onSubmit={handleSubmit} className="bg-white w-full max-w-2xl rounded-2xl shadow-lg p-6 animate-fadeIn max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center border-b pb-3 mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Your Feedback</h2>
          <button type="button" onClick={handleCancel} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>

        <div className="space-y-6">
          {questions.map((q) => {
            if (q.id.startsWith("issueDesc") && !shouldShowIssueDesc(q.id)) return null;
            if (q.id.toLowerCase().includes("contactemail") && !shouldShowContactEmail(q.id)) return null;

            const value = answers[q.id];
            return (
              <div key={q.id}>
                <label className="text-sm font-medium text-gray-700">
                  {q.label} {q.required && <span className="text-red-500">*</span>}
                </label>

                {q.type === "rating" && (
                  <div className="flex gap-3 mt-2">
                    {[1, 2, 3, 4, 5].map(n => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => handleChange(q.id, n)}
                        className={`px-4 py-2 rounded-lg border transition font-medium ${value === n ? "bg-blue-600 text-white border-blue-600" : "bg-gray-100 border-gray-300 hover:bg-gray-200"}`}
                        name={q.id}
                      >{n}</button>
                    ))}
                  </div>
                )}

                {q.type === "scale" && (
                  <div className="mt-2">
                    <input name={q.id} type="range" min={q.min ?? 0} max={q.max ?? 10} value={value || 0}
                      onChange={(e) => handleChange(q.id, Number(e.target.value))} className="w-full accent-blue-600" />
                    <p className="text-sm text-gray-600">Selected: {value || 0}</p>
                  </div>
                )}

                {q.type === "yesno" && (
                  <div className="flex gap-4 mt-2">
                    {["yes", "no"].map(opt => (
                      <button key={opt} type="button" name={q.id} onClick={() => handleChange(q.id, opt)}
                        className={`px-4 py-2 rounded-lg border capitalize ${value === opt ? "bg-blue-600 text-white border-blue-600" : "bg-gray-100 border-gray-300 hover:bg-gray-200"}`}>
                        {opt}
                      </button>
                    ))}
                  </div>
                )}

                {q.type === "select" && (
                  <select name={q.id} value={value} onChange={(e) => handleChange(q.id, e.target.value)} className="w-full border p-2 rounded-lg mt-2">
                    <option value="">Select...</option>
                    {q.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                )}

                {q.type === "text" && (
                  <input name={q.id} type="text" className="w-full border p-2 rounded-lg mt-2" placeholder={q.placeholder}
                    value={value} onChange={(e) => handleChange(q.id, e.target.value)} />
                )}

                {q.type === "textarea" && (
                  <textarea name={q.id} className="w-full border p-2 rounded-lg mt-2" rows={q.rows || 3} placeholder={q.placeholder}
                    value={value} onChange={(e) => handleChange(q.id, e.target.value)} />
                )}

                {q.id.toLowerCase().includes("contactemail") && (
                  <p className="text-xs text-gray-500 mt-1">Provide your email only if you requested follow-up.</p>
                )}

                {renderError(q.id)}
              </div>
            );
          })}
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button type="button" onClick={handleCancel} className="px-4 py-2 rounded-lg border hover:bg-gray-100">Cancel</button>
          <button type="submit" disabled={submitting} className="px-5 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 shadow-md disabled:bg-gray-400">
            {submitting ? "Submitting..." : "Submit"}
          </button>
        </div>
      </form>
    </div>
  );
}
