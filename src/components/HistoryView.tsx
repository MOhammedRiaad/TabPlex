import React, { useEffect, useState } from 'react';
import { useBoardStore } from '../store/boardStore';

const HistoryView: React.FC = () => {
  const { history, fetchHistory, fetchBrowserHistory, folders, addTab } = useBoardStore();
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<string | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<string>('');
  const [addedToFolder, setAddedToFolder] = useState<{[key: string]: boolean}>({});

  useEffect(() => {
    // Load history items when the component mounts
    fetchHistory();
  }, [fetchHistory]);

  const loadBrowserHistory = async () => {
    try {
      await fetchBrowserHistory();
    } catch (error) {
      console.error('Failed to load browser history:', error);
    }
  };
  
  const addToFolder = (historyItem: any) => {
    if (!selectedFolderId) {
      alert('Please select a folder first');
      return;
    }
    
    // Create a tab object from the history item
    const tabToAdd = {
      id: `tab_${Date.now()}_${historyItem.id}`,
      title: historyItem.title,
      url: historyItem.url,
      favicon: historyItem.favicon,
      folderId: selectedFolderId,
      tabId: null,
      lastAccessed: new Date().toISOString(),
      status: 'closed' as const, // Since it's from history
      createdAt: new Date().toISOString()
    };
    
    addTab(tabToAdd);
    
    // Mark this history item as added to a folder
    setAddedToFolder(prev => ({
      ...prev,
      [historyItem.id]: true
    }));
    
    // Reset the selection
    setSelectedHistoryItem(null);
    setSelectedFolderId('');
    
    alert(`Added "${historyItem.title}" to folder`);
  };

  return (
    <div className="history-view">
      <div className="history-header">
        <h2>Browser History</h2>
        <button onClick={loadBrowserHistory} className="load-history-btn">
          Load Recent History
        </button>
      </div>
      
      <div className="history-list">
        {history.length === 0 ? (
          <p className="no-history">No history items found. Click "Load Recent History" to fetch browser history.</p>
        ) : (
          <div className="history-grid">
            {history.map((item) => (
              <div key={item.id} className="history-item">
                <a 
                  href={item.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="history-link"
                >
                  <div className="history-content">
                    {item.favicon && (
                      <img 
                        src={item.favicon} 
                        alt="Favicon" 
                        className="history-favicon"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                        }}
                      />
                    )}
                    <div className="history-text">
                      <h3 className="history-title">{item.title}</h3>
                      <p className="history-url">{item.url}</p>
                      {item.lastVisitTime && (
                        <p className="history-time">
                          Visited: {new Date(item.lastVisitTime).toLocaleString()}
                        </p>
                      )}
                      {item.visitCount !== undefined && (
                        <p className="history-count">Visits: {item.visitCount}</p>
                      )}
                    </div>
                  </div>
                </a>
                <div className="history-actions">
                  {addedToFolder[item.id] ? (
                    <div className="added-indicator">
                      <span className="added-text">✓ Added to folder</span>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          // You could implement modify functionality here if needed
                          alert(`Item "${item.title}" has been added to a folder`);
                        }}
                        className="modify-btn"
                      >
                        Modify
                      </button>
                    </div>
                  ) : (
                    <>
                      <select 
                        value={selectedHistoryItem === item.id ? (selectedFolderId || '') : ''}
                        onChange={(e) => {
                          setSelectedHistoryItem(item.id);
                          setSelectedFolderId(e.target.value);
                        }}
                        className="folder-select"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <option value="">Select folder...</option>
                        {folders.map(folder => (
                          <option key={folder.id} value={folder.id}>
                            {folder.name}
                          </option>
                        ))}
                      </select>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          addToFolder(item);
                        }}
                        className="add-to-folder-btn"
                        disabled={!selectedFolderId || selectedHistoryItem !== item.id}
                      >
                        Add to Folder
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default HistoryView;