// Draft without AI: a sensible title from the tabs, defaults for the rest. See docs/specs/AI_TASK_FROM_TABS.md §5.3.
import { siteKey } from '../../organize/utils/siteGrouping';
import { TaskDraft } from '../types';
import { cleanLine } from './aiDraft';

const FALLBACK_TITLE_MAX = 60;

export function fallbackDraft(tabs: { title: string; url: string }[]): TaskDraft {
    const draft: TaskDraft = { title: '', description: '', priority: 'medium', steps: [] };
    if (tabs.length === 0) return draft;

    const sites = tabs.map(tab => siteKey(tab.url));
    if (tabs.length >= 2 && sites[0] && sites.every(site => site === sites[0])) {
        return { ...draft, title: `Research ${sites[0]}` };
    }

    const title = cleanLine(tabs[0].title).slice(0, FALLBACK_TITLE_MAX).trim();
    if (title.length >= 3) return { ...draft, title };
    return { ...draft, title: sites[0] ? `Work on ${sites[0]}` : '' };
}
