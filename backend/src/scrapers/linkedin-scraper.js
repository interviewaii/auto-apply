const puppeteer = require("puppeteer");
const EmailExtractor = require("../utils/email-extractor");

/**
 * LinkedIn Job Scraper
 * Note: LinkedIn uses aggressive anti-bot measures. The user may need to log in manually once
 * using the UI. This scraper attempts to bypass basic blocks using stealth flags.
 */
class LinkedInScraper {
    constructor(options = {}) {
        this.browser = null;
        this.page = null;
        const isLinux = process.platform === "linux" || !!process.env.RENDER;
        this.headless = (options.headless || isLinux) ? "new" : false;
        this.options = options;
        this.userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async init() {
        if (this.browser) return;

        const path = require("path");
        const userId = this.options.userId || "default";
        const userDataDir = path.join(process.cwd(), "browser_data", String(userId));

        console.log(`[LinkedIn] Initializing browser for user: ${userId}`);

        this.browser = await puppeteer.launch({
            headless: this.headless ? "new" : false,
            userDataDir: userDataDir,
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
            Object.defineProperty(navigator, "webdriver", { get: () => false });
        });
    }

    async close() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            this.page = null;
        }
    }

    buildSearchUrl({ keywords, location }) {
        let url = "https://www.linkedin.com/jobs/search/?";
        const params = new URLSearchParams();

        if (keywords) params.append("keywords", keywords);
        if (location) params.append("location", location);

        // Critical: f_TPR=r86400 filters jobs to "Past 24 Hours" - meaning ONLY latest jobs
        params.append("f_TPR", "r86400");

        return url + params.toString();
    }

    async extractJobsFromPage() {
        // LinkedIn job cards are typically li elements
        await this.page.waitForSelector('.job-search-card, .jobs-search-results__list-item', { timeout: 10000 }).catch(() => null);

        const jobs = await this.page.evaluate(() => {
            const jobCards = document.querySelectorAll('.job-search-card, .jobs-search-results__list-item');
            const extracted = [];

            jobCards.forEach((card) => {
                try {
                    const titleEl = card.querySelector('.base-search-card__title, .job-card-list__title');
                    const title = titleEl ? titleEl.textContent.trim() : "";

                    const companyEl = card.querySelector('.base-search-card__subtitle, .job-card-container__company-name');
                    const company = companyEl ? companyEl.textContent.trim() : "";

                    const locationEl = card.querySelector('.job-search-card__location, .job-card-container__metadata-item');
                    const location = locationEl ? locationEl.textContent.trim() : "";

                    const linkEl = card.querySelector('a.base-card__full-link, a.job-card-list__title');
                    const url = linkEl ? linkEl.href : "";

                    let jobId = card.getAttribute("data-entity-urn") || card.getAttribute("data-job-id") || "";
                    if (!jobId && url) {
                        const match = url.match(/view\/(\d+)/);
                        jobId = match ? match[1] : "";
                    }

                    if (jobId && title) {
                        extracted.push({
                            jobId,
                            title,
                            company,
                            url,
                            location,
                            // LinkedIn public pages often obfuscate descriptions in the main list, 
                            // we will extract what we can from the basic snippet if present
                            description: title + " " + company + " " + location,
                            isRemote: location.toLowerCase().includes('remote')
                        });
                    }
                } catch (e) {
                    console.error("Error extracting job card:", e.message);
                }
            });

            return extracted;
        });

        return jobs;
    }

    async scrapeJobs({ keywords, location, maxPages = 2 }) {
        await this.init();

        const searchUrl = this.buildSearchUrl({ keywords, location });
        console.log(`[LinkedIn] Navigating to: ${searchUrl}`);

        await this.page.goto(searchUrl, { waitUntil: "networkidle2", timeout: 60000 });
        await this.sleep(3000);

        const allJobs = [];
        let currentPage = 1;

        // Note: LinkedIn scroll pagination is complex without login. 
        // For public pages, we scroll down to load more.
        while (currentPage <= maxPages) {
            console.log(`[LinkedIn] Scraping page/scroll ${currentPage}...`);

            // Scroll down a bit to trigger lazy loading
            await this.page.evaluate(() => window.scrollBy(0, document.body.scrollHeight));
            await this.sleep(3000);

            const jobs = await this.extractJobsFromPage();

            // Filter out ones we already have
            const newJobs = jobs.filter(j => !allJobs.some(existing => existing.jobId === j.jobId));
            if (newJobs.length === 0) break; // No more new jobs loaded

            console.log(`[LinkedIn] Found ${newJobs.length} new raw job cards on scroll ${currentPage}`);
            allJobs.push(...newJobs);

            currentPage++;
        }

        console.log(`[LinkedIn] Total jobs scraped: ${allJobs.length}`);

        const jobsWithPlatform = allJobs.map(job => {
            const textToParse = job.description || "";
            return {
                ...job,
                platform: "linkedin",
                extractedEmails: EmailExtractor.extractEmailsFromText(textToParse)
            };
        });

        return jobsWithPlatform;
    }
}

module.exports = LinkedInScraper;
