// State for "Summarize open tabs into a note" (spec §8). Not persisted: the dialog reads it and closing the dialog
// clears it. A run reads its tabs one at a time (snapshot, clean, points), and a page's text is dropped as soon as its
// points are made. Then the word grouping is shown, and the AI steps (topic names, combining each shared topic) replace
// it topic by topic. Page text and model output are untrusted: see utils/studyNote.ts.
import { create } from 'zustand';
import { useBoardStore } from '../../../store/boardStore';
import { generateNoteId } from '../../../utils/idGenerator';
import { AiSession, aiErrorMessage, createSession, isAiError } from '../../ai/utils/promptApi';
import { AiError } from '../../ai/types';
import { POINTS_SYSTEM, extractPointsAi, quickResult } from '../utils/aiPoints';
import { COMBINE_SYSTEM, CombineResult, TOPICS_SYSTEM, canonicalTopics, combineTopicChecked } from '../utils/aiTopics';
import { groupTopics, withDistinctHeadings } from '../utils/groupTopics';
import { cleanPage } from '../utils/pageText';
import { PageReadFailure, snapshotTab } from '../utils/readPage';
import { buildStudyNote, hostOf, resolveStudyNoteTitle } from '../utils/studyNote';
import {
    KeyPoint,
    NoteSource,
    QuickReason,
    ReadableTab,
    RunTab,
    StudyNoteDraft,
    StudyNoteView,
    TabRunState,
    Topic,
} from '../types';

export type TabNotesStatus = 'idle' | 'running' | 'done' | 'cancelled';

/**
 * The base sessions of one run, each with its own system prompt (built-in-ai rule 3). Pages, topics and shared topics
 * each work on a clone. `topics` and `combine` are absent for a retry, which only regroups by words.
 */
export interface TabNoteSessions {
    points: Promise<AiSession>;
    topics?: Promise<AiSession>;
    combine?: Promise<AiSession>;
}

type BaseKey = keyof TabNoteSessions;
const GROUPING_KEYS: BaseKey[] = ['topics', 'combine'];
const ALL_KEYS: BaseKey[] = ['points', 'topics', 'combine'];

/**
 * Synchronous: createSession is called here, before any await (built-in-ai rule 2). `grouping` false (a retry) creates
 * the points session only. Every rejection is handled here, so none is unhandled; each caller handles it where it awaits.
 */
export function startTabNoteSessions(onProgress: (fraction: number) => void, grouping = true): TabNoteSessions {
    const points = createSession(POINTS_SYSTEM, onProgress);
    points.catch(() => undefined);
    if (!grouping) return { points };
    const topics = createSession(TOPICS_SYSTEM);
    const combine = createSession(COMBINE_SYSTEM);
    topics.catch(() => undefined);
    combine.catch(() => undefined);
    return { points, topics, combine };
}

/**
 * Destroys the given base sessions as soon as they exist (they may still be starting), once each: `closed` remembers
 * the ones already handled. Never rejects.
 */
function destroyBase(sessions: TabNoteSessions | null, keys: BaseKey[], closed: Set<Promise<AiSession>>): void {
    for (const key of keys) {
        const session = sessions?.[key];
        if (!session || closed.has(session)) continue;
        closed.add(session);
        session.then(
            value => value.destroy(),
            () => undefined
        );
    }
}

/** The started base session, or null when it could not start or the run was cancelled before it did */
async function startedOf(session: Promise<AiSession> | undefined, signal: AbortSignal): Promise<AiSession | null> {
    if (!session) return null;
    try {
        return await untilAborted(session, signal);
    } catch {
        return null;
    }
}

/** Rejects with an 'aborted' AiError as soon as the signal fires, even if the session is still starting */
function untilAborted<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const onAbort = () => reject(new AiError('aborted', 'Cancelled'));
        signal.addEventListener('abort', onAbort, { once: true });
        promise.then(
            value => {
                signal.removeEventListener('abort', onAbort);
                resolve(value);
            },
            error => {
                signal.removeEventListener('abort', onAbort);
                reject(error);
            }
        );
    });
}

/** The user-facing reason a tab could not be read. Messages from readPage and cleanPage are written for the user. */
function failureMessage(error: unknown): string {
    if (error instanceof PageReadFailure) return error.message;
    if (isAiError(error)) return aiErrorMessage(error);
    return 'This page could not be read.';
}

function withTab(state: TabNotesState, tabId: number, patch: Partial<RunTab>): RunTab[] {
    return state.tabs.map(entry => (entry.tab.id === tabId ? { ...entry, ...patch } : entry));
}

export interface TabNotesActions {
    /** Starts a run over the picked tabs (in tab-strip order). The model sessions are created inside this call. */
    start(tabs: ReadableTab[], useAi: boolean): void;
    /** Re-reads one failed tab with its own sessions. Ignored while a run is going. */
    retryTab(tabId: number): void;
    /** Aborts the run. Finished sources are kept; tabs not reached become 'not-read'. */
    cancel(): void;
    /** Cancels any run and clears the state (the dialog closed) */
    close(): void;
    /** The layout the review shows. 'combined' shows the topics only when there are some (see draftOf). */
    setView(view: StudyNoteView): void;
    /** Changes the text of a point. The grouping is kept (the topics show the new text). */
    editPoint(pointId: string, text: string): void;
    /** Removes a point from every view and regroups the topics */
    removePoint(pointId: string): void;
    /** Removes a source and its points from every view and regroups the topics */
    removeSource(ref: number): void;
}

/** The word grouping of the points, recomputed whenever the points or sources change (spec §7.3) */
const groupedOf = (sources: NoteSource[], points: KeyPoint[]): Topic[] => groupTopics(points, sources);

/**
 * After the AI steps: headings made unique (" (2)") and bullet ids "b1", "b2"… unique across the whole list (the ids
 * the combine step makes repeat per topic).
 */
function finishTopics(topics: Topic[]): Topic[] {
    let number = 0;
    return withDistinctHeadings(topics).map(topic => ({
        ...topic,
        bullets: topic.bullets.map(bullet => {
            number += 1;
            return { ...bullet, id: `b${number}` };
        }),
    }));
}

/**
 * Topic bullets show their points' current text, so an edit in the By tab also shows in the Combined view. Bullets
 * keep their ids and their points, so the grouping does not move.
 */
function withCurrentText(topics: Topic[], points: KeyPoint[]): Topic[] {
    const textOf = new Map(points.map(point => [point.id, point.text]));
    return topics.map(topic => ({
        ...topic,
        bullets: topic.bullets.map(bullet => {
            if (bullet.origin !== 'point') return bullet;
            const first = bullet.pointIds.find(id => textOf.has(id));
            return first === undefined ? bullet : { ...bullet, text: textOf.get(first) ?? bullet.text };
        }),
    }));
}

export interface TabNotesState {
    status: TabNotesStatus;
    /** 'ai' when the on-device model reads the pages of this run, 'quick' otherwise */
    mode: 'ai' | 'quick';
    /** Why the quick view is used although AI was asked for (ModelStatus); '' otherwise */
    modelStatus: string;
    /** Model download progress, 0 to 1, or null when nothing is downloading */
    downloadProgress: number | null;
    /** One line for the dialog, e.g. "Reading and summarizing 3 of 6 · mdn.dev…"; '' when there is nothing to show */
    progress: string;
    /** Every picked tab in tab-strip order; ref is the position + 1 and never changes */
    tabs: RunTab[];
    /** The tabs that were read, sorted by ref */
    sources: NoteSource[];
    /** Key points of every source, grouped by sourceRef */
    points: KeyPoint[];
    /** The layout the user picked. The review shows 'combined' only when `combined` has topics (draftOf) */
    view: StudyNoteView;
    /**
     * The topics of the Combined view: the word grouping (groupTopics) as soon as the pages are read, then each shared
     * topic the AI combined replaces its word grouping (combinedBy 'ai'). [] means nothing to combine.
     */
    combined: Topic[];
    /** Set while a run is going; close() clears it, so a finished run stops writing */
    abort: AbortController | null;
    actions: TabNotesActions;
}

type RunChange = Partial<TabNotesState> | ((state: TabNotesState) => Partial<TabNotesState>);

const RESET: Omit<TabNotesState, 'actions'> = {
    status: 'idle',
    mode: 'quick',
    modelStatus: '',
    downloadProgress: null,
    progress: '',
    tabs: [],
    sources: [],
    points: [],
    view: 'combined',
    combined: [],
    abort: null,
};

export const useTabNotesStore = create<TabNotesState>((set, get) => {
    /** Applies a change only while `abort` is still the current run, so a closed dialog never gets late results */
    const updateRun = (abort: AbortController, change: RunChange) =>
        set(state => {
            if (state.abort !== abort) return {};
            return typeof change === 'function' ? change(state) : change;
        });

    /** Reads one tab and records the result, or its failure. A tab that was cancelled is not a failure. */
    const readTab = async (
        entry: RunTab,
        base: AiSession | null,
        abort: AbortController,
        total: number,
        runReason: QuickReason | undefined
    ): Promise<void> => {
        const { tab, ref, state: before } = entry;
        const verb = base ? 'Reading and summarizing' : 'Reading';
        updateRun(abort, state => ({
            progress: `${verb} ${ref} of ${total} · ${hostOf(tab.url)}…`,
            tabs: withTab(state, tab.id, { state: 'reading' }),
        }));
        try {
            const snapshot = await snapshotTab(tab, abort.signal);
            const page = cleanPage(snapshot, tab.title);
            const source: NoteSource = {
                ref,
                tabId: tab.id,
                windowId: tab.windowId,
                title: tab.title,
                url: tab.url,
                mode: base ? 'ai' : 'quick',
                truncated: page.truncated,
                notEnglish: page.notEnglish,
            };
            const found = base
                ? await extractPointsAi(base, source, page, abort.signal)
                : quickResult(source, page, runReason);
            const finished: NoteSource = {
                ...source,
                mode: found.mode,
                truncated: found.truncated,
                ...(found.quickReason ? { quickReason: found.quickReason } : {}),
            };
            updateRun(abort, state => ({
                sources: [...state.sources.filter(s => s.ref !== ref), finished].sort((a, b) => a.ref - b.ref),
                points: [...state.points.filter(p => p.sourceRef !== ref), ...found.points].sort(
                    (a, b) => a.sourceRef - b.sourceRef
                ),
                tabs: withTab(state, tab.id, { state: 'read', message: '' }),
            }));
        } catch (error) {
            if (abort.signal.aborted) {
                // A retried tab keeps its failure; a tab from the run goes back to "not read"
                const cancelled: TabRunState = before === 'failed' ? 'failed' : 'not-read';
                updateRun(abort, state => ({ tabs: withTab(state, tab.id, { state: cancelled }) }));
                return;
            }
            const message = failureMessage(error);
            updateRun(abort, state => ({ tabs: withTab(state, tab.id, { state: 'failed', message }) }));
        }
    };

    /**
     * The AI steps after the pages are read (spec §7.4, §7.5, §8). Topic names regroup the points; then each shared
     * topic is combined in turn and replaces its word grouping as soon as it is done. A step that fails keeps what it
     * had (never a failed run); only a cancel stops the steps.
     */
    const combineWithAi = async (sessions: TabNoteSessions, abort: AbortController): Promise<void> => {
        const { signal } = abort;
        // One source has nothing to combine: the models are not waited for
        if (get().sources.length < 2) return;
        const topicsBase = await startedOf(sessions.topics, signal);
        const combineBase = await startedOf(sessions.combine, signal);
        if (topicsBase) {
            updateRun(abort, { progress: 'Finding shared topics…' });
            const hints = get().points.map(point => point.topicHint);
            // canonicalTopics gives the identity map on any failure; it only throws on a cancel
            const canonical = await canonicalTopics(topicsBase, hints, signal, get().sources.length).catch(
                () => undefined
            );
            if (signal.aborted) return;
            const { sources, points } = get();
            updateRun(abort, { combined: groupTopics(points, sources, canonical) });
        }
        if (!combineBase) return;

        const shared = get().combined.filter(topic => topic.kind === 'shared');
        for (const [index, topic] of shared.entries()) {
            if (signal.aborted) return;
            updateRun(abort, { progress: `Combining topic ${index + 1} of ${shared.length}…` });
            let outcome: CombineResult;
            try {
                outcome = await combineTopicChecked(combineBase, topic, get().points, signal);
            } catch {
                return; // only a cancel throws: the other topics keep their word grouping
            }
            // A failed topic stays its word grouping, with the code of why (Topic.combineNote)
            const result: Topic = outcome.reason ? { ...outcome.topic, combineNote: outcome.reason } : outcome.topic;
            updateRun(abort, state => ({
                combined: state.combined.map(item => (item.id === topic.id ? result : item)),
            }));
        }
    };

    /**
     * Starts the sessions and the run for `entries`. Everything before the first await is synchronous, so the sessions
     * are created inside the click (built-in-ai rule 2). `grouping` is false for a retry: it only regroups by words.
     */
    const execute = (entries: RunTab[], useAi: boolean, grouping: boolean): void => {
        const abort = new AbortController();
        set({
            status: 'running',
            abort,
            mode: useAi ? 'ai' : 'quick',
            progress: useAi ? 'Starting the on-device model…' : '',
            downloadProgress: null,
        });
        const sessions = useAi
            ? startTabNoteSessions(
                  fraction =>
                      updateRun(abort, { downloadProgress: fraction, progress: 'Downloading the on-device model…' }),
                  grouping
              )
            : null;
        const closed = new Set<Promise<AiSession>>();
        const total = get().tabs.length;

        const work = async (): Promise<void> => {
            let base: AiSession | null = null;
            if (sessions) {
                try {
                    base = await untilAborted(sessions.points, abort.signal);
                } catch (error) {
                    // A cancel is not a reason to show ModelStatus; any other failure is
                    if (!isAiError(error, 'aborted')) {
                        updateRun(abort, {
                            modelStatus: `${aiErrorMessage(error)} Making a quick view instead.`,
                        });
                    }
                }
                // Without the points model the run is a quick view: the other sessions are not needed
                if (!base) destroyBase(sessions, GROUPING_KEYS, closed);
            }
            updateRun(abort, { mode: base ? 'ai' : 'quick', downloadProgress: null });
            // The model was asked for but could not start: every page of this run is a quick view for that reason
            const runReason: QuickReason | undefined = sessions && !base ? 'no-model' : undefined;
            for (const entry of entries) {
                if (abort.signal.aborted) break;
                await readTab(entry, base, abort, total, runReason);
            }
            // The word grouping is the fallback: the review shows it as soon as the pages are read
            updateRun(abort, state => ({ combined: groupedOf(state.sources, state.points) }));
            if (base && sessions && grouping && !abort.signal.aborted) await combineWithAi(sessions, abort);
        };

        work().finally(() => {
            destroyBase(sessions, ALL_KEYS, closed);
            updateRun(abort, state => ({
                status: abort.signal.aborted ? 'cancelled' : 'done',
                progress: '',
                downloadProgress: null,
                abort: null,
                tabs: state.tabs.map(entry => (entry.state === 'waiting' ? { ...entry, state: 'not-read' } : entry)),
                combined: finishTopics(state.combined),
            }));
        });
    };

    return {
        ...RESET,

        actions: {
            start: (tabs, useAi) => {
                if (get().status === 'running') return;
                const entries = tabs.map(
                    (tab, index): RunTab => ({ ref: index + 1, tab, state: 'waiting', message: '' })
                );
                set({ ...RESET, tabs: entries });
                execute(entries, useAi, true);
            },

            retryTab: tabId => {
                const state = get();
                const entry = state.tabs.find(item => item.tab.id === tabId);
                if (!entry || entry.state !== 'failed' || state.status === 'running') return;
                // A retry never calls the model for topics: it regroups by words
                execute([entry], state.mode === 'ai', false);
            },

            cancel: () => get().abort?.abort(),

            close: () => {
                get().abort?.abort();
                set({ ...RESET });
            },

            setView: view => set({ view }),

            editPoint: (pointId, text) =>
                set(state => ({
                    points: state.points.map(point => (point.id === pointId ? { ...point, text } : point)),
                })),

            removePoint: pointId =>
                set(state => {
                    const points = state.points.filter(point => point.id !== pointId);
                    return { points, combined: groupedOf(state.sources, points) };
                }),

            removeSource: ref =>
                set(state => {
                    const sources = state.sources.filter(source => source.ref !== ref);
                    const points = state.points.filter(point => point.sourceRef !== ref);
                    return { sources, points, combined: groupedOf(sources, points) };
                }),
        },
    };
});

export const useTabNotesActions = () => useTabNotesStore(state => state.actions);

/**
 * The draft the review shows and the note is built from, for the view on screen: 'combined' when there are topics to
 * show, else 'byTab'. Topic bullets carry their points' current text.
 */
export function draftOf(state: Pick<TabNotesState, 'sources' | 'points' | 'view' | 'combined'>): StudyNoteDraft {
    const view = state.view === 'combined' && state.combined.length > 0 ? 'combined' : 'byTab';
    return {
        view,
        sources: state.sources,
        points: state.points,
        combined: withCurrentText(state.combined, state.points),
    };
}

/** Tabs that could not be read; each has a retry */
export const failuresOf = (tabs: RunTab[]): RunTab[] => tabs.filter(entry => entry.state === 'failed');

/** Saves the note through the normal path (ADD_NOTE, then STORAGE_NOTE_ADDED). Returns the new note's id. */
export function createNoteFromDraft(
    draft: StudyNoteDraft,
    options: { title?: string; tags: string[]; date: Date }
): string {
    const id = generateNoteId();
    const title = resolveStudyNoteTitle(options.title, options.date);
    const content = buildStudyNote(draft, { title, date: options.date });
    useBoardStore.getState().addNote({ id, title, content, format: 'markdown', tags: options.tags });
    return id;
}
