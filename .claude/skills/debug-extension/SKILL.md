---
name: debug-extension
description: Diagnose TabPlex problems in the loaded Chrome extension — changes not showing, data not syncing between tabs, background service worker errors, IndexedDB upgrade failures, onboarding not opening. Use when the user reports a bug that happens in Chrome rather than at build time.
---

# Debug the extension

First confirm what is loaded: was `npm run build` re-run, and was `dist/` (not the repo root) loaded?

## Symptom → cause

| Symptom                                                                                      | Check                                                                                                                                                                     |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UI change not visible                                                                        | Rebuild, then refresh the TabPlex tab                                                                                                                                     |
| Background / manifest change not visible                                                     | Rebuild, then click reload on the card in `chrome://extensions`                                                                                                           |
| Data not appearing in other open tabs                                                        | Slice action sends the message? Background routes the type in `message-handler.ts`? Service broadcasts `STORAGE_*`? `useStorageSync` has a case? (see `add-message-sync`) |
| Console floods with the same message                                                         | Receiver echoes back: use a `…Silently` action or an exists-by-id guard                                                                                                   |
| `The message port closed before a response was received`                                     | Async handler didn't `return true`, or never called `sendResponse`                                                                                                        |
| `Could not establish connection. Receiving end does not exist`                               | Harmless if the send is `.catch`ed; otherwise add `.catch`                                                                                                                |
| Blank page / data gone after update                                                          | IndexedDB `upgrade()` threw on `createObjectStore` for an existing store — guard with `objectStoreNames.contains` (`src/utils/storage.ts`)                                |
| Data lost after import/export                                                                | New store not added to `utils/exportImport.ts` / `background/data-service.ts`                                                                                             |
| Feature works in `npm run dev` only                                                          | `chrome.*` APIs exist only inside the extension; dev server is for layout only                                                                                            |
| `chrome.x is undefined`                                                                      | Missing permission in `manifest.json`                                                                                                                                     |
| New permission added, feature still fails after reload (e.g. `_favicon` → `net::ERR_FAILED`) | Chrome didn't apply the new permission. Remove the extension and load `dist/` unpacked again                                                                              |

## Where to look

- Service worker console: `chrome://extensions` → TabPlex → "service worker" link.
- UI console: DevTools on the TabPlex tab. Application tab → IndexedDB (UI data) and Extension storage (chrome.storage.local).
- The background logs every message (`Background received message:`).

## Approach

Reproduce → read the relevant code path end to end (slice → service → useStorageSync) → make the smallest fix → run the `verify` skill → tell the user exactly how to reload and re-test.
