// State for the "Organize tabs" dialog. The trigger (Today quick action, command palette) and the dialog live in
// different components, so the state lives here. See docs/specs/AI_TAB_GROUPING.md §8.
import { create } from 'zustand';
import { useBoardStore } from '../../../store/boardStore';
import { useUIStore } from '../../ui/store/uiStore';
import { AiSession, createSession, fitInput, isAiError, promptJson } from '../../ai/utils/promptApi';
import { currentWindowId, getOrganizableTabs } from '../../ai/utils/collectTabs';
import { ModelAvailability, OrganizableTab } from '../../ai/types';
import {
    ApplyGroupsResponse,
    CreatedGroup,
    GROUP_COLORS,
    GROUP_NAME_MAX,
    MAX_TABS_FOR_AI,
    MIN_TABS_PER_GROUP,
    MIN_TABS_TO_ORGANIZE,
    ORGANIZE_MESSAGES,
} from '../../../utils/organizeTabs';
import { GroupProposal, ProposedGroup } from '../types';
import { ORGANIZE_SYSTEM_PROMPT, buildOrganizeInput, normalizeAiProposal, organizeSchema } from '../utils/aiGrouping';
import { groupBySite } from '../utils/siteGrouping';
import { saveGroupsToBoards } from '../utils/saveToBoards';

export type OrganizePhase = 'closed' | 'loading' | 'preview' | 'applying' | 'done' | 'error';

export const NOTHING_TO_ORGANIZE = 'Nothing to organize: open at least 4 web tabs that aren’t pinned or in a group.';
const DIFFERENT_GROUPING = '\nSuggest a different grouping from your last answer.';

interface OrganizeState {
    phase: OrganizePhase;
    loadingStep: 'reading' | 'downloading' | 'thinking';
    downloadProgress: number | null;
    windowId: number | null;
    /** Organizable tabs read at start, in tab-strip order */
    tabs: OrganizableTab[];
    /** Tabs the model considered (AI path), kept for "Try again" */
    considered: OrganizableTab[];
    proposal: GroupProposal | null;
    dirty: boolean;
    collapseAfter: boolean;
    created: CreatedGroup[];
    skippedTabIds: number[];
    savedToBoards: boolean;
    error: unknown;

    // Latest known environment, set by the always-mounted dialog. Read synchronously in the click handler:
    // createSession must run before any await (user activation).
    aiEnabled: boolean;
    availability: ModelAvailability;

    session: Promise<AiSession> | null;
    abort: AbortController | null;

    actions: {
        setEnvironment(env: { aiEnabled: boolean; availability: ModelAvailability }): void;
        startOrganize(): void;
        retryWithAi(): void;
        useSiteGrouping(): void;
        cancel(): void;
        toggleGroup(key: string): void;
        renameGroup(key: string, name: string): void;
        cycleColor(key: string): void;
        removeTab(key: string, tabId: number): void;
        setCollapseAfter(value: boolean): void;
        apply(): Promise<void>;
        undo(): Promise<void>;
        saveToBoards(): void;
        close(): void;
    };
}

const RESET = {
    phase: 'closed' as OrganizePhase,
    loadingStep: 'reading' as const,
    downloadProgress: null,
    windowId: null,
    tabs: [],
    considered: [],
    proposal: null,
    dirty: false,
    collapseAfter: false,
    created: [],
    skippedTabIds: [],
    savedToBoards: false,
    error: null,
    session: null,
    abort: null,
};

const showToast = (message: string, type: 'success' | 'error' | 'info') =>
    useUIStore.getState().actions.showToast(message, type);

const canUseAi = (aiEnabled: boolean, availability: ModelAvailability) =>
    aiEnabled && (availability === 'available' || availability === 'downloadable' || availability === 'downloading');

const destroySession = (session: Promise<AiSession> | null) => {
    session?.then(s => s.destroy()).catch(() => undefined);
};

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export const useOrganizeStore = create<OrganizeState>((set, get) => {
    /** Run the model over `considered` (already read) and show its proposal */
    const runAi = async (
        session: Promise<AiSession>,
        abort: AbortController,
        considered: OrganizableTab[],
        again: boolean
    ) => {
        set({ loadingStep: 'thinking', downloadProgress: null });
        const ready = await session;
        const { input, used } = await fitInput(ready, considered, buildOrganizeInput, MIN_TABS_TO_ORGANIZE);
        const sent = considered.slice(0, used);
        const omitted = get()
            .tabs.map(t => t.id)
            .filter(id => !sent.some(t => t.id === id));
        const proposal = await promptJson(ready, again ? input + DIFFERENT_GROUPING : input, {
            schema: organizeSchema(sent.length),
            validate: raw => normalizeAiProposal(raw, sent, omitted),
            signal: abort.signal,
        });
        if (abort.signal.aborted) return;
        set({ phase: 'preview', proposal, considered: sent, dirty: false });
    };

    const fail = (error: unknown) => {
        if (isAiError(error, 'aborted') || get().phase === 'closed') return;
        set({ phase: 'error', error });
    };

    /** Start a model session from a click; must be called before any await */
    const newSession = () =>
        createSession(ORGANIZE_SYSTEM_PROMPT, progress =>
            set({ downloadProgress: progress, loadingStep: 'downloading' })
        );

    const updateGroup = (key: string, change: (group: ProposedGroup) => ProposedGroup) => {
        const proposal = get().proposal;
        if (!proposal) return;
        set({
            dirty: true,
            proposal: { ...proposal, groups: proposal.groups.map(g => (g.key === key ? change(g) : g)) },
        });
    };

    return {
        ...RESET,
        aiEnabled: true,
        availability: 'unsupported',

        actions: {
            setEnvironment: env => set(env),

            startOrganize: () => {
                const state = get();
                if (state.phase !== 'closed') return;
                const useAi = canUseAi(state.aiEnabled, state.availability);
                const abort = new AbortController();
                const session = useAi ? newSession() : null;
                session?.catch(() => undefined); // handled where awaited
                set({ ...RESET, phase: 'loading', loadingStep: 'reading', session, abort });

                (async () => {
                    const windowId = await currentWindowId();
                    const tabs = await getOrganizableTabs(windowId);
                    if (abort.signal.aborted) return;
                    if (tabs.length < MIN_TABS_TO_ORGANIZE) {
                        showToast(NOTHING_TO_ORGANIZE, 'info');
                        get().actions.close();
                        return;
                    }
                    set({ windowId: windowId ?? null, tabs });
                    if (!session) {
                        set({ phase: 'preview', proposal: groupBySite(tabs) });
                        return;
                    }
                    await runAi(session, abort, tabs.slice(0, MAX_TABS_FOR_AI), false);
                })().catch(fail);
            },

            retryWithAi: () => {
                const state = get();
                if (state.tabs.length === 0) return;
                if (state.dirty && !window.confirm('Discard your changes and get new suggestions?')) return;
                const again = state.proposal?.source === 'ai';
                destroySession(state.session);
                state.abort?.abort();
                const abort = new AbortController();
                const session = newSession(); // a click: allowed to start the download
                session.catch(() => undefined);
                set({ phase: 'loading', loadingStep: 'thinking', session, abort, error: null });
                const considered = state.considered.length ? state.considered : state.tabs.slice(0, MAX_TABS_FOR_AI);
                runAi(session, abort, considered, again).catch(fail);
            },

            useSiteGrouping: () => {
                const state = get();
                destroySession(state.session);
                state.abort?.abort();
                set({
                    phase: 'preview',
                    proposal: groupBySite(state.tabs),
                    session: null,
                    abort: null,
                    dirty: false,
                    error: null,
                });
            },

            cancel: () => get().actions.close(),

            toggleGroup: key =>
                updateGroup(key, g => (g.tabIds.length < MIN_TABS_PER_GROUP ? g : { ...g, enabled: !g.enabled })),

            renameGroup: (key, name) => updateGroup(key, g => ({ ...g, name: name.slice(0, GROUP_NAME_MAX) })),

            cycleColor: key =>
                updateGroup(key, g => ({
                    ...g,
                    color: GROUP_COLORS[(GROUP_COLORS.indexOf(g.color) + 1) % GROUP_COLORS.length],
                })),

            removeTab: (key, tabId) => {
                const { proposal, tabs } = get();
                if (!proposal) return;
                const group = proposal.groups.find(g => g.key === key);
                if (!group || !group.tabIds.includes(tabId)) return;
                const position = new Map(tabs.map((t, i) => [t.id, i]));
                const ungrouped = [...proposal.ungroupedTabIds, tabId].sort(
                    (a, b) => (position.get(a) ?? 0) - (position.get(b) ?? 0)
                );
                set({
                    dirty: true,
                    proposal: {
                        ...proposal,
                        ungroupedTabIds: ungrouped,
                        groups: proposal.groups.map(g => {
                            if (g.key !== key) return g;
                            const tabIds = g.tabIds.filter(id => id !== tabId);
                            return { ...g, tabIds, enabled: tabIds.length >= MIN_TABS_PER_GROUP && g.enabled };
                        }),
                    },
                });
            },

            setCollapseAfter: value => set({ collapseAfter: value }),

            apply: async () => {
                const { proposal, windowId, collapseAfter } = get();
                if (!proposal || windowId === null) return;
                const groups = proposal.groups
                    .filter(g => g.enabled && g.tabIds.length >= MIN_TABS_PER_GROUP)
                    .map((g, i) => ({ title: g.name.trim() || `Group ${i + 1}`, color: g.color, tabIds: g.tabIds }));
                if (groups.length === 0) return;

                set({ phase: 'applying' });
                try {
                    const response = (await chrome.runtime.sendMessage({
                        type: ORGANIZE_MESSAGES.APPLY,
                        payload: { windowId, groups, collapsed: collapseAfter },
                    })) as ApplyGroupsResponse | undefined;
                    if (!response) throw new Error('The background service did not respond');
                    if (response.error) throw new Error(response.error);
                    set({
                        phase: 'done',
                        created: response.created ?? [],
                        skippedTabIds: response.skippedTabIds ?? [],
                    });
                } catch (error) {
                    showToast(`Couldn't create groups: ${(error as Error).message}`, 'error');
                    set({ phase: 'preview' });
                }
            },

            undo: async () => {
                const { created } = get();
                try {
                    await chrome.runtime.sendMessage({
                        type: ORGANIZE_MESSAGES.UNDO,
                        payload: { groupIds: created.map(g => g.groupId) },
                    });
                    showToast(`Removed ${plural(created.length, 'group')}`, 'info');
                } catch (error) {
                    showToast(`Couldn't undo: ${(error as Error).message}`, 'error');
                }
                get().actions.close();
            },

            saveToBoards: () => {
                const { created, tabs, savedToBoards } = get();
                if (savedToBoards || created.length === 0) return;
                const tabsById = Object.fromEntries(tabs.map(t => [t.id, t]));
                const result = saveGroupsToBoards(created, tabsById, useBoardStore.getState());
                set({ savedToBoards: true });
                showToast(
                    `Saved ${plural(result.folderCount, 'folder')} with ${plural(result.tabCount, 'tab')} to Boards`,
                    'success'
                );
            },

            close: () => {
                const { session, abort } = get();
                abort?.abort();
                destroySession(session);
                set({ ...RESET });
            },
        },
    };
});

export const useOrganizeActions = () => useOrganizeStore(s => s.actions);

/** Start from a click (Today quick action, command palette) */
export const startOrganize = () => useOrganizeStore.getState().actions.startOrganize();
