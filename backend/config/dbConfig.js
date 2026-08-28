const mongoose = require("mongoose");
const dns = require("dns");

// ✅ DNS Fallback Fix:
// On some Windows machines, Node.js resolves only '127.0.0.1' as the DNS server.
// This prevents it from resolving MongoDB Atlas SRV/TXT records (querySrv ECONNREFUSED).
// If DNS servers are empty or loopback, we fall back to public Google/Cloudflare DNS.
try {
  const servers = dns.getServers();
  if (servers.length === 0 || servers.every(s => s === "127.0.0.1" || s === "::1")) {
    dns.setServers(["8.8.8.8", "1.1.1.1"]);
    console.log("🔧 DNS Fallback Applied: Configured Node.js to use public DNS servers.");
  }
} catch (dnsErr) {
  console.warn("⚠️ Warning: Failed to apply DNS fallback settings:", dnsErr.message);
}

const connectDB = async () => {
  try {
    const mongoURL = process.env.MONGO_URI; // Get MongoDB URI from .env
    if (!mongoURL) {
      throw new Error("MONGO_URI is not defined in environment variables.");
    }

    await mongoose.connect(mongoURL, {
      serverSelectionTimeoutMS: 50000, // Increase timeout in case of slow connections
    });

    console.log("✅ MongoDB connected successfully!");
  } catch (error) {
    console.error("❌ Error connecting to MongoDB:", error.message);
    process.exit(1); // Exit process on failure
  }
};

module.exports = connectDB;

