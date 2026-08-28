const asyncHandler = require("express-async-handler");
const Userwebapp = require("../models/webapp-models/userModel");
const Partnerwebapp = require("../models/webapp-models/partnerModel");
const InternshipModel = require("../models/webapp-models/internshipPostModel");
const PaymentModel = require("../models/webapp-models/PaymentModel");
const ApplicationModel = require("../models/webapp-models/applicationModel");

// Helper function to get month name from number
const getMonthName = (monthNumber) => {
  const date = new Date();
  date.setMonth(monthNumber - 1);
  return date.toLocaleString("default", { month: "short" });
};

//Helper function for the aggregations of the models - 31-07-2026
const getMonthlyCounts = async (Model, fieldName, dateMatch) => {
  const aggregation = await Model.aggregate([
    {
      $match: dateMatch,
    },
    {
      $group: {
        _id: {
          year: { $year: "$createdAt" },
          month: { $month: "$createdAt" },
        },
        count: {
          $sum: 1,
        },
      },
    },
    {
      $sort: {
        "_id.year": 1,
        "_id.month": 1,
      },
    },
  ]);

  return aggregation.map((item) => ({
    month: `${item._id.year}-${String(item._id.month).padStart(2, "0")}`,
    [fieldName]: item.count,
  }));
};

//Extract Monthly Revenue Helper - 31-07-2026
const getMonthlyRevenue = async (dateMatch) => {
  const aggregation = await PaymentModel.aggregate([
    {
      $match: dateMatch,
    },
    {
      $group: {
        _id: {
          year: { $year: "$createdAt" },
          month: { $month: "$createdAt" },
        },
        revenue: {
          $sum: {
            $toDouble: "$amount",
          },
        },
      },
    },
    {
      $sort: {
        "_id.year": 1,
        "_id.month": 1,
      },
    },
  ]);

  return aggregation.map((item) => ({
    month: `${item._id.year}-${String(item._id.month).padStart(2, "0")}`,
    revenue: Number(item.revenue.toFixed(2)),
  }));
};

//Distribution Helper
const getDistribution = async (
  Model,
  groupField,
  dateMatch = null,
  transformKey = null,
) => {
  const pipeline = [];

  if (dateMatch && Object.keys(dateMatch).length) {
    pipeline.push({
      $match: dateMatch,
    });
  }

  pipeline.push({
    $group: {
      _id: `$${groupField}`,
      count: {
        $sum: 1,
      },
    },
  });

  const aggregation = await Model.aggregate(pipeline);

  return aggregation.reduce((acc, item) => {
    const key = transformKey ? transformKey(item._id) : item._id;

    acc[key] = item.count;

    return acc;
  }, {});
};

const getDashboardCounts = asyncHandler(async (req, res) => {
  //31-07-2026
  const { startDate, endDate } = req.query;
  let dateMatch = {};
  let applicationDateMatch = {};
  if (startDate && endDate) {
    const start = new Date(`${startDate}-01T00:00:00.000Z`);

    const end = new Date(`${endDate}-01T00:00:00.000Z`);
    end.setMonth(end.getMonth() + 1);

    dateMatch = {
      createdAt: {
        $gte: start,
        $lt: end,
      },
    };

    applicationDateMatch = {
      appliedDate: {
        $gte: start,
        $lt: end,
      },
    };
  }

  console.log("Dashboard Date Filter:", dateMatch);

  // Basic counts
  const usersCount = await Userwebapp.countDocuments(dateMatch);
  const partnersCount = await Partnerwebapp.countDocuments(dateMatch);
  const paymentsCount = await PaymentModel.countDocuments(dateMatch);
  const internshipsCount = await InternshipModel.countDocuments(dateMatch);
  const applicationsCount =
    await ApplicationModel.countDocuments(applicationDateMatch); // Total applications

  // 🔹 Total Revenue Calculation
  const totalRevenueAgg = await PaymentModel.aggregate([
    {
      $match: dateMatch,
    },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: { $toDouble: "$amount" } }, // Convert amount to number
      },
    },
  ]);
  const totalRevenue =
    totalRevenueAgg.length > 0 ? totalRevenueAgg[0].totalRevenue : 0;

  const monthlyRevenue = await getMonthlyRevenue(dateMatch);

  // Aggregate User Growth data by month
  const userGrowth = await getMonthlyCounts(Userwebapp, "users", dateMatch);

  // Monthly Partner Growth Trend
  const partnerGrowth = await getMonthlyCounts(
    Partnerwebapp,
    "count",
    dateMatch,
  );
  // Aggregate Monthly Job Postings
  const jobPostings = await getMonthlyCounts(
    InternshipModel,
    "jobsPosted",
    dateMatch,
  );

  // Internship Type Distribution
  const internshipTypeDistribution = await getDistribution(
    InternshipModel,
    "internshipType",
    dateMatch,
  );

  // Average Compensation
  const avgCompensationAgg = await InternshipModel.aggregate([
    { $match: { "compensationDetails.type": { $in: ["STIPEND", "PAID"] } } },
    {
      $group: {
        _id: "$compensationDetails.type",
        avgAmount: { $avg: "$compensationDetails.amount" },
      },
    },
  ]);
  const averageCompensation = avgCompensationAgg.reduce((acc, cur) => {
    acc[cur._id] = Number(cur.avgAmount.toFixed(2));
    return acc;
  }, {});

  // Partner Approval Status
  const partnerApproval = await getDistribution(
    Partnerwebapp,
    "adminApproved",
    null,
    (value) => (value ? "approved" : "pending"),
  );

  // **New Analytics: Application Status Distribution**
  const applicationStatusDistribution = await getDistribution(
    ApplicationModel,
    "status",
    applicationDateMatch,
  );

  // **New Analytics: Applications by Internship Type (STIPEND, PAID, FREE)**
  const applicationsByInternshipType = await ApplicationModel.aggregate([
    {
      $match: applicationDateMatch,
    },
    {
      $lookup: {
        from: "internshippostings", // Ensure the collection name is correct
        localField: "internshipId",
        foreignField: "_id",
        as: "internshipDetails",
      },
    },
    { $unwind: "$internshipDetails" },
    {
      $group: {
        _id: "$internshipDetails.internshipType",
        count: { $sum: 1 },
      },
    },
  ]);

  const applicationTypeDistribution = applicationsByInternshipType.reduce(
    (acc, cur) => {
      acc[cur._id] = cur.count;
      return acc;
    },
    {},
  );

  res.json({
    usersCount,
    partnersCount,
    internshipsCount,
    paymentsCount,
    applicationsCount, // Total applications
    userGrowth,
    jobPostings,
    internshipTypeDistribution,
    averageCompensation,
    partnerApproval,
    partnerGrowth,
    applicationStatusDistribution, // Application type breakdown
    applicationTypeDistribution, // New: Applications applied by type (STIPEND, PAID, FREE)
    totalRevenue,
    monthlyRevenue,
  });
});

module.exports = { getDashboardCounts };
