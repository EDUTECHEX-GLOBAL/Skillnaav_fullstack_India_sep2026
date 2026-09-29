/**
 * generateOfferPDFBuffer.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Professional internship offer letter — Edutechex
 *
 * FIXES IN THIS VERSION:
 *  - BODY_MAX_Y raised so content is NOT pushed to page 2 prematurely.
 *  - Page-break checks use accurate estimated heights.
 *  - Signature block placed immediately after content with smart overflow.
 *  - Footer rendered on every page via bufferedPageRange loop.
 *  - Edutechex logo embedded as base64 — no network needed.
 *  - Partner logo fetched remotely with graceful text fallback.
 *  - autoFirstPage: false to prevent PDFKit from auto-adding pages.
 * ─────────────────────────────────────────────────────────────────────────────
 */

"use strict";

const PDFDocument = require("pdfkit");
const moment      = require("moment");
const axios       = require("axios");


// ─────────────────────────────────────────────────────────────────────────────
// Edutechex LOGO — embedded base64 (JPEG)
// ─────────────────────────────────────────────────────────────────────────────
// Logo removed

const fs2 = require('fs');
const path2 = require('path');
let Edutechex_LOGO_BUF = null;
try {
  Edutechex_LOGO_BUF = fs2.readFileSync(path2.resolve(__dirname, '../../frontend/src/assets/Edutech-logo.png'));
} catch (error) {
  console.warn("Could not load logo for pdf generator:", error.message);
}
// ─── Palette ──────────────────────────────────────────────────────────────────
const C = {
  navy:    "#1a1a2e",
  red:     "#e94560",
  accent:  "#0f3460",
  white:   "#ffffff",
  body:    "#1a1a1a",
  muted:   "#555555",
  light:   "#888888",
  border:  "#d0d0d0",
  rowEven: "#f4f6f9",
  page:    "#ffffff",
};

const F = { reg: "Helvetica", bold: "Helvetica-Bold", obl: "Helvetica-Oblique" };

// ─── Page geometry ─────────────────────────────────────────────────────────────
const PW      = 595.28;
const PH      = 841.89;
const ML      = 50;
const CW      = PW - ML - 50;
const HDR_H   = 76;
const FOOT_H  = 34;
const SIG_H   = 100;
const LABEL_W = 172;
const VAL_X   = ML + LABEL_W;
const VAL_W   = CW - LABEL_W;

// ✅ FIX: Raised BODY_MAX_Y so content fills the page properly.
// Old value: PH - FOOT_H - SIG_H - 24 = ~684  (too low — caused premature page breaks)
// New value: PH - FOOT_H - 20          = ~788  (leaves just enough room for footer)
const BODY_MAX_Y = PH - FOOT_H - 20;

// ─── Primitives ────────────────────────────────────────────────────────────────
const fillRect = (doc, x, y, w, h, color) =>
  doc.save().rect(x, y, w, h).fill(color).restore();

const hLine = (doc, x, y, w, color, thick) =>
  doc.save().moveTo(x, y).lineTo(x + w, y)
     .lineWidth(thick || 0.6).stroke(color || C.border).restore();

const fetchImg = async (url, ms = 6000) => {
  if (!url) return null;
  try {
    const r = await axios.get(url, { responseType: "arraybuffer", timeout: ms });
    return Buffer.from(r.data, "binary");
  } catch { return null; }
};

// ─── Meta line ────────────────────────────────────────────────────────────────
const metaLine = (doc, label, value, y) => {
  const LW = 46;
  doc.font(F.reg).fontSize(9).fillColor(C.muted)
     .text(label + ":", ML, y, { width: LW, lineBreak: false });
  doc.font(F.bold).fontSize(9).fillColor(C.body)
     .text(value || "", ML + LW + 4, y, { width: CW - LW - 4, lineBreak: false });
  return y + 15;
};

// ─── Section heading ──────────────────────────────────────────────────────────
const sectionHeading = (doc, text, y) => {
  doc.font(F.bold).fontSize(8.8).fillColor(C.accent)
     .text(text.toUpperCase(), ML, y, { width: CW, characterSpacing: 0.9, lineBreak: false });
  const ry = y + 14;
  hLine(doc, ML, ry, CW, C.accent, 0.8);
  return ry + 11;
};

// ─── KV row ───────────────────────────────────────────────────────────────────
const kvRow = (doc, label, value, y, shade) => {
  const safe = (value || "—").toString();
  const lh   = doc.font(F.reg).fontSize(9).heightOfString(label, { width: LABEL_W });
  const vh   = doc.font(F.reg).fontSize(9).heightOfString(safe,  { width: VAL_W });
  const rh   = Math.max(lh, vh, 14) + 12;
  if (shade) fillRect(doc, ML - 6, y, CW + 12, rh, C.rowEven);
  doc.font(F.reg).fontSize(9).fillColor(C.muted)
     .text(label, ML,    y + 6, { width: LABEL_W, lineBreak: false });
  doc.font(F.reg).fontSize(9).fillColor(C.body)
     .text(safe,  VAL_X, y + 6, { width: VAL_W });
  return y + rh;
};

// ─── Bullet line ──────────────────────────────────────────────────────────────
const bulletLine = (doc, text, y, color) => {
  const bh = doc.font(F.reg).fontSize(9).heightOfString(text, { width: CW - 12 });
  fillRect(doc, ML, y + 2, 4, 4, color || C.red);
  doc.font(F.reg).fontSize(9).fillColor(C.body)
     .text(text, ML + 12, y, { width: CW - 12, lineGap: 1.8 });
  return y + bh + 8;
};

// ─── Smart page break ─────────────────────────────────────────────────────────
// Only adds a new page when content truly won't fit.
// Returns the Y to continue writing from on the (possibly new) page.
const maybePageBreak = (doc, y, neededHeight, brand, companyName) => {
  // We need neededHeight PLUS room for the footer
  if (y + neededHeight > PH - FOOT_H - 20) {
    doc.addPage();
    fillRect(doc, 0, 0, PW, PH, C.page);

    // Slim continuation header
    fillRect(doc, 0, 0, PW, 22, brand);
    fillRect(doc, 0, 20, PW, 2, "#e94560");
    doc.font(F.reg).fontSize(7.5).fillColor("#ffffff")
       .text("(Continued) " + (companyName || "Internship Offer Letter"),
             0, 6, { width: PW, align: "center", lineBreak: false });

    return 32; // Y after the slim header
  }
  return y;
};

// ─── Signature block (reusable) ───────────────────────────────────────────────
const drawSignatureBlock = (doc, topY, offerData) => {
  const colW  = (CW - 24) / 2;
  const col2X = ML + colW + 24;
  const sigLineY = topY + 50;

  hLine(doc, ML, topY, CW, C.border, 0.6);

  // Left — authorised signatory
  doc.font(F.bold).fontSize(9).fillColor(C.body)
     .text(offerData.contactInfo?.name || "HR Manager",
           ML, topY + 10, { width: colW, lineBreak: false });
  hLine(doc, ML, sigLineY, colW, C.body, 0.7);
  doc.font(F.reg).fontSize(8).fillColor(C.muted)
     .text(offerData.companyName || "",
           ML, sigLineY + 6, { width: colW, lineBreak: false });
  doc.font(F.reg).fontSize(8).fillColor(C.muted)
     .text("Authorized Signatory",
           ML, sigLineY + 18, { width: colW, lineBreak: false });

  const hrContact = [offerData.contactInfo?.email, offerData.contactInfo?.phone]
                      .filter(Boolean).join("   |   ");
  if (hrContact) {
    doc.font(F.reg).fontSize(7.5).fillColor(C.light)
       .text(hrContact, ML, sigLineY + 30, { width: colW, lineBreak: false });
  }

  // Right — candidate
  doc.font(F.bold).fontSize(9).fillColor(C.body)
     .text(offerData.name || "Candidate",
           col2X, topY + 10, { width: colW, lineBreak: false });
  hLine(doc, col2X, sigLineY, colW, C.body, 0.7);
  doc.font(F.reg).fontSize(8).fillColor(C.muted)
     .text("Candidate Signature",
           col2X, sigLineY + 6, { width: colW / 2 - 6, lineBreak: false });
  doc.font(F.reg).fontSize(8).fillColor(C.muted)
     .text("Date: _______________",
           col2X + colW / 2 + 6, sigLineY + 6,
           { width: colW / 2, lineBreak: false });
  doc.font(F.reg).fontSize(8).fillColor(C.muted)
     .text("Candidate Acknowledgement",
           col2X, sigLineY + 18, { width: colW, lineBreak: false });
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────────────────────────────────────
const generateOfferPDFBuffer = async (offerData) => {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({
        margin: 0, size: "A4", autoFirstPage: false,
        bufferPages: true,
        info: {
          Title:   "Internship Offer Letter – " + (offerData.name || "Candidate"),
          Author:  offerData.companyName || "Edutechex",
          Subject: "Internship Offer Letter",
        },
      });
      const chunks = [];
      doc.on("data",  c  => chunks.push(c));
      doc.on("end",   () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      doc.addPage();
      fillRect(doc, 0, 0, PW, PH, C.page);

      // ── Brand colour ──────────────────────────────────────────────────────
      const brand = offerData.template?.brandColor
                 ?? offerData.partnerBrandColor
                 ?? C.navy;

      // ── Partner logo ──────────────────────────────────────────────────────
      const ptnLogoUrl = offerData.template?.logoUrl ?? offerData.partnerLogoUrl ?? null;
      const ptnBuf     = await fetchImg(ptnLogoUrl);

      // ══════════════════════════════════════════════════════════════════════
      // HEADER BAR
      // ══════════════════════════════════════════════════════════════════════
      fillRect(doc, 0, 0, PW, HDR_H, brand);
      fillRect(doc, 0, HDR_H - 4, PW, 4, C.red);

      const LOGO_H = 36;
      const LOGO_W = 150;
      const LOGO_Y = Math.round((HDR_H - 4 - LOGO_H) / 2);

      // Left: Edutechex logo
      try {
        doc.image(Edutechex_LOGO_BUF, ML, LOGO_Y, { fit: [LOGO_W, LOGO_H] });
      } catch (_) {
        doc.font(F.bold).fontSize(12).fillColor(C.white)
           .text("Edutechex", ML, LOGO_Y + 10, { lineBreak: false, width: LOGO_W });
      }

      // Centre dot divider
      doc.save().circle(PW / 2, (HDR_H - 4) / 2, 2.5)
         .fillOpacity(0.4).fill(C.white).restore();

      // Right: Partner logo or company name
      const pX = PW - 50 - LOGO_W;
      if (ptnBuf) {
        try { doc.image(ptnBuf, pX, LOGO_Y, { fit: [LOGO_W, LOGO_H] }); }
        catch (_) { /* fall through to text */ }
      }
      if (!ptnBuf) {
        doc.font(F.bold).fontSize(12).fillColor(C.white)
           .text((offerData.companyName || "Company").toUpperCase(),
                 pX, LOGO_Y + 12, { width: LOGO_W, align: "right", lineBreak: false });
      }

      // Document type label
      doc.font(F.bold).fontSize(10).fillColor(C.white)
         .text("INTERNSHIP OFFER LETTER",
               0, 8, { width: PW - ML, align: "right", lineBreak: false });

      // ══════════════════════════════════════════════════════════════════════
      // META BLOCK
      // ══════════════════════════════════════════════════════════════════════
      let y = HDR_H + 18;
      y = metaLine(doc, "Date",  moment().format("MMMM D, YYYY"), y);
      y = metaLine(doc, "To",    offerData.name  || "Candidate",  y);
      if (offerData.email)
        y = metaLine(doc, "Email", offerData.email, y);

      y += 6;
      hLine(doc, ML, y, CW, C.border, 0.8);
      y += 14;

      // ══════════════════════════════════════════════════════════════════════
      // OFFER TITLE
      // ══════════════════════════════════════════════════════════════════════
      doc.font(F.bold).fontSize(13).fillColor(C.body)
         .text("OFFER — " + (offerData.position || "INTERN").toUpperCase(),
               ML, y, { width: CW, lineBreak: false });
      y += 24;

      // ══════════════════════════════════════════════════════════════════════
      // SALUTATION + INTRO
      // ══════════════════════════════════════════════════════════════════════
      const startFmt = offerData.startDate
        ? moment(offerData.startDate).format("MMMM D, YYYY")
        : "the agreed start date";

      doc.font(F.reg).fontSize(9).fillColor(C.body)
         .text("Dear " + (offerData.name || "Candidate") + ",",
               ML, y, { width: CW, lineBreak: false });
      y += 16;

      doc.font(F.reg).fontSize(9).fillColor(C.body)
         .text(
           "We are pleased to extend this offer of internship for the position of " +
           (offerData.position || "Intern") + " at " +
           (offerData.companyName || "our company") +
           ". After careful consideration, we believe your skills and experience make you an " +
           "excellent fit for our team. Your internship is scheduled to commence on " +
           startFmt + ". We look forward to the contributions you will bring to our organization.",
           ML, y, { width: CW, lineGap: 2.8, align: "justify" }
         );
      y = doc.y + 18;

      // ══════════════════════════════════════════════════════════════════════
      // POSITION DETAILS
      // ══════════════════════════════════════════════════════════════════════
      y = maybePageBreak(doc, y, 160, brand, offerData.companyName);
      y = sectionHeading(doc, "Position Details", y);

      const typeLabel =
        offerData.internshipType === "PAID"    ? "Paid" :
        offerData.internshipType === "STIPEND" ? "Stipend Based" : "Unpaid";

      [
        ["Job Title",         offerData.position],
        ["Company",           offerData.companyName],
        ["Location",          offerData.location],
        ["Start Date",        offerData.startDate
                                ? moment(offerData.startDate).format("MMMM D, YYYY") : null],
        ["Duration",          offerData.duration],
        ["Internship Type",   typeLabel],
        ["Reporting Manager", offerData.contactInfo?.name || "HR Manager"],
      ].forEach(([lbl, val], i) => { y = kvRow(doc, lbl, val, y, i % 2 === 0); });
      y += 14;

      // ══════════════════════════════════════════════════════════════════════
      // COMPENSATION
      // ══════════════════════════════════════════════════════════════════════
      y = maybePageBreak(doc, y, 60, brand, offerData.companyName);
      y = sectionHeading(doc, "Compensation", y);

      let compType = "Unpaid Internship", compExtra = null;
      if (offerData.internshipType === "PAID") {
        compType = "Paid Internship";
      } else if (offerData.internshipType === "STIPEND") {
        const cd = offerData.compensationDetails || {};
        const parts = [cd.amount, cd.currency,
                       cd.frequency ? "per " + cd.frequency.toLowerCase() : null]
                      .filter(Boolean);
        compType  = "Stipend – " + (parts.join(" ") || "—");
        compExtra = cd.benefits?.length ? cd.benefits.join(", ") : null;
      }
      y = kvRow(doc, "Compensation Type", compType, y, false);
      if (compExtra) y = kvRow(doc, "Benefits", compExtra, y, true);
      y += 14;

      // ══════════════════════════════════════════════════════════════════════
      // KEY RESPONSIBILITIES
      // ══════════════════════════════════════════════════════════════════════
      const responsibilities = (offerData.jobDescription || "")
        .split("\n").map(s => s.trim()).filter(Boolean);

      if (responsibilities.length) {
        y = maybePageBreak(doc, y, 50, brand, offerData.companyName);
        y = sectionHeading(doc, "Key Responsibilities", y);
        responsibilities.slice(0, 6).forEach(r => {
          y = maybePageBreak(doc, y, 22, brand, offerData.companyName);
          y = bulletLine(doc, r, y, C.accent);
        });
        y += 8;
      }

      // ══════════════════════════════════════════════════════════════════════
      // REQUIRED QUALIFICATIONS
      // ══════════════════════════════════════════════════════════════════════
      const quals = Array.isArray(offerData.qualifications)
        ? offerData.qualifications.filter(Boolean)
        : (offerData.qualifications || "").split(",").map(q => q.trim()).filter(Boolean);

      if (quals.length) {
        y = maybePageBreak(doc, y, 50, brand, offerData.companyName);
        y = sectionHeading(doc, "Required Qualifications", y);
        quals.slice(0, 8).forEach(q => {
          y = maybePageBreak(doc, y, 22, brand, offerData.companyName);
          y = bulletLine(doc, q, y, C.accent);
        });
        y += 12;
      }

      // ══════════════════════════════════════════════════════════════════════
      // TERMS & CONDITIONS
      // ══════════════════════════════════════════════════════════════════════
      const deadline = moment().add(7, "days").format("MMMM D, YYYY");
      y = maybePageBreak(doc, y, 120, brand, offerData.companyName);
      y = sectionHeading(doc, "Terms & Conditions", y);

      [
        "This offer is contingent upon successful completion of pre-internship requirements.",
        "Interns are expected to adhere to all company policies and confidentiality agreements.",
        "Either party may terminate the internship with " +
          (offerData.noticePeriod || "2 weeks") + " written notice.",
        "Please sign and return this letter by " + deadline + " to confirm acceptance.",
      ].forEach(t => {
        y = maybePageBreak(doc, y, 22, brand, offerData.companyName);
        y = bulletLine(doc, t, y, C.red);
      });
      y += 16;

      // ══════════════════════════════════════════════════════════════════════
      // SIGNATURE BLOCK
      // Placed right after content. If not enough room, moves to a new page.
      // ══════════════════════════════════════════════════════════════════════
      y = maybePageBreak(doc, y, SIG_H + 30, brand, offerData.companyName);
      drawSignatureBlock(doc, y + 10, offerData);

      // ══════════════════════════════════════════════════════════════════════
      // FOOTER — drawn on every page
      // ══════════════════════════════════════════════════════════════════════
      const pageCount = doc.bufferedPageRange().count;
      for (let i = 0; i < pageCount; i++) {
        doc.switchToPage(i);
        const footY = PH - FOOT_H;
        fillRect(doc, 0, footY, PW, FOOT_H, brand);
        fillRect(doc, 0, footY, PW, 3, C.red);
        doc.font(F.reg).fontSize(7.5).fillColor(C.white)
           .text(
             (offerData.companyName || "Company") +
             "   \u00B7   Confidential Internship Offer   \u00B7   " +
             moment().format("MMMM D, YYYY") +
             "   \u00B7   Powered by Edutechex",
             0, footY + 12,
             { width: PW, align: "center", lineBreak: false }
           );
      }

      doc.end();
    } catch (err) { reject(err); }
  });
};

module.exports = generateOfferPDFBuffer;