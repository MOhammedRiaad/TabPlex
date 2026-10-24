import { describe, expect, it } from 'vitest';
import { PAGE_TEXT_CHAR_LIMIT, PARAGRAPH_MAX_CHARS } from '../../constants';
import { PageBlock, PageSnapshot } from '../../types';
import { PageReadFailure } from '../readPage';
import { cleanPage, readsAsEnglish } from '../pageText';

const snapshot = (blocks: PageBlock[], overrides: Partial<PageSnapshot> = {}): PageSnapshot => ({
    href: 'https://a.dev/page',
    contentType: 'text/html',
    lang: 'en',
    description: '',
    blocks,
    truncated: false,
    ...overrides,
});

const para = (text: string): PageBlock => ({ kind: 'text', text });
const heading = (level: number, text: string): PageBlock => ({ kind: 'heading', level, text });

/** Enough text to pass MIN_PAGE_CHARS */
const SENTENCE = 'This sentence adds real content to the page about the subject being studied. ';
const enough = () => para(SENTENCE.repeat(4).trim());

const cleanFailure = (page: PageSnapshot, title = 'Page') => {
    try {
        cleanPage(page, title);
    } catch (error) {
        return error;
    }
    return undefined;
};

describe('cleanPage: cleaning blocks', () => {
    it('collapses whitespace in every block', () => {
        const page = cleanPage(snapshot([para('  Spread \n\n  across   lines of text here.  '), enough()]), 'Page');

        expect(page.sections[0].paragraphs[0]).toBe('Spread across lines of text here.');
    });

    it('drops text blocks under 20 characters but keeps short headings', () => {
        const page = cleanPage(snapshot([heading(2, 'Intro'), para('Share'), para('Menu item'), enough()]), 'Page');

        expect(page.sections).toEqual([
            { heading: 'Intro', paragraphs: [expect.stringContaining('This sentence adds')] },
        ]);
        expect(page.sections[0].paragraphs).toHaveLength(1);
    });

    it('drops repeated text blocks, ignoring case', () => {
        const repeated = 'A paragraph that appears twice on the page, once in the header area.';
        const page = cleanPage(snapshot([para(repeated), para(repeated.toUpperCase()), enough()]), 'Page');

        expect(page.sections[0].paragraphs).toEqual([repeated, expect.any(String)]);
        expect(page.sections[0].paragraphs.filter(p => p.toLowerCase() === repeated.toLowerCase())).toHaveLength(1);
    });

    it('drops short cookie, consent, newsletter and sign-in boilerplate', () => {
        const page = cleanPage(
            snapshot([
                para('We use cookies to improve your experience.'),
                para('Subscribe to our newsletter for weekly updates!'),
                para('Sign in to continue reading this article.'),
                enough(),
            ]),
            'Page'
        );

        expect(page.sections[0].paragraphs).toEqual([expect.stringContaining('This sentence adds')]);
    });

    it('keeps a long paragraph that only mentions a boilerplate phrase', () => {
        const long = `The cookie policy of a website is a document worth reading carefully. ${SENTENCE.repeat(4)}`;
        const page = cleanPage(snapshot([para(long), enough()]), 'Page');

        expect(page.sections[0].paragraphs[0]).toBe(long.trim());
    });

    it('drops sections that have no paragraphs', () => {
        const page = cleanPage(snapshot([heading(2, 'Empty section'), heading(2, 'Full section'), enough()]), 'Page');

        expect(page.sections.map(s => s.heading)).toEqual(['Full section']);
    });
});

describe('cleanPage: sections and titles', () => {
    it('starts a section at each h2 and h3, and keeps text before the first one with an empty heading', () => {
        const page = cleanPage(
            snapshot([
                enough(),
                heading(2, 'Second'),
                para('Under the second heading there is a paragraph of text.'),
                heading(3, 'Third'),
                para('Under the third heading there is another paragraph of text.'),
            ]),
            'Page'
        );

        expect(page.sections.map(s => s.heading)).toEqual(['', 'Second', 'Third']);
        expect(page.sections[1].paragraphs).toEqual(['Under the second heading there is a paragraph of text.']);
    });

    it('drops an h1 equal to the tab title, ignoring case and spacing, and starts a section at any other h1', () => {
        const page = cleanPage(
            snapshot([
                heading(1, '  my   TITLE '),
                enough(),
                heading(1, 'Another top heading'),
                para('A paragraph of text under another heading.'),
            ]),
            'My title'
        );

        expect(page.sections.map(s => s.heading)).toEqual(['', 'Another top heading']);
        expect(page.sections[0].paragraphs).toHaveLength(1);
    });

    it('reads h4 to h6 as paragraphs rather than section starts', () => {
        const page = cleanPage(snapshot([enough(), heading(4, 'A small heading of this page')]), 'Page');

        expect(page.sections).toHaveLength(1);
        expect(page.sections[0].paragraphs).toContain('A small heading of this page');
    });
});

describe('cleanPage: long text', () => {
    it('splits a paragraph over the limit at sentence ends and keeps every sentence', () => {
        const sentences = Array.from({ length: 60 }, (_, i) => `Sentence number ${i} is short and clear.`);
        const page = cleanPage(snapshot([para(sentences.join(' ')), enough()]), 'Page');

        const parts = page.sections[0].paragraphs.slice(0, -1);
        expect(parts.length).toBeGreaterThan(1);
        expect(parts.every(part => part.length <= PARAGRAPH_MAX_CHARS)).toBe(true);
        expect(parts.join(' ')).toBe(sentences.join(' '));
    });

    it('cuts a single sentence longer than the limit into pieces', () => {
        const page = cleanPage(snapshot([para('x'.repeat(PARAGRAPH_MAX_CHARS + 500)), enough()]), 'Page');

        expect(page.sections[0].paragraphs[0]).toHaveLength(PARAGRAPH_MAX_CHARS);
        expect(page.sections[0].paragraphs[1]).toHaveLength(500);
    });

    it('keeps at most the character limit, cutting at a word boundary, and reports truncation', () => {
        const blocks = Array.from({ length: 10 }, (_, i) => para(`${i} ${'word '.repeat(300)}`.trim()));
        const page = cleanPage(snapshot(blocks), 'Page');

        expect(page.chars).toBeLessThanOrEqual(PAGE_TEXT_CHAR_LIMIT);
        expect(page.chars).toBeGreaterThan(PAGE_TEXT_CHAR_LIMIT - 10);
        expect(page.sections[0].paragraphs.join('')).toHaveLength(page.chars);
        const last = page.sections[0].paragraphs[page.sections[0].paragraphs.length - 1];
        expect(last.endsWith('word')).toBe(true);
        expect(page.truncated).toBe(true);
    });

    it('is truncated when the snapshot already was', () => {
        expect(cleanPage(snapshot([enough()], { truncated: true }), 'Page').truncated).toBe(true);
        expect(cleanPage(snapshot([enough()]), 'Page').truncated).toBe(false);
    });

    it('fails with "empty" when less than the minimum text is left', () => {
        const error = cleanFailure(snapshot([para('Just a little text here.')]));

        expect(error).toBeInstanceOf(PageReadFailure);
        expect((error as PageReadFailure).code).toBe('empty');
    });
});

describe('cleanPage: description, language and totals', () => {
    it('collapses the description and reports the characters kept', () => {
        const page = cleanPage(snapshot([enough()], { description: '  A  short   summary ' }), 'Page');

        expect(page.description).toBe('A short summary');
        expect(page.chars).toBe(page.sections[0].paragraphs.join('').length);
    });

    it.each([
        ['de', true],
        ['fr-CA', true],
        ['en-GB', false],
        ['EN', false],
        ['', false],
    ])('sets notEnglish for lang "%s" to %s', (lang, notEnglish) => {
        expect(cleanPage(snapshot([enough()], { lang }), 'Page').notEnglish).toBe(notEnglish);
    });
});

const PORTUGUESE =
    'Objetos JavaScript são coleções de propriedades que podem ser acessadas usando pares de valor e chave. ' +
    'A palavra chave new é usada para criar objetos através de funções construtor, e cada objeto possui um ' +
    'protótipo que serve para herdar propriedades e métodos de outros objetos. As classes em JavaScript, ' +
    'introduzidas no ES6, são açúcar sintático sobre a herança baseada em protótipos, oferecendo uma maneira ' +
    'mais estruturada de definir objetos e de reutilizar o código em um projeto grande.';
const ENGLISH =
    'Objects in JavaScript are collections of properties that can be read with key and value pairs. The new ' +
    'keyword is used to create an object with a constructor function, and each object has a prototype that is ' +
    'used to inherit properties and methods from other objects. Classes in JavaScript, which were introduced in ' +
    'ES6, are syntactic sugar over prototype based inheritance and give a more structured way to define objects.';

describe('cleanPage: language from the text', () => {
    it('calls a Portuguese page not English even when its lang attribute says "en"', () => {
        expect(cleanPage(snapshot([para(PORTUGUESE)], { lang: 'en' }), 'Page').notEnglish).toBe(true);
        expect(cleanPage(snapshot([para(PORTUGUESE)], { lang: '' }), 'Page').notEnglish).toBe(true);
    });

    it('keeps an English page English', () => {
        expect(cleanPage(snapshot([para(ENGLISH)], { lang: 'en' }), 'Page').notEnglish).toBe(false);
    });

    it('only judges samples long enough to tell, and text without sentences counts as English', () => {
        expect(readsAsEnglish('Objetos são coleções de propriedades')).toBe(true);
        expect(readsAsEnglish('')).toBe(true);
        expect(readsAsEnglish('const x = 1; let y = x * 2; return y; '.repeat(30))).toBe(false);
    });
});
