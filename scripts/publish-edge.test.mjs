import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { API, findReleaseZip, operationIdFrom, publishToEdge, waitForOperation } from './publish-edge.mjs';

const PRODUCT = 'd34f98f5-f9b7-42b1-bebb-98707202b21d';
const credentials = { clientId: 'client-1', apiKey: 'key-1' };

const json = (body, status = 200) => new Response(JSON.stringify(body), { status });
const accepted = location => new Response(null, { status: 202, headers: { Location: location } });

async function zipFile() {
    const dir = await mkdtemp(path.join(tmpdir(), 'edge-'));
    const file = path.join(dir, 'tabplex-v1.2.3.zip');
    await writeFile(file, 'zip-bytes');
    return file;
}

/** A fake Edge Add-ons API: scripted responses per URL, recording every request */
function fakeApi(routes) {
    const calls = [];
    const fetchImpl = vi.fn(async (url, init = {}) => {
        calls.push({ url, ...init });
        const handler = routes[`${init.method ?? 'GET'} ${url}`];
        if (!handler) throw new Error(`Unexpected request ${init.method ?? 'GET'} ${url}`);
        return typeof handler === 'function' ? handler() : handler;
    });
    return { fetchImpl, calls };
}

const base = `${API}/products/${PRODUCT}/submissions`;

describe('operationIdFrom', () => {
    it('takes the id from a bare value or the end of a path', () => {
        expect(operationIdFrom('op-1')).toBe('op-1');
        expect(operationIdFrom(' /v1/products/x/submissions/operations/op-2 ')).toBe('op-2');
        expect(() => operationIdFrom(null)).toThrow('no Location header');
    });
});

describe('waitForOperation', () => {
    it('polls while in progress and returns on success', async () => {
        const statuses = [json({ status: 'InProgress' }), json({ status: 'Succeeded', message: 'ok' })];
        const fetchImpl = vi.fn(async () => statuses.shift());
        await expect(waitForOperation('u', credentials, { fetchImpl, intervalMs: 0 })).resolves.toMatchObject({
            message: 'ok',
        });
        expect(fetchImpl).toHaveBeenCalledTimes(2);
        expect(fetchImpl.mock.calls[0][1].headers).toEqual({ Authorization: 'ApiKey key-1', 'X-ClientID': 'client-1' });
    });

    it("explains a failure, e.g. a version that's still in review", async () => {
        const fetchImpl = async () =>
            json({
                status: 'Failed',
                errorCode: 'InProgressSubmission',
                message: "Can't publish extension as your extension submission is in progress.",
                errors: null,
            });
        await expect(waitForOperation('u', credentials, { fetchImpl, intervalMs: 0 })).rejects.toThrow(
            /^InProgressSubmission: Can't publish/
        );
    });

    it('lists validation errors, gives up after the attempts, and reports HTTP errors', async () => {
        const failed = async () =>
            json({
                status: 'Failed',
                errorCode: 'ModuleStateUnPublishable',
                message: 'Invalid modules',
                errors: [{ message: 'Invalid module : Properties' }, 'second'],
            });
        await expect(waitForOperation('u', credentials, { fetchImpl: failed, intervalMs: 0 })).rejects.toThrow(
            'ModuleStateUnPublishable: Invalid modules (Invalid module : Properties; second)'
        );

        const stuck = async () => json({ status: 'InProgress' });
        await expect(
            waitForOperation('u', credentials, { fetchImpl: stuck, intervalMs: 0, attempts: 3 })
        ).rejects.toThrow('Still in progress after 3 checks');

        const unauthorized = async () => new Response('expired key', { status: 401 });
        await expect(waitForOperation('u', credentials, { fetchImpl: unauthorized })).rejects.toThrow(
            'HTTP 401 expired key'
        );
    });
});

describe('publishToEdge', () => {
    it('uploads the zip, waits, submits with notes, and waits again', async () => {
        const zip = await zipFile();
        const { fetchImpl, calls } = fakeApi({
            [`POST ${base}/draft/package`]: accepted('up-1'),
            [`GET ${base}/draft/package/operations/up-1`]: json({
                status: 'Succeeded',
                message: 'Successfully updated package',
            }),
            [`POST ${base}`]: accepted('/v1/products/x/submissions/operations/pub-1'),
            [`GET ${base}/operations/pub-1`]: json({ status: 'Succeeded', message: 'Successfully created submission' }),
        });
        const log = vi.fn();

        await publishToEdge({
            zip,
            notes: 'TabPlex 1.2.3',
            productId: PRODUCT,
            ...credentials,
            fetchImpl,
            intervalMs: 0,
            log,
        });

        expect(calls.map(c => `${c.method ?? 'GET'} ${c.url.replace(base, '')}`)).toEqual([
            'POST /draft/package',
            'GET /draft/package/operations/up-1',
            'POST ',
            'GET /operations/pub-1',
        ]);
        expect(calls[0].headers).toMatchObject({
            Authorization: 'ApiKey key-1',
            'X-ClientID': 'client-1',
            'Content-Type': 'application/zip',
        });
        expect(String(calls[0].body)).toBe('zip-bytes');
        expect(JSON.parse(calls[2].body)).toEqual({ notes: 'TabPlex 1.2.3' });
        expect(log).toHaveBeenLastCalledWith(expect.stringContaining('Microsoft reviews it'));
    });

    it('stops when the upload is rejected', async () => {
        const zip = await zipFile();
        const { fetchImpl, calls } = fakeApi({
            [`POST ${base}/draft/package`]: new Response('No package', { status: 400 }),
        });
        await expect(
            publishToEdge({ zip, notes: 'n', productId: PRODUCT, ...credentials, fetchImpl, log: () => undefined })
        ).rejects.toThrow('Upload failed: HTTP 400 No package');
        expect(calls).toHaveLength(1);
    });
});

describe('findReleaseZip', () => {
    it('finds the zip semantic-release built, or nothing', async () => {
        const dir = await mkdtemp(path.join(tmpdir(), 'release-'));
        expect(await findReleaseZip(dir)).toBeNull();
        expect(await findReleaseZip(path.join(dir, 'missing'))).toBeNull();
        await writeFile(path.join(dir, 'notes.txt'), '');
        await writeFile(path.join(dir, 'tabplex-v1.0.0.zip'), '');
        expect(await findReleaseZip(dir)).toBe(path.join(dir, 'tabplex-v1.0.0.zip'));
    });
});
