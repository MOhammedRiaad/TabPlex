// "Organize tabs": create and undo the Chrome tab groups the user confirmed in the preview.
// Tab and group changes run in the background (TabPlex rule). See docs/specs/AI_TAB_GROUPING.md §10.
import { ExtensionMessage } from '../types';
import { isCapturableUrl } from '../utils/taskContext';
import {
    ApplyGroupsPayload,
    ApplyGroupsResponse,
    CreatedGroup,
    GROUP_NAME_MAX,
    MIN_TABS_PER_GROUP,
    ORGANIZE_MESSAGES,
    UndoGroupsPayload,
    UndoGroupsResponse,
    isTabGroupColor,
} from '../utils/organizeTabs';

const NO_GROUP = -1;

type TabIdList = [number, ...number[]];

/**
 * Re-checks every tab first: seconds or minutes may have passed since the preview. A tab must still be in the
 * window, unpinned, ungrouped and a web page. The ungrouped check means we never take a tab out of a user's
 * group or the active Park & Resume task's group.
 */
export async function applyGroups(payload: ApplyGroupsPayload): Promise<ApplyGroupsResponse> {
    const base = chrome.runtime.getURL('');
    const created: CreatedGroup[] = [];
    const skipped: number[] = [];
    const used = new Set<number>();

    for (const group of payload.groups) {
        const kept: number[] = [];
        for (const id of group.tabIds) {
            const tab = used.has(id) ? undefined : await chrome.tabs.get(id).catch(() => undefined);
            const ok =
                tab !== undefined &&
                tab.windowId === payload.windowId &&
                !tab.pinned &&
                (tab.groupId ?? NO_GROUP) === NO_GROUP &&
                isCapturableUrl(tab.url || tab.pendingUrl, base);
            if (ok) {
                kept.push(id);
                used.add(id);
            } else if (!used.has(id)) {
                skipped.push(id);
            }
        }

        if (kept.length < MIN_TABS_PER_GROUP) {
            skipped.push(...kept);
            continue;
        }

        const title = group.title.slice(0, GROUP_NAME_MAX);
        const color = isTabGroupColor(group.color) ? group.color : 'grey';
        try {
            const groupId = await chrome.tabs.group({
                tabIds: kept as TabIdList,
                createProperties: { windowId: payload.windowId },
            });
            await chrome.tabGroups.update(groupId, { title, color, collapsed: payload.collapsed });
            created.push({ groupId, title, color, tabIds: kept });
        } catch (error) {
            // e.g. the window closed meanwhile: skip this group, keep going
            console.warn('Organize: could not create a group', error);
            skipped.push(...kept);
        }
    }

    return { success: true, created, skippedTabIds: skipped };
}

/** Ungroup the tabs of groups we created (groups already gone are ignored) */
export async function undoGroups(payload: UndoGroupsPayload): Promise<UndoGroupsResponse> {
    let ungroupedTabs = 0;
    for (const groupId of payload.groupIds) {
        const exists = await chrome.tabGroups.get(groupId).then(
            () => true,
            () => false
        );
        if (!exists) continue;
        const ids = (await chrome.tabs.query({ groupId }))
            .map(t => t.id)
            .filter((id): id is number => id !== undefined);
        if (ids.length === 0) continue;
        await chrome.tabs.ungroup(ids as TabIdList);
        ungroupedTabs += ids.length;
    }
    return { success: true, ungroupedTabs };
}

export const ORGANIZE_MESSAGE_TYPES: string[] = Object.values(ORGANIZE_MESSAGES);

export function handleOrganizeMessage(
    message: ExtensionMessage,
    sendResponse: (response: ApplyGroupsResponse | UndoGroupsResponse) => void
): true {
    const run = async (): Promise<ApplyGroupsResponse | UndoGroupsResponse> => {
        switch (message.type) {
            case ORGANIZE_MESSAGES.APPLY:
                return applyGroups(message.payload as ApplyGroupsPayload);
            case ORGANIZE_MESSAGES.UNDO:
                return undoGroups(message.payload as UndoGroupsPayload);
            default:
                return { error: `Unknown organize message: ${message.type}` };
        }
    };

    run()
        .then(sendResponse)
        .catch((error: unknown) => {
            console.error('Organize tabs error', error);
            try {
                sendResponse({ error: (error as Error).message });
            } catch {
                // Channel closed
            }
        });

    return true;
}
