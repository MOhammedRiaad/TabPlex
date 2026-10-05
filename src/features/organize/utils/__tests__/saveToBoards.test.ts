import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_BOARD, saveGroupsToBoards } from '../saveToBoards';
import { makeBoard, makeFolder } from '../../../../test/factories';
import { useUIStore } from '../../../ui/store/uiStore';
import { OrganizableTab } from '../../../ai/types';
import { CreatedGroup } from '../../../../utils/organizeTabs';

const tabs: Record<number, OrganizableTab> = {
    1: { id: 1, windowId: 1, title: 'Stripe', url: 'https://stripe.com', favicon: 'f.png' },
    2: { id: 2, windowId: 1, title: 'Paddle', url: 'https://paddle.com' },
    3: { id: 3, windowId: 1, title: 'React', url: 'https://react.dev' },
};
const created: CreatedGroup[] = [
    { groupId: 10, title: 'Pricing', color: 'red', tabIds: [1, 2, 99] }, // 99: unknown, skipped
    { groupId: 11, title: 'Docs', color: 'cyan', tabIds: [3] },
];
const NOW = new Date('2026-10-04T10:00:00Z');

function store(boards = [makeBoard({ id: 'b1' })], folders = [makeFolder({ boardId: 'b1' })]) {
    return { boards, folders, addBoard: vi.fn(), addFolder: vi.fn(), addTab: vi.fn() };
}

describe('saveGroupsToBoards', () => {
    it('adds one folder per group to the board Boards shows, after its existing folders', () => {
        const s = store();
        const result = saveGroupsToBoards(created, tabs, s, NOW);
        expect(result).toEqual({ boardId: 'b1', folderCount: 2, tabCount: 3 });
        expect(s.addBoard).not.toHaveBeenCalled();
        expect(s.addFolder.mock.calls.map(c => c[0])).toEqual([
            expect.objectContaining({ name: 'Pricing', boardId: 'b1', color: '#ef4444', order: 1 }),
            expect.objectContaining({ name: 'Docs', boardId: 'b1', color: '#06b6d4', order: 2 }),
        ]);
        const pricingFolder = s.addFolder.mock.calls[0][0].id;
        expect(s.addTab.mock.calls.map(c => c[0])).toEqual([
            expect.objectContaining({
                title: 'Stripe',
                url: 'https://stripe.com',
                favicon: 'f.png',
                folderId: pricingFolder,
                tabId: 1,
                status: 'open',
                lastAccessed: NOW.toISOString(),
            }),
            expect.objectContaining({ title: 'Paddle', tabId: 2, folderId: pricingFolder }),
            expect.objectContaining({ title: 'React', tabId: 3 }),
        ]);
    });

    it('saves to the board chosen in the Boards view', () => {
        useUIStore.setState({ activeBoardId: 'b2' });
        const s = store([makeBoard({ id: 'b1' }), makeBoard({ id: 'b2' })]);
        expect(saveGroupsToBoards(created, tabs, s, NOW).boardId).toBe('b2');
        expect(s.addFolder.mock.calls[0][0]).toEqual(expect.objectContaining({ boardId: 'b2', order: 0 }));
        useUIStore.setState({ activeBoardId: null });
    });

    it('creates the default board when there is none', () => {
        const s = store([], []);
        expect(saveGroupsToBoards(created.slice(1), tabs, s).boardId).toBe('default_board');
        expect(s.addBoard).toHaveBeenCalledWith(DEFAULT_BOARD);
        expect(s.addFolder).toHaveBeenCalledWith(expect.objectContaining({ boardId: 'default_board', order: 0 }));
    });
});
