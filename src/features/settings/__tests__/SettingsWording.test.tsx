// T4: wording of the Settings subtitle and the Clear All Data row.
import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import SettingsView from '../SettingsView';

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

describe('Settings wording', () => {
    it('subtitle uses the TabPlex name exactly', () => {
        renderSettings();
        expect(document.querySelector('.settings-subtitle')?.textContent).toBe(
            'Manage your TabPlex preferences and data'
        );
        expect(document.body.textContent).not.toContain('TabBoard preferences');
    });

    it('the Clear All Data row states the deletion and that page recording will be turned off', () => {
        renderSettings();
        const row = screen.getByRole('heading', { name: 'Clear All Data' }).closest('.setting-item') as HTMLElement;
        const text = (row.querySelector('p')?.textContent ?? '').replace(/\s+/g, ' ').trim();
        expect(text).toBe(
            'Permanently delete all your data (cannot be undone). Recording of the pages you open will be turned off.'
        );
        expect(row.querySelector('button')).toHaveTextContent('Clear Data');
    });
});
