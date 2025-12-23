// React is used for JSX compilation
import { useState } from 'react';
import BoardView from './components/BoardView';
import HistoryView from './components/HistoryView';
import SessionsView from './components/SessionsView';
import { useStorageSync } from './hooks/useStorageSync';
import './App.css';
import './components/HistoryView.css';
import './components/SessionsView.css';

function App() {
  useStorageSync(); // Initialize storage sync
  
  const [activeView, setActiveView] = useState<'board' | 'history' | 'sessions'>('board');
  
  return (
    <div className="app">
      <header className="app-header">
        <h1>TabBoard</h1>
        <nav className="app-nav">
          <button 
            className={activeView === 'board' ? 'nav-btn active' : 'nav-btn'}
            onClick={() => setActiveView('board')}
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
        </nav>
      </header>
      <main className="app-main">
        {activeView === 'board' ? <BoardView /> :
         activeView === 'history' ? <HistoryView /> :
         <SessionsView />}
      </main>
    </div>
  );
}

export default App;