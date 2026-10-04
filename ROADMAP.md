# TabPlex Development Roadmap

This document tracks TabPlex from first prototype to today, and lists everything still planned.

**Legend:** ✅ Done · 🚧 In progress · 📋 Planned (scoped) · 💡 Idea (needs a spec) · Milestone tags: `v1.0`, `v1.1`, `v1.2`, `later`, `wont-do`

---

## At a glance

| Phase | Theme                                          | Status                                                          |
| ----- | ---------------------------------------------- | --------------------------------------------------------------- |
| 1     | Foundation & core architecture                 | ✅                                                              |
| 2     | State management & architecture optimization   | ✅                                                              |
| 3     | Logic decoupling & feature organization        | ✅                                                              |
| 4     | View decomposition                             | ✅                                                              |
| 5     | Quality assurance & type safety                | ✅                                                              |
| 6     | Advanced features & productivity tools         | ✅                                                              |
| 7     | Board store decomposition                      | ✅                                                              |
| 8     | UI polish & bug fixes                          | ✅                                                              |
| 9     | Maintenance & production readiness             | ✅                                                              |
| 10    | Routing, onboarding & rebrand to TabPlex       | ✅                                                              |
| 11    | Park & Resume (task-bound tab contexts)        | ✅                                                              |
| 12    | Testing, CI & automated releases               | ✅                                                              |
| —     | **v1.0 queue**: launch on the Chrome Web Store | 🚧 Next (see [v1.0 queue](#v10-queue-chrome-web-store-launch-)) |
| —     | v1.1, v1.2, later                              | 📋 / 💡                                                         |

---

## Phase 1: Foundation & Core Architecture ✅

**Goal**: Establish the extension foundation with basic tab organization capabilities.

- ✅ Chrome extension shell with Manifest V3
- ✅ React 19 + TypeScript setup
- ✅ Vite build configuration
- ✅ Full-page interface (the toolbar icon opens `index.html` in a tab)
- ✅ Manual board and folder creation
- ✅ Tab organization system
- ✅ Drag-and-drop functionality (DndKit)
- ✅ Local data persistence (IndexedDB + chrome.storage.local)
- ✅ Basic CRUD operations for boards, folders, and tabs

**Technical achievements:** Zustand state management, IndexedDB via `idb`, Chrome extension APIs, component-based architecture.

---

## Phase 2: State Management & Architecture Optimization ✅

**Goal**: Optimize state management and improve code organization.

- ✅ Zustand store optimization with granular selectors
- ✅ `useShallow` implementation for performance
- ✅ Component extraction (AppHeader, AppNav)
- ✅ Build verification and optimization
- ✅ UIStore creation for global UI state
- ✅ Component refactoring to use UIStore
- ✅ StorageService interface and implementation
- ✅ Canvas store split into modular slices

**Technical achievements:** better rendering performance, separation of concerns, modular state, service layer abstraction.

---

## Phase 3: Logic Decoupling & Feature Organization ✅

**Goal**: Implement clean architecture patterns and reorganize the codebase by feature.

- ✅ Tool Strategy Pattern for canvas drawing
- ✅ Feature-based directory structure
- ✅ Component migration to feature folders: `boards`, `sessions`, `analytics`, `history`, `today`, `tasks`, `notes`, `ui`, `canvas`, `navigation`

**Technical achievements:** feature-based architecture, better discoverability and isolation, scalable structure.

---

## Phase 4: View Decomposition & Component Refinement ✅

**Goal**: Break large views into smaller, focused components.

- ✅ AnalyticsDashboard: ActivityChart, AnalyticsSummaryCards, DomainList, FocusMetrics, SessionStats, TaskCompletionWidget
- ✅ SessionsView: CreateSessionForm, SessionCard, SessionHeader, SessionList
- ✅ HistoryView: HistoryHeader, HistoryItem, HistoryList
- ✅ TodayView: TodayHeader, TodayNotes, TodayTasks (TodaySidebar was later removed as unused)

---

## Phase 5: Quality Assurance & Type Safety ✅

**Goal**: Enforce strict type checking and resolve all type errors.

- ✅ Fixed dynamic import warnings for `storage.ts`
- ✅ Enabled `strict: true` in `tsconfig.json`
- ✅ Full type check with zero errors
- ✅ Type refinement, proper interfaces, generic constraints

---

## Phase 6: Advanced Features & Productivity Tools ✅

**Goal**: Add canvas, timer, analytics and richer tasks.

#### 🎨 Canvas

- ✅ First version: custom drawing suite (rectangle, ellipse, line, pen, text), selection, multi-select, layering, styling, zoom/pan, grid, PNG export, auto-save, multiple canvases
- ✅ Optional **tldraw 4** canvas mode (Settings → Canvas Mode; `features/canvas/components/TldrawContainer.tsx`) with shape resizing, rotation and arrows/connectors. The custom canvas stays the default

#### 🍅 Pomodoro Timer

- ✅ Persistent timer state across reloads
- ✅ Global timer integration and mini timer in the Today header
- ✅ Task linking for focus tracking
- ✅ Customizable work/break durations, auto-start options, sound notifications

#### 📊 Analytics

- ✅ Task focus metrics and time estimation (8-hour workday basis)
- ✅ Weekly activity charts, domain analytics, completion rate tracking

#### 📝 Tasks

- ✅ Rich descriptions, checklists with progress, linked tabs, priority levels, due dates

---

## Phase 7: Board Store Decomposition ✅

**Goal**: Split the monolithic board store into focused slices.

- ✅ Slices: `boardSlice`, `tabSlice`, `taskSlice`, `noteSlice`, `sessionSlice`, `historySlice`, `bookmarkSlice`
- ✅ Combined in one `boardStore` with type-safe slice interfaces

---

## Phase 8: UI Polish & Bug Fixes ✅

- ✅ HistoryItem dark mode text visibility
- ✅ SessionCard layout overflow, title colour and responsive header
- ✅ Dark mode consistency and accessibility improvements

---

## Phase 9: Maintenance & Production Readiness ✅

- ✅ Zero ESLint errors and warnings (`--max-warnings 0`), no `any`
- ✅ Background service worker build fixed in `vite.config.ts`
- ✅ Migrated to ESLint flat config
- ✅ README rewrite, keyboard shortcuts reference
- ✅ `PRIVACY.md` for the Chrome Web Store (GDPR/CCPA statements, permission explanations)

---

## Phase 10: Routing, Onboarding & Rebrand ✅

- ✅ react-router 7 with hash routes for all 11 views (Today, Boards, History, Sessions, Analytics, Canvas, Bookmarks, Notes, Tasks, Pomodoro, Settings)
- ✅ First-install onboarding page (`onboarding.html`)
- ✅ Board UI refactor, folder UX and Bookmark view parity
- ✅ History side panel on Boards
- ✅ Improved keyboard shortcuts and toast notifications
- ✅ Enhanced task data model
- ✅ Rebrand from TabBoard to **TabPlex**
- ✅ Shared utilities extracted (`dateUtils`, `tabUtils`, `idGenerator`, `exportImport`), background types consolidated, storage sync gaps fixed

---

## Phase 11: Park & Resume ✅

Spec: [docs/specs/PARK_AND_RESUME.md](docs/specs/PARK_AND_RESUME.md)

- ✅ Task updates sync to the background and other open tabs (`UPDATE_TASK`)
- ✅ A task owns a set of tabs (its context), stored as snapshots
- ✅ **Start / Resume**: the task's tabs reopen in a titled Chrome tab group coloured by priority
- ✅ **Park**: "Where did you leave off?" note, choose tabs to keep open, then the tabs close
- ✅ New tabs auto-join the active task (setting)
- ✅ Closing the group by hand parks the task without losing tabs
- ✅ Browser restart: the active group is re-bound by title, or the task is parked
- ✅ Parked tasks on the Today view, active-task pill in the header
- ✅ Command palette entries and `Alt+Shift+P` shortcut
- ✅ Optional Pomodoro link (start on Start/Resume, pause on Park)
- ✅ Local analytics: parks, resumes, tabs closed ("Park & Resume · last 7 days")
- ✅ **On-device AI summary** of a parked context (Chrome built-in Summarizer API, opt-in)
- ✅ Fix: closing the group right after Resume no longer leaves the task stuck as active

---

## Phase 12: Testing, CI & Automated Releases ✅

- ✅ Vitest unit and component tests (36 files, 553 tests) with an in-memory Chrome mock
- ✅ **85% coverage gate** (statements, branches, functions, lines) in CI
- ✅ Playwright E2E against the built extension (Park & Resume flows, every view renders)
- ✅ GitHub Actions: `ci.yml` (lint, typecheck, tests, build, E2E) and `release.yml`
- ✅ semantic-release: versions and changelog from Conventional Commits on merge to `main`
- ✅ Husky + lint-staged + commitlint
- ✅ Privacy fix: website icons come from Chrome's local favicon cache (`favicon` permission) instead of Google's favicon service
- ✅ Quick Links show a 🌐 fallback when a site has no icon

---

## Product decisions (2026-10-03)

Made by the product owner to unblock planning. Each one has a reason; reopen a decision by editing this table, not by quietly working around it.

| #   | Decision                                                                                                                                                                                                                                   | Reason                                                                                                                                                                                                                                            |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | **v1.0.0 = the Chrome Web Store launch.** The first automated release is tagged `v1.0.0` (semantic-release starts there when no tag exists).                                                                                               | One clear meaning for "v1": what users can install.                                                                                                                                                                                               |
| D2  | **Until v1.0.0, nothing merges to `main`.** Feature branches merge into a new **`develop`** branch (CI already runs on every branch except `main`). When the v1.0 queue is done, `develop` merges into `main` once, which releases v1.0.0. | Every push to `main` publishes a release. Merging work in progress now would ship an unfinished "v1.0.0".                                                                                                                                         |
| D3  | **No manual git tags.** semantic-release creates `v1.0.0` itself.                                                                                                                                                                          | A hand-made tag would confuse semantic-release's version calculation.                                                                                                                                                                             |
| D4  | **Drop the `identity` and `identity.email` permissions in v1.** The Today greeting uses an optional "Your name" field in Settings, or a plain "Good morning".                                                                              | It's only used for the greeting, and Chrome would show users "Know your email address" at install. Fewer warnings means more installs and a smoother review.                                                                                      |
| D5  | **Organize tabs ships in v1.0** (with the AI foundation). **New task from tabs ships in v1.1.**                                                                                                                                            | One AI headline for the launch, which works for everyone thanks to group-by-site. Task-from-tabs changes Park & Resume message behaviour: lower risk after launch.                                                                                |
| D6  | **Code-split the UI bundle before v1.0.**                                                                                                                                                                                                  | The main chunk is ~2.2 MB. First-open speed is part of the first impression and of store reviews.                                                                                                                                                 |
| D7  | **Won't do: A/B testing, cloud sync, collaboration, Notion/Trello API integrations.**                                                                                                                                                      | They need telemetry, a server or network access, which breaks "all data stays in your browser". Integrations become **export formats** (Markdown/CSV) instead.                                                                                    |
| D8  | **"Error tracking" and "performance monitoring" become local-only tools** (a copyable error log in Settings, dev-build timings). Not in v1.                                                                                                | Same privacy promise. Useful, but not launch-critical.                                                                                                                                                                                            |
| D9  | **Firefox: later.** Edge/Brave: check after launch (Chromium, likely work as is, except Chrome-only AI).                                                                                                                                   | Focus on one store for v1.                                                                                                                                                                                                                        |
| D10 | Organize tabs open questions: **Save as board does not close tabs; group colours aren't restricted; board name is automatic** ("Organized tabs · 3 Oct").                                                                                  | Keep v1 simple and reversible. See [AI_TAB_GROUPING.md §17](docs/specs/AI_TAB_GROUPING.md).                                                                                                                                                       |
| D11 | New task from tabs open questions: **"Create & start" is the primary button; the hint isn't remembered; one window only.**                                                                                                                 | Shortest path into Park & Resume. See [AI_TASK_FROM_TABS.md §16](docs/specs/AI_TASK_FROM_TABS.md).                                                                                                                                                |
| D12 | **Remove the `<all_urls>` host permission before v1** unless a feature is found that needs it.                                                                                                                                             | Nothing calls `chrome.scripting`, content scripts or `fetch`, and favicons now come from Chrome's local cache (`favicon` permission). Chrome shows it as "Read and change all your data on all websites", the strongest install warning there is. |
| D13 | **Don't ship with tldraw's watermark hidden** unless we hold a licence that allows it. Default: remove the CSS that hides it.                                                                                                              | Hiding it may breach tldraw's licence, a legal risk for a public store listing. The tldraw canvas is optional (custom canvas is the default), so showing a watermark there costs little.                                                          |

---

## Milestones

| Tag       | Meaning                                  | Release                                      |
| --------- | ---------------------------------------- | -------------------------------------------- |
| `v1.0`    | Required for the Chrome Web Store launch | `v1.0.0` (first merge of `develop` → `main`) |
| `v1.1`    | First update after launch                | minor release                                |
| `v1.2`    | Second update                            | minor release                                |
| `later`   | Worth doing, not scheduled               | —                                            |
| `wont-do` | Decided against (see decisions D7)       | —                                            |

Sizes: **XS** < 1 h · **S** ≤ ½ day · **M** 1–2 days · **L** 3–5 days.

---

## v1.0 queue: Chrome Web Store launch 🚧

Work **top to bottom**. An item starts only when the ones it depends on are done. Each item ends with the `verify` skill passing and a Conventional Commit on a `feature/*` branch merged into `develop`.

| #   | Item                                                                                                                                                                                                                                                                                          | Size | Depends on | Spec / reference                                                                                                   | Status                                                                          |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ---------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| 1   | **Release flow:** create `develop` from `main`, merge `feature/park-and-resume` into it, update the branch rule in `CLAUDE.md` and `docs/MAINTENANCE_GUIDE.md` (feature → `develop` until v1)                                                                                                 | XS   | —          | D2, D3                                                                                                             | ✅                                                                              |
| 2   | **Remove `identity` permissions:** optional "Your name" setting for the greeting, update `manifest.json`, `PRIVACY.md`, README "Permissions Explained", tests                                                                                                                                 | S    | 1          | D4                                                                                                                 | ✅                                                                              |
| 3   | **Docs:** CLAUDE.md gotcha "a new manifest permission may need removing and re-adding the unpacked extension", plus the `debug-extension` skill                                                                                                                                               | XS   | 1          | —                                                                                                                  | ✅                                                                              |
| 3a  | **Remove `<all_urls>`:** confirm nothing needs it (tab titles/URLs come from `tabs`, icons from `favicon`), remove it from `manifest.json`, update `PRIVACY.md` and README, then check every view, Park & Resume and favicons in a fresh profile                                              | S    | 2          | D12                                                                                                                | ✅                                                                              |
| 3b  | **tldraw licence:** `TldrawContainer.tsx` hides tldraw's watermark and licence message with CSS. Check tldraw's licence terms for a published extension, then either get a licence key or stop hiding the watermark                                                                           | S    | —          | D13                                                                                                                | ✅                                                                              |
| 4   | **Code-split the UI:** lazy-load route views (`React.lazy` + `Suspense` in `routes.tsx`), tldraw/Canvas first; main chunk under 500 kB if possible; no Vite size warning                                                                                                                      | M    | 1          | D6                                                                                                                 | ✅                                                                              |
| 5   | **E2E smoke for core views:** Boards (create board/folder/tab), Notes (create, edit), Bookmarks (list), Settings (export → import round trip)                                                                                                                                                 | M    | 4          | `e2e/`                                                                                                             | ✅                                                                              |
| 5a  | **Sync folder, tab and board edits:** `updateFolder`/`updateTab`/`updateBoard` save locally but never send `UPDATE_*` (the background has no handlers), so renames don't reach the background or other open tabs. Add the handlers plus silent receivers (no message loops), like notes in #5 | M    | 5          | `add-message-sync` skill                                                                                           | ✅                                                                              |
| 6   | **AI foundation:** Prompt API wrapper, shared tab helpers, Settings → On-device AI, PRIVACY/README text                                                                                                                                                                                       | M    | 1          | [AI_FOUNDATION.md](docs/specs/AI_FOUNDATION.md)                                                                    | ✅                                                                              |
| 7   | **Organize tabs:** AI tab grouping + group-by-site fallback, preview, undo, save as board                                                                                                                                                                                                     | L    | 6          | [AI_TAB_GROUPING.md](docs/specs/AI_TAB_GROUPING.md)                                                                | ✅                                                                              |
| 8   | **Store listing package:** description, 5 screenshots (light/dark: Today, Park & Resume, Organize, Boards, Canvas), promo tile, category, permission justifications matching `PRIVACY.md`                                                                                                     | M    | 2, 7       | `release` skill                                                                                                    | 🚧 Text and screenshots ready (`store-assets/`); promo tile and account pending |
| 9   | **Privacy policy URL + landing page:** publish `PRIVACY.md` on the landing page, add "Add to Chrome" placeholder                                                                                                                                                                              | S    | 2          | `landing-page/`                                                                                                    | 🚧 Landing page and `privacy.html` ready; hosting pending                       |
| 10  | **Release candidate:** full manual acceptance on (a) a device with Chrome built-in AI and (b) one without: Park & Resume §12, Organize §13.6, onboarding, every view, light/dark; fix blockers                                                                                                | M    | 2–7        | [PARK_AND_RESUME.md §12](docs/specs/PARK_AND_RESUME.md), [AI_TAB_GROUPING.md §13.6](docs/specs/AI_TAB_GROUPING.md) | 📋                                                                              |
| 11  | **Ship v1.0.0:** merge `develop` → `main` (release workflow tags `v1.0.0` and attaches the zip), upload the zip to the Web Store, submit for review, then link "Add to Chrome" on the landing page and README                                                                                 | S    | 8–10       | `release` skill, D1                                                                                                | 📋                                                                              |

**v1.0 is done when:** the Web Store listing is live, `v1.0.0` exists on GitHub with its zip, and README/landing page link to the store.

---

## v1.1: first update

| #   | Item                                                                                         | Size | Spec / notes                                            | Status        |
| --- | -------------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------- | ------------- |
| 12  | **New task from tabs** (drafted title, priority, steps; Create & start groups tabs in place) | L    | [AI_TASK_FROM_TABS.md](docs/specs/AI_TASK_FROM_TABS.md) | 📋 Spec ready |
| 13  | **Create & park:** save tabs to a new task and close them in one click                       | S    | Follow-up to #12 (AI_TASK_FROM_TABS §15)                | 💡            |
| 14  | **Pinning UI** for tabs, tasks and notes (`pinned` exists in the data model)                 | M    | Needs a short spec                                      | 💡            |
| 15  | Store feedback fixes (reserved capacity for issues reported after launch)                    | M    | —                                                       | 📋            |
| 16  | Check Edge and Brave; list them in the README if they work                                   | S    | D9                                                      | 💡            |

## v1.2: second update

| #   | Item                                                                                                        | Size | Notes                                  | Status |
| --- | ----------------------------------------------------------------------------------------------------------- | ---- | -------------------------------------- | ------ |
| 17  | **Tagging:** add, edit and filter tags on tasks, notes and tabs (`tags` exist in the data model and search) | L    | Needs a spec                           | 💡     |
| 18  | **Suggest a task for a new tab** ("Add to _X_?"), non-AI first (domain overlap with task contexts)          | M    | Park & Resume v2 (PARK_AND_RESUME §10) | 💡     |
| 19  | **Export a task context / board as Markdown or CSV** (replaces Notion/Trello integrations, D7)              | S    | —                                      | 💡     |
| 20  | **Note helpers (AI):** summarize, action items → tasks, proofread, rewrite                                  | M    | Uses the AI foundation                 | 💡     |
| 21  | **Auto-name saved sessions (AI)** from their tabs                                                           | S    | Uses the AI foundation                 | 💡     |

## Later (not scheduled)

| Item                                                                                                                                  | Notes                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Ask your workspace: natural-language search over tasks, notes, sessions, bookmarks (AI)                                               | Biggest AI item; needs a spec                           |
| Daily brief on Today (AI)                                                                                                             | —                                                       |
| Bookmark cleanup: suggest folders, flag near-duplicates (AI)                                                                          | —                                                       |
| Translate non-English titles and summaries (Translator API)                                                                           | —                                                       |
| Suggest due dates from task text (AI, confirm before saving)                                                                          | —                                                       |
| Context "time machine": keep the last N parks per task                                                                                | Park & Resume v2                                        |
| Organize tabs v2: drag between groups, merge into existing groups, all windows, shortcut                                              | AI_TAB_GROUPING §16                                     |
| Boards: switch between several boards (the Boards view only shows the first board today; Organize tabs saves into it for that reason) | Needs a short spec                                      |
| History view: replace the "Modify" placeholder (it only shows an alert) for items already added to a folder                           | Small UX fix                                            |
| Restore scroll position / reading progress on Resume                                                                                  | Needs content scripts + host permissions (privacy cost) |
| Local error log in Settings; local performance timings in dev builds                                                                  | D8                                                      |
| Firefox support                                                                                                                       | D9                                                      |
| Dev environment: Playwright's bundled Chromium crashes on one Windows machine                                                         | Workaround in place (`PW_CHROMIUM_PATH`); CI unaffected |

## Won't do

| Item                             | Reason (D7)                                    |
| -------------------------------- | ---------------------------------------------- |
| A/B testing framework            | Needs telemetry; TabPlex collects none         |
| Cloud sync between devices       | Needs a server; breaks local-first             |
| Collaborative features           | Needs a server and accounts                    |
| Notion / Trello API integrations | Needs network access; replaced by export (#19) |

---

## Key Metrics (October 2026)

### Code quality

- **TypeScript**: strict mode, zero type errors
- **Lint**: 0 errors, 0 warnings (enforced)
- **Unit tests**: 553 tests in 36 files, ≥ 85% coverage gate
- **E2E**: Playwright suite against the built extension

### Architecture

- **Views**: 11 routed views
- **Store slices**: 7 board-store slices + UI, timer and canvas stores
- **Background modules**: 16 files in `src/background/` (services, listeners, message handler, storage)

---

## Technology Stack

- **UI**: React 19, TypeScript (strict), Zustand 5, react-router 7, DndKit, Framer Motion, tldraw 4
- **Build & tooling**: Vite 7, ESLint flat config, Prettier, Husky, lint-staged, commitlint
- **Testing**: Vitest (+ Testing Library, fake-indexeddb), Playwright
- **Release**: semantic-release, GitHub Actions
- **Storage**: IndexedDB (via `idb`), chrome.storage.local, local-first
- **AI**: Chrome built-in AI (Summarizer API today; Prompt API planned), on-device only
- **Platform**: Chrome Extension Manifest V3, ES-module service worker

---

## Design Patterns Implemented

1. **Feature-based architecture**: components organized by domain
2. **Slice pattern**: modular state management
3. **Tool strategy pattern**: extensible canvas tools (first canvas)
4. **Service layer**: background services per domain
5. **Typed messaging**: UI ↔ background messages with `STORAGE_*` broadcasts for cross-tab sync
6. **Repository pattern**: storage abstraction layer
7. **Background as source of truth** for tab and tab-group operations (Park & Resume)

---

## Lessons Learned

### Architecture

- Feature-based organization scales better than layer-based
- Modular state slices improve maintainability
- Keep tab and group operations in the background: the UI tab may be one of the tabs being closed
- Store tab snapshots, not references, when data must survive restarts

### Development process

- Incremental refactoring is safer than big rewrites
- Linting and tests early prevent technical debt
- Write a spec before a cross-cutting feature (Park & Resume, AI features)
- Documentation should evolve with code

### Product

- Local-first and on-device AI are a selling point, not a constraint
- Every AI feature needs a useful non-AI path: most devices can't run built-in AI

---

## Acknowledgments

Built with dedication to productivity, privacy, and code quality. Thanks to the open-source community for the tools that made this possible.

**Status**: Working through the v1.0 queue (Chrome Web Store launch)
**Version**: managed by semantic-release (see GitHub Releases)
**Last updated**: October 2026
