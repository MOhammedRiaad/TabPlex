import { useEffect, useState } from 'react';
import { DISPLAY_NAME_KEY, readDisplayName } from '../utils/displayName';

/** The saved display name, kept in step with changes made in other TabPlex tabs */
export function useDisplayName(): string {
    const [name, setName] = useState(readDisplayName);

    useEffect(() => {
        const onStorage = (event: StorageEvent) => {
            if (event.key === DISPLAY_NAME_KEY || event.key === null) setName(readDisplayName());
        };
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, []);

    return name;
}
