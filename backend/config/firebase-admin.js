// firebase-admin.js
const admin = require("firebase-admin");

const serviceAccount = require("../firebaseServiceAccountKey.json"); // Replace with the correct path

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://edutechex-authentication.firebaseio.com", // Replace with your project ID
});

module.exports = admin;
