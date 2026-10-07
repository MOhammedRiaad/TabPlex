import { useEffect, useState } from 'react';

/** Below this width the side-by-side styles (accordion, bookshelf) move their spines into one row above the board */
export const NARROW_QUERY = '(max-width: 640px)';

/** True while the viewport matches NARROW_QUERY */
export function useNarrowScreen(): boolean {
    const [narrow, setNarrow] = useState(() => window.matchMedia(NARROW_QUERY).matches);

    useEffect(() => {
        const query = window.matchMedia(NARROW_QUERY);
        const onChange = () => setNarrow(query.matches);
        onChange();
        query.addEventListener('change', onChange);
        return () => query.removeEventListener('change', onChange);
    }, []);

    return narrow;
}
