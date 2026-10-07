import React, { useEffect, useState, useCallback } from 'react';
import { useBoardStore } from '../../store/boardStore';
import { Session } from '../../types';
import './SessionsView.css';
import SessionHeader from './components/SessionHeader';
import CreateSessionForm from './components/CreateSessionForm';
import SessionList from './components/SessionList';
import Toast from '../bookmarks/components/Toast';
import { useAiSettings } from '../ai/hooks/useAiSettings';
import { useModelAvailability } from '../ai/hooks/useModelAvailability';
import { AiSession, createSession as createAiSession } from '../ai/utils/promptApi';
import {
    SESSION_NAME_MAX,
    SESSION_NAME_SYSTEM_PROMPT,
    fallbackSessionName,
    suggestSessionName,
} from './utils/sessionName';

const releaseAi = (ai: Promise<AiSession>) => ai.then(session => session.destroy()).catch(() => undefined);

const SessionsView: React.FC = () => {
    const {
        sessions,
        fetchSessions,
        addSessionFromBackground,
        updateSessionFromBackground,
        deleteSessionFromBackground,
    } = useBoardStore();

    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

    const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
        setToast({ message, type });
    }, []);

    useEffect(() => {
        fetchSessions();
    }, [fetchSessions]);

    const { settings: aiSettings } = useAiSettings();
    const { availability } = useModelAvailability();
    const canNameWithAi =
        aiSettings.sessionNames &&
        (availability === 'available' || availability === 'downloadable' || availability === 'downloading');

    /** Start an AI naming session. Call synchronously in a click: Chrome needs user activation for the model. */
    const startAiNaming = () => {
        if (!canNameWithAi) return null;
        const ai = createAiSession(SESSION_NAME_SYSTEM_PROMPT);
        ai.catch(() => undefined); // failures surface where it's awaited
        return ai;
    };

    /** Saved tabs of a session, for naming it */
    const sessionTabs = (session: Session) => {
        const { tabs } = useBoardStore.getState();
        return session.tabIds
            .map(id => tabs.find(tab => tab.id === id))
            .filter((tab): tab is NonNullable<typeof tab> => Boolean(tab))
            .map(tab => ({ title: tab.title, url: tab.url }));
    };

    const renameSession = async (id: string, name: string) => {
        const clean = name.trim().slice(0, SESSION_NAME_MAX);
        if (!clean) return;
        await updateSessionFromBackground(id, { name: clean });
    };

    /** ✨ Suggest a name (from a click): the AI name, or undefined when AI can't be used */
    const suggestName = (session: Session): Promise<string> | undefined => {
        const ai = startAiNaming();
        if (!ai) return undefined;
        return suggestSessionName(ai, sessionTabs(session)).finally(() => releaseAi(ai));
    };

    const createSession = async (name: string) => {
        if (!name.trim()) return;

        const newSession: Omit<Session, 'createdAt'> = {
            id: `session_${Date.now()}`,
            name: name,
            tabIds: [], // Initially no tabs
            startTime: new Date().toISOString(),
            endTime: undefined,
            summary: undefined,
        };

        await addSessionFromBackground(newSession);
    };

    const startSessionFromCurrentTabs = async () => {
        const ai = startAiNaming(); // before any await
        try {
            // Get all currently open tabs in the browser
            const browserTabs = await chrome.tabs.query({ currentWindow: true, windowType: 'normal' });

            // Create actual tab objects and add them to the store if they don't exist
            const { tabs, addTab } = useBoardStore.getState();
            const tabIds = [];

            for (const browserTab of browserTabs) {
                // Check if this tab already exists in our store
                const existingTab = tabs.find(tab => tab.tabId === browserTab.id);

                if (existingTab) {
                    // If it exists, use the existing tab ID
                    tabIds.push(existingTab.id);
                } else {
                    // If it doesn't exist, create a new tab entry
                    const tabId = `tab_${Date.now()}_${browserTab.id}`;
                    const newTab = {
                        id: tabId,
                        title: browserTab.title || browserTab.url || '',
                        url: browserTab.url || '',
                        favicon: browserTab.favIconUrl,
                        folderId: '', // No folder association for session tabs
                        tabId: browserTab.id || null,
                        lastAccessed: new Date().toISOString(),
                        status: 'open' as const,
                        createdAt: new Date().toISOString(),
                    };

                    // Add the tab to the store
                    await addTab(newTab);
                    tabIds.push(tabId);
                }
            }

            const newSession: Omit<Session, 'createdAt'> = {
                id: `session_${Date.now()}`,
                name: fallbackSessionName(
                    browserTabs.map(tab => ({ url: tab.url || '' })),
                    new Date()
                ),
                tabIds: tabIds,
                startTime: new Date().toISOString(),
                endTime: undefined,
                summary: `Session with ${browserTabs.length} tabs from current window`,
            };

            await addSessionFromBackground(newSession);

            // Saved already with the readable default; replace it with the AI name when that arrives
            if (ai) {
                const named = browserTabs.map(tab => ({ title: tab.title || tab.url || '', url: tab.url || '' }));
                suggestSessionName(ai, named)
                    .then(name => updateSessionFromBackground(newSession.id, { name }))
                    .catch(() => undefined)
                    .finally(() => releaseAi(ai));
            }
        } catch (error) {
            if (ai) releaseAi(ai);
            console.error('Error creating session from current tabs:', error);
        }
    };

    const inferSessions = async () => {
        try {
            // Get browser history to identify patterns
            const history = await chrome.history.search({
                text: '',
                startTime: Date.now() - 7 * 24 * 60 * 60 * 1000, // Last 7 days
                maxResults: 1000,
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
                    } catch {
                        // Skip invalid URLs
                        continue;
                    }
                }
            }

            // Create sessions for domains with significant activity
            for (const [domain, items] of Object.entries(domainGroups)) {
                if (items.length >= 3) {
                    // At least 3 visits to create a session
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
                            if (currentCluster.length >= 2) {
                                // Only create session if cluster has 2+ items
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
                        if (cluster.length >= 2) {
                            // At least 2 related visits
                            const startTime = new Date(
                                Math.min(...cluster.map(item => item.lastVisitTime || Date.now()))
                            ).toISOString();
                            const endTime = new Date(
                                Math.max(...cluster.map(item => item.lastVisitTime || Date.now()))
                            ).toISOString();

                            const newSession: Omit<Session, 'createdAt'> = {
                                id: `session_${Date.now()}_${domain}_${startTime.substring(0, 10)}`,
                                name: `${domain} - ${new Date(startTime).toLocaleDateString()}`,
                                tabIds: [], // Inferred sessions from history won't have stored tab IDs
                                startTime: startTime,
                                endTime: endTime,
                                summary: `Browsing session with ${cluster.length} related visits to ${domain}`,
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
                            const existingSession = sessions.find(
                                s =>
                                    s.name.includes(domain) &&
                                    new Date(s.startTime) > new Date(Date.now() - 24 * 60 * 60 * 1000) // Within last 24 hours
                            );

                            if (!existingSession) {
                                const newSession: Omit<Session, 'createdAt'> = {
                                    id: `session_${Date.now()}_${domain}_recent`,
                                    name: `Recently Closed: ${domain}`,
                                    tabIds: [], // Recently closed tabs don't have stored tab IDs
                                    startTime: new Date(
                                        session.tab.windowId ? session.tab.windowId * 1000 : Date.now()
                                    ).toISOString(),
                                    endTime: new Date().toISOString(),
                                    summary: `Recently closed tab from ${domain}`,
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
                endTime: new Date().toISOString(),
            });
        }
    };

    const deleteSession = async (sessionId: string) => {
        await deleteSessionFromBackground(sessionId);
    };

    const restoreSession = async (session: Session) => {
        try {
            // Get all our stored tabs
            const { tabs, addTab } = useBoardStore.getState();

            // Check if tabIds exists before filtering
            if (!session.tabIds) {
                showToast('This session has no tabs to restore.', 'error');
                return;
            }

            // First, get tabs that already exist in the store
            const existingSessionTabs = tabs.filter(tab => session.tabIds.includes(tab.id));

            // Find tab IDs that don't exist in the store
            const missingTabIds = session.tabIds.filter(tabId => !tabs.some(tab => tab.id === tabId));

            // If there are missing tabs, try to get browser tab info to recreate them
            const missingTabs = [];
            if (missingTabIds.length > 0) {
                // Extract browser tab IDs from the missing tab IDs (format: tab_timestamp_browserTabId)
                const browserTabIds = missingTabIds
                    .map(id => {
                        const parts = id.split('_');
                        if (parts.length >= 3) {
                            return parseInt(parts[parts.length - 1]); // Last part should be the browser tab ID
                        }
                        return null;
                    })
                    .filter(id => id !== null);

                // Get info about these browser tabs if they're still open
                for (const browserTabId of browserTabIds) {
                    try {
                        const browserTab = await chrome.tabs.get(browserTabId);
                        if (browserTab) {
                            const newTab = {
                                id: `tab_${Date.now()}_${browserTabId}`,
                                title: browserTab.title || browserTab.url || '',
                                url: browserTab.url || '',
                                favicon: browserTab.favIconUrl,
                                folderId: '',
                                tabId: browserTabId,
                                lastAccessed: new Date().toISOString(),
                                status: 'open' as const,
                                createdAt: new Date().toISOString(),
                            };

                            // Add the tab to the store
                            await addTab(newTab);
                            missingTabs.push(newTab);
                        }
                    } catch (error) {
                        console.warn(`Could not get browser tab with ID ${browserTabId}:`, error);
                        // If the browser tab doesn't exist, we can't restore it
                    }
                }
            }

            // Combine existing and recreated tabs
            const allSessionTabs = [...existingSessionTabs, ...missingTabs];

            // Open each tab in the session
            for (const tab of allSessionTabs) {
                await chrome.tabs.create({ url: tab.url, active: false });
            }

            console.log(`Restored ${allSessionTabs.length} tabs from session: ${session.name}`);
            showToast(`Restored ${allSessionTabs.length} tabs from session: ${session.name}`, 'success');
        } catch (error) {
            console.error('Error restoring session:', error);
            showToast('Error restoring session. Please try again.', 'error');
        }
    };

    return (
        <div className="sessions-view">
            <SessionHeader onStartFromCurrent={startSessionFromCurrentTabs} onInfer={inferSessions} />

            <CreateSessionForm onCreate={createSession} />

            <SessionList
                sessions={sessions}
                onRestore={restoreSession}
                onEnd={endSession}
                onDelete={deleteSession}
                onRename={renameSession}
                onSuggestName={canNameWithAi ? suggestName : undefined}
            />

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    );
};

export default SessionsView;
