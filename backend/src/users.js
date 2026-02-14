const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");

const USERS_FILE = path.resolve(__dirname, "../../data/users.json");

function loadUsers() {
    if (!fs.existsSync(USERS_FILE)) {
        return {};
    }
    try {
        return JSON.parse(fs.readFileSync(USERS_FILE, "utf-8"));
    } catch (e) {
        console.error("Failed to load users.json:", e);
        return {};
    }
}

function saveUsers(users) {
    try {
        fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
        return true;
    } catch (e) {
        console.error("Failed to save users.json:", e);
        return false;
    }
}

function getUser(username) {
    const users = loadUsers();
    return users[username];
}

function verifyPassword(username, password) {
    const user = getUser(username);
    if (!user || !user.password) return false;
    return bcrypt.compareSync(password, user.password);
}

function getUserRole(username) {
    const user = getUser(username);
    return user ? user.role || "user" : null;
}

function getUserUsage(username) {
    const user = getUser(username);
    if (!user) return null;

    // Initialize usage if missing
    if (!user.usage) {
        user.usage = {
            dailyCount: 0,
            monthlyCount: 0,
            lastReset: new Date().toISOString()
        };
        // We don't save here to avoid read/write loops, but UI should handle it
    }

    return user.usage;
}

function incrementUserUsage(username) {
    const users = loadUsers();
    const user = users[username];
    if (!user) return false;

    if (!user.usage) {
        user.usage = {
            dailyCount: 0,
            monthlyCount: 0,
            lastReset: new Date().toISOString()
        };
    }

    const now = new Date();
    const last = new Date(user.usage.lastReset);

    // Reset daily if different day
    if (now.getDate() !== last.getDate() || now.getMonth() !== last.getMonth() || now.getFullYear() !== last.getFullYear()) {
        user.usage.dailyCount = 0;
    }

    // Reset monthly if different month
    if (now.getMonth() !== last.getMonth() || now.getFullYear() !== last.getFullYear()) {
        user.usage.monthlyCount = 0;
    }

    user.usage.dailyCount++;
    user.usage.monthlyCount++;
    user.usage.lastReset = now.toISOString();

    // Save back
    try {
        fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
        return true;
    } catch (e) {
        console.error("Failed to update user usage:", e);
        return false;
    }
}

function getUserResumePath(username) {
    // Assuming resumes are stored in assets/resumes/<username>
    // or just assets/<username>_resume.pdf based on previous context.
    // For now, let's map it to a standard location.
    // Check known locations or config.
    // The config.js has a RESUME_PATH env var, but that's global.
    // For multi-user, we might need a per-user path.
    // Let's implement a simple lookup.
    const user = getUser(username);
    if (user && user.resumePath) return user.resumePath;

    // Fallback/Default structure
    // Adjust based on where uploads go
    return path.resolve(__dirname, "../../assets", `${username}_resume.pdf`);
}


module.exports = {
    loadUsers,
    saveUsers,
    getUser,
    verifyPassword,
    getUserRole,
    getUserUsage,
    incrementUserUsage,
    getUserResumePath
};
