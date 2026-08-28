const express = require("express");
const router = express.Router();

const {
  getPipelineByInternship,
  promoteCandidates,
  updatePipeline,
} = require("../../controllers/pipeline/pipelineController");

router.get("/internship/:internshipId", getPipelineByInternship);
router.post("/internship/:internshipId/promote", promoteCandidates);
router.patch("/:internshipId/:studentId", updatePipeline);

module.exports = router;
