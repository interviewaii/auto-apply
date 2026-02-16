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
    }
});

module.exports = mongoose.model('User', userSchema);
