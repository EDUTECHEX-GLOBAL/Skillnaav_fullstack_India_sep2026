require("dotenv").config();

const Anthropic = require("@anthropic-ai/sdk");
const Partner = require("../models/webapp-models/partnerModel");

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const OFF_SCOPE_REPLY =
  "Sorry, I can't assist you with that. I can only assist you with this dashboard.";

async function askMistral(
  userPrompt,
  partnerId,
  featureIndex = [],
  opts = {}
) {
  let partnerContext = "";
  let partnerName = "";

  try {
    if (partnerId) {
      const partner = await Partner.findById(partnerId).lean();

      if (partner) {
        partnerName = partner.name || "";

        partnerContext = `
PARTNER NAME: ${partner.name}
PARTNER EMAIL: ${partner.email}
APPROVAL STATUS: ${
          partner.adminApproved ? "Approved" : "Not Approved"
        }

FLOW CONTEXT:
- Complete your profile first
- Post internships
- Monitor applications
- Access dashboard features after admin approval
`;
      }
    }
  } catch (err) {
    console.warn("Could not fetch partner context", err);
  }

  // Default dashboard features
  const defaultIndex = [
    {
      key: "home",
      label: "Dashboard",
      description: "Overview cards and stats",
    },
    {
      key: "internship-posts",
      label: "Internship Posts",
      description: "Create and manage internships",
    },
    {
      key: "applications",
      label: "Applications",
      description: "Review student applications",
    },
    {
      key: "analytics",
      label: "Analytics",
      description: "Dashboard charts and KPIs",
    },
    {
      key: "offer-templates",
      label: "Offer Templates",
      description: "Manage offer letter templates",
    },
    {
      key: "instructor-management",
      label: "Instructor Management",
      description: "Manage instructors and OTP verification",
    },
    {
      key: "stipend-details",
      label: "Stipend Details",
      description: "Track stipend information",
    },
    {
      key: "support",
      label: "Support",
      description: "Submit support requests",
    },
  ];

  const index =
    Array.isArray(featureIndex) && featureIndex.length
      ? featureIndex
      : defaultIndex;

  // Greeting
  const msgLow = (userPrompt || "").toLowerCase();

  if (/\b(hi|hello|hey|namaste)\b/i.test(msgLow)) {
    const firstName =
      (partnerName || "").trim().split(/\s+/)[0] || "";

    return `${
      firstName ? `Hi ${firstName}!` : "Hi!"
    } 👋 I’m your Skillnaav Partner Assistant. How can I help you with the Partner dashboard today?`;
  }

  // Allowed keywords
  const allowedKeywords = [
    "dashboard",
    "internship",
    "application",
    "analytics",
    "offer",
    "template",
    "instructor",
    "stipend",
    "support",
    "profile",
    "payment",
    "skillnaav",
    "partner",
  ];

  const inScope = allowedKeywords.some((k) =>
    msgLow.includes(k)
  );

  if (!inScope) {
    return OFF_SCOPE_REPLY;
  }

  // Build feature descriptions
  const featuresBullet = index
    .map(
      (it) =>
        `- ${it.label} (${it.key}): ${it.description}`
    )
    .join("\n");

  const SYSTEM_PROMPT = `
You are Skillnaav Partner Assistant.

You ONLY help with:
- Partner dashboard
- Internship management
- Applications
- Analytics
- Offer templates
- Instructor management
- Payments
- Support

Rules:
- Never answer off-topic questions
- Never invent features
- Never provide external links
- Keep responses concise
- Give step-by-step guidance

Available Features:
${featuresBullet}

Partner Context:
${partnerContext}
`;

  try {
    // CLAUDE API CALL
    const message = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
      max_tokens: opts.max_tokens ?? 1024,
      temperature: opts.temperature ?? 0.2,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: userPrompt,
        },
      ],
    });

    const reply =
      message.content?.[0]?.text?.trim() ||
      "No response generated.";

    return reply;
  } catch (err) {
    console.error("Anthropic Error:", err);

    return "AI service is temporarily unavailable.";
  }
}

module.exports = askMistral;