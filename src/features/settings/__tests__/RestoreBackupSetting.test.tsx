import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import RestoreBackupSetting from '../components/RestoreBackupSetting';
import { IMPORT_BACKUP_AT_KEY, IMPORT_BACKUP_KEY, markImportInThisTab } from '../../../utils/exportImport';
import { useUIStore } from '../../ui/store/uiStore';
import { fakeChrome } from '../../../test/chromeMock';
import * as db from '../../../utils/storage';
import { makeTask } from '../../../test/factories';

const backupOf = (taskId: string) =>
    JSON.stringify({ version: '2.0.0', timestamp: '', data: { tasks: [makeTask({ id: taskId })] } });

describe('RestoreBackupSetting', () => {
    beforeEach(() => {
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        useUIStore.getState().actions.clearToast();
    });
    afterEach(() => {
        vi.restoreAllMocks();
        markImportInThisTab(false);
    });

    it('is not shown when there is no backup, or the storage cannot be read', async () => {
        const { container, unmount } = render(<RestoreBackupSetting />);
        await waitFor(() => expect(fakeChrome().storage.local.get).toHaveBeenCalled());
        expect(container).toBeEmptyDOMElement();
        unmount();

        fakeChrome().storage.local.get.mockRejectedValueOnce(new Error('nope'));
        const failed = render(<RestoreBackupSetting />);
        await waitFor(() => expect(fakeChrome().storage.local.get).toHaveBeenCalledTimes(2));
        expect(failed.container).toBeEmptyDOMElement();
    });

    it('asks twice before replacing the data, then restores and reloads', async () => {
        await chrome.storage.local.set({
            [IMPORT_BACKUP_KEY]: backupOf('old'),
            [IMPORT_BACKUP_AT_KEY]: '2026-10-03T12:00:00.000Z',
        });
        const reload = vi.fn();
        const realLocation = window.location;
        Object.defineProperty(window, 'location', { value: { ...realLocation, reload }, configurable: true });
        const user = userEvent.setup();
        render(<RestoreBackupSetting />);

        expect(await screen.findByText(/taken/)).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: /Restore/ }));
        await user.click(screen.getByRole('button', { name: 'Cancel' }));
        expect(screen.getByRole('button', { name: /Restore/ })).toBeInTheDocument();
        expect((await db.getAllTasks()).map(t => t.id)).not.toContain('old');

        await user.click(screen.getByRole('button', { name: /Restore/ }));
        await user.click(screen.getByRole('button', { name: 'Yes, replace my data' }));
        await waitFor(() => expect(useUIStore.getState().toast?.type).toBe('success'));
        expect((await db.getAllTasks()).map(t => t.id)).toEqual(['old']);
        await waitFor(() => expect(reload).toHaveBeenCalledTimes(1), { timeout: 4000 });
        Object.defineProperty(window, 'location', { value: realLocation, configurable: true });
    });

    it('shows an error and stays usable when the backup cannot be restored', async () => {
        await chrome.storage.local.set({ [IMPORT_BACKUP_KEY]: '{nope' });
        const user = userEvent.setup();
        render(<RestoreBackupSetting />);
        await user.click(await screen.findByRole('button', { name: /Restore/ }));
        await user.click(screen.getByRole('button', { name: 'Yes, replace my data' }));
        await waitFor(() => expect(useUIStore.getState().toast?.type).toBe('error'));
        expect(useUIStore.getState().toast?.message).toContain('not valid JSON');
        expect(screen.getByRole('button', { name: /Restore/ })).toBeEnabled();
    });
});
