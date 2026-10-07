import { useRef } from 'react';

export type SwitchDirection = 'forward' | 'back';

/** Whether the board index last moved forward or back, so a style can slide the new board in from that side */
export function useSwitchDirection(index: number): SwitchDirection {
    const previous = useRef(index);
    const direction = useRef<SwitchDirection>('forward');
    if (index !== previous.current) {
        direction.current = index > previous.current ? 'forward' : 'back';
        previous.current = index;
    }
    return direction.current;
}
