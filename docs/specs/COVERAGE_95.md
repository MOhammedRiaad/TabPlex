# Spec: Raise the unit-test coverage gate to 95%

|             |                                                                                                                       |
| ----------- | --------------------------------------------------------------------------------------------------------------------- |
| **Status**  | Implemented (2026-10-25), see `04-build-log.md`                                                                       |
| **Owner**   | Mohamed                                                                                                               |
| **Created** | 2026-10-25                                                                                                            |
| **Branch**  | `feature/coverage-95`, cut from `develop` only after `chore/agentic-workflow` is merged into `develop` (§3 D1, §12 0) |
| **Source**  | `.claude/work/coverage-95/01-brief.md`, G1 answers approved by the user on 2026-10-25                                 |

---

## 1. Problem

`vitest.config.ts:41-46` sets every coverage threshold to 85, but the suite measures far above that. A coverage run made
for this spec on 2026-10-25 (`npx vitest run --coverage`, 101 files, 1702 tests, about 19 s) reports:

| Metric     | Covered / total | %     | Gate |
| ---------- | --------------- | ----- | ---- |
| Statements | 9615 / 9853     | 97.58 | 85   |
| Branches   | 5876 / 6340     | 92.68 | 85   |
| Functions  | 2846 / 2931     | 97.09 | 85   |
| Lines      | 8226 / 8363     | 98.36 | 85   |

With a 7-13 point gap, coverage can drop by hundreds of branches before CI notices. Branches is the only metric under
the user's 95% target. 464 branches are uncovered across 111 of the 225 measured files.

One finding differs from the brief's guess. The background messaging core is already fully covered:
`message-handler.ts` 68/68, `useStorageSync.ts` 57/59, `utils/storage.ts` 3/4, and every board slice except `tabSlice`
(15/18) and `boardSlice` (25/27). The gap is mostly in **UI components and pure utilities**: fallbacks (`??`, `||`),
"callback not passed" guards, `window.confirm` returning false, and error toasts.

## 2. Goals / non-goals

### Goals

- G1. Global branch coverage of **95.5% or more** at delivery (the user's G1 answer 1). That means 6055 or more of 6340
  branches covered, at least **179 more** than today. If dead code is removed (D4), the ratio is computed on the new
  total.
- G2. All four thresholds in `vitest.config.ts` set to **95** (G1 answer 2). The gate fails a run that drops below.
- G3. Statements, functions and lines stay at or above their 2026-10-25 percentages (97.58 / 97.09 / 98.36).
- G4. Every new test pins behaviour (a return value, store state, a message sent or not sent, a toast, rendered text).
- G5. Living docs that quote the 85% gate say 95%.

### Non-goals

- Any change to product behaviour. The only product-source change allowed is removing unreachable code, in its own
  `refactor` commit (D4).
- New `coverage.exclude` entries, or `v8 ignore` / `istanbul ignore` / `c8 ignore` comments. There are none in `src/`
  or `scripts/` today (`git grep` finds zero), and there must still be zero afterwards.
- Per-file thresholds, a different provider, E2E additions, or reaching 100%.
- Changes to `src/test/chromeMock.ts` beyond small additive helpers. No second mock layer (brief constraint).

## 3. Decisions

| #   | Decision                                                                                                                                                                                                                                                                                                                                        | Alternative rejected                                                                                                                                                                                                                                                                                                                                                                                                 |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | **Hard gate before the build (step 4):** the human pushes `chore/agentic-workflow` (local only today, commit `efa70b5`, not on `origin`), opens its own PR and merges it into `develop`. Only then is `feature/coverage-95` cut from the updated `develop`.                                                                                     | (1) Branching from `chore/agentic-workflow`: the coverage PR would carry 627 lines of tooling and fail AC 5. (2) Branching from today's `develop`: the checkout removes `.claude/agents/*.md` and the `cycle` skill mid-cycle (later agents are defined by them), un-ignores `.claude/work/` so handoffs could be committed by `git add -A`, and guarantees a conflict on `CLAUDE.md:114`, which both branches edit. |
| D2  | Gate at 95 on all four metrics; delivery needs branches ≥ 95.5%.                                                                                                                                                                                                                                                                                | Gate at 95.5 or at today's 97 for the other metrics: a fractional or tight gate blocks the next small feature PR because of rounding. That is the user's G1 answer.                                                                                                                                                                                                                                                  |
| D3  | Rank work by **uncovered branch count**, not by lowest %. The top 30 files hold 308 of the 464 misses. The plan in §5 targets **202** of them (§5.2), 23 over the +179 minimum, with 24 named reserve arms (§5.2.1) and 17 reachable-but-untargeted arms in rows 1-10 behind that.                                                              | Lowest-% first: `StorageUsage.tsx` (75%) has 2 misses, while `SessionsView.tsx` (73.7%) has 25. Working by % spends effort for little gain.                                                                                                                                                                                                                                                                          |
| D4  | Unreachable product code may be removed, but only in one separate `refactor(no-release):` commit. Each removal is listed in the build log, and the code reviewer must approve it (G1 answer 3).                                                                                                                                                 | Leaving dead branches and writing contrived tests: that breaks AC 6. Mixing removals into `test:` commits hides product changes from review.                                                                                                                                                                                                                                                                         |
| D5  | Tests go next to the code, in the existing `__tests__/` files where there is one. They use `installChromeMock()` / `fakeChrome()`, `respondToMessages`, `src/test/factories.ts` and `src/features/canvas/__tests__/canvasFactories.ts`. A `vi.mock` of a third-party React library (dnd-kit) is allowed where an existing test already does it. | New per-feature chrome mock modules: CLAUDE.md "Tests" says to use the shared mock.                                                                                                                                                                                                                                                                                                                                  |
| D6  | Raise thresholds in a separate `chore:` commit **after** the test commits, once the measured number is ≥ 95.5%.                                                                                                                                                                                                                                 | Raising first: every intermediate commit would be red, which breaks "each commit green" (§12).                                                                                                                                                                                                                                                                                                                       |
| D7  | Specs that are already implemented (`AI_FOUNDATION.md`, `SECURITY_HARDENING.md`, `NOTE_FROM_TABS.md`, `AI_TAB_GROUPING.md`) keep their "85%" text.                                                                                                                                                                                              | Rewriting them: they record the gate that applied when they shipped. Changing them rewrites history and adds diff noise. See §13 Q3.                                                                                                                                                                                                                                                                                 |
| D8  | Skip the e2e-test-writer and browser-tester stages of `/cycle` for this slug. Nothing changes in the browser (§13 Q2). If the optional `refactor` commit lands, G3 adds two targeted checks (§11).                                                                                                                                              | Running them: they would test unchanged behaviour. The privacy reviewer can do a short pass (brief, privacy section).                                                                                                                                                                                                                                                                                                |
| D9  | **Roles follow the `/cycle` order (explicit note for G2):** the `frontend-engineer` (step 4) owns the whole plan: baseline, every commit in §12 (tests, optional refactor, gate, docs), the reserve decision and the AC 7 table. The `unit-test-writer` (step 5) then runs an independent pass (§12 Roles).                                     | Making the unit-test-writer write the bulk tests first: it inverts `/cycle` steps 4 and 5, leaves the engineer with nothing to do at step 4, and splits ownership of the 95.5% number across two agents.                                                                                                                                                                                                             |

## 4. User flow

Maintainer flow, no end-user change.

1. A contributor opens a PR that adds a handler with an untested `catch`.
2. CI's `npm run test:coverage` step (`.github/workflows/ci.yml:37-38`) runs the v8 threshold check. If the
   uncovered branches push global branches under 95%, vitest prints
   `ERROR: Coverage for branches (94.9x%) does not meet global threshold (95%)`, exits non-zero, and the job fails.
3. The contributor writes the missing test, following the patterns this work adds for similar paths.

## 5. Design

### 5.1 Configuration

Edit `vitest.config.ts:41-46`. Nothing else in the file changes. `exclude` (`:19-38`) stays byte-identical.

```ts
thresholds: {
    statements: 95,
    branches: 95,
    functions: 95,
    lines: 95,
},
```

### 5.2 Ranked baseline and targets (top 30 by uncovered branches, measured 2026-10-25)

`miss` is the number of uncovered branches. `reach` is how many of them a test can cover without changing product code,
verified arm by arm against the source for rows 1-10 (§5.3). For rows 11-30, `reach` is not arm-verified, so the
`target` there is set at about 60% of `miss` on purpose. `target` is what the plan commits to. `Lines` gives the line and
the branch kind of each miss (`i` if/else, `b` binary `||`/`??`/`&&`, `c` conditional `?:`, `s` switch case; the digit is
the arm, so `i1` is the implicit else). The top 10 rows are the "before" table for AC 7.

| #   | File                                                      | miss | branch %       | reach | target  | Uncovered (line:arm)                                                                                                                                          |
| --- | --------------------------------------------------------- | ---- | -------------- | ----- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `src/features/sessions/SessionsView.tsx`                  | 25   | 73.7 (70/95)   | 20    | 18      | 65 i0/i1, 72 i0/i1, 77 i0, 117 b1, 145 b1-2, 152 i0, 193 b1, 200 b1, 201 b1, 208 i1, 217 i0, 223 i1, 226 b1, 229 b1, 248 i1, 289 i1, 335 i1, 338 b1-2, 339 b1 |
| 2   | `src/features/boards/components/BoardNode.tsx`            | 22   | 87.4 (153/175) | 14    | 13      | 85 c0, 110 i1, 123 i1, 139 i1, 143 i1, 144 i1, 151 i1, 161 i0/i1/b0/b1, 168 i1, 183 i1, 189 b1, 201 c0, 214 c0×2, 243 c1, 278 c0/c1, 292 i1, 392 i1           |
| 3   | `src/background/context-service.ts`                       | 20   | 91.8 (223/243) | 20    | 15      | 80 b1×2, 98 b1, 100 b1, 150 i1, 189 i0, 190 b1-2, 199 b1-2, 274 i1, 276 i1, 288 i1, 341 b1, 387 b1, 391 i0, 419 i1, 440 c1, 445 i0, 498 b2                    |
| 4   | `src/features/boards/components/BoardModal.tsx`           | 20   | 86.4 (127/147) | 15    | 14      | 65 b1, 66 b1, 68 i1, 69 b1, 70 b1, 91 i0/i1/b0/b1, 94 i0/i1/b0/b1, 114 i1, 159 i1, 192 c1×2, 413 c0, 415 c0/c1                                                |
| 5   | `src/features/tabNotes/components/TabNotesDialog.tsx`     | 19   | 88.6 (148/167) | 8     | 7       | 41 b1-2, 88 c1, 128 c1, 219 i1, 253 b1, 284 b1, 288 i1, 298 i1, 305 b1, 311 c1, 317 b1, 323 c1, 329 c1, 338 i1, 339 c1, 412 b1, 611 c0/c1                     |
| 6   | `src/features/canvas/store/slices/elementSlice.ts`        | 18   | 80.4 (74/92)   | 18    | 17      | 13, 58, 82, 106, 344 i1; 47, 71, 95, 121, 139, 201, 216, 278, 333 c1 (`: canvas`); 274 c1 (`: el`); 148, 167, 350 i0                                          |
| 7   | `src/features/boards/BoardView.tsx`                       | 16   | 82.2 (74/90)   | 12    | 10      | 85 i1, 136 i1, 157 b1, 158 c0, 202 i1, 214 i1, 269 i1, 274 b1, 277 i1, 290 c0, 298 i1, 323 b1, 373 c0, 389 c0, 394 c0, 400 c1                                 |
| 8   | `src/features/organize/store/organizeStore.ts`            | 16   | 78.9 (60/76)   | 16    | 14      | 127 i0, 139 i0, 166 i0, 172 b1, 183 i0, 192 c1, 225 i0, 230 b0/b1×2, 240 b1, 250 i0, 262 i0, 266 b1, 267 b1                                                   |
| 9   | `src/features/bookmarks/components/BookmarkModal.tsx`     | 13   | 88.8 (103/116) | 9     | 8       | 58 b1, 59 b1, 60 b1, 130 i1, 154 c0, 162 c0/c1, 177 i1, 183 i1, 212 c0, 347 c0, 349 c0/c1                                                                     |
| 10  | `src/features/bookmarks/utils/sortUtils.ts`               | 13   | 93.2 (179/192) | 11    | 10      | 84 i1, 85 b1, 122 i1, 123 b1, 156 i0, 169 i0, 170 i1, 173 i0, 178 i0/c0/c1, 183 i0, 185 i1                                                                    |
|     | **Rows 1-10**                                             | 182  |                | 143   | **126** |                                                                                                                                                               |
| 11  | `src/features/tabNotes/utils/groupTopics.ts`              | 10   | 93.4           | -     | 5       | 218 c0/c1×2, 219 b1, 254 b1, 264 b1, 275 c1, 279 b1, 356 b1, 408 b1                                                                                           |
| 12  | `src/features/tabNotes/utils/topicEdits.ts`               | 10   | 91.7           | -     | 5       | 26 b1, 38 i0, 51 b1, 128 b1, 129 b1, 136 i0, 145 b1, 153 b1, 162 i0, 311 b1                                                                                   |
| 13  | `src/features/tabNotes/utils/readPage.ts`                 | 9    | 93.0           | -     | 4       | 43 b1, 44 i1, 84 c1, 88 b1, 92 c1, 120 i0, 170 i0, 184 c1, 253 i1                                                                                             |
| 14  | `src/App.tsx`                                             | 8    | 81.0           | -     | 5       | 64 i0, 70 i0, 158 c1, 163 i0, 174 c0/c1, 186 s0, 200 s5                                                                                                       |
| 15  | `src/features/tabNotes/utils/studyNote.ts`                | 8    | 90.1           | -     | 5       | 91 c1, 164 b1, 171 i0, 174 c1, 178 i0, 179 b1, 202 i1, 217 b1                                                                                                 |
| 16  | `src/features/bookmarks/components/BookmarkNode.tsx`      | 7    | 89.1           | -     | 5       | 53, 61, 71, 78 i1, 130 b1, 141 c0, 142 c1                                                                                                                     |
| 17  | `src/features/tabNotes/utils/pageText.ts`                 | 7    | 87.3           | -     | 4       | 22 b1, 28 i0, 35 i0, 43 i1, 69 i0, 79 c1, 90 i0                                                                                                               |
| 18  | `src/features/analytics/AnalyticsDashboard.tsx`           | 6    | 82.4           | -     | 4       | 26 i1, 69 b1, 81 b1, 95 b1×2, 99 b1                                                                                                                           |
| 19  | `src/features/bookmarks/BookmarkView.tsx`                 | 6    | 90.0           | -     | 4       | 46 i0, 140 i1, 236 i1, 252 i1, 311 i1, 324 b3                                                                                                                 |
| 20  | `src/features/tabNotes/components/TopicCard.tsx`          | 6    | 89.8           | -     | 3       | 41 b1-2, 45 i0, 70 c1, 217 i1, 312 c1                                                                                                                         |
| 21  | `src/features/tabNotes/store/tabNotesStore.ts`            | 6    | 94.4           | -     | 3       | 78 i0, 177 c0/b1, 325 i0, 447 i0, 459 i0                                                                                                                      |
| 22  | `src/features/taskDraft/hooks/useCreateTaskFromTabs.ts`   | 6    | 83.3           | -     | 4       | 12 c1, 74 b1×2, 78 b1, 89 i0, 95 b1                                                                                                                           |
| 23  | `src/utils/exportFormats.ts`                              | 6    | 88.9           | -     | 5       | 53 i1, 65 i1, 66 i1, 76 b1×3                                                                                                                                  |
| 24  | `src/features/canvas/store/slices/historySlice.ts`        | 5    | 83.3           | -     | 5       | 39 c1, 55 i0, 68 c1, 83 c1, 90 c1                                                                                                                             |
| 25  | `src/features/sessions/components/PomodoroTimer.tsx`      | 5    | 88.9           | -     | 3       | 89 i1, 173 c0, 243 b1, 265 b1, 276 b1                                                                                                                         |
| 26  | `src/features/tasks/components/ParkDialog.tsx`            | 5    | 90.6           | -     | 3       | 19 b1, 20 i0, 22 b1, 70 b1, 75 i0                                                                                                                             |
| 27  | `src/routes.tsx`                                          | 4    | 86.2           | -     | 3       | 71 s9 (`pomodoro`), 106-107 s11-12 (`/`, `''`), 130 c0 (`tldraw` mode)                                                                                        |
| 28  | `src/features/organize/components/OrganizeTabsDialog.tsx` | 4    | 96.7           | -     | 2       | 34 i0, 52 b1, 89 i0, 222 c1                                                                                                                                   |
| 29  | `src/features/sessions/components/TimerManager.tsx`       | 4    | 88.2           | -     | 2       | 40, 51, 70, 107                                                                                                                                               |
| 30  | `src/features/tabNotes/utils/aiTopics.ts`                 | 4    | 96.8           | -     | 2       | 85, 141, 228, 352 i0                                                                                                                                          |
|     | **Rows 11-30**                                            | 126  |                | -     | **76**  |                                                                                                                                                               |
|     | **Total target**                                          | 308  |                |       | **202** | 5876 + 202 = 6078 / 6340 = **95.87%**. Minimum needed: +179 (6055). Margin: 23 branches.                                                                      |

#### 5.2.1 Reserve (named up front)

If the measurement after §12 step 8 is under 95.5%, the engineer adds tests from this list, in this order, before
looking anywhere else. Each item was checked against `coverage-final.json` on 2026-10-25 and is reachable with the
existing mocks. Together they hold **24 arms**.

| #   | Location                                   | Arms | Test                                                                                                                                                                                                                           |
| --- | ------------------------------------------ | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| R1  | `src/hooks/useStorageSync.ts:36`, `:79`    | 2    | A `STORAGE_*_UPDATED` upsert while the list holds other items (36 c1); hydrate items where one has no `order` (79 b1).                                                                                                         |
| R2  | `src/background/data-service.ts:62/70/71`  | 3    | An import payload that fails the check (62 i0); a payload missing a collection (70 b1) and missing `tasks` (71 b1).                                                                                                            |
| R3  | `src/store/slices/board/tabSlice.ts`       | 3    | Update an unknown tab id (38 i0), move with no matching tabs (79 i0), sort tabs without `order` (89 b1).                                                                                                                       |
| R4  | `src/utils/storage.ts:33`                  | 1    | Open a `fake-indexeddb` database created at the previous version with the store already present (33 i1): no throw.                                                                                                             |
| R5  | `src/background/storage.ts:159`            | 1    | `deleteTabs([])` returns without touching `chrome.storage.local.set`.                                                                                                                                                          |
| R6  | `src/background/tab-service.ts:102-109`    | 3    | The handler path where `chrome.tabs` returns no tab (102 i1), a tab with no title (105 b1) and no id (109 b1).                                                                                                                 |
| R7  | `src/utils/taskContext.ts:79/81`           | 3    | Pure merge: neither copy has `updatedAt` (79 b1×2); the other copy has no `context` (81 b1).                                                                                                                                   |
| R8  | `src/store/timerStore.ts:84/85/94`         | 3    | Mode switches to `work` and to `longBreak`, and resume with `remaining === 0`.                                                                                                                                                 |
| R9  | `src/store/slices/board/boardSlice.ts:156` | 2    | Delete a folder with a move target when tabs exist in that folder and in others (156 c0/c1).                                                                                                                                   |
| R10 | `BoardNode.tsx` 85 c0, 214 c0×2            | 3    | In `BoardNode.test.tsx`, `vi.mock('@dnd-kit/sortable')` / `@dnd-kit/core` so `useSortable` returns `isDragging: true` and `useDroppable` returns `isOver: true` → `opacity: 0.5`, classes `board-dragging` / `board-dropping`. |

Behind the reserve there are 17 more arms in rows 1-10 that are reachable but not counted in a target (the gap between
`reach` 143 and `target` 126).

### 5.3 Test plan per file (rows 1-10 in detail)

The general rules come from the `write-tests` skill. A fresh mock is installed per test (`src/test/setup.ts:8-10`), and
`restoreMocks: true` (`vitest.config.ts:15`) resets spies. Each test below names the arm it covers **and** what it
asserts.

**Counting rule (fixes the arm-mismatch risk).** A branch counts toward a target only if the before/after
`coverage-final.json` diff shows that arm flipped from 0 to more than 0. Before the first test commit, the engineer
writes a baseline with `npx vitest run --coverage --coverage.reporter=json --coverage.reportsDirectory=<tmp>/before`
(any directory outside the repo, so nothing is committed and `coverage/` is not overwritten). After each commit it runs
the same command into `<tmp>/after` and compares the two with a throwaway Node script kept outside the repo, for
example:

```js
// node diff-arms.cjs before/coverage-final.json after/coverage-final.json
const [a, b] = process.argv.slice(2).map(f => require(require('path').resolve(f)));
for (const [file, cov] of Object.entries(b)) {
    const old = a[file];
    if (!old) continue;
    for (const [id, hits] of Object.entries(cov.b)) {
        hits.forEach((n, arm) => {
            if (n > 0 && old.b[id][arm] === 0)
                console.log(`${file.split(/[\\/]src[\\/]/).pop()}:${cov.branchMap[id].loc.start.line} arm ${arm}`);
        });
    }
}
```

The build log lists, per commit, the arms that flipped. An arm the plan names that did not flip is reported, not
argued.

**Mocking rule (zero-warning lint).** `eslint.config.js:44` makes `no-explicit-any` a warning, and lint runs with
`--max-warnings 0`. Do not write `as any` and do not add new file-level `eslint-disable` comments. Remove a chrome
namespace with `Reflect.deleteProperty(fakeChrome(), 'sessions')`. Build partial Chrome objects with
`{ url: 'https://a.test' } as chrome.tabs.Tab`. Files that already carry a file-level disable
(`BoardInteractions.test.tsx`, `BookmarkView.test.tsx`) keep it, and new code in them still avoids `any`.

**Overriding one `chrome` call.** The mock's `tabs.query`, `tabs.get` and `tabs.create` are `vi.fn`s backed by real
state. A `mockResolvedValueOnce` is consumed by the next call, which may be a different query. Prefer
`mockImplementationOnce` (or `mockImplementation` that checks its argument and falls back to the original
implementation saved with `getMockImplementation()`).

**1. `SessionsView.tsx` → extend `src/features/sessions/__tests__/SessionsView.test.tsx`** (already uses
`installChromeMock`, `respondToMessages` and `makeSession`/`makeTab`; AI naming is mocked in `sessionNames.test.tsx`;
copy its `LanguageModel` setup and the `sessionNames` AI setting for the AI cases). Reach 20, target 18.

- Rename a session through `SessionCard` to `'  x  '` padded past `SESSION_NAME_MAX` (65 i1) → the `UPDATE_SESSION`
  payload `name` is trimmed and cut to the limit.
- ✨ Suggest with AI available (72 i1) → the suggested name is saved and the model session's `destroy` is called.
- Start from current tabs with `tabs.query` returning `[{ url: 'https://a.test' }, {}]` as `chrome.tabs.Tab[]`, AI
  available (117 b1, 145 b1×2/b2) → the stored tabs have `tabId: null`; the AI receives
  `{ title: 'https://a.test', url: 'https://a.test' }` and `{ title: '', url: '' }`.
- AI available and `tabs.query` rejecting (152 i0) → the model session's `destroy` is called and `console.error` is
  logged.
- Infer, case A: `history.search` resolves three items on one non-search domain, none with `lastVisitTime`
  (193 b1×2, 200 b1, 201 b1, 217 i0, 226 b1, 229 b1) → one `ADD_SESSION` whose `startTime` and `endTime` equal the faked
  now. Use `vi.useFakeTimers({ toFake: ['Date'] })` and `vi.setSystemTime`.
- Infer, case B: three visits to one domain, each 2 h apart (208 i1) → no session for that domain.
- Infer with `chrome.sessions` removed via `Reflect.deleteProperty` (248 i1) → only the history sessions are sent, no
  `console.error`.
- Restore a session whose tab ids are `tab_1_42`-style and missing from the store: `tabs.get` resolves `undefined`
  (335 i1) → no `ADD_TAB`, toast `Restored 0 tabs`. `tabs.get` resolves `{ url: 'https://a.test' }` and then `{}`
  (338 b1/b2, 339 b1) → the stored tabs have `title: 'https://a.test'` and `title: '', url: ''`.
- **Not targeted (accepted misses):** 65 i0 (`SessionCard.tsx:27` only calls `onRename` with a non-blank name), 72 i0
  (`onSuggestName` is only passed when `canNameWithAi`, `SessionsView.tsx:387`, and `startAiNaming` reads the same
  render's value at `:48`), 77 i0 (`CreateSessionForm.tsx:13` already filters blanks), 289 i1 (`endSession` only gets
  ids from the rendered list), 223 i1 (dead, §5.5). These are defensive duplicates of child-component guards; do not
  remove them.

**2. `BoardNode.tsx` → new `src/features/boards/components/__tests__/BoardNode.test.tsx`.** Render `<BoardNode>` inside
`<DndContext><SortableContext items={[tab.id]}>` (the same wrappers `BoardView` uses). Pass only the callbacks each
test needs. Use `makeTab`/`makeFolder`, and `vi.spyOn(window, 'confirm')`. Reach 14, target 13.

- Edit a tab with no `onUpdateTab` (110 i1) → submitting the edit modal calls no callback and shows the success toast.
- Click a tab without `onOpenTab` (123 i1), and click its 🔗 button (292 i1) → no throw and nothing opened.
- Delete: empty folder with `confirm` → false (139 i1) → `onDeleteFolder` not called. Tab without `onDeleteTab`
  (143 i1) → `confirm` not shown. Tab with `confirm` → false (144 i1) → `onDeleteTab` not called.
- Force delete: a folder with tabs and `onDeleteFolder`, click 🗑️, then the `FolderDeleteModal` force-delete button
  (161 i0/b0/b1) → `onDeleteFolder` called with the folder id, and the info toast
  `Deleted folder "<name>" and <n> tabs`. (The b1 arm is the `onDeleteFolder` operand, which runs whenever `folder` is
  set; line 151, driven the same way by the move-and-delete path, already shows b0/b1 covered and only i1 missing.)
- Keyboard: press `Escape` on the node (183 i1) → no callback called, `aria-expanded` unchanged.
- Theme: set `data-theme="dark"` on `document.documentElement` and render a coloured folder (201 c0) → the inline
  `background` contains `rgba(31, 41, 55, 0.6)`. Remove the attribute in `afterEach`.
- Folder without `color` (243 c1) → the folder icon has no inline style.
- Invalid URL `'not a url'` (278 c1) → shown as is. A 60-character invalid URL (278 c0) → its first 50 characters
  followed by `...`.
- **Not targeted:** 85 c0 and 214 c0×2 need `isDragging`/`isOver` (reserve R10 covers them with a dnd-kit hook mock).
  151 i1 and 161 i1 (`FolderDeleteModal` only renders for a folder, and opens only when `onDeleteFolder` exists),
  168 i1 (the copy button only renders when a url exists), 189 b1 (needs a node with neither `tab` nor `folder`),
  392 i1 (the add-tab button only renders with `onCreateTab`, and the modal blocks an empty title or url). These narrow
  optional props; do not remove them.

**3. `context-service.ts` → extend `src/background/__tests__/context-service.test.ts`** (already does
`mock = installChromeMock()`, `vi.resetModules()` and a dynamic import, and reads `mock.browser.store`). Drive it with
`chrome.runtime.onMessage` messages `TASK_CONTEXT_*`, as the file already does. Use
`vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })` for the 300 ms busy guard and the 1500 ms snapshot
debounce (`context-service.ts:28`). All 20 arms are reachable; target 15 leaves room for the two hardest (445, 189).

- `resolveTask` when neither copy has `updatedAt` (80 b1×2) → the UI copy's fields are used and the stored context
  wins. Build tasks with `makeTask({ updatedAt: undefined })`.
- A captured tab with only `pendingUrl` and no title (98 b1, 100 b1, 387 b1 in remove) → the saved context tab is
  `{ url: pendingUrl, title: pendingUrl }`; removing it by that url ungroups it.
- Park with `closeTabs` where the context has no `windowId` (150 i1) → `tabs.remove` called, no
  `tabs.query({ windowId })`.
- Park where the live group query returns a tab with no `id` (189 i0) and tabs with only `pendingUrl` or no url at all
  (190 b1/b2) → the id-less tab is not closed, the others are.
- Create and park with `chromeTabIds` where `tabs.get` returns one tab with only `pendingUrl` and one with neither
  (199 b1/b2) → only the tab whose url is in the context is closed.
- Start an already-active task whose live group query returns `[]` (274 i1), or a first tab with no `windowId`
  (276 i1) → no `tabs.update` / no `windows.update`, reply `{ success: true }`.
- Start where `tabs.create` resolves a tab without an id (288 i1) → no `tabs.group`, stored `chromeGroupId: null`.
- `addTabsToTask` with explicit `chromeTabIds` while another task is active with `chromeGroupId: undefined` (341 b1) →
  a tab from a plain group is accepted.
- Remove the only tab of the live group (391 i0) → stored `chromeGroupId` is `null`.
- Delete the active task whose group exists but has no tabs (419 i1) → no `tabs.ungroup`.
- Stored active id points at a parked task (440 c1) → a tab created in that window is not grouped.
- Snapshot while busy (445 i0): emit a `tabs.onUpdated` (schedules the snapshot), advance 1400 ms, send a
  `TASK_CONTEXT_*` that sets the busy guard, advance past 1500 ms → no save yet; advance past the guard and the next
  debounce → the stored tabs match the group.
- `tabs.onCreated` with neither `url` nor `pendingUrl` (498 b2) → it is added to the active group.

**4. `BoardModal.tsx` → extend `src/features/boards/__tests__/BoardInteractions.test.tsx`** (it already renders
`<BoardModal>` directly at lines 115-245). Reach 15, target 14.

- Edit a folder with `name: ''` and no `color` (65-66 b1) → the inputs show `''` and `#3b82f6`. Edit a tab with
  `title: ''` and `url: ''` (69-70 b1) → both inputs are empty. Edit with `type="tab"` and no `tab` prop (68 i1) → the
  inputs keep their empty create values.
- Focus timer: render under `vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })`, then
  `act(() => vi.advanceTimersByTime(100))` → for a folder (91 i0/b0/b1) `document.activeElement` is the name input; for
  a tab (91 i1, 94 i0/b0/b1) it is the title input. Use `fireEvent`, not `user-event`, in these tests.
- Mousedown on the dialog body, not the overlay (114 i1) → `onClose` not called.
- An `onSubmit` that throws in edit mode for a tab (192 c1×2) → the error toast reads
  `Failed to update tab. Please try again.`
- **Not targeted:** the spinner (413 c0, 415 c0/c1). `handleSubmit` sets `isSubmitting` true, calls `onSubmit`
  (not awaited), `onClose`, and resets it in `finally`, all in one synchronous handler, so React never commits
  `isSubmitting: true`. 94 i1 (the title input always exists when `type` is `tab`). 159 i1 (only reachable by closing
  the modal before its 0 ms focus timer fires; a test for it would assert nothing useful).

**5. `TabNotesDialog.tsx` → extend `src/features/tabNotes/components/__tests__/TabNotesDialog.test.tsx`** (use
`helpers.ts` in the same folder, and seed `useTabNotesStore.setState` for review states). Reach 8, target 7.

- Remove a source with `title: ''` and an unparseable url (41 b1-2, via `onRemoveSource` at `:338`) → the live region
  reads `Removed Untitled page from the note`.
- Seed two shared topics with the same point set (88 c1) → both render and no duplicate-key warning
  (`console.error` spy not called).
- In the picker, select a tab that starts unselected (219 i1) → its checkbox becomes checked.
- Remove a bullet that sits in the second combined topic (288 i1) → focus moves to the bullet at the same position in
  that topic.
- A finished run with `modelStatus: 'Model unavailable'` (412 b1) → that text is shown.
- Overlay click while picking (611 c0) → the dialog closes. While reviewing (611 c1) → it stays open.
- Try, not counted: focus an `<svg tabindex="0">` before render (128 c1) → after close, no throw and focus is not
  restored to it. If jsdom keeps `document.body` active, accept the miss.
- **Not targeted:** 253 b1 (`draftOf` always returns an array, `tabNotesStore.ts:542`), 284 b1, 305/311/317/323/329
  and 338/339 (only reached for ids that are not in the rendered topics or sources), 298 i1 (`TopicCard.tsx:89` only
  calls rename when the cleaned heading changed).

**6. `elementSlice.ts` → extend `src/features/canvas/__tests__/canvasStore.test.ts`** (it has `seed`, `store` and
`makeElement` from `canvasFactories.ts`). Reach 18, target 17.

- `describe('with a stale active canvas id')`: set `activeCanvasId` to an id that matches no canvas (not `null`:
  `addElement` returns at `:9` on a null id before reaching `:13`). Call `addElement`, `deleteElement`,
  `deleteElements`, `bringToFront` and `reorderElement` (13, 58, 82, 106, 344 i1) → `canvases` is unchanged and
  `store().history` stays `{}`.
- `describe('with two canvases')`: seed two canvases with elements and make the second active. Run `updateElement`,
  `deleteElement`, `deleteElements`, `bringToFront`, `sendToBack`, `groupElements`, `ungroupElements`, `alignElements`,
  `distributeElements` (47, 71, 95, 121, 139, 201, 216, 278, 333 c1) and `bringForward`, `sendBackward`,
  `reorderElement` (148, 167, 350 i0: the `canvas.canvasId !== activeCanvasId` skip) → the inactive canvas object is
  referentially unchanged (`toBe`).
- `alignElements('left')` with two selected and one unselected element on the active canvas (274 c1) → the unselected
  element is the same object (`toBe`), and the selected ones share `x`.

**7. `BoardView.tsx` → extend `src/features/boards/__tests__/BoardInteractions.test.tsx`** for the drag cases (it already
captures `DndContext` props with `vi.mock('@dnd-kit/core')` and has a `drag()` helper, lines 11-29) and
`BoardView.test.tsx` for the rest. Reach 12, target 10.

- Create a tab from the header with "No Folder (Top Level)" and two tags (157 b1, 158 c0) → the stored tab has
  `folderId: ''` and `tags` equal to the two tags.
- After render, `Reflect.deleteProperty(fakeChrome(), 'tabs')`, then open a tab (202 i1) → no throw, no `console.error`.
- Drag between two unfiled tabs (`folderId: ''`) (269 i1) → order unchanged, no `reorderTab`.
- Drag a filed tab onto an unfiled tab (274 b1) → the dragged tab's `folderId` becomes `''`, toast `Tab moved to folder!`.
- Drag a tab onto an id that is neither a tab nor a folder (277 i1) → tabs unchanged.
- Drag overlay: add `DragOverlay: ({ children }) => <div data-testid="drag-overlay">{children}</div>` to the existing
  `vi.mock('@dnd-kit/core')` factory, then call only `dnd.onDragStart` in its own `act` (290 c0, 373 c0) → the overlay
  shows the tab's title and url. Start a history-item drag with a `favicon` (389 c0, 394 c0) → an `img` with that src;
  without one (400 c1) → the 🌐 default icon. End each drag with `dnd.onDragEnd({ ..., over: null })` → the overlay is
  empty.
- A current board with `name: ''` (323 b1) → the header shows `Default Board`.
- Try, not counted: 85 i1 (a board arrives while the 500 ms default-board timer runs). It needs
  `useBoardStore.setState({ boards: [board] })` and `vi.advanceTimersByTime(500)` in one `act`, before React commits
  the re-render whose cleanup (`:94`) clears the timer. Assert no `ADD_BOARD` is sent.
- **Not targeted:** 136 i1 (`currentBoard` falls back to an object with `id: 'default_board'`, `:63-71`), 214 i1
  (dnd-kit always passes `active`), 298 i1 (`BoardHeader.tsx:241` always renders the search input).

**8. `organizeStore.ts` → extend `src/features/organize/store/__tests__/organizeStore.test.ts`.** All 16 reachable,
target 14.

- Close while the start is in flight, then let `getOrganizableTabs` reject (127 i0) → phase stays `closed`, no `error`.
- `toggleGroup` / `removeTab` with no proposal (139, 225 i0) → state unchanged.
- Close during `getOrganizableTabs` with a deferred `tabs.query` (166 i0) → `tabs` stays `[]`.
- Start when the current window id is `undefined` (172 b1) → `windowId: null`.
- `retryWithAi` with no tabs (183 i0) → nothing happens. After a site-grouping start (`considered` is `[]`),
  `retryWithAi` (192 c1) → the AI receives the first `MAX_TABS_FOR_AI` tabs.
- `removeTab` with a non-empty `ungroupedTabIds` (230 b0×2) → the result is ordered by tab position; seed an ungrouped
  id that is not in `tabs` (230 b1×2) → it sorts as position 0.
- `removeTab` from a group that keeps ≥ `MIN_TABS_PER_GROUP` tabs (240 b1) → `enabled` keeps its previous value.
- `apply` with no proposal or `windowId === null` (250 i0) → no message sent.
- `respondToMessages(() => undefined)` for apply (262 i0) → toast `Couldn't create groups: The background service did
not respond`, phase `preview`.
- A reply without `created` / `skippedTabIds` (266-267 b1) → both are `[]`.

**9. `BookmarkModal.tsx` → new `src/features/bookmarks/components/__tests__/BookmarkModal.test.tsx`**, using the same
approach as row 4. Reach 9, target 8.

- Edit a bookmark with no title, url or `parentId` (58-60 b1) → the inputs are empty.
- Edit a folder and submit (154 c0) → toast `Folder updated successfully!`.
- An `onSubmit` that throws while editing a folder (162 c0/c1) → toast `Failed to update folder. Please try again.`
- Press a key other than Escape (177 i1) and mousedown on the dialog body (183 i1) → `onClose` not called.
- Create mode with `isFolder` (212 c0) → the heading reads `Create Folder`.
- The bookmark type comes from `src/types/index.ts` `Bookmark`. If it helps, add a small `makeBookmark` to
  `src/test/factories.ts` (allowed: AC 5 counts `src/test/**` as test code).
- **Not targeted:** the spinner (347 c0, 349 c0/c1), same synchronous structure as BoardModal
  (`BookmarkModal.tsx:139-167`); 130 i1 (same as BoardModal 159 i1).

**10. `sortUtils.ts` → extend the `describe('sortUtils')` block in
`src/features/bookmarks/utils/__tests__/bookmarkUtils.test.ts:158`.** Pure functions with table tests; assert the exact
id order. Reach 11, target 10.

- `sortBookmarksByDateAdded` / `ByDateModified` with two undated items, one with no title (85 b1, 123 b1) → the untitled
  one sorts first (`''` before any name).
- `sortBookmarksByDomain`: two folders, the first untitled (156 i0) → the untitled one last. Two bookmarks whose url is
  `'   '` (empty domain), one untitled (169 i0), both titled (170 i1). One `'   '` url against a real domain (173 i0) →
  the empty domain last. Three real domains given in descending order, sorted `asc` and `desc` (178 i0/c0/c1). Same
  domain with both titles empty (183 i0) and both titled (185 i1).
- **Not targeted:** 84 i1 and 122 i1 (only reachable with negative timestamps).

### 5.4 Rows 11-30, briefly

These rows are not verified arm by arm. Their targets (76 in total) are set at about 60% of the misses, and the
counting rule in §5.3 applies. Arms that turn out to be type-narrowing guards go in the build log as accepted misses.

| File                                                                                           | Approach (existing test file)                                                                                                                                                                                                                                                                                                                                                                       |
| ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `groupTopics.ts`, `topicEdits.ts`, `studyNote.ts`, `pageText.ts`, `readPage.ts`, `aiTopics.ts` | Pure functions. Add table cases to the existing `src/features/tabNotes/utils/__tests__/*.test.ts`: text with no words, ties in `mostFrequent`, sources with no title, a source without a url (`[ref]` with no link), a topic whose bullets are all empty, a too-long sentence with no space (pageText 79), a non-Error injection failure (readPage 184), a malformed snapshot block (readPage 170). |
| `App.tsx`                                                                                      | Extend `src/__tests__/App.test.tsx`: mount at `#/` (64), an import that throws a non-Error (158, 174), and search results of type `tab` and `bookmark` (186, 200).                                                                                                                                                                                                                                  |
| `BookmarkNode.tsx`, `BookmarkView.tsx`                                                         | `src/features/bookmarks/__tests__/BookmarkView.test.tsx` plus the new BookmarkModal test file: `confirm` → false, `chrome.bookmarks` removed with `Reflect.deleteProperty`, a long url, a folder with no children, a non-default sort.                                                                                                                                                              |
| `AnalyticsDashboard.tsx`                                                                       | Render with tasks created and sessions started inside the chart range (69, 81), tasks with no `completedSessions` (95, 99: the zero fallback), and a session with no `endTime` (26).                                                                                                                                                                                                                |
| `TopicCard.tsx`, `tabNotesStore.ts`                                                            | Existing `TopicCard.test.tsx` / store tests: a source without a title or host, the move-to select set back to empty (217), and edit actions called while `status` is `running` (447, 459).                                                                                                                                                                                                          |
| `useCreateTaskFromTabs.ts`                                                                     | Existing taskDraft hook tests: a background reply without `task` (74), a context without tabs (78, 95), a non-Error rejection (12).                                                                                                                                                                                                                                                                 |
| `exportFormats.ts`                                                                             | Existing export tests: a task whose saved tab is missing, no note, no summary, folders without `order`.                                                                                                                                                                                                                                                                                             |
| `historySlice.ts` (canvas)                                                                     | `canvasStore.test.ts`: undo/redo with two canvases, redo with an empty future, `canUndo`/`canRedo` with no history for the canvas.                                                                                                                                                                                                                                                                  |
| `PomodoroTimer.tsx`, `TimerManager.tsx`                                                        | `src/features/sessions/__tests__/Pomodoro.test.tsx` with fake timers.                                                                                                                                                                                                                                                                                                                               |
| `ParkDialog.tsx`                                                                               | `src/features/tasks/__tests__/TaskViews.test.tsx` (where ParkDialog is tested today): no open tabs, no note, and the AI summary disabled.                                                                                                                                                                                                                                                           |
| `routes.tsx`                                                                                   | New `src/__tests__/routes.test.tsx` (no routes test exists): `viewToPath('pomodoro')`, `pathToView('/')` and `pathToView('')` (pure). Canvas `tldraw` mode: set `localStorage.tabboard_canvas_mode = 'tldraw'` and mock `TldrawContainer`.                                                                                                                                                          |
| `OrganizeTabsDialog.tsx`                                                                       | `src/features/organize/__tests__/OrganizeTabsDialog.test.tsx`: two of the four arms.                                                                                                                                                                                                                                                                                                                |

### 5.5 Dead-code candidates (for the optional `refactor` commit, D4)

These were found while building this spec. The engineer confirms each one, and the code reviewer approves each removal.

| Location                      | Why it is unreachable                                                                                                                                                                                                 | Removal                                                                  |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `SessionsView.tsx:223`        | `clusters` only receives arrays of 2 or more (`:208-211`, `:217-219`), so `if (cluster.length >= 2)` is always true.                                                                                                  | Drop the `if`, keep its body. −2 branches (1 covered, 1 not).            |
| `hooks/useTheme.ts:20`, `:30` | `typeof window !== 'undefined'` in a hook. The same hook uses `window` unguarded at `:38`. The only non-hook importer is `utils/exportImport.ts:7`, which imports a constant. No `src/background/**` file imports it. | Drop each guard and its fallback return. −4 branches (2 covered, 2 not). |

Removing code is optional, and the plan reaches 95.5% without it. Do not remove the accepted misses listed in §5.3
(child-component duplicates and type-narrowing guards such as BoardNode 151/161/168 and `context-service`
`tab.id === undefined`). For any further candidate the bar is the same: provably unreachable, behaviour-neutral and
type-safe, with a one-line justification in the build log.

## 6. Data, storage and migration

None. No types in `src/types/index.ts`, no `DB_VERSION` change, no stores, no stored data. Tests use `fake-indexeddb`
(reset per file) and the in-memory `chrome.storage` mock.

## 7. Message and sync

No new or changed messages. Tests that drive `STORAGE_*` or `TASK_CONTEXT_*` must assert the echo rules, not just call
the code. For example, after a silent upsert, `respondToMessages` received no message. For async handlers, `sendResponse`
is called exactly once (`respond.test.ts` has the pattern).

## 8. Permissions, privacy and docs

- `manifest.json`: no change. `PRIVACY.md`, `CHROMEWEBSTORE.md`: no change, so `npm run build:privacy` is not needed.
- Living docs to update in the `docs:` commit (from `git grep -n "85"`). The two `.claude/agents/*.md` rows exist on
  `develop` once the D1 gate is passed.

| File                                  | Line(s) | New text (gist)                                                                                                           |
| ------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------- |
| `CLAUDE.md`                           | 30      | `fails under 95% statements/branches/functions/lines`                                                                     |
| `CLAUDE.md`                           | 45      | `Coverage gate is 95% on logic and key UI.`                                                                               |
| `CLAUDE.md`                           | 114     | skills table: `coverage under 95%`                                                                                        |
| `README.md`                           | 376     | `with the 95% coverage gate CI enforces`                                                                                  |
| `ROADMAP.md`                          | 189     | `✅ **95% coverage gate** (statements, branches, functions, lines) in CI`                                                 |
| `ROADMAP.md`                          | 341     | `≥ 95% coverage gate`, and refresh the stale `831 tests in 57 files` to the count at delivery                             |
| `docs/MAINTENANCE_GUIDE.md`           | 71      | `fails below 95% for …`                                                                                                   |
| `.claude/skills/verify/SKILL.md`      | 3, 15   | `95% coverage gate`, `fails below 95%`                                                                                    |
| `.claude/skills/write-tests/SKILL.md` | 3, 36   | `coverage drops under 95%`, `(95% gate)`                                                                                  |
| `.claude/agents/architect.md`         | 33      | `respect the 95% gate`                                                                                                    |
| `.claude/agents/spec-challenger.md`   | 25      | `Is the 95% gate realistic?`                                                                                              |
| `.github/workflows/ci.yml`            | 37      | step name `Unit tests (95% coverage gate)`. This is a label only. It goes in the `chore:` commit with `vitest.config.ts`. |

- Line numbers are from 2026-10-25; re-check them with `git grep -n "85"` after the D1 merge.
- Not changed: the implemented specs listed in D7.
- After the edits, this returns nothing:
  `git grep -n "85%" -- CLAUDE.md README.md ROADMAP.md docs/MAINTENANCE_GUIDE.md .claude .github`

## 9. Edge cases

- **Rounding**: vitest compares the unrounded percentage against the threshold. 95.5% at delivery leaves about 32
  branches of headroom over 95.0% (6055 vs 6023).
- **Denominator changes**: a dead-code removal or a concurrent merge into `develop` changes the totals. Re-measure on the
  final rebased branch. G1 and AC 1 use the final run.
- **Concurrent feature on `develop`**: if a merge into `develop` lowers branches, rebase and re-measure. If it lands
  under 95.5, use the reserve (§5.2.1).
- **Flakiness**: no real-time waits over 0 ms. Fake timers are installed per test and restored in `afterEach`
  (`vi.useRealTimers()`). `flushPromises` (`chromeMock.ts:534`) uses `setTimeout`, so with `setTimeout` faked use
  `await vi.advanceTimersByTimeAsync(0)` instead. Don't combine `user-event` with fake timers unless you pass
  `advanceTimers`. Ids built from `Date.now()` (SessionsView) can collide inside one tick, so assert by name or count,
  not by id. Namespaces a test deletes (`chrome.sessions`, `chrome.tabs`) come back because the mock is reinstalled per
  test. `data-theme` must be reset in `afterEach`; `localStorage` is cleared in `setup.ts:14`.
- **Module-level `vi.mock`**: adding `DragOverlay` to the `vi.mock('@dnd-kit/core')` factory in
  `BoardInteractions.test.tsx` applies to every test in that file. It renders children only when BoardView passes them
  (an active tab or history item), so the existing tests are unaffected; run the file alone once to confirm.
- **Worker restart / multi-tab / import-export**: no behaviour change. The existing tests stay as they are.
- **Windows checkout**: run prettier only on changed files (user memory), so untouched files don't get CRLF rewrites.

## 10. Files

**Create**

- `src/features/boards/components/__tests__/BoardNode.test.tsx`
- `src/features/bookmarks/components/__tests__/BookmarkModal.test.tsx`
- `src/__tests__/routes.test.tsx`
- More `__tests__/*.test.ts(x)` files next to reserve files where none exists

**Modify (tests)**

- `src/__tests__/App.test.tsx`
- `src/features/sessions/__tests__/SessionsView.test.tsx`, `Pomodoro.test.tsx`
- `src/features/analytics/__tests__/AnalyticsDashboard.test.tsx`, `src/utils/__tests__/exportFormats.test.ts`
- `src/features/taskDraft/hooks/__tests__/useCreateTaskFromTabs.test.tsx`
- `src/features/tasks/__tests__/TaskViews.test.tsx`
- `src/background/__tests__/context-service.test.ts`
- `src/features/boards/__tests__/BoardInteractions.test.tsx`, `BoardView.test.tsx`
- `src/features/tabNotes/components/__tests__/TabNotesDialog.test.tsx`, `TopicCard.test.tsx`
- `src/features/tabNotes/store/__tests__/tabNotesStore.test.ts`
- `src/features/canvas/__tests__/canvasStore.test.ts`
- `src/features/organize/store/__tests__/organizeStore.test.ts`, `src/features/organize/__tests__/OrganizeTabsDialog.test.tsx`
- `src/features/bookmarks/utils/__tests__/bookmarkUtils.test.ts`, `src/features/bookmarks/__tests__/BookmarkView.test.tsx`
- `src/features/tabNotes/utils/__tests__/{groupTopics,topicEdits,readPage,studyNote,pageText,aiTopics}.test.ts`
- Reserve only (§5.2.1): the existing tests of `useStorageSync`, `data-service`, `tabSlice`, `boardSlice`,
  `utils/storage`, `background/storage`, `tab-service`, `taskContext`, `timerStore`
- `src/test/factories.ts` (optional additive `makeBookmark`)

**Modify (config and docs)**: `vitest.config.ts`, `.github/workflows/ci.yml` (step name), plus the files in §8.

**Modify (product, optional, separate commit)**: `src/features/sessions/SessionsView.tsx`, `src/hooks/useTheme.ts` (§5.5).

**Not committed**: the baseline/after coverage JSON and the arm-diff script (§5.3) live outside the repo.

## 11. Tests and verification (traceability)

| Brief AC / goal                                      | Design element          | How it is checked                                                                                                                                                                                     |
| ---------------------------------------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC 1: branches ≥ 95.0 (G1: ≥ 95.5 at delivery)       | §5.2-5.4 tests, reserve | `npm run test:coverage` → `coverage/coverage-summary.json` `total.branches.pct` ≥ 95.5. The build log quotes covered/total.                                                                           |
| AC 2: no metric drops below 97.58 / 98.36 / 97.09    | Tests only add coverage | The same summary: `statements.pct` ≥ 97.58, `lines.pct` ≥ 98.36, `functions.pct` ≥ 97.09.                                                                                                             |
| AC 3: thresholds 95, and the gate fails below 95     | §5.1                    | Check V1 and V2 below. Paste both outputs.                                                                                                                                                            |
| AC 4: no new excludes or ignore comments             | D5, non-goals           | Check V3 below (baseline: no output).                                                                                                                                                                 |
| AC 5: diff limited to tests, config and docs         | §10, D1, D4             | `git diff --stat develop...HEAD`: only `__tests__/`, `src/test/**`, `vitest.config.ts`, `.github/workflows/ci.yml` (label), the §8 docs and the spec, plus the files of the `refactor` commit if any. |
| AC 6: every test asserts behaviour                   | §5.3 "asserts" per case | Code reviewer samples ≥ 10 new tests across ≥ 5 files. Check V4 below is reported, and no new `it` has zero `expect`.                                                                                 |
| AC 7: top-10 before and after with branch %          | §5.2 table (before)     | The build log repeats the §5.2 top-10 rows with the after-numbers from `coverage/coverage-final.json`, plus the per-commit flipped arms (§5.3 counting rule).                                         |
| AC 8: full verify and 3 clean `npm test` runs        | §12 step 12             | The `verify` skill (typecheck, lint 0 warnings, format:check, build:privacy --check, test:coverage, build, check:bundle), then check V5 below, all green.                                             |
| AC 9: docs say 95%                                   | §8 table                | The `git grep` at the end of §8 returns nothing for the living docs.                                                                                                                                  |
| G1 answer 3: dead code only in a reviewed `refactor` | D4, §5.5                | `git log develop..HEAD --format=%s` shows at most one `refactor(no-release):` commit touching only §5.5 files. The code-reviewer verdict names each removal.                                          |

Verification commands (kept out of the table so their pipes stay intact):

```bash
# V1 (AC 3): only the four numbers change
git diff develop -- vitest.config.ts

# V2 (AC 3): the gate really fails below its threshold; expect "does not meet global threshold (99%)" and a non-zero exit
npx vitest run --coverage --coverage.thresholds.branches=99

# V3 (AC 4): no ignore comments anywhere, and no exclude lines in the config diff
git grep -nE "v8 ignore|istanbul ignore|c8 ignore" -- src scripts
git diff develop -- vitest.config.ts | grep -n "exclude"

# V4 (AC 6): added lines only
git diff -U0 develop...HEAD -- '*.test.*' | grep -c '^+.*expect('
git diff -U0 develop...HEAD -- '*.test.*' | grep -cE '^\+.*\bit\('

# V5 (AC 8): three clean runs in a row
for i in 1 2 3; do npm test || exit 1; done
```

E2E: none added (non-goal), and the existing suite does not need to run when only tests, config and docs change. If the
`refactor` commit lands, run `npm run build && npm run test:e2e` once, and the G3 human checklist adds:

- Sessions → **Infer** still creates sessions from history (exercises `SessionsView.tsx` inference).
- The theme toggle persists across a page reload, in both light and dark (exercises `useTheme.ts`, used by
  `App.tsx:11`, `SettingsView.tsx:2` and `ThemeToggle.tsx:2`).

## 12. Implementation order

Each commit must pass `npm run test:coverage` under the 85 gate that is still in place, plus lint and format. None of
these commits triggers a release: the commit-analyzer's custom `releaseRules` in `.releaserc.json` only cover
`refactor`, `perf` and the `no-release` scope, and the conventionalcommits defaults only bump `feat`, `fix`, `perf` and
breaking changes, so `test`, `chore`, `docs` and `ci` match no rule. (The `hidden` flags in the release-notes
`presetConfig` only affect the changelog.)

0. **Hard gate (D1), human action.** Push `chore/agentic-workflow` (not on `origin` yet), open its PR into `develop`,
   and merge it. Then the orchestrator runs `git switch develop && git pull` and `git switch -c feature/coverage-95`.
   This spec file is untracked on the tooling branch today; it carries over in the working tree and is committed on
   the feature branch as `docs(specs): add coverage-95 spec` (cycle step 4).
1. Baseline: `npx vitest run --coverage` into a directory outside the repo (§5.3). Record the top-10 "before" rows in
   `04-build-log.md`.
2. `test(bookmarks): cover sort fallbacks, modal errors and missing callbacks`: rows 9, 10, 16, 19.
3. `test(canvas): cover element and history actions with a stale or another active canvas`: rows 6, 24.
4. `test(boards): cover board node, modal and view edge paths`: rows 2, 4, 7.
5. `test(sessions): cover session naming, inference and restore fallbacks`: rows 1, 25, 29.
6. `test(background): cover context-service fallbacks for tabs without ids or urls`: row 3.
7. `test(organize): cover organize store guards and empty replies`: rows 8, 28.
8. `test(tabnotes): cover tab-notes utils and dialog fallbacks`: rows 5, 11-13, 15, 17, 20, 21, 30.
9. `test: cover app routing, analytics, export and task-draft fallbacks`: rows 14, 18, 22, 23, 26, 27.
   Then measure. If branches are under 95.5%, add reserve tests from §5.2.1 in order (R1, R2, …) in one or more
   further `test:` commits until it is.
10. Optional: `refactor(no-release): remove unreachable branches in SessionsView and useTheme`. This is the only
    product change. Run e2e once (§11).
11. `chore: raise the coverage gate to 95% on all metrics`: `vitest.config.ts` and the `ci.yml` step name.
12. `docs: state the 95% coverage gate`: the §8 files. Then verify (AC 8): the `verify` skill in full and check V5.
    Finish `04-build-log.md`: before and after top-10, global numbers, flipped arms per commit, the AC 3 failure proof,
    the dead-code decisions, and each targeted arm left uncovered with a one-line reason.

**Roles (D9).**

- **frontend-engineer** (`/cycle` step 4): owns steps 1-12, including the step 9 "measure, then reserve" decision and
  the AC 7 table. Tests are part of its work; product code changes only in step 10.
- **unit-test-writer** (step 5): an independent pass after the engineer. It re-measures, checks the build log's
  flipped arms against its own diff, samples AC 6 (≥ 10 tests, ≥ 5 files), and adds `test(...)` commits for any gap it
  finds in what is left (rows 31+ or untargeted reachable arms). It does not own the 95.5% number. If it finds the
  number under 95.5% or a test that asserts nothing, it reports `VERDICT: FIX`, and the engineer fixes it; the 2-round
  cap applies.
- e2e-test-writer and browser-tester: skipped (D8, §13 Q2). G3 still happens.

## 13. Open questions

1. **D1 gate: merge `chore/agentic-workflow` first** (needs a human). There is no alternative in this spec any more
   (see D1 for why branching from today's `develop` breaks the cycle). The human pushes the branch, opens and merges
   its PR into `develop`, then tells the orchestrator to start step 4.
2. **Skip the e2e-test-writer and browser-tester stages** (needs a human, since it changes the `/cycle` flow). The
   recommendation is yes, because nothing changes in the browser. The G3 human check (`07-human-signoff.md`) can be a
   short "extension still loads" check, plus the two §11 lines if the `refactor` lands.
3. **Implemented specs that say 85%** (D7). The recommendation is to leave them as historical records. If you want AC 9
   read literally, add one line to each spec's DoD saying "(gate raised to 95% by COVERAGE_95)" rather than rewriting
   the number.
4. **`refactor(no-release)` scope.** `.releaserc.json:11` sets `{ "scope": "no-release", "release": false }`. In
   `@semantic-release/commit-analyzer/lib/analyze-commit.js` both the `refactor` rule (`patch`) and this rule match;
   `compareReleaseTypes('patch', false)` keeps `false`, and `index.js:64` then skips the default rules, so the commit
   triggers no release. `npm run release:dry` cannot confirm this on `develop` (`.releaserc.json` has
   `"branches": ["main"]`, so semantic-release stops before analysing commits). If a check is wanted, run once
   `npx semantic-release --dry-run --no-ci --branches develop` with the release tags fetched (`git fetch --tags`).
   The recommendation is to use the scope and rely on the code reading above.

## 14. Definition of done

- [x] D1 gate passed: `chore/agentic-workflow` merged into `develop` before `feature/coverage-95` was cut.
- [x] `coverage/coverage-summary.json` on the final branch: branches ≥ **95.5%**, statements ≥ 97.58, lines ≥ 98.36,
      functions ≥ 97.09 (AC 1, AC 2, G1).
- [x] `vitest.config.ts` thresholds are 95/95/95/95. `exclude` is unchanged. V2 fails as expected (AC 3, AC 4).
- [x] V3 finds no `v8 ignore`, `istanbul ignore` or `c8 ignore` in `src/` or `scripts/` (AC 4).
- [x] `git diff --stat develop...HEAD` touches only tests, `src/test/**`, `vitest.config.ts`, the `ci.yml` label, the
      §8 docs, the spec, and (optionally) the §5.5 files in one `refactor(no-release):` commit approved by the code
      reviewer (AC 5, G1 answer 3).
- [x] Every new `it` has a behavioural `expect`, confirmed by the unit-test-writer's and the code reviewer's samples
      and by V4 (AC 6). No `as any`, no new `eslint-disable`.
- [x] `04-build-log.md` has the top-10 before/after table, global numbers, flipped arms per commit, and the reasons for
      targeted arms left uncovered (AC 7).
- [x] `verify` passes: typecheck, lint (0 warnings), format:check, `build:privacy -- --check`, test:coverage, build,
      check:bundle. V5 passes (AC 8).
- [x] The §8 `git grep` finds no "85%" in the living docs (AC 9).
- [x] If the `refactor` landed: e2e ran once, and G3 covered Infer sessions and theme persistence (§11).
- [x] Commits follow §12 types. Nothing user-facing, so `CHROMEWEBSTORE.md` and `PRIVACY.md` are untouched.

Final numbers: branches 96.38% (6111/6340), statements 98.48%, functions 97.67%, lines 98.89%. The per-file
JSON used for the top-10 table comes from `--coverage.reporter=json`, not from a plain `npm run test:coverage`.

## Challenge response

Each finding from `.claude/work/coverage-95/03-challenge.md` was fixed; none is rebutted.

- **C1** Fixed. Every arm in §5.3 rows 1-10 was re-checked against the source and a fresh `coverage-final.json`.
  Corrected: BoardNode 85 is `opacity: isDragging` (moved to reserve R10); elementSlice uses a stale id, not `null`;
  148/167/350 are the non-active-canvas skip, covered by the two-canvas test; 274 c1 needs an unselected element;
  BoardView 85 i1 is a "try, not counted" with the single-`act` recipe; 158 c0 needs two tags; TabNotesDialog 128 c1
  needs a focused SVG ("try, not counted"); SessionsView 217 i0 is covered by the no-`lastVisitTime` case. Also found:
  BoardModal 159 i1 and BookmarkModal 130 i1 are not the url-focus path (that arm is already covered); BoardModal 71 is
  covered. Added the counting rule with a diff script.
- **C2** Fixed. Spinners, SessionsView 65/72/77 i0, BoardView 136 i1 moved to "not targeted" with reasons, and not
  proposed for removal. BoardNode 161 i0/b0/b1 is now targeted (only i1 is impossible; b1 is the `onDeleteFolder`
  operand, as line 151 shows). Found more reachable arms the old plan had marked unreachable: BoardView drag arms
  (269/274/277) and overlay arms (290/373/389/394/400) through the existing `DndContext` capture in
  `BoardInteractions.test.tsx`. Added `reach` and `target` columns; rows 1-10 reach 143 and target 126, rows 11-30
  target 76 at about 60% of misses. Total 202, margin 23. Named reserve R1-R10 (24 arms).
- **C3** Fixed with option (a), D9 and §12 Roles: the frontend-engineer owns all commits, the baseline, the reserve
  decision and the AC 7 table; the unit-test-writer runs an independent pass and may add tests.
- **C4** Fixed. The "works too" alternative is gone from D1 and §13 Q1, with the three hazards listed in D1. The
  merge is a hard human gate at §12 step 0 and in the DoD. The branch is noted as not pushed, and the spec file's
  carry-over and `docs(specs):` commit are noted.
- **C5** Fixed. §13 Q4 drops `release:dry` on `develop`, cites the analyzer logic, and gives the one-off
  `--branches develop` command with the tags caveat.
- **C6** Fixed. §12 preamble now attributes "no release" to the commit-analyzer rules, and says `hidden` only affects
  the changelog.
- **C7** Fixed. One number everywhere: 202, giving 6078/6340 = 95.87% (D3, §5.2 sum rows).
- **C8** Fixed. Commands moved out of the tables into V1-V5 (§11); §5.4 rewritten without pipes; V4 uses `-U0` and
  counts added lines only.
- **C9** Fixed. §5.3 "Mocking rule": `Reflect.deleteProperty(fakeChrome(), …)` and `as chrome.tabs.Tab`, no `as any`,
  no new file-level disables. All former `as any` uses were replaced.
- **C10** Fixed. §11 adds the Infer and theme-persistence checks to G3 if the `refactor` lands; D8, §13 Q2 and the DoD
  point to them.

## Revision 1 (2026-10-25)

Revised after `03-challenge.md` (VERDICT: REVISE, 4 MAJOR, 6 MINOR). Re-measured coverage (same baseline: 5876/6340) and
re-checked every arm of rows 1-10 against the source. Changes: corrected arms and targets (C1, C2), a counting rule and
diff script (C1), named reserve (C2), engineer-owned plan with an independent unit-test pass (C3), tooling merge as a
hard gate (C4), release reasoning and verification corrected (C5, C6), one consistent target of 202 (C7), commands
moved out of tables (C8), no `any` casts (C9), and targeted G3 checks if the refactor lands (C10). Details in
"Challenge response" above.
