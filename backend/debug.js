require("dotenv").config();
const mongoose = require("mongoose");
const OfferLetter = require("./models/webapp-models/offerLetterModel");

// We must register the Userwebapp model manually if it's not imported.
require("./models/webapp-models/userModel");

async function check() {
    await mongoose.connect(process.env.MONGO_URI || "mongodb+srv://udaysankar:uday1234@cluster0.dbcy9.mongodb.net/skillnaav?retryWrites=true&w=majority");
    const internshipId = "69ef2be125fdf9530698db23";
    const offers = await OfferLetter.find({ internshipId }).populate({
        path: 'studentId',
        model: 'Userwebapp',
        select: 'name email'
    });
    console.log("Found offers:", offers.length);
    for (const offer of offers) {
        console.log("Offer ID:", offer._id, "Status:", offer.status, "StudentId:", offer.studentId ? offer.studentId.name : "null");
    }
    mongoose.disconnect();
}
check().catch(console.error);
