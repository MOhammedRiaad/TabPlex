import { addSession as addSessionToDB, deleteSession as deleteSessionFromDB } from '../../../utils/storage';
import { SessionSlice, BoardStoreCreator } from './types';

export const createSessionSlice: BoardStoreCreator<SessionSlice> = set => ({
    sessions: [],

    addSession: session => {
        const newSession = {
            ...session,
            tabIds: session.tabIds || [],
            createdAt: new Date().toISOString(),
        };

        set(state => ({
            sessions: [...state.sessions, newSession],
        }));

        addSessionToDB(newSession).catch(console.error);

        chrome.runtime
            .sendMessage({
                type: 'ADD_SESSION',
                payload: newSession,
            })
            .catch(console.error);
    },

    updateSession: (id, updates) =>
        set(state => ({
            sessions: state.sessions.map(session => (session.id === id ? { ...session, ...updates } : session)),
        })),

    deleteSession: id => {
        set(state => ({
            sessions: state.sessions.filter(session => session.id !== id),
        }));

        deleteSessionFromDB(id).catch(console.error);

        chrome.runtime
            .sendMessage({
                type: 'DELETE_SESSION',
                payload: { id },
            })
            .catch(console.error);
    },

    deleteSessionSilently: id => {
        set(state => ({
            sessions: state.sessions.filter(session => session.id !== id),
        }));

        deleteSessionFromDB(id).catch(console.error);
    },

    fetchSessions: async () => {
        try {
            const response = await chrome.runtime.sendMessage({
                type: 'GET_SESSIONS',
            });

            if (response && !response.error) {
                set({ sessions: response });
            }
        } catch (error) {
            console.error('Error fetching sessions:', error);
        }
    },

    addSessionFromBackground: async session => {
        try {
            await chrome.runtime.sendMessage({
                type: 'ADD_SESSION',
                payload: session,
            });

            set(state => ({
                sessions: [
                    ...state.sessions,
                    {
                        ...session,
                        tabIds: session.tabIds || [],
                        createdAt: new Date().toISOString(),
                    },
                ],
            }));
        } catch (error) {
            console.error('Error adding session:', error);
        }
    },

    updateSessionFromBackground: async (id, updates) => {
        try {
            await chrome.runtime.sendMessage({
                type: 'UPDATE_SESSION',
                payload: { id, ...updates },
            });

            set(state => ({
                sessions: state.sessions.map(session =>
                    session.id === id
                        ? {
                              ...session,
                              ...updates,
                              tabIds: updates.tabIds !== undefined ? updates.tabIds : session.tabIds,
                          }
                        : session
                ),
            }));
        } catch (error) {
            console.error('Error updating session:', error);
        }
    },

    deleteSessionFromBackground: async id => {
        try {
            await chrome.runtime.sendMessage({
                type: 'DELETE_SESSION',
                payload: { id },
            });

            set(state => ({
                sessions: state.sessions.filter(session => session.id !== id),
            }));
        } catch (error) {
            console.error('Error deleting session:', error);
        }
    },
});
