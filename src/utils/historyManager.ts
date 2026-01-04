import { CanvasElement } from '../types/canvas';

export interface HistoryAction {
    type: 'add' | 'update' | 'delete';
    elements: CanvasElement[];
    previousElements?: CanvasElement[];
}

export class HistoryManager {
    private past: HistoryAction[] = [];
    private future: HistoryAction[] = [];
    private maxHistory = 50;

    canUndo(): boolean {
        return this.past.length > 0;
    }

    canRedo(): boolean {
        return this.future.length > 0;
    }

    addAction(action: HistoryAction): void {
        this.past.push(action);
        if (this.past.length > this.maxHistory) {
            this.past.shift();
        }
        // Clear future when new action is added
        this.future = [];
    }

    undo(): HistoryAction | null {
        const action = this.past.pop();
        if (action) {
            this.future.push(action);
            return action;
        }
        return null;
    }

    redo(): HistoryAction | null {
        const action = this.future.pop();
        if (action) {
            this.past.push(action);
            return action;
        }
        return null;
    }

    clear(): void {
        this.past = [];
        this.future = [];
    }
}
