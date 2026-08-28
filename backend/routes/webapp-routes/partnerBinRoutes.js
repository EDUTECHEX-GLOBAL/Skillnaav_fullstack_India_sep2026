const express = require("express");
const mongoose = require("mongoose");
const InternshipPosting = require("../../models/webapp-models/internshipPostModel");
const Application = require("../../models/webapp-models/applicationModel");
const SavedJob = require("../../models/webapp-models/SavedJobModel");
const OfferLetter = require("../../models/webapp-models/offerLetterModel");

const router = express.Router();

router.get("/:partnerId", async (req, res) => {
  try {
    const { partnerId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(partnerId)) {
      return res.status(400).json({ message: "Invalid partner ID" });
    }

    const deletedInternships = await InternshipPosting.find({
      partnerId,
      deleted: true,
      deletedBy: "partner",
    }).sort({ updatedAt: -1 });

    res.status(200).json({ data: deletedInternships });
  } catch (error) {
    console.error("Error fetching partner deleted internships:", error);
    res.status(500).json({
      message: "Server Error: Unable to fetch partner deleted internships",
      error: error.message,
    });
  }
});

router.patch("/:partnerId/:id/restore", async (req, res) => {
  try {
    const { partnerId, id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(partnerId) || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid partner or internship ID" });
    }

    const internship = await InternshipPosting.findOneAndUpdate(
      { _id: id, partnerId, deleted: true, deletedBy: "partner" },
      { $set: { deleted: false, deletedBy: null } },
      { new: true, runValidators: false }
    );

    if (!internship) {
      return res.status(404).json({ message: "Deleted internship not found for this partner" });
    }

    res.status(200).json({ message: "Internship restored successfully", internship });
  } catch (error) {
    console.error("Error restoring partner internship:", error);
    res.status(500).json({
      message: "Server Error: Unable to restore partner internship",
      error: error.message,
    });
  }
});

router.delete("/:partnerId/:id/permanent", async (req, res) => {
  try {
    const { partnerId, id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(partnerId) || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid partner or internship ID" });
    }

    const internship = await InternshipPosting.findOne({
      _id: id,
      partnerId,
      deleted: true,
      deletedBy: "partner",
    });
    if (!internship) {
      return res.status(404).json({ message: "Deleted internship not found for this partner" });
    }

    await OfferLetter.updateMany(
      { internshipId: internship._id },
      {
        $set: {
          location: internship.location,
          duration: internship.duration || internship.endDateOrDuration,
          endDateOrDuration: internship.endDateOrDuration,
          internshipType: internship.internshipType,
          internshipMode: internship.internshipMode,
          classification: internship.classification,
          compensationDetails: internship.compensationDetails,
          jobDescription: internship.jobDescription,
          qualifications: internship.qualifications || [],
          contactInfo: internship.contactInfo || {},
          imgUrl: internship.imgUrl,
          partnerId: internship.partnerId,
        },
      }
    );

    await Application.deleteMany({ internshipId: id });
    await InternshipPosting.deleteOne({ _id: id, partnerId });
    await SavedJob.deleteMany({ jobId: id });

    res.json({ message: "Internship permanently deleted" });
  } catch (error) {
    console.error("Error permanently deleting partner internship:", error);
    res.status(500).json({
      message: "Server Error: Unable to permanently delete partner internship",
      error: error.message,
    });
  }
});

module.exports = router;
