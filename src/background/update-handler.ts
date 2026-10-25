import { broadcast, respondWith } from './respond';
import { ExtensionMessage } from '../types';

/**
 * UPDATE_X requests from the UI: save the edited item (upsert) in chrome.storage, broadcast
 * STORAGE_X_UPDATED so other open TabPlex tabs apply it, then reply. Returns true (async response),
 * or false when the payload has no id.
 */
export function handleUpdate<T extends { id: string }>(
    message: ExtensionMessage,
    save: (item: T) => Promise<void>,
    broadcastType: string,
    sendResponse: (response: unknown) => void
): boolean {
    const item = message.payload as T | undefined;
    if (!item?.id) return false;

    return respondWith(
        save(item).then(() => broadcast(broadcastType, item)),
        sendResponse
    );
}
