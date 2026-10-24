// "Summarize open tabs" (spec §4). Rendered once, in App, and open while the UI store's tabNotesDialogOpen is true.
// Page text and model output are untrusted: everything here is rendered as React text.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAiSettings } from '../../ai/hooks/useAiSettings';
import { useModelAvailability } from '../../ai/hooks/useModelAvailability';
import ModelStatus from '../../ai/components/ModelStatus';
import { currentWindowId } from '../../ai/utils/collectTabs';
import { ModelAvailability } from '../../ai/types';
import { useUIActions, useUIStore } from '../../ui/store/uiStore';
import { createNoteFromDraft, draftOf, failuresOf, useTabNotesStore } from '../store/tabNotesStore';
import { NOT_READ_MESSAGE } from '../constants';
import { NoteSource, ReadableTab } from '../types';
import { collectReadableTabs } from '../utils/collectReadableTabs';
import { openSource } from '../utils/openSource';
import { missingOrigins, requestAccess } from '../utils/pageAccess';
import { defaultStudyNoteTitle, hostOf } from '../utils/studyNote';
import {
    MAX_TABS_PER_RUN,
    canSelect,
    initialSelection,
    keepSelection,
    originsOf,
    pickedTabs,
} from '../utils/tabSelection';
import SourceCard from './SourceCard';
import SourceList from './SourceList';
import TabPicker from './TabPicker';
import TopicCard from './TopicCard';
import './TabNotesDialog.css';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** Origin patterns shown as their hosts ("a.com, b.org") */
const hostList = (patterns: string[]) => patterns.map(hostOf).join(', ');

/** The AI path needs a model that is, or can be made, available */
const isAiUsable = (availability: ModelAvailability) =>
    availability === 'available' || availability === 'downloadable' || availability === 'downloading';

const TabNotesPanel: React.FC = () => {
    const { closeTabNotesDialog, showToast } = useUIActions();
    const { settings } = useAiSettings();
    const { availability } = useModelAvailability();
    const run = useTabNotesStore();
    const { actions } = run;
    const titleRef = useRef<HTMLHeadingElement>(null);

    // Step 1: the listed tabs and the selection
    const [tabs, setTabs] = useState<ReadableTab[] | null>(null);
    const [selected, setSelected] = useState<ReadonlySet<number>>(new Set());
    // Step 2: origins of the picked tabs that TabPlex can't read yet (tagged with the selection and permissions they
    // were checked for, so a stale answer is never used), and the ones the user refused
    const [access, setAccess] = useState<{ key: string; version: number; missing: string[] } | null>(null);
    const [denied, setDenied] = useState<string[]>([]);
    const [permissionsVersion, setPermissionsVersion] = useState(0);
    // Step 4: the note's title and tag. The edits and removals live in the store (one source of truth for the views).
    const [title, setTitle] = useState(() => defaultStudyNoteTitle(new Date()));
    const [tagStudy, setTagStudy] = useState(true);

    const picking = run.status === 'idle';
    const aiUsable = isAiUsable(availability);
    const useAi = settings.tabSummaries && aiUsable;

    const closeDialog = useCallback(() => {
        useTabNotesStore.getState().actions.close();
        closeTabNotesDialog();
    }, [closeTabNotesDialog]);

    // Focus goes back to whatever opened the dialog. However it closes, the store is closed (a run is aborted).
    useEffect(() => {
        const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        titleRef.current?.focus();
        return () => {
            useTabNotesStore.getState().actions.close();
            if (opener?.isConnected) opener.focus();
        };
    }, []);

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') closeDialog();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [closeDialog]);

    // The tab list is loaded while picking and refreshed when tabs change, so a tab that finishes loading can be picked
    useEffect(() => {
        if (!picking) return;
        let cancelled = false;
        const load = async (first: boolean) => {
            const listed = await collectReadableTabs(await currentWindowId());
            if (cancelled) return;
            setTabs(listed);
            setSelected(previous => (first ? initialSelection(listed) : keepSelection(previous, listed)));
        };
        const onChange = () => {
            load(false).catch(() => undefined);
        };
        load(true).catch(() => setTabs([]));
        chrome.tabs.onUpdated.addListener(onChange);
        chrome.tabs.onRemoved.addListener(onChange);
        return () => {
            cancelled = true;
            chrome.tabs.onUpdated.removeListener(onChange);
            chrome.tabs.onRemoved.removeListener(onChange);
        };
    }, [picking]);

    const picked = useMemo(() => (tabs ? pickedTabs(tabs, selected) : []), [tabs, selected]);
    const originsKey = originsOf(picked).join('\n');

    // Origins of the picked tabs that TabPlex can't read yet. Computed when the selection changes, not in the click,
    // so the Allow access click can call requestAccess as its first statement.
    useEffect(() => {
        if (!picking) return;
        const patterns = originsKey ? originsKey.split('\n') : [];
        const key = originsKey;
        const version = permissionsVersion;
        let cancelled = false;
        missingOrigins(patterns)
            .then(result => {
                if (!cancelled) setAccess({ key, version, missing: result });
            })
            .catch(() => undefined);
        return () => {
            cancelled = true;
        };
    }, [originsKey, permissionsVersion, picking]);

    // Unknown (null) until the check for the current selection has finished: Summarize stays off meanwhile
    const accessNow = access && access.key === originsKey && access.version === permissionsVersion ? access : null;
    const accessKnown = accessNow !== null;
    const missing = accessNow?.missing ?? [];

    useEffect(() => {
        if (!picking) return;
        const bump = () => setPermissionsVersion(version => version + 1);
        chrome.permissions.onAdded.addListener(bump);
        chrome.permissions.onRemoved.addListener(bump);
        return () => {
            chrome.permissions.onAdded.removeListener(bump);
            chrome.permissions.onRemoved.removeListener(bump);
        };
    }, [picking]);

    const toggle = (tab: ReadableTab) =>
        setSelected(previous => {
            const next = new Set(previous);
            if (next.has(tab.id)) next.delete(tab.id);
            else if (canSelect(tab, previous)) next.add(tab.id);
            return next;
        });

    const onAllowAccess = () => {
        const request = requestAccess(missing); // first statement: the browser only shows its prompt from this click
        request.then(
            granted => {
                setDenied(granted ? [] : missing);
                setPermissionsVersion(version => version + 1);
            },
            () => setDenied(missing)
        );
    };

    const onSummarize = () => {
        actions.start(picked, useAi); // first statement: the model sessions are created in this click
    };

    const running = run.status === 'running';
    const { sources, points, combined } = run;
    // The note is built from this draft, so Create note saves the view on screen
    const draft = useMemo(
        () => draftOf({ sources, points, combined, view: run.view }),
        [sources, points, combined, run.view]
    );
    const view = draft.view;
    const canCombine = combined.length > 0;
    // The review fills in live: topics show as soon as the word grouping exists (view is 'byTab' until then)
    const showCombined = view === 'combined';
    const failures = failuresOf(run.tabs);
    const notRead = run.tabs.filter(entry => entry.state === 'not-read');
    const deniedNow = denied.filter(origin => missing.includes(origin));

    const onCreate = () => {
        createNoteFromDraft(draft, { title, tags: tagStudy ? ['study'] : [], date: new Date() });
        showToast('Note created', 'success');
        closeDialog();
    };

    const onOpen = (source: NoteSource) => {
        openSource(source).catch(() => showToast("Couldn't open this page", 'error'));
    };

    // Why Combined is off: one page has nothing to combine, and tabs that share no topic keep their own sections
    const combineNote =
        sources.length === 1
            ? 'Nothing to combine with one page'
            : sources.length > 1 && !canCombine
              ? "These tabs don't share a topic, so each has its own section."
              : '';

    const combinedTopics = draft.combined ?? [];
    const sharedTopics = combinedTopics.filter(topic => topic.kind === 'shared');
    const soleTopics = combinedTopics.filter(topic => topic.kind === 'source');

    let body: React.ReactNode;
    if (picking) {
        body = (
            <>
                {tabs === null && <p className="tabnotes-muted">Looking at your tabs…</p>}
                {tabs !== null && tabs.length === 0 && (
                    <p className="tabnotes-muted">No web pages open in this window.</p>
                )}
                {tabs !== null && tabs.length > 0 && (
                    <>
                        <p className="tabnotes-count">
                            {selected.size} of {tabs.length} selected, max {MAX_TABS_PER_RUN}
                        </p>
                        <TabPicker tabs={tabs} selected={selected} onToggle={toggle} />
                    </>
                )}
                {missing.length > 0 && (
                    <div className="tabnotes-access">
                        <p>
                            TabPlex needs to read these sites: {hostList(missing)}. Your browser will ask you to
                            confirm. Pages are only read when you click Summarize.
                        </p>
                        {deniedNow.length > 0 && (
                            <p className="tabnotes-error">Access wasn&apos;t allowed for: {hostList(deniedNow)}.</p>
                        )}
                    </div>
                )}
                {settings.tabSummaries ? (
                    <ModelStatus availability={availability} className="tabnotes-status" />
                ) : (
                    <p className="tabnotes-status">
                        Summaries with AI are turned off in Settings. Making a quick view instead.
                    </p>
                )}
            </>
        );
    } else {
        body = (
            <>
                {running && <p className="tabnotes-progress">{run.progress}</p>}
                {running && run.downloadProgress !== null && (
                    <ModelStatus availability={availability} progress={run.downloadProgress} />
                )}
                {run.modelStatus && <p className="tabnotes-status">{run.modelStatus}</p>}
                {!running && run.sources.length === 0 && failures.length === 0 && (
                    <p className="tabnotes-muted">Nothing was read.</p>
                )}
                {!running && sources.length > 0 && (
                    <fieldset className="tabnotes-views">
                        <legend>Combine similar tabs</legend>
                        <label className="tabnotes-toggle">
                            <input
                                type="radio"
                                name="tabnotes-view"
                                value="combined"
                                checked={view === 'combined'}
                                disabled={!canCombine}
                                onChange={() => actions.setView('combined')}
                            />
                            Combined
                        </label>
                        <label className="tabnotes-toggle">
                            <input
                                type="radio"
                                name="tabnotes-view"
                                value="byTab"
                                checked={view === 'byTab'}
                                onChange={() => actions.setView('byTab')}
                            />
                            By tab
                        </label>
                        {combineNote && <p className="tabnotes-status">{combineNote}</p>}
                    </fieldset>
                )}
                {showCombined && (
                    <>
                        {sharedTopics.map(topic => (
                            <TopicCard
                                key={topic.id}
                                topic={topic}
                                points={draft.points}
                                sources={sources}
                                onOpen={onOpen}
                            />
                        ))}
                        {soleTopics.length > 0 && (
                            <section className="tabnotes-section" aria-label="Only in one source">
                                <h3>Only in one source</h3>
                                {soleTopics.map(topic => (
                                    <TopicCard
                                        key={topic.id}
                                        topic={topic}
                                        points={draft.points}
                                        sources={sources}
                                        onOpen={onOpen}
                                    />
                                ))}
                            </section>
                        )}
                        <SourceList sources={sources} onOpen={onOpen} onRemoveSource={actions.removeSource} />
                    </>
                )}
                {!showCombined &&
                    sources.map(source => (
                        <SourceCard
                            key={source.ref}
                            source={source}
                            points={points.filter(point => point.sourceRef === source.ref)}
                            onEdit={actions.editPoint}
                            onRemovePoint={actions.removePoint}
                            onRemoveSource={actions.removeSource}
                            onOpen={onOpen}
                        />
                    ))}
                {failures.length > 0 && (
                    <section className="tabnotes-section">
                        <h3>Could not be read</h3>
                        <ul className="tabnotes-list">
                            {failures.map(entry => (
                                <li key={entry.tab.id} className="tabnotes-list-item">
                                    <span className="tabnotes-pick-title">{entry.tab.title}</span>
                                    <span className="tabnotes-host">{hostOf(entry.tab.url)}</span>
                                    <span className="tabnotes-error">{entry.message}</span>
                                    <button
                                        type="button"
                                        className="tabnotes-btn"
                                        disabled={running}
                                        onClick={() => actions.retryTab(entry.tab.id)}
                                        aria-label={`Retry ${entry.tab.title}`}
                                    >
                                        Retry
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </section>
                )}
                {notRead.length > 0 && (
                    <section className="tabnotes-section">
                        <h3>{NOT_READ_MESSAGE}</h3>
                        <ul className="tabnotes-list">
                            {notRead.map(entry => (
                                <li key={entry.tab.id} className="tabnotes-list-item">
                                    <span className="tabnotes-pick-title">{entry.tab.title}</span>
                                    <span className="tabnotes-host">{hostOf(entry.tab.url)}</span>
                                </li>
                            ))}
                        </ul>
                    </section>
                )}
                {!running && (
                    <div className="tabnotes-note-fields">
                        <label className="tabnotes-field">
                            Note title
                            <input
                                type="text"
                                className="tabnotes-input"
                                value={title}
                                maxLength={200}
                                onChange={e => setTitle(e.target.value)}
                            />
                        </label>
                        <label className="tabnotes-toggle">
                            <input type="checkbox" checked={tagStudy} onChange={e => setTagStudy(e.target.checked)} />
                            Tag &quot;study&quot;
                        </label>
                    </div>
                )}
            </>
        );
    }

    let footer: React.ReactNode;
    if (picking) {
        const label = useAi ? `Summarize ${plural(picked.length, 'tab')}` : 'Make quick view';
        footer = (
            <>
                <button type="button" className="tabnotes-btn" onClick={closeDialog}>
                    Cancel
                </button>
                <div className="tabnotes-group">
                    {missing.length > 0 && (
                        <button type="button" className="tabnotes-btn" onClick={onAllowAccess}>
                            Allow access
                        </button>
                    )}
                    <button
                        type="button"
                        className="tabnotes-btn-primary"
                        disabled={!accessKnown || picked.length === 0 || missing.length > 0}
                        onClick={onSummarize}
                    >
                        {label}
                    </button>
                </div>
            </>
        );
    } else if (running) {
        footer = (
            <div className="tabnotes-group">
                <button type="button" className="tabnotes-btn" onClick={() => actions.cancel()}>
                    Cancel
                </button>
            </div>
        );
    } else {
        footer = (
            <>
                <button type="button" className="tabnotes-btn" onClick={closeDialog}>
                    Close
                </button>
                <div className="tabnotes-group">
                    <button
                        type="button"
                        className="tabnotes-btn-primary"
                        disabled={sources.length === 0}
                        onClick={onCreate}
                    >
                        Create note
                    </button>
                </div>
            </>
        );
    }

    return (
        <div className="tabnotes-overlay" onClick={() => (picking ? closeDialog() : undefined)}>
            <div
                className="tabnotes-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="tabnotes-dialog-title"
                onClick={e => e.stopPropagation()}
            >
                <div className="tabnotes-header">
                    <h2 id="tabnotes-dialog-title" ref={titleRef} tabIndex={-1}>
                        Summarize open tabs
                    </h2>
                    {!picking && <span className="tabnotes-muted">{run.sources.length} read</span>}
                </div>
                <div className="tabnotes-body">{body}</div>
                <div className="tabnotes-actions">{footer}</div>
            </div>
        </div>
    );
};

/** Mounted once in App; renders only while the "Summarize open tabs" dialog is open */
const TabNotesDialog: React.FC = () => {
    const open = useUIStore(state => state.tabNotesDialogOpen);
    return open ? <TabNotesPanel /> : null;
};

export default TabNotesDialog;
