import React, { useEffect, useState } from 'react';
import { useBoardStore } from '../store/boardStore';
import { Session } from '../types';

const SessionsView: React.FC = () => {
  const { sessions, fetchSessions, addSessionFromBackground, updateSessionFromBackground, deleteSessionFromBackground } = useBoardStore();
  const [newSessionName, setNewSessionName] = useState('');
  const [isCreatingSession, setIsCreatingSession] = useState(false);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const createSession = async () => {
    if (!newSessionName.trim()) return;

    const newSession: Omit<Session, 'createdAt'> = {
      id: `session_${Date.now()}`,
      name: newSessionName,
      tabIds: [], // Initially no tabs
      startTime: new Date().toISOString(),
      endTime: undefined,
      summary: undefined
    };

    await addSessionFromBackground(newSession);
    setNewSessionName('');
    setIsCreatingSession(false);
  };

  const startSessionFromCurrentTabs = async () => {
    try {
      // Get all currently open tabs in the browser
      const browserTabs = await chrome.tabs.query({ currentWindow: true, windowType: 'normal' });
      
      // Get all our stored tabs to match with browser tabs
      // For now, we'll just create a session with the current window's tabs
      const tabIds = browserTabs.map(tab => `tab_${Date.now()}_${tab.id}`);
      
      const newSession: Omit<Session, 'createdAt'> = {
        id: `session_${Date.now()}`,
        name: `Session ${new Date().toLocaleString()}`,
        tabIds: tabIds,
        startTime: new Date().toISOString(),
        endTime: undefined,
        summary: `Session with ${browserTabs.length} tabs from current window`
      };

      await addSessionFromBackground(newSession);
    } catch (error) {
      console.error('Error creating session from current tabs:', error);
    }
  };

  const inferSessions = async () => {
    try {
      // Get browser history to identify patterns
      const history = await chrome.history.search({
        text: '',
        startTime: Date.now() - (7 * 24 * 60 * 60 * 1000), // Last 7 days
        maxResults: 1000
      });
      
      // Group history items by domain and time proximity
      const domainGroups: { [key: string]: chrome.history.HistoryItem[] } = {};
      
      for (const item of history) {
        if (item.url) {
          try {
            const domain = new URL(item.url).hostname;
            
            // Filter out common domains that aren't meaningful for sessions
            if (!domain.includes('google') && !domain.includes('bing') && !domain.includes('duckduckgo')) {
              if (!domainGroups[domain]) {
                domainGroups[domain] = [];
              }
              domainGroups[domain].push(item);
            }
          } catch (e) {
            // Skip invalid URLs
            continue;
          }
        }
      }
      
      // Create sessions for domains with significant activity
      for (const [domain, items] of Object.entries(domainGroups)) {
        if (items.length >= 3) { // At least 3 visits to create a session
          // Group by time proximity (within 1 hour)
          const sortedItems = items.sort((a, b) => (b.lastVisitTime || 0) - (a.lastVisitTime || 0));
          
          // Find clusters of visits within 1 hour of each other
          const clusters: chrome.history.HistoryItem[][] = [];
          let currentCluster: chrome.history.HistoryItem[] = [sortedItems[0]];
          
          for (let i = 1; i < sortedItems.length; i++) {
            const prevTime = sortedItems[i - 1].lastVisitTime || 0;
            const currTime = sortedItems[i].lastVisitTime || 0;
            
            // If the time difference is less than 1 hour, add to same cluster
            if (Math.abs(prevTime - currTime) < 60 * 60 * 1000) {
              currentCluster.push(sortedItems[i]);
            } else {
              // Start a new cluster
              if (currentCluster.length >= 2) { // Only create session if cluster has 2+ items
                clusters.push([...currentCluster]);
              }
              currentCluster = [sortedItems[i]];
            }
          }
          
          // Add the last cluster
          if (currentCluster.length >= 2) {
            clusters.push(currentCluster);
          }
          
          // Create sessions for each cluster
          for (const cluster of clusters) {
            if (cluster.length >= 2) { // At least 2 related visits
              const startTime = new Date(Math.min(...cluster.map(item => item.lastVisitTime || Date.now()))).toISOString();
              const endTime = new Date(Math.max(...cluster.map(item => item.lastVisitTime || Date.now()))).toISOString();
              
              const newSession: Omit<Session, 'createdAt'> = {
                id: `session_${Date.now()}_${domain}_${startTime.substring(0, 10)}`,
                name: `${domain} - ${new Date(startTime).toLocaleDateString()}`,
                tabIds: [], // Will be populated with actual tab IDs if available
                startTime: startTime,
                endTime: endTime,
                summary: `Browsing session with ${cluster.length} related visits to ${domain}`
              };
              
              await addSessionFromBackground(newSession);
            }
          }
        }
      }
      
      // Also check for sessions based on recently closed tabs
      if (chrome.sessions) {
        const sessionData = await chrome.sessions.getRecentlyClosed({ maxResults: 10 });
        
        for (const session of sessionData) {
          if (session.tab) {
            const tabUrl = session.tab.url;
            if (tabUrl) {
              const domain = new URL(tabUrl).hostname;
              
              // Create a session for recently closed tabs from the same domain
              const existingSession = sessions.find(s => 
                s.name.includes(domain) && 
                new Date(s.startTime) > new Date(Date.now() - 24 * 60 * 60 * 1000) // Within last 24 hours
              );
              
              if (!existingSession) {
                const newSession: Omit<Session, 'createdAt'> = {
                  id: `session_${Date.now()}_${domain}_recent`,
                  name: `Recently Closed: ${domain}`,
                  tabIds: [`tab_${session.tab.windowId}_${session.tab.id}`],
                  startTime: new Date(session.tab.windowId ? session.tab.windowId * 1000 : Date.now()).toISOString(),
                  endTime: new Date().toISOString(),
                  summary: `Recently closed tab from ${domain}`
                };
                
                await addSessionFromBackground(newSession);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Error inferring sessions:', error);
    }
  };

  const endSession = async (sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId);
    if (session) {
      await updateSessionFromBackground(sessionId, {
        endTime: new Date().toISOString()
      });
    }
  };

  const deleteSession = async (sessionId: string) => {
    await deleteSessionFromBackground(sessionId);
  };

  return (
    <div className="sessions-view">
      <div className="sessions-header">
        <h2>Browser Sessions</h2>
        <div className="session-actions">
          <button onClick={startSessionFromCurrentTabs} className="btn-primary">
            Start Session from Current Tabs
          </button>
          <button onClick={inferSessions} className="btn-secondary">
            Infer Sessions from History
          </button>
        </div>
      </div>

      <div className="create-session-form">
        {isCreatingSession ? (
          <div className="session-input-group">
            <input
              type="text"
              value={newSessionName}
              onChange={(e) => setNewSessionName(e.target.value)}
              placeholder="Enter session name"
              className="session-input"
              autoFocus
            />
            <button onClick={createSession} className="btn-confirm">
              Create
            </button>
            <button 
              onClick={() => {
                setIsCreatingSession(false);
                setNewSessionName('');
              }} 
              className="btn-cancel"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button 
            onClick={() => setIsCreatingSession(true)} 
            className="btn-create-session"
          >
            + Create New Session
          </button>
        )}
      </div>

      <div className="sessions-list">
        {sessions.length === 0 ? (
          <p className="no-sessions">No sessions found. Create a new session or infer from history.</p>
        ) : (
          <div className="sessions-grid">
            {sessions.map((session) => (
              <div key={session.id} className="session-card">
                <div className="session-header">
                  <h3 className="session-name">{session.name}</h3>
                  <div className="session-actions">
                    {session.endTime ? (
                      <span className="session-status ended">Ended</span>
                    ) : (
                      <button 
                        onClick={() => endSession(session.id)}
                        className="btn-end-session"
                      >
                        End Session
                      </button>
                    )}
                    <button 
                      onClick={() => deleteSession(session.id)}
                      className="btn-delete-session"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                
                <div className="session-details">
                  <p className="session-start">
                    <strong>Started:</strong> {new Date(session.startTime).toLocaleString()}
                  </p>
                  {session.endTime && (
                    <p className="session-end">
                      <strong>Ended:</strong> {new Date(session.endTime).toLocaleString()}
                    </p>
                  )}
                  <p className="session-tab-count">
                    <strong>Tabs:</strong> {session.tabIds.length}
                  </p>
                  {session.summary && (
                    <p className="session-summary">
                      <strong>Summary:</strong> {session.summary}
                    </p>
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

export default SessionsView;