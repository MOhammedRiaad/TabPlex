import { useCallback, useEffect, useState } from 'react';
import { ParkResumeSettings } from '../../../types';
import { DEFAULT_PARK_RESUME_SETTINGS, PARK_RESUME_SETTINGS_KEY } from '../../../utils/taskContext';

/** Read the current settings once (outside React) */
export async function readParkResumeSettings(): Promise<ParkResumeSettings> {
    try {
        const result = await chrome.storage.local.get([PARK_RESUME_SETTINGS_KEY]);
        return {
            ...DEFAULT_PARK_RESUME_SETTINGS,
            ...(result[PARK_RESUME_SETTINGS_KEY] as Partial<ParkResumeSettings> | undefined),
        };
    } catch {
        return DEFAULT_PARK_RESUME_SETTINGS;
    }
}

/** Park & Resume settings, stored in chrome.storage.local so the background service worker can read them */
export function useParkResumeSettings() {
    const [settings, setSettings] = useState<ParkResumeSettings>(DEFAULT_PARK_RESUME_SETTINGS);

    useEffect(() => {
        let cancelled = false;
        readParkResumeSettings().then(loaded => {
            if (!cancelled) setSettings(loaded);
        });

        // Stay in step with changes made elsewhere (Settings view, Park dialog, other TabPlex tabs)
        const onChanged = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
            if (area !== 'local' || !(PARK_RESUME_SETTINGS_KEY in changes)) return;
            setSettings({
                ...DEFAULT_PARK_RESUME_SETTINGS,
                ...(changes[PARK_RESUME_SETTINGS_KEY].newValue as Partial<ParkResumeSettings> | undefined),
            });
        };
        chrome.storage.onChanged.addListener(onChanged);

        return () => {
            cancelled = true;
            chrome.storage.onChanged.removeListener(onChanged);
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
