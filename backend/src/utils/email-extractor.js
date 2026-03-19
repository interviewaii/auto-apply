const axios = require('axios');
const cheerio = require('cheerio');

/**
 * Robust Email Extractor Utility
 */
class EmailExtractor {
    /**
     * Extracts all valid emails from a given text block using regex.
     * @param {string} text The raw text (e.g., job description)
     * @returns {string[]} Array of unique, valid emails
     */
    static extractEmailsFromText(text) {
        if (!text) return [];

        // Strict email regex - must end in a real TLD (2-6 alpha chars only, no numbers in TLD)
        const emailRegex = /\b([a-zA-Z0-9][a-zA-Z0-9._%+-]{0,63})@([a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*)\.([a-zA-Z]{2,6})\b/g;

        const matches = [];
        let m;
        while ((m = emailRegex.exec(text)) !== null) {
            matches.push(m[0]);
        }

        // Known valid TLDs to allow (reject unusual combos like .compay, .comps, etc.)
        const VALID_TLDS = new Set([
            'com', 'net', 'org', 'io', 'co', 'in', 'us', 'uk', 'ca', 'au', 'de',
            'fr', 'jp', 'br', 'mx', 'ru', 'info', 'biz', 'edu', 'gov', 'mil',
            'tech', 'app', 'dev', 'ai', 'me', 'tv', 'email', 'online', 'work',
            'jobs', 'hr', 'careers', 'sg', 'nz', 'za', 'id', 'ph', 'ae', 'sa'
        ]);

        const filtered = matches.filter(email => {
            const lower = email.toLowerCase();

            // Check the TLD is a known valid one
            const tld = lower.split('.').pop();
            if (!VALID_TLDS.has(tld)) return false;

            // Reject if local part has digits that look like a phone number (6+ digits)
            const local = lower.split('@')[0];
            if (/\d{6,}/.test(local)) return false;

            // Reject if total length is suspiciously long (malformed concatenation)
            if (email.length > 80) return false;

            // Reject obvious system/bot emails
            if (lower.includes('no-reply')) return false;
            if (lower.includes('noreply')) return false;
            if (lower.includes('example.com')) return false;
            if (lower.includes('sentry.io')) return false;
            if (lower.includes('wixpress.com')) return false;
            if (lower.includes('cloudfront.net')) return false;
            if (lower.includes('amazonaws.com')) return false;
            if (lower.includes('privacy@')) return false;
            if (lower.includes('legal@')) return false;
            if (lower.includes('cookie')) return false;

            // Reject if domain part looks like a code file path
            if (lower.endsWith('.js') || lower.endsWith('.css') || lower.endsWith('.png') || lower.endsWith('.jpg')) return false;

            return true;
        });

        // Remove duplicates and return
        return [...new Set(filtered.map(e => e.toLowerCase()))];
    }

    /**
     * Fallback method: Iterates through a company domain to find contact emails.
     * Tries the homepage, /contact, /contact-us, /about, /about-us.
     * @param {string} domain The company domain or URL
     * @returns {Promise<string[]>} Extracted emails
     */
    static async extractEmailsFromWebsite(domain) {
        if (!domain) return [];
        let cleanDomain = domain.toLowerCase().trim();

        // Ensure standard URL format
        if (!cleanDomain.startsWith('http')) {
            cleanDomain = `https://${cleanDomain}`;
        }

        const urlsToTry = [
            cleanDomain,
            `${cleanDomain}/contact`,
            `${cleanDomain}/contact-us`,
            `${cleanDomain}/about`,
            `${cleanDomain}/about-us`,
            `${cleanDomain}/careers`
        ];

        let allExtracted = [];

        // We use a short timeout to prevent hanging the scraper
        const axiosConfig = {
            timeout: 5000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'
            }
        };

        // Process URLs in series to avoid spamming the target server too quickly
        for (const url of urlsToTry) {
            try {
                const response = await axios.get(url, axiosConfig);
                if (response.status === 200 && response.data) {
                    const $ = cheerio.load(response.data);

                    // Remove scripts and styles so we don't pick up garbage
                    $('script, style, noscript').remove();

                    const text = $('body').text() || '';
                    const mailtoLinks = [];

                    // Also check explicitly for mailto: hrefs
                    $('a[href^="mailto:"]').each((i, el) => {
                        const href = $(el).attr('href');
                        if (href) {
                            const emailStr = href.replace('mailto:', '').split('?')[0].trim();
                            if (emailStr) mailtoLinks.push(emailStr);
                        }
                    });

                    const emailsFromText = this.extractEmailsFromText(text);
                    const combined = [...emailsFromText, ...mailtoLinks];

                    // Add to our running list
                    for (const email of combined) {
                        allExtracted.push(email);
                    }

                    // If we found emails, stop checking more pages. We don't want to over-scrape.
                    if (allExtracted.length > 0) {
                        break;
                    }
                }
            } catch (err) {
                // Ignore errors (404s for /contact, timeouts, etc.)
                // console.log(`Could not load ${url}:`, err.message);
            }
        }

        // Return unique, filtered emails
        return [...new Set(allExtracted.map(e => e.toLowerCase()))];
    }
}

module.exports = EmailExtractor;
