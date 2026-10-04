import { useCallback, useEffect, useState } from 'react';
import { AI_SETTINGS_KEY, DEFAULT_AI_SETTINGS } from '../constants';
import { AiSettings } from '../types';

/** Read the current AI settings once (outside React) */
export async function readAiSettings(): Promise<AiSettings> {
    try {
        const result = await chrome.storage.local.get([AI_SETTINGS_KEY]);
        return { ...DEFAULT_AI_SETTINGS, ...(result[AI_SETTINGS_KEY] as Partial<AiSettings> | undefined) };
    } catch {
        return DEFAULT_AI_SETTINGS;
    }
}

/** AI settings in chrome.storage.local, kept in step with changes from other TabPlex tabs */
export function useAiSettings() {
    const [settings, setSettings] = useState<AiSettings>(DEFAULT_AI_SETTINGS);

    useEffect(() => {
        let cancelled = false;
        readAiSettings().then(loaded => {
            if (!cancelled) setSettings(loaded);
        });

        const onChanged = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
            if (area !== 'local' || !(AI_SETTINGS_KEY in changes)) return;
            setSettings({
                ...DEFAULT_AI_SETTINGS,
                ...(changes[AI_SETTINGS_KEY].newValue as Partial<AiSettings> | undefined),
            });
        };
        chrome.storage.onChanged.addListener(onChanged);

        return () => {
            cancelled = true;
            chrome.storage.onChanged.removeListener(onChanged);
        };
    }, []);

    const updateSettings = useCallback((updates: Partial<AiSettings>) => {
        setSettings(prev => {
            const next = { ...prev, ...updates };
            chrome.storage.local.set({ [AI_SETTINGS_KEY]: next }).catch(console.error);
            return next;
        });
    }, []);

    return { settings, updateSettings };
}
