// State for "Summarize open tabs into a note" (spec §8). Not persisted: the dialog reads it and closing the dialog
// clears it. A run reads its tabs one at a time (snapshot, clean, points), and a page's text is dropped as soon as its
// points are made. Page text and model output are untrusted: see utils/studyNote.ts.
import { create } from 'zustand';
import { useBoardStore } from '../../../store/boardStore';
import { generateNoteId } from '../../../utils/idGenerator';
import { AiSession, aiErrorMessage, createSession, isAiError } from '../../ai/utils/promptApi';
import { AiError } from '../../ai/types';
import { POINTS_SYSTEM, extractPointsAi } from '../utils/aiPoints';
import { groupTopics } from '../utils/groupTopics';
import { cleanPage } from '../utils/pageText';
import { extractPointsQuick } from '../utils/quickPoints';
import { PageReadFailure, snapshotTab } from '../utils/readPage';
import { buildStudyNote, hostOf, resolveStudyNoteTitle } from '../utils/studyNote';
import { KeyPoint, NoteSource, ReadableTab, RunTab, StudyNoteDraft, StudyNoteView, TabRunState, Topic } from '../types';

export type TabNotesStatus = 'idle' | 'running' | 'done' | 'cancelled';

/**
 * The model sessions one run creates in its click. Each page works on a clone of `points`. PR B adds `topics` and
 * `combine` here, with the same rule: created synchronously, destroyed when the run ends.
 */
export interface TabNoteSessions {
    points: Promise<AiSession>;
}

/** Synchronous: createSession is called here, before any await (built-in-ai rule 2) */
export function startTabNoteSessions(onProgress: (fraction: number) => void): TabNoteSessions {
    const points = createSession(POINTS_SYSTEM, onProgress);
    points.catch(() => undefined); // every caller handles the rejection where it awaits
    return { points };
}

/** Destroys base sessions as soon as they exist (they may still be starting). Never rejects. */
function destroyBase(sessions: TabNoteSessions | null): void {
    sessions?.points.then(
        session => session.destroy(),
        () => undefined
    );
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
    /** groupTopics(points, sources): shared topics, then each tab's leftovers. [] means nothing to combine. */
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
        total: number
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
                : { points: extractPointsQuick(source, page), truncated: page.truncated, mode: 'quick' as const };
            const finished: NoteSource = { ...source, mode: found.mode, truncated: found.truncated };
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
     * Starts the sessions and the run for `entries`. Everything before the first await is synchronous, so the session
     * is created inside the click (built-in-ai rule 2).
     */
    const execute = (entries: RunTab[], useAi: boolean): void => {
        const abort = new AbortController();
        set({
            status: 'running',
            abort,
            mode: useAi ? 'ai' : 'quick',
            progress: useAi ? 'Starting the on-device model…' : '',
            downloadProgress: null,
        });
        const sessions = useAi
            ? startTabNoteSessions(fraction =>
                  updateRun(abort, { downloadProgress: fraction, progress: 'Downloading the on-device model…' })
              )
            : null;
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
            }
            updateRun(abort, { mode: base ? 'ai' : 'quick', downloadProgress: null });
            for (const entry of entries) {
                if (abort.signal.aborted) break;
                await readTab(entry, base, abort, total);
            }
        };

        work().finally(() => {
            destroyBase(sessions);
            updateRun(abort, state => ({
                status: abort.signal.aborted ? 'cancelled' : 'done',
                progress: '',
                downloadProgress: null,
                abort: null,
                tabs: state.tabs.map(entry => (entry.state === 'waiting' ? { ...entry, state: 'not-read' } : entry)),
                combined: groupedOf(state.sources, state.points),
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
                execute(entries, useAi);
            },

            retryTab: tabId => {
                const state = get();
                const entry = state.tabs.find(item => item.tab.id === tabId);
                if (!entry || entry.state !== 'failed' || state.status === 'running') return;
                execute([entry], state.mode === 'ai');
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
