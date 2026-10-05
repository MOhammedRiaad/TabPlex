// Export a task or a board as Markdown / CSV (docs/specs/EXPORT_MARKDOWN_CSV.md). Pure functions.
import { Board, Folder, Tab, Task } from '../types';

const STATUS: Record<Task['status'], string> = { todo: 'To do', doing: 'Doing', done: 'Done' };
const PRIORITY: Record<Task['priority'], string> = { low: 'Low', medium: 'Medium', high: 'High' };

/** Escape characters that Markdown would otherwise treat as formatting */
export function escapeMarkdown(text: string): string {
    return text
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/([\\`*_[\]])/g, '\\$1')
        .replace(/^(#|>|-|\+|\d+\.)/, '\\$1');
}

/** A URL safe to put inside Markdown link parentheses */
export function markdownUrl(url: string): string {
    return url.replace(/ /g, '%20').replace(/\(/g, '%28').replace(/\)/g, '%29');
}

const link = (title: string, url: string) => `- [${escapeMarkdown(title || url)}](${markdownUrl(url)})`;
const today = (now: Date) => now.toISOString().slice(0, 10);

/** One task as Markdown: details, checklist, its tabs and where you left off */
export function taskToMarkdown(task: Task, savedTabs: Tab[], now = new Date()): string {
    const lines = [`# ${escapeMarkdown(task.title)}`, ''];

    const meta = [`**Status:** ${STATUS[task.status]}`, `**Priority:** ${PRIORITY[task.priority]}`];
    if (task.dueDate) meta.push(`**Due:** ${task.dueDate}`);
    lines.push(`- ${meta.join(' · ')}`);
    if (task.tags?.length) lines.push(`- **Tags:** ${task.tags.map(tag => `#${tag}`).join(' ')}`);
    lines.push('');

    if (task.description?.trim()) lines.push(task.description.trim(), '');

    if (task.checklist?.length) {
        lines.push('## Checklist', '');
        for (const item of task.checklist) lines.push(`- [${item.completed ? 'x' : ' '}] ${escapeMarkdown(item.text)}`);
        lines.push('');
    }

    // The task's own tabs first, then its linked saved tabs; no URL twice
    const seen = new Set<string>();
    const tabs: { title: string; url: string }[] = [];
    const add = (title: string, url: string) => {
        if (!url || seen.has(url)) return;
        seen.add(url);
        tabs.push({ title, url });
    };
    for (const tab of task.context?.tabs ?? []) add(tab.title, tab.url);
    for (const id of task.tabIds ?? []) {
        const saved = savedTabs.find(tab => tab.id === id);
        if (saved) add(saved.title, saved.url);
    }
    if (tabs.length) {
        lines.push('## Tabs', '');
        for (const tab of tabs) lines.push(link(tab.title, tab.url));
        lines.push('');
    }

    const note = task.context?.resumeNote?.trim();
    const summary = task.context?.aiSummary?.trim();
    if (note || summary) {
        lines.push('## Where I left off', '');
        if (note) lines.push(`> ${note.replace(/\n/g, '\n> ')}`, '');
        if (summary) lines.push(`_${escapeMarkdown(summary)}_`, '');
    }

    lines.push(`_Exported from TabPlex on ${today(now)}._`);
    return lines.join('\n') + '\n';
}

const byOrderThenName =
    <T extends { order?: number }>(name: (item: T) => string) =>
    (a: T, b: T) =>
        (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER) || name(a).localeCompare(name(b));

/** The board's folders in display order, each with its tabs; tabs without a folder last, as "Unsorted" */
function boardSections(board: Board, folders: Folder[], tabs: Tab[]) {
    const boardFolders = folders.filter(folder => folder.boardId === board.id).sort(byOrderThenName(f => f.name));
    const folderIds = new Set(boardFolders.map(folder => folder.id));
    const sortTabs = (list: Tab[]) => [...list].sort(byOrderThenName(t => t.title));
    const sections = boardFolders.map(folder => ({
        name: folder.name,
        tabs: sortTabs(tabs.filter(tab => tab.folderId === folder.id)),
    }));
    const unsorted = sortTabs(tabs.filter(tab => !tab.folderId || !folderIds.has(tab.folderId)));
    if (unsorted.length) sections.push({ name: 'Unsorted', tabs: unsorted });
    return sections;
}

/** A board as Markdown: one section per folder with its saved tabs */
export function boardToMarkdown(board: Board, folders: Folder[], tabs: Tab[], now = new Date()): string {
    const lines = [`# ${escapeMarkdown(board.name)}`, ''];
    for (const section of boardSections(board, folders, tabs)) {
        lines.push(`## ${escapeMarkdown(section.name)}`, '');
        if (section.tabs.length === 0) lines.push('_No tabs_');
        for (const tab of section.tabs) {
            const tags = tab.tags?.length ? ' ' + tab.tags.map(tag => `#${tag}`).join(' ') : '';
            lines.push(link(tab.title, tab.url) + tags);
        }
        lines.push('');
    }
    lines.push(`_Exported from TabPlex on ${today(now)}._`);
    return lines.join('\n') + '\n';
}

/** One CSV field: quoted when needed, and never read as a formula by spreadsheets */
export function csvField(value: string): string {
    let text = value;
    if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** A board as CSV (RFC 4180, CRLF, UTF-8 BOM for Excel): Folder, Title, URL, Tags, Saved */
export function boardToCsv(board: Board, folders: Folder[], tabs: Tab[]): string {
    const rows = [['Folder', 'Title', 'URL', 'Tags', 'Saved']];
    for (const section of boardSections(board, folders, tabs)) {
        for (const tab of section.tabs) {
            rows.push([section.name, tab.title, tab.url, (tab.tags ?? []).join(';'), tab.createdAt.slice(0, 10)]);
        }
    }
    return '﻿' + rows.map(row => row.map(csvField).join(',')).join('\r\n') + '\r\n';
}
