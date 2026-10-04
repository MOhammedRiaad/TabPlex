import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    SUMMARY_MAX,
    buildSummaryInput,
    cleanSummary,
    createSummarizer,
    getSummaryAvailability,
    summarizeContext,
} from '../aiSummary';

/** What Chrome's Summarizer actually returned for a parked task (manual test, 2026-10-04) */
const CHATTY =
    'Okay, I understand the task. The problem is that checkout requests are hanging in production due to fetch ' +
    'requests lacking timeouts. The initial investigation points to this issue being in `checkout.ts`, and the ' +
    "proposed solution is to add `AbortSignal.timeout` to the fetch calls. Here's a breakdown of the steps:\n\n" +
    '**1. Understanding the Problem - The Hang**\n* **Fetch Without Timeout:** When a `fetch` request';

describe('cleanSummary', () => {
    it('turns a chatty Markdown answer into at most two plain sentences', () => {
        const clean = cleanSummary(CHATTY);
        expect(clean.startsWith('The problem is that checkout requests are hanging')).toBe(true);
        expect(clean).not.toMatch(/Okay|Here's|\*\*|`|breakdown/);
        expect(clean.length).toBeLessThanOrEqual(SUMMARY_MAX);
        expect(clean.endsWith('…')).toBe(true);
    });

    it('keeps a good summary as it is, and is idempotent', () => {
        const good = 'You were comparing Stripe and Paddle fees. Next: check VAT handling.';
        expect(cleanSummary(`  ${good}  `)).toBe(good);
        expect(cleanSummary(cleanSummary(CHATTY))).toBe(cleanSummary(CHATTY));
    });

    it('drops bullets, headings and code blocks, and keeps two sentences', () => {
        expect(cleanSummary('# Summary\n- You were reading docs.\n- Then tests.\n- Then more.')).toBe(
            'You were reading docs. Then tests.'
        );
        expect(cleanSummary('You fixed a bug.\n```js\nconst x = 1;\n```')).toBe('You fixed a bug.');
        expect(cleanSummary('Sure! You were planning a trip')).toBe('You were planning a trip');
        expect(cleanSummary('')).toBe('');
    });

    it('cuts one very long sentence at a word boundary', () => {
        const long = `You were ${'reading about layout '.repeat(30)}`;
        const clean = cleanSummary(long);
        expect(clean.length).toBeLessThanOrEqual(SUMMARY_MAX);
        expect(clean).toMatch(/\w…$/);
    });
});

const stubSummarizer = (impl: Record<string, unknown>) => vi.stubGlobal('Summarizer', impl);

describe('aiSummary', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('reports unsupported when the API is missing', async () => {
        expect(await getSummaryAvailability()).toBe('unsupported');
        await expect(createSummarizer()).rejects.toThrow('not available');
    });

    it('passes availability through and treats errors as unavailable', async () => {
        const availability = vi.fn().mockResolvedValue('downloadable');
        stubSummarizer({ availability });
        expect(await getSummaryAvailability()).toBe('downloadable');
        expect(availability.mock.calls[0][0]).not.toHaveProperty('monitor');

        stubSummarizer({ availability: vi.fn().mockRejectedValue(new Error('x')) });
        expect(await getSummaryAvailability()).toBe('unavailable');
    });

    it('creates a summarizer and reports download progress', async () => {
        const target = new EventTarget();
        const create = vi.fn(async (options: { monitor: (m: EventTarget) => void }) => {
            options.monitor(target);
            const progress = new Event('downloadprogress') as Event & { loaded: number };
            progress.loaded = 0.5;
            target.dispatchEvent(progress);
            return { summarize: vi.fn() };
        });
        stubSummarizer({ create });
        const onProgress = vi.fn();
        await createSummarizer(onProgress);
        expect(create).toHaveBeenCalledWith(expect.objectContaining({ type: 'tldr', format: 'plain-text' }));
        expect(onProgress).toHaveBeenCalledWith(0.5);
        await createSummarizer(); // progress callback optional
    });

    it('builds a compact input without query strings', () => {
        const input = buildSummaryInput(
            { title: 'Pricing', description: 'Q4 page' },
            [
                { url: 'https://www.stripe.com/pricing?token=secret', title: 'Stripe pricing' },
                { url: 'https://paddle.com/', title: 'Paddle' },
                { url: 'not a url', title: 'Raw' },
            ],
            'stopped at VAT'
        );
        expect(input).toContain('Task: Pricing');
        expect(input).toContain('Task description: Q4 page');
        expect(input).toContain('Their note: stopped at VAT');
        expect(input).toContain('- Stripe pricing (stripe.com/pricing)');
        expect(input).toContain('- Paddle (paddle.com)');
        expect(input).toContain('- Raw (not a url)');
        expect(input).not.toContain('secret');
    });

    it('truncates very long input', () => {
        const tabs = Array.from({ length: 200 }, (_, i) => ({ url: `https://site${i}.dev/page`, title: `Tab ${i}` }));
        const input = buildSummaryInput({ title: 'Big' }, tabs);
        expect(input.length).toBeLessThanOrEqual(3501);
        expect(input.endsWith('…')).toBe(true);
    });

    it('summarizes and trims the result', async () => {
        const summarize = vi.fn().mockResolvedValue('  You were comparing fees.  ');
        expect(await summarizeContext({ summarize }, { title: 'T' }, [], undefined)).toBe('You were comparing fees.');
        expect(summarize.mock.calls[0][0]).toContain('Task: T');
    });
});
