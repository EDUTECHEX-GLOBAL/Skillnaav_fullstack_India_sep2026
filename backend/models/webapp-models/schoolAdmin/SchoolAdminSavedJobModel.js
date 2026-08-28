const mongoose = require("mongoose");

const schoolAdminSavedJobSchema = new mongoose.Schema({
  schoolAdminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "SchoolAdmin",
    required: true,
  },
  jobId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "InternshipPosting",
    required: true,
  },
}, { timestamps: true });

const SchoolAdminSavedJob = mongoose.model("SchoolAdminSavedJob", schoolAdminSavedJobSchema);

module.exports = SchoolAdminSavedJob;
