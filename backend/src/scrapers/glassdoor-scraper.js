const puppeteer = require("puppeteer");

/**
 * Glassdoor Job Scraper
 * Scrapes jobs from Glassdoor with filters
 */
class GlassdoorScraper {
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

    async init() {
        if (this.browser) return;

        const path = require("path");
        const userDataDir = path.join(process.cwd(), "browser_data");

        this.browser = await puppeteer.launch({
            headless: this.headless ? "new" : false,
            userDataDir: userDataDir,
            args: ["--no-sandbox", "--disable-setuid-sandbox", "--start-maximized"],
            defaultViewport: null,
        });

        this.page = await this.browser.newPage();
        await this.page.setUserAgent(this.userAgent);
        await this.page.setViewport({ width: 1366, height: 768 });
    }

    async close() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            this.page = null;
        }
    }

    buildSearchUrl({ keywords, location, remote, postedWithin }) {
        let url = "https://www.glassdoor.com/Job/jobs.htm?";

        const params = new URLSearchParams();

        if (keywords) {
            params.append("sc.keyword", keywords);
        }

        if (location) {
            params.append("locT", "C");
            params.append("locId", location);
        }

        if (remote) {
            params.append("remoteWorkType", "1"); // Remote only
        }

        // Posted within: fromAge (in days)
        if (postedWithin) {
            params.append("fromAge", postedWithin.toString());
        }

        return url + params.toString();
    }

    async extractJobsFromPage() {
        await this.page.waitForSelector('[data-test="jobListing"]', { timeout: 10000 }).catch(() => null);

        const jobs = await this.page.evaluate(() => {
            const jobCards = document.querySelectorAll('[data-test="jobListing"]');
            const extracted = [];

            jobCards.forEach((card) => {
                try {
                    const titleEl = card.querySelector('[data-test="job-title"]');
                    const title = titleEl ? titleEl.textContent.trim() : "";

                    const companyEl = card.querySelector('[data-test="employer-name"]');
                    const company = companyEl ? companyEl.textContent.trim() : "";

                    const locationEl = card.querySelector('[data-test="emp-location"]');
                    const location = locationEl ? locationEl.textContent.trim() : "";

                    const salaryEl = card.querySelector('[data-test="salary-estimate"]');
                    const salary = salaryEl ? salaryEl.textContent.trim() : "";

                    const linkEl = card.querySelector('a[data-test="job-link"]');
                    const url = linkEl ? linkEl.href : "";

                    // Extract job ID from URL or data attribute
                    let jobId = card.getAttribute("data-id") || "";
                    if (!jobId && url) {
                        const match = url.match(/jobListingId=(\d+)/);
                        jobId = match ? match[1] : "";
                    }

                    // Check for Easy Apply badge
                    const easyApply = card.querySelector('[data-test="easy-apply-button"]') !== null;

                    // Check tags for remote
                    const tags = [];
                    const tagElements = card.querySelectorAll('[data-test="job-badge"]');
                    tagElements.forEach(tag => tags.push(tag.textContent.trim()));

                    const isRemote = location.toLowerCase().includes("remote") ||
                        tags.some(t => t.toLowerCase().includes("remote"));

                    if (jobId && title) {
                        extracted.push({
                            jobId,
                            title,
                            company,
                            url,
                            location,
                            salary,
                            easyApply,
                            tags,
                            isRemote,
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

    async scrapeJobs({ keywords, location, remote = true, postedWithin = 1, maxPages = 5 }) {
        await this.init();

        const searchUrl = this.buildSearchUrl({ keywords, location, remote, postedWithin });
        console.log(`[Glassdoor] Navigating to: ${searchUrl}`);

        await this.page.goto(searchUrl, { waitUntil: "networkidle2", timeout: 30000 });
        await this.sleep(3000);

        const allJobs = [];
        let currentPage = 1;

        while (currentPage <= maxPages) {
            console.log(`[Glassdoor] Scraping page ${currentPage}...`);

            const jobs = await this.extractJobsFromPage();
            console.log(`[Glassdoor] Found ${jobs.length} jobs on page ${currentPage}`);

            allJobs.push(...jobs);

            // Check for next page
            const hasNextPage = await this.page.evaluate(() => {
                const nextButton = document.querySelector('[data-test="pagination-next"]');
                return nextButton && !nextButton.hasAttribute("disabled");
            });

            if (!hasNextPage || currentPage >= maxPages) {
                break;
            }

            try {
                await this.page.click('[data-test="pagination-next"]');
                await this.sleep(3000);
                currentPage++;
            } catch (e) {
                console.error(`[Glassdoor] Error navigating to next page: ${e.message}`);
                break;
            }
        }

        console.log(`[Glassdoor] Total jobs scraped: ${allJobs.length}`);

        const jobsWithPlatform = allJobs.map(job => ({ ...job, platform: "glassdoor" }));

        // Apply strict client-side filtering
        const filteredJobs = this.filterStrictly(jobsWithPlatform, { keywords });
        console.log(`[Glassdoor] Jobs after strict filtering: ${filteredJobs.length} (out of ${allJobs.length})`);

        return filteredJobs;
    }

    /**
     * Filter jobs strictly by keywords
     */
    filterStrictly(jobs, { keywords }) {
        if (!keywords) return jobs;

        const keywordTerms = keywords.toLowerCase().split(",").map(k => k.trim()).filter(k => k);

        return jobs.filter(job => {
            const title = job.title.toLowerCase();

            // At least one keyword phrase must be present in the title
            const hasKeyword = keywordTerms.some(term => {
                const words = term.toLowerCase().split(/\s+/).filter(Boolean);
                if (words.length === 0) return false;
                return words.every(word => {
                    const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const wordBoundaryRegex = new RegExp(`\\b${escapedWord}\\b`, 'i');
                    if (wordBoundaryRegex.test(title)) return true;
                    return title.includes(word.toLowerCase());
                });
            });

            if (!hasKeyword) {
                console.log(`[Glassdoor Filter] Dropped: "${job.title}" (keywords mismatch: ${keywordTerms.join(", ")})`);
                return false;
            }

            return true;
        });
    }
}

module.exports = GlassdoorScraper;
