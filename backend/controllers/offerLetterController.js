const mongoose = require('mongoose');
const generateOfferPDFBuffer = require('../utils/pdfGenerator');
const { uploadOfferLetterBuffer } = require('../utils/multer');
const OfferLetter = require('../models/webapp-models/offerLetterModel');
const notifyUser = require('../utils/notifyUser');
const sendNotification = require('../utils/Notification');
const InternshipSchedule = require('../models/webapp-models/InternshipScheduleModel');
const Partnerwebapp = require('../models/webapp-models/partnerModel'); // Import partner model if needed
// const OfferTemplate = require('../models/webapp-models/OfferTemplateModel'); // Import OfferTemplate model
const Payment = require('../models/webapp-models/internshipPaymentModel'); // Import payment model
const Internship = require('../models/webapp-models/internshipPostModel');
const Userwebapp = require('../models/webapp-models/userModel');

const sendOfferLetter = async (req, res) => {
  try {
    const {
      partnerId,
      student_id: studentId,
      name,
      email,
      position,
      startDate,
      internshipId,
      company,
      location,
      duration,
      internshipType,
      compensationDetails,
      jobDescription,
      qualifications,
      contactInfo,
      noticePeriod,
      templateId // ✅ added this
    } = req.body;

    if (!partnerId) {
      return res.status(400).json({ error: "Missing partnerId" });
    }

    const partner = await Partnerwebapp.findById(partnerId);
    if (!partner) {
      return res.status(404).json({ error: "Partner not found" });
    }

    if (partner.planType === "Freemium") {
      return res.status(403).json({ error: "Upgrade your plan to send offer letters" });
    }

    if (partner.isPremium && partner.premiumExpiration && new Date() > partner.premiumExpiration) {
      return res.status(403).json({ error: "Your premium plan has expired. Please renew to continue." });
    }

    const requiredFields = ['student_id', 'name', 'email', 'position', 'startDate', 'internshipId'];
    const missing = requiredFields.filter(field => !req.body[field]);

    if (missing.length > 0) {
      return res.status(400).json({ error: 'Missing required fields', missing });
    }

    let studentObjId, internshipObjId, normalizedStart;
    try {
      studentObjId = new mongoose.Types.ObjectId(studentId);
      internshipObjId = new mongoose.Types.ObjectId(internshipId);
      normalizedStart = new Date(new Date(startDate).setHours(0, 0, 0, 0));
      if (isNaN(normalizedStart.getTime())) throw new Error('Invalid startDate');
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }

    // Fix Bug 8: prevent duplicate offer letters for the same student+internship
    const existingOffer = await OfferLetter.findOne({
      studentId: studentObjId,
      internshipId: internshipObjId,
    });
    if (existingOffer) {
      return res.status(409).json({
        error: "An offer letter has already been sent to this student for this internship",
        offerId: existingOffer._id,
        status: existingOffer.status,
      });
    }

    // ✅ Fetch template if templateId is present
    let template = null;
    if (templateId) {
      template = await OfferTemplate.findById(templateId);
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }
    }

    // ✅ Fetch the internship to use as a fallback for contactInfo and schoolAdmin
    const internshipDoc = await Internship.findById(internshipObjId)
      .select('schoolAdmin contactInfo internshipMode classification compensationDetails location jobDescription qualifications imgUrl')
      .lean();

    // Merge: prefer contactInfo from request body; fall back to internship's stored contactInfo
    const resolvedContactInfo = {
      name: contactInfo?.name && contactInfo.name !== "HR Manager"
        ? contactInfo.name
        : internshipDoc?.contactInfo?.name || contactInfo?.name || "HR Manager",
      email: contactInfo?.email && contactInfo.email !== "hr@company.com"
        ? contactInfo.email
        : internshipDoc?.contactInfo?.email || contactInfo?.email || "",
      phone: contactInfo?.phone && contactInfo.phone !== "9876543210"
        ? contactInfo.phone
        : internshipDoc?.contactInfo?.phone || contactInfo?.phone || "",
    };

    // ✅ Generate PDF with SkillNaav + partner logos and real contactInfo
    const pdfBuffer = await generateOfferPDFBuffer({
      name,
      email,
      position,
      startDate,
      internshipId,
      companyName: company,
      location,
      duration,
      internshipType,
      compensationDetails,
      jobDescription,
      qualifications,
      contactInfo: resolvedContactInfo,
      noticePeriod,
      // Partner branding — pulled from the partner document
      partnerLogoUrl: partner.logoUrl || partner.logo || null,
      partnerBrandColor: partner.brandColor || partner.primaryColor || null,
      // No longer needed but kept for backwards compat if template had backgroundImageUrl
      backgroundImageUrl: template?.backgroundImageUrl || null,
    });

    const fileName = `offer-${studentId}-${Date.now()}.pdf`;
    const s3Url = await uploadOfferLetterBuffer(pdfBuffer, fileName);

    const studentDoc = await Userwebapp.findById(studentObjId)
      .select("schoolAdmin")
      .lean();

    let resolvedSchoolAdminId = null;

    if (
      studentDoc?.schoolAdmin &&
      mongoose.Types.ObjectId.isValid(String(studentDoc.schoolAdmin))
    ) {
      resolvedSchoolAdminId = new mongoose.Types.ObjectId(
        String(studentDoc.schoolAdmin)
      );
    }

    const offerDoc = {
      studentId: studentObjId,
      internshipId: internshipObjId,
      name,
      email,
      position,
      companyName: company,
      startDate: normalizedStart,
      endDateOrDuration: duration,
      duration,
      internshipType,
      internshipMode: internshipDoc?.internshipMode,
      classification: internshipDoc?.classification,
      compensationDetails: compensationDetails || internshipDoc?.compensationDetails || null,
      location: location || internshipDoc?.location || "",
      jobDescription: jobDescription || internshipDoc?.jobDescription || "",
      qualifications: qualifications || internshipDoc?.qualifications || [],
      contactInfo: resolvedContactInfo,
      imgUrl: internshipDoc?.imgUrl || "",
      partnerId,
      sentDate: new Date(),
      status: 'Sent',
      s3Url,
      schoolAdminId: resolvedSchoolAdminId,
    };

    const offerLetter = await OfferLetter.create(offerDoc);

    sendNotification({
      studentId,
      title: 'Offer Letter Sent!',
      message: `Congratulations ${name}, your offer for "${position}" is live.`,
      link: s3Url
    }).catch(err => console.error('In-app notification failed:', err));

    notifyUser(
      email,
      'Your SkillNaav Offer Letter',
      `Hi ${name}, <a href="${s3Url}">download your offer letter</a>.`
    ).catch(err => console.error('Email notification failed:', err));

    return res.status(201).json({
      message: 'Offer letter sent successfully',
      offerLetter: {
        _id: offerLetter._id,
        studentId: offerLetter.studentId,
        position: offerLetter.position,
        startDate: offerLetter.startDate,
        downloadUrl: s3Url
      }
    });
  } catch (err) {
    console.error('Offer Letter Error:', err);
    return res.status(500).json({
      error: err.message || 'Failed to process offer letter'
    });
  }
};

const getOfferLetterByStudent = async (req, res) => {
  try {
    const { studentId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      return res.status(400).json({ error: "Invalid student ID" });
    }

    const offers = await OfferLetter.find({ studentId });

    if (!offers || offers.length === 0) {
      return res.status(200).json([]); // <-- better than 404 for your use case
    }

    return res.status(200).json(offers);
  } catch (err) {
    console.error("Error fetching offer letter:", err);
    return res.status(500).json({ error: err.message });
  }
};

const updateOfferStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, paymentId, preferredTimeSlot, selectedTimeSlot } = req.body;

    console.log('Updating offer status:', { id, status, paymentId });

    // 1️⃣ Validate Offer ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid offer ID format' });
    }

    // 2️⃣ Validate status
    if (!['Accepted', 'Rejected'].includes(status)) {
      return res.status(400).json({ error: 'Status must be Accepted or Rejected' });
    }

    // 3️⃣ Fetch offer
    const offer = await OfferLetter.findById(id);
    if (!offer) {
      return res.status(404).json({ error: 'Offer letter not found' });
    }

    // 4️⃣ Fetch internship
    const internship = await Internship.findById(offer.internshipId);
    if (!internship) {
      return res.status(404).json({ error: 'Internship not found' });
    }

    let resolvedPaymentId = null;

    // 5️⃣ PAID internship → payment verification
    if (status === 'Accepted' && internship.internshipType === 'PAID') {
      if (!paymentId) {
        return res.status(400).json({
          error: 'Payment required before accepting this offer'
        });
      }

      // PayPal ID OR Mongo ID → normalize to Mongo ID
      const paymentDoc = mongoose.Types.ObjectId.isValid(paymentId)
        ? await Payment.findById(paymentId)
        : await Payment.findOne({ paypalPaymentId: paymentId });

      if (!paymentDoc) {
        return res.status(404).json({
          error: 'Payment record not found'
        });
      }

      if (paymentDoc.status !== 'COMPLETED') {
        return res.status(400).json({
          error: 'Payment not completed',
          details: `Current status: ${paymentDoc.status}`
        });
      }

      if (
        String(paymentDoc.offerId) !== String(offer._id) ||
        String(paymentDoc.internshipId) !== String(internship._id) ||
        String(paymentDoc.studentId) !== String(offer.studentId)
      ) {
        return res.status(403).json({ error: 'Payment does not belong to this offer' });
      }

      resolvedPaymentId = paymentDoc._id; // ✅ ALWAYS ObjectId
    }

    // 6️⃣ Build update payload (schema-safe)
    // ✅ accept either preferredTimeSlot OR selectedTimeSlot from frontend
    const resolvedTimeSlot = preferredTimeSlot || selectedTimeSlot;

    const updateData = {
      status,
      ...(resolvedPaymentId && { paymentId: resolvedPaymentId }),
      ...(resolvedTimeSlot && { preferredTimeSlot: resolvedTimeSlot })
    };

    console.log('Updating offer with:', updateData);

    // 7️⃣ Update offer
    const updatedOffer = await OfferLetter.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    // ✅ 8️⃣ Post-accept notifications (RUN IN BACKGROUND so response is fast)
    if (status === 'Accepted') {
      setImmediate(async () => {
        try {
          const schedule = await InternshipSchedule
            .findOne({ internshipId: updatedOffer.internshipId })
            .select('timetable') // ✅ only fetch what you need
            .lean();

          if (schedule?.timetable?.length) {
            const upcoming = schedule.timetable.find(s => {
              const d = new Date(s.date);
              const today = new Date();
              d.setHours(0, 0, 0, 0);
              today.setHours(0, 0, 0, 0);
              return d >= today;
            });

            const appUrl =
              (process.env.FRONTEND_BASE_URL || process.env.WEBAPP_BASE_URL || 'https://www.skillnaav.com') +
              '/user-main-page/offer-letter';

            const previewHtml = upcoming
              ? `<p><b>Next session:</b> ${new Date(upcoming.date).toLocaleDateString('en-IN')} ${upcoming.startTime}–${upcoming.endTime}</p>`
              : '';

            // ✅ Run both in parallel and don’t block main request
            await Promise.allSettled([
              notifyUser(
                updatedOffer.email,
                'Your internship schedule is available',
                `
              <p>Hi ${updatedOffer.name || 'there'},</p>
              <p>Your internship schedule is now available.</p>
              ${previewHtml}
              <p><a href="${appUrl}">Open your dashboard</a></p>
              <p>- Skillnaav Team</p>
            `
              ),
              sendNotification({
                studentId: updatedOffer.studentId,
                title: 'Schedule available',
                message: 'Tap to view your sessions.',
                link: appUrl,
                type: 'schedule'
              })
            ]);
          }
        } catch (e) {
          console.error('Post-accept notification error (background):', e);
        }
      });
    }

    return res.status(200).json({
      success: true,
      message: `Offer ${status.toLowerCase()} successfully`,
      offer: updatedOffer
    });

  } catch (err) {
    console.error('Update offer status error:', err);

    return res.status(500).json({
      error: 'Failed to update offer status',
      details: err.message,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
  }
};

const getOffersByInternship = async (req, res) => {
  try {
    const { internshipId } = req.params;
    const { schoolAdminId } = req.query;

    if (!mongoose.Types.ObjectId.isValid(internshipId)) {
      return res.status(400).json({ error: 'Invalid internship ID' });
    }

    const internshipObjId = new mongoose.Types.ObjectId(internshipId);
    let query;

    if (schoolAdminId && mongoose.Types.ObjectId.isValid(schoolAdminId)) {
      const adminObjId = new mongoose.Types.ObjectId(schoolAdminId);

      query = {
        internshipId: internshipObjId,
        schoolAdminId: adminObjId,
      };
    } else {
      query = {
        internshipId: internshipObjId,
        $or: [
          { schoolAdminId: null },
          { schoolAdminId: { $exists: false } },
        ],
      };
    }

    const offers = await OfferLetter.find(query);
    return res.status(200).json({ offers });
  } catch (err) {
    console.error('getOffersByInternship error:', err);
    return res.status(500).json({ error: err.message });
  }
};

// Add this function to your offerLetterController.js
const getOfferStatusesForInternship = async (req, res) => {
  try {
    const { internshipId } = req.params;
    const { studentIds } = req.body;

    if (!mongoose.Types.ObjectId.isValid(internshipId)) {
      return res.status(400).json({ error: 'Invalid internship ID' });
    }

    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({ error: 'Student IDs array is required' });
    }

    // Validate all student IDs
    const validStudentIds = studentIds.filter(id => mongoose.Types.ObjectId.isValid(id));
    if (validStudentIds.length === 0) {
      return res.status(400).json({ error: 'No valid student IDs provided' });
    }

    // Find all offers for this internship and these students
    const offers = await OfferLetter.find({
      internshipId: new mongoose.Types.ObjectId(internshipId),
      studentId: { $in: validStudentIds }
    });

    // Create a mapping of studentId to offer status
    const statusMap = {};
    offers.forEach(offer => {
      statusMap[offer.studentId.toString()] = offer.status;
    });

    // Prepare response with status for each student
    const response = validStudentIds.map(studentId => ({
      studentId,
      status: statusMap[studentId] || 'Not Sent'
    }));

    return res.status(200).json(response);
  } catch (err) {
    console.error('Error fetching offer statuses:', err);
    return res.status(500).json({ error: err.message });
  }
};

const getAcceptedOffersByInternship = async (req, res) => {
  try {
    const { internshipId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(internshipId)) {
      return res.status(400).json({ error: "Invalid internship ID" });
    }

    const offers = await OfferLetter.find({
      internshipId: new mongoose.Types.ObjectId(internshipId),
      status: "Accepted",
    })
      .populate("studentId", "firstName lastName email profilePhoto")
      .lean();

    return res.status(200).json({ accepted: offers });
  } catch (err) {
    console.error("Error fetching accepted offers:", err);
    return res.status(500).json({ error: err.message });
  }
};

const pdfParse = require('pdf-parse');
const axios = require('axios');

const extractOfferPdfData = async (req, res) => {
  try {
    const { s3Url } = req.body;
    if (!s3Url) return res.status(400).json({ error: 'Missing s3Url' });

    const response = await axios.get(s3Url, { responseType: 'arraybuffer' });
    const pdfData = await pdfParse(response.data);
    const text = pdfData.text;

    const extract = (regex) => {
      const match = text.match(regex);
      return match ? match[1].trim() : '';
    };

    const companyName = extract(/Company(.*)/);
    const jobTitle = extract(/Job Title(.*)/);
    const location = extract(/Location(.*)/);
    const startDate = extract(/Start Date(.*)/);
    const duration = extract(/Duration(.*)/);
    const rawType = extract(/Internship Type(.*)/);
    const rawComp = extract(/Compensation Type(.*)/);

    let mappedType = "UNKNOWN";
    if (rawType.toLowerCase().includes("stipend")) mappedType = "STIPEND";
    else if (rawType.toLowerCase().includes("unpaid")) mappedType = "FREE";
    else if (rawType.toLowerCase().includes("paid")) mappedType = "PAID";

    let mappedMode = "OFFLINE";
    if (location.toLowerCase().includes("remote") || location.toLowerCase().includes("online")) mappedMode = "ONLINE";
    else if (location.toLowerCase().includes("hybrid")) mappedMode = "HYBRID";

    const reportingManager = extract(/Reporting Manager(.*)/);

    let jobDescription = '';
    const jdMatch = text.match(/KEY RESPONSIBILITIES\n([\s\S]*?)REQUIRED QUALIFICATIONS/);
    if (jdMatch) {
      jobDescription = jdMatch[1].trim();
    }

    let qualifications = [];
    const qualMatch = text.match(/REQUIRED QUALIFICATIONS\n([\s\S]*?)Confidential Internship Offer/);
    if (qualMatch) {
      const qualLines = qualMatch[1].split('\n').map(l => l.trim()).filter(l => l && !l.includes('·'));
      qualifications = qualLines;
    }

    res.status(200).json({
      companyName,
      jobTitle,
      location,
      startDate,
      duration,
      internshipType: mappedType,
      internshipMode: mappedMode,
      classification: "Basic",
      pdfExtractedCompensation: rawComp || "N/A",
      contactInfo: { name: reportingManager || "HR Manager" },
      jobDescription,
      qualifications
    });
  } catch (err) {
    console.error('Error extracting PDF data:', err);
    res.status(500).json({ error: 'Failed to extract PDF data' });
  }
};

module.exports = {
  sendOfferLetter,
  getOfferLetterByStudent,
  updateOfferStatus,
  getOffersByInternship,
  getOfferStatusesForInternship,
  getAcceptedOffersByInternship,
  extractOfferPdfData
};
