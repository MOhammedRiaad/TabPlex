import { getAllSessions, addSession, updateSession, deleteSession, getSession, getAllTabs } from './storage';
import { respondWith } from './respond';
import { ExtensionMessage, Session } from '../types';

// Handle session-related messages
export function handleSessionMessage(message: ExtensionMessage, sendResponse: (response: unknown) => void) {
    const id = (message.payload as { id?: string } | undefined)?.id;

    switch (message.type) {
        case 'GET_SESSIONS':
            // Return all sessions
            return respondWith(getAllSessions(), sendResponse, {
                timeoutMs: 1000,
                timeoutError: 'Timed out',
                map: sessions => sessions,
            });

        case 'ADD_SESSION':
            if (message.payload) {
                return respondWith(addSession(message.payload as Session), sendResponse, {
                    timeoutMs: 1000,
                    timeoutError: 'Timed out',
                });
            }
            break;

        case 'UPDATE_SESSION':
            if (message.payload) {
                return respondWith(updateSession(message.payload as Session), sendResponse, {
                    timeoutMs: 1000,
                    timeoutError: 'Timed out',
                });
            }
            break;

        case 'DELETE_SESSION':
            if (id) {
                return respondWith(deleteSession(id), sendResponse, { timeoutMs: 1000, timeoutError: 'Timed out' });
            }
            break;

        case 'GET_SESSION':
            // Get a specific session
            if (id) {
                return respondWith(getSession(id), sendResponse, {
                    timeoutMs: 1000,
                    timeoutError: 'Timed out',
                    map: session => session,
                });
            }
            break;

        case 'SESSION_INFERENCE_COMPLETE':
            // Sent from inferSessions; there is nothing to answer
            console.log('Session inference completed');
            break;
    }

    return false;
}

// Function to infer sessions based on tab usage patterns
export async function inferSessions() {
    try {
        // Get all tabs from storage
        const allTabs = await getAllTabs();
        const now = new Date();

        // Group tabs by recency and patterns
        // For now, let's create sessions based on tabs accessed in the last hour
        const recentThreshold = new Date(now.getTime() - 60 * 60 * 1000); // 1 hour ago
        const recentTabs = allTabs.filter(tab => new Date(tab.lastAccessed) > recentThreshold);

        if (recentTabs.length > 0) {
            // Create a session for recently accessed tabs
            const session = {
                id: `session_${Date.now()}`,
                name: `Recent Activity Session - ${now.toLocaleString()}`,
                tabIds: recentTabs.map(tab => tab.id),
                startTime: recentThreshold.toISOString(),
                endTime: now.toISOString(),
                createdAt: now.toISOString(),
            };

            // Add the inferred session to storage
            await addSession(session);

            // Notify the UI about the new session
            chrome.runtime.sendMessage({
                type: 'SESSION_INFERENCE_COMPLETE',
                payload: session,
            });
        }
    } catch (error) {
        console.error('Error inferring sessions:', error);
    }
}

// Set up automatic session inference periodically
// Check for session patterns every 30 minutes
setInterval(inferSessions, 30 * 60 * 1000); // 30 minutes

// Also infer sessions when the extension starts
chrome.runtime.onStartup.addListener(() => {
    // Small delay to ensure everything is loaded
    setTimeout(inferSessions, 5000); // 5 seconds after startup
});
