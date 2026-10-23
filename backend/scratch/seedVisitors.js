require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/dbConfig');

const indianLocations = [
  { city: 'Hyderabad', region: 'Telangana', postalCode: '500034', ipBase: '183.82.40.' },
  { city: 'Vijayawada', region: 'Andhra Pradesh', postalCode: '520007', ipBase: '183.82.41.' },
  { city: 'Bengaluru', region: 'Karnataka', postalCode: '560001', ipBase: '106.51.72.' },
  { city: 'Visakhapatnam', region: 'Andhra Pradesh', postalCode: '530002', ipBase: '183.82.44.' },
  { city: 'Chennai', region: 'Tamil Nadu', postalCode: '600001', ipBase: '157.48.91.' },
  { city: 'Mumbai', region: 'Maharashtra', postalCode: '400001', ipBase: '115.111.23.' },
  { city: 'Nuzvid', region: 'Andhra Pradesh', postalCode: '521111', ipBase: '183.82.42.' },
  { city: 'Gudivada', region: 'Andhra Pradesh', postalCode: '521301', ipBase: '183.82.43.' },
  { city: 'Tirupati', region: 'Andhra Pradesh', postalCode: '517501', ipBase: '183.82.45.' },
  { city: 'Pune', region: 'Maharashtra', postalCode: '411001', ipBase: '114.143.12.' },
];

const pages = ['/', '/pricing', '/features', '/contact', '/team', '/faqs', '/vision', '/user/login'];

(async () => {
  await connectDB();
  const db = mongoose.connection.db;

  const now = new Date('2026-10-19T11:05:00+05:30');
  const docs = [];

  // Generate 25 recent visitors for today (19 Oct 2026)
  for (let i = 0; i < 25; i++) {
    const minutesAgo = i * 6 + Math.floor(Math.random() * 5);
    const visitTime = new Date(now.getTime() - minutesAgo * 60 * 1000);
    const loc = indianLocations[i % indianLocations.length];
    const ip = loc.ipBase + (10 + ((i * 7) % 85));
    const page = pages[i % pages.length];

    docs.push({
      ipAddress: ip,
      city: loc.city,
      region: loc.region,
      postalCode: loc.postalCode,
      country: 'India',
      page: page,
      visitedOn: visitTime,
      createdAt: visitTime,
    });
  }

  // Generate 20 visitors for yesterday (18 Oct 2026)
  for (let i = 0; i < 20; i++) {
    const hoursAgo = 24 + i * 1.1;
    const visitTime = new Date(now.getTime() - hoursAgo * 3600 * 1000);
    const loc = indianLocations[(i + 3) % indianLocations.length];
    const ip = loc.ipBase + (20 + ((i * 11) % 75));
    const page = pages[(i + 2) % pages.length];

    docs.push({
      ipAddress: ip,
      city: loc.city,
      region: loc.region,
      postalCode: loc.postalCode,
      country: 'India',
      page: page,
      visitedOn: visitTime,
      createdAt: visitTime,
    });
  }

  // Generate 15 visitors for 17 Oct 2026
  for (let i = 0; i < 15; i++) {
    const hoursAgo = 48 + i * 1.5;
    const visitTime = new Date(now.getTime() - hoursAgo * 3600 * 1000);
    const loc = indianLocations[(i + 5) % indianLocations.length];
    const ip = loc.ipBase + (15 + ((i * 9) % 80));
    const page = pages[(i + 1) % pages.length];

    docs.push({
      ipAddress: ip,
      city: loc.city,
      region: loc.region,
      postalCode: loc.postalCode,
      country: 'India',
      page: page,
      visitedOn: visitTime,
      createdAt: visitTime,
    });
  }

  // Generate 10 visitors for 16 Oct 2026
  for (let i = 0; i < 10; i++) {
    const hoursAgo = 72 + i * 2;
    const visitTime = new Date(now.getTime() - hoursAgo * 3600 * 1000);
    const loc = indianLocations[(i + 2) % indianLocations.length];
    const ip = loc.ipBase + (30 + ((i * 5) % 65));
    const page = pages[(i + 3) % pages.length];

    docs.push({
      ipAddress: ip,
      city: loc.city,
      region: loc.region,
      postalCode: loc.postalCode,
      country: 'India',
      page: page,
      visitedOn: visitTime,
      createdAt: visitTime,
    });
  }

  const result = await db.collection('sitevisitors').insertMany(docs);
  console.log(`✅ Inserted ${result.insertedCount} live visitors into sitevisitors collection!`);

  const total = await db.collection('sitevisitors').countDocuments();
  console.log(`📊 Total sitevisitors now: ${total}`);

  await mongoose.disconnect();
  process.exit(0);
})();
