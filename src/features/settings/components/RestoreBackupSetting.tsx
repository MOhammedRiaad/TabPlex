import React, { useEffect, useState } from 'react';
import { getImportBackupDate, restoreImportBackup } from '../../../utils/exportImport';
import { useUIActions } from '../../ui/store/uiStore';

/** Puts back the data TabPlex kept just before the last import. Hidden when there is no such backup. */
const RestoreBackupSetting: React.FC = () => {
    const { showToast } = useUIActions();
    // undefined: not read yet; null: no backup; '' : a backup of unknown date
    const [takenAt, setTakenAt] = useState<string | null | undefined>(undefined);
    const [confirming, setConfirming] = useState(false);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        let cancelled = false;
        getImportBackupDate()
            .then(date => {
                if (!cancelled) setTakenAt(date);
            })
            .catch(() => {
                if (!cancelled) setTakenAt(null);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    if (takenAt === undefined || takenAt === null) return null;

    const restore = async () => {
        setBusy(true);
        try {
            await restoreImportBackup();
            showToast('Your data from before the import is back. Reloading...', 'success');
            setTimeout(() => window.location.reload(), 1500);
        } catch (error) {
            console.error('Restore failed:', error);
            showToast(`Could not restore. ${error instanceof Error ? error.message : ''}`.trim(), 'error');
            setBusy(false);
            setConfirming(false);
        }
    };

    const date = takenAt ? new Date(takenAt) : null;
    const when = date && !Number.isNaN(date.getTime()) ? ` taken ${date.toLocaleString()}` : '';

    return (
        <div className="setting-item">
            <div className="setting-info">
                <h4>Restore data from before the last import</h4>
                <p>
                    Before an import replaces your data, TabPlex keeps a copy of what you had{when}. This puts it back
                    and replaces what is there now.
                </p>
            </div>
            {confirming ? (
                <div className="setting-control">
                    <button className="setting-action-btn danger" onClick={restore} disabled={busy}>
                        {busy ? 'Restoring…' : 'Yes, replace my data'}
                    </button>
                    <button className="setting-action-btn" onClick={() => setConfirming(false)} disabled={busy}>
                        Cancel
                    </button>
                </div>
            ) : (
                <button className="setting-action-btn primary" onClick={() => setConfirming(true)}>
                    ↩️ Restore
                </button>
            )}
        </div>
    );
};

export default RestoreBackupSetting;
