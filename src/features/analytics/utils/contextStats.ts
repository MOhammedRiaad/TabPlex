import { ContextEvent, Task } from '../../../types';

export interface ContextStats {
    /** Parks in the window (manual + automatic) */
    parks: number;
    /** Resumes of a parked context in the window */
    resumes: number;
    /** Tabs closed by parking in the window */
    tabsFreed: number;
    /** Average time a context stayed parked before it was resumed (ms), for resumes in the window */
    averageParkedMs: number | null;
    /** Contexts parked right now (unfinished tasks) */
    currentlyParked: number;
}

/** Park & Resume stats over the last `days` days, from each task's context event log */
export function computeContextStats(tasks: Task[], days = 7, now = Date.now()): ContextStats {
    const since = now - days * 24 * 60 * 60 * 1000;
    let parks = 0;
    let resumes = 0;
    let tabsFreed = 0;
    const parkedDurations: number[] = [];

    for (const task of tasks) {
        const events: ContextEvent[] = task.context?.events ?? [];
        let lastParkAt: number | null = null;
        for (const event of events) {
            const at = Date.parse(event.at);
            if (Number.isNaN(at)) continue;
            if (event.type === 'park') {
                lastParkAt = at;
                if (at >= since) {
                    parks++;
                    tabsFreed += event.closedTabs ?? 0;
                }
            } else {
                if (event.type === 'resume' && at >= since) {
                    resumes++;
                    if (lastParkAt !== null && at >= lastParkAt) parkedDurations.push(at - lastParkAt);
                }
                lastParkAt = null;
            }
        }
    }

    const currentlyParked = tasks.filter(t => t.context?.state === 'parked' && t.status !== 'done').length;
    const averageParkedMs = parkedDurations.length
        ? parkedDurations.reduce((sum, ms) => sum + ms, 0) / parkedDurations.length
        : null;

    return { parks, resumes, tabsFreed, averageParkedMs, currentlyParked };
}

/** "45m", "3h 10m", "2d 4h" */
export function formatParkedDuration(ms: number): string {
    const minutes = Math.round(ms / 60000);
    if (minutes < 60) return `${Math.max(minutes, 1)}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ${minutes % 60}m`;
    return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}
