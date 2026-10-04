# Spec: Organize tabs (AI tab grouping)

|                  |                                                                                              |
| ---------------- | -------------------------------------------------------------------------------------------- |
| **Status**       | Ready to implement · milestone v1.0 (ROADMAP queue #7)                                       |
| **Owner**        | Mohamed                                                                                      |
| **Created**      | 2026-10-03                                                                                   |
| **Branch**       | `feature/ai-organize`                                                                        |
| **Depends on**   | [AI_FOUNDATION.md](AI_FOUNDATION.md) must be merged first (`src/features/ai/**`)             |
| **Related**      | [AI_TASK_FROM_TABS.md](AI_TASK_FROM_TABS.md) (its "Make a task" button lives in this dialog) |
| **Roadmap item** | "AI-powered tab organization suggestions" (`ROADMAP.md` → Future Enhancements)               |
| **Pitch**        | _"One click turns 30 loose tabs into 5 labelled groups, privately, on your computer."_       |

---

## 0. How to use this spec

- Implement in the order of §15. Each step lists exact files, exports, behaviour, copy text and tests.
- **"Write this"** blocks are the intended code. **"Shape"** blocks give structure; fill in details.
- Names in `code` (files, exports, CSS classes, message types, storage keys) are **decided**. Don't rename them: other specs and tests refer to them.
- All user-facing text is in the tables. Use it verbatim.
- When this spec and the code disagree about existing behaviour, the code wins. Update this spec in the same PR.

## 1. Problem

People collect 20–60 tabs across several pieces of work. Chrome's tab groups help, but making them by hand is slow, so most people don't. Existing AI groupers send every URL to a cloud model.

TabPlex already has the pieces: tab-group handling (Park & Resume), boards (saved tab collections) and now an on-device model (AI foundation). This feature puts them together: **suggest groups → let the user adjust → create real Chrome tab groups → optionally save them as a board.**

## 2. Goals and non-goals

### Goals

1. From the Today view or the command palette, the user gets a **preview** of suggested groups for the ungrouped tabs in the current window, within ~10 s on a capable device.
2. The user can rename groups, change colours, drop a tab from a group, or skip a whole group before anything changes.
3. Confirming creates **real Chrome tab groups** (titled and coloured).
4. **Undo** removes the groups it just created.
5. **Save as board** turns the groups into a TabPlex board (one folder per group).
6. Works **without AI** by grouping by site, so every user gets value.
7. Never touches pinned tabs, tabs already in a group (including the active Park & Resume task's group), TabPlex itself, browser pages, or incognito tabs.

### Non-goals (v1)

- Re-organizing tabs that are already grouped, or merging into existing groups.
- Multiple windows at once (current window only).
- Closing duplicate tabs (tracked in §16 Future).
- Running automatically (always a user click).
- Dragging tabs between suggested groups in the preview (v1: remove from a group only; see §16).

## 3. User stories

| #   | As a user I want to…                                               | So that…                                 |
| --- | ------------------------------------------------------------------ | ---------------------------------------- |
| O1  | click **Organize tabs** and see suggested groups for my loose tabs | I don't have to sort 30 tabs by hand     |
| O2  | rename a group, change its colour, or skip it before applying      | the result matches how I think           |
| O3  | remove a tab that ended up in the wrong group                      | one bad suggestion doesn't spoil it      |
| O4  | undo right after applying                                          | trying it is risk-free                   |
| O5  | save the groups as a board                                         | I can close the tabs and come back later |
| O6  | still get site-based groups when my computer can't run the AI      | the feature is useful anyway             |
| O7  | be sure my task groups and pinned tabs are never touched           | Park & Resume keeps working              |

## 4. UX

### 4.1 Entry points

| Where                                                                    | Element                                                                                                                                                                             | Behaviour                         |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| Today → Quick actions (`src/features/today/components/QuickActions.tsx`) | New 5th card, class `quick-action-card organize-action`. Title **"Organize tabs"**, description **"Group open tabs"**. Icon: the SVG in §4.1.1                                      | `onClick={() => startOrganize()}` |
| Command palette (`src/features/ui/components/CommandPalette.tsx`)        | Command `id: 'organize-tabs'`, name **"Organize open tabs"**, icon `'✨'`, category `'action'`. Insert directly **after** the Park & Resume commands block and before `export-data` | `action: () => startOrganize()`   |

No keyboard shortcut in v1. `useKeyboardShortcuts.ts` already has several Alt+Shift bindings; adding one needs a clash check and a README update. List it in §16.

#### 4.1.1 Quick action icon and grid

Icon (24×24, stroke `currentColor`, like the others): four small rounded rectangles in a 2×2 layout.

```tsx
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
</svg>
```

`QuickActions.css`:

- The grid is `grid-template-columns: repeat(4, 1fr)` today. With 5 cards, change the base rule to `repeat(5, 1fr)`. Keep the existing media queries (2 columns, then 1 column) as they are.
- Add an amber theme following the pattern of `.task-action` / `.note-action`:
    - `.organize-action` background `linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, var(--color-bg-secondary) 100%)`, border `rgba(245, 158, 11, 0.2)`
    - `.organize-action .action-icon` background `linear-gradient(135deg, #f59e0b 0%, #d97706 100%)`, shadow `0 4px 12px rgba(245, 158, 11, 0.3)`
    - `.organize-action:hover` background `linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(217, 119, 6, 0.08) 100%)`, border `rgba(245, 158, 11, 0.4)`
- Check the layout at 1440 px, 1100 px and 700 px wide in both themes. Titles must not wrap mid-word.

### 4.2 Dialog

One dialog component, `OrganizeTabsDialog`, mounted **once** in `src/App.tsx` directly after `<ParkDialog />`. Visual style: reuse the overlay/panel look of `ParkDialog.css` (same radius, shadow, backdrop). Copy the variables, don't import the other component's CSS.

- `role="dialog"`, `aria-modal="true"`, `aria-labelledby="organize-dialog-title"`.
- `Esc` = Cancel (in every phase except `applying`). Clicking the backdrop = Cancel in `loading`/`error` phases only (not in `preview`, so edits aren't lost by a stray click).
- Width: `min(720px, calc(100vw - 32px))`. Max height `calc(100vh - 64px)`, body scrolls, header and footer stay visible.
- Focus: on open, focus the dialog title (`tabIndex={-1}`). In `preview`, focus the first group's name input.

The dialog has these phases (the store's `phase` field, §8.2):

#### Phase `loading`

```
┌ Organize tabs ───────────────────────────────────────┐
│  ⏳ Sorting 23 tabs on your computer…                  │
│  [ModelStatus: Downloading on-device AI model… 42%]   │  ← only while downloading
│                                              [Cancel] │
└───────────────────────────────────────────────────────┘
```

| Situation                    | Main line                                                        |
| ---------------------------- | ---------------------------------------------------------------- |
| Reading tabs (count unknown) | "Looking at your tabs…"                                          |
| AI path, model downloading   | "Getting the on-device AI ready…" + `ModelStatus` with progress  |
| AI path, prompting           | "Sorting {n} tabs on your computer…"                             |
| Site path                    | Never shown; site grouping is instant, so go straight to preview |

#### Phase `preview`

```
┌ Organize 23 tabs ──────────────── ✨ Suggested by on-device AI ┐
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ [x] (●red) [ Pricing research        ]          5 tabs ▾ │ │
│ │     🟦 Stripe pricing — stripe.com/pricing            ×  │ │
│ │     🟦 Paddle pricing — paddle.com/pricing            ×  │ │
│ │     …                                                     │ │
│ └──────────────────────────────────────────────────────────┘ │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ [x] (●blue) [ React docs              ]         4 tabs ▸ │ │
│ └──────────────────────────────────────────────────────────┘ │
│ ▸ Not grouped (3)                                             │
│ ⓘ 12 tabs on the right weren't included (too many for the     │
│   on-device AI).                                              │
│ [ ] Collapse groups after creating                            │
│──────────────────────────────────────────────────────────────│
│ [Try again] [Group by site instead]      [Cancel] [Create 4 groups] │
└──────────────────────────────────────────────────────────────┘
```

Elements, in order:

| Element                       | Details                                                                                                                                                                                                            |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Title                         | "Organize {n} tabs" where n = tabs in the proposal (grouped + ungrouped, excluding omitted)                                                                                                                        |
| Source badge (right of title) | AI: "✨ Suggested by on-device AI". Site: "Grouped by site". Class `organize-source-badge`.                                                                                                                        |
| Group card (`organize-group`) | One per proposed group, in proposal order.                                                                                                                                                                         |
| ↳ Enable checkbox             | `aria-label="Create group {name}"`. Unchecked → card at 50% opacity, excluded from apply.                                                                                                                          |
| ↳ Colour swatch               | A `button` showing the colour as a 14 px dot. Click cycles through `GROUP_COLORS` (§5.1). `aria-label="Colour: {color}. Change colour"`.                                                                           |
| ↳ Name input                  | `maxLength={GROUP_NAME_MAX}` (24). Empty name on apply → use `"Group {i}"`. `aria-label="Group name"`.                                                                                                             |
| ↳ Count + chevron             | "{k} tabs". Chevron toggles the tab list. **Expanded by default when the proposal has ≤ 4 groups**, otherwise collapsed.                                                                                           |
| ↳ Tab rows                    | Favicon (16 px, `🌐` fallback on error), title (ellipsis), short URL (`shortUrlForAi`), `×` button `aria-label="Remove {title} from {name}"`. `×` moves the tab to "Not grouped".                                  |
| ↳ Too few tabs                | If a group drops below `MIN_TABS_PER_GROUP` (2), show "Needs at least 2 tabs" in the card and treat it as disabled (checkbox disabled and unchecked).                                                              |
| Not grouped                   | Collapsed `<details>`: "Not grouped ({k})", listing those tabs (read-only). Hidden when k = 0.                                                                                                                     |
| Omitted note                  | Only when `omittedTabIds.length > 0`: "ⓘ {k} tabs on the right weren't included (too many for the on-device AI)."                                                                                                  |
| Collapse checkbox             | "Collapse groups after creating". Default **unchecked**. Not persisted.                                                                                                                                            |
| Footer left                   | AI source only: **Try again** (re-prompt, §6.6) and **Group by site instead** (switch to §7). Site source, AI usable: **Try with AI**, which re-runs the AI path. This is a click, so session creation is allowed. |
| Footer right                  | **Cancel** and primary **Create {k} groups**, where k = enabled groups with ≥ 2 tabs. Disabled when k = 0, with the label "Create groups".                                                                         |

#### Phase `applying`

Primary button shows "Creating…", all controls disabled. `Esc` ignored.

#### Phase `done`

```
┌ Organized ───────────────────────────────────────────┐
│ ✓ Created 4 groups with 20 tabs.                       │
│   ● Pricing research (5)        [Make a task]          │
│   ● React docs (4)              [Make a task]          │
│   …                                                    │
│ ⚠ 1 tab was skipped because it closed or moved.        │  ← only if skipped > 0
│──────────────────────────────────────────────────────│
│ [Undo]          [Save as board]               [Done]   │
└───────────────────────────────────────────────────────┘
```

| Element           | Details                                                                                                                                                                                                                 |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Summary           | "Created {g} groups with {t} tabs." (use singular "group"/"tab" when 1)                                                                                                                                                 |
| Group rows        | Colour dot, name, count. **Make a task** button opens the "New task from tabs" dialog with that group's tab ids ([AI_TASK_FROM_TABS.md](AI_TASK_FROM_TABS.md) §4.1). It is a click, so that dialog can start the model. |
| Skipped note      | Only when `skippedTabIds.length > 0`: "⚠ {k} tab(s) were skipped because they closed or moved."                                                                                                                         |
| **Undo**          | Sends `TABS_UNDO_GROUPS`. Toast "Removed {g} groups" (`info`). Closes the dialog.                                                                                                                                       |
| **Save as board** | Runs §9. Then the button becomes **Open board** (navigates to `/boards`). Toast "Saved as board “{name}”" (`success`). Can only be done once per dialog.                                                                |
| **Done**          | Closes the dialog.                                                                                                                                                                                                      |

Undo stays available until the dialog closes. After that, the user can ungroup in Chrome as normal.

#### Phase `error`

```
┌ Organize tabs ───────────────────────────────────────┐
│ ⚠ The on-device AI took too long. Try again.           │
│──────────────────────────────────────────────────────│
│ [Group by site instead]           [Close] [Try again]  │
└───────────────────────────────────────────────────────┘
```

- Message: `aiErrorMessage(error)` (AI foundation §4.7).
- **Try again** is shown when the error code is `timeout`, `bad-output` or `download-failed`, and re-runs the AI path. It's a click, so creating a session is allowed.
- **Group by site instead** is always shown. It switches to §7 using the tabs already read.

### 4.3 Toasts (no dialog)

| Situation                                              | Toast                                                                             | Type      |
| ------------------------------------------------------ | --------------------------------------------------------------------------------- | --------- |
| Fewer than `MIN_TABS_TO_ORGANIZE` (4) organizable tabs | "Nothing to organize: open at least 4 web tabs that aren't pinned or in a group." | `info`    |
| Background didn't respond / threw during apply         | "Couldn't create groups: {message}" (and stay in `preview`)                       | `error`   |
| Undo done                                              | "Removed {g} groups"                                                              | `info`    |
| Board saved                                            | "Saved as board “{name}”"                                                         | `success` |

Use `useUIActions().showToast` (already global in `App.tsx`).

## 5. Shared types and constants: `src/utils/organizeTabs.ts`

This file is imported by **both** the UI and the background, so it must stay free of DOM, React and `src/features/**` imports (same rule as `src/utils/taskContext.ts`).

### 5.1 Write this

```ts
// Shared between the UI and the background service worker. Keep free of DOM and React.

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
/** Upper bound sent to the model even if the quota would allow more */
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
```

### 5.2 UI-only types: `src/features/organize/types.ts`

```ts
import { TabGroupColor } from '../../utils/organizeTabs';

export interface ProposedGroup {
    /** Stable React key ('g1', 'g2', …), not shown */
    key: string;
    name: string;
    color: TabGroupColor;
    tabIds: number[];
    enabled: boolean;
}

export interface GroupProposal {
    source: 'ai' | 'site';
    groups: ProposedGroup[];
    /** Considered but not placed in any group */
    ungroupedTabIds: number[];
    /** Not considered at all (didn't fit the model's input) */
    omittedTabIds: number[];
}
```

**Invariant (enforce in the normalizers and the reducer):** every organizable tab id appears in **exactly one** of: a group's `tabIds`, `ungroupedTabIds`, `omittedTabIds`.

## 6. AI path: `src/features/organize/utils/aiGrouping.ts`

### 6.1 System prompt (write verbatim)

```ts
export const ORGANIZE_SYSTEM_PROMPT = [
    'You sort a person’s open browser tabs into groups by the piece of work they belong to.',
    'Each tab has a number, a title and a short address.',
    'Rules:',
    '- Group by task or topic (for example "Trip to Lisbon", "Q4 pricing", "React hooks"), not by website, unless one website is clearly one topic.',
    '- Make between 2 and 8 groups. Every group needs at least 2 tabs.',
    '- Group names: 1 to 3 words, at most 24 characters, Title Case, no emoji, no quotes.',
    '- Use each tab number at most once. Leave a tab out if it fits no group.',
    '- Pick a different color for each group when you can.',
    'Answer only with JSON that matches the schema.',
].join('\n');
```

### 6.2 Input format (write this)

```ts
import { describeTabForAi } from '../../ai/utils/tabText';
import { OrganizableTab } from '../../ai/types';

/** Numbered from 1 so the model never sees browser tab ids */
export function buildOrganizeInput(tabs: OrganizableTab[]): string {
    const lines = tabs.map((tab, i) => `${i + 1}. ${describeTabForAi(tab)}`);
    return `Tabs:\n${lines.join('\n')}\n\nGroup these ${tabs.length} tabs.`;
}
```

Example input:

```
Tabs:
1. Stripe pricing (stripe.com/pricing)
2. Paddle | Pricing (paddle.com/pricing)
3. useEffect – React (react.dev/reference/react/useEffect)
4. Lisbon flights – Google Flights (google.com/travel/flights)
5. Rules of Hooks – React (react.dev/reference/rules/rules-of-hooks)
6. Lisbon hotels (booking.com/city/pt/lisbon.html)

Group these 6 tabs.
```

### 6.3 Response schema (write this)

```ts
export function organizeSchema(tabCount: number) {
    return {
        type: 'object',
        properties: {
            groups: {
                type: 'array',
                minItems: 1,
                maxItems: MAX_GROUPS,
                items: {
                    type: 'object',
                    properties: {
                        name: { type: 'string', minLength: 1, maxLength: GROUP_NAME_MAX },
                        color: { type: 'string', enum: GROUP_COLORS },
                        tabs: {
                            type: 'array',
                            minItems: MIN_TABS_PER_GROUP,
                            items: { type: 'integer', minimum: 1, maximum: tabCount },
                        },
                    },
                    required: ['name', 'color', 'tabs'],
                    additionalProperties: false,
                },
            },
        },
        required: ['groups'],
        additionalProperties: false,
    };
}
```

Example valid answer for §6.2:

```json
{
    "groups": [
        { "name": "Pricing Research", "color": "red", "tabs": [1, 2] },
        { "name": "React Hooks", "color": "blue", "tabs": [3, 5] },
        { "name": "Lisbon Trip", "color": "green", "tabs": [4, 6] }
    ]
}
```

### 6.4 Normalizer: `normalizeAiProposal(raw: unknown, tabs: OrganizableTab[], omittedTabIds: number[]): GroupProposal | null`

Used as `validate` in `promptJson`. Returns `null` only when the answer is unusable (triggers the one retry). Otherwise it **repairs** the answer. Apply these steps in order:

1. `raw` must be an object with a `groups` array, or return `null`.
2. For each group entry (in order), skip it if it isn't an object.
3. **Name:** `String(entry.name ?? '')`. Remove characters in `"'`\``and emoji (regex`/\p{Extended_Pictographic}/gu`), collapse whitespace, trim, cut to `GROUP_NAME_MAX`. If empty after cleaning → `"Group {i}"` (i = 1-based position among **kept** groups).
4. **Tabs:** keep values that are integers (`Number.isInteger`), within `1..tabs.length`, and **not already used** by an earlier group (first group wins). Map index `n` to `tabs[n - 1].id`.
5. Drop the group if it has fewer than `MIN_TABS_PER_GROUP` tabs left. Its tabs (if any) become ungrouped.
6. **Duplicate names** (case-insensitive) among kept groups: merge the later group's tabs into the earlier one, keeping the earlier name and colour.
7. **Colour:** if `isTabGroupColor(entry.color)` and not used by an earlier kept group → use it. Otherwise take the first unused colour from `GROUP_COLORS`, and if all are used, cycle through `GROUP_COLORS` by position.
8. Keep at most `MAX_GROUPS` groups. Tabs of dropped extra groups become ungrouped.
9. `ungroupedTabIds` = ids of tabs (from `tabs`) not placed in any kept group, in tab order.
10. If **no** group survives → return `null`.
11. `key` = `g{position}` (`g1`, `g2`, …). `enabled = true`.
12. `source = 'ai'`, `omittedTabIds` as passed in.

#### Normalizer test table (each row is a unit test)

| #   | `raw.groups` (6 tabs, ids 101–106)                                         | Expected                                                                        |
| --- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| N1  | the §6.3 example                                                           | 3 groups: `[101,102]` red, `[103,105]` blue, `[104,106]` green; ungrouped `[]`  |
| N2  | `[{name:'A',color:'red',tabs:[1,2]},{name:'B',color:'red',tabs:[3,4]}]`    | B's colour becomes `blue` (first unused in `GROUP_COLORS`)                      |
| N3  | `[{name:'A',color:'red',tabs:[1,2,3]},{name:'B',color:'blue',tabs:[3,4]}]` | A `[101,102,103]`; B loses tab 3 → `[104]` → dropped; ungrouped `[104,105,106]` |
| N4  | tabs `[0, 7, 2.5, '3', 1, 2]`                                              | only `[101,102]` survive                                                        |
| N5  | `name: '  "Trip 🏖️ to   Lisbon" '`                                         | name `Trip to Lisbon`                                                           |
| N6  | `name: ''` for the first kept group                                        | `Group 1`                                                                       |
| N7  | name of 40 chars                                                           | cut to 24 chars                                                                 |
| N8  | two groups named `React` and `react`                                       | merged into the first, tabs combined, one group                                 |
| N9  | 10 valid groups of 2 tabs (with 20 tabs)                                   | first 8 kept, last 4 tabs ungrouped                                             |
| N10 | `color: 'magenta'`                                                         | replaced with the first unused colour                                           |
| N11 | `{}` or `{groups: 'x'}` or `null`                                          | `null`                                                                          |
| N12 | every group has < 2 valid tabs                                             | `null`                                                                          |
| N13 | `omittedTabIds = [107, 108]` passed in                                     | copied to the result unchanged                                                  |

### 6.5 Running the AI path

Inside the store's `startOrganize` / `retryWithAi` (§8.3):

```
session ← createSession(ORGANIZE_SYSTEM_PROMPT, onProgress)      // synchronously, in the click
tabs ← await getOrganizableTabs(windowId)
if tabs.length < MIN_TABS_TO_ORGANIZE → toast (§4.3), destroy session, close
candidates ← tabs.slice(0, MAX_TABS_FOR_AI)
{ input, used } ← await fitInput(await session, candidates, buildOrganizeInput, MIN_TABS_TO_ORGANIZE)
considered ← candidates.slice(0, used)
omitted ← tabs.slice(used).map(t => t.id)        // includes those beyond MAX_TABS_FOR_AI
proposal ← await promptJson(await session, input, {
    schema: organizeSchema(considered.length),
    validate: raw => normalizeAiProposal(raw, considered, omitted),
    signal,
})
phase ← preview(proposal)
```

Keep the session in the store until the dialog closes (needed for **Try again**). Destroy it on close or cancel, and when switching to the site path.

### 6.6 Try again

- Re-use the stored session and the same `considered` tabs.
- Input: `buildOrganizeInput(considered) + '\nSuggest a different grouping from your last answer.'`.
- Replace the proposal entirely. **User edits are discarded.** Show `confirm('Discard your changes and get new suggestions?')` only if the user edited anything (track a `dirty` flag in the store).

## 7. Site path (no AI): `src/features/organize/utils/siteGrouping.ts`

Used when (a) AI is off in settings, (b) availability is `unsupported` or `unavailable`, (c) the user picks **Group by site instead**, or (d) the AI path errors and the user chooses the fallback.

### 7.1 Registrable domain (approximation, no public-suffix list)

**Write this:**

```ts
/** Two-part public suffixes common enough to matter. Not exhaustive by design. */
const TWO_PART_SUFFIXES = new Set([
    'co.uk',
    'org.uk',
    'ac.uk',
    'gov.uk',
    'com.au',
    'net.au',
    'org.au',
    'co.nz',
    'co.jp',
    'ne.jp',
    'com.br',
    'com.mx',
    'com.tr',
    'com.eg',
    'co.in',
    'co.za',
    'com.sg',
    'com.cn',
    'com.hk',
    'co.kr',
]);

/** "docs.github.com" → "github.com"; "news.bbc.co.uk" → "bbc.co.uk"; IPs and "localhost" stay as is */
export function siteKey(rawUrl: string): string | null {
    let host: string;
    try {
        const url = new URL(rawUrl);
        if (url.protocol === 'file:') return 'Local files';
        host = url.hostname.replace(/^www\./, '').toLowerCase();
    } catch {
        return null;
    }
    if (!host || host === 'localhost' || /^[\d.]+$/.test(host) || host.includes(':')) return host || null;
    const parts = host.split('.');
    if (parts.length <= 2) return host;
    const lastTwo = parts.slice(-2).join('.');
    return TWO_PART_SUFFIXES.has(lastTwo) ? parts.slice(-3).join('.') : lastTwo;
}
```

### 7.2 Grouping

`groupBySite(tabs: OrganizableTab[]): GroupProposal`

1. Bucket tabs by `siteKey(tab.url)`. A `null` key → ungrouped.
2. Keep buckets with ≥ `MIN_TABS_PER_GROUP` tabs. Other tabs → ungrouped.
3. Sort kept buckets by size (desc), then by the position of their first tab (asc).
4. Keep the first `MAX_GROUPS`. The rest → ungrouped.
5. Name = the site key (e.g. `github.com`), cut to `GROUP_NAME_MAX`.
6. Colour = `GROUP_COLORS[i % GROUP_COLORS.length]` by sorted position.
7. Inside a group, tabs keep tab-strip order. `ungroupedTabIds` in tab-strip order.
8. `source: 'site'`, `omittedTabIds: []` (no model limit), keys `g1…`.
9. If no bucket qualifies, return a proposal with zero groups. The preview then shows only "Not grouped" plus the note "No two tabs share a site. Try with AI, or open more tabs." (disabled primary button).

#### Site grouping test table

| #   | URLs                                                     | Expected groups                                                     |
| --- | -------------------------------------------------------- | ------------------------------------------------------------------- |
| S1  | `github.com/a`, `docs.github.com/b`, `gist.github.com/c` | one group `github.com` with 3 tabs                                  |
| S2  | `news.bbc.co.uk/x`, `www.bbc.co.uk/y`                    | one group `bbc.co.uk`                                               |
| S3  | `a.com`, `b.com`, `c.com` (one each)                     | zero groups, all ungrouped                                          |
| S4  | `localhost:3000/a`, `localhost:5173/b`                   | one group `localhost`                                               |
| S5  | `file:///C:/x.pdf`, `file:///C:/y.pdf`                   | one group `Local files`                                             |
| S6  | 9 sites × 2 tabs                                         | first 8 kept (ties sorted by first position), last 2 tabs ungrouped |
| S7  | `http://192.168.1.1/a`, `http://192.168.1.1/b`           | one group `192.168.1.1`                                             |

## 8. UI state: `src/features/organize/store/organizeStore.ts`

The trigger (Quick action, palette) and the dialog live in different components, so the state lives in a small Zustand store (same library as `uiStore`).

### 8.1 Why the store caches settings and availability

`createSession` must run **before any `await`** in the click (AI foundation §3.1). Reading `chrome.storage` is async. So the store keeps the **latest known** `AiSettings` and `ModelAvailability`, loaded when the app starts and kept fresh. The click handler reads them synchronously.

`OrganizeTabsDialog` (always mounted) runs:

```ts
const { settings } = useAiSettings();
const { availability } = useModelAvailability();
useEffect(
    () => setEnvironment({ aiEnabled: settings.tabGrouping, availability }),
    [settings.tabGrouping, availability]
);
```

### 8.2 State shape (write this)

```ts
type Phase = 'closed' | 'loading' | 'preview' | 'applying' | 'done' | 'error';

interface OrganizeState {
    phase: Phase;
    /** What the loading line says */
    loadingStep: 'reading' | 'downloading' | 'thinking';
    downloadProgress: number | null;
    windowId: number | null;
    /** All organizable tabs read at start, by id (for rendering rows) */
    tabsById: Record<number, OrganizableTab>;
    /** Tabs the model considered (AI path), kept for "Try again" */
    considered: OrganizableTab[];
    proposal: GroupProposal | null;
    dirty: boolean;
    collapseAfter: boolean;
    created: CreatedGroup[];
    skippedTabIds: number[];
    savedBoardId: string | null;
    error: unknown;

    // environment (see §8.1)
    aiEnabled: boolean;
    availability: ModelAvailability;

    // non-serializable handles
    session: Promise<AiSession> | null;
    abort: AbortController | null;

    actions: {
        setEnvironment(env: { aiEnabled: boolean; availability: ModelAvailability }): void;
        startOrganize(): void; // call from a click; see §8.3
        retryWithAi(): void; // click: Try again / Try with AI
        useSiteGrouping(): void;
        cancel(): void;
        // preview edits (each sets dirty = true)
        toggleGroup(key: string): void;
        renameGroup(key: string, name: string): void;
        cycleColor(key: string): void;
        removeTab(key: string, tabId: number): void;
        setCollapseAfter(value: boolean): void;
        // results
        apply(): Promise<void>;
        undo(): Promise<void>;
        saveAsBoard(): Promise<void>;
        close(): void;
    };
}

export const useOrganizeStore = create<OrganizeState>(…);
export const useOrganizeActions = () => useOrganizeStore(s => s.actions);
/** Convenience for non-React callers (command palette) */
export const startOrganize = () => useOrganizeStore.getState().actions.startOrganize();
```

### 8.3 `startOrganize()`: exact sequence

```
if phase !== 'closed' → return                       // double click
useAi ← aiEnabled && availability ∈ {available, downloadable, downloading}
abort ← new AbortController()
session ← useAi ? createSession(ORGANIZE_SYSTEM_PROMPT, p => set({downloadProgress: p, loadingStep: 'downloading'})) : null
session?.catch(() => undefined)                      // handled where awaited
set({ phase: 'loading', loadingStep: 'reading', session, abort, …reset fields })
(async () => {
    windowId ← await currentWindowId()
    tabs ← await getOrganizableTabs(windowId)
    if abort.signal.aborted → return
    if tabs.length < MIN_TABS_TO_ORGANIZE → showToast(…); close(); return
    set({ windowId, tabsById })
    if !useAi → set({ phase: 'preview', proposal: groupBySite(tabs) }); return
    set({ loadingStep: 'thinking', downloadProgress: null })
    proposal ← (§6.5 using await session)
    set({ phase: 'preview', proposal, considered })
})().catch(error => {
    if isAiError(error, 'aborted') → return
    set({ phase: 'error', error })
})
```

`showToast` comes from `useUIStore.getState().actions.showToast` (the store isn't a component).

`retryWithAi()` follows the same sequence, but reuses the `tabsById` already read (no `getOrganizableTabs`). It **must** also call `createSession` first and synchronously (it's a click). Destroy the previous session first.

`useSiteGrouping()`: destroy the session, `proposal = groupBySite(Object.values(tabsById) in tab order)`, `phase = 'preview'`, `dirty = false`.

`cancel()` / `close()`: `abort.abort()`, `session?.then(s => s.destroy()).catch(() => undefined)`, reset everything to initial and `phase = 'closed'`.

### 8.4 Preview edit rules

| Action        | Rule                                                                                                                                                                          |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `toggleGroup` | Flip `enabled`. Not allowed (no-op) when the group has < 2 tabs.                                                                                                              |
| `renameGroup` | Store the raw input (cut to `GROUP_NAME_MAX`). Trim only on apply.                                                                                                            |
| `cycleColor`  | Next colour in `GROUP_COLORS` after the current one, wrapping. Duplicates allowed (the user chose).                                                                           |
| `removeTab`   | Remove from the group's `tabIds`, append to `ungroupedTabIds` (keep tab-strip order by re-sorting with the original index). If the group now has < 2 tabs: `enabled = false`. |

### 8.5 `apply()`

1. `groups` = enabled groups with ≥ 2 tabs, mapped to `GroupToCreate` (`title = name.trim() || 'Group {i}'`).
2. `phase = 'applying'`.
3. `response = await chrome.runtime.sendMessage({ type: ORGANIZE_MESSAGES.APPLY, payload: { windowId, groups, collapsed: collapseAfter } })`.
4. If `!response` or `response.error` → toast `"Couldn't create groups: {message}"` (`error`), `phase = 'preview'`.
5. Else `created = response.created`, `skippedTabIds = response.skippedTabIds ?? []`, `phase = 'done'`. If `created.length === 0` → stay in `done` with the summary "No groups were created: the tabs closed or moved." and only a **Done** button.

### 8.6 `undo()`

Send `ORGANIZE_MESSAGES.UNDO` with `created.map(g => g.groupId)`. Toast "Removed {g} groups". `close()`.

## 9. Save as board: `src/features/organize/utils/saveAsBoard.ts`

### 9.1 Behaviour

```ts
export function saveGroupsAsBoard(
    created: CreatedGroup[],
    tabsById: Record<number, OrganizableTab>,
    store: Pick<BoardState, 'addBoard' | 'addFolder' | 'addTab'>, // BoardState from src/store/slices/board/types.ts
    now = new Date()
): { boardId: string; boardName: string };
```

1. `boardName` = `Organized tabs · ${now.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}` (e.g. "Organized tabs · 3 Oct").
2. `boardId = generateBoardId()`. `store.addBoard({ id: boardId, name: boardName })`.
3. For each created group, at index `i`: `folderId = generateFolderId()`. `store.addFolder({ id: folderId, name: group.title, boardId, color: FOLDER_HEX_FOR_GROUP_COLOR[group.color], order: i })`.
4. For each tab id in the group (skip ids missing from `tabsById`): `store.addTab({ id: generateTabId(), title, url, favicon, folderId, tabId: chromeTabId, lastAccessed: now.toISOString(), status: 'open' })`.

These store actions already persist to IndexedDB and send `ADD_BOARD` / `ADD_FOLDER` / `ADD_TAB`. The background `ADD_TAB` handler **only stores** the record (it does not open a browser tab, checked in `message-handler.ts`), so no tabs are duplicated.

Use the snapshot in `tabsById` (title/url at preview time). Don't re-query Chrome.

### 9.2 Board view check

Before finishing, open `/boards` and confirm the new board is visible and its folders show the tabs. If `BoardView` needs the board to be "selected", follow how `BoardModal` creates boards and do the same (and update this section).

## 10. Background: `src/background/organize-service.ts`

New file. Import it in `src/background/index.ts` **before** `./message-handler` (after `./context-service`).

### 10.1 Routing

In `message-handler.ts`, in the `default:` branch next to the existing context check:

```ts
if (ORGANIZE_MESSAGE_TYPES.includes(message.type)) {
    return handleOrganizeMessage(message, _sendResponse);
}
```

`handleOrganizeMessage` follows **the same structure as `handleContextMessage`**: an async `run()` with a `switch`, `run().then(sendResponse).catch(...)` with a try/catch around the error `sendResponse`, and `return true`.

```ts
export const ORGANIZE_MESSAGE_TYPES: string[] = Object.values(ORGANIZE_MESSAGES);
export function handleOrganizeMessage(
    message: ExtensionMessage,
    sendResponse: (r: ApplyGroupsResponse | UndoGroupsResponse) => void
): true;
```

### 10.2 `applyGroups(payload: ApplyGroupsPayload): Promise<ApplyGroupsResponse>`

For each group in order:

1. Load each tab with `chrome.tabs.get(id)`, catching errors (a closed tab throws → skipped).
2. Keep a tab only if **all** hold: `tab.windowId === payload.windowId`, `!tab.pinned`, `tab.groupId === -1`, URL capturable (`isCapturableUrl(tab.url || tab.pendingUrl, chrome.runtime.getURL(''))`), and **not used by an earlier group in this payload**.
3. Tabs that fail → `skippedTabIds`.
4. If fewer than `MIN_TABS_PER_GROUP` tabs remain → skip the group (its remaining tabs go to `skippedTabIds` too).
5. Otherwise:
    ```ts
    const groupId = await chrome.tabs.group({ tabIds: ids(kept), createProperties: { windowId: payload.windowId } });
    await chrome.tabGroups.update(groupId, {
        title: group.title.slice(0, GROUP_NAME_MAX),
        color: group.color,
        collapsed: payload.collapsed,
    });
    ```
    Validate `color` with `isTabGroupColor`; default to `'grey'` if invalid.
6. Push `{ groupId, title, color, tabIds: kept }` to `created`.
7. If `chrome.tabs.group` throws (e.g. the window closed), stop processing **this** group, add its tabs to `skippedTabIds`, and continue with the next.

Return `{ success: true, created, skippedTabIds }`.

**Why re-check in the background:** seconds or minutes pass between preview and apply. Tabs may close, move, get pinned, or join the active task's group (Park & Resume auto-add). The `groupId === -1` check guarantees **we never pull a tab out of the active task's group or any user group.**

### 10.3 `undoGroups(payload: UndoGroupsPayload): Promise<UndoGroupsResponse>`

For each `groupId`: `chrome.tabGroups.get(groupId)` (skip if it throws: already gone) → `chrome.tabs.query({ groupId })` → `chrome.tabs.ungroup(ids)` if any. Sum `ungroupedTabs`. Return `{ success: true, ungroupedTabs }`.

### 10.4 Interaction with Park & Resume (`context-service.ts`)

| Listener                                                     | Effect of our group operations                                      | OK?                   |
| ------------------------------------------------------------ | ------------------------------------------------------------------- | --------------------- |
| `tabs.onUpdated` (groupId change) → `scheduleSnapshot`       | Snapshots the **active task's** group only. Our tabs weren't in it. | Yes, no change needed |
| `tabs.onCreated` auto-add                                    | We create no tabs                                                   | Yes                   |
| `tabGroups.onRemoved` → auto-park if it was the active group | Undo removes only our groups                                        | Yes                   |

No change to `context-service.ts` in this spec. Unit test §13.3 #7 guards it.

## 11. Files to create or change (checklist)

| File                                                               | Action                                                                                                                                                         |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/utils/organizeTabs.ts`                                        | **New**, §5.1                                                                                                                                                  |
| `src/features/organize/types.ts`                                   | **New**, §5.2                                                                                                                                                  |
| `src/features/organize/utils/aiGrouping.ts`                        | **New**, §6                                                                                                                                                    |
| `src/features/organize/utils/siteGrouping.ts`                      | **New**, §7                                                                                                                                                    |
| `src/features/organize/utils/saveAsBoard.ts`                       | **New**, §9                                                                                                                                                    |
| `src/features/organize/store/organizeStore.ts`                     | **New**, §8                                                                                                                                                    |
| `src/features/organize/components/OrganizeTabsDialog.tsx` + `.css` | **New**, §4.2                                                                                                                                                  |
| `src/background/organize-service.ts`                               | **New**, §10                                                                                                                                                   |
| `src/background/index.ts`                                          | Import `./organize-service`                                                                                                                                    |
| `src/background/message-handler.ts`                                | Route `ORGANIZE_MESSAGE_TYPES`                                                                                                                                 |
| `src/App.tsx`                                                      | Mount `<OrganizeTabsDialog />` after `<ParkDialog />`                                                                                                          |
| `src/features/today/components/QuickActions.tsx` + `.css`          | 5th card, §4.1                                                                                                                                                 |
| `src/features/ui/components/CommandPalette.tsx`                    | Command, §4.1                                                                                                                                                  |
| `README.md`                                                        | Feature bullet: "✨ Organize tabs: one click groups your open tabs (on-device AI, or by site)". Also add it to the command palette list if the README has one. |
| `docs/ARCHITECTURE.md`                                             | Add `organize-service.ts` to the background services list and `features/organize` to the UI features                                                           |
| `ROADMAP.md`                                                       | Mark "AI-powered tab organization suggestions" as ✅ with a link to this spec                                                                                  |
| `docs/specs/AI_TAB_GROUPING.md`                                    | Set **Status** to "Implemented" and add an "Implementation notes" section with any deviations (like `PARK_AND_RESUME.md`)                                      |

**No `manifest.json` change. No IndexedDB change.**

## 12. Edge cases

| Case                                                                      | Behaviour                                                                                                                                                       |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fewer than 4 organizable tabs                                             | Toast (§4.3), no dialog                                                                                                                                         |
| Exactly 4 tabs, AI makes 1 group of 2                                     | Valid. Preview shows 1 group + 2 ungrouped                                                                                                                      |
| 150 tabs                                                                  | First `MAX_TABS_FOR_AI` (60) considered at most, fewer if the quota is smaller. Note shows how many were left out. Site path handles all 150                    |
| A tab is closed between preview and apply                                 | Skipped in background, shown in the done "skipped" note                                                                                                         |
| The user drags a previewed tab into another Chrome group before applying  | Background sees `groupId !== -1` → skipped                                                                                                                      |
| Park & Resume task becomes active, auto-adds a previewed tab to its group | Same → skipped. Task group untouched                                                                                                                            |
| User closes the window during apply                                       | `tabs.group` throws for remaining groups → their tabs skipped. Done phase lists what was created                                                                |
| Two TabPlex tabs both organize the same window                            | The second apply skips tabs the first already grouped (`groupId !== -1`)                                                                                        |
| Model download needed                                                     | Loading phase shows progress. Cancel closes the dialog; Chrome continues the download                                                                           |
| Model returns garbage twice                                               | Error phase, `bad-output` text, offers site grouping                                                                                                            |
| Duplicate URLs (two tabs, same page)                                      | Treated as two tabs. Both can be grouped (same group, normally)                                                                                                 |
| Tab titles in other languages                                             | Fine. The prompt is English, group names may come back in English                                                                                               |
| Incognito window focused                                                  | `getOrganizableTabs` filters incognito tabs → usually 0 → toast. TabPlex isn't enabled in incognito by default anyway                                           |
| User has AI turned off in Settings                                        | Site path directly. Preview footer shows **Try with AI** only if availability allows it. Clicking it uses AI just this once and does **not** change the setting |
| Undo after the user manually renamed/moved groups in Chrome               | Ungroups whatever tabs are in those group ids now. Acceptable                                                                                                   |

## 13. Tests

Follow the `write-tests` skill. Global setup installs the chrome mock (`src/test/chromeMock.ts`) and `fake-indexeddb`.

### 13.1 Pure functions

- `src/features/organize/utils/__tests__/aiGrouping.test.ts`: `buildOrganizeInput` (numbering from 1, uses `describeTabForAi`, no query strings, ends with "Group these N tabs."), `organizeSchema` (maximum equals tab count), and **every row N1–N13** of §6.4.
- `src/features/organize/utils/__tests__/siteGrouping.test.ts`: `siteKey` for each case in §7.1, and **every row S1–S7** of §7.2, plus the invariant (each tab id appears exactly once across groups/ungrouped).
- `src/features/organize/utils/__tests__/saveAsBoard.test.ts`: with `vi.fn()` store actions and a fixed `now`: board name format, one folder per group with the mapped hex colour and `order`, one tab per id with `status: 'open'` and the chrome id in `tabId`, missing ids skipped.

### 13.2 Store (`src/features/organize/store/__tests__/organizeStore.test.ts`)

Stub `LanguageModel` (see `aiSummary.test.ts` for the pattern) with `create` returning `{ prompt: vi.fn(), destroy: vi.fn(), inputQuota: 10_000, measureInputUsage: vi.fn(async (s: string) => s.length / 4) }`.

1. `startOrganize` with AI available calls `LanguageModel.create` **synchronously** (assert before awaiting anything).
2. Fewer than 4 tabs → toast text from §4.3, phase back to `closed`, session destroyed.
3. Happy AI path: 6 tabs in the mock, `prompt` resolves to the §6.3 JSON → phase `preview`, `source 'ai'`, 3 groups with chrome ids.
4. AI disabled (`aiEnabled: false`) → `create` not called, `source 'site'`.
5. Availability `unsupported` → site path.
6. `prompt` rejects twice with invalid JSON → phase `error`, `aiErrorMessage` is the bad-output text. `useSiteGrouping()` → preview with `source 'site'`.
7. `cancel()` during `thinking` → `abort` fired, `destroy` called, phase `closed`, no error phase afterwards.
8. Edits: `removeTab` moves the tab to ungrouped in tab order; group with 1 tab gets `enabled=false` and `toggleGroup` can't re-enable it; `cycleColor` wraps from `grey` to `blue`; edits set `dirty`.
9. `apply()` sends `TABS_APPLY_GROUPS` with only enabled groups ≥ 2 tabs, trimmed names, `Group {i}` for empty names, and `collapsed` flag. Use `respondToMessages` from the chrome mock to return a response.
10. `apply()` error response → toast + phase `preview`.
11. `undo()` sends `TABS_UNDO_GROUPS` with created ids, toast, phase `closed`.
12. `retryWithAi()` destroys the old session and creates a new one synchronously. With `dirty`, and `window.confirm` mocked to return false → no new session.

### 13.3 Background (`src/background/__tests__/organize-service.test.ts`)

Use the stateful chrome mock (tabs, groups and events are real in it).

1. Creates one Chrome group per payload group with title, colour and `collapsed` applied (`chrome.tabGroups.get`).
2. Skips a closed tab id, a pinned tab, a tab in another window, an already-grouped tab, a `chrome://` tab. All appear in `skippedTabIds`.
3. A group left with 1 valid tab is not created, and its tab is in `skippedTabIds`.
4. A tab id listed in two groups is only used by the first.
5. Invalid colour → `grey`. Title longer than 24 → cut.
6. `undoGroups` ungroups all tabs of the created groups, ignores unknown ids, returns the count.
7. **Park & Resume safety:** start a task context (reuse the setup in `src/background/__tests__/context-service.test.ts`), so its tabs are in the task's group. Then call `applyGroups` with those tab ids → all skipped, task group unchanged, task still `active`.
8. `handleOrganizeMessage` returns `true` and calls `sendResponse` once. Unknown type → `{ error }`.

### 13.4 Components (`src/features/organize/__tests__/OrganizeTabsDialog.test.tsx`)

Render `<OrganizeTabsDialog />` with the store set to each phase (call store actions or `useOrganizeStore.setState`):

1. Loading: shows the "Sorting {n} tabs" line; with progress shows "Downloading on-device AI model… 42%".
2. Preview: title "Organize 6 tabs", AI badge, group names in inputs, "Create 3 groups" enabled. Unchecking all → button "Create groups" disabled.
3. Removing tabs down to 1 shows "Needs at least 2 tabs" and disables the checkbox.
4. Omitted note appears only when `omittedTabIds` is non-empty.
5. Site source: badge "Grouped by site", **Try with AI** visible only when availability allows.
6. Done: summary pluralization ("1 group with 2 tabs" / "3 groups with 7 tabs"), skipped note, **Make a task** buttons (assert they call the task-from-tabs opener with the group's tab ids once that spec is implemented; until then, render them only if `openTaskFromTabs` exists).
7. `Esc` closes in preview; doesn't close while applying.
8. Accessibility: `getByRole('dialog', { name: /organize/i })`; colour button has the `aria-label` from §4.2.

Also extend `src/features/ui/__tests__/CommandPalette.test.tsx` to assert "Organize open tabs" is listed and calls `startOrganize`. Extend the Today/QuickActions coverage (QuickActions is rendered in `src/__tests__/App.test.tsx`; add a focused test in `src/features/today/__tests__/` if none exists) to assert the 5th card.

### 13.5 E2E (`e2e/organize-tabs.spec.ts`)

**Fixture change** (`e2e/fixtures.ts`): the route currently only serves `https://e2e.test/**`. Site grouping needs several sites. Change it to serve any `.test` host:

```ts
await context.route(/^https:\/\/[a-z0-9.-]+\.test\//, route => {
    /* same body as now */
});
```

Keep the `site(name)` helper as is and add `siteOn(host: string, path: string) => \`https://${host}/${path}\``. Run `park-resume.spec.ts` afterwards; it must still pass.

Tests:

1. **Site grouping (no AI):** open `news.test/a`, `news.test/b`, `shop.test/a`, `shop.test/b`, `blog.test/a`. Go to Today, click "Organize tabs". In headless Chromium `LanguageModel` is normally absent, so the site path runs. Expect badge "Grouped by site", groups `news.test` and `shop.test`, `blog.test/a` under Not grouped. Click **Create 2 groups**. Assert with `serviceWorker.evaluate` that two Chrome groups exist with those titles and 2 tabs each. Click **Undo** and assert no groups remain.
2. **Active task group is untouched:** seed a task (`seedTask`), add 2 pages, start it (existing Park & Resume flow), open 4 more pages on two hosts, organize, apply. Assert the task's group still has its tabs and the task is still `active` (`storedTask`).
3. **Save as board:** after creating groups, click **Save as board**, then **Open board**. Assert a board named "Organized tabs · …" exists and shows the folder names.
4. **AI path with a stubbed model:** add `await context.addInitScript(() => { (self as any).LanguageModel = { availability: async () => 'available', create: async () => ({ inputQuota: 100000, measureInputUsage: async (s: string) => s.length, prompt: async () => JSON.stringify({ groups: [{ name: 'Reading', color: 'green', tabs: [1, 2] }, { name: 'Shopping', color: 'red', tabs: [3, 4] }] }), destroy() {} }) }; })` **before** opening the app page. Expect the AI badge and the two names. **Check first** that init scripts run in `chrome-extension://` pages in this Playwright version. If they don't, mark this test `test.skip` with a comment explaining why; the store tests cover the AI path.

### 13.6 Manual acceptance (real Chrome, capable device)

| #   | Steps                                                                                   | Expected                                                                   |
| --- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| A1  | 20+ mixed tabs (2–3 projects), Organize                                                 | Preview in ≤ 15 s (first run may download the model first), sensible names |
| A2  | Rename, recolour, remove a tab, skip a group, Create                                    | Chrome shows exactly the edited groups                                     |
| A3  | Undo                                                                                    | All created groups gone, tabs in place                                     |
| A4  | Save as board                                                                           | Board with one folder per group, correct tabs                              |
| A5  | Active Park & Resume task during A1                                                     | Task group untouched, task still active, Park still works                  |
| A6  | Settings → turn "Organize tabs with AI" off, Organize                                   | Site grouping, instant                                                     |
| A7  | Device without built-in AI (or another browser)                                         | Site grouping, status text explains                                        |
| A8  | Pinned tabs and an existing manual group                                                | Untouched                                                                  |
| A9  | Dark and light theme, 1100 px and 700 px wide                                           | Dialog and quick-action card readable, no overflow                         |
| A10 | Keyboard only: open via palette (Ctrl+K), Tab through the preview, Enter on Create, Esc | All reachable, focus visible                                               |

## 14. Privacy

- Data sent to the model: tab title (clamped, 80 chars) + host + path. Never query strings or fragments. Never page content.
- The model runs on the device (Chrome built-in AI). No network call by TabPlex.
- The AI foundation spec's `PRIVACY.md` text already covers this feature. Check that it names "Organize tabs".

## 15. Delivery plan (commits)

| #   | Commit                                                         | Contents                                      | Exit check                                              |
| --- | -------------------------------------------------------------- | --------------------------------------------- | ------------------------------------------------------- |
| 1   | `feat(organize): add site and AI grouping logic`               | §5, §6, §7 and their unit tests               | Tests N1–N13 and S1–S7 pass                             |
| 2   | `feat(organize): create and undo tab groups in the background` | §10 + tests §13.3                             | Background tests pass, including Park & Resume safety   |
| 3   | `feat(organize): add organize tabs dialog and entry points`    | §4, §8, §9, §11 UI files + tests §13.2, §13.4 | Store/component tests pass, manual A1–A4 on a dev build |
| 4   | `test(e2e): cover organizing tabs`                             | §13.5 + fixture change                        | `npm run test:e2e` passes (all specs)                   |
| 5   | `docs: document organize tabs`                                 | README, ARCHITECTURE, ROADMAP, spec status    | —                                                       |

Run the `verify` skill before every commit (typecheck, zero-warning lint, prettier, unit tests with the 85% coverage gate, build, and E2E for commits 3–4). Reload the extension in `chrome://extensions` after background changes. Commits 2 and 4 touch `src/background/**`.

## 16. Future (not in v1)

- Drag a tab between suggested groups in the preview.
- "Merge into existing group" suggestions for new tabs (on-device, by similarity to group names).
- Close duplicate tabs as part of organizing.
- Keyboard shortcut (check `useKeyboardShortcuts.ts` and README for clashes first).
- Organize all windows.
- Remember the user's renames to improve future names (e.g. pass the last 10 group names as examples in the prompt).

## 17. Decisions (were open questions)

Decided by the product owner on 2026-10-03 (ROADMAP.md, decision D10). Organize tabs is in the **v1.0** milestone (D5).

1. Should **Save as board** also close the tabs (like parking)? Decided: no in v1. Closing is irreversible from the dialog.
2. Should group colours avoid red/yellow/blue, which Park & Resume uses for task priority? Decided: no; titles distinguish them.
3. Is "Organized tabs · 3 Oct" a good board name, or should the user type one? Decided: auto name, renameable in Boards as today.
