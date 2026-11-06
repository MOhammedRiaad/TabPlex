import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChromeMock, fakeChrome, installChromeMock } from '../../../../test/chromeMock';
import {
    PAGE_ASLEEP_MESSAGE,
    PAGE_READ_CHAR_CAP,
    PAGE_READ_ELEMENT_CAP,
    PAGE_READ_TIMEOUT_MESSAGE,
    PAGE_READ_TIMEOUT_MS,
} from '../../constants';
import { PageSnapshot, ReadableTab } from '../../types';
import { isPageSnapshot, PageReadFailure, readPage, snapshotTab } from '../readPage';

const setBody = (html: string) => {
    document.body.innerHTML = html;
};

const read = (maxChars = PAGE_READ_CHAR_CAP, maxElements = PAGE_READ_ELEMENT_CAP) => readPage(maxChars, maxElements);

const textsOf = (snapshot: PageSnapshot) => snapshot.blocks.map(block => block.text);

/** A rendered-text stand-in: jsdom has no layout, so innerText is set per element when a test needs it */
const setInnerText = (element: Element, text: string) => {
    Object.defineProperty(element, 'innerText', { configurable: true, value: text });
};

beforeEach(() => {
    document.head.innerHTML = '';
    document.documentElement.lang = '';
    setBody('');
});

afterEach(() => {
    document.documentElement.lang = '';
});

describe('readPage: choosing the root', () => {
    it('reads the main element and ignores the rest of the page', () => {
        setBody(`
            <nav><p>Navigation text here</p></nav>
            <article><p>Article text that is not the main content.</p></article>
            <main><p>Main text here.</p></main>`);

        expect(textsOf(read())).toEqual(['Main text here.']);
    });

    it('reads [role="main"] when there is no main element', () => {
        setBody(`<div><p>Outside the role.</p></div><div role="main"><p>Role main text.</p></div>`);

        expect(textsOf(read())).toEqual(['Role main text.']);
    });

    it('falls back to the article with the most text', () => {
        setBody(`
            <article><p>Short one.</p></article>
            <article><p>The longer article has the most text in it.</p><p>And a second paragraph of it.</p></article>`);

        expect(textsOf(read())).toEqual([
            'The longer article has the most text in it.',
            'And a second paragraph of it.',
        ]);
    });

    it('falls back to the body when there is no main or article', () => {
        setBody(`<div><p>Plain body paragraph text.</p></div>`);

        expect(textsOf(read())).toEqual(['Plain body paragraph text.']);
    });
});

describe('readPage: what is skipped', () => {
    it('skips navigation, sidebars, forms, scripts, styles, svg, canvas and iframes with their subtrees', () => {
        setBody(`
            <main>
                <p>Kept paragraph one.</p>
                <aside><p>Aside text.</p></aside>
                <form><p>Form text.</p></form>
                <nav><p>Nav text.</p></nav>
                <div role="navigation"><p>Role navigation text.</p></div>
                <div role="search"><p>Search text.</p></div>
                <div role="complementary"><p>Complementary text.</p></div>
                <div role="contentinfo"><p>Contentinfo text.</p></div>
                <div role="banner"><p>Banner text.</p></div>
                <p>Visible <script>hiddenCode()</script><style>.x{}</style> words, <svg><title>icon</title></svg>
                   <canvas>canvas fallback</canvas><iframe>frame text</iframe> here.</p>
                <p>Kept paragraph two.</p>
            </main>`);

        expect(textsOf(read())).toEqual(['Kept paragraph one.', 'Visible words, here.', 'Kept paragraph two.']);
    });

    it('keeps a header or footer inside an article, and drops one outside it', () => {
        setBody(`
            <main>
                <header><p>Outer header text.</p></header>
                <article><header><h2>Inside header</h2></header><p>Article body text.</p></article>
                <footer><p>Outer footer text.</p></footer>
            </main>`);

        expect(read().blocks).toEqual([
            { kind: 'heading', level: 2, text: 'Inside header' },
            { kind: 'text', text: 'Article body text.' },
        ]);
    });

    it('drops hidden and aria-hidden content, on the element or on an ancestor', () => {
        setBody(`
            <main>
                <p hidden>Hidden attribute.</p>
                <div aria-hidden="true"><p>Hidden by an ancestor.</p></div>
                <p aria-hidden="true">Aria hidden itself.</p>
                <p>Visible text.</p>
            </main>`);

        expect(textsOf(read())).toEqual(['Visible text.']);
    });

    it('drops elements the browser reports as not visible', () => {
        setBody(`<main><p id="gone">Not shown.</p><p id="shown">Shown.</p></main>`);
        Object.defineProperty(document.getElementById('gone') as Element, 'checkVisibility', { value: () => false });
        Object.defineProperty(document.getElementById('shown') as Element, 'checkVisibility', { value: () => true });

        expect(textsOf(read())).toEqual(['Shown.']);
    });

    it('never reads field values, textarea or select content, or editable content', () => {
        setBody(`
            <main>
                <p>Label <input value="secret token"> text here</p>
                <textarea>typed draft</textarea>
                <select><option>Choice</option></select>
                <p contenteditable="true">Editable words</p>
                <p contenteditable="false">Locked words</p>
                <p>Visible words</p>
            </main>`);

        expect(textsOf(read())).toEqual(['Label text here', 'Locked words', 'Visible words']);
    });
});

describe('readPage: what is read', () => {
    it('reads a paragraph inside a list item or quote once, as the innermost block', () => {
        setBody(`
            <main>
                <ul><li><p>Nested paragraph text.</p></li></ul>
                <blockquote><p>Quoted text.</p></blockquote>
            </main>`);

        expect(read().blocks).toEqual([
            { kind: 'text', text: 'Nested paragraph text.' },
            { kind: 'text', text: 'Quoted text.' },
        ]);
    });

    it('reads headings with their level and the other text blocks as text', () => {
        setBody(`
            <main>
                <h1>Top</h1>
                <h3>Third</h3>
                <p>Body</p>
                <pre>code()</pre>
                <dl><dt>Term</dt><dd>Definition</dd></dl>
                <table><tr><td>Cell</td></tr></table>
                <figure><figcaption>Caption text</figcaption></figure>
            </main>`);

        expect(read().blocks).toEqual([
            { kind: 'heading', level: 1, text: 'Top' },
            { kind: 'heading', level: 3, text: 'Third' },
            { kind: 'text', text: 'Body' },
            { kind: 'text', text: 'code()' },
            { kind: 'text', text: 'Term' },
            { kind: 'text', text: 'Definition' },
            { kind: 'text', text: 'Cell' },
            { kind: 'text', text: 'Caption text' },
        ]);
    });

    it('collapses whitespace and skips empty blocks', () => {
        setBody(`<main><p>  Several\n\n   spaced\twords  </p><p>   </p></main>`);

        expect(read().blocks).toEqual([{ kind: 'text', text: 'Several spaced words' }]);
    });

    it('stops at the character budget and reports it', () => {
        setBody(`<main><p>aaaa</p><p>bbbbbbbbbb</p><p>cccc</p></main>`);

        const snapshot = read(12, PAGE_READ_ELEMENT_CAP);

        expect(textsOf(snapshot)).toEqual(['aaaa', 'bbbbbbbb']);
        expect(snapshot.truncated).toBe(true);
    });

    it('stops at the element budget and reports it', () => {
        setBody(`<main><p>One one.</p><p>Two two.</p><p>Three three.</p></main>`);

        expect(read(PAGE_READ_CHAR_CAP, 2)).toMatchObject({ truncated: true });
        expect(textsOf(read(PAGE_READ_CHAR_CAP, 2))).toEqual(['One one.', 'Two two.']);
        expect(read(PAGE_READ_CHAR_CAP, 5).truncated).toBe(false);
    });

    it('uses innerText when the blocks hold under 200 characters and innerText holds more', () => {
        setBody(`<main><div>Bare div line one.</div><div>Bare div line two.</div></main>`);
        setInnerText(document.querySelector('main') as Element, 'Bare div line one.\n\nBare div line two.\n');

        expect(read().blocks).toEqual([
            { kind: 'text', text: 'Bare div line one.' },
            { kind: 'text', text: 'Bare div line two.' },
        ]);
    });

    it('does not use innerText once the blocks hold 200 characters', () => {
        const long = 'This sentence is part of a long paragraph of body text. '.repeat(5);
        setBody(`<main><p>${long}</p></main>`);
        setInnerText(document.querySelector('main') as Element, 'Text from innerText only');

        expect(textsOf(read())).toEqual([long.trim()]);
    });

    it('keeps the blocks when innerText has no more text than they do', () => {
        setBody(`<main><p>Short paragraph kept.</p></main>`);
        setInnerText(document.querySelector('main') as Element, '');

        expect(textsOf(read())).toEqual(['Short paragraph kept.']);
    });

    it('reads the description from the meta tag, then from og:description, else an empty string', () => {
        document.head.innerHTML = `<meta name="description" content="  Plain   description ">`;
        expect(read().description).toBe('Plain description');

        document.head.innerHTML = `<meta property="og:description" content="Open Graph text">`;
        expect(read().description).toBe('Open Graph text');

        document.head.innerHTML = '';
        expect(read().description).toBe('');
    });

    it('reports the address, content type and language of the page', () => {
        document.documentElement.lang = 'de';
        setBody(`<main><p>Some text.</p></main>`);

        const snapshot = read();

        expect(snapshot).toMatchObject({
            href: location.href,
            contentType: document.contentType,
            lang: 'de',
            truncated: false,
        });
    });

    it('never changes the page', () => {
        setBody(`
            <nav><a href="/x">Link</a></nav>
            <main>
                <h2 hidden>Hidden heading</h2>
                <p>Visible <script>code()</script> text with <input value="typed"> a field.</p>
                <div contenteditable="true"><p>Editable paragraph text.</p></div>
                <p id="gone">Not shown.</p>
                <ul><li><p>Nested paragraph text.</p></li></ul>
            </main>
            <footer><p>Footer</p></footer>`);
        Object.defineProperty(document.getElementById('gone') as Element, 'checkVisibility', { value: () => false });
        const before = document.body.innerHTML;

        read();
        read(10, 2);

        expect(document.body.innerHTML).toBe(before);
    });

    it('runs on its own when serialized, as executeScript runs it', () => {
        setBody(`<main><p>Serialized page text here.</p></main>`);
        // executeScript sends the function's source; any outer name (an import, a helper) would throw here
        const standalone = new Function(`return ${readPage.toString()}`)() as typeof readPage;

        expect(standalone(PAGE_READ_CHAR_CAP, PAGE_READ_ELEMENT_CAP)).toEqual(read());
        expect(readPage.toString()).not.toMatch(/__vite|__name|require\(/);
    });
});

describe('isPageSnapshot', () => {
    const valid = (overrides: Partial<PageSnapshot> = {}): PageSnapshot => ({
        href: 'https://a.dev/page',
        contentType: 'text/html',
        lang: 'en',
        description: '',
        blocks: [
            { kind: 'heading', level: 2, text: 'Heading' },
            { kind: 'text', text: 'Body' },
        ],
        truncated: false,
        ...overrides,
    });

    it('accepts a well-formed snapshot', () => {
        expect(isPageSnapshot(valid())).toBe(true);
    });

    it.each<[string, unknown]>([
        ['not an object', 'page'],
        ['null', null],
        ['a href that is not a string', valid({ href: 3 as unknown as string })],
        ['a href over the URL cap', valid({ href: `https://a.dev/${'x'.repeat(8200)}` })],
        ['a description over the cap', valid({ description: 'x'.repeat(1001) })],
        ['a lang over the field cap', valid({ lang: 'x'.repeat(201) })],
        ['truncated that is not a boolean', { ...valid(), truncated: 'no' }],
        ['blocks that are not an array', { ...valid(), blocks: 'text' }],
        [
            'too many blocks',
            valid({ blocks: Array.from({ length: 5001 }, () => ({ kind: 'text', text: 'x' })) as never }),
        ],
        ['an unknown block kind', valid({ blocks: [{ kind: 'image', text: 'x' }] as never })],
        ['a heading with level 0', valid({ blocks: [{ kind: 'heading', level: 0, text: 'x' }] as never })],
        ['a heading with level 7', valid({ blocks: [{ kind: 'heading', level: 7, text: 'x' }] as never })],
        ['a heading without a level', valid({ blocks: [{ kind: 'heading', text: 'x' }] as never })],
        ['block text that is not a string', valid({ blocks: [{ kind: 'text', text: 1 }] as never })],
        [
            'more text than the character cap',
            valid({ blocks: [{ kind: 'text', text: 'x'.repeat(PAGE_READ_CHAR_CAP + 1) }] }),
        ],
    ])('rejects %s', (_name, value) => {
        expect(isPageSnapshot(value)).toBe(false);
    });
});

describe('snapshotTab', () => {
    let mock: ChromeMock;
    const tab: ReadableTab = {
        id: 7,
        windowId: 1,
        title: 'Page',
        url: 'https://a.dev/page',
        originPattern: 'https://a.dev/*',
        readable: true,
    };
    const snapshot = (overrides: Partial<PageSnapshot> = {}): PageSnapshot => ({
        href: 'https://a.dev/page',
        contentType: 'text/html',
        lang: 'en',
        description: '',
        blocks: [{ kind: 'text', text: 'Hello there' }],
        truncated: false,
        ...overrides,
    });

    beforeEach(() => {
        mock = installChromeMock();
        mock.browser.addTab({ id: tab.id, url: tab.url });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('runs readPage in the top frame of the tab with the caps as arguments', async () => {
        mock.browser.setScriptResult(snapshot());

        await snapshotTab(tab);

        expect(fakeChrome().scripting.executeScript).toHaveBeenCalledWith({
            target: { tabId: 7, allFrames: false },
            func: readPage,
            args: [PAGE_READ_CHAR_CAP, PAGE_READ_ELEMENT_CAP],
        });
    });

    it('returns the snapshot when its address is the picked page, ignoring the fragment', async () => {
        const result = snapshot({ href: 'https://a.dev/page#section' });
        mock.browser.setScriptResult(result);

        expect(await snapshotTab(tab)).toEqual(result);
    });

    it.each<[string, PageReadFailure['code']]>([
        [
            'Cannot access contents of url "https://a.dev/page". Extension manifest must request permission.',
            'no-access',
        ],
        ['Cannot access a chrome:// URL', 'no-access'],
        ['No tab with id: 7.', 'closed'],
        ['This page cannot be scripted due to an ExtensionsSettings policy.', 'blocked'],
        ['Something unexpected happened', 'failed'],
    ])('maps the rejection "%s" to %s', async (message, code) => {
        mock.browser.setScriptError(message);

        await expect(snapshotTab(tab)).rejects.toMatchObject({ code });
    });

    it('fails with "changed" when the tab now shows another page', async () => {
        mock.browser.setScriptResult(snapshot({ href: 'https://a.dev/other' }));

        await expect(snapshotTab(tab)).rejects.toMatchObject({ code: 'changed' });
    });

    it('fails with "pdf" for a PDF viewer', async () => {
        mock.browser.setScriptResult(snapshot({ contentType: 'application/pdf' }));

        await expect(snapshotTab(tab)).rejects.toMatchObject({ code: 'pdf' });
    });

    it('fails with "failed" for an empty result or one of the wrong shape', async () => {
        fakeChrome().scripting.executeScript.mockResolvedValueOnce([]);
        await expect(snapshotTab(tab)).rejects.toMatchObject({ code: 'failed' });

        mock.browser.setScriptResult({ href: 'https://a.dev/page' });
        await expect(snapshotTab(tab)).rejects.toMatchObject({ code: 'failed' });
    });

    it('fails with "timeout" when the page does not answer in time', async () => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
        fakeChrome().scripting.executeScript.mockImplementationOnce(() => new Promise<never>(() => undefined));

        const pending = snapshotTab(tab);
        const assertion = expect(pending).rejects.toMatchObject({
            code: 'timeout',
            message: PAGE_READ_TIMEOUT_MESSAGE,
        });
        await vi.advanceTimersByTimeAsync(PAGE_READ_TIMEOUT_MS - 1);
        // Still waiting one tick before the limit: a slow tab gets the whole time
        expect(vi.getTimerCount()).toBeGreaterThan(0);
        await vi.advanceTimersByTimeAsync(1);

        await assertion;
    });

    it('fails with "asleep" without waiting when the tab is frozen or discarded', async () => {
        for (const state of [{ frozen: true }, { discarded: true }]) {
            mock.browser.addTab({ url: 'https://a.dev/page' });
            fakeChrome().tabs.get.mockResolvedValueOnce({ id: tab.id, url: tab.url, ...state } as never);
            fakeChrome().scripting.executeScript.mockClear();

            await expect(snapshotTab(tab)).rejects.toMatchObject({ code: 'asleep', message: PAGE_ASLEEP_MESSAGE });
            expect(fakeChrome().scripting.executeScript).not.toHaveBeenCalled();
        }
    });

    it('says "asleep" instead of "timeout" when the tab fell asleep while it was being read', async () => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
        fakeChrome().tabs.get.mockResolvedValueOnce({ id: tab.id, url: tab.url, frozen: false } as never);
        fakeChrome().scripting.executeScript.mockImplementationOnce(() => new Promise<never>(() => undefined));

        const assertion = expect(snapshotTab(tab)).rejects.toMatchObject({ code: 'asleep' });
        fakeChrome().tabs.get.mockResolvedValueOnce({ id: tab.id, url: tab.url, frozen: true } as never);
        await vi.advanceTimersByTimeAsync(PAGE_READ_TIMEOUT_MS);

        await assertion;
    });

    it('rejects with an AbortError when cancelled before it starts', async () => {
        const controller = new AbortController();
        controller.abort();

        await expect(snapshotTab(tab, controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
        expect(fakeChrome().scripting.executeScript).not.toHaveBeenCalled();
    });

    it('rejects with an AbortError when cancelled while the page is being read', async () => {
        const controller = new AbortController();
        fakeChrome().scripting.executeScript.mockImplementationOnce(() => new Promise<never>(() => undefined));

        const pending = snapshotTab(tab, controller.signal);
        const assertion = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
        controller.abort();

        await assertion;
    });
});

describe('readPage: further cases', () => {
    it('keeps the first article when a later one has no more text', () => {
        setBody(`
            <article><p>The first article has the most text in it.</p></article>
            <article><p>Shorter one.</p></article>
            <article></article>`);

        expect(textsOf(read())).toEqual(['The first article has the most text in it.']);
    });

    it('reads the text of inline elements inside a block', () => {
        setBody(`<main><p>Some <b>bold</b> and <a href="/x">linked <i>italic</i></a> words.</p></main>`);

        expect(textsOf(read())).toEqual(['Some bold and linked italic words.']);
    });

    it('stops reading innerText lines once the character budget is used up', () => {
        setBody(`<main><div>Bare div line one.</div></main>`);
        setInnerText(document.querySelector('main') as Element, 'Exactly10!\nThis line gets no budget');

        const snapshot = read(10);

        expect(textsOf(snapshot)).toEqual(['Exactly10!']);
        expect(snapshot.truncated).toBe(true);
    });
});

describe('isPageSnapshot: blocks that are not objects', () => {
    it.each([null, 'text', 5])('rejects a block that is %s', block => {
        expect(
            isPageSnapshot({
                href: 'https://a.dev/page',
                contentType: 'text/html',
                lang: 'en',
                description: '',
                blocks: [block],
                truncated: false,
            })
        ).toBe(false);
    });
});

describe('snapshotTab: rejections that are not Error objects', () => {
    it('maps a plain string rejection by its text', async () => {
        const mock = installChromeMock();
        mock.browser.addTab({ id: 7, url: 'https://a.dev/page' });
        fakeChrome().scripting.executeScript.mockRejectedValueOnce('This page is blocked by policy');
        const tab: ReadableTab = {
            id: 7,
            windowId: 1,
            title: 'Page',
            url: 'https://a.dev/page',
            originPattern: 'https://a.dev/*',
            readable: true,
        };

        await expect(snapshotTab(tab)).rejects.toMatchObject({ code: 'blocked' });
    });
});
