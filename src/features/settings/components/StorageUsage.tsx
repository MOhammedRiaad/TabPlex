import React, { useEffect, useState } from 'react';
import { STORAGE_WARN_RATIO } from '../../../utils/tabTracking';

const FALLBACK_QUOTA_BYTES = 10 * 1024 * 1024;

const megabytes = (bytes: number) => (bytes / (1024 * 1024)).toFixed(1);

/** How much of the browser's extension storage quota TabPlex uses, with a warning near the limit */
const StorageUsage: React.FC = () => {
    const [used, setUsed] = useState<number | null>(null);
    const quota = chrome.storage.local.QUOTA_BYTES ?? FALLBACK_QUOTA_BYTES;

    useEffect(() => {
        let cancelled = false;
        chrome.storage.local
            .getBytesInUse(null)
            .then(bytes => {
                if (!cancelled) setUsed(bytes);
            })
            .catch(console.error);
        return () => {
            cancelled = true;
        };
    }, []);

    if (used === null) return null;
    const nearLimit = used / quota >= STORAGE_WARN_RATIO;

    return (
        <div className="setting-item">
            <div className="setting-info">
                <h4>Background storage</h4>
                <p className="setting-status">
                    Using {megabytes(used)} MB of {megabytes(quota)} MB.
                </p>
                {nearLimit && (
                    <p role="alert" className="setting-status">
                        Storage is almost full. When it is full, TabPlex can no longer save. Turn off &ldquo;Record
                        every page I open&rdquo;, or export your data and remove what you no longer need.
                    </p>
                )}
            </div>
        </div>
    );
};

export default StorageUsage;
