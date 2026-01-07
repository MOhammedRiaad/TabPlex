import { getAllSessions, addSession, updateSession, deleteSession, getSession, getAllTabs } from './storage';
import { ExtensionMessage, Session } from '../types';

// Helper function to safely send response
// Helper function to safely send response
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function safeSendResponse(_sendResponse: (response: any) => void, response: unknown) {
    try {
        _sendResponse(response);
    } catch (error) {
        // Response already sent or channel closed
        console.warn('Failed to send response:', error);
    }
}

// Handle session-related messages
export function handleSessionMessage(message: ExtensionMessage, _sendResponse: (response: unknown) => void) {
    switch (message.type) {
        case 'GET_SESSIONS':
            // Return all sessions
            // ... existing code ...
            let sessionsResponseSent = false;

            getAllSessions()
                .then(sessions => {
                    if (!sessionsResponseSent) {
                        sessionsResponseSent = true;
                        safeSendResponse(_sendResponse, sessions);
                    }
                })
                .catch((error: unknown) => {
                    if (!sessionsResponseSent) {
                        sessionsResponseSent = true;
                        safeSendResponse(_sendResponse, { error: (error as Error).message });
                    }
                });

            setTimeout(() => {
                if (!sessionsResponseSent) {
                    sessionsResponseSent = true;
                }
            }, 1000);

            return true;

        case 'ADD_SESSION':
            // Add a session
            if (message.payload) {
                let addSessionResponseSent = false;

                addSession(message.payload as Session)
                    .then(() => {
                        if (!addSessionResponseSent) {
                            addSessionResponseSent = true;
                            safeSendResponse(_sendResponse, { success: true });
                        }
                    })
                    .catch((error: unknown) => {
                        if (!addSessionResponseSent) {
                            addSessionResponseSent = true;
                            safeSendResponse(_sendResponse, { error: (error as Error).message });
                        }
                    });

                setTimeout(() => {
                    if (!addSessionResponseSent) {
                        addSessionResponseSent = true;
                    }
                }, 1000);

                return true;
            }
            break;

        case 'UPDATE_SESSION':
            // Update a session
            if (message.payload) {
                let updateSessionResponseSent = false;

                updateSession(message.payload as Session)
                    .then(() => {
                        if (!updateSessionResponseSent) {
                            updateSessionResponseSent = true;
                            safeSendResponse(_sendResponse, { success: true });
                        }
                    })
                    .catch((error: unknown) => {
                        if (!updateSessionResponseSent) {
                            updateSessionResponseSent = true;
                            safeSendResponse(_sendResponse, { error: (error as Error).message });
                        }
                    });

                setTimeout(() => {
                    if (!updateSessionResponseSent) {
                        updateSessionResponseSent = true;
                    }
                }, 1000);

                return true;
            }
            break;

        case 'DELETE_SESSION':
            // Delete a session
            if (message.payload && (message.payload as { id: string }).id) {
                let deleteSessionResponseSent = false;
                const sessionId = (message.payload as { id: string }).id;

                deleteSession(sessionId)
                    .then(() => {
                        if (!deleteSessionResponseSent) {
                            deleteSessionResponseSent = true;
                            safeSendResponse(_sendResponse, { success: true });
                        }
                    })
                    .catch((error: unknown) => {
                        if (!deleteSessionResponseSent) {
                            deleteSessionResponseSent = true;
                            safeSendResponse(_sendResponse, { error: (error as Error).message });
                        }
                    });

                setTimeout(() => {
                    if (!deleteSessionResponseSent) {
                        deleteSessionResponseSent = true;
                    }
                }, 1000);

                return true;
            }
            break;

        case 'GET_SESSION':
            // Get a specific session
            if (message.payload && (message.payload as { id: string }).id) {
                let getSessionResponseSent = false;
                const sessionId = (message.payload as { id: string }).id;

                getSession(sessionId)
                    .then(session => {
                        if (!getSessionResponseSent) {
                            getSessionResponseSent = true;
                            safeSendResponse(_sendResponse, session);
                        }
                    })
                    .catch((error: unknown) => {
                        if (!getSessionResponseSent) {
                            getSessionResponseSent = true;
                            safeSendResponse(_sendResponse, { error: (error as Error).message });
                        }
                    });

                setTimeout(() => {
                    if (!getSessionResponseSent) {
                        getSessionResponseSent = true;
                    }
                }, 1000);

                return true;
            }
            break;

        case 'SESSION_INFERENCE_COMPLETE':
            // Handle session inference completion
            // This message is sent from the inferSessions function
            // We don't need to send a response for this
            console.log('Session inference completed:', message.payload);
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
