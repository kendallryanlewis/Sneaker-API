/**
 * ============================================================================
 * SNEAKS CONTROLLER - TABLE OF CONTENTS
 * ============================================================================
 * 
 * 1. Dependencies & Imports
 * 2. Utility Functions
 *    2.1 promisifyWithTimeout - Wraps scraper callbacks with timeout protection
 *    2.2 promisifyScraperWithTimeout - Wraps product scrapers with timeout
 * 3. Sneaks Class
 *    3.1 getProducts() - Search and fetch sneaker products with retailer links
 *    3.2 getProductPrices() - Get detailed pricing from all retailers
 *    3.3 getMostPopular() - Fetch most popular/trending sneakers
 * 
 * ============================================================================
 */

// ============================================================================
// 1. DEPENDENCIES & IMPORTS
// ============================================================================

const Sneaker = require('../models/Sneaker');
const stockXScraper = require('../scrapers/stockx-scraper');
const flightClubScraper = require('../scrapers/flightclub-scraper');
const goatScraper = require('../scrapers/goat-scraper');
const stadiumGoodsScraper = require('../scrapers/stadiumgoods-scraper');

// ============================================================================
// 2. UTILITY FUNCTIONS
// ============================================================================

/**
 * 2.1 Promisify Scraper With Timeout
 * 
 * Wraps callback-based scraper functions in a Promise with automatic timeout.
 * Prevents hanging requests by racing the scraper against a timeout timer.
 * 
 * @param {Function} fn - The scraper function to wrap (takes shoe, callback)
 * @param {Object} shoe - The shoe object to pass to the scraper
 * @param {Number} timeoutMs - Timeout in milliseconds (default: 10000)
 * @returns {Promise} Resolves when scraper completes or timeout occurs
 */
const promisifyWithTimeout = (fn, shoe, timeoutMs = 10000) => {
    return Promise.race([
        new Promise((resolve) => {
            fn(shoe, () => resolve());
        }),
        new Promise((resolve) => setTimeout(resolve, timeoutMs))
    ]);
};

/**
 * 2.2 Promisify Product Scraper With Timeout
 * 
 * Wraps the main product scraper (keyword search) in a Promise with timeout.
 * Used for the initial product search that returns multiple sneakers.
 * 
 * @param {Function} fn - The scraper function (takes keyword, count, callback)
 * @param {String} keyword - Search term for sneakers
 * @param {Number} count - Number of products to return
 * @param {Number} timeoutMs - Timeout in milliseconds (default: 30000)
 * @returns {Promise<Array>} Resolves with array of products or rejects on error/timeout
 */
const promisifyScraperWithTimeout = (fn, keyword, count, timeoutMs = 30000) => {
    return Promise.race([
        new Promise((resolve, reject) => {
            fn(keyword, count, (error, products) => {
                if (error) reject(error);
                else resolve(products);
            });
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Scraper timeout')), timeoutMs))
    ]);
};

// ============================================================================
// 3. SNEAKS CLASS
// ============================================================================

/**
 * Main Sneaks API Controller Class
 * 
 * Handles all sneaker-related operations including product search, price fetching,
 * and popularity tracking. Coordinates multiple scraper sources (StockX, GOAT, 
 * Flight Club, Stadium Goods) to provide comprehensive sneaker data.
 */
module.exports = class Sneaks {

    /**
     * 3.1 GET PRODUCTS
     * 
     * Searches for sneakers by keyword and fetches retailer links from multiple sources.
     * Primary data comes from StockX, then enriched with links from other retailers.
     * All scraper operations run in parallel with timeout protection.
     * 
     * @param {String} keyword - Search term (sneaker name, model, etc.)
     * @param {Number} count - Number of products to return (default: 40)
     * @param {Function} callback - Callback(error, products)
     * 
     * @example
     * sneaks.getProducts("Air Jordan 1", 10, (err, products) => {
     *   if (err) console.error(err);
     *   else console.log(products);
     * });
     */
    async getProducts(keyword, count = 40, callback) {
        try {
            // Get initial products from StockX with timeout
            const products = await promisifyScraperWithTimeout(
                stockXScraper.getProductsAndInfo,
                keyword,
                count,
                30000
            );

            if (!products || products.length === 0) {
                return callback(new Error('No products found'), null);
            }

            // Fetch links for all scrapers in parallel with individual error handling
            await Promise.all(
                products.map(async (shoe) => {
                    await Promise.allSettled([
                        promisifyWithTimeout(flightClubScraper.getLink, shoe, 10000).catch(() => { }),
                        promisifyWithTimeout(stadiumGoodsScraper.getLink, shoe, 10000).catch(() => { }),
                        promisifyWithTimeout(goatScraper.getLink, shoe, 10000).catch(() => { })
                    ]);
                })
            );

            callback(null, products);
        } catch (error) {
            console.error('Error in getProducts:', error.message);
            callback(error, null);
        }
    }

    /**
     * 3.2 GET PRODUCT PRICES
     * 
     * Fetches detailed pricing information for a specific sneaker by its style ID.
     * First locates the product, then scrapes prices from all retailers in parallel.
     * Also fetches product images from GOAT.
     * 
     * @param {String} shoeID - The style ID of the sneaker (e.g., "554724-062")
     * @param {Function} callback - Callback(error, shoe)
     * 
     * @example
     * sneaks.getProductPrices("554724-062", (err, shoe) => {
     *   if (err) console.error(err);
     *   else console.log(shoe.lowestResellPrice);
     * });
     */
    async getProductPrices(shoeID, callback) {
        try {
            // Get the product first
            await new Promise((resolve, reject) => {
                this.getProducts(shoeID, 1, (error, products) => {
                    if (error) return reject(error);
                    if (!products || products.length === 0) {
                        return reject(new Error('No Products Found'));
                    }
                    if (products[0].styleID.toLowerCase() !== shoeID.toLowerCase()) {
                        return reject(new Error('No matching product found'));
                    }
                    resolve(products[0]);
                });
            }).then(async (shoe) => {
                // Fetch prices and pictures in parallel with individual error handling
                await Promise.allSettled([
                    promisifyWithTimeout(flightClubScraper.getPrices, shoe, 15000).catch(() => { }),
                    promisifyWithTimeout(goatScraper.getPrices, shoe, 15000).catch(() => { }),
                    promisifyWithTimeout(goatScraper.getPictures, shoe, 15000).catch(() => { }),
                    promisifyWithTimeout(stockXScraper.getPrices, shoe, 15000).catch(() => { }),
                    promisifyWithTimeout(stadiumGoodsScraper.getPrices, shoe, 15000).catch(() => { })
                ]);

                callback(null, shoe);
            });
        } catch (error) {
            console.error('Error in getProductPrices:', error.message);
            callback(error, null);
        }
    }

    /**
     * 3.3 GET MOST POPULAR
     * 
     * Fetches the most popular/trending sneakers from StockX.
     * Uses an empty search keyword to get trending results.
     * 
     * @param {Number} count - Number of popular sneakers to return
     * @param {Function} callback - Callback(error, products)
     * 
     * @example
     * sneaks.getMostPopular(20, (err, products) => {
     *   if (err) console.error(err);
     *   else console.log(products);
     * });
     */
    getMostPopular(count, callback) {
        this.getProducts("", count, (error, products) => {
            if (error) {
                callback(error, null);
            } else {
                callback(null, products);
            }
        });
    }
}