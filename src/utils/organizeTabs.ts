// "Organize tabs": shared between the UI and the background service worker. Keep free of DOM and React.
// See docs/specs/AI_TAB_GROUPING.md

export type TabGroupColor = `${chrome.tabGroups.Color}`;

/** Order used when assigning and cycling colours. 'grey' last: it's the least distinguishable. */
export const GROUP_COLORS: TabGroupColor[] = [
    'blue',
    'red',
    'yellow',
    'green',
    'pink',
    'purple',
    'cyan',
    'orange',
    'grey',
];

/** Folder colour (hex) used by "Save as board" for each Chrome group colour */
export const FOLDER_HEX_FOR_GROUP_COLOR: Record<TabGroupColor, string> = {
    grey: '#6b7280',
    blue: '#3b82f6',
    red: '#ef4444',
    yellow: '#eab308',
    green: '#22c55e',
    pink: '#ec4899',
    purple: '#a855f7',
    cyan: '#06b6d4',
    orange: '#f97316',
};

export const MIN_TABS_TO_ORGANIZE = 4;
export const MIN_TABS_PER_GROUP = 2;
export const MAX_GROUPS = 8;
export const GROUP_NAME_MAX = 24;
/** Upper bound sent to the model even if the context window would allow more */
export const MAX_TABS_FOR_AI = 60;

export const ORGANIZE_MESSAGES = {
    APPLY: 'TABS_APPLY_GROUPS',
    UNDO: 'TABS_UNDO_GROUPS',
} as const;

export interface GroupToCreate {
    title: string;
    color: TabGroupColor;
    /** chrome.tabs.Tab ids, in the order they should appear */
    tabIds: number[];
}

export interface ApplyGroupsPayload {
    windowId: number;
    groups: GroupToCreate[];
    collapsed: boolean;
}

export interface CreatedGroup {
    groupId: number;
    title: string;
    color: TabGroupColor;
    tabIds: number[];
}

export interface ApplyGroupsResponse {
    success?: boolean;
    error?: string;
    created?: CreatedGroup[];
    /** Tabs that were closed, moved to another window, pinned or grouped since the preview */
    skippedTabIds?: number[];
}

export interface UndoGroupsPayload {
    groupIds: number[];
}

export interface UndoGroupsResponse {
    success?: boolean;
    error?: string;
    ungroupedTabs?: number;
}

export const isTabGroupColor = (value: unknown): value is TabGroupColor =>
    typeof value === 'string' && (GROUP_COLORS as string[]).includes(value);
