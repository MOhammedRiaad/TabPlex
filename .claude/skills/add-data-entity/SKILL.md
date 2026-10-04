---
name: add-data-entity
description: Add a new persisted data type (e.g. reminders, tags, links) to TabPlex end to end — types, IndexedDB store, Zustand slice, background service, cross-tab sync and UI. Use when a feature needs new data that must be saved and synced.
---

# Add a persisted entity

Example name used below: `Reminder` / `reminders`. Mirror the existing **Note** implementation — it is the smallest complete example:
`src/store/slices/board/noteSlice.ts`, `src/background/note-service.ts`, Note cases in `src/hooks/useStorageSync.ts`, `src/features/notes/`.

## 1. Types — `src/types/index.ts`

- Add `export interface Reminder { id: string; …; createdAt: string; updatedAt?: string }`.
- Timestamps are ISO strings. IDs come from `generateId('reminder')` in `src/utils/idGenerator.ts`.

## 2. IndexedDB — `src/utils/storage.ts`

- Add `const REMINDERS_STORE = 'reminders'` and add it to the `DBSchema` type.
- **Bump `DB_VERSION`.** Make `upgrade()` idempotent — guard every store:
    ```ts
    if (!database.objectStoreNames.contains(REMINDERS_STORE)) {
        database.createObjectStore(REMINDERS_STORE, { keyPath: 'id' });
    }
    ```
    Apply the same guard to the existing stores while you're there; unguarded `createObjectStore` throws for users upgrading from an older version.
- Add `getAllReminders`, `addReminder`, `updateReminder`, `deleteReminder` following the existing functions.
- Include the new store in export/import (`src/utils/exportImport.ts`, `src/background/data-service.ts`) so backups don't drop it.

## 3. Store slice — `src/store/slices/board/reminderSlice.ts`

- Add `ReminderSlice` to `src/store/slices/board/types.ts` and to `BoardState`.
- Actions: `addReminder`, `updateReminder`, `deleteReminder`, plus `addReminderSilently` / `deleteReminderSilently`.
- Each normal action must: (1) `set` state, (2) persist via storage.ts with `.catch(console.error)`, (3) `chrome.runtime.sendMessage({ type: 'ADD_REMINDER', payload }).catch(console.error)`.
- Silent actions do (1) and (2) only — they're used when applying changes from other tabs.
- Register `createReminderSlice` in `src/store/boardStore.ts`.

## 4. Background — `src/background/`

- Add persistence to `background/storage.ts` (chrome.storage.local), importing the shared type.
- Create `reminder-service.ts` with `handleReminderMessage(message, sendResponse)` copying the note-service pattern: write, broadcast `STORAGE_REMINDER_ADDED|UPDATED|DELETED`, `safeSendResponse` with a sent-flag, `return true` for async.
- Import it in `background/index.ts` and route `*_REMINDER` types in `message-handler.ts`.

## 5. Sync — `src/hooks/useStorageSync.ts`

- Load `getAllReminders()` in the initial `Promise.all`.
- Add `STORAGE_REMINDER_*` cases using silent actions or an exists-by-id check. See the `add-message-sync` skill.

## 6. UI

- `src/features/reminders/RemindersView.tsx` + `.css` + `components/`. If it needs its own page, follow the `add-view` skill.

## 7. Finish

- Update `docs/ARCHITECTURE.md` slice list and `docs/DATA_FLOW.md` if relevant.
- Run the `verify` skill. Commit as `feat: add reminders`.
