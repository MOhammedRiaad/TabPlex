import { useEffect, useRef } from 'react';
import { useBoardStore } from '../store/boardStore';

export const useKeyboardShortcuts = (
    activeView: 'boards' | 'history' | 'sessions' | 'today',
    setActiveView: (view: 'boards' | 'history' | 'sessions' | 'today') => void
) => {
    // Only get the action functions from the store, not the data arrays
    const addTab = useBoardStore(state => state.addTab);
    const addTask = useBoardStore(state => state.addTask);
    const addNote = useBoardStore(state => state.addNote);
    const addFolder = useBoardStore(state => state.addFolder);

    const lastFolderAddTimeRef = useRef<number>(0);
    const isProcessingFolderRef = useRef<boolean>(false);
    const isProcessingTabRef = useRef<boolean>(false);
    const isProcessingNoteRef = useRef<boolean>(false);
    const isProcessingTaskRef = useRef<boolean>(false);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Prevent shortcuts from triggering when in input fields
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
                return;
            }

            // Ctrl/Cmd + Shift + B: Switch to Boards view
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'b') {
                e.preventDefault();
                setActiveView('boards');
            }
            // Ctrl/Cmd + Shift + H: Switch to History view
            else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'h') {
                e.preventDefault();
                setActiveView('history');
            }
            // Ctrl/Cmd + Shift + S: Switch to Sessions view
            else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 's') {
                e.preventDefault();
                setActiveView('sessions');
            }
            // Ctrl/Cmd + Shift + T: Switch to Today view
            else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 't') {
                e.preventDefault();
                setActiveView('today');
            }
            // Ctrl/Cmd + Shift + A: Add a new tab to the current context
            else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'a') {
                e.preventDefault();

                // Check if we're already processing a tab addition
                if (isProcessingTabRef.current) {
                    return; // Prevent multiple simultaneous additions
                }

                // Set processing flag
                isProcessingTabRef.current = true;

                // Get current state inside the handler to avoid dependency issues
                const state = useBoardStore.getState();

                // Add a new tab based on the current view
                if (activeView === 'boards') {
                    const currentBoard = state.boards[0]; // Use first board as default
                    const currentFolder = state.folders.find(f => f.boardId === currentBoard?.id);

                    addTab({
                        id: `tab_${Date.now()}`,
                        title: 'New Tab',
                        url: '',
                        favicon: '',
                        folderId: currentFolder?.id || '',
                        tabId: null,
                        lastAccessed: new Date().toISOString(),
                        status: 'open',
                    });
                } else if (activeView === 'today') {
                    // Add to today's context
                    addTab({
                        id: `tab_${Date.now()}`,
                        title: 'New Tab',
                        url: '',
                        favicon: '',
                        folderId: '',
                        tabId: null,
                        lastAccessed: new Date().toISOString(),
                        status: 'open',
                    });
                }

                // Reset the processing flag after a short delay
                setTimeout(() => {
                    isProcessingTabRef.current = false;
                }, 300);
            }
            // Ctrl/Cmd + Shift + N: Add a new note
            else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'n') {
                e.preventDefault();

                // Check if we're already processing a note addition
                if (isProcessingNoteRef.current) {
                    return; // Prevent multiple simultaneous additions
                }

                // Set processing flag
                isProcessingNoteRef.current = true;

                // Get current state inside the handler to avoid dependency issues
                const state = useBoardStore.getState();

                addNote({
                    id: `note_${Date.now()}`,
                    content: 'New note',
                    boardId: state.boards[0]?.id || undefined,
                    folderId: undefined,
                    tabId: undefined,
                    format: 'text',
                });

                // Reset the processing flag after a short delay
                setTimeout(() => {
                    isProcessingNoteRef.current = false;
                }, 300);
            }
            // Ctrl/Cmd + Shift + K: Add a new task
            else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'k') {
                e.preventDefault();

                // Check if we're already processing a task addition
                if (isProcessingTaskRef.current) {
                    return; // Prevent multiple simultaneous additions
                }

                // Set processing flag
                isProcessingTaskRef.current = true;

                // Get current state inside the handler to avoid dependency issues
                const state = useBoardStore.getState();

                addTask({
                    id: `task_${Date.now()}`,
                    title: 'New task',
                    status: 'todo',
                    priority: 'medium',
                    boardId: state.boards[0]?.id,
                    folderId: undefined,
                    tabIds: [],
                });

                // Reset the processing flag after a short delay
                setTimeout(() => {
                    isProcessingTaskRef.current = false;
                }, 300);
            }
            // Ctrl/Cmd + Shift + F: Add a new folder
            else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'f') {
                e.preventDefault();

                // Get current state inside the handler to avoid dependency issues
                const state = useBoardStore.getState();
                const currentBoard = state.boards[0]; // Use first board as default

                if (currentBoard) {
                    // Check if we're already processing a folder addition
                    if (isProcessingFolderRef.current) {
                        return; // Prevent multiple simultaneous additions
                    }

                    // Check if we just added a folder recently to prevent spam
                    const now = Date.now();
                    if (lastFolderAddTimeRef.current && now - lastFolderAddTimeRef.current < 300) {
                        return; // Prevent rapid additions
                    }

                    // Set processing flag to prevent simultaneous calls
                    isProcessingFolderRef.current = true;
                    lastFolderAddTimeRef.current = now;

                    addFolder({
                        id: `folder_${Date.now()}`,
                        name: 'New Folder',
                        boardId: currentBoard.id,
                        color: '#3b82f6',
                        order: state.folders.filter(f => f.boardId === currentBoard.id).length,
                    });

                    // Reset the processing flag after a short delay
                    setTimeout(() => {
                        isProcessingFolderRef.current = false;
                    }, 300);
                }
            }
            // Ctrl/Cmd + Shift + E: Export data
            else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'e') {
                e.preventDefault();
                // Export is handled in the App component, so we'll dispatch a custom event
                window.dispatchEvent(new CustomEvent('exportData'));
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [activeView, setActiveView, addTab, addTask, addNote, addFolder]);
};

export default useKeyboardShortcuts;
