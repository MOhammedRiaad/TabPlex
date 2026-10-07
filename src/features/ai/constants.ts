import { AiSettings } from './types';

export const AI_SETTINGS_KEY = 'tabplex_ai_settings';

// Every feature runs only on a click and keeps a non-AI result, so they're on by default
export const DEFAULT_AI_SETTINGS: AiSettings = {
    tabGrouping: true,
    taskDrafts: true,
    sessionNames: true,
    noteHelpers: true,
};

/** Longest a single model call may take before we give up */
export const AI_TIMEOUT_MS = 45_000;

/** Used when the session exposes no context window size or usage measurement */
export const AI_FALLBACK_CHAR_BUDGET = 6_000;

/** A tab title longer than this is cut (titles are the bulk of every prompt) */
export const AI_MAX_TITLE_CHARS = 80;
