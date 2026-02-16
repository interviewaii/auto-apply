const mongoose = require('mongoose');
require('dotenv').config();
const User = require('../backend/src/models/User');

const uri = process.env.MONGODB_URI;
// quick fix for uri if needed, same as before
let finalUri = uri;
if (!uri.includes('.net/')) finalUri = uri.replace('.net/?', '.net/jobreach?');
if (!finalUri.includes('authSource=')) finalUri += (finalUri.includes('?') ? '&' : '?') + 'authSource=admin';

async function listUsers() {
    try {
        await mongoose.connect(finalUri);
        console.log('Connected to DB.');
        const users = await User.find({});
        console.log('--- Users in DB ---');
        users.forEach(u => {
            console.log(`- Username: ${u.username}, Role: ${u.role}, Banned: ${u.banned}`);
        });
        console.log('-------------------');
    } catch (e) {
        console.error(e);
    } finally {
        await mongoose.disconnect();
    }
}
listUsers();
