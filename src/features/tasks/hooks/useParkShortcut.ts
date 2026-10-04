import { useEffect } from 'react';
import { useBoardStore } from '../../../store/boardStore';
import { useUIActions } from '../../ui/store/uiStore';
import { getActiveContextTask } from '../utils/contextUtils';

/** Alt+Shift+P parks the active task (opens the Park dialog) */
export function useParkShortcut() {
    const { openParkDialog, showToast } = useUIActions();

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            // e.code, not e.key: Alt changes the produced character on macOS
            if (!e.altKey || !e.shiftKey || e.ctrlKey || e.metaKey || e.code !== 'KeyP') return;
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
            e.preventDefault();
            const active = getActiveContextTask(useBoardStore.getState().tasks);
            if (active) openParkDialog(active.id);
            else showToast('No active task to park', 'info');
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [openParkDialog, showToast]);
}
