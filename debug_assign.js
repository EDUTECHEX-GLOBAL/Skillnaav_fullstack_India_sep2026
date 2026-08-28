const mongoose = require('mongoose');
const Instructure = require('./backend/models/webapp-models/InstructureManagementModel');
const InternshipSchedule = require('./backend/models/webapp-models/InternshipScheduleModel');

async function debug() {
    await mongoose.connect('mongodb://localhost:27017/SkillNaav', {
        useNewUrlParser: true,
        useUnifiedTopology: true
    });

    const instructors = await Instructure.find();
    console.log(`Found ${instructors.length} instructors.`);
    
    if (instructors.length > 0) {
        console.log("First instructor:", JSON.stringify(instructors[0], null, 2));
    }

    const schedules = await InternshipSchedule.find();
    console.log(`Found ${schedules.length} schedules.`);
    
    if (schedules.length > 0) {
        console.log("First schedule session:", JSON.stringify(schedules[0].timetable[0] || schedules[0].batches[0]?.timetable[0], null, 2));
    }

    process.exit(0);
}

debug().catch(console.error);
