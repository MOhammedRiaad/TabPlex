// Publishes the release zip to Microsoft Edge Add-ons with the Update REST API (v1.1).
// https://learn.microsoft.com/microsoft-edge/extensions/update/api/using-addons-api
//
// Runs in the Release workflow after semantic-release. Needs:
//   EDGE_CLIENT_ID, EDGE_API_KEY  Partner Center → Microsoft Edge → Publish API
//   EDGE_PRODUCT_ID               Partner Center → the extension's overview page
// The API can only update an extension that was first published by hand in Partner Center.
//
//   node scripts/publish-edge.mjs [path/to/tabplex-vX.Y.Z.zip]
// Without a path it publishes the zip semantic-release made in release/; with no zip there, nothing was released.
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const API = 'https://api.addons.microsoftedge.microsoft.com/v1';
const REPO = 'https://github.com/MOhammedRiaad/TabPlex';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/** The Location header holds the operation id (possibly as the end of a path) */
export function operationIdFrom(location) {
    if (!location) throw new Error('The API did not return an operation id (no Location header)');
    return location.trim().split('/').filter(Boolean).pop();
}

function headers({ clientId, apiKey }, extra = {}) {
    return { Authorization: `ApiKey ${apiKey}`, 'X-ClientID': clientId, ...extra };
}

async function expectAccepted(response, what) {
    if (response.status === 202) return operationIdFrom(response.headers.get('location'));
    const body = await response.text().catch(() => '');
    throw new Error(`${what} failed: HTTP ${response.status} ${body}`.trim());
}

/** Poll an operation until it is no longer InProgress; throw with the API's explanation if it failed */
export async function waitForOperation(url, credentials, { fetchImpl = fetch, intervalMs = 5000, attempts = 60 } = {}) {
    for (let i = 0; i < attempts; i++) {
        const response = await fetchImpl(url, { headers: headers(credentials) });
        if (!response.ok) throw new Error(`Status check failed: HTTP ${response.status} ${await response.text()}`);
        const operation = await response.json();
        if (operation.status === 'Succeeded') return operation;
        if (operation.status === 'Failed') {
            const errors = Array.isArray(operation.errors)
                ? operation.errors.map(e => (typeof e === 'string' ? e : e.message)).join('; ')
                : '';
            throw new Error(`${operation.errorCode || 'Failed'}: ${operation.message}${errors ? ` (${errors})` : ''}`);
        }
        await sleep(intervalMs);
    }
    throw new Error(`Still in progress after ${attempts} checks: ${url}`);
}

/** Upload the zip as the new draft, then submit the draft for review/publishing */
export async function publishToEdge({
    zip,
    notes,
    productId,
    clientId,
    apiKey,
    fetchImpl = fetch,
    intervalMs,
    log = console.log,
}) {
    const credentials = { clientId, apiKey };
    const product = `${API}/products/${productId}/submissions`;

    log(`Uploading ${path.basename(zip)} to Edge Add-ons…`);
    const upload = await fetchImpl(`${product}/draft/package`, {
        method: 'POST',
        headers: headers(credentials, { 'Content-Type': 'application/zip' }),
        body: await readFile(zip),
    });
    const uploadId = await expectAccepted(upload, 'Upload');
    const uploaded = await waitForOperation(`${product}/draft/package/operations/${uploadId}`, credentials, {
        fetchImpl,
        intervalMs,
    });
    log(`Upload processed: ${uploaded.message}`);

    log('Submitting the update…');
    const publish = await fetchImpl(product, {
        method: 'POST',
        headers: headers(credentials, { 'Content-Type': 'application/json' }),
        body: JSON.stringify({ notes }),
    });
    const publishId = await expectAccepted(publish, 'Publish');
    const published = await waitForOperation(`${product}/operations/${publishId}`, credentials, {
        fetchImpl,
        intervalMs,
    });
    log(`Submitted: ${published.message}. Microsoft reviews it before it goes live.`);
    return published;
}

/** The zip semantic-release built in this run, if any */
export async function findReleaseZip(dir = 'release') {
    const files = await readdir(dir).catch(() => []);
    const zips = files.filter(f => /^tabplex-v\d+\.\d+\.\d+\.zip$/.test(f)).sort();
    return zips.length ? path.join(dir, zips[zips.length - 1]) : null;
}

async function main() {
    const zip = process.argv[2] ?? (await findReleaseZip());
    if (!zip) {
        console.log('No release zip in release/: nothing was released, so there is nothing to publish to Edge.');
        return;
    }
    const { EDGE_CLIENT_ID: clientId, EDGE_API_KEY: apiKey, EDGE_PRODUCT_ID: productId } = process.env;
    const missing = Object.entries({ EDGE_CLIENT_ID: clientId, EDGE_API_KEY: apiKey, EDGE_PRODUCT_ID: productId })
        .filter(([, value]) => !value)
        .map(([name]) => name);
    if (missing.length) throw new Error(`Missing ${missing.join(', ')}`);

    const version = path.basename(zip).match(/v(\d+\.\d+\.\d+)/)?.[1] ?? 'unknown';
    const notes = `TabPlex ${version}. Release notes: ${REPO}/releases/tag/v${version}`;
    await publishToEdge({ zip, notes, productId, clientId, apiKey });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    main().catch(error => {
        console.error(`Edge Add-ons publish failed: ${error.message}`);
        process.exit(1);
    });
}
