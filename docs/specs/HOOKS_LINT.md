# Spec: Lint React hooks (rules-of-hooks, exhaustive-deps)

|             |                                                                                                                                                                                |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Status**  | Ready to implement · ROADMAP #27 (tech debt, do first)                                                                                                                         |
| **Created** | 2026-10-05                                                                                                                                                                     |
| **Size**    | S (½ day)                                                                                                                                                                      |
| **Why**     | A missing `useCallback` dependency made the Boards tab dialog save empty tags; only a unit test caught it (fixed in #44). The lint rule that catches this class of bug is off. |

## 1. Problem

`eslint.config.js` registers `eslint-plugin-react-hooks` (v7) as a plugin but enables none of its rules. With
`react-hooks/rules-of-hooks` and `react-hooks/exhaustive-deps` turned on, `src/` has **11 warnings, 0 errors**
(counted 2026-10-05 on `develop`).

## 2. Goal

Both rules on at the project's normal level (lint fails on any warning, `--max-warnings 0`), and the 11 existing
findings fixed **without changing behaviour**, except where a finding is a real bug (then fix the bug and add a test).

## 3. Config change

In the `rules` block of `eslint.config.js`:

```js
'react-hooks/rules-of-hooks': 'error',
'react-hooks/exhaustive-deps': 'warn', // --max-warnings 0 makes it blocking
```

## 4. The 11 findings and the intended fix

Read each one before changing it. "Stable" means a Zustand action or a `useCallback` with stable deps, so adding it
to the array changes nothing at runtime.

| #   | Location                                        | Finding                                                                           | Intended fix                                                                                                                                                                                             | Likely bug? |
| --- | ----------------------------------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| 1   | `src/App.tsx:68`                                | `useEffect` misses `activeView`, `location.pathname`, `navigate`, `setActiveView` | Route ↔ view sync effect. Add the deps, then guard against loops (only navigate when `viewToPath(activeView) !== location.pathname`). Test: changing view navigates once; changing route sets view once. | Maybe       |
| 2   | `src/App.tsx:203`                               | `useEffect` misses `handleExport`                                                 | Wrap `handleExport` in `useCallback` (or move it inside the effect) and list it.                                                                                                                         | No          |
| 3   | `src/features/boards/BoardView.tsx:54`          | `currentBoard` conditional makes `useCallback` deps change every render           | `useMemo` for `currentBoard`. Superseded by the board switcher (#23) if that lands first.                                                                                                                | No (perf)   |
| 4   | `src/features/bookmarks/BookmarkView.tsx:240`   | `useMemo` misses `searchQuery`                                                    | Add `searchQuery`. **Check:** does the filtered list fail to update when only the search text changes? If yes it's a bug: add a test that types in search and sees the list change.                      | **Yes?**    |
| 5   | `canvas/components/CanvasContainer.tsx:238`     | `useEffect` misses `groupElements`, `ungroupElements`                             | Keyboard-shortcut effect: `useCallback` the two handlers or read them through a ref.                                                                                                                     | Maybe       |
| 6–7 | `canvas/components/CanvasRenderer.tsx:228, 250` | `useEffect` misses `ref`                                                          | `ref` is a forwarded ref object: list it (stable).                                                                                                                                                       | No          |
| 8   | `canvas/components/Minimap.tsx:50`              | `totalBounds` object recreated each render                                        | `useMemo` for `totalBounds`.                                                                                                                                                                             | No (perf)   |
| 9   | `sessions/components/TimerManager.tsx:41`       | `useEffect` misses `handleTimerComplete`                                          | `useCallback` it; check the interval isn't recreated every tick.                                                                                                                                         | Maybe       |
| 10  | `ui/components/SearchBar.tsx:136`               | `useCallback` misses `handleResultClick`                                          | `useCallback` `handleResultClick` and list it. Check Enter opens the **current** highlighted result (stale closure risk).                                                                                | Maybe       |
| 11  | `src/hooks/useStorageSync.ts:399`               | `useEffect` misses the 8 `…Silently` store actions                                | They're Zustand actions (stable references). List them; the effect must still run once (assert the listener is added exactly once).                                                                      | No          |

Canvas files (5–8) are excluded from coverage; verify them by the canvas E2E/smoke instead.

## 5. Tests

- For every row marked **Yes?/Maybe**: write the test that would fail if the stale closure mattered, then fix.
- `useStorageSync`: a test that the `chrome.runtime.onMessage` listener is registered once across re-renders.
- `npm run lint` passes with the rules on. Full `verify` + E2E.

## 6. Delivery

One PR, two commits: `chore(lint): enable react-hooks rules` (config + fixes that change nothing) and
`fix(...): …` for each real bug found (so the changelog lists them).
