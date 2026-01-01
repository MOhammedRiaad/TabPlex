import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useBoardStore } from '../store/boardStore';
import { SearchResult } from '../types';
import './SearchBar.css';

interface SearchBarProps {
    onResultClick?: (result: SearchResult) => void;
}

const SearchBar: React.FC<SearchBarProps> = ({ onResultClick }) => {
    const [query, setQuery] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const resultsRef = useRef<HTMLDivElement>(null);

    const { tabs, tasks, notes, folders, sessions } = useBoardStore();

    // Search across all items
    const results = useMemo((): SearchResult[] => {
        if (!query.trim()) return [];

        const lowerQuery = query.toLowerCase();
        const searchResults: SearchResult[] = [];

        // Search tabs
        tabs.forEach(tab => {
            if (
                tab.title.toLowerCase().includes(lowerQuery) ||
                tab.url.toLowerCase().includes(lowerQuery) ||
                tab.tags?.some(tag => tag.toLowerCase().includes(lowerQuery))
            ) {
                searchResults.push({
                    id: tab.id,
                    type: 'tab',
                    title: tab.title,
                    subtitle: tab.url,
                    url: tab.url,
                    tags: tab.tags,
                });
            }
        });

        // Search tasks
        tasks.forEach(task => {
            if (
                task.title.toLowerCase().includes(lowerQuery) ||
                task.description?.toLowerCase().includes(lowerQuery) ||
                task.tags?.some(tag => tag.toLowerCase().includes(lowerQuery))
            ) {
                searchResults.push({
                    id: task.id,
                    type: 'task',
                    title: task.title,
                    subtitle: `${task.status} • ${task.priority} priority`,
                    tags: task.tags,
                });
            }
        });

        // Search notes
        notes.forEach(note => {
            if (
                note.content.toLowerCase().includes(lowerQuery) ||
                note.tags?.some(tag => tag.toLowerCase().includes(lowerQuery))
            ) {
                const preview = note.content.substring(0, 50) + (note.content.length > 50 ? '...' : '');
                searchResults.push({
                    id: note.id,
                    type: 'note',
                    title: preview,
                    subtitle: new Date(note.createdAt).toLocaleDateString(),
                    tags: note.tags,
                });
            }
        });

        // Search folders
        folders.forEach(folder => {
            if (folder.name.toLowerCase().includes(lowerQuery)) {
                const tabCount = tabs.filter(t => t.folderId === folder.id).length;
                searchResults.push({
                    id: folder.id,
                    type: 'folder',
                    title: folder.name,
                    subtitle: `${tabCount} tab${tabCount !== 1 ? 's' : ''}`,
                });
            }
        });

        // Search sessions
        sessions.forEach(session => {
            if (
                session.name.toLowerCase().includes(lowerQuery) ||
                session.summary?.toLowerCase().includes(lowerQuery)
            ) {
                searchResults.push({
                    id: session.id,
                    type: 'session',
                    title: session.name,
                    subtitle: session.summary || `${session.tabIds.length} tabs`,
                });
            }
        });

        return searchResults.slice(0, 10); // Limit to 10 results
    }, [query, tabs, tasks, notes, folders, sessions]);

    // Handle keyboard navigation
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (!isOpen || results.length === 0) return;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setSelectedIndex(prev => (prev + 1) % results.length);
                break;
            case 'ArrowUp':
                e.preventDefault();
                setSelectedIndex(prev => (prev - 1 + results.length) % results.length);
                break;
            case 'Enter':
                e.preventDefault();
                if (results[selectedIndex]) {
                    handleResultClick(results[selectedIndex]);
                }
                break;
            case 'Escape':
                setIsOpen(false);
                inputRef.current?.blur();
                break;
        }
    }, [isOpen, results, selectedIndex]);

    const handleResultClick = (result: SearchResult) => {
        if (onResultClick) {
            onResultClick(result);
        }

        // Default behavior: open URL for tabs
        if (result.type === 'tab' && result.url) {
            window.open(result.url, '_blank');
        }

        setQuery('');
        setIsOpen(false);
    };

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (
                resultsRef.current &&
                !resultsRef.current.contains(e.target as Node) &&
                inputRef.current &&
                !inputRef.current.contains(e.target as Node)
            ) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Reset selected index when results change
    useEffect(() => {
        setSelectedIndex(0);
    }, [results]);

    const getTypeIcon = (type: SearchResult['type']) => {
        switch (type) {
            case 'tab': return '🌐';
            case 'task': return '✅';
            case 'note': return '📝';
            case 'folder': return '📁';
            case 'session': return '⏱️';
            default: return '📄';
        }
    };

    return (
        <div className="search-bar-container">
            <div className="search-input-wrapper">
                <span className="search-icon" aria-hidden="true">🔍</span>
                <input
                    ref={inputRef}
                    type="text"
                    className="search-input"
                    placeholder="Search tabs, tasks, notes..."
                    value={query}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        setIsOpen(true);
                    }}
                    onFocus={() => setIsOpen(true)}
                    onKeyDown={handleKeyDown}
                    aria-label="Search"
                    aria-expanded={isOpen}
                    aria-controls="search-results"
                    aria-activedescendant={results[selectedIndex]?.id}
                />
                {query && (
                    <button
                        className="search-clear"
                        onClick={() => {
                            setQuery('');
                            inputRef.current?.focus();
                        }}
                        aria-label="Clear search"
                    >
                        ✕
                    </button>
                )}
            </div>

            {isOpen && results.length > 0 && (
                <div
                    ref={resultsRef}
                    id="search-results"
                    className="search-results"
                    role="listbox"
                >
                    {results.map((result, index) => (
                        <div
                            key={result.id}
                            id={result.id}
                            className={`search-result-item ${index === selectedIndex ? 'selected' : ''}`}
                            onClick={() => handleResultClick(result)}
                            role="option"
                            aria-selected={index === selectedIndex}
                        >
                            <span className="result-icon">{getTypeIcon(result.type)}</span>
                            <div className="result-content">
                                <div className="result-title">{result.title}</div>
                                {result.subtitle && (
                                    <div className="result-subtitle">{result.subtitle}</div>
                                )}
                            </div>
                            <span className="result-type">{result.type}</span>
                        </div>
                    ))}
                </div>
            )}

            {isOpen && query && results.length === 0 && (
                <div className="search-results">
                    <div className="search-no-results">No results found</div>
                </div>
            )}
        </div>
    );
};

export default SearchBar;
