import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import TabTrackingSetting from '../components/TabTrackingSetting';
import StorageUsage from '../components/StorageUsage';
import { fakeChrome } from '../../../test/chromeMock';
import { TRACK_ALL_TABS_KEY } from '../../../utils/tabTracking';

const saved = async () => (await chrome.storage.local.get([TRACK_ALL_TABS_KEY]))[TRACK_ALL_TABS_KEY];
const box = () => screen.getByRole('checkbox', { name: 'Record every page I open' });

describe('TabTrackingSetting', () => {
    it('is on when nothing was stored (installs from before the setting)', async () => {
        render(<TabTrackingSetting />);
        expect(box()).toBeChecked();
        await waitFor(() => expect(box()).toBeChecked());
    });

    it('shows a stored off value, saves a change, and follows changes made elsewhere', async () => {
        await chrome.storage.local.set({ [TRACK_ALL_TABS_KEY]: false });
        const user = userEvent.setup();
        render(<TabTrackingSetting />);
        await waitFor(() => expect(box()).not.toBeChecked());

        await user.click(box());
        expect(box()).toBeChecked();
        expect(await saved()).toBe(true);

        await act(() => chrome.storage.local.set({ [TRACK_ALL_TABS_KEY]: false }));
        expect(box()).not.toBeChecked();
    });

    it('ignores unrelated storage changes and logs a failed read', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        fakeChrome().storage.local.get.mockRejectedValueOnce(new Error('read failed'));
        render(<TabTrackingSetting />);
        await waitFor(() => expect(console.error).toHaveBeenCalled());
        await act(() => chrome.storage.local.set({ somethingElse: 1 }));
        expect(box()).toBeChecked();
    });
});

describe('StorageUsage', () => {
    it('shows the space used without a warning when there is plenty left', async () => {
        fakeChrome().storage.local.getBytesInUse.mockResolvedValueOnce(2 * 1024 * 1024);
        render(<StorageUsage />);
        expect(await screen.findByText('Using 2.0 MB of 10.0 MB.')).toBeInTheDocument();
        expect(screen.queryByRole('alert')).toBeNull();
    });

    it('warns from 80% of the quota', async () => {
        fakeChrome().storage.local.getBytesInUse.mockResolvedValueOnce(9 * 1024 * 1024);
        render(<StorageUsage />);
        expect(await screen.findByRole('alert')).toHaveTextContent('almost full');
    });

    it('shows nothing when the size cannot be read', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        fakeChrome().storage.local.getBytesInUse.mockRejectedValueOnce(new Error('nope'));
        const { container } = render(<StorageUsage />);
        await waitFor(() => expect(console.error).toHaveBeenCalled());
        expect(container).toBeEmptyDOMElement();
    });
});
