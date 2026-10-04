# Architecture Guide

## 🏗️ System Overview

TabPlex is a Chrome Extension built on **Manifest V3** using a modern React stack. It follows a "Local-First" architecture where all data resides in the user's browser, utilizing `IndexedDB` for structured data and `chrome.storage.local` for background synchronization.

### Tech Stack

- **Core**: React 19, TypeScript
- **Build**: Vite 7
- **State**: Zustand (with modular slices)
- **Data**: IndexedDB (`idb`), chrome.storage.local
- **UI**: CSS Modules, DndKit for interactions

---

## 🧩 Component Layers

### 1. Presentation Layer (`src/features`)

The UI is organized by feature domain rather than technical type. Each feature directory (e.g., `src/features/boards`) contains its own components, styles, and hooks.

- **Views**: Top-level page components (e.g., `BoardView`, `TodayView`).
- **Components**: Reusable UI parts specific to that feature.
- **Routing**: `src/routes.tsx` maps paths to lazy-loaded views.

### 2. State Layer (`src/store`)

We use **Zustand** for state management, split into focused "slices" to keep code maintainable.

- **Board Store**: The central store combining multiple slices:
    - `boardSlice`: Boards and folders
    - `tabSlice`: Tabs logic
    - `taskSlice`: Task management
    - `noteSlice`: Notes
    - `sessionSlice`: Session tracking
    - `bookmarkSlice`: Chrome bookmark integration
- **Persistence**: Slices manually persist to IndexedDB via the `src/utils/storage.ts` layer.
- **Sync**: Slices notify the background script via `chrome.runtime.sendMessage`.

### 3. Service Layer (`src/background`)

The background service worker acts as the "Engine" of the extension. It handles Chrome API events, context menus, and keeps data in sync between multiple TabPlex windows.

- **Message Handler**: Central router for incoming messages (`message-handler.ts`).
- **Services**: Specialized modules (e.g., `tab-service.ts`) for specific domains.
- **Storage**: Independent access to `chrome.storage.local` for background persistence.

### 4. Data Layer (`src/utils/storage.ts`)

A wrapper around IndexedDB that provides a consistent Promise-based API for CRUD operations. All frontend components interact with the DB through this layer or the Zustand store.

---

## 💡 Key Design Decisions

### 1. Dual Storage Strategy

We use two different storage engines for specific purposes:

| Storage            | Context       | Purpose                                                                                                                                                                                                              |
| ------------------ | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **IndexedDB**      | Frontend (UI) | Stores the bulk of user data (boards, tasks, etc.). Efficient for large datasets and complex queries.                                                                                                                |
| **chrome.storage** | Background    | Stores sync metadata and settings. Required because Service Workers cannot reliably access IndexedDB in some browser contexts, though this is changing. It also serves as the communication bridge for data changes. |

### 2. Unidirectional Data Sync

To keep the UI and Background in sync:

1. **Action**: User updates a task in the UI.
2. **Store**: Zustand updates local state AND writes to IndexedDB.
3. **Notify**: Store sends a message to Background.
4. **Broadcast**: Background receives message and broadcasts a storage event.
5. **Sync**: Other open TabPlex tabs listen for the storage event and update their local state via `useStorageSync`.

### 3. Shared Utilities

To prevent code duplication and ensure consistency, we centralize logic:

- `src/utils/dateUtils.ts`: All date formatting.
- `src/utils/tabUtils.ts`: Logic for creating tabs (e.g., from History).
- `src/types/index.ts`: Shared TypeScript interfaces used by both Frontend and Background.

### 4. Zero-Warning Policy

We enforce a strict linting policy. No console warnings or ESLint errors are allowed in the produciton build. This ensures long-term maintainability.
