import { getAllSessions, addSession, updateSession, deleteSession, getSession } from './storage';
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
    }

    return false;
}

// Builds from before this release created a 30-minute session inference alarm. Remove it: TabPlex no longer infers
// sessions in the background (docs/specs/PRE_RELEASE_REVIEW_FIXES.md D2). Safe to delete after the next release.
const LEGACY_INFER_SESSIONS_ALARM = 'tabplex-infer-sessions';
chrome.alarms.clear(LEGACY_INFER_SESSIONS_ALARM).catch(() => {});
