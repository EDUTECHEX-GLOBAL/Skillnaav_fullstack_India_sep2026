// ─────────────────────────────────────────────────────────────────────────────
// profileCompletionController.js
// Features: profile completion scoring, student overview, individual deep-dive
// Add to schoolAdminController.js or mount as a separate controller file
// ─────────────────────────────────────────────────────────────────────────────

const asyncHandler = require("express-async-handler");
const Userwebapp = require("../../models/webapp-models/userModel");

// ─── Weighted field definitions ───────────────────────────────────────────────
// Adjust weights as needed — they must sum to 100
const PROFILE_FIELDS = [
  { key: "name",               label: "Full Name",              weight: 5  },
  { key: "email",              label: "Email",                  weight: 5  },
  { key: "dob",                label: "Date of Birth",          weight: 5  },
  { key: "universityName",     label: "University / School",    weight: 8  },
  { key: "educationLevel",     label: "Education Level",        weight: 7  },
  { key: "fieldOfStudy",       label: "Field of Study",         weight: 7  },
  { key: "desiredField",       label: "Desired Career Field",   weight: 7  },
  { key: "profileImage",       label: "Profile Photo",          weight: 6  },
  { key: "linkedin",           label: "LinkedIn URL",           weight: 5  },
  { key: "portfolio",          label: "Portfolio URL",          weight: 5  },
  { key: "skills",             label: "Skills (≥1)",            weight: 8  },
  { key: "interests",          label: "Interests (≥1)",         weight: 7  },
  { key: "preferredLocations", label: "Preferred Locations",    weight: 5  },
  { key: "country",            label: "Country",                weight: 5  },
  { key: "city",               label: "City",                   weight: 5  },
  { key: "financialStatus",    label: "Financial Status",       weight: 5  },
  { key: "currentGrade",       label: "Current Grade",          weight: 5  },
];
// Total = 100 ✓

// ─── Helper: compute completion score for one student object ──────────────────
function computeCompletion(student) {
  let earned = 0;
  const missing = [];
  const completed = [];

  for (const field of PROFILE_FIELDS) {
    const val = student[field.key];
    const filled = Array.isArray(val)
      ? val.length > 0
      : val !== undefined && val !== null && val !== "";

    if (filled) {
      earned += field.weight;
      completed.push(field.label);
    } else {
      missing.push({ label: field.label, weight: field.weight });
    }
  }

  return {
    percentage:      earned,      // 0–100
    completedFields: completed,
    missingFields:   missing,     // [{ label, weight }]
  };
}

// ─── GET /api/school-admin/students/profile-overview ─────────────────────────
// Returns all students with their completion score (for the overview table)
const getStudentProfileOverview = asyncHandler(async (req, res) => {
  const adminId = req.schoolAdmin._id;

  const students = await Userwebapp.find({ schoolAdmin: adminId }).select(
    "-password -otp -otpExpiration -googleId"
  );

  const overview = students.map((s) => {
    const obj = s.toObject();
    const { percentage, missingFields } = computeCompletion(obj);
    return {
      _id:          obj._id,
      name:         obj.name,
      email:        obj.email,
      isActive:     obj.isActive,
      profileImage: obj.profileImage,
      completion:   percentage,
      stalled:      percentage < 60,
      missingCount: missingFields.length,
    };
  });

  res.status(200).json(overview);
});

// ─── GET /api/school-admin/students/:id/profile-detail ───────────────────────
// Returns a single student's full profile + field-level completion breakdown
const getStudentProfileDetail = asyncHandler(async (req, res) => {
  const adminId = req.schoolAdmin._id;
  const { id }  = req.params;

  const student = await Userwebapp.findOne({
    _id: id,
    schoolAdmin: adminId,
  }).select("-password -otp -otpExpiration -googleId");

  if (!student) {
    res.status(404);
    throw new Error("Student not found.");
  }

  const obj        = student.toObject();
  const completion = computeCompletion(obj);

  res.status(200).json({ student: obj, completion });
});

module.exports = {
  getStudentProfileOverview,
  getStudentProfileDetail,
  PROFILE_FIELDS,
};