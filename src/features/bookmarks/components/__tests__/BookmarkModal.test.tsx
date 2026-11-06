import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Bookmark } from '../../../../types';
import BookmarkModal from '../BookmarkModal';

type Props = React.ComponentProps<typeof BookmarkModal>;

const renderModal = (props: Partial<Props> = {}) => {
    const onClose = vi.fn();
    const onSubmit = vi.fn();
    const onShowToast = vi.fn();
    const utils = render(
        <BookmarkModal
            isOpen
            onClose={onClose}
            mode="create"
            onSubmit={onSubmit}
            onShowToast={onShowToast}
            {...props}
        />
    );
    return { ...utils, onClose, onSubmit, onShowToast };
};

const titleInput = () => screen.getByLabelText(/Title/) as HTMLInputElement;
const urlInput = () => screen.getByLabelText(/URL/) as HTMLInputElement;

describe('BookmarkModal', () => {
    it('shows empty inputs when the edited bookmark has no title, url or parent', () => {
        renderModal({ mode: 'edit', bookmark: { id: 'b1', title: '' } });

        expect(titleInput().value).toBe('');
        expect(urlInput().value).toBe('');
        expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    });

    it('fills the inputs and the parent folder from the edited bookmark', () => {
        const folders: Bookmark[] = [{ id: 'f1', title: 'Work', children: [] }];
        renderModal({
            mode: 'edit',
            bookmark: { id: 'b1', title: 'Docs', url: 'https://docs.test', parentId: 'f1' },
            folders,
        });

        expect(titleInput().value).toBe('Docs');
        expect(urlInput().value).toBe('https://docs.test');
        expect((screen.getByLabelText('Parent Folder') as HTMLSelectElement).value).toBe('f1');
    });

    it('reports success after saving an edited folder', () => {
        const { onSubmit, onShowToast, onClose } = renderModal({
            mode: 'edit',
            isFolder: true,
            bookmark: { id: 'f1', title: 'Work' },
        });

        fireEvent.submit(titleInput().closest('form')!);

        expect(onSubmit).toHaveBeenCalledWith({ title: 'Work', url: undefined, parentId: undefined });
        expect(onShowToast).toHaveBeenCalledWith('Folder updated successfully!', 'success');
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('shows a folder-specific error toast when saving an edited folder throws', () => {
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const onSubmit = vi.fn(() => {
            throw new Error('boom');
        });
        const { onShowToast, onClose } = renderModal({
            mode: 'edit',
            isFolder: true,
            bookmark: { id: 'f1', title: 'Work' },
            onSubmit,
        });

        fireEvent.submit(titleInput().closest('form')!);

        expect(onShowToast).toHaveBeenCalledWith('Failed to update folder. Please try again.', 'error');
        expect(onClose).not.toHaveBeenCalled();
    });

    it('shows a bookmark-specific error toast when creating throws', () => {
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const onSubmit = vi.fn(() => {
            throw new Error('boom');
        });
        const { onShowToast } = renderModal({ onSubmit });

        fireEvent.change(titleInput(), { target: { value: 'Docs' } });
        fireEvent.change(urlInput(), { target: { value: 'https://docs.test' } });
        fireEvent.submit(titleInput().closest('form')!);

        expect(onShowToast).toHaveBeenCalledWith('Failed to create bookmark. Please try again.', 'error');
    });

    it('does not close on keys other than Escape or on a mousedown inside the dialog', () => {
        const { onClose } = renderModal();

        fireEvent.keyDown(document, { key: 'Enter' });
        fireEvent.mouseDown(document.querySelector('.bookmark-modal-content')!);

        expect(onClose).not.toHaveBeenCalled();

        fireEvent.keyDown(document, { key: 'Escape' });
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('closes when the overlay itself is pressed', () => {
        const { onClose } = renderModal();

        fireEvent.mouseDown(screen.getByRole('dialog'));

        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('titles the create dialog by what is being created', () => {
        const { unmount } = renderModal({ isFolder: true });
        expect(screen.getByRole('heading', { name: 'Create Folder' })).toBeInTheDocument();
        unmount();

        renderModal();
        expect(screen.getByRole('heading', { name: 'Create Bookmark' })).toBeInTheDocument();
    });
});
