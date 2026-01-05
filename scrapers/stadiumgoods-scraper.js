/**
 * ============================================================================
 * STADIUM GOODS SCRAPER - TABLE OF CONTENTS
 * ============================================================================
 * 
 * 1. Dependencies & Imports
 * 2. Configuration
 *    2.1 Request Options - Default headers and settings
 * 3. Scraper Functions
 *    3.1 getLink() - Fetch Stadium Goods product link (currently disabled)
 *    3.2 getPrices() - Scrape size-based pricing from product page
 * 
 * Note: Stadium Goods GraphQL endpoint is currently disabled due to changes
 * in their API. The scraper falls back to HTML scraping for price data.
 * 
 * ============================================================================
 */

// ============================================================================
// 1. DEPENDENCIES & IMPORTS
// ============================================================================

const request = require('request');
const got = require('got');
const cheerio = require('cheerio');

// ============================================================================
// 2. CONFIGURATION
// ============================================================================

/**
 * 2.1 Request Options
 * 
 * Default options for HTTP requests to Stadium Goods.
 * These are modified per-request as needed.
 */
const options = {
    url: "",
    body: "",
    headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Content-Type': 'text/html',
    }
};

// ============================================================================
// 3. SCRAPER FUNCTIONS
// ============================================================================

module.exports = {
    /**
     * 3.1 GET LINK
     * 
     * Attempts to fetch the Stadium Goods product link for a sneaker.
     * 
     * NOTE: Currently disabled because Stadium Goods changed their GraphQL API.
     * The commented code shows the previous implementation for reference.
     * This function now immediately calls the callback to allow the scraper
     * pipeline to continue.
     * 
     * @param {Object} shoe - Sneaker object with styleID
     * @param {Function} callback - Callback() called on completion
     */
    getLink: async function (shoe, callback) {
        try {
            // Stadium Goods GraphQL endpoint is currently unavailable
            // Uncomment and update if/when they restore API access
            callback();
        } catch (error) {
            console.warn(`Stadium Goods link fetch error for ${shoe.styleID}: ${error.message}`);
            callback();
        }
    },

    /**
     * 3.2 GET PRICES
     * 
     * Scrapes Stadium Goods product page to extract size-based pricing.
     * Uses Cheerio to parse HTML and extract size/price information.
     * 
     * Features:
     * - Filters out used/out-of-stock items
     * - Handles women's sizing (removes 'W' suffix)
     * - Graceful error handling
     * 
     * @param {Object} shoe - Sneaker object with resellLinks.stadiumGoods
     * @param {Function} callback - Callback() called on completion
     * 
     * @returns {void} Updates shoe.resellPrices.stadiumGoods with size-to-price map
     * 
     * @example
     * getPrices(shoe, () => {
     *   console.log(shoe.resellPrices.stadiumGoods); // { "8.5": 275, "9": 300, ... }
     * });
     */
    getPrices: function (shoe, callback) {
        if (!shoe.resellLinks.stadiumGoods) {
            return callback();
        }

        options.url = shoe.resellLinks.stadiumGoods;
        const priceMap = {};

        request.post(options, function getPriceMap(error, response, data) {
            if (error) {
                console.warn(`Stadium Goods fetch failed for ${shoe.styleID}: ${error.message}`);
                return callback();
            }

            if (response.statusCode !== 200) {
                console.warn(`Stadium Goods returned status ${response.statusCode} for ${shoe.styleID}`);
                return callback();
            }

            try {
                const $ = cheerio.load(data);
                const sizeElements = $('.product-sizes__input');

                if (sizeElements.length === 0) {
                    console.warn(`No size data found on Stadium Goods for ${shoe.styleID}`);
                    return callback();
                }

                sizeElements.each(function (i, product) {
                    const isInStock = $(product).attr('data-stock') === 'true';
                    if (!isInStock) return;

                    let size = $(product).attr('data-size');
                    const priceAmount = $(product).attr('data-amount');

                    if (!size || !priceAmount) return;

                    // Remove 'W' suffix for women's sizes
                    if (size.endsWith('W')) {
                        size = size.substring(0, size.length - 1);
                    }

                    priceMap[size] = parseInt(priceAmount) / 100;

                    // Update sizeAvailability map
                    if (!shoe.sizeAvailability) {
                        shoe.sizeAvailability = new Map();
                    }
                    shoe.sizeAvailability.set(size, isInStock);
                });

                shoe.resellPrices.stadiumGoods = priceMap;

                // Add price history entry
                if (!shoe.priceHistory) {
                    shoe.priceHistory = [];
                }
                const existingEntry = shoe.priceHistory.find(
                    entry => entry.prices?.stadiumGoods
                );
                if (!existingEntry && Object.keys(priceMap).length > 0) {
                    const avgPrice = Object.values(priceMap).reduce((a, b) => a + b, 0) / Object.values(priceMap).length;
                    shoe.priceHistory.push({
                        date: new Date(),
                        prices: {
                            stadiumGoods: {
                                averagePrice: avgPrice
                            }
                        }
                    });
                }

                // Update metadata
                if (shoe.metadata) {
                    shoe.metadata.updatedAt = new Date();
                    shoe.metadata.lastScraped = new Date();
                    if (!shoe.metadata.scrapedSources.includes('stadiumgoods')) {
                        shoe.metadata.scrapedSources.push('stadiumgoods');
                    }
                }

                callback();
            } catch (parseError) {
                console.warn(`Error parsing Stadium Goods data for ${shoe.styleID}: ${parseError.message}`);
                callback();
            }
        });
    }
}