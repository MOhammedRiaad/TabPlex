# CLAUDE.md

Guidance for Claude when working in this repository.

## Project

**TabPlex** (repo: TabBoard) — a Chrome **Manifest V3** extension that organizes tabs, tasks, notes, sessions and bookmarks in a Trello-like workspace. Local-first: all user data stays in the browser.

- Clicking the toolbar icon opens `index.html` in a full tab (not a popup/side panel), see `src/background/background-init.ts`.
- First install opens `onboarding.html` (plain HTML/CSS/JS at repo root, copied to `dist/` by Vite).

## Stack

React 19 · TypeScript (strict) · Vite 7 · Zustand 5 · `idb` (IndexedDB) · react-router-dom 7 · @dnd-kit · framer-motion · tldraw 4.

## Commands

```bash
npm install
npm run dev           # vite dev server (UI only; chrome.* APIs are unavailable outside the extension)
npm run build         # tsc && vite build -> dist/   (load dist/ via chrome://extensions > Load unpacked)
npm run lint          # eslint, --max-warnings 0 (zero-warning policy)
npm run format        # prettier --write
npm run format:check
npm run package       # zip dist/ → release/tabplex-v<version>.zip
npm run release:dry   # preview the next semantic-release version + notes
npm run typecheck     # tsc for src/ and e2e/
npm test              # vitest (unit + component tests, jsdom)
npm run test:watch
npm run test:coverage # vitest + v8 coverage; fails under 85% statements/branches/functions/lines
npm run test:e2e      # playwright: loads the built dist/ into Chromium (run npm run build first)
```

"Verified" means typecheck, lint, format:check, test:coverage and build all pass (see the `verify` skill).

## Tests

- Unit/component tests sit next to the code in `__tests__/` folders (`*.test.ts(x)`); config in `vitest.config.ts`.
- `src/test/setup.ts` installs a fresh in-memory `chrome` mock before every test (`src/test/chromeMock.ts`: tabs, groups,
  windows, storage with `onChanged`, runtime messaging, events). Use `fakeChrome()` / `installChromeMock()` to get its
  `browser` helpers (`addTab`, `addGroup`, `openWindow`, `events.*.emit`…). IndexedDB is `fake-indexeddb`.
- Build data with `src/test/factories.ts` (`makeTask`, `makeContext`, `makeBoard`, `makeTab`, `makeNote`…).
- Background modules register listeners at import: `vi.resetModules()` then `await import(...)` per test, and drive timers
  with `vi.useFakeTimers()` (busy guard 300 ms, snapshot debounce).
- Coverage gate is 85% on logic and key UI. Excluded (see `vitest.config.ts`): types, entry files, and pure-visual canvas
  code (`canvas/components`, `canvas/tools`, `canvas/utils/render.ts`, tldraw, `utils/export.ts`) — covered by E2E instead.
  Don't add exclusions to dodge the gate; write the test.
- E2E (`e2e/`): `fixtures.ts` launches Chromium with the extension, serves fake sites at `https://e2e.test/<name>`, and
  gives `serviceWorker`, `extensionId` and `app` (the TabPlex page, fails on page errors). Locally set
  `PW_CHROMIUM_PATH` to use an existing Chromium instead of `npx playwright install chromium`.

## Layout

```
manifest.json            MV3 manifest (copied to dist/ by vite-plugin-static-copy)
vite.config.ts           two entries: index.html (UI) + src/background/index.ts -> dist/src/background/background.js
src/
  main.tsx, App.tsx      UI bootstrap; routes in routes.tsx (ROUTES, ROUTE_METADATA, viewToPath/pathToView)
  types/index.ts         shared types for UI AND background (Board, Folder, Tab, Task, Note, Session, ExtensionMessage…)
  store/boardStore.ts    single Zustand store composed from slices in store/slices/board/*Slice.ts (+ types.ts)
  store/timerStore.ts    pomodoro timer store
  features/<domain>/     feature-first UI: <Domain>View.tsx + .css, components/, utils/, store/
  features/ui/store/uiStore.ts   ViewType union + active view
  hooks/useStorageSync.ts        loads IndexedDB on mount + applies STORAGE_* broadcast messages
  utils/storage.ts       IndexedDB wrapper (DB_VERSION, object stores, CRUD) — UI side
  utils/dateUtils.ts, tabUtils.ts, idGenerator.ts, exportImport.ts   shared helpers (reuse, don't duplicate)
  background/            service worker: index.ts imports every *-service.ts; message-handler.ts routes messages;
                         storage.ts = chrome.storage.local persistence for the background
docs/                    ARCHITECTURE.md, DATA_FLOW.md, MAINTENANCE_GUIDE.md (read these for deeper context)
docs/specs/              feature specs — read the relevant one before implementing (e.g. PARK_AND_RESUME.md)
landing-page/            static marketing site (not part of the build; ignored by eslint)
dist/                    build output — never edit by hand
```

## Data flow (the thing most easily broken)

1. UI action → Zustand slice updates state **and** persists to IndexedDB (`utils/storage.ts`).
2. Slice sends `chrome.runtime.sendMessage({ type: 'ADD_NOTE' | 'UPDATE_…' | 'DELETE_…', payload })`.
3. Background `*-service.ts` handler writes to `chrome.storage.local` and re-broadcasts `STORAGE_<ENTITY>_<ADDED|UPDATED|DELETED>`.
4. `useStorageSync` in every open TabPlex tab applies the change without echoing it back: `add*Silently` / `delete*Silently` actions (no message sent), or an "already exists by id" check before calling the normal `add*`. Skipping this causes infinite message loops.

Message handlers that respond asynchronously must `return true` and guard against double `sendResponse` (existing pattern: a `responseSent` flag + `safeSendResponse` + 1s fallback timeout). Messages whose type starts with `STORAGE_` are ignored by the background.

## Conventions

- Prettier: 4 spaces, single quotes, `printWidth` 120, `arrowParens: avoid`, trailing commas es5, LF.
- ESLint must report **zero warnings**. Avoid `any`; prefix intentionally unused vars/args with `_`.
- Shared types live in `src/types/index.ts` — import them in the background too; don't redeclare.
- IDs via `src/utils/idGenerator.ts`; timestamps as ISO strings (`new Date().toISOString()`).
- Feature-first folders; co-locate a component's `.css` next to it. No CSS framework.
- Commits: **Conventional Commits** enforced by commitlint (`feat:`, `fix:`, `refactor:`, `chore:`, `docs:`…). Husky pre-commit runs lint-staged (prettier + eslint --fix).
- Branches: `feature/<name>`, merged via PR into **`develop`** (never straight into `main`), and the branch is deleted after the merge. Every push to `main` publishes a release, so `main` only receives `develop` when a release is wanted (ROADMAP.md decision D14). `develop` and `main` are the only long-lived branches.
- Versions are set by semantic-release on merge to `main` (see `docs/MAINTENANCE_GUIDE.md` → Release Process). Never edit `version` by hand; the commit type decides the bump (`feat` → minor, `fix`/`perf`/`refactor` → patch, `!` → major).

## Gotchas

- The background service worker is an **ES module** (`"type": "module"` in manifest). Anything imported by both `src/background/**` and the UI is emitted as a shared chunk in `dist/assets/` that the worker imports. Keep shared modules free of DOM/React.
- Store hydration in `useStorageSync` uses `useBoardStore.setState`, and remote `STORAGE_*` changes are applied with silent upserts. Never call `add*` / `update*` actions there: they reset timestamps and re-send messages (loops).
- `Task.context` (Park & Resume) is owned by `src/background/context-service.ts`. Change it only by sending `TASK_CONTEXT_*` messages, never through `updateTask`.

- `utils/storage.ts` `upgrade()` calls `createObjectStore` unconditionally. Before bumping `DB_VERSION` or adding a store, guard with `if (!database.objectStoreNames.contains(STORE))` or existing users' upgrade will throw.
- Changes to `manifest.json` or `src/background/**` need a reload of the extension in `chrome://extensions`; UI changes just need a tab refresh.
- A **newly added permission** may not apply on reload of the unpacked extension (e.g. `favicon` kept failing with `net::ERR_FAILED`). Remove the extension and load `dist/` unpacked again before debugging code.
- Adding a new view touches several places that each hard-code the view list: `ViewType` (uiStore), `routes.tsx` (ROUTES, ROUTE_METADATA, viewToPath, pathToView, `<Route>`), `AppNav.tsx`, `CommandPalette.tsx`, optionally `useKeyboardShortcuts.ts`.
- New permissions in `manifest.json` must also be justified in `PRIVACY.md` / README "Permissions Explained".
- Repo is edited on Windows; keep LF endings (`endOfLine: lf`).

## Project skills (`.claude/skills/`)

| Skill              | Use when                                                                               |
| ------------------ | -------------------------------------------------------------------------------------- |
| `verify`           | Before declaring any change done — typecheck, lint, format, tests + coverage, build    |
| `write-tests`      | Adding a feature or fix, coverage under 85%, or writing unit/E2E tests                 |
| `add-data-entity`  | Adding a new persisted domain (e.g. reminders) end to end                              |
| `add-message-sync` | Adding/changing a UI ↔ background message or cross-tab sync                            |
| `add-view`         | Adding a new page/route to the app                                                     |
| `debug-extension`  | Something works in dev but not in the loaded extension, data not syncing, SW errors    |
| `release`          | Shipping a version: how the automated GitHub release works, dry runs, Web Store upload |
| `commit`           | Writing a commit that passes commitlint/husky                                          |
