import { describe, expect, it } from 'vitest';
import { buildVectors, cosine, numbersIn, pointLanguage, shingleJaccard, support, terms } from '../textSimilarity';
import { CORPUS_POINTS } from './fixtures/pages';
import { OOP_POINTS } from './fixtures/oop';
import { E2E_POINTS } from './fixtures/e2ePages';

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

const docs = (...texts: string[]) => texts.map(text => ({ text }));

describe('buildVectors', () => {
    it('gives a word that every document uses a lower weight than a rare one (IDF)', () => {
        const [first] = buildVectors(docs('dns cache ttl', 'dns browser', 'dns resolver'));
        expect(first.get('dns')).toBeDefined();
        expect(first.get('ttl')).toBeGreaterThan(first.get('dns') ?? 0);
    });

    it('adds adjacent term pairs as features', () => {
        const [vector] = buildVectors(docs('dns cache', 'other words'));
        expect(vector.has('dns cach')).toBe(true);
    });

    it('returns one vector per document, empty for a text with no terms', () => {
        const vectors = buildVectors(docs('', 'the and of'));
        expect(vectors).toHaveLength(2);
        expect(vectors[0].size).toBe(0);
        expect(vectors[1].size).toBe(0);
    });

    it('counts the boost text at weight 2: a boosted word weighs twice an unboosted one', () => {
        const plain = buildVectors([{ text: 'ttl resolver' }, { text: 'quantum photons' }])[0];
        const boosted = buildVectors([{ text: 'ttl resolver', boost: 'ttl' }, { text: 'quantum photons' }])[0];
        // "ttl" gets its body weight plus the boost weight (2): three times the plain weight
        expect(boosted.get('ttl')).toBeCloseTo((plain.get('ttl') ?? 0) * 3);
        expect(boosted.get('resolver')).toBeCloseTo(plain.get('resolver') ?? 0);
    });

    it('lets a boost word that is not in the text add its own feature', () => {
        const [vector] = buildVectors([{ text: 'dns cache', boost: 'resolver' }, { text: 'other words' }]);
        expect(vector.has('resolver')).toBe(true);
        expect(vector.get('resolver')).toBeCloseTo(2 * vector.get('cach')!);
    });

    it('treats a missing or empty boost the same as no boost', () => {
        const [plain] = buildVectors([{ text: 'dns cache' }, { text: 'other' }]);
        const [empty] = buildVectors([{ text: 'dns cache', boost: '' }, { text: 'other' }]);
        expect(empty).toEqual(plain);
    });
});

describe('cosine', () => {
    it('is 1 for the same direction, 0 for no shared features, and 0 for an empty vector', () => {
        const [a, b, c] = buildVectors(docs('dns cache ttl', 'dns cache ttl', 'quantum photons'));
        expect(cosine(a, b)).toBeCloseTo(1);
        expect(cosine(a, c)).toBe(0);
        expect(cosine(a, new Map())).toBe(0);
        expect(cosine(new Map(), new Map())).toBe(0);
    });

    it('stays between 0 and 1 for partly shared vectors', () => {
        const [a, b] = buildVectors(docs('dns cache ttl records', 'dns cache browsers'));
        const value = cosine(a, b);
        expect(value).toBeGreaterThan(0);
        expect(value).toBeLessThan(1);
    });
});

describe('shingleJaccard', () => {
    it('is 1 for identical texts, also when they are shorter than the shingle size', () => {
        expect(shingleJaccard('The resolver caches every answer.', 'The resolver caches every answer.')).toBe(1);
        expect(shingleJaccard('two words', 'two words')).toBe(1);
    });

    it('is 0 when one text is empty or they share no word pairs', () => {
        expect(shingleJaccard('', '')).toBe(0);
        expect(shingleJaccard('', 'some words here')).toBe(0);
        expect(shingleJaccard('alpha beta gamma delta', 'one two three four')).toBe(0);
    });

    it('is symmetric and stays between 0 and 1', () => {
        const a = 'The resolver caches every answer it receives, so repeat lookups skip the network.';
        const b = 'The resolver caches every answer it receives, so repeated lookups skip the network.';
        const value = shingleJaccard(a, b);
        expect(value).toBe(shingleJaccard(b, a));
        expect(value).toBeGreaterThan(0.5);
        expect(value).toBeLessThan(1);
    });

    it('ignores case and punctuation, and reads "3,600" as "3600"', () => {
        expect(shingleJaccard('TTL is 3,600 seconds.', 'ttl is 3600 seconds')).toBe(1);
    });

    it('accepts another shingle size', () => {
        // "a b", "b c", "c d" against "a b", "b x", "x d": one shared pair out of five distinct pairs
        expect(shingleJaccard('a b c d', 'a b x d', 2)).toBeCloseTo(1 / 5);
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

describe('pointLanguage', () => {
    it('labels a point of English function words as en', () => {
        expect(pointLanguage('Classes define abstract definitions for types of objects.')).toBe('en');
        expect(pointLanguage('The resolver keeps a copy of the answer for the time that the TTL is set to.')).toBe(
            'en'
        );
    });

    it('labels a point of Portuguese with almost no English function words as other', () => {
        expect(pointLanguage('Protótipos servem para herdar propriedades de outros objetos.')).toBe('other');
        expect(pointLanguage('Objetos em JavaScript são associações de pares valor e função.')).toBe('other');
    });

    it('is unknown under six words, whatever the language', () => {
        expect(pointLanguage('Classes define abstract types.')).toBe('unknown');
        expect(pointLanguage('Protótipos servem para herdar propriedades.')).toBe('unknown');
        expect(pointLanguage('')).toBe('unknown');
    });

    it('is unknown for a point between the cut-offs, and for an other-language point of 6 or 7 words', () => {
        // 25 words with one English marker: 4 %, not below the 4 % cut-off, so unknown
        expect(
            pointLanguage(
                'uno dos tres cuatro cinco seis siete ocho nueve diez once doce trece catorce quince dieciseis diecisiete dieciocho diecinueve veinte veintiuno veintidos veintitres veinticuatro the'
            )
        ).toBe('unknown');
        // 7 words with no English marker: too short to tell
        expect(pointLanguage('Protótipos servem para herdar propriedades de outros')).toBe('unknown');
    });

    it('counts letters only: punctuation and numbers do not make a point long enough', () => {
        expect(pointLanguage('3600 3600 3600 3600 3600 3600 3600 3600 3600')).toBe('unknown');
    });

    it('labels every English and Portuguese point of the fixture corpora correctly (no English point is other)', () => {
        // OOP source 3 is the Portuguese article; every other point is English
        const english = [...OOP_POINTS.filter(item => item.sourceRef !== 3), ...E2E_POINTS, ...CORPUS_POINTS];
        for (const point of english) expect(pointLanguage(point.text)).not.toBe('other');
        for (const point of OOP_POINTS.filter(item => item.sourceRef === 3)) {
            expect(pointLanguage(point.text)).not.toBe('en');
        }
    });
});
