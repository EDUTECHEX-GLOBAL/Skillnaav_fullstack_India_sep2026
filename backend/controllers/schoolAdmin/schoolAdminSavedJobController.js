const SchoolAdminSavedJob = require("../../models/webapp-models/schoolAdmin/SchoolAdminSavedJobModel");
const mongoose = require("mongoose");
const SchoolAdmin = require("../../models/webapp-models/schoolAdmin/SchoolAdminModel");

const saveJobBySchoolAdmin = async (req, res) => {
  let { schoolAdminId, jobId } = req.body;

  // Use the authenticated school admin ID from the protectSchool middleware
  if (!schoolAdminId && req.schoolAdmin) {
    schoolAdminId = req.schoolAdmin._id.toString();
  }

  try {
    if (!mongoose.Types.ObjectId.isValid(schoolAdminId) || !mongoose.Types.ObjectId.isValid(jobId)) {
      return res.status(400).json({ message: "Invalid ID format" });
    }

    schoolAdminId = new mongoose.Types.ObjectId(schoolAdminId);
    jobId = new mongoose.Types.ObjectId(jobId);

    const admin = await SchoolAdmin.findById(schoolAdminId);
    if (!admin) {
      return res.status(404).json({ message: "School Admin not found" });
    }

    const existingSavedJob = await SchoolAdminSavedJob.findOne({ schoolAdminId, jobId });
    if (existingSavedJob) {
      return res.status(400).json({ message: "Job already saved" });
    }

    const newSavedJob = new SchoolAdminSavedJob({ schoolAdminId, jobId });
    await newSavedJob.save();

    const savedJob = await SchoolAdminSavedJob.findById(newSavedJob._id).populate("jobId");
    res.status(201).json(savedJob);
  } catch (error) {
    res.status(500).json({ message: "Error saving job", error });
  }
};

const getSavedJobsBySchoolAdminId = async (req, res) => {
  const { schoolAdminId } = req.params;

  try {
    const savedJobs = await SchoolAdminSavedJob.find({ schoolAdminId }).populate("jobId");
    res.status(200).json(savedJobs);
  } catch (error) {
    res.status(500).json({ message: "Error fetching saved jobs", error });
  }
};

const removeSavedJobBySchoolAdmin = async (req, res) => {
  try {
    let { schoolAdminId, jobId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(schoolAdminId) || !mongoose.Types.ObjectId.isValid(jobId)) {
      return res.status(400).json({ message: "Invalid ID format" });
    }

    const objectAdminId = new mongoose.Types.ObjectId(schoolAdminId);
    const objectJobId = new mongoose.Types.ObjectId(jobId);

    const savedJob = await SchoolAdminSavedJob.findOne({ schoolAdminId: objectAdminId, jobId: objectJobId });

    if (!savedJob) {
      return res.status(404).json({ message: "Saved job not found" });
    }

    await SchoolAdminSavedJob.deleteOne({ _id: savedJob._id });
    res.status(200).json({ message: "Job removed successfully", deletedJob: savedJob });
  } catch (error) {
    res.status(500).json({ message: "Error removing job", error });
  }
};

module.exports = { saveJobBySchoolAdmin, getSavedJobsBySchoolAdminId, removeSavedJobBySchoolAdmin };
