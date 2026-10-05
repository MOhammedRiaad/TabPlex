import { beforeEach, describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { getCurrentBoard, pickCurrentBoard, useCurrentBoard } from '../currentBoard';
import { useBoardStore } from '../../../../store/boardStore';
import { useUIStore } from '../../../ui/store/uiStore';
import { makeBoard } from '../../../../test/factories';

const work = makeBoard({ id: 'b1', name: 'Work' });
const home = makeBoard({ id: 'b2', name: 'Home' });

describe('current board', () => {
    beforeEach(() => {
        useBoardStore.setState({ boards: [work, home] });
        useUIStore.setState({ activeBoardId: null });
    });

    it('picks the active board, else the first, else nothing', () => {
        expect(pickCurrentBoard([work, home], 'b2')).toBe(home);
        expect(pickCurrentBoard([work, home], 'deleted')).toBe(work);
        expect(pickCurrentBoard([work, home], null)).toBe(work);
        expect(pickCurrentBoard([], 'b1')).toBeUndefined();
    });

    it('reads the choice outside React and follows it in components', () => {
        expect(getCurrentBoard()).toBe(work);
        const { result } = renderHook(() => useCurrentBoard());
        expect(result.current).toBe(work);
        act(() => useUIStore.getState().actions.setActiveBoard('b2'));
        expect(result.current).toBe(home);
        expect(getCurrentBoard()).toBe(home);
    });
});
