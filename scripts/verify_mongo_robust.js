require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');

const uri = process.env.MONGODB_URI;
const logFile = 'debug_mongo.log';

function log(message) {
    console.log(message);
    fs.appendFileSync(logFile, message + '\n');
}

if (!uri) {
    log('Error: MONGODB_URI is not defined in .env file');
    process.exit(1);
}

// Ensure the URI has a database name if it's missing
let finalUri = uri;
if (!uri.includes('.net/')) {
    finalUri = uri.replace('.net/?', '.net/test?');
}

// Add authSource=admin if not present
if (!finalUri.includes('authSource=')) {
    finalUri += '&authSource=admin';
}

log(`Attempting to connect with URI (masked): ${finalUri.replace(/:([^@]+)@/, ':****@')}`);

const TestSchema = new mongoose.Schema({ name: String, date: { type: Date, default: Date.now } });
const TestModel = mongoose.model('ConnectionTest', TestSchema);

mongoose.connect(finalUri)
    .then(async () => {
        log('SUCCESS: Connected to MongoDB!');

        try {
            log('Attempting to write a test document...');
            const doc = new TestModel({ name: 'Connection Verification' });
            await doc.save();
            log('SUCCESS: Test document saved!');

            log('Attempting to delete test document...');
            await TestModel.deleteOne({ _id: doc._id });
            log('SUCCESS: Test document deleted!');

        } catch (writeErr) {
            log('ERROR: Write operation failed.');
            log(`Message: ${writeErr.message}`);
        } finally {
            mongoose.disconnect();
        }
    })
    .catch(err => {
        log('ERROR: Connection failed.');
        log(`Message: ${err.message}`);
        if (err.cause) log(`Cause: ${JSON.stringify(err.cause)}`);
        if (err.code) log(`Code: ${err.code}`);
        if (err.codeName) log(`CodeName: ${err.codeName}`);
        process.exit(1);
    });
