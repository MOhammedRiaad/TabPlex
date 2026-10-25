import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ImportPreviewDialog from '../components/ImportPreviewDialog';
import type { ImportSummary } from '../../../utils/exportImport';

const show = (summary: Partial<ImportSummary> = {}, props: Partial<{ busy: boolean }> = {}) => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
        <ImportPreviewDialog
            fileName="backup.json"
            summary={{ counts: { tasks: 1, notes: 12 }, warnings: [], ...summary }}
            busy={props.busy ?? false}
            onConfirm={onConfirm}
            onCancel={onCancel}
        />
    );
    return { onConfirm, onCancel };
};

describe('ImportPreviewDialog', () => {
    it('lists what the file holds, with singular and plural names, and the safety note', () => {
        show({ counts: { tasks: 1, notes: 12, history: 2 } });
        const counts = screen.getByLabelText('What the file contains');
        expect(counts).toHaveTextContent('1 task');
        expect(counts).toHaveTextContent('12 notes');
        expect(counts).toHaveTextContent('2 history items');
        expect(screen.getByText(/backed up first/)).toBeInTheDocument();
        expect(screen.queryByRole('alert')).toBeNull();
    });

    it('says when the file was exported', () => {
        show({ exportedAt: '2026-10-03T12:00:00.000Z' });
        expect(screen.getByText(/exported/)).toBeInTheDocument();
    });

    it('ignores an export date it cannot read', () => {
        show({ exportedAt: 'not a date' });
        expect(screen.queryByText(/exported/)).toBeNull();
    });

    it('warns loudly when the file is empty', () => {
        show({ counts: {} });
        expect(screen.getByRole('alert')).toHaveTextContent('leave TabPlex empty');
        expect(screen.queryByLabelText('What the file contains')).toBeNull();
    });

    it('shows what was repaired', () => {
        show({ warnings: ['tabs: 2 link(s) with an unsafe address were emptied'] });
        expect(screen.getByText('tabs: 2 link(s) with an unsafe address were emptied')).toBeInTheDocument();
    });

    it('asks first (Cancel has the focus), confirms, and cancels with the button, Escape or a click outside', () => {
        const { onConfirm, onCancel } = show();
        expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();

        fireEvent.click(screen.getByRole('button', { name: 'Replace my data' }));
        expect(onConfirm).toHaveBeenCalledTimes(1);

        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
        fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
        fireEvent.click(screen.getByRole('dialog').parentElement!);
        expect(onCancel).toHaveBeenCalledTimes(3);

        fireEvent.click(screen.getByRole('dialog')); // a click inside the dialog stays inside
        expect(onCancel).toHaveBeenCalledTimes(3);
    });

    it('cannot be dismissed or confirmed again while importing', () => {
        const { onConfirm, onCancel } = show({}, { busy: true });
        expect(screen.getByRole('button', { name: 'Importing…' })).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
        fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
        fireEvent.click(screen.getByRole('dialog').parentElement!);
        expect(onConfirm).not.toHaveBeenCalled();
        expect(onCancel).not.toHaveBeenCalled();
    });
});
