import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SearchBar from '../components/SearchBar';
import { useBoardStore } from '../../../store/boardStore';
import { makeFolder, makeNote, makeSession, makeTab, makeTask } from '../../../test/factories';

describe('SearchBar', () => {
    beforeEach(() => {
        useBoardStore.setState({
            tabs: [
                makeTab({ id: 't1', title: 'Alpha docs', url: 'https://alpha.dev', folderId: 'f1' }),
                makeTab({ id: 't2', title: 'Other', url: 'https://beta.dev', tags: ['alpha-tag'] }),
            ],
            tasks: [
                makeTask({ id: 'k1', title: 'Write alpha spec' }),
                makeTask({ id: 'k2', title: 'x', description: 'about ALPHA' }),
                makeTask({ id: 'k3', title: 'y', tags: ['alpha'] }),
            ],
            notes: [
                makeNote({ id: 'n1', content: 'alpha ' + 'x'.repeat(60) }),
                makeNote({ id: 'n2', content: 'short', tags: ['alpha'] }),
            ],
            folders: [makeFolder({ id: 'f1', name: 'Alpha folder' }), makeFolder({ id: 'f2', name: 'alpha empty' })],
            sessions: [
                makeSession({ name: 'Alpha session' }),
                makeSession({ id: 's2', name: 'z', summary: 'alpha sum' }),
            ],
        });
    });

    const type = (value: string) => {
        const input = screen.getByLabelText('Search');
        fireEvent.focus(input);
        fireEvent.change(input, { target: { value } });
        return input;
    };

    it('finds tabs, tasks, notes, folders and sessions (max 10)', () => {
        render(<SearchBar />);
        type('alpha');
        const options = screen.getAllByRole('option');
        expect(options).toHaveLength(10);
        expect(screen.getByText('Alpha docs')).toBeInTheDocument();
        expect(screen.getAllByText('todo • medium priority')).toHaveLength(3);
        expect(screen.getByText(/^alpha x+\.\.\.$/)).toBeInTheDocument();
        expect(screen.getByText('1 tab')).toBeInTheDocument();
        expect(screen.getAllByText('0 tabs')).toHaveLength(2);
    });

    it('shows an empty state and clears', () => {
        render(<SearchBar />);
        type('nothing-matches');
        expect(screen.getByText('No results found')).toBeInTheDocument();
        fireEvent.click(screen.getByLabelText('Clear search'));
        expect(screen.getByLabelText('Search')).toHaveValue('');
        type('   ');
        expect(screen.queryByRole('listbox')).toBeNull();
    });

    it('navigates results with the keyboard and opens tabs', () => {
        const onResultClick = vi.fn();
        const open = vi.spyOn(window, 'open').mockImplementation(() => null);
        render(<SearchBar onResultClick={onResultClick} />);
        const input = type('alpha');
        fireEvent.keyDown(input, { key: 'ArrowDown' });
        fireEvent.keyDown(input, { key: 'ArrowUp' });
        fireEvent.keyDown(input, { key: 'ArrowUp' });
        expect(screen.getAllByRole('option')[9]).toHaveClass('selected');
        fireEvent.keyDown(input, { key: 'ArrowDown' });
        fireEvent.keyDown(input, { key: 'Enter' });
        expect(onResultClick).toHaveBeenCalledWith(expect.objectContaining({ id: 't1', type: 'tab' }));
        expect(open).toHaveBeenCalledWith('https://alpha.dev', '_blank');
        expect(input).toHaveValue('');
    });

    it('selects non-tab results by click, closes on Escape and outside clicks', () => {
        const onResultClick = vi.fn();
        render(<SearchBar onResultClick={onResultClick} />);
        const input = type('alpha folder');
        fireEvent.click(screen.getByText('Alpha folder'));
        expect(onResultClick).toHaveBeenCalledWith(expect.objectContaining({ type: 'folder' }));

        type('alpha');
        fireEvent.keyDown(input, { key: 'Escape' });
        expect(screen.queryByRole('listbox')).toBeNull();
        type('alpha');
        fireEvent.keyDown(input, { key: 'Tab' });
        fireEvent.mouseDown(document.body);
        expect(screen.queryByRole('listbox')).toBeNull();
        fireEvent.keyDown(input, { key: 'ArrowDown' }); // closed: ignored
        render(<SearchBar />); // without a click handler
    });
});
