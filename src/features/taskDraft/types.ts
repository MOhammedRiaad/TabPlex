// New task from tabs: limits and draft shapes. See docs/specs/AI_TASK_FROM_TABS.md §5.1.
import { Task } from '../../types';

export const TASK_TITLE_MAX = 80;
export const TASK_DESCRIPTION_MAX = 280;
export const MAX_STEPS = 5;
export const STEP_MAX = 80;
export const HINT_MAX = 120;
/** Tabs sent to the model at most (fitInput may send fewer) */
export const MAX_TABS_FOR_DRAFT = 30;

export interface TaskDraft {
    title: string;
    description: string;
    priority: Task['priority'];
    steps: string[];
}

export interface DraftStep {
    key: string; // React key
    text: string;
    included: boolean;
}
