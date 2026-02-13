const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'backend', 'src', 'appliers', 'naukri-applier.js');
let content = fs.readFileSync(filePath, 'utf8');

// The new login function body
const newLoginFn = `    async login() {
        if (this.isLoggedIn) return true;

        await this.init();

        try {
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

// Find start of login function
const loginStart = content.indexOf('async login() {');
if (loginStart === -1) {
    console.error('Could not find login function');
    process.exit(1);
}

// Find start of next function (applyToJob)
// Note: Based on file inspection, it takes jobUrl as argument
const applyToJobStart = content.indexOf('async applyToJob(jobUrl) {');
if (applyToJobStart === -1) {
    // Fallback if that fails, try simpler
    const simplerSearch = content.indexOf('applyToJob');
    if (simplerSearch !== -1) {
        console.log("Found applyToJob via simpler search");
        // Find the next opening brace after this
        const braceIdx = content.indexOf('{', simplerSearch);
        // Find the start of the line containing applyToJob as a safe bet? No, index needs to be start of function def.
        // Let's assume the simpler search found the start of the identifier.
        // But we need the start of the async.
    }

    console.error('Could not find applyToJob function with signature async applyToJob(jobUrl) {');
    // Try dumping a snippet to see what's there if failed
    console.log("Snippet around expected location:");
    console.log(content.substring(content.indexOf('login') + 5000, content.indexOf('login') + 6000));
    process.exit(1);
}

// Find the last closing brace before applyToJob
const contentBeforeApply = content.substring(0, applyToJobStart);
const loginEnd = contentBeforeApply.lastIndexOf('}');

if (loginEnd === -1 || loginEnd < loginStart) {
    console.error('Could not find end of login function');
    process.exit(1);
}

// Construct new content: everything before login + newLogin + everything after login (starting from the brace)
const newContent = content.substring(0, loginStart) + newLoginFn + "\n\n" + content.substring(loginEnd + 1);

fs.writeFileSync(filePath, newContent);
console.log('Successfully updated login function in naukri-applier.js');
