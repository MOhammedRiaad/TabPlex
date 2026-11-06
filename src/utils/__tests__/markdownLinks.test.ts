import { describe, expect, it } from 'vitest';
import { MARKDOWN_MAX_CHARS, transformKeepingLinks, escapeHtml } from '../markdown';
import { parseMarkdown } from '../../features/ui/components/MarkdownEditor';
import { parseMarkdownToHtml } from '../../features/notes/components/NoteCard';

const MARK = String.fromCharCode(0xe000);

/** Renders with both renderers and returns the parsed DOM of each */
const render = (markdown: string) =>
    [parseMarkdown, parseMarkdownToHtml].map(parse => {
        const root = document.createElement('div');
        root.innerHTML = parse(markdown);
        return root;
    });

const ALLOWED_ATTRIBUTES: Record<string, string[]> = { A: ['href', 'target', 'rel'], CODE: ['class'], DIV: ['class'] };

function expectOnlyAllowedMarkup(root: Element) {
    for (const element of Array.from(root.querySelectorAll('*'))) {
        for (const attribute of Array.from(element.attributes)) {
            expect(ALLOWED_ATTRIBUTES[element.tagName] ?? []).toContain(attribute.name);
        }
        expect(['SCRIPT', 'IMG', 'IFRAME', 'STYLE']).not.toContain(element.tagName);
    }
}

describe('markdown links', () => {
    it('keeps a link whole when the text around it has emphasis, code or checkbox syntax', () => {
        for (const root of render('see [docs](https://e.com/a_b_c/*x*/~~y~~) now')) {
            const link = root.querySelector('a');
            expect(link?.getAttribute('href')).toBe('https://e.com/a_b_c/*x*/~~y~~');
            expect(link?.textContent).toBe('docs');
            expect(root.querySelectorAll('a')).toHaveLength(1);
        }
    });

    it('cannot be given extra attributes through a checkbox line inside the address', () => {
        for (const root of render('[x](https://e.com/\n[x] foo)')) {
            expectOnlyAllowedMarkup(root);
            expect(root.querySelector('a')).toBeNull();
        }
    });

    it('cannot be given extra attributes through a code block inside the address', () => {
        for (const root of render('[x](https://e.com/```a\n b```)')) {
            expectOnlyAllowedMarkup(root);
            for (const link of Array.from(root.querySelectorAll('a'))) {
                expect(link.getAttribute('href')).not.toContain('<');
            }
        }
    });

    it('turns scripting and data addresses into plain text', () => {
        for (const root of render('[a](javascript:alert(1)) [b](data:text/html,x) [c](JaVaScRiPt:1)')) {
            expect(root.querySelector('a')).toBeNull();
        }
    });

    it('stays inside the allowed markup for hostile mixes of quotes, brackets, backticks and markers', () => {
        const pieces = [
            '"',
            "'",
            '[',
            ']',
            '(',
            ')',
            '`',
            '```',
            '\n',
            '_',
            '*',
            '~~',
            '[x] ',
            '- ',
            '> ',
            '<b>',
            'https://e.com/',
            MARK,
        ];
        let seed = 7;
        const next = () => (seed = (seed * 1103515245 + 12345) % 2147483648);
        for (let run = 0; run < 300; run++) {
            let text = '';
            for (let i = 0; i < 25; i++) text += pieces[next() % pieces.length];
            for (const root of render(text)) {
                expectOnlyAllowedMarkup(root);
                for (const link of Array.from(root.querySelectorAll('a'))) {
                    expect(link.getAttribute('href')).toMatch(/^(https?:|mailto:)/i);
                }
            }
        }
    });

    it('drops stray link markers from the text and cuts very long text', () => {
        expect(transformKeepingLinks(escapeHtml(`a${MARK}5${MARK}b`), text => text)).toBe('a5b');
        expect(transformKeepingLinks('x'.repeat(MARKDOWN_MAX_CHARS + 50), text => text)).toHaveLength(
            MARKDOWN_MAX_CHARS
        );
    });
});
