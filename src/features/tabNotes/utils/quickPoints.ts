// Quick points (spec §6.3): deterministic and extractive. Every point is a sentence of the page, so its attribution is
// right by construction. No AI: this is the path for devices without the model and the fallback for every AI step.
import {
    GENERIC_HEADINGS,
    POINT_MAX_CHARS,
    QUICK_DESCRIPTION_MIN_CHARS,
    QUICK_MAX_POINTS_PER_SECTION,
    QUICK_MIN_LETTER_RATIO,
    QUICK_POINTS_PER_SOURCE,
    QUICK_SECTION_START_BONUS,
    QUICK_SENTENCE_MAX_CHARS,
    QUICK_SENTENCE_MIN_CHARS,
    TOPIC_HINT_MAX_CHARS,
} from '../constants';
import { CleanPage, KeyPoint, NoteSource } from '../types';
import { buildVectors, cosine } from './textSimilarity';

/** A sentence ends at . ! or ? (or the end of the paragraph) */
const SENTENCE = /[^.!?]+(?:[.!?]+|$)/g;

/** Cuts at a word boundary and adds "…" when the text is longer than max (the result is at most max characters) */
export function clipText(text: string, max: number): string {
    if (text.length <= max) return text;
    const cut = text.slice(0, max - 1);
    const space = cut.lastIndexOf(' ');
    const base = space > 0 ? cut.slice(0, space) : cut;
    return `${base.trimEnd()}…`;
}

/** Every text of a page in reading order (description, headings, paragraphs): the reference for grounding */
export function pageTextOf(page: CleanPage): string {
    const texts = [page.description];
    for (const section of page.sections) texts.push(section.heading, ...section.paragraphs);
    return texts.filter(text => text !== '').join('\n');
}

/** A section heading as a topic hint, or '' for generic headings such as "Introduction" or "Comments" */
export function topicHintFor(heading: string): string {
    const clean = heading.replace(/\s+/g, ' ').trim();
    const key = clean.toLowerCase().replace(/[\s:.!]+$/, '');
    if (!clean || GENERIC_HEADINGS.includes(key)) return '';
    return clipText(clean, TOPIC_HINT_MAX_CHARS);
}

interface Candidate {
    text: string;
    sectionIndex: number;
    /** Position in reading order */
    order: number;
    /** First sentence of its section */
    sectionStart: boolean;
    hint: string;
    score: number;
    /** The sentence after it in the same paragraph: added for context when the two fit in a point */
    following: string;
}

/** Mostly letters, and within the sentence length range: skips code, number tables and navigation leftovers */
function isCandidate(text: string): boolean {
    if (text.length < QUICK_SENTENCE_MIN_CHARS || text.length > QUICK_SENTENCE_MAX_CHARS) return false;
    const letters = (text.match(/\p{L}/gu) ?? []).length;
    return letters / text.length >= QUICK_MIN_LETTER_RATIO;
}

function candidatesOf(page: CleanPage): Candidate[] {
    const candidates: Candidate[] = [];
    page.sections.forEach((section, sectionIndex) => {
        const hint = topicHintFor(section.heading);
        let sectionStart = true;
        for (const paragraph of section.paragraphs) {
            const sentences = (paragraph.match(SENTENCE) ?? []).map(match => match.trim());
            for (const [i, text] of sentences.entries()) {
                const first = sectionStart;
                sectionStart = false;
                if (!isCandidate(text)) continue;
                const following = sentences[i + 1] ?? '';
                candidates.push({
                    text,
                    sectionIndex,
                    order: candidates.length,
                    sectionStart: first,
                    hint,
                    score: 0,
                    following,
                });
            }
        }
    });
    return candidates;
}

/**
 * Up to QUICK_POINTS_PER_SOURCE points: the page description first (when long enough), then the sentences that best
 * match the page's own words (at most QUICK_MAX_POINTS_PER_SECTION per section), in page order.
 */
export function extractPointsQuick(source: NoteSource, page: CleanPage): KeyPoint[] {
    const candidates = candidatesOf(page);
    const description = page.description.length >= QUICK_DESCRIPTION_MIN_CHARS ? page.description : '';
    const descriptionKey = description.toLowerCase();

    // The page's own term vector is the last one; IDF is over the page's candidate sentences
    const vectors = buildVectors([...candidates.map(candidate => candidate.text), pageTextOf(page)]);
    const pageVector = vectors[vectors.length - 1];
    for (const [i, candidate] of candidates.entries()) {
        candidate.score = cosine(vectors[i], pageVector) + (candidate.sectionStart ? QUICK_SECTION_START_BONUS : 0);
    }

    const room = QUICK_POINTS_PER_SOURCE - (description ? 1 : 0);
    const perSection = new Map<number, number>();
    const picked: Candidate[] = [];
    const ranked = candidates
        .filter(candidate => candidate.text.toLowerCase() !== descriptionKey)
        .sort((a, b) => b.score - a.score || a.order - b.order);
    for (const candidate of ranked) {
        if (picked.length >= room) break;
        const count = perSection.get(candidate.sectionIndex) ?? 0;
        if (count >= QUICK_MAX_POINTS_PER_SECTION) continue;
        perSection.set(candidate.sectionIndex, count + 1);
        picked.push(candidate);
    }
    picked.sort((a, b) => a.order - b.order);

    // A point is its sentence plus the one after it (more to learn from), when both fit. A sentence that was already
    // added to the previous point as its follow-up is not a point of its own.
    const described: { text: string; hint: string }[] = [];
    for (const candidate of picked) {
        const joined = `${candidate.text} ${candidate.following}`.trim();
        if (described.some(point => point.text.includes(candidate.text))) continue;
        const text = joined.length <= POINT_MAX_CHARS ? joined : candidate.text;
        described.push({ text: clipText(text, POINT_MAX_CHARS), hint: candidate.hint });
    }

    const points = [...(description ? [{ text: clipText(description, POINT_MAX_CHARS), hint: '' }] : []), ...described];
    return points.map((point, i) => ({
        id: `p${source.ref}-${i + 1}`,
        sourceRef: source.ref,
        text: point.text,
        topicHint: point.hint,
    }));
}
