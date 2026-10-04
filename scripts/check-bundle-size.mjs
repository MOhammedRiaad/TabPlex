// Fails when a JavaScript chunk in dist/ grows past its budget. Run after `npm run build`.
// Views are lazy-loaded, so the startup bundle should stay small; only the optional tldraw canvas
// chunk is allowed to be large (it loads only when the tldraw canvas mode is used).
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ASSETS = 'dist/assets';
const KB = 1024;
const DEFAULT_BUDGET = 500 * KB;
const BUDGETS = [{ pattern: /^TldrawContainer[-.]/, budget: 1800 * KB }];

let files;
try {
    files = readdirSync(ASSETS).filter(name => name.endsWith('.js'));
} catch {
    console.error(`${ASSETS} not found: run \`npm run build\` first.`);
    process.exit(1);
}

const over = files.flatMap(name => {
    const size = statSync(join(ASSETS, name)).size;
    const budget = BUDGETS.find(b => b.pattern.test(name))?.budget ?? DEFAULT_BUDGET;
    return size > budget ? [`${name}: ${(size / KB).toFixed(0)} kB (budget ${budget / KB} kB)`] : [];
});

if (over.length) {
    console.error('Bundle size budget exceeded. Lazy-load the new code or split the chunk:');
    for (const line of over) console.error(`  - ${line}`);
    process.exit(1);
}
console.log(`Bundle sizes OK (${files.length} chunks checked).`);
