require("dotenv").config();
const mongoose = require("mongoose");
const OfferLetter = require("./models/webapp-models/offerLetterModel");
const Internship = require("./models/webapp-models/internshipPostModel");
const IssuedCertificate = require("./models/webapp-models/issuedCertificateModel");
const InternshipSchedule = require("./models/webapp-models/InternshipScheduleModel");
const { generateAndUploadCertificate } = require("./services/certificateGenerator");

// We must register the Userwebapp model manually if it's not imported.
require("./models/webapp-models/userModel");

async function fixCertificates() {
    await mongoose.connect(process.env.MONGO_URI || "mongodb+srv://udaysankar:uday1234@cluster0.dbcy9.mongodb.net/skillnaav?retryWrites=true&w=majority");
    
    const internshipId = "69ef2be125fdf9530698db23";
    
    const schedule = await InternshipSchedule.findOne({ internshipId });
    if (!schedule || !schedule.selectedCertificateTemplate) {
        console.log("No schedule or template found.");
        return;
    }
    
    const selectedCertificateTemplate = schedule.selectedCertificateTemplate;
    
    const internship = await Internship.findById(internshipId);
    
    const acceptedOffers = await OfferLetter.find({ internshipId, status: "Accepted" }).populate({
        path: 'studentId',
        model: 'Userwebapp',
        select: 'name email'
    });
    
    console.log(`Found ${acceptedOffers.length} accepted offers.`);
    
    for (const offer of acceptedOffers) {
        const student = offer.studentId;
        if (!student) {
            console.log("No student for offer", offer._id);
            continue;
        }
        
        const existingCert = await IssuedCertificate.findOne({ studentId: student._id, internshipId });
        if (existingCert) {
            console.log(`Certificate already exists for ${student.name}`);
            continue;
        }
        
        console.log(`Generating certificate for ${student.name}...`);
        
        try {
            const certData = await generateAndUploadCertificate({
                studentName: student.name || 'Student Name',
                internshipTitle: internship.jobTitle || 'Internship',
                companyName: internship.companyName || 'Company',
                startDate: internship.startDate,
                endDate: internship.endDateOrDuration || internship.duration,
                backgroundImageUrl: selectedCertificateTemplate.imageUrl
            });
            
            const issuedCert = new IssuedCertificate({
                studentId: student._id,
                internshipId: internship._id,
                partnerId: schedule.partnerId,
                certificateId: certData.certificateId,
                pdfUrl: certData.pdfUrl,
                s3Key: certData.s3Key,
                certificateTemplateId: selectedCertificateTemplate.templateId,
                studentName: student.name || 'Student Name',
                internshipTitle: internship.jobTitle || 'Internship',
                companyName: internship.companyName || 'Company',
                startDate: internship.startDate,
                endDate: internship.endDateOrDuration || internship.duration
            });

            await issuedCert.save();
            console.log(`Successfully generated and saved for ${student.name}`);
        } catch (e) {
            console.log(`Failed for ${student.name}:`, e);
        }
    }
    
    mongoose.disconnect();
}
fixCertificates().catch(console.error);
