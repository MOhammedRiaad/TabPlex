import { addNote, deleteNote } from './storage';

// Helper function to safely send response
function safeSendResponse(_sendResponse: (response: any) => void, response: any) {
  try {
    _sendResponse(response);
  } catch (error) {
    // Response already sent or channel closed
    console.warn('Failed to send response:', error);
  }
}

// Handle note-related messages
export function handleNoteMessage(message: any, _sendResponse: (response: any) => void) {
  switch (message.type) {
    case 'ADD_NOTE':
      // Add a note
      if (message.payload) {
        let addNoteResponseSent = false;
        
        addNote(message.payload).then(() => {
          // Notify the side panel about the addition
          chrome.runtime.sendMessage({
            type: 'STORAGE_NOTE_ADDED',
            payload: message.payload
          }).catch(() => {}); // Suppress errors if message listener is unavailable
          
          if (!addNoteResponseSent) {
            addNoteResponseSent = true;
            safeSendResponse(_sendResponse, { success: true });
          }
        }).catch(error => {
          if (!addNoteResponseSent) {
            addNoteResponseSent = true;
            safeSendResponse(_sendResponse, { error: error.message });
          }
        });
        
        setTimeout(() => {
          if (!addNoteResponseSent) {
            addNoteResponseSent = true;
          }
        }, 1000);
        
        return true;
      }
      break;
    
    case 'DELETE_NOTE':
      // Delete a note
      if (message.payload && message.payload.id) {
        
        let deleteNoteResponseSent = false;
        
        deleteNote(message.payload.id).then(() => {
          // Notify the side panel about the deletion
          chrome.runtime.sendMessage({
            type: 'STORAGE_NOTE_DELETED',
            payload: { id: message.payload.id }
          }).catch(() => {}); // Suppress errors if message listener is unavailable
          
          if (!deleteNoteResponseSent) {
            deleteNoteResponseSent = true;
            safeSendResponse(_sendResponse, { success: true });
          }
        }).catch(error => {
          if (!deleteNoteResponseSent) {
            deleteNoteResponseSent = true;
            safeSendResponse(_sendResponse, { error: error.message });
          }
        });
        
        setTimeout(() => {
          if (!deleteNoteResponseSent) {
            deleteNoteResponseSent = true;
          }
        }, 1000);
        
        return true;
      }
      break;
  }
  
  return false;
}