const NaukriScraper = require("./src/scrapers/naukri-scraper");
const fs = require("fs");

async function testScraper() {
    console.log("Starting scraper debug...");
    const scraper = new NaukriScraper({ headless: false });

    try {
        await scraper.init();
        const page = scraper.page;

        // Go to a simple search page
        console.log("Navigating to search page...");
        await page.goto("https://www.naukri.com/mern-stack-developer-jobs?k=mern%20stack%20developer", { waitUntil: "networkidle2", timeout: 60000 });

        console.log("Waiting for content...");
        await page.waitForTimeout(5000); // Using the sleep helper would be better but this is raw puppeteer usage if scraper methods aren't used directly for navigation
        // Actually, scraper.init() sets up this.page.

        // Let's use the scraper's extract method if possible, or just manual check
        console.log("Checking selectors...");

        const jobCount = await page.evaluate(() => {
            return document.querySelectorAll(".cust-job-tuple").length;
        });

        console.log(`Found ${jobCount} .cust-job-tuple elements.`);

        if (jobCount === 0) {
            console.log("No jobs found with .cust-job-tuple. Dumping HTML to debug-scraper.html...");
            const html = await page.content();
            fs.writeFileSync("debug-scraper.html", html);

            // Try to find ANY job lists
            const classes = await page.evaluate(() => {
                const divs = Array.from(document.querySelectorAll('div[class*="job"], div[class*="tuple"]'));
                return divs.map(d => d.className).slice(0, 20);
            });
            console.log("Potential job classes found:", classes);
        }

    } catch (error) {
        console.error("Scraper failed with error:", error.message);
        console.error(error.stack);
    } finally {
        if (scraper) await scraper.close();
    }
}

testScraper();
