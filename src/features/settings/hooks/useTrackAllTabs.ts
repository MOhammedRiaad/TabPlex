import { useCallback, useEffect, useState } from 'react';
import { TRACK_ALL_TABS_KEY } from '../../../utils/tabTracking';

/** Whether the background records every page that finishes loading (chrome.storage.local, read by the worker) */
export function useTrackAllTabs() {
    // Installs from before the setting existed have no value and keep recording
    const [enabled, setEnabled] = useState(true);

    useEffect(() => {
        let cancelled = false;
        chrome.storage.local
            .get([TRACK_ALL_TABS_KEY])
            .then(stored => {
                if (!cancelled) setEnabled(stored[TRACK_ALL_TABS_KEY] !== false);
            })
            .catch(console.error);

        const onChanged = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
            if (area === 'local' && TRACK_ALL_TABS_KEY in changes) {
                setEnabled(changes[TRACK_ALL_TABS_KEY].newValue !== false);
            }
        };
        chrome.storage.onChanged.addListener(onChanged);
        return () => {
            cancelled = true;
            chrome.storage.onChanged.removeListener(onChanged);
        };
    }, []);

    const update = useCallback((next: boolean) => {
        setEnabled(next);
        chrome.storage.local.set({ [TRACK_ALL_TABS_KEY]: next }).catch(console.error);
    }, []);

    return { enabled, update };
}
