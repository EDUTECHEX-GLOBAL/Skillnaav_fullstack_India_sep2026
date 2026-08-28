//File: InternshipScheduleModel.js

const mongoose = require('mongoose');

const slotSchema = new mongoose.Schema(
  {
    startTime: { type: String, required: true }, // "HH:MM"
    endTime:   { type: String, required: true }  // "HH:MM"
  },
  { _id: false }
);

const selectedCertificateTemplateSchema = new mongoose.Schema(
  {
    templateId: {
      type:    mongoose.Schema.Types.ObjectId,
      ref:     "CustomInternshipCertificate",
      default: null
    },
    name:     { type: String, default: "", trim: true },
    fileName: { type: String, default: "", trim: true },
    imageUrl: { type: String, default: "", trim: true }
  },
  { _id: false }
);

const sessionOtpSchema = new mongoose.Schema(
  {
    code:       { type: String },
    generatedAt:{ type: Date },
    expiresAt:  { type: Date },
    isActive:   { type: Boolean, default: false }
  },
  { _id: false }
);

// ✅ Proper sub-schema — Mongoose stores defaults correctly in MongoDB
// Partner sets minAttendancePercent explicitly; no silent hardcoded value
const attendanceSettingsSchema = new mongoose.Schema(
  {
    // Partner MUST provide this value when creating the schedule.
    // Students must reach this % to be eligible for a certificate.
    minAttendancePercent: {
      type:     Number,
      required: [true, 'Minimum attendance percentage is required.'],
      min:      [1,   'Must be at least 1%.'],
      max:      [100, 'Cannot exceed 100%.']
    },

    // For ONLINE sessions: minimum minutes the student must stay in Google Meet.
    // 0 = any join counts as present. Partner can raise this (e.g. 30 = must stay 30 mins).
    onlineMinDurationMins: {
      type:    Number,
      default: 0,
      min:     0
    },

    // Partner can disable attendance tracking entirely (e.g. self-paced internships).
    trackingEnabled: {
      type:    Boolean,
      default: true
    }
  },
  { _id: false }
);

const mockInterviewSchema = new mongoose.Schema(
  {
    enabled: { type: Boolean, default: false },
    questions: [{ type: String }]
  },
  { _id: false }
);


const internshipScheduleSchema = new mongoose.Schema({

  internshipId: { type: mongoose.Schema.Types.ObjectId, ref: 'InternshipPosting', required: true },
  partnerId:    { type: mongoose.Schema.Types.ObjectId, required: true },
  startDate:    { type: Date,   required: true },
  endDate:      { type: Date,   required: true },
  workHours:    { type: String, required: true },

  isClosed: {
    type:    Boolean,
    default: false
  },

  defaultStartTime: { type: String },
  defaultEndTime:   { type: String },
  defaultEventLink: { type: String },
  defaultLocation: {
    name:    { type: String },
    address: { type: String },
    mapLink: { type: String }
  },
  defaultType: {
    type:    String,
    enum:    ['online', 'offline', 'hybrid'],
    default: 'online'
  },

  timeSlots: {
    online:  { type: [slotSchema] },
    offline: { type: [slotSchema] },
    hybrid:  { type: [slotSchema] }
  },

  selectedDays: [{ type: String }],

  selectedCertificateTemplate: {
    type:    selectedCertificateTemplateSchema,
    default: null
  },

  timetable: [
    {
      date:          { type: Date,   required: true },
      day:           { type: String, required: true },
      startTime:     { type: String, required: true },
      endTime:       { type: String, required: true },
      eventLink:     { type: String },
      sectionSummary:{ type: String },
      instructor:    { type: String },
      instructorId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Instructure' },
      assignment:    { type: String },
      type: {
        type:    String,
        enum:    ['online', 'offline', 'hybrid'],
        default: 'online'
      },
      location: {
        name:    { type: String },
        address: { type: String },
        mapLink: { type: String }
      },
      eventId: { type: String },
      events: [
        {
          description: { type: String, required: true },
          type: {
            type:    String,
            enum:    ['online', 'offline', 'hybrid'],
            default: 'online'
          },
          location: {
            name:    { type: String },
            address: { type: String },
            mapLink: { type: String }
          }
        }
      ],
      sessionOtp: { type: sessionOtpSchema },
      mockInterview: { type: mockInterviewSchema }
    }
  ],

  batches: [
    {
      timeSlot: { type: String, required: true },
      timetable: [
        {
          date:          { type: Date,   required: true },
          day:           { type: String, required: true },
          startTime:     { type: String, required: true },
          endTime:       { type: String, required: true },
          eventLink:     { type: String },
          sectionSummary:{ type: String },
          instructor:    { type: String },
          instructorId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Instructure' },
          assignment:    { type: String },
          type: {
            type:    String,
            enum:    ['online', 'offline', 'hybrid'],
            default: 'online'
          },
          location: {
            name:    { type: String },
            address: { type: String },
            mapLink: { type: String }
          },
          eventId: { type: String },
          events: [
            {
              description: { type: String, required: true },
              type: {
                type:    String,
                enum:    ['online', 'offline', 'hybrid'],
                default: 'online'
              },
              location: {
                name:    { type: String },
                address: { type: String },
                mapLink: { type: String }
              }
            }
          ],
          sessionOtp: { type: sessionOtpSchema },
          mockInterview: { type: mockInterviewSchema }
        }
      ]
    }
  ],

  // ✅ Partner sets this when creating/updating the schedule.
  // minAttendancePercent is REQUIRED — partner must decide the threshold.
  // Falls back to 80 only if partner does not send the value (safety net).
  attendanceSettings: {
    type:    attendanceSettingsSchema,
    default: () => ({
      minAttendancePercent:  80,
      onlineMinDurationMins: 0,
      trackingEnabled:       true
    })
  }

}, { timestamps: true });

internshipScheduleSchema.index({ internshipId: 1, partnerId: 1 }, { unique: true });

module.exports = mongoose.model('InternshipSchedule', internshipScheduleSchema);