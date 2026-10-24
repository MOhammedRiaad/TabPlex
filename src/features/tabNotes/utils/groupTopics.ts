// Word grouping (spec §7.3, §7.7, §7.8): the "combined" view without AI. Points are clustered by their words (TF-IDF
// cosine, plus a bonus for the same topic name), clusters that span two sources become shared topics, and everything
// else stays in its own tab's section. Pure and deterministic: the same input always gives the same output.
import {
    CONFLICT_SIMILARITY,
    DUPLICATE_COSINE,
    DUPLICATE_SHINGLE,
    HEADING_FILLERS,
    HEADING_TERM_COUNT,
    HEADING_TERM_MIN_SOURCES,
    MAX_POINTS_PER_TOPIC,
    MAX_SHARED_TOPICS,
    SAME_SUBJECT_BONUS,
    SAME_SUBJECT_MAX_SHARE,
    SAME_SUBJECT_MIN_LETTERS,
    SAME_TOPIC_BONUS,
    SHINGLE_SIZE,
    TOPIC_HEADING_MAX_CHARS,
    TOPIC_SIMILARITY,
} from '../constants';
import { KeyPoint, NoteSource, Topic, TopicBullet, TopicConflict } from '../types';
import { clipText } from './quickPoints';
import { buildVectors, cosine, numbersIn, shingleJaccard, terms } from './textSimilarity';

/** The filler words of HEADING_FILLERS after the same stemming as the text, so "allows" matches "allow" */
const HEADING_FILLER_STEMS: ReadonlySet<string> = new Set(HEADING_FILLERS.flatMap(word => terms(word)));

/** Markdown links keep their label, then emphasis, code and heading marks go */
const MARKDOWN_LINK = /!?\[([^[\]]*)\]\([^)]*\)/g;
const LEADING_MARK = /^\s*(?:#{1,6}|>|[-+*]|\d{1,3}[.)])(?=\s)\s*/;
const EMOJI = /[\p{Extended_Pictographic}\p{Join_Control}\p{Variation_Selector}]/gu;
/** Quotes, spaces and punctuation at either end, removed until none is left */
const EDGE_NOISE = /^[\s"'“”‘’«»]+|[\s"'“”‘’«».,;:!?-]+$/g;
/** Words and numbers, for the display form of a heading term */
const WORD = /\p{L}+|\p{N}+/gu;

function trimEdges(text: string): string {
    let out = text;
    let previous: string;
    do {
        previous = out;
        out = out.replace(EDGE_NOISE, '');
    } while (out !== previous);
    return out;
}

/**
 * A heading for a topic or a source section: Markdown, quotes, emoji and trailing punctuation removed, cut at
 * TOPIC_HEADING_MAX_CHARS on a word boundary. Never empty: "Topic <number>" when nothing is left.
 */
export function cleanTopicHeading(text: string, number: number): string {
    let clean = text
        .replace(MARKDOWN_LINK, '$1')
        .replace(/[*_`~]+/g, ' ')
        .replace(EMOJI, '');
    let previous: string;
    do {
        previous = clean;
        clean = clean.replace(LEADING_MARK, '');
    } while (clean !== previous);
    const clipped = trimEdges(clipText(trimEdges(clean.replace(/\s+/g, ' ')), TOPIC_HEADING_MAX_CHARS));
    return clipped || `Topic ${number}`;
}

/** The sources of some points: sorted, unique source refs of the points with these ids (the only source of a bullet) */
export function sourcesOf(pointIds: string[], points: KeyPoint[]): number[] {
    const wanted = new Set(pointIds);
    const refs = new Set<number>();
    for (const point of points) if (wanted.has(point.id)) refs.add(point.sourceRef);
    return [...refs].sort((a, b) => a - b);
}

/** Canonical name of a topic hint: the mapped name when there is one, else the hint itself; '' for no hint */
function nameOf(hint: string, canonical: Map<string, string> | undefined): string {
    if (hint === '') return '';
    return canonical?.get(hint) ?? hint;
}

/**
 * The leading content word of a point (its first word after stopwords, as a stem), when it is long enough to say what
 * the point is about. Numbers are not words. Undefined otherwise.
 */
function leadingTermOf(text: string): string | undefined {
    const first = terms(text).find(term => /^\p{L}+$/u.test(term));
    return first !== undefined && first.length >= SAME_SUBJECT_MIN_LETTERS ? first : undefined;
}

/** Average-linkage clustering: merges the pair with the highest average similarity while it is high enough */
function clusterPoints(similarity: number[][]): number[][] {
    const members: number[][] = similarity.map((_, i) => [i]);
    const alive = similarity.map(() => true);
    const sums = similarity.map(row => [...row]);
    for (;;) {
        // Clusters in order of their lowest point index: the first pair found wins a tie (lowest indexes)
        const order = alive
            .map((_, id) => id)
            .filter(id => alive[id])
            .sort((a, b) => members[a][0] - members[b][0]);
        let best: { a: number; b: number; average: number } | null = null;
        for (let i = 0; i < order.length; i++) {
            for (let j = i + 1; j < order.length; j++) {
                const a = order[i];
                const b = order[j];
                if (members[a].length + members[b].length > MAX_POINTS_PER_TOPIC) continue;
                const average = sums[a][b] / (members[a].length * members[b].length);
                if (average < TOPIC_SIMILARITY) continue;
                if (!best || average > best.average) best = { a, b, average };
            }
        }
        if (!best) break;
        const { a, b } = best;
        for (const k of order) {
            if (k === a || k === b) continue;
            sums[a][k] += sums[b][k];
            sums[k][a] = sums[a][k];
        }
        members[a] = [...members[a], ...members[b]].sort((x, y) => x - y);
        alive[b] = false;
    }
    return members.filter((_, id) => alive[id]);
}

function sameNumbers(a: Set<string>, b: Set<string>): boolean {
    if (a.size !== b.size) return false;
    for (const value of a) if (!b.has(value)) return false;
    return true;
}

/** A word group of a cluster: the points in it, the first one being the bullet's text (its central point) */
type Group = number[];

/**
 * Bullets of a shared topic. Points from different sources that are near-identical and give the same numbers become one
 * bullet; every other point is its own bullet. Each group lists its central point first (the bullet's text).
 */
function bulletGroups(members: number[], items: KeyPoint[], vectors: Map<string, number>[], numbers: Set<string>[]) {
    const parent = members.map((_, k) => k);
    // The sources of each group (by root): a group never holds two points from the same source
    const sourcesOfRoot = members.map(member => new Set([items[member].sourceRef]));
    const root = (k: number): number => {
        let r = k;
        while (parent[r] !== r) r = parent[r];
        return r;
    };
    for (let p = 0; p < members.length; p++) {
        for (let q = p + 1; q < members.length; q++) {
            const a = members[p];
            const b = members[q];
            if (items[a].sourceRef === items[b].sourceRef) continue;
            if (!sameNumbers(numbers[a], numbers[b])) continue;
            const near =
                cosine(vectors[a], vectors[b]) >= DUPLICATE_COSINE ||
                shingleJaccard(items[a].text, items[b].text, SHINGLE_SIZE) >= DUPLICATE_SHINGLE;
            if (!near) continue;
            const rp = root(p);
            const rq = root(q);
            if (rp === rq) continue;
            const overlap = [...sourcesOfRoot[rq]].some(ref => sourcesOfRoot[rp].has(ref));
            if (overlap) continue;
            parent[rq] = rp;
            for (const ref of sourcesOfRoot[rq]) sourcesOfRoot[rp].add(ref);
        }
    }

    const byRoot = new Map<number, Group>();
    members.forEach((member, k) => {
        const r = root(k);
        byRoot.set(r, [...(byRoot.get(r) ?? []), member]);
    });

    return [...byRoot.values()].map(group => {
        if (group.length === 1) return group;
        // The most central point: most similar to the others; ties go to the earliest point (lowest source ref)
        let central = group[0];
        let bestScore = -1;
        for (const x of group) {
            let score = 0;
            for (const y of group) if (y !== x) score += cosine(vectors[x], vectors[y]);
            if (score > bestScore) {
                bestScore = score;
                central = x;
            }
        }
        return [central, ...group.filter(x => x !== central)];
    });
}

/** Pairs from different sources with similar words and different, non-empty numbers (§7.7): shown, never collapsed */
function conflictsOf(
    members: number[],
    items: KeyPoint[],
    vectors: Map<string, number>[],
    numbers: Set<string>[]
): [number, number][] {
    const pairs: [number, number][] = [];
    for (let p = 0; p < members.length; p++) {
        for (let q = p + 1; q < members.length; q++) {
            const a = members[p];
            const b = members[q];
            if (items[a].sourceRef === items[b].sourceRef) continue;
            if (numbers[a].size === 0 || numbers[b].size === 0 || sameNumbers(numbers[a], numbers[b])) continue;
            if (cosine(vectors[a], vectors[b]) >= CONFLICT_SIMILARITY) pairs.push([a, b]);
        }
    }
    return pairs;
}

/** The most frequent display form of a word ("DNS", not "dns" when the page writes it that way) */
function mostFrequent(counts: Map<string, number>): string {
    const ranked = [...counts.entries()].sort(([a, x], [b, y]) => y - x || (a < b ? -1 : a > b ? 1 : 0));
    return ranked[0]?.[0] ?? '';
}

/**
 * A heading for a shared topic (§7.3 step 8): the canonical name or topic hint that most sources use; else the
 * HEADING_TERM_COUNT words that appear in the most sources of the topic (then the highest weight, then the longer word),
 * skipping filler verbs, in the form the pages write them most often ("ripen, Tomatoes"). Empty when no word qualifies.
 */
function headingOf(members: number[], items: KeyPoint[], names: string[], vectors: Map<string, number>[]): string {
    const byName = new Map<string, { refs: Set<number>; count: number; first: number }>();
    for (const i of members) {
        if (names[i] === '') continue;
        const entry = byName.get(names[i]) ?? { refs: new Set<number>(), count: 0, first: i };
        entry.refs.add(items[i].sourceRef);
        entry.count++;
        byName.set(names[i], entry);
    }
    const [named] = [...byName.entries()].sort(
        ([, a], [, b]) => b.refs.size - a.refs.size || b.count - a.count || a.first - b.first
    );
    if (named) return named[0];

    const weights = new Map<string, number>();
    const sourcesOfWord = new Map<string, Set<number>>();
    for (const i of members) {
        for (const [feature, weight] of vectors[i]) {
            if (feature.includes(' ')) continue;
            weights.set(feature, (weights.get(feature) ?? 0) + weight);
            const refs = sourcesOfWord.get(feature) ?? new Set<number>();
            refs.add(items[i].sourceRef);
            sourcesOfWord.set(feature, refs);
        }
    }
    const forms = new Map<string, Map<string, number>>();
    for (const i of members) {
        for (const token of items[i].text.match(WORD) ?? []) {
            if (/^\p{N}/u.test(token)) continue;
            const stems = terms(token);
            if (stems.length !== 1) continue;
            const counts = forms.get(stems[0]) ?? new Map<string, number>();
            counts.set(token, (counts.get(token) ?? 0) + 1);
            forms.set(stems[0], counts);
        }
    }
    const candidates = [...weights.entries()]
        .map(([stem, weight]) => ({ stem, weight, sources: sourcesOfWord.get(stem)?.size ?? 0 }))
        .filter(
            ({ stem, sources }) =>
                forms.has(stem) && sources >= HEADING_TERM_MIN_SOURCES && !HEADING_FILLER_STEMS.has(stem)
        );
    // Most sources first, then the highest weight, then the longer word, then alphabetical (deterministic)
    candidates.sort(
        (x, y) =>
            y.sources - x.sources ||
            y.weight - x.weight ||
            y.stem.length - x.stem.length ||
            (x.stem < y.stem ? -1 : x.stem > y.stem ? 1 : 0)
    );
    return candidates
        .slice(0, HEADING_TERM_COUNT)
        .map(({ stem }) => mostFrequent(forms.get(stem) ?? new Map()))
        .join(', ');
}

/** A topic before its ids and final heading are set. Bullets and conflicts hold indexes into the sorted points. */
interface TopicDraft {
    kind: 'shared' | 'source';
    sourceRef?: number;
    rawHeading: string;
    bullets: Group[];
    conflicts: [number, number][];
    sourceCount: number;
    firstIndex: number;
}

/** Makes "heading (2)", "heading (3)"… when a heading is already taken (case-insensitive) */
function distinctHeading(heading: string, taken: Set<string>): string {
    let candidate = heading;
    let suffix = 2;
    while (taken.has(candidate.toLowerCase())) candidate = `${heading} (${suffix++})`;
    taken.add(candidate.toLowerCase());
    return candidate;
}

/**
 * The "combined" view (spec §7.3): shared topics first (most sources, then lowest source ref, then most bullets), then
 * one section per source with the points that are not in a shared topic. Returns [] when combining is skipped (fewer
 * than two sources, or no cluster spans two sources): the caller shows the By tab view instead (§7.8).
 */
export function groupTopics(points: KeyPoint[], sources: NoteSource[], canonical?: Map<string, string>): Topic[] {
    const known = new Set(sources.map(source => source.ref));
    const titles = new Map(sources.map(source => [source.ref, source.title]));
    // Sorted by source (stable: input order inside a source), so index order is source-ref order
    const items = points.filter(point => known.has(point.sourceRef)).sort((a, b) => a.sourceRef - b.sourceRef);
    if (new Set(items.map(point => point.sourceRef)).size < 2) return [];

    const vectors = buildVectors(items.map(point => ({ text: point.text, boost: point.topicHint })));
    const numbers = items.map(point => numbersIn(point.text));
    const names = items.map(point => nameOf(point.topicHint, canonical));
    const notEnglish = new Map(sources.map(source => [source.ref, source.notEnglish]));
    const languages = items.map(point => notEnglish.get(point.sourceRef) === true);
    const leads = items.map(point => leadingTermOf(point.text));
    const pointsWithTerm = new Map<string, number>();
    for (const point of items) {
        for (const term of new Set(terms(point.text))) pointsWithTerm.set(term, (pointsWithTerm.get(term) ?? 0) + 1);
    }
    const similarity = items.map((_row, i) =>
        items.map((_column, j) => {
            // Across a source in another language the topic tag and the first word say nothing (the same tag, such as
            // "Classes", sits on a Portuguese and an English point), so only the words count. The model writes English
            // even for such a page, so those points can still join by wording; real Portuguese text shares almost none.
            if (languages[i] !== languages[j]) return Math.min(1, cosine(vectors[i], vectors[j]));
            const sameTopic = names[i] !== '' && names[i] === names[j] ? SAME_TOPIC_BONUS : 0;
            const lead = leads[i];
            const sameSubject =
                lead !== undefined &&
                lead === leads[j] &&
                items[i].sourceRef !== items[j].sourceRef &&
                (pointsWithTerm.get(lead) ?? 0) < items.length * SAME_SUBJECT_MAX_SHARE
                    ? SAME_SUBJECT_BONUS
                    : 0;
            return Math.min(1, cosine(vectors[i], vectors[j]) + sameTopic + sameSubject);
        })
    );

    const shared = clusterPoints(similarity)
        .map(members => ({ members, sourceCount: new Set(members.map(i => items[i].sourceRef)).size }))
        .filter(cluster => cluster.sourceCount >= 2)
        .sort(
            (x, y) =>
                y.sourceCount - x.sourceCount ||
                y.members.length - x.members.length ||
                items[x.members[0]].sourceRef - items[y.members[0]].sourceRef ||
                x.members[0] - y.members[0]
        )
        .slice(0, MAX_SHARED_TOPICS);
    if (shared.length === 0) return [];

    const drafts: TopicDraft[] = shared.map(cluster => {
        const bullets = bulletGroups(cluster.members, items, vectors, numbers).sort((x, y) => {
            const refsOf = (group: Group) => new Set(group.map(i => items[i].sourceRef)).size;
            return refsOf(y) - refsOf(x) || items[x[0]].sourceRef - items[y[0]].sourceRef || x[0] - y[0];
        });
        return {
            kind: 'shared',
            rawHeading: headingOf(cluster.members, items, names, vectors),
            bullets,
            conflicts: conflictsOf(cluster.members, items, vectors, numbers),
            sourceCount: cluster.sourceCount,
            firstIndex: cluster.members[0],
        };
    });
    drafts.sort(
        (x, y) =>
            y.sourceCount - x.sourceCount ||
            items[x.firstIndex].sourceRef - items[y.firstIndex].sourceRef ||
            y.bullets.length - x.bullets.length ||
            x.firstIndex - y.firstIndex
    );

    // Every point that is not in a kept shared topic goes to its own source's section, in point order
    const inShared = new Set(shared.flatMap(cluster => cluster.members));
    const leftoverRefs = [...new Set(items.filter((_, i) => !inShared.has(i)).map(point => point.sourceRef))].sort(
        (a, b) => a - b
    );
    for (const ref of leftoverRefs) {
        const indexes = items.map((_, i) => i).filter(i => !inShared.has(i) && items[i].sourceRef === ref);
        drafts.push({
            kind: 'source',
            sourceRef: ref,
            rawHeading: titles.get(ref) ?? '',
            bullets: indexes.map(i => [i]),
            conflicts: [],
            sourceCount: 1,
            firstIndex: indexes[0],
        });
    }

    const taken = new Set<string>();
    let bulletNumber = 0;
    return drafts.map((draft, position): Topic => {
        const heading = distinctHeading(cleanTopicHeading(draft.rawHeading, position + 1), taken);
        const toBullet = (group: Group): TopicBullet => {
            bulletNumber++;
            return {
                id: `b${bulletNumber}`,
                text: items[group[0]].text,
                pointIds: group.map(i => items[i].id),
                origin: 'point',
                edited: false,
            };
        };
        const conflicts: TopicConflict[] = draft.conflicts.map(([a, b]) => ({
            pointIds: [items[a].id, items[b].id],
            text: '',
        }));
        return {
            id: `t${position + 1}`,
            heading,
            kind: draft.kind,
            ...(draft.kind === 'source' ? { sourceRef: draft.sourceRef } : {}),
            combinedBy: draft.kind === 'shared' ? 'words' : null,
            bullets: draft.bullets.map(toBullet),
            conflicts,
        };
    });
}
