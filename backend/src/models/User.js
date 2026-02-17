const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, default: 'user' },
    created: { type: Date, default: Date.now },
    banned: { type: Boolean, default: false },
    limits: {
        dailyEmails: { type: Number, default: 50 },
        dailyResumes: { type: Number, default: 10 }
    },
    usage: {
        dailyCount: { type: Number, default: 0 },
        monthlyCount: { type: Number, default: 0 },
        lastReset: { type: Date, default: Date.now }
    },
    // Multi-User Isolation Fields
    naukriCredentials: {
        username: { type: String, default: "" },
        password: { type: String, default: "" }
    },
    smtpSettings: {
        host: { type: String, default: "" },
        port: { type: Number, default: 587 },
        user: { type: String, default: "" },
        pass: { type: String, default: "" },
        secure: { type: Boolean, default: false },
        fromEmail: { type: String, default: "" },
        fromName: { type: String, default: "" }
    },
    profile: {
        resumePath: { type: String, default: "" },
        keywords: { type: String, default: "" },
        location: { type: String, default: "" },
        experience: { type: String, default: "" },
        noticePeriod: { type: String, default: "" },
        expectedCtc: { type: String, default: "" },
        currentLocation: { type: String, default: "" },
        preferredLocation: { type: String, default: "" },
        subject: { type: String, default: "" },
        defaultBody: { type: String, default: "" }
    }
});

module.exports = mongoose.model('User', userSchema);
