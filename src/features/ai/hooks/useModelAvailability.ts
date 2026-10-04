import { useCallback, useEffect, useState } from 'react';
import { getModelAvailability } from '../utils/promptApi';
import { ModelAvailability } from '../types';

/** Whether Chrome's on-device model can be used here. Re-checks when the window regains focus. */
export function useModelAvailability(): {
    availability: ModelAvailability;
    checking: boolean;
    refresh: () => void;
} {
    const [availability, setAvailability] = useState<ModelAvailability>('unsupported');
    const [checking, setChecking] = useState(true);
    const [version, setVersion] = useState(0);

    const refresh = useCallback(() => setVersion(v => v + 1), []);

    useEffect(() => {
        let cancelled = false;
        getModelAvailability().then(value => {
            if (cancelled) return;
            setAvailability(value);
            setChecking(false);
        });
        return () => {
            cancelled = true;
        };
    }, [version]);

    // A download may have finished in another tab meanwhile
    useEffect(() => {
        window.addEventListener('focus', refresh);
        return () => window.removeEventListener('focus', refresh);
    }, [refresh]);

    return { availability, checking, refresh };
}
