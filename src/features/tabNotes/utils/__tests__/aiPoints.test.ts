import { describe, expect, it, vi } from 'vitest';
import { AiSession } from '../../../ai/utils/promptApi';
import { AI_FALLBACK_CHAR_BUDGET } from '../../../ai/constants';
import { POINT_MAX_CHARS, POINTS_PER_SOURCE_MAX } from '../../constants';
import { CleanPage, NoteSource } from '../../types';
import { POINTS_SCHEMA, cleanPointText, extractPointsAi, looksCutOff, validatePoints } from '../aiPoints';
import { extractPointsQuick } from '../quickPoints';

const source: NoteSource = {
    ref: 2,
    tabId: 7,
    windowId: 1,
    title: 'DNS caching',
    url: 'https://dns.example/caching?token=secret',
    mode: 'ai',
    truncated: false,
    notEnglish: false,
};

const pageOf = (paragraphs: string[], extra: Partial<CleanPage> = {}): CleanPage => ({
    sections: [{ heading: '', paragraphs }],
    description: '',
    chars: paragraphs.join('').length,
    truncated: false,
    notEnglish: false,
    ...extra,
});

const PARAGRAPHS = [
    'DNS caching stores answers from resolvers for the time given by the TTL field of each record.',
    'A TTL of 3600 seconds means a resolver may reuse the answer for one hour before it asks again.',
    'Browsers keep their own DNS cache, which is flushed when the network connection changes.',
];
const page = pageOf(PARAGRAPHS);

const GOOD = {
    text: 'DNS caching stores answers from resolvers for the time given by the TTL field of each record.',
    topic: 'DNS caching',
};
const SECOND = { text: 'A TTL of 3600 seconds means a resolver may reuse the answer.', topic: 'TTL' };
/** Not in the page at all */
const UNGROUNDED = { text: 'Quantum entanglement lets photons teleport across galaxies instantly.', topic: 'physics' };
/** Words are in the page, but the number is not */
const INVENTED = { text: 'The TTL of every DNS record is 9999 seconds in the browser cache.', topic: 'TTL' };

const json = (points: unknown[]) => JSON.stringify({ points });
const QUOTA = new DOMException('too many tokens', 'QuotaExceededError');

const session = (overrides: Partial<AiSession> = {}): AiSession => ({
    prompt: vi.fn(),
    destroy: vi.fn(),
    ...overrides,
});

/** A session whose answers come in this order; a string is an answer, anything else a failure */
const answering = (...replies: (string | Error)[]): AiSession => {
    const prompt = vi.fn();
    for (const reply of replies) {
        if (typeof reply === 'string') prompt.mockResolvedValueOnce(reply);
        else prompt.mockRejectedValueOnce(reply);
    }
    return session({ prompt });
};

/** A base session whose clone() makes sessions with `makeClone`; `clones` records each one for the spies */
function baseWith(makeClone: () => AiSession) {
    const clones: AiSession[] = [];
    const clone = vi.fn(async (_options?: { signal?: AbortSignal }) => {
        const made = makeClone();
        clones.push(made);
        return made;
    });
    return { base: session({ clone }), clone, clones };
}

/** Walks a schema and collects every key, at any depth */
function keysOf(node: unknown, found: string[] = []): string[] {
    if (Array.isArray(node)) {
        for (const child of node) keysOf(child, found);
    } else if (node && typeof node === 'object') {
        for (const [key, value] of Object.entries(node)) {
            found.push(key);
            keysOf(value, found);
        }
    }
    return found;
}

describe('POINTS_SCHEMA', () => {
    it('has no maxLength anywhere (the model squeezes text to fit a cap)', () => {
        const keys = keysOf(POINTS_SCHEMA);
        expect(keys).toContain('minItems');
        expect(keys).not.toContain('maxLength');
    });
});

describe('cleanPointText', () => {
    it('turns link syntax into its label, and removes bare URLs', () => {
        expect(cleanPointText('See [the docs](https://a.example/x) now')).toBe('See the docs now');
        expect(cleanPointText('![Chart of TTL](https://x.example/c.png) shows drops')).toBe('Chart of TTL shows drops');
        expect(cleanPointText('Read [label][1] text')).toBe('Read label text');
        expect(cleanPointText('<https://evil.example> is here')).toBe('is here');
        expect(cleanPointText('Visit https://evil.example/now today')).toBe('Visit today');
    });

    it('removes emphasis and code markers, leading block markers and repeated bullets', () => {
        expect(cleanPointText('**Bold** and `code` and ~~gone~~')).toBe('Bold and code and gone');
        expect(cleanPointText('## Heading text')).toBe('Heading text');
        expect(cleanPointText('- 1. 2) item')).toBe('item');
        expect(cleanPointText('- [x] done')).toBe('done');
        expect(cleanPointText('> quoted')).toBe('quoted');
        expect(cleanPointText('2024. A year')).toBe('2024. A year');
    });

    it('collapses whitespace and cuts long text on a word boundary with an ellipsis', () => {
        expect(cleanPointText('  one \n\t two  ')).toBe('one two');
        const cut = cleanPointText('word '.repeat(100));
        expect(cut.endsWith('…')).toBe(true);
        expect(cut.length).toBeLessThanOrEqual(POINT_MAX_CHARS);
        expect(cleanPointText('a'.repeat(300))).toBe(`${'a'.repeat(POINT_MAX_CHARS - 1)}…`);
        expect(cleanPointText('x', 5)).toBe('x');
    });
});

describe('looksCutOff', () => {
    it.each([
        ['Inheritance lets subclasses inherit methods from superclasses, forming an', true],
        ['Classes are blueprints for objects and', true],
        ['Objects are linked through the', true],
        ['Um objeto é criado a partir de uma', true],
        ['A resolver keeps the answer until the TTL runs out,', true],
        ['Three kinds of cache:', true],
        ['Caching is done in two places (', true],
        ['A resolver keeps the answer until the TTL runs out.', false],
        ['Is the cache warm?', false],
        ['Prototypes form a chain (see below).', false],
        ['Methods are looked up on the prototype', false],
        ['The result is the list of values in the array', false],
    ])('%s -> %s', (text, expected) => {
        expect(looksCutOff(text)).toBe(expected);
    });

    it('does not call a sentence cut off because it ends on a function word followed by a full stop', () => {
        expect(looksCutOff('This is what the object is for.')).toBe(false);
    });
});

describe('validatePoints', () => {
    it('drops a point the model stopped in the middle of, even though every word is on the page', () => {
        const cut = { text: 'DNS caching stores answers from resolvers for the time given by the', topic: 'DNS' };
        expect(validatePoints({ points: [cut, GOOD] }, page)).toEqual([{ text: GOOD.text, topicHint: 'DNS caching' }]);
        expect(validatePoints({ points: [cut] }, page)).toBeNull();
    });

    it('returns null unless the output has a points array', () => {
        expect(validatePoints('nope', page)).toBeNull();
        expect(validatePoints(null, page)).toBeNull();
        expect(validatePoints({}, page)).toBeNull();
        expect(validatePoints({ points: 'x' }, page)).toBeNull();
    });

    it('keeps grounded points with their topic and drops ungrounded points and invented numbers', () => {
        expect(validatePoints({ points: [GOOD, UNGROUNDED, INVENTED] }, page)).toEqual([
            { text: GOOD.text, topicHint: 'DNS caching' },
        ]);
        expect(validatePoints({ points: [UNGROUNDED, INVENTED] }, page)).toBeNull();
    });

    it('drops points under the minimum length, duplicates (any case) and malformed items', () => {
        const kept = validatePoints(
            {
                points: [
                    null,
                    5,
                    { text: 7 },
                    { text: 'Too short' },
                    GOOD,
                    { text: GOOD.text.toUpperCase(), topic: 'again' },
                ],
            },
            page
        );
        expect(kept).toEqual([{ text: GOOD.text, topicHint: 'DNS caching' }]);
    });

    it('gives an empty topic hint when the topic is missing, and cuts a long topic', () => {
        expect(validatePoints({ points: [{ text: GOOD.text }] }, page)).toEqual([{ text: GOOD.text, topicHint: '' }]);
        const [point] = validatePoints({ points: [{ ...GOOD, topic: `**${'topic '.repeat(20)}` }] }, page) ?? [];
        expect(point.topicHint.length).toBeLessThanOrEqual(60);
        expect(point.topicHint).not.toContain('*');
    });

    it('keeps at most the schema maximum of points', () => {
        const sentences = Array.from(
            { length: POINTS_PER_SOURCE_MAX + 2 },
            (_, i) =>
                `Caching rule number ${['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight'][i]} keeps answers.`
        );
        const kept = validatePoints({ points: sentences.map(text => ({ text, topic: 'rules' })) }, pageOf(sentences));
        expect(kept).toHaveLength(POINTS_PER_SOURCE_MAX);
    });
});

describe('extractPointsAi', () => {
    it('clones the base session once per page, sends the page with no query string, and destroys only the clone', async () => {
        const made = answering(json([GOOD]));
        const { base, clone, clones } = baseWith(() => made);
        const result = await extractPointsAi(base, source, page, new AbortController().signal);

        expect(clone).toHaveBeenCalledTimes(1);
        expect(clone.mock.calls[0][0]).toMatchObject({ signal: expect.any(AbortSignal) });
        expect(clones[0]).toBe(made);
        expect(made.destroy).toHaveBeenCalledTimes(1);
        expect(base.destroy).not.toHaveBeenCalled();

        const [input, options] = (made.prompt as ReturnType<typeof vi.fn>).mock.calls[0];
        expect(input).toMatch(/^Page: DNS caching \(dns\.example\/caching\)\n\n/);
        expect(input).not.toContain('token');
        expect(options).toMatchObject({ responseConstraint: POINTS_SCHEMA, omitResponseConstraintInput: true });

        expect(result).toEqual({
            mode: 'ai',
            truncated: false,
            points: [{ id: 'p2-1', sourceRef: 2, text: GOOD.text, topicHint: 'DNS caching' }],
        });
    });

    it('uses a fresh clone for each page and destroys each one', async () => {
        const { base, clone, clones } = baseWith(() => answering(json([GOOD])));
        const controller = new AbortController();
        await extractPointsAi(base, source, page, controller.signal);
        await extractPointsAi(base, { ...source, ref: 3 }, page, controller.signal);
        expect(clone).toHaveBeenCalledTimes(2);
        expect(clones[0]).not.toBe(clones[1]);
        for (const made of clones) expect(made.destroy).toHaveBeenCalledTimes(1);
        expect(base.destroy).not.toHaveBeenCalled();
    });

    it('numbers points by source, in the order the model gave them', async () => {
        const { base } = baseWith(() => answering(json([GOOD, SECOND])));
        const result = await extractPointsAi(base, source, page, new AbortController().signal);
        expect(result.points.map(point => point.id)).toEqual(['p2-1', 'p2-2']);
        expect(result.points[1]).toEqual({ id: 'p2-2', sourceRef: 2, text: SECOND.text, topicHint: 'TTL' });
    });

    it('drops the bad points of an answer and keeps the good ones', async () => {
        const { base } = baseWith(() => answering(json([UNGROUNDED, GOOD, INVENTED])));
        const result = await extractPointsAi(base, source, page, new AbortController().signal);
        expect(result.mode).toBe('ai');
        expect(result.points.map(point => point.text)).toEqual([GOOD.text]);
    });

    it('strips link syntax from the model text', async () => {
        const linked = {
            text: '**DNS caching** stores answers from [resolvers](https://evil.example/x) for the TTL field.',
            topic: '[DNS](https://evil.example) caching',
        };
        const { base } = baseWith(() => answering(json([linked])));
        const result = await extractPointsAi(base, source, page, new AbortController().signal);
        expect(result.points).toEqual([
            {
                id: 'p2-1',
                sourceRef: 2,
                text: 'DNS caching stores answers from resolvers for the TTL field.',
                topicHint: 'DNS caching',
            },
        ]);
    });

    it('trims paragraphs that do not fit the context and reports truncated', async () => {
        const long = Array.from(
            { length: 20 },
            (_, i) => `Paragraph ${i}. ${'DNS caching keeps answers. '.repeat(20)}`
        );
        const longPage = pageOf([PARAGRAPHS[0], ...long.slice(1)]);
        const made = answering(json([GOOD]));
        const { base } = baseWith(() => made);
        const result = await extractPointsAi(base, source, longPage, new AbortController().signal);
        expect(result.truncated).toBe(true);
        expect(result.mode).toBe('ai');
        const input = (made.prompt as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
        expect(input.length).toBeLessThanOrEqual(AI_FALLBACK_CHAR_BUDGET);
        expect(input).toContain('DNS caching stores answers');
    });

    it('reports truncated when the page itself was cut', async () => {
        const { base } = baseWith(() => answering(json([GOOD])));
        const result = await extractPointsAi(
            base,
            source,
            pageOf(PARAGRAPHS, { truncated: true }),
            new AbortController().signal
        );
        expect(result.truncated).toBe(true);
    });

    it('sends section headings as "## heading" lines', async () => {
        const made = answering(json([GOOD]));
        const { base } = baseWith(() => made);
        const sections = [{ heading: 'Caching', paragraphs: [PARAGRAPHS[0]] }];
        await extractPointsAi(base, source, { ...page, sections }, new AbortController().signal);
        const input = (made.prompt as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
        expect(input).toContain('## Caching');
    });

    it('retries with the first half of the paragraphs when the input is too large', async () => {
        const made = answering(QUOTA, json([GOOD]));
        const { base } = baseWith(() => made);
        const result = await extractPointsAi(base, source, page, new AbortController().signal);
        const prompt = made.prompt as ReturnType<typeof vi.fn>;
        expect(prompt).toHaveBeenCalledTimes(2);
        expect(prompt.mock.calls[1][0].length).toBeLessThan(prompt.mock.calls[0][0].length);
        expect(result).toMatchObject({ mode: 'ai', truncated: true });
        expect(made.destroy).toHaveBeenCalledTimes(1);
    });

    it('falls back to the quick view when the input is too large twice', async () => {
        const made = answering(QUOTA, QUOTA);
        const { base } = baseWith(() => made);
        const result = await extractPointsAi(base, source, page, new AbortController().signal);
        expect(made.prompt).toHaveBeenCalledTimes(2);
        expect(result.mode).toBe('quick');
        expect(result.points).toEqual(extractPointsQuick(source, page));
    });

    it('falls back to the quick view when every model point is bad', async () => {
        const made = answering(json([UNGROUNDED, INVENTED]), json([UNGROUNDED, INVENTED]));
        const { base } = baseWith(() => made);
        const result = await extractPointsAi(base, source, page, new AbortController().signal);
        expect(made.prompt).toHaveBeenCalledTimes(2);
        expect(result.mode).toBe('quick');
        expect(result.points).toEqual(extractPointsQuick(source, page));
        expect(made.destroy).toHaveBeenCalledTimes(1);
    });

    it('falls back to the quick view on a model error and still destroys the clone', async () => {
        const made = answering(new Error('model crashed'));
        const { base } = baseWith(() => made);
        const result = await extractPointsAi(base, source, page, new AbortController().signal);
        expect(result.mode).toBe('quick');
        expect(made.destroy).toHaveBeenCalledTimes(1);
    });

    it('falls back to the quick view when the clone cannot be made, and never destroys the base', async () => {
        const noClone = session();
        const result = await extractPointsAi(noClone, source, page, new AbortController().signal);
        expect(result.mode).toBe('quick');
        expect(noClone.destroy).not.toHaveBeenCalled();

        const failing = session({ clone: vi.fn().mockRejectedValue(new Error('no memory')) });
        const failed = await extractPointsAi(failing, source, page, new AbortController().signal);
        expect(failed.mode).toBe('quick');
        expect(failing.destroy).not.toHaveBeenCalled();
    });

    it('propagates a cancel during the model call, and destroys the clone', async () => {
        const prompt = vi.fn(
            (_input: string, options?: { signal?: AbortSignal }) =>
                new Promise<string>((_resolve, reject) =>
                    options?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
                )
        );
        const made = session({ prompt });
        const { base } = baseWith(() => made);
        const controller = new AbortController();
        const pending = extractPointsAi(base, source, page, controller.signal);
        await vi.waitFor(() => expect(prompt).toHaveBeenCalled());
        controller.abort();
        await expect(pending).rejects.toMatchObject({ code: 'aborted' });
        expect(made.destroy).toHaveBeenCalledTimes(1);
    });

    it('does nothing when the signal is already aborted', async () => {
        const controller = new AbortController();
        controller.abort();
        const { base, clone } = baseWith(() => answering(json([GOOD])));
        await expect(extractPointsAi(base, source, page, controller.signal)).rejects.toMatchObject({
            code: 'aborted',
        });
        expect(clone).not.toHaveBeenCalled();
    });

    it('treats a cancel while cloning as a cancel, not a quick view', async () => {
        const controller = new AbortController();
        const base = session({
            clone: vi.fn(async () => {
                controller.abort();
                throw new DOMException('aborted', 'AbortError');
            }),
        });
        await expect(extractPointsAi(base, source, page, controller.signal)).rejects.toMatchObject({
            code: 'aborted',
        });
    });
});
