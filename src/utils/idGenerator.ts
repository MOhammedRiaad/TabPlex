/**
 * Generates a unique ID using crypto.randomUUID()
 * Falls back to timestamp-based ID if crypto is not available
 */
export const generateId = (prefix?: string): string => {
  const uuid = typeof crypto !== 'undefined' && crypto.randomUUID 
    ? crypto.randomUUID() 
    : `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  
  return prefix ? `${prefix}_${uuid}` : uuid;
};

/**
 * Generates a unique ID with a specific prefix
 */
export const generateTabId = (): string => generateId('tab');
export const generateFolderId = (): string => generateId('folder');
export const generateBoardId = (): string => generateId('board');
export const generateTaskId = (): string => generateId('task');
export const generateNoteId = (): string => generateId('note');
export const generateSessionId = (): string => generateId('session');
