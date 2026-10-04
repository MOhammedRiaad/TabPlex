import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import NotesView from '../NotesView';
import MarkdownEditor, { parseMarkdown } from '../../ui/components/MarkdownEditor';
import { escapeHtml, renderMarkdownLinks } from '../../../utils/markdown';
import { useBoardStore } from '../../../store/boardStore';
import { makeNote } from '../../../test/factories';

const state = () => useBoardStore.getState();

describe('markdown rendering', () => {
    it('escapes HTML, including quotes', () => {
        expect(escapeHtml('<b a="1">&</b>')).toBe('&lt;b a=&quot;1&quot;&gt;&amp;&lt;/b&gt;');
    });

    it('only links web and mail URLs', () => {
        expect(renderMarkdownLinks('[a](https://x.dev)')).toBe(
            '<a href="https://x.dev" target="_blank" rel="noopener noreferrer">a</a>'
        );
        expect(renderMarkdownLinks('[m](mailto:a@b.c)')).toContain('href="mailto:a@b.c"');
        expect(renderMarkdownLinks('[bad](javascript:alert(1))')).toBe('bad)');
        expect(renderMarkdownLinks('[d](data:text/html,x)')).toBe('d');
    });

    it('renders the supported syntax and blocks attribute injection', () => {
        const html = parseMarkdown(
            [
                '# H1',
                '## H2',
                '### H3',
                '***both*** **bold** *it* ___b2___ __b3__ _i2_ ~~gone~~ `code`',
                '```js\nconst a = 1;\n```',
                '- one',
                '- two',
                '1. first',
                '> quote',
                '> more',
                '---',
                '[x] done',
                '[ ] todo',
                '[link](https://ok.dev)',
                '[evil](x" onmouseover="alert(1))',
            ].join('\n')
        );
        for (const fragment of [
            '<h1>H1</h1>',
            '<h2>H2</h2>',
            '<h3>H3</h3>',
            '<strong><em>both</em></strong>',
            '<del>gone</del>',
            '<code>code</code>',
            'language-js',
            '<ul>',
            '<blockquote>quote<br />more</blockquote>',
            '<hr />',
            'href="https://ok.dev"',
        ]) {
            expect(html).toContain(fragment);
        }
        expect(html).not.toContain('onmouseover="');
    });
});

describe('MarkdownEditor', () => {
    function Harness({ initial = 'hello' }: { initial?: string }) {
        const [value, setValue] = React.useState(initial);
        return <MarkdownEditor value={value} onChange={setValue} autoFocus />;
    }
    const textarea = () => screen.getByRole('textbox') as HTMLTextAreaElement;

    it('wraps the selection with toolbar buttons and shortcuts', () => {
        vi.useFakeTimers();
        render(<Harness />);
        const titles = [
            'Bold (Ctrl+B)',
            'Italic (Ctrl+I)',
            'Strikethrough',
            'Heading 1',
            'Heading 2',
            'Heading 3',
            'Bullet List',
            'Numbered List',
            'Checkbox',
            'Inline Code',
            'Code Block',
            'Link',
            'Quote',
        ];
        for (const title of titles) {
            textarea().setSelectionRange(0, 0);
            fireEvent.click(screen.getByTitle(title));
            act(() => vi.advanceTimersByTime(0));
        }
        const hr = screen.queryByTitle('Horizontal Rule');
        if (hr) fireEvent.click(hr);
        fireEvent.keyDown(textarea(), { key: 'Tab' });
        fireEvent.keyDown(textarea(), { key: 'b', ctrlKey: true });
        fireEvent.keyDown(textarea(), { key: 'i', metaKey: true });
        fireEvent.keyDown(textarea(), { key: 'x' });
        const value = textarea().value;
        for (const token of ['**', '~~', '# ', '## ', '### ', '- ', '1. ', '[ ] ', '`', '```', '](url)', '> '])
            expect(value).toContain(token);
        vi.useRealTimers();
    });

    it('toggles a rendered preview', () => {
        render(<Harness initial={'# Title\n**bold**'} />);
        fireEvent.click(screen.getByTitle('Preview'));
        expect(document.querySelector('h1')).toHaveTextContent('Title');
        fireEvent.change(document.createElement('textarea'), { target: { value: '' } });
        fireEvent.click(screen.getByTitle('Edit'));
        expect(textarea()).toBeInTheDocument();
    });
});

const editor = () => document.querySelector('.markdown-editor textarea') as HTMLTextAreaElement;

describe('NotesView', () => {
    beforeEach(() => {
        useBoardStore.setState({
            notes: [
                makeNote({
                    id: 'n1',
                    title: 'Groceries',
                    content: '- milk\n- [docs](https://docs.dev)',
                    updatedAt: '2026-10-02T10:00:00Z',
                }),
                makeNote({
                    id: 'n2',
                    title: 'Plain',
                    content: 'plain text note',
                    format: 'text',
                    updatedAt: undefined as unknown as string,
                }),
            ],
        });
        vi.spyOn(window, 'confirm').mockReturnValue(true);
    });
    const renderView = () =>
        render(
            <MemoryRouter>
                <NotesView />
            </MemoryRouter>
        );

    it('searches notes and switches view modes', () => {
        renderView();
        expect(screen.getByText('MD')).toBeInTheDocument();
        fireEvent.change(screen.getByPlaceholderText('Search notes by title or content...'), {
            target: { value: 'groc' },
        });
        expect(screen.queryByText('plain text note')).toBeNull();
        expect(screen.getByText(/Showing 1 of 2/)).toBeInTheDocument();
        fireEvent.change(screen.getByPlaceholderText('Search notes by title or content...'), {
            target: { value: 'nothing' },
        });
        fireEvent.click(screen.getByLabelText('Clear search'));
        expect(screen.getByText('plain text note')).toBeInTheDocument();
        fireEvent.click(screen.getByLabelText('Switch to list view'));
        fireEvent.click(screen.getByLabelText('Switch to grid view'));
        fireEvent.click(screen.getByText('← Back to Today'));
    });

    it('edits, cancels and deletes notes', () => {
        renderView();
        fireEvent.click(screen.getAllByLabelText('Edit note')[0]);
        fireEvent.change(editor(), { target: { value: 'changed' } });
        fireEvent.click(screen.getByText('Save'));
        expect(state().notes[0]).toMatchObject({ content: 'changed', format: 'markdown' });
        fireEvent.click(screen.getAllByLabelText('Edit note')[0]);
        fireEvent.change(editor(), { target: { value: 'discard' } });
        fireEvent.click(screen.getByText('Cancel'));
        expect(state().notes[0].content).toBe('changed');
        fireEvent.click(screen.getAllByLabelText('Edit note')[0]);
        vi.mocked(window.confirm).mockReturnValueOnce(false);
        fireEvent.click(document.querySelector('.note-card.editing .delete-btn')!);
        expect(state().notes).toHaveLength(2);
        fireEvent.click(document.querySelector('.note-card.editing .delete-btn')!);
        expect(state().notes).toHaveLength(1);
        fireEvent.click(screen.getAllByLabelText('Delete note')[0]);
        expect(state().notes).toHaveLength(0);
        expect(screen.getByText(/No notes/i)).toBeInTheDocument();
    });

    it('adds markdown notes', () => {
        renderView();
        fireEvent.click(screen.getByText('+ Add Note with Markdown'));
        fireEvent.change(editor(), { target: { value: '  First line\nmore  ' } });
        fireEvent.click(screen.getByText('✅ Add Note'));
        expect(state().notes.slice(-1)[0]).toMatchObject({
            title: 'First line',
            content: 'First line\nmore',
            format: 'markdown',
        });
        fireEvent.click(screen.getByText('+ Add Note with Markdown'));
        fireEvent.click(screen.getByText('Cancel'));
        expect(screen.getByText('+ Add Note with Markdown')).toBeInTheDocument();
    });
});
