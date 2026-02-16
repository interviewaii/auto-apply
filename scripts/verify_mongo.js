require('dotenv').config();
const mongoose = require('mongoose');

const uri = process.env.MONGODB_URI;

if (!uri) {
    console.error('Error: MONGODB_URI is not defined in .env file');
    process.exit(1);
}

// Ensure the URI has a database name if it's missing (though Atlas usually handles this)
// But for some drivers/versions, it's safer to have one.
// Let's print the URI (masked) to be sure.
console.log('Using URI:', uri.replace(/:([^@]+)@/, ':****@'));

mongoose.connect(uri)
    .then(() => {
        console.log('SUCCESS: Connected to MongoDB!');
        mongoose.disconnect();
    })
    .catch(err => {
        console.error('ERROR: Connection failed.');
        console.error(err.message);
        if (err.cause) console.error(err.cause);
        process.exit(1);
    });
