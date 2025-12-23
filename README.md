# TabBoard Extension

A Microsoft Edge extension to organize browser tabs, tasks, and work context in a Trello-like workspace with AI-assisted intelligence.

## Features

- Organize tabs into boards and folders
- Drag and drop tabs between folders
- Local-only storage with no cloud sync
- Side panel interface for easy access

## Installation

1. Open Microsoft Edge
2. Navigate to `edge://extensions`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked"
5. Select the `dist` folder in this project directory

## Development

To build the extension:

```bash
npm install
npm run build
```

To run in development mode:

```bash
npm run dev
```

## Architecture

- **Frontend**: React 18 with TypeScript
- **State Management**: Zustand
- **Storage**: IndexedDB via idb for structured data, chrome.storage.local for settings
- **Drag & Drop**: DndKit
- **Build Tool**: Vite

## Phase 1 Completed

- Extension shell
- Side panel interface
- Manual boards/folders
- Tab dragging between folders
- Local data persistence

## Next Steps (Phase 2)

- Tasks with Today view
- Browser history integration
- Session inference