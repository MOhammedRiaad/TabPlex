import { 
  getAllHistory, 
  addHistory, 
  updateHistory, 
  deleteHistory, 
  getHistory 
} from './storage';

// Helper function to safely send response
function safeSendResponse(_sendResponse: (response: any) => void, response: any) {
  try {
    _sendResponse(response);
  } catch (error) {
    // Response already sent or channel closed
    console.warn('Failed to send response:', error);
  }
}

// Handle history-related messages
export function handleHistoryMessage(message: any, _sendResponse: (response: any) => void) {
  switch (message.type) {
    case 'GET_HISTORY':
      // Return browser history items
      
      let historyResponseSent = false;
      
      getAllHistory().then(history => {
        if (!historyResponseSent) {
          historyResponseSent = true;
          safeSendResponse(_sendResponse, history);
        }
      }).catch(error => {
        if (!historyResponseSent) {
          historyResponseSent = true;
          safeSendResponse(_sendResponse, { error: error.message });
        }
      });
      
      setTimeout(() => {
        if (!historyResponseSent) {
          historyResponseSent = true;
          safeSendResponse(_sendResponse, { error: 'Timeout getting history' }); // Fallback response
        }
      }, 1000);
      
      return true;
    
    case 'ADD_HISTORY':
      // Add a history item
      if (message.payload) {
        
        let addHistoryResponseSent = false;
        
        addHistory(message.payload).then(() => {
          if (!addHistoryResponseSent) {
            addHistoryResponseSent = true;
            safeSendResponse(_sendResponse, { success: true });
          }
        }).catch(error => {
          if (!addHistoryResponseSent) {
            addHistoryResponseSent = true;
            safeSendResponse(_sendResponse, { error: error.message });
          }
        });
        
        setTimeout(() => {
          if (!addHistoryResponseSent) {
            addHistoryResponseSent = true;
            safeSendResponse(_sendResponse, { success: true }); // Fallback response
          }
        }, 1000);
        
        return true;
      }
      break;
    
    case 'UPDATE_HISTORY':
      // Update a history item
      if (message.payload) {
        
        let updateHistoryResponseSent = false;
        
        updateHistory(message.payload).then(() => {
          if (!updateHistoryResponseSent) {
            updateHistoryResponseSent = true;
            safeSendResponse(_sendResponse, { success: true });
          }
        }).catch(error => {
          if (!updateHistoryResponseSent) {
            updateHistoryResponseSent = true;
            safeSendResponse(_sendResponse, { error: error.message });
          }
        });
        
        setTimeout(() => {
          if (!updateHistoryResponseSent) {
            updateHistoryResponseSent = true;
            safeSendResponse(_sendResponse, { success: true }); // Fallback response
          }
        }, 1000);
        
        return true;
      }
      break;
    
    case 'DELETE_HISTORY':
      // Delete a history item
      if (message.payload && message.payload.id) {
        
        let deleteHistoryResponseSent = false;
        
        deleteHistory(message.payload.id).then(() => {
          if (!deleteHistoryResponseSent) {
            deleteHistoryResponseSent = true;
            safeSendResponse(_sendResponse, { success: true });
          }
        }).catch(error => {
          if (!deleteHistoryResponseSent) {
            deleteHistoryResponseSent = true;
            safeSendResponse(_sendResponse, { error: error.message });
          }
        });
        
        setTimeout(() => {
          if (!deleteHistoryResponseSent) {
            deleteHistoryResponseSent = true;
            safeSendResponse(_sendResponse, { success: true }); // Fallback response
          }
        }, 1000);
        
        return true;
      }
      break;
    
    case 'GET_HISTORY_ITEM':
      // Get a specific history item
      if (message.payload && message.payload.id) {
        
        let getHistoryItemResponseSent = false;
        
        getHistory(message.payload.id).then(historyItem => {
          if (!getHistoryItemResponseSent) {
            getHistoryItemResponseSent = true;
            safeSendResponse(_sendResponse, historyItem);
          }
        }).catch(error => {
          if (!getHistoryItemResponseSent) {
            getHistoryItemResponseSent = true;
            safeSendResponse(_sendResponse, { error: error.message });
          }
        });
        
        setTimeout(() => {
          if (!getHistoryItemResponseSent) {
            getHistoryItemResponseSent = true;
          }
        }, 1000);
        
        return true;
      }
      break;
    
    case 'GET_BROWSER_HISTORY':
      // Get actual browser history using chrome.history API
      
      let browserHistoryResponseSent = false;
      
      chrome.history.search({
        text: '',
        startTime: Date.now() - (30 * 24 * 60 * 60 * 1000), // Last 30 days
        maxResults: 100
      }).then(browserHistory => {
        if (!browserHistoryResponseSent) {
          browserHistoryResponseSent = true;
          safeSendResponse(_sendResponse, browserHistory);
        }
      }).catch(error => {
        if (!browserHistoryResponseSent) {
          browserHistoryResponseSent = true;
          safeSendResponse(_sendResponse, { error: error.message });
        }
      });
      
      setTimeout(() => {
        if (!browserHistoryResponseSent) {
          browserHistoryResponseSent = true;
        }
      }, 3000); // Longer timeout for history search
      
      return true;
  }
  
  return false;
}