import React from 'react';
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SettingsView from '../../settings/SettingsView';
import ModelStatus from '../components/ModelStatus';
import { readAiSettings, useAiSettings } from '../hooks/useAiSettings';
import { useModelAvailability } from '../hooks/useModelAvailability';
import { AI_SETTINGS_KEY, DEFAULT_AI_SETTINGS } from '../constants';
import { fakeChrome } from '../../../test/chromeMock';

function renderSettings() {
    render(
        <SettingsView
            onExport={vi.fn()}
            onImportClick={vi.fn()}
            onImportFile={vi.fn()}
            fileInputRef={React.createRef<HTMLInputElement>()}
        />
    );
}

describe('AI settings', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('defaults to on and merges stored values', async () => {
        expect(await readAiSettings()).toEqual(DEFAULT_AI_SETTINGS);
        await chrome.storage.local.set({ [AI_SETTINGS_KEY]: { taskDrafts: false } });
        expect(await readAiSettings()).toEqual({
            tabGrouping: true,
            taskDrafts: false,
            sessionNames: true,
            noteHelpers: true,
        });
        fakeChrome().storage.local.get.mockRejectedValueOnce(new Error('storage down'));
        expect(await readAiSettings()).toEqual(DEFAULT_AI_SETTINGS);
    });

    it('shows the On-device AI section; switches stay usable without the model and save', async () => {
        renderSettings();
        expect(screen.getByRole('heading', { level: 3, name: /On-device AI$/ })).toBeInTheDocument();
        expect(
            await screen.findByText("This browser doesn't have built-in AI. TabPlex will use simpler rules instead.")
        ).toBeInTheDocument();
        expect(screen.getByText(/processed on this computer/)).toBeInTheDocument();

        const organize = screen.getByRole('checkbox', { name: 'Organize tabs with AI' });
        const drafts = screen.getByRole('checkbox', { name: 'Draft tasks from tabs' });
        expect(organize).toBeEnabled();
        expect(organize).toBeChecked();

        fireEvent.click(organize);
        await waitFor(async () =>
            expect((await chrome.storage.local.get(AI_SETTINGS_KEY))[AI_SETTINGS_KEY]).toEqual({
                tabGrouping: false,
                taskDrafts: true,
                sessionNames: true,
                noteHelpers: true,
            })
        );
        expect(drafts).toBeChecked();
        expect(screen.getByRole('checkbox', { name: 'Name saved sessions' })).toBeChecked();
        expect(screen.getByRole('checkbox', { name: 'Note helpers' })).toBeChecked();
    });

    it('follows changes made in another TabPlex tab', async () => {
        const { result, unmount } = renderHook(() => useAiSettings());
        await waitFor(() => expect(fakeChrome().storage.onChanged.listeners.size).toBe(1));
        act(() => {
            for (const listener of [...fakeChrome().storage.onChanged.listeners]) {
                listener({ [AI_SETTINGS_KEY]: { newValue: { tabGrouping: true, taskDrafts: false } } }, 'local');
            }
        });
        expect(result.current.settings.taskDrafts).toBe(false);

        // Other keys and other areas are ignored; a cleared key falls back to the defaults
        act(() => {
            for (const listener of [...fakeChrome().storage.onChanged.listeners]) {
                listener({ other: { newValue: 1 } }, 'local');
                listener({ [AI_SETTINGS_KEY]: { newValue: { tabGrouping: false } } }, 'sync');
            }
        });
        expect(result.current.settings).toEqual({
            tabGrouping: true,
            taskDrafts: false,
            sessionNames: true,
            noteHelpers: true,
        });
        act(() => {
            for (const listener of [...fakeChrome().storage.onChanged.listeners]) {
                listener({ [AI_SETTINGS_KEY]: { newValue: undefined } }, 'local');
            }
        });
        expect(result.current.settings).toEqual(DEFAULT_AI_SETTINGS);
        unmount();
        expect(fakeChrome().storage.onChanged.listeners.size).toBe(0);
    });
});

describe('useModelAvailability', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('checks on mount and again when the window regains focus', async () => {
        const availability = vi.fn().mockResolvedValueOnce('downloadable').mockResolvedValueOnce('available');
        vi.stubGlobal('LanguageModel', { availability });
        const { result, unmount } = renderHook(() => useModelAvailability());
        expect(result.current.checking).toBe(true);
        await waitFor(() => expect(result.current.availability).toBe('downloadable'));
        expect(result.current.checking).toBe(false);

        act(() => {
            window.dispatchEvent(new Event('focus'));
        });
        await waitFor(() => expect(result.current.availability).toBe('available'));
        unmount();
    });

    it('ignores a result that arrives after unmount', async () => {
        let resolve!: (value: string) => void;
        vi.stubGlobal('LanguageModel', { availability: () => new Promise(r => (resolve = r)) });
        const { result, unmount } = renderHook(() => useModelAvailability());
        unmount();
        resolve('available');
        await Promise.resolve();
        expect(result.current.availability).toBe('unsupported');
    });
});

describe('ModelStatus', () => {
    it.each([
        ['available', 'On-device AI ready.'],
        ['downloadable', /one-time download/],
        ['downloading', /Your browser is downloading/],
        ['unavailable', /This device can't run/],
    ] as const)('explains %s', (availability, text) => {
        render(<ModelStatus availability={availability} />);
        expect(screen.getByRole('status')).toHaveTextContent(text);
    });

    it('shows download progress and extra classes', () => {
        render(<ModelStatus availability="downloading" progress={0.42} className="extra" />);
        expect(screen.getByRole('status')).toHaveTextContent('Downloading on-device AI model… 42%');
        expect(screen.getByRole('status')).toHaveClass('ai-model-status', 'extra');
    });
});
