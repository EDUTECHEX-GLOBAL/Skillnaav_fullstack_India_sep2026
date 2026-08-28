const express = require("express");
const NodeCache = require("node-cache");
const crypto = require("crypto");
const router = express.Router();
const {
  Discover,
  DiscoverCompImg,
  VisionHead,
  VisionPoint,
  Feature,
  Team,
  TeamMember,
  Pricing,
  PricingCard,
  FAQ,
  FAQCard,
  Contact,
  Footer,
} = require("../models/skillnaavModel");

const User = require("../models/userModel");

// ─── Cache ────────────────────────────────────────────────────────────────────
// TTL 10 min, check every 2 min.  Store the pre-serialised string so we only
// JSON.stringify once per cache population, not once per request.
const cache = new NodeCache({ stdTTL: 600, checkperiod: 120, useClones: false });

// ─── Helpers ──────────────────────────────────────────────────────────────────
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// ─── Field projections ────────────────────────────────────────────────────────
// List only the fields each collection actually uses on the front-end.
// Omitting _id is fine only if your front-end never needs it for mutations;
// keep it here for safety.  Add/remove fields freely.
const PROJECTIONS = {
  discover:        { discoverheading: 1, discoversubheading: 1, tryforfreebtn: 1, viewpricebtn: 1, imgUrl: 1 },
  discovercompimg: { imageUrl: 1 },
  visionhead:      { visionheading: 1, visionsub: 1, visionImg: 1 },
  visionpoint:     { visionpoint: 1 },
  features:        { feature: 1, featuredesc: 1, subfeature: 1, point1: 1, point2: 1, point3: 1, point4: 1, featureImg: 1 },
  team:            { teamheading: 1, teamsubheading: 1 },
  teammember:      { image: 1, teammemberName: 1, teammemberDesgn: 1, teammemberDesc: 1, teammemberLinkedin: 1 },
  pricing:         { priceheading: 1 },
  pricingcard:     { plantype: 1, plantypesubhead: 1, price: 1, duration: 1, pricepoint1: 1, pricepoint2: 1, pricepoint3: 1, pricebtn: 1, bgcolor: 1, color: 1 },
  faq:             { faqheading: 1, faqsubheading: 1 },
  faqcard:         { faq: 1, answer: 1 },
  footer:          { contactdetails: 1, email: 1, usefullinksheader: 1, usefullink1: 1, usefullink2: 1, usefullink3: 1, usefullink4: 1, stayinformedheader: 1, stayinformedsubtext: 1, subscribetext: 1, copyrighttext: 1, copyrightsubtext: 1 },
};

// ─── GET /get-skillnaav-data ──────────────────────────────────────────────────
router.get(
  "/get-skillnaav-data",
  asyncHandler(async (req, res) => {
    const CACHE_KEY  = "skillnaav-data";
    const ETAG_KEY   = "skillnaav-etag";

    // 1. Serve from cache if available
    let cached    = cache.get(CACHE_KEY);
    let cachedTag = cache.get(ETAG_KEY);

    if (cached && cachedTag) {
      // ETag check — return 304 if client already has this version
      if (req.headers["if-none-match"] === cachedTag) {
        return res.status(304).end();
      }
      res.setHeader("ETag", cachedTag);
      res.setHeader("Cache-Control", "public, max-age=600");
      return res.status(200).json(cached);
    }

    // 2. Cache miss — fetch from MongoDB
    //    .lean()      → plain JS objects (no Mongoose document overhead)
    //    projection   → only the fields the UI needs
    const [
      discovers,
      discovercompimg,
      visionhead,
      visionpoint,
      features,
      team,
      teammember,
      pricing,
      pricingcard,
      faq,
      faqcard,
      footer,
    ] = await Promise.all([
      Discover.find({},        PROJECTIONS.discover).lean(),
      DiscoverCompImg.find({}, PROJECTIONS.discovercompimg).lean(),
      VisionHead.find({},      PROJECTIONS.visionhead).lean(),
      VisionPoint.find({},     PROJECTIONS.visionpoint).lean(),
      Feature.find({},         PROJECTIONS.features).lean(),
      Team.find({},            PROJECTIONS.team).lean(),
      TeamMember.find({},      PROJECTIONS.teammember).lean(),
      Pricing.find({},         PROJECTIONS.pricing).lean(),
      PricingCard.find({},     PROJECTIONS.pricingcard).lean(),
      FAQ.find({},             PROJECTIONS.faq).lean(),
      FAQCard.find({},         PROJECTIONS.faqcard).lean(),
      Footer.find({},          PROJECTIONS.footer).lean(),
      // Note: Contact intentionally excluded — sensitive & not needed on the public page
    ]);

    const responseData = {
      discover: discovers,
      discovercompimg,
      visionhead,
      visionpoint,
      features,
      team,
      teammember,
      pricing,
      pricingcard,
      faq,
      faqcard,
      footer,
    };

    // 3. Generate ETag from content hash (cheap — done once per TTL window)
    const etag = `"${crypto
      .createHash("sha1")
      .update(JSON.stringify(responseData))
      .digest("hex")
      .slice(0, 16)}"`;

    cache.set(CACHE_KEY, responseData);
    cache.set(ETAG_KEY,  etag);

    res.setHeader("ETag", etag);
    res.setHeader("Cache-Control", "public, max-age=600");
    res.status(200).json(responseData);
  })
);

// ─── Generic CRUD helpers ─────────────────────────────────────────────────────
const createOne     = async (model, data) => { const i = new model(data); await i.save(); return i; };
const deleteOneById = async (model, id)   => model.findByIdAndDelete(id);

const createRoute = (path, model) =>
  router.post(path, asyncHandler(async (req, res) => {
    const instance = await createOne(model, req.body);
    cache.flushAll();
    res.status(200).json({ data: instance, success: true, message: `${model.modelName} added successfully` });
  }));

const updateRoute = (path, model) =>
  router.put(`${path}/:id`, asyncHandler(async (req, res) => {
    const updated = await model.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) return res.status(404).json({ success: false, message: `${model.modelName} not found` });
    cache.flushAll();
    res.status(200).json({ success: true, message: `${model.modelName} updated successfully`, data: updated });
  }));

const deleteRoute = (path, model) =>
  router.delete(`${path}/:id`, asyncHandler(async (req, res) => {
    await deleteOneById(model, req.params.id);
    cache.flushAll();
    res.status(200).json({ success: true, message: `${model.modelName} deleted successfully` });
  }));

// ─── Model-specific routes ────────────────────────────────────────────────────
createRoute("/add-discover", Discover);
updateRoute("/update-discover", Discover);
deleteRoute("/delete-discover", Discover);

createRoute("/add-discover-comp-img", DiscoverCompImg);
deleteRoute("/delete-discover-comp-img", DiscoverCompImg);

createRoute("/add-visionhead", VisionHead);
updateRoute("/update-visionhead", VisionHead);
deleteRoute("/delete-visionhead", VisionHead);

createRoute("/add-visionpoint", VisionPoint);
updateRoute("/update-visionpoint", VisionPoint);
deleteRoute("/delete-visionpoint", VisionPoint);

createRoute("/add-feature", Feature);
updateRoute("/update-feature", Feature);
deleteRoute("/delete-feature", Feature);

createRoute("/add-teammember", TeamMember);
updateRoute("/update-teammember", TeamMember);
deleteRoute("/delete-teammember", TeamMember);

// Pricing card update (body-based ID)
router.post("/update-pricingcard", asyncHandler(async (req, res) => {
  const { _id, ...fields } = req.body;
  const updated = await PricingCard.findByIdAndUpdate(_id, fields, { new: true });
  if (!updated) return res.status(404).json({ success: false, message: "Pricing card not found" });
  cache.flushAll();
  res.status(200).json({ success: true, message: "Pricing card updated successfully", data: updated });
}));

createRoute("/add-pricing", Pricing);
updateRoute("/update-pricing", Pricing);
deleteRoute("/delete-pricing", Pricing);

createRoute("/add-pricingcard", PricingCard);
updateRoute("/update-pricingcard-id", PricingCard);   // REST variant (uses :id)
deleteRoute("/delete-pricingcard", PricingCard);

// FAQ heading update (body-based ID)
router.post("/update-faqheading", asyncHandler(async (req, res) => {
  const { _id, faqheading, faqsubheading } = req.body;
  const updated = await FAQ.findByIdAndUpdate(_id, { faqheading, faqsubheading }, { new: true });
  if (!updated) return res.status(404).json({ success: false, message: "FAQ not found" });
  cache.flushAll();
  res.status(200).json({ success: true, message: "FAQ heading updated successfully", data: updated });
}));

createRoute("/add-faq", FAQ);
updateRoute("/update-faq", FAQ);
deleteRoute("/delete-faq", FAQ);

createRoute("/add-faqcard", FAQCard);
updateRoute("/update-faqcard", FAQCard);
deleteRoute("/delete-faqcard", FAQCard);

// ─── Contact routes ───────────────────────────────────────────────────────────
router.get("/", asyncHandler(async (req, res) => {
  const { page = 1, pageSize = 10, search = "", sort = "-createdAt" } = req.query;
  const query = { $or: [{ name: { $regex: search, $options: "i" } }, { email: { $regex: search, $options: "i" } }] };
  const [total, contacts] = await Promise.all([
    Contact.countDocuments(query),
    Contact.find(query).sort(sort).skip((+page - 1) * +pageSize).limit(+pageSize).lean(),
  ]);
  res.status(200).json({ contacts, total });
}));

router.post("/", asyncHandler(async (req, res) => {
  const { name, email, subject, message } = req.body;
  const newContact = new Contact({ name, email, subject, message });
  await newContact.save();
  res.status(201).json(newContact);
}));

router.delete("/:id", asyncHandler(async (req, res) => {
  await Contact.findByIdAndDelete(req.params.id);
  res.status(200).json({ success: true, message: "Contact deleted successfully" });
}));

// ─── Admin login ──────────────────────────────────────────────────────────────
// ⚠ SECURITY NOTE: passwords should be hashed (bcrypt). Storing/comparing plain
//   text passwords is a serious vulnerability. Migrate to hashed passwords ASAP.
router.post("/admin-login", asyncHandler(async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username }).lean();
  if (user && user.password === password) {
    const { password: _pw, ...safeUser } = user;  // never send password back
    return res.status(200).json({ data: safeUser, success: true, message: "Login Successfully" });
  }
  res.status(401).json({ success: false, message: "Invalid username or password" });
}));

module.exports = router;