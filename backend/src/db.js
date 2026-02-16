const mongoose = require('mongoose');

// Connect to MongoDB
async function connectDB() {
    if (mongoose.connection.readyState >= 1) {
        return;
    }

    const uri = process.env.MONGODB_URI;
    if (!uri) {
        console.error("MONGODB_URI is not defined in .env");
        return;
    }

    try {
        await mongoose.connect(uri);
        console.log("MongoDB Connected");
    } catch (err) {
        console.error("MongoDB Connection Error:", err);
        process.exit(1);
    }
}

module.exports = connectDB;
