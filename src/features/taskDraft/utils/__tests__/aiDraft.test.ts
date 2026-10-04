import { describe, expect, it } from 'vitest';
import { DRAFT_SCHEMA, buildDraftInput, cleanLine, normalizeDraft } from '../aiDraft';
import { MAX_STEPS } from '../../types';

const EXAMPLE = {
    title: 'Compare Stripe and Paddle pricing',
    description: 'Decide which payment provider to use, focusing on fees and VAT handling.',
    priority: 'medium',
    steps: ['Compare transaction fees', 'Check VAT handling for EU', 'Write up a recommendation'],
};

const draft = (overrides: Record<string, unknown>) => normalizeDraft({ ...EXAMPLE, ...overrides });

describe('buildDraftInput', () => {
    const tabs = [
        { title: 'Stripe pricing', url: 'https://stripe.com/pricing?ref=nav' },
        { title: 'Paddle | Pricing', url: 'https://www.paddle.com/pricing' },
    ];

    it('lists the tabs as bullets with short addresses and ends with the request', () => {
        const input = buildDraftInput(tabs);
        expect(input).toBe(
            'Tabs:\n- Stripe pricing (stripe.com/pricing)\n- Paddle | Pricing (paddle.com/pricing)\n\nDraft the task.'
        );
        expect(input).not.toContain('ref=nav');
    });

    it('adds a trimmed hint, cut to 120 characters, only when given', () => {
        expect(buildDraftInput(tabs, '  for the Q4 launch ')).toContain('\n\nTheir hint: for the Q4 launch\n\nDraft');
        expect(buildDraftInput(tabs, '   ')).not.toContain('Their hint');
        const long = buildDraftInput(tabs, 'x'.repeat(200));
        expect(long).toContain(`Their hint: ${'x'.repeat(120)}\n`);
    });
});

describe('DRAFT_SCHEMA', () => {
    it('requires every field, allows up to 5 steps and puts no length cap on text', () => {
        expect(DRAFT_SCHEMA.required).toEqual(['title', 'description', 'priority', 'steps']);
        expect(DRAFT_SCHEMA.properties.steps.maxItems).toBe(MAX_STEPS);
        expect(DRAFT_SCHEMA.properties.priority.enum).toEqual(['low', 'medium', 'high']);
        // Chrome's built-in AI guidance: length is enforced by normalizeDraft, not the schema
        expect(JSON.stringify(DRAFT_SCHEMA)).not.toContain('maxLength');
    });
});

describe('cleanLine', () => {
    it('collapses spaces, unwraps quotes, drops emoji and one trailing period', () => {
        expect(cleanLine('  “Plan   the trip.”  ')).toBe('Plan the trip');
        expect(cleanLine("'Read docs'")).toBe('Read docs');
        expect(cleanLine('Wait...')).toBe('Wait..');
        expect(cleanLine('🎉')).toBe('');
    });
});

describe('normalizeDraft', () => {
    it('D1: keeps a valid answer as is', () => {
        expect(normalizeDraft(EXAMPLE)).toEqual(EXAMPLE);
    });

    it('D2: removes wrapping quotes and the trailing period', () => {
        expect(draft({ title: '"Compare fees."' })!.title).toBe('Compare fees');
    });

    it('D3: removes emoji and extra spaces', () => {
        expect(draft({ title: 'Plan 🏖️  trip' })!.title).toBe('Plan trip');
    });

    it('D4: rejects a title shorter than 3 characters', () => {
        expect(draft({ title: 'ab' })).toBeNull();
        expect(draft({ title: undefined })).toBeNull();
    });

    it('D5: cuts a long title to 80 characters', () => {
        expect(draft({ title: 'a'.repeat(120) })!.title).toHaveLength(80);
    });

    it('D6: falls back to medium for an unknown priority', () => {
        expect(draft({ priority: 'urgent' })!.priority).toBe('medium');
        expect(draft({ priority: 'high' })!.priority).toBe('high');
    });

    it('D7: drops short and duplicate steps, keeps at most 5', () => {
        expect(draft({ steps: ['Do A', 'do a', 'x', 'Do B', 'Do C', 'Do D', 'Do E', 'Do F'] })!.steps).toEqual([
            'Do A',
            'Do B',
            'Do C',
            'Do D',
            'Do E',
        ]);
    });

    it('D8: ignores steps that are not a list, and a step equal to the title', () => {
        expect(draft({ steps: 'Do A' })!.steps).toEqual([]);
        expect(draft({ steps: ['compare stripe and paddle pricing', 'Sign up'] })!.steps).toEqual(['Sign up']);
    });

    it('D9: empties a description that is not text, and cuts long ones', () => {
        expect(draft({ description: 42 })!.description).toBe('');
        expect(draft({ description: `  ${'b'.repeat(400)}` })!.description).toHaveLength(280);
    });

    it('D10: empties a description equal to the title', () => {
        expect(draft({ description: 'COMPARE STRIPE AND PADDLE PRICING' })!.description).toBe('');
    });

    it('D11: rejects answers that are not an object', () => {
        expect(normalizeDraft(null)).toBeNull();
        expect(normalizeDraft([])).toBeNull();
        expect(normalizeDraft('text')).toBeNull();
    });

    it('cuts long steps to 80 characters', () => {
        expect(draft({ steps: ['s'.repeat(100)] })!.steps[0]).toHaveLength(80);
    });
});
