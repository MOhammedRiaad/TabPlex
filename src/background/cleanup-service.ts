import { pruneTabs } from './tab-retention';
import { CLEANUP_ALARM, CLEANUP_PERIOD_MINUTES } from '../utils/tabTracking';

// Service workers sleep after ~30 s, so a setInterval never reaches a day: use an alarm, which wakes the worker.
// Alarms survive worker restarts, so it is only created when missing. A browser that was closed at the due time
// fires the alarm at the next start; onStartup covers a browser that starts after being off for days.
chrome.alarms.get(CLEANUP_ALARM).then(existing => {
    if (!existing) return chrome.alarms.create(CLEANUP_ALARM, { periodInMinutes: CLEANUP_PERIOD_MINUTES });
});

chrome.alarms.onAlarm.addListener(alarm => {
    if (alarm.name === CLEANUP_ALARM) pruneTabs().catch(error => console.warn('Tab cleanup failed:', error));
});

chrome.runtime.onStartup.addListener(() => {
    pruneTabs().catch(error => console.warn('Tab cleanup failed:', error));
});
