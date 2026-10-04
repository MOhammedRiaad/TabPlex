import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import { describe, expect, it, vi } from 'vitest';
import HistoryItem from '../components/HistoryItem';
import { makeFolder } from '../../../test/factories';
import { HistoryItem as HistoryItemType } from '../../../types';

const item: HistoryItemType = {
    id: 'h1',
    url: 'https://stripe.com/pricing',
    title: 'Stripe pricing',
    favicon: 'https://stripe.com/favicon.ico',
    lastVisitTime: '2026-10-03T09:30:00.000Z',
    visitCount: 4,
    createdAt: '2026-10-03T09:30:00.000Z',
};

function renderItem(props: Partial<React.ComponentProps<typeof HistoryItem>> = {}) {
    const handlers = { onSelectFolder: vi.fn(), onSelectHistoryItem: vi.fn(), onAddToFolder: vi.fn() };
    render(
        <DndContext>
            <HistoryItem
                item={item}
                folders={[makeFolder({ id: 'f1', name: 'Research' }), makeFolder({ id: 'f2', name: 'Later' })]}
                selectedFolderId=""
                isSelected={false}
                isAdded={false}
                {...handlers}
                {...props}
            />
        </DndContext>
    );
    return handlers;
}

describe('HistoryItem', () => {
    it('shows the page, its visit details and a favicon that hides itself if it fails', () => {
        renderItem();
        expect(screen.getByRole('link', { name: /Stripe pricing/ })).toHaveAttribute('href', item.url);
        expect(screen.getByText(/^Visited:/)).toBeInTheDocument();
        expect(screen.getByText('Visits: 4')).toBeInTheDocument();
        const favicon = screen.getByAltText('Favicon');
        fireEvent.error(favicon);
        expect(favicon).toHaveStyle({ display: 'none' });
    });

    it('omits missing details', () => {
        render(
            <DndContext>
                <HistoryItem
                    item={{ ...item, favicon: undefined, lastVisitTime: undefined, visitCount: undefined }}
                    folders={[]}
                    selectedFolderId=""
                    isSelected={false}
                    isAdded={false}
                    onSelectFolder={vi.fn()}
                    onSelectHistoryItem={vi.fn()}
                    onAddToFolder={vi.fn()}
                />
            </DndContext>
        );
        expect(screen.queryByAltText('Favicon')).toBeNull();
        expect(screen.queryByText(/^Visited:/)).toBeNull();
        expect(screen.queryByText(/^Visits:/)).toBeNull();
    });

    it('picks a folder, and only enables "Add to Folder" for the selected item with a folder', () => {
        const handlers = renderItem();
        expect(screen.getByRole('button', { name: 'Add to Folder' })).toBeDisabled();
        fireEvent.change(screen.getByRole('combobox'), { target: { value: 'f2' } });
        expect(handlers.onSelectHistoryItem).toHaveBeenCalledWith('h1');
        expect(handlers.onSelectFolder).toHaveBeenCalledWith('f2');
    });

    it('adds the item to the chosen folder', () => {
        const handlers = renderItem({ isSelected: true, selectedFolderId: 'f1' });
        expect(screen.getByRole('combobox')).toHaveValue('f1');
        fireEvent.click(screen.getByRole('button', { name: 'Add to Folder' }));
        expect(handlers.onAddToFolder).toHaveBeenCalledWith(item);
    });

    it("keeps the folder controls from starting a drag, and doesn't block a normal link click", () => {
        const parentPointerDown = vi.fn();
        const parentClick = vi.fn();
        render(
            <div onPointerDown={parentPointerDown} onClick={parentClick}>
                <DndContext>
                    <HistoryItem
                        item={item}
                        folders={[makeFolder({ id: 'f1', name: 'Research' })]}
                        selectedFolderId="f1"
                        isSelected
                        isAdded={false}
                        onSelectFolder={vi.fn()}
                        onSelectHistoryItem={vi.fn()}
                        onAddToFolder={vi.fn()}
                    />
                </DndContext>
            </div>
        );
        fireEvent.pointerDown(screen.getByRole('combobox'));
        fireEvent.pointerDown(screen.getByRole('button', { name: 'Add to Folder' }));
        fireEvent.pointerDown(document.querySelector('.history-actions')!);
        expect(parentPointerDown).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('combobox'));
        expect(parentClick).not.toHaveBeenCalled();

        // Not dragging: the link click goes through (not prevented)
        expect(fireEvent.click(screen.getByRole('link', { name: /Stripe pricing/ }))).toBe(true);
    });

    it('shows an "added" state instead of the folder picker', () => {
        const alert = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
        renderItem({ isAdded: true });
        expect(screen.getByText('✓ Added to folder')).toBeInTheDocument();
        expect(screen.queryByRole('combobox')).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: 'Modify' }));
        expect(alert).toHaveBeenCalledWith('Item "Stripe pricing" has been added to a folder');
    });
});
