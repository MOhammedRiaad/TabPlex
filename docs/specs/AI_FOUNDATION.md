# Spec: On-device AI foundation (Prompt API)

|                   |                                                                                            |
| ----------------- | ------------------------------------------------------------------------------------------ |
| **Status**        | Ready to implement · milestone v1.0 (ROADMAP queue #6)                                     |
| **Owner**         | Mohamed                                                                                    |
| **Created**       | 2026-10-03                                                                                 |
| **Branch**        | `feature/ai-organize` (shared with the two specs below)                                    |
| **Used by**       | [AI_TAB_GROUPING.md](AI_TAB_GROUPING.md), [AI_TASK_FROM_TABS.md](AI_TASK_FROM_TABS.md)     |
| **Builds on**     | `src/features/tasks/utils/aiSummary.ts` (Summarizer API, Park & Resume §7)                 |
| **Do this first** | Both feature specs import from the files this spec creates. Implement and verify it alone. |

---

## 0. How to use this spec

- Work top to bottom. Each section names **exact files**, **exact exports** and **exact behaviour**.
- Code blocks marked **"write this"** are the intended implementation. Adjust only to satisfy the type checker or lint, and keep the exported names and signatures.
- Code blocks marked **"shape"** show the structure. Fill in the details.
- Finish with §9 (tests) and §10 (definition of done) before starting either feature spec.
- Chrome's built-in AI APIs change between Chrome versions. Before writing §4, open https://developer.chrome.com/docs/ai/prompt-api and check that the names in §3 still match. If they differ, follow the docs and update §3 of this file in the same commit.

## 1. Problem

TabPlex has one AI feature (on-device summaries of parked tasks) built directly on Chrome's **Summarizer API**. The next two features, AI tab grouping and drafting a task from tabs, need a general model that returns **structured JSON**. That is Chrome's **Prompt API** (`LanguageModel`).

Without a shared layer, each feature would repeat feature detection, the model download flow, the user-activation rule, JSON parsing, input size limits, timeouts and error messages. This spec builds that layer once.

## 2. Goals and non-goals

### Goals

1. One module that wraps the Prompt API: availability check, session creation (with download progress), JSON prompting with schema-constrained output, validation, timeout and abort.
2. One shared way to describe a browser tab to a model (title + host + path, never query strings). It is reused by the existing Summarizer code.
3. One shared way to read the "organizable" tabs of a window.
4. One settings object for AI features, plus a Settings section that shows the model status.
5. Every AI feature must still work, in a reduced form, when AI is unavailable. This layer reports availability clearly so features can fall back.

### Non-goals

- Cloud models, API keys, or any network call. **Nothing leaves the device.** This is a product promise (`PRIVACY.md`).
- Reading page content (needs scripting/host permissions and a new Web Store warning). Titles and URLs only.
- Running the model in the background service worker. All model calls run in the UI page (see §3.3).
- Streaming output (`promptStreaming`). Not needed for short JSON answers.

## 3. Background: Chrome's Prompt API (as of Chrome 138+)

### 3.1 Facts the implementation relies on

| Fact                                                                                                                                                    | Consequence for us                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Global `LanguageModel` exists only in Chrome 138+ desktop (Windows, macOS, Linux, ChromeOS on Chromebook Plus), and is available to **extension pages** | Feature-detect with `'LanguageModel' in self`. Mobile and other browsers: `unsupported`.                                                      |
| `LanguageModel.availability(options)` resolves to `'unavailable' \| 'downloadable' \| 'downloading' \| 'available'`                                     | Map to our `ModelAvailability` type, adding `'unsupported'` for "no API".                                                                     |
| `LanguageModel.create(options)` creates a session. If the model isn't downloaded, **creating starts the download**                                      | Pass a `monitor` to get `downloadprogress` events (`event.loaded` is 0..1).                                                                   |
| Starting a download **requires user activation** (a click or key press in the last few seconds)                                                         | Call `createSession()` **synchronously inside the click handler**, before any `await`. Same rule as `createSummarizer()` in `ParkDialog.tsx`. |
| `session.prompt(input, { responseConstraint, omitResponseConstraintInput, signal })` resolves to a string                                               | With `responseConstraint` (a JSON Schema), the string is JSON that matches the schema. We still validate it (§4.5).                           |
| `session.inputQuota` (number) and `session.measureInputUsage(input)` (Promise&lt;number&gt;)                                                            | Use these to make input fit (§4.6). Treat both as optional (older builds).                                                                    |
| `initialPrompts: [{ role: 'system', content }]` sets the system prompt                                                                                  | Each feature passes its own system prompt.                                                                                                    |
| `expectedInputs` / `expectedOutputs` declare languages, e.g. `[{ type: 'text', languages: ['en'] }]`                                                    | Pass English for both. Chrome may warn or refuse without them.                                                                                |
| `session.destroy()` frees memory                                                                                                                        | Always destroy in a `finally`.                                                                                                                |
| Hardware requirement: roughly 16 GB RAM or a GPU with more than 4 GB VRAM, about 22 GB free disk; the model download is about 2 GB or more              | Many users get `unavailable`. Features must have a non-AI path.                                                                               |

### 3.2 What we never assume

- That `responseConstraint` makes output valid. Always parse and validate.
- That `inputQuota` exists. If it doesn't, use a character budget (§4.6).
- That the model follows the system prompt exactly. Feature code normalizes the output (dedupe, clamp lengths, drop unknown ids).

### 3.3 Why the UI page, not the service worker

- User activation (needed for the download) only exists in a page.
- The Summarizer code already runs in the UI, so one pattern for all AI code.
- A model call can take 5–30 s, and service workers can be shut down when idle.
- Tab and group **changes** that come from an AI result still run in the background service worker (TabPlex rule: "Chrome tab and tab-group operations must run in the background").

## 4. New module: `src/features/ai/`

Create this folder structure (feature-first, like the other features):

```
src/features/ai/
  types.ts                     ModelAvailability, AiErrorCode, AiError, AiSettings, OrganizableTab
  constants.ts                 AI_SETTINGS_KEY, DEFAULT_AI_SETTINGS, limits
  utils/promptApi.ts           wrapper around LanguageModel (availability, createSession, promptJson)
  utils/tabText.ts             describeTabForAi(), shared by every AI feature (and aiSummary.ts)
  utils/collectTabs.ts         getOrganizableTabs(windowId)
  hooks/useModelAvailability.ts
  hooks/useAiSettings.ts
  components/ModelStatus.tsx   one line of status text + optional download progress
  components/AiFeaturesSetting.tsx   Settings section rows
  utils/__tests__/promptApi.test.ts
  utils/__tests__/tabText.test.ts
  utils/__tests__/collectTabs.test.ts
  __tests__/aiSettings.test.tsx
```

**None of these files may be imported by `src/background/**`.** They use `self.LanguageModel`and React. The background only needs the message types defined in the feature specs, which go in`src/utils/` (DOM-free, shared).

### 4.1 `types.ts`

**Write this:**

```ts
/** Chrome's availability values, plus 'unsupported' when the browser has no Prompt API at all */
export type ModelAvailability = 'unsupported' | 'unavailable' | 'downloadable' | 'downloading' | 'available';

export type AiErrorCode =
    | 'unsupported' // no LanguageModel global
    | 'unavailable' // device can't run the model
    | 'download-failed' // create() rejected while downloading
    | 'too-large' // input could not be made to fit the quota
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
```

### 4.2 `constants.ts`

**Write this:**

```ts
import { AiSettings } from './types';

export const AI_SETTINGS_KEY = 'tabplex_ai_settings';

export const DEFAULT_AI_SETTINGS: AiSettings = {
    tabGrouping: true,
    taskDrafts: true,
};

/** Longest a single model call may take before we give up */
export const AI_TIMEOUT_MS = 45_000;

/** Used when the session doesn't expose inputQuota/measureInputUsage */
export const AI_FALLBACK_CHAR_BUDGET = 6_000;

/** A tab title longer than this is cut (titles are the bulk of every prompt) */
export const AI_MAX_TITLE_CHARS = 80;
```

Defaults are `true` because both features only run when the user clicks, and both always show a preview the user must confirm. Nothing happens to tabs without that confirmation.

### 4.3 `utils/tabText.ts`

Move the private `describeTab` logic out of `src/features/tasks/utils/aiSummary.ts` into this shared helper, and make `aiSummary.ts` import it. Keep the exact output format, because `aiSummary.test.ts` asserts `- Stripe pricing (stripe.com/pricing)`.

**Write this:**

```ts
import { AI_MAX_TITLE_CHARS } from '../constants';

/** "stripe.com/pricing": host without www + path, never the query string or fragment (they can hold tokens) */
export function shortUrlForAi(rawUrl: string): string {
    try {
        const url = new URL(rawUrl);
        const host = url.hostname.replace(/^www\./, '');
        return `${host}${url.pathname === '/' ? '' : url.pathname}`;
    } catch {
        return rawUrl;
    }
}

export function clampTitle(title: string, max = AI_MAX_TITLE_CHARS): string {
    const clean = title.replace(/\s+/g, ' ').trim();
    return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

/** "Stripe pricing (stripe.com/pricing)" — the one way every AI feature describes a tab */
export function describeTabForAi(tab: { title: string; url: string }): string {
    return `${clampTitle(tab.title || tab.url)} (${shortUrlForAi(tab.url)})`;
}
```

Then in `aiSummary.ts`:

- Delete the local `describeTab` function.
- `import { describeTabForAi } from '../../ai/utils/tabText';`
- Replace `tabs.map(describeTab)` with `tabs.map(tab => \`- ${describeTabForAi(tab)}\`)`.
- Run `aiSummary.test.ts`. It must pass unchanged. Note: titles now get clamped to 80 characters and whitespace-collapsed. If a test breaks only because of that, update the test, not the helper.

### 4.4 `utils/collectTabs.ts`

Both features start from "the tabs in this window that we are allowed to touch".

**Rules (all must hold for a tab to be included):**

| Rule                                                                                                      | Why                                                                                                   |
| --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `tab.id !== undefined`                                                                                    | Needed to act on it                                                                                   |
| `tab.windowId === windowId`                                                                               | One window at a time                                                                                  |
| `!tab.pinned`                                                                                             | Pinned tabs are deliberate. Never move them.                                                          |
| `tab.groupId === -1` (`chrome.tabGroups.TAB_GROUP_ID_NONE`)                                               | **Never touch a group the user (or Park & Resume) made.** This also protects the active task's group. |
| `isCapturableUrl(tab.url \|\| tab.pendingUrl, chrome.runtime.getURL(''))` from `src/utils/taskContext.ts` | Only http/https/file/ftp. Excludes TabPlex itself, `chrome://` and new-tab pages.                     |
| `!tab.incognito`                                                                                          | Never read incognito tabs.                                                                            |

**Write this:**

```ts
import { isCapturableUrl } from '../../../utils/taskContext';
import { OrganizableTab } from '../types';

const NO_GROUP = -1;

/** Ungrouped, unpinned web tabs in one window, in tab-strip order */
export async function getOrganizableTabs(windowId: number): Promise<OrganizableTab[]> {
    const base = chrome.runtime.getURL('');
    const tabs = await chrome.tabs.query({ windowId });
    return tabs
        .filter(tab => tab.id !== undefined && !tab.pinned && !tab.incognito)
        .filter(tab => (tab.groupId ?? NO_GROUP) === NO_GROUP)
        .flatMap(tab => {
            const url = tab.url || tab.pendingUrl;
            if (!isCapturableUrl(url, base)) return [];
            return [
                {
                    id: tab.id as number,
                    windowId: tab.windowId,
                    title: tab.title || url,
                    url,
                    favicon: tab.favIconUrl || undefined,
                },
            ];
        });
}

export async function currentWindowId(): Promise<number | undefined> {
    try {
        return (await chrome.windows.getCurrent()).id;
    } catch {
        return undefined;
    }
}
```

`useTaskContextActions.ts` has a private `currentWindowId()` with the same body. Replace it with an import from here (one source of truth).

Duplicate URLs are **kept**: two tabs with the same URL are two tabs, and both should be grouped. Feature code decides what to do with duplicates.

### 4.5 `utils/promptApi.ts`

This is the core of the spec.

**Exports:**

| Export                 | Signature                                                                                                                           | Behaviour                                                                                                                                                                                      |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `getModelAvailability` | `() => Promise<ModelAvailability>`                                                                                                  | `'unsupported'` if no global. Otherwise `LanguageModel.availability(BASE_OPTIONS)`. Any throw → `'unavailable'`. Never rejects.                                                                |
| `createSession`        | `(systemPrompt: string, onDownloadProgress?: (fraction: number) => void) => Promise<AiSession>`                                     | **Must be called synchronously in a user gesture.** Rejects with `AiError('unsupported')` if there is no global. Wraps `create()` rejections as `AiError('download-failed' or 'unavailable')`. |
| `promptJson`           | `<T>(session: AiSession, input: string, options: PromptJsonOptions<T>) => Promise<T>`                                               | See algorithm below.                                                                                                                                                                           |
| `fitInput`             | `<I>(session: AiSession, items: I[], build: (items: I[]) => string, minItems?: number) => Promise<{ input: string; used: number }>` | Drops items from the end until the prompt fits (§4.6).                                                                                                                                         |
| `isAiError`            | `(e: unknown, code?: AiErrorCode) => e is AiError`                                                                                  | Type guard used by feature UIs.                                                                                                                                                                |
| `aiErrorMessage`       | `(e: unknown) => string`                                                                                                            | User-facing text for any error (table in §4.7).                                                                                                                                                |

**Write this (types and wrapper):**

```ts
import { AI_FALLBACK_CHAR_BUDGET, AI_TIMEOUT_MS } from '../constants';
import { AiError, AiErrorCode, ModelAvailability } from '../types';

type ChromeAvailability = Exclude<ModelAvailability, 'unsupported'>;

interface PromptOptions {
    responseConstraint?: object;
    omitResponseConstraintInput?: boolean;
    signal?: AbortSignal;
}

/** The subset of a LanguageModel session we use */
export interface AiSession {
    prompt(input: string, options?: PromptOptions): Promise<string>;
    measureInputUsage?(input: string, options?: PromptOptions): Promise<number>;
    readonly inputQuota?: number;
    destroy(): void;
}

interface LanguageModelCreateOptions {
    initialPrompts?: { role: 'system' | 'user' | 'assistant'; content: string }[];
    expectedInputs?: { type: 'text'; languages: string[] }[];
    expectedOutputs?: { type: 'text'; languages: string[] }[];
    monitor?: (monitor: EventTarget) => void;
}

interface LanguageModelStatic {
    availability(options?: Omit<LanguageModelCreateOptions, 'monitor' | 'initialPrompts'>): Promise<ChromeAvailability>;
    create(options?: LanguageModelCreateOptions): Promise<AiSession>;
}

const BASE_OPTIONS = {
    expectedInputs: [{ type: 'text' as const, languages: ['en'] }],
    expectedOutputs: [{ type: 'text' as const, languages: ['en'] }],
};

function getApi(): LanguageModelStatic | null {
    return (self as unknown as { LanguageModel?: LanguageModelStatic }).LanguageModel ?? null;
}
```

**`createSession`: write this.** Note there is no `async` and no `await` before `api.create`:

```ts
export function createSession(
    systemPrompt: string,
    onDownloadProgress?: (fraction: number) => void
): Promise<AiSession> {
    const api = getApi();
    if (!api) return Promise.reject(new AiError('unsupported', 'This browser has no built-in AI'));
    return api
        .create({
            ...BASE_OPTIONS,
            initialPrompts: [{ role: 'system', content: systemPrompt }],
            monitor: monitor => {
                monitor.addEventListener('downloadprogress', event => {
                    onDownloadProgress?.((event as ProgressEvent).loaded);
                });
            },
        })
        .catch((error: unknown) => {
            throw new AiError(
                'download-failed',
                error instanceof Error ? error.message : 'Chrome could not start the on-device model'
            );
        });
}
```

**`promptJson`: algorithm (write it to do exactly this):**

```ts
export interface PromptJsonOptions<T> {
    /** JSON Schema passed to the model as responseConstraint */
    schema: object;
    /** Returns the cleaned value, or null if the parsed JSON is unusable */
    validate: (raw: unknown) => T | null;
    signal?: AbortSignal;
    timeoutMs?: number; // default AI_TIMEOUT_MS
}
```

1. If `signal?.aborted` → throw `AiError('aborted')`.
2. Create an internal `AbortController`. Abort it when the caller's `signal` aborts, or when `timeoutMs` passes. Remember which one happened.
3. **Attempt 1:** `raw = await session.prompt(input, { responseConstraint: schema, omitResponseConstraintInput: true, signal: internal.signal })`.
4. Parse: `JSON.parse(stripFences(raw))`, where `stripFences` removes a leading ` ```json ` / ` ``` ` line and a trailing ` ``` ` line (small models sometimes add them even with a constraint).
5. `value = validate(parsed)`. If it isn't `null`, return it.
6. **Attempt 2 (once):** if parsing threw or `validate` returned `null`, prompt again with
   `input + '\n\nYour previous answer was not valid. Reply with JSON that matches the schema exactly.'`
   Same parse and validate. If it still fails → throw `AiError('bad-output', 'The on-device model returned an answer TabPlex could not use')`.
7. If `prompt` rejects:
    - caused by our timeout → `AiError('timeout')`
    - caused by the caller's signal → `AiError('aborted')`
    - error `name === 'QuotaExceededError'` → `AiError('too-large')`
    - anything else → rethrow as `AiError('bad-output', error.message)`
8. Always clear the timer (`finally`).

`promptJson` **does not destroy** the session. The caller owns it (a feature may call it twice, e.g. "Try again").

### 4.6 Fitting input into the quota: `fitInput`

Prompts are a list of tabs. Too many tabs → quota error. `fitInput` trims the list **from the end** until it fits.

Decision: **keep the first N tabs in tab-strip order** and drop the rest (the rightmost tabs). Reason: it's predictable, and the dialog can say exactly which tabs were left out ("12 tabs on the right weren't included").

**Algorithm:**

```
budget = session.inputQuota (if it's a number > 0) else null
lo = minItems (default 1), hi = items.length
if fits(hi) → return all
binary search the largest n in [lo, hi] where fits(n)
if !fits(lo) → throw AiError('too-large')
return { input: build(items.slice(0, n)), used: n }

fits(n):
    text = build(items.slice(0, n))
    if budget and session.measureInputUsage:
        return (await session.measureInputUsage(text)) <= budget * 0.9   // keep 10% headroom for the system prompt and answer
    else:
        return text.length <= AI_FALLBACK_CHAR_BUDGET
```

Binary search keeps it to about 6 `measureInputUsage` calls for 60 tabs.

### 4.7 Error messages (`aiErrorMessage`)

| Code              | Text shown to the user                                                     |
| ----------------- | -------------------------------------------------------------------------- |
| `unsupported`     | "This browser doesn't have Chrome's built-in AI (Chrome 138+ on desktop)." |
| `unavailable`     | "This device doesn't meet Chrome's requirements for built-in AI."          |
| `download-failed` | "Chrome couldn't download the on-device AI model. Try again later."        |
| `too-large`       | "Too many tabs for the on-device model. Close a few and try again."        |
| `bad-output`      | "The on-device AI gave an answer TabPlex couldn't use. Try again."         |
| `timeout`         | "The on-device AI took too long. Try again."                               |
| `aborted`         | "" (empty string: the UI shows nothing when the user cancelled)            |
| not an `AiError`  | `error instanceof Error ? error.message : String(error)`                   |

### 4.8 `hooks/useModelAvailability.ts`

**Shape:**

```ts
export function useModelAvailability(): {
    availability: ModelAvailability;
    /** true while the first check is running */
    checking: boolean;
    refresh: () => void;
};
```

- Calls `getModelAvailability()` on mount, and on `refresh()`.
- Re-checks automatically when `window` regains focus (the user may have finished a download in another tab). Remove the listener on unmount.
- Ignores results after unmount (a `cancelled` flag, like `useParkResumeSettings`).

### 4.9 `hooks/useAiSettings.ts`

Copy the pattern of `src/features/tasks/hooks/useParkResumeSettings.ts` exactly: `readAiSettings()` (outside React), and `useAiSettings()` returning `{ settings, updateSettings }`. Listen to `chrome.storage.onChanged` for `AI_SETTINGS_KEY`. Merge stored values over `DEFAULT_AI_SETTINGS`.

Why `chrome.storage.local` and not `localStorage`: consistency with the Park & Resume settings, and changes reach every open TabPlex tab through `onChanged`.

### 4.10 `components/ModelStatus.tsx`

One line of status, used in Settings and in both feature dialogs.

```ts
interface ModelStatusProps {
    availability: ModelAvailability;
    /** 0..1 while Chrome downloads the model, otherwise null */
    progress?: number | null;
    className?: string;
}
```

| `availability` (progress null) | Text                                                                                                |
| ------------------------------ | --------------------------------------------------------------------------------------------------- |
| `available`                    | "On-device AI ready."                                                                               |
| `downloadable`                 | "On-device AI needs a one-time download by Chrome (a few GB). It starts the first time you use it." |
| `downloading`                  | "Chrome is downloading the on-device AI model…"                                                     |
| `unavailable`                  | "This device can't run Chrome's built-in AI. TabPlex will use simpler rules instead."               |
| `unsupported`                  | "This browser doesn't have Chrome's built-in AI. TabPlex will use simpler rules instead."           |

When `progress !== null`: "Downloading on-device AI model… 42%".

Render a `<p className={\`ai-model-status ${className ?? ''}\`} role="status">`. Add a small `ModelStatus.css` next to it: muted colour (`var(--color-text-secondary)`), `font-size: 0.85rem`.

The existing `AiSummarySetting.tsx` has its own `STATUS_TEXT` for the Summarizer. **Leave it alone in this spec**: Summarizer and Prompt API availability are separate checks and can differ.

### 4.11 `components/AiFeaturesSetting.tsx` and the Settings view

Add a new section to `src/features/settings/SettingsView.tsx`, **directly after** the "Park & Resume" section (line ~217) and before the appearance section. Same markup as the other sections:

```
✨ On-device AI
  [ModelStatus line]
  Organize tabs with AI                                   [x]
    Suggest tab groups by what you're working on. Without AI, tabs are grouped by site.
  Draft tasks from tabs                                   [x]
    Pre-fill the title, priority and steps of a new task from its tabs.
  Your tabs' titles and addresses are processed on this computer by Chrome's built-in AI. Nothing is sent to TabPlex or anyone else.
```

- The two checkboxes stay **enabled even when the model is unavailable** (the features still work without AI; the setting means "use AI when you can"). Show the status line so the user understands.
- `aria-label` on each checkbox equals its visible title.
- Use the existing classes `setting-item`, `setting-info`, `setting-control`, `setting-checkbox`, `setting-status`.

## 5. Data and storage

| Key                   | Where                  | Shape        | Default               |
| --------------------- | ---------------------- | ------------ | --------------------- |
| `tabplex_ai_settings` | `chrome.storage.local` | `AiSettings` | `DEFAULT_AI_SETTINGS` |

- No IndexedDB change and no `DB_VERSION` bump.
- **Export/import:** settings are not part of `exportImport.ts` today (Park & Resume settings aren't either). Don't add them.

## 6. Privacy and documentation (same PR)

1. `PRIVACY.md`: under the section that describes the on-device summary, add:
    > **On-device AI features (optional).** "Organize tabs" and "New task from tabs" can use Chrome's built-in AI model (Gemini Nano), which runs on your computer. TabPlex sends it the titles and addresses (without query strings) of the tabs you choose. The model's answer stays in your browser. No tab data is sent to TabPlex or any server. Turn these features off in Settings → On-device AI.
2. `README.md` features list: one bullet, "✨ On-device AI: organize tabs into groups and draft tasks from your tabs. Runs locally with Chrome's built-in AI."
3. **No new permissions.** `tabs`, `tabGroups` and `storage` are already in `manifest.json`. Confirm that `git diff manifest.json` is empty for this spec.

## 7. Edge cases

| Case                                                              | Behaviour                                                                                                                                                                                                   |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `LanguageModel` missing (Firefox, older Chrome, mobile)           | `availability = 'unsupported'`. Features use their non-AI path. No errors in the console.                                                                                                                   |
| Availability `downloadable` and the user clicks a feature         | `createSession` starts the download in the click. Dialog shows `ModelStatus` with progress. The user can cancel; cancelling aborts our wait, but Chrome keeps downloading in the background, which is fine. |
| `create()` called without user activation (e.g. after an `await`) | Chrome rejects with a `NotAllowedError`. **Bug in the caller.** The unit test in §9 enforces "create before any await".                                                                                     |
| Model answers in a language other than English                    | `expectedOutputs` asks for English. Validation only checks structure, so a non-English group name is accepted.                                                                                              |
| Two TabPlex tabs run a feature at once                            | Each has its own session. No shared state.                                                                                                                                                                  |
| User closes the TabPlex tab during a prompt                       | The page is gone, so the session is gone. Nothing was applied, so there's nothing to clean up.                                                                                                              |
| Session creation succeeds but `prompt` hangs                      | The `AI_TIMEOUT_MS` timeout aborts it → `AiError('timeout')`.                                                                                                                                               |

## 8. Implementation order (commits)

1. `refactor(ai): share tab description helper with the summarizer` covers §4.3 plus the `currentWindowId` dedupe in §4.4.
2. `feat(ai): add Prompt API wrapper with JSON validation and quota fitting` covers §4.1, §4.2, §4.4, §4.5, §4.6, §4.7 and their tests.
3. `feat(settings): add on-device AI section` covers §4.8–§4.11, §6 and tests.

Run the `verify` skill before each commit. Use the `commit` skill for the message.

## 9. Tests (Vitest, `src/features/ai/**/__tests__`)

The global test setup installs the chrome mock (`src/test/setup.ts`). Stub the model with `vi.stubGlobal('LanguageModel', {...})` and clean up with `vi.unstubAllGlobals()` in `afterEach`, exactly like `aiSummary.test.ts` does with `Summarizer`.

### 9.1 `promptApi.test.ts`: required cases

1. `getModelAvailability` returns `'unsupported'` with no global.
2. It passes through `'available'` / `'downloadable'` / `'downloading'` / `'unavailable'`, and returns `'unavailable'` when `availability()` rejects.
3. It calls `availability` with `expectedInputs`/`expectedOutputs` and **without** `monitor` or `initialPrompts`.
4. `createSession` rejects with `AiError` code `unsupported` with no global.
5. `createSession` passes the system prompt as `initialPrompts[0]` with role `system`.
6. `createSession` reports download progress (dispatch a `downloadprogress` event with `loaded = 0.5` on the monitor target → callback receives `0.5`).
7. **User activation rule:** `createSession` calls `LanguageModel.create` **synchronously**. Test: call `createSession(...)` and, without awaiting, `expect(create).toHaveBeenCalledTimes(1)`.
8. `createSession` maps a `create()` rejection to `AiError` code `download-failed`.
9. `promptJson` returns the validated value on the first valid answer; `prompt` called once with `responseConstraint` equal to the schema and `omitResponseConstraintInput: true`.
10. `promptJson` strips code fences (` ```json\n{...}\n``` `).
11. `promptJson` retries once on invalid JSON, then succeeds (`prompt` called twice; second input ends with the retry sentence).
12. `promptJson` retries once when `validate` returns `null`, then throws `bad-output` if the second answer is also invalid.
13. `promptJson` throws `timeout` when `prompt` never resolves (`vi.useFakeTimers()`, advance `AI_TIMEOUT_MS`). Restore real timers afterwards.
14. `promptJson` throws `aborted` when the caller's signal aborts, and immediately if the signal is already aborted (`prompt` not called).
15. `promptJson` maps `DOMException` with name `QuotaExceededError` to `too-large`.
16. `fitInput` returns everything when it fits; trims to the largest fitting prefix using `measureInputUsage` + `inputQuota`; falls back to `AI_FALLBACK_CHAR_BUDGET` when those are missing; throws `too-large` when even `minItems` doesn't fit.
17. `aiErrorMessage` returns the table text for every code, `''` for `aborted`, and `message` for a plain `Error`.

### 9.2 `tabText.test.ts`

- `shortUrlForAi`: strips `www.`, query and hash; keeps the path; returns `host` alone for `/`; returns the raw string for an invalid URL.
- `clampTitle`: collapses whitespace; cuts at 80 with `…` (result length exactly 80); leaves short titles unchanged.
- `describeTabForAi`: falls back to the URL when the title is empty.

### 9.3 `collectTabs.test.ts`

Use `fakeChrome()` from `src/test/chromeMock.ts` to create tabs (`chrome.tabs.create({ url })`), a pinned tab (`pinned: true`), a grouped tab (`chrome.tabs.group`), a `chrome://newtab/` tab and a TabPlex tab (`chrome-extension://test-extension-id/index.html`). Assert that only the ungrouped, unpinned web tabs come back, in order, with `title` falling back to the URL.

### 9.4 `aiSettings.test.tsx`

- `readAiSettings()` returns defaults when storage is empty and merges partial stored values.
- Rendering `SettingsView` shows the "On-device AI" section. Toggling "Organize tabs with AI" writes `{ tabGrouping: false, taskDrafts: true }` to `chrome.storage.local`.
- With `LanguageModel` unstubbed, the status line shows the "unsupported" text and the checkboxes are still enabled.

### 9.5 Coverage

The repo gate is **85%** for statements/branches/functions/lines (`vitest.config.ts`). New files must be at or above it. Run `npm run test:coverage`.

## 10. Definition of done

- [ ] `npx tsc --noEmit`, `npm run lint` (zero warnings), `npm run format:check`, `npm run test:coverage` (≥ 85%), `npm run build` all pass.
- [ ] `npm run test:e2e` still passes (no behaviour change for existing features). If Playwright's bundled Chromium crashes on launch, set `PW_CHROMIUM_PATH` to another Chromium build (`e2e/fixtures.ts` supports it).
- [ ] `aiSummary.test.ts` passes, and the Park dialog summary still works in a real browser on a capable device.
- [ ] Settings shows the new section. The status text is correct on (a) a browser without the API, (b) a capable device.
- [ ] `manifest.json` unchanged. `PRIVACY.md` and README updated.
- [ ] No file in `src/background/**` imports from `src/features/ai/**` (check: `grep -rn "features/ai" src/background` returns nothing).
