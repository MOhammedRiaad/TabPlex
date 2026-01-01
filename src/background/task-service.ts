import { addTask, deleteTask } from './storage';

// Helper function to safely send response
function safeSendResponse(_sendResponse: (response: any) => void, response: any) {
  try {
    _sendResponse(response);
  } catch (error) {
    // Response already sent or channel closed
    console.warn('Failed to send response:', error);
  }
}

// Handle task-related messages
export function handleTaskMessage(message: any, _sendResponse: (response: any) => void) {
  switch (message.type) {
    case 'ADD_TASK':
      // Add a task
      if (message.payload) {
        let addTaskResponseSent = false;
        
        addTask(message.payload).then(() => {
          // Notify the side panel about the addition
          chrome.runtime.sendMessage({
            type: 'STORAGE_TASK_ADDED',
            payload: message.payload
          }).catch(() => {}); // Ignore errors from sendMessage
          
          if (!addTaskResponseSent) {
            addTaskResponseSent = true;
            safeSendResponse(_sendResponse, { success: true });
          }
        }).catch(error => {
          if (!addTaskResponseSent) {
            addTaskResponseSent = true;
            safeSendResponse(_sendResponse, { error: error.message });
          }
        });
        
        setTimeout(() => {
          if (!addTaskResponseSent) {
            addTaskResponseSent = true;
            safeSendResponse(_sendResponse, { success: true }); // Fallback response
          }
        }, 1000);
        
        return true;
      }
      break;
    
    case 'DELETE_TASK':
      // Delete a task
      if (message.payload && message.payload.id) {
        
        let deleteTaskResponseSent = false;
        
        deleteTask(message.payload.id).then(() => {
          // Notify the side panel about the deletion
          chrome.runtime.sendMessage({
            type: 'STORAGE_TASK_DELETED',
            payload: { id: message.payload.id }
          }).catch(() => {}); // Suppress errors if message listener is unavailable
          
          if (!deleteTaskResponseSent) {
            deleteTaskResponseSent = true;
            safeSendResponse(_sendResponse, { success: true });
          }
        }).catch(error => {
          if (!deleteTaskResponseSent) {
            deleteTaskResponseSent = true;
            safeSendResponse(_sendResponse, { error: error.message });
          }
        });
        
        setTimeout(() => {
          if (!deleteTaskResponseSent) {
            deleteTaskResponseSent = true;
          }
        }, 1000);
        
        return true;
      }
      break;
  }
  
  return false;
}