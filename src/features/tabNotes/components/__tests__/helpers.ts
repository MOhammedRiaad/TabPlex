import { vi } from 'vitest';
import { TopicEdits } from '../TopicCard';

/** Edits that record their calls and change nothing (for tests that only look at the rendering) */
export const noEdits = (): TopicEdits => ({
    rename: vi.fn(),
    editBullet: vi.fn(),
    removeBullet: vi.fn(),
    removeConflict: vi.fn(),
    moveBullet: vi.fn(),
    separate: vi.fn(),
    removeTopic: vi.fn(),
});
