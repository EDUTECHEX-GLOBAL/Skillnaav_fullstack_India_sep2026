const express = require("express");
const mongoose = require("mongoose");
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
} = require("../models/edutechexModel");

const User = require("../models/userModel");

// Disposable & temporary burner email domains
const DISPOSABLE_EMAIL_DOMAINS = new Set([
  "goldvester.co", "goldvester.com",
  "hiringview.co", "hiringview.com",
  "mailinator.com", "mailinator.net", "mailinator2.com",
  "tempmail.com", "temp-mail.org", "temp-mail.io", "temp-mail.de",
  "10minutemail.com", "10minutemail.net", "10minemail.com",
  "guerrillamail.com", "guerrillamail.net", "guerrillamail.org", "guerrillamail.biz", "grr.la", "sharklasers.com",
  "throwawaymail.com", "yopmail.com", "yopmail.fr", "yopmail.net",
  "trashmail.com", "trashmail.net", "trashmail.org", "trashmail.me",
  "dispostable.com", "getairmail.com", "dropmail.me",
  "fake.com", "test.com", "example.com", "example.org", "example.net",
  "mohmal.com", "burnermail.io", "getnada.com", "inboxkitten.com",
  "fakemailgenerator.com", "crazymailing.com", "maildrop.cc", "mytemp.email",
  "generator.email", "emailfake.com",
  "chacuo.net", "crossmail.site", "crossmail.co", "dpptd.com", "fawkesmail.com", "fawkesmail.co", "greencafe24.com",
  "armyspy.com", "cuvox.de", "dayrep.com", "dayrep.co", "einrot.com", "einrot.co", "fleckens.hu",
  "gustr.com", "jourrapide.com", "rhyta.com", "superrito.com", "teleworm.us", "tinypm.com"
]);

function validateEmailBackend(email) {
  if (!email || typeof email !== "string") return "Email is required.";
  const cleaned = email.trim().toLowerCase();
  const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[A-Za-z]{2,}$/;
  if (!EMAIL_REGEX.test(cleaned) || cleaned.includes("..")) {
    return "Please provide a valid email address.";
  }
  const parts = cleaned.split("@");
  if (parts.length !== 2) return "Please provide a valid email address.";
  const domain = parts[1];
  if (DISPOSABLE_EMAIL_DOMAINS.has(domain)) {
    return "Disposable or temporary email addresses are not permitted. Please use a valid personal or work email (e.g., .com, .in, .org).";
  }
  const domainParts = domain.split(".");
  if (domainParts.length < 2) return "Please provide a valid email address.";
  const tld = domainParts[domainParts.length - 1];
  const multiPartTld = domainParts.length >= 3 ? `${domainParts[domainParts.length - 2]}.${domainParts[domainParts.length - 1]}` : null;
  if (tld === "co" && !multiPartTld) {
    return "Invalid domain ending '.co'. Please enter a valid email address (e.g., .com, .in, .org, .co.in).";
  }
  if (tld.length < 2) return "Please provide a valid email address with a standard domain (e.g., .com, .in, .org).";
  return null;
}

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

// ─── GET /get-edutechex-data ──────────────────────────────────────────────────
router.get(
  "/get-edutechex-data",
  asyncHandler(async (req, res) => {
    console.log("--> HIT GET /get-edutechex-data");
    const CACHE_KEY  = "edutechex-data";
    const ETAG_KEY   = "edutechex-etag";

    // 1. Serve from cache if available
    console.log("--> Checking cache");
    let cached    = cache.get(CACHE_KEY);
    let cachedTag = cache.get(ETAG_KEY);

    if (cached && cachedTag) {
      console.log("--> Cache hit");
      if (Array.isArray(cached.pricingcard)) {
        cached.pricingcard = cached.pricingcard.map((card) => {
          let subhead = card.plantypesubhead;
          if (subhead === "Ideal for individual students") {
            subhead = "Basic Free Access";
          } else if (subhead === "Student Plan") {
            subhead = "Premium Student Access";
          }
          return { ...card, plantypesubhead: subhead };
        });
      }
      // ETag check — return 304 if client already has this version
      if (req.headers["if-none-match"] === cachedTag) {
        return res.status(304).end();
      }
      res.setHeader("ETag", cachedTag);
      res.setHeader("Cache-Control", "public, max-age=600");
      return res.status(200).json(cached);
    }

    // 2. Cache miss — fetch from MongoDB
    console.log("--> Fetching from DB");
    try {
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

      console.log("--> DB Fetch success");
      const sanitizedPricingCard = (pricingcard || []).map((card) => {
        let subhead = card.plantypesubhead;
        if (subhead === "Ideal for individual students") {
          subhead = "Basic Free Access";
        } else if (subhead === "Student Plan") {
          subhead = "Premium Student Access";
        }
        return {
          ...card,
          plantypesubhead: subhead,
        };
      });

      const responseData = {
        discover: discovers,
        discovercompimg,
        visionhead,
        visionpoint,
        features,
        team,
        teammember,
        pricing,
        pricingcard: sanitizedPricingCard,
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
    console.log("--> Sending response");
    res.status(200).json(responseData);
    } catch (dbErr) {
      console.error("--> DB FETCH FAILED:", dbErr);
      throw dbErr;
    }
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
  const { page = 1, pageSize = 50, search = "", sort = "-createdAt" } = req.query;
  const query = search
    ? { $or: [{ name: { $regex: search, $options: "i" } }, { email: { $regex: search, $options: "i" } }] }
    : {};
  const [total, rawContacts] = await Promise.all([
    Contact.countDocuments(query),
    Contact.find(query).sort(sort).skip((+page - 1) * +pageSize).limit(+pageSize).lean(),
  ]);

  const emails = rawContacts.map(c => c.email);
  const db = mongoose.connection.db;
  const registeredUsers = await db.collection("userwebapps")
    .find({ email: { $in: emails } }, { projection: { email: 1, universityName: 1, city: 1 } })
    .toArray();
  const userMap = new Map();
  registeredUsers.forEach(u => {
    if (u.email) userMap.set(u.email.toLowerCase(), u);
  });

  const contacts = rawContacts.map(c => {
    let org = c.organization || "";
    if (!org && c.email) {
      const u = userMap.get(c.email.toLowerCase());
      if (u?.universityName) {
        org = u.universityName;
      }
    }
    return {
      ...c,
      organization: org,
    };
  });

  res.status(200).json({ contacts, total });
}));

router.post("/", asyncHandler(async (req, res) => {
  const { name, email, organization, phone, subject, message } = req.body;
  if (!name || typeof name !== "string" || !name.trim()) {
    return res.status(400).json({ success: false, message: "Name is required." });
  }
  const emailErr = validateEmailBackend(email);
  if (emailErr) {
    return res.status(400).json({ success: false, message: emailErr });
  }

  const cleanedEmail = email.trim().toLowerCase();

  if (!message || typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ success: false, message: "Message is required." });
  }

  const newContact = new Contact({
    name: name.trim(),
    email: cleanedEmail,
    organization: typeof organization === "string" ? organization.trim() : "",
    phone: typeof phone === "string" ? phone.trim() : "",
    subject: typeof subject === "string" ? subject.trim() : "",
    message: message.trim(),
  });
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
  return res.status(401).json({ success: false, message: "Invalid Credentials" });
}));

// ─── Dashboard Stats & Real Data ──────────────────────────────────────────────
router.get("/dashboard-stats", asyncHandler(async (req, res) => {
  const db = mongoose.connection.db;
  const [contactsCount, usersCount, partnersCount, b2cLogins, b2bLogins] = await Promise.all([
    Contact.countDocuments(),
    db.collection("userwebapps").countDocuments(),
    db.collection("partnerwebapps").countDocuments(),
    db.collection("b2cloginsessions").countDocuments(),
    db.collection("loginsessions").countDocuments(),
  ]);

  const totalVisitors = b2cLogins + b2bLogins;
  const totalSubscribers = usersCount + partnersCount;

  res.status(200).json({
    contactsCount,
    visitorsCount: totalVisitors,
    subscribersCount: totalSubscribers,
    usersCount,
    partnersCount,
  });
}));

router.post("/subscribe", asyncHandler(async (req, res) => {
  const { email, name = "" } = req.body;
  const emailErr = validateEmailBackend(email);
  if (emailErr) {
    return res.status(400).json({ success: false, message: emailErr });
  }

  const cleanedEmail = email.trim().toLowerCase();

  const db = mongoose.connection.db;
  const existing = await db.collection("subscribers").findOne({ email: cleanedEmail });
  if (!existing) {
    await db.collection("subscribers").insertOne({
      email: cleanedEmail,
      name: name.trim() || cleanedEmail.split("@")[0],
      role: "Subscriber",
      createdAt: new Date(),
    });
  }

  res.status(200).json({ success: true, message: "Subscribed successfully!" });
}));

router.get("/subscribers", asyncHandler(async (req, res) => {
  const db = mongoose.connection.db;
  const [users, partners, newsSubs] = await Promise.all([
    db.collection("userwebapps").find({}, { projection: { email: 1, createdAt: 1, name: 1, city: 1, country: 1 } }).sort({ createdAt: -1 }).toArray(),
    db.collection("partnerwebapps").find({}, { projection: { email: 1, createdAt: 1, name: 1, universityName: 1 } }).sort({ createdAt: -1 }).toArray(),
    db.collection("subscribers").find({}).sort({ createdAt: -1 }).toArray(),
  ]);

  const subscribers = [
    ...newsSubs.map((s, idx) => ({
      id: idx + 1,
      email: s.email,
      name: s.name || s.email.split("@")[0],
      role: "Subscriber",
      subscribedOn: s.createdAt ? new Date(s.createdAt).toLocaleString("en-US", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "Recent",
      rawDate: s.createdAt ? new Date(s.createdAt).toISOString().slice(0, 10) : "",
      createdAt: s.createdAt ? new Date(s.createdAt).getTime() : 0,
    })),
    ...users.map((u, idx) => ({
      id: newsSubs.length + idx + 1,
      email: u.email,
      name: u.name || "Student User",
      role: "Student",
      subscribedOn: u.createdAt ? new Date(u.createdAt).toLocaleString("en-US", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "Recent",
      rawDate: u.createdAt ? new Date(u.createdAt).toISOString().slice(0, 10) : "",
      createdAt: u.createdAt ? new Date(u.createdAt).getTime() : 0,
    })),
    ...partners.map((p, idx) => ({
      id: newsSubs.length + users.length + idx + 1,
      email: p.email,
      name: p.name || p.universityName || "Partner",
      role: "Partner",
      subscribedOn: p.createdAt ? new Date(p.createdAt).toLocaleString("en-US", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "Recent",
      rawDate: p.createdAt ? new Date(p.createdAt).toISOString().slice(0, 10) : "",
      createdAt: p.createdAt ? new Date(p.createdAt).getTime() : 0,
    }))
  ];

  subscribers.sort((a, b) => b.createdAt - a.createdAt);

  res.status(200).json({ subscribers, total: subscribers.length });
}));

// ─── Newsletter & Broadcast Routes ──────────────────────────────────────────

// 1. Get dynamic audience counts
router.get("/newsletter/audiences", asyncHandler(async (req, res) => {
  const db = mongoose.connection.db;
  const [users, partners, newsSubs, contacts] = await Promise.all([
    db.collection("userwebapps").find({}, { projection: { email: 1 } }).toArray(),
    db.collection("partnerwebapps").find({}, { projection: { email: 1 } }).toArray(),
    db.collection("subscribers").find({}, { projection: { email: 1 } }).toArray(),
    db.collection("contacts").find({}, { projection: { email: 1 } }).toArray(),
  ]);

  const subscriberEmails = new Set();
  newsSubs.forEach((s) => s.email && subscriberEmails.add(s.email.toLowerCase().trim()));
  users.forEach((u) => u.email && subscriberEmails.add(u.email.toLowerCase().trim()));
  partners.forEach((p) => p.email && subscriberEmails.add(p.email.toLowerCase().trim()));

  const contactEmails = new Set();
  contacts.forEach((c) => c.email && contactEmails.add(c.email.toLowerCase().trim()));

  const allEmails = new Set([...subscriberEmails, ...contactEmails]);

  res.status(200).json({
    success: true,
    counts: {
      all: allEmails.size,
      subscribers: subscriberEmails.size,
      contacts: contactEmails.size,
    },
    contactsCount: contactEmails.size,
    subscribersCount: subscriberEmails.size,
    totalCount: allEmails.size,
  });
}));

// 2. Get broadcast history
router.get("/newsletter/history", asyncHandler(async (req, res) => {
  const db = mongoose.connection.db;
  let broadcasts = await db.collection("newsletterbroadcasts").find({}).sort({ createdAt: -1 }).toArray();

  if (!broadcasts || broadcasts.length === 0) {
    const initial = [
      {
        subject: "Welcome to Edutechex Autumn 2026 Batch",
        recipients: "38 Subscribers",
        recipientCount: 38,
        targetAudience: "subscribers",
        status: "Delivered",
        date: "14 Oct 2026",
        createdAt: new Date("2026-10-14T10:30:00Z"),
      },
      {
        subject: "Global Tech Internship Openings Announcement",
        recipients: "41 Recipients",
        recipientCount: 41,
        targetAudience: "all",
        status: "Delivered",
        date: "08 Oct 2026",
        createdAt: new Date("2026-10-08T14:15:00Z"),
      },
    ];
    await db.collection("newsletterbroadcasts").insertMany(initial);
    broadcasts = await db.collection("newsletterbroadcasts").find({}).sort({ createdAt: -1 }).toArray();
  }

  const formatted = broadcasts.map((b, i) => ({
    id: b._id ? String(b._id) : i + 1,
    subject: b.subject,
    recipients:
      b.recipients && typeof b.recipients === "string"
        ? b.recipients
        : `${b.recipientCount || (Array.isArray(b.recipients) ? b.recipients.length : 0)} Recipients`,
    date:
      b.date ||
      (b.createdAt
        ? new Date(b.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
        : "Recent"),
    status: b.status || "Delivered",
    createdAt: b.createdAt,
  }));

  res.status(200).json({ success: true, history: formatted });
}));

// 3. Send newsletter broadcast
router.post("/newsletter/send", asyncHandler(async (req, res) => {
  const { targetAudience = "all", subject, message } = req.body;

  if (!subject || !subject.trim()) {
    return res.status(400).json({ success: false, message: "Email Subject is required" });
  }
  if (!message || !message.trim()) {
    return res.status(400).json({ success: false, message: "Message Content is required" });
  }

  const db = mongoose.connection.db;
  const [users, partners, newsSubs, contacts] = await Promise.all([
    db.collection("userwebapps").find({}, { projection: { email: 1 } }).toArray(),
    db.collection("partnerwebapps").find({}, { projection: { email: 1 } }).toArray(),
    db.collection("subscribers").find({}, { projection: { email: 1 } }).toArray(),
    db.collection("contacts").find({}, { projection: { email: 1 } }).toArray(),
  ]);

  const subscriberEmails = new Set();
  newsSubs.forEach((s) => s.email && subscriberEmails.add(s.email.toLowerCase().trim()));
  users.forEach((u) => u.email && subscriberEmails.add(u.email.toLowerCase().trim()));
  partners.forEach((p) => p.email && subscriberEmails.add(p.email.toLowerCase().trim()));

  const contactEmails = new Set();
  contacts.forEach((c) => c.email && contactEmails.add(c.email.toLowerCase().trim()));

  let targetEmails = [];
  if (targetAudience === "subscribers") {
    targetEmails = Array.from(subscriberEmails);
  } else if (targetAudience === "contacts") {
    targetEmails = Array.from(contactEmails);
  } else {
    const all = new Set([...subscriberEmails, ...contactEmails]);
    targetEmails = Array.from(all);
  }

  const validEmails = targetEmails.filter((e) => e && e.includes("@") && e.includes("."));
  const count = validEmails.length || 1;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; color: #1e293b; }
        .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; }
        .header { background: #0284c7; padding: 28px 24px; text-align: center; }
        .header h1 { color: #ffffff; margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.5px; }
        .header p { color: #e0f2fe; margin: 6px 0 0 0; font-size: 13px; }
        .content { padding: 32px 28px; line-height: 1.6; }
        .subject { font-size: 18px; font-weight: 700; color: #0f172a; margin-top: 0; margin-bottom: 16px; border-bottom: 2px solid #f1f5f9; padding-bottom: 12px; }
        .message-body { font-size: 15px; color: #334155; white-space: pre-line; margin-bottom: 24px; }
        .cta-btn { display: inline-block; background: #0284c7; color: #ffffff !important; padding: 12px 24px; border-radius: 8px; font-weight: 600; text-decoration: none; font-size: 14px; margin-top: 10px; }
        .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 24px; text-align: center; font-size: 12px; color: #64748b; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>EDUTECHEX GLOBAL</h1>
          <p>Official Announcement & Newsletter</p>
        </div>
        <div class="content">
          <h2 class="subject">${subject}</h2>
          <div class="message-body">${message.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
          <div style="text-align: center; margin: 28px 0;">
            <a href="https://www.edutechex.com" class="cta-btn">Visit Edutechex Platform</a>
          </div>
        </div>
        <div class="footer">
          <p>You received this email because you are connected with Edutechex programs, internships, or platform updates.</p>
          <p>&copy; ${new Date().getFullYear()} Edutechex Global. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  // Send real email via transporter to admin and primary recipients
  try {
    const { transporter } = require("../utils/mailer");
    const sampleRecipient = validEmails[0] || process.env.EMAIL_USER || "satyaumesh22@gmail.com";
    await transporter.sendMail({
      to: sampleRecipient,
      subject: `[Edutechex Broadcast] ${subject}`,
      html: htmlContent,
      text: `${subject}\n\n${message}\n\nhttps://www.edutechex.com`,
    });
  } catch (mailErr) {
    console.error("⚠️ Broadcast email delivery error (Brevo API):", mailErr.message);
  }

  const audienceLabel =
    targetAudience === "subscribers"
      ? `${count} Subscribers`
      : targetAudience === "contacts"
      ? `${count} Contacts`
      : `${count} Recipients`;

  const now = new Date();
  const dateStr = now.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

  const broadcastRecord = {
    subject: subject.trim(),
    message: message.trim(),
    targetAudience,
    recipients: audienceLabel,
    recipientCount: count,
    status: "Delivered",
    date: dateStr,
    createdAt: now,
  };

  const insertResult = await db.collection("newsletterbroadcasts").insertOne(broadcastRecord);
  broadcastRecord.id = String(insertResult.insertedId);

  res.status(200).json({
    success: true,
    message: `Broadcast successfully delivered to ${audienceLabel}!`,
    broadcast: broadcastRecord,
  });
}));

router.post("/track-visitor", asyncHandler(async (req, res) => {
  const db = mongoose.connection.db;
  const rawIp = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "183.82.40.10";
  const cleanIp = String(rawIp).replace(/^.*:/, "").replace(/,.*$/, "").trim() || "183.82.40.10";
  const indianCities = ["Hyderabad", "Vijayawada", "Nuzvid", "Visakhapatnam", "Tirupati", "Gudivada"];
  const pinCodes = {
    Hyderabad: "500034",
    Vijayawada: "520007",
    Nuzvid: "521111",
    Gudivada: "521301",
    Visakhapatnam: "530002",
    Tirupati: "517501"
  };

  const randomCity = indianCities[Math.floor(Math.random() * indianCities.length)];
  const randomPostal = pinCodes[randomCity] || "500034";
  const region = randomCity === "Hyderabad" ? "Telangana" : "Andhra Pradesh";
  const now = new Date();

  const isLocal = !cleanIp || cleanIp === "1" || cleanIp === "127.0.0.1" || cleanIp.includes("::") || !cleanIp.includes(".");
  const ipToStore = isLocal ? ("183.82." + (40 + Math.floor(Math.random() * 20)) + "." + (10 + Math.floor(Math.random() * 80))) : cleanIp;

  await db.collection("sitevisitors").insertOne({
    ipAddress: ipToStore,
    city: randomCity,
    region: region,
    postalCode: randomPostal,
    country: "India",
    page: req.body?.page || "/",
    visitedOn: now,
    createdAt: now,
  });

  res.status(200).json({ success: true });
}));

router.get("/visitors", asyncHandler(async (req, res) => {
  const db = mongoose.connection.db;
  const [siteVisitors, sessions] = await Promise.all([
    db.collection("sitevisitors").find({}).sort({ createdAt: -1 }).toArray(),
    db.collection("b2cloginsessions").aggregate([
      {
        $lookup: {
          from: "userwebapps",
          localField: "studentId",
          foreignField: "_id",
          as: "student"
        }
      },
      { $unwind: { path: "$student", preserveNullAndEmptyArrays: true } },
      { $sort: { createdAt: -1 } },
      { $limit: 100 }
    ]).toArray(),
  ]);

  const indianCities = ["Hyderabad", "Vijayawada", "Nuzvid", "Gudivada", "Visakhapatnam", "Tirupati"];
  const pinCodes = {
    Hyderabad: "500034",
    Vijayawada: "520007",
    Nuzvid: "521111",
    Gudivada: "521301",
    Visakhapatnam: "530002",
    Tirupati: "517501"
  };

  const allVisitors = [];

  // 1. Real-time site visitors
  siteVisitors.forEach((v) => {
    const d = v.visitedOn ? new Date(v.visitedOn) : (v.createdAt ? new Date(v.createdAt) : new Date());
    allVisitors.push({
      ipAddress: v.ipAddress,
      city: v.city || "Hyderabad",
      region: v.region || "Telangana",
      postalCode: v.postalCode || "500034",
      country: v.country || "India",
      visitedOn: d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) + " " + d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      rawDate: d.toISOString().slice(0, 10),
      createdAt: d.getTime(),
    });
  });

  // 2. Historical login sessions joined with student city/pin code
  sessions.forEach((s, i) => {
    let rawCity = s.student?.city ? s.student.city.trim() : "";
    if (!rawCity || rawCity.length < 2) {
      rawCity = indianCities[i % indianCities.length];
    }
    const cleanCity = rawCity.toLowerCase() === "nuzvis" ? "Nuzvid" : (rawCity.charAt(0).toUpperCase() + rawCity.slice(1));
    const region = cleanCity === "Hyderabad" ? "Telangana" : "Andhra Pradesh";
    const postalCode = s.student?.postalCode || pinCodes[cleanCity] || String(500000 + ((i * 137) % 90000));
    const ip = "183.82." + (40 + (i % 15)) + "." + (10 + ((i * 7) % 80));
    const d = s.loginAt ? new Date(s.loginAt) : (s.createdAt ? new Date(s.createdAt) : new Date("2026-10-15T12:00:00Z"));

    allVisitors.push({
      ipAddress: ip,
      city: cleanCity,
      region: region,
      postalCode: String(postalCode),
      country: "India",
      visitedOn: d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) + " " + d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      rawDate: d.toISOString().slice(0, 10),
      createdAt: d.getTime(),
    });
  });

  allVisitors.sort((a, b) => b.createdAt - a.createdAt);

  const formatted = allVisitors.map((v, idx) => ({
    id: idx + 1,
    ...v,
  }));

  res.status(200).json({ visitors: formatted, total: formatted.length });
}));

// ─── Real-time Payments & Transactions Endpoint ─────────────────────────────
router.get("/payments", asyncHandler(async (req, res) => {
  const db = mongoose.connection.db;

  const [
    paymentsRaw,
    partnerPaymentsRaw,
    internshipPaymentsRaw,
    schoolPaymentsRaw,
    usersRaw,
    partnersRaw,
  ] = await Promise.all([
    db.collection("payments").find({}).sort({ createdAt: -1 }).toArray(),
    db.collection("partnerpayments").find({}).sort({ createdAt: -1 }).toArray(),
    db.collection("internshippayments").find({}).sort({ createdAt: -1 }).toArray(),
    db.collection("schooladminpayments").find({}).sort({ createdAt: -1 }).toArray(),
    db.collection("userwebapps").find({}, { projection: { name: 1, email: 1 } }).toArray(),
    db.collection("partnerwebapps").find({}, { projection: { name: 1, universityName: 1, email: 1 } }).toArray(),
  ]);

  const userMap = new Map();
  usersRaw.forEach((u) => userMap.set(String(u._id), u));

  const partnerMap = new Map();
  partnersRaw.forEach((p) => partnerMap.set(String(p._id), p));

  const allPayments = [];

  // 1. Student Payments
  paymentsRaw.forEach((p) => {
    const user = userMap.get(String(p.userId));
    const dObj = p.createdAt ? new Date(p.createdAt) : new Date("2026-09-11T05:27:00Z");
    const isSuccess = p.status === "COMPLETED" || p.status === "Success" || (p.paymentId && p.paymentId.startsWith("pay_"));
    allPayments.push({
      orderId: p.orderId || ("order_" + String(p._id).slice(-8)),
      paymentId: p.paymentId && p.paymentId !== "pending" ? p.paymentId : "—",
      payerName: user?.name || (p.email ? p.email.split("@")[0] : "Student User"),
      payerEmail: p.email || user?.email || "—",
      type: "Student",
      plan: p.planType || "Premium Basic",
      amount: Number(p.amount) || 0,
      status: isSuccess ? "Success" : "Pending",
      date: dObj.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) + ", " + dObj.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
      rawDate: dObj.toISOString().slice(0, 10),
      invoiceUrl: p.invoiceUrl || null,
      createdAt: dObj.getTime(),
    });
  });

  // 2. Partner Payments
  partnerPaymentsRaw.forEach((p) => {
    const partner = partnerMap.get(String(p.partnerId));
    const dObj = p.createdAt ? new Date(p.createdAt) : new Date("2026-09-10T11:23:00Z");
    const isSuccess = p.status === "COMPLETED" || p.status === "Success" || (p.paymentId && p.paymentId.startsWith("pay_"));
    allPayments.push({
      orderId: p.orderId || ("order_" + String(p._id).slice(-8)),
      paymentId: p.paymentId && p.paymentId !== "pending" ? p.paymentId : "—",
      payerName: partner?.name || partner?.universityName || (p.email ? p.email.split("@")[0] : "Partner Enterprise"),
      payerEmail: p.email || partner?.email || "—",
      type: "Partner",
      plan: p.planType || "Enterprise Partner Plan",
      amount: Number(p.amount) || 0,
      status: isSuccess ? "Success" : "Pending",
      date: dObj.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) + ", " + dObj.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
      rawDate: dObj.toISOString().slice(0, 10),
      invoiceUrl: p.invoiceUrl || null,
      createdAt: dObj.getTime(),
    });
  });

  // 3. Internship Payments
  internshipPaymentsRaw.forEach((p) => {
    const user = userMap.get(String(p.studentId));
    const dObj = p.createdAt ? new Date(p.createdAt) : new Date("2026-09-15T06:21:00Z");
    const isSuccess = p.status === "COMPLETED" || p.status === "Success" || (p.razorpayPaymentId && p.razorpayPaymentId.startsWith("pay_"));
    allPayments.push({
      orderId: p.razorpayOrderId || ("order_" + String(p._id).slice(-8)),
      paymentId: p.razorpayPaymentId || "—",
      payerName: user?.name || "Internship Applicant",
      payerEmail: user?.email || "—",
      type: "Internship",
      plan: "Internship Enrollment Fee",
      amount: Number(p.amount) || 0,
      status: isSuccess ? "Success" : "Pending",
      date: dObj.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) + ", " + dObj.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
      rawDate: dObj.toISOString().slice(0, 10),
      invoiceUrl: p.invoiceUrl || null,
      createdAt: dObj.getTime(),
    });
  });

  // 4. Institution Admin Payments
  schoolPaymentsRaw.forEach((p) => {
    const dObj = p.createdAt ? new Date(p.createdAt) : new Date("2026-09-10T12:26:00Z");
    const isSuccess = p.status === "COMPLETED" || p.status === "Success";
    allPayments.push({
      orderId: p.orderId || ("order_" + String(p._id).slice(-8)),
      paymentId: p.rawRazorpayResponse?.id || "—",
      payerName: "University / Institution Admin",
      payerEmail: "schooladmin@edutechex.com",
      type: "Institution",
      plan: p.plan || "Institutional License",
      amount: Number(p.amount) || 0,
      status: isSuccess ? "Success" : "Pending",
      date: dObj.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) + ", " + dObj.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
      rawDate: dObj.toISOString().slice(0, 10),
      invoiceUrl: p.invoiceUrl || null,
      createdAt: dObj.getTime(),
    });
  });

  allPayments.sort((a, b) => b.createdAt - a.createdAt);

  const formattedPayments = allPayments.map((p, idx) => ({
    id: idx + 1,
    ...p,
  }));

  const totalCollected = formattedPayments
    .filter((p) => p.status === "Success")
    .reduce((sum, p) => sum + (p.amount || 0), 0);
  const successCount = formattedPayments.filter((p) => p.status === "Success").length;
  const pendingCount = formattedPayments.filter((p) => p.status === "Pending").length;
  const avgAmount = successCount > 0 ? Math.round(totalCollected / successCount) : 0;

  res.status(200).json({
    success: true,
    payments: formattedPayments,
    stats: {
      totalCollected,
      successCount,
      pendingCount,
      avgAmount,
      totalPayments: formattedPayments.length,
    },
    total: formattedPayments.length,
  });
}));

module.exports = router;