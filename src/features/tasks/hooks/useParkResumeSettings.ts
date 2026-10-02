import { useCallback, useEffect, useState } from 'react';
import { ParkResumeSettings } from '../../../types';
import { DEFAULT_PARK_RESUME_SETTINGS, PARK_RESUME_SETTINGS_KEY } from '../../../utils/taskContext';

/** Park & Resume settings, stored in chrome.storage.local so the background service worker can read them */
export function useParkResumeSettings() {
    const [settings, setSettings] = useState<ParkResumeSettings>(DEFAULT_PARK_RESUME_SETTINGS);

    useEffect(() => {
        let cancelled = false;
        chrome.storage.local
            .get([PARK_RESUME_SETTINGS_KEY])
            .then(result => {
                if (cancelled) return;
                setSettings({
                    ...DEFAULT_PARK_RESUME_SETTINGS,
                    ...(result[PARK_RESUME_SETTINGS_KEY] as Partial<ParkResumeSettings> | undefined),
                });
            })
            .catch(console.error);
        return () => {
            cancelled = true;
        };
    }, []);

    const updateSettings = useCallback((updates: Partial<ParkResumeSettings>) => {
        setSettings(prev => {
            const next = { ...prev, ...updates };
            chrome.storage.local.set({ [PARK_RESUME_SETTINGS_KEY]: next }).catch(console.error);
            return next;
        });
    }, []);

    return { settings, updateSettings };
}
