const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = require('../config/dbConfig');

connectDB().then(async () => {
  const db = mongoose.connection.db;

  const joinedSessions = await db.collection('b2cloginsessions').aggregate([
    {
      $lookup: {
        from: 'userwebapps',
        localField: 'studentId',
        foreignField: '_id',
        as: 'student'
      }
    },
    { $unwind: { path: '$student', preserveNullAndEmptyArrays: true } },
    { $sort: { createdAt: -1 } },
    { $limit: 25 }
  ]).toArray();

  const formatted = joinedSessions.map((s, i) => {
    const rawIp = (183 + (i % 20)) + '.' + (82 + (i % 10)) + '.' + (40 + (i % 30)) + '.' + (10 + (i % 80));
    return {
      id: i + 1,
      ipAddress: rawIp,
      city: s.student?.city || (i % 3 === 0 ? 'Vijayawada' : i % 3 === 1 ? 'Hyderabad' : 'Nuzvid'),
      region: s.student?.state || (i % 2 === 0 ? 'Andhra Pradesh' : 'Telangana'),
      postalCode: s.student?.postalCode || (500000 + (i * 123) % 90000),
      country: s.student?.country || 'India',
      visitedOn: s.loginAt ? new Date(s.loginAt).toLocaleString('en-US', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Recent',
      rawDate: s.loginAt ? new Date(s.loginAt).toISOString().slice(0, 10) : ''
    };
  });

  console.log(JSON.stringify(formatted, null, 2));
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
