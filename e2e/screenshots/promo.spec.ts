// Renders the Web Store promo images from store-assets/promo/promo.html (run with npm run screenshots).
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { chromium, expect, test } from '@playwright/test';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const TEMPLATE = pathToFileURL(path.join(ROOT, 'store-assets', 'promo', 'promo.html')).href;

for (const [size, width, height] of [
    ['small', 440, 280],
    ['marquee', 1400, 560],
] as const) {
    test(`promo tile (${size}, ${width}×${height})`, async () => {
        const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined });
        const page = await browser.newPage({ viewport: { width, height } });
        await page.goto(`${TEMPLATE}?size=${size}`);
        await expect(page.locator('img.shot')).toHaveJSProperty('complete', true);
        expect(await page.locator('img.shot').evaluate(img => (img as HTMLImageElement).naturalWidth)).toBeGreaterThan(
            0
        );
        await page.screenshot({
            path: path.join(ROOT, 'store-assets', 'promo', `promo-${size}-${width}x${height}.png`),
        });
        await browser.close();
    });
}
