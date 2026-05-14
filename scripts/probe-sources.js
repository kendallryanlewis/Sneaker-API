/**
 * Quick probe script to test potential new data sources.
 * Run: node scripts/probe-sources.js
 */
const axios = require('axios');
const cheerio = require('cheerio');

const SKU = '555088-001';
const NAME = 'Air Jordan 1 Retro High OG Banned';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

async function probe(label, fn) {
    try {
        const result = await fn();
        console.log(`✅ ${label}:`, result);
    } catch (e) {
        console.log(`❌ ${label}: ${e.message}`);
    }
}

async function main() {
    // 1. eBay sold listings (HTML scrape)
    await probe('eBay sold listings', async () => {
        const r = await axios.get(
            `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(SKU)}&LH_Sold=1&LH_Complete=1&_ipg=5`,
            { headers: { 'User-Agent': UA }, timeout: 8000 }
        );
        const $ = cheerio.load(r.data);
        const prices = [];
        $('.s-item__price').each(function () { prices.push($(this).text().trim()); });
        return { status: r.status, prices: prices.slice(0, 6) };
    });

    // 2. SneakerNews RSS — search by shoe name
    await probe('SneakerNews RSS search', async () => {
        const r = await axios.get(
            `https://sneakernews.com/?s=${encodeURIComponent(NAME)}&feed=rss2`,
            { headers: { 'User-Agent': UA }, timeout: 8000 }
        );
        const $ = cheerio.load(r.data, { xmlMode: true });
        const titles = [];
        $('item title').each(function () { titles.push($(this).text().trim()); });
        return { status: r.status, count: titles.length, first: titles[0] };
    });

    // 3. Adidas product search (for Adidas/Yeezy shoes)
    await probe('Adidas product search', async () => {
        const r = await axios.get(
            'https://www.adidas.com/api/plp/content-engine/search?query=yeezy+boost+350&start=0&sz=1',
            { headers: { 'User-Agent': UA, 'Accept': 'application/json' }, timeout: 8000 }
        );
        const j = r.data;
        const count = j?.raw?.itemList?.count ?? j?.count ?? '?';
        const sample = j?.raw?.itemList?.items?.[0]?.productId ?? '?';
        return { status: r.status, count, sample };
    });

    // 4. Nike product feed — check if Jordan 555088-001 appears
    await probe('Nike product feed (filter by label)', async () => {
        const r = await axios.get(
            'https://api.nike.com/product_feed/threads/v2?filter=marketplace(US)&filter=language(en)&filter=channelId(d9a5bc42-4b9c-4976-858a-f159cf99c647)&anchor=0&count=50',
            { headers: { 'User-Agent': UA, 'Accept': 'application/json' }, timeout: 8000, decompress: true }
        );
        const objects = r.data?.objects ?? [];
        const match = objects.find(o => {
            const pis = o?.productInfo ?? [];
            return pis.some(pi => {
                const sc = pi?.merchProduct?.styleColor ?? '';
                return sc === SKU || sc.replace('-', '') === SKU.replace('-', '');
            });
        });
        return { status: r.status, total: objects.length, found: !!match };
    });

    // 5. Stadium Goods HTML search
    await probe('Stadium Goods search', async () => {
        const r = await axios.get(
            `https://www.stadiumgoods.com/en-us/search?query=${encodeURIComponent(SKU)}`,
            { headers: { 'User-Agent': UA }, timeout: 8000 }
        );
        const $ = cheerio.load(r.data);
        const title = $('h1, [data-testid="product-name"]').first().text().trim();
        const priceText = $('[data-testid="price"], .price, .product-price').first().text().trim();
        return { status: r.status, title: title.slice(0, 60), price: priceText.slice(0, 30) };
    });

    // 6. Grailed GraphQL (used marketplace)
    await probe('Grailed GraphQL', async () => {
        const r = await axios.post(
            'https://www.grailed.com/api/graph',
            { query: `{ listings(query: "${SKU}", page: 1, perPage: 3) { results { id title price } } }` },
            { headers: { 'User-Agent': UA, 'Content-Type': 'application/json' }, timeout: 8000 }
        );
        return { status: r.status, data: JSON.stringify(r.data).slice(0, 200) };
    });

    // 7. Nike styleCode filter
    await probe('Nike threads styleCode filter', async () => {
        const styleCode = SKU.split('-')[0]; // 555088
        const r = await axios.get(
            `https://api.nike.com/product_feed/threads/v2?filter=marketplace(US)&filter=language(en)&filter=channelId(d9a5bc42-4b9c-4976-858a-f159cf99c647)&filter=styleCode(${styleCode})`,
            { headers: { 'User-Agent': UA, 'Accept': 'application/json' }, decompress: true, timeout: 8000 }
        );
        return { status: r.status, count: r.data?.objects?.length ?? 0, body: JSON.stringify(r.data).slice(0, 200) };
    });

    // 8. SneakerNews category RSS — releases feed
    await probe('SneakerNews releases RSS', async () => {
        const r = await axios.get(
            'https://sneakernews.com/category/release-dates/feed/',
            { headers: { 'User-Agent': UA }, timeout: 8000 }
        );
        const $ = cheerio.load(r.data, { xmlMode: true });
        const count = $('item').length;
        const first = $('item title').first().text().trim();
        return { status: r.status, count, first };
    });

    // 9. GOAT price history (check if they expose one)
    await probe('GOAT price history endpoint', async () => {
        const r = await axios.get(
            `https://www.goat.com/api/v1/product_templates/555088-001/price_history`,
            { headers: { 'User-Agent': UA, 'Accept': 'application/json' }, timeout: 8000 }
        );
        return { status: r.status, data: JSON.stringify(r.data).slice(0, 200) };
    });

    // 10. Kixify marketplace (alternate resell)
    await probe('Kixify product search', async () => {
        const r = await axios.get(
            `https://www.kixify.com/search?q=${encodeURIComponent(SKU)}`,
            { headers: { 'User-Agent': UA }, timeout: 8000 }
        );
        const $ = cheerio.load(r.data);
        const count = $('.product-item, .item, [data-item]').length;
        return { status: r.status, items: count };
    });
}

main();
