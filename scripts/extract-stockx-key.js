/**
 * Uses Playwright headless Chromium to open StockX, intercept the live
 * Algolia search request, and write the API key to .env automatically.
 *
 * Usage: node scripts/extract-stockx-key.js
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
    const browser = await chromium.launch({
        headless: false,
        executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        args: ['--disable-blink-features=AutomationControlled'],
    });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        locale: 'en-US',
        viewport: { width: 1280, height: 800 },
    });
    const page = await context.newPage();
    let foundKey = null;

    // Intercept all outgoing requests and look for the Algolia key
    page.on('request', req => {
        const url = req.url();
        if (url.includes('XW7SBCT9V6') && url.includes('x-algolia-api-key=')) {
            const match = url.match(/x-algolia-api-key=([a-zA-Z0-9]+)/);
            if (match) foundKey = match[1];
        }
        // Also check POST body headers
        const headers = req.headers();
        if (headers['x-algolia-api-key'] && url.includes('XW7SBCT9V6')) {
            foundKey = headers['x-algolia-api-key'];
        }
    });

    // Also check response content for the key embedded in JS
    page.on('response', async res => {
        if (foundKey) return;
        const url = res.url();
        if (url.includes('algolia') || url.includes('XW7SBCT9V6')) {
            try {
                const body = await res.text();
                const match = body.match(/XW7SBCT9V6[^"]*","apiKey"\s*:\s*"([a-zA-Z0-9]+)"/);
                if (match) foundKey = match[1];
            } catch (_) { }
        }
    });

    console.log('Opening stockx.com/search...');
    try {
        await page.goto('https://stockx.com/search?s=jordan+1', {
            waitUntil: 'networkidle',
            timeout: 45000,
        });
    } catch (e) {
        console.log('Navigation timeout (Cloudflare challenge), waiting for network...');
    }

    // Wait a bit more for JS to execute and fire Algolia request
    await page.waitForTimeout(6000);

    // If still no key, try scanning all JS on the page for embedded config
    if (!foundKey) {
        try {
            foundKey = await page.evaluate(() => {
                // Search all script tag content for the apiKey next to XW7SBCT9V6
                const scripts = Array.from(document.querySelectorAll('script'));
                for (const s of scripts) {
                    const m = s.textContent.match(/XW7SBCT9V6.*?apiKey['":\s]+([a-zA-Z0-9]{32,})/);
                    if (m) return m[1];
                    // Alternative format
                    const m2 = s.textContent.match(/"apiKey":"([a-zA-Z0-9]{32,})"[^}]*XW7SBCT9V6/);
                    if (m2) return m2[1];
                }
                return null;
            });
        } catch (_) { }
    }

    await browser.close();

    if (foundKey) {
        console.log('\n✓ Found StockX Algolia key:', foundKey);

        // Write to .env
        const envPath = path.join(__dirname, '..', '.env');
        let envContent = '';
        if (fs.existsSync(envPath)) {
            envContent = fs.readFileSync(envPath, 'utf8');
        }

        if (envContent.includes('STOCKX_ALGOLIA_KEY=')) {
            envContent = envContent.replace(/STOCKX_ALGOLIA_KEY=.*(\n|$)/, `STOCKX_ALGOLIA_KEY=${foundKey}\n`);
        } else {
            envContent += `\nSTOCKX_ALGOLIA_KEY=${foundKey}\n`;
        }

        fs.writeFileSync(envPath, envContent);
        console.log('✓ Written to .env — restart the API server to apply.\n');
    } else {
        console.log('\n✗ Could not find key (Cloudflare blocked the browser session).');
        console.log('  StockX is fully behind Cloudflare bot detection even with a real browser.\n');
    }
})().catch(e => {
    console.error('Error:', e.message);
    process.exit(1);
});
