const puppeteer = require("puppeteer");
const { answerChatbotQuestion } = require("../ai");

/**
 * Naukri.com Auto-Applier
 * Automatically applies to jobs on Naukri.com
 */
class NaukriApplier {
    constructor(options = {}) {
        this.browser = null;
        this.page = null;
        this.headless = options.headless !== undefined ? options.headless : false;
        this.userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

        // Multi-user context
        this.userId = options.userId || "default";
        this.credentials = options.credentials || {}; // { username, password }

        this.isLoggedIn = false;
    }

    /**
     * Helper to sleep for a given number of milliseconds
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Initialize browser with user isolation
     */
    async init() {
        if (this.browser) return;

        const path = require("path");
        // Isolated browser data per user
        const userDataDir = path.join(process.cwd(), "browser_data", String(this.userId));
        console.log(`[NaukriApplier] Initializing browser for user: ${this.userId}`);

        this.browser = await puppeteer.launch({
            headless: this.headless ? "new" : false,
            userDataDir: userDataDir,
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
            args: [
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-blink-features=AutomationControlled",
                "--start-maximized"
            ],
            defaultViewport: null,
        });

        this.page = await this.browser.newPage();
        await this.page.setUserAgent(this.userAgent);
        await this.page.setViewport({ width: 1366, height: 768 });

        // Stealth mode
        await this.page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, "webdriver", {
                get: () => false,
            });
        });
    }

    /**
     * Close browser
     */
    async close() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            this.page = null;
            this.isLoggedIn = false;
        }
    }

    /**
     * Login to Naukri account using stored credentials if available
     */
    async login() {
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
                console.log(`[Naukri] Session found for user ${this.userId}! Already logged in.`);
                this.isLoggedIn = true;
                return true;
            }

            console.log(`[Naukri] Session not found for user ${this.userId}. Attempting login...`);

            // Auto-login if credentials provided
            if (this.credentials.username && this.credentials.password) {
                await this.page.goto("https://www.naukri.com/nlogin/login", { waitUntil: "domcontentloaded", timeout: 30000 });

                console.log(`[Naukri] Auto-filling credentials for ${this.credentials.username}`);

                await this.page.waitForSelector('#usernameField', { timeout: 5000 });
                await this.page.type('#usernameField', this.credentials.username, { delay: 50 });

                await this.page.waitForSelector('#passwordField', { timeout: 5000 });
                await this.page.type('#passwordField', this.credentials.password, { delay: 50 });

                await this.page.click('button[type="submit"]');
                try {
                    // Optimized wait: Don't wait for network idle (too slow due to ads)
                    await this.page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 });
                } catch (e) {
                    // Ignore navigation timeout, check for element instead
                }

                // Explicitly wait for success indicator or failure
                try {
                    await this.page.waitForFunction(
                        () => document.body.innerText.toLowerCase().includes('my naukri') ||
                            document.body.innerText.toLowerCase().includes('view profile'),
                        { timeout: 5000 }
                    );
                } catch (e) { }

                // Re-check login
                const loginSuccess = await this.page.evaluate(() => {
                    const bodyText = document.body.innerText.toLowerCase();
                    return bodyText.includes('my naukri') || bodyText.includes('view profile') || document.querySelector(".nI-gNb-drawer__icon") !== null;
                });

                if (loginSuccess) {
                    console.log("[Naukri] Auto-login successful!");
                    this.isLoggedIn = true;
                    return true;
                } else {
                    console.error("[Naukri] Auto-login failed. Falling back to manual.");
                }
            }

            console.log("=================================================");
            console.log(` PLEASE LOG IN MANUALLY FOR USER ${this.userId} `);
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
    }



    /**
     * Apply to a job
     */
    async applyToJob(jobUrl) {
        await this.init();

        if (!this.isLoggedIn) {
            await this.login();
        }

        console.log(`[Naukri] Applying to job: ${jobUrl}`);

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


            // Check for external redirect (Apply on company site)
            const isExternal = await this.page.evaluate(() => {
                const buttons = Array.from(document.querySelectorAll('button, a'));
                return buttons.some(btn =>
                (btn.textContent && (
                    btn.textContent.toLowerCase().includes('apply on company site') ||
                    btn.textContent.toLowerCase().includes('company website')
                ))
                );
            });

            if (isExternal) {
                console.log("[Naukri] Job requires application on company site (External Redirect). Skipping.");
                // Capture URL before returning
                const extUrl = await this.page.evaluate(() => {
                    const buttons = Array.from(document.querySelectorAll('button, a'));
                    const btn = buttons.find(btn =>
                    (btn.textContent && (
                        btn.textContent.toLowerCase().includes('apply on company site') ||
                        btn.textContent.toLowerCase().includes('company website')
                    ))
                    );
                    return (btn && btn.tagName === 'A') ? btn.href : null;
                });

                console.log(`[Naukri] External URL found: ${extUrl || "None"}`);
                return { success: false, reason: "external_redirect", url: extUrl };
            }

            // Find and click the Apply button with comprehensive selectors
            const applyButtonSelectors = [
                "#apply-button",
                ".apply-button",
                ".apply-btn",
                "#applyBtn",
                'button[id*="apply"]',
                'button[class*="apply"]',
                '.premium-apply',
                '.btn-apply',
                'button.btn-primary',
                'a.apply-button',
                'a[class*="apply"]'
            ];

            let applyClicked = false;
            let triedSelectors = [];

            // First try CSS selectors
            for (const selector of applyButtonSelectors) {
                try {
                    const button = await this.page.$(selector);
                    if (button) {
                        const isVisible = await button.evaluate(el => {
                            return el.offsetParent !== null && !el.disabled;
                        });

                        if (isVisible) {
                            console.log(`[Naukri] Found Apply button with selector: ${selector}`);
                            await button.click();
                            applyClicked = true;
                            break;
                        } else {
                            triedSelectors.push(`${selector} (not visible)`);
                        }
                    } else {
                        triedSelectors.push(`${selector} (not found)`);
                    }
                } catch (e) {
                    triedSelectors.push(`${selector} (error: ${e.message})`);
                }
            }

            // If no button found, try text-based search
            if (!applyClicked) {
                console.log("[Naukri] Trying text-based Apply button search...");
                applyClicked = await this.page.evaluate(() => {
                    const buttons = Array.from(document.querySelectorAll('button, a'));
                    const applyButton = buttons.find(btn => {
                        const text = btn.textContent.trim().toLowerCase();
                        return text === 'apply' || text === 'apply now' || text.includes('apply for this job');
                    });

                    if (applyButton && applyButton.offsetParent !== null) {
                        applyButton.click();
                        return true;
                    }
                    return false;
                });

                if (applyClicked) {
                    console.log("[Naukri] Found Apply button via text search");
                }
            }

            if (!applyClicked) {
                console.log(`[Naukri] No Apply button found. Tried selectors:`, triedSelectors);
                return { success: false, reason: "no_apply_button" };
            }

            // Wait for application modal/popup or chatbot (increased wait time)
            await this.sleep(6000);

            // Special handling for Naukri Chatbot
            const isChatbot = await this.page.evaluate(() => {
                const selectors = ['.chatbot_wrapper', '.chat-container', '#chat-container', '.send-msg-btn'];
                const hasChatSelectors = selectors.some(s => document.querySelector(s) !== null);
                const text = document.body.innerText;
                return hasChatSelectors || (text.includes('Hi') && text.includes('thank you for showing interest'));
            });

            if (isChatbot) {
                console.log("[Naukri] Chatbot application detected - answering questions...");

                // Don't click the chatbot popup - it might close it!
                // Just wait for it to be ready
                await this.sleep(3000); // Wait for chatbot to fully load
                console.log("[Naukri] Waiting for chatbot to be ready...");

                // CRITICAL: Check if chatbot is inside an iframe
                let chatFrame = this.page; // Default to main page
                try {
                    const frames = this.page.frames();
                    console.log(`[Naukri] Found ${frames.length} frames on page`);
                    for (const frame of frames) {
                        try {
                            const hasChatInput = await frame.evaluate(() => {
                                // Check for common chat elements
                                return document.querySelector('.chatbot_wrapper, .chat-container, .send-msg-btn, [class*="chat-input"]') !== null;
                            });
                            if (hasChatInput) {
                                chatFrame = frame;
                                console.log(`[Naukri] Found chatbot inside iframe! Switching to iframe context.`);
                                break;
                            }
                        } catch (frameErr) {
                            // Frame may not be accessible
                        }
                    }
                } catch (frameDetectErr) {
                    console.log(`[Naukri] Frame detection error: ${frameDetectErr.message}`);
                }

                // MANUAL CHATBOT MODE (User Request)
                console.log('[Naukri] Chatbot detected. Auto-answering DISABLED.');
                console.log('[Naukri] Please answer manually and click Save/Submit.');

                // Observation Loop: Wait for user to finish
                for (let w = 0; w < 60; w++) { // 5 minutes max
                    await this.sleep(5000);
                    try {
                        // Check Chat Frame
                        const frameText = await chatFrame.evaluate(() => document.body.innerText.toLowerCase()).catch(() => '');
                        if (frameText.includes('application sent') || frameText.includes('successfully applied') || frameText.includes('thank you') || frameText.includes('already applied')) {
                            console.log('[Naukri] Success detected in chatbot!');
                            return { success: true, reason: 'manual_chat_success' };
                        }
                        // Check Main Page Content (Broad Check for Success Screen)
                        const mainText = await this.page.evaluate(() => document.body.innerText.toLowerCase()).catch(() => '');
                        if (mainText.includes('applied to') || mainText.includes('successfully applied') || mainText.includes('application sent')) {
                            console.log('[Naukri] Main page indicated Success!');
                            return { success: true, reason: 'manual_main_success' };
                        }
                    } catch (e) { /* Frame detached? Continue waiting */ }
                    console.log(`[Naukri] Waiting for manual completion... ${(w + 1) * 5}s`);
                }

                console.log('[Naukri] Timeout waiting for manual completion.');
                return { success: false, reason: 'manual_timeout' };
            }

            // Fallback: Check for success message if not a chatbot or chatbot didn't return
            const finalSuccess = await this.page.evaluate(() => {
                const text = document.body.innerText.toLowerCase();
                return text.includes('applied to') ||
                    text.includes('successfully applied') ||
                    text.includes('application sent') ||
                    text.includes('already applied');
            });

            if (finalSuccess) {
                console.log('[Naukri] Success detected (standard flow).');
                return { success: true, reason: 'standard_success' };
            }

            // If we clicked apply but couldn't verify, return ambiguous success or strict failure?
            // For now, let's return false to be safe, or check button state again?
            console.log('[Naukri] Apply clicked but verification failed. Assuming review needed.');
            return { success: false, reason: 'verification_failed' };

        } catch (error) {
            console.error(`[Naukri] Apply error: ${error.message}`);
            return { success: false, reason: "error", error: error.message };
        }
    }

    /**
     * Apply to multiple jobs
     */
    async applyToJobs(jobs, { delay = 8000, onProgress = null } = {}) {
        const results = [];

        for (let i = 0; i < jobs.length; i++) {
            const job = jobs[i];
            console.log(`[Naukri] Processing job ${i + 1}/${jobs.length}: ${job.title}`);

            try {
                const result = await this.applyToJob(job.url);
                results.push({
                    jobId: job.jobId,
                    title: job.title,
                    company: job.company,
                    ...result,
                });

                if (onProgress) {
                    onProgress({
                        current: i + 1,
                        total: jobs.length,
                        job,
                        result,
                    });
                }

                // Delay between applications (human-like behavior)
                if (i < jobs.length - 1) {
                    console.log(`[Naukri] Waiting ${delay}ms before next application...`);
                    await this.sleep(delay);
                }
            } catch (error) {
                console.error(`[Naukri] Error applying to job ${job.jobId}:`, error.message);
                results.push({
                    jobId: job.jobId,
                    title: job.title,
                    company: job.company,
                    success: false,
                    reason: "error",
                    error: error.message,
                });
            }
        }

        return results;
    }
}

module.exports = NaukriApplier;



