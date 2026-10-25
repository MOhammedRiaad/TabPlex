import React, { useEffect, useRef } from 'react';
import type { ImportSummary } from '../../../utils/exportImport';
import './ImportPreviewDialog.css';

interface ImportPreviewDialogProps {
    fileName: string;
    summary: ImportSummary;
    busy: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}

const LABELS: Record<keyof ImportSummary['counts'], [singular: string, plural: string]> = {
    boards: ['board', 'boards'],
    folders: ['folder', 'folders'],
    tabs: ['tab', 'tabs'],
    tasks: ['task', 'tasks'],
    notes: ['note', 'notes'],
    sessions: ['session', 'sessions'],
    history: ['history item', 'history items'],
    canvases: ['canvas', 'canvases'],
};

/** Asks before an import replaces everything: shows what the file holds and what was repaired in it */
const ImportPreviewDialog: React.FC<ImportPreviewDialogProps> = ({ fileName, summary, busy, onConfirm, onCancel }) => {
    const cancelRef = useRef<HTMLButtonElement>(null);
    useEffect(() => cancelRef.current?.focus(), []);

    const entries = Object.entries(summary.counts) as [keyof ImportSummary['counts'], number][];
    const exported = summary.exportedAt ? new Date(summary.exportedAt) : null;

    return (
        <div className="import-preview-overlay" onClick={busy ? undefined : onCancel}>
            <div
                className="import-preview-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="import-preview-title"
                onClick={e => e.stopPropagation()}
                onKeyDown={e => e.key === 'Escape' && !busy && onCancel()}
            >
                <h2 id="import-preview-title">Replace your data with this file?</h2>
                <p>
                    <strong>{fileName}</strong>
                    {exported && !Number.isNaN(exported.getTime()) && (
                        <> (exported {exported.toLocaleDateString()})</>
                    )}{' '}
                    will replace everything in TabPlex.
                </p>

                {entries.length > 0 ? (
                    <ul className="import-preview-counts" aria-label="What the file contains">
                        {entries.map(([name, count]) => (
                            <li key={name}>
                                <strong>{count}</strong> {LABELS[name][count === 1 ? 0 : 1]}
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p role="alert" className="import-preview-warning">
                        This file has no data. Importing it will leave TabPlex empty.
                    </p>
                )}

                {summary.warnings.length > 0 && (
                    <div className="import-preview-repairs">
                        <p>Some of the file was repaired for your safety:</p>
                        <ul>
                            {summary.warnings.map(warning => (
                                <li key={warning}>{warning}</li>
                            ))}
                        </ul>
                    </div>
                )}

                <p className="import-preview-note">
                    Your current data is backed up first and put back if the import fails.
                </p>

                <div className="import-preview-actions">
                    <button type="button" ref={cancelRef} onClick={onCancel} disabled={busy}>
                        Cancel
                    </button>
                    <button type="button" className="import-preview-confirm" onClick={onConfirm} disabled={busy}>
                        {busy ? 'Importing…' : 'Replace my data'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ImportPreviewDialog;
