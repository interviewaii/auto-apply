const puppeteer = require("puppeteer");

/**
 * Naukri.com Job Scraper
 * Scrapes jobs from Naukri.com with filters for remote work and latest postings
 */
class NaukriScraper {
    constructor(options = {}) {
        this.browser = null;
        this.page = null;
        this.headless = options.headless !== undefined ? options.headless : false;
        this.userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    }

    /**
     * Helper to sleep for a given number of milliseconds
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Initialize browser
     */
    async init() {
        if (this.browser) return;

        const path = require("path");
        const userDataDir = path.join(process.cwd(), "browser_data");

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

        // Stealth mode - hide automation indicators
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
        }
    }

    /**
     * Build search URL for Naukri.com
     */
    buildSearchUrl({ keywords, location, experience, remote, postedWithin }) {
        // Base URL
        let url = "https://www.naukri.com/";

        // 1. Determine search slug
        if (keywords && !keywords.includes(",")) {
            // Single search term (can have spaces)
            const slug = keywords.toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
            url += `${slug}-jobs`;
        } else {
            // Multiple terms or no keywords
            url += "jobs";
        }

        // 2. Add Location slug
        if (location) {
            const locSlug = location.toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
            url += `-in-${locSlug}`;
        }

        // 3. Add Query Parameters
        const params = new URLSearchParams();

        if (keywords) {
            params.append("k", keywords);
        }
        if (location) {
            params.append("l", location);
        }
        if (experience) {
            params.append("experience", experience);
        }
        if (remote) {
            params.append("qp", "work_from_home");
        }

        // Add Date Filter (Crucial for freshness)
        if (postedWithin) {
            console.log(`[Naukri] Filtering jobs posted within ${postedWithin} days...`);
            params.append("jobAge", String(postedWithin));
        }

        const qs = params.toString();
        if (qs) {
            url += (url.includes("?") ? "&" : "?") + qs;
        }

        console.log(`[Naukri] Searching: ${url}`);
        return url;
    }

    /**
     * Extract job cards from the current page
     */
    async extractJobsFromPage() {
        // Try multiple selectors for job cards
        const jobCardSelectors = [
            ".cust-job-tuple",
            ".srp-jobtuple-wrapper",
            "[data-job-id]",
            ".list article",
            ".jobTuple"
        ];

        await this.page.waitForSelector(jobCardSelectors.join(","), { timeout: 10000 }).catch(() => null);

        const jobs = await this.page.evaluate((selectors) => {
            // Helper to try multiple selectors on an element
            const getEl = (parent, ...selList) => {
                for (const s of selList) {
                    const el = parent.querySelector(s);
                    if (el) return el;
                }
                return null;
            };

            // Find all potential job cards
            let jobCards = [];
            for (const sel of selectors) {
                const cards = document.querySelectorAll(sel);
                if (cards.length > 0) {
                    jobCards = Array.from(cards);
                    break;
                }
            }

            const extracted = [];

            jobCards.forEach((card) => {
                try {
                    // Job title
                    const titleEl = getEl(card, ".title", "a.title", ".job-title", "h2 a");
                    const title = titleEl ? titleEl.textContent.trim() : "";

                    // Job URL
                    const titleLink = getEl(card, ".title a", "a.title", "a");
                    const url = titleLink ? titleLink.href : "";

                    // Job ID (from URL or data attribute)
                    let jobId = "";
                    if (url) {
                        const match = url.match(/\/job-listings-([^?/]+)/);
                        jobId = match ? match[1] : "";
                    }
                    if (!jobId) {
                        jobId = card.getAttribute("data-job-id") || "";
                    }

                    // Company name
                    const companyEl = getEl(card, ".comp-name", "a.subTitle", ".company-name");
                    const company = companyEl ? companyEl.textContent.trim() : "";

                    // Experience
                    const experienceEl = getEl(card, ".exp", ".experience", ".job-experience");
                    const experience = experienceEl ? experienceEl.textContent.trim() : "";

                    // Salary
                    const salaryEl = getEl(card, ".sal", ".salary", ".job-salary");
                    const salary = salaryEl ? salaryEl.textContent.trim() : "";

                    // Location
                    const locationEl = getEl(card, ".locWdth", ".loc", ".location", ".job-location");
                    const location = locationEl ? locationEl.textContent.trim() : "";

                    // Posted date
                    const postedEl = getEl(card, ".job-post-day", ".date", ".job-date", ".posted-by");
                    const postedDate = postedEl ? postedEl.textContent.trim() : "";

                    // Job description snippet
                    const descEl = getEl(card, ".job-desc", ".job-description", ".ellipsis");
                    const description = descEl ? descEl.textContent.trim() : "";

                    // Tags (remote, urgent, etc.)
                    const tags = [];
                    const tagElements = card.querySelectorAll(".tag-li, .tags li");
                    tagElements.forEach(tag => {
                        tags.push(tag.textContent.trim());
                    });

                    // Check if remote
                    const isRemote = tags.some(tag =>
                        tag.toLowerCase().includes("remote") ||
                        tag.toLowerCase().includes("work from home") ||
                        tag.toLowerCase().includes("wfh")
                    );

                    // Detect application type
                    let applicationType = "auto_apply";
                    const applyBtn = getEl(card, ".apply-button", "#apply-button", "button.apply", ".btn-apply");

                    if (applyBtn) {
                        const btnText = applyBtn.textContent.toLowerCase();
                        const btnHref = applyBtn.href || "";

                        // Check if it's an external redirect
                        if (btnHref && !btnHref.includes('naukri.com')) {
                            applicationType = "external_redirect";
                        }
                        // Check for complex application indicators
                        else if (btnText.includes('register') || btnText.includes('sign up')) {
                            applicationType = "manual_review";
                        }
                    }

                    if (jobId && title) {
                        extracted.push({
                            jobId,
                            title,
                            company,
                            url,
                            experience,
                            salary,
                            location,
                            postedDate,
                            description,
                            tags,
                            isRemote,
                            applicationType,
                        });
                    }
                } catch (e) {
                    console.error("Error extracting job card:", e.message);
                }
            });

            return extracted;
        }, jobCardSelectors);

        return jobs;
    }

    /**
     * Navigate through pages and collect jobs
     */
    async scrapeJobs({ keywords, location, experience, remote = true, postedWithin = 1, maxPages = 5 }) {
        await this.init();

        const searchUrl = this.buildSearchUrl({
            keywords,
            location,
            experience,
            remote,
            postedWithin,
        });

        console.log(`[Naukri] Navigating to: ${searchUrl} `);

        await this.page.goto(searchUrl, { waitUntil: "networkidle2", timeout: 30000 });

        // Wait a bit for dynamic content
        await this.sleep(2000);

        const allJobs = [];
        let currentPage = 1;

        while (currentPage <= maxPages) {
            console.log(`[Naukri] Scraping page ${currentPage}...`);

            const jobs = await this.extractJobsFromPage();
            console.log(`[Naukri] Found ${jobs.length} raw job cards on page ${currentPage} `);

            allJobs.push(...jobs);

            // Check if there's a next page
            const hasNextPage = await this.page.evaluate(() => {
                const nextButton = document.querySelector(".fright");
                return nextButton && !nextButton.classList.contains("disabled");
            });

            if (!hasNextPage || currentPage >= maxPages) {
                break;
            }

            // Click next page
            try {
                await this.page.click(".fright");
                await this.sleep(3000); // Wait for page to load
                currentPage++;
            } catch (e) {
                console.error(`[Naukri] Error navigating to next page: ${e.message} `);
                break;
            }
        }

        console.log(`[Naukri] Total jobs scraped: ${allJobs.length} `);

        // Add platform identifier
        const jobsWithPlatform = allJobs.map(job => ({
            ...job,
            platform: "naukri",
        }));

        // Apply strict client-side filtering
        const filteredJobs = this.filterStrictly(jobsWithPlatform, { keywords, postedWithin });
        console.log(`[Naukri] Jobs after strict filtering: ${filteredJobs.length} (out of ${allJobs.length})`);

        return filteredJobs;
    }

    /**
     * Filter jobs strictly by keywords and date
     */
    filterStrictly(jobs, { keywords, postedWithin }) {
        if (!keywords && !postedWithin) return jobs;

        const keywordTerms = keywords ? keywords.toLowerCase().split(",").map(k => k.trim()).filter(k => k) : [];

        return jobs.filter(job => {
            const title = job.title.toLowerCase();
            const company = job.company.toLowerCase(); // Optional: verify company too? No, mainly title.

            // 1. Keyword Check
            if (keywordTerms.length > 0) {
                // At least one keyword phrase must be present in the title
                const hasKeyword = keywordTerms.some(term => {
                    // Split the term into individual words (e.g. "Java Developer" -> ["Java", "Developer"])
                    const words = term.toLowerCase().split(/\s+/).filter(Boolean);
                    if (words.length === 0) return false;

                    // EVERY word in this term must be found in the title for it to count
                    return words.every(word => {
                        const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                        // Use word boundaries for strict but flexible matching
                        const wordBoundaryRegex = new RegExp(`\\b${escapedWord} \\b`, 'i');
                        if (wordBoundaryRegex.test(title)) return true;
                        // Fallback to simple inclusion for words with special characters like "Node.js"
                        return title.includes(word.toLowerCase());
                    });
                });

                if (!hasKeyword) {
                    console.log(`[Filter] Dropped: "${job.title}"(keywords mismatch: ${keywordTerms.join(", ")})`);
                    return false;
                }
            }

            // 2. Date Check
            if (postedWithin) {
                const daysOld = this.parseDate(job.postedDate);
                if (daysOld > postedWithin) {
                    console.log(`[Filter] Dropped: "${job.title}"(too old: ${daysOld} days > ${postedWithin} days)`);
                    return false;
                }
            }

            return true;
        });
    }

    /**
     * Parse relative date string to days number
     */
    parseDate(dateStr) {
        if (!dateStr) return 0; // Default to 0 (new) if we can't read it, so we don't drop it.
        const s = dateStr.toLowerCase().trim();

        if (s.includes("just now") || s.includes("few hours") || s.includes("today") || s.includes("moment")) return 0;
        if (s.includes("yesterday") || s.includes("1 day")) return 1;

        const match = s.match(/(\d+)\s+days?/);
        if (match) return parseInt(match[1]);

        if (s.includes("30+")) return 31;

        // If it's a month
        const monthMatch = s.match(/(\d+)\s+month?/);
        if (monthMatch) return parseInt(monthMatch[1]) * 30;

        // If we see any number but no "days", it might just be the number of days
        const numMatch = s.match(/^\d+$/);
        if (numMatch) return parseInt(numMatch[0]);

        return 0; // Fallback to 0 so we at least see the job
    }

    /**
     * Get full job details from job page
     */
    async getJobDetails(jobUrl) {
        await this.init();

        console.log(`[Naukri] Fetching job details: ${jobUrl} `);

        await this.page.goto(jobUrl, { waitUntil: "networkidle2", timeout: 30000 });
        await this.sleep(2000);

        const details = await this.page.evaluate(() => {
            const result = {};

            // Full job description
            const descEl = document.querySelector(".dang-inner-html");
            result.fullDescription = descEl ? descEl.textContent.trim() : "";

            // Job requirements
            const reqEl = document.querySelector(".job-desc");
            result.requirements = reqEl ? reqEl.textContent.trim() : "";

            // Company info
            const companyDescEl = document.querySelector(".comp-desc");
            result.companyDescription = companyDescEl ? companyDescEl.textContent.trim() : "";

            return result;
        });

        return details;
    }
}

module.exports = NaukriScraper;
