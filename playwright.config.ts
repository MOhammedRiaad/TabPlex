import { defineConfig } from '@playwright/test';

// End-to-end tests: load the built extension (dist/) into Chromium and drive it like a user.
// Run `npm run build` first. CI installs the browser with `npx playwright install --with-deps chromium`.
export default defineConfig({
    testDir: 'e2e',
    timeout: 60_000,
    fullyParallel: false, // each test gets its own browser profile, but keep CI load predictable
    workers: 1,
    retries: process.env.CI ? 1 : 0,
    reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
    use: {
        trace: 'retain-on-failure',
    },
});
