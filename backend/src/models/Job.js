const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
    platform: { type: String, required: true },
    jobId: { type: String, required: true },
    title: String,
    company: String,
    location: String,
    datePosted: String,
    url: String,
    description: String,
    isRemote: Boolean,
    scrapedDate: { type: Date, default: Date.now },
    applicationStatus: { type: String, default: 'pending' }, // pending, applied, skipped, failed
    appliedDate: Date,
    applicationType: String, // auto_apply, manual_review, external_redirect
    failureReason: String,
    externalUrl: String
});

// Compound index for unique jobs per platform
jobSchema.index({ platform: 1, jobId: 1 }, { unique: true });

module.exports = mongoose.model('Job', jobSchema);
