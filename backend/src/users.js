const bcrypt = require("bcryptjs");
const User = require("./models/User");

// --- Core Auth Functions ---

async function createUser(username, password) {
    if (!username || username.length < 2) {
        throw new Error("Username must be at least 2 characters");
    }
    if (!password || password.length < 3) {
        throw new Error("Password must be at least 3 characters");
    }

    const existing = await User.findOne({ username });
    if (existing) {
        throw new Error("User already exists");
    }

    const hash = bcrypt.hashSync(password, 10);
    const newUser = new User({
        username,
        password: hash,
        role: "user",
        banned: false,
        limits: {
            dailyEmails: 50,
            dailyResumes: 10
        },
        usage: {
            dailyCount: 0,
            monthlyCount: 0,
            lastReset: new Date()
        }
    });

    await newUser.save();
    return newUser;
}

async function validatePassword(username, password) {
    const user = await User.findOne({ username });
    if (!user || !user.password) return false;
    return bcrypt.compareSync(password, user.password);
}

// Alias for backward compat
async function verifyPassword(username, password) {
    return validatePassword(username, password);
}

async function getUser(username) {
    const user = await User.findOne({ username });
    return user ? user.toObject() : null;
}

async function getUserRole(username) {
    const user = await User.findOne({ username });
    return user ? user.role || "user" : null;
}

// Settings and Resumes are still file-based for now (hybrid approach)
// We could migrate them too, but for now let's keep it simple.
// The "settings.json" and "resume.pdf" will be lost on Render restart if not in DB.
// TODO: Migrate settings to DB column and Resume to S3/GridFS. 
// For this task, we focus on User Auth & Job History persistence. 
// Resume PDF is ephemeral anyway (generated on demand usually).
const path = require("path");
const USERS_DATA_DIR = path.resolve(__dirname, "../../data/users");

function getUserSettingsPath(username) {
    // Ideally this should be DB based too. 
    // Returning dummy path for now or keeping file structure if app relies onfs
    return path.join(USERS_DATA_DIR, username, "settings.json");
}

function getUserResumePath(username) {
    // This file might not exist on Render after restart
    return path.resolve(__dirname, "../../assets", `${username}_resume.pdf`);
}

// --- Ban System ---

async function isBanned(username) {
    const user = await User.findOne({ username });
    return user ? !!user.banned : false;
}

async function banUser(username) {
    await User.updateOne({ username }, { banned: true });
    return true;
}

async function unbanUser(username) {
    await User.updateOne({ username }, { banned: false });
    return true;
}

// --- Limits ---

async function setUserLimits(username, limits) {
    await User.updateOne({ username }, {
        limits: {
            dailyEmails: Number(limits.dailyEmails) || 50,
            dailyResumes: Number(limits.dailyResumes) || 10
        }
    });
    return true;
}

async function getUserLimits(username) {
    const user = await User.findOne({ username });
    if (!user) return null;
    return user.limits || { dailyEmails: 50, dailyResumes: 10 };
}

// --- Usage Tracking ---

async function getUserUsage(username) {
    const user = await User.findOne({ username });
    if (!user) return null;

    if (!user.usage) {
        user.usage = {
            dailyCount: 0,
            monthlyCount: 0,
            lastReset: new Date()
        };
        await user.save();
    }
    return user.usage;
}

async function incrementUserUsage(username) {
    const user = await User.findOne({ username });
    if (!user) return false;

    if (!user.usage) {
        user.usage = {
            dailyCount: 0,
            monthlyCount: 0,
            lastReset: new Date()
        };
    }

    const now = new Date();
    const last = new Date(user.usage.lastReset);

    // Reset daily
    if (now.getDate() !== last.getDate() || now.getMonth() !== last.getMonth() || now.getFullYear() !== last.getFullYear()) {
        user.usage.dailyCount = 0;
    }

    // Reset monthly
    if (now.getMonth() !== last.getMonth() || now.getFullYear() !== last.getFullYear()) {
        user.usage.monthlyCount = 0;
    }

    user.usage.dailyCount++;
    user.usage.monthlyCount++;
    user.usage.lastReset = now;

    await user.save();
    return true;
}

// --- Admin ---

async function getAllUsers() {
    const users = await User.find({});
    return users.map(u => ({
        username: u.username,
        role: u.role || "user",
        created: u.created || "unknown",
        banned: !!u.banned,
        limits: u.limits || { dailyEmails: 50, dailyResumes: 10 },
        usage: u.usage || { dailyCount: 0, monthlyCount: 0 }
    }));
}

async function deleteUser(username) {
    await User.deleteOne({ username });
    return true;
}

async function updateUserProfile(username, profileData) {
    await User.updateOne({ username }, { $set: { profile: profileData } });
    return true;
}

async function updateSmtpSettings(username, smtpData) {
    await User.updateOne({ username }, { $set: { smtpSettings: smtpData } });
    return true;
}

async function updateNaukriCredentials(username, credentials) {
    await User.updateOne({ username }, { $set: { naukriCredentials: credentials } });
    return true;
}

async function getUserFull(username) {
    return User.findOne({ username });
}

module.exports = {
    createUser,
    validatePassword,
    verifyPassword,
    getUser,
    getUserFull,
    getUserRole,
    getUserSettingsPath,
    getUserResumePath,
    isBanned,
    banUser,
    unbanUser,
    setUserLimits,
    getUserLimits,
    getUserUsage,
    incrementUserUsage,
    getAllUsers,
    deleteUser,
    updateUserProfile,
    updateSmtpSettings,
    updateNaukriCredentials
};
