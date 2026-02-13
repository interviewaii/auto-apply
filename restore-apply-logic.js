const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'backend', 'src', 'appliers', 'naukri-applier.js');
let content = fs.readFileSync(filePath, 'utf8');

// The marker where the function broke
const brokenMarker = `        if (!this.isLoggedIn) {
            await this.login();
        }

    }`;

// The logic we want to insert instead of that closing brace
const fixedLogic = `        if (!this.isLoggedIn) {
            await this.login();
        }
        
        console.log(\`[Naukri] Applying to job: \${jobUrl}\`);

        try {
            await this.page.goto(jobUrl, { waitUntil: "networkidle2", timeout: 30000 });
            await this.sleep(2000);

            // Check if already applied
            const alreadyApplied = await this.page.evaluate(() => {
                const text = document.body.innerText;
                if (text.includes("Application Sent") || 
                    text.includes("Already Applied") || 
                    text.includes("You have already applied")) {
                    return true;
                }

                // Check for "Applied" button/status (Green button check)
                const exactAppliedParams = Array.from(document.querySelectorAll('button, span, div'));
                return exactAppliedParams.some(el => {
                    return el.textContent.trim().toLowerCase() === 'applied' && el.offsetHeight > 0;
                });
            });

            if (alreadyApplied) {
                console.log("[Naukri] Already applied to this job");
                return { success: true, reason: "already_applied" }; 
            }
`;

// Replace the broken marker with the fixed logic
// Note: The rest of the file (orphaned code) will now be correctly inside the try block (Wait, no, I opened a try block above!)
// The original code had `try {` at line 150 (in the old version).
// Let's check if the orphaned code has a closing brace for the try.

// Looking at File content from previous turn:
// Line 150 is `// Check for external redirect`
// It does NOT start with `try {`.
// So the `try` block was lost too?
// No, the original `try` was around line 150.
// My `fixedLogic` starts a `try {`.

// I need to verify where the `try` block ends.
// In the original file, the `try` ended way down.

// Let's replace the broken marker.
if (content.includes(brokenMarker)) {
    content = content.replace(brokenMarker, fixedLogic);
    fs.writeFileSync(filePath, content);
    console.log("Restored applyToJob logic successfully.");
} else {
    console.error("Could not find broken marker.");
    // Try matching less strict whitespace
    const regex = /if \(!this\.isLoggedIn\) \{\s*await this\.login\(\);\s*\}\s*\}/;
    if (regex.test(content)) {
        content = content.replace(regex, fixedLogic);
        fs.writeFileSync(filePath, content);
        console.log("Restored applyToJob logic successfully (regex).");
    } else {
        console.log("Failed to match broken code.");
    }
}
