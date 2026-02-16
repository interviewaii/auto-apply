const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");

const USERS_FILE = path.resolve(__dirname, "../../data/users.json");
const USERS_DATA_DIR = path.resolve(__dirname, "../../data/users");

function ensureDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

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
        ensureDir(path.dirname(USERS_FILE));
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

// --- Core Auth Functions ---

async function createUser(username, password) {
    const users = loadUsers();
    if (users[username]) {
        throw new Error("User already exists");
    }
    if (!username || username.length < 2) {
        throw new Error("Username must be at least 2 characters");
    }
    if (!password || password.length < 3) {
        throw new Error("Password must be at least 3 characters");
    }

    const hash = bcrypt.hashSync(password, 10);
    users[username] = {
        password: hash,
        created: new Date().toISOString(),
        role: "user",
        banned: false,
        limits: {
            dailyEmails: 50,
            dailyResumes: 10
        },
        usage: {
            dailyCount: 0,
            monthlyCount: 0,
            lastReset: new Date().toISOString()
        }
    };

    if (!saveUsers(users)) {
        throw new Error("Failed to save user");
    }

    // Create per-user data directory
    const userDir = path.join(USERS_DATA_DIR, username);
    ensureDir(userDir);

    return users[username];
}

function validatePassword(username, password) {
    const user = getUser(username);
    if (!user || !user.password) return false;
    return bcrypt.compareSync(password, user.password);
}

// Alias for backward compat
function verifyPassword(username, password) {
    return validatePassword(username, password);
}

function getUserRole(username) {
    const user = getUser(username);
    return user ? user.role || "user" : null;
}

function getUserSettingsPath(username) {
    return path.join(USERS_DATA_DIR, username, "settings.json");
}

function getUserResumePath(username) {
    const user = getUser(username);
    if (user && user.resumePath) return user.resumePath;
    return path.resolve(__dirname, "../../assets", `${username}_resume.pdf`);
}

// --- Ban System ---

function isBanned(username) {
    const user = getUser(username);
    return user ? !!user.banned : false;
}

function banUser(username) {
    const users = loadUsers();
    if (!users[username]) return false;
    users[username].banned = true;
    return saveUsers(users);
}

function unbanUser(username) {
    const users = loadUsers();
    if (!users[username]) return false;
    users[username].banned = false;
    return saveUsers(users);
}

// --- Limits ---

function setUserLimits(username, limits) {
    const users = loadUsers();
    if (!users[username]) return false;
    users[username].limits = {
        dailyEmails: Number(limits.dailyEmails) || 50,
        dailyResumes: Number(limits.dailyResumes) || 10
    };
    return saveUsers(users);
}

function getUserLimits(username) {
    const user = getUser(username);
    if (!user) return null;
    return user.limits || { dailyEmails: 50, dailyResumes: 10 };
}

// --- Usage Tracking ---

function getUserUsage(username) {
    const user = getUser(username);
    if (!user) return null;

    if (!user.usage) {
        user.usage = {
            dailyCount: 0,
            monthlyCount: 0,
            lastReset: new Date().toISOString()
        };
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

    return saveUsers(users);
}

// --- Admin: Get All Users ---

function getAllUsers() {
    const users = loadUsers();
    const result = [];
    for (const [username, data] of Object.entries(users)) {
        result.push({
            username,
            role: data.role || "user",
            created: data.created || "unknown",
            banned: !!data.banned,
            limits: data.limits || { dailyEmails: 50, dailyResumes: 10 },
            usage: data.usage || { dailyCount: 0, monthlyCount: 0 }
        });
    }
    return result;
}

// --- Admin: Delete User ---

function deleteUser(username) {
    const users = loadUsers();
    if (!users[username]) return false;
    delete users[username];
    return saveUsers(users);
}

module.exports = {
    loadUsers,
    saveUsers,
    getUser,
    createUser,
    validatePassword,
    verifyPassword,
    getUserRole,
    getUserSettingsPath,
    getUserResumePath,
    getUserUsage,
    incrementUserUsage,
    isBanned,
    banUser,
    unbanUser,
    setUserLimits,
    getUserLimits,
    getAllUsers,
    deleteUser
};
