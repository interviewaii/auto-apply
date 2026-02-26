const mongoose = require('mongoose');

// Connect to MongoDB with auto-retry (do NOT crash server on failure)
async function connectDB() {
    if (mongoose.connection.readyState >= 1) {
        return;
    }

    const uri = process.env.MONGODB_URI;
    if (!uri) {
        console.error("[DB] MONGODB_URI is not set. Database features will be unavailable.");
        return;
    }

    const tryConnect = async (attempt = 1) => {
        try {
            await mongoose.connect(uri, {
                serverSelectionTimeoutMS: 10000, // 10s timeout per attempt
                socketTimeoutMS: 45000,
            });
            console.log("[DB] MongoDB Connected successfully.");
        } catch (err) {
            console.error(`[DB] MongoDB connection failed (attempt ${attempt}):`, err.message);
            console.error("[DB] Check: 1) MONGODB_URI is correct  2) MongoDB Atlas Network Access allows 0.0.0.0/0");
            // Retry after 5 seconds — don't crash the server
            const retryDelay = Math.min(5000 * attempt, 30000);
            console.log(`[DB] Retrying in ${retryDelay / 1000}s...`);
            setTimeout(() => tryConnect(attempt + 1), retryDelay);
        }
    };

    await tryConnect();
}

module.exports = connectDB;
