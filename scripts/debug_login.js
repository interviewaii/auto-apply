require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../backend/src/models/User');

const uri = process.env.MONGODB_URI;

// Same URI fix logic as before to be safe
let finalUri = uri;
if (!uri.includes('.net/')) finalUri = uri.replace('.net/?', '.net/jobreach?');
if (!finalUri.includes('authSource=')) finalUri += (finalUri.includes('?') ? '&' : '?') + 'authSource=admin';

async function debugLogin() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(finalUri);
        console.log('Connected.');

        const username = 'ashu';
        const password = 'ChangeMe123!';

        console.log(`Searching for user: ${username}`);
        const user = await User.findOne({ username });

        if (!user) {
            console.log('User NOT found in DB.');
        } else {
            console.log('User found:', user.username);
            console.log('Stored Hash:', user.password);

            console.log(`Attempting to validate password: '${password}'`);
            const isValid = bcrypt.compareSync(password, user.password);
            console.log('Password Valid?', isValid);

            if (!isValid) {
                console.log('Creating a new hash for comparison...');
                const newHash = bcrypt.hashSync(password, 10);
                console.log('New Hash:', newHash);
                console.log('Compare against new hash:', bcrypt.compareSync(password, newHash));
            }
        }

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await mongoose.disconnect();
    }
}

debugLogin();
