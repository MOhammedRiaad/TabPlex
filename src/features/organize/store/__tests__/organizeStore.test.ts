import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NOTHING_TO_ORGANIZE, startOrganize, useOrganizeStore } from '../organizeStore';
import { useUIStore } from '../../../ui/store/uiStore';
import { useBoardStore } from '../../../../store/boardStore';
import { FakeTab, fakeChrome, respondToMessages } from '../../../../test/chromeMock';
import { ModelAvailability } from '../../../ai/types';
import { GroupProposal } from '../../types';
import { ORGANIZE_MESSAGES } from '../../../../utils/organizeTabs';

const state = () => useOrganizeStore.getState();
const actions = () => state().actions;
const toast = () => useUIStore.getState().toast?.message;

const AI_ANSWER = JSON.stringify({
    groups: [
        { name: 'Pricing Research', color: 'red', tabs: [1, 2] },
        { name: 'React Hooks', color: 'blue', tabs: [3, 5] },
        { name: 'Lisbon Trip', color: 'green', tabs: [4, 6] },
    ],
});

/** Open tabs in the fake browser */
async function openTabs(urls: string[]) {
    const ids: number[] = [];
    for (const url of urls) ids.push((await chrome.tabs.create({ url })).id!);
    return ids;
}

const six = () =>
    openTabs([
        'https://stripe.com/pricing',
        'https://paddle.com/pricing',
        'https://react.dev/a',
        'https://google.com/flights',
        'https://react.dev/b',
        'https://booking.com/lisbon',
    ]);

function stubModel(prompt = vi.fn().mockResolvedValue(AI_ANSWER)) {
    const session = { prompt, destroy: vi.fn() };
    const create = vi.fn().mockResolvedValue(session);
    vi.stubGlobal('LanguageModel', { create, availability: vi.fn().mockResolvedValue('available') });
    return { create, session, prompt };
}

function env(aiEnabled: boolean, availability: ModelAvailability) {
    actions().setEnvironment({ aiEnabled, availability });
}

const settle = () => vi.waitFor(() => expect(['preview', 'error', 'closed', 'done']).toContain(state().phase));

describe('organize store', () => {
    beforeEach(() => {
        actions().close();
        useUIStore.setState({ toast: null });
        useBoardStore.setState({ boards: [], folders: [], tabs: [] });
    });
    afterEach(() => vi.unstubAllGlobals());

    it('creates the model session synchronously in the click (user activation)', async () => {
        await six();
        const { create } = stubModel();
        env(true, 'downloadable');
        startOrganize();
        expect(create).toHaveBeenCalledTimes(1); // before any await
        expect(state().phase).toBe('loading');
        await settle();
    });

    it('needs at least 4 tabs: toast, closed, session destroyed', async () => {
        await openTabs(['https://a.dev', 'https://b.dev']);
        const { session } = stubModel();
        env(true, 'available');
        startOrganize();
        await vi.waitFor(() => expect(toast()).toBe(NOTHING_TO_ORGANIZE));
        expect(state().phase).toBe('closed');
        await vi.waitFor(() => expect(session.destroy).toHaveBeenCalled());
    });

    it('AI path: shows the suggested groups with browser tab ids', async () => {
        const ids = await six();
        const { prompt } = stubModel();
        env(true, 'available');
        startOrganize();
        await settle();
        expect(state().phase).toBe('preview');
        expect(state().proposal!.source).toBe('ai');
        expect(state().proposal!.groups.map(g => [g.name, g.tabIds])).toEqual([
            ['Pricing Research', [ids[0], ids[1]]],
            ['React Hooks', [ids[2], ids[4]]],
            ['Lisbon Trip', [ids[3], ids[5]]],
        ]);
        expect(prompt.mock.calls[0][0]).toContain('Group these 6 tabs.');
        expect(state().loadingStep).toBe('thinking');
    });

    it.each([
        [false, 'available'],
        [true, 'unsupported'],
        [true, 'unavailable'],
    ] as const)('site path when AI is %s / %s', async (aiEnabled, availability) => {
        await six();
        const { create } = stubModel();
        env(aiEnabled, availability);
        startOrganize();
        await settle();
        expect(create).not.toHaveBeenCalled();
        expect(state().proposal!.source).toBe('site');
        expect(state().proposal!.groups.map(g => g.name)).toEqual(['react.dev']);
    });

    it('shows an error after two unusable answers, then can group by site', async () => {
        await six();
        stubModel(vi.fn().mockResolvedValue('not json'));
        env(true, 'available');
        startOrganize();
        await settle();
        expect(state().phase).toBe('error');
        actions().useSiteGrouping();
        expect(state()).toMatchObject({ phase: 'preview', session: null, error: null });
        expect(state().proposal!.source).toBe('site');
    });

    it('cancel while thinking: aborts, destroys the session, no error afterwards', async () => {
        await six();
        let release!: (v: string) => void;
        const { session } = stubModel(vi.fn(() => new Promise<string>(r => (release = r))));
        env(true, 'available');
        startOrganize();
        await vi.waitFor(() => expect(state().loadingStep).toBe('thinking'));
        actions().cancel();
        expect(state().phase).toBe('closed');
        release(AI_ANSWER);
        await vi.waitFor(() => expect(session.destroy).toHaveBeenCalled());
        await new Promise(r => setTimeout(r, 0));
        expect(state().phase).toBe('closed');
    });

    it('ignores a second start while open', async () => {
        await six();
        env(false, 'unsupported');
        startOrganize();
        startOrganize();
        await settle();
        expect(state().phase).toBe('preview');
    });

    describe('preview edits', () => {
        beforeEach(async () => {
            await six();
            stubModel();
            env(true, 'available');
            startOrganize();
            await settle();
        });

        it('removes a tab to "not grouped" in tab order; a group under 2 tabs is disabled for good', () => {
            const [first] = state().proposal!.groups;
            actions().removeTab('g1', first.tabIds[1]);
            actions().removeTab('g1', 9999); // not in the group: ignored
            actions().removeTab('nope', first.tabIds[0]);
            const g1 = state().proposal!.groups[0];
            expect(g1).toMatchObject({ tabIds: [first.tabIds[0]], enabled: false });
            expect(state().proposal!.ungroupedTabIds).toEqual([first.tabIds[1]]);
            actions().toggleGroup('g1');
            expect(state().proposal!.groups[0].enabled).toBe(false);
            expect(state().dirty).toBe(true);
        });

        it('toggles, renames (cut to 24) and cycles colours, wrapping from grey to blue', () => {
            actions().toggleGroup('g2');
            expect(state().proposal!.groups[1].enabled).toBe(false);
            actions().renameGroup('g2', 'y'.repeat(30));
            expect(state().proposal!.groups[1].name).toHaveLength(24);
            useOrganizeStore.setState({
                proposal: {
                    ...state().proposal!,
                    groups: state().proposal!.groups.map(g => ({ ...g, color: 'grey' })),
                },
            });
            actions().cycleColor('g1');
            expect(state().proposal!.groups[0].color).toBe('blue');
            actions().setCollapseAfter(true);
            expect(state().collapseAfter).toBe(true);
        });

        it('applies only enabled groups with 2+ tabs, trimmed names, and the collapse flag', async () => {
            const sent = respondToMessages(m =>
                m.type === ORGANIZE_MESSAGES.APPLY
                    ? {
                          success: true,
                          created: [{ groupId: 7, title: 'A', color: 'red', tabIds: [1, 2] }],
                          skippedTabIds: [9],
                      }
                    : undefined
            );
            actions().toggleGroup('g3');
            actions().renameGroup('g1', '   ');
            actions().setCollapseAfter(true);
            await actions().apply();
            const payload = sent.find(m => m.type === ORGANIZE_MESSAGES.APPLY).payload;
            expect(payload.collapsed).toBe(true);
            expect(payload.groups.map((g: { title: string }) => g.title)).toEqual(['Group 1', 'React Hooks']);
            expect(state()).toMatchObject({ phase: 'done', skippedTabIds: [9] });
            expect(state().created).toHaveLength(1);
        });

        it('stays in preview with a toast when the background fails', async () => {
            respondToMessages(m => (m.type === ORGANIZE_MESSAGES.APPLY ? { error: 'window closed' } : undefined));
            await actions().apply();
            expect(state().phase).toBe('preview');
            expect(toast()).toBe("Couldn't create groups: window closed");
        });

        it('does nothing to apply when every group is off', async () => {
            const sent = respondToMessages();
            ['g1', 'g2', 'g3'].forEach(k => actions().toggleGroup(k));
            await actions().apply();
            expect(sent).toEqual([]);
            expect(state().phase).toBe('preview');
        });

        it('try again: confirms before discarding edits and asks for a different grouping', async () => {
            const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
            const { create, prompt } = stubModel();
            actions().renameGroup('g1', 'Mine');
            actions().retryWithAi();
            expect(create).not.toHaveBeenCalled();

            confirm.mockReturnValue(true);
            actions().retryWithAi();
            expect(create).toHaveBeenCalledTimes(1); // synchronously, in the click
            await settle();
            expect(prompt.mock.calls[0][0]).toContain('Suggest a different grouping');
            expect(state().proposal!.groups[0].name).toBe('Pricing Research');
        });
    });

    describe('guards and fallbacks', () => {
        const organizable = (n: number) =>
            Array.from({ length: n }, (_, i) => ({
                id: i + 1,
                windowId: 1,
                title: `Tab ${i + 1}`,
                url: `https://t${i + 1}.dev`,
            }));
        const proposalOf = (groups: GroupProposal['groups'], ungroupedTabIds: number[] = []): GroupProposal => ({
            source: 'site',
            groups,
            ungroupedTabIds,
            omittedTabIds: [],
        });
        const group = (tabIds: number[], enabled = true): GroupProposal['groups'][number] => ({
            key: 'g1',
            name: 'Group',
            color: 'blue',
            tabIds,
            enabled,
        });

        it('stays closed, without an error, when reading the tabs fails after closing', async () => {
            env(false, 'unsupported');
            let rejectQuery!: (reason: Error) => void;
            fakeChrome().tabs.query.mockImplementationOnce(
                () => new Promise<FakeTab[]>((_resolve, reject) => (rejectQuery = reject))
            );
            startOrganize();
            await vi.waitFor(() => expect(rejectQuery).toBeDefined());

            actions().close();
            rejectQuery(new Error('window gone'));
            await new Promise(r => setTimeout(r, 0));

            expect(state()).toMatchObject({ phase: 'closed', error: null });
        });

        it('keeps the tab list empty when closed while the tabs are being read', async () => {
            env(false, 'unsupported');
            let resolveQuery!: (tabs: FakeTab[]) => void;
            fakeChrome().tabs.query.mockImplementationOnce(
                () => new Promise<FakeTab[]>(resolve => (resolveQuery = resolve))
            );
            startOrganize();
            await vi.waitFor(() => expect(resolveQuery).toBeDefined());

            actions().close();
            resolveQuery([]);
            await new Promise(r => setTimeout(r, 0));

            expect(state()).toMatchObject({ phase: 'closed', tabs: [], proposal: null });
        });

        it('ignores group edits when there is no proposal', () => {
            actions().toggleGroup('g1');
            actions().renameGroup('g1', 'Name');
            actions().removeTab('g1', 1);

            expect(state().proposal).toBeNull();
            expect(state().dirty).toBe(false);
        });

        it('does nothing on "try again" when no tabs were read', () => {
            const confirm = vi.spyOn(window, 'confirm');
            const { create } = stubModel();

            actions().retryWithAi();

            expect(create).not.toHaveBeenCalled();
            expect(confirm).not.toHaveBeenCalled();
            expect(state().phase).toBe('closed');
        });

        it('asks the model about the first tabs when "try again" follows a site grouping', async () => {
            await six();
            const { prompt } = stubModel();
            env(false, 'unsupported');
            startOrganize();
            await settle();
            expect(state().considered).toEqual([]);

            actions().retryWithAi();
            await settle();

            expect(prompt.mock.calls[0][0]).toContain('Group these 6 tabs.');
            expect(prompt.mock.calls[0][0]).not.toContain('Suggest a different grouping');
            expect(state().proposal!.source).toBe('ai');
        });

        it('puts a removed tab among the ungrouped ones in tab order', () => {
            useOrganizeStore.setState({
                phase: 'preview',
                tabs: organizable(6),
                proposal: proposalOf([group([1, 2, 3])], [4]),
            });

            actions().removeTab('g1', 2);

            expect(state().proposal!.ungroupedTabIds).toEqual([2, 4]);
        });

        it('sorts ungrouped tabs it does not know before known ones', () => {
            useOrganizeStore.setState({
                phase: 'preview',
                tabs: organizable(6),
                proposal: proposalOf([group([1, 2, 3])], [98, 99]),
            });

            actions().removeTab('g1', 2);

            expect(state().proposal!.ungroupedTabIds).toEqual([98, 99, 2]);
        });

        it('keeps a group enabled, or disabled, when it still has enough tabs after a removal', () => {
            useOrganizeStore.setState({
                phase: 'preview',
                tabs: organizable(6),
                proposal: proposalOf([group([1, 2, 3])]),
            });
            actions().removeTab('g1', 3);
            expect(state().proposal!.groups[0]).toMatchObject({ tabIds: [1, 2], enabled: true });

            useOrganizeStore.setState({ proposal: proposalOf([group([1, 2, 3], false)]) });
            actions().removeTab('g1', 3);
            expect(state().proposal!.groups[0]).toMatchObject({ tabIds: [1, 2], enabled: false });
        });

        it('sends nothing to apply without a proposal or a window', async () => {
            const sent = respondToMessages();

            await actions().apply();
            useOrganizeStore.setState({ phase: 'preview', windowId: null, proposal: proposalOf([group([1, 2])]) });
            await actions().apply();

            expect(sent).toEqual([]);
            expect(state().phase).toBe('preview');
        });

        it('reports a background that does not answer', async () => {
            respondToMessages(() => undefined);
            useOrganizeStore.setState({ phase: 'preview', windowId: 1, proposal: proposalOf([group([1, 2])]) });

            await actions().apply();

            expect(toast()).toBe("Couldn't create groups: The background service did not respond");
            expect(state().phase).toBe('preview');
        });

        it('treats a reply without created or skipped tabs as empty lists', async () => {
            respondToMessages(m => (m.type === ORGANIZE_MESSAGES.APPLY ? { success: true } : undefined));
            useOrganizeStore.setState({ phase: 'preview', windowId: 1, proposal: proposalOf([group([1, 2])]) });

            await actions().apply();

            expect(state()).toMatchObject({ phase: 'done', created: [], skippedTabIds: [] });
        });
    });

    it('undo sends the created group ids, toasts and closes', async () => {
        const sent = respondToMessages(m =>
            m.type === ORGANIZE_MESSAGES.UNDO ? { success: true, ungroupedTabs: 4 } : undefined
        );
        useOrganizeStore.setState({
            phase: 'done',
            created: [
                { groupId: 1, title: 'A', color: 'red', tabIds: [1, 2] },
                { groupId: 2, title: 'B', color: 'blue', tabIds: [3, 4] },
            ],
        });
        await actions().undo();
        expect(sent.find(m => m.type === ORGANIZE_MESSAGES.UNDO).payload).toEqual({ groupIds: [1, 2] });
        expect(toast()).toBe('Removed 2 groups');
        expect(state().phase).toBe('closed');
    });

    it('saves the created groups to Boards once', () => {
        useOrganizeStore.setState({
            phase: 'done',
            tabs: [
                { id: 1, windowId: 1, title: 'One', url: 'https://one.dev' },
                { id: 2, windowId: 1, title: 'Two', url: 'https://two.dev' },
            ],
            created: [{ groupId: 1, title: 'Pair', color: 'green', tabIds: [1, 2] }],
        });
        actions().saveToBoards();
        actions().saveToBoards();
        expect(state().savedToBoards).toBe(true);
        expect(useBoardStore.getState().folders.map(f => f.name)).toEqual(['Pair']);
        expect(useBoardStore.getState().tabs.map(t => t.title)).toEqual(['One', 'Two']);
        expect(toast()).toBe('Saved 1 folder with 2 tabs to Boards');
    });
});
