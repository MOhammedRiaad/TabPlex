import { describe, expect, it, vi } from 'vitest';
import { AiSession } from '../../../ai/utils/promptApi';
import { AiError } from '../../../ai/types';
import { KeyPoint, Topic } from '../../types';
import { cleanPointText } from '../aiPoints';
import { sourcesOf } from '../groupTopics';
import {
    COMBINE_SYSTEM,
    TOPICS_SYSTEM,
    canonicalTopics,
    cleanTopicName,
    combineSchema,
    combineTopic,
    combineTopicChecked,
    topicsSchema,
    validateCombine,
} from '../aiTopics';
import { COMBINE_TIMEOUT_MS } from '../../constants';
import { CORPUS_POINTS } from './fixtures/pages';
import { OOP_POINTS_TAGGED } from './fixtures/oop';

const pointOf = (id: string): KeyPoint => {
    const found = CORPUS_POINTS.find(point => point.id === id);
    if (!found) throw new Error(`no fixture point ${id}`);
    return found;
};

// DNS caching pages (refs 1, 3, 5). Labels in the order of DNS_POINTS: a, b, c, d, e
const A = pointOf('p1-1'); // "A DNS resolver keeps each answer it receives in a local cache…"
const B = pointOf('p3-1'); // "The resolver caches every answer it receives, so repeat lookups skip the network."
const C = pointOf('p5-1'); // the same sentence on page 5, "…so repeated lookups skip the network."
const T1 = pointOf('p1-2'); // TTL 300 seconds (page 1)
const T5 = pointOf('p5-2'); // TTL 3600 seconds (page 5)
const DNS_POINTS: KeyPoint[] = [A, B, C, T1, T5];

/** A shared topic with one bullet per point, as groupTopics makes it before combining */
const topicOf = (list: KeyPoint[], overrides: Partial<Topic> = {}): Topic => ({
    id: 't1',
    heading: 'DNS caching',
    kind: 'shared',
    combinedBy: 'words',
    bullets: list.map((point, n) => ({
        id: `b${n + 1}`,
        text: point.text,
        pointIds: [point.id],
        origin: 'point',
        edited: false,
    })),
    conflicts: [],
    ...overrides,
});

const answer = (heading: string, statements: unknown[], conflicts?: unknown[]) => ({
    heading,
    statements,
    ...(conflicts ? { conflicts } : {}),
});

const pointIdsOf = (topic: Topic): string[] =>
    topic.bullets.flatMap(bullet => bullet.pointIds).sort((a, b) => a.localeCompare(b));

const bulletPointIds = (topic: Topic): string[][] => topic.bullets.map(bullet => bullet.pointIds);

const bulletWith = (topic: Topic, ids: string[]) => topic.bullets.find(bullet => bullet.pointIds.join() === ids.join());

const ALL_IDS = DNS_POINTS.map(point => point.id).sort((a, b) => a.localeCompare(b));

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

const live = () => new AbortController().signal;

const json = (value: unknown) => JSON.stringify(value);

describe('TOPICS_SYSTEM and topicsSchema', () => {
    it('asks for JSON groups and treats the names as material', () => {
        expect(TOPICS_SYSTEM).toContain('"groups"');
        expect(TOPICS_SYSTEM).toContain('material');
    });

    it('bounds the member numbers by the count, with no maxLength anywhere', () => {
        const schema = topicsSchema(4);
        expect(keysOf(schema)).not.toContain('maxLength');
        expect(JSON.stringify(schema)).toContain('"maximum":4');
        expect(JSON.stringify(schema)).toContain('"minItems":2');
    });
});

describe('cleanTopicName', () => {
    it('removes Markdown, edge quotes, emoji and trailing punctuation', () => {
        expect(cleanTopicName('**DNS caching**.')).toBe('DNS caching');
        expect(cleanTopicName('“Name resolution” 🌐')).toBe('Name resolution');
    });

    it('cuts at 40 characters on a word boundary', () => {
        expect(cleanTopicName('Caching of DNS answers in the local resolver and browser')).toBe(
            'Caching of DNS answers in the local…'
        );
    });

    it('gives an empty string when nothing is left', () => {
        expect(cleanTopicName('🙂🙂')).toBe('');
    });
});

describe('canonicalTopics', () => {
    const TAGS = ['DNS caching', 'TTL', 'Caching DNS answers', 'Negative caching', 'CPU caches'];

    it('maps the members of a group to its name and every other tag to itself', async () => {
        const { base } = baseWith(() => answering(json({ groups: [{ name: 'DNS caching', members: [1, 3] }] })));
        const map = await canonicalTopics(base, TAGS, live());
        expect(map.get('Caching DNS answers')).toBe('DNS caching');
        expect(map.get('DNS caching')).toBe('DNS caching');
        expect(map.get('TTL')).toBe('TTL');
        expect(map.get('CPU caches')).toBe('CPU caches');
        expect(map.size).toBe(TAGS.length);
    });

    it('creates one clone for the run, destroys it, and never destroys the base', async () => {
        const made = answering(json({ groups: [] }));
        const { base, clone } = baseWith(() => made);
        await canonicalTopics(base, TAGS, live());
        expect(clone).toHaveBeenCalledTimes(1);
        expect(clone.mock.calls[0][0]).toMatchObject({ signal: expect.any(AbortSignal) });
        expect(made.destroy).toHaveBeenCalledTimes(1);
        expect(base.destroy).not.toHaveBeenCalled();
    });

    it('is skipped under three distinct tags, with no model call', async () => {
        const { base, clone } = baseWith(() => answering());
        const map = await canonicalTopics(base, ['DNS caching', 'TTL'], live());
        expect([...map.entries()]).toEqual([
            ['DNS caching', 'DNS caching'],
            ['TTL', 'TTL'],
        ]);
        expect(clone).not.toHaveBeenCalled();
    });

    it('is skipped when the caller says there is one source, with no model call', async () => {
        const { base, clone } = baseWith(() => answering());
        const map = await canonicalTopics(base, TAGS, live(), 1);
        expect(map.get('TTL')).toBe('TTL');
        expect(clone).not.toHaveBeenCalled();
    });

    it('ignores empty and repeated tags', async () => {
        const { base } = baseWith(() => answering(json({ groups: [] })));
        const map = await canonicalTopics(base, ['DNS caching', '', 'DNS caching', 'TTL', 'CPU caches'], live());
        expect([...map.keys()].sort()).toEqual(['CPU caches', 'DNS caching', 'TTL']);
    });

    it('ignores out-of-range, repeated and non-integer members, and groups left with fewer than two', async () => {
        const { base } = baseWith(() =>
            answering(
                json({
                    groups: [
                        { name: 'Caching', members: [1, 1, 9, 0, 1.5, '2'] },
                        { name: 'Lone', members: [4, 4] },
                        { name: 'Answers', members: [3, 4] },
                    ],
                })
            )
        );
        const map = await canonicalTopics(base, TAGS, live());
        expect(map.get('DNS caching')).toBe('DNS caching');
        expect(map.get('Caching DNS answers')).toBe('Answers');
        expect(map.get('Negative caching')).toBe('Answers');
        expect(map.get('TTL')).toBe('TTL');
        expect(map.get('CPU caches')).toBe('CPU caches');
    });

    it('keeps a tag in the first group when a second group repeats it', async () => {
        const { base } = baseWith(() =>
            answering(
                json({
                    groups: [
                        { name: 'Caching', members: [1, 3] },
                        { name: 'Caching', members: [3, 5] },
                    ],
                })
            )
        );
        const map = await canonicalTopics(base, TAGS, live());
        expect(map.get('Caching DNS answers')).toBe('Caching');
        expect(map.get('CPU caches')).toBe('CPU caches');
    });

    it('cleans the name, and falls back to the first member when the name is empty', async () => {
        const { base } = baseWith(() =>
            answering(
                json({
                    groups: [
                        { name: '"**DNS caching**."', members: [1, 3] },
                        { name: '', members: [4, 5] },
                    ],
                })
            )
        );
        const map = await canonicalTopics(base, TAGS, live());
        expect(map.get('Caching DNS answers')).toBe('DNS caching');
        expect(map.get('TTL')).toBe('TTL');
        expect(map.get('Negative caching')).toBe('Negative caching');
        expect(map.get('CPU caches')).toBe('Negative caching');
    });

    it('sends only the tags that fit, and ignores members that point at the tags left out', async () => {
        const measure = vi.fn(async (text: string) => text.split('\n').length);
        const made = session({ contextWindow: 4, measureContextUsage: measure });
        const { base } = baseWith(() => made);
        const prompt = vi.fn(async (_input: string, _options?: object) =>
            json({
                groups: [
                    { name: 'DNS caching', members: [1, 2] },
                    { name: 'Other', members: [3, 4] },
                ],
            })
        );
        made.prompt = prompt;
        const map = await canonicalTopics(base, TAGS, live());
        // TTL shares no word with DNS caching, so the model's pair is not taken; the group needs two plausible members
        expect(prompt.mock.calls[0][0]).toContain('1. DNS caching\n2. TTL');
        expect(prompt.mock.calls[0][0]).not.toContain('Caching DNS answers');
        expect(prompt.mock.calls[0][1]).toEqual({
            responseConstraint: topicsSchema(2),
            omitResponseConstraintInput: true,
            signal: expect.any(AbortSignal),
        });
        expect(map.get('TTL')).toBe('TTL');
        expect(map.get('Caching DNS answers')).toBe('Caching DNS answers');
        expect(map.get('Negative caching')).toBe('Negative caching');
        expect(made.destroy).toHaveBeenCalledTimes(1);
    });

    it('works on the real tags of the OOP fixture: a group of six subjects is ignored, so every tag keeps its name', async () => {
        const tags = [...new Set(OOP_POINTS_TAGGED.map(point => point.topicHint).filter(tag => tag !== ''))];
        const members = [1, 2, 3, 4, 5, 6];
        const { base } = baseWith(() =>
            answering(json({ groups: [{ name: 'Object-Oriented Programming (OOP)', members }] }))
        );
        const map = await canonicalTopics(base, tags, live());
        for (const tag of tags) expect(map.get(tag)).toBe(tag);
        expect(map.size).toBe(tags.length);
    });

    it('groups two tags of one subject when they share a word, such as an acronym', async () => {
        const tags = ['Object-Oriented Programming (OOP)', 'OOP basics', 'TTL'];
        const { base } = baseWith(() =>
            answering(json({ groups: [{ name: 'Object-Oriented Programming (OOP)', members: [1, 2] }] }))
        );
        const map = await canonicalTopics(base, tags, live());
        expect(map.get('OOP basics')).toBe('Object-Oriented Programming (OOP)');
        expect(map.get('TTL')).toBe('TTL');
    });

    it('rejects a group of more than four tags as a whole, even when the names share a word', async () => {
        const { base } = baseWith(() => answering(json({ groups: [{ name: 'Caching', members: [1, 3, 4, 5, 2] }] })));
        const map = await canonicalTopics(base, TAGS, live());
        for (const tag of TAGS) expect(map.get(tag)).toBe(tag);
    });

    it('accepts a group of tags that share words, with the model name when it shares a word too', async () => {
        const { base } = baseWith(() => answering(json({ groups: [{ name: 'Name caches', members: [1, 3] }] })));
        const map = await canonicalTopics(base, TAGS, live());
        expect(map.get('DNS caching')).toBe('Name caches');
        expect(map.get('Caching DNS answers')).toBe('Name caches');
    });

    it('uses the first member tag as the name when the model name shares no word with its members', async () => {
        const { base } = baseWith(() => answering(json({ groups: [{ name: 'Networking', members: [1, 3] }] })));
        const map = await canonicalTopics(base, TAGS, live());
        expect(map.get('DNS caching')).toBe('DNS caching');
        expect(map.get('Caching DNS answers')).toBe('DNS caching');
    });

    it('drops a member that shares no word with the others, and keeps the rest of the group', async () => {
        const { base } = baseWith(() => answering(json({ groups: [{ name: 'Caching', members: [1, 2, 3] }] })));
        const map = await canonicalTopics(base, TAGS, live());
        expect(map.get('DNS caching')).toBe('Caching');
        expect(map.get('Caching DNS answers')).toBe('Caching');
        expect(map.get('TTL')).toBe('TTL');
    });

    it('falls back to the identity map when the model fails, and destroys the clone', async () => {
        const made = answering(new Error('model crashed'));
        const { base } = baseWith(() => made);
        const map = await canonicalTopics(base, TAGS, live());
        expect(map.get('TTL')).toBe('TTL');
        expect(map.get('Caching DNS answers')).toBe('Caching DNS answers');
        expect(made.destroy).toHaveBeenCalledTimes(1);
    });

    it('asks again once for unusable output, then uses the second answer', async () => {
        const made = answering('not json', json({ groups: [{ name: 'DNS caching', members: [1, 3] }] }));
        const { base } = baseWith(() => made);
        const map = await canonicalTopics(base, TAGS, live());
        expect(made.prompt).toHaveBeenCalledTimes(2);
        expect(map.get('Caching DNS answers')).toBe('DNS caching');
    });

    it('falls back to the identity map when the answer has no groups list twice', async () => {
        const made = answering(json({ groups: 'none' }), json({ names: [] }));
        const { base } = baseWith(() => made);
        const map = await canonicalTopics(base, TAGS, live());
        expect(map.get('TTL')).toBe('TTL');
    });

    it('falls back to the identity map when no clone can be made, without destroying anything', async () => {
        const failing = session({ clone: vi.fn().mockRejectedValue(new Error('no memory')) });
        const map = await canonicalTopics(failing, TAGS, live());
        expect(map.get('TTL')).toBe('TTL');
        expect(failing.destroy).not.toHaveBeenCalled();
    });

    it('throws AiError aborted on a cancel, and destroys the clone', async () => {
        const controller = new AbortController();
        const made = session({
            prompt: vi.fn(async () => {
                controller.abort();
                throw new DOMException('Aborted', 'AbortError');
            }),
        });
        const { base } = baseWith(() => made);
        await expect(canonicalTopics(base, TAGS, controller.signal)).rejects.toBeInstanceOf(AiError);
        expect(made.destroy).toHaveBeenCalledTimes(1);
    });

    it('throws AiError aborted without starting when the signal is already aborted', async () => {
        const controller = new AbortController();
        controller.abort();
        const { base, clone } = baseWith(() => answering());
        await expect(canonicalTopics(base, TAGS, controller.signal)).rejects.toMatchObject({ code: 'aborted' });
        expect(clone).not.toHaveBeenCalled();
    });
});

describe('COMBINE_SYSTEM and combineSchema', () => {
    it('describes the statements, the labels and the conflicts', () => {
        expect(COMBINE_SYSTEM).toContain('"statements"');
        expect(COMBINE_SYSTEM).toContain('"conflicts"');
        expect(COMBINE_SYSTEM).toContain('material');
    });

    it('has no maxLength anywhere (built-in-ai rule 4)', () => {
        expect(keysOf(combineSchema(['a', 'b']))).not.toContain('maxLength');
    });

    it('makes the from items an enum of exactly this call labels, for statements and conflicts', () => {
        const schema = combineSchema(['a', 'c', 'd']) as {
            properties: {
                statements: { items: { properties: { from: { items: { enum: string[] } } } } };
                conflicts: { items: { properties: { from: { items: { enum: string[] } } } } };
            };
        };
        expect(schema.properties.statements.items.properties.from.items.enum).toEqual(['a', 'c', 'd']);
        expect(schema.properties.conflicts.items.properties.from.items.enum).toEqual(['a', 'c', 'd']);
    });
});

describe('validateCombine', () => {
    const topic = topicOf(DNS_POINTS);

    it('drops unknown labels, and keeps the statement when its known labels remain', () => {
        const raw = answer('DNS caching', [
            {
                text: 'Resolver answers are cached so repeat lookups skip the network.',
                from: ['a', 'zz', 'p3-1', 'b'],
            },
        ]);
        const result = validateCombine(raw, topic, DNS_POINTS);
        expect(result.combinedBy).toBe('ai');
        expect(bulletPointIds(result)).toContainEqual(['p1-1', 'p3-1']);
        expect(pointIdsOf(result)).toEqual(ALL_IDS);
    });

    it('keeps a label with the first statement that uses it', () => {
        const raw = answer('DNS caching', [
            {
                text: 'The resolver caches every answer it receives, so repeat lookups skip the network.',
                from: ['a', 'b'],
            },
            { text: 'Repeat lookups skip the network because the resolver caches answers.', from: ['b', 'c'] },
        ]);
        const result = validateCombine(raw, topic, DNS_POINTS);
        expect(bulletPointIds(result).filter(ids => ids.includes('p3-1'))).toEqual([['p1-1', 'p3-1']]);
        expect(bulletWith(result, ['p5-1'])?.text).toBe(C.text);
        expect(bulletWith(result, ['p5-1'])?.origin).toBe('point');
    });

    it('splits off a label whose point shares too few words with the statement (citation check)', () => {
        const raw = answer('DNS caching', [
            {
                text: 'The resolver caches every answer it receives, so repeat lookups skip the network.',
                from: ['a', 'b', 'd'],
            },
        ]);
        const result = validateCombine(raw, topic, DNS_POINTS);
        expect(bulletWith(result, ['p1-1', 'p3-1'])?.origin).toBe('ai');
        const split = bulletWith(result, ['p1-2']);
        expect(split?.origin).toBe('point');
        expect(split?.text).toBe(T1.text);
    });

    it('drops a statement whose number is not in each cited point, and its points come back on their own', () => {
        const raw = answer('DNS caching', [
            {
                text: 'The resolver caches every answer it receives, so repeat lookups skip the network.',
                from: ['a', 'b'],
            },
            {
                text: 'The default TTL on most DNS records is 3600 seconds, so cached answers expire after an hour.',
                from: ['d', 'e'],
            },
        ]);
        const result = validateCombine(raw, topic, DNS_POINTS);
        expect(bulletPointIds(result)).not.toContainEqual(['p1-2', 'p5-2']);
        expect(bulletWith(result, ['p1-2'])?.text).toBe(T1.text);
        expect(bulletWith(result, ['p5-2'])?.text).toBe(T5.text);
        expect(pointIdsOf(result)).toEqual(ALL_IDS);
    });

    it('keeps the grouping with the most central point text when the statement is not grounded in its points', () => {
        const raw = answer('DNS caching', [
            {
                text: 'Resolver cache answers expire by TTL, like photon violin telescope galaxy.',
                from: ['a', 'd'],
            },
        ]);
        const result = validateCombine(raw, topic, DNS_POINTS);
        const grouped = bulletWith(result, ['p1-1', 'p1-2']);
        expect(grouped?.origin).toBe('point');
        expect(grouped?.text).toBe(A.text);
        expect(result.combinedBy).toBe('ai');
    });

    it('uses the own text of a point for a statement with one label', () => {
        const raw = answer('DNS caching', [
            { text: 'Resolvers cache every answer, so repeat lookups skip the network.', from: ['a', 'c'] },
            { text: 'Resolver answers are cached so repeat lookups skip the network.', from: ['b'] },
        ]);
        const result = validateCombine(raw, topic, DNS_POINTS);
        const single = bulletWith(result, ['p3-1']);
        expect(single?.origin).toBe('point');
        expect(single?.text).toBe(B.text);
        expect(single?.edited).toBe(false);
    });

    it('gives a statement with two or more labels origin ai, with its text cleaned through cleanPointText', () => {
        const text =
            '**Resolvers** cache every answer they receive, so repeat lookups skip the network. See [the docs](https://evil.example/x).';
        const result = validateCombine(answer('DNS caching', [{ text, from: ['a', 'b'] }]), topic, DNS_POINTS);
        const merged = bulletWith(result, ['p1-1', 'p3-1']);
        expect(merged?.origin).toBe('ai');
        expect(merged?.text).toBe(cleanPointText(text));
        expect(merged?.text).toBe(
            'Resolvers cache every answer they receive, so repeat lookups skip the network. See the docs.'
        );
    });

    it('gives back every point that no statement used, as its own bullet', () => {
        const result = validateCombine(
            answer('DNS caching', [
                {
                    text: 'The resolver caches every answer it receives, so repeat lookups skip the network.',
                    from: ['a', 'b'],
                },
            ]),
            topic,
            DNS_POINTS
        );
        expect(pointIdsOf(result)).toEqual(ALL_IDS);
        for (const id of ['p5-1', 'p1-2', 'p5-2']) {
            const own = result.bullets.find(bullet => bullet.pointIds.join() === id);
            expect(own?.origin).toBe('point');
        }
    });

    it('orders bullets by number of sources, then lowest source ref, then point order', () => {
        const result = validateCombine(
            answer('DNS caching', [
                {
                    text: 'The resolver caches every answer it receives, so repeat lookups skip the network.',
                    from: ['a', 'b'],
                },
            ]),
            topic,
            DNS_POINTS
        );
        expect(bulletPointIds(result)).toEqual([['p1-1', 'p3-1'], ['p1-2'], ['p5-1'], ['p5-2']]);
        expect(new Set(result.bullets.map(bullet => bullet.id)).size).toBe(result.bullets.length);
    });

    it('keeps a conflict only with two labels from two sources, and its text when the text passes the check', () => {
        const raw = answer(
            'DNS caching',
            [
                {
                    text: 'The resolver caches every answer it receives, so repeat lookups skip the network.',
                    from: ['a', 'b'],
                },
            ],
            [
                { text: 'The default TTL is 300 seconds, but 3600 seconds elsewhere.', from: ['d', 'e'] },
                { text: 'Two labels, one source.', from: ['a', 'd'] },
                { text: 'Only one label.', from: ['e'] },
            ]
        );
        const result = validateCombine(raw, topic, DNS_POINTS);
        expect(result.conflicts).toEqual([
            { pointIds: ['p1-2', 'p5-2'], text: 'The default TTL is 300 seconds, but 3600 seconds elsewhere.' },
        ]);
    });

    it('replaces a model conflict text that does not match its points with an empty text', () => {
        const raw = answer(
            'DNS caching',
            [
                {
                    text: 'The resolver caches every answer it receives, so repeat lookups skip the network.',
                    from: ['a', 'b'],
                },
            ],
            [{ text: 'Penguins migrate north during winter storms.', from: ['d', 'e'] }]
        );
        const result = validateCombine(raw, topic, DNS_POINTS);
        expect(result.conflicts).toEqual([{ pointIds: ['p1-2', 'p5-2'], text: '' }]);
    });

    it('keeps a word-grouping conflict, and the model text wins over it when it passes', () => {
        const codeConflict = { pointIds: ['p1-2', 'p5-2'], text: '' };
        const base = topicOf(DNS_POINTS, { conflicts: [codeConflict] });
        const merged = answer(
            'DNS caching',
            [
                {
                    text: 'The resolver caches every answer it receives, so repeat lookups skip the network.',
                    from: ['a', 'b'],
                },
            ],
            [{ text: 'The default TTL is 300 seconds, but 3600 seconds elsewhere.', from: ['e', 'd'] }]
        );
        const result = validateCombine(merged, base, DNS_POINTS);
        expect(result.conflicts).toEqual([
            { pointIds: ['p1-2', 'p5-2'], text: 'The default TTL is 300 seconds, but 3600 seconds elsewhere.' },
        ]);
        const silent = validateCombine(
            answer('DNS caching', [
                {
                    text: 'The resolver caches every answer it receives, so repeat lookups skip the network.',
                    from: ['a', 'b'],
                },
            ]),
            base,
            DNS_POINTS
        );
        expect(silent.conflicts).toEqual([codeConflict]);
    });

    it('keeps the word-grouping conflict text when the model text is not a string or fails the check', () => {
        const base = topicOf(DNS_POINTS, { conflicts: [{ pointIds: ['p1-2', 'p5-2'], text: '' }] });
        const raw = answer(
            'DNS caching',
            [
                {
                    text: 'The resolver caches every answer it receives, so repeat lookups skip the network.',
                    from: ['a', 'b'],
                },
            ],
            [
                { text: 42, from: ['d', 'e'] },
                { text: 'Penguins migrate north during winter storms.', from: ['e', 'd'] },
            ]
        );
        expect(validateCombine(raw, base, DNS_POINTS).conflicts).toEqual([{ pointIds: ['p1-2', 'p5-2'], text: '' }]);
    });

    it('uses the first member of a group as the name when the name is not a string', async () => {
        const { base } = baseWith(() => answering(json({ groups: [{ name: 5, members: [1, 3] }] })));
        const map = await canonicalTopics(base, ['DNS caching', 'TTL', 'Caching DNS answers'], live());
        expect(map.get('Caching DNS answers')).toBe('DNS caching');
    });

    it('ignores a heading that is not a string and keeps the word-grouping heading', () => {
        const raw = answer('unused', [
            {
                text: 'The resolver caches every answer it receives, so repeat lookups skip the network.',
                from: ['a', 'b'],
            },
        ]);
        expect(validateCombine({ ...raw, heading: 7 }, topic, DNS_POINTS).heading).toBe('DNS caching');
    });

    it('uses the model heading after cleaning, and the word-grouping heading when it is empty', () => {
        const statement = [
            {
                text: 'The resolver caches every answer it receives, so repeat lookups skip the network.',
                from: ['a', 'b'],
            },
        ];
        expect(validateCombine(answer('**Name resolution**', statement), topic, DNS_POINTS).heading).toBe(
            'Name resolution'
        );
        expect(validateCombine(answer('  ', statement), topic, DNS_POINTS).heading).toBe('DNS caching');
    });

    it('sets combinedBy to ai only when a statement was merged, and keeps words otherwise', () => {
        const merged = validateCombine(
            answer('DNS caching', [
                {
                    text: 'The resolver caches every answer it receives, so repeat lookups skip the network.',
                    from: ['a', 'b'],
                },
            ]),
            topic,
            DNS_POINTS
        );
        expect(merged.combinedBy).toBe('ai');
        const single = answer('DNS caching', [
            { text: 'Resolver answers are cached so repeat lookups skip the network.', from: ['b'] },
        ]);
        expect(validateCombine(single, topic, DNS_POINTS).combinedBy).toBe('words');
    });

    it('never takes a source from model output: page numbers, URLs and extra fields change nothing', () => {
        const clean = answer('DNS caching', [
            {
                text: 'Resolvers cache every answer they receive, so repeat lookups skip the network.',
                from: ['a', 'b'],
            },
        ]);
        const forged = {
            heading: 'DNS caching',
            statements: [
                {
                    text: 'Resolvers cache every answer they receive, so repeat lookups skip the network [1] (page 5) https://dns.example/caching?utm=1',
                    from: ['a', 'b', '5', 'p5-1', 'e5', 'page 5'],
                    sources: [5],
                    refs: [5],
                    sourceRef: 5,
                    pointIds: ['p5-1', 'p5-2'],
                    url: 'https://evil.example/',
                },
            ],
            sources: [5],
            refs: [{ ref: 5 }],
            conflicts: [],
            extra: 'x',
        };
        const honest = validateCombine(clean, topic, DNS_POINTS);
        const attacked = validateCombine(forged, topic, DNS_POINTS);

        expect(bulletPointIds(attacked)).toEqual(bulletPointIds(honest));
        const sourcesOfAll = (result: Topic) => result.bullets.map(bullet => sourcesOf(bullet.pointIds, DNS_POINTS));
        expect(sourcesOfAll(attacked)).toEqual(sourcesOfAll(honest));
        expect(sourcesOf(bulletWith(attacked, ['p1-1', 'p3-1'])?.pointIds ?? [], DNS_POINTS)).toEqual([1, 3]);
    });

    it.each([
        ['not an object', 'text'],
        ['null', null],
        ['statements not a list', { heading: 'x', statements: 'nope' }],
        [
            'no usable statement',
            { statements: [null, { text: 5, from: ['a', 'b'] }, { text: '   ', from: ['a', 'b'] }] },
        ],
        ['labels that are not a list', { statements: [{ text: 'Resolver answers are cached.', from: 'a' }] }],
        ['only unknown labels', { statements: [{ text: 'Resolver answers are cached.', from: ['zz', 'p1-1'] }] }],
        [
            'nothing grounded in the points',
            { statements: [{ text: 'Quantum entanglement teleports photons across galaxies.', from: ['a', 'b'] }] },
        ],
        ['only single-label statements', { statements: [{ text: 'Resolver answers are cached.', from: ['a'] }] }],
    ])('returns the topic unchanged for %s', (_name, raw) => {
        expect(validateCombine(raw, topic, DNS_POINTS)).toBe(topic);
    });
});

describe('combineTopic', () => {
    const topic = topicOf(DNS_POINTS);
    const MERGE = json({
        heading: 'DNS caching',
        statements: [{ text: 'Resolvers cache every answer, so repeat lookups skip the network.', from: ['a', 'b'] }],
    });

    it('creates one clone per topic, destroys it on success, and never destroys the base', async () => {
        const made = answering(MERGE);
        const { base, clone } = baseWith(() => made);
        const result = await combineTopic(base, topic, DNS_POINTS, live());
        expect(clone).toHaveBeenCalledTimes(1);
        expect(made.destroy).toHaveBeenCalledTimes(1);
        expect(base.destroy).not.toHaveBeenCalled();
        expect(result.combinedBy).toBe('ai');
    });

    it('makes a separate clone for each topic and destroys each one', async () => {
        const { base, clone, clones } = baseWith(() => answering(MERGE));
        await combineTopic(base, topic, DNS_POINTS, live());
        await combineTopic(base, { ...topic, id: 't2' }, DNS_POINTS, live());
        expect(clone).toHaveBeenCalledTimes(2);
        expect(clones[0]).not.toBe(clones[1]);
        for (const made of clones) expect(made.destroy).toHaveBeenCalledTimes(1);
    });

    it('sends the heading and every point with its page, labelled a, b, c…', async () => {
        const made = answering(MERGE);
        const { base } = baseWith(() => made);
        await combineTopic(base, topic, DNS_POINTS, live());
        const input = vi.mocked(made.prompt).mock.calls[0][0];
        expect(input).toContain('Topic: DNS caching');
        expect(input).toContain(`a (page 1): ${A.text}`);
        expect(input).toContain(`e (page 5): ${T5.text}`);
        expect(input.split('\n')).toHaveLength(DNS_POINTS.length + 1);
    });

    it('uses a schema whose labels are exactly the labels it sent', async () => {
        const made = answering(MERGE);
        const { base } = baseWith(() => made);
        await combineTopic(base, topic, DNS_POINTS, live());
        expect(vi.mocked(made.prompt).mock.calls[0][1]?.responseConstraint).toEqual(
            combineSchema(['a', 'b', 'c', 'd', 'e'])
        );
    });

    it('sends only the points that fit; the others come back as their own bullets', async () => {
        const measure = vi.fn(async (text: string) => text.split('\n').length);
        const made = session({
            contextWindow: 4,
            measureContextUsage: measure,
            prompt: vi.fn(async () =>
                json({
                    heading: 'DNS caching',
                    statements: [
                        {
                            text: 'Resolvers cache every answer, so repeat lookups skip the network.',
                            from: ['a', 'b', 'c'],
                        },
                    ],
                })
            ),
        });
        const { base } = baseWith(() => made);
        const partial = topicOf([A, B, C, T5]);
        const result = await combineTopic(base, partial, [A, B, C, T5], live());
        const input = vi.mocked(made.prompt).mock.calls[0][0];
        expect(input).toContain('b (page 3)');
        expect(input).not.toContain('c (page 5)');
        expect(vi.mocked(made.prompt).mock.calls[0][1]?.responseConstraint).toEqual(combineSchema(['a', 'b']));
        expect(bulletPointIds(result)).toEqual([['p1-1', 'p3-1'], ['p5-1'], ['p5-2']]);
        expect(bulletWith(result, ['p5-1'])?.origin).toBe('point');
    });

    it('gives back the topic unchanged when even two points do not fit, and destroys the clone', async () => {
        const made = session({ contextWindow: 4, measureContextUsage: vi.fn(async () => 999) });
        const { base } = baseWith(() => made);
        expect(await combineTopic(base, topic, DNS_POINTS, live())).toBe(topic);
        expect(made.destroy).toHaveBeenCalledTimes(1);
    });

    it('gives back the topic unchanged on a model failure, and destroys the clone', async () => {
        const made = answering(new Error('model crashed'));
        const { base } = baseWith(() => made);
        expect(await combineTopic(base, topic, DNS_POINTS, live())).toBe(topic);
        expect(made.destroy).toHaveBeenCalledTimes(1);
    });

    it('sends at most COMBINE_MAX_POINTS points, and every other point comes back as its own bullet', async () => {
        const many: KeyPoint[] = Array.from({ length: 10 }, (_, i) => ({
            id: `p${(i % 2) + 1}-${i + 1}`,
            sourceRef: (i % 2) + 1,
            text: 'Caching keeps answers in the resolver cache.',
            topicHint: '',
        }));
        const made = answering(MERGE);
        const { base } = baseWith(() => made);
        const result = await combineTopic(base, topicOf(many), many, live());
        const input = vi.mocked(made.prompt).mock.calls[0][0];
        expect(input).toContain('h (page 2)');
        expect(input).not.toContain('i (page');
        expect(vi.mocked(made.prompt).mock.calls[0][1]?.responseConstraint).toEqual(
            combineSchema(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'])
        );
        expect(result.combinedBy).toBe('ai');
        // Nothing is lost: all ten points are in some bullet
        expect(pointIdsOf(result)).toEqual(many.map(point => point.id).sort((a, b) => a.localeCompare(b)));
    });

    it('gives the combine call its own time limit, COMBINE_TIMEOUT_MS', async () => {
        vi.useFakeTimers();
        try {
            const hang = (_input: string, options?: { signal?: AbortSignal }) =>
                new Promise<string>((_resolve, reject) =>
                    options?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
                );
            const made = session({ prompt: vi.fn(hang) });
            const { base } = baseWith(() => made);
            const pending = combineTopicChecked(base, topic, DNS_POINTS, live());
            await vi.advanceTimersByTimeAsync(COMBINE_TIMEOUT_MS + 1);
            expect(await pending).toEqual({ topic, reason: 'timeout' });
            expect(made.destroy).toHaveBeenCalledTimes(1);
        } finally {
            vi.useRealTimers();
        }
    });

    it('reports timeout when the model is too slow', async () => {
        vi.useFakeTimers();
        try {
            const hang = (_input: string, options?: { signal?: AbortSignal }) =>
                new Promise<string>((_resolve, reject) =>
                    options?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
                );
            const { base } = baseWith(() => session({ prompt: vi.fn(hang) }));
            const pending = combineTopicChecked(base, topic, DNS_POINTS, live());
            await vi.advanceTimersByTimeAsync(COMBINE_TIMEOUT_MS + 1);
            expect(await pending).toEqual({ topic, reason: 'timeout' });
        } finally {
            vi.useRealTimers();
        }
    });

    it('reports too-large when the model rejects the input as too big for its context', async () => {
        const made = answering(Object.assign(new Error('too big'), { name: 'QuotaExceededError' }));
        const { base } = baseWith(() => made);
        expect(await combineTopicChecked(base, topic, DNS_POINTS, live())).toEqual({ topic, reason: 'too-large' });
    });

    it('reports too-large when not even two points fit the context window', async () => {
        const made = session({ contextWindow: 4, measureContextUsage: vi.fn(async () => 999) });
        const { base } = baseWith(() => made);
        expect(await combineTopicChecked(base, topic, DNS_POINTS, live())).toEqual({ topic, reason: 'too-large' });
    });

    it('reports unusable when the model fails or its answer cannot be used', async () => {
        const failing = answering(new Error('model crashed'));
        expect(await combineTopicChecked(baseWith(() => failing).base, topic, DNS_POINTS, live())).toEqual({
            topic,
            reason: 'unusable',
        });
        const useless = answering('not json', 'not json');
        expect(await combineTopicChecked(baseWith(() => useless).base, topic, DNS_POINTS, live())).toEqual({
            topic,
            reason: 'unusable',
        });
    });

    it('gives no reason when the answer is usable but merges nothing', async () => {
        const single = json({ heading: 'DNS caching', statements: [{ text: A.text, from: ['a'] }] });
        const { base } = baseWith(() => answering(single));
        expect(await combineTopicChecked(base, topic, DNS_POINTS, live())).toEqual({ topic });
    });

    it('gives the merged topic with no reason on success', async () => {
        const { base } = baseWith(() => answering(MERGE));
        const result = await combineTopicChecked(base, topic, DNS_POINTS, live());
        expect(result.reason).toBeUndefined();
        expect(result.topic.combinedBy).toBe('ai');
    });

    it('throws AiError aborted on a cancel, with no reason', async () => {
        const controller = new AbortController();
        const hang = (_input: string, options?: { signal?: AbortSignal }) =>
            new Promise<string>((_resolve, reject) =>
                options?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
            );
        const { base } = baseWith(() => session({ prompt: vi.fn(hang) }));
        const pending = combineTopicChecked(base, topic, DNS_POINTS, controller.signal);
        controller.abort();
        await expect(pending).rejects.toMatchObject({ code: 'aborted' });
    });

    it('asks again once for unusable output, then merges on the second answer', async () => {
        const made = answering('not json', MERGE);
        const { base } = baseWith(() => made);
        const result = await combineTopic(base, topic, DNS_POINTS, live());
        expect(made.prompt).toHaveBeenCalledTimes(2);
        expect(result.combinedBy).toBe('ai');
    });

    it('gives back the topic unchanged after two unusable answers', async () => {
        const made = answering('not json', 'still not json');
        const { base } = baseWith(() => made);
        expect(await combineTopic(base, topic, DNS_POINTS, live())).toBe(topic);
    });

    it('throws AiError aborted on a cancel during the model call, and destroys the clone', async () => {
        const controller = new AbortController();
        const made = session({
            prompt: vi.fn(async () => {
                controller.abort();
                throw new DOMException('Aborted', 'AbortError');
            }),
        });
        const { base } = baseWith(() => made);
        await expect(combineTopic(base, topic, DNS_POINTS, controller.signal)).rejects.toMatchObject({
            code: 'aborted',
        });
        expect(made.destroy).toHaveBeenCalledTimes(1);
    });

    it('throws AiError aborted without starting when the signal is already aborted', async () => {
        const controller = new AbortController();
        controller.abort();
        const { base, clone } = baseWith(() => answering(MERGE));
        await expect(combineTopic(base, topic, DNS_POINTS, controller.signal)).rejects.toBeInstanceOf(AiError);
        expect(clone).not.toHaveBeenCalled();
    });

    it('gives back the topic unchanged without a clone, and without destroying the base', async () => {
        const base = session();
        expect(await combineTopic(base, topic, DNS_POINTS, live())).toBe(topic);
        expect(base.destroy).not.toHaveBeenCalled();
    });

    it('does not combine a source section or a topic with fewer than two points', async () => {
        const { base, clone } = baseWith(() => answering(MERGE));
        expect(await combineTopic(base, { ...topic, kind: 'source', combinedBy: null }, DNS_POINTS, live())).toEqual({
            ...topic,
            kind: 'source',
            combinedBy: null,
        });
        expect(await combineTopic(base, topicOf([A]), [A], live())).toEqual(topicOf([A]));
        expect(clone).not.toHaveBeenCalled();
    });
});

describe('validateCombine: answers of the real on-device model (two pages on inheritance)', () => {
    const real = (n: number, text: string): KeyPoint => ({
        id: `p${n}-1`,
        sourceRef: n,
        text,
        topicHint: 'Inheritance',
    });
    const points = [
        real(
            1,
            'Inheritance allows creating new classes (subclasses) based on existing classes (superclasses). Subclasses inherit properties and methods from their superclasses, promoting code reusability and establishing hierarchical relationships between classes. This relates to the concept of polymorphism.'
        ),
        real(
            2,
            "Inheritance enables a child class to acquire properties and methods from a parent class, promoting code reusability. A child class inherits the parent's characteristics, adding its own unique attributes."
        ),
    ];
    const topic = topicOf(points, { heading: 'Inheritance' });

    it('accepts one statement that covers both pages and cites both', () => {
        // Raw answer of the combine prompt that asks for one statement that includes what EACH point says
        const merged = validateCombine(
            answer('Class Inheritance', [
                {
                    text: 'Inheritance allows the creation of new classes (subclasses) based on existing classes (superclasses), enabling subclasses to acquire properties and methods from their parent classes. This promotes code reusability and establishes a hierarchical relationship between classes.',
                    from: ['a', 'b'],
                },
            ]),
            topic,
            points
        );
        expect(merged.combinedBy).toBe('ai');
        expect(merged.bullets).toHaveLength(1);
        expect(merged.bullets[0].origin).toBe('ai');
        expect(sourcesOf(merged.bullets[0].pointIds, points)).toEqual([1, 2]);
    });

    it('keeps the word grouping when the statement only says what one page says, though it cites both', () => {
        // Raw answer of the earlier prompt: the second label does not support the statement
        const unchanged = validateCombine(
            answer('Inheritance Overview', [
                {
                    text: 'Inheritance allows creating new classes (subclasses) based on existing classes (superclasses).',
                    from: ['a', 'b'],
                },
            ]),
            topic,
            points
        );
        expect(unchanged.combinedBy).toBe('words');
        expect(unchanged.bullets.map(bullet => bullet.pointIds)).toEqual([['p1-1'], ['p2-1']]);
    });
});

describe('aiTopics: malformed model answers and sessions', () => {
    const TAGS = ['DNS caching', 'TTL', 'Caching DNS answers', 'Negative caching', 'CPU caches'];

    it('leaves tag names alone, without a model call, when the session cannot be cloned', async () => {
        const base = session();
        const map = await canonicalTopics(base, TAGS, live());

        expect(map.size).toBe(TAGS.length);
        expect([...map.entries()].every(([tag, name]) => tag === name)).toBe(true);
        expect(base.prompt).not.toHaveBeenCalled();
    });

    it('skips groups that are not objects or have no member list, and keeps the valid one', async () => {
        const { base } = baseWith(() =>
            answering(
                json({
                    groups: [7, null, { name: 'No members' }, { name: 'DNS caching', members: [1, 3] }],
                })
            )
        );

        const map = await canonicalTopics(base, TAGS, live());

        expect(map.get('Caching DNS answers')).toBe('DNS caching');
        expect(map.get('TTL')).toBe('TTL');
    });

    it('ignores labels that are not strings, and conflicts that are not objects', () => {
        const raw = answer(
            'DNS caching',
            [
                {
                    text: 'The resolver caches every answer it receives, so repeat lookups skip the network.',
                    from: ['a', 7, null, 'b'],
                },
            ],
            [null, 'text', 3]
        );

        const result = validateCombine(raw, topicOf(DNS_POINTS), DNS_POINTS);

        expect(result.combinedBy).toBe('ai');
        expect(bulletPointIds(result)).toContainEqual(['p1-1', 'p3-1']);
        expect(result.conflicts).toEqual([]);
        expect(pointIdsOf(result)).toEqual(ALL_IDS);
    });
});
