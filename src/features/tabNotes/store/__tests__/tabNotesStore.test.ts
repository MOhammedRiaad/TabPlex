import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useBoardStore } from '../../../../store/boardStore';
import { AiError } from '../../../ai/types';
import { POINTS_SYSTEM, extractPointsAi } from '../../utils/aiPoints';
import { COMBINE_SYSTEM, TOPICS_SYSTEM } from '../../utils/aiTopics';
import { sourcesOf } from '../../utils/groupTopics';
import { PageReadFailure, snapshotTab } from '../../utils/readPage';
import { KeyPoint, NoteSource, PageSnapshot, ReadableTab, Topic } from '../../types';
import { TabNotesState, createNoteFromDraft, draftOf, failuresOf, useTabNotesStore } from '../tabNotesStore';

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

type SessionKind = 'points' | 'topics' | 'combine';

const KIND_OF_SYSTEM: Record<string, SessionKind> = {
    [POINTS_SYSTEM]: 'points',
    [TOPICS_SYSTEM]: 'topics',
    [COMBINE_SYSTEM]: 'combine',
};

interface StubOptions {
    /** Holds every session start until the test resolves it */
    createGate?: Promise<void>;
    /** The answers of the topic-names and combine calls. Defaults: no groups, and an answer the checks reject. */
    topicsPrompt?: Prompt;
    combinePrompt?: Prompt;
    /** Makes the session of this kind fail to start (no user activation, no download) */
    failCreate?: SessionKind;
}

const noGroupsPrompt: Prompt = async () => JSON.stringify({ groups: [] });

/**
 * Makes a fake model. Each base session (one per system prompt, as in the run) is created in the click; `clones` holds
 * the clones of the points session, `topicClones` and `combineClones` those of the other two.
 */
function stubModel(prompt: Prompt = answerPrompt, options: StubOptions = {}) {
    const clones: FakeSession[] = [];
    const topicClones: FakeSession[] = [];
    const combineClones: FakeSession[] = [];
    const baseWith = (answer: Prompt, sink: FakeSession[]): FakeSession => ({
        prompt: vi.fn(),
        destroy: vi.fn(),
        clone: vi.fn(async () => {
            const clone: FakeSession = { prompt: vi.fn(answer), destroy: vi.fn() };
            sink.push(clone);
            return clone;
        }),
    });
    const bases: Record<SessionKind, FakeSession> = {
        points: baseWith(prompt, clones),
        topics: baseWith(options.topicsPrompt ?? noGroupsPrompt, topicClones),
        combine: baseWith(options.combinePrompt ?? answerPrompt, combineClones),
    };
    const create = vi.fn(async (createOptions: { initialPrompts: { content: string }[] }) => {
        const kind = KIND_OF_SYSTEM[createOptions.initialPrompts[0].content];
        if (kind === options.failCreate) throw new Error('no user activation');
        await options.createGate;
        return bases[kind];
    });
    vi.stubGlobal('LanguageModel', { create, availability: vi.fn(async () => 'available') });
    return {
        base: bases.points,
        topics: bases.topics,
        combine: bases.combine,
        create,
        clones,
        topicClones,
        combineClones,
    };
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
    it('creates the three base sessions inside the click, before any await, each with its own system prompt', async () => {
        const { create } = stubModel();
        actions().start([readable(1, URL_A)], true);

        expect(create).toHaveBeenCalledTimes(3);
        expect(create.mock.calls.map(call => call[0].initialPrompts[0].content)).toEqual([
            POINTS_SYSTEM,
            TOPICS_SYSTEM,
            COMBINE_SYSTEM,
        ]);
        expect(snapshotTab).not.toHaveBeenCalled();
        expect(state().status).toBe('running');
        expect(state().mode).toBe('ai');
        await runEnded();
    });

    it('creates only the points session for the retry, inside the retry click, before any await', async () => {
        const { create } = stubModel();
        vi.mocked(snapshotTab).mockRejectedValueOnce(new PageReadFailure('closed', 'This tab was closed.'));
        actions().start([readable(1, URL_A)], true);
        await runEnded();
        expect(create).toHaveBeenCalledTimes(3);

        actions().retryTab(1);
        expect(create).toHaveBeenCalledTimes(4);
        expect(create.mock.calls[3][0].initialPrompts[0].content).toBe(POINTS_SYSTEM);
        await runEnded();
    });

    it('reads a run with the model: sources, points, and every session destroyed', async () => {
        const { base, topics, combine, create, clones, combineClones } = stubModel();
        actions().start([readable(1, URL_A), readable(2, URL_B), readable(3, URL_C)], true);
        await runEnded();

        expect(create).toHaveBeenCalledTimes(3);
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
        // Each page works on its own clone, and every clone and the base sessions are destroyed. The three shared
        // points of the pages make one shared topic, which the combine call works on (its answer is rejected here).
        expect(clones).toHaveLength(3);
        expect(combineClones).toHaveLength(1);
        for (const clone of [...clones, ...combineClones]) expect(clone.destroy).toHaveBeenCalledTimes(1);
        expect(base.destroy).toHaveBeenCalledTimes(1);
        expect(topics.destroy).toHaveBeenCalledTimes(1);
        expect(combine.destroy).toHaveBeenCalledTimes(1);
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
        const finishers: (() => void)[] = [];
        const create = vi.fn(
            (options: { monitor: (target: EventTarget) => void }) =>
                new Promise<FakeSession>(resolve => {
                    options.monitor(monitorTarget);
                    finishers.push(() => resolve(base));
                })
        );
        vi.stubGlobal('LanguageModel', { create, availability: vi.fn(async () => 'downloadable') });

        actions().start([readable(1, URL_A)], true);
        monitorTarget.dispatchEvent(Object.assign(new Event('downloadprogress'), { loaded: 0.5 }));

        expect(state().downloadProgress).toBe(0.5);
        expect(state().progress).toBe('Downloading the on-device model…');
        // All three sessions start (the download is the points model's)
        expect(finishers).toHaveLength(3);
        finishers.forEach(finish => finish());
        await runEnded();
        expect(state().downloadProgress).toBeNull();
    });
});

describe('cancelling', () => {
    it('keeps finished sources and marks the rest "not read", not failed', async () => {
        let calls = 0;
        const { base, topics, combine, clones } = stubModel(async (_input, options) => {
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
        expect(topics.destroy).toHaveBeenCalledTimes(1);
        expect(combine.destroy).toHaveBeenCalledTimes(1);
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
        const { base, topics, combine } = stubModel(answerPrompt, { createGate: gate });
        actions().start([readable(1, URL_A)], true);
        actions().cancel();
        await runEnded();

        expect(state().status).toBe('cancelled');
        expect(state().tabs.map(t => t.state)).toEqual(['not-read']);
        expect(snapshotTab).not.toHaveBeenCalled();

        finishCreate();
        await vi.waitFor(() => expect(base.destroy).toHaveBeenCalledTimes(1));
        expect(topics.destroy).toHaveBeenCalledTimes(1);
        expect(combine.destroy).toHaveBeenCalledTimes(1);
    });

    it('closing the dialog ends the run, clears the state and drops late results', async () => {
        const { base, topics, combine } = stubModel(hangPrompt);
        actions().start([readable(1, URL_A)], true);
        await vi.waitFor(() => expect(state().tabs[0]?.state).toBe('reading'));
        actions().close();

        expect(state()).toMatchObject({ status: 'idle', tabs: [], sources: [], points: [], abort: null });
        await vi.waitFor(() => expect(base.destroy).toHaveBeenCalledTimes(1));
        await vi.waitFor(() => expect(topics.destroy).toHaveBeenCalledTimes(1));
        expect(combine.destroy).toHaveBeenCalledTimes(1);
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
        const { base, topics, combine } = stubModel();
        actions().start([readable(1, URL_A), readable(2, URL_B)], true);
        await runEnded();

        expect(state().status).toBe('done');
        expect(state().sources).toEqual([]);
        expect(failuresOf(state().tabs)).toHaveLength(2);
        expect(base.destroy).toHaveBeenCalledTimes(1);
        expect(topics.destroy).toHaveBeenCalledTimes(1);
        expect(combine.destroy).toHaveBeenCalledTimes(1);
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

    it('removing a source takes its points out of every view; the topics keep what is left (no regrouping)', async () => {
        await runTwoSame();
        actions().removeSource(2);

        expect(state().sources.map(s => s.ref)).toEqual([1]);
        expect(state().points.every(point => point.sourceRef === 1)).toBe(true);
        // The shared topic has one source left: it is that source's section, and no topic is shared any more
        expect(state().combined.every(topic => topic.kind === 'source' && topic.sourceRef === 1)).toBe(true);
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

describe('the AI topic names and combining', () => {
    /** Three sentences on different subjects: two of them are on two pages each, so there are two shared topics */
    const TOPIC_X = 'DNS caching stores answers from resolvers for the time given by the TTL field of each record.';
    const TOPIC_Y = 'Sourdough bread rises slowly while wild yeast ferments the dough in a warm kitchen.';
    const TOPIC_Z = 'Bicycle chains need regular oiling to stay quiet and run smoothly on wet roads.';
    const TOPIC_OF: Record<string, string> = {
        [TOPIC_X]: 'DNS caching',
        [TOPIC_Y]: 'Sourdough bread',
        [TOPIC_Z]: 'Bicycle chains',
    };
    const FILLER_ONE = 'The rest of this page is general background that does not repeat the points above at all.';
    const FILLER_TWO = 'It is here only to fill the page, so that the text is long enough to be read as an article.';
    /** Page A (ref 1) has all three subjects, page B (ref 2) the bread, page C (ref 3) the DNS caching */
    const BODIES: Record<string, string[]> = {
        [URL_A]: [TOPIC_X, TOPIC_Y, TOPIC_Z, FILLER_ONE],
        [URL_B]: [TOPIC_Y, FILLER_ONE, FILLER_TWO],
        [URL_C]: [TOPIC_X, FILLER_ONE, FILLER_TWO],
    };

    /** The points answer: every subject sentence on the page, with its topic name */
    const pointsFor: Prompt = async input =>
        JSON.stringify({
            points: [TOPIC_X, TOPIC_Y, TOPIC_Z]
                .filter(text => input.includes(text))
                .map(text => ({ text, topic: TOPIC_OF[text] })),
        });

    /** Merges the first two points of the topic into one statement (their own text), citing both labels */
    const mergeFirstTwo: Prompt = async input => {
        const [first, second] = [...input.matchAll(/^([a-z]+) \(page \d+\): (.*)$/gm)];
        return JSON.stringify({
            heading: 'Shared topic',
            statements: first && second ? [{ text: first[2], from: [first[1], second[1]] }] : [],
        });
    };

    /** Each tab is read as the page for its URL; `failing` makes tab 2 fail to read while it is true */
    function readTopicPages(failing: () => boolean = () => false) {
        vi.mocked(snapshotTab).mockImplementation(async (tab: ReadableTab): Promise<PageSnapshot> => {
            if (tab.id === 2 && failing()) throw new PageReadFailure('closed', 'This tab was closed.');
            return {
                href: tab.url,
                contentType: 'text/html',
                lang: 'en',
                description: '',
                truncated: false,
                blocks: [
                    { kind: 'heading', level: 2, text: 'Topics' },
                    ...(BODIES[tab.url] ?? []).map(text => ({ kind: 'text' as const, text })),
                ],
            };
        });
    }

    const startThree = () =>
        actions().start(
            [readable(1, URL_A, 'Page A'), readable(2, URL_B, 'Page B'), readable(3, URL_C, 'Page C')],
            true
        );
    const sharedTopics = (): Topic[] => state().combined.filter(topic => topic.kind === 'shared');

    it('combines each shared topic, cites both pages in its bullet, and destroys every session and clone', async () => {
        const { base, topics, combine, clones, topicClones, combineClones } = stubModel(pointsFor, {
            combinePrompt: mergeFirstTwo,
        });
        readTopicPages();
        startThree();
        await runEnded();

        expect(state().status).toBe('done');
        expect(sharedTopics().map(topic => topic.combinedBy)).toEqual(['ai', 'ai']);
        const aiBullets = sharedTopics().flatMap(topic => topic.bullets.filter(bullet => bullet.origin === 'ai'));
        expect(aiBullets.map(bullet => bullet.text)).toEqual(expect.arrayContaining([TOPIC_X, TOPIC_Y]));
        expect(aiBullets.map(bullet => sourcesOf(bullet.pointIds, state().points))).toEqual(
            expect.arrayContaining([
                [1, 3],
                [1, 2],
            ])
        );
        // The headings and the bullet ids are unique over the whole review
        const headings = state().combined.map(topic => topic.heading);
        expect(new Set(headings).size).toBe(headings.length);
        expect(headings).toContain('Shared topic (2)');
        const ids = state().combined.flatMap(topic => topic.bullets.map(bullet => bullet.id));
        expect(new Set(ids).size).toBe(ids.length);

        // One topic-names call (three distinct names), one combine call per shared topic
        expect(topicClones).toHaveLength(1);
        expect(combineClones).toHaveLength(2);
        expect(clones).toHaveLength(3);
        for (const session of [...clones, ...topicClones, ...combineClones]) {
            expect(session.destroy).toHaveBeenCalledTimes(1);
        }
        expect(base.destroy).toHaveBeenCalledTimes(1);
        expect(topics.destroy).toHaveBeenCalledTimes(1);
        expect(combine.destroy).toHaveBeenCalledTimes(1);
    });

    it('shows the steps in turn: finding the shared topics, then each topic being combined', async () => {
        const seen: string[] = [];
        stubModel(pointsFor, {
            topicsPrompt: async input => {
                seen.push(state().progress);
                return noGroupsPrompt(input);
            },
            combinePrompt: async input => {
                seen.push(state().progress);
                return mergeFirstTwo(input);
            },
        });
        readTopicPages();
        startThree();
        await runEnded();

        expect(seen).toEqual(['Finding shared topics…', 'Combining topic 1 of 2…', 'Combining topic 2 of 2…']);
    });

    it('a cancel during the combine keeps the word grouping of the topics not combined yet', async () => {
        let calls = 0;
        stubModel(pointsFor, {
            combinePrompt: async (input, options) => {
                calls += 1;
                if (calls === 1) return mergeFirstTwo(input);
                actions().cancel();
                return hang(options?.signal);
            },
        });
        readTopicPages();
        startThree();
        await runEnded();

        expect(state().status).toBe('cancelled');
        expect(sharedTopics().map(topic => topic.combinedBy)).toEqual(['ai', 'words']);
        expect(state().sources.map(source => source.ref)).toEqual([1, 2, 3]);
    });

    it('a cancel during the topic names keeps the word grouping and combines nothing', async () => {
        const { combineClones } = stubModel(pointsFor, {
            topicsPrompt: (_input, options) => {
                actions().cancel();
                return hang(options?.signal);
            },
            combinePrompt: mergeFirstTwo,
        });
        readTopicPages();
        startThree();
        await runEnded();

        expect(state().status).toBe('cancelled');
        expect(sharedTopics().map(topic => topic.combinedBy)).toEqual(['words', 'words']);
        expect(combineClones).toHaveLength(0);
    });

    it.each([
        ['a timeout', new AiError('timeout', 'The on-device model took too long'), 'timeout'],
        ['too many points', new AiError('too-large', 'Too much input'), 'too-large'],
        ['an unusable answer', new Error('model failed'), 'unusable'],
    ] as const)(
        'records why a combine failed (%s) on its topic, which stays word grouping, and combines the next',
        async (_label, failure, note) => {
            stubModel(pointsFor, {
                combinePrompt: async input => {
                    if (input.includes(TOPIC_X)) throw failure;
                    return mergeFirstTwo(input);
                },
            });
            readTopicPages();
            startThree();
            await runEnded();

            const failed = sharedTopics().find(topic => topic.bullets.some(bullet => bullet.text === TOPIC_X));
            expect(failed).toMatchObject({ combinedBy: 'words', combineNote: note });
            const combined = sharedTopics().find(topic => topic.combinedBy === 'ai');
            expect(combined?.combineNote).toBeUndefined();
        }
    );

    it('a failed combine on one topic leaves that topic as word grouping and combines the next', async () => {
        stubModel(pointsFor, {
            combinePrompt: async input => {
                if (input.includes(TOPIC_X)) throw new Error('model failed');
                return mergeFirstTwo(input);
            },
        });
        readTopicPages();
        startThree();
        await runEnded();

        expect(state().status).toBe('done');
        const failed = sharedTopics().find(topic => topic.bullets.some(bullet => bullet.text === TOPIC_X));
        expect(failed?.combinedBy).toBe('words');
        expect(sharedTopics().filter(topic => topic.combinedBy === 'ai')).toHaveLength(1);
    });

    it('a failed topic-names call keeps the word grouping and still combines every shared topic', async () => {
        const { topicClones } = stubModel(pointsFor, {
            topicsPrompt: async () => {
                throw new Error('model failed');
            },
            combinePrompt: mergeFirstTwo,
        });
        readTopicPages();
        startThree();
        await runEnded();

        expect(topicClones).toHaveLength(1);
        expect(sharedTopics().map(topic => topic.combinedBy)).toEqual(['ai', 'ai']);
    });

    it('a points session that cannot start makes a quick view, and the other two sessions are destroyed', async () => {
        const { topics, combine, topicClones, combineClones } = stubModel(pointsFor, {
            failCreate: 'points',
            combinePrompt: mergeFirstTwo,
        });
        readTopicPages();
        startThree();
        await runEnded();

        expect(state().mode).toBe('quick');
        expect(state().modelStatus).toContain('Making a quick view instead.');
        expect(state().sources.map(source => source.quickReason)).toEqual(['no-model', 'no-model', 'no-model']);
        expect(sharedTopics().every(topic => topic.combinedBy === 'words')).toBe(true);
        expect(topicClones).toHaveLength(0);
        expect(combineClones).toHaveLength(0);
        await vi.waitFor(() => expect(topics.destroy).toHaveBeenCalledTimes(1));
        expect(combine.destroy).toHaveBeenCalledTimes(1);
    });

    it('a topic-names session that cannot start keeps the AI points and combines the shared topics', async () => {
        stubModel(pointsFor, { failCreate: 'topics', combinePrompt: mergeFirstTwo });
        readTopicPages();
        startThree();
        await runEnded();

        expect(state().mode).toBe('ai');
        expect(state().modelStatus).toBe('');
        expect(state().sources.map(source => source.mode)).toEqual(['ai', 'ai', 'ai']);
        expect(sharedTopics().map(topic => topic.combinedBy)).toEqual(['ai', 'ai']);
    });

    it('a combine session that cannot start keeps the AI points and the word grouping, with the topic names', async () => {
        const { topicClones } = stubModel(pointsFor, { failCreate: 'combine' });
        readTopicPages();
        startThree();
        await runEnded();

        expect(state().mode).toBe('ai');
        expect(state().sources.map(source => source.mode)).toEqual(['ai', 'ai', 'ai']);
        expect(topicClones).toHaveLength(1);
        expect(sharedTopics().map(topic => topic.combinedBy)).toEqual(['words', 'words']);
    });

    it('with one tab read there is nothing to combine: no topic or combine call, and the sessions are destroyed', async () => {
        const { topics, combine, topicClones, combineClones } = stubModel(pointsFor, { combinePrompt: mergeFirstTwo });
        readTopicPages();
        actions().start([readable(1, URL_A, 'Page A')], true);
        await runEnded();

        expect(state().mode).toBe('ai');
        expect(state().combined).toEqual([]);
        expect(topicClones).toHaveLength(0);
        expect(combineClones).toHaveLength(0);
        expect(topics.destroy).toHaveBeenCalledTimes(1);
        expect(combine.destroy).toHaveBeenCalledTimes(1);
    });

    it('removing a source keeps the AI topics that still have a source, and the removed page leaves them', async () => {
        stubModel(pointsFor, { combinePrompt: mergeFirstTwo });
        readTopicPages();
        startThree();
        await runEnded();
        expect(sharedTopics().map(topic => topic.combinedBy)).toEqual(['ai', 'ai']);
        const bulletsBefore = sharedTopics().flatMap(topic => topic.bullets.map(bullet => bullet.text));

        // Page C leaves: the AI statement of the DNS-like topic (pages A and C) falls back to page A's own points, and
        // the AI statement of the bread topic (pages A and B) is kept as it is
        actions().removeSource(3);

        expect(sharedTopics().map(topic => topic.combinedBy)).toEqual(['ai']);
        expect(sharedTopics()[0].bullets.map(bullet => bullet.text)).toEqual([TOPIC_Y]);
        expect(bulletsBefore).toEqual(expect.arrayContaining([TOPIC_Y]));
        const pageA = state().combined.find(topic => topic.kind === 'source' && topic.sourceRef === 1);
        expect(pageA?.bullets.map(bullet => bullet.text)).toContain(TOPIC_X);
        const cited = state().combined.flatMap(topic => topic.bullets.flatMap(bullet => bullet.pointIds));
        expect(cited.some(id => id.startsWith('p3-'))).toBe(false);
        expect(draftOf(state()).combined?.filter(topic => topic.combinedBy === 'ai')).toHaveLength(1);
    });

    it('a retry regroups by words and calls neither the topic names nor the combine model', async () => {
        let failPageB = true;
        const { create, topicClones, combineClones } = stubModel(pointsFor, { combinePrompt: mergeFirstTwo });
        readTopicPages(() => failPageB);
        startThree();
        await runEnded();

        expect(state().tabs.map(tab => tab.state)).toEqual(['read', 'failed', 'read']);
        expect(sharedTopics().map(topic => topic.combinedBy)).toEqual(['ai']);
        expect(combineClones).toHaveLength(1);

        failPageB = false;
        actions().retryTab(2);
        await runEnded();

        // Only the points session is started for the retry, and no topic or combine call is made
        expect(create).toHaveBeenCalledTimes(4);
        expect(topicClones).toHaveLength(1);
        expect(combineClones).toHaveLength(1);
        expect(sharedTopics().map(topic => topic.combinedBy)).toEqual(['words', 'words']);
    });
});

describe('the Combined edits (spec §9)', () => {
    const sourceOf = (ref: number): NoteSource => ({
        ref,
        tabId: ref,
        windowId: 1,
        title: `Page ${ref}`,
        url: `https://example.com/${ref}`,
        mode: 'ai',
        truncated: false,
        notEnglish: false,
    });
    const POINTS: KeyPoint[] = [
        { id: 'p1-1', sourceRef: 1, text: 'Resolvers keep answers until the TTL runs out.', topicHint: '' },
        { id: 'p1-2', sourceRef: 1, text: 'Negative answers are cached too.', topicHint: '' },
        { id: 'p2-1', sourceRef: 2, text: 'Resolvers keep answers for the TTL.', topicHint: '' },
        { id: 'p2-2', sourceRef: 2, text: 'Subclasses inherit their parent methods.', topicHint: '' },
        { id: 'p3-1', sourceRef: 3, text: 'Clients keep the answers they receive.', topicHint: '' },
        { id: 'p3-2', sourceRef: 3, text: 'Subclasses inherit from their parents.', topicHint: '' },
    ];

    /** Two shared topics: DNS caching (an AI statement from 1, 2 and 3, and a conflict) and Inheritance (word grouped) */
    const TOPICS = (): Topic[] => [
        {
            id: 't1',
            heading: 'DNS caching',
            kind: 'shared',
            combinedBy: 'ai',
            bullets: [
                {
                    id: 'b1',
                    text: 'Resolvers keep each answer until its TTL runs out.',
                    pointIds: ['p1-1', 'p2-1', 'p3-1'],
                    origin: 'ai',
                    edited: false,
                },
                {
                    id: 'b2',
                    text: 'Negative answers are cached too.',
                    pointIds: ['p1-2'],
                    origin: 'point',
                    edited: false,
                },
            ],
            conflicts: [{ pointIds: ['p1-1', 'p3-1'], text: '' }],
        },
        {
            id: 't2',
            heading: 'Inheritance',
            kind: 'shared',
            combinedBy: 'words',
            bullets: [
                {
                    id: 'b3',
                    text: 'Subclasses inherit their parent methods.',
                    pointIds: ['p2-2'],
                    origin: 'point',
                    edited: false,
                },
                {
                    id: 'b4',
                    text: 'Subclasses inherit from their parents.',
                    pointIds: ['p3-2'],
                    origin: 'point',
                    edited: false,
                },
            ],
            conflicts: [],
        },
    ];

    /** A finished run with the Combined view on screen, built from the topics above */
    function seed(overrides: Partial<TabNotesState> = {}) {
        useTabNotesStore.setState({
            status: 'done',
            view: 'combined',
            sources: [sourceOf(1), sourceOf(2), sourceOf(3)],
            points: POINTS,
            combined: TOPICS(),
            combinedEdited: false,
            ...overrides,
        });
    }
    const topicNamed = (heading: string) => state().combined.find(topic => topic.heading === heading);
    const sectionOf = (ref: number) =>
        state().combined.find(topic => topic.kind === 'source' && topic.sourceRef === ref);

    it('renaming a topic sets the cleaned heading, keeps its bullets, and marks the view edited', () => {
        seed();
        actions().renameTopic('t1', '  DNS   caching **basics** ');
        expect(topicNamed('DNS caching basics')?.bullets).toHaveLength(2);
        expect(state().combinedEdited).toBe(true);
    });

    it('renaming a topic to nothing keeps the heading', () => {
        seed();
        actions().renameTopic('t1', '**');
        expect(topicNamed('DNS caching')).toBeDefined();
    });

    it('editing a bullet changes its text and marks it edited, keeping its sources and origin', () => {
        seed();
        actions().editBullet('b2', 'Negative answers are cached for a shorter time.');
        expect(state().combined[0].bullets[1]).toMatchObject({
            text: 'Negative answers are cached for a shorter time.',
            edited: true,
            origin: 'point',
            pointIds: ['p1-2'],
        });
        expect(state().combinedEdited).toBe(true);
    });

    it('an edited bullet keeps its text when its point changes in the By tab', () => {
        seed();
        actions().editBullet('b2', 'Negative answers are cached for a shorter time.');
        actions().editPoint('p1-2', 'Changed in the By tab.');
        expect(draftOf(state()).combined?.[0].bullets[1].text).toBe('Negative answers are cached for a shorter time.');
    });

    it('an unedited point bullet shows its point text as changed in the By tab', () => {
        seed();
        actions().editPoint('p1-2', 'Changed in the By tab.');
        expect(draftOf(state()).combined?.[0].bullets[1].text).toBe('Changed in the By tab.');
    });

    it('removing a bullet leaves its points in the draft, and a topic with no bullets goes', () => {
        seed();
        actions().removeBullet('b2');
        expect(state().combined[0].bullets.map(bullet => bullet.text)).toEqual([
            'Resolvers keep each answer until its TTL runs out.',
        ]);
        expect(state().points).toHaveLength(POINTS.length);

        actions().removeBullet('b3');
        actions().removeBullet('b4');
        expect(topicNamed('Inheritance')).toBeUndefined();
    });

    it('removing a conflict drops only that conflict', () => {
        seed();
        actions().removeConflict('t1', 0);
        expect(state().combined[0].conflicts).toEqual([]);
        expect(state().combined[0].bullets).toHaveLength(2);
    });

    it('moving a bullet to another shared topic keeps its sources and the labels of both topics', () => {
        seed();
        actions().moveBullet('b2', 't2');
        expect(topicNamed('Inheritance')?.bullets.map(bullet => bullet.text)).toContain(
            'Negative answers are cached too.'
        );
        expect(topicNamed('DNS caching')?.bullets.map(bullet => bullet.text)).not.toContain(
            'Negative answers are cached too.'
        );
        expect(topicNamed('DNS caching')?.combinedBy).toBe('ai');
        expect(topicNamed('Inheritance')?.combinedBy).toBe('words');
    });

    it("moving a bullet to Own section puts its points in their sources' sections", () => {
        seed();
        actions().moveBullet('b1', 'own');
        expect(sectionOf(1)?.bullets.map(bullet => bullet.text)).toContain(
            'Resolvers keep answers until the TTL runs out.'
        );
        expect(sectionOf(3)?.bullets.map(bullet => bullet.text)).toContain('Clients keep the answers they receive.');
        expect(
            state()
                .combined.filter(topic => topic.kind === 'shared')
                .map(topic => topic.heading)
        ).toEqual(['Inheritance']);
    });

    it('separating a shared topic by source gives each bullet to its source section and drops its conflicts', () => {
        seed();
        actions().separateTopic('t1');
        expect(topicNamed('DNS caching')).toBeUndefined();
        expect(sectionOf(2)?.bullets.map(bullet => bullet.text)).toContain('Resolvers keep answers for the TTL.');
        expect(state().combined.flatMap(topic => topic.conflicts)).toEqual([]);
    });

    it('removing a topic takes it out of the Combined view and keeps its points in the draft', () => {
        seed();
        actions().removeTopic('t1');
        expect(topicNamed('DNS caching')).toBeUndefined();
        expect(state().points).toHaveLength(POINTS.length);
        expect(state().combinedEdited).toBe(true);
    });

    it('removing a source keeps an edited AI bullet with its text, label and the sources that remain', () => {
        seed();
        actions().editBullet('b1', 'Resolvers keep each answer until its TTL runs out.');
        actions().removeSource(2);
        const dns = topicNamed('DNS caching');
        expect(dns?.combinedBy).toBe('ai');
        expect(dns?.bullets[0]).toMatchObject({
            text: 'Resolvers keep each answer until its TTL runs out.',
            origin: 'ai',
            edited: true,
            pointIds: ['p1-1', 'p3-1'],
        });
    });

    it('removing a source: an unedited AI bullet that lost a point falls back to its remaining points, and the label goes to words', () => {
        seed();
        actions().removeSource(1);
        const dns = topicNamed('DNS caching');
        // No AI bullet is left in the topic, so it is grouped by words now
        expect(dns?.combinedBy).toBe('words');
        expect(dns?.bullets.find(bullet => bullet.pointIds.join() === 'p2-1')).toMatchObject({
            text: 'Resolvers keep answers for the TTL.',
            origin: 'point',
        });
        expect(dns?.bullets.find(bullet => bullet.pointIds.join() === 'p3-1')).toMatchObject({
            text: 'Clients keep the answers they receive.',
            origin: 'point',
        });
    });

    it('removing a source marks the Combined view edited when it is on screen, not when it is the By tab', () => {
        seed({ view: 'byTab' });
        actions().removeSource(3);
        expect(state().combinedEdited).toBe(false);

        seed({ view: 'combined' });
        actions().removeSource(3);
        expect(state().combinedEdited).toBe(true);
    });

    it('removing a point takes it out of the Combined topics without regrouping them', () => {
        seed();
        actions().removePoint('p1-2');
        expect(state().points.map(point => point.id)).not.toContain('p1-2');
        expect(topicNamed('DNS caching')?.bullets.map(bullet => bullet.id)).toEqual(['b1']);
        expect(topicNamed('DNS caching')?.combinedBy).toBe('ai');
    });

    it("keeps each view's edits across a toggle between Combined and By tab", () => {
        seed();
        actions().renameTopic('t1', 'Caching');
        actions().editPoint('p2-2', 'Edited in the By tab.');
        actions().setView('byTab');
        actions().setView('combined');

        expect(topicNamed('Caching')).toBeDefined();
        expect(draftOf(state()).combined?.find(topic => topic.heading === 'Inheritance')?.bullets[0].text).toBe(
            'Edited in the By tab.'
        );
        expect(draftOf({ ...state(), view: 'byTab' }).view).toBe('byTab');
        expect(state().points.find(point => point.id === 'p2-2')?.text).toBe('Edited in the By tab.');
    });

    it('regroups the topics by words, without a model, and clears the edited flag', () => {
        seed({ combinedEdited: true });
        actions().regroupTopics();
        expect(state().combinedEdited).toBe(false);
        expect(state().combined.some(topic => topic.combinedBy === 'ai')).toBe(false);
    });

    it('ignores every Combined edit while a run is going', () => {
        seed({ status: 'running' });
        const before = state().combined;
        actions().renameTopic('t1', 'Changed');
        actions().editBullet('b2', 'Changed');
        actions().removeBullet('b2');
        actions().removeConflict('t1', 0);
        actions().moveBullet('b2', 't2');
        actions().separateTopic('t1');
        actions().removeTopic('t1');
        actions().regroupTopics();
        expect(state().combined).toBe(before);
        expect(state().combinedEdited).toBe(false);
    });
});
