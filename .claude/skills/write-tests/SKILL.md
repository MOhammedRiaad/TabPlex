---
name: write-tests
description: Write or fix TabPlex tests — Vitest unit/component tests with the in-memory chrome mock, or Playwright E2E against the built extension. Use when adding a feature or bug fix, when coverage drops under 85%, or when asked to "add tests".
---

# Write tests

## Where

- Unit/component: `src/**/__tests__/<name>.test.ts(x)` next to the code under test.
- E2E: `e2e/*.spec.ts`, using fixtures from `e2e/fixtures.ts`.

## Unit tests

- A fresh `chrome` mock is installed before every test (`src/test/setup.ts`). Get helpers with `fakeChrome()`:
  `browser.addTab`, `addGroup`, `openWindow`, `closeWindow`, `groupTabs`, `store`, `events.<name>.emit(...)`.
  `addTab` does not fire `onCreated`; `chrome.tabs.create` does.
- `respondToMessages(handler)` answers `chrome.runtime.sendMessage` like the background would.
- Data: `makeTask`, `makeContext`, `makeBoard`, `makeFolder`, `makeTab`, `makeNote`, `makeSession` from
  `src/test/factories.ts`. Override only the fields the test is about.
- Zustand: reset with `useBoardStore.setState(...)` in `beforeEach`; IndexedDB is `fake-indexeddb` (reset per file).
- Background modules add listeners at import time: `vi.resetModules()` then `await import('../module')` in `beforeEach`.
  Use `vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })` and `vi.advanceTimersByTimeAsync(ms)` for the
  300 ms busy guard and debounces.
- Components: `@testing-library/react` + `user-event`; query by role/label first. Mock heavy canvas/tldraw children.
- For a bug fix, write the test first and check it fails without the fix.

## E2E

- `app` is the TabPlex page at `#/tasks` and fails the test on any page error. `serviceWorker.evaluate` reads real
  `chrome.*` state; `storedTask(sw, id)` reads the background copy of a task; `site('name')` is a fake page.
- Prefer `expect.poll` on stored state over fixed waits. Run with `npm run build && npm run test:e2e`.

## Done

`npm run test:coverage` passes (85% gate). Don't add coverage exclusions to get there — only pure-visual canvas code,
types and entry files are excluded, by design.
