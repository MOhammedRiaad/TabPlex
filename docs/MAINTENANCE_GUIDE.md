# Maintenance & Contribution Guide

This guide outlines the workflows for maintaining, extending, and releasing TabPlex.

## 🛠️ Development Workflow

### Prerequisites

- Node.js 16+
- NPM 8+

### Setup

```bash
git clone <repo>
npm install
```

### Daily Dev Loop

1. **Start Dev Server**: `npm run dev`
    - This watches for file changes and continually rebuilds.
2. **Load in Chrome**:
    - Go to `chrome://extensions`
    - "Load Unpacked" -> Select `dist/` folder.
    - **Note**: You must reload the extension in `chrome://extensions` manually if you change `manifest.json` or background scripts. UI changes usually hot-reload (or require a simple tab refresh).

---

## ✨ Adding a New Feature

Follow this checklist to add a new "slice" of functionality (e.g., "Reminders") without breaking the architecture.

### 1. Define Types

- [ ] Add interfaces to `src/types/index.ts`.
- [ ] Ensure they are exported.

### 2. Create Storage Layer

- [ ] Update `src/utils/storage.ts`:
    - Add `REMINDERS_STORE` constant.
    - Add `addReminder`, `updateReminder`, `deleteReminder` functions.
    - initializing the store in `initDB`.

### 3. Create Store Slice

- [ ] Create `src/store/slices/board/reminderSlice.ts`.
- [ ] Define `ReminderSlice` interface.
- [ ] Implement `createReminderSlice`.
    - **CRITICAL**: Ensure actions persist to DB **and** send `chrome.runtime.sendMessage`.
- [ ] Add slice to `src/store/boardStore.ts`.

### 4. Background Support (Optional)

- [ ] If background logic is needed, update `src/background/storage.ts` (import shared types!).
- [ ] Add `src/background/reminder-service.ts`.
- [ ] Register in `src/background/message-handler.ts`.

### 5. UI Implementation

- [ ] Create `src/features/reminders/`.
- [ ] Create components and views.
- [ ] Add route to `src/routes.tsx`.

---

## 🚀 Release Process

1. **Verify Build**:

    ```bash
    npm run lint  # Must be zero errors
    npm run build # Must exit with code 0
    ```

2. **Bump Version**:
    - Update `version` in `package.json`.
    - Update `version` in `manifest.json`.

3. **Package**:
    - The build output is in `dist/`.
    - Create a ZIP file of the `dist/` directory.

4. **Test Production Build**:
    - Load the _fresh_ `dist/` folder in Chrome.
    - Test critical flows (Data import, Session restore).

---

## 🔍 Troubleshooting

### "Changes not showing up"

- **UI**: Refresh the tab.
- **Background/Manifest**: Go to `chrome://extensions` and click the refresh icon on the extension card.

### "Data not syncing"

- Check the console for "Message port closed" errors.
- Verify `useStorageSync.ts` has a case for your new message type.
- Ensure your store slice is calling `chrome.runtime.sendMessage`.

### "Build fails on Types"

- We use strict TypeScript. `any` is discouraged.
- Check `src/types/index.ts` for discrepancies.
