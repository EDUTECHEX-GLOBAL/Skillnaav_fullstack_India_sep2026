const jwt = require("jsonwebtoken");
const SuperAdminSettings = require("../models/webapp-models/SuperAdminSettingsModel");
const Admin = require("../models/webapp-models/adminModel");

const getSettings = async () => {
  let settings = await SuperAdminSettings.findOne().lean();
  if (!settings) settings = (await SuperAdminSettings.create({})).toObject();
  return settings;
};

const requirePlatformFeature = (feature, label) => async (req, res, next) => {
  try {
    const settings = await getSettings();
    if (settings.platformFeatures?.[feature] === false) {
      return res.status(503).json({ success: false, code: "FEATURE_DISABLED", feature, message: `${label} is temporarily unavailable. Please try again later.` });
    }
    return next();
  } catch (error) {
    console.error(`Unable to check platform feature ${feature}:`, error);
    return res.status(500).json({ success: false, message: "Unable to check platform availability." });
  }
};

const isAdminRequest = async (req) => {
  const authorization = req.headers.authorization || "";
  if (!authorization.startsWith("Bearer ")) return false;
  try {
    const decoded = jwt.verify(authorization.slice(7), process.env.JWT_SECRET || "yoursecretkey");
    return Boolean(await Admin.exists({ _id: decoded.id, status: { $ne: "Suspended" } }));
  } catch (_) { return false; }
};

const maintenanceGuard = async (req, res, next) => {
  if (req.path.startsWith("/admin")) return next();
  try {
    const settings = await getSettings();
    if (!settings.platformFeatures?.maintenanceMode || await isAdminRequest(req)) return next();
    return res.status(503).json({ success: false, code: "MAINTENANCE_MODE", message: "SkillNaav is currently under maintenance. Please try again later." });
  } catch (error) {
    console.error("Unable to check maintenance mode:", error);
    return res.status(500).json({ success: false, message: "Unable to check platform availability." });
  }
};

module.exports = { maintenanceGuard, requirePlatformFeature };
