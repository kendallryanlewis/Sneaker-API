/**
 * ============================================================================
 * GOAT SCRAPER - TABLE OF CONTENTS
 * ============================================================================
 * 
 * 1. Dependencies & Imports
 * 2. Configuration & Constants
 * 3. Scraper Functions
 *    3.1 getLink() - Fetch GOAT product link and basic metadata
 *    3.2 getPrices() - Fetch size-based pricing data
 *    3.3 getPictures() - Fetch product images from GOAT
 * 
 * ============================================================================
 */

// ============================================================================
// 1. DEPENDENCIES & IMPORTS
// ============================================================================

const got = require('got');
const axios = require('axios');

// ============================================================================
// 2. CONFIGURATION & CONSTANTS
// ============================================================================

const GOAT_ALGOLIA_URL = 'https://2fwotdvm2o-dsn.algolia.net/1/indexes/*/queries?x-algolia-agent=Algolia%20for%20vanilla%20JavaScript%20(lite)%203.25.1%3Breact%20(16.9.0)%3Breact-instantsearch%20(6.2.0)%3BJS%20Helper%20(3.1.0)&x-algolia-application-id=2FWOTDVM2O&x-algolia-api-key=ac96de6fef0e02bb95d433d8d5c7038a';

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const REQUEST_OPTIONS = {
    headers: {
        'User-Agent': USER_AGENT,
        'Content-Type': 'application/json'
    },
    http2: true,
    timeout: 15000
};

// ============================================================================
// 3. SCRAPER FUNCTIONS
// ============================================================================

module.exports = {
    /**
     * 3.1 GET LINK
     * 
     * Searches GOAT's Algolia API for a sneaker by style ID and extracts
     * product information including link, lowest price, and metadata.
     * 
     * Features:
     * - Searches by style ID (SKU)
     * - Extracts 15+ metadata fields
     * - Sets GOAT resell link
     * - Graceful error handling
     * 
     * @param {Object} shoe - Sneaker object with styleID property
     * @param {Function} callback - Callback(error) called on completion
     * 
     * @returns {void} Updates shoe object with GOAT data
     * 
     * @example
     * getLink(shoe, (err) => {
     *   if (!err) console.log(shoe.resellLinks.goat);
     * });
     */
    getLink: async function (shoe, callback) {
        if (!shoe.styleID) {
            return callback(new Error('Missing styleID'));
        }

        try {
            const requestBody = {
                requests: [{
                    indexName: "product_variants_v2",
                    params: `distinct=true&maxValuesPerFacet=1&page=0&query=${shoe.styleID}&facets=%5B%22instant_ship_lowest_price_cents%22%5D`
                }]
            };

            const response = await got.post(GOAT_ALGOLIA_URL, {
                ...REQUEST_OPTIONS,
                body: JSON.stringify(requestBody)
            });

            const json = JSON.parse(response.body);
            const hit = json.results?.[0]?.hits?.[0];

            if (!hit) {
                console.warn(`No GOAT results found for ${shoe.styleID}`);
                return callback();
            }

            // Extract price if available
            const priceInCents = hit.lowest_price_cents_usd;
            if (priceInCents && priceInCents > 0) {
                shoe.lowestResellPrice.goat = priceInCents / 100;
            }

            // Extract metadata
            if (hit.category) shoe.category = hit.category;
            if (hit.designer) shoe.designer = hit.designer;
            if (hit.details) shoe.details = hit.details;
            if (hit.name) shoe.name = hit.name;
            if (hit.nickname) shoe.nickname = hit.nickname;
            if (hit.silhouette) shoe.silhouette = hit.silhouette;
            if (hit.size_brand) shoe.size_brand = hit.size_brand;
            if (hit.story_html) shoe.story_html = hit.story_html;
            if (hit.story) shoe.story = hit.story;
            if (hit.product_template_id) shoe.goatProductId = hit.product_template_id;

            // Release and pricing data
            if (hit.release_date) shoe.release_date = hit.release_date;
            if (hit.release_year) shoe.release_year = hit.release_year;
            if (hit.release_month) shoe.release_month = hit.release_month;
            if (hit.retail_price_cents_usd) shoe.retailPrice = hit.retail_price_cents_usd / 100;
            if (hit.upper_material) shoe.upperMaterial = hit.upper_material;
            if (hit.midsole) shoe.midsole = hit.midsole;

            // All 7 GOAT image URLs for different resolutions and effects
            shoe.goatImages = {
                grid_picture_url: hit.grid_picture_url || null,
                grid_glow_picture_url: hit.grid_glow_picture_url || null,
                grid_display_picture_url: hit.grid_display_picture_url || null,
                main_picture_url: hit.main_picture_url || null,
                main_glow_picture_url: hit.main_glow_picture_url || null,
                main_display_picture_url: hit.main_display_picture_url || null,
                original_picture_url: hit.original_picture_url || null
            };

            // Build product URL
            if (hit.slug) {
                shoe.resellLinks.goat = `https://www.goat.com/sneakers/${hit.slug}`;
            }

            // Add main image to images array (imageLinks handled by getPictures)
            // Use main_picture_url for higher resolution (750px vs 375px grid)
            if (hit.main_picture_url) {
                shoe.images = shoe.images || [];

                shoe.images.push({
                    url: hit.main_picture_url,
                    angle: 'main',
                    source: 'goat'
                });
            }

            // Set release status based on availability
            if (hit.release_date) {
                const releaseDate = new Date(hit.release_date);
                const now = new Date();
                if (releaseDate > now) {
                    shoe.releaseStatus = shoe.releaseStatus || 'upcoming';
                } else if (!priceInCents || priceInCents === 0) {
                    shoe.releaseStatus = shoe.releaseStatus || 'sold_out';
                } else {
                    shoe.releaseStatus = shoe.releaseStatus || 'available';
                }
            }

            // Update metadata
            if (shoe.metadata) {
                shoe.metadata.updatedAt = new Date();
                shoe.metadata.lastScraped = new Date();
                if (!shoe.metadata.scrapedSources.includes('goat')) {
                    shoe.metadata.scrapedSources.push('goat');
                }
            }

            // Store full GOAT details for reference
            shoe.goatDetails = hit;

            callback();
        } catch (error) {
            console.warn(`GOAT link fetch failed for '${shoe.styleID}': ${error.message}`);
            callback();
        }
    },

    /**
     * 3.2 GET PRICES
     * 
     * Fetches size-based pricing from GOAT's API for a specific product.
     * Only includes new (not used) condition sneakers.
     * 
     * Features:
     * - Filters out used condition items
     * - Handles multiple sizes
     * - Takes lowest price when multiple listings exist
     * - 15 second timeout
     * 
     * @param {Object} shoe - Sneaker object with goatProductId
     * @param {Function} callback - Callback() called on completion
     * 
     * @returns {void} Updates shoe.resellPrices.goat with size-to-price map
     * 
     * @example
     * getPrices(shoe, () => {
     *   console.log(shoe.resellPrices.goat); // { "8": 250, "8.5": 275, ... }
     * });
     */
    getPrices: async function (shoe, callback) {
        if (!shoe.resellLinks.goat || !shoe.goatProductId) {
            return callback();
        }

        const apiLink = `https://www.goat.com/web-api/v1/product_variants/buy_bar_data?productTemplateId=${shoe.goatProductId}&countryCode=US`;
        const priceMap = {};

        try {
            const response = await got(apiLink, REQUEST_OPTIONS);
            const json = JSON.parse(response.body);

            if (!Array.isArray(json)) {
                console.warn(`Invalid GOAT price data format for ${shoe.styleID}`);
                return callback();
            }

            // Process each size variant
            for (const variant of json) {
                // Skip used condition items
                if (variant.shoeCondition === 'used') continue;

                const size = variant.sizeOption?.value;
                const priceInCents = variant.lowestPriceCents?.amount;

                if (!size || !priceInCents) continue;

                const price = priceInCents / 100;

                // Keep lowest price if multiple listings for same size
                if (!priceMap[size] || price < priceMap[size]) {
                    priceMap[size] = price;
                }

                // Update sizeAvailability map
                if (!shoe.sizeAvailability) {
                    shoe.sizeAvailability = new Map();
                }
                shoe.sizeAvailability.set(size, price > 0);
            }

            shoe.resellPrices.goat = priceMap;

            // Add price history entry
            if (!shoe.priceHistory) {
                shoe.priceHistory = [];
            }
            const existingEntry = shoe.priceHistory.find(
                entry => entry.prices?.goat
            );
            if (!existingEntry) {
                shoe.priceHistory.push({
                    date: new Date(),
                    prices: {
                        goat: {
                            lowestPrice: shoe.lowestResellPrice?.goat || 0
                        }
                    }
                });
            }

            callback();
        } catch (error) {
            console.warn(`GOAT price fetch failed for '${shoe.styleID}': ${error.message}`);
            callback();
        }
    },

    /**
     * 3.3 GET PICTURES
     * 
     * Fetches high-quality product images from GOAT's API.
     * Selects up to 5 specific angles (indices 0, 2, 5, 7, 3).
     * 
     * Features:
     * - Multiple viewing angles
     * - High resolution images
     * - Fallback-safe array access
     * - 15 second timeout
     * 
     * @param {Object} shoe - Sneaker object with resellLinks.goat
     * @param {Function} callback - Callback(shoe) called on completion
     * 
     * @returns {void} Appends URLs to shoe.imageLinks array
     * 
     * @example
     * getPictures(shoe, () => {
     *   console.log(shoe.imageLinks); // ["https://...", "https://...", ...]
     * });
     */
    getPictures: async function (shoe, callback) {
        if (!shoe.resellLinks.goat) {
            return callback();
        }

        const apiLink = shoe.resellLinks.goat.replace('sneakers', 'web-api/v1/product_templates');

        try {
            const response = await got(apiLink, REQUEST_OPTIONS);
            const json = JSON.parse(response.body);

            const pictures = json.productTemplateExternalPictures;
            if (!pictures || !Array.isArray(pictures)) {
                console.warn(`No GOAT pictures found for ${shoe.styleID}`);
                return callback();
            }

            console.log(`[GOAT] Found ${pictures.length} pictures for ${shoe.styleID}`);

            // If GOAT has images, use ONLY GOAT images in imageLinks (clear other scrapers)
            shoe.imageLinks = [];
            shoe.images = shoe.images || [];
            shoe._goatImagesPopulated = true; // Flag to prevent other scrapers from adding to imageLinks

            // Select specific image indices for different angles
            // Indices: 0 (main), 2 (side), 5 (back), 7 (detail), 3 (alternate)
            const imageIndices = [0, 2, 5, 7, 3];
            const angleNames = ['main', 'side', 'back', 'detail', 'alternate'];

            for (let i = 0; i < imageIndices.length; i++) {
                const index = imageIndices[i];
                const picture = pictures[index];
                if (picture?.mainPictureUrl) {
                    shoe.imageLinks.push(picture.mainPictureUrl);

                    // Add to structured images array
                    shoe.images.push({
                        url: picture.mainPictureUrl,
                        angle: angleNames[i],
                        source: 'goat'
                    });
                }
            }

            callback();
        } catch (error) {
            console.warn(`GOAT pictures fetch failed for '${shoe.styleID}': ${error.message}`);
            callback();
        }
    }
}