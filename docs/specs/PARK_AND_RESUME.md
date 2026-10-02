# Spec: Park & Resume (task-bound tab contexts)

|             |                                                                       |
| ----------- | --------------------------------------------------------------------- |
| **Status**  | Phases 0–2 implemented (2026-10-02). Phase 3 (AI summary) not started |
| **Owner**   | Mohamed                                                               |
| **Created** | 2026-10-02                                                            |
| **Branch**  | `feature/park-and-resume`                                             |
| **Pitch**   | _"Close your tabs without losing your train of thought."_             |

---

## 1. Problem

Users keep dozens of tabs open because tabs are their working memory for each piece of work. Closing them feels like losing context, so tabs pile up, eat RAM and bury the current task.

Existing tools miss in two ways:

- **Session savers** (OneTab, Session Buddy) save tabs but have no idea _which piece of work_ they belong to.
- **AI groupers** (Side Space, Tab Manager AI, Chrome's "Organize similar tabs") group by _topic_, not by _workflow_, send URLs to cloud LLMs, and lose their groups on browser restart.
- **Workspace tools** (Workona, Toby) come closest but are paywalled, cloud-dependent, and not connected to a task list.

TabPlex already has tasks, tabs, notes, sessions and a Pomodoro timer in one local-first app. `Task.tabIds` exists in the data model but is barely used. Park & Resume connects these pieces.

## 2. Goals

1. A task can **own a set of tabs** (its _context_).
2. **Start** a task → its tabs open in a Chrome tab group named after the task, and focus mode can begin.
3. **Park** a task → capture open tabs + a one-line "where I left off" note, then close the tabs.
4. **Resume** a task → restore the tab group and show the note, in one click.
5. Everything persists across browser restarts and stays 100% local.

### Non-goals (v1)

- Restoring scroll position, form state, or video timestamps (needs content scripts + `<all_urls>` scripting — later).
- Cloud sync or sharing contexts with other people.
- Automatically deciding which task a tab belongs to (v2, see §10).
- Firefox / Safari support.

## 3. User stories

| #   | As a user I want to…                                                               | So that…                                           |
| --- | ---------------------------------------------------------------------------------- | -------------------------------------------------- |
| U1  | attach my currently open tabs to a task                                            | the task remembers what I was working with         |
| U2  | click **Start** on a task and get its tabs back in a labelled group                | I'm back in context in seconds                     |
| U3  | click **Park**, type one line, and have the tabs close                             | I can switch tasks without fear of losing anything |
| U4  | see parked tasks on the Today view with their note and "parked 2 days ago"         | I know what's waiting and where I stopped          |
| U5  | add / remove individual tabs from a task's context                                 | the context stays accurate                         |
| U6  | have new tabs I open while a task is active be added to it automatically (opt-out) | I don't have to curate manually                    |
| U7  | (optional) get an on-device AI summary of a parked context                         | I remember _what_ I was doing, not just _where_    |

## 4. UX

### 4.1 Task card (`src/features/tasks/components/TaskCard.tsx`)

A context strip below the description:

```
┌──────────────────────────────────────────────┐
│ Write Q4 pricing page            [HIGH]  ✎ 🗑 │
│ 🗂 6 tabs · Parked 2d ago                     │
│ "Comparing Stripe vs Paddle fees — left off  │
│  at the VAT section"                          │
│ [▶ Resume]  [+ Add current tabs]   todo|doing|done │
└──────────────────────────────────────────────┘
```

Button states:

| Task state          | Primary button                                 | Secondary            |
| ------------------- | ---------------------------------------------- | -------------------- |
| No tabs, not active | `▶ Start` (just starts, no tabs)               | `+ Add current tabs` |
| Has tabs, parked    | `▶ Resume`                                     | `Edit tabs`          |
| Active              | `⏸ Park`                                       | `+ Add current tab`  |
| Done                | — (context kept read-only, `Reopen tabs` link) |                      |

### 4.2 Park dialog

Small modal, focus on the input, `Enter` submits, `Esc` cancels:

- Title: **Park "Write Q4 pricing page"**
- Input: _Where did you leave off?_ (optional, 280 chars max)
- Checkbox list of the tabs in the task's group (all checked; uncheck to leave a tab open and detach it)
- Toggle: _Close tabs after parking_ (default on, remembered in settings)
- Button: **Park** · link: _Park without note_

### 4.3 Today view (`src/features/today/TodayView.tsx`)

New `ParkedContexts` section above `TodayTasks`, shown only when at least one task is parked. Each row has the task title, tab count, favicon stack (max 5), relative time and the note, with a **Resume** button. Sort: most recently parked first. Hide parked tasks with status `done`.

### 4.4 Active task indicator

- `AppHeader` shows a pill: `● Write Q4 pricing page · 6 tabs` with a Park button. One active task at a time in v1.
- The Chrome tab group is titled with the task title (truncated to 30 chars) and coloured by priority: high → `red`, medium → `yellow`, low → `blue`.

### 4.5 Command palette and shortcuts

- Commands: `Park active task`, `Resume last parked task`, `Add current tab to active task`.
- Shortcut: `Alt+Shift+P` = park active task (check for clashes in `useKeyboardShortcuts.ts` and the README list).

## Implementation notes (deviations from the draft below)

- **Tabs are stored as snapshots on the task** (`context.tabs: ContextTab[]` with url/title/favicon), not as references to `Tab` records. The UI's IndexedDB tabs and the background's `chrome.storage` tabs are separate lists, and the background auto-tracks every browsed tab, so references were fragile. Snapshots also make the `onRemoved` race in §6.1 irrelevant.
- `Task.tabIds` is left as-is (the card still shows those links); there is no migration.
- `context` is **owned by the background** (`src/background/context-service.ts`). `UPDATE_TASK` from the UI keeps the stored `context`, and the UI takes the background's `context` when reconciling on load.
- While a task is active, its context mirrors its Chrome tab group (debounced snapshot), so a crash doesn't lose tabs.
- The manifest background is now `"type": "module"`. Code shared by the UI and the service worker (`src/utils/taskContext.ts`) becomes a shared chunk that a classic service worker can't import.
- Not built yet: Pomodoro on Start, local analytics (§8), AI summary (§7).

## 5. Data model

### 5.1 `Task` additions (`src/types/index.ts`)

```ts
export interface TaskContext {
    tabIds: string[]; // TabPlex Tab.id values (replaces use of Task.tabIds)
    state: 'idle' | 'active' | 'parked';
    chromeGroupId?: number | null; // live chrome.tabGroups id while active
    windowId?: number | null;
    parkedAt?: string; // ISO
    resumedAt?: string; // ISO
    resumeNote?: string; // "where I left off", ≤ 280 chars
    aiSummary?: string; // optional, generated on-device
    parkCount?: number; // for analytics
}

export interface Task {
    // …existing fields
    context?: TaskContext;
}
```

**Migration:** no IndexedDB version bump is needed because the field is optional on an existing store. On load, if `task.tabIds?.length && !task.context`, treat it as `{ tabIds: task.tabIds, state: 'idle' }`. Keep `Task.tabIds` for backwards compatibility and mark it `@deprecated`.

### 5.2 `Tab` usage

- Tabs in a parked context keep `status: 'suspended'` and `tabId: null`.
- On resume each tab gets its new browser `tabId` and `status: 'open'`.
- A tab may belong to more than one task (same URL, different work). Store membership on the task, not on the tab.

### 5.3 Settings (`SettingsView`, `chrome.storage.local` key `parkResumeSettings`)

```ts
{
    closeTabsOnPark: boolean; // default true
    autoAddNewTabsToActive: boolean; // default true
    startPomodoroOnStart: boolean; // default false
    aiSummaries: 'off' | 'on'; // default 'off'; hidden if the AI API is unavailable
}
```

## 6. Architecture

Chrome tab and tab-group operations must run in the **background service worker**. The UI tab that calls them may be one of the tabs being closed.

### 6.1 Messages (UI → background)

| Type                      | Payload                                                            | Behaviour                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TASK_CONTEXT_START`      | `{ taskId }`                                                       | Park any other active task first (no note). Open the task's suspended tabs (`chrome.tabs.create`, `active: false` except the first), `chrome.tabs.group` them, `chrome.tabGroups.update` with title and colour. Set `context.state = 'active'`, `chromeGroupId`, `windowId`, `resumedAt`. Set `task.status = 'doing'` if it was `todo`.                                                            |
| `TASK_CONTEXT_PARK`       | `{ taskId, note?, keepOpenTabIds?: string[], closeTabs: boolean }` | Read the tabs currently in `chromeGroupId` (`chrome.tabs.query({ groupId })`) and reconcile them with `context.tabIds`. Upsert `Tab` records. Set `state = 'parked'`, `parkedAt`, `resumeNote`, `parkCount++`. **Before closing**, set each tab's `tabId = null` and `status = 'suspended'` so the `onRemoved` listener in `tab-service.ts` doesn't mark them `closed`. Then `chrome.tabs.remove`. |
| `TASK_CONTEXT_RESUME`     | `{ taskId }`                                                       | Same as START, and the UI shows the note in a toast/banner.                                                                                                                                                                                                                                                                                                                                        |
| `TASK_CONTEXT_ADD_TABS`   | `{ taskId, chromeTabIds?: number[] }`                              | Default: all tabs in the current window except TabPlex's own `index.html`. Upsert Tab records, append to `context.tabIds` (dedupe by URL). If active, also `chrome.tabs.group` them into the group.                                                                                                                                                                                                |
| `TASK_CONTEXT_REMOVE_TAB` | `{ taskId, tabId }`                                                | Remove from `context.tabIds`. If active, `chrome.tabs.ungroup`.                                                                                                                                                                                                                                                                                                                                    |

Broadcast after each change: `STORAGE_TASK_UPDATED` with the full task. Tab changes use the existing `STORAGE_TAB_*` messages.

New file `src/background/context-service.ts` exports `handleContextMessage`. Route it from `message-handler.ts` and import it in `background/index.ts`. Follow the `add-message-sync` skill: `return true`, sent-flag, `safeSendResponse`.

### 6.2 Listeners (background)

- `chrome.tabs.onCreated` / `onUpdated(status=complete)`: if a task is active, `autoAddNewTabsToActive` is on, and the new tab is in the active window, add the tab to the group and the context. Skip `chrome://`, `chrome-extension://` and TabPlex itself.
- `chrome.tabGroups.onRemoved`: if it's the active group (the user closed the group by hand), auto-park with no note and keep the tabs as suspended. **Never lose tabs.**
- `chrome.tabGroups.onUpdated`: if the user renames the group, don't rename the task. Ignore.
- Service worker restart: keep the active task id in `chrome.storage.local` (`activeContextTaskId`). On startup, check that `chromeGroupId` still exists via `chrome.tabGroups.get`. If it doesn't, set the state to `parked`.

### 6.3 UI side

- `taskSlice.ts`: add thin actions `startContext`, `parkContext`, `resumeContext`, `addTabsToContext` and `removeTabFromContext`. They **only send messages** and wait for the response. The background is the source of truth, and the result comes back through `STORAGE_TASK_UPDATED`.
- New selector helpers in `src/features/tasks/utils/contextUtils.ts`: `getActiveContextTask`, `getParkedTasks`, `formatParkedAgo` (use `utils/dateUtils.ts`).
- New components:
    - `src/features/tasks/components/TaskContextStrip.tsx` (+ `.css`)
    - `src/features/tasks/components/ParkDialog.tsx` (+ `.css`)
    - `src/features/today/components/ParkedContexts.tsx` (+ `.css`)
    - `src/features/navigation/components/ActiveContextPill.tsx`

### 6.4 Pre-existing gap to fix first

`taskSlice.updateTask` persists to IndexedDB but **does not send `UPDATE_TASK`**, and `task-service.ts` only handles `ADD_TASK` and `DELETE_TASK`. Task edits therefore never reach the background or other open tabs. Park & Resume depends on task updates syncing, so:

1. Add `UPDATE_TASK` handling in `task-service.ts`: write to storage and broadcast `STORAGE_TASK_UPDATED`.
2. Send `UPDATE_TASK` from `taskSlice.updateTask`.
3. Add `updateTaskSilently` and use it in the `STORAGE_TASK_UPDATED` case of `useStorageSync.ts` to avoid an echo loop.

Ship this as its own commit: `fix(tasks): sync task updates to background and other tabs`.

## 7. Optional: on-device AI summary (Phase 3)

- Use Chrome's built-in **Summarizer API** (stable since Chrome 138; runs on Gemini Nano on the device).
- Input: titles + URLs of the parked tabs + the user's note. No page content in v1, so no new permissions.
- Feature-detect with `'Summarizer' in self` and `await Summarizer.availability()`. Hide the setting if the result is `unavailable`. Show a one-time "downloading model" state if it is `downloadable`.
- Run in the UI tab after park (not in the service worker). Store the result in `context.aiSummary`, shown in italics under the note.
- Privacy copy: _"Summaries are generated on your device. Nothing is sent to any server."_ Add to `PRIVACY.md`.
- The hardware requirements (~16 GB RAM or a 4 GB VRAM GPU, ~22 GB free disk) mean many users won't have it. The feature must be fully useful without AI.

## 8. Analytics (local)

Extend `features/analytics` with:

- Parks per day and average parked duration
- "Context restores": the number of resumes (headline stat: _"You resumed 14 contexts this week"_)
- Tabs closed via park (≈ memory saved)

## 9. Edge cases

| Case                                   | Behaviour                                                                                                                                        |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Start a task while another is active   | Auto-park the current one with no note. Toast: "Parked _X_. Started _Y_."                                                                        |
| Task deleted while active              | Ungroup tabs (don't close), clear active state                                                                                                   |
| Task marked done while active          | Ask: "Close its tabs?" Default yes, park without note                                                                                            |
| Same URL in two tasks                  | Allowed. Resume opens a new browser tab even if the URL is open elsewhere (v1)                                                                   |
| Tab's URL is now 404/expired           | Open anyway; the user decides                                                                                                                    |
| Parked task with 50+ tabs              | Resume opens tabs with `discarded`-friendly `active: false`. Warn above 25: "Open 52 tabs?"                                                      |
| TabPlex UI tab itself is in the window | Never add it to a context or close it                                                                                                            |
| Multiple windows                       | Context lives in the window it was started in. Resume opens in the current window                                                                |
| Browser restart while active           | Chrome may restore the group. On startup, if a group titled the same exists in a window, re-bind `chromeGroupId`; otherwise mark the task parked |
| Export / import                        | `context` is part of `Task`, so it's included automatically. Verify in `exportImport.ts`                                                         |
| Incognito tabs                         | Never captured                                                                                                                                   |

## 10. Future (v2+)

- **Suggest the task for a new tab**: rank tasks by domain overlap with their contexts and offer a one-click "Add to _X_?" Can be done locally without AI.
- Scroll position / reading progress via content script.
- "Time machine": keep the last N parks per task.
- Shareable context as a link list (export to Markdown).

## 11. Delivery plan

| Phase            | Scope                                                                                                         | Exit criteria                               |
| ---------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| **0 — Prereq**   | §6.4 task update sync fix                                                                                     | Edit a task in tab A → it updates in tab B  |
| **1 — Core**     | Types, `context-service.ts`, messages, slice actions, Start/Park/Resume on TaskCard, Park dialog, active pill | All of §12 tests 1–8 pass                   |
| **2 — Surfaces** | Today `ParkedContexts`, command palette, shortcut, settings, auto-add new tabs, analytics                     | Tests 9–12 pass                             |
| **3 — AI**       | Summarizer integration behind feature detection, PRIVACY.md update                                            | Works on a capable device, hidden on others |

Each phase ends with the `verify` skill passing and a conventional commit (`feat(tasks): …`).

## 12. Acceptance tests (manual — no test runner yet)

1. Add current tabs to a task → task card shows correct count and favicons.
2. Start a task → tabs open in one Chrome group titled with the task name, colour matches priority.
3. Park with a note → tabs close, card shows "Parked just now" and the note.
4. After park, the closed tabs are **not** marked `closed` / moved to Inbox history (tab-service `onRemoved` race handled).
5. Restart Chrome → the parked task is still parked with all tabs and the note.
6. Resume → the same tabs reopen in a group and the note is shown.
7. Start task B while A is active → A auto-parks, B starts.
8. Close the Chrome group by hand → task becomes parked and no tabs are lost.
9. Two TabPlex tabs open → park in one, the other updates without reload and with no message loop in the console.
10. With auto-add on, open a new tab while a task is active → it joins the group and context.
11. Export, clear data, import → contexts and notes restored.
12. `Alt+Shift+P` parks the active task; command palette entries work.

## 13. Open questions

- Should **Start** also start the Pomodoro with `linkedTaskId` set? (`timerStore` already supports `linkedTaskId`.) Proposed default: off, toggle in settings.
- Allow more than one active task (one per window)? Proposed: no for v1.
- Show parked contexts in the Boards view too? Proposed: no for v1; Today + Tasks only.
