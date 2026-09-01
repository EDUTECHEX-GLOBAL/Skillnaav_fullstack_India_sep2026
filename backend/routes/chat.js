const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const askClaude = require("../services/bedrockChat"); // ← replaces bedrockChat
const {
  listCompanies,
  listTypes,
  listModes,
  searchInternships,
} = require("../services/ragHelpers");

const Userwebapp = require("../models/webapp-models/userModel");

// Regex patterns
const GREET_RX = /^(hi|hello|hey|howdy|good\s*(morning|afternoon|evening)|how\s*are\s*you)\b/i;
const ALLOWED_RX = /(skill\s*naav|internship|career|resume|cv|job|schedule|partner)/i;

// POST /api/career-chat
router.post("/career-chat", async (req, res) => {
  const { message = "" } = req.body;
  const token = req.headers.authorization?.split(" ")[1];

  // 1️⃣ Authenticate user via token
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  let userId;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    userId = decoded.id;
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }

  const user = await Userwebapp.findById(userId);
  if (!user) return res.status(404).json({ error: "User not found" });

  const isPremium = user.isPremium && new Date(user.premiumExpiration) > new Date();

  // 2️⃣ Freemium limit check
  if (!isPremium && (user.careerChatUsage ?? 0) >= 10) {
    return res.json({
      reply: `⚠️ You've used all 10 free replies. Upgrade to Premium for unlimited chat.`,
    });
  }

  // 3️⃣ Greetings
  if (GREET_RX.test(message.trim())) {
    return res.json({ reply: "Hello! 👋 How can I help you?" });
  }

  // 4️⃣ Off-topic
  if (!ALLOWED_RX.test(message)) {
    return res.json({ reply: "I'm sorry, I can't assist you with that." });
  }

  // 5️⃣ Dynamic context (RAG)
  let ctx = "";

  if (/(which|what).*companies?.*internship|list.*companies/i.test(message)) {
    const companies = await listCompanies();
    if (companies.length) {
      ctx += `\n\n**COMPANIES:**\n${companies.map((c) => "• " + c).join("\n")}\n`;
    }
  }

  if (/(which|what).*types?.*internship|paid|free|stipend/i.test(message)) {
    const types = await listTypes();
    if (types.length) {
      ctx += `\n\n**TYPES:**\n${types.map((t) => "• " + t).join("\n")}\n`;
    }
  }

  if (/(online|offline|hybrid).*internship/i.test(message)) {
    const modes = await listModes();
    if (modes.length) {
      ctx += `\n\n**MODES:**\n${modes.map((m) => "• " + m).join("\n")}\n`;
    }
  }

  // 🔹 General keyword search for internships (like "ai internship", specific company, etc)
  const internships = await searchInternships(message);
  if (internships.length > 0) {
    ctx += `\n\n**RELEVANT INTERNSHIPS (Use this data to answer user's questions about roles, company names, skills, and descriptions):**\n`;
    internships.forEach((job, i) => {
      ctx += `\n[Internship ${i + 1}]\n`;
      ctx += `- Job Title: ${job.jobTitle}\n`;
      ctx += `- Company Name: ${job.companyName}\n`;
      ctx += `- Required Skills/Qualifications: ${job.qualifications?.join(", ") || "None specified"}\n`;
      ctx += `- Description: ${job.jobDescription}\n`;
      ctx += `- Location: ${job.location || job.city}\n`;
      ctx += `- Type: ${job.internshipType}, Mode: ${job.internshipMode}\n`;
    });
  }

  const promptForAI = ctx ? `Context information:\n${ctx}\n\nUser: ${message}` : message;

  // 6️⃣ Forward to Claude
  try {
    const reply = await askClaude(promptForAI);

    // 7️⃣ Update usage only for freemium users
    if (!isPremium) {
      user.careerChatUsage = (user.careerChatUsage ?? 0) + 1;
      await user.save();
    }

    return res.json({ reply });
  } catch (err) {
    console.error("Anthropic error:", err);
    return res.status(500).json({ error: "Something went wrong with the AI service." });
  }
});

// POST /api/heygen-token
router.post("/heygen-token", async (req, res) => {
  try {
    const apiKey = process.env.LIVEAVATAR_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "HeyGen API key is missing from environment variables." });
    }

    const fetch = (await import('node-fetch')).default || require('node-fetch'); // Using dynamic import for node-fetch or native fetch depending on Node version
    // If Node 18+, fetch is global. But to be safe, I'll just use axios which is already in the project.
    
    // Oh, I see axios is required in server.js but not here. I will require it.
    const axios = require("axios");

    const response = await axios.post(
      "https://api.liveavatar.com/v1/sessions/token",
      {
        mode: "FULL",
        is_sandbox: true,
        avatar_id: "65f9e3c9-d48b-4118-b73a-4ae2e3cbb8f0", // Public Sandbox Avatar (June HR)
        avatar_persona: {
          voice_id: "62bbb4b2-bb26-4727-bc87-cfb2bd4e0cc8"
        }
      },
      {
        headers: {
          "X-API-KEY": apiKey,
        },
      }
    );

    res.json({ token: response.data.data.session_token });
  } catch (error) {
    console.error("Error generating HeyGen token:", error.response?.data || error.message);
    res.status(500).json({ error: "Failed to generate token" });
  }
});

module.exports = router;