// Step 1 of the "Summarize open tabs" dialog: the readable tabs of this window, with a checkbox each. Unreadable tabs
// are listed greyed out with the reason (spec §5.1).
import React from 'react';
import { getFaviconUrl } from '../../../utils/favicon';
import { ReadableTab, UnreadableReason } from '../types';
import { canSelect } from '../utils/tabSelection';
import { hostOf } from '../utils/studyNote';

export const UNREADABLE_TEXT: Record<UnreadableReason, string> = {
    pdf: "Can't read PDFs yet",
    asleep: 'Tab is asleep. Open it once, then try again',
    loading: 'Still loading',
    'blocked-site': "Your browser doesn't let extensions read this page",
};

interface TabPickerProps {
    tabs: ReadableTab[];
    selected: ReadonlySet<number>;
    onToggle: (tab: ReadableTab) => void;
}

/** The short line under a tab that cannot be picked, or that is the same page as an earlier tab */
function noteFor(tab: ReadableTab, tabs: ReadableTab[]): string {
    if (!tab.readable) return UNREADABLE_TEXT[tab.reason ?? 'asleep'];
    if (tab.duplicateOf !== undefined) {
        const earlier = tabs.find(item => item.id === tab.duplicateOf);
        return `Same page as ${earlier?.title ?? 'an earlier tab'}`;
    }
    return '';
}

const TabPicker: React.FC<TabPickerProps> = ({ tabs, selected, onToggle }) => (
    <ul className="tabnotes-pick-list">
        {tabs.map(tab => {
            const note = noteFor(tab, tabs);
            const noteId = `tabnotes-note-${tab.id}`;
            const src = tab.favicon || getFaviconUrl(tab.url, 16);
            const host = hostOf(tab.url);
            return (
                <li key={tab.id} className={`tabnotes-pick-item${tab.readable ? '' : ' is-unreadable'}`}>
                    <input
                        type="checkbox"
                        id={`tabnotes-tab-${tab.id}`}
                        checked={selected.has(tab.id)}
                        disabled={!canSelect(tab, selected)}
                        onChange={() => onToggle(tab)}
                        aria-describedby={note ? noteId : undefined}
                    />
                    {src ? (
                        <img className="tabnotes-favicon" src={src} alt="" />
                    ) : (
                        <span className="tabnotes-favicon" />
                    )}
                    <label className="tabnotes-pick-label" htmlFor={`tabnotes-tab-${tab.id}`}>
                        <span className="tabnotes-pick-title">{tab.title}</span>{' '}
                        {host && <span className="tabnotes-host">{host}</span>}
                    </label>
                    {note && (
                        <p className="tabnotes-note" id={noteId}>
                            {note}
                        </p>
                    )}
                </li>
            );
        })}
    </ul>
);

export default TabPicker;
