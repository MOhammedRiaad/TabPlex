import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    NO_TABS_FOR_TASK,
    REPLACE_EDITS_PROMPT,
    openTaskFromTabs,
    tabsChangedSinceDraft,
    useTaskDraftStore,
} from '../taskDraftStore';
import { useUIStore } from '../../../ui/store/uiStore';
import { ModelAvailability } from '../../../ai/types';
import { aiErrorMessage } from '../../../ai/utils/promptApi';

const state = () => useTaskDraftStore.getState();
const actions = () => state().actions;
const toast = () => useUIStore.getState().toast?.message;

const EXAMPLE = {
    title: 'Compare Stripe and Paddle pricing',
    description: 'Decide which payment provider to use, focusing on fees and VAT handling.',
    priority: 'high',
    steps: ['Compare transaction fees', 'Check VAT handling for EU', 'Write up a recommendation'],
};

async function openTabs(urls: string[]) {
    const ids: number[] = [];
    for (const url of urls) ids.push((await chrome.tabs.create({ url })).id!);
    return ids;
}

const three = () => openTabs(['https://stripe.com/pricing', 'https://paddle.com/pricing', 'https://youtube.com/watch']);

function stubModel(prompt = vi.fn().mockResolvedValue(JSON.stringify(EXAMPLE))) {
    const session = { prompt, destroy: vi.fn() };
    const create = vi.fn().mockResolvedValue(session);
    vi.stubGlobal('LanguageModel', { create, availability: vi.fn().mockResolvedValue('available') });
    return { create, session, prompt };
}

const env = (aiEnabled: boolean, availability: ModelAvailability) =>
    actions().setEnvironment({ aiEnabled, availability });

const settle = () => vi.waitFor(() => expect(['ready', 'error', 'closed']).toContain(state().phase));

describe('task draft store', () => {
    beforeEach(() => {
        actions().cancel();
        useUIStore.setState({ toast: null });
    });
    afterEach(() => vi.unstubAllGlobals());

    it('1: creates the model session synchronously in the click', async () => {
        await three();
        const { create } = stubModel();
        env(true, 'downloadable');
        openTaskFromTabs();
        expect(create).toHaveBeenCalledTimes(1); // before any await
        expect(state().phase).toBe('drafting');
        await settle();
    });

    it('2: without web tabs: toast, closed, session destroyed', async () => {
        await openTabs(['chrome://settings/']);
        const { session } = stubModel();
        env(true, 'available');
        openTaskFromTabs();
        await vi.waitFor(() => expect(toast()).toBe(NO_TABS_FOR_TASK));
        expect(state().phase).toBe('closed');
        await vi.waitFor(() => expect(session.destroy).toHaveBeenCalled());
    });

    it('3: AI path fills the fields from the model', async () => {
        const ids = await three();
        const { prompt } = stubModel();
        env(true, 'available');
        openTaskFromTabs();
        await settle();
        expect(state()).toMatchObject({
            phase: 'ready',
            source: 'ai',
            title: EXAMPLE.title,
            description: EXAMPLE.description,
            priority: 'high',
            checkedIds: ids,
            draftedIds: ids,
            dirty: false,
            trimmedTo: null,
        });
        expect(state().steps.map(s => s.text)).toEqual(EXAMPLE.steps);
        expect(state().steps.every(s => s.included && s.key.startsWith('step'))).toBe(true);
        expect(new Set(state().steps.map(s => s.key)).size).toBe(3);
        expect(prompt.mock.calls[0][0]).toContain('(stripe.com/pricing)');
    });

    it('4: with AI off, shows the fallback draft at once and never creates a session', async () => {
        await openTabs(['https://docs.test/a', 'https://docs.test/b']);
        const { create } = stubModel();
        env(false, 'available');
        openTaskFromTabs();
        expect(state().phase).toBe('ready');
        await vi.waitFor(() => expect(state().title).toBe('Research docs.test'));
        expect(create).not.toHaveBeenCalled();
        expect(state().source).toBe('fallback');
    });

    it('5: when the model fails twice: error with the fallback draft still in the fields', async () => {
        await openTabs(['https://docs.test/a', 'https://docs.test/b']);
        stubModel(vi.fn().mockResolvedValue('not json'));
        env(true, 'available');
        openTaskFromTabs();
        await settle();
        expect(state().phase).toBe('error');
        expect(state().title).toBe('Research docs.test');
        expect(aiErrorMessage(state().error)).toBe("The on-device AI gave an answer TabPlex couldn't use. Try again.");
    });

    it('6: open(ids) uses those tabs: grouped ones in, closed ids and pinned tabs out', async () => {
        const [a, b] = await openTabs(['https://a.dev', 'https://b.dev']);
        await chrome.tabs.group({ tabIds: [a, b] });
        const pinned = await chrome.tabs.create({ url: 'https://p.dev', pinned: true } as chrome.tabs.CreateProperties);
        env(false, 'unsupported');
        openTaskFromTabs([b, 9999, a, pinned.id!]);
        await vi.waitFor(() => expect(state().tabs.map(t => t.id)).toEqual([b, a]));
    });

    it('7: toggling tabs keeps list order and shows "tabs changed"', async () => {
        const ids = await three();
        env(false, 'unsupported');
        openTaskFromTabs();
        await vi.waitFor(() => expect(state().tabs).toHaveLength(3));
        expect(tabsChangedSinceDraft(state())).toBe(false);
        actions().toggleTab(ids[0]);
        expect(state().checkedIds).toEqual([ids[1], ids[2]]);
        expect(tabsChangedSinceDraft(state())).toBe(true);
        actions().toggleTab(ids[0]);
        expect(state().checkedIds).toEqual(ids);
        expect(tabsChangedSinceDraft(state())).toBe(false);
    });

    it('8: Draft again asks before replacing edits, then sends the hint and asks for a different draft', async () => {
        const ids = await three();
        const { prompt, create } = stubModel();
        env(true, 'available');
        openTaskFromTabs();
        await settle();
        actions().setTitle('My own title');
        const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);

        actions().draftAgain();
        expect(confirm).toHaveBeenCalledWith(REPLACE_EDITS_PROMPT);
        expect(prompt).toHaveBeenCalledTimes(1);
        expect(state().title).toBe('My own title');

        confirm.mockReturnValue(true);
        actions().setHint('for the Q4 launch');
        actions().toggleTab(ids[2]);
        actions().draftAgain();
        await settle();
        const input = prompt.mock.calls[1][0] as string;
        expect(input).toContain('Their hint: for the Q4 launch');
        expect(input).toContain('Write a different draft');
        expect(input).not.toContain('youtube');
        expect(state()).toMatchObject({ title: EXAMPLE.title, dirty: false, draftedIds: [ids[0], ids[1]] });
        expect(create).toHaveBeenCalledTimes(1); // the session is reused
    });

    it('Draft again starts a new session when the first one failed', async () => {
        await three();
        const { create, prompt } = stubModel();
        create.mockRejectedValueOnce(new Error('download failed'));
        env(true, 'downloadable');
        openTaskFromTabs();
        await settle();
        expect(state().phase).toBe('error');
        await vi.waitFor(() => expect(state().sessionFailed).toBe(true));

        actions().draftAgain();
        expect(create).toHaveBeenCalledTimes(2);
        await settle();
        expect(state().phase).toBe('ready');
        expect(prompt.mock.calls[0][0]).not.toContain('Write a different draft'); // nothing AI-made yet
    });

    it('Draft again does nothing without AI or while drafting', async () => {
        await three();
        const { prompt } = stubModel();
        env(false, 'available');
        openTaskFromTabs();
        await settle();
        actions().draftAgain();
        expect(prompt).not.toHaveBeenCalled();
    });

    it('9: cancel aborts and destroys the session', async () => {
        await three();
        let release: (value: string) => void = () => undefined;
        const { session } = stubModel(vi.fn(() => new Promise<string>(resolve => (release = resolve))));
        env(true, 'available');
        openTaskFromTabs();
        await vi.waitFor(() => expect(session.prompt).toHaveBeenCalled());
        actions().cancel();
        expect(state().phase).toBe('closed');
        await vi.waitFor(() => expect(session.destroy).toHaveBeenCalled());
        release(JSON.stringify(EXAMPLE));
        await new Promise(r => setTimeout(r, 0));
        expect(state().phase).toBe('closed');
    });

    it('ignores a second open while one is in progress', async () => {
        await three();
        const { create } = stubModel();
        env(true, 'available');
        openTaskFromTabs();
        openTaskFromTabs();
        expect(create).toHaveBeenCalledTimes(1);
        await settle();
    });

    it('notes when the draft used only the first tabs', async () => {
        await openTabs(Array.from({ length: 35 }, (_, i) => `https://site${i}.dev/page`));
        stubModel();
        env(true, 'available');
        openTaskFromTabs();
        await settle();
        expect(state().trimmedTo).toBe(30);
    });

    it('drafts nothing when every tab is unchecked', async () => {
        const ids = await three();
        const { prompt } = stubModel();
        env(true, 'available');
        openTaskFromTabs();
        await settle();
        ids.forEach(id => actions().toggleTab(id));
        actions().draftAgain();
        expect(state().phase).toBe('ready');
        expect(prompt).toHaveBeenCalledTimes(1);
    });

    it('edits fields within their limits and tracks edits', async () => {
        await three();
        env(false, 'unsupported');
        openTaskFromTabs();
        await vi.waitFor(() => expect(state().tabs).toHaveLength(3));

        actions().setDescription('d'.repeat(400));
        expect(state().description).toHaveLength(280);
        expect(state().dirty).toBe(true);
        actions().setTitle('t'.repeat(100));
        expect(state().title).toHaveLength(80);
        actions().setPriority('low');
        actions().setHint('h'.repeat(200));
        expect(state()).toMatchObject({ priority: 'low', hint: 'h'.repeat(120) });

        for (let i = 0; i < 6; i++) actions().addStep();
        expect(state().steps).toHaveLength(5);
        const [first, second] = state().steps;
        actions().setStep(first.key, 's'.repeat(100));
        actions().toggleStep(second.key);
        actions().removeStep(state().steps[4].key);
        expect(state().steps).toHaveLength(4);
        expect(state().steps[0].text).toHaveLength(80);
        expect(state().steps[1].included).toBe(false);
    });
});
