import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useBoardStore } from '../../../../store/boardStore';
import { AiError } from '../../../ai/types';
import { extractPointsAi } from '../../utils/aiPoints';
import { PageReadFailure, snapshotTab } from '../../utils/readPage';
import { PageSnapshot, ReadableTab } from '../../types';
import { createNoteFromDraft, draftOf, failuresOf, useTabNotesStore } from '../tabNotesStore';

vi.mock('../../utils/readPage', async importOriginal => {
    const actual = await importOriginal<typeof import('../../utils/readPage')>();
    return { ...actual, snapshotTab: vi.fn() };
});

vi.mock('../../utils/aiPoints', async importOriginal => {
    const actual = await importOriginal<typeof import('../../utils/aiPoints')>();
    return { ...actual, extractPointsAi: vi.fn(actual.extractPointsAi) };
});

const DATE = new Date(2026, 9, 24);

const BODY = [
    'DNS caching stores answers from resolvers for the time given by the TTL field of each record.',
    'Negative answers are cached as well, for a shorter time that the zone sets in its SOA record.',
    'Clients usually keep the answer they receive until the cache entry expires and is removed.',
];
/** A grounded point the model "returns" for every page (an exact sentence of the page) */
const POINT_TEXT = BODY[0];

type Prompt = (input: string, options?: { signal?: AbortSignal }) => Promise<string>;

interface FakeSession {
    prompt: ReturnType<typeof vi.fn>;
    destroy: ReturnType<typeof vi.fn>;
    clone?: ReturnType<typeof vi.fn>;
}

const state = () => useTabNotesStore.getState();
const actions = () => state().actions;

const URL_A = 'https://example.com/a';
const URL_B = 'https://example.com/b_(two)';
const URL_C = 'https://example.org/c';

const readable = (id: number, url: string, title = `Tab ${id}`): ReadableTab => ({
    id,
    windowId: 1,
    title,
    url,
    originPattern: 'https://*/*',
    readable: true,
});

const snapshotOf = (tab: ReadableTab): PageSnapshot => ({
    href: tab.url,
    contentType: 'text/html',
    lang: 'en',
    description: '',
    truncated: false,
    blocks: [{ kind: 'heading', level: 2, text: 'Caching' }, ...BODY.map(text => ({ kind: 'text' as const, text }))],
});

const answer = () => JSON.stringify({ points: [{ text: POINT_TEXT, topic: 'DNS caching' }] });

const answerPrompt: Prompt = async () => answer();

/** Never answers, and rejects with an AbortError as soon as the call's signal is aborted (also if already aborted) */
const hangPrompt: Prompt = (_input, options) => hang(options?.signal);

function hang<T = string>(signal?: AbortSignal): Promise<T> {
    return new Promise<T>((_resolve, reject) => {
        const fail = () => reject(new DOMException('Aborted', 'AbortError'));
        if (signal?.aborted) fail();
        else signal?.addEventListener('abort', fail, { once: true });
    });
}

/** Makes a fake model: the base session is created in the click, and each page gets a clone that runs `prompt` */
function stubModel(prompt: Prompt = answerPrompt, createGate?: Promise<void>) {
    const clones: FakeSession[] = [];
    const base: FakeSession = {
        prompt: vi.fn(),
        destroy: vi.fn(),
        clone: vi.fn(async () => {
            const clone: FakeSession = { prompt: vi.fn(prompt), destroy: vi.fn() };
            clones.push(clone);
            return clone;
        }),
    };
    const create = vi.fn(async () => {
        await createGate;
        return base;
    });
    vi.stubGlobal('LanguageModel', { create, availability: vi.fn(async () => 'available') });
    return { base, create, clones };
}

/** Waits until the run has ended (done or cancelled) */
const runEnded = () => vi.waitFor(() => expect(state().status).not.toBe('running'));

/** Reads resolve with the page of the tab, unless `failures` says otherwise for that tab id */
function readPages(failures: Record<number, () => Error> = {}) {
    vi.mocked(snapshotTab).mockImplementation(async (tab: ReadableTab) => {
        const failure = failures[tab.id];
        if (failure) throw failure();
        return snapshotOf(tab);
    });
}

beforeEach(() => {
    vi.mocked(extractPointsAi).mockClear();
    readPages();
});

afterEach(() => {
    actions().close();
    vi.unstubAllGlobals();
    vi.mocked(snapshotTab).mockReset();
});

describe('starting a run', () => {
    it('creates the model session inside the click, before any await', async () => {
        const { create } = stubModel();
        actions().start([readable(1, URL_A)], true);

        expect(create).toHaveBeenCalledTimes(1);
        expect(snapshotTab).not.toHaveBeenCalled();
        expect(state().status).toBe('running');
        expect(state().mode).toBe('ai');
        await runEnded();
    });

    it('creates the retry session inside the retry click, before any await', async () => {
        const { create } = stubModel();
        vi.mocked(snapshotTab).mockRejectedValueOnce(new PageReadFailure('closed', 'This tab was closed.'));
        actions().start([readable(1, URL_A)], true);
        await runEnded();
        expect(create).toHaveBeenCalledTimes(1);

        actions().retryTab(1);
        expect(create).toHaveBeenCalledTimes(2);
        await runEnded();
    });

    it('reads a run with the model: sources, points, and every session destroyed', async () => {
        const { base, create, clones } = stubModel();
        actions().start([readable(1, URL_A), readable(2, URL_B), readable(3, URL_C)], true);
        await runEnded();

        expect(create).toHaveBeenCalledTimes(1);
        expect(state().status).toBe('done');
        expect(state().sources.map(s => [s.ref, s.tabId, s.mode])).toEqual([
            [1, 1, 'ai'],
            [2, 2, 'ai'],
            [3, 3, 'ai'],
        ]);
        expect(state().points.map(p => [p.id, p.sourceRef, p.text])).toEqual([
            ['p1-1', 1, POINT_TEXT],
            ['p2-1', 2, POINT_TEXT],
            ['p3-1', 3, POINT_TEXT],
        ]);
        expect(state().tabs.map(t => t.state)).toEqual(['read', 'read', 'read']);
        // Each page works on its own clone, and every clone and the base are destroyed
        expect(clones).toHaveLength(3);
        for (const clone of clones) expect(clone.destroy).toHaveBeenCalledTimes(1);
        expect(base.destroy).toHaveBeenCalledTimes(1);
        expect(state().progress).toBe('');
        expect(state().abort).toBeNull();
    });

    it('reads in tab-strip order, with refs 1..n that never change', async () => {
        stubModel();
        actions().start([readable(7, URL_A), readable(3, URL_B)], true);
        await runEnded();

        expect(state().tabs.map(t => [t.ref, t.tab.id])).toEqual([
            [1, 7],
            [2, 3],
        ]);
        expect(snapshotTab).toHaveBeenNthCalledWith(1, expect.objectContaining({ id: 7 }), expect.any(AbortSignal));
        expect(snapshotTab).toHaveBeenNthCalledWith(2, expect.objectContaining({ id: 3 }), expect.any(AbortSignal));
    });

    it('reads with the quick view only when AI is not asked for: no session, mode quick', async () => {
        const { create } = stubModel();
        actions().start([readable(1, URL_A)], false);
        await runEnded();

        expect(create).not.toHaveBeenCalled();
        expect(state().mode).toBe('quick');
        expect(state().sources[0]).toMatchObject({ ref: 1, mode: 'quick' });
        expect(state().points.length).toBeGreaterThan(0);
        expect(state().points.every(p => p.sourceRef === 1)).toBe(true);
    });

    it('goes to the quick view with the reason when the session cannot start', async () => {
        vi.stubGlobal('LanguageModel', {
            create: vi.fn(() => Promise.reject(new Error('no user activation'))),
            availability: vi.fn(async () => 'downloadable'),
        });
        actions().start([readable(1, URL_A), readable(2, URL_B)], true);
        await runEnded();

        expect(state().mode).toBe('quick');
        expect(state().modelStatus).toBe(
            "Your browser couldn't download the on-device AI model. Try again later. Making a quick view instead."
        );
        expect(state().sources.map(s => s.mode)).toEqual(['quick', 'quick']);
        expect(state().status).toBe('done');
    });

    it('goes to the quick view with the reason when the browser has no built-in AI', async () => {
        actions().start([readable(1, URL_A)], true);
        await runEnded();

        expect(state().mode).toBe('quick');
        expect(state().modelStatus).toContain("This browser doesn't have built-in AI");
        expect(state().sources[0].mode).toBe('quick');
    });

    it('copies the reason of a failed page onto its source, and keeps the other sources AI', async () => {
        let calls = 0;
        stubModel(async () => {
            calls += 1;
            if (calls === 1) throw new AiError('timeout', 'The on-device model took too long');
            return answer();
        });
        actions().start([readable(1, URL_A), readable(2, URL_B)], true);
        await runEnded();

        expect(state().sources.map(s => [s.ref, s.mode, s.quickReason])).toEqual([
            [1, 'quick', 'timeout'],
            [2, 'ai', undefined],
        ]);
        expect(state().sources[1]).not.toHaveProperty('quickReason');
    });

    it('gives every source the no-model reason when the model could not start', async () => {
        vi.stubGlobal('LanguageModel', {
            create: vi.fn(() => Promise.reject(new Error('no user activation'))),
            availability: vi.fn(async () => 'downloadable'),
        });
        actions().start([readable(1, URL_A), readable(2, URL_B)], true);
        await runEnded();

        expect(state().sources.map(s => s.quickReason)).toEqual(['no-model', 'no-model']);
    });

    it('sets no reason on a quick view the user chose', async () => {
        stubModel();
        actions().start([readable(1, URL_A)], false);
        await runEnded();

        expect(state().sources[0]).toMatchObject({ mode: 'quick' });
        expect(state().sources[0]).not.toHaveProperty('quickReason');
    });

    it('ignores a second start while a run is going', async () => {
        stubModel(hangPrompt);
        actions().start([readable(1, URL_A)], true);
        actions().start([readable(2, URL_B)], true);

        expect(state().tabs.map(t => t.tab.id)).toEqual([1]);
        actions().cancel();
        await runEnded();
    });

    it('shows the model download while the model starts', async () => {
        const monitorTarget = new EventTarget();
        const base: FakeSession = { prompt: vi.fn(), destroy: vi.fn(), clone: vi.fn() };
        let finish: () => void = () => undefined;
        const create = vi.fn(
            (options: { monitor: (target: EventTarget) => void }) =>
                new Promise<FakeSession>(resolve => {
                    options.monitor(monitorTarget);
                    finish = () => resolve(base);
                })
        );
        vi.stubGlobal('LanguageModel', { create, availability: vi.fn(async () => 'downloadable') });

        actions().start([readable(1, URL_A)], true);
        monitorTarget.dispatchEvent(Object.assign(new Event('downloadprogress'), { loaded: 0.5 }));

        expect(state().downloadProgress).toBe(0.5);
        expect(state().progress).toBe('Downloading the on-device model…');
        finish();
        await runEnded();
        expect(state().downloadProgress).toBeNull();
    });
});

describe('cancelling', () => {
    it('keeps finished sources and marks the rest "not read", not failed', async () => {
        let calls = 0;
        const { base, clones } = stubModel(async (_input, options) => {
            calls += 1;
            if (calls === 1) return answer();
            actions().cancel();
            return hang(options?.signal);
        });
        actions().start([readable(1, URL_A), readable(2, URL_B), readable(3, URL_C)], true);
        await runEnded();

        expect(state().status).toBe('cancelled');
        expect(state().sources.map(s => s.ref)).toEqual([1]);
        expect(state().points.map(p => p.sourceRef)).toEqual([1]);
        expect(state().tabs.map(t => t.state)).toEqual(['read', 'not-read', 'not-read']);
        expect(failuresOf(state().tabs)).toEqual([]);
        expect(base.destroy).toHaveBeenCalledTimes(1);
        for (const clone of clones) expect(clone.destroy).toHaveBeenCalledTimes(1);
    });

    it('stops at the page being read: its read is abandoned and the tab is not read', async () => {
        vi.mocked(snapshotTab).mockImplementation(async (tab, signal) => {
            if (tab.id === 2) {
                actions().cancel();
                return hang<PageSnapshot>(signal);
            }
            return snapshotOf(tab);
        });
        stubModel();
        actions().start([readable(1, URL_A), readable(2, URL_B), readable(3, URL_C)], false);
        await runEnded();

        expect(state().status).toBe('cancelled');
        expect(state().tabs.map(t => t.state)).toEqual(['read', 'not-read', 'not-read']);
        expect(snapshotTab).toHaveBeenCalledTimes(2);
    });

    it('does not wait for a model that is still starting, and destroys it when it arrives', async () => {
        let finishCreate: () => void = () => undefined;
        const gate = new Promise<void>(resolve => {
            finishCreate = resolve;
        });
        const { base } = stubModel(answerPrompt, gate);
        actions().start([readable(1, URL_A)], true);
        actions().cancel();
        await runEnded();

        expect(state().status).toBe('cancelled');
        expect(state().tabs.map(t => t.state)).toEqual(['not-read']);
        expect(snapshotTab).not.toHaveBeenCalled();

        finishCreate();
        await vi.waitFor(() => expect(base.destroy).toHaveBeenCalledTimes(1));
    });

    it('closing the dialog ends the run, clears the state and drops late results', async () => {
        const { base } = stubModel(hangPrompt);
        actions().start([readable(1, URL_A)], true);
        await vi.waitFor(() => expect(state().tabs[0]?.state).toBe('reading'));
        actions().close();

        expect(state()).toMatchObject({ status: 'idle', tabs: [], sources: [], points: [], abort: null });
        await vi.waitFor(() => expect(base.destroy).toHaveBeenCalledTimes(1));
        expect(state()).toMatchObject({ status: 'idle', sources: [], points: [] });
    });

    it('a cancel with nothing running does nothing', () => {
        actions().cancel();
        expect(state().status).toBe('idle');
    });
});

describe('failures and retries', () => {
    it('marks only the failed tab, with its message, and retries only that tab', async () => {
        readPages({ 2: () => new PageReadFailure('closed', 'This tab was closed.') });
        actions().start([readable(1, URL_A), readable(2, URL_B), readable(3, URL_C)], false);
        await runEnded();

        expect(state().tabs.map(t => t.state)).toEqual(['read', 'failed', 'read']);
        expect(failuresOf(state().tabs).map(t => [t.ref, t.message])).toEqual([[2, 'This tab was closed.']]);
        expect(state().sources.map(s => s.ref)).toEqual([1, 3]);

        // The tab can be read now: a retry reads that tab only
        readPages();
        vi.mocked(snapshotTab).mockClear();
        actions().retryTab(2);
        await runEnded();

        expect(snapshotTab).toHaveBeenCalledTimes(1);
        expect(vi.mocked(snapshotTab).mock.calls[0][0].id).toBe(2);
        expect(state().tabs.map(t => t.state)).toEqual(['read', 'read', 'read']);
        expect(state().sources.map(s => s.ref)).toEqual([1, 2, 3]);
        expect(state().points.filter(p => p.sourceRef === 2).length).toBeGreaterThan(0);
        expect(failuresOf(state().tabs)).toEqual([]);
    });

    it('turns an unexpected error into a generic failure of that tab only', async () => {
        readPages({ 1: () => new Error('boom') });
        actions().start([readable(1, URL_A), readable(2, URL_B)], false);
        await runEnded();

        expect(state().tabs.map(t => [t.state, t.message])).toEqual([
            ['failed', 'This page could not be read.'],
            ['read', ''],
        ]);
    });

    it('marks a tab failed when its AI step fails with an AiError', async () => {
        vi.mocked(extractPointsAi).mockRejectedValueOnce(new AiError('bad-output', 'not JSON'));
        stubModel();
        actions().start([readable(1, URL_A), readable(2, URL_B)], true);
        await runEnded();

        expect(state().tabs.map(t => t.state)).toEqual(['failed', 'read']);
        expect(state().tabs[0].message).toBe("The on-device AI gave an answer TabPlex couldn't use. Try again.");
        expect(state().sources.map(s => s.ref)).toEqual([2]);
    });

    it('destroys the session when every tab fails', async () => {
        readPages({
            1: () => new PageReadFailure('no-access', "TabPlex doesn't have access to this site."),
            2: () => new PageReadFailure('pdf', "Can't read PDFs yet."),
        });
        const { base } = stubModel();
        actions().start([readable(1, URL_A), readable(2, URL_B)], true);
        await runEnded();

        expect(state().status).toBe('done');
        expect(state().sources).toEqual([]);
        expect(failuresOf(state().tabs)).toHaveLength(2);
        expect(base.destroy).toHaveBeenCalledTimes(1);
    });

    it('retry does nothing for a tab that is not failed, for an unknown tab, or while a run is going', async () => {
        stubModel(hangPrompt);
        actions().start([readable(1, URL_A)], true);
        await vi.waitFor(() => expect(state().tabs[0]?.state).toBe('reading'));
        actions().retryTab(1);
        expect(snapshotTab).toHaveBeenCalledTimes(1);
        actions().cancel();
        await runEnded();

        actions().retryTab(1); // not failed: 'not-read'
        actions().retryTab(99); // not picked
        expect(snapshotTab).toHaveBeenCalledTimes(1);
    });

    it('a cancelled retry keeps the tab failed with its reason', async () => {
        readPages({ 1: () => new PageReadFailure('timeout', 'This page took too long to read.') });
        actions().start([readable(1, URL_A)], false);
        await runEnded();

        vi.mocked(snapshotTab).mockImplementation(async (_tab, signal) => {
            actions().cancel();
            return hang<PageSnapshot>(signal);
        });
        actions().retryTab(1);
        await runEnded();

        expect(state().tabs[0]).toMatchObject({ state: 'failed', message: 'This page took too long to read.' });
    });
});

describe('the note', () => {
    it('gives the draft of the sources and points as read, in the By tab layout when that is chosen', async () => {
        stubModel();
        actions().start([readable(1, URL_A, 'First page'), readable(2, URL_C, 'Second page')], true);
        await runEnded();

        actions().setView('byTab');
        const draft = draftOf(state());
        expect(draft.view).toBe('byTab');
        expect(draft.sources.map(s => s.title)).toEqual(['First page', 'Second page']);
        expect(draft.points).toHaveLength(2);
    });

    it('creates a tagged Markdown note through the board store', async () => {
        stubModel();
        actions().start([readable(1, URL_A, 'First page')], true);
        await runEnded();

        const before = useBoardStore.getState().notes.length;
        const id = createNoteFromDraft(draftOf(state()), { tags: ['study'], date: DATE });
        const notes = useBoardStore.getState().notes;

        expect(notes).toHaveLength(before + 1);
        const note = notes.find(n => n.id === id);
        expect(id).toMatch(/^note_/);
        expect(note).toMatchObject({
            title: 'Study notes · 24 Oct 2026',
            format: 'markdown',
            tags: ['study'],
        });
        expect(note?.content).toContain('## First page ([1](https://example.com/a))');
        expect(note?.content).toContain('- [1] [First page](https://example.com/a) · example.com');
    });
});

describe('the grouping into topics', () => {
    /** Two tabs whose only point is the same sentence: one shared topic, one bullet that cites both */
    async function runTwoSame() {
        stubModel();
        actions().start([readable(1, URL_A, 'First page'), readable(2, URL_C, 'Second page')], true);
        await runEnded();
    }

    it('groups the points after the run, and the Combined view is the default', async () => {
        await runTwoSame();
        expect(state().view).toBe('combined');
        expect(state().combined.length).toBeGreaterThan(0);
        expect(state().combined[0].kind).toBe('shared');
        expect(draftOf(state()).view).toBe('combined');
    });

    it('shows the By tab when there is nothing to combine, even if Combined is chosen (one tab)', async () => {
        stubModel();
        actions().start([readable(1, URL_A, 'First page')], true);
        await runEnded();
        actions().setView('combined');
        expect(state().combined).toEqual([]);
        expect(draftOf(state()).view).toBe('byTab');
    });

    it('keeps the By tab choice of the user, and switches back when the topics come back', async () => {
        await runTwoSame();
        actions().setView('byTab');
        expect(draftOf(state()).view).toBe('byTab');
        actions().setView('combined');
        expect(draftOf(state()).view).toBe('combined');
    });

    it('a failed tab is left out of the grouping until its retry succeeds', async () => {
        stubModel();
        readPages({ 2: () => new Error('boom') });
        actions().start([readable(1, URL_A, 'First page'), readable(2, URL_C, 'Second page')], true);
        await runEnded();
        expect(state().combined).toEqual([]);

        readPages();
        actions().retryTab(2);
        await runEnded();
        expect(state().sources.map(s => s.ref)).toEqual([1, 2]);
        expect(state().combined.length).toBeGreaterThan(0);
        expect(draftOf(state()).view).toBe('combined');
    });

    it('removing a source takes its points out of every view and regroups', async () => {
        await runTwoSame();
        actions().removeSource(2);

        expect(state().sources.map(s => s.ref)).toEqual([1]);
        expect(state().points.every(point => point.sourceRef === 1)).toBe(true);
        expect(state().combined).toEqual([]);
        expect(draftOf(state())).toMatchObject({ view: 'byTab', sources: [expect.objectContaining({ ref: 1 })] });
    });

    it('removing a point takes it out of the topics too', async () => {
        await runTwoSame();
        const pointId = state().combined[0].bullets[0].pointIds[0];
        actions().removePoint(pointId);

        expect(state().points.map(point => point.id)).not.toContain(pointId);
        const cited = state().combined.flatMap(topic => topic.bullets.flatMap(bullet => bullet.pointIds));
        expect(cited).not.toContain(pointId);
    });

    it('an edited point shows its new text in the Combined draft, and the grouping does not move', async () => {
        await runTwoSame();
        const before = state().combined.map(topic => topic.bullets.map(bullet => bullet.pointIds));
        const pointId = state().combined[0].bullets[0].pointIds[0];

        actions().editPoint(pointId, 'Edited: resolvers cache answers for the TTL.');

        expect(draftOf(state()).combined?.[0].bullets[0].text).toBe('Edited: resolvers cache answers for the TTL.');
        expect(state().combined.map(topic => topic.bullets.map(bullet => bullet.pointIds))).toEqual(before);
    });
});
