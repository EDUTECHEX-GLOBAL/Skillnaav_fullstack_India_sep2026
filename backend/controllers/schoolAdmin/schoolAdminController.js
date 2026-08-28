const asyncHandler = require("express-async-handler");
const SchoolAdmin = require("../../models/webapp-models/schoolAdmin/SchoolAdminModel");
const generateToken = require("../../utils/generateToken");
const jwt = require("jsonwebtoken");
const csv = require("csv-parser");
const bcrypt = require("bcryptjs");
const { Parser } = require("json2csv");
const Userwebapp = require("../../models/webapp-models/userModel");
const Partnerwebapp = require("../../models/webapp-models/partnerModel");
const SchoolAdminOTPVerification = require("../../models/webapp-models/schoolAdmin/SchoolAdminOTPVerification");
const Application = require("../../models/webapp-models/applicationModel");
const { uploadFile } = require("../../utils/multer");
const notifyUser = require("../../utils/notifyUser");
const { generateOtpEmailHtml } = require("../../utils/otpTemplate");
const LoginSession = require("../../models/webapp-models/schoolAdmin/LoginSessionModel");
const { Readable } = require("stream");
const csvParser = require("csv-parser");
const { OAuth2Client } = require("google-auth-library");
const client = new OAuth2Client(process.env.GOOGLE_SIGNUP_CLIENT_ID);

const normalizeSchoolAdminPlanForClient = (plan) =>
  plan === "Premium Plan" ? "Premium Plus Plan" : plan || "Free Plan";

// Utility to generate OTP
const generateOTP = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

// Register School Admin
const registerSchoolAdmin = asyncHandler(async (req, res) => {
  const {
    schoolName,
    email,
    password,
    affiliation,
    address,
    city,
    province,
    postalCode,
    country,
    website,
    contactPerson,
    contactEmail,
    contactPhone,
    bio,
    schoolType,
    schoolNumber,
    languageOfInstruction,
  } = req.body;

  const verificationDoc = req.file
    ? req.file.location
    : req.body.verificationDoc;

  const existingAdmin = await SchoolAdmin.findOne({ email });
  const existingUser = await Userwebapp.findOne({ email });
  const existingPartner = await Partnerwebapp.findOne({ email });
  if (existingAdmin || existingUser || existingPartner) {
    res.status(400);
    throw new Error("Admin already registered.");
  }

  const admin = await SchoolAdmin.create({
    schoolName,
    email,
    password,
    profile: {
      affiliation,
      address,
      city,
      province,
      postalCode,
      country,
      website,
      contactPerson,
      contactEmail,
      contactPhone,
      bio,
      schoolType,
      schoolNumber,
      languageOfInstruction,
      verificationDoc,
    },
  });

  if (admin) {
    res.status(201).json({
      _id: admin._id,
      schoolName: admin.schoolName,
      email: admin.email,
      isApproved: admin.isApproved,
    });
  } else {
    res.status(400);
    throw new Error("Failed to register.");
  }
});

// Login School Admin
const loginSchoolAdmin = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const school = await SchoolAdmin.findOne({ email });

  if (!school) {
    res.status(401);
    throw new Error("Invalid email or password");
  }

  const isMatch = await school.matchPassword(password);
  if (!isMatch) {
    res.status(401);
    throw new Error("Invalid email or password");
  }

  const token = generateToken(school._id);

  res.status(200).json({
    _id: school._id,
    schoolName: school.schoolName,
    affiliation: school.profile?.affiliation,
    address: school.profile?.address,
    city: school.profile?.city,
    province: school.profile?.province,
    postalCode: school.profile?.postalCode,
    country: school.profile?.country,
    website: school.profile?.website,
    contactPerson: school.profile?.contactPerson,
    contactEmail: school.profile?.contactEmail,
    contactPhone: school.profile?.contactPhone,
    isApproved: school.isApproved,
    plan: normalizeSchoolAdminPlanForClient(school.plan),
    subscriptionStatus: school.subscriptionStatus,
    creditsAvailable: school.creditsAvailable,
    token,
  });
});

const getAllSchoolAdmins = asyncHandler(async (req, res) => {
  const Payment = require("../../models/webapp-models/schoolAdmin/SchoolAdminPayment");

  const getCreditsForPlan = (plan) => {
    switch (plan) {
      case "Standard Plan":
        return 500;
      case "Premium Plan":
        return 2000;
      default:
        return 0;
    }
  };

  const admins = await SchoolAdmin.find({}, "-password").lean();

  if (!admins || admins.length === 0) {
    res.status(404);
    throw new Error("No school admins found.");
  }

  // Fetch all payments grouped by schoolAdmin ID
  const payments = await Payment.find({ status: "COMPLETED" }).lean();
  const paymentsByAdmin = {};
  payments.forEach((p) => {
    const id = p.schoolAdmin.toString();
    if (!paymentsByAdmin[id]) paymentsByAdmin[id] = [];
    paymentsByAdmin[id].push(p);
  });

  const enriched = admins.map((admin) => {
    const adminPayments = paymentsByAdmin[admin._id.toString()] || [];
    const purchasedCredits = adminPayments.reduce(
      (sum, p) => sum + getCreditsForPlan(p.plan),
      0,
    );
    // Total received = 50 free credits at registration + all purchased credits
    const creditsTotalReceived = 50 + purchasedCredits;
    // Credits used = total received - what's left
    const creditsAvailable = admin.creditsAvailable || 0;
    const creditsUsed = Math.max(0, creditsTotalReceived - creditsAvailable);

    return {
      ...admin,
      creditsTotalReceived,
      creditsUsed,
      plan:
        admin.plan === "Premium Plan"
          ? "Premium Plan"
          : admin.plan || "Free Plan",
    };
  });

  res.status(200).json(enriched);
});

// Approve a school admin
const approveSchoolAdmin = asyncHandler(async (req, res) => {
  const { adminId } = req.params;
  const admin = await SchoolAdmin.findById(adminId);
  if (!admin) {
    res.status(404);
    throw new Error("School Admin not found.");
  }
  admin.isApproved = true;
  await admin.save();
  await notifyUser(
    admin.email,
    "Your Skillnaav School Admin account has been approved!",
    `<p>Congratulations! Your Skillnaav admin account for <strong>${admin.schoolName}</strong> has been approved by our team.</p>`,
  );
  res.status(200).json({ message: "School Admin approved successfully." });
});

// Reject a school admin
const rejectSchoolAdmin = asyncHandler(async (req, res) => {
  const { adminId } = req.params;
  const admin = await SchoolAdmin.findById(adminId);
  if (!admin) {
    res.status(404);
    throw new Error("School Admin not found.");
  }
  admin.isApproved = false;
  admin.status = "Rejected";
  await admin.save();
  await notifyUser(
    admin.email,
    "Your Skillnaav School Admin account has been rejected.",
    `<p>We're sorry to inform you that your admin registration for <strong>${admin.schoolName}</strong> has been rejected. If you believe this is a mistake, please contact support.</p>`,
  );
  res.status(200).json({ message: "School Admin rejected successfully." });
});

const getSchoolAdminProfile = asyncHandler(async (req, res) => {
  const admin = req.schoolAdmin;
  if (!admin) {
    res.status(404);
    throw new Error("School admin not found");
  }
  const profile = admin.profile || {};
  res.status(200).json({
    _id: admin._id,
    schoolName: admin.schoolName,
    email: admin.email,
    isApproved: admin.isApproved,
    plan: normalizeSchoolAdminPlanForClient(admin.plan),
    subscriptionStatus: admin.subscriptionStatus,
    creditsAvailable: admin.creditsAvailable,
    affiliation: profile.affiliation || "",
    address: profile.address || "",
    city: profile.city || "",
    province: profile.province || "",
    postalCode: profile.postalCode || "",
    country: profile.country || "",
    website: profile.website || "",
    contactPerson: profile.contactPerson || "",
    contactEmail: profile.contactEmail || "",
    contactPhone: profile.contactPhone || "",
    schoolType: profile.schoolType || "",
    schoolNumber: profile.schoolNumber || "",
    languageOfInstruction: profile.languageOfInstruction || "",
    verificationDoc: profile.verificationDoc || "",
  });
});

const updateSchoolAdminProfile = asyncHandler(async (req, res) => {
  const admin = await SchoolAdmin.findById(req.schoolAdmin._id);
  if (!admin) {
    res.status(404);
    throw new Error("Admin not found");
  }
  if (req.body.schoolName) admin.schoolName = req.body.schoolName;
  if (!admin.profile) admin.profile = {};
  const profileFields = [
    "affiliation",
    "address",
    "city",
    "province",
    "postalCode",
    "country",
    "website",
    "contactPerson",
    "contactEmail",
    "contactPhone",
    "bio",
    "schoolType",
    "schoolNumber",
    "languageOfInstruction",
    "verificationDoc",
  ];
  profileFields.forEach((field) => {
    if (req.body[field] !== undefined) {
      admin.profile[field] = req.body[field];
    }
  });

  if (req.file && req.file.location) {
    admin.profile.verificationDoc = req.file.location;
  }

  const updated = await admin.save();
  res.status(200).json({
    message: "Profile updated successfully",
    admin: {
      _id: updated._id,
      schoolName: updated.schoolName,
      email: updated.email,
      isApproved: updated.isApproved,
      profile: updated.profile,
    },
  });
});

const uploadStudentsFromCSV = async (req, res) => {
  console.log("ðŸ“ [controller] req.file:", req.file);
  if (!req.file || !req.file.buffer) {
    return res.status(400).json({ message: "CSV file is missing" });
  }

  const stream = Readable.from(req.file.buffer);
  const rows = [];

  stream
    .pipe(csvParser({ mapHeaders: ({ header }) => header.trim() }))
    .on("data", (row) => rows.push(row))
    .on("end", async () => {
      try {
        const schoolAdmin = req.schoolAdmin;

        if (!schoolAdmin || !schoolAdmin.isApproved) {
          return res.status(403).json({ message: "School admin not approved" });
        }

        if (!schoolAdmin.plan) {
          return res.status(403).json({
            message:
              "No active plan found. Please activate a subscription plan.",
          });
        }

        const validRows = [];
        for (const row of rows) {
          const name = row["Full Name"]?.trim() || "";
          const email = row["Email Address"]?.trim() || "";
          const universityName = row["School Name"]?.trim() || "";
          const educationLevel = row["Grade"]?.trim() || "";
          const fieldOfStudy = row["Stream/Curriculum"]?.trim() || "";
          const desiredField = row["Field of Internship"]?.trim() || "";

          if (
            !name ||
            !email ||
            !universityName ||
            !educationLevel ||
            !fieldOfStudy ||
            !desiredField
          ) {
            console.warn("âš ï¸ Skipping incomplete row:", row);
            continue;
          }

          const exists = await Userwebapp.findOne({ email });
          if (!exists) {
            validRows.push({
              name,
              email,
              universityName,
              educationLevel,
              fieldOfStudy,
              desiredField,
            });
          }
        }

        console.log(`ðŸ§¾ Valid students to create: ${validRows.length}`);
        if (schoolAdmin.creditsAvailable < validRows.length) {
          return res.status(400).json({
            message: `Insufficient credits. You have ${schoolAdmin.creditsAvailable}, need ${validRows.length}.`,
          });
        }

        const createdStudents = [];
        const emailPromises = [];

        for (const studentData of validRows) {
          const plainPassword = Math.random().toString(36).slice(-8);

          const student = new Userwebapp({
            name: studentData.name,
            email: studentData.email,
            password: plainPassword,
            universityName: studentData.universityName,
            educationLevel: studentData.educationLevel,
            fieldOfStudy: studentData.fieldOfStudy,
            desiredField: studentData.desiredField,
            dob: "Not Provided",
            linkedin: "https://linkedin.com/in/placeholder",
            profileImage: "default.png",
            adminApproved: true,
            isActive: true,
            isPremium: false,
            schoolAdmin: schoolAdmin._id,
            // âœ… FIX: store schoolName on student so ticket routing works at login
            schoolName: schoolAdmin.schoolName,
            school: schoolAdmin.schoolName,
          });

          await student.save();

          createdStudents.push({
            name: student.name,
            email: student.email,
            password: plainPassword,
          });

          emailPromises.push(
            notifyUser(
              student.email,
              "Welcome to SkillNaav â€“ Your Login Credentials",
              `<p>Hello ${student.name},</p>
              <p>Welcome to SkillNaav! Here are your login credentials:</p>
              <ul>
                <li><strong>Email:</strong> ${student.email}</li>
                <li><strong>Password:</strong> ${plainPassword}</li>
              </ul>
              <p>You can log in at <a href="https://www.skillnaav.com/user/login">https://www.skillnaav.com/user/login</a>.</p>
              <p>We recommend changing your password after the first login.</p>`,
            ),
          );
        }

        await Promise.all(emailPromises);

        // Deduct credits
        schoolAdmin.creditsAvailable -= createdStudents.length;
        // âœ… Track how many credits have been used in total
        schoolAdmin.creditsUsed =
          (schoolAdmin.creditsUsed || 0) + createdStudents.length;
        await schoolAdmin.save();

        // Generate credentials CSV
        let fileUrl = null;
        let csvBuffer = null;
        if (createdStudents.length > 0) {
          try {
            const parser = new Parser({
              fields: ["name", "email", "password"],
            });
            const csvData = parser.parse(createdStudents);
            csvBuffer = Buffer.from(csvData, "utf-8");

            const fileName = `student-credentials/${Date.now()}-${Math.floor(Math.random() * 10000)}.csv`;
            const bucketName = process.env.AWS_CSV_BUCKET;
            if (!bucketName)
              throw new Error("AWS_CSV_BUCKET is not set in environment");

            fileUrl = await uploadFile({
              Bucket: bucketName,
              Key: fileName,
              Body: csvBuffer,
              ContentType: "text/csv",
            });

            console.log("✅ Uploaded CSV to S3:", fileUrl);
          } catch (err) {
            console.error("⚠️ S3 Upload failed:", err.message || err);
          }

          // Email admin with CSV
          try {
            await notifyUser(
              schoolAdmin.email,
              "Student Credentials CSV – SkillNaav",
              `Attached is the student credentials CSV for ${createdStudents.length} newly created students.`,
              csvBuffer
                ? [
                    {
                      filename: "student-credentials.csv",
                      content: csvBuffer,
                      contentType: "text/csv",
                    },
                  ]
                : [],
            );
          } catch (err) {
            console.error(
              "❌ Failed to send email to admin:",
              err.message || err,
            );
          }
        }

        const skipped = rows.length - validRows.length;
        let message = `${createdStudents.length} students created successfully.`;
        let statusIcon = "✅";
        if (createdStudents.length === 0 && skipped > 0) {
          message = `All ${skipped} students already exist. No new students created.`;
          statusIcon = "⚠️";
        } else if (skipped > 0) {
          message = `${createdStudents.length} students created successfully. ${skipped} students already exist and were skipped.`;
        }

        return res.status(200).json({
          message,
          statusIcon,
          skipped,
          generated: createdStudents.length,
          fileUrl,
          students: createdStudents,
        });
      } catch (err) {
        console.error("â Œ Server error during CSV upload:", err);
        return res
          .status(500)
          .json({ message: "Server error during processing." });
      }
    })
    .on("error", (err) => {
      console.error("âŒ CSV parsing error:", err);
      return res.status(500).json({ message: "CSV parsing failed." });
    });
};

const activateFreeSubscription = asyncHandler(async (req, res) => {
  const admin = req.schoolAdmin;
  if (!admin) throw new Error("Not authorized");

  if (admin.plan === "Free Plan") {
    return res.status(200).json({
      message: "ðŸŽ‰ You're already on the Free Plan",
      creditsAvailable: admin.creditsAvailable,
    });
  }

  admin.plan = "Free Plan";
  admin.creditsAvailable = 50;
  admin.subscriptionStatus = "active";
  await admin.save();

  res.status(200).json({
    message: "âœ… Free Plan activated",
    creditsAvailable: admin.creditsAvailable,
  });
});

const getDashboardMetrics = asyncHandler(async (req, res) => {
  const admin = req.schoolAdmin;
  if (!admin) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  const range = req.query.range || "allTime";
  console.log("Range:", range);
  console.log("Start:", req.query.startDate);
  console.log("End:", req.query.endDate);
  const now = new Date();
  let startDate = null;
  let prevStartDate = null;
  let prevEndDate = null;

  if (range === "last7") {
    startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    prevEndDate = startDate;
    prevStartDate = new Date(startDate.getTime() - 7 * 24 * 60 * 60 * 1000);
  } else if (range === "last30") {
    startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    prevEndDate = startDate;
    prevStartDate = new Date(startDate.getTime() - 30 * 24 * 60 * 60 * 1000);
  } else if (range === "thisYear") {
    startDate = new Date(now.getFullYear(), 0, 1);
    prevEndDate = startDate;
    prevStartDate = new Date(now.getFullYear() - 1, 0, 1);
  } else if (range === "custom") {
    const customStart = req.query.startDate;
    const customEnd = req.query.endDate;
    if (customStart) {
      startDate = new Date(customStart);
    }
    if (customStart && customEnd) {
      const end = new Date(customEnd);
      const diff = end.getTime() - startDate.getTime();
      prevEndDate = startDate;
      prevStartDate = new Date(startDate.getTime() - diff);
    }
  }

  // Fetch all students managed by this admin
  const students = await Userwebapp.find({ schoolAdmin: admin._id }).select(
    "_id isActive status createdAt",
  );
  const studentIds = students.map((s) => s._id);

  const totalStudents = students.length;
  const activeStudents = students.filter(
    (s) => s.isActive || s.status === "Approved",
  ).length;

  const remaining = admin.creditsAvailable || 0;
  const totalCredits = totalStudents + remaining;

  // Trend logic for Students Generated
  const generatedThisPeriod = startDate
    ? students.filter((s) => {
        const d = new Date(s.createdAt).getTime();
        if (range === "custom" && req.query.endDate) {
          return (
            d >= startDate.getTime() &&
            d <= new Date(req.query.endDate).getTime() + 86400000
          ); // inclusive of end day
        }
        return d >= startDate.getTime();
      }).length
    : totalStudents;
  const generatedLastPeriod =
    startDate && prevStartDate
      ? students.filter(
          (s) =>
            new Date(s.createdAt) >= prevStartDate &&
            new Date(s.createdAt) < prevEndDate,
        ).length
      : null;

  let generatedTrend = null;
  if (generatedLastPeriod !== null) {
    if (generatedLastPeriod === 0) {
      generatedTrend = generatedThisPeriod > 0 ? 100 : 0;
    } else {
      generatedTrend = Math.round(
        ((generatedThisPeriod - generatedLastPeriod) / generatedLastPeriod) *
          100,
      );
    }
  }

  // Fetch all applications submitted by these students
  const applications = await Application.find({
    studentId: { $in: studentIds },
  }).select("studentId status appliedDate");
  const totalApplications = applications.length;

  // Trend logic for Applications
  const appsThisPeriod = startDate
    ? applications.filter((a) => {
        const d = new Date(a.appliedDate).getTime();
        if (range === "custom" && req.query.endDate) {
          return (
            d >= startDate.getTime() &&
            d <= new Date(req.query.endDate).getTime() + 86400000
          );
        }
        return d >= startDate.getTime();
      }).length
    : totalApplications;
  const appsLastPeriod =
    startDate && prevStartDate
      ? applications.filter(
          (a) =>
            new Date(a.appliedDate) >= prevStartDate &&
            new Date(a.appliedDate) < prevEndDate,
        ).length
      : null;

  let appsTrend = null;
  if (appsLastPeriod !== null) {
    if (appsLastPeriod === 0) {
      appsTrend = appsThisPeriod > 0 ? 100 : 0;
    } else {
      appsTrend = Math.round(
        ((appsThisPeriod - appsLastPeriod) / appsLastPeriod) * 100,
      );
    }
  }

  // Calculate Pie Chart Data (Application Status Distribution)
  let pendingCount = 0;
  let acceptedCount = 0;
  let rejectedCount = 0;

  applications.forEach((app) => {
    // Optionally filter pie chart by date range too
    const d = new Date(app.appliedDate).getTime();
    if (startDate) {
      if (range === "custom" && req.query.endDate) {
        if (
          d < startDate.getTime() ||
          d > new Date(req.query.endDate).getTime() + 86400000
        )
          return;
      } else {
        if (d < startDate.getTime()) return;
      }
    }

    if (app.status === "Accepted" || app.status === "Completed")
      acceptedCount++;
    else if (app.status === "Rejected") rejectedCount++;
    else pendingCount++; // grouping Applied, Under Review, Pending, etc.
  });

  const rawPieData = [
    { name: "Accepted", value: acceptedCount },
    { name: "Pending", value: pendingCount },
    { name: "Rejected", value: rejectedCount },
  ];

  // Filter out 0 value segments to keep pie chart clean. Default if empty.
  const pieData = rawPieData.filter((d) => d.value > 0);
  if (pieData.length === 0) {
    pieData.push({ name: "No Apps", value: 1 });
  }

  // Calculate Bar Chart Data (Applications per month for the last 6 months)
  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const chartDataMap = {};
  const enrollmentDataMap = {};
  const today = new Date();

  // Initialize the last 6 months in chronological order
  for (let i = 5; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    chartDataMap[monthNames[d.getMonth()]] = 0;
    enrollmentDataMap[monthNames[d.getMonth()]] = 0;
  }

  applications.forEach((app) => {
    if (app.appliedDate) {
      const d = new Date(app.appliedDate);
      // Rough check if within last ~6 months
      if (today.getTime() - d.getTime() <= 6 * 31 * 24 * 60 * 60 * 1000) {
        const monthStr = monthNames[d.getMonth()];
        if (chartDataMap[monthStr] !== undefined) {
          chartDataMap[monthStr]++;
        }
      }
    }
  });

  const chartData = Object.keys(chartDataMap).map((name) => ({
    name,
    value: chartDataMap[name],
  }));

  // NEW: Enrollment Data
  students.forEach((student) => {
    if (student.createdAt) {
      const d = new Date(student.createdAt);
      if (today.getTime() - d.getTime() <= 6 * 31 * 24 * 60 * 60 * 1000) {
        const monthStr = monthNames[d.getMonth()];
        if (enrollmentDataMap[monthStr] !== undefined) {
          enrollmentDataMap[monthStr]++;
        }
      }
    }
  });

  const enrollmentData = Object.keys(enrollmentDataMap).map((name) => ({
    name,
    value: enrollmentDataMap[name],
  }));

  // Internship progress must come from actual applications, not fixed
  // percentages of the school's student count. Count each student once:
  // Completed takes precedence, any other application means In Progress,
  // and students with no applications are Not Started.
  const studentsWithApplications = new Set();
  const studentsWithCompletedInternships = new Set();

  applications.forEach((application) => {
    const studentId = String(application.studentId || "");
    if (!studentId) return;

    studentsWithApplications.add(studentId);
    if (application.status === "Completed") {
      studentsWithCompletedInternships.add(studentId);
    }
  });

  const completedCount = studentsWithCompletedInternships.size;
  const inProgressCount = studentsWithApplications.size - completedCount;
  const notStartedCount = Math.max(
    totalStudents - studentsWithApplications.size,
    0,
  );

  const completionData = [
    { name: "Completed", value: completedCount },
    { name: "In Progress", value: inProgressCount },
    { name: "Not Started", value: notStartedCount },
  ];

  // NEW: Daily Active Students
  const activeStudentsMap = {
    Mon: 0,
    Tue: 0,
    Wed: 0,
    Thu: 0,
    Fri: 0,
    Sat: 0,
    Sun: 0,
  };
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const sessions = await LoginSession.find({
    schoolAdmin: admin._id,
    loginAt: { $gte: sevenDaysAgo },
  });

  const uniqueLogins = new Set();
  sessions.forEach((session) => {
    if (session.loginAt && session.studentId) {
      const d = new Date(session.loginAt);
      const dayName = dayNames[d.getDay()];
      const uniqueKey = `${session.studentId}-${d.toDateString()}`;
      if (!uniqueLogins.has(uniqueKey)) {
        uniqueLogins.add(uniqueKey);
        activeStudentsMap[dayName]++;
      }
    }
  });

  let activeStudentsData = [
    { name: "Mon", value: activeStudentsMap["Mon"] },
    { name: "Tue", value: activeStudentsMap["Tue"] },
    { name: "Wed", value: activeStudentsMap["Wed"] },
    { name: "Thu", value: activeStudentsMap["Thu"] },
    { name: "Fri", value: activeStudentsMap["Fri"] },
    { name: "Sat", value: activeStudentsMap["Sat"] },
    { name: "Sun", value: activeStudentsMap["Sun"] },
  ];

  res.status(200).json({
    totalCredits,
    generated: totalStudents, // keep backward compatibility for credits logic
    remaining,
    plan: normalizeSchoolAdminPlanForClient(admin.plan),

    // Dynamic insights data
    totalStudents,
    activeStudents,
    totalApplications,
    acceptedCount,
    chartData,
    pieData,
    enrollmentData,
    completionData,
    activeStudentsData,

    // Time Range data
    generatedThisPeriod,
    generatedTrend,
    appsThisPeriod,
    appsTrend,
  });
});

const getStudentsBySchoolAdmin = asyncHandler(async (req, res) => {
  const adminId = req.schoolAdmin._id;
  const students = await Userwebapp.find({ schoolAdmin: adminId }).select(
    "-password",
  );
  res.status(200).json(students);
});

const toggleStudentAccess = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { isActive } = req.body;

  const student = await Userwebapp.findByIdAndUpdate(
    id,
    { isActive },
    { new: true },
  );
  if (!student) {
    res.status(404);
    throw new Error("Student not found.");
  }

  const statusText = isActive ? "restored" : "restricted";
  const emailSubject = `Your SkillNaav account has been ${statusText}`;
  const emailMessage = isActive
    ? `Your access to SkillNaav has been restored by your school administrator. You may now log in again.`
    : `Your access to SkillNaav has been restricted by your school administrator. You are currently blocked from logging in. Please contact your school for details.`;

  await notifyUser(student.email, emailSubject, emailMessage);

  res.status(200).json({
    message: `Student access ${statusText} and notification sent.`,
    student,
  });
});

const requestSchoolAdminPasswordReset = asyncHandler(async (req, res) => {
  const { email } = req.body;

  const admin = await SchoolAdmin.findOne({ email });
  if (!admin) {
    res.status(404);
    throw new Error("No admin found with that email.");
  }

  const otp = generateOTP();
  admin.otp = otp;
  admin.otpExpiration = Date.now() + 5 * 60 * 1000;

  await admin.save();

  await notifyUser(
    admin.email,
    "Your OTP for School Admin Password Reset",
    generateOtpEmailHtml(otp, "resetting your school admin password"),
  );

  res.status(200).json({ message: "OTP sent to your email." });
});

//Rename "verifySchoolAdminOTPAndResetPassword" this function and the separates functions for the otp-verification and resetpassword -19-08-2026
const resetSchoolAdminPassword = asyncHandler(async (req, res) => {
  const { email, otp, newPassword } = req.body;

  if (!email || !otp || !newPassword) {
    res.status(400);
    throw new Error("Email, OTP, and new password are required.");
  }

  const admin = await SchoolAdmin.findOne({
    email: email.trim().toLowerCase(),
    otp: String(otp).trim(),
    otpExpiration: { $gt: Date.now() },
  });

  if (!admin) {
    res.status(400);
    throw new Error("Invalid or expired OTP.");
  }

  admin.password = newPassword;
  admin.otp = undefined;
  admin.otpExpiration = undefined;

  await admin.save();

  res.status(200).json({
    message: "Password has been successfully updated.",
  });
});
// const verifySchoolAdminOTPAndResetPassword = asyncHandler(async (req, res) => {
//   const { email, otp, newPassword } = req.body;

//   if (!email || !otp || !newPassword) {
//     res.status(400);
//     throw new Error("Email, OTP, and new password are required.");
//   }

//   const admin = await SchoolAdmin.findOne({
//     email,
//     otp,
//     otpExpiration: { $gt: Date.now() },
//   });

//   if (!admin) {
//     res.status(400);
//     throw new Error("Invalid or expired OTP.");
//   }

//   admin.password = newPassword;
//   admin.otp = undefined;
//   admin.otpExpiration = undefined;

//   await admin.save();

//   res.status(200).json({ message: "Password has been successfully updated." });
// });

//Add this for verify otp for the forgot-password functionality - 19-08-2026
const verifySchoolAdminResetOTP = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    res.status(400);
    throw new Error("Email and OTP are required.");
  }

  const admin = await SchoolAdmin.findOne({
    email: email.trim().toLowerCase(),
    otp: String(otp).trim(),
    otpExpiration: { $gt: Date.now() },
  });

  if (!admin) {
    res.status(400);
    throw new Error("Invalid or expired OTP.");
  }

  res.status(200).json({
    success: true,
    message: "OTP verified successfully.",
  });
});

// âœ… Send OTP to email
const sendSchoolAdminVerificationCode = asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400);
    throw new Error("Invalid email address.");
  }
  const existing = await SchoolAdmin.findOne({ email });
  const existingUser = await Userwebapp.findOne({ email });
  const existingPartner = await Partnerwebapp.findOne({ email });
  if (existing || existingUser || existingPartner) {
    res.status(400);
    throw new Error("Email already registered.");
  }
  const otp = generateOTP();
  const otpExpiration = Date.now() + 10 * 60 * 1000;
  await SchoolAdminOTPVerification.findOneAndUpdate(
    { email },
    { otp, otpExpiration },
    { upsert: true, new: true },
  );
  await notifyUser(
    email,
    "SkillNaav School Admin OTP Verification",
    generateOtpEmailHtml(otp, "creating your SkillNaav school admin account"),
  );
  res.status(200).json({ message: "Verification code sent to email." });
});

// Verify OTP
const verifySchoolAdminOTP = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;
  const record = await SchoolAdminOTPVerification.findOne({ email });
  if (!record || record.otp !== otp || Date.now() > record.otpExpiration) {
    res.status(400);
    throw new Error("Invalid or expired OTP.");
  }
  await SchoolAdminOTPVerification.deleteOne({ email });
  res.status(200).json({ success: true, message: "OTP verified" });
});

const googleAuthSchoolAdmin = asyncHandler(async (req, res) => {
  const { idToken } = req.body;

  const ticket = await client.verifyIdToken({
    idToken,
    audience: process.env.GOOGLE_SIGNUP_CLIENT_ID,
  });

  const payload = ticket.getPayload();
  const { sub, email, name } = payload;

  let admin = await SchoolAdmin.findOne({ googleId: sub });

  if (!admin) {
    admin = await SchoolAdmin.findOne({ email });
  }

  if (!admin) {
    const existingUser = await Userwebapp.findOne({ email });
    const existingPartner = await Partnerwebapp.findOne({ email });
    if (existingUser || existingPartner) {
      res.status(400);
      throw new Error("Email already registered with another account type.");
    }
  }

  if (admin) {
    let updated = false;
    if (!admin.googleId) {
      admin.googleId = sub;
      admin.isGoogleUser = true;
      updated = true;
    }
    // REMOVED: Auto-approving existing unapproved users
    if (updated) {
      await admin.save();
    }

    const token = generateToken(admin._id);

    return res.status(200).json({
      _id: admin._id,
      schoolName: admin.schoolName,
      email: admin.email,
      isApproved: admin.isApproved,
      plan: normalizeSchoolAdminPlanForClient(admin.plan),
      subscriptionStatus: admin.subscriptionStatus,
      creditsAvailable: admin.creditsAvailable,
      token,
      isGoogleUser: true,
      needsProfileCompletion:
        !admin.profile || !admin.profile.country || !admin.profile.city,
    });
  }

  admin = await SchoolAdmin.create({
    schoolName: name || email,
    email,
    googleId: sub,
    isGoogleUser: true,
    isApproved: false, // ðŸ‘ˆ Fix: Must be false for new users
    plan: "Free Plan",
    creditsAvailable: 50,
  });

  const token = generateToken(admin._id);

  return res.status(201).json({
    _id: admin._id,
    schoolName: admin.schoolName,
    email: admin.email,
    isApproved: admin.isApproved,
    plan: normalizeSchoolAdminPlanForClient(admin.plan),
    subscriptionStatus: admin.subscriptionStatus,
    creditsAvailable: admin.creditsAvailable,
    token,
    isGoogleUser: true,
    needsProfileCompletion: true,
  });
});

// âœ… Get admin's own saved jobs
const getSavedJobsBySchoolAdmin = asyncHandler(async (req, res) => {
  const SchoolAdminSavedJob = require("../../models/webapp-models/schoolAdmin/SchoolAdminSavedJobModel");

  const adminId = req.schoolAdmin._id;
  let validJobs = [];

  // Fetch saved jobs specifically saved by the School Admin using their separate model
  const adminSavedJobs = await SchoolAdminSavedJob.find({
    schoolAdminId: adminId,
  })
    .populate("jobId")
    .populate("schoolAdminId", "schoolName email")
    .lean();

  // Normalize the admin saved jobs so the frontend can read them consistently
  const normalizedAdminJobs = adminSavedJobs
    .filter((s) => s.jobId !== null)
    .map((s) => ({
      _id: s._id,
      jobId: s.jobId,
      userId: {
        _id: s.schoolAdminId?._id || adminId,
        name: s.schoolAdminId?.schoolName || "You (Admin)",
        email: s.schoolAdminId?.email || "",
      },
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      isAdminSaved: true,
    }));

  validJobs = validJobs.concat(normalizedAdminJobs);

  // Sort descending by creation date
  validJobs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  res.status(200).json({ savedJobs: validJobs, total: validJobs.length });
});

module.exports = {
  getAllSchoolAdmins,
  approveSchoolAdmin,
  rejectSchoolAdmin,
  registerSchoolAdmin,
  loginSchoolAdmin,
  getSchoolAdminProfile,
  updateSchoolAdminProfile,
  uploadStudentsFromCSV,
  activateFreeSubscription,
  getDashboardMetrics,
  getStudentsBySchoolAdmin,
  toggleStudentAccess,
  requestSchoolAdminPasswordReset,
  //verifySchoolAdminOTPAndResetPassword,
  verifySchoolAdminResetOTP, //add this for verification 19-08-2026
  resetSchoolAdminPassword,
  sendSchoolAdminVerificationCode,
  verifySchoolAdminOTP,
  googleAuthSchoolAdmin,
  getSavedJobsBySchoolAdmin,
};
