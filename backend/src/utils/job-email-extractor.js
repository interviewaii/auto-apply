/**
 * Job Board Email Extractor
 * 
 * Given a list of job objects (with url, company, title),
 * this utility deep-scrapes each job's detail page for an email,
 * then falls back to scraping the company's website.
 */

const axios = require('axios');
const cheerio = require('cheerio');
const EmailExtractor = require('./email-extractor');

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * Try to fetch a page with axios and extract emails from its HTML
 */
async function fetchAndExtract(url, timeoutMs = 6000) {
    try {
        const res = await axios.get(url, {
            timeout: timeoutMs,
            headers: {
                'User-Agent': USER_AGENT,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            },
            maxRedirects: 3
        });
        if (!res.data) return [];
        const $ = cheerio.load(res.data);

        // Collect mailto links first (most reliable)
        const mailtoEmails = [];
        $('a[href^="mailto:"]').each((i, el) => {
            const href = $(el).attr('href') || '';
            const email = href.replace('mailto:', '').split('?')[0].trim().toLowerCase();
            if (email) mailtoEmails.push(email);
        });

        // Remove script/style noise then read all visible text
        $('script, style, noscript, svg').remove();
        const text = $('body').text() || '';
        const textEmails = EmailExtractor.extractEmailsFromText(text);

        return [...new Set([...mailtoEmails, ...textEmails])];
    } catch (e) {
        return [];
    }
}

/**
 * Guess likely company domains from the company name
 * e.g. "Tata Consultancy Services" -> ["tcs.com", "tataconsultancy.com"]
 */
function guessCompanyDomains(companyName) {
    if (!companyName) return [];
    const clean = companyName.toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .trim();
    // Try single-word, combined, and abbreviated versions
    const words = clean.split(/\s+/).filter(Boolean);
    const domains = new Set();

    // Full joined: "tataconsultancyservices.com"
    domains.add(`${words.join('')}.com`);

    // First word: "tata.com"
    if (words[0]) domains.add(`${words[0]}.com`);

    // First two words combined: "tataconsultancy.com"
    if (words.length >= 2) domains.add(`${words[0]}${words[1]}.com`);

    // Initials (for 2+ word names): "tcs.com"
    if (words.length >= 2) {
        const initials = words.map(w => w[0]).join('');
        domains.add(`${initials}.com`);
    }

    return [...domains];
}

/**
 * Deep extract emails for a given job object.
 * Strategy:
 *  1. Try the job's detail page URL
 *  2. Try guessed company domains via extractEmailsFromWebsite
 */
async function deepExtractForJob(job) {
    const results = [];

    // Step 1: Visit the job detail page
    if (job.url && job.url.startsWith('http')) {
        const found = await fetchAndExtract(job.url, 8000);
        results.push(...found);
    }

    if (results.length > 0) {
        return [...new Set(results)];
    }

    // Step 2: Fallback — use the EmailExtractor's website scraper with guessed domains
    const domains = guessCompanyDomains(job.company || '');
    for (const domain of domains.slice(0, 3)) {
        const found = await EmailExtractor.extractEmailsFromWebsite(domain);
        if (found.length > 0) {
            results.push(...found);
            break; // Stop at first successful domain
        }
    }

    return [...new Set(results)];
}

/**
 * Process a list of jobs with deep email extraction.
 * Jobs are processed in parallel batches of `concurrency` at a time.
 * @param {Object[]} jobs - Array of job objects (url, company, title)
 * @param {Object} opts
 * @param {number} opts.concurrency - How many jobs to process in parallel (default 5)
 * @param {Function} opts.onResult - Called immediately when a job is done: (jobResult, done, total)
 * @returns {Object[]} Jobs with extractedEmails filled in
 */
async function deepExtractEmails(jobs, opts = {}) {
    const concurrency = opts.concurrency || 5;
    const onResult = opts.onResult;
    const results = new Array(jobs.length);
    let completed = 0;

    // Process jobs in parallel chunks
    for (let i = 0; i < jobs.length; i += concurrency) {
        const batch = jobs.slice(i, i + concurrency);
        await Promise.all(batch.map(async (job, batchIdx) => {
            const globalIdx = i + batchIdx;
            console.log(`[EmailExtract] Processing job ${globalIdx + 1}/${jobs.length}: ${job.title} @ ${job.company}`);

            const emails = await deepExtractForJob(job);

            if (emails.length > 0) {
                console.log(`[EmailExtract] ✅ Found ${emails.length} email(s): ${emails.join(', ')}`);
            } else {
                console.log(`[EmailExtract] ❌ No emails found`);
            }

            const result = { ...job, extractedEmails: emails };
            results[globalIdx] = result;
            completed++;

            if (typeof onResult === 'function') {
                onResult(result, completed, jobs.length);
            }
        }));
    }

    return results.filter(Boolean);
}

module.exports = { deepExtractEmails, deepExtractForJob };
