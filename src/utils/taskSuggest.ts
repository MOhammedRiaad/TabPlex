// Suggest a task for a new tab (docs/specs/SUGGEST_TASK_FOR_TAB.md). Pure and DOM-free: the background uses it.
import { Task } from '../types';
import { siteKey } from './siteKey';
import { getContext, isCapturableUrl } from './taskContext';

export interface Suggestion {
    taskId: string;
    title: string;
    score: number;
    site: string;
}

/** `taskId|site` → when the user said "Not now" (ms) */
export type DismissMap = Record<string, number>;

export const SUGGEST_DISMISSED_KEY = 'tabplex_suggest_dismissed';
export const DISMISS_FOR_MS = 7 * 24 * 60 * 60 * 1000;
export const MIN_SCORE = 2;
/** Sites where two pages sharing a domain says nothing about the work */
const STOPLIST = new Set(['google.com', 'bing.com', 'duckduckgo.com', 'youtube.com', 'localhost']);

export const dismissKey = (taskId: string, site: string) => `${taskId}|${site}`;

const withoutHash = (url: string) => url.split('#')[0];

function firstPathSegment(url: string): string {
    try {
        return new URL(url).pathname.split('/')[1] ?? '';
    } catch {
        return '';
    }
}

/** Parked or idle, not done, with saved tabs (D-S4): the active task already gets new tabs through auto-add */
export function isSuggestable(task: Task): boolean {
    const ctx = getContext(task);
    return task.status !== 'done' && ctx.state !== 'active' && ctx.tabs.length > 0;
}

/** Entries younger than the dismiss window; older ones are dropped */
export function pruneDismissed(dismissed: DismissMap, now: number): DismissMap {
    return Object.fromEntries(Object.entries(dismissed).filter(([, at]) => now - at < DISMISS_FOR_MS));
}

/** Best task for `url`, or null */
export function suggestTaskForUrl(
    url: string,
    tasks: Task[],
    dismissed: DismissMap,
    now: number,
    extensionBaseUrl?: string
): Suggestion | null {
    if (!isCapturableUrl(url, extensionBaseUrl) || !/^https?:/i.test(url)) return null;
    const site = siteKey(url);
    if (!site || STOPLIST.has(site)) return null;
    const exact = withoutHash(url);
    const segment = firstPathSegment(url);

    const scored = tasks.filter(isSuggestable).flatMap(task => {
        const at = dismissed[dismissKey(task.id, site)];
        if (at !== undefined && now - at < DISMISS_FOR_MS) return [];
        const sameSite = getContext(task).tabs.filter(tab => siteKey(tab.url) === site);
        if (sameSite.length === 0) return [];
        const score =
            sameSite.length +
            (sameSite.some(tab => withoutHash(tab.url) === exact) ? 3 : 0) +
            (segment && sameSite.some(tab => firstPathSegment(tab.url) === segment) ? 1 : 0);
        return score >= MIN_SCORE ? [{ task, score }] : [];
    });

    scored.sort(
        (a, b) =>
            b.score - a.score ||
            (getContext(b.task).parkedAt ?? '').localeCompare(getContext(a.task).parkedAt ?? '') ||
            a.task.title.localeCompare(b.task.title)
    );
    const best = scored[0];
    return best ? { taskId: best.task.id, title: best.task.title, score: best.score, site } : null;
}
