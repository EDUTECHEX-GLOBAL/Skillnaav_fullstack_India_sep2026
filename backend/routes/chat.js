const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const axios = require("axios");
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
const ALLOWED_RX = /(edutechex|internship|career|resume|cv|job|schedule|partner|premium|apply|application|platform|upgrade|stipend|role|skill|company|companies)/i;

function sanitizeVoiceReply(text) {
  if (!text) return "";
  return text
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/[\uFE00-\uFE0F]/g, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/_{1,2}(.*?)_{1,2}/g, "$1")
    .replace(/#{1,6}\s+/g, "")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .replace(/`{1,3}(.*?)`{1,3}/g, "$1")
    .replace(/^[•\-\*]\s+/gm, "")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// POST /api/career-chat
router.post("/career-chat", async (req, res) => {
  const { message = "", voice = false } = req.body;
  const token = req.headers.authorization?.split(" ")[1];

  let user = null;
  let isPremium = false;

  // 1️⃣ Optional authentication via token (guest fallback supported)
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded && decoded.id) {
        user = await Userwebapp.findById(decoded.id);
        if (user) {
          isPremium = user.isPremium && new Date(user.premiumExpiration) > new Date();
        }
      }
    } catch {
      // Guest user fallback
    }
  }

  // 2️⃣ Freemium limit check
  if (user && !isPremium && (user.careerChatUsage ?? 0) >= 15) {
    if (voice) {
      return res.json({
        reply: "You have used all your free replies. Please upgrade to Premium for unlimited chat.",
        gesture: "open",
      });
    }
    return res.json({
      reply: `⚠️ You've used all free replies. Upgrade to Premium for unlimited chat.`,
      gesture: "open",
    });
  }

  // 3️⃣ Greetings (handled warmly with prompt or quick reply)
  if (GREET_RX.test(message.trim()) && message.trim().split(" ").length <= 2) {
    if (voice) {
      return res.json({
        reply: "Hello! Welcome to Edutechex. How can I help you with your career or internships today?",
        gesture: "wave",
      });
    }
    return res.json({
      reply: "Hello! 👋 Welcome to Edutechex. How can I help you with your career or internships today?",
      gesture: "wave",
    });
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

  // 6️⃣ Forward to Claude with resilient fallback
  let appendSystem = "";
  if (voice) {
    appendSystem = "This reply will be spoken aloud. Use plain spoken English only. No emojis, no markdown, no bullet points, no URLs, no asterisks. Maximum 3 short sentences. Say numbers in words. Begin the reply with one gesture tag in square brackets, exactly one of [wave] [point] [open] [count] [thumbs] [thanks] [none], chosen to match the content.";
  }

  try {
    const rawReply = await askClaude(promptForAI, { appendSystem });

    let gesture = "none";
    let reply = rawReply;

    // Parse and strip gesture tag: /^\s*\[(wave|point|open|count|thumbs|thanks|none)\]\s*/i
    const tagMatch = reply.match(/^\s*\[(wave|point|open|count|thumbs|thanks|none)\]\s*/i);
    if (tagMatch) {
      gesture = tagMatch[1].toLowerCase();
      reply = reply.replace(/^\s*\[(wave|point|open|count|thumbs|thanks|none)\]\s*/i, "").trim();
    }

    if (voice) {
      reply = sanitizeVoiceReply(reply);
      if (gesture === "none") {
        const lower = reply.toLowerCase();
        if (/hi|hello|welcome/i.test(lower)) gesture = "wave";
        else if (/click|apply|button|dashboard|tap/i.test(lower)) gesture = "point";
        else if (/premium|unlimited|benefit|offer|opportunit/i.test(lower)) gesture = "open";
        else if (/first|second|step|1\.|2\./i.test(lower)) gesture = "count";
        else if (/congrat|great|good luck|well done/i.test(lower)) gesture = "thumbs";
        else if (/thank|sorry|pleasure/i.test(lower)) gesture = "thanks";
      }
    }

    // 7️⃣ Update usage only for freemium users
    if (user && !isPremium) {
      user.careerChatUsage = (user.careerChatUsage ?? 0) + 1;
      await user.save();
    }

    return res.json({ reply, gesture });
  } catch (err) {
    console.error("AI service error / connection notice:", err.message);

    // Intelligent, high-quality Edutechex Career Assistant Fallback
    const lower = (message || "").toLowerCase();
    let fallbackReply = "Welcome to Edutechex! We connect students with verified high-tech internships, skill certifications, and career acceleration.";
    let fallbackGesture = "wave";

    if (lower.includes("internship") || lower.includes("job") || lower.includes("apply") || lower.includes("role") || lower.includes("opportunity")) {
      fallbackReply = "You can explore all available tech internships directly from your Edutechex dashboard. Click on any internship card to review requirements and click Apply to submit your application!";
      fallbackGesture = "point";
    } else if (lower.includes("company") || lower.includes("companies")) {
      fallbackReply = "Edutechex partners with top organizations across Artificial Intelligence, Robotics, Biotech, Climate Tech, and Cloud Computing offering verified internships.";
      fallbackGesture = "open";
    } else if (lower.includes("premium") || lower.includes("upgrade") || lower.includes("cost") || lower.includes("fee") || lower.includes("price")) {
      fallbackReply = "Edutechex Premium unlocks unlimited internship applications, verified profile badges, priority applicant reviews, and personalized mentor support.";
      fallbackGesture = "open";
    } else if (lower.includes("resume") || lower.includes("cv")) {
      fallbackReply = "Edutechex provides an automated CV and profile builder with AI skills matching to help your profile stand out to recruiters.";
      fallbackGesture = "point";
    } else if (lower.includes("who are you") || lower.includes("what is edutechex") || lower.includes("help")) {
      fallbackReply = "I am the Edutechex AI Career Assistant. I am here to help you discover internships, build your CV, and accelerate your career. How can I help you today?";
      fallbackGesture = "wave";
    } else if (lower.includes("thank") || lower.includes("thanks")) {
      fallbackReply = "You are very welcome! Feel free to ask anytime if you need help finding internships or advancing your career on Edutechex.";
      fallbackGesture = "thanks";
    }

    if (voice) {
      fallbackReply = sanitizeVoiceReply(fallbackReply);
    }

    return res.json({ reply: fallbackReply, gesture: fallbackGesture });
  }
});

const OpenAI = require("openai");

const ALLOWED_TTS_VOICES = new Set(["alloy", "ash", "coral", "echo", "fable", "onyx", "nova", "sage", "shimmer"]);
let _openaiClient = null;
function getOpenAIClient() {
  if (!_openaiClient && process.env.OPENAI_API_KEY) {
    _openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openaiClient;
}

function normalizeTextForTTS(text) {
  return sanitizeVoiceReply(text)
    .replace(/\bEdutechex\b/gi, "Edu tech ex")
    .replace(/\bAI\b/g, "A I")
    .replace(/\bCVs\b/g, "C Vs")
    .replace(/\bCV\b/g, "C V")
    .replace(/\bB2B\b/gi, "B to B")
    .replace(/\bB2C\b/gi, "B to C")
    .replace(/&/g, " and ")
    .replace(/₹\s*(\d+)/g, "$1 rupees")
    .replace(/₹/g, " rupees ")
    .replace(/\s+/g, " ")
    .trim();
}

// POST /api/tts (Neural server-side TTS returning MP3 for Web Audio API + real-time viseme sync)
router.post("/tts", async (req, res) => {
  const { text = "", voice = "onyx", speed = 1.0 } = req.body || {};
  const cleanText = normalizeTextForTTS(text).slice(0, 4096);
  if (!cleanText) {
    return res.status(400).json({ error: "Text is required for TTS" });
  }

  const client = getOpenAIClient();
  if (!client) {
    return res.status(503).json({ error: "Server TTS key not configured", fallback: true });
  }

  const chosenVoice = ALLOWED_TTS_VOICES.has(String(voice).toLowerCase())
    ? String(voice).toLowerCase()
    : "onyx";
  const clampedSpeed = Math.min(1.5, Math.max(0.7, Number(speed) || 1.0));

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    const mp3Response = await client.audio.speech.create(
      {
        model: "tts-1",
        voice: chosenVoice,
        input: cleanText,
        speed: clampedSpeed,
        response_format: "mp3",
      },
      { signal: controller.signal }
    );
    clearTimeout(timeoutId);

    const arrayBuffer = await mp3Response.arrayBuffer();
    const audioBuffer = Buffer.from(arrayBuffer);

    res.set({
      "Content-Type": "audio/mpeg",
      "Content-Length": audioBuffer.length,
      "Cache-Control": "no-store",
    });
    return res.send(audioBuffer);
  } catch (err) {
    clearTimeout(timeoutId);
    console.warn("[TTS] OpenAI synthesis failed, signaling client fallback:", err?.message || err);
    return res.status(503).json({ error: "Server TTS temporarily unavailable", fallback: true });
  }
});

// POST /api/heygen-token (Free local avatar mode)
router.post("/heygen-token", async (req, res) => {
  res.json({ free: true, message: "Free local avatar active" });
});

module.exports = router;