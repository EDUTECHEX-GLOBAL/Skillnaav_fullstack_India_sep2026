const cron = require("node-cron");
const mongoose = require("mongoose");
const User = require("../models/webapp-models/userModel");

async function runExpiryJob() {
  try {
    const now = new Date();

    const expiredUsers = await User.find({
      isPremium: true,
      premiumExpiration: { $lte: now },
    }).select("_id");

    if (!expiredUsers || expiredUsers.length === 0) {
      console.log("✔ Cron: No expired users found.");
      return;
    }

    const userIds = expiredUsers.map((u) => u._id);

    const updateResult = await User.updateMany(
      { _id: { $in: userIds } },
      {
        $set: {
          isPremium: false,
          planType: "Free",
          premiumExpiration: null,
        },
      }
    );

    console.log(`✔ Cron: Expired premium cleared for ${expiredUsers.length} users.`, {
      matched: updateResult.matchedCount ?? updateResult.n,
      modified: updateResult.modifiedCount ?? updateResult.nModified,
    });
  } catch (err) {
    console.error("❌ Cron Error (runExpiryJob):", err);
  }
}

// ✅ Fixed: guard flag prevents duplicate cron jobs on reconnect events
let cronScheduled = false;

function scheduleCron() {
  if (cronScheduled) return;
  cronScheduled = true;

  const cronExpr = "0 0 * * *"; // daily at 00:00 UTC
  const timezone = "UTC";

  // Uncomment for testing (run every minute), then revert:
  // const cronExpr = "* * * * *";

  cron.schedule(
    cronExpr,
    () => {
      console.log(`⏱ Cron triggered at ${new Date().toISOString()} (${timezone}).`);
      runExpiryJob();
    },
    { timezone }
  );

  console.log(`✔ Cron scheduled (${cronExpr}) with timezone ${timezone}`);
}

if (mongoose.connection.readyState === 1) {
  scheduleCron();
} else {
  mongoose.connection.on("connected", () => {
    console.log("✔ Mongoose connected — scheduling premium expiry cron.");
    scheduleCron();
  });

  mongoose.connection.on("reconnected", () => {
    console.log("✔ Mongoose reconnected.");
    scheduleCron(); // ✅ Safe to call — guard flag prevents duplicate scheduling
  });
}

module.exports = { runExpiryJob };
