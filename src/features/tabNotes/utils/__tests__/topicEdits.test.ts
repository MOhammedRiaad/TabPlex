import { describe, expect, it } from 'vitest';
import { KeyPoint, Topic, TopicBullet } from '../../types';
import { validateCombine } from '../aiTopics';
import { groupTopics, sourcesOf } from '../groupTopics';
import {
    bulletSources,
    editBullet,
    moveBullet,
    moveTargets,
    normalizeTopics,
    removeBullet,
    removeConflict,
    removePoint,
    removeSource,
    removeTopic,
    renameTopic,
    separateBySource,
} from '../topicEdits';
import { CORPUS_POINTS, CORPUS_SOURCES } from './fixtures/pages';
import { OOP_POINTS_TAGGED, OOP_SOURCES } from './fixtures/oop';

/** Freezes a value and everything in it: any mutation by an action throws in these (strict-mode) tests */
function deepFreeze<T>(value: T): T {
    if (value && typeof value === 'object') {
        for (const child of Object.values(value)) deepFreeze(child);
        Object.freeze(value);
    }
    return value;
}

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const pointOf = (id: string): KeyPoint => {
    const found = CORPUS_POINTS.find(point => point.id === id);
    if (!found) throw new Error(`no fixture point ${id}`);
    return found;
};

const allBullets = (topics: Topic[]): TopicBullet[] => topics.flatMap(topic => topic.bullets);

/** Id of the bullet that holds exactly these points (in this order) */
function bulletIdOf(topics: Topic[], ids: string[]): string {
    const found = allBullets(topics).find(bullet => bullet.pointIds.join() === ids.join());
    if (!found) throw new Error(`no bullet with ${ids.join()}`);
    return found.id;
}

function topicIdOf(topics: Topic[], heading: string): string {
    const found = topics.find(topic => topic.heading === heading);
    if (!found) throw new Error(`no topic ${heading}`);
    return found.id;
}

const headingsOf = (topics: Topic[]): string[] => topics.map(topic => topic.heading);

/** Every point id listed in the view, sorted: a point listed twice shows up twice */
const listedIds = (topics: Topic[]): string[] =>
    allBullets(topics)
        .flatMap(bullet => bullet.pointIds)
        .sort();

/** Sources of the bullets of a topic, one list per bullet */
const sourceLists = (topic: Topic, points: KeyPoint[]): number[][] =>
    topic.bullets.map(bullet => sourcesOf(bullet.pointIds, points));

const CORPUS_IDS = CORPUS_POINTS.map(point => point.id).sort();

/** The title of a corpus source, by its ref */
const titleOf = (ref: number): string => CORPUS_SOURCES.find(source => source.ref === ref)?.title ?? '';

/** The DNS corpus as groupTopics makes it (no AI) */
const dnsWords = (): Topic[] => groupTopics(CORPUS_POINTS, CORPUS_SOURCES);

/**
 * The DNS corpus with the "DNS caching" topic combined as the model would: one 'ai' bullet from page 3 and page 5, the
 * other points as their own bullets (validateCombine, spec §7.6).
 */
function dnsWithAi(): Topic[] {
    const topics = dnsWords();
    const topic = topics.find(item => item.heading === 'DNS caching');
    if (!topic) throw new Error('no DNS caching topic');
    const members = ['p3-1', 'p5-1', 'p1-1', 'p1-4', 'p5-4'].map(pointOf);
    const raw = {
        heading: 'DNS caching',
        statements: [
            {
                text: 'The resolver caches every answer it receives, so repeat lookups skip the network.',
                from: ['a', 'b'],
            },
        ],
        conflicts: [],
    };
    const combined = validateCombine(raw, topic, members);
    return topics.map(item => (item === topic ? combined : item));
}

/** The OOP pages (hints from the AI-style fixture) as groupTopics makes them */
const oopWords = (): Topic[] => groupTopics(OOP_POINTS_TAGGED, OOP_SOURCES);

const bullet = (
    id: string,
    pointIds: string[],
    origin: 'point' | 'ai' = 'point',
    text = `text ${id}`
): TopicBullet => ({
    id,
    text,
    pointIds,
    origin,
    edited: false,
});

const topic = (overrides: Partial<Topic> & Pick<Topic, 'heading'>): Topic => ({
    id: 'tx',
    kind: 'shared',
    combinedBy: 'words',
    bullets: [],
    conflicts: [],
    ...overrides,
});

describe('renameTopic', () => {
    it('sets the cleaned heading and keeps the bullets and their sources', () => {
        const before = dnsWords();
        const id = topicIdOf(before, 'TTL');
        const after = renameTopic(before, id, '**Lookup   TTL**.');
        const renamed = after.find(item => item.heading === 'Lookup TTL');
        expect(renamed?.bullets.map(item => item.pointIds)).toEqual(
            before.find(item => item.id === id)?.bullets.map(item => item.pointIds)
        );
        expect(listedIds(after)).toEqual(listedIds(before));
    });

    it('keeps the old heading when the new one cleans to nothing', () => {
        const before = dnsWords();
        const id = topicIdOf(before, 'TTL');
        expect(headingsOf(renameTopic(before, id, '  ***  '))).toEqual(headingsOf(before));
        expect(headingsOf(renameTopic(before, id, ''))).toEqual(headingsOf(before));
    });

    it('gives a duplicate heading the " (2)" suffix across the whole list', () => {
        const before = dnsWords();
        const after = renameTopic(before, topicIdOf(before, 'Negative caching'), 'DNS caching');
        expect(headingsOf(after)).toContain('DNS caching');
        expect(headingsOf(after)).toContain('DNS caching (2)');
        expect(new Set(headingsOf(after)).size).toBe(after.length);
    });

    it('cuts a long heading to the topic heading limit', () => {
        const after = renameTopic(dnsWords(), 't1', 'word '.repeat(40));
        expect(after[0].heading.length).toBeLessThanOrEqual(60);
        expect(after[0].heading.length).toBeGreaterThan(0);
    });
});

describe('editBullet', () => {
    it('sets the text and marks the bullet edited, keeping its sources and origin', () => {
        const before = dnsWithAi();
        const id = bulletIdOf(before, ['p3-1', 'p5-1']);
        const after = editBullet(before, id, 'Resolvers cache answers until the TTL runs out.');
        const edited = allBullets(after).find(item => item.pointIds.join() === 'p3-1,p5-1');
        expect(edited?.text).toBe('Resolvers cache answers until the TTL runs out.');
        expect(edited?.edited).toBe(true);
        expect(edited?.origin).toBe('ai');
        expect(edited?.pointIds).toEqual(['p3-1', 'p5-1']);
        expect(bulletSources(edited as TopicBullet, CORPUS_POINTS)).toEqual([3, 5]);
    });

    it('cleans the text like a point: link syntax and URLs go', () => {
        const before = dnsWords();
        const id = bulletIdOf(before, ['p1-2']);
        const after = editBullet(before, id, '- [TTL](https://dns.example/ttl) is **300** seconds https://x.example');
        expect(allBullets(after).find(item => item.id === id)?.text).toBe('TTL is 300 seconds');
    });

    it('leaves the view unchanged when the text cleans to nothing', () => {
        const before = dnsWords();
        const id = bulletIdOf(before, ['p1-2']);
        expect(editBullet(before, id, '   https://x.example  ')).toEqual(before);
    });
});

describe('removeBullet', () => {
    it('removes only that bullet from the view; its points stay in the draft', () => {
        const before = dnsWords();
        const id = bulletIdOf(before, ['p1-3']);
        const after = removeBullet(before, id, CORPUS_POINTS, CORPUS_SOURCES);
        expect(allBullets(after).some(item => item.pointIds.includes('p1-3'))).toBe(false);
        expect(allBullets(after)).toHaveLength(allBullets(before).length - 1);
        expect(CORPUS_POINTS.some(point => point.id === 'p1-3')).toBe(true);
    });

    it('removes a shared topic that has no bullets left', () => {
        let state = dnsWords();
        state = removeBullet(state, bulletIdOf(state, ['p1-3']), CORPUS_POINTS, CORPUS_SOURCES);
        state = removeBullet(state, bulletIdOf(state, ['p5-3']), CORPUS_POINTS, CORPUS_SOURCES);
        expect(headingsOf(state)).not.toContain('Negative caching');
        expect(state.map(item => item.id)).toEqual(state.map((_, index) => `t${index + 1}`));
    });

    it('turns a shared topic left with one source into that source section, dropping its conflicts', () => {
        let state = dnsWords();
        state = removeBullet(state, bulletIdOf(state, ['p1-2']), CORPUS_POINTS, CORPUS_SOURCES);
        state = removeBullet(state, bulletIdOf(state, ['p5-2']), CORPUS_POINTS, CORPUS_SOURCES);
        const section = state.find(item => item.kind === 'source' && item.sourceRef === 3);
        expect(section).toMatchObject({ kind: 'source', sourceRef: 3, combinedBy: null, conflicts: [] });
        expect(section?.bullets.map(item => item.pointIds)).toEqual([['p3-2'], ['p3-3'], ['p3-4']]);
    });

    it('moves a combined topic to "words" when its last AI bullet goes', () => {
        const before = dnsWithAi();
        const after = removeBullet(before, bulletIdOf(before, ['p3-1', 'p5-1']), CORPUS_POINTS, CORPUS_SOURCES);
        expect(after.find(item => item.kind === 'shared' && item.heading === 'DNS caching')?.combinedBy).toBe('words');
    });
});

describe('removeConflict', () => {
    it('removes the conflict at the index and keeps the others', () => {
        const before = dnsWords();
        const id = topicIdOf(before, 'TTL');
        const after = removeConflict(before, id, 0);
        expect(after.find(item => item.id === id)?.conflicts).toEqual([]);
        expect(listedIds(after)).toEqual(listedIds(before));
    });

    it('does nothing for an index out of range', () => {
        const before = dnsWords();
        expect(removeConflict(before, topicIdOf(before, 'TTL'), 5)).toEqual(before);
    });
});

describe('moveBullet', () => {
    it('appends a bullet to another shared topic and keeps its sources', () => {
        const before = dnsWords();
        const id = bulletIdOf(before, ['p1-1']);
        const target = topicIdOf(before, 'Negative caching');
        const after = moveBullet(before, id, target, CORPUS_POINTS, CORPUS_SOURCES);
        const moved = after.find(item => item.heading === 'Negative caching');
        expect(moved?.bullets.map(item => item.pointIds)).toContainEqual(['p1-1']);
        expect(sourceLists(moved as Topic, CORPUS_POINTS)).toContainEqual([1]);
        expect(listedIds(after)).toEqual(listedIds(before));
    });

    it('removes the source topic when its last bullet moves away', () => {
        let state = dnsWords();
        const target = topicIdOf(state, 'DNS caching');
        state = moveBullet(state, bulletIdOf(state, ['p1-3']), target, CORPUS_POINTS, CORPUS_SOURCES);
        state = moveBullet(state, bulletIdOf(state, ['p5-3']), target, CORPUS_POINTS, CORPUS_SOURCES);
        expect(headingsOf(state)).not.toContain('Negative caching');
        expect(listedIds(state)).toEqual(CORPUS_IDS);
    });

    it('splits a multi-point bullet to its own sources when moved "own", each point with its own text', () => {
        const before = dnsWithAi();
        const after = moveBullet(before, bulletIdOf(before, ['p3-1', 'p5-1']), 'own', CORPUS_POINTS, CORPUS_SOURCES);
        expect(allBullets(after).some(item => item.pointIds.join() === 'p3-1,p5-1')).toBe(false);
        const page3 = after.find(item => item.kind === 'source' && item.sourceRef === 3);
        const page5 = after.find(item => item.kind === 'source' && item.sourceRef === 5);
        expect(page3?.bullets).toEqual([
            { id: expect.any(String), text: pointOf('p3-1').text, pointIds: ['p3-1'], origin: 'point', edited: false },
        ]);
        expect(page5?.bullets.map(item => item.pointIds)).toContainEqual(['p5-1']);
        expect(page3?.heading).toBe(titleOf(3));
        expect(listedIds(after)).toEqual(CORPUS_IDS);
    });

    it('moves a single-point bullet "own" as it is, into a new section named after its source', () => {
        const before = dnsWords();
        const edited = editBullet(before, bulletIdOf(before, ['p1-1']), 'Own words for the resolver cache.');
        const after = moveBullet(edited, bulletIdOf(edited, ['p1-1']), 'own', CORPUS_POINTS, CORPUS_SOURCES);
        const section = after.find(item => item.kind === 'source' && item.sourceRef === 1);
        expect(section?.heading).toBe(titleOf(1));
        expect(section?.bullets).toEqual([
            expect.objectContaining({ text: 'Own words for the resolver cache.', pointIds: ['p1-1'], edited: true }),
        ]);
    });

    it('turns a shared topic left with one source into that source section', () => {
        let state = dnsWords();
        state = moveBullet(state, bulletIdOf(state, ['p1-2']), 'own', CORPUS_POINTS, CORPUS_SOURCES);
        state = moveBullet(state, bulletIdOf(state, ['p5-2']), 'own', CORPUS_POINTS, CORPUS_SOURCES);
        const ttl = state.find(item => item.heading === 'TTL' || (item.kind === 'source' && item.sourceRef === 3));
        expect(ttl).toMatchObject({ kind: 'source', sourceRef: 3, combinedBy: null, conflicts: [] });
        expect(
            state.filter(item => item.kind === 'shared').every(item => sourceLists(item, CORPUS_POINTS)[0].length)
        ).toBe(true);
        expect(listedIds(state)).toEqual(CORPUS_IDS);
    });

    it('drops a conflict of the source topic that loses one of its points', () => {
        const before = dnsWords();
        expect(before.flatMap(item => item.conflicts)).toHaveLength(1);
        const after = moveBullet(before, bulletIdOf(before, ['p1-2']), 'own', CORPUS_POINTS, CORPUS_SOURCES);
        expect(after.flatMap(item => item.conflicts)).toEqual([]);
        expect(listedIds(after)).toEqual(CORPUS_IDS);
    });

    it('changes nothing for an unknown bullet, a source topic, the same topic or an unknown target', () => {
        const before = dnsWords();
        const ttl = topicIdOf(before, 'TTL');
        expect(moveBullet(before, 'nope', ttl, CORPUS_POINTS, CORPUS_SOURCES)).toEqual(before);
        expect(moveBullet(before, bulletIdOf(before, ['p1-2']), ttl, CORPUS_POINTS, CORPUS_SOURCES)).toEqual(before);
        expect(moveBullet(before, bulletIdOf(before, ['p1-2']), 'nowhere', CORPUS_POINTS, CORPUS_SOURCES)).toEqual(
            before
        );
        const cpu = topicIdOf(before, 'CPU cache hierarchy');
        const cpuBullet = before.find(item => item.id === cpu)?.bullets[0]?.id ?? '';
        expect(moveBullet(before, cpuBullet, ttl, CORPUS_POINTS, CORPUS_SOURCES)).toEqual(before);
    });
});

describe('moveTargets and bulletSources', () => {
    it('lists the other shared topics for a bullet of a shared topic', () => {
        const before = dnsWords();
        const targets = moveTargets(before, bulletIdOf(before, ['p1-2'])).map(item => item.heading);
        expect(targets).toEqual(['DNS caching', 'Negative caching', 'useEffect', 'Cleanup', 'Dependency array']);
    });

    it('lists nothing for a bullet of a source section', () => {
        const before = dnsWords();
        expect(moveTargets(before, bulletIdOf(before, ['p2-1']))).toEqual([]);
        expect(moveTargets(before, 'missing')).toEqual([]);
    });

    it('gives the sources of a bullet from its points', () => {
        const before = dnsWithAi();
        expect(
            bulletSources(allBullets(before).find(item => item.pointIds.length === 2) as TopicBullet, CORPUS_POINTS)
        ).toEqual([3, 5]);
    });
});

describe('separateBySource', () => {
    it('dissolves the shared topic: each bullet goes back to its sources and the conflicts go', () => {
        const before = dnsWithAi();
        const after = separateBySource(before, topicIdOf(before, 'DNS caching'), CORPUS_POINTS, CORPUS_SOURCES);
        expect(headingsOf(after)).not.toContain('DNS caching');
        expect(allBullets(after).some(item => item.pointIds.join() === 'p3-1,p5-1')).toBe(false);
        // The AI bullet became one point bullet per point, each with the point's own text, in its page's section
        const sectionOf = (ref: number) => after.find(item => item.kind === 'source' && item.sourceRef === ref);
        expect(sectionOf(3)?.bullets).toContainEqual(
            expect.objectContaining({ pointIds: ['p3-1'], text: pointOf('p3-1').text, origin: 'point', edited: false })
        );
        expect(sectionOf(5)?.bullets).toContainEqual(
            expect.objectContaining({ pointIds: ['p5-1'], text: pointOf('p5-1').text, origin: 'point', edited: false })
        );
        expect(sectionOf(1)?.bullets.map(item => item.pointIds)).toEqual(expect.arrayContaining([['p1-1'], ['p1-4']]));
        expect(sectionOf(1)?.heading).toBe(titleOf(1));
        expect(listedIds(after)).toEqual(CORPUS_IDS);
    });

    it('removes the conflicts of a separated topic', () => {
        const before = dnsWords();
        const after = separateBySource(before, topicIdOf(before, 'TTL'), CORPUS_POINTS, CORPUS_SOURCES);
        expect(after.flatMap(item => item.conflicts)).toEqual([]);
        expect(listedIds(after)).toEqual(CORPUS_IDS);
    });

    it('leaves a source section, or an unknown topic, unchanged', () => {
        const before = dnsWords();
        expect(
            separateBySource(before, topicIdOf(before, 'CPU cache hierarchy'), CORPUS_POINTS, CORPUS_SOURCES)
        ).toEqual(before);
        expect(separateBySource(before, 'missing', CORPUS_POINTS, CORPUS_SOURCES)).toEqual(before);
    });
});

describe('removeSource', () => {
    it('removes the source points from every topic and its own section', () => {
        const before = dnsWords();
        const after = removeSource(before, 2, CORPUS_POINTS, CORPUS_SOURCES);
        expect(headingsOf(after)).not.toContain('CPU cache hierarchy');
        expect(listedIds(after)).toEqual(CORPUS_IDS.filter(id => !id.startsWith('p2-')));
    });

    it('drops a bullet that has no points left', () => {
        const before = dnsWords();
        const after = removeSource(before, 1, CORPUS_POINTS, CORPUS_SOURCES);
        expect(allBullets(after).some(item => item.pointIds.join() === 'p1-3')).toBe(false);
        expect(allBullets(after).some(item => item.pointIds.join() === 'p1-1')).toBe(false);
    });

    it('turns an unedited AI bullet that lost a point into one point bullet per remaining point', () => {
        const after = removeSource(dnsWithAi(), 3, CORPUS_POINTS, CORPUS_SOURCES);
        expect(allBullets(after).some(item => item.pointIds.includes('p3-1'))).toBe(false);
        const split = allBullets(after).find(item => item.pointIds.join() === 'p5-1');
        expect(split).toMatchObject({ text: pointOf('p5-1').text, origin: 'point', edited: false });
        expect(allBullets(after).filter(item => item.pointIds.join() === 'p5-1')).toHaveLength(1);
        const combined = after.find(item => item.heading === 'DNS caching');
        expect(combined?.combinedBy).toBe('words');
    });

    it('keeps the text of an edited AI bullet and loses only the removed point id', () => {
        let state = dnsWithAi();
        state = editBullet(state, bulletIdOf(state, ['p3-1', 'p5-1']), 'Resolvers keep answers for the TTL.');
        const after = removeSource(state, 3, CORPUS_POINTS, CORPUS_SOURCES);
        const kept = allBullets(after).find(item => item.pointIds.join() === 'p5-1');
        expect(kept).toMatchObject({ text: 'Resolvers keep answers for the TTL.', origin: 'ai', edited: true });
        expect(after.find(item => item.heading === 'DNS caching')?.combinedBy).toBe('ai');
    });

    it('gives a point bullet whose lead point left the next remaining point text and ids', () => {
        const after = removeSource(dnsWords(), 3, CORPUS_POINTS, CORPUS_SOURCES);
        const bullets = allBullets(after).filter(item => item.pointIds.includes('p5-1'));
        expect(bullets).toEqual([
            expect.objectContaining({ pointIds: ['p5-1'], text: pointOf('p5-1').text, origin: 'point' }),
        ]);
    });

    it('keeps the text of an edited point bullet whose lead point left, losing only the id', () => {
        let state = dnsWords();
        state = editBullet(state, bulletIdOf(state, ['p3-1', 'p5-1']), 'Own sentence about resolvers.');
        const after = removeSource(state, 3, CORPUS_POINTS, CORPUS_SOURCES);
        expect(allBullets(after).find(item => item.pointIds.join() === 'p5-1')).toMatchObject({
            text: 'Own sentence about resolvers.',
            edited: true,
        });
    });

    it('drops conflicts that lose one of their points', () => {
        const before = dnsWords();
        expect(before.flatMap(item => item.conflicts)).toHaveLength(1);
        const after = removeSource(before, 1, CORPUS_POINTS, CORPUS_SOURCES);
        expect(after.flatMap(item => item.conflicts)).toEqual([]);
    });

    it('turns a shared topic left with one source into that source section', () => {
        const after = removeSource(dnsWords(), 1, CORPUS_POINTS, CORPUS_SOURCES);
        const negative = after.find(item => item.kind === 'source' && item.sourceRef === 5);
        expect(negative).toMatchObject({ heading: titleOf(5), combinedBy: null });
        expect(negative?.bullets.map(item => item.pointIds)).toEqual([['p5-3']]);
        expect(listedIds(after)).toEqual(CORPUS_IDS.filter(id => !id.startsWith('p1-')));
    });
});

describe('normalizeTopics', () => {
    it('drops empty topics and bullets without points', () => {
        const out = normalizeTopics(
            [
                topic({ heading: 'Empty', bullets: [] }),
                topic({ heading: 'Holes', kind: 'source', combinedBy: null, sourceRef: 2, bullets: [bullet('x', [])] }),
                topic({
                    heading: 'Real',
                    kind: 'source',
                    combinedBy: null,
                    sourceRef: 2,
                    bullets: [bullet('y', ['p2-1'])],
                }),
            ],
            CORPUS_POINTS
        );
        expect(out).toHaveLength(1);
        expect(out[0].bullets.map(item => item.pointIds)).toEqual([['p2-1']]);
    });

    it('renumbers topics and bullets, shared topics first by sources, then source sections by ref', () => {
        const out = normalizeTopics(
            [
                topic({
                    id: 'z9',
                    heading: 'Lonely',
                    kind: 'source',
                    combinedBy: null,
                    sourceRef: 4,
                    bullets: [bullet('q', ['p4-1'])],
                }),
                topic({ id: 'a1', heading: 'Two', bullets: [bullet('r', ['p3-1', 'p5-1'])] }),
                topic({ id: 'b2', heading: 'Three', bullets: [bullet('s', ['p1-1', 'p3-1', 'p5-1'])] }),
            ],
            CORPUS_POINTS
        );
        expect(out.map(item => item.id)).toEqual(['t1', 't2', 't3']);
        expect(headingsOf(out)).toEqual(['Three', 'Two', 'Lonely']);
        expect(allBullets(out).map(item => item.id)).toEqual(['b1', 'b2', 'b3']);
    });

    it('orders bullets: most sources first, then lowest ref, then point order', () => {
        const out = normalizeTopics(
            [
                topic({
                    heading: 'Mixed',
                    bullets: [bullet('x', ['p5-4']), bullet('y', ['p1-1']), bullet('z', ['p3-1', 'p5-1'])],
                }),
            ],
            CORPUS_POINTS
        );
        expect(out[0].bullets.map(item => item.pointIds)).toEqual([['p3-1', 'p5-1'], ['p1-1'], ['p5-4']]);
    });

    it('merges source sections of one ref into one section', () => {
        const out = normalizeTopics(
            [
                topic({
                    heading: 'Page two',
                    kind: 'source',
                    combinedBy: null,
                    sourceRef: 2,
                    bullets: [bullet('a', ['p2-2'])],
                }),
                topic({
                    heading: 'Page two again',
                    kind: 'source',
                    combinedBy: null,
                    sourceRef: 2,
                    bullets: [bullet('b', ['p2-1'])],
                }),
            ],
            CORPUS_POINTS
        );
        expect(out).toHaveLength(1);
        expect(out[0].heading).toBe('Page two');
        expect(out[0].bullets.map(item => item.pointIds)).toEqual([['p2-1'], ['p2-2']]);
    });

    it('makes headings distinct', () => {
        const out = normalizeTopics(
            [
                topic({ heading: 'Same', bullets: [bullet('a', ['p1-1', 'p3-1'])] }),
                topic({ heading: 'same', bullets: [bullet('b', ['p1-4', 'p5-4'])] }),
            ],
            CORPUS_POINTS
        );
        expect(headingsOf(out)).toEqual(['Same', 'same (2)']);
    });

    it('is idempotent on the word grouping, the AI grouping and the OOP pages', () => {
        for (const [state, points] of [
            [dnsWords(), CORPUS_POINTS],
            [dnsWithAi(), CORPUS_POINTS],
            [oopWords(), OOP_POINTS_TAGGED],
        ] as const) {
            const once = normalizeTopics(clone(state), points);
            expect(normalizeTopics(clone(once), points)).toEqual(once);
            expect(once.map(item => item.bullets.map(bullet => bullet.pointIds))).toEqual(
                state.map(item => item.bullets.map(bullet => bullet.pointIds))
            );
        }
    });
});

describe('immutability', () => {
    it('never mutates frozen inputs, and every action returns the same result for a copy', () => {
        const points = deepFreeze(clone(CORPUS_POINTS));
        const sources = deepFreeze(clone(CORPUS_SOURCES));
        const start = deepFreeze(dnsWithAi());
        const snapshot = JSON.stringify(start);
        const ai = bulletIdOf(start, ['p3-1', 'p5-1']);
        const shared = topicIdOf(start, 'DNS caching');
        const results = [
            renameTopic(start, shared, 'Caches'),
            editBullet(start, ai, 'Edited'),
            removeBullet(start, ai, points, sources),
            removeConflict(start, topicIdOf(start, 'TTL'), 0),
            moveBullet(start, bulletIdOf(start, ['p1-1']), topicIdOf(start, 'Negative caching'), points, sources),
            moveBullet(start, ai, 'own', points, sources),
            separateBySource(start, shared, points, sources),
            removeSource(start, 3, points, sources),
            normalizeTopics(start, points),
        ];
        expect(results.every(result => Array.isArray(result))).toBe(true);
        expect(JSON.stringify(start)).toBe(snapshot);
    });
});

describe('the attribution invariant', () => {
    it('lists every point exactly once after each non-removal action, and bullet sources are sourcesOf', () => {
        const actions: ((state: Topic[]) => Topic[])[] = [
            state => renameTopic(state, topicIdOf(state, 'TTL'), 'Lookup TTL'),
            state => editBullet(state, bulletIdOf(state, ['p1-2']), 'The TTL is 300 seconds.'),
            state => removeConflict(state, topicIdOf(state, 'Lookup TTL'), 0),
            state =>
                moveBullet(
                    state,
                    bulletIdOf(state, ['p1-1']),
                    topicIdOf(state, 'Negative caching'),
                    CORPUS_POINTS,
                    CORPUS_SOURCES
                ),
            state => moveBullet(state, bulletIdOf(state, ['p3-1', 'p5-1']), 'own', CORPUS_POINTS, CORPUS_SOURCES),
            state =>
                moveBullet(
                    state,
                    bulletIdOf(state, ['p6-2']),
                    topicIdOf(state, 'Cleanup'),
                    CORPUS_POINTS,
                    CORPUS_SOURCES
                ),
            state => separateBySource(state, topicIdOf(state, 'useEffect'), CORPUS_POINTS, CORPUS_SOURCES),
            state => normalizeTopics(state, CORPUS_POINTS),
        ];
        let state = dnsWithAi();
        for (const action of actions) {
            state = action(state);
            expect(listedIds(state)).toEqual(CORPUS_IDS);
            for (const item of allBullets(state)) {
                expect(bulletSources(item, CORPUS_POINTS)).toEqual(sourcesOf(item.pointIds, CORPUS_POINTS));
            }
        }
    });

    it('keeps the invariants through a long random run of edits, moves, separations and renames', () => {
        for (const [start, points, sources] of [
            [dnsWords(), CORPUS_POINTS, CORPUS_SOURCES],
            [dnsWithAi(), CORPUS_POINTS, CORPUS_SOURCES],
            [oopWords(), OOP_POINTS_TAGGED, OOP_SOURCES],
        ] as const) {
            let seed = 7;
            const random = () => {
                seed = (seed * 1103515245 + 12345) & 0x7fffffff;
                return seed / 0x80000000;
            };
            const ids = points.map(point => point.id).sort();
            let state = start;
            for (let step = 0; step < 150; step++) {
                const shared = state.filter(item => item.kind === 'shared');
                const movable = shared.flatMap(item => item.bullets.map(bullet => bullet.id));
                const roll = random();
                if (roll < 0.15 && movable.length > 0) {
                    state = editBullet(state, movable[Math.floor(random() * movable.length)], `Edited step ${step}`);
                } else if (roll < 0.3 && state.length > 0) {
                    state = renameTopic(state, state[Math.floor(random() * state.length)].id, `Heading ${step % 3}`);
                } else if (roll < 0.55 && movable.length > 0) {
                    const bulletId = movable[Math.floor(random() * movable.length)];
                    const targets = moveTargets(state, bulletId);
                    const pick = Math.floor(random() * (targets.length + 1));
                    const target = pick === targets.length ? 'own' : targets[pick].id;
                    state = moveBullet(state, bulletId, target, points, sources);
                } else if (roll < 0.7 && shared.length > 0) {
                    state = separateBySource(state, shared[Math.floor(random() * shared.length)].id, points, sources);
                } else if (roll < 0.8) {
                    const withConflicts = state.filter(item => item.conflicts.length > 0);
                    if (withConflicts.length > 0) state = removeConflict(state, withConflicts[0].id, 0);
                }
                expect(listedIds(state)).toEqual(ids);
                expect(new Set(allBullets(state).map(item => item.id)).size).toBe(allBullets(state).length);
                expect(new Set(state.map(item => item.id)).size).toBe(state.length);
                expect(new Set(state.map(item => item.heading)).size).toBe(state.length);
                for (const item of state) {
                    expect(item.bullets.length).toBeGreaterThan(0);
                    if (item.kind === 'source') {
                        expect(item.combinedBy).toBeNull();
                        for (const bullet of item.bullets)
                            expect(sourcesOf(bullet.pointIds, points)).toEqual([item.sourceRef]);
                    } else {
                        expect(sourceLists(item, points).flat().length).toBeGreaterThan(0);
                        expect(
                            new Set(item.bullets.flatMap(bullet => sourcesOf(bullet.pointIds, points))).size
                        ).toBeGreaterThan(1);
                    }
                }
                expect(normalizeTopics(state, points)).toEqual(state);
            }
        }
    });
});

describe('removePoint and removeTopic', () => {
    it('removePoint takes the point out of its bullet and out of every other view of the topics, keeping the others', () => {
        const topics = deepFreeze(dnsWords());
        const bullet = allBullets(topics).find(item => item.pointIds.length > 1);
        if (!bullet) throw new Error('the DNS corpus has no multi-point bullet');
        const gone = bullet.pointIds[0];
        const after = removePoint(topics, gone, CORPUS_POINTS, CORPUS_SOURCES);

        expect(listedIds(after)).not.toContain(gone);
        expect(listedIds(after)).toHaveLength(listedIds(topics).length - 1);
        // The other point is still cited, by the bullet it was in (or by its own bullet, for an AI bullet)
        expect(allBullets(after).some(item => item.pointIds.join() === bullet.pointIds[1])).toBe(true);
    });

    it('removePoint drops a bullet of one point, and a topic with no bullets left', () => {
        const topics = dnsWords();
        const bullet = allBullets(topics).find(item => item.pointIds.length === 1);
        if (!bullet) throw new Error('the DNS corpus has no single-point bullet');
        const after = removePoint(topics, bullet.pointIds[0], CORPUS_POINTS, CORPUS_SOURCES);

        expect(listedIds(after)).not.toContain(bullet.pointIds[0]);
        expect(listedIds(after)).toHaveLength(listedIds(topics).length - 1);
    });

    it('removePoint of an unknown point changes no bullet', () => {
        const topics = dnsWords();
        const after = removePoint(topics, 'no-such-point', CORPUS_POINTS, CORPUS_SOURCES);
        expect(listedIds(after)).toEqual(listedIds(topics));
    });

    it('removeTopic removes that topic and its bullets, and leaves the other topics as they were', () => {
        const topics = deepFreeze(dnsWords());
        const shared = topics.filter(topic => topic.kind === 'shared');
        const victim = shared[0];
        const others = topics.filter(topic => topic.id !== victim.id);
        const after = removeTopic(topics, victim.id, CORPUS_POINTS, CORPUS_SOURCES);

        expect(after.map(topic => topic.heading)).not.toContain(victim.heading);
        expect(after.filter(topic => topic.kind === 'shared')).toHaveLength(shared.length - 1);
        expect(listedIds(after).length).toBeLessThan(listedIds(topics).length);
        for (const other of others) {
            expect(after.find(topic => topic.heading === other.heading)?.bullets.length).toBeGreaterThan(0);
        }
    });

    it('removeTopic of an unknown topic keeps every bullet', () => {
        const topics = dnsWords();
        const after = removeTopic(topics, 'no-such-topic', CORPUS_POINTS, CORPUS_SOURCES);
        expect(listedIds(after)).toEqual(listedIds(topics));
    });
});

describe('topic edits with points the draft no longer lists', () => {
    const known = (id: string, sourceRef: number, text = `Text of ${id}`): KeyPoint => ({
        id,
        sourceRef,
        text,
        topicHint: '',
    });

    it('separating by source keeps the bullet text for a point it cannot find, and drops that piece', () => {
        const topics = [
            topic({
                id: 't1',
                heading: 'Shared',
                bullets: [bullet('b1', ['p1', 'ghost'], 'ai', 'Combined statement'), bullet('b2', ['p2'])],
            }),
        ];
        const points = [known('p1', 1), known('p2', 2)];

        const result = separateBySource(topics, 't1', points, []);

        expect(result.map(item => [item.kind, item.sourceRef, item.heading])).toEqual([
            ['source', 1, 'Topic 1'],
            ['source', 2, 'Topic 2'],
        ]);
        expect(result[0].bullets.map(item => [item.text, item.pointIds])).toEqual([['Text of p1', ['p1']]]);
    });

    it('removing a source keeps the bullet text of a remaining point it cannot find', () => {
        const topics = [
            topic({
                id: 't1',
                heading: 'Shared',
                bullets: [bullet('b1', ['a1', 'a2', 'ghost'], 'ai', 'Model wording')],
            }),
        ];
        const points = [known('a1', 1), known('a2', 2)];

        const result = removeSource(topics, 1, points, []);

        const texts = allBullets(result).map(item => [item.text, item.pointIds]);
        expect(texts).toEqual(
            expect.arrayContaining([
                ['Text of a2', ['a2']],
                ['Model wording', ['ghost']],
            ])
        );
    });

    it('orders topics and bullets whose points have no known source after the ones that do', () => {
        const topics = [
            topic({
                id: 'tx',
                kind: 'source',
                combinedBy: null,
                heading: 'No ref',
                bullets: [bullet('b9', ['ghost'])],
            }),
            topic({ id: 'ty', heading: 'Unknown points', bullets: [bullet('b8', ['ghost-2']), bullet('b7', ['p1'])] }),
            topic({ id: 'tz', heading: 'Known', bullets: [bullet('b6', ['p1', 'p2'])] }),
        ];

        const result = normalizeTopics(topics, [known('p1', 1), known('p2', 2)]);

        expect(result.map(item => [item.id, item.heading])).toEqual([
            ['t1', 'Known'],
            ['t2', 'Unknown points'],
            ['t3', 'No ref'],
        ]);
        expect(result[1].bullets.map(item => item.pointIds)).toEqual([['p1'], ['ghost-2']]);
    });
});
