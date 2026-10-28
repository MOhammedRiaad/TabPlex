# Spec: Pre-release fixes, PR 1 (release blockers)

|             |                                                                                                                                                                         |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**  | Implemented on `feature/pre-release-fixes`; browser-tested (Chrome 156, Edge 157) and human-verified 2026-10-28 (`07-human-signoff.md`, pass). Q1 and Q2 approved at G2 |
| **Owner**   | Mohamed                                                                                                                                                                 |
| **Created** | 2026-10-25                                                                                                                                                              |
| **Branch**  | `feature/pre-release-fixes`, cut from `develop` @ `9cd9a39` (PR #67 is already merged)                                                                                  |
| **Source**  | Mohamed's pre-release audit of `develop` against `main` (`v1.3.0`, `82fb732`), corrected by `.claude/work/pre-release-fixes/03-challenge.md`                            |

The audit is split into three PRs (challenge C14). This spec is **PR 1**: the fixes that should land before `develop`
goes to `main`. PR 2 (recorded pages reaching the UI) and PR 3 (message sender check, error toasts, markdown and
study-note retry) get their own specs and cycles. §15 records their corrected scope.

---

## 1. Problem

`develop` @ `9cd9a39` holds PRs #62 to #67 on top of `v1.3.0`. The audit and the challenge, checked against the code,
leave these problems for this PR:

| ID  | Severity                               | Summary                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Evidence                                                                                                  |
| --- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| F1  | Low (data loss in the background copy) | `DELETE_FOLDER` with `moveTabs: true` broadcasts only `{ id }`. Other open TabPlex tabs then call `deleteFolderSilently(id)`, which defaults `moveTabs` to `false` and drops the tabs. Their `syncTabs` effect then deletes those tabs from the **shared** IndexedDB, so the loss survives a reload. **Reachable through the folder delete dialog since the fix round for T1**: "Move tabs to another folder" in `FolderDeleteModal` now sends `DELETE_FOLDER { id, moveTabs: true, targetFolderId }` through `BoardNode.handleMoveAndDelete` -> `BoardView.handleDeleteFolder` -> `deleteFolder(id, true, targetFolderId)`. (This spec first said that no UI sends `moveTabs`. That was wrong: the dialog existed, but it moved the tabs with one `UPDATE_TAB` each and then sent a plain `DELETE_FOLDER`, so it never reached this path. Browser test finding T1 showed the result: the background copy `tabboard_tabs` lost the moved tabs while the UI and IndexedDB kept them.) `deleteBoardWithContents` still moves folders with `updateFolder` (`boardSlice.ts:61-62`). | `folder-service.ts:42`, `useStorageSync.ts:347-349`, `boardSlice.ts:152-158`, `useStorageSync.ts:173-177` |
| F4a | High (privacy)                         | "Clear All Data" calls `chrome.storage.local.clear()` (`SettingsView.tsx:49`). That also deletes `tabplex_track_all_tabs`, and `isTrackingEnabled()` treats a missing key as **on** (`tabTracking.ts:27`). A user who opted out of "Record every page I open" is silently recorded again after clearing. This contradicts PRIVACY.md:130 ("off by default").                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | `SettingsView.tsx:43-59`, `utils/tabTracking.ts:24-31`, `background/tab-service.ts:22`                    |
| F4b | Medium (data comes back)               | Clearing sends nothing to other open TabPlex tabs. They keep the old data in memory, and the next change in any of them makes its sync effects write every stale item back into IndexedDB (`useStorageSync.ts:105-277`). The same race hits the Settings tab itself during its 1.5 s "Reloading..." delay if another tab creates the default board. The background could not relay a broadcast anyway: it ignores every `STORAGE_*` message (`message-handler.ts:31-33`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | `SettingsView.tsx:43-59`, `useStorageSync.ts:105-277`, `BoardView.tsx:75-99`                              |
| F4c | High (privacy, found in Rev 1)         | A 2.0.0 import is a full settings restore: keys missing from the file are **removed** (`exportImport.ts:126-129`). Files exported by `v1.3.0` never contain `tabplex_track_all_tabs` (the key is not in `EXTENSION_SETTING_KEYS` on `origin/main`). Importing such a file, or restoring a backup made from one, turns recording back on for an opted-out user.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | `exportImport.ts:41-47, 116-139`; `git show origin/main:src/utils/exportImport.ts`                        |
| F3  | Medium (app shows empty)               | Import validation checks only `name`/`title`/`content`, ids, urls and two enums (`importValidation.ts:46-54, 81-149`). A board without a string `createdAt` makes `a.createdAt.localeCompare` throw at `useStorageSync.ts:90`; `loadData` rejects, `isInitialized` stays false and the app shows nothing with sync off. Wrong-typed `tags`, `Session.tabIds`, `Task.tabIds` and `Task.checklist` crash views (`SearchBar.tsx:31,102`, `SessionsView.tsx:312`, `TaskCard.tsx:31,168-174`). Folders whose board is missing are invisible on every board (`utils/boards.ts:11`). `settings` is never shape-checked (`exportImport.ts:138`). `restoreImportBackup` has no rollback after `clearAllData()` (`exportImport.ts:351-357`).                                                                                                                                                                                                                                                                                                                                              | `importValidation.ts`, `exportImport.ts`, `useStorageSync.ts:90`                                          |
| D2  | Medium (undisclosed activity)          | `a282fd4` (on `develop` only, not in `origin/main`) moved `inferSessions` from a `setInterval` that rarely fired in a sleeping worker to a 30-minute `chrome.alarms` alarm. It now writes a "Recent Activity Session" about every 30 minutes (about 48 a day, never pruned), and they show up in Sessions through `fetchSessions` (`SessionsView.tsx:37`). PRIVACY.md:121-124, README.md:323 and CHROMEWEBSTORE.md:143 say `alarms` is used only for the daily cleanup. The `onStartup` inference (`session-service.ts:112-115`) **is** in `v1.3.0`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | `session-service.ts:62-115`, `services.test.ts:579-634`                                                   |
| F7  | Low (docs, CI)                         | CHROMEWEBSTORE.md Version History (`:209-213`) skips `1.1.0`, `1.2.0`, `1.3.0` and its `next` row is stale. `docs/DATA_FLOW.md` does not mention `respondWith`, `IMPORT_ALL_DATA` / `STORAGE_DATA_IMPORTED`, `tabplex_import_backup` or the folder-delete payload. README.md:60 and `onboarding.html:99` promise "automatic session inference". SECURITY_HARDENING.md:5 calls the inference alarm done. `ci.yml:31` keeps `npm audit` non-blocking.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | listed                                                                                                    |

Not true, and therefore not fixed here (challenge C7): "Clear All Data leaves `history_items` and
`tabplex_active_context_task_id`". `chrome.storage.local.clear()` already removes both. `clearAllData` in
`background/storage.ts` is never called by the UI.

## 2. Goals / non-goals

### Goals (each is an acceptance criterion, AC)

1. **AC1 (F1).** With two TabPlex tabs open, `DELETE_FOLDER { id: A, moveTabs: true, targetFolderId: B }` leaves every
   tab of A in folder B in the second tab's store, in IndexedDB and in `chrome.storage.local`, also after reloading the
   second tab. When `targetFolderId` is omitted, all three places use `''` (unfiled).
2. **AC2 (F4a).** After Clear All Data, `chrome.storage.local.tabplex_track_all_tabs` is `false`, whatever it was before
   (`true`, `false` or missing). Loading a web page afterwards adds nothing to `tabboard_tabs`.
3. **AC3 (F4b).** After Clear All Data in one TabPlex tab, every other open TabPlex tab reloads within 2 s. 3 s after
   the click, IndexedDB and `chrome.storage.local` hold none of the boards, folders, tabs, tasks, notes, sessions or
   history from before. The only board allowed is the single `default_board` ("My Board") that BoardView creates on
   first view, as on a fresh install.
4. **AC4 (F4c).** Importing a file (or restoring a backup) whose `settings.extension` lacks `tabplex_track_all_tabs`
   leaves the current value as it is: `false` stays `false`, `true` stays `true`, missing stays missing.
5. **AC5 (F3, dates).** An item in any collection without `createdAt` imports with
   `createdAt: '1970-01-01T00:00:00.000Z'` and one warning per collection. A `createdAt` that is present but not text rejects
   the file. The app loads, and boards are listed, even when IndexedDB already holds a board without `createdAt`.
6. **AC6 (F3, lists and settings).** A file is rejected, with a message naming the field, when any of these is present
   and has the wrong type: `tags` on tabs, tasks or notes (list of text); `Session.tabIds` and `Task.tabIds` (list of
   text); `Task.checklist` (list of `{ id: text, text: text, completed: true/false }`); `settings`, `settings.extension`,
   `settings.page`, `settings.timer` and `data.canvasSettings` (objects; `canvasSettings` may be `null`). A session
   without `tabIds` gets `[]` and a warning. Timer values whose key or type the app does not know are dropped.
7. **AC7 (F3, orphans).** A folder whose `boardId` is empty or names a board not in the file is attached to
   `default_board`. That board is created when the file has none (`name: 'My Board'`, `color: '#3b82f6'`). The
   import summary shows a warning with the count. Tabs are **never** re-parented: `folderId: ''` (session tabs, unfiled
   tabs) and dangling `folderId`s are kept as they are.
8. **AC8 (F3, restore).** When `restoreImportBackup` fails after it has started writing, IndexedDB and the background
   hold the data from before the restore, and the original error is thrown.
9. **AC9 (D2).** The background creates no `tabplex-infer-sessions` alarm, clears one left by an earlier build when the
   worker starts, and creates no session on its own (no alarm, no browser start). Sessions → Infer works as before.
10. **AC10 (F7).** The docs listed in §8 are updated. `npm audit --omit=dev --audit-level=high` is a blocking CI step,
    and it passes.
11. **AC11.** `verify` passes (coverage gate 95% on all four metrics, no new exclusions), and `npm run test:e2e` passes,
    including the new cross-tab spec.

### Non-goals

- Recorded pages reaching the UI, and `syncTabs` cost (PR 2, §15).
- Sender check, `CREATE_TAB_IN_FOLDER`, error toasts, markdown and Retry (PR 3, §15).
- A new "move tabs to…" choice in the folder delete UI. The dialog already has one; the fix round for T1 only changes what it sends (one `DELETE_FOLDER { moveTabs: true, targetFolderId }`).
- Ungrouping an active Park & Resume task's tab group on Clear All Data (dropped from the audit's Goal 4). The group
  stays as an ordinary browser tab group. TabPlex simply forgets it (`tabplex_active_context_task_id` is removed).
- Clearing the optional tldraw canvas database, which has its own storage. PRIVACY.md says so (§8).
- Re-parenting `Task.boardId` / `folderId` or `Note.boardId` / `folderId`. No view hides or crashes on dangling
  values: tasks and notes are not filtered by board (checked with a grep for `.boardId ===` in `src/features`).
- Deleting the "Recent Activity Session" entries existing users already have. They stay, and the user can delete them.
- New permissions, a `DB_VERSION` bump, or a new export format version.

## 3. Decisions

| #   | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Rejected alternative and why                                                                                                                                                                                                                                                                                                                                                                                            |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | **F1 keeps `''` (unfiled) as the default target**, and the background broadcasts the value it actually used (`targetFolderId \|\| ''`), so receivers never guess. `''` is a real state: `utils/boards.ts:20-23` shows unfiled and orphaned tabs on the board, and `boardSlice.ts:134,152` and `folder-service.ts:16` already default to it.                                                                                                                                                                                                                                                                                      | `'default_folder'` (Inbox): the Inbox may have been deleted, and deleting the Inbox itself with no target would move its tabs into the folder being deleted. Changing three defaults also changes behavior nobody asked for.                                                                                                                                                                                            |
| D2  | **Remove all background session inference**: the 30-minute alarm, the `onStartup` timer, `inferSessions` and `SESSION_INFERENCE_COMPLETE`. Clear the old alarm once at worker start. Reasons: the alarm never shipped, is not disclosed (`alarms` is documented for the daily cleanup only) and adds about 48 sessions a day that are never pruned; the startup run (in `v1.3.0`) adds an unrequested session on each browser start; once both triggers are gone, `inferSessions` is dead code. The user's **Infer** button (`SessionsView.tsx:157`, history-based, on demand) is unaffected. Needs human confirmation (§13 Q1). | (a) Keep the alarm and disclose it in PRIVACY.md: background activity the user never asked for, and the session list keeps growing. (b) Keep the startup run, gated on `isTrackingEnabled()`: it still creates sessions nobody asked for, for users who opted in to something else (recording pages), and keeps a code path with no UI. (c) Keep the audit's "`INFER_SESSIONS` on demand": that message does not exist. |
| D3  | **Clear All Data runs in the Settings tab only**: keep tracking off, empty the in-memory store, then the Settings tab sends `STORAGE_DATA_CLEARED` itself. Other tabs **reload**.                                                                                                                                                                                                                                                                                                                                                                                                                                                | A `CLEAR_ALL_DATA` background handler: `clear()` already wipes `chrome.storage.local`, so it would change nothing, and the background ignores `STORAGE_*`. A store reset in other tabs (`resetStore` does not exist): it would leave timer, tabNotes and organize state in memory, and an empty `boards` makes BoardView create `default_board` while the clear is still running.                                       |
| D4  | **After clearing, tracking is `false`** (the fresh-install default from `background-init.ts:15`), not the previous value.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Keep the previous value: a user who asked to delete everything would keep being recorded, and a legacy user whose key was missing (recording on) would stay on. Needs human confirmation (§13 Q2).                                                                                                                                                                                                                      |
| D5  | **Write the tracking key first, then remove every other key** (`set` then `remove(all keys except it)`), instead of `clear()` then `set`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | `clear()` then `set`: for one round trip the key is missing, so a page that finishes loading at that moment is recorded (`tab-service.ts:22`).                                                                                                                                                                                                                                                                          |
| D6  | **On import, a missing `tabplex_track_all_tabs` keeps the current value.** It is the only setting excluded from "missing means removed".                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Treat it like other settings (removed): F4c. Force it to `false`: a user who opted in would be switched off by restoring an old backup, which is a surprise too.                                                                                                                                                                                                                                                        |
| D7  | **Import fills a missing `createdAt` with the epoch** (`new Date(0).toISOString()`), and rejects a non-text one.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Reject the file: older or hand-edited files would become unusable for a field the user cannot see. Use "now": the UI and the background each sanitize, so the two copies could disagree, and an item without a date is best treated as the oldest.                                                                                                                                                                      |
| D8  | **Only folders are re-parented**, to `default_board` (created when missing). This deviates from SECURITY_HARDENING.md:81, which also re-parents tabs.                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Re-parent tabs to `default_folder`: it would move every session tab (`folderId: ''`, `SessionsView.tsx:116`) into the Inbox. Dangling tab folders are already shown as unfiled (`utils/boards.ts:22-23`). Attach folders to the oldest existing board: that silently mixes them into a board the user named.                                                                                                            |
| D9  | **`restoreImportBackup` reuses `importData`'s backup-apply-rollback flow** through one shared helper.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | A second snapshot path: two copies of the same rollback logic to keep in step.                                                                                                                                                                                                                                                                                                                                          |
| D10 | **No `markImportInThisTab` change.** Both success paths reload the importing tab (`App.tsx:169`, `RestoreBackupSetting.tsx:34`), so the flag dies with the page.                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Reset it in a `finally`: the importing tab could then handle its own `STORAGE_DATA_IMPORTED` (sent from inside the work promise, `data-service.ts:72`) and reload before the success toast.                                                                                                                                                                                                                             |
| D11 | **`npm audit` becomes blocking now.** It reported 0 vulnerabilities on 2026-10-25 (Node 24.15.0, npm 11.12.1, `develop` @ `9cd9a39`; `npm audit --omit=dev --audit-level=high` exited 0; info/low/moderate/high/critical all 0).                                                                                                                                                                                                                                                                                                                                                                                                 | Keep it as a warning: `ci.yml:31` said "make it blocking once it has stayed clean", and it is clean.                                                                                                                                                                                                                                                                                                                    |

## 4. User flow

1. **Folder delete across tabs (F1).** The user deletes a folder that has tabs, chooses "Move tabs to another folder"
   and a target in the dialog. The UI sends `DELETE_FOLDER` with `moveTabs: true` and the target. Every open TabPlex tab shows the moved tabs in the target folder (or unfiled), and they are still
   there after a reload.
2. **Clear All Data (F4).** The user has TabPlex open in two tabs and "Record every page I open" off. In tab 1 the user
   opens Settings → Data Management → **Clear Data** and confirms. Tab 1 shows "All data cleared. Reloading..." and
   reloads after 1.5 s. Tab 2 reloads right away. Both show an empty workspace (Boards shows one empty "My Board").
   Settings → Tab tracking & storage shows "Record every page I open" off.
3. **Import an old backup (F3, F4c).** The user imports a `v1.3.0` export with a folder whose board is missing and a
   board without `createdAt`. The preview dialog lists the counts and the warnings ("1 folder without a board was moved
   to My Board", "boards: 1 item had no creation date"). After import the app loads, the folder is on "My Board", and
   the recording setting is what it was before the import.
4. **Sessions (D2).** After updating, no new "Recent Activity Session" appears on its own. **Infer** still creates
   sessions from history when clicked.

## 5. Design

### 5.1 F1: folder delete broadcast

`src/background/folder-service.ts:42`. Keep the existing (unexported) `DeleteFolderPayload` at `:5-9`, and broadcast
what `releaseFolderTabs` used:

```ts
.then(() =>
    broadcast('STORAGE_FOLDER_DELETED', {
        id: payload.id,
        moveTabs: payload.moveTabs === true,
        targetFolderId: payload.targetFolderId || '', // the same fallback releaseFolderTabs uses (:16)
    })
)
```

`src/hooks/useStorageSync.ts:347-349`:

```ts
case 'STORAGE_FOLDER_DELETED': {
    const { id, moveTabs, targetFolderId } = event.data.payload as {
        id: string;
        moveTabs?: boolean;
        targetFolderId?: string;
    };
    // Same arguments as the tab that deleted it, or the moved tabs are dropped here and then from IndexedDB
    deleteFolderSilentlyFromStore(id, moveTabs === true, typeof targetFolderId === 'string' ? targetFolderId : '');
    break;
}
```

`deleteFolderSilently` (`boardSlice.ts:152-161`) is unchanged. The initiating tab also receives the broadcast. That is
harmless: its folder is already gone and its tabs already moved, so the second call changes nothing.

### 5.2 F4: Clear All Data

New file `src/features/settings/utils/clearEverything.ts` (UI only; imports the board store):

```ts
/**
 * Deletes every TabPlex item in this browser profile and tells the other open TabPlex tabs to reload.
 * "Record every page I open" ends up off, as on a fresh install (PRIVACY.md).
 * Throws when a step fails; the caller shows the error.
 */
export async function clearEverything(): Promise<void>;
```

Steps, in this order:

1. `localStorage.clear()`.
2. `await chrome.storage.local.set({ [TRACK_ALL_TABS_KEY]: false })` (D4, D5).
3. `const all = await chrome.storage.local.get(null)`, then
   `await chrome.storage.local.remove(Object.keys(all).filter(key => key !== TRACK_ALL_TABS_KEY))`. This removes
   `history_items`, `tabplex_active_context_task_id`, `tabplex_import_backup` / `_at`, canvases and every setting.
4. `await clearAllData()` from `utils/storage.ts:200` (IndexedDB entity stores).
5. `useBoardStore.setState({ boards: [], folders: [], tabs: [], tasks: [], notes: [], sessions: [] })`. This stops this
   tab's sync effects from writing stale items back during the 1.5 s before its reload (F4b). It runs after the
   storage steps, so a failure there leaves the page as it was.
6. `chrome.runtime.sendMessage({ type: 'STORAGE_DATA_CLEARED' }).catch(() => {})`. The background ignores it
   (`message-handler.ts:31-33`). Chrome delivers `runtime.sendMessage` to every extension frame **except the sender**,
   so the Settings tab does not receive its own message. Nobody listening is fine.

`src/features/settings/SettingsView.tsx:43-59` `handleClearData`: keep the `window.confirm`, the toast texts and the
1.5 s reload. Replace the three calls in the `try` with `await clearEverything()`. Drop the `// Made function async`
noise comment. No other UI change: the button, its `danger` styles, focus and keyboard behavior stay as they are.

`src/hooks/useStorageSync.ts`, new case next to `STORAGE_DATA_IMPORTED` (`:355-358`):

```ts
case 'STORAGE_DATA_CLEARED':
    // Another TabPlex tab deleted everything: reload so this tab can't write its old data back
    window.location.reload();
    break;
```

### 5.3 F4c: import keeps the recording choice

`src/utils/exportImport.ts:126-129`, inside `restoreCanvasesAndSettings`:

```ts
for (const key of EXTENSION_SETTING_KEYS) {
    if (extension[key] !== undefined) toSet[key] = extension[key];
    // Files from v1.3.0 and earlier have no recording setting: removing it would turn recording back on
    else if (key !== TRACK_ALL_TABS_KEY) toRemove.push(key);
}
```

A file that **has** the key still sets it, so a full restore of a new export stays exact.

### 5.4 F3: import validation (`src/utils/importValidation.ts`)

All rules live in the shared module, so the background re-check (`data-service.ts:61`) applies them too. Results must
be **idempotent**: sanitizing an already-sanitized payload changes nothing and adds no warnings, because the UI's
output is what the background receives.

1. **`createdAt`**, in `sanitizeCollection` for every collection: missing or `null` → set to `EPOCH_ISO`
   (`new Date(0).toISOString()`) and count; present and not a string → error `${name}[${i}].createdAt must be text`.
   Warning per collection: `${name}: ${n} item(s) had no creation date`.
2. **Lists**, present (not `undefined` / `null`) and wrong → error. `null` is deleted from the clean copy.
    - `tabs`, `tasks`, `notes` `.tags`: every element a string. Error `${name}[${i}].tags must be a list of text`.
    - `sessions[].tabIds`: missing → `[]` and the warning `sessions: ${n} session(s) had no tab list`; otherwise
      every element a string.
    - `tasks[].tabIds`: every element a string.
    - `tasks[].checklist` (not `checklists`): every element `{ id: string, text: string, completed: boolean }`. Error
      `tasks[${i}].checklist must be a list of { id, text, completed }`.
3. **Orphan folders**, a new private `attachOrphanFolders(collections, warnings)` called by `sanitizeCollections` only
   when there are no errors. With `boardIds = new Set(boards.map(b => b.id))`, every folder whose `boardId` is not a
   non-empty string in `boardIds` gets `boardId: 'default_board'`. If any were moved and `default_board` is not in
   `boardIds`, append
   `{ id: 'default_board', name: 'My Board', color: '#3b82f6', createdAt/updatedAt: the import time, not `EPOCH_ISO` (C5) }` (same id, name and color as `BoardView.tsx:65-71` and `saveToBoards.ts:9`). Warning:
   `folders: ${n} folder(s) without a board were moved to "My Board"`. O(n) with the `Set`.
4. **Settings shape**, new export `checkSettingsShape(file: Record<string, unknown>): string[]` that returns errors:
   `settings` (if present) is an object; `settings.extension`, `settings.page` and `settings.timer` (if present) are
   objects; `data.canvasSettings` (if present) is an object or `null`.

`src/utils/exportImport.ts`:

- `parseExportFile` (`:244-279`): after `sanitizeCollections`, add `checkSettingsShape(file)` errors to the same
  "The file is damaged: …" message.
- `restoreCanvasesAndSettings` (`:138`): pass
  `pickTimerSettings(useTimerStore.getState().settings, parsed.settings.timer)` instead of the raw object. New private helper: keep only the keys the current settings have,
  with the same `typeof`, and only finite numbers.
- D9: extract `async function applyWithRollback(parsedData: ExportData, backupJson: string): Promise<void>` from
  `importData` `:304-314` (apply; on error re-apply the backup, log a failed restore, `markImportInThisTab(false)`,
  rethrow). `importData` calls it with its backup. `restoreImportBackup` (`:351-357`) becomes:

```ts
export const restoreImportBackup = async (): Promise<void> => {
    const stored = await chrome.storage.local.get([IMPORT_BACKUP_KEY]);
    const backup = stored[IMPORT_BACKUP_KEY];
    if (typeof backup !== 'string') throw new Error('There is no backup to restore');
    const { parsedData } = parseExportFile(backup);
    // The current data, so a failed restore can be undone. The stored backup itself stays.
    await applyWithRollback(parsedData, await exportData());
};
```

`src/hooks/useStorageSync.ts:90` (data already in IndexedDB can lack the date too, not only imports):

```ts
boards: storedBoards.sort((a, b) => String(a.createdAt ?? '').localeCompare(String(b.createdAt ?? ''))),
```

### 5.5 D2: background session inference removed

`src/background/session-service.ts`:

- Delete `inferSessions` (`:62-99`), the alarm block (`:101-109`) and the `onStartup` listener (`:111-115`).
- Delete the `SESSION_INFERENCE_COMPLETE` case (`:53-56`). In `message-handler.ts:150` delete the matching `case`. A
  stray one then gets the normal "Unknown message type" error (`:180-181`).
- Remove `getAllTabs` from the import if it is no longer used.
- Add at top level:

```ts
// Builds from before this release created a 30-minute session inference alarm. Remove it: TabPlex no longer infers
// sessions in the background (docs/specs/PRE_RELEASE_REVIEW_FIXES.md D2). Safe to delete after the next release.
const LEGACY_INFER_SESSIONS_ALARM = 'tabplex-infer-sessions';
chrome.alarms.clear(LEGACY_INFER_SESSIONS_ALARM).catch(() => {});
```

`src/test/chromeMock.ts:144-150`: add `clear: vi.fn(async (name: string) => alarmStore.delete(name))` to `alarms`.

`src/background/__tests__/noIntervals.test.ts:6`: the comment names `session-service.ts`; change it to
`cleanup-service.ts` only.

## 6. Data, storage and migration

- **Types**: no change to `src/types/index.ts`. `ExtensionMessage.type` is a plain string (`types/index.ts:222-225`).
- **IndexedDB**: no new store and no `DB_VERSION` change (`utils/storage.ts:5`), so no upgrade guard is needed.
- **chrome.storage.local**: no new key. `tabplex_track_all_tabs` is written as `false` by Clear All Data (D4).
- **Existing users, by item**:
    - Opted-out users who clear their data stay opted out. Legacy users whose key is missing (recording on, by
      `tabTracking.ts:20-23`) and users who opted in end up with recording **off** after Clear All Data, as on a fresh
      install. Nothing changes for them otherwise.
    - Develop and beta installs that registered `tabplex-infer-sessions` lose the alarm at the next worker start.
      Their existing auto sessions stay.
    - Import files from `v1.0.0` to `v1.3.0` still import (format `1.0.0` or `2.0.0`). Dates, lists and orphan folders
      are repaired as in §5.4, and only wrong types reject the file. Before this change such files either imported or
      crashed the app after reload, so no previously working file is newly rejected, except files with wrong-typed
      lists or settings that would have crashed a view.
- **Export**: unchanged (`EXPORT_VERSION` stays `2.0.0`).

## 7. Message and sync

| Message                      | Direction                     | Payload                                                     | Change and receiver                                                                       |
| ---------------------------- | ----------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `STORAGE_FOLDER_DELETED`     | background → UI tabs          | `{ id: string; moveTabs: boolean; targetFolderId: string }` | Was `{ id }`. `useStorageSync` calls `deleteFolderSilently(id, moveTabs, targetFolderId)` |
| `STORAGE_DATA_CLEARED`       | Settings tab → other UI tabs  | none                                                        | New. Background ignores it (`STORAGE_*` rule). `useStorageSync` reloads the page          |
| `SESSION_INFERENCE_COMPLETE` | (was background → background) | (session)                                                   | Removed with `inferSessions`                                                              |

Echo-loop check:

- `deleteFolderSilently` sends nothing (`boardSlice.ts:152-161`), and the receiving tab's `syncTabs` writes the moved
  tabs to IndexedDB without messages. No loop.
- `STORAGE_DATA_CLEARED` is a `STORAGE_*` type, so the background never answers or re-broadcasts it. Receivers reload
  and do not reply. The Settings tab does not receive its own message.
- After reloading, a tab on Boards may create `default_board` with `addBoard` (`BoardView.tsx:86`), which sends
  `ADD_BOARD` once. `saveBoard` broadcasts `STORAGE_BOARD_ADDED` only when it creates the board
  (`message-handler.ts:92-94`), and `addBoardSilently` ignores a known id (`boardSlice.ts:39`). Several tabs reloading
  at once each send one `ADD_BOARD` for the same id, which ends as one board. `hasCheckedForDefaultBoard` stops a
  second attempt per mount, so this is no loop.
- No new asynchronous background handler, so no new `return true` / `respondWith` site.

## 8. Permissions, privacy and docs

- **Manifest**: no change.
- **PRIVACY.md** "Data Deletion" (`:197-203`): add an option "Settings → Data Management → Clear All Data deletes your
  boards, folders, tabs, tasks, notes, sessions, history, canvases and settings, including the backup kept from your
  last import, and turns "Record every page I open" off. The optional tldraw canvas keeps its own storage: remove it by
  uninstalling (Option 1)." Then run `npm run build:privacy` (CI checks it, `ci.yml:35`).
- **PRIVACY.md `alarms`** (`:121-124`), **README.md:323**, **CHROMEWEBSTORE.md:143**: no change. After D2 they are
  accurate.
- **README.md:60**: "Automatic session inference based on browsing patterns" → "Infer sessions from your recent
  browser history when you click Infer in Sessions".
- **onboarding.html:99**: "automatic inference from browsing patterns" → "sessions you can infer from your recent
  history".
- **CHROMEWEBSTORE.md Version History** (`:209-213`): add rows `1.3.0` (2026-10-20), `1.2.0` (2026-10-07) and
  `1.1.0` (2026-10-05), one line each from `CHANGELOG.md`. Rewrite `next` to list what is on `develop` since `v1.3.0`:
  Summarize open tabs into a note (optional site access); "Record every page I open" is off for new installs; a daily
  cleanup of old recorded tabs (`alarms`); restore the data kept from before the last import; storage usage in
  Settings; Clear All Data keeps recording off. Status of the new rows: §13 Q3.
- **docs/DATA_FLOW.md**: add a "Replies and bulk operations" section: `respondWith` replies (`{ success: true }` or the
  mapped value, `{ error }` on failure or timeout, never a fake success, `respond.ts:31-61`); `IMPORT_ALL_DATA` →
  `STORAGE_DATA_IMPORTED` (other tabs reload, the importing tab reloads itself, `isImportInThisTab`) and
  `tabplex_import_backup` / `_at`; Clear All Data (`STORAGE_DATA_CLEARED` sent by the UI, since the background ignores
  `STORAGE_*`); the folder-delete payload.
- **docs/specs/SECURITY_HARDENING.md:5** status: "Implemented. The 30-minute session inference alarm from `a282fd4`
  was removed again (PRE_RELEASE_REVIEW_FIXES D2). Referential integrity re-parents folders only (PRE_RELEASE_REVIEW_FIXES
  D8). `context-service`, …" (keep the rest of the line).
- **.github/workflows/ci.yml:29-31**: delete `continue-on-error: true` and its comment (D11).
- **Commit and changelog wording**: the `fix(background)` commit for D2 must say that browser start no longer creates
  a session, because that changes `v1.3.0` behavior.

## 9. Edge cases

| #   | Case                                                                 | Behavior                                                                                                                                                        |
| --- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | F1, `targetFolderId` omitted                                         | Background, initiator and receivers all use `''`; tabs show as unfiled                                                                                          |
| 2   | F1, target is the deleted folder, or a folder deleted meanwhile      | Tabs keep a dangling `folderId` and show as unfiled (`boards.ts:22-23`). Nothing is lost                                                                        |
| 3   | F1, a TabPlex tab opened before the extension update (old code)      | Old receivers ignore the extra fields and behave as before; the next reload loads the new code                                                                  |
| 4   | F1, no other TabPlex tab open                                        | `broadcast` swallows "no receiver" (`respond.ts:19`)                                                                                                            |
| 5   | Clear, only one TabPlex tab open                                     | `sendMessage` resolves or rejects with no receiver; the rejection is caught                                                                                     |
| 6   | Clear, another tab has an open dialog or an unsaved form             | It reloads and the unsaved input is lost. Accepted: the user asked to delete everything                                                                         |
| 7   | Clear, a step fails (quota, IndexedDB blocked)                       | Error toast "Failed to clear data", no broadcast, store not emptied. Steps already done stay done (as today); the user can retry                                |
| 8   | Clear, a page finishes loading during the clear                      | The key is `false` before anything is removed (D5), so the page is not recorded                                                                                 |
| 9   | Clear, worker asleep                                                 | `sendMessage` wakes it; it ignores `STORAGE_*`. Other UI tabs still receive the message                                                                         |
| 10  | Clear, onboarding page open                                          | It has no `useStorageSync`; nothing happens                                                                                                                     |
| 11  | Clear, active Park & Resume task                                     | The tab group stays in the browser; TabPlex forgets it                                                                                                          |
| 12  | Clear, then the user turns recording on                              | Recorded tabs go to `default_folder`, which no longer exists, and show as unfiled when they reach the UI (PR 2)                                                 |
| 13  | Import, 20 MB file with many folders                                 | Size cap unchanged (`MAX_IMPORT_CHARS`); the orphan pass is O(n) with a `Set`                                                                                   |
| 14  | Import, session tabs with `folderId: ''` or tabs in a missing folder | Unchanged (D8)                                                                                                                                                  |
| 15  | Import, file already has `default_board` and orphan folders          | Folders move to it; no board is added                                                                                                                           |
| 16  | Import, `tags: null`                                                 | Treated as missing; the field is dropped from the clean copy                                                                                                    |
| 17  | Import in one tab with other tabs open                               | Unchanged: they reload on `STORAGE_DATA_IMPORTED`                                                                                                               |
| 18  | Restore a backup made from a `v1.3.0`-era export                     | Recording setting kept (D6); data restored or rolled back (D9)                                                                                                  |
| 19  | Restore fails and the rollback fails too                             | Logged (`Could not restore the data after a failed restore`), original error thrown, toast shown by `RestoreBackupSetting`. Same behavior as `importData` today |
| 20  | D2, worker restarts often                                            | `alarms.clear` runs at each start and resolves `false` when there is nothing to clear                                                                           |
| 21  | D2, the old alarm fires in the same wake-up before `clear`           | No `onAlarm` listener handles it any more; it is dropped                                                                                                        |
| 22  | Offline, multi-window                                                | Nothing here uses the network. Windows do not matter: every TabPlex tab in any window of the profile receives the runtime messages                              |

## 10. Files

### Create

- `src/features/settings/utils/clearEverything.ts`: `clearEverything()` (§5.2).
- `src/features/settings/__tests__/clearEverything.test.ts`.
- `e2e/cross-tab-sync.spec.ts`: the two cross-tab tests (§11).
- `e2e/data-lifecycle.spec.ts`: Clear All Data, import, Infer and folder delete through the UI (two TabPlex tabs).
- Unit tests for T1/U1 and the review rounds: `src/features/boards/__tests__/FolderMoveDelete.test.tsx`,
  `FolderDeleteRegression.test.tsx`, `src/background/__tests__/preReleaseFixes.test.ts`,
  `src/utils/__tests__/preReleaseImport.test.ts`, `importWarningsPlural.test.ts`,
  `src/hooks/__tests__/useStorageSyncPreRelease.test.tsx`, `src/features/settings/__tests__/clearEverythingOrder.test.tsx`,
  `SettingsWording.test.tsx`.

### Modify

- `src/background/folder-service.ts`: broadcast payload (§5.1).
- `src/hooks/useStorageSync.ts`: `STORAGE_FOLDER_DELETED` arguments, `STORAGE_DATA_CLEARED`, safe board sort.
- `src/features/settings/SettingsView.tsx`: `handleClearData` calls `clearEverything`.
- `src/features/boards/components/BoardNode.tsx`, `BoardList.tsx`, `BoardView.tsx`, `src/store/slices/board/boardSlice.ts`:
  the folder delete dialog sends one `DELETE_FOLDER` with `moveTabs` and `targetFolderId`, and "delete folder and all
  tabs" also removes the tabs from IndexedDB (T1/U1, Revision 2).
- `src/utils/exportImport.ts`: tracking key kept, `checkSettingsShape`, `pickTimerSettings`, `applyWithRollback`,
  `restoreImportBackup` rollback.
- `src/utils/importValidation.ts`: `createdAt`, list rules, `attachOrphanFolders`, `checkSettingsShape`.
- `src/background/session-service.ts`, `src/background/message-handler.ts`: D2.
- `src/test/chromeMock.ts`: `alarms.clear`.
- Tests: `src/hooks/__tests__/useStorageSync.test.tsx`, `src/background/__tests__/services.test.ts`,
  `src/background/__tests__/noIntervals.test.ts` (comment), `src/features/settings/__tests__/Settings.test.tsx`,
  `src/utils/__tests__/importValidation.test.ts`, `src/utils/__tests__/exportImport.test.ts`.
- Docs and CI: `PRIVACY.md` + `landing-page/privacy.html` (generated), `README.md`, `onboarding.html`,
  `CHROMEWEBSTORE.md`, `docs/DATA_FLOW.md`, `docs/specs/SECURITY_HARDENING.md`, `.github/workflows/ci.yml`, this spec.

No change to `manifest.json`, `src/types/index.ts`, `utils/storage.ts` or `background/storage.ts`.

## 11. Tests (traceability)

Rules: tests sit in the existing files above. Background modules are re-imported per test (`vi.resetModules()`).
**Every test for a fixed bug must fail on `develop` @ `9cd9a39`**; the engineer records that red run in
`04-build-log.md`. Coverage stays ≥ 95% on all four metrics with no new exclusion. Note for writers: the chrome mock
delivers `sendMessage` to every listener, the sender's own included (`chromeMock.ts:166-169`); Chrome does not.

| AC       | Design     | Test file                                                                                                  | What it checks                                                                                                                                                                                                                                                                                                                                                                                                                          |
| -------- | ---------- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC1      | §5.1       | `services.test.ts` (extend `:551`)                                                                         | `DELETE_FOLDER` broadcasts `{ id, moveTabs: true, targetFolderId: 'f2' }`; with no target, `targetFolderId: ''`; without `moveTabs`, `moveTabs: false`                                                                                                                                                                                                                                                                                  |
| AC1      | §5.1       | `useStorageSync.test.tsx` (next to `:157`)                                                                 | `STORAGE_FOLDER_DELETED { id, moveTabs: true, targetFolderId: 'f2' }` keeps the tabs in the store with `folderId: 'f2'`, and IndexedDB still has them after the sync effect; `{ id }` alone still drops them (existing test)                                                                                                                                                                                                            |
| AC1      | §5.1, §7   | `e2e/cross-tab-sync.spec.ts` "folder delete keeps moved tabs" (T1 round: also drive it through the dialog) | Seed folders A, B and a tab in A (IndexedDB + `ADD_FOLDER` / `ADD_TAB`, as `seedTask` does). Open two app pages on `#/boards`. From page 1, `chrome.runtime.sendMessage({ type: 'DELETE_FOLDER', payload: { id: A, moveTabs: true, targetFolderId: B } })`. Page 2 shows the tab and not folder A; after reloading page 2 the tab is still there; `tabboard_tabs` and IndexedDB have it with `folderId: B`                              |
| AC2      | §5.2       | `clearEverything.test.ts`                                                                                  | For a stored key of `true`, `false` and missing: afterwards `get(null)` is exactly `{ tabplex_track_all_tabs: false }`; `set` was called before `remove`; `localStorage` and IndexedDB are empty                                                                                                                                                                                                                                        |
| AC2      | §5.2       | `Settings.test.tsx` (update `:75-96`)                                                                      | Confirmed clear shows the toast, tracking is `false`, reload after 1.5 s; cancel changes nothing; a rejected `remove` shows "Failed to clear data" and sends no `STORAGE_DATA_CLEARED`                                                                                                                                                                                                                                                  |
| AC3      | §5.2       | `clearEverything.test.ts`                                                                                  | Store is empty afterwards and `STORAGE_DATA_CLEARED` was sent after the storage steps; a later `STORAGE_BOARD_ADDED` in this tab does not bring old boards back into IndexedDB; a failing step leaves the store as it was                                                                                                                                                                                                               |
| AC3      | §5.2       | `useStorageSync.test.tsx`                                                                                  | `STORAGE_DATA_CLEARED` calls `window.location.reload`                                                                                                                                                                                                                                                                                                                                                                                   |
| AC2, AC3 | §5.2, §7   | `e2e/cross-tab-sync.spec.ts` "clear all data across tabs"                                                  | Seed a task and set tracking `false`. Page 2 on `#/boards` with a `window` marker. Page 1 on `#/settings`, accept the dialog, click **Clear Data**. Page 2 reloads within 2 s (marker gone). At 3 s: IndexedDB `tasks` empty, `tabboard_tasks` empty or missing, at most one board (`default_board`), `tabplex_track_all_tabs === false` (via `serviceWorker.evaluate`). Then open `site('after-clear')`: `tabboard_tabs` gains nothing |
| AC4      | §5.3       | `exportImport.test.ts` (update `:289-301`)                                                                 | A 2.0.0 file without the key keeps `false`, keeps `true`, keeps missing; a file with the key sets it; all other listed settings are still removed when missing                                                                                                                                                                                                                                                                          |
| AC5      | §5.4.1     | `importValidation.test.ts`                                                                                 | Missing `createdAt` in each collection → epoch + one warning per collection; `createdAt: 5` → error naming the field; running `sanitizeCollections` on its own output gives the same value and no warnings                                                                                                                                                                                                                              |
| AC5      | §5.4       | `useStorageSync.test.tsx`                                                                                  | A board in IndexedDB without `createdAt` loads; boards are hydrated and sorted (undated first)                                                                                                                                                                                                                                                                                                                                          |
| AC6      | §5.4.2, .4 | `importValidation.test.ts`, `exportImport.test.ts`                                                         | Each wrong type (`tags: 'a'`, `tags: [1]`, `tabIds: 'x'`, `checklist: [{ id: 1 }]`, `settings: 'x'`, `settings.timer: 3`, `canvasSettings: []`) rejects with its field name; `tags: null` passes; session without `tabIds` → `[]` + warning; unknown and wrong-typed timer keys are not applied (`useTimerStore` settings unchanged for them)                                                                                           |
| AC7      | §5.4.3     | `importValidation.test.ts`                                                                                 | Folder with unknown `boardId` and with `''` → `default_board`, board synthesized once with the stated fields, warning count; existing `default_board` reused; tab with `folderId: ''` and with a dangling id unchanged                                                                                                                                                                                                                  |
| AC7      | §5.4       | `exportImport.test.ts` (`previewImport`)                                                                   | The summary lists the re-parenting warning                                                                                                                                                                                                                                                                                                                                                                                              |
| AC8      | §5.4 (D9)  | `exportImport.test.ts` (in "restoring the backup", `:179`)                                                 | Background replies `{ error }` during `restoreImportBackup` → IndexedDB tasks are the pre-restore ones, the error is thrown, the stored backup is unchanged                                                                                                                                                                                                                                                                             |
| AC9      | §5.5       | `services.test.ts` (replace `:573-576` and `:579-634`)                                                     | After import, `alarms.create` was never called with `'tabplex-infer-sessions'` and `alarms.clear` was called with it; a stored legacy alarm is gone; `events.startup.emit()` plus 5 s of fake time and an `alarm` emit with that name create no `tabboard_sessions`; `SESSION_INFERENCE_COMPLETE` gets "Unknown message type"                                                                                                           |
| AC9      | existing   | `SessionsView` tests (COVERAGE_95 rows 1, 25, 29)                                                          | Unchanged; they keep proving the Infer button                                                                                                                                                                                                                                                                                                                                                                                           |
| AC10     | §8         | CI                                                                                                         | `build:privacy -- --check` passes; the audit step has no `continue-on-error`                                                                                                                                                                                                                                                                                                                                                            |
| AC11     | all        | `verify` skill + `npm run test:e2e`                                                                        | Green                                                                                                                                                                                                                                                                                                                                                                                                                                   |

Browser tester (Chrome and Edge, real profile): the two E2E flows by hand (F1 from the DevTools console of one app tab),
Clear All Data with recording off and with recording on, import of a real `v1.3.0` export, and `chrome.alarms.getAll()`
in the worker console after updating from a build that had the infer alarm.

## 12. Implementation order

On `feature/pre-release-fixes` from `develop` @ `9cd9a39`. CLAUDE.md asks for `feature/<name>`; PRs #64 and #65 used
`fix/…`, which this spec does not repeat. Each commit passes `verify`; the commit type follows the release rules.

1. `fix(sync): keep moved tabs in other TabPlex tabs when a folder is deleted`: §5.1, its unit tests and the F1 E2E
   test.
2. `fix(settings): keep page recording off after Clear All Data and reload other TabPlex tabs`: §5.2, its unit tests
   and the clear-all E2E test.
3. `fix(import): keep the current page recording setting when the file has none`: §5.3, `exportImport.test.ts`
   `:289-301`.
4. `fix(import): fill missing dates, check list fields and attach folders without a board`: §5.4 rules 1-4,
   `pickTimerSettings`, the `useStorageSync.ts:90` sort, tests.
5. `fix(import): put the data back when restoring the backup fails`: `applyWithRollback`, tests.
6. `fix(background): stop inferring sessions in the background`: §5.5, `chromeMock.ts`, `services.test.ts`,
   `noIntervals.test.ts` comment, README.md:60, `onboarding.html:99`, SECURITY_HARDENING.md:5. The body says that
   browser start no longer creates a session.
7. `docs: list releases 1.1.0 to 1.3.0 in the store listing and describe import, clear and folder sync`:
   CHROMEWEBSTORE.md, DATA_FLOW.md, PRIVACY.md + `npm run build:privacy`.
8. `ci: fail the build on high production advisories`: `ci.yml` (re-run `npm audit --omit=dev --audit-level=high`
   first; if it is no longer clean, stop and report).
9. `docs(specs): mark PRE_RELEASE_REVIEW_FIXES implemented`: status line and DoD ticks.

The release PR `develop` → `main` goes out only after this PR is merged. PR 2 and PR 3 may follow in a later release.

## 13. Open questions

1. **D2: remove the startup inference shipped in `v1.3.0`?** **Answered at G2: yes, remove all background inference.** Recommendation: yes, remove all
   background inference. Users lose a "Recent Activity Session" per browser start that they never asked for; the
   Infer button covers the explicit case. If you want to keep it, the alternative is to gate it on
   `isTrackingEnabled()`, keep `inferSessions` and disclose it in PRIVACY.md; then AC9 changes.
2. **D4: Clear All Data turns recording off for everyone, including users who opted in?** **Answered at G2: yes; the confirm text says so.**
   Recommendation: yes, a clear returns to fresh-install defaults. The alternative is to keep the previous value
   (still `false` when it was missing, so legacy users are not silently re-recorded).
3. **CHROMEWEBSTORE.md status of `1.1.0` to `1.3.0`** **Answered at G2: "GitHub release", each row checked against `CHANGELOG.md`.**: the repo does not say which versions were
   submitted to or published on Chrome and Edge. Recommendation: Mohamed fills in the Status column; the engineer
   writes "GitHub release" until then.
4. **How long to keep `chrome.alarms.clear('tabplex-infer-sessions')`.** Recommendation: delete it in the release after
   the next one. It is cheap, and it only matters for installs built from `develop` after `a282fd4`.
5. **Run the e2e-test-writer and browser-tester stages.** Recommendation: yes. AC1 and AC3 are cross-tab behaviors
   that unit tests cannot show.

## 14. Definition of done

- [x] AC1-AC9 each have the tests in §11, and every bug test was seen failing on `9cd9a39` (`04-build-log.md`).
- [x] `verify` passes: `npm run typecheck`, `npm run lint` (0 warnings), `npm run format:check`,
      `npm run build:privacy -- --check`, `npm run test:coverage` (≥ 95% statements, branches, functions and lines,
      no new exclusions), `npm run build`, `npm run check:bundle`.
- [x] `npm run test:e2e` passes, including `e2e/cross-tab-sync.spec.ts`.
- [x] `npm audit --omit=dev --audit-level=high` exits 0 on the final branch, and `ci.yml` has no `continue-on-error`
      on it (AC10).
- [x] The §8 docs are updated, `landing-page/privacy.html` is regenerated, and no doc still claims automatic session
      inference or the infer alarm (`git grep -n -i "automatic.*inference\|tabplex-infer-sessions"` finds only this spec,
      the legacy `clear` line in `session-service.ts` and its test).
- [x] The browser tester's checks in Chrome and Edge pass, and `07-human-signoff.md` records the human check (pass, 2026-10-28).
- [x] Commits follow §12. The PR targets `develop`; the branch is deleted after the merge.
- [x] §13 Q1 and Q2 are answered and the spec reflects the answers.

## 15. Follow-ups (separate cycles, not in this PR)

### Known issues / follow-ups (found in the browser test; all pre-existing)

- **T2:** the timer shows 25:00 after importing timer settings (an imported duration does not update `timeLeft`).
- **T3:** Infer makes sessions from TabPlex's own pages (`chrome-extension://` history), with 0 tabs each.
- **T5:** a rejected import is logged with `console.error`, which shows as an error in `chrome://extensions`.
- **R2-1:** the folder delete dialog ignores Escape.
- **S1-adjacent:** the `window` `message` listener in `useStorageSync` was removed (security S1); only
  `chrome.runtime.onMessage` drives sync. The unvalidated `STORAGE_*` payloads are still applied as they arrive from the
  background; validating them is a possible hardening step.

### PR 2: recorded pages reach the UI (own spec, for example `RECORDED_TABS_SYNC.md`)

The bug is real: pages recorded by the background are saved with `addTab` and no broadcast (`tab-service.ts:22-35`),
`loadData` hydrates only from IndexedDB (`useStorageSync.ts:66-96`), and `STORAGE_TAB_UPDATED` is update-only on
purpose (`useStorageSync.ts:311-317`). So "adds each page you open to your Inbox" (`TabTrackingSetting.tsx:13`) does not
happen. Already true, so not part of the fix: `createTabInFolder` broadcasts `STORAGE_TAB_ADDED`
(`tab-service.ts:117-123`), and sessions reach the UI through `fetchSessions` → `GET_SESSIONS` (`SessionsView.tsx:37`,
`sessionSlice.ts:56-64`). Use the real symbols: the listeners are anonymous on `onUpdated` / `onRemoved`
(`tab-service.ts:7, 43`, no `onCreated`); the helper is `broadcast` (`respond.ts:17`); IndexedDB writes are
`addTab` / `updateTab`; tabs are applied with `setState` + `upsertById`. Blockers that spec must solve:

- **C1, default-on flood.** Installs from before the setting have no key, so recording is on
  (`tabTracking.ts:20-28`), and `tabboard_tabs` holds up to 2,000 pages (`MAX_TRACKED_TABS`). A naive startup
  reconciliation shows all of them in the Inbox at once. Needs a cutoff (for example a
  `tabplex_track_all_tabs_since` timestamp) or a cap, an explicit migration, a 2,000-tab test, and either a diff-based
  `syncTabs` (`useStorageSync.ts:179-186` writes every tab on each change) or batched broadcasts.
- **C2, retention.** `pruneTabs` removes from `chrome.storage.local` and only broadcasts (`tab-retention.ts:29-36`).
  Add-only reconciliation keeps every copied tab in IndexedDB forever, against "removed after 30 days, at most 2,000
  kept" (`TabTrackingSetting.tsx:13-14`, PRIVACY.md:123). Define ownership (background-recorded tabs may be deleted by
  reconciliation, user tabs never), and merge by field (`status`, `lastAccessed`, `tabId`, `title`, `url`, `favicon`)
  like `reconcileTasksWithBackground` (`utils/taskContext.ts:71-86`). `onRemoved` must not fight Park & Resume
  (PARK_AND_RESUME.md:255).

### PR 3: message sender check, honest replies, markdown and Retry (own spec)

- **F5.** Sender check: `if (sender?.id !== chrome.runtime.id) return false;` then
  `if (sender.url && !sender.url.startsWith(chrome.runtime.getURL(''))) return false;`. Use `sender.url`, not
  `sender.tab.url` (the tab's current URL, wrong while it navigates). It is defence in depth: the manifest has no
  content scripts or `externally_connectable`. Every background test emits with sender `{}`
  (`message-handler.test.ts:11,47,101,299`…), so update them to `{ id, url }`, and add tests for an onboarding sender,
  a tab-less extension sender, an **empty sender** (now rejected) and a web URL. Error toasts go through
  `useUIStore.getState().actions.showToast(message, 'error')` (`uiStore.ts:77,116`); there is no `addToast`. Leave
  `taskSlice.addTaskAndSync` (already checks `{ error }`, `taskSlice.ts:34-37`). `CREATE_TAB_IN_FOLDER` has no UI
  sender: wrap it as `respondWith(createTabInFolder(payload), sendResponse)` with an awaited `chrome.tabs.create` (the
  payload has no `boardId`), or delete the message type.
- **F6.** Markdown: the cap is **200,000** characters (`markdown.ts:4`), and escaping happens before the slice
  (`NoteCard.tsx:22`, `MarkdownEditor.tsx:18`, `markdown.ts:41`). Both issues (a cut entity, links inside code) are
  cosmetic, not security. Protect code with the existing private-use `MARK` (`markdown.ts:42`), not `\u0000`, and give
  `transformKeepingLinks` a code-protection step that hands code back to each renderer (their code markup differs).
  Retry: refresh the tab's URL **inside `readTab`** (`chrome.tabs.get` before `snapshotTab`, update `entry.tab` with
  `updateRun`), not before `execute`, so AI sessions are still created synchronously within the click
  (`tabNotesStore.ts:341-344`, built-in-ai rule 2). If the origin changed and `missingOrigins` is not empty, fail with
  "needs site access, pick it again" instead of prompting after an await. Test that the AI session factory is called
  synchronously within `retryTab`.

## Implementation notes (2026-10-25)

Decisions taken while building, from the round-2 challenge (`03-challenge-r2.md`) and the G2 answers:

- **D2** removes the startup run too; the old alarm is cleared once at worker start.
- **D4** confirm text: "... Recording of the pages you open will be turned off."
- **C1** the chrome.storage removal is repeated once after the IndexedDB clear (simpler than taking the background write locks); a write that lands after the second pass is still possible but needs a background read-modify-write that straddles both.
- **C2** `clearEverything` resets the timer store and calls `useTimerStore.persist.clearStorage()`; receiving tabs clear the stored timer before they reload.
- **C3** a present `settings.extension.tabplex_track_all_tabs` that is not true/false rejects the file.
- **C4** the status line and §3.3 of `SECURITY_HARDENING.md` record D2 and D8 (the file never mentioned the inference alarm).
- **C5** the synthesized "My Board" is dated at import time, not the epoch, so it does not become the current board.
- **C6** missing tab/history `title` and `url` become `''`; a present non-text `title`, `url`, `description` (tasks), note `title` or session `summary` rejects the file. Data already in IndexedDB that was written by other means is not repaired.
- **C7** tests cover the rejecting `alarms.clear` and `sendMessage` promises.
- **C8** `npm audit --omit=dev --audit-level=high` was run on Node 24 / npm 11 (Node 22 was not installed); 0 vulnerabilities. A new high advisory fails CI on any branch; the response is an `npm audit fix` PR into `develop`.
- **C9** timer durations must be whole numbers from 1 to 1440 and `longBreakInterval` from 1 to 100.

## Challenge response

Every finding in `.claude/work/pre-release-fixes/03-challenge.md` was either fixed here or moved, with its corrections,
to a follow-up spec (the user's split decision). None is rebutted.

- **C1** (BLOCKER, F2 flood): moved to PR 2; recorded in §15 with the cutoff, migration and 2,000-tab test.
- **C2** (BLOCKER, F2 retention): moved to PR 2; ownership and merge-by-field recorded in §15.
- **C3** (non-existent symbols): fixed. This spec uses only real symbols (`handleFolderMessage`, `broadcast`,
  `respondWith(work, sendResponse, opts)`, `sanitizeCollections`, `handleClearData`, `showToast`). The existing
  `DeleteFolderPayload` is reused. The F2 and F5 names are corrected in §15.
- **C4** (D2 rationale): fixed. D2 gives the real reasons, removes the alarm, clears the stale one, decides on the
  startup run (removed, §13 Q1) and removes the dead code. SECURITY_HARDENING.md:5 is updated.
- **C5** (orphan re-parenting): fixed, going further than the proposal. Tabs are never re-parented, since dangling and
  empty `folderId`s already show as unfiled (D8). The synthesized board is specified, a warning is shown, and the
  Task/Note references are out of scope with the reason.
- **C6** (fields and `importInThisTab`): fixed. `checklist`, no `boards[].folders`, the `markImportInThisTab` item
  dropped (D10), the `useStorageSync.ts:90` reader hardened, and the restore reuses `importData`'s rollback (D9).
- **C7** (F4 premise): fixed. No background handler and no `background/storage.ts` change. Tracking ends `false`, the
  UI broadcasts, other tabs reload, and the ungroup is a non-goal. The revision also found that the Settings tab can
  re-persist stale data during its own 1.5 s delay, and empties its store to prevent it (§5.2 step 5).
- **C8** (sender check): moved to PR 3; `sender.url`, the test churn and the empty-sender case are recorded in §15.
- **C9** (F1 fallback text): fixed. The real default `''` is kept and stated (D1). Flow 1 said no UI triggers it; that was wrong, see Revision 2.
- **C10** (toast API, `CREATE_TAB_IN_FOLDER`): moved to PR 3 with `showToast` and the `respondWith` form.
- **C11** (Retry and user activation): moved to PR 3, with the "refresh inside `readTab`" design.
- **C12** (markdown details): moved to PR 3 with the 200,000 cap and `MARK`.
- **C13** (test paths, missing tests): fixed. Real paths only (`useStorageSync.test.tsx`, `Settings.test.tsx`,
  `exportImport.test.ts`, …), the `services.test.ts:573-634` replacement, two Playwright cross-tab tests, and
  `npm run typecheck` in the DoD.
- **C14** (phasing, branch): fixed. Split into three PRs, `feature/pre-release-fixes`, nine single-purpose commits,
  and the stale PR #67 mentions removed.

## Revision 1 (2026-10-25)

Revised after `03-challenge.md` (VERDICT: REVISE, 2 BLOCKER, 8 MAJOR, 4 MINOR) and the user's split decision. This spec
is now PR 1 only: F1 (severity lowered to latent, default `''` kept), F4 rewritten around the real bugs (recording
turned back on, stale re-persist across tabs), F3 with real field names and folder-only re-parenting, D2 with correct
reasons and an explicit startup decision, and F7 with a measured `npm audit` result. Found during the revision and
added: F4c (an import of a `v1.3.0` file turns recording back on) and the Settings tab's own stale-write race. F2, F5
and F6 moved to §15 with the challenger's corrections. Claims were re-checked on `develop` @ `9cd9a39`. Per-finding
resolution is in "Challenge response" above.

## Revision 2 (2026-10-28): browser test finding T1 and T4

The browser test (`07-test-report.md`) found that the folder delete dialog is a UI path for F1, so the sentence "no UI
sends `moveTabs`" was wrong. F1 stays Low (the UI hydrates from IndexedDB, so the user saw nothing), but its description
is corrected above: the background copy lost the moved tabs because `BoardNode.handleMoveAndDelete` sent one
`UPDATE_TAB` per tab and then a plain `DELETE_FOLDER`, and `releaseFolderTabs` read the old folders and deleted them.

- **Fix (T1).** The dialog now sends one `DELETE_FOLDER { id, moveTabs: true, targetFolderId }` through the existing
  store action `deleteFolder(id, true, targetFolderId)`. The action also writes the moved tabs to IndexedDB (it only
  deleted the folder before), and sends no `UPDATE_TAB`. Other tabs get the already-fixed `STORAGE_FOLDER_DELETED`.
- **Edge cases.** The dialog's target is always an existing folder, so the empty/deleted-target cases of §7 stay
  reachable only by message. Force delete (`moveTabs` false) is unchanged.
- **Acceptance criterion AC1 is extended.** Choosing "Move tabs to another folder" in the dialog leaves the tabs in the
  target in the store, IndexedDB, `chrome.storage.local` (`tabboard_tabs`) and in a second open tab, with no
  `UPDATE_TAB` sent. Unit test: `src/features/boards/__tests__/FolderMoveDelete.test.tsx`.
- **Wording (T4).** The Clear All Data row says that recording of opened pages is turned off. The Settings subtitle says
  TabPlex. Import preview warnings use the singular for 1 ("1 item had no creation date", "1 folder without a board was
  moved"). Other "TabBoard" strings (the welcome guide row, the route description) are out of scope.
- **Delete-all fix (U1, Revision 3 note).** "Force delete is unchanged" was wrong for IndexedDB: `deleteFolder(id)` with
  `moveTabs` false dropped the tabs from the page only, so they stayed in IndexedDB and came back as unfiled tabs after a
  reload. The action (and `deleteFolderSilently`, same shared IndexedDB, idempotent deletes) now also deletes each of the
  folder's tabs from IndexedDB, with no per-tab message; the single `DELETE_FOLDER` covers the background.
