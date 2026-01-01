import { useEffect, useRef } from 'react';
import { useBoardStore } from '../store/boardStore';
import { Task } from '../types';

/**
 * Hook to manage browser push notifications for due tasks
 */
export const useTaskNotifications = () => {
  const tasks = useBoardStore(state => state.tasks);
  const notifiedTasksRef = useRef<Set<string>>(new Set());
  const checkIntervalRef = useRef<number | null>(null);
  const permissionRequestedRef = useRef<boolean>(false);

  // Request notification permission on mount
  useEffect(() => {
    if (!permissionRequestedRef.current && 'Notification' in window) {
      permissionRequestedRef.current = true;
      
      // Request permission if not already granted or denied
      if (Notification.permission === 'default') {
        Notification.requestPermission().then(permission => {
          console.log('Notification permission:', permission);
        });
      }
    }
  }, []);

  // Set up periodic checking
  useEffect(() => {
    // Check for due tasks and send notifications
    const checkDueTasks = () => {
      if (!('Notification' in window) || Notification.permission !== 'granted') {
        return;
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Get current tasks from store
      const currentTasks = useBoardStore.getState().tasks;

      // Find tasks that are due today or overdue, and not yet completed
      const dueTasks = currentTasks.filter((task: Task) => {
        // Skip if already notified
        if (notifiedTasksRef.current.has(task.id)) {
          return false;
        }

        // Skip completed tasks
        if (task.status === 'done') {
          return false;
        }

        // Check if task has a due date
        if (!task.dueDate) {
          return false;
        }

        const taskDueDate = new Date(task.dueDate);
        taskDueDate.setHours(0, 0, 0, 0);

        // Check if task is due today or overdue
        return taskDueDate.getTime() <= today.getTime();
      });

      // Send notifications for due tasks
      dueTasks.forEach((task: Task) => {
        const taskDueDate = new Date(task.dueDate!);
        taskDueDate.setHours(0, 0, 0, 0);
        const isOverdue = taskDueDate.getTime() < today.getTime();
        
        const title = isOverdue 
          ? `⚠️ Overdue Task: ${task.title}`
          : `📅 Task Due Today: ${task.title}`;
        
        const body = isOverdue
          ? `This task was due on ${taskDueDate.toLocaleDateString()}`
          : `Don't forget to complete this task today!`;

        try {
          // Get extension icon URL
          const iconUrl = chrome?.runtime?.getURL 
            ? chrome.runtime.getURL('assets/icon128.png')
            : '/assets/icon128.png';
          
          const notification = new Notification(title, {
            body: body,
            icon: iconUrl,
            badge: chrome?.runtime?.getURL 
              ? chrome.runtime.getURL('assets/icon32.png')
              : '/assets/icon32.png',
            tag: `task-${task.id}`, // Prevent duplicate notifications
            requireInteraction: task.priority === 'high', // Keep high priority notifications visible
          });

          // Mark as notified
          notifiedTasksRef.current.add(task.id);

          // Auto-close notification after 5 seconds (unless high priority)
          if (task.priority !== 'high') {
            setTimeout(() => {
              notification.close();
            }, 5000);
          }

          // Handle notification click
          notification.onclick = () => {
            window.focus();
            notification.close();
          };
        } catch (error) {
          console.error('Error showing notification:', error);
        }
      });
    };

    // Check immediately on mount
    checkDueTasks();

    // Check every minute for due tasks
    checkIntervalRef.current = setInterval(() => {
      checkDueTasks();
    }, 60000); // Check every minute

    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
    };
  }, [tasks]);

  // Clean up notified tasks when they're completed or deleted
  useEffect(() => {
    // Remove notified tasks that no longer exist or are completed
    notifiedTasksRef.current.forEach(taskId => {
      const task = tasks.find(t => t.id === taskId);
      if (!task || task.status === 'done') {
        notifiedTasksRef.current.delete(taskId);
      }
    });
  }, [tasks]);
};

