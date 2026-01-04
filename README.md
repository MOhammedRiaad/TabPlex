# TabBoard Extension

A Microsoft Edge extension to organize browser tabs, tasks, and work context in a Trello-like workspace with AI-assisted intelligence.

## Features

- Organize tabs into boards and folders
- Drag and drop tabs between folders
- Local-only storage with no cloud sync
- Full screen tab interface for easy access
- Task management with Today view
- Note-taking functionality
- Browser history integration
- Session inference
- Edit and delete functionality for all items
- Delete folders with smart tab management (move or delete tabs)
- Keyboard shortcuts for enhanced productivity
- Export/Import functionality for data backup and transfer
- Toggle to show all tasks regardless of due date on Today view
- **🌙 Dark Mode** with system theme detection
- **🔍 Global Search** across tabs, tasks, notes, and sessions
- **⌘ Command Palette** for quick actions (Ctrl+K)
- **📊 Analytics Dashboard** with productivity insights
- **🎨 Canvas Drawing** with shapes, text, and freehand tools
- **🖌️ Consistent theming** with CSS variables

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

- **Frontend**: React 19 with TypeScript
- **State Management**: Zustand
- **Storage**: IndexedDB via idb for structured data, chrome.storage.local for settings
- **Drag & Drop**: DndKit
- **Build Tool**: Vite
- **Theming**: CSS Custom Properties (Variables)
- **Animations**: Framer Motion

## Phase 1 Completed

- Extension shell
- Full screen tab interface
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

## Phase 3: Productivity Enhancements

### Folder Deletion with Smart Tab Management
- **Delete Folders**: Now supports deleting folders with intuitive user interface
- **Empty Folders**: Simple confirmation for deleting empty folders
- **Folders with Tabs**: Smart handling when folders contain tabs:
  - Option to delete folder and all contained tabs
  - Option to move tabs to another folder before deletion
  - Dialog-based selection of target folder for moving tabs
- **Data Consistency**: Proper synchronization between IndexedDB and chrome.storage.local

### Keyboard Shortcuts
- **Navigation Shortcuts**:
  - `Ctrl/Cmd + Shift + B`: Switch to Boards view
  - `Ctrl/Cmd + Shift + H`: Switch to History view
  - `Ctrl/Cmd + Shift + S`: Switch to Sessions view
  - `Ctrl/Cmd + Shift + T`: Switch to Today view
- **Creation Shortcuts**:
  - `Ctrl/Cmd + Shift + A`: Add a new tab to the current context
  - `Ctrl/Cmd + Shift + N`: Add a new note
  - `Ctrl/Cmd + Shift + K`: Add a new task
  - `Ctrl/Cmd + Shift + F`: Add a new folder
- **Export Shortcut**:
  - `Ctrl/Cmd + Shift + E`: Export all data
- **Command Palette**:
  - `Ctrl/Cmd + K`: Open command palette

### Export/Import Functionality
- **Data Export**: Export all your boards, tabs, tasks, notes, sessions, and history with one click
- **Data Import**: Import data from a JSON file to restore your workspace
- **Complete Backup**: Data includes all metadata and relationships
- **One-Click Operations**: Simple export/import buttons in the main navigation

### Today View Enhancements
- **Show All Tasks**: Toggle to view all tasks regardless of due date
- **Intuitive Controls**: Easy-to-use button to switch between today's tasks and all tasks
- **Maintained Layout**: Consistent three-column layout (To Do, Doing, Done) in both views
- **Dynamic Counts**: Task counts update based on the selected view

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

## Phase 4: Comprehensive Improvements

### 🌙 Dark Mode Support
- **System Theme Detection**: Automatically matches your OS theme preference
- **Manual Toggle**: Switch between Light, Dark, and System modes
- **Persistent Preference**: Theme choice is saved in localStorage
- **Smooth Transitions**: CSS transitions for seamless theme switching
- **Full Coverage**: All components styled for both light and dark themes

### 🔍 Global Search
- **Universal Search**: Search across tabs, tasks, notes, folders, and sessions
- **Real-time Results**: Instant search results as you type
- **Keyboard Navigation**: Use arrow keys and Enter to navigate results
- **Result Categories**: Results grouped by type with icons
- **Quick Access**: Search bar prominently placed in the header

### ⌘ Command Palette
- **Quick Actions**: Access all features via `Ctrl/Cmd + K`
- **Fuzzy Search**: Find commands by typing partial names
- **Keyboard Navigation**: Full keyboard support for power users
- **Categorized Commands**: Commands grouped by Navigation, Creation, and Actions
- **Shortcut Hints**: Shows keyboard shortcuts for each command

### 📊 Analytics Dashboard
- **Summary Cards**: Total tabs, tasks, notes, and sessions at a glance
- **Task Progress**: Visual progress bar showing completion rate
- **Weekly Activity**: Bar chart showing activity trends over 7 days
- **Top Domains**: Most visited domains with percentage breakdown
- **Session Statistics**: Average session duration and insights

### 🎨 Code Quality Improvements
- **CSS Variables**: Comprehensive design tokens for colors, spacing, and typography
- **Unique ID Generation**: Using `crypto.randomUUID()` for collision-free IDs
- **Improved Types**: Extended TypeScript interfaces with tags, pinned, and analytics types
- **Accessibility**: ARIA labels and keyboard navigation throughout
- **Responsive Design**: Mobile-friendly layouts with proper breakpoints

### New Files Added
- `src/hooks/useTheme.ts` - Theme management hook
- `src/utils/idGenerator.ts` - Unique ID generation utilities
- `src/components/ThemeToggle.tsx` - Theme toggle component
- `src/components/SearchBar.tsx` - Global search component
- `src/components/CommandPalette.tsx` - Command palette component
- `src/components/AnalyticsDashboard.tsx` - Analytics dashboard component

## Usage

### Main Interface
1. **Today View**: See today's tasks and notes in a consolidated view
2. **Boards View**: Organize tabs into folders using drag and drop
3. **History View**: Browse browser history and add items to folders
4. **Sessions View**: View and manage inferred work sessions
5. **Analytics View**: View productivity statistics and insights

### Quick Actions
- **Command Palette**: Press `Ctrl/Cmd + K` for quick access to all actions
- **Search**: Use the search bar to find anything across your workspace
- **Theme Toggle**: Switch between light/dark modes from the header

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


## Phase 5: Focus & Persistence

### 🍅 Pomodoro Timer
- **Persistent Timer**: Timer state persists across page reloads and browser restarts
- **Global Integration**: Timer runs globally regardless of the active view
- **Mini Timer**: Compact timer controls available in the "Today" view header when the main panel is hidden
- **Task Linking**: Link specific tasks to focus sessions for tracking
- **Customizable Settings**: Adjust work/break durations, auto-start options, and sound notifications

### 📊 Enhanced Analytics
- **Task Focus Metrics**: Track number of focus sessions per task
- **Time Estimation**: "Est. Time" calculation based on an **8-hour workday**
- **Deep Insights**: Analyze which tasks consume the most focus time

### 📝 Task Enhancements
- **Rich Details**: Add descriptions to tasks
- **Checklists**: Break down tasks into sub-items with progress tracking
- **Linked Tabs**: Open tabs associated with tasks directly from the task card

## Phase 6: Canvas Drawing Tool

### 🎨 Canvas Drawing
- **Full Drawing Suite**: Rectangle, Ellipse, Line, Pen, and Text tools
- **Interactive Drawing**: Real-time preview while drawing shapes
- **Selection & Editing**: Click to select, drag to move elements
- **Multi-Select**: Ctrl+Click for multiple selection, drag-to-select box
- **Layering**: Ctrl+] bring to front, Ctrl+[ send to back
- **Styling**: Color pickers for stroke/fill, stroke width, opacity controls

### ⌨️ Canvas Keyboard Shortcuts
- **V**: Select tool
- **R**: Rectangle tool
- **E**: Ellipse tool
- **L**: Line tool
- **P**: Pen (freehand) tool
- **T**: Text tool
- **Ctrl+A**: Select all elements
- **Ctrl+C / Ctrl+V**: Copy and paste elements
- **Ctrl+Z / Ctrl+Y**: Undo and redo
- **Ctrl+] / Ctrl+[**: Layer ordering
- **Delete/Backspace**: Delete selected elements

### 🔧 Canvas Features
- **Zoom & Pan**: Ctrl+Scroll to zoom, Shift+Drag to pan
- **Grid**: 10px subtle grid for alignment
- **Export**: Download canvas as PNG image
- **Auto-Save**: All drawings persist automatically
- **Multiple Canvases**: Create and switch between canvases
- **White Background**: Consistent canvas visibility in all themes

## Future Enhancements
- AI-powered tab organization suggestions
- Cross-browser synchronization
- Integration with productivity tools
- Tags and labels for items
- Pinned/favorites functionality
- Canvas shape resizing and rotation
- Shape connectors for diagrams