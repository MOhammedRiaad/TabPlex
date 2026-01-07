export interface StorageService {
    get<T>(key: string): Promise<T | null>;
    set<T>(key: string, value: T): Promise<void>;
    remove(key: string): Promise<void>;
    getAll<T>(): Promise<{ [key: string]: T }>;
}

export class ChromeStorageService implements StorageService {
    async get<T>(key: string): Promise<T | null> {
        try {
            const result = await chrome.storage.local.get(key);
            return (result[key] as T) || null;
        } catch (error) {
            console.error(`Storage get error for key ${key}:`, error);
            return null;
        }
    }

    async set<T>(key: string, value: T): Promise<void> {
        try {
            await chrome.storage.local.set({ [key]: value });
        } catch (error) {
            console.error(`Storage set error for key ${key}:`, error);
            throw error;
        }
    }

    async remove(key: string): Promise<void> {
        try {
            await chrome.storage.local.remove(key);
        } catch (error) {
            console.error(`Storage remove error for key ${key}:`, error);
            throw error;
        }
    }

    async getAll<T>(): Promise<{ [key: string]: T }> {
        try {
            const result = await chrome.storage.local.get(null);
            return result as { [key: string]: T };
        } catch (error) {
            console.error('Storage getAll error:', error);
            return {};
        }
    }
}

export const storageService = new ChromeStorageService();
