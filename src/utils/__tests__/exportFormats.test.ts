import { describe, expect, it } from 'vitest';
import { boardToCsv, boardToMarkdown, csvField, escapeMarkdown, markdownUrl, taskToMarkdown } from '../exportFormats';
import { boardContents } from '../boards';
import { makeBoard, makeContext, makeFolder, makeTab, makeTask } from '../../test/factories';

const NOW = new Date('2026-10-05T12:00:00Z');

describe('taskToMarkdown', () => {
    it('writes details, checklist, tabs and where you left off', () => {
        const task = makeTask({
            title: 'Compare Stripe and Paddle pricing',
            status: 'doing',
            priority: 'high',
            dueDate: '2026-10-20',
            tags: ['q4', 'payments'],
            description: 'Decide which payment provider to use.',
            checklist: [
                { id: 'a', text: 'Compare transaction fees', completed: true },
                { id: 'b', text: 'Check VAT handling for EU', completed: false },
            ],
            tabIds: ['saved1', 'saved2'],
            context: makeContext({
                tabs: [{ url: 'https://stripe.com/pricing', title: 'Stripe pricing' }],
                resumeNote: 'Comparing EU VAT next.',
                aiSummary: 'You were comparing fees.',
            }),
        });
        const saved = [
            makeTab({ id: 'saved1', title: 'Paddle | Pricing', url: 'https://paddle.com/pricing' }),
            makeTab({ id: 'saved2', title: 'Stripe again', url: 'https://stripe.com/pricing' }), // duplicate URL
        ];
        expect(taskToMarkdown(task, saved, NOW)).toBe(
            [
                '# Compare Stripe and Paddle pricing',
                '',
                '- **Status:** Doing · **Priority:** High · **Due:** 2026-10-20',
                '- **Tags:** #q4 #payments',
                '',
                'Decide which payment provider to use.',
                '',
                '## Checklist',
                '',
                '- [x] Compare transaction fees',
                '- [ ] Check VAT handling for EU',
                '',
                '## Tabs',
                '',
                '- [Stripe pricing](https://stripe.com/pricing)',
                '- [Paddle | Pricing](https://paddle.com/pricing)',
                '',
                '## Where I left off',
                '',
                '> Comparing EU VAT next.',
                '',
                '_You were comparing fees._',
                '',
                '_Exported from TabPlex on 2026-10-05._',
                '',
            ].join('\n')
        );
    });

    it('leaves out empty sections and fields', () => {
        const md = taskToMarkdown(makeTask({ title: 'Plain', status: 'todo', priority: 'low' }), [], NOW);
        expect(md).toBe(
            '# Plain\n\n- **Status:** To do · **Priority:** Low\n\n_Exported from TabPlex on 2026-10-05._\n'
        );
    });

    it('escapes Markdown in titles and keeps links intact', () => {
        expect(escapeMarkdown('# [Draft] *v2* `api`_x_')).toBe('\\# \\[Draft\\] \\*v2\\* \\`api\\`\\_x\\_');
        expect(escapeMarkdown('  two\n lines ')).toBe('two lines');
        expect(markdownUrl('https://a.dev/x (1) y')).toBe('https://a.dev/x%20%281%29%20y');
        const task = makeTask({ title: 'T', context: makeContext({ tabs: [{ url: 'https://a.dev', title: '' }] }) });
        expect(taskToMarkdown(task, [], NOW)).toContain('- [https://a.dev](https://a.dev)');
    });
});

describe('board exports', () => {
    const board = makeBoard({ id: 'b1', name: 'Work' });
    const folders = [
        makeFolder({ id: 'f2', name: 'Specs', boardId: 'b1', order: 2 }),
        makeFolder({ id: 'f1', name: 'Research', boardId: 'b1', order: 1 }),
        makeFolder({ id: 'f3', name: 'Empty', boardId: 'b1', order: 3 }),
        makeFolder({ id: 'other', name: 'Other board', boardId: 'b2', order: 0 }),
    ];
    const tabs = [
        makeTab({ id: 't2', title: 'Beta', url: 'https://b.dev', folderId: 'f1', order: 2, tags: ['web'] }),
        makeTab({ id: 't1', title: 'Alpha', url: 'https://a.dev', folderId: 'f1', order: 1 }),
        makeTab({
            id: 't3',
            title: 'Spec, "v2"',
            url: 'https://s.dev',
            folderId: 'f2',
            createdAt: '2026-10-01T00:00:00Z',
        }),
        makeTab({ id: 't4', title: '=SUM(A1)', url: 'https://u.dev', folderId: '' }),
    ];

    it('Markdown: folders in order, tabs in order with tags, empty folders and unsorted tabs', () => {
        const md = boardToMarkdown(board, folders, tabs, NOW);
        expect(md).toBe(
            [
                '# Work',
                '',
                '## Research',
                '',
                '- [Alpha](https://a.dev)',
                '- [Beta](https://b.dev) #web',
                '',
                '## Specs',
                '',
                '- [Spec, "v2"](https://s.dev)',
                '',
                '## Empty',
                '',
                '_No tabs_',
                '',
                '## Unsorted',
                '',
                '- [=SUM(A1)](https://u.dev)',
                '',
                '_Exported from TabPlex on 2026-10-05._',
                '',
            ].join('\n')
        );
        expect(md).not.toContain('Other board');
    });

    it('CSV: BOM, CRLF, quoting, tags and a formula-injection guard', () => {
        const csv = boardToCsv(board, folders, tabs);
        expect(csv.startsWith('﻿')).toBe(true);
        const lines = csv.slice(1).split('\r\n');
        expect(lines[0]).toBe('Folder,Title,URL,Tags,Saved');
        expect(lines[2]).toMatch(/^Research,Beta,https:\/\/b\.dev,web,\d{4}-\d{2}-\d{2}$/);
        expect(lines[3]).toBe('Specs,"Spec, ""v2""",https://s.dev,,2026-10-01');
        expect(lines[4]).toMatch(/^Unsorted,'=SUM\(A1\),https:\/\/u\.dev,,/);
        expect(lines[lines.length - 1]).toBe('');
        expect(csvField('-1')).toBe("'-1");
        expect(csvField('multi\nline')).toBe('"multi\nline"');
    });
});

describe('boardContents', () => {
    it("shows the board's folders, their tabs, and unfiled tabs that aren't in a session", () => {
        const folders = [makeFolder({ id: 'f1', boardId: 'b1' }), makeFolder({ id: 'f9', boardId: 'b2' })];
        const tabs = [
            makeTab({ id: 'in', folderId: 'f1' }),
            makeTab({ id: 'elsewhere', folderId: 'f9' }),
            makeTab({ id: 'unfiled', folderId: '' }),
            makeTab({ id: 'session', folderId: '' }),
            makeTab({ id: 'orphan', folderId: 'gone' }),
        ];
        const result = boardContents({ id: 'b1' }, folders, tabs, [{ tabIds: ['session'] }]);
        expect(result.folders.map(f => f.id)).toEqual(['f1']);
        expect(result.tabs.map(t => t.id)).toEqual(['in', 'unfiled', 'orphan']);
    });
});
