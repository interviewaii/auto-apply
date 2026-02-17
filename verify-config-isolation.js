const mongoose = require('mongoose');
require('dotenv').config();

const User = require('./backend/src/models/User');

// Connect to DB
const MONGO_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/job-mailer";

async function verifyConfigIsolation() {
    console.log("--- Verifying User Config Isolation ---");

    try {
        await mongoose.connect(MONGO_URI);
        console.log("Connected to MongoDB.");

        // 1. Create Dummy User with Credentials
        const testUsername = "config_test_" + Date.now();
        const testCreds = { username: "isolated@example.com", password: "secure_password" };

        console.log(`Creating test user: ${testUsername} with email ${testCreds.username}`);

        const newUser = new User({
            username: testUsername,
            password: "hashed_password",
            naukriCredentials: testCreds
        });
        await newUser.save();

        // 2. Fetch User and simulate GET /api/jobs/config logic
        console.log("Fetching user from DB...");
        const fetchedUser = await User.findOne({ username: testUsername });

        if (fetchedUser.naukriCredentials.username === testCreds.username) {
            console.log("SUCCESS: User credentials correctly stored and retrieved!");
            console.log("Stored Email:", fetchedUser.naukriCredentials.username);
        } else {
            console.error("FAILURE: Stored credentials do not match!");
        }

        // 3. Cleanup
        await User.deleteOne({ _id: newUser._id });
        console.log("Test user cleaned up.");

    } catch (error) {
        console.error("Test Failed:", error);
    } finally {
        await mongoose.disconnect();
        console.log("--- Verification Complete ---");
    }
}

verifyConfigIsolation();
