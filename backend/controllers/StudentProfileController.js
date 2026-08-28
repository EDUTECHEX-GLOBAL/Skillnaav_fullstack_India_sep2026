const mongoose = require("mongoose");
const StudentProfile = require("../models/webapp-models/SudentProfileModel");
const Userwebapp = require("../models/webapp-models/userModel");

// ─────────────────────────────────────────────────────────────────────────────
// GET merged profile (Userwebapp + StudentProfile extension)
// GET /api/student-profile/:userId
// ─────────────────────────────────────────────────────────────────────────────
const getProfile = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid userId" });
    }

    const user = await Userwebapp.findById(userId)
      .select("-password -otp -otpExpiration")
      .lean();

    if (!user) return res.status(404).json({ message: "User not found" });

    let profile = await StudentProfile.findOne({ userId });
    if (!profile) {
      profile = await StudentProfile.create({ userId });
    }

    const score = calcScore(user, profile);
    if (profile.profileCompletionScore !== score) {
      profile.profileCompletionScore = score;
      await profile.save();
    }

    return res.json({
      // ── From Userwebapp ──────────────────────────────────────
      userId:            user._id,
      name:              user.name || "",
      email:             user.email || "",
      phone:             user.phone || "",
      linkedin:          user.linkedin || "",
      portfolio:         user.portfolio || "",
      profileImage:      user.profileImage || "",
      universityName:    user.universityName || "",
      fieldOfStudy:      user.fieldOfStudy || "",
      educationLevel:    user.educationLevel || "",
      desiredField:      user.desiredField || "",
      dob:               user.dob || "",
      country:           user.country || "",
      state:             user.state || "",
      city:              user.city || "",
      postalCode:        user.postalCode || "",
      address:           user.address || "",
      skills:            user.skills || [],
      interests:         user.interests || [],
      preferredLocations: user.preferredLocations || [],
      currentGrade:      user.currentGrade || "",
      gradePercentage:   user.gradePercentage || "",
      isPremium:         user.isPremium,
      planType:          user.planType,

      // ── From StudentProfile extension ────────────────────────
      profileId:             profile._id,
      summary:               profile.summary || "",
      experience:            profile.experience || [],
      projects:              profile.projects || [],
      certifications:        profile.certifications || [],
      languages:             profile.languages || [],
      pendingDiffs:          (profile.pendingDiffs || []).filter(d => d.status === "pending"),
      profileCompletionScore: score,
    });
  } catch (err) {
    console.error("getProfile error:", err);
    return res.status(500).json({ message: "Failed to fetch profile" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE extension-only fields
// PUT /api/student-profile/:userId
// Body: { section, data }
// ─────────────────────────────────────────────────────────────────────────────
const updateProfile = async (req, res) => {
  try {
    const { userId } = req.params;
    const { section, data } = req.body;

    const allowed = ["summary", "experience", "projects", "certifications", "languages"];
    if (!allowed.includes(section)) {
      return res.status(400).json({ message: `Invalid section. Allowed: ${allowed.join(", ")}` });
    }

    const profile = await StudentProfile.findOneAndUpdate(
      { userId },
      { $set: { [section]: data } },
      { new: true, upsert: true, runValidators: true }
    );

    return res.json({ message: "Profile updated", profile });
  } catch (err) {
    console.error("updateProfile error:", err);
    return res.status(500).json({ message: "Failed to update profile" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// ADD AI DIFFS
// POST /api/student-profile/:userId/diffs
// ─────────────────────────────────────────────────────────────────────────────
const addDiffs = async (req, res) => {
  try {
    const { userId } = req.params;
    const { diffs } = req.body;

    if (!Array.isArray(diffs) || diffs.length === 0) {
      return res.status(400).json({ message: "diffs array required" });
    }

    let profile = await StudentProfile.findOne({ userId });
    if (!profile) profile = await StudentProfile.create({ userId });

    const existingKeys = profile.pendingDiffs
      .filter(d => d.status === "pending")
      .map(d => `${d.field}::${JSON.stringify(d.suggestedValue)}`);

    const newDiffs = diffs.filter(d => {
      const key = `${d.field}::${JSON.stringify(d.suggestedValue)}`;
      return !existingKeys.includes(key);
    });

    if (newDiffs.length === 0) {
      return res.json({ message: "No new diffs to add", added: 0 });
    }

    await StudentProfile.findOneAndUpdate(
      { userId },
      { $push: { pendingDiffs: { $each: newDiffs } } },
      { upsert: true }
    );

    return res.json({ message: "Diffs added", added: newDiffs.length });
  } catch (err) {
    console.error("addDiffs error:", err);
    return res.status(500).json({ message: "Failed to add diffs" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// RESOLVE single diff (approve or reject)
// PATCH /api/student-profile/:userId/diffs/:diffId
// Body: { action: "approve" | "reject" }
// ─────────────────────────────────────────────────────────────────────────────
const resolveDiff = async (req, res) => {
  try {
    const { userId, diffId } = req.params;
    const { action } = req.body;

    if (!["approve", "reject"].includes(action)) {
      return res.status(400).json({ message: "action must be 'approve' or 'reject'" });
    }

    const profile = await StudentProfile.findOne({ userId });
    if (!profile) return res.status(404).json({ message: "Profile not found" });

    const diffIndex = profile.pendingDiffs.findIndex(
      d => d._id.toString() === diffId
    );
    if (diffIndex === -1) return res.status(404).json({ message: "Diff not found" });

    const diff = profile.pendingDiffs[diffIndex];
    profile.pendingDiffs[diffIndex].status = action === "approve" ? "approved" : "rejected";

    if (action === "approve") {
      if (diff.target === "userwebapp") {
        await applyToUserwebapp(userId, diff);
      } else {
        applyToProfile(profile, diff);
      }
    }

    await profile.save();
    return res.json({ message: `Diff ${action}d successfully` });
  } catch (err) {
    console.error("resolveDiff error:", err);
    return res.status(500).json({ message: "Failed to resolve diff" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// BULK RESOLVE all pending diffs
// PATCH /api/student-profile/:userId/diffs/bulk
// Body: { action: "approve" | "reject", diffIds?: string[] }
// ─────────────────────────────────────────────────────────────────────────────
const bulkResolveDiffs = async (req, res) => {
  try {
    const { userId } = req.params;
    const { action, diffIds } = req.body;

    if (!["approve", "reject"].includes(action)) {
      return res.status(400).json({ message: "action must be 'approve' or 'reject'" });
    }

    const profile = await StudentProfile.findOne({ userId });
    if (!profile) return res.status(404).json({ message: "Profile not found" });

    const targets = diffIds?.length
      ? profile.pendingDiffs.filter(
          d => diffIds.includes(d._id.toString()) && d.status === "pending"
        )
      : profile.pendingDiffs.filter(d => d.status === "pending");

    for (const diff of targets) {
      const idx = profile.pendingDiffs.findIndex(
        d => d._id.toString() === diff._id.toString()
      );
      profile.pendingDiffs[idx].status = action === "approve" ? "approved" : "rejected";

      if (action === "approve") {
        if (diff.target === "userwebapp") {
          await applyToUserwebapp(userId, diff);
        } else {
          applyToProfile(profile, diff);
        }
      }
    }

    await profile.save();
    return res.json({ message: `Bulk ${action} done`, resolved: targets.length });
  } catch (err) {
    console.error("bulkResolveDiffs error:", err);
    return res.status(500).json({ message: "Failed to bulk resolve diffs" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PRIVATE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

async function applyToUserwebapp(userId, diff) {
  const { field, suggestedValue } = diff;
  const arrayFields = ["skills", "interests", "preferredLocations"];

  if (arrayFields.includes(field)) {
    const toAdd = Array.isArray(suggestedValue) ? suggestedValue : [suggestedValue];
    await Userwebapp.findByIdAndUpdate(userId, {
      $addToSet: { [field]: { $each: toAdd } },
    });
  } else {
    await Userwebapp.findByIdAndUpdate(userId, {
      $set: { [field]: suggestedValue },
    });
  }
}

function applyToProfile(profile, diff) {
  const { section, suggestedValue } = diff;
  switch (section) {
    case "summary":        profile.summary = suggestedValue; break;
    case "experience":     profile.experience.push(suggestedValue); break;
    case "projects":       profile.projects.push(suggestedValue); break;
    case "certifications": profile.certifications.push(suggestedValue); break;
    case "languages":      profile.languages.push(suggestedValue); break;
    default: break;
  }
}

function calcScore(user, profile) {
  let s = 0;
  if (user.name)                          s += 8;
  if (user.email)                         s += 5;
  if (user.profileImage)                  s += 5;
  if (user.linkedin)                      s += 7;
  if (user.portfolio)                     s += 5;
  if (profile?.summary)                   s += 10;
  if (user.universityName)                s += 5;
  if (user.fieldOfStudy)                  s += 5;
  if (user.educationLevel)                s += 5;
  if ((user.skills || []).length > 0)     s += 15;
  if ((profile?.experience || []).length > 0) s += 15;
  if ((profile?.projects || []).length > 0)   s += 10;
  if ((profile?.certifications || []).length > 0) s += 5;
  return Math.min(s, 100);
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS — must match exactly what studentProfileRoutes.js imports
// ─────────────────────────────────────────────────────────────────────────────
module.exports = {
  getProfile,
  updateProfile,
  addDiffs,
  resolveDiff,
  bulkResolveDiffs,
};