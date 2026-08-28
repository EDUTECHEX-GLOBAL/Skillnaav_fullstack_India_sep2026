const mongoose = require("mongoose");

const resumeSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Userwebapp",
    required: true,
  },
  fileUrl: {
    type: String,
    required: true,
  },
  fileName: {
    type: String,
    default: "",
  },
  uploadedAt: {
    type: Date,
    default: Date.now,
  },
  isParsed: {
    type: Boolean,
    default: false,
  },
  parsedData: {
    type: Object,
    default: null,
  },
});

module.exports = mongoose.model("Resume", resumeSchema);