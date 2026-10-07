// Names for saved sessions (docs/specs/AI_SESSION_NAMES.md): a readable non-AI default, and an on-device AI name
import { siteKey } from '../../../utils/siteKey';
import { describeTabForAi } from '../../ai/utils/tabText';
import { AiSession, fitInput, promptJson } from '../../ai/utils/promptApi';
import { cleanLine } from '../../taskDraft/utils/aiDraft';

export const SESSION_NAME_MAX = 60;
const MAX_TABS_FOR_NAME = 30;

/** "github.com, docs.google.com +3 more · Mon 5 Oct"; "Session · Mon 5 Oct" when there are no web tabs */
export function fallbackSessionName(tabs: { url: string }[], date: Date): string {
    const day = date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
    const counts = new Map<string, number>();
    for (const tab of tabs) {
        const site = siteKey(tab.url);
        if (site && /^https?:/.test(tab.url)) counts.set(site, (counts.get(site) ?? 0) + 1);
    }
    const sites = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([site]) => site);
    if (sites.length === 0) return `Session · ${day}`;
    const shown = sites.slice(0, 2).join(', ');
    const more = sites.length > 2 ? ` +${sites.length - 2} more` : '';
    return `${shown}${more} · ${day}`;
}

export const SESSION_NAME_SYSTEM_PROMPT = [
    'You name a saved set of browser tabs.',
    'Reply with a short name (2 to 5 words, Title Case) for what the person was working on.',
    'No quotes, no emoji, no date.',
    'Answer only with JSON that matches the schema.',
].join('\n');

// No maxLength (Chrome's built-in AI guidance): the name is cut on the client
export const SESSION_NAME_SCHEMA = {
    type: 'object',
    properties: { name: { type: 'string', minLength: 2 } },
    required: ['name'],
    additionalProperties: false,
};

export function normalizeSessionName(raw: unknown): string | null {
    if (!raw || typeof raw !== 'object') return null;
    const name = cleanLine(String((raw as { name?: unknown }).name ?? ''))
        .slice(0, SESSION_NAME_MAX)
        .trim();
    return name.length >= 2 ? name : null;
}

export const buildSessionNameInput = (tabs: { title: string; url: string }[]) =>
    `Tabs:\n${tabs.map(tab => `- ${describeTabForAi(tab)}`).join('\n')}\n\nName this session.`;

/** Ask the on-device model for a name. Rejects with an AiError when it can't; the caller keeps the fallback. */
export async function suggestSessionName(
    session: Promise<AiSession>,
    tabs: { title: string; url: string }[]
): Promise<string> {
    const ready = await session;
    const webTabs = tabs.filter(tab => /^https?:/.test(tab.url)).slice(0, MAX_TABS_FOR_NAME);
    const { input } = await fitInput(ready, webTabs.length ? webTabs : tabs, buildSessionNameInput, 1);
    return promptJson(ready, input, { schema: SESSION_NAME_SCHEMA, validate: normalizeSessionName });
}
