// React is used for JSX compilation
import React, { useState, useRef } from 'react';
import BoardView from './components/BoardView';
import HistoryView from './components/HistoryView';
import SessionsView from './components/SessionsView';
import TodayView from './components/TodayView';
import { useStorageSync } from './hooks/useStorageSync';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { downloadExportFile, importFromFile } from './utils/exportImport';
import './App.css';
import './components/HistoryView.css';
import './components/SessionsView.css';

function App() {
  useStorageSync(); // Initialize storage sync
  
  const [activeView, setActiveView] = useState<'boards' | 'history' | 'sessions' | 'today'>('today');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Use keyboard shortcuts
  useKeyboardShortcuts(activeView as 'boards' | 'history' | 'sessions' | 'today', setActiveView);
  
  const handleExport = async () => {
    try {
      await downloadExportFile();
      alert('Data exported successfully!');
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed. Please try again.');
    }
  };
  
  const handleImportClick = () => {
    fileInputRef.current?.click();
  };
  
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        await importFromFile(file);
        alert('Data imported successfully! The extension will reload to reflect changes.');
        window.location.reload(); // Reload to refresh all data
      } catch (error) {
        console.error('Import failed:', error);
        alert('Import failed. Please check the file format and try again.');
      }
    }
    // Reset the input so the same file can be imported again if needed
    e.target.value = '';
  };
  
  // Listen for export event from keyboard shortcuts
  React.useEffect(() => {
    const handleExportEvent = () => {
      handleExport();
    };
    
    window.addEventListener('exportData', handleExportEvent);
    
    return () => {
      window.removeEventListener('exportData', handleExportEvent);
    };
  }, []);
  
  return (
    <div className="app">
      <header className="app-header">
        <h1>TabBoard</h1>
        <nav className="app-nav">
          <button 
            className={activeView === 'today' ? 'nav-btn active' : 'nav-btn'}
            onClick={() => setActiveView('today')}
          >
            Today
          </button>
          <button 
            className={activeView === 'boards' ? 'nav-btn active' : 'nav-btn'}
            onClick={() => setActiveView('boards')}
          >
            Boards
          </button>
          <button 
            className={activeView === 'history' ? 'nav-btn active' : 'nav-btn'}
            onClick={() => setActiveView('history')}
          >
            History
          </button>
          <button 
            className={activeView === 'sessions' ? 'nav-btn active' : 'nav-btn'}
            onClick={() => setActiveView('sessions')}
          >
            Sessions
          </button>
          
          <div className="export-import">
            <button className="nav-btn" onClick={handleExport} title="Export Data (Ctrl+Shift+E)">
              📤 Export
            </button>
            <button className="nav-btn" onClick={handleImportClick} title="Import Data">
              📥 Import
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImport}
              accept=".json"
              style={{ display: 'none' }}
            />
          </div>
        </nav>
      </header>
      <main className="app-main">
        {activeView === 'boards' ? <BoardView /> :
         activeView === 'history' ? <HistoryView /> :
         activeView === 'sessions' ? <SessionsView /> :
         <TodayView />}
      </main>
    </div>
  );
}

export default App;