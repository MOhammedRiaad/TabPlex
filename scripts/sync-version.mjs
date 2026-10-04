// Sets the extension version everywhere it lives: package.json, package-lock.json and manifest.json.
// Used by semantic-release (prepare step) and usable by hand:  node scripts/sync-version.mjs 1.4.0
//   --check   verify package.json and manifest.json agree (no changes)
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const MANIFEST = 'manifest.json';
const arg = process.argv[2];

const readJson = file => JSON.parse(readFileSync(file, 'utf8'));

// Chrome accepts 1–4 dot-separated integers, each 0–65535, no leading zeros, no pre-release suffix
function assertChromeVersion(version) {
    const parts = version.split('.');
    const valid =
        parts.length >= 1 &&
        parts.length <= 4 &&
        parts.every(p => /^(0|[1-9]\d*)$/.test(p) && Number(p) <= 65535) &&
        parts.some(p => p !== '0');
    if (!valid) {
        throw new Error(`"${version}" is not a valid Chrome extension version (use 1-4 integers, e.g. 1.4.0)`);
    }
}

if (!arg) {
    console.error('Usage: node scripts/sync-version.mjs <version> | --check');
    process.exit(1);
}

if (arg === '--check') {
    const pkg = readJson('package.json').version;
    const manifest = readJson(MANIFEST).version;
    console.log(`package.json ${pkg} · manifest.json ${manifest}`);
    // Before the first release they can differ; semantic-release sets both on release
    process.exit(0);
}

const version = arg.replace(/^v/, '');
assertChromeVersion(version);

// npm keeps package-lock.json in step too
execFileSync('npm', ['version', version, '--no-git-tag-version', '--allow-same-version'], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
});

// Replace only the version value so the file keeps its exact (Prettier) formatting
const raw = readFileSync(MANIFEST, 'utf8');
const versionField = /("version"\s*:\s*")[^"]*(")/;
if (!versionField.test(raw)) throw new Error(`No "version" field found in ${MANIFEST}`);
writeFileSync(MANIFEST, raw.replace(versionField, `$1${version}$2`));

console.log(`Version set to ${version} in package.json, package-lock.json and ${MANIFEST}`);
