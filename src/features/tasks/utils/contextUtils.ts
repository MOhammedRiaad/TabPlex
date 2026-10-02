import { Task } from '../../../types';
import { isContextActive, isContextParked } from '../../../utils/taskContext';

/** The task whose context is currently open in the browser (one at a time) */
export const getActiveContextTask = (tasks: Task[]): Task | undefined => tasks.find(isContextActive);

/** Parked, unfinished tasks — most recently parked first */
export const getParkedTasks = (tasks: Task[]): Task[] =>
    tasks
        .filter(task => isContextParked(task) && task.status !== 'done')
        .sort((a, b) => (b.context?.parkedAt ?? '').localeCompare(a.context?.parkedAt ?? ''));

export const getContextTabCount = (task: Task): number => task.context?.tabs.length ?? 0;

export const pluralizeTabs = (count: number): string => `${count} tab${count === 1 ? '' : 's'}`;
