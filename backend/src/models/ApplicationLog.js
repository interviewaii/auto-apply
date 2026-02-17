const mongoose = require('mongoose');

const applicationLogSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['application', 'email'], required: true }, // 'application' (Naukri) or 'email' (SMTP)
    status: { type: String, enum: ['success', 'failed', 'skipped'], required: true },

    // For Emails
    recipientEmail: { type: String },
    subject: { type: String },

    // For Job Applications
    jobId: { type: String },
    jobTitle: { type: String },
    company: { type: String },
    jobUrl: { type: String },

    // Common
    details: { type: String }, // Error message or success note
    timestamp: { type: Date, default: Date.now }
});

// Index for fast retrieval by user
applicationLogSchema.index({ userId: 1, timestamp: -1 });

module.exports = mongoose.model('ApplicationLog', applicationLogSchema);
