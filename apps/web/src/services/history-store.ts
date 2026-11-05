import type { Outline } from '../types/models';

export interface HistoryEntry {
  before: Outline;
  after: Outline;
  /** Consecutive entries with the same key (typing in one block) collapse into one undo step. */
  mergeKey?: string;
  apply(target: Outline): void;
}

const LIMIT = 200;
const MERGE_WINDOW_MS = 1500;

export class HistoryStore {
  private undoStack: (HistoryEntry & { at: number })[] = [];
  private redoStack: HistoryEntry[] = [];

  record(entry: HistoryEntry): void {
    const top = this.undoStack[this.undoStack.length - 1];
    const now = Date.now();
    if (entry.mergeKey && top?.mergeKey === entry.mergeKey && now - top.at < MERGE_WINDOW_MS) {
      top.after = entry.after;
      top.at = now;
    } else {
      this.undoStack.push({ ...entry, at: now });
      if (this.undoStack.length > LIMIT) this.undoStack.shift();
    }
    this.redoStack = [];
  }

  /** Called when notes change outside the editor (AI, trash restore); old steps would no longer line up. */
  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }

  undo(): boolean {
    const entry = this.undoStack.pop();
    if (!entry) return false;
    entry.apply(entry.before);
    this.redoStack.push(entry);
    return true;
  }

  redo(): boolean {
    const entry = this.redoStack.pop();
    if (!entry) return false;
    entry.apply(entry.after);
    this.undoStack.push({ ...entry, at: 0 });
    return true;
  }
}

export const historyStore = new HistoryStore();
