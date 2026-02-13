const puppeteer = require("puppeteer");

/**
 * Indeed Job Scraper
 */
class IndeedScraper {
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
        let url = "https://www.indeed.com/jobs?";

        const params = new URLSearchParams();

        if (keywords) {
            params.append("q", keywords);
        }

        if (location) {
            params.append("l", location);
        } else if (remote) {
            params.append("l", "Remote");
        }

        if (remote) {
            params.append("sc", "0kf:attr(DSQF7);"); // Remote filter
        }

        // Posted within: fromage (in days)
        if (postedWithin) {
            params.append("fromage", postedWithin.toString());
        }

        return url + params.toString();
    }

    async extractJobsFromPage() {
        await this.page.waitForSelector('.job_seen_beacon, .jobsearch-SerpJobCard', { timeout: 10000 }).catch(() => null);

        const jobs = await this.page.evaluate(() => {
            const jobCards = document.querySelectorAll('.job_seen_beacon, .jobsearch-SerpJobCard');
            const extracted = [];

            jobCards.forEach((card) => {
                try {
                    const titleEl = card.querySelector('h2.jobTitle a, .jobTitle');
                    const title = titleEl ? titleEl.textContent.trim() : "";

                    const companyEl = card.querySelector('[data-testid="company-name"], .companyName');
                    const company = companyEl ? companyEl.textContent.trim() : "";

                    const locationEl = card.querySelector('[data-testid="text-location"], .companyLocation');
                    const location = locationEl ? locationEl.textContent.trim() : "";

                    const salaryEl = card.querySelector('.salary-snippet, .metadata.salary-snippet-container');
                    const salary = salaryEl ? salaryEl.textContent.trim() : "";

                    const linkEl = card.querySelector('h2.jobTitle a');
                    let url = linkEl ? linkEl.href : "";

                    // Job ID from data attribute or URL
                    let jobId = card.getAttribute("data-jk") || card.getAttribute("data-job-id") || "";
                    if (!jobId && url) {
                        const match = url.match(/jk=([^&]+)/);
                        jobId = match ? match[1] : "";
                    }

                    // Easily Apply detection
                    const easyApply = card.querySelector('.iaLabel, [data-testid="indeedApply"]') !== null;

                    // Remote check
                    const isRemote = location.toLowerCase().includes("remote");

                    // Description snippet
                    const descEl = card.querySelector('.job-snippet');
                    const description = descEl ? descEl.textContent.trim() : "";

                    if (jobId && title) {
                        extracted.push({
                            jobId,
                            title,
                            company,
                            url: url.startsWith("http") ? url : `https://www.indeed.com${url}`,
                            location,
                            salary,
                            easyApply,
                            description,
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
        console.log(`[Indeed] Navigating to: ${searchUrl}`);

        await this.page.goto(searchUrl, { waitUntil: "networkidle2", timeout: 30000 });
        await this.sleep(3000);

        const allJobs = [];
        let currentPage = 1;

        while (currentPage <= maxPages) {
            console.log(`[Indeed] Scraping page ${currentPage}...`);

            const jobs = await this.extractJobsFromPage();
            console.log(`[Indeed] Found ${jobs.length} jobs on page ${currentPage}`);

            allJobs.push(...jobs);

            // Check for next page
            const hasNextPage = await this.page.evaluate(() => {
                const nextButton = document.querySelector('[data-testid="pagination-page-next"], a[aria-label="Next Page"]');
                return nextButton !== null;
            });

            if (!hasNextPage || currentPage >= maxPages) {
                break;
            }

            try {
                await this.page.click('[data-testid="pagination-page-next"], a[aria-label="Next Page"]');
                await this.sleep(3000);
                currentPage++;
            } catch (e) {
                console.error(`[Indeed] Error navigating to next page: ${e.message}`);
                break;
            }
        }

        console.log(`[Indeed] Total jobs scraped: ${allJobs.length}`);

        const jobsWithPlatform = allJobs.map(job => ({ ...job, platform: "indeed" }));

        // Apply strict client-side filtering
        const filteredJobs = this.filterStrictly(jobsWithPlatform, { keywords });
        console.log(`[Indeed] Jobs after strict filtering: ${filteredJobs.length} (out of ${allJobs.length})`);

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
                console.log(`[Indeed Filter] Dropped: "${job.title}" (keywords mismatch: ${keywordTerms.join(", ")})`);
                return false;
            }

            return true;
        });
    }
}

module.exports = IndeedScraper;
