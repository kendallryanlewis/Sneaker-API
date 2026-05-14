/**
 * ============================================================================
 * EBAY SCRAPER
 * ============================================================================
 *
 * Fetches real market sold prices for sneakers from eBay's Finding API.
 * Provides the most accurate secondary-market price data since it reflects
 * actual completed transactions (not just asking prices).
 *
 * Requires a free eBay App ID:
 *   1. Go to https://developer.ebay.com/
 *   2. Register (free) → create an application
 *   3. Copy the "App ID (Client ID)" value
 *   4. Set EBAY_APP_ID=<value> in your .env file
 *
 * Usage:
 *   const ebayScraper = require('./ebay-scraper');
 *   ebayScraper.getSoldPrices(shoe, callback);
 *
 * Adds to shoe object:
 *   shoe.ebay.soldCount       — # of completed sales found
 *   shoe.ebay.averageSoldPrice — average sale price (USD)
 *   shoe.ebay.lowestSoldPrice  — lowest completed sale price
 *   shoe.ebay.highestSoldPrice — highest completed sale price
 *   shoe.ebay.recentSales[]    — up to 5 recent sales with title/price/date
 *   shoe.ebay.searchUrl        — direct eBay search URL for the shoe
 *   shoe.lowestResellPrice.ebay — lowest sold price (for price comparison)
 *
 * ============================================================================
 */

const got = require('got');

const EBAY_API_BASE = 'https://svcs.ebay.com/services/search/FindingService/v1';
const EBAY_APP_ID = process.env.EBAY_APP_ID;

module.exports = {
    /**
     * GET SOLD PRICES
     *
     * Queries eBay's Finding API for completed (sold) listings matching the
     * shoe's style ID. Returns average, low, and high sold prices plus
     * recent individual sales.
     *
     * Falls back gracefully and sets nothing if no App ID is configured or
     * if the API call fails.
     *
     * @param {Object} shoe - Sneaker object with styleID and sneakerName
     * @param {Function} callback - Callback() called on completion
     */
    getSoldPrices: async function (shoe, callback) {
        if (!EBAY_APP_ID) {
            // No API key configured — skip silently
            return callback();
        }

        const query = shoe.styleID
            ? `${shoe.sneakerName || ''} ${shoe.styleID}`.trim()
            : shoe.sneakerName;

        if (!query) return callback();

        const searchUrl = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}&LH_Sold=1&LH_Complete=1`;

        try {
            const params = new URLSearchParams({
                'OPERATION-NAME': 'findCompletedItems',
                'SERVICE-VERSION': '1.0.0',
                'SECURITY-APPNAME': EBAY_APP_ID,
                'RESPONSE-DATA-FORMAT': 'JSON',
                'REST-PAYLOAD': '',
                'keywords': query,
                'itemFilter(0).name': 'SoldItemsOnly',
                'itemFilter(0).value': 'true',
                'itemFilter(1).name': 'MinPrice',
                'itemFilter(1).value': '20',
                'itemFilter(1).paramName': 'Currency',
                'itemFilter(1).paramValue': 'USD',
                'sortOrder': 'EndTimeSoonest',
                'paginationInput.entriesPerPage': '10',
            });

            const response = await got(`${EBAY_API_BASE}?${params.toString()}`, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                    'Accept': 'application/json',
                },
                timeout: { request: 10000 },
            });

            const json = JSON.parse(response.body);
            const ack = json?.findCompletedItemsResponse?.[0]?.ack?.[0];
            if (ack !== 'Success') return callback();

            const items = json?.findCompletedItemsResponse?.[0]?.searchResult?.[0]?.item ?? [];
            if (items.length === 0) return callback();

            const soldPrices = items
                .map((item) => parseFloat(item?.sellingStatus?.[0]?.currentPrice?.[0]?.__value__))
                .filter((p) => !isNaN(p) && p > 0);

            if (soldPrices.length === 0) return callback();

            const avg = Math.round(soldPrices.reduce((a, b) => a + b, 0) / soldPrices.length);
            const low = Math.min(...soldPrices);
            const high = Math.max(...soldPrices);

            const recentSales = items.slice(0, 5).map((item) => ({
                title: item?.title?.[0] ?? '',
                price: parseFloat(item?.sellingStatus?.[0]?.currentPrice?.[0]?.__value__) || 0,
                endTime: item?.listingInfo?.[0]?.endTime?.[0] ?? null,
                url: item?.viewItemURL?.[0] ?? null,
            }));

            if (!shoe.ebay) shoe.ebay = {};
            shoe.ebay.soldCount = soldPrices.length;
            shoe.ebay.averageSoldPrice = avg;
            shoe.ebay.lowestSoldPrice = low;
            shoe.ebay.highestSoldPrice = high;
            shoe.ebay.recentSales = recentSales;
            shoe.ebay.searchUrl = searchUrl;

            if (!shoe.lowestResellPrice) shoe.lowestResellPrice = {};
            shoe.lowestResellPrice.ebay = low;

            callback();
        } catch (error) {
            console.warn(`eBay price fetch failed for '${shoe.styleID}': ${error.message}`);
            callback();
        }
    },
};
