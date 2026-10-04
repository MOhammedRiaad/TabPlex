import { describe, expect, it } from 'vitest';
import { fallbackDraft } from '../fallbackDraft';

const tab = (url: string, title = 'Some page') => ({ url, title });

describe('fallbackDraft', () => {
    it('is empty without tabs', () => {
        expect(fallbackDraft([])).toEqual({ title: '', description: '', priority: 'medium', steps: [] });
    });

    it('uses the cleaned title of a single tab, cut to 60 characters', () => {
        expect(fallbackDraft([tab('https://a.dev/x', '  “Read the RFC.”  ')]).title).toBe('Read the RFC');
        expect(fallbackDraft([tab('https://a.dev/x', 'w'.repeat(90))]).title).toHaveLength(60);
    });

    it('names the site when every tab is on it', () => {
        const draft = fallbackDraft([tab('https://docs.github.com/a'), tab('https://github.com/b')]);
        expect(draft).toEqual({ title: 'Research github.com', description: '', priority: 'medium', steps: [] });
    });

    it('uses the first tab title for mixed sites', () => {
        expect(fallbackDraft([tab('https://a.dev', 'Stripe pricing'), tab('https://b.dev')]).title).toBe(
            'Stripe pricing'
        );
    });

    it('falls back to the site when the first title is unusable', () => {
        expect(fallbackDraft([tab('https://news.bbc.co.uk/x', '–'), tab('https://b.dev')]).title).toBe(
            'Work on bbc.co.uk'
        );
        expect(fallbackDraft([tab('not a url', '–')]).title).toBe('');
    });
});
