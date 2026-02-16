require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

// Adjust paths based on where this script is run
// Assuming run from root: node scripts/migrate_users.js
const USERS_DIR = path.resolve(__dirname, '../data/users');
const User = require('../backend/src/models/User');

const uri = process.env.MONGODB_URI;

if (!uri) {
    console.error('Error: MONGODB_URI is not defined in .env file');
    process.exit(1);
}

// Ensure the URI has a database name if it's missing
let finalUri = uri;
if (!uri.includes('.net/')) {
    finalUri = uri.replace('.net/?', '.net/jobreach?');
}
if (!finalUri.includes('authSource=')) {
    finalUri += (finalUri.includes('?') ? '&' : '?') + 'authSource=admin';
}

async function migrate() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(finalUri);
        console.log('Connected.');

        if (!fs.existsSync(USERS_DIR)) {
            console.log('No data/users directory found. Nothing to migrate.');
            process.exit(0);
        }

        const entries = fs.readdirSync(USERS_DIR, { withFileTypes: true });
        const userDirs = entries.filter(dirent => dirent.isDirectory()).map(dirent => dirent.name);

        console.log(`Found ${userDirs.length} potential users in file system:`, userDirs);

        const defaultPass = 'ChangeMe123!';
        const salt = bcrypt.genSaltSync(10);
        const hash = bcrypt.hashSync(defaultPass, salt);

        for (const username of userDirs) {
            const existing = await User.findOne({ username });
            if (existing) {
                console.log(`User '${username}' already exists in DB. Skipping.`);
                continue;
            }

            console.log(`Migrating user '${username}'...`);

            // Basic user creation
            const newUser = new User({
                username: username,
                password: hash,
                role: 'user', // Default role
                created: new Date(),
                banned: false,
                limits: { dailyEmails: 50, dailyResumes: 10 },
                usage: { dailyCount: 0, monthlyCount: 0, lastReset: new Date() }
            });

            await newUser.save();
            console.log(`User '${username}' created with password: ${defaultPass}`);
        }

        console.log('Migration complete.');

    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected.');
    }
}

migrate();
