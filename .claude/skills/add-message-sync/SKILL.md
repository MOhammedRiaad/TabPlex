---
name: add-message-sync
description: Add or change a chrome.runtime message between the TabPlex UI and the background service worker, and the STORAGE_* broadcast that keeps other open tabs in sync. Use when data changes in one tab don't appear in another, or a new background action is needed.
---

# Messages and cross-tab sync

## Message shape

`ExtensionMessage { type: string; payload?: unknown }` in `src/types/index.ts`.

- UI → background: verb form, `ADD_X`, `UPDATE_X`, `DELETE_X`, `MOVE_TAB`, `GET_BOOKMARKS`…
- Background → UI broadcast: `STORAGE_X_ADDED | STORAGE_X_UPDATED | STORAGE_X_DELETED | STORAGE_DATA_IMPORTED`.
- The background ignores any type starting with `STORAGE_` — never use that prefix for a request.

## Sender (store slice)

```ts
chrome.runtime.sendMessage({ type: 'UPDATE_X', payload: updated }).catch(console.error);
```

Always `.catch` — the call rejects when no listener is alive.

## Background handler

In `src/background/<domain>-service.ts`, then routed from `message-handler.ts`:

```ts
case 'UPDATE_X': {
    let sent = false;
    updateX(message.payload as X)
        .then(() => {
            chrome.runtime.sendMessage({ type: 'STORAGE_X_UPDATED', payload: message.payload }).catch(() => {});
            if (!sent) { sent = true; safeSendResponse(sendResponse, { success: true }); }
        })
        .catch((e: unknown) => {
            if (!sent) { sent = true; safeSendResponse(sendResponse, { error: (e as Error).message }); }
        });
    return true; // keep the channel open for the async response
}
```

Cast `payload` to a shared type; don't use `any`.

## Receiver — `src/hooks/useStorageSync.ts`

Add a case in `handleStorageChange`. It must **not** send a message back:

- add → `addXSilently(payload)`, or `if (!state.xs.some(i => i.id === payload.id)) addX(payload)`
- delete → `deleteXSilently(payload.id)`
- update → `updateX(payload.id, payload)` (check the slice's update doesn't itself send a message; if it does, add a silent variant)

## Checklist

- [ ] Type string identical in sender, `message-handler.ts`, service, and `useStorageSync`
- [ ] Handler returns `true` for async responses
- [ ] Receiver can't echo → no infinite loop (watch the console: `Background received message:` repeating)
- [ ] Reload the extension (background changed) and test with two TabPlex tabs open
- [ ] Run the `verify` skill
