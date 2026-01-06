/**
 * ============================================================================
 * STOCKX SCRAPER - TABLE OF CONTENTS
 * ============================================================================
 * 
 * 1. Dependencies & Imports
 * 2. Configuration & Constants
 *    2.1 USER_AGENTS - User agent rotation pool for anti-detection
 * 3. Helper Functions
 *    3.1 getRandomUserAgent() - Randomly selects a user agent
 *    3.2 retryWithBackoff() - Retry failed requests with exponential backoff
 * 4. Scraper Functions
 *    4.1 getProductsAndInfo() - Search and fetch sneaker product data
 *    4.2 getPrices() - Fetch detailed price map by size for a specific sneaker
 * 
 * ============================================================================
 */

// ============================================================================
// 1. DEPENDENCIES & IMPORTS
// ============================================================================

const got = require('got');
const Sneaker = require('../models/Sneaker');
const axios = require('axios');
const cheerio = require('cheerio');

// ============================================================================
// 2. CONFIGURATION & CONSTANTS
// ============================================================================

/**
 * 2.1 User Agent Pool
 * 
 * Array of modern browser user agents to rotate through for each request.
 * Helps avoid rate limiting and detection by StockX's anti-bot systems.
 */
const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15'
];

// ============================================================================
// 3. HELPER FUNCTIONS
// ============================================================================

/**
 * 3.1 Get Random User Agent
 * 
 * Randomly selects a user agent from the pool to use for the next request.
 * This helps prevent pattern detection by appearing as different browsers.
 * 
 * @returns {String} A randomly selected user agent string
 */
const getRandomUserAgent = () => USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

/**
 * 3.2 Retry With Exponential Backoff
 * 
 * Wraps an async function with automatic retry logic. Uses exponential backoff
 * to avoid overwhelming servers: 1s → 2s → 4s between retries.
 * 
 * @param {Function} fn - Async function to execute with retry logic
 * @param {Number} retries - Maximum number of retry attempts (default: 3)
 * @param {Number} delay - Initial delay in milliseconds (default: 1000)
 * @returns {Promise} Result of the function if successful
 * @throws {Error} Last error if all retries fail
 * 
 * @example
 * const data = await retryWithBackoff(async () => {
 *   return await fetchData();
 * }, 3, 1000);
 */
const retryWithBackoff = async (fn, retries = 3, delay = 1000) => {
    for (let i = 0; i < retries; i++) {
        try {
            return await fn();
        } catch (error) {
            // Don't retry on 403 Forbidden - it won't help
            if (error.response && error.response.statusCode === 403) {
                console.warn('Received 403 Forbidden - StockX may be blocking requests');
                throw error;
            }
            if (i === retries - 1) throw error;
            const backoffDelay = delay * Math.pow(2, i);
            console.log(`Retry ${i + 1}/${retries} after ${backoffDelay}ms...`);
            await new Promise(resolve => setTimeout(resolve, backoffDelay));
        }
    }
};

// ============================================================================
// 4. SCRAPER FUNCTIONS
// ============================================================================

/**
 * 4.1 GET PRODUCTS AND INFO
 * 
 * Searches StockX's Algolia search API for sneakers matching a keyword.
 * Returns structured product data including style IDs, prices, images, and retailer links.
 * 
 * Features:
 * - Automatic retries (3 attempts with exponential backoff)
 * - 15 second timeout per request
 * - User agent rotation
 * - Validates and sanitizes response data
 * - Handles missing/malformed data gracefully
 * 
 * @param {String} key - Search keyword (sneaker name, model, brand, etc.)
 * @param {Number} count - Number of results to return (default: 40)
 * @param {Function} callback - Callback(error, products[])
 * 
 * @example
 * getProductsAndInfo("Jordan 1", 20, (err, products) => {
 *   if (err) console.error(err);
 *   else console.log(`Found ${products.length} sneakers`);
 * });
 */
module.exports = {
    getProductsAndInfo: async function (key, count, callback) {
        try {
            const response = await retryWithBackoff(async () => {
                return await got.post('https://xw7sbct9v6-1.algolianet.com/1/indexes/products/query?x-algolia-agent=Algolia%20for%20vanilla%20JavaScript%203.32.1&x-algolia-application-id=XW7SBCT9V6&x-algolia-api-key=6b5e76b49705eb9f51a06d3c82f7acee', {
                    headers: {
                        'User-Agent': getRandomUserAgent(),
                        "accept": "application/json",
                        "accept-language": "en-US,en;q=0.9",
                        "content-type": "application/x-www-form-urlencoded",
                        "sec-fetch-dest": "empty",
                        "sec-fetch-mode": "cors",
                        "sec-fetch-site": "cross-site",
                        "referer": "https://stockx.com/",
                        "origin": "https://stockx.com"
                    },
                    body: `{"params":"query=${key}&facets=*&filters=&hitsPerPage=${count}"}`,
                    http2: true,
                    timeout: 15000,
                    retry: { limit: 0 }
                });
            }, 3, 1000);
            const json = JSON.parse(response.body);

            if (!json.hits || !Array.isArray(json.hits)) {
                throw new Error('Invalid response structure from StockX');
            }

            const products = [];
            let numOfShoes = json.hits.length;

            for (let i = 0; i < json.hits.length; i++) {
                const hit = json.hits[i];

                if (!hit.style_id || hit.style_id.indexOf(' ') >= 0 || !hit.name) {
                    numOfShoes--;
                    continue;
                }

                try {
                    const shoe = new Sneaker({
                        shoeName: hit.name || '',
                        brand: hit.brand || '',
                        silhoutte: hit.make || '',
                        styleID: hit.style_id || '',
                        make: hit.make || '',
                        colorway: hit.colorway || '',
                        retailPrice: hit.searchable_traits ? hit.searchable_traits['Retail Price'] : null,
                        thumbnail: hit.media && hit.media.imageUrl ? hit.media.imageUrl : '',
                        releaseDate: hit.release_date || '',
                        description: hit.description || '',
                        urlKey: hit.url || '',
                        resellLinks: {
                            stockX: 'https://stockx.com/' + (hit.url || '')
                        }
                    });
                    if (hit.lowest_ask) {
                        shoe.lowestResellPrice.stockX = hit.lowest_ask;
                    }

                    shoe.id = hit.id || '';
                    shoe.uuid = hit.uuid || '';
                    // objectID is a standard Algolia field
                    shoe.objectID = hit.objectID || '';
                    shoe.thumbnail_url = hit.thumbnail_url || '';
                    shoe.imageUrl = hit.imageUrl || '';
                    
                    // Market data - set as numbers
                    shoe.highest_bid = hit.highest_bid || null;
                    shoe.lowest_ask = hit.lowest_ask || null;
                    shoe.last_sale = hit.last_sale || null;
                    shoe.sales_last_72 = hit.sales_last_72 || null;
                    shoe.deadstock_sold = hit.deadstock_sold || null;
                    shoe.total_dollars = hit.total_dollars || null;
                    
                    // Product details - override initial values
                    if (hit.colorway) shoe.colorway = hit.colorway;
                    if (hit.price) shoe.retailPrice = hit.price;
                    if (hit.release_date) shoe.release_date = hit.release_date;

                    // Add main image to images array (imageLinks handled by getPictures)
                    if (hit.media && hit.media.imageUrl) {
                        shoe.images = shoe.images || [];

                        shoe.images.push({
                            url: hit.media.imageUrl,
                            angle: 'main',
                            source: 'stockx'
                        });
                        
                        // Store all StockX image sizes
                        shoe.stockxImages = {
                            imageUrl: hit.media.imageUrl,
                            smallImageUrl: hit.media.smallImageUrl,
                            thumbUrl: hit.media.thumbUrl,
                            thumbnail_url: hit.thumbnail_url,
                            gallery: hit.media.gallery || []
                        };
                    }

                    // Set release status based on availability
                    if (hit.release_date) {
                        const releaseDate = new Date(hit.release_date);
                        const now = new Date();
                        if (releaseDate > now) {
                            shoe.releaseStatus = 'upcoming';
                        } else if (hit.lowest_ask === 0 || !hit.lowest_ask) {
                            shoe.releaseStatus = 'sold_out';
                        } else if (hit.lowest_ask > (hit.searchable_traits?.['Retail Price'] || 0) * 2) {
                            shoe.releaseStatus = 'limited';
                        } else {
                            shoe.releaseStatus = 'available';
                        }
                    }

                    // Initialize metadata
                    shoe.metadata = {
                        createdAt: new Date(),
                        updatedAt: new Date(),
                        lastScraped: new Date(),
                        scrapedSources: ['stockx']
                    };

                    // Store full StockX details for reference
                    shoe.stockxDetails = hit;

                    products.push(shoe);
                } catch (shoeError) {
                    console.error(`Error processing shoe ${hit.style_id}:`, shoeError.message);
                    numOfShoes--;
                }
            }

            if (products.length === 0 || numOfShoes === 0) {
                callback(new Error('Product Not Found'), null);
            } else {
                callback(null, products);
            }
        } catch (error) {
            const err = new Error(`Could not connect to StockX while searching '${key}': ${error.message}`);
            console.error('StockX scraper error:', err);
            callback(err, null);
        }
    },

    /**
     * 4.2 GET PRICES
     * 
     * Fetches detailed price information for a specific sneaker by size.
     * Queries StockX's product API to get the lowest resell price for each available size.
     * 
     * Features:
     * - Automatic retries with exponential backoff
     * - 15 second timeout per request
     * - User agent rotation
     * - Handles women's sizing (removes 'W' suffix)
     * - Gracefully handles missing data
     * 
     * @param {Object} shoe - Sneaker object with urlKey property
     * @param {Function} callback - Callback() called on completion (no error passed on failure)
     * 
     * @returns {void} Updates shoe.resellPrices.stockX with size-to-price map
     * 
     * @example
     * getPrices(shoe, () => {
     *   console.log(shoe.resellPrices.stockX); // { "8.5": 250, "9": 275, ... }
     * });
     */
    getPrices: async function (shoe, callback) {
        if (!shoe.urlKey) {
            return callback(new Error('Missing urlKey for shoe'));
        }

        const priceMap = {};
        const url = `https://stockx.com/api/products/${shoe.urlKey}?includes=market`;

        try {
            const json = await retryWithBackoff(async () => {
                return await axios({
                    method: 'get',
                    url,
                    headers: {
                        withCredentials: true,
                        'User-Agent': getRandomUserAgent(),
                        'Accept': 'application/json',
                        'Referer': 'https://stockx.com/',
                        'Origin': 'https://stockx.com'
                    },
                    timeout: 15000
                });
            }, 3, 1000);

            if (!json.data || !json.data.Product || !json.data.Product.children) {
                throw new Error('Invalid price data structure');
            }

            Object.keys(json.data.Product.children).forEach(function (key) {
                const child = json.data.Product.children[key];

                if (!child.market || child.market.lowestAsk === 0 || !child.shoeSize) {
                    return;
                }

                let size = child.shoeSize;
                if (size.endsWith('W')) {
                    size = size.substring(0, size.length - 1);
                }

                priceMap[size] = child.market.lowestAsk;

                // Update sizeAvailability map
                if (!shoe.sizeAvailability) {
                    shoe.sizeAvailability = new Map();
                }
                shoe.sizeAvailability.set(size, child.market.lowestAsk > 0);
            });

            shoe.resellPrices.stockX = priceMap;

            // Add price history entry
            if (!shoe.priceHistory) {
                shoe.priceHistory = [];
            }
            shoe.priceHistory.push({
                date: new Date(),
                prices: {
                    stockX: {
                        lowestAsk: shoe.lowestResellPrice?.stockX || 0,
                        highestBid: shoe.highest_bid || 0,
                        lastSale: shoe.last_sale || 0
                    }
                }
            });

            callback();
        } catch (err) {
            if (err.response && err.response.status === 403) {
                console.warn(`StockX returned 403 for ${shoe.urlKey} - may be rate limited or blocked`);
            } else {
                console.error(`Error fetching prices for ${shoe.urlKey}:`, err.message);
            }
            // Always callback without error so other scrapers continue
            callback();
        }
    },

    /**
     * 4.3 GET PRODUCT BY OBJECT ID
     * 
     * Fetches a single product by its StockX objectID (UUID).
     * Used when the frontend provides a UUID instead of a style ID.
     * 
     * @param {String} objectId - StockX objectID (UUID format)
     * @returns {Promise<Object>} Resolves with product data including styleID
     * 
     * @example
     * const product = await getProductByObjectId("15795a80-5cc8-4d2d-9ed0-20250d83be7f");
     * console.log(product.styleID); // "CT8012-047"
     */
    getProductByObjectId: async function (objectId) {
        try {
            const response = await retryWithBackoff(async () => {
                return await got.post('https://xw7sbct9v6-1.algolianet.com/1/indexes/products/query?x-algolia-agent=Algolia%20for%20vanilla%20JavaScript%203.32.1&x-algolia-application-id=XW7SBCT9V6&x-algolia-api-key=6b5e76b49705eb9f51a06d3c82f7acee', {
                    headers: {
                        'User-Agent': getRandomUserAgent(),
                        "accept": "application/json",
                        "accept-language": "en-US,en;q=0.9",
                        "content-type": "application/x-www-form-urlencoded",
                        "sec-fetch-dest": "empty",
                        "sec-fetch-mode": "cors",
                        "sec-fetch-site": "cross-site",
                        "referer": "https://stockx.com/",
                        "origin": "https://stockx.com"
                    },
                    body: `{"params":"filters=objectID:${objectId}&hitsPerPage=1"}`,
                    http2: true,
                    timeout: 15000,
                    retry: { limit: 0 }
                });
            }, 3, 1000);

            const json = JSON.parse(response.body);

            if (!json.hits || json.hits.length === 0) {
                throw new Error(`No product found with objectID: ${objectId}`);
            }

            const hit = json.hits[0];

            return {
                styleID: hit.style_id || hit.styleID,
                shoeName: hit.name,
                brand: hit.brand,
                retailPrice: hit.retail_price,
                thumbnail: hit.thumbnail_url || hit.media?.thumbUrl,
                urlKey: hit.url,
                objectID: hit.objectID
            };
        } catch (error) {
            console.error(`Error fetching product by objectID ${objectId}:`, error.message);
            throw error;
        }
    }
}