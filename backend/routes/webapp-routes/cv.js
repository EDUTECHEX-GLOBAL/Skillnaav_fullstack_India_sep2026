// routes/cv.js
const express = require("express");
const router = express.Router();
const axios = require("axios");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const PDFDocument = require("pdfkit");
const StudentProfile = require("../../models/webapp-models/SudentProfileModel");
const Userwebapp = require("../../models/webapp-models/userModel");

/**
 * Generate PDF buffer using PDFKit
 */
function generateCvPdfBuffer(data) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margins: { top: 36, bottom: 36, left: 40, right: 40 },
        bufferPages: true,
        autoFirstPage: true,
      });

      const buffers = [];
      doc.on("data", buffers.push.bind(buffers));
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", reject);

      const pageWidth = doc.page.width;
      const pageHeight = doc.page.height;
      const marginX = 40;
      const contentWidth = pageWidth - marginX * 2;

      // Brand Colors
      const INDIGO = "#4F46E5";
      const INDIGO_LT = "#818CF8";
      const SLATE_800 = "#1E293B";
      const SLATE_600 = "#475569";
      const SLATE_400 = "#94A3B8";
      const SLATE_100 = "#F1F5F9";
      const WHITE = "#FFFFFF";

      const headerHeight = 110;

      // ── Header Band ──────────────────────────────────────
      doc.rect(0, 0, pageWidth, headerHeight).fill(INDIGO);
      doc.rect(0, headerHeight - 4, pageWidth, 4).fill(INDIGO_LT);

      // Candidate Name
      const name = (data.name || "Your Name").trim();
      doc.fillColor(WHITE).font("Helvetica-Bold").fontSize(22)
         .text(name, marginX, 22, { width: contentWidth - 110 });

      // Contact info
      const contactParts = [data.email, data.phone, data.country].filter(Boolean);
      if (contactParts.length) {
        doc.fillColor("#E0E7FF").font("Helvetica").fontSize(9)
           .text(contactParts.join("   ·   "), marginX, 52, { width: contentWidth - 110 });
      }

      // Links row
      const links = [data.linkedin, data.portfolio].filter(Boolean);
      if (links.length) {
        doc.fillColor("#C7D2FE").font("Helvetica-Oblique").fontSize(8)
           .text(links.join("   |   "), marginX, 70, { width: contentWidth - 110 });
      }

      // Top right brand badge
      doc.fillColor(WHITE).font("Helvetica-Bold").fontSize(11)
         .text("edutechex", pageWidth - marginX - 100, 24, { width: 100, align: "right" });
      doc.fillColor("#C7D2FE").font("Helvetica").fontSize(8)
         .text("edutechexskills.com", pageWidth - marginX - 100, 40, { width: 100, align: "right" });

      // Start body content below header
      let currentY = headerHeight + 18;

      const checkPageBreak = (neededHeight = 35) => {
        if (currentY + neededHeight > pageHeight - 45) {
          doc.addPage();
          doc.rect(marginX, 25, contentWidth, 1.5).fill(INDIGO);
          currentY = 38;
        }
      };

      const drawSectionTitle = (title) => {
        checkPageBreak(40);
        currentY += 8;
        doc.fillColor(INDIGO).font("Helvetica-Bold").fontSize(10)
           .text(title.toUpperCase(), marginX, currentY);

        const textWidth = doc.widthOfString(title.toUpperCase());
        const lineStartX = marginX + textWidth + 8;
        if (lineStartX < pageWidth - marginX) {
          doc.rect(lineStartX, currentY + 4, pageWidth - marginX - lineStartX, 0.75).fill("#E2E8F0");
        }
        currentY += 16;
      };

      // ── Professional Summary ─────────────────────────────
      const summary = data.summary || "";
      if (summary.trim()) {
        drawSectionTitle("Professional Summary");
        doc.fillColor(SLATE_600).font("Helvetica").fontSize(9)
           .text(summary.trim(), marginX, currentY, { width: contentWidth, lineGap: 2.5 });
        currentY = doc.y + 6;
      }

      // ── Education ────────────────────────────────────────
      const hasEducation = data.universityName || data.educationLevel || data.fieldOfStudy;
      if (hasEducation) {
        drawSectionTitle("Education");
        checkPageBreak(30);
        if (data.universityName) {
          doc.fillColor(SLATE_800).font("Helvetica-Bold").fontSize(9.5)
             .text(data.universityName, marginX, currentY, { width: contentWidth });
          currentY = doc.y + 2;
        }
        const eduMeta = [data.educationLevel, data.fieldOfStudy].filter(Boolean).join("  ·  ");
        if (eduMeta) {
          doc.fillColor(SLATE_400).font("Helvetica").fontSize(8.5)
             .text(eduMeta, marginX, currentY, { width: contentWidth });
          currentY = doc.y + 6;
        }
      }

      // ── Experience ───────────────────────────────────────
      const experience = Array.isArray(data.experience) ? data.experience : [];
      if (experience.length > 0) {
        drawSectionTitle("Experience");
        experience.forEach((exp) => {
          checkPageBreak(45);
          const title = exp.title || exp.role || "Role / Position";
          doc.fillColor(SLATE_800).font("Helvetica-Bold").fontSize(9.5)
             .text(title, marginX, currentY, { width: contentWidth });
          currentY = doc.y + 2;

          const dateRange = [
            exp.startDate,
            exp.current ? "Present" : exp.endDate
          ].filter(Boolean).join(" – ");

          const meta = [exp.company, exp.location, dateRange].filter(Boolean).join("   ·   ");
          if (meta) {
            doc.fillColor(SLATE_400).font("Helvetica").fontSize(8.5)
               .text(meta, marginX, currentY, { width: contentWidth });
            currentY = doc.y + 3;
          }

          if (exp.description) {
            doc.fillColor(SLATE_600).font("Helvetica").fontSize(8.5)
               .text(exp.description, marginX, currentY, { width: contentWidth, lineGap: 2 });
            currentY = doc.y + 6;
          } else {
            currentY += 4;
          }
        });
      }

      // ── Skills ───────────────────────────────────────────
      const skills = Array.isArray(data.skills) ? data.skills : [];
      if (skills.length > 0) {
        drawSectionTitle("Skills");
        checkPageBreak(30);
        let pillX = marginX;
        let pillY = currentY;
        const pillHeight = 16;
        const pillGapX = 6;
        const pillGapY = 6;

        skills.forEach((skill) => {
          const skillText = String(typeof skill === "object" ? skill.name || skill.skill || "" : skill).trim();
          if (!skillText) return;

          doc.font("Helvetica-Bold").fontSize(8);
          const textWidth = doc.widthOfString(skillText);
          const pillWidth = textWidth + 14;

          if (pillX + pillWidth > pageWidth - marginX) {
            pillX = marginX;
            pillY += pillHeight + pillGapY;
            if (pillY + pillHeight > pageHeight - 45) {
              doc.addPage();
              doc.rect(marginX, 25, contentWidth, 1.5).fill(INDIGO);
              pillY = 38;
            }
          }

          // Pill Background
          doc.roundedRect(pillX, pillY, pillWidth, pillHeight, 4).fill(SLATE_100);
          // Pill Text
          doc.fillColor(INDIGO).font("Helvetica-Bold").fontSize(8)
             .text(skillText, pillX + 7, pillY + 4, { lineBreak: false });

          pillX += pillWidth + pillGapX;
        });

        currentY = pillY + pillHeight + 10;
      }

      // ── Projects ─────────────────────────────────────────
      const projects = Array.isArray(data.projects) ? data.projects : [];
      if (projects.length > 0) {
        drawSectionTitle("Projects");
        projects.forEach((proj) => {
          checkPageBreak(40);
          const pName = proj.name || proj.title || "Project";
          const pLink = proj.link || proj.url || "";
          const heading = pLink ? `${pName}  —  ${pLink}` : pName;

          doc.fillColor(SLATE_800).font("Helvetica-Bold").fontSize(9.5)
             .text(heading, marginX, currentY, { width: contentWidth });
          currentY = doc.y + 2;

          const stack = Array.isArray(proj.techStack) ? proj.techStack.join(", ") : (proj.techStack || "");
          if (stack) {
            doc.fillColor(SLATE_400).font("Helvetica").fontSize(8)
               .text(`Tech Stack: ${stack}`, marginX, currentY, { width: contentWidth });
            currentY = doc.y + 3;
          }

          if (proj.description) {
            doc.fillColor(SLATE_600).font("Helvetica").fontSize(8.5)
               .text(proj.description, marginX, currentY, { width: contentWidth, lineGap: 2 });
            currentY = doc.y + 6;
          } else {
            currentY += 4;
          }
        });
      }

      // ── Certifications ───────────────────────────────────
      const certifications = Array.isArray(data.certifications) ? data.certifications : [];
      if (certifications.length > 0) {
        drawSectionTitle("Certifications");
        certifications.forEach((cert) => {
          checkPageBreak(25);
          const cName = cert.name || cert.title || "";
          doc.fillColor(SLATE_800).font("Helvetica-Bold").fontSize(9)
             .text(cName, marginX, currentY, { width: contentWidth });
          currentY = doc.y + 2;

          const meta = [cert.issuer, cert.issueDate].filter(Boolean).join("   ·   ");
          if (meta) {
            doc.fillColor(SLATE_400).font("Helvetica").fontSize(8)
               .text(meta, marginX, currentY, { width: contentWidth });
            currentY = doc.y + 4;
          }
        });
      }

      // ── Languages ────────────────────────────────────────
      const languages = Array.isArray(data.languages) ? data.languages : [];
      if (languages.length > 0) {
        drawSectionTitle("Languages");
        checkPageBreak(20);
        const langStr = languages.map((l) => {
          if (typeof l === "string") return l;
          return l.language ? `${l.language} (${l.proficiency || "Proficient"})` : "";
        }).filter(Boolean).join("    ·    ");

        if (langStr) {
          doc.fillColor(SLATE_600).font("Helvetica").fontSize(8.5)
             .text(langStr, marginX, currentY, { width: contentWidth });
          currentY = doc.y + 6;
        }
      }

      // ── Page Footers ─────────────────────────────────────
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        doc.fillColor(SLATE_400).font("Helvetica").fontSize(7.5)
           .text(
             `Generated by Edutechex  ·  ${name}  ·  edutechexskills.com`,
             marginX,
             pageHeight - 24,
             { width: contentWidth, align: "center" }
           );
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

router.post(["/generate/:userId", "/generate"], async (req, res) => {
  try {
    let { userId } = req.params;

    if (!userId || userId === "undefined" || userId === "null") {
      userId = req.body?.userId;
    }

    if ((!userId || userId === "undefined" || userId === "null") && req.headers.authorization) {
      try {
        const token = req.headers.authorization.replace(/^Bearer\s+/i, "");
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        userId = decoded.id || decoded._id || decoded.userId;
      } catch (authErr) {
        console.warn("Could not decode auth token in cv route:", authErr.message);
      }
    }

    let user = null;
    let profile = null;

    if (userId && mongoose.Types.ObjectId.isValid(userId)) {
      try {
        [user, profile] = await Promise.all([
          Userwebapp.findById(userId),
          StudentProfile.findOne({ userId }),
        ]);
      } catch (dbErr) {
        console.warn("Database lookup warning for userId:", userId, dbErr.message);
      }
    }

    const clientProfile = req.body?.profile || {};

    // Flatten skills from user or clientProfile
    let flatSkills = [];
    if (Array.isArray(user?.skills)) {
      flatSkills = user.skills
        .map((s) => (typeof s === "object" ? s.name || s.skill || JSON.stringify(s) : String(s)))
        .filter(Boolean);
    } else if (user?.skills && typeof user.skills === "object") {
      flatSkills = [
        ...(Array.isArray(user.skills.technical) ? user.skills.technical : []),
        ...(Array.isArray(user.skills.soft) ? user.skills.soft : []),
      ]
        .map((s) => (typeof s === "object" ? s.name || s.skill || JSON.stringify(s) : String(s)))
        .filter(Boolean);
    }

    if (flatSkills.length === 0 && Array.isArray(clientProfile.skills)) {
      flatSkills = clientProfile.skills
        .map((s) => (typeof s === "object" ? s.name || s.skill || JSON.stringify(s) : String(s)))
        .filter(Boolean);
    }

    const payload = {
      name:           user?.name || user?.username || clientProfile.name || "Student",
      email:          user?.email          || clientProfile.email || "",
      phone:          user?.phone          || clientProfile.phone || "",
      linkedin:       user?.linkedin       || clientProfile.linkedin || "",
      portfolio:      user?.portfolio      || clientProfile.portfolio || "",
      universityName: user?.universityName || clientProfile.universityName || "",
      fieldOfStudy:   user?.fieldOfStudy   || clientProfile.fieldOfStudy || "",
      educationLevel: user?.educationLevel || clientProfile.educationLevel || "",
      country:        user?.country        || clientProfile.country || "",
      skills:         flatSkills,

      summary:        profile?.summary        || clientProfile.summary || "",
      experience:     (profile?.experience && profile.experience.length > 0) ? profile.experience : (clientProfile.experience || []),
      projects:       (profile?.projects && profile.projects.length > 0) ? profile.projects : (clientProfile.projects || []),
      certifications: (profile?.certifications && profile.certifications.length > 0) ? profile.certifications : (clientProfile.certifications || []),
      languages:      (profile?.languages && profile.languages.length > 0) ? profile.languages : (clientProfile.languages || []),
    };

    const safeName = (payload.name || "Resume").replace(/\s+/g, "_");

    // Check if external FastAPI is explicitly set to an active external URL
    const fastapiBase = process.env.FASTAPI_BASE_URL;
    const isExternalFastAPI = fastapiBase && !fastapiBase.includes("localhost") && !fastapiBase.includes("127.0.0.1");

    if (isExternalFastAPI) {
      try {
        const fastapiRes = await axios.post(
          `${fastapiBase}/cv/generate`,
          payload,
          { responseType: "arraybuffer", timeout: 5000 }
        );

        res.set({
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="Edutechex_CV_${safeName}.pdf"`,
        });
        return res.send(fastapiRes.data);
      } catch (fastapiErr) {
        console.warn("FastAPI request failed, falling back to built-in PDFKit engine:", fastapiErr.message);
      }
    }

    // Built-in Native PDFKit generator (self-sufficient, ultra-fast, zero external dependency)
    const pdfBuffer = await generateCvPdfBuffer(payload);

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Edutechex_CV_${safeName}.pdf"`,
      "Content-Length": pdfBuffer.length,
    });
    return res.send(pdfBuffer);

  } catch (err) {
    console.error("CV generation error:", err.message);
    res.status(500).json({
      detail: "CV generation failed. Please try again.",
    });
  }
});

module.exports = router;
