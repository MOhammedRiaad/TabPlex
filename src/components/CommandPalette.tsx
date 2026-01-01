import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useBoardStore } from '../store/boardStore';
import { Command } from '../types';
import { generateTaskId, generateNoteId, generateFolderId } from '../utils/idGenerator';
import './CommandPalette.css';

interface CommandPaletteProps {
    isOpen: boolean;
    onClose: () => void;
    onNavigate: (view: 'boards' | 'history' | 'sessions' | 'today' | 'analytics') => void;
}

const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose, onNavigate }) => {
    const [query, setQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    const { addTask, addNote, addFolder, boards } = useBoardStore();

    const commands = useMemo((): Command[] => [
        // Navigation commands
        {
            id: 'nav-today',
            name: 'Go to Today',
            shortcut: 'Ctrl+Shift+T',
            icon: '📅',
            action: () => onNavigate('today'),
            category: 'navigation',
        },
        {
            id: 'nav-boards',
            name: 'Go to Boards',
            shortcut: 'Ctrl+Shift+B',
            icon: '📋',
            action: () => onNavigate('boards'),
            category: 'navigation',
        },
        {
            id: 'nav-history',
            name: 'Go to History',
            shortcut: 'Ctrl+Shift+H',
            icon: '📜',
            action: () => onNavigate('history'),
            category: 'navigation',
        },
        {
            id: 'nav-sessions',
            name: 'Go to Sessions',
            shortcut: 'Ctrl+Shift+S',
            icon: '⏱️',
            action: () => onNavigate('sessions'),
            category: 'navigation',
        },
        {
            id: 'nav-analytics',
            name: 'Go to Analytics',
            icon: '📊',
            action: () => onNavigate('analytics'),
            category: 'navigation',
        },
        // Creation commands
        {
            id: 'create-task',
            name: 'Create New Task',
            shortcut: 'Ctrl+Shift+K',
            icon: '✅',
            action: () => {
                addTask({
                    id: generateTaskId(),
                    title: 'New Task',
                    status: 'todo',
                    priority: 'medium',
                    boardId: boards[0]?.id,
                });
            },
            category: 'creation',
        },
        {
            id: 'create-note',
            name: 'Create New Note',
            shortcut: 'Ctrl+Shift+N',
            icon: '📝',
            action: () => {
                addNote({
                    id: generateNoteId(),
                    content: '',
                    format: 'text',
                    boardId: boards[0]?.id,
                });
            },
            category: 'creation',
        },
        {
            id: 'create-folder',
            name: 'Create New Folder',
            shortcut: 'Ctrl+Shift+F',
            icon: '📁',
            action: () => {
                if (boards[0]) {
                    addFolder({
                        id: generateFolderId(),
                        name: 'New Folder',
                        boardId: boards[0].id,
                        color: '#3b82f6',
                        order: 0,
                    });
                }
            },
            category: 'creation',
        },
        // Action commands
        {
            id: 'export-data',
            name: 'Export Data',
            shortcut: 'Ctrl+Shift+E',
            icon: '📤',
            action: () => {
                window.dispatchEvent(new CustomEvent('exportData'));
            },
            category: 'action',
        },
        {
            id: 'import-data',
            name: 'Import Data',
            icon: '📥',
            action: () => {
                window.dispatchEvent(new CustomEvent('importData'));
            },
            category: 'action',
        },
    ], [onNavigate, addTask, addNote, addFolder, boards]);

    // Filter commands based on query
    const filteredCommands = useMemo(() => {
        if (!query.trim()) return commands;

        const lowerQuery = query.toLowerCase();
        return commands.filter(cmd =>
            cmd.name.toLowerCase().includes(lowerQuery) ||
            cmd.category.toLowerCase().includes(lowerQuery)
        );
    }, [commands, query]);

    // Group commands by category
    const groupedCommands = useMemo(() => {
        const groups: Record<string, Command[]> = {};
        filteredCommands.forEach(cmd => {
            if (!groups[cmd.category]) {
                groups[cmd.category] = [];
            }
            groups[cmd.category].push(cmd);
        });
        return groups;
    }, [filteredCommands]);

    // Handle keyboard navigation
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setSelectedIndex(prev =>
                    (prev + 1) % filteredCommands.length
                );
                break;
            case 'ArrowUp':
                e.preventDefault();
                setSelectedIndex(prev =>
                    (prev - 1 + filteredCommands.length) % filteredCommands.length
                );
                break;
            case 'Enter':
                e.preventDefault();
                if (filteredCommands[selectedIndex]) {
                    filteredCommands[selectedIndex].action();
                    onClose();
                }
                break;
            case 'Escape':
                e.preventDefault();
                onClose();
                break;
        }
    }, [filteredCommands, selectedIndex, onClose]);

    // Focus input when opened
    useEffect(() => {
        if (isOpen) {
            setQuery('');
            setSelectedIndex(0);
            setTimeout(() => inputRef.current?.focus(), 0);
        }
    }, [isOpen]);

    // Reset selected index when filtered results change
    useEffect(() => {
        setSelectedIndex(0);
    }, [query]);

    // Scroll selected item into view
    useEffect(() => {
        if (listRef.current) {
            const selectedItem = listRef.current.querySelector('.command-item.selected');
            if (selectedItem) {
                selectedItem.scrollIntoView({ block: 'nearest' });
            }
        }
    }, [selectedIndex]);

    if (!isOpen) return null;

    const categoryLabels: Record<string, string> = {
        navigation: '🧭 Navigation',
        creation: '➕ Create',
        action: '⚡ Actions',
        settings: '⚙️ Settings',
    };

    let flatIndex = 0;

    return (
        <div className="command-palette-overlay" onClick={onClose}>
            <div
                className="command-palette"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-label="Command palette"
            >
                <div className="command-palette-header">
                    <span className="command-palette-icon">⌘</span>
                    <input
                        ref={inputRef}
                        type="text"
                        className="command-palette-input"
                        placeholder="Type a command or search..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                        aria-label="Command search"
                    />
                    <kbd className="command-palette-hint">ESC</kbd>
                </div>

                <div ref={listRef} className="command-palette-list" role="listbox">
                    {Object.entries(groupedCommands).map(([category, cmds]) => (
                        <div key={category} className="command-category">
                            <div className="command-category-label">
                                {categoryLabels[category] || category}
                            </div>
                            {cmds.map((cmd) => {
                                const currentIndex = flatIndex++;
                                return (
                                    <div
                                        key={cmd.id}
                                        className={`command-item ${currentIndex === selectedIndex ? 'selected' : ''}`}
                                        onClick={() => {
                                            cmd.action();
                                            onClose();
                                        }}
                                        role="option"
                                        aria-selected={currentIndex === selectedIndex}
                                    >
                                        <span className="command-icon">{cmd.icon}</span>
                                        <span className="command-name">{cmd.name}</span>
                                        {cmd.shortcut && (
                                            <kbd className="command-shortcut">{cmd.shortcut}</kbd>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ))}

                    {filteredCommands.length === 0 && (
                        <div className="command-no-results">
                            No commands found
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CommandPalette;
