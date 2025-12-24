# TabBoard Extension

A Microsoft Edge extension to organize browser tabs, tasks, and work context in a Trello-like workspace with AI-assisted intelligence.

## Features

- Organize tabs into boards and folders
- Drag and drop tabs between folders
- Local-only storage with no cloud sync
- Side panel interface for easy access
- Task management with Today view
- Note-taking functionality
- Browser history integration
- Session inference
- Edit and delete functionality for all items

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

## Phase 2 Completed

### Tasks & Notes
- **Today View**: Comprehensive dashboard showing today's tasks and notes
- **Task Management**: Create, edit, and delete tasks with status tracking (To Do, Doing, Done)
- **Note Taking**: Create, edit, and delete notes with rich text support
- **Grid Layout**: Responsive grid layout for notes to prevent page overflow
- **Edit Functionality**: Full edit capabilities for tasks and notes
- **Delete Functionality**: Safe delete with confirmation dialogs

### History & Sessions
- **Browser History Integration**: Import and organize browser history items
- **History to Folders**: Add history items directly to existing folders
- **Session Inference**: Automatic session detection based on tab usage patterns
- **Session Management**: View and manage inferred sessions

### Enhanced UI/UX
- **Card Design**: Improved tab card layout with separate drag handles
- **Drag Handle**: Dedicated drag handle in tab headers to prevent event conflicts
- **Folder Editing**: Editable folder names with inline editing
- **Responsive Grid**: Notes displayed in responsive grid layout with scrolling
- **Visual Feedback**: Enhanced visual feedback during drag operations

### Data Persistence
- **Dual Storage**: Both IndexedDB and chrome.storage.local for data persistence
- **Bidirectional Sync**: Proper synchronization between UI and background storage
- **Deletion Handling**: Proper deletion from both storage systems
- **State Consistency**: Maintained state consistency across storage systems

### Bug Fixes
- **Drag Conflicts**: Fixed event conflicts between drag, edit, and link opening
- **Z-Index Issues**: Fixed z-index problems during drag operations
- **Infinite Loops**: Fixed infinite loops in deletion synchronization
- **Storage Sync**: Fixed bidirectional state sync between storage systems

## Usage

### Main Interface
1. **Boards View**: Organize tabs into folders using drag and drop
2. **History View**: Browse browser history and add items to folders
3. **Sessions View**: View and manage inferred work sessions
4. **Today View**: See today's tasks and notes in a consolidated view

### Creating Items
- **Tabs**: Automatically captured from browser activity or manually added
- **Tasks**: Create using the "Add Task" forms in any view
- **Notes**: Create using the "Add Note" button in Today view
- **Folders**: Create new folders using the add button

### Managing Items
- **Edit**: Click edit buttons (✏️) to modify content
- **Delete**: Click delete buttons (🗑️) with confirmation
- **Drag & Drop**: Move items between folders by dragging the handle (⋮⋮)
- **Folder Rename**: Click folder names to edit them

## Future Enhancements

- AI-powered tab organization suggestions
- Cross-browser synchronization
- Advanced session analytics
- Integration with productivity tools
- Keyboard shortcuts
- Export/import functionality