import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import NotesView from '../NotesView';
import { useBoardStore } from '../../../store/boardStore';
import { useUIStore } from '../../ui/store/uiStore';

describe('Notes: Summarize open tabs button', () => {
    beforeEach(() => {
        useBoardStore.setState({ notes: [] });
        useUIStore.setState({ tabNotesDialogOpen: false });
    });

    it('is always shown, even with no notes, and opens the dialog', () => {
        render(
            <MemoryRouter>
                <NotesView />
            </MemoryRouter>
        );
        const button = screen.getByRole('button', { name: '✨ Summarize open tabs' });
        expect(useUIStore.getState().tabNotesDialogOpen).toBe(false);

        fireEvent.click(button);
        expect(useUIStore.getState().tabNotesDialogOpen).toBe(true);
    });
});
