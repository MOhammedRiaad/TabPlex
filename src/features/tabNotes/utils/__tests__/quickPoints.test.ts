import { describe, expect, it } from 'vitest';
import { POINT_MAX_CHARS, QUICK_POINTS_PER_SOURCE } from '../../constants';
import { CleanPage, NoteSource, PageSection } from '../../types';
import { clipText, extractPointsQuick, pageTextOf, topicHintFor } from '../quickPoints';

const source: NoteSource = {
    ref: 2,
    tabId: 7,
    windowId: 1,
    title: 'DNS caching',
    url: 'https://dns.example/caching',
    mode: 'quick',
    truncated: false,
    notEnglish: false,
};

const pageOf = (sections: PageSection[], description = ''): CleanPage => ({
    sections,
    description,
    chars: 1000,
    truncated: false,
    notEnglish: false,
});

const ARTICLE: PageSection[] = [
    {
        heading: 'Introduction',
        paragraphs: [
            'This introduction explains the basic idea behind DNS caching in a few clear words for new readers.',
        ],
    },
    {
        heading: 'How the TTL works',
        paragraphs: [
            'The TTL field sets how long a resolver keeps an answer before asking the authoritative server again.',
            'Longer TTL values reduce load on authoritative servers but delay updates to records.',
            'A short TTL lets operators change records quickly, at the cost of more lookups.',
        ],
    },
    {
        heading: 'Browser caches',
        paragraphs: [
            'Browsers keep their own DNS cache, which is flushed when the network connection changes.',
            'Operating systems add another layer of caching on top of the browser cache for lookups.',
        ],
    },
];

describe('extractPointsQuick', () => {
    it('makes points from verbatim sentences, numbered by source, in page order, up to five', () => {
        const points = extractPointsQuick(source, pageOf(ARTICLE));
        expect(points.length).toBeGreaterThan(0);
        expect(points.length).toBeLessThanOrEqual(QUICK_POINTS_PER_SOURCE);
        points.forEach((point, i) => {
            expect(point.id).toBe(`p2-${i + 1}`);
            expect(point.sourceRef).toBe(2);
        });

        const text = pageTextOf(pageOf(ARTICLE));
        for (const point of points) {
            expect(text).toContain(point.text);
            expect(point.text.length).toBeLessThanOrEqual(POINT_MAX_CHARS);
        }
        const positions = points.map(point => text.indexOf(point.text));
        expect(positions).toEqual([...positions].sort((a, b) => a - b));
    });

    it('puts the page description first when it has at least 40 characters', () => {
        const description = 'A plain guide to how DNS caching keeps lookups fast and where answers are kept.';
        const points = extractPointsQuick(source, pageOf(ARTICLE, description));
        expect(points[0]).toEqual({ id: 'p2-1', sourceRef: 2, text: description, topicHint: '' });
        expect(points).toHaveLength(QUICK_POINTS_PER_SOURCE);
        expect(points.filter(point => point.text === description)).toHaveLength(1);
    });

    it('ignores a short description', () => {
        const points = extractPointsQuick(source, pageOf(ARTICLE, 'Too short.'));
        expect(points.some(point => point.text === 'Too short.')).toBe(false);
    });

    it('takes at most two points from one section', () => {
        const points = extractPointsQuick(source, pageOf(ARTICLE));
        const fromTtl = points.filter(point => point.topicHint === 'How the TTL works');
        expect(fromTtl.length).toBeLessThanOrEqual(2);
    });

    it('caps the count at five when every section has candidates', () => {
        const sections: PageSection[] = Array.from({ length: 6 }, (_, i) => ({
            heading: `Topic ${i} notes`,
            paragraphs: [
                `Topic ${i} explains one specific idea about caching that a reader needs to know well.`,
                `A second sentence for topic ${i} adds a different detail about the same caching subject.`,
            ],
        }));
        expect(extractPointsQuick(source, pageOf(sections))).toHaveLength(QUICK_POINTS_PER_SOURCE);
    });

    it('gives a topic hint from the section heading, and none for generic headings', () => {
        const points = extractPointsQuick(source, pageOf(ARTICLE));
        const hints = points.map(point => point.topicHint);
        expect(hints.every(hint => hint !== 'Introduction')).toBe(true);
        expect(points.some(point => point.topicHint === 'Browser caches')).toBe(true);
    });

    it('skips sentences that are too short or have too few letters', () => {
        const junk: PageSection[] = [
            {
                heading: '',
                paragraphs: [
                    'Too short.',
                    '1234567890 1234567890 1234567890 1234567890 1234567890 1234567890 1234567890.',
                ],
            },
        ];
        expect(extractPointsQuick(source, pageOf(junk))).toEqual([]);
    });

    it('cuts a sentence longer than POINT_MAX_CHARS on a word boundary with an ellipsis', () => {
        const long = `${'word '.repeat(56).trim()}.`;
        expect(long.length).toBe(280);
        const [point] = extractPointsQuick(source, pageOf([{ heading: '', paragraphs: [long] }]));
        expect(point.text.endsWith('…')).toBe(true);
        expect(point.text.length).toBeLessThanOrEqual(POINT_MAX_CHARS);
        expect(long.startsWith(point.text.slice(0, -1))).toBe(true);
    });

    it('is deterministic', () => {
        expect(extractPointsQuick(source, pageOf(ARTICLE))).toEqual(extractPointsQuick(source, pageOf(ARTICLE)));
    });

    it('returns nothing for a page with no usable sentences and no description', () => {
        expect(extractPointsQuick(source, pageOf([]))).toEqual([]);
    });
});

describe('topicHintFor and clipText', () => {
    it('drops generic headings and keeps others, cut to 60 characters', () => {
        expect(topicHintFor('Overview')).toBe('');
        expect(topicHintFor('  Comments: ')).toBe('');
        expect(topicHintFor('')).toBe('');
        expect(topicHintFor('DNS caching')).toBe('DNS caching');
        expect(topicHintFor('word '.repeat(20)).length).toBeLessThanOrEqual(60);
    });

    it('clips only longer text, on a word boundary when there is one', () => {
        expect(clipText('short', 10)).toBe('short');
        expect(clipText('one two three four', 12)).toBe('one two…');
        expect(clipText('abcdefghijklmnop', 6)).toBe('abcde…');
    });
});
