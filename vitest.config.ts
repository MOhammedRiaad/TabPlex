import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Unit + component tests (jsdom). Browser-level flows live in e2e/ (Playwright).
export default defineConfig({
    plugins: [react()],
    test: {
        environment: 'jsdom',
        setupFiles: ['src/test/setup.ts'],
        include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.{ts,mjs}'],
        restoreMocks: true,
        coverage: {
            provider: 'v8',
            include: ['src/**/*.{ts,tsx}'],
            exclude: [
                // Test helpers and type-only modules
                'src/test/**',
                'src/**/*.test.{ts,tsx}',
                'src/**/*.d.ts',
                'src/types/**',
                'src/features/canvas/types/**',
                'src/features/canvas/store/types.ts',
                // Entry points (exercised by the E2E suite)
                'src/main.tsx',
                'src/background/index.ts',
                'src/background/background.ts',
                // Pure-visual / third-party-heavy canvas code: drawing tools, 2D rendering,
                // tldraw wrapper and canvas export. Covered by Playwright, not by unit tests.
                'src/features/canvas/components/**',
                'src/features/canvas/tools/**',
                'src/features/canvas/utils/render.ts',
                'src/utils/export.ts',
                'src/utils/historyManager.ts',
            ],
            reporter: ['text-summary', 'text', 'html', 'lcov', 'json-summary'],
            reportsDirectory: 'coverage',
            thresholds: {
                statements: 85,
                branches: 85,
                functions: 85,
                lines: 85,
            },
        },
    },
});
