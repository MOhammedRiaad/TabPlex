// Settings and limits for the tabs the background records on its own (every page that finishes loading).
// Shared by the background and the Settings view, so keep it free of DOM and React.

/** chrome.storage.local key of the "record every page I open" setting */
export const TRACK_ALL_TABS_KEY = 'tabplex_track_all_tabs';

/** Most tabs kept in the background's tab list; past it the oldest closed ones are dropped */
export const MAX_TRACKED_TABS = 2000;

/** How long a closed tab is kept */
export const CLOSED_TAB_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

/** Name of the daily cleanup alarm */
export const CLEANUP_ALARM = 'tabplex-cleanup';
export const CLEANUP_PERIOD_MINUTES = 24 * 60;

/** Settings → storage: warn from this share of the browser's storage quota */
export const STORAGE_WARN_RATIO = 0.8;

/**
 * Whether new pages are recorded. New installs turn it off (see background-init); installs made before the setting
 * existed have no value stored and keep recording until the user turns it off.
 */
export async function isTrackingEnabled(): Promise<boolean> {
    try {
        const stored = await chrome.storage.local.get([TRACK_ALL_TABS_KEY]);
        return stored[TRACK_ALL_TABS_KEY] !== false;
    } catch {
        return true;
    }
}
