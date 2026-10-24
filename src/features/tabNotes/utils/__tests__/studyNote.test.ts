import { describe, expect, it } from 'vitest';
import { parseMarkdownToHtml } from '../../../notes/components/NoteCard';
import { parseMarkdown } from '../../../ui/components/MarkdownEditor';
import { KeyPoint, NoteSource, StudyNoteDraft } from '../../types';
import { buildStudyNote, defaultStudyNoteTitle, hostOf, linkUrl, safeInline } from '../studyNote';

const DATE = new Date(2026, 9, 24);

const source = (ref: number, overrides: Partial<NoteSource> = {}): NoteSource => ({
    ref,
    tabId: ref * 10,
    windowId: 1,
    title: `Page ${ref}`,
    url: `https://example.com/p${ref}`,
    mode: 'ai',
    truncated: false,
    notEnglish: false,
    ...overrides,
});

const point = (sourceRef: number, text: string, index = 1): KeyPoint => ({
    id: `p${sourceRef}-${index}`,
    sourceRef,
    text,
    topicHint: '',
});

const draftOf = (sources: NoteSource[], points: KeyPoint[]): StudyNoteDraft => ({ view: 'byTab', sources, points });

/** Parses Markdown the way the note is shown, into a detached element */
function render(markdown: string, parse: (text: string) => string): HTMLElement {
    const root = document.createElement('div');
    root.innerHTML = parse(markdown);
    return root;
}

const RENDERERS: [string, (text: string) => string][] = [
    ['MarkdownEditor preview', parseMarkdown],
    ['NoteCard', parseMarkdownToHtml],
];

describe('safeInline', () => {
    it('keeps the label of link syntax and drops the URL', () => {
        expect(safeInline('see [docs](https://evil.example) now')).toBe('see docs now');
        expect(safeInline('[x](https://evil.example)')).toBe('x');
        expect(safeInline('a [b][c] d')).toBe('a b d');
    });

    it('turns remaining brackets into parentheses so no link or checkbox can form', () => {
        expect(safeInline('a [b] c')).toBe('a (b) c');
        expect(safeInline('[x] done')).toBe('(x) done');
    });

    it.each([
        ['# Heading', 'Heading'],
        ['### Deep', 'Deep'],
        ['> quoted', 'quoted'],
        ['- item', 'item'],
        ['* item', 'item'],
        ['+ item', 'item'],
        ['1. step', 'step'],
        ['2) step', 'step'],
        ['---', ''],
        ['# - > mixed', 'mixed'],
    ])('removes the leading block marker of %j', (input, expected) => {
        expect(safeInline(input)).toBe(expected);
    });

    it('keeps numbers, hashtags and emphasis that are not block markers', () => {
        expect(safeInline('-5 degrees')).toBe('-5 degrees');
        expect(safeInline('1.5 seconds')).toBe('1.5 seconds');
        expect(safeInline('#1 rule')).toBe('#1 rule');
        expect(safeInline('*emphasis* text')).toBe('*emphasis* text');
    });

    it('turns line breaks into spaces and only cuts block markers at the start', () => {
        expect(safeInline('line one\r\nline two\n# three')).toBe('line one line two # three');
    });
});

describe('linkUrl', () => {
    it('percent-encodes the characters both renderers read as Markdown', () => {
        expect(linkUrl('https://en.wikipedia.org/wiki/Domain_Name_(system)')).toBe(
            'https://en.wikipedia.org/wiki/Domain%5FName%5F%28system%29'
        );
        expect(linkUrl('https://blog.example.org/dns_cache')).toBe('https://blog.example.org/dns%5Fcache');
        expect(linkUrl('https://x.org/a*b~c`d[e]f g')).toBe('https://x.org/a%2Ab%7Ec%60d%5Be%5Df%20g');
    });

    it('leaves the host alone and drops credentials', () => {
        expect(linkUrl('https://my_host.corp:8443/a_b')).toBe('https://my_host.corp:8443/a%5Fb');
        expect(linkUrl('https://user:secret@a.example/x')).toBe('https://a.example/x');
    });

    it('keeps the query and the fragment', () => {
        expect(linkUrl('https://a.example/x?q=1&r=2#top')).toBe('https://a.example/x?q=1&r=2#top');
    });

    it.each([
        'javascript:alert(1)',
        'data:text/html,hi',
        'file:///C:/notes.txt',
        'chrome://settings',
        'mailto:someone@example.com',
        'ftp://files.example/readme',
        'not a url',
    ])('gives no link for %j', url => {
        expect(linkUrl(url)).toBeNull();
    });
});

describe('hostOf', () => {
    it('returns the host without the port or path', () => {
        expect(hostOf('https://developer.mozilla.org:443/en-US/docs')).toBe('developer.mozilla.org');
        expect(hostOf('not a url')).toBe('');
    });
});

describe('buildStudyNote (By tab)', () => {
    it('writes the title, the disclaimer, one section per source and the Sources list', () => {
        const sources = [
            source(1, { title: 'How DNS works', url: 'https://example.com/dns' }),
            source(2, { title: 'DNS cache explained', url: 'https://blog.example.org/dns_cache', mode: 'quick' }),
        ];
        const points = [
            point(1, 'Resolvers keep each answer until its TTL runs out.'),
            point(1, 'Negative answers are cached too.', 2),
            point(2, 'Caches expire entries after the TTL.'),
        ];
        expect(buildStudyNote(draftOf(sources, points), { date: DATE })).toBe(
            [
                '# Study notes · 24 Oct 2026',
                "_From 2 tabs, summarized by your browser's built-in AI on this device. It can be wrong: check the sources before relying on it._",
                '## How DNS works ([1](https://example.com/dns))\n\n- Resolvers keep each answer until its TTL runs out.\n- Negative answers are cached too.',
                '## DNS cache explained ([2](https://blog.example.org/dns%5Fcache))\n\n- Caches expire entries after the TTL.',
                '## Sources\n\n- [1] [How DNS works](https://example.com/dns) · example.com\n- [2] [DNS cache explained](https://blog.example.org/dns%5Fcache) · blog.example.org · quick view',
            ].join('\n\n')
        );
    });

    it('uses the default title, or the user title made safe', () => {
        expect(defaultStudyNoteTitle(DATE)).toBe('Study notes · 24 Oct 2026');
        expect(buildStudyNote(draftOf([], []), { date: DATE }).split('\n')[0]).toBe('# Study notes · 24 Oct 2026');
        expect(buildStudyNote(draftOf([], []), { date: DATE, title: 'Exam prep' }).split('\n')[0]).toBe('# Exam prep');
        expect(buildStudyNote(draftOf([], []), { date: DATE, title: '# [x](https://evil.example)' })).toMatch(/^# x\n/);
    });

    it('uses the quick-view disclaimer when no source used the model', () => {
        const note = buildStudyNote(draftOf([source(1, { mode: 'quick' })], []), { date: DATE });
        expect(note.split('\n')[2]).toBe(
            '_Quick view of 1 tab: sentences taken from the pages, without AI. Check the sources for the full picture._'
        );
    });

    it('writes sources in ref order and leaves out points of a source that is not in the draft', () => {
        const note = buildStudyNote(
            draftOf(
                [source(2, { title: 'Second' }), source(1, { title: 'First' })],
                [
                    point(1, 'Point of the first page.'),
                    point(2, 'Point of the second page.'),
                    point(3, 'Point of a removed page.'),
                ]
            ),
            { date: DATE }
        );
        expect(note.indexOf('## First')).toBeLessThan(note.indexOf('## Second'));
        expect(note).not.toContain('removed page');
    });

    it('labels quick, long and non-English sources in the Sources list', () => {
        const note = buildStudyNote(
            draftOf([source(1, { mode: 'quick', truncated: true, notEnglish: true })], [point(1, 'A point.')]),
            { date: DATE }
        );
        expect(note.split('\n').pop()).toBe(
            '- [1] [Page 1](https://example.com/p1) · example.com · quick view · first part of a long page · Not in English: points may be weaker'
        );
    });

    it('writes a source without a web URL as plain text, with no link', () => {
        const note = buildStudyNote(
            draftOf([source(1, { title: 'Files', url: 'ftp://files.example/readme' })], [point(1, 'A point.')]),
            { date: DATE }
        );
        expect(note).toContain('\n## Files\n');
        expect(note.split('\n').pop()).toBe('- [1] Files · files.example');
    });

    it('names a source without a title by its host, or "Untitled page" when it has no host either', () => {
        const named = buildStudyNote(
            draftOf([source(1, { title: '  ', url: 'https://example.com/p1' })], [point(1, 'A point.')]),
            { date: DATE }
        );
        expect(named).toContain('## example.com ([1](https://example.com/p1))');

        const unnamed = buildStudyNote(draftOf([source(1, { title: '', url: 'not a url' })], [point(1, 'A point.')]), {
            date: DATE,
        });
        expect(unnamed).toContain('## Untitled page\n');
        expect(unnamed.split('\n').pop()).toBe('- [1] Untitled page');
    });

    it('says when a page gave no points, and drops points that are empty after cleaning', () => {
        const note = buildStudyNote(draftOf([source(1), source(2)], [point(2, '---')]), { date: DATE });
        expect(note).toContain('_No key points could be taken from this page._');
        expect(note.match(/No key points/g)).toHaveLength(2);
        expect(note).not.toContain('- ---');
    });

    it('omits the Sources list when nothing was read', () => {
        expect(buildStudyNote(draftOf([], []), { date: DATE })).not.toContain('## Sources');
    });

    it('treats page and model text as text: no headings, links or lists from it', () => {
        const note = buildStudyNote(
            draftOf(
                [source(1, { title: '[x](https://evil.example)' })],
                [point(1, '# Not a heading'), point(1, '- [a](https://evil.example) bullet', 2), point(1, '> quote', 3)]
            ),
            { date: DATE }
        );
        expect(note).toContain('- Not a heading');
        expect(note).toContain('- a bullet');
        expect(note).toContain('- quote');
        expect(note).toContain('## x ([1](https://example.com/p1))');
        expect(note).not.toContain('evil.example');
    });
});

describe('buildStudyNote through both Markdown renderers', () => {
    const hostile = draftOf(
        [
            source(1, {
                title: '[x](https://evil.example) # Heading _under_',
                url: 'https://example.com/a_(b)',
            }),
            source(2, { title: 'Plain *title*', url: 'https://example.com/c~d*e', mode: 'quick' }),
        ],
        [
            point(1, '# Injected heading with <img src=x onerror=alert(1)> text'),
            point(1, '> quoted [link](https://evil.example) here', 2),
            point(1, '- bullet item with TTL 300 seconds', 3),
            point(1, '1. ordered item', 4),
            point(1, 'Text with <script>alert(1)</script> inside', 5),
            point(2, 'Plain sentence with a `code` span.'),
        ]
    );
    const hrefs = [linkUrl('https://example.com/a_(b)'), linkUrl('https://example.com/c~d*e')];

    it.each(RENDERERS)('gives exactly one <a> per written link (%s)', (_name, parse) => {
        const root = render(buildStudyNote(hostile, { date: DATE }), parse);
        const anchors = Array.from(root.querySelectorAll('a'));
        // Each source is linked twice: in its heading and in the Sources list
        expect(anchors.map(anchor => anchor.getAttribute('href')).sort()).toEqual(
            [hrefs[0], hrefs[0], hrefs[1], hrefs[1]].sort()
        );
        expect(anchors.every(anchor => !anchor.getAttribute('href')?.includes('evil.example'))).toBe(true);
    });

    it.each(RENDERERS)('renders page text as text, with no markup from it (%s)', (_name, parse) => {
        const root = render(buildStudyNote(hostile, { date: DATE }), parse);
        expect(root.querySelector('img, script')).toBeNull();
        expect(root.textContent).toContain('<img src=x onerror=alert(1)> text');
        expect(root.textContent).toContain('<script>alert(1)</script> inside');
        expect(root.textContent).toContain('bullet item with TTL 300 seconds');
    });

    it.each(RENDERERS)('keeps a quote and a heading mark in a title as text (%s)', (_name, parse) => {
        const root = render(buildStudyNote(hostile, { date: DATE }), parse);
        expect(root.querySelector('blockquote')).toBeNull();
        expect(root.textContent).toContain('quoted link here');
        expect(root.textContent).toContain('x # Heading under');
    });
});
