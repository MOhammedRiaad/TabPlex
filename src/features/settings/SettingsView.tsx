import React, { useState, useCallback } from 'react';
import { useTheme } from '../../hooks/useTheme';
import { clearAllData } from '../../utils/storage';
import ThemeToggle from '../ui/components/ThemeToggle';
import Toast from '../bookmarks/components/Toast';
import { useParkResumeSettings } from '../tasks/hooks/useParkResumeSettings';
import AiSummarySetting from './components/AiSummarySetting';
import AiFeaturesSetting from '../ai/components/AiFeaturesSetting';
import BoardStyleSetting from './components/BoardStyleSetting';
import { DISPLAY_NAME_KEY, DISPLAY_NAME_MAX, saveDisplayName } from './utils/displayName';
import './SettingsView.css';

interface SettingsViewProps {
    onExport: () => void;
    onImportClick: () => void;
    onImportFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
    fileInputRef: React.RefObject<HTMLInputElement | null>;
}

const SettingsView: React.FC<SettingsViewProps> = ({ onExport, onImportClick, onImportFile, fileInputRef }) => {
    const { theme, resolvedTheme } = useTheme();
    const { settings: parkSettings, updateSettings: updateParkSettings } = useParkResumeSettings();

    // Local state for tldraw settings
    const [canvasMode, setCanvasMode] = useState(localStorage.getItem('tabboard_canvas_mode') || 'custom');
    const [tldrawMode, setTldrawMode] = useState(localStorage.getItem('tabboard_tldraw_mode') || 'offline');
    const [tldrawPersistence, setTldrawPersistence] = useState(
        localStorage.getItem('tabboard_tldraw_persistence') || 'indexeddb'
    );
    const [tldrawRoom, setTldrawRoom] = useState(localStorage.getItem('tabboard_tldraw_room') || '');
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
    // As typed (not trimmed), so spaces between words survive; the greeting trims it
    const [displayName, setDisplayName] = useState(() => localStorage.getItem(DISPLAY_NAME_KEY) ?? '');

    const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
        setToast({ message, type });
    }, []);

    const handleClearData = async () => {
        // Made function async
        if (window.confirm('Are you sure you want to clear all data? This action cannot be undone.')) {
            try {
                localStorage.clear();
                if (typeof chrome !== 'undefined' && chrome.storage) {
                    await chrome.storage.local.clear(); // Await chrome storage clear
                }
                await clearAllData(); // Call clearAllData
                showToast('All data cleared. Reloading...', 'success');
                setTimeout(() => window.location.reload(), 1500);
            } catch (error) {
                console.error('Error clearing data:', error);
                showToast('Failed to clear data', 'error');
            }
        }
    };

    const handleCanvasModeChange = (value: string) => {
        setCanvasMode(value);
        setHasUnsavedChanges(true);
    };

    const handleTldrawModeChange = (value: string) => {
        setTldrawMode(value);
        setHasUnsavedChanges(true);
    };

    const handleTldrawPersistenceChange = (value: string) => {
        setTldrawPersistence(value);
        setHasUnsavedChanges(true);
    };

    const handleTldrawRoomChange = (value: string) => {
        setTldrawRoom(value);
        setHasUnsavedChanges(true);
    };

    const handleSaveCanvasSettings = () => {
        const oldCanvasMode = localStorage.getItem('tabboard_canvas_mode');

        localStorage.setItem('tabboard_canvas_mode', canvasMode);
        localStorage.setItem('tabboard_tldraw_mode', tldrawMode);
        localStorage.setItem('tabboard_tldraw_persistence', tldrawPersistence);
        localStorage.setItem('tabboard_tldraw_room', tldrawRoom);

        setHasUnsavedChanges(false);

        // If canvas mode changed, reload
        if (oldCanvasMode !== canvasMode) {
            showToast('Canvas mode changed. Reloading...', 'success');
            setTimeout(() => window.location.reload(), 1500);
        } else {
            showToast('Canvas settings saved successfully!', 'success');
        }
    };

    const handleResetCanvasSettings = () => {
        setCanvasMode(localStorage.getItem('tabboard_canvas_mode') || 'custom');
        setTldrawMode(localStorage.getItem('tabboard_tldraw_mode') || 'offline');
        setTldrawPersistence(localStorage.getItem('tabboard_tldraw_persistence') || 'indexeddb');
        setTldrawRoom(localStorage.getItem('tabboard_tldraw_room') || '');
        setHasUnsavedChanges(false);
    };

    return (
        <div className="settings-view">
            <div className="settings-header">
                <h2>Settings</h2>
                <p className="settings-subtitle">Manage your TabBoard preferences and data</p>
            </div>

            <div className="settings-content">
                {/* Profile Section */}
                <section className="settings-section">
                    <h3 className="section-title">
                        <span className="section-icon">👤</span>
                        Profile
                    </h3>
                    <div className="section-content">
                        <div className="setting-item">
                            <div className="setting-info">
                                <h4>Your name</h4>
                                <p>Used in the Today greeting. Stored only in this browser.</p>
                            </div>
                            <div className="setting-control">
                                <input
                                    type="text"
                                    className="setting-input"
                                    aria-label="Your name"
                                    placeholder="e.g. Ada"
                                    maxLength={DISPLAY_NAME_MAX}
                                    value={displayName}
                                    onChange={e => {
                                        setDisplayName(e.target.value);
                                        saveDisplayName(e.target.value);
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                </section>

                {/* Boards Section */}
                <section className="settings-section">
                    <h3 className="section-title">
                        <span className="section-icon">🗂</span>
                        Boards
                    </h3>
                    <div className="section-content">
                        <BoardStyleSetting />
                    </div>
                </section>

                {/* Data Management Section */}
                <section className="settings-section">
                    <h3 className="section-title">
                        <span className="section-icon">💾</span>
                        Data Management
                    </h3>
                    <div className="section-content">
                        <div className="setting-item">
                            <div className="setting-info">
                                <h4>Export Data</h4>
                                <p>Download all your boards, tabs, tasks, and notes as a JSON file</p>
                            </div>
                            <button className="setting-action-btn primary" onClick={onExport}>
                                📤 Export
                            </button>
                        </div>

                        <div className="setting-item">
                            <div className="setting-info">
                                <h4>Import Data</h4>
                                <p>Restore data from a previously exported JSON file</p>
                            </div>
                            <button className="setting-action-btn primary" onClick={onImportClick}>
                                📥 Import
                            </button>
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={onImportFile}
                                accept=".json"
                                style={{ display: 'none' }}
                            />
                        </div>

                        <div className="setting-item danger">
                            <div className="setting-info">
                                <h4>Clear All Data</h4>
                                <p>Permanently delete all your data (cannot be undone)</p>
                            </div>
                            <button className="setting-action-btn danger" onClick={handleClearData}>
                                🗑️ Clear Data
                            </button>
                        </div>
                    </div>
                </section>

                {/* Park & Resume Section */}
                <section className="settings-section">
                    <h3 className="section-title">
                        <span className="section-icon">⏸</span>
                        Park &amp; Resume
                    </h3>
                    <div className="section-content">
                        <div className="setting-item">
                            <div className="setting-info">
                                <h4>Close tabs when parking</h4>
                                <p>
                                    Parking saves a task&apos;s tabs and closes them to free memory. Turn off to just
                                    ungroup them.
                                </p>
                            </div>
                            <div className="setting-control">
                                <input
                                    type="checkbox"
                                    className="setting-checkbox"
                                    aria-label="Close tabs when parking"
                                    checked={parkSettings.closeTabsOnPark}
                                    onChange={e => updateParkSettings({ closeTabsOnPark: e.target.checked })}
                                />
                            </div>
                        </div>
                        <div className="setting-item">
                            <div className="setting-info">
                                <h4>Add new tabs to the active task</h4>
                                <p>Tabs you open while a task is active join its tab group automatically.</p>
                            </div>
                            <div className="setting-control">
                                <input
                                    type="checkbox"
                                    className="setting-checkbox"
                                    aria-label="Add new tabs to the active task"
                                    checked={parkSettings.autoAddNewTabs}
                                    onChange={e => updateParkSettings({ autoAddNewTabs: e.target.checked })}
                                />
                            </div>
                        </div>
                        <div className="setting-item">
                            <div className="setting-info">
                                <h4>Suggest a task for new tabs</h4>
                                <p>
                                    When a page you open matches a parked task&apos;s sites, TabPlex offers to add it.
                                    Uses notifications; matching happens on your device.
                                </p>
                            </div>
                            <div className="setting-control">
                                <input
                                    type="checkbox"
                                    className="setting-checkbox"
                                    aria-label="Suggest a task for new tabs"
                                    checked={parkSettings.suggestTasksForTabs}
                                    onChange={e => updateParkSettings({ suggestTasksForTabs: e.target.checked })}
                                />
                            </div>
                        </div>
                        <div className="setting-item">
                            <div className="setting-info">
                                <h4>Start a Pomodoro when a task starts</h4>
                                <p>
                                    Starting or resuming a task links the focus timer to it and starts a work session.
                                    Parking pauses it.
                                </p>
                            </div>
                            <div className="setting-control">
                                <input
                                    type="checkbox"
                                    className="setting-checkbox"
                                    aria-label="Start a Pomodoro when a task starts"
                                    checked={parkSettings.startPomodoroOnStart}
                                    onChange={e => updateParkSettings({ startPomodoroOnStart: e.target.checked })}
                                />
                            </div>
                        </div>
                        <AiSummarySetting
                            enabled={parkSettings.aiSummaries}
                            onChange={aiSummaries => updateParkSettings({ aiSummaries })}
                        />
                    </div>
                </section>

                {/* On-device AI Section */}
                <section className="settings-section">
                    <h3 className="section-title">
                        <span className="section-icon">✨</span>
                        On-device AI
                    </h3>
                    <div className="section-content">
                        <AiFeaturesSetting />
                    </div>
                </section>

                {/* Appearance Section */}
                <section className="settings-section">
                    <h3 className="section-title">
                        <span className="section-icon">🎨</span>
                        Appearance
                    </h3>
                    <div className="section-content">
                        <div className="setting-item">
                            <div className="setting-info">
                                <h4>Theme</h4>
                                <p>Choose your preferred color theme</p>
                                <p className="setting-status">
                                    Current: {theme === 'system' ? `System (${resolvedTheme})` : theme}
                                </p>
                            </div>
                            <div className="setting-control">
                                <ThemeToggle />
                            </div>
                        </div>

                        <div className="setting-item">
                            <div className="setting-info">
                                <h4>Canvas Mode</h4>
                                <p>Choose your preferred canvas engine</p>
                            </div>
                            <div className="setting-control">
                                <select
                                    className="setting-select"
                                    value={canvasMode}
                                    onChange={e => handleCanvasModeChange(e.target.value)}
                                >
                                    <option value="custom">Custom Canvas (Lightweight)</option>
                                    <option value="tldraw">tldraw (Professional)</option>
                                </select>
                            </div>
                        </div>

                        {canvasMode === 'tldraw' && (
                            <>
                                <div className="setting-item">
                                    <div className="setting-info">
                                        <h4>tldraw Mode</h4>
                                        <p>Choose between offline or online collaborative mode</p>
                                    </div>
                                    <div className="setting-control">
                                        <select
                                            className="setting-select"
                                            value={tldrawMode}
                                            onChange={e => handleTldrawModeChange(e.target.value)}
                                        >
                                            <option value="offline">Offline (Local Only)</option>
                                            <option value="online">Online (Collaborative)</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="setting-item">
                                    <div className="setting-info">
                                        <h4>Data Persistence</h4>
                                        <p>How tldraw should save your work</p>
                                    </div>
                                    <div className="setting-control">
                                        <select
                                            className="setting-select"
                                            value={tldrawPersistence}
                                            onChange={e => handleTldrawPersistenceChange(e.target.value)}
                                        >
                                            <option value="indexeddb">IndexedDB (Recommended)</option>
                                            <option value="localstorage">LocalStorage</option>
                                            <option value="memory">Memory Only (No Save)</option>
                                        </select>
                                    </div>
                                </div>

                                {tldrawMode === 'online' && (
                                    <div className="setting-item">
                                        <div className="setting-info">
                                            <h4>Collaboration Room</h4>
                                            <p>Room name for real-time collaboration</p>
                                        </div>
                                        <div className="setting-control">
                                            <input
                                                type="text"
                                                className="setting-input"
                                                placeholder="my-project-room"
                                                value={tldrawRoom}
                                                onChange={e => handleTldrawRoomChange(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Save/Reset Buttons */}
                                <div
                                    className="setting-item"
                                    style={{
                                        borderTop: '1px solid var(--color-border)',
                                        paddingTop: '1rem',
                                        marginTop: '1rem',
                                    }}
                                >
                                    <div className="setting-info">
                                        <h4>Canvas Configuration</h4>
                                        <p>Save or reset your canvas settings</p>
                                        {hasUnsavedChanges && (
                                            <p className="setting-status" style={{ color: 'var(--color-warning)' }}>
                                                ⚠️ You have unsaved changes
                                            </p>
                                        )}
                                    </div>
                                    <div className="setting-control" style={{ gap: '0.5rem', display: 'flex' }}>
                                        <button
                                            className="setting-action-btn primary"
                                            onClick={handleSaveCanvasSettings}
                                            disabled={!hasUnsavedChanges}
                                        >
                                            💾 Save Settings
                                        </button>
                                        <button
                                            className="setting-action-btn"
                                            onClick={handleResetCanvasSettings}
                                            disabled={!hasUnsavedChanges}
                                        >
                                            ↺ Reset
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </section>

                {/* Help & Support Section */}
                <section className="settings-section">
                    <h3 className="section-title">
                        <span className="section-icon">❓</span>
                        Help & Support
                    </h3>
                    <div className="section-content">
                        <div className="setting-item">
                            <div className="setting-info">
                                <h4>Show Onboarding</h4>
                                <p>View the welcome guide and learn about TabBoard features</p>
                            </div>
                            <button
                                className="setting-action-btn primary"
                                onClick={() => {
                                    const onboardingUrl = chrome.runtime.getURL('onboarding.html');
                                    chrome.tabs.create({ url: onboardingUrl });
                                }}
                            >
                                🎓 Open Guide
                            </button>
                        </div>
                    </div>
                </section>

                {/* About Section */}
                <section className="settings-section">
                    <h3 className="section-title">
                        <span className="section-icon">ℹ️</span>
                        About
                    </h3>
                    <div className="section-content">
                        <div className="setting-item">
                            <div className="setting-info">
                                <h4>TabBoard</h4>
                                <p>Version 1.0.0</p>
                                <p>
                                    A powerful browser extension for organizing your tabs, tasks, and browsing sessions
                                </p>
                            </div>
                        </div>
                    </div>
                </section>
            </div>

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    );
};

export default SettingsView;
