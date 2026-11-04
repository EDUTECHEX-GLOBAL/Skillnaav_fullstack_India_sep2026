import React, { useState } from "react";
import axios from "../../../../api/axiosInstance";
import { jsPDF } from "jspdf";

/**
 * CVBuilder — Edutechex branded CV / Resume builder modal.
 *
 * Props:
 *  - profile: the StudentProfile object from your API (or null)
 *  - onClose: function to close the modal
 */
const CVBuilder = ({ profile: propProfile, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  const getMergedProfile = () => {
    let localStudent = {};
    let localUser = {};
    try {
      localStudent = JSON.parse(localStorage.getItem("studentInfo") || "{}");
    } catch {}
    try {
      localUser = JSON.parse(localStorage.getItem("userInfo") || "{}");
    } catch {}

    const source = propProfile || localStudent || localUser || {};

    let flatSkills = [];
    if (Array.isArray(source.skills)) {
      flatSkills = source.skills
        .map((s) => (typeof s === "object" ? s.name || s.skill || "" : String(s)))
        .filter(Boolean);
    } else if (source.skills && typeof source.skills === "object") {
      flatSkills = [
        ...(Array.isArray(source.skills.technical) ? source.skills.technical : []),
        ...(Array.isArray(source.skills.soft) ? source.skills.soft : []),
      ]
        .map((s) => (typeof s === "object" ? s.name || s.skill || "" : String(s)))
        .filter(Boolean);
    }

    return {
      name: source.name || localStudent.name || localUser.name || "Student",
      email: source.email || localStudent.email || localUser.email || "",
      phone: source.phone || localStudent.phone || localUser.phone || "",
      linkedin: source.linkedin || localStudent.linkedin || localUser.linkedin || "",
      portfolio: source.portfolio || localStudent.portfolio || localUser.portfolio || "",
      universityName: source.universityName || localStudent.universityName || localUser.universityName || "",
      fieldOfStudy: source.fieldOfStudy || localStudent.fieldOfStudy || localUser.fieldOfStudy || "",
      educationLevel: source.educationLevel || localStudent.educationLevel || localUser.educationLevel || "",
      country: source.country || localStudent.country || localUser.country || "",
      skills: flatSkills.length > 0 ? flatSkills : ["Problem Solving", "Communication", "Teamwork"],
      summary: source.summary || "",
      experience: Array.isArray(source.experience) ? source.experience : [],
      projects: Array.isArray(source.projects) ? source.projects : [],
      certifications: Array.isArray(source.certifications) ? source.certifications : [],
      languages: Array.isArray(source.languages) ? source.languages : [],
    };
  };

  const generateClientSidePdf = (data) => {
    const doc = new jsPDF({ format: "a4", unit: "mm" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginX = 14;
    const contentWidth = pageWidth - marginX * 2;

    // Header Band
    doc.setFillColor(79, 70, 229); // #4F46E5
    doc.rect(0, 0, pageWidth, 38, "F");
    doc.setFillColor(129, 140, 248); // #818CF8
    doc.rect(0, 36.5, pageWidth, 1.5, "F");

    // Candidate Name
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    const candidateName = (data.name || "Resume").trim();
    doc.text(candidateName, marginX, 15);

    // Contact info
    const contactParts = [data.email, data.phone, data.country].filter(Boolean);
    if (contactParts.length) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(224, 231, 255);
      doc.text(contactParts.join("   ·   "), marginX, 23);
    }

    // Links
    const links = [data.linkedin, data.portfolio].filter(Boolean);
    if (links.length) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(7.5);
      doc.setTextColor(199, 210, 254);
      doc.text(links.join("   |   "), marginX, 30);
    }

    // Top Right Branding
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("edutechex", pageWidth - marginX, 15, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(199, 210, 254);
    doc.text("edutechexskills.com", pageWidth - marginX, 21, { align: "right" });

    let curY = 46;

    const checkPageBreak = (needed = 12) => {
      if (curY + needed > pageHeight - 16) {
        doc.addPage();
        doc.setDrawColor(79, 70, 229);
        doc.setLineWidth(0.5);
        doc.line(marginX, 12, pageWidth - marginX, 12);
        curY = 18;
      }
    };

    const drawSectionHeader = (title) => {
      checkPageBreak(14);
      curY += 3;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(79, 70, 229);
      doc.text(title.toUpperCase(), marginX, curY);

      const titleWidth = doc.getTextWidth(title.toUpperCase());
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.line(marginX + titleWidth + 3, curY - 1, pageWidth - marginX, curY - 1);
      curY += 5;
    };

    // Summary
    if (data.summary && data.summary.trim()) {
      drawSectionHeader("Professional Summary");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      const splitSummary = doc.splitTextToSize(data.summary.trim(), contentWidth);
      doc.text(splitSummary, marginX, curY);
      curY += splitSummary.length * 4 + 2;
    }

    // Education
    if (data.universityName || data.educationLevel || data.fieldOfStudy) {
      drawSectionHeader("Education");
      if (data.universityName) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(30, 41, 59);
        doc.text(data.universityName, marginX, curY);
        curY += 4;
      }
      const eduMeta = [data.educationLevel, data.fieldOfStudy].filter(Boolean).join("  ·  ");
      if (eduMeta) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(148, 163, 184);
        doc.text(eduMeta, marginX, curY);
        curY += 5;
      }
    }

    // Experience
    if (data.experience && data.experience.length > 0) {
      drawSectionHeader("Experience");
      data.experience.forEach((exp) => {
        checkPageBreak(16);
        const title = exp.title || exp.role || "Role";
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(30, 41, 59);
        doc.text(title, marginX, curY);
        curY += 3.5;

        const dateRange = [exp.startDate, exp.current ? "Present" : exp.endDate].filter(Boolean).join(" – ");
        const meta = [exp.company, exp.location, dateRange].filter(Boolean).join("   ·   ");
        if (meta) {
          doc.setFont("helvetica", "normal");
          doc.setFontSize(7.5);
          doc.setTextColor(148, 163, 184);
          doc.text(meta, marginX, curY);
          curY += 3.5;
        }

        if (exp.description) {
          doc.setFont("helvetica", "normal");
          doc.setFontSize(7.5);
          doc.setTextColor(71, 85, 105);
          const splitDesc = doc.splitTextToSize(exp.description, contentWidth);
          doc.text(splitDesc, marginX, curY);
          curY += splitDesc.length * 3.5 + 2;
        } else {
          curY += 2;
        }
      });
    }

    // Skills
    if (data.skills && data.skills.length > 0) {
      drawSectionHeader("Skills");
      checkPageBreak(12);
      let pillX = marginX;
      let pillY = curY;
      const pillH = 5;
      const gapX = 2;
      const gapY = 2;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);

      data.skills.forEach((skill) => {
        const text = String(skill).trim();
        if (!text) return;

        const tw = doc.getTextWidth(text);
        const pw = tw + 4;

        if (pillX + pw > pageWidth - marginX) {
          pillX = marginX;
          pillY += pillH + gapY;
          if (pillY + pillH > pageHeight - 16) {
            doc.addPage();
            pillY = 16;
          }
        }

        doc.setFillColor(241, 245, 249); // #F1F5F9
        doc.roundedRect(pillX, pillY - 3.5, pw, pillH, 1.5, 1.5, "F");
        doc.setTextColor(79, 70, 229);
        doc.text(text, pillX + 2, pillY);

        pillX += pw + gapX;
      });

      curY = pillY + pillH + 4;
    }

    // Projects
    if (data.projects && data.projects.length > 0) {
      drawSectionHeader("Projects");
      data.projects.forEach((proj) => {
        checkPageBreak(14);
        const pName = proj.name || proj.title || "Project";
        const heading = proj.link ? `${pName}  —  ${proj.link}` : pName;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(30, 41, 59);
        doc.text(heading, marginX, curY);
        curY += 3.5;

        const stack = Array.isArray(proj.techStack) ? proj.techStack.join(", ") : (proj.techStack || "");
        if (stack) {
          doc.setFont("helvetica", "normal");
          doc.setFontSize(7.5);
          doc.setTextColor(148, 163, 184);
          doc.text(`Tech Stack: ${stack}`, marginX, curY);
          curY += 3.5;
        }

        if (proj.description) {
          doc.setFont("helvetica", "normal");
          doc.setFontSize(7.5);
          doc.setTextColor(71, 85, 105);
          const splitDesc = doc.splitTextToSize(proj.description, contentWidth);
          doc.text(splitDesc, marginX, curY);
          curY += splitDesc.length * 3.5 + 2;
        } else {
          curY += 2;
        }
      });
    }

    // Certifications
    if (data.certifications && data.certifications.length > 0) {
      drawSectionHeader("Certifications");
      data.certifications.forEach((cert) => {
        checkPageBreak(10);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(30, 41, 59);
        doc.text(cert.name || cert.title || "", marginX, curY);
        curY += 3;

        const meta = [cert.issuer, cert.issueDate].filter(Boolean).join("   ·   ");
        if (meta) {
          doc.setFont("helvetica", "normal");
          doc.setFontSize(7);
          doc.setTextColor(148, 163, 184);
          doc.text(meta, marginX, curY);
          curY += 3.5;
        }
      });
    }

    // Languages
    if (data.languages && data.languages.length > 0) {
      drawSectionHeader("Languages");
      const langStr = data.languages
        .map((l) => (typeof l === "string" ? l : `${l.language || ""} (${l.proficiency || "Proficient"})`))
        .filter(Boolean)
        .join("    ·    ");
      if (langStr) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(71, 85, 105);
        doc.text(langStr, marginX, curY);
        curY += 5;
      }
    }

    // Footer on all pages
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Generated by Edutechex  ·  ${candidateName}  ·  edutechexskills.com`,
        pageWidth / 2,
        pageHeight - 8,
        { align: "center" }
      );
    }

    const safeName = candidateName.replace(/\s+/g, "_");
    doc.save(`Edutechex_CV_${safeName}.pdf`);
  };

  const resolveUserId = () => {
    if (propProfile?.userId) return propProfile.userId;
    if (propProfile?._id) return propProfile._id;
    if (propProfile?.id) return propProfile.id;

    try {
      const studentInfo = JSON.parse(localStorage.getItem("studentInfo") || "null");
      if (studentInfo?._id) return studentInfo._id;
      if (studentInfo?.userId) return studentInfo.userId;
    } catch {}

    try {
      const userInfo = JSON.parse(localStorage.getItem("userInfo") || "null");
      if (userInfo?._id) return userInfo._id;
      if (userInfo?.userId) return userInfo.userId;
    } catch {}

    const token =
      localStorage.getItem("userToken") ||
      localStorage.getItem("token") ||
      sessionStorage.getItem("userToken");
    if (token) {
      try {
        const parts = token.split(".");
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1]));
          if (payload?.id) return payload.id;
          if (payload?._id) return payload._id;
          if (payload?.userId) return payload.userId;
        }
      } catch {}
    }

    return null;
  };

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);

    const mergedData = getMergedProfile();
    const userId = resolveUserId();
    const token =
      localStorage.getItem("userToken") ||
      localStorage.getItem("token") ||
      sessionStorage.getItem("userToken");

    const headers = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const endpoint = userId ? `/api/cv/generate/${userId}` : `/api/cv/generate`;

    try {
      const response = await axios.post(
        endpoint,
        { userId, profile: mergedData },
        { responseType: "blob", headers, timeout: 12000 }
      );

      if (response.data && response.data.type === "application/json") {
        const text = await response.data.text();
        const json = JSON.parse(text);
        throw new Error(json.detail || json.message || "Server error");
      }

      const blob = new Blob([response.data], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const safeName = String(mergedData.name || "Resume").trim().replace(/\s+/g, "_");
      link.download = `Edutechex_CV_${safeName}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setDone(true);
    } catch (err) {
      console.warn("Backend CV generation failed, using instant client-side PDF generator fallback:", err.message);
      try {
        generateClientSidePdf(mergedData);
        setDone(true);
      } catch (fallbackErr) {
        console.error("Client side PDF generation error:", fallbackErr);
        setError("Failed to generate CV. Please check your profile details and try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-700 to-indigo-500 px-5 sm:px-6 py-4 sm:py-5 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
              </div>
              <div>
                <h2 className="text-white font-bold text-base sm:text-lg leading-tight">Generate Your CV</h2>
                <p className="text-indigo-200 text-xs">Edutechex-branded PDF resume</p>
              </div>
            </div>
            <button onClick={onClose} className="text-white/60 hover:text-white transition-colors p-1">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-5 sm:px-6 py-4 sm:py-5 space-y-4 overflow-y-auto flex-1">
          {/* Preview card */}
          <div className="bg-slate-50 rounded-xl border border-slate-100 p-3.5 sm:p-4 flex gap-3.5 items-start">
            <div className="w-12 h-16 bg-indigo-700 rounded-lg flex-shrink-0 flex items-end justify-center pb-1.5 shadow-sm">
              <span className="text-white text-[8px] font-bold">edutechex</span>
            </div>
            <div>
              <p className="font-semibold text-slate-800 text-sm">What you'll get</p>
              <ul className="text-slate-500 text-xs mt-1.5 space-y-1">
                {[
                  "Clean A4 PDF with Edutechex branding",
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
        <div className="px-5 sm:px-6 py-4 border-t border-slate-100 flex items-center gap-3 bg-white flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 sm:px-5 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-xs sm:text-sm font-medium hover:bg-slate-50 transition-colors whitespace-nowrap"
          >
            {done ? "Close" : "Cancel"}
          </button>
          <button
            onClick={handleGenerate}
            disabled={loading || done}
            className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 px-4 text-xs sm:text-sm font-semibold transition-all
              ${done
                ? "bg-emerald-500 text-white"
                : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm hover:shadow-indigo-200 hover:shadow-md"
              } disabled:opacity-60 cursor-pointer`}
          >
            {loading ? (
              <span className="inline-flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin flex-shrink-0" />
                <span className="whitespace-nowrap">Generating...</span>
              </span>
            ) : done ? (
              <span className="inline-flex items-center justify-center gap-2">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
                <span className="whitespace-nowrap">Downloaded!</span>
              </span>
            ) : (
              <span className="inline-flex items-center justify-center gap-2">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                <span className="whitespace-nowrap">Download CV (PDF)</span>
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CVBuilder;
