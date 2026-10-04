import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildSummaryInput, createSummarizer, getSummaryAvailability, summarizeContext } from '../aiSummary';

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
