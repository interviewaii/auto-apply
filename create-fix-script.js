const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'backend', 'src', 'appliers', 'naukri-applier.js');
let content = fs.readFileSync(filePath, 'utf8');

// Find start of login function
const loginStart = content.indexOf('async login() {');
if (loginStart === -1) {
    console.error('Could not find login function');
    process.exit(1);
}

// Find the end of the class to ensure we don't go too far, but we need the end of the login function.
// Login function ends before "async applyToJob(job) {"
const applyToJobStart = content.indexOf('async applyToJob(job) {');
if (applyToJobStart === -1) {
    console.error('Could not find applyToJob function');
    process.exit(1);
}

// Find the last closing brace before applyToJob
const contentBeforeApply = content.substring(0, applyToJobStart);
const loginEnd = contentBeforeApply.lastIndexOf('}');

if (loginEnd === -1 || loginEnd < loginStart) {
    console.error('Could not find end of login function');
    process.exit(1);
}

const newLoginBody = `    async login() {
        if (this.isLoggedIn) return true;

        await this.init();

        try {
            console.log("[Naukri] Checking session...");
            // Visit homepage first
            await this.page.goto("https://www.naukri.com/", { waitUntil: "networkidle2", timeout: 30000 });

            // Check if already logged in (passive check)
            const isLoggedIn = await this.page.evaluate(() => {
                const hasProfile = document.querySelector(".nI-gNb-drawer__icon, .user-name, a[href*='profile'], a[href*='mnjuser'], .view-profile") !== null;
                const bodyText = document.body.innerText.toLowerCase();
                const hasMyNaukri = bodyText.includes('my naukri') || bodyText.includes('view profile');
                return hasProfile || hasMyNaukri;
            });

            if (isLoggedIn) {
                console.log("[Naukri] Session found! Already logged in.");
                this.isLoggedIn = true;
                return true;
            }

            console.log("[Naukri] Session not found. Switching to MANUAL LOGIN mode...");
            await this.page.goto("https://www.naukri.com/nlogin/login", {
                waitUntil: "domcontentloaded",
                timeout: 60000
            });
            
            console.log("=================================================");
            console.log(" PLEASE LOG IN MANUALLY IN THE BROWSER WINDOW NOW ");
            console.log("=================================================");
            
            // Wait up to 5 minutes
            const startTime = Date.now();
            while (Date.now() - startTime < 300000) {
                 const isLoggedInNow = await this.page.evaluate(() => {
                    const hasProfile = document.querySelector(".nI-gNb-drawer__icon, .user-name, a[href*='profile'], a[href*='mnjuser'], .view-profile") !== null;
                    const bodyText = document.body.innerText.toLowerCase();
                    const hasMyNaukri = bodyText.includes('my naukri') || bodyText.includes('view profile');
                    return hasProfile || hasMyNaukri;
                });

                if (isLoggedInNow) {
                     console.log("[Naukri] Manual login detected! Proceeding.");
                     this.isLoggedIn = true;
                     return true;
                }
                await this.sleep(2000);
            }
            
            console.log("[Naukri] Login timeout. Proceeding, but applications may fail if not logged in.");
            this.isLoggedIn = true;
            return true;
        } catch (error) {
            console.error("[Naukri] Login check error:", error.message);
            // Default to true to not block application attempts
            this.isLoggedIn = true;
            return true;
        }
    }`;

// Replace the content
const newContent = content.substring(0, loginStart) + newLoginBody + content.substring(loginEnd + 1);
fs.writeFileSync(filePath, newContent);
console.log('Successfully replaced login function');
`;

fs.writeFileSync('fix-naukri-login.js', script);
