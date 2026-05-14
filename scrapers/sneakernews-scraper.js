/**
 * ============================================================================
 * SNEAKERNEWS.COM SCRAPER
 * ============================================================================
 * 
 * Scrapes news articles from SneakerNews.com
 * Extracts: title, image, url, category, publish date, author, excerpt
 * 
 * Usage:
 *   const sneakerNewsScraper = require('./sneakernews-scraper');
 *   sneakerNewsScraper.getLatestNews((err, articles) => { ... });
 *   sneakerNewsScraper.getPopularNews((err, articles) => { ... });
 *   sneakerNewsScraper.getCategoryNews('releases', (err, articles) => { ... });
 * 
 * ============================================================================
 */

const axios = require('axios');
const cheerio = require('cheerio');

// ── RSS helpers ───────────────────────────────────────────────────────────────

/**
 * Fetch and parse an RSS/Atom feed, returning a normalised article array.
 * Uses cheerio in xml mode — works for both RSS 2.0 and Atom.
 */
const fetchRss = async (feedUrl, source, type) => {
    const res = await axios.get(feedUrl, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept': 'application/rss+xml, application/xml, text/xml, */*',
        },
        timeout: 10000,
    });

    const $ = cheerio.load(res.data, { xmlMode: true });
    const articles = [];

    $('item').each(function () {
        const title = $(this).find('title').first().text().trim();
        const url = $(this).find('link').first().text().trim() ||
            $(this).find('guid').first().text().trim();
        const date = $(this).find('pubDate').first().text().trim() ||
            $(this).find('dc\\:date').first().text().trim();
        // excerpt: strip HTML tags and the WordPress copyright footer
        const rawDesc = $(this).find('description').first().text();
        const excerpt = rawDesc
            .replace(/<[^>]+>/g, '')
            .replace(/©.*$/s, '')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 200);

        // image: try media:content/enclosure first, then extract from content:encoded CDATA
        let image = $(this).find('media\\:content').attr('url') ||
            $(this).find('enclosure[type^="image"]').attr('url') || null;
        if (!image) {
            const contentHtml = $(this).find('content\\:encoded').first().text();
            // prefer src= on wp-content images (width-1200 or largest srcset candidate)
            const srcsetMatch = contentHtml.match(/src="(https?:\/\/[^"]+\.(?:jpg|jpeg|png|webp|gif))"/i);
            if (srcsetMatch) image = srcsetMatch[1];
        }

        // derive category from <category> tag
        const category = $(this).find('category').first().text().trim() || 'Sneakers';

        if (title && url) {
            articles.push({ title, image, url, category, publishedAt: date || null, excerpt, source, type });
        }
    });

    return articles;
};

// ── Exported functions ────────────────────────────────────────────────────────

/**
 * Get Latest News Articles — via SneakerNews RSS feed (no scraping, no 403)
 */
const getLatestNews = async (callback) => {
    try {
        const articles = await fetchRss('https://sneakernews.com/feed/', 'SneakerNews', 'latest');
        callback(null, articles);
    } catch (error) {
        console.error('Error fetching SneakerNews RSS:', error.message);
        callback(error, []);
    }
};

/**
 * Get Popular News Articles — reuses latest RSS (no separate popular feed exists)
 */
const getPopularNews = async (callback) => {
    try {
        const articles = await fetchRss('https://sneakernews.com/feed/', 'SneakerNews', 'popular');
        callback(null, articles);
    } catch (error) {
        console.error('Error fetching SneakerNews popular RSS:', error.message);
        callback(error, []);
    }
};

/**
 * Get News Articles by Category
 * 
 * Scrapes articles from specific category pages
 * Tries multiple URL patterns: /tag/, /category/, and brand-specific pages
 * 
 * @param {String} category - Category name (e.g., 'releases', 'jordan', 'nike')
 * @param {Function} callback - Callback function (error, articles)
 */
const getCategoryNews = async (category, callback) => {
    // Try multiple URL patterns
    const urlPatterns = [
        `https://sneakernews.com/tag/${category}/`,
        `https://sneakernews.com/category/${category}/`,
        `https://sneakernews.com/${category}/`
    ];

    let articles = [];
    let lastError = null;

    for (const url of urlPatterns) {
        try {
            const response = await axios.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                },
                timeout: 10000,
                validateStatus: (status) => status === 200 // Only accept 200 status
            });

            const html = response.data;
            const $ = cheerio.load(html);

            // Category page posts
            $('.post-box, .post-item, article', html).each(function () {
                const title = $(this).find('.post-content h4 a, h2 a, .entry-title a').text().trim();
                const image = $(this).find('img').first().attr('src') || $(this).find('img').first().attr('data-src');
                const articleUrl = $(this).find('a').first().attr('href');
                const date = $(this).find('.post-date, .entry-date').text().trim();
                const excerpt = $(this).find('.post-excerpt, .entry-excerpt').text().trim();
                const cat = $(this).find('.post-cat').text().trim();

                if (title && articleUrl) {
                    articles.push({
                        title,
                        image: image || null,
                        url: articleUrl,
                        category: cat || category,
                        publishedAt: date || null,
                        excerpt: excerpt || null,
                        source: 'SneakerNews',
                        type: 'category'
                    });
                }
            });

            // If we found articles, return them
            if (articles.length > 0) {
                return callback(null, articles);
            }
        } catch (error) {
            lastError = error;
            // Continue to next URL pattern
            continue;
        }
    }

    // If no URL pattern worked, try filtering latest articles by search
    if (articles.length === 0) {
        console.warn(`Category page not found for "${category}", using search fallback`);
        return searchNews(category, callback);
    }

    callback(lastError, articles);
};

/**
 * Get All News (Combined)
 * 
 * Combines latest and popular news in a single response
 * 
 * @param {Function} callback - Callback function (error, result)
 */
const getAllNews = async (callback) => {
    try {
        const results = {
            latest: [],
            popular: [],
            combined: []
        };

        // Get latest news
        await new Promise((resolve) => {
            getLatestNews((err, articles) => {
                if (!err && articles) {
                    results.latest = articles;
                    results.combined = [...results.combined, ...articles];
                }
                resolve();
            });
        });

        // Get popular news
        await new Promise((resolve) => {
            getPopularNews((err, articles) => {
                if (!err && articles) {
                    results.popular = articles;
                    results.combined = [...results.combined, ...articles];
                }
                resolve();
            });
        });

        // Remove duplicates based on URL
        results.combined = results.combined.filter((article, index, self) =>
            index === self.findIndex((a) => a.url === article.url)
        );

        callback(null, results);
    } catch (error) {
        console.error('Error scraping all SneakerNews:', error.message);
        callback(error, null);
    }
};

/**
 * Search News Articles
 * 
 * Searches SneakerNews for specific keywords
 * 
 * @param {String} query - Search query
 * @param {Function} callback - Callback function (error, articles)
 */
const searchNews = async (query, callback) => {
    try {
        const url = `https://sneakernews.com/?s=${encodeURIComponent(query)}`;
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            timeout: 10000
        });

        const html = response.data;
        const $ = cheerio.load(html);
        const articles = [];

        // Search results
        $('.post-box, article', html).each(function () {
            const title = $(this).find('.post-content h4 a, h2 a, .entry-title a').text().trim();
            const image = $(this).find('img').first().attr('src') || $(this).find('img').first().attr('data-src');
            const articleUrl = $(this).find('a').first().attr('href');
            const category = $(this).find('.post-cat, .entry-category').text().trim();
            const date = $(this).find('.post-date, .entry-date').text().trim();
            const excerpt = $(this).find('.post-excerpt, .entry-excerpt').text().trim();

            if (title && articleUrl) {
                articles.push({
                    title,
                    image: image || null,
                    url: articleUrl,
                    category: category || 'Sneakers',
                    publishedAt: date || null,
                    excerpt: excerpt || null,
                    source: 'SneakerNews',
                    type: 'search',
                    query
                });
            }
        });

        callback(null, articles);
    } catch (error) {
        console.error(`Error searching SneakerNews for "${query}":`, error.message);
        callback(error, []);
    }
};

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
    getLatestNews,
    getPopularNews,
    getCategoryNews,
    getAllNews,
    searchNews
};
