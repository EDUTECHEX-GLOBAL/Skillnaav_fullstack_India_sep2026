const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
  },
  partnerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Partnerwebapp',
  },
  title: String,
  message: String,
  link: String, // could be offer letter, etc.
  type: {
    type: String,
    enum: ['offer', 'recommendation', 'general', 'schedule', 'certificate'], // added 'certificate'
    default: 'general',
  },
  isRead: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  deletedAt: { type: Date, default: null },
});

module.exports = mongoose.model('Notification', notificationSchema);
