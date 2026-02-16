const axios = require('axios');

const BASE_URL = 'http://localhost:4545';
let userCookie = '';
let adminCookie = '';

async function test() {
    console.log("Starting Auth Verification...");

    // 1. Register User
    try {
        console.log("\n1. Testing Register...");
        const regRes = await axios.post(`${BASE_URL}/api/register`, {
            user: "testuser_verify",
            pass: "pass123"
        });
        console.log("✅ Register success:", regRes.data);
    } catch (e) {
        if (e.response && e.response.data && e.response.data.error === "User already exists") {
            console.log("⚠️ User already exists, continuing...");
        } else {
            console.error("❌ Register failed:", e.response ? e.response.data : e.message);
            process.exit(1);
        }
    }

    // 2. Login User
    try {
        console.log("\n2. Testing User Login...");
        const loginRes = await axios.post(`${BASE_URL}/api/login`, {
            user: "testuser_verify",
            pass: "pass123"
        });
        console.log("✅ Login success:", loginRes.data);
        userCookie = loginRes.headers['set-cookie'];
        if (!userCookie) console.warn("⚠️ No cookie received!");
    } catch (e) {
        console.error("❌ Login failed:", e.response ? e.response.data : e.message);
        process.exit(1);
    }

    // 3. Login Admin
    try {
        console.log("\n3. Testing Admin Login...");
        const adminRes = await axios.post(`${BASE_URL}/api/admin/login`, {
            user: "admin",
            pass: "admin123"
        });
        console.log("✅ Admin Login success:", adminRes.data);
        adminCookie = adminRes.headers['set-cookie'];
    } catch (e) {
        console.error("❌ Admin Login failed:", e.response ? e.response.data : e.message);
        process.exit(1);
    }

    // 4. Ban User (as Admin)
    try {
        console.log("\n4. Testing Ban User...");
        const banRes = await axios.post(`${BASE_URL}/api/admin/ban`,
            { username: "testuser_verify" },
            { headers: { Cookie: adminCookie } }
        );
        console.log("✅ Ban success:", banRes.data);
    } catch (e) {
        console.error("❌ Ban failed:", e.response ? e.response.data : e.message);
        process.exit(1);
    }

    // 5. Verify User Login Fails (Banned)
    try {
        console.log("\n5. Verifying Banned User Login...");
        await axios.post(`${BASE_URL}/api/login`, {
            user: "testuser_verify",
            pass: "pass123"
        });
        console.error("❌ Login succeeded but should have failed!");
        process.exit(1);
    } catch (e) {
        if (e.response && e.response.status === 403) {
            console.log("✅ Banned user login blocked correctly (403).");
        } else {
            console.error("❌ Unexpected error:", e.response ? e.response.status : e.message);
            process.exit(1);
        }
    }

    // 6. Unban User (as Admin)
    try {
        console.log("\n6. Testing Unban User...");
        const unbanRes = await axios.post(`${BASE_URL}/api/admin/unban`,
            { username: "testuser_verify" },
            { headers: { Cookie: adminCookie } }
        );
        console.log("✅ Unban success:", unbanRes.data);
    } catch (e) {
        console.error("❌ Unban failed:", e.response ? e.response.data : e.message);
        process.exit(1);
    }

    // 7. Verify User Login Works Again
    try {
        console.log("\n7. Verifying Unbanned User Login...");
        const reloginRes = await axios.post(`${BASE_URL}/api/login`, {
            user: "testuser_verify",
            pass: "pass123"
        });
        console.log("✅ User login working again.");
    } catch (e) {
        console.error("❌ User login failed after unban:", e.response ? e.response.data : e.message);
        process.exit(1);
    }

    // 8. Delete User (Cleanup)
    try {
        console.log("\n8. Testing Delete User...");
        const delRes = await axios.delete(`${BASE_URL}/api/admin/user/testuser_verify`,
            { headers: { Cookie: adminCookie } }
        );
        console.log("✅ Delete success:", delRes.data);
    } catch (e) {
        console.error("❌ Delete failed:", e.response ? e.response.data : e.message);
    }

    console.log("\n🎉 ALL TESTS PASSED!");
}

test();
