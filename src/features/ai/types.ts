/** Chrome's availability values, plus 'unsupported' when the browser has no Prompt API at all */
export type ModelAvailability = 'unsupported' | 'unavailable' | 'downloadable' | 'downloading' | 'available';

export type AiErrorCode =
    | 'unsupported' // no LanguageModel global
    | 'unavailable' // device can't run the model
    | 'download-failed' // create() rejected while downloading
    | 'too-large' // input could not be made to fit the context window
    | 'bad-output' // not JSON, or failed validation twice
    | 'timeout' // no answer within the time limit
    | 'aborted'; // the user cancelled

export class AiError extends Error {
    constructor(
        public readonly code: AiErrorCode,
        message: string
    ) {
        super(message);
        this.name = 'AiError';
    }
}

/** Per-feature switches. Stored in chrome.storage.local under AI_SETTINGS_KEY. */
export interface AiSettings {
    /** "Organize tabs" uses the model when available (otherwise it groups by site) */
    tabGrouping: boolean;
    /** "New task from tabs" pre-fills the form with the model when available */
    taskDrafts: boolean;
}

/** A browser tab that an AI feature may look at and act on */
export interface OrganizableTab {
    /** chrome.tabs.Tab.id */
    id: number;
    windowId: number;
    title: string;
    url: string;
    favicon?: string;
}
