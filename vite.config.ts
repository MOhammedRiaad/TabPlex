import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { readFileSync } from 'node:fs';

// The release pipeline (scripts/sync-version.mjs) bumps package.json before building, so the UI shows the released version.
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as { version: string };

// https://vitejs.dev/config/
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(version)
  },
  plugins: [
    react(),
    viteStaticCopy({
      targets: [
        {
          src: 'manifest.json',
          dest: './'
        },
        {
          src: 'assets/*',
          dest: './assets/'
        },
        {
          src: 'onboarding.html',
          dest: './'
        },
        {
          src: 'onboarding.css',
          dest: './'
        },
        {
          src: 'onboarding.js',
          dest: './'
        }
      ]
    })
  ],
  build: {
    // Views are lazy-loaded (routes.tsx). The only chunk over 500 kB is the optional tldraw canvas,
    // loaded on demand; scripts/check-bundle-size.mjs keeps every other chunk under 500 kB in CI.
    chunkSizeWarningLimit: 1800,
    rollupOptions: {
      input: {
        sidepanel: 'index.html',
        background: 'src/background/index.ts'
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'background') {
            return 'src/background/background.js';
          }
          return 'assets/[name].[hash].js';
        }
      }
    }
  }
});