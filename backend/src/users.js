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

module.exports = {
    createUser,
    validatePassword,
    verifyPassword,
    getUser,
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
    deleteUser
};

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
