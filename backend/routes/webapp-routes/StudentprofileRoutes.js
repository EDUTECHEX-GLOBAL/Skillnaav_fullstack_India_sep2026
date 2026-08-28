const express = require("express");
const router = express.Router();

// ⚠️ Adjust this path to match your actual folder structure.
// If your routes are at:  backend/routes/webapp-routes/studentProfileRoutes.js
// And controller is at:   backend/controllers/studentProfileController.js
// Then the relative path is:
const {
  getProfile,
  updateProfile,
  addDiffs,
  resolveDiff,
  bulkResolveDiffs,
} = require("../../controllers/StudentProfileController");

// ── Verify all functions loaded correctly ──────────────────────────────────
// (Remove this block after confirming it works)
const fns = { getProfile, updateProfile, addDiffs, resolveDiff, bulkResolveDiffs };
Object.entries(fns).forEach(([name, fn]) => {
  if (typeof fn !== "function") {
    throw new Error(
      `studentProfileRoutes: "${name}" is not a function. ` +
      `Check the export in studentProfileController.js`
    );
  }
});

// ── Profile CRUD ───────────────────────────────────────────────────────────
router.get("/:userId", getProfile);
router.put("/:userId", updateProfile);

// ── Diffs — IMPORTANT: bulk route must come BEFORE /:diffId ───────────────
router.patch("/:userId/diffs/bulk", bulkResolveDiffs);
router.patch("/:userId/diffs/:diffId", resolveDiff);
router.post("/:userId/diffs", addDiffs);
router.get("/:userId/diffs", (req, res) => {
  // Convenience: same as getProfile but only returns pending diffs
  res.redirect(`/api/student-profile/${req.params.userId}`);
});

module.exports = router;