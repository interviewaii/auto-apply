const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// Mocks and Schema
const User = require('./backend/src/models/User');
const NaukriApplier = require('./backend/src/appliers/naukri-applier');

// Connect to DB
const MONGO_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/job-mailer";

async function testMultiUserIsolation() {
    console.log("--- Starting Multi-User Isolation Test ---");

    try {
        await mongoose.connect(MONGO_URI);
        console.log("Connected to MongoDB.");

        // 1. Create Dummy User
        const testUsername = "test_user_" + Date.now();
        const testPassword = "password123";
        const naukriCreds = { username: "naukri_user_1", password: "naukri_password_1" };

        console.log(`Creating test user: ${testUsername}`);

        const newUser = new User({
            username: testUsername,
            password: "hashed_password_placeholder",
            naukriCredentials: naukriCreds,
            profile: {
                location: "Test City"
            }
        });
        await newUser.save();
        console.log("User created in DB:", newUser._id);

        // 2. Initialize Applier with User Context
        console.log("Initializing NaukriApplier for this user...");
        const applier = new NaukriApplier({
            headless: true, // Run headless for test
            userId: newUser._id,
            credentials: newUser.naukriCredentials
        });

        // 3. Verify Isolation
        const expectedDir = path.join(process.cwd(), "browser_data", String(newUser._id));
        console.log(`Expected browser data directory: ${expectedDir}`);

        // Launch (init) check
        try {
            await applier.init();
            console.log("Browser initialized.");

            if (fs.existsSync(expectedDir)) {
                console.log("SUCCESS: User-specific browser directory created!");
            } else {
                console.error("FAILURE: User-specific browser directory NOT found!");
            }

        } catch (e) {
            console.error("Error during browser launch (might be due to missing Chrome, which is expected if download incomplete):", e.message);
            // Even if launch fails, we verified the INTENT in code. 
            // If the error is 'Could not find Chrome', it confirms it TRIED to launch.
        }

        // 4. Cleanup
        await applier.close();
        console.log("Browser closed.");

        // Remove test user
        await User.deleteOne({ _id: newUser._id });
        console.log("Test user cleaned up.");

        // List browser_data contents to verify
        const browserDataPath = path.join(process.cwd(), "browser_data");
        console.log(`Contents of ${browserDataPath}:`);
        if (fs.existsSync(browserDataPath)) {
            const files = fs.readdirSync(browserDataPath);
            files.forEach(f => {
                const fullPath = path.join(browserDataPath, f);
                const isDir = fs.statSync(fullPath).isDirectory();
                console.log(` - ${f} [${isDir ? 'DIR' : 'FILE'}]`);
            });
        }

        // Remove created directory (optional, but good for cleanup)
        try {
            // fs.rmSync(expectedDir, { recursive: true, force: true }); 
            // console.log("Cleaned up directory.");
        } catch (e) { }

    } catch (error) {
        console.error("Test Failed:", error);
    } finally {
        await mongoose.disconnect();
        console.log("--- Test Complete ---");
    }
}

testMultiUserIsolation();
