// Zips the built extension (dist/) into release/tabplex-v<version>.zip, ready for the Chrome Web Store
// and the GitHub release. Run after `npm run build`:  node scripts/package-extension.mjs [version]
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const DIST = resolve('dist');
const OUT_DIR = resolve('release');

if (!existsSync(resolve(DIST, 'manifest.json'))) {
    console.error('dist/manifest.json not found — run `npm run build` first.');
    process.exit(1);
}

const builtVersion = JSON.parse(readFileSync(resolve(DIST, 'manifest.json'), 'utf8')).version;
const version = (process.argv[2] ?? builtVersion).replace(/^v/, '');
if (version !== builtVersion) {
    console.error(`dist/manifest.json is ${builtVersion} but ${version} was requested — rebuild first.`);
    process.exit(1);
}

mkdirSync(OUT_DIR, { recursive: true });
const zipPath = resolve(OUT_DIR, `tabplex-v${version}.zip`);
rmSync(zipPath, { force: true });

// manifest.json must sit at the root of the archive
if (process.platform === 'win32') {
    execFileSync(
        'powershell.exe',
        ['-NoProfile', '-Command', `Compress-Archive -Path '${DIST}\\*' -DestinationPath '${zipPath}' -Force`],
        { stdio: 'inherit' }
    );
} else {
    execFileSync('zip', ['-r', '-q', '-X', zipPath, '.'], { cwd: DIST, stdio: 'inherit' });
}

console.log(`Packaged ${zipPath}`);
