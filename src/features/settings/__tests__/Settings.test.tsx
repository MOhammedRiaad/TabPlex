import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import SettingsView from '../SettingsView';
import AiSummarySetting from '../components/AiSummarySetting';
import * as db from '../../../utils/storage';
import { fakeChrome } from '../../../test/chromeMock';
import { makeTask } from '../../../test/factories';
import { PARK_RESUME_SETTINGS_KEY } from '../../../utils/taskContext';
import { DISPLAY_NAME_KEY, DISPLAY_NAME_MAX, readDisplayName, saveDisplayName } from '../utils/displayName';

const reload = vi.fn();

function renderSettings() {
    const props = {
        onExport: vi.fn(),
        onImportClick: vi.fn(),
        onImportFile: vi.fn(),
        fileInputRef: React.createRef<HTMLInputElement>(),
    };
    render(<SettingsView {...props} />);
    return props;
}

describe('SettingsView', () => {
    beforeEach(() => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
        Object.defineProperty(window, 'location', { value: { ...window.location, reload }, configurable: true });
        reload.mockClear();
        vi.spyOn(window, 'confirm').mockReturnValue(true);
    });
    afterEach(() => vi.useRealTimers());

    it('saves the greeting name as typed and removes it when cleared', () => {
        localStorage.setItem(DISPLAY_NAME_KEY, 'Ada');
        renderSettings();
        const input = screen.getByLabelText('Your name') as HTMLInputElement;
        expect(input.value).toBe('Ada');

        fireEvent.change(input, { target: { value: 'Grace ' } }); // trailing space kept while typing
        expect(input.value).toBe('Grace ');
        expect(localStorage.getItem(DISPLAY_NAME_KEY)).toBe('Grace ');
        expect(readDisplayName()).toBe('Grace');

        fireEvent.change(input, { target: { value: '   ' } });
        expect(localStorage.getItem(DISPLAY_NAME_KEY)).toBeNull();
        expect(readDisplayName()).toBe('');
    });

    it('caps the name length and survives unavailable storage', () => {
        saveDisplayName('x'.repeat(DISPLAY_NAME_MAX + 10));
        expect(localStorage.getItem(DISPLAY_NAME_KEY)).toHaveLength(DISPLAY_NAME_MAX);

        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new Error('blocked');
        });
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new Error('blocked');
        });
        expect(readDisplayName()).toBe('');
        expect(() => saveDisplayName('Ada')).not.toThrow();
    });

    it('exports and imports through the provided handlers', () => {
        const props = renderSettings();
        fireEvent.click(screen.getAllByText(/Export/)[1]);
        expect(props.onExport).toHaveBeenCalled();
        fireEvent.click(screen.getAllByText(/Import/)[1]);
        expect(props.onImportClick).toHaveBeenCalled();
        fireEvent.change(document.querySelector('input[type="file"]')!, { target: { files: [] } });
        expect(props.onImportFile).toHaveBeenCalled();
    });

    it('clears all data after confirmation', async () => {
        await db.addTask(makeTask());
        localStorage.setItem('x', '1');
        renderSettings();
        vi.mocked(window.confirm).mockReturnValueOnce(false);
        fireEvent.click(screen.getByText(/Clear Data|Clear All/, { selector: 'button' }));
        expect(localStorage.getItem('x')).toBe('1');
        fireEvent.click(screen.getByText(/Clear Data|Clear All/, { selector: 'button' }));
        await screen.findByText('All data cleared. Reloading...');
        expect(localStorage.getItem('x')).toBeNull();
        expect(await db.getAllTasks()).toEqual([]);
        act(() => vi.advanceTimersByTime(1500));
        expect(reload).toHaveBeenCalled();
    });

    it('reports clear failures', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        fakeChrome().storage.local.clear.mockRejectedValueOnce(new Error('x'));
        renderSettings();
        fireEvent.click(screen.getByText(/Clear Data|Clear All/, { selector: 'button' }));
        await screen.findByText('Failed to clear data');
    });

    it('toggles Park & Resume settings', async () => {
        renderSettings();
        fireEvent.click(screen.getByLabelText('Close tabs when parking'));
        fireEvent.click(screen.getByLabelText('Add new tabs to the active task'));
        fireEvent.click(screen.getByLabelText('Start a Pomodoro when a task starts'));
        await waitFor(async () =>
            expect((await chrome.storage.local.get(PARK_RESUME_SETTINGS_KEY))[PARK_RESUME_SETTINGS_KEY]).toMatchObject({
                closeTabsOnPark: false,
                autoAddNewTabs: false,
                startPomodoroOnStart: true,
            })
        );
    });

    it('edits, resets and saves canvas settings', () => {
        renderSettings();
        const mode = screen.getByDisplayValue('Custom Canvas (Lightweight)');
        fireEvent.change(mode, { target: { value: 'tldraw' } });
        fireEvent.change(screen.getByDisplayValue('Offline (Local Only)'), { target: { value: 'online' } });
        fireEvent.change(screen.getByDisplayValue('IndexedDB (Recommended)'), { target: { value: 'memory' } });
        fireEvent.change(screen.getByPlaceholderText('my-project-room'), { target: { value: 'room-1' } });
        fireEvent.click(screen.getByRole('button', { name: /Reset/ }));
        expect(screen.getByDisplayValue('Custom Canvas (Lightweight)')).toBeInTheDocument();

        fireEvent.change(screen.getByDisplayValue('Custom Canvas (Lightweight)'), { target: { value: 'tldraw' } });
        fireEvent.click(screen.getByRole('button', { name: /Save/ }));
        expect(localStorage.getItem('tabboard_canvas_mode')).toBe('tldraw');
        expect(screen.getByText('Canvas mode changed. Reloading...')).toBeInTheDocument();
        act(() => vi.advanceTimersByTime(1500));
        expect(reload).toHaveBeenCalled();

        fireEvent.change(screen.getByDisplayValue('Offline (Local Only)'), { target: { value: 'online' } });
        fireEvent.click(screen.getByRole('button', { name: /Save/ }));
        expect(screen.getByText('Canvas settings saved successfully!')).toBeInTheDocument();
    });

    it('re-opens onboarding', () => {
        renderSettings();
        fireEvent.click(screen.getByText('🎓 Open Guide'));
        expect(fakeChrome().tabs.create).toHaveBeenCalledWith(
            expect.objectContaining({ url: expect.stringContaining('onboarding.html') })
        );
    });
});

describe('AiSummarySetting', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('is disabled where the browser has no built-in AI', async () => {
        render(<AiSummarySetting enabled={false} onChange={vi.fn()} />);
        expect(await screen.findByText(/doesn't support Chrome's built-in AI/)).toBeInTheDocument();
        expect(screen.getByLabelText('On-device AI summaries')).toBeDisabled();
    });

    it('downloads the model when turned on, showing progress', async () => {
        let progress: ((e: Event) => void) | undefined;
        let finish: (v: unknown) => void = () => undefined;
        const destroy = vi.fn();
        vi.stubGlobal('Summarizer', {
            availability: vi.fn().mockResolvedValue('downloadable'),
            create: vi.fn((opts: { monitor: (m: EventTarget) => void }) => {
                const target = new EventTarget();
                opts.monitor(target);
                progress = e => target.dispatchEvent(e);
                return new Promise(resolve => (finish = resolve));
            }),
        });
        const onChange = vi.fn();
        render(<AiSummarySetting enabled={false} onChange={onChange} />);
        expect(await screen.findByText(/one-time model download/)).toBeInTheDocument();
        fireEvent.click(screen.getByLabelText('On-device AI summaries'));
        expect(onChange).toHaveBeenCalledWith(true);
        const event = Object.assign(new Event('downloadprogress'), { loaded: 0.42 });
        act(() => progress!(event));
        expect(screen.getByText('Downloading model… 42%')).toBeInTheDocument();
        await act(async () => finish({ destroy }));
        expect(await screen.findByText('Ready on this device.')).toBeInTheDocument();
        expect(destroy).toHaveBeenCalled();
    });

    it('reports download errors and turning off', async () => {
        vi.stubGlobal('Summarizer', {
            availability: vi.fn().mockResolvedValueOnce('downloading').mockResolvedValue('unavailable'),
            create: vi.fn().mockRejectedValue(new Error('not enough space')),
        });
        const onChange = vi.fn();
        const { rerender } = render(<AiSummarySetting enabled onChange={onChange} />);
        expect(await screen.findByText(/downloading the model/)).toBeInTheDocument();
        fireEvent.click(screen.getByLabelText('On-device AI summaries'));
        expect(onChange).toHaveBeenCalledWith(false);
        rerender(<AiSummarySetting enabled={false} onChange={onChange} />);
        fireEvent.click(screen.getByLabelText('On-device AI summaries'));
        expect(await screen.findByText(/not enough space/)).toBeInTheDocument();
        expect(await screen.findByText(/doesn't meet Chrome's requirements/)).toBeInTheDocument();
    });

    it('does not download when already available', async () => {
        const create = vi.fn();
        vi.stubGlobal('Summarizer', { availability: vi.fn().mockResolvedValue('available'), create });
        render(<AiSummarySetting enabled={false} onChange={vi.fn()} />);
        await screen.findByText('Ready on this device.');
        fireEvent.click(screen.getByLabelText('On-device AI summaries'));
        expect(create).not.toHaveBeenCalled();
    });
});
