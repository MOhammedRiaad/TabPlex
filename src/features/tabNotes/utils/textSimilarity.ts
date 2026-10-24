// Word-level text helpers for the tab notes (spec §7.2): tokens, stopwords, light stemming, numbers, TF-IDF
// vectors and the grounding check. Pure: no chrome.* and no DOM.
import {
    ENGLISH_MARKERS,
    POINT_ENGLISH_MIN_SHARE,
    POINT_LANGUAGE_MIN_WORDS,
    POINT_OTHER_MAX_SHARE,
    POINT_OTHER_MIN_WORDS,
    STOPWORDS,
} from '../constants';

/** Letters, or numbers with an optional decimal part */
const TOKEN = /\p{L}+|\p{N}+(?:\.\p{N}+)?/gu;
const NUMBER = /\p{N}+(?:\.\p{N}+)?/gu;

/** Lower case, accents removed, thousands separators removed ("3,600" → "3600") */
function normalize(text: string): string {
    return text
        .normalize('NFKD')
        .replace(/\p{M}+/gu, '')
        .toLowerCase()
        .replace(/(\d),(?=\d{3}(?!\d))/g, '$1');
}

/** Numbers compare by value: "1.50" and "1.5" are the same, "40%" is "40" */
const numberKey = (token: string): string => String(Number(token));

/**
 * Suffix rules, first match wins. The minimum is the length of the resulting word, so short words stay as they are
 * ("string" stays, "caches" → "cach", "cached" → "cach").
 */
const SUFFIX_RULES: readonly { pattern: RegExp; replacement: string; minLength: number }[] = [
    { pattern: /ies$/, replacement: 'y', minLength: 3 },
    { pattern: /sses$/, replacement: 'ss', minLength: 3 },
    { pattern: /(ch|sh|x|z)es$/, replacement: '$1', minLength: 3 },
    { pattern: /ing$/, replacement: '', minLength: 4 },
    { pattern: /ed$/, replacement: '', minLength: 4 },
    { pattern: /(?<![sui])s$/, replacement: '', minLength: 3 },
];

/** A tiny suffix stemmer: enough that "caches", "cached" and "caching" meet. No dictionary. */
function stem(word: string): string {
    let result = word;
    for (const rule of SUFFIX_RULES) {
        if (!rule.pattern.test(result)) continue;
        const candidate = result.replace(rule.pattern, rule.replacement);
        if (candidate.length >= rule.minLength) result = candidate;
        break;
    }
    // Trailing silent e: "cache" → "cach", but short words such as "page" stay
    if (result.endsWith('e') && result.length - 1 >= 4) result = result.slice(0, -1);
    return result;
}

/** Content terms of a text, in order: lower case, stopwords and words under 3 letters dropped, stemmed. Numbers kept. */
export function terms(text: string): string[] {
    const out: string[] = [];
    for (const token of normalize(text).match(TOKEN) ?? []) {
        if (/^\p{N}/u.test(token)) {
            out.push(numberKey(token));
            continue;
        }
        if (token.length < 3 || STOPWORDS.has(token)) continue;
        out.push(stem(token));
    }
    return out;
}

/** Every number in a text, normalized with numberKey ("3,600 ms and 1.5%" → {"3600", "1.5"}) */
export function numbersIn(text: string): Set<string> {
    return new Set((normalize(text).match(NUMBER) ?? []).map(numberKey));
}

/** One document for buildVectors: its text, and optionally a short tag (topic hint or heading) counted at weight 2 */
export interface VectorDocument {
    text: string;
    boost?: string;
}

/**
 * TF-IDF vectors, one per document of this run. Weight = (1 + ln tf) × idf with idf = ln((N + 1) / (df + 1)) + 1.
 * Adjacent term pairs are added as features at half weight, and the boost text's terms at weight 2. A word every
 * document uses gets a low idf.
 */
export function buildVectors(documents: VectorDocument[]): Map<string, number>[] {
    const featureLists = documents.map(({ text, boost }) => {
        const words = terms(text);
        const boostWords = boost ? terms(boost) : [];
        const pairs = words.slice(1).map((word, i) => `${words[i]} ${word}`);
        return { words, boostWords, pairs };
    });

    const documentFrequency = new Map<string, number>();
    for (const { words, boostWords, pairs } of featureLists) {
        for (const feature of new Set([...words, ...boostWords, ...pairs])) {
            documentFrequency.set(feature, (documentFrequency.get(feature) ?? 0) + 1);
        }
    }

    const n = documents.length;
    const idf = (feature: string) => Math.log((n + 1) / ((documentFrequency.get(feature) ?? 0) + 1)) + 1;

    return featureLists.map(({ words, boostWords, pairs }) => {
        const vector = new Map<string, number>();
        const add = (features: string[], weight: number) => {
            const counts = new Map<string, number>();
            for (const feature of features) counts.set(feature, (counts.get(feature) ?? 0) + 1);
            for (const [feature, count] of counts) {
                vector.set(feature, (vector.get(feature) ?? 0) + (1 + Math.log(count)) * idf(feature) * weight);
            }
        };
        add(words, 1);
        add(boostWords, 2);
        add(pairs, 0.5);
        return vector;
    });
}

/** Cosine similarity of two sparse vectors, 0 to 1 for the non-negative weights buildVectors makes */
export function cosine(a: Map<string, number>, b: Map<string, number>): number {
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (const value of a.values()) normA += value * value;
    for (const value of b.values()) normB += value * value;
    for (const [key, value] of a) dot += value * (b.get(key) ?? 0);
    if (normA === 0 || normB === 0) return 0;
    return dot / Math.sqrt(normA * normB);
}

/** Share of the distinct content terms of `text` that also appear in `reference` (0 when `text` has none) */
export function support(text: string, reference: string): number {
    const own = new Set(terms(text));
    if (own.size === 0) return 0;
    const available = new Set(terms(reference));
    let found = 0;
    for (const term of own) if (available.has(term)) found++;
    return found / own.size;
}

/** Adjacent words of a text (lower case, numbers kept), `size` at a time: the units shingleJaccard compares */
function shinglesOf(text: string, size: number): Set<string> {
    const words = normalize(text).match(TOKEN) ?? [];
    const out = new Set<string>();
    if (words.length <= size) {
        if (words.length > 0) out.add(words.join(' '));
        return out;
    }
    for (let i = 0; i + size <= words.length; i++) out.add(words.slice(i, i + size).join(' '));
    return out;
}

/**
 * Jaccard similarity of the word shingles (adjacent words, `size` at a time) of two texts, from 0 to 1. Catches a page
 * that repeats another page's sentence almost word for word. Two empty texts give 0; identical texts give 1.
 */
export function shingleJaccard(a: string, b: string, size = 3): number {
    const left = shinglesOf(a, size);
    const right = shinglesOf(b, size);
    if (left.size === 0 && right.size === 0) return 0;
    let shared = 0;
    for (const shingle of left) if (right.has(shingle)) shared++;
    return shared / (left.size + right.size - shared);
}

/** The language of one point, judged on its own words (the page's flag says nothing about a single sentence) */
export type PointLanguage = 'en' | 'other' | 'unknown';

/**
 * 'en' when the point has plenty of English function words, 'other' when it has almost none and enough words to tell,
 * else 'unknown'. A model often writes English points for a page in another language, so the page flag is not used.
 */
export function pointLanguage(text: string): PointLanguage {
    const words = text.toLowerCase().match(/\p{L}+/gu) ?? [];
    if (words.length < POINT_LANGUAGE_MIN_WORDS) return 'unknown';
    const share = words.filter(word => ENGLISH_MARKERS.has(word)).length / words.length;
    if (share >= POINT_ENGLISH_MIN_SHARE) return 'en';
    if (share < POINT_OTHER_MAX_SHARE && words.length >= POINT_OTHER_MIN_WORDS) return 'other';
    return 'unknown';
}
