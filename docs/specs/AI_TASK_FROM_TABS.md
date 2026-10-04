# Spec: New task from tabs (AI task drafts)

|                |                                                                                                                                          |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**     | Ready to implement · milestone v1.1 (ROADMAP queue #12)                                                                                  |
| **Owner**      | Mohamed                                                                                                                                  |
| **Created**    | 2026-10-03                                                                                                                               |
| **Branch**     | `feature/ai-organize`                                                                                                                    |
| **Depends on** | [AI_FOUNDATION.md](AI_FOUNDATION.md) (required). [AI_TAB_GROUPING.md](AI_TAB_GROUPING.md) (only for the "Make a task" entry point, §4.1) |
| **Builds on**  | Park & Resume ([PARK_AND_RESUME.md](PARK_AND_RESUME.md)): `TASK_CONTEXT_START`, `TASK_CONTEXT_ADD_TABS`                                  |
| **Pitch**      | _"Turn the tabs you're looking at into a task, with a title, priority and next steps, in one click."_                                    |

---

## 0. How to use this spec

- Implement in the order of §14. Each step lists exact files, exports, behaviour, copy text and tests.
- **"Write this"** blocks are the intended code. **"Shape"** blocks give structure; fill in details.
- Names in `code` are **decided**. Keep them: tests and the other specs refer to them.
- Use the user-facing text in the tables verbatim.
- If this spec and the code disagree about existing behaviour, the code wins. Update this spec in the same PR.

## 1. Problem

Starting Park & Resume today takes several steps: create a task (type a title, pick a priority), then **+ Add current tabs**, then **▶ Start**. The work is usually already visible in the open tabs, so the title, priority and next steps can be inferred from them.

This feature makes it one dialog: **pick tabs → get a drafted task → edit → Create (or Create & start)**. The tabs become the task's context, so Park & Resume works from the first second.

## 2. Goals and non-goals

### Goals

1. From the Tasks view, the command palette, or a group in the Organize dialog, open **New task from tabs** with the relevant tabs pre-selected.
2. With on-device AI: pre-fill **title, description, priority and up to 5 steps** (checklist) within ~10 s.
3. Without AI: pre-fill a sensible title; the rest uses defaults. The dialog stays fully usable.
4. **Create task:** the task is saved with the selected tabs as its (idle) context. The tabs stay open.
5. **Create & start:** the task is saved, becomes the active Park & Resume task, and the selected tabs move into its Chrome tab group. **No tab is reopened or duplicated.**
6. Never changes anything before the user clicks Create.

### Non-goals (v1)

- Due dates from the model (small models get dates wrong; the user can set one on the card).
- "Create and close tabs" (= park immediately). Listed in §15.
- Choosing tabs from several windows.
- Editing an existing task with AI.

## 3. User stories

| #   | As a user I want to…                                                        | So that…                                      |
| --- | --------------------------------------------------------------------------- | --------------------------------------------- |
| T1  | turn my open tabs into a task without typing                                | I can start tracking work instantly           |
| T2  | uncheck tabs that don't belong                                              | the task's context is accurate                |
| T3  | see and edit the drafted title, priority and steps before saving            | the task says what I mean                     |
| T4  | give a hint ("compare payment providers") and redraft                       | the draft matches my intent                   |
| T5  | click **Create & start** and have my tabs grouped under the task right away | I'm in Park & Resume mode with no extra steps |
| T6  | make a task from one of the groups I just organized                         | organizing flows into doing                   |
| T7  | still use the dialog when my computer can't run the AI                      | it's useful anyway                            |

## 4. UX

### 4.1 Entry points

| Where                                                               | Element                                                                                                                                    | Tabs pre-selected                                                                     |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| Tasks view header (`src/features/tasks/components/TasksHeader.tsx`) | Button in `tasks-header-top`, right of the title section: **"✨ Task from tabs"**, class `tasks-from-tabs-btn`, `type="button"`            | All organizable tabs of the current window (`getOrganizableTabs`, AI foundation §4.4) |
| Command palette                                                     | Command `id: 'task-from-tabs'`, name **"New task from open tabs"**, icon `'✨'`, category `'creation'`, inserted right after `create-task` | Same as above                                                                         |
| Organize dialog, done phase (AI_TAB_GROUPING §4.2)                  | **Make a task** on a created group row                                                                                                     | Exactly that group's tab ids (`CreatedGroup.tabIds`)                                  |

All three call `openTaskFromTabs(tabIds?: number[])` (§7.2) **synchronously in the click**, which allows the model session to start.

Style of the Tasks header button: secondary button look. Reuse the existing `.back-to-today-btn` visual (border, radius, padding) via a new class. Don't reuse the class itself (that class has its own layout rules).

### 4.2 Dialog

One component, `TaskFromTabsDialog`, mounted once in `src/App.tsx` right after `<OrganizeTabsDialog />` (or after `<ParkDialog />` if this ships first). Same overlay/panel style as `ParkDialog.css`. Copy the variables into `TaskFromTabsDialog.css`.

- `role="dialog"`, `aria-modal="true"`, `aria-labelledby="task-from-tabs-title"`.
- `Esc` = Cancel, except while creating. Backdrop click does **not** close (protects edits).
- Width `min(640px, calc(100vw - 32px))`. Body scrolls, header and footer fixed.
- On open, focus the title input once a draft is shown, or the dialog title while drafting.

```
┌ New task from tabs ───────────────────────── ✨ Drafted on your device ┐
│ Tabs (5 of 6)                                              [▾ hide]    │
│  [x] 🟦 Stripe pricing — stripe.com/pricing                            │
│  [x] 🟦 Paddle | Pricing — paddle.com/pricing                          │
│  [ ] 🟦 YouTube — youtube.com/watch                                    │
│  …                                                                      │
│                                                                         │
│ Title     [ Compare Stripe and Paddle pricing              ]           │
│ Notes     [ Decide which payment provider to use for the  ]            │
│           [ Q4 launch, focusing on fees and VAT handling. ]            │
│ Priority  ( ) Low  (•) Medium  ( ) High                                │
│ Steps     [x] [ Compare transaction fees           ] [×]               │
│           [x] [ Check VAT handling for EU          ] [×]               │
│           [x] [ Write up a recommendation          ] [×]               │
│           [+ Add step]                                                 │
│                                                                         │
│ Hint for AI  [ e.g. "for the Q4 launch"   ]  [↻ Draft again]           │
│ ⓘ Starting this task will park “Plan offsite”.        ← only if needed │
│─────────────────────────────────────────────────────────────────────── │
│                         [Cancel]  [Create task]  [▶ Create & start]     │
└─────────────────────────────────────────────────────────────────────────┘
```

#### 4.2.1 Elements

| Element            | Details                                                                                                                                                                                                                    |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Title              | "New task from tabs" (`id="task-from-tabs-title"`)                                                                                                                                                                         |
| Source badge       | AI draft shown: "✨ Drafted on your device". Fallback: none. While drafting: "Drafting…". Class `task-from-tabs-badge`.                                                                                                    |
| Tabs section       | Header "Tabs ({checked} of {total})" + hide/show toggle. **Expanded** when total ≤ 8, collapsed otherwise. Each row: checkbox (`aria-label="Include {title}"`), favicon (🌐 fallback), title, short URL (`shortUrlForAi`). |
| Title input        | Required. `maxLength={TASK_TITLE_MAX}` (80). `aria-label="Task title"`.                                                                                                                                                    |
| Notes textarea     | Optional. `maxLength={TASK_DESCRIPTION_MAX}` (280). 3 rows. Saved as `Task.description`.                                                                                                                                   |
| Priority           | Radio group `low` / `medium` / `high`, labels "Low", "Medium", "High". Default `medium`.                                                                                                                                   |
| Steps              | 0–`MAX_STEPS` (5) rows. Each: checkbox "include" (checked), text input `maxLength={STEP_MAX}` (80), `×` remove. **+ Add step** adds an empty, included row (hidden at 5 rows). Empty rows are ignored on create.           |
| Hint + Draft again | Shown only when AI can be used (§7.1). Hint input `maxLength={HINT_MAX}` (120), placeholder `e.g. "for the Q4 launch"`. **↻ Draft again** re-prompts (§6.5). Disabled while drafting.                                      |
| Park warning       | Shown when another task is active (`getActiveContextTask(tasks)` from `src/features/tasks/utils/contextUtils.ts`): "ⓘ Starting this task will park “{title}”." Only relates to **Create & start**.                         |
| Footer             | **Cancel**, **Create task**, primary **▶ Create & start**. Both create buttons are disabled when the title is empty, while drafting, or while creating.                                                                    |

#### 4.2.2 States

| State                | What the user sees                                                                                                                                                                                                                                    |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `drafting` (AI path) | Tabs list is visible and editable. Form fields show skeleton shimmer (CSS only, class `is-drafting`) and are disabled. A line under the badge: "Drafting from {n} tabs…". If the model is downloading: `ModelStatus` with progress. **Cancel** works. |
| `ready`              | Fields filled (AI draft or fallback) and editable.                                                                                                                                                                                                    |
| `creating`           | All controls disabled. The clicked button shows "Creating…" / "Starting…".                                                                                                                                                                            |
| `error` (AI failed)  | Fields filled with the **fallback draft** (§5.3) and editable, and a small inline note: "{aiErrorMessage}. You can edit the task yourself." The dialog never blocks on AI errors.                                                                     |

Changing which tabs are checked does **not** redraft automatically. When the checked set has changed since the last draft, the **↻ Draft again** button gets a dot and the label "↻ Draft again (tabs changed)".

The user's edits are never overwritten **silently**. If the user typed in Title/Notes/Steps and then clicks **Draft again**: `confirm('Replace your title, notes and steps with a new draft?')`.

### 4.3 Toasts

| Situation                               | Text                                                                                       | Type      |
| --------------------------------------- | ------------------------------------------------------------------------------------------ | --------- |
| No organizable tabs and no explicit ids | "No web tabs to use: open some pages first." (dialog doesn't open)                         | `info`    |
| Create task OK                          | "Created “{title}” with {n} tabs" (`pluralizeTabs`)                                        | `success` |
| Create & start OK                       | "Started “{title}” · {n} tabs grouped" (+ " · Parked “{other}”" if a task was auto-parked) | `success` |
| Task saved but attaching tabs failed    | "Created “{title}”, but couldn't attach its tabs: {message}"                               | `error`   |
| Task couldn't be saved                  | "Couldn't create the task: {message}" (dialog stays open, `ready` state)                   | `error`   |

## 5. The draft

### 5.1 Types and limits: `src/features/taskDraft/types.ts`

**Write this:**

```ts
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
```

### 5.2 AI draft: `src/features/taskDraft/utils/aiDraft.ts`

#### System prompt (write verbatim)

```ts
export const DRAFT_SYSTEM_PROMPT = [
    'You turn a set of browser tabs into one to-do task for the person who opened them.',
    'Each tab has a title and a short address. They may also give a hint about their goal.',
    'Write:',
    '- title: what they are trying to get done, as a short imperative phrase (3 to 8 words, at most 80 characters), e.g. "Compare Stripe and Paddle pricing". No quotes, no emoji, no trailing period.',
    '- description: one or two plain sentences of context, at most 280 characters. Empty string if there is nothing useful to add.',
    '- priority: "high" only if the tabs or hint suggest urgency (deadline, outage, bug, payment due, today); "low" for reading, entertainment or someday ideas; otherwise "medium".',
    '- steps: 0 to 5 concrete next actions, each an imperative phrase of at most 80 characters, in a sensible order. Do not invent facts that are not suggested by the tabs.',
    'Answer only with JSON that matches the schema.',
].join('\n');
```

#### Input (write this)

```ts
export function buildDraftInput(tabs: { title: string; url: string }[], hint?: string): string {
    const lines = tabs.map(tab => `- ${describeTabForAi(tab)}`);
    const parts = [`Tabs:\n${lines.join('\n')}`];
    const cleanHint = hint?.trim().slice(0, HINT_MAX);
    if (cleanHint) parts.push(`Their hint: ${cleanHint}`);
    parts.push('Draft the task.');
    return parts.join('\n\n');
}
```

#### Schema (write this)

```ts
export const DRAFT_SCHEMA = {
    type: 'object',
    properties: {
        title: { type: 'string', minLength: 3, maxLength: TASK_TITLE_MAX },
        description: { type: 'string', maxLength: TASK_DESCRIPTION_MAX },
        priority: { type: 'string', enum: ['low', 'medium', 'high'] },
        steps: {
            type: 'array',
            maxItems: MAX_STEPS,
            items: { type: 'string', minLength: 3, maxLength: STEP_MAX },
        },
    },
    required: ['title', 'description', 'priority', 'steps'],
    additionalProperties: false,
};
```

Example answer:

```json
{
    "title": "Compare Stripe and Paddle pricing",
    "description": "Decide which payment provider to use, focusing on fees and VAT handling.",
    "priority": "medium",
    "steps": ["Compare transaction fees", "Check VAT handling for EU", "Write up a recommendation"]
}
```

#### Normalizer: `normalizeDraft(raw: unknown): TaskDraft | null`

Used as `validate` in `promptJson`. Steps in order:

1. `raw` must be a non-null object, or return `null`.
2. `title`: `cleanLine(String(raw.title ?? ''))`, where `cleanLine` collapses whitespace, trims, removes wrapping quotes (`"…"`, `'…'`, `“…”`), removes emoji (`/\p{Extended_Pictographic}/gu`), and removes **one** trailing `.`. Cut to `TASK_TITLE_MAX`. If shorter than 3 chars → return `null`.
3. `description`: collapse whitespace, trim, cut to `TASK_DESCRIPTION_MAX`. A non-string → `''`. If it equals the title (case-insensitive) → `''`.
4. `priority`: if it's one of `low|medium|high` use it, else `'medium'`.
5. `steps`: if not an array → `[]`. Map each with `cleanLine`, drop entries shorter than 3 chars, drop duplicates (case-insensitive), drop entries equal to the title, cut each to `STEP_MAX`, keep the first `MAX_STEPS`.
6. Return `{ title, description, priority, steps }`.

#### Normalizer test table

| #   | `raw`                                                                  | Expected                               |
| --- | ---------------------------------------------------------------------- | -------------------------------------- |
| D1  | the example above                                                      | unchanged                              |
| D2  | `title: '"Compare fees."'`                                             | `Compare fees`                         |
| D3  | `title: 'Plan 🏖️  trip'`                                               | `Plan trip`                            |
| D4  | `title: 'ab'`                                                          | `null`                                 |
| D5  | `title` 120 chars                                                      | cut to 80                              |
| D6  | `priority: 'urgent'`                                                   | `medium`                               |
| D7  | `steps: ['Do A', 'do a', 'x', 'Do B', 'Do C', 'Do D', 'Do E', 'Do F']` | `['Do A','Do B','Do C','Do D','Do E']` |
| D8  | `steps: 'Do A'`                                                        | `[]`                                   |
| D9  | `description: 42`                                                      | `''`                                   |
| D10 | `description` equal to title                                           | `''`                                   |
| D11 | `null`, `[]`, `'text'`                                                 | `null`                                 |

### 5.3 Fallback draft (no AI): `src/features/taskDraft/utils/fallbackDraft.ts`

`fallbackDraft(tabs: { title: string; url: string }[]): TaskDraft`

1. No tabs → `{ title: '', description: '', priority: 'medium', steps: [] }`.
2. If **all** tabs share one `siteKey` (from `src/features/organize/utils/siteGrouping.ts`; if the organize spec isn't implemented yet, move `siteKey` into `src/features/ai/utils/tabText.ts` and import from there) and there are ≥ 2 tabs → title `Research {siteKey}`.
3. Otherwise → title = the first tab's title, cleaned with `cleanLine` (§5.2) and cut to 60 chars. If that leaves fewer than 3 chars → `Work on {siteKey of first tab}`.
4. `description: ''`, `priority: 'medium'`, `steps: []`.

Tests: one tab; two tabs same site; mixed sites; a first tab titled "–"; empty input.

## 6. Running the AI

### 6.1 When AI is used

`useAi = settings.taskDrafts && availability ∈ { available, downloadable, downloading }` (cached in the store; see §7.1 and AI_TAB_GROUPING §8.1 for why).

### 6.2 First draft (on open)

```
session ← createSession(DRAFT_SYSTEM_PROMPT, onProgress)    // synchronously in openTaskFromTabs (click)
tabs ← explicit ids ? await getTabsByIds(ids) : await getOrganizableTabs(windowId)
if tabs.length === 0 → toast (§4.3), close, destroy session
checked ← all tabs
draft ← fallbackDraft(checked)                              // shown immediately if !useAi
if useAi:
    state ← drafting
    candidates ← checked.slice(0, MAX_TABS_FOR_DRAFT)
    { input } ← await fitInput(await session, candidates, t => buildDraftInput(t, hint), 1)
    draft ← await promptJson(await session, input, { schema: DRAFT_SCHEMA, validate: normalizeDraft, signal })
    source ← 'ai'
state ← ready  (or error with fallbackDraft on AiError other than 'aborted')
```

### 6.3 `getTabsByIds(ids: number[]): Promise<OrganizableTab[]>`

Put it in `src/features/ai/utils/collectTabs.ts` next to `getOrganizableTabs`.

- `chrome.tabs.get(id)` for each, ignoring rejections (closed tabs).
- Same filters as `getOrganizableTabs` **except the `groupId` rule**: tabs from the Organize dialog are in a group by definition. Pinned, non-capturable and incognito tabs are still excluded.
- Keep the order of `ids`.

### 6.4 Which tabs are sent

Only **checked** tabs, in list order, at most `MAX_TABS_FOR_DRAFT` (30), fewer if `fitInput` trims. If trimmed, show "ⓘ The draft is based on the first {k} tabs." under the badge.

### 6.5 Draft again

- Re-use the stored session. It's a click, so creating a new session is also allowed if none exists (e.g. the first attempt failed with `download-failed`). In that case call `createSession` synchronously first.
- Input: `buildDraftInput(checkedTabs, hint)` + (if a previous AI draft exists) `\nWrite a different draft from your last answer.`
- Replace title, description, priority and steps (after the confirm in §4.2.2 if the user edited anything).

## 7. UI state: `src/features/taskDraft/store/taskDraftStore.ts`

### 7.1 State shape (write this)

```ts
type Phase = 'closed' | 'drafting' | 'ready' | 'creating' | 'error';

interface TaskDraftState {
    phase: Phase;
    tabs: OrganizableTab[];
    checkedIds: number[];
    /** Checked ids at the time of the last draft, to show "tabs changed" */
    draftedIds: number[];
    title: string;
    description: string;
    priority: Task['priority'];
    steps: DraftStep[];
    hint: string;
    source: 'ai' | 'fallback';
    dirty: boolean; // user edited title/description/steps
    trimmedTo: number | null; // §6.4 note
    downloadProgress: number | null;
    error: unknown;

    // environment, set by the always-mounted dialog (same pattern as the organize store)
    aiEnabled: boolean;
    availability: ModelAvailability;

    session: Promise<AiSession> | null;
    abort: AbortController | null;

    actions: {
        setEnvironment(env: { aiEnabled: boolean; availability: ModelAvailability }): void;
        open(tabIds?: number[]): void; // click only
        draftAgain(): void; // click only
        toggleTab(id: number): void;
        setTitle(v: string): void;
        setDescription(v: string): void;
        setPriority(p: Task['priority']): void;
        setStep(key: string, text: string): void;
        toggleStep(key: string): void;
        removeStep(key: string): void;
        addStep(): void;
        setHint(v: string): void;
        cancel(): void;
    };
}

export const openTaskFromTabs = (tabIds?: number[]) => useTaskDraftStore.getState().actions.open(tabIds);
```

`create` and `createAndStart` are **not** store actions. They need the board store and `useTaskContextActions`, so they live in the hook in §8.

### 7.2 `open(tabIds?)`: exact sequence

```
if phase !== 'closed' → return
useAi ← aiEnabled && availability ∈ {available, downloadable, downloading}
abort ← new AbortController()
session ← useAi ? createSession(DRAFT_SYSTEM_PROMPT, p => set({ downloadProgress: p })) : null
session?.catch(() => undefined)
set({ phase: useAi ? 'drafting' : 'ready', …reset, session, abort })
(async () => {
    tabs ← tabIds?.length ? await getTabsByIds(tabIds) : await getOrganizableTabs(await currentWindowId())
    if abort.signal.aborted → return
    if tabs.length === 0 → toast; cancel(); return
    applyDraft(fallbackDraft(tabs), 'fallback')                  // title etc.
    set({ tabs, checkedIds: all ids, draftedIds: all ids })
    if !useAi → return
    draft ← §6.2
    applyDraft(draft, 'ai'); set({ phase: 'ready' })
})().catch(error => {
    if isAiError(error, 'aborted') → return
    set({ phase: 'error', error })       // fields already hold the fallback draft
})
```

`applyDraft(d, source)` sets `title`, `description`, `priority`, `steps` (as `DraftStep`s with `key = generateId('step')`, `included = true`), `source`, `dirty = false`, `downloadProgress = null`.

## 8. Creating the task: `src/features/taskDraft/hooks/useCreateTaskFromTabs.ts`

### 8.1 New store action: `addTaskAndSync`

`taskSlice.addTask` sends `ADD_TASK` without waiting. Here the background **must** store the task before `TASK_CONTEXT_*` messages reference it. Otherwise the background `ADD_TASK` write can land after `saveTask` from the context service and wipe the context in the background copy.

Add to `TaskSlice` (`src/store/slices/board/types.ts`) and implement in `taskSlice.ts`:

```ts
/** Like addTask, but resolves once the background has stored the task. Rejects on a background error. */
addTaskAndSync: (task: Omit<Task, 'createdAt' | 'updatedAt'>) => Promise<Task>;
```

Implementation: same as `addTask` (state update + `addTaskToDB`), then:

```ts
const response = (await chrome.runtime.sendMessage({ type: 'ADD_TASK', payload: newTask })) as
    | ExtensionResponse
    | undefined;
if (response?.error) throw new Error(response.error);
return newTask;
```

The `ADD_TASK` background handler already replies `{ success: true }` once stored (`task-service.ts`). Refactor `addTask` to share the object-building code with `addTaskAndSync` so they can't drift apart.

### 8.2 New context action: `attachTabs`

In `src/features/tasks/hooks/useTaskContextActions.ts`, add and return:

```ts
/** Attach specific browser tabs to a task. Returns the updated task; no toast (the caller reports). */
const attachTabs = useCallback(
    async (task: Task, chromeTabIds: number[]): Promise<Task> => {
        const response = await sendContextMessage(CONTEXT_MESSAGES.ADD_TABS, { task, chromeTabIds });
        apply(response);
        return response.task ?? task;
    },
    [apply]
);
```

And a quiet start that returns the response, used only by this feature:

```ts
/** Start a task with no toast/confirm; returns the started task and any auto-parked task */
const startQuietly = useCallback(
    async (task: Task): Promise<ContextResponse> => {
        const response = await sendContextMessage(CONTEXT_MESSAGES.START, { task, windowId: await currentWindowId() });
        apply(response);
        return response;
    },
    [apply]
);
```

`startOrResume` keeps its current behaviour (toast, Pomodoro link). **Pomodoro link:** after `startQuietly`, call the same `readParkResumeSettings()` + `startPomodoroForTask(task.id)` logic. Extract the few lines from `startOrResume` into a local helper `maybeStartPomodoro(taskId)` and call it in both places.

### 8.3 Background change: `addTabsToTask` in `src/background/context-service.ts`

Two current limitations break this feature:

1. `candidates = await Promise.all(payload.chromeTabIds.map(id => chrome.tabs.get(id)))` rejects completely if **one** tab was closed in the meantime.
2. The filter keeps only tabs with no group or in this task's group. Tabs coming from the Organize dialog are in an organize group, so they'd all be dropped.

Change to:

```ts
let candidates: chrome.tabs.Tab[];
const explicit = Boolean(payload.chromeTabIds?.length);
if (explicit) {
    const loaded = await Promise.all(
        (payload.chromeTabIds as number[]).map(id => chrome.tabs.get(id).catch(() => undefined))
    );
    candidates = loaded.filter((tab): tab is chrome.tabs.Tab => tab !== undefined);
} else {
    const windowId = await resolveWindowId(payload.windowId);
    candidates = await chrome.tabs.query({ windowId });
}

// Another task's live group is off limits. Plain groups (e.g. from "Organize tabs") may be
// taken from when the user picked the tabs explicitly.
const active = await getActiveTask();
const otherTaskGroup = active && active.id !== task.id ? (getContext(active).chromeGroupId ?? undefined) : undefined;

candidates = candidates.filter(
    tab =>
        !tab.pinned &&
        toContextTab(tab) !== null &&
        (tab.groupId === undefined ||
            tab.groupId === NO_GROUP ||
            tab.groupId === ctx.chromeGroupId ||
            (explicit && tab.groupId !== otherTaskGroup))
);
```

`getActiveTask` is defined lower in the file. It's a function declaration, so hoisting makes it callable. If lint complains (`no-use-before-define`), move `getActiveTask` above `addTabsToTask`.

Behaviour stays identical for the existing "+ Add current tabs" button (no explicit ids).

When the task is **active** and the tabs come from an organize group, `chrome.tabs.group({ groupId: taskGroup, tabIds })` moves them. Chrome removes the now-empty organize group, which fires `tabGroups.onRemoved`. The context service only reacts if it's the **active task's** group, so nothing else happens. Test §12.3 #4 covers this.

### 8.4 The hook

```ts
export function useCreateTaskFromTabs(): {
    create(): Promise<void>; // "Create task"
    createAndStart(): Promise<void>; // "Create & start"
};
```

**`create()`: exact steps**

1. Read state from `useTaskDraftStore.getState()`. `title = state.title.trim()`. If empty → return (button is disabled anyway).
2. `set({ phase: 'creating' })`.
3. Build:
    ```ts
    const task = {
        id: generateTaskId(),
        title,
        description: state.description.trim() || undefined,
        priority: state.priority,
        status: 'todo' as const,
        checklist: state.steps
            .filter(s => s.included && s.text.trim())
            .map(s => ({ id: generateId(), text: s.text.trim(), completed: false })),
    };
    ```
    Omit `checklist` when empty.
4. `saved = await addTaskAndSync(task)`. On error → toast "Couldn't create the task: …", `phase = 'ready'`, return.
5. `ids = state.checkedIds`. If empty → toast "Created “{title}” with 0 tabs", close, return.
6. `withTabs = await attachTabs(saved, ids)`. On error → toast "Created “{title}”, but couldn't attach its tabs: …", close, return.
7. Toast "Created “{title}” with {pluralizeTabs(withTabs.context?.tabs.length ?? 0)}". Close (`cancel()` resets the store and destroys the session).

**`createAndStart()`: exact steps**

1–4. Same as `create()`. 5. `started = await startQuietly(saved)`. The task has no context tabs, so the background opens **no** tabs. It sets `state: 'active'`, `chromeGroupId: null`, `windowId`, `status: 'doing'`, and parks any other active task (`autoParked`). 6. If `ids.length > 0`: `withTabs = await attachTabs(started.task ?? saved, ids)`. The task is active and has no group, so the background creates the group, styles it (task title, priority colour) and stores the snapshot (existing `addTabsToTask` active branch). 7. Pomodoro: `maybeStartPomodoro(saved.id)` (§8.2). 8. Toast "Started “{title}” · {n} tabs grouped" + (`started.autoParked` ? ` · Parked “${started.autoParked.title}”` : ''). 9. Close.

Error handling: any failure after step 4 → toast with the message, close. The task exists, and the user can retry from the card (Start / + Add current tabs).

**Why START then ADD_TABS (not ADD_TABS then START):** START opens the context's saved tabs as **new** browser tabs. If the context already held the selected tabs, START would open duplicates of tabs that are already open. Starting with an empty context and then attaching the live tabs groups them in place.

## 9. Settings

Uses `AiSettings.taskDrafts` (AI foundation §4.2, default `true`), toggled in Settings → On-device AI → "Draft tasks from tabs". No new settings.

## 10. Files to create or change (checklist)

| File                                                                | Action                                                                                                                                         |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/features/taskDraft/types.ts`                                   | **New**, §5.1                                                                                                                                  |
| `src/features/taskDraft/utils/aiDraft.ts`                           | **New**, §5.2                                                                                                                                  |
| `src/features/taskDraft/utils/fallbackDraft.ts`                     | **New**, §5.3                                                                                                                                  |
| `src/features/taskDraft/store/taskDraftStore.ts`                    | **New**, §7                                                                                                                                    |
| `src/features/taskDraft/hooks/useCreateTaskFromTabs.ts`             | **New**, §8.4                                                                                                                                  |
| `src/features/taskDraft/components/TaskFromTabsDialog.tsx` + `.css` | **New**, §4.2                                                                                                                                  |
| `src/features/ai/utils/collectTabs.ts`                              | Add `getTabsByIds`, §6.3                                                                                                                       |
| `src/store/slices/board/types.ts`, `taskSlice.ts`                   | `addTaskAndSync`, §8.1                                                                                                                         |
| `src/features/tasks/hooks/useTaskContextActions.ts`                 | `attachTabs`, `startQuietly`, `maybeStartPomodoro`, §8.2                                                                                       |
| `src/background/context-service.ts`                                 | `addTabsToTask` change, §8.3                                                                                                                   |
| `src/App.tsx`                                                       | Mount `<TaskFromTabsDialog />`                                                                                                                 |
| `src/features/tasks/components/TasksHeader.tsx` + `TasksView.css`   | Button, §4.1                                                                                                                                   |
| `src/features/ui/components/CommandPalette.tsx`                     | Command, §4.1                                                                                                                                  |
| `src/features/organize/components/OrganizeTabsDialog.tsx`           | Wire **Make a task** to `openTaskFromTabs(group.tabIds)`                                                                                       |
| `README.md`                                                         | Feature bullet: "✨ New task from tabs: drafts a task (title, priority, steps) from the tabs you pick, on-device"                              |
| `docs/specs/PARK_AND_RESUME.md`                                     | §6.1 table: note that `TASK_CONTEXT_ADD_TABS` with explicit `chromeTabIds` now accepts tabs from plain (non-task) groups and skips closed tabs |
| `docs/specs/AI_TASK_FROM_TABS.md`                                   | Status → Implemented, plus "Implementation notes" for deviations                                                                               |

**No `manifest.json` change. No IndexedDB change.**

## 11. Edge cases

| Case                                                   | Behaviour                                                                                                                                                                                                                                               |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No web tabs                                            | Toast, no dialog                                                                                                                                                                                                                                        |
| User unchecks every tab                                | Allowed. Creates a task with no context (like a normal task). Toast says 0 tabs. "Create & start" then just starts it                                                                                                                                   |
| A checked tab is closed before Create                  | Skipped by the background (§8.3). Toast counts only the attached tabs                                                                                                                                                                                   |
| A checked tab joined the active task's group meanwhile | Skipped (it's the other task's group). Unless this task **is** the active one, which can't happen for a new task                                                                                                                                        |
| Another task is active, user clicks Create & start     | That task is auto-parked (its tabs close if "Close tabs after parking" is on), as with the card's Start button. The dialog warned in advance (§4.2.1)                                                                                                   |
| Selected tabs are in two windows                       | Can't happen from the header/palette (one window). From Organize, all tabs are in one window. If it happens anyway, `chrome.tabs.group` uses the first tab's window; Chrome may refuse tabs from another window. The background error becomes the toast |
| Model downloading on first use                         | `drafting` state with progress; fallback draft is already in the fields underneath. Cancel keeps Chrome downloading                                                                                                                                     |
| AI returns a title in another language                 | Accepted. The user can edit                                                                                                                                                                                                                             |
| Very long tab titles                                   | `describeTabForAi` clamps to 80 chars                                                                                                                                                                                                                   |
| User opens the dialog twice quickly                    | Second `open` is ignored while `phase !== 'closed'`                                                                                                                                                                                                     |
| Dialog open while the user switches TabPlex views      | The dialog is in `App.tsx`, so it stays open across routes                                                                                                                                                                                              |
| `ADD_TASK` times out (background asleep)               | The background fallback timeout replies `{ success: true }` after 1 s. The write still completes. Acceptable                                                                                                                                            |

## 12. Tests

Follow the `write-tests` skill.

### 12.1 Pure functions

- `src/features/taskDraft/utils/__tests__/aiDraft.test.ts`: `buildDraftInput` (bullets, short URLs, hint trimmed to 120, "Their hint:" only when given, ends with "Draft the task."), `DRAFT_SCHEMA` limits, **D1–D11**.
- `src/features/taskDraft/utils/__tests__/fallbackDraft.test.ts`: the five cases in §5.3.

### 12.2 Store and hook

`src/features/taskDraft/store/__tests__/taskDraftStore.test.ts` (stub `LanguageModel` like the organize store tests):

1. `open()` with AI available calls `LanguageModel.create` synchronously.
2. No tabs → toast, `closed`, session destroyed.
3. AI happy path → `ready`, `source 'ai'`, fields from the example JSON, steps have keys and `included: true`.
4. AI disabled → `create` not called, `ready` immediately with the fallback draft.
5. AI fails twice → `error`, fields hold the fallback draft, inline message is the bad-output text.
6. `open([ids])` uses `getTabsByIds`: includes a grouped tab, skips a closed id and a pinned tab.
7. `toggleTab` changes `checkedIds`; "tabs changed" detection (`checkedIds` vs `draftedIds`).
8. `draftAgain` with `dirty` and `confirm → false` → no prompt sent. With `confirm → true` → prompt input contains the hint and "Write a different draft".
9. `cancel()` aborts and destroys the session.

`src/features/taskDraft/hooks/__tests__/useCreateTaskFromTabs.test.tsx` (`renderHook`, `respondToMessages` from the chrome mock to answer `ADD_TASK`, `TASK_CONTEXT_START`, `TASK_CONTEXT_ADD_TABS`):

1. `create()` sends `ADD_TASK` and waits for its response **before** sending `TASK_CONTEXT_ADD_TABS` (assert message order). The payload has `chromeTabIds` = checked ids. The checklist only has included, non-empty steps with `completed: false`. Empty description → `description` undefined.
2. `createAndStart()` sends `ADD_TASK` → `TASK_CONTEXT_START` → `TASK_CONTEXT_ADD_TABS`, in that order. The toast includes "Parked “…”" when `autoParked` is in the START response.
3. `ADD_TASK` responds `{ error }` → toast "Couldn't create the task: …", phase back to `ready`, no context messages sent.
4. `ADD_TABS` fails → task still in the store, toast "…but couldn't attach its tabs…", dialog closed.
5. Pomodoro: with `startPomodoroOnStart: true` in `chrome.storage.local`, `createAndStart` starts the timer linked to the task (same assertion style as the existing Park & Resume tests in `src/features/tasks/__tests__/taskHooks.test.tsx`).

`src/store/__tests__/boardStore.test.ts` (extend it): `addTaskAndSync` resolves with the task after the background response, rejects on `{ error }`, and updates state + IndexedDB like `addTask`.

### 12.3 Background (`src/background/__tests__/context-service.test.ts`, extend)

1. `ADD_TABS` with explicit ids where one id doesn't exist → the others are attached, no error.
2. Explicit ids of tabs in a **plain** group, idle task → snapshots stored, tabs stay in their group.
3. Explicit ids where one tab is in the **active other task's** group → that tab is skipped.
4. Explicit ids from a plain group, **active** task without a group → a new group is created and styled with the task title and colour. The plain group disappears, and the active task is **not** parked by `tabGroups.onRemoved` (state still `active` after the debounce; use fake timers or `flushPromises`).
5. Regression: no explicit ids (the "+ Add current tabs" path) still skips tabs in plain groups.

### 12.4 Component (`src/features/taskDraft/__tests__/TaskFromTabsDialog.test.tsx`)

1. Drafting state: skeleton class `is-drafting`, create buttons disabled, Cancel enabled.
2. Ready: title input has the drafted title, priority radio checked, steps rendered. "Tabs (2 of 3)" after unchecking one.
3. Title cleared → both create buttons disabled.
4. **+ Add step** hidden at 5 steps. `×` removes a step.
5. Park warning shown only when another task is active (seed one with `context.state: 'active'`).
6. Hint field and **Draft again** hidden when AI can't be used.
7. "tabs changed" label after toggling a tab.
8. Error state shows the inline note and still allows Create.
9. `Esc` cancels; it doesn't while creating.

Also extend `src/features/ui/__tests__/CommandPalette.test.tsx` ("New task from open tabs" listed and calls `openTaskFromTabs`) and the Tasks view tests (`src/features/tasks/__tests__/TaskViews.test.tsx`: the header button calls `openTaskFromTabs()` with no ids).

### 12.5 E2E (`e2e/task-from-tabs.spec.ts`)

Uses the `.test`-host route from AI_TAB_GROUPING §13.5. If that spec isn't implemented yet, make the same fixture change here.

1. **Fallback draft + Create task:** open `docs.test/a`, `docs.test/b`, `docs.test/c`. Tasks view → **✨ Task from tabs**. (No `LanguageModel` in headless → fallback.) Title is "Research docs.test". Uncheck `docs.test/c`. Change priority to High. Click **Create task**. Assert with `storedTask`-style lookup by title (read `tabboard_tasks` in the service worker) that the task exists with `priority: 'high'`, `context.state` `idle` (or missing state with tabs), and exactly 2 context tabs. The 3 pages are still open.
2. **Create & start groups in place:** same 3 pages, **▶ Create & start**. Assert: the task is `active` with status `doing`; one Chrome group titled with the task title contains the 3 tabs; **the number of open `docs.test` tabs is still 3** (no duplicates, via `openWebTabs`).
3. **Auto-park warning:** seed and start another task first (existing fixtures). Open the dialog → the warning text is visible. Create & start → the other task is `parked`.
4. **From Organize (only if AI_TAB_GROUPING is implemented):** organize by site, then **Make a task** on a group → the dialog lists exactly that group's tabs. Create & start → the tabs move from the organize group into the task's group, and the organize group is gone.
5. **Stubbed AI (optional):** same approach and caveat as AI_TAB_GROUPING §13.5 #4. The stub returns the §5.2 example. Assert the badge "✨ Drafted on your device" and the three steps.

### 12.6 Manual acceptance (real Chrome, capable device)

| #   | Steps                                                                    | Expected                                                                                          |
| --- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| M1  | 5 tabs about one topic → Task from tabs                                  | Sensible title, priority, 2–5 steps in ≤ 10 s                                                     |
| M2  | Add a hint, Draft again                                                  | Draft reflects the hint                                                                           |
| M3  | Create task                                                              | Task card shows "5 tabs · Not started"; tabs still open                                           |
| M4  | Create & start                                                           | Group with the task title and priority colour; no new tabs opened; the active pill shows the task |
| M5  | Then Park                                                                | Park & Resume works as usual (tabs close, note saved)                                             |
| M6  | From an Organize group → Make a task → Create & start                    | Tabs move into the task group, organize group disappears, task stays active                       |
| M7  | AI off / unsupported device                                              | Fallback title, no hint field, everything else works                                              |
| M8  | Keyboard only (Ctrl+K → "New task from open tabs" → Tab through → Enter) | All reachable, focus visible, Esc cancels                                                         |
| M9  | Light and dark theme, 700 px wide                                        | Readable, no overflow                                                                             |

## 13. Privacy

- Sent to the on-device model: titles (clamped) and host + path of the **checked** tabs, plus the user's hint. No query strings, no page content.
- The draft stays in the page until the user creates the task. Then it's a normal task (IndexedDB + `chrome.storage.local`, exported with the rest of the data).
- The AI foundation's `PRIVACY.md` text covers this feature. Check that it names "New task from tabs".

## 14. Delivery plan (commits)

| #   | Commit                                                        | Contents                                           | Exit check                                                         |
| --- | ------------------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------ |
| 1   | `feat(tasks): add addTaskAndSync and explicit tab attach`     | §8.1, §8.2, §8.3 + tests §12.3 and the slice test  | Background and slice tests pass; existing Park & Resume E2E passes |
| 2   | `feat(tasks): draft tasks from tabs with on-device AI`        | §5, §6, §7 + tests §12.1, §12.2 (store)            | D1–D11 and store tests pass                                        |
| 3   | `feat(tasks): add new task from tabs dialog and entry points` | §4, §8.4, §10 UI files + tests §12.2 (hook), §12.4 | Component tests pass; manual M1–M4                                 |
| 4   | `test(e2e): cover new task from tabs`                         | §12.5                                              | `npm run test:e2e` passes                                          |
| 5   | `docs: document new task from tabs`                           | README, PARK_AND_RESUME note, spec status          | —                                                                  |

Run the `verify` skill before every commit. Commit 1 touches `src/background/**`: reload the extension in `chrome://extensions` before manual testing.

## 15. Future (not in v1)

- **Create & park:** save the task with its tabs and close them in one click (a OneTab-style "save for later" with context).
- Suggest a due date from words like "Friday" or "by the 15th", shown as a suggestion the user must confirm.
- "Suggest a task for this tab": when a new tab is opened, offer "Add to {task}?" based on similarity with existing contexts (on-device).
- Draft a task from a **note** (Markdown editor → "Make tasks from this note").

## 16. Decisions (were open questions)

Decided by the product owner on 2026-10-03 (ROADMAP.md, decision D11). This feature is in the **v1.1** milestone (D5), after the v1.0 launch.

1. Should **Create & start** be the primary button, or **Create task**? Decided: Create & start, since it's the shortest path into Park & Resume. Revisit after using it for a week.
2. Should the dialog remember the last hint? Decided: no; hints are specific to one set of tabs.
3. Allow choosing tabs from other windows? Decided: no in v1.
