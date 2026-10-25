import { useBoardStore } from '../../../store/boardStore';
import { useTimerStore } from '../../../store/timerStore';
import { clearAllData } from '../../../utils/storage';
import { TRACK_ALL_TABS_KEY } from '../../../utils/tabTracking';

/** Removes every chrome.storage.local key except the recording setting */
async function removeAllExceptTracking(): Promise<void> {
    const all = await chrome.storage.local.get(null);
    await chrome.storage.local.remove(Object.keys(all).filter(key => key !== TRACK_ALL_TABS_KEY));
}

/**
 * Deletes every TabPlex item in this browser profile and tells the other open TabPlex tabs to reload.
 * "Record every page I open" ends up off, as on a fresh install (PRIVACY.md).
 * Throws when a step fails; the caller shows the error.
 */
export async function clearEverything(): Promise<void> {
    localStorage.clear();

    // Off first and never missing: a missing key means "on" (tabTracking.ts), so a page that finishes loading
    // between a clear() and a set() would be recorded
    await chrome.storage.local.set({ [TRACK_ALL_TABS_KEY]: false });
    await removeAllExceptTracking();
    await clearAllData();
    // The background writes tab lists without taking part in this clear: a write that read the old list before the
    // first removal can land after it. Once more, after the slower IndexedDB step, closes that window in practice.
    await removeAllExceptTracking();

    // Stops this tab's sync effects from writing the old items back during the delay before its reload
    useBoardStore.setState({ boards: [], folders: [], tabs: [], tasks: [], notes: [], sessions: [] });
    // A running Pomodoro persists to localStorage every second: stop it and drop what it stored
    useTimerStore.setState(useTimerStore.getInitialState(), true);
    useTimerStore.persist.clearStorage();

    // Chrome does not deliver this to the sender; the background ignores STORAGE_* messages
    await chrome.runtime.sendMessage({ type: 'STORAGE_DATA_CLEARED' }).catch(() => undefined);
}
