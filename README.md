# TabBoard - Smart Browser Tab & Task Manager

A powerful Chrome extension to organize browser tabs, tasks, and work context in a visual workspace with productivity-focused features.

## 🎯 Target Users

**TabBoard is designed for:**

- **Knowledge Workers** who juggle multiple projects and need to organize research, documentation, and tasks
- **Developers & Designers** who work with many tabs and need to track progress across features
- **Students & Researchers** managing multiple topics, papers, and study materials
- **Project Managers** coordinating tasks, notes, and resources across different initiatives
- **Anyone** who wants to reduce tab clutter and improve focus with structured workspace management

**Perfect for users who:**

- Regularly have 20+ tabs open
- Work on multiple projects simultaneously
- Need to track tasks alongside related web resources
- Want visual organization similar to Trello or Kanban boards
- Value privacy with local-only data storage

## ✨ Features

### 📋 Core Organization

- **Board & Folder System**: Organize tabs into visual boards with customizable folders
- **Drag & Drop**: Intuitive drag-and-drop interface for moving tabs between folders
- **Smart Tab Management**: Automatically capture and organize browser tabs
- **Local-First Storage**: All data stored locally with no cloud dependency

### ✅ Task Management

- **Today View**: Consolidated dashboard for today's tasks and notes
- **Kanban-Style Workflow**: To Do, Doing, Done columns for visual progress tracking
- **Rich Task Details**: Add descriptions, checklists, due dates, and priority levels
- **Task-Tab Linking**: Associate web resources with specific tasks

### 📝 Note-Taking

- **Markdown Support**: Rich text formatting with markdown editor
- **Context-Aware Notes**: Link notes to specific boards, folders, or tabs
- **Quick Capture**: Fast note creation from any view

### 🍅 Focus & Productivity

- **Pomodoro Timer**: Built-in focus timer with customizable work/break intervals
- **Task Focus Tracking**: Track focus sessions per task
- **Session Management**: Automatic session inference based on browsing patterns
- **Browser History Integration**: Import and organize browser history

### 📊 Analytics & Insights

- **Productivity Dashboard**: Visual insights into your work patterns
- **Weekly Activity Charts**: Track tabs opened, tasks completed, and sessions
- **Domain Analytics**: See which websites you visit most
- **Task Completion Metrics**: Monitor your productivity trends

### 🎨 Canvas Drawing

- **Visual Brainstorming**: Freehand drawing with pen tool
- **Shape Tools**: Rectangles, ellipses, lines, and text
- **Selection & Editing**: Multi-select, move, and layer management
- **Export**: Save canvases as PNG images

### 🔍 Search & Navigation

- **Global Search**: Find anything across tabs, tasks, notes, and sessions
- **Command Palette** (`Ctrl/Cmd + K`): Quick access to all features
- **Keyboard Shortcuts**: Power-user navigation and creation shortcuts

### 🌙 Customization

- **Dark Mode**: System theme detection with manual toggle
- **Responsive Design**: Works seamlessly at any window size
- **Export/Import**: Backup and transfer your data

## 🏗️ Architecture

### Technology Stack

- **Frontend**: React 19 with TypeScript
- **State Management**: Zustand with modular slice pattern
- **Storage**:
    - IndexedDB (via `idb`) for structured data
    - `chrome.storage.local` for settings and background sync
- **Drag & Drop**: DndKit
- **Build Tool**: Vite 7
- **Styling**: CSS Custom Properties (Design Tokens)
- **Type Safety**: Strict TypeScript with ESLint

### Project Structure

```
src/
├── features/              # Feature-based organization
│   ├── analytics/        # Analytics dashboard components
│   ├── boards/           # Board and folder management
│   ├── canvas/           # Drawing canvas with tools
│   ├── history/          # Browser history integration
│   ├── navigation/       # App header and navigation
│   ├── notes/            # Note-taking components
│   ├── sessions/         # Session management & timer
│   ├── tasks/            # Task management
│   ├── today/            # Today view dashboard
│   └── ui/               # Shared UI components
├── store/                # Zustand state management
│   ├── slices/board/     # Modular state slices
│   │   ├── boardSlice.ts
│   │   ├── tabSlice.ts
│   │   ├── taskSlice.ts
│   │   ├── noteSlice.ts
│   │   ├── sessionSlice.ts
│   │   └── historySlice.ts
│   ├── boardStore.ts     # Combined board store
│   ├── timerStore.ts     # Timer state
│   └── uiStore.ts        # UI state (theme, search, etc.)
├── background/           # Chrome extension background services
│   ├── index.ts          # Main entry point
│   ├── background-init.ts
│   ├── message-handler.ts
│   ├── storage.ts
│   └── *-service.ts      # Modular service handlers
├── hooks/                # Custom React hooks
├── utils/                # Utility functions
└── types/                # TypeScript type definitions
```

### Design Patterns

- **Feature-Based Architecture**: Components organized by feature domain for better maintainability
- **Slice Pattern**: Zustand store split into focused slices (boards, tabs, tasks, notes, sessions, history)
- **Tool Strategy Pattern**: Canvas tools implement a common interface for extensibility
- **Service Layer**: Background services handle Chrome API interactions and data persistence
- **Type-Safe Messaging**: Strongly-typed message passing between UI and background script

### State Management

The application uses Zustand with a modular slice architecture:

- **Board Store**: Combines multiple slices for comprehensive state management
    - `boardSlice`: Board and folder operations
    - `tabSlice`: Tab management and movement
    - `taskSlice`: Task CRUD operations
    - `noteSlice`: Note management
    - `sessionSlice`: Session tracking
    - `historySlice`: Browser history integration
- **Timer Store**: Persistent Pomodoro timer state
- **UI Store**: Global UI state (theme, search, command palette)

## 🚀 Installation

### For Users (Chrome Web Store)

_Coming soon - Extension will be published to Chrome Web Store_

### For Developers

1. **Clone the repository**

    ```bash
    git clone <repository-url>
    cd Browser\ Tabs
    ```

2. **Install dependencies**

    ```bash
    npm install
    ```

3. **Build the extension**

    ```bash
    npm run build
    ```

4. **Load in Chrome**
    - Open Chrome and navigate to `chrome://extensions`
    - Enable "Developer mode" (toggle in top right)
    - Click "Load unpacked"
    - Select the `dist` folder from the project directory

## 💻 Development

### Available Scripts

```bash
npm run dev          # Development mode with hot reload
npm run build        # Production build
npm run lint         # Run ESLint
npm run preview      # Preview production build
```

### Development Workflow

1. Run `npm run dev` to start development server
2. Make changes to source files
3. Reload extension in Chrome to see changes
4. Run `npm run lint` to check for issues
5. Run `npm run build` before committing

## 📖 Usage Guide

### Getting Started

1. **Create Your First Board**: Click "Add Board" to create a workspace
2. **Add Folders**: Organize your tabs into folders by topic or project
3. **Capture Tabs**: Manually add current tabs or let TabBoard auto-capture
4. **Create Tasks**: Use the Today view to manage your daily tasks
5. **Track Focus**: Use the Pomodoro timer to track focus sessions

### Keyboard Shortcuts

#### Navigation

- `Ctrl/Cmd + Shift + B` - Boards view
- `Ctrl/Cmd + Shift + H` - History view
- `Ctrl/Cmd + Shift + S` - Sessions view
- `Ctrl/Cmd + Shift + T` - Today view
- `Ctrl/Cmd + Shift + A` - Analytics view
- `Ctrl/Cmd + Shift + C` - Canvas view

#### Actions

- `Ctrl/Cmd + K` - Command palette
- `Ctrl/Cmd + Shift + N` - New note
- `Ctrl/Cmd + Shift + K` - New task
- `Ctrl/Cmd + Shift + F` - New folder
- `Ctrl/Cmd + Shift + E` - Export data

#### Canvas (when active)

- `V` - Select tool
- `R` - Rectangle
- `E` - Ellipse
- `L` - Line
- `P` - Pen (freehand)
- `T` - Text
- `Ctrl/Cmd + A` - Select all
- `Ctrl/Cmd + Z/Y` - Undo/Redo
- `Delete` - Delete selected

### Data Management

**Export Your Data**

- Click the export button in the navigation bar
- Save the JSON file to your preferred location
- Use for backup or transferring to another browser

**Import Data**

- Click the import button
- Select your previously exported JSON file
- All data will be restored

## 🔒 Privacy Policy

### Data Collection & Storage

**TabBoard is privacy-first and collects NO personal data.**

#### What We Store (Locally Only)

- **Tabs**: URLs, titles, and favicons of tabs you organize
- **Tasks**: Task descriptions, due dates, and completion status
- **Notes**: Note content you create
- **Sessions**: Browsing session metadata (timestamps, tab associations)
- **History**: Browser history items you explicitly import
- **Settings**: Your preferences (theme, timer settings)
- **Canvas Data**: Drawings you create

#### Where Data is Stored

- **100% Local**: All data stored in your browser using IndexedDB and chrome.storage.local
- **No Cloud Sync**: We do not transmit, upload, or sync any data to external servers
- **No Analytics**: We do not collect usage statistics or telemetry
- **No Third-Party Services**: No data shared with any third parties

#### Permissions Explained

TabBoard requests the following Chrome permissions:

- **`tabs`**: To read tab information (URL, title) for organization
- **`tabGroups`**: To integrate with Chrome's native tab groups
- **`history`**: To allow you to import and organize browser history (only when you explicitly request it)
- **`storage`**: To save your boards, tasks, and notes locally
- **`notifications`**: To send task reminders and timer notifications
- **`<all_urls>`**: To capture favicons and tab metadata from any website you visit

**Important**: These permissions are used solely for the extension's functionality. We never transmit your data anywhere.

#### Your Data Rights

- **Full Control**: You own all your data
- **Export Anytime**: Export all data as JSON
- **Delete Anytime**: Uninstalling the extension removes all local data
- **No Account Required**: No registration, login, or personal information needed

#### Updates to Privacy Policy

Any changes to this privacy policy will be communicated through extension updates. Continued use after updates constitutes acceptance of changes.

**Last Updated**: January 2026

## 🛠️ Technical Details

### Browser Compatibility

- Chrome 88+ (Manifest V3)
- Microsoft Edge 88+
- Other Chromium-based browsers with Manifest V3 support

### Storage Limits

- IndexedDB: Typically 50-100MB+ (browser-dependent)
- chrome.storage.local: 10MB limit (adequate for most users)

### Performance

- Optimized React rendering with granular selectors
- Lazy loading for large datasets
- Efficient drag-and-drop with DndKit
- Minimal background script resource usage

## 🤝 Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Standards

- Follow TypeScript strict mode
- Use ESLint configuration (0 warnings policy)
- Write meaningful commit messages
- Add types for all new code
- Test in both light and dark modes

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Built with React, TypeScript, and Zustand
- Icons from emoji set
- Inspired by Trello, Notion, and productivity tools

## 📧 Support

For issues, feature requests, or questions:

- Open an issue on GitHub
- Check existing issues for solutions
- Review the documentation

---

**Made with ❤️ for productivity enthusiasts**
