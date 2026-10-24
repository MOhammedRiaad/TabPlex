import { describe, expect, it } from 'vitest';
import { MAX_POINTS_PER_TOPIC, MAX_SHARED_TOPICS } from '../../constants';
import { KeyPoint, NoteSource, Topic } from '../../types';
import { cleanTopicHeading, groupTopics, sourcesOf } from '../groupTopics';
import { CORPUS_POINTS, CORPUS_SOURCES, CPU_REF, DNS_REFS, RECIPE_REF, REACT_REFS } from './fixtures/pages';
import { OOP_POINTS, OOP_POINTS_TAGGED, OOP_SOURCES } from './fixtures/oop';
import { E2E_POINTS, E2E_SOURCES } from './fixtures/e2ePages';

const source = (ref: number, title = `Page ${ref}`): NoteSource => ({
    ref,
    tabId: 1000 + ref,
    windowId: 1,
    title,
    url: `https://site${ref}.example/`,
    mode: 'quick',
    truncated: false,
    notEnglish: false,
});

const point = (sourceRef: number, n: number, text: string, topicHint = ''): KeyPoint => ({
    id: `p${sourceRef}-${n}`,
    sourceRef,
    text,
    topicHint,
});

const corpusTopics = groupTopics(CORPUS_POINTS, CORPUS_SOURCES);
const shared = (topics: Topic[]) => topics.filter(topic => topic.kind === 'shared');
const allBullets = (topics: Topic[]) => topics.flatMap(topic => topic.bullets);
/** Every source a topic's points come from */
const refsOfTopic = (topic: Topic) =>
    sourcesOf(
        topic.bullets.flatMap(bullet => bullet.pointIds),
        CORPUS_POINTS
    );

describe('cleanTopicHeading', () => {
    it('removes Markdown, quotes, emoji and trailing punctuation', () => {
        expect(cleanTopicHeading('**"DNS caching"** 🚀:', 1)).toBe('DNS caching');
        expect(cleanTopicHeading('[TTL](https://ttl.example) values.', 1)).toBe('TTL values');
        expect(cleanTopicHeading('## Cache lines', 1)).toBe('Cache lines');
        expect(cleanTopicHeading('- 1. Negative caching', 1)).toBe('Negative caching');
        expect(cleanTopicHeading('“Dependency array”, ', 1)).toBe('Dependency array');
    });

    it('keeps the inside of a heading as it is (apostrophes, numbers, #)', () => {
        expect(cleanTopicHeading("Browser's DNS cache 300", 1)).toBe("Browser's DNS cache 300");
        expect(cleanTopicHeading('C# and F#', 1)).toBe('C# and F#');
    });

    it('cuts at 60 characters on a word boundary', () => {
        const long = 'word '.repeat(30).trim();
        const heading = cleanTopicHeading(long, 1);
        expect(heading.length).toBeLessThanOrEqual(60);
        expect(heading.endsWith('…')).toBe(true);
        expect(heading.startsWith('word word')).toBe(true);
    });

    it('is never empty: "Topic N" when nothing is left', () => {
        expect(cleanTopicHeading('', 2)).toBe('Topic 2');
        expect(cleanTopicHeading('🚀🚀 **  ** ""', 3)).toBe('Topic 3');
        expect(cleanTopicHeading('   ', 4)).toBe('Topic 4');
    });
});

describe('sourcesOf', () => {
    it('returns the sorted, unique source refs of the named points', () => {
        const points = [point(5, 1, 'a'), point(2, 1, 'b'), point(5, 2, 'c')];
        expect(sourcesOf(['p5-1', 'p2-1', 'p5-2'], points)).toEqual([2, 5]);
        expect(sourcesOf(['p5-1'], points)).toEqual([5]);
    });

    it('ignores unknown ids and returns nothing for no ids', () => {
        expect(sourcesOf(['missing'], [point(1, 1, 'a')])).toEqual([]);
        expect(sourcesOf([], [point(1, 1, 'a')])).toEqual([]);
    });
});

describe('groupTopics on the fixture corpus', () => {
    it('gives the DNS pages a shared topic', () => {
        const topics = shared(corpusTopics);
        expect(topics.some(topic => DNS_REFS.every(ref => refsOfTopic(topic).includes(ref)))).toBe(true);
    });

    it('has a bullet that cites at least two of the DNS pages', () => {
        const dnsCitations = allBullets(corpusTopics).map(
            bullet => sourcesOf(bullet.pointIds, CORPUS_POINTS).filter(ref => DNS_REFS.includes(ref as 1)).length
        );
        expect(Math.max(...dnsCitations)).toBeGreaterThanOrEqual(2);
    });

    it('puts the two useEffect pages in one shared topic', () => {
        const topics = shared(corpusTopics);
        expect(topics.some(topic => REACT_REFS.every(ref => refsOfTopic(topic).includes(ref)))).toBe(true);
    });

    it('never puts the recipe or the CPU-caches points in a shared topic (zero false merges)', () => {
        for (const topic of shared(corpusTopics)) {
            const refs = refsOfTopic(topic);
            expect(refs).not.toContain(RECIPE_REF);
            expect(refs).not.toContain(CPU_REF);
            // Each shared topic belongs to one subject: all DNS pages or both React pages
            const onlyDns = refs.every(ref => (DNS_REFS as readonly number[]).includes(ref));
            const onlyReact = refs.every(ref => (REACT_REFS as readonly number[]).includes(ref));
            expect(onlyDns || onlyReact).toBe(true);
        }
    });

    it('keeps the recipe and the CPU-caches page as their own sections', () => {
        const sections = corpusTopics.filter(topic => topic.kind === 'source');
        expect(sections.map(topic => topic.sourceRef)).toEqual([CPU_REF, RECIPE_REF, 7]);
        const cpu = sections.find(topic => topic.sourceRef === CPU_REF);
        expect(cpu?.bullets).toHaveLength(4);
    });

    it('collapses a duplicate sentence from two pages into one bullet with the union of sources', () => {
        const duplicate = allBullets(corpusTopics).find(
            bullet => bullet.pointIds.includes('p3-1') || bullet.pointIds.includes('p5-1')
        );
        expect(duplicate?.pointIds.slice().sort()).toEqual(['p3-1', 'p5-1']);
        expect(sourcesOf(duplicate?.pointIds ?? [], CORPUS_POINTS)).toEqual([3, 5]);
    });

    it('does not collapse pages that give different numbers, and shows the difference as a conflict', () => {
        const ttl = corpusTopics.find(topic => topic.conflicts.length > 0);
        expect(ttl?.conflicts).toEqual([{ pointIds: ['p1-2', 'p5-2'], text: '' }]);
        const bullets = allBullets(corpusTopics);
        expect(bullets.some(bullet => bullet.pointIds.includes('p1-2') && bullet.pointIds.length > 1)).toBe(false);
        expect(bullets.some(bullet => bullet.pointIds.includes('p5-2') && bullet.pointIds.length > 1)).toBe(false);
    });

    it('lists every point once, in a bullet or a conflict', () => {
        const ids = allBullets(corpusTopics)
            .flatMap(bullet => bullet.pointIds)
            .sort();
        expect(ids).toEqual(CORPUS_POINTS.map(p => p.id).sort());
    });

    it('gives each bullet the sources of its points, derived with sourcesOf', () => {
        const refs = new Set(CORPUS_SOURCES.map(s => s.ref));
        for (const bullet of allBullets(corpusTopics)) {
            const sources = sourcesOf(bullet.pointIds, CORPUS_POINTS);
            expect(sources.length).toBeGreaterThanOrEqual(1);
            expect(sources.every(ref => refs.has(ref))).toBe(true);
            expect(sources).toEqual(sourcesOf(bullet.pointIds, CORPUS_POINTS));
        }
    });

    it('uses the text of the first point for each bullet (origin point)', () => {
        for (const bullet of allBullets(corpusTopics)) {
            const first = CORPUS_POINTS.find(p => p.id === bullet.pointIds[0]);
            expect(bullet.text).toBe(first?.text);
            expect(bullet.origin).toBe('point');
            expect(bullet.edited).toBe(false);
        }
    });

    it('orders shared topics by number of sources, then lowest source ref, then more bullets; sources after', () => {
        const kinds = corpusTopics.map(topic => topic.kind);
        expect(kinds.lastIndexOf('shared')).toBeLessThan(kinds.indexOf('source'));

        const topics = shared(corpusTopics);
        const sourceCounts = topics.map(topic => refsOfTopic(topic).length);
        expect(sourceCounts).toEqual([...sourceCounts].sort((a, b) => b - a));
        // The TTL topic and the DNS topic both have three sources; the TTL one has more bullets, so it comes first
        expect(topics[0].heading).toBe('TTL');
        expect(topics[0].bullets.length).toBeGreaterThan(topics[1].bullets.length);

        const sectionRefs = corpusTopics.filter(topic => topic.kind === 'source').map(topic => topic.sourceRef);
        expect(sectionRefs).toEqual([...(sectionRefs as number[])].sort((a, b) => a - b));
    });

    it('orders the bullets of a shared topic by number of sources, then lowest ref', () => {
        for (const topic of shared(corpusTopics)) {
            const counts = topic.bullets.map(bullet => sourcesOf(bullet.pointIds, CORPUS_POINTS).length);
            expect(counts).toEqual([...counts].sort((a, b) => b - a));
        }
    });

    it('sets combinedBy and kind: words for shared topics, null and a source ref for sections', () => {
        for (const topic of shared(corpusTopics)) {
            expect(topic.combinedBy).toBe('words');
            expect(topic.sourceRef).toBeUndefined();
        }
        const section = corpusTopics.find(topic => topic.kind === 'source');
        expect(section?.combinedBy).toBeNull();
        expect(section?.sourceRef).toBe(CPU_REF);
    });

    it('names a section after its source title, and gives run-local ids', () => {
        const section = corpusTopics.find(topic => topic.sourceRef === CPU_REF);
        expect(section?.heading).toBe('CPU cache hierarchy');
        corpusTopics.forEach((topic, i) => expect(topic.id).toBe(`t${i + 1}`));
        allBullets(corpusTopics).forEach((bullet, i) => expect(bullet.id).toBe(`b${i + 1}`));
    });

    it('gives every topic a heading, and no two headings are the same', () => {
        const headings = corpusTopics.map(topic => topic.heading.toLowerCase());
        expect(headings.every(heading => heading !== '')).toBe(true);
        expect(new Set(headings).size).toBe(headings.length);
    });

    it('gives the same output for the same input', () => {
        expect(groupTopics(CORPUS_POINTS, CORPUS_SOURCES)).toEqual(corpusTopics);
        expect(groupTopics([...CORPUS_POINTS], [...CORPUS_SOURCES])).toEqual(corpusTopics);
    });
});

describe('groupTopics: when combining is skipped (empty result)', () => {
    it('skips with one source', () => {
        const one = CORPUS_POINTS.filter(p => p.sourceRef === 1);
        expect(groupTopics(one, [CORPUS_SOURCES[0]])).toEqual([]);
    });

    it('skips when no cluster spans two sources', () => {
        const unrelated = CORPUS_POINTS.filter(p => p.sourceRef === CPU_REF || p.sourceRef === RECIPE_REF);
        const sources = CORPUS_SOURCES.filter(s => s.ref === CPU_REF || s.ref === RECIPE_REF);
        expect(groupTopics(unrelated, sources)).toEqual([]);
    });

    it('skips with no points, and drops points from unknown sources before counting', () => {
        expect(groupTopics([], CORPUS_SOURCES)).toEqual([]);
        const orphaned = [point(99, 1, 'Tomatoes ripen in summer sun.'), point(1, 1, 'Tomatoes ripen in summer sun.')];
        expect(groupTopics(orphaned, [source(1), source(2)])).toEqual([]);
    });
});

describe('groupTopics: headings and sections', () => {
    it('uses the topic hint that most sources share as the heading', () => {
        const points = [
            point(1, 1, 'Rivers carry silt downstream to the delta.', 'Sediment'),
            point(2, 1, 'Silt settles where rivers slow down near the delta.', 'Sediment'),
            point(2, 2, 'Deltas grow when silt builds up over many years.', 'Deltas'),
        ];
        const topics = groupTopics(points, [source(1), source(2)]);
        expect(topics[0].kind).toBe('shared');
        expect(topics[0].heading).toBe('Sediment');
    });

    it('uses the canonical name of a hint when a canonical map is given', () => {
        const points = [
            point(1, 1, 'Resolvers cache answers until the TTL runs out.', 'Caching DNS answers'),
            point(3, 1, 'DNS answers stay cached until the TTL runs out.', 'DNS caching'),
        ];
        const canonical = new Map([
            ['Caching DNS answers', 'DNS caching'],
            ['DNS caching', 'DNS caching'],
        ]);
        const topics = groupTopics(points, [source(1), source(3)], canonical);
        expect(topics[0].heading).toBe('DNS caching');
    });

    it('builds the heading from the two words that most sources share when no hint is given', () => {
        const points = [
            point(1, 1, 'The resolver caches answers, and the cached answers expire with the TTL.'),
            point(2, 1, 'A resolver keeps cached answers so that the TTL controls expiry.'),
            point(3, 1, 'Each resolver caches answers for the length of the TTL field.'),
        ];
        const [topic] = groupTopics(points, [source(1), source(2), source(3)]);
        expect(topic.kind).toBe('shared');
        expect(topic.combinedBy).toBe('words');
        // Second round: two words (not three), each in at least two sources of the topic, written as the pages write it
        const words = topic.heading.split(', ');
        expect(words).toHaveLength(2);
        for (const word of words) {
            const sourcesWithWord = points.filter(p => p.text.toLowerCase().includes(word.toLowerCase()));
            expect(sourcesWithWord.length).toBeGreaterThanOrEqual(2);
        }
    });

    it('gives two sections of the same title distinct headings', () => {
        const sources = [source(1, 'Notes'), source(2, 'Notes')];
        const points = [
            point(1, 1, 'Tomatoes ripen in the summer sun on the vine.'),
            point(2, 1, 'Tomatoes ripen in the summer sun on the vine.'),
            point(1, 2, 'Violins have four strings tuned in perfect fifths.'),
            point(2, 2, 'Glaciers carve deep valleys slowly over many millennia.'),
        ];
        const topics = groupTopics(points, sources);
        // No hints: the two words in the most sources (all of them here) with equal weight; then the longer word wins,
        // and "summer" and "tomato" are both six letters, so alphabetical order decides. The display form is the page's.
        expect(topics.map(topic => topic.heading)).toEqual(['summer, Tomatoes', 'Notes', 'Notes (2)']);
    });

    it('falls back to "Topic N" for a shared topic with no words and no hint', () => {
        const points = [point(1, 1, '7 42 1984'), point(2, 1, '7 42 1984')];
        const [topic] = groupTopics(points, [source(1), source(2)]);
        expect(topic.heading).toBe('Topic 1');
    });
});

describe('groupTopics: near-duplicates and conflicts', () => {
    it('collapses near-identical points from different sources only when they give the same numbers', () => {
        const same = [
            point(1, 1, 'The cache keeps 300 entries for each client.'),
            point(2, 1, 'The cache keeps 300 entries for each client.'),
        ];
        const topics = groupTopics(same, [source(1), source(2)]);
        expect(topics[0].bullets).toHaveLength(1);
        expect(topics[0].bullets[0].pointIds).toEqual(['p1-1', 'p2-1']);

        const different = [
            point(1, 1, 'The cache keeps 300 entries for each client.'),
            point(2, 1, 'The cache keeps 500 entries for each client.'),
        ];
        const split = groupTopics(different, [source(1), source(2)]);
        expect(split[0].bullets).toHaveLength(2);
        expect(split[0].conflicts).toEqual([{ pointIds: ['p1-1', 'p2-1'], text: '' }]);
    });

    it('never puts two points from the same source in one bullet, even through a third point', () => {
        const points = [
            point(1, 1, 'The cache keeps 300 entries for each client.'),
            point(1, 2, 'The cache keeps 300 entries for each client.'),
            point(2, 1, 'The cache keeps 300 entries for each client.'),
        ];
        const [topic] = groupTopics(points, [source(1), source(2)]);
        expect(topic.bullets.some(bullet => bullet.pointIds.includes('p1-1') && bullet.pointIds.includes('p1-2'))).toBe(
            false
        );
        // The source-2 point joins one of the two identical source-1 points; the other stays its own bullet
        expect(topic.bullets.map(bullet => bullet.pointIds)).toEqual([['p1-1', 'p2-1'], ['p1-2']]);
    });

    it('marks no conflict when only one of two similar points gives a number', () => {
        const points = [
            point(1, 1, 'The cache keeps entries for each client while it is open.'),
            point(2, 1, 'The cache keeps 500 entries for each client while it is open.'),
        ];
        const topics = groupTopics(points, [source(1), source(2)]);
        expect(topics.flatMap(topic => topic.conflicts)).toEqual([]);
    });
});

describe('groupTopics: limits', () => {
    const NATO = ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf', 'hotel'];

    it('never puts more than MAX_POINTS_PER_TOPIC points in one shared topic, and keeps every point', () => {
        const sources = [source(1), source(2)];
        const points: KeyPoint[] = [];
        for (let k = 0; k < 14; k++) {
            const ref = (k % 2) + 1;
            const index = Math.floor(k / 2) + 1;
            points.push(
                point(ref, index, `The widget scheduler gives ${NATO[k % NATO.length]} queue a fair quota of slots.`)
            );
        }
        const topics = groupTopics(points, sources);
        for (const topic of shared(topics)) {
            const pointCount = topic.bullets.reduce((sum, bullet) => sum + bullet.pointIds.length, 0);
            expect(pointCount).toBeLessThanOrEqual(MAX_POINTS_PER_TOPIC);
        }
        const biggest = Math.max(
            ...shared(topics).map(topic => topic.bullets.reduce((sum, bullet) => sum + bullet.pointIds.length, 0))
        );
        expect(biggest).toBe(MAX_POINTS_PER_TOPIC);
        const ids = allBullets(topics).flatMap(bullet => bullet.pointIds);
        expect(ids.sort()).toEqual(points.map(p => p.id).sort());
    });

    it('keeps at most MAX_SHARED_TOPICS shared topics and moves the rest into their sources', () => {
        const topicWords = [
            ['lantern', 'glacier', 'pottery'],
            ['zephyr', 'obsidian', 'quarry'],
            ['velvet', 'harbor', 'meadow'],
            ['thimble', 'walrus', 'compass'],
            ['saddle', 'beacon', 'orchard'],
            ['pebble', 'cobalt', 'fennel'],
            ['gravel', 'mosaic', 'tundra'],
            ['rivet', 'sorrel', 'anchor'],
            ['ember', 'trellis', 'cedar'],
            ['nickel', 'prism', 'canyon'],
        ];
        expect(topicWords.length).toBeGreaterThan(MAX_SHARED_TOPICS);
        const sources: NoteSource[] = [];
        const points: KeyPoint[] = [];
        // Only the topic's own words, so topics share no words and cannot merge with each other
        topicWords.forEach(([a, b, c], k) => {
            for (const ref of [2 * k + 1, 2 * k + 2]) {
                sources.push(source(ref));
                points.push(point(ref, 1, `${a} ${b} ${c}.`));
                points.push(point(ref, 2, `${c} ${a} ${b} again.`));
            }
        });

        const topics = groupTopics(points, sources);
        const kept = shared(topics);
        expect(kept).toHaveLength(MAX_SHARED_TOPICS);
        // Equal sources and points: the lowest source refs are kept, the last two pairs are dissolved
        const keptRefs = kept.flatMap(topic =>
            sourcesOf(
                topic.bullets.flatMap(b => b.pointIds),
                points
            )
        );
        expect(Math.min(...keptRefs)).toBe(1);
        expect(Math.max(...keptRefs)).toBe(2 * MAX_SHARED_TOPICS);
        const sections = topics.filter(topic => topic.kind === 'source').map(topic => topic.sourceRef);
        expect(sections).toEqual([17, 18, 19, 20]);
    });
});

describe('groupTopics: small hand-made inputs', () => {
    it('makes a shared topic from two points of two sources that share words and a hint', () => {
        const points = [
            point(1, 1, 'Compilers turn source code into machine instructions.', 'Compilers'),
            point(2, 1, 'A compiler translates source code into machine code.', 'Compilers'),
        ];
        const topics = groupTopics(points, [source(1), source(2)]);
        expect(topics.map(topic => topic.kind)).toEqual(['shared']);
        expect(topics[0].bullets.map(bullet => bullet.pointIds)).toEqual([['p1-1'], ['p2-1']]);
    });

    it('returns no topics for a single point from a source', () => {
        expect(groupTopics([point(1, 1, 'Only one point here.')], [source(1), source(2)])).toEqual([]);
    });
});

describe('groupTopics on the OOP corpus (second round)', () => {
    const untagged = groupTopics(OOP_POINTS, OOP_SOURCES);
    const tagged = groupTopics(OOP_POINTS_TAGGED, OOP_SOURCES);
    const sharedTopics = (topics: Topic[]) => topics.filter(topic => topic.kind === 'shared');
    const sharedBulletIds = (topics: Topic[]) =>
        sharedTopics(topics).flatMap(topic => topic.bullets.flatMap(bullet => bullet.pointIds));
    /** True when both point ids are in one bullet or one shared topic */
    const togetherInShared = (topics: Topic[], a: string, b: string) =>
        sharedTopics(topics).some(
            topic =>
                topic.bullets.some(bullet => bullet.pointIds.includes(a)) &&
                topic.bullets.some(bullet => bullet.pointIds.includes(b))
        );

    it('untagged: Inheritance and Encapsulation merge between MDN (1) and the tutorial (2)', () => {
        expect(togetherInShared(untagged, 'p1-4', 'p2-5')).toBe(true);
        expect(togetherInShared(untagged, 'p1-5', 'p2-4')).toBe(true);
    });

    it('tagged: Classes, Inheritance and Encapsulation each merge between sources 1 and 2', () => {
        expect(togetherInShared(tagged, 'p1-2', 'p2-1')).toBe(true);
        expect(togetherInShared(tagged, 'p1-4', 'p2-5')).toBe(true);
        expect(togetherInShared(tagged, 'p1-5', 'p2-4')).toBe(true);
    });

    it('never puts an English point and the Portuguese point (source 3) in one shared topic, in both variants', () => {
        for (const topics of [untagged, tagged]) {
            for (const topic of sharedTopics(topics)) {
                const refs = sourcesOf(
                    topic.bullets.flatMap(bullet => bullet.pointIds),
                    [...OOP_POINTS_TAGGED]
                );
                expect(refs.includes(3) && refs.length > 1).toBe(false);
            }
        }
    });

    it('never puts Abstraction or Polymorphism (tutorial only) in a shared topic, in both variants', () => {
        for (const topics of [untagged, tagged]) {
            const ids = sharedBulletIds(topics);
            expect(ids).not.toContain('p2-3');
            expect(ids).not.toContain('p2-6');
        }
    });

    it('gives the same output for the untagged variant when it runs twice', () => {
        expect(groupTopics(OOP_POINTS, OOP_SOURCES)).toEqual(untagged);
        expect(groupTopics([...OOP_POINTS], [...OOP_SOURCES])).toEqual(untagged);
    });

    it('untagged: no shared heading uses a filler verb, and each heading word is in at least two sources', () => {
        for (const topic of sharedTopics(untagged)) {
            const words = topic.heading.split(', ');
            expect(words.some(word => ['allows', 'represents', 'provides'].includes(word.toLowerCase()))).toBe(false);
            const pointsOfTopic = topic.bullets.flatMap(bullet => bullet.pointIds);
            for (const word of words) {
                const sourcesWithWord = new Set(
                    OOP_POINTS.filter(
                        point =>
                            pointsOfTopic.includes(point.id) && point.text.toLowerCase().includes(word.toLowerCase())
                    ).map(point => point.sourceRef)
                );
                expect(sourcesWithWord.size).toBeGreaterThanOrEqual(2);
            }
        }
    });

    it('untagged: the Inheritance topic is headed by the subject, not by the verb "allows"', () => {
        const topic = sharedTopics(untagged).find(t => t.bullets.some(b => b.pointIds.includes('p1-4')));
        expect(topic?.heading.split(', ')).toContain('Inheritance');
        expect(topic?.heading).not.toContain('allows');
    });

    it('tagged: the Classes topic takes its shared hint as its heading', () => {
        const topic = sharedTopics(tagged).find(t => t.bullets.some(b => b.pointIds.includes('p1-2')));
        expect(topic?.heading).toBe('Classes');
        expect(topic?.combinedBy).toBe('words');
    });

    it('lists each point once, in a bullet, in both variants', () => {
        for (const [topics, points] of [
            [untagged, OOP_POINTS],
            [tagged, OOP_POINTS_TAGGED],
        ] as const) {
            const ids = topics.flatMap(topic => topic.bullets.flatMap(bullet => bullet.pointIds)).sort();
            expect(ids).toEqual(points.map(point => point.id).sort());
        }
    });

    it('never merges an English point with a Portuguese point, even with the same tag and whatever the source flags', () => {
        const english = 'Classes define abstract definitions for types of objects.';
        const portuguese = 'Protótipos servem para herdar propriedades de outros objetos.';
        const points = [point(1, 1, english, 'Classes'), point(2, 1, portuguese, 'Classes')];
        expect(groupTopics(points, [source(1), { ...source(2), notEnglish: true }])).toEqual([]);
        expect(groupTopics(points, [source(1), source(2)])).toEqual([]);
        expect(
            groupTopics(points, [
                { ...source(1), notEnglish: true },
                { ...source(2), notEnglish: true },
            ])
        ).toEqual([]);
    });

    it('lets two Portuguese points from two Portuguese sources merge with each other', () => {
        const portuguese = 'Protótipos servem para herdar propriedades de outros objetos.';
        const points = [point(1, 1, portuguese), point(2, 1, portuguese)];
        const topics = groupTopics(points, [
            { ...source(1), notEnglish: true },
            { ...source(2), notEnglish: true },
        ]);
        expect(topics[0].kind).toBe('shared');
    });

    it('still merges English points from a source flagged as not English when their words match', () => {
        // The model answers in English even for a Portuguese page, so these are English sentences
        const sentence = 'Classes define abstract definitions for types of objects.';
        const points = [point(1, 1, sentence), point(2, 1, sentence)];
        const topics = groupTopics(points, [source(1), { ...source(2), notEnglish: true }]);
        expect(topics[0].kind).toBe('shared');
    });

    it('a point too short to tell its language never blocks a merge', () => {
        const points = [
            point(1, 1, 'Classes define abstract types.', 'Classes'),
            point(2, 1, 'Classes define abstract definitions for types of objects.', 'Classes'),
        ];
        expect(groupTopics(points, [source(1), source(2)])[0].kind).toBe('shared');
    });
});

describe('groupTopics on the E2E pages (the quick view of e2e/pages)', () => {
    const topics = groupTopics(E2E_POINTS, E2E_SOURCES);
    const DNS_PAGES = [1, 2, 3];
    const SOURDOUGH = 4;

    it('the DNS pages share a topic whose bullets cite at least two of them', () => {
        // The two DNS pages sit in separate bullets of one shared topic (their sentences are not duplicates)
        const cited = shared(topics).some(topic => {
            const refs = sourcesOf(
                topic.bullets.flatMap(bullet => bullet.pointIds),
                E2E_POINTS
            );
            return refs.filter(ref => DNS_PAGES.includes(ref)).length >= 2;
        });
        expect(cited).toBe(true);
    });

    it('the sourdough page is in no shared topic and keeps its own section', () => {
        for (const topic of shared(topics)) {
            const refs = sourcesOf(
                topic.bullets.flatMap(bullet => bullet.pointIds),
                E2E_POINTS
            );
            expect(refs).not.toContain(SOURDOUGH);
        }
        expect(topics.some(topic => topic.kind === 'source' && topic.sourceRef === SOURDOUGH)).toBe(true);
    });

    it('gives the same output when it runs twice', () => {
        expect(groupTopics(E2E_POINTS, E2E_SOURCES)).toEqual(topics);
    });
});
