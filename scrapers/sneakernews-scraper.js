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

/**
 * Get Latest News Articles
 * 
 * Scrapes the homepage for the latest sneaker news articles
 * 
 * @param {Function} callback - Callback function (error, articles)
 */
const getLatestNews = async (callback) => {
    try {
        const url = 'https://sneakernews.com/';
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            timeout: 10000
        });

        const html = response.data;
        const $ = cheerio.load(html);
        const articles = [];

        // Latest posts from homepage
        $('.post-box', html).each(function () {
            const title = $(this).find('.post-content h4 a').text().trim();
            const image = $(this).find('a img').attr('src') || $(this).find('a img').attr('data-src');
            const articleUrl = $(this).find('a').attr('href');
            const category = $(this).find('.post-cat').text().trim();
            const date = $(this).find('.post-date').text().trim();
            const excerpt = $(this).find('.post-excerpt').text().trim();

            if (title && articleUrl) {
                articles.push({
                    title,
                    image: image || null,
                    url: articleUrl,
                    category: category || 'Sneakers',
                    publishedAt: date || null,
                    excerpt: excerpt || null,
                    source: 'SneakerNews',
                    type: 'latest'
                });
            }
        });

        callback(null, articles);
    } catch (error) {
        console.error('Error scraping SneakerNews latest:', error.message);
        callback(error, []);
    }
};

/**
 * Get Popular News Articles
 * 
 * Scrapes popular/trending articles from the sidebar or featured sections
 * 
 * @param {Function} callback - Callback function (error, articles)
 */
const getPopularNews = async (callback) => {
    try {
        const url = 'https://sneakernews.com/';
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            timeout: 10000
        });

        const html = response.data;
        const $ = cheerio.load(html);
        const articles = [];

        // Popular posts from sidebar
        $('.single_popular_posts', html).each(function () {
            const title = $(this).find('.post-title').text().trim();
            const image = $(this).find('a img').attr('src') || $(this).find('a img').attr('data-src');
            const articleUrl = $(this).find('a').attr('href');

            if (title && articleUrl) {
                articles.push({
                    title,
                    image: image || null,
                    url: articleUrl,
                    source: 'SneakerNews',
                    type: 'popular'
                });
            }
        });

        // If popular posts not found, get featured posts
        if (articles.length === 0) {
            $('.featured-post', html).each(function () {
                const title = $(this).find('h2 a, h3 a').text().trim();
                const image = $(this).find('img').attr('src') || $(this).find('img').attr('data-src');
                const articleUrl = $(this).find('a').first().attr('href');

                if (title && articleUrl) {
                    articles.push({
                        title,
                        image: image || null,
                        url: articleUrl,
                        source: 'SneakerNews',
                        type: 'featured'
                    });
                }
            });
        }

        callback(null, articles);
    } catch (error) {
        console.error('Error scraping SneakerNews popular:', error.message);
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
