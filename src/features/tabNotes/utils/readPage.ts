// Reading a page's text. `readPage` is serialized by chrome.scripting.executeScript and runs inside the page, so it must
// be self-contained: no imports, no closures over module state, no outer constants (spec D-T12). Everything it needs is
// declared inside it. It only reads the live DOM and never changes it.
import {
    PAGE_DESCRIPTION_MAX_CHARS,
    PAGE_FIELD_MAX_CHARS,
    PAGE_READ_CHAR_CAP,
    PAGE_READ_ELEMENT_CAP,
    PAGE_ASLEEP_MESSAGE,
    PAGE_READ_TIMEOUT_MESSAGE,
    PAGE_READ_TIMEOUT_MS,
    PAGE_URL_MAX_CHARS,
} from '../constants';
import { PageBlock, PageReadError, PageSnapshot, ReadableTab } from '../types';

/** Runs inside the page. `maxChars` and `maxElements` are the caps from constants (the only inputs). */
export function readPage(maxChars: number, maxElements: number): PageSnapshot {
    const SKIPPED =
        'nav, aside, form, input, textarea, select, script, style, noscript, template, svg, canvas, iframe, ' +
        '[role="navigation"], [role="banner"], [role="contentinfo"], [role="complementary"], [role="search"]';
    const TEXT_BLOCKS = 'h1, h2, h3, h4, h5, h6, p, li, pre, blockquote, dt, dd, td, figcaption';
    // Below this many characters the blocks are assumed to be missing (text in bare divs): use innerText instead
    const FALLBACK_MIN_CHARS = 200;

    const collapse = (text: string) => text.replace(/\s+/g, ' ').trim();

    // One element whose subtree is never read: the skipped list, hidden parts, and editable content (never read)
    const skipped = (node: Element): boolean => {
        const editable = node.getAttribute('contenteditable');
        return (
            node.matches(SKIPPED) ||
            node.hasAttribute('hidden') ||
            node.getAttribute('aria-hidden') === 'true' ||
            (editable !== null && editable !== 'false')
        );
    };

    // Root: <main> or [role="main"], else the article with the most text, else the body
    let root: Element | null = document.querySelector('main, [role="main"]');
    if (!root) {
        let longest = 0;
        for (const article of Array.from(document.querySelectorAll('article'))) {
            const length = collapse(article.textContent ?? '').length;
            if (length > longest) {
                longest = length;
                root = article;
            }
        }
    }
    root = root ?? document.body;

    const blocks: PageBlock[] = [];
    let chars = 0;
    let truncated = false;

    // Keeps text while the character budget lasts. Returns false once no budget is left.
    const take = (block: PageBlock): boolean => {
        const room = maxChars - chars;
        if (room <= 0) {
            truncated = true;
            return false;
        }
        const text = block.text.slice(0, room);
        if (text.length < block.text.length) truncated = true;
        blocks.push({ ...block, text });
        chars += text.length;
        return true;
    };

    // Skipped by the rules in spec §5.3. Only ancestors up to the root count, so a page wrapped in a <form> still reads.
    const excluded = (element: Element): boolean => {
        for (let node: Element | null = element; node && node !== root; node = node.parentElement) {
            if (skipped(node)) return true;
            if ((node.localName === 'header' || node.localName === 'footer') && !node.closest('article')) return true;
        }
        return typeof element.checkVisibility === 'function' && !element.checkVisibility();
    };

    // Text of an element without its skipped subtrees, read through a TreeWalker (no mutation)
    const textOf = (element: Element): string => {
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
            acceptNode: (node: Node) => {
                if (node.nodeType === Node.TEXT_NODE) return NodeFilter.FILTER_ACCEPT;
                return skipped(node as Element) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_SKIP;
            },
        });
        let text = '';
        for (let node = walker.nextNode(); node; node = walker.nextNode()) text += node.nodeValue ?? '';
        return collapse(text);
    };

    const candidates = root ? Array.from(root.querySelectorAll(TEXT_BLOCKS)) : [];
    let visited = 0;
    for (const element of candidates) {
        if (visited >= maxElements) {
            truncated = true;
            break;
        }
        visited += 1;
        // Innermost rule: a wrapper such as an <li> around a <p> is not read; the <p> is
        if (element.querySelector(TEXT_BLOCKS) || excluded(element)) continue;
        const text = textOf(element);
        if (!text) continue;
        const level = /^h[1-6]$/.test(element.localName) ? Number(element.localName[1]) : undefined;
        const block: PageBlock = level === undefined ? { kind: 'text', text } : { kind: 'heading', level, text };
        if (!take(block)) break;
    }

    // Sites that put their text in bare divs: use the rendered text, but only when it holds more than the blocks did
    if (root && chars < FALLBACK_MIN_CHARS) {
        const lines = String((root as HTMLElement).innerText ?? '')
            .split('\n')
            .map(collapse)
            .filter(line => line.length > 0);
        if (lines.join(' ').length > chars) {
            blocks.length = 0;
            chars = 0;
            truncated = false;
            for (const line of lines) {
                if (!take({ kind: 'text', text: line })) break;
            }
        }
    }

    const meta = (selector: string) => document.querySelector(selector)?.getAttribute('content') ?? '';
    const description = collapse(meta('meta[name="description"]') || meta('meta[property="og:description"]')).slice(
        0,
        1000
    );

    return {
        href: location.href,
        contentType: document.contentType,
        lang: document.documentElement.lang,
        description,
        blocks,
        truncated,
    };
}

export class PageReadFailure extends Error {
    readonly code: PageReadError;

    constructor(code: PageReadError, message: string) {
        super(message);
        this.name = 'PageReadFailure';
        this.code = code;
    }
}

const stripFragment = (url: string) => url.split('#')[0];

const isString = (value: unknown, maxLength: number): value is string =>
    typeof value === 'string' && value.length <= maxLength;

/** Shape and size check for what came back from the page, which is untrusted */
export function isPageSnapshot(value: unknown): value is PageSnapshot {
    if (!value || typeof value !== 'object') return false;
    const snapshot = value as Record<string, unknown>;
    if (!isString(snapshot.href, PAGE_URL_MAX_CHARS)) return false;
    if (!isString(snapshot.contentType, PAGE_FIELD_MAX_CHARS) || !isString(snapshot.lang, PAGE_FIELD_MAX_CHARS)) {
        return false;
    }
    if (!isString(snapshot.description, PAGE_DESCRIPTION_MAX_CHARS)) return false;
    if (typeof snapshot.truncated !== 'boolean') return false;
    if (!Array.isArray(snapshot.blocks) || snapshot.blocks.length > PAGE_READ_ELEMENT_CAP) return false;

    let total = 0;
    for (const block of snapshot.blocks as unknown[]) {
        if (!block || typeof block !== 'object') return false;
        const { kind, level, text } = block as Record<string, unknown>;
        if (kind !== 'heading' && kind !== 'text') return false;
        if (kind === 'heading' && !(Number.isInteger(level) && (level as number) >= 1 && (level as number) <= 6)) {
            return false;
        }
        if (typeof text !== 'string') return false;
        total += text.length;
        if (total > PAGE_READ_CHAR_CAP) return false;
    }
    return true;
}

function failureFromInjection(error: unknown): PageReadFailure {
    const message = error instanceof Error ? error.message : String(error);
    if (/policy|blocked|cannot be scripted/i.test(message)) {
        return new PageReadFailure('blocked', "Your browser doesn't let extensions read this page.");
    }
    if (/cannot access|missing host permission/i.test(message)) {
        return new PageReadFailure('no-access', "TabPlex doesn't have access to this site.");
    }
    if (/no tab with id/i.test(message)) return new PageReadFailure('closed', 'This tab was closed.');
    return new PageReadFailure('failed', 'This page could not be read.');
}

/** True when the tab is frozen or discarded right now: a script sent to it would wait until the tab is opened */
async function isAsleep(tabId: number): Promise<boolean> {
    try {
        const current = await chrome.tabs.get(tabId);
        return Boolean(current.discarded || current.frozen);
    } catch {
        return false;
    }
}

/**
 * Reads one tab's page (top frame only, read-only). Rejects with a PageReadFailure whose `code` says why.
 * Cancelling with `signal` rejects with an AbortError DOMException.
 */
export async function snapshotTab(tab: ReadableTab, signal?: AbortSignal): Promise<PageSnapshot> {
    const aborted = () => new DOMException('The page read was cancelled.', 'AbortError');
    if (signal?.aborted) throw aborted();
    // A tab can fall asleep after it was listed (the dialog may stay open for minutes): don't wait on it
    if (await isAsleep(tab.id)) throw new PageReadFailure('asleep', PAGE_ASLEEP_MESSAGE);
    if (signal?.aborted) throw aborted();

    let timer: ReturnType<typeof setTimeout> | undefined;
    let onAbort: (() => void) | undefined;
    const limit = new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
            // No answer: say so plainly when the cause is a tab that fell asleep meanwhile
            isAsleep(tab.id).then(asleep =>
                reject(
                    asleep
                        ? new PageReadFailure('asleep', PAGE_ASLEEP_MESSAGE)
                        : new PageReadFailure('timeout', PAGE_READ_TIMEOUT_MESSAGE)
                )
            );
        }, PAGE_READ_TIMEOUT_MS);
        onAbort = () => reject(aborted());
        signal?.addEventListener('abort', onAbort, { once: true });
    });

    try {
        const injected = chrome.scripting
            .executeScript({
                target: { tabId: tab.id, allFrames: false },
                func: readPage,
                args: [PAGE_READ_CHAR_CAP, PAGE_READ_ELEMENT_CAP],
            })
            .catch((error: unknown) => {
                throw failureFromInjection(error);
            });
        const results = await Promise.race([injected, limit]);
        const value: unknown = results[0]?.result;
        if (!isPageSnapshot(value)) throw new PageReadFailure('failed', 'This page could not be read.');
        if (value.contentType === 'application/pdf') throw new PageReadFailure('pdf', "Can't read PDFs yet.");
        if (stripFragment(value.href) !== stripFragment(tab.url)) {
            throw new PageReadFailure('changed', 'This tab moved to another page. Pick it again.');
        }
        return value;
    } finally {
        clearTimeout(timer);
        if (onAbort) signal?.removeEventListener('abort', onAbort);
    }
}
