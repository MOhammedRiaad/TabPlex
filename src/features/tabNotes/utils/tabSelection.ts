// Which listed tabs start selected, and how many a run may take (spec §4, §13). Pure, so the dialog and its tests share
// one rule.
import { ReadableTab } from '../types';

/** A run reads at most this many tabs */
export const MAX_TABS_PER_RUN = 12;
/** With more readable tabs than this, nothing is pre-checked */
export const PRE_CHECK_LIMIT = 10;

/** The ids checked when the dialog opens: all readable, non-duplicate tabs, when there are few enough of them */
export function initialSelection(tabs: ReadableTab[]): Set<number> {
    const readable = tabs.filter(tab => tab.readable);
    if (readable.length > PRE_CHECK_LIMIT) return new Set();
    return new Set(
        readable
            .filter(tab => tab.duplicateOf === undefined)
            .slice(0, MAX_TABS_PER_RUN)
            .map(tab => tab.id)
    );
}

/** Keeps the selection that is still readable and listed (a tab that closed or stopped being readable drops out) */
export function keepSelection(selected: ReadonlySet<number>, tabs: ReadableTab[]): Set<number> {
    const readable = new Set(tabs.filter(tab => tab.readable).map(tab => tab.id));
    return new Set([...selected].filter(id => readable.has(id)));
}

/** Whether a checkbox can be ticked: readable, and the run is not yet at its cap */
export function canSelect(tab: ReadableTab, selected: ReadonlySet<number>): boolean {
    if (!tab.readable) return false;
    return selected.has(tab.id) || selected.size < MAX_TABS_PER_RUN;
}

/** The selected readable tabs, in the order they are listed (tab-strip order) */
export function pickedTabs(tabs: ReadableTab[], selected: ReadonlySet<number>): ReadableTab[] {
    return tabs.filter(tab => tab.readable && selected.has(tab.id));
}

/** The distinct origin patterns of the picked tabs, in tab-strip order */
export function originsOf(picked: ReadableTab[]): string[] {
    return [...new Set(picked.map(tab => tab.originPattern))];
}
