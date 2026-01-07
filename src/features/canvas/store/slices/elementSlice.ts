import { StateCreator } from 'zustand';
import { CanvasElement } from '../../types/canvas';
import { CanvasStoreState, ElementSlice } from '../types';

export const createElementSlice: StateCreator<CanvasStoreState, [], [], ElementSlice> = (set, get) => ({
    addElement: element => {
        const { activeCanvasId, canvases } = get();
        if (!activeCanvasId) return;

        // Save history first
        const currentCanvas = canvases.find(c => c.canvasId === activeCanvasId);
        if (currentCanvas) {
            get().saveHistory(activeCanvasId, [...currentCanvas.elements]);
        }

        set(state => ({
            canvases: state.canvases.map(canvas =>
                canvas.canvasId === state.activeCanvasId
                    ? {
                          ...canvas,
                          elements: [...canvas.elements, element],
                          updatedAt: Date.now(),
                      }
                    : canvas
            ),
        }));

        get().saveToStorage();
    },

    updateElement: (id, updates) => {
        set(state => ({
            canvases: state.canvases.map(canvas =>
                canvas.canvasId === state.activeCanvasId
                    ? {
                          ...canvas,
                          elements: canvas.elements.map(el => {
                              if (el.id === id) {
                                  const updated = { ...el, ...updates, updatedAt: Date.now() } as CanvasElement;
                                  return updated;
                              }
                              return el;
                          }),
                          updatedAt: Date.now(),
                      }
                    : canvas
            ),
        }));
        get().saveToStorage();
    },

    deleteElement: id => {
        const { activeCanvasId, canvases } = get();
        if (!activeCanvasId) return;

        const currentCanvas = canvases.find(c => c.canvasId === activeCanvasId);
        if (currentCanvas) {
            get().saveHistory(activeCanvasId, [...currentCanvas.elements]);
        }

        set(state => ({
            canvases: state.canvases.map(canvas =>
                canvas.canvasId === state.activeCanvasId
                    ? {
                          ...canvas,
                          elements: canvas.elements.filter(el => el.id !== id),
                          selectedIds: canvas.selectedIds.filter(sid => sid !== id),
                          updatedAt: Date.now(),
                      }
                    : canvas
            ),
        }));
        get().saveToStorage();
    },

    deleteElements: ids => {
        const { activeCanvasId, canvases } = get();
        if (!activeCanvasId) return;

        const currentCanvas = canvases.find(c => c.canvasId === activeCanvasId);
        if (currentCanvas) {
            get().saveHistory(activeCanvasId, [...currentCanvas.elements]);
        }

        set(state => ({
            canvases: state.canvases.map(canvas =>
                canvas.canvasId === state.activeCanvasId
                    ? {
                          ...canvas,
                          elements: canvas.elements.filter(el => !ids.includes(el.id)),
                          selectedIds: [],
                          updatedAt: Date.now(),
                      }
                    : canvas
            ),
        }));
        get().saveToStorage();
    },

    bringToFront: ids => {
        const { activeCanvasId, canvases } = get();
        if (!activeCanvasId) return;

        const currentCanvas = canvases.find(c => c.canvasId === activeCanvasId);
        if (currentCanvas) {
            get().saveHistory(activeCanvasId, [...currentCanvas.elements]);
        }

        set(state => ({
            canvases: state.canvases.map(canvas =>
                canvas.canvasId === state.activeCanvasId
                    ? {
                          ...canvas,
                          elements: [
                              ...canvas.elements.filter(el => !ids.includes(el.id)),
                              ...canvas.elements.filter(el => ids.includes(el.id)),
                          ],
                          updatedAt: Date.now(),
                      }
                    : canvas
            ),
        }));
        get().saveToStorage();
    },

    sendToBack: ids => {
        set(state => ({
            canvases: state.canvases.map(canvas =>
                canvas.canvasId === state.activeCanvasId
                    ? {
                          ...canvas,
                          elements: [
                              ...canvas.elements.filter(el => ids.includes(el.id)),
                              ...canvas.elements.filter(el => !ids.includes(el.id)),
                          ],
                          updatedAt: Date.now(),
                      }
                    : canvas
            ),
        }));
        get().saveToStorage();
    },

    bringForward: ids => {
        set(state => ({
            canvases: state.canvases.map(canvas => {
                if (canvas.canvasId !== state.activeCanvasId) return canvas;
                const elements = [...canvas.elements];
                ids.forEach(id => {
                    const index = elements.findIndex(el => el.id === id);
                    if (index < elements.length - 1) {
                        [elements[index], elements[index + 1]] = [elements[index + 1], elements[index]];
                    }
                });
                return { ...canvas, elements, updatedAt: Date.now() };
            }),
        }));
        get().saveToStorage();
    },

    sendBackward: ids => {
        set(state => ({
            canvases: state.canvases.map(canvas => {
                if (canvas.canvasId !== state.activeCanvasId) return canvas;
                const elements = [...canvas.elements];
                [...ids].reverse().forEach(id => {
                    const index = elements.findIndex(el => el.id === id);
                    if (index > 0) {
                        [elements[index], elements[index - 1]] = [elements[index - 1], elements[index]];
                    }
                });
                return { ...canvas, elements, updatedAt: Date.now() };
            }),
        }));
        get().saveToStorage();
    },

    groupElements: (ids: string[]) => {
        if (ids.length < 2) return; // Need at least 2 elements to group

        const groupId = `group-${Date.now()}`;
        set(state => ({
            canvases: state.canvases.map(canvas =>
                canvas.canvasId === state.activeCanvasId
                    ? {
                          ...canvas,
                          groups: [
                              ...canvas.groups,
                              {
                                  id: groupId,
                                  elementIds: ids,
                                  createdAt: Date.now(),
                              },
                          ],
                          updatedAt: Date.now(),
                      }
                    : canvas
            ),
        }));
        get().saveToStorage();
    },

    ungroupElements: (groupId: string) => {
        set(state => ({
            canvases: state.canvases.map(canvas =>
                canvas.canvasId === state.activeCanvasId
                    ? {
                          ...canvas,
                          groups: canvas.groups.filter(g => g.id !== groupId),
                          updatedAt: Date.now(),
                      }
                    : canvas
            ),
        }));
        get().saveToStorage();
    },

    alignElements: type => {
        const { activeCanvasId, canvases } = get();
        if (!activeCanvasId) return;
        const currentCanvas = canvases.find(c => c.canvasId === activeCanvasId);
        if (!currentCanvas || currentCanvas.selectedIds.length < 2) return;

        const selectedElements = currentCanvas.elements.filter(el => currentCanvas.selectedIds.includes(el.id));
        const updates: Record<string, Partial<CanvasElement>> = {};

        let targetValue: number;

        switch (type) {
            case 'left':
                targetValue = Math.min(...selectedElements.map(el => el.x));
                selectedElements.forEach(el => (updates[el.id] = { x: targetValue }));
                break;
            case 'center': // horizontal
                const minX = Math.min(...selectedElements.map(el => el.x));
                const maxX = Math.max(...selectedElements.map(el => el.x + el.width));
                const centerX = minX + (maxX - minX) / 2;
                selectedElements.forEach(el => (updates[el.id] = { x: centerX - el.width / 2 }));
                break;
            case 'right':
                const rightEdge = Math.max(...selectedElements.map(el => el.x + el.width));
                selectedElements.forEach(el => (updates[el.id] = { x: rightEdge - el.width }));
                break;
            case 'top':
                targetValue = Math.min(...selectedElements.map(el => el.y));
                selectedElements.forEach(el => (updates[el.id] = { y: targetValue }));
                break;
            case 'middle': // vertical
                const minY = Math.min(...selectedElements.map(el => el.y));
                const maxY = Math.max(...selectedElements.map(el => el.y + el.height));
                const centerY = minY + (maxY - minY) / 2;
                selectedElements.forEach(el => (updates[el.id] = { y: centerY - el.height / 2 }));
                break;
            case 'bottom':
                const bottomEdge = Math.max(...selectedElements.map(el => el.y + el.height));
                selectedElements.forEach(el => (updates[el.id] = { y: bottomEdge - el.height }));
                break;
        }

        get().saveHistory(activeCanvasId, [...currentCanvas.elements]);

        set(state => ({
            canvases: state.canvases.map(canvas =>
                canvas.canvasId === state.activeCanvasId
                    ? {
                          ...canvas,
                          elements: canvas.elements.map(el =>
                              updates[el.id]
                                  ? ({ ...el, ...updates[el.id], updatedAt: Date.now() } as CanvasElement)
                                  : el
                          ),
                          updatedAt: Date.now(),
                      }
                    : canvas
            ),
        }));
        get().saveToStorage();
    },

    distributeElements: type => {
        const { activeCanvasId, canvases } = get();
        if (!activeCanvasId) return;
        const currentCanvas = canvases.find(c => c.canvasId === activeCanvasId);
        if (!currentCanvas || currentCanvas.selectedIds.length < 3) return;

        const selectedElements = currentCanvas.elements.filter(el => currentCanvas.selectedIds.includes(el.id));
        const updates: Record<string, Partial<CanvasElement>> = {};

        if (type === 'horizontal') {
            const sorted = [...selectedElements].sort((a, b) => a.x - b.x);
            const first = sorted[0];
            const last = sorted[sorted.length - 1];
            const totalSpan = last.x + last.width / 2 - (first.x + first.width / 2);
            const step = totalSpan / (sorted.length - 1);

            sorted.forEach((el, index) => {
                if (index === 0 || index === sorted.length - 1) return;
                const newCenter = first.x + first.width / 2 + step * index;
                updates[el.id] = { x: newCenter - el.width / 2 };
            });
        } else {
            const sorted = [...selectedElements].sort((a, b) => a.y - b.y);
            const first = sorted[0];
            const last = sorted[sorted.length - 1];
            const totalSpan = last.y + last.height / 2 - (first.y + first.height / 2);
            const step = totalSpan / (sorted.length - 1);

            sorted.forEach((el, index) => {
                if (index === 0 || index === sorted.length - 1) return;
                const newCenter = first.y + first.height / 2 + step * index;
                updates[el.id] = { y: newCenter - el.height / 2 };
            });
        }

        get().saveHistory(activeCanvasId, [...currentCanvas.elements]);

        set(state => ({
            canvases: state.canvases.map(canvas =>
                canvas.canvasId === state.activeCanvasId
                    ? {
                          ...canvas,
                          elements: canvas.elements.map(el =>
                              updates[el.id]
                                  ? ({ ...el, ...updates[el.id], updatedAt: Date.now() } as CanvasElement)
                                  : el
                          ),
                          updatedAt: Date.now(),
                      }
                    : canvas
            ),
        }));
        get().saveToStorage();
    },

    reorderElement: (id, newIndex) => {
        const { activeCanvasId, canvases } = get();
        if (!activeCanvasId) return;

        const currentCanvas = canvases.find(c => c.canvasId === activeCanvasId);
        if (currentCanvas) {
            get().saveHistory(activeCanvasId, [...currentCanvas.elements]);
        }

        set(state => ({
            canvases: state.canvases.map(canvas => {
                if (canvas.canvasId !== activeCanvasId) return canvas;

                const elements = [...canvas.elements];
                const currentIndex = elements.findIndex(el => el.id === id);
                if (currentIndex === -1) return canvas;

                const [movedElement] = elements.splice(currentIndex, 1);
                elements.splice(newIndex, 0, movedElement);

                return {
                    ...canvas,
                    elements,
                    updatedAt: Date.now(),
                };
            }),
        }));
        get().saveToStorage();
    },
});
