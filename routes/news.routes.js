/**
 * ============================================================================
 * SNEAKER NEWS ROUTES - TABLE OF CONTENTS
 * ============================================================================
 * 
 * 1. Configuration & Dependencies
 * 2. News Endpoints
 *    2.1 GET /news/latest - Latest sneaker news from multiple sources
 *    2.2 GET /news/sneakernews - SneakerNews articles
 *    2.3 GET /news/solecollector - Sole Collector featured articles
 *    2.4 GET /news/complex - Complex sneaker news
 * 3. Release Endpoints
 *    3.1 GET /news/releases/upcoming - Upcoming sneaker releases
 *    3.2 GET /news/releases/snkrs - Nike SNKRS upcoming releases
 * 
 * ============================================================================
 */

const axios = require('axios');
const cheerio = require('cheerio');
const rateLimit = require('express-rate-limit');
const cache = require('../utils/cache');
const response = require('../utils/response');

// ============================================================================
// 1. CONFIGURATION & DEPENDENCIES
// ============================================================================

// Rate limiter for news endpoints (higher limit since it's informational)
const newsLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200, // Higher limit for news endpoints
    message: { success: false, error: { message: 'Too many requests, please try again later' } },
    standardHeaders: true,
    legacyHeaders: false
});

module.exports = (app) => {
    // Apply rate limiting to news routes
    app.use('/news', newsLimiter);

    app.use(function (req, res, next) {
        res.header("Access-Control-Allow-Origin", "*");
        res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
        next();
    });

    // ============================================================================
    // 2. NEWS ENDPOINTS
    // ============================================================================

    /**
     * 2.1 GET LATEST NEWS
     * 
     * Aggregates latest sneaker news from multiple sources
     * Combines SneakerNews, Sole Collector, and other sources
     * 
     * Cache: 30 minutes
     * Response: Array of news articles
     */
    app.get('/news/latest', async (req, res) => {
        const cacheKey = 'news:latest';
        const cached = cache.get(cacheKey);

        if (cached) {
            return response.success(res, cached, { count: cached.length, source: 'aggregated', cached: true });
        }

        try {
            const articles = [];
            const url = 'https://sneakernews.com/';
            const axiosResponse = await axios(url);
            const html = axiosResponse.data;
            const $ = cheerio.load(html);

            $('.post-box', html).each(function () {
                const title = $(this).find('.post-content').find('h4').find('a').text().trim();
                const image = $(this).find('a').find('img').attr('src');
                const articleUrl = $(this).find('a').attr('href');
                const category = $(this).find('.post-cat').text().trim();

                if (title && articleUrl) {
                    articles.push({
                        title,
                        image: image || null,
                        url: articleUrl,
                        category: category || 'Sneakers',
                        source: 'SneakerNews',
                        publishedAt: new Date().toISOString()
                    });
                }
            });

            cache.set(cacheKey, articles, 1800); // Cache for 30 minutes
            return response.success(res, articles, { count: articles.length, source: 'aggregated', cached: false });
        } catch (error) {
            console.error('Error fetching latest news:', error.message);
            return response.serverError(res, 'Failed to fetch latest news', error.message);
        }
    });

    /**
     * 2.2 GET SNEAKERNEWS ARTICLES
     * 
     * Fetches latest articles from SneakerNews.com
     * Includes popular and trending posts
     * 
     * Cache: 30 minutes
     * Response: Array of articles with title, image, url
     */
    app.get('/news/sneakernews', async (req, res) => {
        const cacheKey = 'news:sneakernews';
        const cached = cache.get(cacheKey);

        if (cached) {
            return response.success(res, cached, { count: cached.length, source: 'SneakerNews', cached: true });
        }

        try {
            const articles = [];
            const url = 'https://sneakernews.com/';
            const axiosResponse = await axios(url);
            const html = axiosResponse.data;
            const $ = cheerio.load(html);

            // Popular posts
            $('.single_popular_posts', html).each(function () {
                const title = $(this).find('.post-title').text().trim();
                const image = $(this).find('a').find('img').attr('src');
                const articleUrl = $(this).find('a').attr('href');

                if (title && articleUrl) {
                    articles.push({
                        title,
                        image: image || null,
                        url: articleUrl,
                        type: 'popular',
                        source: 'SneakerNews'
                    });
                }
            });

            // Latest posts
            $('.post-box', html).each(function () {
                const title = $(this).find('.post-content').find('h4').find('a').text().trim();
                const image = $(this).find('a').find('img').attr('src');
                const articleUrl = $(this).find('a').attr('href');

                if (title && articleUrl) {
                    articles.push({
                        title,
                        image: image || null,
                        url: articleUrl,
                        type: 'latest',
                        source: 'SneakerNews'
                    });
                }
            });

            cache.set(cacheKey, articles, 1800); // Cache for 30 minutes
            return response.success(res, articles, { count: articles.length, source: 'SneakerNews', cached: false });
        } catch (error) {
            console.error('Error fetching SneakerNews:', error.message);
            return response.serverError(res, 'Failed to fetch SneakerNews articles', error.message);
        }
    });

    /**
     * 2.3 GET SOLE COLLECTOR FEATURED
     * 
     * Fetches featured articles from Sole Collector
     * Includes big features and latest stories
     * 
     * Cache: 30 minutes
     * Response: Array of featured articles
     */
    app.get('/news/solecollector', async (req, res) => {
        const cacheKey = 'news:solecollector';
        const cached = cache.get(cacheKey);

        if (cached) {
            return response.success(res, cached, { count: cached.length, source: 'SoleCollector', cached: true });
        }

        try {
            const articles = [];
            const url = 'https://solecollector.com/';
            const axiosResponse = await axios(url);
            const html = axiosResponse.data;
            const $ = cheerio.load(html);

            // Featured big items
            $('.clg-news__item--big', html).each(function () {
                const title = $(this).find('.clg-item__title').text().trim();
                const image = $(this).find('a').find('img').attr('src');
                const articleUrl = $(this).find('a').attr('href');

                if (title && articleUrl) {
                    articles.push({
                        title,
                        image: image || null,
                        url: articleUrl.startsWith('http') ? articleUrl : `https://solecollector.com${articleUrl}`,
                        type: 'featured',
                        source: 'SoleCollector'
                    });
                }
            });

            // Standard items
            $('.clg-item--16x9', html).each(function () {
                const title = $(this).find('.clg-item__title').text().trim();
                const image = $(this).find('a').find('img').attr('src');
                const articleUrl = $(this).find('a').attr('href');

                if (title && articleUrl) {
                    articles.push({
                        title,
                        image: image || null,
                        url: articleUrl.startsWith('http') ? articleUrl : `https://solecollector.com${articleUrl}`,
                        type: 'standard',
                        source: 'SoleCollector'
                    });
                }
            });

            cache.set(cacheKey, articles, 1800); // Cache for 30 minutes
            return response.success(res, articles, { count: articles.length, source: 'SoleCollector', cached: false });
        } catch (error) {
            console.error('Error fetching Sole Collector:', error.message);
            return response.serverError(res, 'Failed to fetch Sole Collector articles', error.message);
        }
    });

    /**
     * 2.4 GET COMPLEX SNEAKER NEWS
     * 
     * Fetches sneaker news from Complex
     * 
     * Cache: 30 minutes
     * Response: Array of articles
     */
    app.get('/news/complex', async (req, res) => {
        const cacheKey = 'news:complex';
        const cached = cache.get(cacheKey);

        if (cached) {
            return response.success(res, cached, { count: cached.length, source: 'Complex', cached: true });
        }

        try {
            const articles = [];
            const url = 'https://www.complex.com/sneakers';
            const axiosResponse = await axios(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
                }
            });
            const html = axiosResponse.data;
            const $ = cheerio.load(html);

            // Parse Complex articles (structure may vary)
            $('article').each(function () {
                const title = $(this).find('h2').text().trim() || $(this).find('.title').text().trim();
                const image = $(this).find('img').attr('src') || $(this).find('img').attr('data-src');
                const articleUrl = $(this).find('a').attr('href');

                if (title && articleUrl) {
                    articles.push({
                        title,
                        image: image || null,
                        url: articleUrl.startsWith('http') ? articleUrl : `https://www.complex.com${articleUrl}`,
                        source: 'Complex'
                    });
                }
            });

            cache.set(cacheKey, articles, 1800); // Cache for 30 minutes
            return response.success(res, articles, { count: articles.length, source: 'Complex', cached: false });
        } catch (error) {
            console.error('Error fetching Complex:', error.message);
            return response.serverError(res, 'Failed to fetch Complex articles', error.message);
        }
    });

    // ============================================================================
    // 3. RELEASE ENDPOINTS
    // ============================================================================

    /**
     * 3.1 GET UPCOMING RELEASES
     * 
     * Fetches upcoming sneaker releases from Nice Kicks
     * Includes release dates, images, and details
     * 
     * Cache: 1 hour
     * Response: Array of upcoming releases
     */
    app.get('/news/releases/upcoming', async (req, res) => {
        const cacheKey = 'news:releases:upcoming';
        const cached = cache.get(cacheKey);

        if (cached) {
            return response.success(res, cached, { count: cached.length, source: 'NiceKicks', cached: true });
        }

        try {
            const releases = [];
            const url = 'https://www.nicekicks.com/sneaker-release-dates/?nk=upcoming';
            const axiosResponse = await axios(url);
            const html = axiosResponse.data;
            const $ = cheerio.load(html);

            $('.post-summary', html).each(function () {
                const title = $(this).find('.post-summary__title').find('a').text().trim();
                const image = $(this).find('.post-summary__image').find('img').attr('src');
                const releaseUrl = $(this).find('.post-summary__image').find('a').attr('href');
                const month = $(this).find('.rdate__m').text().trim();
                const day = $(this).find('.rdate__d').text().trim();
                const details = $(this).find('.block-release-info').find('p').text().trim();

                if (title && releaseUrl) {
                    releases.push({
                        title,
                        image: image || null,
                        url: releaseUrl,
                        releaseDate: {
                            month,
                            day,
                            display: `${month} ${day}`
                        },
                        details: details || null,
                        source: 'NiceKicks'
                    });
                }
            });

            cache.set(cacheKey, releases, 3600); // Cache for 1 hour
            return response.success(res, releases, { count: releases.length, source: 'NiceKicks', cached: false });
        } catch (error) {
            console.error('Error fetching upcoming releases:', error.message);
            return response.serverError(res, 'Failed to fetch upcoming releases', error.message);
        }
    });

    /**
     * 3.2 GET SNKRS UPCOMING RELEASES
     * 
     * Fetches upcoming releases from Nike SNKRS
     * 
     * Cache: 1 hour
     * Response: Array of SNKRS releases
     */
    app.get('/news/releases/snkrs', async (req, res) => {
        const cacheKey = 'news:releases:snkrs';
        const cached = cache.get(cacheKey);

        if (cached) {
            return response.success(res, cached, { count: cached.length, source: 'Nike SNKRS', cached: true });
        }

        try {
            const releases = [];
            const url = 'https://www.nike.com/launch?s=upcoming';
            const axiosResponse = await axios(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
                }
            });
            const html = axiosResponse.data;
            const $ = cheerio.load(html);

            $('.product-card', html).each(function () {
                const title = $(this).find('.headline-5').text().trim() || $(this).find('.headline-3').text().trim();
                const releaseDate = $(this).find('.headline-4').text().trim() || $(this).find('.headline-1').text().trim();
                const image = $(this).find('img').attr('src');
                const productUrl = $(this).find('a').attr('href');

                if (title) {
                    releases.push({
                        title,
                        releaseDate,
                        image: image || null,
                        url: productUrl ? `https://www.nike.com${productUrl}` : null,
                        source: 'Nike SNKRS'
                    });
                }
            });

            cache.set(cacheKey, releases, 3600); // Cache for 1 hour
            return response.success(res, releases, { count: releases.length, source: 'Nike SNKRS', cached: false });
        } catch (error) {
            console.error('Error fetching SNKRS releases:', error.message);
            return response.serverError(res, 'Failed to fetch SNKRS releases', error.message);
        }
    });
};