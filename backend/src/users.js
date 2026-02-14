const path = require("path");
const bcrypt = require("bcryptjs");
const { readJson, writeJsonAtomic, ensureDir } = require("./utils");
const config = require("./config");

const USERS_FILE = path.resolve(config.paths.root, "data", "users.json");

// Memory cache for users to avoid reading disk on every request
let usersCache = null;

function getAllUsers() {
    if (usersCache) return usersCache;
    usersCache = readJson(USERS_FILE, {});
    return usersCache;
}

function saveUsers(users) {
    writeJsonAtomic(USERS_FILE, users);
    usersCache = users;
}

async function createUser(username, password) {
    const users = getAllUsers();
    if (users[username]) {
        throw new Error("User already exists");
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    users[username] = {
        password: hashedPassword,
        created: new Date().toISOString(),
    };

    saveUsers(users);

    // create user data directory
    const userDir = path.resolve(config.paths.root, "data", "users", username);
    ensureDir(userDir);

    return { username };
}

async function validatePassword(username, password) {
    const users = getAllUsers();
    const user = users[username];
    if (!user) return false;
    return bcrypt.compare(password, user.password);
}

function getUserDir(username) {
    return path.resolve(config.paths.root, "data", "users", username);
}

function getUserSettingsPath(username) {
    return path.resolve(getUserDir(username), "settings.json");
}

function getUserResumePath(username) {
    return path.resolve(getUserDir(username), "resume.pdf");
}

module.exports = {
    createUser,
    validatePassword,
    getUserDir,
    getUserSettingsPath,
    getUserResumePath,
};
