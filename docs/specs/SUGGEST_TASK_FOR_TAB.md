# Spec: Suggest a task for a new tab

|               |                                                                                                                  |
| ------------- | ---------------------------------------------------------------------------------------------------------------- |
| **Status**    | Ready to implement · milestone v1.2 (ROADMAP #18)                                                                |
| **Created**   | 2026-10-05                                                                                                       |
| **Size**      | M (1–2 days)                                                                                                     |
| **Builds on** | Park & Resume ([PARK_AND_RESUME.md](PARK_AND_RESUME.md) §10 "Future"), `TASK_CONTEXT_ADD_TABS` with explicit ids |
| **Pitch**     | _"Opened another Stripe docs page? TabPlex offers to file it under 'Compare pricing'."_                          |
| **AI**        | None. Local domain matching only (decision D-S1).                                                                |

## 1. Problem

Auto-add only helps while a task is **active**. Most of the time the right task is parked or idle: you open a page
that belongs to it and have to remember to add it later. TabPlex already knows which sites each task's tabs are on.

## 2. Goals / non-goals

**Goals**

1. When a new web tab finishes loading and it clearly belongs to a parked or idle task, offer **"Add to {task}?"**.
2. One click adds it to that task's context (the tab stays open; nothing else changes).
3. Never nag: off by default, rate-limited, and "Not now" silences that site for that task for 7 days.
4. Fully local: no AI, no network.

**Non-goals (v1):** suggesting for the **active** task (auto-add covers it), page-content similarity, AI ranking,
suggesting a brand-new task.

## 3. Decisions

| #    | Decision                                                                                      | Reason                                                                            |
| ---- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| D-S1 | Domain matching, no AI                                                                        | Works on every device, explainable, instant                                       |
| D-S2 | Surface = a Chrome **notification** with buttons (permission `notifications` already granted) | The user is on the new page, not in TabPlex. No new permission, no content script |
| D-S3 | **Off by default.** Toggle in Settings → Park & Resume: "Suggest a task for new tabs"         | Notifications are intrusive; opt-in keeps trust                                   |
| D-S4 | Only tasks with `context.state` `parked` or `idle` and status ≠ `done`                        | Active task is auto-added; done tasks are finished                                |

## 4. Matching (`src/utils/taskSuggest.ts`, pure, shared with the background: no DOM)

Move `siteKey` from `src/features/organize/utils/siteGrouping.ts` to `src/utils/siteKey.ts` (re-export from the old
place so imports keep working). The background imports it from `src/utils`.

```ts
export interface Suggestion {
    taskId: string;
    title: string;
    score: number;
    site: string;
}

/** Best task for `url`, or null. Pure; `now` for testability. */
export function suggestTaskForUrl(url: string, tasks: Task[], dismissed: DismissMap, now: number): Suggestion | null;
```

Rules:

1. `site = siteKey(url)`; null (not a web page) → no suggestion. Skip TabPlex's own pages and browser pages
   (`isCapturableUrl`).
2. Candidates: tasks per D-S4 with at least one context tab.
3. `score` = number of the task's context tabs on the same `site`, **+3** if a context tab has the exact same URL
   (without hash), **+1** if one shares the first path segment (`/docs/…`).
4. Require `score ≥ 2` (one same-site tab plus a path match, or two same-site tabs). Avoids "every google.com page".
5. Ignore sites in a small built-in **stoplist** where co-occurrence means nothing: `google.com`, `bing.com`,
   `duckduckgo.com`, `youtube.com`, `mail.google.com` (site key of a sub-domain counts), `localhost`.
6. Skip `(taskId, site)` pairs dismissed less than 7 days ago (`dismissed[taskId + '|' + site] = timestamp`).
7. Highest score wins; ties → most recently parked (`context.parkedAt`), then title.

## 5. Background flow (`src/background/suggest-service.ts`, imported by `background/index.ts`)

- Listen to `chrome.tabs.onUpdated` with `changeInfo.status === 'complete'`.
- Skip when: setting off; tab pinned, incognito or in any group; tab already in a task context (any task's
  `context.tabs` has this URL); an active task exists **and** auto-add is on **and** the tab is in its window (it was
  just auto-added); our own busy guard is set (Start/Resume opening tabs).
- **Rate limit:** at most one suggestion per 2 minutes, and never twice for the same tab id (in-memory `Set`, plus
  `lastShownAt` in `chrome.storage.session` so a worker restart doesn't reset it).
- Show `chrome.notifications.create('suggest:' + tabId + ':' + taskId, { type: 'basic', iconUrl: 'assets/icon128.png',
title: 'Add this tab to a task?', message: '"{page title}" looks like part of "{task title}".', buttons: [{ title:
'Add to task' }, { title: 'Not now' }], requireInteraction: false })`.
- `notifications.onButtonClicked`:
    - **Add to task** → same as `TASK_CONTEXT_ADD_TABS` `{ task, chromeTabIds: [tabId] }` (call `addTabsToTask` directly),
      broadcast the task update (existing `STORAGE_TASK_UPDATED` path) so open TabPlex pages refresh, then a short
      confirmation notification "Added to {task}" that auto-clears.
    - **Not now** → store `dismissed[taskId|site] = now` in `chrome.storage.local` (`tabplex_suggest_dismissed`, pruned to
      entries < 7 days old on write).
- `notifications.onClosed` (user swiped it away) counts as "Not now" only if `byUser`.
- The service worker can sleep: all state needed by the button handler is in the notification id + storage.

## 6. Settings

`ParkResumeSettings.suggestTasksForTabs?: boolean` (default `false`) in `src/utils/taskContext.ts` defaults and the
Park & Resume settings UI: checkbox "Suggest a task for new tabs" with help "When a page you open matches a parked task's
sites, TabPlex offers to add it. Uses notifications."

## 7. Edge cases

| Case                                         | Behaviour                                                                |
| -------------------------------------------- | ------------------------------------------------------------------------ |
| Tab closed before the user clicks Add        | `addTabsToTask` skips closed ids; notification says "The tab was closed" |
| Task deleted or finished meanwhile           | Button does nothing; clear the notification                              |
| Notifications blocked at OS level            | Nothing shown; no error                                                  |
| Two windows open the same URL                | Second tab already matches a context URL → skipped                       |
| Redirects (`status: complete` fires per nav) | Rate limit + "never twice per tab id" prevent repeats                    |

## 8. Files

| File                                                                    | Change                                       |
| ----------------------------------------------------------------------- | -------------------------------------------- |
| `src/utils/siteKey.ts`                                                  | **New** (moved from organize)                |
| `src/utils/taskSuggest.ts`                                              | **New**, §4                                  |
| `src/background/suggest-service.ts`                                     | **New**, §5; import in `background/index.ts` |
| `src/utils/taskContext.ts`                                              | setting default                              |
| Settings → Park & Resume component                                      | toggle                                       |
| `PRIVACY.md`, `CHROMEWEBSTORE.md` (notifications justification), README | mention the feature                          |

## 9. Tests

- `taskSuggest.test.ts`: scoring table (same site ×2, exact URL, path segment), threshold, stoplist, dismissed window,
  done/active tasks excluded, tie-breaks.
- `suggest-service.test.ts` (chrome mock, fake timers): setting off → nothing; match → `notifications.create` with
  buttons; Add → context gets the tab and `STORAGE_TASK_UPDATED` broadcast; Not now → dismissed stored, no repeat for
  7 days; rate limit; tab already in a context → nothing; auto-added tab → nothing.
- E2E: enable the setting, park a task with `docs.test/a` and `docs.test/b`, open `docs.test/c`, assert
  `chrome.notifications.getAll()` holds a `suggest:` id, trigger the button handler via the service worker, assert the
  task now has 3 context tabs.
