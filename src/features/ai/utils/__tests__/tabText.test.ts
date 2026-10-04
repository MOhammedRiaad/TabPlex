import { describe, expect, it } from 'vitest';
import { clampTitle, describeTabForAi, shortUrlForAi } from '../tabText';

describe('tab text for AI prompts', () => {
    it.each([
        ['https://www.stripe.com/pricing?token=secret#plans', 'stripe.com/pricing'],
        ['https://paddle.com/', 'paddle.com'],
        ['https://docs.github.com/en/actions', 'docs.github.com/en/actions'],
        ['not a url', 'not a url'],
    ])('shortens %s to %s (no query or fragment)', (url, short) => {
        expect(shortUrlForAi(url)).toBe(short);
    });

    it('collapses whitespace and cuts long titles to exactly the limit', () => {
        expect(clampTitle('  Stripe   pricing \n page ')).toBe('Stripe pricing page');
        const cut = clampTitle('x'.repeat(200));
        expect(cut).toHaveLength(80);
        expect(cut.endsWith('…')).toBe(true);
        expect(clampTitle('short', 10)).toBe('short');
    });

    it('describes a tab, falling back to its URL for an empty title', () => {
        expect(describeTabForAi({ title: 'Stripe pricing', url: 'https://stripe.com/pricing' })).toBe(
            'Stripe pricing (stripe.com/pricing)'
        );
        expect(describeTabForAi({ title: '', url: 'https://a.dev/x' })).toBe('https://a.dev/x (a.dev/x)');
    });
});
