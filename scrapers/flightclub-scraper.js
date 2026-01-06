/**
 * ============================================================================
 * FLIGHT CLUB SCRAPER - TABLE OF CONTENTS
 * ============================================================================
 * 
 * 1. Dependencies & Imports
 * 2. Configuration & Constants
 *    2.1 URLs - API endpoints
 *    2.2 User Agent - Browser identification
 * 3. Scraper Functions
 *    3.1 getLink() - Fetch Flight Club product link and metadata
 *    3.2 getPrices() - Fetch size-based pricing via GraphQL
 *    3.3 getPictures() - Fetch multiple product images by checking incremented URLs
 * 
 * ============================================================================
 */

// ============================================================================
// 1. DEPENDENCIES & IMPORTS
// ============================================================================

const got = require('got');

// ============================================================================
// 2. CONFIGURATION & CONSTANTS
// ============================================================================

/**
 * 2.1 API URLs
 */
const FLIGHT_CLUB_ALGOLIA_URL = 'https://2fwotdvm2o-dsn.algolia.net/1/indexes/*/queries?x-algolia-agent=Algolia%20for%20vanilla%20JavaScript%20(lite)%203.32.0%3Breact-instantsearch%205.4.0%3BJS%20Helper%202.26.1&x-algolia-application-id=2FWOTDVM2O&x-algolia-api-key=ac96de6fef0e02bb95d433d8d5c7038a';
const FLIGHT_CLUB_TOKEN_URL = 'https://www.flightclub.com/token';
const FLIGHT_CLUB_GRAPHQL_URL = 'https://www.flightclub.com/graphql';
const FLIGHT_CLUB_BASE_URL = 'https://www.flightclub.com';

/**
 * 2.2 User Agent
 */
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * 2.3 Request Options Template
 */
const REQUEST_OPTIONS = {
    headers: {
        'User-Agent': USER_AGENT,
        'Content-Type': 'application/json'
    },
    timeout: 15000,
    http2: true
};

// ============================================================================
// 3. SCRAPER FUNCTIONS
// ============================================================================

module.exports = {
    /**
     * 3.1 GET LINK
     * 
     * Searches Flight Club's Algolia API for a sneaker by style ID and extracts
     * the product link, lowest price, and description.
     * 
     * Features:
     * - Searches by style ID (SKU)
     * - Sets Flight Club resell link
     * - Extracts lowest resell price
     * - Saves product story/description
     * - 15 second timeout
     * 
     * @param {Object} shoe - Sneaker object with styleID property
     * @param {Function} callback - Callback(error, shoe) called on completion
     * 
     * @returns {void} Updates shoe object with Flight Club data
     * 
     * @example
     * getLink(shoe, (err, updatedShoe) => {
     *   if (!err) console.log(shoe.resellLinks.flightClub);
     * });
     */
    getLink: async function (shoe, callback) {
        if (!shoe.styleID) {
            return callback(new Error('Missing styleID'));
        }

        try {
            const requestBody = {
                requests: [{
                    indexName: "product_variants_v2_flight_club",
                    params: `query=${shoe.styleID}&hitsPerPage=1&maxValuesPerFacet=1&filters=&facets=["lowest_price_cents_usd"]&tagFilters=`
                }]
            };

            const response = await got.post(FLIGHT_CLUB_ALGOLIA_URL, {
                ...REQUEST_OPTIONS,
                body: JSON.stringify(requestBody)
            });

            const data = JSON.parse(response.body);
            const hits = data.results?.[0]?.hits;

            if (!hits || hits.length === 0) {
                console.warn(`No Flight Club results found for ${shoe.styleID}`);
                return callback();
            }

            const hit = hits[0];

            // Extract price
            if (hit.lowest_price_cents_usd) {
                shoe.lowestResellPrice.flightClub = hit.lowest_price_cents_usd / 100;
            }

            // Build product URL
            if (hit.slug) {
                shoe.resellLinks.flightClub = `${FLIGHT_CLUB_BASE_URL}/${hit.slug}`;
            }

            // Store description/story
            if (hit.story) {
                shoe.description = hit.story;
            }

            // Store raw details for reference
            shoe.flightclubDetails = data.results[0];

            callback(null, shoe);
        } catch (error) {
            console.warn(`FlightClub lookup failed for ${shoe.styleID}: ${error.message}`);
            callback();
        }
    },

    /**
     * 3.2 GET PRICES
     * 
     * Fetches size-based pricing from Flight Club using their GraphQL API.
     * Requires CSRF token fetching before making the GraphQL request.
     * 
     * Process:
     * 1. Fetch CSRF token from /token endpoint
     * 2. Query GraphQL API with token
     * 3. Parse size and price data
     * 
     * Features:
     * - CSRF token handling
     * - GraphQL query execution
     * - Size-to-price mapping
     * - 15 second timeout per request
     * 
     * @param {Object} shoe - Sneaker object with resellLinks.flightClub
     * @param {Function} callback - Callback(error, shoe) called on completion
     * 
     * @returns {void} Updates shoe.resellPrices.flightClub with size-to-price map
     * 
     * @example
     * getPrices(shoe, (err, updatedShoe) => {
     *   if (!err) console.log(shoe.resellPrices.flightClub); // { "8": 250, "8.5": 275, ... }
     * });
     */
    getPrices: async function (shoe, callback) {
        if (!shoe.resellLinks.flightClub) {
            console.warn(`No Flight Club resell link for ${shoe.styleID}`);
            return callback();
        }

        try {
            // Extract slug from URL
            const slug = shoe.resellLinks.flightClub.split('.com/')[1];

            if (!slug) {
                console.warn(`Invalid Flight Club URL format for ${shoe.styleID}`);
                return callback();
            }

            // Step 1: Fetch CSRF token
            const tokenResponse = await got(FLIGHT_CLUB_TOKEN_URL, {
                headers: { 'User-Agent': USER_AGENT },
                timeout: 15000
            });
            const token = tokenResponse.body;

            // Step 2: Query GraphQL API with token
            const graphqlResponse = await got.post(FLIGHT_CLUB_GRAPHQL_URL, {
                ...REQUEST_OPTIONS,
                headers: {
                    ...REQUEST_OPTIONS.headers,
                    'x-csrf-token': token
                },
                body: JSON.stringify({
                    operationName: "getProductTemplate",
                    variables: { slug },
                    query: `query getProductTemplate($slug: String!) {
                        getProductTemplate(slug: $slug) {
                            newSizes {
                                size { display }
                                lowestPriceOption { price { value } }
                            }
                        }
                    }`
                })
            });

            const json = JSON.parse(graphqlResponse.body);
            const sizes = json.data?.getProductTemplate?.newSizes;

            if (!sizes || !Array.isArray(sizes)) {
                console.warn(`No size data available for ${shoe.styleID} on Flight Club`);
                return callback();
            }

            // Build price map
            const priceMap = {};
            for (const sizeData of sizes) {
                const display = sizeData.size?.display;
                const priceValue = sizeData.lowestPriceOption?.price?.value;

                if (display && priceValue) {
                    priceMap[display] = priceValue / 100;

                    // Update sizeAvailability map
                    if (!shoe.sizeAvailability) {
                        shoe.sizeAvailability = new Map();
                    }
                    shoe.sizeAvailability.set(display, priceValue > 0);
                }
            }

            shoe.resellPrices.flightClub = priceMap;

            // Add price history entry
            if (!shoe.priceHistory) {
                shoe.priceHistory = [];
            }
            const existingEntry = shoe.priceHistory.find(
                entry => entry.prices?.flightClub
            );
            if (!existingEntry && Object.keys(priceMap).length > 0) {
                const avgPrice = Object.values(priceMap).reduce((a, b) => a + b, 0) / Object.values(priceMap).length;
                shoe.priceHistory.push({
                    date: new Date(),
                    prices: {
                        flightClub: {
                            averagePrice: avgPrice
                        }
                    }
                });
            }

            // Update metadata
            if (shoe.metadata) {
                shoe.metadata.updatedAt = new Date();
                shoe.metadata.lastScraped = new Date();
                if (!shoe.metadata.scrapedSources.includes('flightclub')) {
                    shoe.metadata.scrapedSources.push('flightclub');
                }
            }

            callback(null, shoe);
        } catch (error) {
            console.warn(`FlightClub price fetch failed for ${shoe.styleID}: ${error.message}`);
            callback();
        }
    },

    /**
     * 3.3 GET PICTURES
     * 
     * Fetches multiple product images from Flight Club by checking incremented URLs.
     * Flight Club uses a pattern: /TEMPLATE/{id}/1.jpg, /TEMPLATE/{id}/2.jpg, etc.
     * 
     * @param {Object} shoe - Sneaker object with flightclubDetails
     * @param {Function} callback - Callback() called on completion
     * 
     * @example
     * getPictures(shoe, () => {
     *   console.log(shoe.imageLinks); // Multiple Flight Club images
     * });
     */
    getPictures: async function (shoe, callback) {
        if (!shoe.flightclubDetails?.hits?.[0]?.grid_picture_url) {
            return callback();
        }

        try {
            const baseUrl = shoe.flightclubDetails.hits[0].grid_picture_url;
            
            // Extract the template ID from URL pattern: https://cdn.flightclub.com/TEMPLATE/479033/1.jpg
            const urlMatch = baseUrl.match(/(.+\/TEMPLATE\/\d+\/)(\d+)(\.\w+)$/);
            if (!urlMatch) {
                console.warn(`Could not parse Flight Club image URL pattern: ${baseUrl}`);
                return callback();
            }

            const [, urlBase, , extension] = urlMatch;
            
            // Initialize arrays if they don't exist
            shoe.imageLinks = shoe.imageLinks || [];
            shoe.images = shoe.images || [];

            const angleNames = ['main', 'side', 'back', 'top', 'bottom', 'detail', 'alternate'];
            const maxImages = 10; // Reasonable limit to avoid endless checking

            // Check for images starting from 1
            for (let i = 1; i <= maxImages; i++) {
                const imageUrl = `${urlBase}${i}${extension}`;
                
                try {
                    // Quick HEAD request to check if image exists
                    await got.head(imageUrl, {
                        timeout: 5000,
                        retry: { limit: 0 }
                    });

                    // Image exists, add it to arrays
                    shoe.imageLinks.push(imageUrl);
                    shoe.images.push({
                        url: imageUrl,
                        angle: angleNames[i - 1] || `angle_${i}`,
                        source: 'flightclub'
                    });
                } catch (error) {
                    // 404 or error - no more images
                    if (error.response?.statusCode === 404 || error.code === 'ETIMEDOUT') {
                        break;
                    }
                }
            }

            callback();
        } catch (error) {
            console.warn(`FlightClub picture fetch failed for ${shoe.styleID}: ${error.message}`);
            callback();
        }
    }
};
