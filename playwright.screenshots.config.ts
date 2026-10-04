import { defineConfig } from '@playwright/test';

// Store and landing-page screenshots (not part of the E2E suite). Run `npm run build` first.
export default defineConfig({
    testDir: 'e2e/screenshots',
    timeout: 120_000,
    workers: 1,
    retries: 2, // the browser occasionally crashes on the reload after seeding
    reporter: 'list',
});
