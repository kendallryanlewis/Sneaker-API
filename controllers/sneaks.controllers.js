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

const got = require('got');
const Sneaker = require('../models/Sneaker');
const flightClubScraper = require('../scrapers/flightclub-scraper');
const goatScraper = require('../scrapers/goat-scraper');
const stadiumGoodsScraper = require('../scrapers/stadiumgoods-scraper');
const stockXScraper = require('../scrapers/stockx-scraper');
const ebayScraper = require('../scrapers/ebay-scraper');

// GOAT Algolia search endpoint (public, no auth required beyond these keys)
const GOAT_ALGOLIA_URL = 'https://2fwotdvm2o-dsn.algolia.net/1/indexes/*/queries?x-algolia-application-id=2FWOTDVM2O&x-algolia-api-key=ac96de6fef0e02bb95d433d8d5c7038a';
const GOAT_REQUEST_OPTIONS = {
    headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    },
    timeout: { request: 15000 },
};

// ============================================================================
// 2. UTILITY FUNCTIONS
// ============================================================================

/**
 * Wraps callback-based scraper functions in a Promise with automatic timeout.
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
 * Derives a best-effort StockX URL from a GOAT slug.
 * StockX and GOAT share the same slug format >90% of the time.
 */
const goatSlugToStockXUrl = (goatLink) => {
    if (!goatLink) return null;
    const slug = goatLink.replace('https://www.goat.com/sneakers/', '');
    return slug ? `https://stockx.com/${slug}` : null;
};

/**
 * Tries to enrich the shoe with live StockX data. If StockX is unavailable,
 * falls back to GOAT data so stockX fields are never left null.
 */
const enrichWithStockX = (shoe, searchTerm, timeoutMs = 10000) => {
    return new Promise((resolve) => {
        const applyGoatFallback = () => {
            if (!shoe.lowestResellPrice) shoe.lowestResellPrice = {};
            // Mirror GOAT price as a StockX estimate when StockX is unreachable
            if (shoe.lowestResellPrice.stockX == null && shoe.lowestResellPrice.goat != null) {
                shoe.lowestResellPrice.stockX = shoe.lowestResellPrice.goat;
            }
            if (!shoe.resellLinks) shoe.resellLinks = {};
            if (!shoe.resellLinks.stockX) {
                shoe.resellLinks.stockX = goatSlugToStockXUrl(shoe.resellLinks?.goat);
            }
        };

        const timer = setTimeout(() => { applyGoatFallback(); resolve(); }, timeoutMs);
        stockXScraper.getProductsAndInfo(searchTerm, 1, (err, sxProducts) => {
            clearTimeout(timer);
            if (!err && sxProducts && sxProducts.length > 0) {
                const sx = sxProducts[0];
                const normalize = (s) => (s || '').toLowerCase().replace(/[\s-]/g, '');
                if (normalize(sx.styleID) === normalize(shoe.styleID) ||
                    normalize(sx.styleID) === normalize(searchTerm)) {
                    if (!shoe.urlKey && sx.urlKey) shoe.urlKey = sx.urlKey;
                    if (!shoe.lowestResellPrice) shoe.lowestResellPrice = {};
                    shoe.lowestResellPrice.stockX = sx.lowestResellPrice?.stockX ?? null;
                    if (!shoe.resellLinks) shoe.resellLinks = {};
                    if (!shoe.resellLinks.stockX && sx.resellLinks?.stockX)
                        shoe.resellLinks.stockX = sx.resellLinks.stockX;
                    if (sx.stockxImages && !shoe.stockxImages?.imageUrl)
                        shoe.stockxImages = sx.stockxImages;
                    if (sx.highest_bid != null && shoe.highest_bid == null)
                        shoe.highest_bid = sx.highest_bid;
                    if (sx.lowest_ask != null && shoe.lowest_ask == null)
                        shoe.lowest_ask = sx.lowest_ask;
                    if (sx.last_sale != null && shoe.last_sale == null)
                        shoe.last_sale = sx.last_sale;
                } else {
                    applyGoatFallback();
                }
            } else {
                applyGoatFallback();
            }
            resolve();
        });
    });
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
    async getProducts(keyword, count = 40, page = 0, callback) {
        if (typeof page === 'function') { callback = page; page = 0; }
        try {
            const requestBody = {
                requests: [{
                    indexName: 'product_variants_v2',
                    params: `distinct=true&hitsPerPage=${count}&page=${page}&query=${encodeURIComponent(keyword)}&filters=product_category%3Ashoes`,
                }],
            };

            const response = await got.post(GOAT_ALGOLIA_URL, {
                ...GOAT_REQUEST_OPTIONS,
                body: JSON.stringify(requestBody),
            });

            const json = JSON.parse(response.body);
            const hits = json.results?.[0]?.hits ?? [];
            const nbHits = json.results?.[0]?.nbHits ?? 0;
            const nbPages = json.results?.[0]?.nbPages ?? 1;

            if (hits.length === 0) {
                return callback(new Error('No products found'), null);
            }

            const products = hits.map((hit) => ({
                sneakerName: hit.name ?? '',
                make: hit.brand_name ?? '',
                colorway: hit.details ?? '',
                styleID: hit.sku ?? hit.search_sku ?? '',
                thumbnail: hit.main_picture_url ?? hit.grid_picture_url ?? null,
                retailPrice: hit.retail_price_cents_usd ? hit.retail_price_cents_usd / 100 : null,
                releaseDate: hit.release_date ?? null,
                releaseDateName: hit.release_date_name ?? null,
                releaseYear: hit.release_year ?? null,
                releaseMonth: hit.release_month ?? null,
                // Availability and demand signals
                hasStock: hit.has_stock ?? false,
                listingCount: hit.number_of_related_listings ?? 0,
                isUnderRetail: hit.is_under_retail ?? false,
                hasUnderRetailAvailability: hit.has_under_retail_availability ?? false,
                allowedSizes: hit.allowed_sizes ?? [],
                priceRange: (hit.minimum_price_cents && hit.maximum_price_cents)
                    ? { low: hit.minimum_price_cents / 100, high: hit.maximum_price_cents / 100 }
                    : null,
                instantShipLowestPrice: hit.instant_ship_lowest_price_cents_usd
                    ? hit.instant_ship_lowest_price_cents_usd / 100
                    : null,
                // Product metadata
                gender: hit.gender ?? [],
                activity: hit.activity ?? null,
                season: hit.season ?? null,
                seasonYear: hit.season_year ?? null,
                keywords: hit.keywords ?? [],
                collectionSlugs: hit.collection_slugs ?? [],
                category: hit.category ?? null,
                silhouette: hit.silhouette ?? null,
                designer: hit.designer ?? null,
                nickname: hit.nickname ?? null,
                upperMaterial: hit.upper_material ?? null,
                midsole: hit.midsole ?? null,
                lowestResellPrice: {
                    goat: hit.lowest_price_cents_usd ? hit.lowest_price_cents_usd / 100 : null,
                    // Seed stockX with the GOAT price as a fallback estimate
                    stockX: hit.lowest_price_cents_usd ? hit.lowest_price_cents_usd / 100 : null,
                    flightClub: null,
                },
                productLinks: {
                    goat: hit.slug ? `https://www.goat.com/sneakers/${hit.slug}` : null,
                    stockX: hit.slug ? `https://stockx.com/${hit.slug}` : null,
                    flightClub: null,
                },
                goatProductId: hit.product_template_id ?? null,
                resellLinks: {
                    goat: hit.slug ? `https://www.goat.com/sneakers/${hit.slug}` : null,
                },
                goatImages: {
                    grid_picture_url: hit.grid_picture_url ?? null,
                    main_picture_url: hit.main_picture_url ?? null,
                    original_picture_url: hit.original_picture_url ?? null,
                    grid_glow_picture_url: hit.grid_glow_picture_url ?? null,
                    main_glow_picture_url: hit.main_glow_picture_url ?? null,
                    main_display_picture_url: hit.main_display_picture_url ?? null,
                    grid_display_picture_url: hit.grid_display_picture_url ?? null,
                },
            }));

            callback(null, products, nbHits, nbPages);
        } catch (error) {
            console.error('Error in getProducts:', error.message);
            callback(error, null, 0, 1);
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
            // Step 1: Locate the product via GOAT
            const shoe = await new Promise((resolve, reject) => {
                this.getProducts(shoeID, 1, (error, products) => {
                    if (error) return reject(error);
                    if (!products || products.length === 0) {
                        return reject(new Error('No Products Found'));
                    }
                    resolve(products[0]);
                });
            });

            // Step 2: Fetch retailer links first — required before price calls
            await Promise.allSettled([
                promisifyWithTimeout(flightClubScraper.getLink, shoe, 10000),
                enrichWithStockX(shoe, shoe.styleID || shoeID, 10000),
            ]);

            // Step 3: Fetch detailed size-price maps and images from all sources
            await Promise.allSettled([
                promisifyWithTimeout(flightClubScraper.getPrices, shoe, 15000),
                promisifyWithTimeout(goatScraper.getPrices, shoe, 15000),
                promisifyWithTimeout(goatScraper.getPictures, shoe, 15000),
                promisifyWithTimeout(flightClubScraper.getPictures, shoe, 15000),
                promisifyWithTimeout(stockXScraper.getPrices, shoe, 15000),
                promisifyWithTimeout(stadiumGoodsScraper.getPrices, shoe, 15000),
                promisifyWithTimeout(ebayScraper.getSoldPrices, shoe, 12000),
            ]);

            callback(null, shoe);
        } catch (error) {
            console.error('Error in getProductPrices:', error.message);
            callback(error, null);
        }
    }

    /**
     * 3.3 FIND ONE PRODUCT
     * 
     * Finds a single sneaker by style ID or StockX object ID (UUID).
     * Performs a precise search and returns detailed product information.
     * 
     * @param {String} id - Style ID (e.g., "CT8012-047") or StockX objectID (UUID)
     * @param {Function} callback - Callback(error, product)
     * 
     * @example
     * // By style ID
     * sneaks.findOne("CT8012-047", (err, shoe) => {
     *   if (err) console.error(err);
     *   else console.log(shoe);
     * });
     * 
     * // By StockX objectID  
     * sneaks.findOne("15795a80-5cc8-4d2d-9ed0-20250d83be7f", (err, shoe) => {
     *   if (err) console.error(err);
     *   else console.log(shoe);
     * });
     */
    async findOne(id, callback) {
        try {
            // Determine if this is a UUID (object ID) or style ID
            const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

            let searchParam;
            if (isUUID) {
                // StockX objectID - resolve to style ID first
                const response = await stockXScraper.getProductByObjectId(id);
                if (!response || !response.styleID) {
                    return callback(new Error('Product not found'), null);
                }
                searchParam = response.styleID;
            } else {
                searchParam = id;
            }

            this.getProducts(searchParam, 1, async (error, products) => {
                if (error) return callback(error, null);
                if (!products || products.length === 0) {
                    return callback(new Error('Product not found'), null);
                }

                const shoe = products[0];

                // Initialise resellPrices so scrapers can write into it
                if (!shoe.resellPrices) {
                    shoe.resellPrices = { stockX: {}, goat: {}, flightClub: {}, stadiumGoods: {} };
                }

                // Step 1: Enrich with FlightClub metadata and StockX link/price in parallel
                await Promise.allSettled([
                    promisifyWithTimeout(flightClubScraper.getLink, shoe, 10000),
                    enrichWithStockX(shoe, shoe.styleID || searchParam, 10000),
                ]);

                // Step 2: Fetch per-size price maps now that we have all required links/IDs
                await Promise.allSettled([
                    promisifyWithTimeout(goatScraper.getPrices, shoe, 15000),
                    promisifyWithTimeout(flightClubScraper.getPrices, shoe, 15000),
                    promisifyWithTimeout(stockXScraper.getPrices, shoe, 15000),
                    promisifyWithTimeout(ebayScraper.getSoldPrices, shoe, 12000),
                ]);

                // Step 3: Construct additional purchase links
                const name = shoe.sneakerName || shoe.make || '';
                const sid = shoe.styleID || '';
                const query = encodeURIComponent(`${name} ${sid}`.trim());
                if (!shoe.resellLinks) shoe.resellLinks = {};
                if (!shoe.resellLinks.ebay) {
                    shoe.resellLinks.ebay = `https://www.ebay.com/sch/i.html?_nkw=${query}&LH_BIN=1`;
                }
                if (!shoe.resellLinks.stadiumGoods) {
                    shoe.resellLinks.stadiumGoods = `https://www.stadiumgoods.com/en-us/search?q=${query}`;
                }
                if (!shoe.resellLinks.sneakersnstuff) {
                    shoe.resellLinks.sneakersnstuff = `https://www.sneakersnstuff.com/en/search?q=${query}`;
                }

                callback(null, shoe);
            });
        } catch (error) {
            console.error('Error in findOne:', error.message);
            callback(error, null);
        }
    }

    /**
     * 3.4 GET MOST POPULAR
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