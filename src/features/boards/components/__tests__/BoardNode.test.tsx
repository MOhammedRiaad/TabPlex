import { DndContext } from '@dnd-kit/core';
import { SortableContext } from '@dnd-kit/sortable';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeFolder, makeTab } from '../../../../test/factories';
import BoardNode from '../BoardNode';

type Props = React.ComponentProps<typeof BoardNode>;

const renderNode = (props: Props) =>
    render(
        <DndContext>
            <SortableContext items={props.tab ? [props.tab.id] : []}>
                <BoardNode {...props} />
            </SortableContext>
        </DndContext>
    );

afterEach(() => {
    document.documentElement.removeAttribute('data-theme');
});

describe('BoardNode tab', () => {
    it('shows the success toast without calling anything when no update callback is given', () => {
        const onShowToast = vi.fn();
        renderNode({ tab: makeTab({ title: 'Docs' }), onShowToast });

        fireEvent.click(screen.getByLabelText('Edit tab'));
        fireEvent.submit(document.querySelector('form')!);

        expect(onShowToast).toHaveBeenCalledWith('Tab updated successfully!', 'success');
        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('sends the edited fields to onUpdateTab', () => {
        const onUpdateTab = vi.fn();
        renderNode({
            tab: makeTab({ id: 't1', title: 'Docs', url: 'https://docs.test/', folderId: 'f1' }),
            onUpdateTab,
        });

        fireEvent.click(screen.getByLabelText('Edit tab'));
        fireEvent.submit(document.querySelector('form')!);

        expect(onUpdateTab).toHaveBeenCalledWith('t1', {
            title: 'Docs',
            url: 'https://docs.test/',
            folderId: 'f1',
            tags: [],
        });
    });

    it('does not fail when no open callback is given', () => {
        renderNode({ tab: makeTab({ title: 'Docs' }) });

        fireEvent.click(screen.getByText('Docs'));
        fireEvent.click(screen.getByLabelText('Open tab in new tab'));

        expect(screen.getByLabelText('Tab: Docs')).toBeInTheDocument();
    });

    it('opens the url from a click and from the link button', () => {
        const onOpenTab = vi.fn();
        renderNode({ tab: makeTab({ title: 'Docs', url: 'https://docs.test/' }), onOpenTab });

        fireEvent.click(screen.getByText('Docs'));
        fireEvent.click(screen.getByLabelText('Open tab in new tab'));

        expect(onOpenTab).toHaveBeenCalledTimes(2);
        expect(onOpenTab).toHaveBeenCalledWith('https://docs.test/');
    });

    it('does not ask for confirmation when it cannot delete', () => {
        const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
        renderNode({ tab: makeTab({ title: 'Docs' }) });

        fireEvent.click(screen.getByLabelText('Delete tab'));

        expect(confirm).not.toHaveBeenCalled();
    });

    it('keeps the tab when the delete confirmation is declined, deletes it when accepted', () => {
        const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
        const onDeleteTab = vi.fn();
        renderNode({ tab: makeTab({ id: 't1', title: 'Docs' }), onDeleteTab });

        fireEvent.click(screen.getByLabelText('Delete tab'));
        expect(confirm).toHaveBeenCalledWith('Are you sure you want to delete "Docs"?');
        expect(onDeleteTab).not.toHaveBeenCalled();

        confirm.mockReturnValue(true);
        fireEvent.click(screen.getByLabelText('Delete tab'));
        expect(onDeleteTab).toHaveBeenCalledWith('t1');
    });

    it('shows an unparseable url as is, shortening one over 50 characters', () => {
        const long = `not a url ${'x'.repeat(60)}`;
        const { unmount } = renderNode({ tab: makeTab({ url: 'not a url' }) });
        expect(screen.getByText('not a url')).toBeInTheDocument();
        unmount();

        renderNode({ tab: makeTab({ url: long }) });
        expect(screen.getByText(`${long.substring(0, 50)}...`)).toBeInTheDocument();
    });

    it('copies the url and reports the result', async () => {
        const writeText = vi.fn().mockResolvedValue(undefined);
        Object.assign(navigator, { clipboard: { writeText } });
        const onShowToast = vi.fn();
        renderNode({ tab: makeTab({ url: 'https://docs.test/' }), onShowToast });

        fireEvent.click(screen.getByLabelText('Copy URL to clipboard'));

        await vi.waitFor(() => expect(onShowToast).toHaveBeenCalledWith('URL copied to clipboard!', 'success'));
        expect(writeText).toHaveBeenCalledWith('https://docs.test/');
    });
});

describe('BoardNode folder', () => {
    it('keeps an empty folder when the confirmation is declined', () => {
        const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
        const onDeleteFolder = vi.fn();
        renderNode({ folder: makeFolder({ id: 'f1', name: 'Empty' }), onDeleteFolder });

        fireEvent.click(screen.getByLabelText('Delete folder'));
        expect(confirm).toHaveBeenCalledWith('Are you sure you want to delete the empty folder "Empty"?');
        expect(onDeleteFolder).not.toHaveBeenCalled();

        confirm.mockReturnValue(true);
        fireEvent.click(screen.getByLabelText('Delete folder'));
        expect(onDeleteFolder).toHaveBeenCalledWith('f1');
    });

    it('deletes a folder together with its tabs after choosing force delete', () => {
        const onDeleteFolder = vi.fn();
        const onShowToast = vi.fn();
        const folder = makeFolder({ id: 'f1', name: 'Work' });
        renderNode({
            folder,
            tabs: [makeTab({ id: 't1', folderId: 'f1' }), makeTab({ id: 't2', folderId: 'f1' })],
            onDeleteFolder,
            onShowToast,
        });

        fireEvent.click(screen.getByLabelText('Delete folder'));
        const dialog = screen.getByText('Delete Folder').closest('.board-modal-content') as HTMLElement;
        fireEvent.click(within(dialog).getByText('Delete folder and all tabs'));
        fireEvent.click(within(dialog).getByRole('button', { name: 'Delete Everything' }));

        expect(onDeleteFolder).toHaveBeenCalledWith('f1');
        expect(onShowToast).toHaveBeenCalledWith('Deleted folder "Work" and 2 tabs', 'info');
    });

    it('ignores keys that are not shortcuts', () => {
        const onDeleteFolder = vi.fn();
        renderNode({ folder: makeFolder({ name: 'Work' }), onDeleteFolder });
        const node = screen.getByLabelText('Folder: Work');
        expect(node).toHaveAttribute('aria-expanded', 'false');

        fireEvent.keyDown(node, { key: 'Escape' });

        expect(node).toHaveAttribute('aria-expanded', 'false');
        expect(onDeleteFolder).not.toHaveBeenCalled();
    });

    it('toggles expansion with Enter and shows its tabs', () => {
        renderNode({
            folder: makeFolder({ id: 'f1', name: 'Work' }),
            tabs: [makeTab({ id: 't1', title: 'Inside', folderId: 'f1' })],
        });
        const node = screen.getByLabelText('Folder: Work');

        fireEvent.keyDown(node, { key: 'Enter' });

        expect(node).toHaveAttribute('aria-expanded', 'true');
        expect(screen.getByText('Inside')).toBeInTheDocument();
    });

    it('uses the dark gradient background in dark mode', () => {
        document.documentElement.setAttribute('data-theme', 'dark');
        renderNode({ folder: makeFolder({ name: 'Work', color: '#ff0000' }) });

        expect(screen.getByLabelText('Folder: Work').style.background).toContain('rgba(31, 41, 55, 0.6)');
    });

    it('uses the light gradient background by default', () => {
        renderNode({ folder: makeFolder({ name: 'Work', color: '#ff0000' }) });

        expect(screen.getByLabelText('Folder: Work').style.background).not.toContain('rgba(31, 41, 55, 0.6)');
    });

    it('renders the folder icon without inline style when the folder has no color', () => {
        renderNode({ folder: makeFolder({ name: 'Plain', color: undefined }) });

        const icon = screen.getByLabelText('Folder: Plain').querySelector('.board-folder-icon') as HTMLElement;
        expect(icon.getAttribute('style')).toBeNull();
    });
});
