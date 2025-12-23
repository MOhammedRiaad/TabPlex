// React is used for JSX compilation
import BoardView from './components/BoardView';
import { useStorageSync } from './hooks/useStorageSync';
import './App.css';

function App() {
  useStorageSync(); // Initialize storage sync
  
  return (
    <div className="app">
      <header className="app-header">
        <h1>TabBoard</h1>
      </header>
      <main className="app-main">
        <BoardView />
      </main>
    </div>
  );
}

export default App;