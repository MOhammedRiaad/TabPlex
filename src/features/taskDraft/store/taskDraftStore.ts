// State for the "New task from tabs" dialog. The entry points (Tasks header, command palette, Organize dialog)
// and the dialog live in different components, so the state lives here. See docs/specs/AI_TASK_FROM_TABS.md §7.
import { create } from 'zustand';
import { Task } from '../../../types';
import { generateId } from '../../../utils/idGenerator';
import { useUIStore } from '../../ui/store/uiStore';
import { ModelAvailability, OrganizableTab } from '../../ai/types';
import { AiSession, createSession, fitInput, isAiError, promptJson } from '../../ai/utils/promptApi';
import { currentWindowId, getOrganizableTabs, getTabsByIds } from '../../ai/utils/collectTabs';
import { DIFFERENT_DRAFT, DRAFT_SCHEMA, DRAFT_SYSTEM_PROMPT, buildDraftInput, normalizeDraft } from '../utils/aiDraft';
import { fallbackDraft } from '../utils/fallbackDraft';
import {
    DraftStep,
    HINT_MAX,
    MAX_STEPS,
    MAX_TABS_FOR_DRAFT,
    STEP_MAX,
    TASK_DESCRIPTION_MAX,
    TASK_TITLE_MAX,
    TaskDraft,
} from '../types';

export type TaskDraftPhase = 'closed' | 'drafting' | 'ready' | 'creating' | 'error';

export const NO_TABS_FOR_TASK = 'No web tabs to use: open some pages first.';
export const REPLACE_EDITS_PROMPT = 'Replace your title, notes and steps with a new draft?';

interface TaskDraftState {
    phase: TaskDraftPhase;
    tabs: OrganizableTab[];
    checkedIds: number[];
    /** Checked ids at the time of the last draft, to show "tabs changed" */
    draftedIds: number[];
    title: string;
    description: string;
    priority: Task['priority'];
    steps: DraftStep[];
    hint: string;
    source: 'ai' | 'fallback';
    /** The user edited the title, notes or steps since the last draft */
    dirty: boolean;
    /** The AI draft used only the first N checked tabs */
    trimmedTo: number | null;
    downloadProgress: number | null;
    error: unknown;

    // Latest known environment, set by the always-mounted dialog. Read synchronously in the click handler:
    // createSession must run before any await (user activation).
    aiEnabled: boolean;
    availability: ModelAvailability;

    session: Promise<AiSession> | null;
    /** The session failed to start (e.g. model download failed): Draft again creates a new one */
    sessionFailed: boolean;
    abort: AbortController | null;

    actions: {
        setEnvironment(env: { aiEnabled: boolean; availability: ModelAvailability }): void;
        /** Call synchronously in a click */
        open(tabIds?: number[]): void;
        /** Call synchronously in a click */
        draftAgain(): void;
        toggleTab(id: number): void;
        setTitle(value: string): void;
        setDescription(value: string): void;
        setPriority(priority: Task['priority']): void;
        setStep(key: string, text: string): void;
        toggleStep(key: string): void;
        removeStep(key: string): void;
        addStep(): void;
        setHint(value: string): void;
        cancel(): void;
    };
}

const RESET = {
    phase: 'closed' as TaskDraftPhase,
    tabs: [],
    checkedIds: [],
    draftedIds: [],
    title: '',
    description: '',
    priority: 'medium' as Task['priority'],
    steps: [],
    hint: '',
    source: 'fallback' as const,
    dirty: false,
    trimmedTo: null,
    downloadProgress: null,
    error: null,
    session: null,
    sessionFailed: false,
    abort: null,
};

const showToast = (message: string, type: 'success' | 'error' | 'info') =>
    useUIStore.getState().actions.showToast(message, type);

export const canDraftWithAi = (aiEnabled: boolean, availability: ModelAvailability) =>
    aiEnabled && (availability === 'available' || availability === 'downloadable' || availability === 'downloading');

const destroySession = (session: Promise<AiSession> | null) => {
    session?.then(s => s.destroy()).catch(() => undefined);
};

/** The checked set differs from the one the last draft was made from */
export const tabsChangedSinceDraft = (state: Pick<TaskDraftState, 'checkedIds' | 'draftedIds'>) =>
    state.checkedIds.length !== state.draftedIds.length || state.checkedIds.some(id => !state.draftedIds.includes(id));

const toSteps = (texts: string[]): DraftStep[] =>
    texts.map(text => ({ key: generateId('step'), text, included: true }));

export const useTaskDraftStore = create<TaskDraftState>((set, get) => {
    const applyDraft = (draft: TaskDraft, source: 'ai' | 'fallback') =>
        set({
            title: draft.title,
            description: draft.description,
            priority: draft.priority,
            steps: toSteps(draft.steps),
            source,
            dirty: false,
            downloadProgress: null,
        });

    /** Start a model session from a click; must be called before any await */
    const newSession = () => {
        const session = createSession(DRAFT_SYSTEM_PROMPT, progress => set({ downloadProgress: progress }));
        session.catch(() => {
            if (get().session === session) set({ sessionFailed: true });
        });
        return session;
    };

    /** Draft from the checked tabs with the model and show the result */
    const runAi = async (session: Promise<AiSession>, abort: AbortController, again: boolean) => {
        const { tabs, checkedIds, hint } = get();
        const checked = tabs.filter(tab => checkedIds.includes(tab.id));
        set({ phase: 'drafting', draftedIds: checkedIds, error: null });
        if (checked.length === 0) {
            set({ phase: 'ready' });
            return;
        }
        const ready = await session;
        const candidates = checked.slice(0, MAX_TABS_FOR_DRAFT);
        const { input, used } = await fitInput(ready, candidates, t => buildDraftInput(t, hint), 1);
        const draft = await promptJson(ready, again ? input + DIFFERENT_DRAFT : input, {
            schema: DRAFT_SCHEMA,
            validate: normalizeDraft,
            signal: abort.signal,
        });
        if (abort.signal.aborted) return;
        applyDraft(draft, 'ai');
        set({ phase: 'ready', trimmedTo: used < checked.length ? used : null });
    };

    const fail = (error: unknown) => {
        if (isAiError(error, 'aborted') || get().phase === 'closed') return;
        // The fields keep what they held (the fallback draft on first open): the dialog never blocks on AI
        set({ phase: 'error', error, downloadProgress: null });
    };

    const updateSteps = (change: (steps: DraftStep[]) => DraftStep[]) =>
        set(state => ({ steps: change(state.steps), dirty: true }));

    return {
        ...RESET,
        aiEnabled: true,
        availability: 'unsupported',

        actions: {
            setEnvironment: env => set(env),

            open: tabIds => {
                const state = get();
                if (state.phase !== 'closed') return;
                const useAi = canDraftWithAi(state.aiEnabled, state.availability);
                const abort = new AbortController();
                const session = useAi ? newSession() : null;
                set({ ...RESET, phase: useAi ? 'drafting' : 'ready', session, abort });

                (async () => {
                    const tabs = tabIds?.length
                        ? await getTabsByIds(tabIds)
                        : await getOrganizableTabs(await currentWindowId());
                    if (abort.signal.aborted) return;
                    if (tabs.length === 0) {
                        showToast(NO_TABS_FOR_TASK, 'info');
                        get().actions.cancel();
                        return;
                    }
                    const ids = tabs.map(tab => tab.id);
                    applyDraft(fallbackDraft(tabs), 'fallback');
                    set({ tabs, checkedIds: ids, draftedIds: ids });
                    if (session) await runAi(session, abort, false);
                })().catch(fail);
            },

            draftAgain: () => {
                const state = get();
                if (state.phase !== 'ready' && state.phase !== 'error') return;
                if (!canDraftWithAi(state.aiEnabled, state.availability)) return;
                if (state.dirty && !window.confirm(REPLACE_EDITS_PROMPT)) return;
                state.abort?.abort();
                const abort = new AbortController();
                // Keep the session so the model sees its last answer; a click may start a new one if it failed
                let session = state.session;
                if (!session || state.sessionFailed) {
                    destroySession(session);
                    session = newSession();
                }
                set({ session, sessionFailed: false, abort });
                runAi(session, abort, state.source === 'ai').catch(fail);
            },

            toggleTab: id =>
                set(state => {
                    const checked = state.checkedIds.includes(id)
                        ? state.checkedIds.filter(other => other !== id)
                        : [...state.checkedIds, id];
                    // Keep the tab-list order
                    return { checkedIds: state.tabs.map(tab => tab.id).filter(tabId => checked.includes(tabId)) };
                }),

            setTitle: value => set({ title: value.slice(0, TASK_TITLE_MAX), dirty: true }),

            setDescription: value => set({ description: value.slice(0, TASK_DESCRIPTION_MAX), dirty: true }),

            setPriority: priority => set({ priority }),

            setStep: (key, text) =>
                updateSteps(steps =>
                    steps.map(step => (step.key === key ? { ...step, text: text.slice(0, STEP_MAX) } : step))
                ),

            toggleStep: key =>
                updateSteps(steps =>
                    steps.map(step => (step.key === key ? { ...step, included: !step.included } : step))
                ),

            removeStep: key => updateSteps(steps => steps.filter(step => step.key !== key)),

            addStep: () =>
                updateSteps(steps =>
                    steps.length >= MAX_STEPS
                        ? steps
                        : [...steps, { key: generateId('step'), text: '', included: true }]
                ),

            setHint: value => set({ hint: value.slice(0, HINT_MAX) }),

            cancel: () => {
                const state = get();
                state.abort?.abort();
                destroySession(state.session);
                set({ ...RESET });
            },
        },
    };
});

/** Open "New task from tabs"; call synchronously in a click (the model session must start there) */
export const openTaskFromTabs = (tabIds?: number[]) => useTaskDraftStore.getState().actions.open(tabIds);
