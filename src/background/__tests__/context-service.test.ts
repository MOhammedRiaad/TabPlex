import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installChromeMock, ChromeMock, EXTENSION_BASE } from '../../test/chromeMock';
import { makeContext, makeTask } from '../../test/factories';
import { Task } from '../../types';
import {
    ACTIVE_CONTEXT_KEY,
    BACKGROUND_TASKS_KEY,
    CONTEXT_MESSAGES,
    ContextResponse,
    PARK_RESUME_SETTINGS_KEY,
} from '../../utils/taskContext';

type Service = typeof import('../context-service');

let mock: ChromeMock;
let service: Service;

const storedTasks = () => (mock.browser.store[BACKGROUND_TASKS_KEY] as Task[]) ?? [];
const storedTask = (id = 'task_1') => storedTasks().find(t => t.id === id)!;
const activeId = () => mock.browser.store[ACTIVE_CONTEXT_KEY];

function send(type: string, payload?: unknown): Promise<ContextResponse> {
    return new Promise(resolve => {
        const keepOpen = service.handleContextMessage({ type, payload }, resolve);
        expect(keepOpen).toBe(true);
    });
}

async function seed(...tasks: Task[]) {
    await chrome.storage.local.set({ [BACKGROUND_TASKS_KEY]: tasks });
}

/** Let busy-guard timers and debounces run */
const settle = (ms = 400) => vi.advanceTimersByTimeAsync(ms);

describe('context-service', () => {
    beforeEach(async () => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
        vi.setSystemTime(new Date('2026-10-03T12:00:00Z'));
        mock = installChromeMock();
        vi.resetModules();
        service = await import('../context-service');
        vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
    });

    afterEach(() => vi.useRealTimers());

    it('exposes the message types it handles', () => {
        expect(service.CONTEXT_MESSAGE_TYPES).toContain(CONTEXT_MESSAGES.START);
        expect(service.CONTEXT_MESSAGE_TYPES).toContain(CONTEXT_MESSAGES.SET_SUMMARY);
    });

    describe('start / resume', () => {
        it('opens saved tabs in a styled group and marks the task active', async () => {
            const task = makeTask({ priority: 'high', context: makeContext({ state: 'parked' }) });
            const res = await send(CONTEXT_MESSAGES.RESUME, { task, windowId: 1 });

            expect(res.success).toBe(true);
            const ctx = res.task!.context!;
            expect(ctx).toMatchObject({ state: 'active', windowId: 1, resumeCount: 1 });
            expect(ctx.events!.slice(-1)[0]).toMatchObject({ type: 'resume', tabCount: 2 });
            expect(res.task!.status).toBe('doing');

            const group = mock.browser.groups.get(ctx.chromeGroupId!)!;
            expect(group).toMatchObject({ title: 'Write pricing page', color: 'red', collapsed: false });
            expect(mock.browser.groupTabs(group.id).map(t => t.url)).toEqual([
                'https://a.example/',
                'https://b.example/',
            ]);
            expect(activeId()).toBe(task.id);
            expect(storedTask().context!.state).toBe('active');
        });

        it('starts a task without tabs (no group yet) and keeps a non-todo status', async () => {
            const res = await send(CONTEXT_MESSAGES.START, { task: makeTask({ status: 'done' }) });
            expect(res.task!.context).toMatchObject({ state: 'active', chromeGroupId: null, resumeCount: 0 });
            expect(res.task!.status).toBe('done');
            expect(res.task!.context!.events![0].type).toBe('start');
        });

        it('falls back to the last focused window when the hinted one is gone', async () => {
            const res = await send(CONTEXT_MESSAGES.START, {
                task: makeTask({ context: makeContext() }),
                windowId: 999,
            });
            expect(res.task!.context!.windowId).toBe(1);
        });

        it('focuses the existing group when the task is already active', async () => {
            const first = await send(CONTEXT_MESSAGES.START, { task: makeTask({ context: makeContext() }) });
            const tabCount = mock.browser.tabs.size;
            const again = await send(CONTEXT_MESSAGES.RESUME, { task: first.task });
            expect(again.task!.context!.chromeGroupId).toBe(first.task!.context!.chromeGroupId);
            expect(mock.browser.tabs.size).toBe(tabCount);
            expect(chrome.tabs.update).toHaveBeenCalledWith(expect.any(Number), { active: true });
            expect(chrome.windows.update).toHaveBeenCalledWith(1, { focused: true });
        });

        it('auto-parks the previously active task', async () => {
            const a = (await send(CONTEXT_MESSAGES.START, { task: makeTask({ id: 'a', context: makeContext() }) }))
                .task!;
            await seed(a, makeTask({ id: 'b' }));
            const res = await send(CONTEXT_MESSAGES.START, { task: makeTask({ id: 'b' }) });

            expect(res.autoParked).toMatchObject({ id: 'a' });
            expect(res.autoParked!.context!.state).toBe('parked');
            expect(res.autoParked!.context!.events!.slice(-1)[0]).toMatchObject({
                type: 'park',
                auto: true,
                closedTabs: 2,
            });
            expect([...mock.browser.tabs.values()].filter(t => t.url?.startsWith('https://a.example'))).toEqual([]);
            expect(activeId()).toBe('b');
        });

        it('clears a stale active id that points at a non-active task', async () => {
            await seed(makeTask({ id: 'stale', context: makeContext({ state: 'parked' }) }));
            await chrome.storage.local.set({ [ACTIVE_CONTEXT_KEY]: 'stale' });
            const res = await send(CONTEXT_MESSAGES.START, { task: makeTask({ id: 'new' }) });
            expect(res.autoParked).toBeUndefined();
            expect(activeId()).toBe('new');
        });

        it('merges with the stored copy: newer fields win, stored context always wins', async () => {
            const stored = makeTask({ title: 'Stored', updatedAt: '2026-10-03T13:00:00Z', context: makeContext() });
            await seed(stored);
            const fromUi = makeTask({ title: 'Stale UI', updatedAt: '2026-10-03T11:00:00Z', context: undefined });
            const res = await send(CONTEXT_MESSAGES.START, { task: fromUi });
            expect(res.task!.title).toBe('Stored');
            expect(res.task!.context!.tabs).toHaveLength(2);
        });
    });

    describe('park', () => {
        async function startWithTabs() {
            mock.browser.addTab({ url: `${EXTENSION_BASE}index.html` }); // TabPlex itself stays open
            return (await send(CONTEXT_MESSAGES.START, { task: makeTask({ context: makeContext() }) })).task!;
        }

        it('snapshots the live group, closes tabs and records the park', async () => {
            const task = await startWithTabs();
            const extra = await chrome.tabs.create({ url: 'https://c.example/' });
            await chrome.tabs.group({ groupId: task.context!.chromeGroupId!, tabIds: extra.id! });

            const res = await send(CONTEXT_MESSAGES.PARK, { task, note: '  stopped at VAT  ' });
            const ctx = res.task!.context!;
            expect(ctx).toMatchObject({
                state: 'parked',
                chromeGroupId: null,
                resumeNote: 'stopped at VAT',
                parkCount: 1,
            });
            expect(ctx.parkedAt).toBe('2026-10-03T12:00:00.000Z');
            expect(ctx.tabs.map(t => t.url)).toEqual([
                'https://a.example/',
                'https://b.example/',
                'https://c.example/',
            ]);
            expect(ctx.events!.slice(-1)[0]).toMatchObject({ type: 'park', tabCount: 3, closedTabs: 3 });
            expect([...mock.browser.tabs.values()].map(t => t.url)).toEqual([`${EXTENSION_BASE}index.html`]);
            expect(activeId()).toBeUndefined();
        });

        it('keeps chosen tabs open, detached from the task', async () => {
            const task = await startWithTabs();
            const res = await send(CONTEXT_MESSAGES.PARK, { task, keepOpenUrls: ['https://b.example/'] });
            expect(res.task!.context!.tabs.map(t => t.url)).toEqual(['https://a.example/']);
            const left = [...mock.browser.tabs.values()].find(t => t.url === 'https://b.example/')!;
            expect(left.groupId).toBe(-1);
        });

        it('ungroups instead of closing when asked', async () => {
            const task = await startWithTabs();
            await chrome.storage.local.set({ [PARK_RESUME_SETTINGS_KEY]: { closeTabsOnPark: false } });
            await send(CONTEXT_MESSAGES.PARK, { task });
            const web = [...mock.browser.tabs.values()].filter(t => t.url?.startsWith('https'));
            expect(web).toHaveLength(2);
            expect(web.every(t => t.groupId === -1)).toBe(true);
        });

        it('opens a TabPlex tab first so closing the last tabs never closes the window', async () => {
            const task = (await send(CONTEXT_MESSAGES.START, { task: makeTask({ context: makeContext() }) })).task!;
            await send(CONTEXT_MESSAGES.PARK, { task, closeTabs: true });
            expect([...mock.browser.tabs.values()].map(t => t.url)).toEqual([`${EXTENSION_BASE}index.html`]);
        });

        describe('Create & park (task not active, explicit tabs)', () => {
            /** An idle task whose context holds the two open tabs a and b, as attachTabs leaves it */
            async function idleWithOpenTabs() {
                mock.browser.addTab({ url: `${EXTENSION_BASE}index.html` });
                const a = mock.browser.addTab({ url: 'https://a.example/' });
                const b = mock.browser.addTab({ url: 'https://b.example/' });
                const other = mock.browser.addTab({ url: 'https://other.example/' });
                const task = makeTask({ context: makeContext({ state: 'idle' }) });
                await seed(task);
                return { task, a, b, other };
            }

            it('closes the given tabs that belong to the task and parks it', async () => {
                const { task, a, b, other } = await idleWithOpenTabs();
                const res = await send(CONTEXT_MESSAGES.PARK, {
                    task,
                    closeTabs: true,
                    chromeTabIds: [a.id, b.id, other.id, 9999],
                });
                expect(res.task!.context).toMatchObject({ state: 'parked', parkCount: 1 });
                expect(res.task!.context!.tabs.map(t => t.url)).toEqual(['https://a.example/', 'https://b.example/']);
                expect(res.task!.context!.events!.slice(-1)[0]).toMatchObject({ type: 'park', closedTabs: 2 });
                // other.example isn't saved in the task: never closed
                expect([...mock.browser.tabs.values()].map(t => t.url)).toEqual([
                    `${EXTENSION_BASE}index.html`,
                    'https://other.example/',
                ]);
            });

            it('opens a TabPlex tab when the tabs were the last ones in their window', async () => {
                const a = mock.browser.addTab({ url: 'https://a.example/' });
                const b = mock.browser.addTab({ url: 'https://b.example/' });
                const task = makeTask({ context: makeContext({ state: 'idle' }) });
                await send(CONTEXT_MESSAGES.PARK, { task, closeTabs: true, chromeTabIds: [a.id, b.id] });
                expect([...mock.browser.tabs.values()].map(t => t.url)).toEqual([`${EXTENSION_BASE}index.html`]);
            });

            it('keeps the tabs open when closeTabs is off, and ignores the ids for an active task', async () => {
                const { task, a } = await idleWithOpenTabs();
                await send(CONTEXT_MESSAGES.PARK, { task, closeTabs: false, chromeTabIds: [a.id] });
                expect(mock.browser.tabs.has(a.id)).toBe(true);

                const active = await startWithTabs();
                const loose = mock.browser.addTab({ url: 'https://a.example/' }); // same URL, outside the group
                await send(CONTEXT_MESSAGES.PARK, { task: active, closeTabs: true, chromeTabIds: [loose.id] });
                expect(mock.browser.tabs.has(loose.id)).toBe(true);
            });
        });

        it('keeps the saved tabs and note when the group is gone', async () => {
            const task = makeTask({
                context: makeContext({ state: 'active', chromeGroupId: 12345, resumeNote: 'old note' }),
            });
            const res = await send(CONTEXT_MESSAGES.PARK, { task });
            expect(res.task!.context).toMatchObject({ state: 'parked', resumeNote: 'old note' });
            expect(res.task!.context!.tabs).toHaveLength(2);

            const cleared = await send(CONTEXT_MESSAGES.PARK, { task: res.task, note: '   ' });
            expect(cleared.task!.context!.resumeNote).toBeUndefined();
        });

        it('never wipes a saved context with an empty live group', async () => {
            const task = await startWithTabs();
            const groupId = task.context!.chromeGroupId!;
            // Replace the group's web tabs with a new-tab page
            const blank = await chrome.tabs.create({ url: 'chrome://newtab/' });
            await chrome.tabs.group({ groupId, tabIds: blank.id! });
            const webIds = mock.browser
                .groupTabs(groupId)
                .filter(t => t.url?.startsWith('https'))
                .map(t => t.id);
            await chrome.tabs.ungroup(webIds as [number, ...number[]]);
            const res = await send(CONTEXT_MESSAGES.PARK, { task });
            expect(res.task!.context!.tabs).toHaveLength(2);
        });

        it('logs but survives tab errors while closing', async () => {
            const task = await startWithTabs();
            vi.mocked(chrome.tabs.remove).mockRejectedValueOnce(new Error('tab gone'));
            const res = await send(CONTEXT_MESSAGES.PARK, { task });
            expect(res.task!.context!.state).toBe('parked');
            expect(console.warn).toHaveBeenCalledWith('Park: could not close/ungroup some tabs', expect.any(Error));
        });

        it('parks the active task on request, or does nothing', async () => {
            expect(await send(CONTEXT_MESSAGES.PARK_ACTIVE)).toEqual({ success: true });
            await startWithTabs();
            const res = await send(CONTEXT_MESSAGES.PARK_ACTIVE);
            expect(res.task!.context!.state).toBe('parked');
        });
    });

    describe('add / remove tabs', () => {
        beforeEach(() => {
            mock.browser.addTab({ url: 'https://one.dev/' });
            mock.browser.addTab({ url: 'https://two.dev/' });
            mock.browser.addTab({ url: 'https://one.dev/' }); // duplicate
            mock.browser.addTab({ url: 'https://pinned.dev/', pinned: true });
            mock.browser.addTab({ url: `${EXTENSION_BASE}index.html` });
            mock.browser.addTab({ url: 'chrome://settings/' });
            const other = mock.browser.addTab({ url: 'https://other-group.dev/' });
            mock.browser.addGroup({ tabIds: [other.id], title: 'Other' });
        });

        it('adds capturable tabs of the window to an idle task', async () => {
            const res = await send(CONTEXT_MESSAGES.ADD_TABS, { task: makeTask(), windowId: 1 });
            expect(res.task!.context!.tabs.map(t => t.url)).toEqual(['https://one.dev/', 'https://two.dev/']);
            expect(res.task!.context!.state).toBe('idle');
        });

        it('adds specific tabs and dedupes against saved ones', async () => {
            const two = [...mock.browser.tabs.values()].find(t => t.url === 'https://two.dev/')!;
            const task = makeTask({ context: makeContext({ tabs: [{ url: 'https://two.dev/', title: 'Two' }] }) });
            const res = await send(CONTEXT_MESSAGES.ADD_TABS, { task, chromeTabIds: [two.id] });
            expect(res.task!.context!.tabs).toHaveLength(1);
        });

        it('returns the task unchanged when nothing can be added', async () => {
            const pinned = [...mock.browser.tabs.values()].find(t => t.pinned)!;
            const task = makeTask();
            const res = await send(CONTEXT_MESSAGES.ADD_TABS, { task, chromeTabIds: [pinned.id] });
            expect(res.task).toEqual(task);
        });

        it('groups added tabs when the task is active, creating the group if needed', async () => {
            const started = (await send(CONTEXT_MESSAGES.START, { task: makeTask() })).task!;
            const res = await send(CONTEXT_MESSAGES.ADD_TABS, { task: started, windowId: 1 });
            const groupId = res.task!.context!.chromeGroupId!;
            expect(mock.browser.groups.get(groupId)!.title).toBe('Write pricing page');
            expect(res.task!.context!.tabs.map(t => t.url)).toEqual(['https://one.dev/', 'https://two.dev/']);

            const extra = mock.browser.addTab({ url: 'https://three.dev/' });
            const more = await send(CONTEXT_MESSAGES.ADD_TABS, { task: res.task, chromeTabIds: [extra.id] });
            expect(more.task!.context!.chromeGroupId).toBe(groupId);
            expect(more.task!.context!.tabs).toHaveLength(3);
        });

        describe('explicit tabs (New task from tabs)', () => {
            const tabByUrl = (url: string) => [...mock.browser.tabs.values()].find(t => t.url === url)!;

            it('skips ids of tabs that were closed instead of failing', async () => {
                const two = tabByUrl('https://two.dev/');
                const res = await send(CONTEXT_MESSAGES.ADD_TABS, { task: makeTask(), chromeTabIds: [9999, two.id] });
                expect(res.success).toBe(true);
                expect(res.task!.context!.tabs.map(t => t.url)).toEqual(['https://two.dev/']);
            });

            it('takes tabs from a plain group for an idle task and leaves them in it', async () => {
                const other = tabByUrl('https://other-group.dev/');
                const res = await send(CONTEXT_MESSAGES.ADD_TABS, { task: makeTask(), chromeTabIds: [other.id] });
                expect(res.task!.context!.tabs.map(t => t.url)).toEqual(['https://other-group.dev/']);
                expect(res.task!.context!.state).toBe('idle');
                expect(mock.browser.tabs.get(other.id)!.groupId).toBe(other.groupId);
            });

            it("never takes a tab from another active task's group", async () => {
                const active = (
                    await send(CONTEXT_MESSAGES.START, { task: makeTask({ id: 'task_2', title: 'Other task' }) })
                ).task!;
                const grouped = await send(CONTEXT_MESSAGES.ADD_TABS, { task: active, windowId: 1 });
                const theirs = mock.browser.groupTabs(grouped.task!.context!.chromeGroupId!)[0];
                const plain = tabByUrl('https://other-group.dev/');

                const res = await send(CONTEXT_MESSAGES.ADD_TABS, {
                    task: makeTask(),
                    chromeTabIds: [theirs.id, plain.id],
                });
                expect(res.task!.context!.tabs.map(t => t.url)).toEqual(['https://other-group.dev/']);
            });

            it('moves tabs from a plain group into a new task group without parking the task', async () => {
                const one = tabByUrl('https://one.dev/');
                const two = tabByUrl('https://two.dev/');
                const plain = mock.browser.addGroup({ tabIds: [one.id, two.id], title: 'Organized' });
                const started = (await send(CONTEXT_MESSAGES.START, { task: makeTask() })).task!;
                expect(started.context!.chromeGroupId).toBeNull();

                const res = await send(CONTEXT_MESSAGES.ADD_TABS, { task: started, chromeTabIds: [one.id, two.id] });
                const groupId = res.task!.context!.chromeGroupId!;
                expect(groupId).not.toBe(plain.id);
                expect(mock.browser.groups.get(groupId)).toMatchObject({
                    title: 'Write pricing page',
                    color: 'yellow',
                });
                expect(mock.browser.groupTabs(groupId).map(t => t.id)).toEqual([one.id, two.id]);
                expect(mock.browser.groups.has(plain.id)).toBe(false); // Chrome drops the emptied group

                await settle(2000);
                expect(storedTask().context!.state).toBe('active');
                expect(storedTask().context!.tabs).toHaveLength(2);
            });

            it('still skips tabs in other groups for "+ Add current tabs" (no explicit ids)', async () => {
                const res = await send(CONTEXT_MESSAGES.ADD_TABS, { task: makeTask(), windowId: 1 });
                expect(res.task!.context!.tabs.map(t => t.url)).not.toContain('https://other-group.dev/');
            });
        });

        it('removes a tab from a parked task', async () => {
            const task = makeTask({ context: makeContext() });
            const res = await send(CONTEXT_MESSAGES.REMOVE_TAB, { task, url: 'https://a.example/' });
            expect(res.task!.context!.tabs.map(t => t.url)).toEqual(['https://b.example/']);
        });

        it('ungroups the live tab when removing from an active task', async () => {
            const started = (await send(CONTEXT_MESSAGES.START, { task: makeTask({ context: makeContext() }) })).task!;
            await send(CONTEXT_MESSAGES.REMOVE_TAB, { task: started, url: 'https://a.example/' });
            const a = [...mock.browser.tabs.values()].find(t => t.url === 'https://a.example/')!;
            expect(a.groupId).toBe(-1);
            await send(CONTEXT_MESSAGES.REMOVE_TAB, { task: started, url: 'https://not-there/' });
        });
    });

    describe('summaries', () => {
        it('attaches a summary to the matching park only', async () => {
            const parkedAt = '2026-10-03T11:00:00Z';
            await seed(makeTask({ context: makeContext({ parkedAt }) }));
            const ok = await send(CONTEXT_MESSAGES.SET_SUMMARY, {
                taskId: 'task_1',
                summary: ` ${'x'.repeat(700)} `,
                parkedAt,
            });
            expect(ok.task!.context!.aiSummary).toHaveLength(600);

            const stale = await send(CONTEXT_MESSAGES.SET_SUMMARY, {
                taskId: 'task_1',
                summary: 'old',
                parkedAt: 'other',
            });
            expect(stale.task!.context!.aiSummary).toHaveLength(600);

            const empty = await send(CONTEXT_MESSAGES.SET_SUMMARY, { taskId: 'task_1', summary: '  ', parkedAt });
            expect(empty.task!.context!.aiSummary).toBeUndefined();

            expect(await send(CONTEXT_MESSAGES.SET_SUMMARY, { taskId: 'nope', summary: 'x', parkedAt })).toEqual({
                error: 'Task not found',
            });
        });
    });

    describe('errors and routing', () => {
        it('reports unknown messages and thrown errors', async () => {
            expect(await send('TASK_CONTEXT_NOPE')).toEqual({ error: 'Unknown context message: TASK_CONTEXT_NOPE' });
            vi.mocked(chrome.tabs.create).mockRejectedValueOnce(new Error('no tabs for you'));
            const res = await send(CONTEXT_MESSAGES.START, { task: makeTask({ context: makeContext() }) });
            expect(res).toEqual({ error: 'no tabs for you' });
        });

        it('survives a closed response channel', async () => {
            vi.mocked(chrome.tabs.create).mockRejectedValueOnce(new Error('x'));
            const sendResponse = vi.fn(() => {
                throw new Error('channel closed');
            });
            service.handleContextMessage(
                { type: CONTEXT_MESSAGES.START, payload: { task: makeTask({ context: makeContext() }) } },
                sendResponse
            );
            await settle();
            expect(sendResponse).toHaveBeenCalledTimes(1);
        });

        it('errors when no window exists', async () => {
            vi.mocked(chrome.windows.getLastFocused).mockResolvedValueOnce({} as never);
            const res = await send(CONTEXT_MESSAGES.START, { task: makeTask({ context: makeContext() }) });
            expect(res.error).toBe('No browser window available');
        });
    });

    describe('deleted tasks', () => {
        it('releases the tabs of the active task without closing them', async () => {
            const started = (await send(CONTEXT_MESSAGES.START, { task: makeTask({ context: makeContext() }) })).task!;
            await service.releaseContextForDeletedTask('someone-else');
            expect(activeId()).toBe(started.id);
            await service.releaseContextForDeletedTask(started.id);
            expect(activeId()).toBeUndefined();
            const web = [...mock.browser.tabs.values()].filter(t => t.url?.startsWith('https'));
            expect(web).toHaveLength(2);
            expect(web.every(t => t.groupId === -1)).toBe(true);
        });

        it('handles an active task without a group', async () => {
            await send(CONTEXT_MESSAGES.START, { task: makeTask() });
            await service.releaseContextForDeletedTask('task_1');
            expect(activeId()).toBeUndefined();
        });
    });

    describe('following the browser', () => {
        async function startActive() {
            const started = (await send(CONTEXT_MESSAGES.START, { task: makeTask({ context: makeContext() }) })).task!;
            await settle();
            return started;
        }

        it('mirrors the live group into the context after changes (debounced)', async () => {
            const task = await startActive();
            const [first] = mock.browser.groupTabs(task.context!.chromeGroupId!);
            await chrome.tabs.update(first.id, { title: 'Renamed A' } as never);
            mock.browser.events.tabMoved.emit(first.id, {});
            await settle(1000);
            expect(storedTask().context!.tabs[0].title).toBe('A');
            await settle(600);
            expect(storedTask().context!.tabs[0].title).toBe('Renamed A');

            // No change → no save
            const saves = vi.mocked(chrome.storage.local.set).mock.calls.length;
            mock.browser.events.tabUpdated.emit(first.id, { status: 'complete' }, first);
            await settle(1600);
            expect(vi.mocked(chrome.storage.local.set).mock.calls.length).toBe(saves);
        });

        it('ignores unrelated updates and inactive tasks', async () => {
            mock.browser.events.tabUpdated.emit(1, { favIconUrl: 'x' }, {});
            mock.browser.events.tabRemoved.emit(1, {});
            await settle(1600);
            expect(chrome.storage.local.set).not.toHaveBeenCalled();
        });

        it('does not snapshot an empty or missing group', async () => {
            const task = await startActive();
            const ids = mock.browser.groupTabs(task.context!.chromeGroupId!).map(t => t.id);
            // Ungroup everything except a new-tab page: the snapshot would be empty
            const blank = await chrome.tabs.create({ url: 'chrome://newtab/' });
            await chrome.tabs.group({ groupId: task.context!.chromeGroupId!, tabIds: blank.id! });
            await chrome.tabs.ungroup(ids as [number, ...number[]]);
            await settle(2000);
            expect(storedTask().context!.tabs).toHaveLength(2);
        });

        it('auto-parks when the group is closed by hand, keeping the last snapshot', async () => {
            const task = await startActive();
            const ids = mock.browser.groupTabs(task.context!.chromeGroupId!).map(t => t.id);
            await chrome.tabs.remove(ids as [number, ...number[]]);
            await settle(2000);
            expect(storedTask().context).toMatchObject({ state: 'parked' });
            expect(storedTask().context!.tabs).toHaveLength(2);
            expect(storedTask().context!.events!.slice(-1)[0]).toMatchObject({ auto: true, closedTabs: 0 });
        });

        it('ignores removal of other groups', async () => {
            await startActive();
            const other = mock.browser.addTab({ url: 'https://x.dev' });
            const group = mock.browser.addGroup({ tabIds: [other.id] });
            await chrome.tabs.remove(other.id);
            await settle();
            expect(group.id).toBeGreaterThan(0);
            expect(storedTask().context!.state).toBe('active');
        });

        it('adds new tabs in the task window to its group', async () => {
            const task = await startActive();
            const tab = await chrome.tabs.create({ url: 'https://new.dev/' });
            await settle(2000);
            expect(mock.browser.tabs.get(tab.id!)!.groupId).toBe(task.context!.chromeGroupId);
            expect(storedTask().context!.tabs.map(t => t.url)).toContain('https://new.dev/');
        });

        it('creates the group for a task started without tabs', async () => {
            await send(CONTEXT_MESSAGES.START, { task: makeTask() });
            await settle();
            const tab = await chrome.tabs.create({ url: 'https://first.dev/' });
            await settle(2000);
            const groupId = storedTask().context!.chromeGroupId!;
            expect(mock.browser.tabs.get(tab.id!)!.groupId).toBe(groupId);
            expect(mock.browser.groups.get(groupId)!.title).toBe('Write pricing page');
        });

        it('leaves new tabs alone when they should not join', async () => {
            const task = await startActive();
            const groupId = task.context!.chromeGroupId!;
            const pinned = await chrome.tabs.create({ url: 'https://p.dev/', pinned: true });
            const own = await chrome.tabs.create({ url: `${EXTENSION_BASE}index.html` });
            const otherWindow = mock.browser.openWindow();
            const elsewhere = await chrome.tabs.create({ url: 'https://w.dev/', windowId: otherWindow });
            await settle(2000);
            for (const tab of [pinned, own, elsewhere])
                expect(mock.browser.tabs.get(tab.id!)!.groupId).not.toBe(groupId);

            await chrome.storage.local.set({ [PARK_RESUME_SETTINGS_KEY]: { autoAddNewTabs: false } });
            const off = await chrome.tabs.create({ url: 'https://off.dev/', windowId: 1 });
            await settle(2000);
            expect(mock.browser.tabs.get(off.id!)!.groupId).toBe(-1);
        });

        it('skips tabs that are already grouped, and stale groups', async () => {
            const task = await startActive();
            mock.browser.events.tabCreated.emit({ id: 1, windowId: 1, groupId: 77, pinned: false, url: 'https://g' });
            // A vanished group (e.g. after a restart) must not be recreated around restored tabs
            await seed({ ...storedTask(), context: { ...storedTask().context!, chromeGroupId: 4242 } });
            const restored = await chrome.tabs.create({ url: 'https://restored.dev/' });
            await settle(2000);
            expect(mock.browser.tabs.get(restored.id!)!.groupId).toBe(-1);
            expect(task).toBeTruthy();
        });

        it('still adds a tab opened right after Start, once our own tab work has drained', async () => {
            const started = (await send(CONTEXT_MESSAGES.START, { task: makeTask({ context: makeContext() }) })).task!;
            // No settle: the busy guard from Start is still up
            const quick = await chrome.tabs.create({ url: 'https://quick.dev/' });
            await settle(2000);
            const groupId = started.context!.chromeGroupId!;
            expect(mock.browser.tabs.get(quick.id!)!.groupId).toBe(groupId);
            expect(mock.browser.groupTabs(groupId)).toHaveLength(3);
            expect(storedTask().context!.tabs.map(t => t.url)).toContain('https://quick.dev/');
        });

        it('forgets a tab that closed while waiting for our own tab work', async () => {
            await send(CONTEXT_MESSAGES.START, { task: makeTask({ context: makeContext() }) });
            const gone = await chrome.tabs.create({ url: 'https://gone.dev/' });
            await chrome.tabs.remove(gone.id!);
            await settle(2000);
            expect(storedTask().context!.tabs.map(t => t.url)).not.toContain('https://gone.dev/');
            expect(console.warn).not.toHaveBeenCalledWith('Auto-add tab to context failed', expect.anything());
        });

        it('ignores tab events without an id while busy', async () => {
            await send(CONTEXT_MESSAGES.START, { task: makeTask({ context: makeContext() }) });
            mock.browser.events.tabCreated.emit({ windowId: 1, pinned: false, url: 'https://noid' });
            await settle(2000);
            expect(console.warn).not.toHaveBeenCalled();
        });

        it('logs auto-add failures', async () => {
            await startActive();
            vi.mocked(chrome.tabs.group).mockRejectedValueOnce(new Error('cannot group'));
            await chrome.tabs.create({ url: 'https://fail.dev/' });
            await settle(2000);
            expect(console.warn).toHaveBeenCalledWith('Auto-add tab to context failed', expect.any(Error));
        });
    });

    describe('reconcile after restarts', () => {
        it('re-binds the active task to a restored group with the same title', async () => {
            const tab = mock.browser.addTab({ url: 'https://a.example/' });
            const restored = mock.browser.addGroup({ tabIds: [tab.id], title: 'Write pricing page' });
            await seed(makeTask({ context: makeContext({ state: 'active', chromeGroupId: 1, windowId: 9 }) }));
            await chrome.storage.local.set({ [ACTIVE_CONTEXT_KEY]: 'task_1' });
            mock.browser.events.startup.emit();
            await settle(5100);
            expect(storedTask().context).toMatchObject({ state: 'active', chromeGroupId: restored.id, windowId: 1 });
        });

        it('parks the active task when its group is gone', async () => {
            await seed(makeTask({ context: makeContext({ state: 'active', chromeGroupId: 1 }) }));
            await chrome.storage.local.set({ [ACTIVE_CONTEXT_KEY]: 'task_1' });
            await settle(5100);
            expect(storedTask().context!.state).toBe('parked');
            expect(storedTask().context!.events!.slice(-1)[0]).toMatchObject({ auto: true });
        });

        it('does nothing when the group still exists or nothing is active', async () => {
            const started = (await send(CONTEXT_MESSAGES.START, { task: makeTask({ context: makeContext() }) })).task!;
            await settle(5100);
            expect(storedTask().context!.chromeGroupId).toBe(started.context!.chromeGroupId);
        });

        it('logs reconcile failures', async () => {
            await seed(makeTask({ context: makeContext({ state: 'active', chromeGroupId: 1 }) }));
            await chrome.storage.local.set({ [ACTIVE_CONTEXT_KEY]: 'task_1' });
            vi.mocked(chrome.tabGroups.query).mockRejectedValueOnce(new Error('query failed'));
            await settle(5100);
            expect(console.warn).toHaveBeenCalledWith('Context reconcile failed', expect.any(Error));
        });
    });
});
