const express = require("express");
const dotenv = require("dotenv");
const path = require("path");
const cors = require("cors");
const axios = require("axios");
const http = require("http");
const { Server } = require("socket.io");
const compression = require("compression");

const connectDB = require("./config/dbConfig");
const { notFound, errorHandler } = require("./middlewares/errorMiddleware");
const { startPartnerCron } = require("./utils/checkPartnerPremiumExpiration");
const { setIO } = require("./utils/socket");
const { maintenanceGuard } = require("./middlewares/platformSettingsMiddleware");

dotenv.config();

const app = express();

// Webhook raw body handlers must be registered before express.json().
app.use("/api/webhooks/paypal", express.raw({ type: "application/json" }));
app.use("/api/webhooks/partner/paypal", express.raw({ type: "application/json" }));

app.use(compression());
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));

const allowedOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:5173",
  process.env.FRONTEND_BASE_URL,
  process.env.FRONTEND_BASE_URL_2,
  process.env.FRONTEND_BASE_URL_3,
].filter(Boolean);

const corsOptions = {
  origin: true, // Allow all origins to bypass CORS issues entirely during development
  credentials: true,
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

console.log("Allowed CORS origins:", allowedOrigins);

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ------------------- Routes -------------------
const instructureRoutes = require("./routes/webapp-routes/InstructureManagementRoutes");
const chatRoute = require("./routes/chat");
const chatbotRoute = require("./routes/chatbot");
const userRoutes = require("./routes/webapp-routes/userRoutes");
const internRoutes = require("./routes/webapp-routes/internshipPostRoutes");
const partnerBinRoutes = require("./routes/webapp-routes/partnerBinRoutes");
const skillnaavRoute = require("./routes/skillnaavRoute");
const partnerRoutes = require("./routes/webapp-routes/partnerRoutes");
const adminRoutes = require("./routes/webapp-routes/adminRoutes");
const adminCertificateRoutes = require("./routes/webapp-routes/adminCertificateRoutes");
const chatRoutes = require("./routes/webapp-routes/ChatRoutes");
const applicationRoutes = require("./routes/webapp-routes/applicationRoutes");
const savedJobRoutes = require("./routes/webapp-routes/SavedJobRoutes");
const personalityRoutes = require("./routes/webapp-routes/PersonalityRoutes");
const paymentRoutes = require("./routes/webapp-routes/paymentRoutes");
const dashboardRoutes = require("./routes/webapp-routes/dashboardRoutes");
const NotificationRoutes = require("./routes/webapp-routes/NotificationRoutes");
const googleRoutes = require("./routes/webapp-routes/googleRoutes");
const offerLetterRoutes = require("./routes/webapp-routes/offerLetterRoutes");
const scheduleRoutes = require("./routes/webapp-routes/scheduleRoutes");
const uploadRoutes = require("./routes/uploadRoutes");
const partnerPaymentRoutes = require("./routes/webapp-routes/partnerPaymentRoutes");
const internshipPaymentRoutes = require("./routes/webapp-routes/internshipPaymentRoutes");
const schoolAdminRoutes = require("./routes/webapp-routes/schoolAdmin/schoolAdminRoutes");
const schoolAdminPaymentRoutes = require("./routes/webapp-routes/schoolAdmin/paymentRoutes");
const schoolAdminLoginSessionRoutes = require("./routes/webapp-routes/schoolAdmin/LoginSessionRoutes");
const stipendDetailsRoutes = require("./routes/webapp-routes/stipendDetailsRoutes");
const customInternshipCertificateRoutes = require("./routes/webapp-routes/customInternshipCertificateRoutes");
const assessmentRoutes = require("./routes/webapp-routes/assessmentRoutes");
const feedback = require("./routes/webapp-routes/feedbackRoutes");
const feedbackSummary = require("./routes/webapp-routes/feedbackSummary");
const locationRoutes = require("./routes/webapp-routes/location.routes");
const userAgeGateConsentRoutes = require("./routes/webapp-routes/UserAgeGateConsentRoutes");
const pipelineRoutes = require("./routes/pipeline/pipelineRoutes");
const l2AssessmentRoutes = require("./routes/pipeline/l2-AssessmentRoutes");
const interviewRoutes = require("./routes/pipeline/interviewRoutes");
const resumeRoutes = require("./routes/webapp-routes/resumeRoutes");
const resumeParserRoutes = require("./routes/webapp-routes/resumeParserRoutes");
const studentProfileRoutes = require("./routes/webapp-routes/StudentprofileRoutes");
const cvRoutes = require("./routes/webapp-routes/cv");
const cityRoutes = require("./routes/webapp-routes/cityRoutes");
const partnerWebhook = require("./routes/webapp-routes/PartnerWebhookRoutes");
const webhookRoutes = require("./routes/webapp-routes/WebhookRoutes");
const adminSubscriptionRoutes = require("./routes/webapp-routes/adminSubscriptionRoutes");
const curriculumRoutes = require("./routes/webapp-routes/schoolAdmin/curriculumRoutes");
const issuedCertificateRoutes = require("./routes/webapp-routes/issuedCertificateRoutes");
const imageProxyRoutes = require("./routes/webapp-routes/imageProxyRoutes");
const attendanceRoutes = require("./routes/webapp-routes/attendanceRoutes");
const mockInterviewRoutes = require("./routes/webapp-routes/mockInterviewRoutes");

// Support routes. Specific paths must be mounted before the generic student route.
const supportRoutes = require("./routes/webapp-routes/studentSupportRoutes");
const adminSupportRoutes = require("./routes/webapp-routes/adminSupportRoutes");
const schoolStudentSupportRoutes = require("./routes/webapp-routes/schoolStudentSupportRoutes");
const schoolAdminSupportRoutes = require("./routes/webapp-routes/schoolAdminSupportRoutes");
const adminPartnerSupportRoutes = require("./routes/webapp-routes/AdminPartnerSupportRoutes");
const partnerSupportRoutes = require("./routes/webapp-routes/partnerSupportRoutes");
const adminSchoolSupportRoutes = require("./routes/webapp-routes/adminSchoolSupportRoutes");
const superAdminSettingsRoutes = require("./routes/webapp-routes/superAdminSettingsRoutes");

// ------------------- Use Routes -------------------
app.use("/api", maintenanceGuard);
app.use("/api/instructors", instructureRoutes);
app.use("/api", chatRoute);
app.use("/api/chatbot", chatbotRoute);
app.use("/api/upload", uploadRoutes);
app.use("/api/users", userRoutes);
app.use("/api/interns", internRoutes);
app.use("/api/partner-bin", partnerBinRoutes);
app.use("/api/skillnaav", skillnaavRoute);
app.use("/api/contact", skillnaavRoute);
app.use("/api/partners", partnerRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/admin/subscriptions", adminSubscriptionRoutes);
app.use("/api/admin/certificates", adminCertificateRoutes);
app.use("/api/admin/settings", superAdminSettingsRoutes);
app.use("/api/chats", chatRoutes);
app.use("/api/applications", applicationRoutes);
app.use("/api/savedJobs", savedJobRoutes);
app.use("/api/personality", personalityRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/google", googleRoutes);
app.use("/api/offer-letters", offerLetterRoutes);
app.use("/api/notifications", NotificationRoutes);
app.use("/api/schedule", scheduleRoutes);
app.use("/api/partner/payments", partnerPaymentRoutes);
app.use("/api/internship/payments", internshipPaymentRoutes);
app.use("/api/school-admin", schoolAdminRoutes);
app.use("/api/school-admin/payments", schoolAdminPaymentRoutes);
app.use("/api/sessions", schoolAdminLoginSessionRoutes);
app.use("/api/internship/stipend-details", stipendDetailsRoutes);
app.use("/api/custom-internship-certificates", customInternshipCertificateRoutes);
app.use("/api/assessments", assessmentRoutes);
app.use("/api/feedback", feedback);
app.use("/api/feedback", feedbackSummary);
app.use("/api/user-age-gate-consent", userAgeGateConsentRoutes);
app.use("/api/pipeline", pipelineRoutes);
app.use("/api/l2-assessments", l2AssessmentRoutes);
app.use("/api/interviews", interviewRoutes);
app.use("/api/resumes", resumeRoutes);
app.use("/api/resume", resumeParserRoutes);
app.use("/api/student-profile", studentProfileRoutes);
app.use("/api/cv", cvRoutes);
app.use("/api/ai", require("./routes/webapp-routes/Airoutes"));
app.use("/api/cities", cityRoutes);
app.use("/api/webhooks/partner", partnerWebhook);
app.use("/api/webhooks", webhookRoutes);
app.use("/api/curriculum", curriculumRoutes);
app.use("/api/locations", locationRoutes);
app.use("/api/certificates", issuedCertificateRoutes);
app.use("/api/image-proxy", imageProxyRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/mock-interviews", mockInterviewRoutes);

app.use("/api/support/school-admin", schoolAdminSupportRoutes);
app.use("/api/support/school-students", schoolStudentSupportRoutes);
app.use("/api/support/admin/school-admin", adminSchoolSupportRoutes);
app.use("/api/support/admin", adminSupportRoutes);
app.use("/api/support/partner/admin", adminPartnerSupportRoutes);
app.use("/api/support/partner", partnerSupportRoutes);
app.use("/api/support", supportRoutes);

// ------------------- FastAPI Proxy -------------------
app.post("/analyze-skills", async (req, res) => {
  try {
    const resp = await axios.post(`${process.env.FASTAPI_BASE_URL}/analyze-skills`, req.body, {
      timeout: 30000,
    });
    res.json(resp.data);
  } catch (error) {
    console.error("Error from FastAPI:", error.response?.data || error.message);
    res.status(502).json({ error: "Upstream service error" });
  }
});

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

// ------------------- Production Static -------------------
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "client/build")));
  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "client/build/index.html"));
  });
}

// ------------------- Error Handling -------------------
app.use(notFound);
app.use(errorHandler);

// ------------------- Start Server with Socket.IO -------------------
const PORT = process.env.PORT || 5000;
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: true,
    credentials: true,
  },
});

setIO(io);
app.set("io", io);

io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  socket.on("joinPartnerRoom", ({ partnerId } = {}) => {
    if (partnerId) socket.join(`partner_${partnerId}`);
  });

  socket.on("join_partner_room", (payload) => {
    const partnerId =
      typeof payload === "string" ? payload : payload?.partnerId || payload?.id || null;
    if (partnerId) socket.join(`partner_${partnerId}`);
  });

  socket.on("joinAdminRoom", () => {
    socket.join("admin_notifications");
    socket.join("admin_room");
  });

  socket.on("join_admin_room", () => {
    socket.join("admin_room");
  });

  socket.on("join_school_admin_room", (payload) => {
    const schoolRaw =
      typeof payload === "string" ? payload : payload?.school || payload?.schoolName || "";
    if (!schoolRaw) return;
    const room = `school_admin_${String(schoolRaw).trim().replace(/\s+/g, "_")}`;
    socket.join(room);
  });

  socket.on("join_user_room", (payload) => {
    const userId = typeof payload === "string" ? payload : payload?.userId || payload?.id || null;
    if (userId) socket.join(`user_${userId}`);
  });

  socket.on("join_ticket", (ticketId) => {
    if (ticketId) socket.join(String(ticketId));
  });

  socket.on("leave_ticket", (ticketId) => {
    if (ticketId) socket.leave(String(ticketId));
  });

  socket.on("send_message", ({ ticketId, message, school } = {}) => {
    if (!ticketId || !message) return;
    io.to(String(ticketId)).emit("new_message", { ticketId, message });
    io.to("admin_room").emit("new_ticket_message", { ticketId, message });
    if (school) {
      const safeSchool = String(school).trim().replace(/\s+/g, "_");
      io.to(`school_admin_${safeSchool}`).emit("new_ticket_message", { ticketId, message });
    }
  });

  socket.on("joinChatRoom", ({ internshipId } = {}) => {
    if (internshipId) socket.join(`chat_${internshipId}`);
  });

  socket.on("leaveChatRoom", ({ internshipId } = {}) => {
    if (internshipId) socket.leave(`chat_${internshipId}`);
  });

  socket.on("joinRoom", ({ internshipId } = {}) => {
    if (internshipId) socket.join(internshipId);
  });

  socket.on("sendMessage", async (msg = {}) => {
    try {
      const Chat = require("./models/webapp-models/ChatModel");
      const chat = await Chat.create({
        sender: msg.senderId,
        receiver: msg.receiverId,
        internship: msg.internshipId,
        message: msg.message,
      });
      if (msg.internshipId) io.to(msg.internshipId).emit("receiveMessage", chat);
    } catch (err) {
      console.error("Chat save error:", err.message);
    }
  });

  socket.on("disconnect", () => {
    console.log("Socket disconnected:", socket.id);
  });
});

// ------------------- Connect DB, Start Crons, Listen -------------------
connectDB()
  .then(() => {
    console.log("MongoDB connected");
    startPartnerCron({ io, cronExpr: "0 * * * *", timezone: "UTC" });
    require("./services/attendanceCron");

    server.listen(PORT, "0.0.0.0", () => {
      console.log(`Server + Socket.IO running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Failed to connect to MongoDB:", err);
    process.exit(1);
  });
