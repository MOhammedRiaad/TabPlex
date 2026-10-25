# Spec: Security and reliability hardening

|             |                                                                                                                                                |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**  | Implemented: S1–S5, B1, B2, B3 (timeouts), B4 (listeners, broadcasts). Not done: `respondWith` helper, import summary dialog, `ADD_BOARD` race |
| **Owner**   | Mohamed                                                                                                                                        |
| **Created** | 2026-10-25                                                                                                                                     |
| **Branch**  | one `feature/<name>` per phase (see §9), merged into `develop`                                                                                 |
| **Source**  | Code review and security analysis of the extension, 2026-10-25                                                                                 |

---

## 1. Problem

A review of the extension found no remote-code path (no `externally_connectable`, no content scripts, no `eval`, no network `fetch`), but it did find a handful of exposure, data-integrity and reliability defects:

| ID  | Finding                                                                                                | Severity | Where                                                   |
| --- | ------------------------------------------------------------------------------------------------------ | -------- | ------------------------------------------------------- |
| B1  | Onboarding "Get started" sends `OPEN_TABBOARD`, which nothing handles; the page closes itself          | High     | `onboarding.js:42`, `message-handler.ts` default branch |
| S1  | `index.html` and assets are web-accessible to every site (clickjacking, extension fingerprinting)      | Medium   | `manifest.json:37-41`                                   |
| S2  | Import is unvalidated and wipes data before writing the new data                                       | Medium   | `exportImport.ts:186-233`, `data-service.ts:80-120`     |
| B2  | Daily cleanup uses `setInterval` in an MV3 worker, so it never runs; every page load is stored forever | Medium   | `cleanup-service.ts`, `tab-service.ts:17`               |
| B3  | Handlers reply `{success: true}` after 1 s even if the write has not finished                          | Medium   | `message-handler.ts`, `*-service.ts`                    |
| S3  | Markdown link rendering runs after other substitutions, so `href` can contain generated HTML           | Low      | `utils/markdown.ts:12-18`                               |
| S4  | 8 production dependency advisories (6 high): `react-router`, `prosemirror-view`, `markdown-it`         | Low      | `package.json`                                          |
| S5  | Every message is logged with its payload; no guard for malformed messages                              | Low      | `message-handler.ts:30,33`                              |
| B4  | Smaller defects (listed in §8)                                                                         | Low      | various                                                 |

## 2. Goals

1. First-run onboarding works.
2. No web page can embed the app or detect that it is installed.
3. An import either fully succeeds or leaves existing data untouched, and rejects malformed or unsafe data.
4. Storage cannot grow without bound from automatic tab tracking, and the cleanup actually runs.
5. The UI is told the truth about whether a write succeeded.
6. Link rendering cannot emit attacker-influenced attribute structure.
7. Production dependencies have no known high-severity advisories.

### Non-goals

- A rewrite of the storage layer, or moving the background to IndexedDB.
- Encrypting data at rest (the threat model is local-first; browser profile access is out of scope).
- Changing what the on-device AI features do.

## 3. Design

### 3.1 B1: onboarding "Get started"

The service worker already opens `index.html` on toolbar click (`background-init.ts:30-53`). Extract that body into an exported `openApp()` and reuse it.

- Add `case 'OPEN_TABBOARD'` to `message-handler.ts`, calling `openApp()` and replying `{ success: true }` / `{ error }`. Add it to the `ExtensionMessage` type union.
- `onboarding.js`: treat a response with `error` like `lastError` (fall back to `window.location.href = chrome.runtime.getURL('index.html')`), and only close the tab after a success response.
- Also remove the dead second fallback branch (`chrome.runtime` undefined, then `chrome.runtime.getURL`), which would throw.

**Accept:** clicking Get started opens or focuses `index.html` and closes onboarding; with the worker returning an error, it navigates to `index.html` in place.

### 3.2 S1: web-accessible resources

Nothing in the repo needs a web page to load these. Onboarding and the app are opened by the extension itself.

- Remove the `web_accessible_resources` block from `manifest.json`. Build, load unpacked, and verify: onboarding opens, the app opens, favicons (`/_favicon/` is served by the browser and does not need a WAR entry) and notifications icons still load.
- If something does break, add back **only** the specific files, with `matches` limited to the narrowest origins, never `index.html`.
- Per CLAUDE.md, a `manifest.json` change needs an extension reload; no new permission is involved.

**Accept:** `fetch('chrome-extension://<id>/index.html')` and an `<iframe>` of it from `https://e2e.test/` both fail; E2E covers it.

### 3.3 S2: safe import

New module `src/utils/importValidation.ts` (no DOM/React, so it may be shared with the background):

```ts
export function validateExport(raw: unknown): { ok: true; data: ValidatedExport } | { ok: false; errors: string[] };
```

Rules:

- Top-level: object, `version` is `1.0.0` or `2.0.0`, `data` is an object. Reject files larger than a cap (default 20 MB) before `JSON.parse`.
- Each collection (`boards, folders, tabs, tasks, notes, sessions, history, canvases`) is an array (missing means empty). Each element is an object with a non-empty string `id` of at most 200 characters. Duplicate ids within a collection are dropped, keeping the last.
- Required scalar fields per entity are checked for type (`title`/`name`/`content` strings with length caps, `createdAt` ISO strings, enums such as `Task.status`, `Tab.status`). Unknown extra fields are dropped by whitelisting.
- Every URL field (`Tab.url`, `Session` tab URLs, `Task.context.tabs[].url`, bookmark-like fields, `HistoryItem.url`) must parse and use `http:`, `https:` or `file:`. Elements with an invalid URL are kept but the URL is blanked, and the count is reported to the user.
- Referential integrity: a tab or folder pointing at a missing board or folder is attached to the default board or folder (`default_folder` / `default_board`) rather than dropped.
- `settings.extension` keys must be in `EXTENSION_SETTING_KEYS`; `settings.page` keys in `PAGE_SETTING_KEYS`. Other keys are ignored.

Atomic apply, in `importData`:

1. Read, size-check, parse, **validate**. On failure throw an error containing a short list (first 5) of problems. No data has been touched.
2. Build a **backup** of the current state with `exportData()` and keep it in `chrome.storage.local` under `tabplex_import_backup` (overwritten on each import).
3. Write the new data into IndexedDB and send `IMPORT_ALL_DATA` to the background.
4. If step 3 fails, restore the backup (same code path), then report the original error.
5. Settings: keep the existing restore step, run after the data succeeds.

Background (`data-service.ts`): re-run the same `validateExport`-style collection checks on the payload (it is a message boundary), write all keys in a **single** `chrome.storage.local.set({...})` so the update is atomic, and remove the 2 s timeout in favour of §3.5.

UI: the import confirmation dialog shows counts per collection and any warnings (blanked URLs, re-parented items), plus "A backup of your current data was kept; Settings → Restore last backup".

**Accept:** a file with `tabs: [null]`, a `javascript:` URL, or a 25 MB body is rejected or sanitised with a message; a forced failure in step 3 restores the previous data; all existing import/export tests still pass.

### 3.4 B2: cleanup and unbounded tab tracking

Two defects: the timer never fires, and tracking has no bound.

- **Alarms:** replace `setInterval` with `chrome.alarms.create('cleanup', { periodInMinutes: 1440 })` and an `onAlarm` listener registered at top level. Add the `alarms` permission. Per CLAUDE.md justify it in `PRIVACY.md` (run `npm run build:privacy`, see memory note), README "Permissions Explained" and `CHROMEWEBSTORE.md`. Remove and re-add the unpacked extension to test the new permission.
- **Also run cleanup on worker start** (cheap, covers browsers that were closed for days).
- **Cap the collection:** after any insert from `tab-service.ts`, if `tabs.length > MAX_TRACKED_TABS` (default 2000), delete the oldest `closed` entries first.
- **Product decision (needs the owner's call, see §10):** `tab-service.ts:17` records every finished page load into `default_folder`. Options: (a) keep, with the cap above; (b) track only tabs the user has put on a board; (c) make it an opt-in setting. Recommendation: (c), default off for new installs, existing installs keep current behaviour until they toggle it.
- Remove the duplicate `onUpdated`/`onActivated` write paths: `tab-listeners.ts` should only update `lastAccessed` of an already-tracked tab and share one helper with `tab-service.ts`.
- Surface storage use: Settings shows `chrome.storage.local.getBytesInUse()` against the 10 MB quota and warns above 80%.

**Accept:** with fake timers and `chrome.alarms` mocked, the alarm handler deletes closed tabs older than 30 days and enforces the cap; no `setInterval` remains under `src/background/`.

### 3.5 B3: honest responses

Add `src/background/respond.ts`:

```ts
export function respondWith<T>(
    work: Promise<T>,
    sendResponse: (r: unknown) => void,
    opts?: { timeoutMs?: number; map?: (value: T) => unknown }
): true;
```

Behaviour: sends the mapped value (default `{ success: true }`) on resolve, `{ error: message }` on reject, and `{ error: 'Timed out' }` on timeout (default 5 s), guarded so only one response is ever sent. It returns `true` so handlers can `return respondWith(...)`.

Migrate every handler that has the `xResponseSent` flag plus 1 s timer (`message-handler.ts`, `task-/note-/history-/session-/folder-/bookmark-service.ts`, `data-service.ts`) and delete the ~10 copies of `safeSendResponse`. Rules:

- No fabricated success. A timeout is an error.
- Handlers that previously never replied on timeout (`GET_HISTORY_ITEM`, `GET_BROWSER_HISTORY`) now reply with the error.
- UI call sites that ignored the response must show the existing error toast when `error` is set (audit `src/store/slices/board/*Slice.ts`); do not roll back optimistic state silently.
- Keep behaviour of `STORAGE_*` broadcasts unchanged (still broadcast after a successful write; use `.catch(() => {})`).
- Fix the `ADD_BOARD` race by doing the existence check inside the write lock (add `addItemIfMissing` to `storage.ts` returning whether it inserted).

**Accept:** existing `message-handler`/`services` tests are updated to the new semantics; new tests cover resolve, reject, timeout and double-send.

### 3.6 S3: link rendering

Replace the regex pipeline in `utils/markdown.ts` with a single renderer that cannot place text inside an attribute after other transforms.

Option A (recommended): use `markdown-it` (already a dependency, after the S4 upgrade) with `html: false`, `linkify: false`, a `validateLink` that allows only `http:`, `https:`, `mailto:`, and a link-open rule that adds `target="_blank" rel="noopener noreferrer"`. Keep the NoteCard and MarkdownEditor feature set (headings, bold/italic, code, checkboxes, lists, quotes, strikethrough) with plugins or small custom rules; keep NoteCard's simplified look via CSS or a render flag.

Option B (smaller): keep the hand-written parser, but extract links first, replacing each with a `\u0000L<n>\u0000` placeholder holding the already escaped label and a validated `href`; run the other substitutions; then restore the placeholders. `href` is passed through `new URL()` and re-serialised (`.href`), and `"` is escaped.

Recommendation: A, because it removes the class of bug and `markdown-it` is already shipped. Protect against ReDoS by capping rendered input (e.g. 200 000 characters).

Also add a regression test for the known payload `[x](https://e.com/\n[x] foo)` and for `[x](https://e.com/```a\n b```)`, asserting the output has exactly one `<a>` with a clean `href` and no attribute after it other than `target` and `rel`.

**Accept:** property-style tests (fuzz with quotes, backticks, brackets, newlines, `_`, `*`, `~`) assert that rendered output parsed in jsdom contains only allowed elements and attributes.

### 3.7 S4: dependencies

1. `npm audit --omit=dev` baseline recorded in the PR.
2. `npm audit fix`; for anything left, bump `react-router`/`react-router-dom`, `markdown-it` and the package that pulls in `prosemirror-view` (tldraw) explicitly.
3. Run the full verify skill, with E2E, because tldraw and the router are runtime-critical.
4. Add `npm audit --omit=dev --audit-level=high` as a CI step (non-blocking at first, then blocking). Enable Dependabot for npm and GitHub Actions.

**Accept:** audit reports 0 high or critical production advisories, or each remaining one is listed in the PR with a reason it is not reachable.

### 3.8 S5: message hygiene

- Remove `console.log('Background received message:', message)`. If tracing is wanted, gate it behind a `DEBUG` constant that is `false` in production builds (`import.meta.env.DEV`). Never log payloads of notes, tasks or URLs.
- At the top of the listener: `if (!message || typeof message.type !== 'string') { respond error; return false; }`.
- Reject messages whose `sender.id !== chrome.runtime.id`, and, for `sender.tab`, whose `sender.url` is not under `chrome.runtime.getURL('')` (defence in depth; today only extension contexts can reach the listener).

**Accept:** unit tests for malformed, foreign-sender and valid messages.

## 4. Data and permission changes

| Change                         | Detail                                                                                                                      |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| New permission `alarms` (§3.4) | Document in `PRIVACY.md` (+ `npm run build:privacy`), README, `CHROMEWEBSTORE.md`; reinstall the unpacked extension to test |
| Removed manifest block (§3.2)  | `web_accessible_resources`                                                                                                  |
| New storage key                | `tabplex_import_backup` (chrome.storage.local); add to nothing in the export list                                           |
| New setting                    | `trackAllTabs` (§3.4 option c), stored with the other settings and included in `EXTENSION_SETTING_KEYS`                     |
| IndexedDB                      | No schema change, so no `DB_VERSION` bump                                                                                   |

## 5. Test plan

Follow the `write-tests` skill; the 85% coverage gate applies and no exclusions may be added.

- **Unit:** `importValidation` (valid, each rule violated, size cap), `respondWith` (resolve/reject/timeout/double-send), alarm cleanup with the cap, markdown renderer payloads, message guard, `OPEN_TABBOARD`.
- **Component:** import dialog shows counts and warnings; settings storage-usage warning.
- **E2E (Playwright, `e2e/`):** (1) onboarding Get started lands on the app; (2) a page at `https://e2e.test/` cannot iframe or fetch `index.html`; (3) importing a corrupt file leaves existing data unchanged; (4) importing a good file round-trips.
- **Manual:** remove and reload the unpacked extension after the manifest change; check the service worker console for errors.

## 6. Rollout

- Each phase is its own `feature/<name>` branch merged into `develop` through a PR. Conventional commits: `fix(onboarding)`, `fix(security)`, `fix(import)`, `fix(background)`, `refactor(background)`, `chore(deps)`.
- `main` only receives `develop` when a release is wanted (decision D14). Because §3.4 adds a permission, Chrome will disable the extension for existing users until they accept the new permission; ship it in a minor release with a note in the changelog and store listing, and keep it out of releases that are meant to be silent patches. Consider shipping `alarms` last.
- No data migration is required. Users who have an oversized `tabs` collection are trimmed by the first cleanup run.

## 7. Risks

| Risk                                                            | Mitigation                                                                         |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Removing WAR breaks something unexpected (icons, notifications) | Manual and E2E check; add back individual files if needed                          |
| Stricter import rejects exports from older versions             | Fixtures from 1.0.0 and 2.0.0 in tests; sanitise rather than reject where possible |
| Honest errors surface failures users never saw before           | Use the existing toast; keep copy plain ("Could not save, try again")              |
| Dependency bumps change tldraw or router behaviour              | Isolated PR, full verify plus E2E, easy to revert                                  |
| `alarms` permission prompt on update                            | See §6; document the justification                                                 |

## 8. Smaller defects folded into the phases

- `data-service.ts`: single atomic `set`; 2 s timeouts removed (§3.3, §3.5).
- `clearAllData` in `storage.ts` does not clear `history_items`; make export/import consistent about history (the importer replaces it from the file, or keeps the current one when the file has none, as it does today) and document it.
- Unawaited `chrome.runtime.sendMessage` without `.catch` in `tab-service.ts:77,126`, `tab-listeners.ts:15`, `cleanup-service.ts:19`.
- Duplicate listeners in `tab-service.ts` and `tab-listeners.ts` (§3.4).
- `GET_HISTORY_ITEM` / `GET_BROWSER_HISTORY` never reply on timeout (§3.5).
- `tab-service.ts` redeclares a `Tab` interface; import it from `src/types` as CLAUDE.md requires.

## 9. Phases and order

| Phase | Branch                         | Contents                              | Size |
| ----- | ------------------------------ | ------------------------------------- | ---- |
| 1     | `fix/onboarding-open-app`      | §3.1, §3.8 (log removal and guard)    | S    |
| 2     | `fix/web-accessible-resources` | §3.2                                  | S    |
| 3     | `fix/safe-import`              | §3.3                                  | M    |
| 4     | `refactor/respond-helper`      | §3.5, B4 items, `ADD_BOARD` race      | M    |
| 5     | `fix/markdown-links`           | §3.6                                  | S–M  |
| 6     | `chore/deps-audit`             | §3.7                                  | S–M  |
| 7     | `fix/tab-tracking-cleanup`     | §3.4 (with `alarms`, its own release) | M    |

Phases 1 and 2 are independent and can ship immediately. Phase 4 should precede 3's background changes if both are in flight, to avoid rewriting `data-service.ts` twice.

## 10. Open questions

1. **Auto-tracking of every page load** (§3.4): decided: opt-in. New installs start with it off, existing installs keep it on until turned off (Settings → Tab tracking & storage).
2. **Markdown**: adopt `markdown-it` for both renderers (A), or keep the hand-written parser with placeholders (B)?
3. **Import backup**: is one level of backup enough, or should the user be able to download it from Settings?
4. **Release**: ship phase 7 with `alarms` in the next minor, or batch it with the next planned permission change?

## 11. Definition of done

- All accept criteria in §3 met.
- The `verify` skill passes: typecheck, lint with zero warnings, `format:check`, `test:coverage` at or above 85%, build, and E2E.
- `PRIVACY.md`, README, `CHROMEWEBSTORE.md` and `landing-page/privacy.html` updated for the `alarms` permission.
- `docs/ARCHITECTURE.md` and `docs/DATA_FLOW.md` updated for `respondWith`, validation and the backup key.
- A follow-up `npm audit --omit=dev` is clean of high advisories.
