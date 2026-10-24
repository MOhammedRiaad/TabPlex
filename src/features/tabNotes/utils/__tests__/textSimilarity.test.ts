import { describe, expect, it } from 'vitest';
import { buildVectors, cosine, numbersIn, support, terms } from '../textSimilarity';

describe('terms', () => {
    it('lower-cases, drops stopwords, short words and web words', () => {
        expect(terms('The cache is in the browser')).toEqual(['cach', 'browser']);
        expect(terms('Click here to read more and share')).toEqual([]);
        expect(terms('Ab to DNS')).toEqual(['dns']);
    });

    it('removes accents', () => {
        expect(terms('Café')).toEqual(['cafe']);
    });

    it('stems caches, cached and caching to the same term', () => {
        expect(terms('caches cached caching cache')).toEqual(['cach', 'cach', 'cach', 'cach']);
    });

    it('applies the suffix rules, and keeps short words and -ss / -us / -is endings', () => {
        expect(terms('queries')).toEqual(['query']);
        expect(terms('classes')).toEqual(['class']);
        expect(terms('boxes')).toEqual(['box']);
        expect(terms('tabs')).toEqual(['tab']);
        expect(terms('string')).toEqual(['string']);
        expect(terms('status bus')).toEqual(['status', 'bus']);
        expect(terms('the page')).toEqual(['page']);
    });

    it('keeps numbers as terms, with commas removed', () => {
        expect(terms('TTL 3,600 seconds')).toEqual(['ttl', '3600', 'second']);
        expect(terms('ratio 1.50')).toEqual(['ratio', '1.5']);
    });
});

describe('numbersIn', () => {
    it('normalizes "3,600" to "3600" and keeps decimals and percentages as numbers', () => {
        expect(numbersIn('It takes 3,600 seconds, 1.50 or 40%')).toEqual(new Set(['3600', '1.5', '40']));
        expect(numbersIn('3600 and 3,600')).toEqual(new Set(['3600']));
        expect(numbersIn('no digits here')).toEqual(new Set());
    });
});

describe('buildVectors', () => {
    it('gives a word that every document uses a lower weight than a rare one (IDF)', () => {
        const [first] = buildVectors(['dns cache ttl', 'dns browser', 'dns resolver']);
        expect(first.get('dns')).toBeDefined();
        expect(first.get('ttl')).toBeGreaterThan(first.get('dns') ?? 0);
    });

    it('adds adjacent term pairs as features', () => {
        const [vector] = buildVectors(['dns cache', 'other words']);
        expect(vector.has('dns cach')).toBe(true);
    });

    it('returns one vector per document, empty for a text with no terms', () => {
        const vectors = buildVectors(['', 'the and of']);
        expect(vectors).toHaveLength(2);
        expect(vectors[0].size).toBe(0);
        expect(vectors[1].size).toBe(0);
    });
});

describe('cosine', () => {
    it('is 1 for the same direction, 0 for no shared features, and 0 for an empty vector', () => {
        const [a, b, c] = buildVectors(['dns cache ttl', 'dns cache ttl', 'quantum photons']);
        expect(cosine(a, b)).toBeCloseTo(1);
        expect(cosine(a, c)).toBe(0);
        expect(cosine(a, new Map())).toBe(0);
        expect(cosine(new Map(), new Map())).toBe(0);
    });

    it('stays between 0 and 1 for partly shared vectors', () => {
        const [a, b] = buildVectors(['dns cache ttl records', 'dns cache browsers']);
        const value = cosine(a, b);
        expect(value).toBeGreaterThan(0);
        expect(value).toBeLessThan(1);
    });
});

describe('support', () => {
    const reference = 'DNS caching stores answers from resolvers for the TTL field of each record.';

    it('is the share of the text terms that appear in the reference', () => {
        expect(support('DNS caching stores answers', reference)).toBe(1);
        expect(support('quantum photons teleport', reference)).toBe(0);
        expect(support('DNS caching quantum photons', reference)).toBeCloseTo(0.5);
    });

    it('is 0 when the text has no terms', () => {
        expect(support('the of and', reference)).toBe(0);
        expect(support('', reference)).toBe(0);
    });
});
