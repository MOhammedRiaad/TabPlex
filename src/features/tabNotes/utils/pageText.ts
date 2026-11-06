// Cleaning a page snapshot into sections of paragraphs (spec §5.4). Pure: no chrome.* and no DOM.
import {
    BOILERPLATE_MAX_CHARS,
    BOILERPLATE_PHRASES,
    ENGLISH_MARKER_MIN_SHARE,
    ENGLISH_MARKERS,
    LANGUAGE_MIN_WORDS,
    LANGUAGE_SAMPLE_WORDS,
    MIN_BLOCK_CHARS,
    MIN_PAGE_CHARS,
    PAGE_TEXT_CHAR_LIMIT,
    PARAGRAPH_MAX_CHARS,
} from '../constants';
import { CleanPage, PageSection, PageSnapshot } from '../types';
import { PageReadFailure } from './readPage';

const collapse = (text: string) => text.replace(/\s+/g, ' ').trim();

/** Splits a long paragraph at sentence ends; a single sentence longer than the limit is cut */
function splitParagraph(text: string): string[] {
    if (text.length <= PARAGRAPH_MAX_CHARS) return [text];
    const sentences = text.match(/[^.!?]+[.!?]*\s*/g) ?? [text];
    const parts: string[] = [];
    let current = '';
    for (const raw of sentences) {
        let sentence = raw.trim();
        while (sentence.length > PARAGRAPH_MAX_CHARS) {
            if (current) {
                parts.push(current);
                current = '';
            }
            parts.push(sentence.slice(0, PARAGRAPH_MAX_CHARS));
            sentence = sentence.slice(PARAGRAPH_MAX_CHARS).trim();
        }
        if (!sentence) continue;
        if (current && current.length + 1 + sentence.length > PARAGRAPH_MAX_CHARS) {
            parts.push(current);
            current = sentence;
        } else {
            current = current ? `${current} ${sentence}` : sentence;
        }
    }
    if (current) parts.push(current);
    return parts;
}

const isBoilerplate = (text: string): boolean => {
    if (text.length >= BOILERPLATE_MAX_CHARS) return false;
    const lower = text.toLowerCase();
    return BOILERPLATE_PHRASES.some(phrase => lower.includes(phrase));
};

/**
 * Turns a snapshot into sections of cleaned paragraphs. Throws PageReadFailure('empty') when less than
 * MIN_PAGE_CHARS of text is left. `pickedTitle` is the tab title the user saw; an h1 with that text is dropped.
 */
export function cleanPage(snapshot: PageSnapshot, pickedTitle: string): CleanPage {
    const title = collapse(pickedTitle).toLowerCase();
    const seen = new Set<string>();
    const sections: PageSection[] = [{ heading: '', paragraphs: [] }];
    let chars = 0;
    let truncated = snapshot.truncated;
    let full = false;

    const current = () => sections[sections.length - 1];

    const addParagraph = (text: string) => {
        const room = PAGE_TEXT_CHAR_LIMIT - chars;
        if (room <= 0) {
            truncated = true;
            full = true;
            return;
        }
        let kept = text;
        if (text.length > room) {
            // Cut at a word boundary when there is one
            const cut = text.slice(0, room);
            const space = cut.lastIndexOf(' ');
            kept = space > 0 ? cut.slice(0, space) : cut;
            truncated = true;
            full = true;
        }
        current().paragraphs.push(kept);
        chars += kept.length;
    };

    for (const block of snapshot.blocks) {
        if (full) break;
        const text = collapse(block.text);
        if (!text) continue;

        if (block.kind === 'heading' && block.level !== undefined && block.level <= 3) {
            if (block.level === 1 && text.toLowerCase() === title) continue;
            sections.push({ heading: text, paragraphs: [] });
            continue;
        }

        // Text blocks: menus, buttons and labels are too short, boilerplate and repeats add nothing
        if (block.kind === 'text' && text.length < MIN_BLOCK_CHARS) continue;
        if (isBoilerplate(text)) continue;
        const key = text.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        for (const part of splitParagraph(text)) addParagraph(part);
    }

    const kept = sections.filter(section => section.paragraphs.length > 0);
    if (chars < MIN_PAGE_CHARS) {
        throw new PageReadFailure(
            'empty',
            'Not enough text on this page. For an app-style page, reload the tab and try again.'
        );
    }

    const lang = snapshot.lang.trim().toLowerCase();
    const declaredOther = lang !== '' && !lang.startsWith('en');
    return {
        sections: kept,
        description: collapse(snapshot.description),
        chars,
        truncated,
        // The lang attribute is often wrong (a Portuguese Medium article says "en"), so the text decides too
        notEnglish: declaredOther || !readsAsEnglish(kept.flatMap(section => section.paragraphs).join(' ')),
    };
}

/**
 * Whether prose looks English: the share of common English function words in the first words of the text. Short
 * samples and text with no letters (code, numbers) count as English, so only clear cases are labelled.
 */
export function readsAsEnglish(text: string): boolean {
    const words = (text.toLowerCase().match(/\p{L}+/gu) ?? []).slice(0, LANGUAGE_SAMPLE_WORDS);
    if (words.length < LANGUAGE_MIN_WORDS) return true;
    const markers = words.filter(word => ENGLISH_MARKERS.has(word)).length;
    return markers / words.length >= ENGLISH_MARKER_MIN_SHARE;
}
