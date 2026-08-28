// components/UserCard.jsx
import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import jsPDF from "jspdf";

import {
  AiOutlineClose,
  AiOutlineCalendar,
  AiOutlineLink,
  AiOutlineMail,
  AiOutlineBook,
  AiOutlineEnvironment,
  AiOutlineUser,
  AiOutlineTag,
  AiOutlineDownload,
  AiOutlineCheck,
  AiOutlineCloseCircle,
  AiOutlineCamera
} from "react-icons/ai";

import { MdLocationPin } from "react-icons/md";

const UserCard = ({ user, onClose, onApprove, onReject, onRequestReverify, className = "" }) => {
  const cardRef = useRef(null);

  // ✅ Selfie popup modal
  const [isSelfieOpen, setIsSelfieOpen] = useState(false);

  useEffect(() => {
    if (!user) return;

    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    // ✅ Prevent background scroll even if your app scrolls in a wrapper div
    const preventScrollOutsideCard = (e) => {
      const cardEl = cardRef.current;
      if (cardEl && cardEl.contains(e.target)) return; // allow scroll inside card
      e.preventDefault();
    };

    window.addEventListener("wheel", preventScrollOutsideCard, { passive: false });
    window.addEventListener("touchmove", preventScrollOutsideCard, { passive: false });

    return () => {
      window.removeEventListener("wheel", preventScrollOutsideCard);
      window.removeEventListener("touchmove", preventScrollOutsideCard);

      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
    };
  }, [user]);

  // ✅ Close selfie popup on ESC
  useEffect(() => {
    if (!isSelfieOpen) return;

    const onKeyDown = (e) => {
      if (e.key === "Escape") setIsSelfieOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isSelfieOpen]);

  if (!user) return null;

  const formatDate = (dateString) => {
    if (!dateString) return "Not provided";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "Invalid date";
    return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  };

  const getAvatarInitial = (name) => {
    if (!name) return "U";
    const names = name.trim().split(' ');
    if (names.length > 1) {
      return (names[0].charAt(0) + names[names.length - 1].charAt(0)).toUpperCase();
    }
    return name.charAt(0).toUpperCase();
  };

  const getAvatarColor = (name) => {
    if (!name) return "from-blue-500 to-purple-600";

    const colors = [
      "from-blue-500 to-purple-600",
      "from-green-500 to-teal-600",
      "from-orange-500 to-red-600",
      "from-purple-500 to-pink-600",
      "from-teal-500 to-cyan-600",
    ];

    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  };

  const getAgeVerificationPhotoUrl = (u) => {
    return (
      u?.ageVerificationPhotoUrl ||
      u?.ageGateConsent?.ageVerificationPhotoUrl || // optional support (if you later send nested)
      ""
    );
  };

  // ✅ Status pill styles (modern)
  const getStatusPill = (status) => {
    switch (status) {
      case "Approved":
        return {
          pill: "bg-emerald-50 text-emerald-700 border-emerald-200",
          dot: "bg-emerald-500",
        };
      case "Rejected":
        return {
          pill: "bg-red-50 text-red-700 border-red-200",
          dot: "bg-red-500",
        };
      default:
        return {
          pill: "bg-amber-50 text-amber-700 border-amber-200",
          dot: "bg-amber-500",
        };
    }
  };

  // ✅ Age category helper
  const getUserAgeCategory = (u) => {
    return u?.ageCategory || u?.ageGateConsent?.ageCategory || "";
  };

  // ✅ Helpers to handle long text / urls in chips  ✅ ADD HERE
  const isUrl = (v) => typeof v === "string" && /^https?:\/\//i.test(v.trim());

  const prettyUrlLabel = (url) => {
    try {
      const u = new URL(url);
      const path = (u.pathname || "/").replace(/\/$/, "");
      return `${u.hostname}${path === "" ? "" : path}`;
    } catch {
      return (url || "").toString().replace(/^https?:\/\//i, "");
    }
  };

  // ── Colour palette ─────────────────────────────────────────────────────────
  const C = {
    navy:      [30,  45,  78],
    brand:     [59, 111, 219],
    accent:    [91, 141, 239],
    lightBg:   [244, 247, 254],
    midGrey:   [100, 116, 139],
    lightGrey: [203, 213, 225],
    textDark:  [15,  23,  42],
    white:     [255, 255, 255],
    green:     [6,   95,  70],
    greenBg:   [209, 250, 229],
    red:       [153, 27,  27],
    redBg:     [254, 226, 226],
    amber:     [146, 64,  14],
    amberBg:   [254, 243, 199],
  };

  const formatDOB = (raw) => {
    if (!raw) return "Not provided";
    try {
      const parts = raw.split(" ");
      if (parts.length >= 4) {
        const months = { Jan:1,Feb:2,Mar:3,Apr:4,May:5,Jun:6,Jul:7,Aug:8,Sep:9,Oct:10,Nov:11,Dec:12 };
        const m = months[parts[1]]; const d = parts[2]; const y = parts[3];
        if (m && d && y) return `${d} ${parts[1]} ${y}`;
      }
      const dt = new Date(raw.split("T")[0]);
      if (!isNaN(dt)) return dt.toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"numeric" });
    } catch {}
    return raw;
  };

  const downloadPDF = (user) => {
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const PW = 210; const PH = 297;
    const MX = 18; const CW = PW - MX * 2;

    const setFill = (arr) => doc.setFillColor(...arr);
    const setDraw = (arr) => doc.setDrawColor(...arr);
    const setTxt  = (arr) => doc.setTextColor(...arr);

    // ── HEADER BANNER ────────────────────────────────────────────────────────
    const bannerH = 54;
    setFill(C.navy); doc.rect(0, 0, PW, bannerH, "F");

    // Accent stripe
    setFill(C.brand);
    doc.setGState(doc.GState({ opacity: 0.18 }));
    doc.triangle(PW * 0.58, 0, PW, 0, PW * 0.75, bannerH, "F");
    doc.triangle(PW * 0.75, bannerH, PW, 0, PW, bannerH, "F");
    doc.setGState(doc.GState({ opacity: 1 }));

    // Avatar circle
    const ax = MX + 14; const ay = bannerH / 2;
    setFill(C.accent); doc.circle(ax, ay, 13, "F");

    const name = user.name || "User";
    const parts = name.trim().split(" ");
    const initials = (parts[0][0] + (parts.length > 1 ? parts[parts.length-1][0] : "")).toUpperCase();
    doc.setFont("helvetica", "bold"); doc.setFontSize(16); setTxt(C.white);
    doc.text(initials, ax, ay + 2.5, { align: "center" });

    // Name + email
    const nx = ax + 13 + 6;
    doc.setFont("helvetica", "bold"); doc.setFontSize(19); setTxt(C.white);
    doc.text(name, nx, 20);
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); setTxt(C.lightGrey);
    doc.text(user.email || "", nx, 29);

    // Status pill
    const status = user.status || "Pending";
    const [pillBg, pillFg] =
      status === "Approved" ? [C.greenBg, C.green]
      : status === "Rejected" ? [C.redBg, C.red]
      : [C.amberBg, C.amber];
    doc.setFont("helvetica", "bold"); doc.setFontSize(8);
    const pillW = doc.getTextWidth(`  ${status}  `) + 4;
    setFill(pillBg); doc.roundedRect(nx, 35, pillW, 7, 2, 2, "F");
    setTxt(pillFg); doc.text(`  ${status}`, nx + 1, 40.5);

    // Generated date
    const today = new Date().toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"numeric" });
    doc.setFont("helvetica", "bold"); doc.setFontSize(7); setTxt(C.accent);
    doc.text("SKILLNAAV ADMIN PORTAL", PW - MX, 18, { align: "right" });
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); setTxt(C.lightGrey);
    doc.text(`Generated: ${today}`, PW - MX, 10, { align: "right" });

    // ── SECTION CARD HELPER ──────────────────────────────────────────────────
    const sectionCard = (title, rows, x, y, w) => {
      const visible = rows.filter(([, v]) => v && String(v).trim() !== "" && v !== "N/A");
      if (!visible.length) return y;
      const rowH = 9; const padX = 5; const padTop = 8; const padBot = 4;
      const labelW = 38; const valX = x + padX + 3 + labelW;
      const cardH = padTop + visible.length * rowH + padBot;

      // Card bg
      setFill(C.lightBg); doc.roundedRect(x, y, w, cardH, 3, 3, "F");
      // Left bar
      setFill(C.brand); doc.roundedRect(x, y, 3, cardH, 1, 1, "F");

      // Title
      doc.setFont("helvetica", "bold"); doc.setFontSize(7); setTxt(C.brand);
      doc.text(title.toUpperCase(), x + padX + 3, y + 6.5);

      // Divider
      setDraw(C.lightGrey); doc.setLineWidth(0.3);
      doc.line(x + padX + 3, y + padTop - 1, x + w - padX, y + padTop - 1);

      // Rows
      visible.forEach(([label, value], i) => {
        const ry = y + padTop + i * rowH + 6;
        doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); setTxt(C.midGrey);
        doc.text(label, x + padX + 3, ry);
        doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); setTxt(C.textDark);
        const lines = doc.splitTextToSize(String(value), w - padX * 2 - labelW - 3);
        doc.text(lines[0], valX, ry); // single line per row to keep layout tight
        // Row separator
        if (i < visible.length - 1) {
          setDraw(C.lightGrey); doc.setLineWidth(0.2);
          doc.line(x + padX + 3, y + padTop + (i+1) * rowH + 0.5,
                   x + w - padX,  y + padTop + (i+1) * rowH + 0.5);
        }
      });
      return y + cardH + 5;
    };

    // ── CHIP SECTION HELPER ──────────────────────────────────────────────────
    const chipSection = (title, items, x, y, w, chipBg, chipFg) => {
      if (!items || !items.length) return y;
      const padX = 5; const chipH = 6; const chipGap = 2; const fontSz = 7.5;
      // build rows
      const rows = [[]]; let rowW = 0;
      items.forEach(s => {
        doc.setFont("helvetica", "bold"); doc.setFontSize(fontSz);
        const cw = doc.getTextWidth(s) + 10;
        if (rows[rows.length-1].length && rowW + cw > w - padX * 2 - 3) {
          rows.push([]); rowW = 0;
        }
        rows[rows.length-1].push(s); rowW += cw + chipGap;
      });
      const cardH = 8 + rows.length * (chipH + chipGap) + padX;
      setFill(C.lightBg); doc.roundedRect(x, y, w, cardH, 3, 3, "F");
      setFill(C.brand); doc.roundedRect(x, y, 3, cardH, 1, 1, "F");
      doc.setFont("helvetica", "bold"); doc.setFontSize(7); setTxt(C.brand);
      doc.text(title.toUpperCase(), x + padX + 3, y + 6.5);
      setDraw(C.lightGrey); doc.setLineWidth(0.3);
      doc.line(x + padX + 3, y + 8 - 1, x + w - padX, y + 8 - 1);

      let cy = y + 8 + chipGap;
      rows.forEach(row => {
        let cx = x + padX + 3;
        row.forEach(s => {
          doc.setFont("helvetica", "bold"); doc.setFontSize(fontSz);
          const cw = doc.getTextWidth(s) + 10;
          setFill(chipBg); doc.roundedRect(cx, cy, cw, chipH, 2, 2, "F");
          setTxt(chipFg); doc.text(s, cx + 5, cy + 4.2);
          cx += cw + chipGap;
        });
        cy += chipH + chipGap;
      });
      return y + cardH + 5;
    };

    // ── TWO-COLUMN BODY ──────────────────────────────────────────────────────
    const colGap = 4; const colW = (CW - colGap) / 2;
    const col1X = MX; const col2X = MX + colW + colGap;
    let c1Y = bannerH + 8; let c2Y = bannerH + 8;

    // Col 1
    c1Y = sectionCard("Personal Information", [
      ["Full Name",    user.name],
      ["Date of Birth", formatDOB(user.dob)],
      ["City",         user.city],
      ["Country",      user.country],
      ["State",        user.state],
      ["Postal Code",  user.postalCode],
      ["Address",      user.address],
    ], col1X, c1Y, colW);

    c1Y = sectionCard("Academic Background", [
      ["University",      user.universityName],
      ["Education Level", (user.educationLevel||"").replace("highschool","High School").replace(/^\w/,c=>c.toUpperCase())],
      ["Field of Study",  user.fieldOfStudy],
      ["Desired Field",   user.desiredField],
      ["Current Grade",   user.currentGrade],
      ["Grade %",         user.gradePercentage],
    ], col1X, c1Y, colW);

    sectionCard("Financial & Plan", [
      ["Financial Status", user.financialStatus],
      ["Plan Type",        user.planType],
      ["Premium",          user.isPremium ? "Yes" : "No"],
    ], col1X, c1Y, colW);

    // Col 2
    c2Y = sectionCard("Contact & Links", [
      ["Email",     user.email],
      ["LinkedIn",  user.linkedin],
      ["Portfolio", user.portfolio],
    ], col2X, c2Y, colW);

    c2Y = chipSection("Skills", user.skills, col2X, c2Y, colW,
      [219, 234, 254], [30, 64, 175]);

    c2Y = chipSection("Interests", user.interests, col2X, c2Y, colW,
      [250, 232, 255], [107, 33, 168]);

    if ((user.preferredLocations||[]).length) {
      sectionCard("Preferred Locations",
        (user.preferredLocations||[]).map(l => [l, l]),
        col2X, c2Y, colW);
    }

    // ── FOOTER ───────────────────────────────────────────────────────────────
    const footerY = PH - 14;
    setDraw(C.lightGrey); doc.setLineWidth(0.3);
    doc.line(MX, footerY - 4, PW - MX, footerY - 4);
    doc.setFont("helvetica", "normal"); doc.setFontSize(6.5); setTxt(C.midGrey);
    doc.text("This document is confidential and intended for administrative use only.",
      PW / 2, footerY, { align: "center" });
    doc.setFont("helvetica", "bold"); setTxt(C.navy);
    doc.text(`Skillnaav · Student Application Profile · ${today}`,
      PW / 2, footerY + 4, { align: "center" });
    doc.setFont("helvetica", "normal"); doc.setFontSize(7); setTxt(C.midGrey);
    doc.text("Page 1", PW - MX, footerY + 4, { align: "right" });

    doc.save(`${user.name || "User"}_Profile.pdf`);
  };

  return (
    <div className="w-full">
      <motion.div
        ref={cardRef}
        className={`relative bg-white rounded-2xl shadow-xl border border-gray-200 pt-6 px-6 pb-4 w-full max-w-4xl h-[92vh] overflow-hidden flex flex-col font-poppins ${className}`}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition z-10"
          aria-label="Close"
        >
          <AiOutlineClose size={20} />
        </button>

        {/* Header */}
        <div className="flex items-start gap-5 pb-3 border-b border-gray-200 shrink-0 pr-14">
          <div className="relative flex-shrink-0">
            {user.profileImage ? (
              <img
                src={user.profileImage}
                alt={user.name}
                className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-lg"
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.parentNode.innerHTML = `
                  <div class="w-24 h-24 rounded-full border-4 border-white shadow-lg flex items-center justify-center text-white font-bold text-3xl bg-gradient-to-br ${getAvatarColor(user.name)}">
                    ${getAvatarInitial(user.name)}
                  </div>
                `;
                }}
              />
            ) : (
              <div className={`w-24 h-24 rounded-full border-4 border-white shadow-lg flex items-center justify-center text-white font-bold text-3xl bg-gradient-to-br ${getAvatarColor(user.name)}`}>
                {getAvatarInitial(user.name)}
              </div>
            )}
          </div>

          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-900">{user.name || "No name"}</h2>
            <p className="text-base text-gray-600 flex items-center gap-2 mt-1">
              <AiOutlineMail className="text-sky-600" />
              {user.email || "No email"}
            </p>
            {user.universityName && (
              <p className="text-sm font-medium text-sky-700 bg-sky-50 px-3 py-1 rounded-full mt-2 inline-block">
                {user.universityName}
              </p>
            )}

            {/* ✅ Status + Age Category (Modern UI) */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {/* Status */}
              <span
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border shadow-sm ${getStatusPill(user.status).pill}`}
              >
                <span className={`h-2 w-2 rounded-full ${getStatusPill(user.status).dot}`} />
                {user.status || "Pending Approval"}
              </span>

              {/* Age Category */}
              {getUserAgeCategory(user) && (
                <span
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border shadow-sm ${getUserAgeCategory(user) === "OVER_18"
                    ? "bg-cyan-50 text-cyan-700 border-cyan-200"
                    : "bg-purple-50 text-purple-700 border-purple-200"
                    }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full ${getUserAgeCategory(user) === "OVER_18" ? "bg-cyan-500" : "bg-purple-500"
                      }`}
                  />
                  {getUserAgeCategory(user) === "OVER_18" ? "Over 18" : "Under 18"}
                </span>
              )}
            </div>
          </div>

          {/* ✅ OVER_18 Age Verification Selfie (Top-right) */}
          {user?.ageCategory === "OVER_18" && getAgeVerificationPhotoUrl(user) && (
            <div className="hidden md:block ml-auto w-64 shrink-0">
              <div className="rounded-xl border border-gray-200 overflow-hidden bg-white shadow-sm">
                {/* Title bar */}
                <div className="px-3 py-2 border-b border-gray-100 flex items-center gap-2">
                  <AiOutlineCamera className="text-sky-600" />
                  <span className="text-xs font-semibold text-gray-700">
                    Age Verification Selfie
                  </span>
                </div>

                {/* Image */}
                <div className="w-full h-24 bg-gray-50 flex items-center justify-center">
                  <img
                    src={getAgeVerificationPhotoUrl(user)}
                    alt="Age verification selfie"
                    className="w-full h-full object-contain cursor-zoom-in"
                    loading="lazy"
                    onClick={() => setIsSelfieOpen(true)}
                  />
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Scrollable Details Section */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain pb-6 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {/* Modern Details UI Wrapper */}
          <div className="space-y-6">

            {/* Two Columns Layout (Modern Cards) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
              {/* Personal & Academic */}
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center">
                    <AiOutlineUser className="text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-gray-900">Personal & Academic</h3>
                    <p className="text-xs text-gray-500">Profile and education details</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {user.dob && (
                    <div className="flex items-start gap-3">
                      <AiOutlineCalendar className="mt-0.5 text-indigo-600" />
                      <div>
                        <p className="text-xs font-semibold text-gray-500">Date of Birth</p>
                        <p className="text-sm font-semibold text-gray-900">{formatDate(user.dob)}</p>
                      </div>
                    </div>
                  )}

                  {user.educationLevel && (
                    <div className="flex items-start gap-3">
                      <AiOutlineBook className="mt-0.5 text-indigo-600" />
                      <div>
                        <p className="text-xs font-semibold text-gray-500">Education Level</p>
                        <p className="text-sm font-semibold text-gray-900 capitalize">{user.educationLevel}</p>
                      </div>
                    </div>
                  )}

                  {user.fieldOfStudy && (
                    <div className="flex items-start gap-3">
                      <AiOutlineBook className="mt-0.5 text-indigo-600" />
                      <div>
                        <p className="text-xs font-semibold text-gray-500">Current Field</p>
                        <p className="text-sm font-semibold text-gray-900">{user.fieldOfStudy}</p>
                      </div>
                    </div>
                  )}

                  {user.desiredField && (
                    <div className="flex items-start gap-3">
                      <AiOutlineTag className="mt-0.5 text-indigo-600" />
                      <div>
                        <p className="text-xs font-semibold text-gray-500">Desired Field</p>
                        <p className="text-sm font-semibold text-gray-900">{user.desiredField}</p>
                      </div>
                    </div>
                  )}

                  {!user.dob && !user.educationLevel && !user.fieldOfStudy && !user.desiredField && (
                    <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
                      No personal/academic details provided.
                    </div>
                  )}
                </div>
              </div>

              {/* Location & Details */}
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm mb-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center">
                    <AiOutlineEnvironment className="text-teal-700" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-gray-900">Location & Details</h3>
                    <p className="text-xs text-gray-500">Contact and address info</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {(user.city || user.state || user.country) && (
                    <div className="flex items-start gap-3">
                      <MdLocationPin className="mt-0.5 text-teal-600" />
                      <div>
                        <p className="text-xs font-semibold text-gray-500">Location</p>
                        <p className="text-sm font-semibold text-gray-900">
                          {user.city ? user.city : ""}
                          {(user.state || user.country) ? (
                            <>
                              {user.city ? ", " : ""}
                              {user.state ? user.state : ""}
                              {user.state && user.country ? ", " : ""}
                              {user.country ? user.country : ""}
                            </>
                          ) : null}
                        </p>
                      </div>
                    </div>
                  )}

                  {user.address && (
                    <div className="flex items-start gap-3">
                      <AiOutlineEnvironment className="mt-0.5 text-teal-600" />
                      <div>
                        <p className="text-xs font-semibold text-gray-500">Address</p>
                        <p className="text-sm font-semibold text-gray-900">{user.address}</p>
                      </div>
                    </div>
                  )}

                  {user.phone && (
                    <div className="flex items-start gap-3">
                      <AiOutlineUser className="mt-0.5 text-teal-600" />
                      <div>
                        <p className="text-xs font-semibold text-gray-500">Phone Number</p>
                        <p className="text-sm font-semibold text-gray-900">{user.phone}</p>
                      </div>
                    </div>
                  )}

                  {!user.city && !user.state && !user.country && !user.address && !user.phone && (
                    <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
                      No location/details provided.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Skills + Interests (Improved: no stretching, urls clickable) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* Skills */}
              <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center">
                      <AiOutlineTag className="text-orange-600" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-gray-900 leading-tight">Skills</h3>
                      <p className="text-xs text-gray-500">What the user can do</p>
                    </div>
                  </div>

                  <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-700">
                    {(user.skills || []).length} skills
                  </span>
                </div>

                <div className="p-5">
                  {(user.skills || []).length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {user.skills.map((skill, i) => {
                        const v = (skill || "").toString().trim();
                        const url = isUrl(v) ? v : null;
                        const label = url ? prettyUrlLabel(url) : v;

                        const chip = (
                          <span className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-semibold text-orange-800 max-w-full">
                            {url && <AiOutlineLink className="text-orange-700 shrink-0" />}
                            <span
                              className="truncate max-w-[240px] sm:max-w-[300px]"
                              title={v}
                            >
                              {label}
                            </span>
                          </span>
                        );

                        return url ? (
                          <a
                            key={i}
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="max-w-full hover:opacity-90 transition"
                            title={v}
                          >
                            {chip}
                          </a>
                        ) : (
                          <span key={i} className="max-w-full">
                            {chip}
                          </span>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
                      No skills listed
                    </div>
                  )}
                </div>
              </div>

              {/* Interests */}
              <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-fuchsia-50 border border-fuchsia-100 flex items-center justify-center">
                      <AiOutlineBook className="text-fuchsia-600" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-gray-900 leading-tight">Interests</h3>
                      <p className="text-xs text-gray-500">Topics they enjoy</p>
                    </div>
                  </div>

                  <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-700">
                    {(user.interests || []).length} interests
                  </span>
                </div>

                <div className="p-5">
                  {(user.interests || []).length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {user.interests.map((interest, i) => {
                        const v = (interest || "").toString().trim();
                        const url = isUrl(v) ? v : null;
                        const label = url ? prettyUrlLabel(url) : v;

                        return url ? (
                          <a
                            key={i}
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="max-w-full hover:opacity-90 transition"
                            title={v}
                          >
                            <span className="inline-flex items-center gap-2 rounded-full border border-fuchsia-200 bg-fuchsia-50 px-3 py-1.5 text-xs font-semibold text-fuchsia-800 max-w-full hover:bg-fuchsia-100 transition">
                              <AiOutlineLink className="text-fuchsia-700 shrink-0" />
                              <span className="truncate max-w-[240px] sm:max-w-[300px]">
                                {label}
                              </span>
                            </span>
                          </a>
                        ) : (
                          <span
                            key={i}
                            className="inline-flex items-center gap-2 rounded-full border border-fuchsia-200 bg-fuchsia-50 px-3 py-1.5 text-xs font-semibold text-fuchsia-800 max-w-full"
                            title={v}
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-fuchsia-600 shrink-0" />
                            <span className="truncate max-w-[240px] sm:max-w-[300px]">
                              {label}
                            </span>
                          </span>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
                      No interests listed
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* Preferred Locations (Improved: no stretching, urls clickable if any) */}
            {(user.preferredLocations || []).length > 0 && (
              <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center">
                      <MdLocationPin className="text-emerald-600" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-gray-900 leading-tight">Preferred Locations</h3>
                      <p className="text-xs text-gray-500">Where they want to work</p>
                    </div>
                  </div>

                  <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-700">
                    {user.preferredLocations.length} locations
                  </span>
                </div>

                <div className="p-5">
                  <div className="flex flex-wrap gap-2">
                    {user.preferredLocations.map((loc, i) => {
                      const v = (loc || "").toString().trim();
                      const url = isUrl(v) ? v : null;
                      const label = url ? prettyUrlLabel(url) : v;

                      return url ? (
                        <a
                          key={i}
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="max-w-full hover:opacity-90 transition"
                          title={v}
                        >
                          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 max-w-full hover:bg-emerald-100 transition">
                            <AiOutlineLink className="text-emerald-700 shrink-0" />
                            <span className="truncate max-w-[280px] sm:max-w-[360px]">
                              {label}
                            </span>
                          </span>
                        </a>
                      ) : (
                        <span
                          key={i}
                          className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 max-w-full"
                          title={v}
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 shrink-0" />
                          <span className="truncate max-w-[280px] sm:max-w-[360px]">
                            {label}
                          </span>
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* ✅ Consent Details (UNDER_18 only) - add this AFTER Links section */}
            {getUserAgeCategory(user) === "UNDER_18" &&
              (user.guardianName || user.guardianEmail || user.guardianRelationship) && (
                <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-10 w-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center">
                      <AiOutlineUser className="text-amber-700" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-gray-900">Consent Details</h3>
                      <p className="text-xs text-gray-500">Guardian information (Under 18)</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {user.guardianName && (
                      <div className="flex items-start gap-3">
                        <AiOutlineUser className="mt-0.5 text-amber-700" />
                        <div>
                          <p className="text-xs font-semibold text-gray-500">Guardian Name</p>
                          <p className="text-sm font-semibold text-gray-900">{user.guardianName}</p>
                        </div>
                      </div>
                    )}

                    {user.guardianEmail && (
                      <div className="flex items-start gap-3">
                        <AiOutlineMail className="mt-0.5 text-amber-700" />
                        <div>
                          <p className="text-xs font-semibold text-gray-500">Guardian Email</p>
                          <a
                            href={`mailto:${user.guardianEmail}`}
                            className="text-sm font-semibold text-amber-700 hover:underline break-all"
                          >
                            {user.guardianEmail}
                          </a>
                        </div>
                      </div>
                    )}

                    {user.guardianRelationship && (
                      <div className="flex items-start gap-3">
                        <AiOutlineTag className="mt-0.5 text-amber-700" />
                        <div>
                          <p className="text-xs font-semibold text-gray-500">Relationship</p>
                          <p className="text-sm font-semibold text-gray-900">{user.guardianRelationship}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
          </div>
        </div>

        {/* ✅ Footer Action Buttons (Modern + Small) */}
        <div className="shrink-0 pt-3 border-t border-gray-200 flex flex-wrap items-center justify-end gap-2">

          {/* Download */}
          <button
            type="button"
            onClick={() => downloadPDF(user)}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold
      border border-blue-200 bg-blue-50 text-blue-700 shadow-sm
      hover:bg-blue-100 hover:border-blue-300
      focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-2
      active:scale-[0.98] transition"
          >
            <AiOutlineDownload className="text-[16px]" />
            Download PDF
          </button>

          {/* Re-Verification */}
          {user?.ageCategory === "OVER_18" && getAgeVerificationPhotoUrl(user) && (
            <button
              type="button"
              onClick={() => onRequestReverify?.(user._id)}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold
        border border-amber-200 bg-amber-50 text-amber-800 shadow-sm
        hover:bg-amber-100 hover:border-amber-300
        focus:outline-none focus:ring-2 focus:ring-amber-300 focus:ring-offset-2
        active:scale-[0.98] transition"
            >
              <AiOutlineCamera className="text-[16px]" />
              Ask Re-Verification
            </button>
          )}

          {/* Approve Button */}
          <button
            type="button"
            disabled={user.status === 'Approved'}
            onClick={() => {
              if (user.status === 'Approved') return; // guard
              onApprove?.(user.id);
              onClose?.();
            }}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold border shadow-sm
              focus:outline-none focus:ring-2 focus:ring-offset-2 active:scale-[0.98] transition
              ${user.status === 'Approved'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700 opacity-60 cursor-not-allowed'
                : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:border-emerald-300 focus:ring-emerald-300'
              }`}
          >
            <AiOutlineCheck className="text-[16px]" />
            {user.status === 'Approved' ? 'Approved' : 'Approve'}
          </button>

          {/* Reject Button */}
          <button
            type="button"
            disabled={user.status === 'Rejected'}
            onClick={() => {
              if (user.status === 'Rejected') return; // guard
              onReject?.(user.id);
              onClose?.();
            }}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold border shadow-sm
              focus:outline-none focus:ring-2 focus:ring-offset-2 active:scale-[0.98] transition
              ${user.status === 'Rejected'
                ? 'border-red-200 bg-red-50 text-red-700 opacity-60 cursor-not-allowed'
                : 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100 hover:border-red-300 focus:ring-red-300'
              }`}
          >
            <AiOutlineCloseCircle className="text-[16px]" />
            {user.status === 'Rejected' ? 'Rejected' : 'Reject'}
          </button>
        </div>
      </motion.div>

      {/* ✅ Selfie Popup Modal */}
      {isSelfieOpen && getAgeVerificationPhotoUrl(user) && (
        <div
          className="fixed inset-0 z-[9999] bg-black/60 flex items-center justify-center p-4"
          onClick={() => setIsSelfieOpen(false)}
        >
          <div
            className="relative w-full max-w-3xl rounded-2xl bg-white shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              type="button"
              onClick={() => setIsSelfieOpen(false)}
              className="absolute top-3 right-3 z-10 p-2 rounded-full bg-white/90 hover:bg-white shadow"
              aria-label="Close selfie preview"
            >
              <AiOutlineClose size={20} className="text-gray-700" />
            </button>

            {/* Image */}
            <div className="bg-black flex items-center justify-center p-2">
              <img
                src={getAgeVerificationPhotoUrl(user)}
                alt="Age verification selfie full view"
                className="max-h-[80vh] max-w-[95vw] object-contain cursor-zoom-out"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserCard;
